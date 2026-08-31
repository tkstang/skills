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
11. Launch only ready items through provider-native argv with shell=false and TTY
    inheritance; record exit/signal without capturing provider content.
12. Rediscover target candidates and reconcile only exact parent/child lineage.
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

- Extend `discover` and exact-ID lookup with an optional persistence policy.
- Preserve `default` behavior for current consumers.
- Under `forbid`, bypass both load and save of `codex-cwd-cache.json`.
- Continue using only the request-local bounded classification cache.
- Derive Codex cwd and identity through existing record readers/metadata extraction.

**Interfaces:**

```typescript
interface DiscoveryOptions {
  persistence?: 'default' | 'forbid';
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
```

**Design Decisions:**

- Suppressing cache writes alone is insufficient: stale persistent reads could
  influence a mutating selection, so `forbid` bypasses both directions.
- Existing defaults remain unchanged to avoid altering session-observer performance or
  cache semantics.

### Candidate Discovery and Preview

**Purpose:** Present safe, deterministic handoff candidates and opt-in context.

**Responsibilities:**

- Map internal `codex` and `claude-code` runtimes to public `codex` and `claude` keys.
- Match canonical recorded cwd exactly to the canonical source path.
- Dedupe by `${provider}:${nativeId}` and order by provider then native ID; modified
  time may be displayed but never drives selection.
- Mark current only from an exact explicit provider/session identity signal. The
  session-observer unique-same-cwd fallback is intentionally ignored.
- Read candidate records, normalize conversation entries, structurally filter tool and
  command content, apply the shared hidden-payload sanitizer, then bound rounds and
  characters.
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
```

**Design Decisions:**

- Preview is never part of another schema. This makes accidental plan/result leakage a
  type and serialization boundary, not merely an instruction.
- Default preview limits are 3 rounds and 4,000 characters per candidate; hard maximums
  are 20 rounds and 32 KiB.

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
- Construct exact argv/cwd for Codex fork/resume and Claude successor/resume.
- Consult a source-controlled exact-version operation matrix before marking an item
  executable; only reviewed disposable-gate evidence can set an entry to verified.
- Scan argv for forbidden bypass flags as a defense-in-depth invariant.

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
    | 'probe-failed';
  contractFingerprint?: string;
  missingCapabilities: string[];
}

interface ProviderBehaviorContract {
  provider: HandoffProvider;
  exactVersion: string;
  successor: 'verified' | 'unverified';
  resume: 'verified' | 'unverified';
  evidenceNote: string;
}

interface NativeInvocation {
  executable: 'codex' | 'claude';
  argv: string[];
  cwd: string;
  shell: false;
  stdio: 'inherit';
}
```

Exact syntax contracts:

```text
Codex successor: cwd=target, argv=[fork, -C, target, parentId]
Codex resume:    cwd=target, argv=[resume, -C, target, parentId]
Claude successor:cwd=target, argv=[--resume, parentId, --fork-session]
Claude resume:   cwd=target, argv=[--resume, parentId]
```

Installed help establishes these shapes for Codex 0.151.0 and Claude Code 2.1.251.
The implementation begins with all operations `unverified`, then must run the bounded
disposable successor gate for both providers. Passing evidence must include the exact
parent ID, child ID, child runtime/recorded target cwd, source resumability, and metadata
effects. Reviewed evidence changes only the corresponding exact-version successor
entry to `verified`. Resume remains `unverified` unless a separate writer-closed proof
contract is added. Failure to verify either installed successor is a product blocker.

### Handoff Orchestrator

**Purpose:** Enforce selection, safety policy, plan freshness, confirmation, execution,
and outcome semantics without durable state.

**Responsibilities:**

- Validate provider-qualified selection or explicit all selection.
- Classify every item `ready`, `deferred`, or `refused` with stable reason codes.
- Refuse resume when writer proof is absent; defer current-turn and non-TTY execution.
- Create a canonical JSON projection and SHA-256 confirmation digest.
- Rebuild the full plan on execute and require the supplied digest.
- Spawn only ready items sequentially with inherited stdio and shell disabled.
- Record only exit code/signal, never provider stdout/stderr content.
- Reconcile successors against a target baseline using exact lineage only.
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

interface NativeOutcome {
  status: 'not-run' | 'deferred' | 'refused' | 'succeeded' | 'failed';
  exitCode?: number | null;
  signal?: string | null;
  retryable: boolean;
  reasonCode?: string;
}

