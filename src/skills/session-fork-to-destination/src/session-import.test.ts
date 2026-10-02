import { execFile } from 'node:child_process';
import {
  mkdir,
  link,
  open,
  unlink,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
  readdir,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applySessionImport,
  planSessionImport,
  type SessionImportInput,
} from './session-import.js';
// Keep the native filesystem real while controlling only the exact fstat race
// window; no production hook or polling is needed to reproduce hardlink cleanup.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: vi.fn(actual.open) };
});
const exec = promisify(execFile);
const sid = '550e8400-e29b-41d4-a716-446655440099';
const time = '2026-09-30T10:11:12.000Z';
let root: string,
  source: string,
  target: string,
  raw: string,
  input: SessionImportInput;
let saved: Record<string, string | undefined>;
function rows(records: unknown[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
}
function codex(items: unknown[]): unknown[] {
  return [
    {
      type: 'session_meta',
      timestamp: time,
      payload: { id: sid, cwd: source, timestamp: time, source: 'cli' },
    },
    ...items.map((payload) => ({
      type: 'response_item',
      timestamp: time,
      payload,
    })),
  ];
}
const user = (text = 'RAW_PRIVATE_USER') => ({
  type: 'message',
  role: 'user',
  content: [{ type: 'input_text', text }],
});
const assistant = (text = 'RAW_PRIVATE_REPLY') => ({
  type: 'message',
  role: 'assistant',
  content: [{ type: 'output_text', text }],
  phase: 'final_answer',
});
async function setCodex(records: unknown[]) {
  await writeFile(raw, rows(records));
}
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'session-import-api-')));
  source = join(root, 'source');
  target = join(root, 'target with_under');
  saved = Object.fromEntries(
    ['HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'STATE_DIR'].map((key) => [
      key,
      process.env[key],
    ]),
  );
  process.env.HOME = root;
  process.env.STATE_DIR = join(root, 'observer-state');
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  await mkdir(source);
  await exec('git', ['-C', source, 'init', '-q']);
  await exec('git', ['-C', source, 'config', 'user.name', 'Synthetic']);
  await exec('git', [
    '-C',
    source,
    'config',
    'user.email',
    'synthetic@example.invalid',
  ]);
  await writeFile(join(source, 'file'), 'fixture');
  await exec('git', ['-C', source, 'add', 'file']);
  await exec('git', ['-C', source, 'commit', '-qm', 'fixture']);
  await exec('git', ['-C', source, 'worktree', 'add', '-qb', 'target', target]);
  raw = join(
    root,
    '.codex',
    'sessions',
    '2026',
    '09',
    '30',
    `rollout-2026-09-30T10-11-12-${sid}.jsonl`,
  );
  await mkdir(dirname(raw), { recursive: true });
  await mkdir(join(root, '.claude'));
  input = {
    sourcePath: source,
    destinationPath: target,
    session: `codex:cli:${sid}`,
    to: 'claude',
    entryPoint: 'destination-fresh',
  };
  await setCodex(codex([user(), assistant()]));
});
afterEach(async () => {
  vi.mocked(open).mockReset();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
});
describe('public import plan and apply', () => {
  it('plans without writes, imports raw ordered tools with counted omissions, and reuses exactly the same seed', async () => {
    const records = codex([
      user(),
      { type: 'reasoning', encrypted_content: 'PRIVATE_REASONING' },
      {
        type: 'message',
        role: 'developer',
        content: [{ type: 'input_text', text: 'SOURCE_PERMISSION' }],
      },
      {
        type: 'custom_tool_call',
        call_id: 'call_1',
        name: 'synthetic',
        namespace: 'source_space',
        input: 'RAW_TOOL_INPUT',
      },
      {
        type: 'custom_tool_call_output',
        call_id: 'call_1',
        output: 'RAW_TOOL_OUTPUT',
      },
      assistant(),
    ]);
    await setCodex(records);
    const before = await readdir(join(root, '.claude'));
    const plan = await planSessionImport(input);
    expect(await readdir(join(root, '.claude'))).toEqual(before);
    expect(plan.occupancy).toBe('absent');
    expect(plan.seed.id).toMatch(/^[\da-f-]{14}8[\da-f-]{21}$/);
    expect(plan.seed.path).toContain('target-with-under');
    expect(JSON.stringify(plan)).not.toMatch(
      /RAW_PRIVATE|RAW_TOOL|PRIVATE_REASONING|SOURCE_PERMISSION/,
    );
    expect(plan.omissions).toMatchObject({
      'private-reasoning': 1,
      'system-developer-instructions': 1,
      'tool-namespace': 1,
      'custom-call-kind': 1,
      'assistant-phase': 1,
    });
    const result = await applySessionImport(input, plan.digest);
    expect(result.status).toBe('imported');
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain('RAW_TOOL_INPUT');
    expect(text).toContain('RAW_TOOL_OUTPUT');
    expect(text).not.toMatch(/PRIVATE_REASONING|SOURCE_PERMISSION/);
    const loaded = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(loaded[1].message.content).toEqual([
      {
        type: 'tool_use',
        id: 'call_1',
        name: 'synthetic',
        input: { input: 'RAW_TOOL_INPUT' },
      },
    ]);
    expect(loaded[2].message.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'call_1',
        content: 'RAW_TOOL_OUTPUT',
      },
    ]);
    expect((await stat(plan.seed.path)).mode & 0o777).toBe(0o600);
    expect((await planSessionImport(input)).digest).toBe(plan.digest);
    expect((await applySessionImport(input, plan.digest)).status).toBe(
      'already-imported',
    );
    expect(await readFile(raw, 'utf8')).toBe(rows(records));
  });
  it('refuses stale source and changed Git evidence before publishing', async () => {
    const plan = await planSessionImport(input);
    await setCodex(codex([user(), assistant('changed reply')]));
    await expect(applySessionImport(input, plan.digest)).rejects.toMatchObject({
      code: 'import-plan-stale',
    });
    const renewed = await planSessionImport(input);
    await writeFile(join(target, 'new'), 'dirty');
    await expect(
      applySessionImport(input, renewed.digest),
    ).rejects.toMatchObject({ code: 'import-plan-stale' });
    expect(await readdir(join(root, '.claude'))).toEqual([]);
  });
  it('allows concurrent exact publication but refuses evolved seed without overwriting it', async () => {
    const plan = await planSessionImport(input);
    const results = await Promise.all([
      applySessionImport(input, plan.digest),
      applySessionImport(input, plan.digest),
    ]);
    expect(results.map((r) => r.status).toSorted()).toEqual([
      'already-imported',
      'imported',
    ]);
    const evolved =
      (await readFile(plan.seed.path, 'utf8')) + 'extra history\n';
    await writeFile(plan.seed.path, evolved);
    expect((await planSessionImport(input)).occupancy).toBe('diverged');
    await expect(applySessionImport(input, plan.digest)).rejects.toMatchObject({
      code: 'seed-diverged',
    });
    expect(await readFile(plan.seed.path, 'utf8')).toBe(evolved);
  });
  it('rejects symlink store descendants and a symlink selected source', async () => {
    const external = join(root, 'elsewhere');
    await mkdir(external);
    await symlink(external, join(root, '.claude', 'projects'));
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'unsafe-store-path',
    });
    await rm(join(root, '.claude', 'projects'));
    const content = await readFile(raw);
    await rm(raw);
    await writeFile(join(root, 'raw-copy'), content);
    await symlink(join(root, 'raw-copy'), raw);
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: expect.stringMatching(/source-unreadable|import-source-incomplete/),
    });
  });
  it.each([
    [
      'pending-tool-call',
      [
        user(),
        { type: 'function_call', call_id: 'c1', name: 'tool', arguments: '{}' },
      ],
    ],
    ['incomplete-source-turn', [user()]],
    [
      'unsupported-tool-arguments',
      [
        user(),
        { type: 'function_call', call_id: 'c1', name: 'tool', arguments: '[]' },
      ],
    ],
    ['unsupported-response-item', [user(), { type: 'opaque_future' }]],
    [
      'unsupported-tool-id',
      [
        user(),
        {
          type: 'function_call',
          call_id: 'invalid.id',
          name: 'tool',
          arguments: '{}',
        },
      ],
    ],
  ])('refuses %s without writing', async (code, items) => {
    await setCodex(codex(items));
    await expect(planSessionImport(input)).rejects.toMatchObject({ code });
    expect(await readdir(join(root, '.claude'))).toEqual([]);
  });
  it('recognizes whole injected prefixes while preserving quoted wrappers and user tails', async () => {
    await setCodex(
      codex([
        user(
          '# AGENTS.md instructions for /synthetic\n\n<INSTRUCTIONS>\nPRIVATE_RULE\n</INSTRUCTIONS><environment_context>PRIVATE_ENV</environment_context>\nUSER_TAIL',
        ),
        user('Quoted example: <permissions>keep me</permissions>'),
        assistant(),
      ]),
    );
    const plan = await planSessionImport(input);
    expect(plan.omissions['runtime-context']).toBe(2);
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).not.toMatch(/PRIVATE_RULE|PRIVATE_ENV/);
    expect(text).toContain('USER_TAIL');
    expect(text).toContain(
      'Quoted example: <permissions>keep me</permissions>',
    );
  });
  it('imports only surviving Codex replacement history and refuses summary-only compaction/rollback', async () => {
    await setCodex([
      ...codex([user('OLD_HISTORY'), assistant()]),
      {
        type: 'compacted',
        payload: {
          replacement_history: [user('SURVIVING'), assistant('survived')],
        },
      },
    ]);
    const plan = await planSessionImport(input);
    await applySessionImport(input, plan.digest);
    expect(await readFile(plan.seed.path, 'utf8')).not.toContain('OLD_HISTORY');
    await setCodex([
      ...codex([user(), assistant()]),
      { type: 'compacted', payload: { message: 'summary' } },
    ]);
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'unsupported-codex-compaction',
    });
    await setCodex([
      ...codex([user(), assistant()]),
      { type: 'event_msg', payload: { type: 'thread_rolled_back' } },
    ]);
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'unsupported-rollback',
    });
  });
  it('follows Claude active parents, recovers pure parallel-result siblings, and checks archived Codex seeds', async () => {
    const file = join(
      root,
      '.claude',
      'projects',
      source.replace(/[/.]/gu, '-'),
      `${sid}.jsonl`,
    );
    await mkdir(dirname(file), { recursive: true });
    const row = (
      uuid: string,
      parentUuid: string | null,
      type: string,
      content: unknown,
    ) => ({
      uuid,
      parentUuid,
      type,
      sessionId: sid,
      cwd: source,
      timestamp: time,
      isSidechain: false,
      message: { role: type, content },
    });
    const records = [
      row('u', null, 'user', 'hello'),
      row('a', 'u', 'assistant', [
        { type: 'tool_use', id: 'one', name: 'first', input: { x: 1 } },
        { type: 'tool_use', id: 'two', name: 'second', input: { x: 2 } },
      ]),
      row('r1', 'a', 'user', [
        { type: 'tool_result', tool_use_id: 'one', content: 'FIRST' },
      ]),
      row('r2', 'a', 'user', [
        { type: 'tool_result', tool_use_id: 'two', content: 'SECOND' },
      ]),
      row('abandoned', 'u', 'user', 'ABANDONED'),
      row('done', 'r2', 'assistant', [{ type: 'text', text: 'final' }]),
    ];
    await writeFile(file, rows(records));
    input = { ...input, session: `claude:cli:${sid}`, to: 'codex' };
    const plan = await planSessionImport(input);
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain('FIRST');
    expect(text).toContain('SECOND');
    expect(text).not.toContain('ABANDONED');
    expect(text).not.toContain('forked_from_id');
    await mkdir(join(root, '.codex', 'archived_sessions'));
    await writeFile(
      join(
        root,
        '.codex',
        'archived_sessions',
        `rollout-old-${plan.seed.id}.jsonl`,
      ),
      text,
    );
    expect((await planSessionImport(input)).occupancy).toBe('archived');
    await expect(applySessionImport(input, plan.digest)).rejects.toMatchObject({
      code: 'seed-archived',
    });
  });
  it('preserves explicit symlink home spelling in commands and guards the default environment', async () => {
    const alias = join(root, 'home alias');
    await symlink(join(root, '.claude'), alias);
    const selected = await planSessionImport({ ...input, targetHome: alias });
    expect(selected.targetHome.canonicalPath).toBe(join(root, '.claude'));
    expect(selected.instructions.at(-1)).toMatchObject({
      command: expect.stringContaining(`env 'CLAUDE_CONFIG_DIR=${alias}'`),
    });
    const plan = await planSessionImport(input);
    expect(plan.instructions.at(-1)).toMatchObject({
      command: expect.stringContaining('${CLAUDE_CONFIG_DIR+set}'),
    });
    process.env.CLAUDE_CONFIG_DIR = '';
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'invalid-target-home',
    });
  });
});

