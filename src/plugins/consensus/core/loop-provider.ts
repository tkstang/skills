import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ConsensusCliRunEnvelope,
  ConsensusCliRunFailure,
  ProviderErrorCode,
} from '../provider-cli/types.js';
import type {
  ConsensusCliPathOptions,
  ConsensusCliResolution,
  IterationMode,
  LoopRecord,
  PeerInvocation,
  ProviderCliCommandRunnerOptions,
  ProviderCliCommandRunnerResult,
  ProviderInvocationArgs,
  ProviderResult,
  RetryOptions,
} from './loop-types.js';
import {
  asErrorLike,
  ConsensusError,
  EXIT_CODES,
  hardErrorMessage,
  isJsonRecord,
  normalizeVerdict,
  PROVIDER_CLI_FINAL_RESOLUTION_MS,
  PROVIDER_CLI_KILL_GRACE_MS,
  SUBPROCESS_OUTPUT_CAP_BYTES,
  validateVerdictCaps,
  validateVerdictShape,
  validationErrors,
  validationMetadata,
} from './loop-validation.js';

function outputCapError(streamName: 'stdout' | 'stderr', capBytes: number) {
  return new ConsensusError(
    `${streamName} exceeded subprocess output cap (${capBytes} bytes)`,
    {
      code: 'SUBPROCESS_OUTPUT_CAP',
      exitCode: EXIT_CODES.CONFIG,
      details: { stream: streamName, cap_bytes: capBytes },
    },
  );
}

export const CONSENSUS_SHARED_CLI_RELATIVE_PATH = path.join(
  '.consensus',
  'consensus.mjs',
);

export function consensusSharedCliPath(homeDir = os.homedir()) {
  return path.join(homeDir, CONSENSUS_SHARED_CLI_RELATIVE_PATH);
}

function defaultConsensusCliPath() {
  return fileURLToPath(new URL('./consensus.mjs', import.meta.url));
}

export function resolveConsensusCliPathDetails({
  consensusCliPath,
  env = process.env,
  defaultCliPath = defaultConsensusCliPath(),
}: ConsensusCliPathOptions = {}): ConsensusCliResolution {
  if (consensusCliPath) {
    return { status: 'resolved', source: 'explicit', path: consensusCliPath };
  }

  if (env.CONSENSUS_CLI_PATH) {
    return {
      status: 'resolved',
      source: 'env',
      path: env.CONSENSUS_CLI_PATH,
    };
  }

  const sharedCliPath = consensusSharedCliPath(env.HOME || os.homedir());
  const attemptedPaths = [defaultCliPath, sharedCliPath];

  if (existsSync(defaultCliPath)) {
    return { status: 'resolved', source: 'plugin', path: defaultCliPath };
  }

  if (existsSync(sharedCliPath)) {
    return { status: 'resolved', source: 'shared-home', path: sharedCliPath };
  }

  return { status: 'missing', attemptedPaths };
}

export function resolveConsensusCliPath(
  options: ConsensusCliPathOptions = {},
): string {
  const resolution = resolveConsensusCliPathDetails(options);
  if (resolution.status === 'resolved') return resolution.path;
  return resolution.attemptedPaths[0];
}

export function consensusProviderCliMissingError({
  attemptedPaths,
  cause,
}: {
  attemptedPaths: readonly string[];
  cause?: unknown;
}) {
  return new ConsensusError(
    'Consensus provider CLI is missing. Install the consensus plugin, or run the pinned install.sh installer from the README alternative-install section to provision ~/.consensus/consensus.mjs.',
    {
      code: 'CONSENSUS_PROVIDER_CLI_MISSING',
      exitCode: EXIT_CODES.CONFIG,
      cause,
      details: { attemptedPaths: [...new Set(attemptedPaths)] },
    },
  );
}

export function requireConsensusCliPath(
  options: ConsensusCliPathOptions = {},
): string {
  const resolution = resolveConsensusCliPathDetails(options);
  if (resolution.status === 'resolved') return resolution.path;
  throw consensusProviderCliMissingError({
    attemptedPaths: resolution.attemptedPaths,
  });
}

