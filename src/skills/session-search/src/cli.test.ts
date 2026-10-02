/**
 * cli.test.ts — installed-artifact tests for the generated session-search CLI.
 *
 * Every test spawns `skills/session-search/scripts/session-search.mjs` (run
 * `pnpm run build` first) against a synthetic temporary HOME and STATE_DIR with
 * harness-detection variables blanked. These tests pin the CLI contract: exit
 * codes, the `session-search/v1` JSON shape, the text and estimate renderings,
 * and the behaviors the agent guidance relies on (widening, the deep rung, the
 * large-scan guard). Ranking and adapter details stay in the lib suites.
 */
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  claudeAssistant,
  claudeToolResult,
  claudeToolUse,
  claudeUser,
  codexMessage,
  codexSessionMeta,
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
} from './helpers/test-helpers.js';
import { probeTools } from './lib/tools.js';

const CLI_PATH = fileURLToPath(
  new URL(
    '../../../../skills/session-search/scripts/session-search.mjs',
    import.meta.url,
  ),
);

const NOW = Date.now();
const CODEX_ARCHIVED = '019a0000-0000-7000-8000-00000000c1a1';
// Built by concatenation so secret scanners do not flag the fixture.
const FAKE_KEY = `sk-${'test'.repeat(6)}`;
const RG_AVAILABLE = probeTools({ PATH: process.env.PATH }).rg !== null;

const SEARCH_RESULT_KEYS = [
  'diagnostics',
  'host',
  'incomplete',
  'needsConfirmation',
  'query',
  'results',
  'schema',
  'sources',
  'tiersRun',
  'tools',
  'widened',
];
const SESSION_HIT_KEYS = [
  'archived',
  'cwd',
  'firstPrompt',
  'isSubagent',
  'lastActivity',
  'matchedPatterns',
  'matchedTiers',
  'open',
  'rank',
  'runtime',
  'score',
  'sessionId',
  'snippets',
  'startedAt',
  'title',
  'transcriptPath',
];

let temp: TempHome;

beforeEach(() => {
  temp = makeTempHome('session-search-cli-');
});

afterEach(() => {
  temp.cleanup();
});

interface CliRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], extraEnv: Record<string, string> = {}): CliRun {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: temp.home,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      SESSION_SEARCH_RG: '',
      SESSION_SEARCH_SQLITE3: '',
      ...searchEnv(temp),
      ...extraEnv,
    },
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runJson(args: string[], extraEnv: Record<string, string> = {}) {
  const run = runCli([...args, '--json'], extraEnv);
  return { ...run, json: JSON.parse(run.stdout) };
}

/** A Claude session whose user typed the target phrase. */
function claudeTarget(cwd = '/work/target', mtimeMs = NOW - HOUR_MS) {
  return writeClaudeSession(temp.home, {
    cwd,
    mtimeMs,
    records: (e) => [
      claudeUser(e, `can we do the vetting of Perceive Now? key ${FAKE_KEY}`),
      claudeAssistant(e, 'Sure, looking at it.'),
    ],
  });
}

/** A Claude session that never mentions the target. */
function claudeDecoy(cwd: string, mtimeMs = NOW - 2 * HOUR_MS) {
  return writeClaudeSession(temp.home, {
    cwd,
    mtimeMs,
    records: (e) => [
      claudeUser(e, 'please tidy the release script'),
      claudeAssistant(e, 'Done.'),
    ],
  });
}

