import type {
  DetailedTranscriptRead,
  DetailedTranscriptRecord,
  JsonObject,
} from '../runtimes.js';

export const ACTIVITY_SCHEMA_VERSION = 1 as const;

export type ActivityRuntime = 'claude-code' | 'codex';
export type ActivityOutcome =
  | 'success'
  | 'error'
  | 'cancelled'
  | 'pending'
  | 'unknown';
export type ActivityEventKind =
  | 'call'
  | 'result'
  | 'item'
  | 'metadata'
  | 'notification'
  | 'lifecycle'
  | 'compaction';
export type ActivityCategory =
  | 'shell'
  | 'read'
  | 'write'
  | 'edit'
  | 'grep'
  | 'glob'
  | 'search'
  | 'fetch'
  | 'task'
  | 'ask'
  | 'mcp'
  | 'other';
export type ActivityOwnership = 'owned' | 'inherited' | 'unknown';
export type ActivityCoverageStatus =
  | 'available'
  | 'not-recorded'
  | 'not-found'
  | 'not-read'
  | 'unsupported'
  | 'malformed'
  | 'truncated';

export interface ActivitySource {
  runtime: ActivityRuntime;
  /** Provider root/session identity for the selected transcript. */
  sessionId: string;
  /** Exact provider-native identity for this transcript source. */
  nativeSessionId: string;
  /** Selected transcript path. Extraction never follows paths in payloads. */
  transcriptPath: string;
}

export interface ActivityLocator {
  /** One-based physical JSONL line. */
  physicalLine: number;
  /** JSON Pointer within the decoded native record. */
  jsonPointer: string;
  /** Zero-based logical decoded-record index when a record decoded. */
  recordIndex?: number;
  /** Provider ordinal when the selected record carries one. */
  ordinal?: number;
}

export interface ActivityEventLocator extends ActivityLocator {
  recordIndex: number;
}

export interface ActivityExternalReference {
  kind: 'persisted-output';
  availability: 'not-read';
  path?: string;
  size?: number;
}

export interface ActivityChildReference {
  nativeId: string;
  nickname?: string;
  status?: string;
  trajectoryAvailability: 'not-read';
}

export interface ExtractedActivityEvent {
  eventKey: string;
  kind: ActivityEventKind;
  nativeType: string;
  locator: ActivityEventLocator;
  outcome: ActivityOutcome;
  nativeId?: string;
  nativeCallId?: string;
  nativeName?: string;
  nativeStatus?: string;
  origin?: string;
  turnId?: string;
  /** Unmodified native call arguments/input. Presentation budgets apply later. */
  arguments?: unknown;
  /** Unmodified native result/output. Presentation budgets apply later. */
  result?: unknown;
  /** Supported native item carrier. Reasoning and instruction bodies are absent. */
  nativeValue?: JsonObject;
  /** Whitelisted metadata only; never an instruction/reasoning carrier. */
  metadata?: JsonObject;
  externalReference?: ActivityExternalReference;
  childReference?: ActivityChildReference;
}

export type ActivityDiagnosticCode =
  | 'ACTIVITY_EXTRACTION_ERROR'
  | 'AMBIGUOUS_NATIVE_CORRELATION'
  | 'POSSIBLE_SOURCE_TRUNCATION'
  | 'SOURCE_MALFORMED_RECORD'
  | 'SOURCE_NOT_OBJECT'
  | 'SOURCE_PARTIAL_TAIL';

export interface ActivityDiagnostic {
  code: ActivityDiagnosticCode;
  locator: ActivityLocator;
  field?: string;
  bytes?: number;
  nativeId?: string;
}

export type ActivityDataClass =
  | 'calls'
  | 'results'
  | 'items'
  | 'metadata'
  | 'persisted-output'
  | 'child-trajectory'
  | 'record-activity';

export interface ActivityCoverageEntry {
  dataClass: ActivityDataClass;
  status: ActivityCoverageStatus;
  captured: number;
  locator?: ActivityLocator;
}

export interface ExtractActivityInput {
  source: ActivitySource;
  read: DetailedTranscriptRead;
}

export interface ExtractedActivity {
  activitySchemaVersion: typeof ACTIVITY_SCHEMA_VERSION;
  source: ActivitySource;
  events: ExtractedActivityEvent[];
  coverage: ActivityCoverageEntry[];
  diagnostics: ActivityDiagnostic[];
}

export interface CorrelatedActivityEvent extends ExtractedActivityEvent {
  ownership: ActivityOwnership;
  category?: ActivityCategory;
  relatedCallKey?: string;
}

