// GENERATED skill payload for phone-a-friend.

// src/plugins/consensus/provider-cli/cli.ts
import { realpathSync as realpathSync4 } from "node:fs";
import { readFile as readFile3, stat as stat2 } from "node:fs/promises";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/plugins/consensus/provider-cli/commands.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import { mkdir as mkdir3, rename as rename2, writeFile as writeFile3 } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

// src/plugins/consensus/config/consensus-config.ts
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

// src/plugins/consensus/provider-cli/acp/descriptors.ts
var ANTIGRAVITY_DESCRIPTOR = {
  id: "antigravity",
  display_name: "Antigravity",
  executable: "agy",
  executable_env: "CONSENSUS_ANTIGRAVITY_EXECUTABLE",
  credential_env: ["GEMINI_API_KEY"],
  install_hint: "Install Google Antigravity and its `agy` command, then sign in with `agy acp --login` from a desktop terminal.",
  minimum_version: "1.5.13",
  launch_args: ["acp"],
  model: { kind: "config_option", config_id: "model" },
  // models.currentModelId joins model and thinking level
  // (gemini-3.8-flash-high) and is not updated by set_config_option.
  model_sources: ["config_model", "current_model_id"],
  // agy answers set_mode with {} and no echo, so `default` is confirmed by
  // session/new reporting it. Never accept-edits, auto or plan.
  mode: {
    modeId: "default",
    confirm: { initialState: true, currentModeUpdate: true }
  },
  // Without an explicit authenticate, a --gemini-dir run silently used the
  // desktop login (agy-key-default.jsonl).
  api_key: {
    env: "GEMINI_API_KEY",
    method_id: "gemini-api-key",
    private_home: {
      dir_flag: "--gemini-dir",
      app_data_flag: "--app-data-dir",
      app_data_name: "consensus-agy",
      settings_files: ["antigravity-cli/settings.json", "config/settings.json"],
      settings: { modelProvider: "gemini" }
    }
  },
  auth_hint: "Sign in with `agy acp --login` from a desktop terminal, or set GEMINI_API_KEY.",
  auth_error_patterns: [/No browser is available/i],
  // A 429 arrives as answer text with end_turn (agy-key2-default.jsonl).
  error_text_patterns: [
    {
      pattern: /Error 429|exceeded your current quota/i,
      code: "PROVIDER_LIMIT_REACHED"
    },
    { pattern: /agent executor error/i, code: "PROVIDER_EXIT" }
  ],
  brief_lines: [
    "Do not use invoke_subagent, swarm, run_workflow or schedule.",
    "Only read files inside the working directory; do not read parent directories."
  ]
};
var GEMINI_DESCRIPTOR = {
  id: "gemini",
  display_name: "Gemini CLI",
  executable: "gemini",
  executable_env: "CONSENSUS_GEMINI_EXECUTABLE",
  credential_env: ["GEMINI_API_KEY"],
  install_hint: "Install Gemini CLI with `npm install -g @google/gemini-cli`, then sign in by running `gemini` once, or set GEMINI_API_KEY.",
  minimum_version: "0.70.0",
  launch_args: ["--acp"],
  // Gemini advertises no configOptions; -m at launch is the only lever.
  model: { kind: "launch_flag", flag: "-m" },
  model_sources: ["usage_models", "current_model_id"],
  // Plan mode's only echo is this chunk, sent before the set_mode response.
  mode: {
    modeId: "plan",
    confirm: { marker: "[MODE_UPDATE] plan", currentModeUpdate: true }
  },
  api_key: { env: "GEMINI_API_KEY", method_id: "gemini-api-key" },
  auth_hint: "Sign in by running `gemini` once in a terminal, or set GEMINI_API_KEY."
};
var DROID_DESCRIPTOR = {
  id: "droid",
  display_name: "Droid",
  executable: "droid",
  executable_env: "CONSENSUS_DROID_EXECUTABLE",
  credential_env: ["FACTORY_API_KEY"],
  install_hint: "Install Factory Droid (https://docs.factory.ai), then sign in by running `droid` in a desktop terminal, or set FACTORY_API_KEY.",
  minimum_version: "1.16.0",
  launch_args: ["exec", "--output-format", "acp"],
  model: { kind: "config_option", config_id: "model" },
  model_sources: ["config_model"],
  // The ACP default is auto-medium, which auto-approves writes. normal is
  // echoed by current_mode_update and the autonomy_level config option.
  mode: {
    modeId: "normal",
    confirm: { currentModeUpdate: true, configOptionId: "autonomy_level" }
  },
  api_key: { env: "FACTORY_API_KEY", method_id: "factory-api-key" },
  auth_hint: "Sign in by running `droid` in a desktop terminal, or set FACTORY_API_KEY.",
  // The auth-required message carries a live device-pairing code.
  redactions: [/(?<=Your code:\s*)[A-Z0-9]{4}-[A-Z0-9]{4}\b/g],
  brief_lines: [
    "Do not use loop, ConnectApp, automation, or cloud/computer tools."
  ]
};
var ACP_PROVIDER_DESCRIPTORS = [
  ANTIGRAVITY_DESCRIPTOR,
  GEMINI_DESCRIPTOR,
  DROID_DESCRIPTOR
];

// src/plugins/consensus/provider-cli/types.ts
var CORE_PROVIDER_IDS = ["claude", "codex", "cursor"];
var PROVIDER_PREFLIGHT_CAPABILITIES = ["run"];
var RUN_OUTPUT_KINDS = ["json", "text"];
var CONTINUATION_MODES = [
  "new",
  "native-resume",
  "reconstructed"
];
var RESUME_FALLBACK_POLICIES = ["error", "reconstructed"];

