import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCursorTurnAccumulator,
  type CursorTranscriptAnalysis,
} from '../../src/transcript/core/cursor-analysis.js';
import { scanCursorTranscript } from '../../src/transcript/core/cursor-frames.js';
import type {
  CursorIdentityEvidence,
  JsonObject,
} from '../../src/transcript/core/runtimes.js';

const fixtureDirectory = new URL(
  '../session-observer/fixtures/cursor/',
  import.meta.url,
);
const identity: CursorIdentityEvidence = {
  runtime: 'cursor',
  projectCwd: '/synthetic/project',
  sessionId: 'synthetic-session',
  canonicalTranscriptPath: '/synthetic/project/transcript.jsonl',
};
const temporaryDirectories: string[] = [];

async function analyzePath(
  transcriptPath: string,
  analyzerIdentity = identity,
  fromFrameIndex = 0,
): Promise<CursorTranscriptAnalysis> {
  const accumulator = createCursorTurnAccumulator(
    analyzerIdentity,
    fromFrameIndex,
  );
  const scan = await scanCursorTranscript(transcriptPath, {
    onFrame: accumulator.onFrame,
  });
  return accumulator.finish(scan);
}

async function analyzeRecords(
  records: JsonObject[],
  analyzerIdentity = identity,
  fromFrameIndex = 0,
): Promise<CursorTranscriptAnalysis> {
  const directory = await mkdtemp(join(tmpdir(), 'cursor-analysis-'));
  temporaryDirectories.push(directory);
  const transcriptPath = join(directory, 'transcript.jsonl');
  await writeFile(
    transcriptPath,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8',
  );
  return analyzePath(transcriptPath, analyzerIdentity, fromFrameIndex);
}

function user(text: string): JsonObject {
  return {
    role: 'user',
    message: { content: [{ type: 'text', text }] },
  };
}

function assistant(content: unknown): JsonObject {
  return { role: 'assistant', message: { content } };
}

