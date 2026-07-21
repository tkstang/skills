---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-20
oat_generated: false
oat_template: false
---

# Design: cursor-collaboration-reliability

## Overview

This design implements the evidence-gated correctness-first direction already
confirmed in discovery. Cursor transcript handling gains a framed read model,
an explicit turn analyzer, and two projections over the same evidence:

- **Observation projection:** makes structurally prefix-stable substantive
  content visible after two observations separated by the configured stability
  interval, while reporting lifecycle as pending.
- **Completion projection:** preserves the stricter terminal-success boundary
  used by collaboration continuation and other completion-sensitive consumers.

The projections deliberately use separate cursors. Ordinary Session Observer
state owns the content-observation cursor; a collaboration lease owns its
private completion cursor. Seeing content never advances or authorizes the
completion path. A terminal arriving later changes lifecycle state and may make
the final assistant record completion-eligible, but it does not repeat prose
already delivered through the observation projection.

Cursor continuity becomes versioned and fail-visible. Before a persisted cursor
is reused, the observer verifies the exact runtime, project/cwd, session,
canonical transcript path, index base, and the raw transcript prefix through
the checkpoint. Malformed or partial frames retain physical positions instead
of collapsing parsed-array indexes. A path mismatch, shrink, rewrite,
replacement, unsupported rotation, or legacy unverified Cursor offset blocks
consumption until the operator explicitly resets and replays that session.

Reliable observation is the required shipping boundary. Transcript-store
expansion and stronger wake behavior remain conditional evidence phases. A
future scheduled observer, if tested, is deterministic and private-cursor; it
is not a periodically invoked LLM and is not called a wake tier until a live
runtime proves delivery into the same pinned parent session.

## Architecture

### System Context

The change stays inside the existing transcript and collaboration layers. The
canonical TypeScript transcript source continues to generate the standalone
Session Observer and Export Session Transcript runtime copies. Authored
Session Observer Collaboration modules remain a separate dependency-free
JavaScript boundary and consume the versioned digest/completion contract.

**Key Components:**

- **Cursor Framed Transcript Reader:** Reads the Cursor JSONL byte stream into
  closed, partial, malformed, and blank physical frames without losing source
  positions.
- **Cursor Turn Analyzer:** Classifies human activity, automatic controls,
  assistant content, tool activity, terminal outcomes, and turn ranges once at
  the provider boundary.
- **Exact Identity Resolver:** Corroborates canonical cwd, session, transcript
  path, and evidence strength before allowing stateful use.
- **Continuity Guard and Cursor State v2:** Verifies append-only prefix
  continuity and persists the Cursor observation cursor in an isolated,
  versioned state file.
- **Digest and Status Projector:** Produces observation or completion views,
  exact accounting, lifecycle events, and independent state facets.
- **Foreground Watch Integration:** Applies baseline, ownership, debounce,
  heartbeat, and cleanup semantics to the new Cursor evidence.
- **Collaboration Completion Adapter:** Uses a private terminal-only cursor,
  exact lease/CAS checks, and a versioned synthetic wake range.
- **Evidence and Capability Record:** Combines fixtures, automated tests, and
  sanitized live probes into an explicit support matrix.

### Component Diagram

```text
Cursor agent-transcript JSONL
            |
            v
  Framed Transcript Reader -----> Continuity Guard <---- Cursor State v2
            |                            |
            v                            |
      Cursor Turn Analyzer <-------------+
            |
            +-------------------------------+
            |                               |
            v                               v
 Observation Projection              Completion Projection
 content cursor + status             terminal-success turns
            |                               |
            v                               v
 catch-up / foreground watch        collaboration private lease cursor
            |                               |
            +--------------+----------------+
                           v
              sanitized evidence matrix
```

### Data Flow

#### Catch-Up and Foreground Observation

1. Resolve the requested Cursor candidate from the canonical cwd and optional
   exact session pin. Record the evidence used; weak fallback candidates can be
   displayed but cannot inherit state.
2. Canonicalize the selected transcript path and verify that auto-discovered
   paths remain under the supported Cursor project root.
3. Stream physical JSONL frames through the turn accumulator, retaining frame
   index, byte range, closed state, parse state, and raw prefix boundaries
   without holding a second full transcript copy. Do not consume past the first
   blocking malformed or partial frame.
4. Compare the identity and prefix through the persisted checkpoint. If this
   cannot be verified, return a continuity-blocked result and do not mutate the
   cursor.
5. A newline-terminated parseable assistant text frame is only a stability
   candidate. For an open turn, wait one configured stability/debounce interval
   and rescan. Verify the raw prefix only through each candidate's byte
   boundary; later appended frames do not reset that candidate's stability. Any
   candidate whose exact bounded prefix still verifies becomes structurally
   stable. Render every new stable substantive record in source order;
   tool-only, empty, automatic, partial, malformed, and unstable activity
   remains accounted but not rendered as peer prose.
6. If the same read already contains a terminal, reconcile it before
   projection: success renders only the final substantive assistant record for
   a previously unseen completed turn and adds frame-based recovery pointers
   for every earlier substantive assistant record in that turn; a non-success
   terminal suppresses unobserved assistant prose and emits a diagnostic.
7. Reserve the exact range and entry keys with an expected-checkpoint CAS before
   output. Render the digest with independent activity, content, lifecycle,
   buffering, continuity, and health fields. After stdout succeeds, atomically
   commit the next observation frame/checkpoint and clear the reservation. A
   crash-stranded reservation is reported as delivery-uncertain and is
   reconstructible from the transcript without storing prose.
8. A foreground watcher repeats the flow after file metadata changes or when a
   pending candidate reaches its one scheduled stability deadline. Other
   unchanged polls remain stat-only. Heartbeats report read health and
   pending/buffered state; they never count as content or completion.

#### Later Terminal Reconciliation

1. A prior watch delta may have delivered content with lifecycle `pending`.
2. When a later `turn_ended` frame arrives, the observation cursor begins at
   the terminal frame; earlier source content is already before the cursor.
3. `success` emits a lifecycle event referencing the final source entry key but
   does not repeat text whose key is in persisted reconciliation state. A
   failure status emits a diagnostic that previously visible pending content
   remains historical observation and never became a successful completion; it
   is not silently retracted or reclassified as successful.
4. The completion projection independently retains the open turn start until a
   terminal arrives, then exposes exactly one terminal-successful substantive
   range to its private consumer.

#### Collaboration Completion and Wake

1. The acting runtime validates its lifecycle event and exact owner lease.
2. The adapter reads the pinned peer transcript using the completion projection
   and the lease's index base and private completion cursor.
3. Only a contiguous terminal-successful substantive range can pass the
   completion selector. Pending content and non-success outcomes remain
   non-triggering even if ordinary observation already rendered their prose.
4. A successful lease CAS advances the private completion cursor and spends one
   bounded continuation. Metadata/no-op ranges may advance only the private safe
   cursor without spending budget.
5. The adapter emits one synthetic envelope containing lease provenance,
   exact pin, index base, and range. It never writes a transcript or invokes a
   peer directly.

#### Continuity Failure and Recovery

1. If identity, canonical path, index base, file prefix, or cursor bounds do not
   match, return `continuity-blocked` with a reason and the last verified
   checkpoint.
2. Leave both cursor and checkpoint unchanged. Foreground watch remains alive
   but reports health `blocked`; a one-shot command exits nonzero.
3. The operator inspects the candidate and runs the existing session-scoped
   state reset command when replay from the beginning is intended.
4. The first post-reset read creates a fresh v2 checkpoint and explicitly
   replays the selected transcript. There is no automatic jump to the tail.

## Component Design

### Cursor Framed Transcript Reader

**Purpose:** Preserve stable source positions and enough local structural
evidence to detect transcript mutation.

**Responsibilities:**

- Read Cursor transcript bytes with Node standard library APIs.
- Split every physical line into a frame, including blank, malformed, and
  non-newline-terminated trailing frames.
- Assign zero-based frame indexes that do not collapse when JSON parsing fails.
- Parse closed nonblank frames without allowing a malformed frame to shift
  later positions.
- Produce a streaming SHA-256 prefix checkpoint through the safe consumption
  byte boundary; never expose raw bytes in diagnostics or evidence artifacts.
- Return file metadata for change detection and diagnostic purposes.

**Interfaces:**

