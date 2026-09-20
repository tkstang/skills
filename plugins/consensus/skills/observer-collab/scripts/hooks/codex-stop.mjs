#!/usr/bin/env node
// GENERATED skill payload for session-observer-collab.

// src/skills/session-observer-collab/src/hooks/codex-stop.mjs
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  const basename3 = path.basename(file, ".json");
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
      if (candidate.alias !== basename3)
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
      if (candidate.participantId !== parent || String(candidate.generation) !== basename3)
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
      if (candidate.participantId !== parent || String(candidate.generation) !== basename3)
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
      if (candidate.to.participantId !== parent || candidate.id !== basename3)
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
      if (candidate.messageId !== basename3 || String(candidate.bindingGeneration) !== parent)
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
      if (candidate.id !== basename3)
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
    if (record.schemaVersion !== SCHEMA_VERSION)
      throw new TypeError("activation schema version is unsupported");
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
    const startedAt = timestamp(record.startedAt, "activation startedAt");
    const hardExpiresAt = timestamp(
      record.hardExpiresAt,
      "activation hardExpiresAt"
    );
    if (hardExpiresAt <= startedAt || hardExpiresAt - startedAt > MAX_ACTIVATION_DURATION_MS)
      throw new TypeError("activation hard expiry must be within 24 hours");
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
      const fixedExpiresAt = timestamp(
        record.fixedExpiresAt,
        "activation fixedExpiresAt"
      );
      if (fixedExpiresAt <= startedAt || fixedExpiresAt > hardExpiresAt)
        throw new TypeError(
          "fixed activation expiry must follow start and not exceed hard expiry"
        );
    }
    if (record.thirdPartyHookAcknowledgment) {
      if (!/^[a-f0-9]{64}$/u.test(
        record.thirdPartyHookAcknowledgment.configurationFingerprint
      ))
        throw new TypeError("hook acknowledgment fingerprint is invalid");
      const acknowledgedAt = timestamp(
        record.thirdPartyHookAcknowledgment.acknowledgedAt,
        "hook acknowledgment time"
      );
      if (acknowledgedAt < startedAt || acknowledgedAt > hardExpiresAt)
        throw new TypeError("hook acknowledgment time is outside activation");
    }
    if (record.noObserverMonitorAttestation) {
      assertPin(record.noObserverMonitorAttestation.pin);
      if (!pinsEqual(record.noObserverMonitorAttestation.pin, record.pin) || record.noObserverMonitorAttestation.epoch !== record.epoch)
        throw new TypeError("Monitor attestation identity is invalid");
      const confirmedAt = timestamp(
        record.noObserverMonitorAttestation.confirmedAt,
        "Monitor attestation time"
      );
      if (confirmedAt < startedAt || confirmedAt > hardExpiresAt)
        throw new TypeError("Monitor attestation time is outside activation");
    }
    if (record.composedMonitorAttestation) {
      const attestation = record.composedMonitorAttestation;
      assertPin(attestation.owner);
      assertPin(attestation.peer);
      assertUuid(attestation.activationId, "Monitor activation ID");
      assertUuid(attestation.collaborationId, "Monitor collaboration ID");
      assertBoundedString(
        attestation.observerLeaseId,
        "Monitor observer lease ID",
        128
      );
      if (!pinsEqual(attestation.owner, record.pin) || attestation.activationId !== record.id || attestation.collaborationId !== record.collaborationId || attestation.epoch !== record.epoch || attestation.oldMonitorStopped !== true || attestation.standaloneWatcherStopped !== true)
        throw new TypeError("composed Monitor attestation identity is invalid");
      const confirmedAt = timestamp(
        attestation.confirmedAt,
        "composed Monitor attestation time"
      );
      if (confirmedAt < startedAt || confirmedAt > hardExpiresAt)
        throw new TypeError(
          "composed Monitor attestation time is outside activation"
        );
    }
    if (record.claudeInventorySources) {
      if (record.pin.runtime !== "claude-code")
        throw new TypeError(
          "Claude inventory sources require a Claude activation"
        );
      if (!Array.isArray(record.claudeInventorySources.settingsPaths) || record.claudeInventorySources.settingsPaths.length === 0 || !record.claudeInventorySources.settingsPaths.every(path4.isAbsolute) || !record.claudeInventorySources.installedPlugins || typeof record.claudeInventorySources.installedPlugins !== "object" || Array.isArray(record.claudeInventorySources.installedPlugins) || !Object.values(record.claudeInventorySources.installedPlugins).every(
        path4.isAbsolute
      ))
        throw new TypeError("Claude inventory sources are invalid");
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
  if (now.getTime() >= Date.parse(effectiveExpiresAt))
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

// src/shared/collaboration/claims.ts
import { createHash as createHash3, randomUUID as randomUUID4 } from "node:crypto";
import path5 from "node:path";
async function resolveDeliveryKeys(input) {
  const files = await enumerateJsonRecords(
    path5.join(
      collaborationPaths(input.root, input.activation.collaborationId).directory,
      "retries",
      input.activation.participantId
    ),
    { root: input.root, maxEntries: 4096 }
  );
  const generations = /* @__PURE__ */ new Map();
  for (const file of files) {
    const retry = await readJsonRecord(file, { root: input.root });
    if (retry.activationId !== input.activation.id || retry.participantId !== input.activation.participantId || !Number.isSafeInteger(retry.retryGeneration) || retry.retryGeneration < 1)
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "retry record identity or generation is invalid"
      );
    generations.set(
      retry.messageId,
      Math.max(generations.get(retry.messageId) ?? 0, retry.retryGeneration)
    );
  }
  return input.messages.map((message) => ({
    messageId: message.id,
    retryGeneration: generations.get(message.id) ?? 0
  }));
}
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
    input.clock?.() ?? /* @__PURE__ */ new Date()
  );
  return {
    event: eventResult.record,
    slot,
    owned,
    duplicateEvent: false,
    activeAfterClaim: after.active && after.activation?.id === activation.id
  };
}