export interface ActivityCorrelationCounts {
  responseStreamCalls: {
    captured: number;
    counted: number;
    owned: number;
    inherited: number;
    unknown: number;
  };
  results: {
    matched: number;
    unmatched: number;
  };
  itemEvidence: {
    linked: number;
    standalone: number;
  };
}

export interface CorrelatedActivity extends Omit<ExtractedActivity, 'events'> {
  events: CorrelatedActivityEvent[];
  correlationCounts: ActivityCorrelationCounts;
}

export type ActivityProjectionMode = 'watch' | 'catch-up' | 'review' | 'export';

export interface ActivityDeliveryRange {
  indexBase: 'zero-based-decoded-record-index';
  start: number;
  end: number;
}

export interface ActivityProjectionLimits {
  maxBytes: number;
  maxInvocations: number | null;
  previewBytes: number;
  lateContextBytes: number;
}

export interface ProjectActivityOptions {
  mode: ActivityProjectionMode;
  deliveryRange: ActivityDeliveryRange;
}

export interface ActivityPreview {
  text: string;
  sourceBytes: number;
  displayedBytes: number;
  truncated: boolean;
}

export interface ProjectedActivityEvent {
  eventKey: string;
  kind: ActivityEventKind;
  nativeType: string;
  locator: ActivityEventLocator;
  outcome: ActivityOutcome;
  ownership: ActivityOwnership;
  category?: ActivityCategory;
  relatedCallKey?: string;
  nativeId?: string;
  nativeCallId?: string;
  nativeName?: string;
  nativeStatus?: string;
  origin?: string;
  turnId?: string;
  inputPreview?: ActivityPreview;
  outputPreview?: ActivityPreview;
  metadataPreview?: ActivityPreview;
  outputPreviewOmitted?: 'exact-linked-duplicate-carrier';
  externalReference?: ActivityExternalReference;
  childReference?: ActivityChildReference;
}

export interface ActivityCallContext {
  callKey: string;
  availability: 'outside-delivered-range';
  locator: ActivityEventLocator;
  nativeCallId?: string;
  nativeName?: string;
  category?: ActivityCategory;
  inputPreview?: ActivityPreview;
}

export interface ActivityScopedCounts {
  scope: 'captured-source' | 'delivered-range' | 'displayed';
  calls: number;
  countedInvocations: number;
  results: number;
  items: number;
  failures: number;
}

export interface ActivityOmissionCounts {
  calls: number;
  results: number;
  failures: number;
  invocationLimitGroups: number;
  byteLimitGroups: number;
}

export interface ActivityReport {
  activitySchemaVersion: typeof ACTIVITY_SCHEMA_VERSION;
  mode: ActivityProjectionMode;
  source: ActivitySource;
  deliveryRange: ActivityDeliveryRange;
  limits: ActivityProjectionLimits;
  renderedBytes: number;
  counts: {
    capturedSource: ActivityScopedCounts;
    deliveredRange: ActivityScopedCounts;
    displayed: ActivityScopedCounts;
  };
  omitted: ActivityOmissionCounts;
  events: ProjectedActivityEvent[];
  callContexts: ActivityCallContext[];
  coverage: ActivityCoverageEntry[];
  diagnostics: ActivityDiagnostic[];
}

export interface ExtractedRecordActivity {
  events: ExtractedActivityEvent[];
  coverage: ActivityCoverageEntry[];
  diagnostics: ActivityDiagnostic[];
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function recordLocator(
  detailed: DetailedTranscriptRecord,
  jsonPointer: string,
): ActivityEventLocator {
  const ordinal = numberValue(detailed.record.ordinal);
  return {
    recordIndex: detailed.recordIndex,
    physicalLine: detailed.physicalLine,
    jsonPointer,
    ...(ordinal === undefined ? {} : { ordinal }),
  };
}

export function eventKey(
  source: ActivitySource,
  locator: ActivityEventLocator,
): string {
  return `${source.runtime}:${source.nativeSessionId}:${locator.recordIndex}:${locator.jsonPointer}`;
}

export function outcomeFromStatus(status: unknown): ActivityOutcome {
  if (typeof status !== 'string') return 'unknown';
  switch (status.toLowerCase()) {
    case 'success':
    case 'succeeded':
    case 'completed':
      return 'success';
    case 'error':
    case 'failed':
      return 'error';
    case 'aborted':
    case 'cancelled':
    case 'canceled':
    case 'interrupted':
      return 'cancelled';
    case 'pending':
    case 'started':
    case 'running':
    case 'in_progress':
    case 'async_launched':
      return 'pending';
    default:
      return 'unknown';
  }
}
