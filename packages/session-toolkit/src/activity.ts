import type {
  CorrelatedActivity,
  CorrelatedActivityEvent,
} from './activity-types.js';
import { readTranscript, type SessionReadOptions } from './discovery.js';
import { extractPageActivity } from './page-summary.js';
import type { TranscriptPage, SourceRecord, ReadDiagnostic } from './reader.js';

export type ActivityOptions = Omit<
  SessionReadOptions,
  'includeToolCalls' | 'includeToolResults' | 'includeActivity'
>;
export type ActivityEvent = CorrelatedActivityEvent;
/** Sensitive captured-source evidence. No preview rendering or sanitization. */
export interface ActivityCapture extends CorrelatedActivity {
  kind: 'sensitive-activity';
  scope: 'captured-page';
  support: {
    calls: 'recorded';
    results: 'recorded' | 'not-recorded';
    usage: 'recorded-when-present' | 'not-recorded';
  };
  sourceRead: {
    coordinate: TranscriptPage['coordinate'];
    generation: string;
    sourceBytes: number;
    bytesRead: number;
    records: SourceRecord[];
    diagnostics: ReadDiagnostic[];
    nextOffset: number;
    nextCursor: string | null;
    coverage: TranscriptPage['coverage'] & { fullSource: boolean };
  };
}
/** Select one exact session; retain every captured raw field and source coordinate. */
export async function captureActivity(
  options: ActivityOptions,
): Promise<ActivityCapture> {
  const page = await readTranscript({
    ...options,
    includeToolCalls: false,
    includeToolResults: false,
    includeActivity: false,
  });
  const correlated = extractPageActivity(page);
  if (page.runtime === 'cursor')
    for (const diagnostic of page.diagnostics) {
      correlated.diagnostics.push({
        code:
          diagnostic.kind === 'partial-tail'
            ? 'SOURCE_PARTIAL_TAIL'
            : diagnostic.kind === 'not-object'
              ? 'SOURCE_NOT_OBJECT'
              : 'SOURCE_MALFORMED_RECORD',
        locator: {
          physicalLine: diagnostic.physicalLine,
          sourceFrameIndex: diagnostic.frameIndex,
          jsonPointer: '',
        },
      });
      correlated.coverage.push({
        dataClass: 'record-activity',
        status: 'malformed',
        captured: 0,
        locator: {
          physicalLine: diagnostic.physicalLine,
          sourceFrameIndex: diagnostic.frameIndex,
          jsonPointer: '',
        },
      });
    }
  const reasons = [...page.coverage.reasons];
  if (page.coverage.fromByte !== 0) reasons.push('prefix-not-read');
  if (page.diagnostics.length) reasons.push('source-diagnostics');
  return {
    ...correlated,
    sourceSnapshot: {
      capturedAt: page.capturedAt,
      sourceBytes: page.sourceBytes,
    },
    kind: 'sensitive-activity',
    scope: 'captured-page',
    support: {
      calls: 'recorded',
      results: page.runtime === 'cursor' ? 'not-recorded' : 'recorded',
      usage:
        page.runtime === 'cursor' ? 'not-recorded' : 'recorded-when-present',
    },
    sourceRead: {
      coordinate: page.coordinate,
      generation: page.generation,
      sourceBytes: page.sourceBytes,
      bytesRead: page.bytesRead,
      records: page.records,
      diagnostics: page.diagnostics,
      nextOffset: page.nextOffset,
      nextCursor: page.nextCursor,
      coverage: {
        ...page.coverage,
        reasons,
        fullSource: page.coverage.complete && reasons.length === 0,
      },
    },
  };
}
