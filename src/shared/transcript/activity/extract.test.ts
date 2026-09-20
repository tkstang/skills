import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
import { readRecordsDetailed } from '../runtimes.js';
import { extractActivity } from './extract.js';
import type { ActivitySource } from './types.js';

const FIXTURE_ROOT = fileURLToPath(
  new URL('../fixtures/session-fidelity/', import.meta.url),
);

const CLAUDE_SOURCE: ActivitySource = {
  runtime: 'claude-code',
  sessionId: 'fixture-claude-session',
  nativeSessionId: 'fixture-claude-session',
  transcriptPath: `${FIXTURE_ROOT}claude-code/captured-activity.jsonl`,
};

const CODEX_SOURCE: ActivitySource = {
  runtime: 'codex',
  sessionId: '77777777-7777-4777-8777-777777777777',
  nativeSessionId: '88888888-8888-4888-8888-888888888888',
  transcriptPath: `${FIXTURE_ROOT}codex/captured-activity.jsonl`,
};

const TEST_SNAPSHOT = {
  capturedAt: '2026-09-19T00:00:00.000Z',
  sourceBytes: 0,
};

function detailed(
  record: JsonObject,
  recordIndex: number,
): DetailedTranscriptRecord {
  return {
    record,
    sourceCarrier: '{}',
    recordIndex,
    physicalLine: recordIndex + 1,
  };
}