interface ReportingOutcome {
  status: 'not-attempted' | 'mapped' | 'ambiguous' | 'unresolved' | 'failed';
  childNativeId?: string;
  candidateChildIds?: string[];
  reasonCode?: string;
}

interface ItemOutcome {
  key: QualifiedSessionId;
  parentNativeId: string;
  native: NativeOutcome;
  reporting: ReportingOutcome;
}

interface BatchOutcome {
  schemaVersion: 1;
  planDigest: string;
  items: ItemOutcome[];
  retryableKeys: QualifiedSessionId[];
}
```

The canonical digest projection includes schema version, canonical worktree evidence,
selected IDs, candidate stat signatures without transcript paths, continuity mode,
capability fingerprints, behavior-contract state, item dispositions, and argv/cwd. It
excludes display labels, timestamps, preview, raw Git status, and raw provider output.

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
```

**Validation Rules:**

- `--session` is repeatable and mutually exclusive with `--all`.
- There is no implicit or recency selector and no bare native ID.
- `execute` never accepts `plan` mode or a force/unverified bypass.
- Reconcile input is capped at 1 MiB and strictly validated as a v1 batch outcome.
- JSON errors use stable `code`, `message`, and safe `details`; human errors never
  include transcript paths or raw subprocess output.

## Data Models

All handoff objects are ephemeral in-memory values serialized only to stdout when the
user requests human or JSON output. The runtime creates no state directory or registry.
The only persistent feature data is source-controlled code, tests, documentation, and
the generated runtime.

Candidate native IDs and worktree paths are operational metadata and may appear in
plans/results. Transcript file paths and transcript bodies may not. Preview has its own
output type and cannot be embedded in a plan or outcome.

To support exact Codex successor reconciliation, shared extracted metadata may gain an
optional `forkedFromSessionId`. Unknown providers and Claude records leave it absent.
The orchestrator maps a child only when exactly one newly discovered target candidate
has an exact parent ID match. Same-ID resume, if ever enabled, maps to the parent ID by
definition.

## API Design

There is no network API. The public machine interface is the CLI JSON schema and the
public conversational interface is the skill.

### JSON Envelope

Successful commands emit exactly one object:

