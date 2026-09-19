#!/usr/bin/env node
// GENERATED skill payload for agent-messaging.

// src/skills/agent-messaging/src/agent-messaging.ts
import { randomUUID as randomUUID6 } from "node:crypto";
import { realpathSync } from "node:fs";
import path13 from "node:path";
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
function timestamp(value) {
  const result = value ?? (/* @__PURE__ */ new Date()).toISOString();
  if (Number.isNaN(Date.parse(result)))
    throw new TypeError("timestamp must be ISO-8601");
  return result;
}
function withContentHash(record) {
  return { ...record, contentHash: canonicalRecordHash(record) };
}
async function canonicalWorktree(value) {
  if (!path3.isAbsolute(value)) throw new TypeError("worktree must be absolute");
  const info = await lstat2(value).catch(() => null);
  if (!info) return path3.resolve(value);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new TypeError("worktree must be a directory");
  return realpath2(value);
}
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
async function assertOpen(root, collaborationId) {
  if (await isCollaborationClosed(root, collaborationId)) {
    throw new MembershipError(
      "COLLABORATION_CLOSED",
      "collaboration is closed"
    );
  }
}
async function openCollaboration(input) {
  assertUuid(input.collaborationId, "collaboration ID");
  assertBoundedString(input.label, "label", 128);
  assertBoundedString(input.task, "task", 2048);
  const createdAt = timestamp(input.now);
  const paths = collaborationPaths(input.root, input.collaborationId);
  const proposed = withContentHash({
    schemaVersion: 1,
    id: input.collaborationId,
    label: input.label,
    task: input.task,
    createdAt
  });
  let collaboration = await readJsonRecord(
    paths.collaboration,
    { root: input.root }
  ).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!collaboration) {
    try {
      await publishImmutableRecord(paths.collaboration, proposed, {
        root: input.root
      });
      collaboration = proposed;
      await input.hooks?.afterCollaborationPublish?.();
    } catch (error) {
      if (!(error instanceof CollaborationError) || error.code !== "RECORD_CONFLICT")
        throw error;
      collaboration = await readJsonRecord(
        paths.collaboration,
        { root: input.root }
      );
    }
  }
  if (collaboration.id !== input.collaborationId || collaboration.label !== input.label || collaboration.task !== input.task) {
    throw new CollaborationError(
      "RECORD_CONFLICT",
      "collaboration ID already has different stable fields"
    );
  }
  const joined = await joinCollaboration({
    ...input,
    now: collaboration.createdAt
  });
  return { collaboration, member: joined.member };
}
async function joinCollaboration(input) {
  assertAlias(input.alias);
  assertPin(input.pin);
  await assertOpen(input.root, input.collaborationId);
  const paths = collaborationPaths(input.root, input.collaborationId);
  await readJsonRecord(paths.collaboration, {
    root: input.root
  });
  const createdAt = timestamp(input.now);
  const participantId = randomUUID2();
  const worktree = await canonicalWorktree(input.worktree);
  const binding = withContentHash({
    schemaVersion: 1,
    participantId,
    generation: 0,
    pin: input.pin,
    worktree,
    previousPin: null,
    reason: "initial join",
    createdAt,
    inheritedAckRefs: []
  });
  const member = withContentHash({
    schemaVersion: 1,
    alias: input.alias,
    participantId,
    collaborationId: input.collaborationId,
    createdAt,
    initialBinding: binding
  });
  const memberTarget = path3.join(paths.members, `${input.alias}.json`);
  const existingMember = await readJsonRecord(memberTarget, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!existingMember) {
    const members = await enumerateJsonRecords(paths.members, {
      root: input.root,
      maxEntries: 128
    });
    if (members.length >= 128) {
      throw new CollaborationError(
        "CAPACITY_EXCEEDED",
        "collaboration already has 128 members"
      );
    }
  }
  try {
    await publishImmutableRecord(memberTarget, member, { root: input.root });
    await input.hooks?.afterAliasPublish?.();
  } catch (error) {
    if (!(error instanceof CollaborationError) || error.code !== "RECORD_CONFLICT")
      throw error;
    const existing = await readJsonRecord(memberTarget, {
      root: input.root
    });
    if (pinsEqual(existing.initialBinding.pin, input.pin)) {
      const recovered = await resolveMember(
        input.root,
        input.collaborationId,
        input.alias
      );
      const closedRace2 = await isCollaborationClosed(
        input.root,
        input.collaborationId
      );
      if (closedRace2)
        throw new MembershipError(
          "COLLABORATION_CLOSED",
          "join recovered during closure and is inert"
        );
      if (recovered.departed || recovered.binding.generation !== 0 || !pinsEqual(recovered.binding.pin, input.pin)) {
        throw new MembershipError(
          "STALE_BINDING",
          `alias ${input.alias} initial binding is no longer current`
        );
      }
      return { member: recovered, closedRace: closedRace2 };
    }
    throw new MembershipError(
      "STALE_BINDING",
      `alias ${input.alias} already belongs to another participant`
    );
  }
  await publishImmutableRecord(
    path3.join(memberBindingDirectory(paths, participantId), "0.json"),
    binding,
    { root: input.root }
  );
  await input.hooks?.afterBindingPublish?.();
  const closedRace = await isCollaborationClosed(
    input.root,
    input.collaborationId
  );
  if (closedRace) {
    throw new MembershipError(
      "COLLABORATION_CLOSED",
      "join published during closure and is inert"
    );
  }
  return { member: { member, binding, departed: false }, closedRace };
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
async function takeOverMembership(input) {
  assertPin(input.pin);
  assertPin(input.expectedPreviousPin);
  assertBoundedString(input.reason, "takeover reason", 512);
  await assertOpen(input.root, input.collaborationId);
  const current = await resolveMember(
    input.root,
    input.collaborationId,
    input.alias
  );
  if (current.departed)
    throw new MembershipError(
      "MEMBER_DEPARTED",
      "departed member cannot be taken over"
    );
  if (!pinsEqual(current.binding.pin, input.expectedPreviousPin)) {
    throw new MembershipError(
      "STALE_BINDING",
      "expected previous pin is not current"
    );
  }
  if (current.binding.generation >= 63) {
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      "member already has the maximum 64 binding generations"
    );
  }
  const paths = collaborationPaths(input.root, input.collaborationId);
  const ackDirectory = path3.join(
    paths.acknowledgments,
    current.member.participantId,
    String(current.binding.generation)
  );
  const ackFiles = await enumerateJsonRecords(ackDirectory, {
    root: input.root,
    maxEntries: 4096
  });
  const ackRecords = await Promise.all(
    ackFiles.map(
      (file) => readJsonRecord(file, { root: input.root })
    )
  );
  const acknowledgedMessages = await Promise.all(
    ackRecords.map(
      (ack) => readJsonRecord(
        path3.join(
          paths.inbox,
          current.member.participantId,
          `${ack.messageId}.json`
        ),
        { root: input.root }
      )
    )
  );
  if (ackRecords.some((ack, index) => {
    const message = acknowledgedMessages[index];
    return ack.bindingGeneration !== current.binding.generation || !pinsEqual(ack.recipient, current.binding.pin) || message?.contentHash !== ack.messageHash;
  })) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      "acknowledgment identity does not match its binding"
    );
  }
  const inheritedAckRefs = [
    ...current.binding.inheritedAckRefs,
    ...ackRecords.map((ack) => ({
      messageId: ack.messageId,
      messageHash: ack.messageHash
    }))
  ].filter(
    (ack, index, all) => all.findIndex(
      (candidate) => candidate.messageId === ack.messageId && candidate.messageHash === ack.messageHash
    ) === index
  );
  const binding = withContentHash({
    schemaVersion: 1,
    participantId: current.member.participantId,
    generation: current.binding.generation + 1,
    pin: input.pin,
    worktree: await canonicalWorktree(input.worktree),
    previousPin: current.binding.pin,
    reason: input.reason,
    createdAt: timestamp(input.now),
    inheritedAckRefs
  });
  try {
    await publishImmutableRecord(
      path3.join(
        memberBindingDirectory(paths, current.member.participantId),
        `${binding.generation}.json`
      ),
      binding,
      { root: input.root }
    );
    await input.hooks?.afterBindingPublish?.();
  } catch (error) {
    if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT") {
      throw new MembershipError(
        "STALE_BINDING",
        "another successor won this generation"
      );
    }
    throw error;
  }
  const closedRace = await isCollaborationClosed(
    input.root,
    input.collaborationId
  );
  if (closedRace) {
    throw new MembershipError(
      "COLLABORATION_CLOSED",
      "takeover published during closure and is inert"
    );
  }
  return {
    member: { member: current.member, binding, departed: false },
    closedRace
  };
}
async function leaveCollaboration(input) {
  const current = await resolveMember(
    input.root,
    input.collaborationId,
    input.alias
  );
  if (!pinsEqual(current.binding.pin, input.pin)) {
    throw new MembershipError(
      "STALE_BINDING",
      "only the current binding may leave"
    );
  }
  const departure = withContentHash({
    schemaVersion: 1,
    participantId: current.member.participantId,
    generation: current.binding.generation,
    pin: input.pin,
    departedAt: timestamp(input.now)
  });
  const paths = collaborationPaths(input.root, input.collaborationId);
  const target = path3.join(
    paths.departures,
    current.member.participantId,
    `${current.binding.generation}.json`
  );
  const existing = await readJsonRecord(target, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (!pinsEqual(existing.pin, input.pin)) {
      throw new MembershipError(
        "STALE_BINDING",
        "departure belongs to another binding"
      );
    }
    return {
      created: false,
      path: target,
      hash: canonicalHash(existing),
      record: existing
    };
  }
  return publishImmutableRecord(target, departure, { root: input.root });
}
async function closeCollaboration(input) {
  const current = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin
  );
  if (current.departed)
    throw new MembershipError(
      "MEMBER_DEPARTED",
      "departed member cannot close collaboration"
    );
  const target = collaborationPaths(input.root, input.collaborationId).closed;
  const existing = await readJsonRecord(target, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    return {
      created: false,
      path: target,
      hash: canonicalHash(existing),
      record: existing
    };
  }
  const record = withContentHash({
    schemaVersion: 1,
    collaborationId: input.collaborationId,
    closedBy: input.pin,
    closedAt: timestamp(input.now)
  });
  return publishImmutableRecord(target, record, {
    root: input.root
  });
}

