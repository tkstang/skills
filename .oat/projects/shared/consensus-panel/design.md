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
it to ship `consensus-panel`. The generated provider CLI owns the user-facing
`consensus config` command surface, while generated wrappers consume the same
shared config/resolver modules in-process. Composition is resolved with explicit
precedence: per-invocation override, project config, user config, then built-in
defaults. Existing convergence skills keep their two-peer behavior, but read the
shared resolver when no explicit peers are provided.

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

Shared composition configuration becomes a small shared subsystem with two
consumers. The provider CLI exposes config commands that read/write user and
project config. Generated wrappers import the resolver in-process before their
existing provider preflight and execution steps. Converging wrappers receive
exactly two peers and keep their built-in defaults when no config exists.
`consensus-panel` receives 2+ panelists.

**Key Components:**

- **Config store:** JSON config at documented user/project locations, with user
  defaults, project overrides, panel size, provider/model entries, and optional
  role defaults.
- **Config resolver:** Applies precedence and returns a normalized composition
  for a specific workflow.
- **Provider CLI config commands:** Expose JSON-first view, set, and clear
  commands for default composition.
- **Convergence wrapper integration:** Update `create`, `decide`, `plan`,
  `refine`, and `evaluate` to call the resolver only when their explicit
  `--peers` flag is absent.
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
  +--> generated sibling consensus-config.mjs
  +--> consensus provider ls --json  -> inventory
  +--> consensus preflight --json    -> readiness
  +--> consensus run --json          -> one independent turn per panelist
  |
  v
panel artifact markdown

