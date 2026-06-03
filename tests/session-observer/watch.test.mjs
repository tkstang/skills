/**
 * watch.test.mjs — tests for scripts/lib/watch.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WATCH_MJS = new URL(
  '../../skills/session-observer/scripts/lib/watch.mjs',
  import.meta.url
);
const WATCH_STATE_MJS = new URL(
  '../../skills/session-observer/scripts/lib/watch-state.mjs',
  import.meta.url
);
const CLI_PATH = fileURLToPath(new URL(
  '../../skills/session-observer/scripts/session-observer.mjs',
  import.meta.url
));

async function importWatch() {
  return import(`${WATCH_MJS.href}?t=${Date.now()}-${Math.random()}`);
}

async function importWatchState() {
  return import(`${WATCH_STATE_MJS.href}?t=${Date.now()}-${Math.random()}`);
}

function claudeSlug(cwd) {
  return cwd.replace(/[/.]/g, '-');
}

function cursorSlug(cwd) {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTempSessionHome(fn) {
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

async function writeClaudeTranscript(home, cwd, sessionId, messages) {
  const dir = join(home, '.claude', 'projects', claudeSlug(cwd));
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  const records = messages.map(({ role = 'assistant', content }) => ({
    sessionId,
    message: { role, content },
  }));
  await writeFile(transcriptPath, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  return transcriptPath;
}

async function writeCursorTranscript(home, cwd, sessionId, messages) {
  const dir = join(home, '.cursor', 'projects', cursorSlug(cwd), 'agent-transcripts', sessionId);
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  const records = messages.map(({ role = 'assistant', content }) => ({
    role,
    message: { content: [{ type: 'text', text: content }] },
  }));
  await writeFile(transcriptPath, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  return transcriptPath;
}

async function appendClaudeMessage(transcriptPath, sessionId, content, role = 'assistant') {
  await appendFile(
    transcriptPath,
    JSON.stringify({ sessionId, message: { role, content } }) + '\n',
    'utf8'
  );
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function waitFor(predicate, { timeoutMs = 1500, intervalMs = 25 } = {}) {
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
      const { runWatchLoop } = await importWatch();
      const stdout = [];

      const result = await runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.02,
        debounceSec: 0.02,
        maxRuntimeMin: 0.004,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 0);
      assert.equal(stdout.join(''), '');

      const state = JSON.parse(await readFile(join(stateDir, 'state.json'), 'utf8'));
      assert.equal(state.sessions['claude-code:watch-baseline'].lastRecordIndex, 1);

      const watchState = JSON.parse(await readFile(join(stateDir, 'watch.json'), 'utf8'));
      assert.equal(watchState.active, null);
    });
  });

  test('coalesces appended records inside the debounce window into one markdown event', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-debounce';
      const sessionId = 'watch-debounce';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'baseline message' },
      ]);
      const { runWatchLoop } = await importWatch();
      const stdout = [];

      const watchPromise = runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.03,
        debounceSec: 0.06,
        maxRuntimeMin: 0.012,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      await sleep(90);
      await appendClaudeMessage(transcriptPath, sessionId, 'first debounced update');
      await sleep(20);
      await appendClaudeMessage(transcriptPath, sessionId, 'second debounced update');

      const result = await watchPromise;
      const output = stdout.join('');
      const digestCount = (output.match(/## session-observer digest/g) ?? []).length;

      assert.equal(result.eventCount, 1);
      assert.equal(digestCount, 1);
      assert.ok(output.includes('first debounced update'));
      assert.ok(output.includes('second debounced update'));
    });
  });

  test('emits newline-delimited JSON events when json mode is enabled', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-json';
      const sessionId = 'watch-json';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'json baseline message' },
      ]);
      const { runWatchLoop } = await importWatch();
      const stdout = [];

      const watchPromise = runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.01,
        json: true,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      await sleep(80);
      await appendClaudeMessage(transcriptPath, sessionId, 'json update payload');
      await watchPromise;

      const lines = stdout.join('').trim().split('\n').filter(Boolean);
      assert.equal(lines.length, 1);

      const event = JSON.parse(lines[0]);
      assert.equal(event.type, 'catch-up');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.newRecords, 1);
      assert.equal(event.digest.entries[0].text, 'json update payload');
    });
  });

  test('runtime both preserves tracked transcript updates until debounce emission', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-runtime-both';
      const sessionId = 'watch-runtime-both';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'both baseline message' },
      ]);
      const { runWatchLoop } = await importWatch();
      const stdout = [];

      const watchPromise = runWatchLoop({
        runtime: 'both',
        cwd,
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.012,
        json: true,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'state.json'));
        return state?.sessions?.['claude-code:watch-runtime-both']?.lastRecordIndex === 1;
      });
      await appendClaudeMessage(transcriptPath, sessionId, 'both runtime update payload');

      const result = await watchPromise;
      assert.equal(result.eventCount, 1);

      const lines = stdout.join('').trim().split('\n').filter(Boolean);
      assert.equal(lines.length, 1);
      const event = JSON.parse(lines[0]);
      assert.equal(event.type, 'catch-up');
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.newRecords, 1);
      assert.equal(event.digest.entries[0].text, 'both runtime update payload');
    });
  });

  test('runtime both does not baseline cursor-only same-cwd transcripts', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-runtime-both-cursor-excluded';
      const sessionId = 'cursor-both-excluded';
      await writeCursorTranscript(home, cwd, sessionId, [
        { content: 'cursor baseline message should stay unread' },
      ]);
      const { runWatchLoop } = await importWatch();
      const stdout = [];

      const result = await runWatchLoop({
        runtime: 'both',
        cwd,
        pollSec: 0.02,
        debounceSec: 0.02,
        maxRuntimeMin: 0.004,
        json: true,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 0);
      assert.equal(stdout.join(''), '');

      const state = await readJsonIfExists(join(stateDir, 'state.json'));
      assert.equal(state?.sessions?.[`cursor:${sessionId}`], undefined);
      assert.equal(
        Object.keys(state?.sessions ?? {}).some(key => key.startsWith('cursor:')),
        false
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
      const { runWatchLoop } = await importWatch();

      const watchPromise = runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.01,
        eventLog,
      }, {
        writeStdout: () => {},
      });

      await sleep(80);
      await appendClaudeMessage(transcriptPath, sessionId, 'event log content must stay out');
      await watchPromise;

      const raw = await readFile(resolvedEventLog, 'utf8');
      assert.equal(raw.includes('event log content must stay out'), false);

      const lines = raw.trim().split('\n').filter(Boolean);
      assert.equal(lines.length, 1);
      const event = JSON.parse(lines[0]);
      assert.equal(event.runtime, 'claude-code');
      assert.equal(event.sessionId, sessionId);
      assert.equal(event.newRecords, 1);
      assert.equal(typeof event.digestChars, 'number');
      assert.deepEqual(Object.keys(event.ranges).sort(), [
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
      const { runWatchLoop } = await importWatch();
      const options = {
        runtime: 'claude-code',
        cwd: '/test/watch-event-log-reject',
        pollSec: 0.03,
        debounceSec: 0.04,
        maxRuntimeMin: 0.001,
      };

      await assert.rejects(
        runWatchLoop({ ...options, eventLog: join('..', 'outside.jsonl') }, {
          writeStdout: () => {},
        }),
        /--event-log must stay under the session-observer state directory/
      );
      await assert.rejects(
        runWatchLoop({ ...options, eventLog: join(home, 'outside.jsonl') }, {
          writeStdout: () => {},
        }),
        /--event-log must stay under the session-observer state directory/
      );
    });
  });

  test('pause prevents emission until resume while polling continues', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-pause-resume';
      const sessionId = 'watch-pause-resume';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'pause baseline message' },
      ]);
      const { runWatchLoop } = await importWatch();
      const watchState = await importWatchState();
      const stdout = [];

      const watchPromise = runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.03,
        debounceSec: 0.05,
        maxRuntimeMin: 0.02,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      await sleep(70);
      await watchState.writeControlDirective('pause');
      await sleep(70);
      await appendClaudeMessage(transcriptPath, sessionId, 'paused update');
      await sleep(180);

      assert.equal(stdout.join(''), '', 'paused watcher should not emit settled updates');

      await watchState.writeControlDirective('resume');
      const result = await watchPromise;

      assert.equal(result.reason, 'max-runtime');
      assert.equal(result.eventCount, 1);
      assert.ok(stdout.join('').includes('paused update'));
    });
  });

  test('flush emits a pending debounced update immediately', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/watch-flush';
      const sessionId = 'watch-flush';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'flush baseline message' },
      ]);
      const { runWatchLoop } = await importWatch();
      const watchState = await importWatchState();
      const stdout = [];

      const watchPromise = runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.03,
        debounceSec: 2,
        maxRuntimeMin: 0.008,
      }, {
        writeStdout: chunk => stdout.push(chunk),
      });

      await sleep(80);
      await appendClaudeMessage(transcriptPath, sessionId, 'flush update');
      await sleep(80);
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
      const { runWatchLoop } = await importWatch();
      const watchState = await importWatchState();

      const watchPromise = runWatchLoop({
        runtime: 'claude-code',
        cwd,
        pollSec: 0.03,
        debounceSec: 0.05,
        maxRuntimeMin: 0.02,
      }, {
        writeStdout: () => {},
      });

      await waitFor(async () => {
        const state = await readJsonIfExists(join(stateDir, 'watch.json'));
        return state?.active;
      });
      await watchState.writeControlDirective('stop');

      const result = await watchPromise;
      assert.equal(result.reason, 'control-stop');

      const watchJson = JSON.parse(await readFile(join(stateDir, 'watch.json'), 'utf8'));
      assert.equal(watchJson.active, null);
      assert.equal(await readJsonIfExists(join(stateDir, 'watch.control.json')), null);
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
        JSON.stringify({ directive: 'pause', issuedAt: new Date().toISOString() }),
        'utf8'
      );

      const child = spawn('node', [
        CLI_PATH,
        'watch',
        '--runtime', 'claude-code',
        '--cwd', cwd,
        '--poll-sec', '0.05',
        '--debounce-sec', '0.05',
        '--max-runtime-min', '0',
        '--json',
      ], {
        env: { ...process.env, HOME: home, STATE_DIR: stateDir },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      try {
        await waitFor(async () => {
          const state = await readJsonIfExists(join(stateDir, 'watch.json'));
          return state?.active;
        });

        child.kill('SIGTERM');
        const [code, signal] = await once(child, 'exit');

        assert.equal(signal, null);
        assert.equal(code, 0);

        const watchJson = JSON.parse(await readFile(join(stateDir, 'watch.json'), 'utf8'));
        assert.equal(watchJson.active, null);
        assert.equal(await readJsonIfExists(join(stateDir, 'watch.control.json')), null);
      } finally {
        if (!child.killed) child.kill('SIGKILL');
      }
    });
  });
});