// src/shared/collaboration/messages.ts
import path6 from "node:path";
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
  const ackPath = path6.join(
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
  const directory = path6.join(
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

// src/skills/session-observer/src/lib/digest.ts
import { createHash as createHash5 } from "node:crypto";

// src/shared/transcript/runtimes.ts
import { open as open2, readFile as readFile2 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
var TOOL_INPUT_LIMIT = 200;
var TOOL_RESULT_LIMIT = 500;
var ASK_USER_PROMPT_LIMIT = 500;
var ASK_USER_OPTION_LIMIT = 120;
var ASK_USER_DESCRIPTION_LIMIT = 300;
var ASK_USER_ANSWER_LIMIT = 500;
var ASK_USER_TOOL_NAMES = {
  "claude-code": "AskUserQuestion",
  codex: "request_user_input",
  cursor: "AskQuestion"
};
var COMMAND_MESSAGE_RE = /<(command-message|command-name|command-args)>[\s\S]*?<\/\1>/u;
var NO_OP_PREFIX = /^\s*\[no-op\](?:\s|$)/iu;
var AUTOMATIC_ACKNOWLEDGMENT = /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
var AUTOMATIC_STATUS_ECHO = /^\s*(?:status:\s*)?(?:(?:still\s+)?(?:waiting|holding|idle|armed|monitoring)(?:\s+(?:for|on|until)\s+[^.!?;:]+)?|no (?:new )?(?:input|updates?|messages?|changes?))[.!]*\s*$/iu;
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function automaticControlVersion(schemaVersion, indexBase) {
  if (schemaVersion === void 0 && indexBase === void 0) {
    return {
      schemaVersion: 1,
      indexBase: "zero-based-jsonl-record-index"
    };
  }
  if (schemaVersion === 2 && (indexBase === "zero-based-jsonl-record-index" || indexBase === "zero-based-jsonl-frame-index")) {
    return { schemaVersion, indexBase };
  }
  return null;
}
function parseAutomaticControlJsonEnvelope(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !isObject(parsed.session_observer_wake)) return null;
  const wake = parsed.session_observer_wake;
  const version = automaticControlVersion(wake.schemaVersion, wake.indexBase);
  const range = wake.range;
  if (version === null || wake.automatic !== true || !asString(wake.runtime) || !asString(wake.leaseId) || !isObject(wake.pinnedPeer) && !asString(wake.pinnedPeer) || !isObject(range) || !Number.isInteger(range.fromIndex) || !Number.isInteger(range.toIndex) || range.fromIndex < 0 || range.toIndex < range.fromIndex) {
    return null;
  }
  return {
    ...wake,
    automatic: true,
    schemaVersion: version.schemaVersion,
    runtime: wake.runtime,
    leaseId: wake.leaseId,
    pinnedPeer: wake.pinnedPeer,
    indexBase: version.indexBase,
    range
  };
}
function decodeXmlAttribute(value) {
  if (/[<>]|&(?!amp;|quot;|lt;|gt;|apos;)/u.test(value)) return null;
  return value.replace(
    /&(amp|quot|lt|gt|apos);/gu,
    (_match, entity) => {
      if (entity === "amp") return "&";
      if (entity === "quot") return '"';
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      return "'";
    }
  );
}
function parseXmlAttributes(source) {
  const attributes = /* @__PURE__ */ new Map();
  const pattern = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/gu;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (source.slice(cursor, match.index).trim()) return null;
    const [, name, encodedValue] = match;
    const value = decodeXmlAttribute(encodedValue);
    if (value === null || attributes.has(name)) return null;
    attributes.set(name, value);
    cursor = pattern.lastIndex;
  }
  if (source.slice(cursor).trim() || attributes.size === 0) return null;
  return attributes;
}
function parseAutomaticControlXmlEnvelope(text) {
  const match = /^\s*<session_observer_wake\b([^<>]*)>([\s\S]*?)<\/session_observer_wake>\s*$/u.exec(
    text
  );
  if (!match) return null;
  const attributes = parseXmlAttributes(match[1]);
  if (!attributes || attributes.get("automatic") !== "true") return null;
  const schemaVersionAttribute = attributes.get("schema_version");
  const version = automaticControlVersion(
    schemaVersionAttribute === void 0 ? void 0 : schemaVersionAttribute === "2" ? 2 : null,
    attributes.get("index_base")
  );
  const runtime = attributes.get("runtime");
  const leaseId = attributes.get("lease_id");
  const pinnedPeer = attributes.get("peer");
  const records = attributes.get("records");
  const rangeMatch = /^(\d+)-(\d+)$/u.exec(records ?? "");
  if (version === null || !runtime?.trim() || !leaseId?.trim() || !pinnedPeer?.trim() || !rangeMatch)
    return null;
  const fromIndex = Number(rangeMatch[1]);
  const toIndex = Number(rangeMatch[2]);
  if (!Number.isSafeInteger(fromIndex) || !Number.isSafeInteger(toIndex) || toIndex < fromIndex) {
    return null;
  }
  return {
    automatic: true,
    schemaVersion: version.schemaVersion,
    runtime,
    leaseId,
    pinnedPeer,
    indexBase: version.indexBase,
    range: { fromIndex, toIndex },
    wireFormat: "xml",
    body: match[2].trim()
  };
}
function parseAutomaticControlEnvelope(text) {
  return parseAutomaticControlXmlEnvelope(text) ?? parseAutomaticControlJsonEnvelope(text);
}
function isNoOpText(text) {
  return NO_OP_PREFIX.test(text);
}
function isAutomaticControlAcknowledgement(text) {
  return AUTOMATIC_ACKNOWLEDGMENT.test(text) || AUTOMATIC_STATUS_ECHO.test(text);
}
function messageEntry(role, text, recordIndex, displayRole, origin, allowAutomaticControl = true) {
  if (role === "user" && allowAutomaticControl) {
    const automaticControl = parseAutomaticControlEnvelope(text);
    if (automaticControl) {
      return {
        role,
        text,
        recordIndex,
        kind: "message",
        displayRole: "automatic-control",
        origin: "automatic-control",
        automaticControl
      };
    }
  }
  return {
    role,
    text,
    recordIndex,
    kind: "message",
    ...displayRole ? { displayRole } : {},
    ...origin ? { origin } : {}
  };
}
function claudeUserRecordProvenance(record) {
  const origin = isObject(record.origin) ? asString(record.origin.kind) : null;
  if (origin === null || origin === void 0) return "legacy-absent";
  if (origin === "human") return "human";
  if (origin === "task-notification") return "runtime-notification";
  return "unmarked";
}
function claudeEntryProvenance(provenance) {
  if (provenance === "human") return { origin: "human" };
  if (provenance === "runtime-notification") {
    return {
      displayRole: "runtime-notification",
      origin: "runtime-notification"
    };
  }
  return {};
}
function claudeAskUserAnswerProvenance(provenance) {
  if (provenance === "legacy-absent" || provenance === "human") {
    return { origin: "human" };
  }
  return claudeEntryProvenance(provenance);
}
function truncate(str, limit) {
  if (str.length <= limit) return str;
  return str.slice(0, limit) + "...";
}
function isClaudeCommandMessageText(text) {
  return COMMAND_MESSAGE_RE.test(text);
}
function stringifyArgs(value, limit) {
  if (typeof value === "string") return truncate(value, limit);
  return truncate(JSON.stringify(value ?? {}) ?? "{}", limit);
}
var ASK_USER_ANSWER_PROMPT_LIMIT = 200;
function parseAskUserQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!isObject(raw)) return [];
    const prompt = asString(raw.question) ?? asString(raw.prompt);
    if (!prompt) return [];
    const header = asString(raw.header) ?? asString(raw.title);
    const options = Array.isArray(raw.options) ? raw.options.flatMap((option) => {
      if (typeof option === "string") return [{ label: option }];
      if (!isObject(option)) return [];
      const label = asString(option.label) ?? asString(option.id);
      if (!label) return [];
      const description = asString(option.description);
      return [{ label, ...description ? { description } : {} }];
    }) : [];
    return [{ ...header ? { header } : {}, prompt, options }];
  });
}
function formatAskUserQuestions(toolName, questions, opts) {
  const numbered = questions.length > 1;
  const lines = [];
  const questionHead = (question) => {
    const header = question.header ?? (numbered ? void 0 : opts.title);
    const head = header ? `${header} \u2014 ${question.prompt}` : question.prompt;
    return truncate(head, ASK_USER_PROMPT_LIMIT);
  };
  if (numbered) {
    const title = opts.title ? `${opts.title} \u2014 ` : "";
    lines.push(`[${toolName}] ${title}${questions.length} questions:`);
  }
  questions.forEach((question, index) => {
    const head = questionHead(question);
    lines.push(numbered ? `${index + 1}. ${head}` : `[${toolName}] ${head}`);
    if (question.options.length === 0) return;
    if (opts.includeDescriptions) {
      for (const option of question.options) {
        const description = option.description ? ` \u2014 ${truncate(option.description, ASK_USER_DESCRIPTION_LIMIT)}` : "";
        lines.push(
          `   - ${truncate(option.label, ASK_USER_OPTION_LIMIT)}${description}`
        );
      }
    } else {
      const labels = question.options.map((option) => truncate(option.label, ASK_USER_OPTION_LIMIT)).join(" | ");
      lines.push(`   options: ${labels}`);
    }
  });
  for (const note of opts.notes ?? []) lines.push(`   (${note})`);
  return lines.join("\n");
}
function formatAskUserAnswers(toolName, answers) {
  const numbered = answers.length > 1;
  const lines = [];
  if (numbered) {
    lines.push(`[${toolName} \u2192 answered]`);
  }
  answers.forEach(({ label, answer, note }, index) => {
    const body = `${truncate(label, ASK_USER_ANSWER_PROMPT_LIMIT)}: "${truncate(
      answer,
      ASK_USER_ANSWER_LIMIT
    )}"`;
    lines.push(
      numbered ? `${index + 1}. ${body}` : `[${toolName} \u2192 answered] ${body}`
    );
    if (note) {
      lines.push(`   note: ${truncate(note, ASK_USER_ANSWER_LIMIT)}`);
    }
  });
  return lines.join("\n");
}
function askUserAnswerText(value) {
  if (typeof value === "string") return value || void 0;
  if (Array.isArray(value)) {
    const labels = value.map(asString).filter((label) => Boolean(label));
    return labels.length > 0 ? labels.join(", ") : void 0;
  }
  if (isObject(value)) return askUserAnswerText(value.answers);
  return void 0;
}
function safeParseLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!isObject(parsed)) {
      return {
        ok: false,
        kind: "not-object",
        reason: "not a JSON object"
      };
    }
    return { ok: true, value: parsed };
  } catch (err) {
    return {
      ok: false,
      kind: "malformed",
      reason: err instanceof Error ? err.message : String(err)
    };
  }
}
async function readRecordsDetailedInternal(transcriptPath) {
  const rawBytes = await readFile2(transcriptPath);
  const capturedAt = (/* @__PURE__ */ new Date()).toISOString();
  const sourceBytes = rawBytes.byteLength;
  const raw = rawBytes.toString("utf8");
  if (!raw) {
    return {
      records: [],
      diagnostics: [],
      legacyWarnings: [],
      capturedAt,
      sourceBytes
    };
  }
  const lines = raw.split("\n");
  const records = [];
  const diagnostics = [];
  const legacyWarnings = [];
  const fileEndsWithNewline = raw.endsWith("\n");
  const lastIndex = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    const carrier = lines[i];
    const line = carrier.trim();
    if (!line) continue;
    const result = safeParseLine(line);
    if (result.ok) {
      records.push({
        record: result.value,
        sourceCarrier: carrier,
        recordIndex: records.length,
        physicalLine: i + 1
      });
      continue;
    }
    const isLastToken = i === lastIndex;
    if (isLastToken && !fileEndsWithNewline) {
      diagnostics.push({
        kind: "partial-tail",
        physicalLine: i + 1
      });
      legacyWarnings.push(
        `[runtimes] Partial trailing line dropped from ${transcriptPath} (line ${i + 1}): ${result.reason}`
      );
    } else {
      diagnostics.push({
        kind: result.kind,
        physicalLine: i + 1
      });
      legacyWarnings.push(
        `[runtimes] Malformed JSONL line ${i + 1} in ${transcriptPath} skipped: ${result.reason}`
      );
    }
  }
  return { records, diagnostics, legacyWarnings, capturedAt, sourceBytes };
}
async function readRecordsDetailed(transcriptPath) {
  const { records, diagnostics, capturedAt, sourceBytes } = await readRecordsDetailedInternal(transcriptPath);
  return { records, diagnostics, capturedAt, sourceBytes };
}
async function readRecords(transcriptPath) {
  const detailed = await readRecordsDetailedInternal(transcriptPath);
  for (const warning of detailed.legacyWarnings) {
    console.warn(warning);
  }
  const records = detailed.records.map(({ record }) => record);
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
  if (Object.hasOwn(payload, "session_id") && rootSessionId === void 0) {
    return null;
  }
  const parentValues = codexDirectParentValues(payload);
  const parentSessionId = consistentNonEmptyString(parentValues);
  if (parentValues.length > 0 && parentSessionId === void 0) return null;
  const forkedFromSessionId = Object.hasOwn(payload, "forked_from_id") ? consistentNonEmptyString([payload.forked_from_id]) : void 0;
  if (Object.hasOwn(payload, "forked_from_id") && forkedFromSessionId === void 0) {
    return null;
  }
  const historyBoundary = payload.subagent_history_start_ordinal;
  const subagentHistoryStartOrdinal = Number.isSafeInteger(historyBoundary) && Number(historyBoundary) >= 0 ? Number(historyBoundary) : void 0;
  if (Object.hasOwn(payload, "subagent_history_start_ordinal") && subagentHistoryStartOrdinal === void 0) {
    return null;
  }
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
    const firstLegacySessionId = firstHeader ? codexSessionIdFromRecord(firstHeader) : void 0;
    const firstHeaderIndex = firstHeader ? records.indexOf(firstHeader) : -1;
    const laterNativeHeaderPresent = records.slice(firstHeaderIndex + 1).some(
      (record) => record.type === "session_meta" && isObject(record.payload) && Object.hasOwn(record.payload, "id")
    );
    if (firstHeader && nativeSessionId === void 0 && firstLegacySessionId === void 0 && (filenameSessionId !== void 0 || laterNativeHeaderPresent)) {
      return null;
    }
    if (nativeSessionId !== void 0 && filenameSessionId !== void 0 && nativeSessionId.toLowerCase() !== filenameSessionId.toLowerCase()) {
      return null;
    }
    let sessionId = nativeSessionId ?? firstLegacySessionId;
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
function claudeAskUserQuestionEntry(role, block, recordIndex, opts) {
  const input = isObject(block.input) ? block.input : {};
  const questions = parseAskUserQuestions(input.questions);
  if (questions.length === 0) return null;
  return {
    role,
    text: formatAskUserQuestions(
      ASK_USER_TOOL_NAMES["claude-code"],
      questions,
      { includeDescriptions: opts.includeToolCalls }
    ),
    recordIndex,
    kind: "ask_user",
    toolName: ASK_USER_TOOL_NAMES["claude-code"]
  };
}
function claudeAskUserAnswerEntry(role, block, recordIndex, opts) {
  const toolName = ASK_USER_TOOL_NAMES["claude-code"];
  const result = isObject(opts.toolUseResult) ? opts.toolUseResult : null;
  const rawAnswers = result && isObject(result.answers) ? result.answers : null;
  if (result && rawAnswers) {
    const headerByPrompt = /* @__PURE__ */ new Map();
    for (const question of parseAskUserQuestions(result.questions)) {
      if (question.header) headerByPrompt.set(question.prompt, question.header);
    }
    const annotations = isObject(result.annotations) ? result.annotations : {};
    const answers = Object.entries(rawAnswers).flatMap(([prompt, value]) => {
      const answer = askUserAnswerText(value);
      if (!answer) return [];
      const annotation = annotations[prompt];
      const note = isObject(annotation) ? asString(annotation.notes) : void 0;
      return [
        {
          label: headerByPrompt.get(prompt) ?? prompt,
          answer,
          ...note ? { note } : {}
        }
      ];
    });
    if (answers.length > 0) {
      return {
        role,
        text: formatAskUserAnswers(toolName, answers),
        recordIndex,
        kind: "ask_user",
        toolName,
        ...claudeAskUserAnswerProvenance(opts.userProvenance)
      };
    }
  }
  const fallback = typeof block.content === "string" ? block.content : Array.isArray(block.content) ? block.content.filter(isObject).map((part) => asString(part.text) ?? "").filter(Boolean).join("\n") : "";
  if (!fallback) return null;
  return {
    role,
    text: `[${toolName} \u2192 answered] ${truncate(fallback, ASK_USER_ANSWER_LIMIT)}`,
    recordIndex,
    kind: "ask_user",
    toolName,
    ...claudeAskUserAnswerProvenance(opts.userProvenance)
  };
}
function claudeEntriesFromContent(role, content, recordIndex, opts) {
  const provenance = claudeEntryProvenance(opts.userProvenance);
  if (typeof content === "string") {
    if (!content) return [];
    if (isClaudeCommandMessageText(content)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text: content, recordIndex, kind: "command_message" }];
    }
    return [
      messageEntry(
        role,
        content,
        recordIndex,
        provenance.displayRole,
        provenance.origin,
        opts.userProvenance === "legacy-absent"
      )
    ];
  }
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!isObject(block)) return [];
    if (block.type === "tool_use") {
      if (asString(block.name) === ASK_USER_TOOL_NAMES["claude-code"]) {
        const entry = claudeAskUserQuestionEntry(
          role,
          block,
          recordIndex,
          opts
        );
        if (entry) return [entry];
      }
      if (!opts.includeToolCalls) return [];
      const name = asString(block.name) ?? "tool_use";
      const argsStr = stringifyArgs(block.input, TOOL_INPUT_LIMIT);
      return [
        {
          role,
          text: `[${name}] ${argsStr}`,
          recordIndex,
          kind: "tool_call",
          toolName: name
        }
      ];
    }
    if (block.type === "tool_result") {
      const toolUseId = asString(block.tool_use_id);
      const name = (toolUseId && opts.toolNameById?.get(toolUseId)) ?? "tool_result";
      if (name === ASK_USER_TOOL_NAMES["claude-code"]) {
        const entry = claudeAskUserAnswerEntry(role, block, recordIndex, opts);
        if (entry) return [entry];
      }
      if (!opts.includeToolResults) return [];
      let resultText = "";
      if (typeof block.content === "string") {
        resultText = truncate(block.content, TOOL_RESULT_LIMIT);
      } else if (Array.isArray(block.content)) {
        const parts = block.content.filter(isObject).map((b) => asString(b.text) ?? "").filter(Boolean);
        resultText = truncate(parts.join("\n"), TOOL_RESULT_LIMIT);
      }
      return [
        {
          role,
          text: `[${name} \u2192 result] ${resultText}`,
          recordIndex,
          kind: "tool_result",
          toolName: name
        }
      ];
    }
    const text = asString(block.text) ?? asString(block.content);
    if (text && isClaudeCommandMessageText(text)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text, recordIndex, kind: "command_message" }];
    }
    return text ? [
      messageEntry(
        role,
        text,
        recordIndex,
        provenance.displayRole,
        provenance.origin,
        opts.userProvenance === "legacy-absent"
      )
    ] : [];
  });
}
function normalizeClaudeCode(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const includeToolResults = opts.includeToolResults ?? false;
  const includeCommandMessages = opts.includeCommandMessages ?? false;
  const toolNameById = /* @__PURE__ */ new Map();
  for (const record of records) {
    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (isObject(block) && block.type === "tool_use") {
        const id = asString(block.id);
        const name = asString(block.name);
        if (id && name) toolNameById.set(id, name);
      }
    }
  }
  const queuedContents = [];
  const deliveredQueuedContents = [];
  return records.flatMap((record, recordIndex) => {
    if (asString(record.type) === "queue-operation") {
      const operation = asString(record.operation);
      if (operation === "enqueue") {
        const content = asString(record.content);
        if (!content) return [];
        queuedContents.push(content);
        return [messageEntry("user", content, recordIndex, "queued-user")];
      }
      if (operation === "remove") {
        const content = asString(record.content);
        const queuedIndex = content ? queuedContents.indexOf(content) : queuedContents.length > 0 ? 0 : -1;
        if (queuedIndex !== -1) {
          const [deliveredContent] = queuedContents.splice(queuedIndex, 1);
          deliveredQueuedContents.push(deliveredContent);
        }
        return [];
      }
    }
    const attachment = record.attachment;
    if (isObject(attachment) && asString(attachment.type) === "queued_command") {
      const prompt = asString(attachment.prompt);
      if (!prompt) return [];
      const deliveredIndex = deliveredQueuedContents.indexOf(prompt);
      if (deliveredIndex !== -1) {
        deliveredQueuedContents.splice(deliveredIndex, 1);
        return [];
      }
      return [messageEntry("user", prompt, recordIndex, "queued-user")];
    }
    const message = isObject(record.message) ? record.message : record;
    const role = asString(message.role) ?? asString(record.role) ?? asString(record.type);
    if (role !== "assistant" && role !== "user") return [];
    return claudeEntriesFromContent(role, message.content, recordIndex, {
      includeToolCalls,
      includeToolResults,
      includeCommandMessages,
      toolNameById,
      toolUseResult: record.toolUseResult,
      userProvenance: role === "user" ? claudeUserRecordProvenance(record) : "legacy-absent"
    });
  });
}
function parseCodexFunctionArguments(value) {
  if (isObject(value)) return value;
  const raw = asString(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function codexAskUserAnswerEntry(payload, recordIndex, labelById, autoResolvable) {
  const toolName = ASK_USER_TOOL_NAMES.codex;
  const output = parseCodexFunctionArguments(payload.output);
  const rawAnswers = output && isObject(output.answers) ? output.answers : null;
  if (!rawAnswers) return null;
  const answers = Object.entries(rawAnswers).flatMap(([id, value]) => {
    const answer = askUserAnswerText(value);
    if (!answer) return [];
    return [{ label: labelById.get(id) ?? id, answer }];
  });
  if (answers.length === 0) return null;
  return {
    role: "user",
    text: formatAskUserAnswers(toolName, answers),
    recordIndex,
    kind: "ask_user",
    toolName,
    // Only attribute the answer to the operator when the call could not have
    // been resolved by Codex's own timer. The recorded output is identical
    // either way, so an auto-resolvable call leaves origin unset.
    ...autoResolvable ? {} : { origin: "human" }
  };
}
function normalizeCodex(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const askUserToolName = ASK_USER_TOOL_NAMES.codex;
  const askUserQuestionsByCallId = /* @__PURE__ */ new Map();
  const askUserLabelById = /* @__PURE__ */ new Map();
  const askUserAutoResolvableCallIds = /* @__PURE__ */ new Set();
  for (const record of records) {
    const payload = isObject(record.payload) ? record.payload : record;
    if (asString(payload.type) !== "function_call") continue;
    if ((asString(payload.name) ?? asString(record.name)) !== askUserToolName)
      continue;
    const callId = asString(payload.call_id) ?? asString(record.call_id);
    if (!callId) continue;
    const args = parseCodexFunctionArguments(
      payload.arguments ?? record.arguments
    );
    const questions = parseAskUserQuestions(args?.questions);
    if (questions.length === 0) continue;
    askUserQuestionsByCallId.set(callId, questions);
    const rawQuestions = Array.isArray(args?.questions) ? args.questions : [];
    const labelById = /* @__PURE__ */ new Map();
    for (const rawQuestion of rawQuestions) {
      if (!isObject(rawQuestion)) continue;
      const id = asString(rawQuestion.id);
      const label = asString(rawQuestion.header) ?? asString(rawQuestion.question) ?? asString(rawQuestion.prompt);
      if (id && label) labelById.set(id, label);
    }
    askUserLabelById.set(callId, labelById);
    const autoResolutionMs = args?.autoResolutionMs;
    if (typeof autoResolutionMs === "number" && autoResolutionMs > 0) {
      askUserAutoResolvableCallIds.add(callId);
    }
  }
  return records.flatMap((record, recordIndex) => {
    const payload = isObject(record.payload) ? record.payload : record;
    const payloadType = asString(payload.type) ?? asString(record.type);
    if (payloadType === "function_call_output") {
      const callId = asString(payload.call_id) ?? asString(record.call_id);
      if (!callId || !askUserQuestionsByCallId.has(callId)) return [];
      const entry = codexAskUserAnswerEntry(
        payload,
        recordIndex,
        askUserLabelById.get(callId) ?? /* @__PURE__ */ new Map(),
        askUserAutoResolvableCallIds.has(callId)
      );
      return entry ? [entry] : [];
    }
    if (payloadType === "function_call") {
      const name = asString(payload.name) ?? asString(record.name) ?? "function_call";
      const args = payload.arguments ?? record.arguments;
      if (name === askUserToolName) {
        const callId = asString(payload.call_id) ?? asString(record.call_id);
        const parsedArgs = parseCodexFunctionArguments(args);
        const questions = (callId ? askUserQuestionsByCallId.get(callId) : void 0) ?? parseAskUserQuestions(parsedArgs?.questions);
        if (questions.length > 0) {
          const autoResolutionMs = parsedArgs?.autoResolutionMs;
          const notes = typeof autoResolutionMs === "number" && autoResolutionMs > 0 ? [
            `auto-resolves after ${Math.round(autoResolutionMs / 1e3)}s; a recorded answer may be the default rather than an operator choice`
          ] : void 0;
          return [
            {
              role: "assistant",
              text: formatAskUserQuestions(askUserToolName, questions, {
                includeDescriptions: includeToolCalls,
                notes
              }),
              recordIndex,
              kind: "ask_user",
              toolName: askUserToolName
            }
          ];
        }
      }
      if (!includeToolCalls) return [];
      const argsStr = stringifyArgs(args, TOOL_INPUT_LIMIT);
      return [
        {
          role: "assistant",
          text: `[${name}] ${argsStr}`,
          recordIndex,
          kind: "tool_call",
          toolName: name
        }
      ];
    }
    if (payloadType !== "message") return [];
    const role = asString(payload.role);
    if (role !== "assistant" && role !== "user") return [];
    const content = payload.content;
    if (typeof content === "string") {
      return content ? [messageEntry(role, content, recordIndex)] : [];
    }
    if (!Array.isArray(content)) return [];
    return content.flatMap((block) => {
      if (!isObject(block)) return [];
      const text = asString(block.text) ?? asString(block.content);
      return text ? [messageEntry(role, text, recordIndex)] : [];
    });
  });
}
function cursorAskUserQuestionText(block, opts = {}) {
  if (asString(block.name) !== ASK_USER_TOOL_NAMES.cursor) return null;
  const input = isObject(block.input) ? block.input : {};
  const questions = parseAskUserQuestions(input.questions);
  if (questions.length === 0) return null;
  const title = asString(input.title);
  return formatAskUserQuestions(ASK_USER_TOOL_NAMES.cursor, questions, {
    includeDescriptions: opts.includeDescriptions ?? false,
    notes: ["selected option not recorded in Cursor transcripts"],
    ...title ? { title } : {}
  });
}
function cursorAskUserQuestionEntry(role, block, recordIndex, opts) {
  const text = cursorAskUserQuestionText(block, {
    includeDescriptions: opts.includeDescriptions
  });
  if (!text) return null;
  return {
    role,
    text,
    recordIndex,
    kind: "ask_user",
    toolName: ASK_USER_TOOL_NAMES.cursor
  };
}
function normalizeCursor(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const entries = [];
  let turnStart = 0;
  const normalizeRecord = (record, recordIndex) => {
    const role = asString(record.role);
    if (role !== "assistant" && role !== "user") return [];
    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (typeof content === "string") {
      return content ? [messageEntry(role, content, recordIndex)] : [];
    }
    if (!Array.isArray(content)) return [];
    return content.flatMap((block) => {
      if (!isObject(block)) return [];
      if (block.type === "tool_use") {
        if (role === "assistant" && asString(block.name) === ASK_USER_TOOL_NAMES.cursor) {
          const entry = cursorAskUserQuestionEntry(role, block, recordIndex, {
            includeDescriptions: includeToolCalls
          });
          if (entry) return [entry];
        }
        if (!includeToolCalls) return [];
        const name = asString(block.name) ?? "tool_use";
        const argsStr = stringifyArgs(block.input, TOOL_INPUT_LIMIT);
        return [
          {
            role,
            text: `[${name}] ${argsStr}`,
            recordIndex,
            kind: "tool_call",
            toolName: name
          }
        ];
      }
      const text = asString(block.text) ?? asString(block.content);
      return text ? [messageEntry(role, text, recordIndex)] : [];
    });
  };
  records.forEach((record, recordIndex) => {
    if (record.type !== "turn_ended") return;
    const status = asString(record.status);
    const buffered = records.slice(turnStart, recordIndex).flatMap(
      (turnRecord, offset) => normalizeRecord(turnRecord, turnStart + offset)
    );
    const consumeAtTerminal = (entry) => ({
      ...entry,
      sourceRecordIndex: entry.sourceRecordIndex ?? entry.recordIndex,
      recordIndex
    });
    const userEntries = buffered.filter((entry) => entry.role === "user" && entry.kind !== "ask_user").map(consumeAtTerminal);
    const askUserEntries = buffered.filter((entry) => entry.kind === "ask_user").map(consumeAtTerminal);
    if (status === "success") {
      const toolEntries = includeToolCalls ? buffered.filter((entry) => entry.kind === "tool_call").map(consumeAtTerminal) : [];
      const finalAssistant = buffered.findLast(
        (entry) => entry.role === "assistant" && entry.kind === "message"
      );
      entries.push(...userEntries, ...toolEntries, ...askUserEntries);
      if (finalAssistant) {
        entries.push(consumeAtTerminal(finalAssistant));
      }
    } else {
      const label = status ?? "unknown";
      entries.push(...userEntries, ...askUserEntries, {
        role: "assistant",
        text: `[Cursor turn ended with status: ${label}]`,
        recordIndex,
        kind: "message",
        origin: "runtime-diagnostic"
      });
    }
    turnStart = recordIndex + 1;
  });
  if (turnStart < records.length) {
    const trailing = records.slice(turnStart).flatMap((record, offset) => normalizeRecord(record, turnStart + offset));
    if (trailing.some((entry) => entry.kind === "ask_user")) {
      entries.push(
        ...trailing.filter((entry) => {
          if (entry.kind === "ask_user") return true;
          if (entry.role !== "user") return false;
          return entry.origin !== "automatic-control" && entry.displayRole !== "automatic-control";
        })
      );
    }
  }
  return entries;
}
function normalizeEntries(runtime, records, opts = {}) {
  if (runtime === "claude-code") return normalizeClaudeCode(records, opts);
  if (runtime === "codex") return normalizeCodex(records, opts);
  if (runtime === "cursor") return normalizeCursor(records, opts);
  throw new Error(`Unknown runtime: ${runtime}`);
}

// src/shared/transcript/activity/classify.ts
var CATEGORY_BY_NATIVE_NAME = /* @__PURE__ */ new Map([
  ["Bash", "shell"],
  ["Shell", "shell"],
  ["exec_command", "shell"],
  ["shell_command", "shell"],
  ["write_stdin", "shell"],
  ["Read", "read"],
  ["read_file", "read"],
  ["Write", "write"],
  ["write_file", "write"],
  ["Edit", "edit"],
  ["MultiEdit", "edit"],
  ["ApplyPatch", "edit"],
  ["apply_patch", "edit"],
  ["Grep", "grep"],
  ["grep", "grep"],
  ["Glob", "glob"],
  ["glob", "glob"],
  ["WebSearch", "search"],
  ["search_query", "search"],
  ["web_search", "search"],
  ["WebFetch", "fetch"],
  ["fetch", "fetch"],
  ["web_fetch", "fetch"],
  ["Agent", "task"],
  ["Subagent", "task"],
  ["Task", "task"],
  ["close_agent", "task"],
  ["followup_task", "task"],
  ["interrupt_agent", "task"],
  ["list_agents", "task"],
  ["multi_agent_v1__spawn_agent", "task"],
  ["send_message", "task"],
  ["send_input", "task"],
  ["spawn_agent", "task"],
  ["wait", "task"],
  ["wait_agent", "task"],
  ["AskQuestion", "ask"],
  ["AskUserQuestion", "ask"],
  ["request_user_input", "ask"],
  ["request_user_input_async", "ask"]
]);
var CATEGORY_BY_ITEM_TYPE = /* @__PURE__ */ new Map([
  ["CollabAgentToolCall", "task"],
  ["CommandExecution", "shell"],
  ["FileChange", "edit"],
  ["McpToolCall", "mcp"],
  ["SubAgentActivity", "task"],
  ["WebSearch", "search"]
]);
function classifyNativeName(nativeName) {
  if (nativeName === void 0) return "other";
  const exact = CATEGORY_BY_NATIVE_NAME.get(nativeName);
  if (exact !== void 0) return exact;
  return /^mcp__.+__.+$/.test(nativeName) ? "mcp" : "other";
}
function classifyStandaloneItem(event) {
  if (event.kind !== "item") return void 0;
  return CATEGORY_BY_ITEM_TYPE.get(event.nativeType) ?? "other";
}

// src/shared/transcript/activity/correlate.ts
function metadataObject(event) {
  return event.metadata;
}
function headerOwnershipEvidence(event) {
  const metadata = metadataObject(event);
  const directParentThreadId = metadata?.directParentThreadId;
  const nestedParentThreadId = metadata?.nestedParentThreadId;
  const directParent = typeof directParentThreadId === "string" ? directParentThreadId : void 0;
  const nestedParent = typeof nestedParentThreadId === "string" ? nestedParentThreadId : void 0;
  if (metadata?.directParentMarkerPresent === true && directParent === void 0 || metadata?.nestedParentMarkerPresent === true && nestedParent === void 0) {
    return { kind: "unknown" };
  }
  if (directParent !== void 0 && nestedParent !== void 0 && directParent !== nestedParent) {
    return { kind: "unknown" };
  }
  const parentThreadId = directParent ?? nestedParent;
  const lineageMarkerPresent = metadata?.directParentMarkerPresent === true || metadata?.nestedParentMarkerPresent === true || metadata?.subagentMarkerPresent === true || metadata?.subagentHistoryStartOrdinalPresent === true;
  if (parentThreadId === void 0) {
    return lineageMarkerPresent ? { kind: "unknown" } : { kind: "root" };
  }
  const boundary = metadata?.subagentHistoryStartOrdinal;
  if (typeof boundary !== "number" || !Number.isSafeInteger(boundary) || boundary < 0) {
    return { kind: "unknown" };
  }
  return { kind: "bounded-child", boundary, parentThreadId };
}
function activityOwnershipContext(source, events) {
  if (source.runtime !== "codex") return { kind: "root" };
  const headers = events.filter((event) => {
    if (event.kind !== "metadata" || event.nativeType !== "session_meta") {
      return false;
    }
    return metadataObject(event)?.nativeSessionId === source.nativeSessionId;
  });
  if (headers.length === 0) return { kind: "unknown" };
  const evidence = headers.map(headerOwnershipEvidence);
  if (evidence.every((entry) => entry.kind === "root")) return { kind: "root" };
  if (evidence.some((entry) => entry.kind !== "bounded-child")) {
    return { kind: "unknown" };
  }
  const parentThreadIds = new Set(
    evidence.map((entry) => entry.parentThreadId)
  );
  const boundaries = new Set(evidence.map((entry) => entry.boundary));
  if (parentThreadIds.size !== 1 || boundaries.size !== 1) {
    return { kind: "unknown" };
  }
  return {
    kind: "bounded-child",
    boundary: evidence[0].boundary
  };
}
function ownershipForLocator(locator, context) {
  if (context.kind === "root") return "owned";
  if (context.kind === "unknown" || typeof locator.ordinal !== "number" || !Number.isSafeInteger(locator.ordinal)) {
    return "unknown";
  }
  return locator.ordinal < context.boundary ? "inherited" : "owned";
}
function callsBy(calls, field) {
  const lookup = /* @__PURE__ */ new Map();
  for (const call of calls) {
    const value = call[field];
    if (!value) continue;
    const matches = lookup.get(value) ?? [];
    matches.push(call);
    lookup.set(value, matches);
  }
  return lookup;
}
function uniqueCall(lookup, nativeId) {
  if (!nativeId) return void 0;
  const matches = lookup.get(nativeId);
  return matches?.length === 1 ? matches[0] : void 0;
}
function relatedCall(event, byCallId, byNativeId) {
  if (event.kind === "result") {
    return uniqueCall(byCallId, event.nativeCallId);
  }
  if (event.kind !== "item") return void 0;
  const candidates = /* @__PURE__ */ new Map();
  const byCall = uniqueCall(byCallId, event.nativeCallId);
  const byItem = uniqueCall(byNativeId, event.nativeId);
  if (byCall) candidates.set(byCall.eventKey, byCall);
  if (byItem) candidates.set(byItem.eventKey, byItem);
  return candidates.size === 1 ? [...candidates.values()][0] : void 0;
}
function ambiguousDiagnostics(lookup, field) {
  return [...lookup.entries()].flatMap(([nativeId, calls]) => {
    if (calls.length < 2) return [];
    return [
      {
        code: "AMBIGUOUS_NATIVE_CORRELATION",
        locator: calls[0].locator,
        field,
        nativeId
      }
    ];
  });
}
function conflictingItemDiagnostics(events, byCallId, byNativeId) {
  return events.flatMap((event) => {
    if (event.kind !== "item") return [];
    const byCall = uniqueCall(byCallId, event.nativeCallId);
    const byItem = uniqueCall(byNativeId, event.nativeId);
    if (!byCall || !byItem || byCall.eventKey === byItem.eventKey) return [];
    return [
      {
        code: "AMBIGUOUS_NATIVE_CORRELATION",
        locator: event.locator,
        field: "nativeCallId+nativeId"
      }
    ];
  });
}
function categoryFor(event, related) {
  if (event.kind === "call") return classifyNativeName(event.nativeName);
  if (related) return classifyNativeName(related.nativeName);
  if (event.kind === "result") return "other";
  return classifyStandaloneItem(event);
}
function correlationCounts(events) {
  const calls = events.filter((event) => event.kind === "call");
  const results = events.filter((event) => event.kind === "result");
  const items = events.filter((event) => event.kind === "item");
  const countOwnership = (ownership) => calls.filter((event) => event.ownership === ownership).length;
  const owned = countOwnership("owned");
  return {
    responseStreamCalls: {
      captured: calls.length,
      counted: owned,
      owned,
      inherited: countOwnership("inherited"),
      unknown: countOwnership("unknown")
    },
    results: {
      matched: results.filter((event) => event.relatedCallKey !== void 0).length,
      unmatched: results.filter((event) => event.relatedCallKey === void 0).length
    },
    itemEvidence: {
      linked: items.filter((event) => event.relatedCallKey !== void 0).length,
      standalone: items.filter((event) => event.relatedCallKey === void 0).length
    }
  };
}
function correlateActivity(activity) {
  const context = activityOwnershipContext(activity.source, activity.events);
  const calls = activity.events.filter((event) => event.kind === "call");
  const byCallId = callsBy(calls, "nativeCallId");
  const byNativeId = callsBy(calls, "nativeId");
  const events = activity.events.map((event) => {
    const related = relatedCall(event, byCallId, byNativeId);
    const category = categoryFor(event, related);
    return {
      ...event,
      ownership: ownershipForLocator(event.locator, context),
      ...category === void 0 ? {} : { category },
      ...related === void 0 ? {} : { relatedCallKey: related.eventKey }
    };
  });
  return {
    ...activity,
    events,
    correlationCounts: correlationCounts(events),
    diagnostics: [
      ...activity.diagnostics,
      ...ambiguousDiagnostics(byCallId, "nativeCallId"),
      ...ambiguousDiagnostics(byNativeId, "nativeId"),
      ...conflictingItemDiagnostics(activity.events, byCallId, byNativeId)
    ]
  };
}

// src/shared/transcript/activity/types.ts
var ACTIVITY_SCHEMA_VERSION = 1;
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function recordLocator(detailed, jsonPointer) {
  const ordinal = numberValue(detailed.record.ordinal);
  return {
    recordIndex: detailed.recordIndex,
    physicalLine: detailed.physicalLine,
    jsonPointer,
    ...ordinal === void 0 ? {} : { ordinal }
  };
}
function eventKey(source, locator) {
  return `${source.runtime}:${source.nativeSessionId}:${locator.recordIndex}:${locator.jsonPointer}`;
}
function outcomeFromStatus(status) {
  if (typeof status !== "string") return "unknown";
  switch (status.toLowerCase()) {
    case "success":
    case "succeeded":
    case "completed":
      return "success";
    case "error":
    case "failed":
      return "error";
    case "aborted":
    case "cancelled":
    case "canceled":
    case "interrupted":
      return "cancelled";
    case "pending":
    case "started":
    case "running":
    case "in_progress":
    case "async_launched":
      return "pending";
    default:
      return "unknown";
  }
}

// src/shared/transcript/activity/claude-code.ts
function nonEmptyString(value) {
  const text = stringValue(value)?.trim();
  return text ? text : void 0;
}
function claudeSkillEvidence(record, nativeName, input) {
  const evidence = [];
  const attributed = nonEmptyString(record.attributionSkill);
  if (attributed) {
    evidence.push({ kind: "native-attribution", name: attributed });
  }
  if (nativeName === "Skill") {
    const structured = isJsonObject(input) ? input : void 0;
    const name = structured ? nonEmptyString(structured.skill) ?? nonEmptyString(structured.name) : void 0;
    evidence.push({
      kind: "native-invocation",
      ...name === void 0 ? {} : { name }
    });
  }
  return evidence.length === 0 ? void 0 : evidence;
}
function claudeSourceSkills(detailed) {
  const { record } = detailed;
  if (record.type !== "attachment" || !isJsonObject(record.attachment)) {
    return [];
  }
  const attachment = record.attachment;
  const type = stringValue(attachment.type);
  if (type === "skill_listing" && Array.isArray(attachment.names)) {
    return attachment.names.flatMap((candidate, index) => {
      const name = nonEmptyString(candidate);
      return name ? [
        {
          scope: "captured-source",
          evidence: "available",
          name,
          locator: recordLocator(detailed, `/attachment/names/${index}`)
        }
      ] : [];
    });
  }
  if (type === "invoked_skills" && Array.isArray(attachment.skills)) {
    return attachment.skills.flatMap((candidate, index) => {
      const name = isJsonObject(candidate) ? nonEmptyString(candidate.name) : void 0;
      return name ? [
        {
          scope: "captured-source",
          evidence: "invoked",
          name,
          locator: recordLocator(
            detailed,
            `/attachment/skills/${index}/name`
          )
        }
      ] : [];
    });
  }
  return [];
}
function claudeResultOutcome(block) {
  if (block.is_error === true) return "error";
  if (block.is_error === false) return "success";
  return "unknown";
}
function topLevelResultOutcome(toolUseResult) {
  if (!isJsonObject(toolUseResult)) return "unknown";
  if (toolUseResult.interrupted === true) return "cancelled";
  return outcomeFromStatus(toolUseResult.status);
}
function externalReference(toolUseResult) {
  if (!isJsonObject(toolUseResult)) return void 0;
  const path7 = stringValue(toolUseResult.persistedOutputPath);
  const size = numberValue(toolUseResult.persistedOutputSize);
  if (path7 === void 0 && size === void 0) return void 0;
  return {
    kind: "persisted-output",
    availability: "not-read",
    ...path7 === void 0 ? {} : { path: path7 },
    ...size === void 0 ? {} : { size }
  };
}
function childReference(toolUseResult) {
  if (!isJsonObject(toolUseResult)) return void 0;
  const nativeId = stringValue(toolUseResult.agentId);
  if (!nativeId) return void 0;
  const nickname = stringValue(toolUseResult.description);
  const status = stringValue(toolUseResult.status);
  return {
    nativeId,
    ...nickname === void 0 ? {} : { nickname },
    ...status === void 0 ? {} : { status },
    trajectoryAvailability: "not-read"
  };
}
function topLevelToolUseResultActivity(source, detailed, origin) {
  const { record } = detailed;
  if (!Object.hasOwn(record, "toolUseResult")) {
    return { events: [], coverage: [], diagnostics: [] };
  }
  const toolUseResult = record.toolUseResult;
  const locator = recordLocator(detailed, "/toolUseResult");
  const persisted = externalReference(toolUseResult);
  const child = childReference(toolUseResult);
  const status = isJsonObject(toolUseResult) ? toolUseResult.interrupted === true ? "interrupted" : stringValue(toolUseResult.status) : void 0;
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: "item",
        nativeType: "toolUseResult",
        locator,
        outcome: topLevelResultOutcome(toolUseResult),
        ...status === void 0 ? {} : { nativeStatus: status },
        ...origin === void 0 ? {} : { origin },
        result: toolUseResult,
        ...persisted === void 0 ? {} : { externalReference: persisted },
        ...child === void 0 ? {} : { childReference: child }
      }
    ],
    coverage: [
      ...persisted ? [
        {
          dataClass: "persisted-output",
          status: "not-read",
          captured: 1,
          locator
        }
      ] : [],
      ...child ? [
        {
          dataClass: "child-trajectory",
          status: "not-read",
          captured: 1,
          locator
        }
      ] : []
    ],
    diagnostics: []
  };
}
function selectedClaudeMetadata(record) {
  const message = isJsonObject(record.message) ? record.message : void 0;
  const model = message ? stringValue(message.model) : void 0;
  const effort = stringValue(record.effort);
  const perTurnEffort = stringValue(record.perTurnEffort);
  const timestamp3 = stringValue(record.timestamp);
  if (model === void 0 && effort === void 0 && perTurnEffort === void 0 && timestamp3 === void 0) {
    return void 0;
  }
  return {
    ...model === void 0 ? {} : { model },
    ...effort === void 0 ? {} : { effort },
    ...perTurnEffort === void 0 ? {} : { perTurnEffort },
    ...timestamp3 === void 0 ? {} : { timestamp: timestamp3 }
  };
}
function claudeSystemActivity(source, detailed) {
  const { record } = detailed;
  if (record.type !== "system") return void 0;
  const subtype = stringValue(record.subtype);
  if (subtype === "turn_duration") {
    const locator = recordLocator(detailed, "");
    const durationMs = numberValue(record.durationMs);
    const messageCount = numberValue(record.messageCount);
    const pendingBackgroundAgentCount = numberValue(
      record.pendingBackgroundAgentCount
    );
    return {
      eventKey: eventKey(source, locator),
      kind: "lifecycle",
      nativeType: subtype,
      locator,
      outcome: "unknown",
      metadata: {
        ...durationMs === void 0 ? {} : { durationMs },
        ...messageCount === void 0 ? {} : { messageCount },
        ...pendingBackgroundAgentCount === void 0 ? {} : { pendingBackgroundAgentCount }
      }
    };
  }
  if (subtype === "compact_boundary") {
    const locator = recordLocator(detailed, "");
    const compactMetadata = isJsonObject(record.compactMetadata) ? record.compactMetadata : void 0;
    const trigger = compactMetadata ? stringValue(compactMetadata.trigger) : void 0;
    const durationMs = compactMetadata ? numberValue(compactMetadata.durationMs) : void 0;
    return {
      eventKey: eventKey(source, locator),
      kind: "compaction",
      nativeType: subtype,
      locator,
      outcome: "unknown",
      metadata: {
        ...trigger === void 0 ? {} : { trigger },
        ...durationMs === void 0 ? {} : { durationMs }
      }
    };
  }
  return void 0;
}
function extractClaudeRecord(source, detailed) {
  const { record } = detailed;
  const events = [];
  const coverage2 = [];
  const message = isJsonObject(record.message) ? record.message : void 0;
  const content = message?.content;
  const provenance = claudeUserRecordProvenance(record);
  const systemActivity = claudeSystemActivity(source, detailed);
  const sourceSkills = claudeSourceSkills(detailed);
  const sourceSkillNamesRecorded = record.type === "attachment" && isJsonObject(record.attachment) && record.attachment.type === "skill_listing" && Array.isArray(record.attachment.names);
  if (systemActivity) events.push(systemActivity);
  if (record.type === "assistant") {
    const metadata = selectedClaudeMetadata(record);
    if (metadata) {
      const locator = recordLocator(detailed, "/message");
      events.push({
        eventKey: eventKey(source, locator),
        kind: "metadata",
        nativeType: "assistant-metadata",
        locator,
        outcome: "unknown",
        metadata,
        ...claudeSkillEvidence(record) === void 0 ? {} : { skillEvidence: claudeSkillEvidence(record) }
      });
    }
  }
  if (Array.isArray(content)) {
    content.forEach((candidate, blockIndex) => {
      if (!isJsonObject(candidate)) return;
      const blockType = stringValue(candidate.type);
      const locator = recordLocator(detailed, `/message/content/${blockIndex}`);
      if (blockType === "tool_use") {
        const nativeCallId = stringValue(candidate.id);
        const nativeName = stringValue(candidate.name);
        const input = Object.hasOwn(candidate, "input") ? candidate.input : void 0;
        const skillEvidence = claudeSkillEvidence(record, nativeName, input);
        events.push({
          eventKey: eventKey(source, locator),
          kind: "call",
          nativeType: blockType,
          locator,
          outcome: "pending",
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          ...nativeName === void 0 ? {} : { nativeName },
          ...input === void 0 ? {} : { arguments: input },
          ...skillEvidence === void 0 ? {} : { skillEvidence }
        });
        return;
      }
      if (blockType === "tool_result") {
        const nativeCallId = stringValue(candidate.tool_use_id);
        const result = Object.hasOwn(candidate, "content") ? { content: candidate.content } : {};
        events.push({
          eventKey: eventKey(source, locator),
          kind: "result",
          nativeType: blockType,
          locator,
          outcome: claudeResultOutcome(candidate),
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          result,
          ...provenance === "legacy-absent" ? {} : { origin: provenance }
        });
        return;
      }
      if (blockType?.includes("tool")) {
        coverage2.push({
          dataClass: "record-activity",
          status: "unsupported",
          captured: 0,
          locator
        });
      }
    });
  }
  const topLevelResult = topLevelToolUseResultActivity(
    source,
    detailed,
    provenance === "legacy-absent" ? void 0 : provenance
  );
  events.push(...topLevelResult.events);
  coverage2.push(...topLevelResult.coverage);
  if (provenance === "runtime-notification") {
    const locator = recordLocator(detailed, "/origin/kind");
    events.push({
      eventKey: eventKey(source, locator),
      kind: "notification",
      nativeType: "task-notification",
      locator,
      outcome: "unknown",
      origin: provenance
    });
  }
  return {
    events,
    coverage: coverage2,
    diagnostics: [],
    sourceSkills,
    ...sourceSkillNamesRecorded ? { sourceSkillNamesRecorded: true } : {}
  };
}

