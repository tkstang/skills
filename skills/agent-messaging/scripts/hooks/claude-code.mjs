#!/usr/bin/env node
// GENERATED skill payload for agent-messaging.

// src/skills/agent-messaging/src/hooks/claude-code.ts
import path10 from "node:path";
import { fileURLToPath } from "node:url";

// src/skills/agent-messaging/src/hooks/common.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import path9 from "node:path";

// src/shared/collaboration/activation.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import path4 from "node:path";

// src/shared/collaboration/membership.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { lstat as lstat2, realpath as realpath2 } from "node:fs/promises";
import path3 from "node:path";

// src/shared/collaboration/paths.ts
import { homedir } from "node:os";
import path2 from "node:path";

// src/shared/collaboration/records.ts
import { createHash as createHash2, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  unlink
} from "node:fs/promises";
import path from "node:path";

// src/shared/collaboration/types.ts
import { createHash } from "node:crypto";
var SCHEMA_VERSION = 1;
var MAX_IDENTIFIER_BYTES = 128;
var MAX_BODY_BYTES = 32 * 1024;
var MAX_SUBJECT_BYTES = 256;
function assertUuid(value, label = "UUID") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value
  )) {
    throw new TypeError(`${label} must be a UUID`);
  }
}
function assertAlias(value) {
  if (!/^[a-z][a-z0-9-]{0,31}$/u.test(value)) {
    throw new TypeError("alias must match [a-z][a-z0-9-]{0,31}");
  }
}
function assertBoundedString(value, label, maxBytes = MAX_IDENTIFIER_BYTES, allowEmpty = false) {
  if (typeof value !== "string" || !allowEmpty && value.length === 0 || Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new TypeError(`${label} must be a bounded UTF-8 string`);
  }
}
function assertPin(value) {
  if (!value || typeof value !== "object")
    throw new TypeError("pin must be an object");
  const pin = value;
  if (!["codex", "claude-code", "cursor"].includes(pin.runtime ?? "")) {
    throw new TypeError("pin runtime is unsupported");
  }
  assertBoundedString(pin.sessionId, "pin sessionId");
}
function pinKey(pin) {
  assertPin(pin);
  return createHash("sha256").update(`${pin.runtime}\0${pin.sessionId}`, "utf8").digest("hex");
}
function pinsEqual(left, right) {
  return left.runtime === right.runtime && left.sessionId === right.sessionId;
}