describe('Claude Code activity extraction', () => {
  it('keeps native skill attribution and names-only source attachments without bodies', () => {
    const records = [
      detailed(
        {
          type: 'assistant',
          attributionSkill: 'session-observer',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'skill-call',
                name: 'Skill',
                input: {
                  skill: 'session-observer',
                  args: 'caller invocation input',
                },
              },
              { type: 'tool_use', id: 'read-call', name: 'Read', input: {} },
            ],
          },
        },
        0,
      ),
      detailed(
        {
          type: 'attachment',
          attachment: {
            type: 'skill_listing',
            names: ['available-one', '', 42, 'available-two'],
            content: 'private listing sentinel',
            path: '/private/listing/path',
          },
        },
        1,
      ),
      detailed(
        {
          type: 'attachment',
          attachment: {
            type: 'invoked_skills',
            skills: [
              { name: 'invoked-one', content: 'private invoked sentinel' },
              { name: 42 },
            ],
          },
        },
        2,
      ),
      detailed(
        {
          type: 'attachment',
          attachment: {
            type: 'skill_listing',
            names: ['available-one'],
          },
        },
        3,
      ),
      detailed(
        {
          type: 'attachment',
          attachment: {
            type: 'invoked_skills',
            skills: [{ name: 'invoked-one' }],
          },
        },
        4,
      ),
    ];

    const extracted = extractActivity({
      source: CLAUDE_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });

    expect(extracted.events[0]).toMatchObject({
      nativeName: 'Skill',
      arguments: {
        skill: 'session-observer',
        args: 'caller invocation input',
      },
      skillEvidence: [
        { kind: 'native-attribution', name: 'session-observer' },
        { kind: 'native-invocation', name: 'session-observer' },
      ],
    });
    expect(extracted.events[1]).toMatchObject({
      nativeName: 'Read',
      skillEvidence: [{ kind: 'native-attribution', name: 'session-observer' }],
    });
    expect(extracted.sourceMetadata).toMatchObject({
      scope: 'captured-source',
      skills: [
        expect.objectContaining({
          evidence: 'available',
          name: 'available-two',
          locator: expect.objectContaining({
            jsonPointer: '/attachment/names/3',
          }),
        }),
        expect.objectContaining({
          evidence: 'invoked',
          name: 'invoked-one',
          locator: expect.objectContaining({
            jsonPointer: '/attachment/skills/0/name',
          }),
        }),
        expect.objectContaining({
          evidence: 'available',
          name: 'available-one',
          locator: expect.objectContaining({
            jsonPointer: '/attachment/names/0',
            recordIndex: 3,
          }),
        }),
        expect.objectContaining({
          evidence: 'invoked',
          name: 'invoked-one',
          locator: expect.objectContaining({ recordIndex: 4 }),
        }),
      ],
    });
    const serialized = JSON.stringify(extracted.sourceMetadata);
    expect(serialized).not.toContain('private');
    expect(serialized).not.toContain('/private/listing/path');
    expect(JSON.stringify(extracted)).not.toContain('private listing sentinel');
    expect(JSON.stringify(extracted)).not.toContain('private invoked sentinel');
    expect(extracted.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'available',
      captured: 4,
    });
  });

  it('distinguishes an empty native skill listing from no source listing', () => {
    const extracted = extractActivity({
      source: CLAUDE_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [
          detailed(
            {
              type: 'attachment',
              attachment: { type: 'skill_listing', names: [] },
            },
            0,
          ),
        ],
        diagnostics: [],
      },
    });

    expect(extracted.sourceMetadata?.skills).toEqual([]);
    expect(extracted.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'available',
      captured: 0,
    });
  });

  it('counts invoked-only source names and recognizes an empty invoked carrier', () => {
    const invoked = extractActivity({
      source: CLAUDE_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [
          detailed(
            {
              type: 'attachment',
              attachment: {
                type: 'invoked_skills',
                skills: [{ name: 'invoked-only' }],
              },
            },
            0,
          ),
        ],
        diagnostics: [],
      },
    });
    const empty = extractActivity({
      source: CLAUDE_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [
          detailed(
            {
              type: 'attachment',
              attachment: { type: 'invoked_skills', skills: [] },
            },
            0,
          ),
        ],
        diagnostics: [],
      },
    });

    expect(invoked.sourceMetadata?.skills).toEqual([
      expect.objectContaining({
        evidence: 'invoked',
        name: 'invoked-only',
      }),
    ]);
    expect(invoked.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'available',
      captured: 1,
    });
    expect(empty.sourceMetadata?.skills).toEqual([]);
    expect(empty.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'available',
      captured: 0,
    });
  });

  it('extracts multiblock calls, result carriers, persisted output, and notifications', async () => {
    const read = await readRecordsDetailed(CLAUDE_SOURCE.transcriptPath);
    const extracted = extractActivity({
      source: CLAUDE_SOURCE,
      read,
    });

    expect(extracted.activitySchemaVersion).toBe(1);
    expect(extracted.source).toEqual(CLAUDE_SOURCE);
    expect(extracted.sourceSnapshot).toEqual({
      capturedAt: read.capturedAt,
      sourceBytes: read.sourceBytes,
    });
    expect(extracted.diagnostics).toEqual([]);
    expect(extracted.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'not-recorded',
      captured: 0,
    });

    const calls = extracted.events.filter((event) => event.kind === 'call');
    expect(calls.map((event) => event.nativeName)).toEqual([
      'Read',
      'Bash',
      'mcp__fixture__lookup',
    ]);
    expect(calls.map((event) => event.locator)).toEqual([
      { recordIndex: 0, physicalLine: 1, jsonPointer: '/message/content/1' },
      { recordIndex: 0, physicalLine: 1, jsonPointer: '/message/content/2' },
      { recordIndex: 0, physicalLine: 1, jsonPointer: '/message/content/3' },
    ]);
    expect(calls[1].arguments).toEqual({ command: 'printf fixture' });

    const results = extracted.events.filter((event) => event.kind === 'result');
    expect(results).toHaveLength(3);
    expect(results.map((event) => event.outcome)).toEqual([
      'unknown',
      'error',
      'unknown',
    ]);
    expect(results[0].result).toEqual({
      content: [{ type: 'text', text: 'Obscured file content.' }],
    });
    expect(results[2].result).toEqual({
      content: 'Obscured MCP result.',
    });
    const topLevelResults = extracted.events.filter(
      (event) => event.nativeType === 'toolUseResult',
    );
    expect(topLevelResults).toHaveLength(3);
    expect(topLevelResults[0].result).toEqual({
      type: 'text',
      file: { filePath: '/fixture/project/example.txt' },
    });
    expect(topLevelResults[2].result).toEqual([
      { type: 'text', text: 'Obscured structured MCP content.' },
    ]);
    expect(topLevelResults[1].externalReference).toEqual({
      kind: 'persisted-output',
      availability: 'not-read',
      path: '/fixture/project/tool-results/fixture-result.txt',
      size: 4096,
    });
    expect(extracted.coverage).toContainEqual({
      dataClass: 'persisted-output',
      status: 'not-read',
      captured: 1,
      locator: {
        recordIndex: 2,
        physicalLine: 3,
        jsonPointer: '/toolUseResult',
      },
    });

    expect(extracted.events).toContainEqual(
      expect.objectContaining({
        kind: 'notification',
        nativeType: 'task-notification',
        origin: 'runtime-notification',
        locator: {
          recordIndex: 4,
          physicalLine: 5,
          jsonPointer: '/origin/kind',
        },
      }),
    );
  });

  it('preserves string/array/object result carriers and honest empty-error outcomes', () => {
    const records = [
      detailed(
        {
          type: 'user',
          origin: { kind: 'human' },
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu-empty-error',
                content: '',
                is_error: true,
              },
            ],
          },
          toolUseResult: '',
        },
        0,
      ),
      detailed(
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu-unknown',
                content: [],
              },
            ],
          },
          toolUseResult: 'Obscured string carrier.',
        },
        1,
      ),
      detailed(
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu-status',
                content: [],
              },
            ],
          },
          toolUseResult: { status: 'async_launched', agentId: 'fixture-child' },
        },
        2,
      ),
    ];

    const extracted = extractActivity({
      source: CLAUDE_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });
    const results = extracted.events.filter((event) => event.kind === 'result');
    expect(results.map((event) => event.outcome)).toEqual([
      'error',
      'unknown',
      'unknown',
    ]);
    expect(results.map((event) => event.result)).toEqual([
      { content: '' },
      { content: [] },
      { content: [] },
    ]);
    const topLevelResults = extracted.events.filter(
      (event) => event.nativeType === 'toolUseResult',
    );
    expect(topLevelResults.map((event) => event.result)).toEqual([
      '',
      'Obscured string carrier.',
      { status: 'async_launched', agentId: 'fixture-child' },
    ]);
    expect(topLevelResults[2]).toMatchObject({
      locator: {
        recordIndex: 2,
        physicalLine: 3,
        jsonPointer: '/toolUseResult',
      },
      outcome: 'pending',
    });
    expect(topLevelResults[2].childReference).toEqual({
      nativeId: 'fixture-child',
      status: 'async_launched',
      trajectoryAvailability: 'not-read',
    });
  });

  it('locates one top-level carrier independently from multiple content results', () => {
    const extracted = extractActivity({
      source: CLAUDE_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [
          detailed(
            {
              type: 'user',
              message: {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'toolu-first',
                    content: 'first',
                  },
                  {
                    type: 'tool_result',
                    tool_use_id: 'toolu-second',
                    content: 'second',
                  },
                ],
              },
              toolUseResult: { interrupted: true, status: 'failed' },
            },
            0,
          ),
        ],
        diagnostics: [],
      },
    });

    const contentResults = extracted.events.filter(
      (event) => event.nativeType === 'tool_result',
    );
    expect(contentResults.map((event) => event.outcome)).toEqual([
      'unknown',
      'unknown',
    ]);
    expect(contentResults.map((event) => event.locator.jsonPointer)).toEqual([
      '/message/content/0',
      '/message/content/1',
    ]);
    expect(extracted.events).toContainEqual(
      expect.objectContaining({
        kind: 'item',
        nativeType: 'toolUseResult',
        outcome: 'cancelled',
        nativeStatus: 'interrupted',
        locator: {
          recordIndex: 0,
          physicalLine: 1,
          jsonPointer: '/toolUseResult',
        },
        result: { interrupted: true, status: 'failed' },
      }),
    );
  });

  it('extracts structural turn and compaction markers without token counts', () => {
    const extracted = extractActivity({
      source: CLAUDE_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [
          detailed(
            {
              type: 'system',
              subtype: 'turn_duration',
              durationMs: 42,
              messageCount: 3,
              pendingBackgroundAgentCount: 1,
              cwd: '/private/path',
            },
            0,
          ),
          detailed(
            {
              type: 'system',
              subtype: 'compact_boundary',
              compactMetadata: {
                trigger: 'auto',
                durationMs: 11,
                preTokens: 100,
                postTokens: 50,
                preservedMessages: { allUuids: ['private-message-id'] },
              },
            },
            1,
          ),
        ],
        diagnostics: [],
      },
    });

    expect(extracted.events).toMatchObject([
      {
        kind: 'lifecycle',
        nativeType: 'turn_duration',
        outcome: 'unknown',
        metadata: {
          durationMs: 42,
          messageCount: 3,
          pendingBackgroundAgentCount: 1,
        },
      },
      {
        kind: 'compaction',
        nativeType: 'compact_boundary',
        metadata: { trigger: 'auto', durationMs: 11 },
      },
    ]);
    expect(JSON.stringify(extracted)).not.toContain('private');
    expect(JSON.stringify(extracted)).not.toContain('preTokens');
  });
});