describe('strict source and routing boundaries', () => {
  it('refuses partial JSONL, invalid UTF-8, oversized raw lines, and unknown runtime context before publication', async () => {
    const valid = rows(codex([user(), assistant()]));
    await writeFile(raw, valid + '{');
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: expect.stringMatching(
        /malformed-native-history|import-source-incomplete/,
      ),
    });
    await writeFile(
      raw,
      Buffer.concat([Buffer.from(valid), Buffer.from([0xff, 0x0a])]),
    );
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: expect.stringMatching(
        /malformed-native-history|import-source-incomplete/,
      ),
    });
    await setCodex(codex([user('x'.repeat(4 * 1024 * 1024)), assistant()]));
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'import-limit-exceeded',
    });
    await setCodex(
      codex([
        user('<permissions instructions>private</permissions>'),
        assistant(),
      ]),
    );
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'ambiguous-runtime-context',
    });
    expect(await readdir(join(root, '.claude'))).toEqual([]);
  });
  it('refuses active imports and provider homes inside either worktree before creating store descendants', async () => {
    await expect(
      planSessionImport({ ...input, entryPoint: 'source-current' }),
    ).rejects.toMatchObject({
      code: 'source-current-import-unsupported',
      message: expect.stringContaining('exit the source session'),
    });
    await expect(
      planSessionImport({ ...input, targetHome: target }),
    ).rejects.toMatchObject({ code: 'target-home-within-worktree' });
    expect(await readdir(target)).toEqual(['.git', 'file']);
  });
});

