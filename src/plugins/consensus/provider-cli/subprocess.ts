import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { open, rm } from 'node:fs/promises';

import type { ProviderInvocation } from './invocation.js';
import type {
  ProviderDiagnostics,
  ProviderErrorCode,
  ProviderTermination,
} from './types.js';

export interface RunProviderSubprocessOptions {
  env?: NodeJS.ProcessEnv;
  maxOutputBytes?: number;
  timeoutSec?: number;
  terminationGraceMs?: number;
  finalResolutionMs?: number;
}

export type ProviderProcessResult =
  | ProviderProcessSuccess
  | ProviderProcessFailure;

export interface ProviderProcessSuccess {
  ok: true;
  stdout: string;
  stderr: string;
  last_message?: string;
  exit_code: number | null;
  signal: string | null;
  diagnostics: ProviderDiagnostics;
}

export interface ProviderProcessFailure {
  ok: false;
  code: Extract<
    ProviderErrorCode,
    | 'PROVIDER_MISSING'
    | 'PROVIDER_EXIT'
    | 'PROVIDER_TIMEOUT'
    | 'PROVIDER_OUTPUT_CAP_EXCEEDED'
    | 'PROVIDER_ARGV_TOO_LARGE'
  >;
  message: string;
  retryable: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  signal: string | null;
  diagnostics: ProviderDiagnostics;
}

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024 * 10;
const DEFAULT_TIMEOUT_SEC = 300;
const DEFAULT_TERMINATION_GRACE_MS = 250;
const DEFAULT_FINAL_RESOLUTION_MS = 1000;
const USE_PROCESS_GROUP = process.platform !== 'win32';
const ARGV_TOO_LARGE_MESSAGE =
  'Provider arguments or environment exceeded the operating-system limit (E2BIG). Reduce the environment or argument sizes, such as the inline JSON schema.';

export function isReliableExternalInterrupt(input: {
  code: ProviderErrorCode;
  exit_code: number | null;
  signal: string | null;
}) {
  return (
    input.code === 'PROVIDER_EXIT' &&
    input.signal !== null &&
    input.exit_code === null
  );
}

