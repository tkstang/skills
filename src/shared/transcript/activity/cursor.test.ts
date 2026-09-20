import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCursorTurnAccumulator,
  type CursorTranscriptAnalysis,
} from '../cursor-analysis.js';
import {
  scanCursorTranscript,
  type CursorTranscriptScan,
} from '../cursor-frames.js';
import type { CursorIdentityEvidence } from '../runtimes.js';
import {
  extractCursorActivity,
  type CursorActivityExtractionMode,
  type ExtractedCursorActivity,
} from './cursor.js';
import type { ActivitySource } from './types.js';

const CAPTURED_FIXTURE = new URL(
  '../fixtures/session-fidelity/cursor/captured-activity.jsonl',
  import.meta.url,
).pathname;
const OBSERVER_FIXTURES = new URL(
  '../../../skills/session-observer/src/fixtures/cursor/',
  import.meta.url,
);
const CAPTURED_AT = '2026-09-19T12:00:00.000Z';
const temporaryDirectories: string[] = [];

interface CursorSnapshot {
  scan: CursorTranscriptScan;
  analysis: CursorTranscriptAnalysis;
}

async function snapshot(
  transcriptPath: string,
  canonicalTranscriptPath = transcriptPath,
): Promise<CursorSnapshot> {
  const identity: CursorIdentityEvidence = {
    runtime: 'cursor',
    projectCwd: '/fixture/project',
    sessionId: 'fixture-cursor-session',
    canonicalTranscriptPath,
  };
  const accumulator = createCursorTurnAccumulator(identity, 0);
  const scan = await scanCursorTranscript(transcriptPath, {
    onFrame: accumulator.onFrame,
  });
  return { scan, analysis: accumulator.finish(scan) };
}

function source(
  transcriptPath: string,
): ActivitySource & { runtime: 'cursor' } {
  return {
    runtime: 'cursor',
    sessionId: 'fixture-cursor-session',
    nativeSessionId: 'fixture-cursor-session',
    transcriptPath,
  };
}

async function extract(
  transcriptPath: string,
  mode: CursorActivityExtractionMode,
  canonicalTranscriptPath = transcriptPath,
): Promise<ExtractedCursorActivity> {
  const captured = await snapshot(transcriptPath, canonicalTranscriptPath);
  return extractCursorActivity({
    source: source(canonicalTranscriptPath),
    ...captured,
    capturedAt: CAPTURED_AT,
    mode,
  });
}

