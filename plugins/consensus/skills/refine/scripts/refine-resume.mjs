// GENERATED skill payload for refine.

// src/skills/refine/src/refine-resume.ts
import { mkdir as mkdir5, readFile as readFile4, stat as stat2, writeFile as writeFile4 } from "node:fs/promises";
import path7 from "node:path";
import { createInterface } from "node:readline/promises";

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
var DEFAULT_NORMALIZE_OPTIONS = {
  normalizeLineEndings: true,
  trimTrailingWhitespace: true,
  collapseEofNewlines: true,
  finalNewline: true
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
function normalizeOptions(options = {}) {
  return { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
}
function normalizeForHash(text, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  let normalized = String(text ?? "");
  if (normalizedOptions.normalizeLineEndings) {
    normalized = normalized.replace(/\r\n?/g, "\n");
  }
  if (normalizedOptions.trimTrailingWhitespace) {
    normalized = normalized.split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n");
  }
  if (normalizedOptions.collapseEofNewlines) {
    normalized = normalized.replace(/\n+$/g, "");
  }
  if (normalizedOptions.finalNewline && normalized.length > 0) {
    normalized += "\n";
  }
  return normalized;
}
function hashArtifact(text, options = {}) {
  return `sha256:${createHash("sha256").update(normalizeForHash(text, options), "utf8").digest("hex")}`;
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
function asErrorLike2(error) {
  return isJsonRecord3(error) ? error : {};
}
function asConsensusRecord(value) {
  return isJsonRecord3(value) ? value : {};
}
function asConsensusRecords(value) {
  return Array.isArray(value) ? value.map(asConsensusRecord) : [];
}
function asSectionStatus(value) {
  return isJsonRecord3(value) ? value : {};
}
async function syncPathIfAvailable(targetPath) {
  let handle;
  try {
    handle = await open2(targetPath, "r");
    await handle.sync();
  } finally {
    await handle?.close();
  }
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function consensusBlockPattern(label) {
  return new RegExp(`<!-- consensus:${label}\\n([\\s\\S]*?)\\n-->`, "g");
}

// src/skills/refine/src/refine-resume.ts
var STRICT_RESUME_HASH_OPTIONS = Object.freeze({
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false
});
function resumeDataError(message, details = {}) {
  return new ConsensusError(message, {
    code: typeof details.code === "string" ? details.code : "RESUME_DATA_INVALID",
    exitCode: EXIT_CODES.DATA,
    details: details.details
  });
}
function parseYamlScalar(value) {
  const text = String(value ?? "").trim();
  if (text === "null") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(text)) return Number(text);
  if (text.startsWith('"') && text.endsWith('"') || text.startsWith("'") && text.endsWith("'")) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}
function parseFrontmatter(markdown) {
  const text = String(markdown ?? "");
  if (!text.startsWith("---\n")) {
    return {};
  }
  const endIndex = text.indexOf("\n---", 4);
  if (endIndex === -1) {
    throw resumeDataError("resume artifact frontmatter is unterminated", {
      code: "RESUME_FRONTMATTER_INVALID"
    });
  }
  const frontmatter = {};
  for (const line of text.slice(4, endIndex).split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) continue;
    frontmatter[match[1]] = parseYamlScalar(match[2]);
  }
  return frontmatter;
}
function parseConsensusJsonBlock(label, jsonText, index) {
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw resumeDataError(
      `corrupt consensus:${label} JSON block at index ${index}: ${asErrorLike2(error).message}`,
      {
        code: "RESUME_JSON_CORRUPT",
        details: { label, index }
      }
    );
  }
}
function tryParseConsensusJsonBlock(label, jsonText, index) {
  try {
    return { ok: true, value: JSON.parse(jsonText) };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "RESUME_JSON_CORRUPT",
        message: `corrupt consensus:${label} JSON block at index ${index}: ${asErrorLike2(error).message}`,
        block_label: label,
        block_index: index
      }
    };
  }
}
function extractConsensusJsonBlocks(markdown, label) {
  const blocks = [];
  for (const [index, match] of [
    ...String(markdown ?? "").matchAll(consensusBlockPattern(label))
  ].entries()) {
    blocks.push(parseConsensusJsonBlock(label, match[1], index));
  }
  return blocks;
}
function extractLogSectionBlocks(markdown) {
  const logStart = String(markdown ?? "").match(/^## Deliberation Log\s*$/mu);
  const logText = logStart ? String(markdown).slice(logStart.index) : String(markdown ?? "");
  const blockPattern = /<!-- consensus:(consensus-section-status|consensus-verdict|consensus-synthesis|consensus-synthesis-error)\n([\s\S]*?)\n-->/g;
  const logSections = [];
  const unscopedErrors = [];
  let current = null;
  for (const [index, match] of [...logText.matchAll(blockPattern)].entries()) {
    const [, label, jsonText] = match;
    const parsed = tryParseConsensusJsonBlock(label, jsonText, index);
    if (label === "consensus-section-status") {
      current = { status: null, records: [], errors: [] };
      if (parsed.ok) {
        current.status = asSectionStatus(parsed.value);
      } else {
        current.errors.push(parsed.error);
      }
      logSections.push(current);
      continue;
    }
    if (!current) {
      unscopedErrors.push({
        code: "RESUME_SECTION_STATE_MISSING",
        message: `resume artifact has ${label} records before any section status block`,
        block_label: label,
        block_index: index
      });
      continue;
    }
    if (parsed.ok) {
      current.records.push(asConsensusRecord(parsed.value));
    } else {
      current.errors.push(parsed.error);
    }
  }
  return { logSections, unscopedErrors };
}
function lastProposedArtifact(records) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (typeof records[index]?.proposed_artifact === "string") {
      return records[index].proposed_artifact;
    }
  }
  return null;
}
function resumeAgencyFromMetadata(resolution = {}, frontmatter = {}, options = {}) {
  const agency = resolution.agency ?? frontmatter.agency ?? options.agency ?? "moderate";
  return typeof agency === "string" && ["minimal", "moderate", "maximum"].includes(agency) ? agency : "moderate";
}
function resumeHashOptionsForAgency(agency = "moderate") {
  return agency === "minimal" ? STRICT_RESUME_HASH_OPTIONS : {};
}
function normalizeResumeRecords(records, peers = ["claude", "codex"], options = {}) {
  let peerIndex = 0;
  let currentArtifact = null;
  const hashOptions = resumeHashOptionsForAgency(options.agency);
  return asConsensusRecords(records).map((record) => {
    const isSynthesis = record?.record_type === "synthesis";
    const isSynthesisError = record?.record_type === "synthesis-error";
    const isHost = record?.verdict === "HOST_DECISION" || record?.agent === "host-orchestrator";
    const isUser = record?.verdict === "USER_INTERVENTION" || record?.agent === "user";
    const normalized = {
      schema_version: "v1",
      ...record
    };
    if (typeof normalized.proposed_artifact === "string") {
      currentArtifact = normalized.proposed_artifact;
    } else if (isSynthesis && typeof normalized.synthesized_artifact === "string") {
      currentArtifact = normalized.synthesized_artifact;
    }
    if (isSynthesis || isSynthesisError) {
      normalized.round_index ??= Math.floor(Math.max(peerIndex - 1, 0) / peers.length) + 1;
    } else if (isHost) {
      normalized.agent = "host-orchestrator";
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      normalized.turn_index ??= peerIndex + 1;
    } else if (isUser) {
      normalized.agent = "user";
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      normalized.turn_index ??= peerIndex + 1;
      normalized.reasoning ??= normalized.user_direction ?? "";
      normalized.user_direction ??= normalized.reasoning;
    } else {
      normalized.agent ??= peers[peerIndex % peers.length] ?? `peer-${peerIndex + 1}`;
      normalized.turn_index ??= peerIndex + 1;
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      peerIndex += 1;
    }
    if (!normalized.artifact_hash && currentArtifact !== null && !isSynthesisError) {
      normalized.artifact_hash = hashArtifact(currentArtifact, hashOptions);
    }
    return normalized;
  });
}
function normalizeResumeSection(state, logSection, index, options = {}) {
  const stateRecord = isJsonRecord3(state) ? state : {};
  const records = normalizeResumeRecords(
    logSection?.records ?? [],
    options.peers ?? void 0,
    {
      agency: options.agency
    }
  );
  const canonicalArtifact = typeof stateRecord.final_output === "string" ? stateRecord.final_output : null;
  const logArtifact = lastProposedArtifact(records);
  const resumedArtifact = canonicalArtifact ?? logArtifact;
  const status = logSection?.status ?? {};
  const sectionStatus = stateRecord.status ?? status.status ?? "unknown";
  const completed = sectionStatus === "converged";
  const hashOptions = resumeHashOptionsForAgency(options.agency);
  return {
    id: typeof stateRecord.id === "string" ? stateRecord.id : void 0,
    name: typeof stateRecord.name === "string" ? stateRecord.name : void 0,
    original_index: typeof stateRecord.original_index === "number" ? stateRecord.original_index : index,
    state: stateRecord,
    status,
    records,
    completed,
    inFlight: !completed,
    skipped: false,
    corruptErrors: [],
    resumedArtifact,
    resumedArtifactHash: resumedArtifact === null ? null : hashArtifact(resumedArtifact, hashOptions),
    resumedArtifactSource: canonicalArtifact !== null ? "section_state.final_output" : logArtifact !== null ? "deliberation_log.proposed_artifact" : null
  };
}
function resumeHashError(section, expectedHash, actualHash) {
  return {
    code: "RESUME_HASH_MISMATCH",
    section_id: section.id,
    section_name: section.name,
    message: `hash mismatch for section ${section.id}: expected ${expectedHash}, recomputed ${actualHash}`,
    expected_hash: expectedHash,
    actual_hash: actualHash
  };
}
function collectResumeValidationErrors(resumeSectionStates, logSections, unscopedErrors, options = {}) {
  const errors = [...unscopedErrors];
  if (logSections.length < resumeSectionStates.length) {
    for (let index = logSections.length; index < resumeSectionStates.length; index += 1) {
      const candidate = resumeSectionStates[index];
      const state = isJsonRecord3(candidate) ? candidate : {};
      const sectionId = typeof state.id === "string" ? state.id : void 0;
      const sectionName = typeof state.name === "string" ? state.name : void 0;
      errors.push({
        code: "RESUME_SECTION_STATE_MISSING",
        section_id: sectionId,
        section_name: sectionName,
        section_index: index,
        message: `missing section state for ${sectionId ?? `section index ${index}`}`
      });
    }
  } else if (logSections.length > resumeSectionStates.length) {
    for (let index = resumeSectionStates.length; index < logSections.length; index += 1) {
      errors.push({
        code: "RESUME_SECTION_STATE_MISSING",
        section_index: index,
        message: `deliberation log has no canonical section state for section index ${index}`
      });
    }
  }
  const sections = resumeSectionStates.map((state, index) => {
    const section = normalizeResumeSection(
      state,
      logSections[index],
      index,
      options
    );
    if (!state || typeof state !== "object" || Array.isArray(state) || !isJsonRecord3(state) || !state.id) {
      errors.push({
        code: "RESUME_SECTION_STATE_MISSING",
        section_index: index,
        message: `missing section state for section index ${index}`
      });
    }
    for (const error of logSections[index]?.errors ?? []) {
      errors.push({
        ...error,
        section_id: section.id,
        section_name: section.name,
        section_index: index
      });
    }
    if (!logSections[index]?.status) {
      errors.push({
        code: "RESUME_SECTION_STATE_MISSING",
        section_id: section.id,
        section_name: section.name,
        section_index: index,
        message: `missing section state for ${section.id}`
      });
    }
    const stateRecord = isJsonRecord3(state) ? state : {};
    const stateHash = typeof stateRecord.final_artifact_hash === "string" ? stateRecord.final_artifact_hash : null;
    const statusHash = logSections[index]?.status?.final_artifact_hash ?? null;
    if (stateHash && statusHash && stateHash !== statusHash) {
      errors.push(resumeHashError(section, stateHash, statusHash));
    }
    const hashOptions = resumeHashOptionsForAgency(options.agency);
    const peerCount = Array.isArray(options.peers) ? options.peers.length : 2;
    const peerRoundCounts = /* @__PURE__ */ new Map();
    for (const record of section.records ?? []) {
      const isPeer = record?.record_type !== "synthesis" && record?.record_type !== "synthesis-error" && record?.agent !== "user" && record?.agent !== "host-orchestrator" && record?.verdict !== "USER_INTERVENTION" && record?.verdict !== "HOST_DECISION";
      if (isPeer && Number.isInteger(Number(record?.round_index))) {
        const round2 = Number(record.round_index);
        peerRoundCounts.set(round2, (peerRoundCounts.get(round2) ?? 0) + 1);
      }
      if (record?.record_type !== "synthesis") continue;
      const round = Number(record?.round_index);
      if (Number.isInteger(round) && (peerRoundCounts.get(round) ?? 0) < peerCount) {
        errors.push({
          code: "RESUME_PAIR_INCOMPLETE",
          section_id: section.id,
          section_name: section.name,
          section_index: index,
          message: `incomplete peer pair for synthesized round ${round} in section ${section.id}: expected ${peerCount} peer records`
        });
      }
      if (typeof record.synthesized_artifact !== "string" || !record.artifact_hash)
        continue;
      const recomputed = hashArtifact(record.synthesized_artifact, hashOptions);
      if (recomputed !== record.artifact_hash) {
        errors.push({
          ...resumeHashError(section, record.artifact_hash, recomputed),
          code: "RESUME_SYNTHESIS_HASH_MISMATCH",
          message: `synthesis hash mismatch for section ${section.id}: expected ${record.artifact_hash}, recomputed ${recomputed}`
        });
      }
    }
    const expectedHash = statusHash ?? stateHash;
    if (expectedHash && section.resumedArtifact === null) {
      errors.push({
        code: "RESUME_SECTION_OUTPUT_MISSING",
        section_id: section.id,
        section_name: section.name,
        section_index: index,
        message: `missing canonical final output for section ${section.id}`
      });
    }
    if (section.resumedArtifact !== null && expectedHash && section.resumedArtifactHash !== expectedHash) {
      errors.push(
        resumeHashError(
          section,
          expectedHash,
          section.resumedArtifactHash ?? null
        )
      );
    }
    return section;
  });
  return { sections, errors };
}
async function writeResumeErrors(runDir, errors, skippedIds = []) {
  if (!runDir) return null;
  const outputPath = path7.join(runDir, "resume-errors.json");
  await mkdir5(runDir, { recursive: true });
  await writeFile4(
    outputPath,
    `${JSON.stringify(
      {
        consensus_schema_version: "v1",
        generated_at: nowIso(),
        errors,
        skipped_section_ids: skippedIds
      },
      null,
      2
    )}
`
  );
  await syncPathIfAvailable(outputPath);
  return outputPath;
}
async function defaultConfirmSkipAllCorrupt({
  errors,
  stdin = process.stdin,
  stdout = process.stdout
}) {
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      `Skip ${errors.length} corrupt resume section(s) and continue? [y/N] `
    );
    return /^y(?:es)?$/iu.test(answer.trim());
  } finally {
    rl.close();
  }
}
async function applyResumeSkipPolicy(sections, errors, options = {}) {
  const sectionErrors = errors.filter(
    (error) => typeof error.section_id === "string"
  );
  const explicitSkipIds = new Set(options.skipCorruptSections ?? []);
  let skipAll = Boolean(options.yesSkipCorrupt);
  if (!skipAll && options.skipAllCorrupt && sectionErrors.length > 0) {
    const confirm = options.confirmSkipAllCorrupt ?? defaultConfirmSkipAllCorrupt;
    skipAll = await confirm({
      errors: sectionErrors,
      stdin: options.stdin,
      stdout: options.stdout
    });
  }
  const skippedIds = /* @__PURE__ */ new Set();
  for (const error of sectionErrors) {
    if (skipAll || explicitSkipIds.has(error.section_id)) {
      skippedIds.add(error.section_id);
    }
  }
  for (const section of sections) {
    if (!skippedIds.has(section.id)) continue;
    section.skipped = true;
    section.inFlight = false;
    section.completed = false;
    section.corruptErrors = errors.filter(
      (error) => error.section_id === section.id
    );
  }
  return {
    skippedIds,
    unhandledErrors: errors.filter(
      (error) => !error.section_id || !skippedIds.has(error.section_id)
    )
  };
}
function corruptResumeError(errors, diagnosticsPath) {
  const details = {
    errors,
    ...diagnosticsPath ? { resume_errors_path: diagnosticsPath } : {}
  };
  const firstMessage = errors[0]?.message ? `: ${errors[0].message}` : "";
  return resumeDataError(
    `corrupt resume state${firstMessage}; resume is blocked until corrupt sections are skipped explicitly`,
    {
      code: "RESUME_CORRUPT",
      details
    }
  );
}
async function readResumePathOrText(pathOrText) {
  const value = String(pathOrText ?? "");
  if (!value.includes("\n")) {
    try {
      const fileStatus = await stat2(value);
      if (fileStatus.isFile()) {
        return {
          text: await readFile4(value, "utf8"),
          sourcePath: path7.resolve(value)
        };
      }
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(asErrorLike2(error).code ?? "")) {
        throw error;
      }
    }
  }
  return { text: value, sourcePath: null };
}
async function parseDeliberationArtifactForResume(pathOrText, options = {}) {
  const { text, sourcePath } = await readResumePathOrText(pathOrText);
  const frontmatter = parseFrontmatter(text);
  const consensusSchemaVersion = frontmatter.consensus_schema_version;
  if (consensusSchemaVersion !== "v1") {
    const found = consensusSchemaVersion ?? "(missing)";
    throw resumeDataError(
      `cannot resume consensus_schema_version ${found}: this build resumes only v1 artifacts, and there is no migration from v0. Complete in-flight v0 runs under consensus v0.1 or restart them under v1.`,
      {
        code: "SCHEMA_VERSION_MISMATCH",
        details: { found: consensusSchemaVersion ?? null, expected: "v1" }
      }
    );
  }
  const resolutions = extractConsensusJsonBlocks(text, "consensus-resolution");
  const sectionStatesBlocks = extractConsensusJsonBlocks(
    text,
    "consensus-section-states"
  );
  if (resolutions.length !== 1) {
    throw resumeDataError(
      "resume artifact must contain exactly one consensus-resolution block",
      {
        code: "RESUME_RESOLUTION_MISSING",
        details: { count: resolutions.length }
      }
    );
  }
  if (sectionStatesBlocks.length !== 1 || !Array.isArray(sectionStatesBlocks[0])) {
    throw resumeDataError(
      "resume artifact must contain one consensus-section-states array block",
      {
        code: "RESUME_SECTION_STATE_MISSING",
        details: { count: sectionStatesBlocks.length }
      }
    );
  }
  const resolution = isJsonRecord3(resolutions[0]) ? resolutions[0] : {};
  const resumeSectionStates = sectionStatesBlocks[0];
  const { logSections, unscopedErrors } = extractLogSectionBlocks(text);
  const resumeAgency = resumeAgencyFromMetadata(
    resolution,
    frontmatter,
    options
  );
  const { sections, errors } = collectResumeValidationErrors(
    resumeSectionStates,
    logSections,
    unscopedErrors,
    {
      peers: Array.isArray(resolution.peers) ? resolution.peers.map(String) : void 0,
      agency: resumeAgency
    }
  );
  const { skippedIds, unhandledErrors } = await applyResumeSkipPolicy(
    sections,
    errors,
    options
  );
  const diagnosticsPath = errors.length > 0 ? await writeResumeErrors(options.runDir, errors, [...skippedIds]) : null;
  if (unhandledErrors.length > 0) {
    throw corruptResumeError(unhandledErrors, diagnosticsPath);
  }
  return {
    sourcePath,
    consensusSchemaVersion,
    frontmatter,
    resolution,
    sectionStates: resumeSectionStates,
    sections,
    completedSections: sections.filter((section) => section.completed),
    inFlightSections: sections.filter((section) => section.inFlight),
    skippedCorruptSections: sections.filter((section) => section.skipped),
    resumeErrors: errors,
    resumeErrorsPath: diagnosticsPath
  };
}
export {
  parseDeliberationArtifactForResume
};
