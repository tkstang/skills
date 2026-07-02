---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-07-02
oat_generated: false
---

# Discovery: consensus-panel

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables.
- Capture implementation details only when they define source boundaries or
  verification needs for the eventual plan.

## Initial Request

Create a quick-mode OAT project named `consensus-panel` and pick up two backlog
items as one project:

- `BL-260626-configure-default-consensus` - configure default panel/consensus
  agent configs via CLI.
- `BL-260626-add-consensus-panel-skill` - add a neutral-moderator,
  multi-agent `consensus-panel` skill.

The backlog explicitly frames these as the same project, with default
configuration enabling the ergonomic "use my default panel" path.

## Clarifying Questions

No extra user questions were needed before discovery capture. The backlog items
provided concrete acceptance criteria and enough implementation constraints to
prepare a plan, but they also surfaced design choices that should be validated
before implementation.

## Solution Space

### Approach 1: Shared Config Foundation Plus Direct Panel Wrapper _(Recommended)_

**Description:** Add a shared consensus configuration resolver and provider CLI
config commands first, then implement `consensus-panel` as a non-converging
wrapper/skill that fans the same prompt out to 2+ provider-backed panelists and
renders every attributed response. Existing convergence wrappers consume the
same resolver when no per-invocation override is supplied.

**When this is the right choice:** This is best when the two backlog items remain
one project and the panel should ship with default-panel ergonomics rather than
requiring a second follow-up integration project.

**Tradeoffs:** More up-front work is needed in the provider CLI and shared wrapper
configuration before the visible skill lands. The benefit is that defaults,
precedence, validation, and documentation are implemented once and consumed by
the whole consensus family.

### Approach 2: Panel Skill First, Defaults Later

**Description:** Ship `consensus-panel` with only explicit per-invocation
composition, leaving persistent defaults as a follow-up.

**When this is the right choice:** This is best if the team wants the smallest
visible user-facing increment and is willing to accept manual `--panel` or
`--peers` composition until the config dependency lands.

**Tradeoffs:** It creates a two-step user experience and likely requires revising
the panel wrapper, skill docs, and tests once defaults are added. It also leaves
other consensus-family wrappers without the default composition improvements.

### Approach 3: Add a Non-Converging Mode to the Existing Consensus Loop

**Description:** Extend `src/consensus/core/consensus-loop.ts` with a new
non-converging panel mode and build `consensus-panel` on that shared machinery.

**When this is the right choice:** This is attractive if panel execution is
expected to evolve into multi-round cross-talk or reuse convergence status
tracking heavily.

**Tradeoffs:** The current loop and many tests assume exactly two peers,
verdict/synthesis schemas, convergence or escalation states, and iteration-mode
semantics. Reusing it for a single-round breadth gather would be invasive and
could blur the product distinction between panel breadth and convergence loops.

### Chosen Direction

**Approach:** Shared config foundation plus direct panel wrapper.

**Rationale:** It satisfies both backlog items in one coherent lane while
preserving the product distinction: defaults are shared family infrastructure,
and `consensus-panel` is a neutral, non-converging breadth-gather workflow rather
than another convergence loop.

**User validated:** Pending. This discovery recommends the direction and pauses
for the quick-start design-depth decision before plan generation.

## Options Considered

### Option A: Config Command Surface

**Description:** Add provider CLI commands under `consensus config`, with
subcommands to view, set, and clear default consensus/panel configuration.

**Pros:**

- Keeps configuration owned by the existing provider CLI boundary.
- Matches the backlog's "consensus config-style" wording.
- Gives tests a deterministic command surface for precedence and validation.

**Cons:**

- Requires extending provider CLI parsing, help text, and command envelopes.
- Needs careful schema validation so bad defaults fail clearly.

**Chosen:** Yes.

**Summary:** `consensus config` is the clearest owned CLI surface for this repo.
The exact subcommands should be small and testable, such as `get`, `set`, `list`,
and `clear` or equivalent JSON-first operations.

### Option B: Config Storage and Precedence

**Description:** Persist user and project defaults in documented JSON files, then
resolve them with precedence `per-invocation flag > project > user > built-in`.

**Pros:**

- Matches the backlog acceptance criteria.
- Lets project-local defaults live with a checkout while user defaults remain
  machine-local.
- Keeps built-in defaults as a safe fallback.

**Cons:**

- Requires a small schema and resolver boundary before wrappers can consume it.
- Project/user paths must be documented precisely to avoid surprising writes.

**Chosen:** Yes.

**Summary:** The project should define one shared schema for default panel size,
provider/model composition, and optional role defaults. User and project files
should use that schema and be validated against provider inventory/preflight.

### Option C: Panel Output Contract

**Description:** Render a panel artifact that includes the question, panel
composition, each attributed panelist response, provider diagnostics, and any
shortfall details.

**Pros:**

- Directly satisfies the "all responses surfaced" acceptance criterion.
- Keeps provider output auditable without collapsing it into one answer.
- Gives graceful degradation a visible place in the output.

**Cons:**

- A neutral overview must be clearly separated if included, or omitted in v1 to
  avoid breaching moderator neutrality.

**Chosen:** Yes, with a conservative v1 stance: attributed responses are required;
any overview is optional and must be explicitly neutral, descriptive, and
separate from panel voices.

