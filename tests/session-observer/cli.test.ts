/**
 * cli.test.ts — Tests for scripts/session-observer.mjs CLI
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  mkdtemp,
  rm,
  mkdir,
  copyFile,
  readFile,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, describe, test } from 'vitest';

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
const typicalCodex = join(FIXTURES, 'codex', 'typical.jsonl');
const typicalCursor = join(FIXTURES, 'cursor', 'typical.jsonl');

const HARNESS_ENV = {
  CLAUDECODE: '',
  CLAUDE_CODE_ENTRYPOINT: '',
  CLAUDE_CODE_SESSION_ID: '',
  CLAUDE_SESSION_ID: '',
  CODEX_THREAD_ID: '',
  CODEX_SESSION_ID: '',
  CODEX_SANDBOX: '',
  OPENAI_CODEX_SESSION_ID: '',
  CURSOR_TRACE_ID: '',
  CURSOR_AGENT: '',
  CURSOR_SESSION_ID: '',
};

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
    env: { ...process.env, ...HARNESS_ENV, ...env },
  });
}

function cursorSlug(cwd: string): string {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
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

async function copyClaudeTranscript(
  home: string,
  cwd: string,
  sessionId: string,
): Promise<string> {
  const projectDir = join(
    home,
    '.claude',
    'projects',
    cwd.replace(/[/.]/g, '-'),
  );
  await mkdir(projectDir, { recursive: true });
  const transcriptPath = join(projectDir, `${sessionId}.jsonl`);
  const fixture = await readFile(typicalClaude, 'utf8');
  await writeFile(
    transcriptPath,
    fixture.replaceAll('cc-session-001', sessionId),
    'utf8',
  );
  return transcriptPath;
}

async function copyCodexTranscript(
  home: string,
  cwd: string,
  sessionId: string,
): Promise<string> {
  const transcriptDir = join(home, '.codex', 'sessions', '2026', '07', '12');
  await mkdir(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, `${sessionId}.jsonl`);
  const fixture = await readFile(typicalCodex, 'utf8');
  await writeFile(
    transcriptPath,
    `${JSON.stringify({ sessionId, payload: { type: 'session_meta', cwd } })}\n${fixture}`,
    'utf8',
  );
  return transcriptPath;
}

// ---------------------------------------------------------------------------
// Basic dispatch tests
// ---------------------------------------------------------------------------

describe('CLI subcommand dispatch', () => {
  test('--help lists whoami command surface', () => {
    const result = spawnCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('whoami');
  });

  test('whoami resolves explicit, harness, and ambiguous identities', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cli-whoami-'));
    try {
      const cwd = join(home, 'Code', 'project');
      const one = await copyCursorTranscript(home, cwd, 'cursor-one');
      let result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        SESSION_OBSERVER_SELF: 'cursor:cursor-one',
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        runtime: 'cursor',
        session: 'cursor-one',
        transcript: one,
        source: 'explicit-self',
      });

      result = spawnCli(['whoami', '--cwd', cwd], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        CODEX_THREAD_ID: '',
        CURSOR_SESSION_ID: 'cursor-one',
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      expect(result.stdout).toContain('harness-environment');

      await copyCursorTranscript(home, cwd, 'cursor-two');
      result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        SESSION_OBSERVER_SELF: 'cursor',
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(3);
      const payload = JSON.parse(result.stdout);
      expect(payload.ambiguousIdentity).toBe(true);
      expect(
        payload.candidates
          .map((candidate: any) => candidate.sessionId)
          .toSorted(),
      ).toEqual(['cursor-one', 'cursor-two']);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test('whoami recognizes supported harness aliases and runtime-only fallback', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cli-whoami-harnesses-'));
    try {
      const cwd = join(home, 'Code', 'project');
      await copyClaudeTranscript(home, cwd, 'claude-one');
      await copyCodexTranscript(home, cwd, 'codex-one');
      await copyCursorTranscript(home, cwd, 'cursor-one');

      const cases = [
        ['CLAUDE_CODE_SESSION_ID', 'claude-one', 'claude-code'],
        ['OPENAI_CODEX_SESSION_ID', 'codex-one', 'codex'],
        ['CURSOR_SESSION_ID', 'cursor-one', 'cursor'],
        ['CLAUDECODE', '1', 'claude-code'],
        ['CLAUDE_CODE_ENTRYPOINT', 'cli', 'claude-code'],
        ['CODEX_SANDBOX', 'workspace-write', 'codex'],
        ['CURSOR_TRACE_ID', 'trace-one', 'cursor'],
        ['CURSOR_AGENT', '1', 'cursor'],
      ] as const;

      for (const [name, value, runtime] of cases) {
        const result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
          HOME: home,
          STATE_DIR: join(home, '.state'),
          [name]: value,
        });
        expect(
          result.status,
          `${name}: ${result.stderr}\n${result.stdout}`,
        ).toBe(0);
        const payload = JSON.parse(result.stdout);
        expect(payload.runtime).toBe(runtime);
        expect(payload.source).toBe(
          name.endsWith('SESSION_ID')
            ? 'harness-environment'
            : 'same-cwd-transcript',
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test('whoami scopes runtime-only Codex fallback to the requested cwd', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cli-whoami-codex-cwd-'));
    try {
      const cwd = join(home, 'Code', 'project');
      const sameCwdTranscript = await copyCodexTranscript(
        home,
        cwd,
        'codex-same-cwd',
      );
      const unrelatedTranscript = await copyCodexTranscript(
        home,
        join(home, 'Code', 'unrelated-project'),
        'codex-newer-unrelated-cwd',
      );
      const newerMtime = new Date(Date.now() + 1_000);
      await utimes(unrelatedTranscript, newerMtime, newerMtime);

      const result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        CODEX_SANDBOX: 'workspace-write',
      });

      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        runtime: 'codex',
        session: 'codex-same-cwd',
        transcript: sameCwdTranscript,
        source: 'same-cwd-transcript',
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test('whoami returns ambiguity candidates for conflicting harness signals and aliases', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cli-whoami-conflicts-'));
    try {
      const cwd = join(home, 'Code', 'project');
      await copyClaudeTranscript(home, cwd, 'claude-one');
      await copyCodexTranscript(home, cwd, 'codex-one');

      let result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(2);
      expect(JSON.parse(result.stdout).noIdentity).toBe(true);

      result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        CLAUDECODE: '1',
        CODEX_SANDBOX: 'workspace-write',
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(3);
      let payload = JSON.parse(result.stdout);
      expect(payload.ambiguousIdentity).toBe(true);
      expect(payload.signals).toEqual(
        expect.arrayContaining([
          { runtime: 'claude-code' },
          { runtime: 'codex' },
        ]),
      );
      expect(
        payload.candidates
          .map(
            (candidate: any) => `${candidate.runtime}:${candidate.sessionId}`,
          )
          .toSorted(),
      ).toEqual(['claude-code:claude-one', 'codex:codex-one']);

      await copyCodexTranscript(home, cwd, 'codex-two');
      result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        CODEX_THREAD_ID: 'codex-one',
        CODEX_SESSION_ID: 'codex-two',
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(3);
      payload = JSON.parse(result.stdout);
      expect(payload.ambiguousIdentity).toBe(true);
      expect(payload.signals).toEqual(
        expect.arrayContaining([
          { runtime: 'codex', sessionId: 'codex-one' },
          { runtime: 'codex', sessionId: 'codex-two' },
        ]),
      );
      expect(
        payload.candidates
          .map((candidate: any) => candidate.sessionId)
          .toSorted(),
      ).toEqual(['codex-one', 'codex-two']);

      await copyCursorTranscript(home, cwd, 'cursor-one');
      await copyCursorTranscript(home, cwd, 'cursor-two');
      result = spawnCli(['whoami', '--cwd', cwd, '--json'], {
        HOME: home,
        STATE_DIR: join(home, '.state'),
        CURSOR_AGENT: '1',
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(3);
      payload = JSON.parse(result.stdout);
      expect(payload.ambiguousIdentity).toBe(true);
      expect(payload.signals).toEqual([{ runtime: 'cursor' }]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test('--help lists cursor as a runtime option', () => {
    const result = spawnCli(['--help']);
    expect(result.status, `help should exit 0\nstderr: ${result.stderr}`).toBe(
      0,
    );
    expect(
      result.stdout.includes('--runtime <claude-code|codex|cursor|auto>'),
      'help should include cursor in the runtime list',
    ).toBeTruthy();
  });

  test('--help lists watch command surface', () => {
    const result = spawnCli(['--help']);
    expect(result.status, `help should exit 0\nstderr: ${result.stderr}`).toBe(
      0,
    );
    expect(
      result.stdout.includes('watch'),
      'help should list watch subcommand',
    ).toBeTruthy();
    expect(
      result.stdout.includes('catch-up-then-watch'),
      'help should list catch-up-then-watch subcommand',
    ).toBeTruthy();
    expect(
      result.stdout.includes('watch-ctl'),
      'help should list watch-ctl subcommand',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--watch'),
      'help should list top-level --watch alias',
    ).toBeTruthy();
  });

  test('watch --help lists watch flags', () => {
    const result = spawnCli(['watch', '--help']);
    expect(
      result.status,
      `watch help should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    ).toBe(0);
    expect(
      result.stdout.includes('--debounce-sec'),
      'watch help should include debounce flag',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--poll-sec'),
      'watch help should include poll flag',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--max-pending-sec'),
      'watch help should include max pending flag',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--max-runtime-min'),
      'watch help should include bounded runtime flag',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--heartbeat-sec'),
      'watch help should include heartbeat flag',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--until-stopped'),
      'watch help should include until-stopped alias',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--interactive'),
      'watch help should include interactive alias',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--event-log'),
      'watch help should include event log flag',
    ).toBeTruthy();
    expect(
      result.stdout.includes('--runtime <claude-code|codex|cursor|auto|both>'),
      'watch help should include both as a watch runtime option',
    ).toBeTruthy();
  });

  test('watch-ctl --help lists control operations', () => {
    const result = spawnCli(['watch-ctl', '--help']);
    expect(
      result.status,
      `watch-ctl help should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    ).toBe(0);
    for (const op of ['status', 'pause', 'resume', 'flush', 'stop']) {
      expect(
        result.stdout.includes(op),
        `watch-ctl help should include ${op}`,
      ).toBeTruthy();
    }
  });

  test('--watch --help maps to watch help', () => {
    const canonical = spawnCli(['watch', '--help']);
    const alias = spawnCli(['--watch', '--help']);
    expect(
      alias.status,
      `--watch help should exit 0\nstdout: ${alias.stdout}\nstderr: ${alias.stderr}`,
    ).toBe(0);
    expect(
      alias.stdout,
      '--watch --help should print the same help as watch --help',
    ).toBe(canonical.stdout);
  });

  test('catch-up-then-watch --help maps to watch help with command name', () => {
    const result = spawnCli(['catch-up-then-watch', '--help']);
    expect(
      result.status,
      `catch-up-then-watch help should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    ).toBe(0);
    expect(
      result.stdout.includes(
        'Usage: session-observer catch-up-then-watch [options]',
      ),
    ).toBeTruthy();
    expect(result.stdout.includes('--heartbeat-sec')).toBeTruthy();
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

      expect(
        result.status,
        `watch-ctl status should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.noActiveWatcher).toBe(true);
      expect(parsed.active).toBe(false);
      expect(parsed.watcher).toBe(null);
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
        expect(
          result.status,
          `watch-ctl ${op} should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        ).toBe(0);

        const payload = JSON.parse(result.stdout);
        expect(payload.directive).toBe(op);
        expect(payload.control.directive).toBe(op);
        expect(payload.control.pid).toBe(process.pid);

        const raw = JSON.parse(
          await readFile(
            join(stateDir, `watch.control.${process.pid}.json`),
            'utf8',
          ),
        );
        expect(raw.directive).toBe(op);
        expect(raw.pid).toBe(process.pid);
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
      expect(
        result.status,
        `lone-watcher control should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.directive).toBe('pause');
      expect(payload.control.pid).toBe(process.pid);

      // An explicit --cwd that matches nothing is a hard filter and must not
      // fall back; it reports the active watchers instead.
      const filtered = spawnCli(
        ['watch-ctl', 'pause', '--cwd', '/test/not-a-watcher-cwd', '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(
        filtered.status,
        `explicit cwd miss should exit 3\nstdout: ${filtered.stdout}\nstderr: ${filtered.stderr}`,
      ).toBe(3);
      const filteredPayload = JSON.parse(filtered.stdout);
      expect(filteredPayload.noMatchingWatcher).toBe(true);
      expect(filteredPayload.watchers.length).toBe(1);
      expect(filteredPayload.watchers[0].pid).toBe(process.pid);
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
      expect(
        ambiguous.status,
        `ambiguous control should exit 3\nstdout: ${ambiguous.stdout}\nstderr: ${ambiguous.stderr}`,
      ).toBe(3);
      const ambiguousPayload = JSON.parse(ambiguous.stdout);
      expect(ambiguousPayload.ambiguousWatcher).toBe(true);
      expect(ambiguousPayload.watchers.length).toBe(2);

      const selected = spawnCli(
        ['watch-ctl', 'pause', '--cwd', cwd, '--runtime', 'codex', '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(
        selected.status,
        `selected control should exit 0\nstdout: ${selected.stdout}\nstderr: ${selected.stderr}`,
      ).toBe(0);
      const payload = JSON.parse(selected.stdout);
      expect(payload.control.pid).toBe(firstPid);
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

        expect(
          result.status,
          `watch-ctl ${op} should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        ).toBe(0);
        const payload = JSON.parse(result.stdout);
        expect(payload.noActiveWatcher).toBe(true);
        expect(payload.active).toBe(false);
        expect(payload.watcher).toBe(null);
        expect(
          await readJsonIfExists(join(stateDir, 'watch.control.json')),
        ).toBe(null);
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
      expect(
        escape.status,
        `watch with escaping event log should exit 1\nstdout: ${escape.stdout}\nstderr: ${escape.stderr}`,
      ).toBe(1);
      const escapeEvent = JSON.parse(escape.stdout.trim());
      expect(escapeEvent.type).toBe('error');
      expect(
        escapeEvent.ts,
        'error event should carry a timestamp',
      ).toBeTruthy();
      expect(
        escapeEvent.message.length > 0,
        'error event should carry a message',
      ).toBeTruthy();

      const invalid = spawnCli(['watch', '--json', '--runtime', 'bogus'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      expect(invalid.status).toBe(1);
      const invalidEvent = JSON.parse(invalid.stdout.trim());
      expect(invalidEvent.type).toBe('error');
      expect(invalidEvent.message).toMatch(/Unknown watch runtime/);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('review --help does not throw', () => {
    const result = spawnCli(['review', '--help']);
    // --help exits 0 or 1; should not crash with code 127 or similar
    // (exits 2 or 3 are also valid if runtime auto-resolution kicks in first)
    expect(result.status !== null, 'should have an exit code').toBeTruthy();
    expect(
      result.status === 0 ||
        result.status === 1 ||
        result.status === 2 ||
        result.status === 3,
      `unexpected exit code: ${result.status}`,
    ).toBeTruthy();
  });

  test('unknown subcommand exits with code 1', () => {
    const result = spawnCli(['not-a-command']);
    expect(result.status, 'unknown subcommand should exit 1').toBe(1);
  });

  test('no arguments exits with code 1', () => {
    const result = spawnCli([]);
    expect(result.status, 'no arguments should exit 1').toBe(1);
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

      expect(
        result.status,
        `Expected exit 3 for unengaged empty fixture\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(3);
      expect(
        result.stdout.includes('has no user conversation yet'),
      ).toBeTruthy();
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

      expect(
        result.status,
        `Expected exit 0, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      expect(
        result.stdout.includes('### User') ||
          result.stdout.includes('session-observer'),
        'output should contain markdown content',
      ).toBeTruthy();
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

      expect(
        result.status === 0 || result.status === 2,
        `Expected exit 0 or 2 for locate, got ${result.status}\nstderr: ${result.stderr}`,
      ).toBeTruthy();

      if (result.status === 0) {
        let parsed: any;
        expect(() => {
          parsed = JSON.parse(result.stdout);
        }, 'stdout should be valid JSON').not.toThrow();
        expect(
          'winner' in parsed || 'noMatch' in parsed,
          'JSON should contain winner or noMatch key',
        ).toBeTruthy();
        expect(
          'fallbacks' in parsed || 'noMatch' in parsed,
          'JSON should contain fallbacks or noMatch',
        ).toBeTruthy();
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

      expect(
        result.status,
        `Expected exit 0 for locate debug, got ${result.status}\nstderr: ${result.stderr}`,
      ).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(
        parsed.lookupDiagnostics?.claudeCode,
        'lookupDiagnostics.claudeCode should be present',
      ).toBeTruthy();
      expect(
        parsed.lookupDiagnostics.claudeCode.some(
          (d: any) => d.encoded === encodedCwd && d.exists === true,
        ),
        'diagnostics should include the expected encoded dir and existence',
      ).toBeTruthy();
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

      expect(
        result.status,
        `Expected exit 0 for locate snippet, got ${result.status}\nstderr: ${result.stderr}`,
      ).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.winner.sessionId).toBe('cc-session-001');
      expect(parsed.snippet.query).toBe('Hello');
      expect(parsed.snippet.matches.length).toBe(1);
      expect(parsed.snippet.matches[0].sessionId).toBe('cc-session-001');
      expect(
        parsed.snippet.matches[0].snippetMatch.context.includes('Hello'),
      ).toBeTruthy();
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
      expect(
        result.status,
        `Expected exit 2 (noMatch) when peer runtime has no transcripts, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(2);
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
      expect(
        result.status,
        `Expected exit 2 (noMatch) when peer runtime has no transcripts, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(2);
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
      expect(
        result.status === 2 || result.status === 3,
        `Expected exit 2 or 3 when no candidates in either runtime, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBeTruthy();
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

      expect(
        result.status,
        `Expected auto runtime to choose cursor, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-peer');
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

      expect(
        result.status,
        `Expected ambiguousRuntime, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(3);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.ambiguousRuntime).toBe(true);
      expect(parsed.runtimes.toSorted()).toEqual(['codex', 'cursor']);
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

      expect(
        result.status,
        `Expected auto runtime to use state preference, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.runtime).toBe('claude-code');
      expect(parsed.sessionId).toBe('cc-dual');
      expect(parsed.entries[0].text).toBe('Claude visible.');
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

      expect(
        result.status,
        `Expected auto runtime to use cursor state preference, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.runtime).toBe('cursor');
      expect(parsed.sessionId).toBe('cursor-three');
      expect(parsed.entries[0].text).toBe('Can you inspect the failing test?');
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
      expect(
        result.status,
        `state get should exit 0\nstderr: ${result.stderr}`,
      ).toBe(0);
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
      expect(
        result.status,
        `state clear should exit 0\nstderr: ${result.stderr}`,
      ).toBe(0);
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
      expect(
        result.status,
        `state reset should exit 0\nstderr: ${result.stderr}`,
      ).toBe(0);
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
      expect(
        result.status,
        `state reset should exit 0\nstderr: ${result.stderr}`,
      ).toBe(0);
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
      expect(
        result.status,
        `state reset --session should exit 0\nstderr: ${result.stderr}`,
      ).toBe(0);

      // Verify via state get --json that codex:abc123 is zeroed and claude-code:xyz789 is untouched.
      const getResult = spawnCli(['state', 'get', '--json'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      expect(
        getResult.status,
        `state get should exit 0\nstderr: ${getResult.stderr}`,
      ).toBe(0);

      const state = JSON.parse(getResult.stdout);
      const codexSession = state.sessions['codex:abc123'];
      const claudeSession = state.sessions['claude-code:xyz789'];

      expect(
        codexSession,
        'codex:abc123 session should still exist in state',
      ).toBeTruthy();
      expect(
        codexSession.lastRecordIndex,
        'codex:abc123 lastRecordIndex should be reset to 0',
      ).toBe(0);
      expect(
        codexSession.lastTotalRecords,
        'codex:abc123 lastTotalRecords should be reset to 0',
      ).toBe(0);

      expect(
        claudeSession,
        'claude-code:xyz789 session should still exist in state',
      ).toBeTruthy();
      expect(
        claudeSession.lastRecordIndex,
        'claude-code:xyz789 lastRecordIndex should be unchanged',
      ).toBe(17);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
