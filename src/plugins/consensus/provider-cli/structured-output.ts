import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { providerExecutableEnvNames, providerRegistry } from './adapters.js';
import type { ProviderAdapter, ProviderAdapterRegistry } from './adapters.js';
import {
  consultationIdFor,
  continuationMode,
  continuationReceipt,
  continuationUsageError,
  reconstructedContinuationPrompt,
} from './continuation.js';
import type { ProviderTurnTrace } from './continuation.js';
import {
  failureEnvelope,
  successEnvelope,
  textSuccessEnvelope,
} from './envelope.js';
import { resolveProviderExecutable } from './executable.js';
import { evaluateHostGuard } from './host-guard.js';
import { buildProviderInvocation } from './invocation.js';
import type { ProviderInvocation } from './invocation.js';
import { checkProviderPrerequisites, nodeProbeCommandRunner } from './probe.js';
import type { ProbeCommandRunner } from './probe.js';
import {
  extractProviderResultText,
  extractStructuredJsonValue,
} from './provider-output.js';
import {
  buildChildEnvironment,
  defaultRuntimePolicy,
  validateProviderOptions,
} from './runtime-policy.js';
import { validateSchemaSubset } from './schema-validate.js';
import {
  assertWithinSubmitCaptureLimit,
  CONSENSUS_SUBMIT_MAX_BYTES_ENV,
  submitCaptureMaxBytes,
  submitCaptureFilePath,
} from './submit-capture.js';
import { readBoundedRegularFile, runProviderSubprocess } from './subprocess.js';
import type { RunProviderSubprocessOptions } from './subprocess.js';
import type { ProviderProcessResult } from './subprocess.js';
import type {
  ConsensusCliRunEnvelope,
  ConsensusCliRunRequest,
  ContinuationMode,
  ProviderDiagnostics,
  ProviderErrorCode,
  RunOutputKind,
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
  // Checks adapter prerequisites before spawn. Default: a node runner over
  // parentEnv. Unused for adapters without prerequisites.
  probeRunner?: ProbeCommandRunner;
  submitCommand?: string;
  transport?: ProviderTurnTransportOptions;
}

export interface ProviderTurnTransportOptions {
  submitCaptureEnabled?: boolean;
  strategy?: StructuredOutputStrategy;
  lastMessageFile?: string;
  preserveLastMessageFile?: boolean;
}