function claudeRow(
  uuid: string,
  parentUuid: string | null,
  type: 'user' | 'assistant',
  content: unknown,
  overrides: Record<string, unknown> = {},
) {
  return {
    uuid,
    parentUuid,
    type,
    sessionId: sid,
    cwd: source,
    timestamp: time,
    isSidechain: false,
    message: { role: type, content },
    ...overrides,
  };
}
async function setClaude(records: unknown[]) {
  const path = join(
    root,
    '.claude',
    'projects',
    source.replace(/[/.]/gu, '-'),
    `${sid}.jsonl`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, rows(records));
  input = { ...input, session: `claude:cli:${sid}`, to: 'codex' };
}

describe('review regressions at the public import boundary', () => {
  it.each([
    'on-chain attachment',
    'off-chain attachment',
    'off-chain enqueue',
    'off-chain remove',
    'unknown attachment',
  ])(
    'refuses %s without losing queued or unknown attachment content',
    async (kind) => {
      const queued =
        kind.includes('enqueue') || kind.includes('remove')
          ? {
              type: 'queue-operation',
              operation: kind.includes('enqueue') ? 'enqueue' : 'remove',
              content: 'QUEUED_USER_REQUEST',
              sessionId: sid,
            }
          : {
              type: 'attachment',
              attachment: {
                type:
                  kind === 'unknown attachment'
                    ? 'unproven_attachment'
                    : 'queued_command',
                prompt: 'QUEUED_USER_REQUEST',
                origin: { kind: 'human' },
              },
              sessionId: sid,
            };
      const chainQueued =
        kind === 'on-chain attachment'
          ? {
              ...queued,
              uuid: 'queue',
              parentUuid: 'u',
              timestamp: time,
              cwd: source,
            }
          : queued;
      await setClaude([
        claudeRow('u', null, 'user', 'hello'),
        chainQueued,
        claudeRow(
          'a',
          kind === 'on-chain attachment' ? 'queue' : 'u',
          'assistant',
          'completed',
        ),
      ]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code:
          kind === 'unknown attachment'
            ? 'unsupported-native-attachment'
            : 'unsupported-queued-input',
      });
    },
  );
  it('preserves recognized slash-command identity and arguments while omitting its isMeta expansion', async () => {
    await setClaude([
      claudeRow(
        'command',
        null,
        'user',
        '<command-message>skill</command-message>\n<command-name>/skill</command-name>\n<command-args>Keep this user request exactly.</command-args>',
      ),
      claudeRow('expanded', 'command', 'user', 'PRIVATE_IS_META_EXPANSION', {
        isMeta: true,
      }),
      claudeRow('done', 'expanded', 'assistant', 'completed'),
    ]);
    const plan = await planSessionImport(input);
    expect(plan.omissions['runtime-context']).toBe(1);
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain('/skill Keep this user request exactly.');
    expect(text).not.toContain('PRIVATE_IS_META_EXPANSION');
    expect(plan.omissions['synthetic-assistant-first-preface']).toBeUndefined();
  });
  it('retains standalone command arguments and refuses malformed command mixtures', async () => {
    await setClaude([
      claudeRow(
        'u',
        null,
        'user',
        '<command-args>Standalone user request.</command-args>',
      ),
      claudeRow('a', 'u', 'assistant', 'completed'),
    ]);
    const plan = await planSessionImport(input);
    await applySessionImport(input, plan.digest);
    expect(await readFile(plan.seed.path, 'utf8')).toContain(
      'Standalone user request.',
    );
    await setClaude([
      claudeRow(
        'u',
        null,
        'user',
        '<command-message>skill</command-message>\n<command-name>/different</command-name>\n<command-args>request</command-args>',
      ),
      claudeRow('a', 'u', 'assistant', 'completed'),
    ]);
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'ambiguous-runtime-context',
    });
  });
  it.each([
    'isApiErrorMessage',
    'isAbortedMidStream',
    'truncatedAfterOutput',
    'synthetic-model',
  ])(
    'refuses a final assistant %s marker as evidence of source completion',
    async (marker) => {
      const final = claudeRow(
        'a',
        'u',
        'assistant',
        'Nonempty runtime error text.',
      );
      const flagged =
        marker === 'synthetic-model'
          ? { ...final, message: { ...final.message, model: '<synthetic>' } }
          : { ...final, [marker]: true };
      await setClaude([claudeRow('u', null, 'user', 'hello'), flagged]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code: 'incomplete-source-turn',
        message: expect.stringContaining('exit the source session'),
      });
    },
  );
});

