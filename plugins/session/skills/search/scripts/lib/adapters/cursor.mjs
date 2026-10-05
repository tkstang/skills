// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/adapters/cursor.ts
import { statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// src/skills/session-export-transcript/src/sanitize.ts
function lead(text) {
  return typeof text === "string" ? text.trimStart() : "";
}
var HIDDEN_PAYLOAD_MATCHERS = [
  {
    // Role-tagged system/developer records are never emitted.
    id: "system-or-developer-role",
    test: (_text, role) => role === "system" || role === "developer"
  },
  {
    // Text-form system/developer instruction records.
    id: "system-or-developer-text",
    test: (text) => {
      const l = lead(text);
      if (/^(System|Developer)\b\s*[:-]/.test(l)) return true;
      return /^(System|Developer)\s+(prompt|note|notes|message|instruction|instructions|directive|directives|guidelines?)\b\s*[:-]/i.test(
        l
      );
    }
  },
  {
    id: "environment-context",
    test: (text) => lead(text).startsWith("<environment_context>")
  },
  {
    id: "subagent-notification",
    test: (text) => lead(text).startsWith("<subagent_notification>")
  },
  {
    id: "turn-aborted",
    test: (text) => lead(text).startsWith("<turn_aborted>")
  },
  {
    // XML-style skill wrappers injected as ordinary text.
    id: "skill-wrapper",
    test: (text) => /^<skill(\s[^>]*)?>/.test(lead(text))
  },
  {
    // Claude Code's primary injected-context wrapper.
    id: "system-reminder",
    test: (text) => lead(text).startsWith("<system-reminder>")
  },
  {
    id: "task-notification",
    test: (text) => lead(text).startsWith("<task-notification>")
  },
  {
    id: "local-command-output",
    test: (text) => /^<local-command-(stdout|stderr|caveat)>/.test(lead(text))
  },
  {
    id: "command-message",
    test: (text) => /^<(command-message|command-name|command-args)>/.test(lead(text))
  },
  {
    id: "agents-or-skill-md-heading",
    test: (text) => /^#{1,6}\s+(AGENTS|SKILL)(\.md)?\b/i.test(lead(text))
  },
  {
    id: "skill-frontmatter",
    test: (text) => {
      const l = lead(text);
      if (!l.startsWith("---")) return false;
      const firstKey = l.split(/\r?\n/, 2)[1] ?? "";
      return /^(name|description|license|compatibility|allowed-tools|argument-hint):/.test(
        firstKey.trim()
      );
    }
  }
];

// src/skills/session-search/src/lib/classify.ts
function isInjectedUserText(text, runtime) {
  if (text.trimStart().startsWith("<user_instructions>")) return true;
  return HIDDEN_PAYLOAD_MATCHERS.some(
    (matcher) => matcher.test(text, "user", runtime)
  );
}
function demoteRole(role, text, runtime) {
  return role === "user" && isInjectedUserText(text, runtime) ? "context" : role;
}

// src/shared/transcript/runtimes.ts
import { createHash } from "node:crypto";
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
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
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
function encodeCwdVariants(runtime, cwd) {
  if (runtime === "codex") return [];
  if (runtime === "cursor") {
    return [cwd.split(/[/.]/u).filter(Boolean).join("-")];
  }
  const variants = [cwd.replace(/[/.]/g, "-"), cwd.replace(/\//g, "-")];
  return [...new Set(variants)];
}
function validateBoundedReadOptions(options) {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }
  if (!Number.isSafeInteger(options.maxRecords) || options.maxRecords <= 0) {
    throw new TypeError("maxRecords must be a positive safe integer");
  }
  if (options.maxInspectedRecords !== void 0 && (!Number.isSafeInteger(options.maxInspectedRecords) || options.maxInspectedRecords <= 0)) {
    throw new TypeError("maxInspectedRecords must be a positive safe integer");
  }
  if (options.deadlineMs !== void 0 && (!Number.isFinite(options.deadlineMs) || options.deadlineMs < 0)) {
    throw new TypeError("deadlineMs must be a non-negative finite number");
  }
}
function safeDiagnostic(options, code) {
  options.diagnostic({ code });
}
function deadlineAt(options) {
  return options.deadlineMs === void 0 ? null : Date.now() + options.deadlineMs;
}
function deadlineExpired(deadline) {
  return deadline !== null && Date.now() >= deadline;
}
async function readBoundedWindow(transcriptPath, options, direction, deadline) {
  if (deadlineExpired(deadline)) {
    safeDiagnostic(options, "deadline-exceeded");
    return null;
  }
  let handle;
  try {
    handle = await open(transcriptPath, "r");
    if (deadlineExpired(deadline)) {
      safeDiagnostic(options, "deadline-exceeded");
      return null;
    }
    const { size } = await handle.stat();
    const length = Math.min(size, options.maxBytes);
    const offset = direction === "tail" ? Math.max(0, size - length) : 0;
    const buffer = Buffer.allocUnsafe(length);
    let bytesRead = 0;
    while (bytesRead < length) {
      if (deadlineExpired(deadline)) {
        safeDiagnostic(options, "deadline-exceeded");
        return null;
      }
      const result = await handle.read(
        buffer,
        bytesRead,
        length - bytesRead,
        offset + bytesRead
      );
      if (result.bytesRead === 0) break;
      bytesRead += result.bytesRead;
    }
    if (deadlineExpired(deadline)) {
      safeDiagnostic(options, "deadline-exceeded");
      return null;
    }
    return { buffer: buffer.subarray(0, bytesRead), offset, fileSize: size };
  } catch {
    safeDiagnostic(options, "read-failed");
    return null;
  } finally {
    await handle?.close().catch(() => {
    });
  }
}
function parseBoundedLines(buffer, options, deadline, mode, dropLeadingFragment, dropTrailingFragment) {
  let start = 0;
  let incomplete = false;
  let recordsInspected = 0;
  const records = [];
  if (dropLeadingFragment) {
    const newline = buffer.indexOf(10);
    if (newline === -1 || newline === buffer.length - 1) {
      safeDiagnostic(options, "oversized-record");
      return {
        records: [],
        incomplete: true,
        deadlineExceeded: false,
        recordsInspected,
        recordLimitExceeded: false
      };
    }
    start = newline + 1;
    incomplete = true;
  }
  while (start < buffer.length) {
    if (deadlineExpired(deadline)) {
      safeDiagnostic(options, "deadline-exceeded");
      return {
        records: [],
        incomplete: true,
        deadlineExceeded: true,
        recordsInspected,
        recordLimitExceeded: false
      };
    }
    const newline = buffer.indexOf(10, start);
    const isFinalFragment = newline === -1;
    const end = isFinalFragment ? buffer.length : newline;
    if (isFinalFragment && dropTrailingFragment) {
      if (mode === "tail") safeDiagnostic(options, "oversized-record");
      incomplete = true;
      break;
    }
    let line = buffer.subarray(start, end);
    if (line.at(-1) === 13) line = line.subarray(0, -1);
    const text = line.toString("utf8").trim();
    if (text) {
      if (options.maxInspectedRecords !== void 0 && recordsInspected >= options.maxInspectedRecords) {
        return {
          records,
          incomplete: true,
          deadlineExceeded: false,
          recordsInspected,
          recordLimitExceeded: true
        };
      }
      recordsInspected += 1;
      const parsed = safeParseLine(text);
      if (parsed.ok) {
        if (mode === "prefix") {
          if (records.length < options.maxRecords) records.push(parsed.value);
        } else {
          records.push(parsed.value);
          if (records.length > options.maxRecords) {
            records.shift();
            incomplete = true;
          }
        }
      } else {
        safeDiagnostic(options, "malformed-record");
        incomplete = true;
      }
    }
    if (mode === "prefix" && records.length >= options.maxRecords) {
      if (newline !== -1 && newline + 1 < buffer.length) incomplete = true;
      break;
    }
    if (isFinalFragment) break;
    start = newline + 1;
  }
  return {
    records,
    incomplete,
    deadlineExceeded: false,
    recordsInspected,
    recordLimitExceeded: false
  };
}
async function readMetadataRecordsBounded(transcriptPath, options) {
  validateBoundedReadOptions(options);
  const deadline = deadlineAt(options);
  const window = await readBoundedWindow(
    transcriptPath,
    options,
    "prefix",
    deadline
  );
  if (window === null) {
    return {
      records: [],
      incomplete: true,
      bytesRead: 0,
      recordsInspected: 0
    };
  }
  const parsed = parseBoundedLines(
    window.buffer,
    options,
    deadline,
    "prefix",
    false,
    window.fileSize > window.buffer.length && window.buffer.at(-1) !== 10
  );
  return {
    records: parsed.records,
    incomplete: window.fileSize > window.buffer.length || parsed.incomplete,
    bytesRead: window.buffer.length,
    recordsInspected: parsed.recordsInspected
  };
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

// src/skills/session-search/src/lib/adapters/cursor.ts
var RUNTIME = "cursor";
var INFO_READ_BYTES = 256 * 1024;
var noDiagnostic = () => {
};
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString2(value) {
  return typeof value === "string" ? value : void 0;
}
async function listDir(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
function blockText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter(isObject2).map((part) => asString2(part.text) ?? "").filter((part) => part !== "").join("\n");
}
function classifyCursorRecord(record, includeTools) {
  const role = asString2(record.role);
  if (role !== "user" && role !== "assistant") return [];
  const message = isObject2(record.message) ? record.message : record;
  const content = message.content;
  const unit = (text) => ({
    role: demoteRole(role, text, RUNTIME),
    text
  });
  if (typeof content === "string") {
    return content.trim() === "" ? [] : [unit(content)];
  }
  if (!Array.isArray(content)) return [];
  const units = [];
  for (const block of content) {
    if (!isObject2(block)) continue;
    if (block.type === "tool_use") {
      if (role === "assistant") {
        const question = cursorAskUserQuestionText(block);
        if (question) {
          units.push({ role: "assistant", text: question });
          continue;
        }
      }
      if (!includeTools) continue;
      const name = asString2(block.name) ?? "tool_use";
      const input = typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {});
      units.push({ role: "tool", text: `[${name}] ${input}` });
      continue;
    }
    if (block.type === "tool_result") {
      const text2 = blockText(block.content);
      if (includeTools && text2.trim() !== "") {
        units.push({ role: "tool", text: text2 });
      }
      continue;
    }
    const text = asString2(block.text) ?? asString2(block.content);
    if (text && text.trim() !== "") units.push(unit(text));
  }
  return units;
}
function cursorSlugMatchesCwd(slug, hint) {
  const [encoded] = encodeCwdVariants(RUNTIME, hint);
  if (!encoded) return true;
  return slug === encoded || slug.startsWith(`${encoded}-`);
}
function unwrapQuery(text) {
  const match = /^\s*<user_query>\s*([\s\S]*?)\s*<\/user_query>\s*$/u.exec(
    text
  );
  return match ? match[1] : text;
}
function createCursorAdapter() {
  const infos = /* @__PURE__ */ new Map();
  const statSession = async (file, base) => {
    try {
      const stats = await stat(file);
      if (!stats.isFile()) return null;
      return {
        runtime: RUNTIME,
        path: file,
        archived: false,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        createdAtMs: stats.birthtimeMs > 0 && stats.birthtimeMs <= stats.mtimeMs ? stats.birthtimeMs : null,
        ...base
      };
    } catch {
      return null;
    }
  };
  return {
    runtime: RUNTIME,
    roots(home) {
      const root = path.join(home, ".cursor", "projects");
      let exists = false;
      try {
        exists = statSync(root).isDirectory();
      } catch {
        exists = false;
      }
      return { runtime: RUNTIME, root, exists, paths: {} };
    },
    async enumerate(ctx) {
      if (!ctx.roots.exists) return [];
      const files = [];
      for (const project of await listDir(ctx.roots.root)) {
        if (!project.isDirectory()) continue;
        const transcripts = path.join(
          ctx.roots.root,
          project.name,
          "agent-transcripts"
        );
        for (const session of await listDir(transcripts)) {
          if (!session.isDirectory()) continue;
          const dir = path.join(transcripts, session.name);
          const parent = await statSession(
            path.join(dir, `${session.name}.jsonl`),
            {
              sessionId: session.name,
              parentSessionId: null,
              isSubagent: false,
              projectSlug: project.name
            }
          );
          if (parent) files.push(parent);
          const children = (await listDir(path.join(dir, "subagents"))).filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl")).map((entry) => entry.name).toSorted();
          for (const name of children) {
            const child = await statSession(path.join(dir, "subagents", name), {
              sessionId: name.slice(0, -".jsonl".length),
              parentSessionId: session.name,
              isSubagent: true,
              projectSlug: project.name
            });
            if (child) files.push(child);
          }
        }
      }
      return files;
    },
    async historyHits() {
      return [];
    },
    async metadataHits() {
      return [];
    },
    sessionInfo(file) {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async () => {
          const { records } = await readMetadataRecordsBounded(file.path, {
            maxBytes: INFO_READ_BYTES,
            maxRecords: 128,
            diagnostic: noDiagnostic
          });
          let firstPrompt = null;
          for (const record of records) {
            const unit = classifyCursorRecord(record, false).find(
              (candidate) => candidate.role === "user"
            );
            if (unit) {
              firstPrompt = unwrapQuery(unit.text);
              break;
            }
          }
          return { cwd: null, title: null, firstPrompt, startedAt: null };
        })().catch(() => ({
          cwd: null,
          title: null,
          firstPrompt: null,
          startedAt: null
        }));
        infos.set(file.path, cached);
      }
      return cached;
    },
    classifyRecord: classifyCursorRecord,
    openHint(_sessionId, _info, transcriptPath) {
      return {
        command: null,
        hint: transcriptPath ? `open in Cursor (transcript: ${transcriptPath})` : "open in Cursor"
      };
    }
  };
}
export {
  classifyCursorRecord,
  createCursorAdapter,
  cursorSlugMatchesCwd
};
