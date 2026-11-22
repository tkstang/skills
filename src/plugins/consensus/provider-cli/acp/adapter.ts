// acpAdapter(descriptor): one ProviderAdapter for every extended (ACP)
// provider. buildInvocation turns the request into launch argv plus a session
// plan; the run hook drives the session through the ACP transport and returns
// a ProviderProcessResult whose stdout is the serialized, sanitized
// AcpTurnResult. The other hooks parse that result back.
//
// Extended adapters run read-only only, return text only, take a model and
// no effort, have no continuation, and never offer submit capture.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {
  ProviderAdapter,
  ProviderRunFailureClassification,
  ProviderSessionObservation,
} from '../adapters.js';
import type {
  BuildProviderInvocationOptions,
  ProviderInvocation,
} from '../invocation.js';
import type { ProviderTextExtraction } from '../provider-output.js';
import { DEFAULT_TIMEOUT_SEC } from '../subprocess.js';
import type {
  ProviderProcessResult,
  RunProviderSubprocessOptions,
} from '../subprocess.js';
import type {
  ConsensusCliRunRequest,
  ProviderAcpDiagnostics,
  ProviderDiagnostics,
  ProviderPermissionDenials,
  ProviderTermination,
} from '../types.js';
import type {
  AcpRunOutcome,
  AcpSessionPlan,
  AcpTiming,
  AcpTransport,
} from './client.js';
import { stdioAcpTransport } from './client.js';
import type { AcpModelSource, AcpProviderDescriptor } from './descriptors.js';
import type { SpawnProcessGroup } from './process.js';
import type {
  AcpClassifyOptions,
  AcpTurnClassification,
  AcpTurnResult,
} from './transcript.js';
import {
  classifyAcpTurn,
  parseAcpTurnResult,
  serializeAcpTurnResult,
} from './transcript.js';

// Placed before every extended read-only prompt.
export const ACP_READ_ONLY_BRIEF_LINE =
  'This is a read-only run. Use only read and search tools. Do not edit files or run shell commands; such requests are denied and end the turn.';

export const ACP_CLIENT_INFO = { name: 'consensus', version: '0' } as const;

export interface AcpAdapterOptions {
  transport?: AcpTransport;
  // The spawn-group primitive the stdio transport uses; tests substitute one
  // that launches the fake agent.
  spawn?: SpawnProcessGroup;
  timing?: Partial<AcpTiming>;
  // Parent of the private settings directory for API-key runs.
  tmpDir?: string;
}