```typescript
export type CursorFrameParseState =
  | 'parsed'
  | 'blank'
  | 'malformed'
  | 'partial';

export interface CursorTranscriptFrame {
  frameIndex: number;
  byteStart: number;
  byteEnd: number;
  closed: boolean;
  parseState: CursorFrameParseState;
  record: JsonObject | null;
}

export interface CursorFrameIssue {
  frameIndex: number;
  byteStart: number;
  byteEnd: number;
  parseState: 'malformed' | 'partial';
}

export interface CursorTranscriptScan {
  indexBase: 'zero-based-jsonl-frame-index';
  totalFrames: number;
  safeThroughFrame: number | null;
  safePrefixBytes: number;
  safePrefixSha256: string;
  verifiedPrefixSha256: string | null;
  file: {
    size: number;
    mtimeMs: number;
    device: number | null;
    inode: number | null;
  };
  blockingFrame: CursorFrameIssue | null;
}

export interface CursorTranscriptScanOptions {
  verifyPrefixBytes?: number;
  onFrame(frame: CursorTranscriptFrame): void | Promise<void>;
}

export function scanCursorTranscript(
  transcriptPath: string,
  options: CursorTranscriptScanOptions,
): Promise<CursorTranscriptScan>;
```

**Dependencies:**

- Node `fs`, `path`, and `crypto` APIs.
- Existing JSON object/runtime types.

**Design Decisions:**

- A frame is structurally closed only when newline-terminated. A parseable but
  unterminated tail remains `partial` until closed or followed by more bytes.
- Consumption stops before the first malformed or partial frame. This is more
  conservative than the current tolerant parsed-array reader and prevents a
  later repair from changing the meaning of a persisted index.
- `safeThroughFrame` is inclusive and is `null` when no frame is safely
  consumable. `safePrefixBytes` is always an exact frame boundary.
- When prior state supplies `verifyPrefixBytes`, the same streaming pass
  snapshots `verifiedPrefixSha256` at that byte boundary and continues hashing
  through the new safe boundary. Continuity compares the prior hash with that
  snapshot; comparing it with the longer current-prefix hash would be invalid.
- Frames are delivered to an accumulator callback and then released. The scan
  result contains only counts, hashes, file metadata, and a redacted blocking
  frame summary, so framing does not retain a second transcript-sized array.
- Cursor uses the new frame index base; Claude Code and Codex retain their
  current record index base in this project.

### Cursor Turn Analyzer

**Purpose:** Convert provider-specific frames into one evidence model from which
both user-visible observation and terminal completion are projected.

**Responsibilities:**

- Recognize the measured Cursor baseline: top-level `role`, nested
  `message.content`, tool-use blocks, and top-level `turn_ended` status.
- Mark automatic wake envelopes as synthetic control input, not human
  engagement.
- Group each structural turn from the frame after the prior terminal through the
  next terminal. Genuine user records within that range count as human activity,
  but their queued-versus-new-generation meaning remains unknown unless a future
  measured record field establishes it.
- Classify assistant text as substantive, empty, no-op, automatic
  acknowledgement/status echo, runtime diagnostic, or unsupported shape.
- Produce closed-frame stability candidates and terminal completion candidates
  without duplicating parsing in the collaboration layer.

**Interfaces:**

```typescript
export type CursorLifecycleState =
  | 'pending'
  | 'success'
  | 'aborted'
  | 'error'
  | 'cancelled'
  | 'unknown';

export type CursorContentClassification =
  | 'substantive'
  | 'empty'
  | 'no-op'
  | 'automatic-control'
  | 'runtime-diagnostic'
  | 'unsupported';

export interface CursorContentRecord {
  entryKey: string;
  turnId: string;
  sourceFrameIndex: number;
  blockIndex: number;
  role: 'user' | 'assistant';
  text: string;
  classification: CursorContentClassification;
}

export interface CursorAssistantContentRecord extends CursorContentRecord {
  role: 'assistant';
}

export interface CursorTurnAnalysis {
  turnId: string;
  fromFrameIndex: number;
  observedThroughFrame: number;
  assistantRecords: CursorAssistantContentRecord[];
  humanRecordIndexes: number[];
  toolRecordIndexes: number[];
  lifecycle: CursorLifecycleState;
  terminalFrameIndex: number | null;
  finalSubstantiveEntryKey: string | null;
}

export interface CursorTranscriptAnalysis {
  turns: CursorTurnAnalysis[];
  metadataFrameIndexes: number[];
  blockingFrame: CursorFrameIssue | null;
}

export interface CursorTurnAccumulator {
  onFrame(frame: CursorTranscriptFrame): void;
  finish(scan: CursorTranscriptScan): CursorTranscriptAnalysis;
}

export function createCursorTurnAccumulator(
  identity: CursorIdentityEvidence,
  fromFrameIndex: number,
): CursorTurnAccumulator;
```

**Dependencies:**

- Cursor framed transcript reader.
- Existing automatic-control envelope parser and no-op classification rules.

**Design Decisions:**

- `turnId` is the exact session plus the structural range start immediately
  after the previous terminal. It does not claim a provider generation ID that
  the measured record shape does not contain.
- `entryKey` is scoped to the supplied exact runtime/session/canonical-path
  identity and built from frame and content-block positions. Stability rescans
  and the consumed-prefix guard make in-place reuse fail closed, so no persisted
  content hash is required.
- After one unchanged debounce interval, an open-turn observation delta emits
  every new stable substantive assistant record in source order. The renderer
  may group them, but it cannot advance across and silently discard an earlier
  record.
- If a terminal is present in the same unread range, lifecycle is reconciled
  first. Success selects only the final substantive assistant record;
  non-success suppresses unread assistant prose.
- A closed record is only a candidate. It becomes content-available after two
  scans separated by the configured interval verify the identical raw prefix
  through that candidate's byte boundary using `verifyPrefixBytes`. Growth
  after that boundary is permitted and does not restart the candidate's
  stability interval. The record remains non-completion-eligible until terminal
  success. This is the primary user-review decision in the design.

### Exact Identity Resolver

**Purpose:** Separate candidate discovery from evidence strong enough to own
state.

**Responsibilities:**

- Canonicalize requested cwd before deriving Cursor path variants, retain the
  user-supplied cwd only for display, and canonicalize the transcript path.
- Record how cwd and session identity were established.
- Require an exact session signal from an explicit pin or harness identity for
  lifecycle/automatic work.
- Detect multiple matching transcripts, path aliasing, candidate changes, and
  weak fallback-only matches.
- Keep newer or more recent candidates diagnostic after a pin is established.

**Interfaces:**

```typescript
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
  canonicalCwd: string;
  canonicalTranscriptPath: string;
  cwdEvidence: CursorCwdEvidence[];
  sessionEvidence: CursorSessionEvidence[];
  strength: 'exact' | 'diagnostic' | 'ambiguous';
  reasons: string[];
}

export function resolveCursorIdentity(
  candidate: TranscriptCandidate,
  requestedCwd: string,
  expectedSessionId?: string,
): Promise<CursorIdentityEvidence>;
```

**Dependencies:**

- Existing locate/rank discovery.
- Node `realpath` and path containment checks.

**Design Decisions:**

- A direct encoded project directory is strong candidate evidence but is not
  independently allowed to override an exact session/path mismatch.
- Fallback slug results can support locate/review output, but stateful catch-up,
  watch, and collaboration require `strength: exact`.
- When the store supplies no independent cwd metadata, stateful Cursor work
  requires an explicit or harness session signal in addition to a unique direct
  candidate. A unique/recent transcript-path name alone is not `exact`.
- Symlinked and physical cwd spellings resolve to one canonical identity before
  matching. Tests cover both spellings and reject a symlink that escapes the
  intended project/store boundary.
- Dotted-path and additional store encodings are separate evidence rows, not
  heuristic expansions of this resolver.

### Continuity Guard and Cursor State v2

**Purpose:** Make state reuse auditable and prevent silent reset, replay, or
cross-file cursor inheritance.

**Responsibilities:**

- Validate state schema, exact identity, index base, cursor bounds, and raw
  prefix before building an incremental digest.
- Persist observation cursor, reconciliation metadata, and delivery reservation
  under a Cursor-specific lock/temp/fsync/rename protocol equivalent to the
  existing state store.
- Back up legacy/corrupt state and classify legacy Cursor entries as
  unverified, rather than trusting parsed-record offsets.
- Reserve exact target ownership before catch-up or cursor mutation; remove the
  current observe-then-restore startup race.
- Keep completion-sensitive cursors out of observer state.

**Interfaces:**

