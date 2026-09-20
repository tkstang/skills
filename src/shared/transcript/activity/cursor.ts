import type {
  CursorTranscriptAnalysis,
  CursorTurnAnalysis,
} from '../cursor-analysis.js';
import type { CursorTranscriptScan } from '../cursor-frames.js';
import { structuredSkillFileReadEvidence } from './skill-evidence.js';
import { ACTIVITY_SCHEMA_VERSION } from './types.js';
import type {
  ActivityCoverageEntry,
  ActivityEventLocator,
  ActivitySource,
  ExtractedActivity,
  ExtractedActivityEvent,
} from './types.js';

export type CursorActivityExtractionMode =
  | 'stateful-delivery'
  | 'stateless-snapshot';

export interface ExtractCursorActivityInput {
  source: ActivitySource & { runtime: 'cursor' };
  scan: CursorTranscriptScan;
  analysis: CursorTranscriptAnalysis;
  capturedAt: string;
  mode: CursorActivityExtractionMode;
}

export interface CursorActivityCounts {
  capturedCalls: number;
  settledCalls: number;
  pendingLifecycleCalls: number;
  emittedCalls: number;
  deferredPendingCalls: number;
}

export interface ExtractedCursorActivity extends ExtractedActivity {
  cursor: {
    indexBase: 'zero-based-jsonl-frame-index';
    mode: CursorActivityExtractionMode;
    counts: CursorActivityCounts;
  };
}

function validateInput(input: ExtractCursorActivityInput): void {
  if (
    input.source.runtime !== 'cursor' ||
    !input.source.sessionId.trim() ||
    !input.source.nativeSessionId.trim() ||
    !input.source.transcriptPath.trim()
  ) {
    throw new Error('Cursor activity extraction requires an exact source');
  }
  if (!input.capturedAt.trim()) {
    throw new Error('Cursor activity extraction requires a capture time');
  }
  if (input.scan.indexBase !== 'zero-based-jsonl-frame-index') {
    throw new Error('Cursor activity extraction requires frame-indexed input');
  }
}

function isSettled(turn: CursorTurnAnalysis): boolean {
  return turn.terminalFrameIndex !== null;
}

function eventLocator(
  sourceFrameIndex: number,
  blockIndex: number,
  terminalFrameIndex: number | null,
): ActivityEventLocator {
  const deliveryFrameIndex = terminalFrameIndex ?? sourceFrameIndex;
  return {
    // Cursor JSONL frames retain a one-to-one physical-line coordinate even
    // though delivery is selected by terminal frame rather than source line.
    physicalLine: sourceFrameIndex + 1,
    recordIndex: deliveryFrameIndex,
    sourceFrameIndex,
    ...(terminalFrameIndex === null
      ? {}
      : { deliveryFrameIndex: terminalFrameIndex }),
    jsonPointer: `/message/content/${blockIndex}`,
  };
}

function eventKey(
  turn: CursorTurnAnalysis,
  sourceFrameIndex: number,
  blockIndex: number,
  scan: CursorTranscriptScan,
): string {
  const positional = `${turn.turnId}:frame:${sourceFrameIndex}:block:${blockIndex}`;
  return isSettled(turn)
    ? positional
    : `${positional}:snapshot:${scan.safePrefixSha256}`;
}

