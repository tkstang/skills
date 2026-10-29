import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
const BIN = resolve('packages/session-toolkit/dist/bin.js'),
  ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function fixture(
  run: (
    home: string,
    cwd: string,
    paths: Record<string, string>,
  ) => Promise<void>,
) {
  const home = await realpath(
      await mkdtemp(join(tmpdir(), 'seshtk-operations-')),
    ),
    cwd = join(home, 'repo');
  await mkdir(cwd);
  const paths = {
    'claude-code': join(
      home,
      '.claude/projects',
      cwd.replace(/[/.]/gu, '-'),
      `${ID}.jsonl`,
    ),
    codex: join(
      home,
      '.codex/sessions/2026/10/29',
      `rollout-2026-10-29T00-00-00-${ID}.jsonl`,
    ),
    cursor: join(
      home,
      '.cursor/projects',
      cwd.split(/[/.]/u).filter(Boolean).join('-'),
      'agent-transcripts',
      ID,
      `${ID}.jsonl`,
    ),
  };
  const records = {
    'claude-code': [
      {
        sessionId: ID,
        cwd,
        type: 'user',
        message: { content: 'fixture question' },
      },
      { type: 'assistant', message: { content: 'fixture answer' } },
    ],
    codex: [
      { type: 'session_meta', payload: { id: ID, cwd } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'fixture question' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          call_id: 'a',
          arguments: '{"cmd":"hello --token secret-value"}',
        },
      },
      {
        type: 'response_item',
        payload: { type: 'function_call_output', call_id: 'a', output: 'done' },
      },
    ],
    cursor: [
      {
        role: 'user',
        message: { content: [{ type: 'text', text: 'fixture question' }] },
      },
      {
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'fixture answer' }] },
      },
      { type: 'turn_ended', status: 'success' },
    ],
  };
  for (const runtime of ['claude-code', 'codex', 'cursor'] as const) {
    await mkdir(dirname(paths[runtime]), { recursive: true });
    await writeFile(
      paths[runtime],
      records[runtime].map((r) => JSON.stringify(r)).join('\n') + '\n',
    );
  }
  try {
    await run(home, cwd, paths);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
function cli(
  home: string,
  cwd: string,
  args: string[],
  vars: Record<string, string> = {},
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    STATE_DIR: join(home, 'state'),
    NO_COLOR: '1',
  };
  for (const name of [
    'CODEX_THREAD_ID',
    'CODEX_SESSION_ID',
    'OPENAI_CODEX_SESSION_ID',
    'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_SESSION_ID',
    'CURSOR_SESSION_ID',
    'CURSOR_CONVERSATION_ID',
    'SESSION_OBSERVER_SELF',
    'SESSION_OBSERVER_SESSION_ID',
  ])
    delete env[name];
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...env, ...vars },
    encoding: 'utf8',
  });
  return { ...result, value: JSON.parse(result.stdout || 'null') };
}
describe('built operational CLI', () => {
  it('executes explicit parse/read/list and exact identity across three provider boundaries without state', async () =>
    fixture(async (home, cwd, paths) => {
      const listed = cli(home, cwd, ['list', '--json']);
      expect(listed.status).toBe(0);
      expect(listed.value.data.candidates).toHaveLength(3);
      for (const [runtime, variable] of [
        ['claude-code', 'CLAUDE_SESSION_ID'],
        ['codex', 'CODEX_THREAD_ID'],
        ['cursor', 'CURSOR_SESSION_ID'],
      ] as const) {
        const parsed = cli(home, cwd, [
          'parse',
          paths[runtime],
          '--runtime',
          runtime,
          '--json',
        ]);
        expect(parsed.status, parsed.stdout + parsed.stderr).toBe(0);
        expect(parsed.value.data.messages[0].text).toBe('fixture question');
        const read = cli(home, cwd, [
          '--json',
          'read',
          '--session',
          `${runtime}:${ID}`,
          '--max-records',
          '1',
        ]);
        expect(read.status).toBe(0);
        expect(read.value.data.records).toHaveLength(1);
        const identity = cli(home, cwd, ['self-identify', '--json'], {
          [variable]: ID,
        });
        expect(identity.status).toBe(0);
        expect(identity.value.data.status).toBe('authoritative');
      }
      const missing = cli(home, cwd, ['self-identify', '--json']);
      expect(missing.status).toBe(1);
      expect(missing.value.error).toMatchObject({
        code: 'E_UNAVAILABLE',
        details: { status: 'unavailable' },
      });
      expect(await readdir(home)).not.toContain('state');
    }));
  it('forwards evidence cutoffs, expansion/redaction and record bounds with one machine envelope', async () =>
    fixture(async (home, cwd) => {
      const base = cli(home, cwd, [
        'read',
        '--session',
        `codex:${ID}`,
        '--evidence',
        '--json',
      ]);
      expect(base.status, base.stdout + base.stderr).toBe(0);
      expect(base.stdout.trim().split('\n')).toHaveLength(1);
      expect(base.stdout).not.toContain('secret-value');
      const event = base.value.data.activity.events.find(
        (e: { kind: string }) => e.kind === 'call',
      );
      const expanded = cli(home, cwd, [
        'read',
        '--session',
        `codex:${ID}`,
        '--cutoff',
        base.value.data.evidence.cutoff,
        '--expand',
        event.evidenceRef,
        '--related',
        '--json',
      ]);
      expect(expanded.status).toBe(0);
      expect(expanded.value.data.evidence.expansion).toHaveLength(2);
      const bounded = cli(home, cwd, [
        'read',
        '--session',
        `codex:${ID}`,
        '--evidence',
        '--max-records',
        '1',
        '--json',
      ]);
      expect(bounded.status).toBe(0);
      expect(bounded.value.data.evidence.sourceCapture.complete).toBe(false);
      expect(bounded.value.data.evidence.selectedRange.end).toBe(1);
    }));
  it('writes safe exports and rejects conflicting selectors, invalid numbers and unsupported evidence', async () =>
    fixture(async (home, cwd) => {
      const out = join(home, 'export.md');
      const exported = cli(home, cwd, [
        'export',
        '--session',
        `claude-code:${ID}`,
        '--out',
        out,
        '--json',
      ]);
      expect(exported.status).toBe(0);
      expect(await readFile(out, 'utf8')).toContain('fixture answer');
      for (const args of [
        ['parse', 'missing', '--runtime', 'auto'],
        ['read', '--session', `codex:${ID}`, '--max-records', '0'],
        [
          'read',
          '--session',
          `codex:${ID}`,
          '--cursor',
          'token',
          '--from-offset',
          '0',
        ],
        ['read', '--session', `cursor:${ID}`, '--evidence'],
        ['read', '--session', `codex:${ID}`, '--related'],
        [
          'export',
          '--session',
          `codex:${ID}`,
          '--all',
          '--out',
          join(home, 'bad'),
        ],
      ]) {
        const result = cli(home, cwd, [...args, '--json']);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.value.error.code).toBe('E_USAGE');
      }
    }));
});