export function providerCliSpawnTarget(command: string, args: string[]) {
  if (path.extname(command) === '.mjs') {
    return { command: process.execPath, args: [command, ...args] };
  }
  return { command, args };
}

// Twin: src/consensus/panel/consensus-panel.ts has an independently
// maintained copy of this function. Keep both in sync — subprocess-runner
// unification is explicitly deferred, out of scope for both the subprocess
// hardening and cli-helper consolidation plans.
export function runProviderCliCommand(
  command: string,
  args: string[],
  options: ProviderCliCommandRunnerOptions = {},
): Promise<ProviderCliCommandRunnerResult> {
  if (path.extname(command) === '.mjs' && !existsSync(command)) {
    return Promise.reject(
      consensusProviderCliMissingError({
        attemptedPaths: [
          command,
          consensusSharedCliPath(options.env?.HOME || os.homedir()),
        ],
      }),
    );
  }

  return new Promise((resolve, reject) => {
    const spawnTarget = providerCliSpawnTarget(command, args);
    const child = spawn(spawnTarget.command, spawnTarget.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let capError: ConsensusError | null = null;
    let timedOut = false;
    let settled = false;
    let deadlineTimer: NodeJS.Timeout | undefined;
    let killEscalationTimer: NodeJS.Timeout | undefined;
    let finalResolutionTimer: NodeJS.Timeout | undefined;

    function clearDeadlineTimers() {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      if (killEscalationTimer) clearTimeout(killEscalationTimer);
      if (finalResolutionTimer) clearTimeout(finalResolutionTimer);
    }

    function settleResolve(value: ProviderCliCommandRunnerResult) {
      if (settled) return;
      settled = true;
      clearDeadlineTimers();
      resolve(value);
    }

    function settleReject(error: unknown) {
      if (settled) return;
      settled = true;
      clearDeadlineTimers();
      reject(error);
    }

    // Safety net for a killed child whose stdio pipes were inherited by a
    // descendant (e.g. a provider CLI that backgrounds a helper process): the
    // pipes' write ends can stay open after the child dies, so 'close' never
    // fires. Force settlement instead of hanging forever, mirroring
    // subprocess.ts's finalResolutionMs. Shared by BOTH kill paths — the
    // optional-timeout escalation and the output-cap breach below — so a cap
    // kill is bounded even when no timeoutMs deadline is configured.
    // Idempotent: the first scheduler wins; a second caller (e.g. a timeout
    // firing after a cap kill already scheduled this) is a no-op.
    function scheduleFinalResolution() {
      if (finalResolutionTimer || settled) return;
      finalResolutionTimer = setTimeout(() => {
        // Destroy our own stdio handles so a held-open pipe (from a surviving
        // descendant) can't keep this process's event loop alive after we've
        // given up waiting on 'close'. stdin included: it was only .end()ed,
        // not destroyed, and an unacknowledged write can leave it as an active
        // handle too.
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
        // A capture-cap breach (see `capture` below) is a more specific,
        // earlier-determined failure than a bare timeout — preserve it
        // (SUBPROCESS_OUTPUT_CAP must win) instead of overwriting it with a
        // generic timedOut result.
        if (capError) {
          settleReject(capError);
          return;
        }
        settleResolve({
          code: null,
          signal: 'SIGKILL',
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          timedOut: true,
        });
      }, PROVIDER_CLI_FINAL_RESOLUTION_MS);
    }

    if (options.timeoutMs !== undefined) {
      deadlineTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        killEscalationTimer = setTimeout(() => {
          child.kill('SIGKILL');
          scheduleFinalResolution();
        }, PROVIDER_CLI_KILL_GRACE_MS);
      }, options.timeoutMs);
    }

    function capture(
      streamName: 'stdout' | 'stderr',
      chunks: Buffer[],
      chunk: Buffer,
    ) {
      if (capError) return;

      const nextBytes =
        streamName === 'stdout'
          ? stdoutBytes + chunk.length
          : stderrBytes + chunk.length;
      if (nextBytes > SUBPROCESS_OUTPUT_CAP_BYTES) {
        capError = outputCapError(streamName, SUBPROCESS_OUTPUT_CAP_BYTES);
        child.kill('SIGKILL');
        // If a descendant inherited our stdio pipes, this kill may not make
        // 'close' fire, so schedule forced settlement to bound the cap
        // rejection regardless of whether a timeoutMs deadline was set.
        scheduleFinalResolution();
        return;
      }

      chunks.push(chunk);
      if (streamName === 'stdout') {
        stdoutBytes = nextBytes;
      } else {
        stderrBytes = nextBytes;
      }
    }

    child.stdout.on('data', (chunk: Buffer) =>
      capture('stdout', stdoutChunks, chunk),
    );
    child.stderr.on('data', (chunk: Buffer) =>
      capture('stderr', stderrChunks, chunk),
    );
    child.on('error', (error) => {
      settleReject(error);
    });
    child.on('close', (code, signal) => {
      if (capError) {
        settleReject(capError);
        return;
      }
      settleResolve({
        code,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        ...(timedOut ? { timedOut: true } : {}),
      });
    });

    child.stdin.on('error', () => {});
    child.stdin.end(options.input ?? '');
  });
}