```typescript
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

export interface LegacyCursorStateMarker {
  runtime: 'cursor';
  sessionId: string;
  legacyLastRecordIndex: number;
  backupPath: string;
  migrationStatus: 'marker-written' | 'legacy-removed' | 'complete';
  createdAt: string;
}

export interface CursorTurnReconciliation {
  turnId: string;
  fromFrameIndex: number;
  deliveredEntryKeys: string[];
  lifecycle: CursorLifecycleState;
}

export interface PendingCursorDelivery {
  deliveryId: string;
  expectedNextFrameIndex: number;
  reservedThroughFrameIndex: number;
  entryKeys: string[];
  intendedCheckpoint: TranscriptContinuityCheckpoint;
  reservedByPid: number;
  reservedAt: string;
}

export interface CursorSessionStateEntry {
  runtime: 'cursor';
  sessionId: string;
  indexBase: 'zero-based-jsonl-frame-index';
  lastRecordIndex: number;
  canonicalCwd: string;
  transcriptPath: string;
  continuity: TranscriptContinuityCheckpoint;
  lastStatus: ObservationStatus;
  openTurn: CursorTurnReconciliation | null;
  pendingDelivery: PendingCursorDelivery | null;
}

export interface CursorObserverStateV2 {
  schemaVersion: 2;
  sessions: Record<string, CursorSessionStateEntry>;
  legacyUnverified: Record<string, LegacyCursorStateMarker>;
}

export type ContinuityResult =
  | { status: 'new'; fromFrameIndex: 0 }
  | { status: 'verified'; fromFrameIndex: number }
  | {
      status: 'blocked';
      code: ContinuityFailureCode;
      message: string;
      checkpoint: TranscriptContinuityCheckpoint | null;
    };

export function validateCursorContinuity(
  identity: CursorIdentityEvidence,
  scan: CursorTranscriptScan,
  prior: CursorSessionStateEntry | null,
): ContinuityResult;

export function reserveCursorDelivery(input: {
  sessionId: string;
  ownerPid: number;
  expected: TranscriptContinuityCheckpoint;
  pending: PendingCursorDelivery;
}): Promise<'reserved' | 'stale' | 'owner-conflict'>;

export function commitCursorDelivery(input: {
  sessionId: string;
  deliveryId: string;
  nextState: CursorSessionStateEntry;
}): Promise<'committed' | 'stale'>;
```

**Dependencies:**

- Existing atomic observer-state patterns and watch-target ownership lock.
- Cursor identity and framed read results.

**Design Decisions:**

- Cursor v2 state is isolated at `STATE_DIR/cursor-state.json` with its own lock.
  The existing schema-v1 `state.json` remains authoritative for Claude Code and
  Codex, so an older runtime cannot reinterpret a frame cursor as a record
  cursor after downgrade.
- On upgrade, legacy Cursor entries are backed up, removed from `state.json`,
  and recorded only as non-consumable markers in `cursor-state.json` until an
  explicit session reset/replay. The existing CLI `state get/reset/clear`
  composes both stores.
- A Cursor v2 entry keeps `lastRecordIndex` for shared display/types, but its
  declared frame index base defines that field as the first unconsumed frame and
  it must equal `continuity.nextFrameIndex`.
- Prefix SHA-256 is local continuity material, not a durable project-evidence
  value. Diagnostics may report that it mismatched but never print the digest.
- Stateful Cursor observation requires non-null device and inode values on both
  the saved checkpoint and current scan. If either value is unavailable, return
  `FILE_IDENTITY_UNAVAILABLE` without advancing state; stateless diagnostic
  review may continue, and the capability row records stateful continuity as
  unsupported for that platform/filesystem.
- Any device/inode replacement, including the same path with an identical
  prefix, blocks as `TRANSCRIPT_REPLACED`. Prefix equality proves byte
  continuity but not session identity. Cross-path rotation also requires
  explicit recovery.
- Delivery is a CAS reservation followed by stdout and a CAS commit. A crash
  between output and commit cannot provide mathematical exactly-once delivery
  without a consumer acknowledgement, so restart reports
  `delivery-uncertain` and reconstructs the same entry keys. It never silently
  advances past possibly un-emitted content.
- Catch-up-then-watch reserves exact target ownership before observation. A
  duplicate loser performs no state write and never restores a baseline owned
  by another watcher.
- Reset deletes the full Cursor v2 entry or replaces it with a clean frame-zero
  entry; it clears checkpoint, open-turn reconciliation, pending delivery,
  blocked status, and legacy marker rather than merely zeroing two counters.
- State directories and files are created with `0700`/`0600` and existing
  permissive paths are tightened with best-effort `chmod` on POSIX. Permission
  behavior is covered by tests and remains umask/platform-dependent elsewhere.

### Digest and Status Projector

**Purpose:** Preserve exact accounting while exposing the new distinction
between observation and completion.

**Responsibilities:**

- Build schema-v2 digests for either `observation` or
  `confirmed-completion` projection.
- Maintain raw/frame, rendered, filtered, buffered, and recovery accounting.
- Render independent status facets and lifecycle events without repeating
  content.
- Preserve existing non-Cursor behavior and support temporary v1/v2 readers at
  collaboration boundaries.

**Interfaces:**

```typescript
export type CursorProjection =
  | 'observation'
  | 'confirmed-completion';

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
}

export type TranscriptIndexBase =
  | 'zero-based-jsonl-record-index'
  | 'zero-based-jsonl-frame-index';

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

export interface CursorDigestEntryV2
  extends Omit<DigestEntry, 'recordIndex' | 'sourceRecordIndex'> {
  recordIndex: number;
  sourceFrameIndex: number;
  entryKey: string;
  turnId: string;
  availability: 'pending-lifecycle' | 'completed';
}

export interface CursorDigestV2
  extends Omit<Digest, 'schemaVersion' | 'range' | 'accounting' | 'entries'> {
  schemaVersion: 2;
  range: CursorDigestRangeV2;
  accounting: CursorDigestAccountingV2;
  entries: CursorDigestEntryV2[];
  cursorEvidence: CursorDigestEvidence;
}

export type SessionDigest = Digest | CursorDigestV2;

export type CursorBuildDigestOptions = BuildDigestOptions & {
  cursorProjection: CursorProjection;
};
```

Schema v1 remains unchanged for Claude Code, Codex, and compatibility readers.
Cursor schema v2 is a discriminated union rather than silently widening every
v1 invariant. In v2, `fromIndex` is inclusive, `nextIndex` is the first
unconsumed safe frame, `toIndex` is `nextIndex - 1` or `null` for an empty
range, and `newFrames` equals `nextIndex - fromIndex`. `totalFrames` may be
greater than `nextIndex` when a frame is buffered/blocked. Entry `recordIndex`
is the delivery frame under the declared frame index base; `sourceFrameIndex`
identifies the original content frame.

**Dependencies:**

- Existing digest builder/renderers and transcript classifier.
- Cursor turn analysis and continuity result.

**Design Decisions:**

- The public Session Observer path explicitly requests `observation` for
  Cursor. The collaboration adapter explicitly requests
  `confirmed-completion`. The lower-level Cursor normalizer keeps its current
  terminal-only default until all call sites are explicit, avoiding an implicit
  behavior change for Export Session Transcript.
- The observation cursor advances across every verified safe frame, including
  filtered metadata, only after its delivery reservation commits. The
  completion cursor remains at an incomplete turn start until terminal evidence
  allows a safe advance.
- Observation projection excludes a terminal's final source entry when its
  `entryKey` is already in reconciliation state; the lifecycle event carries
  the key without prose. On a fresh catch-up that includes the whole completed
  turn, the final entry is delivered once at the terminal frame and every
  earlier substantive assistant entry is retained in
  `accounting.recovery.omittedAssistantEntries` as a frame/entry-key pointer
  without prose.
- Tail slicing cannot erase recovery pointers for omitted human direction and
  cannot silently discard omitted stable assistant content; both receive frame
  pointers. A sliced or blocked completion digest is never eligible.
- Completion selection dispatches by digest schema. The v1 branch retains its
  existing record-index checks. The v2 branch requires Cursor frame-index
  accounting, uses delivery `recordIndex`/terminal frames for ranges, preserves
  `sourceFrameIndex` only for provenance, and rejects unknown schema/index
  combinations before any cursor or budget change.

### Foreground Watch Integration

**Purpose:** Apply the new evidence model without changing foreground ownership
or falsely claiming background wake.

**Responsibilities:**

- Retain exact target locking and explicit baseline events.
- Acquire the exact target lock before catch-up, delivery reservation, or cursor
  mutation; a duplicate loser exits without restore/write behavior.
- Cache the last verified file signature and prefix inside the running watcher.
- Re-read/re-hash only when metadata changes; debounce projected deltas.
- Track `lastPollAt`, `lastEventAt`, pending/buffered frame, lifecycle, and
  continuity health separately.
- Stop, pause, resume, and clean up through the existing watch-control and
  signal paths.

**Interfaces:**

```typescript
export interface WatchTargetRecordV2 extends WatchTargetRecord {
  indexBase: 'zero-based-jsonl-frame-index';
  observationCursor: number;
  bufferedFromFrame: number | null;
  lastStatus: ObservationStatus;
  continuityState: 'verified' | 'blocked';
}
```

Existing watch stdout/event-log shapes remain additive. Durable event logs
contain timestamps, identity, ranges, counts, and status only; stdout JSON may
contain the requested digest for the active caller.

