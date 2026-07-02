---
oat_status: complete
oat_ready_for: null
oat_last_updated: 2026-07-01
oat_generated: false
oat_template: false
---

# Design: consensus-panel

## Overview

The project adds shared default composition for the consensus family, then uses
it to ship `consensus-panel`. Default composition lives behind the generated
provider CLI and is resolved with explicit precedence: per-invocation override,
project config, user config, then built-in defaults. Existing convergence skills
keep their two-peer behavior, but can read the shared resolver when no explicit
peers are provided.

`consensus-panel` is a new non-converging skill and wrapper. It sends the same
user question to 2+ provider-backed panelists through `consensus run`, captures
each panelist's structured response, and renders a panel artifact with the
original question, panel composition, attribution, diagnostics, and
unavailable-provider shortfalls. The host remains a neutral moderator: it frames
and presents, but does not contribute a panel answer.

The implementation should avoid extending the convergence loop for v1. Current
loop code is oriented around exactly two peers, verdict schemas, synthesis, and
convergence or escalation states. A direct panel wrapper over provider CLI fan-out
keeps the feature smaller, preserves the product distinction, and leaves
multi-round panel discussion to `BL-260701-add-multi-round-panel`.

## Architecture

### System Context

The consensus plugin already separates deterministic wrapper/runtime behavior
from provider execution. Canonical TypeScript lives under `src/consensus/`,
committed runtime output is generated into `plugins/consensus/`, and provider
turns run through the generated `plugins/consensus/scripts/consensus.mjs`
provider CLI. This design keeps that boundary intact.

Shared composition configuration becomes a small provider-CLI-owned subsystem:
config commands read/write user and project config, a resolver applies
precedence, and wrappers ask the resolver for the workflow-specific composition
they need. Converging wrappers receive exactly two peers. `consensus-panel`
receives 2+ panelists.

**Key Components:**

- **Config store:** JSON config at documented user/project locations, with user
  defaults, project overrides, panel size, provider/model entries, and optional
  role defaults.
- **Config resolver:** Applies precedence and returns a normalized composition
  for a specific workflow.
- **Provider CLI config commands:** Expose JSON-first view, set, and clear
  commands for default composition.
- **Panel wrapper:** Resolves panelists, preflights them, runs independent
  provider turns, and writes the panel artifact.
- **Panel skill:** Host-facing instructions that preserve moderator neutrality and
  translate user intent into wrapper invocation.
- **Docs/tests/build:** Keep Fumadocs, plugin manifests, generated-output build
  mappings, structural validation, and Vitest coverage in sync.

### Component Diagram

```text
User / host agent
  |
  v
plugins/consensus/skills/panel/SKILL.md
  |
  v
plugins/consensus/skills/panel/scripts/consensus-panel.mjs
  ^
  | generated from
  |
src/consensus/panel/consensus-panel.ts
  |
  +--> src/consensus/config/*        -> user/project config files
  +--> consensus preflight --json    -> provider availability
  +--> consensus run --json          -> one independent turn per panelist
  |
  v
panel artifact markdown
```

### Data Flow

```text
1. User asks for a panel.
2. Host skill frames the approved question without adding its own answer.
3. Panel wrapper parses invocation flags such as --question, --question-file,
   --panelists, --panel-size, --output, --run-dir, and --allow-root.
4. Resolver builds effective composition:
   invocation > project config > user config > built-in defaults.
5. Wrapper checks provider inventory/preflight for requested panelists.
6. Wrapper invokes each usable panelist through consensus run with the panel
   response schema.
7. Wrapper records ok/error/unavailable status per panelist.
8. Wrapper renders a markdown artifact with the question, composition,
   attributed responses, diagnostics, shortfalls, and run metadata.
9. Host presents the artifact and does not add a panelist-style opinion.
```

## Component Design

### Consensus Config Store

**Purpose:** Persist user/project defaults for consensus composition.

**Responsibilities:**

- Store provider/model entries for two-peer convergence workflows and panel
  workflows.
