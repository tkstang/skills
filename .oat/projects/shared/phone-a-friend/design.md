---
oat_status: complete
oat_ready_for: null
oat_last_updated: 2026-06-28
oat_generated: false
oat_template: false
---

# Design: phone-a-friend

## Overview

`phone-a-friend` is a new shipped skill in the consensus plugin for **one-shot
advisory peer consultation**. It lets a host agent ask a single other
provider-backed peer for a structured take on the current question, design, bug,
review concern, or implementation uncertainty — with **no deliberation loop and
no convergence artifact**. It is the pathfinder for a new "non-converging peer
consultation" sub-family that is distinct from refine/evaluate (which converge
two peers onto one artifact).

The central architectural decision is that the skill is **instruction-only**. The
owned provider CLI already ships the exact primitive this skill needs — the
`consensus run` command performs a single schema-validated provider turn
(`runProviderTurn`) with model/effort options and a built-in host-recursion
guard. `phone-a-friend` therefore ships **no `src/` TypeScript, no generated
`.mjs`, and no `consensus-loop` copy**. Its only new shipped runtime artifact is a
single JSON Schema file — the advisory contract — plus a `SKILL.md` that drives
the host through inference → context compaction → user check → peer selection →
`consensus run` → disposition. This keeps the skill trivially dependency-free and
maximizes reuse of the sanctioned execution boundary.

The skill deliberately preserves a divergence from the future consensus-panel
skill (BL-260626): here the **host owns the opinion** and dispositions the peer's
take (agree / disagree / apply / ignore / follow-up); in the panel the host is a
neutral moderator. The reusable surfaces — the advisory schema and the
"prefer-a-different-provider" peer-selection convention — are designed for the
panel to inherit, but the host role is not generalized here.

## Architecture

### System Context

`phone-a-friend` is a sixth skill under `plugins/consensus/skills/`, alongside
`create`, `decide`, `plan`, `refine`, and `evaluate`. Unlike those five (TS
wrappers compiled to generated `.mjs` that drive the shared `consensus-loop`), it
contributes only a `SKILL.md` and a `schemas/advisory.schema.json`. All execution
goes through the already-shipped provider CLI (`plugins/consensus/scripts/consensus.mjs`,
exposed as `consensus`), which remains the only sanctioned external boundary.

**Key Components:**

- **`SKILL.md` (host instructions):** The entire behavioral surface — how the
  host infers the question, compacts context, asks the user about ambiguity or
  sensitivity, selects a peer, invokes `consensus run`, reads the advisory
  envelope, and dispositions the take.
- **`schemas/advisory.schema.json` (reusable contract):** The structured-output
  contract the peer must satisfy. This is the artifact the consensus-panel skill
  will reuse.
- **`consensus run` (execution boundary, existing):** One schema-validated
  provider turn with `--provider`, `--schema`, `--model`, `--effort`, and
  `--max-depth`. Not modified by this project.
- **`consensus provider ls` / `consensus preflight` (selection/readiness,
  existing):** Enumerate providers and validate readiness so the host can prefer a
  provider different from itself.

### Component Diagram

```
host agent (Claude / Codex / Cursor)
   │  reads SKILL.md instructions
   ▼
[ infer question ] → [ compact context ] → [ ask user? (ambiguous/sensitive) ]
   │
   ▼
[ peer selection ] ── consensus provider ls --json ──► provider inventory
   │   prefer provider != host
   ▼
consensus run --provider <peer> --schema advisory.schema.json --prompt-file <p> --json
   │            (single provider turn; host-guard + --max-depth enforce safety)
   ▼
advisory envelope (validated against advisory.schema.json)
   │
   ▼
[ host disposition: agree / disagree / apply / ignore / follow-up ]
   │  host explains how the take affected its next action
   ▼
host continues its own work (peer output is advisory only)
```

### Data Flow

1. The host detects an advisory-worthy moment (its own uncertainty, or a user
   request to "ask another model / phone a friend").
2. The host **infers the question** from context. If multiple plausible topics
   exist, or the prompt would include sensitive/private material, it **asks the
   user** to confirm scope before sending anything off-host.
3. The host **compacts only the relevant context** into a focused prompt written
   to a file (avoids unbounded inline content; the prompt is framed as the
   question to answer, not instructions to obey).