**Dependencies:**

- Existing virtual-clock watch loop and watch-state lock.
- New observer digest/status result.

**Design Decisions:**

- `healthy` means the watcher successfully polled, read, and verified the
  current checkpoint. It says nothing about whether the peer is making
  substantive progress.
- A partial tail is `buffered`, not unhealthy. An internal malformed frame or
  continuity mismatch is `blocked` and retains ownership so the failure stays
  visible until stopped or recovered.
- Output uses the Cursor state's reserve/write/commit protocol. A stranded
  pending delivery is exposed on status and replayed only with
  `delivery-uncertain` provenance and the original entry keys.
- A backgrounded foreground watcher still cannot wake a future parent
  invocation; documentation retains that limitation.

### Collaboration Completion Adapter

**Purpose:** Keep automatic continuation stricter than ordinary content
observation and migrate exact range provenance to the new Cursor index base.

**Responsibilities:**

- Request only confirmed-completion projection for peer review.
- Validate schema version, index base, exact private cursor, complete unsliced
  accounting, terminal outcome, substantive classification, and contiguous
  range.
- Migrate collaboration lease state to carry `peerIndexBase` and reject
  incompatible active leases.
- Canonicalize and containment-check the peer path at arm and use time; for a
  Cursor frame-index peer, verify and atomically advance a private continuity
  checkpoint with the completion cursor.
- Emit/parse a versioned wake envelope containing the index base.
- Preserve CAS, caps, expiry, loop, no-op, synthetic-control, and disarm rules.

**Interfaces:**

```typescript
export interface CompletionSelection {
  continuation: boolean;
  indexBase:
    | 'zero-based-jsonl-record-index'
    | 'zero-based-jsonl-frame-index';
  fromIndex: number;
  completedIndex: number | null;
  nextCursor: number;
  budgetCost: 0 | 1;
}

export interface CollaborationLeaseV6 {
  schemaVersion: 6;
  peerRuntime: Runtime;
  peerSession: string;
  peerTranscript: string;
  peerCanonicalTranscriptPath: string;
  peerIndexBase: CompletionSelection['indexBase'];
  peerCursor: number;
  peerContinuity: TranscriptContinuityCheckpoint | null;
}
```

The XML wake envelope adds `schema_version="2"` and `index_base`. The v2 parser
requires and validates both before exposing range provenance. It accepts the
legacy envelope as record-index v1 for compatibility, while a v2/frame-index
producer must include both attributes. Old receivers may classify the envelope
as automatic control, but the received range is advisory review provenance:
existing transcript normalization stores it on the automatic-control entry and
does not mutate peer state from that entry. Cursor mutation occurs only in the
producer hook's lease CAS. Frame-index collaboration promotion therefore also
requires matched producer/receiver version evidence.

**Dependencies:**

- Existing collaboration completion selector, runtime adapter, lease state,
  Stop hooks, and automatic-control parser.
- Cursor completion projection.

**Design Decisions:**

- Content-available open turns never enter the completion selector.
- The hook routes Cursor completion reads through the same framed reader,
  identity/path checks, and continuity guard using lease-private state; it never
  bypasses continuity by calling the legacy digest path with only path/cursor.
- A successful CAS advances `peerCursor` and `peerContinuity` together. Shrink,
  path/realpath/device/inode/prefix mismatch, or malformed blocking frame
  produces no wake and no cursor mutation.
- Existing active v5 leases with Cursor peers are not migrated because their
  cursor index meaning may have changed. They are diagnosed as incompatible and
  must be explicitly disarmed/re-armed. Exact non-Cursor v5 leases may migrate
  to record-index v6 only through an explicit validator branch.
- This component does not promote Cursor lifecycle support. Promotion remains
  contingent on the full live acceptance sequence.

### Evidence and Capability Record

**Purpose:** Make support claims reviewable without building a new runtime
service or storing prose.

**Responsibilities:**

- Maintain sanitized fixtures for each supported structural record shape.
- Record automated test command/result and a repeatable live probe for each
  support-matrix row.
- Label rows `live-validated`, `automated-only`,
  `documented-but-unvalidated`, `unavailable`, or `unsupported`.
- Separate observed-side, lifecycle-continuation, scheduled-poll, and
  event-wake evidence.

**Interfaces:**

```typescript
export interface CursorCapabilityEvidence {
  capability: string;
  cursorVersion: string;
  hostKind: string;
  storeKind: string;
  pathPattern: string;
  slugVariant: string | null;
  recordShape: string;
  identityFields: string[];
  probeCommand: string;
  probeActions: string[];
  fixtureCoverage: string[];
  automatedResult: 'pass' | 'fail' | 'not-run';
  liveResult:
    | 'validated'
    | 'failed'
    | 'unavailable'
    | 'not-run';
  evidenceLabel:
    | 'live-validated'
    | 'automated-only'
    | 'documented-but-unvalidated'
    | 'unavailable'
    | 'unsupported';
  missingEvidence: string[];
  observedAt: string;
}
```

The durable representation is a reviewed Markdown evidence table plus
synthetic fixtures; no new runtime registry or database is introduced.

**Dependencies:**

- Vitest, local provider CLIs, controlled Cursor sessions, and runtime
  reference documentation.

**Design Decisions:**

- A passing fixture proves only the parser/adapter contract represented by the
  fixture.
- A deterministic scheduled observer is classified as `scheduled-poll` only
  after its scheduler submits a future turn to the same parent. Otherwise it is
  merely an external poll/event log.
- Remote background agents are not selected by default because they do not
  inherently share the local transcript store or parent conversation. A local
  worker or managed subagent route remains a probe candidate, not an assumed
  component.

## Data Models

### Transcript Frame and Safe Prefix

**Purpose:** Give every physical Cursor JSONL position durable meaning.

**Schema:** `CursorTranscriptFrame` and `CursorTranscriptScan` from the framed
reader component.

**Validation Rules:**

- Frame indexes are non-negative, contiguous, and ordered by byte range.
- `byteStart <= byteEnd <= file.size`.
- Only newline-terminated frames are `closed`.
- `safeThroughFrame` is either `null` or an inclusive index below
  `totalFrames`; `safePrefixBytes` ends exactly after that frame.
- A closed nonblank frame is either `parsed` or `malformed`; an unterminated
  tail is `partial` even when its current bytes parse.
- `safeThroughFrame` and `safePrefixBytes` stop before the first malformed or
  partial frame.

**Storage:**

- Each frame exists only for the accumulator callback; the scanner retains no
  transcript-sized frame array.
- Only the safe prefix length/hash and next frame index persist in local state.

### Cursor Turn Analysis

**Purpose:** Represent one pending or terminal structural range without
inventing a provider generation identifier or conflating content and
completion.

**Schema:** `CursorTurnAnalysis` and `CursorContentRecord` from the analyzer
component.

**Validation Rules:**

- `turnId` is deterministic within exact transcript identity.
- The range begins immediately after the prior terminal and ends at the next
  terminal; multiple human records inside the range do not imply queue or
  generation semantics.
- `fromFrameIndex <= observedThroughFrame`.
- A terminal frame must be inside the turn range and have one recognized or
  explicitly unknown status.
- `finalSubstantiveEntryKey` references an assistant record inside the turn.
- Automatic controls and runtime diagnostics cannot be final substantive
  entries.

**Storage:**

- Analysis is recomputed from verified transcript frames.
- Entry keys/status summaries may appear in local state and event metadata;
  text does not.

### Observation Status

**Purpose:** Prevent one signal from standing in for engagement, content,
completion, or watcher health.

**Schema:** `ObservationStatus` from the digest projector.

**Validation Rules:**

- `content: available` does not imply `lifecycle: success`.
- `lifecycle: success` requires a terminal-success frame.
- `delivery: uncertain` means stdout may have completed before the durable
  commit; any replay retains the original entry keys and is visibly labeled.
- `health: healthy` requires a successful read and continuity verification but
  does not imply activity.
- `health: blocked` does not advance state.
- Synthetic controls never produce `engagement: engaged`.

**Storage:**

- Latest status is stored with observer/watch state.
- Each delta/heartbeat may expose status as metadata.

### Cursor Session State v2

**Purpose:** Persist exactly one owner's observation cursor and continuity
checkpoint.

**Schema:** `CursorSessionStateEntry` and
`TranscriptContinuityCheckpoint` from the continuity component.

**Validation Rules:**

- Runtime, session, canonical cwd, path, index base, and checkpoint are all
  required.
- `nextFrameIndex` equals the first unconsumed safe frame.
- Prefix length/hash cover the raw transcript bytes that justify the cursor.
- State writes occur only under the Cursor-state exclusive lock and atomic
  rename, using expected-checkpoint CAS for reservation/commit.