// src/shared/collaboration/activation.ts
var DEFAULT_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1e3;
var MAX_ACTIVATION_DURATION_MS = 24 * 60 * 60 * 1e3;
var DEFAULT_MAX_CONTINUATIONS = 20;
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
function timestamp2(value, label) {
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
    const startedAt = timestamp2(record.startedAt, "activation startedAt");
    const hardExpiresAt = timestamp2(
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
      const fixedExpiresAt = timestamp2(
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
      const acknowledgedAt = timestamp2(
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
      const confirmedAt = timestamp2(
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
      const confirmedAt = timestamp2(
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
      timestamp2(record.observedAt, "activity observedAt");
      return record;
    })
  );
  return receipts.toSorted(
    (left, right) => left.observedAt.localeCompare(right.observedAt) || left.eventKey.localeCompare(right.eventKey)
  );
}
async function effectiveActivationExpiry(root, activation) {
  validateActivation(activation);
  const started = timestamp2(activation.startedAt, "activation startedAt");
  const hard = timestamp2(activation.hardExpiresAt, "activation hardExpiresAt");
  if (activation.expiryMode === "fixed") {
    return new Date(
      Math.min(
        hard,
        timestamp2(activation.fixedExpiresAt, "activation fixedExpiresAt")
      )
    ).toISOString();
  }
  let liveThrough = Math.min(hard, started + activation.idleTimeoutMs);
  for (const receipt of await activityReceipts(root, activation)) {
    const observed = timestamp2(receipt.observedAt, "activity observedAt");
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
async function enableActivation(input) {
  assertPin(input.pin);
  if (!path4.isAbsolute(input.worktree))
    throw new TypeError("activation worktree must be absolute");
  const member = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin
  );
  if (member.departed)
    throw new CollaborationError(
      "RECORD_CONFLICT",
      "departed member cannot activate delivery"
    );
  if (await isCollaborationClosed(input.root, input.collaborationId))
    throw new CollaborationError(
      "RECORD_CONFLICT",
      "closed collaboration cannot activate delivery"
    );
  const existing = await activationRecords(input.root, input.pin);
  if (existing.length >= MAX_ACTIVATION_EPOCHS)
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      "activation epoch capacity is exhausted"
    );
  if (existing.length > 0) {
    const status = await activationStatus(
      input.root,
      input.pin,
      input.now ?? /* @__PURE__ */ new Date()
    );
    if (status.active)
      throw new DeliveryError(
        "DELIVERY_CONFLICT",
        "an automatic delivery activation is already active for this exact session"
      );
  }
  const now = input.now ?? /* @__PURE__ */ new Date();
  const startedAt = now.toISOString();
  const maxDurationMs = input.maxDurationMs ?? MAX_ACTIVATION_DURATION_MS;
  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs <= 0 || maxDurationMs > MAX_ACTIVATION_DURATION_MS)
    throw new TypeError("max duration must be within 24 hours");
  const expiryMode = input.expiryMode ?? "fixed";
  if (expiryMode === "human-idle" && !input.humanProvenanceEvidence)
    throw new DeliveryError(
      "DELIVERY_INACTIVE",
      "human-idle activation requires qualifying exact host provenance evidence"
    );
  const idleTimeoutMs = expiryMode === "human-idle" ? input.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS : null;
  if (idleTimeoutMs !== null && (!Number.isSafeInteger(idleTimeoutMs) || idleTimeoutMs <= 0 || idleTimeoutMs > MAX_ACTIVATION_DURATION_MS))
    throw new TypeError("idle timeout must be within 24 hours");
  const fixedDurationMs = expiryMode === "fixed" ? input.fixedDurationMs ?? DEFAULT_IDLE_TIMEOUT_MS : null;
  if (fixedDurationMs !== null && (!Number.isSafeInteger(fixedDurationMs) || fixedDurationMs <= 0 || fixedDurationMs > maxDurationMs))
    throw new TypeError("fixed expiry must fit the activation duration");
  const epoch = existing.length;
  const activationId = input.activationId ?? randomUUID3();
  const base = {
    schemaVersion: SCHEMA_VERSION,
    id: activationId,
    epoch,
    previousEpoch: epoch === 0 ? null : epoch - 1,
    collaborationId: input.collaborationId,
    participantId: member.member.participantId,
    bindingGeneration: member.binding.generation,
    pin: input.pin,
    worktree: path4.resolve(input.worktree),
    mechanism: input.mechanism ?? "stop",
    controller: input.controller ?? "standalone-messaging",
    thirdPartyHookAcknowledgment: input.thirdPartyHookAcknowledgment ?? null,
    noObserverMonitorAttestation: input.noObserverMonitorAttestation ?? (input.noObserverMonitorConfirmed ? { pin: input.pin, epoch, confirmedAt: startedAt } : null),
    composedMonitorAttestation: input.composedMonitorAttestation ? {
      ...input.composedMonitorAttestation,
      owner: input.pin,
      activationId,
      collaborationId: input.collaborationId,
      epoch,
      confirmedAt: startedAt,
      oldMonitorStopped: true,
      standaloneWatcherStopped: true
    } : null,
    claudeInventorySources: input.claudeInventorySources ? structuredClone(input.claudeInventorySources) : null,
    startedAt,
    hardExpiresAt: new Date(now.getTime() + maxDurationMs).toISOString(),
    expiryMode,
    idleTimeoutMs,
    fixedExpiresAt: fixedDurationMs === null ? null : new Date(now.getTime() + fixedDurationMs).toISOString(),
    maxContinuations: input.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS,
    waitMs: input.waitMs ?? 0
  };
  const activation = {
    ...base,
    contentHash: canonicalRecordHash(
      base
    )
  };
  validateActivation(activation);
  if (input.humanProvenanceEvidence) {
    assertBoundedString(
      input.humanProvenanceEvidence.hostVersion,
      "human provenance host version",
      128
    );
    assertBoundedString(
      input.humanProvenanceEvidence.surface,
      "human provenance surface",
      256
    );
    const qualifiedAt = timestamp2(
      input.humanProvenanceEvidence.qualifiedAt,
      "human provenance qualification time"
    );
    if (qualifiedAt > now.getTime())
      throw new TypeError("human provenance cannot be qualified in the future");
    const evidenceBase = {
      schemaVersion: SCHEMA_VERSION,
      activationId: activation.id,
      pin: input.pin,
      hostVersion: input.humanProvenanceEvidence.hostVersion,
      surface: input.humanProvenanceEvidence.surface,
      qualifiedAt: input.humanProvenanceEvidence.qualifiedAt
    };
    await publishImmutableRecord(
      path4.join(
        activationDirectory(input.root, input.pin),
        "provenance",
        `${activation.id}.json`
      ),
      {
        ...evidenceBase,
        contentHash: canonicalRecordHash(evidenceBase)
      },
      { root: input.root }
    );
  }
  await publishImmutableRecord(
    path4.join(
      activationDirectory(input.root, input.pin),
      "epochs",
      `${epoch}.json`
    ),
    activation,
    { root: input.root }
  );
  if (await isCollaborationClosed(input.root, input.collaborationId))
    throw new CollaborationError(
      "RECORD_CONFLICT",
      "activation published during closure and is inert"
    );
  return activation;
}
async function disableActivation(input) {
  const status = await activationStatus(
    input.root,
    input.pin,
    input.now ?? /* @__PURE__ */ new Date()
  );
  if (!status.activation)
    throw new DeliveryError(
      "DELIVERY_INACTIVE",
      "no activation exists for this session"
    );
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: status.activation.id,
    revokedAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString(),
    revokedBy: input.pin
  };
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base
    )
  };
  await publishImmutableRecord(
    path4.join(
      activationDirectory(input.root, input.pin),
      "revoked",
      `${record.activationId}.json`
    ),
    record,
    { root: input.root }
  );
  return record;
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
function watchBatchEventKey(input) {
  assertUuid(input.activationId, "activation ID");
  const keys = input.deliveryKeys.map(deliveryKey).toSorted();
  return safeKey(
    "agent-messaging-watch-batch-v1",
    `${input.activationId}\0${input.bindingGeneration}\0${keys.join("\0")}`
  );
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
async function createDeliveryRetry(input) {
  assertBoundedString(input.priorAttemptId, "prior attempt ID", 128);
  assertUuid(input.messageId, "message ID");
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
  const eventFiles = await enumerateJsonRecords(
    path5.join(
      activationDirectory(input.root, input.pin),
      "claims",
      status.activation.id,
      "events"
    ),
    { root: input.root, maxEntries: 4096 }
  );
  const events = await Promise.all(
    eventFiles.map(
      (file) => readJsonRecord(file, { root: input.root })
    )
  );
  const prior = events.find(
    (event) => event.token === input.priorAttemptId || event.eventKey === input.priorAttemptId
  );
  if (!prior || !prior.proposedDeliveryKeys.some(
    (key) => key.startsWith(`${input.messageId}:`)
  ))
    throw new CollaborationError(
      "RECORD_CONFLICT",
      "prior attempt did not propose this message"
    );
  const priorGeneration = Math.max(
    ...prior.proposedDeliveryKeys.filter((key) => key.startsWith(`${input.messageId}:`)).map((key) => Number(key.split(":").at(-1))),
    0
  );
  const target = path5.join(
    collaborationPaths(input.root, status.activation.collaborationId).directory,
    "retries",
    status.activation.participantId,
    `${safeKey("retry", `${input.priorAttemptId}\0${input.messageId}`)}.json`
  );
  const existing = await readJsonRecord(target, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (existing.activationId !== status.activation.id || existing.priorAttemptId !== input.priorAttemptId || existing.messageId !== input.messageId) {
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "retry record identity is invalid"
      );
    }
    return existing;
  }
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: status.activation.id,
    priorAttemptId: input.priorAttemptId,
    participantId: status.activation.participantId,
    messageId: input.messageId,
    retryGeneration: priorGeneration + 1,
    createdAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
  };
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base
    )
  };
  return (await publishImmutableRecord(target, record, { root: input.root })).record;
}
async function deliveryClaimStatus(input) {
  const status = await activationStatus(input.root, input.pin);
  if (!status.activation)
    return {
      spentSlots: 0,
      remainingSlots: 0,
      interruptedAttempts: [],
      outcomeUnknown: [],
      observationAttempts: []
    };
  const base = path5.join(
    activationDirectory(input.root, input.pin),
    "claims",
    status.activation.id
  );
  const [eventFiles, slotFiles, messageFiles] = await Promise.all([
    enumerateJsonRecords(path5.join(base, "events"), {
      root: input.root,
      maxEntries: 4096
    }),
    enumerateJsonRecords(path5.join(base, "slots"), {
      root: input.root,
      maxEntries: status.activation.maxContinuations
    }),
    enumerateJsonRecords(path5.join(base, "messages"), {
      root: input.root,
      maxEntries: 4096
    })
  ]);
  const [events, slots, messages] = await Promise.all([
    Promise.all(
      eventFiles.map(
        (file) => readJsonRecord(file, { root: input.root })
      )
    ),
    Promise.all(
      slotFiles.map(
        (file) => readJsonRecord(file, { root: input.root })
      )
    ),
    Promise.all(
      messageFiles.map(
        (file) => readJsonRecord(file, { root: input.root })
      )
    )
  ]);
  const interruptedAttempts = events.filter(
    (event) => event.observation === void 0 && (!slots.some((slot) => slot.token === event.token) || event.proposedDeliveryKeys.length > 0 && !messages.some((message) => message.token === event.token))
  ).map((event) => event.token);
  const outcomeUnknown = events.filter(
    (event) => event.observation === void 0 && messages.some((message) => message.token === event.token)
  ).map((event) => event.token);
  const observationAttempts = events.filter(
    (event) => event.observation !== void 0
  ).map((event) => ({
    attemptId: event.token,
    eventKey: event.eventKey,
    observation: event.observation,
    status: slots.some((slot) => slot.token === event.token) ? "outcome-unknown" : "interrupted"
  }));
  return {
    spentSlots: slots.length,
    remainingSlots: Math.max(
      0,
      status.activation.maxContinuations - slots.length
    ),
    interruptedAttempts,
    outcomeUnknown,
    observationAttempts
  };
}

