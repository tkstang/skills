---
oat_generated: true
oat_generated_at: 2026-07-01
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-panel
---

# Artifact Review: design

**Reviewed:** 2026-07-01
**Scope:** design.md (quick-mode artifact review; no spec.md is expected)
**Files reviewed:** 2 (design.md, discovery.md), plus targeted repo verification
**Commits:** N/A (artifact review)

## Summary

The design is substantially complete, internally coherent, and well-aligned with
discovery: it explicitly resolves all five discovery open questions (`--panelists`
naming, no thematic overview in v1, fail-closed on explicit unavailable providers,
workflow-specific resolver views, and role-default schema shape) and respects every
declared constraint (dependency-free runtime, generated `.mjs` build model, provider
CLI boundary, `.consensus/` namespace, inventory/preflight validation). Repo-fit
claims I spot-checked are accurate (`.consensus/` is an established run namespace,
the advisory schema exists with `additionalProperties: false`, existing wrappers
already expose `--output`/`--run-dir`/`--allow-root`). The gaps that remain are
boundary decisions this design pass was specifically chartered to settle: the
retrofit of the five existing convergence wrappers to consume the resolver is
under-designed, and the design is internally ambiguous about whether the resolver is
consumed in-process (component diagram) or via a `consensus config` subprocess
(architecture prose) — which in turn leaves the generated-build mapping for the
config/resolver modules unspecified. Verdict: ready-with-fixes.

## Findings

### Critical

None.

### Important

