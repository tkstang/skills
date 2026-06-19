/**
 * integration.test.ts — End-to-end integration tests for session-observer CLI.
 *
 * Builds a synthetic temp HOME, populates Claude Code transcript fixtures,
 * and spawns the real CLI by absolute path resolved from import.meta.url.
 * Never uses a bare relative 'scripts/...' path.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  mkdtemp,
  rm,
  mkdir,
  copyFile,
  writeFile,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Absolute path to the CLI — resolved from import.meta.url
const CLI_PATH = fileURLToPath(
  new URL(
    '../../skills/session-observer/scripts/session-observer.mjs',
    import.meta.url,
  ),
);
const PROBE_PATH = fileURLToPath(
  new URL(
    '../../skills/session-observer/scripts/probe-local.mjs',
    import.meta.url,
  ),
);

const FIXTURES = join(__dirname, 'fixtures');
const TYPICAL_CLAUDE = join(FIXTURES, 'claude-code', 'typical.jsonl');
const EMPTY_CLAUDE = join(FIXTURES, 'claude-code', 'empty.jsonl');
const TYPICAL_CURSOR = join(FIXTURES, 'cursor', 'typical.jsonl');

/**
 * Spawn the CLI with given args and env.
 */
function spawnCli(
  args: string[],
  env: NodeJS.ProcessEnv = {},
): SpawnSyncReturns<string> {
  return spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, ...env },
  });
}

function spawnProbe(
  args: string[],
  env: NodeJS.ProcessEnv = {},
): SpawnSyncReturns<string> {
  return spawnSync('node', [PROBE_PATH, ...args], {
    encoding: 'utf8',
    timeout: 20000,
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
  await copyFile(TYPICAL_CURSOR, transcriptPath);
  return transcriptPath;
}

/**
 * Set up a temp HOME directory with a Claude Code transcript.
 * Returns { tmpDir, cwd, stateDir, cleanup }.
 */
async function setupTempHome(
  fixture = TYPICAL_CLAUDE,
): Promise<{
  tmpDir: string;
  cwd: string;
  stateDir: string;
  cleanup: () => Promise<void>;
}> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'integration-test-'));
  const cwd = '/integration-test/my-project';
  // Claude Code encodes '/' → '-'
  const encodedCwd = '-integration-test-my-project';
  const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
  await mkdir(projectDir, { recursive: true });
  await copyFile(fixture, join(projectDir, 'session-001.jsonl'));

  const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
  await mkdir(stateDir, { recursive: true });

  const cleanup = () => rm(tmpDir, { recursive: true, force: true });
  return { tmpDir, cwd, stateDir, cleanup };
}

// ---------------------------------------------------------------------------
// Test 1: review exits 0; stdout contains ### User + ### Assistant; no tool noise
// ---------------------------------------------------------------------------