- Store default panel size.
- Store optional role defaults for `panelist`, `advisor`, and `synthesizer`.
- Keep user config machine-local and project config checkout-local.
- Preserve unknown future fields only if the parser can do so without accepting
  invalid v1 data.

**Interfaces:**

```typescript
interface ConsensusConfigStore {
  readUserConfig(): Promise<ConsensusDefaultsConfig | null>;
  writeUserConfig(config: ConsensusDefaultsConfig): Promise<void>;
  readProjectConfig(cwd: string): Promise<ConsensusDefaultsConfig | null>;
  writeProjectConfig(cwd: string, config: ConsensusDefaultsConfig): Promise<void>;
  clear(scope: 'user' | 'project', key?: ConsensusConfigKey): Promise<void>;
}
```

**Storage:**

- User config: `${XDG_CONFIG_HOME:-$HOME/.config}/consensus/config.json`.
- Project config: `<project root>/.consensus/config.json`, resolved from the
  invocation cwd or `--cwd`.
- Tests inject `HOME`, `XDG_CONFIG_HOME`, and temporary cwd so no real user config
  is touched.

**Design Decisions:**

- The provider CLI owns config reads/writes so all providers and skills share one
  documented surface.
- Project config uses `.consensus/` because that directory is already the
  consensus-family local artifact namespace.

### Consensus Config Resolver

**Purpose:** Normalize effective composition for a specific workflow.

**Responsibilities:**

- Apply `invocation > project > user > built-in` precedence.
- Return workflow-specific composition:
  - `convergence`: exactly two peers.
  - `panel`: two or more panelists.
  - `advisory`: one advisor.
- Validate provider IDs syntactically before inventory checks.
- Validate availability through provider inventory/preflight before execution.
- Preserve explicit override precedence even when persisted defaults exist.

**Interfaces:**

```typescript
type ConsensusWorkflow = 'convergence' | 'panel' | 'advisory';

interface ResolveConsensusCompositionInput {
  workflow: ConsensusWorkflow;
  invocation?: Partial<ConsensusDefaults>;
  cwd: string;
  env: NodeJS.ProcessEnv;
  inventory: ProviderInventoryEntry[];
}

interface ResolvedConsensusComposition {
  source: 'invocation' | 'project' | 'user' | 'built-in';
  workflow: ConsensusWorkflow;
  agents: ConsensusAgentRef[];
  warnings: string[];
}

function resolveConsensusComposition(
  input: ResolveConsensusCompositionInput,
): Promise<ResolvedConsensusComposition>;
```

**Design Decisions:**

- `panel_size` limits or expands selection from configured `panelists`, but it
  cannot reduce panel execution below two panelists.
- Convergence wrappers never receive more than two peers, even when panel
  defaults contain a larger panel.
- Unavailable explicitly requested providers fail closed. Unavailable configured
  defaults emit diagnostics and may fall back only when a documented fallback can
  still satisfy the workflow minimum.

### Provider CLI Config Commands

**Purpose:** Own the user-facing config surface.

**Responsibilities:**

- Add `consensus config ... --json` to the existing provider CLI parser, help
  text, and command dispatcher.
- View effective and scoped config.
- Set user/project defaults from small flags or a JSON file.
- Clear a scope or individual default key.
- Return JSON envelopes with `schema_version`, `ok`, config data, source, and
  diagnostics.

**Interfaces:**

```bash
consensus config get --json [--scope user|project|effective] [--cwd <path>]
consensus config set --json --scope user|project \
  [--peers claude,codex] \
  [--panelists claude,codex,cursor] \
  [--panel-size 2] \
  [--from-file consensus-config.json] \
  [--cwd <path>]
consensus config clear --json --scope user|project [--key peers|panelists|panel-size|all] [--cwd <path>]
consensus config list --json [--cwd <path>]
```

**Design Decisions:**

- `--panelists` is the panel-specific explicit override. Existing `--peers`
  remains the two-peer convergence flag.
- `--from-file` gives advanced users an escape hatch without making the normal
  path depend on hand-editing JSON.
