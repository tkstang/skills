---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-08-31
oat_generated: false
oat_template: false
---

# Design: coding-session-handoff

## Overview

`coding-session-handoff` is one public skill backed by a dependency-free Node.js
runtime. The runtime composes the repository's existing transcript discovery,
normalization, and sanitization layers; it does not add a provider database, daemon,
or generic write abstraction. It owns only the handoff-specific policies that are not
present in session-observer: exact explicit selection, zero-persistence inspection,
same-repository worktree validation, provider capability contracts, digest-confirmed
batch planning, provider-native invocation, and separate native/reporting outcomes.

The default continuity mode is a provider-native successor. Same-ID resume is an
advanced mode whose policy currently refuses every item because the installed CLIs do
not expose trustworthy writer-closed evidence. Native successor execution is gated per
provider/version/operation by a source-controlled behavioral contract. During
implementation, bounded disposable two-worktree gates must establish and record the
successor contracts for exact Codex 0.151.0 and Claude Code 2.1.251. A verified exact
match can execute after digest confirmation; drift falls back to plan/deferred. If
either installed provider cannot safely execute and yield exact child identity, v1 is
blocked rather than silently reduced to a plan-only product. There is no runtime
override that weakens either gate.

The chosen direction reaffirms discovery's ephemeral native-command approach. A
durable registry and provider-store rebinding remain intentionally excluded.

## Architecture

### System Context

The feature sits beside session-observer and export-session-transcript under the shared
transcript architecture. It reuses provider record readers and the existing hidden
payload sanitizer, but it adds a read-only option to discovery so Codex cwd cache reads
and writes cannot affect session selection. Provider-native mutation remains outside
the transcript layer and happens only through exact CLI argv.

**Key Components:**

- **Read-only discovery seam:** Adds an explicit persistence policy to shared session
  location without changing existing consumer defaults.
- **Handoff discovery and preview:** Produces exact-cwd provider-qualified candidates,
  direct-only current evidence, and bounded sanitized previews.
- **Git target validator:** Establishes canonical source/target worktree and repository
  evidence using structured Git subprocesses.
- **Provider contract adapters:** Probe exact Codex/Claude syntax, materialize safe argv,
  and consult source-controlled behavioral verification.
- **Handoff orchestrator:** Resolves selection and modes, builds/digests plans, enforces
  confirmation, records native outcomes, and reconciles child lineage.
- **CLI and skill workflow:** Expose deterministic JSON/human commands while the skill
  owns the conversational confirmation and post-turn guidance.

### Component Diagram

```text
SKILL.md
   │
   ▼
CLI / renderer ───────────────► Handoff orchestrator
                                  │       │       │
                                  ▼       ▼       ▼
                         discovery   Git target   provider adapters
                            │                       │
                            ▼                       ▼
              transcript locate/read/normalize/   Codex CLI / Claude CLI
                    sanitize (read-only)           (native mutation only)
```

Canonical TypeScript lives under `src/transcript/coding-session-handoff/`. The build
produces one bundled generated runtime at
`skills/coding-session-handoff/scripts/coding-session-handoff.mjs`. Bundling keeps the
public runtime self-contained while preserving canonical imports from shared source.

### Data Flow

```text
1. Canonicalize source path.
2. Discover Codex + Claude records with persistence=forbid.
3. Qualify/deduplicate candidates; attach direct current evidence only.
4. Optionally read, normalize, sanitize, and bound previews.
5. Resolve explicit one/many/all selection.
6. Canonicalize and validate source + target Git worktree evidence.
7. Probe provider syntax and consult exact behavioral contracts.
8. Classify each item ready/deferred/refused and construct structured argv.
9. Canonicalize the mutation-relevant plan and compute SHA-256 confirmation digest.
10. For execute, repeat steps 1-9 and require the exact supplied digest.
11. Launch only ready successors through bounded provider-native non-interactive argv
    with shell=false; parse the provider's machine event/result stream for the exact
    child ID and discard raw content after validation.
12. Corroborate that explicit child ID against the target transcript metadata and
    reconcile only the expected exact parent/child pair.
13. Return independent native/reporting states and failed/deferred retry keys.
```

Before the implementation gate runs, the source-controlled behavior matrix has no
executable operation. The gate creates disposable source/target worktrees and provider
sessions, observes native successor behavior, and produces bounded evidence for review.
After both exact installed versions pass, the reviewed matrix entries become verified
and step 11 is executable for exact matches. Unverified versions remain deferred.

## Component Design

### Shared Read-Only Discovery Seam

**Purpose:** Preserve session-observer behavior while giving mutating consumers a
strictly observational discovery path.

**Responsibilities:**

- Extend discovery with explicit persistence, recency, and completeness policies.
- Preserve `default` behavior for current consumers.
- Under `forbid`, bypass both load and save of `codex-cwd-cache.json`.
- Under `exact-all`, do not apply session-observer's seven-day Codex cutoff. Enumerate
  every store entry within the declared scan budget and fail the complete discovery if
  any entry cannot be classified safely.
- Continue using only the request-local bounded classification cache.
- Add bounded prefix/tail record readers with a redacted diagnostic sink. Metadata
  classification reads only a bounded prefix; preview reads a bounded tail. Neither
  reader emits transcript paths or uses the current `console.warn` path.

**Interfaces:**

