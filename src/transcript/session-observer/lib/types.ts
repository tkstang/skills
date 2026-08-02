import type {
  CursorLifecycleState,
  CursorTranscriptAnalysis,
} from '../../core/cursor-analysis.js';
import type {
  CursorFrameIssue,
  CursorTranscriptScan,
} from '../../core/cursor-frames.js';
import type {
  AutomaticControlProvenance,
  CursorTerminalStatus,
  DigestEntry,
  DigestEntryOrigin,
  JsonObject,
  Runtime,
} from '../../core/runtimes.js';

export type {
  AutomaticControlProvenance,
  CursorTerminalStatus,
  DigestEntryOrigin,
};

export type SessionObserverRuntime = Runtime;
export type RuntimeSelection = Runtime | 'auto';
export type WatchRuntimeSelection = RuntimeSelection | 'both';
export type RankTier = 'A' | 'B' | 'C';
export type EngagementStatus = 'engaged' | 'unengaged' | 'unknown';
export type DigestMode = 'review' | 'catch-up' | 'locate';
export type WatchControlDirective = 'flush' | 'pause' | 'resume' | 'stop';
export type TranscriptIndexBase =
  | 'zero-based-jsonl-record-index'
  | 'zero-based-jsonl-frame-index';

export interface TranscriptClassification {
  status: EngagementStatus;
  engaged: boolean;
  recordCount: number | null;
  genuineUserMessages: number;
  /**
   * Ask-user answers the runtime attributes to the operator. Counted apart
   * from `genuineUserMessages` because answering a structured prompt is human
   * engagement of a different shape, and because Codex answers that could have
   * auto-resolved on a timer are deliberately excluded.
   */
  operatorAskUserAnswers: number;
  syntheticUserMessages: number;
  assistantMessages: number;
  realMessageCount: number;
  hasAssistantAndUser: boolean;
  bootstrapRecordIndexes: number[];
  bootstrapRecordCount: number;
}

export interface EngagementCandidateFields {
  engagement: TranscriptClassification;
  engagementStatus: EngagementStatus;
  engaged: boolean;
  recordCount: number | null;
  genuineUserMessages: number;
  assistantMessages: number;
  realMessageCount: number;
  hasAssistantAndUser: boolean;
  bootstrapRecordCount: number;
}

export interface SnippetMatch {
  excerpt: string;
  context: string;
}

export interface TranscriptCandidate extends EngagementCandidateFields {
  runtime: Runtime;
  transcriptPath: string;
  sessionId: string;
  recordedCwd: string | null;
  mtime: number;
  size: number;
  ageSec: number;
  cwdSlug?: string;
  cwdEvidence?: string;
  active?: boolean;
  snippetMatch?: SnippetMatch;
}

export type CursorCwdEvidence =
  | 'direct-project-root'
  | 'store-metadata'
  | 'harness-environment'
  | 'fallback-slug';

export type CursorSessionEvidence =
  | 'explicit-pin'
  | 'harness-environment'
  | 'transcript-path';

export interface CursorIdentityEvidence {
  runtime: 'cursor';
  sessionId: string;
  /** Canonical cwd used by observer identity and the shared turn analyzer. */
  projectCwd: string;
  canonicalCwd: string;
  canonicalTranscriptPath: string;
  cwdEvidence: CursorCwdEvidence[];
  sessionEvidence: CursorSessionEvidence[];
  strength: 'exact' | 'diagnostic' | 'ambiguous';
  reasons: string[];
}

export type CursorProjection = 'observation' | 'confirmed-completion';

export interface ObservationStatus {
  engagement: 'engaged' | 'unengaged' | 'unknown';
  activity: 'none' | 'human-input' | 'assistant-progress' | 'tool-activity';
  content: 'none' | 'buffered' | 'available' | 'suppressed';
  lifecycle: CursorLifecycleState | 'none';
  delivery: 'none' | 'reserved' | 'committed' | 'uncertain';
  health: 'healthy' | 'blocked' | 'stale' | 'error' | 'unknown';
}

export interface CursorLifecycleEvent {
  turnId: string;
  terminalFrameIndex: number;
  lifecycle: Exclude<CursorLifecycleState, 'pending'>;
  finalEntryKey: string | null;
  contentPreviouslyObservable: boolean;
}