describe('native chain and fidelity boundaries', () => {
  it.each(['cycle', 'missing parent', 'duplicate ID', 'sidechain ancestor'])(
    'refuses a Claude active-chain %s',
    async (kind) => {
      const u = claudeRow(
        'u',
        kind === 'cycle' ? 'a' : null,
        'user',
        'hello',
        kind === 'sidechain ancestor' ? { isSidechain: true } : {},
      );
      const a = claudeRow(
        'a',
        kind === 'missing parent' ? 'missing' : 'u',
        'assistant',
        'completed',
      );
      await setClaude([u, ...(kind === 'duplicate ID' ? [{ ...u }] : []), a]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code: {
          cycle: 'native-parent-cycle',
          'missing parent': 'native-parent-missing',
          'duplicate ID': 'duplicate-native-id',
          'sidechain ancestor': 'invalid-active-chain',
        }[kind],
      });
    },
  );
  it('stops at a Claude compaction boundary and excludes sidechain assistant errors', async () => {
    await setClaude([
      claudeRow('old', null, 'user', 'OLD_COMPACTED_REQUEST'),
      {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: 'boundary',
        parentUuid: 'old',
        sessionId: sid,
        cwd: source,
        timestamp: time,
      },
      claudeRow('summary', 'boundary', 'user', 'SURVIVING_CONTEXT'),
      claudeRow('done', 'summary', 'assistant', 'completed'),
      claudeRow('side', 'old', 'assistant', 'OFFCHAIN_ERROR', {
        isSidechain: true,
        isApiErrorMessage: true,
      }),
    ]);
    const plan = await planSessionImport(input);
    expect(plan.omissions['surviving-compaction-context']).toBe(1);
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain('SURVIVING_CONTEXT');
    expect(text).not.toMatch(/OLD_COMPACTED_REQUEST|OFFCHAIN_ERROR/);
  });
  it('makes media omission and assistant-first reconstruction visible without embedding media bytes or locations', async () => {
    await setClaude([
      claudeRow('a', null, 'assistant', [
        {
          type: 'image',
          source: { type: 'base64', data: 'PRIVATE_MEDIA_BYTES' },
        },
        { type: 'text', text: 'completed' },
      ]),
    ]);
    const plan = await planSessionImport(input);
    expect(plan.omissions).toMatchObject({
      media: 1,
      'synthetic-assistant-first-preface': 1,
    });
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain('[Imported image omitted.]');
    expect(text).toContain(
      '[Reconstructed imported history begins with an assistant message.]',
    );
    expect(text).not.toContain('PRIVATE_MEDIA_BYTES');
  });
  it.each(['orphan', 'interleaved'])(
    'refuses %s tool results rather than letting the destination repair history',
    async (kind) => {
      const call = (id: string) => ({
        type: 'function_call',
        call_id: id,
        name: 'tool',
        arguments: '{}',
      });
      const result = (id: string) => ({
        type: 'function_call_output',
        call_id: id,
        output: 'result',
      });
      await setCodex(
        codex(
          kind === 'orphan'
            ? [user(), result('orphan'), assistant()]
            : [
                user(),
                call('one'),
                call('two'),
                result('one'),
                call('three'),
                result('two'),
                result('three'),
                assistant(),
              ],
        ),
      );
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code:
          kind === 'orphan'
            ? 'orphan-or-mismatched-tool-result'
            : 'interleaved-tool-exchange',
      });
    },
  );
});