```typescript
interface DiscoveryOptions {
  persistence?: 'default' | 'forbid';
  recency?: 'default' | 'exact-all';
  budget?: {
    maxEntries: number;
    maxAggregateBytes: number;
    maxMetadataBytesPerEntry: number;
    deadlineMs: number;
  };
  diagnostic?: (event: SafeTranscriptDiagnostic) => void;
}

interface SafeTranscriptDiagnostic {
  code: 'malformed-record' | 'oversized-record' | 'read-failed';
  provider: HandoffProvider;
  nativeId?: string;
}

function discover(
  runtime: Runtime,
  targetCwd: string,
  cache?: ClassificationCache,
  options?: DiscoveryOptions,
): Promise<LocatedSession[]>;

function findSessionCandidate(
  runtime: Runtime,
  targetCwd: string,
  sessionId: string,
  options?: DiscoveryOptions,
): Promise<LocatedSession | null>;

function readMetadataRecordsBounded(
  transcriptPath: string,
  options: { maxBytes: number; maxRecords: number; diagnostic: SafeDiagnosticSink },
): Promise<unknown[]>;

function readTailRecordsBounded(
  transcriptPath: string,
  options: { maxBytes: number; maxRecords: number; diagnostic: SafeDiagnosticSink },
): Promise<{ records: unknown[]; truncated: boolean }>;
```

**Design Decisions:**

- Suppressing cache writes alone is insufficient: stale persistent reads could
  influence a mutating selection, so `forbid` bypasses both directions.
- Existing defaults remain unchanged to avoid altering session-observer performance or
  cache semantics.
- Handoff always requests `persistence=forbid` and `recency=exact-all`. Its fixed scan
  budget is 50,000 entries, 512 MiB aggregate stat size, 256 KiB/128 records for each
  metadata prefix, and a 30-second deadline. Crossing any bound returns
  `discovery-incomplete` and makes selection/planning unavailable; a partial candidate
  set is never presented as complete.
- Preview reads at most a 2 MiB/10,000-record tail per selected session before applying
  the stricter round/character render limits. Oversize or unreadable previews fail that
  preview only and do not weaken discovery completeness.
- A preview request accepts at most 20 selected candidates and additionally caps the
  whole comparison at 32 MiB/100,000 input records, a 10-second deadline, and 128 KiB
  of rendered conversation text. Crossing any aggregate bound returns one
  `preview-incomplete` result for the batch, with no partial comparison represented as
  complete and no fallback read.

### Candidate Discovery and Preview

**Purpose:** Present safe, deterministic handoff candidates and opt-in context.

**Responsibilities:**

- Map internal `codex` and `claude-code` runtimes to public `codex` and `claude` keys.
- Match canonical recorded cwd exactly to the canonical source path.
- Dedupe by `${provider}:${nativeId}` and order by provider then native ID; modified
  time may be displayed but never drives selection.
- Mark current only from an exact explicit provider/session identity signal. The
  session-observer unique-same-cwd fallback is intentionally ignored.
- Read only the bounded transcript tail through the quiet reader, normalize conversation
  entries, structurally filter tool and command content, apply the shared hidden-payload
  sanitizer, then enforce the stricter round and character rendering bounds.
- Use provider plus shortened ID and safe activity/engagement metadata as labels; do
  not derive a label from conversation content or transcript path.

**Interfaces:**

```typescript
type HandoffProvider = 'codex' | 'claude';
type QualifiedSessionId = `${HandoffProvider}:${string}`;

interface SessionCandidate {
  key: QualifiedSessionId;
  provider: HandoffProvider;
  nativeId: string;
  recordedCwd: string;
  modifiedAtMs: number;
  size: number;
  engagement: 'engaged' | 'unengaged' | 'unknown';
  currentEvidence: 'direct-environment' | 'explicit-self' | 'none';
}

interface PreviewEntry {
  role: 'user' | 'assistant';
  text: string;
}

interface SessionPreview {
  key: QualifiedSessionId;
  rounds: PreviewEntry[][];
  truncated: boolean;
  omittedEntries: number;
  warning: 'hidden-payload-sanitized-not-secret-free';
}

interface PreviewBatchLimits {
  maxCandidates: 20;
  maxAggregateInputBytes: 33_554_432;
  maxAggregateInputRecords: 100_000;
  deadlineMs: 10_000;
  maxAggregateRenderedCharacters: 131_072;
}
```

**Design Decisions:**

- Preview is never part of another schema. This makes accidental plan/result leakage a
  type and serialization boundary, not merely an instruction.
- Default preview limits are 3 rounds and 4,000 characters per candidate; hard maximums
  are 20 rounds and 32 KiB.
- Aggregate bounds are checked before and during each deterministic provider/ID-ordered
  read. Any crossing discards accumulated render data and returns `preview-incomplete`;
  callers never receive a prefix that could be mistaken for the full comparison.
- A malformed/oversized/unreadable transcript yields a safe provider-qualified reason
  code without its transcript path. Discovery never silently omits it; preview never
  falls back to an unbounded read.

### Git Target Validator

**Purpose:** Prove source and target are existing worktrees of the same repository and
capture freshness evidence without moving Git state.

**Responsibilities:**

- Resolve requested paths with `realpath` and reject missing paths or path aliases that
  do not resolve to a registered worktree root.
- Use `git rev-parse` and `git worktree list --porcelain -z` through `execFile`.
- Require source and target to have the same absolute Git common directory and distinct
  canonical worktree roots.
- Read branch/detached state, full HEAD, and porcelain status.
- Expose only dirty boolean and a SHA-256 status fingerprint, not status filenames.
- Recompute all evidence immediately before execution.

**Interfaces:**

```typescript
interface GitWorktreeEvidence {
  requestedPath: string;
  canonicalPath: string;
  worktreeRoot: string;
  commonGitDir: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  statusFingerprint: string;
}

function inspectWorktree(path: string): Promise<GitWorktreeEvidence>;
function validateHandoffTarget(
  sourcePath: string,
  targetPath: string,
): Promise<{ source: GitWorktreeEvidence; target: GitWorktreeEvidence }>;
```

**Design Decisions:**

- Similar remotes are not repository identity. Git common-directory equality is exact
  for local registered worktrees and fails closed for separate clones.