// src/plugins/consensus/config/consensus-config.ts
var BUILT_IN_PROVIDER_ORDER = ["claude", "codex"];
var CONFIG_KEYS = /* @__PURE__ */ new Set(["schema_version", "defaults"]);
var DEFAULTS_KEYS = /* @__PURE__ */ new Set([
  "peers",
  "panelists",
  "panel_size",
  "reviewers",
  "roles",
  "provider_models"
]);
var EXTENDED_PROVIDER_IDS = new Set(
  ACP_PROVIDER_DESCRIPTORS.map((descriptor) => descriptor.id)
);
var AGENT_KEYS = /* @__PURE__ */ new Set(["provider", "model", "effort"]);
var ROLE_KEYS = /* @__PURE__ */ new Set(["panelist", "advisor", "synthesizer"]);
function parseConsensusDefaultsConfig(value) {
  if (!isRecord(value)) {
    throw new Error("Consensus config must be an object");
  }
  assertKnownKeys(value, CONFIG_KEYS, "Consensus config");
  if (value.schema_version !== "v1") {
    throw new Error('Consensus config schema_version must be "v1"');
  }
  const config = { schema_version: "v1" };
  if (value.defaults !== void 0) {
    config.defaults = parseConsensusDefaults(value.defaults);
  }
  return config;
}
function parseConsensusDefaults(value) {
  if (!isRecord(value)) {
    throw new Error("Consensus config defaults must be an object");
  }
  assertKnownKeys(value, DEFAULTS_KEYS, "Consensus config defaults");
  const defaults = {};
  if (value.peers !== void 0) {
    defaults.peers = parseAgentList(value.peers, {
      label: "Consensus config peers",
      exactLength: 2
    });
  }
  if (value.panelists !== void 0) {
    defaults.panelists = parseAgentList(value.panelists, {
      label: "Consensus config panelists",
      minLength: 2
    });
  }
  if (value.panel_size !== void 0) {
    defaults.panel_size = parsePanelSize(value.panel_size);
  }
  if (value.reviewers !== void 0) {
    defaults.reviewers = parseAgentList(value.reviewers, {
      label: "Consensus config reviewers",
      minLength: 1,
      knownProvidersOnly: true
    });
  }
  if (value.roles !== void 0) {
    defaults.roles = parseRolesConfig(value.roles);
  }
  if (value.provider_models !== void 0) {
    defaults.provider_models = parseProviderModels(value.provider_models);
  }
  return defaults;
}
function parseProviderModels(value) {
  const label = "Consensus config provider_models";
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  const models = {};
  for (const [provider, model] of Object.entries(value)) {
    if (!EXTENDED_PROVIDER_IDS.has(provider)) {
      throw new Error(
        `${label} accepts only registered extended providers (${[...EXTENDED_PROVIDER_IDS].join(", ")}), not: ${provider}`
      );
    }
    if (typeof model !== "string" || model.trim() === "") {
      throw new Error(`${label}.${provider} must be a non-empty string`);
    }
    models[provider] = model;
  }
  return models;
}
async function resolveProviderDefaultModel(input) {
  for (const scope of ["project", "user"]) {
    const config = await readConsensusConfig({
      scope,
      cwd: input.cwd,
      env: input.env
    });
    const model = config?.defaults?.provider_models?.[input.provider];
    if (model) return { model, source: scope };
  }
  return void 0;
}
async function readConsensusConfig(input) {
  const configPath = await consensusConfigPath(input);
  let contents;
  try {
    contents = await readFile(configPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Could not parse consensus config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  return parseConsensusDefaultsConfig(parsed);
}
async function writeConsensusConfig(input) {
  const configPath = await consensusConfigPath(input);
  const config = parseConsensusDefaultsConfig(input.config);
  await writeJsonAtomic(configPath, config);
}
async function clearConsensusConfig(input) {
  const key = input.key ?? "all";
  const configPath = await consensusConfigPath(input);
  if (key === "all") {
    await rm(configPath, { force: true });
    return;
  }
  const existing = await readConsensusConfig(input);
  if (!existing) return;
  const defaults = { ...existing.defaults };
  if (key === "peers") {
    delete defaults.peers;
  } else if (key === "panelists") {
    delete defaults.panelists;
  } else if (key === "panel-size") {
    delete defaults.panel_size;
  } else if (key === "reviewers") {
    delete defaults.reviewers;
  } else if (key === "roles") {
    delete defaults.roles;
  } else {
    assertNever(key);
  }
  const next = { schema_version: "v1" };
  if (hasConsensusDefaults(defaults)) next.defaults = defaults;
  await writeJsonAtomic(configPath, next);
}
async function consensusConfigPath(input) {
  if (input.scope === "user") {
    return path.join(userConfigDir(input.env), "consensus", "config.json");
  }
  return projectConsensusConfigPath(input.cwd);
}
async function projectConsensusConfigPath(cwd) {
  const fallback = projectConsensusConfigPathAt(cwd);
  const existing = await findNearestProjectConsensusConfig(cwd);
  return existing ?? fallback;
}
async function findNearestProjectConsensusConfig(cwd) {
  let current = path.resolve(cwd);
  while (true) {
    const candidate = projectConsensusConfigPathAt(current);
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
function projectConsensusConfigPathAt(cwd) {
  return path.join(path.resolve(cwd), ".consensus", "config.json");
}
async function resolveConsensusComposition(input) {
  const candidates = await loadCandidates(input);
  if (input.workflow === "convergence") {
    return resolveConvergenceComposition(input, candidates);
  }
  if (input.workflow === "review") {
    return resolveReviewComposition(input, candidates);
  }
  return resolvePanelComposition(input, candidates);
}
function resolveReviewComposition(input, candidates) {
  const candidate = candidates.find(
    ({ config }) => config.defaults?.reviewers !== void 0
  );
  const reviewers = candidate?.config.defaults?.reviewers ?? [
    { provider: "claude" },
    { provider: "codex" }
  ];
  return {
    source: candidate?.source ?? "built-in",
    workflow: "review",
    agents: reviewers,
    warnings: inventoryWarnings(reviewers, input.inventory)
  };
}
async function loadCandidates(input) {
  const candidates = [];
  if (input.invocation && hasConsensusDefaults(input.invocation)) {
    candidates.push({
      source: "invocation",
      config: {
        schema_version: "v1",
        defaults: parseConsensusDefaults(input.invocation)
      }
    });
  }
  const project = await readConsensusConfig({
    scope: "project",
    cwd: input.cwd,
    env: input.env
  });
  if (project) candidates.push({ source: "project", config: project });
  const user = await readConsensusConfig({
    scope: "user",
    cwd: input.cwd,
    env: input.env
  });
  if (user) candidates.push({ source: "user", config: user });
  return candidates;
}
function resolveConvergenceComposition(input, candidates) {
  const candidate = candidates.find(
    ({ config }) => config.defaults?.peers !== void 0
  );
  const peers = candidate?.config.defaults?.peers;
  if (peers) {
    return {
      source: candidate.source,
      workflow: "convergence",
      agents: peers,
      warnings: inventoryWarnings(peers, input.inventory)
    };
  }
  return {
    source: "built-in",
    workflow: "convergence",
    agents: builtInConvergenceAgents(2),
    warnings: []
  };
}
function resolvePanelComposition(input, candidates) {
  const panelistsCandidate = candidates.find(
    ({ config }) => config.defaults?.panelists !== void 0
  );
  const firstPanelSizeCandidate = candidates.find(
    ({ config }) => config.defaults?.panel_size !== void 0
  );
  const panelSizeCandidate = panelistsCandidate?.source === "invocation" && firstPanelSizeCandidate?.source !== "invocation" ? void 0 : firstPanelSizeCandidate;
  const source = panelistsCandidate?.source ?? panelSizeCandidate?.source;
  const configuredPanelists = panelistsCandidate?.config.defaults?.panelists;
  const targetSize = panelSizeCandidate?.config.defaults?.panel_size ?? configuredPanelists?.length ?? 2;
  const selected = selectPanelAgents(
    configuredPanelists ?? builtInAgents(input.inventory, 2),
    targetSize,
    input.inventory
  );
  const warnings = [
    ...inventoryWarnings(configuredPanelists ?? [], input.inventory)
  ];
  if (selected.length < targetSize) {
    warnings.push(
      `Only ${selected.length} panelists are available for requested panel_size ${targetSize}.`
    );
  }
  if (selected.length < 2) {
    selected.push(
      ...missingBuiltInAgents(selected).slice(0, 2 - selected.length)
    );
  }
  return {
    source: source ?? "built-in",
    workflow: "panel",
    agents: selected,
    warnings
  };
}
function selectPanelAgents(configuredPanelists, targetSize, inventory) {
  const selected = configuredPanelists.slice(0, targetSize);
  if (selected.length >= targetSize) return selected;
  const seen = new Set(selected.map((agent) => agent.provider));
  for (const entry of inventory ?? []) {
    if (selected.length >= targetSize) break;
    if (!isAutoSelectable(entry) || seen.has(entry.id)) continue;
    selected.push({ provider: entry.id });
    seen.add(entry.id);
  }
  if (selected.length < 2) {
    for (const agent of missingBuiltInAgents(selected)) {
      selected.push(agent);
      if (selected.length >= 2) break;
    }
  }
  return selected;
}
function builtInAgents(inventory, count) {
  const ready = (inventory ?? []).filter(isAutoSelectable).map((entry) => ({ provider: entry.id }));
  const selected = ready.slice(0, count);
  for (const agent of missingBuiltInAgents(selected)) {
    if (selected.length >= count) break;
    selected.push(agent);
  }
  return selected;
}
function isAutoSelectable(entry) {
  return entry.status === "ready" && CORE_PROVIDER_IDS.some((id) => id === entry.id);
}
function builtInConvergenceAgents(count) {
  return BUILT_IN_PROVIDER_ORDER.slice(0, count).map((provider) => ({
    provider
  }));
}
function missingBuiltInAgents(current) {
  const seen = new Set(current.map((agent) => agent.provider));
  return BUILT_IN_PROVIDER_ORDER.filter((provider) => !seen.has(provider)).map(
    (provider) => ({ provider })
  );
}
function inventoryWarnings(agents, inventory) {
  if (!inventory || inventory.length === 0) return [];
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const warnings = [];
  for (const agent of agents) {
    const entry = byId.get(agent.provider);
    if (!entry) {
      warnings.push(`Configured provider is not registered: ${agent.provider}`);
    } else if (entry.status !== "ready") {
      warnings.push(
        `Configured provider is not ready: ${agent.provider} (${entry.status})`
      );
    }
  }
  return warnings;
}
function parseAgentList(value, options) {
  if (!Array.isArray(value)) {
    throw new Error(`${options.label} must be an array`);
  }
  if (options.exactLength !== void 0 && value.length !== options.exactLength) {
    throw new Error(
      `${options.label} must contain exactly ${formatCount(options.exactLength)} agents`
    );
  }
  if (options.minLength !== void 0 && value.length < options.minLength) {
    throw new Error(
      `${options.label} must contain at least ${formatCount(options.minLength)} agents`
    );
  }
  const agents = value.map(
    (item, index) => parseAgentRef(item, `${options.label}[${index}]`)
  );
  if (options.knownProvidersOnly) {
    for (const agent of agents) {
      if (!CORE_PROVIDER_IDS.some((id) => id === agent.provider)) {
        throw new Error(
          `${options.label} contains unsupported provider: ${agent.provider}`
        );
      }
    }
  }
  assertUniqueProviders(agents, options.label);
  return agents;
}
function parseAgentRef(value, label) {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  assertKnownKeys(value, AGENT_KEYS, label);
  if (typeof value.provider !== "string" || value.provider.length === 0) {
    throw new Error(`${label}.provider must be a non-empty string`);
  }
  if (!isProviderId(value.provider)) {
    throw new Error(`${label}.provider must be a provider id`);
  }
  const agent = { provider: value.provider };
  if (value.model !== void 0) {
    if (typeof value.model !== "string" || value.model.length === 0) {
      throw new Error(`${label}.model must be a non-empty string`);
    }
    agent.model = value.model;
  }
  if (value.effort !== void 0) {
    if (typeof value.effort !== "string" || value.effort.length === 0) {
      throw new Error(`${label}.effort must be a non-empty string`);
    }
    agent.effort = value.effort;
  }
  return agent;
}
function parsePanelSize(value) {
  if (!Number.isInteger(value) || Number(value) < 2) {
    throw new Error(
      "Consensus config panel_size must be an integer greater than 1"
    );
  }
  return Number(value);
}
function parseRolesConfig(value) {
  if (!isRecord(value)) {
    throw new Error("Consensus config roles must be an object");
  }
  assertKnownKeys(value, ROLE_KEYS, "Consensus config roles");
  const roles = {};
  if (value.panelist !== void 0) {
    roles.panelist = parseAgentList(value.panelist, {
      label: "Consensus config roles.panelist",
      minLength: 1
    });
  }
  if (value.advisor !== void 0) {
    roles.advisor = parseAgentRef(
      value.advisor,
      "Consensus config roles.advisor"
    );
  }
  if (value.synthesizer !== void 0) {
    roles.synthesizer = parseAgentRef(
      value.synthesizer,
      "Consensus config roles.synthesizer"
    );
  }
  return roles;
}
function assertUniqueProviders(agents, label) {
  const seen = /* @__PURE__ */ new Set();
  for (const agent of agents) {
    if (seen.has(agent.provider)) {
      throw new Error(`${label} must not contain duplicate providers`);
    }
    seen.add(agent.provider);
  }
}
function assertKnownKeys(record, knownKeys, label) {
  for (const key of Object.keys(record)) {
    if (!knownKeys.has(key)) {
      throw new Error(`${label} has unknown key: ${key}`);
    }
  }
}
function hasConsensusDefaults(value) {
  return value.peers !== void 0 || value.panelists !== void 0 || value.panel_size !== void 0 || value.reviewers !== void 0 || value.roles !== void 0 || value.provider_models !== void 0;
}
function isProviderId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}
function userConfigDir(env = {}) {
  const xdg = env.XDG_CONFIG_HOME ?? process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) return path.resolve(xdg);
  const home = env.HOME ?? process.env.HOME;
  if (!home) {
    throw new Error("HOME is required to resolve user consensus config");
  }
  return path.join(path.resolve(home), ".config");
}
async function writeJsonAtomic(filePath, config) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}
`, "utf8");
  await rename(tempPath, filePath);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNodeError(error) {
  return error instanceof Error && "code" in error;
}
function formatCount(count) {
  return count === 2 ? "two" : String(count);
}
function assertNever(value) {
  throw new Error(`Unexpected consensus config key: ${String(value)}`);
}

// src/plugins/consensus/provider-cli/acp/adapter.ts
import { mkdir as mkdir2, mkdtemp, rm as rm3, writeFile as writeFile2 } from "node:fs/promises";
import os from "node:os";
import path4 from "node:path";

// src/plugins/consensus/provider-cli/subprocess.ts
import { spawn } from "node:child_process";
import { open, rm as rm2 } from "node:fs/promises";
var DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024 * 10;
var DEFAULT_TIMEOUT_SEC = 300;
var DEFAULT_TERMINATION_GRACE_MS = 250;
var DEFAULT_FINAL_RESOLUTION_MS = 1e3;
var USE_PROCESS_GROUP = process.platform !== "win32";
var FORWARDED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
var ARGV_TOO_LARGE_MESSAGE = "Provider arguments or environment exceeded the operating-system limit (E2BIG). Reduce the environment or argument sizes, such as the inline JSON schema.";
function isReliableExternalInterrupt(input) {
  return input.code === "PROVIDER_EXIT" && input.signal !== null && input.exit_code === null;
}
function runProviderSubprocess(invocation2, options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const terminationGraceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
  const finalResolutionMs = options.finalResolutionMs ?? DEFAULT_FINAL_RESOLUTION_MS;
  return new Promise((resolvePromise) => {
    let interruptSignal;
    const resolve = (result) => {
      resolvePromise(result);
      if (interruptSignal && process.listenerCount(interruptSignal) === 0) {
        process.kill(process.pid, interruptSignal);
      }
    };
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputCaptureClosed = false;
    let exitCode = null;
    let exitSignal = null;
    let settled = false;
    let terminal;
    let termination;
    let leaderClosed = false;
    let child;
    try {
      child = spawn(invocation2.executable, invocation2.argv, {
        cwd: invocation2.cwd,
        env: options.env,
        shell: false,
        detached: USE_PROCESS_GROUP,
        stdio: ["pipe", "pipe", "pipe"]
      });
    } catch (error) {
      if (error.code !== "E2BIG") throw error;
      void cleanupInvocationFiles(invocation2).then(
        () => resolve(
          failure({
            code: "PROVIDER_ARGV_TOO_LARGE",
            message: ARGV_TOO_LARGE_MESSAGE,
            retryable: false,
            stdout: "",
            stderr: "",
            exitCode: null,
            signal: null,
            diagnostics: diagnosticsFor({
              invocation: invocation2,
              stdoutBytes: 0,
              stderrBytes: 0,
              maxOutputBytes,
              timeoutSec,
              exitCode: null,
              signal: null
            })
          })
        )
      );
      return;
    }
    const provider = child;
    const forwardsInterrupts = USE_PROCESS_GROUP && provider.pid !== void 0;
    if (forwardsInterrupts) {
      for (const signal of FORWARDED_SIGNALS) {
        process.on(signal, forwardInterrupt);
      }
    }
    let killEscalation;
    let finalResolution;
    const timeout = setTimeout(() => {
      terminate("timeout");
    }, timeoutSec * 1e3);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("error", () => {
    });
    child.stderr.on("error", () => {
    });
    child.stdout.on("data", (chunk) => {
      captureOutput("stdout", chunk);
    });
    child.stderr.on("data", (chunk) => {
      captureOutput("stderr", chunk);
    });
    child.on("error", () => {
      terminal = terminal ?? "spawn_error";
      void finish();
    });
    child.on("exit", (code, signal) => {
      exitCode = code;
      exitSignal = signal;
    });
    child.on("close", (code, signal) => {
      leaderClosed = true;
      exitCode = code;
      exitSignal = signal;
      if (!termination) {
        void finish(code, signal);
        return;
      }
      if (termination.scope === "process") {
        settle("leader_exit");
        return;
      }
      if (termination.signals.includes("SIGKILL")) {
        settle("sigkill");
        return;
      }
      if (!processGroupAlive()) {
        settle(firstSignalSettlement());
        return;
      }
    });
    child.stdin.on("error", () => {
    });
    child.stdin.end(invocation2.stdin);
    function terminate(reason, firstSignal = "SIGTERM") {
      if (reason !== "interrupt") terminal = terminal ?? reason;
      if (reason === "output_cap") {
        closeOutputCapture();
      }
      if (termination) return;
      termination = {
        reason,
        scope: USE_PROCESS_GROUP ? "process_group" : "process",
        signals: [],
        settled_by: "settlement_timeout"
      };
      const firstDelivery = signalProvider(firstSignal);
      if (firstDelivery === "sent") termination.signals.push(firstSignal);
      if (firstDelivery === "gone") {
        settle("group_gone");
        return;
      }
      killEscalation = setTimeout(escalate, terminationGraceMs);
    }
    function escalate() {
      if (killEscalation) clearTimeout(killEscalation);
      killEscalation = void 0;
      if (settled || finalResolution) return;
      const delivery = signalProvider("SIGKILL");
      if (delivery === "sent") termination?.signals.push("SIGKILL");
      if (delivery === "gone") {
        settle(firstSignalSettlement());
        return;
      }
      if (leaderClosed) {
        settle("sigkill");
        return;
      }
      finalResolution = setTimeout(() => {
        settle("settlement_timeout");
      }, finalResolutionMs);
    }
    function firstSignalSettlement() {
      return termination?.reason === "interrupt" ? "forwarded_signal" : "sigterm";
    }
    function forwardInterrupt(signal) {
      interruptSignal = interruptSignal ?? signal;
      clearTimeout(timeout);
      if (termination) {
        escalate();
        return;
      }
      terminate("interrupt", signal);
    }
    function stopForwardingInterrupts() {
      if (!forwardsInterrupts) return;
      for (const signal of FORWARDED_SIGNALS) {
        process.removeListener(signal, forwardInterrupt);
      }
    }
    function signalProvider(signal) {
      if (!USE_PROCESS_GROUP || provider.pid === void 0) {
        provider.kill(signal);
        return "sent";
      }
      try {
        process.kill(-provider.pid, signal);
        return "sent";
      } catch (error) {
        if (error.code === "ESRCH") return "gone";
        provider.kill(signal);
        return "sent";
      }
    }
    function processGroupAlive() {
      if (provider.pid === void 0) return false;
      try {
        process.kill(-provider.pid, 0);
        return true;
      } catch (error) {
        return error.code !== "ESRCH";
      }
    }
    function settle(settledBy) {
      if (settled || !termination) return;
      termination.settled_by = settledBy;
      closeOutputCapture();
      provider.stdin.destroy();
      const forcedWithoutExit = settledBy === "settlement_timeout" && exitCode === null && exitSignal === null;
      void finish(exitCode, forcedWithoutExit ? "SIGKILL" : exitSignal);
    }
    function captureOutput(stream, chunk) {
      if (outputCaptureClosed) return;
      const remaining = maxOutputBytes - stdoutBytes - stderrBytes;
      if (remaining <= 0) {
        terminate("output_cap");
        return;
      }
      const chunkBytes = Buffer.byteLength(chunk);
      if (chunkBytes <= remaining) {
        appendOutput(stream, chunk, chunkBytes);
        return;
      }
      const retained = takeUtf8Prefix(chunk, remaining);
      if (retained.bytes > 0) {
        appendOutput(stream, retained.text, retained.bytes);
      }
      terminate("output_cap");
    }
    function appendOutput(stream, chunk, chunkBytes) {
      if (stream === "stdout") {
        stdout += chunk;
        stdoutBytes += chunkBytes;
      } else {
        stderr += chunk;
        stderrBytes += chunkBytes;
      }
    }
    function closeOutputCapture() {
      if (outputCaptureClosed) return;
      outputCaptureClosed = true;
      child.stdout.destroy();
      child.stderr.destroy();
    }
    async function finish(closeExitCode = exitCode, closeSignal = exitSignal) {
      if (settled) return;
      settled = true;
      stopForwardingInterrupts();
      exitCode = closeExitCode;
      exitSignal = closeSignal;
      clearTimeout(timeout);
      if (killEscalation) clearTimeout(killEscalation);
      if (finalResolution) clearTimeout(finalResolution);
      const diagnostics = diagnosticsFor({
        invocation: invocation2,
        stdoutBytes,
        stderrBytes,
        maxOutputBytes,
        timeoutSec,
        exitCode,
        signal: exitSignal,
        termination
      });
      if (terminal === "spawn_error") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_MISSING",
            message: `Provider executable not found: ${invocation2.executable}`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (terminal === "timeout") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_TIMEOUT",
            message: `Provider subprocess timed out after ${timeoutSec} seconds.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (terminal === "output_cap") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_OUTPUT_CAP_EXCEEDED",
            message: `Provider subprocess exceeded output cap of ${maxOutputBytes} bytes.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (termination?.reason === "interrupt") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_EXIT",
            message: `Provider run was interrupted by ${interruptSignal ?? "a signal"} sent to consensus.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (exitCode !== 0) {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_EXIT",
            message: `Provider subprocess exited with code ${exitCode ?? "null"}.`,
            retryable: true,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      const lastMessage = await readLastMessage(invocation2, maxOutputBytes);
      if (lastMessage.tooLarge) {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_OUTPUT_CAP_EXCEEDED",
            message: `Provider last-message capture exceeded output cap of ${maxOutputBytes} bytes.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      await cleanupInvocationFiles(invocation2);
      resolve({
        ok: true,
        stdout,
        stderr,
        ...lastMessage.contents !== void 0 ? { last_message: lastMessage.contents } : {},
        exit_code: exitCode,
        signal: exitSignal,
        diagnostics: lastMessage.warning ? {
          ...diagnostics,
          warnings: [...diagnostics.warnings ?? [], lastMessage.warning]
        } : diagnostics
      });
    }
  });
}
async function readLastMessage(invocation2, maxBytes = DEFAULT_MAX_OUTPUT_BYTES) {
  if (!invocation2.last_message_file) return {};
  const result = await readBoundedRegularFile(
    invocation2.last_message_file,
    maxBytes
  );
  if (result.ok) return { contents: result.contents };
  if (result.reason === "too_large") return { tooLarge: true };
  return {
    warning: `Could not read provider last-message file: ${result.message}`
  };
}
async function cleanupInvocationFiles(invocation2) {
  if (!invocation2.last_message_file || invocation2.cleanup_last_message_file === false) {
    return;
  }
  try {
    await rm2(invocation2.last_message_file, { force: true });
  } catch {
  }
}
async function readBoundedRegularFile(filePath, maxBytes, options = {}) {
  let handle;
  try {
    handle = await open(filePath, "r");
    const info = await handle.stat();
    if (!info.isFile()) {
      return {
        ok: false,
        reason: "not_regular",
        message: "capture is not a regular file"
      };
    }
    if (info.size > maxBytes) {
      return {
        ok: false,
        reason: "too_large",
        message: `capture exceeds ${maxBytes} bytes`
      };
    }
    await options.afterStat?.();
    const chunks = [];
    let total = 0;
    let position = 0;
    while (total <= maxBytes) {
      const remaining = maxBytes + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position
      );
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
      position += bytesRead;
    }
    if (total > maxBytes) {
      return {
        ok: false,
        reason: "too_large",
        message: `capture exceeds ${maxBytes} bytes`
      };
    }
    return {
      ok: true,
      contents: Buffer.concat(chunks, total).toString("utf8"),
      bytes: total
    };
  } catch (error) {
    return {
      ok: false,
      reason: "read_failed",
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await handle?.close();
  }
}
function takeUtf8Prefix(input, maxBytes) {
  let bytes = 0;
  let text = "";
  for (const character of input) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    text += character;
    bytes += characterBytes;
  }
  return { text, bytes };
}
function diagnosticsFor(input) {
  return {
    ...input.termination ? {
      termination: {
        ...input.termination,
        signals: [...input.termination.signals]
      }
    } : {},
    strategy_used: input.invocation.strategy,
    output_mode: input.invocation.output_mode,
    redacted_command: input.invocation.redacted_command,
    provider_exit_code: input.exitCode,
    provider_signal: input.signal,
    output_bytes: {
      stdout: input.stdoutBytes,
      stderr: input.stderrBytes,
      max: input.maxOutputBytes
    },
    timeout_sec: input.timeoutSec
  };
}
function failure(input) {
  return {
    ok: false,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    stdout: input.stdout,
    stderr: input.stderr,
    exit_code: input.exitCode,
    signal: input.signal,
    diagnostics: input.diagnostics
  };
}

// src/plugins/consensus/provider-cli/acp/client.ts
import { realpathSync as realpathSync2 } from "node:fs";
import path3 from "node:path";

// src/plugins/consensus/provider-cli/acp/jsonrpc.ts
var JsonRpcConnection = class {
  constructor(options) {
    this.options = options;
  }
  options;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  closed = false;
  counters = {
    ignored_lines: 0,
    unmatched_responses: 0
  };
  request(method, params) {
    const id = this.nextId++;
    if (this.closed) {
      return { id, outcome: Promise.resolve({ kind: "closed" }) };
    }
    const outcome = new Promise((resolve) => {
      this.pending.set(id, resolve);
    });
    this.send({ jsonrpc: "2.0", id, method, params });
    return { id, outcome };
  }
  notify(method, params) {
    if (this.closed) return;
    this.send({ jsonrpc: "2.0", method, params });
  }
  receiveLine(line) {
    if (line.trim() === "") return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.counters.ignored_lines++;
      return;
    }
    if (!isRecord2(message)) {
      this.counters.ignored_lines++;
      return;
    }
    if (typeof message.method === "string") {
      if (isJsonRpcId(message.id)) {
        this.answer(message.id, message.method, message.params);
      } else {
        this.options.onNotification(message.method, message.params);
      }
      return;
    }
    if ("result" in message || "error" in message) {
      this.settleResponse(message);
      return;
    }
    this.counters.ignored_lines++;
  }
  // Settles every pending request as closed; later sends are dropped.
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.pending.values()) resolve({ kind: "closed" });
    this.pending.clear();
  }
  isClosed() {
    return this.closed;
  }
  stats() {
    return { ...this.counters };
  }
  answer(id, method, params) {
    const reply = this.options.onRequest({ id, method, params });
    if (this.closed) return;
    this.send({ jsonrpc: "2.0", id, ...reply });
  }
  settleResponse(message) {
    const id = message.id;
    const resolve = typeof id === "number" ? this.pending.get(id) : void 0;
    if (!resolve || typeof id !== "number") {
      this.counters.unmatched_responses++;
      return;
    }
    this.pending.delete(id);
    if ("error" in message) {
      resolve({ kind: "error", error: toErrorObject(message.error) });
      return;
    }
    resolve({ kind: "result", result: message.result });
  }
  send(message) {
    this.options.write(`${JSON.stringify(message)}
`);
  }
};
function toErrorObject(value) {
  if (!isRecord2(value)) {
    return { code: -32603, message: "Malformed JSON-RPC error object" };
  }
  return {
    code: typeof value.code === "number" ? value.code : -32603,
    message: typeof value.message === "string" ? value.message : "",
    ...value.data !== void 0 ? { data: value.data } : {}
  };
}
function isJsonRpcId(value) {
  return typeof value === "string" || typeof value === "number";
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/plugins/consensus/provider-cli/acp/process.ts
import { spawn as spawn2 } from "node:child_process";
var USE_PROCESS_GROUP2 = process.platform !== "win32";
var FORWARDED_SIGNALS2 = ["SIGINT", "SIGTERM", "SIGHUP"];
var DEFAULT_MAX_STDERR_BYTES = 64 * 1024;
var GROUP_POLL_MS = 20;
var STDOUT_DRAIN_AFTER_EXIT_MS = 250;
var LineBuffer = class {
  pending = "";
  push(chunk) {
    const lines = [];
    let start = 0;
    let searchFrom = this.pending.length;
    this.pending += chunk;
    let newline = this.pending.indexOf("\n", searchFrom);
    while (newline !== -1) {
      lines.push(stripCarriageReturn(this.pending.slice(start, newline)));
      start = newline + 1;
      searchFrom = start;
      newline = this.pending.indexOf("\n", searchFrom);
    }
    this.pending = this.pending.slice(start);
    return lines;
  }
  // The unterminated remainder, if any, as a final line.
  flush() {
    const rest = this.pending;
    this.pending = "";
    return rest.length > 0 ? stripCarriageReturn(rest) : void 0;
  }
};
function stripCarriageReturn(line) {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}
var spawnProcessGroup = (options) => new Promise((resolve) => {
  let child;
  try {
    child = spawn2(options.executable, [...options.argv], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      detached: USE_PROCESS_GROUP2,
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    const errno = error.code;
    if (errno !== "E2BIG") throw error;
    resolve({
      ok: false,
      reason: "argv_too_large",
      errno,
      message: "Agent arguments or environment exceeded the operating-system limit (E2BIG)."
    });
    return;
  }
  child.once("error", (error) => {
    resolve({
      ok: false,
      reason: "spawn_failed",
      ...error.code ? { errno: error.code } : {},
      message: `Could not start ${options.executable}: ${error.code ?? error.message}`
    });
  });
  child.once("spawn", () => {
    child.on("error", () => {
    });
    resolve({ ok: true, handle: attach(child, options) });
  });
});
function attach(child, options) {
  const maxStderrBytes = options.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;
  const lines = new LineBuffer();
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stderrKept = "";
  let stderrKeptBytes = 0;
  let capped = false;
  let stdinClosed = false;
  let stdoutEnded = false;
  let exited;
  let interrupt;
  let killedForRepeat = false;
  let listening = false;
  let resolveExit;
  const exit = new Promise((resolve) => {
    resolveExit = resolve;
  });
  const deadline = setTimeout(() => {
    options.onTimeout?.();
  }, options.timeoutMs);
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("error", () => {
  });
  child.stderr.on("error", () => {
  });
  child.stdin.on("error", () => {
  });
  child.stdout.on("data", (chunk) => {
    if (!countOutput("stdout", chunk)) return;
    for (const line of lines.push(chunk)) options.onLine(line);
  });
  child.stdout.on("end", endStdout);
  child.stderr.on("data", (chunk) => {
    if (!countOutput("stderr", chunk)) return;
    const room = maxStderrBytes - stderrKeptBytes;
    if (room <= 0) return;
    const kept = takeUtf8Prefix(chunk, room);
    stderrKept += kept.text;
    stderrKeptBytes += kept.bytes;
  });
  child.on("exit", (code, signal) => {
    exited = { code, signal };
    clearTimeout(deadline);
    resolveExit(exited);
    setTimeout(endStdout, STDOUT_DRAIN_AFTER_EXIT_MS);
  });
  if (USE_PROCESS_GROUP2 && child.pid !== void 0) {
    listening = true;
    for (const signal of FORWARDED_SIGNALS2) process.on(signal, onSignal);
  }
  function onSignal(signal) {
    if (interrupt) {
      killedForRepeat = true;
      signalGroup("SIGKILL");
      return;
    }
    interrupt = signal;
    clearTimeout(deadline);
    options.onInterrupt?.(signal);
  }
  function countOutput(stream, chunk) {
    if (capped) return false;
    const bytes = Buffer.byteLength(chunk);
    if (stream === "stdout") stdoutBytes += bytes;
    else stderrBytes += bytes;
    if (stdoutBytes + stderrBytes > options.maxOutputBytes) {
      capped = true;
      options.onOutputCap?.();
      return false;
    }
    return true;
  }
  function endStdout() {
    if (stdoutEnded) return;
    stdoutEnded = true;
    if (!capped) {
      const rest = lines.flush();
      if (rest !== void 0) options.onLine(rest);
    }
    options.onStdoutEnd?.();
  }
  function signalGroup(signal) {
    if (!USE_PROCESS_GROUP2 || child.pid === void 0) {
      if (exited) return "gone";
      child.kill(signal);
      return "sent";
    }
    try {
      process.kill(-child.pid, signal);
      return "sent";
    } catch (error) {
      if (error.code === "ESRCH") return "gone";
      child.kill(signal);
      return "sent";
    }
  }
  function groupAlive() {
    if (!USE_PROCESS_GROUP2 || child.pid === void 0) return !exited;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      return error.code !== "ESRCH";
    }
  }
  async function waitUntil(condition, ms) {
    const end = Date.now() + ms;
    while (!condition()) {
      if (Date.now() >= end) return false;
      await delay(GROUP_POLL_MS);
    }
    return true;
  }
  function closeStdin() {
    if (stdinClosed) return;
    stdinClosed = true;
    child.stdin.end();
  }
  async function teardown(teardownOptions) {
    clearTimeout(deadline);
    closeStdin();
    if (teardownOptions.waitForExit !== false && !exited) {
      await withTimeout(exit, teardownOptions.exitGraceMs);
    }
    const result = {
      scope: USE_PROCESS_GROUP2 ? "process_group" : "process",
      exited_before_signal: exited !== void 0,
      signals: [],
      settled_by: "group_gone"
    };
    if (killedForRepeat) result.signals.push("SIGKILL");
    const first = teardownOptions.firstSignal ?? "SIGTERM";
    if (signalGroup(first) === "gone") {
      finishStreams();
      return result;
    }
    result.signals.push(first);
    if (await waitUntil(() => !groupAlive(), teardownOptions.killGraceMs)) {
      result.settled_by = USE_PROCESS_GROUP2 ? "first_signal" : "leader_exit";
      finishStreams();
      return result;
    }
    if (signalGroup("SIGKILL") === "sent") result.signals.push("SIGKILL");
    const gone = await waitUntil(
      () => !groupAlive(),
      teardownOptions.settleMs ?? 1e3
    );
    result.settled_by = gone ? "sigkill" : "settlement_timeout";
    finishStreams();
    return result;
  }
  function finishStreams() {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    if (listening) {
      listening = false;
      for (const signal of FORWARDED_SIGNALS2) {
        process.removeListener(signal, onSignal);
      }
    }
  }
  return {
    pid: child.pid,
    write(data) {
      if (stdinClosed || child.stdin.destroyed) return;
      child.stdin.write(data);
    },
    exit,
    hasExited: () => exited !== void 0,
    stderr: () => stderrKept,
    outputBytes: () => ({
      stdout: stdoutBytes,
      stderr: stderrBytes,
      max: options.maxOutputBytes
    }),
    interruptSignal: () => interrupt,
    teardown,
    reraiseInterrupt() {
      if (listening || !interrupt) return;
      if (process.listenerCount(interrupt) === 0) {
        process.kill(process.pid, interrupt);
      }
    }
  };
}
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// src/plugins/consensus/provider-cli/acp/responder.ts
import { realpathSync } from "node:fs";
import path2 from "node:path";
var ACP_CLIENT_CAPABILITIES = {
  fs: { readTextFile: false, writeTextFile: false },
  terminal: false
};
var CANCELLED_PERMISSION_OUTCOME = {
  outcome: { outcome: "cancelled" }
};
var REJECT_KINDS = ["reject_once", "reject_always"];
var MAX_FIELD_CHARS = 120;
function denyPermissionRequest(params, options = {}) {
  const request = isRecord2(params) ? params : {};
  const denialBase = describeToolCall(
    request.toolCall,
    options.redact ?? ((text) => text)
  );
  if (!options.cancelled) {
    const optionId = rejectOptionId(request.options);
    if (optionId !== void 0) {
      return {
        response: { outcome: { outcome: "selected", optionId } },
        denial: { ...denialBase, outcome: "rejected" }
      };
    }
  }
  return {
    response: CANCELLED_PERMISSION_OUTCOME,
    denial: { ...denialBase, outcome: "cancelled" }
  };
}
function realExistingPath(file) {
  const rest = [];
  let current = path2.resolve(file);
  for (; ; ) {
    try {
      return path2.join(realpathSync(current), ...rest.toReversed());
    } catch {
      const parent = path2.dirname(current);
      if (parent === current) return path2.resolve(file);
      rest.push(path2.basename(current));
      current = parent;
    }
  }
}
function methodNotFound(method) {
  return { code: -32601, message: "Method not found", data: { method } };
}
function rejectOptionId(options) {
  for (const kind of REJECT_KINDS) {
    const optionId = optionIdOfKind(options, kind);
    if (optionId !== void 0) return optionId;
  }
  return void 0;
}
function optionIdOfKind(options, kind) {
  if (!Array.isArray(options)) return void 0;
  const match = options.find(
    (option) => isRecord2(option) && option.kind === kind && typeof option.optionId === "string"
  );
  return match?.optionId;
}
function describeToolCall(toolCall, redact) {
  if (!isRecord2(toolCall)) return {};
  const short = (value) => typeof value === "string" && value !== "" ? shortString(redact(value)) : void 0;
  const tool = short(toolCall.name) ?? short(toolCall.title);
  const toolCallId = short(toolCall.toolCallId);
  const kind = short(toolCall.kind);
  const location = Array.isArray(toolCall.locations) && isRecord2(toolCall.locations[0]) ? toolCall.locations[0].path : void 0;
  const firstPath = typeof location === "string" && location !== "" ? location : void 0;
  return {
    ...toolCallId !== void 0 ? { tool_call_id: toolCallId } : {},
    ...tool !== void 0 ? { tool } : {},
    ...kind !== void 0 ? { kind } : {},
    ...firstPath !== void 0 ? { path: firstPath } : {}
  };
}
function shortString(value, max = MAX_FIELD_CHARS) {
  return value.length > max ? `${value.slice(0, max)}\u2026` : value;
}

// src/plugins/consensus/provider-cli/acp/transcript.ts
var ACP_TURN_RESULT_SCHEMA = "consensus.acp-turn.v1";
function emptyTurnResult() {
  return {
    schema: ACP_TURN_RESULT_SCHEMA,
    phase: "spawn",
    prompt_sent: false,
    text: "",
    denials: [],
    refused_methods: [],
    models: {},
    setup: []
  };
}
function serializeAcpTurnResult(result) {
  return JSON.stringify(result);
}
function parseAcpTurnResult(stdout) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    return void 0;
  }
  if (!isRecord2(value) || value.schema !== ACP_TURN_RESULT_SCHEMA || typeof value.text !== "string" || typeof value.prompt_sent !== "boolean" || typeof value.phase !== "string" || !Array.isArray(value.denials) || !Array.isArray(value.refused_methods) || !Array.isArray(value.setup) || !isRecord2(value.models)) {
    return void 0;
  }
  return value;
}
var DEFAULT_REDACTIONS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /\b(?:sk|fk|pk|ghp|gho|ghs|github_pat|xox[a-z])[-_][A-Za-z0-9_-]{12,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi
];
var MIN_SECRET_VALUE_CHARS = 6;
var REDACTED = "<redacted>";
function redactText(text, options = {}) {
  let redacted = redactSecretValues(text, options.secretValues);
  for (const pattern of [...DEFAULT_REDACTIONS, ...options.patterns ?? []]) {
    redacted = redacted.replace(globalPattern(pattern), REDACTED);
  }
  return redacted;
}
function redactSecretValues(text, secretValues = []) {
  let redacted = text;
  for (const value of secretValues) {
    if (value.length < MIN_SECRET_VALUE_CHARS) continue;
    redacted = redacted.split(value).join(REDACTED);
  }
  return redacted;
}
function sanitizeTurnResult(result, options) {
  const redact = (text2) => redactText(text2, options);
  const walk = (value) => {
    if (typeof value === "string") return redact(value);
    if (Array.isArray(value)) return value.map(walk);
    if (isRecord2(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [redact(key), walk(entry)])
      );
    }
    return value;
  };
  const { schema, text, ...rest } = result;
  return {
    ...walk(rest),
    schema,
    text: (options.patterns ?? []).reduce(
      (redacted, pattern) => redacted.replace(globalPattern(pattern), REDACTED),
      redactSecretValues(text, options.secretValues)
    )
  };
}
function globalPattern(pattern) {
  return pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}
var AUTH_REQUIRED_CODE = -32e3;
function classifyAcpTurn(result, options = {}) {
  const name = options.displayName ?? result.agent?.name ?? "The ACP agent";
  const startedTurn = result.prompt_sent ? "unknown" : "not_started";
  if (result.abort === "timeout") {
    return failure2(
      "PROVIDER_TIMEOUT",
      result.prompt_sent ? `${name} did not finish the turn before the deadline; the turn was cancelled.` : `${name} did not finish starting the session before the deadline.`,
      "provider_timeout",
      startedTurn
    );
  }
  if (result.abort === "output_cap") {
    return failure2(
      "PROVIDER_OUTPUT_CAP_EXCEEDED",
      `${name} exceeded the output cap.`,
      "output_cap_exceeded",
      startedTurn
    );
  }
  if (result.abort === "mode_changed") {
    return failure2(
      "PROVIDER_EXIT",
      `${name} left read-only mode during the turn (now ${result.mode_drift ?? "unknown"}); the turn was cancelled and its answer discarded.`,
      "acp_mode_changed",
      "unknown"
    );
  }
  if (result.abort === "interrupt") {
    return failure2(
      "PROVIDER_EXIT",
      `The ${name} run was interrupted by a signal sent to consensus.`,
      "provider_run_interrupted",
      startedTurn
    );
  }
  const error = result.error;
  if (error) {
    if (error.kind === "spawn") {
      return error.errno === "E2BIG" ? failure2(
        "PROVIDER_ARGV_TOO_LARGE",
        error.message,
        "provider_argv_too_large",
        "not_started"
      ) : failure2(
        "PROVIDER_MISSING",
        error.message,
        "provider_missing",
        "not_started"
      );
    }
    if (error.kind === "unsupported_option") {
      return failure2(
        "PROVIDER_UNSUPPORTED_OPTION",
        error.message,
        "provider_unsupported_option",
        "not_started"
      );
    }
    if (error.kind === "unconfirmed_setup") {
      return failure2(
        "PROVIDER_UNSUPPORTED_OPTION",
        `${name} did not confirm its read-only setup: ${error.message}`,
        "acp_setup_unconfirmed",
        "not_started"
      );
    }
    if (error.kind === "jsonrpc" && isAuthError(error, options)) {
      const hint = options.authHint ? ` ${options.authHint}` : "";
      return failure2(
        "PROVIDER_AUTH_REQUIRED",
        `${name} needs authentication: ${error.message}.${hint}`,
        "provider_auth_required",
        error.phase === "prompt" ? "unknown" : "not_started"
      );
    }
    if (error.kind === "client_error") {
      return failure2(
        "PROVIDER_EXIT",
        `The consensus ACP client failed during ${error.phase}: ${error.message}`,
        "acp_client_error",
        startedTurn
      );
    }
    if (error.kind === "agent_exit") {
      return failure2(
        "PROVIDER_EXIT",
        `${name} exited during ${error.phase}: ${error.message}`,
        "provider_exit_terminal",
        startedTurn
      );
    }
    return failure2(
      error.kind === "malformed" ? "PROVIDER_MALFORMED_RESULT" : "PROVIDER_EXIT",
      `${name} failed during ${error.phase}: ${error.message}`,
      error.kind === "malformed" ? "acp_malformed_response" : "acp_jsonrpc_error",
      error.phase === "prompt" ? "unknown" : "not_started"
    );
  }
  if (!result.prompt_sent) {
    return failure2(
      "PROVIDER_EXIT",
      `${name} ended before the prompt was sent.`,
      "acp_prompt_not_sent",
      "not_started"
    );
  }
  if (result.stop_reason === void 0) {
    return failure2(
      "PROVIDER_EXIT",
      `${name} ended without answering the prompt.`,
      "acp_no_prompt_response",
      "unknown"
    );
  }
  const text = result.text;
  const blank = text.trim() === "";
  const denials = result.denials;
  if (result.stop_reason === "end_turn") {
    for (const entry of options.errorTextPatterns ?? []) {
      if (entry.pattern.test(text)) {
        return failure2(
          entry.code,
          `${name} reported an error instead of an answer: ${firstLine(text)}`,
          entry.code === "PROVIDER_LIMIT_REACHED" ? "provider_limit_reached" : "acp_error_text",
          "completed"
        );
      }
    }
    if (blank && denials.length > 0) return permissionDenied(name, denials);
    if (blank) {
      return failure2(
        "PROVIDER_EMPTY_OUTPUT",
        `${name} ended the turn without answer text.`,
        "provider_empty_output",
        "completed"
      );
    }
    const warnings = denials.length > 0 ? [
      `${name} asked for ${denials.length} tool permission(s) outside read-only; all were denied (${toolList(denials)}).`
    ] : [];
    return { ok: true, text, warnings };
  }
  if (result.stop_reason === "cancelled" && denials.length > 0) {
    return permissionDenied(name, denials);
  }
  if (result.stop_reason === "max_tokens" || result.stop_reason === "max_turn_requests") {
    return failure2(
      "PROVIDER_LIMIT_REACHED",
      `${name} stopped at a limit (${result.stop_reason}).`,
      "provider_limit_reached",
      "completed"
    );
  }
  return failure2(
    "PROVIDER_EXIT",
    `${name} ended the turn with stop reason ${result.stop_reason}.`,
    "acp_stop_reason",
    "completed"
  );
}
function permissionDenied(name, denials) {
  return failure2(
    "PROVIDER_PERMISSION_DENIED",
    `${name} tried to act outside read-only and was denied (${toolList(denials)}); the turn ended without an answer.`,
    "acp_permission_denied",
    "completed"
  );
}
function isAuthError(error, options) {
  if (error.code === AUTH_REQUIRED_CODE) return true;
  return (options.authErrorPatterns ?? []).some(
    (pattern) => pattern.test(error.message)
  );
}
function toolList(denials) {
  const tools = [
    ...new Set(denials.map((denial) => denial.tool ?? denial.kind ?? "tool"))
  ];
  return tools.join(", ");
}
function firstLine(text) {
  const line = text.split(/\r?\n/).map((part) => part.trim()).find((part) => part !== "") ?? "";
  return line.length > 200 ? `${line.slice(0, 200)}\u2026` : line;
}
function failure2(code, message, terminalReason, turn) {
  return {
    ok: false,
    code,
    message,
    retryable: false,
    terminal_reason: terminalReason,
    turn
  };
}

// src/plugins/consensus/provider-cli/acp/client.ts
var ACP_PROTOCOL_VERSION = 1;
var DEFAULT_ACP_TIMING = {
  cancelGraceMs: 1500,
  closeTimeoutMs: 1e3,
  exitGraceMs: 2e3,
  killGraceMs: 500,
  settleMs: 1e3
};
var DEFAULT_MAX_OUTPUT_BYTES2 = 10 * 1024 * 1024;
var MAX_REFUSED_METHODS = 20;
var MAX_META_CHARS = 200;
var ADVERTISED_SAMPLE = 5;
var stdioAcpTransport = { run: runAcpTurn };
async function runAcpTurn(input) {
  const timing = { ...DEFAULT_ACP_TIMING, ...input.timing };
  const maxOutputBytes = input.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES2;
  const secretValues = (input.plan.credentialEnv ?? []).map((name) => input.env?.[name]).filter((value) => typeof value === "string");
  const redaction = { patterns: input.plan.redactions, secretValues };
  const redact = (text) => redactText(text, redaction);
  const result = emptyTurnResult();
  let abortReason;
  let interruptSignal;
  let resolveAbort;
  const aborted = new Promise((resolve) => {
    resolveAbort = resolve;
  });
  const abort = (reason) => {
    if (abortReason) return;
    abortReason = reason;
    resolveAbort({ kind: "aborted" });
  };
  const clientFailure = (error) => {
    if (!result.error) {
      result.error = {
        phase: result.phase,
        kind: "client_error",
        message: redact(error instanceof Error ? error.message : String(error))
      };
    }
    resolveAbort({ kind: "aborted" });
  };
  const session = new SessionState(result, redact, () => {
    if (result.prompt_sent) abort("mode_changed");
  });
  const io = {};
  const connection = new JsonRpcConnection({
    write: (line) => {
      try {
        io.group?.write(line);
      } catch (error) {
        clientFailure(error);
      }
    },
    onRequest: (request) => {
      if (request.method === "session/request_permission") {
        const { response, denial } = denyPermissionRequest(request.params, {
          cancelled: result.cancel_sent === true,
          redact
        });
        result.denials.push(denial);
        return { result: response };
      }
      if (!result.refused_methods.includes(request.method) && result.refused_methods.length < MAX_REFUSED_METHODS) {
        result.refused_methods.push(clip(redact(request.method)));
      }
      return { error: methodNotFound(request.method) };
    },
    onNotification: (method, params) => session.notification(method, params)
  });
  const spawned = await (input.spawn ?? spawnProcessGroup)({
    executable: input.executable,
    argv: input.argv,
    cwd: input.cwd,
    env: input.env,
    maxOutputBytes,
    maxStderrBytes: input.maxStderrBytes,
    timeoutMs: input.timeoutMs,
    onLine: (line) => connection.receiveLine(line),
    onStdoutEnd: () => connection.close(),
    onTimeout: () => abort("timeout"),
    onOutputCap: () => abort("output_cap"),
    onInterrupt: (signal) => {
      interruptSignal = signal;
      abort("interrupt");
    }
  });
  if (!spawned.ok) {
    result.error = {
      phase: "spawn",
      kind: "spawn",
      message: redact(spawned.message),
      ...spawned.errno ? { errno: spawned.errno } : {}
    };
    return {
      result,
      stderr: "",
      exit_code: null,
      signal: null,
      output_bytes: { stdout: 0, stderr: 0, max: maxOutputBytes }
    };
  }
  const group = spawned.handle;
  io.group = group;
  const call = (method, params) => Promise.race([connection.request(method, params).outcome, aborted]);
  let promptOutcome;
  let teardown;
  try {
    await drive();
  } catch (error) {
    clientFailure(error);
  }
  try {
    await finish();
  } catch (error) {
    clientFailure(error);
  } finally {
    await tearDownGroup();
  }
  const exit = group.hasExited() ? await group.exit : void 0;
  return finalize();
  async function drive() {
    result.phase = "initialize";
    const initialized = await call("initialize", {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: ACP_CLIENT_CAPABILITIES,
      clientInfo: input.plan.clientInfo
    });
    const init = expectResult(initialized, "initialize");
    if (!init) return;
    session.initialized(init);
    if (init.protocolVersion !== ACP_PROTOCOL_VERSION) {
      fail(
        "malformed",
        `unsupported ACP protocol version ${String(init.protocolVersion)}`
      );
      return;
    }
    if (input.plan.authenticate) {
      result.phase = "authenticate";
      const authenticated = await call("authenticate", {
        methodId: input.plan.authenticate.methodId
      });
      if (!expectResult(authenticated, "authenticate")) return;
    }
    result.phase = "session_new";
    const created = await call("session/new", {
      cwd: input.cwd,
      mcpServers: []
    });
    const newSession = expectResult(created, "session/new");
    if (!newSession) return;
    if (typeof newSession.sessionId !== "string" || newSession.sessionId === "") {
      fail("malformed", "session/new returned no sessionId");
      return;
    }
    session.created(newSession);
    result.phase = "setup";
    if (!await setup()) return;
    const drift = session.modeDrift();
    if (drift !== void 0) {
      fail(
        "unconfirmed_setup",
        `the agent left mode ${input.plan.mode?.modeId} (now ${drift}) before the prompt`
      );
      return;
    }
    result.phase = "prompt";
    const text = [...input.plan.briefLines ?? [], input.prompt].join("\n\n");
    result.prompt_sent = true;
    session.promptStarted();
    const prompt = connection.request("session/prompt", {
      sessionId: result.session_id,
      prompt: [{ type: "text", text }]
    });
    promptOutcome = prompt.outcome;
    const answered = await Promise.race([prompt.outcome, aborted]);
    const response = expectResult(answered, "session/prompt");
    if (!response) return;
    session.promptAnswered(response);
    result.phase = "complete";
  }
  async function setup() {
    const expected = input.plan.expectCurrentModel;
    if (expected !== void 0) {
      const current = result.models.current_model_id;
      const confirmed = current === expected;
      result.setup.push({
        step: "model_state",
        id: "currentModelId",
        value: expected,
        confirmed,
        ...confirmed ? { evidence: "session_state" } : {}
      });
      if (!confirmed) {
        fail(
          "unconfirmed_setup",
          `the session started with model ${current ?? "unknown"}, not ${expected}`
        );
        return false;
      }
    }
    const mode = input.plan.mode;
    if (mode) {
      session.watchMode(mode);
      const set = await call("session/set_mode", {
        sessionId: result.session_id,
        modeId: mode.modeId
      });
      if (!expectResult(set, "session/set_mode")) return false;
      const evidence = session.modeEvidence();
      result.setup.push({
        step: "mode",
        id: "mode",
        value: mode.modeId,
        confirmed: evidence !== void 0,
        ...evidence ? { evidence } : {}
      });
      if (!evidence) {
        fail("unconfirmed_setup", `mode ${mode.modeId} was not confirmed`);
        return false;
      }
      session.holdMode(mode);
    }
    for (const step of input.plan.configOptions ?? []) {
      const advertised = session.optionValues(step.configId);
      if (advertised === void 0) {
        fail(
          "unsupported_option",
          `${agentLabel()} does not advertise the config option ${step.configId}`
        );
        return false;
      }
      if (step.requireAdvertised && !advertised.includes(step.value)) {
        const sample = advertised.slice(0, ADVERTISED_SAMPLE).join(", ");
        fail(
          "unsupported_option",
          `${step.configId} ${step.value} is not offered by ${agentLabel()} (offered: ${sample}${advertised.length > ADVERTISED_SAMPLE ? ", \u2026" : ""})`
        );
        return false;
      }
      const set = await call("session/set_config_option", {
        sessionId: result.session_id,
        configId: step.configId,
        value: step.value
      });
      const response = expectResult(set, "session/set_config_option");
      if (!response) return false;
      const current = currentValueOf(response.configOptions, step.configId);
      session.configOptionsSeen(response.configOptions);
      const confirmed = current === step.value;
      result.setup.push({
        step: "config_option",
        id: step.configId,
        value: step.value,
        confirmed,
        ...confirmed ? { evidence: "response" } : {}
      });
      if (!confirmed) {
        fail(
          "unconfirmed_setup",
          `${step.configId} is ${current ?? "unset"} after setting ${step.value}`
        );
        return false;
      }
    }
    return true;
  }
  async function finish() {
    const promptInFlight = result.prompt_sent && result.stop_reason === void 0 && !result.error;
    if (abortReason && promptInFlight && !connection.isClosed()) {
      result.cancel_sent = true;
      connection.notify("session/cancel", { sessionId: result.session_id });
      if ((abortReason === "timeout" || abortReason === "mode_changed") && promptOutcome) {
        const late = await withTimeout(promptOutcome, timing.cancelGraceMs);
        if (late !== "timeout" && late.kind === "result") {
          session.promptAnswered(late.result);
        }
      }
    }
    if (result.session_id && session.closeAdvertised() && !connection.isClosed() && abortReason !== "output_cap") {
      const closed = await withTimeout(
        connection.request("session/close", { sessionId: result.session_id }).outcome,
        timing.closeTimeoutMs
      );
      result.session_closed = closed !== "timeout" && closed.kind === "result";
    }
  }
  async function tearDownGroup() {
    try {
      teardown = await group.teardown({
        exitGraceMs: timing.exitGraceMs,
        killGraceMs: timing.killGraceMs,
        settleMs: timing.settleMs,
        firstSignal: interruptSignal ?? "SIGTERM",
        waitForExit: abortReason !== "interrupt"
      });
    } catch (error) {
      clientFailure(error);
      killGroupNow(group.pid);
    } finally {
      connection.close();
    }
  }
  function finalize() {
    if (abortReason) result.abort = abortReason;
    result.denials = result.denials.map(
      (denial) => denial.path ? { ...denial, path: displayPath(denial.path, input.cwd, redact) } : denial
    );
    const ignored = connection.stats().ignored_lines;
    if (ignored > 0) result.ignored_lines = ignored;
    const outcome = {
      result: sanitizeTurnResult(result, redaction),
      stderr: redact(group.stderr()),
      exit_code: exit?.code ?? null,
      signal: exit?.signal ?? null,
      ...teardown ? { teardown } : {},
      output_bytes: group.outputBytes()
    };
    queueMicrotask(() => group.reraiseInterrupt());
    return outcome;
  }
  function expectResult(outcome, method) {
    if (outcome.kind === "aborted") return void 0;
    if (outcome.kind === "closed") {
      fail(
        "agent_exit",
        `the agent closed the connection before answering ${method}`
      );
      return void 0;
    }
    if (outcome.kind === "error") {
      fail(
        "jsonrpc",
        `${method} failed: ${outcome.error.message || "no message"} (${outcome.error.code})`,
        outcome.error.code
      );
      return void 0;
    }
    if (!isRecord2(outcome.result)) {
      fail("malformed", `${method} returned a non-object result`);
      return void 0;
    }
    return outcome.result;
  }
  function fail(kind, message, code) {
    if (result.error) return;
    result.error = {
      phase: result.phase,
      kind,
      ...code !== void 0 ? { code } : {},
      message: redact(message)
    };
  }
  function agentLabel() {
    return result.agent?.name ?? "the agent";
  }
}
var SessionState = class {
  constructor(result, redact, onModeDrift = () => {
  }) {
    this.result = result;
    this.redact = redact;
    this.onModeDrift = onModeDrift;
  }
  result;
  redact;
  onModeDrift;
  closeCapability = false;
  configOptions;
  modeWatch;
  // The confirmed read-only mode, watched until the session ends.
  held;
  promptActive = false;
  initialMode;
  // Agent-reported strings are redacted before they are shortened, so a
  // clip never leaves part of a secret behind.
  keep(value) {
    return clip(this.redact(value));
  }
  initialized(init) {
    const info = isRecord2(init.agentInfo) ? init.agentInfo : {};
    const agent = {};
    for (const key of ["name", "title", "version"]) {
      if (typeof info[key] === "string") agent[key] = this.keep(info[key]);
    }
    if (Object.keys(agent).length > 0) this.result.agent = agent;
    const capabilities = isRecord2(init.agentCapabilities) ? init.agentCapabilities : {};
    const sessionCapabilities = capabilities.sessionCapabilities ?? capabilities.session_capabilities;
    this.closeCapability = isRecord2(sessionCapabilities) && sessionCapabilities.close != null;
  }
  closeAdvertised() {
    return this.closeCapability;
  }
  created(response) {
    this.result.session_id = this.keep(response.sessionId);
    const models = isRecord2(response.models) ? response.models : {};
    if (typeof models.currentModelId === "string") {
      this.result.models.current_model_id = this.keep(models.currentModelId);
    }
    const modes = isRecord2(response.modes) ? response.modes : {};
    this.initialMode = typeof modes.currentModeId === "string" ? modes.currentModeId : void 0;
    this.configOptionsSeen(response.configOptions);
  }
  configOptionsSeen(options) {
    if (!Array.isArray(options)) return;
    this.configOptions = options;
    const model = currentValueOf(options, "model");
    if (model !== void 0) this.result.models.config_model = this.keep(model);
    const watch = this.modeWatch;
    const optionId = watch?.step.confirm.configOptionId;
    if (watch && optionId) {
      const value = currentValueOf(options, optionId);
      if (value === watch.step.modeId) watch.echoed ??= "config_option_update";
    }
    const step = watch?.step ?? this.held?.step;
    if (!step) return;
    for (const value of modeOptionValues(options, step)) {
      if (value === step.modeId) continue;
      if (watch) watch.contrary = true;
      else this.drifted(value);
    }
  }
  holdMode(step) {
    this.held = { step };
  }
  modeDrift() {
    return this.held?.drift;
  }
  drifted(mode) {
    const held = this.held;
    if (!held || held.drift !== void 0) return;
    held.drift = this.keep(mode);
    this.result.mode_drift = held.drift;
    this.onModeDrift();
  }
  optionValues(configId) {
    if (!Array.isArray(this.configOptions)) return void 0;
    const option = this.configOptions.find(
      (entry) => isRecord2(entry) && entry.id === configId
    );
    if (!isRecord2(option)) return void 0;
    return flattenOptionValues(option.options);
  }
  watchMode(step) {
    this.modeWatch = { step, initial: this.initialMode, contrary: false };
  }
  modeEvidence() {
    const watch = this.modeWatch;
    this.modeWatch = void 0;
    if (!watch || watch.contrary) return void 0;
    if (watch.echoed) return watch.echoed;
    if (watch.step.confirm.initialState && watch.initial === watch.step.modeId) {
      return "initial_state";
    }
    return void 0;
  }
  promptStarted() {
    this.promptActive = true;
  }
  promptAnswered(response) {
    this.promptActive = false;
    if (!isRecord2(response)) return;
    if (typeof response.stopReason === "string") {
      this.result.stop_reason = this.keep(response.stopReason);
    }
    const usage = numericFields(response.usage);
    if (usage) this.result.usage = usage;
    const meta = isRecord2(response._meta) ? response._meta : {};
    const quota = isRecord2(meta.quota) ? meta.quota : {};
    if (Array.isArray(quota.model_usage)) {
      const models = quota.model_usage.map((entry) => isRecord2(entry) ? entry.model : void 0).filter((model) => typeof model === "string").map((model) => this.keep(model));
      if (models.length > 0)
        this.result.models.usage_models = [...new Set(models)];
    }
  }
  notification(method, params) {
    if (method !== "session/update" || !isRecord2(params)) return;
    if (this.result.session_id === void 0 || params.sessionId !== this.result.session_id) {
      return;
    }
    const update = isRecord2(params.update) ? params.update : {};
    const kind = update.sessionUpdate;
    const watch = this.modeWatch;
    if (kind === "current_mode_update") {
      if (this.held && typeof update.currentModeId === "string" && update.currentModeId !== this.held.step.modeId) {
        this.drifted(update.currentModeId);
      }
      if (watch && typeof update.currentModeId === "string") {
        if (update.currentModeId !== watch.step.modeId) watch.contrary = true;
        else if (watch.step.confirm.currentModeUpdate) {
          watch.echoed ??= "current_mode_update";
        }
      }
      return;
    }
    if (kind === "config_option_update") {
      this.configOptionsSeen(update.configOptions);
      return;
    }
    if (kind !== "agent_message_chunk") return;
    const content = isRecord2(update.content) ? update.content : {};
    if (content.type !== "text" || typeof content.text !== "string") return;
    if (this.promptActive) {
      this.result.text += content.text;
      return;
    }
    const marker = watch?.step.confirm.marker;
    if (watch && marker !== void 0 && content.text === marker) {
      watch.echoed ??= "marker";
    }
  }
};
var MAX_DISPLAY_PATH_CHARS = 240;
function displayPath(reported, cwd, redact) {
  let shown = reported;
  if (path3.isAbsolute(reported)) {
    const realCwd = realpathOrSelf(path3.resolve(cwd));
    const relative = path3.relative(realCwd, realExistingPath(reported));
    if (!relative.startsWith("..") && !path3.isAbsolute(relative)) {
      shown = relative === "" ? "." : relative;
    }
  }
  return clip(redact(shown), MAX_DISPLAY_PATH_CHARS);
}
function realpathOrSelf(file) {
  try {
    return realpathSync2(file);
  } catch {
    return file;
  }
}
function killGroupNow(pid) {
  if (pid === void 0) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
  } catch {
  }
}
function modeOptionValues(options, step) {
  return options.filter(
    (option) => isRecord2(option) && (option.id === step.confirm.configOptionId || option.id === "mode" || option.category === "mode")
  ).map((option) => option.currentValue).filter((value) => typeof value === "string");
}
function currentValueOf(options, id) {
  if (!Array.isArray(options)) return void 0;
  const option = options.find((entry) => isRecord2(entry) && entry.id === id);
  return isRecord2(option) && typeof option.currentValue === "string" ? option.currentValue : void 0;
}
function flattenOptionValues(options) {
  if (!Array.isArray(options)) return [];
  const values = [];
  for (const entry of options) {
    if (!isRecord2(entry)) continue;
    if (typeof entry.value === "string") values.push(entry.value);
    else if (Array.isArray(entry.options)) {
      values.push(...flattenOptionValues(entry.options));
    }
  }
  return values;
}
function numericFields(value) {
  if (!isRecord2(value)) return void 0;
  const fields = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === "number" && Number.isFinite(field))
      fields[key] = field;
  }
  return Object.keys(fields).length > 0 ? fields : void 0;
}
function clip(value, max = MAX_META_CHARS) {
  return value.length > max ? `${value.slice(0, max)}\u2026` : value;
}

// src/plugins/consensus/provider-cli/acp/adapter.ts
var ACP_READ_ONLY_BRIEF_LINE = "This is a read-only run. Use only read and search tools. Do not edit files or run shell commands; such requests are denied and end the turn.";
var ACP_CLIENT_INFO = { name: "consensus", version: "0" };
function acpAdapter(descriptor, options = {}) {
  const transport = options.transport ?? stdioAcpTransport;
  const classifyOptions = {
    displayName: descriptor.display_name,
    authHint: descriptor.auth_hint,
    ...descriptor.auth_error_patterns ? { authErrorPatterns: descriptor.auth_error_patterns } : {},
    ...descriptor.error_text_patterns ? { errorTextPatterns: descriptor.error_text_patterns } : {}
  };
  const classify = (stdout) => {
    const result = parseAcpTurnResult(stdout);
    return result ? classifyAcpTurn(result, classifyOptions) : void 0;
  };
  return {
    id: descriptor.id,
    tier: "extended",
    display_name: descriptor.display_name,
    executable: descriptor.executable,
    executable_env: descriptor.executable_env,
    credential_env: descriptor.credential_env,
    install_hint: descriptor.install_hint,
    ...descriptor.redactions ? { redaction_patterns: descriptor.redactions } : {},
    ...descriptor.not_admitted_reason ? { not_admitted_reason: descriptor.not_admitted_reason } : {},
    probe: {
      version_args: ["--version"],
      minimum_version: descriptor.minimum_version,
      // Establishing the run capability needs an ACP handshake, which
      // preflight never performs (Droid mints a pairing code on
      // session/new), so the version output stands in for it.
      capabilities: {
        run: { args: ["--version"], required_output_patterns: [] }
      }
    },
    buildInvocation: (request, invocationOptions) => buildAcpInvocation(descriptor, request, invocationOptions),
    run: (invocation2, runOptions) => runAcpInvocation(descriptor, invocation2, runOptions, {
      transport,
      classifyOptions,
      ...options
    }),
    classifyRunFailure: (failure3) => failureClassification(classify(failure3.stdout)) ?? {
      code: failure3.code,
      message: failure3.message,
      retryable: false,
      terminal_reason: "acp_unreadable_result",
      exit_classification: "terminal"
    },
    classifyReportedFailure: (stdout) => failureClassification(classify(stdout)),
    extractText: (_invocation, result) => extractAcpText(result.stdout),
    // Never the serialized turn result: only its (redacted) answer text.
    envelopeStdout: (stdout) => parseAcpTurnResult(stdout)?.text ?? "",
    extractSession: (stdout) => extractAcpSession(stdout, descriptor),
    extractPermissionDenials: extractAcpPermissionDenials,
    submitCaptureEligible: () => false,
    capabilities: {
      schema_strategies: ["text"],
      output_modes: ["acp_session"],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          permission_modes: ["read-only"],
          env_allowlist: false
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false
    }
  };
}
function buildAcpInvocation(descriptor, request, options = {}) {
  const executable = options.executable ?? descriptor.executable;
  const model = request.model;
  const argv = [
    ...descriptor.launch_args,
    ...model && descriptor.model.kind === "launch_flag" ? [descriptor.model.flag, model] : []
  ];
  const plan = {
    clientInfo: { ...ACP_CLIENT_INFO },
    mode: descriptor.mode,
    ...model && descriptor.model.kind === "config_option" ? {
      configOptions: [
        {
          configId: descriptor.model.config_id,
          value: model,
          requireAdvertised: true
        }
      ]
    } : {},
    ...model && descriptor.model.kind === "launch_flag" ? { expectCurrentModel: model } : {},
    briefLines: [ACP_READ_ONLY_BRIEF_LINE, ...descriptor.brief_lines ?? []],
    ...descriptor.redactions ? { redactions: descriptor.redactions } : {},
    credentialEnv: descriptor.credential_env
  };
  return {
    executable,
    argv,
    stdin: request.prompt,
    ...request.cwd ? { cwd: request.cwd } : {},
    output_mode: "acp_session",
    strategy: "text",
    redacted_command: [executable, ...argv],
    acp_plan: plan,
    shell: false
  };
}
async function runAcpInvocation(descriptor, invocation2, options, context) {
  const basePlan = invocation2.acp_plan;
  if (!basePlan) {
    throw new Error(`${descriptor.id} invocation has no ACP session plan.`);
  }
  const env = options.env ?? {};
  const apiKey = descriptor.api_key;
  const useApiKey = apiKey !== void 0 && (env[apiKey.env] ?? "") !== "";
  const plan = useApiKey ? { ...basePlan, authenticate: { methodId: apiKey.method_id } } : basePlan;
  const argv = [...invocation2.argv];
  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  let privateHome;
  let outcome;
  try {
    const home = useApiKey ? apiKey.private_home : void 0;
    if (home) {
      privateHome = await mkdtemp(
        path4.join(context.tmpDir ?? os.tmpdir(), `consensus-${descriptor.id}-`)
      );
      const settings = `${JSON.stringify(home.settings)}
`;
      for (const file of home.settings_files) {
        const target = path4.join(privateHome, file);
        await mkdir2(path4.dirname(target), { recursive: true, mode: 448 });
        await writeFile2(target, settings, { mode: 384 });
      }
      argv.push(
        `${home.dir_flag}=${privateHome}`,
        `${home.app_data_flag}=${home.app_data_name}`
      );
    }
    outcome = await context.transport.run({
      executable: invocation2.executable,
      argv,
      cwd: invocation2.cwd ?? process.cwd(),
      env,
      prompt: invocation2.stdin,
      plan,
      timeoutMs: timeoutSec * 1e3,
      ...options.maxOutputBytes !== void 0 ? { maxOutputBytes: options.maxOutputBytes } : {},
      ...context.timing ? { timing: context.timing } : {},
      ...context.spawn ? { spawn: context.spawn } : {}
    });
  } finally {
    if (privateHome) await rm3(privateHome, { recursive: true, force: true });
  }
  const result = outcome.result;
  const classification = classifyAcpTurn(result, context.classifyOptions);
  const stdout = serializeAcpTurnResult(result);
  const diagnostics = processDiagnostics(outcome, {
    auth: useApiKey ? "api_key" : "existing_login",
    timeoutSec
  });
  const base = {
    stdout,
    stderr: outcome.stderr,
    exit_code: outcome.exit_code,
    signal: outcome.signal,
    diagnostics
  };
  if (classification.ok) return { ok: true, ...base };
  return {
    ok: false,
    code: processFailureCode(result),
    message: classification.message,
    retryable: false,
    ...base
  };
}
function processFailureCode(result) {
  if (result.abort === "timeout") return "PROVIDER_TIMEOUT";
  if (result.abort === "output_cap") return "PROVIDER_OUTPUT_CAP_EXCEEDED";
  if (result.error?.kind === "spawn") {
    return result.error.errno === "E2BIG" ? "PROVIDER_ARGV_TOO_LARGE" : "PROVIDER_MISSING";
  }
  return "PROVIDER_EXIT";
}
function processDiagnostics(outcome, input) {
  const result = outcome.result;
  const teardown = outcome.teardown;
  const acp = {
    ...result.agent ? { agent: result.agent } : {},
    auth: input.auth,
    phase: result.phase,
    ...result.stop_reason ? { stop_reason: result.stop_reason } : {},
    setup: result.setup.map((step) => ({ ...step })),
    ...result.refused_methods.length > 0 ? { refused_methods: [...result.refused_methods] } : {},
    ...result.cancel_sent ? { cancel_sent: true } : {},
    ...result.session_closed !== void 0 ? { session_closed: result.session_closed } : {},
    ...teardown ? {
      teardown: {
        scope: teardown.scope,
        exited_before_signal: teardown.exited_before_signal,
        signals: [...teardown.signals],
        settled_by: teardown.settled_by
      }
    } : {}
  };
  const termination = result.abort && result.abort !== "mode_changed" && teardown ? terminationFor(result.abort, teardown) : void 0;
  return {
    provider_exit_code: outcome.exit_code,
    provider_signal: outcome.signal,
    output_bytes: { ...outcome.output_bytes },
    timeout_sec: input.timeoutSec,
    ...termination ? { termination } : {},
    acp
  };
}
function terminationFor(reason, teardown) {
  const settled = teardown.settled_by;
  return {
    reason,
    scope: teardown.scope,
    signals: [...teardown.signals],
    settled_by: settled === "first_signal" ? teardown.signals[0] === "SIGTERM" ? "sigterm" : "forwarded_signal" : settled
  };
}
function failureClassification(classification) {
  if (!classification || classification.ok) return void 0;
  return {
    code: classification.code,
    message: classification.message,
    retryable: false,
    terminal_reason: classification.terminal_reason,
    exit_classification: "terminal",
    turn: classification.turn
  };
}
function extractAcpText(stdout) {
  const result = parseAcpTurnResult(stdout);
  if (!result) {
    return {
      ok: false,
      code: "PROVIDER_MALFORMED_RESULT",
      message: "The ACP adapter returned no readable turn result.",
      terminal_reason: "malformed_result"
    };
  }
  if (result.text.trim() === "") {
    return {
      ok: false,
      code: "PROVIDER_EMPTY_OUTPUT",
      message: "The ACP agent ended the turn without answer text.",
      terminal_reason: "empty_output"
    };
  }
  return { ok: true, raw: result.text, text: result.text };
}
function extractAcpSession(stdout, descriptor) {
  const result = parseAcpTurnResult(stdout);
  if (!result) return {};
  const models = firstModels(result, descriptor.model_sources);
  return {
    ...result.session_id ? { session_id: result.session_id } : {},
    ...models.length > 0 ? { observed_models: models } : {}
  };
}
function firstModels(result, sources) {
  for (const source of sources) {
    const value = result.models[source];
    const models = Array.isArray(value) ? value : value ? [value] : [];
    if (models.length > 0) return models;
  }
  return [];
}
function extractAcpPermissionDenials(stdout) {
  const result = parseAcpTurnResult(stdout);
  if (!result || result.denials.length === 0) return void 0;
  return {
    count: result.denials.length,
    tools: [
      ...new Set(
        result.denials.map((denial) => denial.tool ?? denial.kind ?? "tool")
      )
    ],
    requests: result.denials.map((denial) => ({
      ...denial.tool !== void 0 ? { tool: denial.tool } : {},
      ...denial.kind !== void 0 ? { kind: denial.kind } : {},
      ...denial.path !== void 0 ? { path: denial.path } : {}
    }))
  };
}

// src/plugins/consensus/provider-cli/invocation.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { tmpdir } from "node:os";
import path6 from "node:path";

// src/plugins/consensus/provider-cli/runtime-policy.ts
import { realpathSync as realpathSync3, statSync } from "node:fs";
import path5 from "node:path";
var DEFAULT_RUNTIME_POLICY = {
  permission_mode: "non-interactive"
};
var BASE_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG"
];
function validateProviderOptions(request, adapter) {
  const { capabilities } = adapter;
  if (request.model && !capabilities.options.model) {
    return unsupported("model", "Provider does not support model selection.");
  }
  if (request.effort && capabilities.options.effort === null) {
    return unsupported("effort", "Provider does not support effort selection.");
  }
  const policy = defaultRuntimePolicy(request.runtime_policy);
  const runtimeCapabilities = capabilities.options.runtime_policy;
  const permissionResult = validateOptionValue(
    "runtime_policy.permission_mode",
    policy.permission_mode,
    runtimeCapabilities.permission_modes
  );
  if (permissionResult) return permissionResult;
  const sandboxResult = validateOptionValue(
    "runtime_policy.sandbox",
    policy.sandbox,
    runtimeCapabilities.sandboxes
  );
  if (sandboxResult) return sandboxResult;
  const approvalResult = validateOptionValue(
    "runtime_policy.approval_policy",
    policy.approval_policy,
    runtimeCapabilities.approval_policies
  );
  if (approvalResult) return approvalResult;
  if (policy.env_allowlist && policy.env_allowlist.length > 0 && !runtimeCapabilities.env_allowlist) {
    return unsupported(
      "runtime_policy.env_allowlist",
      "Provider does not support child environment allowlist extension."
    );
  }
  const hasScopedTools = hasScopedToolAccess(policy);
  if (hasScopedTools && request.provider !== "claude") {
    return unsupported(
      "runtime_policy.scoped_tools",
      "Scoped tool grants are supported only by the Claude provider."
    );
  }
  if (request.output === "text" && request.provider === "cursor" && policy.permission_mode !== "read-only") {
    return unsupported(
      "runtime_policy.permission_mode",
      "Cursor text-mode runs require --permission-mode read-only."
    );
  }
  if (request.provider === "claude") {
    const composition = composeClaudePermissionProfile(policy);
    if (!composition.ok) {
      return unsupported(composition.option, composition.message);
    }
  }
  if ((request.max_attempts ?? 1) > 1 && !adapter.isProvenReadOnly?.(policy)) {
    return {
      ok: false,
      code: "CONSENSUS_CLI_USAGE",
      option: "max_attempts",
      message: "More than one attempt is allowed only for a proven read-only profile: Codex with --sandbox read-only, Claude with --permission-mode read-only and no edit or Bash grant, or Cursor with --permission-mode read-only. A retried turn could repeat its side effects."
    };
  }
  for (const pattern of policy.bash_patterns ?? []) {
    if (!isExactBashPattern(pattern)) {
      return unsupported(
        "runtime_policy.bash_patterns",
        "Bash grants require a single-line command pattern without parentheses or commas, naming a command rather than only wildcards."
      );
    }
  }
  for (const [field, paths] of [
    ["read_paths", policy.read_paths],
    ["edit_paths", policy.edit_paths]
  ]) {
    for (const filePath of paths ?? []) {
      if (!path5.isAbsolute(filePath) || path5.normalize(filePath) !== filePath || filePath.split(path5.sep).includes("..") || /[\r\n,*?]/.test(filePath) || filePath.includes("[") || filePath.includes("]")) {
        return unsupported(
          `runtime_policy.${field}`,
          `${field} requires exact absolute paths without parent traversal or glob characters.`
        );
      }
      try {
        const target = statSync(filePath, { throwIfNoEntry: false });
        if (target) {
          if (!target.isFile() || realpathSync3(filePath) !== filePath) {
            return unsupported(
              `runtime_policy.${field}`,
              `${field} requires canonical regular-file targets, not directories or symlinks.`
            );
          }
        } else if (field === "read_paths" || realpathSync3(path5.dirname(filePath)) !== path5.dirname(filePath)) {
          return unsupported(
            `runtime_policy.${field}`,
            `${field} requires an existing canonical file (or an existing canonical parent for a new edit file).`
          );
        }
      } catch {
        return unsupported(
          `runtime_policy.${field}`,
          `${field} requires an existing canonical file (or an existing canonical parent for a new edit file).`
        );
      }
    }
  }
  for (const domain of policy.web_fetch_domains ?? []) {
    if (domain.length > 253 || !/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      domain
    )) {
      return unsupported(
        "runtime_policy.web_fetch_domains",
        "WebFetch grants require exact domain names without schemes, ports, or wildcards."
      );
    }
  }
  return { ok: true };
}
function isClaudeReadOnlyPolicy(policy) {
  return policy.permission_mode === "read-only" && !policy.edit_paths?.length && !policy.bash_patterns?.length;
}
function isCodexReadOnlyPolicy(policy) {
  return policy.sandbox === "read-only";
}
function hasScopedToolAccess(policy = {}) {
  return Boolean(
    policy.read_paths?.length || policy.edit_paths?.length || policy.bash_patterns?.length || policy.web_search || policy.web_fetch_domains?.length
  );
}
function composeClaudePermissionProfile(policy) {
  const mode = policy.permission_mode ?? DEFAULT_RUNTIME_POLICY.permission_mode;
  const readPaths = policy.read_paths ?? [];
  const editPaths = policy.edit_paths ?? [];
  const bashPatterns = policy.bash_patterns ?? [];
  const webFetchDomains = policy.web_fetch_domains ?? [];
  const webSearch = Boolean(policy.web_search);
  const readRules = readPaths.map((filePath) => `Read(/${filePath})`);
  if (mode === "read-only") {
    if (editPaths.length > 0 || bashPatterns.length > 0 || webSearch || webFetchDomains.length > 0) {
      return compositionFailure(
        "Claude read-only accepts only --allow-read grants; use non-interactive for edit or web grants and workspace-write for Bash grants."
      );
    }
    if (readPaths.length === 0) {
      return { ok: true, mode: "plan", allowed_tools: [], restricted: false };
    }
    return {
      ok: true,
      mode: "dontAsk",
      tools: ["Read", "Glob", "Grep"],
      allowed_tools: readRules,
      restricted: true
    };
  }
  if (mode === "non-interactive") {
    if (bashPatterns.length > 0) {
      return compositionFailure(
        "Claude Bash grants require --permission-mode workspace-write."
      );
    }
    const allowedTools = [
      ...readRules,
      ...editPaths.map((filePath) => `Edit(/${filePath})`),
      ...webSearch ? ["WebSearch"] : [],
      ...webFetchDomains.map((domain) => `WebFetch(domain:${domain})`)
    ];
    if (allowedTools.length === 0) {
      return { ok: true, allowed_tools: [], restricted: false };
    }
    return {
      ok: true,
      mode: "dontAsk",
      tools: [
        ...readPaths.length > 0 ? ["Read"] : [],
        ...editPaths.length > 0 ? ["Edit", "Write"] : [],
        ...webSearch ? ["WebSearch"] : [],
        ...webFetchDomains.length > 0 ? ["WebFetch"] : []
      ],
      allowed_tools: allowedTools,
      restricted: true
    };
  }
  if (mode === "workspace-write") {
    if (readPaths.length > 0 || editPaths.length > 0 || webSearch || webFetchDomains.length > 0) {
      return compositionFailure(
        "Claude workspace-write accepts only --allow-bash grants; its file tools already cover the working directory."
      );
    }
    return {
      ok: true,
      mode: "acceptEdits",
      tools: [
        "Read",
        "Glob",
        "Grep",
        "Edit",
        "Write",
        ...bashPatterns.length > 0 ? ["Bash"] : []
      ],
      allowed_tools: bashPatterns.map((pattern) => `Bash(${pattern})`),
      restricted: true
    };
  }
  return compositionFailure(`Unsupported Claude permission mode: ${mode}.`);
}
function compositionFailure(message) {
  return { ok: false, option: "runtime_policy.permission_mode", message };
}
function isExactBashPattern(pattern) {
  return pattern.length > 0 && pattern.length <= 256 && pattern.trim() === pattern && !/[(),]/.test(pattern) && ![...pattern].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  }) && /[^\s*:]/.test(pattern);
}
function defaultRuntimePolicy(policy = {}) {
  return {
    permission_mode: policy.permission_mode ?? DEFAULT_RUNTIME_POLICY.permission_mode,
    ...policy.sandbox ? { sandbox: policy.sandbox } : {},
    ...policy.approval_policy ? { approval_policy: policy.approval_policy } : {},
    ...policy.env_allowlist ? { env_allowlist: policy.env_allowlist } : {},
    ...policy.read_paths ? { read_paths: policy.read_paths } : {},
    ...policy.edit_paths ? { edit_paths: policy.edit_paths } : {},
    ...policy.bash_patterns ? { bash_patterns: policy.bash_patterns } : {},
    ...policy.web_search ? { web_search: true } : {},
    ...policy.web_fetch_domains ? { web_fetch_domains: policy.web_fetch_domains } : {}
  };
}
function buildChildEnvironment({
  parentEnv,
  request,
  hostEnv,
  credentialEnv,
  executableOverrideEnv
}) {
  const allowedNames = /* @__PURE__ */ new Set([
    ...BASE_ENV_ALLOWLIST,
    ...credentialEnv,
    ...request.runtime_policy?.env_allowlist ?? []
  ]);
  for (const name of executableOverrideEnv) {
    allowedNames.delete(name);
  }
  const childEnv = {};
  for (const name of allowedNames) {
    const value = parentEnv[name];
    if (value !== void 0) childEnv[name] = value;
  }
  const env = { ...childEnv, ...hostEnv };
  if (request.output === "text") {
    for (const name of Object.keys(env)) {
      if (name.startsWith(RESERVED_SUBMIT_ENV_PREFIX)) delete env[name];
    }
  }
  return env;
}
var RESERVED_SUBMIT_ENV_PREFIX = "CONSENSUS_SUBMIT_";
function buildProviderProbeEnvironment({
  parentEnv,
  credentialEnv
}) {
  const allowedNames = /* @__PURE__ */ new Set([
    ...BASE_ENV_ALLOWLIST,
    ...credentialEnv
  ]);
  const probeEnv = {};
  for (const name of allowedNames) {
    const value = parentEnv[name];
    if (value !== void 0) probeEnv[name] = value;
  }
  return probeEnv;
}
function redactedRuntimePolicyDiagnostics(policy = {}) {
  const effectivePolicy = defaultRuntimePolicy(policy);
  return {
    permission_mode: effectivePolicy.permission_mode,
    ...effectivePolicy.sandbox ? { sandbox: effectivePolicy.sandbox } : {},
    ...effectivePolicy.approval_policy ? { approval_policy: effectivePolicy.approval_policy } : {},
    ...effectivePolicy.env_allowlist ? { env_allowlist: [...effectivePolicy.env_allowlist] } : {}
  };
}
function validateOptionValue(option, value, supportedValues) {
  if (!value) return void 0;
  if (supportedValues?.includes(value)) return void 0;
  return unsupported(
    option,
    supportedValues ? `Unsupported ${option}: ${value}.` : `Provider does not support ${option}.`
  );
}
function unsupported(option, message) {
  return {
    ok: false,
    code: "PROVIDER_UNSUPPORTED_OPTION",
    option,
    message
  };
}

// src/plugins/consensus/provider-cli/invocation.ts
function buildProviderInvocation(adapter, request, options = {}) {
  return adapter.buildInvocation(request, {
    strategy: options.strategy ?? defaultStrategy(adapter),
    inlineJsonSchema: options.inlineJsonSchema,
    lastMessageFile: options.lastMessageFile,
    preserveLastMessageFile: options.preserveLastMessageFile,
    resumeSessionId: options.resumeSessionId,
    executable: options.executable,
    ...options.prerequisiteExecutables ? { prerequisiteExecutables: options.prerequisiteExecutables } : {}
  });
}
var buildClaudeInvocation = (request, options = {}) => {
  const strategy = options.strategy ?? "prompt_only";
  const argv = ["--print", "--output-format", "json"];
  const redactedArgv = ["--print", "--output-format", "json"];
  if (strategy === "provider_validated") {
    if (!options.inlineJsonSchema) {
      throw new Error(
        "Claude provider-validated invocation requires an inline JSON schema."
      );
    }
    argv.push("--json-schema", options.inlineJsonSchema);
    redactedArgv.push("--json-schema", "<inline-json-schema>");
  }
  if (request.model) {
    argv.push("--model", request.model);
    redactedArgv.push("--model", request.model);
  }
  if (request.effort) {
    argv.push("--effort", request.effort);
    redactedArgv.push("--effort", request.effort);
  }
  const permission = composeClaudePermissionProfile(
    request.runtime_policy ?? {}
  );
  if (!permission.ok) {
    throw new Error(permission.message);
  }
  if (permission.allowed_tools.length > 0) {
    argv.push("--allowedTools", ...permission.allowed_tools);
    redactedArgv.push("--allowedTools", "<scoped-tool-rules>");
  }
  if (permission.tools) {
    argv.push("--tools", permission.tools.join(","));
    redactedArgv.push("--tools", permission.tools.join(","));
  }
  if (permission.restricted) {
    argv.push("--permission-prompts", "none");
    redactedArgv.push("--permission-prompts", "none");
  }
  if (permission.mode) {
    argv.push("--permission-mode", permission.mode);
    redactedArgv.push("--permission-mode", permission.mode);
  }
  if (permission.restricted) {
    argv.push("--strict-mcp-config");
    redactedArgv.push("--strict-mcp-config");
  }
  if (options.resumeSessionId) {
    argv.push("--resume", options.resumeSessionId);
    redactedArgv.push("--resume", options.resumeSessionId);
  }
  return {
    ...invocation({
      executable: options.executable ?? "claude",
      argv,
      redactedArgv,
      request,
      strategy,
      outputMode: "stdout_json"
    }),
    permission_profile: {
      mode: permission.mode ?? "provider_default",
      ...permission.tools ? { tools: [...permission.tools] } : {},
      // Grant contents stay out of diagnostics, as they do in redacted_command.
      ...permission.allowed_tools.length > 0 ? {
        allowed_tools: permission.allowed_tools.map(
          (rule) => rule.replace(/^(Read|Edit)\(.*\)$/s, "$1(<path>)").replace(/^Bash\(.*\)$/s, "Bash(<pattern>)")
        )
      } : {}
    }
  };
};
var buildCodexInvocation = (request, options = {}) => {
  const strategy = options.strategy ?? "prompt_only";
  const lastMessageFile = options.lastMessageFile ?? codexLastMessageFile();
  const resumeSessionId = options.resumeSessionId;
  const argv = [
    "exec",
    ...resumeSessionId ? ["resume"] : [],
    "--json",
    "--output-last-message",
    lastMessageFile
  ];
  if (strategy === "constrained_native") {
    if (!request.schema_path) {
      throw new Error("Codex constrained-native invocation requires a schema.");
    }
    argv.push("--output-schema", request.schema_path);
  }
  if (request.model) argv.push("--model", request.model);
  if (request.effort) {
    argv.push(
      "-c",
      codexConfigOverride("model_reasoning_effort", request.effort)
    );
  }
  if (request.runtime_policy?.sandbox) {
    if (resumeSessionId) {
      argv.push(
        "-c",
        codexConfigOverride("sandbox_mode", request.runtime_policy.sandbox)
      );
    } else {
      argv.push("--sandbox", request.runtime_policy.sandbox);
    }
  }
  const approvalPolicy = request.runtime_policy?.approval_policy ?? (request.runtime_policy?.permission_mode === "non-interactive" ? "never" : void 0);
  if (approvalPolicy) {
    argv.push("-c", codexConfigOverride("approval_policy", approvalPolicy));
  }
  if (resumeSessionId) argv.push(resumeSessionId, "-");
  return invocation({
    executable: options.executable ?? "codex",
    argv,
    request,
    strategy,
    outputMode: "last_message_file",
    lastMessageFile,
    cleanupLastMessageFile: !options.preserveLastMessageFile
  });
};
var buildCursorInvocation = (request, options = {}) => {
  if (options.resumeSessionId) {
    throw new Error(
      "Cursor native resume is not verified for this adapter; use a reconstructed continuation."
    );
  }
  const strategy = options.strategy === "submit_tool_candidate" ? "prompt_only" : options.strategy ?? "prompt_only";
  const argv = request.runtime_policy?.permission_mode === "read-only" ? [
    "--print",
    "--output-format",
    "json",
    "--trust",
    "--mode",
    "ask",
    "--sandbox",
    "enabled"
  ] : ["--print", "--output-format", "json", "--force"];
  if (request.model) argv.push("--model", request.model);
  return invocation({
    executable: options.executable ?? "cursor-agent",
    argv,
    request,
    strategy,
    outputMode: "stdout_json"
  });
};
function invocation(input) {
  return {
    executable: input.executable,
    argv: input.argv,
    stdin: input.stdin ?? input.request.prompt,
    ...input.request.cwd ? { cwd: input.request.cwd } : {},
    output_mode: input.outputMode,
    strategy: input.strategy,
    redacted_command: [input.executable, ...input.redactedArgv ?? input.argv],
    ...input.lastMessageFile ? {
      last_message_file: input.lastMessageFile,
      cleanup_last_message_file: input.cleanupLastMessageFile ?? true
    } : {},
    shell: false
  };
}
function codexConfigOverride(key, value) {
  return `${key}=${JSON.stringify(value)}`;
}
function codexLastMessageFile() {
  return path6.join(
    tmpdir(),
    `consensus-codex-last-message-${randomUUID2()}.txt`
  );
}
function defaultStrategy(adapter) {
  return adapter.capabilities.schema_strategies.find(
    (strategy) => strategy !== "submit_tool_candidate"
  ) ?? "prompt_only";
}

// src/plugins/consensus/provider-cli/schema-validate.ts
function validateSchemaSubset(value, schema) {
  if (!isRecord3(schema)) return { ok: true };
  if (schema.type === "object" && !isRecord3(value)) {
    return { ok: false, message: "Expected provider JSON to be an object." };
  }
  if (Array.isArray(schema.required)) {
    if (!isRecord3(value)) {
      return {
        ok: false,
        message: "Expected provider JSON to be an object with required fields."
      };
    }
    for (const field of schema.required) {
      if (typeof field === "string" && !(field in value)) {
        return {
          ok: false,
          message: `Missing required JSON field: ${field}`
        };
      }
    }
  }
  if (isRecord3(schema.properties) && isRecord3(value)) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      if (!(field in value) || !isRecord3(fieldSchema)) continue;
      const type = fieldSchema.type;
      if (typeof type === "string" && !matchesJsonType(value[field], type)) {
        return {
          ok: false,
          message: `Field ${field} must be ${type}.`
        };
      }
    }
  }
  return { ok: true };
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function matchesJsonType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isRecord3(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

// src/plugins/consensus/provider-cli/provider-output.ts
function extractProviderResultText(invocation2, result, options = {}) {
  const empty = (message) => ({
    ok: false,
    code: "PROVIDER_EMPTY_OUTPUT",
    message,
    terminal_reason: "empty_output"
  });
  const malformed = (message) => ({
    ok: false,
    code: "PROVIDER_MALFORMED_RESULT",
    message,
    terminal_reason: "malformed_result"
  });
  if (invocation2.output_mode === "last_message_file") {
    const lastMessage = result.last_message;
    if (lastMessage === void 0) {
      return empty("Provider did not write a last-message file response.");
    }
    if (!lastMessage.trim()) {
      return empty("Provider wrote a blank last-message file response.");
    }
    return { ok: true, raw: lastMessage, text: lastMessage };
  }
  if (!result.stdout.trim()) {
    return empty("Provider produced no output.");
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    return malformed("Provider output is not a JSON result object.");
  }
  if (!isRecord3(parsed)) {
    return malformed("Provider output is not a JSON result object.");
  }
  if (parsed.is_error === true) {
    return malformed("Provider reported an error result.");
  }
  const subtype = parsed.subtype;
  if (options.requireSuccessSubtype && subtype !== "success" || subtype !== void 0 && subtype !== "success") {
    return malformed(
      `Provider result subtype is ${typeof subtype === "string" ? subtype : "missing"}, not success.`
    );
  }
  if (typeof parsed.result !== "string") {
    return malformed("Provider result object has no text result.");
  }
  if (!parsed.result.trim()) {
    return empty("Provider returned a blank text result.");
  }
  return { ok: true, raw: result.stdout, text: parsed.result };
}
function extractStructuredJsonValue(value) {
  if (!isRecord3(value)) return value;
  if ("structured_output" in value) {
    return value.structured_output;
  }
  const result = value.result;
  if (typeof result !== "string") return value;
  try {
    return JSON.parse(result.trim());
  } catch {
    return extractFirstJsonObject(result) ?? value;
  }
}
function extractFirstJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start === -1) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char !== "}") continue;
    depth -= 1;
    if (depth !== 0) continue;
    const candidate = text.slice(start, index + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      start = -1;
      depth = 0;
    }
  }
  return void 0;
}

// src/plugins/consensus/provider-cli/adapters.ts
var COMMON_AUTH_REQUIRED_PATTERNS = [
  /auth(?:entication)? required/i,
  /not logged in/i,
  /login required/i,
  /keychain.*locked/i
];
var COMMON_UNAVAILABLE_PATTERNS = [
  /unsupported platform/i,
  /not configured/i
];
var COMMON_UNSUPPORTED_OPTION_PATTERNS = [
  /unknown (?:option|flag|argument)/i,
  /unrecognized (?:option|flag|argument)/i,
  /unsupported (?:option|flag|argument)/i,
  /invalid (?:option|flag|argument)/i
];
var CLAUDE_SESSION_NOT_FOUND_PATTERNS = [
  // Evidence: Claude Code 2.1.284 `--print --resume <unknown-uuid>` exits 1
  // with this message (live check, 2026-09-28).
  /No conversation found with session ID/i
];
var CODEX_SESSION_NOT_FOUND_PATTERNS = [
  // Evidence: codex-cli 0.157.1 `exec resume <unknown-uuid> -` exits 1 with
  // "thread/resume failed: no rollout found for thread id" (live check,
  // 2026-09-28).
  /no rollout found for thread id/i
];
var COMMON_TRANSIENT_EXIT_PATTERNS = [
  /temporar(?:y|ily) unavailable/i,
  /try again/i,
  /econnreset/i,
  /etimedout/i
];
var CLAUDE_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: Claude Code error reference documents this exact repeated 529
  // overload message as temporary capacity exhaustion:
  // https://code.claude.com/docs/en/errors
  /API Error: Repeated 529 Overloaded errors/i
];
var CODEX_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: installed codex-cli 0.142.5 binary strings include these
  // rate-limit and overload messages in provider-facing error paths.
  /failed to fetch codex rate limits/i,
  /unknown rate limit reached type/i,
  /dropping overload response for connection/i,
  /try again at/i
];
var CURSOR_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: installed cursor-agent 2026.07.01 bundle contains these
  // connection/session terminal reasons and network errors.
  /connection_timeout/i,
  /stream_error/i,
  /session_error/i,
  /session_aborted/i,
  /network error/i
];
var DEFAULT_PROVIDER_ADAPTERS = [
  {
    id: "claude",
    tier: "core",
    classifyReportedFailure: classifyClaudeLimit,
    display_name: "Claude",
    executable: "claude",
    executable_env: "CONSENSUS_CLAUDE_EXECUTABLE",
    credential_env: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"],
    buildInvocation: buildClaudeInvocation,
    extractSession: extractJsonResultSession,
    // Claude always reports a subtype; anything but `success` is a failure.
    extractText: (invocation2, result) => extractProviderResultText(invocation2, result, {
      requireSuccessSubtype: true
    }),
    // Scoped and workspace-write profiles allow no Bash beyond explicit
    // grants, so they cannot run the submit command.
    submitCaptureEligible: (request) => !(hasScopedToolAccess(request.runtime_policy) || request.runtime_policy?.permission_mode === "workspace-write"),
    extractPermissionDenials: extractClaudePermissionDenials,
    isProvenReadOnly: isClaudeReadOnlyPolicy,
    classifyRunFailure: defaultRunFailureClassifier({
      session_not_found_patterns: CLAUDE_SESSION_NOT_FOUND_PATTERNS,
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CLAUDE_TRANSIENT_EXIT_PATTERNS
      ]
    }),
    probe: {
      version_args: ["--version"],
      // Restricted profiles use --permission-prompts, introduced in 2.1.259:
      // https://code.claude.com/docs/en/cli-reference#cli-flags
      minimum_version: "2.1.259",
      capabilities: {
        run: {
          args: ["--help"],
          required_output_patterns: [/--print\b/, /--output-format\b/]
        }
      },
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS
    },
    capabilities: {
      schema_strategies: ["provider_validated", "prompt_only", "text"],
      output_modes: ["stdout_json"],
      options: {
        model: true,
        effort: "effort",
        runtime_policy: {
          permission_modes: ["non-interactive", "read-only", "workspace-write"],
          env_allowlist: true
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
      continuation: {
        native_resume: "verified",
        session_id_source: "stdout_json.session_id",
        evidence: "Live same-session smoke 2026-09-28 with Claude Code 2.1.284: `--print --output-format json --json-schema --resume <uuid>` recalled an unseen marker, preserved session_id, model, and schema. `--resume` also accepts a session title, so the wrapper requires a UUID. Write-mode resume, raw CLI 2026-11-11 with Claude Code 2.1.322 in a linked worktree: `--resume <uuid>` with the full workspace-write flag set kept the session_id, the acceptEdits mode, the explicit tool set (WebFetch absent), and the Bash allowlist; a write outside the worktree and an ungranted `python3` were still denied and a granted `git status` ran."
      }
      // Workspace-write composition, raw CLI 2026-11-11 with Claude Code
      // 2.1.322 in a linked worktree (`--permission-mode acceptEdits --tools
      // Read,Glob,Grep,Edit,Write,Bash --allowedTools 'Bash(git status:*)'
      // --permission-prompts none --strict-mcp-config`): Write-tool and Bash
      // redirection writes outside the worktree and an ungranted `python3 -c`
      // write were denied (listed in permission_denials); the granted
      // `git status` ran. acceptEdits still auto-approves simple filesystem
      // commands such as `touch` inside the working directory, and the user's
      // own allow rules (for example `Bash(node:*)`) still apply.
      // Prompt on stdin, same date and version: `--print --output-format json
      // --permission-mode plan --json-schema` with the prompt on stdin
      // returned a `success` result with the expected structured_output.
    }
  },
  {
    id: "codex",
    tier: "core",
    classifyReportedFailure: classifyCodexLimit,
    display_name: "Codex",
    executable: "codex",
    executable_env: "CONSENSUS_CODEX_EXECUTABLE",
    credential_env: ["OPENAI_API_KEY"],
    buildInvocation: buildCodexInvocation,
    extractSession: extractCodexJsonlSession,
    isProvenReadOnly: isCodexReadOnlyPolicy,
    classifyRunFailure: defaultRunFailureClassifier({
      session_not_found_patterns: CODEX_SESSION_NOT_FOUND_PATTERNS,
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CODEX_TRANSIENT_EXIT_PATTERNS
      ]
    }),
    probe: {
      version_args: ["--version"],
      // Release verification established the provider-validated run surface at
      // Codex CLI 0.139.0 (RELEASING.md).
      minimum_version: "0.139.0",
      capabilities: {
        run: {
          args: ["exec", "--help"],
          required_output_patterns: [
            /--json\b/,
            /--output-last-message\b/,
            /--output-schema\b/
          ]
        }
      },
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS
    },
    capabilities: {
      schema_strategies: ["constrained_native", "prompt_only", "text"],
      output_modes: ["last_message_file"],
      options: {
        model: true,
        effort: "reasoning_effort",
        runtime_policy: {
          permission_modes: ["non-interactive"],
          sandboxes: ["read-only", "workspace-write"],
          approval_policies: ["never", "on-request"],
          env_allowlist: true
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
      continuation: {
        native_resume: "verified",
        session_id_source: "jsonl.thread.started.thread_id",
        evidence: 'Live same-session smoke 2026-09-28 with codex-cli 0.157.1: `exec resume --json --output-schema -c sandbox_mode=... <uuid> -` recalled an unseen marker with read-only sandbox and approval never. `exec resume` rejects `--sandbox`, and a non-UUID that matches no thread name silently starts a new thread, so the wrapper requires a UUID and verifies the returned thread_id. Write-mode resume, raw CLI 2026-11-11 with codex-cli 0.166.0 in a linked worktree: `exec resume <uuid> -c sandbox_mode="workspace-write" -c approval_policy="never"` returned the same thread_id, edited inside the worktree, and was denied writing outside it and to $HOME, although the ambient config set sandbox_mode="danger-full-access"; the override, not ambient config, applies.'
      }
      // Workspace-write in a linked worktree, raw CLI 2026-11-11 with
      // codex-cli 0.166.0 (`exec --sandbox workspace-write -c
      // approval_policy="never"`): edits inside the worktree worked and writes
      // outside it were denied ("operation not permitted"). `git add` and
      // `git commit` failed, because the linked worktree's index lock lives
      // under the main checkout's `.git/worktrees/<name>/`, outside the
      // writable root. The adapter never widens the sandbox for this: the
      // peer leaves changes unstaged and the host commits. Network access is
      // whatever the sandbox configuration says; the invocation does not
      // override it.
    }
  },
  {
    id: "cursor",
    tier: "core",
    display_name: "Cursor",
    executable: "cursor-agent",
    executable_env: "CONSENSUS_CURSOR_EXECUTABLE",
    credential_env: ["CURSOR_API_KEY"],
    buildInvocation: buildCursorInvocation,
    extractSession: extractJsonResultSession,
    // Read-only Cursor runs in ask mode, which cannot run the submit command.
    submitCaptureEligible: (request) => request.runtime_policy?.permission_mode !== "read-only",
    isProvenReadOnly: (policy) => policy.permission_mode === "read-only",
    classifyRunFailure: defaultRunFailureClassifier({
      session_not_found_patterns: [],
      auth_required_patterns: [
        ...COMMON_AUTH_REQUIRED_PATTERNS,
        /credential.*locked/i
      ],
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CURSOR_TRANSIENT_EXIT_PATTERNS
      ]
    }),
    probe: {
      version_args: ["--version"],
      // Release verification established the prompt-only run surface at the
      // 2026.06.19 Cursor agent build (RELEASING.md).
      minimum_version: "2026.6.19",
      capabilities: {
        run: {
          args: ["--help"],
          required_output_patterns: [/--output-format\b/, /--force\b/]
        }
      },
      auth_required_patterns: [
        ...COMMON_AUTH_REQUIRED_PATTERNS,
        /credential.*locked/i
      ],
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS
    },
    capabilities: {
      schema_strategies: ["prompt_only", "submit_tool_candidate", "text"],
      output_modes: ["stdout_json"],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          permission_modes: ["non-interactive", "read-only"],
          env_allowlist: true
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
      continuation: {
        native_resume: "unverified",
        session_id_source: "stdout_json.session_id",
        evidence: "Cursor documents `--resume [chatId]` and a JSON result `session_id`. Raw CLI resume passed a same-session marker smoke on 2026-09-29 (cursor-agent 2026.09.28, cursor-grok-4.6-high, `--print --mode ask --sandbox enabled`, run by the user because agent shells cannot read the Cursor login). During that smoke a transport reconnect replayed each resumed turn, so its result held two answers. The wrapper resume path is not implemented; a future one should require the read-only policy (`--trust --mode ask --sandbox enabled`), not the default `--force`."
      }
    }
  },
  // Extended providers, used only when named: one ACP adapter each.
  ...ACP_PROVIDER_DESCRIPTORS.map((descriptor) => acpAdapter(descriptor))
];
function providerRegistry(adapters = DEFAULT_PROVIDER_ADAPTERS) {
  const byId = /* @__PURE__ */ new Map();
  for (const adapter of adapters) byId.set(adapter.id, adapter);
  return {
    list() {
      return [...adapters];
    },
    get(id) {
      return byId.get(id);
    }
  };
}
function providerExecutableEnvNames(registry) {
  return registry.list().flatMap((adapter) => [
    adapter.executable_env,
    ...(adapter.probe.prerequisites ?? []).map(
      (prerequisite) => prerequisite.executable_env
    )
  ]);
}
function defaultRunFailureClassifier(patterns) {
  return (failure3) => {
    if (failure3.diagnostics?.termination?.reason === "interrupt") {
      return {
        code: failure3.code,
        message: failure3.message,
        retryable: false,
        terminal_reason: "provider_run_interrupted",
        exit_classification: "terminal"
      };
    }
    if (failure3.code !== "PROVIDER_EXIT") {
      return {
        code: failure3.code,
        message: failure3.message,
        retryable: failure3.retryable,
        terminal_reason: terminalReasonForNonExitFailure(failure3.code),
        exit_classification: "terminal"
      };
    }
    const output = `${failure3.stdout}
${failure3.stderr}
${failure3.message}`;
    const outputLine = firstNonEmptyLine(output);
    if (isReliableExternalInterrupt(failure3)) {
      return {
        code: "PROVIDER_EXIT",
        message: `Provider subprocess was interrupted by signal ${failure3.signal}.`,
        retryable: true,
        terminal_reason: "provider_exit_interrupted",
        exit_classification: "interrupted"
      };
    }
    if (failure3.stdout.trim() === "" && matchesAny(failure3.stderr, patterns.session_not_found_patterns)) {
      return {
        code: "PROVIDER_SESSION_NOT_FOUND",
        message: outputLine ?? "Provider could not find the requested session.",
        retryable: false,
        terminal_reason: "provider_session_not_found",
        exit_classification: "terminal"
      };
    }
    if (matchesAny(output, patterns.auth_required_patterns)) {
      return {
        code: "PROVIDER_AUTH_REQUIRED",
        message: outputLine ?? "Provider authentication is required.",
        retryable: false,
        terminal_reason: "provider_auth_required",
        exit_classification: "terminal"
      };
    }
    if (matchesAny(output, patterns.unsupported_option_patterns)) {
      return {
        code: "PROVIDER_UNSUPPORTED_OPTION",
        message: outputLine ?? "Provider rejected an unsupported option.",
        retryable: false,
        terminal_reason: "provider_unsupported_option",
        exit_classification: "terminal"
      };
    }
    if (matchesAny(output, patterns.unavailable_patterns)) {
      return {
        code: "PROVIDER_EXIT",
        message: outputLine ?? failure3.message,
        retryable: false,
        terminal_reason: "provider_unavailable_exit",
        exit_classification: "terminal"
      };
    }
    if (/\b429\b|\brate limit (?:exceeded|reached)\b|rate limiter has requested a/i.test(
      failure3.stderr
    )) {
      return limitFailure(
        firstNonEmptyLine(failure3.stderr) ?? failure3.message,
        "unknown"
      );
    }
    if (matchesAny(output, patterns.transient_exit_patterns)) {
      return {
        code: "PROVIDER_EXIT",
        message: outputLine ?? failure3.message,
        retryable: true,
        terminal_reason: "provider_exit_transient",
        exit_classification: "transient"
      };
    }
    return {
      code: "PROVIDER_EXIT",
      message: outputLine ?? failure3.message,
      retryable: false,
      terminal_reason: "provider_exit_terminal",
      exit_classification: "unknown"
    };
  };
}
function classifyClaudeLimit(stdout) {
  const result = parseJsonRecord(stdout);
  if (!result || result.type !== "result" || result.is_error !== true)
    return void 0;
  if (result.api_error_status !== 429 && result.api_error !== "usage_limit_reached")
    return void 0;
  const usage = isRecord4(result.usage) ? result.usage : void 0;
  const noWork = result.num_turns === 1 && usage?.input_tokens === 0 && usage.output_tokens === 0 && (usage.cache_read_input_tokens === void 0 || usage.cache_read_input_tokens === 0) && (usage.cache_creation_input_tokens === void 0 || usage.cache_creation_input_tokens === 0) && (!isRecord4(result.modelUsage) || Object.keys(result.modelUsage).length === 0);
  return limitFailure(
    typeof result.result === "string" && result.result.trim() ? result.result : "Provider usage or rate limit reached.",
    noWork ? "not_started" : "unknown"
  );
}
function classifyCodexLimit(stdout) {
  let failure3;
  for (const line of stdout.split(/\r?\n/)) {
    const event = parseJsonRecord(line);
    if (!event) continue;
    if (event.type === "turn.completed" || event.type === "turn.failed")
      failure3 = void 0;
    const message = event.type === "turn.failed" && isRecord4(event.error) ? event.error.message : event.type === "error" ? event.message : void 0;
    if (typeof message !== "string") continue;
    if (/^You've hit your usage limit[. ]/.test(message) || message.startsWith(
      "Quota exceeded. Check your plan and billing details."
    ) || message.startsWith("rate limit exceeded: ")) {
      failure3 = limitFailure(message, "unknown");
    }
  }
  return failure3;
}
function limitFailure(message, turn) {
  return {
    code: "PROVIDER_LIMIT_REACHED",
    message,
    retryable: false,
    terminal_reason: "provider_limit_reached",
    exit_classification: "terminal",
    turn
  };
}
function parseJsonRecord(value) {
  try {
    const parsed = JSON.parse(value);
    return isRecord4(parsed) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function extractClaudePermissionDenials(stdout) {
  const result = parseJsonRecord(stdout);
  if (!result || !Array.isArray(result.permission_denials)) {
    return void 0;
  }
  const denials = result.permission_denials;
  if (denials.length === 0) return void 0;
  const tools = [
    ...new Set(
      denials.filter(isRecord4).map((denial) => denial.tool_name).filter(
        (name) => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name)
      )
    )
  ];
  return { count: denials.length, tools };
}
function extractJsonResultSession(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return {};
  }
  if (!isRecord4(parsed)) return {};
  const observation = {};
  if (typeof parsed.session_id === "string" && parsed.session_id) {
    observation.session_id = parsed.session_id;
  }
  if (isRecord4(parsed.modelUsage)) {
    const models = Object.keys(parsed.modelUsage);
    if (models.length > 0) observation.observed_models = models;
  }
  return observation;
}
function extractCodexJsonlSession(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (isRecord4(event) && event.type === "thread.started" && typeof event.thread_id === "string" && event.thread_id) {
      return { session_id: event.thread_id };
    }
  }
  return {};
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function terminalReasonForNonExitFailure(code) {
  if (code === "PROVIDER_MISSING") return "provider_missing";
  if (code === "PROVIDER_TIMEOUT") return "provider_timeout";
  if (code === "PROVIDER_ARGV_TOO_LARGE") return "provider_argv_too_large";
  return "output_cap_exceeded";
}
function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}
function firstNonEmptyLine(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}

