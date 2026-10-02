import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  adapterContext,
  codexCollabAgentToolCall,
  codexCommandExecution,
  codexEventUserMessage,
  codexExtensionWebSearch,
  codexFunctionCall,
  codexItemCompleted,
  codexMcpToolCall,
  codexMessage,
  codexSessionMeta,
  codexToolOutput,
  DAY_MS,
  makeTempHome,
  searchEnv,
  writeCodexHistory,
  writeCodexRollout,
  writeCodexSessionIndex,
  writeSqliteStub,
  type TempHome,
} from '../../helpers/test-helpers.js';
import { compileMatcher } from '../matcher.js';
import { probeTools } from '../tools.js';
import type { JsonObject } from '../types.js';
import {
  classifyCodexRecord,
  codexOutputText,
  createCodexAdapter,
  createCodexFileClassifier,
  isInheritedRecord,
} from './codex.js';

let temp: TempHome;
const NOW = Date.now();
const PARENT = '019a0000-0000-7000-8000-000000000001';
const CHILD = '019a0000-0000-7000-8000-000000000002';
const ARCHIVED = '019a0000-0000-7000-8000-000000000003';

beforeEach(() => {
  temp = makeTempHome('session-search-codex-');
});

afterEach(() => {
  temp.cleanup();
});

const record = (value: unknown) => value as JsonObject;
const matches = <T extends { text: string }>(units: T[], pattern: string) => {
  const matcher = compileMatcher([pattern], { literal: true });
  return units.filter((unit) => matcher.match(unit.text));
};

describe('Codex enumeration', () => {
  it('enumerates live and archived rollouts and labels archived ones', async () => {
    const live = writeCodexRollout(temp.home, {
      id: PARENT,
      startedAtMs: NOW - DAY_MS,
      records: [codexSessionMeta({ id: PARENT, cwd: '/work/repo' })],
    });
    const archived = writeCodexRollout(temp.home, {
      id: ARCHIVED,
      archived: true,
      startedAtMs: NOW - 2 * DAY_MS,
      records: [codexSessionMeta({ id: ARCHIVED, cwd: '/work/old' })],
    });
    const adapter = createCodexAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const files = await adapter.enumerate(ctx);

    expect(
      files.map((file) => [file.path, file.sessionId, file.archived]),
    ).toEqual([
      [live, PARENT, false],
      [archived, ARCHIVED, true],
    ]);
    expect(files[0].cwd).toBe('/work/repo');
  });

  it('detects child rollouts from the session_meta header', async () => {
    writeCodexRollout(temp.home, {
      id: CHILD,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({
          id: CHILD,
          sessionId: PARENT,
          cwd: '/work/repo',
          subagentHistoryStartOrdinal: 3,
          // A large header line forces the second, larger bounded read.
          baseInstructionsBytes: 200 * 1024,
        }),
      ],
    });
    const adapter = createCodexAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const [file] = await adapter.enumerate(ctx);

    expect(file).toMatchObject({
      sessionId: CHILD,
      isSubagent: true,
      parentSessionId: PARENT,
      subagentHistoryStartOrdinal: 3,
      cwd: '/work/repo',
    });
  });

  it('reads headers only for files inside the time window', async () => {
    const meta = codexSessionMeta({
      id: CHILD,
      sessionId: PARENT,
      cwd: '/work/repo',
    });
    writeCodexRollout(temp.home, {
      id: CHILD,
      startedAtMs: NOW - 30 * DAY_MS,
      records: [meta],
    });
    const adapter = createCodexAdapter();
    const { ctx } = adapterContext(adapter, temp, {
      raw: { pattern: ['x'], since: '7d' },
    });

    const [file] = await adapter.enumerate(ctx);

    expect(file.isSubagent).toBe(false);
    expect(file.parentSessionId).toBeNull();
    expect(file.cwd).toBeUndefined();
  });

  it('reads no headers once the deadline has passed', async () => {
    writeCodexRollout(temp.home, {
      id: CHILD,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({
          id: CHILD,
          sessionId: PARENT,
          cwd: '/work/repo',
          source: { subagent: 'review' },
        }),
      ],
    });
    const adapter = createCodexAdapter();
    const { ctx } = adapterContext(adapter, temp);
    ctx.deadline = Date.now() - 1;

    const [file] = await adapter.enumerate(ctx);

    expect(file.isSubagent).toBe(false);
    expect(file.parentSessionId).toBeNull();
    expect(file.agentAuthored).toBe(false);
    expect(file.cwd).toBeUndefined();
  });

  it('marks records below the history start ordinal as inherited', () => {
    const child = { subagentHistoryStartOrdinal: 5 };
    expect(
      isInheritedRecord(child, record(codexMessage('user', 'parent text', 4))),
    ).toBe(true);
    expect(
      isInheritedRecord(child, record(codexMessage('user', 'own text', 5))),
    ).toBe(false);
    expect(
      isInheritedRecord(
        { subagentHistoryStartOrdinal: null },
        record(codexMessage('user', 'x', 1)),
      ),
    ).toBe(false);
  });
});

