// GENERATED skill payload for session-export-transcript.

// src/shared/transcript/cursor-analysis.ts
import { createHash } from "node:crypto";

// src/shared/transcript/runtimes.ts
import { open, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
var ASK_USER_PROMPT_LIMIT = 500;
var ASK_USER_OPTION_LIMIT = 120;
var ASK_USER_DESCRIPTION_LIMIT = 300;
var ASK_USER_TOOL_NAMES = {
  "claude-code": "AskUserQuestion",
  codex: "request_user_input",
  cursor: "AskQuestion"
};
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
function truncate(str, limit) {
  if (str.length <= limit) return str;
  return str.slice(0, limit) + "...";
}
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

// src/shared/transcript/cursor-analysis.ts
function cursorRenderTurnId(turn, sourceFrameIndex) {
  const humanFrameIndex = turn.humanRecordIndexes.findLast(
    (frameIndex) => frameIndex <= sourceFrameIndex
  );
  return `${turn.turnId}:render:${humanFrameIndex ?? turn.fromFrameIndex}`;
}
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value) {
  return typeof value === "string" ? value : null;
}
function identityScope(identity) {
  return createHash("sha256").update(
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
  if (!isJsonObject(record.message)) {
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
    if (!isJsonObject(block)) {
      return { blockIndex, kind: "unsupported", text: "" };
    }
    const type = stringValue(block.type);
    if (type === "tool_use") {
      const nativeName = stringValue(block.name);
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
    const text = stringValue(block.text) ?? stringValue(block.content) ?? "";
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
      const role = stringValue(record.role);
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
export {
  createCursorTurnAccumulator,
  cursorRenderTurnId
};