export interface CursorDigestEvidence {
  projection: CursorProjection;
  continuity: 'new' | 'verified';
  status: ObservationStatus;
  lifecycleEvents: CursorLifecycleEvent[];
  bufferedFromFrame: number | null;
  blockingFrame: CursorFrameIssue | null;
}

export interface TranscriptContinuityCheckpoint {
  indexBase: 'zero-based-jsonl-frame-index';
  nextFrameIndex: number;
  prefixBytes: number;
  prefixSha256: string;
  observedSize: number;
  device: number | null;
  inode: number | null;
}

export type ContinuityFailureCode =
  | 'LEGACY_CURSOR_UNVERIFIED'
  | 'INDEX_BASE_MISMATCH'
  | 'FILE_IDENTITY_UNAVAILABLE'
  | 'TRANSCRIPT_SHRANK'
  | 'PREFIX_MISMATCH'
  | 'TRANSCRIPT_REPLACED'
  | 'ROTATION_UNSUPPORTED';

export type ContinuityResult =
  | { status: 'new'; fromFrameIndex: 0 }
  | { status: 'verified'; fromFrameIndex: number }
  | {
      status: 'blocked';
      code: ContinuityFailureCode;
      message: string;
      checkpoint: TranscriptContinuityCheckpoint | null;
    };

export interface LegacyCursorStateMarker {
  runtime: 'cursor';
  sessionId: string;
  legacyLastRecordIndex: number;
  transcriptPath?: string;
  recordedCwd?: string | null;
  lastReadAt?: string;
  backupPath: string;
  migrationStatus: 'marker-written' | 'legacy-removed' | 'complete';
  createdAt: string;
}

export interface CursorTurnReconciliation {
  turnId: string;
  fromFrameIndex: number;
  observedThroughFrame: number;
  deliveredEntryKeys: string[];
  /** Content hashes let a rewritten open-turn frame be delivered again. */
  deliveredEntryHashes?: Record<string, string>;
  assistantEntryKeys: string[];
  humanRecordIndexes: number[];
  toolRecordIndexes: number[];
  hasHumanInput: boolean;
  hasAutomaticControlInput: boolean;
  lifecycle: CursorLifecycleState;
}

export interface CursorStabilityCandidate {
  turnId: string;
  fromFrameIndex: number;
  throughFrameIndex: number;
  entryKeys: string[];
  prefixBytes: number;
  prefixSha256: string;
  firstObservedAt: string;
  confirmAfter: string;
  confirmedAt: string | null;
}

export interface CursorCandidateObservation {
  turnId: string;
  fromFrameIndex: number;
  throughFrameIndex: number;
  entryKeys: string[];
  prefixBytes: number;
  prefixSha256: string;
  observedAt: string;
}

export interface PendingCursorDelivery {
  deliveryId: string;
  canonicalCwd: string;
  transcriptPath: string;
  expectedNextFrameIndex: number;
  expectedCheckpoint: TranscriptContinuityCheckpoint;
  reservedThroughFrameIndex: number;
  entryKeys: string[];
  entryHashes?: Record<string, string>;
  intendedCheckpoint: TranscriptContinuityCheckpoint;
  reservedByPid: number;
  reservedAt: string;
}

export interface CursorSessionStateEntry {
  runtime: 'cursor';
  sessionId: string;
  indexBase: 'zero-based-jsonl-frame-index';
  /** First unconsumed frame; retained under the shared display field name. */
  lastRecordIndex: number;
  canonicalCwd: string;
  transcriptPath: string;
  continuity: TranscriptContinuityCheckpoint;
  lastStatus: ObservationStatus;
  openTurn: CursorTurnReconciliation | null;
  stabilityCandidate: CursorStabilityCandidate | null;
  pendingDelivery: PendingCursorDelivery | null;
}

export interface CursorObserverStateV2 {
  schemaVersion: 2;
  sessions: Record<string, CursorSessionStateEntry>;
  legacyUnverified: Record<string, LegacyCursorStateMarker>;
}

export type CursorStateMutator = (
  state: CursorObserverStateV2,
) => CursorObserverStateV2 | void;

export interface TranscriptIdentityEvidence {
  runtime: Runtime;
  sessionId: string;
  transcriptPath: string;
  recordedCwd: string | null;
  mtime: number;
  size: number;
}

