import type {
  AutomaticControlProvenance,
  DigestEntry,
  DigestEntryOrigin,
  JsonObject,
  Runtime,
} from '../../core/runtimes.js';

export type { AutomaticControlProvenance, DigestEntryOrigin };

export type SessionObserverRuntime = Runtime;
export type RuntimeSelection = Runtime | 'auto';
export type WatchRuntimeSelection = RuntimeSelection | 'both';
export type RankTier = 'A' | 'B' | 'C';
export type EngagementStatus = 'engaged' | 'unengaged' | 'unknown';
export type DigestMode = 'review' | 'catch-up' | 'locate';
export type WatchControlDirective = 'flush' | 'pause' | 'resume' | 'stop';

export interface TranscriptClassification {
  status: EngagementStatus;
  engaged: boolean;
  recordCount: number | null;
  genuineUserMessages: number;
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
  schemaVersion: number;
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
  targets: WatchTargetRecord[];
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
}

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
}

export interface ObserveSuccess {
  ok: true;
  runtime: Runtime;
  candidate: TranscriptCandidate;
  rankResult?: RankResult;
  digest: Digest;
  sessionState: SessionStateEntry | null;
  fromIndex: number;
  markedRead: boolean;
}

export type ObserveOutcome = ObserveSuccess | ObserveFailure;

export interface ObservedRuntimeResolution {
  runtime?: Runtime;
  reason?: string;
  sessionId?: string;
  ambiguous?: true;
  noMatch?: true;
  runtimes?: Runtime[];
  candidates?: Record<string, TranscriptCandidate[]>;
}

export interface DuplicateWatchTargetError extends Error {
  code?: 'DUPLICATE_WATCH_TARGET';
  conflictPid?: number;
}

export interface WatchLoopError extends Error {
  watchErrorEventEmitted?: boolean;
}