- A distinct dirty source refuses the complete plan. A dirty target is allowed only as
  prominent evidence in the digest because this feature does not transfer source state.

### Provider Contract Adapters

**Purpose:** Keep provider-specific syntax, probe evidence, and behavioral authorization
behind one narrow boundary.

**Responsibilities:**

- Probe version and required help shapes with a 10-second timeout and 64 KiB output cap.
- Normalize capability fingerprints and discard raw help output.
- Construct bounded non-interactive successor argv/cwd that returns machine-readable
  child identity. Keep interactive resume argv as post-handoff guidance, not as the
  operation transport.
- Consult a source-controlled exact-version operation matrix before marking an item
  executable; only reviewed disposable-gate evidence can set an entry to verified.
- Expose a two-step live-gate command (`behavior-plan`, then digest-confirmed
  `behavior-verify`) that creates its own disposable repository/worktrees/sessions,
  performs bounded provider calls, and writes a user-selected mode-0600 receipt.
- Preflight supported provider authentication metadata only. Missing authentication
  returns `provider-auth-required` and names the supported login command; it never reads
  or prints credentials.
- Scan argv for forbidden bypass flags as a defense-in-depth invariant.
- Require the documented Codex `--disable hooks` capability for every gate, successor,
  and source-resumability probe. Normalize and hash the remaining execution context:
  canonical executable bytes, exact version, feature/help fingerprints, safety argv,
  and bounded readable provider configuration inputs with credential values excluded.
  Unreadable context is unsafe; any fingerprint drift defers execution.
- Require Claude's documented `--safe-mode`, `--permission-mode plan`, and empty tool
  set for gate and successor calls. Its execution-context fingerprint binds the
  canonical executable bytes, exact version, normalized help shape, safety argv, and
  non-secret authentication-method metadata; raw credentials and configuration content
  are never read into the receipt or committed matrix.

**Interfaces:**

```typescript
type ContinuityMode = 'successor' | 'resume';

interface CapabilityProbe {
  provider: HandoffProvider;
  executable: string;
  detectedVersion?: string;
  verifiedSyntaxVersion: string;
  status:
    | 'syntax-verified'
    | 'missing'
    | 'version-drift'
    | 'help-shape-drift'
    | 'execution-context-unreadable'
    | 'execution-context-drift'
    | 'probe-failed';
  contractFingerprint?: string;
  executionContextFingerprint?: string;
  missingCapabilities: string[];
}

interface ProviderBehaviorContract {
  provider: HandoffProvider;
  exactVersion: string;
  syntaxFingerprint: string;
  executionContextFingerprint: string;
  successor: {
    status: 'verified' | 'unverified';
    receiptDigest?: string;
    verifiedAt?: string;
  };
  resume: { status: 'unverified' };
}

interface NativeInvocation {
  executable: 'codex' | 'claude';
  argv: string[];
  cwd: string;
  shell: false;
  stdio: 'pipe';
  timeoutMs: 60_000;
  maxOutputBytes: 65_536;
}

interface BehavioralGateReceipt {
  schemaVersion: 1;
  provider: HandoffProvider;
  executablePath: string;
  exactVersion: string;
  syntaxFingerprint: string;
  executionContextFingerprint: string;
  operation: 'successor';
  fixture: {
    repositoryRoot: string;
    sourceWorktree: string;
    targetWorktree: string;
  };
  observations: {
    parentNativeId: string;
    requestedChildNativeId?: string;
    observedChildNativeId: string;
    recordedChildCwd: string;
    exactParentLineage: boolean;
    sourceParentResumable: boolean;
    metadataEffects: string[];
  };
  bounds: {
    calls: number;
    timeoutMsPerCall: number;
    outputBytesPerCall: number;
    maxBudgetUsd?: number;
  };
  cleanup: {
    gitFixture: 'removed' | 'failed';
    providerState: 'removed' | 'failed';
    method:
      | 'codex-delete-exact-session-ids'
      | 'claude-purge-exact-disposable-project-paths';
    reasonCodes: string[];
  };
  status: 'passed' | 'failed' | 'inconclusive';
  reasonCodes: string[];
  createdAt: string;
}
```

Exact successor operation contracts:

```text
Codex successor:
  cwd=target
  argv=[exec, fork, --json, --disable, hooks,
        -c, sandbox_mode="read-only", parentId,
        "Reply exactly HANDOFF_READY. Do not use tools."]
  child ID=parse exact thread.started.thread_id

Claude successor:
  cwd=target
  childId=pre-generated UUID
  argv=[--safe-mode, --print, --output-format, json,
        --resume, parentId, --fork-session, --session-id, childId,
        --permission-mode, plan, --tools, "", --max-budget-usd, 0.15,
        "Reply exactly HANDOFF_READY. Do not use tools."]
  child ID=exact requested UUID corroborated by output session_id and transcript

Post-handoff user guidance:
  Codex:  codex resume -C target childId
  Claude: cwd=target claude --resume childId
```

Installed help establishes these shapes plus `codex delete --force <UUID>` and
`claude project purge -y <path>` cleanup for Codex 0.151.0 and Claude Code 2.1.251.
The non-interactive marker turn is visible in the complete plan and keeps the operation
bounded while producing an exact child ID; it is part of the confirmed mutation.
The implementation begins with all operations `unverified`, then must run the bounded
disposable successor gate for both providers. Passing evidence must include the exact
parent ID, child ID, child runtime/recorded target cwd, source resumability, and metadata
effects. Reviewed evidence changes only the corresponding exact-version successor
entry to `verified` and binds it to the normalized syntax fingerprint,
execution-context fingerprint, and SHA-256 of the reviewed raw receipt. Exact IDs and
fixture paths remain in the local receipt and do not enter committed product output;
the committed matrix stores only the digest, exact version, redacted fingerprints,
date, and pass status. Resume remains `unverified` unless a separate writer-closed
proof contract is added. Failure to verify either installed successor is a product
blocker.

