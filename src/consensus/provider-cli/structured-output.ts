import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { providerRegistry } from './adapters.js';
import type { ProviderAdapter, ProviderAdapterRegistry } from './adapters.js';
import { failureEnvelope, successEnvelope } from './envelope.js';
import { evaluateHostGuard } from './host-guard.js';
import { buildProviderInvocation } from './invocation.js';
import type { ProviderInvocation } from './invocation.js';
import {
  buildChildEnvironment,
  defaultRuntimePolicy,
  validateProviderOptions,
} from './runtime-policy.js';
import { isRecord, validateSchemaSubset } from './schema-validate.js';
import { runProviderSubprocess } from './subprocess.js';
import type { RunProviderSubprocessOptions } from './subprocess.js';
import type { ProviderProcessResult } from './subprocess.js';
import type {
  ConsensusCliRunEnvelope,
  ConsensusCliRunRequest,
  ProviderDiagnostics,
  ProviderErrorCode,
  StructuredOutputStrategy,
} from './types.js';

export interface RunProviderTurnDependencies {
  registry?: ProviderAdapterRegistry;
  readSchema?: (schemaPath: string) => Promise<unknown>;
  runSubprocess?: (
    invocation: ProviderInvocation,
    options: RunProviderSubprocessOptions,
  ) => Promise<ProviderProcessResult>;
  parentEnv?: NodeJS.ProcessEnv;
  submitCommand?: string;
}

export function selectStructuredOutputStrategy(
  adapter: ProviderAdapter,
): StructuredOutputStrategy {
  if (adapter.capabilities.schema_strategies.includes('constrained_native')) {
    return 'constrained_native';
  }
  if (adapter.capabilities.schema_strategies.includes('provider_validated')) {
    return 'provider_validated';
  }
  return 'prompt_only';
}