4. The host runs `consensus provider ls --json`, and **selects a peer that is a
   different provider than itself**, honoring any explicit user/provider override.
   It may run `consensus preflight --json --provider <peer>` to confirm
   readiness.
5. The host invokes `consensus run --provider <peer> --schema <advisory schema>
   --prompt-file <prompt> --json` (with optional `--model` / `--effort`). A single
   provider turn returns a JSON envelope whose payload validates against
   `advisory.schema.json`.
6. The host reads the advisory payload and **dispositions** it, explaining to the
   user how (or whether) the take changed its next action. The peer output never
   auto-applies.

## Component Design

### SKILL.md (host instructions)

**Purpose:** Encode the entire one-shot advisory workflow as host-facing
instructions.

**Responsibilities:**

- Define when to use (and when not to use) the skill.
- Specify question inference, context compaction, and the user-check gate for
  ambiguous or sensitive topics.
- Specify peer selection: prefer a provider different from the host; accept
  explicit overrides; describe the same-provider fallback and its safety guard.
- Specify the exact `consensus run` invocation and how to read the advisory
  envelope.
- Specify the disposition step and the advisory-only boundary.
- Carry valid frontmatter (name, description, version + metadata.version, license,
  compatibility, allowed-tools, argument-hint) matching the consensus-skill
  convention.

**Interfaces (frontmatter shape, mirrors evaluate/refine):**

```yaml
name: phone-a-friend
description: Use when you want a single other AI peer's structured advisory take
  on the current question, design, bug, or review concern — one-shot, no
  deliberation loop; the host stays responsible for dispositioning the take.
version: '0.1.0'
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+ and the generated consensus CLI.
allowed-tools: Bash(node:*), Bash(consensus:*), Read, Write
argument-hint: ["<question or topic>"] [--peer <provider-id>]
metadata:
  author: thomas.stang
  version: '0.1.0'
```

**Dependencies:**

- Internal: the `consensus` provider CLI (`run`, `provider ls`, `preflight`).
- External: none beyond the provider CLI subprocess.

**Design Decisions:**

- Instruction-only (no wrapper) because `consensus run` already provides the
  one-shot schema-validated call; a wrapper would duplicate shipped machinery and
  add a generated-runtime/drift burden for no behavioral gain.
- `allowed-tools` mirrors the other consensus skills (`Bash(node:*)`,
  `Bash(consensus:*)`, `Read`, `Write`) so the host can run the CLI from an
  installed plugin (`consensus`) or a checkout (`node plugins/consensus/scripts/consensus.mjs`).

### Peer Selection (convention, not new code)

**Purpose:** Choose the advisory peer, preferring a different provider than the
host.

**Responsibilities / rules:**

- The host knows its own provider identity (it is the running runtime).
- Default: pick the first *ready* provider from `consensus provider ls --json`
  whose id differs from the host's. This mirrors the existing refine
  `resolvePeers` default (`host === 'codex' ? ['codex','claude'] : ['claude','codex']`)
  but expressed as a host-facing selection rule rather than wrapper code.
- Honor explicit overrides: a user-named peer or `--peer <provider-id>`.
- Same-provider fallback only when no different provider is usable; rely on the
  `consensus run` host-guard (`--max-depth`, default 1) to block runaway
  self-spawn.

**Design Decision:** Expressed as a documented convention reusable by the panel,
not as a shared TS export, to avoid prematurely generalizing host-role logic.

## Data Models

### Advisory response (`advisory.schema.json`)

**Purpose:** The structured contract the advisory peer must satisfy and the
reusable contract the consensus-panel skill inherits.