describe('Codex record classification', () => {
  it('classifies response_item messages and demotes injected context', () => {
    expect(
      classifyCodexRecord(
        record(codexMessage('user', 'my question', 2)),
        false,
      ),
    ).toEqual([{ role: 'user', text: 'my question' }]);
    expect(
      classifyCodexRecord(record(codexMessage('assistant', 'reply', 3)), false),
    ).toEqual([{ role: 'assistant', text: 'reply' }]);
    expect(
      classifyCodexRecord(
        record(codexMessage('user', '<environment_context>\n<cwd>/x</cwd>', 1)),
        false,
      ),
    ).toEqual([
      { role: 'context', text: '<environment_context>\n<cwd>/x</cwd>' },
    ]);
    expect(
      classifyCodexRecord(record(codexMessage('developer', 'rules', 1)), true),
    ).toEqual([]);
  });

  it('ignores event_msg user_message records, which duplicate response items', () => {
    expect(
      classifyCodexRecord(
        record(codexEventUserMessage('my question', 2)),
        true,
      ),
    ).toEqual([]);
  });

  it('matches array-form custom_tool_call_output text only with includeTools', () => {
    const output = record(
      codexToolOutput(
        'custom_tool_call_output',
        'call_1',
        [
          { type: 'input_text', text: 'Exit code: 0' },
          { type: 'input_text', text: 'ChatGPT thread: Perceive Now vetting' },
        ],
        7,
      ),
    );
    expect(matches(classifyCodexRecord(output, true), 'Perceive Now')).toEqual([
      {
        role: 'tool',
        text: 'Exit code: 0\nChatGPT thread: Perceive Now vetting',
      },
    ]);
    expect(matches(classifyCodexRecord(output, false), 'Perceive Now')).toEqual(
      [],
    );
  });

  it('matches CommandExecution aggregated_output only with includeTools', () => {
    const item = record(codexCommandExecution('listing: perceive-now.md', 9));
    expect(
      matches(classifyCodexRecord(item, true), 'perceive-now'),
    ).toHaveLength(1);
    expect(matches(classifyCodexRecord(item, false), 'perceive-now')).toEqual(
      [],
    );
  });

  it('matches McpToolCall result text, structured content, and arguments only with includeTools', () => {
    const call = record(
      codexMcpToolCall(
        {
          server: 'chat',
          tool: 'search_threads',
          arguments: { query: 'zebra' },
          content: [
            'Threads:',
            'Perceive Now vetting',
            { id: 9, rank: 'kiwi' },
          ],
          structuredContent: { threads: [{ title: 'Mango review' }] },
        },
        11,
      ),
    );

    const units = classifyCodexRecord(call, true);
    for (const phrase of ['Perceive Now', 'kiwi', 'Mango review', 'zebra']) {
      expect(matches(units, phrase), phrase).toHaveLength(1);
    }
    expect(units.every((unit) => unit.role === 'tool')).toBe(true);
    expect(classifyCodexRecord(call, false)).toEqual([]);
  });

  it('reads Extension web searches and FileChange summaries only with includeTools', () => {
    const extension = record(
      codexExtensionWebSearch(
        'guava growing season',
        [{ title: 'Orchard handbook', snippet: 'pruning notes' }],
        13,
      ),
    );
    const fileChange = record(
      codexItemCompleted(
        {
          type: 'FileChange',
          changes: {
            '/repo/a.md': { type: 'update', unified_diff: '+lychee' },
          },
          stdout: 'Success. Updated the following files: M /repo/a.md',
          stderr: '',
        },
        14,
      ),
    );

    for (const phrase of ['guava growing', 'Orchard handbook']) {
      expect(
        matches(classifyCodexRecord(extension, true), phrase),
        phrase,
      ).toHaveLength(1);
    }
    expect(
      matches(classifyCodexRecord(fileChange, true), 'Updated the following'),
    ).toHaveLength(1);
    for (const item of [extension, fileChange]) {
      expect(classifyCodexRecord(item, false)).toEqual([]);
    }
  });

  it('emits nothing for CollabAgentToolCall routing metadata', () => {
    const collab = record(
      codexCollabAgentToolCall({ 'thread-child': { status: 'papaya' } }, 12),
    );

    expect(classifyCodexRecord(collab, true)).toEqual([]);
  });

  it('drops tool text repeated within one file, whichever record carries it', () => {
    const classify = createCodexFileClassifier();
    const records = [
      codexToolOutput(
        'function_call_output',
        'call_mcp',
        [{ type: 'input_text', text: 'Threads: Perceive Now vetting' }],
        20,
      ),
      codexMcpToolCall({ content: ['Threads: Perceive Now vetting'] }, 21),
      codexToolOutput(
        'custom_tool_call_output',
        'call_sh',
        'ls: tamarind.md',
        22,
      ),
      codexCommandExecution('ls: tamarind.md', 23),
    ];
    const units = records.flatMap((item) => classify(record(item), true));

    expect(matches(units, 'Perceive Now')).toHaveLength(1);
    expect(matches(units, 'tamarind')).toHaveLength(1);
    expect(units.every((unit) => unit.role === 'tool')).toBe(true);
    // A fresh file starts with an empty set.
    expect(
      matches(
        createCodexFileClassifier()(record(records[1]), true),
        'Perceive Now',
      ),
    ).toHaveLength(1);
  });

  it('emits nothing for Reasoning, AgentMessage, or UserMessage items', () => {
    for (const item of [
      { type: 'Reasoning', summary: ['durian plan'], content: ['durian plan'] },
      { type: 'AgentMessage', text: 'durian plan' },
      { type: 'UserMessage', content: [{ type: 'text', text: 'durian plan' }] },
    ]) {
      expect(
        classifyCodexRecord(record(codexItemCompleted(item, 15)), true),
        item.type,
      ).toEqual([]);
    }
  });

  it('reads function_call output and arguments in every documented shape', () => {
    expect(codexOutputText('plain output')).toBe('plain output');
    expect(
      codexOutputText(
        JSON.stringify({ output: 'encoded output', metadata: {} }),
      ),
    ).toBe('encoded output');
    expect(
      codexOutputText(
        JSON.stringify([{ type: 'input_text', text: 'encoded blocks' }]),
      ),
    ).toBe('encoded blocks');
    const call = record(
      codexFunctionCall('call_2', 'mcp__docs__search', { query: 'zebra' }, 4),
    );
    expect(matches(classifyCodexRecord(call, true), 'zebra')).toHaveLength(1);
    expect(classifyCodexRecord(call, false)).toEqual([]);
    const out = record(
      codexToolOutput('function_call_output', 'call_2', 'found zebra docs', 5),
    );
    expect(matches(classifyCodexRecord(out, true), 'zebra')).toHaveLength(1);
  });

  it('yields no unit for image-only JSON-encoded output', () => {
    const imageOnly = JSON.stringify([
      {
        type: 'input_image',
        image_url: 'data:image/png;base64,QUJDREVGR0hJSktMTU5PUFFSU1RVVldY',
      },
    ]);
    const units = classifyCodexRecord(
      record(codexToolOutput('function_call_output', 'call_img', imageOnly, 9)),
      true,
    );
    expect(units).toEqual([]);
    expect(matches(units, 'QUJDREVG')).toEqual([]);
  });

  it('keeps non-text objects inside mixed output arrays', () => {
    const blocks = [
      { type: 'input_text', text: 'header line' },
      { title: 'Perceive Now vetting', id: 2 },
    ];
    for (const output of [JSON.stringify(blocks), blocks]) {
      const units = classifyCodexRecord(
        record(
          codexToolOutput(
            'custom_tool_call_output',
            'call_mixed',
            output as Array<{ type: 'input_text'; text: string }>,
            8,
          ),
        ),
        true,
      );
      expect(matches(units, 'Perceive Now')).toHaveLength(1);
      expect(matches(units, 'header line')).toHaveLength(1);
    }
  });

  it('keeps JSON-encoded tool output whose objects carry no text blocks', () => {
    const encoded = JSON.stringify([{ title: 'Perceive Now vetting', id: 1 }]);
    const out = record(
      codexToolOutput('function_call_output', 'call_3', encoded, 6),
    );

    const units = matches(classifyCodexRecord(out, true), 'Perceive Now');
    expect(units).toHaveLength(1);
    expect(units[0].role).toBe('tool');
    expect(codexOutputText(JSON.stringify({ content: [{ id: 7 }] }))).toContain(
      '"id":7',
    );
    expect(codexOutputText(JSON.stringify(''))).toBe('""');
  });
});