it('refuses a Claude target project key beyond the supported client profile before creating a projects store', async () => {
  const longTarget = join(root, 'long-target-' + 'x'.repeat(180));
  await exec('git', [
    '-C',
    source,
    'worktree',
    'add',
    '-qb',
    'long-target',
    longTarget,
  ]);
  await expect(
    planSessionImport({ ...input, destinationPath: longTarget }),
  ).rejects.toMatchObject({ code: 'unsupported-claude-project-key' });
  expect(await readdir(join(root, '.claude'))).toEqual([]);
});

describe('final retained-turn completion evidence', () => {
  const lifecycle = (payload: Record<string, unknown>) => ({
    type: 'event_msg',
    timestamp: time,
    payload,
  });
  it.each(['commentary', 'abort', 'error', 'pending'])(
    'refuses a final Codex %s boundary without guessing from assistant prose',
    async (boundary) => {
      const final =
        boundary === 'commentary'
          ? { ...assistant('Still working.'), phase: 'commentary' }
          : assistant('Nonempty final response.');
      const events =
        boundary === 'commentary'
          ? []
          : [
              lifecycle(
                boundary === 'abort'
                  ? { type: 'turn_aborted' }
                  : boundary === 'error'
                    ? {
                        type: 'task_complete',
                        error: { codex_error_info: 'usage_limit_exceeded' },
                      }
                    : { type: 'task_started' },
              ),
            ];
      await setCodex([...codex([user(), final]), ...events]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code: 'incomplete-source-turn',
        message: expect.stringContaining('exit the source session'),
      });
    },
  );
  it('does not let omitted Codex reasoning or runtime instructions clear a trailing native error', async () => {
    await setCodex([
      ...codex([user(), assistant()]),
      lifecycle({
        type: 'task_complete',
        error: { codex_error_info: 'response_too_large' },
      }),
      {
        type: 'response_item',
        timestamp: time,
        payload: { type: 'reasoning', encrypted_content: 'OMITTED_REASONING' },
      },
      {
        type: 'response_item',
        timestamp: time,
        payload: {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: 'OMITTED_RUNTIME' }],
        },
      },
    ]);
    await expect(planSessionImport(input)).rejects.toMatchObject({
      code: 'incomplete-source-turn',
    });
  });
  it.each([
    'no lifecycle',
    'recovered later response',
    'recovered successful turn',
    'replacement history',
  ])('preserves valid Codex %s', async (kind) => {
    const records =
      kind === 'no lifecycle'
        ? codex([user(), assistant('FINAL_WITHOUT_EVENTS')])
        : [
            ...codex([
              user('HISTORICAL_USER'),
              assistant('HISTORICAL_UNSUCCESSFUL_REPLY'),
            ]),
            lifecycle({ type: 'turn_aborted' }),
          ];
    if (kind === 'replacement history')
      records.push({
        type: 'compacted',
        payload: {
          replacement_history: [
            user('SURVIVING_USER'),
            assistant('RECOVERED_FINAL'),
          ],
        },
      });
    else if (kind !== 'no lifecycle') {
      records.push(
        ...codex([user('RECOVERY_USER'), assistant('RECOVERED_FINAL')]).slice(
          1,
        ),
      );
      if (kind === 'recovered successful turn')
        records.push(lifecycle({ type: 'task_complete' }));
    }
    await setCodex(records);
    const plan = await planSessionImport(input);
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain(
      kind === 'no lifecycle' ? 'FINAL_WITHOUT_EVENTS' : 'RECOVERED_FINAL',
    );
    if (kind === 'replacement history')
      expect(text).not.toContain('HISTORICAL_UNSUCCESSFUL_REPLY');
    else if (kind !== 'no lifecycle')
      expect(text).toContain('HISTORICAL_UNSUCCESSFUL_REPLY');
  });
  it.each(['isMeta tail', 'runtime-envelope tail'])(
    'refuses flagged Claude final retained text hidden by a trailing %s',
    async (kind) => {
      const error = claudeRow(
        'error',
        'u',
        'assistant',
        'ERROR_TEXT_THAT_MUST_NOT_ESTABLISH_COMPLETION',
        kind === 'isMeta tail'
          ? { isApiErrorMessage: true }
          : {
              message: {
                role: 'assistant',
                model: '<synthetic>',
                content: 'SYNTHETIC_TEXT_THAT_MUST_NOT_ESTABLISH_COMPLETION',
              },
            },
      );
      const tail = claudeRow(
        'tail',
        'error',
        'user',
        kind === 'isMeta tail'
          ? 'PRIVATE_META'
          : '<system-reminder>RUNTIME_ONLY</system-reminder>',
        kind === 'isMeta tail' ? { isMeta: true } : {},
      );
      await setClaude([claudeRow('u', null, 'user', 'hello'), error, tail]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code: 'incomplete-source-turn',
        message: expect.stringContaining('exit the source session'),
      });
    },
  );
  it('preserves historical Claude error text after a later genuine assistant response and ignored trailing metadata', async () => {
    await setClaude([
      claudeRow('u', null, 'user', 'hello'),
      claudeRow('error', 'u', 'assistant', 'HISTORICAL_CLAUDE_ERROR', {
        isApiErrorMessage: true,
      }),
      claudeRow('retry', 'error', 'user', 'retry please'),
      claudeRow('good', 'retry', 'assistant', 'RECOVERED_CLAUDE_FINAL'),
      claudeRow('reasoning', 'good', 'assistant', [
        { type: 'thinking', thinking: 'OMITTED_POST_REPLY_REASONING' },
      ]),
      claudeRow(
        'tail',
        'reasoning',
        'user',
        '<local-command-stdout>RUNTIME_ONLY</local-command-stdout>',
      ),
    ]);
    const plan = await planSessionImport(input);
    await applySessionImport(input, plan.digest);
    const text = await readFile(plan.seed.path, 'utf8');
    expect(text).toContain('HISTORICAL_CLAUDE_ERROR');
    expect(text).toContain('RECOVERED_CLAUDE_FINAL');
    expect(plan.omissions['private-reasoning']).toBe(1);
    expect(text).not.toContain('OMITTED_POST_REPLY_REASONING');
    expect(text).not.toContain('RUNTIME_ONLY');
  });

  it.each([
    'reasoning-only abort',
    'empty truncated leaf',
    'empty synthetic leaf',
    'malformed flag',
  ])(
    'refuses a trailing Claude %s even when earlier assistant text survives',
    async (kind) => {
      const leaf = claudeRow(
        'leaf',
        'partial',
        'assistant',
        kind === 'reasoning-only abort' || kind === 'malformed flag'
          ? [{ type: 'thinking', thinking: 'PRIVATE_REASONING' }]
          : [],
        kind === 'reasoning-only abort'
          ? { isAbortedMidStream: true }
          : kind === 'empty truncated leaf'
            ? { truncatedAfterOutput: true }
            : kind === 'empty synthetic leaf'
              ? {
                  message: {
                    role: 'assistant',
                    model: '<synthetic>',
                    content: [],
                  },
                }
              : { isApiErrorMessage: 'true' },
      );
      await setClaude([
        claudeRow('u', null, 'user', 'hello'),
        claudeRow('partial', 'u', 'assistant', 'Earlier partial reply.'),
        leaf,
      ]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code:
          kind === 'malformed flag'
            ? 'malformed-native-history'
            : 'incomplete-source-turn',
        ...(kind === 'malformed flag'
          ? {}
          : { message: expect.stringContaining('exit the source session') }),
      });
    },
  );

  it.each(['isMeta tail', 'runtime-envelope tail'])(
    'refuses an omitted flagged assistant hidden by a later %s',
    async (kind) => {
      const flagged = claudeRow(
        'flagged',
        'partial',
        'assistant',
        kind === 'isMeta tail'
          ? [{ type: 'thinking', thinking: 'PRIVATE_REASONING' }]
          : [],
        kind === 'isMeta tail'
          ? { isAbortedMidStream: true }
          : { truncatedAfterOutput: true },
      );
      const tail = claudeRow(
        'tail',
        'flagged',
        'user',
        kind === 'isMeta tail'
          ? 'PRIVATE_META'
          : '<system-reminder>RUNTIME_ONLY</system-reminder>',
        kind === 'isMeta tail' ? { isMeta: true } : {},
      );
      await setClaude([
        claudeRow('u', null, 'user', 'hello'),
        claudeRow('partial', 'u', 'assistant', 'Earlier partial reply.'),
        flagged,
        tail,
      ]);
      await expect(planSessionImport(input)).rejects.toMatchObject({
        code: 'incomplete-source-turn',
        message: expect.stringContaining('exit the source session'),
      });
    },
  );
});