- `pendingDelivery` contains ranges/keys/checkpoint only and never prose.
- `openTurn.deliveredEntryKeys` is the durable restart boundary for later
  terminal reconciliation.
- Cursor observer state never stores a collaboration completion cursor.

**Storage:**

- Owner-local `STATE_DIR/cursor-state.json`, isolated from legacy
  record-index `state.json`.
- Directory mode `0700` and file mode `0600` where the platform supports POSIX
  permissions.

### Digest v2 Cursor Evidence

**Purpose:** Carry projection, status, lifecycle, continuity, and frame-based
accounting through CLI/watch/collaboration consumers.

**Schema:** The explicit `Digest | CursorDigestV2` discriminated union,
including v2 range/accounting/recovery/entry shapes and lifecycle events.

**Validation Rules:**

- Raw range, rendered range, filtered counts, and cursor use the declared index
  base.
- Observation and completion projections are explicit for Cursor.
- A sliced or discontinuous completion digest is never continuation-eligible.
- Rendered content has a source entry key/frame and availability label.

**Storage:**

- Returned in memory/stdout.
- Durable watch event logs retain metadata/ranges/status only, not entries.

### Collaboration Lease v6

**Purpose:** Bind a private completion cursor to exact peer identity and index
semantics.

**Schema:** Existing lease fields plus `schemaVersion: 6`, canonical peer path,
`peerIndexBase`, and the peer-private continuity checkpoint.

**Validation Rules:**

- Owner session/cwd and peer runtime/session/transcript remain exact.
- Peer cursor is non-negative and interpreted only under `peerIndexBase`.
- Cursor frame-index leases require a matching prefix/path/device/inode
  checkpoint; cursor and checkpoint advance in one CAS.
- v5 Cursor leases fail incompatible; no inferred conversion is allowed.
- CAS, finite wait, expiry, continuation/loop caps, and terminal lease states
  remain mandatory.

**Storage:**

- Existing owner-only collaboration state directory and atomic files.

### Capability Evidence Row

**Purpose:** Represent the minimum evidence for one public support claim.

**Schema:** `CursorCapabilityEvidence` from the evidence component.

**Validation Rules:**

- A `live-validated` row names a version, host, store/path/slug, record shape,
  identity fields, probe command/actions, and includes automated pass plus a
  reproducible sanitized live result.
- A missing live result cannot be labeled validated.
- No row contains prompt or response prose, credentials, raw IDs, or unredacted
  paths.

**Storage:**

- Runtime reference/support-matrix Markdown and synthetic fixture files.

## API Design

This project adds no network or HTTP API. Its public surface remains the local
Session Observer CLI/skill and the synthetic collaboration hook contract.

### Session Observer CLI

**Commands:** Existing `review`, `catch-up`, `catch-up-then-watch`, `locate`,
`state`, `watch`, and `watch-ctl` commands remain.

**Behavioral Contract:**

- Cursor review/catch-up/watch uses observation projection.
- Stateless `review` may show a clearly labeled diagnostic candidate, but
  Cursor `catch-up`, `catch-up-then-watch`, and `watch` require an exact session
  pin or corroborating harness session identity whenever the store cannot prove
  cwd independently.
- One-shot `review` and `catch-up` perform at most one bounded inline wait for
  the configured stability interval when their unread delta contains an open
  candidate, then run one confirmatory prefix scan. If the candidate prefix no
  longer verifies, they return exit `0` with
  `buffered.reason: 'stability-wait'` and do not advance across that candidate.
  `catch-up-then-watch` and `watch` schedule the same single confirmation in the
  poll loop and run it at the deadline even if file metadata is otherwise
  unchanged; they do not wait indefinitely for quiescence.
- JSON output adds `cursorEvidence`, lifecycle events, continuity state, and
  frame-index accounting.
- Human-readable output labels open content `CONTENT AVAILABLE — LIFECYCLE
  PENDING` and terminal results separately.
- `state reset --session cursor:<session-id>` remains the explicit recovery
  operation. The next catch-up replays from the beginning and creates a v2
  checkpoint.

**Error Handling:**

- Exit `0`: successful observation, including a healthy empty delta.
- Exit `1`: hard I/O or unexpected system error.
- Exit `2`: no candidate.
- Exit `3`: user input required for ambiguity/ties/unengaged-only selection.
- Exit `4`: schema, identity-state, or continuity contract mismatch; state is
  unchanged and JSON includes a stable failure code.

**Authorization:** Local user authority only. The CLI does not mutate provider
transcripts or invoke peers.

### Transcript Library Interfaces

The framed reader, analyzer, identity resolver, and continuity guard are
internal TypeScript interfaces described in Component Design. They accept
explicit paths/candidates and return structured results; they do not write
stdout or exit the process. `observeCatchUp` remains the orchestration seam and
owns state mutation only after all validation and rendering succeed.

### Collaboration Wake Envelope v2

**Method:** Cursor/host lifecycle hook return value.

**Response:**

```xml
<session_observer_wake
  automatic="true"
  schema_version="2"
  runtime="cursor"
  lease_id="redacted-lease"
  peer="cursor:redacted-session"
  index_base="zero-based-jsonl-frame-index"
  records="12-18">
Review the exact pinned peer range.
</session_observer_wake>
```

**Error Handling:** Invalid/missing provenance, unsupported index base, range
discontinuity, non-success lifecycle, stale lease, cap, expiry, or CAS failure
produces no follow-up message and a local diagnostic where appropriate.

**Authorization:** The envelope is synthetic control provenance. It can request
review of the stated range but cannot authorize privileged actions.

## Security Considerations

### Authentication

There is no new authentication layer. Access relies on the local OS user and
existing provider CLI/session authentication. Live probes use the user's
already authenticated Cursor environment and do not persist credentials.

### Authorization

- Auto-discovery reads only canonical paths under the supported local Cursor
  project root.
- Stateful observation requires exact identity evidence; weak ranked matches
  are read-only diagnostics.
- Only the observer owning an exact target can mutate its shared observation
  cursor.
- Collaboration hooks read owner-only leases and peer transcripts, then return
  a synthetic message to their own harness. They do not invoke peers or write
  transcripts.
- A lease path is canonicalized and revalidated against exact peer identity and
  the supported store before every completion read; an absolute path stored at
  arm time is not sufficient authorization by itself.
- Automatic controls cannot grant authority, approve destructive work, or
  recursively authorize another continuation.

### Data Protection

- **Encryption:** No new remote transport or data store is introduced. Data at
  rest inherits local filesystem protection.
- **Sensitive Content:** Transcript prose is processed in memory and may be
  printed only to the active caller that requested a digest. It is excluded
  from state, watch event logs, live probe artifacts, project files, and docs.
- **Structural Checkpoint:** A SHA-256 prefix digest is stored owner-locally for
  continuity and is never printed or copied into durable project evidence.
- **Permissions:** State directories/files use `0700`/`0600` where supported.
- **Input Validation:** Paths are canonicalized and containment-checked;
  indexes, byte ranges, statuses, schema versions, and envelope attributes are
  validated before use.

### Threat Mitigation

- **Wrong-session observation:** Exact session/path/cwd evidence and fail-closed
  ambiguity prevent recency or slug heuristics from owning state.
- **Symlink/path escape:** `realpath` plus supported-root containment protects
  auto-discovered paths.
- **Transcript rewrite/replay:** Prefix plus path/device/inode verification
  blocks cursor advancement after shrink, mutation, any replacement, or
  unsupported rotation.
- **Malformed-line index shift:** Physical frame indexing retains the blocking
  position instead of collapsing parsed records.
- **Synthetic wake recursion:** Provenance parsing, automatic classification,
  no-op suppression, completion projection, caps, and CAS prevent recursive
  budget spend.
- **Evidence leakage:** Synthetic fixtures and redacted structural probe
  records exclude prose, raw identifiers, paths, and lease data.

## Performance Considerations

### Scalability

The unit of scale is one local transcript per observer, not a multi-session
service. Locate may enumerate candidates, but stateful watch remains exact-pin
and N=2 collaboration remains unchanged. No mesh, shared daemon, or database is
introduced.

### Caching

- A running watcher caches the last file signature and verified prefix result.
- Unchanged polls perform only metadata checks and state heartbeat updates.
- On growth/change, the reader streams once to find candidates. Open-turn
  content requires one bounded confirmatory scan after the debounce interval;
  terminal-only or metadata-only changes do not. Both passes verify continuity
  without retaining raw transcript copies. The cache is invalidated on any
  path, identity, index-base, size-decrease, or signature anomaly.
- No cross-process content cache is stored.

### Database Optimization

No database is used. State remains small atomic JSON files protected by
exclusive locks.

### Resource Limits

- **Memory:** Frame parsing is implemented as a streaming or single-buffer pass;
  it must not retain both raw content and a second full transcript copy.