- All commands stay JSON-first because the provider CLI already requires
  `--json` for machine-consumable surfaces.

### Consensus Panel Wrapper

**Purpose:** Execute the non-converging panel.

**Responsibilities:**

- Parse question input from `--question` or `--question-file`.
- Accept panel controls: `--panelists`, `--panel-size`, `--output`, `--run-dir`,
  `--allow-root`, and pass-through provider controls where safe.
- Resolve effective panel composition.
- Preflight panelists and surface shortfalls.
- Invoke one independent provider turn per usable panelist through
  `consensus run`.
- Validate each provider payload against a panel response schema.
- Render a markdown artifact.
- Emit JSONL coordination/status lines consistent with existing wrappers.

**Interfaces:**

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question "What are the risks in this design?" \
  --panelists claude,codex \
  --output panel.md
```

```typescript
interface RunConsensusPanelOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => string;
  invokePanelist?: PanelistInvoker;
}

function runConsensusPanel(
  argv: readonly string[],
  options?: RunConsensusPanelOptions,
): Promise<ConsensusPanelRunResult>;
```

**Design Decisions:**

- V1 is independent and single-round. The wrapper does not feed panelist answers
  to other panelists.
- The wrapper does not synthesize a recommendation. It may render mechanical
  moderator notes for diagnostics and shortfalls, but not a content opinion.
- A run with fewer than two usable panelists fails or reports an explicit
  shortfall rather than silently becoming `phone-a-friend`.

### Consensus Panel Skill

**Purpose:** Host-facing workflow instructions.

**Responsibilities:**

- Infer or ask for the panel question.
- Confirm sensitive/private context before sending it to provider-backed
  panelists.
- Choose explicit panelists when the user names them, otherwise rely on
  configured defaults or built-in fallback.
- Invoke the panel wrapper and read the JSONL status/artifact path.
- Present all attributed responses.
- Preserve moderator neutrality and avoid adding a host-authored panel response.
- Route multi-round requests to `BL-260701-add-multi-round-panel` until that
  follow-up is implemented.

**Design Decisions:**

- The skill should be named `panel` in the plugin directory if provider skill
  naming favors short names, while docs and prose can call the workflow
  `consensus-panel`.
- The skill should explicitly contrast panel with `refine`, `evaluate`, and
  `phone-a-friend`.

### Docs, Manifests, and Generated Runtime

**Purpose:** Keep all shipped surfaces coherent.

**Responsibilities:**

- Add the panel wrapper mapping to `scripts/build-generated.mjs`.
- Generate committed `plugins/consensus/skills/panel/scripts/consensus-panel.mjs`.
- Add `plugins/consensus/skills/panel/SKILL.md`, schemas, references, and
  examples.
- Update provider plugin manifests and install/visibility tests as needed.
- Update docs under `documentation/docs/user-guide/consensus/`, including
  `meta.json`.
- Update README/plugin README only for high-level shipped-skill summary and CLI
  examples.

## Data Models

### Consensus Defaults Config

**Purpose:** Represents persisted user/project defaults.

**Schema:**

```typescript
interface ConsensusDefaultsConfig {
  schema_version: 'v1';
  defaults?: ConsensusDefaults;
}

