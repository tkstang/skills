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
  realpath,
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
    '../../../../skills/session-observer/scripts/session-observer.mjs',
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

async function copyClaudeTranscript(
  transcriptPath: string,
  sessionId: string,
): Promise<void> {
  const transcript = await readFile(typicalClaude, 'utf8');
  await writeFile(
    transcriptPath,
    transcript.replaceAll('cc-session-001', sessionId),
    'utf8',
  );
}

describe('--session override', () => {
  test('review: --runtime auto uses pinned cursor runtime before ambiguity checks', async () => {
    const tmpDir = await realpath(
      await mkdtemp(join(tmpdir(), 'cli-session-auto-cursor-')),
    );
    try {
      const cwd = join(tmpDir, 'workspace', 'auto-pinned-cursor-project');
      await mkdir(cwd, { recursive: true });
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

      expect(
        result.status,
        `auto + pinned cursor session should bypass runtime ambiguity\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-pinned-auto');
      expect(parsed.range.indexBase).toBe('zero-based-jsonl-frame-index');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up: --runtime auto uses pinned cursor runtime before ambiguity checks', async () => {
    const tmpDir = await realpath(
      await mkdtemp(join(tmpdir(), 'cli-session-auto-cursor-catchup-')),
    );
    try {
      const cwd = join(
        tmpDir,
        'workspace',
        'auto-pinned-cursor-catchup-project',
      );
      await mkdir(cwd, { recursive: true });
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

      expect(
        result.status,
        `auto + pinned cursor catch-up should bypass runtime ambiguity\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-pinned-catchup');
      expect(parsed.cursorEvidence.status.delivery).toBe('reserved');
      const cursorState = JSON.parse(
        await readFile(join(stateDir, 'cursor-state.json'), 'utf8'),
      );
      expect(
        cursorState.sessions['cursor:cursor-pinned-catchup'].continuity
          .nextFrameIndex,
      ).toBe(4);
      expect(
        cursorState.sessions['cursor:cursor-pinned-catchup'].pendingDelivery,
      ).toBe(null);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review: --session resolves tie to a digest (exit 0)', async () => {
    // Build two same-mtime candidates in the same encoded dir.
    // Without --session this causes a tie (exit 3). With --session it should exit 0.
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-session-tie-'));
    try {
      const cwd = '/test/tie-project';
      const encodedCwd = '-test-tie-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });

      // Copy the typical fixture as two distinct sessions so exact pinning
      // selects one canonical source while unpinned ranking remains tied.
      await copyClaudeTranscript(
        join(projectDir, 'session-tie-a.jsonl'),
        'cc-session-tie-a',
      );
      await copyClaudeTranscript(
        join(projectDir, 'session-tie-b.jsonl'),
        'cc-session-tie-b',
      );

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      // Without --session: the two same-age engaged sessions tie (exit 3).
      const noSession = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(
        noSession.status,
        `unpinned review should tie\nstdout: ${noSession.stdout}\nstderr: ${noSession.stderr}`,
      ).toBe(3);
      expect(JSON.parse(noSession.stdout).ties).toBe(true);

      // Pinning one of the tied sessions must bypass the tie — should exit 0
      const pinnedResult = spawnCli(
        [
          'review',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--session',
          'claude-code:cc-session-tie-a',
          '--json',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(
        pinnedResult.status,
        `--session should resolve to exit 0, got ${pinnedResult.status}\nstdout: ${pinnedResult.stdout}\nstderr: ${pinnedResult.stderr}`,
      ).toBe(0);

      const digestData = JSON.parse(pinnedResult.stdout);
      expect(
        digestData.entries || digestData.range,
        'should return a digest object',
      ).toBeTruthy();
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

      expect(
        result.status,
        `watched catch-up should still succeed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      expect(
        result.stdout.includes(
          'watcher pid 12345 is also reading this session',
        ),
      ).toBeTruthy();
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

      expect(
        result.status,
        `--session with non-existent id should exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(1);
      expect(result.stderr).toContain('Pinned session not found');
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

      expect(
        result.status,
        `--session without colon should exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(1);
      expect(result.stderr).toContain(
        '--session must be in <runtime>:<sessionId> format',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
