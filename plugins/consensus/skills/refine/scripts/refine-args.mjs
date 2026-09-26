// GENERATED skill payload for refine.

// src/plugins/consensus/core/consensus-loop.ts
import { mkdir as mkdir3, readFile as readFile2 } from "node:fs/promises";
import path5 from "node:path";

// src/plugins/consensus/core/loop-validation.ts
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
var VERDICT_CAPS = Object.freeze({
  reasoning_bytes: 16 * 1024,
  critique_field_bytes: 16 * 1024,
  proposed_artifact_bytes: 256 * 1024,
  concern_bytes: 4 * 1024,
  max_concerns: 20,
  total_verdict_bytes: 512 * 1024
});
var SYNTHESIS_CAPS = Object.freeze({
  synthesized_artifact_bytes: 256 * 1024,
  synthesis_reasoning_bytes: 16 * 1024,
  disagreement_bytes: 4 * 1024,
  max_disagreements: 20,
  total_synthesis_bytes: 512 * 1024
});
var SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024;
var EXIT_CODES = Object.freeze({
  USAGE: 64,
  DATA: 65,
  IO: 73,
  SECTION_ERROR: 74,
  NOPERM: 77,
  CONFIG: 78,
  INTERRUPTED: 130
});
var ConsensusError = class extends Error {
  code;
  exitCode;
  details;
  stderr;
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "ConsensusError";
    this.code = options.code ?? "CONSENSUS_ERROR";
    this.exitCode = options.exitCode ?? EXIT_CODES.CONFIG;
    this.details = options.details;
  }
};
var ITERATION_MODES = Object.freeze([
  "alternating",
  "parallel_revision",
  "parallel_synthesized"
]);
var COLD_START_MODES = Object.freeze([
  "shared_input",
  "independent_draft"
]);
function invalidIterationModeError(value) {
  return new ConsensusError(
    `--iteration must be one of ${ITERATION_MODES.join(", ")} (received: ${value})`,
    {
      code: "INVALID_ITERATION_MODE",
      exitCode: EXIT_CODES.USAGE,
      details: { received: value ?? null, allowed: [...ITERATION_MODES] }
    }
  );
}

// src/plugins/consensus/core/loop-records.ts
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

// src/plugins/consensus/core/loop-provider.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var CONSENSUS_SHARED_CLI_RELATIVE_PATH = path2.join(
  ".consensus",
  "consensus.mjs"
);

// src/plugins/consensus/shared/cli-helpers.ts
import {
  lstat as lstat2,
  mkdir as mkdir2,
  realpath,
  rename as rename2,
  unlink as unlink2,
  writeFile as writeFile2
} from "node:fs/promises";
import path4 from "node:path";

// src/plugins/consensus/shared/cli-helpers-core.ts
import { lstat } from "node:fs/promises";
import path3 from "node:path";

// src/plugins/consensus/core/loop-escalation.ts
var ESCALATION_TRIGGERS = Object.freeze({
  persistent_disagreement: "persistent_disagreement",
  oscillation: "oscillation",
  budget_exhausted: "budget_exhausted",
  near_done_drift: "near_done_drift"
});

// src/plugins/consensus/core/consensus-loop.ts
var LEGACY_USER_STATUS = Object.freeze({
  oscillation: {
    status: "oscillation",
    termination_reason: "oscillation_detected"
  },
  budget_exhausted: {
    status: "max-rounds",
    termination_reason: "max_rounds_exhausted"
  }
});
var ESCALATION_ROUTING_TABLE = Object.freeze({
  [ESCALATION_TRIGGERS.persistent_disagreement]: {
    minimal: "user",
    moderate: "host",
    maximum: "host"
  },
  [ESCALATION_TRIGGERS.oscillation]: {
    minimal: "user",
    moderate: "user",
    maximum: "host"
  },
  [ESCALATION_TRIGGERS.budget_exhausted]: {
    minimal: "user",
    moderate: "user",
    maximum: "auto"
  },
  [ESCALATION_TRIGGERS.near_done_drift]: {
    minimal: "user",
    moderate: "host",
    maximum: "auto"
  }
});
var BASE_DECISION_KINDS = Object.freeze([
  "pick_a",
  "pick_b",
  "blend",
  "direct",
  "accept_impasse",
  "extend_budget"
]);