describe('Codex activity extraction', () => {
  it('recognizes only the historical structured read_file carrier for Codex skill loads', () => {
    const records = [
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'direct-read',
            name: 'read_file',
            arguments: JSON.stringify({
              file_path: '/fixture/skills/session-observer/SKILL.md',
            }),
          },
        },
        0,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'shell-read',
            name: 'exec_command',
            arguments: JSON.stringify({
              cmd: 'cat /fixture/skills/private-shell/SKILL.md',
            }),
          },
        },
        1,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'wrong-key',
            name: 'read_file',
            arguments: JSON.stringify({
              path: '/fixture/skills/private-wrong-key/SKILL.md',
            }),
          },
        },
        2,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'unknown-name',
            name: 'functions.read_file',
            arguments: JSON.stringify({
              file_path: '/fixture/skills/private-unknown/SKILL.md',
            }),
          },
        },
        3,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: 'Mention /fixture/skills/private-prose/SKILL.md',
          },
        },
        4,
      ),
    ];
    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });

    expect(extracted.events[0]).toMatchObject({
      nativeName: 'read_file',
      skillEvidence: [
        {
          kind: 'inferred-file-read',
          name: 'session-observer',
          path: '/fixture/skills/session-observer/SKILL.md',
        },
      ],
    });
    expect(extracted.events[1]).not.toHaveProperty('skillEvidence');
    expect(extracted.events[2]).not.toHaveProperty('skillEvidence');
    expect(extracted.events[3]).not.toHaveProperty('skillEvidence');
    expect(JSON.stringify(extracted)).not.toContain('private-prose');
    expect(extracted.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'not-recorded',
      captured: 0,
    });
  });

  it('extracts native response carriers, standalone items, child ids, and metadata', async () => {
    const read = await readRecordsDetailed(CODEX_SOURCE.transcriptPath);
    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read,
    });

    expect(extracted.activitySchemaVersion).toBe(1);
    expect(extracted.diagnostics).toEqual([]);
    expect(extracted.events).toHaveLength(14);

    const calls = extracted.events.filter((event) => event.kind === 'call');
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      nativeType: 'function_call',
      nativeId: 'fixture-item-inherited',
      nativeCallId: 'fixture-call-inherited',
      nativeName: 'exec_command',
      arguments: { cmd: 'printf inherited-fixture' },
      originalArguments: '{"cmd":"printf inherited-fixture"}',
      locator: {
        recordIndex: 2,
        physicalLine: 3,
        jsonPointer: '/payload',
        ordinal: 2,
      },
    });
    expect(calls[2]).toMatchObject({
      nativeType: 'custom_tool_call',
      nativeStatus: 'completed',
      outcome: 'pending',
      arguments: 'Obscured patch body.',
      originalArguments: 'Obscured patch body.',
    });

    const results = extracted.events.filter((event) => event.kind === 'result');
    expect(results).toHaveLength(3);
    expect(results.every((event) => event.outcome === 'unknown')).toBe(true);
    expect(results[2].result).toEqual([
      { type: 'text', text: 'Obscured patch result.' },
    ]);

    const items = extracted.events.filter((event) => event.kind === 'item');
    expect(items.map((event) => [event.nativeType, event.outcome])).toEqual([
      ['CommandExecution', 'error'],
      ['McpToolCall', 'error'],
      ['WebSearch', 'unknown'],
      ['SubAgentActivity', 'success'],
    ]);
    expect(items[3].childReference).toEqual({
      nativeId: 'fixture-agent-thread',
      nickname: 'fixture-agent',
      status: 'completed',
      trajectoryAvailability: 'not-read',
    });
    expect(items.every((event) => !('relatedCallKey' in event))).toBe(true);

    expect(extracted.events).toContainEqual(
      expect.objectContaining({
        kind: 'metadata',
        nativeType: 'turn_context',
        turnId: 'fixture-turn-child',
        metadata: { model: 'gpt-5.6-sol', effort: 'high' },
      }),
    );
    expect(extracted.events).toContainEqual(
      expect.objectContaining({
        kind: 'compaction',
        nativeType: 'compacted',
        metadata: {
          first_window_id: 'fixture-window-01',
          previous_window_id: 'fixture-window-01',
          window_id: 'fixture-window-02',
          window_number: 2,
        },
      }),
    );
  });

  it('parses only documented JSON argument strings and keeps content-free failures', () => {
    const validCarrier = ' {"cmd":"printf parsed"} ';
    const malformedCarrier = '{"cmd":"private malformed fragment"';
    const customCarrier = { patch: 'fixture patch' };
    const objectCarrier = { cmd: 'already decoded' };
    const records = [
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'valid-call',
            name: 'exec_command',
            arguments: validCarrier,
          },
        },
        0,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'malformed-call',
            name: 'exec_command',
            arguments: malformedCarrier,
          },
        },
        1,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'custom_tool_call',
            call_id: 'custom-call',
            name: 'fixture_custom',
            input: customCarrier,
          },
        },
        2,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'object-call',
            name: 'exec_command',
            arguments: objectCarrier,
          },
        },
        3,
      ),
    ];
    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });
    const calls = extracted.events.filter((event) => event.kind === 'call');

    expect(calls[0]).toMatchObject({
      arguments: { cmd: 'printf parsed' },
      originalArguments: validCarrier,
    });
    expect(calls[1]).not.toHaveProperty('arguments');
    expect(calls[1]).toHaveProperty('originalArguments', malformedCarrier);
    expect(calls[2]).toMatchObject({
      arguments: customCarrier,
      originalArguments: customCarrier,
    });
    expect(calls[3]).toMatchObject({
      arguments: objectCarrier,
      originalArguments: objectCarrier,
    });
    expect(extracted.diagnostics).toEqual([
      {
        code: 'ARGUMENT_PARSE_ERROR',
        locator: {
          recordIndex: 1,
          physicalLine: 2,
          jsonPointer: '/payload',
        },
        field: 'arguments',
      },
    ]);
    expect(JSON.stringify(extracted.diagnostics)).not.toContain(
      'private malformed fragment',
    );
    expect(JSON.stringify(extracted.diagnostics)).not.toContain('Unexpected');
  });

  it('keeps web search evidence standalone and warns at observed output caps', () => {
    const cappedOutput = 'x'.repeat(1_048_608);
    const records = [
      detailed(
        {
          type: 'event_msg',
          payload: {
            type: 'web_search_call',
            id: 'fixture-search-call',
            query: 'obscured query',
          },
        },
        0,
      ),
      detailed(
        {
          type: 'event_msg',
          ordinal: 7,
          payload: {
            type: 'item_completed',
            turn_id: 'fixture-turn',
            item: {
              type: 'CommandExecution',
              id: 'fixture-command',
              status: 'completed',
              exit_code: 0,
              aggregated_output: cappedOutput,
            },
          },
        },
        1,
      ),
    ];

    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });
    expect(extracted.events[0]).toMatchObject({
      kind: 'call',
      nativeType: 'web_search_call',
      nativeName: 'web_search',
      arguments: 'obscured query',
    });
    expect(extracted.events[1]).toMatchObject({
      kind: 'item',
      nativeType: 'CommandExecution',
      outcome: 'success',
    });
    expect(extracted.diagnostics).toEqual([
      {
        code: 'POSSIBLE_SOURCE_TRUNCATION',
        locator: {
          recordIndex: 1,
          physicalLine: 2,
          jsonPointer: '/payload/item/aggregated_output',
          ordinal: 7,
        },
        field: 'aggregated_output',
        bytes: 1_048_608,
      },
    ]);
    expect(extracted.coverage).toContainEqual({
      dataClass: 'items',
      status: 'truncated',
      captured: 1,
      locator: {
        recordIndex: 1,
        physicalLine: 2,
        jsonPointer: '/payload/item/aggregated_output',
        ordinal: 7,
      },
    });
  });

  it('extracts task lifecycle without retaining agent messages or error prose', () => {
    const records = [
      detailed(
        {
          type: 'event_msg',
          payload: {
            type: 'task_started',
            turn_id: 'fixture-turn',
            started_at: 10,
          },
        },
        0,
      ),
      detailed(
        {
          type: 'event_msg',
          payload: {
            type: 'task_complete',
            turn_id: 'fixture-turn',
            started_at: 10,
            completed_at: 20,
            duration_ms: 10,
            last_agent_message: 'private final message',
          },
        },
        1,
      ),
      detailed(
        {
          type: 'event_msg',
          payload: {
            type: 'task_complete',
            turn_id: 'fixture-error-turn',
            error: {
              codex_error_info: 'response_too_large',
              message: 'private engine message',
            },
          },
        },
        2,
      ),
      detailed(
        {
          type: 'event_msg',
          payload: { type: 'turn_aborted', turn_id: 'fixture-aborted-turn' },
        },
        3,
      ),
    ];

    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });
    expect(
      extracted.events.map((event) => [event.nativeType, event.outcome]),
    ).toEqual([
      ['task_started', 'pending'],
      ['task_complete', 'success'],
      ['task_complete', 'error'],
      ['turn_aborted', 'cancelled'],
    ]);
    expect(extracted.events[1].metadata).toEqual({
      started_at: 10,
      completed_at: 20,
      duration_ms: 10,
    });
    expect(extracted.events[2].metadata).toEqual({
      errorInfo: 'response_too_large',
    });
    expect(JSON.stringify(extracted)).not.toContain('private');
  });

  it('excludes reasoning and instruction bodies while retaining selected metadata', () => {
    const records = [
      detailed(
        {
          type: 'session_meta',
          payload: {
            cli_version: '0.154.0',
            model_provider: 'fixture-provider',
            base_instructions: 'private instruction body',
          },
        },
        0,
      ),
      detailed(
        {
          type: 'response_item',
          payload: {
            type: 'reasoning',
            encrypted_content: 'private encrypted body',
            summary: 'private reasoning summary',
          },
        },
        1,
      ),
      detailed(
        {
          type: 'event_msg',
          payload: {
            type: 'item_completed',
            item: { type: 'Reasoning', text: 'private reasoning item' },
          },
        },
        2,
      ),
    ];

    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: { ...TEST_SNAPSHOT, records, diagnostics: [] },
    });
    expect(extracted.events).toHaveLength(1);
    expect(extracted.events[0]).toMatchObject({
      kind: 'metadata',
      nativeType: 'session_meta',
      metadata: { cliVersion: '0.154.0', modelProvider: 'fixture-provider' },
    });
    expect(JSON.stringify(extracted)).not.toContain('private');
  });
});