// src/shared/transcript/terminal-events.ts
var MONTH_INDEX = new Map(
  [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ].map((month, index) => [month.toLowerCase(), index])
);
var RETRY_SUFFIX = /try again at ((?:([A-Z][a-z]{2}) (\d{1,2})(st|nd|rd|th)?, (\d{4}) )?(\d{1,2}):(\d{2}) (AM|PM))\.$/iu;
function isJsonObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
}
function expectedOrdinal(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
function validCalendarDate(month, dayText, ordinal, yearText) {
  const monthIndex = MONTH_INDEX.get(month.toLowerCase());
  const day = Number(dayText);
  const year = Number(yearText);
  if (monthIndex === void 0 || !Number.isInteger(day) || day < 1) {
    return false;
  }
  if (ordinal && ordinal.toLowerCase() !== expectedOrdinal(day)) return false;
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex && date.getUTCDate() === day;
}
function codexRetryEvidenceFragment(message) {
  const match = RETRY_SUFFIX.exec(message);
  if (!match) return;
  const hour = Number(match[6]);
  const minute = Number(match[7]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return;
  if (match[2] !== void 0 && !validCalendarDate(match[2], match[3], match[4], match[5])) {
    return;
  }
  return match[1];
}
function decodeCodexLifecycleRecord(detailed) {
  const { record } = detailed;
  if (record.type !== "event_msg" || !isJsonObject2(record.payload)) return null;
  const payload = record.payload;
  const nativeType = stringValue2(payload.type);
  if (nativeType !== "task_started" && nativeType !== "task_complete" && nativeType !== "turn_aborted") {
    return null;
  }
  const error = isJsonObject2(payload.error) ? payload.error : void 0;
  const outcome = nativeType === "task_started" ? "pending" : nativeType === "turn_aborted" ? "cancelled" : error ? "error" : "success";
  return {
    nativeType,
    outcome,
    ...stringValue2(payload.turn_id) === void 0 ? {} : { turnId: stringValue2(payload.turn_id) },
    ...stringValue2(payload.status) === void 0 ? {} : { nativeStatus: stringValue2(payload.status) },
    ...error && stringValue2(error.codex_error_info) !== void 0 ? { errorInfo: stringValue2(error.codex_error_info) } : {},
    ...error && stringValue2(error.message) !== void 0 ? { errorMessage: stringValue2(error.message) } : {}
  };
}
function recordLocator2(detailed, jsonPointer) {
  return {
    indexBase: "zero-based-jsonl-record-index",
    recordIndex: detailed.recordIndex,
    physicalLine: detailed.physicalLine,
    jsonPointer
  };
}
function codexTerminalEvent(source, detailed) {
  const lifecycle = decodeCodexLifecycleRecord(detailed);
  if (lifecycle === null || lifecycle.nativeType === "task_complete" && lifecycle.outcome !== "error" || lifecycle.nativeType === "task_started") {
    return null;
  }
  const event = {
    type: "terminal",
    runtime: "codex",
    sessionId: source.sessionId,
    nativeSessionId: source.nativeSessionId,
    nativeType: lifecycle.nativeType,
    status: lifecycle.nativeType === "turn_aborted" ? "aborted" : "error",
    source: recordLocator2(detailed, "/payload"),
    ...lifecycle.errorInfo === void 0 ? {} : { nativeErrorCode: lifecycle.errorInfo }
  };
  if (lifecycle.nativeType === "task_complete" && lifecycle.errorInfo === "usage_limit_exceeded" && lifecycle.errorMessage !== void 0) {
    const fragment = codexRetryEvidenceFragment(lifecycle.errorMessage);
    if (fragment !== void 0) {
      event.retryEvidence = {
        fragment,
        provenance: "inferred-from-error-message",
        source: recordLocator2(detailed, "/payload/error/message")
      };
    }
  }
  return event;
}
function claudeAssistantStatus(record) {
  if (record.isApiErrorMessage === true) return "api-error";
  if (record.isAbortedMidStream === true) return "aborted-mid-stream";
  if (record.truncatedAfterOutput === true) return "truncated-after-output";
  return null;
}
function claudeSessionId(record) {
  return stringValue2(record.sessionId);
}
function claudeTerminalEvents(source) {
  const assistants = /* @__PURE__ */ new Map();
  const events = [];
  for (const detailed of source.read.records) {
    const { record } = detailed;
    if (claudeSessionId(record) !== source.sessionId) continue;
    const message = isJsonObject2(record.message) ? record.message : void 0;
    if (message?.role === "assistant") {
      const messageId = stringValue2(message.id);
      if (messageId) {
        const prior = assistants.get(messageId);
        assistants.set(messageId, {
          hasExplicitAbort: (prior?.hasExplicitAbort ?? false) || record.isAbortedMidStream === true
        });
      }
    }
    if (detailed.recordIndex < source.fromIndex || detailed.recordIndex >= source.nextIndex) {
      continue;
    }
    const status = claudeAssistantStatus(record);
    if (message?.role === "assistant" && status !== null) {
      const apiErrorStatus = record.apiErrorStatus;
      events.push({
        type: "terminal",
        runtime: "claude-code",
        sessionId: source.sessionId,
        nativeSessionId: source.nativeSessionId,
        nativeType: "assistant",
        status,
        source: recordLocator2(detailed, ""),
        ...status === "api-error" && typeof apiErrorStatus === "number" && Number.isFinite(apiErrorStatus) ? { nativeErrorCode: apiErrorStatus } : {}
      });
      continue;
    }
    if (message?.role !== "user") continue;
    const interruptedMessageId = stringValue2(record.interruptedMessageId);
    if (!interruptedMessageId) continue;
    const target = assistants.get(interruptedMessageId);
    if (!target || target.hasExplicitAbort) continue;
    events.push({
      type: "terminal",
      runtime: "claude-code",
      sessionId: source.sessionId,
      nativeSessionId: source.nativeSessionId,
      nativeType: "user-interruption",
      status: "interrupted",
      source: recordLocator2(detailed, "/interruptedMessageId")
    });
  }
  return events;
}
function extractRecordedTerminalEvents(source) {
  if (source.runtime === "claude-code") return claudeTerminalEvents(source);
  return source.read.records.flatMap((detailed) => {
    if (detailed.recordIndex < source.fromIndex || detailed.recordIndex >= source.nextIndex) {
      return [];
    }
    const event = codexTerminalEvent(source, detailed);
    return event ? [event] : [];
  });
}
function extractCursorTerminalEvents(source) {
  return source.analysis.turns.flatMap((turn) => {
    const frameIndex = turn.terminalFrameIndex;
    if (frameIndex === null || frameIndex < source.fromIndex || frameIndex >= source.nextIndex || !["error", "aborted", "cancelled"].includes(turn.lifecycle)) {
      return [];
    }
    return [
      {
        type: "terminal",
        runtime: "cursor",
        sessionId: source.sessionId,
        nativeSessionId: source.nativeSessionId,
        nativeType: "turn_ended",
        status: turn.lifecycle,
        source: {
          indexBase: "zero-based-jsonl-frame-index",
          frameIndex,
          physicalLine: frameIndex + 1,
          jsonPointer: "/status"
        }
      }
    ];
  });
}

// src/shared/transcript/activity/skill-evidence.ts
var CURSOR_DIRECT_READ_NAMES = /* @__PURE__ */ new Set(["Read", "ReadFile"]);
function skillNameFromPath(path7) {
  const segments = path7.split(/[\\/]/u);
  if (segments.at(-1) !== "SKILL.md") return void 0;
  const parent = segments.at(-2)?.trim();
  return parent ? parent : void 0;
}
function structuredSkillFileReadEvidence(runtime, nativeName, input) {
  const eligible = runtime === "codex" ? nativeName === "read_file" : nativeName !== void 0 && CURSOR_DIRECT_READ_NAMES.has(nativeName);
  if (!eligible) {
    return void 0;
  }
  if (!isJsonObject(input)) return void 0;
  const path7 = stringValue(
    runtime === "codex" ? input.file_path : input.path
  )?.trim();
  if (!path7 || !skillNameFromPath(path7)) return void 0;
  return {
    kind: "inferred-file-read",
    name: skillNameFromPath(path7),
    path: path7
  };
}

// src/shared/transcript/activity/codex.ts
var ITEM_ACTIVITY_TYPES = /* @__PURE__ */ new Set([
  "CollabAgentToolCall",
  "CommandExecution",
  "FileChange",
  "McpToolCall",
  "SubAgentActivity",
  "WebSearch"
]);
var ITEM_NON_ACTIVITY_TYPES = /* @__PURE__ */ new Set([
  "AgentMessage",
  "Extension",
  "ImageView",
  "Reasoning",
  "UserMessage"
]);
var CODEX_OUTPUT_CAPS = {
  stdout: 1048608,
  aggregated_output: 1048608,
  formatted_output: 40109
};
function codexCallArguments(nativeType, payload, locator) {
  const field = nativeType === "function_call" ? "arguments" : "input";
  if (!Object.hasOwn(payload, field)) {
    return { fields: {}, diagnostics: [] };
  }
  const originalArguments = payload[field];
  if (nativeType !== "function_call" || typeof originalArguments !== "string") {
    return {
      fields: { arguments: originalArguments, originalArguments },
      diagnostics: []
    };
  }
  try {
    const parsed = JSON.parse(originalArguments);
    if (!isJsonObject(parsed)) throw new Error("arguments are not an object");
    return {
      fields: { arguments: parsed, originalArguments },
      diagnostics: []
    };
  } catch {
    return {
      fields: { originalArguments },
      diagnostics: [
        {
          code: "ARGUMENT_PARSE_ERROR",
          locator,
          field
        }
      ]
    };
  }
}
function codexItemOutcome(item) {
  const statusOutcome = outcomeFromStatus(item.status);
  if (statusOutcome !== "unknown") return statusOutcome;
  const exitCode = numberValue(item.exit_code);
  if (exitCode === void 0) return "unknown";
  return exitCode === 0 ? "success" : "error";
}
function selectedCompactionMetadata(payload) {
  const fields = [
    "first_window_id",
    "previous_window_id",
    "window_id",
    "window_number"
  ];
  return Object.fromEntries(
    fields.flatMap(
      (field) => Object.hasOwn(payload, field) ? [[field, payload[field]]] : []
    )
  );
}
function selectedSessionMetadata(payload) {
  const cliVersion = stringValue(payload.cli_version);
  const modelProvider = stringValue(payload.model_provider);
  const nativeSessionId = stringValue(payload.id);
  const directParentMarkerPresent = Object.hasOwn(payload, "parent_thread_id");
  const directParentThreadId = stringValue(payload.parent_thread_id);
  const source = isJsonObject(payload.source) ? payload.source : void 0;
  const subagent = source && isJsonObject(source.subagent) ? source.subagent : void 0;
  const threadSpawn = subagent && isJsonObject(subagent.thread_spawn) ? subagent.thread_spawn : void 0;
  const nestedParentThreadId = threadSpawn ? stringValue(threadSpawn.parent_thread_id) : void 0;
  const nestedParentMarkerPresent = threadSpawn !== void 0 && Object.hasOwn(threadSpawn, "parent_thread_id");
  const subagentMarkerPresent = subagent !== void 0;
  const subagentHistoryStartOrdinalPresent = Object.hasOwn(
    payload,
    "subagent_history_start_ordinal"
  );
  const subagentHistoryStartOrdinal = numberValue(
    payload.subagent_history_start_ordinal
  );
  return {
    ...cliVersion === void 0 ? {} : { cliVersion },
    ...modelProvider === void 0 ? {} : { modelProvider },
    ...nativeSessionId === void 0 ? {} : { nativeSessionId },
    ...directParentThreadId === void 0 ? {} : { directParentThreadId },
    ...nestedParentThreadId === void 0 ? {} : { nestedParentThreadId },
    ...directParentMarkerPresent ? { directParentMarkerPresent: true } : {},
    ...nestedParentMarkerPresent ? { nestedParentMarkerPresent: true } : {},
    ...subagentMarkerPresent ? { subagentMarkerPresent: true } : {},
    ...subagentHistoryStartOrdinalPresent ? { subagentHistoryStartOrdinalPresent: true } : {},
    ...subagentHistoryStartOrdinal === void 0 ? {} : { subagentHistoryStartOrdinal }
  };
}
function selectedTurnMetadata(payload) {
  const model = stringValue(payload.model);
  const effort = stringValue(payload.effort);
  return {
    ...model === void 0 ? {} : { model },
    ...effort === void 0 ? {} : { effort }
  };
}
function selectedLifecycleMetadata(payload) {
  const fields = [
    "started_at",
    "completed_at",
    "duration_ms",
    "time_to_first_token_ms"
  ];
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = numberValue(payload[field]);
      return value === void 0 ? [] : [[field, value]];
    })
  );
}
function codexLifecycleActivity(source, detailed, payload) {
  const lifecycle = decodeCodexLifecycleRecord(detailed);
  if (!lifecycle) return void 0;
  const { nativeType, outcome, turnId, nativeStatus, errorInfo } = lifecycle;
  const locator = recordLocator(detailed, "/payload");
  const metadata = selectedLifecycleMetadata(payload);
  if (errorInfo !== void 0) metadata.errorInfo = errorInfo;
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: "lifecycle",
        nativeType,
        locator,
        outcome,
        ...turnId === void 0 ? {} : { turnId },
        ...nativeStatus === void 0 ? {} : { nativeStatus },
        ...Object.keys(metadata).length === 0 ? {} : { metadata }
      }
    ],
    coverage: [],
    diagnostics: []
  };
}
function outputCapDiagnostics(detailed, item, itemPointer) {
  return Object.entries(CODEX_OUTPUT_CAPS).flatMap(([field, cap]) => {
    const value = item[field];
    if (typeof value !== "string") return [];
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes !== cap) return [];
    return [
      {
        code: "POSSIBLE_SOURCE_TRUNCATION",
        locator: recordLocator(detailed, `${itemPointer}/${field}`),
        field,
        bytes
      }
    ];
  });
}
function responseItemActivity(source, detailed, payload) {
  const nativeType = stringValue(payload.type);
  const locator = recordLocator(detailed, "/payload");
  if (nativeType === "function_call" || nativeType === "custom_tool_call") {
    const nativeCallId = stringValue(payload.call_id);
    const nativeId = stringValue(payload.id);
    const nativeName = stringValue(payload.name);
    const nativeStatus = stringValue(payload.status);
    const argumentEvidence = codexCallArguments(nativeType, payload, locator);
    const skillEvidence = structuredSkillFileReadEvidence(
      "codex",
      nativeName,
      argumentEvidence.fields.arguments
    );
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "call",
          nativeType,
          locator,
          // custom_tool_call.status is a constant carrier value, not outcome.
          outcome: "pending",
          ...nativeId === void 0 ? {} : { nativeId },
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          ...nativeName === void 0 ? {} : { nativeName },
          ...nativeStatus === void 0 ? {} : { nativeStatus },
          ...Object.hasOwn(payload, "namespace") ? { metadata: { namespace: payload.namespace } } : {},
          ...argumentEvidence.fields,
          ...skillEvidence === void 0 ? {} : { skillEvidence: [skillEvidence] }
        }
      ],
      coverage: [],
      diagnostics: argumentEvidence.diagnostics
    };
  }
  if (nativeType === "function_call_output" || nativeType === "custom_tool_call_output") {
    const nativeCallId = stringValue(payload.call_id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "result",
          nativeType,
          locator,
          outcome: "unknown",
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          ...Object.hasOwn(payload, "output") ? { result: payload.output } : {}
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (nativeType === "web_search_call") {
    const nativeId = stringValue(payload.id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "call",
          nativeType,
          locator,
          outcome: "pending",
          nativeName: "web_search",
          ...nativeId === void 0 ? {} : { nativeId },
          ...Object.hasOwn(payload, "query") ? { arguments: payload.query } : {}
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (nativeType === "message" || nativeType === "reasoning") {
    return { events: [], coverage: [], diagnostics: [] };
  }
  return {
    events: [],
    coverage: [
      {
        dataClass: "record-activity",
        status: "unsupported",
        captured: 0,
        locator
      }
    ],
    diagnostics: []
  };
}
function itemCompletedActivity(source, detailed, payload) {
  const item = isJsonObject(payload.item) ? payload.item : void 0;
  const locator = recordLocator(detailed, "/payload/item");
  if (!item) {
    return {
      events: [],
      coverage: [
        {
          dataClass: "items",
          status: "unsupported",
          captured: 0,
          locator
        }
      ],
      diagnostics: []
    };
  }
  const nativeType = stringValue(item.type);
  if (nativeType === "ContextCompaction") {
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "compaction",
          nativeType,
          locator,
          outcome: "unknown",
          metadata: selectedCompactionMetadata(item)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (!nativeType || ITEM_NON_ACTIVITY_TYPES.has(nativeType)) {
    return { events: [], coverage: [], diagnostics: [] };
  }
  if (!ITEM_ACTIVITY_TYPES.has(nativeType)) {
    return {
      events: [],
      coverage: [
        {
          dataClass: "items",
          status: "unsupported",
          captured: 0,
          locator
        }
      ],
      diagnostics: []
    };
  }
  const nativeId = stringValue(item.id);
  const nativeCallId = stringValue(item.call_id);
  const nativeStatus = stringValue(item.status);
  const turnId = stringValue(payload.turn_id);
  const childNativeId = stringValue(item.agent_thread_id);
  const childNickname = stringValue(item.agent_nickname);
  const childReference2 = childNativeId ? {
    nativeId: childNativeId,
    ...childNickname === void 0 ? {} : { nickname: childNickname },
    ...nativeStatus === void 0 ? {} : { status: nativeStatus },
    trajectoryAvailability: "not-read"
  } : void 0;
  const coverage2 = childReference2 ? [
    {
      dataClass: "child-trajectory",
      status: "not-read",
      captured: 1,
      locator
    }
  ] : [];
  const diagnostics = outputCapDiagnostics(detailed, item, "/payload/item");
  if (diagnostics.length > 0) {
    coverage2.push(
      ...diagnostics.map((diagnostic) => ({
        dataClass: "items",
        status: "truncated",
        captured: 1,
        locator: diagnostic.locator
      }))
    );
  }
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: "item",
        nativeType,
        locator,
        outcome: codexItemOutcome(item),
        ...nativeId === void 0 ? {} : { nativeId },
        ...nativeCallId === void 0 ? {} : { nativeCallId },
        ...nativeStatus === void 0 ? {} : { nativeStatus },
        ...turnId === void 0 ? {} : { turnId },
        nativeValue: item,
        ...childReference2 === void 0 ? {} : { childReference: childReference2 }
      }
    ],
    coverage: coverage2,
    diagnostics
  };
}
function extractCodexRecord(source, detailed) {
  const { record } = detailed;
  const payload = isJsonObject(record.payload) ? record.payload : void 0;
  if (record.type === "response_item" && payload) {
    return responseItemActivity(source, detailed, payload);
  }
  if (record.type === "event_msg" && payload) {
    if (payload.type === "item_completed") {
      return itemCompletedActivity(source, detailed, payload);
    }
    if (payload.type === "web_search_call") {
      return responseItemActivity(source, detailed, payload);
    }
    const lifecycle = codexLifecycleActivity(source, detailed, payload);
    if (lifecycle) return lifecycle;
    return { events: [], coverage: [], diagnostics: [] };
  }
  if (record.type === "session_meta" && payload) {
    const locator = recordLocator(detailed, "/payload");
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "metadata",
          nativeType: "session_meta",
          locator,
          outcome: "unknown",
          metadata: selectedSessionMetadata(payload)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (record.type === "turn_context" && payload) {
    const locator = recordLocator(detailed, "/payload");
    const turnId = stringValue(payload.turn_id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "metadata",
          nativeType: "turn_context",
          locator,
          outcome: "unknown",
          ...turnId === void 0 ? {} : { turnId },
          metadata: selectedTurnMetadata(payload)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (record.type === "compacted" && payload) {
    const locator = recordLocator(detailed, "/payload");
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "compaction",
          nativeType: "compacted",
          locator,
          outcome: "unknown",
          metadata: selectedCompactionMetadata(payload)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  return { events: [], coverage: [], diagnostics: [] };
}

// src/shared/transcript/activity/usage.ts
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isJsonObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)])
  );
}
function signature(value) {
  return JSON.stringify(stableValue(value));
}
function tokenFields(value) {
  if (!isJsonObject(value)) return void 0;
  const entries = [];
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item) && /token/iu.test(key)) {
      entries.push([key, item]);
      continue;
    }
    const nested = tokenFields(item);
    if (nested && Object.keys(nested).length > 0) entries.push([key, nested]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : void 0;
}
function claudeRecordSessionId(record) {
  const message = isJsonObject(record.message) ? record.message : void 0;
  return stringValue(record.sessionId) ?? stringValue(record.session_id) ?? stringValue(record.sessionID) ?? (message ? stringValue(message.sessionId) : void 0) ?? (message ? stringValue(message.session_id) : void 0);
}
function claudeUsage(source, records) {
  const samples = [];
  const diagnostics = [];
  const byMessage = /* @__PURE__ */ new Map();
  for (const detailed of records) {
    const { record } = detailed;
    if (record.type !== "assistant" || !isJsonObject(record.message)) continue;
    const message = record.message;
    const tokens = tokenFields(message.usage);
    if (!tokens) continue;
    const locator = recordLocator(detailed, "/message/usage");
    const recordedSessionId = claudeRecordSessionId(record);
    if (recordedSessionId !== void 0 && recordedSessionId !== source.nativeSessionId) {
      diagnostics.push({ code: "USAGE_SESSION_MISMATCH", locator });
      continue;
    }
    const messageId = stringValue(message.id)?.trim() || void 0;
    const model = stringValue(message.model)?.trim() || void 0;
    const sample = {
      semantics: "claude-message",
      ownership: "owned",
      locator,
      tokens,
      ...model === void 0 ? {} : { model },
      ...messageId === void 0 ? { uncertainty: "missing-message-id" } : { messageId }
    };
    if (messageId === void 0) {
      samples.push(sample);
      diagnostics.push({ code: "USAGE_DEDUP_UNCERTAIN", locator });
      continue;
    }
    const key = `${source.nativeSessionId}:${messageId}`;
    const sampleSignature = signature({ tokens, model });
    const prior = byMessage.get(key);
    if (!prior) {
      byMessage.set(key, { signature: sampleSignature, sample });
      samples.push(sample);
      continue;
    }
    if (prior.signature !== sampleSignature) {
      diagnostics.push({ code: "USAGE_CONFLICT", locator, messageId });
    }
  }
  return {
    scope: "captured-source",
    availability: samples.length > 0 ? "recorded" : "not-recorded",
    samples,
    diagnostics
  };
}
function codexUsage(source, records, events) {
  const samples = [];
  const diagnostics = [];
  const ownershipContext = activityOwnershipContext(source, events);
  const turnModels = /* @__PURE__ */ new Map();
  for (const detailed of records) {
    const { record } = detailed;
    if (record.type !== "turn_context" || !isJsonObject(record.payload))
      continue;
    const turnId = stringValue(record.payload.turn_id);
    const model = stringValue(record.payload.model);
    if (turnId && model) {
      const ownership = ownershipForLocator(
        recordLocator(detailed, "/payload"),
        ownershipContext
      );
      turnModels.set(`${ownership}:${turnId}`, model);
    }
  }
  const counterStates = /* @__PURE__ */ new Map();
  const responses = /* @__PURE__ */ new Map();
  for (const detailed of records) {
    const { record } = detailed;
    const payload = isJsonObject(record.payload) ? record.payload : void 0;
    if (record.type === "event_msg" && payload?.type === "token_count") {
      const info = isJsonObject(payload.info) ? payload.info : void 0;
      if (!info) continue;
      const total = tokenFields(info.total_token_usage);
      const last = tokenFields(info.last_token_usage);
      if (!total && !last) continue;
      const totalLocator = recordLocator(
        detailed,
        "/payload/info/total_token_usage"
      );
      const ownership2 = ownershipForLocator(totalLocator, ownershipContext);
      const state = counterStates.get(ownership2) ?? { segment: 0 };
      const snapshot = signature({ total, last });
      if (snapshot === state.previousSnapshot) continue;
      state.previousSnapshot = snapshot;
      const totalTokens = total ? numberValue(total.total_tokens) : void 0;
      if (totalTokens !== void 0 && state.previousTotal !== void 0 && totalTokens < state.previousTotal) {
        state.segment += 1;
        diagnostics.push({
          code: "USAGE_COUNTER_RESET",
          locator: totalLocator
        });
      }
      if (totalTokens !== void 0) state.previousTotal = totalTokens;
      counterStates.set(ownership2, state);
      if (total) {
        samples.push({
          semantics: "codex-cumulative",
          ownership: ownership2,
          locator: totalLocator,
          tokens: total,
          segment: state.segment
        });
      }
      if (last) {
        samples.push({
          semantics: "codex-last-turn",
          ownership: ownership2,
          locator: recordLocator(detailed, "/payload/info/last_token_usage"),
          tokens: last,
          segment: state.segment
        });
      }
      continue;
    }
    if (record.type !== "token_usage_record" || !payload) continue;
    const recordedThreadId = stringValue(payload.thread_id);
    const locator = recordLocator(detailed, "/payload");
    if (recordedThreadId !== void 0 && recordedThreadId !== source.nativeSessionId) {
      diagnostics.push({ code: "USAGE_SESSION_MISMATCH", locator });
      continue;
    }
    const usage = tokenFields(payload.usage);
    const turnUsage = tokenFields(payload.turn_token_usage);
    const threadUsage = tokenFields(payload.thread_token_usage);
    if (!usage && !turnUsage && !threadUsage) continue;
    const tokens = {
      ...usage === void 0 ? {} : { usage },
      ...turnUsage === void 0 ? {} : { turn_token_usage: turnUsage },
      ...threadUsage === void 0 ? {} : { thread_token_usage: threadUsage }
    };
    const responseId = stringValue(payload.response_id)?.trim() || void 0;
    const turnId = stringValue(payload.turn_id)?.trim() || void 0;
    const sampleSignature = signature(tokens);
    if (responseId !== void 0) {
      const prior = responses.get(responseId);
      if (prior === sampleSignature) continue;
      if (prior !== void 0) {
        diagnostics.push({ code: "USAGE_CONFLICT", locator });
        continue;
      }
      responses.set(responseId, sampleSignature);
    }
    const ownership = ownershipForLocator(locator, ownershipContext);
    const model = turnId ? turnModels.get(`${ownership}:${turnId}`) : void 0;
    samples.push({
      semantics: "codex-response",
      ownership,
      locator,
      tokens,
      ...model === void 0 ? {} : { model },
      ...turnId === void 0 ? {} : { turnId },
      ...responseId === void 0 ? {} : { responseId }
    });
  }
  return {
    scope: "captured-source",
    availability: samples.length > 0 ? "recorded" : "not-recorded",
    samples,
    diagnostics
  };
}
function extractUsageMetadata(source, records, events = []) {
  return source.runtime === "claude-code" ? claudeUsage(source, records) : codexUsage(source, records, events);
}
function notRecordedUsage() {
  return {
    scope: "captured-source",
    availability: "not-recorded",
    samples: [],
    diagnostics: []
  };
}

