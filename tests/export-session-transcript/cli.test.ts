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

function cursorTranscript(marker: string): string {
  const records = [
    {
      role: 'user',
      message: {
        content: [{ type: 'text', text: `EXPORT_SESSION_MARKER=${marker}` }],
      },
    },
    {
      role: 'user',
      message: {
        content: [{ type: 'text', text: 'Synthetic Cursor export request.' }],
      },
    },
    {
      role: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Synthetic provisional Cursor response.' },
        ],
      },
    },
    {
      role: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Synthetic final Cursor response.' }],
      },
    },
    { type: 'turn_ended', status: 'success' },
  ];
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
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

async function writeCursor(
  home: string,
  content: string,
  sessionId = 'cursor-001',
): Promise<string> {
  const dir = join(
    home,
    '.cursor',
    'projects',
    CURSOR_SLUG,
    'agent-transcripts',
    sessionId,
  );
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  await writeFile(transcriptPath, content, 'utf8');
  return transcriptPath;
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

  test('cursor: preserves the existing terminal-only projection', async () => {
    const home = await setupHome();
    const marker = 'cursormark88';
    await writeCursor(home, cursorTranscript(marker), 'cursor-terminal');
    const out = join(home, 'cursor-terminal.md');
    const result = spawnCli(
      ['--runtime', 'cursor', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(out, 'utf8');
    assert.ok(markdown.includes('Synthetic Cursor export request.'));
    assert.ok(markdown.includes('Synthetic final Cursor response.'));
    assert.ok(
      !markdown.includes('Synthetic provisional Cursor response.'),
      'provisional Cursor response leaked into the terminal-only export',
    );
    assert.ok(!markdown.includes(marker), 'marker leaked');
    assert.match(markdown, /Runtime:\s*cursor/);
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

// ---------------------------------------------------------------------------
// Ask-user exchanges
//
// Ask-user calls are the one tool call the export deliberately keeps: the
// question and the operator's decision are visible conversation. Every case
// below pairs an ask-user exchange with ordinary tool traffic and asserts that
// only the former survives.
// ---------------------------------------------------------------------------

function claudeAskUserTranscript(marker: string, sessionId: string): string {
  const recs = [
    {
      type: 'user',
      sessionId,
      message: { role: 'user', content: `EXPORT_SESSION_MARKER=${marker}` },
    },
    {
      type: 'user',
      sessionId,
      message: { role: 'user', content: 'Pick a package boundary for me.' },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_ask',
            name: 'AskUserQuestion',
            input: {
              questions: [
                {
                  question: 'Where should the parser live?',
                  header: 'Pkg boundary',
                  options: [{ label: 'New package' }, { label: 'Inside core' }],
                },
              ],
            },
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
          {
            type: 'tool_result',
            tool_use_id: 'toolu_ask',
            content: 'Your questions have been answered.',
          },
        ],
      },
      toolUseResult: {
        questions: [
          {
            question: 'Where should the parser live?',
            header: 'Pkg boundary',
            options: [],
          },
        ],
        answers: { 'Where should the parser live?': 'New package' },
        annotations: {},
      },
    },
    // Ordinary tool traffic that must stay filtered.
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_read',
            name: 'Read',
            input: { file_path: '/project/src/parser.ts' },
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
          {
            type: 'tool_result',
            tool_use_id: 'toolu_read',
            content: 'SECRET_READ_OUTPUT',
          },
        ],
      },
    },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function codexAskUserTranscript(marker: string, sessionId: string): string {
  const recs = [
    { type: 'session_started', sessionId, cwd: CWD },
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
        type: 'function_call',
        name: 'request_user_input',
        call_id: 'call_ask',
        arguments: JSON.stringify({
          questions: [
            {
              id: 'keeper_use',
              header: 'Keepers',
              question: 'Will the auction use keepers?',
              options: [{ label: 'No keepers' }, { label: 'Yes, keepers' }],
            },
          ],
        }),
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'function_call_output',
        call_id: 'call_ask',
        output: JSON.stringify({
          answers: { keeper_use: { answers: ['No keepers'] } },
        }),
      },
    },
    // Ordinary tool traffic that must stay filtered.
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'function_call',
        name: 'exec_command',
        call_id: 'call_exec',
        arguments: JSON.stringify({ command: 'cat /etc/SECRET_EXEC' }),
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'function_call_output',
        call_id: 'call_exec',
        output: JSON.stringify({ output: 'SECRET_EXEC_OUTPUT' }),
      },
    },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function cursorAskUserTranscript(marker: string): string {
  const recs = [
    {
      role: 'user',
      message: {
        content: [{ type: 'text', text: `EXPORT_SESSION_MARKER=${marker}` }],
      },
    },
    {
      role: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'AskQuestion',
            input: {
              title: 'Discovery convergence',
              questions: [
                {
                  id: 'scope_check',
                  prompt: 'Proceed as one cohesive project?',
                  options: [
                    { id: 'one', label: 'Proceed as one project' },
                    { id: 'split', label: 'Split it' },
                  ],
                },
              ],
            },
          },
        ],
      },
    },
    {
      role: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'Shell',
            input: { command: 'cat SECRET_SHELL' },
          },
        ],
      },
    },
    {
      role: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Discovery is complete.' }],
      },
    },
    { type: 'turn_ended', status: 'success' },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function cursorUnterminatedAskUserTranscript(marker: string): string {
  const recs = [
    {
      role: 'user',
      message: {
        content: [{ type: 'text', text: `EXPORT_SESSION_MARKER=${marker}` }],
      },
    },
    { type: 'turn_ended', status: 'success' },
    {
      role: 'assistant',
      message: { content: [{ type: 'text', text: 'SECRET_UNFINISHED_WORK' }] },
    },
    {
      role: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'AskQuestion',
            input: {
              title: 'Pending gate',
              questions: [
                {
                  id: 'proceed',
                  prompt: 'Proceed with the migration?',
                  options: [{ id: 'yes', label: 'Proceed' }],
                },
              ],
            },
          },
        ],
      },
    },
    {
      role: 'user',
      message: {
        content: [{ type: 'text', text: 'Use the safer option instead.' }],
      },
    },
  ];
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

