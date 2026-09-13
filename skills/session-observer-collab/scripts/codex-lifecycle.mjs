// GENERATED skill payload for session-observer-collab.

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
function bundlePaths(scriptPath) {
  const parent = dirname(scriptPath);
  return {
    parent,
    supportRoot: join(parent, `.${basename(scriptPath)}.support`)
  };
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
var MAX_WAIT_MS = 6e4;
var MAX_LEASE_MS = 24 * 60 * 60 * 1e3;
var MAX_CONTINUATIONS = 100;
var MAX_LOOPS = 1e3;
var ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
var OWNER_RUNTIMES = /* @__PURE__ */ new Set(["codex", "cursor"]);
var PEER_RUNTIMES = /* @__PURE__ */ new Set(["claude-code", "codex", "cursor"]);
var RECORD_INDEX_BASE = "zero-based-jsonl-record-index";
var FRAME_INDEX_BASE = "zero-based-jsonl-frame-index";
var LeaseError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LeaseError";
    this.code = code;
  }
};
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
  const stateRoot = validateAbsolutePath(root, "state-root");
  const lock = join3(stateRoot, "codex-lifecycle.lock");
  let handle;
  await mkdir3(stateRoot, { recursive: true, mode: 448 });
  await chmod3(stateRoot, 448);
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
function exactRecord(records, command) {
  if (!Array.isArray(records)) return void 0;
  return records.find(
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
  const status = exactRecord(hookStatuses, command);
  const trusted = trust ? trust.trusted === true ? "trusted" : "untrusted" : "unverified";
  const explicitEnablement = status?.enabled === true ? "enabled" : status?.enabled === false ? "disabled" : "not-explicitly-enabled";
  const effectiveExecution = typeof status?.lastRanAt === "string" && Number.isFinite(Date.parse(status.lastRanAt)) ? "observed" : "unverified";
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
export {
  CODEX_STOP_STATUS_MESSAGE,
  CODEX_STOP_TIMEOUT_GRACE_SECONDS,
  CODEX_STOP_TIMEOUT_SECONDS,
  CodexLifecycleError,
  assessCodexHookReadiness,
  codexStopCommand,
  codexStopHookEntry,
  inspectCodexStopHook,
  installCodexStopHook,
  uninstallCodexStopHook,
  withCodexLifecycleLock
};