`behavior-plan` reports provider, detected authentication/version, disposable fixture
shape, calls, prompts, bounds, cleanup limitations, and a confirmation digest without
mutation. `behavior-verify --confirm DIGEST --receipt NEW_PATH` recomputes that plan,
requires an unused receipt path, runs the gate, writes the raw receipt atomically with
mode 0600, and prints only its digest/status. Matrix activation is a reviewed source
change whose tests recompute the receipt digest and syntax fingerprint; no runtime flag
can activate or override a contract. Those tests also recompute the redacted
execution-context fingerprint projection used by the gate and plan.

After capturing all behavioral evidence, the verifier performs exact provider-owned
cleanup before finalizing the receipt. Codex 0.151.0 uses `codex delete --force
<child-id>` followed by the exact parent ID. Claude Code 2.1.251 uses `claude project
purge -y <target-worktree>` followed by the exact source worktree; these paths are fresh
fixture roots, so the documented project-scoped command deletes only provider state
created for the disposable gate. The verifier then removes the temporary Git
worktrees/repository, records every cleanup outcome, atomically writes the final
mode-0600 receipt, and only then hashes it. A failed cleanup makes the gate
`inconclusive` and blocks matrix activation. Provider telemetry/caches and consumed
quota may remain and are stated as irreversible limitations. Direct provider-store
unlinking is forbidden.

### Handoff Orchestrator

**Purpose:** Enforce selection, safety policy, plan freshness, confirmation, execution,
and outcome semantics without durable state.

**Responsibilities:**

- Validate provider-qualified selection or explicit all selection.
- Classify every item `ready`, `deferred`, or `refused` with stable reason codes.
- Refuse resume when writer proof is absent. A current active parent turn is deferred;
  successor execution itself is non-interactive and does not require a TTY.
- Create a canonical JSON projection and SHA-256 confirmation digest.
- Rebuild the full plan on execute and require the supplied digest.
- Spawn only ready items sequentially with bounded captured stdio and shell disabled.
- Parse the minimum exact child-ID fields from bounded provider machine output, then
  discard raw stdout/stderr and retain only exit/signal plus safe reason codes.
- Corroborate Codex `thread.started.thread_id` against child metadata
  (`payload.id`, `payload.cwd`, `payload.forked_from_id`). Corroborate Claude's
  pre-generated UUID against output `session_id`, the exact transcript filename/
  records, target cwd, and inherited parent-record UUID prefix observed by the gate.
- Classify timeout/termination as `indeterminate` unless exact child corroboration proves
  creation; indeterminate operations are never automatically retryable.
- Produce retry keys from failed/deferred native outcomes, never native successes.

**Interfaces:**

```typescript
type PlanDisposition = 'ready' | 'deferred' | 'refused';

interface HandoffPlanItem {
  key: QualifiedSessionId;
  parentNativeId: string;
  provider: HandoffProvider;
  mode: ContinuityMode;
  disposition: PlanDisposition;
  reasonCodes: string[];
  expectedChildNativeId?: string;
  invocation?: NativeInvocation;
}

interface HandoffPlan {
  schemaVersion: 1;
  source: GitWorktreeEvidence;
  target: GitWorktreeEvidence;
  selected: QualifiedSessionId[];
  baselineTargetIds: QualifiedSessionId[];
  capabilities: CapabilityProbe[];
  items: HandoffPlanItem[];
  confirmationDigest: string;
}

type NativeOutcome =
  | {
      status: 'not-run' | 'refused';
      retryable: false;
      reasonCode: string;
    }
  | { status: 'deferred'; retryable: true; reasonCode: string }
  | { status: 'succeeded'; retryable: false; exitCode: 0 }
  | {
      status: 'failed';
      retryable: true;
      failureBoundary: 'before-child-creation';
      exitCode: number | null;
      signal?: string | null;
      reasonCode: string;
    }
  | {
      status: 'indeterminate';
      retryable: false;
      exitCode?: number | null;
      signal?: string | null;
      reasonCode: string;
    };

type NotAttemptedReporting = { status: 'not-attempted'; reasonCode?: string };
type MappedReporting = {
  status: 'mapped';
  childNativeId: string;
  evidence: 'machine-output-and-transcript';
};
type UnmappedReporting = {
  status: 'ambiguous' | 'unresolved' | 'failed';
  reasonCode: string;
  candidateChildIds?: string[];
};
type ReportingOutcome = NotAttemptedReporting | MappedReporting | UnmappedReporting;

interface ItemOutcomeBase {
  key: QualifiedSessionId;
  parentNativeId: string;
  expectedChildNativeId?: string;
  targetBaselineIds: QualifiedSessionId[];
  reporting: ReportingOutcome;
}

type ItemOutcome =
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'succeeded' }>;
      observedChildNativeId: string;
      reporting: MappedReporting | UnmappedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'indeterminate' }>;
      observedChildNativeId: string;
      reporting: MappedReporting | UnmappedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'indeterminate' }>;
      observedChildNativeId?: never;
      reporting: UnmappedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'failed' }>;
      observedChildNativeId?: never;
      reporting: NotAttemptedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'not-run' | 'deferred' | 'refused' }>;
      observedChildNativeId?: never;
      reporting: NotAttemptedReporting;
    });

interface BatchOutcome {
  schemaVersion: 1;
  planDigest: string;
  items: ItemOutcome[];
  retryableKeys: QualifiedSessionId[];
}
```

The canonical digest projection includes schema version, canonical worktree evidence,
selected IDs, candidate stat signatures without transcript paths, continuity mode,
capability and execution-context fingerprints, behavior-contract state, any
pre-generated child selector, item dispositions, and argv/cwd. It excludes display
labels, timestamps, preview, raw Git status, and raw provider output.

