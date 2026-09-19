#!/usr/bin/env node
// GENERATED skill payload for session-observer-collab.

// src/skills/session-observer-collab/src/collab-control.mjs
import { randomUUID as randomUUID3 } from "node:crypto";
import { chmod as chmod4, mkdir as mkdir4, open as open6, readFile as readFile5, rm as rm4 } from "node:fs/promises";
import { join as join5 } from "node:path";
import { fileURLToPath } from "node:url";

// src/skills/session-observer-collab/src/codex-lifecycle.mjs
import { randomUUID as randomUUID2 } from "node:crypto";
import {
  chmod as chmod3,
  mkdir as mkdir3,
  open as open2,
  readdir as readdir3,
  readFile as readFile3,
  rename as rename3,
  rm as rm3,
  writeFile as writeFile2
} from "node:fs/promises";
import { dirname as dirname3, join as join3 } from "node:path";

// src/skills/session-observer-collab/src/lib/codex-install.mjs
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
var BUNDLE_OWNER = "session-observer-collab-codex-stop";
var MANIFEST = ".session-observer-collab-bundle.json";
var FILES = ["session-observer-collab/scripts/hooks/codex-stop.mjs"];
function bundlePaths(scriptPath) {
  const parent = dirname(scriptPath);
  return {
    parent,
    supportRoot: join(parent, `.${basename(scriptPath)}.support`)
  };
}
async function sourceFiles(sourceScriptPath) {
  const collabScripts = dirname(dirname(sourceScriptPath));
  const skillsRoot = dirname(dirname(collabScripts));
  const files = [];
  const hash = createHash("sha256");
  for (const relativePath of FILES) {
    const source = join(skillsRoot, relativePath);
    const content = await readFile(source);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
    files.push({ relativePath, source });
  }
  return { files, version: hash.digest("hex").slice(0, 24) };
}
async function ownerOnlyDirectory(path) {
  await mkdir(path, { recursive: true, mode: 448 });
  await chmod(path, 448);
}
async function copyBundle(stage, files, version) {
  await ownerOnlyDirectory(stage);
  for (const file of files) {
    const destination = join(stage, file.relativePath);
    await ownerOnlyDirectory(dirname(destination));
    await copyFile(file.source, destination);
    await chmod(destination, 384);
  }
  const manifest = join(stage, MANIFEST);
  await writeFile(
    manifest,
    `${JSON.stringify({ owner: BUNDLE_OWNER, version, files: FILES }, null, 2)}
`,
    { mode: 384 }
  );
  await chmod(manifest, 384);
}
async function ownedVersion(path, version) {
  try {
    const value = JSON.parse(await readFile(join(path, MANIFEST), "utf8"));
    return value.owner === BUNDLE_OWNER && value.version === version;
  } catch {
    return false;
  }
}
async function ownedArtifact(path) {
  try {
    const value = JSON.parse(await readFile(join(path, MANIFEST), "utf8"));
    return value.owner === BUNDLE_OWNER;
  } catch {
    return false;
  }
}
async function secureBundle(path) {
  await chmod(path, 448);
  for (const relativePath of FILES) {
    const file = join(path, relativePath);
    await chmod(file, 384);
    let parent = dirname(file);
    while (parent !== path) {
      await chmod(parent, 448);
      parent = dirname(parent);
    }
  }
  await chmod(join(path, MANIFEST), 384);
}
function launcherContent(scriptPath, supportRoot, version) {
  const entry = join(
    supportRoot,
    version,
    "session-observer-collab/scripts/hooks/codex-stop.mjs"
  );
  const specifier = relative(dirname(scriptPath), entry).replaceAll("\\", "/");
  return [
    "#!/usr/bin/env node",
    `// ${BUNDLE_OWNER}:${version}`,
    `import { runCodexStopMain } from ${JSON.stringify(`./${specifier}`)};`,
    "runCodexStopMain().catch(() => {});",
    ""
  ].join("\n");
}
async function readIfFile(path) {
  try {
    if (!(await stat(path)).isFile()) return null;
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
async function cleanOwnedVersions(supportRoot, keep) {
  let names;
  try {
    names = await readdir(supportRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const path = join(supportRoot, name);
    if (name === keep) continue;
    if (name.startsWith(".stage-") && await ownedArtifact(path) || await ownedVersion(path, name))
      await rm(path, { recursive: true, force: true });
  }
  if ((await readdir(supportRoot)).length === 0)
    await rm(supportRoot, { recursive: true, force: true });
}
async function removeEmptySupportRoot(supportRoot) {
  try {
    if ((await readdir(supportRoot)).length === 0)
      await rm(supportRoot, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function prepareSupportRoot(supportRoot) {
  try {
    const names = await readdir(supportRoot);
    let owned = false;
    for (const name of names) {
      if (await ownedArtifact(join(supportRoot, name))) {
        owned = true;
        break;
      }
    }
    if (!owned)
      throw new Error(
        `refusing unowned Codex hook support directory: ${supportRoot}`
      );
    await chmod(supportRoot, 448);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await ownerOnlyDirectory(supportRoot);
  }
}
async function installCodexStopBundle({
  scriptPath: rawScriptPath,
  sourceScriptPath: rawSourceScriptPath
}) {
  const scriptPath = resolve(rawScriptPath);
  const sourceScriptPath = resolve(rawSourceScriptPath);
  const { files, version } = await sourceFiles(sourceScriptPath);
  const { parent, supportRoot } = bundlePaths(scriptPath);
  const final = join(supportRoot, version);
  const stage = join(supportRoot, `.stage-${process.pid}-${version}`);
  const launcher = launcherContent(scriptPath, supportRoot, version);
  const temporary = `${scriptPath}.${process.pid}.${version}.tmp`;
  let createdVersion = false;
  await mkdir(parent, { recursive: true, mode: 448 });
  await prepareSupportRoot(supportRoot);
  try {
    if (!await ownedVersion(final, version)) {
      await rm(stage, { recursive: true, force: true });
      await copyBundle(stage, files, version);
      await rename(stage, final);
      createdVersion = true;
    }
    await secureBundle(final);
    const current = await readIfFile(scriptPath);
    if (current !== launcher) {
      await writeFile(temporary, launcher, { mode: 448 });
      await chmod(temporary, 448);
      await rename(temporary, scriptPath);
    }
    await chmod(scriptPath, 448);
    await cleanOwnedVersions(supportRoot, version);
    return {
      changed: current !== launcher,
      scriptPath,
      supportRoot,
      version
    };
  } catch (error) {
    await rm(temporary, { force: true });
    await rm(stage, { recursive: true, force: true });
    if (createdVersion) await rm(final, { recursive: true, force: true });
    await removeEmptySupportRoot(supportRoot);
    throw error;
  }
}
async function removeCodexStopBundle(scriptPath) {
  const absolute = resolve(scriptPath);
  const { supportRoot } = bundlePaths(absolute);
  const launcher = await readIfFile(absolute);
  const match = launcher?.match(
    new RegExp(`^// ${BUNDLE_OWNER}:([a-f0-9]{24})$`, "m")
  );
  if (!match || !await ownedVersion(join(supportRoot, match[1]), match[1]))
    return { scriptRemoved: false, supportRemoved: false };
  await rm(absolute);
  await cleanOwnedVersions(supportRoot, null);
  let supportRemoved = false;
  try {
    await stat(supportRoot);
  } catch (error) {
    if (error?.code === "ENOENT") supportRemoved = true;
    else throw error;
  }
  return { scriptRemoved: true, supportRemoved };
}

// src/skills/session-observer-collab/src/lib/lease-state.mjs
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod as chmod2,
  lstat,
  mkdir as mkdir2,
  open,
  readFile as readFile2,
  readdir as readdir2,
  realpath,
  rename as rename2,
  rm as rm2
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename as basename2, dirname as dirname2, isAbsolute, join as join2, resolve as resolve2, sep } from "node:path";
var LEASE_SCHEMA_VERSION = 6;
var LEASE_STATES = Object.freeze([
  "armed",
  "waiting",
  "idle",
  "triggered",
  "disarmed"
]);
var DEFAULT_WAIT_MS = 5e3;
var MAX_WAIT_MS = 6e4;
var MAX_LEASE_MS = 24 * 60 * 60 * 1e3;
var MAX_CONTINUATIONS = 100;
var MAX_LOOPS = 1e3;
var ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
var OWNER_RUNTIMES = /* @__PURE__ */ new Set(["codex", "cursor"]);
var PEER_RUNTIMES = /* @__PURE__ */ new Set(["claude-code", "codex", "cursor"]);
var RECORD_INDEX_BASE = "zero-based-jsonl-record-index";
var FRAME_INDEX_BASE = "zero-based-jsonl-frame-index";
var CURSOR_TRANSCRIPT_STORE = "agent-transcripts";
var LeaseError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LeaseError";
    this.code = code;
  }
};
function stateRoot(env = process.env) {
  if (env.SESSION_OBSERVER_STATE_DIR) {
    if (!isAbsolute(env.SESSION_OBSERVER_STATE_DIR))
      throw new LeaseError(
        "invalid-state-root",
        "SESSION_OBSERVER_STATE_DIR must be absolute"
      );
    return resolve2(env.SESSION_OBSERVER_STATE_DIR);
  }
  const base = env.XDG_STATE_HOME || join2(env.HOME || homedir(), ".local", "state");
  if (!isAbsolute(base))
    throw new LeaseError(
      "invalid-state-root",
      "XDG_STATE_HOME must be absolute"
    );
  return join2(resolve2(base), "session-observer", "collab");
}
function validateId(value, label = "session") {
  if (typeof value !== "string" || !ID.test(value) || value === "." || value === "..") {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be a safe non-empty identifier`
    );
  }
  return value;
}
function validateOwnerRuntime(value) {
  if (!OWNER_RUNTIMES.has(value))
    throw new LeaseError(
      "invalid-owner-runtime",
      "owner runtime must be codex or cursor"
    );
  return value;
}
function validatePeerRuntime(value) {
  if (!PEER_RUNTIMES.has(value))
    throw new LeaseError(
      "invalid-peer-runtime",
      "peer runtime must be claude-code, codex, or cursor"
    );
  return value;
}
function validateAbsolutePath(value, label) {
  if (typeof value !== "string" || !isAbsolute(value) || value.includes("\0")) {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be an absolute path`
    );
  }
  return resolve2(value);
}
function peerIndexBase(peerRuntime) {
  validatePeerRuntime(peerRuntime);
  return peerRuntime === "cursor" ? FRAME_INDEX_BASE : RECORD_INDEX_BASE;
}
function validatePeerIndexBase(value, peerRuntime) {
  const expected = peerIndexBase(peerRuntime);
  if (value !== expected) {
    throw new LeaseError(
      "invalid-peer-index-base",
      `${peerRuntime} peer index base must be ${expected}`
    );
  }
  return value;
}
function cursorTranscriptStore(transcriptPath) {
  let current = dirname2(transcriptPath);
  while (dirname2(current) !== current) {
    if (basename2(current) === CURSOR_TRANSCRIPT_STORE) {
      const projectsRoot = dirname2(dirname2(current));
      const cursorRoot = dirname2(projectsRoot);
      if (basename2(projectsRoot) !== "projects" || basename2(cursorRoot) !== ".cursor") {
        throw new LeaseError(
          "unsupported-peer-transcript-store",
          "Cursor peer transcript must use the supported .cursor/projects store"
        );
      }
      return current;
    }
    current = dirname2(current);
  }
  throw new LeaseError(
    "unsupported-peer-transcript-store",
    "Cursor peer transcript must be inside a supported agent-transcripts store"
  );
}
async function canonicalizePeerTranscript(peerRuntime, peerTranscript) {
  validatePeerRuntime(peerRuntime);
  const requested = validateAbsolutePath(peerTranscript, "peer-transcript");
  let canonicalTranscript;
  try {
    canonicalTranscript = await realpath(requested);
  } catch (error) {
    throw new LeaseError(
      "peer-transcript-unavailable",
      `peer transcript cannot be canonicalized: ${error.message}`
    );
  }
  if (peerRuntime === "cursor") {
    const requestedStore = cursorTranscriptStore(requested);
    let canonicalStore;
    try {
      canonicalStore = await realpath(requestedStore);
    } catch (error) {
      throw new LeaseError(
        "unsupported-peer-transcript-store",
        `Cursor transcript store cannot be canonicalized: ${error.message}`
      );
    }
    if (!canonicalTranscript.startsWith(`${canonicalStore}${sep}`)) {
      throw new LeaseError(
        "peer-transcript-outside-store",
        "canonical Cursor peer transcript escapes its supported store"
      );
    }
  }
  return Object.freeze({
    peerTranscript: canonicalTranscript,
    peerCanonicalTranscriptPath: canonicalTranscript,
    peerIndexBase: peerIndexBase(peerRuntime)
  });
}
function validatePeerTranscriptSession(peerRuntime, peerSession, peerTranscript) {
  validatePeerRuntime(peerRuntime);
  validateId(peerSession, "peer-session");
  const transcript = validateAbsolutePath(peerTranscript, "peer-transcript");
  if (peerRuntime === "cursor" && (basename2(dirname2(transcript)) !== peerSession || basename2(transcript) !== `${peerSession}.jsonl`)) {
    throw new LeaseError(
      "peer-session-transcript-mismatch",
      "Cursor peer session must match the canonical transcript directory and filename"
    );
  }
  return transcript;
}
function leasePath(root, ownerSession) {
  validateId(ownerSession, "owner-session");
  const leases = join2(resolve2(root), "leases");
  const candidate = join2(leases, `${ownerSession}.json`);
  if (!candidate.startsWith(`${leases}${sep}`))
    throw new LeaseError("invalid-owner-session", "unsafe lease path");
  return candidate;
}
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new LeaseError(
      "malformed-lease",
      `${name} must be an integer from ${min} to ${max}`
    );
  }
  return value;
}
function timestamp(value, name) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new LeaseError("malformed-lease", `${name} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}
function migrateLease(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new LeaseError("malformed-lease", "lease must be an object");
  if (input.schemaVersion === 1) {
    input = {
      ...input,
      schemaVersion: 2,
      continuationCount: input.triggerCount ?? input.continuationCount ?? 0,
      continuationCap: input.triggerCap ?? input.continuationCap ?? 1,
      loopCount: input.loopCount ?? 0,
      loopCap: input.loopCap ?? 1,
      diagnostic: input.diagnostic ?? null
    };
    delete input.triggerCount;
    delete input.triggerCap;
  }
  if (input.schemaVersion === 2) {
    if (input.peerRuntime === void 0) {
      throw new LeaseError(
        "peer-runtime-rearm-required",
        "legacy lease is missing peerRuntime; re-arm required"
      );
    }
    input = {
      ...input,
      schemaVersion: 3,
      leaseMs: input.leaseMs ?? Date.parse(input.expiresAt) - Date.parse(input.armedAt)
    };
  }
  if (input.schemaVersion === 3) {
    if (input.peerRuntime === void 0) {
      throw new LeaseError(
        "peer-runtime-rearm-required",
        "legacy lease is missing peerRuntime; re-arm required"
      );
    }
    input = {
      ...input,
      schemaVersion: 4,
      waitStartedAt: input.waitStartedAt ?? null,
      waitDeadlineAt: input.waitDeadlineAt ?? null
    };
  }
  if (input.schemaVersion === 4) {
    input = {
      ...input,
      schemaVersion: 5,
      waitToken: null,
      waitPid: null
    };
  }
  if (input.schemaVersion === 5) {
    if (input.peerRuntime === "cursor") {
      throw new LeaseError(
        "cursor-lease-rearm-required",
        "legacy Cursor lease uses an unverified record cursor; explicit re-arm required"
      );
    }
    input = {
      ...input,
      schemaVersion: 6,
      peerTranscript: validateAbsolutePath(
        input.peerTranscript,
        "peer-transcript"
      ),
      peerCanonicalTranscriptPath: validateAbsolutePath(
        input.peerTranscript,
        "peer-transcript"
      ),
      peerIndexBase: RECORD_INDEX_BASE,
      peerContinuity: null
    };
  }
  if (input.schemaVersion !== LEASE_SCHEMA_VERSION) {
    throw new LeaseError(
      "unsupported-schema",
      `unsupported lease schema: ${String(input.schemaVersion)}`
    );
  }
  return input;
}
function validateLease(raw) {
  const value = migrateLease(structuredClone(raw));
  validateId(value.leaseId, "lease-id");
  validateOwnerRuntime(value.runtime);
  validatePeerRuntime(value.peerRuntime);
  validateId(value.ownerSession, "owner-session");
  validateId(value.peerSession, "peer-session");
  value.ownerCwd = validateAbsolutePath(value.ownerCwd, "owner-cwd");
  value.peerTranscript = validateAbsolutePath(
    value.peerTranscript,
    "peer-transcript"
  );
  value.peerCanonicalTranscriptPath = validateAbsolutePath(
    value.peerCanonicalTranscriptPath,
    "peer-canonical-transcript-path"
  );
  if (value.peerTranscript !== value.peerCanonicalTranscriptPath) {
    throw new LeaseError(
      "malformed-lease",
      "peer transcript must contain only its canonical path"
    );
  }
  validatePeerIndexBase(value.peerIndexBase, value.peerRuntime);
  if (!LEASE_STATES.includes(value.state))
    throw new LeaseError("malformed-lease", "invalid lease state");
  value.armedAt = timestamp(value.armedAt, "armedAt");
  value.expiresAt = timestamp(value.expiresAt, "expiresAt");
  value.updatedAt = timestamp(value.updatedAt, "updatedAt");
  if (value.waitStartedAt === null !== (value.waitDeadlineAt === null)) {
    throw new LeaseError(
      "malformed-lease",
      "wait timing fields must both be timestamps or both be null"
    );
  }
  if (value.waitStartedAt !== null) {
    value.waitStartedAt = timestamp(value.waitStartedAt, "waitStartedAt");
    value.waitDeadlineAt = timestamp(value.waitDeadlineAt, "waitDeadlineAt");
  }
  const waiterFields = [value.waitToken, value.waitPid];
  const nullWaiterFields = waiterFields.filter(
    (field) => field === null
  ).length;
  if (nullWaiterFields !== 0 && nullWaiterFields !== waiterFields.length) {
    throw new LeaseError(
      "malformed-lease",
      "waiter identity fields must all be populated or all be null"
    );
  }
  if (nullWaiterFields === 0) {
    validateId(value.waitToken, "wait-token");
    integer(value.waitPid, "waitPid", 1, Number.MAX_SAFE_INTEGER);
  }
  integer(value.waitMs, "waitMs", 0, MAX_WAIT_MS);
  integer(value.leaseMs, "leaseMs", 1, MAX_LEASE_MS);
  integer(value.peerCursor, "peerCursor", 0, Number.MAX_SAFE_INTEGER);
  if (value.peerRuntime === "cursor" && value.peerContinuity === null) {
    throw new LeaseError(
      "cursor-lease-rearm-required",
      "Cursor lease is missing a continuity checkpoint; explicit re-arm required"
    );
  }
  if (value.peerContinuity !== null) {
    const checkpoint = value.peerContinuity;
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint) || value.peerRuntime !== "cursor" || value.peerIndexBase !== FRAME_INDEX_BASE) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity is allowed only for Cursor frame-index leases"
      );
    }
    if (checkpoint.indexBase !== FRAME_INDEX_BASE) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity index base must match the lease index base"
      );
    }
    integer(
      checkpoint.nextFrameIndex,
      "peerContinuity.nextFrameIndex",
      0,
      Number.MAX_SAFE_INTEGER
    );
    integer(
      checkpoint.prefixBytes,
      "peerContinuity.prefixBytes",
      0,
      Number.MAX_SAFE_INTEGER
    );
    integer(
      checkpoint.observedSize,
      "peerContinuity.observedSize",
      0,
      Number.MAX_SAFE_INTEGER
    );
    if (checkpoint.nextFrameIndex !== value.peerCursor || checkpoint.prefixBytes > checkpoint.observedSize) {
      throw new LeaseError(
        "malformed-lease",
        "peer cursor must match its bounded continuity checkpoint"
      );
    }
    if (typeof checkpoint.prefixSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(checkpoint.prefixSha256)) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity prefixSha256 must be a lowercase SHA-256 digest"
      );
    }
    for (const field of ["device", "inode"]) {
      if (checkpoint[field] !== null) {
        integer(
          checkpoint[field],
          `peerContinuity.${field}`,
          0,
          Number.MAX_SAFE_INTEGER
        );
      }
    }
  }
  integer(value.continuationCount, "continuationCount", 0, MAX_CONTINUATIONS);
  integer(value.continuationCap, "continuationCap", 1, MAX_CONTINUATIONS);
  integer(value.loopCount, "loopCount", 0, MAX_LOOPS);
  integer(value.loopCap, "loopCap", 1, MAX_LOOPS);
  if (value.continuationCount > value.continuationCap || value.loopCount > value.loopCap) {
    throw new LeaseError("malformed-lease", "lease counters exceed their caps");
  }
  if (value.state !== "waiting" && value.waitStartedAt !== null) {
    throw new LeaseError(
      "malformed-lease",
      "only waiting leases may retain wait timing fields"
    );
  }
  if (value.state !== "waiting" && nullWaiterFields !== waiterFields.length) {
    throw new LeaseError(
      "malformed-lease",
      "only waiting leases may retain waiter identity"
    );
  }
  if (value.waitStartedAt !== null) {
    const waitStarted = Date.parse(value.waitStartedAt);
    const waitDeadline = Date.parse(value.waitDeadlineAt);
    if (waitDeadline < waitStarted || waitDeadline - waitStarted > value.waitMs || waitDeadline > Date.parse(value.expiresAt)) {
      throw new LeaseError(
        "malformed-lease",
        "wait deadline must be bounded by waitMs and lease expiry"
      );
    }
  }
  if (Date.parse(value.expiresAt) < Date.parse(value.armedAt) || Date.parse(value.expiresAt) - Date.parse(value.armedAt) !== value.leaseMs) {
    throw new LeaseError(
      "malformed-lease",
      "lease expiry must match its finite lease duration"
    );
  }
  if (value.diagnostic !== null && typeof value.diagnostic !== "string")
    throw new LeaseError(
      "malformed-lease",
      "diagnostic must be a string or null"
    );
  return value;
}
function effectiveLease(lease, now = Date.now()) {
  const value = validateLease(lease);
  if ((value.state === "armed" || value.state === "waiting") && now >= Date.parse(value.expiresAt)) {
    value.state = "idle";
    value.diagnostic = "lease-expired";
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
    value.waitToken = null;
    value.waitPid = null;
  }
  if ((value.state === "armed" || value.state === "waiting") && (value.continuationCount >= value.continuationCap || value.loopCount >= value.loopCap)) {
    value.state = "idle";
    value.diagnostic = "cap-reached";
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
    value.waitToken = null;
    value.waitPid = null;
  }
  if (value.state === "waiting" && (value.waitDeadlineAt === null || now >= Date.parse(value.waitDeadlineAt))) {
    value.state = "idle";
    value.diagnostic = value.waitDeadlineAt === null ? "wait-timing-rearm-required" : "wait-timeout";
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
    value.waitToken = null;
    value.waitPid = null;
  }
  return value;
}
async function isWaiterLive(waiter) {
  try {
    process.kill(waiter.pid, 0);
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    return void 0;
  }
  return true;
}
async function atomicWriteJson(file, value) {
  await mkdir2(dirname2(file), { recursive: true, mode: 448 });
  await chmod2(dirname2(file), 448);
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temp, "wx", 384);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename2(temp, file);
  await chmod2(file, 384);
}
async function readLease(root, ownerSession, { persistMigration = true } = {}) {
  const file = leasePath(root, ownerSession);
  let raw;
  try {
    const metadata = await lstat(file);
    const wrongOwner = typeof process.getuid === "function" && metadata.uid !== process.getuid();
    if (!metadata.isFile() || metadata.isSymbolicLink() || wrongOwner || (metadata.mode & 63) !== 0) {
      throw new LeaseError(
        "unsafe-lease",
        "lease must be a regular owner-only file owned by this user"
      );
    }
    raw = JSON.parse(await readFile2(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof LeaseError) throw error;
    throw new LeaseError(
      "malformed-lease",
      `cannot read lease safely: ${error.message}`
    );
  }
  const migrated = validateLease(raw);
  if (persistMigration && raw.schemaVersion !== migrated.schemaVersion) {
    return withLeaseLock(file, async () => {
      const latest = await readLease(root, ownerSession, {
        persistMigration: false
      });
      if (latest) await atomicWriteJson(file, latest);
      return latest;
    });
  }
  return migrated;
}
async function withLeaseLock(file, fn) {
  const lock = `${file}.lock`;
  let handle;
  await mkdir2(dirname2(file), { recursive: true, mode: 448 });
  await chmod2(dirname2(file), 448);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open(lock, "wx", 384);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt >= 199)
        throw new LeaseError(
          "lease-lock-timeout",
          "lease mutation lock timed out"
        );
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
  }
  try {
    return await fn();
  } finally {
    await handle.close();
    await rm2(lock, { force: true });
  }
}
async function recoverOrphanedWait(root, ownerSession, now = Date.now(), { expected, isWaiterLive: checkLiveness = isWaiterLive } = {}) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { recovered: false, reason: "missing", lease: null };
    if (expected && (current.leaseId !== expected.leaseId || current.waitToken !== expected.waitToken)) {
      return { recovered: false, reason: "stale", lease: current };
    }
    if (current.state !== "waiting")
      return { recovered: false, reason: current.state, lease: current };
    if (current.waitToken === null || current.waitPid === null) {
      return { recovered: false, reason: "liveness-unknown", lease: current };
    }
    const live = await checkLiveness({
      token: current.waitToken,
      pid: current.waitPid
    });
    if (live === true)
      return { recovered: false, reason: "waiter-live", lease: current };
    if (live !== false)
      return { recovered: false, reason: "liveness-unknown", lease: current };
    const idle = validateLease({
      ...current,
      state: "idle",
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      diagnostic: "waiter-terminated",
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, idle);
    return { recovered: true, reason: "waiter-terminated", lease: idle };
  });
}
async function resourceExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
async function pruneLeases(root, { now = Date.now(), ownerSession } = {}) {
  const targetedSession = ownerSession ? validateId(ownerSession, "owner-session") : void 0;
  const leasesDir = join2(resolve2(root), "leases");
  let names;
  try {
    names = await readdir2(leasesDir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const removed = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const session = name.slice(0, -5);
    if (!ID.test(session) || targetedSession && session !== targetedSession)
      continue;
    const file = leasePath(root, session);
    await withLeaseLock(file, async () => {
      let lease;
      try {
        lease = await readLease(root, session, { persistMigration: false });
      } catch {
        return;
      }
      if (!lease || lease.ownerSession !== session) return;
      const expired = now >= Date.parse(lease.expiresAt);
      const capped = lease.continuationCount >= lease.continuationCap || lease.loopCount >= lease.loopCap;
      const targetedDisarmed = Boolean(targetedSession) && lease.state === "disarmed";
      const missing = !await resourceExists(lease.ownerCwd) || !await resourceExists(lease.peerTranscript);
      if (expired || capped || targetedDisarmed || missing) {
        await rm2(file);
        removed.push(session);
      }
    });
  }
  return removed;
}

// src/skills/session-observer-collab/src/codex-lifecycle.mjs
var CODEX_STOP_STATUS_MESSAGE = "Checking for Session Observer peer activity";
var CODEX_STOP_TIMEOUT_GRACE_SECONDS = 5;
var CODEX_STOP_TIMEOUT_SECONDS = MAX_WAIT_MS / 1e3 + CODEX_STOP_TIMEOUT_GRACE_SECONDS;
var CodexLifecycleError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CodexLifecycleError";
    this.code = code;
  }
};
function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function validateHookConfig(value) {
  if (!plainObject(value) || !plainObject(value.hooks))
    throw new CodexLifecycleError(
      "invalid-hooks-config",
      "Codex hooks config must contain a hooks object"
    );
  for (const [event, groups] of Object.entries(value.hooks)) {
    if (!Array.isArray(groups))
      throw new CodexLifecycleError(
        "invalid-hooks-config",
        `Codex hook event ${event} must be an array`
      );
    for (const group of groups) {
      if (!plainObject(group) || !Array.isArray(group.hooks))
        throw new CodexLifecycleError(
          "invalid-hooks-config",
          `Codex hook event ${event} contains an invalid hook group`
        );
    }
  }
  return value;
}
async function readHookConfig(hooksPath) {
  try {
    return validateHookConfig(JSON.parse(await readFile3(hooksPath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return { hooks: {} };
    if (error instanceof CodexLifecycleError) throw error;
    throw new CodexLifecycleError(
      "invalid-hooks-config",
      `Codex hooks config is unreadable: ${error.message}`
    );
  }
}
async function writeHookConfig(hooksPath, config) {
  await mkdir3(dirname3(hooksPath), { recursive: true, mode: 448 });
  const temporary = `${hooksPath}.${randomUUID2()}.tmp`;
  try {
    await writeFile2(temporary, `${JSON.stringify(config, null, 2)}
`, {
      mode: 384
    });
    await chmod3(temporary, 384);
    await rename3(temporary, hooksPath);
    await chmod3(hooksPath, 384);
  } finally {
    await rm3(temporary, { force: true });
  }
}
function resolvedPaths({ hooksPath, scriptPath }) {
  return {
    hooksPath: validateAbsolutePath(hooksPath, "hooks-path"),
    scriptPath: validateAbsolutePath(scriptPath, "script-path")
  };
}
async function withCodexLifecycleLock(root, fn) {
  const stateRoot2 = validateAbsolutePath(root, "state-root");
  const lock = join3(stateRoot2, "codex-lifecycle.lock");
  let handle;
  await mkdir3(stateRoot2, { recursive: true, mode: 448 });
  await chmod3(stateRoot2, 448);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open2(lock, "wx", 384);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt >= 199)
        throw new CodexLifecycleError(
          "codex-lifecycle-lock-timeout",
          "Codex lifecycle mutation lock timed out"
        );
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
  }
  try {
    return await fn();
  } finally {
    await handle.close();
    await rm3(lock, { force: true });
  }
}
async function activeCodexLeaseCount(root, now) {
  const leasesDir = join3(root, "leases");
  let names;
  try {
    names = await readdir3(leasesDir);
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
  let count = 0;
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const ownerSession = name.slice(0, -".json".length);
    const file = leasePath(root, ownerSession);
    await withLeaseLock(file, async () => {
      const lease = await readLease(root, ownerSession, {
        persistMigration: false
      });
      if (!lease) return;
      const effective = effectiveLease(lease, now);
      if (effective.runtime === "codex" && ["armed", "waiting"].includes(effective.state)) {
        count += 1;
      }
    });
  }
  return count;
}
function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
function codexStopCommand(scriptPath) {
  return `node -- ${shellQuote(validateAbsolutePath(scriptPath, "script-path"))}`;
}
function codexStopHookEntry(scriptPath) {
  return Object.freeze({
    type: "command",
    command: codexStopCommand(scriptPath),
    timeout: CODEX_STOP_TIMEOUT_SECONDS,
    statusMessage: CODEX_STOP_STATUS_MESSAGE
  });
}
function exactHookEntries(config, command) {
  return (config.hooks.Stop ?? []).flatMap(
    (group) => group.hooks.filter(
      (entry) => plainObject(entry) && entry.command === command
    )
  );
}
function hasCanonicalManagedFields(entry, canonical) {
  return entry.type === canonical.type && entry.timeout === canonical.timeout && entry.statusMessage === canonical.statusMessage;
}
async function installCodexStopHook(input) {
  const { hooksPath, scriptPath } = resolvedPaths(input);
  const command = codexStopCommand(scriptPath);
  const config = await readHookConfig(hooksPath);
  const exact = exactHookEntries(config, command);
  if (exact.length > 1)
    throw new CodexLifecycleError(
      "ambiguous-observer-registration",
      "multiple exact Codex observer registrations found; refusing reconciliation"
    );
  const canonical = codexStopHookEntry(scriptPath);
  if (exact.length === 1 && hasCanonicalManagedFields(exact[0], canonical))
    return { changed: false, exactCommand: command, config };
  const next = structuredClone(config);
  next.hooks.Stop ??= [];
  if (exact.length === 0) {
    next.hooks.Stop.push({ hooks: [canonical] });
  } else {
    next.hooks.Stop = next.hooks.Stop.map((group) => ({
      ...group,
      hooks: group.hooks.map(
        (entry) => plainObject(entry) && entry.command === command ? { ...entry, ...canonical } : entry
      )
    }));
  }
  await writeHookConfig(hooksPath, next);
  return { changed: true, exactCommand: command, config: next };
}
async function inspectCodexStopHook({
  hooksPath: rawHooksPath,
  scriptPath: rawScriptPath
}) {
  const { hooksPath, scriptPath } = resolvedPaths({
    hooksPath: rawHooksPath,
    scriptPath: rawScriptPath
  });
  const config = await readHookConfig(hooksPath);
  return {
    exactCommand: codexStopCommand(scriptPath),
    config
  };
}
function exactRecord(records2, command) {
  if (!Array.isArray(records2)) return void 0;
  return records2.find(
    (record) => plainObject(record) && record.command === command
  );
}
function assessCodexHookReadiness({
  scriptPath,
  hooks,
  trustRecords = [],
  hookStatuses = [],
  leaseArmed = false,
  liveWakePassed = false
}) {
  const command = codexStopCommand(scriptPath);
  const config = validateHookConfig(hooks);
  const trust = exactRecord(trustRecords, command);
  const status2 = exactRecord(hookStatuses, command);
  const trusted = trust ? trust.trusted === true ? "trusted" : "untrusted" : "unverified";
  const explicitEnablement = status2?.enabled === true ? "enabled" : status2?.enabled === false ? "disabled" : "not-explicitly-enabled";
  const effectiveExecution = typeof status2?.lastRanAt === "string" && Number.isFinite(Date.parse(status2.lastRanAt)) ? "observed" : "unverified";
  const installed = exactHookEntries(config, command).length > 0;
  return Object.freeze({
    exactCommand: command,
    installed,
    trusted,
    explicitEnablement,
    effectiveExecution,
    leaseArmed: leaseArmed === true ? "armed" : "not-armed",
    liveWake: liveWakePassed === true ? "passed" : "unverified",
    mayArm: installed && trusted === "trusted" && explicitEnablement !== "disabled" && effectiveExecution === "observed"
  });
}
async function uninstallCodexStopHook({
  hooksPath: rawHooksPath,
  scriptPath: rawScriptPath,
  confirmed,
  root,
  removeScript = false,
  now = Date.now()
}) {
  if (confirmed !== true)
    throw new CodexLifecycleError(
      "confirmation-required",
      "explicit confirmation is required to uninstall the Codex hook"
    );
  return withCodexLifecycleLock(root, async () => {
    const activeLeaseCount = await activeCodexLeaseCount(root, now);
    if (activeLeaseCount > 0)
      throw new CodexLifecycleError(
        "active-leases",
        "cannot uninstall while active collaboration leases remain"
      );
    const { hooksPath, scriptPath } = resolvedPaths({
      hooksPath: rawHooksPath,
      scriptPath: rawScriptPath
    });
    const command = codexStopCommand(scriptPath);
    const config = await readHookConfig(hooksPath);
    const exact = exactHookEntries(config, command);
    if (exact.length > 1)
      throw new CodexLifecycleError(
        "ambiguous-observer-registration",
        "multiple exact Codex observer registrations found; refusing removal"
      );
    if (exact.length === 0)
      return {
        changed: false,
        exactCommand: command,
        removed: 0,
        scriptRemoved: false,
        safety: { activeLeaseCount }
      };
    const next = structuredClone(config);
    let removed = 0;
    if (Array.isArray(next.hooks.Stop)) {
      next.hooks.Stop = next.hooks.Stop.map((group) => {
        const hooks = group.hooks.filter((entry) => {
          const observer = plainObject(entry) && entry.command === command;
          if (observer) removed += 1;
          return !observer;
        });
        return { ...group, hooks };
      }).filter((group) => group.hooks.length > 0);
    }
    await writeHookConfig(hooksPath, next);
    let scriptRemoved = false;
    let supportRemoved = false;
    if (removeScript) {
      ({ scriptRemoved, supportRemoved } = await removeCodexStopBundle(scriptPath));
    }
    return {
      changed: true,
      exactCommand: command,
      removed,
      scriptRemoved,
      supportRemoved,
      safety: { activeLeaseCount }
    };
  });
}

// src/skills/session-observer-collab/src/lib/selected-prefix.mjs
import { createHash as createHash5 } from "node:crypto";
import { open as open5 } from "node:fs/promises";

// src/shared/transcript/cursor-analysis.ts
import { createHash as createHash2 } from "node:crypto";

// src/shared/transcript/runtimes.ts
import { open as open3, readFile as readFile4 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { basename as basename3, dirname as dirname4, isAbsolute as isAbsolute2, join as join4 } from "node:path";

// src/shared/transcript/cursor-frames.ts
import { createHash as createHash3 } from "node:crypto";
import { open as open4 } from "node:fs/promises";
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseClosedFrame(frameBytes) {
  if (frameBytes.length === 0) {
    return { parseState: "blank", record: null };
  }
  try {
    const value = JSON.parse(frameBytes.toString("utf8"));
    if (!isJsonObject(value)) {
      return { parseState: "malformed", record: null };
    }
    return { parseState: "parsed", record: value };
  } catch {
    return { parseState: "malformed", record: null };
  }
}
function optionalFileIdentity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function validateVerifyPrefixBytes(value) {
  if (value !== void 0 && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError("verifyPrefixBytes must be a non-negative integer");
  }
}
async function scanCursorTranscript(transcriptPath, options) {
  validateVerifyPrefixBytes(options.verifyPrefixBytes);
  const handle = await open4(transcriptPath, "r");
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash3("sha256");
    const verifiedPrefixHash = options.verifyPrefixBytes === void 0 ? null : createHash3("sha256");
    let verifiedBytes = 0;
    let verifiedPrefixSha256 = options.verifyPrefixBytes === 0 ? createHash3("sha256").digest("hex") : null;
    let carrySegments = [];
    let carryLength = 0;
    let carryByteStart = 0;
    let frameIndex = 0;
    let safeThroughFrame = null;
    let safePrefixBytes = 0;
    let blockingFrame = null;
    const updateVerifiedHash = (chunk) => {
      if (verifiedPrefixHash === null || options.verifyPrefixBytes === void 0 || verifiedBytes >= options.verifyPrefixBytes) {
        return;
      }
      const remaining = options.verifyPrefixBytes - verifiedBytes;
      const bytes = chunk.subarray(0, Math.min(chunk.length, remaining));
      verifiedPrefixHash.update(bytes);
      verifiedBytes += bytes.length;
    };
    const emitClosedFrame = async (frameSegments, contentBytes, byteStart) => {
      const parsed = parseClosedFrame(contentBytes);
      const byteEnd = byteStart + contentBytes.length + 1;
      const frame = {
        frameIndex,
        byteStart,
        byteEnd,
        closed: true,
        ...parsed
      };
      if (blockingFrame === null && (frame.parseState === "parsed" || frame.parseState === "blank")) {
        for (const segment of frameSegments) {
          safePrefixHash.update(segment);
        }
        safePrefixHash.update("\n");
        safeThroughFrame = frame.frameIndex;
        safePrefixBytes = frame.byteEnd;
      } else if (blockingFrame === null) {
        blockingFrame = {
          frameIndex: frame.frameIndex,
          byteStart: frame.byteStart,
          byteEnd: frame.byteEnd,
          parseState: "malformed"
        };
      }
      await options.onFrame(frame);
      frameIndex += 1;
    };
    if (file.size > 0) {
      const stream = handle.createReadStream({
        autoClose: false,
        start: 0,
        end: file.size - 1
      });
      for await (const streamChunk of stream) {
        const chunk = Buffer.isBuffer(streamChunk) ? streamChunk : Buffer.from(streamChunk);
        updateVerifiedHash(chunk);
        let chunkOffset = 0;
        while (chunkOffset < chunk.length) {
          const newlineOffset = chunk.indexOf(10, chunkOffset);
          if (newlineOffset === -1) {
            const suffix = chunk.subarray(chunkOffset);
            if (suffix.length > 0) {
              carrySegments.push(suffix);
              carryLength += suffix.length;
            }
            break;
          }
          const segment = chunk.subarray(chunkOffset, newlineOffset);
          if (segment.length > 0) {
            carrySegments.push(segment);
            carryLength += segment.length;
          }
          const contentBytes = carrySegments.length === 0 ? Buffer.alloc(0) : carrySegments.length === 1 ? carrySegments[0] : Buffer.concat(carrySegments, carryLength);
          const frameByteLength = carryLength + 1;
          await emitClosedFrame(carrySegments, contentBytes, carryByteStart);
          carrySegments = [];
          carryLength = 0;
          chunkOffset = newlineOffset + 1;
          carryByteStart += frameByteLength;
        }
      }
    }
    if (carryLength > 0) {
      const frame = {
        frameIndex,
        byteStart: carryByteStart,
        byteEnd: carryByteStart + carryLength,
        closed: false,
        parseState: "partial",
        record: null
      };
      if (blockingFrame === null) {
        blockingFrame = {
          frameIndex: frame.frameIndex,
          byteStart: frame.byteStart,
          byteEnd: frame.byteEnd,
          parseState: "partial"
        };
      }
      await options.onFrame(frame);
      frameIndex += 1;
    }
    if (verifiedPrefixHash !== null && options.verifyPrefixBytes !== void 0 && options.verifyPrefixBytes > 0 && verifiedBytes === options.verifyPrefixBytes) {
      verifiedPrefixSha256 = verifiedPrefixHash.digest("hex");
    }
    return {
      indexBase: "zero-based-jsonl-frame-index",
      totalFrames: frameIndex,
      safeThroughFrame,
      safePrefixBytes,
      safePrefixSha256: safePrefixHash.digest("hex"),
      verifiedPrefixSha256,
      file: {
        size: file.size,
        mtimeMs: file.mtimeMs,
        device: optionalFileIdentity(file.dev),
        inode: optionalFileIdentity(file.ino)
      },
      blockingFrame
    };
  } finally {
    await handle.close();
  }
}

// src/skills/session-observer/src/lib/digest.ts
import { createHash as createHash4 } from "node:crypto";

// src/shared/transcript/activity/project.ts
var KIB = 1024;
var MIB = 1024 * KIB;
var ACTIVITY_PROJECTION_LIMITS = {
  watch: {
    maxBytes: 32 * KIB,
    maxInvocations: 80,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  },
  "catch-up": {
    maxBytes: 32 * KIB,
    maxInvocations: 80,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  },
  review: {
    maxBytes: 128 * KIB,
    maxInvocations: 1024,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  },
  export: {
    maxBytes: 64 * MIB,
    maxInvocations: null,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  }
};

// src/skills/session-observer-collab/src/lib/selected-prefix.mjs
var SHA256 = /^[a-f0-9]{64}$/u;
function selectedPrefixError() {
  const error = new Error("cursor selected prefix changed after observation");
  error.code = "cursor-selected-prefix-mismatch";
  return error;
}
function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
async function readBoundedHashes(transcript, selectedPrefixBytes, verificationPrefixBytes) {
  if (!nonNegativeInteger(selectedPrefixBytes) || !nonNegativeInteger(verificationPrefixBytes) || selectedPrefixBytes > verificationPrefixBytes) {
    throw selectedPrefixError();
  }
  const selectedHash = createHash5("sha256");
  const verificationHash = createHash5("sha256");
  const handle = await open5(transcript, "r");
  try {
    const before = await handle.stat();
    if (!nonNegativeInteger(before.dev) || !nonNegativeInteger(before.ino) || before.size < verificationPrefixBytes) {
      throw selectedPrefixError();
    }
    let bytesRead = 0;
    if (verificationPrefixBytes > 0) {
      const stream = handle.createReadStream({
        start: 0,
        end: verificationPrefixBytes - 1,
        autoClose: false
      });
      for await (const chunk of stream) {
        const selectedRemaining = selectedPrefixBytes - bytesRead;
        if (selectedRemaining > 0) {
          selectedHash.update(
            chunk.subarray(0, Math.min(selectedRemaining, chunk.byteLength))
          );
        }
        verificationHash.update(chunk);
        bytesRead += chunk.byteLength;
      }
    }
    const after = await handle.stat();
    if (bytesRead !== verificationPrefixBytes || after.dev !== before.dev || after.ino !== before.ino || after.size < verificationPrefixBytes) {
      throw selectedPrefixError();
    }
    return Object.freeze({
      device: before.dev,
      inode: before.ino,
      selectedSha256: selectedHash.digest("hex"),
      verificationSha256: verificationHash.digest("hex")
    });
  } finally {
    await handle.close();
  }
}
async function captureSelectedPrefix(transcript, scan, frameEnds, nextFrameIndex) {
  const prefixBytes = nextFrameIndex === 0 ? 0 : frameEnds[nextFrameIndex - 1];
  if (!nonNegativeInteger(nextFrameIndex) || !nonNegativeInteger(prefixBytes) || !nonNegativeInteger(scan.file.device) || !nonNegativeInteger(scan.file.inode) || prefixBytes > scan.safePrefixBytes || !SHA256.test(scan.safePrefixSha256)) {
    throw selectedPrefixError();
  }
  const bounded = await readBoundedHashes(
    transcript,
    prefixBytes,
    scan.safePrefixBytes
  );
  if (bounded.device !== scan.file.device || bounded.inode !== scan.file.inode || bounded.verificationSha256 !== scan.safePrefixSha256) {
    throw selectedPrefixError();
  }
  return Object.freeze({
    indexBase: "zero-based-jsonl-frame-index",
    nextFrameIndex,
    prefixBytes,
    prefixSha256: bounded.selectedSha256,
    observedSize: prefixBytes,
    device: bounded.device,
    inode: bounded.inode
  });
}
async function captureCursorArmContinuity(transcript, nextFrameIndex) {
  const frameEnds = [];
  const scan = await scanCursorTranscript(transcript, {
    onFrame(frame) {
      frameEnds[frame.frameIndex] = frame.closed && (frame.parseState === "parsed" || frame.parseState === "blank") ? frame.byteEnd : null;
    }
  });
  return captureSelectedPrefix(transcript, scan, frameEnds, nextFrameIndex);
}

// src/skills/session-observer-collab/src/collab-control.mjs
var CONTROL_SCHEMA_VERSION = 1;
function numberOption(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
}
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--"))
      throw new Error(`unexpected argument: ${token}`);
    const [rawKey, inline] = token.slice(2).split("=", 2);
    const key = rawKey.replace(
      /-([a-z])/g,
      (_, letter) => letter.toUpperCase()
    );
    if (rawKey === "json" || rawKey === "confirmed" || rawKey === "remove-script") {
      options[key] = true;
      continue;
    }
    const value = inline ?? rest[++i];
    if (value === void 0 || value.startsWith("--"))
      throw new Error(`missing value for --${rawKey}`);
    options[key] = value;
  }
  return { command, options };
}
async function readInstallation(root) {
  try {
    const value = JSON.parse(
      await readFile5(join5(root, "installation.json"), "utf8")
    );
    if (value.schemaVersion !== CONTROL_SCHEMA_VERSION || !value.runtimes || typeof value.runtimes !== "object")
      throw new Error("unsupported installation schema");
    return value;
  } catch (error) {
    if (error?.code === "ENOENT")
      return { schemaVersion: CONTROL_SCHEMA_VERSION, runtimes: {} };
    throw new Error(`installation state is malformed: ${error.message}`, {
      cause: error
    });
  }
}
async function withInstallationLock(root, fn) {
  const lock = join5(root, "installation.json.lock");
  let handle;
  await mkdir4(root, { recursive: true, mode: 448 });
  await chmod4(root, 448);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open6(lock, "wx", 384);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt >= 199)
        throw new Error("installation mutation lock timed out", {
          cause: error
        });
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
  }
  try {
    return await fn();
  } finally {
    await handle.close();
    await rm4(lock, { force: true });
  }
}
async function install(root, { runtime, command }) {
  validateOwnerRuntime(runtime);
  const exactCommand = validateAbsolutePath(command, "command");
  return withInstallationLock(root, async () => {
    const installation = await readInstallation(root);
    const existing = installation.runtimes[runtime];
    if (existing?.command === exactCommand)
      return { changed: false, installation };
    installation.runtimes[runtime] = { command: exactCommand };
    await atomicWriteJson(join5(root, "installation.json"), installation);
    return { changed: true, installation };
  });
}
async function arm(root, options, now = Date.now()) {
  const runtime = validateOwnerRuntime(options.runtime);
  const peerRuntime = validatePeerRuntime(options.peerRuntime);
  const ownerSession = validateId(options.session, "owner-session");
  const peerSession = validateId(options.peerSession, "peer-session");
  const ownerCwd = validateAbsolutePath(options.cwd, "owner-cwd");
  const peerPath = await canonicalizePeerTranscript(
    peerRuntime,
    options.peerTranscript
  );
  validatePeerTranscriptSession(
    peerRuntime,
    peerSession,
    peerPath.peerCanonicalTranscriptPath
  );
  if (options.peerIndexBase !== void 0) {
    validatePeerIndexBase(options.peerIndexBase, peerRuntime);
  }
  const waitMs = numberOption(
    options.waitMs ?? DEFAULT_WAIT_MS,
    "wait-ms",
    0,
    6e4
  );
  const leaseMs = numberOption(
    options.leaseMs ?? 6e4,
    "lease-ms",
    1,
    MAX_LEASE_MS
  );
  const continuationCap = numberOption(
    options.continuationCap ?? 1,
    "continuation-cap",
    1,
    MAX_CONTINUATIONS
  );
  const loopCap = numberOption(
    options.loopCap ?? continuationCap,
    "loop-cap",
    1,
    MAX_LOOPS
  );
  const cursor = numberOption(
    options.cursor ?? 0,
    "cursor",
    0,
    Number.MAX_SAFE_INTEGER
  );
  const identity = {
    runtime,
    peerRuntime,
    ownerSession,
    ownerCwd,
    peerSession,
    ...peerPath
  };
  const file = leasePath(root, ownerSession);
  return withCodexLifecycleLock(
    root,
    () => withLeaseLock(file, async () => {
      let existing;
      try {
        existing = await readLease(root, ownerSession, {
          persistMigration: false
        });
      } catch (error) {
        if (error?.code !== "cursor-lease-rearm-required") throw error;
        existing = null;
      }
      const peerContinuity = peerRuntime === "cursor" ? await captureCursorArmContinuity(
        peerPath.peerCanonicalTranscriptPath,
        cursor
      ) : null;
      const request = {
        ...identity,
        peerCursor: cursor,
        peerContinuity,
        continuationCap,
        loopCap,
        waitMs,
        leaseMs
      };
      if (existing && ["armed", "waiting"].includes(effectiveLease(existing, now).state) && Object.entries(request).every(
        ([key, value]) => value !== null && typeof value === "object" ? JSON.stringify(existing[key]) === JSON.stringify(value) : existing[key] === value
      )) {
        return { changed: false, lease: effectiveLease(existing, now) };
      }
      const stamp = new Date(now).toISOString();
      const lease = {
        schemaVersion: LEASE_SCHEMA_VERSION,
        leaseId: randomUUID3(),
        ...identity,
        state: "armed",
        peerCursor: cursor,
        peerContinuity,
        continuationCount: 0,
        continuationCap,
        loopCount: 0,
        loopCap,
        waitMs,
        leaseMs,
        waitStartedAt: null,
        waitDeadlineAt: null,
        waitToken: null,
        waitPid: null,
        armedAt: stamp,
        expiresAt: new Date(now + leaseMs).toISOString(),
        updatedAt: stamp,
        diagnostic: null
      };
      await atomicWriteJson(file, lease);
      return { changed: true, lease };
    })
  );
}
function records(value, name) {
  if (value === void 0) return [];
  if (!Array.isArray(value))
    throw new Error(`${name} must contain a JSON array`);
  return value;
}
async function readRecords2(path, name) {
  if (path === void 0) return [];
  const absolute = validateAbsolutePath(path, name);
  try {
    return records(JSON.parse(await readFile5(absolute, "utf8")), name);
  } catch (error) {
    if (error.message?.includes("must contain a JSON array")) throw error;
    throw new Error(`${name} is unreadable: ${error.message}`, {
      cause: error
    });
  }
}
async function codexInstall(root, options) {
  return withCodexLifecycleLock(root, async () => {
    const bundle = await installCodexStopBundle({
      scriptPath: options.scriptPath,
      sourceScriptPath: options.sourceScriptPath ?? fileURLToPath(new URL("./hooks/codex-stop.mjs", import.meta.url))
    });
    const registration = await installCodexStopHook(options);
    return {
      bundle,
      registration,
      readiness: assessCodexHookReadiness({
        scriptPath: options.scriptPath,
        hooks: registration.config
      })
    };
  });
}
async function codexStatus(root, options, now = Date.now()) {
  const registration = await inspectCodexStopHook({
    hooksPath: options.hooksPath,
    scriptPath: options.scriptPath
  });
  const current = options.session ? await status(root, options.session, now) : { lease: null };
  return assessCodexHookReadiness({
    scriptPath: options.scriptPath,
    hooks: registration.config,
    trustRecords: await readRecords2(
      options.trustRecordsPath,
      "trust-records-path"
    ),
    hookStatuses: await readRecords2(
      options.hookStatusesPath,
      "hook-statuses-path"
    ),
    leaseArmed: ["armed", "waiting"].includes(current.lease?.state)
  });
}
async function codexUninstall(root, options, now = Date.now()) {
  if (options.confirmed !== true)
    throw new Error(
      "explicit --confirmed is required to uninstall the Codex hook"
    );
  return uninstallCodexStopHook({
    hooksPath: options.hooksPath,
    scriptPath: options.scriptPath,
    confirmed: true,
    root,
    removeScript: options.removeScript === true,
    now
  });
}
async function disarm(root, ownerSession, now = Date.now()) {
  const session = validateId(ownerSession, "owner-session");
  const file = leasePath(root, session);
  return withLeaseLock(file, async () => {
    const existing = await readLease(root, session, {
      persistMigration: false
    });
    if (!existing) return { changed: false, lease: null };
    if (existing.state === "disarmed")
      return { changed: false, lease: existing };
    const lease = {
      ...existing,
      state: "disarmed",
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      updatedAt: new Date(now).toISOString(),
      diagnostic: "user-disarmed"
    };
    await atomicWriteJson(file, lease);
    return { changed: true, lease };
  });
}
async function status(root, ownerSession, now = Date.now(), recoveryOptions) {
  const installation = await readInstallation(root);
  if (ownerSession) {
    await recoverOrphanedWait(
      root,
      validateId(ownerSession, "owner-session"),
      now,
      recoveryOptions
    );
    await pruneLeases(root, {
      now,
      ownerSession: validateId(ownerSession, "owner-session")
    });
  }
  const lease = ownerSession ? await readLease(root, validateId(ownerSession, "owner-session")) : null;
  return { installation, lease: lease ? effectiveLease(lease, now) : null };
}
async function run(argv, env = process.env, now = Date.now()) {
  const { command, options } = parseArgs(argv);
  const root = stateRoot(env);
  await mkdir4(root, { recursive: true, mode: 448 });
  await chmod4(root, 448);
  if (command === "install") {
    const result = await install(root, options);
    if (options.session)
      await pruneLeases(root, { now, ownerSession: options.session });
    return { ok: true, command, ...result };
  }
  if (command === "arm")
    return { ok: true, command, ...await arm(root, options, now) };
  if (command === "disarm")
    return { ok: true, command, ...await disarm(root, options.session, now) };
  if (command === "status")
    return { ok: true, command, ...await status(root, options.session, now) };
  if (command === "prune")
    return {
      ok: true,
      command,
      removed: await pruneLeases(root, { now, ownerSession: options.session })
    };
  if (command === "codex-install")
    return { ok: true, command, ...await codexInstall(root, options) };
  if (command === "codex-status")
    return { ok: true, command, ...await codexStatus(root, options, now) };
  if (command === "codex-uninstall")
    return { ok: true, command, ...await codexUninstall(root, options, now) };
  throw new Error(
    "usage: collab-control install|status|arm|disarm|prune|codex-install|codex-status|codex-uninstall [options] [--json]"
  );
}
async function main() {
  const json = process.argv.includes("--json");
  try {
    const result = await run(process.argv.slice(2));
    process.stdout.write(
      json ? `${JSON.stringify(result)}
` : `${result.command}: ${result.changed === false ? "unchanged" : "ok"}
`
    );
  } catch (error) {
    const result = {
      ok: false,
      error: error.code ?? "invalid-input",
      message: error.message
    };
    (json ? process.stdout : process.stderr).write(
      json ? `${JSON.stringify(result)}
` : `collab-control: ${error.message}
`
    );
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  await main();
export {
  CONTROL_SCHEMA_VERSION,
  arm,
  codexInstall,
  codexStatus,
  codexUninstall,
  disarm,
  install,
  parseArgs,
  run,
  status
};