function terminal(status: string): JsonObject {
  return { type: 'turn_ended', status };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('createCursorTurnAccumulator', () => {
  it('builds structural turn ranges and terminal-success candidates', async () => {
    const analysis = await analyzePath(
      new URL('framed-closed.jsonl', fixtureDirectory).pathname,
    );

    expect(analysis).toEqual({
      turns: [
        {
          turnId: expect.any(String),
          fromFrameIndex: 0,
          observedThroughFrame: 2,
          assistantRecords: [
            {
              entryKey: expect.any(String),
              turnId: expect.any(String),
              sourceFrameIndex: 1,
              blockIndex: 0,
              role: 'assistant',
              text: 'Synthetic response beta.',
              classification: 'substantive',
            },
          ],
          humanRecordIndexes: [0],
          toolRecordIndexes: [],
          lifecycle: 'success',
          terminalFrameIndex: 2,
          finalSubstantiveEntryKey: expect.any(String),
        },
      ],
      metadataFrameIndexes: [],
      blockingFrame: null,
    });
    expect(analysis.turns[0].finalSubstantiveEntryKey).toBe(
      analysis.turns[0].assistantRecords[0].entryKey,
    );
  });

  it('keeps multiple assistant blocks and tool indexes in source order', async () => {
    const analysis = await analyzeRecords([
      user('Synthetic multi-block request.'),
      assistant([
        { type: 'text', text: 'Synthetic first block.' },
        { type: 'tool_use', name: 'read_file', input: { path: 'x.ts' } },
        { type: 'text', text: 'Synthetic final block.' },
      ]),
      terminal('success'),
    ]);
    const turn = analysis.turns[0];

    expect(
      turn.assistantRecords.map(
        ({ sourceFrameIndex, blockIndex, text, classification }) => ({
          sourceFrameIndex,
          blockIndex,
          text,
          classification,
        }),
      ),
    ).toEqual([
      {
        sourceFrameIndex: 1,
        blockIndex: 0,
        text: 'Synthetic first block.',
        classification: 'substantive',
      },
      {
        sourceFrameIndex: 1,
        blockIndex: 2,
        text: 'Synthetic final block.',
        classification: 'substantive',
      },
    ]);
    expect(turn.toolRecordIndexes).toEqual([1]);
    expect(turn.finalSubstantiveEntryKey).toBe(
      turn.assistantRecords[1].entryKey,
    );
  });

  it('scopes stable turn and entry keys to exact identity evidence', async () => {
    const records = [
      user('Synthetic identity request.'),
      assistant([{ type: 'text', text: 'Synthetic identity response.' }]),
      terminal('success'),
    ];
    const first = await analyzeRecords(records);
    const repeat = await analyzeRecords(records);
    const otherIdentity = await analyzeRecords(records, {
      ...identity,
      canonicalTranscriptPath: '/synthetic/project/replaced.jsonl',
    });

    expect(repeat.turns[0].turnId).toBe(first.turns[0].turnId);
    expect(repeat.turns[0].assistantRecords[0].entryKey).toBe(
      first.turns[0].assistantRecords[0].entryKey,
    );
    expect(otherIdentity.turns[0].turnId).not.toBe(first.turns[0].turnId);
    expect(otherIdentity.turns[0].assistantRecords[0].entryKey).not.toBe(
      first.turns[0].assistantRecords[0].entryKey,
    );
  });

  it('separates automatic controls, acknowledgements, no-op text, and human input', async () => {
    const automaticEnvelope =
      '<session_observer_wake automatic="true" schema_version="2" runtime="cursor" lease_id="synthetic-lease" peer="cursor:synthetic-peer" records="1-2">Review.</session_observer_wake>';
    const analysis = await analyzeRecords([
      user(automaticEnvelope),
      assistant([{ type: 'text', text: 'Acknowledged.' }]),
      terminal('success'),
      user('Synthetic human request.'),
      assistant([{ type: 'text', text: '[no-op] no substantive delta' }]),
      terminal('success'),
    ]);

    expect(analysis.turns).toHaveLength(2);
    expect(analysis.turns[0]).toMatchObject({
      humanRecordIndexes: [],
      lifecycle: 'success',
      finalSubstantiveEntryKey: null,
    });
    expect(analysis.turns[0].assistantRecords[0].classification).toBe(
      'automatic-control',
    );
    expect(analysis.turns[1]).toMatchObject({
      humanRecordIndexes: [3],
      lifecycle: 'success',
      finalSubstantiveEntryKey: null,
    });
    expect(analysis.turns[1].assistantRecords[0].classification).toBe('no-op');
  });

  it('retains human activity from a mixed automatic-control user record', async () => {
    const automaticEnvelope =
      '<session_observer_wake automatic="true" schema_version="2" runtime="cursor" lease_id="synthetic-lease" peer="cursor:synthetic-peer" records="1-2">Review.</session_observer_wake>';
    const analysis = await analyzeRecords([
      {
        role: 'user',
        message: {
          content: [
            { type: 'text', text: automaticEnvelope },
            { type: 'text', text: 'Synthetic human instruction.' },
          ],
        },
      },
      assistant([{ type: 'text', text: 'Acknowledged.' }]),
      terminal('success'),
    ]);

    expect(analysis.turns[0].humanRecordIndexes).toEqual([0]);
    expect(analysis.turns[0].assistantRecords[0].classification).toBe(
      'substantive',
    );
    expect(analysis.turns[0].finalSubstantiveEntryKey).toBe(
      analysis.turns[0].assistantRecords[0].entryKey,
    );
  });

  it('gives later human input precedence over automatic acknowledgement suppression', async () => {
    const automaticEnvelope =
      '<session_observer_wake automatic="true" schema_version="2" runtime="cursor" lease_id="synthetic-lease" peer="cursor:synthetic-peer" records="1-2">Review.</session_observer_wake>';
    const analysis = await analyzeRecords([
      user(automaticEnvelope),
      user('Synthetic later human instruction.'),
      assistant([{ type: 'text', text: 'Acknowledged.' }]),
      terminal('success'),
    ]);

    expect(analysis.turns[0].humanRecordIndexes).toEqual([1]);
    expect(analysis.turns[0].assistantRecords[0].classification).toBe(
      'substantive',
    );
    expect(analysis.turns[0].finalSubstantiveEntryKey).toBe(
      analysis.turns[0].assistantRecords[0].entryKey,
    );
  });

  it('classifies empty, runtime diagnostic, and unsupported assistant blocks', async () => {
    const analysis = await analyzeRecords([
      user('Synthetic classification request.'),
      assistant([
        { type: 'text', text: '   ' },
        { type: 'runtime_diagnostic', text: 'Synthetic runtime diagnostic.' },
        { type: 'image', text: 'Synthetic unsupported block.' },
      ]),
      terminal('success'),
    ]);

    expect(
      analysis.turns[0].assistantRecords.map(
        ({ blockIndex, classification }) => ({
          blockIndex,
          classification,
        }),
      ),
    ).toEqual([
      { blockIndex: 0, classification: 'empty' },
      { blockIndex: 1, classification: 'runtime-diagnostic' },
      { blockIndex: 2, classification: 'unsupported' },
    ]);
    expect(analysis.turns[0].finalSubstantiveEntryKey).toBeNull();
  });

  it.each([
    ['success', 'success'],
    ['aborted', 'aborted'],
    ['error', 'error'],
    ['cancelled', 'cancelled'],
    ['provider-specific', 'unknown'],
  ] as const)(
    'maps terminal status %s to lifecycle %s',
    async (status, lifecycle) => {
      const analysis = await analyzeRecords([
        user('Synthetic lifecycle request.'),
        assistant([{ type: 'text', text: 'Synthetic lifecycle response.' }]),
        terminal(status),
      ]);

      expect(analysis.turns[0].lifecycle).toBe(lifecycle);
      expect(analysis.turns[0].terminalFrameIndex).toBe(2);
      expect(analysis.turns[0].finalSubstantiveEntryKey === null).toBe(
        lifecycle !== 'success',
      );
    },
  );

  it('returns pending open turns without claiming lifecycle completion', async () => {
    const analysis = await analyzeRecords([
      user('Synthetic pending request.'),
      assistant([
        { type: 'text', text: 'Synthetic pending response candidate.' },
      ]),
    ]);

    expect(analysis.turns[0]).toMatchObject({
      fromFrameIndex: 0,
      observedThroughFrame: 1,
      lifecycle: 'pending',
      terminalFrameIndex: null,
      finalSubstantiveEntryKey: null,
    });
  });

  it('honors an explicit structural range start', async () => {
    const analysis = await analyzeRecords(
      [
        user('Synthetic prior request.'),
        assistant([{ type: 'text', text: 'Synthetic prior response.' }]),
        terminal('success'),
        user('Synthetic current request.'),
        assistant([{ type: 'text', text: 'Synthetic current response.' }]),
        terminal('success'),
      ],
      identity,
      3,
    );

    expect(analysis.turns).toHaveLength(1);
    expect(analysis.turns[0]).toMatchObject({
      fromFrameIndex: 3,
      observedThroughFrame: 5,
      humanRecordIndexes: [3],
      terminalFrameIndex: 5,
    });
  });

  it('stops analysis at a blocking frame and retains its recovery pointer', async () => {
    const analysis = await analyzePath(
      new URL('framed-malformed-middle.jsonl', fixtureDirectory).pathname,
    );

    expect(analysis.turns).toHaveLength(1);
    expect(analysis.turns[0]).toMatchObject({
      fromFrameIndex: 0,
      observedThroughFrame: 0,
      lifecycle: 'pending',
      assistantRecords: [],
      humanRecordIndexes: [0],
    });
    expect(analysis.blockingFrame).toMatchObject({
      frameIndex: 1,
      parseState: 'malformed',
    });
  });

  it('tracks parsed metadata outside provider turn records', async () => {
    const analysis = await analyzeRecords([
      { type: 'metadata', version: 1 },
      user('Synthetic metadata request.'),
      assistant([{ type: 'text', text: 'Synthetic metadata response.' }]),
      terminal('success'),
    ]);

    expect(analysis.metadataFrameIndexes).toEqual([0]);
    expect(analysis.turns[0].fromFrameIndex).toBe(0);
  });

  it('rejects incomplete exact identity evidence', () => {
    expect(() =>
      createCursorTurnAccumulator(
        { ...identity, canonicalTranscriptPath: '' },
        0,
      ),
    ).toThrow(/canonicalTranscriptPath/u);
    expect(() => createCursorTurnAccumulator(identity, -1)).toThrow(
      /fromFrameIndex/u,
    );
  });
});