describe('session-search CLI', () => {
  it('ranks the cross-runtime target first in valid, redacted v1 JSON', () => {
    const target = claudeTarget();
    writeCodexRollout(temp.home, {
      id: CODEX_ARCHIVED,
      archived: true,
      startedAtMs: NOW - 3 * HOUR_MS,
      records: [
        codexSessionMeta({ id: CODEX_ARCHIVED, cwd: '/work/codex' }),
        codexMessage('assistant', 'perceive now came up briefly', 1),
      ],
    });
    writeCursorTranscript(temp.home, {
      cwd: '/work/cursor',
      mtimeMs: NOW - 4 * HOUR_MS,
      records: [
        cursorUser('unrelated question'),
        cursorAssistant('nothing relevant here'),
        cursorTurnEnded(),
      ],
    });

    const { status, stdout, json } = runJson([
      '-p',
      'perceive.*now',
      '-p',
      'vetting',
    ]);

    expect(status).toBe(0);
    expect(json.schema).toBe('session-search/v1');
    expect(Object.keys(json).toSorted()).toEqual(SEARCH_RESULT_KEYS);
    expect(
      json.sources.map((source: { status: string }) => source.status),
    ).toEqual(['ok', 'ok', 'ok']);
    expect(
      json.results.map((hit: { runtime: string; sessionId: string }) => [
        hit.runtime,
        hit.sessionId,
      ]),
    ).toEqual([
      ['claude-code', target.sessionId],
      ['codex', CODEX_ARCHIVED],
    ]);
    for (const hit of json.results) {
      expect(Object.keys(hit).toSorted()).toEqual(SESSION_HIT_KEYS);
    }
    expect(json.results[0]).toMatchObject({
      rank: 1,
      archived: false,
      matchedPatterns: ['perceive.*now', 'vetting'],
      open: { command: `claude --resume ${target.sessionId}` },
    });
    expect(json.results[1].archived).toBe(true);
    expect(stdout).not.toContain(FAKE_KEY);
    expect(stdout).toContain('[REDACTED]');
  });

  it('honors --since by session activity', () => {
    claudeTarget('/work/old', NOW - 3 * DAY_MS);
    const recent = claudeTarget('/work/recent', NOW - HOUR_MS);

    const { status, json } = runJson(['-p', 'perceive.*now', '--since', '24h']);

    expect(status).toBe(0);
    expect(
      json.results.map((hit: { sessionId: string }) => hit.sessionId),
    ).toEqual([recent.sessionId]);
  });

  it('widens past a --cwd hint that finds nothing and reports it', () => {
    const target = claudeTarget('/work/target');
    claudeDecoy('/work/hinted');

    const hinted = runJson(['-p', 'perceive.*now', '--cwd', '/work/target']);
    const missed = runJson(['-p', 'perceive.*now', '--cwd', '/work/hinted']);

    expect(hinted.json.widened).toBe(false);
    expect(missed.status).toBe(0);
    expect(missed.json.widened).toBe(true);
    expect(
      missed.json.results.map((hit: { sessionId: string }) => hit.sessionId),
    ).toEqual([target.sessionId]);
  });

  it('finds tool-output-only text on the deep rung; --no-deep exits 2', () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/tools',
      mtimeMs: NOW - HOUR_MS,
      records: (e) => [
        claudeUser(e, 'list my chatgpt threads'),
        claudeToolUse(e, 'toolu_1', 'Bash', { command: 'ls' }),
        claudeToolResult(e, 'toolu_1', 'Perceive Now vetting thread'),
      ],
    });

    const deep = runJson(['-p', 'perceive.*now']);
    const noDeep = runJson(['-p', 'perceive.*now', '--no-deep']);

    expect(deep.status).toBe(0);
    expect(deep.json.tiersRun).toEqual(['history', 'meta', 'content', 'deep']);
    expect(deep.json.results).toHaveLength(1);
    expect(deep.json.results[0]).toMatchObject({
      sessionId: session.sessionId,
      matchedTiers: ['deep'],
    });
    expect(noDeep.status).toBe(2);
    expect(noDeep.json.results).toEqual([]);
    expect(noDeep.json.tiersRun).not.toContain('deep');
  });

  it('exits 3 with cheap-tier results when a scan needs confirmation', () => {
    const target = claudeTarget();
    writeClaudeHistory(temp.home, [
      {
        display: 'vet the perceive now idea',
        project: '/work/target',
        sessionId: target.sessionId,
        timestamp: NOW - HOUR_MS,
      },
    ]);

    const guarded = runJson(['-p', 'perceive.*now', '--large-scan-bytes', '1']);

    expect(guarded.status).toBe(3);
    expect(guarded.json.results).toHaveLength(1);
    expect(guarded.json.needsConfirmation).toMatchObject({
      reason: 'large-scan',
      fileCount: 1,
      estimatedBytes: statSync(target.path).size,
      rerunFlag: '--allow-large-scan',
    });
  });

  it('exits 3 with zero results when the guard skips content; --allow-large-scan finds it', () => {
    const target = claudeTarget();
    claudeDecoy('/work/other');

    const guarded = runJson(['-p', 'perceive.*now', '--large-scan-bytes', '1']);
    const allowed = runJson([
      '-p',
      'perceive.*now',
      '--large-scan-bytes',
      '1',
      '--allow-large-scan',
    ]);

    expect(guarded.status).toBe(3);
    expect(guarded.json.results).toEqual([]);
    expect(guarded.json.needsConfirmation).toMatchObject({ fileCount: 2 });
    expect(guarded.json.tiersRun).toEqual(['history', 'meta']);
    expect(allowed.status).toBe(0);
    expect(allowed.json.needsConfirmation).toBeNull();
    expect(
      allowed.json.results.map((hit: { sessionId: string }) => hit.sessionId),
    ).toEqual([target.sessionId]);
  });

  it('exits 2 with every source absent when no stores exist', () => {
    const { status, json } = runJson(['-p', 'anything']);

    expect(status).toBe(2);
    expect(json.results).toEqual([]);
    expect(
      json.sources.map((source: { runtime: string; status: string }) => [
        source.runtime,
        source.status,
      ]),
    ).toEqual([
      ['claude-code', 'absent'],
      ['codex', 'absent'],
      ['cursor', 'absent'],
    ]);
  });

  it('estimates files and bytes inside the window', () => {
    claudeTarget('/work/old', NOW - 3 * DAY_MS);
    const recent = claudeTarget('/work/recent', NOW - HOUR_MS);

    const estimate = runCli([
      'estimate',
      '--since',
      '24h',
      '--large-scan-bytes',
      '1',
      '--json',
    ]);
    const text = runCli(['estimate']);
    const json = JSON.parse(estimate.stdout);
    const bytes = statSync(recent.path).size;

    expect(estimate.status).toBe(0);
    expect(json.schema).toBe('session-search-estimate/v1');
    expect(json.runtimes[0]).toMatchObject({
      runtime: 'claude-code',
      status: 'ok',
      files: 1,
      bytes,
    });
    expect(json).toMatchObject({
      totalFiles: 1,
      totalBytes: bytes,
      exceedsLargeScan: true,
    });
    expect(text.status).toBe(0);
    expect(text.stdout).toMatch(/^session-search estimate/);
    expect(text.stdout).toMatch(/total\s+2 files/);
  });

  it('renders a compact text table without --json', () => {
    const target = claudeTarget();

    const { status, stdout } = runCli(['-p', 'perceive.*now']);

    expect(status).toBe(0);
    expect(stdout).toMatch(/^session-search: 1 result \(tiers: /);
    expect(stdout).toContain('[claude-code]');
    expect(stdout).toContain(`open: claude --resume ${target.sessionId}`);
    expect(stdout).not.toContain(FAKE_KEY);
  });

  it('prints help with exit 0 and rejects usage errors with exit 1', () => {
    const help = runCli(['--help']);
    const badRegex = runCli(['-p', '(']);
    const emptyMatch = runCli(['-p', 'a*']);
    const noPattern = runCli([]);

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('Usage:');
    expect(badRegex.status).toBe(1);
    expect(badRegex.stderr).toContain('Invalid regex pattern "("');
    expect(badRegex.stderr).toContain('--literal');
    expect(emptyMatch.status).toBe(1);
    expect(emptyMatch.stderr).toContain('pattern matches empty text');
    expect(noPattern.status).toBe(1);
    expect(noPattern.stderr).toContain('At least one --pattern');
    expect(`${badRegex.stdout}${noPattern.stdout}`).toBe('');
  });

  it.skipIf(!RG_AVAILABLE)(
    'returns identical results with and without the rg prefilter',
    () => {
      claudeTarget('/work/target');
      claudeDecoy('/work/one');
      writeCodexRollout(temp.home, {
        id: CODEX_ARCHIVED,
        startedAtMs: NOW - 3 * HOUR_MS,
        records: [
          codexSessionMeta({ id: CODEX_ARCHIVED, cwd: '/work/codex' }),
          codexMessage('user', 'is perceive now worth vetting?', 1),
        ],
      });
      const args = ['-p', 'perceive.*now', '-p', 'vetting'];

      const withRg = runJson(args, { SESSION_SEARCH_NO_RG: '' });
      const withoutRg = runJson(args, { SESSION_SEARCH_NO_RG: '1' });

      expect(withRg.json.tools.rg).not.toBeNull();
      expect(withoutRg.json.tools.rg).toBeNull();
      expect(withRg.status).toBe(0);
      expect(withRg.json.results).toHaveLength(2);
      expect(withRg.json.results).toEqual(withoutRg.json.results);
      expect(withRg.json.tiersRun).toEqual(withoutRg.json.tiersRun);
    },
  );
});