export async function runProviderTurn(
  request: ConsensusCliRunRequest,
  dependencies: RunProviderTurnDependencies = {},
): Promise<ConsensusCliRunEnvelope> {
  const registry = dependencies.registry ?? providerRegistry();
  const adapter = registry.get(request.provider);
  if (!adapter) {
    return preInvocationFailure({
      provider: request.provider,
      code: 'PROVIDER_UNSUPPORTED',
      message: `Provider is not supported: ${request.provider}`,
      terminalReason: 'unsupported_provider',
    });
  }

  const optionValidation = validateProviderOptions(
    request,
    adapter.capabilities,
  );
  if (!optionValidation.ok) {
    return preInvocationFailure({
      provider: request.provider,
      code: optionValidation.code,
      message: optionValidation.message,
      terminalReason: optionValidation.option,
    });
  }

  const hostGuard = evaluateHostGuard({
    host: request.host,
    provider: request.provider,
  });
  if (!hostGuard.allowed) {
    return preInvocationFailure({
      provider: request.provider,
      code: hostGuard.code,
      message: hostGuard.message,
      terminalReason: 'host_recursion_blocked',
      diagnostics: hostGuard.diagnostics,
    });
  }

  const readSchema = dependencies.readSchema ?? readJsonSchema;
  let schema: unknown;
  try {
    schema = await readSchema(request.schema_path);
  } catch (error) {
    return preInvocationFailure({
      provider: request.provider,
      code: 'CONSENSUS_CLI_USAGE',
      message: `Could not read schema: ${error instanceof Error ? error.message : String(error)}`,
      terminalReason: 'schema_read_failed',
    });
  }
  const inlineJsonSchema = JSON.stringify(schema);
  if (inlineJsonSchema === undefined) {
    return preInvocationFailure({
      provider: request.provider,
      code: 'CONSENSUS_CLI_USAGE',
      message: 'Schema must be JSON-serializable.',
      terminalReason: 'schema_read_failed',
    });
  }

  const effectiveRequest: ConsensusCliRunRequest = {
    ...request,
    runtime_policy: defaultRuntimePolicy(request.runtime_policy),
  };
  const maxAttempts = effectiveRequest.max_attempts ?? 1;
  const strategy = selectStructuredOutputStrategy(adapter);
  const runSubprocess = dependencies.runSubprocess ?? runProviderSubprocess;
  const parentEnv = dependencies.parentEnv ?? process.env;
  const submitCapturePath = submitCaptureFile();
  const submitCommand =
    dependencies.submitCommand ?? buildConsensusSubmitCommand();
  const childEnv = buildChildEnvironment({
    parentEnv,
    request: effectiveRequest,
    hostEnv: {
      ...hostGuard.child_env,
      CONSENSUS_SUBMIT_COMMAND: submitCommand,
      CONSENSUS_SUBMIT_FILE: submitCapturePath,
      CONSENSUS_SUBMIT_SCHEMA: path.resolve(request.schema_path),
    },
  });
  let validationFeedback: string | undefined;
  let lastInvocation: ProviderInvocation | undefined;
  let exitClassification: ProviderDiagnostics['exit_classification'];

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await cleanupSubmitCaptureFile(submitCapturePath);
      const invocationRequest = {
        ...effectiveRequest,
        prompt: promptForStrategy({
          prompt: request.prompt,
          strategy,
          inlineJsonSchema,
          submitCaptureEnabled: true,
          submitCommand,
          validationFeedback,
        }),
      };
      const invocation = buildProviderInvocation(adapter, invocationRequest, {
        strategy,
        inlineJsonSchema,
      });
      lastInvocation = invocation;
      const processResult = await runSubprocess(invocation, {
        env: childEnv,
        maxOutputBytes: request.max_output_bytes,
        timeoutSec: request.max_runtime_sec,
      });
      const diagnostics = mergeDiagnostics(
        {
          strategy_used: strategy,
          output_mode: invocation.output_mode,
          redacted_command: invocation.redacted_command,
        },
        hostGuard.diagnostics,
        processResult.diagnostics,
        exitClassificationDiagnostics(exitClassification),
      );

      if (!processResult.ok) {
        const classification = adapter.classifyRunFailure(processResult);
        exitClassification = classification.exit_classification;
        const failureDiagnostics = mergeDiagnostics(
          diagnostics,
          exitClassificationDiagnostics(exitClassification),
        );
        if (classification.retryable && attempt < maxAttempts) {
          continue;
        }

        return failureEnvelope({
          provider: request.provider,
          code: classification.code,
          message: classification.message,
          retryable: false,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: classification.terminal_reason,
          },
          diagnostics: failureDiagnostics,
        });
      }

      const submittedVerdict = await readSubmittedVerdict(
        submitCapturePath,
        schema,
      );
      if (submittedVerdict.ok) {
        return successEnvelope({
          provider: request.provider,
          args: invocation.redacted_command,
          stdout: submittedVerdict.raw,
          stderr: processResult.stderr,
          json: submittedVerdict.value,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: 'success',
          },
          diagnostics: mergeDiagnostics(diagnostics, {
            verdict_source: 'submit',
          }),
        });
      }

      const providerOutput = extractProviderOutput(invocation, processResult);
      const finalMessageDiagnostics = mergeDiagnostics(diagnostics, {
        verdict_source: 'final_message',
      });
      if (!providerOutput.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = providerOutput.message;
          continue;
        }

        return failureEnvelope({
          provider: request.provider,
          code: 'PROVIDER_INVALID_JSON',
          message: providerOutput.message,
          retryable: false,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: 'missing_provider_output',
          },
          diagnostics: finalMessageDiagnostics,
        });
      }

      const parsed = parseProviderJson(providerOutput.value);
      if (!parsed.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = parsed.message;
          continue;
        }

        return failureEnvelope({
          provider: request.provider,
          code: 'PROVIDER_INVALID_JSON',
          message: parsed.message,
          retryable: false,
          stdout: providerOutput.value,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: 'invalid_json',
          },
          diagnostics: finalMessageDiagnostics,
        });
      }

      const verdictJson = extractStructuredJsonValue(parsed.value);
      const validation = validateSchemaSubset(verdictJson, schema);
      if (!validation.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = validation.message;
          continue;
        }

        return failureEnvelope({
          provider: request.provider,
          code: 'PROVIDER_SCHEMA_VALIDATION',
          message: validation.message,
          retryable: false,
          stdout: providerOutput.value,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: 'schema_validation',
          },
          diagnostics: finalMessageDiagnostics,
        });
      }

      return successEnvelope({
        provider: request.provider,
        args: invocation.redacted_command,
        stdout: providerOutput.value,
        stderr: processResult.stderr,
        json: verdictJson,
        attempts: {
          cli_attempts: attempt,
          terminal_reason: 'success',
        },
        diagnostics: finalMessageDiagnostics,
      });
    }

    return failureEnvelope({
      provider: request.provider,
      code: 'PROVIDER_EXIT',
      message: 'Provider run ended without a terminal result.',
      retryable: false,
      attempts: {
        cli_attempts: maxAttempts,
        terminal_reason: 'attempt_budget_exhausted',
      },
      diagnostics: lastInvocation
        ? {
            strategy_used: strategy,
            output_mode: lastInvocation.output_mode,
            redacted_command: lastInvocation.redacted_command,
          }
        : undefined,
    });
  } finally {
    await cleanupSubmitCaptureFile(submitCapturePath);
  }
}

async function readJsonSchema(schemaPath: string): Promise<unknown> {
  return JSON.parse(await readFile(schemaPath, 'utf8'));
}

function preInvocationFailure(input: {
  provider: ConsensusCliRunRequest['provider'];
  code: ProviderErrorCode;
  message: string;
  terminalReason: string;
  diagnostics?: ProviderDiagnostics;
}): ConsensusCliRunEnvelope {
  return failureEnvelope({
    provider: input.provider,
    code: input.code,
    message: input.message,
    retryable: false,
    attempts: {
      cli_attempts: 0,
      terminal_reason: input.terminalReason,
    },
    diagnostics: input.diagnostics,
  });
}