export function runProviderSubprocess(
  invocation: ProviderInvocation,
  options: RunProviderSubprocessOptions = {},
): Promise<ProviderProcessResult> {
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const terminationGraceMs =
    options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
  const finalResolutionMs =
    options.finalResolutionMs ?? DEFAULT_FINAL_RESOLUTION_MS;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputCaptureClosed = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let settled = false;
    let terminal: 'timeout' | 'output_cap' | 'spawn_error' | undefined;
    let termination: ProviderTermination | undefined;
    let leaderClosed = false;

    let child: ChildProcessWithoutNullStreams;
    try {
      // POSIX: the provider leads its own process group, so a timeout or
      // output cap can signal every process it started. Windows keeps the
      // single-process behaviour.
      child = spawn(invocation.executable, invocation.argv, {
        cwd: invocation.cwd,
        env: options.env,
        shell: false,
        detached: USE_PROCESS_GROUP,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      // Node throws E2BIG from spawn() itself rather than emitting 'error'.
      // The executable exists, so it must not be reported as missing.
      if ((error as NodeJS.ErrnoException).code !== 'E2BIG') throw error;
      void cleanupInvocationFiles(invocation).then(() =>
        resolve(
          failure({
            code: 'PROVIDER_ARGV_TOO_LARGE',
            message: ARGV_TOO_LARGE_MESSAGE,
            retryable: false,
            stdout: '',
            stderr: '',
            exitCode: null,
            signal: null,
            diagnostics: diagnosticsFor({
              invocation,
              stdoutBytes: 0,
              stderrBytes: 0,
              maxOutputBytes,
              timeoutSec,
              exitCode: null,
              signal: null,
            }),
          }),
        ),
      );
      return;
    }
    const provider = child;

    let killEscalation: NodeJS.Timeout | undefined;
    let finalResolution: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      terminate('timeout');
    }, timeoutSec * 1000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('error', () => {});
    child.stderr.on('error', () => {});
    child.stdout.on('data', (chunk) => {
      captureOutput('stdout', chunk);
    });
    child.stderr.on('data', (chunk) => {
      captureOutput('stderr', chunk);
    });

    child.on('error', () => {
      terminal = terminal ?? 'spawn_error';
      void finish();
    });

    child.on('exit', (code, signal) => {
      exitCode = code;
      exitSignal = signal;
    });

    child.on('close', (code, signal) => {
      leaderClosed = true;
      exitCode = code;
      exitSignal = signal;
      if (!termination) {
        // Normal exit: the group is never signalled.
        void finish(code, signal);
        return;
      }
      if (termination.scope === 'process') {
        settle('leader_exit');
        return;
      }
      if (termination.signals.includes('SIGKILL')) {
        settle('sigkill');
        return;
      }
      if (!processGroupAlive()) {
        settle('sigterm');
        return;
      }
      // A descendant outlived the leader: the pending SIGKILL escalation
      // still runs and settles the run.
    });

    child.stdin.on('error', () => {});
    child.stdin.end(invocation.stdin);

    function terminate(reason: 'timeout' | 'output_cap') {
      terminal = terminal ?? reason;
      if (reason === 'output_cap') {
        closeOutputCapture();
      }
      if (termination) return;
      termination = {
        reason,
        scope: USE_PROCESS_GROUP ? 'process_group' : 'process',
        signals: ['SIGTERM'],
        settled_by: 'settlement_timeout',
      };
      if (signalProvider('SIGTERM') === 'gone') {
        // ESRCH: the whole group already exited, so nothing is left to stop.
        settle('group_gone');
        return;
      }
      killEscalation = setTimeout(() => {
        const delivery = signalProvider('SIGKILL');
        if (delivery === 'sent') termination?.signals.push('SIGKILL');
        if (delivery === 'gone') {
          settle('sigterm');
          return;
        }
        if (leaderClosed) {
          settle('sigkill');
          return;
        }
        // Bound total settlement: resolve even if a process outside the
        // group keeps the output pipes open.
        finalResolution = setTimeout(() => {
          settle('settlement_timeout');
        }, finalResolutionMs);
      }, terminationGraceMs);
    }

    function signalProvider(signal: 'SIGTERM' | 'SIGKILL'): 'sent' | 'gone' {
      if (!USE_PROCESS_GROUP || provider.pid === undefined) {
        provider.kill(signal);
        return 'sent';
      }
      try {
        process.kill(-provider.pid, signal);
        return 'sent';
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') return 'gone';
        provider.kill(signal);
        return 'sent';
      }
    }

    function processGroupAlive() {
      if (provider.pid === undefined) return false;
      try {
        process.kill(-provider.pid, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code !== 'ESRCH';
      }
    }

    function settle(settledBy: ProviderTermination['settled_by']) {
      if (settled || !termination) return;
      termination.settled_by = settledBy;
      closeOutputCapture();
      provider.stdin.destroy();
      // A forced settlement with no observed exit reports the SIGKILL sent.
      const forcedWithoutExit =
        settledBy === 'settlement_timeout' &&
        exitCode === null &&
        exitSignal === null;
      void finish(exitCode, forcedWithoutExit ? 'SIGKILL' : exitSignal);
    }

    function captureOutput(stream: 'stdout' | 'stderr', chunk: string) {
      if (outputCaptureClosed) return;

      const remaining = maxOutputBytes - stdoutBytes - stderrBytes;
      if (remaining <= 0) {
        terminate('output_cap');
        return;
      }

      const chunkBytes = Buffer.byteLength(chunk);
      if (chunkBytes <= remaining) {
        appendOutput(stream, chunk, chunkBytes);
        return;
      }

      const retained = takeUtf8Prefix(chunk, remaining);
      if (retained.bytes > 0) {
        appendOutput(stream, retained.text, retained.bytes);
      }
      terminate('output_cap');
    }

    function appendOutput(
      stream: 'stdout' | 'stderr',
      chunk: string,
      chunkBytes: number,
    ) {
      if (stream === 'stdout') {
        stdout += chunk;
        stdoutBytes += chunkBytes;
      } else {
        stderr += chunk;
        stderrBytes += chunkBytes;
      }
    }

    function closeOutputCapture() {
      if (outputCaptureClosed) return;
      outputCaptureClosed = true;
      child.stdout.destroy();
      child.stderr.destroy();
    }

    async function finish(
      closeExitCode: number | null = exitCode,
      closeSignal: NodeJS.Signals | null = exitSignal,
    ) {
      if (settled) return;
      settled = true;
      exitCode = closeExitCode;
      exitSignal = closeSignal;
      clearTimeout(timeout);
      if (killEscalation) clearTimeout(killEscalation);
      if (finalResolution) clearTimeout(finalResolution);

      const diagnostics = diagnosticsFor({
        invocation,
        stdoutBytes,
        stderrBytes,
        maxOutputBytes,
        timeoutSec,
        exitCode,
        signal: exitSignal,
        termination,
      });

      if (terminal === 'spawn_error') {
        await cleanupInvocationFiles(invocation);
        resolve(
          failure({
            code: 'PROVIDER_MISSING',
            message: `Provider executable not found: ${invocation.executable}`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics,
          }),
        );
        return;
      }

      if (terminal === 'timeout') {
        await cleanupInvocationFiles(invocation);
        resolve(
          failure({
            code: 'PROVIDER_TIMEOUT',
            message: `Provider subprocess timed out after ${timeoutSec} seconds.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics,
          }),
        );
        return;
      }

      if (terminal === 'output_cap') {
        await cleanupInvocationFiles(invocation);
        resolve(
          failure({
            code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
            message: `Provider subprocess exceeded output cap of ${maxOutputBytes} bytes.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics,
          }),
        );
        return;
      }

      if (exitCode !== 0) {
        await cleanupInvocationFiles(invocation);
        resolve(
          failure({
            code: 'PROVIDER_EXIT',
            message: `Provider subprocess exited with code ${exitCode ?? 'null'}.`,
            retryable: true,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics,
          }),
        );
        return;
      }

      const lastMessage = await readLastMessage(invocation, maxOutputBytes);
      if (lastMessage.tooLarge) {
        await cleanupInvocationFiles(invocation);
        resolve(
          failure({
            code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
            message: `Provider last-message capture exceeded output cap of ${maxOutputBytes} bytes.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics,
          }),
        );
        return;
      }
      await cleanupInvocationFiles(invocation);
      resolve({
        ok: true,
        stdout,
        stderr,
        ...(lastMessage.contents !== undefined
          ? { last_message: lastMessage.contents }
          : {}),
        exit_code: exitCode,
        signal: exitSignal,
        diagnostics: lastMessage.warning
          ? {
              ...diagnostics,
              warnings: [...(diagnostics.warnings ?? []), lastMessage.warning],
            }
          : diagnostics,
      });
    }
  });
}

async function readLastMessage(
  invocation: ProviderInvocation,
  maxBytes = DEFAULT_MAX_OUTPUT_BYTES,
) {
  if (!invocation.last_message_file) return {};
  const result = await readBoundedRegularFile(
    invocation.last_message_file,
    maxBytes,
  );
  if (result.ok) return { contents: result.contents };
  if (result.reason === 'too_large') return { tooLarge: true };
  return {
    warning: `Could not read provider last-message file: ${result.message}`,
  };
}

async function cleanupInvocationFiles(invocation: ProviderInvocation) {
  if (
    !invocation.last_message_file ||
    invocation.cleanup_last_message_file === false
  ) {
    return;
  }
  try {
    await rm(invocation.last_message_file, { force: true });
  } catch {
    // Best effort cleanup only; read/validation remains authoritative.
  }
}

export type BoundedFileReadResult =
  | { ok: true; contents: string; bytes: number }
  | {
      ok: false;
      reason: 'too_large' | 'not_regular' | 'read_failed';
      message: string;
    };

export async function readBoundedRegularFile(
  filePath: string,
  maxBytes: number,
  options: { afterStat?: () => Promise<void> } = {},
): Promise<BoundedFileReadResult> {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const info = await handle.stat();
    if (!info.isFile()) {
      return {
        ok: false,
        reason: 'not_regular',
        message: 'capture is not a regular file',
      };
    }
    if (info.size > maxBytes) {
      return {
        ok: false,
        reason: 'too_large',
        message: `capture exceeds ${maxBytes} bytes`,
      };
    }
    await options.afterStat?.();

    const chunks: Buffer[] = [];
    let total = 0;
    let position = 0;
    while (total <= maxBytes) {
      const remaining = maxBytes + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
      position += bytesRead;
    }
    if (total > maxBytes) {
      return {
        ok: false,
        reason: 'too_large',
        message: `capture exceeds ${maxBytes} bytes`,
      };
    }
    return {
      ok: true,
      contents: Buffer.concat(chunks, total).toString('utf8'),
      bytes: total,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'read_failed',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await handle?.close();
  }
}

function takeUtf8Prefix(
  input: string,
  maxBytes: number,
): { text: string; bytes: number } {
  let bytes = 0;
  let text = '';
  for (const character of input) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    text += character;
    bytes += characterBytes;
  }
  return { text, bytes };
}

function diagnosticsFor(input: {
  invocation: ProviderInvocation;
  stdoutBytes: number;
  stderrBytes: number;
  maxOutputBytes: number;
  timeoutSec: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  termination?: ProviderTermination;
}): ProviderDiagnostics {
  return {
    ...(input.termination
      ? {
          termination: {
            ...input.termination,
            signals: [...input.termination.signals],
          },
        }
      : {}),
    strategy_used: input.invocation.strategy,
    output_mode: input.invocation.output_mode,
    redacted_command: input.invocation.redacted_command,
    provider_exit_code: input.exitCode,
    provider_signal: input.signal,
    output_bytes: {
      stdout: input.stdoutBytes,
      stderr: input.stderrBytes,
      max: input.maxOutputBytes,
    },
    timeout_sec: input.timeoutSec,
  };
}

function failure(input: {
  code: ProviderProcessFailure['code'];
  message: string;
  retryable: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  diagnostics: ProviderDiagnostics;
}): ProviderProcessFailure {
  return {
    ok: false,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    stdout: input.stdout,
    stderr: input.stderr,
    exit_code: input.exitCode,
    signal: input.signal,
    diagnostics: input.diagnostics,
  };
}
