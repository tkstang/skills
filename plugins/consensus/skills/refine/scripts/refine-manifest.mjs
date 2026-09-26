// GENERATED skill payload for refine.

// src/skills/refine/src/refine-manifest.ts
import { realpath as realpath3 } from "node:fs/promises";
import path7 from "node:path";

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
function inside2(root, target) {
  const relative = path6.relative(root, target);
  return relative === "" || !relative.startsWith("..") && !path6.isAbsolute(relative);
}
async function pathExists2(targetPath) {
  try {
    await lstat3(targetPath);
    return true;
  } catch (error) {
    if (asErrorLike2(error).code === "ENOENT") return false;
    throw error;
  }
}
async function nearestExistingPath2(targetPath) {
  let current = path6.resolve(targetPath);
  while (!await pathExists2(current)) {
    const parent = path6.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

// src/skills/refine/src/refine-manifest.ts
function manifestError(message, details = {}) {
  return new ConsensusError(message, {
    code: typeof details.code === "string" ? details.code : "INVALID_MANIFEST",
    exitCode: typeof details.exitCode === "number" ? details.exitCode : EXIT_CODES.CONFIG,
    details: details.details
  });
}
function pathConfinementError(field, target, root) {
  return manifestError(`${field} path is outside allowed root: ${target}`, {
    code: "PATH_OUTSIDE_ROOT",
    exitCode: EXIT_CODES.NOPERM,
    details: { field, path: target, root }
  });
}
function runDirConfinementError(field, target, runDir) {
  return manifestError(
    `${field} path is outside prepared run directory: ${target}`,
    {
      code: "PATH_OUTSIDE_RUN_DIR",
      exitCode: EXIT_CODES.NOPERM,
      details: { field, path: target, run_dir: runDir }
    }
  );
}
function requiredManifestString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw manifestError(
      `parallel manifest ${field} must be a non-empty string`
    );
  }
}
function requiredManifestInteger(value, field) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw manifestError(
      `parallel manifest ${field} must be a non-negative integer`
    );
  }
}
function validateParallelManifestShape(manifest) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw manifestError("parallel manifest must be a JSON object");
  }
  const record = manifest;
  if (record.consensus_schema_version !== "v1") {
    throw manifestError(
      "parallel manifest consensus_schema_version must be v1"
    );
  }
  if (record.manifest_type !== "consensus-parallel-run") {
    throw manifestError(
      "parallel manifest manifest_type must be consensus-parallel-run"
    );
  }
  if (record.mode !== "parallel") {
    throw manifestError("parallel manifest mode must be parallel");
  }
  for (const field of ["input_path", "output_path", "run_dir"]) {
    requiredManifestString(record[field], field);
  }
  if (!Array.isArray(record.sections)) {
    throw manifestError("parallel manifest sections must be an array");
  }
  for (const [index, entry] of record.sections.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw manifestError(
        `parallel manifest sections[${index}] must be a JSON object`
      );
    }
    const section = entry;
    for (const field of [
      "section_id",
      "name",
      "packet_path",
      "section_file",
      "output_records",
      "output_section",
      "output_status",
      "subagent_id"
    ]) {
      requiredManifestString(section[field], `sections[${index}].${field}`);
    }
    requiredManifestInteger(
      section.original_index,
      `sections[${index}].original_index`
    );
  }
}
function resolveManifestPathValue(value, basePath) {
  return path7.isAbsolute(value) ? path7.resolve(value) : path7.resolve(basePath, value);
}
async function assertPathResolvesInside(rootPath, targetPath, field, errorFactory) {
  const root = path7.resolve(rootPath);
  const target = path7.resolve(targetPath);
  const realRoot = await realpath3(root);
  const existing = await nearestExistingPath2(target);
  const realExisting = await realpath3(existing);
  const realTarget = path7.resolve(
    realExisting,
    path7.relative(existing, target)
  );
  if (!inside2(realRoot, realTarget)) {
    throw errorFactory(field, target, root);
  }
}
async function resolveConfinedManifestPath(value, {
  root,
  base,
  field,
  errorFactory
}) {
  requiredManifestString(value, field);
  const resolved = resolveManifestPathValue(value, base);
  const resolvedRoot = path7.resolve(root);
  if (!inside2(resolvedRoot, resolved)) {
    throw errorFactory(field, resolved, resolvedRoot);
  }
  await assertPathResolvesInside(resolvedRoot, resolved, field, errorFactory);
  return resolved;
}
async function resolveManifestOutputPath(manifest, { cwd, trustedRoot }) {
  const inputPath = resolveManifestPathValue(manifest.input_path, cwd);
  const outputPath = resolveManifestPathValue(manifest.output_path, cwd);
  const defaultOutputPath = path7.resolve(`${inputPath}.consensus.md`);
  if (outputPath === defaultOutputPath) {
    const outputWriteRoot = path7.dirname(inputPath);
    await assertPathResolvesInside(
      outputWriteRoot,
      outputPath,
      "output_path",
      pathConfinementError
    );
    return { inputPath, outputPath, outputWriteRoot };
  }
  return {
    inputPath,
    outputPath: await resolveConfinedManifestPath(manifest.output_path, {
      root: trustedRoot,
      base: cwd,
      field: "output_path",
      errorFactory: pathConfinementError
    }),
    outputWriteRoot: trustedRoot
  };
}
async function normalizeParallelManifest(manifest, options) {
  validateParallelManifestShape(manifest);
  const cwd = path7.resolve(options.cwd);
  const trustedRoot = path7.resolve(options.trustedRoot);
  const manifestPath = path7.resolve(options.manifestPath);
  const runDir = await resolveConfinedManifestPath(manifest.run_dir, {
    root: trustedRoot,
    base: cwd,
    field: "run_dir",
    errorFactory: pathConfinementError
  });
  if (runDir !== path7.dirname(manifestPath)) {
    throw manifestError(
      "parallel manifest run_dir must match the manifest file directory"
    );
  }
  if (manifest.manifest_path !== void 0) {
    const declaredManifestPath = await resolveConfinedManifestPath(
      manifest.manifest_path,
      {
        root: trustedRoot,
        base: cwd,
        field: "manifest_path",
        errorFactory: pathConfinementError
      }
    );
    if (declaredManifestPath !== manifestPath) {
      throw manifestError(
        "parallel manifest manifest_path must match the fan-in manifest path"
      );
    }
  }
  const { inputPath, outputPath, outputWriteRoot } = await resolveManifestOutputPath(manifest, { cwd, trustedRoot });
  const sections = [];
  for (const entry of manifest.sections) {
    sections.push({
      ...entry,
      packet_path: await resolveConfinedManifestPath(entry.packet_path, {
        root: runDir,
        base: runDir,
        field: "packet_path",
        errorFactory: runDirConfinementError
      }),
      section_file: await resolveConfinedManifestPath(entry.section_file, {
        root: runDir,
        base: runDir,
        field: "section_file",
        errorFactory: runDirConfinementError
      }),
      output_records: await resolveConfinedManifestPath(entry.output_records, {
        root: runDir,
        base: runDir,
        field: "output_records",
        errorFactory: runDirConfinementError
      }),
      output_section: await resolveConfinedManifestPath(entry.output_section, {
        root: runDir,
        base: runDir,
        field: "output_section",
        errorFactory: runDirConfinementError
      }),
      output_status: await resolveConfinedManifestPath(entry.output_status, {
        root: runDir,
        base: runDir,
        field: "output_status",
        errorFactory: runDirConfinementError
      })
    });
  }
  return {
    ...manifest,
    input_path: inputPath,
    output_path: outputPath,
    output_write_root: outputWriteRoot,
    run_dir: runDir,
    manifest_path: manifestPath,
    sections
  };
}
export {
  assertPathResolvesInside,
  normalizeParallelManifest,
  pathConfinementError,
  resolveManifestPathValue
};
