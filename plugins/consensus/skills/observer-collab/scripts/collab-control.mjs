#!/usr/bin/env node
// GENERATED skill payload for session-observer-collab.

// src/skills/session-observer-collab/src/collab-control.mjs
import { randomUUID as randomUUID6 } from "node:crypto";
import { chmod as chmod5, mkdir as mkdir5, open as open8, readFile as readFile7, rm as rm4 } from "node:fs/promises";
import { join as join5 } from "node:path";
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
  const basename4 = path.basename(file, ".json");
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
      if (candidate.alias !== basename4)
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
      if (candidate.participantId !== parent || String(candidate.generation) !== basename4)
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
      if (candidate.participantId !== parent || String(candidate.generation) !== basename4)
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
      if (candidate.to.participantId !== parent || candidate.id !== basename4)
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
      if (candidate.messageId !== basename4 || String(candidate.bindingGeneration) !== parent)
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
      if (candidate.id !== basename4)
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
  const relative2 = path.relative(absoluteRoot, absoluteTarget);
  if (relative2.startsWith("..") || path.isAbsolute(relative2)) {
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
  const segments = relative2.split(path.sep).filter(Boolean);
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
  const records2 = entries.filter(
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
  if (records2.length > options.maxEntries) {
    throw new CollaborationError(
      "CAPACITY_EXCEEDED",
      `record directory exceeds ${options.maxEntries} entries`
    );
  }
  return records2;
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
  const relative2 = path4.relative(absoluteRoot, absoluteDirectory);
  if (relative2.startsWith("..") || path4.isAbsolute(relative2)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log directory escapes the collaboration root"
    );
  }
  const expectedUid = process.getuid?.();
  const paths = [
    absoluteRoot,
    ...relative2.split(path4.sep).filter(Boolean).reduce((entries, segment) => {
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
  const relative2 = path4.relative(canonicalRoot, canonicalFile);
  if (relative2.startsWith("..") || path4.isAbsolute(relative2)) {
    throw new CollaborationError(
      "UNSAFE_PATH",
      "rendered log escapes the collaboration root"
    );
  }
  return readFile2(file, "utf8");
}

// src/skills/session-observer-collab/src/codex-lifecycle.mjs
import { randomUUID as randomUUID5 } from "node:crypto";
import {
  chmod as chmod4,
  mkdir as mkdir4,
  open as open4,
  readdir as readdir4,
  readFile as readFile5,
  rename as rename4,
  rm as rm3,
  writeFile as writeFile2
} from "node:fs/promises";
import { dirname as dirname3, join as join3 } from "node:path";

// src/skills/session-observer-collab/src/lib/codex-install.mjs
import { createHash as createHash3 } from "node:crypto";
import {
  chmod as chmod2,
  copyFile,
  mkdir as mkdir2,
  readFile as readFile3,
  readdir as readdir2,
  rename as rename2,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
var BUNDLE_OWNER = "session-observer-collab-codex-stop";
var MANIFEST = ".session-observer-collab-bundle.json";
var FILES = ["session-observer-collab/scripts/hooks/codex-stop.mjs"];
var COMPOSITION_CAPABILITY = "agent-messaging-stop-composition";
var COMPOSITION_CAPABILITY_VERSION = 1;
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
  const hash = createHash3("sha256");
  hash.update(COMPOSITION_CAPABILITY);
  hash.update("\0");
  hash.update(String(COMPOSITION_CAPABILITY_VERSION));
  hash.update("\0");
  for (const relativePath of FILES) {
    const source = join(skillsRoot, relativePath);
    const content = await readFile3(source);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
    files.push({ relativePath, source });
  }
  const contentDigest = hash.digest("hex");
  return { files, contentDigest, version: contentDigest.slice(0, 24) };
}
async function ownerOnlyDirectory(path5) {
  await mkdir2(path5, { recursive: true, mode: 448 });
  await chmod2(path5, 448);
}
async function copyBundle(stage, files, version, contentDigest) {
  await ownerOnlyDirectory(stage);
  for (const file of files) {
    const destination = join(stage, file.relativePath);
    await ownerOnlyDirectory(dirname(destination));
    await copyFile(file.source, destination);
    await chmod2(destination, 384);
  }
  const manifest = join(stage, MANIFEST);
  await writeFile(
    manifest,
    `${JSON.stringify(
      {
        owner: BUNDLE_OWNER,
        version,
        files: FILES,
        capabilities: {
          [COMPOSITION_CAPABILITY]: COMPOSITION_CAPABILITY_VERSION
        },
        contentDigest
      },
      null,
      2
    )}
`,
    { mode: 384 }
  );
  await chmod2(manifest, 384);
}
async function ownedVersion(path5, version) {
  try {
    const value = JSON.parse(await readFile3(join(path5, MANIFEST), "utf8"));
    return value.owner === BUNDLE_OWNER && value.version === version;
  } catch {
    return false;
  }
}
async function ownedArtifact(path5) {
  try {
    const value = JSON.parse(await readFile3(join(path5, MANIFEST), "utf8"));
    return value.owner === BUNDLE_OWNER;
  } catch {
    return false;
  }
}
async function secureBundle(path5) {
  await chmod2(path5, 448);
  for (const relativePath of FILES) {
    const file = join(path5, relativePath);
    await chmod2(file, 384);
    let parent = dirname(file);
    while (parent !== path5) {
      await chmod2(parent, 448);
      parent = dirname(parent);
    }
  }
  await chmod2(join(path5, MANIFEST), 384);
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
async function readIfFile(path5) {
  try {
    if (!(await stat(path5)).isFile()) return null;
    return await readFile3(path5, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
async function cleanOwnedVersions(supportRoot, keep) {
  let names;
  try {
    names = await readdir2(supportRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const path5 = join(supportRoot, name);
    if (name === keep) continue;
    if (name.startsWith(".stage-") && await ownedArtifact(path5) || await ownedVersion(path5, name))
      await rm(path5, { recursive: true, force: true });
  }
  if ((await readdir2(supportRoot)).length === 0)
    await rm(supportRoot, { recursive: true, force: true });
}
async function removeEmptySupportRoot(supportRoot) {
  try {
    if ((await readdir2(supportRoot)).length === 0)
      await rm(supportRoot, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function prepareSupportRoot(supportRoot) {
  try {
    const names = await readdir2(supportRoot);
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
    await chmod2(supportRoot, 448);
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
  const { files, contentDigest, version } = await sourceFiles(sourceScriptPath);
  const { parent, supportRoot } = bundlePaths(scriptPath);
  const final = join(supportRoot, version);
  const stage = join(supportRoot, `.stage-${process.pid}-${version}`);
  const launcher = launcherContent(scriptPath, supportRoot, version);
  const temporary = `${scriptPath}.${process.pid}.${version}.tmp`;
  let createdVersion = false;
  await mkdir2(parent, { recursive: true, mode: 448 });
  await prepareSupportRoot(supportRoot);
  try {
    if (!await ownedVersion(final, version)) {
      await rm(stage, { recursive: true, force: true });
      await copyBundle(stage, files, version, contentDigest);
      await rename2(stage, final);
      createdVersion = true;
    }
    await secureBundle(final);
    const current = await readIfFile(scriptPath);
    if (current !== launcher) {
      await writeFile(temporary, launcher, { mode: 448 });
      await chmod2(temporary, 448);
      await rename2(temporary, scriptPath);
    }
    await chmod2(scriptPath, 448);
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
import { randomUUID as randomUUID4 } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod as chmod3,
  lstat as lstat4,
  mkdir as mkdir3,
  open as open3,
  readFile as readFile4,
  readdir as readdir3,
  realpath as realpath4,
  rename as rename3,
  rm as rm2
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
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
  const base = env.XDG_STATE_HOME || join2(env.HOME || homedir2(), ".local", "state");
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
    canonicalTranscript = await realpath4(requested);
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
      canonicalStore = await realpath4(requestedStore);
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
function timestamp3(value, name) {
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
  value.armedAt = timestamp3(value.armedAt, "armedAt");
  value.expiresAt = timestamp3(value.expiresAt, "expiresAt");
  value.updatedAt = timestamp3(value.updatedAt, "updatedAt");
  if (value.waitStartedAt === null !== (value.waitDeadlineAt === null)) {
    throw new LeaseError(
      "malformed-lease",
      "wait timing fields must both be timestamps or both be null"
    );
  }
  if (value.waitStartedAt !== null) {
    value.waitStartedAt = timestamp3(value.waitStartedAt, "waitStartedAt");
    value.waitDeadlineAt = timestamp3(value.waitDeadlineAt, "waitDeadlineAt");
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
  await mkdir3(dirname2(file), { recursive: true, mode: 448 });
  await chmod3(dirname2(file), 448);
  const temp = `${file}.${process.pid}.${randomUUID4()}.tmp`;
  const handle = await open3(temp, "wx", 384);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename3(temp, file);
  await chmod3(file, 384);
}
async function readLease(root, ownerSession, { persistMigration = true } = {}) {
  const file = leasePath(root, ownerSession);
  let raw;
  try {
    const metadata = await lstat4(file);
    const wrongOwner = typeof process.getuid === "function" && metadata.uid !== process.getuid();
    if (!metadata.isFile() || metadata.isSymbolicLink() || wrongOwner || (metadata.mode & 63) !== 0) {
      throw new LeaseError(
        "unsafe-lease",
        "lease must be a regular owner-only file owned by this user"
      );
    }
    raw = JSON.parse(await readFile4(file, "utf8"));
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
  await mkdir3(dirname2(file), { recursive: true, mode: 448 });
  await chmod3(dirname2(file), 448);
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
async function resourceExists(path5) {
  try {
    await access(path5, constants.F_OK);
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
    names = await readdir3(leasesDir);
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
    return validateHookConfig(JSON.parse(await readFile5(hooksPath, "utf8")));
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
  await mkdir4(dirname3(hooksPath), { recursive: true, mode: 448 });
  const temporary = `${hooksPath}.${randomUUID5()}.tmp`;
  try {
    await writeFile2(temporary, `${JSON.stringify(config, null, 2)}
`, {
      mode: 384
    });
    await chmod4(temporary, 384);
    await rename4(temporary, hooksPath);
    await chmod4(hooksPath, 384);
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
  await mkdir4(stateRoot2, { recursive: true, mode: 448 });
  await chmod4(stateRoot2, 448);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open4(lock, "wx", 384);
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
    names = await readdir4(leasesDir);
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
import { createHash as createHash7 } from "node:crypto";
import { open as open7 } from "node:fs/promises";

// src/shared/transcript/cursor-analysis.ts
import { createHash as createHash4 } from "node:crypto";

// src/shared/transcript/runtimes.ts
import { open as open5, readFile as readFile6 } from "node:fs/promises";
import { homedir as homedir3 } from "node:os";
import { basename as basename3, dirname as dirname4, isAbsolute as isAbsolute2, join as join4 } from "node:path";

// src/shared/transcript/cursor-frames.ts
import { createHash as createHash5 } from "node:crypto";
import { open as open6 } from "node:fs/promises";
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
  const handle = await open6(transcriptPath, "r");
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash5("sha256");
    const verifiedPrefixHash = options.verifyPrefixBytes === void 0 ? null : createHash5("sha256");
    let verifiedBytes = 0;
    let verifiedPrefixSha256 = options.verifyPrefixBytes === 0 ? createHash5("sha256").digest("hex") : null;
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
import { createHash as createHash6 } from "node:crypto";

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
  const selectedHash = createHash7("sha256");
  const verificationHash = createHash7("sha256");
  const handle = await open7(transcript, "r");
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
    if (rawKey === "json" || rawKey === "confirmed" || rawKey === "remove-script" || rawKey === "what-stdin") {
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
function requiredOption(options, key, flag = key) {
  const value = options[key];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`--${flag} is required`);
  return value;
}
function parsePin(value) {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1)
    throw new Error("--self must use <runtime>:<session-id>");
  const pin = {
    runtime: value.slice(0, separator),
    sessionId: value.slice(separator + 1)
  };
  assertPin(pin);
  return pin;
}
function sharedResult(root, collaborationId, data) {
  return {
    collaborationId,
    root,
    paths: collaborationPaths(root, collaborationId),
    delivery: "disabled",
    data
  };
}
async function readStdinBounded() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 16 * 1024)
      throw new Error("standard input exceeds 16384 bytes");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readInstallation(root) {
  try {
    const value = JSON.parse(
      await readFile7(join5(root, "installation.json"), "utf8")
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
  await mkdir5(root, { recursive: true, mode: 448 });
  await chmod5(root, 448);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open8(lock, "wx", 384);
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
        leaseId: randomUUID6(),
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
async function readRecords2(path5, name) {
  if (path5 === void 0) return [];
  const absolute = validateAbsolutePath(path5, name);
  try {
    return records(JSON.parse(await readFile7(absolute, "utf8")), name);
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
async function run(argv, env = process.env, now = Date.now(), readStdin = readStdinBounded) {
  const { command, options } = parseArgs(argv);
  const root = stateRoot(env);
  await mkdir5(root, { recursive: true, mode: 448 });
  await chmod5(root, 448);
  if (command === "collaboration-open") {
    const collaborationId = typeof options.collab === "string" ? options.collab : randomUUID6();
    const data = await openCollaboration({
      root,
      collaborationId,
      pin: parsePin(requiredOption(options, "self")),
      alias: requiredOption(options, "alias"),
      label: requiredOption(options, "label"),
      task: requiredOption(options, "task"),
      worktree: typeof options.cwd === "string" ? options.cwd : process.cwd(),
      now: new Date(now).toISOString()
    });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data)
    };
  }
  if (command === "collaboration-join") {
    const collaborationId = requiredOption(options, "collab");
    const data = await joinCollaboration({
      root,
      collaborationId,
      pin: parsePin(requiredOption(options, "self")),
      alias: requiredOption(options, "alias"),
      worktree: typeof options.cwd === "string" ? options.cwd : process.cwd(),
      now: new Date(now).toISOString()
    });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data)
    };
  }
  if (command === "log-append") {
    const collaborationId = requiredOption(options, "collab");
    const whatHappened = options.whatStdin === true ? await readStdin() : requiredOption(options, "what");
    const data = await appendLogEntry({
      root,
      collaborationId,
      pin: parsePin(requiredOption(options, "self")),
      id: requiredOption(options, "id"),
      category: requiredOption(options, "category"),
      title: requiredOption(options, "title"),
      whatHappened,
      assessment: requiredOption(options, "assessment"),
      skillImplication: requiredOption(options, "implication"),
      now: new Date(now).toISOString()
    });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data)
    };
  }
  if (command === "log-show" || command === "log-render") {
    const collaborationId = requiredOption(options, "collab");
    const data = command === "log-render" ? await renderLog({ root, collaborationId }) : await getLogView({ root, collaborationId });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data)
    };
  }
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
    "usage: collab-control collaboration-open|collaboration-join|log-append|log-show|log-render|install|status|arm|disarm|prune|codex-install|codex-status|codex-uninstall [options] [--json]"
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