For Claude, `expectedChildNativeId` is the pre-generated UUID from the confirmed plan.
For either provider, `observedChildNativeId` is retained as soon as bounded machine
output parses it, independently from transcript corroboration. `succeeded` requires an
observed child ID; `indeterminate` may retain an expected and/or observed ID. `mapped`
requires the corroborated child ID to equal the applicable selector. `unresolved` and
`ambiguous` preserve safe selectors plus the provider-qualified target baseline so
`reconcile` can retry only exact ID/lineage/cwd evidence. A parsed but uncorroborated ID
is displayed as `observed-unverified`, never as an exact mapping. These selector fields
do not make a successful or indeterminate native operation retryable.

`failed` additionally requires `failureBoundary: before-child-creation`, forbids every
observed/candidate/mapped child field, and is the only non-deferred retryable terminal
state. Any nonzero, signaled, or timed-out call for which child creation cannot be
excluded is `indeterminate`, even when no child ID was parsed. Runtime schema validation
rejects `failed + observed`, `failed + mapped`, a mapped ID that differs from the
observed/expected selector, and any `retryableKeys` member whose item has child evidence.
`retryableKeys` is exactly the set of `deferred` and proven-before-child `failed` items.

### CLI and Renderers

**Purpose:** Provide a scriptable contract and concise human output without owning
policy.

**Interfaces:**

```text
discover --source PATH [--provider codex|claude|all] [--json]
preview --source PATH --session PROVIDER:ID... [--rounds N] [--max-chars N] [--json]
plan --source PATH --target PATH (--session PROVIDER:ID...|--all)
     --mode successor|resume [--json]
execute --source PATH --target PATH (--session PROVIDER:ID...|--all)
        --mode successor|resume --confirm SHA256 [--json]
reconcile --source PATH --target PATH --input PATH|- [--json]
behavior-plan --provider codex|claude [--json]
behavior-verify --provider codex|claude --confirm SHA256 --receipt NEW_PATH [--json]
```

**Validation Rules:**

- `--session` is repeatable and mutually exclusive with `--all`.
- There is no implicit or recency selector and no bare native ID.
- `execute` never accepts `plan` mode or a force/unverified bypass.
- Reconcile input is capped at 1 MiB and strictly validated as a v1 batch outcome.
- Reconcile requires the retained expected/observed selector and target baseline for
  every successful or indeterminate item; it refuses inputs that would require recency
  or target-set inference.
- Native successor subprocesses use bounded pipe capture, so provider control traffic
  never reaches the handoff CLI's stdout; `--json` still emits exactly one envelope.
- `behavior-verify` refuses an existing receipt path and unavailable provider auth. It
  emits no raw provider output, IDs, fixture paths, or credentials to stdout.
- JSON errors use stable `code`, `message`, and safe `details`; human errors never
  include transcript paths or raw subprocess output.

## Data Models

Normal handoff objects are ephemeral in-memory values serialized only to stdout when
the user requests human or JSON output. The runtime creates no state directory or
registry. The development/revalidation-only `behavior-verify` command is the sole
exception: after separate digest confirmation it writes one explicitly selected,
mode-0600 raw evidence receipt so a reviewer can validate matrix activation. That
receipt is not consulted at runtime, is never auto-discovered, and is not committed;
the source-controlled matrix retains only its digest and redacted contract metadata.

Candidate native IDs and worktree paths are operational metadata and may appear in
plans/results. Transcript file paths and transcript bodies may not. Preview has its own
output type and cannot be embedded in a plan or outcome.

Shared Codex metadata gains separate `nativeSessionId` (`payload.id`), optional
`rootSessionId` (`payload.session_id`), and optional `forkedFromSessionId`
(`payload.forked_from_id`); existing callers retain their current `sessionId` contract.
The successor path requires all three observed values it uses to agree with the parsed
`thread.started.thread_id`, selected parent, and target cwd.

Claude successor identity is explicit rather than inferred: the runtime pre-generates a
child UUID and passes it through provider-supported `--session-id` together with
`--resume PARENT --fork-session`. It requires output `session_id`, child transcript
identity/records, and target cwd to match that exact UUID. The disposable gate also
proves that the parent's ordered pre-fork record UUIDs are inherited by the child and
that resuming the source parent does not change the child. Production reconciliation
never uses recency or set-size inference. Same-ID resume, if ever enabled, maps to the
parent ID by definition.

## API Design

There is no network API. The public machine interface is the CLI JSON schema and the
public conversational interface is the skill.

### JSON Envelope

Successful commands emit exactly one object:

```typescript
interface SuccessEnvelope<T> {
  ok: true;
  command:
    | 'discover'
    | 'preview'
    | 'plan'
    | 'execute'
    | 'reconcile'
    | 'behavior-plan'
    | 'behavior-verify';
  data: T;
}

interface ErrorEnvelope {
  ok: false;
  command?: string;
  error: { code: string; message: string; details?: Record<string, unknown> };
}
```

Exit codes are `0` for a valid command result (including an itemized plan with deferred
items), `2` for user/selection/target errors, `3` for capability or safety refusal,
and `4` for unexpected bounded system failures. Native provider failure appears inside
a valid batch outcome and uses exit code `0`; orchestration must inspect item states.

### Skill Interaction Contract

The skill must:

1. Run discovery for the exact current/source worktree and show every candidate.
2. Offer preview only on request and display the sanitizer warning.
3. Require explicit one/many/all selection and an existing target path.
4. Run plan and show Git, capability, mode, item dispositions, and exact commands.
5. Ask for explicit confirmation of the displayed digest before execute.
6. Explain that current/unverified/multi-host-limited items are post-turn deferrals, not
   native success.