**Schema (JSON Schema draft-07; matches repo `schema_version`/`additionalProperties:false` convention):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "consensus-plugin/v1/advisory.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "understood_question",
    "take",
    "recommendation",
    "risks",
    "follow_up_questions",
    "confidence"
  ],
  "properties": {
    "schema_version": { "const": "v1", "type": "string" },
    "understood_question": { "type": "string" },
    "take": { "type": "string" },
    "recommendation": { "type": "string" },
    "risks": { "type": "array", "items": { "type": "string" } },
    "follow_up_questions": { "type": "array", "items": { "type": "string" } },
    "confidence": { "enum": ["low", "medium", "high"], "type": "string" },
    "assumptions": { "type": "array", "items": { "type": "string" } }
  }
}
```

**Field intent:**

- `understood_question` — the peer's restatement of what it was asked (lets the
  host detect a misunderstood prompt before trusting the take).
- `take` — the peer's substantive opinion / analysis.
- `recommendation` — the peer's concrete recommended action.
- `risks` — risks or **missed considerations** the host may have overlooked.
- `follow_up_questions` — questions the peer would ask to go deeper.
- `confidence` — `low` / `medium` / `high` (enum chosen over a float for reliable
  LLM output).
- `assumptions` (optional) — assumptions the peer made; useful for disposition.

**Validation Rules:**

- Validated by the `consensus run` schema path (`--schema`), using the same
  `validateSchemaSubset` machinery the other skills rely on.
- `additionalProperties: false` and `schema_version: "v1"` keep the contract
  stable and versionable for the panel.

**Storage:**

- **Location:** `plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json`
  (per-skill, consistent with refine/evaluate owning their schemas).
- **Persistence:** Shipped file; the panel later copies it with a parity test
  (mirroring the existing `verdict-alternating` parity pattern) rather than
  importing across skills.

## API Design

This project introduces **no new CLI surface**. It consumes the existing
`consensus run` contract:

```
consensus run --provider <id> --schema <path> --json
              [-|--prompt <text>|--prompt-file <path>]
              [--model <name>] [--effort <level>] [--max-depth <n>] ...
