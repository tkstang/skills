/**
 * observe.test.ts — tests for the reusable catch-up observation pipeline.
 */

import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, describe, test } from 'vitest';

import { observeCatchUp } from '../../src/transcript/session-observer/lib/observe.js';

function claudeSlug(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

async function withTempSessionHome(
  fn: (home: string, stateDir: string) => Promise<void>,
): Promise<void> {
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

async function writeClaudeTranscript(
  home: string,
  cwd: string,
  fileName: string,
  sessionId: string,
  messages: Array<{ role?: string; content: unknown }>,
): Promise<string> {
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

async function writeCodexTranscript(
  home: string,
  cwd: string,
  fileName: string,
  sessionId: string,
  messages: Array<{ role?: string; content: unknown }>,
): Promise<string> {
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
      const first: any = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-prior',
      });

      expect(first.ok).toBe(true);
      expect(first.digest.mode).toBe('catch-up');
      expect(first.digest.range.fromIndex).toBe(0);
      expect(first.digest.range.nextIndex).toBe(2);
      expect(first.markedRead).toBe(true);

      const statePath = join(stateDir, 'state.json');
      const afterFirst = await readFile(statePath, 'utf8');

      const second: any = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-prior',
      });

      expect(second.ok).toBe(true);
      expect(second.digest.transcriptPath).toBe(transcriptPath);
      expect(second.digest.range.fromIndex).toBe(2);
      expect(second.digest.range.newRecords).toBe(0);
      expect(second.markedRead).toBe(false);
      expect(await readFile(statePath, 'utf8')).toBe(afterFirst);
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
      const result: any = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        snippet: 'needle phrase',
      });

      expect(result.ok).toBe(true);
      expect(result.digest.sessionId).toBe('observe-snippet-b');
      expect(
        result.digest.warnings.some((w: string) =>
          w.includes('Selected session by snippet match'),
        ),
        'snippet-selected digest should retain the existing warning',
      ).toBeTruthy();
    });
  });

  test('returns a no-match outcome without exiting the process', async () => {
    await withTempSessionHome(async () => {
      const result: any = await observeCatchUp({
        runtime: 'claude-code',
        cwd: '/test/no-transcripts',
      });

      expect(result.ok).toBe(false);
      expect(result.kind).toBe('noMatch');
      expect(result.exitCode).toBe(2);
      expect(result.payload.noMatch).toBe(true);
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
      const result: any = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
      });

      expect(result.ok).toBe(false);
      expect(result.kind).toBe('ties');
      expect(result.exitCode).toBe(3);
      expect(result.payload.ties).toBe(true);
      expect(result.payload.candidates).toBeTruthy();
      expect(result.payload.candidates.length).toBe(2);
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
      const result: any = await observeCatchUp({
        runtime: 'auto',
        cwd,
      });

      expect(result.ok).toBe(false);
      expect(result.kind).toBe('ambiguousRuntime');
      expect(result.exitCode).toBe(3);
      expect(result.payload.runtimes).toBeTruthy();
      expect(result.payload.runtimes.toSorted()).toEqual([
        'claude-code',
        'codex',
      ]);
    });
  });
});
