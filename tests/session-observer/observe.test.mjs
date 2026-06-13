/**
 * observe.test.mjs — tests for the reusable catch-up observation pipeline.
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, describe } from 'node:test';

const OBSERVE_MJS = new URL(
  '../../skills/session-observer/scripts/lib/observe.mjs',
  import.meta.url,
);

async function importObserve() {
  return import(`${OBSERVE_MJS.href}?t=${Date.now()}-${Math.random()}`);
}

function claudeSlug(cwd) {
  return cwd.replace(/[/.]/g, '-');
}

async function withTempSessionHome(fn) {
  const home = await mkdtemp(join(tmpdir(), 'observe-test-home-'));
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

async function writeClaudeTranscript(home, cwd, fileName, sessionId, messages) {
  const dir = join(home, '.claude', 'projects', claudeSlug(cwd));
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, fileName);
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

async function writeCodexTranscript(home, cwd, fileName, sessionId, messages) {
  const dir = join(home, '.codex', 'sessions', '2026', '06', '03');
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, fileName);
  const records = [
    { sessionId, payload: { type: 'session_meta', cwd } },
    ...messages.map(({ role = 'assistant', content }) => ({
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

describe('observeCatchUp', () => {
  test('builds a catch-up digest from the prior offset and only rewrites changed state', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/observe-prior-offset';
      const transcriptPath = await writeClaudeTranscript(
        home,
        cwd,
        'observe-prior.jsonl',
        'observe-prior',
        [
          { role: 'user', content: 'first question' },
          { role: 'assistant', content: 'first answer' },
        ],
      );
      const { observeCatchUp } = await importObserve();

      const first = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-prior',
      });

      assert.equal(first.ok, true);
      assert.equal(first.digest.mode, 'catch-up');
      assert.equal(first.digest.range.fromIndex, 0);
      assert.equal(first.digest.range.nextIndex, 2);
      assert.equal(first.markedRead, true);

      const statePath = join(stateDir, 'state.json');
      const afterFirst = await readFile(statePath, 'utf8');

      const second = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-prior',
      });

      assert.equal(second.ok, true);
      assert.equal(second.digest.transcriptPath, transcriptPath);
      assert.equal(second.digest.range.fromIndex, 2);
      assert.equal(second.digest.range.newRecords, 0);
      assert.equal(second.markedRead, false);
      assert.equal(await readFile(statePath, 'utf8'), afterFirst);
    });
  });

  test('uses snippet filtering before ranking candidates', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/observe-snippet';
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-snippet-a.jsonl',
        'observe-snippet-a',
        [{ content: 'ordinary candidate' }],
      );
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-snippet-b.jsonl',
        'observe-snippet-b',
        [{ content: 'needle phrase from the selected session' }],
      );
      const { observeCatchUp } = await importObserve();

      const result = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        snippet: 'needle phrase',
      });

      assert.equal(result.ok, true);
      assert.equal(result.digest.sessionId, 'observe-snippet-b');
      assert.ok(
        result.digest.warnings.some((w) =>
          w.includes('Selected session by snippet match'),
        ),
        'snippet-selected digest should retain the existing warning',
      );
    });
  });

  test('returns a no-match outcome without exiting the process', async () => {
    await withTempSessionHome(async () => {
      const { observeCatchUp } = await importObserve();

      const result = await observeCatchUp({
        runtime: 'claude-code',
        cwd: '/test/no-transcripts',
      });

      assert.equal(result.ok, false);
      assert.equal(result.kind, 'noMatch');
      assert.equal(result.exitCode, 2);
      assert.equal(result.payload.noMatch, true);
    });
  });

  test('returns ties as an input-needed outcome', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/observe-ties';
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-tie-a.jsonl',
        'observe-tie-a',
        [{ content: 'candidate a' }],
      );
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-tie-b.jsonl',
        'observe-tie-b',
        [{ content: 'candidate b' }],
      );
      const { observeCatchUp } = await importObserve();

      const result = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
      });

      assert.equal(result.ok, false);
      assert.equal(result.kind, 'ties');
      assert.equal(result.exitCode, 3);
      assert.equal(result.payload.ties, true);
      assert.equal(result.payload.candidates.length, 2);
    });
  });

  test('returns ambiguous runtime details for auto runtime conflicts', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/observe-auto-ambiguous';
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-auto-claude.jsonl',
        'observe-auto-claude',
        [{ content: 'claude candidate' }],
      );
      await writeCodexTranscript(
        home,
        cwd,
        'observe-auto-codex.jsonl',
        'observe-auto-codex',
        [{ content: 'codex candidate' }],
      );
      const { observeCatchUp } = await importObserve();

      const result = await observeCatchUp({
        runtime: 'auto',
        cwd,
      });

      assert.equal(result.ok, false);
      assert.equal(result.kind, 'ambiguousRuntime');
      assert.equal(result.exitCode, 3);
      assert.deepEqual(result.payload.runtimes.sort(), [
        'claude-code',
        'codex',
      ]);
    });
  });
});