7. Run execute only after confirmation; never fabricate child mappings.
8. When reporting is `mapped`, show the exact verified parent→child mapping and the
   provider-native command that opens the child in the target worktree. For unresolved
   native success, show the safe `observed-unverified` child selector and read-only
   reconcile guidance without claiming a verified mapping.
9. Report each native and reporting outcome and retry only listed keys.

## Security Considerations

### Authentication

No new authentication layer is introduced. Provider CLIs use the invoking user's
existing local authentication. The runtime never reads or prints credential stores.

### Authorization

OS filesystem permissions and provider CLI authentication govern access. Mutation also
requires an exact recomputed confirmation digest. This digest is a freshness/intent
token, not a security credential.

### Data Protection

- Provider stores and transcripts are immutable inputs.
- Paths and IDs are passed as argv, never interpolated into a shell command.
- ANSI/control sequences are stripped from bounded probe diagnostics.
- Raw help, raw provider output, Git filenames, transcript paths, and previews never
  enter plans/results.
- Preview is explicitly opt-in and warns that human-pasted secrets may remain.

### Threat Mitigation

- **Prompt injection in transcripts:** Only data parsing occurs; transcript content is
  never interpreted as instructions. Structural filtering and sanitization precede
  rendering.
- **Path/ID injection:** Realpath, provider-qualified ID parsing, strict schemas, argv
  arrays, and shell-disabled subprocesses.
- **TOCTOU plan drift:** Full rediscovery, Git inspection, probe, contract lookup, and
  digest comparison immediately before launch.
- **Concurrent writer:** Resume refuses unknown state; recency/mtime never proves
  closure.
- **Unrelated target child:** Reconciliation requires exact lineage, never newest-only.
- **Capability drift:** Exact-version/help mismatch and unverified behavior defer.
- **Execution-context drift:** Codex hooks are disabled through documented provider
  syntax; safe-mode/argv and redacted configuration fingerprints are revalidated and
  unreadable or changed context defers.
- **Gate residue:** Cleanup uses exact provider-owned IDs or fresh fixture project paths,
  runs before receipt finalization, and any failure makes the receipt inconclusive.
- **Unsafe override pressure:** No force, allow-unverified, or bypass option exists.

## Performance Considerations

Exact discovery uses the new quiet bounded prefix reader and a request-local metadata
cache while persistent Codex cache access and the seven-day cutoff are disabled.
Completeness is all-or-error within 50,000 store entries, 512 MiB aggregate stat size,
256 KiB/128 metadata records per entry, and 30 seconds. Candidates are sorted
deterministically only after every entry is classified. Preview reads at most 20
selected candidates through a 2 MiB/10,000-record bounded tail, with a 32 MiB/100,000
record/10-second aggregate input cap, then applies per-candidate and 128 KiB aggregate
render limits. No path-bearing shared warning is used.

Provider probes are sequential per provider and bounded to 10 seconds and 64 KiB per
invocation. Native marker calls and live-gate calls are bounded to 60 seconds and 64 KiB
per call; Claude additionally uses a $0.15 maximum per call. Git commands have a
10-second timeout and bounded output; an oversized porcelain result becomes a safe
failure rather than partial evidence. Reconcile reads at most 1 MiB of input. The
expected scale is local developer session stores, not an unbounded service workload.

No database, network service, cache TTL, or horizontal scaling design applies.

## Error Handling

### Error Categories

- **User/input:** Invalid option combinations, bare/unknown IDs, empty selection,
  nonexistent target, same source/target.
- **Safety refusal:** Distinct dirty source, distinct repository, unknown writer for
  resume, incomplete exact discovery, stale confirmation, provider auth unavailable,
  capability/behavior drift, forbidden flag invariant.
- **Deferral:** Current active parent turn, unverified behavioral contract, or execution
  timing that cannot be observed honestly.
- **Native failure:** Provider fails before any child is corroborated.
- **Native indeterminate:** Timeout/termination or malformed provider output where child
  creation cannot be proved or disproved; never automatically retryable.
- **Reporting failure:** Exact child lineage is absent, ambiguous, or cannot be read.
- **System:** Bounded file/Git/probe errors, malformed transcript records, or invalid
  reconciliation input.

### Retry Logic

Discovery, preview, and plan are safe to rerun after correcting an incomplete-input
condition. Native operations are never retried by the runtime automatically. The batch
outcome exposes only definitively failed-before-child or deferred native keys; refused,
succeeded, and indeterminate items are excluded. The caller must build and reconfirm a
fresh plan for eligible keys. Reporting reconciliation is read-only and may be rerun for
a native success or indeterminate item without rerunning the provider.

### Logging

There is no persistent log. Human stderr and JSON errors contain command category,
provider, provider-qualified ID, and safe reason code. They exclude transcript paths,
body content, raw provider output, raw help, credentials, and Git filenames.

## Testing Strategy

### Requirement-to-Test Mapping