describe('export CLI — ask-user exchanges', () => {
  test('claude-code: exports the question and answer, still drops ordinary tools', async () => {
    const home = await setupHome();
    const marker = 'ccask1234';
    await writeClaude(
      home,
      claudeAskUserTranscript(marker, 'cc-ask'),
      'cc-ask',
    );
    const out = join(home, 'cc-ask.md');
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
    assert.ok(
      md.includes(
        '[AskUserQuestion] Pkg boundary — Where should the parser live?',
      ),
      'ask-user question missing from export',
    );
    assert.ok(
      md.includes('[AskUserQuestion → answered] Pkg boundary: "New package"'),
      'ask-user answer missing from export',
    );
    assert.ok(!md.includes('[Read]'), 'ordinary tool call leaked');
    assert.ok(
      !md.includes('SECRET_READ_OUTPUT'),
      'ordinary tool result leaked',
    );
    await rm(home, { recursive: true, force: true });
  });

  test('codex: exports the question and answer, still drops ordinary function calls', async () => {
    const home = await setupHome();
    const marker = 'cxask5678';
    await writeCodex(
      home,
      codexAskUserTranscript(marker, 'codex-ask'),
      'codex-ask',
    );
    const out = join(home, 'codex-ask.md');
    const r = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(
      md.includes(
        '[request_user_input] Keepers — Will the auction use keepers?',
      ),
      'ask-user question missing from export',
    );
    assert.ok(
      md.includes('[request_user_input → answered] Keepers: "No keepers"'),
      'ask-user answer missing from export',
    );
    assert.ok(!md.includes('[exec_command]'), 'ordinary function call leaked');
    assert.ok(!md.includes('SECRET_EXEC_OUTPUT'), 'function output leaked');
    await rm(home, { recursive: true, force: true });
  });

  test('cursor: exports the question and says the selected option is unrecorded', async () => {
    const home = await setupHome();
    const marker = 'curask9012';
    await writeCursor(home, cursorAskUserTranscript(marker), 'cursor-ask');
    const out = join(home, 'cursor-ask.md');
    const r = spawnCli(
      ['--runtime', 'cursor', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(
      md.includes('[AskQuestion] Discovery convergence'),
      'ask-user question missing from export',
    );
    assert.ok(
      md.includes('(selected option not recorded in Cursor transcripts)'),
      'unrecorded-answer note missing from export',
    );
    assert.ok(!md.includes('[Shell]'), 'ordinary tool call leaked');
    assert.ok(!md.includes('SECRET_SHELL'), 'shell args leaked');
    assert.ok(!md.includes('EXPORT_SESSION_MARKER'), 'marker line leaked');
    assert.ok(!md.includes(marker), 'marker value leaked');
    await rm(home, { recursive: true, force: true });
  });

  test('cursor: a trailing unterminated turn keeps the question and the typed reply', async () => {
    const home = await setupHome();
    const marker = 'curunterm3456';
    await writeCursor(
      home,
      cursorUnterminatedAskUserTranscript(marker),
      'cursor-unterminated',
    );
    const out = join(home, 'cursor-unterminated.md');
    const r = spawnCli(
      ['--runtime', 'cursor', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(
      md.includes('[AskQuestion] Pending gate'),
      'trailing question missing from export',
    );
    // Cursor records a typed answer as an ordinary user message.
    assert.ok(
      md.includes('Use the safer option instead.'),
      "the operator's typed reply must survive",
    );
    assert.ok(
      !md.includes('SECRET_UNFINISHED_WORK'),
      'unfinished assistant progress leaked',
    );
    assert.ok(!md.includes('EXPORT_SESSION_MARKER'), 'marker line leaked');
    assert.ok(!md.includes(marker), 'marker value leaked');
    await rm(home, { recursive: true, force: true });
  });

  test('cursor: a trailing flush never exports automatic-control lease payloads', async () => {
    const home = await setupHome();
    const marker = 'curleak2468';
    const wake = JSON.stringify({
      session_observer_wake: {
        automatic: true,
        runtime: 'cursor',
        leaseId: 'secret-lease',
        pinnedPeer: {
          runtime: 'claude-code',
          sessionId: 'SECRET-PEER-SESSION',
        },
        range: { fromIndex: 0, toIndex: 3 },
      },
    });
    const recs = [
      {
        role: 'user',
        message: {
          content: [{ type: 'text', text: `EXPORT_SESSION_MARKER=${marker}` }],
        },
      },
      { type: 'turn_ended', status: 'success' },
      { role: 'user', message: { content: [{ type: 'text', text: wake }] } },
      {
        role: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'AskQuestion',
              input: {
                title: 'Pending gate',
                questions: [
                  {
                    id: 'proceed',
                    prompt: 'Proceed with the migration?',
                    options: [{ id: 'yes', label: 'Proceed' }],
                  },
                ],
              },
            },
          ],
        },
      },
      {
        role: 'user',
        message: {
          content: [{ type: 'text', text: 'Use the safer option instead.' }],
        },
      },
    ];
    await writeCursor(
      home,
      recs.map((r) => JSON.stringify(r)).join('\n') + '\n',
      'cursor-leak',
    );
    const out = join(home, 'cursor-leak.md');
    const r = spawnCli(
      ['--runtime', 'cursor', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    assert.ok(md.includes('[AskQuestion] Pending gate'), 'question missing');
    assert.ok(
      md.includes('Use the safer option instead.'),
      "the operator's typed reply must survive",
    );
    // Internal collaboration metadata must never reach a shared export.
    assert.ok(!md.includes('secret-lease'), 'lease id leaked into export');
    assert.ok(
      !md.includes('SECRET-PEER-SESSION'),
      'pinned peer session leaked into export',
    );
    assert.ok(
      !md.includes('session_observer_wake'),
      'wake envelope leaked into export',
    );
    await rm(home, { recursive: true, force: true });
  });

  test('cursor: a completed turn never exports automatic-control lease payloads', async () => {
    // The provisional path is covered above. This closes the other seam: a
    // COMPLETED transcript, normalized end-to-end, must carry the structural
    // provenance tag and have it stripped in the same export run.
    const home = await setupHome();
    const marker = 'curdone1357';
    const wake = JSON.stringify({
      session_observer_wake: {
        automatic: true,
        runtime: 'cursor',
        leaseId: 'secret-lease',
        pinnedPeer: {
          runtime: 'claude-code',
          sessionId: 'SECRET-PEER-SESSION',
        },
        range: { fromIndex: 0, toIndex: 3 },
      },
    });
    const recs = [
      {
        role: 'user',
        message: {
          content: [{ type: 'text', text: `EXPORT_SESSION_MARKER=${marker}` }],
        },
      },
      { role: 'user', message: { content: [{ type: 'text', text: wake }] } },
      {
        role: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'AskQuestion',
              input: {
                title: 'Completed gate',
                questions: [
                  {
                    id: 'proceed',
                    prompt: 'Proceed with the migration?',
                    options: [{ id: 'yes', label: 'Proceed' }],
                  },
                ],
              },
            },
          ],
        },
      },
      {
        role: 'user',
        message: {
          content: [{ type: 'text', text: 'Use the safer option instead.' }],
        },
      },
      {
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'Migration complete.' }] },
      },
      { type: 'turn_ended', status: 'success' },
    ];
    await writeCursor(
      home,
      recs.map((r) => JSON.stringify(r)).join('\n') + '\n',
      'cursor-completed-leak',
    );
    const out = join(home, 'cursor-completed-leak.md');
    const r = spawnCli(
      ['--runtime', 'cursor', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    // Visible conversation survives.
    assert.ok(md.includes('[AskQuestion] Completed gate'), 'question missing');
    assert.ok(
      md.includes('Use the safer option instead.'),
      "the operator's typed reply must survive",
    );
    assert.ok(md.includes('Migration complete.'), 'final message missing');
    // Internal collaboration metadata does not.
    assert.ok(!md.includes('secret-lease'), 'lease id leaked into export');
    assert.ok(
      !md.includes('SECRET-PEER-SESSION'),
      'pinned peer session leaked into export',
    );
    assert.ok(
      !md.includes('session_observer_wake'),
      'wake envelope leaked into export',
    );
    await rm(home, { recursive: true, force: true });
  });

  test('the sanitization notice does not over-attribute recorded answers', async () => {
    const home = await setupHome();
    const marker = 'curnotice7890';
    await writeCursor(home, cursorAskUserTranscript(marker), 'cursor-notice');
    const out = join(home, 'cursor-notice.md');
    const r = spawnCli(
      ['--runtime', 'cursor', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: home },
    );

    assert.equal(r.status, 0, r.stderr);
    const md = await readFile(out, 'utf8');
    // The same file must not claim the answer was preserved while also saying
    // the selected option was never recorded.
    assert.ok(
      md.includes('any answers the runtime recorded'),
      'notice must stay attribution-neutral',
    );
    assert.ok(
      !md.includes('the answers you gave'),
      'notice must not assert the operator answered',
    );
    assert.ok(
      md.includes('(selected option not recorded in Cursor transcripts)'),
      'the Cursor caveat must still appear alongside the notice',
    );
    await rm(home, { recursive: true, force: true });
  });
});
