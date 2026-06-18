/**
 * cli.test.ts — Tests for scripts/session-observer.mjs CLI
 */

import assert from 'node:assert/strict';
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

import { describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Absolute path to the CLI — resolved from import.meta.url, never a bare relative path.
const CLI_PATH = fileURLToPath(
  new URL(
    '../../skills/session-observer/scripts/session-observer.mjs',
    import.meta.url,
  ),
);

const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const emptyClaude = join(FIXTURES, 'claude-code', 'empty.jsonl');
const typicalCursor = join(FIXTURES, 'cursor', 'typical.jsonl');

/**
 * Spawn the CLI with the given args and env.
 */
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

async function readJsonIfExists(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
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

// ---------------------------------------------------------------------------
// Basic dispatch tests
// ---------------------------------------------------------------------------

describe('CLI subcommand dispatch', () => {
  test('--help lists cursor as a runtime option', () => {
    const result = spawnCli(['--help']);
    assert.equal(
      result.status,
      0,
      `help should exit 0\nstderr: ${result.stderr}`,
    );
    assert.ok(
      result.stdout.includes('--runtime <claude-code|codex|cursor|auto>'),
      'help should include cursor in the runtime list',
    );
  });

  test('--help lists watch command surface', () => {
    const result = spawnCli(['--help']);
    assert.equal(
      result.status,
      0,
      `help should exit 0\nstderr: ${result.stderr}`,
    );
    assert.ok(
      result.stdout.includes('watch'),
      'help should list watch subcommand',
    );
    assert.ok(
      result.stdout.includes('catch-up-then-watch'),
      'help should list catch-up-then-watch subcommand',
    );
    assert.ok(
      result.stdout.includes('watch-ctl'),
      'help should list watch-ctl subcommand',
    );
    assert.ok(
      result.stdout.includes('--watch'),
      'help should list top-level --watch alias',
    );
  });

  test('watch --help lists watch flags', () => {
    const result = spawnCli(['watch', '--help']);
    assert.equal(
      result.status,
      0,
      `watch help should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    assert.ok(
      result.stdout.includes('--debounce-sec'),
      'watch help should include debounce flag',
    );
    assert.ok(
      result.stdout.includes('--poll-sec'),
      'watch help should include poll flag',
    );
    assert.ok(
      result.stdout.includes('--max-pending-sec'),
      'watch help should include max pending flag',
    );
    assert.ok(
      result.stdout.includes('--max-runtime-min'),
      'watch help should include bounded runtime flag',
    );
    assert.ok(
      result.stdout.includes('--heartbeat-sec'),
      'watch help should include heartbeat flag',
    );
    assert.ok(
      result.stdout.includes('--until-stopped'),
      'watch help should include until-stopped alias',
    );
    assert.ok(
      result.stdout.includes('--interactive'),
      'watch help should include interactive alias',
    );
    assert.ok(
      result.stdout.includes('--event-log'),
      'watch help should include event log flag',
    );
    assert.ok(
      result.stdout.includes('--runtime <claude-code|codex|cursor|auto|both>'),
      'watch help should include both as a watch runtime option',
    );
  });

  test('watch-ctl --help lists control operations', () => {
    const result = spawnCli(['watch-ctl', '--help']);
    assert.equal(
      result.status,
      0,
      `watch-ctl help should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    for (const op of ['status', 'pause', 'resume', 'flush', 'stop']) {
      assert.ok(
        result.stdout.includes(op),
        `watch-ctl help should include ${op}`,
      );
    }
  });

  test('--watch --help maps to watch help', () => {
    const canonical = spawnCli(['watch', '--help']);
    const alias = spawnCli(['--watch', '--help']);
    assert.equal(
      alias.status,
      0,
      `--watch help should exit 0\nstdout: ${alias.stdout}\nstderr: ${alias.stderr}`,
    );
    assert.equal(
      alias.stdout,
      canonical.stdout,
      '--watch --help should print the same help as watch --help',
    );
  });

  test('catch-up-then-watch --help maps to watch help with command name', () => {
    const result = spawnCli(['catch-up-then-watch', '--help']);
    assert.equal(
      result.status,
      0,
      `catch-up-then-watch help should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    assert.ok(
      result.stdout.includes(
        'Usage: session-observer catch-up-then-watch [options]',
      ),
    );
    assert.ok(result.stdout.includes('--heartbeat-sec'));
  });

  test('watch-ctl status --json reports no active watcher', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-watch-status-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['watch-ctl', 'status', '--json'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });

      assert.equal(
        result.status,
        0,
        `watch-ctl status should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.noActiveWatcher, true);
      assert.equal(parsed.active, false);
      assert.equal(parsed.watcher, null);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('watch-ctl pause resume and flush write control directives', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-watch-control-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await writeFile(
        join(stateDir, 'watch.json'),
        JSON.stringify({
          schemaVersion: 1,
          active: {
            pid: process.pid,
            runtime: 'claude-code',
            cwd: '/test/active-watch-control',
            startedAt: new Date().toISOString(),
            lastEventAt: null,
            eventCount: 0,
          },
        }),
        'utf8',
      );

      for (const op of ['pause', 'resume', 'flush']) {
        const result = spawnCli(
          ['watch-ctl', op, '--cwd', '/test/active-watch-control', '--json'],
          { HOME: tmpDir, STATE_DIR: stateDir },
        );
        assert.equal(
          result.status,
          0,
          `watch-ctl ${op} should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );

        const payload = JSON.parse(result.stdout);
        assert.equal(payload.directive, op);
        assert.equal(payload.control.directive, op);
        assert.equal(payload.control.pid, process.pid);

        const raw = JSON.parse(
          await readFile(
            join(stateDir, `watch.control.${process.pid}.json`),
            'utf8',
          ),
        );
        assert.equal(raw.directive, op);
        assert.equal(raw.pid, process.pid);
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('watch-ctl controls fall back to the only matching watcher when cwd differs', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-watch-control-fallback-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await writeFile(
        join(stateDir, 'watch.json'),
        JSON.stringify({
          schemaVersion: 1,
          active: null,
          watchers: [
            {
              pid: process.pid,
              runtime: 'claude-code',
              cwd: '/test/somewhere-else-entirely',
              startedAt: new Date().toISOString(),
              targets: [],
            },
          ],
        }),
        'utf8',
      );

      // No --cwd: the implicit process.cwd() does not match the watcher's cwd,
      // but the lone watcher must remain controllable.
      const result = spawnCli(['watch-ctl', 'pause', '--json'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `lone-watcher control should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.directive, 'pause');
      assert.equal(payload.control.pid, process.pid);

      // An explicit --cwd that matches nothing is a hard filter and must not
      // fall back; it reports the active watchers instead.
      const filtered = spawnCli(
        ['watch-ctl', 'pause', '--cwd', '/test/not-a-watcher-cwd', '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      assert.equal(
        filtered.status,
        3,
        `explicit cwd miss should exit 3\nstdout: ${filtered.stdout}\nstderr: ${filtered.stderr}`,
      );
      const filteredPayload = JSON.parse(filtered.stdout);
      assert.equal(filteredPayload.noMatchingWatcher, true);
      assert.equal(filteredPayload.watchers.length, 1);
      assert.equal(filteredPayload.watchers[0].pid, process.pid);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('watch-ctl controls require disambiguation for multiple same-cwd watchers', async () => {
    const tmpDir = await mkdtemp(
      join(tmpdir(), 'cli-watch-control-ambiguous-'),
    );
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      const cwd = '/test/ambiguous-watch-control';
      const firstPid = process.pid;
      const secondPid = process.ppid;
      await writeFile(
        join(stateDir, 'watch.json'),
        JSON.stringify({
          schemaVersion: 1,
          active: null,
          watchers: [
            {
              pid: firstPid,
              runtime: 'auto',
              requestedRuntime: 'auto',
              resolvedRuntime: 'codex',
              cwd,
              startedAt: new Date().toISOString(),
              targets: [{ runtime: 'codex', sessionId: 'codex-session' }],
            },
            {
              pid: secondPid,
              runtime: 'auto',
              requestedRuntime: 'auto',
              resolvedRuntime: 'claude-code',
              cwd,
              startedAt: new Date().toISOString(),
              targets: [
                { runtime: 'claude-code', sessionId: 'claude-session' },
              ],
            },
          ],
        }),
        'utf8',
      );

      const ambiguous = spawnCli(
        ['watch-ctl', 'pause', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      assert.equal(
        ambiguous.status,
        3,
        `ambiguous control should exit 3\nstdout: ${ambiguous.stdout}\nstderr: ${ambiguous.stderr}`,
      );
      const ambiguousPayload = JSON.parse(ambiguous.stdout);
      assert.equal(ambiguousPayload.ambiguousWatcher, true);
      assert.equal(ambiguousPayload.watchers.length, 2);

      const selected = spawnCli(
        ['watch-ctl', 'pause', '--cwd', cwd, '--runtime', 'codex', '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      assert.equal(
        selected.status,
        0,
        `selected control should exit 0\nstdout: ${selected.stdout}\nstderr: ${selected.stderr}`,
      );
      const payload = JSON.parse(selected.stdout);
      assert.equal(payload.control.pid, firstPid);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('watch-ctl inactive controls clear stale directives without writing a new one', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-watch-control-inactive-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      for (const op of ['pause', 'resume', 'flush', 'stop']) {
        await writeFile(
          join(stateDir, 'watch.control.json'),
          JSON.stringify({
            directive: 'pause',
            issuedAt: new Date().toISOString(),
          }),
          'utf8',
        );

        const result = spawnCli(['watch-ctl', op, '--json'], {
          HOME: tmpDir,
          STATE_DIR: stateDir,
        });

        assert.equal(
          result.status,
          0,
          `watch-ctl ${op} should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.noActiveWatcher, true);
        assert.equal(payload.active, false);
        assert.equal(payload.watcher, null);
        assert.equal(
          await readJsonIfExists(join(stateDir, 'watch.control.json')),
          null,
        );
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('watch --json renders setup failures as a stable error event', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-watch-setup-error-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      // Event-log path validation throws before the watch loop's own error
      // emitter is reachable; --json must still get a stdout error event.
      const escape = spawnCli(
        [
          'watch',
          '--json',
          '--event-log',
          '../escape.log',
          '--max-runtime-min',
          '0.01',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      assert.equal(
        escape.status,
        1,
        `watch with escaping event log should exit 1\nstdout: ${escape.stdout}\nstderr: ${escape.stderr}`,
      );
      const escapeEvent = JSON.parse(escape.stdout.trim());
      assert.equal(escapeEvent.type, 'error');
      assert.ok(escapeEvent.ts, 'error event should carry a timestamp');
      assert.ok(
        escapeEvent.message.length > 0,
        'error event should carry a message',
      );

      const invalid = spawnCli(['watch', '--json', '--runtime', 'bogus'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(invalid.status, 1);
      const invalidEvent = JSON.parse(invalid.stdout.trim());
      assert.equal(invalidEvent.type, 'error');
      assert.match(invalidEvent.message, /Unknown watch runtime/);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review --help does not throw', () => {
    const result = spawnCli(['review', '--help']);
    // --help exits 0 or 1; should not crash with code 127 or similar
    // (exits 2 or 3 are also valid if runtime auto-resolution kicks in first)
    assert.ok(result.status !== null, 'should have an exit code');
    assert.ok(
      result.status === 0 ||
        result.status === 1 ||
        result.status === 2 ||
        result.status === 3,
      `unexpected exit code: ${result.status}`,
    );
  });

  test('unknown subcommand exits with code 1', () => {
    const result = spawnCli(['not-a-command']);
    assert.equal(result.status, 1, 'unknown subcommand should exit 1');
  });

  test('no arguments exits with code 1', () => {
    const result = spawnCli([]);
    assert.equal(result.status, 1, 'no arguments should exit 1');
  });
});

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

describe('exit codes', () => {
  test('review against empty fixture exits 3 (unengagedOnly)', async () => {
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
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.equal(
        result.status,
        3,
        `Expected exit 3 for unengaged empty fixture\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      assert.ok(result.stdout.includes('has no user conversation yet'));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review against typical fixture exits 0', async () => {
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
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.equal(
        result.status,
        0,
        `Expected exit 0, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes('### User') ||
          result.stdout.includes('session-observer'),
        'output should contain markdown content',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// locate --json
// ---------------------------------------------------------------------------

describe('locate --json', () => {
  test('locate --json outputs parseable JSON with winner/fallbacks', async () => {
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
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.ok(
        result.status === 0 || result.status === 2,
        `Expected exit 0 or 2 for locate, got ${result.status}\nstderr: ${result.stderr}`,
      );

      if (result.status === 0) {
        let parsed: any;
        assert.doesNotThrow(() => {
          parsed = JSON.parse(result.stdout);
        }, 'stdout should be valid JSON');
        assert.ok(
          'winner' in parsed || 'noMatch' in parsed,
          'JSON should contain winner or noMatch key',
        );
        assert.ok(
          'fallbacks' in parsed || 'noMatch' in parsed,
          'JSON should contain fallbacks or noMatch',
        );
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('locate --debug --json includes Claude lookup diagnostics', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const cwd =
        '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5';
      const encodedCwd =
        '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        [
          'locate',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--json',
          '--debug',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.equal(
        result.status,
        0,
        `Expected exit 0 for locate debug, got ${result.status}\nstderr: ${result.stderr}`,
      );

      const parsed = JSON.parse(result.stdout);
      assert.ok(
        parsed.lookupDiagnostics?.claudeCode,
        'lookupDiagnostics.claudeCode should be present',
      );
      assert.ok(
        parsed.lookupDiagnostics.claudeCode.some(
          (d: any) => d.encoded === encodedCwd && d.exists === true,
        ),
        'diagnostics should include the expected encoded dir and existence',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('locate --snippet reports matched session before use', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const cwd = '/test/snippet-project';
      const encodedCwd = '-test-snippet-project';
      const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(projectDir, { recursive: true });
      await copyFile(typicalClaude, join(projectDir, 'session-001.jsonl'));

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        [
          'locate',
          '--runtime',
          'claude-code',
          '--cwd',
          cwd,
          '--json',
          '--snippet',
          'Hello',
        ],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.equal(
        result.status,
        0,
        `Expected exit 0 for locate snippet, got ${result.status}\nstderr: ${result.stderr}`,
      );

      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.winner.sessionId, 'cc-session-001');
      assert.equal(parsed.snippet.query, 'Hello');
      assert.equal(parsed.snippet.matches.length, 1);
      assert.equal(parsed.snippet.matches[0].sessionId, 'cc-session-001');
      assert.ok(
        parsed.snippet.matches[0].snippetMatch.context.includes('Hello'),
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// --runtime auto
// ---------------------------------------------------------------------------

describe('--runtime auto', () => {
  test('auto with SESSION_OBSERVER_SELF=claude-code resolves to codex', async () => {
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
        },
      );
      // Should try codex (the peer), find no transcripts → exit 2
      assert.equal(
        result.status,
        2,
        `Expected exit 2 (noMatch) when peer runtime has no transcripts, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto with SESSION_OBSERVER_SELF=codex resolves to claude-code', async () => {
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
        },
      );
      // Should try claude-code (the peer), find no transcripts → exit 2
      assert.equal(
        result.status,
        2,
        `Expected exit 2 (noMatch) when peer runtime has no transcripts, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto with no env hint and no candidates in either runtime → exit 2', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(
        ['review', '--runtime', 'auto', '--cwd', '/nonexistent-project'],
        {
          HOME: tmpDir,
          STATE_DIR: stateDir,
        },
      );
      // No candidates in either runtime → exit 2 or 3
      assert.ok(
        result.status === 2 || result.status === 3,
        `Expected exit 2 or 3 when no candidates in either runtime, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto with SESSION_OBSERVER_SELF chooses the only other runtime with candidates', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-auto-self-cursor-'));
    try {
      const cwd = '/test/cursor-peer-project';
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await copyCursorTranscript(tmpDir, cwd, 'cursor-peer');

      const result = spawnCli(
        ['review', '--runtime', 'auto', '--cwd', cwd, '--json'],
        {
          HOME: tmpDir,
          STATE_DIR: stateDir,
          SESSION_OBSERVER_SELF: 'claude-code',
        },
      );

      assert.equal(
        result.status,
        0,
        `Expected auto runtime to choose cursor, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.runtime, 'cursor');
      assert.equal(parsed.sessionId, 'cursor-peer');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto with SESSION_OBSERVER_SELF returns ambiguousRuntime when multiple other runtimes match', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-auto-self-ambiguous-'));
    try {
      const cwd = '/test/multi-peer-project';
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await copyCursorTranscript(tmpDir, cwd, 'cursor-peer');

      const codexDir = join(tmpDir, '.codex', 'sessions', '2026', '05', '17');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'codex-peer.jsonl'),
        [
          JSON.stringify({
            sessionId: 'codex-peer',
            payload: { type: 'session_meta', cwd },
          }),
          JSON.stringify({
            sessionId: 'codex-peer',
            payload: {
              type: 'message',
              role: 'assistant',
              content: 'Codex peer visible.',
            },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const result = spawnCli(
        ['review', '--runtime', 'auto', '--cwd', cwd, '--json'],
        {
          HOME: tmpDir,
          STATE_DIR: stateDir,
          SESSION_OBSERVER_SELF: 'claude-code',
        },
      );

      assert.equal(
        result.status,
        3,
        `Expected ambiguousRuntime, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.ambiguousRuntime, true);
      assert.deepEqual(parsed.runtimes.toSorted(), ['codex', 'cursor']);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto prefers a previously read runtime for the same cwd when both runtimes match', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-auto-state-'));
    try {
      const cwd = '/test/dual-runtime-project';
      const encodedCwd = '-test-dual-runtime-project';

      const claudeProjectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(claudeProjectDir, { recursive: true });
      const claudePath = join(claudeProjectDir, 'claude-dual.jsonl');
      await writeFile(
        claudePath,
        [
          JSON.stringify({
            sessionId: 'cc-dual',
            message: { role: 'user', content: 'Please inspect this project.' },
          }),
          JSON.stringify({
            sessionId: 'cc-dual',
            message: { role: 'assistant', content: 'Claude visible.' },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const codexDir = join(tmpDir, '.codex', 'sessions', '2026', '05', '17');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'codex-dual.jsonl'),
        [
          JSON.stringify({
            sessionId: 'codex-dual',
            payload: { type: 'session_meta', cwd },
          }),
          JSON.stringify({
            sessionId: 'codex-dual',
            payload: {
              type: 'message',
              role: 'assistant',
              content: 'Codex visible.',
            },
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
            'claude-code:cc-dual': {
              runtime: 'claude-code',
              sessionId: 'cc-dual',
              transcriptPath: claudePath,
              recordedCwd: cwd,
              lastRecordIndex: 1,
              lastTotalRecords: 2,
              lastReadAt: '2026-05-17T12:00:00.000Z',
              watchedByPid: null,
            },
          },
        }),
        'utf8',
      );

      const result = spawnCli(
        ['catch-up', '--runtime', 'auto', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.equal(
        result.status,
        0,
        `Expected auto runtime to use state preference, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.runtime, 'claude-code');
      assert.equal(parsed.sessionId, 'cc-dual');
      assert.equal(parsed.entries[0].text, 'Claude visible.');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('auto prefers the only previously read same-cwd runtime across three matching runtimes', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-auto-three-state-'));
    try {
      const cwd = '/test/three-runtime-project';
      const encodedCwd = '-test-three-runtime-project';

      const claudeProjectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
      await mkdir(claudeProjectDir, { recursive: true });
      await writeFile(
        join(claudeProjectDir, 'claude-three.jsonl'),
        JSON.stringify({
          sessionId: 'cc-three',
          message: { role: 'assistant', content: 'Claude visible.' },
        }) + '\n',
        'utf8',
      );

      const codexDir = join(tmpDir, '.codex', 'sessions', '2026', '05', '17');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'codex-three.jsonl'),
        [
          JSON.stringify({
            sessionId: 'codex-three',
            payload: { type: 'session_meta', cwd },
          }),
          JSON.stringify({
            sessionId: 'codex-three',
            payload: {
              type: 'message',
              role: 'assistant',
              content: 'Codex visible.',
            },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const cursorPath = await copyCursorTranscript(
        tmpDir,
        cwd,
        'cursor-three',
      );

      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await writeFile(
        join(stateDir, 'state.json'),
        JSON.stringify({
          schemaVersion: 1,
          sessions: {
            'cursor:cursor-three': {
              runtime: 'cursor',
              sessionId: 'cursor-three',
              transcriptPath: cursorPath,
              recordedCwd: cwd,
              lastRecordIndex: 0,
              lastTotalRecords: 0,
              lastReadAt: '2026-05-17T12:00:00.000Z',
              watchedByPid: null,
            },
          },
        }),
        'utf8',
      );

      const result = spawnCli(
        ['catch-up', '--runtime', 'auto', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      assert.equal(
        result.status,
        0,
        `Expected auto runtime to use cursor state preference, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.runtime, 'cursor');
      assert.equal(parsed.sessionId, 'cursor-three');
      assert.equal(parsed.entries[0].text, 'Can you inspect the failing test?');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// --session override: tie recovery and no-match recovery
// ---------------------------------------------------------------------------

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

      assert.equal(
        result.status,
        0,
        `auto + pinned cursor session should bypass runtime ambiguity\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.runtime, 'cursor');
      assert.equal(parsed.sessionId, 'cursor-pinned-auto');
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

      assert.equal(
        result.status,
        0,
        `auto + pinned cursor catch-up should bypass runtime ambiguity\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.runtime, 'cursor');
      assert.equal(parsed.sessionId, 'cursor-pinned-catchup');
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

      assert.equal(
        result.status,
        0,
        `--session should accept cursor, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.runtime, 'cursor');
      assert.equal(parsed.sessionId, 'cursor-pinned');
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
      // Either exit 0 (one wins outright) or exit 3 (tie) — depends on file timestamps.
      // We'll proceed to test --session regardless.

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
      assert.ok(winner, 'locate should return a winner');

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

      assert.equal(
        pinnedResult.status,
        0,
        `--session should resolve to exit 0, got ${pinnedResult.status}\nstdout: ${pinnedResult.stdout}\nstderr: ${pinnedResult.stderr}`,
      );

      const digestData = JSON.parse(pinnedResult.stdout);
      assert.ok(
        digestData.entries || digestData.range,
        'should return a digest object',
      );
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
      assert.ok(winner, 'locate should return a winner');

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

      assert.equal(
        pinnedResult.status,
        0,
        `catch-up --session should resolve to exit 0, got ${pinnedResult.status}\nstdout: ${pinnedResult.stdout}\nstderr: ${pinnedResult.stderr}`,
      );

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
      assert.equal(
        secondPinnedResult.status,
        0,
        `second pinned catch-up should exit 0\nstdout: ${secondPinnedResult.stdout}\nstderr: ${secondPinnedResult.stderr}`,
      );

      const after = JSON.parse(await readFile(statePath, 'utf8'));
      assert.deepEqual(
        after,
        before,
        'pinned no-op catch-up should not rewrite matching state',
      );
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

      assert.equal(
        result.status,
        0,
        `watched catch-up should still succeed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes(
          'watcher pid 12345 is also reading this session',
        ),
      );
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

      assert.equal(
        result.status,
        1,
        `--session with non-existent id should exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
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

      assert.equal(
        result.status,
        1,
        `--session without colon should exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// state subcommand
// ---------------------------------------------------------------------------

describe('state subcommand', () => {
  test('state get exits 0 with empty state', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['state', 'get'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `state get should exit 0\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('state clear exits 0', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['state', 'clear'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `state clear should exit 0\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('state reset --runtime codex exits 0', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['state', 'reset', '--runtime', 'codex'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `state reset should exit 0\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('state reset --runtime cursor exits 0', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      const result = spawnCli(['state', 'reset', '--runtime', 'cursor'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `state reset should exit 0\nstderr: ${result.stderr}`,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('state reset --session <r>:<id> resets one entry and leaves others intact', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    try {
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });

      // Pre-populate state.json with two sessions, both with non-zero offsets.
      const initialState = {
        schemaVersion: 1,
        sessions: {
          'codex:abc123': {
            runtime: 'codex',
            sessionId: 'abc123',
            transcriptPath: '/tmp/codex.jsonl',
            recordedCwd: '/tmp',
            lastRecordIndex: 42,
            lastTotalRecords: 42,
            lastReadAt: '2026-05-14T10:00:00.000Z',
          },
          'claude-code:xyz789': {
            runtime: 'claude-code',
            sessionId: 'xyz789',
            transcriptPath: '/tmp/claude.jsonl',
            recordedCwd: '/tmp',
            lastRecordIndex: 17,
            lastTotalRecords: 17,
            lastReadAt: '2026-05-14T09:00:00.000Z',
          },
        },
      };
      await writeFile(
        join(stateDir, 'state.json'),
        JSON.stringify(initialState, null, 2),
        'utf8',
      );

      // Reset only codex:abc123.
      const result = spawnCli(['state', 'reset', '--session', 'codex:abc123'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        result.status,
        0,
        `state reset --session should exit 0\nstderr: ${result.stderr}`,
      );

      // Verify via state get --json that codex:abc123 is zeroed and claude-code:xyz789 is untouched.
      const getResult = spawnCli(['state', 'get', '--json'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      assert.equal(
        getResult.status,
        0,
        `state get should exit 0\nstderr: ${getResult.stderr}`,
      );

      const state = JSON.parse(getResult.stdout);
      const codexSession = state.sessions['codex:abc123'];
      const claudeSession = state.sessions['claude-code:xyz789'];

      assert.ok(
        codexSession,
        'codex:abc123 session should still exist in state',
      );
      assert.equal(
        codexSession.lastRecordIndex,
        0,
        'codex:abc123 lastRecordIndex should be reset to 0',
      );
      assert.equal(
        codexSession.lastTotalRecords,
        0,
        'codex:abc123 lastTotalRecords should be reset to 0',
      );

      assert.ok(
        claudeSession,
        'claude-code:xyz789 session should still exist in state',
      );
      assert.equal(
        claudeSession.lastRecordIndex,
        17,
        'claude-code:xyz789 lastRecordIndex should be unchanged',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
