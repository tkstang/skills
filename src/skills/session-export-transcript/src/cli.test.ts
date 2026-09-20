/**
 * cli.test.ts — End-to-end tests for the session-export-transcript CLI.
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
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, assert, beforeAll, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLI_PATH = fileURLToPath(
  new URL(
    '../../../../skills/session-export-transcript/scripts/session-export-transcript.mjs',
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

function claudeActivityTranscript(
  marker: string,
  sessionId = 'cc-activity',
): string {
  const records = [
    { type: 'summary', sessionId, summary: 'start' },
    {
      type: 'user',
      sessionId,
      message: { role: 'user', content: `EXPORT_SESSION_MARKER=${marker}` },
    },
    {
      type: 'user',
      sessionId,
      message: { role: 'user', content: 'Export the visible conversation.' },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will inspect the source.' },
          {
            type: 'tool_use',
            id: 'tool-read',
            name: 'Read',
            input: { file_path: '/fixture/project/example.txt' },
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
            tool_use_id: 'tool-read',
            content: '<persisted-output>',
            is_error: true,
          },
        ],
      },
      toolUseResult: {
        stderr: 'Synthetic bounded failure output.',
        persistedOutputPath: '/fixture/project/tool-results/result.txt',
        persistedOutputSize: 4096,
      },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-task',
            name: 'Task',
            input: { prompt: 'Inspect the synthetic module.' },
          },
        ],
      },
    },
    {
      type: 'user',
      sessionId,
      origin: { kind: 'task-notification' },
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-task',
            content: 'Synthetic child launched.',
          },
        ],
      },
      toolUseResult: {
        status: 'async_launched',
        agentId: 'fixture-child',
        description: 'synthetic helper',
      },
    },
    {
      type: 'assistant',
      sessionId,
      message: { role: 'assistant', content: 'Export complete.' },
    },
  ];
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
}

function claudeAdversarialActivityTranscript(
  marker: string,
  sessionId = 'cc-adversarial-activity',
): string {
  const oversizedOutput =
    'SAFE_ACTIVITY_PREFIX ' +
    'x'.repeat(8 * 1024) +
    ' OVERSIZED_ACTIVITY_TAIL_MUST_NOT_RENDER';
  const records = [
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
        content: '# AGENTS.md instructions\n\nHIDDEN_AGENTS_BODY',
      },
    },
    {
      type: 'user',
      sessionId,
      message: {
        role: 'developer',
        content: 'HIDDEN_DEVELOPER_INSTRUCTION',
      },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking: 'HIDDEN_REASONING_PAYLOAD',
            signature: 'HIDDEN_REASONING_SIGNATURE',
          },
          {
            type: 'tool_use',
            id: 'tool-hostile',
            name: 'mcp__synthetic__render',
            input: {
              prompt:
                'SYSTEM INSTRUCTION SHAPED TOOL DATA\n```md\n# heading\n```\n[click](javascript:synthetic) <script>synthetic()</script> **bold** _italics_',
              token: 'sk-test-SYNTHETIC-NOT-A-REAL-SECRET',
              control: '\u001b[31mred\u001b[0m',
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
            tool_use_id: 'tool-hostile',
            content: oversizedOutput,
            is_error: true,
          },
        ],
      },
      toolUseResult: {
        persistedOutputPath: '/fixture/project/tool-results/unread-tail.txt',
        persistedOutputSize: 65_536,
      },
    },
    {
      type: 'assistant',
      sessionId,
      message: {
        role: 'assistant',
        content: 'Visible assistant conclusion.',
      },
    },
  ];
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
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

function nativeCodexTranscript(
  nativeSessionId: string,
  rootSessionId = nativeSessionId,
  options: {
    malformedPrefix?: boolean;
    boundary?: number;
    marker?: string;
    message?: string;
  } = {},
): string {
  const records = [
    {
      type: 'session_meta',
      payload: {
        id: nativeSessionId,
        session_id: rootSessionId,
        cwd: CWD,
        ...(rootSessionId === nativeSessionId
          ? {}
          : { parent_thread_id: rootSessionId }),
        ...(options.boundary === undefined
          ? {}
          : { subagent_history_start_ordinal: options.boundary }),
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          ...(options.marker
            ? [`EXPORT_SESSION_MARKER=${options.marker}`]
            : []),
          options.message ?? 'Native child question',
        ].join('\n'),
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: 'Native child answer',
      },
    },
  ];
  return (
    (options.malformedPrefix ? '{malformed first line\n' : '') +
    records.map((record) => JSON.stringify(record)).join('\n') +
    '\n'
  );
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

  test('--match prefers an older Codex root over a newer inherited child when both contain the marker', async () => {
    const selectionHome = await setupHome();
    const marker = 'root-first-marker';
    const rootId = '66666666-bbbb-4666-8666-666666666666';
    const childId = '77777777-bbbb-4777-8777-777777777777';
    const rootPath = await writeCodex(
      selectionHome,
      nativeCodexTranscript(rootId, rootId, {
        marker,
        message: 'ROOT MARKER MATCH',
      }),
      'root-marker-match',
    );
    const childPath = await writeCodex(
      selectionHome,
      nativeCodexTranscript(childId, rootId, {
        marker,
        message: 'CHILD MARKER MATCH',
      }),
      'child-marker-match',
    );
    const now = new Date();
    const older = new Date(now.getTime() - 10_000);
    await utimes(rootPath, older, older);
    await utimes(childPath, now, now);
    const out = join(selectionHome, 'root-marker-match.md');

    const result = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--match', marker, '--out', out],
      { HOME: selectionHome },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const markdown = await readFile(out, 'utf8');
    assert.match(markdown, /ROOT MARKER MATCH/);
    assert.ok(!/CHILD MARKER MATCH/.test(markdown));
    assert.ok(!/inherited parent context/.test(result.stderr));
    await rm(selectionHome, { recursive: true, force: true });
  });

  test('--match miss fallback prefers an older Codex root over a newer inherited child', async () => {
    const selectionHome = await setupHome();
    const rootId = '88888888-bbbb-4888-8888-888888888888';
    const childId = '99999999-bbbb-4999-8999-999999999999';
    const rootPath = await writeCodex(
      selectionHome,
      nativeCodexTranscript(rootId, rootId, {
        message: 'ROOT MARKER MISS FALLBACK',
      }),
      'root-marker-miss',
    );
    const childPath = await writeCodex(
      selectionHome,
      nativeCodexTranscript(childId, rootId, {
        message: 'CHILD MARKER MISS FALLBACK',
      }),
      'child-marker-miss',
    );
    const now = new Date();
    const older = new Date(now.getTime() - 10_000);
    await utimes(rootPath, older, older);
    await utimes(childPath, now, now);
    const out = join(selectionHome, 'root-marker-miss.md');

    const result = spawnCli(
      [
        '--runtime',
        'codex',
        '--cwd',
        CWD,
        '--match',
        'no-such-marker',
        '--out',
        out,
      ],
      { HOME: selectionHome },
    );

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stderr, /falling back.*88888888-bbbb/);
    const markdown = await readFile(out, 'utf8');
    assert.match(markdown, /ROOT MARKER MISS FALLBACK/);
    assert.ok(!/CHILD MARKER MISS FALLBACK/.test(markdown));
    assert.ok(!/inherited parent context/.test(result.stderr));
    await rm(selectionHome, { recursive: true, force: true });
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

  test('--session rejects duplicate Codex native identity sources', async () => {
    const duplicateHome = await setupHome();
    const nativeId = '11111111-bbbb-4111-8111-111111111111';
    await writeCodex(
      duplicateHome,
      nativeCodexTranscript(nativeId),
      'duplicate-one',
    );
    await writeCodex(
      duplicateHome,
      nativeCodexTranscript(nativeId),
      'duplicate-two',
    );

    const r = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--session', nativeId],
      { HOME: duplicateHome },
    );

    assert.equal(r.status, 3, `${r.stderr}\n${r.stdout}`);
    assert.match(r.stderr, /SESSION_IDENTITY_AMBIGUOUS/);
    await rm(duplicateHome, { recursive: true, force: true });
  });

  test('--session exports Codex child identity with inherited-context warning', async () => {
    const childHome = await setupHome();
    const childId = '22222222-bbbb-4222-8222-222222222222';
    const rootId = '33333333-bbbb-4333-8333-333333333333';
    await writeCodex(
      childHome,
      nativeCodexTranscript(childId, rootId, { boundary: 5 }),
      'native-child',
    );
    const out = join(childHome, 'child.md');

    const r = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--session', childId, '--out', out],
      { HOME: childHome },
    );

    assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`);
    assert.match(r.stderr, /inherited parent context before ordinal 5/);
    const md = await readFile(out, 'utf8');
    assert.match(md, new RegExp(`Native session: ${childId}`));
    assert.match(md, new RegExp(`Root session: ${rootId}`));
    assert.match(md, /inherited parent context before ordinal 5/);
    await rm(childHome, { recursive: true, force: true });
  });

  test('--session rejects malformed-first-line Codex rollout identity', async () => {
    const malformedHome = await setupHome();
    const childId = '44444444-bbbb-4444-8444-444444444444';
    const parentId = '55555555-bbbb-4555-8555-555555555555';
    const dir = join(malformedHome, '.codex', 'sessions', '2026', '09', '18');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `rollout-2026-09-18T10-00-00-${childId}.jsonl`),
      nativeCodexTranscript(parentId, parentId, { malformedPrefix: true }),
      'utf8',
    );

    const r = spawnCli(
      ['--runtime', 'codex', '--cwd', CWD, '--session', childId],
      { HOME: malformedHome },
    );

    assert.equal(r.status, 1, `${r.stderr}\n${r.stdout}`);
    assert.match(r.stderr, /SESSION_IDENTITY_INVALID/);
    await rm(malformedHome, { recursive: true, force: true });
  });

  test.each([
    { label: 'marker match', markerInTranscript: 'invalid-marker-match' },
    { label: 'marker-miss fallback', markerInTranscript: undefined },
  ])(
    '--match rejects an invalid Codex identity selected by $label',
    async ({ markerInTranscript }) => {
      const invalidHome = await setupHome();
      const filenameId = '66666666-bbbb-4666-8666-666666666666';
      const contradictoryId = '77777777-bbbb-4777-8777-777777777777';
      const requestedMarker = markerInTranscript ?? 'missing-marker';
      const dir = join(invalidHome, '.codex', 'sessions', '2026', '09', '18');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, `rollout-2026-09-18T10-00-00-${filenameId}.jsonl`),
        nativeCodexTranscript(contradictoryId, contradictoryId, {
          marker: markerInTranscript,
        }),
        'utf8',
      );

      const result = spawnCli(
        [
          '--runtime',
          'codex',
          '--cwd',
          CWD,
          '--match',
          requestedMarker,
          '--out',
          join(invalidHome, 'invalid.md'),
        ],
        { HOME: invalidHome },
      );

      assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
      assert.match(result.stderr, /SESSION_IDENTITY_INVALID/);
      await rm(invalidHome, { recursive: true, force: true });
    },
  );

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
    assert.ok(!md.includes('Activity export:'), 'activity header leaked');
    assert.ok(!md.includes('## Activity'), 'activity section leaked');
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

describe('export CLI — bounded activity', () => {
  test('appends source-ordered activity with limits, locators, and unread coverage', async () => {
    const home = await setupHome();
    const marker = 'activitymark77';
    await writeClaude(
      home,
      claudeActivityTranscript(marker, 'cc-activity'),
      'cc-activity',
    );
    const out = join(home, 'activity.md');
    const stateHome = join(home, 'state');
    await mkdir(stateHome, { recursive: true });
    await writeFile(join(stateHome, 'sentinel'), 'unchanged', 'utf8');

    const result = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-activity',
        '--include-activity',
        '--out',
        out,
      ],
      { HOME: home, XDG_STATE_HOME: stateHome },
    );

    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(out, 'utf8');
    assert.match(markdown, /Activity export: Sensitive activity\/debug data/);
    assert.match(markdown, /## Activity/);
    assert.match(markdown, /Mode: export/);
    assert.match(
      markdown,
      /Activity bytes: \d+\/67108864; preview cap: 2048; late context cap: 256/,
    );
    assert.match(markdown, /Omitted evidence: calls 0; results 0; failures 0/);
    assert.match(
      markdown,
      /call "Read"; pending; owned; line 4, record 3, pointer \/message\/content\/1/,
    );
    assert.match(
      markdown,
      /result "tool_result"; error; owned; line 5, record 4, pointer \/message\/content\/0/,
    );
    assert.ok(
      markdown.indexOf('call "Read";') <
        markdown.indexOf('result "tool_result";'),
      'activity evidence lost source order',
    );
    assert.match(markdown, /persisted-output: not-read; captured 1/);
    assert.match(markdown, /child-trajectory: not-read; captured 1/);
    assert.match(markdown, /trajectoryAvailability":"not-read/);
    assert.ok(markdown.includes('Export the visible conversation.'));
    assert.ok(markdown.includes('Export complete.'));
    assert.ok(!markdown.includes(marker), 'marker leaked');
    assert.equal(
      await readFile(join(stateHome, 'sentinel'), 'utf8'),
      'unchanged',
    );
    assert.deepEqual(await readdir(stateHome), ['sentinel']);
    await rm(home, { recursive: true, force: true });
  });

  test('exports Codex activity while retaining sanitized conversation', async () => {
    const home = await setupHome();
    const marker = 'codexactivity88';
    await writeCodex(
      home,
      codexTranscript(marker, 'codex-activity'),
      'codex-activity',
    );
    const out = join(home, 'codex-activity.md');
    const result = spawnCli(
      [
        '--runtime',
        'codex',
        '--cwd',
        CWD,
        '--session',
        'codex-activity',
        '--include-activity',
        '--out',
        out,
      ],
      { HOME: home },
    );

    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(out, 'utf8');
    assert.match(markdown, /Runtime: codex/);
    assert.match(markdown, /## Activity/);
    assert.match(markdown, /call "shell"; pending; unknown/);
    assert.match(markdown, /pointer \/payload/);
    assert.ok(markdown.includes('How do I read a file in Node?'));
    assert.ok(markdown.includes('Use fs.readFile.'));
    assert.ok(!markdown.includes(marker), 'marker leaked');
    await rm(home, { recursive: true, force: true });
  });

  test('no-flag export keeps hostile activity, reasoning, and instruction bodies excluded', async () => {
    const home = await setupHome();
    const marker = 'adversarialdefault99';
    await writeClaude(
      home,
      claudeAdversarialActivityTranscript(marker),
      'cc-adversarial-activity',
    );
    const out = join(home, 'adversarial-default.md');
    const result = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-adversarial-activity',
        '--out',
        out,
      ],
      { HOME: home },
    );

    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(out, 'utf8');
    assert.ok(markdown.includes('Visible assistant conclusion.'));
    for (const hidden of [
      'HIDDEN_AGENTS_BODY',
      'HIDDEN_DEVELOPER_INSTRUCTION',
      'HIDDEN_REASONING_PAYLOAD',
      'HIDDEN_REASONING_SIGNATURE',
      'SYSTEM INSTRUCTION SHAPED TOOL DATA',
      'sk-test-SYNTHETIC-NOT-A-REAL-SECRET',
      'SAFE_ACTIVITY_PREFIX',
      'OVERSIZED_ACTIVITY_TAIL_MUST_NOT_RENDER',
    ]) {
      assert.ok(!markdown.includes(hidden), `default export leaked ${hidden}`);
    }
    assert.ok(!markdown.includes('Activity export:'));
    assert.ok(!markdown.includes('## Activity'));
    assert.ok(!markdown.includes(marker), 'marker leaked');
    await rm(home, { recursive: true, force: true });
  });

  test('renders hostile recorded tool evidence as bounded Markdown data', async () => {
    const home = await setupHome();
    const marker = 'adversarialactivity00';
    await writeClaude(
      home,
      claudeAdversarialActivityTranscript(marker),
      'cc-adversarial-activity',
    );
    const out = join(home, 'adversarial-activity.md');
    const result = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--session',
        'cc-adversarial-activity',
        '--include-activity',
        '--out',
        out,
      ],
      { HOME: home },
    );

    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(out, 'utf8');
    assert.match(markdown, /Activity export: Sensitive activity\/debug data/);
    assert.ok(markdown.includes('SYSTEM INSTRUCTION SHAPED TOOL DATA'));
    assert.ok(markdown.includes('sk-test-SYNTHETIC-NOT-A-REAL-SECRET'));
    assert.ok(markdown.includes('SAFE_ACTIVITY_PREFIX'));
    assert.match(markdown, /clipped 2048\/\d+ bytes/);
    assert.ok(!markdown.includes('OVERSIZED_ACTIVITY_TAIL_MUST_NOT_RENDER'));
    assert.ok(!markdown.includes('```'), 'Markdown fence remained active');
    assert.ok(
      !markdown.includes('[click](javascript:synthetic)'),
      'Markdown link remained active',
    );
    assert.ok(!markdown.includes('<script>'), 'HTML remained active');
    assert.ok(!markdown.includes('**bold**'), 'emphasis remained active');
    assert.ok(!markdown.includes('_italics_'), 'emphasis remained active');
    assert.ok(markdown.includes('\\u0060\\u0060\\u0060md'));
    assert.ok(
      markdown.includes(
        '\\u005bclick\\u005d\\u0028javascript:synthetic\\u0029',
      ),
    );
    assert.ok(markdown.includes('\\u003cscript\\u003e'));
    assert.ok(markdown.includes('\\u002a\\u002abold\\u002a\\u002a'));
    assert.ok(markdown.includes('\\u005fitalics\\u005f'));
    assert.ok(markdown.includes('\\\\u001b\\u005b31mred\\\\u001b\\u005b0m'));
    assert.match(markdown, /persisted-output: not-read; captured 1/);
    assert.ok(
      markdown.includes('/fixture/project/tool-results/unread-tail.txt'),
    );
    for (const hidden of [
      'HIDDEN_AGENTS_BODY',
      'HIDDEN_DEVELOPER_INSTRUCTION',
      'HIDDEN_REASONING_PAYLOAD',
      'HIDDEN_REASONING_SIGNATURE',
    ]) {
      assert.ok(!markdown.includes(hidden), `activity export leaked ${hidden}`);
    }
    assert.ok(!/publish[- ]safe/iu.test(markdown));
    assert.ok(!markdown.includes(marker), 'marker leaked');
    await rm(home, { recursive: true, force: true });
  });

  test('--all labels every activity artifact without changing filenames', async () => {
    const home = await setupHome();
    await writeClaude(
      home,
      claudeActivityTranscript('activity-a', 'cc-activity-a'),
      'cc-activity-a',
    );
    await writeClaude(
      home,
      claudeActivityTranscript('activity-b', 'cc-activity-b'),
      'cc-activity-b',
    );
    const outDir = join(home, 'activity-all');
    await mkdir(outDir, { recursive: true });
    const result = spawnCli(
      [
        '--runtime',
        'claude-code',
        '--cwd',
        CWD,
        '--all',
        '--include-activity',
        '--out',
        outDir,
      ],
      { HOME: home },
    );

    assert.equal(result.status, 0, result.stderr);
    const files = (await readdir(outDir)).filter((file) =>
      file.endsWith('.md'),
    );
    assert.equal(files.length, 2);
    assert.ok(files.some((file) => file.includes('cc-activity-a')));
    assert.ok(files.some((file) => file.includes('cc-activity-b')));
    for (const file of files) {
      const markdown = await readFile(join(outDir, file), 'utf8');
      assert.match(markdown, /Activity export: Sensitive activity\/debug data/);
      assert.match(
        markdown,
        /Activity bytes: \d+\/67108864; preview cap: 2048; late context cap: 256/,
      );
      assert.match(markdown, /Omitted evidence:/);
      assert.match(markdown, /Omitted groups:/);
    }
    await rm(home, { recursive: true, force: true });
  });

  test('exports settled and pending-lifecycle Cursor calls with positional evidence', async () => {
    const home = await setupHome();
    const marker = 'cursoractivity77';
    await writeCursor(
      home,
      [
        {
          role: 'user',
          message: {
            content: [
              { type: 'text', text: `EXPORT_SESSION_MARKER=${marker}` },
            ],
          },
        },
        {
          role: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Read',
                input: { path: 'settled.md' },
              },
            ],
          },
        },
        { type: 'turn_ended', status: 'success' },
        {
          role: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Shell',
                input: { command: 'printf pending' },
              },
            ],
          },
        },
      ]
        .map((frame) => JSON.stringify(frame))
        .join('\n') + '\n',
      'cursor-activity',
    );
    const out = join(home, 'cursor-activity.md');
    const result = spawnCli(
      [
        '--runtime',
        'cursor',
        '--cwd',
        CWD,
        '--match',
        marker,
        '--include-activity',
        '--out',
        out,
      ],
      { HOME: home },
    );

    assert.equal(result.status, 0, result.stderr);
    const markdown = await readFile(out, 'utf8');
    assert.match(markdown, /Activity export: Sensitive activity\/debug data/);
    assert.match(
      markdown,
      /Delivery range: \[0, 4\) zero-based-jsonl-frame-index/,
    );
    assert.match(
      markdown,
      /delivered-range: calls 2; counted invocations 2; pending lifecycle 1/,
    );
    assert.match(
      markdown,
      /call "Read"; unknown; owned; source frame 1, delivery frame 2, line 2, pointer \/message\/content\/0/,
    );
    assert.match(
      markdown,
      /call "Shell"; unknown; owned; source frame 3, line 4, pointer \/message\/content\/0/,
    );
    assert.match(markdown, /"lifecycleAvailability":"settled"/);
    assert.match(markdown, /"lifecycleAvailability":"pending-lifecycle"/);
    assert.match(markdown, /"turnOutcome":"success"/);
    assert.match(markdown, /"turnOutcome":"pending"/);
    assert.notMatch(markdown, /nativeId|nativeCallId|nativeStatus/);
    assert.match(markdown, /results: not-recorded; captured 0/);
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
    assert.match(r.stdout, /session-export-transcript/);
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