export interface NewerSessionCandidateEvent {
  type: 'newer-session-candidate';
  watched: TranscriptIdentityEvidence;
  candidate: TranscriptIdentityEvidence;
  message: string;
}

export interface RuntimeCandidateSet {
  runtime: Runtime;
  candidates: TranscriptCandidate[];
}

export interface RankOptions {
  tieWindowSec?: number;
  gitWorktrees?: string[];
  globalRecentProvider?: () => TranscriptCandidate[];
}

export interface RankMatchResult {
  winner: TranscriptCandidate & { active: boolean };
  tier: RankTier;
  ties: TranscriptCandidate[];
  fallbacks: TranscriptCandidate[];
  candidates?: never;
  sisters?: never;
  globalRecent?: never;
  noMatch?: false;
  unengagedOnly?: false;
}

export interface RankNoMatchResult {
  winner: null;
  noMatch: true;
  sisters: string[];
  globalRecent: TranscriptCandidate[];
  tier?: never;
  ties?: never;
  fallbacks?: never;
  candidates?: never;
  unengagedOnly?: false;
}

export interface RankUnengagedOnlyResult {
  winner: null;
  unengagedOnly: true;
  tier: RankTier;
  candidates: TranscriptCandidate[];
  message: string;
  sisters?: never;
  globalRecent?: never;
  ties?: never;
  fallbacks?: never;
  noMatch?: false;
}

export type RankResult =
  | RankMatchResult
  | RankNoMatchResult
  | RankUnengagedOnlyResult;

export interface DigestRange {
  indexBase: 'zero-based-jsonl-record-index';
  fromIndex: number;
  toIndex: number;
  nextIndex: number;
  totalRecords: number;
  renderedFromIndex: number | null;
  renderedToIndex: number | null;
  newRecords: number;
}

export interface DigestRecoveryPointer {
  transcriptPath: string;
  indexBase: 'zero-based-jsonl-record-index';
  recordIndex: number;
}

export interface DigestAccounting {
  indexBase: 'zero-based-jsonl-record-index';
  raw: {
    fromIndex: number;
    toIndex: number;
    count: number;
    nextIndex: number;
    totalRecords: number;
  };
  rendered: {
    count: number;
    fromIndex: number | null;
    toIndex: number | null;
    /**
     * Ask-user question/answer entries among the rendered entries. These are
     * tool calls by transport but human decision content by substance, so they
     * render regardless of the tool filters and are counted here rather than
     * under `filtered`.
     */
    askUserEntries: number;
  };
  filtered: {
    toolCalls: number;
    toolResults: number;
    commandMessages: number;
    bootstrapRecords: number;
    bootstrapMessages: number;
    metadataRecords: number;
    tailSliceEntries: number;
  };
  recovery: {
    omittedUserMessages: DigestRecoveryPointer[];
  };
  autoLargeDigest: {
    thresholdChars: number;
    retainedTurnGroups: number;
    originalRenderedMessages: number;
    retainedRenderedMessages: number;
    omittedRenderedMessages: number;
  } | null;
}

export interface DigestFilters {
  includeToolCalls: boolean;
  includeToolResults: boolean;
  includeCommandMessages: boolean;
}

export interface BuildDigestOptions {
  fromIndex?: number;
  mode?: DigestMode;
  includeToolCalls?: boolean;
  includeToolResults?: boolean;
  includeCommandMessages?: boolean;
  maxTurns?: number;
  maxBytes?: number;
  sessionId?: string;
  recordedCwd?: string | null;
  matchedTier?: RankTier | null;
  widenedFrom?: string | null;
  active?: boolean;
  fallbacks?: TranscriptCandidate[];
  warnings?: string[];
}

export interface Digest {
  schemaVersion: 1;
  runtime: Runtime;
  sessionId: string;
  transcriptPath: string;
  recordedCwd: string | null;
  matchedTier: RankTier | null;
  widenedFrom: string | null;
  active: boolean;
  engagement: TranscriptClassification;
  mode: DigestMode;
  range: DigestRange;
  accounting: DigestAccounting;
  entries: DigestEntry[];
  filters: DigestFilters;
  warnings: string[];
  fallbacks: TranscriptCandidate[];
}