- **Existing-wrapper retrofit is under-designed** (`design.md:16-18`, `design.md:44-47`, `design.md:193-197`)
  - Issue: A discovery success criterion ("Existing consensus-family wrappers consume
    defaults when no per-invocation override is supplied, while explicit flags
    continue to win", `discovery.md:198-200`) plus a hard constraint ("config work
    must not accidentally break their existing contracts", `discovery.md:189-191`)
    require modifying all five convergence wrappers (`create`, `decide`, `plan`,
    `refine`, `evaluate`). The design asserts this in the Overview ("can read the
    shared resolver when no explicit peers are provided") and lists it in Integration
    Tests, but the **Component Design** section has no component, interface, or data
    flow for the retrofit: it does not show how a convergence wrapper calls
    `resolveConsensusComposition`, where those wrappers obtain the
    `ProviderInventoryEntry[]` the resolver requires, or what their current built-in
    two-peer behavior becomes. It also omits that touching each wrapper's canonical
    TS regenerates a `.mjs` under a skill directory, which the repo enforces requires
    a `SKILL.md` version bump for all five skills (CLAUDE.md "Changed skills must bump
    their version").
  - Fix: Add a Component Design entry (or a data-flow subsection) covering the
    convergence-wrapper resolver integration: the call shape, the inventory source,
    the precedence-preservation guarantee, and the required version bumps for the five
    affected skills. State explicitly whether default behavior for existing wrappers
    changes or stays byte-identical when no config exists.

- **Resolver consumption path is ambiguous, leaving the generated-build mapping for config/resolver modules unspecified** (`design.md:43-47`, `design.md:78-83`, `design.md:184-187`, `design.md:316-318`)
  - Issue: The Architecture prose says shared config is "a small provider-CLI-owned
    subsystem" surfaced through `consensus config ...` commands, implying the panel
    wrapper reaches config by shelling out to the provider CLI. But the Component
    Diagram draws the panel wrapper importing `src/consensus/config/*` **in-process**
    (`design.md:80`), and the resolver is specified as a TypeScript function
    (`resolveConsensusComposition(...)`, `design.md:184-187`). These are two different
    architectures with different build consequences. The repo's generated-runtime
    contract emits a `.mjs` per canonical module and rewrites relative imports to
    sibling `.mjs` files (verified in `scripts/build-generated.mjs`, e.g. the
    `consensus-loop` entries with `importRewrites`). If the resolver is consumed
    in-process, the config/resolver modules need their own build-mapping entries plus
    `importRewrites` — but the Docs/Manifests responsibilities (`design.md:316-318`)
    only add the **panel wrapper** mapping and omit the config/resolver modules.
  - Fix: Commit to one consumption path. If in-process, add build-mapping entries and
    import rewrites for the config/resolver modules to the Docs/Manifests section and
    the Component Diagram. If subprocess (`consensus config get --scope effective`),
    correct the Component Diagram to remove the direct `src/consensus/config/*` import
    edge and describe the resolver function as the CLI's internal, invoked over a
    process boundary from the panel wrapper.

### Medium

- **`panel_size` vs `panelists` cardinality interaction is underspecified** (`design.md:191-193`, `design.md:355-357`, `design.md:571`)
  - Issue: The resolver decision states `panel_size` "limits or expands selection from
    configured `panelists`" but "cannot reduce panel execution below two panelists."
    "Expands" is undefined when `panel_size` exceeds `len(panelists)` (there is no
    documented source pool to draw additional panelists from), and the subset-selection
    rule is unspecified when `panel_size` is less than `len(panelists)` (first-N?
    priority order?). This directly governs the resolver algorithm and the
    "enforces `panel_size`" unit test (`design.md:571`), so an implementer would have
    to guess.
  - Fix: Define the two cardinality cases explicitly: what happens when
    `panel_size > len(panelists)` (clamp to available? error? fallback pool?) and the
    deterministic selection order when `panel_size < len(panelists)`.

- **`advisory` resolver workflow / `advisor` role default has no in-scope consumer or test** (`design.md:156-159`, `design.md:167`, `design.md:344-348`, `design.md:400-404`)
  - Issue: The resolver defines `ConsensusWorkflow = 'convergence' | 'panel' | 'advisory'`
    and an `advisory` result of "one advisor", and the config carries a
    `roles.advisor` default. But `phone-a-friend` (the advisory skill) is skill-only —
    it has no TypeScript wrapper (verified: `plugins/consensus/skills/phone-a-friend/`
    contains only `SKILL.md`, `references/`, `schemas/`), so nothing in scope consumes
    the resolver's advisory path, and the Testing Strategy has no advisory resolver
    test. Discovery's config-sprawl risk mitigation asks to keep v1 to "only the role
    defaults needed by panel/advisory workflows" (`discovery.md:263-265`), which
    anticipates the schema slot but not a live, untested resolver workflow.
  - Fix: State whether `advisory` is a reserved-for-future schema slot (config-only, no
    v1 resolver branch/consumer) or an actively wired v1 workflow. If reserved, drop
    `advisory` from the live `ConsensusWorkflow` resolver union or mark it explicitly
    non-executed in v1; if active, name the consumer and add a resolver test.

- **Partial-failure artifact contract is left fully open** (`design.md:283`, `design.md:519-528`, `design.md:544-554`, `design.md:618-624`)
  - Issue: Open Question 2 ("panel artifacts with one successful response and one or
    more failures ... written as failure evidence, or ... only ... on successful
    two-panelist minimum") is deferred entirely to the implementation task. This is a
    core success/failure contract that the design references with hedged language in
    three places ("fail closed or produce an explicit shortfall artifact only if the
    command contract defines that as non-success") and that the testing strategy only
    partially pins ("fails clearly when fewer than two panelists are usable",
    `design.md:590`). Leaving the exact 1-success outcome open risks an implementer
    guessing behavior that the tests then encode.
  - Fix: Pick a conservative v1 default in the design (e.g., fewer-than-two usable
    panelists is non-success and writes no artifact, or writes an explicitly-labeled
    shortfall artifact with non-zero exit) so the failure contract and its test are
    unambiguous; the finer flag details can still be settled during implementation.

### Minor

- **Undefined types in interface signatures** (`design.md:130`, `design.md:267`, `design.md:272`)
  - Issue: `ConsensusConfigKey` (Config Store `clear`), `PanelistInvoker` and
    `ConsensusPanelRunResult` (panel wrapper options/return) are referenced but never
    defined in the Data Models section.
  - Suggestion: Either define these shapes or add a one-line note that they are
    implementation-defined, so the interfaces are self-contained.

- **`clear --key` options omit `roles`** (`design.md:223`, `design.md:340-349`)
  - Issue: `consensus config clear ... --key peers|panelists|panel-size|all` cannot
    target `roles`, even though `roles` is part of `ConsensusDefaults`.
  - Suggestion: Add `roles` (or per-role keys) to the clearable key set, or state that
    role defaults are cleared only via `--scope ... --key all` / `--from-file`.

- **Inventory source is underspecified** (`design.md:83`, `design.md:98`, `design.md:174`)
  - Issue: The resolver requires `inventory: ProviderInventoryEntry[]`, but the
    Component Diagram and Data Flow cite only `consensus preflight --json`. In the
    actual CLI, the inventory is produced by `consensus provider ls` (`kind:
    'provider-list'`), with `preflight` a separate readiness command. The design
    conflates them as "provider inventory/preflight."
  - Suggestion: Name `consensus provider ls` (or the internal probe) as the inventory
    source and reserve `preflight` for readiness, so the implementer knows where the
    `ProviderInventoryEntry[]` originates.

- **Skill directory name left conditional** (`design.md:303-306`)
  - Issue: "The skill should be named `panel` in the plugin directory **if** provider
    skill naming favors short names." Established precedent is unambiguous — every
    existing wrapper skill uses a short name (`create`, `decide`, `plan`, `refine`,
    `evaluate`).
  - Suggestion: Commit to `panel` as the directory name and keep `consensus-panel` as
    the prose/workflow name; drop the conditional.

## Requirements/Design Alignment

**Evidence sources used:** `design.md` (under review), `discovery.md` (upstream
dependency), `state.md` (phase context). No `spec.md` (expected in quick mode).
`plan.md` and `implementation.md` are unfilled scaffolds (consistent with
"design complete, plan not started"). Repo verification: `src/consensus/`,
`plugins/consensus/skills/`, `src/consensus/provider-cli/{args,commands}.ts`,
`scripts/build-generated.mjs`, `plugins/consensus/skills/phone-a-friend/`.

### Requirements Coverage (discovery success criteria & key decisions)

| Requirement (discovery) | Status | Notes |
| ----------------------- | ------ | ----- |
| CLI view/set/clear default config (composition + panel size) | implemented-in-design | `consensus config get/set/clear/list` (`design.md:216-224`); `roles` not clearable by key (m2) |
| Defaults persisted in documented user/project locations + precedence | implemented-in-design | Config Store paths (`design.md:136-140`) + resolver precedence (`design.md:155`) |
| Existing wrappers consume defaults; explicit flags win | partial | Asserted + tested, but no Component Design for the 5-wrapper retrofit, inventory source, or version bumps (I1) |
| Defaults validated against inventory/preflight; clear warnings/refusal | implemented-in-design | Resolver validation + Error Handling (`design.md:159-162`, `design.md:494-499`); inventory source vague (m3) |
| Shipped `consensus-panel` skill: wrapper, schema, guidance, examples, manifests, docs, tests | implemented-in-design | Panel Skill + Wrapper + Payload + Docs/Manifests (`design.md:236-324`) |
| Panel dispatches to 2+ panelists, presents every response, surfaces shortfalls | implemented-in-design | Data Flow + artifact model (`design.md:96-104`, `design.md:438-455`) |
| Panel artifact: question, composition, responses, diagnostics/shortfalls, metadata | implemented-in-design | `ConsensusPanelArtifact` (`design.md:438-455`) |
| Docs position panel vs refine/evaluate/phone-a-friend | implemented-in-design | Panel Skill decision + docs tests (`design.md:307-308`, `design.md:596-601`) |
| Tests: precedence, validation, invocation, rendering, docs/manifest, generated-sync, structural | implemented-in-design | Testing Strategy (`design.md:566-611`); no advisory resolver test (M2) |
| KD: single project / provider-CLI boundary / precedence / single-round panel / moderator neutrality / TS-source-of-truth | implemented-in-design | All six key decisions reflected (`design.md:11-31`, `design.md:276-283`, `design.md:310-318`) |
| Constraint: dependency-free runtime, no runtime deps | implemented-in-design | Design uses stdlib fs/env + JSON only; no deps introduced |
| Constraint: generated `.mjs` not hand-edited; canonical TS + build | partial | Panel wrapper mapping named, but config/resolver module mappings unspecified given consumption-path ambiguity (I2) |
| Constraint: existing two-peer contracts not broken | implemented-in-design | Workflow-specific resolver returns exactly two for convergence (`design.md:157-158`, `design.md:194-195`) |

### Discovery Open Questions — Resolution Status (strength)

| Discovery OQ | Resolved in design? | Where |
| ------------ | ------------------- | ----- |
| Neutral overview in v1? | Yes — no thematic overview; mechanical moderator notes only | `design.md:280-281` |
| Config schema role detail | Yes — `panelist`/`advisor`/`synthesizer`, no `moderator` | `design.md:344-348` |
| `--panel` vs `--panelists` vs `--peers` | Yes — `--panelists` for panel, `--peers` stays convergence | `design.md:229-230` |
| Unavailable defaults refuse vs degrade | Yes — explicit fail closed; configured defaults may fall back to minimum | `design.md:196-197` |
| Existing-wrapper compatibility | Yes — resolver returns workflow-specific views | `design.md:156-158` |

### Extra Work (not in declared requirements)

- The live `advisory` resolver workflow and `advisor` role default extend beyond the
  two backlog items' explicit consumers (panel + existing convergence wrappers). See
  M2 — clarify reserved-vs-active to avoid config-surface sprawl (a named discovery
  risk).

### Out-of-Scope Adherence

All discovery out-of-scope items are respected: multi-round cross-talk is deferred to
`BL-260701-add-multi-round-panel`, no voting/ranking/convergence, no new provider
backends, no runtime dependencies, and no marketplace claims (`design.md:26-31`,
`design.md:278-283`, `design.md:322-324`).

## Verification Commands

These confirm the design's own declared verification slices are runnable and let a
human reproduce the finding evidence during planning:

```bash
# Confirm the CLI surfaces the design depends on (run exists; config does NOT yet)
grep -nE "kind: 'run'|kind: 'preflight'|kind: 'provider-list'|kind: 'config'" \
  /Users/tstang/Code/feat-consensus-panel/src/consensus/provider-cli/args.ts

# Confirm the generated-build model uses per-module .mjs + importRewrites (I2 context)
grep -nE "id:|source:|output:|importRewrites" \
  /Users/tstang/Code/feat-consensus-panel/scripts/build-generated.mjs

# Confirm phone-a-friend is skill-only (no TS wrapper) — M2 evidence
find /Users/tstang/Code/feat-consensus-panel/plugins/consensus/skills/phone-a-friend -name '*.mjs'

# Design-declared verification slices (post-implementation)
pnpm exec vitest run tests/consensus/provider-cli tests/consensus/panel
pnpm exec vitest run tests/repo
pnpm run build && pnpm run build:check
pnpm run type-check && pnpm run validate && pnpm run smoke
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks. The
two Important findings (existing-wrapper retrofit design + resolver consumption/build
mapping) are boundary decisions this design pass was chartered to settle and should be
resolved before or in the first planning task; the Medium findings (`panel_size`
semantics, advisory scoping, partial-failure contract) are best pinned in the design
so tests are unambiguous.