describe('activity extraction failure boundaries', () => {
  it('degrades one throwing record without hiding surrounding activity', () => {
    const first = detailed(
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          call_id: 'fixture-call-1',
          name: 'exec_command',
          arguments: '{}',
        },
      },
      0,
    );
    const brokenRecord = new Proxy<JsonObject>(
      {},
      {
        get() {
          throw new Error('private engine detail');
        },
      },
    );
    const last = detailed(
      {
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          call_id: 'fixture-call-1',
          output: 'obscured output',
        },
      },
      2,
    );

    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [first, detailed(brokenRecord, 1), last],
        diagnostics: [],
      },
    });
    expect(extracted.events.map((event) => event.kind)).toEqual([
      'call',
      'result',
    ]);
    expect(extracted.diagnostics).toEqual([
      {
        code: 'ACTIVITY_EXTRACTION_ERROR',
        locator: { recordIndex: 1, physicalLine: 2, jsonPointer: '' },
      },
    ]);
    expect(extracted.coverage).toContainEqual({
      dataClass: 'record-activity',
      status: 'not-read',
      captured: 0,
      locator: { recordIndex: 1, physicalLine: 2, jsonPointer: '' },
    });
    expect(JSON.stringify(extracted)).not.toContain('private engine detail');
  });

  it('fails closed when exact source identity is absent', () => {
    expect(() =>
      extractActivity({
        source: { ...CODEX_SOURCE, nativeSessionId: '' },
        read: { ...TEST_SNAPSHOT, records: [], diagnostics: [] },
      }),
    ).toThrow('Activity extraction requires an exact selected source');
  });

  it('carries stable detailed-reader diagnostics without engine error text', () => {
    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: {
        ...TEST_SNAPSHOT,
        records: [],
        diagnostics: [
          { kind: 'malformed', physicalLine: 3 },
          { kind: 'not-object', physicalLine: 5 },
          { kind: 'partial-tail', physicalLine: 8 },
        ],
      },
    });

    expect(extracted.diagnostics).toEqual([
      {
        code: 'SOURCE_MALFORMED_RECORD',
        locator: { physicalLine: 3, jsonPointer: '' },
      },
      {
        code: 'SOURCE_NOT_OBJECT',
        locator: { physicalLine: 5, jsonPointer: '' },
      },
      {
        code: 'SOURCE_PARTIAL_TAIL',
        locator: { physicalLine: 8, jsonPointer: '' },
      },
    ]);
  });
});
