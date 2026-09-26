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

// src/skills/refine/src/refine-escalation.ts
function lastTwoPeerRevisionRecords(records) {
  const peers = records.filter(
    (record) => record?.agent !== "user" && record?.agent !== "host-orchestrator" && record?.verdict !== "USER_INTERVENTION" && record?.verdict !== "HOST_DECISION" && record?.record_type !== "synthesis" && record?.record_type !== "synthesis-error"
  );
  return peers.slice(-2);
}
function latestSynthesisRecord(records) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]?.record_type === "synthesis") return records[index];
  }
  return null;
}
function revisionText(record) {
  if (typeof record?.proposed_artifact === "string")
    return record.proposed_artifact;
  if (typeof record?.synthesized_artifact === "string")
    return record.synthesized_artifact;
  return "";
}
function buildEscalationEvent(section, { artifactPath } = {}) {
  const escalation = section?.status?.escalation;
  if (!escalation) return null;
  const records = section.records ?? [];
  const [left, right] = lastTwoPeerRevisionRecords(records);
  const synthesis = latestSynthesisRecord(records);
  const divergent = {
    a: {
      agent: left?.agent ?? escalation.divergent?.a?.agent ?? null,
      text: revisionText(left)
    },
    b: {
      agent: right?.agent ?? escalation.divergent?.b?.agent ?? null,
      text: revisionText(right)
    }
  };
  if (synthesis || escalation.divergent?.synthesis) {
    divergent.synthesis = {
      text: revisionText(synthesis),
      unresolved_disagreements: Array.isArray(
        synthesis?.unresolved_disagreements
      ) ? synthesis.unresolved_disagreements : escalation.divergent?.synthesis?.unresolved_disagreements ?? []
    };
  }
  const flag = escalation.decide_via === "user" ? "--user-direction" : "--host-direction";
  const event = {
    section_id: section.id,
    section_name: section.name,
    trigger: escalation.trigger,
    decide_via: escalation.decide_via,
    decision_kinds: escalation.decision_kinds ?? [],
    divergent,
    resume: { artifact_path: artifactPath ?? null, flag }
  };
  if (escalation.promoted_from) {
    event.promoted_from = escalation.promoted_from;
  }
  return event;
}
function escalatedSections(sections) {
  return sections.filter((section) => section.status?.status === "escalation");
}
function escalationRoutingError(message, details = {}) {
  return new ConsensusError(message, {
    code: "ESCALATION_ROUTING",
    exitCode: EXIT_CODES.CONFIG,
    details
  });
}
function assertHostDirectionRoutable(resumeSection) {
  const escalation = resumeSection?.status?.escalation;
  if (resumeSection?.status?.status !== "escalation" || !escalation) {
    throw escalationRoutingError(
      "--host-direction supplied but no escalation is pending for resume",
      {
        section_status: resumeSection?.status?.status ?? null
      }
    );
  }
  if (escalation.decide_via !== "host") {
    throw escalationRoutingError(
      `--host-direction rejected: pending escalation routes to ${escalation.decide_via}`,
      { decide_via: escalation.decide_via, trigger: escalation.trigger }
    );
  }
  return escalation;
}
function failingSections(sections) {
  return sections.filter((section) => {
    const sectionStatus = section.status?.status;
    return sectionStatus === "error" || sectionStatus === "impasse";
  }).map((section) => ({
    id: section.id,
    name: section.name,
    original_index: section.original_index,
    status: section.status?.status ?? "unknown",
    termination_reason: section.status?.termination_reason ?? null
  }));
}
export {
  assertHostDirectionRoutable,
  buildEscalationEvent,
  escalatedSections,
  failingSections
};