export interface CursorDigestRangeV2 {
  indexBase: 'zero-based-jsonl-frame-index';
  fromIndex: number;
  toIndex: number | null;
  nextIndex: number;
  totalFrames: number;
  renderedFromIndex: number | null;
  renderedToIndex: number | null;
  newFrames: number;
}

export interface CursorRecoveryPointerV2 {
  transcriptPath: string;
  indexBase: 'zero-based-jsonl-frame-index';
  frameIndex: number;
  entryKey: string;
}

export interface CursorDigestAccountingV2 {
  indexBase: 'zero-based-jsonl-frame-index';
  raw: {
    fromIndex: number;
    toIndex: number | null;
    count: number;
    nextIndex: number;
    totalFrames: number;
  };
  rendered: {
    count: number;
    fromIndex: number | null;
    toIndex: number | null;
  };
  filtered: {
    toolCalls: number;
    automaticControls: number;
    emptyOrNoOp: number;
    metadataFrames: number;
    unstableContent: number;
  };
  buffered: {
    fromIndex: number | null;
    count: number;
    reason: 'partial' | 'malformed' | 'stability-wait' | null;
  };
  recovery: {
    omittedUserMessages: CursorRecoveryPointerV2[];
    omittedAssistantEntries: CursorRecoveryPointerV2[];
  };
}

export interface CursorDigestEntryV2 extends Omit<
  DigestEntry,
  'recordIndex' | 'sourceRecordIndex'
> {
  /** Delivery frame under the declared frame-index base. */
  recordIndex: number;
  /** Original content frame retained when delivery is gated by later evidence. */
  sourceFrameIndex: number;
  entryKey: string;
  turnId: string;
  /** User-delimited presentation group; lifecycle identity remains `turnId`. */
  renderTurnId?: string;
  /**
   * `terminal-incomplete` marks content from a turn that ended aborted,
   * errored, or cancelled. Only ask-user questions reach the digest that way:
   * the question explains what the turn was waiting on, while the rest of the
   * turn's content stays suppressed. It is deliberately distinct from
   * `completed`, which this schema reserves for a genuine terminal success.
   */
  availability: 'pending-lifecycle' | 'completed' | 'terminal-incomplete';
}

export interface CursorDigestV2 extends Omit<
  Digest,
  'schemaVersion' | 'range' | 'accounting' | 'entries'
> {
  schemaVersion: 2;
  range: CursorDigestRangeV2;
  accounting: CursorDigestAccountingV2;
  entries: CursorDigestEntryV2[];
  cursorEvidence: CursorDigestEvidence;
}

export type SessionDigest = Digest | CursorDigestV2;

export type CursorBuildDigestOptions = BuildDigestOptions & {
  cursorProjection: CursorProjection;
  cursorIdentity: CursorIdentityEvidence;
  cursorScan: CursorTranscriptScan;
  cursorAnalysis: CursorTranscriptAnalysis;
  cursorState: CursorSessionStateEntry | null;
  cursorContinuity: 'new' | 'verified';
};

export interface SessionStateEntry {
  runtime: Runtime;
  sessionId: string;
  lastRecordIndex: number;
  lastTotalRecords: number;
  lastReadAt?: string;
  transcriptPath?: string;
  recordedCwd?: string | null;
  watchedByPid?: number | null;
  [key: string]: unknown;
}

export interface SessionObserverState {
  schemaVersion: number;
  sessions: Record<string, SessionStateEntry>;
}

export interface MarkReadInput {
  lastRecordIndex: number;
  lastTotalRecords: number;
  transcriptPath: string;
  recordedCwd?: string | null;
}

export type StateMutator = (
  state: SessionObserverState,
) => SessionObserverState | void;

export interface WatchTargetRecord {
  key: string;
  runtime: Runtime;
  sessionId: string;
  transcriptPath: string;
  cwd: string | null;
  recordCount: number | null;
  baselineRecordIndex: number | null;
  engagementStatus: EngagementStatus | null;
  lockedAt: string;
}

export interface WatchTargetRecordV2 extends WatchTargetRecord {
  runtime: 'cursor';
  indexBase: 'zero-based-jsonl-frame-index';
  canonicalTranscriptPath: string;
  observationCursor: number;
  bufferedFromFrame: number | null;
  continuity: TranscriptContinuityCheckpoint;
  pendingCandidateDeadline: string | null;
  lastStatus: ObservationStatus;
  continuityState: 'verified' | 'blocked';
  ownerPid: number;
}

