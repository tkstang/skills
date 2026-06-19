import { spawn } from 'node:child_process';

import type { ProviderInvocation } from './invocation.js';
import type {
  ProviderDiagnostics,
  ProviderErrorCode,
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
  const maxOutputBytes =
    options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
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
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let settled = false;
    let terminal:
      | 'timeout'
      | 'output_cap'
      | 'spawn_error'
      | undefined;

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
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes + stderrBytes > maxOutputBytes) {
        terminate('output_cap');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      stderrBytes += Buffer.byteLength(chunk);
      if (stdoutBytes + stderrBytes > maxOutputBytes) {
        terminate('output_cap');
      }
    });

    child.on('error', () => {
      terminal = terminal ?? 'spawn_error';
      finish();
    });

    child.on('close', (exitCode, signal) => {
      finish(exitCode, signal);
    });

    child.stdin.on('error', () => {});
    child.stdin.end(invocation.stdin);

    function terminate(reason: 'timeout' | 'output_cap') {
      terminal = terminal ?? reason;
      child.kill('SIGTERM');
      if (!killEscalation) {
        killEscalation = setTimeout(() => {
          child.kill('SIGKILL');
          finalResolution = setTimeout(() => {
            finish(null, 'SIGKILL');
          }, finalResolutionMs);
        }, terminationGraceMs);
      }
    }

    function finish(
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

      resolve({
        ok: true,
        stdout,
        stderr,
        exit_code: exitCode,
        signal: exitSignal,
        diagnostics,
      });
    }
  });
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
