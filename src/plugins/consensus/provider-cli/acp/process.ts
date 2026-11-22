// Spawn-group primitive for ACP agents: a long-lived child with a live stdin,
// line-delimited stdout, capped stderr, an overall output cap, a deadline,
// and interrupt forwarding. Unlike runProviderSubprocess, teardown always
// signals the agent's process group, even after a clean exit, so helpers the
// agent started (MCP servers, sub-agents) do not outlive the run.
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

import { takeUtf8Prefix } from '../subprocess.js';

const USE_PROCESS_GROUP = process.platform !== 'win32';
const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
const DEFAULT_MAX_STDERR_BYTES = 64 * 1024;
const GROUP_POLL_MS = 20;
// After the leader exits, a descendant may still hold stdout open; the
// stream is treated as ended after this long.
const STDOUT_DRAIN_AFTER_EXIT_MS = 250;

export type ForwardedSignal = (typeof FORWARDED_SIGNALS)[number];
export type GroupSignal = 'SIGTERM' | 'SIGKILL' | ForwardedSignal;

export interface ProcessGroupOptions {
  executable: string;
  argv: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  // stdout plus stderr bytes; crossing it stops line delivery and calls
  // onOutputCap once.
  maxOutputBytes: number;
  // stderr kept for diagnostics; bytes past it are counted, not kept.
  maxStderrBytes?: number;
  timeoutMs: number;
  onLine: (line: string) => void;
  // stdout ended (or the leader exited and the drain window passed).
  onStdoutEnd?: () => void;
  onTimeout?: () => void;
  onOutputCap?: () => void;
  // First forwarded interrupt. A repeated one kills the group at once.
  onInterrupt?: (signal: ForwardedSignal) => void;
}

export interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface TeardownOptions {
  // How long to wait for the agent to exit after stdin closes.
  exitGraceMs: number;
  // How long the group gets after the first signal before SIGKILL.
  killGraceMs: number;
  // Bound on waiting for the group after SIGKILL.
  settleMs?: number;
  firstSignal?: 'SIGTERM' | ForwardedSignal;
  // false skips the exit wait (an interrupt asks to stop now).
  waitForExit?: boolean;
}

export interface GroupTeardown {
  scope: 'process_group' | 'process';
  // The leader had exited before any signal was sent.
  exited_before_signal: boolean;
  signals: GroupSignal[];
  settled_by:
    | 'group_gone'
    | 'first_signal'
    | 'sigkill'
    | 'settlement_timeout'
    | 'leader_exit';
}

export interface ProcessGroupHandle {
  readonly pid: number | undefined;
  // Writes to the live stdin; a no-op once stdin is closed.
  write(data: string): void;
  readonly exit: Promise<ProcessExit>;
  hasExited(): boolean;
  stderr(): string;
  outputBytes(): { stdout: number; stderr: number; max: number };
  interruptSignal(): ForwardedSignal | undefined;
  teardown(options: TeardownOptions): Promise<GroupTeardown>;
  // Re-raises a forwarded interrupt on this process once the run has
  // settled, when no other listener (another run or a host handler) remains.
  reraiseInterrupt(): void;
}

export type SpawnProcessGroupResult =
  | { ok: true; handle: ProcessGroupHandle }
  | {
      ok: false;
      reason: 'spawn_failed' | 'argv_too_large';
      errno?: string;
      message: string;
    };

export type SpawnProcessGroup = (
  options: ProcessGroupOptions,
) => Promise<SpawnProcessGroupResult>;

// Splits a UTF-8 text stream into lines with no per-line limit. A trailing
// carriage return is dropped, so CRLF framing also works.
export class LineBuffer {
  private pending = '';

  push(chunk: string): string[] {
    const lines: string[] = [];
    let start = 0;
    let searchFrom = this.pending.length;
    this.pending += chunk;
    let newline = this.pending.indexOf('\n', searchFrom);
    while (newline !== -1) {
      lines.push(stripCarriageReturn(this.pending.slice(start, newline)));
      start = newline + 1;
      searchFrom = start;
      newline = this.pending.indexOf('\n', searchFrom);
    }
    this.pending = this.pending.slice(start);
    return lines;
  }

  // The unterminated remainder, if any, as a final line.
  flush(): string | undefined {
    const rest = this.pending;
    this.pending = '';
    return rest.length > 0 ? stripCarriageReturn(rest) : undefined;
  }
}