// src/plugins/consensus/provider-cli/host-guard.ts
function detectHostRuntime(env) {
  const declaredParent = knownHostRuntime(env.CONSENSUS_PARENT_HOST);
  if (declaredParent) return declaredParent;
  if (hasClaudeHostMarker(env)) return "claude";
  if (hasCodexHostMarker(env)) return "codex";
  if (hasCursorHostMarker(env)) return "cursor";
  return "unknown";
}
function hostContextFromEnv(env, cwd, maxDepth = 1) {
  return {
    runtime: detectHostRuntime(env),
    cwd,
    run_id: env.CONSENSUS_RUN_ID ?? "local",
    depth: parseNonNegativeInteger(env.CONSENSUS_DEPTH) ?? 0,
    max_depth: maxDepth
  };
}
function buildChildHostEnv(context) {
  return {
    CONSENSUS_RUN_ID: context.run_id,
    CONSENSUS_PARENT_HOST: context.runtime,
    CONSENSUS_DEPTH: String(context.depth + 1)
  };
}
function evaluateHostGuard(input) {
  const { host, provider } = input;
  if (!host || host.runtime === "unknown") {
    return allowed("unknown", "none");
  }
  if (host.runtime !== provider) {
    const crossDepth = host.depth + 1;
    if (crossDepth > host.max_depth) {
      return {
        allowed: false,
        code: "HOST_RECURSION_BLOCKED",
        message: `Blocked cross-provider peer spawn (${host.runtime}\u2192${provider}) at depth ${crossDepth}; max_depth is ${host.max_depth}.`,
        host_relation: "different_host",
        guard: "blocked",
        diagnostics: {
          host_relation: "different_host",
          guard: "blocked",
          warnings: [
            `HOST_RECURSION_BLOCKED: cross-provider ${host.runtime}\u2192${provider} peer would exceed max_depth ${host.max_depth}`
          ]
        }
      };
    }
    return allowed(
      "different_host",
      "subprocess_isolated",
      buildChildHostEnv(host)
    );
  }
  const childDepth = host.depth + 1;
  if (childDepth > host.max_depth) {
    return {
      allowed: false,
      code: "HOST_RECURSION_BLOCKED",
      message: `Blocked recursive ${provider} peer spawn at depth ${childDepth}; max_depth is ${host.max_depth}.`,
      host_relation: "same_host",
      guard: "blocked",
      diagnostics: {
        host_relation: "same_host",
        guard: "blocked",
        warnings: [
          `HOST_RECURSION_BLOCKED: ${provider} peer would exceed max_depth ${host.max_depth}`
        ]
      }
    };
  }
  return allowed("same_host", "subprocess_isolated", buildChildHostEnv(host));
}
function allowed(hostRelation, guard, childEnv) {
  return {
    allowed: true,
    host_relation: hostRelation,
    guard,
    ...childEnv ? { child_env: childEnv } : {},
    diagnostics: {
      host_relation: hostRelation,
      guard
    }
  };
}
function parseNonNegativeInteger(value) {
  if (value === void 0 || !/^\d+$/.test(value)) return void 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : void 0;
}
function knownHostRuntime(value) {
  return value === "claude" || value === "codex" || value === "cursor" ? value : void 0;
}
function hasClaudeHostMarker(env) {
  return Boolean(
    env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_CODE_SESSION_ID || env.CLAUDE_SESSION_ID
  );
}
function hasCodexHostMarker(env) {
  return Boolean(
    env.CODEX_SESSION_ID || env.CODEX_SANDBOX || env.OPENAI_CODEX_SESSION_ID
  );
}
function hasCursorHostMarker(env) {
  return Boolean(
    env.CURSOR_TRACE_ID || env.CURSOR_AGENT || env.CURSOR_SESSION_ID || env.CURSOR
  );
}