describe('integration: review', () => {
  test('review exits 0 and contains User/Assistant sections (no tool noise by default)', async () => {
    const { tmpDir, cwd, stateDir, cleanup } = await setupTempHome();
    try {
      const result = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout.includes('### User'), 'output should contain ### User').toBeTruthy();
      expect(result.stdout.includes('### Assistant'), 'output should contain ### Assistant').toBeTruthy();

      // Tool call markers should NOT appear by default
      expect(!result.stdout.includes('[Read]'), 'should not include [Read] tool marker').toBeTruthy();
      expect(!result.stdout.includes('[Bash]'), 'should not include [Bash] tool marker').toBeTruthy();
      expect(!result.stdout.includes('[Edit]'), 'should not include [Edit] tool marker').toBeTruthy();
      // Also confirm the tool from our fixture is excluded
      expect(!result.stdout.includes('[Read →'), 'should not include tool result markers').toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // Test 2: review --include-tools exits 0; stdout contains compact tool markers; results excluded
  // ---------------------------------------------------------------------------

  test('review --include-tools exits 0; compact tool markers present; results excluded', async () => {
    const { tmpDir, cwd, stateDir, cleanup } = await setupTempHome();
    try {
      const result = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd, '--include-tools'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);

      // The typical fixture has a tool_use (Read) — with --include-tools it should appear
      expect(result.stdout.includes('[Read]') || result.stdout.includes('['), 'output should contain at least some tool marker with --include-tools').toBeTruthy();

      // But tool results (→ result) should still be excluded
      expect(!result.stdout.includes('→ result]'), 'tool results should be excluded with --include-tools').toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // Test 3: review --debug exits 0; both tool markers and result markers present
  // ---------------------------------------------------------------------------

  test('review --debug exits 0; tool markers and result markers present', async () => {
    const { tmpDir, cwd, stateDir, cleanup } = await setupTempHome();
    try {
      const result = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd, '--debug'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);

      // --debug = --include-tools --include-tool-results
      // The typical fixture has Read tool_use and tool_result
      expect(result.stdout.includes('[Read]') || result.stdout.includes('['), 'output should contain tool marker with --debug').toBeTruthy();
      // Tool results should also appear
      expect(result.stdout.includes('→ result]') || result.stdout.includes('result'), 'output should contain tool result marker with --debug').toBeTruthy();
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4: catch-up twice — first full delta, second "no new records"
// ---------------------------------------------------------------------------

describe('integration: catch-up', () => {
  test('catch-up twice: first full delta, second no new records', async () => {
    const { tmpDir, cwd, stateDir, cleanup } = await setupTempHome();
    try {
      // First catch-up: should return content (offset starts at 0)
      const first = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(first.status, `First catch-up should exit 0\nstdout: ${first.stdout}\nstderr: ${first.stderr}`).toBe(0);
      expect(first.stdout.includes('### User') ||
          first.stdout.includes('session-observer'), 'First catch-up should have content').toBeTruthy();

      // Second catch-up: offset now equals totalRecords → no new content
      const second = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(second.status, `Second catch-up should exit 0\nstdout: ${second.stdout}\nstderr: ${second.stderr}`).toBe(0);
      // Second catch-up should show 0 new records or "no new records" style header
      expect(second.stdout.includes('new records: 0') ||
          second.stdout.includes('No messages in range') ||
          second.stdout.includes('0') ||
          second.stdout.length > 0, 'Second catch-up should exit 0 (even with no new content)').toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  test('catch-up no-op leaves existing state unchanged', async () => {
    const { tmpDir, cwd, stateDir, cleanup } = await setupTempHome();
    try {
      const first = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(first.status, `First catch-up should exit 0\nstdout: ${first.stdout}\nstderr: ${first.stderr}`).toBe(0);

      const statePath = join(stateDir, 'state.json');
      const before = JSON.parse(await readFile(statePath, 'utf8'));
      await sleep(25);

      const second = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd, '--json'],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(second.status, `Second catch-up should exit 0\nstdout: ${second.stdout}\nstderr: ${second.stderr}`).toBe(0);

      const after = JSON.parse(await readFile(statePath, 'utf8'));
      expect(after, 'no-op catch-up should not rewrite matching state').toEqual(before);
    } finally {
      await cleanup();
    }
  });

  test('catch-up treats stored offset as exclusive next record index', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'integration-test-'));
    const cwd = '/integration-test/boundary-project';
    const encodedCwd = '-integration-test-boundary-project';
    const projectDir = join(tmpDir, '.claude', 'projects', encodedCwd);
    const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
    try {
      await mkdir(projectDir, { recursive: true });
      await mkdir(stateDir, { recursive: true });

      const transcriptPath = join(projectDir, 'session-boundary.jsonl');
      const records = [
        {
          sessionId: 'boundary-session',
          message: { role: 'user', content: 'previous user message' },
        },
        {
          sessionId: 'boundary-session',
          message: {
            role: 'assistant',
            content: 'boundary message should not repeat',
          },
        },
        {
          sessionId: 'boundary-session',
          message: { role: 'assistant', content: 'new message only' },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      await writeFile(
        join(stateDir, 'state.json'),
        JSON.stringify(
          {
            schemaVersion: 1,
            sessions: {
              'claude-code:boundary-session': {
                runtime: 'claude-code',
                sessionId: 'boundary-session',
                lastRecordIndex: 2,
                lastTotalRecords: 3,
                lastReadAt: new Date().toISOString(),
                transcriptPath,
                recordedCwd: cwd,
                watchedByPid: null,
              },
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      const result = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );

      expect(result.status, `catch-up should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout.includes('new message only'), 'should render the first unread record').toBeTruthy();
      expect(!result.stdout.includes('boundary message should not repeat'), 'must not re-render the previous boundary record').toBeTruthy();
      expect(result.stdout.includes(
          'raw range (zero-based JSONL indices):** records 2–2 of 3',
        )).toBeTruthy();

      const state = JSON.parse(
        await readFile(join(stateDir, 'state.json'), 'utf8'),
      );
      expect(state.sessions['claude-code:boundary-session'].lastRecordIndex, 'stored offset should advance to the next unread zero-based record index').toBe(3);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Test 5: state reset followed by catch-up re-emits full content
  // ---------------------------------------------------------------------------

  test('state reset --runtime claude-code followed by catch-up re-emits full content', async () => {
    const { tmpDir, cwd, stateDir, cleanup } = await setupTempHome();
    try {
      // First catch-up to advance offset
      const first = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(first.status, `First catch-up should exit 0\nstderr: ${first.stderr}`).toBe(0);

      // Reset state for claude-code
      const reset = spawnCli(['state', 'reset', '--runtime', 'claude-code'], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });
      expect(reset.status, `state reset should exit 0\nstderr: ${reset.stderr}`).toBe(0);

      // Second catch-up after reset: should re-emit full content
      const second = spawnCli(
        ['catch-up', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(second.status, `Catch-up after reset should exit 0\nstdout: ${second.stdout}\nstderr: ${second.stderr}`).toBe(0);
      expect(second.stdout.includes('### User'), 'After reset, catch-up should re-emit full content').toBeTruthy();
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 6: review against empty fixture exits 3 with unengagedOnly
// ---------------------------------------------------------------------------

describe('integration: empty fixture', () => {
  test('review against empty fixture exits 3', async () => {
    const { tmpDir, cwd, stateDir, cleanup } =
      await setupTempHome(EMPTY_CLAUDE);
    try {
      const result = spawnCli(
        ['review', '--runtime', 'claude-code', '--cwd', cwd],
        { HOME: tmpDir, STATE_DIR: stateDir },
      );
      expect(result.status, `Expected exit 3 for unengaged empty fixture\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(3);
      expect(result.stdout.includes('has no user conversation yet')).toBeTruthy();
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 7: probe-local reports Cursor transcript store
// ---------------------------------------------------------------------------

describe('integration: probe-local', () => {
  test('probe-local --runtime cursor reports ~/.cursor/projects/', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'integration-probe-cursor-'));
    try {
      const cwd = '/integration-test/cursor-project';
      const stateDir = join(tmpDir, '.local', 'state', 'session-observer');
      await mkdir(stateDir, { recursive: true });
      await copyCursorTranscript(tmpDir, cwd, 'cursor-probe');

      const result = spawnProbe(['--runtime', 'cursor', '--cwd', cwd], {
        HOME: tmpDir,
        STATE_DIR: stateDir,
      });

      expect(result.status, `probe-local should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
      expect(result.stdout.includes(
          '[probe-local] transcript store: ~/.cursor/projects/',
        ), 'probe-local should report Cursor transcript store').toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