export type DurableWatchTargetRecord = WatchTargetRecord | WatchTargetRecordV2;

export interface WatcherRecord {
  pid: number;
  runtime: WatchRuntimeSelection | string;
  requestedRuntime: WatchRuntimeSelection | string;
  cwd: string;
  session: string | null;
  startedAt: string;
  pollSec: number | null;
  debounceSec: number | null;
  maxPendingSec: number | null;
  heartbeatSec: number | null;
  staleAfterSec: number | null;
  lastPollAt: string | null;
  lastEventAt: string | null;
  eventCount: number;
  resolvedRuntime: Runtime | null;
  sessionId: string | null;
  transcriptPath: string | null;
  targets: DurableWatchTargetRecord[];
  lastError: { at: string; message: string } | null;
  [key: string]: unknown;
}

export interface WatchState {
  schemaVersion: number;
  active: WatcherRecord | null;
  watchers: WatcherRecord[];
}

export interface StartWatcherOptions {
  runtime?: WatchRuntimeSelection | string;
  cwd?: string;
  pid?: number;
  startedAt?: string | Date;
  session?: string | null;
  pollSec?: number | null;
  debounceSec?: number | null;
  maxPendingSec?: number | null;
  heartbeatSec?: number | null;
  staleAfterSec?: number | null;
}

export interface WatcherTargetInput {
  runtime: Runtime;
  sessionId: string;
  transcriptPath: string;
  recordedCwd?: string | null;
  recordCount?: number | null;
  baselineRecordIndex?: number | null;
  engagementStatus?: EngagementStatus | null;
  lockedAt?: string | Date;
  indexBase?: 'zero-based-jsonl-frame-index';
  canonicalTranscriptPath?: string;
  observationCursor?: number;
  bufferedFromFrame?: number | null;
  continuity?: TranscriptContinuityCheckpoint;
  pendingCandidateDeadline?: string | Date | null;
  lastStatus?: ObservationStatus;
  continuityState?: 'verified' | 'blocked';
}

export interface CursorWatchTargetTransition {
  observationCursor: number;
  recordCount?: number;
  bufferedFromFrame: number | null;
  continuity: TranscriptContinuityCheckpoint;
  pendingCandidateDeadline: string | Date | null;
  lastStatus: ObservationStatus;
  continuityState: 'verified' | 'blocked';
}

export type CursorWatchTargetCasResult =
  | { status: 'updated'; target: WatchTargetRecordV2 }
  | { status: 'stale'; target: WatchTargetRecordV2 }
  | { status: 'not-owner' }
  | { status: 'not-found' };

export interface WatchControlFile {
  directive: WatchControlDirective;
  issuedAt: string;
  pid?: number;
}

export interface WatchLoopArgs {
  runtime?: WatchRuntimeSelection | string;
  cwd?: string;
  cwdProvided?: boolean;
  json?: boolean;
  session?: string;
  snippet?: string;
  includeTools?: boolean;
  includeToolResults?: boolean;
  includeCommandMessages?: boolean;
  maxTurns?: number;
  maxBytes?: number;
  debounceSec?: number;
  pollSec?: number;
  maxPendingSec?: number;
  maxRuntimeMin?: number;
  heartbeatSec?: number;
  quietEmpty?: boolean;
  strictBaseline?: boolean;
  eventLog?: string;
  catchUpFirst?: boolean;
  suppressWatchedWarningPid?: number;
  [key: string]: unknown;
}

export interface ObserveArgs extends WatchLoopArgs {
  cwd: string;
  runtime?: RuntimeSelection | string;
}

export interface WatchLoopDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<unknown>;
  stat?: (path: string) => Promise<{ mtimeMs: number; size: number }>;
  writeStdout?: (chunk: string) => boolean | number | void | Promise<unknown>;
  pid?: number;
  handleSignals?: boolean;
  onCursorScan?: () => void;
}

export interface CliArgs extends WatchLoopArgs {
  subcommand?: string;
  stateOp?: string;
  watchCtlOp?: string;
  runtime: WatchRuntimeSelection | string;
  cwd: string;
  cwdProvided: boolean;
  json: boolean;
  includeTools: boolean;
  includeToolResults: boolean;
  includeCommandMessages: boolean;
  debug: boolean;
  markRead: boolean;
  watch: boolean;
  untilStopped: boolean;
  interactive: boolean;
  pid?: number;
  help: boolean;
}