export async function invokeConsensusProviderCli({
  provider,
  schemaPath,
  prompt,
  env = process.env,
  cwd = process.cwd(),
  consensusCliPath,
  runCommand = runProviderCliCommand,
}: ProviderInvocationArgs): Promise<ProviderResult> {
  const command =
    runCommand === runProviderCliCommand
      ? requireConsensusCliPath({ consensusCliPath, env })
      : resolveConsensusCliPath({ consensusCliPath, env });
  const request = {
    schema_version: 'v1',
    provider,
    schema_path: schemaPath,
    prompt,
    cwd,
  };
  const result = await runCommand(
    command,
    ['run', '--request-json', '-', '--json'],
    {
      env,
      cwd,
      input: JSON.stringify(request),
    },
  );
  const envelope = parseConsensusCliRunEnvelope(result);

  if (!envelope.ok) {
    throw providerCliEnvelopeError(envelope);
  }

  return {
    provider: envelope.provider,
    args: envelope.args,
    stdout: envelope.stdout,
    stderr: envelope.stderr,
    json: envelope.json,
    raw_provider_response: envelope.stdout ?? JSON.stringify(envelope.json),
    provider_diagnostics: envelope.diagnostics,
    attempts: envelope.attempts,
  };
}

export async function invokeProviderCliWithRetry(
  args: ProviderInvocationArgs,
  {
    attempts = 3,
    delayMs = 750,
    sleep,
    invoke = invokeConsensusProviderCli,
    mode = 'alternating',
  }: RetryOptions = {},
): Promise<ProviderResult> {
  const wait =
    sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await invoke(args);
      const verdictError = peerVerdictError(
        normalizeVerdict(result.json, mode),
        mode,
      );
      if (verdictError) throw verdictError;
      return result;
    } catch (error) {
      lastError = error;
      const retryable =
        asErrorLike(error).code === 'INVALID_VERDICT_SHAPE' ||
        asErrorLike(error).code === 'INVALID_VERDICT_CAPS';
      if (!retryable || attempt === attempts) throw error;
      await wait(delayMs);
    }
  }

  throw lastError;
}

function parseConsensusCliRunEnvelope(
  result: ProviderCliCommandRunnerResult,
): ConsensusCliRunEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new ConsensusError(
      `consensus provider CLI returned invalid JSON: ${hardErrorMessage(error)}`,
      {
        code:
          result.code && result.code !== 0
            ? 'CONSENSUS_CLI_USAGE'
            : 'PROVIDER_INVALID_JSON',
        exitCode:
          result.code && result.code !== 0 ? EXIT_CODES.USAGE : EXIT_CODES.DATA,
        cause: error,
        details: {
          exit_code: result.code,
          signal: result.signal ?? null,
          stdout: result.stdout,
          stderr: result.stderr ?? '',
        },
      },
    );
  }

  if (!isConsensusCliRunEnvelope(parsed)) {
    throw new ConsensusError(
      'consensus provider CLI returned an invalid envelope',
      {
        code: 'PROVIDER_INVALID_JSON',
        exitCode: EXIT_CODES.DATA,
        details: {
          exit_code: result.code,
          signal: result.signal ?? null,
          stdout: result.stdout,
          stderr: result.stderr ?? '',
        },
      },
    );
  }

  return parsed;
}