// src/shared/collaboration/diagnostics.ts
import path6 from "node:path";
var MAX_DIAGNOSTICS = 4096;
var MAX_DIAGNOSTIC_BYTES = 8192;
var DIAGNOSTIC_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127})$/u;
var OUTCOME_CODES = /* @__PURE__ */ new Set([
  "claimed",
  "stdout-written",
  "host-output-attempted",
  "watch-notification-attempted",
  "observation-notification-attempted"
]);
var ERROR_CODES = /* @__PURE__ */ new Set(
  ["diagnostic-write-failed", "host-timeout", "host-protocol-error"]
);
function validate(input) {
  assertBoundedString(input.attemptId, "diagnostic attempt ID", 128);
  if (!DIAGNOSTIC_ID.test(input.attemptId) || input.attemptId === "." || input.attemptId === "..")
    throw new TypeError("diagnostic attempt ID is not path-safe");
  assertUuid(input.activationId, "diagnostic activation ID");
  assertBoundedString(input.eventKey, "diagnostic event key", 256);
  if (!["prompt-start", "stop", "watch", "monitor", "manual"].includes(
    input.boundary
  ))
    throw new TypeError("diagnostic boundary is unsupported");
  if (![
    "event-claimed",
    "slot-claimed",
    "messages-claimed",
    "final-validation",
    "output-attempted"
  ].includes(input.stage))
    throw new TypeError("diagnostic stage is unsupported");
  if (!OUTCOME_CODES.has(input.outcomeCode))
    throw new TypeError("diagnostic outcome code is unsupported");
  if (input.attemptKind !== void 0 && !["message", "observation"].includes(input.attemptKind))
    throw new TypeError("diagnostic attempt kind is unsupported");
  if (input.attemptKind === "observation" && !input.observation)
    throw new TypeError("observation diagnostic requires exact range identity");
  if (input.observation) {
    const observation = input.observation;
    assertPin(observation.owner);
    assertPin(observation.peer);
    if (![
      "zero-based-jsonl-record-index",
      "zero-based-jsonl-frame-index"
    ].includes(observation.indexBase) || !Number.isSafeInteger(observation.fromIndex) || !Number.isSafeInteger(observation.toIndex) || !Number.isSafeInteger(observation.nextIndex) || observation.fromIndex < 0 || observation.toIndex < observation.fromIndex || observation.nextIndex !== observation.toIndex + 1 || !/^[a-f0-9]{64}$/u.test(observation.selectedPrefixIdentity))
      throw new TypeError("diagnostic observation identity is invalid");
  }
  if (input.errorCode !== null && !ERROR_CODES.has(input.errorCode))
    throw new TypeError("diagnostic error code is unsupported");
  if (Number.isNaN(Date.parse(input.recordedAt)))
    throw new TypeError("diagnostic recordedAt must be a timestamp");
  for (const value of Object.values(input)) {
    if (typeof value === "string" && /(password|token=|secret|credential)/iu.test(value)) {
      throw new TypeError("diagnostic contains disallowed sensitive text");
    }
  }
}
function validateRecord(record) {
  if (record.schemaVersion !== SCHEMA_VERSION)
    throw new CollaborationError(
      "MALFORMED_RECORD",
      "diagnostic schema version is unsupported"
    );
  try {
    const {
      schemaVersion: _schemaVersion,
      contentHash: _contentHash,
      ...input
    } = record;
    validate(input);
  } catch (error) {
    throw new CollaborationError(
      "MALFORMED_RECORD",
      `diagnostic record is invalid: ${error.message}`
    );
  }
  if (record.contentHash !== canonicalRecordHash(
    record
  ))
    throw new CollaborationError(
      "MALFORMED_RECORD",
      "diagnostic contentHash does not match content"
    );
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
  const target = path6.resolve(directory, `${input.diagnostic.attemptId}.json`);
  if (path6.dirname(target) !== path6.resolve(directory))
    throw new TypeError("diagnostic target escapes its exact namespace");
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
  return (await publishImmutableRecord(target, record, { root: input.root })).record;
}
async function latestDeliveryDiagnostic(input) {
  const directory = path6.join(
    activationDirectory(input.root, input.pin),
    "diagnostics"
  );
  let files;
  try {
    files = await enumerateJsonRecords(directory, {
      root: input.root,
      maxEntries: MAX_DIAGNOSTICS
    });
  } catch (error) {
    if (error instanceof CollaborationError && error.code === "CAPACITY_EXCEEDED")
      return { latest: null, capacityError: error.message };
    throw error;
  }
  const records = await Promise.all(
    files.map(
      (file) => readJsonRecord(file, {
        root: input.root,
        maxBytes: MAX_DIAGNOSTIC_BYTES
      })
    )
  );
  for (const record of records) {
    validateRecord(record);
  }
  return {
    latest: records.toSorted(
      (left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.attemptId.localeCompare(left.attemptId)
    )[0] ?? null,
    capacityError: null
  };
}

// src/shared/collaboration/log.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import {
  lstat as lstat3,
  open as open2,
  readFile as readFile2,
  realpath as realpath3,
  rename,
  unlink as unlink2
} from "node:fs/promises";
import path7 from "node:path";
function timestamp3(value) {
  const result = value ?? (/* @__PURE__ */ new Date()).toISOString();
  if (Number.isNaN(Date.parse(result)))
    throw new TypeError("timestamp must be ISO-8601");
  return result;
}
function entryContent(input) {
  return {
    collaborationId: input.collaborationId,
    id: input.id,
    category: input.category,
    title: input.title,
    author: input.pin,
    whatHappened: input.whatHappened,
    assessment: input.assessment,
    skillImplication: input.skillImplication
  };
}
async function appendLogEntry(input) {
  assertUuid(input.collaborationId, "collaboration ID");
  assertUuid(input.id, "entry ID");
  assertPin(input.pin);
  assertBoundedString(input.category, "category", 64);
  assertBoundedString(input.title, "title", 256);
  assertBoundedString(input.whatHappened, "what happened", 16 * 1024);
  assertBoundedString(input.assessment, "assessment", 2048);
  assertBoundedString(input.skillImplication, "skill implication", 4096);
  if (await isCollaborationClosed(input.root, input.collaborationId)) {
    throw new MembershipError(
      "COLLABORATION_CLOSED",
      "collaboration log is closed"
    );
  }
  const author = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin
  );
  if (author.departed) {
    throw new MembershipError(
      "MEMBER_DEPARTED",
      "departed member cannot append to the log"
    );
  }
  const contentHash = canonicalHash(entryContent(input));
  const target = path7.join(
    collaborationPaths(input.root, input.collaborationId).logEntries,
    `${input.id}.json`
  );
  const existing = await readJsonRecord(target, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (existing.contentHash !== contentHash) {
      throw new CollaborationError(
        "RECORD_CONFLICT",
        "log entry ID already has different content"
      );
    }
    return { entry: existing, duplicate: true };
  }
  const entries = await enumerateJsonRecords(path7.dirname(target), {
    root: input.root,
    maxEntries: 4096
  });
  if (entries.length >= 4096) {
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      "collaboration log already has 4096 entries"
    );
  }
  const entry = {
    schemaVersion: 1,
    id: input.id,
    collaborationId: input.collaborationId,
    category: input.category,
    title: input.title,
    author: input.pin,
    authoredAt: timestamp3(input.now),
    whatHappened: input.whatHappened,
    assessment: input.assessment,
    skillImplication: input.skillImplication,
    contentHash
  };
  try {
    await publishImmutableRecord(target, entry, { root: input.root });
  } catch (error) {
    if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT") {
      const winner = await readJsonRecord(target, {
        root: input.root
      });
      if (winner.contentHash === contentHash)
        return { entry: winner, duplicate: true };
    }
    throw error;
  }
  return { entry, duplicate: false };
}
async function authoritativeEntries(root, collaborationId) {
  const directory = collaborationPaths(root, collaborationId).logEntries;
  const files = await enumerateJsonRecords(directory, {
    root,
    maxEntries: 4096
  });
  const entries = await Promise.all(
    files.map((file) => readJsonRecord(file, { root }))
  );
  for (const entry of entries) {
    const actual = canonicalHash({
      collaborationId: entry.collaborationId,
      id: entry.id,
      category: entry.category,
      title: entry.title,
      author: entry.author,
      whatHappened: entry.whatHappened,
      assessment: entry.assessment,
      skillImplication: entry.skillImplication
    });
    if (actual !== entry.contentHash) {
      throw new CollaborationError(
        "MALFORMED_RECORD",
        `log entry ${entry.id} has an invalid content hash`
      );
    }
  }
  return entries.toSorted(
    (left, right) => left.authoredAt.localeCompare(right.authoredAt) || left.author.runtime.localeCompare(right.author.runtime) || left.author.sessionId.localeCompare(right.author.sessionId) || left.id.localeCompare(right.id)
  );
}
function sourceDigest(entries) {
  return canonicalHash(
    entries.map((entry) => ({
      id: entry.id,
      hash: entry.contentHash,
      authoredAt: entry.authoredAt
    }))
  );
}
function renderMarkdown(collaboration, entries, digest) {
  const sections = entries.map(
    (entry) => [
      `## ${entry.title}`,
      "",
      `- Entry: \`${entry.id}\``,
      `- Category: ${entry.category}`,
      `- Author: \`${entry.author.runtime}:${entry.author.sessionId}\``,
      `- Time: ${entry.authoredAt}`,
      `- Assessment: ${entry.assessment}`,
      "",
      entry.whatHappened,
      "",
      `**Skill implication:** ${entry.skillImplication}`
    ].join("\n")
  );
  return [
    `# ${collaboration.label}`,
    "",
    `- Collaboration: \`${collaboration.id}\``,
    `- Created: ${collaboration.createdAt}`,
    `- Task: ${collaboration.task}`,
    "",
    `<!-- source-set-digest: ${digest} -->`,
    "",
    ...sections.flatMap((section) => [section, ""])
  ].join("\n");
}
async function inspectPrivateDirectoryChain(root, directory) {
  const absoluteRoot = path7.resolve(root);
  const absoluteDirectory = path7.resolve(directory);
  const relative = path7.relative(absoluteRoot, absoluteDirectory);
  if (relative.startsWith("..") || path7.isAbsolute(relative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log directory escapes the collaboration root"
    );
  }
  const expectedUid = process.getuid?.();
  const paths = [
    absoluteRoot,
    ...relative.split(path7.sep).filter(Boolean).reduce((entries, segment) => {
      entries.push(path7.join(entries.at(-1) ?? absoluteRoot, segment));
      return entries;
    }, [])
  ];
  for (const candidate of paths) {
    const info = await lstat3(candidate);
    if (!info.isDirectory() || info.isSymbolicLink() || expectedUid !== void 0 && info.uid !== expectedUid) {
      throw new CollaborationError(
        "UNSAFE_PATH",
        "rendered log directory chain is unsafe"
      );
    }
  }
  const canonicalRoot = await realpath3(absoluteRoot);
  const canonicalDirectory = await realpath3(absoluteDirectory);
  const canonicalRelative = path7.relative(canonicalRoot, canonicalDirectory);
  if (canonicalRelative.startsWith("..") || path7.isAbsolute(canonicalRelative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log directory escapes the canonical root"
    );
  }
}
async function writeView(file, markdown, root) {
  const directory = path7.dirname(file);
  await inspectPrivateDirectoryChain(root, directory);
  await inspectRenderedView(file, root).catch(
    (error) => {
      if (error.code !== "ENOENT") throw error;
    }
  );
  const temporary = path7.join(
    directory,
    `.collaboration.md.tmp-${process.pid}-${randomUUID5()}`
  );
  const handle = await open2(temporary, "wx", 384);
  try {
    await handle.writeFile(markdown, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await inspectPrivateDirectoryChain(root, directory);
    await inspectRenderedView(file, root).catch(
      (error) => {
        if (error.code !== "ENOENT") throw error;
      }
    );
    await rename(temporary, file);
    const directoryHandle = await open2(directory, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } finally {
    await unlink2(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
async function renderLog(input) {
  const entries = await authoritativeEntries(input.root, input.collaborationId);
  const collaboration = await readJsonRecord(
    collaborationPaths(input.root, input.collaborationId).collaboration,
    { root: input.root }
  );
  const digest = sourceDigest(entries);
  const markdown = renderMarkdown(collaboration, entries, digest);
  await input.hooks?.afterSnapshot?.();
  const file = collaborationPaths(
    input.root,
    input.collaborationId
  ).renderedLog;
  await writeView(file, markdown, input.root);
  const after = sourceDigest(
    await authoritativeEntries(input.root, input.collaborationId)
  );
  return { path: file, markdown, digest, staleAfterRender: after !== digest };
}
async function getLogView(input) {
  const entries = await authoritativeEntries(input.root, input.collaborationId);
  const digest = sourceDigest(entries);
  const file = collaborationPaths(
    input.root,
    input.collaborationId
  ).renderedLog;
  const markdown = await inspectRenderedView(file, input.root).catch(
    (error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  );
  const renderedDigest = markdown?.match(
    /<!-- source-set-digest: ([a-f0-9]{64}) -->/u
  )?.[1];
  return { path: file, markdown, digest, stale: renderedDigest !== digest };
}
async function inspectRenderedView(file, root, options = {}) {
  await inspectPrivateDirectoryChain(root, path7.dirname(file));
  const info = await lstat3(file);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log must be a regular file"
    );
  }
  const expectedUid = options.expectedUid ?? process.getuid?.();
  if (expectedUid !== void 0 && info.uid !== expectedUid) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log owner does not match the current user"
    );
  }
  const maxBytes = options.maxBytes ?? 512 * 1024;
  if (info.size > maxBytes) {
    throw new CollaborationError(
      "RECORD_TOO_LARGE",
      `rendered log exceeds ${maxBytes} bytes`
    );
  }
  const canonicalRoot = await realpath3(root);
  const canonicalFile = await realpath3(file);
  const relative = path7.relative(canonicalRoot, canonicalFile);
  if (relative.startsWith("..") || path7.isAbsolute(relative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log escapes the collaboration root"
    );
  }
  return readFile2(file, "utf8");
}

// src/shared/collaboration/messages.ts
import path8 from "node:path";
function timestamp4(value) {
  const result = value ?? (/* @__PURE__ */ new Date()).toISOString();
  if (Number.isNaN(Date.parse(result)))
    throw new TypeError("timestamp must be ISO-8601");
  return result;
}
async function assertNotClosed(root, collaborationId) {
  if (await isCollaborationClosed(root, collaborationId)) {
    throw new MembershipError(
      "COLLABORATION_CLOSED",
      "collaboration is closed"
    );
  }
}
function contentFields(message) {
  return message;
}
function messagePath(root, collaborationId, participantId, id) {
  return path8.join(
    collaborationPaths(root, collaborationId).inbox,
    participantId,
    `${id}.json`
  );
}
async function validateReply(input, sender) {
  if (!input.replyTo) return;
  assertUuid(input.replyTo.participantId, "reply participant ID");
  assertUuid(input.replyTo.messageId, "reply message ID");
  const original = await readJsonRecord(
    messagePath(
      input.root,
      input.collaborationId,
      input.replyTo.participantId,
      input.replyTo.messageId
    ),
    { root: input.root }
  );
  if (original.from.participantId !== sender.member.participantId && original.to.participantId !== sender.member.participantId) {
    throw new CollaborationError(
      "RECORD_CONFLICT",
      "reply reference does not involve the sender"
    );
  }
}
async function sendMessage(input) {
  assertUuid(input.collaborationId, "collaboration ID");
  assertUuid(input.id, "message ID");
  assertPin(input.senderPin);
  assertBoundedString(input.subject, "subject", MAX_SUBJECT_BYTES);
  assertBoundedString(input.body, "body", MAX_BODY_BYTES, true);
  const kind = input.kind ?? "update";
  const priority = input.priority ?? "normal";
  if (!["request", "update"].includes(kind))
    throw new TypeError("message kind is invalid");
  if (!["normal", "high"].includes(priority))
    throw new TypeError("message priority is invalid");
  await assertNotClosed(input.root, input.collaborationId);
  const sender = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.senderPin
  );
  const recipient = await resolveMember(
    input.root,
    input.collaborationId,
    input.recipientAlias
  );
  if (sender.departed || recipient.departed)
    throw new MembershipError(
      "MEMBER_DEPARTED",
      "departed members cannot send or receive"
    );
  if (sender.member.participantId === recipient.member.participantId) {
    throw new TypeError("self-send is not allowed");
  }
  await validateReply(input, sender);
  const withoutHash = {
    schemaVersion: 1,
    id: input.id,
    collaborationId: input.collaborationId,
    from: {
      participantId: sender.member.participantId,
      generation: sender.binding.generation,
      pin: sender.binding.pin
    },
    to: {
      participantId: recipient.member.participantId,
      generation: recipient.binding.generation
    },
    kind,
    priority,
    subject: input.subject,
    body: input.body,
    replyTo: input.replyTo ?? null
  };
  const contentHash = canonicalHash(contentFields(withoutHash));
  const target = messagePath(
    input.root,
    input.collaborationId,
    recipient.member.participantId,
    input.id
  );
  const existing = await readJsonRecord(target, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (existing.contentHash !== contentHash) {
      throw new CollaborationError(
        "RECORD_CONFLICT",
        "message ID already has different content"
      );
    }
    return {
      message: existing,
      duplicate: true,
      staleAfterPublish: false,
      raceStatus: "current"
    };
  }
  const inboxFiles = await enumerateJsonRecords(path8.dirname(target), {
    root: input.root,
    maxEntries: 4096
  });
  if (inboxFiles.length >= 4096) {
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      "recipient inbox already has 4096 messages"
    );
  }
  const message = {
    ...withoutHash,
    createdAt: timestamp4(input.now),
    contentHash
  };
  try {
    await publishImmutableRecord(target, message, { root: input.root });
  } catch (error) {
    if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT") {
      const winner = await readJsonRecord(target, {
        root: input.root
      });
      if (winner.contentHash === contentHash) {
        return {
          message: winner,
          duplicate: true,
          staleAfterPublish: false,
          raceStatus: "current"
        };
      }
    }
    throw error;
  }
  await input.hooks?.afterPublish?.();
  const closedAfterPublish = await isCollaborationClosed(
    input.root,
    input.collaborationId
  );
  const currentSender = await resolveMember(
    input.root,
    input.collaborationId,
    sender.member.alias
  );
  const refreshedRecipient = await resolveMember(
    input.root,
    input.collaborationId,
    recipient.member.alias
  );
  const raceStatus = closedAfterPublish ? "closed" : currentSender.binding.generation !== sender.binding.generation ? "sender-superseded" : refreshedRecipient.binding.generation !== recipient.binding.generation ? "recipient-superseded" : "current";
  return {
    message,
    duplicate: false,
    staleAfterPublish: raceStatus !== "current",
    raceStatus
  };
}
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
  const ackPath = path8.join(
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
  const directory = path8.join(
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
async function readMessage(input) {
  assertUuid(input.messageId, "message ID");
  const recipient = await currentRecipient(input);
  const message = await readJsonRecord(
    messagePath(
      input.root,
      input.collaborationId,
      recipient.member.participantId,
      input.messageId
    ),
    { root: input.root, maxBytes: MAX_BODY_BYTES + 4096 }
  );
  return presentMessage(input, recipient, message);
}
async function acknowledgeMessage(input) {
  const recipient = await currentRecipient(input);
  const message = await readMessage(input);
  const paths = collaborationPaths(input.root, input.collaborationId);
  const target = path8.join(
    paths.acknowledgments,
    recipient.member.participantId,
    String(recipient.binding.generation),
    `${message.id}.json`
  );
  const existing = await readJsonRecord(target, {
    root: input.root
  }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (existing.messageHash !== message.contentHash || existing.bindingGeneration !== recipient.binding.generation || !pinsEqual(existing.recipient, recipient.binding.pin))
      throw new CollaborationError(
        "MALFORMED_RECORD",
        "acknowledgment identity or hash conflicts with the message"
      );
    return { ack: existing, duplicate: true };
  }
  const ackWithoutHash = {
    schemaVersion: 1,
    messageId: message.id,
    messageHash: message.contentHash,
    recipient: recipient.binding.pin,
    bindingGeneration: recipient.binding.generation,
    receivedAt: timestamp4(input.now)
  };
  const ack = {
    ...ackWithoutHash,
    contentHash: canonicalRecordHash(ackWithoutHash)
  };
  await publishImmutableRecord(target, ack, { root: input.root });
  const current = await resolveMember(
    input.root,
    input.collaborationId,
    recipient.member.alias
  );
  if (current.binding.generation !== recipient.binding.generation) {
    throw new CollaborationError(
      "COMMIT_UNCERTAIN",
      "ack published during takeover and may require replay",
      true
    );
  }
  return { ack, duplicate: false };
}

// src/skills/agent-messaging/src/probe.ts
import { cpus, platform, arch } from "node:os";
import path9 from "node:path";
import { performance } from "node:perf_hooks";
function integerInRange(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new TypeError(`${label} must be from ${minimum} through ${maximum}`);
}
function createHostProbePlan(input) {
  if (!input.optIn)
    throw new TypeError("probe creation requires explicit opt-in");
  if (!["codex", "claude-code", "cursor"].includes(input.host))
    throw new TypeError("probe host is unsupported");
  if (![
    "prompt-start",
    "stop-continuation",
    "idle-notification",
    "human-renewal"
  ].includes(input.boundary))
    throw new TypeError("probe boundary is unsupported");
  assertBoundedString(input.id, "probe ID", 128);
  assertUuid(input.collaborationId, "probe collaboration ID");
  assertPin(input.session);
  if (input.session.runtime !== input.host)
    throw new TypeError("probe host must match the exact session runtime");
  assertBoundedString(input.hostVersion, "host version", 128);
  assertBoundedString(input.surface, "host surface", 256);
  assertBoundedString(input.eventProvenance, "event provenance", 256);
  if (!path9.isAbsolute(input.worktree))
    throw new TypeError("probe worktree must be absolute");
  if (input.command.length === 0 || input.command.length > 16)
    throw new TypeError("probe command must contain 1 through 16 arguments");
  for (const argument of input.command)
    assertBoundedString(argument, "probe command argument", 1024, true);
  integerInRange(input.timeoutMs, "probe timeout milliseconds", 1, 6e4);
  const maxEvents = input.maxEvents ?? 1;
  const maxAttempts = input.maxAttempts ?? 1;
  integerInRange(maxEvents, "probe event budget", 1, 4);
  integerInRange(maxAttempts, "probe attempt budget", 1, 2);
  if (input.host === "cursor" && maxAttempts > 2)
    throw new TypeError(
      "Cursor probes allow one initial attempt and one retry"
    );
  const authorizationComplete = Boolean(
    input.liveAuthorization && Object.values(input.liveAuthorization).every((value) => value === true)
  );
  return {
    schemaVersion: 1,
    id: input.id,
    collaborationId: input.collaborationId,
    host: input.host,
    hostVersion: input.hostVersion,
    surface: input.surface,
    command: [...input.command],
    boundary: input.boundary,
    session: input.session,
    worktree: path9.resolve(input.worktree),
    eventProvenance: input.eventProvenance,
    timeoutMs: input.timeoutMs,
    maxEvents,
    maxAttempts,
    authorizationComplete,
    execution: authorizationComplete ? "live-authorized" : "fixture-only",
    capability: input.host === "cursor" || !authorizationComplete ? "manual-fallback" : "probe-candidate",
    ownershipPreflightRequired: true
  };
}

// src/skills/agent-messaging/src/registration.ts
import { mkdir as mkdir2, rename as rename2, writeFile } from "node:fs/promises";
import path11 from "node:path";

// src/shared/collaboration/ownership.ts
import { createHash as createHash4 } from "node:crypto";
import { lstat as lstat4, readFile as readFile3 } from "node:fs/promises";
import path10 from "node:path";
var OBSERVER_LEASE_SCHEMA_VERSION = 6;
var OBSERVER_LAUNCHER_OWNER = "session-observer-collab-codex-stop";
var OBSERVER_BUNDLE_MANIFEST = ".session-observer-collab-bundle.json";
var OBSERVER_BUNDLE_FILES = [
  "session-observer-collab/scripts/hooks/codex-stop.mjs"
];
var OBSERVER_COMPOSITION_CAPABILITY = "agent-messaging-stop-composition";
var OBSERVER_COMPOSITION_CAPABILITY_VERSION = 1;
var MESSAGING_HOOK_OWNER = "agent-messaging-host-hook-v1";
function fingerprint(registrations) {
  return createHash4("sha256").update(
    canonicalJson(
      registrations.map(({ source, configuration }) => ({ source, configuration })).toSorted(
        (left, right) => left.source.localeCompare(right.source) || canonicalJson(left.configuration).localeCompare(
          canonicalJson(right.configuration)
        )
      )
    )
  ).digest("hex");
}
function stopRegistrations(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const hooks = value.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return [];
  const groups = hooks.Stop;
  if (!Array.isArray(groups)) return [];
  const registrations = [];
  for (const [groupIndex, group] of groups.entries()) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    const entries = group.hooks;
    if (!Array.isArray(entries)) continue;
    for (const [hookIndex, entry] of entries.entries()) {
      if (entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.command === "string") {
        const groupRecord = group;
        const { hooks: _hooks, ...groupConfiguration } = groupRecord;
        registrations.push({
          source: path10.resolve(source),
          command: entry.command,
          configuration: {
            groupIndex,
            hookIndex,
            group: groupConfiguration,
            hook: structuredClone(entry)
          }
        });
      }
    }
  }
  return registrations;
}
function stopCommands(value) {
  return stopRegistrations(value, "/inventory").map(
    (registration) => registration.command
  );
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
  if (!script || !path10.isAbsolute(script)) return false;
  const launcher = await readFile3(script, "utf8").catch(() => null);
  const marker = launcher?.match(
    new RegExp(`^// ${OBSERVER_LAUNCHER_OWNER}:([a-f0-9]{24})$`, "mu")
  );
  if (!launcher || !marker) return false;
  const supportRoot = path10.join(
    path10.dirname(script),
    `.${path10.basename(script)}.support`,
    marker[1]
  );
  const manifest = await readFile3(
    path10.join(supportRoot, OBSERVER_BUNDLE_MANIFEST),
    "utf8"
  ).then((bytes) => JSON.parse(bytes)).catch(() => null);
  if (!manifest || manifest.owner !== OBSERVER_LAUNCHER_OWNER || manifest.version !== marker[1] || JSON.stringify(manifest.files) !== JSON.stringify(OBSERVER_BUNDLE_FILES) || !manifest.capabilities || typeof manifest.capabilities !== "object" || Array.isArray(manifest.capabilities) || manifest.capabilities[OBSERVER_COMPOSITION_CAPABILITY] !== OBSERVER_COMPOSITION_CAPABILITY_VERSION || typeof manifest.contentDigest !== "string" || !/^[a-f0-9]{64}$/u.test(manifest.contentDigest) || manifest.contentDigest.slice(0, 24) !== marker[1]) {
    return false;
  }
  const hash = createHash4("sha256");
  hash.update(OBSERVER_COMPOSITION_CAPABILITY);
  hash.update("\0");
  hash.update(String(OBSERVER_COMPOSITION_CAPABILITY_VERSION));
  hash.update("\0");
  try {
    for (const file of OBSERVER_BUNDLE_FILES) {
      const installed = path10.join(supportRoot, file);
      const info = await lstat4(installed);
      if (!info.isFile() || info.isSymbolicLink()) return false;
      hash.update(file);
      hash.update("\0");
      hash.update(await readFile3(installed));
      hash.update("\0");
    }
  } catch {
    return false;
  }
  return hash.digest("hex") === manifest.contentDigest;
}
async function recognizedMessagingLauncher(command) {
  const script = commandScript(command);
  if (!script || !path10.isAbsolute(script)) return false;
  const info = await lstat4(script).catch(() => null);
  if (!info || !info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) {
    return false;
  }
  const launcher = await readFile3(script, "utf8").catch(() => null);
  if (!launcher || !launcher.includes(`"${MESSAGING_HOOK_OWNER}"`))
    return false;
  const header = launcher.slice(0, 512);
  return header.includes("// GENERATED skill payload for agent-messaging.") && (header.includes("// src/skills/agent-messaging/src/hooks/codex.ts") || header.includes("// src/skills/agent-messaging/src/hooks/claude-code.ts"));
}
async function readConfig(file) {
  return readFile3(file, "utf8").then(
    (value) => JSON.parse(value),
    (error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  );
}
async function inspectCodexStopInventory(hooksPath) {
  if (!path10.isAbsolute(hooksPath))
    throw new TypeError("Codex hooks path must be absolute");
  const unreadableSources = [];
  let config = null;
  try {
    config = await readConfig(hooksPath);
  } catch {
    unreadableSources.push(hooksPath);
  }
  const registrations = [];
  for (const registration of stopRegistrations(config, hooksPath)) {
    const { command } = registration;
    registrations.push({
      ...registration,
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
    visibilityLimits: [],
    resolvedSources: config === null ? [] : [path10.resolve(hooksPath)],
    sourceSet: null
  };
}
function resolveClaudeInventoryInput(input) {
  const env = input.env ?? process.env;
  const configRoot = env.CLAUDE_CONFIG_DIR ?? path10.join(env.HOME ?? input.cwd, ".claude");
  const managed = process.platform === "darwin" ? "/Library/Application Support/ClaudeCode/managed-settings.json" : "/etc/claude-code/managed-settings.json";
  const overridden = input.settingsPaths ?? (env.AGENT_MESSAGING_CLAUDE_SETTINGS ? env.AGENT_MESSAGING_CLAUDE_SETTINGS.split(path10.delimiter).filter(
    Boolean
  ) : null);
  const settingsPaths = overridden ?? [
    path10.join(configRoot, "settings.json"),
    path10.join(input.cwd, ".claude", "settings.json"),
    path10.join(input.cwd, ".claude", "settings.local.json"),
    managed
  ];
  const installedPlugins = input.installedPlugins ?? (env.AGENT_MESSAGING_CLAUDE_PLUGINS ? JSON.parse(env.AGENT_MESSAGING_CLAUDE_PLUGINS) : {});
  return {
    settingsPaths: settingsPaths.map((source) => path10.resolve(source)),
    installedPlugins: Object.fromEntries(
      Object.entries(installedPlugins).map(([name, root]) => [
        name,
        path10.resolve(root)
      ])
    )
  };
}
async function inspectClaudeStopInventory(input) {
  const registrations = [];
  const unreadableSources = [];
  const unresolvedPlugins = [];
  const resolvedSources = [];
  const enabledPlugins = /* @__PURE__ */ new Set();
  for (const source of input.settingsPaths) {
    if (!path10.isAbsolute(source))
      throw new TypeError("Claude settings paths must be absolute");
    let config = null;
    try {
      config = await readConfig(source);
    } catch {
      unreadableSources.push(source);
      continue;
    }
    if (config !== null) resolvedSources.push(path10.resolve(source));
    for (const registration of stopRegistrations(config, source)) {
      const { command } = registration;
      registrations.push({
        ...registration,
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
    if (!pluginRoot || !path10.isAbsolute(pluginRoot)) {
      unresolvedPlugins.push(name);
      continue;
    }
    const source = path10.join(pluginRoot, "hooks", "hooks.json");
    let config = null;
    try {
      config = await readConfig(source);
    } catch {
      unreadableSources.push(source);
      continue;
    }
    if (config !== null) resolvedSources.push(path10.resolve(source));
    for (const registration of stopRegistrations(config, source)) {
      const { command } = registration;
      registrations.push({
        ...registration,
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
    ],
    resolvedSources,
    sourceSet: {
      settingsPaths: input.settingsPaths.map((source) => path10.resolve(source)),
      installedPlugins: Object.fromEntries(
        Object.entries(input.installedPlugins ?? {}).map(([name, root]) => [
          name,
          path10.resolve(root)
        ])
      )
    }
  };
}
var SAFE_LEASE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
function validLeaseId(value) {
  return typeof value === "string" && SAFE_LEASE_ID.test(value) && value !== "." && value !== "..";
}
function validInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function validateObserverLease(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new TypeError("observer lease must be an object");
  const lease = raw;
  if (lease.schemaVersion !== OBSERVER_LEASE_SCHEMA_VERSION || !validLeaseId(lease.leaseId) || !["claude-code", "codex", "cursor"].includes(lease.runtime) || !["claude-code", "codex", "cursor"].includes(lease.peerRuntime) || !validLeaseId(lease.ownerSession) || !validLeaseId(lease.peerSession) || typeof lease.ownerCwd !== "string" || !path10.isAbsolute(lease.ownerCwd) || lease.ownerCwd.includes("\0") || typeof lease.peerTranscript !== "string" || !path10.isAbsolute(lease.peerTranscript) || lease.peerTranscript.includes("\0") || typeof lease.peerCanonicalTranscriptPath !== "string" || !path10.isAbsolute(lease.peerCanonicalTranscriptPath) || lease.peerCanonicalTranscriptPath.includes("\0") || path10.resolve(lease.peerTranscript) !== path10.resolve(lease.peerCanonicalTranscriptPath) || lease.peerIndexBase !== (lease.peerRuntime === "cursor" ? "zero-based-jsonl-frame-index" : "zero-based-jsonl-record-index") || !["armed", "waiting", "idle", "triggered", "disarmed"].includes(
    lease.state
  ) || !validTimestamp(lease.armedAt) || !validTimestamp(lease.expiresAt) || !validTimestamp(lease.updatedAt) || !validInteger(lease.waitMs, 0, 6e4) || !validInteger(lease.leaseMs, 1, 24 * 60 * 60 * 1e3) || !validInteger(lease.peerCursor, 0, Number.MAX_SAFE_INTEGER) || !validInteger(lease.continuationCount, 0, 100) || !validInteger(lease.continuationCap, 1, 100) || !validInteger(lease.loopCount, 0, 1e3) || !validInteger(lease.loopCap, 1, 1e3) || lease.continuationCount > lease.continuationCap || lease.loopCount > lease.loopCap || lease.diagnostic !== null && typeof lease.diagnostic !== "string")
    throw new TypeError("observer lease schema is invalid");
  const timingBothNull = lease.waitStartedAt === null && lease.waitDeadlineAt === null;
  const timingBothValid = validTimestamp(lease.waitStartedAt) && validTimestamp(lease.waitDeadlineAt);
  const waiterBothNull = lease.waitToken === null && lease.waitPid === null;
  const waiterBothValid = validLeaseId(lease.waitToken) && validInteger(lease.waitPid, 1, Number.MAX_SAFE_INTEGER);
  if (!timingBothNull && !timingBothValid || !waiterBothNull && !waiterBothValid || lease.state !== "waiting" && (!timingBothNull || !waiterBothNull))
    throw new TypeError("observer wait state is invalid");
  if (timingBothValid) {
    const started = Date.parse(lease.waitStartedAt);
    const deadline = Date.parse(lease.waitDeadlineAt);
    if (deadline < started || deadline - started > lease.waitMs || deadline > Date.parse(lease.expiresAt))
      throw new TypeError("observer wait deadline is invalid");
  }
  if (Date.parse(lease.expiresAt) < Date.parse(lease.armedAt) || Date.parse(lease.expiresAt) - Date.parse(lease.armedAt) !== lease.leaseMs)
    throw new TypeError("observer lease duration is invalid");
  if (lease.peerRuntime === "cursor") {
    const checkpoint = lease.peerContinuity;
    if (!checkpoint || checkpoint.indexBase !== "zero-based-jsonl-frame-index" || !validInteger(checkpoint.nextFrameIndex, 0, Number.MAX_SAFE_INTEGER) || !validInteger(checkpoint.prefixBytes, 0, Number.MAX_SAFE_INTEGER) || !validInteger(checkpoint.observedSize, 0, Number.MAX_SAFE_INTEGER) || checkpoint.nextFrameIndex !== lease.peerCursor || checkpoint.prefixBytes > checkpoint.observedSize || typeof checkpoint.prefixSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(checkpoint.prefixSha256) || ![checkpoint.device, checkpoint.inode].every(
      (value) => value === null || validInteger(value, 0, Number.MAX_SAFE_INTEGER)
    ))
      throw new TypeError("observer cursor continuity is invalid");
  } else if (lease.peerContinuity !== null) {
    throw new TypeError("observer record continuity is invalid");
  }
  if (lease.runtime === "claude-code") {
    const composed = lease.composedActivation;
    if (!composed || composed.controller !== "observer-collab" || composed.mechanism !== "monitor" || composed.ownerRuntime !== lease.runtime || composed.ownerSession !== lease.ownerSession || composed.peerRuntime !== lease.peerRuntime || composed.peerSession !== lease.peerSession || composed.ownerCwd !== lease.ownerCwd || composed.peerTranscript !== lease.peerTranscript || composed.oldMonitorStopped !== true || composed.standaloneWatcherStopped !== true || !validTimestamp(composed.confirmedAt))
      throw new TypeError("Claude composed Monitor lease is invalid");
  }
  return lease;
}
async function inspectObserverLease(input) {
  const file = path10.join(input.root, "leases", `${input.pin.sessionId}.json`);
  let info;
  try {
    info = await lstat4(file);
  } catch (error) {
    if (error.code === "ENOENT")
      return { state: "absent", lease: null };
    return { state: "uncertain", lease: null };
  }
  if (!info.isFile() || info.isSymbolicLink() || process.getuid && info.uid !== process.getuid() || info.size > 64 * 1024) {
    return { state: "uncertain", lease: null };
  }
  let lease;
  try {
    lease = validateObserverLease(JSON.parse(await readFile3(file, "utf8")));
  } catch {
    return { state: "uncertain", lease: null };
  }
  if (lease.runtime !== input.pin.runtime || lease.ownerSession !== input.pin.sessionId || path10.resolve(lease.ownerCwd) !== path10.resolve(input.worktree)) {
    return { state: "uncertain", lease };
  }
  if (lease.state === "triggered") return { state: "present", lease };
  if (["idle", "disarmed"].includes(lease.state))
    return { state: "inactive", lease };
  const now = (input.now ?? /* @__PURE__ */ new Date()).getTime();
  if (now >= Date.parse(lease.expiresAt) || lease.continuationCount >= lease.continuationCap || lease.loopCount >= lease.loopCap || lease.state === "waiting" && (lease.waitDeadlineAt === null || now >= Date.parse(lease.waitDeadlineAt))) {
    return { state: "inactive", lease };
  }
  return { state: "present", lease };
}
async function assessAutomaticOwnership(input) {
  assertPin(input.pin);
  const inspectedLease = await inspectObserverLease(input);
  const lease = inspectedLease.state;
  const observerLease = inspectedLease.lease;
  const recoveryCommand = `node <observer-collab-skill>/scripts/collab-control.mjs disarm --session ${input.pin.sessionId}`;
  if (lease === "uncertain") {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      controller: null,
      reason: "observer ownership cannot be established safely",
      recoveryCommand,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null,
      composedMonitorLeaseId: null,
      composedMonitorPeer: null
    };
  }
  if (input.inventory.unreadableSources.length > 0 || input.inventory.unresolvedPlugins.length > 0 || input.inventory.runtime === "claude-code" && input.inventory.resolvedSources.length === 0) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      controller: null,
      reason: "required hook inventory is unreadable or unresolved",
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null,
      composedMonitorLeaseId: null,
      composedMonitorPeer: null
    };
  }
  const recognizedObserver = input.inventory.registrations.some(
    (registration) => registration.recognizedObserver
  );
  const recognizedMessaging = input.inventory.registrations.some(
    (registration) => registration.recognizedMessaging
  );
  let controller;
  if (lease === "present") {
    if (input.requestedController === "standalone-messaging") {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: "an exact-session observer continuation owner is active or triggered",
        recoveryCommand,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null
      };
    }
    if (input.pin.runtime === "claude-code") {
      const composed = observerLease?.composedActivation;
      if (!composed || composed.activationId !== input.requestedActivationId || composed.collaborationId !== input.requestedCollaborationId) {
        return {
          automaticAllowed: false,
          observerOwner: lease,
          controller: null,
          reason: "Claude composed delivery requires the exact verified composed Monitor activation",
          recoveryCommand: null,
          inventory: input.inventory,
          thirdPartyAcknowledgmentRequired: false,
          acknowledgedFingerprint: null,
          composedMonitorLeaseId: null,
          composedMonitorPeer: null
        };
      }
    }
    if (input.pin.runtime !== "claude-code" && !recognizedObserver) {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: "the active observer lease has no verified composed-capable adapter",
        recoveryCommand,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null
      };
    }
    if (recognizedMessaging) {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: "standalone messaging and observer Stop registrations both exist; remove the standalone route before composition",
        recoveryCommand: null,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null
      };
    }
    controller = "observer-collab";
  } else {
    if (input.requestedController === "observer-collab") {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: input.pin.runtime === "claude-code" ? "composed-monitor-inactive: Claude observer delivery requires an exact active dedicated composed Monitor" : "observer-collab requires an active exact-session lease and verified composed-capable adapter",
        recoveryCommand: null,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null
      };
    }
    controller = "standalone-messaging";
  }
  const thirdParty = input.inventory.registrations.filter(
    (registration) => !registration.recognizedObserver && !registration.recognizedMessaging
  );
  if (thirdParty.length > 0 && input.acknowledgedFingerprint !== input.inventory.fingerprint) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      controller: null,
      reason: "third-party Stop registrations require exact scoped acknowledgment",
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: true,
      acknowledgedFingerprint: null,
      composedMonitorLeaseId: null,
      composedMonitorPeer: null
    };
  }
  return {
    automaticAllowed: true,
    observerOwner: lease,
    controller,
    reason: controller === "observer-collab" ? "the exact-session observer lease and verified composed adapter own the single bounded route" : "no active observer owner and the bounded hook inventory is accepted",
    recoveryCommand: null,
    inventory: input.inventory,
    thirdPartyAcknowledgmentRequired: thirdParty.length > 0,
    acknowledgedFingerprint: thirdParty.length > 0 ? input.inventory.fingerprint : null,
    composedMonitorLeaseId: input.pin.runtime === "claude-code" && controller === "observer-collab" ? observerLease?.leaseId ?? null : null,
    composedMonitorPeer: input.pin.runtime === "claude-code" && controller === "observer-collab" ? {
      runtime: observerLease.peerRuntime,
      sessionId: observerLease.peerSession
    } : null
  };
}