// src/plugins/consensus/provider-cli/args.ts
var ConsensusCliUsageError = class extends Error {
  code = "CONSENSUS_CLI_USAGE";
  details;
  constructor(message, details) {
    super(message);
    this.name = "ConsensusCliUsageError";
    this.details = details;
  }
};
function parseConsensusCliArgs(argv) {
  const tokens = [...argv];
  const command = tokens.shift();
  if (!command || command === "--help" || command === "-h") {
    requireNoExtraTokens(tokens);
    return { kind: "help" };
  }
  if (command === "provider") {
    return parseProviderCommand(tokens);
  }
  if (command === "config") {
    return parseConfigCommand(tokens);
  }
  if (command === "preflight") {
    return parsePreflightCommand(tokens);
  }
  if (command === "run") {
    return parseRunCommand(tokens);
  }
  if (command === "submit") {
    return parseSubmitCommand(tokens);
  }
  throw new ConsensusCliUsageError(`Unknown command: ${command}`);
}
async function normalizeRunRequest(command, io) {
  if (command.kind !== "run") {
    throw new ConsensusCliUsageError("Expected a run command");
  }
  if (command.requestJson) {
    const source = command.requestJson === "-" ? await io.readStdin() : await io.readFile(command.requestJson);
    return attachHostContextWhenDetected(parseRequestJson(source), io);
  }
  if (!command.provider) {
    throw new ConsensusCliUsageError("Missing required --provider");
  }
  const output = command.output ?? "json";
  assertOutputSchemaPairing(output, command.schemaPath, {
    schema: "--schema",
    output: "--output text"
  });
  if (!command.promptSource) {
    throw new ConsensusCliUsageError(
      "Missing prompt source: use -, --prompt, --prompt-file, or --request-json"
    );
  }
  const prompt = await readPromptSource(command.promptSource, io);
  const request = {
    schema_version: "v1",
    provider: command.provider,
    ...command.output ? { output: command.output } : {},
    ...command.schemaPath ? { schema_path: command.schemaPath } : {},
    prompt
  };
  if (command.cwd) request.cwd = command.cwd;
  if (command.model) request.model = command.model;
  if (command.effort) request.effort = command.effort;
  const runtimePolicy = normalizeRuntimePolicy(command);
  if (runtimePolicy) request.runtime_policy = runtimePolicy;
  if (command.maxDepth !== void 0 || shouldAttachHostContext(io.env)) {
    request.host = normalizeHostContext(command.maxDepth, command, io);
  }
  if (command.maxAttempts !== void 0) {
    request.max_attempts = command.maxAttempts;
  }
  if (command.timeoutSec !== void 0) {
    request.max_runtime_sec = command.timeoutSec;
  }
  if (command.maxOutputBytes !== void 0) {
    request.max_output_bytes = command.maxOutputBytes;
  }
  if (command.continuation) {
    request.continuation = await normalizeContinuation(
      command.continuation,
      io
    );
  }
  return request;
}
async function normalizeContinuation(parsed, io) {
  const continuation = { mode: parsed.mode };
  if (parsed.sessionId !== void 0)
    continuation.session_id = parsed.sessionId;
  if (parsed.previousSessionId !== void 0) {
    continuation.previous_session_id = parsed.previousSessionId;
  }
  if (parsed.consultationId !== void 0) {
    continuation.consultation_id = parsed.consultationId;
  }
  if (parsed.round !== void 0) continuation.round = parsed.round;
  if (parsed.fallback !== void 0) continuation.fallback = parsed.fallback;
  if (parsed.fallbackPromptFile !== void 0) {
    continuation.fallback_prompt = await io.readFile(parsed.fallbackPromptFile);
  }
  return continuation;
}
function parseProviderCommand(tokens) {
  const [subcommand, ...rest] = tokens;
  if (subcommand !== "ls") {
    throw new ConsensusCliUsageError(
      "Expected provider subcommand: provider ls --json"
    );
  }
  const parsed = parseOptionTokens(rest, {
    allowedFlags: /* @__PURE__ */ new Set(["--json"]),
    valueFlags: /* @__PURE__ */ new Set()
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);
  return { kind: "provider-list", json: true };
}
function parseConfigCommand(tokens) {
  const [subcommand, ...rest] = tokens;
  if (subcommand === "get") return parseConfigGetCommand(rest);
  if (subcommand === "list") return parseConfigListCommand(rest);
  if (subcommand === "set") return parseConfigSetCommand(rest);
  if (subcommand === "clear") return parseConfigClearCommand(rest);
  throw new ConsensusCliUsageError(
    "Expected config subcommand: get, list, set, or clear"
  );
}
function parseConfigGetCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set(["--json", "--scope", "--cwd", "--workflow"]),
    valueFlags: /* @__PURE__ */ new Set(["--scope", "--cwd", "--workflow"])
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);
  const scope = parseConfigReadScope(
    singleValue(parsed.flags, "--scope") ?? "effective"
  );
  const command = {
    kind: "config-get",
    json: true,
    scope
  };
  assignIfDefined(command, "cwd", singleValue(parsed.flags, "--cwd"));
  const workflow = singleValue(parsed.flags, "--workflow");
  if (workflow !== void 0) {
    command.workflow = parseConfigWorkflow(workflow);
  }
  return command;
}
function parseConfigListCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set(["--json", "--cwd"]),
    valueFlags: /* @__PURE__ */ new Set(["--cwd"])
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);
  const command = {
    kind: "config-list",
    json: true
  };
  assignIfDefined(command, "cwd", singleValue(parsed.flags, "--cwd"));
  return command;
}
function parseConfigSetCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set([
      "--json",
      "--scope",
      "--cwd",
      "--peers",
      "--panelists",
      "--panel-size",
      "--reviewers",
      "--from-file"
    ]),
    valueFlags: /* @__PURE__ */ new Set([
      "--scope",
      "--cwd",
      "--peers",
      "--panelists",
      "--panel-size",
      "--reviewers",
      "--from-file"
    ])
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);
  const command = {
    kind: "config-set",
    json: true,
    scope: parseConfigWriteScope(singleValue(parsed.flags, "--scope"))
  };
  assignIfDefined(command, "cwd", singleValue(parsed.flags, "--cwd"));
  assignIfDefined(command, "peers", singleValue(parsed.flags, "--peers"));
  assignIfDefined(
    command,
    "panelists",
    singleValue(parsed.flags, "--panelists")
  );
  assignIfDefined(
    command,
    "reviewers",
    singleValue(parsed.flags, "--reviewers")
  );
  assignIfDefined(
    command,
    "fromFile",
    singleValue(parsed.flags, "--from-file")
  );
  const panelSize = singleValue(parsed.flags, "--panel-size");
  if (panelSize !== void 0) {
    command.panelSize = parsePositiveInteger("--panel-size", panelSize);
  }
  return command;
}
function parseConfigClearCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set(["--json", "--scope", "--cwd", "--key"]),
    valueFlags: /* @__PURE__ */ new Set(["--scope", "--cwd", "--key"])
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);
  const command = {
    kind: "config-clear",
    json: true,
    scope: parseConfigWriteScope(singleValue(parsed.flags, "--scope")),
    key: parseConfigKey(singleValue(parsed.flags, "--key") ?? "all")
  };
  assignIfDefined(command, "cwd", singleValue(parsed.flags, "--cwd"));
  return command;
}
function parseConfigReadScope(value) {
  if (value === "user" || value === "project" || value === "effective") {
    return value;
  }
  throw new ConsensusCliUsageError(`Invalid config scope: ${value}`);
}
function parseConfigWriteScope(value) {
  if (value === "user" || value === "project") return value;
  if (value === void 0) {
    throw new ConsensusCliUsageError(
      "Missing required config --scope user|project"
    );
  }
  throw new ConsensusCliUsageError(`Invalid config scope: ${value}`);
}
function parseConfigKey(value) {
  if (value === "peers" || value === "panelists" || value === "panel-size" || value === "reviewers" || value === "roles" || value === "all") {
    return value;
  }
  throw new ConsensusCliUsageError(`Invalid config key: ${value}`);
}
function parseConfigWorkflow(value) {
  if (value === "convergence" || value === "panel" || value === "review") {
    return value;
  }
  throw new ConsensusCliUsageError(`Unsupported config workflow: ${value}`);
}
function parsePreflightCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set([
      "--json",
      "--provider",
      "--capability",
      "--max-depth"
    ]),
    valueFlags: /* @__PURE__ */ new Set(["--provider", "--capability", "--max-depth"])
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);
  const provider = singleValue(parsed.flags, "--provider");
  if (!provider) {
    throw new ConsensusCliUsageError(
      "Preflight requires exactly one --provider."
    );
  }
  const capabilities = valuesFor(parsed.flags, "--capability").map(
    parsePreflightCapability
  );
  if (capabilities.length === 0) {
    throw new ConsensusCliUsageError(
      "Preflight requires at least one --capability."
    );
  }
  const command = {
    kind: "preflight",
    json: true,
    provider,
    capabilities: [...new Set(capabilities)]
  };
  const maxDepth = singleValue(parsed.flags, "--max-depth");
  if (maxDepth) {
    command.maxDepth = parsePositiveInteger("--max-depth", maxDepth);
  }
  return command;
}
function parsePreflightCapability(value) {
  if (PROVIDER_PREFLIGHT_CAPABILITIES.includes(
    value
  )) {
    return value;
  }
  throw new ConsensusCliUsageError(
    `Unsupported preflight capability: ${value}`
  );
}
function parseRunCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set([
      "--json",
      "--provider",
      "--output",
      "--schema",
      "--prompt",
      "--prompt-file",
      "--request-json",
      "--max-attempts",
      "--timeout-sec",
      "--max-output-bytes",
      "--model",
      "--effort",
      "--cwd",
      "--permission-mode",
      "--sandbox",
      "--approval-policy",
      "--env-allow",
      "--allow-read",
      "--allow-edit",
      "--allow-bash",
      "--allow-web-search",
      "--allow-web-fetch-domain",
      "--max-depth",
      "--resume",
      "--continuation",
      "--previous-session",
      "--consultation-id",
      "--round",
      "--resume-fallback",
      "--fallback-prompt-file"
    ]),
    valueFlags: /* @__PURE__ */ new Set([
      "--provider",
      "--output",
      "--schema",
      "--prompt",
      "--prompt-file",
      "--request-json",
      "--max-attempts",
      "--timeout-sec",
      "--max-output-bytes",
      "--model",
      "--effort",
      "--cwd",
      "--permission-mode",
      "--sandbox",
      "--approval-policy",
      "--env-allow",
      "--allow-read",
      "--allow-edit",
      "--allow-bash",
      "--allow-web-fetch-domain",
      "--max-depth",
      "--resume",
      "--continuation",
      "--previous-session",
      "--consultation-id",
      "--round",
      "--resume-fallback",
      "--fallback-prompt-file"
    ])
  });
  requireJson(parsed.flags);
  const command = {
    kind: "run",
    json: true
  };
  assignIfDefined(command, "provider", singleValue(parsed.flags, "--provider"));
  const output = singleValue(parsed.flags, "--output");
  if (output !== void 0) command.output = parseRunOutput(output);
  assignIfDefined(command, "schemaPath", singleValue(parsed.flags, "--schema"));
  assignIfDefined(
    command,
    "requestJson",
    singleValue(parsed.flags, "--request-json")
  );
  assignIfDefined(command, "model", singleValue(parsed.flags, "--model"));
  assignIfDefined(command, "effort", singleValue(parsed.flags, "--effort"));
  assignIfDefined(command, "cwd", singleValue(parsed.flags, "--cwd"));
  assignIfDefined(
    command,
    "permissionMode",
    singleValue(parsed.flags, "--permission-mode")
  );
  assignIfDefined(command, "sandbox", singleValue(parsed.flags, "--sandbox"));
  assignIfDefined(
    command,
    "approvalPolicy",
    singleValue(parsed.flags, "--approval-policy")
  );
  const envAllow = valuesFor(parsed.flags, "--env-allow");
  if (envAllow.length > 0) command.envAllow = envAllow;
  const readPaths = valuesFor(parsed.flags, "--allow-read");
  if (readPaths.length > 0) command.readPaths = readPaths;
  const editPaths = valuesFor(parsed.flags, "--allow-edit");
  if (editPaths.length > 0) command.editPaths = editPaths;
  const bashPatterns = valuesFor(parsed.flags, "--allow-bash");
  if (bashPatterns.length > 0) command.bashPatterns = bashPatterns;
  if (parsed.flags.has("--allow-web-search")) command.webSearch = true;
  const webFetchDomains = valuesFor(parsed.flags, "--allow-web-fetch-domain");
  if (webFetchDomains.length > 0) command.webFetchDomains = webFetchDomains;
  const prompt = singleValue(parsed.flags, "--prompt");
  const promptFile = singleValue(parsed.flags, "--prompt-file");
  const stdinMarkers = parsed.positionals.filter((value) => value === "-");
  const unknownPositionals = parsed.positionals.filter(
    (value) => value !== "-"
  );
  if (unknownPositionals.length > 0) {
    throw new ConsensusCliUsageError(
      `Unexpected positional argument: ${unknownPositionals[0]}`
    );
  }
  const promptSources = [
    prompt === void 0 ? void 0 : { kind: "prompt", value: prompt },
    promptFile === void 0 ? void 0 : { kind: "file", path: promptFile },
    ...stdinMarkers.map(() => ({ kind: "stdin" }))
  ].filter((source) => source !== void 0);
  if (promptSources.length > 1) {
    throw new ConsensusCliUsageError("Use only one prompt source");
  }
  command.promptSource = promptSources[0];
  const maxAttempts = singleValue(parsed.flags, "--max-attempts");
  if (maxAttempts) {
    command.maxAttempts = parsePositiveInteger("--max-attempts", maxAttempts);
  }
  const timeoutSec = singleValue(parsed.flags, "--timeout-sec");
  if (timeoutSec) {
    command.timeoutSec = parsePositiveInteger("--timeout-sec", timeoutSec);
  }
  const maxOutputBytes = singleValue(parsed.flags, "--max-output-bytes");
  if (maxOutputBytes) {
    command.maxOutputBytes = parsePositiveInteger(
      "--max-output-bytes",
      maxOutputBytes
    );
  }
  const maxDepth = singleValue(parsed.flags, "--max-depth");
  if (maxDepth) {
    command.maxDepth = parsePositiveInteger("--max-depth", maxDepth);
  }
  const continuation = parseRunContinuation(parsed.flags);
  if (continuation) command.continuation = continuation;
  if (command.requestJson) {
    assertNoRequestJsonConflicts(command, parsed.positionals.length);
  }
  return command;
}
function parseRunContinuation(flags) {
  const sessionId = singleValue(flags, "--resume");
  const modeValue = singleValue(flags, "--continuation");
  const previousSessionId2 = singleValue(flags, "--previous-session");
  const consultationId = singleValue(flags, "--consultation-id");
  const round = singleValue(flags, "--round");
  const fallback = singleValue(flags, "--resume-fallback");
  const fallbackPromptFile = singleValue(flags, "--fallback-prompt-file");
  if ([
    sessionId,
    modeValue,
    previousSessionId2,
    consultationId,
    round,
    fallback,
    fallbackPromptFile
  ].every((value) => value === void 0)) {
    return void 0;
  }
  let mode;
  if (modeValue === void 0) {
    mode = sessionId === void 0 ? "new" : "native-resume";
  } else {
    mode = parseContinuationMode(modeValue);
    if (sessionId !== void 0 && mode !== "native-resume") {
      throw new ConsensusCliUsageError(
        `--resume cannot be combined with --continuation ${mode}`
      );
    }
  }
  const continuation = { mode };
  assignIfDefined(continuation, "sessionId", sessionId);
  assignIfDefined(continuation, "previousSessionId", previousSessionId2);
  assignIfDefined(continuation, "consultationId", consultationId);
  if (round !== void 0) {
    continuation.round = parsePositiveInteger("--round", round);
  }
  if (fallback !== void 0) {
    continuation.fallback = parseResumeFallback(fallback);
  }
  assignIfDefined(continuation, "fallbackPromptFile", fallbackPromptFile);
  return continuation;
}
function parseRunOutput(value) {
  if (RUN_OUTPUT_KINDS.includes(value)) {
    return value;
  }
  throw new ConsensusCliUsageError(
    `Invalid --output: ${value} (expected ${RUN_OUTPUT_KINDS.join(", ")})`
  );
}
function assertOutputSchemaPairing(output, schemaPath, labels) {
  if (output === "json" && !schemaPath) {
    throw new ConsensusCliUsageError(
      `Missing required ${labels.schema} (JSON output is schema-validated; use ${labels.output} for free-form text)`
    );
  }
  if (output === "text" && schemaPath !== void 0) {
    throw new ConsensusCliUsageError(
      `${labels.schema} cannot be combined with ${labels.output}`
    );
  }
}
function parseContinuationMode(value) {
  if (CONTINUATION_MODES.includes(value)) {
    return value;
  }
  throw new ConsensusCliUsageError(
    `Invalid --continuation: ${value} (expected ${CONTINUATION_MODES.join(", ")})`
  );
}
function parseResumeFallback(value) {
  if (RESUME_FALLBACK_POLICIES.includes(value)) {
    return value;
  }
  throw new ConsensusCliUsageError(
    `Invalid --resume-fallback: ${value} (expected ${RESUME_FALLBACK_POLICIES.join(", ")})`
  );
}
function parseSubmitCommand(tokens) {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: /* @__PURE__ */ new Set(["--json", "--schema", "--out", "--verdict-file"]),
    valueFlags: /* @__PURE__ */ new Set(["--schema", "--out", "--verdict-file"])
  });
  requireJson(parsed.flags);
  const command = {
    kind: "submit",
    json: true
  };
  assignIfDefined(command, "schemaPath", singleValue(parsed.flags, "--schema"));
  assignIfDefined(command, "outPath", singleValue(parsed.flags, "--out"));
  const verdictFile = singleValue(parsed.flags, "--verdict-file");
  const stdinMarkers = parsed.positionals.filter((value) => value === "-");
  const unknownPositionals = parsed.positionals.filter(
    (value) => value !== "-"
  );
  if (unknownPositionals.length > 0) {
    throw new ConsensusCliUsageError(
      `Unexpected positional argument: ${unknownPositionals[0]}`
    );
  }
  const verdictSources = [];
  if (verdictFile !== void 0) {
    verdictSources.push({ kind: "file", path: verdictFile });
  }
  for (let index = 0; index < stdinMarkers.length; index += 1) {
    verdictSources.push({ kind: "stdin" });
  }
  if (verdictSources.length > 1) {
    throw new ConsensusCliUsageError("Use only one verdict source");
  }
  command.verdictSource = verdictSources[0];
  return command;
}
function assertNoRequestJsonConflicts(command, positionalCount) {
  const conflicts = [
    command.provider ? "--provider" : void 0,
    command.output ? "--output" : void 0,
    command.schemaPath ? "--schema" : void 0,
    command.promptSource ? "prompt source" : void 0,
    command.maxAttempts !== void 0 ? "--max-attempts" : void 0,
    command.timeoutSec !== void 0 ? "--timeout-sec" : void 0,
    command.maxOutputBytes !== void 0 ? "--max-output-bytes" : void 0,
    command.model ? "--model" : void 0,
    command.effort ? "--effort" : void 0,
    command.cwd ? "--cwd" : void 0,
    command.permissionMode ? "--permission-mode" : void 0,
    command.sandbox ? "--sandbox" : void 0,
    command.approvalPolicy ? "--approval-policy" : void 0,
    command.envAllow && command.envAllow.length > 0 ? "--env-allow" : void 0,
    command.readPaths ? "--allow-read" : void 0,
    command.editPaths ? "--allow-edit" : void 0,
    command.bashPatterns ? "--allow-bash" : void 0,
    command.webSearch ? "--allow-web-search" : void 0,
    command.webFetchDomains ? "--allow-web-fetch-domain" : void 0,
    command.maxDepth !== void 0 ? "--max-depth" : void 0,
    command.continuation ? "continuation flags" : void 0,
    positionalCount > 0 ? "positional prompt" : void 0
  ].filter(Boolean);
  if (conflicts.length > 0) {
    throw new ConsensusCliUsageError(
      `--request-json cannot be combined with request-shaping flags: ${conflicts.join(", ")}`
    );
  }
}
function normalizeRuntimePolicy(command) {
  const runtimePolicy = {};
  if (command.permissionMode) {
    runtimePolicy.permission_mode = command.permissionMode;
  }
  if (command.sandbox) runtimePolicy.sandbox = command.sandbox;
  if (command.approvalPolicy) {
    runtimePolicy.approval_policy = command.approvalPolicy;
  }
  if (command.envAllow && command.envAllow.length > 0) {
    runtimePolicy.env_allowlist = command.envAllow;
  }
  if (command.readPaths) runtimePolicy.read_paths = command.readPaths;
  if (command.editPaths) runtimePolicy.edit_paths = command.editPaths;
  if (command.bashPatterns) {
    runtimePolicy.bash_patterns = command.bashPatterns;
  }
  if (command.webSearch) runtimePolicy.web_search = true;
  if (command.webFetchDomains) {
    runtimePolicy.web_fetch_domains = command.webFetchDomains;
  }
  return Object.keys(runtimePolicy).length > 0 ? runtimePolicy : void 0;
}
function assignIfDefined(target, key, value) {
  if (value !== void 0) target[key] = value;
}
function normalizeHostContext(maxDepth, command, io) {
  return hostContextFromEnv(
    io.env ?? {},
    command.cwd ?? io.cwd ?? process.cwd(),
    maxDepth ?? 1
  );
}
function attachHostContextWhenDetected(request, io) {
  if (request.host || !shouldAttachHostContext(io.env)) return request;
  return {
    ...request,
    host: hostContextFromEnv(
      io.env ?? {},
      request.cwd ?? io.cwd ?? process.cwd(),
      1
    )
  };
}
function shouldAttachHostContext(env = {}) {
  return detectHostRuntime(env) !== "unknown" || env.CONSENSUS_RUN_ID !== void 0 || env.CONSENSUS_DEPTH !== void 0 || env.CONSENSUS_PARENT_HOST !== void 0;
}
async function readPromptSource(source, io) {
  if (source.kind === "stdin") return io.readStdin();
  if (source.kind === "file") return io.readFile(source.path);
  return source.value;
}
function parseRequestJson(contents) {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new ConsensusCliUsageError("Invalid request JSON", {
      cause: String(error)
    });
  }
  if (!isRecord5(parsed)) {
    throw new ConsensusCliUsageError("Request JSON must be an object");
  }
  if (parsed.schema_version !== "v1") {
    throw new ConsensusCliUsageError(
      'Request JSON schema_version must be "v1"'
    );
  }
  if (typeof parsed.provider !== "string" || parsed.provider.length === 0) {
    throw new ConsensusCliUsageError("Request JSON provider must be a string");
  }
  if (parsed.output !== void 0 && !RUN_OUTPUT_KINDS.includes(parsed.output)) {
    throw new ConsensusCliUsageError(
      `Request JSON output must be one of: ${RUN_OUTPUT_KINDS.join(", ")}`
    );
  }
  if (parsed.schema_path !== void 0 && (typeof parsed.schema_path !== "string" || parsed.schema_path.length === 0)) {
    throw new ConsensusCliUsageError(
      "Request JSON schema_path must be a string"
    );
  }
  assertOutputSchemaPairing(
    parsed.output ?? "json",
    parsed.schema_path,
    { schema: "Request JSON schema_path", output: 'output "text"' }
  );
  if (typeof parsed.prompt !== "string") {
    throw new ConsensusCliUsageError("Request JSON prompt must be a string");
  }
  validateOptionalStringField(parsed, "cwd", "Request JSON cwd");
  validateOptionalStringField(parsed, "model", "Request JSON model");
  validateOptionalStringField(parsed, "effort", "Request JSON effort");
  validateOptionalPositiveInteger(
    parsed,
    "max_attempts",
    "Request JSON max_attempts"
  );
  validateOptionalPositiveInteger(
    parsed,
    "max_runtime_sec",
    "Request JSON max_runtime_sec"
  );
  validateOptionalPositiveInteger(
    parsed,
    "max_output_bytes",
    "Request JSON max_output_bytes"
  );
  validateRuntimePolicy(parsed.runtime_policy);
  validateContinuation(parsed.continuation);
  validateHostContext(parsed.host);
  validateRedaction(parsed.redaction);
  return parsed;
}
function validateRuntimePolicy(value) {
  if (value === void 0) return;
  if (!isRecord5(value)) {
    throw new ConsensusCliUsageError(
      "Request JSON runtime_policy must be an object"
    );
  }
  validateOptionalStringField(
    value,
    "permission_mode",
    "Request JSON runtime_policy.permission_mode"
  );
  validateOptionalStringField(
    value,
    "sandbox",
    "Request JSON runtime_policy.sandbox"
  );
  validateOptionalStringField(
    value,
    "approval_policy",
    "Request JSON runtime_policy.approval_policy"
  );
  if (value.env_allowlist !== void 0 && !isStringArray(value.env_allowlist)) {
    throw new ConsensusCliUsageError(
      "Request JSON runtime_policy.env_allowlist must be a string array"
    );
  }
  for (const field of [
    "read_paths",
    "edit_paths",
    "bash_patterns",
    "web_fetch_domains"
  ]) {
    if (value[field] !== void 0 && !isStringArray(value[field])) {
      throw new ConsensusCliUsageError(
        `Request JSON runtime_policy.${field} must be a string array`
      );
    }
  }
  for (const field of ["web_search"]) {
    if (value[field] !== void 0 && typeof value[field] !== "boolean") {
      throw new ConsensusCliUsageError(
        `Request JSON runtime_policy.${field} must be a boolean`
      );
    }
  }
}
function validateContinuation(value) {
  if (value === void 0) return;
  if (!isRecord5(value)) {
    throw new ConsensusCliUsageError(
      "Request JSON continuation must be an object"
    );
  }
  if (!CONTINUATION_MODES.includes(value.mode)) {
    throw new ConsensusCliUsageError(
      `Request JSON continuation.mode must be one of: ${CONTINUATION_MODES.join(", ")}`
    );
  }
  for (const key of [
    "session_id",
    "previous_session_id",
    "consultation_id",
    "fallback_prompt"
  ]) {
    validateOptionalStringField(value, key, `Request JSON continuation.${key}`);
  }
  validateOptionalPositiveInteger(
    value,
    "round",
    "Request JSON continuation.round"
  );
  if (value.fallback !== void 0 && !RESUME_FALLBACK_POLICIES.includes(value.fallback)) {
    throw new ConsensusCliUsageError(
      `Request JSON continuation.fallback must be one of: ${RESUME_FALLBACK_POLICIES.join(", ")}`
    );
  }
}
function validateHostContext(value) {
  if (value === void 0) return;
  if (!isRecord5(value)) {
    throw new ConsensusCliUsageError("Request JSON host must be an object");
  }
  validateRequiredStringField(value, "runtime", "Request JSON host.runtime");
  validateRequiredStringField(value, "cwd", "Request JSON host.cwd");
  validateRequiredStringField(value, "run_id", "Request JSON host.run_id");
  validateRequiredNonNegativeInteger(value, "depth", "Request JSON host.depth");
  validateRequiredPositiveInteger(
    value,
    "max_depth",
    "Request JSON host.max_depth"
  );
}
function validateRedaction(value) {
  if (value === void 0) return;
  if (!isRecord5(value)) {
    throw new ConsensusCliUsageError(
      "Request JSON redaction must be an object"
    );
  }
  validateOptionalBooleanField(
    value,
    "include_args",
    "Request JSON redaction.include_args"
  );
  validateOptionalBooleanField(
    value,
    "include_stderr",
    "Request JSON redaction.include_stderr"
  );
}
function validateRequiredStringField(record, key, label) {
  if (typeof record[key] !== "string" || record[key].length === 0) {
    throw new ConsensusCliUsageError(`${label} must be a string`);
  }
}
function validateOptionalStringField(record, key, label) {
  if (record[key] === void 0) return;
  validateRequiredStringField(record, key, label);
}
function validateOptionalBooleanField(record, key, label) {
  if (record[key] === void 0) return;
  if (typeof record[key] !== "boolean") {
    throw new ConsensusCliUsageError(`${label} must be a boolean`);
  }
}
function validateOptionalPositiveInteger(record, key, label) {
  if (record[key] === void 0) return;
  validateRequiredPositiveInteger(record, key, label);
}
function validateRequiredPositiveInteger(record, key, label) {
  if (!Number.isInteger(record[key]) || Number(record[key]) < 1) {
    throw new ConsensusCliUsageError(`${label} must be a positive integer`);
  }
}
function validateRequiredNonNegativeInteger(record, key, label) {
  if (!Number.isInteger(record[key]) || Number(record[key]) < 0) {
    throw new ConsensusCliUsageError(`${label} must be a non-negative integer`);
  }
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}
function parseOptionTokens(tokens, spec) {
  const flags = /* @__PURE__ */ new Map();
  const positionals = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [flag, inlineValue] = splitFlag(token);
    if (!spec.allowedFlags.has(flag)) {
      throw new ConsensusCliUsageError(`Unknown flag: ${flag}`);
    }
    if (!spec.valueFlags.has(flag)) {
      if (inlineValue !== void 0) {
        throw new ConsensusCliUsageError(`${flag} does not accept a value`);
      }
      pushFlag(flags, flag, "true");
      continue;
    }
    const value = inlineValue ?? tokens[index + 1];
    if (value === void 0 || value.startsWith("--")) {
      throw new ConsensusCliUsageError(`${flag} requires a value`);
    }
    if (inlineValue === void 0) index += 1;
    pushFlag(flags, flag, value);
  }
  return { flags, positionals };
}
function splitFlag(token) {
  const equalsIndex = token.indexOf("=");
  if (equalsIndex === -1) return [token, void 0];
  return [token.slice(0, equalsIndex), token.slice(equalsIndex + 1)];
}
function pushFlag(flags, flag, value) {
  const values = flags.get(flag) ?? [];
  values.push(value);
  flags.set(flag, values);
}
function singleValue(flags, flag) {
  const values = flags.get(flag);
  if (!values || values.length === 0) return void 0;
  if (values.length > 1) {
    throw new ConsensusCliUsageError(`${flag} can only be provided once`);
  }
  return values[0];
}
function valuesFor(flags, flag) {
  return flags.get(flag) ?? [];
}
function requireJson(flags) {
  if (!flags.has("--json")) {
    throw new ConsensusCliUsageError("Missing required --json flag");
  }
}
function requireNoPositionals(positionals) {
  if (positionals.length > 0) {
    throw new ConsensusCliUsageError(
      `Unexpected positional argument: ${positionals[0]}`
    );
  }
}
function requireNoExtraTokens(tokens) {
  if (tokens.length > 0) {
    throw new ConsensusCliUsageError(`Unexpected argument: ${tokens[0]}`);
  }
}
function parsePositiveInteger(flag, value) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ConsensusCliUsageError(`${flag} must be a positive integer`);
  }
  return Number(value);
}
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/plugins/consensus/provider-cli/envelope.ts
function successEnvelope(input) {
  const envelope = {
    schema_version: "v1",
    ok: true,
    provider: input.provider,
    args: input.args,
    stdout: input.stdout,
    output_kind: "json",
    json: input.json,
    attempts: buildAttemptSummary(input.attempts, false)
  };
  if (input.stderr !== void 0) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;
  return envelope;
}
function textSuccessEnvelope(input) {
  const envelope = {
    schema_version: "v1",
    ok: true,
    provider: input.provider,
    args: input.args,
    stdout: input.stdout,
    output_kind: "text",
    text: input.text,
    json: null,
    attempts: buildAttemptSummary(input.attempts, false)
  };
  if (input.stderr !== void 0) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;
  return envelope;
}
function failureEnvelope(input) {
  const envelope = {
    schema_version: "v1",
    ok: false,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    attempts: buildAttemptSummary(
      {
        ...input.attempts,
        terminal_reason: input.terminal_reason ?? input.attempts?.terminal_reason
      },
      input.retryable
    )
  };
  if (input.provider) envelope.provider = input.provider;
  if (input.stdout !== void 0) envelope.stdout = input.stdout;
  if (input.stderr !== void 0) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;
  return envelope;
}
function usageFailure(message, details) {
  const diagnostics = details === void 0 ? void 0 : { warnings: [JSON.stringify(details)] };
  return failureEnvelope({
    code: "CONSENSUS_CLI_USAGE",
    message,
    retryable: false,
    attempts: {
      cli_attempts: 0,
      terminal_reason: "usage"
    },
    diagnostics
  });
}
function processExitForEnvelope(envelope) {
  if (envelope.ok) return 0;
  if (envelope.code === "CONSENSUS_CLI_USAGE") return 2;
  return 0;
}
function buildAttemptSummary(attempts, retryable) {
  return {
    cli_attempts: attempts?.cli_attempts ?? 1,
    ...attempts?.provider_internal_attempts === void 0 ? {} : { provider_internal_attempts: attempts.provider_internal_attempts },
    ...attempts?.terminal_reason === void 0 ? {} : { terminal_reason: attempts.terminal_reason },
    retryable
  };
}