// src/shared/transcript/activity/extract.ts
function validateInput(input) {
  const { source } = input;
  if (!source.sessionId || !source.nativeSessionId || !source.transcriptPath) {
    throw new Error("Activity extraction requires an exact selected source");
  }
  if (source.runtime !== "claude-code" && source.runtime !== "codex") {
    throw new Error(`Unsupported activity runtime: ${String(source.runtime)}`);
  }
}
function sourceDiagnosticCode(kind) {
  switch (kind) {
    case "malformed":
      return "SOURCE_MALFORMED_RECORD";
    case "not-object":
      return "SOURCE_NOT_OBJECT";
    case "partial-tail":
      return "SOURCE_PARTIAL_TAIL";
  }
}
function baseCoverage(events) {
  const count = (dataClass) => {
    switch (dataClass) {
      case "calls":
        return events.filter((event) => event.kind === "call").length;
      case "results":
        return events.filter((event) => event.kind === "result").length;
      case "items":
        return events.filter((event) => event.kind === "item").length;
      case "metadata":
        return events.filter(
          (event) => ["metadata", "notification", "lifecycle", "compaction"].includes(
            event.kind
          )
        ).length;
      default:
        return 0;
    }
  };
  return ["calls", "results", "items", "metadata"].map(
    (dataClass) => ({
      dataClass,
      status: "available",
      captured: count(dataClass)
    })
  );
}
function extractionFailure(locator) {
  return {
    events: [],
    diagnostics: [{ code: "ACTIVITY_EXTRACTION_ERROR", locator }],
    coverage: [
      {
        dataClass: "record-activity",
        status: "not-read",
        captured: 0,
        locator
      }
    ]
  };
}
function extractActivity(input) {
  validateInput(input);
  const events = [];
  const coverage2 = [];
  const diagnostics = [];
  const sourceSkills = [];
  let sourceSkillNamesRecorded = false;
  let usage = notRecordedUsage();
  for (const sourceDiagnostic of input.read.diagnostics) {
    const locator = {
      physicalLine: sourceDiagnostic.physicalLine,
      jsonPointer: ""
    };
    diagnostics.push({
      code: sourceDiagnosticCode(sourceDiagnostic.kind),
      locator
    });
    coverage2.push({
      dataClass: "record-activity",
      status: "malformed",
      captured: 0,
      locator
    });
  }
  for (const detailed of input.read.records) {
    let extracted;
    try {
      extracted = input.source.runtime === "claude-code" ? extractClaudeRecord(input.source, detailed) : extractCodexRecord(input.source, detailed);
    } catch {
      extracted = extractionFailure({
        recordIndex: detailed.recordIndex,
        physicalLine: detailed.physicalLine,
        jsonPointer: ""
      });
    }
    events.push(...extracted.events);
    coverage2.push(...extracted.coverage);
    diagnostics.push(...extracted.diagnostics);
    sourceSkills.push(...extracted.sourceSkills ?? []);
    sourceSkillNamesRecorded ||= extracted.sourceSkillNamesRecorded === true;
  }
  const latestAvailableSkill = /* @__PURE__ */ new Map();
  for (const skill of sourceSkills) {
    if (skill.evidence === "available")
      latestAvailableSkill.set(skill.name, skill);
  }
  const deduplicatedSourceSkills = sourceSkills.filter(
    (skill) => skill.evidence === "invoked" || latestAvailableSkill.get(skill.name) === skill
  );
  try {
    usage = extractUsageMetadata(input.source, input.read.records, events);
  } catch {
    usage = notRecordedUsage();
  }
  return {
    activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
    source: input.source,
    sourceSnapshot: {
      capturedAt: input.read.capturedAt,
      sourceBytes: input.read.sourceBytes
    },
    events,
    diagnostics,
    sourceMetadata: {
      scope: "captured-source",
      skills: deduplicatedSourceSkills,
      usage
    },
    coverage: [
      ...baseCoverage(events),
      ...coverage2,
      {
        dataClass: "source-skill-names",
        status: sourceSkillNamesRecorded ? "available" : "not-recorded",
        captured: deduplicatedSourceSkills.filter(
          (skill) => skill.evidence === "available"
        ).length
      }
    ]
  };
}

