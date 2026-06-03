/**
 * watch.test.mjs — tests for scripts/lib/watch.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const WATCH_MJS = new URL(
  '../../skills/session-observer/scripts/lib/watch.mjs',
  import.meta.url
);

async function importWatch() {
  return import(`${WATCH_MJS.href}?t=${Date.now()}-${Math.random()}`);
}

function claudeSlug(cwd) {
  return cwd.replace(/[/.]/g, '-');
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

async function appendClaudeMessage(transcriptPath, sessionId, content, role = 'assistant') {
  await appendFile(
    transcriptPath,
    JSON.stringify({ sessionId, message: { role, content } }) + '\n',
    'utf8'
  );
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

  test('writes metadata-only JSONL records to the event log', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/watch-event-log';
      const sessionId = 'watch-event-log';
      const transcriptPath = await writeClaudeTranscript(home, cwd, sessionId, [
        { content: 'event log baseline message' },
      ]);
      const eventLog = join(stateDir, 'events.jsonl');
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

      const raw = await readFile(eventLog, 'utf8');
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
});