type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

type ExtractOutputResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

type SubmittedVerdictResult =
  | { ok: true; raw: string; value: unknown }
  | { ok: false };

function extractProviderOutput(
  invocation: ProviderInvocation,
  result: ProviderProcessResult,
): ExtractOutputResult {
  if (invocation.output_mode !== 'last_message_file') {
    return { ok: true, value: result.stdout };
  }

  if (result.ok && result.last_message?.trim()) {
    return { ok: true, value: result.last_message };
  }

  return {
    ok: false,
    message: 'Provider did not write a last-message file response.',
  };
}

function parseProviderJson(stdout: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(stdout.trim()) };
  } catch (error) {
    return {
      ok: false,
      message: `Provider returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function readSubmittedVerdict(
  filePath: string,
  schema: unknown,
): Promise<SubmittedVerdictResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return { ok: false };
  }

  if (!raw.trim()) return { ok: false };

  const parsed = parseProviderJson(raw);
  if (!parsed.ok) return { ok: false };

  const validation = validateSchemaSubset(parsed.value, schema);
  if (!validation.ok) return { ok: false };

  return { ok: true, raw, value: parsed.value };
}

async function cleanupSubmitCaptureFile(filePath: string) {
  try {
    await rm(filePath, { force: true });
  } catch {
    // Best-effort cleanup mirrors the existing transient capture-file posture.
  }
}

function extractStructuredJsonValue(value: unknown): unknown {
  if (!isRecord(value)) return value;

  if ('structured_output' in value) {
    return value.structured_output;
  }

  const result = value.result;
  if (typeof result !== 'string') return value;

  try {
    return JSON.parse(result.trim());
  } catch {
    return extractFirstJsonObject(result) ?? value;
  }
}

function promptForStrategy(input: {
  prompt: string;
  strategy: StructuredOutputStrategy;
  inlineJsonSchema: string;
  submitCaptureEnabled?: boolean;
  submitCommand?: string;
  validationFeedback?: string;
}) {
  const parts = [input.prompt];

  if (input.submitCaptureEnabled) {
    const submitCommand =
      input.submitCommand ?? buildConsensusSubmitCommand();
    parts.push(
      'Verdict submission:',
      'Before ending the turn, submit the final verdict by running this exact command and passing the JSON verdict on stdin:',
      `\`${submitCommand}\``,
      'The same command is injected as CONSENSUS_SUBMIT_COMMAND; do not substitute a bare `consensus` executable.',
      'The command validates against the active schema from CONSENSUS_SUBMIT_SCHEMA and captures to CONSENSUS_SUBMIT_FILE.',
      'If submission fails, fix the reported schema error and run the command again.',
      'Also keep the final-message JSON fallback: end with only the same JSON object matching the schema.',
    );
  }

  if (input.validationFeedback) {
    parts.push(
      `Schema validation failed: ${input.validationFeedback}`,
      'Return only JSON matching the schema.',
    );
  }

  if (input.strategy === 'prompt_only') {
    parts.push(
      'Structured output requirements:',
      'Return only one JSON object matching this JSON Schema.',
      'Do not wrap the JSON in Markdown.',
      'Do not include prose before or after the JSON object.',
      '<JSON_SCHEMA>',
      input.inlineJsonSchema,
      '</JSON_SCHEMA>',
    );
  }

  return parts.join('\n\n');
}

function extractFirstJsonObject(text: string): unknown | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char !== '}') continue;

    depth -= 1;
    if (depth !== 0) continue;

    const candidate = text.slice(start, index + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      start = -1;
      depth = 0;
    }
  }

  return undefined;
}

function mergeDiagnostics(
  ...diagnostics: Array<ProviderDiagnostics | undefined>
): ProviderDiagnostics {
  const merged: ProviderDiagnostics = {};
  const warnings: string[] = [];

  for (const item of diagnostics) {
    if (!item) continue;
    Object.assign(merged, item);
    if (item.warnings) warnings.push(...item.warnings);
  }
  if (warnings.length > 0) merged.warnings = warnings;
  return merged;
}

function exitClassificationDiagnostics(
  exitClassification: ProviderDiagnostics['exit_classification'],
): ProviderDiagnostics | undefined {
  return exitClassification
    ? { exit_classification: exitClassification }
    : undefined;
}

function submitCaptureFile() {
  return path.join(tmpdir(), `consensus-submit-${randomUUID()}.json`);
}

export function buildConsensusSubmitCommand(input: {
  nodePath?: string;
  cliPath?: string;
} = {}) {
  const nodePath = input.nodePath ?? process.execPath;
  const cliPath = input.cliPath ?? currentConsensusCliPath();
  return `${shellQuote(nodePath)} ${shellQuote(cliPath)} submit --json -`;
}

function currentConsensusCliPath() {
  if (process.argv[1]) return path.resolve(process.argv[1]);
  return fileURLToPath(import.meta.url);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