src/consensus/{create,decide,plan,refine,evaluate}/*.ts
  |
  +--> generated sibling consensus-config.mjs
  +--> existing two-peer loop/preflight behavior

src/consensus/provider-cli/commands.ts
  |
  +--> shared config/resolver modules
  +--> user/project config files
```

### Data Flow

```text
1. User asks for a panel.
2. Host skill frames the approved question without adding its own answer.
3. Panel wrapper parses invocation flags such as --question, --question-file,
   --panelists, --panel-size, --output, --run-dir, and --allow-root.
4. Resolver builds effective composition:
   invocation > project config > user config > built-in defaults.
5. Wrapper loads inventory with `consensus provider ls --json`, then checks
   readiness with `consensus preflight --json` for requested panelists.
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
type ConsensusConfigKey = 'peers' | 'panelists' | 'panel-size' | 'roles' | 'all';

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
- `roles.advisor` is reserved schema space for a future `phone-a-friend`
  integration. It can be stored and cleared as part of `roles` or `all`, but it
  does not create a live v1 resolver workflow.

### Consensus Config Resolver

**Purpose:** Normalize effective composition for a specific workflow.

**Responsibilities:**

- Apply `invocation > project > user > built-in` precedence.
- Return workflow-specific composition:
  - `convergence`: exactly two peers.
  - `panel`: two or more panelists.
- Validate provider IDs syntactically before inventory checks.
- Validate IDs against provider inventory, then validate availability through
  preflight before execution.
- Preserve explicit override precedence even when persisted defaults exist.

**Interfaces:**

```typescript
type ConsensusWorkflow = 'convergence' | 'panel';

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
  cannot reduce panel execution below two panelists. If `panel_size` is smaller
  than the configured panelist list, selection is the first N panelists in
  configured order. If `panel_size` is larger than the configured list, the
  resolver appends ready providers from inventory order, excluding duplicates. If
  the requested size still cannot be satisfied but at least two panelists are
  ready, the wrapper proceeds with a shortfall warning. If fewer than two are
  ready, the run fails closed.
- Convergence wrappers never receive more than two peers, even when panel
  defaults contain a larger panel.
- Unavailable explicitly requested providers fail closed. Unavailable configured
  defaults emit diagnostics and may fall back only when a documented fallback can
  still satisfy the workflow minimum.
- Config/resolver modules are shared TypeScript sources that are generated as
  sibling `.mjs` runtime modules for every wrapper that imports them. The provider
  CLI continues to bundle its own copy.

### Convergence Wrapper Integration

**Purpose:** Apply default consensus config to the existing converging wrappers
without changing their explicit-flag behavior or two-peer contracts.

**Responsibilities:**

- Update `create`, `decide`, `plan`, `refine`, and `evaluate` canonical wrapper
  sources to call `resolveConsensusComposition({ workflow: 'convergence', ... })`
  only when parsed `--peers` is absent.
- Load provider inventory from the same source those wrappers already use for
  provider preflight, using `provider ls` or the internal probe before readiness
  checks.
- Preserve current built-in defaults exactly when no project/user config exists:
  host-aware `claude,codex` / `codex,claude` ordering remains the fallback.
- Keep explicit `--peers` as the highest-precedence source and continue rejecting
  anything other than exactly two peers for convergence workflows.
- Regenerate all affected wrapper `.mjs` files and bump versions for all touched
  shipped skills: `create`, `decide`, `plan`, `refine`, and `evaluate`.

**Interfaces:**

```typescript
const resolvedPeers = parsed.peers ?? (await resolveConsensusComposition({
  workflow: 'convergence',
  cwd,
  env,
  inventory,
})).agents.map((agent) => agent.provider);
```

**Design Decisions:**

- No existing wrapper behavior changes when no config exists.
- Existing wrapper tests should gain default-config cases rather than replacing
  current explicit `--peers` coverage.
- Model/effort defaults are carried in the resolved agent refs, but wrappers may
  apply them only where their current provider invocation path supports those
  controls.

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
consensus config clear --json --scope user|project [--key peers|panelists|panel-size|roles|all] [--cwd <path>]
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

type PanelistInvoker = (request: {
  panelist: ConsensusAgentRef;
  prompt: string;
  schemaPath: string;
}) => Promise<PanelistInvocationResult>;

interface PanelistInvocationResult {
  ok: boolean;
  payload?: PanelResponsePayload;
  diagnostics?: string[];
}

interface ConsensusPanelRunResult {
  status: 'passed' | 'failed';
  outputPath: string | null;
  responses: ConsensusPanelArtifact['responses'];
  shortfalls: string[];
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
- At least two successful panelist responses is a successful panel run. If fewer
  than two panelists succeed, the wrapper exits non-zero and writes an
  explicitly-labeled failure/shortfall artifact at the resolved output path when
  that path can be safely written. It never silently becomes `phone-a-friend`.

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

- The skill directory is `plugins/consensus/skills/panel`; docs and prose call
  the workflow `consensus-panel`.
- The skill should explicitly contrast panel with `refine`, `evaluate`, and
  `phone-a-friend`.

### Docs, Manifests, and Generated Runtime

**Purpose:** Keep all shipped surfaces coherent.

**Responsibilities:**

- Add generated-output mappings to `scripts/build-generated.mjs` for:
  - shared config/resolver modules as sibling `consensus-config.mjs` outputs for
    `create`, `decide`, `plan`, `refine`, `evaluate`, and `panel`;
  - the panel wrapper itself;
  - any import rewrites from `../config/*.js` to sibling `.mjs` outputs.
- Generate committed `plugins/consensus/skills/panel/scripts/consensus-panel.mjs`.
- Regenerate committed wrapper outputs for all existing convergence skills that
  import the resolver.
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
    advisor?: ConsensusAgentRef; // reserved in v1; not a live resolver workflow
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
  workflow: 'convergence' | 'panel';
  agents: ConsensusAgentRef[];
  warnings: string[];
}
```

**Validation Rules:**

- `convergence` requires exactly two usable agents.
- `panel` requires at least two usable agents.
- Advisory defaults are reserved config fields in v1 and are not returned by the
  live resolver until `phone-a-friend` has a concrete consumer path.

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
  status: 'passed' | 'failed';
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
consensus config get --json --scope effective --workflow panel
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
- Fewer than two successful responses: exit non-zero and write an explicitly
  labeled `status: failed` shortfall artifact at the resolved output path when
  that path can be safely written. This is failure evidence, not a successful
  panel result.

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
- Resolver returns 2+ agents for panel workflows and enforces deterministic
  `panel_size` selection and inventory-order expansion.
- Reserved `roles.advisor` config is accepted/cleared but does not enter the live
  v1 resolver workflow.
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
- Existing wrappers preserve their built-in peer order when no config exists.
- `runConsensusPanel` invokes one provider turn per usable panelist using stubbed
  invokers.
- Panel wrapper degrades with diagnostics when a non-required configured
  panelist is unavailable but still has two successful responses.
- Panel wrapper fails clearly when fewer than two panelists are usable.
- Generated runtime sync covers the new panel wrapper.
- Generated runtime sync covers shared config/resolver module outputs for all
  wrappers that import them.

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

No design-blocking open questions remain. V1 supports role defaults through
`--from-file` plus `--key roles|all` clearing rather than per-role convenience
flags. Fewer than two successful panelist responses is a non-success that writes
an explicit `status: failed` shortfall artifact when the output path can be
safely written.

## References

- Discovery: `discovery.md`
- Backlog: `BL-260626-configure-default-consensus`
- Backlog: `BL-260626-add-consensus-panel-skill`
- Deferred follow-up: `BL-260701-add-multi-round-panel`
- Provider CLI source: `src/consensus/provider-cli/`
- Existing wrappers: `src/consensus/{create,decide,plan,refine,evaluate}/`
- Generated runtime contract: `scripts/build-generated.mjs`
- Consensus docs: `documentation/docs/user-guide/consensus/`