export function selectStructuredOutputStrategy(
  adapter: ProviderAdapter,
  options: {
    output?: RunOutputKind;
    submitCaptureEnabled?: boolean;
    strategy?: StructuredOutputStrategy;
  } = {},
): StructuredOutputStrategy {
  // Text mode has no schema, so no structured strategy applies to it.
  if (options.output === 'text') return 'text';
  if (options.strategy) return options.strategy;
  if (
    options.submitCaptureEnabled &&
    adapter.capabilities.schema_strategies.includes('constrained_native') &&
    adapter.capabilities.schema_strategies.includes('prompt_only')
  ) {
    // Codex strict output can fail before the peer turn starts; Claude provider validation constrains only the final message.
    return 'prompt_only';
  }
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
  const consultationId = consultationIdFor(request);
  const mode = continuationMode(request);
  const withReceipt = (
    envelope: ConsensusCliRunEnvelope,
    receiptMode: ContinuationMode,
    trace: ProviderTurnTrace,
    fallbackReason?: string,
  ): ConsensusCliRunEnvelope => ({
    ...envelope,
    continuation: continuationReceipt({
      request,
      adapter,
      mode: receiptMode,
      consultationId,
      trace,
      fallbackReason,
    }),
  });

  if (adapter?.not_admitted_reason) {
    return withReceipt(
      preInvocationFailure({
        provider: request.provider,
        code: 'PROVIDER_UNSUPPORTED',
        message: `Provider ${request.provider} is registered but not admitted: ${adapter.not_admitted_reason}`,
        terminalReason: 'provider_not_admitted',
      }),
      mode,
      {},
    );
  }

  const usageError = continuationUsageError(request, adapter?.isSessionId);
  if (usageError) {
    return withReceipt(
      preInvocationFailure({
        provider: request.provider,
        code: 'CONSENSUS_CLI_USAGE',
        message: usageError,
        terminalReason: 'continuation_usage',
      }),
      mode,
      {},
    );
  }

  const continuation = request.continuation;
  const runReconstructed = async (
    packet: string,
    fallbackReason?: string,
    rejected?: ConsensusCliRunEnvelope,
  ) => {
    const trace: ProviderTurnTrace = {};
    const envelope = await runStructuredTurn(
      {
        ...request,
        prompt: reconstructedContinuationPrompt(packet, fallbackReason),
      },
      dependencies,
      trace,
    );
    return withReceipt(
      rejected ? withRejectedResume(envelope, rejected) : envelope,
      'reconstructed',
      trace,
      fallbackReason,
    );
  };

  if (mode === 'reconstructed') {
    return runReconstructed(request.prompt);
  }
  if (mode !== 'native-resume' || !continuation?.session_id) {
    const trace: ProviderTurnTrace = {};
    const envelope = await runStructuredTurn(request, dependencies, trace);
    return withReceipt(envelope, 'new', trace);
  }

  const requestedSessionId = continuation.session_id;
  const fallbackPacket =
    continuation.fallback === 'reconstructed'
      ? continuation.fallback_prompt
      : undefined;
  const resumeStatus = adapter?.capabilities.continuation?.native_resume;
  if (adapter && resumeStatus !== 'verified') {
    const reason = `native_resume_${resumeStatus ?? 'unsupported'}`;
    if (fallbackPacket) return runReconstructed(fallbackPacket, reason);
    return withReceipt(
      preInvocationFailure({
        provider: request.provider,
        code: 'PROVIDER_UNSUPPORTED_OPTION',
        message: `Native resume is ${resumeStatus ?? 'unsupported'} for provider ${request.provider}; use --resume-fallback reconstructed with a continuation packet, or --continuation reconstructed.`,
        terminalReason: reason,
      }),
      'native-resume',
      {},
    );
  }

  const trace: ProviderTurnTrace = {};
  const envelope = await runStructuredTurn(request, dependencies, trace, {
    resumeSessionId: requestedSessionId,
  });
  const receipt = continuationReceipt({
    request,
    adapter,
    mode: 'native-resume',
    consultationId,
    trace,
  });
  // Only a definitive pre-turn rejection may fall back; anything that could
  // have reached the session is reported instead of resubmitted.
  if (
    !envelope.ok &&
    envelope.code === 'PROVIDER_SESSION_NOT_FOUND' &&
    receipt.turn === 'not_started' &&
    fallbackPacket
  ) {
    return runReconstructed(fallbackPacket, 'session_not_found', envelope);
  }

  // A resumed turn that did not report the requested session did not continue
  // it (for example, a provider that silently opens a new thread). Refuse to
  // present that advice as same-session continuation.
  if (
    receipt.turn === 'completed' &&
    receipt.session_id !== requestedSessionId
  ) {
    return {
      ...failureEnvelope({
        provider: request.provider,
        code: 'PROVIDER_SESSION_MISMATCH',
        message: receipt.session_id
          ? `Provider reported session ${receipt.session_id} instead of the requested ${requestedSessionId}; the turn was not a native resume.`
          : `Provider output did not confirm the requested session ${requestedSessionId}.`,
        retryable: false,
        stdout: envelope.stdout,
        stderr: envelope.stderr,
        attempts: {
          cli_attempts: envelope.attempts.cli_attempts,
          terminal_reason: 'provider_session_mismatch',
        },
        diagnostics: envelope.diagnostics,
      }),
      continuation: receipt,
    };
  }
  return { ...envelope, continuation: receipt };
}

// Keeps the rejected resume visible in attempt accounting and diagnostics.
function withRejectedResume(
  envelope: ConsensusCliRunEnvelope,
  rejected: ConsensusCliRunEnvelope,
): ConsensusCliRunEnvelope {
  const note = `Native resume was rejected (${rejected.ok ? 'ok' : rejected.code}) before a turn started; a reconstructed session answered instead.`;
  return {
    ...envelope,
    attempts: {
      ...envelope.attempts,
      cli_attempts:
        envelope.attempts.cli_attempts + rejected.attempts.cli_attempts,
    },
    diagnostics: {
      ...envelope.diagnostics,
      warnings: [...(envelope.diagnostics?.warnings ?? []), note],
    },
  };
}

interface StructuredTurnOptions {
  resumeSessionId?: string;
}