// src/shared/collaboration/records.ts
var CollaborationError = class extends Error {
  code;
  retryable;
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "CollaborationError";
    this.code = code;
    this.retryable = retryable;
  }
};
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)])
    );
  }
  return value;
}
function canonicalJson(value) {
  return `${JSON.stringify(stable(value))}
`;
}
function canonicalHash(value) {
  return createHash2("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
function isMissing(error) {
  return error.code === "ENOENT";
}
function assertSchema(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      "record must be a JSON object"
    );
  }
  const version = record.schemaVersion;
  if (version !== SCHEMA_VERSION) {
    throw new CollaborationError(
      "UNKNOWN_SCHEMA",
      `unsupported schema version: ${String(version)}`
    );
  }
}
function malformed(message) {
  throw new CollaborationError("MALFORMED_RECORD", message);
}
function assertTimestamp(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    malformed(`${label} must be an ISO-8601 timestamp`);
  }
}
function assertGeneration(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    malformed(`${label} must be a non-negative safe integer`);
  }
}
function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    malformed(`${label} must be a SHA-256 hex digest`);
  }
}
function canonicalRecordHash(record) {
  const { contentHash: _contentHash, ...content } = record;
  return canonicalHash(content);
}
function assertRecordHash(record, label) {
  assertHash(record.contentHash, `${label} contentHash`);
  if (record.contentHash !== canonicalRecordHash(record)) {
    malformed(`${label} contentHash does not match content`);
  }
}
function assertUuidValue(value, label) {
  if (typeof value !== "string") malformed(`${label} must be a UUID`);
  assertUuid(value, label);
}
function validateBinding(record) {
  assertUuidValue(record.participantId, "binding participantId");
  assertGeneration(record.generation, "binding generation");
  assertPin(record.pin);
  if (!path.isAbsolute(record.worktree))
    malformed("binding worktree must be absolute");
  if (record.previousPin !== null) assertPin(record.previousPin);
  assertBoundedString(record.reason, "binding reason", 512);
  assertTimestamp(record.createdAt, "binding createdAt");
  if (!Array.isArray(record.inheritedAckRefs))
    malformed("binding inheritedAckRefs must be an array");
  for (const ack of record.inheritedAckRefs) {
    if (!ack || typeof ack !== "object")
      malformed("binding inherited ack must be an object");
    assertUuidValue(ack.messageId, "inherited messageId");
    assertHash(ack.messageHash, "inherited messageHash");
  }
  assertRecordHash(
    record,
    "binding"
  );
}
function messageHash(record) {
  return canonicalHash({
    schemaVersion: 1,
    id: record.id,
    collaborationId: record.collaborationId,
    from: record.from,
    to: record.to,
    kind: record.kind,
    priority: record.priority,
    subject: record.subject,
    body: record.body,
    replyTo: record.replyTo
  });
}
function logHash(record) {
  return canonicalHash({
    collaborationId: record.collaborationId,
    id: record.id,
    category: record.category,
    title: record.title,
    author: record.author,
    whatHappened: record.whatHappened,
    assessment: record.assessment,
    skillImplication: record.skillImplication
  });
}
function validateAuthoritativeRecord(file, value, root) {
  const relativeSegments = root ? path.relative(path.resolve(root), path.resolve(file)).split(path.sep) : [];
  const authoritative = relativeSegments[0] === "collaborations";
  if (authoritative && relativeSegments.length < 3)
    malformed("authoritative record path is incomplete");
  const collaborationPathId = authoritative ? relativeSegments[1] : void 0;
  if (collaborationPathId)
    assertUuidValue(collaborationPathId, "path collaboration id");
  const recordSegments = authoritative ? relativeSegments.slice(2) : [];
  const basename = path.basename(file, ".json");
  const parent = path.basename(path.dirname(file));
  const grandparent = path.basename(path.dirname(path.dirname(file)));
  try {
    if (recordSegments.length === 1 && recordSegments[0] === "collaboration.json") {
      const candidate = value;
      assertUuidValue(candidate.id, "collaboration id");
      if (candidate.id !== parent)
        malformed("collaboration path identity does not match id");
      assertBoundedString(candidate.label, "collaboration label", 128);
      assertBoundedString(candidate.task, "collaboration task", 2048);
      assertTimestamp(candidate.createdAt, "collaboration createdAt");
      assertRecordHash(
        candidate,
        "collaboration"
      );
    } else if (recordSegments.length === 2 && recordSegments[0] === "members" && recordSegments[1]?.endsWith(".json")) {
      const candidate = value;
      assertAlias(candidate.alias);
      if (candidate.alias !== basename)
        malformed("member path identity does not match alias");
      assertUuidValue(candidate.participantId, "member participantId");
      assertUuidValue(candidate.collaborationId, "member collaborationId");
      if (candidate.collaborationId !== collaborationPathId)
        malformed("member collaboration path identity does not match record");
      assertTimestamp(candidate.createdAt, "member createdAt");
      if (!candidate.initialBinding || typeof candidate.initialBinding !== "object")
        malformed("member initialBinding is required");
      validateBinding(candidate.initialBinding);
      if (candidate.initialBinding.participantId !== candidate.participantId || candidate.initialBinding.generation !== 0)
        malformed("member initial binding identity is invalid");
      assertRecordHash(
        candidate,
        "member"
      );
    } else if (recordSegments.length === 3 && recordSegments[0] === "bindings" && recordSegments[2]?.endsWith(".json")) {
      const candidate = value;
      validateBinding(candidate);
      if (candidate.participantId !== parent || String(candidate.generation) !== basename)
        malformed("binding path identity does not match record");
    } else if (recordSegments.length === 3 && recordSegments[0] === "departures" && recordSegments[2]?.endsWith(".json")) {
      const candidate = value;
      assertUuidValue(candidate.participantId, "departure participantId");
      assertGeneration(candidate.generation, "departure generation");
      assertPin(candidate.pin);
      assertTimestamp(candidate.departedAt, "departure departedAt");
      assertRecordHash(
        candidate,
        "departure"
      );
      if (candidate.participantId !== parent || String(candidate.generation) !== basename)
        malformed("departure path identity does not match record");
    } else if (recordSegments.length === 3 && recordSegments[0] === "inbox" && recordSegments[2]?.endsWith(".json")) {
      const candidate = value;
      assertUuidValue(candidate.id, "message id");
      assertUuidValue(candidate.collaborationId, "message collaborationId");
      if (candidate.collaborationId !== collaborationPathId)
        malformed("message collaboration path identity does not match record");
      if (!candidate.from || typeof candidate.from !== "object" || !candidate.to || typeof candidate.to !== "object")
        malformed("message endpoints are required");
      assertUuidValue(
        candidate.from.participantId,
        "message sender participantId"
      );
      assertGeneration(candidate.from.generation, "message sender generation");
      assertPin(candidate.from.pin);
      assertUuidValue(
        candidate.to.participantId,
        "message recipient participantId"
      );
      assertGeneration(candidate.to.generation, "message recipient generation");
      if (!["request", "update"].includes(candidate.kind))
        malformed("message kind is unsupported");
      if (!["normal", "high"].includes(candidate.priority))
        malformed("message priority is unsupported");
      assertBoundedString(
        candidate.subject,
        "message subject",
        MAX_SUBJECT_BYTES
      );
      assertBoundedString(candidate.body, "message body", MAX_BODY_BYTES, true);
      if (candidate.replyTo !== null) {
        if (!candidate.replyTo || typeof candidate.replyTo !== "object")
          malformed("message replyTo is invalid");
        assertUuidValue(candidate.replyTo.participantId, "reply participantId");
        assertUuidValue(candidate.replyTo.messageId, "reply messageId");
      }
      assertTimestamp(candidate.createdAt, "message createdAt");
      assertHash(candidate.contentHash, "message contentHash");
      if (candidate.contentHash !== messageHash(candidate))
        malformed("message contentHash does not match content");
      if (candidate.to.participantId !== parent || candidate.id !== basename)
        malformed("message path identity does not match record");
    } else if (recordSegments.length === 4 && recordSegments[0] === "acks" && recordSegments[3]?.endsWith(".json")) {
      const candidate = value;
      assertUuidValue(candidate.messageId, "ack messageId");
      assertHash(candidate.messageHash, "ack messageHash");
      assertPin(candidate.recipient);
      assertGeneration(candidate.bindingGeneration, "ack bindingGeneration");
      assertTimestamp(candidate.receivedAt, "ack receivedAt");
      assertRecordHash(
        candidate,
        "acknowledgment"
      );
      assertUuidValue(grandparent, "ack participant path");
      if (candidate.messageId !== basename || String(candidate.bindingGeneration) !== parent)
        malformed("ack path identity does not match record");
    } else if (recordSegments.length === 3 && recordSegments[0] === "retries" && recordSegments[2]?.endsWith(".json")) {
      const candidate = value;
      assertUuidValue(candidate.activationId, "retry activationId");
      assertBoundedString(
        candidate.priorAttemptId,
        "retry priorAttemptId",
        128
      );
      assertUuidValue(candidate.participantId, "retry participantId");
      assertUuidValue(candidate.messageId, "retry messageId");
      assertGeneration(candidate.retryGeneration, "retry generation");
      if (candidate.retryGeneration < 1)
        malformed("retry generation must be positive");
      assertTimestamp(candidate.createdAt, "retry createdAt");
      assertRecordHash(
        candidate,
        "retry"
      );
      if (candidate.participantId !== parent)
        malformed("retry participant path identity does not match record");
    } else if (recordSegments.length === 3 && recordSegments[0] === "log" && recordSegments[1] === "entries" && recordSegments[2]?.endsWith(".json")) {
      const candidate = value;
      assertUuidValue(candidate.id, "log entry id");
      assertUuidValue(candidate.collaborationId, "log collaborationId");
      if (candidate.collaborationId !== collaborationPathId)
        malformed("log collaboration path identity does not match record");
      assertBoundedString(candidate.category, "log category", 64);
      assertBoundedString(candidate.title, "log title", 256);
      assertPin(candidate.author);
      assertTimestamp(candidate.authoredAt, "log authoredAt");
      assertBoundedString(
        candidate.whatHappened,
        "log whatHappened",
        16 * 1024
      );
      assertBoundedString(candidate.assessment, "log assessment", 2048);
      assertBoundedString(
        candidate.skillImplication,
        "log skillImplication",
        4096
      );
      assertHash(candidate.contentHash, "log contentHash");
      if (candidate.contentHash !== logHash(candidate))
        malformed("log contentHash does not match content");
      if (candidate.id !== basename)
        malformed("log path identity does not match id");
    } else if (recordSegments.length === 1 && recordSegments[0] === "closed.json") {
      const candidate = value;
      assertUuidValue(candidate.collaborationId, "closed collaborationId");
      assertPin(candidate.closedBy);
      assertTimestamp(candidate.closedAt, "closed closedAt");
      assertRecordHash(
        candidate,
        "closed marker"
      );
      if (candidate.collaborationId !== parent)
        malformed("closed path identity does not match collaboration");
    } else if (authoritative) {
      malformed("authoritative record path layout is invalid");
    }
  } catch (error) {
    if (error instanceof CollaborationError) throw error;
    throw new CollaborationError("MALFORMED_RECORD", error.message);
  }
}
async function validateRootScopedPath(root, target, options) {
  if (!path.isAbsolute(root) || !path.isAbsolute(target)) {
    throw new CollaborationError(
      "INVALID_ROOT",
      "storage paths must be absolute"
    );
  }
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(target);
  const relative = path.relative(absoluteRoot, absoluteTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "storage path escapes the collaboration root"
    );
  }
  const expectedUid = process.getuid?.();
  const rootInfo = await lstat(absoluteRoot).catch((error) => {
    if (isMissing(error) && options.allowMissingTail) return null;
    throw error;
  });
  if (!rootInfo) return;
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || expectedUid !== void 0 && rootInfo.uid !== expectedUid) {
    throw new CollaborationError("UNSAFE_PATH", "storage root is unsafe");
  }
  const canonicalRoot = await realpath(absoluteRoot);
  const segments = relative.split(path.sep).filter(Boolean);
  let current = absoluteRoot;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const info = await lstat(current).catch((error) => {
      if (isMissing(error) && options.allowMissingTail) return null;
      throw error;
    });
    if (!info) return;
    const leaf = index === segments.length - 1;
    const expectedType = leaf ? options.leaf : "directory";
    if (info.isSymbolicLink() || (expectedType === "directory" ? !info.isDirectory() : !info.isFile()) || expectedUid !== void 0 && info.uid !== expectedUid) {
      throw new CollaborationError(
        "UNSAFE_PATH",
        `storage path component ${segment} is unsafe`
      );
    }
    const canonicalCurrent = await realpath(current);
    const canonicalRelative = path.relative(canonicalRoot, canonicalCurrent);
    if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
      throw new CollaborationError(
        "UNSAFE_PATH",
        "storage path escapes the canonical collaboration root"
      );
    }
  }
}
async function readJsonRecord(file, options = {}) {
  if (options.root) {
    await validateRootScopedPath(options.root, file, { leaf: "file" });
  }
  const info = await lstat(file).catch((error) => {
    if (isMissing(error)) throw error;
    throw new CollaborationError(
      "UNSAFE_PATH",
      `cannot inspect record: ${error.message}`
    );
  });
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "record must be a regular file"
    );
  }
  const expectedUid = options.expectedUid ?? process.getuid?.();
  if (expectedUid !== void 0 && info.uid !== expectedUid) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "record owner does not match the current user"
    );
  }
  const maxBytes = options.maxBytes ?? 128 * 1024;
  if (info.size > maxBytes) {
    throw new CollaborationError(
      "RECORD_TOO_LARGE",
      `record exceeds ${maxBytes} bytes`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      `invalid JSON record: ${error.message}`
    );
  }
  assertSchema(parsed);
  validateAuthoritativeRecord(file, parsed, options.root);
  return parsed;
}
async function ensurePrivateDirectory(directory, root) {
  await validateRootScopedPath(root, directory, {
    leaf: "directory",
    allowMissingTail: true
  });
  await mkdir(root, { recursive: true, mode: 448 });
  await validateRootScopedPath(root, root, { leaf: "directory" });
  await chmod(root, 448);
  await validateRootScopedPath(root, directory, {
    leaf: "directory",
    allowMissingTail: true
  });
  await mkdir(directory, { recursive: true, mode: 448 });
  await validateRootScopedPath(root, directory, { leaf: "directory" });
  await chmod(directory, 448);
  await validateRootScopedPath(root, directory, { leaf: "directory" });
}
async function publishImmutableRecord(target, record, options) {
  assertSchema(record);
  const directory = path.dirname(target);
  await ensurePrivateDirectory(directory, options.root);
  const bytes = canonicalJson(record);
  const hash = canonicalHash(record);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.tmp-${process.pid}-${randomUUID()}`
  );
  let handle;
  let published = false;
  try {
    handle = await open(temporary, "wx", 384);
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
    await options.hooks?.afterFileSync?.();
    await handle.close();
    handle = void 0;
    await validateRootScopedPath(options.root, directory, {
      leaf: "directory"
    });
    await import("node:fs/promises").then(
      ({ link }) => link(temporary, target)
    );
    published = true;
    await options.hooks?.afterLink?.();
    await options.hooks?.beforeDirectorySync?.();
    const directoryHandle = await open(directory, "r");
    try {
      await directoryHandle.sync();
    } catch (error) {
      throw new CollaborationError(
        "COMMIT_UNCERTAIN",
        `record was published but directory sync failed: ${error.message}`,
        true
      );
    } finally {
      await directoryHandle.close();
    }
    return { created: true, path: target, hash, record };
  } catch (error) {
    const code = error.code;
    if (code === "EEXIST") {
      const existing = await readJsonRecord(target, { root: options.root });
      if (canonicalHash(existing) !== hash) {
        throw new CollaborationError(
          "RECORD_CONFLICT",
          "record ID already has different content"
        );
      }
      return { created: false, path: target, hash, record: existing };
    }
    if (error instanceof CollaborationError) throw error;
    if (code === "EXDEV" || code === "EPERM" || code === "EOPNOTSUPP" || code === "ENOTSUP") {
      throw new CollaborationError(
        "STORAGE_UNSUPPORTED",
        `hard-link publication is unsupported: ${code}`
      );
    }
    if (published) {
      throw new CollaborationError(
        "COMMIT_UNCERTAIN",
        `record publication outcome is uncertain: ${error.message}`,
        true
      );
    }
    throw error;
  } finally {
    await handle?.close().catch(() => void 0);
    await unlink(temporary).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }
}
async function enumerateJsonRecords(directory, options) {
  if (options.root) {
    await validateRootScopedPath(options.root, directory, {
      leaf: "directory",
      allowMissingTail: true
    });
  }
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (isMissing(error)) return [];
      throw error;
    }
  );
  const records = entries.filter(
    (entry) => !entry.name.startsWith(".") && entry.name.endsWith(".json")
  ).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new CollaborationError(
        "UNSAFE_PATH",
        `record entry ${entry.name} is not a regular file`
      );
    }
    return path.join(directory, entry.name);
  }).toSorted();
  if (records.length > options.maxEntries) {
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      `record directory exceeds ${options.maxEntries} entries`
    );
  }
  return records;
}

// src/shared/collaboration/paths.ts
function requireAbsolute(value, name) {
  if (!path2.isAbsolute(value)) {
    throw new CollaborationError("INVALID_ROOT", `${name} must be absolute`);
  }
  return path2.resolve(value);
}
function resolveCollaborationRoot(env = process.env) {
  if (env.SESSION_OBSERVER_STATE_DIR) {
    return requireAbsolute(
      env.SESSION_OBSERVER_STATE_DIR,
      "SESSION_OBSERVER_STATE_DIR"
    );
  }
  if (env.XDG_STATE_HOME) {
    return path2.join(
      requireAbsolute(env.XDG_STATE_HOME, "XDG_STATE_HOME"),
      "session-observer",
      "collab"
    );
  }
  const home = env.HOME || homedir();
  return path2.join(
    requireAbsolute(home, "HOME"),
    ".local",
    "state",
    "session-observer",
    "collab"
  );
}
function collaborationPaths(root, collaborationId) {
  if (!path2.isAbsolute(root))
    throw new CollaborationError("INVALID_ROOT", "root must be absolute");
  try {
    assertUuid(collaborationId, "collaboration ID");
  } catch (error) {
    throw new CollaborationError("INVALID_ID", error.message);
  }
  const directory = path2.join(root, "collaborations", collaborationId);
  return {
    root,
    directory,
    collaboration: path2.join(directory, "collaboration.json"),
    members: path2.join(directory, "members"),
    bindings: path2.join(directory, "bindings"),
    departures: path2.join(directory, "departures"),
    inbox: path2.join(directory, "inbox"),
    acknowledgments: path2.join(directory, "acks"),
    logEntries: path2.join(directory, "log", "entries"),
    renderedLog: path2.join(directory, "collaboration.md"),
    closed: path2.join(directory, "closed.json")
  };
}
function activationDirectory(root, pin) {
  return path2.join(root, "activations", pinKey(pin));
}
function memberBindingDirectory(paths, participantId) {
  assertUuid(participantId, "participant ID");
  return path2.join(paths.bindings, participantId);
}

// src/shared/collaboration/membership.ts
var MembershipError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "MembershipError";
    this.code = code;
  }
};
async function isCollaborationClosed(root, collaborationId) {
  const file = collaborationPaths(root, collaborationId).closed;
  return readJsonRecord(file, { root }).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  );
}
async function resolveMember(root, collaborationId, alias) {
  assertAlias(alias);
  const paths = collaborationPaths(root, collaborationId);
  let member;
  try {
    member = await readJsonRecord(
      path3.join(paths.members, `${alias}.json`),
      { root }
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new MembershipError(
        "MEMBER_NOT_FOUND",
        `member ${alias} does not exist`
      );
    }
    throw error;
  }
  const bindingFiles = await enumerateJsonRecords(
    memberBindingDirectory(paths, member.participantId),
    { root, maxEntries: 64 }
  );
  if (bindingFiles.length === 0) {
    await publishImmutableRecord(
      path3.join(memberBindingDirectory(paths, member.participantId), "0.json"),
      member.initialBinding,
      { root }
    );
    bindingFiles.push(
      path3.join(memberBindingDirectory(paths, member.participantId), "0.json")
    );
  }
  const bindings = await Promise.all(
    bindingFiles.map((file) => readJsonRecord(file, { root }))
  );
  const binding = bindings.toSorted(
    (left, right) => right.generation - left.generation
  )[0];
  if (!binding)
    throw new MembershipError("MEMBER_NOT_FOUND", "member has no binding");
  const departureFile = path3.join(
    paths.departures,
    member.participantId,
    `${binding.generation}.json`
  );
  const departed = await readJsonRecord(departureFile, {
    root
  }).then(
    (departure) => {
      if (!pinsEqual(departure.pin, binding.pin)) {
        throw new CollaborationError(
          "MALFORMED_RECORD",
          "departure pin does not match its binding"
        );
      }
      return true;
    },
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  );
  return { member, binding, departed };
}
async function resolveMemberByPin(root, collaborationId, pin) {
  assertPin(pin);
  const paths = collaborationPaths(root, collaborationId);
  const files = await enumerateJsonRecords(paths.members, {
    root,
    maxEntries: 128
  });
  for (const file of files) {
    const member = await readJsonRecord(file, { root });
    const resolved = await resolveMember(root, collaborationId, member.alias);
    if (pinsEqual(resolved.binding.pin, pin)) return resolved;
  }
  throw new MembershipError(
    "NOT_CURRENT_MEMBER",
    "pin is not a current collaboration member"
  );
}

// src/shared/collaboration/activation.ts
var DEFAULT_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1e3;
var MAX_ACTIVATION_DURATION_MS = 24 * 60 * 60 * 1e3;
var MAX_CONTINUATIONS = 100;
var MAX_WAIT_MS = 6e4;
var MAX_ACTIVITY_RECEIPTS = 4096;
var MAX_ACTIVATION_EPOCHS = 64;
var DeliveryError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "DeliveryError";
    this.code = code;
  }
};
function timestamp(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      `${label} must be an ISO-8601 timestamp`
    );
  }
  return parsed;
}
function assertIntegerRange(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `${label} must be an integer from ${minimum} to ${maximum}`
    );
  }
}
function validateActivation(record) {
  try {
    assertUuid(record.id, "activation ID");
    assertUuid(record.collaborationId, "activation collaboration ID");
    assertUuid(record.participantId, "activation participant ID");
    assertPin(record.pin);
    if (!path4.isAbsolute(record.worktree))
      throw new TypeError("activation worktree must be absolute");
    assertIntegerRange(
      record.epoch,
      "activation epoch",
      0,
      MAX_ACTIVATION_EPOCHS - 1
    );
    if (record.previousEpoch !== null && record.previousEpoch !== record.epoch - 1) {
      throw new TypeError(
        "activation previousEpoch must identify the contiguous predecessor"
      );
    }
    assertIntegerRange(
      record.bindingGeneration,
      "binding generation",
      0,
      Number.MAX_SAFE_INTEGER
    );
    if (!["stop", "monitor"].includes(record.mechanism))
      throw new TypeError("activation mechanism is unsupported");
    if (!["standalone-messaging", "observer-collab"].includes(record.controller)) {
      throw new TypeError("activation controller is unsupported");
    }
    if (!["human-idle", "fixed"].includes(record.expiryMode))
      throw new TypeError("activation expiry mode is unsupported");
    timestamp(record.startedAt, "activation startedAt");
    timestamp(record.hardExpiresAt, "activation hardExpiresAt");
    if (record.expiryMode === "human-idle") {
      assertIntegerRange(
        record.idleTimeoutMs ?? 0,
        "idle timeout",
        1,
        MAX_ACTIVATION_DURATION_MS
      );
      if (record.fixedExpiresAt !== null)
        throw new TypeError("human-idle activation cannot have fixedExpiresAt");
    } else {
      if (record.idleTimeoutMs !== null)
        throw new TypeError("fixed activation cannot have idleTimeoutMs");
      if (record.fixedExpiresAt === null)
        throw new TypeError("fixed activation requires fixedExpiresAt");
      timestamp(record.fixedExpiresAt, "activation fixedExpiresAt");
    }
    assertIntegerRange(
      record.maxContinuations,
      "max continuations",
      1,
      MAX_CONTINUATIONS
    );
    assertIntegerRange(record.waitMs, "wait milliseconds", 0, MAX_WAIT_MS);
    if (record.contentHash !== canonicalRecordHash(
      record
    ))
      throw new TypeError("activation contentHash does not match content");
    return record;
  } catch (error) {
    if (error instanceof CollaborationError) throw error;
    throw new CollaborationError("MALFORMED_RECORD", error.message);
  }
}
async function activationRecords(root, pin) {
  const directory = path4.join(activationDirectory(root, pin), "epochs");
  const files = await enumerateJsonRecords(directory, {
    root,
    maxEntries: MAX_ACTIVATION_EPOCHS
  });
  for (const file of files) {
    if (!/^(0|[1-9][0-9]*)\.json$/u.test(path4.basename(file))) {
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "activation epoch filename is invalid"
      );
    }
  }
  const records = await Promise.all(
    files.map(
      async (file) => validateActivation(
        await readJsonRecord(file, { root })
      )
    )
  );
  records.sort((left, right) => left.epoch - right.epoch);
  for (const [index, record] of records.entries()) {
    if (record.epoch !== index || record.previousEpoch !== (index === 0 ? null : index - 1)) {
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "activation epochs are not contiguous"
      );
    }
    if (!pinsEqual(record.pin, pin))
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "activation pin does not match its namespace"
      );
  }
  return records;
}
async function isRevoked(root, pin, activationId) {
  return readJsonRecord(
    path4.join(
      activationDirectory(root, pin),
      "revoked",
      `${activationId}.json`
    ),
    { root }
  ).then(
    (record) => {
      if (record.activationId !== activationId || record.contentHash !== canonicalRecordHash(
        record
      )) {
        throw new CollaborationError(
          "MALFORMED_RECORD",
          "activation revocation is invalid"
        );
      }
      return true;
    },
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  );
}
async function activityReceipts(root, activation) {
  const directory = path4.join(
    activationDirectory(root, activation.pin),
    "activity",
    activation.id
  );
  const files = await enumerateJsonRecords(directory, {
    root,
    maxEntries: MAX_ACTIVITY_RECEIPTS
  });
  const receipts = await Promise.all(
    files.map(async (file) => {
      const record = await readJsonRecord(file, {
        root,
        maxBytes: 8192
      });
      if (record.activationId !== activation.id || record.contentHash !== canonicalRecordHash(
        record
      )) {
        throw new CollaborationError(
          "MALFORMED_RECORD",
          "activity receipt is invalid"
        );
      }
      assertBoundedString(record.eventKey, "activity event key", 256);
      timestamp(record.observedAt, "activity observedAt");
      return record;
    })
  );
  return receipts.toSorted(
    (left, right) => left.observedAt.localeCompare(right.observedAt) || left.eventKey.localeCompare(right.eventKey)
  );
}
async function effectiveActivationExpiry(root, activation) {
  validateActivation(activation);
  const started = timestamp(activation.startedAt, "activation startedAt");
  const hard = timestamp(activation.hardExpiresAt, "activation hardExpiresAt");
  if (activation.expiryMode === "fixed") {
    return new Date(
      Math.min(
        hard,
        timestamp(activation.fixedExpiresAt, "activation fixedExpiresAt")
      )
    ).toISOString();
  }
  let liveThrough = Math.min(hard, started + activation.idleTimeoutMs);
  for (const receipt of await activityReceipts(root, activation)) {
    const observed = timestamp(receipt.observedAt, "activity observedAt");
    if (observed < started || observed > liveThrough) {
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "activity receipt crosses an expired activation gap"
      );
    }
    liveThrough = Math.min(hard, observed + activation.idleTimeoutMs);
  }
  return new Date(liveThrough).toISOString();
}
async function activationStatus(root, pin, now = /* @__PURE__ */ new Date()) {
  assertPin(pin);
  const records = await activationRecords(root, pin);
  const activation = records.at(-1) ?? null;
  if (!activation)
    return {
      activation: null,
      active: false,
      terminationReason: null,
      effectiveExpiresAt: null,
      notice: null
    };
  if (await isRevoked(root, pin, activation.id))
    return {
      activation,
      active: false,
      terminationReason: "revoked",
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice: "Delivery is disabled. Re-enable explicitly to resume automatic checks."
    };
  if (await isCollaborationClosed(root, activation.collaborationId))
    return {
      activation,
      active: false,
      terminationReason: "closed",
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice: "The collaboration is closed; delivery remains manual/history-only."
    };
  const member = await resolveMemberByPin(
    root,
    activation.collaborationId,
    pin
  ).catch((error) => {
    if (error.code === "NOT_CURRENT_MEMBER") return null;
    throw error;
  });
  if (!member || member.binding.generation !== activation.bindingGeneration || member.member.participantId !== activation.participantId) {
    return {
      activation,
      active: false,
      terminationReason: "superseded",
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice: "Delivery ownership was superseded; the current session must enable a new epoch."
    };
  }
  if (member.departed)
    return {
      activation,
      active: false,
      terminationReason: "departed",
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice: "The participant departed; automatic delivery is inactive."
    };
  const effectiveExpiresAt = await effectiveActivationExpiry(root, activation);
  if (now.getTime() > Date.parse(effectiveExpiresAt))
    return {
      activation,
      active: false,
      terminationReason: "expired",
      effectiveExpiresAt,
      notice: "Delivery expired with mail still queued. Re-enable explicitly after inspecting the inbox."
    };
  return {
    activation,
    active: true,
    terminationReason: null,
    effectiveExpiresAt,
    notice: null
  };
}
async function recordHumanActivity(input) {
  const status = await activationStatus(
    input.root,
    input.pin,
    input.now ?? /* @__PURE__ */ new Date()
  );
  if (!status.activation || !status.active)
    throw new DeliveryError(
      "DELIVERY_INACTIVE",
      status.notice ?? "delivery activation is inactive"
    );
  if (status.activation.expiryMode !== "human-idle")
    throw new DeliveryError(
      "DELIVERY_CONFLICT",
      "fixed-expiry activation cannot be renewed"
    );
  assertBoundedString(input.eventKey, "human event key", 256);
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: status.activation.id,
    eventKey: input.eventKey,
    observedAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
  };
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base
    )
  };
  const safeKey2 = await import("node:crypto").then(
    ({ createHash: createHash5 }) => createHash5("sha256").update(`human\0${input.eventKey}`).digest("hex")
  );
  await publishImmutableRecord(
    path4.join(
      activationDirectory(input.root, input.pin),
      "activity",
      status.activation.id,
      `${safeKey2}.json`
    ),
    record,
    { root: input.root }
  );
  return record;
}

// src/shared/collaboration/claims.ts
import { createHash as createHash3, randomUUID as randomUUID4 } from "node:crypto";
import path5 from "node:path";
function safeKey(domain, value) {
  return createHash3("sha256").update(`${domain}\0${value}`, "utf8").digest("hex");
}
function deliveryKey(input) {
  assertUuid(input.messageId, "delivery message ID");
  if (!Number.isSafeInteger(input.retryGeneration) || input.retryGeneration < 0)
    throw new TypeError("retry generation must be a non-negative integer");
  return `${input.messageId}:${input.retryGeneration}`;
}
function baseClaim(input, activationId, token, attemptedAt) {
  assertBoundedString(input.eventKey, "event key", 256);
  const proposedDeliveryKeys = input.deliveryKeys.map(deliveryKey).toSorted();
  if (new Set(proposedDeliveryKeys).size !== proposedDeliveryKeys.length)
    throw new TypeError("delivery keys must be unique");
  return {
    schemaVersion: SCHEMA_VERSION,
    activationId,
    token,
    eventKey: input.eventKey,
    proposedDeliveryKeys,
    attemptedAt
  };
}
async function publish(target, base, root, hooks) {
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base
    )
  };
  return publishImmutableRecord(target, record, { root, hooks });
}
async function claimDelivery(input) {
  const before = await activationStatus(
    input.root,
    input.pin,
    input.now ?? /* @__PURE__ */ new Date()
  );
  if (!before.activation || !before.active)
    throw new DeliveryError(
      "DELIVERY_INACTIVE",
      before.notice ?? "delivery activation is inactive"
    );
  const activation = before.activation;
  const token = input.token ?? randomUUID4();
  const attemptedAt = (input.now ?? /* @__PURE__ */ new Date()).toISOString();
  const base = baseClaim(input, activation.id, token, attemptedAt);
  const claimRoot = path5.join(
    activationDirectory(input.root, input.pin),
    "claims",
    activation.id
  );
  const eventPath = path5.join(
    claimRoot,
    "events",
    `${safeKey("event", input.eventKey)}.json`
  );
  const existingEvent = await readJsonRecord(eventPath, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existingEvent)
    return {
      event: existingEvent,
      slot: null,
      owned: [],
      duplicateEvent: true,
      activeAfterClaim: false
    };
  const eventResult = await publish(
    eventPath,
    base,
    input.root
  ).catch(async (error) => {
    if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT") {
      const winner = await readJsonRecord(eventPath, {
        root: input.root
      });
      return {
        created: false,
        path: eventPath,
        hash: winner.contentHash,
        record: winner
      };
    }
    throw error;
  });
  if (!eventResult.created)
    return {
      event: eventResult.record,
      slot: null,
      owned: [],
      duplicateEvent: true,
      activeAfterClaim: false
    };
  await input.hooks?.afterEventClaim?.();
  let slot = null;
  for (let number = 1; number <= activation.maxContinuations; number += 1) {
    const slotBase = { ...base, slot: number };
    const result = await publish(
      path5.join(claimRoot, "slots", `${number}.json`),
      slotBase,
      input.root
    ).catch((error) => {
      if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT")
        return null;
      throw error;
    });
    if (result?.created) {
      slot = result.record;
      break;
    }
  }
  if (!slot)
    return {
      event: eventResult.record,
      slot: null,
      owned: [],
      duplicateEvent: false,
      activeAfterClaim: false
    };
  await input.hooks?.afterSlotClaim?.();
  const owned = [];
  for (const item of input.deliveryKeys) {
    const key = deliveryKey(item);
    const messageBase = {
      ...base,
      deliveryKey: key,
      messageId: item.messageId,
      retryGeneration: item.retryGeneration
    };
    const result = await publish(
      path5.join(claimRoot, "messages", `${safeKey("message", key)}.json`),
      messageBase,
      input.root
    ).catch((error) => {
      if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT")
        return null;
      throw error;
    });
    if (result?.created) owned.push(result.record);
    await input.hooks?.afterMessageClaim?.();
  }
  await input.hooks?.beforeFinalValidation?.();
  const after = await activationStatus(
    input.root,
    input.pin,
    input.now ?? /* @__PURE__ */ new Date()
  );
  return {
    event: eventResult.record,
    slot,
    owned,
    duplicateEvent: false,
    activeAfterClaim: after.active && after.activation?.id === activation.id
  };
}

// src/shared/collaboration/diagnostics.ts
import path6 from "node:path";
var MAX_DIAGNOSTICS = 4096;
var MAX_DIAGNOSTIC_BYTES = 8192;
function validate(input) {
  assertBoundedString(input.attemptId, "diagnostic attempt ID", 128);
  assertUuid(input.activationId, "diagnostic activation ID");
  assertBoundedString(input.eventKey, "diagnostic event key", 256);
  if (!["prompt-start", "stop", "watch", "manual"].includes(input.boundary))
    throw new TypeError("diagnostic boundary is unsupported");
  if (![
    "event-claimed",
    "slot-claimed",
    "messages-claimed",
    "final-validation",
    "output-attempted"
  ].includes(input.stage))
    throw new TypeError("diagnostic stage is unsupported");
  assertBoundedString(input.outcomeCode, "diagnostic outcome code", 64);
  if (input.errorCode !== null)
    assertBoundedString(input.errorCode, "diagnostic error code", 64);
  if (Number.isNaN(Date.parse(input.recordedAt)))
    throw new TypeError("diagnostic recordedAt must be a timestamp");
  for (const value of Object.values(input)) {
    if (typeof value === "string" && /(password|token=|secret|credential)/iu.test(value)) {
      throw new TypeError("diagnostic contains disallowed sensitive text");
    }
  }
}
async function publishDeliveryDiagnostic(input) {
  validate(input.diagnostic);
  const base = {
    schemaVersion: SCHEMA_VERSION,
    ...input.diagnostic
  };
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base
    )
  };
  if (Buffer.byteLength(canonicalJson(record), "utf8") > MAX_DIAGNOSTIC_BYTES)
    throw new CollaborationError(
      "RECORD_TOO_LARGE",
      "delivery diagnostic exceeds 8 KiB"
    );
  const directory = path6.join(
    activationDirectory(input.root, input.pin),
    "diagnostics"
  );
  const existing = await enumerateJsonRecords(directory, {
    root: input.root,
    maxEntries: MAX_DIAGNOSTICS
  });
  if (existing.length >= MAX_DIAGNOSTICS && !existing.some(
    (file) => path6.basename(file) === `${input.diagnostic.attemptId}.json`
  ))
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      "diagnostic capacity is exhausted"
    );
  return (await publishImmutableRecord(
    path6.join(directory, `${input.diagnostic.attemptId}.json`),
    record,
    { root: input.root }
  )).record;
}

// src/shared/collaboration/messages.ts
import path7 from "node:path";
async function currentRecipient(input) {
  const recipient = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin
  );
  if (recipient.departed)
    throw new MembershipError(
      "MEMBER_DEPARTED",
      "departed member inbox is inert"
    );
  return recipient;
}
async function acknowledged(input, recipient, message) {
  const inherited = recipient.binding.inheritedAckRefs.find(
    (ack2) => ack2.messageId === message.id
  );
  if (inherited) {
    if (inherited.messageHash !== message.contentHash) {
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "inherited acknowledgment hash does not match its message"
      );
    }
    return true;
  }
  const ackPath = path7.join(
    collaborationPaths(input.root, input.collaborationId).acknowledgments,
    recipient.member.participantId,
    String(recipient.binding.generation),
    `${message.id}.json`
  );
  const ack = await readJsonRecord(ackPath, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!ack) return false;
  if (!pinsEqual(ack.recipient, recipient.binding.pin)) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      "acknowledgment recipient does not match the current binding"
    );
  }
  if (ack.messageHash !== message.contentHash) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      "acknowledgment hash does not match its message"
    );
  }
  return true;
}
async function presentMessage(input, recipient, message) {
  const closed = await isCollaborationClosed(input.root, input.collaborationId);
  const raceStatus = closed ? "closed" : message.to.generation === recipient.binding.generation ? "current" : "recipient-reassigned";
  return {
    ...message,
    raceStatus,
    inert: raceStatus === "closed"
  };
}
async function listInbox(input) {
  const recipient = await currentRecipient(input);
  const directory = path7.join(
    collaborationPaths(input.root, input.collaborationId).inbox,
    recipient.member.participantId
  );
  const files = await enumerateJsonRecords(directory, {
    root: input.root,
    maxEntries: 4096
  });
  const records = await Promise.all(
    files.map(
      (file) => readJsonRecord(file, {
        root: input.root,
        maxBytes: MAX_BODY_BYTES + 4096
      })
    )
  );
  const sorted = records.toSorted((left, right) => {
    const priority = Number(right.priority === "high") - Number(left.priority === "high");
    return priority || left.createdAt.localeCompare(right.createdAt) || left.from.pin.runtime.localeCompare(right.from.pin.runtime) || left.from.pin.sessionId.localeCompare(right.from.pin.sessionId) || left.id.localeCompare(right.id);
  });
  const pending = [];
  const acked = [];
  for (const message of sorted) {
    const presented = await presentMessage(input, recipient, message);
    if (await acknowledged(input, recipient, message)) acked.push(presented);
    else pending.push(presented);
  }
  const maxMessages = input.maxMessages ?? 8;
  const maxBytes = input.maxBytes ?? 48 * 1024;
  const selectedPending = [];
  const selectedAcknowledged = [];
  let bytes = 0;
  const candidates = [
    ...pending.map((message) => ({ message, acknowledged: false })),
    ...input.includeAcknowledged ? acked.map((message) => ({ message, acknowledged: true })) : []
  ];
  for (const candidate of candidates) {
    const message = candidate.message;
    const size = Buffer.byteLength(message.body, "utf8");
    if (selectedPending.length + selectedAcknowledged.length >= maxMessages || bytes + size > maxBytes)
      break;
    if (candidate.acknowledged) selectedAcknowledged.push(message);
    else selectedPending.push(message);
    bytes += size;
  }
  return {
    messages: selectedPending,
    acknowledged: selectedAcknowledged,
    truncated: selectedPending.length !== pending.length || input.includeAcknowledged === true && selectedAcknowledged.length !== acked.length,
    pendingTotal: pending.length,
    acknowledgedTotal: acked.length
  };
}

// src/skills/agent-messaging/src/registration.ts
import { createHash as createHash4 } from "node:crypto";
import { lstat as lstat3, mkdir as mkdir2, readFile as readFile2, rename, writeFile } from "node:fs/promises";
import path8 from "node:path";
var OBSERVER_LEASE_SCHEMA_VERSION = 6;
var OBSERVER_LAUNCHER_OWNER = "session-observer-collab-codex-stop";
var OBSERVER_BUNDLE_MANIFEST = ".session-observer-collab-bundle.json";
var OBSERVER_BUNDLE_FILES = [
  "session-observer-collab/scripts/hooks/codex-stop.mjs"
];
var MESSAGING_HOOK_OWNER = "agent-messaging-host-hook-v1";
function fingerprint(registrations) {
  return createHash4("sha256").update(
    canonicalJson(
      registrations.map(({ source, command }) => ({ source, command })).toSorted(
        (left, right) => left.source.localeCompare(right.source) || left.command.localeCompare(right.command)
      )
    )
  ).digest("hex");
}
function stopCommands(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const hooks = value.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return [];
  const groups = hooks.Stop;
  if (!Array.isArray(groups)) return [];
  const commands = [];
  for (const group of groups) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    const entries = group.hooks;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.command === "string") {
        commands.push(entry.command);
      }
    }
  }
  return commands;
}
function commandScript(command) {
  const match = /^node\s+--\s+(?:'((?:[^']|'"'"')*)'|"([^"]+)"|(\S+))$/u.exec(
    command.trim()
  );
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw ? raw.replaceAll(`'"'"'`, `'`) : null;
}
async function recognizedObserverLauncher(command) {
  const script = commandScript(command);
  if (!script || !path8.isAbsolute(script)) return false;
  const launcher = await readFile2(script, "utf8").catch(() => null);
  const marker = launcher?.match(
    new RegExp(`^// ${OBSERVER_LAUNCHER_OWNER}:([a-f0-9]{24})$`, "mu")
  );
  if (!launcher || !marker) return false;
  const supportRoot = path8.join(
    path8.dirname(script),
    `.${path8.basename(script)}.support`,
    marker[1]
  );
  const manifest = await readFile2(
    path8.join(supportRoot, OBSERVER_BUNDLE_MANIFEST),
    "utf8"
  ).then((bytes) => JSON.parse(bytes)).catch(() => null);
  if (!manifest || manifest.owner !== OBSERVER_LAUNCHER_OWNER || manifest.version !== marker[1] || JSON.stringify(manifest.files) !== JSON.stringify(OBSERVER_BUNDLE_FILES)) {
    return false;
  }
  return Promise.all(
    OBSERVER_BUNDLE_FILES.map((file) => lstat3(path8.join(supportRoot, file)))
  ).then(
    (entries) => entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()),
    () => false
  );
}
async function recognizedMessagingLauncher(command) {
  const script = commandScript(command);
  if (!script || !path8.isAbsolute(script)) return false;
  const info = await lstat3(script).catch(() => null);
  if (!info || !info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) {
    return false;
  }
  const launcher = await readFile2(script, "utf8").catch(() => null);
  if (!launcher || !launcher.includes(`"${MESSAGING_HOOK_OWNER}"`))
    return false;
  const header = launcher.slice(0, 512);
  return header.includes("// GENERATED skill payload for agent-messaging.") && (header.includes("// src/skills/agent-messaging/src/hooks/codex.ts") || header.includes("// src/skills/agent-messaging/src/hooks/claude-code.ts"));
}
async function readConfig(file) {
  return readFile2(file, "utf8").then(
    (value) => JSON.parse(value),
    (error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  );
}
async function inspectCodexStopInventory(hooksPath) {
  if (!path8.isAbsolute(hooksPath))
    throw new TypeError("Codex hooks path must be absolute");
  const unreadableSources = [];
  let config = null;
  try {
    config = await readConfig(hooksPath);
  } catch {
    unreadableSources.push(hooksPath);
  }
  const registrations = [];
  for (const command of stopCommands(config)) {
    registrations.push({
      source: hooksPath,
      command,
      recognizedObserver: await recognizedObserverLauncher(command),
      recognizedMessaging: await recognizedMessagingLauncher(command)
    });
  }
  return {
    runtime: "codex",
    registrations,
    fingerprint: fingerprint(registrations),
    unreadableSources,
    unresolvedPlugins: [],
    visibilityLimits: []
  };
}
async function inspectClaudeStopInventory(input) {
  const registrations = [];
  const unreadableSources = [];
  const unresolvedPlugins = [];
  const enabledPlugins = /* @__PURE__ */ new Set();
  for (const source of input.settingsPaths) {
    if (!path8.isAbsolute(source))
      throw new TypeError("Claude settings paths must be absolute");
    let config = null;
    try {
      config = await readConfig(source);
    } catch {
      unreadableSources.push(source);
      continue;
    }
    for (const command of stopCommands(config)) {
      registrations.push({
        source,
        command,
        recognizedObserver: false,
        recognizedMessaging: await recognizedMessagingLauncher(command)
      });
    }
    if (config && typeof config === "object" && !Array.isArray(config)) {
      const plugins = config.enabledPlugins;
      if (plugins && typeof plugins === "object" && !Array.isArray(plugins)) {
        for (const [name, enabled] of Object.entries(plugins)) {
          if (enabled === true) enabledPlugins.add(name);
        }
      }
    }
  }
  for (const name of enabledPlugins) {
    const pluginRoot = input.installedPlugins?.[name];
    if (!pluginRoot || !path8.isAbsolute(pluginRoot)) {
      unresolvedPlugins.push(name);
      continue;
    }
    const source = path8.join(pluginRoot, "hooks", "hooks.json");
    let config = null;
    try {
      config = await readConfig(source);
    } catch {
      unreadableSources.push(source);
      continue;
    }
    for (const command of stopCommands(config)) {
      registrations.push({
        source,
        command,
        recognizedObserver: false,
        recognizedMessaging: await recognizedMessagingLauncher(command)
      });
    }
  }
  return {
    runtime: "claude-code",
    registrations,
    fingerprint: fingerprint(registrations),
    unreadableSources,
    unresolvedPlugins,
    visibilityLimits: [
      "session-scoped skill and agent frontmatter hooks are not enumerable from loaded settings files"
    ]
  };
}
async function inspectObserverLease(input) {
  const file = path8.join(input.root, "leases", `${input.pin.sessionId}.json`);
  let info;
  try {
    info = await lstat3(file);
  } catch (error) {
    if (error.code === "ENOENT") return "absent";
    return "uncertain";
  }
  if (!info.isFile() || info.isSymbolicLink() || process.getuid && info.uid !== process.getuid() || info.size > 64 * 1024) {
    return "uncertain";
  }
  let lease;
  try {
    lease = JSON.parse(await readFile2(file, "utf8"));
  } catch {
    return "uncertain";
  }
  if (lease.schemaVersion !== OBSERVER_LEASE_SCHEMA_VERSION || lease.runtime !== input.pin.runtime || lease.ownerSession !== input.pin.sessionId || lease.ownerCwd !== path8.resolve(input.worktree) || !["armed", "waiting", "idle", "triggered", "disarmed"].includes(
    lease.state
  ) || !Number.isSafeInteger(lease.continuationCount) || !Number.isSafeInteger(lease.continuationCap) || !Number.isSafeInteger(lease.loopCount) || !Number.isSafeInteger(lease.loopCap) || lease.continuationCount > lease.continuationCap || lease.loopCount > lease.loopCap || Number.isNaN(Date.parse(lease.armedAt)) || Number.isNaN(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) - Date.parse(lease.armedAt) !== lease.leaseMs) {
    return "uncertain";
  }
  if (lease.state === "triggered") return "present";
  if (["idle", "disarmed"].includes(lease.state)) return "inactive";
  const now = (input.now ?? /* @__PURE__ */ new Date()).getTime();
  if (now >= Date.parse(lease.expiresAt) || lease.continuationCount >= lease.continuationCap || lease.loopCount >= lease.loopCap) {
    return "inactive";
  }
  return "present";
}
async function assessAutomaticOwnership(input) {
  assertPin(input.pin);
  const lease = await inspectObserverLease(input);
  const recoveryCommand = `node <observer-collab-skill>/scripts/collab-control.mjs disarm --session ${input.pin.sessionId}`;
  if (lease === "present" || lease === "uncertain") {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      reason: lease === "present" ? "an exact-session observer continuation owner is active or triggered" : "observer ownership cannot be established safely",
      recoveryCommand,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null
    };
  }
  if (input.inventory.unreadableSources.length > 0 || input.inventory.unresolvedPlugins.length > 0) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      reason: "required hook inventory is unreadable or unresolved",
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null
    };
  }
  const thirdParty = input.inventory.registrations.filter(
    (registration) => !registration.recognizedObserver && !registration.recognizedMessaging
  );
  if (thirdParty.length > 0 && input.acknowledgedFingerprint !== input.inventory.fingerprint) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      reason: "third-party Stop registrations require exact scoped acknowledgment",
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: true,
      acknowledgedFingerprint: null
    };
  }
  return {
    automaticAllowed: true,
    observerOwner: lease,
    reason: "no active observer owner and the bounded hook inventory is accepted",
    recoveryCommand: null,
    inventory: input.inventory,
    thirdPartyAcknowledgmentRequired: thirdParty.length > 0,
    acknowledgedFingerprint: thirdParty.length > 0 ? input.inventory.fingerprint : null
  };
}