- **CPU:** SHA-256 verification runs only after metadata change and during the
  one confirmatory stability scan. Normal watch polls remain stat-only.
- **Disk:** State contains one checkpoint/status per observed session; event
  logs contain metadata only. Existing digest tail limits remain available.
- **Processes:** Foreground watch remains one process per exact target. Any
  collaboration wait or future scheduled poll retains finite runtime, expiry,
  and event/count limits.
- **Network:** Core observation performs no network calls.

## Error Handling

### Error Categories

- **Selection Errors:** `NO_MATCH`, `AMBIGUOUS_RUNTIME`, `TIED_CANDIDATES`,
  `UNENGAGED_ONLY`. Existing input-needed behavior is preserved.
- **Identity Errors:** `IDENTITY_DIAGNOSTIC_ONLY`, `IDENTITY_AMBIGUOUS`,
  `IDENTITY_MISMATCH`, `PATH_OUTSIDE_SUPPORTED_ROOT`.
- **Continuity Errors:** `LEGACY_CURSOR_UNVERIFIED`, `INDEX_BASE_MISMATCH`,
  `FILE_IDENTITY_UNAVAILABLE`, `TRANSCRIPT_SHRANK`, `PREFIX_MISMATCH`,
  `TRANSCRIPT_REPLACED`, `ROTATION_UNSUPPORTED`.
- **Framing Errors:** `MALFORMED_FRAME_BLOCKED`, `PARTIAL_TAIL_BUFFERED`,
  `UNSUPPORTED_RECORD_SHAPE`. Partial tail is a buffered state, not a hard
  failure; an internal malformed frame blocks advancement.
- **Delivery Errors:** `DELIVERY_RESERVATION_STALE`,
  `DELIVERY_OWNER_CONFLICT`, and `DELIVERY_UNCERTAIN`. The uncertain state is a
  recoverable, visibly keyed replay condition, not proof of duplicate or lost
  delivery.
- **Lifecycle Errors:** Non-success Cursor terminal states are expected
  lifecycle outcomes and render diagnostics; they are not system exceptions.
- **Collaboration Errors:** `LEASE_INCOMPATIBLE`, `LEASE_EXPIRED`,
  `WAITER_ACTIVE`, `OBSERVER_INVALID`, `NONCONTIGUOUS_SELECTION`, `CAS_STALE`,
  and cap/disarm states fail closed without a wake.
- **System Errors:** Permission, missing file after exact selection, lock
  timeout, read failure, state write failure, and unexpected parse/runtime
  exceptions.

### Retry Logic

- Identity and continuity mismatches are deterministic and never auto-retried
  into a different target.
- A partial tail is reconsidered on the next normal poll without cursor
  advancement.
- Transient stat/read errors are retried by the next foreground poll; a one-shot
  command exits with a structured error.
- State-lock acquisition retains the current bounded retry behavior.
- Collaboration wait and CAS behavior retains existing finite deadlines; an
  idle/terminal lease never silently re-arms.

### Logging

- **Info:** Selected exact identity, schema/index base, ranges/counts, state
  transition, capability label, probe version, and deterministic closeout.
- **Warn:** Weak candidate, newer candidate while pinned, partial tail,
  non-success lifecycle, legacy state, unsupported surface, and continuity
  block reason.
- **Error:** I/O, permissions, corrupt state, lock timeout, invariant violation,
  and failed build/test/probe.
- No log level includes substantive transcript text, structural prefix hashes,
  raw session identifiers in durable evidence, credentials, or lease secrets.

## Testing Strategy

### Requirement-to-Test Mapping

| ID | Verification | Key Scenarios |
| --- | --- | --- |
| FR1 | unit + integration | Direct exact identity, explicit/harness session, fallback diagnostic, duplicate transcript, path alias, slug collision, newer-candidate pin retention |
| FR2 | unit + e2e | Two-scan prefix stability before terminal, multiple ordered open-turn records, partial tail, malformed frame, tool-only/empty/automatic/no-op suppression, keyed crash replay |
| FR3 | unit + integration | Same-read success selects final text, later success does not repeat delivered keys, prior pending content plus abort/error/cancel/unknown diagnostic, pending never completion-eligible |
| FR4 | unit + integration | Append, repaired blocking frame, shrink, prefix rewrite, in-place replacement, null file identity, path rotation, legacy state, explicit reset/replay |
| FR5 | unit + e2e | Human input, assistant progress, tool activity, content available, terminal states, partial buffer, blocked continuity, healthy empty heartbeat, stale/error health |
| FR6 | unit + integration | Expected-checkpoint CAS, reserve/write/commit crash interleavings, duplicate watcher pre-observation race, uncertain keyed replay, separate observation/completion cursors |
| FR7 | integration | Strict baseline, catch-up-then-watch, debounce, maximum pending, quiet heartbeat, pause/resume/stop, signal cleanup, newer candidate |
| FR8 | integration + e2e | v1/v2 digest validation, frame index envelope, exact lease, contiguous terminal range, metadata/no-op/synthetic suppression, caps, expiry, stale CAS, disarm |
| FR9 | manual + integration | Agent transcript baseline, dotted path, CLI/background store availability, record-shape fixtures, versioned support labels, evidence redaction scan |
| FR10 | manual + e2e | Existing Stop order, same-parent follow-up, user steering during wait, recurring loop, restart/resume, late output, managed subagent/local worker/scheduled callback, honest fallback |
| NFR1 | unit + manual | Root containment, symlink escape, identity ambiguity, owner enforcement, automatic-control provenance and non-authority |
| NFR2 | unit + manual | State/event-log artifact scan, synthetic fixtures, owner-only modes, no printed prefix hash, probe redaction |
| NFR3 | integration | Claude/Codex and Export regression, digest v1/v2 dispatch, isolated Cursor state upgrade/downgrade, incompatible v5 Cursor lease |
| NFR4 | integration | Type check, generated build/check, version gate, repo validate, smoke, provider mirror sync |
| NFR5 | perf + integration | Unchanged stat-only poll, changed streaming read, large transcript digest caps, finite watch/wait/scheduler bounds |
| NFR6 | manual + integration | Fixture-to-row traceability, recorded command/version/outcome, automated-only versus live labels, repeatable sanitized probe |

### Unit Tests

- **Scope:** Frame splitting/indexing, prefix checkpoints, Cursor record-shape
  parsing, turn grouping, content/lifecycle classification, observation and
  completion projection, identity strength, continuity results, state migration,
  status rendering, envelope parsing, and completion selection.
- **Coverage Target:** Every enumerated state, error code, and transition has at
  least one positive and one failure-boundary assertion. The repository has no
  numeric coverage gate, so this behavioral matrix is the enforceable target.
- **Key Test Cases:**
  - Malformed and partial frames retain positions and block safely.
  - An open assistant record is buffered after the first scan, becomes
    observable only after a confirmatory scan verifies its bounded raw prefix,
    remains stable when later frames were appended, and remains
    non-completion-eligible.
  - Two or more stable assistant records in one debounce range are emitted in
    order or receive explicit recovery pointers; none disappear behind the
    advanced cursor.
  - A later terminal changes lifecycle without duplicating text.
  - Prefix mismatch, unavailable device/inode identity, and legacy state never
    mutate the cursor.
  - Non-Cursor normalizers remain byte-for-byte behavior compatible.

### Integration Tests

- **Scope:** Canonical TypeScript pipeline, generated runtime entrypoints,
  locate/rank/observe/state/watch workflows, collaboration hooks/leases, and
  documentation/validation gates.
- **Test Environment:** Real temporary directories and synthetic JSONL files;
  injected virtual clock/stat/sleep for watch behavior; provider lifecycle
  subprocess boundaries mocked only where the existing suite already does so.
- **Key Test Cases:**
  - Catch-up-then-watch observes pre-terminal content normally once across
    restart; each forced reserve/write/commit crash point yields either a commit
    or a labeled delivery-uncertain replay with the same entry keys.
  - Duplicate watcher ownership and baseline recovery remain race-safe.
  - Repair, truncation, replacement, and reset/replay produce deterministic
    state transitions.
  - Completion projection and lease v6 emit one exact frame-index wake while
    observation projection remains independent.
  - `pnpm run build:check` proves generated runtime synchronization.

### End-to-End Tests

- **Scope:** Controlled local Cursor sessions and the installed/dogfooded
  Session Observer/Collaboration skills.
- **Test Scenarios:**
  - Produce substantive assistant text while no `turn_ended` is present and
    confirm a pinned watcher reports content available/lifecycle pending.
  - Finish, abort, error, and cancel controlled turns and confirm lifecycle
    reconciliation and no duplicate prose.
  - Restart/resume a pinned observer and prove idempotent entry keys with no
    silent loss; force the output/commit crash window and verify visible
    delivery-uncertain replay semantics.
  - Run the complete Cursor lifecycle acceptance sequence before changing its
    documented capability label.
  - Probe managed local subagent/worker and deterministic scheduled callback
    only after core correctness; record failure/unavailability as a valid
    evidence outcome.

