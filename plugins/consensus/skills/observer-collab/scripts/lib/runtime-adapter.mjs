// GENERATED skill payload for session-observer-collab.

// src/skills/session-observer-collab/src/lib/runtime-adapter.mjs
import { createHash } from "node:crypto";
import { open as open2 } from "node:fs/promises";

// src/skills/session-observer-collab/src/lib/lease-state.mjs
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
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
var OWNER_RUNTIMES = /* @__PURE__ */ new Set(["claude-code", "codex", "cursor"]);
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
      "owner runtime must be claude-code, codex, or cursor"
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
  return resolve(value);
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
  let current = dirname(transcriptPath);
  while (dirname(current) !== current) {
    if (basename(current) === CURSOR_TRANSCRIPT_STORE) {
      const projectsRoot = dirname(dirname(current));
      const cursorRoot = dirname(projectsRoot);
      if (basename(projectsRoot) !== "projects" || basename(cursorRoot) !== ".cursor") {
        throw new LeaseError(
          "unsupported-peer-transcript-store",
          "Cursor peer transcript must use the supported .cursor/projects store"
        );
      }
      return current;
    }
    current = dirname(current);
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
function leasePath(root, ownerSession) {
  validateId(ownerSession, "owner-session");
  const leases = join(resolve(root), "leases");
  const candidate = join(leases, `${ownerSession}.json`);
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
  if (value.runtime === "claude-code") {
    const composition = value.composedActivation;
    if (!composition || typeof composition !== "object" || Array.isArray(composition) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      composition.collaborationId
    ) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      composition.activationId
    ) || composition.controller !== "observer-collab" || composition.mechanism !== "monitor" || composition.ownerRuntime !== value.runtime || composition.ownerSession !== value.ownerSession || composition.peerRuntime !== value.peerRuntime || composition.peerSession !== value.peerSession || composition.ownerCwd !== value.ownerCwd || composition.peerTranscript !== value.peerTranscript || typeof composition.confirmedAt !== "string" || !Number.isFinite(Date.parse(composition.confirmedAt)) || composition.oldMonitorStopped !== true || composition.standaloneWatcherStopped !== true) {
      throw new LeaseError(
        "invalid-composed-activation",
        "Claude owner lease requires an exact composed Monitor activation and stop attestations"
      );
    }
  } else if (value.composedActivation !== void 0 && value.composedActivation !== null) {
    throw new LeaseError(
      "invalid-composed-activation",
      "only a Claude owner lease may bind a composed Monitor activation"
    );
  }
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
async function createWaiterIdentity(pid = process.pid) {
  integer(pid, "waitPid", 1, Number.MAX_SAFE_INTEGER);
  return Object.freeze({
    token: randomUUID(),
    pid
  });
}
async function atomicWriteJson(file, value) {
  await mkdir(dirname(file), { recursive: true, mode: 448 });
  await chmod(dirname(file), 448);
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temp, "wx", 384);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
  await chmod(file, 384);
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
    raw = JSON.parse(await readFile(file, "utf8"));
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
  await mkdir(dirname(file), { recursive: true, mode: 448 });
  await chmod(dirname(file), 448);
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
    await rm(lock, { force: true });
  }
}
async function compareAndSwapTrigger(root, ownerSession, expected, update, clock = Date.now) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.leaseId !== expected.leaseId || current.peerCursor !== expected.peerCursor || current.continuationCount !== expected.continuationCount || current.loopCount !== expected.loopCount) {
      return { ok: false, reason: "stale", lease: current };
    }
    const now = typeof clock === "function" ? clock() : clock;
    const effective = effectiveLease(current, now);
    if (!["armed", "waiting"].includes(effective.state))
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective
      };
    const nextCursor = integer(
      update.peerCursor,
      "peerCursor",
      current.peerCursor,
      Number.MAX_SAFE_INTEGER
    );
    const loopIncrement = integer(
      update.loopIncrement ?? 1,
      "loopIncrement",
      0,
      current.loopCap - current.loopCount
    );
    const next = validateLease({
      ...current,
      peerCursor: nextCursor,
      ...Object.hasOwn(update, "peerContinuity") ? { peerContinuity: update.peerContinuity } : {},
      continuationCount: current.continuationCount + 1,
      loopCount: current.loopCount + loopIncrement,
      state: update.terminal === false ? "armed" : "triggered",
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      diagnostic: update.diagnostic ?? null,
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, next);
    return { ok: true, lease: next };
  });
}
async function compareAndSwapCursor(root, ownerSession, expected, cursorUpdate, now = Date.now()) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.leaseId !== expected.leaseId || current.peerCursor !== expected.peerCursor || current.continuationCount !== expected.continuationCount || current.loopCount !== expected.loopCount) {
      return { ok: false, reason: "stale", lease: current };
    }
    const effective = effectiveLease(current, now);
    if (!["armed", "waiting"].includes(effective.state)) {
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective
      };
    }
    const update = cursorUpdate && typeof cursorUpdate === "object" && !Array.isArray(cursorUpdate) ? cursorUpdate : { peerCursor: cursorUpdate };
    const nextCursor = integer(
      update.peerCursor,
      "peerCursor",
      current.peerCursor + 1,
      Number.MAX_SAFE_INTEGER
    );
    const next = validateLease({
      ...current,
      peerCursor: nextCursor,
      ...Object.hasOwn(update, "peerContinuity") ? { peerContinuity: update.peerContinuity } : {},
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, next);
    return { ok: true, lease: next };
  });
}
async function beginLeaseWait(root, ownerSession, identity, now = Date.now(), waiter) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.runtime !== identity.runtime || current.peerRuntime !== identity.peerRuntime || current.peerSession !== identity.peerSession || current.ownerCwd !== identity.ownerCwd || current.peerTranscript !== identity.peerTranscript) {
      return { ok: false, reason: "identity-mismatch", lease: current };
    }
    const effective = effectiveLease(current, now);
    if (!["armed", "waiting"].includes(effective.state)) {
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective
      };
    }
    if (effective.state === "waiting") {
      if (waiter && effective.waitToken === waiter.token)
        return { ok: true, changed: false, lease: effective };
      return { ok: false, reason: "waiter-active", lease: effective };
    }
    if (!waiter)
      throw new LeaseError(
        "waiter-identity-required",
        "a generation-bound waiter identity is required"
      );
    const waiting = validateLease({
      ...effective,
      state: "waiting",
      waitStartedAt: new Date(now).toISOString(),
      waitDeadlineAt: new Date(
        Math.min(now + effective.waitMs, Date.parse(effective.expiresAt))
      ).toISOString(),
      waitToken: waiter.token,
      waitPid: waiter.pid,
      updatedAt: new Date(now).toISOString(),
      diagnostic: null
    });
    await atomicWriteJson(file, waiting);
    return { ok: true, changed: true, lease: waiting };
  });
}
async function finishLeaseWait(root, ownerSession, expected, diagnostic = "wait-timeout", now = Date.now()) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.leaseId !== expected.leaseId || current.peerCursor !== expected.peerCursor || current.continuationCount !== expected.continuationCount || current.loopCount !== expected.loopCount) {
      return { ok: false, reason: "stale", lease: current };
    }
    if (current.state !== "waiting")
      return { ok: false, reason: current.state, lease: current };
    const idle = validateLease({
      ...current,
      state: "idle",
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      diagnostic,
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, idle);
    return { ok: true, lease: idle };
  });
}