function callEvents(
  input: ExtractCursorActivityInput,
): ExtractedActivityEvent[] {
  return input.analysis.turns.flatMap((turn) => {
    const settled = isSettled(turn);
    if (input.mode === 'stateful-delivery' && !settled) return [];

    return (turn.toolRecords ?? []).map((tool): ExtractedActivityEvent => {
      const skillEvidence = structuredSkillFileReadEvidence(
        'cursor',
        tool.nativeName,
        tool.arguments,
      );
      return {
        eventKey: eventKey(
          turn,
          tool.sourceFrameIndex,
          tool.blockIndex,
          input.scan,
        ),
        kind: 'call',
        nativeType: tool.nativeType,
        locator: eventLocator(
          tool.sourceFrameIndex,
          tool.blockIndex,
          turn.terminalFrameIndex,
        ),
        // Cursor records only turn-level terminal evidence. A successful,
        // errored, or aborted turn never proves an individual call's outcome.
        outcome: 'unknown',
        turnId: turn.turnId,
        lifecycleAvailability: settled ? 'settled' : 'pending-lifecycle',
        turnOutcome: turn.lifecycle,
        ...(tool.nativeName === undefined
          ? {}
          : { nativeName: tool.nativeName }),
        ...(Object.hasOwn(tool, 'arguments')
          ? { arguments: tool.arguments }
          : {}),
        ...(skillEvidence === undefined
          ? {}
          : { skillEvidence: [skillEvidence] }),
      };
    });
  });
}

function lifecycleCounts(
  analysis: CursorTranscriptAnalysis,
  emittedCalls: number,
  mode: CursorActivityExtractionMode,
): CursorActivityCounts {
  let settledCalls = 0;
  let pendingLifecycleCalls = 0;
  for (const turn of analysis.turns) {
    const count = turn.toolRecords?.length ?? 0;
    if (isSettled(turn)) settledCalls += count;
    else pendingLifecycleCalls += count;
  }
  return {
    capturedCalls: settledCalls + pendingLifecycleCalls,
    settledCalls,
    pendingLifecycleCalls,
    emittedCalls,
    deferredPendingCalls:
      mode === 'stateful-delivery' ? pendingLifecycleCalls : 0,
  };
}

function coverage(
  events: readonly ExtractedActivityEvent[],
  scan: CursorTranscriptScan,
  mode: CursorActivityExtractionMode,
): ActivityCoverageEntry[] {
  const entries: ActivityCoverageEntry[] = [
    {
      dataClass: 'calls',
      status: 'available',
      captured: events.length,
    },
    {
      dataClass: 'skills',
      status: 'not-recorded',
      captured: 0,
    },
    ...(events.length > 0 || mode === 'stateless-snapshot'
      ? [
          {
            dataClass: 'results' as const,
            status: 'not-recorded' as const,
            captured: 0,
          },
        ]
      : []),
  ];
  if (scan.blockingFrame) {
    entries.push({
      dataClass: 'record-activity',
      status: 'malformed',
      captured: 0,
      locator: {
        physicalLine: scan.blockingFrame.frameIndex + 1,
        recordIndex: scan.blockingFrame.frameIndex,
        sourceFrameIndex: scan.blockingFrame.frameIndex,
        jsonPointer: '',
      },
    });
  }
  return entries;
}

export function extractCursorActivity(
  input: ExtractCursorActivityInput,
): ExtractedCursorActivity {
  validateInput(input);
  const events = callEvents(input);
  const counts = lifecycleCounts(input.analysis, events.length, input.mode);
  return {
    activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
    source: input.source,
    sourceSnapshot: {
      capturedAt: input.capturedAt,
      sourceBytes: input.scan.file.size,
    },
    events,
    coverage: coverage(events, input.scan, input.mode),
    diagnostics: input.scan.blockingFrame
      ? [
          {
            code:
              input.scan.blockingFrame.parseState === 'partial'
                ? 'SOURCE_PARTIAL_TAIL'
                : 'SOURCE_MALFORMED_RECORD',
            locator: {
              physicalLine: input.scan.blockingFrame.frameIndex + 1,
              recordIndex: input.scan.blockingFrame.frameIndex,
              sourceFrameIndex: input.scan.blockingFrame.frameIndex,
              jsonPointer: '',
            },
          },
        ]
      : [],
    sourceMetadata: {
      scope: 'captured-source',
      skills: [],
    },
    cursor: {
      indexBase: input.scan.indexBase,
      mode: input.mode,
      counts,
    },
  };
}
