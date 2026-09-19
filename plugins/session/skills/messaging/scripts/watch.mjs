// GENERATED skill payload for agent-messaging.

// src/skills/agent-messaging/src/watch.ts
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
async function deliveryClaimStatus(input) {
  const status = await activationStatus(input.root, input.pin);
  if (!status.activation)
    return {
      spentSlots: 0,
      remainingSlots: 0,
      interruptedAttempts: [],
      outcomeUnknown: []
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
    (event) => !slots.some((slot) => slot.token === event.token) || event.proposedDeliveryKeys.length > 0 && !messages.some((message) => message.token === event.token)
  ).map((event) => event.token);
  const outcomeUnknown = events.filter(
    (event) => messages.some((message) => message.token === event.token)
  ).map((event) => event.token);
  return {
    spentSlots: slots.length,
    remainingSlots: Math.max(
      0,
      status.activation.maxContinuations - slots.length
    ),
    interruptedAttempts,
    outcomeUnknown
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
  "watch-notification-attempted"
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
  if (!OUTCOME_CODES.has(input.outcomeCode))
    throw new TypeError("diagnostic outcome code is unsupported");
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
          source: path8.resolve(source),
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
    ]
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
  if (lease.schemaVersion !== OBSERVER_LEASE_SCHEMA_VERSION || !validLeaseId(lease.leaseId) || !["codex", "cursor"].includes(lease.runtime) || !["claude-code", "codex", "cursor"].includes(lease.peerRuntime) || !validLeaseId(lease.ownerSession) || !validLeaseId(lease.peerSession) || typeof lease.ownerCwd !== "string" || !path8.isAbsolute(lease.ownerCwd) || lease.ownerCwd.includes("\0") || typeof lease.peerTranscript !== "string" || !path8.isAbsolute(lease.peerTranscript) || lease.peerTranscript.includes("\0") || typeof lease.peerCanonicalTranscriptPath !== "string" || !path8.isAbsolute(lease.peerCanonicalTranscriptPath) || lease.peerCanonicalTranscriptPath.includes("\0") || path8.resolve(lease.peerTranscript) !== path8.resolve(lease.peerCanonicalTranscriptPath) || lease.peerIndexBase !== (lease.peerRuntime === "cursor" ? "zero-based-jsonl-frame-index" : "zero-based-jsonl-record-index") || !["armed", "waiting", "idle", "triggered", "disarmed"].includes(
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
  return lease;
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
    lease = validateObserverLease(JSON.parse(await readFile2(file, "utf8")));
  } catch {
    return "uncertain";
  }
  if (lease.runtime !== input.pin.runtime || lease.ownerSession !== input.pin.sessionId || path8.resolve(lease.ownerCwd) !== path8.resolve(input.worktree)) {
    return "uncertain";
  }
  if (lease.state === "triggered") return "present";
  if (["idle", "disarmed"].includes(lease.state)) return "inactive";
  const now = (input.now ?? /* @__PURE__ */ new Date()).getTime();
  if (now >= Date.parse(lease.expiresAt) || lease.continuationCount >= lease.continuationCap || lease.loopCount >= lease.loopCap || lease.state === "waiting" && (lease.waitDeadlineAt === null || now >= Date.parse(lease.waitDeadlineAt))) {
    return "inactive";
  }
  return "present";
}
async function assessAutomaticOwnership(input) {
  assertPin(input.pin);
  const lease = await inspectObserverLease(input);
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
      acknowledgedFingerprint: null
    };
  }
  if (input.inventory.unreadableSources.length > 0 || input.inventory.unresolvedPlugins.length > 0) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      controller: null,
      reason: "required hook inventory is unreadable or unresolved",
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null
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
        acknowledgedFingerprint: null
      };
    }
    if (input.pin.runtime === "claude-code") {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: "composed-monitor-unavailable: Claude observer delivery requires the dedicated composed Monitor",
        recoveryCommand: null,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null
      };
    }
    if (!recognizedObserver) {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: "the active observer lease has no verified composed-capable adapter",
        recoveryCommand,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null
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
        acknowledgedFingerprint: null
      };
    }
    controller = "observer-collab";
  } else {
    if (input.requestedController === "observer-collab") {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason: input.pin.runtime === "claude-code" ? "composed-monitor-unavailable: Claude observer delivery requires the dedicated composed Monitor" : "observer-collab requires an active exact-session lease and verified composed-capable adapter",
        recoveryCommand: null,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null
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
      acknowledgedFingerprint: null
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
    acknowledgedFingerprint: thirdParty.length > 0 ? input.inventory.fingerprint : null
  };
}

// src/skills/agent-messaging/src/watch.ts
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
async function inventoryFor(input) {
  const env = input.env ?? process.env;
  if (input.pin.runtime === "codex") {
    return inspectCodexStopInventory(
      env.AGENT_MESSAGING_HOOKS_PATH ?? path9.join(env.HOME ?? input.worktree, ".codex", "hooks.json")
    );
  }
  if (input.pin.runtime !== "claude-code")
    throw new DeliveryError(
      "DELIVERY_INACTIVE",
      "this host has no verified standalone watch boundary"
    );
  const settingsPaths = (env.AGENT_MESSAGING_CLAUDE_SETTINGS ?? "").split(path9.delimiter).filter(Boolean);
  const installedPlugins = env.AGENT_MESSAGING_CLAUDE_PLUGINS ? JSON.parse(env.AGENT_MESSAGING_CLAUDE_PLUGINS) : {};
  return inspectClaudeStopInventory({ settingsPaths, installedPlugins });
}
async function acceptedOwnership(input, now) {
  const status = await activationStatus(input.root, input.pin, now);
  if (!status.active || !status.activation || status.activation.collaborationId !== input.collaborationId || status.activation.worktree !== path9.resolve(input.worktree) || status.activation.controller !== "standalone-messaging" || status.activation.mechanism !== "monitor") {
    return { status, allowed: false };
  }
  if (input.pin.runtime === "claude-code" && (!input.confirmNoObserverMonitor || !status.activation.noObserverMonitorAttestation || status.activation.noObserverMonitorAttestation.epoch !== status.activation.epoch)) {
    return { status, allowed: false };
  }
  const ownership = await assessAutomaticOwnership({
    root: input.root,
    pin: input.pin,
    worktree: input.worktree,
    inventory: await inventoryFor(input),
    acknowledgedFingerprint: status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    now
  });
  return { status, allowed: ownership.automaticAllowed };
}
async function watchInbox(input, dependencies) {
  const pollMs = input.pollMs ?? DEFAULT_WATCH_POLL_MS;
  validateTiming(input.durationMs, pollMs);
  if (!path9.isAbsolute(input.worktree))
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
export {
  DEFAULT_WATCH_POLL_MS,
  MAX_WATCH_DURATION_MS,
  watchInbox
};