// src/skills/session-observer-collab/src/lib/runtime-adapter.mjs
var RUNTIME_ADAPTER_VERSION = 2;
function fileIdentity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
async function hashPrefix(handle, prefixBytes) {
  const hash = createHash("sha256");
  if (prefixBytes === 0) return hash.digest("hex");
  let bytesRead = 0;
  const stream = handle.createReadStream({
    start: 0,
    end: prefixBytes - 1,
    autoClose: false
  });
  for await (const chunk of stream) {
    bytesRead += chunk.byteLength;
    hash.update(chunk);
  }
  if (bytesRead !== prefixBytes) return null;
  return hash.digest("hex");
}
async function verifyAdapterPeerContinuity(lease, transcript) {
  if (lease.peerRuntime !== "cursor") {
    const requested = validateAbsolutePath(transcript, "transcript");
    return Object.freeze({
      verified: requested === lease.peerTranscript,
      reason: requested === lease.peerTranscript ? "verified" : "identity-mismatch",
      canonicalTranscriptPath: requested === lease.peerTranscript ? requested : null
    });
  }
  let requestedPath;
  let leasedPath;
  try {
    requestedPath = await canonicalizePeerTranscript("cursor", transcript);
    leasedPath = await canonicalizePeerTranscript(
      "cursor",
      lease.peerTranscript
    );
  } catch (error) {
    return Object.freeze({
      verified: false,
      reason: error?.code ?? "continuity-path-mismatch",
      canonicalTranscriptPath: null
    });
  }
  if (requestedPath.peerCanonicalTranscriptPath !== lease.peerCanonicalTranscriptPath || leasedPath.peerCanonicalTranscriptPath !== lease.peerCanonicalTranscriptPath || requestedPath.peerCanonicalTranscriptPath !== leasedPath.peerCanonicalTranscriptPath) {
    return Object.freeze({
      verified: false,
      reason: "continuity-path-mismatch",
      canonicalTranscriptPath: null
    });
  }
  const checkpoint = lease.peerContinuity;
  if (checkpoint === null) {
    return Object.freeze({
      verified: false,
      reason: "cursor-lease-rearm-required",
      canonicalTranscriptPath: null
    });
  }
  let handle;
  try {
    handle = await open2(lease.peerCanonicalTranscriptPath, "r");
    const metadata = await handle.stat();
    if (metadata.size < checkpoint.observedSize || metadata.size < checkpoint.prefixBytes) {
      return Object.freeze({
        verified: false,
        reason: "continuity-size-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
    if (checkpoint.device !== null && fileIdentity(metadata.dev) !== checkpoint.device) {
      return Object.freeze({
        verified: false,
        reason: "continuity-device-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
    if (checkpoint.inode !== null && fileIdentity(metadata.ino) !== checkpoint.inode) {
      return Object.freeze({
        verified: false,
        reason: "continuity-inode-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
    if (await hashPrefix(handle, checkpoint.prefixBytes) !== checkpoint.prefixSha256) {
      return Object.freeze({
        verified: false,
        reason: "continuity-prefix-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
  } catch (error) {
    return Object.freeze({
      verified: false,
      reason: error?.code ?? "continuity-read-failed",
      canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
    });
  } finally {
    await handle?.close();
  }
  return Object.freeze({
    verified: true,
    reason: "verified",
    canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
  });
}
async function validateCursorUpdate(lease, transcript, update) {
  if (lease.peerRuntime !== "cursor") {
    if (update && typeof update === "object" && Object.hasOwn(update, "peerContinuity") && update.peerContinuity !== null) {
      return { ok: false, reason: "continuity-not-applicable" };
    }
    return { ok: true, update };
  }
  if (!update || typeof update !== "object" || !Object.hasOwn(update, "peerContinuity") || update.peerContinuity === null) {
    return { ok: false, reason: "continuity-required" };
  }
  if (update.peerContinuity.nextFrameIndex !== update.peerCursor)
    return { ok: false, reason: "continuity-required" };
  const proposed = await verifyAdapterPeerContinuity(
    {
      ...lease,
      peerCursor: update.peerCursor,
      peerContinuity: update.peerContinuity
    },
    transcript
  );
  return proposed.verified ? { ok: true, update } : { ok: false, reason: proposed.reason };
}
function defineRuntimeAdapter(adapter) {
  if (!adapter || typeof adapter !== "object")
    throw new TypeError("adapter must be an object");
  validateOwnerRuntime(adapter.runtime);
  for (const method of ["identify", "emit"])
    if (typeof adapter[method] !== "function")
      throw new TypeError(`adapter.${method} must be a function`);
  return Object.freeze({ version: RUNTIME_ADAPTER_VERSION, ...adapter });
}
function validateAdapterInvocation(input) {
  if (!input || typeof input !== "object")
    throw new TypeError("invocation must be an object");
  return Object.freeze({
    runtime: validateOwnerRuntime(input.runtime),
    peerRuntime: validatePeerRuntime(input.peerRuntime),
    peerSession: validateId(input.peerSession, "peer-session"),
    ownerSession: validateId(input.ownerSession, "owner-session"),
    cwd: validateAbsolutePath(input.cwd, "cwd"),
    transcript: validateAbsolutePath(input.transcript, "transcript"),
    now: input.now === void 0 ? Date.now() : input.now,
    waiter: input.waiter
  });
}
async function inspectAdapterLease(root, invocation) {
  const input = validateAdapterInvocation(invocation);
  const lease = await readLease(root, input.ownerSession);
  if (!lease) return { eligible: false, reason: "missing", lease: null };
  if (lease.runtime !== input.runtime || lease.peerRuntime !== input.peerRuntime || lease.peerSession !== input.peerSession || lease.ownerCwd !== input.cwd) {
    return { eligible: false, reason: "identity-mismatch", lease };
  }
  const continuity = await verifyAdapterPeerContinuity(lease, input.transcript);
  if (!continuity.verified) {
    return { eligible: false, reason: continuity.reason, lease };
  }
  const effective = effectiveLease(lease, input.now);
  return {
    eligible: ["armed", "waiting"].includes(effective.state),
    reason: effective.diagnostic || effective.state,
    lease: effective
  };
}
async function beginAdapterWait(root, invocation) {
  const input = validateAdapterInvocation(invocation);
  const inspected = await inspectAdapterLease(root, input);
  if (!inspected.eligible || !inspected.lease) {
    return {
      ok: false,
      waiting: false,
      changed: false,
      reason: inspected.reason,
      lease: inspected.lease
    };
  }
  const waiter = input.waiter ?? await createWaiterIdentity();
  const result = await beginLeaseWait(
    root,
    input.ownerSession,
    {
      runtime: input.runtime,
      peerRuntime: input.peerRuntime,
      peerSession: input.peerSession,
      ownerCwd: input.cwd,
      peerTranscript: inspected.lease.peerTranscript
    },
    input.now,
    waiter
  );
  return {
    waiting: result.ok,
    changed: result.ok && result.changed,
    reason: result.ok ? "waiting" : result.reason,
    lease: result.lease ?? null
  };
}
async function advanceAdapterCursor(root, invocation, expected, cursorUpdate) {
  const inspected = await inspectAdapterLease(root, invocation);
  if (!inspected.eligible)
    return {
      advanced: false,
      reason: inspected.reason,
      lease: inspected.lease
    };
  const checked = await validateCursorUpdate(
    inspected.lease,
    invocation.transcript,
    cursorUpdate
  );
  if (!checked.ok)
    return {
      advanced: false,
      reason: checked.reason,
      lease: inspected.lease
    };
  const result = await compareAndSwapCursor(
    root,
    invocation.ownerSession,
    expected,
    checked.update,
    invocation.now
  );
  return {
    advanced: result.ok,
    reason: result.ok ? "advanced" : result.reason,
    lease: result.lease ?? null
  };
}
async function finishAdapterWait(root, invocation, expected, diagnostic = "wait-timeout") {
  const input = validateAdapterInvocation(invocation);
  const lease = await readLease(root, input.ownerSession);
  if (!lease)
    return {
      finished: false,
      reason: "missing",
      lease: null
    };
  if (lease.runtime !== input.runtime || lease.peerRuntime !== input.peerRuntime || lease.peerSession !== input.peerSession || lease.ownerCwd !== input.cwd || lease.peerTranscript !== input.transcript)
    return { finished: false, reason: "identity-mismatch", lease };
  const result = await finishLeaseWait(
    root,
    input.ownerSession,
    expected,
    diagnostic,
    input.now
  );
  return {
    finished: result.ok,
    reason: result.ok ? diagnostic : result.reason,
    lease: result.lease ?? null
  };
}
async function claimAdapterTrigger(root, invocation, expected, completion, clock = () => invocation.now) {
  const inspected = await inspectAdapterLease(root, invocation);
  if (!inspected.eligible)
    return {
      triggered: false,
      reason: inspected.reason,
      lease: inspected.lease
    };
  if (!completion || !Number.isSafeInteger(completion.peerCursor) || completion.peerCursor <= expected.peerCursor) {
    return { triggered: false, reason: "no-advance", lease: inspected.lease };
  }
  const checked = await validateCursorUpdate(
    inspected.lease,
    invocation.transcript,
    completion
  );
  if (!checked.ok)
    return {
      triggered: false,
      reason: checked.reason,
      lease: inspected.lease
    };
  const result = await compareAndSwapTrigger(
    root,
    invocation.ownerSession,
    expected,
    checked.update,
    clock
  );
  return {
    triggered: result.ok,
    reason: result.ok ? "triggered" : result.reason,
    lease: result.lease ?? null
  };
}
export {
  RUNTIME_ADAPTER_VERSION,
  advanceAdapterCursor,
  beginAdapterWait,
  claimAdapterTrigger,
  defineRuntimeAdapter,
  finishAdapterWait,
  inspectAdapterLease,
  validateAdapterInvocation,
  verifyAdapterPeerContinuity
};
