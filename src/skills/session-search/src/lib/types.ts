/**
 * Shared types for session-search.
 *
 * See the project design (Data Models, Source adapters) for the contract these
 * types encode. Runtime values never live here: this module is type-only.
 */
import type { JsonObject, Runtime } from './runtimes.js';

export type { JsonObject, Runtime };

/** Search tiers in cost order. `deep` is the tool-output rung. */
export type Tier = 'history' | 'meta' | 'content' | 'deep';

/** Role of one classified text unit taken from a transcript record. */
export type TextUnitRole = 'user' | 'assistant' | 'context' | 'tool';

/** Role reported for an emitted snippet. Title hits come from the meta tier. */
export type SnippetRole = TextUnitRole | 'title';

/** Availability of one runtime's session store. */
export type SourceStatus = 'ok' | 'absent' | 'degraded';

/** Fully resolved CLI options. Times are epoch milliseconds. */
export interface SearchOptions {
  patterns: string[];
  literal: boolean;
  since: number | null;
  until: number | null;
  /** Normalized absolute paths: resolved, `~` expanded, no trailing slash. */
  cwdHints: string[];
  runtimes: Runtime[];
  /** Cheap and content tiers to run; the deep rung is governed by `deep`. */
  tiers: Tier[];
  /** Whether the deep (tool-output) rung may run when everything else is empty. */
  deep: boolean;
  includeTools: boolean;
  allowLargeScan: boolean;
  largeScanBytes: number;
  maxLineBytes: number;
  limit: number;
  deadlineMs: number | null;
  json: boolean;
}

/** Resolved optional accelerator paths (`null` when unavailable). */
export interface ToolPaths {
  rg: string | null;
  sqlite3: string | null;
}

/** Tool probe result: resolved paths plus diagnostic notes. */
export interface ToolProbe extends ToolPaths {
  notes: string[];
}

/** Existence-checked store locations for one runtime. */
export interface StoreRoots {
  runtime: Runtime;
  /** Primary store root reported in `sources[].root`. */
  root: string;
  /** Whether the primary root exists. */
  exists: boolean;
  /**
   * Named auxiliary locations (history file, index file, sqlite database,
   * archived directory). A value is `null` when the location does not exist.
   */
  paths: Record<string, string | null>;
}

/** One enumerated transcript file (stat-only data plus lazily read headers). */
export interface SessionFile {
  runtime: Runtime;
  path: string;
  sessionId: string;
  /** Parent session for subagent/child transcripts, else `null`. */
  parentSessionId: string | null;
  isSubagent: boolean;
  archived: boolean;
  mtimeMs: number;
  size: number;
  /** Encoded project directory name (Claude/Cursor slug), when applicable. */
  projectSlug?: string | null;
  /** Recorded cwd when already known without a transcript read. */
  cwd?: string | null;
  /** Session start when already known (e.g. from a metadata index). */
  createdAtMs?: number | null;
  /** Codex child rollouts: records below this ordinal are inherited history. */
  subagentHistoryStartOrdinal?: number | null;
  /**
   * True when the session was started by an agent or automation rather than
   * a person (e.g. a Codex `source` with a `subagent` key). Its user-role
   * text is never counted as user-typed.
   */
  agentAuthored?: boolean;
}

/** Bounded-read session facts used for scoping and presentation. */
export interface SessionInfo {
  cwd: string | null;
  title: string | null;
  firstPrompt: string | null;
  /** ISO timestamp, when known. */
  startedAt: string | null;
}

/** One role-tagged piece of text extracted from a transcript record. */
export interface TextUnit {
  role: TextUnitRole;
  text: string;
}

/** Result of matching one text against the compiled patterns. */
export interface MatchResult {
  /** The original pattern strings that matched, in pattern order. */
  patterns: string[];
  firstIndex: number;
  firstLength: number;
}

/** Compiled agent-supplied patterns. */
export interface Matcher {
  patterns: string[];
  literal: boolean;
  match(text: string): MatchResult | null;
}