// src/shared/transcript/activity/render.ts
function stableJsonValue(value, seen) {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item, seen));
  }
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  const result = Object.fromEntries(
    Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableJsonValue(item, seen)])
  );
  seen.delete(value);
  return result;
}
function stableActivityStringify(value) {
  if (value === void 0) return "undefined";
  return JSON.stringify(stableJsonValue(value, /* @__PURE__ */ new Set()));
}
function renderActivityReport(report) {
  return stableActivityStringify(report);
}
function markdownData(value) {
  return stableActivityStringify(value).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("`", "\\u0060").replaceAll("[", "\\u005b").replaceAll("]", "\\u005d").replaceAll("(", "\\u0028").replaceAll(")", "\\u0029").replaceAll("*", "\\u002a").replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, "\\u005f").replaceAll("~", "\\u007e");
}
function locatorText(locator) {
  if (!locator) return "source-wide";
  if (locator.sourceFrameIndex !== void 0) {
    const delivery = locator.deliveryFrameIndex === void 0 ? "" : `, delivery frame ${locator.deliveryFrameIndex}`;
    return `source frame ${locator.sourceFrameIndex}${delivery}, line ${locator.physicalLine}, pointer ${locator.jsonPointer || "/"}`;
  }
  const record = locator.recordIndex === void 0 ? "" : `, record ${locator.recordIndex}`;
  return `line ${locator.physicalLine}${record}, pointer ${locator.jsonPointer || "/"}`;
}
function previewLine(label, preview2) {
  if (!preview2) return [];
  const clipped = preview2.truncated ? `; clipped ${preview2.displayedBytes}/${preview2.sourceBytes} bytes` : `; ${preview2.displayedBytes} bytes`;
  return [`  - ${label}${clipped}: ${markdownData(preview2.text)}`];
}
function eventLines(event) {
  const identity = event.nativeName ?? event.nativeType;
  const source = locatorText(event.locator);
  const relation = event.relatedCallKey ? `; related call ${markdownData(event.relatedCallKey)}` : "";
  const evidence = Object.fromEntries(
    Object.entries({
      nativeType: event.nativeName === void 0 ? void 0 : event.nativeType,
      category: event.category,
      nativeId: event.nativeId,
      nativeCallId: event.nativeCallId,
      nativeStatus: event.nativeStatus,
      origin: event.origin,
      turnId: event.turnId,
      lifecycleAvailability: event.lifecycleAvailability,
      turnOutcome: event.turnOutcome,
      externalReference: event.externalReference,
      childReference: event.childReference,
      skillEvidence: event.skillEvidence
    }).filter(([, value]) => value !== void 0)
  );
  return [
    `- ${event.kind} ${markdownData(identity)}; ${event.outcome}; ${event.ownership}; ${source}${relation}`,
    ...Object.keys(evidence).length === 0 ? [] : [`  - native evidence: ${markdownData(evidence)}`],
    ...previewLine("input", event.inputPreview),
    ...previewLine("original input", event.originalInputPreview),
    ...previewLine("output", event.outputPreview),
    ...previewLine("metadata", event.metadataPreview),
    ...event.outputPreviewOmitted ? [`  - output preview: ${event.outputPreviewOmitted}`] : []
  ];
}
function countLine(counts) {
  return `- ${counts.scope}: calls ${counts.calls}; counted invocations ${counts.countedInvocations}; pending lifecycle ${counts.pendingLifecycleCalls}; results ${counts.results}; items ${counts.items}; failures ${counts.failures}`;
}
function renderActivityMarkdown(report) {
  const lines = [
    "## Activity",
    "",
    `- Schema: ${report.activitySchemaVersion}`,
    `- Mode: ${report.mode}`,
    `- Budgeted format: ${report.renderedFormat}`,
    `- Runtime: ${report.source.runtime}`,
    `- Native session: ${markdownData(report.source.nativeSessionId)}`,
    `- Source: ${markdownData(report.source.transcriptPath)}`,
    `- Source snapshot: ${report.sourceSnapshot.sourceBytes} bytes captured at ${report.sourceSnapshot.capturedAt}`,
    `- Delivery range: [${report.deliveryRange.start}, ${report.deliveryRange.end}) ${report.deliveryRange.indexBase}`,
    `- Activity bytes: ${report.renderedBytes}/${report.limits.maxBytes}; preview cap: ${report.limits.previewBytes}; late context cap: ${report.limits.lateContextBytes}`,
    countLine(report.counts.capturedSource),
    countLine(report.counts.deliveredRange),
    countLine(report.counts.displayed),
    `- Omitted evidence: calls ${report.omitted.calls}; results ${report.omitted.results}; failures ${report.omitted.failures}`,
    `- Omitted groups: invocation limit ${report.omitted.invocationLimitGroups}; byte limit ${report.omitted.byteLimitGroups}`,
    `- Omitted metadata: coverage ${report.omitted.coverageEntries}; diagnostics ${report.omitted.diagnostics}`,
    `- Source metadata: ${report.sourceMetadata.scope}; skills ${report.sourceMetadata.skills.length}; omitted skills ${report.omitted.sourceSkills}`,
    `- Token usage: ${report.sourceMetadata.usage?.availability ?? "not-recorded"}; samples ${report.sourceMetadata.usage?.samples.length ?? 0}; diagnostics ${report.sourceMetadata.usage?.diagnostics.length ?? 0}; omitted samples ${report.omitted.usageSamples}; omitted diagnostics ${report.omitted.usageDiagnostics}`,
    "",
    "### Events",
    "",
    ...report.events.length === 0 ? ["- None in the displayed range."] : report.events.flatMap(eventLines)
  ];
  if (report.callContexts.length > 0) {
    lines.push("", "### Earlier call context", "");
    for (const context of report.callContexts) {
      lines.push(
        `- ${markdownData(context.nativeName ?? context.callKey)}; ${context.availability}; ${locatorText(context.locator)}`,
        ...previewLine("input context", context.inputPreview),
        ...previewLine("original input context", context.originalInputPreview)
      );
    }
  }
  if (report.coverage.length > 0) {
    lines.push("", "### Coverage", "");
    for (const coverage2 of report.coverage) {
      lines.push(
        `- ${coverage2.dataClass}: ${coverage2.status}; captured ${coverage2.captured}; ${locatorText(coverage2.locator)}`
      );
    }
  }
  if (report.diagnostics.length > 0) {
    lines.push("", "### Diagnostics", "");
    for (const diagnostic of report.diagnostics) {
      const details = Object.fromEntries(
        Object.entries({
          field: diagnostic.field,
          bytes: diagnostic.bytes,
          nativeId: diagnostic.nativeId
        }).filter(([, value]) => value !== void 0)
      );
      lines.push(
        `- ${diagnostic.code}; ${locatorText(diagnostic.locator)}${Object.keys(details).length === 0 ? "" : `; ${markdownData(details)}`}`
      );
    }
  }
  if (report.sourceMetadata.skills.length > 0) {
    lines.push("", "### Captured-source skills", "");
    for (const skill of report.sourceMetadata.skills) {
      lines.push(
        `- ${skill.evidence}: ${markdownData(skill.name)}; ${locatorText(skill.locator)}`
      );
    }
  }
  const usage = report.sourceMetadata.usage;
  if (usage && usage.samples.length > 0) {
    lines.push("", "### Captured-source token usage", "");
    for (const sample of usage.samples) {
      const identity = Object.fromEntries(
        Object.entries({
          ownership: sample.ownership,
          model: sample.model,
          messageId: sample.messageId,
          turnId: sample.turnId,
          responseId: sample.responseId,
          segment: sample.segment,
          uncertainty: sample.uncertainty
        }).filter(([, value]) => value !== void 0)
      );
      lines.push(
        `- ${sample.semantics}; ${locatorText(sample.locator)}${Object.keys(identity).length === 0 ? "" : `; ${markdownData(identity)}`}`,
        `  - tokens: ${markdownData(sample.tokens)}`
      );
    }
  }
  if (usage && usage.diagnostics.length > 0) {
    lines.push("", "### Token usage diagnostics", "");
    for (const diagnostic of usage.diagnostics) {
      lines.push(
        `- ${diagnostic.code}; ${locatorText(diagnostic.locator)}${diagnostic.messageId === void 0 ? "" : `; message ${markdownData(diagnostic.messageId)}`}`
      );
    }
  }
  return `${lines.join("\n")}
`;
}

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
function inRange(event, range) {
  return event.locator.recordIndex >= range.start && event.locator.recordIndex < range.end;
}
function validateRange(range) {
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start) {
    throw new Error("Activity delivery range must be a valid half-open range");
  }
}
function validateLimits(limits) {
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes <= 0 || limits.maxInvocations !== null && (!Number.isSafeInteger(limits.maxInvocations) || limits.maxInvocations < 0) || !Number.isSafeInteger(limits.previewBytes) || limits.previewBytes <= 0 || !Number.isSafeInteger(limits.lateContextBytes) || limits.lateContextBytes <= 0) {
    throw new Error("Activity projection limits must be positive integers");
  }
}
function clipUtf8(text, maxBytes) {
  const sourceBytes = Buffer.byteLength(text, "utf8");
  if (sourceBytes <= maxBytes) {
    return {
      text,
      sourceBytes,
      displayedBytes: sourceBytes,
      truncated: false
    };
  }
  let displayed = "";
  let displayedBytes = 0;
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (displayedBytes + characterBytes > maxBytes) break;
    displayed += character;
    displayedBytes += characterBytes;
  }
  return {
    text: displayed,
    sourceBytes,
    displayedBytes,
    truncated: true
  };
}
function preview(value, maxBytes) {
  return clipUtf8(stableActivityStringify(value), maxBytes);
}
function compareChronology(left, right) {
  return left.locator.recordIndex - right.locator.recordIndex || left.locator.jsonPointer.localeCompare(right.locator.jsonPointer) || left.eventKey.localeCompare(right.eventKey);
}
function compareHighPriority(left, right) {
  return Number(right.failure) - Number(left.failure) || right.recency - left.recency || left.key.localeCompare(right.key);
}
function compareLowPriority(left, right) {
  return Number(left.failure) - Number(right.failure) || left.recency - right.recency || right.key.localeCompare(left.key);
}
function buildGroups(activity) {
  const calls = new Map(
    activity.events.filter((event) => event.kind === "call").map((event) => [event.eventKey, event])
  );
  const grouped = /* @__PURE__ */ new Map();
  for (const event of activity.events) {
    const key = event.kind === "call" ? event.eventKey : event.relatedCallKey ?? event.eventKey;
    const events = grouped.get(key) ?? [];
    events.push(event);
    grouped.set(key, events);
  }
  return [...grouped.entries()].map(([key, events]) => {
    const call = calls.get(key);
    return {
      key,
      events: events.toSorted(compareChronology),
      ...call === void 0 ? {} : { call },
      displayedInvocation: call !== void 0,
      failure: events.some(
        (event) => event.outcome === "error" || event.outcome === "cancelled"
      ),
      recency: Math.max(...events.map((event) => event.locator.recordIndex))
    };
  });
}
function deliveredGroups(activity, range) {
  return buildGroups(activity).flatMap((group) => {
    const events = group.events.filter((event) => inRange(event, range));
    if (events.length === 0) return [];
    const deliveredCall = events.find((event) => event.kind === "call");
    return [
      {
        ...group,
        events,
        displayedInvocation: deliveredCall !== void 0,
        failure: events.some(
          (event) => event.outcome === "error" || event.outcome === "cancelled"
        ),
        recency: Math.max(...events.map((event) => event.locator.recordIndex))
      }
    ];
  });
}
function deliveredMetadata(activity, range) {
  const locatorInRange = (locator) => {
    const index = locator?.recordIndex;
    return index === void 0 || index >= range.start && index < range.end;
  };
  return {
    coverage: activity.coverage.filter(
      (entry) => locatorInRange(entry.locator)
    ),
    diagnostics: activity.diagnostics.filter(
      (entry) => locatorInRange(entry.locator)
    ),
    sourceSkills: activity.sourceMetadata?.skills ?? [],
    usage: activity.sourceMetadata?.usage ?? {
      scope: "captured-source",
      availability: "not-recorded",
      samples: [],
      diagnostics: []
    }
  };
}
function compareMetadataPriority(left, right) {
  return (right.locator?.recordIndex ?? -1) - (left.locator?.recordIndex ?? -1) || (right.locator?.physicalLine ?? -1) - (left.locator?.physicalLine ?? -1) || Number(right.kind === "diagnostics") - Number(left.kind === "diagnostics") || left.index - right.index;
}
function retainMetadata(metadata, retainedCount) {
  const priority = [
    ...metadata.coverage.map(
      (entry, index) => ({
        kind: "coverage",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.diagnostics.map(
      (entry, index) => ({
        kind: "diagnostics",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.sourceSkills.map(
      (entry, index) => ({
        kind: "sourceSkills",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.usage.samples.map(
      (entry, index) => ({
        kind: "usageSamples",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.usage.diagnostics.map(
      (entry, index) => ({
        kind: "usageDiagnostics",
        index,
        locator: entry.locator
      })
    )
  ].toSorted(compareMetadataPriority);
  const retainedCoverage = /* @__PURE__ */ new Set();
  const retainedDiagnostics = /* @__PURE__ */ new Set();
  const retainedSourceSkills = /* @__PURE__ */ new Set();
  const retainedUsageSamples = /* @__PURE__ */ new Set();
  const retainedUsageDiagnostics = /* @__PURE__ */ new Set();
  for (const candidate of priority.slice(0, retainedCount)) {
    let target = retainedUsageDiagnostics;
    switch (candidate.kind) {
      case "coverage":
        target = retainedCoverage;
        break;
      case "diagnostics":
        target = retainedDiagnostics;
        break;
      case "sourceSkills":
        target = retainedSourceSkills;
        break;
      case "usageSamples":
        target = retainedUsageSamples;
        break;
      case "usageDiagnostics":
        target = retainedUsageDiagnostics;
        break;
    }
    target.add(candidate.index);
  }
  return {
    coverage: metadata.coverage.filter(
      (_, index) => retainedCoverage.has(index)
    ),
    diagnostics: metadata.diagnostics.filter(
      (_, index) => retainedDiagnostics.has(index)
    ),
    sourceSkills: metadata.sourceSkills.filter(
      (_, index) => retainedSourceSkills.has(index)
    ),
    usage: {
      ...metadata.usage,
      samples: metadata.usage.samples.filter(
        (_, index) => retainedUsageSamples.has(index)
      ),
      diagnostics: metadata.usage.diagnostics.filter(
        (_, index) => retainedUsageDiagnostics.has(index)
      )
    }
  };
}
function retainOptionalSourceMetadata(metadata, retainedCount) {
  const priority = [
    ...metadata.sourceSkills.map(
      (entry, index) => ({
        kind: "sourceSkills",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.usage.samples.map(
      (entry, index) => ({
        kind: "usageSamples",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.usage.diagnostics.map(
      (entry, index) => ({
        kind: "usageDiagnostics",
        index,
        locator: entry.locator
      })
    )
  ].toSorted(compareMetadataPriority);
  const retainedSourceSkills = /* @__PURE__ */ new Set();
  const retainedUsageSamples = /* @__PURE__ */ new Set();
  const retainedUsageDiagnostics = /* @__PURE__ */ new Set();
  for (const candidate of priority.slice(0, retainedCount)) {
    const target = candidate.kind === "sourceSkills" ? retainedSourceSkills : candidate.kind === "usageSamples" ? retainedUsageSamples : retainedUsageDiagnostics;
    target.add(candidate.index);
  }
  return {
    coverage: metadata.coverage,
    diagnostics: metadata.diagnostics,
    sourceSkills: metadata.sourceSkills.filter(
      (_, index) => retainedSourceSkills.has(index)
    ),
    usage: {
      ...metadata.usage,
      samples: metadata.usage.samples.filter(
        (_, index) => retainedUsageSamples.has(index)
      ),
      diagnostics: metadata.usage.diagnostics.filter(
        (_, index) => retainedUsageDiagnostics.has(index)
      )
    }
  };
}
function projectEvent(event, limits, suppressLinkedItemOutput) {
  return {
    eventKey: event.eventKey,
    kind: event.kind,
    nativeType: event.nativeType,
    locator: event.locator,
    outcome: event.outcome,
    ownership: event.ownership,
    ...event.category === void 0 ? {} : { category: event.category },
    ...event.relatedCallKey === void 0 ? {} : { relatedCallKey: event.relatedCallKey },
    ...event.nativeId === void 0 ? {} : { nativeId: event.nativeId },
    ...event.nativeCallId === void 0 ? {} : { nativeCallId: event.nativeCallId },
    ...event.nativeName === void 0 ? {} : { nativeName: event.nativeName },
    ...event.nativeStatus === void 0 ? {} : { nativeStatus: event.nativeStatus },
    ...event.origin === void 0 ? {} : { origin: event.origin },
    ...event.turnId === void 0 ? {} : { turnId: event.turnId },
    ...event.lifecycleAvailability === void 0 ? {} : { lifecycleAvailability: event.lifecycleAvailability },
    ...event.turnOutcome === void 0 ? {} : { turnOutcome: event.turnOutcome },
    ...Object.hasOwn(event, "arguments") ? { inputPreview: preview(event.arguments, limits.previewBytes) } : {},
    ...Object.hasOwn(event, "originalArguments") ? {
      originalInputPreview: preview(
        event.originalArguments,
        limits.previewBytes
      )
    } : {},
    ...event.kind === "result" && Object.hasOwn(event, "result") ? { outputPreview: preview(event.result, limits.previewBytes) } : {},
    ...event.kind === "item" && suppressLinkedItemOutput ? { outputPreviewOmitted: "exact-linked-duplicate-carrier" } : event.kind === "item" && Object.hasOwn(event, "nativeValue") ? { outputPreview: preview(event.nativeValue, limits.previewBytes) } : event.kind === "item" && Object.hasOwn(event, "result") ? { outputPreview: preview(event.result, limits.previewBytes) } : {},
    ...event.metadata === void 0 ? {} : { metadataPreview: preview(event.metadata, limits.previewBytes) },
    ...event.externalReference === void 0 ? {} : { externalReference: event.externalReference },
    ...event.childReference === void 0 ? {} : { childReference: event.childReference },
    ...event.skillEvidence === void 0 ? {} : { skillEvidence: event.skillEvidence }
  };
}
function countEvents(scope, events) {
  return {
    scope,
    calls: events.filter((event) => event.kind === "call").length,
    countedInvocations: events.filter(
      (event) => event.kind === "call" && event.ownership === "owned"
    ).length,
    pendingLifecycleCalls: events.filter(
      (event) => event.kind === "call" && event.lifecycleAvailability === "pending-lifecycle"
    ).length,
    results: events.filter((event) => event.kind === "result").length,
    items: events.filter((event) => event.kind === "item").length,
    failures: events.filter(
      (event) => event.outcome === "error" || event.outcome === "cancelled"
    ).length
  };
}
function finalizeRenderedBytes(report) {
  let finalized = report;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const rendered = finalized.renderedFormat === "markdown" ? renderActivityMarkdown(finalized) : renderActivityReport(finalized);
    const renderedBytes = Buffer.byteLength(rendered, "utf8");
    if (renderedBytes === finalized.renderedBytes) return finalized;
    finalized = { ...finalized, renderedBytes };
  }
  throw new Error("Activity report byte size did not stabilize");
}
function buildReport(activity, options, limits, groups, retainedKeys, metadata, reasons) {
  const deliveredEvents = groups.flatMap((group) => group.events);
  const retainedGroups = groups.filter((group) => retainedKeys.has(group.key));
  const displayedRaw = retainedGroups.flatMap((group) => group.events).toSorted(compareChronology);
  const groupWithOutputResult = new Set(
    retainedGroups.filter(
      (group) => group.events.some(
        (event) => event.kind === "result" && Object.hasOwn(event, "result")
      )
    ).map((group) => group.key)
  );
  const eventGroup = new Map(
    retainedGroups.flatMap(
      (group) => group.events.map((event) => [event.eventKey, group.key])
    )
  );
  const events = displayedRaw.map(
    (event) => projectEvent(
      event,
      limits,
      event.kind === "item" && event.relatedCallKey !== void 0 && groupWithOutputResult.has(eventGroup.get(event.eventKey) ?? "")
    )
  );
  const callContexts = retainedGroups.flatMap((group) => {
    if (!group.call || inRange(group.call, options.deliveryRange)) return [];
    return [
      {
        callKey: group.call.eventKey,
        availability: "outside-delivered-range",
        locator: group.call.locator,
        ...group.call.nativeCallId === void 0 ? {} : { nativeCallId: group.call.nativeCallId },
        ...group.call.nativeName === void 0 ? {} : { nativeName: group.call.nativeName },
        ...group.call.category === void 0 ? {} : { category: group.call.category },
        ...Object.hasOwn(group.call, "arguments") ? {
          inputPreview: preview(
            group.call.arguments,
            limits.lateContextBytes
          )
        } : {},
        ...Object.hasOwn(group.call, "originalArguments") ? {
          originalInputPreview: preview(
            group.call.originalArguments,
            limits.lateContextBytes
          )
        } : {}
      }
    ];
  }).toSorted(
    (left, right) => left.locator.recordIndex - right.locator.recordIndex || left.callKey.localeCompare(right.callKey)
  );
  const captured = countEvents("captured-source", activity.events);
  const delivered = countEvents("delivered-range", deliveredEvents);
  const displayed = countEvents("displayed", displayedRaw);
  const report = {
    activitySchemaVersion: activity.activitySchemaVersion,
    mode: options.mode,
    renderedFormat: options.renderFormat,
    source: activity.source,
    sourceSnapshot: activity.sourceSnapshot,
    deliveryRange: options.deliveryRange,
    limits,
    renderedBytes: 0,
    counts: {
      capturedSource: captured,
      deliveredRange: delivered,
      displayed
    },
    omitted: {
      calls: delivered.calls - displayed.calls,
      results: delivered.results - displayed.results,
      failures: delivered.failures - displayed.failures,
      ...reasons
    },
    events,
    callContexts,
    coverage: metadata.coverage,
    diagnostics: metadata.diagnostics,
    sourceMetadata: {
      scope: "captured-source",
      skills: metadata.sourceSkills,
      usage: metadata.usage
    }
  };
  return finalizeRenderedBytes(report);
}
function projectActivityWithLimits(activity, options, limits) {
  validateRange(options.deliveryRange);
  validateLimits(limits);
  const groups = deliveredGroups(activity, options.deliveryRange);
  const displayedInvocations = groups.filter((group) => group.displayedInvocation).toSorted(compareHighPriority);
  const invocationOmitted = limits.maxInvocations === null ? [] : displayedInvocations.slice(limits.maxInvocations);
  const retained = new Set(groups.map((group) => group.key));
  for (const group of invocationOmitted) retained.delete(group.key);
  const metadata = deliveredMetadata(activity, options.deliveryRange);
  const initialReasons = {
    invocationLimitGroups: invocationOmitted.length,
    byteLimitGroups: 0,
    coverageEntries: 0,
    diagnostics: 0,
    sourceSkills: 0,
    usageSamples: 0,
    usageDiagnostics: 0
  };
  const initial = buildReport(
    activity,
    options,
    limits,
    groups,
    retained,
    metadata,
    initialReasons
  );
  if (initial.renderedBytes <= limits.maxBytes) return initial;
  const optionalMetadataCount = metadata.sourceSkills.length + metadata.usage.samples.length + metadata.usage.diagnostics.length;
  let optionalLow = 0;
  let optionalHigh = optionalMetadataCount;
  let best;
  while (optionalLow <= optionalHigh) {
    const retainedCount = Math.floor((optionalLow + optionalHigh) / 2);
    const retainedMetadata = retainOptionalSourceMetadata(
      metadata,
      retainedCount
    );
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      retained,
      retainedMetadata,
      {
        ...initialReasons,
        sourceSkills: metadata.sourceSkills.length - retainedMetadata.sourceSkills.length,
        usageSamples: metadata.usage.samples.length - retainedMetadata.usage.samples.length,
        usageDiagnostics: metadata.usage.diagnostics.length - retainedMetadata.usage.diagnostics.length
      }
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      optionalLow = retainedCount + 1;
    } else {
      optionalHigh = retainedCount - 1;
    }
  }
  if (best) return best;
  const boundedMetadata = retainOptionalSourceMetadata(metadata, 0);
  const boundedReasons = {
    ...initialReasons,
    sourceSkills: metadata.sourceSkills.length,
    usageSamples: metadata.usage.samples.length,
    usageDiagnostics: metadata.usage.diagnostics.length
  };
  const removable = groups.filter((group) => retained.has(group.key)).toSorted(compareLowPriority);
  let low = 1;
  let high = removable.length;
  best = void 0;
  while (low <= high) {
    const removedCount = Math.floor((low + high) / 2);
    const candidateKeys = new Set(retained);
    for (const group of removable.slice(0, removedCount)) {
      candidateKeys.delete(group.key);
    }
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      candidateKeys,
      boundedMetadata,
      {
        ...boundedReasons,
        byteLimitGroups: removedCount
      }
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      high = removedCount - 1;
    } else {
      low = removedCount + 1;
    }
  }
  if (best) return best;
  const metadataCount = metadata.coverage.length + metadata.diagnostics.length + metadata.sourceSkills.length + metadata.usage.samples.length + metadata.usage.diagnostics.length;
  let metadataLow = 0;
  let metadataHigh = metadataCount;
  while (metadataLow <= metadataHigh) {
    const retainedCount = Math.floor((metadataLow + metadataHigh) / 2);
    const retainedMetadata = retainMetadata(metadata, retainedCount);
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      /* @__PURE__ */ new Set(),
      retainedMetadata,
      {
        ...initialReasons,
        byteLimitGroups: removable.length,
        coverageEntries: metadata.coverage.length - retainedMetadata.coverage.length,
        diagnostics: metadata.diagnostics.length - retainedMetadata.diagnostics.length,
        sourceSkills: metadata.sourceSkills.length - retainedMetadata.sourceSkills.length,
        usageSamples: metadata.usage.samples.length - retainedMetadata.usage.samples.length,
        usageDiagnostics: metadata.usage.diagnostics.length - retainedMetadata.usage.diagnostics.length
      }
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      metadataLow = retainedCount + 1;
    } else {
      metadataHigh = retainedCount - 1;
    }
  }
  if (best) return best;
  throw new RangeError("Activity report envelope exceeds the byte limit");
}
function projectActivity(activity, options) {
  return projectActivityWithLimits(
    activity,
    options,
    ACTIVITY_PROJECTION_LIMITS[options.mode]
  );
}

// src/shared/transcript/activity/cursor.ts
function validateInput2(input) {
  if (input.source.runtime !== "cursor" || !input.source.sessionId.trim() || !input.source.nativeSessionId.trim() || !input.source.transcriptPath.trim()) {
    throw new Error("Cursor activity extraction requires an exact source");
  }
  if (!input.capturedAt.trim()) {
    throw new Error("Cursor activity extraction requires a capture time");
  }
  if (input.scan.indexBase !== "zero-based-jsonl-frame-index") {
    throw new Error("Cursor activity extraction requires frame-indexed input");
  }
}
function isSettled(turn) {
  return turn.terminalFrameIndex !== null;
}
function eventLocator(sourceFrameIndex, blockIndex, terminalFrameIndex) {
  const deliveryFrameIndex = terminalFrameIndex ?? sourceFrameIndex;
  return {
    // Cursor JSONL frames retain a one-to-one physical-line coordinate even
    // though delivery is selected by terminal frame rather than source line.
    physicalLine: sourceFrameIndex + 1,
    recordIndex: deliveryFrameIndex,
    sourceFrameIndex,
    ...terminalFrameIndex === null ? {} : { deliveryFrameIndex: terminalFrameIndex },
    jsonPointer: `/message/content/${blockIndex}`
  };
}
function eventKey2(turn, sourceFrameIndex, blockIndex, scan) {
  const positional = `${turn.turnId}:frame:${sourceFrameIndex}:block:${blockIndex}`;
  return isSettled(turn) ? positional : `${positional}:snapshot:${scan.safePrefixSha256}`;
}
function callEvents(input) {
  return input.analysis.turns.flatMap((turn) => {
    const settled = isSettled(turn);
    if (input.mode === "stateful-delivery" && !settled) return [];
    return (turn.toolRecords ?? []).map((tool) => {
      const skillEvidence = structuredSkillFileReadEvidence(
        "cursor",
        tool.nativeName,
        tool.arguments
      );
      return {
        eventKey: eventKey2(
          turn,
          tool.sourceFrameIndex,
          tool.blockIndex,
          input.scan
        ),
        kind: "call",
        nativeType: tool.nativeType,
        locator: eventLocator(
          tool.sourceFrameIndex,
          tool.blockIndex,
          turn.terminalFrameIndex
        ),
        // Cursor records only turn-level terminal evidence. A successful,
        // errored, or aborted turn never proves an individual call's outcome.
        outcome: "unknown",
        turnId: turn.turnId,
        lifecycleAvailability: settled ? "settled" : "pending-lifecycle",
        turnOutcome: turn.lifecycle,
        ...tool.nativeName === void 0 ? {} : { nativeName: tool.nativeName },
        ...Object.hasOwn(tool, "arguments") ? { arguments: tool.arguments } : {},
        ...skillEvidence === void 0 ? {} : { skillEvidence: [skillEvidence] }
      };
    });
  });
}
function lifecycleCounts(analysis, emittedCalls, mode) {
  let settledCalls = 0;
  let pendingLifecycleCalls = 0;
  for (const turn of analysis.turns) {
    const count = turn.toolRecords?.length ?? 0;
    if (isSettled(turn)) settledCalls += count;
    else pendingLifecycleCalls += count;
  }
  return {
    capturedCalls: settledCalls + pendingLifecycleCalls,
    settledCalls,
    pendingLifecycleCalls,
    emittedCalls,
    deferredPendingCalls: mode === "stateful-delivery" ? pendingLifecycleCalls : 0
  };
}
function coverage(events, scan, mode) {
  const entries = [
    {
      dataClass: "calls",
      status: "available",
      captured: events.length
    },
    {
      dataClass: "source-skill-names",
      status: "not-recorded",
      captured: 0
    },
    ...events.length > 0 || mode === "stateless-snapshot" ? [
      {
        dataClass: "results",
        status: "not-recorded",
        captured: 0
      }
    ] : []
  ];
  if (scan.blockingFrame) {
    entries.push({
      dataClass: "record-activity",
      status: "malformed",
      captured: 0,
      locator: {
        physicalLine: scan.blockingFrame.frameIndex + 1,
        recordIndex: scan.blockingFrame.frameIndex,
        sourceFrameIndex: scan.blockingFrame.frameIndex,
        jsonPointer: ""
      }
    });
  }
  return entries;
}
function extractCursorActivity(input) {
  validateInput2(input);
  const events = callEvents(input);
  const counts = lifecycleCounts(input.analysis, events.length, input.mode);
  return {
    activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
    source: input.source,
    sourceSnapshot: {
      capturedAt: input.capturedAt,
      sourceBytes: input.scan.file.size
    },
    events,
    coverage: coverage(events, input.scan, input.mode),
    diagnostics: input.scan.blockingFrame ? [
      {
        code: input.scan.blockingFrame.parseState === "partial" ? "SOURCE_PARTIAL_TAIL" : "SOURCE_MALFORMED_RECORD",
        locator: {
          physicalLine: input.scan.blockingFrame.frameIndex + 1,
          recordIndex: input.scan.blockingFrame.frameIndex,
          sourceFrameIndex: input.scan.blockingFrame.frameIndex,
          jsonPointer: ""
        }
      }
    ] : [],
    sourceMetadata: {
      scope: "captured-source",
      skills: [],
      usage: notRecordedUsage()
    },
    cursor: {
      indexBase: input.scan.indexBase,
      mode: input.mode,
      counts
    }
  };
}

// src/shared/transcript/cursor-analysis.ts
import { createHash as createHash4 } from "node:crypto";
function cursorRenderTurnId(turn, sourceFrameIndex) {
  const humanFrameIndex = turn.humanRecordIndexes.findLast(
    (frameIndex) => frameIndex <= sourceFrameIndex
  );
  return `${turn.turnId}:render:${humanFrameIndex ?? turn.fromFrameIndex}`;
}
function isJsonObject3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue3(value) {
  return typeof value === "string" ? value : null;
}
function identityScope(identity) {
  return createHash4("sha256").update(
    JSON.stringify([
      identity.runtime,
      identity.projectCwd,
      identity.sessionId,
      identity.canonicalTranscriptPath
    ])
  ).digest("hex");
}
function validateIdentity(identity) {
  if (identity.runtime !== "cursor") {
    throw new TypeError("runtime must be cursor");
  }
  for (const field of [
    "projectCwd",
    "sessionId",
    "canonicalTranscriptPath"
  ]) {
    if (!identity[field]?.trim()) {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  }
}
function contentBlocks(record) {
  if (!isJsonObject3(record.message)) {
    return [{ blockIndex: 0, kind: "unsupported", text: "" }];
  }
  const message = record.message;
  const content = message.content;
  if (typeof content === "string") {
    return [{ blockIndex: 0, kind: "text", text: content }];
  }
  if (!Array.isArray(content)) {
    return [{ blockIndex: 0, kind: "unsupported", text: "" }];
  }
  return content.map((block, blockIndex) => {
    if (!isJsonObject3(block)) {
      return { blockIndex, kind: "unsupported", text: "" };
    }
    const type = stringValue3(block.type);
    if (type === "tool_use") {
      const nativeName = stringValue3(block.name);
      const toolRecord = {
        nativeType: "tool_use",
        ...nativeName === null ? {} : { nativeName },
        ...Object.hasOwn(block, "input") ? { arguments: block.input } : {}
      };
      const askUserText = cursorAskUserQuestionText(block);
      if (askUserText !== null) {
        return {
          blockIndex,
          kind: "ask-user",
          text: askUserText,
          toolRecord
        };
      }
      return { blockIndex, kind: "tool", text: "", toolRecord };
    }
    const text = stringValue3(block.text) ?? stringValue3(block.content) ?? "";
    if (type === "runtime_diagnostic" || type === "diagnostic") {
      return { blockIndex, kind: "runtime-diagnostic", text };
    }
    if (type === "text") {
      return { blockIndex, kind: "text", text };
    }
    return { blockIndex, kind: "unsupported", text };
  });
}
function lifecycleState(status) {
  return status === "success" || status === "aborted" || status === "error" || status === "cancelled" ? status : "unknown";
}
function classifyAssistantText(block, hasAutomaticControlInput, hasHumanInput) {
  if (block.kind === "runtime-diagnostic") return "runtime-diagnostic";
  if (block.kind === "unsupported") return "unsupported";
  if (block.text.trim().length === 0) return "empty";
  if (isNoOpText(block.text)) return "no-op";
  if (parseAutomaticControlEnvelope(block.text) !== null || hasAutomaticControlInput && !hasHumanInput && isAutomaticControlAcknowledgement(block.text)) {
    return "automatic-control";
  }
  return "substantive";
}
function createCursorTurnAccumulator(identity, fromFrameIndex) {
  validateIdentity(identity);
  if (!Number.isSafeInteger(fromFrameIndex) || fromFrameIndex < 0) {
    throw new TypeError("fromFrameIndex must be a non-negative safe integer");
  }
  const scope = identityScope(identity);
  const turns = [];
  const metadataFrameIndexes = [];
  let nextTurnStart = fromFrameIndex;
  let current = null;
  let lastFrameIndex = -1;
  let blocked = false;
  let finished = false;
  const ensureTurn = (observedFrameIndex) => {
    if (current !== null) return current;
    const turnId = `cursor:${scope}:turn:${nextTurnStart}`;
    current = {
      turnId,
      fromFrameIndex: nextTurnStart,
      observedThroughFrame: observedFrameIndex,
      assistantRecords: [],
      humanRecordIndexes: [],
      toolRecordIndexes: [],
      toolRecords: [],
      hasAutomaticControlInput: false,
      hasHumanInput: false
    };
    return current;
  };
  const finishCurrentTurn = (lifecycle, terminalFrameIndex) => {
    if (current === null) return;
    const finalSubstantive = lifecycle === "success" ? current.assistantRecords.findLast(
      (record) => record.classification === "substantive"
    ) : void 0;
    turns.push({
      turnId: current.turnId,
      fromFrameIndex: current.fromFrameIndex,
      observedThroughFrame: current.observedThroughFrame,
      assistantRecords: current.assistantRecords,
      humanRecordIndexes: current.humanRecordIndexes,
      toolRecordIndexes: current.toolRecordIndexes,
      toolRecords: current.toolRecords,
      lifecycle,
      terminalFrameIndex,
      finalSubstantiveEntryKey: finalSubstantive?.entryKey ?? null
    });
    current = null;
  };
  return {
    onFrame(frame) {
      if (finished) {
        throw new Error("cannot add frames after analysis is finished");
      }
      if (!Number.isSafeInteger(frame.frameIndex) || frame.frameIndex <= lastFrameIndex) {
        throw new TypeError(
          "Cursor frames must have strictly increasing non-negative indexes"
        );
      }
      lastFrameIndex = frame.frameIndex;
      if (frame.parseState === "malformed" || frame.parseState === "partial") {
        blocked = true;
        return;
      }
      if (blocked || frame.frameIndex < fromFrameIndex) return;
      if (frame.parseState === "blank" || frame.record === null) {
        if (current !== null) {
          current.observedThroughFrame = frame.frameIndex;
        }
        return;
      }
      const record = frame.record;
      if (record.type === "turn_ended") {
        const turn2 = ensureTurn(frame.frameIndex);
        turn2.observedThroughFrame = frame.frameIndex;
        const lifecycle = lifecycleState(record.status);
        finishCurrentTurn(lifecycle, frame.frameIndex);
        nextTurnStart = frame.frameIndex + 1;
        return;
      }
      const role = stringValue3(record.role);
      if (role !== "user" && role !== "assistant") {
        metadataFrameIndexes.push(frame.frameIndex);
        if (current !== null) {
          current.observedThroughFrame = frame.frameIndex;
        }
        return;
      }
      const turn = ensureTurn(frame.frameIndex);
      turn.observedThroughFrame = frame.frameIndex;
      const blocks = contentBlocks(record);
      if (blocks.some((block) => block.kind === "tool")) {
        turn.toolRecordIndexes.push(frame.frameIndex);
      }
      if (role === "user") {
        let automaticControl = false;
        let humanInput = false;
        for (const block of blocks) {
          if (block.kind !== "text" || block.text.trim().length === 0) {
            continue;
          }
          if (parseAutomaticControlEnvelope(block.text) !== null) {
            automaticControl = true;
          } else {
            humanInput = true;
          }
        }
        if (automaticControl) {
          turn.hasAutomaticControlInput = true;
        }
        if (humanInput) {
          turn.hasHumanInput = true;
          turn.humanRecordIndexes.push(frame.frameIndex);
        }
        return;
      }
      for (const block of blocks) {
        if (block.toolRecord === void 0) continue;
        turn.toolRecords.push({
          sourceFrameIndex: frame.frameIndex,
          blockIndex: block.blockIndex,
          ...block.toolRecord
        });
      }
      for (const block of blocks) {
        if (block.kind === "tool") continue;
        const classification = classifyAssistantText(
          block,
          turn.hasAutomaticControlInput,
          turn.hasHumanInput
        );
        turn.assistantRecords.push({
          entryKey: `${turn.turnId}:frame:${frame.frameIndex}:block:${block.blockIndex}`,
          turnId: turn.turnId,
          sourceFrameIndex: frame.frameIndex,
          blockIndex: block.blockIndex,
          role: "assistant",
          text: block.text,
          classification,
          ...block.kind === "ask-user" ? { askUser: true } : {}
        });
      }
    },
    finish(scan) {
      if (finished) {
        throw new Error("Cursor analysis can only be finished once");
      }
      finished = true;
      if (current !== null && scan.safeThroughFrame !== null && scan.safeThroughFrame >= current.fromFrameIndex) {
        current.observedThroughFrame = Math.max(
          current.observedThroughFrame,
          scan.safeThroughFrame
        );
        finishCurrentTurn("pending", null);
      }
      return {
        turns,
        metadataFrameIndexes,
        blockingFrame: scan.blockingFrame
      };
    }
  };
}

// src/skills/session-observer/src/lib/session-classifier.ts
function textStart(text) {
  return String(text ?? "").trimStart();
}
function isTitlePrompt(text) {
  return textStart(text).startsWith(
    "Generate a concise tab title for this coding chat.\nRules:"
  );
}
function isHiddenBootstrapUserText(text) {
  const normalized = textStart(text);
  return normalized.startsWith("# AGENTS.md instructions for ") || normalized.startsWith("<environment_context>") || normalized.startsWith("<skill>\n<name>") || normalized.startsWith("<permissions instructions>") || normalized.startsWith("<apps_instructions>") || normalized.startsWith("<stoa-profile ") || isTitlePrompt(normalized);
}
function isSyntheticForEngagement(entry) {
  if (entry.role !== "user") return false;
  return entry.kind === "command_message" || entry.origin === "automatic-control" || entry.origin === "runtime-notification" || isHiddenBootstrapUserText(entry.text);
}
function publicBootstrapIndexes(indexes) {
  return [...indexes].toSorted((a, b) => a - b);
}
function entriesByRecordIndex(entries) {
  const byRecord = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const existing = byRecord.get(entry.recordIndex) ?? [];
    existing.push(entry);
    byRecord.set(entry.recordIndex, existing);
  }
  return byRecord;
}
function visibleConversationEntries(entries) {
  return entries.filter(
    (entry) => entry.kind === "message" || entry.kind === "command_message" || entry.kind === "ask_user"
  );
}
function isOperatorAskUserAnswer(entry) {
  return entry.kind === "ask_user" && entry.role === "user" && entry.origin === "human";
}
function classifyTranscriptRecords(runtime, records) {
  const allEntries = normalizeEntries(runtime, records, {
    includeToolCalls: false,
    includeToolResults: false,
    includeCommandMessages: true
  });
  const byRecord = entriesByRecordIndex(allEntries);
  const bootstrapRecordIndexes = /* @__PURE__ */ new Set();
  let genuineUserMessages = 0;
  let syntheticUserMessages = 0;
  let assistantMessages = 0;
  let realMessageCount = 0;
  let operatorAskUserAnswers = 0;
  let pendingTitleAssistant = false;
  for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
    const entries = visibleConversationEntries(byRecord.get(recordIndex) ?? []);
    if (entries.length === 0) continue;
    if (pendingTitleAssistant && entries.every(
      (entry) => entry.role === "assistant" && entry.kind === "message"
    )) {
      bootstrapRecordIndexes.add(recordIndex);
      pendingTitleAssistant = false;
      continue;
    }
    pendingTitleAssistant = false;
    const userEntries = entries.filter((entry) => entry.role === "user");
    const hiddenBootstrapUserRecord = userEntries.length > 0 && entries.every((entry) => entry.role === "user") && userEntries.every((entry) => isHiddenBootstrapUserText(entry.text));
    if (hiddenBootstrapUserRecord) {
      bootstrapRecordIndexes.add(recordIndex);
      syntheticUserMessages += userEntries.length;
      if (userEntries.some((entry) => isTitlePrompt(entry.text))) {
        pendingTitleAssistant = true;
      }
      continue;
    }
    for (const entry of entries) {
      if (entry.role === "user") {
        if (isOperatorAskUserAnswer(entry)) {
          operatorAskUserAnswers++;
          realMessageCount++;
          continue;
        }
        if (isSyntheticForEngagement(entry)) {
          syntheticUserMessages++;
          continue;
        }
        if (entry.kind === "message") {
          genuineUserMessages++;
          realMessageCount++;
        }
      } else if (entry.role === "assistant" && (entry.kind === "message" || entry.kind === "ask_user")) {
        assistantMessages++;
        realMessageCount++;
      }
    }
  }
  const humanInputs = genuineUserMessages + operatorAskUserAnswers;
  const status = humanInputs > 0 ? "engaged" : "unengaged";
  return {
    status,
    engaged: status === "engaged",
    recordCount: records.length,
    genuineUserMessages,
    operatorAskUserAnswers,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount,
    hasAssistantAndUser: humanInputs > 0 && assistantMessages > 0,
    bootstrapRecordIndexes: publicBootstrapIndexes(bootstrapRecordIndexes),
    bootstrapRecordCount: bootstrapRecordIndexes.size
  };
}

// src/skills/session-observer/src/lib/digest.ts
var SCHEMA_VERSION2 = 1;
var LARGE_OUTPUT_THRESHOLD = 2e4;
var AUTO_LARGE_DIGEST_TURNS = 8;
function applyTailSlice(entries, opts) {
  const { maxTurns, maxBytes } = opts;
  if (maxBytes && maxBytes > 0) {
    let cumBytes = 0;
    const result = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entryBytes = Buffer.byteLength(entries[i].text || "", "utf8");
      if (cumBytes + entryBytes > maxBytes && result.length > 0) break;
      cumBytes += entryBytes;
      result.unshift(entries[i]);
    }
    return result;
  }
  if (maxTurns && maxTurns > 0) {
    const groups = entries.every(
      (entry) => typeof entry.renderTurnId === "string"
    ) ? groupByEntryKey(entries, "renderTurnId") : entries.every(
      (entry) => typeof entry.turnId === "string"
    ) ? groupByEntryKey(entries, "turnId") : groupByRole(entries);
    const tailGroups = groups.slice(-maxTurns);
    return tailGroups.flat();
  }
  return entries;
}
function renderedCharCount(entries) {
  return entries.reduce((sum, entry) => sum + (entry.text?.length ?? 0), 0);
}
function omittedUserMessageRecoveryPointers(entriesBeforeTailSlice, retainedEntries, transcriptPath) {
  const retained = new Set(retainedEntries);
  const seenRecordIndexes = /* @__PURE__ */ new Set();
  const pointers = [];
  for (const entry of entriesBeforeTailSlice) {
    const recoveryRecordIndex = entry.sourceRecordIndex ?? entry.recordIndex;
    if (retained.has(entry) || entry.role !== "user" || entry.origin === "automatic-control" || entry.origin === "runtime-notification" || seenRecordIndexes.has(recoveryRecordIndex)) {
      continue;
    }
    seenRecordIndexes.add(recoveryRecordIndex);
    pointers.push({
      transcriptPath,
      indexBase: "zero-based-jsonl-record-index",
      recordIndex: recoveryRecordIndex
    });
  }
  return pointers;
}
function groupByRole(entries) {
  if (entries.length === 0) return [];
  const groups = [];
  let currentGroup = [entries[0]];
  for (let i = 1; i < entries.length; i++) {
    if ((entries[i].displayRole ?? entries[i].role) === (currentGroup[0].displayRole ?? currentGroup[0].role)) {
      currentGroup.push(entries[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [entries[i]];
    }
  }
  groups.push(currentGroup);
  return groups;
}
function groupByEntryKey(entries, key) {
  if (entries.length === 0) return [];
  const groupId = (entry) => entry[key];
  const groups = [];
  let currentGroup = [entries[0]];
  for (let i = 1; i < entries.length; i++) {
    if (groupId(entries[i]) === groupId(currentGroup[0])) {
      currentGroup.push(entries[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [entries[i]];
    }
  }
  groups.push(currentGroup);
  return groups;
}
function recoveryPointerKey(pointer) {
  return `${pointer.frameIndex}:${pointer.entryKey}`;
}
function addCursorRecoveryPointer(pointers, seen, pointer) {
  const key = recoveryPointerKey(pointer);
  if (seen.has(key)) return;
  seen.add(key);
  pointers.push(pointer);
}
function cursorRecoveryPointer(transcriptPath, frameIndex, entryKey) {
  return {
    transcriptPath,
    indexBase: "zero-based-jsonl-frame-index",
    frameIndex,
    entryKey
  };
}
function cursorEntry(record, renderTurnId, deliveryFrameIndex, availability) {
  return {
    role: "assistant",
    text: record.text,
    recordIndex: deliveryFrameIndex,
    sourceFrameIndex: record.sourceFrameIndex,
    // Questions are tagged structurally so JSON consumers can tell them from
    // assistant prose, matching how the v1 normalizer and the public docs
    // describe Cursor ask-user content.
    kind: record.askUser === true ? "ask_user" : "message",
    entryKey: record.entryKey,
    turnId: record.turnId,
    renderTurnId,
    availability
  };
}
function cursorEntryHash(text) {
  return createHash5("sha256").update(text).digest("hex");
}
function cursorRecordWasDelivered(record, stateTurn) {
  if (!stateTurn) return false;
  if (!stateTurn.deliveredEntryKeys.includes(record.entryKey)) return false;
  const deliveredHash = stateTurn.deliveredEntryHashes?.[record.entryKey];
  return deliveredHash === void 0 || deliveredHash === cursorEntryHash(record.text);
}
function finalRecordsByRenderTurn(turn, records) {
  const finalByGroup = /* @__PURE__ */ new Map();
  for (const record of records) {
    finalByGroup.set(cursorRenderTurnId(turn, record.sourceFrameIndex), record);
  }
  return [...finalByGroup.values()];
}
function isCursorBuildDigestOptions(opts) {
  return "cursorProjection" in opts && "cursorScan" in opts && "cursorAnalysis" in opts && "cursorIdentity" in opts && "cursorContinuity" in opts;
}
function cursorStateTurn(turn, opts) {
  const openTurn = opts.cursorState?.openTurn ?? null;
  if (openTurn === null) return null;
  if (openTurn.turnId === turn.turnId) return openTurn;
  if (turn.lifecycle !== "pending" && turn.assistantRecords.length === 0 && turn.terminalFrameIndex !== null && opts.cursorAnalysis.turns.find(
    (candidate) => candidate.terminalFrameIndex !== null
  ) === turn) {
    return openTurn;
  }
  return null;
}
function cursorEngagement(opts) {
  const humanFrames = /* @__PURE__ */ new Set();
  let assistantMessages = 0;
  let hasAutomaticControlInput = false;
  for (const turn of opts.cursorAnalysis.turns) {
    const stateTurn = cursorStateTurn(turn, opts);
    for (const frameIndex of turn.humanRecordIndexes) {
      humanFrames.add(frameIndex);
    }
    assistantMessages += Math.max(
      turn.assistantRecords.length,
      stateTurn?.assistantEntryKeys.length ?? 0
    );
    if (stateTurn) {
      for (const frameIndex of stateTurn.humanRecordIndexes) {
        humanFrames.add(frameIndex);
      }
      hasAutomaticControlInput ||= stateTurn.hasAutomaticControlInput;
    }
  }
  const genuineUserMessages = humanFrames.size;
  const syntheticUserMessages = hasAutomaticControlInput ? 1 : 0;
  const engaged = genuineUserMessages > 0 && assistantMessages > 0;
  return {
    status: engaged ? "engaged" : genuineUserMessages > 0 || assistantMessages > 0 || syntheticUserMessages > 0 ? "unengaged" : "unknown",
    engaged,
    recordCount: opts.cursorScan.totalFrames,
    genuineUserMessages,
    // Cursor records no ask-user answer at all, so there is never an
    // operator-attributable one to count here.
    operatorAskUserAnswers: 0,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount: genuineUserMessages + assistantMessages,
    hasAssistantAndUser: engaged,
    bootstrapRecordIndexes: [],
    bootstrapRecordCount: 0
  };
}
function buildCursorDigest(transcriptPath, opts) {
  const { cursorScan: scan, cursorAnalysis: analysis } = opts;
  if (scan.indexBase !== "zero-based-jsonl-frame-index" || opts.cursorIdentity.runtime !== "cursor") {
    throw new TypeError("Cursor digest requires frame-index Cursor evidence");
  }
  const fromIndex = opts.fromIndex ?? opts.cursorState?.continuity.nextFrameIndex ?? 0;
  if (!Number.isSafeInteger(fromIndex) || fromIndex < 0) {
    throw new TypeError("Cursor digest fromIndex must be non-negative");
  }
  const safeNextIndex = Math.max(
    fromIndex,
    Math.min(
      scan.totalFrames,
      scan.safeThroughFrame === null ? 0 : scan.safeThroughFrame + 1
    )
  );
  let nextIndex = safeNextIndex;
  let stabilityWaitFrom = null;
  let latestLifecycle = "none";
  let hasAssistantActivity = false;
  let hasToolActivity = false;
  let hasHumanActivity = false;
  let suppressedContent = false;
  let unstableContent = 0;
  const entriesBeforeTailSlice = [];
  const lifecycleEvents = [];
  const omittedUserMessages = [];
  const omittedAssistantEntries = [];
  const seenUserPointers = /* @__PURE__ */ new Set();
  const seenAssistantPointers = /* @__PURE__ */ new Set();
  const renderGroups = /* @__PURE__ */ new Map();
  for (const turn of analysis.turns) {
    const stateTurn = cursorStateTurn(turn, opts);
    const turnId = stateTurn?.turnId ?? turn.turnId;
    const effectiveTurn = {
      ...turn,
      humanRecordIndexes: [
        .../* @__PURE__ */ new Set([
          ...turn.humanRecordIndexes,
          ...stateTurn?.humanRecordIndexes ?? []
        ])
      ].toSorted((left, right) => left - right)
    };
    const substantiveRecords = effectiveTurn.assistantRecords.filter(
      (record) => record.classification === "substantive"
    );
    for (const record of substantiveRecords) {
      const renderTurnId = cursorRenderTurnId(
        effectiveTurn,
        record.sourceFrameIndex
      );
      const userFrameIndex = effectiveTurn.humanRecordIndexes.findLast(
        (frameIndex) => frameIndex <= record.sourceFrameIndex
      );
      const group = renderGroups.get(renderTurnId) ?? {
        userFrameIndex: userFrameIndex ?? null,
        assistantRecords: []
      };
      group.assistantRecords.push(record);
      renderGroups.set(renderTurnId, group);
    }
    hasAssistantActivity ||= turn.assistantRecords.length > 0 || (stateTurn?.assistantEntryKeys.length ?? 0) > 0;
    hasToolActivity ||= turn.toolRecordIndexes.length > 0 || (stateTurn?.toolRecordIndexes.length ?? 0) > 0;
    hasHumanActivity ||= turn.humanRecordIndexes.length > 0 || (stateTurn?.humanRecordIndexes.length ?? 0) > 0;
    latestLifecycle = turn.lifecycle;
    if (turn.lifecycle === "pending") {
      if (opts.cursorProjection === "confirmed-completion") {
        stabilityWaitFrom = stabilityWaitFrom === null ? turn.fromFrameIndex : Math.min(stabilityWaitFrom, turn.fromFrameIndex);
        continue;
      }
      const candidate = opts.cursorState?.stabilityCandidate;
      const stableEntryKeys = candidate?.turnId === turnId && candidate.confirmedAt !== null ? new Set(candidate.entryKeys) : /* @__PURE__ */ new Set();
      for (const record of substantiveRecords) {
        if (cursorRecordWasDelivered(record, stateTurn)) continue;
        if (!stableEntryKeys.has(record.entryKey)) {
          unstableContent += 1;
          stabilityWaitFrom = stabilityWaitFrom === null ? record.sourceFrameIndex : Math.min(stabilityWaitFrom, record.sourceFrameIndex);
          continue;
        }
        entriesBeforeTailSlice.push(
          cursorEntry(
            record,
            cursorRenderTurnId(effectiveTurn, record.sourceFrameIndex),
            record.sourceFrameIndex,
            "pending-lifecycle"
          )
        );
      }
      continue;
    }
    const finalEntryKey = turn.finalSubstantiveEntryKey ?? (turn.lifecycle === "success" ? stateTurn?.assistantEntryKeys.at(-1) ?? null : null);
    lifecycleEvents.push({
      turnId,
      terminalFrameIndex: turn.terminalFrameIndex,
      lifecycle: turn.lifecycle,
      finalEntryKey,
      contentPreviouslyObservable: finalEntryKey !== null && (substantiveRecords.some(
        (record) => record.entryKey === finalEntryKey && cursorRecordWasDelivered(record, stateTurn)
      ) || substantiveRecords.length === 0 && (stateTurn?.deliveredEntryKeys.includes(finalEntryKey) ?? false))
    });
    const emitsAskUser = opts.cursorProjection === "observation";
    const emitAskUserRecords = (availability, alreadyRendered = /* @__PURE__ */ new Set()) => {
      if (!emitsAskUser) return;
      for (const record of substantiveRecords) {
        if (record.askUser !== true) continue;
        if (alreadyRendered.has(record.entryKey)) continue;
        if (cursorRecordWasDelivered(record, stateTurn)) continue;
        entriesBeforeTailSlice.push(
          cursorEntry(
            record,
            cursorRenderTurnId(effectiveTurn, record.sourceFrameIndex),
            record.sourceFrameIndex,
            availability
          )
        );
      }
    };
    if (turn.lifecycle !== "success") {
      emitAskUserRecords("terminal-incomplete");
      if (!emitsAskUser) {
        for (const record of substantiveRecords) {
          if (record.askUser !== true) continue;
          addCursorRecoveryPointer(
            omittedAssistantEntries,
            seenAssistantPointers,
            cursorRecoveryPointer(
              transcriptPath,
              record.sourceFrameIndex,
              record.entryKey
            )
          );
        }
      }
      suppressedContent ||= substantiveRecords.some(
        (record) => !emitsAskUser || record.askUser !== true
      ) || (stateTurn?.assistantEntryKeys.length ?? 0) > 0;
      continue;
    }
    const completedRecords = opts.cursorProjection === "confirmed-completion" ? substantiveRecords.filter(
      (record) => record.entryKey === finalEntryKey
    ) : finalRecordsByRenderTurn(effectiveTurn, substantiveRecords);
    const completedKeys = new Set(
      completedRecords.map((record) => record.entryKey)
    );
    emitAskUserRecords("completed", completedKeys);
    for (const record of completedRecords) {
      if (!emitsAskUser && record.askUser === true) {
        addCursorRecoveryPointer(
          omittedAssistantEntries,
          seenAssistantPointers,
          cursorRecoveryPointer(
            transcriptPath,
            record.sourceFrameIndex,
            record.entryKey
          )
        );
        continue;
      }
      const wasDelivered = cursorRecordWasDelivered(record, stateTurn);
      const deliveredHash = stateTurn?.deliveredEntryHashes?.[record.entryKey];
      const changedSinceDelivery = deliveredHash !== void 0 && deliveredHash !== cursorEntryHash(record.text);
      if (opts.cursorProjection === "observation" && (wasDelivered || record.sourceFrameIndex < fromIndex && !changedSinceDelivery)) {
        continue;
      }
      entriesBeforeTailSlice.push(
        cursorEntry(
          record,
          cursorRenderTurnId(effectiveTurn, record.sourceFrameIndex),
          turn.terminalFrameIndex,
          "completed"
        )
      );
    }
  }
  if (stabilityWaitFrom !== null) {
    nextIndex = Math.min(nextIndex, stabilityWaitFrom);
  }
  let entries = applyTailSlice(entriesBeforeTailSlice, {
    maxTurns: opts.maxTurns,
    maxBytes: opts.maxBytes
  });
  const explicitTailSlice = Boolean(
    opts.maxTurns && opts.maxTurns > 0 || opts.maxBytes && opts.maxBytes > 0
  );
  let usedLargeDigestFallback = false;
  if (!explicitTailSlice && renderedCharCount(entries) > LARGE_OUTPUT_THRESHOLD) {
    entries = applyTailSlice(entries, { maxTurns: AUTO_LARGE_DIGEST_TURNS });
    usedLargeDigestFallback = true;
  }
  const retainedEntriesByGroup = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const renderTurnId = entry.renderTurnId ?? entry.turnId;
    const entryKeys = retainedEntriesByGroup.get(renderTurnId) ?? /* @__PURE__ */ new Set();
    entryKeys.add(entry.entryKey);
    retainedEntriesByGroup.set(renderTurnId, entryKeys);
  }
  for (const [renderTurnId, retainedEntryKeys] of retainedEntriesByGroup) {
    const group = renderGroups.get(renderTurnId);
    if (!group) continue;
    if (group.userFrameIndex !== null) {
      addCursorRecoveryPointer(
        omittedUserMessages,
        seenUserPointers,
        cursorRecoveryPointer(
          transcriptPath,
          group.userFrameIndex,
          `${renderTurnId.replace(/:render:\d+$/u, "")}:frame:${group.userFrameIndex}:user`
        )
      );
    }
    const omittedAssistant = group.assistantRecords.findLast(
      (record) => !retainedEntryKeys.has(record.entryKey)
    );
    if (omittedAssistant) {
      addCursorRecoveryPointer(
        omittedAssistantEntries,
        seenAssistantPointers,
        cursorRecoveryPointer(
          transcriptPath,
          omittedAssistant.sourceFrameIndex,
          omittedAssistant.entryKey
        )
      );
    }
  }
  const blockingFrame = scan.blockingFrame ?? analysis.blockingFrame;
  const blockingReason = blockingFrame !== null && blockingFrame.frameIndex <= nextIndex ? blockingFrame.parseState : null;
  const bufferedReason = stabilityWaitFrom !== null && (blockingFrame === null || stabilityWaitFrom < blockingFrame.frameIndex) ? "stability-wait" : blockingReason;
  const bufferedCount = Math.max(0, scan.totalFrames - nextIndex);
  const bufferedFromIndex = bufferedCount > 0 ? nextIndex : null;
  const renderedFromIndex = entries.length > 0 ? Math.min(...entries.map((entry) => entry.recordIndex)) : null;
  const renderedToIndex = entries.length > 0 ? Math.max(...entries.map((entry) => entry.recordIndex)) : null;
  const rawCount = Math.max(0, nextIndex - fromIndex);
  const rawToIndex = rawCount > 0 ? nextIndex - 1 : null;
  const inRawRange = (frameIndex) => frameIndex >= fromIndex && frameIndex < nextIndex;
  const toolFrames = /* @__PURE__ */ new Set();
  let automaticControls = 0;
  let emptyOrNoOp = 0;
  for (const turn of analysis.turns) {
    for (const frameIndex of turn.toolRecordIndexes) {
      if (inRawRange(frameIndex)) toolFrames.add(frameIndex);
    }
    for (const record of turn.assistantRecords) {
      if (!inRawRange(record.sourceFrameIndex)) continue;
      if (record.classification === "automatic-control") {
        automaticControls += 1;
      } else if (record.classification === "empty" || record.classification === "no-op") {
        emptyOrNoOp += 1;
      }
    }
  }
  const accounting = {
    indexBase: "zero-based-jsonl-frame-index",
    raw: {
      fromIndex,
      toIndex: rawToIndex,
      count: rawCount,
      nextIndex,
      totalFrames: scan.totalFrames
    },
    rendered: {
      count: entries.length,
      fromIndex: renderedFromIndex,
      toIndex: renderedToIndex
    },
    filtered: {
      toolCalls: toolFrames.size,
      automaticControls,
      emptyOrNoOp,
      metadataFrames: analysis.metadataFrameIndexes.filter(inRawRange).length,
      unstableContent
    },
    buffered: {
      fromIndex: bufferedFromIndex,
      count: bufferedCount,
      reason: bufferedCount > 0 ? bufferedReason : null
    },
    recovery: {
      omittedUserMessages,
      omittedAssistantEntries
    }
  };
  const warnings = [...opts.warnings ?? []];
  if (usedLargeDigestFallback) {
    warnings.push(
      `Large digest fallback: rendered content exceeded ${LARGE_OUTPUT_THRESHOLD.toLocaleString()} chars; showing the last ${AUTO_LARGE_DIGEST_TURNS} user-delimited Cursor turn groups. Use --max-turns or --max-bytes for a different view.`
    );
  }
  for (const event of lifecycleEvents) {
    if (event.lifecycle !== "success") {
      warnings.push(
        `Cursor lifecycle ${event.lifecycle} at frame ${event.terminalFrameIndex}; observed content did not become a successful completion.`
      );
    }
  }
  if (blockingFrame) {
    warnings.push(
      blockingFrame.parseState === "malformed" ? `Cursor transcript is blocked by malformed frame ${blockingFrame.frameIndex}.` : `Cursor transcript has a partial frame at ${blockingFrame.frameIndex}.`
    );
  }
  const engagement = cursorEngagement(opts);
  const content = entries.length ? "available" : suppressedContent ? "suppressed" : bufferedCount > 0 ? "buffered" : "none";
  const status = {
    engagement: engagement.status,
    activity: hasAssistantActivity ? "assistant-progress" : hasToolActivity ? "tool-activity" : hasHumanActivity ? "human-input" : "none",
    content,
    lifecycle: latestLifecycle,
    delivery: opts.cursorState?.pendingDelivery !== null && opts.cursorState?.pendingDelivery !== void 0 ? "uncertain" : opts.cursorState?.lastStatus.delivery === "uncertain" ? "uncertain" : "none",
    health: blockingFrame?.parseState === "malformed" ? "blocked" : "healthy"
  };
  const filters = {
    includeToolCalls: opts.includeToolCalls ?? false,
    includeToolResults: opts.includeToolResults ?? false,
    includeCommandMessages: opts.includeCommandMessages ?? false
  };
  let activity;
  if (opts.includeActivity) {
    const stateless = (opts.mode ?? "review") === "review";
    const activityMode = stateless ? "review" : "catch-up";
    const defaultStart = stateless ? 0 : opts.cursorState?.continuity.nextFrameIndex ?? fromIndex;
    const defaultEnd = stateless ? scan.totalFrames : analysis.turns.reduce(
      (end, turn) => turn.terminalFrameIndex !== null && turn.terminalFrameIndex < nextIndex ? Math.max(end, turn.terminalFrameIndex + 1) : end,
      defaultStart
    );
    const deliveryRange = opts.cursorActivityDeliveryRange ?? {
      indexBase: "zero-based-jsonl-frame-index",
      start: defaultStart,
      end: defaultEnd
    };
    const source = {
      runtime: "cursor",
      sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
      nativeSessionId: opts.cursorIdentity.sessionId,
      transcriptPath
    };
    const capturedAt = opts.cursorCapturedAt ?? (/* @__PURE__ */ new Date()).toISOString();
    try {
      activity = projectActivity(
        correlateActivity(
          extractCursorActivity({
            source,
            scan,
            analysis,
            capturedAt,
            mode: stateless ? "stateless-snapshot" : "stateful-delivery"
          })
        ),
        {
          mode: activityMode,
          renderFormat: opts.activityRenderFormat ?? "compact-json",
          deliveryRange
        }
      );
    } catch {
      activity = projectActivity(
        {
          activitySchemaVersion: 1,
          source,
          sourceSnapshot: {
            capturedAt,
            sourceBytes: scan.file.size
          },
          events: [],
          coverage: [
            {
              dataClass: "record-activity",
              status: "not-read",
              captured: 0
            }
          ],
          diagnostics: [
            {
              code: "ACTIVITY_EXTRACTION_ERROR",
              locator: { physicalLine: 1, jsonPointer: "" }
            }
          ],
          correlationCounts: {
            responseStreamCalls: {
              captured: 0,
              counted: 0,
              owned: 0,
              inherited: 0,
              unknown: 0
            },
            results: { matched: 0, unmatched: 0 },
            itemEvidence: { linked: 0, standalone: 0 }
          }
        },
        {
          mode: activityMode,
          renderFormat: opts.activityRenderFormat ?? "compact-json",
          deliveryRange
        }
      );
    }
  }
  const terminalEvents = opts.includeTerminalEvents ? extractCursorTerminalEvents({
    runtime: "cursor",
    sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
    nativeSessionId: opts.cursorIdentity.sessionId,
    analysis,
    fromIndex,
    nextIndex
  }) : void 0;
  return {
    schemaVersion: 2,
    runtime: "cursor",
    sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
    transcriptPath,
    recordedCwd: opts.recordedCwd ?? opts.cursorIdentity.canonicalCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    engagement,
    mode: opts.mode ?? "review",
    range: {
      indexBase: "zero-based-jsonl-frame-index",
      fromIndex,
      toIndex: rawToIndex,
      nextIndex,
      totalFrames: scan.totalFrames,
      renderedFromIndex,
      renderedToIndex,
      newFrames: rawCount
    },
    accounting,
    entries,
    ...activity ? { activity } : {},
    ...terminalEvents && terminalEvents.length > 0 ? { terminalEvents } : {},
    filters,
    warnings,
    fallbacks: opts.fallbacks ?? [],
    cursorEvidence: {
      projection: opts.cursorProjection,
      continuity: opts.cursorContinuity,
      status,
      lifecycleEvents,
      bufferedFromFrame: bufferedFromIndex,
      blockingFrame
    }
  };
}
async function buildDigest(runtime, transcriptPath, opts = {}) {
  if (runtime === "cursor" && isCursorBuildDigestOptions(opts)) {
    return buildCursorDigest(transcriptPath, opts);
  }
  const {
    fromIndex = 0,
    mode = "review",
    includeToolCalls = false,
    includeToolResults = false,
    includeCommandMessages = false,
    includeActivity = false,
    includeTerminalEvents = false,
    activityRenderFormat = "compact-json",
    maxTurns,
    maxBytes,
    fallbacks = []
  } = opts;
  const warnings = [...opts.warnings ?? []];
  const effectiveIncludeToolCalls = includeActivity ? false : includeToolCalls;
  const effectiveIncludeToolResults = includeActivity ? false : includeToolResults;
  const capturedRead = includeActivity || includeTerminalEvents ? opts.capturedRead ?? await readRecordsDetailed(transcriptPath) : void 0;
  const records = capturedRead ? capturedRead.records.map(({ record }) => record) : await readRecords(transcriptPath);
  const totalRecords = records.length;
  const engagement = classifyTranscriptRecords(runtime, records);
  const bootstrapRecordIndexes = new Set(engagement.bootstrapRecordIndexes);
  const identity = opts.identity ?? extractMetaFromRecords(runtime, records, transcriptPath);
  let sessionId = opts.sessionId ?? identity?.sessionId;
  const recordedCwd = opts.recordedCwd ?? identity?.recordedCwd ?? null;
  sessionId ??= "unknown";
  if (runtime === "codex" && identity?.nativeSessionId && (identity.parentSessionId || identity.rootSessionId && identity.nativeSessionId !== identity.rootSessionId)) {
    const boundary = identity.subagentHistoryStartOrdinal;
    const warning = boundary === void 0 ? `Codex child session ${identity.nativeSessionId} may include inherited parent context; ownership boundary is unknown.` : `Codex child session ${identity.nativeSessionId} includes inherited parent context before ordinal ${boundary}.`;
    if (!warnings.includes(warning)) warnings.push(warning);
  }
  const effectiveFromIndex = fromIndex > totalRecords ? 0 : fromIndex;
  if (fromIndex > totalRecords && totalRecords > 0) {
    warnings.push(
      `Transcript shrank (stored offset ${fromIndex} > totalRecords ${totalRecords}); reset to 0.`
    );
  }
  const rawFromIndex = effectiveFromIndex;
  const rawToIndex = totalRecords > rawFromIndex ? totalRecords - 1 : rawFromIndex;
  const rawCount = Math.max(0, totalRecords - rawFromIndex);
  const terminalEvents = includeTerminalEvents && capturedRead && runtime !== "cursor" ? extractRecordedTerminalEvents({
    runtime,
    sessionId,
    nativeSessionId: identity?.nativeSessionId ?? sessionId,
    read: capturedRead,
    fromIndex: rawFromIndex,
    nextIndex: totalRecords
  }) : void 0;
  const apiErrorRecordIndexes = new Set(
    terminalEvents?.flatMap(
      (event) => event.status === "api-error" && event.source.recordIndex !== void 0 ? [event.source.recordIndex] : []
    ) ?? []
  );
  const allEntriesWithToolsBeforeBootstrap = normalizeEntries(
    runtime,
    records,
    {
      includeToolCalls: true,
      includeToolResults: true,
      includeCommandMessages: true
    }
  );
  const allEntriesBeforeBootstrap = normalizeEntries(runtime, records, {
    // The activity projection owns tool calls/results in activity mode. Ask
    // user exchanges survive these filters in the legacy normalizer.
    includeToolCalls: effectiveIncludeToolCalls,
    includeToolResults: effectiveIncludeToolResults,
    includeCommandMessages
  });
  const allEntriesWithTools = allEntriesWithToolsBeforeBootstrap.filter(
    (e) => !bootstrapRecordIndexes.has(e.recordIndex) && !apiErrorRecordIndexes.has(e.recordIndex)
  );
  const allEntries = allEntriesBeforeBootstrap.filter(
    (e) => !bootstrapRecordIndexes.has(e.recordIndex) && !apiErrorRecordIndexes.has(e.recordIndex)
  );
  const entriesBeforeTailSlice = allEntries.filter(
    (e) => e.recordIndex >= effectiveFromIndex
  );
  let filteredEntries = entriesBeforeTailSlice;
  filteredEntries = applyTailSlice(filteredEntries, { maxTurns, maxBytes });
  let autoLargeDigest = null;
  const explicitTailSlice = Boolean(
    maxTurns && maxTurns > 0 || maxBytes && maxBytes > 0
  );
  if (!explicitTailSlice && renderedCharCount(filteredEntries) > LARGE_OUTPUT_THRESHOLD) {
    const beforeCount = filteredEntries.length;
    filteredEntries = applyTailSlice(filteredEntries, {
      maxTurns: AUTO_LARGE_DIGEST_TURNS
    });
    autoLargeDigest = {
      thresholdChars: LARGE_OUTPUT_THRESHOLD,
      retainedTurnGroups: AUTO_LARGE_DIGEST_TURNS,
      originalRenderedMessages: beforeCount,
      retainedRenderedMessages: filteredEntries.length,
      omittedRenderedMessages: Math.max(
        0,
        beforeCount - filteredEntries.length
      )
    };
    warnings.push(
      `Large digest fallback: rendered content exceeded ${LARGE_OUTPUT_THRESHOLD.toLocaleString()} chars; showing the last ${AUTO_LARGE_DIGEST_TURNS} user/assistant turn groups. Use --max-turns, --max-bytes, or --include-command-messages for a different view.`
    );
  }
  const renderedFromIndex = filteredEntries.length > 0 ? Math.min(...filteredEntries.map((e) => e.recordIndex)) : null;
  const renderedToIndex = filteredEntries.length > 0 ? Math.max(...filteredEntries.map((e) => e.recordIndex)) : null;
  const range = {
    indexBase: "zero-based-jsonl-record-index",
    fromIndex: rawFromIndex,
    toIndex: rawToIndex,
    nextIndex: totalRecords,
    totalRecords,
    renderedFromIndex,
    renderedToIndex,
    newRecords: rawCount
  };
  const filters = {
    includeToolCalls: effectiveIncludeToolCalls,
    includeToolResults: effectiveIncludeToolResults,
    includeCommandMessages
  };
  const fullEntriesInRawRange = allEntriesWithTools.filter(
    (e) => e.recordIndex >= rawFromIndex
  );
  const fullEntriesInRawRangeBeforeBootstrap = allEntriesWithToolsBeforeBootstrap.filter(
    (e) => e.recordIndex >= rawFromIndex
  );
  const rawRecordIndexesWithAnyEntry = new Set(
    fullEntriesInRawRangeBeforeBootstrap.map((e) => e.recordIndex)
  );
  const rawRecordIndexes = /* @__PURE__ */ new Set();
  for (let i = rawFromIndex; i < totalRecords; i++) rawRecordIndexes.add(i);
  const accounting = {
    indexBase: "zero-based-jsonl-record-index",
    raw: {
      fromIndex: rawFromIndex,
      toIndex: rawToIndex,
      count: rawCount,
      nextIndex: totalRecords,
      totalRecords
    },
    rendered: {
      count: filteredEntries.length,
      fromIndex: renderedFromIndex,
      toIndex: renderedToIndex,
      askUserEntries: filteredEntries.filter((e) => e.kind === "ask_user").length
    },
    filtered: {
      toolCalls: effectiveIncludeToolCalls ? 0 : fullEntriesInRawRange.filter((e) => e.kind === "tool_call").length,
      toolResults: effectiveIncludeToolResults ? 0 : fullEntriesInRawRange.filter((e) => e.kind === "tool_result").length,
      commandMessages: includeCommandMessages ? 0 : fullEntriesInRawRange.filter((e) => e.kind === "command_message").length,
      bootstrapRecords: [...bootstrapRecordIndexes].filter(
        (index) => index >= rawFromIndex
      ).length,
      bootstrapMessages: fullEntriesInRawRangeBeforeBootstrap.filter(
        (e) => bootstrapRecordIndexes.has(e.recordIndex)
      ).length,
      ...includeTerminalEvents ? {
        apiErrorRecords: [...apiErrorRecordIndexes].filter(
          (index) => index >= rawFromIndex && index < totalRecords
        ).length
      } : {},
      metadataRecords: [...rawRecordIndexes].filter(
        (index) => !rawRecordIndexesWithAnyEntry.has(index) && !apiErrorRecordIndexes.has(index)
      ).length,
      tailSliceEntries: Math.max(
        0,
        entriesBeforeTailSlice.length - filteredEntries.length
      )
    },
    recovery: {
      omittedUserMessages: omittedUserMessageRecoveryPointers(
        entriesBeforeTailSlice,
        filteredEntries,
        transcriptPath
      )
    },
    autoLargeDigest
  };
  let activity;
  if (includeActivity && capturedRead && runtime !== "cursor") {
    const activityMode = mode === "catch-up" ? "catch-up" : "review";
    const source = {
      runtime,
      sessionId,
      nativeSessionId: identity?.nativeSessionId ?? sessionId,
      transcriptPath
    };
    try {
      activity = projectActivity(
        correlateActivity(extractActivity({ source, read: capturedRead })),
        {
          mode: activityMode,
          renderFormat: activityRenderFormat,
          deliveryRange: {
            indexBase: "zero-based-decoded-record-index",
            start: rawFromIndex,
            end: totalRecords
          }
        }
      );
    } catch {
      activity = projectActivity(
        {
          activitySchemaVersion: 1,
          source,
          sourceSnapshot: {
            capturedAt: capturedRead.capturedAt,
            sourceBytes: capturedRead.sourceBytes
          },
          events: [],
          coverage: [
            {
              dataClass: "record-activity",
              status: "not-read",
              captured: 0
            }
          ],
          diagnostics: [
            {
              code: "ACTIVITY_EXTRACTION_ERROR",
              locator: { physicalLine: 1, jsonPointer: "" }
            }
          ],
          correlationCounts: {
            responseStreamCalls: {
              captured: 0,
              counted: 0,
              owned: 0,
              inherited: 0,
              unknown: 0
            },
            results: { matched: 0, unmatched: 0 },
            itemEvidence: { linked: 0, standalone: 0 }
          }
        },
        {
          mode: activityMode,
          renderFormat: activityRenderFormat,
          deliveryRange: {
            indexBase: "zero-based-decoded-record-index",
            start: rawFromIndex,
            end: totalRecords
          }
        }
      );
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION2,
    runtime,
    sessionId,
    ...identity?.nativeSessionId ? { nativeSessionId: identity.nativeSessionId } : {},
    ...identity?.rootSessionId ? { rootSessionId: identity.rootSessionId } : {},
    ...identity?.parentSessionId ? { parentSessionId: identity.parentSessionId } : {},
    ...identity?.forkedFromSessionId ? { forkedFromSessionId: identity.forkedFromSessionId } : {},
    ...identity?.subagentHistoryStartOrdinal === void 0 ? {} : {
      subagentHistoryStartOrdinal: identity.subagentHistoryStartOrdinal
    },
    transcriptPath,
    recordedCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    engagement,
    mode,
    range,
    accounting,
    entries: filteredEntries,
    ...activity ? { activity } : {},
    ...terminalEvents && terminalEvents.length > 0 ? { terminalEvents } : {},
    filters,
    warnings,
    fallbacks
  };
}

// src/skills/session-observer-collab/src/lib/completion-selection.mjs
var RECORD_INDEX_BASE = "zero-based-jsonl-record-index";
var FRAME_INDEX_BASE = "zero-based-jsonl-frame-index";
var NO_OP_PREFIX2 = /^\s*\[no-op\](?:\s|$)/iu;
var ACKNOWLEDGMENT = /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
var STATUS_ECHO = /^\s*(?:status:\s*)?(?:(?:still\s+)?(?:waiting|holding|idle|armed|monitoring)(?:\s+(?:for|on|until)\s+[^.!?;:]+)?|no (?:new )?(?:input|updates?|messages?|changes?))[.!]*\s*$/iu;
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}
function requireObserverResult(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("observer result must be an object");
  if (!Array.isArray(input.entries))
    throw new TypeError("observer result entries must be an array");
  return input;
}
function validateV1Digest(input) {
  const range = input.range;
  const raw = input.accounting?.raw;
  if (!range || range.indexBase !== RECORD_INDEX_BASE || input.accounting?.indexBase !== RECORD_INDEX_BASE || !raw) {
    throw new TypeError("observer result must include raw range accounting");
  }
  const fromIndex = integer(range.fromIndex, "range.fromIndex");
  const nextIndex = integer(range.nextIndex, "range.nextIndex");
  const totalRecords = integer(range.totalRecords, "range.totalRecords");
  if (nextIndex !== totalRecords || raw.fromIndex !== fromIndex || raw.nextIndex !== nextIndex || raw.totalRecords !== totalRecords || raw.count !== Math.max(0, nextIndex - fromIndex) || range.newRecords !== raw.count) {
    throw new TypeError("observer range and accounting must agree exactly");
  }
  if (input.accounting.rendered?.count !== input.entries.length || input.accounting.filtered?.tailSliceEntries > 0 || input.accounting.autoLargeDigest) {
    throw new TypeError(
      "observer result must contain the complete normalized range"
    );
  }
  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new TypeError(`entries[${index}] must be an object`);
    integer(entry.recordIndex, `entries[${index}].recordIndex`);
    if (entry.recordIndex < fromIndex || entry.recordIndex >= nextIndex || entry.role !== "user" && entry.role !== "assistant" || typeof entry.text !== "string" || typeof entry.kind !== "string") {
      throw new TypeError(
        `entries[${index}] is outside the normalized contract`
      );
    }
    return entry;
  });
  entries.sort((left, right) => left.recordIndex - right.recordIndex);
  return {
    entries,
    fromIndex,
    indexBase: RECORD_INDEX_BASE,
    nextIndex,
    selectedPrefix: null
  };
}
function nullableIndex(value, label) {
  if (value === null) return null;
  return integer(value, label);
}
function validateSelectedPrefix(value, selectedNextIndex) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.indexBase !== FRAME_INDEX_BASE || integer(value.nextFrameIndex, "selectedPrefix.nextFrameIndex") !== selectedNextIndex || !Number.isSafeInteger(value.prefixBytes) || value.prefixBytes < 0 || value.observedSize !== value.prefixBytes || !/^[a-f0-9]{64}$/u.test(value.prefixSha256) || !Number.isSafeInteger(value.device) || value.device < 0 || !Number.isSafeInteger(value.inode) || value.inode < 0) {
    throw new TypeError(
      "observer result must bind the selected Cursor prefix snapshot"
    );
  }
  return Object.freeze({ ...value });
}
function validateV2Digest(input) {
  if (input.runtime !== "cursor") {
    throw new TypeError("observer result schemaVersion 2 must use Cursor");
  }
  if (input.cursorEvidence?.projection !== "confirmed-completion") {
    throw new TypeError(
      "observer result schemaVersion 2 must use confirmed-completion projection"
    );
  }
  const range = input.range;
  const accounting = input.accounting;
  const raw = accounting?.raw;
  if (!range || range.indexBase !== FRAME_INDEX_BASE || accounting?.indexBase !== FRAME_INDEX_BASE || !raw) {
    throw new TypeError(
      "observer result schemaVersion 2 must use the frame index base"
    );
  }
  const fromIndex = integer(range.fromIndex, "range.fromIndex");
  const nextIndex = integer(range.nextIndex, "range.nextIndex");
  const totalFrames = integer(range.totalFrames, "range.totalFrames");
  const rawCount = Math.max(0, nextIndex - fromIndex);
  const expectedToIndex = rawCount > 0 ? nextIndex - 1 : null;
  if (fromIndex > nextIndex || nextIndex > totalFrames || nullableIndex(range.toIndex, "range.toIndex") !== expectedToIndex || range.newFrames !== rawCount || raw.fromIndex !== fromIndex || raw.toIndex !== expectedToIndex || raw.count !== rawCount || raw.nextIndex !== nextIndex || raw.totalFrames !== totalFrames) {
    throw new TypeError(
      "observer result must contain complete frame range accounting"
    );
  }
  const rendered = accounting.rendered;
  const buffered = accounting.buffered;
  const bufferedCount = totalFrames - nextIndex;
  const hasPendingSuffix = bufferedCount > 0;
  const completeBufferedSuffix = buffered && (hasPendingSuffix ? buffered.fromIndex === nextIndex && buffered.count === bufferedCount && buffered.reason === "stability-wait" && input.cursorEvidence.bufferedFromFrame === nextIndex && input.cursorEvidence.status?.lifecycle === "pending" : buffered.fromIndex === null && buffered.count === 0 && buffered.reason === null && input.cursorEvidence.bufferedFromFrame === null);
  if (!rendered || rendered.count !== input.entries.length || !buffered || !completeBufferedSuffix || accounting.filtered?.unstableContent !== 0 || input.cursorEvidence.blockingFrame !== null || input.cursorEvidence.status?.health !== "healthy") {
    throw new TypeError(
      "observer result must contain the complete confirmed-completion range"
    );
  }
  const lifecycleEvents = input.cursorEvidence.lifecycleEvents;
  if (!Array.isArray(lifecycleEvents)) {
    throw new TypeError(
      "observer result must include confirmed completion lifecycle events"
    );
  }
  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`entries[${index}] must be an object`);
    }
    const deliveryIndex = integer(
      entry.recordIndex,
      `entries[${index}].recordIndex`
    );
    const sourceFrameIndex = integer(
      entry.sourceFrameIndex,
      `entries[${index}].sourceFrameIndex`
    );
    const matchingLifecycle = lifecycleEvents.some(
      (event) => event?.turnId === entry.turnId && event.terminalFrameIndex === deliveryIndex && event.lifecycle === "success" && event.finalEntryKey === entry.entryKey
    );
    if (deliveryIndex < fromIndex || deliveryIndex >= nextIndex || sourceFrameIndex < fromIndex || sourceFrameIndex > deliveryIndex || entry.role !== "assistant" || entry.kind !== "message" || typeof entry.text !== "string" || typeof entry.entryKey !== "string" || entry.entryKey.length === 0 || typeof entry.turnId !== "string" || entry.turnId.length === 0 || entry.availability !== "completed" || !matchingLifecycle) {
      throw new TypeError(
        `entries[${index}] is outside the confirmed-completion contract`
      );
    }
    return entry;
  });
  entries.sort((left, right) => left.recordIndex - right.recordIndex);
  const renderedFromIndex = entries.length > 0 ? entries[0].recordIndex : null;
  const renderedToIndex = entries.length > 0 ? entries.at(-1).recordIndex : null;
  if (range.renderedFromIndex !== renderedFromIndex || range.renderedToIndex !== renderedToIndex || rendered.fromIndex !== renderedFromIndex || rendered.toIndex !== renderedToIndex) {
    throw new TypeError(
      "observer result must contain complete rendered frame accounting"
    );
  }
  return {
    entries,
    fromIndex,
    indexBase: FRAME_INDEX_BASE,
    nextIndex,
    selectedPrefix: validateSelectedPrefix(
      input.cursorEvidence.selectedPrefix,
      entries.at(-1)?.recordIndex + 1 || nextIndex
    )
  };
}
function validateDigest(input) {
  const result = requireObserverResult(input);
  if (result.schemaVersion === 1) return validateV1Digest(result);
  if (result.schemaVersion === 2) return validateV2Digest(result);
  throw new TypeError("observer result schemaVersion must be 1 or 2");
}
function isAutomatic(entry) {
  return entry.origin === "automatic-control" || entry.displayRole === "automatic-control" || entry.automaticControl?.automatic === true;
}
function isRuntimeNotification(entry) {
  return entry.origin === "runtime-notification" || entry.displayRole === "runtime-notification";
}
function completedTurns(entries, fromIndex) {
  const turns = [];
  let start = fromIndex;
  let current = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    current.push(entry);
    if (entry.role !== "assistant" || entry.kind !== "message" || entry.origin === "runtime-diagnostic") {
      continue;
    }
    const next = entries[index + 1];
    if (next?.role === "assistant" && next.kind === "message" && next.origin !== "runtime-diagnostic") {
      continue;
    }
    const assistantEntries = current.filter(
      (candidate) => candidate.role === "assistant" && candidate.kind === "message" && candidate.origin !== "runtime-diagnostic" && !isAutomatic(candidate)
    );
    const text = assistantEntries.map((candidate) => candidate.text).join("\n");
    const automaticWake = current.some(isAutomatic);
    const classification = text.trim().length === 0 ? "empty-turn" : NO_OP_PREFIX2.test(text) ? "no-op-turn" : automaticWake && (ACKNOWLEDGMENT.test(text) || STATUS_ECHO.test(text)) ? "automatic-control-turn" : "substantive-turn";
    turns.push({
      fromIndex: start,
      toIndex: entry.recordIndex,
      classification
    });
    start = entry.recordIndex + 1;
    current = [];
  }
  const incompleteFrom = current.some(
    (entry) => entry.role === "user" && !isAutomatic(entry) && !isRuntimeNotification(entry)
  ) ? start : null;
  return { turns, incompleteFrom };
}
function mergeSkipped(turns, fromIndex, nextIndex) {
  const skipped = [];
  let cursor = fromIndex;
  for (const turn of turns) {
    if (turn.fromIndex > cursor) {
      skipped.push({
        fromIndex: cursor,
        toIndex: turn.fromIndex - 1,
        classification: "metadata-only"
      });
    }
    skipped.push(turn);
    cursor = turn.toIndex + 1;
  }
  if (cursor < nextIndex) {
    skipped.push({
      fromIndex: cursor,
      toIndex: nextIndex - 1,
      classification: "metadata-only"
    });
  }
  return skipped;
}
function selectCompletedContinuation(observerResult) {
  const { entries, fromIndex, indexBase, nextIndex, selectedPrefix } = validateDigest(observerResult);
  if (indexBase === FRAME_INDEX_BASE) {
    const selected2 = entries.at(-1);
    if (!selected2) {
      return Object.freeze({
        status: "no-continuation",
        continuation: false,
        indexBase,
        fromIndex,
        completedIndex: null,
        completedRecord: null,
        nextCursor: nextIndex,
        peerCursor: nextIndex,
        budgetCost: 0,
        range: null,
        reviewEntries: Object.freeze([]),
        skipped: Object.freeze(mergeSkipped([], fromIndex, nextIndex)),
        selectedPrefix
      });
    }
    const completedIndex = selected2.recordIndex;
    const cursor2 = completedIndex + 1;
    return Object.freeze({
      status: "continuation",
      continuation: true,
      indexBase,
      fromIndex,
      completedIndex,
      completedRecord: completedIndex,
      nextCursor: cursor2,
      peerCursor: cursor2,
      budgetCost: 1,
      range: Object.freeze({
        indexBase,
        fromIndex,
        toIndex: completedIndex
      }),
      reviewEntries: Object.freeze(
        entries.filter((entry) => entry.recordIndex <= completedIndex)
      ),
      skipped: Object.freeze([]),
      selectedPrefix
    });
  }
  const { turns, incompleteFrom } = completedTurns(entries, fromIndex);
  const selected = turns.findLast(
    (turn) => turn.classification === "substantive-turn"
  );
  if (!selected) {
    const safeCursor = incompleteFrom ?? nextIndex;
    return Object.freeze({
      status: "no-continuation",
      continuation: false,
      indexBase,
      fromIndex,
      completedIndex: null,
      completedRecord: null,
      nextCursor: safeCursor,
      peerCursor: safeCursor,
      budgetCost: 0,
      range: null,
      reviewEntries: Object.freeze([]),
      skipped: Object.freeze(mergeSkipped(turns, fromIndex, safeCursor)),
      selectedPrefix
    });
  }
  const completedRecord = selected.toIndex;
  const cursor = completedRecord + 1;
  return Object.freeze({
    status: "continuation",
    continuation: true,
    indexBase,
    fromIndex,
    completedIndex: completedRecord,
    completedRecord,
    nextCursor: cursor,
    peerCursor: cursor,
    budgetCost: 1,
    range: Object.freeze({
      indexBase,
      fromIndex,
      toIndex: completedRecord
    }),
    reviewEntries: Object.freeze(
      entries.filter((entry) => entry.recordIndex <= completedRecord)
    ),
    skipped: Object.freeze([]),
    selectedPrefix
  });
}

// src/skills/session-observer-collab/src/lib/lease-state.mjs
import { randomUUID as randomUUID5 } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod as chmod2,
  lstat as lstat3,
  mkdir as mkdir2,
  open as open3,
  readFile as readFile3,
  readdir as readdir2,
  realpath as realpath3,
  rename,
  rm
} from "node:fs/promises";
import { homedir as homedir3 } from "node:os";
import { basename as basename2, dirname as dirname2, isAbsolute as isAbsolute2, join as join2, resolve, sep } from "node:path";
var LEASE_SCHEMA_VERSION = 6;
var LEASE_STATES = Object.freeze([
  "armed",
  "waiting",
  "idle",
  "triggered",
  "disarmed"
]);
var MAX_WAIT_MS2 = 6e4;
var MAX_LEASE_MS = 24 * 60 * 60 * 1e3;
var MAX_CONTINUATIONS2 = 100;
var MAX_LOOPS = 1e3;
var ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
var OWNER_RUNTIMES = /* @__PURE__ */ new Set(["claude-code", "codex", "cursor"]);
var PEER_RUNTIMES = /* @__PURE__ */ new Set(["claude-code", "codex", "cursor"]);
var RECORD_INDEX_BASE2 = "zero-based-jsonl-record-index";
var FRAME_INDEX_BASE2 = "zero-based-jsonl-frame-index";
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
    if (!isAbsolute2(env.SESSION_OBSERVER_STATE_DIR))
      throw new LeaseError(
        "invalid-state-root",
        "SESSION_OBSERVER_STATE_DIR must be absolute"
      );
    return resolve(env.SESSION_OBSERVER_STATE_DIR);
  }
  const base = env.XDG_STATE_HOME || join2(env.HOME || homedir3(), ".local", "state");
  if (!isAbsolute2(base))
    throw new LeaseError(
      "invalid-state-root",
      "XDG_STATE_HOME must be absolute"
    );
  return join2(resolve(base), "session-observer", "collab");
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
  if (typeof value !== "string" || !isAbsolute2(value) || value.includes("\0")) {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be an absolute path`
    );
  }
  return resolve(value);
}
function peerIndexBase(peerRuntime) {
  validatePeerRuntime(peerRuntime);
  return peerRuntime === "cursor" ? FRAME_INDEX_BASE2 : RECORD_INDEX_BASE2;
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
    canonicalTranscript = await realpath3(requested);
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
      canonicalStore = await realpath3(requestedStore);
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
  const leases = join2(resolve(root), "leases");
  const candidate = join2(leases, `${ownerSession}.json`);
  if (!candidate.startsWith(`${leases}${sep}`))
    throw new LeaseError("invalid-owner-session", "unsafe lease path");
  return candidate;
}
function integer2(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new LeaseError(
      "malformed-lease",
      `${name} must be an integer from ${min} to ${max}`
    );
  }
  return value;
}
function timestamp2(value, name) {
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
      peerIndexBase: RECORD_INDEX_BASE2,
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
  value.armedAt = timestamp2(value.armedAt, "armedAt");
  value.expiresAt = timestamp2(value.expiresAt, "expiresAt");
  value.updatedAt = timestamp2(value.updatedAt, "updatedAt");
  if (value.waitStartedAt === null !== (value.waitDeadlineAt === null)) {
    throw new LeaseError(
      "malformed-lease",
      "wait timing fields must both be timestamps or both be null"
    );
  }
  if (value.waitStartedAt !== null) {
    value.waitStartedAt = timestamp2(value.waitStartedAt, "waitStartedAt");
    value.waitDeadlineAt = timestamp2(value.waitDeadlineAt, "waitDeadlineAt");
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
    integer2(value.waitPid, "waitPid", 1, Number.MAX_SAFE_INTEGER);
  }
  integer2(value.waitMs, "waitMs", 0, MAX_WAIT_MS2);
  integer2(value.leaseMs, "leaseMs", 1, MAX_LEASE_MS);
  integer2(value.peerCursor, "peerCursor", 0, Number.MAX_SAFE_INTEGER);
  if (value.peerRuntime === "cursor" && value.peerContinuity === null) {
    throw new LeaseError(
      "cursor-lease-rearm-required",
      "Cursor lease is missing a continuity checkpoint; explicit re-arm required"
    );
  }
  if (value.peerContinuity !== null) {
    const checkpoint = value.peerContinuity;
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint) || value.peerRuntime !== "cursor" || value.peerIndexBase !== FRAME_INDEX_BASE2) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity is allowed only for Cursor frame-index leases"
      );
    }
    if (checkpoint.indexBase !== FRAME_INDEX_BASE2) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity index base must match the lease index base"
      );
    }
    integer2(
      checkpoint.nextFrameIndex,
      "peerContinuity.nextFrameIndex",
      0,
      Number.MAX_SAFE_INTEGER
    );
    integer2(
      checkpoint.prefixBytes,
      "peerContinuity.prefixBytes",
      0,
      Number.MAX_SAFE_INTEGER
    );
    integer2(
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
        integer2(
          checkpoint[field],
          `peerContinuity.${field}`,
          0,
          Number.MAX_SAFE_INTEGER
        );
      }
    }
  }
  integer2(value.continuationCount, "continuationCount", 0, MAX_CONTINUATIONS2);
  integer2(value.continuationCap, "continuationCap", 1, MAX_CONTINUATIONS2);
  integer2(value.loopCount, "loopCount", 0, MAX_LOOPS);
  integer2(value.loopCap, "loopCap", 1, MAX_LOOPS);
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
  integer2(pid, "waitPid", 1, Number.MAX_SAFE_INTEGER);
  return Object.freeze({
    token: randomUUID5(),
    pid
  });
}
async function atomicWriteJson(file, value) {
  await mkdir2(dirname2(file), { recursive: true, mode: 448 });
  await chmod2(dirname2(file), 448);
  const temp = `${file}.${process.pid}.${randomUUID5()}.tmp`;
  const handle = await open3(temp, "wx", 384);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
  await chmod2(file, 384);
}
async function readLease(root, ownerSession, { persistMigration = true } = {}) {
  const file = leasePath(root, ownerSession);
  let raw;
  try {
    const metadata = await lstat3(file);
    const wrongOwner = typeof process.getuid === "function" && metadata.uid !== process.getuid();
    if (!metadata.isFile() || metadata.isSymbolicLink() || wrongOwner || (metadata.mode & 63) !== 0) {
      throw new LeaseError(
        "unsafe-lease",
        "lease must be a regular owner-only file owned by this user"
      );
    }
    raw = JSON.parse(await readFile3(file, "utf8"));
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
      handle = await open3(lock, "wx", 384);
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
    const nextCursor = integer2(
      update.peerCursor,
      "peerCursor",
      current.peerCursor,
      Number.MAX_SAFE_INTEGER
    );
    const loopIncrement = integer2(
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
async function compareAndSwapCursor(root, ownerSession, expected, cursorUpdate2, now = Date.now()) {
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
    const update = cursorUpdate2 && typeof cursorUpdate2 === "object" && !Array.isArray(cursorUpdate2) ? cursorUpdate2 : { peerCursor: cursorUpdate2 };
    const nextCursor = integer2(
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
async function resourceExists(path7) {
  try {
    await access(path7, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// src/skills/session-observer-collab/src/lib/runtime-adapter.mjs
import { createHash as createHash6 } from "node:crypto";
import { open as open4 } from "node:fs/promises";
var RUNTIME_ADAPTER_VERSION = 2;
function fileIdentity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
async function hashPrefix(handle, prefixBytes) {
  const hash = createHash6("sha256");
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
    handle = await open4(lease.peerCanonicalTranscriptPath, "r");
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
async function advanceAdapterCursor(root, invocation, expected, cursorUpdate2) {
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
    cursorUpdate2
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

// src/skills/session-observer-collab/src/lib/selected-prefix.mjs
import { createHash as createHash8 } from "node:crypto";
import { open as open6 } from "node:fs/promises";

// src/shared/transcript/cursor-frames.ts
import { createHash as createHash7 } from "node:crypto";
import { open as open5 } from "node:fs/promises";
function isJsonObject4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseClosedFrame(frameBytes) {
  if (frameBytes.length === 0) {
    return { parseState: "blank", record: null };
  }
  try {
    const value = JSON.parse(frameBytes.toString("utf8"));
    if (!isJsonObject4(value)) {
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
  const handle = await open5(transcriptPath, "r");
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash7("sha256");
    const verifiedPrefixHash = options.verifyPrefixBytes === void 0 ? null : createHash7("sha256");
    let verifiedBytes = 0;
    let verifiedPrefixSha256 = options.verifyPrefixBytes === 0 ? createHash7("sha256").digest("hex") : null;
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
function validSelectedPrefix(snapshot) {
  return snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot) && snapshot.indexBase === "zero-based-jsonl-frame-index" && nonNegativeInteger(snapshot.nextFrameIndex) && nonNegativeInteger(snapshot.prefixBytes) && SHA256.test(snapshot.prefixSha256) && snapshot.observedSize === snapshot.prefixBytes && nonNegativeInteger(snapshot.device) && nonNegativeInteger(snapshot.inode);
}
async function readBoundedHashes(transcript, selectedPrefixBytes, verificationPrefixBytes) {
  if (!nonNegativeInteger(selectedPrefixBytes) || !nonNegativeInteger(verificationPrefixBytes) || selectedPrefixBytes > verificationPrefixBytes) {
    throw selectedPrefixError();
  }
  const selectedHash = createHash8("sha256");
  const verificationHash = createHash8("sha256");
  const handle = await open6(transcript, "r");
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
async function observeCursorCompletion(lease) {
  const identity = {
    runtime: "cursor",
    sessionId: lease.peerSession,
    projectCwd: lease.ownerCwd,
    canonicalCwd: lease.ownerCwd,
    canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
    cwdEvidence: ["direct-project-root"],
    sessionEvidence: ["explicit-pin"],
    strength: "exact",
    reasons: []
  };
  const accumulator = createCursorTurnAccumulator(identity, lease.peerCursor);
  const frameEnds = [];
  const scan = await scanCursorTranscript(lease.peerTranscript, {
    verifyPrefixBytes: lease.peerContinuity?.prefixBytes,
    onFrame(frame) {
      accumulator.onFrame(frame);
      frameEnds[frame.frameIndex] = frame.closed && (frame.parseState === "parsed" || frame.parseState === "blank") ? frame.byteEnd : null;
    }
  });
  const prior = lease.peerContinuity;
  if (prior !== null && (scan.file.size < prior.observedSize || scan.file.size < prior.prefixBytes || scan.file.device !== prior.device || scan.file.inode !== prior.inode || scan.verifiedPrefixSha256 !== prior.prefixSha256)) {
    throw new Error("cursor continuity changed during completion read");
  }
  const digest = await buildDigest("cursor", lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: "review",
    sessionId: lease.peerSession,
    recordedCwd: lease.ownerCwd,
    cursorProjection: "confirmed-completion",
    cursorIdentity: identity,
    cursorScan: scan,
    cursorAnalysis: accumulator.finish(scan),
    cursorState: null,
    cursorContinuity: prior === null ? "new" : "verified"
  });
  digest.cursorEvidence.selectedPrefix = await captureSelectedPrefix(
    lease.peerTranscript,
    scan,
    frameEnds,
    digest.entries.at(-1)?.recordIndex + 1 || digest.range.nextIndex
  );
  return digest;
}
async function verifySelectedPrefix(transcript, snapshot) {
  if (!validSelectedPrefix(snapshot)) throw selectedPrefixError();
  const bounded = await readBoundedHashes(
    transcript,
    snapshot.prefixBytes,
    snapshot.prefixBytes
  );
  if (bounded.device !== snapshot.device || bounded.inode !== snapshot.inode || bounded.selectedSha256 !== snapshot.prefixSha256) {
    throw selectedPrefixError();
  }
  return Object.freeze({ ...snapshot });
}

// src/skills/session-observer-collab/src/hooks/codex-stop.mjs
var POLL_MS = 250;
function providerTerminationError() {
  const error = new Error("Codex Stop hook terminated by provider");
  error.code = "provider-terminated";
  return error;
}
function waitFor(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(providerTerminationError());
  return new Promise((resolve2, reject) => {
    const onAbort = () => reject(providerTerminationError());
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(resolve2, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}
function counters(lease) {
  return {
    leaseId: lease.leaseId,
    peerCursor: lease.peerCursor,
    continuationCount: lease.continuationCount,
    loopCount: lease.loopCount
  };
}
function refreshWakeAuthorization(now, lease, deadline) {
  const currentNow = now();
  if (currentNow >= Date.parse(lease.expiresAt)) {
    return { authorized: false, currentNow, diagnostic: "lease-expired" };
  }
  if (currentNow >= deadline) {
    return { authorized: false, currentNow, diagnostic: "wait-timeout" };
  }
  return { authorized: true, currentNow, diagnostic: null };
}
function allow(diagnostic) {
  return Object.freeze({ decision: "allow", diagnostic });
}
function messageEnvelope(messages, collaborationId, pin) {
  const wrap = (payload) => `<agent_messaging_context automatic="true" untrusted="true">
${JSON.stringify(payload).replaceAll("<", "\\u003c")}
</agent_messaging_context>`;
  const complete = wrap({
    collaborationId,
    messages: messages.map((message) => ({
      id: message.id,
      from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
      kind: message.kind,
      priority: message.priority,
      subject: message.subject,
      body: message.body,
      untrusted: true
    }))
  });
  if (complete.length <= 6e3) return complete;
  return wrap({
    collaborationId,
    messages: messages.map((message) => ({
      id: message.id,
      from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
      kind: message.kind,
      priority: message.priority,
      subject: message.subject,
      readCommand: `node <agent-messaging-skill>/scripts/agent-messaging.mjs inbox --collab ${collaborationId} --self ${pin.runtime}:${pin.sessionId} --message ${message.id}`
    })),
    notice: "Bodies exceeded the bounded host envelope; read each exact message before acknowledging it."
  });
}
async function composedState(root, identity, now) {
  const pin = { runtime: "codex", sessionId: identity.ownerSession };
  const status = await activationStatus(root, pin, new Date(now));
  const activation = status.activation;
  if (!activation) return { mode: "observation", activation: null, pin };
  if (activation.controller === "standalone-messaging") {
    return status.active ? { mode: "standalone-owner", activation, pin } : { mode: "observation", activation: null, pin };
  }
  if (!status.active) return { mode: "composed-inactive", activation, pin };
  if (activation.mechanism !== "stop" || activation.worktree !== identity.cwd) {
    return { mode: "composed-mismatch", activation, pin };
  }
  return { mode: "composed", activation, pin };
}
async function composedStillActive(root, identity, activation, now) {
  const state = await composedState(root, identity, now);
  return state.mode === "composed" && state.activation?.id === activation.id;
}
async function claimComposedRequests(root, identity, composition, now, options) {
  const inbox = await listInbox({
    root,
    collaborationId: composition.activation.collaborationId,
    pin: composition.pin
  }).catch(() => null);
  if (!inbox) return allow("messaging-inbox-invalid");
  const requests = inbox.messages.filter(
    (message) => message.kind === "request" && !message.inert
  );
  if (requests.length === 0) return null;
  const deliveryKeys = await resolveDeliveryKeys({
    root,
    activation: composition.activation,
    messages: requests
  });
  const claim = await claimDelivery({
    root,
    pin: composition.pin,
    eventKey: `codex:composed-message:${identity.eventId}`,
    deliveryKeys,
    now: new Date(now()),
    clock: () => new Date(now()),
    hooks: options.messageClaimHooks
  }).catch(() => null);
  if (!claim?.slot || claim.owned.length === 0 || !claim.activeAfterClaim || !await composedStillActive(root, identity, composition.activation, now())) {
    return allow("messaging-claim-refused");
  }
  const owned = new Set(claim.owned.map((item) => item.messageId));
  return Object.freeze({
    decision: "block",
    reason: messageEnvelope(
      requests.filter((message) => owned.has(message.id)),
      composition.activation.collaborationId,
      composition.pin
    )
  });
}
function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function completionIndexBase(value) {
  if (value !== "zero-based-jsonl-record-index" && value !== "zero-based-jsonl-frame-index") {
    throw new TypeError("range.indexBase must be a supported index base");
  }
  return value;
}
function wakeEnvelope(lease, range) {
  const peer = `${lease.peerRuntime}:${lease.peerSession}`;
  const indexBase = completionIndexBase(range.indexBase);
  return [
    '<session_observer_wake automatic="true" schema_version="2"',
    `  runtime="codex" lease_id="${escapeAttribute(lease.leaseId)}"`,
    `  peer="${escapeAttribute(peer)}" index_base="${indexBase}"`,
    `  records="${range.fromIndex}-${range.toIndex}">`,
    "Review the pinned peer range and respond only if it contains substantive new information.",
    "</session_observer_wake>"
  ].join("\n");
}
var CODEX_STOP_ADAPTER = defineRuntimeAdapter({
  runtime: "codex",
  identify(event) {
    if (!event || typeof event !== "object") return null;
    if (event.hook_event_name !== "Stop") return null;
    try {
      let eventId = null;
      if (typeof event.event_id === "string" && event.event_id.length > 0) {
        try {
          eventId = validateId(event.event_id, "event-id");
        } catch {
          eventId = null;
        }
      }
      return Object.freeze({
        ownerSession: validateId(event.session_id, "owner-session"),
        cwd: validateAbsolutePath(event.cwd, "cwd"),
        eventId
      });
    } catch {
      return null;
    }
  },
  emit(lease, range) {
    return Object.freeze({
      decision: "block",
      reason: wakeEnvelope(lease, range)
    });
  }
});
async function defaultObserve(lease) {
  if (lease.peerRuntime === "cursor") {
    return observeCursorCompletion(lease);
  }
  return buildDigest(lease.peerRuntime, lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: "review",
    sessionId: lease.peerSession
  });
}
function validSelection(selection, expected, lease) {
  return selection.continuation === true && selection.indexBase === lease.peerIndexBase && selection.range !== null && selection.range.fromIndex === expected.peerCursor && selection.range.toIndex === selection.completedRecord && selection.peerCursor === selection.completedRecord + 1;
}
function isPendingCursorCompletion(digest, lease) {
  return lease.peerRuntime === "cursor" && digest?.schemaVersion === 2 && digest.runtime === "cursor" && digest.range?.indexBase === "zero-based-jsonl-frame-index" && digest.accounting?.indexBase === "zero-based-jsonl-frame-index" && digest.cursorEvidence?.projection === "confirmed-completion" && digest.cursorEvidence?.status?.lifecycle === "pending" && digest.cursorEvidence?.blockingFrame === null && digest.accounting?.buffered?.reason === "stability-wait" && digest.range.fromIndex === lease.peerCursor && digest.range.nextIndex === lease.peerCursor;
}
function validDigestForLease(digest, lease) {
  if (lease.peerRuntime !== "cursor") return digest?.schemaVersion === 1;
  return digest?.schemaVersion === 2 && digest.runtime === "cursor" && digest.range?.indexBase === lease.peerIndexBase && digest.accounting?.indexBase === lease.peerIndexBase && digest.cursorEvidence?.projection === "confirmed-completion";
}
async function cursorUpdate(lease, selection) {
  if (lease.peerRuntime !== "cursor") {
    return Object.freeze({ peerCursor: selection.peerCursor });
  }
  return Object.freeze({
    peerCursor: selection.peerCursor,
    peerContinuity: await verifySelectedPrefix(
      lease.peerTranscript,
      selection.selectedPrefix
    )
  });
}
async function runCodexStopHook(event, options = {}) {
  const identity = CODEX_STOP_ADAPTER.identify(event);
  if (!identity) return allow("invalid-hook-input");
  const root = options.root ?? stateRoot(options.env ?? process.env);
  const observe = options.observe ?? defaultObserve;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve2) => setTimeout(resolve2, ms)));
  const now = options.now ?? Date.now;
  const signal = options.signal;
  let currentNow = now();
  let lease;
  try {
    lease = await readLease(root, identity.ownerSession);
  } catch (error) {
    return allow(error?.code ?? "malformed-lease");
  }
  if (!lease) return allow("missing");
  if (lease.ownerSession !== identity.ownerSession)
    return allow("identity-mismatch");
  const invocation = {
    runtime: "codex",
    peerRuntime: lease.peerRuntime,
    peerSession: lease.peerSession,
    ownerSession: identity.ownerSession,
    cwd: identity.cwd,
    transcript: lease.peerTranscript,
    now: currentNow
  };
  const inspected = await inspectAdapterLease(root, invocation).catch(
    (error) => ({
      eligible: false,
      reason: error?.code ?? "malformed-lease",
      lease: null
    })
  );
  if (!inspected.eligible) return allow(inspected.reason);
  if (!await resourceExists(inspected.lease.ownerCwd) || !await resourceExists(inspected.lease.peerTranscript)) {
    return allow("missing-resource");
  }
  const composition = await composedState(root, identity, currentNow).catch(
    () => ({ mode: "composed-invalid", activation: null, pin: null })
  );
  if (composition.mode === "standalone-owner")
    return allow("standalone-messaging-owner");
  if (composition.mode.startsWith("composed-")) return allow(composition.mode);
  if (composition.mode === "composed") {
    if (!identity.eventId) return allow("missing-event-id");
    const messaging = await claimComposedRequests(
      root,
      identity,
      composition,
      now,
      options
    );
    if (messaging) return messaging;
  }
  const waiting = await beginAdapterWait(root, invocation).catch((error) => ({
    waiting: false,
    reason: error?.code ?? "malformed-lease",
    lease: null
  }));
  if (!waiting.waiting || !waiting.lease) return allow(waiting.reason);
  let activeLease = waiting.lease;
  let expected = counters(activeLease);
  const deadline = Date.parse(waiting.lease.waitDeadlineAt);
  if (!Number.isFinite(deadline)) return allow("malformed-lease");
  let diagnostic = "wait-timeout";
  try {
    while ((currentNow = now()) < deadline) {
      let selection;
      try {
        const digest = await waitFor(
          Promise.resolve().then(() => observe(activeLease)),
          signal
        );
        if (!validDigestForLease(digest, activeLease)) {
          diagnostic = "observer-invalid";
          return allow(diagnostic);
        }
        if (isPendingCursorCompletion(digest, activeLease)) {
          const remaining2 = deadline - now();
          if (remaining2 > 0) {
            await waitFor(
              Promise.resolve(sleep(Math.min(POLL_MS, remaining2))),
              signal
            );
          }
          continue;
        }
        selection = selectCompletedContinuation(digest);
      } catch (error) {
        diagnostic = error?.code === "provider-terminated" ? "provider-terminated" : "observer-invalid";
        return allow(diagnostic);
      }
      if (validSelection(selection, expected, activeLease)) {
        const terminal = activeLease.continuationCount + selection.budgetCost >= activeLease.continuationCap || activeLease.loopCount + 1 >= activeLease.loopCap;
        await options.beforeCursorUpdate?.();
        const update = await cursorUpdate(activeLease, selection);
        const authorization = refreshWakeAuthorization(
          now,
          activeLease,
          deadline
        );
        currentNow = authorization.currentNow;
        if (!authorization.authorized) {
          diagnostic = authorization.diagnostic;
          return allow(diagnostic);
        }
        if (composition.mode === "composed") {
          const messaging = await claimComposedRequests(
            root,
            identity,
            composition,
            now,
            options
          );
          if (messaging) return messaging;
          const eventKey3 = [
            "codex:composed-observation",
            identity.eventId,
            activeLease.leaseId,
            selection.range.fromIndex,
            selection.range.toIndex
          ].join(":");
          let compositionValid = true;
          const sharedClaim = await claimDelivery({
            root,
            pin: composition.pin,
            eventKey: eventKey3,
            deliveryKeys: [],
            now: new Date(currentNow),
            clock: () => new Date(now()),
            hooks: {
              ...options.observationClaimHooks,
              beforeFinalValidation: async () => {
                compositionValid = await composedStillActive(
                  root,
                  identity,
                  composition.activation,
                  now()
                );
              }
            }
          }).catch(() => null);
          if (!compositionValid || !sharedClaim?.slot || !sharedClaim.activeAfterClaim) {
            diagnostic = "shared-budget-refused";
            return allow(diagnostic);
          }
          await options.afterSharedSlot?.();
        }
        const claimed = await claimAdapterTrigger(
          root,
          { ...invocation, now: currentNow },
          expected,
          {
            ...update,
            loopIncrement: 1,
            terminal,
            diagnostic: null
          },
          now
        ).catch((error) => ({
          triggered: false,
          reason: error?.code ?? "claim-failed",
          lease: null
        }));
        if (!claimed.triggered) {
          diagnostic = claimed.reason;
          return allow(claimed.reason);
        }
        if (composition.mode === "composed" && !await composedStillActive(
          root,
          identity,
          composition.activation,
          now()
        )) {
          diagnostic = "composed-activation-ended";
          return allow(diagnostic);
        }
        return CODEX_STOP_ADAPTER.emit(activeLease, selection.range);
      }
      if (selection.continuation === false && selection.peerCursor > expected.peerCursor) {
        if (selection.fromIndex !== expected.peerCursor) {
          diagnostic = "noncontiguous-selection";
          return allow(diagnostic);
        }
        const update = await cursorUpdate(activeLease, selection);
        const authorization = refreshWakeAuthorization(
          now,
          activeLease,
          deadline
        );
        currentNow = authorization.currentNow;
        if (!authorization.authorized) {
          diagnostic = authorization.diagnostic;
          return allow(diagnostic);
        }
        const advanced = await advanceAdapterCursor(
          root,
          { ...invocation, now: currentNow },
          expected,
          update
        ).catch((error) => ({
          advanced: false,
          reason: error?.code ?? "cursor-advance-failed",
          lease: null
        }));
        if (!advanced.advanced || !advanced.lease) {
          diagnostic = advanced.reason;
          return allow(advanced.reason);
        }
        activeLease = advanced.lease;
        expected = counters(activeLease);
        continue;
      }
      const remaining = deadline - now();
      if (remaining > 0)
        await waitFor(
          Promise.resolve(sleep(Math.min(POLL_MS, remaining))),
          signal
        );
    }
    return allow(diagnostic);
  } catch (error) {
    diagnostic = error?.code === "provider-terminated" ? "provider-terminated" : "observer-invalid";
    return allow(diagnostic);
  } finally {
    await finishAdapterWait(
      root,
      { ...invocation, now: currentNow },
      expected,
      diagnostic
    ).catch(() => {
    });
  }
}
async function readStdin() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return JSON.parse(input || "{}");
}
async function runCodexStopMain() {
  let event;
  try {
    event = await readStdin();
  } catch {
    return;
  }
  const controller = new AbortController();
  const terminate = () => controller.abort();
  process.once("SIGINT", terminate);
  process.once("SIGTERM", terminate);
  try {
    const result = await runCodexStopHook(event, { signal: controller.signal });
    if (result.decision === "block")
      process.stdout.write(`${JSON.stringify(result)}
`);
  } finally {
    process.removeListener("SIGINT", terminate);
    process.removeListener("SIGTERM", terminate);
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  runCodexStopMain().catch(() => {
  });
}
export {
  CODEX_STOP_ADAPTER,
  runCodexStopHook,
  runCodexStopMain,
  wakeEnvelope
};