// src/skills/agent-messaging/src/registration.ts
function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
function codexMessagingCommand(scriptPath) {
  if (!path11.isAbsolute(scriptPath))
    throw new TypeError("messaging hook script path must be absolute");
  return `node -- ${shellQuote(path11.resolve(scriptPath))}`;
}
async function writeJsonAtomic(file, value) {
  await mkdir2(path11.dirname(file), { recursive: true, mode: 448 });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}
`, {
    mode: 384
  });
  await rename2(temporary, file);
}
async function installCodexMessagingHooks(input) {
  if (!path11.isAbsolute(input.hooksPath))
    throw new TypeError("Codex hooks path must be absolute");
  const config = await readConfig(input.hooksPath) ?? {};
  const hooks = config.hooks && typeof config.hooks === "object" && !Array.isArray(config.hooks) ? structuredClone(config.hooks) : {};
  const command = codexMessagingCommand(input.scriptPath);
  let changed = false;
  for (const event of ["UserPromptSubmit", "Stop"]) {
    const groups = Array.isArray(hooks[event]) ? structuredClone(hooks[event]) : [];
    const exists = stopCommands({ hooks: { Stop: groups } }).includes(command);
    if (!exists) {
      groups.push({ hooks: [{ type: "command", command, timeout: 65 }] });
      hooks[event] = groups;
      changed = true;
    }
  }
  if (changed) await writeJsonAtomic(input.hooksPath, { ...config, hooks });
  return { changed, exactCommand: command };
}
async function uninstallCodexMessagingHooks(input) {
  if (!path11.isAbsolute(input.hooksPath))
    throw new TypeError("Codex hooks path must be absolute");
  const config = await readConfig(input.hooksPath);
  if (!config || typeof config !== "object" || Array.isArray(config))
    return { changed: false };
  const next = structuredClone(config);
  const hooks = next.hooks;
  if (!hooks) return { changed: false };
  const command = codexMessagingCommand(input.scriptPath);
  let changed = false;
  for (const event of ["UserPromptSubmit", "Stop"]) {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
    hooks[event] = groups.map((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group))
        return group;
      const entries = Array.isArray(group.hooks) ? group.hooks ?? [] : [];
      const filtered = entries.filter(
        (entry) => !entry || typeof entry !== "object" || Array.isArray(entry) || entry.command !== command
      );
      if (filtered.length !== entries.length) changed = true;
      return { ...group, hooks: filtered };
    }).filter(
      (group) => !group || typeof group !== "object" || Array.isArray(group) || (group.hooks?.length ?? 0) > 0
    );
  }
  if (changed) await writeJsonAtomic(input.hooksPath, next);
  return { changed };
}
function claudeSessionHookDeclaration(scriptPath) {
  const command = codexMessagingCommand(scriptPath);
  return {
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: "command", command, timeout: 65 }] }
      ],
      Stop: [{ hooks: [{ type: "command", command, timeout: 65 }] }]
    }
  };
}

// src/skills/agent-messaging/src/watch.ts
import path12 from "node:path";
var MAX_WATCH_DURATION_MS = 30 * 60 * 1e3;
var DEFAULT_WATCH_POLL_MS = 1e3;
function validateTiming(durationMs, pollMs) {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > MAX_WATCH_DURATION_MS) {
    throw new TypeError("watch duration must be from 1ms through 30 minutes");
  }
  if (!Number.isSafeInteger(pollMs) || pollMs <= 0 || pollMs > 6e4) {
    throw new TypeError("watch poll interval must be from 1ms through 60s");
  }
}
async function inventoryFor(input, claudeSources) {
  const env = input.env ?? process.env;
  if (input.pin.runtime === "codex") {
    return inspectCodexStopInventory(
      env.AGENT_MESSAGING_HOOKS_PATH ?? path12.join(env.HOME ?? input.worktree, ".codex", "hooks.json")
    );
  }
  if (input.pin.runtime !== "claude-code")
    throw new DeliveryError(
      "DELIVERY_INACTIVE",
      "this host has no verified standalone watch boundary"
    );
  return inspectClaudeStopInventory(
    claudeSources ?? { settingsPaths: [], installedPlugins: {} }
  );
}
async function acceptedOwnership(input, now) {
  const status = await activationStatus(input.root, input.pin, now);
  if (!status.active || !status.activation || status.activation.collaborationId !== input.collaborationId || status.activation.worktree !== path12.resolve(input.worktree) || status.activation.controller !== "standalone-messaging" || status.activation.mechanism !== "monitor") {
    return { status, allowed: false };
  }
  if (input.pin.runtime === "claude-code" && (!input.confirmNoObserverMonitor || !status.activation.noObserverMonitorAttestation || status.activation.noObserverMonitorAttestation.epoch !== status.activation.epoch)) {
    return { status, allowed: false };
  }
  const ownership = await assessAutomaticOwnership({
    root: input.root,
    pin: input.pin,
    worktree: input.worktree,
    inventory: await inventoryFor(
      input,
      status.activation.claudeInventorySources
    ),
    acknowledgedFingerprint: status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    requestedController: status.activation.controller,
    now
  });
  return {
    status,
    allowed: ownership.automaticAllowed && ownership.controller === status.activation.controller
  };
}
async function watchInbox(input, dependencies) {
  const pollMs = input.pollMs ?? DEFAULT_WATCH_POLL_MS;
  validateTiming(input.durationMs, pollMs);
  if (!path12.isAbsolute(input.worktree))
    throw new TypeError("watch worktree must be absolute");
  const currentTime = dependencies.now ?? (() => /* @__PURE__ */ new Date());
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = currentTime().getTime();
  const requestedDeadline = startedAt + input.durationMs;
  const maximumIterations = Math.ceil(input.durationMs / pollMs) + 1;
  let notifications = 0;
  let claimedRequests = 0;
  let iterations = 0;
  let reason = "duration-complete";
  while (iterations < maximumIterations) {
    if (dependencies.signal?.aborted) {
      reason = "interrupted";
      break;
    }
    const now = currentTime();
    const ownership = await acceptedOwnership(input, now);
    const activation = ownership.status.activation;
    if (!activation || !ownership.status.active) {
      reason = "activation-inactive";
      break;
    }
    if (!ownership.allowed) {
      reason = "ownership-refused";
      break;
    }
    const expiry = Date.parse(ownership.status.effectiveExpiresAt);
    const deadline = Math.min(requestedDeadline, expiry);
    if (now.getTime() >= deadline) break;
    const claims = await deliveryClaimStatus({
      root: input.root,
      pin: input.pin
    });
    if (claims.remainingSlots === 0) {
      reason = "budget-exhausted";
      break;
    }
    iterations += 1;
    const inbox = await listInbox({
      root: input.root,
      collaborationId: input.collaborationId,
      pin: input.pin,
      maxMessages: 4096,
      maxBytes: Number.MAX_SAFE_INTEGER
    });
    const requests = inbox.messages.filter(
      (message) => message.kind === "request" && !message.inert
    );
    if (requests.length > 0) {
      const keys = await resolveDeliveryKeys({
        root: input.root,
        activation,
        messages: requests
      });
      const eventKey = watchBatchEventKey({
        activationId: activation.id,
        bindingGeneration: activation.bindingGeneration,
        deliveryKeys: keys
      });
      let finalOwnership = true;
      const claim = await claimDelivery({
        root: input.root,
        pin: input.pin,
        eventKey,
        deliveryKeys: keys,
        now,
        clock: currentTime,
        hooks: {
          afterEventClaim: dependencies.afterEventClaim,
          beforeFinalValidation: async () => {
            const final = await acceptedOwnership(input, currentTime());
            finalOwnership = final.allowed && final.status.activation?.id === activation.id;
          }
        }
      });
      if (finalOwnership && claim.activeAfterClaim && claim.owned.length > 0) {
        const owned = new Set(claim.owned.map((item) => item.messageId));
        const selected = requests.filter((message) => owned.has(message.id));
        const preEmit = await acceptedOwnership(input, currentTime());
        if (!preEmit.allowed || preEmit.status.activation?.id !== activation.id) {
          reason = preEmit.status.active ? "ownership-refused" : "activation-inactive";
          break;
        }
        await publishDeliveryDiagnostic({
          root: input.root,
          pin: input.pin,
          diagnostic: {
            attemptId: claim.event.token,
            activationId: activation.id,
            eventKey,
            boundary: "watch",
            recordedAt: currentTime().toISOString(),
            stage: "output-attempted",
            outcomeCode: "watch-notification-attempted",
            errorCode: null
          }
        }).catch(() => void 0);
        await dependencies.emit({
          type: "agent-messaging-request-notification",
          collaborationId: input.collaborationId,
          activationId: activation.id,
          eventKey,
          untrusted: true,
          requests: selected.map((message) => ({
            id: message.id,
            from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
            priority: message.priority,
            subject: message.subject
          }))
        });
        notifications += 1;
        claimedRequests += selected.length;
      }
    }
    const remaining = deadline - currentTime().getTime();
    if (remaining <= 0) break;
    await sleep(Math.min(pollMs, remaining));
  }
  return { reason, notifications, claimedRequests, iterations };
}

// src/skills/agent-messaging/src/agent-messaging.ts
function attachOpenContext(error, collaborationId, root) {
  const contextual = error instanceof Error ? error : new Error(String(error));
  contextual.collaborationId = collaborationId;
  contextual.paths = collaborationPaths(root, collaborationId);
  return contextual;
}
var HELP = `agent-messaging \u2014 durable addressed messaging between local coding-agent sessions