export function acpAdapter(
  descriptor: AcpProviderDescriptor,
  options: AcpAdapterOptions = {},
): ProviderAdapter {
  const transport = options.transport ?? stdioAcpTransport;
  const classifyOptions: AcpClassifyOptions = {
    displayName: descriptor.display_name,
    authHint: descriptor.auth_hint,
    ...(descriptor.auth_error_patterns
      ? { authErrorPatterns: descriptor.auth_error_patterns }
      : {}),
    ...(descriptor.error_text_patterns
      ? { errorTextPatterns: descriptor.error_text_patterns }
      : {}),
  };
  const classify = (stdout: string) => {
    const result = parseAcpTurnResult(stdout);
    return result ? classifyAcpTurn(result, classifyOptions) : undefined;
  };

  return {
    id: descriptor.id,
    tier: 'extended',
    display_name: descriptor.display_name,
    executable: descriptor.executable,
    executable_env: descriptor.executable_env,
    credential_env: descriptor.credential_env,
    install_hint: descriptor.install_hint,
    ...(descriptor.not_admitted_reason
      ? { not_admitted_reason: descriptor.not_admitted_reason }
      : {}),
    probe: {
      version_args: ['--version'],
      minimum_version: descriptor.minimum_version,
      // Establishing the run capability needs an ACP handshake, which
      // preflight never performs (Droid mints a pairing code on
      // session/new), so the version output stands in for it.
      capabilities: {
        run: { args: ['--version'], required_output_patterns: [] },
      },
      ...(descriptor.redactions
        ? { output_redactions: descriptor.redactions }
        : {}),
    },
    buildInvocation: (request, invocationOptions) =>
      buildAcpInvocation(descriptor, request, invocationOptions),
    run: (invocation, runOptions) =>
      runAcpInvocation(descriptor, invocation, runOptions, {
        transport,
        classifyOptions,
        ...options,
      }),
    classifyRunFailure: (failure) =>
      failureClassification(classify(failure.stdout)) ?? {
        code: failure.code,
        message: failure.message,
        retryable: false,
        terminal_reason: 'acp_unreadable_result',
        exit_classification: 'terminal',
      },
    classifyReportedFailure: (stdout) =>
      failureClassification(classify(stdout)),
    extractText: (_invocation, result) => extractAcpText(result.stdout),
    // Never the serialized turn result: only its (redacted) answer text.
    envelopeStdout: (stdout) => parseAcpTurnResult(stdout)?.text ?? '',
    extractSession: (stdout) => extractAcpSession(stdout, descriptor),
    extractPermissionDenials: extractAcpPermissionDenials,
    submitCaptureEligible: () => false,
    capabilities: {
      schema_strategies: ['text'],
      output_modes: ['acp_session'],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          permission_modes: ['read-only'],
          env_allowlist: false,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  };
}

function buildAcpInvocation(
  descriptor: AcpProviderDescriptor,
  request: ConsensusCliRunRequest,
  options: BuildProviderInvocationOptions = {},
): ProviderInvocation {
  const executable = options.executable ?? descriptor.executable;
  const model = request.model;
  const argv = [
    ...descriptor.launch_args,
    ...(model && descriptor.model.kind === 'launch_flag'
      ? [descriptor.model.flag, model]
      : []),
  ];
  const plan: AcpSessionPlan = {
    clientInfo: { ...ACP_CLIENT_INFO },
    mode: descriptor.mode,
    ...(model && descriptor.model.kind === 'config_option'
      ? {
          configOptions: [
            {
              configId: descriptor.model.config_id,
              value: model,
              requireAdvertised: true,
            },
          ],
        }
      : {}),
    ...(model && descriptor.model.kind === 'launch_flag'
      ? { expectCurrentModel: model }
      : {}),
    briefLines: [ACP_READ_ONLY_BRIEF_LINE, ...(descriptor.brief_lines ?? [])],
    ...(descriptor.redactions ? { redactions: descriptor.redactions } : {}),
    credentialEnv: descriptor.credential_env,
  };
  return {
    executable,
    argv,
    stdin: request.prompt,
    ...(request.cwd ? { cwd: request.cwd } : {}),
    output_mode: 'acp_session',
    strategy: 'text',
    redacted_command: [executable, ...argv],
    acp_plan: plan,
    shell: false,
  };
}

interface RunContext extends AcpAdapterOptions {
  transport: AcpTransport;
  classifyOptions: AcpClassifyOptions;
}

async function runAcpInvocation(
  descriptor: AcpProviderDescriptor,
  invocation: ProviderInvocation,
  options: RunProviderSubprocessOptions,
  context: RunContext,
): Promise<ProviderProcessResult> {
  const basePlan = invocation.acp_plan;
  if (!basePlan) {
    throw new Error(`${descriptor.id} invocation has no ACP session plan.`);
  }
  const env = options.env ?? {};
  const apiKey = descriptor.api_key;
  const useApiKey = apiKey !== undefined && (env[apiKey.env] ?? '') !== '';
  const plan: AcpSessionPlan = useApiKey
    ? { ...basePlan, authenticate: { methodId: apiKey.method_id } }
    : basePlan;
  const argv = [...invocation.argv];
  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

  let privateHome: string | undefined;
  let outcome: AcpRunOutcome;
  try {
    const home = useApiKey ? apiKey.private_home : undefined;
    if (home) {
      // mkdtemp creates the directory with mode 0700.
      privateHome = await mkdtemp(
        path.join(context.tmpDir ?? os.tmpdir(), `consensus-${descriptor.id}-`),
      );
      const settings = `${JSON.stringify(home.settings)}\n`;
      for (const file of home.settings_files) {
        const target = path.join(privateHome, file);
        await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
        await writeFile(target, settings, { mode: 0o600 });
      }
      argv.push(
        `${home.dir_flag}=${privateHome}`,
        `${home.app_data_flag}=${home.app_data_name}`,
      );
    }
    outcome = await context.transport.run({
      executable: invocation.executable,
      argv,
      cwd: invocation.cwd ?? process.cwd(),
      env,
      prompt: invocation.stdin,
      plan,
      timeoutMs: timeoutSec * 1000,
      ...(options.maxOutputBytes !== undefined
        ? { maxOutputBytes: options.maxOutputBytes }
        : {}),
      ...(context.timing ? { timing: context.timing } : {}),
      ...(context.spawn ? { spawn: context.spawn } : {}),
    });
  } finally {
    if (privateHome) await rm(privateHome, { recursive: true, force: true });
  }

  const result = outcome.result;
  const classification = classifyAcpTurn(result, context.classifyOptions);
  const stdout = serializeAcpTurnResult(result);
  const diagnostics = processDiagnostics(outcome, {
    auth: useApiKey ? 'api_key' : 'existing_login',
    timeoutSec,
  });
  const base = {
    stdout,
    stderr: outcome.stderr,
    exit_code: outcome.exit_code,
    signal: outcome.signal,
    diagnostics,
  };
  if (classification.ok) return { ok: true, ...base };
  return {
    ok: false,
    code: processFailureCode(result),
    message: classification.message,
    retryable: false,
    ...base,
  };
}

// The transport-level code; classifyRunFailure and classifyReportedFailure
// then report the turn's own classification.
function processFailureCode(
  result: AcpTurnResult,
): Extract<ProviderProcessResult, { ok: false }>['code'] {
  if (result.abort === 'timeout') return 'PROVIDER_TIMEOUT';
  if (result.abort === 'output_cap') return 'PROVIDER_OUTPUT_CAP_EXCEEDED';
  if (result.error?.kind === 'spawn') {
    return result.error.errno === 'E2BIG'
      ? 'PROVIDER_ARGV_TOO_LARGE'
      : 'PROVIDER_MISSING';
  }
  return 'PROVIDER_EXIT';
}

function processDiagnostics(
  outcome: AcpRunOutcome,
  input: { auth: ProviderAcpDiagnostics['auth']; timeoutSec: number },
): ProviderDiagnostics {
  const result = outcome.result;
  const teardown = outcome.teardown;
  const acp: ProviderAcpDiagnostics = {
    ...(result.agent ? { agent: result.agent } : {}),
    auth: input.auth,
    phase: result.phase,
    ...(result.stop_reason ? { stop_reason: result.stop_reason } : {}),
    setup: result.setup.map((step) => ({ ...step })),
    ...(result.refused_methods.length > 0
      ? { refused_methods: [...result.refused_methods] }
      : {}),
    ...(result.cancel_sent ? { cancel_sent: true } : {}),
    ...(result.session_closed !== undefined
      ? { session_closed: result.session_closed }
      : {}),
    ...(teardown
      ? {
          teardown: {
            scope: teardown.scope,
            exited_before_signal: teardown.exited_before_signal,
            signals: [...teardown.signals],
            settled_by: teardown.settled_by,
          },
        }
      : {}),
  };
  const termination =
    result.abort && result.abort !== 'mode_changed' && teardown
      ? terminationFor(result.abort, teardown)
      : undefined;
  return {
    provider_exit_code: outcome.exit_code,
    provider_signal: outcome.signal,
    output_bytes: { ...outcome.output_bytes },
    timeout_sec: input.timeoutSec,
    ...(termination ? { termination } : {}),
    acp,
  };
}

function terminationFor(
  reason: ProviderTermination['reason'],
  teardown: NonNullable<AcpRunOutcome['teardown']>,
): ProviderTermination {
  const settled = teardown.settled_by;
  return {
    reason,
    scope: teardown.scope,
    signals: [...teardown.signals],
    settled_by:
      settled === 'first_signal'
        ? teardown.signals[0] === 'SIGTERM'
          ? 'sigterm'
          : 'forwarded_signal'
        : settled,
  };
}

function failureClassification(
  classification: AcpTurnClassification | undefined,
): ProviderRunFailureClassification | undefined {
  if (!classification || classification.ok) return undefined;
  return {
    code: classification.code,
    message: classification.message,
    retryable: false,
    terminal_reason: classification.terminal_reason,
    exit_classification: 'terminal',
    turn: classification.turn,
  };
}

// The envelope's stdout is the answer text: the serialized result stays
// internal to the hooks.
function extractAcpText(stdout: string): ProviderTextExtraction {
  const result = parseAcpTurnResult(stdout);
  if (!result) {
    return {
      ok: false,
      code: 'PROVIDER_MALFORMED_RESULT',
      message: 'The ACP adapter returned no readable turn result.',
      terminal_reason: 'malformed_result',
    };
  }
  if (result.text.trim() === '') {
    return {
      ok: false,
      code: 'PROVIDER_EMPTY_OUTPUT',
      message: 'The ACP agent ended the turn without answer text.',
      terminal_reason: 'empty_output',
    };
  }
  return { ok: true, raw: result.text, text: result.text };
}

function extractAcpSession(
  stdout: string,
  descriptor: AcpProviderDescriptor,
): ProviderSessionObservation {
  const result = parseAcpTurnResult(stdout);
  if (!result) return {};
  const models = firstModels(result, descriptor.model_sources);
  return {
    ...(result.session_id ? { session_id: result.session_id } : {}),
    ...(models.length > 0 ? { observed_models: models } : {}),
  };
}

function firstModels(
  result: AcpTurnResult,
  sources: readonly AcpModelSource[],
): string[] {
  for (const source of sources) {
    const value = result.models[source];
    const models = Array.isArray(value) ? value : value ? [value] : [];
    if (models.length > 0) return models;
  }
  return [];
}

function extractAcpPermissionDenials(
  stdout: string,
): ProviderPermissionDenials | undefined {
  const result = parseAcpTurnResult(stdout);
  if (!result || result.denials.length === 0) return undefined;
  return {
    count: result.denials.length,
    tools: [
      ...new Set(
        result.denials.map((denial) => denial.tool ?? denial.kind ?? 'tool'),
      ),
    ],
    requests: result.denials.map((denial) => ({
      ...(denial.tool !== undefined ? { tool: denial.tool } : {}),
      ...(denial.kind !== undefined ? { kind: denial.kind } : {}),
      ...(denial.path !== undefined ? { path: denial.path } : {}),
    })),
  };
}