// src/skills/agent-messaging/src/hooks/common.ts
function boundedEnvelope(messages, collaborationId, pin) {
  const full = messages.map((message) => ({
    id: message.id,
    from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
    kind: message.kind,
    priority: message.priority,
    subject: message.subject,
    body: message.body,
    untrusted: true
  }));
  const wrap = (payload) => `<agent_messaging_context automatic="true" untrusted="true">
${JSON.stringify(payload).replaceAll("<", "\\u003c")}
</agent_messaging_context>`;
  const complete = wrap({ collaborationId, messages: full });
  if (complete.length <= 6e3) return complete;
  return wrap({
    collaborationId,
    messages: messages.map((message) => ({
      id: message.id,
      from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
      kind: message.kind,
      priority: message.priority,
      subject: message.subject,
      readCommand: `node <skill-dir>/scripts/agent-messaging.mjs inbox --collab ${collaborationId} --self ${pin.runtime}:${pin.sessionId} --message ${message.id}`
    })),
    notice: "Bodies exceeded the bounded host envelope; read each exact message before acknowledging it."
  });
}
async function inventoryFor(input, env) {
  if (input.runtime === "codex") {
    const hooksPath = env.AGENT_MESSAGING_HOOKS_PATH ?? path9.join(env.HOME ?? input.cwd, ".codex", "hooks.json");
    return inspectCodexStopInventory(hooksPath);
  }
  const settingsPaths = (env.AGENT_MESSAGING_CLAUDE_SETTINGS ?? "").split(path9.delimiter).filter(Boolean);
  const installedPlugins = env.AGENT_MESSAGING_CLAUDE_PLUGINS ? JSON.parse(env.AGENT_MESSAGING_CLAUDE_PLUGINS) : {};
  return inspectClaudeStopInventory({ settingsPaths, installedPlugins });
}
async function handleBoundary(input, dependencies = {}) {
  assertBoundedString(input.sessionId, "native session ID", 128);
  if (!path9.isAbsolute(input.cwd))
    throw new TypeError("native cwd must be absolute");
  if (input.continuationActive || !input.eventId)
    return { output: null, envelope: null };
  assertBoundedString(input.eventId, "native event ID", 128);
  const env = dependencies.env ?? process.env;
  const currentTime = dependencies.now ?? (() => /* @__PURE__ */ new Date());
  const now = currentTime();
  const root = resolveCollaborationRoot(env);
  const pin = {
    runtime: input.runtime,
    sessionId: input.sessionId
  };
  const status = await activationStatus(root, pin, now);
  if (!status.activation || !status.active)
    return { output: null, envelope: null };
  if (status.activation.worktree !== path9.resolve(input.cwd) || status.activation.controller !== "standalone-messaging") {
    return { output: null, envelope: null };
  }
  if (input.runtime === "claude-code" && (!status.activation.noObserverMonitorAttestation || status.activation.noObserverMonitorAttestation.epoch !== status.activation.epoch)) {
    return { output: null, envelope: null };
  }
  const inventory = await inventoryFor(input, env);
  const ownership = await assessAutomaticOwnership({
    root,
    pin,
    worktree: input.cwd,
    inventory,
    acknowledgedFingerprint: status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    now
  });
  if (!ownership.automaticAllowed) return { output: null, envelope: null };
  if (input.boundary === "prompt-start" && input.provenHuman) {
    await recordHumanActivity({
      root,
      pin,
      eventKey: input.eventId,
      now
    }).catch(() => void 0);
  }
  let inbox = await listInbox({
    root,
    collaborationId: status.activation.collaborationId,
    pin
  });
  let eligible = input.boundary === "stop" ? inbox.messages.filter((message) => message.kind === "request") : inbox.messages;
  if (eligible.length === 0 && input.boundary === "stop" && status.activation.waitMs > 0) {
    await (dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))))(status.activation.waitMs);
    inbox = await listInbox({
      root,
      collaborationId: status.activation.collaborationId,
      pin
    });
    eligible = inbox.messages.filter((message) => message.kind === "request");
  }
  if (eligible.length === 0) return { output: null, envelope: null };
  const finalNow = currentTime();
  const finalStatus = await activationStatus(root, pin, finalNow);
  if (!finalStatus.active || finalStatus.activation?.id !== status.activation.id) {
    return { output: null, envelope: null };
  }
  const finalInventory = await inventoryFor(input, env);
  const finalOwnership = await assessAutomaticOwnership({
    root,
    pin,
    worktree: input.cwd,
    inventory: finalInventory,
    acknowledgedFingerprint: status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    now: finalNow
  });
  if (!finalOwnership.automaticAllowed) return { output: null, envelope: null };
  const attemptId = randomUUID5();
  const eventKey = `${input.runtime}:${input.boundary}:${input.eventId}`;
  const claim = await claimDelivery({
    root,
    pin,
    eventKey,
    deliveryKeys: eligible.map((message) => ({
      messageId: message.id,
      retryGeneration: 0
    })),
    token: attemptId,
    now: finalNow
  });
  if (!claim.slot || claim.owned.length === 0 || !claim.activeAfterClaim)
    return { output: null, envelope: null };
  const ownedIds = new Set(claim.owned.map((message) => message.messageId));
  const envelope = boundedEnvelope(
    eligible.filter((message) => ownedIds.has(message.id)),
    status.activation.collaborationId,
    pin
  );
  await publishDeliveryDiagnostic({
    root,
    pin,
    diagnostic: {
      attemptId,
      activationId: status.activation.id,
      eventKey,
      boundary: input.boundary,
      recordedAt: finalNow.toISOString(),
      stage: "output-attempted",
      outcomeCode: "host-output-attempted",
      errorCode: null
    }
  }).catch(() => dependencies.diagnostic?.("diagnostic-write-failed"));
  const output = input.boundary === "stop" ? { decision: "block", reason: envelope } : {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: envelope
    }
  };
  return { output, envelope };
}