async function runStructuredTurn(
  request: ConsensusCliRunRequest,
  dependencies: RunProviderTurnDependencies,
  trace: ProviderTurnTrace,
  turnOptions: StructuredTurnOptions = {},
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

  const optionValidation = validateProviderOptions(request, adapter);
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

  // Text mode returns the provider's reply as text: it reads no schema,
  // adds nothing to the prompt and validates nothing.
  const textMode = request.output === 'text';
  const schemaPath = request.schema_path;
  if (textMode && schemaPath !== undefined) {
    return preInvocationFailure({
      provider: request.provider,
      code: 'CONSENSUS_CLI_USAGE',
      message: 'Text output does not accept a schema path.',
      terminalReason: 'schema_with_text_output',
    });
  }
  let schema: unknown;
  let inlineJsonSchema: string | undefined;
  if (!textMode) {
    if (!schemaPath) {
      return preInvocationFailure({
        provider: request.provider,
        code: 'CONSENSUS_CLI_USAGE',
        message: 'JSON output requires a schema path.',
        terminalReason: 'schema_missing',
      });
    }
    const readSchema = dependencies.readSchema ?? readJsonSchema;
    try {
      schema = await readSchema(schemaPath);
    } catch (error) {
      return preInvocationFailure({
        provider: request.provider,
        code: 'CONSENSUS_CLI_USAGE',
        message: `Could not read schema: ${error instanceof Error ? error.message : String(error)}`,
        terminalReason: 'schema_read_failed',
      });
    }
    inlineJsonSchema = JSON.stringify(schema);
    if (inlineJsonSchema === undefined) {
      return preInvocationFailure({
        provider: request.provider,
        code: 'CONSENSUS_CLI_USAGE',
        message: 'Schema must be JSON-serializable.',
        terminalReason: 'schema_read_failed',
      });
    }
  }

  const effectiveRequest: ConsensusCliRunRequest = {
    ...request,
    runtime_policy: defaultRuntimePolicy(request.runtime_policy),
  };
  const maxAttempts = effectiveRequest.max_attempts ?? 1;
  // Peers that cannot run a shell command cannot call `consensus submit`, so
  // they answer through the final message instead; the adapter decides which
  // of its profiles can. Text mode has no verdict to submit.
  const submitCaptureEnabled =
    !textMode &&
    (dependencies.transport?.submitCaptureEnabled ?? true) &&
    (adapter.submitCaptureEligible?.(request) ?? true);
  const strategy = selectStructuredOutputStrategy(adapter, {
    output: request.output,
    submitCaptureEnabled,
    strategy: dependencies.transport?.strategy,
  });
  if (
    !adapter.capabilities.schema_strategies.includes(strategy) ||
    (!textMode && strategy === 'text')
  ) {
    return preInvocationFailure({
      provider: request.provider,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      message: `Provider does not support structured-output strategy: ${strategy}.`,
      terminalReason: 'structured_output_strategy',
    });
  }
  const runSubprocess = dependencies.runSubprocess ?? runProviderSubprocess;
  const parentEnv = dependencies.parentEnv ?? process.env;
  const resolvedExecutable = resolveProviderExecutable(adapter, parentEnv);
  if (!resolvedExecutable.ok) {
    return preInvocationFailure({
      provider: request.provider,
      code: 'PROVIDER_MISSING',
      message: resolvedExecutable.message,
      terminalReason: 'provider_executable_invalid',
    });
  }
  // `run` never probes, so a missing or out-of-pin prerequisite is reported
  // here with its install hint instead of surfacing as a spawn failure.
  if (adapter.probe.prerequisites?.length) {
    const prerequisite = await checkProviderPrerequisites(
      adapter,
      dependencies.probeRunner ?? nodeProbeCommandRunner(parentEnv),
    );
    if (prerequisite) {
      return preInvocationFailure({
        provider: request.provider,
        code: PREREQUISITE_FAILURE_CODES[prerequisite.status],
        message: prerequisite.install_hint
          ? `${prerequisite.message} Install hint: ${prerequisite.install_hint}`
          : prerequisite.message,
        terminalReason: `provider_prerequisite_${prerequisite.status}`,
        diagnostics: { warnings: [prerequisite.warning] },
      });
    }
  }
  const submitCapturePath = submitCaptureEnabled
    ? submitCaptureFilePath(effectiveRequest.cwd ?? process.cwd())
    : undefined;
  const maxSubmitBytes = submitCaptureMaxBytes(request.max_output_bytes);
  const submitCommand = submitCaptureEnabled
    ? (dependencies.submitCommand ?? buildConsensusSubmitCommand())
    : undefined;
  const childEnv = buildChildEnvironment({
    parentEnv,
    request: effectiveRequest,
    credentialEnv: adapter.credential_env,
    executableOverrideEnv: providerExecutableEnvNames(registry),
    hostEnv: {
      ...hostGuard.child_env,
      ...(submitCaptureEnabled &&
      submitCommand &&
      submitCapturePath &&
      schemaPath
        ? {
            CONSENSUS_SUBMIT_COMMAND: submitCommand,
            CONSENSUS_SUBMIT_FILE: submitCapturePath,
            [CONSENSUS_SUBMIT_MAX_BYTES_ENV]: String(maxSubmitBytes),
            CONSENSUS_SUBMIT_SCHEMA: path.resolve(schemaPath),
          }
        : {}),
    },
  });
  let validationFeedback: string | undefined;
  let lastInvocation: ProviderInvocation | undefined;
  let exitClassification: ProviderDiagnostics['exit_classification'];

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (submitCapturePath) {
        await cleanupSubmitCaptureFile(submitCapturePath);
      }
      const invocationRequest = {
        ...effectiveRequest,
        prompt:
          textMode || inlineJsonSchema === undefined
            ? request.prompt
            : promptForStrategy({
                prompt: request.prompt,
                strategy,
                inlineJsonSchema,
                submitCaptureEnabled,
                submitCommand,
                validationFeedback,
              }),
      };
      const invocation = buildProviderInvocation(adapter, invocationRequest, {
        strategy,
        inlineJsonSchema,
        lastMessageFile: dependencies.transport?.lastMessageFile,
        preserveLastMessageFile:
          dependencies.transport?.preserveLastMessageFile,
        resumeSessionId: turnOptions.resumeSessionId,
        executable: resolvedExecutable.executable,
      });
      lastInvocation = invocation;
      const processResult = await runSubprocess(invocation, {
        env: childEnv,
        maxOutputBytes: request.max_output_bytes,
        timeoutSec: request.max_runtime_sec,
      });
      trace.process = processResult;
      trace.failure_code = undefined;
      trace.turn = undefined;
      const diagnostics = mergeDiagnostics(
        {
          strategy_used: strategy,
          output_mode: invocation.output_mode,
          redacted_command: invocation.redacted_command,
          ...(invocation.permission_profile
            ? { permission_profile: invocation.permission_profile }
            : {}),
        },
        hostGuard.diagnostics,
        processResult.diagnostics,
        permissionDenialDiagnostics(adapter, processResult.stdout),
        exitClassificationDiagnostics(exitClassification),
      );

      const reportedFailure =
        processResult.ok ||
        (processResult.code === 'PROVIDER_EXIT' &&
          !processResult.signal &&
          !processResult.diagnostics?.termination)
          ? adapter.classifyReportedFailure?.(processResult.stdout)
          : undefined;
      if (!processResult.ok || reportedFailure) {
        const classification = processResult.ok
          ? reportedFailure!
          : (reportedFailure ?? adapter.classifyRunFailure(processResult));
        // A last-attempt rejection cannot erase earlier potentially executed
        // attempts. Exhaustion is terminal even on read-only profiles.
        trace.turn = classification.turn
          ? attempt === 1
            ? classification.turn
            : 'unknown'
          : undefined;
        trace.failure_code = classification.code;
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

      if (textMode) {
        // Extraction failures are terminal: a reply that arrived but cannot
        // be read is not a transient process failure, so it is not retried.
        const extracted = (adapter.extractText ?? extractProviderResultText)(
          invocation,
          processResult,
        );
        if (!extracted.ok) {
          return failureEnvelope({
            provider: request.provider,
            code: extracted.code,
            message: extracted.message,
            retryable: false,
            stdout: processResult.stdout,
            stderr: processResult.stderr,
            attempts: {
              cli_attempts: attempt,
              terminal_reason: extracted.terminal_reason,
            },
            diagnostics,
          });
        }
        return textSuccessEnvelope({
          provider: request.provider,
          args: invocation.redacted_command,
          stdout: extracted.raw,
          stderr: processResult.stderr,
          text: extracted.text,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: 'success',
          },
          diagnostics,
        });
      }

      const submittedVerdict = submitCapturePath
        ? await readSubmittedVerdict(submitCapturePath, schema, maxSubmitBytes)
        : ({ ok: false } as const);
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

      const verdictJson = (
        adapter.extractStructuredValue ?? extractStructuredJsonValue
      )(parsed.value);
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
    if (submitCapturePath) {
      await cleanupSubmitCaptureFile(submitCapturePath);
    }
  }
}