Usage:
  node agent-messaging.mjs open --self <runtime:id> --alias <name> --label <label> --task <text>
  node agent-messaging.mjs join --collab <uuid> --self <runtime:id> --alias <name>
  node agent-messaging.mjs send --collab <uuid> --self <runtime:id> --to <alias> --id <uuid> --subject <text> --body-stdin [--reply-to <participantId>/<messageId>]
  node agent-messaging.mjs inbox|ack|status|leave|close ...
  node agent-messaging.mjs delivery enable|disable|retry|watch|probe-plan ...
  node agent-messaging.mjs log append|show|render ...

Common flags: --root <absolute-path> --json --help`;
function defaultReadStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    process.stdin.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 33 * 1024) {
        reject(new TypeError("stdin exceeds the bounded body envelope"));
        process.stdin.destroy();
      } else chunks.push(chunk);
    });
    process.stdin.on(
      "end",
      () => resolve(Buffer.concat(chunks).toString("utf8"))
    );
    process.stdin.on("error", reject);
  });
}
function defaultIo() {
  return {
    env: process.env,
    cwd: process.cwd(),
    readStdin: defaultReadStdin,
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value)
  };
}
function parse(argv) {
  const flags = /* @__PURE__ */ new Map();
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if ([
      "json",
      "help",
      "all",
      "body-stdin",
      "what-stdin",
      "confirm-no-observer-monitor",
      "confirm-old-monitor-stopped",
      "confirm-standalone-watcher-stopped",
      "probe-opt-in"
    ].includes(name)) {
      flags.set(name, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new TypeError(`--${name} requires a value`);
    flags.set(name, value);
    index += 1;
  }
  return { positionals, flags };
}
function required(parsed, name) {
  const value = parsed.flags.get(name);
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError(`--${name} is required`);
  return value;
}
function optional(parsed, name) {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : void 0;
}
function jsonFlag(parsed, name) {
  try {
    return JSON.parse(required(parsed, name));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new TypeError(`--${name} must contain valid JSON`, {
        cause: error
      });
    }
    throw error;
  }
}
function jsonStringRecordFlag(parsed, name) {
  const value = jsonFlag(parsed, name);
  if (value === null || typeof value !== "object" || Array.isArray(value) || !Object.values(value).every((entry) => typeof entry === "string")) {
    throw new TypeError(`--${name} must be a JSON string map`);
  }
  return value;
}
function integer(parsed, name, fallback) {
  const value = optional(parsed, name);
  if (value === void 0) return fallback;
  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue))
    throw new TypeError(`--${name} must be an integer`);
  return parsedValue;
}
function duration(value, fallback) {
  if (value === void 0) return fallback;
  const match = /^(\d+)(ms|s|m|h)$/u.exec(value);
  if (!match) throw new TypeError("duration must use ms, s, m, or h");
  const amount = Number(match[1]);
  const multiplier = { ms: 1, s: 1e3, m: 6e4, h: 36e5 }[match[2]];
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0)
    throw new TypeError("duration is out of range");
  return milliseconds;
}
function parsePin(value) {
  const separator = value.indexOf(":");
  if (separator <= 0) throw new TypeError("self pin must be runtime:sessionId");
  const pin = {
    runtime: value.slice(0, separator),
    sessionId: value.slice(separator + 1)
  };
  assertPin(pin);
  return pin;
}
function parseReplyTo(value) {
  if (!value) return null;
  const parts = value.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TypeError("--reply-to must be <participantId>/<messageId>");
  }
  assertUuid(parts[0], "reply participant ID");
  assertUuid(parts[1], "reply message ID");
  return { participantId: parts[0], messageId: parts[1] };
}
function harnessPin(env) {
  if (env.AGENT_MESSAGING_SELF_PIN)
    return parsePin(env.AGENT_MESSAGING_SELF_PIN);
  if (env.CODEX_THREAD_ID)
    return { runtime: "codex", sessionId: env.CODEX_THREAD_ID };
  if (env.CLAUDE_SESSION_ID)
    return { runtime: "claude-code", sessionId: env.CLAUDE_SESSION_ID };
  if (env.CURSOR_SESSION_ID)
    return { runtime: "cursor", sessionId: env.CURSOR_SESSION_ID };
  return null;
}
function resolveSelf(parsed, env) {
  const explicit = optional(parsed, "self");
  const detected = harnessPin(env);
  if (explicit) {
    const pin = parsePin(explicit);
    if (detected && !pinsEqual(pin, detected)) {
      const error = new TypeError(
        "explicit --self conflicts with the available harness identity"
      );
      error.name = "IDENTITY_CONFLICT";
      throw error;
    }
    return pin;
  }
  if (detected) return detected;
  throw new TypeError(
    "--self is required when no exact harness identity is available"
  );
}
function rootFor(parsed, env) {
  const explicit = optional(parsed, "root");
  if (explicit) {
    if (!path13.isAbsolute(explicit))
      throw new TypeError("--root must be absolute");
    return path13.resolve(explicit);
  }
  return resolveCollaborationRoot(env);
}
function success(operation, collaborationId, data) {
  return { ok: true, operation, collaborationId, data };
}
function exitFor(error) {
  if (error instanceof MembershipError && ["COLLABORATION_CLOSED", "MEMBER_DEPARTED"].includes(error.code))
    return 3;
  if (error instanceof DeliveryError && error.code === "DELIVERY_INACTIVE")
    return 3;
  if (error instanceof TypeError || error instanceof MembershipError || error instanceof DeliveryError)
    return 2;
  if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT" && error.message.includes("closed"))
    return 3;
  return 1;
}
function errorCode(error) {
  if (error instanceof CollaborationError || error instanceof MembershipError || error instanceof DeliveryError)
    return error.code;
  if (error instanceof Error && error.name === "IDENTITY_CONFLICT")
    return "IDENTITY_CONFLICT";
  return error instanceof TypeError ? "INVALID_INPUT" : "RUNTIME_ERROR";
}
async function unresolvedSummary(root, collaborationId, pin) {
  try {
    const inbox = await listInbox({
      root,
      collaborationId,
      pin,
      maxMessages: 4096,
      maxBytes: Number.MAX_SAFE_INTEGER
    });
    return {
      unresolvedCount: inbox.messages.length,
      unresolvedMessageIds: inbox.messages.map((message) => message.id),
      summaryError: null
    };
  } catch (error) {
    return {
      unresolvedCount: null,
      unresolvedMessageIds: [],
      summaryError: {
        code: errorCode(error),
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
async function execute(parsed, io) {
  const [command, subcommand] = parsed.positionals;
  if (!command) throw new TypeError("a command is required");
  const root = rootFor(parsed, io.env);
  if (command === "open") {
    const collaborationId2 = optional(parsed, "collab") ?? randomUUID6();
    const self = resolveSelf(parsed, io.env);
    const result = await openCollaboration({
      root,
      collaborationId: collaborationId2,
      pin: self,
      alias: required(parsed, "alias"),
      label: required(parsed, "label"),
      task: required(parsed, "task"),
      worktree: optional(parsed, "cwd") ?? io.cwd
    }).catch((error) => {
      throw attachOpenContext(error, collaborationId2, root);
    });
    return {
      operation: "open",
      collaborationId: collaborationId2,
      data: {
        ...result,
        root,
        paths: collaborationPaths(root, collaborationId2)
      }
    };
  }
  const collaborationId = required(parsed, "collab");
  if (command === "join") {
    const pin = resolveSelf(parsed, io.env);
    const succeeds = optional(parsed, "succeeds");
    const input = {
      root,
      collaborationId,
      pin,
      alias: required(parsed, "alias"),
      worktree: optional(parsed, "cwd") ?? io.cwd
    };
    const result = succeeds ? await takeOverMembership({
      ...input,
      expectedPreviousPin: parsePin(succeeds),
      reason: required(parsed, "reason")
    }) : await joinCollaboration(input);
    return { operation: "join", collaborationId, data: result };
  }
  if (command === "send") {
    const body = parsed.flags.has("body-stdin") ? await io.readStdin() : required(parsed, "body");
    const result = await sendMessage({
      root,
      collaborationId,
      senderPin: resolveSelf(parsed, io.env),
      recipientAlias: required(parsed, "to"),
      id: required(parsed, "id"),
      kind: optional(parsed, "kind") ?? "update",
      priority: optional(parsed, "priority") ?? "normal",
      subject: required(parsed, "subject"),
      body,
      replyTo: parseReplyTo(optional(parsed, "reply-to"))
    });
    return {
      operation: "send",
      collaborationId,
      data: {
        ...result,
        queued: true,
        paths: collaborationPaths(root, collaborationId)
      }
    };
  }
  if (command === "inbox") {
    const pin = resolveSelf(parsed, io.env);
    const messageId = optional(parsed, "message");
    const data = messageId ? await readMessage({ root, collaborationId, pin, messageId }) : await listInbox({
      root,
      collaborationId,
      pin,
      includeAcknowledged: parsed.flags.has("all")
    });
    return { operation: "inbox", collaborationId, data };
  }
  if (command === "ack") {
    const data = await acknowledgeMessage({
      root,
      collaborationId,
      pin: resolveSelf(parsed, io.env),
      messageId: required(parsed, "message")
    });
    return { operation: "ack", collaborationId, data };
  }
  if (command === "delivery" && subcommand === "enable") {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime === "cursor")
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "Cursor automatic delivery is unverified; use the manual inbox"
      );
    const expiryMode = optional(parsed, "expiry-mode") ?? "fixed";
    if (!["fixed", "human-idle"].includes(expiryMode))
      throw new TypeError("--expiry-mode must be fixed or human-idle");
    if (expiryMode === "human-idle")
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "human-idle delivery is unavailable until this exact host/version has qualifying live human-origin evidence"
      );
    const worktree = optional(parsed, "cwd") ?? io.cwd;
    const mechanism = optional(parsed, "mechanism") ?? "stop";
    if (!["stop", "monitor"].includes(mechanism))
      throw new TypeError("--mechanism must be stop or monitor");
    const requestedController = optional(parsed, "controller");
    const requestedActivationId = optional(parsed, "activation-id");
    if (requestedController !== void 0 && !["standalone-messaging", "observer-collab"].includes(requestedController)) {
      throw new TypeError(
        "--controller must be standalone-messaging or observer-collab"
      );
    }
    const inventory = pin.runtime === "codex" ? await inspectCodexStopInventory(
      optional(parsed, "hooks-path") ?? path13.join(io.env.HOME ?? io.cwd, ".codex", "hooks.json")
    ) : await inspectClaudeStopInventory(
      resolveClaudeInventoryInput({
        cwd: worktree,
        env: io.env,
        settingsPaths: optional(parsed, "settings-paths")?.split(path13.delimiter).filter(Boolean),
        installedPlugins: optional(parsed, "installed-plugins") ? jsonStringRecordFlag(parsed, "installed-plugins") : void 0
      })
    );
    const ownership = await assessAutomaticOwnership({
      root,
      pin,
      worktree,
      inventory,
      acknowledgedFingerprint: optional(parsed, "acknowledge-stop-hooks") ?? null,
      requestedController,
      requestedActivationId,
      requestedCollaborationId: collaborationId
    });
    if (!ownership.automaticAllowed) {
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        `${ownership.reason}${ownership.recoveryCommand ? `; recovery: ${ownership.recoveryCommand}` : ""}`
      );
    }
    if (ownership.controller === "observer-collab" && (pin.runtime === "claude-code" && mechanism !== "monitor" || pin.runtime !== "claude-code" && mechanism !== "stop")) {
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        pin.runtime === "claude-code" ? "Claude observer-collab requires the verified finite composed Monitor" : "observer-collab requires the verified Stop adapter"
      );
    }
    if (ownership.controller === "observer-collab" && pin.runtime === "claude-code" && (!parsed.flags.has("confirm-old-monitor-stopped") || !parsed.flags.has("confirm-standalone-watcher-stopped")))
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "Claude composed Monitor enable requires fresh acting-session confirmation that the old Monitor and standalone watcher are stopped"
      );
    if (ownership.controller === "standalone-messaging" && pin.runtime === "claude-code" && !parsed.flags.has("confirm-no-observer-monitor")) {
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "Claude standalone delivery requires --confirm-no-observer-monitor from the acting session"
      );
    }
    const data = await enableActivation({
      root,
      collaborationId,
      pin,
      worktree,
      activationId: requestedActivationId,
      mechanism,
      controller: ownership.controller ?? void 0,
      expiryMode,
      idleTimeoutMs: duration(
        optional(parsed, "idle-timeout"),
        2 * 60 * 60 * 1e3
      ),
      fixedDurationMs: duration(
        optional(parsed, "expires-in"),
        2 * 60 * 60 * 1e3
      ),
      maxDurationMs: duration(
        optional(parsed, "max-duration"),
        MAX_ACTIVATION_DURATION_MS
      ),
      maxContinuations: integer(parsed, "max-continuations", 20),
      waitMs: integer(parsed, "wait-ms", 0),
      thirdPartyHookAcknowledgment: ownership.acknowledgedFingerprint ? {
        configurationFingerprint: ownership.acknowledgedFingerprint,
        acknowledgedAt: (/* @__PURE__ */ new Date()).toISOString()
      } : null,
      noObserverMonitorConfirmed: ownership.controller === "standalone-messaging" && pin.runtime === "claude-code" && parsed.flags.has("confirm-no-observer-monitor"),
      composedMonitorAttestation: ownership.controller === "observer-collab" && pin.runtime === "claude-code" && ownership.composedMonitorLeaseId && ownership.composedMonitorPeer ? {
        owner: pin,
        peer: ownership.composedMonitorPeer,
        observerLeaseId: ownership.composedMonitorLeaseId,
        activationId: requestedActivationId,
        collaborationId,
        epoch: 0,
        confirmedAt: (/* @__PURE__ */ new Date()).toISOString(),
        oldMonitorStopped: true,
        standaloneWatcherStopped: true
      } : null,
      claudeInventorySources: pin.runtime === "claude-code" ? inventory.sourceSet : null
    });
    return { operation: "delivery.enable", collaborationId, data };
  }
  if (command === "delivery" && subcommand === "disable") {
    return {
      operation: "delivery.disable",
      collaborationId,
      data: await disableActivation({
        root,
        pin: resolveSelf(parsed, io.env)
      })
    };
  }
  if (command === "delivery" && subcommand === "retry") {
    return {
      operation: "delivery.retry",
      collaborationId,
      data: await createDeliveryRetry({
        root,
        pin: resolveSelf(parsed, io.env),
        priorAttemptId: required(parsed, "attempt"),
        messageId: required(parsed, "message")
      })
    };
  }
  if (command === "delivery" && subcommand === "watch") {
    const pin = resolveSelf(parsed, io.env);
    const data = await watchInbox(
      {
        root,
        collaborationId,
        pin,
        worktree: optional(parsed, "cwd") ?? io.cwd,
        durationMs: duration(optional(parsed, "duration"), 5 * 60 * 1e3),
        pollMs: integer(parsed, "poll-ms", 1e3),
        confirmNoObserverMonitor: parsed.flags.has(
          "confirm-no-observer-monitor"
        ),
        env: io.env
      },
      {
        emit: (notification) => io.stdout(`${JSON.stringify({ notification })}