export interface PinnedSession {
  runtime: Runtime;
  sessionId: string;
}

export type PinnedSessionParseResult = PinnedSession | { error: string } | null;

export type ObserveFailureKind =
  | 'noMatch'
  | 'ambiguousRuntime'
  | 'unengagedOnly'
  | 'ties'
  | 'identityBlocked'
  | 'continuityBlocked'
  | 'ownerConflict'
  | 'error';

export interface ObserveFailure {
  ok: false;
  kind: ObserveFailureKind;
  exitCode: number;
  message: string;
  payload: ObserveFailurePayload;
}

export interface ObserveFailurePayload extends JsonObject {
  noMatch?: true;
  ambiguousRuntime?: true;
  unengagedOnly?: true;
  ties?: true;
  runtime?: Runtime | string;
  cwd?: string;
  snippet?: string;
  tier?: RankTier;
  runtimes?: Runtime[];
  candidates?: TranscriptCandidate[];
  sisters?: string[];
  globalRecent?: TranscriptCandidate[];
  message?: string;
  identityBlocked?: true;
  continuityBlocked?: true;
  ownerConflict?: true;
  code?: string;
  reasons?: string[];
}

export interface LegacyObserveSuccess {
  ok: true;
  runtime: Exclude<Runtime, 'cursor'>;
  candidate: TranscriptCandidate;
  rankResult?: RankResult;
  digest: Digest;
  sessionState: SessionStateEntry | null;
  fromIndex: number;
  markedRead: boolean;
}

export interface CursorDeliveryUncertain {
  status: 'delivery-uncertain';
  deliveryId: string;
  entryKeys: string[];
  expectedNextFrameIndex: number;
  reservedThroughFrameIndex: number;
}

export interface CursorDeliveryHandle {
  deliveryId: string;
  sessionId: string;
  ownerPid: number;
  entryKeys: string[];
  commit(): Promise<'committed' | 'stale'>;
  abandon(options?: {
    deliveryUncertain?: boolean;
  }): Promise<'abandoned' | 'stale' | 'owner-conflict' | 'delivery-uncertain'>;
}

export interface CursorObserveSuccess {
  ok: true;
  runtime: 'cursor';
  candidate: TranscriptCandidate;
  rankResult?: RankResult;
  digest: CursorDigestV2;
  sessionState: null;
  cursorState: CursorSessionStateEntry;
  fromIndex: number;
  markedRead: false;
  delivery: CursorDeliveryHandle | null;
  deliveryUncertain: CursorDeliveryUncertain | null;
}

export interface ObserveDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<unknown>;
  ownerPid?: number;
  onCursorScan?: () => void;
}

export type ObserveSuccess = LegacyObserveSuccess;

export type ObserveOutcome =
  | LegacyObserveSuccess
  | CursorObserveSuccess
  | ObserveFailure;
export type CursorObserveOutcome = CursorObserveSuccess | ObserveFailure;
export type LegacyObserveOutcome = LegacyObserveSuccess | ObserveFailure;

export interface ObservedRuntimeResolution {
  runtime?: Runtime;
  reason?: string;
  sessionId?: string;
  ambiguous?: true;
  noMatch?: true;
  runtimes?: Runtime[];
  candidates?: Record<string, TranscriptCandidate[]>;
}

export type SelfIdentitySource =
  | 'explicit-self'
  | 'harness-environment'
  | 'same-cwd-transcript';

export interface SelfIdentity {
  runtime: Runtime;
  session: string;
  transcript: string;
  source: SelfIdentitySource;
}

export interface SelfIdentitySignal {
  runtime: Runtime;
  sessionId?: string;
}

export type SelfIdentityResolution =
  | { identity: SelfIdentity }
  | {
      ambiguous: true;
      runtime?: Runtime;
      candidates: TranscriptCandidate[];
      signals: SelfIdentitySignal[];
    }
  | { noMatch: true; runtime?: Runtime; candidates?: TranscriptCandidate[] };

export interface DuplicateWatchTargetError extends Error {
  code?: 'DUPLICATE_WATCH_TARGET';
  conflictPid?: number;
}

export interface WatchLoopError extends Error {
  watchErrorEventEmitted?: boolean;
}