function permissionDenialDiagnostics(
  adapter: ProviderAdapter,
  stdout: string,
): ProviderDiagnostics | undefined {
  const denials = adapter.extractPermissionDenials?.(stdout);
  if (!denials) return undefined;
  return {
    permission_denials: denials,
    warnings: [
      `${adapter.display_name} reported ${denials.count} denied tool call(s); verify task completeness independently of schema and transport success.`,
    ],
  };
}

async function readJsonSchema(schemaPath: string): Promise<unknown> {
  return JSON.parse(await readFile(schemaPath, 'utf8'));
}

const PREREQUISITE_FAILURE_CODES = {
  missing: 'PROVIDER_MISSING',
  unsupported: 'PROVIDER_UNSUPPORTED',
  unavailable: 'PROVIDER_UNAVAILABLE',
} as const satisfies Record<string, ProviderErrorCode>;

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
  maxBytes: number,
): Promise<SubmittedVerdictResult> {
  const capture = await readBoundedRegularFile(filePath, maxBytes);
  if (!capture.ok) return { ok: false };
  const raw = capture.contents;
  try {
    assertWithinSubmitCaptureLimit(raw, maxBytes);
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
    const submitCommand = input.submitCommand ?? buildConsensusSubmitCommand();
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

export function buildConsensusSubmitCommand(
  input: {
    nodePath?: string;
    cliPath?: string;
  } = {},
) {
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
