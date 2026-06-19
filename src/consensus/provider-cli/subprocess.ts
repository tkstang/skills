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

export function runProviderSubprocess(
  invocation: ProviderInvocation,
  options: RunProviderSubprocessOptions = {},
): Promise<ProviderProcessResult> {
  const maxOutputBytes =
    options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
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

    const timeout = setTimeout(() => {
      terminal = terminal ?? 'timeout';
      child.kill('SIGTERM');
    }, timeoutSec * 1000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes + stderrBytes > maxOutputBytes) {
        terminal = terminal ?? 'output_cap';
        child.kill('SIGTERM');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      stderrBytes += Buffer.byteLength(chunk);
      if (stdoutBytes + stderrBytes > maxOutputBytes) {
        terminal = terminal ?? 'output_cap';
        child.kill('SIGTERM');
      }
    });

    child.on('error', () => {
      terminal = terminal ?? 'spawn_error';
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      const diagnostics = diagnosticsFor({
        invocation,
        stdoutBytes,
        stderrBytes,
        maxOutputBytes,
        timeoutSec,
        exitCode,
        signal,
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
            signal,
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
            signal,
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
            signal,
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
            signal,
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
        signal,
        diagnostics,
      });
    });

    child.stdin.end(invocation.stdin);
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