describe('Codex history and index tiers', () => {
  it('parses history.jsonl into user-typed hits with second timestamps', async () => {
    writeCodexHistory(temp.home, [
      { session_id: PARENT, ts: 1_790_000_000, text: 'look up perceive now' },
      { session_id: CHILD, ts: 1_790_000_100, text: 'something else' },
    ]);
    const adapter = createCodexAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const hits = await adapter.historyHits(
      ctx,
      compileMatcher(['perceive'], { literal: false }),
    );

    expect(hits).toEqual([
      expect.objectContaining({
        sessionId: PARENT,
        tier: 'history',
        role: 'user',
        userTyped: true,
        timestampMs: 1_790_000_000_000,
      }),
    ]);
  });

  it('turns session_index thread names into title hits', async () => {
    writeCodexSessionIndex(temp.home, [
      {
        id: PARENT,
        thread_name: 'Perceive Now vetting',
        updated_at: '2026-09-29T10:00:00Z',
      },
      {
        id: CHILD,
        thread_name: 'Other work',
        updated_at: '2026-09-29T11:00:00Z',
      },
    ]);
    const adapter = createCodexAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const hits = await adapter.metadataHits(
      ctx,
      compileMatcher(['perceive'], { literal: false }),
    );

    expect(hits).toEqual([
      expect.objectContaining({
        sessionId: PARENT,
        tier: 'meta',
        role: 'title',
        userTyped: false,
        text: 'Perceive Now vetting',
        timestampMs: Date.parse('2026-09-29T10:00:00Z'),
      }),
    ]);
  });
});