async function temporaryTranscript(content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'cursor-activity-'));
  temporaryDirectories.push(directory);
  const transcriptPath = join(directory, 'transcript.jsonl');
  await writeFile(transcriptPath, content, 'utf8');
  return transcriptPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('extractCursorActivity', () => {
  it('infers skill loads from direct read tools without parsing shell commands', async () => {
    const transcriptPath = await temporaryTranscript(
      [
        JSON.stringify({
          role: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'ReadFile',
                input: { path: '/fixture/skills/one/SKILL.md' },
              },
              {
                type: 'tool_use',
                name: 'Shell',
                input: { command: 'cat /fixture/skills/two/SKILL.md' },
              },
            ],
          },
        }),
        JSON.stringify({ type: 'turn_ended', status: 'success' }),
        '',
      ].join('\n'),
    );
    const activity = await extract(transcriptPath, 'stateful-delivery');

    expect(activity.events[0]).toMatchObject({
      nativeName: 'ReadFile',
      skillEvidence: [
        {
          kind: 'inferred-file-read',
          name: 'one',
          path: '/fixture/skills/one/SKILL.md',
        },
      ],
    });
    expect(activity.events[1]).not.toHaveProperty('skillEvidence');
    expect(activity.coverage).toContainEqual({
      dataClass: 'source-skill-names',
      status: 'not-recorded',
      captured: 0,
    });
    expect(activity.sourceMetadata?.usage).toEqual({
      scope: 'captured-source',
      availability: 'not-recorded',
      samples: [],
      diagnostics: [],
    });
  });

  it('extracts recorded calls with settled positional identity and no invented evidence', async () => {
    const activity = await extract(CAPTURED_FIXTURE, 'stateful-delivery');

    expect(activity.cursor.counts).toEqual({
      capturedCalls: 4,
      settledCalls: 4,
      pendingLifecycleCalls: 0,
      emittedCalls: 4,
      deferredPendingCalls: 0,
    });
    expect(activity.events.map((event) => event.nativeName)).toEqual([
      'Shell',
      'ApplyPatch',
      'CallMcpTool',
      'Subagent',
    ]);
    expect(activity.events.map((event) => event.arguments)).toEqual([
      { command: 'printf fixture', run_in_background: true },
      'Obscured patch body.',
      {
        server: 'fixture-server',
        namespace: 'fixture-namespace',
        toolName: 'fixture-tool',
        arguments: { value: 'obscured' },
      },
      { task: 'Obscured subagent task.', model: 'fixture-model' },
    ]);
    expect(
      activity.events.map(
        ({ outcome, turnOutcome, lifecycleAvailability, locator }) => ({
          outcome,
          turnOutcome,
          lifecycleAvailability,
          locator,
        }),
      ),
    ).toEqual(
      [1, 2, 3, 4].map((blockIndex) => ({
        outcome: 'unknown',
        turnOutcome: 'error',
        lifecycleAvailability: 'settled',
        locator: {
          physicalLine: 2,
          recordIndex: 2,
          sourceFrameIndex: 1,
          deliveryFrameIndex: 2,
          jsonPointer: `/message/content/${blockIndex}`,
        },
      })),
    );
    for (const event of activity.events) {
      expect(event).not.toHaveProperty('nativeId');
      expect(event).not.toHaveProperty('nativeCallId');
      expect(event).not.toHaveProperty('nativeStatus');
      expect(event).not.toHaveProperty('result');
      expect(event).not.toHaveProperty('metadata');
    }
    expect(activity.coverage).toContainEqual({
      dataClass: 'results',
      status: 'not-recorded',
      captured: 0,
    });
  });

  it('defers open-turn calls statefully and reports them separately in stateless snapshots', async () => {
    const transcriptPath = new URL('unterminated.jsonl', OBSERVER_FIXTURES)
      .pathname;
    const stateful = await extract(transcriptPath, 'stateful-delivery');
    const stateless = await extract(transcriptPath, 'stateless-snapshot');
    const repeat = await extract(transcriptPath, 'stateless-snapshot');

    expect(stateful.events).toEqual([]);
    expect(stateful.cursor.counts).toEqual({
      capturedCalls: 1,
      settledCalls: 0,
      pendingLifecycleCalls: 1,
      emittedCalls: 0,
      deferredPendingCalls: 1,
    });
    expect(stateless.cursor.counts).toEqual({
      capturedCalls: 1,
      settledCalls: 0,
      pendingLifecycleCalls: 1,
      emittedCalls: 1,
      deferredPendingCalls: 0,
    });
    expect(stateless.events[0]).toMatchObject({
      nativeName: 'shell',
      outcome: 'unknown',
      turnOutcome: 'pending',
      lifecycleAvailability: 'pending-lifecycle',
      locator: {
        physicalLine: 3,
        recordIndex: 2,
        sourceFrameIndex: 2,
        jsonPointer: '/message/content/0',
      },
    });
    expect(stateless.events[0].locator).not.toHaveProperty(
      'deliveryFrameIndex',
    );
    expect(repeat.events[0].eventKey).toBe(stateless.events[0].eventKey);
  });

  it('changes open snapshot identity across grow-in-place and settles on terminal delivery coordinates', async () => {
    const beforePath = new URL(
      'framed-grow-in-place-before.jsonl',
      OBSERVER_FIXTURES,
    ).pathname;
    const afterPath = new URL(
      'framed-grow-in-place-after.jsonl',
      OBSERVER_FIXTURES,
    ).pathname;
    const canonicalPath = '/fixture/project/grow-in-place.jsonl';
    const before = await extract(
      beforePath,
      'stateless-snapshot',
      canonicalPath,
    );
    const after = await extract(afterPath, 'stateful-delivery', canonicalPath);

    expect(before.events[0]).toMatchObject({
      nativeName: 'inspect',
      lifecycleAvailability: 'pending-lifecycle',
      turnOutcome: 'pending',
      locator: { sourceFrameIndex: 1, recordIndex: 1 },
    });
    expect(after.events[0]).toMatchObject({
      nativeName: 'inspect',
      lifecycleAvailability: 'settled',
      turnOutcome: 'success',
      locator: {
        sourceFrameIndex: 1,
        deliveryFrameIndex: 2,
        recordIndex: 2,
      },
    });
    expect(after.events[0].eventKey).not.toBe(before.events[0].eventKey);
    expect(after.events[0].outcome).toBe('unknown');
  });

  it.each([
    ['terminal-error.jsonl', 'error'],
    ['terminal-aborted.jsonl', 'aborted'],
    ['terminal-cancelled.jsonl', 'cancelled'],
  ] as const)(
    'keeps %s as turn outcome rather than per-call outcome',
    async (fixture, turnOutcome) => {
      const activity = await extract(
        new URL(fixture, OBSERVER_FIXTURES).pathname,
        'stateful-delivery',
      );
      expect(activity.events).toHaveLength(1);
      expect(activity.events[0]).toMatchObject({
        outcome: 'unknown',
        turnOutcome,
        lifecycleAvailability: 'settled',
      });
    },
  );

  it('stops at a malformed safe-prefix barrier and ignores later calls and terminals', async () => {
    const transcriptPath = await temporaryTranscript(
      [
        '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"BeforeBarrier","input":{"n":1}}]}}',
        '{"role":"assistant","message":{"content":[{"type":"tool_use"}',
        '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"AfterBarrier","input":{"n":2}}]}}',
        '{"type":"turn_ended","status":"success"}',
        '',
      ].join('\n'),
    );
    const stateless = await extract(transcriptPath, 'stateless-snapshot');
    const stateful = await extract(transcriptPath, 'stateful-delivery');

    expect(stateless.events.map((event) => event.nativeName)).toEqual([
      'BeforeBarrier',
    ]);
    expect(stateless.events[0].lifecycleAvailability).toBe('pending-lifecycle');
    expect(stateful.events).toEqual([]);
    expect(stateless.diagnostics).toEqual([
      {
        code: 'SOURCE_MALFORMED_RECORD',
        locator: {
          physicalLine: 2,
          recordIndex: 1,
          sourceFrameIndex: 1,
          jsonPointer: '',
        },
      },
    ]);
  });

  it('extracts repaired frames from the repaired snapshot without retaining blocked evidence', async () => {
    const canonicalPath = '/fixture/project/repaired.jsonl';
    const beforePath = await temporaryTranscript(
      '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"RepairMe"}\n',
    );
    const afterPath = await temporaryTranscript(
      [
        '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"Repaired","input":"raw"}]}}',
        '{"type":"turn_ended","status":"success"}',
        '',
      ].join('\n'),
    );
    const before = await extract(
      beforePath,
      'stateless-snapshot',
      canonicalPath,
    );
    const after = await extract(afterPath, 'stateful-delivery', canonicalPath);

    expect(before.events).toEqual([]);
    expect(before.diagnostics[0]?.code).toBe('SOURCE_MALFORMED_RECORD');
    expect(after.diagnostics).toEqual([]);
    expect(after.events[0]).toMatchObject({
      nativeName: 'Repaired',
      arguments: 'raw',
      lifecycleAvailability: 'settled',
      locator: { sourceFrameIndex: 0, deliveryFrameIndex: 1 },
    });
  });

  it('scopes open positional identity to each replaced snapshot', async () => {
    const canonicalPath = '/fixture/project/replaced.jsonl';
    const firstPath = await temporaryTranscript(
      '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"path":"a"}}]}}\n',
    );
    const replacementPath = await temporaryTranscript(
      '{"role":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"path":"b"}}]}}\n',
    );
    const first = await extract(firstPath, 'stateless-snapshot', canonicalPath);
    const replacement = await extract(
      replacementPath,
      'stateless-snapshot',
      canonicalPath,
    );

    expect(first.events[0].locator).toEqual(replacement.events[0].locator);
    expect(first.events[0].eventKey).not.toBe(replacement.events[0].eventKey);
    expect(first.events[0].arguments).toEqual({ path: 'a' });
    expect(replacement.events[0].arguments).toEqual({ path: 'b' });
  });
});
