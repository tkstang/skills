/**
 * observe.test.ts — tests for the reusable catch-up observation pipeline.
 */

import {
  appendFile,
  mkdtemp,
  rm,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, describe, test } from 'vitest';

import {
  getCursorSession,
  mutateCursorState,
} from '../../src/transcript/session-observer/lib/cursor-state.js';
import { renderMarkdown } from '../../src/transcript/session-observer/lib/digest.js';
import { observeCatchUp } from '../../src/transcript/session-observer/lib/observe.js';

function claudeSlug(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

function cursorSlug(cwd: string): string {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

async function withTempSessionHome(
  fn: (home: string, stateDir: string) => Promise<void>,
): Promise<void> {
  const home = await realpath(
    await mkdtemp(join(tmpdir(), 'observe-test-home-')),
  );
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

type CursorFixtureFrame = Record<string, unknown> | string;

async function writeCursorTranscript(
  home: string,
  cwd: string,
  sessionId: string,
  frames: CursorFixtureFrame[],
  { trailingNewline = true }: { trailingNewline?: boolean } = {},
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
  const body = frames
    .map((frame) => (typeof frame === 'string' ? frame : JSON.stringify(frame)))
    .join('\n');
  await writeFile(
    transcriptPath,
    `${body}${trailingNewline ? '\n' : ''}`,
    'utf8',
  );
  return transcriptPath;
}

async function injectLegacyStateWriteFailure(
  stateDir: string,
): Promise<string> {
  const statePath = join(stateDir, 'state.json');
  await mkdir(statePath);
  return statePath;
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

  test('advances legacy state before returning output for the caller to render', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/observe-output-order';
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-output-order.jsonl',
        'observe-output-order',
        [
          { role: 'user', content: 'Synthetic direction.' },
          { role: 'assistant', content: 'Synthetic response.' },
        ],
      );

      const events: string[] = [];
      const result = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-output-order',
      });
      events.push('observe-returned');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      const state = JSON.parse(
        await readFile(join(stateDir, 'state.json'), 'utf8'),
      );
      events.push('state-observed');
      const rendered = renderMarkdown(result.digest);
      events.push('caller-rendered');

      expect(result.markedRead).toBe(true);
      expect(
        state.sessions['claude-code:observe-output-order'].lastRecordIndex,
      ).toBe(result.digest.range.nextIndex);
      expect(rendered).toContain('Synthetic response.');
      expect(events).toEqual([
        'observe-returned',
        'state-observed',
        'caller-rendered',
      ]);
    });
  });

  test('returns an output-ready legacy digest when state mutation fails', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/observe-state-failure';
      await writeClaudeTranscript(
        home,
        cwd,
        'observe-state-failure.jsonl',
        'observe-state-failure',
        [
          { role: 'user', content: 'Synthetic direction.' },
          { role: 'assistant', content: 'Synthetic response survives.' },
        ],
      );
      const failedStatePath = await injectLegacyStateWriteFailure(stateDir);

      const result = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-state-failure',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      expect(result.markedRead).toBe(false);
      expect(renderMarkdown(result.digest)).toContain(
        'Synthetic response survives.',
      );
      await expect(readFile(failedStatePath)).rejects.toMatchObject({
        code: 'EISDIR',
      });
    });
  });

  test('builds reusable Cursor frame fixtures including malformed and partial tails', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = '/test/observe-cursor-fixture';
      const transcriptPath = await writeCursorTranscript(
        home,
        cwd,
        'observe-cursor-fixture',
        [
          {
            role: 'user',
            message: {
              content: [{ type: 'text', text: 'Synthetic direction.' }],
            },
          },
          '{"malformed":',
          '{"role":"assistant","message":{"content":"Synthetic partial',
        ],
        { trailingNewline: false },
      );

      const raw = await readFile(transcriptPath, 'utf8');
      expect(transcriptPath).toContain(
        join(
          '.cursor',
          'projects',
          cursorSlug(cwd),
          'agent-transcripts',
          'observe-cursor-fixture',
        ),
      );
      expect(raw.split('\n')).toHaveLength(3);
      expect(raw).toContain('Synthetic direction.');
      expect(raw).toContain('{"malformed":');
      expect(raw.endsWith('Synthetic partial')).toBe(true);
    });
  });

  test('reserves a stable pinned Cursor observation until its caller commits delivery', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = join(home, 'workspace', 'observe-cursor-pending');
      await mkdir(cwd, { recursive: true });
      const sessionId = 'observe-cursor-pending';
      const transcriptPath = await writeCursorTranscript(home, cwd, sessionId, [
        {
          role: 'user',
          message: {
            content: [{ type: 'text', text: 'Synthetic direction.' }],
          },
        },
        {
          role: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Synthetic stable observation.' }],
          },
        },
      ]);

      let scanCount = 0;
      const result = await observeCatchUp(
        {
          runtime: 'cursor',
          cwd,
          session: `cursor:${sessionId}`,
          debounceSec: 0,
        },
        {
          now: () => Date.parse('2026-07-22T00:00:00.000Z'),
          sleep: async () => undefined,
          ownerPid: 7101,
          onCursorScan: () => {
            scanCount += 1;
          },
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok || result.runtime !== 'cursor') {
        throw new Error(result.ok ? 'expected Cursor result' : result.message);
      }
      expect(scanCount).toBe(2);
      expect(result.digest.schemaVersion).toBe(2);
      expect(result.digest.entries.map((entry) => entry.text)).toEqual([
        'Synthetic stable observation.',
      ]);
      expect(result.digest.cursorEvidence.status.delivery).toBe('reserved');
      expect(result.delivery).not.toBeNull();
      expect((await getCursorSession(sessionId))?.lastRecordIndex).toBe(0);

      await expect(result.delivery!.commit()).resolves.toBe('committed');
      expect((await getCursorSession(sessionId))?.lastRecordIndex).toBe(2);
      expect((await getCursorSession(sessionId))?.openTurn).not.toBeNull();
      await expect(result.delivery!.commit()).rejects.toThrow(
        'CURSOR_DELIVERY_ALREADY_FINALIZED',
      );

      await appendFile(
        transcriptPath,
        `${JSON.stringify({ type: 'turn_ended', status: 'success' })}\n`,
        'utf8',
      );
      const completed = await observeCatchUp(
        { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
        { ownerPid: 7101 },
      );
      expect(completed.ok).toBe(true);
      if (!completed.ok || completed.runtime !== 'cursor') {
        throw new Error(
          completed.ok ? 'expected Cursor result' : completed.message,
        );
      }
      expect(completed.digest.entries).toEqual([]);
      expect(completed.digest.cursorEvidence.lifecycleEvents).toMatchObject([
        {
          lifecycle: 'success',
          contentPreviouslyObservable: true,
        },
      ]);
      await expect(completed.delivery!.abandon()).resolves.toBe('abandoned');
      expect((await getCursorSession(sessionId))?.lastRecordIndex).toBe(2);

      const retriedCompletion = await observeCatchUp(
        { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
        { ownerPid: 7101 },
      );
      expect(retriedCompletion.ok).toBe(true);
      if (!retriedCompletion.ok || retriedCompletion.runtime !== 'cursor') {
        throw new Error(
          retriedCompletion.ok
            ? 'expected Cursor result'
            : retriedCompletion.message,
        );
      }
      await retriedCompletion.delivery!.commit();
      expect((await getCursorSession(sessionId))?.openTurn).toBeNull();
    });
  });

  test('delivers the confirmed Cursor prefix while retaining growth from its confirmation interval', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = join(home, 'workspace', 'observe-cursor-prefix-growth');
      await mkdir(cwd, { recursive: true });
      const sessionId = 'observe-cursor-prefix-growth';
      const transcriptPath = await writeCursorTranscript(home, cwd, sessionId, [
        {
          role: 'user',
          message: {
            content: [{ type: 'text', text: 'Bound the stable prefix.' }],
          },
        },
        {
          role: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Frame A is stable.' }],
          },
        },
      ]);
      const prefixBytes = Buffer.byteLength(
        await readFile(transcriptPath, 'utf8'),
      );
      const laterMetadata = JSON.stringify({
        type: 'metadata',
        note: 'safe bytes after frame A',
      });
      let nowMs = Date.parse('2026-07-22T01:00:00.000Z');
      let appended = false;

      const first = await observeCatchUp(
        {
          runtime: 'cursor',
          cwd,
          session: `cursor:${sessionId}`,
          debounceSec: 0.1,
        },
        {
          now: () => nowMs,
          sleep: async (ms: number) => {
            nowMs += ms;
            if (appended) return;
            appended = true;
            await appendFile(
              transcriptPath,
              `${laterMetadata}\n${JSON.stringify({
                role: 'assistant',
                message: {
                  content: [{ type: 'text', text: 'Frame B arrived later.' }],
                },
              })}\n`,
              'utf8',
            );
          },
          ownerPid: 7102,
        },
      );

      expect(appended).toBe(true);
      expect(first.ok).toBe(true);
      if (!first.ok || first.runtime !== 'cursor') {
        throw new Error(first.ok ? 'expected Cursor result' : first.message);
      }
      expect(first.digest.entries.map((entry) => entry.text)).toEqual([
        'Frame A is stable.',
      ]);
      expect(first.digest.range).toMatchObject({
        fromIndex: 0,
        toIndex: 2,
        nextIndex: 3,
        totalFrames: 4,
      });
      expect(first.digest.accounting.buffered).toEqual({
        fromIndex: 3,
        count: 1,
        reason: 'stability-wait',
      });
      expect(first.delivery).not.toBeNull();
      expect(
        (await getCursorSession(sessionId))?.pendingDelivery
          ?.intendedCheckpoint,
      ).toMatchObject({
        nextFrameIndex: 3,
        prefixBytes: prefixBytes + Buffer.byteLength(`${laterMetadata}\n`),
        observedSize: prefixBytes + Buffer.byteLength(`${laterMetadata}\n`),
      });

      await expect(first.delivery!.commit()).resolves.toBe('committed');
      expect(
        (await getCursorSession(sessionId))?.stabilityCandidate,
      ).toMatchObject({
        entryKeys: [expect.any(String), expect.any(String)],
        throughFrameIndex: 3,
        confirmedAt: null,
      });

      nowMs += 100;
      const second = await observeCatchUp(
        {
          runtime: 'cursor',
          cwd,
          session: `cursor:${sessionId}`,
          debounceSec: 0.1,
        },
        {
          now: () => nowMs,
          sleep: async () => {
            throw new Error('the retained candidate is already due');
          },
          ownerPid: 7102,
        },
      );
      expect(second.ok).toBe(true);
      if (!second.ok || second.runtime !== 'cursor') {
        throw new Error(second.ok ? 'expected Cursor result' : second.message);
      }
      expect(second.digest.entries.map((entry) => entry.text)).toEqual([
        'Frame B arrived later.',
      ]);
      expect(second.digest.range).toMatchObject({
        fromIndex: 3,
        toIndex: 3,
        nextIndex: 4,
      });
      await expect(second.delivery!.commit()).resolves.toBe('committed');
      expect((await getCursorSession(sessionId))?.lastRecordIndex).toBe(4);
    });
  });

  test('blocks Cursor continuity mismatch without mutating its committed checkpoint', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = join(home, 'workspace', 'observe-cursor-continuity');
      await mkdir(cwd, { recursive: true });
      const sessionId = 'observe-cursor-continuity';
      const transcriptPath = await writeCursorTranscript(home, cwd, sessionId, [
        {
          role: 'user',
          message: { content: [{ type: 'text', text: 'Original direction.' }] },
        },
        {
          role: 'assistant',
          message: { content: [{ type: 'text', text: 'Original response.' }] },
        },
        { type: 'turn_ended', status: 'success' },
      ]);
      const first = await observeCatchUp(
        { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
        { ownerPid: 7102 },
      );
      expect(first.ok).toBe(true);
      if (!first.ok || first.runtime !== 'cursor' || first.delivery === null) {
        throw new Error('expected reserved Cursor delivery');
      }
      await first.delivery.commit();
      const committed = await getCursorSession(sessionId);

      const raw = await readFile(transcriptPath, 'utf8');
      await writeFile(
        transcriptPath,
        raw.replace('Original direction.', 'Xriginal direction.'),
        'utf8',
      );
      const blocked = await observeCatchUp(
        { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
        { ownerPid: 7102 },
      );

      expect(blocked).toMatchObject({
        ok: false,
        kind: 'continuityBlocked',
        payload: { continuityBlocked: true, code: 'PREFIX_MISMATCH' },
      });
      expect(await getCursorSession(sessionId)).toEqual(committed);
    });
  });

  test.each([
    ['success', 'Synthetic final answer.', 'success'],
    ['error', 'Synthetic failed draft.', 'error'],
  ] as const)(
    'reconciles Cursor %s lifecycle only after delivery commit',
    async (terminalStatus, assistantText, expectedLifecycle) => {
      await withTempSessionHome(async (home) => {
        const cwd = join(home, 'workspace', `observe-cursor-${terminalStatus}`);
        await mkdir(cwd, { recursive: true });
        const sessionId = `observe-cursor-${terminalStatus}`;
        await writeCursorTranscript(home, cwd, sessionId, [
          {
            role: 'user',
            message: {
              content: [{ type: 'text', text: 'Synthetic direction.' }],
            },
          },
          {
            role: 'assistant',
            message: { content: [{ type: 'text', text: assistantText }] },
          },
          { type: 'turn_ended', status: terminalStatus },
        ]);

        const result = await observeCatchUp(
          { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
          { ownerPid: terminalStatus === 'success' ? 7103 : 7104 },
        );

        expect(result.ok).toBe(true);
        if (!result.ok || result.runtime !== 'cursor') {
          throw new Error(
            result.ok ? 'expected Cursor result' : result.message,
          );
        }
        expect(result.digest.cursorEvidence.status.lifecycle).toBe(
          expectedLifecycle,
        );
        expect(result.digest.entries.map((entry) => entry.text)).toEqual(
          terminalStatus === 'success' ? [assistantText] : [],
        );
        expect(result.delivery).not.toBeNull();
        expect(
          (await getCursorSession(sessionId))?.pendingDelivery,
        ).not.toBeNull();
        await result.delivery!.commit();
        expect(await getCursorSession(sessionId)).toMatchObject({
          lastRecordIndex: 3,
          openTurn: null,
          pendingDelivery: null,
          lastStatus: { lifecycle: expectedLifecycle, delivery: 'committed' },
        });
      });
    },
  );

  test('surfaces owner conflict and crash replay keys without advancing state', async () => {
    await withTempSessionHome(async (home) => {
      const cwd = join(home, 'workspace', 'observe-cursor-crash');
      await mkdir(cwd, { recursive: true });
      const sessionId = 'observe-cursor-crash';
      await writeCursorTranscript(home, cwd, sessionId, [
        {
          role: 'user',
          message: {
            content: [{ type: 'text', text: 'Synthetic direction.' }],
          },
        },
        {
          role: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Crash-window answer.' }],
          },
        },
        { type: 'turn_ended', status: 'success' },
      ]);
      const first = await observeCatchUp(
        { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
        { ownerPid: 7105 },
      );
      expect(first.ok).toBe(true);
      if (!first.ok || first.runtime !== 'cursor' || first.delivery === null) {
        throw new Error('expected reserved Cursor delivery');
      }
      const entryKeys = first.delivery.entryKeys;

      await mutateCursorState((state) => {
        const pending = state.sessions[`cursor:${sessionId}`]?.pendingDelivery;
        if (pending) pending.reservedByPid = 9999;
      });
      await expect(first.delivery.abandon()).resolves.toBe('owner-conflict');

      const replay = await observeCatchUp(
        { runtime: 'cursor', cwd, session: `cursor:${sessionId}` },
        { ownerPid: 7106 },
      );
      expect(replay.ok).toBe(true);
      if (!replay.ok || replay.runtime !== 'cursor') {
        throw new Error(replay.ok ? 'expected Cursor result' : replay.message);
      }
      expect(replay.delivery).toBeNull();
      expect(replay.deliveryUncertain?.entryKeys).toEqual(entryKeys);
      expect(replay.digest.entries.map((entry) => entry.entryKey)).toEqual(
        entryKeys,
      );
      expect(replay.digest.cursorEvidence.status.delivery).toBe('uncertain');
      expect((await getCursorSession(sessionId))?.lastRecordIndex).toBe(0);
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