/** One match produced by any tier. Text is unredacted until output. */
export interface Hit {
  runtime: Runtime;
  sessionId: string;
  tier: Tier;
  role: SnippetRole;
  /** True for user-typed text (history tier or genuine user role). */
  userTyped: boolean;
  patterns: string[];
  /**
   * Full, unredacted text unit. Emit it only through `snippetFor`, which
   * redacts the whole unit before windowing.
   */
  text: string;
  /**
   * Position of the first match in the UNREDACTED `text`. Redaction changes
   * string length, so never reuse these indices on redacted text. Build
   * snippets with `snippetFor(hit.text, matcher, hit)`, which re-matches after
   * redacting and uses these indices only to locate a redacted hit.
   */
  firstIndex: number;
  firstLength: number;
  transcriptPath: string | null;
  cwd: string | null;
  timestampMs: number | null;
  /** Set when the hit came from a subagent/child transcript. */
  fromSubagent?: boolean;
  /** Subagent hits: the parent session they roll up to. */
  parentSessionId?: string | null;
}

export interface Snippet {
  role: SnippetRole;
  tier: Tier;
  text: string;
  via?: 'subagent';
}

/** One ranked session in the CLI output. */
export interface SessionHit {
  rank: number;
  score: number;
  runtime: Runtime;
  sessionId: string;
  archived: boolean;
  isSubagent: boolean;
  cwd: string | null;
  title: string | null;
  /** Redacted, at most 160 characters. */
  firstPrompt: string | null;
  startedAt: string | null;
  /** ISO timestamp. */
  lastActivity: string;
  matchedPatterns: string[];
  matchedTiers: Tier[];
  snippets: Snippet[];
  transcriptPath: string | null;
  open: { command: string | null; hint: string };
}

export interface SourceReport {
  runtime: Runtime;
  root: string;
  status: SourceStatus;
  sessions: number;
  note?: string;
}

export interface NeedsConfirmation {
  reason: 'large-scan';
  estimatedBytes: number;
  fileCount: number;
  rerunFlag: '--allow-large-scan';
}

export interface SearchDiagnostics {
  filesScanned: number;
  bytesScanned: number;
  linesSkippedOversize: number;
  parseErrors: number;
  elapsedMs: number;
}

/** CLI JSON output (`--json`). */
export interface SearchResult {
  schema: 'session-search/v1';
  query: {
    patterns: string[];
    literal: boolean;
    since: string | null;
    until: string | null;
    cwdHints: string[];
    runtimes: Runtime[];
  };
  host: { hostname: string; platform: string };
  tools: ToolPaths;
  tiersRun: Tier[];
  widened: boolean;
  needsConfirmation: NeedsConfirmation | null;
  incomplete: boolean;
  sources: SourceReport[];
  results: SessionHit[];
  diagnostics: SearchDiagnostics;
}

/** Per-invocation context handed to every adapter call. */
export interface AdapterContext {
  home: string;
  env: Readonly<Record<string, string | undefined>>;
  options: SearchOptions;
  tools: ToolPaths;
  roots: StoreRoots;
  /** Candidate files after the time window and scope narrowing. */
  files: SessionFile[];
  /** Mark this runtime's source degraded with a diagnostic note. */
  degrade(note: string): void;
}

/** Context for `SourceAdapter.enumerate`, which produces `files` itself. */
export type EnumerateContext = Omit<AdapterContext, 'files'>;

/** One runtime's store layout and record semantics. */
export interface SourceAdapter {
  runtime: Runtime;
  roots(home: string): StoreRoots;
  /**
   * Stat-only enumeration. It produces the candidate list, so it receives the
   * context without `files`.
   */
  enumerate(ctx: EnumerateContext): Promise<SessionFile[]>;
  /** Tier 1: history files. */
  historyHits(ctx: AdapterContext, matcher: Matcher): Promise<Hit[]>;
  /** Tier 2: metadata indexes and title records. */
  metadataHits(ctx: AdapterContext, matcher: Matcher): Promise<Hit[]>;
  /** Bounded read of cwd, title, first prompt, and start time. */
  sessionInfo(file: SessionFile): Promise<SessionInfo>;
  /** Role-tagged text for tiers 3 and 4. */
  classifyRecord(record: JsonObject, includeTools: boolean): TextUnit[];
  /** Resume/open guidance for a session. */
  openHint(
    sessionId: string,
    info: SessionInfo,
    transcriptPath: string | null,
  ): { command: string | null; hint: string };
}
