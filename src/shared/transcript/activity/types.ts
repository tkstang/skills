import type {
  DetailedTranscriptRead,
  DetailedTranscriptRecord,
  JsonObject,
  TranscriptSourceSnapshot,
} from '../runtimes.js';

export const ACTIVITY_SCHEMA_VERSION = 1 as const;

export type ActivityRuntime = 'claude-code' | 'codex' | 'cursor';
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
  /** Cursor source frame containing the recorded block. */
  sourceFrameIndex?: number;
  /** Cursor terminal frame that made the call statefully deliverable. */
  deliveryFrameIndex?: number;
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

export type ActivitySkillEvidenceKind =
  | 'native-attribution'
  | 'native-invocation'
  | 'inferred-file-read';

export interface ActivitySkillEvidence {
  kind: ActivitySkillEvidenceKind;
  /** Recorded native skill name when the carrier provides one. */
  name?: string;
  /** Structured read-tool path. Never populated from shell commands or prose. */
  path?: string;
}

export interface ActivitySourceSkill {
  scope: 'captured-source';
  evidence: 'available' | 'invoked';
  name: string;
  locator: ActivityEventLocator;
}

export type ActivityUsageSemantics =
  | 'claude-message'
  | 'codex-cumulative'
  | 'codex-last-turn'
  | 'codex-response';

export interface ActivityTokenUsageSample {
  semantics: ActivityUsageSemantics;
  ownership: ActivityOwnership;
  locator: ActivityEventLocator;
  tokens: JsonObject;
  model?: string;
  messageId?: string;
  turnId?: string;
  responseId?: string;
  segment?: number;
  uncertainty?: 'missing-message-id';
}

export type ActivityUsageDiagnosticCode =
  | 'USAGE_CONFLICT'
  | 'USAGE_COUNTER_RESET'
  | 'USAGE_DEDUP_UNCERTAIN'
  | 'USAGE_SESSION_MISMATCH';

export interface ActivityUsageDiagnostic {
  code: ActivityUsageDiagnosticCode;
  locator: ActivityEventLocator;
  messageId?: string;
}

export interface ActivityUsageMetadata {
  scope: 'captured-source';
  availability: 'recorded' | 'not-recorded';
  samples: ActivityTokenUsageSample[];
  diagnostics: ActivityUsageDiagnostic[];
}

export interface ActivitySourceMetadata {
  scope: 'captured-source';
  skills: ActivitySourceSkill[];
  usage?: ActivityUsageMetadata;
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
  /** Cursor call availability; absent for record-oriented runtimes. */
  lifecycleAvailability?: 'settled' | 'pending-lifecycle';
  /** Cursor turn outcome evidence, kept separate from per-call outcome. */
  turnOutcome?:
    | 'pending'
    | 'success'
    | 'aborted'
    | 'error'
    | 'cancelled'
    | 'unknown';
  /** Parsed or native-ready call arguments/input. Presentation budgets apply later. */
  arguments?: unknown;
  /** Exact native string/object arguments carrier before documented parsing. */
  originalArguments?: unknown;
  /** Unmodified native result/output. Presentation budgets apply later. */
  result?: unknown;
  /** Supported native item carrier. Reasoning and instruction bodies are absent. */
  nativeValue?: JsonObject;
  /** Whitelisted metadata only; never an instruction/reasoning carrier. */
  metadata?: JsonObject;
  externalReference?: ActivityExternalReference;
  childReference?: ActivityChildReference;
  skillEvidence?: ActivitySkillEvidence[];
}

export type ActivityDiagnosticCode =
  | 'ACTIVITY_EXTRACTION_ERROR'
  | 'ARGUMENT_PARSE_ERROR'
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
  | 'source-skill-names'
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
  sourceSnapshot: TranscriptSourceSnapshot;
  events: ExtractedActivityEvent[];
  coverage: ActivityCoverageEntry[];
  diagnostics: ActivityDiagnostic[];
  sourceMetadata?: ActivitySourceMetadata;
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
export type ActivityRenderFormat = 'compact-json' | 'markdown';

export interface ActivityDeliveryRange {
  indexBase: 'zero-based-decoded-record-index' | 'zero-based-jsonl-frame-index';
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
  renderFormat: ActivityRenderFormat;
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
  lifecycleAvailability?: 'settled' | 'pending-lifecycle';
  turnOutcome?:
    | 'pending'
    | 'success'
    | 'aborted'
    | 'error'
    | 'cancelled'
    | 'unknown';
  inputPreview?: ActivityPreview;
  originalInputPreview?: ActivityPreview;
  outputPreview?: ActivityPreview;
  metadataPreview?: ActivityPreview;
  outputPreviewOmitted?: 'exact-linked-duplicate-carrier';
  externalReference?: ActivityExternalReference;
  childReference?: ActivityChildReference;
  skillEvidence?: ActivitySkillEvidence[];
}

export interface ActivityCallContext {
  callKey: string;
  availability: 'outside-delivered-range';
  locator: ActivityEventLocator;
  nativeCallId?: string;
  nativeName?: string;
  category?: ActivityCategory;
  inputPreview?: ActivityPreview;
  originalInputPreview?: ActivityPreview;
}

export interface ActivityScopedCounts {
  scope: 'captured-source' | 'delivered-range' | 'displayed';
  calls: number;
  countedInvocations: number;
  pendingLifecycleCalls: number;
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
  coverageEntries: number;
  diagnostics: number;
  sourceSkills: number;
  usageSamples: number;
  usageDiagnostics: number;
}

export interface ActivityReport {
  activitySchemaVersion: typeof ACTIVITY_SCHEMA_VERSION;
  mode: ActivityProjectionMode;
  renderedFormat: ActivityRenderFormat;
  source: ActivitySource;
  sourceSnapshot: TranscriptSourceSnapshot;
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
  sourceMetadata: ActivitySourceMetadata;
}

export interface ExtractedRecordActivity {
  events: ExtractedActivityEvent[];
  coverage: ActivityCoverageEntry[];
  diagnostics: ActivityDiagnostic[];
  sourceSkills?: ActivitySourceSkill[];
  sourceSkillNamesRecorded?: boolean;
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