| ID | Verification | Key Scenarios |
| --- | --- | --- |
| FR1 | unit + integration | multiple Codex/Claude candidates including Codex older than seven days; exact vs sister/global cwd; provider ID collision; direct-only current identity; incomplete-budget refusal |
| FR2 | unit | bounded tail/prefix reads; hidden/control/tool filtering; per-candidate and aggregate candidate/input/time/render bounds; malformed/oversized records; all-or-error comparison; path-free diagnostics; no preview in plan/result serialization |
| FR3 | unit + CLI | single, repeated, all, mutual exclusion, bare/unknown/duplicate IDs, no recency option |
| FR4 | unit + integration | missing/non-worktree target, separate clone, symlink alias, detached HEAD, dirty source/target, changed evidence |
| FR5 | unit + CLI | successor default, resume unknown-writer refusal, current-turn and plan-only decisions |
| FR6 | unit + live gate | exact version/help/auth, timeout/output cap, version/context drift, hook isolation, receipt schema/digest/fingerprint/cleanup binding, required two-worktree activation |
| FR7 | unit + CLI | canonical digest, wrong/missing digest, candidate/Git/capability drift, preview exclusion |
| FR8 | unit + live gate | exact non-interactive successor argv/marker, shell false, bounded machine output, exact child IDs, current/unverified deferrals, no forbidden flags |
| FR9 | unit + live gate | Codex metadata lineage, predetermined Claude UUID plus inherited-prefix corroboration, expected/observed selectors and baselines, cross-discriminated partial/indeterminate outcomes, failed-before-child proof, native/reporting independence, exact reconcile, retry safety |
| FR10 | integration | public skill inventory, frontmatter/version, docs/navigation, generated runtime and provider sync |
| NFR1 | integration | stale cache ignored; empty state remains absent; observer/transcript/provider byte identity |
| NFR2 | unit + integration | no transcript body/path/raw output/credentials in plan, errors, outcome, or digest inputs |
| NFR3 | unit | adversarial IDs/paths/help, ANSI/control output, ambiguous repository/writer/lineage, hook isolation, execution-context drift, no shell |
| NFR4 | build | bundled generated output, source/output sync, no runtime dependency |
| NFR5 | unit + integration | all-or-error discovery scan and preview batch, prefix/tail, probe, Git, native, and reconcile caps; deterministic ordering |
| NFR6 | integration | focused suites, full tests, validate, build check, smoke, docs index, provider install views |

### Unit Tests

- Test leaf selection, schema validation, canonical digest projection, policy decisions,
  invocation builders, forbidden-flag scanner, mixed outcomes, and renderers with no
  provider process.
- Reject failed-plus-observed, failed-plus-mapped, selector mismatch, and any retry key
  carrying child evidence; require indeterminate for every uncertain creation boundary.
- Use existing transcript sanitization fixtures plus handoff-specific preview bounds.
- Mock `execFile`/spawn boundaries with literal malicious paths and IDs.

### Integration Tests

- Build temporary Codex and Claude stores with exact, sister, and global cwd records,
  including an exact Codex record older than seven days.
- Assert `persistence=forbid` ignores a seeded stale Codex cache and leaves an empty
  state directory nonexistent.
- Assert entry/aggregate/prefix/tail/deadline overflow returns safe incomplete or preview
  errors without a partial discovery result or transcript path.
- Assert 21-candidate, aggregate-byte, aggregate-record, aggregate-render, and deadline
  preview crossings return one incomplete batch and no partial comparison.
- Create temporary Git repository worktrees for same-common-dir and separate-clone
  cases; assert status fingerprints and drift behavior.
- Exercise CLI commands as subprocesses with fixture environment variables and mocked
  provider binaries.
- Exercise Codex hook disablement plus execution-context fingerprint match, drift, and
  unreadable-input deferral without retaining configuration or credential content.

### End-to-End Tests

The normal suite uses mocked provider CLIs and must prove both verified-execution and
unverified-plan/deferred behavior without real mutation, including exact machine-output
parsing and raw-output isolation from the JSON envelope. A bounded live-provider gate
creates a disposable Git repository with two worktrees and disposable Codex/Claude
parent sessions, invokes each native successor contract, captures exact parent/child
identity, verifies the child target cwd, proves the source parent remains resumable, and
records metadata effects. Codex parses `thread.started.thread_id` and corroborates
`payload.id/cwd/forked_from_id`; Claude pre-generates `--session-id`, requires matching
output/transcript records and target cwd, and proves the inherited parent UUID prefix
plus later source-only resume record. The gate is explicitly authorized for the current
implementation and exact installed versions. It must use no real project session, no
bypass flag, and a strict prompt/quota/time bound. Codex uses documented hook
disablement, both providers bind their reviewed execution-context fingerprints, and
final receipts include provider/Git cleanup outcomes before hashing. A reviewer
validates each local raw receipt before its digest and fingerprints activate canonical
source. Only then do the normal tests switch the exact contract to verified. Either
provider's failure blocks v1 completion.

## Deployment Strategy

### Build Process

- Add the canonical TypeScript entry to the generated-output mapping with bundling
  enabled.
- Run the repository build to generate the committed dependency-free `.mjs` runtime.
- Version the new skill at 1.0.0 with matching top-level and metadata versions.
- Run the bounded disposable live successor gate for exact installed Codex and Claude
  versions, review its evidence, and record only passing contracts in canonical source.

### Deployment Steps

1. Land canonical runtime, generated output, skill instructions, tests, and docs in one
   local branch.
2. Run focused tests, build check, validation, full Vitest, smoke, docs/navigation, and
   provider-sync verification.
3. Keep user-level installation on main until the branch is merged; do not publish the
   branch version machine-wide during this task.

### Rollback Plan

Revert the feature commits. No runtime registry, provider-store migration, background
service, or external state requires rollback.

### Configuration and Monitoring

No feature flag, service configuration, metric, alert, or dashboard is introduced.
Provider syntax and behavior contracts are source-controlled and visible in plan
output.

## Migration Plan

No database, data, provider-store, or compatibility migration is required. The shared
discovery API change is additive and defaults to current persistence behavior. Rollback
is a code revert; existing session-observer behavior remains unchanged.

## Open Questions

**Nonblocking follow-up:**

- Which future provider/host signal can supply conservative writer-closed proof for
  same-ID resume?

**Blocking implementation gates:**

- Does exact Codex 0.151.0 successor execution corroborate returned child ID, target
  cwd, `forked_from_id`, and source parent resumability?
