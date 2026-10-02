import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  claudeAssistant,
  claudeToolResult,
  claudeUser,
  codexMessage,
  codexSessionMeta,
  codexToolOutput,
  cursorAssistant,
  cursorTurnEnded,
  cursorUser,
  DAY_MS,
  HOUR_MS,
  makeTempHome,
  searchEnv,
  writeClaudeHistory,
  writeClaudeSession,
  writeCodexRollout,
  writeCursorTranscript,
  type TempHome,
} from '../helpers/test-helpers.js';
import { resolveOptions, type RawOptionValues } from './options.js';
import { estimate, runSearch } from './pipeline.js';

const NOW = Date.now();
const PARENT = '019a0000-0000-7000-8000-000000000101';
const CHILD = '019a0000-0000-7000-8000-000000000102';
const OTHER = '019a0000-0000-7000-8000-000000000103';

let temp: TempHome;

beforeEach(() => {
  temp = makeTempHome('session-search-pipeline-');
});

afterEach(() => {
  temp.cleanup();
});

function search(raw: RawOptionValues) {
  const options = resolveOptions(raw, {
    home: temp.home,
    cwd: temp.home,
    now: NOW,
  });
  return runSearch(options, { home: temp.home, env: searchEnv(temp) });
}

/** A Claude session with the target phrase typed by the user. */
function claudeTarget(cwd = '/work/target', mtimeMs = NOW - HOUR_MS) {
  return writeClaudeSession(temp.home, {
    cwd,
    mtimeMs,
    records: (e) => [
      claudeUser(e, 'can we vet the Perceive Now idea?'),
      claudeAssistant(e, 'Sure, looking at it.'),
    ],
  });
}