`)
      }
    );
    return { operation: "delivery.watch", collaborationId, data };
  }
  if (command === "delivery" && subcommand === "probe-plan") {
    const pin = resolveSelf(parsed, io.env);
    const commandArguments = jsonFlag(parsed, "command");
    if (!Array.isArray(commandArguments) || !commandArguments.every((value) => typeof value === "string")) {
      throw new TypeError("--command must be a JSON string array");
    }
    const data = createHostProbePlan({
      optIn: parsed.flags.has("probe-opt-in"),
      id: required(parsed, "probe-id"),
      collaborationId,
      host: pin.runtime,
      hostVersion: required(parsed, "host-version"),
      surface: required(parsed, "surface"),
      command: commandArguments,
      boundary: required(parsed, "boundary"),
      session: pin,
      worktree: optional(parsed, "cwd") ?? io.cwd,
      eventProvenance: required(parsed, "event-provenance"),
      timeoutMs: integer(parsed, "timeout-ms", 3e4),
      maxEvents: integer(parsed, "max-events", 1),
      maxAttempts: integer(parsed, "max-attempts", 1),
      liveAuthorization: null
    });
    return { operation: "delivery.probe-plan", collaborationId, data };
  }
  if (command === "delivery" && subcommand === "inspect") {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime === "cursor") {
      return {
        operation: "delivery.inspect",
        collaborationId,
        data: {
          capability: "manual-only",
          reason: "current Cursor start/Stop delivery is not proven"
        }
      };
    }
    const inventory = pin.runtime === "codex" ? await inspectCodexStopInventory(
      optional(parsed, "hooks-path") ?? path13.join(io.env.HOME ?? io.cwd, ".codex", "hooks.json")
    ) : await inspectClaudeStopInventory(
      resolveClaudeInventoryInput({
        cwd: optional(parsed, "cwd") ?? io.cwd,
        env: io.env,
        settingsPaths: optional(parsed, "settings-paths")?.split(path13.delimiter).filter(Boolean),
        installedPlugins: optional(parsed, "installed-plugins") ? jsonStringRecordFlag(parsed, "installed-plugins") : void 0
      })
    );
    return {
      operation: "delivery.inspect",
      collaborationId,
      data: await assessAutomaticOwnership({
        root,
        pin,
        worktree: optional(parsed, "cwd") ?? io.cwd,
        inventory,
        acknowledgedFingerprint: optional(parsed, "acknowledge-stop-hooks") ?? null
      })
    };
  }
  if (command === "delivery" && subcommand === "register") {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime === "cursor")
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "Cursor automatic delivery is unverified; use the manual inbox"
      );
    const worktree = optional(parsed, "cwd") ?? io.cwd;
    const status = await activationStatus(root, pin);
    const activation = status.activation;
    if (!status.active || !activation || activation.collaborationId !== collaborationId || activation.worktree !== path13.resolve(worktree)) {
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "delivery registration requires the exact active collaboration/session/worktree activation"
      );
    }
    const hooksPath = optional(parsed, "hooks-path");
    const inventory = pin.runtime === "codex" ? await inspectCodexStopInventory(
      hooksPath ?? path13.join(io.env.HOME ?? io.cwd, ".codex", "hooks.json")
    ) : await inspectClaudeStopInventory(
      activation.claudeInventorySources ?? {
        settingsPaths: [],
        installedPlugins: {}
      }
    );
    const ownership = await assessAutomaticOwnership({
      root,
      pin,
      worktree,
      inventory,
      acknowledgedFingerprint: optional(parsed, "acknowledge-stop-hooks") ?? null,
      requestedController: activation.controller,
      requestedActivationId: activation.id,
      requestedCollaborationId: activation.collaborationId
    });
    if (!ownership.automaticAllowed) {
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        `${ownership.reason}${ownership.recoveryCommand ? `; recovery: ${ownership.recoveryCommand}` : ""}`
      );
    }
    if (ownership.controller !== activation.controller) {
      throw new DeliveryError(
        "DELIVERY_INACTIVE",
        "current ownership no longer matches the active activation controller; disable and re-enable explicitly"
      );
    }
    return {
      operation: "delivery.register",
      collaborationId,
      data: ownership.controller === "observer-collab" ? {
        changed: false,
        controller: "observer-collab",
        delegated: true,
        notice: "The verified observer adapter owns the single Stop route; no standalone messaging hook was installed."
      } : pin.runtime === "codex" ? await installCodexMessagingHooks({
        hooksPath: hooksPath ?? required(parsed, "hooks-path"),
        scriptPath: required(parsed, "script-path")
      }) : {
        changed: false,
        declaration: claudeSessionHookDeclaration(
          required(parsed, "script-path")
        ),
        notice: "Generate only: apply this session-scoped declaration explicitly; trust and invocation remain unverified."
      }
    };
  }
  if (command === "delivery" && subcommand === "unregister") {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime !== "codex")
      throw new TypeError(
        "Claude session-scoped declarations are removed by their owning session configuration"
      );
    return {
      operation: "delivery.unregister",
      collaborationId,
      data: await uninstallCodexMessagingHooks({
        hooksPath: required(parsed, "hooks-path"),
        scriptPath: required(parsed, "script-path")
      })
    };
  }
  if (command === "log" && subcommand === "append") {
    const whatHappened = parsed.flags.has("what-stdin") ? await io.readStdin() : required(parsed, "what");
    const data = await appendLogEntry({
      root,
      collaborationId,
      pin: resolveSelf(parsed, io.env),
      id: required(parsed, "id"),
      category: required(parsed, "category"),
      title: required(parsed, "title"),
      whatHappened,
      assessment: required(parsed, "assessment"),
      skillImplication: required(parsed, "implication")
    });
    return { operation: "log.append", collaborationId, data };
  }
  if (command === "log" && subcommand === "render") {
    return {
      operation: "log.render",
      collaborationId,
      data: await renderLog({ root, collaborationId })
    };
  }
  if (command === "log" && subcommand === "show") {
    return {
      operation: "log.show",
      collaborationId,
      data: await getLogView({ root, collaborationId })
    };
  }
  if (command === "status") {
    const pin = resolveSelf(parsed, io.env);
    const member = await resolveMemberByPin(root, collaborationId, pin);
    if (member.departed) {
      throw new MembershipError("MEMBER_DEPARTED", "member is inactive");
    }
    const paths = collaborationPaths(root, collaborationId);
    const closed = await readJsonRecord(paths.closed, {
      root
    }).then(
      () => true,
      (error) => {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    );
    const inbox = await listInbox({
      root,
      collaborationId,
      pin,
      includeAcknowledged: true
    }).catch((error) => ({
      error: {
        code: errorCode(error),
        message: error instanceof Error ? error.message : String(error)
      }
    }));
    const logView = await getLogView({ root, collaborationId });
    const delivery = await activationStatus(root, pin);
    const claims = await deliveryClaimStatus({ root, pin });
    const diagnostics = await latestDeliveryDiagnostic({ root, pin });
    return {
      operation: "status",
      collaborationId,
      data: {
        root,
        paths,
        closed,
        member,
        inbox,
        delivery: {
          ...delivery,
          slots: claims,
          latestDiagnostic: diagnostics.latest,
          diagnosticCapacityError: diagnostics.capacityError,
          interruptedAttempts: claims.interruptedAttempts.map((attemptId) => ({
            attemptId,
            state: "interrupted attempt \u2014 retry available",
            retryCommand: `node <skill-dir>/scripts/agent-messaging.mjs delivery retry --collab ${collaborationId} --self ${pin.runtime}:${pin.sessionId} --attempt ${attemptId} --message <uuid>`
          })),
          outcomeUnknown: claims.outcomeUnknown.map((attemptId) => ({
            attemptId,
            state: "output attempt recorded; host receipt outcome unknown"
          })),
          deliveryClaim: "attempt evidence only; never proof of delivery or acknowledgment"
        },
        logView: {
          path: logView.path,
          digest: logView.digest,
          stale: logView.stale
        }
      }
    };
  }
  if (command === "leave") {
    const pin = resolveSelf(parsed, io.env);
    const summary = await unresolvedSummary(root, collaborationId, pin);
    const member = await resolveMemberByPin(root, collaborationId, pin);
    const result = await leaveCollaboration({
      root,
      collaborationId,
      pin,
      alias: member.member.alias
    });
    return {
      operation: "leave",
      collaborationId,
      data: { result, ...summary, acknowledged: false, completed: false }
    };
  }
  if (command === "close") {
    const pin = resolveSelf(parsed, io.env);
    const result = await closeCollaboration({ root, collaborationId, pin });
    const summary = await unresolvedSummary(root, collaborationId, pin);
    return {
      operation: "close",
      collaborationId,
      data: { result, ...summary, acknowledged: false, completed: false }
    };
  }
  throw new TypeError(
    `unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`
  );
}
async function runAgentMessagingCli(argv, io = defaultIo()) {
  let parsed;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(
      `${JSON.stringify({ ok: false, operation: null, code: errorCode(error), message: error instanceof Error ? error.message : String(error), retryable: false, paths: null })}
`
    );
    return 2;
  }
  if (parsed.flags.has("help") || parsed.positionals[0] === "--help") {
    io.stdout(`${HELP}
`);
    return 0;
  }
  try {
    const result = await execute(parsed, io);
    const envelope = success(
      result.operation,
      result.collaborationId,
      result.data
    );
    io.stdout(
      `${JSON.stringify(envelope, null, parsed.flags.has("json") ? 0 : 2)}
`
    );
    return 0;
  } catch (error) {
    const contextual = error instanceof Error ? error : null;
    const operation = parsed.positionals.slice(0, 2).join(".");
    const envelope = {
      ok: false,
      operation,
      collaborationId: contextual?.collaborationId ?? null,
      code: errorCode(error),
      message: error instanceof Error ? error.message : String(error),
      retryable: error instanceof CollaborationError ? error.retryable : false,
      paths: contextual?.paths ?? null
    };
    io.stderr(`${JSON.stringify(envelope)}
`);
    return exitFor(error);
  }
}
if (process.argv[1] && realpathSync(path13.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  runAgentMessagingCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
export {
  runAgentMessagingCli
};
