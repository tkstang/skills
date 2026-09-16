/**
 * PROPOSED contract. This packet does not implement --include-activity.
 * Native extraction retains full source values; this type is the bounded view.
 * Do not replace existing observer DigestEntry or Cursor v2 state with this type.
 */
export type ActivityKind =
  | 'tool_call' | 'tool_result' | 'lifecycle' | 'compaction'
  | 'metadata' | 'subagent' | 'recorded_reasoning' | 'unknown';
export type ActivityCategory =
  | 'shell' | 'read' | 'write' | 'edit' | 'grep' | 'glob'
  | 'search' | 'fetch' | 'task' | 'ask' | 'mcp' | 'other';
export type Outcome = 'success' | 'error' | 'cancelled' | 'pending' | 'unknown';
export type Availability =
  | 'settled' | 'pending-lifecycle' | 'terminal-incomplete' | 'unknown';
export type CoverageStatus =
  | 'available' | 'not-recorded' | 'not-found' | 'not-read'
  | 'unsupported' | 'malformed' | 'truncated';

/** Native source position, not an observer checkpoint or normalized sequence. */
export interface SourceRef {
  surface: 'jsonl' | 'cursor-frame' | 'json' | 'sqlite-row' | 'artifact';
  path: string;
  /** One-based physical line. May contain multiple decoded objects. */
  physicalLine?: number;
  /** Byte coordinates, start inclusive / end exclusive, in the captured source. */
  byteStart?: number;
  byteEnd?: number;
  /** JSON Pointer within the decoded source record, object, or row payload. */
  jsonPointer?: string;
  /** Explicitly the existing reader's logical coordinate; never a physical line. */
  logicalRecordIndex?: number;
  /** Original Cursor content frame and safe delivery frame are distinct. */
  sourceFrameIndex?: number;
  deliveryFrameIndex?: number;
  table?: string;
  rowId?: string;
  /** Optional immutable snapshot identifier, only when one was actually made. */
  snapshotId?: string;
}

export interface PayloadPreview {
  text: string;
  /** Character counts refer to a declared text projection, not raw byte fidelity. */
  originalChars: number;
  omittedChars: number;
  source: SourceRef;
}

export interface OutcomeEvidence {
  kind: 'source-status' | 'recorded-exit-code' | 'parsed-output' | 'none';
  detail: string;
  source?: SourceRef;
}

export interface ActivityEvent {
  /** Stable key scoped by runtime, exact session, source identity, and event/block. */
  id: string;
  kind: ActivityKind;
  /** Ordering in the captured provider stream. Not a cross-agent causal clock. */
  sequence: number;
  source: SourceRef;
  availability: Availability;
  timestamp?: string;
  nativeEventId?: string;
  nativeParentId?: string;
  nativeCallId?: string;
  /** Exact source function/tool name; do not replace it with a category. */
  nativeToolName?: string;
  nativeNamespace?: string;
  category?: ActivityCategory;
  /** May refer to an earlier call outside the currently rendered event window. */
  relatedCallEventId?: string;
  input?: PayloadPreview;
  output?: PayloadPreview;
  nativeStatus?: string;
  outcome?: Outcome;
  outcomeEvidence?: OutcomeEvidence;
  /** Derived conveniences, never replacements for source input/result. */
  enrichment?: {
    command?: string;
    filePaths?: string[];
    lineStart?: number;
    lineEnd?: number;
    query?: string;
    url?: string;
    taskDescription?: string;
    recordedExitCode?: number;
    displayDiff?: string;
    omittedDiffLines?: number;
  };
}

export interface ActivityReport {
  activitySchemaVersion: 1;
  scope: {
    runtime: string;
    sessionId: string;
    sourcePath: string;
    captureMode: 'live-read' | 'snapshot';
    capturedAt: string;
    snapshotId?: string;
  };
  events: ActivityEvent[];
  toolGroups: Array<{
    nativeToolName: string;
    category: ActivityCategory;
    countScope: 'captured-range' | 'delivered-range' | 'displayed-range';
    invocationCount: number;
    sampleEventIds: string[];
  }>;
  metadata: Array<{
    name: string;
    value: unknown;
    source: SourceRef;
    interpretation?: string;
  }>;
  coverage: {
    source: Array<{ dataClass: string; status: CoverageStatus; detail: string }>;
    display: {
      eventsAvailable: number;
      eventsShown: number;
      eventsOmitted: number;
      payloadCharsOmitted: number;
    };
    unmatchedCalls: number;
    unmatchedResults: number;
    warnings: string[];
  };
}