## Key Decisions

1. **One project:** Treat the two backlog items as a single implementation lane.
2. **Provider CLI boundary:** Keep all provider execution behind the owned
   generated `consensus` CLI; do not add runtime dependencies to shipped skills.
3. **Default precedence:** Resolve composition as per-invocation override,
   project default, user default, then built-in default.
4. **Panel semantics:** `consensus-panel` is single-round breadth gathering with
   2+ independent panelists in v1, not a forced convergence workflow.
5. **Moderator neutrality:** The host frames, dispatches, collects, and presents;
   it does not author a panelist answer or inject its opinion as a panel voice.
6. **Source of truth:** Edit canonical TypeScript under `src/consensus/`, then run
   `pnpm run build` to regenerate committed plugin runtime output.

## Constraints

- Node.js 22+ and dependency-free shipped runtime code remain required.
- Generated `.mjs` plugin scripts must not be hand-edited.
- Changed shipped skills must bump their `SKILL.md` versions and keep top-level
  and `metadata.version` in sync when both are present.
- Provider availability must be checked through provider inventory/preflight; a
  configured provider/model must not silently fail or be dropped.
- Docs must be updated in the Fumadocs site under
  `documentation/docs/user-guide/consensus/`, with navigation kept in sync.
- Current wrappers for `create`, `decide`, `plan`, `refine`, and `evaluate`
  assume exactly two peers for `--peers`; config work must not accidentally break
  their existing contracts unless the plan explicitly changes them.

## Success Criteria

- CLI commands can view, set, and clear default consensus/panel configuration,
  including provider/model composition and default panel size.
- Defaults are persisted in documented user/project locations and resolved with
  the documented precedence order.
- Existing consensus-family wrappers consume defaults when no per-invocation
  override is supplied, while explicit flags continue to win.
- Defaults are validated against provider inventory/preflight with clear warnings
  or refusal for unavailable providers/models.
- A shipped `consensus-panel` skill exists with a wrapper, schema or output
  contract, operator guidance, examples, manifests, docs, and tests.
- `consensus-panel` dispatches to 2+ provider-backed panelists, presents every
  attributed response, and surfaces any unavailable-provider shortfall.
- A panel artifact captures the question, panel composition, attributed responses,
  diagnostics/shortfalls, and run metadata.
- Documentation positions `consensus-panel` against `refine`, `evaluate`, and
  `phone-a-friend`.
- Tests cover config precedence, config validation, panel invocation, output
  rendering, docs/manifest registration, generated-output sync, and structural
  validation.

## Out of Scope

- Multi-round panel cross-talk where panelists see each other's responses.
- Voting, ranking, or convergence to a single answer.
- New external provider backends beyond the existing provider CLI inventory.
- Runtime dependencies in shipped skill/plugin code.
- Marketplace availability claims beyond locally verified provider paths.

## Deferred Ideas

- **Second-round panel discussion:** Useful later, but it changes the product from
  independent breadth gathering to a deliberation flow.
- **Cost caps and deliberation metrics:** Relevant to the broader consensus
  family, but not required for these backlog acceptance criteria.
- **Whole-document harmonization:** Remains separate future work for converging
  workflows.

## Open Questions

- **Neutral overview:** Should v1 include a clearly separated neutral moderator
  overview of themes/agreement/disagreement, or only raw attributed responses?
- **Config schema detail:** Should per-role defaults include only `panelist`
  entries in v1, or should `moderator`, `synthesizer`, and `advisor` roles be
  reserved in the schema immediately?
- **Panel composition flags:** Should the user-facing override be named
  `--panel`, `--panelists`, or reuse/extend `--peers` for 2+ panelists?
- **Unavailable defaults:** Should invalid configured defaults refuse execution,
  or warn and degrade when enough other panelists remain available?
- **Existing wrapper compatibility:** Should existing two-peer wrappers keep
  rejecting non-two-peer defaults, or should the resolver expose family-specific
  default views so convergence workflows always receive exactly two peers?

## Assumptions

- Built-in defaults can continue to use the current host-aware two-peer defaults
  for convergence wrappers.
- `consensus-panel` can be implemented as a direct fan-out wrapper over
  `consensus run` rather than by extending `consensus-loop`.
- A small JSON schema/config resolver can be shared by panel and convergence
  wrappers without requiring a larger settings subsystem.
- The plan should include a lightweight design phase before implementation
  because config precedence, data shape, and panel output contract are shared
  boundaries.

## Risks

- **Config surface sprawl:** A too-broad schema could slow implementation.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Keep v1 to provider/model composition, default panel
    size, and only the role defaults needed by panel/advisory workflows.
- **Loop abstraction misuse:** Forcing panel into the convergence loop could
  destabilize existing wrappers.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Prefer a direct panel wrapper unless lightweight design
    finds a narrow, low-risk reuse point.
- **Docs and manifest drift:** Adding another skill touches many surfaces.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Include docs/navigation/manifest tests and run
    `pnpm run validate`.

## Next Steps

Discovery recommends lightweight design before plan generation. The design pass
should settle the config schema, resolver boundaries, panel wrapper shape, output
contract, and verification slices, then the quick-start plan can be generated for
`oat-project-implement`.