// src/skills/agent-messaging/src/hooks/claude-code.ts
async function runClaudeCodeHook(event, dependencies = {}) {
  const boundary = event.hook_event_name === "UserPromptSubmit" ? "prompt-start" : event.hook_event_name === "Stop" ? "stop" : null;
  if (!boundary || typeof event.session_id !== "string" || typeof event.cwd !== "string" || !path10.isAbsolute(event.cwd)) {
    return null;
  }
  const eventId = typeof event.event_id === "string" ? event.event_id : typeof event.prompt_id === "string" ? event.prompt_id : null;
  return (await handleBoundary(
    {
      runtime: "claude-code",
      sessionId: event.session_id,
      cwd: event.cwd,
      boundary,
      eventId,
      provenHuman: boundary === "prompt-start" && event.is_human === true && eventId !== null,
      continuationActive: event.stop_hook_active === true
    },
    dependencies
  )).output;
}
async function readStdin() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new Error("HOOK_INPUT_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function runClaudeCodeHookMain() {
  try {
    const output = await runClaudeCodeHook(
      JSON.parse(await readStdin()),
      { diagnostic: (message) => process.stderr.write(`${message}
`) }
    );
    if (output) process.stdout.write(`${JSON.stringify(output)}
`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.name : "HOOK_ERROR"}
`
    );
  }
}
if (process.argv[1] && path10.resolve(process.argv[1]) === path10.resolve(fileURLToPath(import.meta.url))) {
  runClaudeCodeHookMain().catch(() => void 0);
}
export {
  runClaudeCodeHook,
  runClaudeCodeHookMain
};