interface ConsensusDefaults {
  peers?: ConsensusAgentRef[];
  panelists?: ConsensusAgentRef[];
  panel_size?: number;
  roles?: {
    panelist?: ConsensusAgentRef[];
    advisor?: ConsensusAgentRef;
    synthesizer?: ConsensusAgentRef;
  };
}
```

**Validation Rules:**

- `schema_version` must be `v1`.
- `panel_size` must be an integer greater than or equal to 2.
- `peers`, when present, must contain exactly two entries.
- `panelists`, when present, must contain at least two entries.
- Provider IDs use the existing provider ID validation rules.
- Model and effort are optional strings and are validated against provider
  capabilities where the provider exposes reliable support.

### Consensus Agent Ref

**Purpose:** Represents one configured provider-backed agent.

**Schema:**

```typescript
interface ConsensusAgentRef {
  provider: string;
  model?: string;
  effort?: string;
}
```

**Validation Rules:**

- `provider` is required.
- `model` is accepted only for providers whose inventory capabilities allow model
  selection.
- `effort` is accepted only for providers whose inventory capabilities expose an
  effort control.

### Resolved Composition

**Purpose:** Represents effective runtime composition after precedence and
validation.

**Schema:**

```typescript
interface ResolvedConsensusComposition {
  source: 'invocation' | 'project' | 'user' | 'built-in';
  workflow: 'convergence' | 'panel' | 'advisory';
  agents: ConsensusAgentRef[];
  warnings: string[];
}
```

**Validation Rules:**

- `convergence` requires exactly two usable agents.
- `panel` requires at least two usable agents.
- `advisory` requires one usable agent.

### Panel Response Payload

**Purpose:** Provider-returned structured response for one panelist.

**Schema:**

```typescript
interface PanelResponsePayload {
  schema_version: 'v1';
  understood_question: string;
  response: string;
  key_points: string[];
  risks: string[];
  assumptions: string[];
  confidence: 'low' | 'medium' | 'high';
}
```

**Validation Rules:**

- Required fields are `schema_version`, `understood_question`, `response`,
  `key_points`, `risks`, `assumptions`, and `confidence`.
- Additional properties are rejected for provider-native enforcement parity with
  the advisory schema.

### Panel Artifact Model

**Purpose:** Represents the renderable output.

**Schema:**

```typescript
interface ConsensusPanelArtifact {
  schema_version: 'v1';
  question: string;
  panelists: ConsensusAgentRef[];
  responses: Array<{
    panelist: ConsensusAgentRef;
    status: 'ok' | 'unavailable' | 'error';
    response?: PanelResponsePayload;
    diagnostics?: string[];
  }>;
  shortfalls: string[];
  metadata: {
    run_id: string;
    created_at: string;
    config_source: ResolvedConsensusComposition['source'];
  };
}
```

**Storage:**

- Default output path: `<question-file>.panel.md` when using a question file, or
  `.consensus/panel-<run-id>/panel.md` for inline questions.
- Explicit `--output` is confined by `--allow-root` using the same path-safety
  pattern as existing wrappers.

## API Design

### Provider CLI Config API

**Method:** CLI command.

**Request:**

```bash
consensus config get --json --scope effective
consensus config set --json --scope user --panelists claude,codex --panel-size 2
consensus config clear --json --scope project --key panelists
```

**Response:**

```typescript
interface ConsensusConfigEnvelope {
  schema_version: 'v1';
  ok: boolean;
  scope?: 'user' | 'project' | 'effective';
  config?: ConsensusDefaultsConfig;
  resolved?: ResolvedConsensusComposition;
  diagnostics?: {
    warnings?: string[];
  };
  message?: string;
}
```

**Error Handling:**

- Usage errors return exit code 2 and `ok: false`.
- Invalid config schema returns a clear validation message.
- Unavailable providers produce diagnostics and do not silently change effective
  execution.

### Panel Wrapper API

**Method:** CLI command.

**Request:**

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question "Review this migration plan from multiple perspectives." \
  --panel-size 3 \
  --output panel.md
```

**Response:**

- JSONL status events on stdout.
- Markdown artifact at the resolved output path.
- Non-zero exit for usage errors, invalid config, no usable two-panelist minimum,
  or artifact write failures.

**Error Handling:**

- `EMPTY_QUESTION`: no usable question text.
- `PANEL_TOO_SMALL`: fewer than two requested or usable panelists.
- `PANELIST_UNAVAILABLE`: requested/default panelist unavailable and no valid
  fallback satisfies the minimum.
- `PANELIST_SCHEMA_VALIDATION`: provider output did not match the schema.
- `PANEL_OUTPUT_WRITE_FAILED`: artifact write failed.

## Error Handling

### Error Categories

- **User errors:** Invalid CLI flags, empty question, invalid panel size, malformed
  config, unknown config key.