function isConsensusCliRunEnvelope(
  value: unknown,
): value is ConsensusCliRunEnvelope {
  if (!isJsonRecord(value)) return false;
  return value.schema_version === 'v1' && typeof value.ok === 'boolean';
}

function providerCliEnvelopeError(envelope: ConsensusCliRunFailure) {
  return new ConsensusError(envelope.message, {
    code: envelope.code,
    exitCode: exitCodeForProviderError(envelope.code),
    details: {
      provider: envelope.provider ?? null,
      retryable: envelope.retryable,
      attempts: envelope.attempts,
      diagnostics: envelope.diagnostics,
      stdout: envelope.stdout,
      stderr: envelope.stderr,
    },
  });
}

function exitCodeForProviderError(code: ProviderErrorCode) {
  if (code === 'CONSENSUS_CLI_USAGE') return EXIT_CODES.USAGE;
  if (
    code === 'PROVIDER_INVALID_JSON' ||
    code === 'PROVIDER_SCHEMA_VALIDATION'
  ) {
    return EXIT_CODES.DATA;
  }
  return EXIT_CODES.CONFIG;
}

function peerVerdictError(
  verdict: unknown,
  mode: IterationMode,
): ConsensusError | null {
  const shape = validateVerdictShape(verdict, { mode });
  if (!shape.ok) {
    return new ConsensusError(
      `invalid verdict shape: ${validationErrors(shape).join('; ')}`,
      {
        code: 'INVALID_VERDICT_SHAPE',
        exitCode: EXIT_CODES.DATA,
        details: { errors: validationErrors(shape) },
      },
    );
  }
  const caps = validateVerdictCaps(verdict, { mode });
  if (!caps.ok) {
    return new ConsensusError(
      `invalid verdict caps: ${JSON.stringify(validationMetadata(caps))}`,
      {
        code: 'INVALID_VERDICT_CAPS',
        exitCode: EXIT_CODES.DATA,
        details: validationMetadata(caps),
      },
    );
  }
  return null;
}

export function providerAuditFields(result: ProviderResult): Partial<LoopRecord> {
  const rawResponse =
    result.raw_provider_response ??
    result.stdout ??
    JSON.stringify(result.json);

  return {
    raw_provider_response: rawResponse,
    ...(result.provider_diagnostics
      ? { provider_diagnostics: result.provider_diagnostics }
      : {}),
    ...(result.attempts ? { attempts: result.attempts } : {}),
  };
}

/**
 * Invoke a peer and re-invoke when the returned verdict fails our validation
 * after normalization. The provider CLI schema can express only part of the
 * contract, so a model can return a schema-valid-but-contract-invalid verdict.
 * Treat those as retryable here so a single non-compliant generation does not
 * hard-fail the section. Injected test stubs keep their exact call counts.
 */
export async function invokeValidatedPeer({
  mode,
  attempts = 3,
  delayMs = 750,
  sleep,
  invoke = invokeConsensusProviderCli,
  ...args
}: Partial<PeerInvocation> &
  RetryOptions & { mode?: IterationMode } = {}): Promise<ProviderResult> {
  const wait =
    sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await invoke(args as ProviderInvocationArgs);
      const verdictError = peerVerdictError(
        normalizeVerdict(result.json, mode ?? 'alternating'),
        mode ?? 'alternating',
      );
      if (verdictError) throw verdictError;
      return result;
    } catch (error) {
      lastError = error;
      const retryable =
        asErrorLike(error).code === 'INVALID_VERDICT_SHAPE' ||
        asErrorLike(error).code === 'INVALID_VERDICT_CAPS';
      if (!retryable || attempt === attempts) throw error;
      await wait(delayMs);
    }
  }
  throw lastError;
}