The current automated baseline is green for the focused transcript/observer
suites, but no live Cursor lifecycle acceptance is inferred from that fact.

### Planned Verification Locations

- `tests/transcript-core/cursor-frames.test.ts` — physical frame indexes,
  prefix snapshots, partial/malformed boundaries, streaming behavior.
- `tests/transcript-core/cursor-analysis.test.ts` — structural turn ranges,
  stability candidates, multiple assistant records, lifecycle matrix.
- `tests/transcript-core/runtimes.test.ts` — legacy terminal projection and
  Export-compatible normalization.
- `tests/session-observer/{locate,observe,digest,state,watch-state,watch}.test.ts`
  — identity, isolated state migration, digest v2, CAS delivery, race, health,
  reset/replay, and symlinked cwd behavior.
- `tests/session-observer-collab/{completion,cursor-hook,control,wake-envelope-contract}.test.ts`
  — schema routing, lease-private continuity, envelope version/index, caps/CAS,
  no-op and disarm.
- `skills/session-observer-collab/references/runtime-cursor.md` plus the Cursor
  support table in the documentation site — sanitized commands, versions,
  store/path/identity shapes, actions, outcomes, and evidence labels. These are
  the authoritative live-probe artifacts; fixtures alone cannot promote a row.

## Deployment Strategy

### Build Process

1. Add the shared framed-reader/analyzer sources as
   `src/transcript/core/cursor-frames.ts` and
   `src/transcript/core/cursor-analysis.ts`; update the existing canonical
   Session Observer TypeScript modules under
   `src/transcript/session-observer/` for identity, digest, state, observe, and
   watch orchestration.
2. Extend `scripts/build-generated.mjs` so each new core module has an explicit
   output in both shipped runtime trees:
   `skills/session-observer/scripts/lib/{cursor-frames,cursor-analysis}.mjs`
   and
   `skills/export-session-transcript/scripts/lib/{cursor-frames,cursor-analysis}.mjs`.
   Add the corresponding `.js` to `.mjs` import rewrites to every generated
   consumer and cover the new mappings in
   `tests/tooling/generated-output-sync.test.ts`.
3. Run `pnpm run build` to refresh all committed generated `.mjs` outputs;
   never hand-edit a generated file. Export Session Transcript continues to use
   the terminal-only projection unless explicitly changed by a later project.
4. Edit authored collaboration `.mjs` and declaration files only where the
   completion/index contract changes; refresh project/provider mirrors with OAT
   sync at the workflow-defined points.
5. Bump `session-observer`, `export-session-transcript`, and
   `session-observer-collab` skill versions when their canonical/generated or
   authored files change. Keep top-level and metadata versions in sync and keep
   all three entries in `scripts/bump-version.mjs`.
6. Run targeted tests, full Vitest, type/build checks, repository validation,
   changed-file formatting/lint checks, smoke verification, and skill-version
   validation.

### Deployment Steps

1. Land frame/analyzer/continuity behavior with synthetic fixtures and schema
   migration tests.
2. Dogfood the branch version locally using the repository's standalone-skill
   sync convention; do not present that branch version as the main-tracking
   global install.
3. Run sanitized live observed-side acceptance and correct the support matrix.
4. Run collaboration lifecycle/wake probes only after observation correctness
   passes.
5. Update Fumadocs user/engineering documentation and runtime evidence tables.
6. Complete the repository pre-merge/worktree validation, merge, then reconcile
   user-level installs to the landed main version.

### Rollback Plan

- Reinstall the prior shipped skill versions and regenerate provider mirrors.
- State v2 migration keeps backups; rollback does not reinterpret frame indexes
  as legacy record indexes.
- If returning to a v1 observer, reset affected Cursor session state explicitly
  before use. Do not copy v2 offsets into v1 fields.
- Disarm v6 collaboration leases before rollback and re-arm under the restored
  version only after checking exact peer identity/cursor.
- Documentation/capability labels revert with code; a failed live probe remains
  retained as structural evidence rather than erased.

### Configuration

- No new runtime service, dependency, or long-lived feature flag is required.
- Existing `STATE_DIR` and collaboration state-directory overrides remain.
- Existing watch cadence, debounce, maximum-pending, maximum-runtime, heartbeat,
  and lease bounds remain the configuration surface.
- Content-first Cursor observation becomes the supported Session Observer
  behavior only after acceptance. Lower-level/export callers keep explicit
  projection selection during migration.

### Monitoring

- **Metrics:** Local status exposes poll time, delta time, raw/safe/buffered
  frame counts, observation cursor, lifecycle, content state, continuity state,
  event count, and lease count/caps. No telemetry service is added.
- **Alerts:** Human-readable warnings cover continuity block, malformed frame,
  stale watcher, incompatible state/lease, unsupported surface, and unvalidated
  capability.
- **Dashboards:** No dashboard is introduced; `state get`, `watch-ctl status`,
  structured CLI JSON, test results, and the capability table are the supported
  inspection surfaces.

## Migration Plan

### State and Contract Migrations

1. Introduce digest schema v2 and the Cursor frame-index base while retaining a
   temporary reader for schema-v1 record-index digests.
2. Leave legacy `STATE_DIR/state.json` at schema v1 for Claude Code and Codex.
   Introduce Cursor-only `STATE_DIR/cursor-state.json` at schema v2; the CLI
   composes both stores for `state get/reset/clear`.
3. Migrate a legacy Cursor entry idempotently under both store locks. First
   write a non-consumable `legacy-unverified` marker to `cursor-state.json`;
   then create the backup and atomically remove that Cursor entry from
   `state.json`; finally mark migration complete. If interrupted at any point,
   the new runtime detects the marker/legacy-entry combination and retries the
   same sequence without consuming either offset. Non-Cursor entries are never
   copied or rewritten.
4. On the next Cursor catch-up/watch, return the explicit reset/replay command.
   After the user resets that session, delete the full entry and marker, replay
   from frame zero, and write the first verified v2 checkpoint.
5. Add optional v2 fields to watch state. Existing watcher records load with
   status/continuity `unknown`; active pre-upgrade watchers must be restarted
   before owning a v2 Cursor target.
6. Upgrade collaboration lease schema to v6 with `peerIndexBase`. Reject active
   v5 Cursor leases as incompatible and require disarm/re-arm. Non-Cursor lease
   migration may preserve record-index cursors only when exact schema validation
   succeeds.
7. Add `schema_version` and `index_base` to new wake envelopes and keep legacy
   parsing during the compatibility window.

### Breaking Change Handling

- The one intentional compatibility break is refusal to trust legacy Cursor
  parsed-record offsets. It is fail-visible and recoverable through explicit
  replay.
- Scripts consuming Cursor JSON digest ranges must read schema/index base rather
  than assume parsed-record indexes.
- Content-first output is additive in meaning but changes when active Cursor
  prose becomes visible; docs and release notes call out the pending-lifecycle
  label.
- No database or remote data migration is required.

### Rollback Strategy

Restore prior skill versions and leave `cursor-state.json` untouched for a
future re-upgrade. Because migration removed Cursor entries from legacy
`state.json`, a v1 runtime cannot reinterpret a frame cursor; it will see no
Cursor checkpoint and may replay from zero. Before deliberate v1 Cursor use,
run the restored runtime's explicit session reset, then re-arm collaboration
leases under its schema. Never down-convert v2 frame cursors into v1 record
cursors.

### Data Validation

- Compare replayed synthetic transcripts against expected frame ranges and
  entry keys.
- Verify state backups, owner-only modes, cursor/checkpoint consistency, and no
  prose in state/event evidence.
- Run append/repair/shrink/replace/restart matrices before and after migration.
- Confirm all non-Cursor fixture outputs remain compatible.

## Open Questions

- **Content boundary:** The recommendation is to present a newline-terminated,
  parseable, substantive assistant record as content-available/lifecycle-pending
  only after a second scan one unchanged debounce interval later. Is that
  latency/correctness boundary acceptable, given that a later non-success
  terminal leaves the earlier output visible only as historical pending
  content?
- **Progress granularity:** The correctness default renders every new stable
  substantive assistant record in source order, grouping entries when useful.
  Should the human-readable digest summarize intermediate progress while
  retaining explicit recovery pointers, or show every entry verbatim?
- **Legacy state ergonomics:** The correctness-first recommendation requires a
  one-time explicit replay for existing Cursor offsets. Is that operational
  friction acceptable, or should implementation provide a separately confirmed
  tail-discard option?
- **Identity evidence:** Which live Cursor metadata can corroborate cwd/session
  beyond the encoded project directory? This determines whether additional
  path variants can be stateful or remain locate-only diagnostics.