describe.skipIf(process.platform === 'win32')(
  'Codex sqlite threads tier',
  () => {
    const columns = [
      'id',
      'rollout_path',
      'created_at',
      'updated_at',
      'source',
      'cwd',
      'title',
      'archived',
      'git_origin_url',
      'first_user_message',
    ];

    it('reads titles, first messages, and cwd through a probed sqlite3', async () => {
      const rollout = writeCodexRollout(temp.home, {
        id: PARENT,
        startedAtMs: NOW - DAY_MS,
        records: [codexSessionMeta({ id: PARENT, cwd: '/header/cwd' })],
      });
      const stub = writeSqliteStub(temp, columns, [
        {
          id: PARENT,
          rollout_path: rollout,
          created_at: Math.floor((NOW - DAY_MS) / 1000),
          updated_at: Math.floor(NOW / 1000),
          source: 'cli',
          cwd: '/thread/cwd',
          title: 'Vet the Perceive Now idea',
          archived: 0,
          git_origin_url: null,
          first_user_message: 'can you check perceive now for me',
        },
      ]);
      const tools = probeTools(
        searchEnv(temp, { SESSION_SEARCH_SQLITE3: stub }),
      );
      expect(tools.sqlite3).toBe(stub);
      const adapter = createCodexAdapter();
      const { ctx, degraded } = adapterContext(adapter, temp, { tools });

      const files = await adapter.enumerate(ctx);
      const hits = await adapter.metadataHits(
        ctx,
        compileMatcher(['perceive now'], { literal: false }),
      );

      expect(degraded).toEqual([]);
      expect(files[0].cwd).toBe('/thread/cwd');
      expect(
        hits.map((hit) => [hit.role, hit.tier, hit.userTyped, hit.text]),
      ).toEqual([
        ['title', 'meta', false, 'Vet the Perceive Now idea'],
        ['user', 'meta', true, 'can you check perceive now for me'],
      ]);
      expect(hits[0].transcriptPath).toBe(rollout);
    });

    it('degrades the source when the threads table lacks rollout_path', async () => {
      const stub = writeSqliteStub(
        temp,
        columns.filter((column) => column !== 'rollout_path'),
        [{ id: PARENT, title: 'Perceive Now' }],
      );
      const adapter = createCodexAdapter();
      const { ctx, degraded } = adapterContext(adapter, temp, {
        tools: { sqlite3: stub },
      });

      const hits = await adapter.metadataHits(
        ctx,
        compileMatcher(['perceive'], { literal: false }),
      );

      expect(hits).toEqual([]);
      expect(degraded).toHaveLength(1);
      expect(degraded[0]).toContain('rollout_path');
    });

    it('does not count agent-authored thread first messages as user-typed', async () => {
      const child = writeCodexRollout(temp.home, {
        id: CHILD,
        startedAtMs: NOW - DAY_MS,
        records: [
          codexSessionMeta({ id: CHILD, sessionId: PARENT, cwd: '/w' }),
        ],
      });
      const consolidation = writeCodexRollout(temp.home, {
        id: ARCHIVED,
        startedAtMs: NOW - DAY_MS,
        records: [codexSessionMeta({ id: ARCHIVED, cwd: '/w' })],
      });
      const row = (id: string, rollout: string, source: string) => ({
        id,
        rollout_path: rollout,
        created_at: Math.floor((NOW - DAY_MS) / 1000),
        updated_at: Math.floor(NOW / 1000),
        source,
        cwd: '/w',
        title: null,
        archived: 0,
        git_origin_url: null,
        first_user_message: 'please summarize perceive now',
      });
      const stub = writeSqliteStub(temp, columns, [
        row(
          CHILD,
          child,
          JSON.stringify({
            subagent: { thread_spawn: { parent_thread_id: PARENT, depth: 1 } },
          }),
        ),
        row(
          ARCHIVED,
          consolidation,
          JSON.stringify({ subagent: 'memory_consolidation' }),
        ),
      ]);
      const adapter = createCodexAdapter();
      const { ctx } = adapterContext(adapter, temp, {
        tools: { sqlite3: stub },
      });

      const files = await adapter.enumerate(ctx);
      const hits = await adapter.metadataHits(
        ctx,
        compileMatcher(['perceive now'], { literal: false }),
      );

      expect(
        hits.map((hit) => [hit.sessionId, hit.role, hit.userTyped]),
      ).toEqual([
        [CHILD, 'user', false],
        [ARCHIVED, 'user', false],
      ]);
      expect(files.map((file) => file.agentAuthored)).toEqual([true, true]);
    });

    it('skips the sqlite tier cleanly when SESSION_SEARCH_NO_SQLITE3=1', async () => {
      const stub = writeSqliteStub(temp, columns, [
        { id: PARENT, rollout_path: '/nowhere', title: 'Perceive Now' },
      ]);
      const tools = probeTools({
        PATH: `${stub.replace(/\/sqlite3$/, '')}`,
        SESSION_SEARCH_NO_SQLITE3: '1',
      });
      expect(tools.sqlite3).toBeNull();
      const adapter = createCodexAdapter();
      const { ctx, degraded } = adapterContext(adapter, temp, { tools });

      const hits = await adapter.metadataHits(
        ctx,
        compileMatcher(['perceive'], { literal: false }),
      );

      expect(hits).toEqual([]);
      expect(degraded).toEqual([]);
    });
  },
);