// src/plugins/consensus/provider-cli/probe.ts
import { constants } from "node:fs";
import { access as access2, stat } from "node:fs/promises";
import path8 from "node:path";

// src/plugins/consensus/provider-cli/executable.ts
import path7 from "node:path";
function resolveProviderExecutable(adapter, env) {
  const variable = adapter.executable_env;
  const value = env[variable];
  if (value === void 0 || value === "") {
    return { ok: true, executable: adapter.executable };
  }
  if (!path7.isAbsolute(value)) {
    return {
      ok: false,
      message: `${variable} must be an absolute path to an executable, not ${JSON.stringify(value)}.`
    };
  }
  return { ok: true, executable: value };
}

// src/plugins/consensus/provider-cli/probe.ts
var DEFAULT_PROBE_TIMEOUT_SEC = 10;
var DEFAULT_PROBE_MAX_OUTPUT_BYTES = 64 * 1024;
async function probeProviderRegistry({
  registry,
  runner,
  provider,
  requiredCapabilities
}) {
  const adapters = provider ? [registry.get(provider)].filter(
    (adapter) => adapter !== void 0
  ) : registry.list().filter((adapter) => adapter.tier === "core");
  return Promise.all(
    adapters.map(
      (adapter) => probeProviderReadiness(adapter, { runner, requiredCapabilities })
    )
  );
}
async function probeProviderReadiness(adapter, options) {
  const notAdmitted = notAdmittedEntry(adapter);
  if (notAdmitted) return notAdmitted;
  const prerequisites = await checkProviderPrerequisites(
    adapter,
    options.runner
  );
  if (!prerequisites.ok) {
    const prerequisite = prerequisites.failure;
    return providerEntry(adapter, prerequisite.status, {
      ...prerequisite.install_hint ? { install_hint: prerequisite.install_hint } : {},
      diagnostics: prerequisite.diagnostics,
      warnings: [prerequisite.warning]
    });
  }
  const resolved = resolveProviderExecutable(adapter, options.runner.env ?? {});
  if (!resolved.ok) {
    return providerEntry(adapter, "missing", {
      warnings: [`PROVIDER_MISSING: ${resolved.message}`]
    });
  }
  const command = resolved.executable;
  const executable = await options.runner.findExecutable(command);
  if (!executable || !path8.isAbsolute(executable)) {
    return providerEntry(adapter, "missing", {
      ...adapter.install_hint ? { install_hint: adapter.install_hint } : {},
      warnings: [
        `PROVIDER_MISSING: executable not found for ${adapter.id} (${command})`
      ]
    });
  }
  const extended = adapter.tier === "extended";
  const probed = extended ? { id: adapter.id, credential_env: [] } : adapter;
  const redact = probeOutputRedactor(adapter, options.runner.env ?? {});
  const versionLabel = (output2) => {
    const version = extended ? releaseLabel(output2, redact) : redact(firstNonEmptyLine2(output2) ?? "") || void 0;
    return version ? { version } : {};
  };
  const result = await options.runner.run(
    executable,
    adapter.probe.version_args,
    probed
  );
  const probeFailure = probeFailureEntry(adapter, executable, result);
  if (probeFailure) return probeFailure;
  const output = `${result.stdout}
${result.stderr}`;
  if (matchesAny2(output, adapter.probe.auth_required_patterns)) {
    return providerEntry(adapter, "auth_required", {
      executable,
      warnings: [
        `PROVIDER_AUTH_REQUIRED: ${redact(`${firstNonEmptyLine2(output)}`)}`
      ]
    });
  }
  if (result.code !== 0 || matchesAny2(output, adapter.probe.unavailable_patterns)) {
    return providerEntry(adapter, "unavailable", {
      executable,
      warnings: [
        `PROVIDER_UNAVAILABLE: ${redact(`${firstNonEmptyLine2(output)}`)}`
      ]
    });
  }
  const detectedVersion = parseNumericVersion(output);
  const minimumVersion = parseNumericVersion(adapter.probe.minimum_version);
  if (!detectedVersion || !minimumVersion) {
    return providerEntry(adapter, "unavailable", {
      executable,
      ...versionLabel(output),
      warnings: [
        `PROVIDER_VERSION_UNPARSEABLE: could not establish ${adapter.id} compatibility from version output`
      ]
    });
  }
  if (compareNumericVersions(detectedVersion, minimumVersion) < 0) {
    return providerEntry(adapter, "unavailable", {
      executable,
      ...versionLabel(output),
      warnings: [
        `PROVIDER_VERSION_UNSUPPORTED: ${adapter.id} ${formatNumericVersion(detectedVersion)} is below required ${adapter.probe.minimum_version}`
      ]
    });
  }
  for (const capability of options.requiredCapabilities ?? []) {
    const definition = adapter.probe.capabilities[capability];
    const capabilityResult = await options.runner.run(
      executable,
      definition.args,
      probed
    );
    const capabilityFailure = probeFailureEntry(
      adapter,
      executable,
      capabilityResult
    );
    if (capabilityFailure) return capabilityFailure;
    const capabilityOutput = `${capabilityResult.stdout}
${capabilityResult.stderr}`;
    if (capabilityResult.code !== 0 || !definition.required_output_patterns.every(
      (pattern) => pattern.test(capabilityOutput)
    )) {
      return providerEntry(adapter, "unavailable", {
        executable,
        ...versionLabel(output),
        warnings: [
          `PROVIDER_CAPABILITY_MISSING: ${adapter.id} does not expose required local capability ${capability}`
        ]
      });
    }
  }
  return providerEntry(adapter, "ready", {
    executable,
    ...versionLabel(output)
  });
}
async function checkProviderPrerequisites(adapter, runner) {
  const executables = {};
  const failed = (failure3) => ({ ok: false, failure: failure3 });
  for (const prerequisite of adapter.probe.prerequisites ?? []) {
    const missing = (detail) => ({
      status: "missing",
      warning: `PROVIDER_PREREQUISITE_MISSING: ${detail}`,
      message: `Provider ${adapter.id} prerequisite ${detail}.`,
      install_hint: prerequisite.install_hint
    });
    const resolved = resolveProviderExecutable(
      {
        executable: prerequisite.command,
        executable_env: prerequisite.executable_env
      },
      runner.env ?? {}
    );
    if (!resolved.ok) {
      return failed(
        missing(`${prerequisite.name} is unusable: ${resolved.message}`)
      );
    }
    const executable = await runner.findExecutable(resolved.executable);
    if (!executable || !path8.isAbsolute(executable)) {
      return failed(
        missing(`${prerequisite.name} was not found (${resolved.executable})`)
      );
    }
    const pin = prerequisite.version;
    if (!pin) {
      executables[prerequisite.name] = executable;
      continue;
    }
    const pinError = versionPinError(pin);
    if (pinError) {
      const detail = `${prerequisite.name} declares an invalid version pin: ${pinError}`;
      return failed({
        status: "unsupported",
        warning: `PROVIDER_PREREQUISITE_PIN_INVALID: ${detail}`,
        message: `Provider ${adapter.id} prerequisite ${detail}.`
      });
    }
    const result = await runner.run(executable, pin.args, adapter);
    if (result.failure_code === "PROVIDER_MISSING") {
      return failed(
        missing(`${prerequisite.name} failed to start (${executable})`)
      );
    }
    const output = `${result.stdout}
${result.stderr}`;
    if (result.failure_code || result.code !== 0) {
      const detail = `${prerequisite.name} version check failed: ${result.failure_code ?? firstNonEmptyLine2(output) ?? `exit ${result.code}`}`;
      return failed({
        status: "unavailable",
        warning: `PROVIDER_PREREQUISITE_UNAVAILABLE: ${detail}`,
        message: `Provider ${adapter.id} prerequisite ${detail}.`,
        diagnostics: result.diagnostics
      });
    }
    const detected = parseVersion(output);
    const required = describeVersionPin(pin);
    if (!detected || !satisfiesVersionPin(detected, pin)) {
      const found = detected ? formatVersion(detected) : `unparseable version output ${JSON.stringify(firstNonEmptyLine2(output) ?? "")}`;
      const detail = `${prerequisite.name} ${found} is outside the required ${required}`;
      return failed({
        status: "unsupported",
        warning: `PROVIDER_PREREQUISITE_VERSION_UNSUPPORTED: ${detail}`,
        message: `Provider ${adapter.id} prerequisite ${detail}.`,
        install_hint: prerequisite.install_hint
      });
    }
    executables[prerequisite.name] = executable;
  }
  return { ok: true, executables };
}
function notAdmittedEntry(adapter) {
  if (!adapter.not_admitted_reason) return void 0;
  return providerEntry(adapter, "unsupported", {
    warnings: [
      `PROVIDER_NOT_ADMITTED: registered, not admitted: ${adapter.not_admitted_reason}`
    ]
  });
}
function nodeProbeCommandRunner(env = process.env, options = {}) {
  return {
    env,
    findExecutable(command) {
      return findExecutable(command, env);
    },
    run(command, args, adapter) {
      return runProbeCommand(
        command,
        args,
        buildProviderProbeEnvironment({
          parentEnv: env,
          credentialEnv: adapter.credential_env
        }),
        options
      );
    }
  };
}
async function findExecutable(command, env) {
  if (command.includes(path8.sep)) {
    return firstExecutable(command);
  }
  const pathValue = env.PATH ?? "";
  for (const searchPath of pathValue.split(path8.delimiter)) {
    if (!path8.isAbsolute(searchPath)) continue;
    const found = await firstExecutable(path8.join(searchPath, command));
    if (found) return found;
  }
  return void 0;
}
var WINDOWS_EXECUTABLE_EXTENSIONS = [".exe", ".com"];
async function firstExecutable(filePath) {
  const candidates = process.platform === "win32" && !path8.extname(filePath) ? [
    filePath,
    ...WINDOWS_EXECUTABLE_EXTENSIONS.map((ext) => filePath + ext)
  ] : [filePath];
  for (const candidate of candidates) {
    if (await canExecute(candidate)) return candidate;
  }
  return void 0;
}
async function canExecute(filePath) {
  try {
    if (!(await stat(filePath)).isFile()) return false;
    await access2(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function runProbeCommand(command, args, env, options) {
  const subprocessOptions = {
    env,
    timeoutSec: options.timeoutSec ?? DEFAULT_PROBE_TIMEOUT_SEC,
    maxOutputBytes: options.maxOutputBytes ?? DEFAULT_PROBE_MAX_OUTPUT_BYTES,
    ...options.terminationGraceMs !== void 0 ? { terminationGraceMs: options.terminationGraceMs } : {},
    ...options.finalResolutionMs !== void 0 ? { finalResolutionMs: options.finalResolutionMs } : {}
  };
  return runProviderSubprocess(
    {
      executable: command,
      argv: [...args],
      stdin: "",
      output_mode: "stdout_json",
      strategy: "prompt_only",
      redacted_command: [command, ...args],
      shell: false
    },
    subprocessOptions
  ).then((result) => ({
    code: result.exit_code,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    ...result.ok ? {} : { failure_code: result.code },
    diagnostics: result.diagnostics
  }));
}
function releaseLabel(output, redact) {
  const parsed = parseVersion(output);
  if (!parsed || parsed.release.length !== 3) return void 0;
  const release = parsed.release.join(".");
  const prerelease = parsed.prerelease.join(".");
  const label = `${release}-${prerelease}`;
  return prerelease && /^[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*$/.test(prerelease) && redact(label) === label ? label : release;
}
function probeOutputRedactor(adapter, env) {
  const secretValues = adapter.credential_env.map((name) => env[name]).filter((value) => typeof value === "string");
  return (text) => redactText(text, {
    patterns: adapter.redaction_patterns,
    secretValues
  });
}
function probeFailureEntry(adapter, executable, result) {
  if (!result.failure_code) return void 0;
  if (result.failure_code === "PROVIDER_MISSING") {
    return providerEntry(adapter, "missing", {
      executable,
      ...adapter.install_hint ? { install_hint: adapter.install_hint } : {},
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_MISSING: executable failed to start for ${adapter.id}`
      ]
    });
  }
  if (result.failure_code === "PROVIDER_TIMEOUT") {
    return providerEntry(adapter, "unavailable", {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_TIMEOUT: readiness probe timed out after ${result.diagnostics?.timeout_sec ?? "the configured"} seconds`
      ]
    });
  }
  if (result.failure_code === "PROVIDER_OUTPUT_CAP_EXCEEDED") {
    return providerEntry(adapter, "unavailable", {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_OUTPUT_CAP_EXCEEDED: readiness probe exceeded output cap of ${result.diagnostics?.output_bytes?.max ?? "the configured limit"} bytes`
      ]
    });
  }
  return void 0;
}
function providerEntry(adapter, status, options = {}) {
  const diagnostics = mergeProviderDiagnostics(
    options.diagnostics,
    options.warnings
  );
  return {
    id: adapter.id,
    status,
    capabilities: adapter.capabilities,
    ...options.executable ? { executable: options.executable } : {},
    ...options.version ? { version: options.version } : {},
    ...options.install_hint ? { install_hint: options.install_hint } : {},
    ...diagnostics ? { diagnostics } : {}
  };
}
function mergeProviderDiagnostics(diagnostics, warnings) {
  if (!diagnostics && !warnings) return void 0;
  const mergedWarnings = [
    ...diagnostics?.warnings ?? [],
    ...warnings ?? []
  ];
  return {
    ...diagnostics,
    ...mergedWarnings.length > 0 ? { warnings: mergedWarnings } : {}
  };
}
function matchesAny2(value, patterns) {
  return patterns?.some((pattern) => pattern.test(value)) ?? false;
}
function firstNonEmptyLine2(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}
function parseNumericVersion(value) {
  const match = value.match(/\b(\d+(?:\.\d+){2,})\b/);
  if (!match) return void 0;
  return match[1].split(".").map(Number);
}
function compareNumericVersions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}
function formatNumericVersion(version) {
  return version.join(".");
}
var IDENTIFIERS = "[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*";
var VERSION_TOKEN = `v?(\\d+(?:\\.\\d+){2,})(?:-(${IDENTIFIERS}))?(?:\\+(${IDENTIFIERS}))?`;
var OUTPUT_VERSION = new RegExp(
  `(?<![0-9A-Za-z.+-])${VERSION_TOKEN}(?![0-9A-Za-z.+-])`
);
var PIN_VERSION = new RegExp(`^${VERSION_TOKEN}$`);
function parseVersion(value, pattern = OUTPUT_VERSION) {
  const match = value.match(pattern);
  if (!match) return void 0;
  return {
    text: `${match[1]}${match[2] ? `-${match[2]}` : ""}${match[3] ? `+${match[3]}` : ""}`,
    release: match[1].split(".").map(Number),
    prerelease: match[2] ? match[2].split(".") : [],
    build: match[3] ? match[3].split(".") : []
  };
}
function formatVersion(version) {
  const release = version.release.join(".");
  const prerelease = version.prerelease.length > 0 ? `-${version.prerelease.join(".")}` : "";
  const build = version.build.length > 0 ? `+${version.build.join(".")}` : "";
  return `${release}${prerelease}${build}`;
}
function compareVersions(left, right) {
  const release = compareNumericVersions(left.release, right.release);
  if (release !== 0) return release;
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return Math.sign(right.prerelease.length - left.prerelease.length);
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === void 0) return -1;
    if (b === void 0) return 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Math.sign(Number(a) - Number(b));
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}
function satisfiesVersionPin(detected, pin) {
  const bound = (value, accept) => {
    if (value === void 0) return true;
    const parsed = parseVersion(value, PIN_VERSION);
    return parsed !== void 0 && accept(compareVersions(detected, parsed), parsed);
  };
  return bound(pin.exact, (_order, parsed) => detected.text === parsed.text) && bound(pin.min, (order) => order >= 0) && bound(pin.max, (order) => order <= 0);
}
function versionPinError(pin) {
  const bounds = { exact: pin.exact, min: pin.min, max: pin.max };
  const parsed = {};
  for (const [field, value] of Object.entries(bounds)) {
    if (value === void 0) continue;
    const version = parseVersion(value, PIN_VERSION);
    if (!version) return `${field} ${JSON.stringify(value)} is not a version`;
    parsed[field] = version;
  }
  if (parsed.exact && (parsed.min || parsed.max)) {
    return "exact cannot be combined with min or max";
  }
  if (parsed.min && parsed.max && compareVersions(parsed.min, parsed.max) > 0) {
    return `min ${pin.min} is above max ${pin.max}`;
  }
  return void 0;
}
function describeVersionPin(pin) {
  const parts = [
    ...pin.exact !== void 0 ? [`=${pin.exact}`] : [],
    ...pin.min !== void 0 ? [`>=${pin.min}`] : [],
    ...pin.max !== void 0 ? [`<=${pin.max}`] : []
  ];
  return parts.length > 0 ? `version ${parts.join(" ")}` : "version";
}

// src/plugins/consensus/provider-cli/structured-output.ts
import { readFile as readFile2, rm as rm4 } from "node:fs/promises";
import path12 from "node:path";
import { fileURLToPath } from "node:url";

// src/plugins/consensus/provider-cli/continuation.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import path9 from "node:path";
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var NOT_STARTED_FAILURE_CODES = [
  "PROVIDER_MISSING",
  "PROVIDER_ARGV_TOO_LARGE",
  "PROVIDER_AUTH_REQUIRED",
  "PROVIDER_UNSUPPORTED_OPTION",
  "PROVIDER_SESSION_NOT_FOUND"
];
function isProviderSessionId(value) {
  return UUID_PATTERN.test(value);
}
function continuationMode(request) {
  return request.continuation?.mode ?? "new";
}
function continuationUsageError(request, isSessionId) {
  const continuation = request.continuation;
  if (!continuation) return void 0;
  const { mode } = continuation;
  if (continuation.round !== void 0) {
    if (!Number.isInteger(continuation.round) || continuation.round < 1) {
      return "Continuation round must be a positive integer.";
    }
    if (mode === "new" && continuation.round !== 1) {
      return "A new consultation starts at round 1; use --resume or --continuation reconstructed for later rounds.";
    }
    if (mode !== "new" && continuation.round < 2) {
      return "A continuation round must be 2 or greater.";
    }
  }
  if (continuation.consultation_id !== void 0 && continuation.consultation_id.trim() === "") {
    return "Continuation consultation_id must be a non-empty string.";
  }
  if (mode !== "native-resume") {
    if (continuation.session_id !== void 0) {
      return `A ${mode} run cannot target an existing session; use --resume for native resume.`;
    }
    if (continuation.fallback !== void 0 || continuation.fallback_prompt !== void 0) {
      return "Resume fallback options apply only to native resume (--resume).";
    }
  }
  if (mode === "new" && continuation.previous_session_id !== void 0) {
    return "A predecessor session implies a continuation; use --continuation reconstructed.";
  }
  if (mode === "reconstructed" && continuation.previous_session_id !== void 0 && continuation.previous_session_id.trim() === "") {
    return "Previous session id must be a non-empty string.";
  }
  if (mode !== "native-resume") return void 0;
  if (!continuation.session_id) {
    return "Native resume requires an explicit provider session id.";
  }
  if (!isSessionId && !isProviderSessionId(continuation.session_id)) {
    return 'Native resume requires a lowercase provider session UUID, as reported in the continuation receipt; titles, names, and "latest" selectors are not accepted.';
  }
  if (isSessionId && !isSessionId(continuation.session_id)) {
    return 'Native resume requires the provider session id reported in the continuation receipt; titles, names, and "latest" selectors are not accepted.';
  }
  if (continuation.previous_session_id !== void 0) {
    return "Native resume continues the --resume session itself; --previous-session applies only to reconstructed continuation.";
  }
  if ((request.max_attempts ?? 1) > 1) {
    return "Native resume is single-attempt: a failed or malformed turn may already be recorded in the session, so the wrapper never resubmits it.";
  }
  const fallback = continuation.fallback ?? "error";
  const fallbackPrompt = continuation.fallback_prompt;
  if (fallback === "error" && fallbackPrompt !== void 0) {
    return "A fallback prompt requires --resume-fallback reconstructed.";
  }
  if (fallback === "reconstructed") {
    if (!fallbackPrompt || fallbackPrompt.trim() === "") {
      return "Reconstructed fallback requires a continuation packet (--fallback-prompt-file).";
    }
    if (fallbackPrompt.trim() === request.prompt.trim()) {
      return "The fallback continuation packet must carry reconstructed context, not repeat the native follow-up prompt.";
    }
  }
  return void 0;
}
function reconstructedContinuationPrompt(packet, fallbackReason) {
  return [
    "Continuation notice (added by the consensus wrapper):",
    "- This is a NEW provider session. You have no memory of earlier rounds, and no earlier transcript is available to you.",
    "- The host reconstructed the context below from earlier rounds. It is a summary, may be incomplete, and is not the original transcript.",
    ...fallbackReason ? [
      `- A native resume of the earlier session was requested but unavailable (${fallbackReason}).`
    ] : [],
    "- Judge the current candidate on its merits. Name material blockers, explain any disagreement, and state whether the exact candidate is acceptable. You are not obligated to agree.",
    "",
    packet
  ].join("\n");
}
function turnStateFor(trace) {
  if (!trace.process) return "not_started";
  if (trace.turn) return trace.turn;
  if (trace.process.ok) return "completed";
  if (trace.process.stdout.trim() === "" && trace.failure_code && NOT_STARTED_FAILURE_CODES.includes(trace.failure_code)) {
    return "not_started";
  }
  return "unknown";
}
function continuationReceipt(input) {
  const { request, adapter, mode, trace } = input;
  const observation = adapter && trace.process ? adapter.extractSession(trace.process.stdout) : {};
  const continuation = request.continuation;
  const round = continuation?.round ?? (mode === "new" && !input.fallbackReason ? 1 : void 0);
  return {
    mode,
    provider: request.provider,
    ...observation.session_id ? { session_id: observation.session_id } : {},
    ...continuation?.mode === "native-resume" && continuation.session_id ? { requested_session_id: continuation.session_id } : {},
    ...mode === "reconstructed" && previousSessionId(request) ? { previous_session_id: previousSessionId(request) } : {},
    consultation_id: input.consultationId,
    ...round !== void 0 ? { round } : {},
    cwd: path9.resolve(request.cwd ?? process.cwd()),
    ...request.model ? { requested_model: request.model } : {},
    ...input.defaultModel ? { default_model: input.defaultModel } : {},
    ...request.effort ? { requested_effort: request.effort } : {},
    ...observation.observed_models ? { observed_models: observation.observed_models } : {},
    runtime_policy: redactedRuntimePolicyDiagnostics(request.runtime_policy),
    turn: turnStateFor(trace),
    ...input.fallbackReason ? { fallback_reason: input.fallbackReason } : {},
    ...adapter?.capabilities.continuation ? { capability: adapter.capabilities.continuation } : {}
  };
}
function consultationIdFor(request) {
  return request.continuation?.consultation_id ?? randomUUID3();
}
function previousSessionId(request) {
  const continuation = request.continuation;
  if (!continuation) return void 0;
  return continuation.mode === "native-resume" ? continuation.session_id : continuation.previous_session_id;
}

// src/plugins/consensus/provider-cli/submit-capture.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import path10 from "node:path";
var DEFAULT_SUBMIT_CAPTURE_MAX_BYTES = 1024 * 1024 * 10;
var CONSENSUS_SUBMIT_MAX_BYTES_ENV = "CONSENSUS_SUBMIT_MAX_BYTES";
var CONSENSUS_SUBMIT_CAPTURE_DIR = ".consensus/submit";
var SubmitCaptureLimitError = class extends Error {
  bytes;
  maxBytes;
  constructor(bytes, maxBytes) {
    super(submitCaptureLimitMessage(bytes, maxBytes));
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
};
function submitCaptureMaxBytes(maxOutputBytes) {
  return maxOutputBytes ?? DEFAULT_SUBMIT_CAPTURE_MAX_BYTES;
}
function parseSubmitCaptureMaxBytes(value) {
  if (value === void 0 || value === "") {
    return DEFAULT_SUBMIT_CAPTURE_MAX_BYTES;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return void 0;
  }
  return parsed;
}
function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}
function assertWithinSubmitCaptureLimit(value, maxBytes) {
  const bytes = byteLength(value);
  if (bytes > maxBytes) {
    throw new SubmitCaptureLimitError(bytes, maxBytes);
  }
}
function submitCaptureLimitMessage(bytes, maxBytes) {
  return `Submitted verdict exceeds submit capture limit of ${maxBytes} bytes (${bytes} bytes).`;
}
function submitCaptureDirectory(cwd) {
  return path10.resolve(cwd, CONSENSUS_SUBMIT_CAPTURE_DIR);
}
function submitCaptureFilePath(cwd, id = randomUUID4()) {
  return path10.join(submitCaptureDirectory(cwd), `consensus-submit-${id}.json`);
}

// src/plugins/consensus/provider-cli/working-tree.ts
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readlink } from "node:fs/promises";
import path11 from "node:path";
var GIT_TIMEOUT_MS = 3e4;
var GIT_MAX_BUFFER = 64 * 1024 * 1024;
var MAX_LISTED_PATHS = 20;
var TRUTHFUL_STATUS_CONFIG = [
  "--no-optional-locks",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
  "-c",
  "core.filemode=true"
];
async function snapshotWorkingTree(cwd, options = {}) {
  const git = gitRunner(cwd, options);
  try {
    const env = await git.cleanEnv();
    const inside = await git.run(env, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.trim() !== "true") {
      return { ok: false, message: `${cwd} is not inside a git work tree` };
    }
    const root = (await git.run(env, ["rev-parse", "--show-toplevel"])).trim();
    const head = (await git.run(env, ["rev-parse", "--verify", "--quiet", "HEAD"], {
      allowExit: [1]
    })).trim();
    const raw = await git.run(env, [
      ...TRUTHFUL_STATUS_CONFIG,
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--ignored=no"
    ]);
    const status = parsePorcelainZ(raw);
    const hidden = parseHiddenIndexEntries(
      await git.run(env, [...TRUTHFUL_STATUS_CONFIG, "ls-files", "-v", "-z"])
    );
    const content = /* @__PURE__ */ new Map();
    for (const file of /* @__PURE__ */ new Set([...status.keys(), ...hidden])) {
      content.set(file, await fingerprint(path11.join(root, file)));
    }
    const exclude = path11.resolve(
      cwd,
      (await git.run(env, ["rev-parse", "--git-path", "info/exclude"])).trim()
    );
    const excludeKey = path11.relative(root, exclude).startsWith("..") ? exclude : path11.relative(root, exclude);
    content.set(excludeKey, await fingerprint(exclude));
    return { ok: true, snapshot: { root, head, status, content } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
function compareWorkingTrees(before, after) {
  const paths = /* @__PURE__ */ new Set();
  for (const file of /* @__PURE__ */ new Set([
    ...before.status.keys(),
    ...after.status.keys(),
    ...before.content.keys(),
    ...after.content.keys()
  ])) {
    if (before.status.get(file) !== after.status.get(file) || before.content.get(file) !== after.content.get(file)) {
      paths.add(file);
    }
  }
  return {
    head_changed: before.head !== after.head,
    paths: [...paths].toSorted()
  };
}
function hasWorkingTreeChanges(changes) {
  return changes.head_changed || changes.paths.length > 0;
}
function workingTreeChangeList(changes) {
  return [...changes.head_changed ? ["HEAD"] : [], ...changes.paths];
}
function describeWorkingTreeChanges(changes) {
  const list = workingTreeChangeList(changes);
  const shown = list.slice(0, MAX_LISTED_PATHS).join(", ");
  const more = list.length > MAX_LISTED_PATHS ? ` and ${list.length - MAX_LISTED_PATHS} more` : "";
  return `${shown}${more}`;
}
function parsePorcelainZ(raw) {
  const status = /* @__PURE__ */ new Map();
  const tokens = raw.split("\0");
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 4) continue;
    const code = token.slice(0, 2);
    status.set(token.slice(3), code);
    if (code.includes("R") || code.includes("C")) {
      const source = tokens[index + 1];
      if (source) status.set(source, `${code}<`);
      index += 1;
    }
  }
  return status;
}
function parseHiddenIndexEntries(raw) {
  const hidden = [];
  for (const entry of raw.split("\0")) {
    if (entry.length < 3) continue;
    const tag = entry[0];
    if (tag === "S" || tag >= "a" && tag <= "z") hidden.push(entry.slice(2));
  }
  return hidden;
}
async function fingerprint(file) {
  let stats;
  try {
    stats = await lstat(file);
  } catch (error) {
    if (isMissing(error)) return "deleted";
    throw error;
  }
  if (stats.isSymbolicLink()) {
    return `link:${sha256(await readlink(file))}`;
  }
  if (stats.isDirectory()) return "dir";
  return hashFile(file);
}
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", (error) => {
      if (isMissing(error)) resolve("deleted");
      else reject(error);
    }).on("end", () => resolve(hash.digest("hex")));
  });
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function isMissing(error) {
  const code = error?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}
function gitRunner(cwd, options) {
  const command = options.git ?? "git";
  const base = options.env ?? process.env;
  const run = (env, args, runOptions = {}) => new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd,
        env,
        encoding: "utf8",
        maxBuffer: GIT_MAX_BUFFER,
        timeout: GIT_TIMEOUT_MS,
        shell: false,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === "number" ? error.code : void 0;
        if (!error || runOptions.allowExit?.includes(exitCode ?? -1)) {
          resolve(error ? "" : stdout);
          return;
        }
        const detail = String(stderr).trim().split(/\r?\n/)[0] || error.message;
        reject(
          new Error(
            `git ${args.filter((arg) => !TRUTHFUL_STATUS_CONFIG.includes(arg)).join(" ")} failed${detail ? `: ${detail}` : ""}`
          )
        );
      }
    );
  });
  return {
    run,
    // Drops the variables git itself names as repository-local.
    async cleanEnv() {
      const names = await run(base, ["rev-parse", "--local-env-vars"]);
      const env = { ...base, GIT_OPTIONAL_LOCKS: "0" };
      for (const name of names.split(/\r?\n/)) {
        if (name) delete env[name];
      }
      return env;
    }
  };
}

// src/plugins/consensus/provider-cli/structured-output.ts
function selectStructuredOutputStrategy(adapter, options = {}) {
  if (options.output === "text") return "text";
  if (options.strategy) return options.strategy;
  if (options.submitCaptureEnabled && adapter.capabilities.schema_strategies.includes("constrained_native") && adapter.capabilities.schema_strategies.includes("prompt_only")) {
    return "prompt_only";
  }
  if (adapter.capabilities.schema_strategies.includes("constrained_native")) {
    return "constrained_native";
  }
  if (adapter.capabilities.schema_strategies.includes("provider_validated")) {
    return "provider_validated";
  }
  return "prompt_only";
}
async function runProviderTurn(request, dependencies = {}) {
  const registry = dependencies.registry ?? providerRegistry();
  const adapter = registry.get(request.provider);
  const consultationId = consultationIdFor(request);
  const mode = continuationMode(request);
  let defaultModel;
  const withReceipt = (envelope2, receiptMode, trace2, fallbackReason) => ({
    ...envelope2,
    continuation: continuationReceipt({
      request,
      adapter,
      mode: receiptMode,
      consultationId,
      trace: trace2,
      fallbackReason,
      defaultModel
    })
  });
  if (adapter?.not_admitted_reason) {
    return withReceipt(
      preInvocationFailure({
        provider: request.provider,
        code: "PROVIDER_UNSUPPORTED",
        message: `Provider ${request.provider} is registered but not admitted: ${adapter.not_admitted_reason}`,
        terminalReason: "provider_not_admitted"
      }),
      mode,
      {}
    );
  }
  const usageError = continuationUsageError(request, adapter?.isSessionId);
  if (usageError) {
    return withReceipt(
      preInvocationFailure({
        provider: request.provider,
        code: "CONSENSUS_CLI_USAGE",
        message: usageError,
        terminalReason: "continuation_usage"
      }),
      mode,
      {}
    );
  }
  let turnRequest = request;
  if (adapter?.tier === "extended") {
    const model = await extendedProviderModel(request, dependencies);
    if (!model.ok) {
      return withReceipt(
        preInvocationFailure({
          provider: request.provider,
          code: model.code,
          message: model.message,
          terminalReason: model.terminalReason
        }),
        mode,
        {}
      );
    }
    defaultModel = model.defaultModel;
    turnRequest = { ...request, model: model.model };
  }
  const runTurn = adapter?.tier === "extended" ? runCheckedExtendedTurn : runStructuredTurn;
  const continuation = request.continuation;
  const runReconstructed = async (packet, fallbackReason, rejected) => {
    const trace2 = {};
    const envelope2 = await runTurn(
      {
        ...turnRequest,
        prompt: reconstructedContinuationPrompt(packet, fallbackReason)
      },
      dependencies,
      trace2
    );
    return withReceipt(
      rejected ? withRejectedResume(envelope2, rejected) : envelope2,
      "reconstructed",
      trace2,
      fallbackReason
    );
  };
  if (mode === "reconstructed") {
    return runReconstructed(request.prompt);
  }
  if (mode !== "native-resume" || !continuation?.session_id) {
    const trace2 = {};
    const envelope2 = await runTurn(turnRequest, dependencies, trace2);
    return withReceipt(envelope2, "new", trace2);
  }
  const requestedSessionId = continuation.session_id;
  const fallbackPacket = continuation.fallback === "reconstructed" ? continuation.fallback_prompt : void 0;
  const resumeStatus = adapter?.capabilities.continuation?.native_resume;
  if (adapter && resumeStatus !== "verified") {
    const reason = `native_resume_${resumeStatus ?? "unsupported"}`;
    if (fallbackPacket) return runReconstructed(fallbackPacket, reason);
    return withReceipt(
      preInvocationFailure({
        provider: request.provider,
        code: "PROVIDER_UNSUPPORTED_OPTION",
        message: `Native resume is ${resumeStatus ?? "unsupported"} for provider ${request.provider}; use --resume-fallback reconstructed with a continuation packet, or --continuation reconstructed.`,
        terminalReason: reason
      }),
      "native-resume",
      {}
    );
  }
  const trace = {};
  const envelope = await runTurn(turnRequest, dependencies, trace, {
    resumeSessionId: requestedSessionId
  });
  const receipt = continuationReceipt({
    request,
    adapter,
    mode: "native-resume",
    consultationId,
    trace,
    defaultModel
  });
  if (!envelope.ok && envelope.code === "PROVIDER_SESSION_NOT_FOUND" && receipt.turn === "not_started" && fallbackPacket) {
    return runReconstructed(fallbackPacket, "session_not_found", envelope);
  }
  if (receipt.turn === "completed" && receipt.session_id !== requestedSessionId) {
    return {
      ...failureEnvelope({
        provider: request.provider,
        code: "PROVIDER_SESSION_MISMATCH",
        message: receipt.session_id ? `Provider reported session ${receipt.session_id} instead of the requested ${requestedSessionId}; the turn was not a native resume.` : `Provider output did not confirm the requested session ${requestedSessionId}.`,
        retryable: false,
        stdout: envelope.stdout,
        stderr: envelope.stderr,
        attempts: {
          cli_attempts: envelope.attempts.cli_attempts,
          terminal_reason: "provider_session_mismatch"
        },
        diagnostics: envelope.diagnostics
      }),
      continuation: receipt
    };
  }
  return { ...envelope, continuation: receipt };
}
function withRejectedResume(envelope, rejected) {
  const note = `Native resume was rejected (${rejected.ok ? "ok" : rejected.code}) before a turn started; a reconstructed session answered instead.`;
  return {
    ...envelope,
    attempts: {
      ...envelope.attempts,
      cli_attempts: envelope.attempts.cli_attempts + rejected.attempts.cli_attempts
    },
    diagnostics: {
      ...envelope.diagnostics,
      warnings: [...envelope.diagnostics?.warnings ?? [], note]
    }
  };
}
async function extendedProviderModel(request, dependencies) {
  if (request.model) return { ok: true, model: request.model };
  let configured;
  try {
    configured = await resolveProviderDefaultModel({
      provider: request.provider,
      cwd: request.cwd ?? process.cwd(),
      env: dependencies.parentEnv ?? process.env
    });
  } catch (error) {
    return {
      ok: false,
      code: "CONSENSUS_CLI_USAGE",
      message: `Could not read the consensus config for the ${request.provider} default model: ${error instanceof Error ? error.message : String(error)}`,
      terminalReason: "consensus_config_invalid"
    };
  }
  if (configured) {
    return {
      ok: true,
      model: configured.model,
      defaultModel: configured.model
    };
  }
  return {
    ok: false,
    code: "PROVIDER_UNSUPPORTED_OPTION",
    message: `${request.provider} needs a model: pass --model or set defaults.provider_models.${request.provider}.`,
    terminalReason: "model_required"
  };
}
async function runCheckedExtendedTurn(request, dependencies, trace, turnOptions = {}) {
  if (defaultRuntimePolicy(request.runtime_policy).permission_mode !== "read-only") {
    return runStructuredTurn(request, dependencies, trace, turnOptions);
  }
  const cwd = path12.resolve(request.cwd ?? process.cwd());
  const env = dependencies.parentEnv ?? process.env;
  const adapter = (dependencies.registry ?? providerRegistry()).get(
    request.provider
  );
  const redact = (text) => redactText(text, {
    patterns: adapter?.redaction_patterns,
    secretValues: (adapter?.credential_env ?? []).map((name) => env[name]).filter((value) => typeof value === "string")
  });
  const before = await snapshotWorkingTree(cwd, { env });
  if (!before.ok) {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_UNSUPPORTED_OPTION",
      message: `Extended read-only runs need a git checkout so the working tree can be checked before and after the turn: ${redact(before.message)}`,
      terminalReason: "working_tree_unavailable"
    });
  }
  const envelope = await runStructuredTurn(
    request,
    dependencies,
    trace,
    turnOptions
  );
  if (!trace.process) return envelope;
  const after = await snapshotWorkingTree(cwd, { env });
  const found = after.ok ? compareWorkingTrees(before.snapshot, after.snapshot) : void 0;
  if (found && !hasWorkingTreeChanges(found)) return envelope;
  const changes = found && { ...found, paths: found.paths.map(redact) };
  const outcome = envelope.ok ? "succeeded" : `failed with ${envelope.code}`;
  const message = after.ok ? `The working tree changed during a read-only ${request.provider} run: ${describeWorkingTreeChanges(changes)}. Review and revert these changes; the turn ${outcome}.` : `The working tree could not be re-checked after a read-only ${request.provider} run (${redact(after.message)}); treat it as changed and review it. The turn ${outcome}.`;
  return failureEnvelope({
    provider: request.provider,
    code: "PROVIDER_WORKTREE_CHANGED",
    message,
    retryable: false,
    stdout: envelope.stdout,
    stderr: envelope.stderr,
    attempts: {
      cli_attempts: envelope.attempts.cli_attempts,
      terminal_reason: "working_tree_changed"
    },
    diagnostics: {
      ...envelope.diagnostics,
      ...changes ? { working_tree_changes: workingTreeChangeList(changes) } : {}
    }
  });
}
async function runStructuredTurn(request, dependencies, trace, turnOptions = {}) {
  const registry = dependencies.registry ?? providerRegistry();
  const adapter = registry.get(request.provider);
  if (!adapter) {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_UNSUPPORTED",
      message: `Provider is not supported: ${request.provider}`,
      terminalReason: "unsupported_provider"
    });
  }
  const optionValidation = validateProviderOptions(request, adapter);
  if (!optionValidation.ok) {
    return preInvocationFailure({
      provider: request.provider,
      code: optionValidation.code,
      message: optionValidation.message,
      terminalReason: optionValidation.option
    });
  }
  const hostGuard = evaluateHostGuard({
    host: request.host,
    provider: request.provider
  });
  if (!hostGuard.allowed) {
    return preInvocationFailure({
      provider: request.provider,
      code: hostGuard.code,
      message: hostGuard.message,
      terminalReason: "host_recursion_blocked",
      diagnostics: hostGuard.diagnostics
    });
  }
  const textMode = request.output === "text";
  const schemaPath = request.schema_path;
  if (textMode && schemaPath !== void 0) {
    return preInvocationFailure({
      provider: request.provider,
      code: "CONSENSUS_CLI_USAGE",
      message: "Text output does not accept a schema path.",
      terminalReason: "schema_with_text_output"
    });
  }
  let schema;
  let inlineJsonSchema;
  if (!textMode) {
    if (!schemaPath) {
      return preInvocationFailure({
        provider: request.provider,
        code: "CONSENSUS_CLI_USAGE",
        message: "JSON output requires a schema path.",
        terminalReason: "schema_missing"
      });
    }
    const readSchema = dependencies.readSchema ?? readJsonSchema;
    try {
      schema = await readSchema(schemaPath);
    } catch (error) {
      return preInvocationFailure({
        provider: request.provider,
        code: "CONSENSUS_CLI_USAGE",
        message: `Could not read schema: ${error instanceof Error ? error.message : String(error)}`,
        terminalReason: "schema_read_failed"
      });
    }
    inlineJsonSchema = JSON.stringify(schema);
    if (inlineJsonSchema === void 0) {
      return preInvocationFailure({
        provider: request.provider,
        code: "CONSENSUS_CLI_USAGE",
        message: "Schema must be JSON-serializable.",
        terminalReason: "schema_read_failed"
      });
    }
  }
  const effectiveRequest = {
    ...request,
    runtime_policy: defaultRuntimePolicy(request.runtime_policy)
  };
  const maxAttempts = effectiveRequest.max_attempts ?? 1;
  const submitCaptureEnabled = !textMode && (dependencies.transport?.submitCaptureEnabled ?? true) && (adapter.submitCaptureEligible?.(request) ?? true);
  const strategy = selectStructuredOutputStrategy(adapter, {
    output: request.output,
    submitCaptureEnabled,
    strategy: dependencies.transport?.strategy
  });
  if (!adapter.capabilities.schema_strategies.includes(strategy) || !textMode && strategy === "text") {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_UNSUPPORTED_OPTION",
      message: `Provider does not support structured-output strategy: ${strategy}.`,
      terminalReason: "structured_output_strategy"
    });
  }
  const runSubprocess = adapter.run ?? dependencies.runSubprocess ?? runProviderSubprocess;
  const parentEnv = dependencies.parentEnv ?? process.env;
  const resolvedExecutable = resolveProviderExecutable(adapter, parentEnv);
  if (!resolvedExecutable.ok) {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_MISSING",
      message: resolvedExecutable.message,
      terminalReason: "provider_executable_invalid"
    });
  }
  const finder = dependencies.probeRunner ?? nodeProbeCommandRunner(parentEnv);
  let prerequisiteExecutables;
  if (adapter.probe.prerequisites?.length) {
    const prerequisites = await checkProviderPrerequisites(adapter, finder);
    if (!prerequisites.ok) {
      const prerequisite = prerequisites.failure;
      return preInvocationFailure({
        provider: request.provider,
        code: PREREQUISITE_FAILURE_CODES[prerequisite.status],
        message: withInstallHint(
          prerequisite.message,
          prerequisite.install_hint
        ),
        terminalReason: `provider_prerequisite_${prerequisite.status}`,
        diagnostics: { warnings: [prerequisite.warning] }
      });
    }
    prerequisiteExecutables = prerequisites.executables;
  }
  const executable = await finder.findExecutable(resolvedExecutable.executable);
  if (!executable || !path12.isAbsolute(executable)) {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_MISSING",
      message: withInstallHint(
        `Provider executable not found: ${resolvedExecutable.executable}`,
        adapter.install_hint
      ),
      terminalReason: "provider_missing",
      diagnostics: hostGuard.diagnostics
    });
  }
  const submitCapturePath = submitCaptureEnabled ? submitCaptureFilePath(effectiveRequest.cwd ?? process.cwd()) : void 0;
  const maxSubmitBytes = submitCaptureMaxBytes(request.max_output_bytes);
  const submitCommand = submitCaptureEnabled ? dependencies.submitCommand ?? buildConsensusSubmitCommand() : void 0;
  const childEnv = buildChildEnvironment({
    parentEnv,
    request: effectiveRequest,
    credentialEnv: adapter.credential_env,
    executableOverrideEnv: providerExecutableEnvNames(registry),
    hostEnv: {
      ...hostGuard.child_env,
      ...submitCaptureEnabled && submitCommand && submitCapturePath && schemaPath ? {
        CONSENSUS_SUBMIT_COMMAND: submitCommand,
        CONSENSUS_SUBMIT_FILE: submitCapturePath,
        [CONSENSUS_SUBMIT_MAX_BYTES_ENV]: String(maxSubmitBytes),
        CONSENSUS_SUBMIT_SCHEMA: path12.resolve(schemaPath)
      } : {}
    }
  });
  let validationFeedback;
  let lastInvocation;
  let exitClassification;
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (submitCapturePath) {
        await cleanupSubmitCaptureFile(submitCapturePath);
      }
      const invocationRequest = {
        ...effectiveRequest,
        prompt: textMode || inlineJsonSchema === void 0 ? request.prompt : promptForStrategy({
          prompt: request.prompt,
          strategy,
          inlineJsonSchema,
          submitCaptureEnabled,
          submitCommand,
          validationFeedback
        })
      };
      const invocation2 = buildProviderInvocation(adapter, invocationRequest, {
        strategy,
        inlineJsonSchema,
        lastMessageFile: dependencies.transport?.lastMessageFile,
        preserveLastMessageFile: dependencies.transport?.preserveLastMessageFile,
        resumeSessionId: turnOptions.resumeSessionId,
        executable,
        ...prerequisiteExecutables ? { prerequisiteExecutables } : {}
      });
      lastInvocation = invocation2;
      const processResult = await runSubprocess(invocation2, {
        env: childEnv,
        maxOutputBytes: request.max_output_bytes,
        timeoutSec: request.max_runtime_sec
      });
      trace.process = processResult;
      trace.failure_code = void 0;
      trace.turn = void 0;
      const diagnostics = mergeDiagnostics(
        {
          strategy_used: strategy,
          output_mode: invocation2.output_mode,
          redacted_command: invocation2.redacted_command,
          ...invocation2.permission_profile ? { permission_profile: invocation2.permission_profile } : {}
        },
        hostGuard.diagnostics,
        processResult.diagnostics,
        permissionDenialDiagnostics(adapter, processResult.stdout),
        exitClassificationDiagnostics(exitClassification)
      );
      const reportedFailure = processResult.ok || processResult.code === "PROVIDER_EXIT" && !processResult.signal && !processResult.diagnostics?.termination ? adapter.classifyReportedFailure?.(processResult.stdout) : void 0;
      if (!processResult.ok || reportedFailure) {
        const classification = processResult.ok ? reportedFailure : reportedFailure ?? adapter.classifyRunFailure(processResult);
        trace.turn = classification.turn ? attempt === 1 ? classification.turn : "unknown" : void 0;
        trace.failure_code = classification.code;
        exitClassification = classification.exit_classification;
        const failureDiagnostics = mergeDiagnostics(
          diagnostics,
          exitClassificationDiagnostics(exitClassification)
        );
        if (classification.retryable && attempt < maxAttempts) {
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: classification.code,
          // The binary was found but could not be started (removed or
          // replaced after lookup): keep the install hint here too.
          message: classification.code === "PROVIDER_MISSING" ? withInstallHint(classification.message, adapter.install_hint) : classification.message,
          retryable: false,
          stdout: envelopeStdout(adapter, processResult.stdout),
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: classification.terminal_reason
          },
          diagnostics: failureDiagnostics
        });
      }
      if (textMode) {
        const extracted = (adapter.extractText ?? extractProviderResultText)(
          invocation2,
          processResult
        );
        if (!extracted.ok) {
          return failureEnvelope({
            provider: request.provider,
            code: extracted.code,
            message: extracted.message,
            retryable: false,
            stdout: envelopeStdout(adapter, processResult.stdout),
            stderr: processResult.stderr,
            attempts: {
              cli_attempts: attempt,
              terminal_reason: extracted.terminal_reason
            },
            diagnostics
          });
        }
        return textSuccessEnvelope({
          provider: request.provider,
          args: invocation2.redacted_command,
          stdout: extracted.raw,
          stderr: processResult.stderr,
          text: extracted.text,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "success"
          },
          diagnostics
        });
      }
      const submittedVerdict = submitCapturePath ? await readSubmittedVerdict(submitCapturePath, schema, maxSubmitBytes) : { ok: false };
      if (submittedVerdict.ok) {
        return successEnvelope({
          provider: request.provider,
          args: invocation2.redacted_command,
          stdout: submittedVerdict.raw,
          stderr: processResult.stderr,
          json: submittedVerdict.value,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "success"
          },
          diagnostics: mergeDiagnostics(diagnostics, {
            verdict_source: "submit"
          })
        });
      }
      const providerOutput = extractProviderOutput(invocation2, processResult);
      const finalMessageDiagnostics = mergeDiagnostics(diagnostics, {
        verdict_source: "final_message"
      });
      if (!providerOutput.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = providerOutput.message;
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: "PROVIDER_INVALID_JSON",
          message: providerOutput.message,
          retryable: false,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "missing_provider_output"
          },
          diagnostics: finalMessageDiagnostics
        });
      }
      const parsed = parseProviderJson(providerOutput.value);
      if (!parsed.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = parsed.message;
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: "PROVIDER_INVALID_JSON",
          message: parsed.message,
          retryable: false,
          stdout: providerOutput.value,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "invalid_json"
          },
          diagnostics: finalMessageDiagnostics
        });
      }
      const verdictJson = (adapter.extractStructuredValue ?? extractStructuredJsonValue)(parsed.value);
      const validation = validateSchemaSubset(verdictJson, schema);
      if (!validation.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = validation.message;
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: "PROVIDER_SCHEMA_VALIDATION",
          message: validation.message,
          retryable: false,
          stdout: providerOutput.value,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "schema_validation"
          },
          diagnostics: finalMessageDiagnostics
        });
      }
      return successEnvelope({
        provider: request.provider,
        args: invocation2.redacted_command,
        stdout: providerOutput.value,
        stderr: processResult.stderr,
        json: verdictJson,
        attempts: {
          cli_attempts: attempt,
          terminal_reason: "success"
        },
        diagnostics: finalMessageDiagnostics
      });
    }
    return failureEnvelope({
      provider: request.provider,
      code: "PROVIDER_EXIT",
      message: "Provider run ended without a terminal result.",
      retryable: false,
      attempts: {
        cli_attempts: maxAttempts,
        terminal_reason: "attempt_budget_exhausted"
      },
      diagnostics: lastInvocation ? {
        strategy_used: strategy,
        output_mode: lastInvocation.output_mode,
        redacted_command: lastInvocation.redacted_command
      } : void 0
    });
  } finally {
    if (submitCapturePath) {
      await cleanupSubmitCaptureFile(submitCapturePath);
    }
  }
}
function envelopeStdout(adapter, stdout) {
  return adapter.envelopeStdout ? adapter.envelopeStdout(stdout) : stdout;
}
function permissionDenialDiagnostics(adapter, stdout) {
  const denials = adapter.extractPermissionDenials?.(stdout);
  if (!denials) return void 0;
  return {
    permission_denials: denials,
    warnings: [
      `${adapter.display_name} reported ${denials.count} denied tool call(s); verify task completeness independently of schema and transport success.`
    ]
  };
}
async function readJsonSchema(schemaPath) {
  return JSON.parse(await readFile2(schemaPath, "utf8"));
}
function withInstallHint(message, installHint) {
  if (!installHint) return message;
  return `${message.endsWith(".") ? message : `${message}.`} Install hint: ${installHint}`;
}
var PREREQUISITE_FAILURE_CODES = {
  missing: "PROVIDER_MISSING",
  unsupported: "PROVIDER_UNSUPPORTED",
  unavailable: "PROVIDER_UNAVAILABLE"
};
function preInvocationFailure(input) {
  return failureEnvelope({
    provider: input.provider,
    code: input.code,
    message: input.message,
    retryable: false,
    attempts: {
      cli_attempts: 0,
      terminal_reason: input.terminalReason
    },
    diagnostics: input.diagnostics
  });
}
function extractProviderOutput(invocation2, result) {
  if (invocation2.output_mode !== "last_message_file") {
    return { ok: true, value: result.stdout };
  }
  if (result.ok && result.last_message?.trim()) {
    return { ok: true, value: result.last_message };
  }
  return {
    ok: false,
    message: "Provider did not write a last-message file response."
  };
}
function parseProviderJson(stdout) {
  try {
    return { ok: true, value: JSON.parse(stdout.trim()) };
  } catch (error) {
    return {
      ok: false,
      message: `Provider returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
async function readSubmittedVerdict(filePath, schema, maxBytes) {
  const capture = await readBoundedRegularFile(filePath, maxBytes);
  if (!capture.ok) return { ok: false };
  const raw = capture.contents;
  try {
    assertWithinSubmitCaptureLimit(raw, maxBytes);
  } catch {
    return { ok: false };
  }
  if (!raw.trim()) return { ok: false };
  const parsed = parseProviderJson(raw);
  if (!parsed.ok) return { ok: false };
  const validation = validateSchemaSubset(parsed.value, schema);
  if (!validation.ok) return { ok: false };
  return { ok: true, raw, value: parsed.value };
}
async function cleanupSubmitCaptureFile(filePath) {
  try {
    await rm4(filePath, { force: true });
  } catch {
  }
}
function promptForStrategy(input) {
  const parts = [input.prompt];
  if (input.submitCaptureEnabled) {
    const submitCommand = input.submitCommand ?? buildConsensusSubmitCommand();
    parts.push(
      "Verdict submission:",
      "Before ending the turn, submit the final verdict by running this exact command and passing the JSON verdict on stdin:",
      `\`${submitCommand}\``,
      "The same command is injected as CONSENSUS_SUBMIT_COMMAND; do not substitute a bare `consensus` executable.",
      "The command validates against the active schema from CONSENSUS_SUBMIT_SCHEMA and captures to CONSENSUS_SUBMIT_FILE.",
      "If submission fails, fix the reported schema error and run the command again.",
      "Also keep the final-message JSON fallback: end with only the same JSON object matching the schema."
    );
  }
  if (input.validationFeedback) {
    parts.push(
      `Schema validation failed: ${input.validationFeedback}`,
      "Return only JSON matching the schema."
    );
  }
  if (input.strategy === "prompt_only") {
    parts.push(
      "Structured output requirements:",
      "Return only one JSON object matching this JSON Schema.",
      "Do not wrap the JSON in Markdown.",
      "Do not include prose before or after the JSON object.",
      "<JSON_SCHEMA>",
      input.inlineJsonSchema,
      "</JSON_SCHEMA>"
    );
  }
  return parts.join("\n\n");
}
function mergeDiagnostics(...diagnostics) {
  const merged = {};
  const warnings = [];
  for (const item of diagnostics) {
    if (!item) continue;
    Object.assign(merged, item);
    if (item.warnings) warnings.push(...item.warnings);
  }
  if (warnings.length > 0) merged.warnings = warnings;
  return merged;
}
function exitClassificationDiagnostics(exitClassification) {
  return exitClassification ? { exit_classification: exitClassification } : void 0;
}
function buildConsensusSubmitCommand(input = {}) {
  const nodePath = input.nodePath ?? process.execPath;
  const cliPath = input.cliPath ?? currentConsensusCliPath();
  return `${shellQuote(nodePath)} ${shellQuote(cliPath)} submit --json -`;
}
function currentConsensusCliPath() {
  if (process.argv[1]) return path12.resolve(process.argv[1]);
  return fileURLToPath(import.meta.url);
}
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// src/plugins/consensus/provider-cli/commands.ts
function helpText() {
  return `Usage: consensus <command> --json

Commands:
  config get --json [--scope user|project|effective] [--workflow convergence|panel|review] [--cwd <path>]
  config list --json [--cwd <path>]
  config set --json --scope user|project [--peers <a,b>] [--panelists <a,b,c>] [--reviewers <a,b>]
      [--panel-size <n>] [--from-file <path>] [--cwd <path>]
  config clear --json --scope user|project [--key peers|panelists|panel-size|reviewers|roles|all] [--cwd <path>]
  provider ls --json
  preflight --json --provider <id> --capability run [--capability <name>] [--max-depth <n>]
  submit --json [-|--verdict-file <path>] [--schema <path>] [--out <path>]
  run --provider <id> (--schema <path> [--output json] | --output text) --json
      [-|--prompt <text>|--prompt-file <path>]
      [--model <name>] [--effort <level>]
      [--permission-mode <mode>] [--sandbox <name>] [--approval-policy <policy>]
      Claude-only grants, each repeatable except --allow-web-search:
        [--allow-read <absolute-file>] [--allow-edit <absolute-file>]
        [--allow-bash <command-pattern>]
        [--allow-web-search] [--allow-web-fetch-domain <domain>]
      [--env-allow <name>] [--max-attempts <n>] [--timeout-sec <n>]
      [--max-output-bytes <n>] [--cwd <path>] [--max-depth <n>]
      [--consultation-id <id>] [--round <n>]
      [--resume <session-uuid> [--resume-fallback error|reconstructed]
        [--fallback-prompt-file <path>]]
      [--continuation new|reconstructed [--previous-session <id>]]
  run --request-json <path|-> --json
`;
}
async function runProviderList(options = {}) {
  return {
    schema_version: "v1",
    ok: true,
    providers: await resolveRegistry(options.registry, options)
  };
}
async function runPreflight(options) {
  const registry = await resolveRegistry(
    options.registry,
    options,
    options.provider,
    options.capabilities
  );
  const providers = applyHostGuardToProviders(
    selectProviders(registry, options.provider),
    options.host
  );
  const usable = providers.every((provider) => provider.status === "ready");
  const diagnostics = options.provider && !registry.some((entry) => entry.id === options.provider) ? {
    warnings: [
      `Requested provider is not registered: ${options.provider}`
    ]
  } : void 0;
  return {
    schema_version: "v1",
    ok: true,
    usable,
    providers,
    ...diagnostics ? { diagnostics } : {}
  };
}
async function runSubmit(command, io) {
  const schemaPath = command.schemaPath ?? io.env?.CONSENSUS_SUBMIT_SCHEMA;
  if (!schemaPath) {
    return submitFailure(io, "Missing submit schema path.", 2);
  }
  const outPath = command.outPath ?? io.env?.CONSENSUS_SUBMIT_FILE;
  if (!outPath) {
    return submitFailure(io, "Missing submit output path.", 2);
  }
  if (!command.verdictSource) {
    return submitFailure(io, "Missing verdict source.", 2);
  }
  if (command.verdictSource.kind === "prompt") {
    return submitFailure(
      io,
      "Submit verdict source must be stdin or --verdict-file.",
      2
    );
  }
  const maxSubmitBytes = parseSubmitCaptureMaxBytes(
    io.env?.[CONSENSUS_SUBMIT_MAX_BYTES_ENV]
  );
  if (maxSubmitBytes === void 0) {
    return submitFailure(io, "Invalid submit capture byte limit.", 2);
  }
  let schema;
  try {
    schema = JSON.parse(await io.readFile(schemaPath));
  } catch (error) {
    return submitFailure(
      io,
      `Could not read submit schema: ${error instanceof Error ? error.message : String(error)}`,
      2
    );
  }
  let rawVerdict;
  try {
    rawVerdict = await readSubmitSource(
      command.verdictSource,
      io,
      maxSubmitBytes
    );
    assertWithinSubmitCaptureLimit(rawVerdict, maxSubmitBytes);
  } catch (error) {
    return submitFailure(
      io,
      error instanceof Error ? error.message : String(error),
      1
    );
  }
  let verdict;
  try {
    verdict = JSON.parse(rawVerdict);
  } catch (error) {
    return submitFailure(
      io,
      `Submitted verdict must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
  }
  const validation = validateSchemaSubset(verdict, schema);
  if (!validation.ok) {
    return submitFailure(io, validation.message, 1);
  }
  const captureContents = `${JSON.stringify(verdict)}
`;
  try {
    assertWithinSubmitCaptureLimit(captureContents, maxSubmitBytes);
  } catch (error) {
    return submitFailure(
      io,
      error instanceof SubmitCaptureLimitError ? error.message : `Could not size submit capture: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
  }
  try {
    await (io.writeSubmitCapture ?? writeJsonFileAtomic)(
      outPath,
      captureContents
    );
  } catch (error) {
    return submitFailure(
      io,
      `Could not write submit capture: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
  }
  writeJson(io, {
    schema_version: "v1",
    ok: true,
    captured: true,
    message: "verdict captured"
  });
  return 0;
}
async function runConsensusCli(argv, io, options = {}) {
  try {
    const command = parseConsensusCliArgs(argv);
    if (command.kind === "help") {
      io.stdout.write(helpText());
      return 0;
    }
    if (command.kind === "config-list") {
      writeJson(io, runConfigList());
      return 0;
    }
    if (command.kind === "config-get") {
      writeJson(io, await runConfigGet(command, io, options));
      return 0;
    }
    if (command.kind === "config-set") {
      writeJson(io, await runConfigSet(command, io));
      return 0;
    }
    if (command.kind === "config-clear") {
      writeJson(io, await runConfigClear(command, io));
      return 0;
    }
    if (command.kind === "provider-list") {
      writeJson(
        io,
        await runProviderList(defaultProbeOptions(options, io.env))
      );
      return 0;
    }
    if (command.kind === "preflight") {
      writeJson(
        io,
        await runPreflight({
          ...defaultProbeOptions(options, io.env),
          provider: command.provider,
          capabilities: command.capabilities,
          host: command.maxDepth === void 0 ? void 0 : hostContextFromEnv(io.env ?? {}, io.cwd, command.maxDepth)
        })
      );
      return 0;
    }
    if (command.kind === "submit") {
      return runSubmit(command, io);
    }
    const request = await normalizeRunRequest(command, io);
    const envelope = await runProviderTurn(request, {
      readSchema: async (schemaPath) => JSON.parse(await io.readFile(schemaPath)),
      parentEnv: io.env,
      ...options.adapters ? { registry: options.adapters } : {}
    });
    writeJson(io, envelope);
    return processExitForEnvelope(envelope);
  } catch (error) {
    if (error instanceof ConsensusCliUsageError) {
      const envelope = usageFailure(error.message, error.details);
      writeJson(io, envelope);
      return processExitForEnvelope(envelope);
    }
    io.stderr.write(
      `${error instanceof Error ? error.message : String(error)}
`
    );
    return 1;
  }
}
function runConfigList() {
  return {
    schema_version: "v1",
    ok: true,
    scopes: ["user", "project", "effective"],
    writable_scopes: ["user", "project"],
    keys: ["peers", "panelists", "panel-size", "reviewers", "roles", "all"],
    workflows: ["convergence", "panel", "review"]
  };
}
async function runConfigGet(command, io, options) {
  const cwd = command.cwd ?? io.cwd;
  if (command.scope === "user" || command.scope === "project") {
    return {
      schema_version: "v1",
      ok: true,
      scope: command.scope,
      config: await readConsensusConfig({
        scope: command.scope,
        cwd,
        env: io.env
      })
    };
  }
  const effective = await readEffectiveConfig(cwd, io.env);
  if (!command.workflow) {
    return {
      schema_version: "v1",
      ok: true,
      scope: "effective",
      source: effective.source,
      field_sources: effective.fieldSources,
      config: effective.config,
      diagnostics: { warnings: [] }
    };
  }
  const composition = await resolveConsensusComposition({
    workflow: command.workflow,
    cwd,
    env: io.env,
    inventory: await resolveRegistry(
      options.registry,
      defaultProbeOptions(options, io.env)
    )
  });
  return {
    schema_version: "v1",
    ok: true,
    scope: "effective",
    source: composition.source,
    config: effective.config,
    workflow: composition.workflow,
    agents: composition.agents,
    diagnostics: { warnings: composition.warnings }
  };
}
async function runConfigSet(command, io) {
  const cwd = command.cwd ?? io.cwd;
  const patch = parseConfigSetPatch(command);
  if (!command.fromFile && !configDefaultsHasValues(patch)) {
    throw new ConsensusCliUsageError(
      "config set requires --peers, --panelists, --panel-size, --reviewers, or --from-file"
    );
  }
  const base = command.fromFile ? await readConfigFromFile(command.fromFile, io) : await readConsensusConfig({
    scope: command.scope,
    cwd,
    env: io.env
  }) ?? { schema_version: "v1" };
  const config = parseConfigForCli(configWithDefaultsPatch(base, patch));
  await writeConsensusConfig({
    scope: command.scope,
    cwd,
    env: io.env,
    config
  });
  return {
    schema_version: "v1",
    ok: true,
    scope: command.scope,
    config
  };
}
async function runConfigClear(command, io) {
  const cwd = command.cwd ?? io.cwd;
  await clearConsensusConfig({
    scope: command.scope,
    cwd,
    env: io.env,
    key: command.key
  });
  return {
    schema_version: "v1",
    ok: true,
    scope: command.scope,
    key: command.key,
    config: await readConsensusConfig({
      scope: command.scope,
      cwd,
      env: io.env
    })
  };
}
async function readEffectiveConfig(cwd, env) {
  const user = await readConsensusConfig({ scope: "user", cwd, env });
  const project = await readConsensusConfig({ scope: "project", cwd, env });
  const config = mergeConfigs(user, project);
  const source = configHasDefaults(project) ? "project" : configHasDefaults(user) ? "user" : "built-in";
  return { source, fieldSources: effectiveFieldSources(user, project), config };
}
function effectiveFieldSources(user, project) {
  const fieldSources = {};
  const fields = [
    ["peers", "peers"],
    ["panelists", "panelists"],
    ["panel-size", "panel_size"],
    ["reviewers", "reviewers"],
    ["roles", "roles"],
    ["provider-models", "provider_models"]
  ];
  for (const [key, field] of fields) {
    if (project?.defaults?.[field] !== void 0) {
      fieldSources[key] = "project";
    } else if (user?.defaults?.[field] !== void 0) {
      fieldSources[key] = "user";
    }
  }
  return fieldSources;
}
function mergeConfigs(user, project) {
  const config = { schema_version: "v1" };
  const defaults = {};
  mergeConfigFields(defaults, user?.defaults);
  mergeConfigFields(defaults, project?.defaults);
  if (configDefaultsHasValues(defaults)) config.defaults = defaults;
  return config;
}
function mergeConfigFields(target, source) {
  if (!source) return;
  if (source.peers !== void 0) target.peers = source.peers;
  if (source.panelists !== void 0) target.panelists = source.panelists;
  if (source.panel_size !== void 0) target.panel_size = source.panel_size;
  if (source.reviewers !== void 0) target.reviewers = source.reviewers;
  if (source.roles !== void 0) target.roles = source.roles;
  if (source.provider_models !== void 0) {
    target.provider_models = {
      ...target.provider_models,
      ...source.provider_models
    };
  }
}
function configHasDefaults(config) {
  return config !== null && configDefaultsHasValues(config.defaults);
}
async function readConfigFromFile(filePath, io) {
  let parsed;
  try {
    parsed = JSON.parse(await io.readFile(filePath));
  } catch (error) {
    throw new ConsensusCliUsageError(
      `Malformed consensus config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return parseConfigForCli(parsed);
}
function parseConfigForCli(value) {
  try {
    return parseConsensusDefaultsConfig(value);
  } catch (error) {
    throw new ConsensusCliUsageError(
      `Malformed consensus config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
function parseConfigSetPatch(command) {
  const patch = {};
  if (command.peers !== void 0) {
    patch.peers = parseAgentSpecList(command.peers);
  }
  if (command.panelists !== void 0) {
    patch.panelists = parseAgentSpecList(command.panelists);
  }
  if (command.panelSize !== void 0) {
    patch.panel_size = command.panelSize;
  }
  if (command.reviewers !== void 0) {
    patch.reviewers = parseAgentSpecList(command.reviewers);
  }
  return patch;
}
function configWithDefaultsPatch(base, patch) {
  const defaults = {
    ...base.defaults,
    ...patch
  };
  const config = {
    schema_version: base.schema_version
  };
  if (configDefaultsHasValues(defaults)) config.defaults = defaults;
  return config;
}
function configDefaultsHasValues(defaults) {
  return defaults !== void 0 && (defaults.peers !== void 0 || defaults.panelists !== void 0 || defaults.panel_size !== void 0 || defaults.reviewers !== void 0 || defaults.roles !== void 0 || defaults.provider_models !== void 0);
}
function parseAgentSpecList(value) {
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0).map(parseAgentSpec);
}
function parseAgentSpec(value) {
  const [provider, model, effort, extra] = value.split(":");
  if (extra !== void 0) {
    throw new ConsensusCliUsageError(
      "Agent specs must use provider[:model[:effort]]"
    );
  }
  const agent = { provider };
  if (model !== void 0 && model.length > 0) agent.model = model;
  if (effort !== void 0 && effort.length > 0) agent.effort = effort;
  return agent;
}
async function readSubmitSource(source, io, maxBytes) {
  if (source.kind === "stdin") return io.readStdin(maxBytes);
  if (source.kind === "file") return io.readFile(source.path, maxBytes);
  return source.value;
}
function submitFailure(io, message, exitCode) {
  writeJson(io, {
    schema_version: "v1",
    ok: false,
    captured: false,
    message
  });
  io.stderr.write(`${message}
`);
  return exitCode;
}
async function writeJsonFileAtomic(filePath, contents) {
  const directory = dirname(filePath);
  await mkdir3(directory, { recursive: true });
  const tempPath = join(
    directory,
    `.${basename(filePath)}.${process.pid}.${randomUUID5()}.tmp`
  );
  await writeFile3(tempPath, contents, "utf8");
  await rename2(tempPath, filePath);
}
function defaultProbeOptions(options, env) {
  if (options.registry || options.probeRunner) return options;
  return {
    ...options,
    probeRunner: nodeProbeCommandRunner(env ?? {})
  };
}
function writeJson(io, value) {
  io.stdout.write(`${JSON.stringify(value)}
`);
}
function selectProviders(registry, provider) {
  if (!provider) return registry;
  const selected = registry.find((entry) => entry.id === provider);
  if (selected) return [selected];
  return [
    {
      id: provider,
      status: "unsupported",
      capabilities: placeholderCapabilities()
    }
  ];
}
function applyHostGuardToProviders(providers, host) {
  if (!host) return providers;
  return providers.map((provider) => {
    const result = evaluateHostGuard({ host, provider: provider.id });
    if (result.allowed) {
      return {
        ...provider,
        host_relation: result.host_relation,
        guard: result.guard,
        diagnostics: mergeDiagnostics2(provider.diagnostics, result.diagnostics)
      };
    }
    return {
      ...provider,
      status: "unavailable",
      host_relation: result.host_relation,
      guard: result.guard,
      diagnostics: mergeDiagnostics2(provider.diagnostics, result.diagnostics)
    };
  });
}
function mergeDiagnostics2(current, next) {
  const warnings = [...current?.warnings ?? [], ...next.warnings ?? []];
  return {
    ...current,
    ...next,
    ...warnings.length > 0 ? { warnings } : {}
  };
}
async function resolveRegistry(registry, options = {}, provider, requiredCapabilities) {
  if (Array.isArray(registry)) return registry;
  if (typeof registry === "function") return registry();
  const adapters = options.adapters ?? providerRegistry();
  if (options.probeRunner) {
    return probeProviderRegistry({
      registry: adapters,
      runner: options.probeRunner,
      ...provider ? { provider } : {},
      ...requiredCapabilities ? { requiredCapabilities } : {}
    });
  }
  return defaultProviderRegistry(adapters, provider);
}
function defaultProviderRegistry(adapters, provider) {
  return adapters.list().filter(
    (adapter) => provider ? adapter.id === provider : adapter.tier === "core"
  ).map(
    (adapter) => notAdmittedEntry(adapter) ?? {
      id: adapter.id,
      status: "missing",
      capabilities: adapter.capabilities
    }
  );
}
function placeholderCapabilities() {
  return {
    schema_strategies: ["prompt_only"],
    output_modes: ["stdout_json"],
    options: {
      model: false,
      effort: null,
      runtime_policy: {
        env_allowlist: false
      }
    },
    supports_submit_tool: false,
    supports_same_host_subprocess: false,
    supports_host_native_dispatch: false
  };
}

// src/plugins/consensus/provider-cli/cli.ts
function nodeIo() {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    cwd: process.cwd(),
    env: process.env,
    readFile: (filePath, maxBytes) => readUtf8File(filePath, maxBytes),
    readStdin: (maxBytes) => readAllStdin(process.stdin, maxBytes)
  };
}
async function readUtf8File(filePath, maxBytes) {
  if (maxBytes !== void 0) {
    const file = await stat2(filePath);
    if (file.size > maxBytes) {
      throw new SubmitCaptureLimitError(file.size, maxBytes);
    }
  }
  const contents = await readFile3(filePath, "utf8");
  if (maxBytes !== void 0 && byteLength(contents) > maxBytes) {
    throw new SubmitCaptureLimitError(byteLength(contents), maxBytes);
  }
  return contents;
}
function readAllStdin(stdin, maxBytes) {
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    let bytes = 0;
    stdin.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (maxBytes !== void 0) {
        bytes += byteLength(text);
        if (bytes > maxBytes) {
          reject(new SubmitCaptureLimitError(bytes, maxBytes));
          stdin.destroy();
          return;
        }
      }
      value += text;
    });
    stdin.on("error", reject);
    stdin.on("end", () => {
      resolve(value);
    });
    stdin.resume();
  });
}
function isEntrypointPath(argvPath) {
  try {
    return realpathSync4(argvPath) === realpathSync4(fileURLToPath2(import.meta.url));
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
}
if (process.argv[1] && isEntrypointPath(process.argv[1])) {
  runConsensusCli(process.argv.slice(2), nodeIo()).then((code) => {
    process.exitCode = code;
  });
}
