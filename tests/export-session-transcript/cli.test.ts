/**
 * cli.test.mjs — End-to-end tests for the export-session-transcript CLI.
 *
 * Each test builds a synthetic temp HOME with per-runtime transcript fixtures,
 * spawns the real CLI by absolute path (resolved from import.meta.url), and
 * injects HOME + --cwd so nothing touches the real ~/Downloads or real stores.
 *
 * Covers: session selection (--match hit/miss, --session, --all), output-path
 * resolution (default ~/Downloads, dir, file, not-a-git-repo fallback, --all
 * naming), end-to-end sanitization, and exit codes 0/1/2/3.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, assert, beforeAll, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLI_PATH = fileURLToPath(
  new URL(
    '../../skills/export-session-transcript/scripts/export-session-transcript.mjs',
    import.meta.url,
  ),
);

const CWD = '/export-test/my-project';
const CLAUDE_SLUG = '-export-test-my-project';
const CURSOR_SLUG = 'export-test-my-project';

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

// A Claude-code transcript with the full hidden-payload set + a marker line.
function claudeTranscript(marker: string, sessionId = 'cc-001'): string {
  const recs = [
    { type: 'summary', sessionId, summary: 'start' },
    {
      type: 'user',
      sessionId,
      message: { role: 'user', content: `EXPORT_SESSION_MARKER=${marker}` },
    },
    {
      type: 'user',
      sessionId,
      message: {
        role: 'user',
        content: '<environment_context><cwd>/x</cwd></environment_context>',
      },
    },
    {
      type: 'user',
      sessionId,
      message: {
        role: 'user',
        content:
          '<system-reminder>The user changed the working directory while you were working.</system-reminder>',
      },
    },
    {
      type: 'user',
      sessionId,
      message: { role: 'system', content: 'You are a helpful assistant.' },
    },
    {
      type: 'user',
      sessionId,
      message: {
        role: 'user',
        content: '# AGENTS.md instructions\n\nRun tests.',
      },
    },
    {
      type: 'user',
      sessionId,
      message: { role: 'user', content: 'Please refactor the auth module.' },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Sure, here is the plan.' },
          {
            type: 'tool_use',
            id: 't1',
            name: 'Read',
            input: { file_path: '/a' },
          },
        ],
      },
    },
    {
      type: 'user',
      sessionId,
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'file body' },
        ],
      },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Done refactoring.' }],
      },
    },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function codexTranscript(
  marker: string,
  sessionId = 'codex-001',
  cwd = CWD,
): string {
  const recs = [
    {
      type: 'session_started',
      sessionId,
      cwd,
      timestamp: '2026-06-05T10:00:00Z',
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'user',
        content: `EXPORT_SESSION_MARKER=${marker}`,
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'user',
        content: '<subagent_notification>done</subagent_notification>',
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'user',
        content: 'How do I read a file in Node?',
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'function_call',
        name: 'shell',
        arguments: { command: 'ls' },
        id: 'fc1',
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'assistant',
        content: 'Use fs.readFile.',
      },
    },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

// A Codex transcript whose session_started record omits cwd → recordedCwd null.
function codexTranscriptNoCwd(
  marker: string,
  sessionId = 'codex-nocwd',
): string {
  const recs = [
    { type: 'session_started', sessionId, timestamp: '2026-06-05T10:00:00Z' },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'user',
        content: `EXPORT_SESSION_MARKER=${marker}`,
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'user',
        content: 'Unrelated cwd-less session.',
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: { type: 'message', role: 'assistant', content: 'Reply.' },
    },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

async function setupHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'export-cli-'));
  await mkdir(join(home, 'Downloads'), { recursive: true });
  return home;
}

async function writeClaude(
  home: string,
  content: string,
  sessionId = 'cc-001',
): Promise<string> {
  const dir = join(home, '.claude', 'projects', CLAUDE_SLUG);
  await mkdir(dir, { recursive: true });
  const p = join(dir, `${sessionId}.jsonl`);
  await writeFile(p, content, 'utf8');
  return p;
}

async function writeCodex(
  home: string,
  content: string,
  sessionId = 'codex-001',
  date: [string, string, string] = ['2026', '06', '05'],
): Promise<string> {
  const dir = join(home, '.codex', 'sessions', ...date);
  await mkdir(dir, { recursive: true });
  const p = join(dir, `session-${sessionId}.jsonl`);
  await writeFile(p, content, 'utf8');
  return p;
}

describe('export CLI — session selection', () => {
  let home = '';
  beforeAll(async () => {
    home = await setupHome();
  });
  afterAll(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test('--match hit selects the exact transcript and exits 0', async () => {
    const marker = 'aaaa1111bbbb';
    await writeClaude(home, claudeTranscript(marker, 'cc-match'), 'cc-match');
    const out = join(home, 'out-match.md');
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--match',
        marker,
        '--out',
        out,
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(md.includes('Please refactor the auth module.'));
    assert.ok(md.includes('Done refactoring.'));
  });

  test('--match miss falls back to newest-for-cwd with a warning, exit 0', async () => {
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--match',
        'no-such-marker',
        '--out',
        join(home, 'out-miss.md'),
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /marker.*not found|fall(ing)? back|warning/i);
  });

  test('--session selects a specific session id, exit 0', async () => {
    await writeClaude(home, claudeTranscript('zzz', 'cc-pinned'), 'cc-pinned');
    const out = join(home, 'out-session.md');
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-pinned',
        '--out',
        out,
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(md.includes('Please refactor the auth module.'));
  });

  test('--all writes one output per cwd session, exit 0', async () => {
    const allHome = await setupHome();
    await writeClaude(allHome, claudeTranscript('m1', 'cc-a'), 'cc-a');
    await writeClaude(allHome, claudeTranscript('m2', 'cc-b'), 'cc-b');
    const outDir = join(allHome, 'allout');
    await mkdir(outDir, { recursive: true });
    const r = spawnCli(
      ['--runtime', 'claude-code', '--cwd', CWD, '--all', '--out', outDir],
      { HOME: allHome },
    );
    assert.equal(r.status, 0, r.stderr);
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 2, `expected 2 files, got ${files.join(', ')}`);
    // --all naming scheme: <branch>-<sessionId>.md
    assert.ok(files.some((f) => f.includes('cc-a')));
    assert.ok(files.some((f) => f.includes('cc-b')));
    await rm(allHome, { recursive: true, force: true });
  });

  test('--all excludes a Codex candidate with unresolved (null) recordedCwd', async () => {
    const cwdHome = await setupHome();
    // One candidate with a matching recordedCwd, one cwd-less (corrupt/partial).
    await writeCodex(cwdHome, codexTranscript('ok1', 'codex-ok'), 'codex-ok');
    await writeCodex(
      cwdHome,
      codexTranscriptNoCwd('bad1', 'codex-nocwd'),
      'codex-nocwd',
    );
    const outDir = join(cwdHome, 'codex-allout');
    await mkdir(outDir, { recursive: true });
    const r = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--all', '--out', outDir],
      { HOME: cwdHome },
    );
    assert.equal(r.status, 0, r.stderr);
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.md'));
    assert.equal(
      files.length,
      1,
      `expected only the cwd-matched session, got ${files.join(', ')}`,
    );
    assert.ok(
      files.some((f) => f.includes('codex-ok')),
      `expected codex-ok, got ${files.join(', ')}`,
    );
    assert.ok(
      !files.some((f) => f.includes('codex-nocwd')),
      `cwd-less session leaked into --all: ${files.join(', ')}`,
    );
    await rm(cwdHome, { recursive: true, force: true });
  });
});

describe('export CLI — output-path resolution', () => {
  test('--out DIR auto-names <dir>/<...>.md', async () => {
    const home = await setupHome();
    await writeClaude(home, claudeTranscript('d1', 'cc-dir'), 'cc-dir');
    const outDir = join(home, 'somedir');
    await mkdir(outDir, { recursive: true });
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-dir',
        '--out',
        outDir,
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 1);
    await rm(home, { recursive: true, force: true });
  });

  test('--out FILE writes verbatim', async () => {
    const home = await setupHome();
    await writeClaude(home, claudeTranscript('f1', 'cc-file'), 'cc-file');
    const out = join(home, 'exact-name.md');
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-file',
        '--out',
        out,
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    await readFile(out, 'utf8'); // throws if missing
    await rm(home, { recursive: true, force: true });
  });

  test('default output lands in ~/Downloads (injected HOME)', async () => {
    const home = await setupHome();
    await writeClaude(home, claudeTranscript('dl1', 'cc-dl'), 'cc-dl');
    const r = spawnCli(
      ['--runtime', 'claude-code', '--cwd', CWD, '--session', 'cc-dl'],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const files = (await readdir(join(home, 'Downloads'))).filter((f) =>
      f.endsWith('.md'),
    );
    assert.equal(
      files.length,
      1,
      `expected 1 file in Downloads, got ${files.join(', ')}`,
    );
    await rm(home, { recursive: true, force: true });
  });

  test('not-a-git-repo cwd uses <cwd-basename>-<stamp>.md fallback name', async () => {
    const home = await setupHome();
    await writeClaude(home, claudeTranscript('g1', 'cc-nogit'), 'cc-nogit');
    const outDir = join(home, 'nogit');
    await mkdir(outDir, { recursive: true });
    // --cwd points at the non-git CWD constant, so branch lookup fails.
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-nogit',
        '--out',
        outDir,
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 1);
    // basename of CWD is 'my-project'; fallback name starts with it.
    assert.ok(files[0].startsWith('my-project-'), `got ${files[0]}`);
    await rm(home, { recursive: true, force: true });
  });
});

describe('export CLI — end-to-end sanitization', () => {
  test('claude-code: no tool calls/results, system/env/AGENTS payloads, or marker line', async () => {
    const home = await setupHome();
    const marker = 'sanmark9999';
    await writeClaude(home, claudeTranscript(marker), 'cc-san');
    const out = join(home, 'san.md');
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--match',
        marker,
        '--out',
        out,
      ],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(!md.includes('[Read]'), 'tool call leaked');
    assert.ok(!md.includes('tool_result'), 'tool result leaked');
    assert.ok(!md.includes('environment_context'), 'env context leaked');
    assert.ok(
      !md.includes('system-reminder'),
      'system-reminder wrapper leaked',
    );
    assert.ok(!md.includes('AGENTS.md instructions'), 'AGENTS payload leaked');
    assert.ok(
      !md.includes('You are a helpful assistant'),
      'system text leaked',
    );
    assert.ok(!md.includes('EXPORT_SESSION_MARKER'), 'marker line leaked');
    assert.ok(!md.includes(marker), 'marker value leaked');
    assert.ok(
      md.includes('Please refactor the auth module.'),
      'genuine user msg missing',
    );
    await rm(home, { recursive: true, force: true });
  });

  test('codex: function calls + subagent notifications excluded, header present', async () => {
    const home = await setupHome();
    const marker = 'codexmark77';
    await writeCodex(home, codexTranscript(marker), 'codex-san');
    const out = join(home, 'codex-san.md');
    const r = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );
    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(!md.includes('[shell]'), 'function call leaked');
    assert.ok(
      !md.includes('subagent_notification'),
      'subagent notification leaked',
    );
    assert.ok(!md.includes(marker), 'marker leaked');
    assert.ok(md.includes('How do I read a file in Node?'));
    assert.ok(md.includes('Use fs.readFile.'));
    assert.match(md, /Runtime:\s*codex/);
    assert.match(md, /Exported:/);
    await rm(home, { recursive: true, force: true });
  });
});

describe('export CLI — exit codes', () => {
  test('exit 2 when no candidates for cwd', async () => {
    const home = await setupHome();
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        '/nonexistent/project',
        '--match',
        'x',
      ],
      { HOME: home },
    );
    assert.equal(r.status, 2, `stderr: ${r.stderr}`);
    await rm(home, { recursive: true, force: true });
  });

  test('exit 3 when multiple candidates and no --match/--session/--all', async () => {
    const home = await setupHome();
    await writeClaude(home, claudeTranscript('q1'), 'cc-x');
    await writeClaude(home, claudeTranscript('q2'), 'cc-y');
    const r = spawnCli(['--runtime', 'claude-code', '--cwd', CWD], {
      HOME: home,
    });
    assert.equal(r.status, 3, `stderr: ${r.stderr}`);
    await rm(home, { recursive: true, force: true });
  });

  test('exit 1 on hard error (unwritable output directory)', async () => {
    const home = await setupHome();
    await writeClaude(home, claudeTranscript('e1', 'cc-err'), 'cc-err');
    // Point --out at a file path whose parent is an existing file (not a dir).
    const blocker = join(home, 'blocker');
    await writeFile(blocker, 'x', 'utf8');
    const out = join(blocker, 'cannot.md');
    const r = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-err',
        '--out',
        out,
      ],
      { HOME: home },
    );
    assert.equal(
      r.status,
      1,
      `expected hard error, status=${r.status} stderr=${r.stderr}`,
    );
    await rm(home, { recursive: true, force: true });
  });

  test('--help exits 0', () => {
    const r = spawnCli(['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /export-session-transcript/);
  });
});
