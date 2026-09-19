#!/usr/bin/env node
// GENERATED skill payload for agent-messaging.

// src/skills/agent-messaging/src/agent-messaging.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { realpathSync } from "node:fs";
import path6 from "node:path";
import { fileURLToPath } from "node:url";

// src/shared/collaboration/log.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import {
  lstat as lstat3,
  open as open2,
  readFile as readFile2,
  realpath as realpath3,
  rename,
  unlink as unlink2
} from "node:fs/promises";
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

// src/shared/collaboration/log.ts
function timestamp2(value) {
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
  const target = path4.join(
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
  const entries = await enumerateJsonRecords(path4.dirname(target), {
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
    authoredAt: timestamp2(input.now),
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
  const absoluteRoot = path4.resolve(root);
  const absoluteDirectory = path4.resolve(directory);
  const relative = path4.relative(absoluteRoot, absoluteDirectory);
  if (relative.startsWith("..") || path4.isAbsolute(relative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log directory escapes the collaboration root"
    );
  }
  const expectedUid = process.getuid?.();
  const paths = [
    absoluteRoot,
    ...relative.split(path4.sep).filter(Boolean).reduce((entries, segment) => {
      entries.push(path4.join(entries.at(-1) ?? absoluteRoot, segment));
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
  const canonicalRelative = path4.relative(canonicalRoot, canonicalDirectory);
  if (canonicalRelative.startsWith("..") || path4.isAbsolute(canonicalRelative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log directory escapes the canonical root"
    );
  }
}
async function writeView(file, markdown, root) {
  const directory = path4.dirname(file);
  await inspectPrivateDirectoryChain(root, directory);
  await inspectRenderedView(file, root).catch(
    (error) => {
      if (error.code !== "ENOENT") throw error;
    }
  );
  const temporary = path4.join(
    directory,
    `.collaboration.md.tmp-${process.pid}-${randomUUID3()}`
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
  await inspectPrivateDirectoryChain(root, path4.dirname(file));
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
  const relative = path4.relative(canonicalRoot, canonicalFile);
  if (relative.startsWith("..") || path4.isAbsolute(relative)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log escapes the collaboration root"
    );
  }
  return readFile2(file, "utf8");
}

// src/shared/collaboration/messages.ts
import path5 from "node:path";
function timestamp3(value) {
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
  return path5.join(
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
  const inboxFiles = await enumerateJsonRecords(path5.dirname(target), {
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
    createdAt: timestamp3(input.now),
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
  const ackPath = path5.join(
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
  const directory = path5.join(
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
  const target = path5.join(
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
    receivedAt: timestamp3(input.now)
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
    if (["json", "help", "all", "body-stdin", "what-stdin"].includes(name)) {
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
    if (!path6.isAbsolute(explicit))
      throw new TypeError("--root must be absolute");
    return path6.resolve(explicit);
  }
  return resolveCollaborationRoot(env);
}
function success(operation, collaborationId, data) {
  return { ok: true, operation, collaborationId, data };
}
function exitFor(error) {
  if (error instanceof MembershipError && ["COLLABORATION_CLOSED", "MEMBER_DEPARTED"].includes(error.code))
    return 3;
  if (error instanceof TypeError || error instanceof MembershipError) return 2;
  if (error instanceof CollaborationError && error.code === "RECORD_CONFLICT" && error.message.includes("closed"))
    return 3;
  return 1;
}
function errorCode(error) {
  if (error instanceof CollaborationError || error instanceof MembershipError)
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
    const collaborationId2 = optional(parsed, "collab") ?? randomUUID4();
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
    return {
      operation: "status",
      collaborationId,
      data: {
        root,
        paths,
        closed,
        member,
        inbox,
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
if (process.argv[1] && realpathSync(path6.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  runAgentMessagingCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
export {
  runAgentMessagingCli
};
