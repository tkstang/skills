import { statSync, utimesSync } from 'node:fs';
import path from 'node:path';

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
  writeExecutable,
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

function search(raw: RawOptionValues, extraEnv: Record<string, string> = {}) {
  const options = resolveOptions(raw, {
    home: temp.home,
    cwd: temp.home,
    now: NOW,
  });
  return runSearch(options, {
    home: temp.home,
    env: searchEnv(temp, extraEnv),
  });
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

  it('finds a phrase in JSON-encoded Codex tool objects only on the deep rung', async () => {
    writeCodexRollout(temp.home, {
      id: PARENT,
      startedAtMs: NOW - HOUR_MS,
      records: [
        codexSessionMeta({ id: PARENT, cwd: '/work/repo' }),
        codexMessage('user', 'list my chat threads', 1),
        codexToolOutput(
          'function_call_output',
          'call_1',
          JSON.stringify([{ title: 'Perceive Now vetting', id: 1 }]),
          2,
        ),
      ],
    });

    const deep = await search({ pattern: ['perceive now'] });
    const noDeep = await search({ pattern: ['perceive now'], 'no-deep': true });

    expect(
      deep.results.map((hit) => [hit.sessionId, hit.matchedTiers]),
    ).toEqual([[PARENT, ['deep']]]);
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

  it('never matches text that exists only in a child inherited range', async () => {
    writeCodexRollout(temp.home, {
      id: PARENT,
      startedAtMs: NOW - 2 * HOUR_MS,
      records: [
        codexSessionMeta({ id: PARENT, cwd: '/work/repo' }),
        codexMessage('user', 'parent text without the phrase', 1),
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
        codexMessage('user', 'inherited-only zebra phrase', 2),
        codexMessage('assistant', 'child work', 3),
      ],
    });

    const result = await search({ pattern: ['zebra phrase'] });

    expect(result.results).toEqual([]);
    expect(result.tiersRun).toContain('deep');
  });

  it('drops cheap-tier hits for sessions whose transcript is outside --since', async () => {
    const old = writeClaudeSession(temp.home, {
      cwd: '/work/old',
      mtimeMs: NOW - 30 * DAY_MS,
      records: (e) => [claudeUser(e, 'ancient zebra chat')],
    });
    writeClaudeHistory(temp.home, [
      {
        display: 'ancient zebra chat',
        project: '/work/old',
        sessionId: old.sessionId,
        timestamp: NOW - HOUR_MS,
      },
    ]);

    const windowed = await search({ pattern: ['zebra'], since: '7d' });
    const unwindowed = await search({ pattern: ['zebra'] });

    expect(windowed.results).toEqual([]);
    expect(unwindowed.results.map((hit) => hit.sessionId)).toEqual([
      old.sessionId,
    ]);
  });

  it('widens even when an out-of-scope history hit exists', async () => {
    const other = writeClaudeSession(temp.home, {
      cwd: '/work/other',
      records: (e) => [claudeUser(e, 'zebra in another repo')],
    });
    writeClaudeSession(temp.home, {
      cwd: '/work/hinted',
      records: (e) => [claudeUser(e, 'nothing relevant')],
    });
    writeClaudeHistory(temp.home, [
      {
        display: 'zebra in another repo',
        project: '/work/other',
        sessionId: other.sessionId,
        timestamp: NOW - HOUR_MS,
      },
    ]);

    const result = await search({ pattern: ['zebra'], cwd: ['/work/hinted'] });

    expect(result.widened).toBe(true);
    expect(result.results.map((hit) => hit.sessionId)).toEqual([
      other.sessionId,
    ]);
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

describe.skipIf(process.platform === 'win32')('runSearch deadline', () => {
  it('stops a hanging rg prefilter at --deadline-ms and reports incomplete', async () => {
    claudeTarget('/work/target');
    const rg = writeExecutable(
      path.join(temp.root, 'bin', 'rg'),
      '#!/bin/sh\ncase "$1" in --version) echo "ripgrep stub"; exit 0 ;; esac\nexec sleep 30\n',
    );

    const started = Date.now();
    const result = await search(
      { pattern: ['perceive'], 'deadline-ms': '700' },
      { SESSION_SEARCH_RG: rg },
    );

    expect(result.tools.rg).toBe(rg);
    expect(result.incomplete).toBe(true);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});

describe('runSearch with an expired deadline', () => {
  it('reports a cwd-hinted run incomplete without scoping reads or widening', async () => {
    const hinted = writeClaudeSession(temp.home, {
      cwd: '/work/hinted',
      records: (e) => [claudeUser(e, 'zebra here')],
    });
    // atime older than mtime, so a read during scoping would refresh it.
    const atime = (NOW - 2 * DAY_MS) / 1000;
    utimesSync(hinted.path, atime, (NOW - HOUR_MS) / 1000);
    const atimeBefore = statSync(hinted.path).atimeMs;
    const options = {
      ...resolveOptions(
        { pattern: ['zebra'], cwd: ['/work/hinted'] },
        { home: temp.home, cwd: temp.home, now: NOW },
      ),
      // Already expired when the pipeline starts.
      deadlineMs: 0,
    };

    const result = await runSearch(options, {
      home: temp.home,
      env: searchEnv(temp),
    });

    expect(result.incomplete).toBe(true);
    expect(result.widened).toBe(false);
    expect(result.results).toEqual([]);
    expect(statSync(hinted.path).atimeMs).toBe(atimeBefore);
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