describe('stable seed read during concurrent publication cleanup', () => {
  it.each(['hardlink cleanup', 'byte mutation'])(
    'handles %s between native read and final fstat without weakening snapshot checks',
    async (kind) => {
      const plan = await planSessionImport(input);
      await applySessionImport(input, plan.digest);
      const original = await readFile(plan.seed.path);
      const staging = join(
        dirname(plan.seed.path),
        '.concurrent-winner-stage.tmp',
      );
      await link(plan.seed.path, staging);
      const actualFs =
        await vi.importActual<typeof import('node:fs/promises')>(
          'node:fs/promises',
        );
      let injected = false;
      let before: bigint | undefined, after: bigint | undefined;
      vi.mocked(open).mockImplementation(async (...args) => {
        const handle = await actualFs.open(...args);
        if (args[0] === plan.seed.path && !injected) {
          const nativeStat = handle.stat.bind(handle);
          let statCalls = 0;
          handle.stat = (async (
            options?: Parameters<typeof handle.stat>[0],
          ) => {
            if (++statCalls === 2 && !injected) {
              injected = true;
              before = (await nativeStat({ bigint: true })).ctimeNs;
              if (kind === 'hardlink cleanup') await unlink(staging);
              else
                await writeFile(
                  plan.seed.path,
                  Buffer.alloc(original.length, 0x78),
                );
              after = (await nativeStat({ bigint: true })).ctimeNs;
            }
            return nativeStat(options);
          }) as typeof handle.stat;
        }
        return handle;
      });
      if (kind === 'hardlink cleanup') {
        expect((await applySessionImport(input, plan.digest)).status).toBe(
          'already-imported',
        );
        expect(await readFile(plan.seed.path)).toEqual(original);
      } else
        await expect(
          applySessionImport(input, plan.digest),
        ).rejects.toMatchObject({ code: 'store-path-drift' });
      expect(injected).toBe(true);
      expect(after).not.toBe(before);
    },
  );
});