- **Configuration errors:** Missing provider in inventory, model/effort not
  supported by provider capabilities, project/user config parse failure.
- **Provider errors:** Missing/auth-required/unavailable provider, timeout,
  invalid JSON, schema validation failure, output cap exceeded.
- **Filesystem errors:** Config write failure, output path outside allowed root,
  run-dir write failure.

### Retry Logic

The panel wrapper should reuse provider CLI retry behavior for individual
`consensus run` calls. The panel wrapper itself should not invent cross-panel
retry loops. If one panelist fails after provider CLI retry, the artifact records
that panelist as `error` and the wrapper exits according to the minimum-panelist
rule:

- At least two successful responses: artifact can be produced with diagnostics.
- Fewer than two successful responses: fail closed or produce an explicit
  shortfall artifact only if the command contract defines that as non-success.

### Logging and Diagnostics

- JSONL status events should include run start, resolved panel composition,
  preflight warnings, per-panelist start/finish/error, artifact path, and final
  status.
- Markdown artifacts should include provider/model attribution and diagnostics
  without exposing raw subprocess command details beyond the existing redaction
  policy.

## Testing Strategy

### Unit Tests

- Config parser accepts valid `v1` defaults and rejects malformed schemas.
- Resolver applies invocation, project, user, and built-in precedence.
- Resolver returns exactly two agents for convergence workflows.
- Resolver returns 2+ agents for panel workflows and enforces `panel_size`.
- CLI arg parsing covers `consensus config` and `consensus-panel` flags.
- Panel prompt builder frames question as untrusted data and preserves moderator
  neutrality.
- Panel artifact renderer includes all attributed responses, diagnostics, and
  shortfalls.
- Panel response schema accepts valid payloads and rejects missing/wrong-typed
  fields.

### Integration Tests

- Provider CLI config commands read/write temp HOME and temp project config
  without touching the real machine.
- Existing wrappers consume defaults only when explicit `--peers` is absent.
- Explicit wrapper flags win over project/user defaults.
- `runConsensusPanel` invokes one provider turn per usable panelist using stubbed
  invokers.
- Panel wrapper degrades with diagnostics when a non-required configured
  panelist is unavailable but still has two successful responses.
- Panel wrapper fails clearly when fewer than two panelists are usable.
- Generated runtime sync covers the new panel wrapper.

### Repo and Documentation Tests

- Layout tests include `plugins/consensus/skills/panel` and generated scripts.
- Skill frontmatter tests include `panel`, version sync, and argument hint.
- Docs presence tests require `documentation/docs/user-guide/consensus/panel.md`
  and navigation in `meta.json`.
- Plugin manifest tests mention panel in provider-facing descriptions/prompts.
- README scope tests ensure panel is listed as shipped and no longer described as
  future work once implemented.

### Verification Commands

- `pnpm exec vitest run tests/consensus/provider-cli tests/consensus/panel`
- `pnpm exec vitest run tests/repo`
- `pnpm run build`
- `pnpm run build:check`
- `pnpm run type-check`
- `pnpm run validate`
- `pnpm run smoke`

## Open Questions

- Should `consensus config set` support additional convenience flags for
  per-role defaults in v1, or should role defaults initially be writable only
  through `--from-file`?
- Should panel artifacts with one successful response and one or more failures be
  written as failure evidence, or should the wrapper only write artifacts on
  successful two-panelist minimum completion?

These questions do not block planning. They should be resolved in the
implementation task that defines the exact config command contract and panel
failure contract.

## References

- Discovery: `discovery.md`
- Backlog: `BL-260626-configure-default-consensus`
- Backlog: `BL-260626-add-consensus-panel-skill`
- Deferred follow-up: `BL-260701-add-multi-round-panel`
- Provider CLI source: `src/consensus/provider-cli/`
- Existing wrappers: `src/consensus/{create,decide,plan,refine,evaluate}/`
- Generated runtime contract: `scripts/build-generated.mjs`
- Consensus docs: `documentation/docs/user-guide/consensus/`
