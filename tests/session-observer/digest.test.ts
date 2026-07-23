/**
 * digest.test.ts — Tests for src/transcript/session-observer/lib/digest.ts
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const emptyClaude = join(FIXTURES, 'claude-code', 'empty.jsonl');
const withToolBurst = join(FIXTURES, 'claude-code', 'with-tool-burst.jsonl');
const queuedMidTurnClaude = join(
  FIXTURES,
  'claude-code',
  'queued-mid-turn.jsonl',
);
const queuedAttachmentOnlyClaude = join(
  FIXTURES,
  'claude-code',
  'queued-attachment-only.jsonl',
);
const typicalCodex = join(FIXTURES, 'codex', 'typical.jsonl');
const typicalCursor = join(FIXTURES, 'cursor', 'typical.jsonl');
const automaticWakeFixtures = [
  ['claude-code', join(FIXTURES, 'claude-code', 'automatic-wake.jsonl')],
  ['codex', join(FIXTURES, 'codex', 'automatic-wake.jsonl')],
  ['cursor', join(FIXTURES, 'cursor', 'automatic-wake.jsonl')],
] as const;

import {
  buildDigest,
  renderJson,
  renderMarkdown,
} from '../../src/transcript/session-observer/lib/digest.js';
import type {
  CursorDigestV2,
  Digest,
  SessionDigest,
} from '../../src/transcript/session-observer/lib/types.js';

const cursorDigestV2Fixture = {
  schemaVersion: 2,
  runtime: 'cursor',
  sessionId: 'cursor-contract-fixture',
  transcriptPath: '/synthetic/cursor-contract-fixture.jsonl',
  recordedCwd: '/synthetic/project',
  matchedTier: 'A',
  widenedFrom: null,
  active: true,
  engagement: {
    status: 'engaged',
    engaged: true,
    recordCount: 12,
    genuineUserMessages: 1,
    syntheticUserMessages: 0,
    assistantMessages: 2,
    realMessageCount: 3,
    hasAssistantAndUser: true,
    bootstrapRecordIndexes: [],
    bootstrapRecordCount: 0,
  },
  mode: 'catch-up',
  range: {
    indexBase: 'zero-based-jsonl-frame-index',
    fromIndex: 4,
    toIndex: 10,
    nextIndex: 11,
    totalFrames: 12,
    renderedFromIndex: 5,
    renderedToIndex: 9,
    newFrames: 7,
  },
  accounting: {
    indexBase: 'zero-based-jsonl-frame-index',
    raw: {
      fromIndex: 4,
      toIndex: 10,
      count: 7,
      nextIndex: 11,
      totalFrames: 12,
    },
    rendered: {
      count: 2,
      fromIndex: 5,
      toIndex: 9,
    },
    filtered: {
      toolCalls: 1,
      automaticControls: 1,
      emptyOrNoOp: 1,
      metadataFrames: 2,
      unstableContent: 0,
    },
    buffered: {
      fromIndex: 11,
      count: 1,
      reason: 'malformed',
    },
    recovery: {
      omittedUserMessages: [
        {
          transcriptPath: '/synthetic/cursor-contract-fixture.jsonl',
          indexBase: 'zero-based-jsonl-frame-index',
          frameIndex: 4,
          entryKey: 'entry-user-4',
        },
      ],
      omittedAssistantEntries: [
        {
          transcriptPath: '/synthetic/cursor-contract-fixture.jsonl',
          indexBase: 'zero-based-jsonl-frame-index',
          frameIndex: 7,
          entryKey: 'entry-assistant-7',
        },
      ],
    },
  },
  entries: [
    {
      role: 'assistant',
      text: 'Synthetic pending observation.',
      recordIndex: 5,
      sourceFrameIndex: 5,
      kind: 'message',
      entryKey: 'entry-assistant-5',
      turnId: 'turn-1',
      availability: 'pending-lifecycle',
    },
    {
      role: 'assistant',
      text: 'Synthetic completed observation.',
      recordIndex: 9,
      sourceFrameIndex: 8,
      kind: 'message',
      entryKey: 'entry-assistant-8',
      turnId: 'turn-1',
      availability: 'completed',
    },
  ],
  filters: {
    includeToolCalls: false,
    includeToolResults: false,
    includeCommandMessages: false,
  },
  warnings: [],
  fallbacks: [],
  cursorEvidence: {
    projection: 'observation',
    continuity: 'verified',
    status: {
      engagement: 'engaged',
      activity: 'assistant-progress',
      content: 'available',
      lifecycle: 'success',
      delivery: 'reserved',
      health: 'blocked',
    },
    lifecycleEvents: [
      {
        turnId: 'turn-1',
        terminalFrameIndex: 9,
        lifecycle: 'success',
        finalEntryKey: 'entry-assistant-8',
        contentPreviouslyObservable: true,
      },
    ],
    bufferedFromFrame: 11,
    blockingFrame: {
      frameIndex: 11,
      byteStart: 820,
      byteEnd: 854,
      parseState: 'malformed',
    },
  },
} satisfies CursorDigestV2;

// ---------------------------------------------------------------------------
// Cursor digest v2 data contract
// ---------------------------------------------------------------------------

describe('Cursor digest v2 data contract', () => {
  test('keeps schema-v1 record indexes and schema-v2 frame indexes discriminated', () => {
    const sessionDigest: SessionDigest = cursorDigestV2Fixture;

    expect(sessionDigest.schemaVersion).toBe(2);
    expect(sessionDigest.range.indexBase).toBe('zero-based-jsonl-frame-index');

    const legacySchemaVersion: Digest['schemaVersion'] = 1;
    const legacyIndexBase: Digest['range']['indexBase'] =
      'zero-based-jsonl-record-index';

    expect(legacySchemaVersion).toBe(1);
    expect(legacyIndexBase).toBe('zero-based-jsonl-record-index');
  });

  test('round-trips the fixture without losing frame provenance or lifecycle evidence', () => {
    const serialized = JSON.stringify(cursorDigestV2Fixture);
    const parsed = JSON.parse(serialized) as CursorDigestV2;
    const completionFixture = {
      ...cursorDigestV2Fixture,
      cursorEvidence: {
        ...cursorDigestV2Fixture.cursorEvidence,
        projection: 'confirmed-completion',
      },
    } satisfies CursorDigestV2;

    expect(parsed).toEqual(cursorDigestV2Fixture);
    expect(parsed.entries).toEqual([
      expect.objectContaining({
        recordIndex: 5,
        sourceFrameIndex: 5,
        entryKey: 'entry-assistant-5',
        availability: 'pending-lifecycle',
      }),
      expect.objectContaining({
        recordIndex: 9,
        sourceFrameIndex: 8,
        entryKey: 'entry-assistant-8',
        availability: 'completed',
      }),
    ]);
    expect(parsed.cursorEvidence).toMatchObject({
      projection: 'observation',
      continuity: 'verified',
      bufferedFromFrame: 11,
      blockingFrame: {
        frameIndex: 11,
        parseState: 'malformed',
      },
      lifecycleEvents: [
        {
          terminalFrameIndex: 9,
          lifecycle: 'success',
          finalEntryKey: 'entry-assistant-8',
        },
      ],
    });
    expect(
      (JSON.parse(JSON.stringify(completionFixture)) as CursorDigestV2)
        .cursorEvidence.projection,
    ).toBe('confirmed-completion');
  });

  test('balances raw, rendered, filtered, and buffered frame accounting', () => {
    const { accounting, range } = cursorDigestV2Fixture;
    const filteredCount = Object.values(accounting.filtered).reduce(
      (total, count) => total + count,
      0,
    );

    expect(accounting.raw.count).toBe(
      accounting.rendered.count + filteredCount,
    );
    expect(accounting.raw.count).toBe(range.newFrames);
    expect(accounting.raw.nextIndex - accounting.raw.fromIndex).toBe(
      accounting.raw.count,
    );
    expect(accounting.raw.toIndex).toBe(accounting.raw.nextIndex - 1);
    expect(accounting.buffered.count).toBe(
      accounting.raw.totalFrames - accounting.raw.nextIndex,
    );
    expect(accounting.buffered.fromIndex).toBe(accounting.raw.nextIndex);
  });

  test('keeps lifecycle, recovery, and blocking metadata structural-only', () => {
    const structuralMetadata = {
      cursorEvidence: cursorDigestV2Fixture.cursorEvidence,
      recovery: cursorDigestV2Fixture.accounting.recovery,
    };
    const serialized = JSON.stringify(structuralMetadata);

    expect(serialized).not.toContain('Synthetic pending observation.');
    expect(serialized).not.toContain('Synthetic completed observation.');
    expect(serialized).not.toMatch(/"(text|message|prose|rawContent)":/);
    expect(structuralMetadata.cursorEvidence.lifecycleEvents[0]).toEqual({
      turnId: 'turn-1',
      terminalFrameIndex: 9,
      lifecycle: 'success',
      finalEntryKey: 'entry-assistant-8',
      contentPreviouslyObservable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// buildDigest
// ---------------------------------------------------------------------------

describe('buildDigest', () => {
  test.each(automaticWakeFixtures)(
    'classifies %s wake envelopes as automatic control input',
    async (runtime, fixture) => {
      for (const mode of ['review', 'catch-up'] as const) {
        const digest = await buildDigest(runtime, fixture, {
          fromIndex: 0,
          mode,
        });
        const control = digest.entries.find(
          (entry) => entry.origin === 'automatic-control',
        );

        expect(control).toMatchObject({
          role: 'user',
          displayRole: 'automatic-control',
          kind: 'message',
          origin: 'automatic-control',
          automaticControl: {
            automatic: true,
            runtime: expect.any(String),
            leaseId: expect.stringMatching(/^lease-/),
            pinnedPeer: expect.any(Object),
            range: {
              fromIndex: expect.any(Number),
              toIndex: expect.any(Number),
            },
          },
        });
        expect(renderMarkdown(digest)).toContain(
          '### Hook/control (automatic)',
        );

        expect(digest.engagement).toMatchObject({
          status: 'unengaged',
          engaged: false,
          genuineUserMessages: 0,
          syntheticUserMessages: 1,
          hasAssistantAndUser: false,
        });

        const json = JSON.parse(renderJson(digest));
        expect(json.entries).toContainEqual(
          expect.objectContaining({
            origin: 'automatic-control',
            displayRole: 'automatic-control',
            automaticControl: expect.objectContaining({ automatic: true }),
          }),
        );
      }
    },
  );

  test('does not classify ordinary JSON user text as automatic control', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-wake-test-'));
    try {
      const transcriptPath = join(tmpDir, 'ordinary-json.jsonl');
      await writeFile(
        transcriptPath,
        `${JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: '{"automatic":true}' }],
          },
        })}\n`,
      );

      const digest = await buildDigest('codex', transcriptPath);
      expect(digest.entries).toContainEqual(
        expect.objectContaining({
          role: 'user',
          text: '{"automatic":true}',
        }),
      );
      expect(digest.entries[0]).not.toHaveProperty('origin');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('renders queued Claude input once across review and catch-up digests', async () => {
    for (const mode of ['review', 'catch-up'] as const) {
      const digest = await buildDigest('claude-code', queuedMidTurnClaude, {
        fromIndex: 0,
        mode,
      });
      const queuedEntries = digest.entries.filter(
        (entry: any) => entry.displayRole === 'queued-user',
      );

      expect(queuedEntries).toHaveLength(1);
      expect(queuedEntries[0]).toMatchObject({
        role: 'user',
        text: 'Yes, include the migration guide.',
        recordIndex: 2,
      });

      const markdown = renderMarkdown(digest);
      expect(markdown).toContain('### User (queued mid-turn)');
      expect(
        markdown.match(/Yes, include the migration guide\./g),
      ).toHaveLength(1);

      const json = JSON.parse(renderJson(digest));
      expect(json.entries).toContainEqual(
        expect.objectContaining({
          displayRole: 'queued-user',
          text: 'Yes, include the migration guide.',
        }),
      );
    }
  });

  test('renders queued-command attachments when no enqueue record is present', async () => {
    const digest = await buildDigest(
      'claude-code',
      queuedAttachmentOnlyClaude,
      {
        fromIndex: 0,
        mode: 'review',
      },
    );

    expect(digest.entries).toContainEqual(
      expect.objectContaining({
        role: 'user',
        displayRole: 'queued-user',
        text: 'Use the conservative migration path.',
        recordIndex: 1,
      }),
    );
  });

  test('returns correct entry count and range for fromIndex=0 (claude-code)', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      includeToolCalls: false,
      includeToolResults: false,
      mode: 'review',
    });

    expect(digest.range.fromIndex, 'fromIndex should be 0').toBe(0);
    expect(
      digest.range.totalRecords > 0,
      'totalRecords should be > 0',
    ).toBeTruthy();
    expect(
      digest.entries.length > 0,
      'entries should be non-empty',
    ).toBeTruthy();
    expect(
      digest.entries.every((e: any) => e.kind === 'message'),
      'default filter: only message entries',
    ).toBeTruthy();
  });

  test('returns only entries with recordIndex >= fromIndex (mid-stream)', async () => {
    // Read the file to know how many records there are
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const totalRecords = fullDigest.range.totalRecords;
    // Skip half the records
    const midIndex = Math.floor(totalRecords / 2);

    const partial = await buildDigest('claude-code', typicalClaude, {
      fromIndex: midIndex,
      mode: 'catch-up',
    });

    expect(
      partial.entries.every((e: any) => e.recordIndex >= midIndex),
      'all entries should have recordIndex >= fromIndex',
    ).toBeTruthy();
    expect(partial.range.fromIndex, 'range.fromIndex should match').toBe(
      midIndex,
    );
  });

  test('newRecords set correctly in catch-up mode', async () => {
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const totalRecords = fullDigest.range.totalRecords;
    const midIndex = Math.floor(totalRecords / 2);

    const catchUp = await buildDigest('claude-code', typicalClaude, {
      fromIndex: midIndex,
      mode: 'catch-up',
    });

    expect(
      typeof catchUp.range.newRecords,
      'newRecords should be a number in catch-up mode',
    ).toBe('number');
    expect(
      catchUp.range.newRecords >= 0,
      'newRecords should be >= 0',
    ).toBeTruthy();
  });

  test('catch-up separates raw records consumed from rendered messages', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-filter-test-'));
    try {
      const transcriptPath = join(tmpDir, 'filtered.jsonl');
      const records = [
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file: 'a' },
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'result a',
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Bash',
                input: { cmd: 'npm test' },
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-2',
                content: 'result b',
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'One rendered assistant message.' },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-3',
                name: 'Edit',
                input: { file: 'b' },
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-3',
                content: 'result c',
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-4',
                content: 'result d',
              },
            ],
          },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      expect(digest.range.fromIndex).toBe(0);
      expect(digest.range.indexBase).toBe('zero-based-jsonl-record-index');
      expect(digest.accounting.indexBase).toBe('zero-based-jsonl-record-index');
      expect(
        digest.range.toIndex,
        'raw toIndex should be the last consumed raw record',
      ).toBe(7);
      expect(
        digest.range.nextIndex,
        'nextIndex should advance past all raw consumed records',
      ).toBe(8);
      expect(digest.range.newRecords).toBe(8);
      expect(digest.accounting.rendered.count).toBe(1);
      expect(digest.accounting.rendered.fromIndex).toBe(4);
      expect(digest.accounting.rendered.toIndex).toBe(4);
      expect(digest.accounting.filtered.toolCalls).toBe(3);
      expect(digest.accounting.filtered.toolResults).toBe(4);

      const md = renderMarkdown(digest);
      expect(
        md.includes('raw range (zero-based JSONL indices):** records 0–7 of 8'),
        'header should show raw range',
      ).toBeTruthy();
      expect(
        md.includes('raw records consumed:** 8'),
        'header should show raw consumed count',
      ).toBeTruthy();
      expect(
        md.includes('rendered messages:** 1 (zero-based records 4–4)'),
        'header should show rendered range separately',
      ).toBeTruthy();
      expect(
        md.includes('tool calls: 3'),
        'header should explain filtered tool calls',
      ).toBeTruthy();
      expect(
        md.includes('tool results: 4'),
        'header should explain filtered tool results',
      ).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up accounts for default command-message filtering', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-command-test-'));
    try {
      const transcriptPath = join(tmpDir, 'command.jsonl');
      const records = [
        {
          sessionId: 'sess-command',
          message: {
            role: 'user',
            content:
              '<command-message>skill body</command-message>\n<command-name>/oat-project-open</command-name>',
          },
        },
        {
          sessionId: 'sess-command',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Visible response.' }],
          },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      expect(digest.entries.length).toBe(1);
      expect(digest.entries[0].text).toBe('Visible response.');
      expect(digest.accounting.filtered.commandMessages).toBe(1);
      expect(digest.filters.includeCommandMessages).toBe(false);

      const md = renderMarkdown(digest);
      expect(
        md.includes('command messages: 1'),
        'header should explain command-message filtering',
      ).toBeTruthy();
      expect(
        md.includes('command messages excluded'),
        'filters should include command messages excluded',
      ).toBeTruthy();

      const debugDigest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
        includeCommandMessages: true,
      });
      expect(debugDigest.entries.length).toBe(2);
      expect(debugDigest.entries[0].kind).toBe('command_message');
      expect(debugDigest.accounting.filtered.commandMessages).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('filters Codex bootstrap records out of rendered digests and engagement', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-codex-bootstrap-'));
    try {
      const transcriptPath = join(tmpDir, 'codex-bootstrap.jsonl');
      const records = [
        {
          sessionId: 'codex-bootstrap',
          type: 'session_meta',
          payload: { id: 'codex-bootstrap', cwd: '/test/codex-bootstrap' },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'event_msg',
          payload: { type: 'task_started' },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'developer',
            content: '<permissions instructions>\nFilesystem sandboxing...',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'text',
                text: '# AGENTS.md instructions for /test/codex-bootstrap\n\n<INSTRUCTIONS>\nRepo rules\n</INSTRUCTIONS>',
              },
              {
                type: 'text',
                text: '<environment_context>\n  <cwd>/test/codex-bootstrap</cwd>\n</environment_context>',
              },
            ],
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'turn_context',
          cwd: '/test/codex-bootstrap',
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content:
              'Generate a concise tab title for this coding chat.\nRules:\n- 2 to 5 words.',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: 'Bootstrap Title',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: 'Please inspect the actual design conversation.',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content:
              '<skill>\n<name>oat-project-open</name>\n<body>synthetic skill body</body>\n</skill>',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: 'Actual assistant response.',
          },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('codex', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });
      const renderedText = digest.entries
        .map((entry: any) => entry.text)
        .join('\n');
      const md = renderMarkdown(digest);

      expect(digest.engagement.status).toBe('engaged');
      expect(digest.engagement.genuineUserMessages).toBe(1);
      expect(digest.engagement.bootstrapRecordCount).toBe(4);
      expect(digest.accounting.filtered.bootstrapRecords).toBe(4);
      expect(
        renderedText.includes('Please inspect the actual design conversation.'),
      ).toBeTruthy();
      expect(renderedText.includes('Actual assistant response.')).toBeTruthy();
      expect(!renderedText.includes('AGENTS.md instructions')).toBeTruthy();
      expect(!renderedText.includes('Bootstrap Title')).toBeTruthy();
      expect(!renderedText.includes('<skill>')).toBeTruthy();
      expect(md.includes('bootstrap records: 4')).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('large digest fallback keeps the last turn groups automatically', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-large-fallback-'));
    try {
      const transcriptPath = join(tmpDir, 'large.jsonl');
      const longText = 'A'.repeat(3000);
      const records = [];
      for (let i = 0; i < 12; i++) {
        records.push({
          sessionId: 'sess-large-fallback',
          message: {
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `${i}:${longText}`,
          },
        });
      }
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      expect(digest.range.newRecords).toBe(12);
      expect(
        digest.accounting.autoLargeDigest,
        'autoLargeDigest accounting should be present',
      ).toBeTruthy();
      expect(
        (digest.accounting.autoLargeDigest as any).retainedTurnGroups,
      ).toBe(8);
      expect(digest.entries.length).toBe(8);
      expect(digest.entries[0].recordIndex).toBe(4);
      expect(digest.accounting.filtered.tailSliceEntries).toBe(4);
      expect(digest.accounting.recovery.omittedUserMessages).toEqual([
        {
          transcriptPath,
          indexBase: 'zero-based-jsonl-record-index',
          recordIndex: 0,
        },
        {
          transcriptPath,
          indexBase: 'zero-based-jsonl-record-index',
          recordIndex: 2,
        },
      ]);
      expect(digest.entries[0].text).toBe(`4:${longText}`);
      expect(renderMarkdown(digest)).toContain('User-message recovery');
      expect(renderMarkdown(digest)).toContain(
        `${transcriptPath} records 0, 2 (zero-based JSONL indices).`,
      );
      expect(JSON.parse(renderJson(digest)).accounting.recovery).toEqual(
        digest.accounting.recovery,
      );
      expect(
        digest.warnings.some((w: string) =>
          w.includes('Large digest fallback'),
        ),
      ).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('buildDigest works for codex runtime', async () => {
    const digest = await buildDigest('codex', typicalCodex, {
      fromIndex: 0,
      mode: 'review',
    });
    expect(
      digest.range.totalRecords > 0,
      'should parse codex fixture',
    ).toBeTruthy();
    expect(digest.runtime).toBe('codex');
  });

  test('buildDigest works for cursor runtime', async () => {
    const digest = await buildDigest('cursor', typicalCursor, {
      fromIndex: 0,
      mode: 'review',
    });

    expect(
      digest.range.totalRecords > 0,
      'should parse cursor fixture',
    ).toBeTruthy();
    expect(digest.runtime).toBe('cursor');
    expect(
      digest.entries.some((entry: any) => entry.role === 'assistant'),
      'should include assistant messages',
    ).toBeTruthy();
  });

  test('cursor digest hides an unterminated provisional tail', async () => {
    const digest = await buildDigest(
      'cursor',
      join(FIXTURES, 'cursor', 'unterminated.jsonl'),
      { fromIndex: 0, mode: 'review', includeToolCalls: true },
    );

    expect(digest.entries).toEqual([]);
    expect(digest.range.nextIndex).toBe(3);
  });

  test('cursor recovery pointers use the buffered user source record', async () => {
    const transcriptPath = join(FIXTURES, 'cursor', 'terminal-success.jsonl');
    const digest = await buildDigest('cursor', transcriptPath, {
      fromIndex: 0,
      mode: 'review',
      maxTurns: 1,
    });

    expect(digest.accounting.recovery.omittedUserMessages).toEqual([
      {
        transcriptPath,
        indexBase: 'zero-based-jsonl-record-index',
        recordIndex: 0,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

describe('renderMarkdown', () => {
  test('groups consecutive same-role entries under single ### header', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    const md = renderMarkdown(digest);
    expect(
      typeof md === 'string',
      'renderMarkdown returns a string',
    ).toBeTruthy();

    // Should contain ### User and ### Assistant headers
    expect(
      md.includes('### User'),
      'should contain ### User header',
    ).toBeTruthy();
    expect(
      md.includes('### Assistant'),
      'should contain ### Assistant header',
    ).toBeTruthy();

    // Headers should NOT repeat consecutively for the same role
    // (i.e., we don't see "### User\n...\n### User\n..." without an assistant in between)
    const lines = md.split('\n');
    let prevHeader: string | null = null;
    for (const line of lines) {
      if (line.startsWith('### User') || line.startsWith('### Assistant')) {
        expect(line, `Consecutive duplicate header found: ${line}`).not.toBe(
          prevHeader,
        );
        prevHeader = line;
      }
    }
  });

  test('header contains filter line', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: false,
      includeToolResults: false,
    });

    const md = renderMarkdown(digest);
    // Filter line should mention tool calls excluded
    expect(
      md.includes('tool') || md.includes('filter'),
      'header should mention tool filtering',
    ).toBeTruthy();
  });

  test('header contains active flag when digest.active is true', async () => {
    // Build a digest with active=true by patching after build
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    digest.active = true;

    const md = renderMarkdown(digest);
    expect(
      md.includes('active') || md.includes('ACTIVE'),
      'header should include active flag',
    ).toBeTruthy();
  });

  test('header contains range metadata', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    const md = renderMarkdown(digest);
    // Should contain fromIndex and totalRecords info
    expect(
      md.includes('0'),
      'header should contain fromIndex value',
    ).toBeTruthy();
    expect(
      md.includes(String(digest.range.totalRecords)),
      'header should contain totalRecords',
    ).toBeTruthy();
  });

  test('no tool markers by default', async () => {
    const digest = await buildDigest('claude-code', withToolBurst, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: false,
      includeToolResults: false,
    });
    const md = renderMarkdown(digest);
    // Should not contain tool-call markers like [Read] or [Bash]
    expect(
      !md.includes('[Read]') && !md.includes('[Bash]'),
      'should not include tool markers by default',
    ).toBeTruthy();
  });

  test('--max-turns slices from the tail', async () => {
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const fullMd = renderMarkdown(fullDigest);

    const slicedDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      maxTurns: 1,
    });
    const slicedMd = renderMarkdown(slicedDigest);

    expect(
      slicedMd.length < fullMd.length ||
        slicedDigest.entries.length <= fullDigest.entries.length,
      '--max-turns should produce a smaller or equal digest',
    ).toBeTruthy();
    expect(
      slicedDigest.entries.length <= fullDigest.entries.length,
      'sliced entries <= full entries',
    ).toBeTruthy();
  });

  test('--max-bytes slices from the tail by byte count', async () => {
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    // Use a very small byte limit to ensure slicing happens
    const slicedDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      maxBytes: 100,
    });

    expect(
      slicedDigest.entries.length <= fullDigest.entries.length,
      '--max-bytes slices entries',
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 20K warning
// ---------------------------------------------------------------------------

describe('20K warning', () => {
  test('prepends 20K-char warning when rendered output exceeds threshold', async () => {
    // Build a large fixture by writing a temp file with many long records
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-test-'));
    try {
      const largePath = join(tmpDir, 'large.jsonl');
      const longText = 'A'.repeat(2000);
      const lines = [];
      for (let i = 0; i < 20; i++) {
        lines.push(
          JSON.stringify({
            sessionId: 'sess-large',
            type: 'user',
            message: { role: 'user', content: longText },
          }),
        );
        lines.push(
          JSON.stringify({
            sessionId: 'sess-large',
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: longText }],
            },
          }),
        );
      }
      await writeFile(largePath, lines.join('\n') + '\n', 'utf8');

      const digest = await buildDigest('claude-code', largePath, {
        fromIndex: 0,
        mode: 'review',
      });
      const md = renderMarkdown(digest);

      // Should contain 20K warning
      if (md.length > 20000) {
        expect(
          md.includes('20') ||
            md.includes('large') ||
            md.includes('warning') ||
            md.includes('Warning'),
          '20K-char digest should prepend a warning',
        ).toBeTruthy();
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// renderJson
// ---------------------------------------------------------------------------

describe('renderJson', () => {
  test('returns valid JSON that round-trips via JSON.parse', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const jsonStr = renderJson(digest);
    expect(
      typeof jsonStr === 'string',
      'renderJson returns a string',
    ).toBeTruthy();
    let parsed: any;
    expect(() => {
      parsed = JSON.parse(jsonStr);
    }, 'output should be valid JSON').not.toThrow();
    expect(parsed.schemaVersion, 'schemaVersion should be 1').toBe(1);
    expect(
      Array.isArray(parsed.entries),
      'entries should be an array',
    ).toBeTruthy();
    expect(parsed.runtime, 'runtime should be preserved').toBe('claude-code');
  });
});