function stripCarriageReturn(line: string) {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

export const spawnProcessGroup: SpawnProcessGroup = (options) =>
  new Promise((resolve) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(options.executable, [...options.argv], {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        detached: USE_PROCESS_GROUP,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code;
      if (errno !== 'E2BIG') throw error;
      resolve({
        ok: false,
        reason: 'argv_too_large',
        errno,
        message:
          'Agent arguments or environment exceeded the operating-system limit (E2BIG).',
      });
      return;
    }
    child.once('error', (error: NodeJS.ErrnoException) => {
      resolve({
        ok: false,
        reason: 'spawn_failed',
        ...(error.code ? { errno: error.code } : {}),
        message: `Could not start ${options.executable}: ${error.code ?? error.message}`,
      });
    });
    child.once('spawn', () => {
      // Later errors (a failed kill) must not crash the run.
      child.on('error', () => {});
      resolve({ ok: true, handle: attach(child, options) });
    });
  });

function attach(
  child: ChildProcessWithoutNullStreams,
  options: ProcessGroupOptions,
): ProcessGroupHandle {
  const maxStderrBytes = options.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;
  const lines = new LineBuffer();
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stderrKept = '';
  let stderrKeptBytes = 0;
  let capped = false;
  let stdinClosed = false;
  let stdoutEnded = false;
  let exited: ProcessExit | undefined;
  let interrupt: ForwardedSignal | undefined;
  let killedForRepeat = false;
  let listening = false;
  let resolveExit!: (exit: ProcessExit) => void;
  const exit = new Promise<ProcessExit>((resolve) => {
    resolveExit = resolve;
  });

  const deadline = setTimeout(() => {
    options.onTimeout?.();
  }, options.timeoutMs);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('error', () => {});
  child.stderr.on('error', () => {});
  child.stdin.on('error', () => {});

  child.stdout.on('data', (chunk: string) => {
    if (!countOutput('stdout', chunk)) return;
    for (const line of lines.push(chunk)) options.onLine(line);
  });
  child.stdout.on('end', endStdout);
  child.stderr.on('data', (chunk: string) => {
    if (!countOutput('stderr', chunk)) return;
    const room = maxStderrBytes - stderrKeptBytes;
    if (room <= 0) return;
    const kept = takeUtf8Prefix(chunk, room);
    stderrKept += kept.text;
    stderrKeptBytes += kept.bytes;
  });
  child.on('exit', (code, signal) => {
    exited = { code, signal };
    clearTimeout(deadline);
    resolveExit(exited);
    setTimeout(endStdout, STDOUT_DRAIN_AFTER_EXIT_MS);
  });

  if (USE_PROCESS_GROUP && child.pid !== undefined) {
    listening = true;
    for (const signal of FORWARDED_SIGNALS) process.on(signal, onSignal);
  }

  function onSignal(signal: ForwardedSignal) {
    if (interrupt) {
      // A repeated interrupt skips the graceful teardown.
      killedForRepeat = true;
      signalGroup('SIGKILL');
      return;
    }
    interrupt = signal;
    clearTimeout(deadline);
    options.onInterrupt?.(signal);
  }

  function countOutput(stream: 'stdout' | 'stderr', chunk: string) {
    if (capped) return false;
    const bytes = Buffer.byteLength(chunk);
    if (stream === 'stdout') stdoutBytes += bytes;
    else stderrBytes += bytes;
    if (stdoutBytes + stderrBytes > options.maxOutputBytes) {
      capped = true;
      options.onOutputCap?.();
      return false;
    }
    return true;
  }

  function endStdout() {
    if (stdoutEnded) return;
    stdoutEnded = true;
    if (!capped) {
      const rest = lines.flush();
      if (rest !== undefined) options.onLine(rest);
    }
    options.onStdoutEnd?.();
  }

  function signalGroup(signal: GroupSignal): 'sent' | 'gone' {
    if (!USE_PROCESS_GROUP || child.pid === undefined) {
      if (exited) return 'gone';
      child.kill(signal);
      return 'sent';
    }
    try {
      process.kill(-child.pid, signal);
      return 'sent';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return 'gone';
      child.kill(signal);
      return 'sent';
    }
  }

  function groupAlive() {
    if (!USE_PROCESS_GROUP || child.pid === undefined) return !exited;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== 'ESRCH';
    }
  }

  async function waitUntil(condition: () => boolean, ms: number) {
    const end = Date.now() + ms;
    while (!condition()) {
      if (Date.now() >= end) return false;
      await delay(GROUP_POLL_MS);
    }
    return true;
  }

  function closeStdin() {
    if (stdinClosed) return;
    stdinClosed = true;
    child.stdin.end();
  }

  async function teardown(teardownOptions: TeardownOptions) {
    clearTimeout(deadline);
    closeStdin();
    if (teardownOptions.waitForExit !== false && !exited) {
      await withTimeout(exit, teardownOptions.exitGraceMs);
    }
    const result: GroupTeardown = {
      scope: USE_PROCESS_GROUP ? 'process_group' : 'process',
      exited_before_signal: exited !== undefined,
      signals: [],
      settled_by: 'group_gone',
    };
    if (killedForRepeat) result.signals.push('SIGKILL');
    const first = teardownOptions.firstSignal ?? 'SIGTERM';
    if (signalGroup(first) === 'gone') {
      finishStreams();
      return result;
    }
    result.signals.push(first);
    if (await waitUntil(() => !groupAlive(), teardownOptions.killGraceMs)) {
      result.settled_by = USE_PROCESS_GROUP ? 'first_signal' : 'leader_exit';
      finishStreams();
      return result;
    }
    if (signalGroup('SIGKILL') === 'sent') result.signals.push('SIGKILL');
    const gone = await waitUntil(
      () => !groupAlive(),
      teardownOptions.settleMs ?? 1000,
    );
    result.settled_by = gone ? 'sigkill' : 'settlement_timeout';
    finishStreams();
    return result;
  }

  function finishStreams() {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    if (listening) {
      listening = false;
      for (const signal of FORWARDED_SIGNALS) {
        process.removeListener(signal, onSignal);
      }
    }
  }

  return {
    pid: child.pid,
    write(data) {
      if (stdinClosed || child.stdin.destroyed) return;
      child.stdin.write(data);
    },
    exit,
    hasExited: () => exited !== undefined,
    stderr: () => stderrKept,
    outputBytes: () => ({
      stdout: stdoutBytes,
      stderr: stderrBytes,
      max: options.maxOutputBytes,
    }),
    interruptSignal: () => interrupt,
    teardown,
    reraiseInterrupt() {
      if (listening || !interrupt) return;
      if (process.listenerCount(interrupt) === 0) {
        process.kill(process.pid, interrupt);
      }
    },
  };
}

// Resolves with the promise's value, or 'timeout' after ms; the timer is
// cleared either way so a settled race does not hold the event loop open.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | 'timeout'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

// Kept referenced: a teardown wait must hold the event loop open, or the
// CLI could exit before the group is signalled.
export function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
