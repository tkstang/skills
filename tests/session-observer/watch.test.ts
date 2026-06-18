/**
 * watch.test.ts — tests for src/transcript/session-observer/lib/watch.ts
 */

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtemp,
  rm,
  mkdir,
  readFile,
  writeFile,
  appendFile,
  stat as fsStat,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, test, vi } from 'vitest';

import * as watchState from '../../src/transcript/session-observer/lib/watch-state.js';
import { runWatchLoop } from '../../src/transcript/session-observer/lib/watch.js';

const CLI_PATH = fileURLToPath(
  new URL(
    '../../skills/session-observer/scripts/session-observer.mjs',
    import.meta.url,
  ),
);

afterEach(() => {
  vi.restoreAllMocks();
});

function claudeSlug(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

function cursorSlug(cwd: string): string {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTempSessionHome(
  fn: (home: string, stateDir: string) => Promise<void>,
): Promise<void> {
  const home = await mkdtemp(join(tmpdir(), 'watch-test-home-'));
  const previousHome = process.env.HOME;
  const previousStateDir = process.env.STATE_DIR;
  process.env.HOME = home;
  process.env.STATE_DIR = join(home, '.local', 'state', 'session-observer');
  try {
    await mkdir(process.env.STATE_DIR, { recursive: true });
    await fn(home, process.env.STATE_DIR);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousStateDir === undefined) delete process.env.STATE_DIR;
    else process.env.STATE_DIR = previousStateDir;
    await rm(home, { recursive: true, force: true });
  }
}

async function writeClaudeTranscript(
  home: string,
  cwd: string,
  sessionId: string,
  messages: Array<{ role?: string; content: unknown }>,
): Promise<string> {
  const dir = join(home, '.claude', 'projects', claudeSlug(cwd));
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  const records = messages.map(({ role = 'user', content }) => ({
    sessionId,
    message: { role, content },
  }));
  await writeFile(
    transcriptPath,
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    'utf8',
  );
  return transcriptPath;
}

async function writeCursorTranscript(
  home: string,
  cwd: string,
  sessionId: string,
  messages: Array<{ role?: string; content: string }>,
): Promise<string> {
  const dir = join(
    home,
    '.cursor',
    'projects',
    cursorSlug(cwd),
    'agent-transcripts',
    sessionId,
  );
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  const records = messages.map(({ role = 'assistant', content }) => ({
    role,
    message: { content: [{ type: 'text', text: content }] },
  }));
  await writeFile(
    transcriptPath,
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    'utf8',
  );
  return transcriptPath;
}

async function writeCodexTranscript(
  home: string,
  cwd: string,
  sessionId: string,
  messages: Array<{ role?: string; content: unknown }>,
): Promise<string> {
  const dir = join(home, '.codex', 'sessions', '2026', '06', '03');
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  const records = [
    { sessionId, payload: { type: 'session_meta', cwd } },
    ...messages.map(({ role = 'user', content }) => ({
      sessionId,
      payload: { type: 'message', role, content },
    })),
  ];
  await writeFile(
    transcriptPath,
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    'utf8',
  );
  return transcriptPath;
}

async function appendClaudeMessage(
  transcriptPath: string,
  sessionId: string,
  content: unknown,
  role = 'assistant',
): Promise<void> {
  await appendFile(
    transcriptPath,
    JSON.stringify({ sessionId, message: { role, content } }) + '\n',
    'utf8',
  );
}

async function appendCodexMessage(
  transcriptPath: string,
  sessionId: string,
  content: unknown,
  role = 'assistant',
): Promise<void> {
  await appendFile(
    transcriptPath,
    JSON.stringify({ sessionId, payload: { type: 'message', role, content } }) +
      '\n',
    'utf8',
  );
}

async function readJsonIfExists(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const child = spawn('node', [CLI_PATH, ...args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const [status] = await once(child, 'exit');
  return { status, stdout, stderr };
}

async function waitFor(
  predicate: () => Promise<any> | any,
  {
    timeoutMs = 1500,
    intervalMs = 25,
  }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<any> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error('timed out waiting for condition');
}

describe('runWatchLoop', () => {
  test('establishes a baseline without emitting old content', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-baseline';
      await writeClaudeTranscript(home, cwd, 'watch-baseline', [
        { content: 'old message that should not be emitted' },
      ]);
      const stdout: string[] = [];

      const result = await runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.02,
          debounceSec: 0.02,
          maxRuntimeMin: 0.004,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 0);
      const output = stdout.join('');
      assert.ok(output.startsWith('[session-observer] Watcher is now active.'));
      assert.ok(output.includes('baseline claude-code:watch-baseline'));
      assert.ok(output.includes('baselineRecordIndex=1'));
      assert.ok(output.includes('engagement=engaged'));
      assert.ok(!output.includes('old message that should not be emitted'));

      const state = JSON.parse(
        await readFile(join(stateDir, 'state.json'), 'utf8'),
      );
      assert.equal(
        state.sessions['claude-code:watch-baseline'].lastRecordIndex,
        1,
      );

      const watchState = JSON.parse(
        await readFile(join(stateDir, 'watch.json'), 'utf8'),
      );
      assert.equal(watchState.active, null);
    });
  });

  test('catch-up-first emits unread backlog before watching', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-catch-up-first';
      await writeClaudeTranscript(home, cwd, 'watch-catch-up-first', [
        { content: 'unread backlog should be emitted' },
      ]);
      const stdout: string[] = [];

      const result = await runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.02,
          debounceSec: 0.02,
          maxRuntimeMin: 0.004,
          catchUpFirst: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      const output = stdout.join('');
      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);
      assert.ok(output.includes('baseline claude-code:watch-catch-up-first'));
      assert.ok(output.includes('unread backlog should be emitted'));

      const state = JSON.parse(
        await readFile(join(stateDir, 'state.json'), 'utf8'),
      );
      assert.equal(
        state.sessions['claude-code:watch-catch-up-first'].lastRecordIndex,
        1,
      );
    });
  });

  test('coalesces appended records inside the debounce window into one markdown event', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-debounce';
      const sessionId = 'watch-debounce';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'baseline message' },
      ]);
      const stdout: string[] = [];
      let nowMs = Date.UTC(2026, 5, 3, 12, 0, 0);
      let sleepCount = 0;

      const result = await runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.06,
          maxRuntimeMin: 0.003,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
          now: () => nowMs,
          sleep: async (ms: number) => {
            nowMs += ms;
            sleepCount++;
            if (sleepCount === 1) {
              await appendClaudeMessage(
                transcriptPath,
                sessionId,
                'first debounced update',
              );
            } else if (sleepCount === 2) {
              await appendClaudeMessage(
                transcriptPath,
                sessionId,
                'second debounced update',
              );
            }
          },
        },
      );

      const output = stdout.join('');
      const digestCount = (output.match(/## session-observer digest/g) ?? [])
        .length;

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);
      assert.equal(digestCount, 1);
      assert.ok(output.includes('first debounced update'));
      assert.ok(output.includes('second debounced update'));
      assert.ok(
        sleepCount >= 4,
        'fake clock should advance through debounce settling',
      );
    });
  });

  test('emits during continuous writes once max pending age is reached', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-max-pending';
      const sessionId = 'watch-max-pending';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'max pending baseline message' },
      ]);
      const stdout: string[] = [];
      let nowMs = Date.UTC(2026, 5, 3, 12, 0, 0);
      let sleepCount = 0;

      const result = await runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 1,
          maxPendingSec: 0.09,
          maxRuntimeMin: 0.004,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
          now: () => nowMs,
          sleep: async (ms: number) => {
            nowMs += ms;
            sleepCount++;
            if (sleepCount <= 4) {
              await appendClaudeMessage(
                transcriptPath,
                sessionId,
                `continuous update ${sleepCount}`,
              );
            }
          },
        },
      );

      const output = stdout.join('');
      assert.equal(result.reason, 'max-runtime');
      assert.ok(
        result.eventCount >= 1,
        'max-pending should prevent indefinite debounce starvation',
      );
      assert.ok(output.includes('continuous update 1'));
    });
  });

  test('emits newline-delimited JSON events when json mode is enabled', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-json';
      const sessionId = 'watch-json';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'json baseline message' },
      ]);
      const stdout: string[] = [];

      const watchPromise = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.02,
          json: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      // Wait for the baseline target lock (recorded after the baseline
      // signature is captured) so the append below is seen as a delta
      // rather than being absorbed into a slow baseline observe.
      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.watchers?.some(
          (watcher: any) => watcher.targets?.length >= 1,
        );
      });
      await appendClaudeMessage(
        transcriptPath,
        sessionId,
        'json update payload',
      );
      await watchPromise;

      const lines = stdout
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const locked = lines.find((line) => line.type === 'baseline');
      const event = lines.find((line) => line.type === 'delta');
      const stopped = lines.find((line) => line.type === 'stopped');
      assert.ok(locked, 'json watch should emit a startup lock event');
      assert.ok(event, 'json watch should emit a delta event');
      assert.ok(stopped, 'json watch should emit a stopped event');
      assert.equal(locked.sessionId, sessionId);
      assert.equal(event.type, 'delta');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.newRecords, 1);
      assert.equal(event.digest.entries[0].text, 'json update payload');
    });
  });

  test('emits heartbeat status events while quiet', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-heartbeat';
      const sessionId = 'watch-heartbeat';
      await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'heartbeat baseline message' },
      ]);
      const stdout: string[] = [];
      let nowMs = Date.UTC(2026, 5, 3, 12, 0, 0);

      const result = await runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          heartbeatSec: 0.06,
          maxRuntimeMin: 0.004,
          json: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
          now: () => nowMs,
          sleep: async (ms: number) => {
            nowMs += ms;
          },
        },
      );

      assert.equal(result.reason, 'max-runtime');
      const lines = stdout
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const heartbeat = lines.find((line) => line.type === 'heartbeat');
      assert.ok(heartbeat, 'quiet json watch should emit a heartbeat');
      assert.equal(heartbeat.recordsBehind, 0);
      assert.equal(heartbeat.healthy, true);
      assert.equal(heartbeat.targets[0].sessionId, sessionId);
    });
  });

  test('runtime both preserves tracked transcript updates until debounce emission', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-runtime-both';
      const sessionId = 'watch-runtime-both';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'both baseline message' },
      ]);
      const stdout: string[] = [];

      const watchPromise = runWatchLoop(
        {
          runtime: 'both',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.012,
          json: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'state.json'));
        return (
          state?.sessions?.['claude-code:watch-runtime-both']
            ?.lastRecordIndex === 1
        );
      });
      await appendClaudeMessage(
        transcriptPath,
        sessionId,
        'both runtime update payload',
      );

      const result = await watchPromise;
      assert.equal(result.eventCount, 1);

      const lines = stdout
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const locked = lines.find((line) => line.type === 'baseline');
      const event = lines.find((line) => line.type === 'delta');
      assert.ok(locked, 'runtime both should emit a startup lock event');
      assert.ok(event, 'runtime both should emit a delta event');
      assert.equal(event.type, 'delta');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.newRecords, 1);
      assert.equal(event.digest.entries[0].text, 'both runtime update payload');
    });
  });

  test('runtime both flushes selected transcript update at max runtime', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-runtime-both-final-flush';
      const sessionId = 'watch-runtime-both-final-flush';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'both final flush baseline message' },
      ]);
      const stdout: string[] = [];
      let nowMs = Date.UTC(2026, 5, 3, 12, 0, 0);
      let sleepCount = 0;

      const result = await runWatchLoop(
        {
          runtime: 'both',
          cwd,
          pollSec: 0.03,
          debounceSec: 5,
          maxRuntimeMin: 0.0015,
          json: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
          now: () => nowMs,
          sleep: async (ms: number) => {
            nowMs += ms;
            sleepCount++;
            if (sleepCount === 3) {
              await appendClaudeMessage(
                transcriptPath,
                sessionId,
                'both final flush update',
              );
            }
          },
        },
      );

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);

      const lines = stdout
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const event = lines.find((line) => line.type === 'delta');
      assert.ok(event, 'max runtime should flush the selected pending delta');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.digest.entries[0].text, 'both final flush update');
    });
  });

  test('runtime both tracks records appended during baseline target lock', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-runtime-both-baseline-race';
      const sessionId = 'watch-runtime-both-baseline-race';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'both baseline race message' },
      ]);
      const stdout: string[] = [];
      let nowMs = Date.UTC(2026, 5, 3, 12, 0, 0);
      let appendedDuringSignature = false;

      const result = await runWatchLoop(
        {
          runtime: 'both',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.03,
          maxRuntimeMin: 0.0015,
          json: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
          now: () => nowMs,
          sleep: async (ms: number) => {
            nowMs += ms;
          },
          stat: async (path: string) => {
            if (!appendedDuringSignature && path === transcriptPath) {
              appendedDuringSignature = true;
              await appendClaudeMessage(
                transcriptPath,
                sessionId,
                'both baseline race update',
              );
            }
            return fsStat(path);
          },
        },
      );

      assert.equal(appendedDuringSignature, true);
      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);

      const lines = stdout
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const event = lines.find((line) => line.type === 'delta');
      assert.ok(event, 'baseline lock race should emit the appended delta');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.digest.entries[0].text, 'both baseline race update');
    });
  });

  test('allows concurrent same-cwd watchers for different peer runtimes', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-same-cwd-reciprocal';
      await writeClaudeTranscript(home, cwd, 'same-cwd-claude', [
        { content: 'same cwd claude baseline' },
      ]);
      await writeCodexTranscript(home, cwd, 'same-cwd-codex', [
        { content: 'same cwd codex baseline' },
      ]);
      const stdoutA: string[] = [];
      const stdoutB: string[] = [];
      vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0 && (pid === 111 || pid === 222)) return true;
        return true;
      });

      const watcherA = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.02,
        },
        {
          pid: 111,
          handleSignals: false,
          writeStdout: (chunk: string) => stdoutA.push(chunk),
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.watchers?.length === 1;
      });

      const watcherB = runWatchLoop(
        {
          runtime: 'codex',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.02,
        },
        {
          pid: 222,
          handleSignals: false,
          writeStdout: (chunk: string) => stdoutB.push(chunk),
        },
      );

      const activeState = await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        if (state?.watchers?.length !== 2) return null;
        if (
          !state.watchers.every((watcher: any) => watcher.targets?.length === 1)
        )
          return null;
        return state;
      });
      assert.deepEqual(
        activeState.watchers.map((watcher: any) => watcher.pid),
        [111, 222],
      );
      assert.deepEqual(
        activeState.watchers.map((watcher: any) => watcher.targets[0]?.runtime),
        ['claude-code', 'codex'],
      );

      const results = await Promise.all([watcherA, watcherB]);
      assert.deepEqual(
        results.map((result: any) => result.reason),
        ['max-runtime', 'max-runtime'],
      );
      assert.ok(
        stdoutA.join('').includes('baseline claude-code:same-cwd-claude'),
      );
      assert.ok(stdoutB.join('').includes('baseline codex:same-cwd-codex'));
    });
  });

  test('refuses a second watcher for the same target session', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-duplicate-target';
      await writeClaudeTranscript(home, cwd, 'duplicate-target', [
        { content: 'duplicate target baseline message' },
      ]);
      vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) return true;
        return true;
      });

      const stdoutA: string[] = [];
      const watcherA = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.02,
        },
        {
          pid: 111,
          handleSignals: false,
          writeStdout: (chunk: string) => stdoutA.push(chunk),
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.watchers?.[0]?.targets?.length === 1 ? state : null;
      });

      const stdoutB: string[] = [];
      await assert.rejects(
        () =>
          runWatchLoop(
            {
              runtime: 'claude-code',
              cwd,
              pollSec: 0.03,
              debounceSec: 0.04,
              maxRuntimeMin: 0.02,
            },
            {
              pid: 222,
              handleSignals: false,
              writeStdout: (chunk: string) => stdoutB.push(chunk),
            },
          ),
        /already watching claude-code:duplicate-target/,
      );
      assert.ok(stdoutB.join('').includes('already watching'));

      const watchJson = await readJsonIfExists(join(stateDir, 'watch.json'));
      assert.deepEqual(
        watchJson.watchers.map((watcher: any) => watcher.pid),
        [111],
      );

      const result = await watcherA;
      assert.equal(result.reason, 'max-runtime');
    });
  });

  test('refuses concurrent same-target watchers racing before either records', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-duplicate-target-race';
      await writeClaudeTranscript(home, cwd, 'duplicate-target-race', [
        { content: 'duplicate target race baseline message' },
      ]);
      vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) return true;
        return true;
      });

      // Start both watchers in the same tick so both can pass the unlocked
      // pre-check before either has recorded its target; the locked write in
      // recordWatcherTarget must still reject exactly one of them.
      const stdoutA: string[] = [];
      const stdoutB: string[] = [];
      const startWatcher = (pid: number, sink: string[]) =>
        runWatchLoop(
          {
            runtime: 'claude-code',
            cwd,
            pollSec: 0.03,
            debounceSec: 0.04,
            maxRuntimeMin: 0.02,
          },
          {
            pid,
            handleSignals: false,
            writeStdout: (chunk: string) => sink.push(chunk),
          },
        );
      const settled = await Promise.allSettled([
        startWatcher(111, stdoutA),
        startWatcher(222, stdoutB),
      ]);

      const rejected = settled.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      const fulfilled = settled.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled',
      );
      assert.equal(
        rejected.length,
        1,
        `exactly one watcher should lose the startup race: ${JSON.stringify(settled)}`,
      );
      assert.match(
        rejected[0].reason.message,
        /already watching claude-code:duplicate-target-race/,
      );
      assert.equal(fulfilled[0].value.reason, 'max-runtime');
      assert.ok(
        (stdoutA.join('') + stdoutB.join('')).includes('already watching'),
      );

      const watchJson = await readJsonIfExists(join(stateDir, 'watch.json'));
      assert.deepEqual(watchJson?.watchers ?? [], []);
    });
  });

  test('watch-ctl status reports resolved pinned target and records-behind drift', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-status-pinned-codex';
      const sessionId = 'codex-pinned-status';
      const transcriptPath = await writeCodexTranscript(home, cwd, sessionId, [
        { content: 'status baseline message' },
      ]);

      const watchPromise = runWatchLoop(
        {
          runtime: 'auto',
          cwd,
          session: `codex:${sessionId}`,
          pollSec: 0.03,
          debounceSec: 5,
          maxPendingSec: 5,
          maxRuntimeMin: 0.03,
          json: true,
        },
        {
          writeStdout: () => {},
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.active?.targets?.[0]?.sessionId === sessionId;
      });
      await appendCodexMessage(
        transcriptPath,
        sessionId,
        'status drift update',
      );

      const statusPayload = await waitFor(async () => {
        const result = await runCli(['watch-ctl', 'status', '--json'], {
          ...process.env,
          HOME: home,
          STATE_DIR: stateDir,
        });
        assert.equal(
          result.status,
          0,
          `status should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );
        const payload = JSON.parse(result.stdout);
        const target = payload.targets?.[0];
        return target?.recordsBehind === 1 ? payload : null;
      });

      assert.equal(statusPayload.requestedRuntime, 'auto');
      assert.equal(statusPayload.resolvedRuntime, 'codex');
      assert.equal(statusPayload.sessionId, sessionId);
      assert.equal(statusPayload.transcriptPath, transcriptPath);
      assert.equal(statusPayload.targets[0].transcriptRecords, 3);
      assert.equal(statusPayload.targets[0].lastRecordIndex, 2);
      assert.equal(statusPayload.targets[0].consumedThrough, 1);
      assert.equal(statusPayload.targets[0].recordsBehind, 1);

      await watchState.writeControlDirective('stop');
      await watchPromise;
    });
  });

  test('watch-ctl status marks stale drift unhealthy', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-status-unhealthy';
      const sessionId = 'codex-status-unhealthy';
      const transcriptPath = await writeCodexTranscript(home, cwd, sessionId, [
        { content: 'stale baseline message' },
        { content: 'stale update one', role: 'assistant' },
        { content: 'stale update two', role: 'assistant' },
      ]);
      const old = '2026-06-03T12:00:00.000Z';
      await writeFile(
        join(stateDir, 'watch.json'),
        JSON.stringify({
          schemaVersion: 1,
          active: {
            pid: process.pid,
            runtime: 'auto',
            requestedRuntime: 'auto',
            cwd,
            session: `codex:${sessionId}`,
            startedAt: old,
            pollSec: 3,
            debounceSec: 3,
            maxPendingSec: 30,
            staleAfterSec: 1,
            lastPollAt: old,
            lastEventAt: old,
            eventCount: 13,
            resolvedRuntime: 'codex',
            sessionId,
            transcriptPath,
            targets: [
              {
                key: `codex:${sessionId}`,
                runtime: 'codex',
                sessionId,
                transcriptPath,
                cwd,
                recordCount: 1,
                baselineRecordIndex: 1,
                engagementStatus: 'engaged',
                lockedAt: old,
              },
            ],
            lastError: null,
          },
        }),
        'utf8',
      );
      await writeFile(
        join(stateDir, 'state.json'),
        JSON.stringify({
          schemaVersion: 1,
          sessions: {
            [`codex:${sessionId}`]: {
              runtime: 'codex',
              sessionId,
              transcriptPath,
              recordedCwd: cwd,
              lastRecordIndex: 1,
              lastTotalRecords: 1,
              lastReadAt: old,
              watchedByPid: process.pid,
            },
          },
        }),
        'utf8',
      );

      const result = await runCli(['watch-ctl', 'status', '--json'], {
        ...process.env,
        HOME: home,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `status should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const payload = JSON.parse(result.stdout);

      assert.equal(payload.active, true);
      assert.equal(payload.healthy, false);
      assert.equal(payload.targets[0].recordsBehind, 3);
      assert.ok(
        payload.targets[0].healthReasons.includes('records-behind-stale'),
      );
      assert.ok(
        payload.targets[0].healthReasons.includes('poll-heartbeat-stale'),
      );
    });
  });

  test('runtime both does not baseline cursor-only same-cwd transcripts', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-runtime-both-cursor-excluded';
      const sessionId = 'cursor-both-excluded';
      await writeCursorTranscript(home, cwd, sessionId, [
        { content: 'cursor baseline message should stay unread' },
      ]);
      const stdout: string[] = [];

      const result = await runWatchLoop(
        {
          runtime: 'both',
          cwd,
          pollSec: 0.02,
          debounceSec: 0.02,
          maxRuntimeMin: 0.004,
          json: true,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 0);
      const lines = stdout
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      assert.ok(lines.some((line) => line.type === 'stopped'));
      assert.equal(
        lines.some((line) => line.type === 'baseline'),
        false,
      );
      assert.equal(
        lines.some((line) => line.type === 'delta'),
        false,
      );

      const state = await readJsonIfExists(join(stateDir, 'state.json'));
      assert.equal(state?.sessions?.[`cursor:${sessionId}`], undefined);
      assert.equal(
        Object.keys(state?.sessions ?? {}).some((key) =>
          key.startsWith('cursor:'),
        ),
        false,
      );
    });
  });

  test('writes metadata-only JSONL records to the event log', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-event-log';
      const sessionId = 'watch-event-log';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'event log baseline message' },
      ]);
      const eventLog = join('logs', 'events.jsonl');
      const resolvedEventLog = join(stateDir, eventLog);

      const watchPromise = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.02,
          eventLog,
        },
        {
          writeStdout: () => {},
        },
      );

      // Wait for the baseline target lock so the append is a post-baseline
      // delta even when baseline establishment is slow.
      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.watchers?.some(
          (watcher: any) => watcher.targets?.length >= 1,
        );
      });
      await appendClaudeMessage(
        transcriptPath,
        sessionId,
        'event log content must stay out',
      );
      await watchPromise;

      const raw = await readFile(resolvedEventLog, 'utf8');
      assert.equal(raw.includes('event log content must stay out'), false);

      const lines = raw.trim().split('\n').filter(Boolean);
      assert.equal(lines.length, 1);
      const event = JSON.parse(lines[0]);
      assert.equal(event.type, 'delta');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.newRecords, 1);
      assert.equal(typeof event.digestChars, 'number');
      assert.deepEqual(Object.keys(event.ranges).toSorted(), [
        'fromIndex',
        'nextIndex',
        'renderedFromIndex',
        'renderedToIndex',
        'toIndex',
        'totalRecords',
      ]);
      assert.equal('digest' in event, false);
      assert.equal('entries' in event, false);
    });
  });

  test('rejects event log paths outside the session-observer state directory', async () => {
    await withTempSessionHome(async (home) => {
      const options = {
        runtime: 'claude-code',
        cwd: '/test/watch-event-log-reject',
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.001,
      };

      await assert.rejects(
        runWatchLoop(
          { ...options, eventLog: join('..', 'outside.jsonl') },
          {
            writeStdout: () => {},
          },
        ),
        /--event-log must stay under the session-observer state directory/,
      );
      await assert.rejects(
        runWatchLoop(
          { ...options, eventLog: join(home, 'outside.jsonl') },
          {
            writeStdout: () => {},
          },
        ),
        /--event-log must stay under the session-observer state directory/,
      );
    });
  });

  test('rejects event log symlinks that escape the session-observer state directory', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const outsideLog = join(home, 'outside-events.jsonl');
      const outsideDir = join(home, 'outside-event-dir');
      await writeFile(outsideLog, '', 'utf8');
      await mkdir(outsideDir, { recursive: true });
      await symlink(outsideLog, join(stateDir, 'events.jsonl'));
      await symlink(outsideDir, join(stateDir, 'linked-logs'));

      const options = {
        runtime: 'claude-code',
        cwd: '/test/watch-event-log-symlink-reject',
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.001,
      };

      await assert.rejects(
        runWatchLoop(
          { ...options, eventLog: 'events.jsonl' },
          {
            writeStdout: () => {},
          },
        ),
        /--event-log must stay under the session-observer state directory/,
      );
      await assert.rejects(
        runWatchLoop(
          { ...options, eventLog: join('linked-logs', 'events.jsonl') },
          {
            writeStdout: () => {},
          },
        ),
        /--event-log must stay under the session-observer state directory/,
      );

      assert.equal(await readFile(outsideLog, 'utf8'), '');
      assert.equal(await readJsonIfExists(join(stateDir, 'watch.json')), null);
    });
  });

  test('rejects event log paths reserved for session-observer state files', async () => {
    await withTempSessionHome(async () => {
      const options = {
        runtime: 'claude-code',
        cwd: '/test/watch-event-log-reserved-reject',
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.001,
      };
      const reservedEventLogs = [
        'state.json',
        'watch.json',
        'watch.control.json',
        'state.json.lock',
        'watch.json.lock',
        'watch.control.json.lock',
        `state.json.${process.pid}.tmp`,
        `watch.json.${process.pid}.123.tmp`,
        `watch.control.json.${process.pid}.123.tmp`,
        `state.json.corrupt-123-${process.pid}.bak`,
        `state.json.v0-123-${process.pid}.bak`,
      ];

      for (const eventLog of reservedEventLogs) {
        await assert.rejects(
          runWatchLoop(
            { ...options, eventLog },
            {
              writeStdout: () => {},
            },
          ),
          /--event-log cannot use session-observer state, lock, temp, or backup files/,
        );
      }
    });
  });

  test('pause prevents emission until resume while polling continues', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-pause-resume';
      const sessionId = 'watch-pause-resume';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'pause baseline message' },
      ]);
      const stdout: string[] = [];

      const watchPromise = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.05,
          maxRuntimeMin: 0.02,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.watchers?.some(
          (watcher: any) => watcher.targets?.length >= 1,
        );
      });
      await watchState.writeControlDirective('pause');
      await waitFor(async () => {
        return (
          (await readJsonIfExists(join(stateDir, 'watch.control.json'))) ===
          null
        );
      });
      const appendedAtMs = Date.now();
      await appendClaudeMessage(transcriptPath, sessionId, 'paused update');
      let firstStampAfterAppendMs: number | null = null;
      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        const lastPollAtMs = Date.parse(state?.watchers?.[0]?.lastPollAt ?? '');
        if (!Number.isFinite(lastPollAtMs) || lastPollAtMs <= appendedAtMs) {
          return false;
        }
        if (firstStampAfterAppendMs === null) {
          firstStampAfterAppendMs = lastPollAtMs;
          return false;
        }
        return lastPollAtMs > firstStampAfterAppendMs;
      });

      assert.ok(
        !stdout.join('').includes('paused update'),
        'paused watcher should not emit settled updates',
      );

      await watchState.writeControlDirective('resume');
      const result = await watchPromise;

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);
      assert.ok(stdout.join('').includes('paused update'));
    });
  });

  test('flush emits a pending debounced update immediately', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-flush';
      const sessionId = 'watch-flush';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'flush baseline message' },
      ]);
      const stdout: string[] = [];

      const watchPromise = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 5,
          maxRuntimeMin: 0.02,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      // Wait for the baseline target lock so the append is a post-baseline
      // delta even when baseline establishment is slow.
      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.watchers?.some(
          (watcher: any) => watcher.targets?.length >= 1,
        );
      });
      const appendedAtMs = Date.now();
      await appendClaudeMessage(transcriptPath, sessionId, 'flush update');
      // Two completed poll stamps after the append guarantee a pollTargets
      // pass observed the appended record, so the flush below has a pending
      // entry to force out (debounceSec is far beyond the runtime budget,
      // so flush is the only emit path this test can take).
      let firstStampAfterAppendMs: number | null = null;
      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        const lastPollAtMs = Date.parse(state?.watchers?.[0]?.lastPollAt ?? '');
        if (!Number.isFinite(lastPollAtMs) || lastPollAtMs <= appendedAtMs)
          return false;
        if (firstStampAfterAppendMs === null) {
          firstStampAfterAppendMs = lastPollAtMs;
          return false;
        }
        return lastPollAtMs > firstStampAfterAppendMs;
      });
      await watchState.writeControlDirective('flush');

      const result = await watchPromise;
      assert.equal(result.eventCount, 1);
      assert.ok(stdout.join('').includes('flush update'));
    });
  });

  test('stop directive exits cleanly and clears watch metadata', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-stop';
      await writeClaudeTranscript(home, cwd, 'watch-stop', [
        { content: 'stop baseline message' },
      ]);
      const stdout: string[] = [];

      const watchPromise = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.05,
          maxRuntimeMin: 0.02,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.active;
      });
      await watchState.writeControlDirective('stop');

      const result = await watchPromise;
      assert.equal(result.reason, 'control-stop');
      assert.ok(stdout.join('').includes('watch stopped reason=control-stop'));

      const watchJson = JSON.parse(
        await readFile(join(stateDir, 'watch.json'), 'utf8'),
      );
      assert.equal(watchJson.active, null);
      assert.equal(
        await readJsonIfExists(join(stateDir, 'watch.control.json')),
        null,
      );
    });
  });

  test('inactive watch-ctl stop leaves no stale directive for the next watcher', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-inactive-stop';
      const sessionId = 'watch-inactive-stop';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'inactive stop baseline message' },
      ]);
      await writeFile(
        join(stateDir, 'watch.control.json'),
        JSON.stringify({
          directive: 'stop',
          issuedAt: new Date().toISOString(),
        }),
        'utf8',
      );

      const stopResult = spawnSync(
        'node',
        [CLI_PATH, 'watch-ctl', 'stop', '--json'],
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: home, STATE_DIR: stateDir },
        },
      );
      assert.equal(
        stopResult.status,
        0,
        `inactive stop should exit 0\nstdout: ${stopResult.stdout}\nstderr: ${stopResult.stderr}`,
      );
      const stopPayload = JSON.parse(stopResult.stdout);
      assert.equal(stopPayload.noActiveWatcher, true);
      assert.equal(stopPayload.active, false);
      assert.equal(
        await readJsonIfExists(join(stateDir, 'watch.control.json')),
        null,
      );

      const stdout: string[] = [];
      const watchPromise = runWatchLoop(
        {
          runtime: 'claude-code',
          cwd,
          pollSec: 0.03,
          debounceSec: 0.04,
          maxRuntimeMin: 0.012,
        },
        {
          writeStdout: (chunk: string) => stdout.push(chunk),
        },
      );

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'state.json'));
        return (
          state?.sessions?.['claude-code:watch-inactive-stop']
            ?.lastRecordIndex === 1
        );
      });
      await appendClaudeMessage(
        transcriptPath,
        sessionId,
        'next watcher update after inactive stop',
      );

      const result = await watchPromise;
      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);
      assert.ok(
        stdout.join('').includes('next watcher update after inactive stop'),
      );
    });
  });

  test('SIGTERM cleanup clears watcher and control metadata', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-sigterm';
      await writeClaudeTranscript(home, cwd, 'watch-sigterm', [
        { content: 'sigterm baseline message' },
      ]);
      await writeFile(
        join(stateDir, 'watch.control.json'),
        JSON.stringify({
          directive: 'pause',
          issuedAt: new Date().toISOString(),
        }),
        'utf8',
      );

      const child = spawn(
        'node',
        [
          CLI_PATH,
          'watch',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--poll-sec',
          '0.05',
          '--debounce-sec',
          '0.05',
          '--max-runtime-min',
          '0',
          '--json',
        ],
        {
          env: { ...process.env, HOME: home, STATE_DIR: stateDir },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      try {
        await waitFor(async () => {
          const state = await readJsonIfExists(join(stateDir, 'watch.json'));
          return state?.active;
        });

        child.kill('SIGTERM');
        const [code, signal] = await once(child, 'exit');

        assert.equal(signal, null);
        assert.equal(code, 0);

        const watchJson = JSON.parse(
          await readFile(join(stateDir, 'watch.json'), 'utf8'),
        );
        assert.equal(watchJson.active, null);
        assert.equal(
          await readJsonIfExists(join(stateDir, 'watch.control.json')),
          null,
        );
      } finally {
        if (!child.killed) child.kill('SIGKILL');
      }
    });
  });
});