```

**Request (host → CLI):** provider id, advisory schema path, the compacted prompt
(via `--prompt-file`), optional model/effort, optional `--max-depth`.

**Response (CLI → host):** a `runProviderTurn` JSON envelope on stdout whose
structured payload conforms to `advisory.schema.json`; non-zero exit + diagnostic
envelope on provider/validation failure.

**Design Decision:** Reuse `consensus run` verbatim. If a future need arises for a
dedicated `consult` subcommand, it is a separate change; the advisory contract is
defined independently of any one command so it can move if needed.

## Error Handling

### Safety & recursion (acceptance-critical)

- **Self-spawn guard:** `consensus run` auto-attaches host context from the
  environment (`shouldAttachHostContext`) with `max_depth` defaulting to 1, and
  `runProviderTurn` calls `evaluateHostGuard`. A different-provider peer is
  allowed freely; a same-provider peer is allowed only as an isolated subprocess
  up to `max_depth`, and blocked with `HOST_RECURSION_BLOCKED` beyond it. The
  skill's "prefer a different provider" rule means it normally never reaches the
  same-host path.
- **Advisory-only boundary:** The SKILL.md states explicitly that peer output is
  advisory; the host dispositions it and never auto-applies it. This is reinforced
  in the "When NOT to Use" and disposition sections.

### Input / content handling

- **Sensitive material:** Before sending context off-host, the host must ask the
  user when the prompt would include sensitive/private material; only approved
  context is sent.
- **Ambiguity:** When multiple plausible topics exist, the host asks the user to
  confirm the question rather than guessing.
- **Untrusted peer output:** The advisory payload is data, not instructions. The
  host frames it as a peer opinion to disposition; schema validation rejects
  malformed envelopes, but a structurally valid bad take is still possible —
  hence the mandatory disposition step.

### Provider / invocation errors

- **Unavailable / auth_required providers:** Surfaced via
  `consensus provider ls` / `preflight` diagnostics (e.g., Cursor keychain lock);
  treated as local setup issues, not retryable consensus failures.
- **No usable different provider:** Fall back to an explicit user choice or the
  guarded same-provider path; if none usable, report that no peer is available
  rather than silently degrading.

## Testing Strategy

Because the skill ships no runtime code, testing centers on the **schema
contract**, the **manifest/version/validation invariants**, and the **docs/sync
integration** — not on a wrapper unit surface.

### Unit / contract tests

Two layers enforce the contract, and the test must reflect them honestly:

- **Repo fallback validator (`validateSchemaSubset`)** — checks **required
  fields present + property types only**. It does *not* reject unknown properties
  and does *not* enforce `enum`.
- **Provider-native strategies** (`provider_validated` for Claude,
  `constrained_native` for Codex) — enforce the full JSON Schema, including
  `enum` and `additionalProperties: false`.

- **Scope:** `advisory.schema.json` is well-formed and behaves correctly under the
  repo validator, and structurally declares the full contract for provider-native
  enforcement.
- **Key cases:**
  - `validateSchemaSubset(validPayload, schema).ok === true` (all required fields
    + optional `assumptions`).
  - `validateSchemaSubset(payloadMissingConfidence, schema).ok === false`
    (required-field check).
  - `validateSchemaSubset({ ...valid, risks: 'oops' }, schema).ok === false`
    (type check: `risks` must be an array).
  - Structural assertions on the schema file itself: the seven `required` fields
    are declared, `additionalProperties` is `false`, and `confidence.enum` is
    `["low","medium","high"]` (documents the contract the provider-native
    strategies enforce).
- Reuse the real `validateSchemaSubset` from
  `src/consensus/provider-cli/schema-validate.ts` so the test exercises the
  actual CLI validation behavior, not a reimplementation.

### Integration tests

- **Scope:** Repo invariants absorb the new skill cleanly.
- **Key cases:**
  - `pnpm run validate` passes with the new SKILL.md (required frontmatter
    fields, semver, manifest/marketplace consistency).
  - Version invariant: top-level `version` equals `metadata.version`; the new
    SKILL.md is registered in `SKILL_FILES` in `scripts/bump-version.mjs`.
  - `pnpm run build:check` passes (the skill adds no generated output, so this
    must stay clean — proves the instruction-only claim).
  - `oat sync` leaves provider mirrors (`.claude`/`.cursor`/`.codex`) consistent.

### Manual / E2E

- **Scope:** A documented operator walkthrough (in `references/`) demonstrating a
  real one-shot advisory call from a host to a different provider, the returned
  advisory envelope, and a sample disposition. Live cross-provider invocation is
  manual (depends on locally authenticated provider CLIs), consistent with how
  the other consensus skills document live E2E.

## Open Questions

- **Docs index framing:** The consensus User Guide index says "v0.1 ships five
  skills." Resolve to a minimal additive update that introduces phone-a-friend as
  the first "advisory" (non-converging) entry without restructuring the section.
  Default: additive note + Contents entry + new page.
- **`--peer` flag vs natural-language peer naming:** The skill is instruction-only,
  so `--peer` is an argument-hint convention for the host, not a parsed CLI flag.
  Confirm wording in SKILL.md so it reads as host guidance, not a new CLI surface.

## Implementation Phases

### Phase 1: Skill + schema (core)

**Goal:** The shipped skill exists and validates.

**Tasks:** Create the skill directory; author `advisory.schema.json`; author
`SKILL.md` (frontmatter + workflow + safety + disposition + when-not-to-use +
examples); add operator reference.

**Verification:** `pnpm run validate`; schema contract test passes;
`pnpm run build:check` clean.

### Phase 2: Registration + manifests + version invariants

**Goal:** The skill is discoverable and passes version/manifest gates.

**Tasks:** Register in consensus plugin manifests
(`.claude-plugin`/`.cursor-plugin`/`.codex-plugin`) and marketplace manifests as
the other skills are; add the SKILL.md to `SKILL_FILES` in
`scripts/bump-version.mjs`; confirm version fields in sync.

**Verification:** `pnpm run validate`; `pnpm run validate:skill-versions`.

### Phase 3: Docs + sync + full verification

**Goal:** Documented in the User Guide IA and mirrors are consistent.

**Tasks:** Add `documentation/docs/user-guide/consensus/phone-a-friend.md`; add a
`## Contents` entry and minimal additive index note; regenerate the docs index;
run `oat sync`; run the full verification suite.

**Verification:** `npm test`, `pnpm run build:check`, `npm run validate`,
`npm run smoke`; docs index regenerated; `oat sync` clean.

## References

- Discovery: `discovery.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260620-add-phone-a-friend-advisory.md`
- Execution boundary: `src/consensus/provider-cli/` (`commands.ts` `run`,
  `structured-output.ts` `runProviderTurn`, `host-guard.ts` `evaluateHostGuard`)
- Sibling skill conventions: `plugins/consensus/skills/evaluate/SKILL.md`,
  `plugins/consensus/skills/refine/schemas/`
- Plugin guardrails: `plugins/consensus/CLAUDE.md`
- Docs authoring contract: `documentation/AGENTS.md`