```typescript
interface SuccessEnvelope<T> {
  ok: true;
  command: 'discover' | 'preview' | 'plan' | 'execute' | 'reconcile';
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
8. Report each native and reporting outcome and retry only listed keys.

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
- **Unsafe override pressure:** No force, allow-unverified, or bypass option exists.

## Performance Considerations

Discovery retains the existing bounded record readers and a request-local metadata
cache, while persistent Codex cache access is disabled for correctness. Candidates are
sorted deterministically after deduplication. Preview reads only selected candidates
and truncates after its round/character budget.

Provider probes are sequential per provider and bounded to 10 seconds and 64 KiB per
invocation. Git commands have a 10-second timeout and bounded output; an oversized
porcelain result becomes a safe failure rather than partial evidence. Reconcile reads at
most 1 MiB of input. The expected scale is local developer session stores, not an
unbounded service workload.

No database, network service, cache TTL, or horizontal scaling design applies.

## Error Handling

### Error Categories

- **User/input:** Invalid option combinations, bare/unknown IDs, empty selection,
  nonexistent target, same source/target.
- **Safety refusal:** Distinct dirty source, distinct repository, unknown writer for
  resume, stale confirmation, capability/behavior drift, forbidden flag invariant.
- **Deferral:** Current turn, non-TTY host, unverified behavioral contract, or execution
  timing that cannot be observed honestly.
- **Native failure:** Provider exits nonzero or by signal after launch.
- **Reporting failure:** Exact child lineage is absent, ambiguous, or cannot be read.
- **System:** Bounded file/Git/probe errors, malformed transcript records, or invalid
  reconciliation input.

### Retry Logic

Discovery, preview, and plan are safe to rerun. Native operations are never retried by
the runtime automatically. The batch outcome exposes only failed/deferred native keys;
the caller must build and reconfirm a fresh plan for those keys. Reporting reconciliation
is read-only and may be rerun for a native success without rerunning the provider.

### Logging

There is no persistent log. Human stderr and JSON errors contain command category,
provider, provider-qualified ID, and safe reason code. They exclude transcript paths,
body content, raw provider output, raw help, credentials, and Git filenames.

## Testing Strategy

### Requirement-to-Test Mapping

| ID | Verification | Key Scenarios |
| --- | --- | --- |
| FR1 | unit + integration | multiple Codex/Claude candidates; exact vs sister/global cwd; provider ID collision; direct-only current identity |
| FR2 | unit | hidden/control/tool filtering; round/char bounds; malformed records; no preview in plan/result serialization |
| FR3 | unit + CLI | single, repeated, all, mutual exclusion, bare/unknown/duplicate IDs, no recency option |
| FR4 | unit + integration | missing/non-worktree target, separate clone, symlink alias, detached HEAD, dirty source/target, changed evidence |
| FR5 | unit + CLI | successor default, resume unknown-writer refusal, current-turn and plan-only decisions |
| FR6 | unit + manual | exact version/help, missing binary/token, timeout/output cap, version drift, unverified behavior, opt-in two-worktree matrix |
| FR7 | unit + CLI | canonical digest, wrong/missing digest, candidate/Git/capability drift, preview exclusion |
| FR8 | unit + manual | four exact argv shapes, shell false, TTY/current/unverified deferrals, no forbidden flags |
| FR9 | unit | partial native success, unresolved/ambiguous lineage, native/reporting independence, retry key safety |
| FR10 | integration | public skill inventory, frontmatter/version, docs/navigation, generated runtime and provider sync |
| NFR1 | integration | stale cache ignored; empty state remains absent; observer/transcript/provider byte identity |
| NFR2 | unit + integration | no transcript body/path/raw output/credentials in plan, errors, outcome, or digest inputs |
| NFR3 | unit | adversarial IDs/paths/help, ANSI/control output, ambiguous repository/writer/lineage, no shell |
| NFR4 | build | bundled generated output, source/output sync, no runtime dependency |
| NFR5 | unit | preview, probe, Git, and reconcile input caps; deterministic ordering |
| NFR6 | integration | focused suites, full tests, validate, build check, smoke, docs index, provider install views |

### Unit Tests

- Test leaf selection, schema validation, canonical digest projection, policy decisions,
  invocation builders, forbidden-flag scanner, mixed outcomes, and renderers with no
  provider process.
- Use existing transcript sanitization fixtures plus handoff-specific preview bounds.
- Mock `execFile`/spawn boundaries with literal malicious paths and IDs.

### Integration Tests

- Build temporary Codex and Claude stores with exact, sister, and global cwd records.
- Assert `persistence=forbid` ignores a seeded stale Codex cache and leaves an empty
  state directory nonexistent.
- Create temporary Git repository worktrees for same-common-dir and separate-clone
  cases; assert status fingerprints and drift behavior.
- Exercise CLI commands as subprocesses with fixture environment variables and mocked
  provider binaries.

### End-to-End Tests

The normal suite uses mocked provider CLIs and must prove both verified-execution and
unverified-plan/deferred behavior without real mutation. A bounded live-provider gate
creates a disposable Git repository with two worktrees and disposable Codex/Claude
parent sessions, invokes each native successor contract, captures exact parent/child
identity, verifies the child target cwd, proves the source parent remains resumable, and
records metadata effects. This gate is explicitly authorized for the current
implementation and exact installed versions. It must use no real project session, no
bypass flag, and a strict prompt/quota/time bound. Only reviewed passing evidence may
change the source-controlled behavior matrix; either provider's failure blocks v1
completion.

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

- Which future provider/host signal can supply conservative writer-closed proof for
  same-ID resume?
- Which exact Claude-native result or transcript field proves successor lineage during
  the required disposable gate?
- Do exact Codex 0.151.0 and Claude Code 2.1.251 successor operations both satisfy the
  required gate? This must be answered during implementation; a negative or
  unobservable result is a product blocker.

These questions do not block v1 because their affected paths fail closed as refused,
unresolved, or plan/deferred.

## Implementation Phases

### Phase 1: Read-only discovery and preview

**Goal:** Add the zero-persistence shared seam and safe exact-worktree candidate/preview
behavior.

**Tasks:**

- Test and add persistent-cache bypass options to shared discovery.
- Implement provider-qualified exact candidate discovery and direct-only current
  evidence.
- Implement bounded sanitized preview without plan/result coupling.

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
  forbidden-flag checks.
- Implement confirmation revalidation, TTY/native outcome semantics, and no automatic
  retries.
- Extend exact Codex lineage extraction and implement reconcile outcomes.

**Verification:** Mock provider and outcome suites prove every ready/defer/refuse/native/
reporting state. Live provider behavior remains opt-in and unclaimed.

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
