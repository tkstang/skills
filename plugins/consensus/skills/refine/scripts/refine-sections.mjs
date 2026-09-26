// GENERATED skill payload for refine.

// src/skills/refine/src/refine-sections.ts
import path7 from "node:path";

// src/plugins/consensus/shared/cli-helpers.ts
import {
  lstat as lstat2,
  mkdir as mkdir3,
  realpath,
  rename as rename2,
  unlink as unlink2,
  writeFile as writeFile2
} from "node:fs/promises";
import path5 from "node:path";

// src/plugins/consensus/core/consensus-loop.ts
import { mkdir as mkdir2, readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";

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

// src/plugins/consensus/shared/cli-helpers-core.ts
import { lstat } from "node:fs/promises";
import path4 from "node:path";

// src/plugins/consensus/shared/cli-helpers.ts
var PEER_AGENTS_OPTION = "--peer-agents";
function peerAgentsArgv(peers) {
  const agents = peerAgentsFromComposition(peers);
  const argv = ["--peers", agents.map((agent) => agent.provider).join(",")];
  if (agents.some((agent) => agent.model || agent.effort)) {
    argv.push(PEER_AGENTS_OPTION, JSON.stringify(agents));
  }
  return argv;
}
function peerAgentsFromComposition(agents) {
  return agents.map((agent) => {
    const normalized = normalizePeerAgent(agent);
    return {
      provider: normalized.provider,
      ...normalized.model ? { model: normalized.model } : {},
      ...normalized.effort ? { effort: normalized.effort } : {}
    };
  });
}
function normalizePeerAgent(peer) {
  return typeof peer === "string" ? { provider: peer } : peer;
}

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

// src/skills/refine/src/refine-args.ts
var PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
var MAX_ROUNDS_MIN = 1;
var MAX_ROUNDS_MAX = 100;
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

// src/skills/refine/src/refine-sections.ts
function markdownLines(markdown) {
  const normalized = String(markdown ?? "").replace(/\r\n?/g, "\n");
  return normalized.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}
function markerName(line) {
  const match = line.trim().match(/^<!--\s*section:\s*(.*?)\s*-->$/i);
  return match?.[1]?.trim() || null;
}
function headingName(line) {
  const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
  if (!match) return null;
  return match[1].replace(/\s+#+\s*$/u, "").trim() || null;
}
function buildSectionsFromBoundaries(lines, boundaries) {
  const sections = [];
  const firstBoundary = boundaries[0];
  if (firstBoundary?.lineIndex > 0) {
    const preamble = lines.slice(0, firstBoundary.lineIndex).join("");
    if (preamble.trim()) {
      sections.push({
        id: slugSectionId("Preamble", sections.length),
        name: "Preamble",
        original_index: sections.length,
        start_line: 1,
        end_line: firstBoundary.lineIndex,
        markdown: preamble
      });
    }
  }
  for (const [boundaryIndex, boundary] of boundaries.entries()) {
    const nextBoundary = boundaries[boundaryIndex + 1];
    const markdown = lines.slice(boundary.lineIndex, nextBoundary?.lineIndex ?? lines.length).join("");
    sections.push({
      id: slugSectionId(boundary.name, sections.length),
      name: boundary.name,
      original_index: sections.length,
      start_line: boundary.lineIndex + 1,
      end_line: nextBoundary?.lineIndex ?? lines.length,
      markdown
    });
  }
  return sections;
}
function slugSectionId(name, index) {
  const slug = String(name ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "section"}-${index}`;
}
function parseSections(markdown) {
  const lines = markdownLines(markdown);
  const markerBoundaries = [];
  const headingBoundaries = [];
  lines.forEach((line, lineIndex) => {
    const sectionMarkerName = markerName(line);
    if (sectionMarkerName) {
      markerBoundaries.push({ lineIndex, name: sectionMarkerName });
      return;
    }
    const sectionHeadingName = headingName(line);
    if (sectionHeadingName) {
      headingBoundaries.push({ lineIndex, name: sectionHeadingName });
    }
  });
  const boundaries = markerBoundaries.length > 0 ? markerBoundaries : headingBoundaries;
  if (boundaries.length > 0) {
    return buildSectionsFromBoundaries(lines, boundaries);
  }
  return [
    {
      id: slugSectionId("Document", 0),
      name: "Document",
      original_index: 0,
      start_line: 1,
      end_line: lines.length,
      markdown: lines.join("")
    }
  ];
}
function normalizeSequentialOptions(options) {
  const parsed = Array.isArray(options) ? parseWrapperArgs(options) : options;
  return {
    goal: "",
    maxRounds: 12,
    agency: "moderate",
    iteration: "alternating",
    coldStart: "shared_input",
    failOnSectionError: false,
    ...parsed
  };
}
function sectionRunDirectory(runDir, section) {
  return path7.join(
    runDir,
    "sections",
    `${String(section.original_index + 1).padStart(2, "0")}-${section.id}`
  );
}
function sectionLookup(sections) {
  return new Map(
    (sections ?? []).flatMap((section) => [
      [`id:${section.id}`, section],
      [`index:${section.original_index}`, section]
    ])
  );
}
function sequentialRunSections(parsedSections, resumeState) {
  if (!resumeState) return parsedSections;
  const currentSections = sectionLookup(parsedSections);
  return resumeState.sections.map((resumeSection, index) => {
    const currentSection = currentSections.get(`id:${resumeSection.id}`) ?? currentSections.get(`index:${resumeSection.original_index}`) ?? null;
    return {
      id: resumeSection.id,
      name: resumeSection.name,
      original_index: resumeSection.original_index ?? index,
      markdown: currentSection?.markdown ?? resumeSection.resumedArtifact ?? ""
    };
  });
}
function loopArgvForSection({
  paths,
  options,
  peers,
  synthesizer = null
}) {
  const argv = [
    "--section-file",
    paths.input,
    "--goal",
    options.goal ?? "",
    ...peerAgentsArgv(peers),
    "--max-rounds",
    String(options.maxRounds),
    "--agency",
    options.agency,
    "--iteration",
    options.iteration ?? "alternating"
  ];
  if (synthesizer) {
    argv.push("--synthesizer", synthesizer);
  }
  argv.push(
    "--output-records",
    paths.records,
    "--output-section",
    paths.output,
    "--output-status",
    paths.status
  );
  return argv;
}
function parallelismFor(sectionCount, requested) {
  if (requested !== null && requested !== void 0) {
    return Math.min(requested, sectionCount);
  }
  return Math.min(sectionCount, 4);
}
function manifestSectionEntry({
  section,
  paths,
  packetPath,
  loopArgv,
  iterationMode = "alternating",
  synthesizer = null
}) {
  return {
    section_id: section.id,
    name: section.name,
    original_index: section.original_index,
    packet_path: packetPath,
    section_file: paths.input,
    output_records: paths.records,
    output_section: paths.output,
    output_status: paths.status,
    subagent_id: `section-runner-${String(section.original_index + 1).padStart(2, "0")}-${section.id}`,
    iteration_mode: iterationMode,
    synthesizer,
    loop_argv: loopArgv
  };
}
function dispatchInstructions(manifest) {
  return {
    phase: "parallel_dispatch_required",
    manifest: manifest.manifest_path,
    parallelism: manifest.parallelism,
    iteration_mode: manifest.iteration_mode ?? "alternating",
    synthesizer: manifest.synthesizer ?? null,
    sections: manifest.sections.map((section) => ({
      section_id: section.section_id,
      name: section.name,
      original_index: section.original_index,
      packet_path: section.packet_path,
      subagent_id: section.subagent_id,
      iteration_mode: section.iteration_mode ?? manifest.iteration_mode ?? "alternating",
      synthesizer: section.synthesizer ?? manifest.synthesizer ?? null,
      output_records: section.output_records,
      output_section: section.output_section,
      output_status: section.output_status
    }))
  };
}
export {
  dispatchInstructions,
  loopArgvForSection,
  manifestSectionEntry,
  normalizeSequentialOptions,
  parallelismFor,
  parseSections,
  sectionLookup,
  sectionRunDirectory,
  sequentialRunSections,
  slugSectionId
};