describe('runSearch', () => {
  it('ranks a cross-runtime target first in a valid v1 result', async () => {
    const target = claudeTarget();
    writeCodexRollout(temp.home, {
      id: OTHER,
      startedAtMs: NOW - 2 * HOUR_MS,
      records: [
        codexSessionMeta({ id: OTHER, cwd: '/work/other' }),
        codexMessage('assistant', 'perceive now came up briefly', 1),
      ],
    });
    writeCursorTranscript(temp.home, {
      cwd: '/work/cursor',
      mtimeMs: NOW - 3 * HOUR_MS,
      records: [
        cursorUser('unrelated'),
        cursorAssistant('nothing here'),
        cursorTurnEnded(),
      ],
    });

    const result = await search({ pattern: ['perceive ?now'] });

    expect(result.schema).toBe('session-search/v1');
    expect(
      result.sources.map((source) => [source.runtime, source.status]),
    ).toEqual([
      ['claude-code', 'ok'],
      ['codex', 'ok'],
      ['cursor', 'ok'],
    ]);
    expect(result.results.map((hit) => [hit.runtime, hit.sessionId])).toEqual([
      ['claude-code', target.sessionId],
      ['codex', OTHER],
    ]);
    expect(result.results[0]).toMatchObject({
      rank: 1,
      cwd: '/work/target',
      firstPrompt: 'can we vet the Perceive Now idea?',
      matchedTiers: ['content'],
      open: {
        command: `claude --resume ${target.sessionId}`,
        hint: 'run from /work/target',
      },
    });
    expect(result.tiersRun).toEqual(['history', 'meta', 'content']);
    expect(result.widened).toBe(false);
    expect(result.needsConfirmation).toBeNull();
    expect(result.tools).toEqual({ rg: null, sqlite3: null });
    expect(result.diagnostics.filesScanned).toBe(3);
  });

  it('excludes sessions outside the time window', async () => {
    claudeTarget('/work/old', NOW - 30 * DAY_MS);
    const recent = claudeTarget('/work/new', NOW - HOUR_MS);

    const windowed = await search({ pattern: ['perceive now'], since: '7d' });
    const unwindowed = await search({ pattern: ['perceive now'] });

    expect(windowed.results.map((hit) => hit.sessionId)).toEqual([
      recent.sessionId,
    ]);
    expect(unwindowed.results).toHaveLength(2);
  });

  it('widens when the cwd-hinted pass finds nothing', async () => {
    const target = claudeTarget('/work/target');
    writeClaudeSession(temp.home, {
      cwd: '/work/hinted',
      records: (e) => [claudeUser(e, 'something else entirely')],
    });

    const miss = await search({
      pattern: ['perceive now'],
      cwd: ['/work/hinted'],
    });
    const hit = await search({
      pattern: ['perceive now'],
      cwd: ['/work/target'],
    });

    expect(miss.widened).toBe(true);
    expect(miss.results.map((result) => result.sessionId)).toEqual([
      target.sessionId,
    ]);
    expect(hit.widened).toBe(false);
    expect(hit.results.map((result) => result.sessionId)).toEqual([
      target.sessionId,
    ]);
  });

  it('finds a Codex tool-only phrase only through the deep rung', async () => {
    writeCodexRollout(temp.home, {
      id: PARENT,
      startedAtMs: NOW - HOUR_MS,
      records: [
        codexSessionMeta({ id: PARENT, cwd: '/work/repo' }),
        codexMessage('user', 'list my chat threads', 1),
        codexToolOutput(
          'function_call_output',
          'call_1',
          [
            {
              type: 'input_text',
              text: 'ChatGPT thread: Perceive Now vetting',
            },
          ],
          2,
        ),
      ],
    });

    const deep = await search({ pattern: ['perceive now'] });
    const noDeep = await search({ pattern: ['perceive now'], 'no-deep': true });

    expect(deep.tiersRun).toEqual(['history', 'meta', 'content', 'deep']);
    expect(deep.results).toHaveLength(1);
    expect(deep.results[0]).toMatchObject({
      sessionId: PARENT,
      matchedTiers: ['deep'],
    });
    expect(deep.results[0].snippets[0]).toMatchObject({
      role: 'tool',
      tier: 'deep',
    });
    expect(noDeep.tiersRun).not.toContain('deep');
    expect(noDeep.results).toEqual([]);
  });

  it('finds a Claude tool_result phrase only through the deep rung', async () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeUser(e, 'show me the threads'),
        claudeToolResult(e, 'toolu_1', 'thread list: Perceive Now vetting'),
      ],
    });

    const deep = await search({ pattern: ['perceive now'] });
    const noDeep = await search({ pattern: ['perceive now'], 'no-deep': true });

    expect(
      deep.results.map((hit) => [hit.sessionId, hit.matchedTiers]),
    ).toEqual([[session.sessionId, ['deep']]]);
    expect(noDeep.results).toEqual([]);
  });

  it('does not duplicate parent hits through inherited child records', async () => {
    writeCodexRollout(temp.home, {
      id: PARENT,
      startedAtMs: NOW - 2 * HOUR_MS,
      records: [
        codexSessionMeta({ id: PARENT, cwd: '/work/repo' }),
        codexMessage('user', 'please vet perceive now', 1),
      ],
    });
    writeCodexRollout(temp.home, {
      id: CHILD,
      startedAtMs: NOW - HOUR_MS,
      records: [
        codexSessionMeta({
          id: CHILD,
          sessionId: PARENT,
          cwd: '/work/repo',
          subagentHistoryStartOrdinal: 3,
        }),
        codexSessionMeta({ id: PARENT, cwd: '/work/repo' }, 1),
        codexMessage('user', 'please vet perceive now', 2),
        codexMessage('assistant', 'child work without the phrase', 3),
      ],
    });

    const result = await search({ pattern: ['perceive now'] });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].sessionId).toBe(PARENT);
    expect(
      result.results[0].snippets.some((snippet) => snippet.via === 'subagent'),
    ).toBe(false);
  });

  it('restricts content to cheap-tier hits when the scan is large', async () => {
    const target = claudeTarget('/work/target');
    writeClaudeHistory(temp.home, [
      {
        display: 'vet perceive now please',
        project: '/work/target',
        sessionId: target.sessionId,
        timestamp: NOW - HOUR_MS,
      },
    ]);
    const contentOnly = writeClaudeSession(temp.home, {
      cwd: '/work/big',
      records: (e) => [
        claudeUser(e, 'perceive now appears only in content'),
        ...Array.from({ length: 20 }, () =>
          claudeAssistant(e, 'z'.repeat(1000)),
        ),
      ],
    });

    const guarded = await search({
      pattern: ['perceive now'],
      'large-scan-bytes': '8000',
    });
    const allowed = await search({
      pattern: ['perceive now'],
      'large-scan-bytes': '8000',
      'allow-large-scan': true,
    });

    expect(guarded.needsConfirmation).toMatchObject({
      reason: 'large-scan',
      fileCount: 2,
      rerunFlag: '--allow-large-scan',
    });
    expect(
      guarded.results.map((hit) => [hit.sessionId, hit.matchedTiers]),
    ).toEqual([[target.sessionId, ['history', 'content']]]);
    expect(guarded.diagnostics.filesScanned).toBe(1);
    expect(allowed.needsConfirmation).toBeNull();
    expect(allowed.results.map((hit) => hit.sessionId).toSorted()).toEqual(
      [target.sessionId, contentOnly.sessionId].toSorted(),
    );
  });

  it('skips content and deep scans when the cheap-hit files alone are too large', async () => {
    const target = claudeTarget('/work/target');
    writeClaudeHistory(temp.home, [
      {
        display: 'vet perceive now please',
        project: '/work/target',
        sessionId: target.sessionId,
        timestamp: NOW - HOUR_MS,
      },
    ]);

    const guarded = await search({
      pattern: ['perceive now'],
      'large-scan-bytes': '10',
    });
    const allowed = await search({
      pattern: ['perceive now'],
      'large-scan-bytes': '10',
      'allow-large-scan': true,
    });

    expect(guarded.needsConfirmation).not.toBeNull();
    expect(guarded.diagnostics.filesScanned).toBe(0);
    expect(guarded.tiersRun).toEqual(['history', 'meta']);
    expect(guarded.results.map((hit) => hit.matchedTiers)).toEqual([
      ['history'],
    ]);
    expect(allowed.diagnostics.filesScanned).toBe(1);
    expect(allowed.results[0].matchedTiers).toEqual(['history', 'content']);
  });

  it('reports zero results plus needsConfirmation when the deep rung is guarded', async () => {
    claudeTarget('/work/target');

    const result = await search({
      pattern: ['absent phrase'],
      'large-scan-bytes': '10',
    });

    expect(result.results).toEqual([]);
    expect(result.needsConfirmation).not.toBeNull();
    expect(result.diagnostics.filesScanned).toBe(0);
  });

  it('finds and labels archived Codex sessions', async () => {
    writeCodexRollout(temp.home, {
      id: OTHER,
      archived: true,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: OTHER, cwd: '/work/old' }),
        codexMessage('user', 'archived perceive now chat', 1),
      ],
    });

    const result = await search({ pattern: ['perceive now'] });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      runtime: 'codex',
      sessionId: OTHER,
      archived: true,
      open: { command: `codex resume ${OTHER}` },
    });
  });

  it('reports every source absent when no stores exist', async () => {
    const result = await search({ pattern: ['perceive now'] });

    expect(result.results).toEqual([]);
    expect(result.sources.map((source) => source.status)).toEqual([
      'absent',
      'absent',
      'absent',
    ]);
  });
});

describe('estimate', () => {
  it('counts files and bytes per runtime inside the window', async () => {
    claudeTarget('/work/new', NOW - HOUR_MS);
    claudeTarget('/work/old', NOW - 30 * DAY_MS);
    const options = resolveOptions(
      { since: '7d' },
      { home: temp.home, cwd: temp.home, now: NOW },
    );

    const result = await estimate(options, {
      home: temp.home,
      env: searchEnv(temp),
    });

    const claude = result.runtimes.find(
      (entry) => entry.runtime === 'claude-code',
    );
    expect(claude).toMatchObject({ status: 'ok', files: 1, sessions: 1 });
    expect(claude?.bytes).toBeGreaterThan(0);
    expect(result.totalFiles).toBe(1);
    expect(result.exceedsLargeScan).toBe(false);
  });
});