- **Optional wake order:** After correctness passes, should live effort start
  with the existing Stop hook, managed local subagent/`subagentStop`, or a
  deterministic scheduled observer callback? The recommendation is existing
  Stop identity/order first, then managed local completion, then scheduled
  polling only if a same-parent scheduler exists.

## Implementation Phases

### Phase 1: Structural Evidence and Framing Foundation

**Goal:** Lock the observed Cursor baseline and make physical frame behavior
testable without changing public completion semantics.

**Tasks:**

- Capture synthetic/redacted fixtures for closed content, partial tail,
  malformed internal frame, terminal statuses, rewrite, replacement, and path
  ambiguity.
- Implement the framed reader, frame index base, and prefix checkpoint types.
- Add parser/analyzer tests for the measured top-level role/content/terminal
  shapes and explicit unsupported variants.
- Record the initial store/version support matrix and probe plan.

**Verification:** Frame/index/prefix tests pass; fixtures contain no prose from
real sessions; current terminal projection remains green.

### Phase 2: Cursor Turn Analysis and Continuity Guard

**Goal:** Produce separate observation/completion evidence and block unsafe
cursor reuse.

**Tasks:**

- Implement turn grouping, content classification, lifecycle reconciliation,
  and both projections.
- Implement exact identity evidence and stateful-strength gates.
- Implement state v2, legacy Cursor backup/unverified outcome, prefix
  validation, and explicit reset/replay flow.
- Remove Cursor's silent shrink-to-zero behavior.

**Verification:** FR1-FR4 and state migration matrices pass; repair resumes from
the verified frame; shrink/path/prefix changes never mutate state.

### Phase 3: Digest, Status, and Foreground Watch Integration

**Goal:** Make pre-terminal content useful while preserving truthful health and
idempotent, fail-visible watch behavior.

**Tasks:**

- Add digest v2 Cursor evidence, additive entry source fields, lifecycle events,
  and render labels.
- Thread observation projection through review/catch-up/watch.
- Add watch v2 status/cache/buffer/continuity fields and virtual-clock tests.
- Validate duplicate target, baseline, debounce, restart, heartbeat, and cleanup
  behavior.

**Verification:** A synthetic active turn normally emits each stable entry once
as content available/lifecycle pending; later terminal reconciles without
repeated prose; forced output/commit ambiguity is visibly keyed as
delivery-uncertain; FR5-FR7 and non-Cursor regressions pass.

### Phase 4: Collaboration Completion Compatibility

**Goal:** Keep automatic continuation terminal-only under the new digest/index
contract.

**Tasks:**

- Make completion projection explicit at collaboration call sites.
- Add digest v1/v2 and record/frame index validation to completion selection.
- Migrate lease schema to v6 and add wake-envelope index provenance.
- Cover incompatible leases, pending content, failures, no-op/synthetic ranges,
  caps, CAS, late output, and disarm.

**Verification:** FR8 and collaboration regression suites pass; no pending
content can trigger; exact terminal range/cursor claims survive restart and
duplicate events.

### Phase 5: Live Acceptance, Documentation, and Release Readiness

**Goal:** Validate and document only the support proven by the completed core.

**Tasks:**

- Run sanitized observed-side content/terminal/continuity acceptance on the
  available Cursor version.
- Run full automated/build/validation/smoke gates and skill-version checks.
- Update user guide, engineering architecture, limitations, runtime evidence,
  and support matrix.
- Dogfood provider mirrors, verify local installs, and record rollback steps.

**Verification:** All P0 requirements and evidence labels pass; docs contain no
  unsupported claim; reliable observation has a complete shipping boundary.

### Phase 6: Stronger Wake Evaluation (Conditional)

**Goal:** Evaluate P1 wake candidates without reopening the correctness core or
making project completion depend on success.

**Tasks:**

- Probe existing Cursor Stop identity/order and full acceptance sequence.
- If available, probe managed local subagent/`subagentStop` delivery into the
  same parent conversation.
- Probe a deterministic private-cursor scheduled observer only when an actual
  scheduler callback surface exists; do not invoke an LLM per poll.
- Implement only the strongest proven bounded tier, or record the non-claim and
  retain buffered-manual fallback.

**Verification:** FR9-FR10 support rows have commands, versions, sanitized
outcomes, interruption/restart/disarm evidence, and accurate tier labels. A
failed or unavailable probe is an acceptable outcome.

## Dependencies

### External Dependencies

- **Cursor local agent-transcript store:** Required baseline input; no network
  API contract is assumed.
- **Cursor runtime/CLI:** Required only for controlled live probes; its presence
  alone is not capability evidence.
- No new runtime library, daemon, database, or hosted service is added.

### Internal Dependencies

- Canonical transcript runtime adapters and generated-runtime build.
- Locate/rank/observe/digest/state/watch Session Observer pipeline.
- Session Observer Collaboration completion selector, runtime adapters, lease
  state, Stop hooks, and automatic-control envelope parser.
- Fumadocs user and engineering documentation.
- OAT/PJM backlog rows for Cursor store coverage and stronger wake evidence.

### Development Dependencies

- Node.js 22 or newer, pinned pnpm, TypeScript, esbuild, and Vitest.
- oxlint/oxfmt and repository validation/version gates for changed files.
- Local authenticated Cursor environment for live acceptance.

## Risks and Mitigation

- **Pending content is read as final:** Probability Medium | Impact High
  - **Mitigation:** One unchanged stability interval, prominent
    lifecycle-pending label, ordered stable records, separate completion
    projection, and terminal-only wake.
  - **Contingency:** Increase the measured stability interval or narrow the
    content projection based on live evidence without weakening completion
    rules.
- **Cursor mutates closed records in place:** Probability Low/Unknown | Impact High
  - **Mitigation:** Prefix checkpoint verification on every metadata change and
    continuity-blocked outcome before further state advancement.
  - **Contingency:** Require a longer stability interval or revert that measured
    store/version to terminal-only/documented-unvalidated support.
- **Physical frame indexing breaks consumers:** Probability Medium | Impact High
  - **Mitigation:** Digest schema v2, explicit index base, temporary v1/v2
    readers, incompatible lease refusal, migration fixtures.
  - **Contingency:** Keep legacy projection isolated while callers migrate; do
    not convert offsets heuristically.
- **One-time replay surprises users:** Probability High | Impact Medium
  - **Mitigation:** Preserve backups and return the exact session reset/replay
    command with no destructive automatic action.
  - **Contingency:** Add an explicitly confirmed tail-discard operation only if
    review establishes a real need.
- **Identity remains under-corroborated:** Probability Medium | Impact High
  - **Mitigation:** Statefulness requires exact evidence; fallback/variant rows
    remain locate-only until live metadata proves them.
  - **Contingency:** Ship the agent-transcript baseline with narrower support and
    leave broader store backlog open.
- **Continuity hashing adds latency:** Probability Medium | Impact Medium
  - **Mitigation:** Stat-only unchanged polls, streaming hash on change, watcher
    cache, no second unbounded content copy.
  - **Contingency:** Benchmark and add a fail-visible size/resource policy rather
    than weakening prefix verification.
- **Fixtures are mistaken for live support:** Probability High | Impact High
  - **Mitigation:** Per-row evidence labels require both automated and live
    proof; docs list missing acceptance rows.
  - **Contingency:** Downgrade the label immediately while keeping automated
    behavior documented.
- **Wake path loops or widens authority:** Probability Medium | Impact High
  - **Mitigation:** Conditional phase, private completion cursor, exact pin,
    synthetic provenance, no-op suppression, finite bounds, CAS, human steering,
    deterministic disarm.
  - **Contingency:** Retain buffered-manual catch-up and record no autonomous
    wake claim.
- **Background scheduler observes but cannot wake:** Probability High | Impact Medium
  - **Mitigation:** Require live same-parent callback proof before the
    `scheduled-poll` label; use deterministic polling with zero model cost.
  - **Contingency:** Treat it only as an external event log/notifier or do not
    ship it.
- **Generated output or skill versions drift:** Probability Medium | Impact High
  - **Mitigation:** Canonical TypeScript edits, generated build/check, version
    validation, provider sync, and clean-tree premerge gates.
  - **Contingency:** Block merge/release until drift and installed mirrors are
    reconciled.

## References

- Specification: `spec.md`
- Discovery: `discovery.md`
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
- Architecture: `.oat/repo/knowledge/architecture.md`
- Conventions: `.oat/repo/knowledge/conventions.md`
- Testing: `.oat/repo/knowledge/testing.md`
- Cursor runtime evidence: `skills/session-observer-collab/references/runtime-cursor.md`
- Generated runtime contract:
  `documentation/docs/engineering/architecture/generated-runtime.md`
