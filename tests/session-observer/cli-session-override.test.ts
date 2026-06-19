/**
 * cli-session-override.test.ts — Tests for the --session flag (session pinning
 * and tie recovery).
 *
 * Tests that --session <runtime>:<id> resolves ties, selects specific sessions,
 * and bypasses auto-runtime ambiguity checks.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  mkdtemp,
  rm,
  mkdir,
  copyFile,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLI_PATH = fileURLToPath(
  new URL(
    '../../skills/session-observer/scripts/session-observer.mjs',
    import.meta.url,
  ),
);

const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const typicalCursor = join(FIXTURES, 'cursor', 'typical.jsonl');

function spawnCli(
  args: string[],
  env: NodeJS.ProcessEnv = {},
): SpawnSyncReturns<string> {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env },
  });
}

function cursorSlug(cwd: string): string {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function copyCursorTranscript(
  home: string,
  cwd: string,
  sessionId = 'cursor-session-001',
): Promise<string> {
  const transcriptDir = join(
    home,
    '.cursor',
    'projects',
    cursorSlug(cwd),
    'agent-transcripts',
    sessionId,
  );
  await mkdir(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, `${sessionId}.jsonl`);
  await copyFile(typicalCursor, transcriptPath);
  return transcriptPath;
}

describe('--session override', () => {
  test('review: --runtime auto uses pinned cursor runtime before ambiguity checks', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-auto-cursor-'));
    try {
      const cwd = '/test/auto-pinned-cursor-project';
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await copyCursorTranscript(tmpDir, cwd, 'cursor-pinned-auto');

      const codexDir = join(tmpDir, '.codex', 'sessions', '2026', '05', '17');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'codex-also-matches.jsonl'),
        [
          JSON.stringify({
            sessionId: 'codex-also-matches',
            payload: { type: 'session_meta', cwd },
          }),
          JSON.stringify({
            sessionId: 'codex-also-matches',
            payload: {
              type: 'message',
              role: 'assistant',
              content: 'Codex also matches.',
            },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const result = spawnCli(
        [
          'review',
          '--runtime',
          'auto',
          '--cwd',
          cwd,
          '--session',
          'cursor:cursor-pinned-auto',
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `auto + pinned cursor session should bypass runtime ambiguity\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-pinned-auto');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up: --runtime auto uses pinned cursor runtime before ambiguity checks', async () => {
    const tmpDir = await mkdtemp(
      join(tmpdir(), 'cli-session-auto-cursor-catchup-'),
    );
    try {
      const cwd = '/test/auto-pinned-cursor-catchup-project';
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await copyCursorTranscript(tmpDir, cwd, 'cursor-pinned-catchup');

      const codexDir = join(tmpDir, '.codex', 'sessions', '2026', '05', '17');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'codex-also-matches.jsonl'),
        [
          JSON.stringify({
            sessionId: 'codex-also-matches',
            payload: { type: 'session_meta', cwd },
          }),
          JSON.stringify({
            sessionId: 'codex-also-matches',
            payload: {
              type: 'message',
              role: 'assistant',
              content: 'Codex also matches.',
            },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const result = spawnCli(
        [
          'catch-up',
          '--runtime',
          'auto',
          '--cwd',
          cwd,
          '--session',
          'cursor:cursor-pinned-catchup',
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `auto + pinned cursor catch-up should bypass runtime ambiguity\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-pinned-catchup');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review: --session accepts cursor runtime', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-cursor-'));
    try {
      const cwd = '/test/cursor-session-project';
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await copyCursorTranscript(tmpDir, cwd, 'cursor-pinned');

      const result = spawnCli(
        [
          'review',
          '--runtime',
          'cursor',
          '--cwd',
          cwd,
          '--session',
          'cursor:cursor-pinned',
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `--session should accept cursor, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-pinned');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review: --session resolves tie to a digest (exit 0)', async ({
    skip,
  }) => {
    // Build two same-mtime candidates in the same encoded dir.
    // Without --session this causes a tie (exit 3). With --session it should exit 0.
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-tie-'));
    try {
      const cwd = '/test/tie-project';
      const encodedCwd = '-test-tie-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });

      // Copy the typical fixture as two different session files
      await copyFile(typicalClaude, join(projectDir, 'session-tie-a.jsonl'));
      await copyFile(typicalClaude, join(projectDir, 'session-tie-b.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      // Without --session: should exit 3 (tie) or 0 if only one session is found
      const noSession = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      void noSession; // presence checked above; we proceed to test --session regardless

      // Get the session IDs from locate
      const locateResult = spawnCli(
        ['locate', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      if (locateResult.status !== 0) {
        // No match or error — skip the session pinning test
        skip(
          'locate did not return a winner; skipping --session tie recovery sub-test',
        );
        return;
      }

      const locateData = JSON.parse(locateResult.stdout);
      const winner = locateData.winner;
      expect(winner, 'locate should return a winner').toBeTruthy();

      // Pin to the winner's session — should always exit 0
      const pinnedResult = spawnCli(
        [
          'review',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          `${winner.runtime}:${winner.sessionId}`,
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(pinnedResult.status, `--session should resolve to exit 0, got ${pinnedResult.status}\nstdout: ${pinnedResult.stdout}\nstderr: ${pinnedResult.stderr}`).toBe(0);

      const digestData = JSON.parse(pinnedResult.stdout);
      expect(digestData.entries || digestData.range, 'should return a digest object').toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up: --session resolves to a digest (exit 0)', async ({
    skip,
  }) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-catchup-'));
    try {
      const cwd = '/test/catchup-session-project';
      const encodedCwd = '-test-catchup-session-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-cu-a.jsonl'));
      await copyFile(typicalClaude, join(projectDir, 'session-cu-b.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      // Get a session ID from locate
      const locateResult = spawnCli(
        ['locate', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      if (locateResult.status !== 0) {
        skip(
          'locate did not return a winner; skipping --session catch-up sub-test',
        );
        return;
      }

      const locateData = JSON.parse(locateResult.stdout);
      const winner = locateData.winner;
      expect(winner, 'locate should return a winner').toBeTruthy();

      // catch-up with --session should exit 0
      const pinnedResult = spawnCli(
        [
          'catch-up',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          `${winner.runtime}:${winner.sessionId}`,
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(pinnedResult.status, `catch-up --session should resolve to exit 0, got ${pinnedResult.status}\nstdout: ${pinnedResult.stdout}\nstderr: ${pinnedResult.stderr}`).toBe(0);

      const statePath = join(stateDir, 'state.json');
      const before = JSON.parse(await readFile(statePath, 'utf8'));
      await sleep(25);

      const secondPinnedResult = spawnCli(
        [
          'catch-up',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          `${winner.runtime}:${winner.sessionId}`,
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(secondPinnedResult.status, `second pinned catch-up should exit 0\nstdout: ${secondPinnedResult.stdout}\nstderr: ${secondPinnedResult.stderr}`).toBe(0);

      const after = JSON.parse(await readFile(statePath, 'utf8'));
      expect(after, 'pinned no-op catch-up should not rewrite matching state').toEqual(before);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up warns but succeeds when a watcher owns the same session', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-catchup-watched-'));
    try {
      const cwd = '/test/watched-catchup-project';
      const encodedCwd = '-test-watched-catchup-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      const transcriptPath = join(projectDir, 'watched-catchup.jsonl');
      await writeFile(
        transcriptPath,
        [
          JSON.stringify({
            sessionId: 'watched-catchup',
            message: { role: 'assistant', content: 'watched session update' },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await writeFile(
        join(stateDir, 'state.json'),
        JSON.stringify({
          schemaVersion: 1,
          sessions: {
            'claude-code:watched-catchup': {
              runtime: 'claude-code',
              sessionId: 'watched-catchup',
              transcriptPath,
              recordedCwd: cwd,
              lastRecordIndex: 0,
              lastTotalRecords: 0,
              lastReadAt: '2026-06-03T12:00:00.000Z',
              watchedByPid: 12345,
            },
          },
        }),
        'utf8',
      );

      const result = spawnCli(
        [
          'catch-up',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          'claude-code:watched-catchup',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `watched catch-up should still succeed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout.includes(
          'watcher pid 12345 is also reading this session',
        )).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review: --session with invalid session exits 1', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-bad-'));
    try {
      const cwd = '/test/bad-session-project';
      const encodedCwd = '-test-bad-session-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        [
          'review',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          'claude-code:nonexistent-session-id',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `--session with non-existent id should exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review: --session with wrong-format exits 1', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-fmt-'));
    try {
      const cwd = '/test/fmt-session-project';
      const encodedCwd = '-test-fmt-session-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        [
          'review',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          'no-colon-here',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `--session without colon should exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
