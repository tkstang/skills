// GENERATED skill payload for session-observer.

// src/skills/session-observer/src/lib/state.ts
import {
  access,
  link as link2,
  mkdir as mkdir2,
  open as open3,
  readFile as readFile3,
  readdir as readdir2,
  realpath,
  rename as rename2,
  stat as stat2,
  unlink as unlink2
} from "node:fs/promises";
import { homedir as homedir3 } from "node:os";
import { dirname as dirname2, join as join3 } from "node:path";

// src/shared/transcript/runtimes.ts
import { open, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function safeParseLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!isObject(parsed)) return { ok: false, reason: "not a JSON object" };
    return { ok: true, value: parsed };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err)
    };
  }
}
async function readRecords(transcriptPath) {
  const raw = await readFile(transcriptPath, "utf8");
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const records = [];
  const fileEndsWithNewline = raw.endsWith("\n") || raw.endsWith("\r\n");
  const lastIndex = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const result = safeParseLine(line);
    if (result.ok) {
      records.push(result.value);
      continue;
    }
    const isLastToken = i === lastIndex;
    if (isLastToken && !fileEndsWithNewline) {
      console.warn(
        `[runtimes] Partial trailing line dropped from ${transcriptPath} (line ${i + 1}): ${result.reason}`
      );
    } else {
      console.warn(
        `[runtimes] Malformed JSONL line ${i + 1} in ${transcriptPath} skipped: ${result.reason}`
      );
    }
  }
  return records;
}
function claudeSessionIdFromRecord(record) {
  const message = isObject(record.message) ? record.message : record;
  return asString(record.sessionId) ?? asString(record.session_id) ?? asString(record.sessionID) ?? asString(message.sessionId) ?? asString(message.session_id);
}
function decodeCwdDirName(dirName) {
  if (!dirName.startsWith("-")) return null;
  return dirName.replace(/-/g, "/");
}
function codexSessionIdFromRecord(record) {
  const payload = isObject(record.payload) ? record.payload : record;
  return asString(record.sessionId) ?? asString(record.session_id) ?? asString(payload.sessionId) ?? asString(payload.session_id);
}
function consistentNonEmptyString(values) {
  let observed;
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) return void 0;
    if (observed !== void 0 && observed !== value) return void 0;
    observed = value;
  }
  return observed;
}
var CODEX_ROLLOUT_FILENAME_PATTERN = /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/iu;
function codexRolloutFilenameSessionId(transcriptPath) {
  return CODEX_ROLLOUT_FILENAME_PATTERN.exec(basename(transcriptPath))?.[1];
}
function firstCodexSessionHeader(records) {
  return records.find((record) => record.type === "session_meta");
}
function codexDirectParentValues(payload) {
  const values = [];
  if (Object.hasOwn(payload, "parent_thread_id")) {
    values.push(payload.parent_thread_id);
  }
  const source = isObject(payload.source) ? payload.source : void 0;
  const subagent = source && isObject(source.subagent) ? source.subagent : void 0;
  const threadSpawn = subagent && isObject(subagent.thread_spawn) ? subagent.thread_spawn : void 0;
  if (threadSpawn && Object.hasOwn(threadSpawn, "parent_thread_id")) {
    values.push(threadSpawn.parent_thread_id);
  }
  return values;
}
function codexLineageMetadata(firstHeader) {
  if (!isObject(firstHeader.payload)) return null;
  const payload = firstHeader.payload;
  if (!Object.hasOwn(payload, "id")) return {};
  const nativeSessionId = consistentNonEmptyString([payload.id]);
  if (nativeSessionId === void 0) return null;
  const rootSessionId = Object.hasOwn(payload, "session_id") ? consistentNonEmptyString([payload.session_id]) : void 0;
  const parentValues = codexDirectParentValues(payload);
  const parentSessionId = consistentNonEmptyString(parentValues);
  if (parentValues.length > 0 && parentSessionId === void 0) return null;
  const forkedFromSessionId = Object.hasOwn(payload, "forked_from_id") ? consistentNonEmptyString([payload.forked_from_id]) : void 0;
  const historyBoundary = payload.subagent_history_start_ordinal;
  const subagentHistoryStartOrdinal = Number.isSafeInteger(historyBoundary) && Number(historyBoundary) >= 0 ? Number(historyBoundary) : void 0;
  return {
    nativeSessionId,
    ...rootSessionId === void 0 ? {} : { rootSessionId },
    ...parentSessionId === void 0 ? {} : { parentSessionId },
    ...forkedFromSessionId === void 0 ? {} : { forkedFromSessionId },
    ...subagentHistoryStartOrdinal === void 0 ? {} : { subagentHistoryStartOrdinal }
  };
}
function claudeRecordLineage(records) {
  const result = [];
  for (const record of records) {
    if (!Object.hasOwn(record, "uuid")) continue;
    if (typeof record.uuid !== "string" || record.uuid.length === 0) {
      return void 0;
    }
    if (Object.hasOwn(record, "parentUuid") && record.parentUuid !== null && (typeof record.parentUuid !== "string" || record.parentUuid.length === 0)) {
      return void 0;
    }
    result.push({
      uuid: record.uuid,
      parentUuid: typeof record.parentUuid === "string" ? record.parentUuid : null
    });
  }
  return result.length === 0 ? void 0 : result;
}
function extractClaudeRecordedCwdFromRecords(records) {
  let recordedCwd = null;
  for (const record of records) {
    if (!Object.hasOwn(record, "cwd")) continue;
    const cwd = record.cwd;
    if (typeof cwd !== "string" || cwd.length === 0 || !isAbsolute(cwd)) {
      return null;
    }
    if (recordedCwd !== null && cwd !== recordedCwd) return null;
    recordedCwd = cwd;
  }
  return recordedCwd;
}
function extractMetaFromRecords(runtime, records, transcriptPath) {
  if (runtime === "claude-code") {
    let sessionId;
    for (const record of records) {
      const id = claudeSessionIdFromRecord(record);
      if (id) {
        sessionId = id;
        break;
      }
    }
    if (!sessionId) {
      sessionId = basename(transcriptPath).replace(/\.jsonl$/u, "");
    }
    const nativeSessionId = consistentNonEmptyString(
      records.filter((record) => Object.hasOwn(record, "sessionId")).map((record) => record.sessionId)
    );
    const exactRecordedCwd = extractClaudeRecordedCwdFromRecords(records);
    const recordLineage = claudeRecordLineage(records);
    const parentDirName = basename(dirname(transcriptPath));
    const recordedCwd = exactRecordedCwd ?? decodeCwdDirName(parentDirName);
    return {
      sessionId,
      recordedCwd,
      ...nativeSessionId === void 0 ? {} : { nativeSessionId },
      ...recordLineage === void 0 ? {} : { recordLineage }
    };
  }
  if (runtime === "codex") {
    const firstHeader = firstCodexSessionHeader(records);
    const lineage = firstHeader ? codexLineageMetadata(firstHeader) : {};
    if (lineage === null) return null;
    const nativeSessionId = lineage.nativeSessionId;
    const filenameSessionId = codexRolloutFilenameSessionId(transcriptPath);
    if (nativeSessionId !== void 0 && filenameSessionId !== void 0 && nativeSessionId.toLowerCase() !== filenameSessionId.toLowerCase()) {
      return null;
    }
    let sessionId = nativeSessionId;
    let recordedCwd = null;
    for (const record of records) {
      if (!sessionId) {
        const id = codexSessionIdFromRecord(record);
        if (id) sessionId = id;
      }
      if (recordedCwd === null) {
        const topLevelCwd = asString(record.cwd);
        const payloadCwd = isObject(record.payload) ? asString(record.payload.cwd) : void 0;
        const cwd = topLevelCwd ?? payloadCwd;
        if (cwd) recordedCwd = cwd;
      }
      if (sessionId && recordedCwd !== null) break;
    }
    if (!sessionId) {
      sessionId = basename(transcriptPath).replace(/\.jsonl$/u, "");
    }
    return { sessionId, recordedCwd, ...lineage };
  }
  if (runtime === "cursor") {
    const transcriptBase = basename(transcriptPath).replace(/\.jsonl$/u, "");
    const parentDirName = basename(dirname(transcriptPath));
    const sessionId = transcriptBase && !["transcript", "conversation", "messages"].includes(transcriptBase) ? transcriptBase : parentDirName;
    return { sessionId, recordedCwd: null };
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}

// src/skills/session-observer/src/lib/cursor-state.ts
import {
  chmod,
  link,
  mkdir,
  open as open2,
  readFile as readFile2,
  readdir,
  rename,
  stat,
  unlink
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";
var SCHEMA_VERSION = 2;
var LOCK_RETRIES = 100;
var LOCK_INTERVAL_MS = 50;
var backupSequence = 0;
var lockSequence = 0;
var CursorStateRecoveryRequiredError = class extends Error {
  constructor(reason) {
    super(
      `cursor-state: ${reason} shared state requires destructive whole-store reset and replay; run session-observer state reset --runtime cursor; sibling Cursor sessions cannot be preserved`
    );
    this.reason = reason;
    this.name = "CursorStateRecoveryRequiredError";
  }
  reason;
  code = "CURSOR_STATE_RECOVERY_REQUIRED";
  recoveryScope = "cursor-store";
  recoveryOperation = "state reset --runtime cursor";
  recoveryCommand = "session-observer state reset --runtime cursor";
  destructive = true;
  preservesSiblingSessions = false;
};
function isErrnoException(error) {
  return error instanceof Error && "code" in error;
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function isNullableNonNegativeInteger(value) {
  return value === null || isNonNegativeInteger(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isIntegerArray(value) {
  return Array.isArray(value) && value.every(isNonNegativeInteger);
}
function hasOnlyKeys(value, keys) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}
function isCheckpoint(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "indexBase",
    "nextFrameIndex",
    "prefixBytes",
    "prefixSha256",
    "observedSize",
    "device",
    "inode"
  ]) && value.indexBase === "zero-based-jsonl-frame-index" && isNonNegativeInteger(value.nextFrameIndex) && isNonNegativeInteger(value.prefixBytes) && typeof value.prefixSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.prefixSha256) && isNonNegativeInteger(value.observedSize) && value.prefixBytes <= value.observedSize && isNullableNonNegativeInteger(value.device) && isNullableNonNegativeInteger(value.inode);
}
function isDeliveryCheckpoint(expected, intended, reservedThroughFrameIndex, expectedNextFrameIndex) {
  return expected.device !== null && expected.inode !== null && intended.device === expected.device && intended.inode === expected.inode && intended.indexBase === expected.indexBase && reservedThroughFrameIndex >= expectedNextFrameIndex && intended.nextFrameIndex >= expected.nextFrameIndex && intended.nextFrameIndex <= reservedThroughFrameIndex + 1 && intended.prefixBytes >= expected.prefixBytes && (intended.prefixBytes > expected.prefixBytes || intended.prefixSha256 === expected.prefixSha256);
}
function isHashRecord(value) {
  return isObject2(value) && Object.values(value).every(
    (entry) => typeof entry === "string" && /^[a-f0-9]{64}$/u.test(entry)
  );
}
function isObservationStatus(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "engagement",
    "activity",
    "content",
    "lifecycle",
    "delivery",
    "health"
  ]) && ["engaged", "unengaged", "unknown"].includes(String(value.engagement)) && ["none", "human-input", "assistant-progress", "tool-activity"].includes(
    String(value.activity)
  ) && ["none", "buffered", "available", "suppressed"].includes(
    String(value.content)
  ) && [
    "none",
    "pending",
    "success",
    "aborted",
    "error",
    "cancelled",
    "unknown"
  ].includes(String(value.lifecycle)) && ["none", "reserved", "committed", "uncertain"].includes(
    String(value.delivery)
  ) && ["healthy", "blocked", "stale", "error", "unknown"].includes(
    String(value.health)
  );
}
function isOpenTurn(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "turnId",
    "fromFrameIndex",
    "observedThroughFrame",
    "deliveredEntryKeys",
    "deliveredEntryHashes",
    "assistantEntryKeys",
    "humanRecordIndexes",
    "toolRecordIndexes",
    "hasHumanInput",
    "hasAutomaticControlInput",
    "lifecycle"
  ]) && typeof value.turnId === "string" && isNonNegativeInteger(value.fromFrameIndex) && isNonNegativeInteger(value.observedThroughFrame) && isStringArray(value.deliveredEntryKeys) && (value.deliveredEntryHashes === void 0 || isHashRecord(value.deliveredEntryHashes) && Object.keys(value.deliveredEntryHashes).every(
    (entryKey) => value.deliveredEntryKeys.includes(entryKey)
  )) && isStringArray(value.assistantEntryKeys) && isIntegerArray(value.humanRecordIndexes) && isIntegerArray(value.toolRecordIndexes) && typeof value.hasHumanInput === "boolean" && typeof value.hasAutomaticControlInput === "boolean" && ["pending", "success", "aborted", "error", "cancelled", "unknown"].includes(
    String(value.lifecycle)
  );
}
function isStabilityCandidate(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "turnId",
    "fromFrameIndex",
    "throughFrameIndex",
    "entryKeys",
    "prefixBytes",
    "prefixSha256",
    "firstObservedAt",
    "confirmAfter",
    "confirmedAt"
  ]) && typeof value.turnId === "string" && isNonNegativeInteger(value.fromFrameIndex) && isNonNegativeInteger(value.throughFrameIndex) && isStringArray(value.entryKeys) && isNonNegativeInteger(value.prefixBytes) && typeof value.prefixSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.prefixSha256) && typeof value.firstObservedAt === "string" && Number.isFinite(Date.parse(value.firstObservedAt)) && typeof value.confirmAfter === "string" && Number.isFinite(Date.parse(value.confirmAfter)) && (value.confirmedAt === null || typeof value.confirmedAt === "string" && Number.isFinite(Date.parse(value.confirmedAt)));
}
function isPendingDelivery(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "deliveryId",
    "canonicalCwd",
    "transcriptPath",
    "expectedNextFrameIndex",
    "expectedCheckpoint",
    "reservedThroughFrameIndex",
    "entryKeys",
    "entryHashes",
    "intendedCheckpoint",
    "reservedByPid",
    "reservedAt"
  ]) && typeof value.deliveryId === "string" && value.deliveryId.length > 0 && typeof value.canonicalCwd === "string" && value.canonicalCwd.length > 0 && typeof value.transcriptPath === "string" && value.transcriptPath.length > 0 && isNonNegativeInteger(value.expectedNextFrameIndex) && isCheckpoint(value.expectedCheckpoint) && value.expectedNextFrameIndex >= value.expectedCheckpoint.nextFrameIndex && isNonNegativeInteger(value.reservedThroughFrameIndex) && isStringArray(value.entryKeys) && (value.entryHashes === void 0 || isHashRecord(value.entryHashes) && Object.keys(value.entryHashes).every(
    (entryKey) => value.entryKeys.includes(entryKey)
  )) && isCheckpoint(value.intendedCheckpoint) && isDeliveryCheckpoint(
    value.expectedCheckpoint,
    value.intendedCheckpoint,
    value.reservedThroughFrameIndex,
    value.expectedNextFrameIndex
  ) && isNonNegativeInteger(value.reservedByPid) && value.reservedByPid > 0 && typeof value.reservedAt === "string" && Number.isFinite(Date.parse(value.reservedAt));
}
function isSessionEntry(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "runtime",
    "sessionId",
    "indexBase",
    "lastRecordIndex",
    "canonicalCwd",
    "transcriptPath",
    "continuity",
    "lastStatus",
    "openTurn",
    "stabilityCandidate",
    "pendingDelivery"
  ]) && value.runtime === "cursor" && typeof value.sessionId === "string" && value.sessionId.length > 0 && value.indexBase === "zero-based-jsonl-frame-index" && isNonNegativeInteger(value.lastRecordIndex) && typeof value.canonicalCwd === "string" && value.canonicalCwd.length > 0 && typeof value.transcriptPath === "string" && value.transcriptPath.length > 0 && isCheckpoint(value.continuity) && value.lastRecordIndex >= value.continuity.nextFrameIndex && isObservationStatus(value.lastStatus) && (value.openTurn === null || isOpenTurn(value.openTurn)) && (value.stabilityCandidate === null || isStabilityCandidate(value.stabilityCandidate)) && (value.pendingDelivery === null || isPendingDelivery(value.pendingDelivery) && value.pendingDelivery.canonicalCwd === value.canonicalCwd && value.pendingDelivery.transcriptPath === value.transcriptPath && value.pendingDelivery.expectedNextFrameIndex === value.lastRecordIndex && checkpointsEqual(
    value.pendingDelivery.expectedCheckpoint,
    value.continuity
  ));
}
function isLegacyMarker(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "runtime",
    "sessionId",
    "legacyLastRecordIndex",
    "transcriptPath",
    "recordedCwd",
    "lastReadAt",
    "backupPath",
    "migrationStatus",
    "createdAt"
  ]) && value.runtime === "cursor" && typeof value.sessionId === "string" && value.sessionId.length > 0 && isNonNegativeInteger(value.legacyLastRecordIndex) && (value.transcriptPath === void 0 || typeof value.transcriptPath === "string") && (value.recordedCwd === void 0 || value.recordedCwd === null || typeof value.recordedCwd === "string") && (value.lastReadAt === void 0 || typeof value.lastReadAt === "string" && Number.isFinite(Date.parse(value.lastReadAt))) && typeof value.backupPath === "string" && ["marker-written", "legacy-removed", "complete"].includes(
    String(value.migrationStatus)
  ) && typeof value.createdAt === "string";
}
function isCursorState(value) {
  if (!isObject2(value) || !hasOnlyKeys(value, ["schemaVersion", "sessions", "legacyUnverified"]) || value.schemaVersion !== SCHEMA_VERSION || !isObject2(value.sessions) || !isObject2(value.legacyUnverified)) {
    return false;
  }
  return Object.entries(value.sessions).every(
    ([key, entry]) => isSessionEntry(entry) && key === cursorSessionKey(entry.sessionId)
  ) && Object.entries(value.legacyUnverified).every(
    ([key, marker]) => isLegacyMarker(marker) && key === cursorSessionKey(marker.sessionId)
  );
}
function emptyCursorState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: {},
    legacyUnverified: {}
  };
}
function stateDir() {
  return process.env.STATE_DIR ?? join2(homedir2(), ".local", "state", "session-observer");
}
function statePath(dir) {
  return join2(dir, "cursor-state.json");
}
function lockPath(dir) {
  return join2(dir, "cursor-state.json.lock");
}
function tempPath(dir) {
  return join2(dir, `cursor-state.json.${process.pid}.tmp`);
}
function backupPath(dir, label) {
  backupSequence += 1;
  return join2(
    dir,
    `cursor-state.json.${label}-${Date.now()}-${process.pid}-${backupSequence}.bak`
  );
}
async function ensurePrivateDirectory(dir) {
  await mkdir(dir, { recursive: true, mode: 448 });
  await chmod(dir, 448);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isErrnoException(error) || error.code !== "ESRCH";
  }
}
function lockOwnerPid(owner) {
  if (!/^[1-9]\d*$/u.test(owner) && !/^[1-9]\d*:\d+:[1-9]\d*$/u.test(owner)) {
    return null;
  }
  const pid = Number(owner.split(":", 1)[0]);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
function lockOwnersPath(path) {
  return `${path}.owners`;
}
function lockOwnerTokensPath(path) {
  return `${path}.owner-tokens`;
}
function contenderTicket(name) {
  const match = /^(\d{20})\.owner$/u.exec(name);
  if (!match) return null;
  const ticket = Number(match[1]);
  return Number.isSafeInteger(ticket) ? ticket : null;
}
function privateTokenPid(name) {
  const match = /^([1-9]\d*)-\d+-[1-9]\d*\.token$/u.exec(name);
  if (!match) return null;
  const pid = Number(match[1]);
  return Number.isSafeInteger(pid) ? pid : null;
}
async function cleanupAbandonedPrivateTokens(path) {
  const tokens = lockOwnerTokensPath(path);
  let names;
  try {
    names = await readdir(tokens);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const pid = privateTokenPid(name);
    if (pid === null || processIsAlive(pid)) continue;
    await unlink(join2(tokens, name)).catch((error) => {
      if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
    });
  }
}
async function createLockContender(path, owner, options = {}) {
  const owners = lockOwnersPath(path);
  const tokens = lockOwnerTokensPath(path);
  await mkdir(owners, { recursive: true, mode: 448 });
  await mkdir(tokens, { recursive: true, mode: 448 });
  await cleanupAbandonedPrivateTokens(path);
  const privatePath = join2(tokens, `${owner.replaceAll(":", "-")}.token`);
  let handle;
  try {
    handle = await open2(privatePath, "wx", 384);
    await options.onLockPublicationBoundary?.("private-created");
    await handle.writeFile(owner, "utf8");
    await options.onLockPublicationBoundary?.("token-written");
    await handle.datasync();
    await options.onLockPublicationBoundary?.("token-synced");
    await handle.close();
    handle = void 0;
    for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
      const names = await readdir(owners);
      let maximum = 0;
      for (const name of names) {
        const ticket = contenderTicket(name);
        if (ticket === null) {
          throw new Error(`cursor-state: invalid lock contender ${name}`);
        }
        maximum = Math.max(maximum, ticket);
      }
      const next = maximum + 1;
      if (!Number.isSafeInteger(next)) {
        throw new Error("cursor-state: lock contender sequence exhausted");
      }
      const ownerPath = join2(owners, `${String(next).padStart(20, "0")}.owner`);
      try {
        await link(privatePath, ownerPath);
        await unlink(privatePath).catch(() => void 0);
        return ownerPath;
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "EEXIST") throw error;
      }
    }
    throw new Error("cursor-state: could not allocate lock contender");
  } finally {
    if (handle) await handle.close();
    await unlink(privatePath).catch(() => void 0);
  }
}
async function contenderOwnsTurn(path, ownerPath, owner) {
  const owners = lockOwnersPath(path);
  const live = [];
  for (const name of (await readdir(owners)).toSorted()) {
    if (contenderTicket(name) === null) return false;
    const contenderPath = join2(owners, name);
    let contenderOwner;
    try {
      contenderOwner = await readFile2(contenderPath, "utf8");
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") continue;
      throw error;
    }
    const pid = lockOwnerPid(contenderOwner);
    if (pid === null) return false;
    if (!processIsAlive(pid)) {
      await unlink(contenderPath).catch((error) => {
        if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
      });
      continue;
    }
    if (contenderPath === ownerPath && contenderOwner !== owner) return false;
    live.push(contenderPath);
  }
  return live[0] === ownerPath;
}
async function readLockGeneration(path) {
  try {
    const rawOwner = await readFile2(path, "utf8");
    const current = await stat(path);
    return { rawOwner, device: current.dev, inode: current.ino };
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  }
}
function sameLockGeneration(left, right) {
  return right !== null && left.rawOwner === right.rawOwner && left.device === right.device && left.inode === right.inode;
}
async function acquireLock(path, options = {}) {
  const owner = `${process.pid}:${Date.now()}:${++lockSequence}`;
  const ownerPath = await createLockContender(path, owner, options);
  try {
    for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
      if (!await contenderOwnsTurn(path, ownerPath, owner)) {
        await sleep(LOCK_INTERVAL_MS);
        continue;
      }
      try {
        await link(ownerPath, path);
        return { owner, ownerPath };
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "EEXIST") throw error;
      }
      const observed = await readLockGeneration(path);
      if (observed === null) continue;
      const ownerPid = lockOwnerPid(observed.rawOwner);
      if (ownerPid === null || processIsAlive(ownerPid)) {
        await sleep(LOCK_INTERVAL_MS);
        continue;
      }
      const current = await readLockGeneration(path);
      if (!sameLockGeneration(observed, current)) continue;
      try {
        await unlink(path);
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    await unlink(ownerPath).catch(() => void 0);
    throw error;
  }
  await unlink(ownerPath).catch(() => void 0);
  throw new Error(
    `cursor-state: could not acquire lock after ${LOCK_RETRIES} retries`
  );
}
async function releaseLock(path, ownership) {
  try {
    if (await readFile2(path, "utf8") === ownership.owner) {
      await unlink(path);
    }
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
  }
  try {
    await unlink(ownership.ownerPath);
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
  }
}
async function writePrivateAtomic(path, temporaryPath, content) {
  let handle;
  try {
    handle = await open2(temporaryPath, "w", 384);
    await handle.writeFile(content, "utf8");
    await handle.datasync();
    await handle.close();
    handle = void 0;
    await rename(temporaryPath, path);
    await chmod(path, 384);
  } finally {
    if (handle) await handle.close();
    try {
      await unlink(temporaryPath);
    } catch {
    }
  }
}
async function writeBackup(dir, label, raw) {
  const destination = backupPath(dir, label);
  await writePrivateAtomic(destination, `${destination}.tmp`, raw);
}
async function readCursorState(dir) {
  let raw;
  try {
    raw = await readFile2(statePath(dir), "utf8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return emptyCursorState();
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await writeBackup(dir, "corrupt", raw);
    throw new CursorStateRecoveryRequiredError("corrupt");
  }
  if (!isCursorState(parsed)) {
    await writeBackup(dir, "schema", raw);
    throw new CursorStateRecoveryRequiredError("schema");
  }
  return parsed;
}
async function writeCursorState(dir, state) {
  if (!isCursorState(state)) {
    throw new TypeError("cursor-state: invalid schema v2 state");
  }
  await writePrivateAtomic(
    statePath(dir),
    tempPath(dir),
    JSON.stringify(state, null, 2)
  );
}
function checkpointsEqual(left, right) {
  return left.indexBase === right.indexBase && left.nextFrameIndex === right.nextFrameIndex && left.prefixBytes === right.prefixBytes && left.prefixSha256 === right.prefixSha256 && left.observedSize === right.observedSize && left.device === right.device && left.inode === right.inode;
}
function cursorSessionKey(sessionId) {
  return `cursor:${sessionId}`;
}
async function loadCursorState() {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  const owner = await acquireLock(lock);
  try {
    return await readCursorState(dir);
  } finally {
    await releaseLock(lock, owner);
  }
}
async function mutateCursorState(mutate2, options = {}) {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  const owner = await acquireLock(lock, options);
  try {
    const current = await readCursorState(dir);
    await options.onMutationBoundary?.("locked");
    const next = mutate2(current) ?? current;
    await writeCursorState(dir, next);
    await options.onMutationBoundary?.("written");
    return next;
  } finally {
    await releaseLock(lock, owner);
  }
}
async function resetCursorSessionState(sessionId) {
  let removed = false;
  await mutateCursorState((state) => {
    const key = cursorSessionKey(sessionId);
    removed = Object.hasOwn(state.sessions, key) || Object.hasOwn(state.legacyUnverified, key);
    delete state.sessions[key];
    delete state.legacyUnverified[key];
  });
  return removed;
}
async function resetAllCursorState() {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  const owner = await acquireLock(lock);
  try {
    let count = 0;
    try {
      const state = await readCursorState(dir);
      count = (/* @__PURE__ */ new Set([
        ...Object.keys(state.sessions),
        ...Object.keys(state.legacyUnverified)
      ])).size;
    } catch (error) {
      if (!(error instanceof CursorStateRecoveryRequiredError)) throw error;
    }
    await writeCursorState(dir, emptyCursorState());
    return count;
  } finally {
    await releaseLock(lock, owner);
  }
}
async function clearCursorState() {
  await resetAllCursorState();
}

// src/skills/session-observer/src/lib/state.ts
var SCHEMA_VERSION2 = 1;
var LOCK_RETRIES2 = 100;
var LOCK_INTERVAL_MS2 = 50;
var CURSOR_COMPATIBILITY = "pre-integration-record-index";
var migrationBackupSequence = 0;
var lockSequence2 = 0;
function isErrnoException2(err) {
  return err instanceof Error && "code" in err;
}
function stateDir2() {
  return process.env.STATE_DIR ?? join3(homedir3(), ".local", "state", "session-observer");
}
function statePath2(dir) {
  return join3(dir, "state.json");
}
function lockPath2(dir) {
  return join3(dir, "state.json.lock");
}
function cursorTransitionLockPath(dir) {
  return join3(dir, "cursor-state-transition.lock");
}
function tmpPath(dir) {
  return join3(dir, `state.json.${process.pid}.tmp`);
}
function bakPath(dir, label) {
  return join3(dir, `state.json.${label}-${Date.now()}-${process.pid}.bak`);
}
function isPidLive(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (isErrnoException2(err) && err.code === "ESRCH") return false;
    if (isErrnoException2(err) && err.code === "EPERM") return true;
    throw err;
  }
}
function lockOwnerPid2(owner) {
  if (!/^[1-9]\d*$/u.test(owner) && !/^[1-9]\d*:\d+:[1-9]\d*$/u.test(owner)) {
    return null;
  }
  const pid = Number(owner.split(":", 1)[0]);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
function lockOwnersPath2(lock) {
  return `${lock}.owners`;
}
function lockOwnerTokensPath2(lock) {
  return `${lock}.owner-tokens`;
}
function contenderTicket2(name) {
  const match = /^(\d{20})\.owner$/u.exec(name);
  if (!match) return null;
  const ticket = Number(match[1]);
  return Number.isSafeInteger(ticket) ? ticket : null;
}
function privateTokenPid2(name) {
  const match = /^([1-9]\d*)-\d+-[1-9]\d*\.token$/u.exec(name);
  if (!match) return null;
  const pid = Number(match[1]);
  return Number.isSafeInteger(pid) ? pid : null;
}
async function cleanupAbandonedPrivateTokens2(lock) {
  const tokens = lockOwnerTokensPath2(lock);
  let names;
  try {
    names = await readdir2(tokens);
  } catch (error) {
    if (isErrnoException2(error) && error.code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const pid = privateTokenPid2(name);
    if (pid === null || isPidLive(pid)) continue;
    await unlink2(join3(tokens, name)).catch((error) => {
      if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
    });
  }
}
async function createLockContender2(lock, owner, options = {}) {
  const owners = lockOwnersPath2(lock);
  const tokens = lockOwnerTokensPath2(lock);
  await mkdir2(owners, { recursive: true, mode: 448 });
  await mkdir2(tokens, { recursive: true, mode: 448 });
  await cleanupAbandonedPrivateTokens2(lock);
  const privatePath = join3(tokens, `${owner.replaceAll(":", "-")}.token`);
  let handle;
  try {
    handle = await open3(privatePath, "wx", 384);
    await options.onLockPublicationBoundary?.("private-created");
    await handle.writeFile(owner, "utf8");
    await options.onLockPublicationBoundary?.("token-written");
    await handle.datasync();
    await options.onLockPublicationBoundary?.("token-synced");
    await handle.close();
    handle = void 0;
    for (let attempt = 0; attempt < LOCK_RETRIES2; attempt += 1) {
      const names = await readdir2(owners);
      let maximum = 0;
      for (const name of names) {
        const ticket = contenderTicket2(name);
        if (ticket === null) {
          throw new Error(`state.mjs: invalid lock contender ${name}`);
        }
        maximum = Math.max(maximum, ticket);
      }
      const next = maximum + 1;
      if (!Number.isSafeInteger(next)) {
        throw new Error("state.mjs: lock contender sequence exhausted");
      }
      const ownerPath = join3(owners, `${String(next).padStart(20, "0")}.owner`);
      try {
        await link2(privatePath, ownerPath);
        await unlink2(privatePath).catch(() => void 0);
        return ownerPath;
      } catch (error) {
        if (!isErrnoException2(error) || error.code !== "EEXIST") throw error;
      }
    }
    throw new Error("state.mjs: could not allocate lock contender");
  } finally {
    if (handle) await handle.close();
    await unlink2(privatePath).catch(() => void 0);
  }
}
async function contenderOwnsTurn2(lock, ownerPath, owner) {
  const owners = lockOwnersPath2(lock);
  const live = [];
  for (const name of (await readdir2(owners)).toSorted()) {
    if (contenderTicket2(name) === null) return false;
    const path = join3(owners, name);
    let contenderOwner;
    try {
      contenderOwner = await readFile3(path, "utf8");
    } catch (error) {
      if (isErrnoException2(error) && error.code === "ENOENT") continue;
      throw error;
    }
    const pid = lockOwnerPid2(contenderOwner);
    if (pid === null) return false;
    if (!isPidLive(pid)) {
      await unlink2(path).catch((error) => {
        if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
      });
      continue;
    }
    if (path === ownerPath && contenderOwner !== owner) return false;
    live.push(path);
  }
  return live[0] === ownerPath;
}
async function readLockGeneration2(lock) {
  try {
    const rawOwner = await readFile3(lock, "utf8");
    const current = await stat2(lock);
    return { rawOwner, device: current.dev, inode: current.ino };
  } catch (error) {
    if (isErrnoException2(error) && error.code === "ENOENT") return null;
    throw error;
  }
}
function sameLockGeneration2(left, right) {
  return right !== null && left.rawOwner === right.rawOwner && left.device === right.device && left.inode === right.inode;
}
async function acquireLock2(lock, options = {}) {
  const owner = `${process.pid}:${Date.now()}:${++lockSequence2}`;
  const ownerPath = await createLockContender2(lock, owner, options);
  try {
    for (let attempt = 0; attempt < LOCK_RETRIES2; attempt += 1) {
      if (!await contenderOwnsTurn2(lock, ownerPath, owner)) {
        await sleep2(LOCK_INTERVAL_MS2);
        continue;
      }
      try {
        await link2(ownerPath, lock);
        return { owner, ownerPath };
      } catch (error) {
        if (!isErrnoException2(error) || error.code !== "EEXIST") throw error;
      }
      const observed = await readLockGeneration2(lock);
      if (observed === null) continue;
      const ownerPid = lockOwnerPid2(observed.rawOwner);
      if (ownerPid === null || isPidLive(ownerPid)) {
        await sleep2(LOCK_INTERVAL_MS2);
        continue;
      }
      const current = await readLockGeneration2(lock);
      if (!sameLockGeneration2(observed, current)) continue;
      try {
        await unlink2(lock);
      } catch (error) {
        if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    await unlink2(ownerPath).catch(() => void 0);
    throw error;
  }
  await unlink2(ownerPath).catch(() => void 0);
  throw new Error(
    `state.mjs: could not acquire lock after ${LOCK_RETRIES2} retries`
  );
}
async function releaseLock2(lock, ownership) {
  try {
    if (await readFile3(lock, "utf8") === ownership.owner) {
      await unlink2(lock);
    }
  } catch (error) {
    if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
  }
  try {
    await unlink2(ownership.ownerPath);
  } catch (error) {
    if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
  }
}
async function withCursorTransitionLock(transition, options = {}) {
  const dir = stateDir2();
  await mkdir2(dir, { recursive: true });
  const lock = cursorTransitionLockPath(dir);
  const ownership = await acquireLock2(lock, options);
  try {
    return await transition();
  } finally {
    await releaseLock2(lock, ownership);
  }
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function emptyState() {
  return { schemaVersion: SCHEMA_VERSION2, sessions: {} };
}
async function writeBackup2(dir, label, content) {
  const bak = bakPath(dir, label);
  const tmp = bak + ".tmp";
  let fh;
  try {
    fh = await open3(tmp, "w");
    await fh.write(content);
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename2(tmp, bak);
  } catch {
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
      }
    }
    try {
      await unlink2(tmp);
    } catch {
    }
  }
}
async function readState(dir) {
  const file = statePath2(dir);
  let raw;
  try {
    raw = await readFile3(file, "utf8");
  } catch (err) {
    if (isErrnoException2(err) && err.code === "ENOENT") return emptyState();
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await writeBackup2(dir, "corrupt", raw);
    return emptyState();
  }
  return migrateIfNeeded(parsed, dir, raw);
}
async function migrateIfNeeded(parsed, dir, rawBackup) {
  const state = parsed;
  if (typeof state.schemaVersion === "number" && state.schemaVersion >= SCHEMA_VERSION2) {
    return state;
  }
  await writeBackup2(dir, "v0", rawBackup ?? JSON.stringify(parsed));
  return {
    schemaVersion: SCHEMA_VERSION2,
    sessions: state.sessions ?? {}
  };
}
async function writeState(dir, state) {
  await mkdir2(dir, { recursive: true });
  const tmp = tmpPath(dir);
  const dest = statePath2(dir);
  let fh;
  try {
    fh = await open3(tmp, "w");
    await fh.write(JSON.stringify(state, null, 2));
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename2(tmp, dest);
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
      }
    }
    try {
      await unlink2(tmp);
    } catch {
    }
  }
}
function sessionKey(runtime, sessionId) {
  return `${runtime}:${sessionId}`;
}
function isCursorCompatibilityEntry(entry) {
  return entry?.runtime === "cursor" && entry.cursorCompatibility === CURSOR_COMPATIBILITY;
}
function zeroSession(entry) {
  return {
    ...entry,
    lastRecordIndex: 0,
    lastTotalRecords: 0
  };
}
async function loadLegacyState() {
  const dir = stateDir2();
  await mkdir2(dir, { recursive: true });
  const lock = lockPath2(dir);
  const owner = await acquireLock2(lock);
  try {
    return await readState(dir);
  } finally {
    await releaseLock2(lock, owner);
  }
}
function savedPositionResetMessage(code, runtime, sessionId, expectedPath, observedSessionId, observedPath) {
  return `${code}: saved position expected identity ${runtime}:${sessionId} at ${expectedPath}; observed identity ${runtime}:${observedSessionId} at ${observedPath}. Run session-observer state reset --session ${runtime}:${sessionId} and retry.`;
}
async function validateSavedPosition(runtime, sessionId, selectedTranscriptPath, entry) {
  let canonicalSelectedPath;
  try {
    canonicalSelectedPath = await realpath(selectedTranscriptPath);
  } catch {
    const code = "SAVED_POSITION_IDENTITY_INVALID";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        entry?.transcriptPath ?? "(missing)",
        "(unavailable)",
        selectedTranscriptPath
      )
    };
  }
  if (entry === null || entry.lastRecordIndex === 0) {
    return { status: "new", canonicalTranscriptPath: canonicalSelectedPath };
  }
  let records;
  try {
    records = await readRecords(canonicalSelectedPath);
  } catch {
    records = null;
  }
  const meta = records ? extractMetaFromRecords(runtime, records, canonicalSelectedPath) : null;
  const observedSessionId = meta?.sessionId ?? "(invalid)";
  if (!Number.isSafeInteger(entry.lastRecordIndex) || entry.lastRecordIndex < 0 || typeof entry.transcriptPath !== "string" || entry.transcriptPath.length === 0) {
    const code = "SAVED_POSITION_PATH_MISSING";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        entry.transcriptPath ?? "(missing)",
        observedSessionId,
        canonicalSelectedPath
      )
    };
  }
  let canonicalStoredPath;
  try {
    canonicalStoredPath = await realpath(entry.transcriptPath);
  } catch {
    const code = "SAVED_POSITION_PATH_MISSING";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        entry.transcriptPath,
        observedSessionId,
        canonicalSelectedPath
      )
    };
  }
  if (canonicalStoredPath !== canonicalSelectedPath) {
    const code = "SAVED_POSITION_PATH_MISMATCH";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        canonicalStoredPath,
        observedSessionId,
        canonicalSelectedPath
      )
    };
  }
  if (!meta) {
    const code = "SAVED_POSITION_IDENTITY_INVALID";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        canonicalStoredPath,
        observedSessionId,
        canonicalSelectedPath
      )
    };
  }
  if (meta.sessionId !== sessionId) {
    const code = "SAVED_POSITION_IDENTITY_MISMATCH";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        canonicalStoredPath,
        observedSessionId,
        canonicalSelectedPath
      )
    };
  }
  if (entry.lastRecordIndex > records.length) {
    const code = "SAVED_POSITION_TRANSCRIPT_SHRANK";
    return {
      status: "blocked",
      code,
      message: savedPositionResetMessage(
        code,
        runtime,
        sessionId,
        canonicalStoredPath,
        observedSessionId,
        canonicalSelectedPath
      ) + ` Stored next index ${entry.lastRecordIndex} exceeds observed record count ${records.length}.`
    };
  }
  return { status: "valid", canonicalTranscriptPath: canonicalSelectedPath };
}
async function notifyMigrationBoundary(options, boundary) {
  await options.onBoundary?.(boundary);
}
function nextMigrationBackupPath(dir) {
  migrationBackupSequence += 1;
  return join3(
    dir,
    `state.json.cursor-legacy-${Date.now()}-${process.pid}-${migrationBackupSequence}.bak`
  );
}
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function writeMigrationBackup(dir, destination, raw) {
  if (dirname2(destination) !== dir) {
    throw new Error("LEGACY_BACKUP_PATH_INVALID");
  }
  if (await pathExists(destination)) return;
  const temporary = `${destination}.${process.pid}.tmp`;
  let handle;
  try {
    handle = await open3(temporary, "w", 384);
    await handle.writeFile(raw, "utf8");
    await handle.datasync();
    await handle.close();
    handle = void 0;
    await rename2(temporary, destination);
  } finally {
    if (handle) await handle.close();
    try {
      await unlink2(temporary);
    } catch {
    }
  }
}
async function removeLegacyCursorForMigration(marker, options) {
  const dir = stateDir2();
  if (dirname2(marker.backupPath) !== dir) {
    throw new Error("LEGACY_BACKUP_PATH_INVALID");
  }
  await mkdir2(dir, { recursive: true });
  const lock = lockPath2(dir);
  const owner = await acquireLock2(lock);
  try {
    const state = await readState(dir);
    const key = sessionKey("cursor", marker.sessionId);
    const entry = state.sessions[key];
    if (!entry) {
      if (!await pathExists(marker.backupPath)) {
        throw new Error("LEGACY_BACKUP_MISSING");
      }
      return;
    }
    if (entry.runtime !== "cursor" || !Number.isSafeInteger(entry.lastRecordIndex) || entry.lastRecordIndex < 0 || entry.lastRecordIndex !== marker.legacyLastRecordIndex) {
      throw new Error("LEGACY_CURSOR_CHANGED");
    }
    const raw = await readFile3(statePath2(dir), "utf8");
    await writeMigrationBackup(dir, marker.backupPath, raw);
    await notifyMigrationBoundary(options, "backup-written");
    delete state.sessions[key];
    await writeState(dir, state);
    await notifyMigrationBoundary(options, "legacy-removed");
  } finally {
    await releaseLock2(lock, owner);
  }
}
async function migrateLegacyCursorStateUnderTransition(sessionId, options = {}) {
  const key = cursorSessionKey(sessionId);
  let cursorState = await loadCursorState();
  let marker = cursorState.legacyUnverified[key];
  if (!marker) {
    const legacy = await loadLegacyState();
    const entry = legacy.sessions[sessionKey("cursor", sessionId)];
    if (!entry) return null;
    if (isCursorCompatibilityEntry(entry)) return null;
    if (entry.runtime !== "cursor" || !Number.isSafeInteger(entry.lastRecordIndex) || entry.lastRecordIndex < 0) {
      throw new Error("LEGACY_CURSOR_INVALID");
    }
    const proposed = {
      runtime: "cursor",
      sessionId,
      legacyLastRecordIndex: entry.lastRecordIndex,
      ...typeof entry.transcriptPath === "string" ? { transcriptPath: entry.transcriptPath } : {},
      ...entry.recordedCwd === null || typeof entry.recordedCwd === "string" ? { recordedCwd: entry.recordedCwd } : {},
      ...typeof entry.lastReadAt === "string" && Number.isFinite(Date.parse(entry.lastReadAt)) ? { lastReadAt: entry.lastReadAt } : {},
      backupPath: nextMigrationBackupPath(stateDir2()),
      migrationStatus: "marker-written",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    cursorState = await mutateCursorState((state) => {
      state.legacyUnverified[key] ??= proposed;
    });
    marker = cursorState.legacyUnverified[key];
    await notifyMigrationBoundary(options, "marker-written");
  }
  await removeLegacyCursorForMigration(marker, options);
  cursorState = await mutateCursorState((state) => {
    const current = state.legacyUnverified[key];
    if (!current) throw new Error("LEGACY_CURSOR_MARKER_MISSING");
    if (current.migrationStatus === "marker-written") {
      current.migrationStatus = "legacy-removed";
    }
  });
  marker = cursorState.legacyUnverified[key];
  await notifyMigrationBoundary(options, "marker-legacy-removed");
  cursorState = await mutateCursorState((state) => {
    const current = state.legacyUnverified[key];
    if (!current) throw new Error("LEGACY_CURSOR_MARKER_MISSING");
    if (current.migrationStatus !== "complete") {
      current.migrationStatus = "complete";
    }
  });
  marker = cursorState.legacyUnverified[key];
  await notifyMigrationBoundary(options, "complete");
  return marker;
}
async function migrateLegacyCursorState(sessionId, options = {}) {
  return withCursorTransitionLock(
    () => migrateLegacyCursorStateUnderTransition(sessionId, options)
  );
}
function cursorRecoveryEntry(marker) {
  return {
    runtime: "cursor",
    sessionId: marker.sessionId,
    lastRecordIndex: 0,
    lastTotalRecords: marker.legacyLastRecordIndex,
    recoveryRequired: true,
    recoveryCode: "LEGACY_CURSOR_UNVERIFIED",
    legacyLastRecordIndex: marker.legacyLastRecordIndex,
    migrationStatus: marker.migrationStatus,
    backupPath: marker.backupPath,
    ...marker.transcriptPath ? { transcriptPath: marker.transcriptPath } : {},
    ...marker.recordedCwd !== void 0 ? { recordedCwd: marker.recordedCwd } : {},
    ...marker.lastReadAt ? { lastReadAt: marker.lastReadAt } : {}
  };
}
async function load() {
  let legacy = await loadLegacyState();
  const legacyCursorIds = Object.values(legacy.sessions).filter(
    (entry) => entry.runtime === "cursor" && !isCursorCompatibilityEntry(entry)
  ).map((entry) => entry.sessionId);
  for (const sessionId of legacyCursorIds) {
    await migrateLegacyCursorState(sessionId);
  }
  legacy = await loadLegacyState();
  const cursor = await loadCursorState();
  const sessions = { ...legacy.sessions };
  for (const entry of Object.values(cursor.sessions)) {
    sessions[cursorSessionKey(entry.sessionId)] = {
      runtime: "cursor",
      sessionId: entry.sessionId,
      lastRecordIndex: entry.lastRecordIndex,
      lastTotalRecords: entry.lastRecordIndex,
      transcriptPath: entry.transcriptPath,
      recordedCwd: entry.canonicalCwd,
      indexBase: entry.indexBase,
      continuity: entry.continuity,
      lastStatus: entry.lastStatus,
      recoveryRequired: false
    };
  }
  for (const marker of Object.values(cursor.legacyUnverified)) {
    sessions[cursorSessionKey(marker.sessionId)] = cursorRecoveryEntry(marker);
  }
  return { schemaVersion: SCHEMA_VERSION2, sessions };
}
async function mutate(fn, options = {}) {
  const dir = stateDir2();
  await mkdir2(dir, { recursive: true });
  const lock = lockPath2(dir);
  const owner = await acquireLock2(lock, options);
  try {
    const current = await readState(dir);
    const next = fn(current) ?? current;
    await writeState(dir, next);
    return next;
  } finally {
    await releaseLock2(lock, owner);
  }
}
async function getSession(runtime, sessionId) {
  if (runtime === "cursor") {
    const legacy = await loadLegacyState();
    const compatibility = legacy.sessions[sessionKey(runtime, sessionId)];
    const cursor = await loadCursorState();
    if (cursor.sessions[cursorSessionKey(sessionId)]) {
      throw new Error(
        "CURSOR_STATE_V2_REQUIRES_OBSERVATION_PROJECTION: legacy record-index reads are disabled"
      );
    }
    const existingMarker = cursor.legacyUnverified[cursorSessionKey(sessionId)];
    if (existingMarker?.legacyLastRecordIndex !== void 0) {
      if (existingMarker.legacyLastRecordIndex === 0) return null;
      throw new Error(
        `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
      );
    }
    if (isCursorCompatibilityEntry(compatibility)) return compatibility;
    const marker = await migrateLegacyCursorState(sessionId);
    if (marker) {
      if (marker.legacyLastRecordIndex === 0) return null;
      throw new Error(
        `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
      );
    }
    return null;
  }
  const state = await loadLegacyState();
  const key = sessionKey(runtime, sessionId);
  return state.sessions[key] ?? null;
}
async function markRead(runtime, sessionId, {
  lastRecordIndex,
  lastTotalRecords,
  transcriptPath,
  recordedCwd
}, options = {}) {
  if (runtime === "cursor") {
    return withCursorTransitionLock(async () => {
      const key2 = cursorSessionKey(sessionId);
      const cursor = await loadCursorState();
      if (cursor.sessions[key2]) {
        throw new Error(
          "CURSOR_STATE_V2_REQUIRED: legacy record-index Cursor writes are disabled"
        );
      }
      const marker = cursor.legacyUnverified[key2];
      if (marker && marker.legacyLastRecordIndex !== 0) {
        throw new Error(
          `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
        );
      }
      await options.onCompatibilityBoundary?.("prechecked");
      const writeId = `${process.pid}:${Date.now()}:${++migrationBackupSequence}`;
      let preimage;
      await mutate((state) => {
        const existing = state.sessions[key2];
        preimage = existing ? structuredClone(existing) : void 0;
        state.sessions[key2] = {
          ...existing,
          runtime,
          sessionId,
          lastRecordIndex,
          lastTotalRecords,
          lastReadAt: (/* @__PURE__ */ new Date()).toISOString(),
          transcriptPath,
          recordedCwd,
          watchedByPid: existing?.watchedByPid ?? null,
          cursorCompatibility: CURSOR_COMPATIBILITY,
          cursorCompatibilityWriteId: writeId
        };
      });
      await options.onCompatibilityBoundary?.("legacy-written");
      try {
        await mutateCursorState((state) => {
          if (state.sessions[key2]) {
            throw new Error(
              "CURSOR_STATE_V2_REQUIRED: legacy record-index Cursor writes are disabled"
            );
          }
          const current = state.legacyUnverified[key2];
          if (current && current.legacyLastRecordIndex !== 0) {
            throw new Error(
              `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
            );
          }
          delete state.legacyUnverified[key2];
        });
      } catch (error) {
        let restored = false;
        await mutate((state) => {
          const current = state.sessions[key2];
          if (isCursorCompatibilityEntry(current) && current.cursorCompatibilityWriteId === writeId) {
            if (preimage) state.sessions[key2] = preimage;
            else delete state.sessions[key2];
            restored = true;
          }
        });
        if (!restored) {
          throw new Error("CURSOR_COMPATIBILITY_ROLLBACK_CONFLICT", {
            cause: error
          });
        }
        throw error;
      }
      await options.onCompatibilityBoundary?.("cursor-updated");
    }, options);
  }
  const key = sessionKey(runtime, sessionId);
  await mutate((state) => {
    const existing = state.sessions[key] ?? {};
    state.sessions[key] = {
      ...existing,
      runtime,
      sessionId,
      lastRecordIndex,
      lastTotalRecords,
      lastReadAt: (/* @__PURE__ */ new Date()).toISOString(),
      transcriptPath,
      recordedCwd,
      watchedByPid: existing.watchedByPid ?? null
    };
    return state;
  });
}
async function setWatchedByPid(runtime, sessionId, pid) {
  if (runtime === "cursor") {
    const key2 = sessionKey(runtime, sessionId);
    let updated2 = false;
    await mutate((state) => {
      const existing = state.sessions[key2];
      if (!isCursorCompatibilityEntry(existing)) return;
      state.sessions[key2] = { ...existing, watchedByPid: pid };
      updated2 = true;
    });
    return updated2;
  }
  const key = sessionKey(runtime, sessionId);
  let updated = false;
  await mutate((state) => {
    const existing = state.sessions[key];
    if (!existing) return state;
    state.sessions[key] = {
      ...existing,
      watchedByPid: pid
    };
    updated = true;
    return state;
  });
  return updated;
}
async function clearWatchedByPid(runtime, sessionId, pid) {
  if (runtime === "cursor") {
    const key2 = sessionKey(runtime, sessionId);
    let updated2 = false;
    await mutate((state) => {
      const existing = state.sessions[key2];
      if (!isCursorCompatibilityEntry(existing)) return;
      if (pid !== void 0 && existing.watchedByPid !== pid) return;
      state.sessions[key2] = { ...existing, watchedByPid: null };
      updated2 = true;
    });
    return updated2;
  }
  const key = sessionKey(runtime, sessionId);
  let updated = false;
  await mutate((state) => {
    const existing = state.sessions[key];
    if (!existing) return state;
    if (pid !== void 0 && existing.watchedByPid !== pid) return state;
    state.sessions[key] = {
      ...existing,
      watchedByPid: null
    };
    updated = true;
    return state;
  });
  return updated;
}
async function resetByRuntimeWithDiagnostics(runtime) {
  if (runtime === "cursor") {
    return withCursorTransitionLock(async () => {
      const sessionIds = /* @__PURE__ */ new Set();
      let recovery = null;
      try {
        const cursor = await loadCursorState();
        for (const entry of Object.values(cursor.sessions)) {
          sessionIds.add(entry.sessionId);
        }
        for (const marker of Object.values(cursor.legacyUnverified)) {
          sessionIds.add(marker.sessionId);
        }
      } catch (error) {
        if (!(error instanceof CursorStateRecoveryRequiredError)) throw error;
        recovery = {
          performed: true,
          reason: error.reason,
          scope: "cursor-store",
          destructive: true,
          preservesSiblingSessions: false
        };
      }
      await mutate((state) => {
        for (const [key, entry] of Object.entries(state.sessions)) {
          if (entry.runtime === "cursor") {
            delete state.sessions[key];
            sessionIds.add(entry.sessionId);
          }
        }
      });
      await resetAllCursorState();
      return { runtime, count: sessionIds.size, recovery };
    });
  }
  let count = 0;
  await mutate((state) => {
    for (const [key, entry] of Object.entries(state.sessions)) {
      if (entry.runtime === runtime) {
        state.sessions[key] = zeroSession(entry);
        count++;
      }
    }
    return state;
  });
  return { runtime, count, recovery: null };
}
async function resetByRuntime(runtime) {
  return (await resetByRuntimeWithDiagnostics(runtime)).count;
}
async function resetBySession(runtime, sessionId) {
  if (runtime === "cursor") {
    return withCursorTransitionLock(async () => {
      await resetCursorSessionState(sessionId);
      const key2 = sessionKey(runtime, sessionId);
      await mutate((state) => {
        delete state.sessions[key2];
      });
    });
  }
  const key = sessionKey(runtime, sessionId);
  await mutate((state) => {
    if (state.sessions[key]) {
      state.sessions[key] = zeroSession(state.sessions[key]);
    }
    return state;
  });
}
async function clear() {
  await withCursorTransitionLock(async () => {
    await clearCursorState();
    await mutate((state) => {
      state.sessions = {};
      return state;
    });
  });
}
export {
  clear,
  clearWatchedByPid,
  getSession,
  load,
  markRead,
  migrateLegacyCursorState,
  mutate,
  resetByRuntime,
  resetByRuntimeWithDiagnostics,
  resetBySession,
  setWatchedByPid,
  validateSavedPosition
};
