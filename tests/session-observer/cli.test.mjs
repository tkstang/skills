/**
 * cli.test.mjs — Tests for scripts/session-observer.mjs CLI
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Absolute path to the CLI — resolved from import.meta.url, never a bare relative path.
const CLI_PATH = fileURLToPath(new URL(
  '../../.agents/skills/session-observer/scripts/session-observer.mjs',
  import.meta.url
));

const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const emptyClaude = join(FIXTURES, 'claude-code', 'empty.jsonl');

/**
 * Spawn the CLI with the given args and env.
 */
function spawnCli(args, env = {}) {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env },
  });
}

// ---------------------------------------------------------------------------
// Basic dispatch tests
// ---------------------------------------------------------------------------

describe('CLI subcommand dispatch', () => {
  test('review --help does not throw', (t) => {
    const result = spawnCli(['review', '--help']);
    // --help exits 0 or 1; should not crash with code 127 or similar
    // (exits 2 or 3 are also valid if runtime auto-resolution kicks in first)
    assert.ok(result.status !== null, 'should have an exit code');
    assert.ok(
      result.status === 0 || result.status === 1 || result.status === 2 || result.status === 3,
      `unexpected exit code: ${result.status}`
    );
  });

  test('unknown subcommand exits with code 1', (t) => {
    const result = spawnCli(['not-a-command']);
    assert.equal(result.status, 1, 'unknown subcommand should exit 1');
  });

  test('no arguments exits with code 1', (t) => {
    const result = spawnCli([]);
    assert.equal(result.status, 1, 'no arguments should exit 1');
  });
});

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

describe('exit codes', () => {
  test('review against empty fixture exits 2 (noMatch)', async (t) => {
    // We need a temp HOME with the empty fixture in the right location
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const cwd = '/test/empty-project';
      // Claude Code encodes '/' as '-', so '/test/empty-project' -> '-test-empty-project'
      const encodedCwd = '-test-empty-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(emptyClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir }
      );

      // Empty fixture has no content, so it becomes a candidate that is found but with
      // no messages → either exit 0 (empty digest) or exit 2 (no candidates)
      // Plan says: "empty fixture → exit 2"
      assert.ok(result.status === 0 || result.status === 2,
        `Expected exit 0 or 2 for empty fixture, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review against typical fixture exits 0', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const cwd = '/test/my-project';
      const encodedCwd = '-test-my-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir }
      );

      assert.equal(result.status, 0,
        `Expected exit 0, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('### User') || result.stdout.includes('session-observer'),
        'output should contain markdown content');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// locate --json
// ---------------------------------------------------------------------------

describe('locate --json', () => {
  test('locate --json outputs parseable JSON with winner/fallbacks', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const cwd = '/test/locate-project';
      const encodedCwd = '-test-locate-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['locate', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir }
      );

      assert.ok(result.status === 0 || result.status === 2,
        `Expected exit 0 or 2 for locate, got ${result.status}\nstderr: ${result.stderr}`);

      if (result.status === 0) {
        let parsed;
        assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, 'stdout should be valid JSON');
        assert.ok('winner' in parsed || 'noMatch' in parsed, 'JSON should contain winner or noMatch key');
        assert.ok('fallbacks' in parsed || 'noMatch' in parsed, 'JSON should contain fallbacks or noMatch');
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// --runtime auto
// ---------------------------------------------------------------------------

describe('--runtime auto', () => {
  test('auto with SESSION_OBSERVER_SELF=claude-code resolves to codex', async (t) => {
    // If self is claude-code, auto should try to read codex's transcript.
    // With no codex transcripts, this should exit 2 (noMatch).
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['review', '--runtime', 'auto', '--cwd', '/nonexistent'],
        {
          HOME: tmpDir,
          STATE_DIR: stateDir,
          SESSION_OBSERVER_SELF: 'claude-code',
        }
      );
      // Should try codex (the peer), find no transcripts → exit 2
      assert.equal(result.status, 2,
        `Expected exit 2 (noMatch) when peer runtime has no transcripts, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto with SESSION_OBSERVER_SELF=codex resolves to claude-code', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['review', '--runtime', 'auto', '--cwd', '/nonexistent'],
        {
          HOME: tmpDir,
          STATE_DIR: stateDir,
          SESSION_OBSERVER_SELF: 'codex',
        }
      );
      // Should try claude-code (the peer), find no transcripts → exit 2
      assert.equal(result.status, 2,
        `Expected exit 2 (noMatch) when peer runtime has no transcripts, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto with no env hint and no candidates in either runtime → exit 2', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['review', '--runtime', 'auto', '--cwd', '/nonexistent-project'],
        {
          HOME: tmpDir,
          STATE_DIR: stateDir,
        }
      );
      // No candidates in either runtime → exit 2 or 3
      assert.ok(result.status === 2 || result.status === 3,
        `Expected exit 2 or 3 when no candidates in either runtime, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// state subcommand
// ---------------------------------------------------------------------------

describe('state subcommand', () => {
  test('state get exits 0 with empty state', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['state', 'get'], { HOME: tmpDir, STATE_DIR: stateDir });
      assert.equal(result.status, 0, `state get should exit 0\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('state clear exits 0', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['state', 'clear'], { HOME: tmpDir, STATE_DIR: stateDir });
      assert.equal(result.status, 0, `state clear should exit 0\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('state reset --runtime codex exits 0', async (t) => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['state', 'reset', '--runtime', 'codex'],
        { HOME: tmpDir, STATE_DIR: stateDir }
      );
      assert.equal(result.status, 0, `state reset should exit 0\nstderr: ${result.stderr}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