// src/skills/refine/src/refine-shared.ts
import { randomBytes } from "node:crypto";
import {
  lstat as lstat3,
  mkdir as mkdir4,
  open as open2,
  readFile as readFile3,
  realpath as realpath2,
  rename as rename3,
  stat,
  unlink as unlink3,
  writeFile as writeFile3
} from "node:fs/promises";
import path6 from "node:path";
var INPUT_SIZE_CAP_BYTES = 1024 * 1024;
function isJsonRecord3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// src/skills/refine/src/refine-args.ts
var PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
var MAX_ROUNDS_MIN = 1;
var MAX_ROUNDS_MAX = 100;
function asProviderInventoryEntry(value) {
  return isJsonRecord3(value) ? value : {};
}
function requireValue2(argv, index, flag) {
  if (index + 1 >= argv.length) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index + 1];
}
function parsePositiveInteger2(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== String(value) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}
function parsePeers2(value) {
  const peers = String(value).split(",").map((peer) => peer.trim()).filter(Boolean);
  if (peers.length !== 2) {
    throw new Error("--peers must contain exactly two peers");
  }
  for (const peer of peers) {
    validateProviderId2(peer, "--peers");
  }
  return peers;
}
function validateProviderId2(providerId, label = "provider id") {
  if (typeof providerId !== "string" || !PROVIDER_ID_PATTERN.test(providerId)) {
    throw new Error(
      `${label} "${providerId}" must match ^[a-z][a-z0-9-]{0,31}$`
    );
  }
  return providerId;
}
var PROVIDER_UNAVAILABLE_STATUSES = /* @__PURE__ */ new Set([
  "auth_required",
  "error",
  "missing",
  "unavailable",
  "not found",
  "notfound",
  "disabled",
  "offline",
  "unsupported"
]);
function providerEntryAvailable(entry) {
  if (typeof entry.available === "boolean") {
    return entry.available;
  }
  if (entry.enabled === false || entry.enabled === "Disabled") {
    return false;
  }
  if (typeof entry.status === "string") {
    return !PROVIDER_UNAVAILABLE_STATUSES.has(
      entry.status.trim().toLowerCase()
    );
  }
  return true;
}
function normalizeProviderInventory(providerInventory) {
  const entries = Array.isArray(providerInventory) ? providerInventory : isJsonRecord3(providerInventory) ? providerInventory.providers ?? providerInventory.data ?? [] : [];
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (typeof entry === "string") {
      return {
        id: validateProviderId2(entry, "provider inventory id"),
        available: true
      };
    }
    const providerEntry = asProviderInventoryEntry(entry);
    const id = validateProviderId2(
      providerEntry.id ?? providerEntry.name ?? providerEntry.provider,
      "provider inventory id"
    );
    const available = providerEntryAvailable(providerEntry);
    return { ...providerEntry, id, available };
  });
}
function parseWrapperArgs(argv) {
  const parsed = {
    mode: "sequential",
    inputPath: null,
    goal: "",
    peers: null,
    maxRounds: 12,
    agency: "moderate",
    iteration: "alternating",
    synthesizer: null,
    coldStart: "shared_input",
    output: null,
    resume: null,
    userDirection: null,
    hostDirection: null,
    hostDecisionKind: null,
    runDir: null,
    allowRoot: null,
    failOnSectionError: false,
    skipCorruptSections: [],
    skipAllCorrupt: false,
    yesSkipCorrupt: false,
    prepareParallel: false,
    parallelism: null,
    fanIn: false,
    manifestPath: null
  };
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--goal":
        parsed.goal = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--peers":
        parsed.peers = parsePeers2(requireValue2(argv, index, token));
        index += 1;
        break;
      case "--max-rounds":
        parsed.maxRounds = parsePositiveInteger2(
          requireValue2(argv, index, token),
          "--max-rounds",
          MAX_ROUNDS_MIN,
          MAX_ROUNDS_MAX
        );
        index += 1;
        break;
      case "--agency":
        parsed.agency = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--iteration":
        parsed.iteration = requireValue2(
          argv,
          index,
          token
        );
        index += 1;
        break;
      case "--synthesizer":
        parsed.synthesizer = validateProviderId2(
          requireValue2(argv, index, token),
          "--synthesizer"
        );
        index += 1;
        break;
      case "--cold-start":
        parsed.coldStart = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--output":
        parsed.output = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--resume":
        parsed.resume = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--user-direction":
        parsed.userDirection = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--host-direction":
        parsed.hostDirection = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--host-decision-kind":
        parsed.hostDecisionKind = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--run-dir":
        parsed.runDir = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--allow-root":
        parsed.allowRoot = requireValue2(argv, index, token);
        index += 1;
        break;
      case "--fail-on-section-error":
        parsed.failOnSectionError = true;
        break;
      case "--skip-corrupt-section":
        parsed.skipCorruptSections.push(requireValue2(argv, index, token));
        index += 1;
        break;
      case "--skip-all-corrupt":
        parsed.skipAllCorrupt = true;
        break;
      case "--yes-skip-corrupt":
        parsed.yesSkipCorrupt = true;
        break;
      case "--prepare-parallel":
        parsed.prepareParallel = true;
        parsed.mode = "prepare_parallel";
        break;
      case "--parallelism":
        parsed.parallelism = parsePositiveInteger2(
          requireValue2(argv, index, token),
          "--parallelism",
          1,
          64
        );
        index += 1;
        break;
      case "--fan-in":
        parsed.fanIn = true;
        parsed.mode = "fan_in";
        parsed.manifestPath = requireValue2(argv, index, token);
        index += 1;
        break;
      default:
        if (token.startsWith("--")) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
    }
  }
  if (parsed.userDirection !== null && parsed.hostDirection !== null) {
    throw new Error(
      "--user-direction and --host-direction are mutually exclusive"
    );
  }
  if (!["minimal", "moderate", "maximum"].includes(parsed.agency)) {
    throw new Error("--agency must be minimal, moderate, or maximum");
  }
  if (!ITERATION_MODES.includes(parsed.iteration)) {
    throw invalidIterationModeError(parsed.iteration);
  }
  if (parsed.coldStart === "independent_draft") {
    throw new Error(
      "consensus-refine supports `shared_input` only because it refines an existing draft"
    );
  }
  if (parsed.coldStart !== "shared_input") {
    throw new Error(
      "consensus-refine supports `shared_input` only; --cold-start must be shared_input"
    );
  }
  if (parsed.fanIn) {
    if (positionals.length > 0) {
      throw new Error("--fan-in does not accept an input path");
    }
    return parsed;
  }
  if (positionals.length > 1) {
    throw new Error(`unexpected positional argument: ${positionals[1]}`);
  }
  parsed.inputPath = positionals[0] ?? null;
  if (!parsed.inputPath) {
    throw new Error("input path is required");
  }
  return parsed;
}
function resolvePeers(options = {}, host = "unknown", providerInventory = []) {
  const defaultPeers = host === "codex" ? ["codex", "claude"] : ["claude", "codex"];
  const peers = options.peers ?? defaultPeers;
  const inventory = normalizeProviderInventory(providerInventory);
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const missing = [];
  const unavailable = [];
  for (const peer of peers) {
    const entry = byId.get(peer);
    if (!entry) {
      missing.push(peer);
    } else if (entry.available === false) {
      unavailable.push(peer);
    }
  }
  if (missing.length > 0) {
    const error = new Error(
      `Missing peers in provider inventory: ${missing.join(", ")}. Verify configured providers with "consensus provider ls --json".`
    );
    error.code = "PEER_UNAVAILABLE";
    throw error;
  }
  if (unavailable.length > 0) {
    const error = new Error(
      `Consensus providers are unavailable: ${unavailable.join(", ")}.`
    );
    error.code = "PEER_UNAVAILABLE";
    throw error;
  }
  return { peers, inventory };
}
function resolveSynthesizer(options = {}, providerInventory = []) {
  const warnings = [];
  const requested = options.synthesizer ?? null;
  if (options.iteration !== "parallel_synthesized") {
    if (requested) {
      warnings.push({
        code: "SYNTHESIZER_IGNORED",
        level: "warning",
        synthesizer: requested,
        iteration: options.iteration ?? "alternating",
        message: `--synthesizer "${requested}" is ignored outside parallel_synthesized mode.`
      });
    }
    return { synthesizer: null, warnings };
  }
  const peers = options.peers ?? [];
  const synthesizer = requested ?? peers[0] ?? null;
  if (!synthesizer) {
    throw new ConsensusError(
      "no synthesizer could be resolved (no peers available)",
      {
        code: "SYNTHESIZER_UNAVAILABLE",
        exitCode: EXIT_CODES.CONFIG,
        details: { requested, peers }
      }
    );
  }
  const inventory = normalizeProviderInventory(providerInventory);
  const entry = inventory.find((candidate) => candidate.id === synthesizer);
  if (!entry || entry.available === false) {
    throw new ConsensusError(
      `Synthesizer "${synthesizer}" is not an available provider in the provider CLI inventory. Verify configured providers with "consensus provider ls --json".`,
      {
        code: "SYNTHESIZER_UNAVAILABLE",
        exitCode: EXIT_CODES.CONFIG,
        details: { synthesizer }
      }
    );
  }
  return { synthesizer, warnings };
}
export {
  PROVIDER_ID_PATTERN,
  normalizeProviderInventory,
  parseWrapperArgs,
  resolvePeers,
  resolveSynthesizer
};
