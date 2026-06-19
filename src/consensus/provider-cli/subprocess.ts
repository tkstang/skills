import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';

import type { ProviderInvocation } from './invocation.js';
import type { ProviderDiagnostics, ProviderErrorCode } from './types.js';

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

    const child = spawn(invocation.executable, invocation.argv, {
      cwd: invocation.cwd,
      env: options.env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

    child.on('close', (exitCode, signal) => {
      void finish(exitCode, signal);
    });

    child.stdin.on('error', () => {});
    child.stdin.end(invocation.stdin);

    function terminate(reason: 'timeout' | 'output_cap') {
      terminal = terminal ?? reason;
      if (reason === 'output_cap') {
        closeOutputCapture();
      }
      child.kill('SIGTERM');
      if (!killEscalation) {
        killEscalation = setTimeout(() => {
          child.kill('SIGKILL');
          finalResolution = setTimeout(() => {
            void finish(null, 'SIGKILL');
          }, finalResolutionMs);
        }, terminationGraceMs);
      }
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

      const lastMessage = await readLastMessage(invocation);
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
              warnings: [
                ...(diagnostics.warnings ?? []),
                lastMessage.warning,
              ],
            }
          : diagnostics,
      });
    }
  });
}

async function readLastMessage(invocation: ProviderInvocation) {
  if (!invocation.last_message_file) return {};
  try {
    return {
      contents: await readFile(invocation.last_message_file, 'utf8'),
    };
  } catch (error) {
    return {
      warning: `Could not read provider last-message file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function cleanupInvocationFiles(invocation: ProviderInvocation) {
  if (!invocation.last_message_file) return;
  try {
    await rm(invocation.last_message_file, { force: true });
  } catch {
    // Best effort cleanup only; read/validation remains authoritative.
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
}): ProviderDiagnostics {
  return {
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