- Does exact Claude Code 2.1.251 successor execution honor the pre-generated child UUID,
  target cwd, inherited parent UUID prefix, and source parent resumability? Claude is
  currently unauthenticated on this host, so the supported `claude auth login` flow is
  a prerequisite; credentials must never be pasted into chat or captured in receipts.

Both successor questions must pass during implementation. A negative, unauthenticated,
or unobservable result blocks v1 completion rather than reducing the product to
plan-only. The same-ID question does not block v1 because resume remains explicitly
refused.

## Implementation Phases

### Phase 1: Read-only discovery and preview

**Goal:** Add the zero-persistence shared seam and safe exact-worktree candidate/preview
behavior.

**Tasks:**

- Test and add persistent-cache/recency bypass plus bounded quiet prefix/tail readers to
  shared discovery.
- Implement provider-qualified exact candidate discovery and direct-only current
  evidence with all-or-error completeness budgets.
- Implement per-candidate and aggregate all-or-error bounded sanitized preview without
  plan/result coupling.

**Verification:** Focused transcript-core/session-observer and new discovery/preview
tests pass; empty/stale state remains unchanged.

### Phase 2: Git evidence and immutable planning

**Goal:** Validate existing worktrees, explicit selection, mode policy, and complete
digest-confirmed plans.

**Tasks:**

- Implement typed Git worktree evidence and dirty safety.
- Implement selection/mode resolution and canonical plan digest.
- Add CLI discover, preview, and plan commands plus JSON/human schemas.

**Verification:** Temporary Git worktree and CLI plan suites pass with drift and
adversarial-input coverage.

### Phase 3: Provider contracts and outcome orchestration

**Goal:** Add bounded provider probes, exact invocation planning, safe execute gating,
and read-only reconciliation.

**Tasks:**

- Implement Codex/Claude syntax probes, behavior matrix, invocation builders, and
  forbidden-flag checks, including Codex hook isolation and privacy-safe
  execution-context fingerprints.
- Implement confirmation revalidation, bounded non-interactive native outcome parsing,
  exact child corroboration, indeterminate handling, and no automatic retries.
- Extend exact Codex lineage/native ID extraction, implement predetermined Claude child
  UUID corroboration, retain expected/observed selectors and target baselines, and add
  exact read-only reconcile outcomes.
- Implement `behavior-plan`/`behavior-verify`, receipt validation/redaction rules, auth
  preflight, digest/fingerprint binding, and exact provider-owned disposable fixture
  cleanup with cleanup-before-receipt finalization.
- Run the required Codex and Claude successor gates, submit both raw receipts for
  independent evidence review, then activate only reviewed passing exact-version
  contracts in canonical source.

**Verification:** Mock provider and outcome suites prove every ready/defer/refuse/native/
reporting/indeterminate state. Both exact installed successor receipts pass independent
review, their digests/fingerprints/cleanup outcomes match canonical contracts, and an
exact-version/context-matching mocked/native plan becomes executable while drift remains
deferred.

### Phase 4: Public skill and repository integration

**Goal:** Ship a clear provider-neutral workflow with generated runtime, documentation,
and repository contract coverage.

**Tasks:**

- Author versioned public skill instructions and bundled generated runtime mapping.
- Add public inventory, release-version, docs/navigation, and provider-sync coverage.
- Run full repository gates and remediate independent final review findings.

**Verification:** Build check, validate, full tests, smoke, docs, and installation
compatibility pass.

## Dependencies

### External Dependencies

- **Git CLI:** Existing local repository/worktree evidence only.
- **Codex CLI 0.151.0:** Syntax probe and planned native fork/resume boundary.
- **Claude Code 2.1.251:** Syntax probe and planned native successor/resume boundary.

### Internal Dependencies

- Shared transcript runtime readers and metadata extraction.
- Session-observer location/classification cache substrate.
- Export-session structural normalization and hidden-payload sanitizer.
- Generated-runtime builder, validators, repository tests, and docs index tooling.

### Development Dependencies

- Existing Vitest, TypeScript, oxlint, and oxfmt developer tooling only. No shipped
  runtime dependency is added.

## Risks and Mitigation

- **Discovery cache regression:** Probability Medium | Impact High
  - **Mitigation:** Additive default-preserving API and focused default/forbid tests.
  - **Contingency:** Keep handoff plan-only until zero-write behavior is restored.
- **Provider behavior overclaim:** Probability High | Impact High
  - **Mitigation:** Source-controlled exact-version behavior matrix defaults to
    unverified; the required disposable gates and independent evidence review are the
    only path to verified successor execution.
  - **Contingency:** Unverified versions emit precise post-turn plan/defer guidance; if
    either exact installed successor cannot be verified, stop completion and report a
    product blocker.
- **Writer concurrency:** Probability High | Impact High
  - **Mitigation:** Resume requires real closed-writer proof, absent in v1.
  - **Contingency:** Use successor or plan mode.
- **Transcript privacy:** Probability Medium | Impact High
  - **Mitigation:** Opt-in bounded structural filter plus hidden-payload sanitizer;
    previews excluded from all other schemas.
  - **Contingency:** Use metadata-only discovery.
- **Partial native/reporting outcome:** Probability Medium | Impact Medium
  - **Mitigation:** Independent outcome states, exact lineage only, no successful-parent
    retry.
  - **Contingency:** Rerun read-only reconcile or continue with the native ID manually.
- **Generated/source drift:** Probability Medium | Impact Medium
  - **Mitigation:** Bundled canonical TypeScript mapping and build-sync tests.
  - **Contingency:** Regenerate from canonical source before commit.

## References

- Specification: `spec.md`
- Discovery: `discovery.md`
- Knowledge base: `.oat/repo/knowledge/project-index.md`
- Architecture: `.oat/repo/knowledge/architecture.md`
- Conventions: `.oat/repo/knowledge/conventions.md`
- Testing: `.oat/repo/knowledge/testing.md`
