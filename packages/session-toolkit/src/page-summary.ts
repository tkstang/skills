import { dirname, basename } from 'node:path';

import { correlateActivity } from './activity-correlate.js';
import { extractCursorActivity } from './activity-cursor.js';
import { extractActivity } from './activity-extract.js';
import { projectActivity } from './activity-project.js';
import type { ActivityReport, ActivitySource } from './activity-types.js';
import { createCursorTurnAccumulator } from './cursor-analysis.js';
import type { CursorTranscriptScan } from './cursor-frames.js';
import type { TranscriptPage } from './reader.js';
export type PageActivitySummary = Pick<
  ActivityReport,
  'counts' | 'coverage' | 'diagnostics' | 'sourceMetadata'
> & { scope: 'captured-page'; sourceComplete: boolean };
/** Summaries retain explicit source coverage and usage, independently of conversation filters. */
export function extractPageActivity(
  page: TranscriptPage,
  selectedSource?: ActivitySource,
) {
  const id =
    selectedSource?.nativeSessionId ??
    page.metadata?.nativeSessionId ??
    page.metadata?.sessionId ??
    basename(page.path, '.jsonl');
  const source = selectedSource ?? {
    runtime: page.runtime,
    sessionId: id,
    nativeSessionId: id,
    transcriptPath: page.path,
  };
  let extracted;
  if (page.runtime === 'cursor') {
    const accumulator = createCursorTurnAccumulator(
      {
        runtime: 'cursor',
        projectCwd: page.metadata?.recordedCwd ?? dirname(page.path),
        sessionId: id,
        canonicalTranscriptPath: page.path,
      },
      page.records[0]?.frameIndex ?? 0,
    );
    for (const row of page.records)
      accumulator.onFrame({
        frameIndex: row.frameIndex!,
        byteStart: row.byteStart,
        byteEnd: row.byteEnd,
        closed: row.closed,
        parseState: 'parsed',
        record: row.record,
      });
    const scan: CursorTranscriptScan = {
      indexBase: 'zero-based-jsonl-frame-index',
      totalFrames: page.nextOffset,
      safeThroughFrame: page.records.at(-1)?.frameIndex ?? null,
      safePrefixBytes: page.coverage.throughByte,
      safePrefixSha256: page.generation,
      verifiedPrefixSha256: null,
      file: { size: page.sourceBytes, mtimeMs: 0, device: null, inode: null },
      blockingFrame: null,
    };
    extracted = extractCursorActivity({
      source: { ...source, runtime: 'cursor' },
      scan,
      analysis: accumulator.finish(scan),
      capturedAt: page.capturedAt,
      mode: 'stateless-snapshot',
    });
  } else {
    extracted = extractActivity({
      source,
      read: {
        records: page.records,
        diagnostics: page.diagnostics,
        capturedAt: page.capturedAt,
        sourceBytes: page.bytesRead,
      },
    });
  }
  return correlateActivity(extracted);
}
export function summarizePage(page: TranscriptPage): PageActivitySummary {
  const report = projectActivity(extractPageActivity(page), {
    mode: 'review',
    renderFormat: 'compact-json',
    deliveryRange: {
      indexBase:
        page.runtime === 'cursor'
          ? 'zero-based-jsonl-frame-index'
          : 'zero-based-decoded-record-index',
      start:
        (page.runtime === 'cursor'
          ? page.records[0]?.frameIndex
          : page.records[0]?.recordIndex) ?? 0,
      end:
        ((page.runtime === 'cursor'
          ? page.records.at(-1)?.frameIndex
          : page.records.at(-1)?.recordIndex) ?? -1) + 1,
    },
  });
  return {
    scope: 'captured-page',
    sourceComplete: page.coverage.complete,
    counts: report.counts,
    coverage: report.coverage,
    diagnostics: report.diagnostics,
    sourceMetadata: report.sourceMetadata,
  };
}
