import { readFile } from 'node:fs/promises';

import { providerRegistry } from './adapters.js';
import { failureEnvelope, successEnvelope } from './envelope.js';
import { evaluateHostGuard } from './host-guard.js';
import { buildProviderInvocation } from './invocation.js';
import {
  buildChildEnvironment,
  defaultRuntimePolicy,
  validateProviderOptions,
} from './runtime-policy.js';
import { runProviderSubprocess } from './subprocess.js';

import type {
  ProviderAdapter,
  ProviderAdapterRegistry,
} from './adapters.js';
import type { ProviderInvocation } from './invocation.js';
import type { RunProviderSubprocessOptions } from './subprocess.js';
import type {
  ConsensusCliRunEnvelope,
  ConsensusCliRunRequest,
  ProviderDiagnostics,
  ProviderErrorCode,
  StructuredOutputStrategy,
} from './types.js';
import type { ProviderProcessResult } from './subprocess.js';

export interface RunProviderTurnDependencies {
  registry?: ProviderAdapterRegistry;
  readSchema?: (schemaPath: string) => Promise<unknown>;
  runSubprocess?: (
    invocation: ProviderInvocation,
    options: RunProviderSubprocessOptions,
  ) => Promise<ProviderProcessResult>;
  parentEnv?: NodeJS.ProcessEnv;
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

  const effectiveRequest: ConsensusCliRunRequest = {
    ...request,
    runtime_policy: defaultRuntimePolicy(request.runtime_policy),
  };
  const maxAttempts = effectiveRequest.max_attempts ?? 1;
  const strategy = selectStructuredOutputStrategy(adapter);
  const runSubprocess = dependencies.runSubprocess ?? runProviderSubprocess;
  const parentEnv = dependencies.parentEnv ?? process.env;
  const childEnv = buildChildEnvironment({
    parentEnv,
    request: effectiveRequest,
    hostEnv: hostGuard.child_env ?? {},
  });
  let validationFeedback: string | undefined;
  let lastInvocation: ProviderInvocation | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const invocationRequest =
      validationFeedback === undefined
        ? effectiveRequest
        : {
            ...effectiveRequest,
            prompt: `${request.prompt}\n\nSchema validation failed: ${validationFeedback}\nReturn only JSON matching the schema.`,
          };
    const invocation = buildProviderInvocation(adapter, invocationRequest, {
      strategy,
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
    );

    if (!processResult.ok) {
      const classification = adapter.classifyRunFailure(processResult);
      if (classification.retryable && attempt < maxAttempts) {
        validationFeedback = classification.message;
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
        diagnostics,
      });
    }

    const providerOutput = extractProviderOutput(invocation, processResult);
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
        diagnostics,
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
        diagnostics,
      });
    }

    const validation = validateSchemaSubset(parsed.value, schema);
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
        diagnostics,
      });
    }

    return successEnvelope({
      provider: request.provider,
      args: invocation.redacted_command,
      stdout: providerOutput.value,
      stderr: processResult.stderr,
      json: parsed.value,
      attempts: {
        cli_attempts: attempt,
        terminal_reason: 'success',
      },
      diagnostics,
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

type ValidationResult = { ok: true } | { ok: false; message: string };

function validateSchemaSubset(
  value: unknown,
  schema: unknown,
): ValidationResult {
  if (!isRecord(schema)) return { ok: true };

  if (schema.type === 'object' && !isRecord(value)) {
    return { ok: false, message: 'Expected provider JSON to be an object.' };
  }

  if (Array.isArray(schema.required)) {
    if (!isRecord(value)) {
      return {
        ok: false,
        message: 'Expected provider JSON to be an object with required fields.',
      };
    }
    for (const field of schema.required) {
      if (typeof field === 'string' && !(field in value)) {
        return {
          ok: false,
          message: `Missing required JSON field: ${field}`,
        };
      }
    }
  }

  if (isRecord(schema.properties) && isRecord(value)) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      if (!(field in value) || !isRecord(fieldSchema)) continue;
      const type = fieldSchema.type;
      if (typeof type === 'string' && !matchesJsonType(value[field], type)) {
        return {
          ok: false,
          message: `Field ${field} must be ${type}.`,
        };
      }
    }
  }

  return { ok: true };
}

function matchesJsonType(value: unknown, type: string) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
