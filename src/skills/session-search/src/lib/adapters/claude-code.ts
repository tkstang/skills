/**
 * Claude Code source adapter.
 *
 * Store layout (session-schemas/claude-code.md):
 * - Parents: `~/.claude/projects/<slug>/<session-id>.jsonl`.
 * - Subagents: `<slug>/<session-id>/subagents/**\/agent-<id>.jsonl`, including
 *   workflow-spawned agents. Workflow `journal.jsonl` files are not
 *   transcripts and are excluded.
 * - History: `~/.claude/history.jsonl` `{display, project, sessionId, timestamp}`.
 * - Titles: sparse `ai-title` (`aiTitle`) / `custom-title` (`customTitle`)
 *   records; the latest one wins and a custom title beats a generated one.
 *
 * Ordinary messages go through the shared normalizer. Tool text is extracted
 * from the raw record at full length, because the normalizer truncates tool
 * results to 500 characters and tool inputs to 200.
 */
import { statSync, type Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { unitsFromEntries } from '../classify.js';
import { parseJsonObject, readLines } from '../jsonl.js';
import {
  encodeCwdVariants,
  normalizeEntries,
  readMetadataRecordsBounded,
  readTailRecordsBounded,
} from '../runtimes.js';
import type {
  AdapterContext,
  EnumerateContext,
  Hit,
  JsonObject,
  Matcher,
  RecordClassifier,
  SessionFile,
  SessionInfo,
  SourceAdapter,
  StoreRoots,
  TextUnit,
} from '../types.js';

const RUNTIME = 'claude-code' as const;
const TITLE_READ_BYTES = 256 * 1024;
const INFO_READ_BYTES = 512 * 1024;
const HISTORY_MAX_LINE_BYTES = 1024 * 1024;
const ASK_USER_TOOL = 'AskUserQuestion';
const noDiagnostic = () => {};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function existsAs(target: string, kind: 'file' | 'dir'): boolean {
  try {
    const stats = statSync(target);
    return kind === 'file' ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}

async function listDir(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Session start proxy from stat data: the birth time when it is plausible. */
function birthStart(birthtimeMs: number, mtimeMs: number): number | null {
  return birthtimeMs > 0 && birthtimeMs <= mtimeMs ? birthtimeMs : null;
}

async function statSession(
  file: string,
  base: Omit<SessionFile, 'mtimeMs' | 'size' | 'createdAtMs' | 'path'>,
): Promise<SessionFile | null> {
  try {
    const stats = await stat(file);
    if (!stats.isFile()) return null;
    return {
      ...base,
      path: file,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      createdAtMs: birthStart(stats.birthtimeMs, stats.mtimeMs),
    };
  } catch {
    return null;
  }
}

/** Recursively collect `agent-*.jsonl` files below a `subagents/` dir. */
async function collectAgentFiles(dir: string, out: string[]): Promise<void> {
  for (const entry of await listDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectAgentFiles(full, out);
    else if (
      entry.isFile() &&
      entry.name.startsWith('agent-') &&
      entry.name.endsWith('.jsonl')
    ) {
      out.push(full);
    }
  }
}

/** Latest title: the last custom title, else the last generated title. */
function pickTitle(records: readonly JsonObject[]): string | null {
  let custom: string | null = null;
  let generated: string | null = null;
  for (const record of records) {
    if (record.type === 'custom-title') {
      const title = asString(record.customTitle)?.trim();
      if (title) custom = title;
    } else if (record.type === 'ai-title') {
      const title = asString(record.aiTitle)?.trim();
      if (title) generated = title;
    }
  }
  return custom ?? generated;
}

/** Full-length tool text from a raw record's content blocks. */
function toolUnits(
  record: JsonObject,
  skipResults: ReadonlySet<string> = new Set(),
): TextUnit[] {
  const message = isObject(record.message) ? record.message : null;
  const content = message?.content;
  if (!Array.isArray(content)) return [];
  const units: TextUnit[] = [];
  for (const block of content) {
    if (!isObject(block)) continue;
    if (block.type === 'tool_result') {
      // Ask-user answers are conversation, classified by the normalizer.
      if (skipResults.has(asString(block.tool_use_id) ?? '')) continue;
      let text = '';
      if (typeof block.content === 'string') text = block.content;
      else if (Array.isArray(block.content)) {
        text = block.content
          .filter(isObject)
          .map((part) => asString(part.text) ?? '')
          .filter((part) => part !== '')
          .join('\n');
      }
      if (text.trim() !== '') units.push({ role: 'tool', text });
    } else if (block.type === 'tool_use') {
      const name = asString(block.name) ?? 'tool_use';
      // The normalizer already surfaces ask-user questions as conversation.
      if (name === ASK_USER_TOOL) continue;
      const input =
        typeof block.input === 'string'
          ? block.input
          : JSON.stringify(block.input ?? {});
      units.push({ role: 'tool', text: `[${name}] ${input}` });
    }
  }
  return units;
}

/** Classify one raw Claude record into role-tagged search units. */
export function classifyClaudeRecord(
  record: JsonObject,
  includeTools: boolean,
): TextUnit[] {
  let units = unitsFromEntries(normalizeEntries(RUNTIME, [record]), RUNTIME);
  // Compaction summaries and meta records are injected, not typed.
  if (record.isCompactSummary === true || record.isMeta === true) {
    units = units.map((unit) =>
      unit.role === 'user' ? { ...unit, role: 'context' } : unit,
    );
  }
  return includeTools ? [...units, ...toolUnits(record)] : units;
}

/**
 * Per-file Claude classifier. It remembers `AskUserQuestion` calls so the
 * matching `tool_result` answers in later user records route through the
 * shared normalizer as user decision content instead of tool output.
 */
export function createClaudeFileClassifier(): RecordClassifier {
  const askCalls = new Map<string, JsonObject>();
  return (record, includeTools) => {
    const message = isObject(record.message) ? record.message : null;
    const content = Array.isArray(message?.content) ? message.content : [];
    const pairedCalls: JsonObject[] = [];
    const answered = new Set<string>();
    for (const block of content) {
      if (!isObject(block)) continue;
      const id = asString(block.id);
      if (block.type === 'tool_use' && block.name === ASK_USER_TOOL && id) {
        askCalls.set(id, block);
      }
      const answerOf = asString(block.tool_use_id);
      const call = answerOf ? askCalls.get(answerOf) : undefined;
      if (block.type === 'tool_result' && answerOf && call) {
        pairedCalls.push(call);
        answered.add(answerOf);
      }
    }
    if (pairedCalls.length === 0) {
      return classifyClaudeRecord(record, includeTools);
    }
    // Replay the question beside the answer record so the normalizer can
    // correlate tool_use_id → AskUserQuestion; keep only the answer record.
    const question = {
      type: 'assistant',
      message: { role: 'assistant', content: pairedCalls },
    };
    const units = unitsFromEntries(
      normalizeEntries(RUNTIME, [question, record]).filter(
        (entry) => entry.recordIndex === 1,
      ),
      RUNTIME,
    );
    return includeTools ? [...units, ...toolUnits(record, answered)] : units;
  };
}

/**
 * True when a Claude project slug can hold sessions for `hint` or one of its
 * descendants (equal slug, or the slug plus a `-` separated suffix).
 */
export function claudeSlugMatchesCwd(slug: string, hint: string): boolean {
  return encodeCwdVariants(RUNTIME, hint).some(
    (variant) => slug === variant || slug.startsWith(`${variant}-`),
  );
}

export interface ClaudeCodeAdapter extends SourceAdapter {
  /** Latest title for a transcript (bounded tail read, prefix fallback). */
  titleFor(file: string): Promise<string | null>;
}

export function createClaudeCodeAdapter(): ClaudeCodeAdapter {
  const titles = new Map<string, Promise<string | null>>();
  const infos = new Map<string, Promise<SessionInfo>>();

  const titleFor = (file: string): Promise<string | null> => {
    let cached = titles.get(file);
    if (!cached) {
      cached = (async () => {
        const tail = await readTailRecordsBounded(file, {
          maxBytes: TITLE_READ_BYTES,
          maxRecords: 4096,
          diagnostic: noDiagnostic,
        });
        const fromTail = pickTitle(tail.records);
        if (fromTail !== null || !tail.truncated) return fromTail;
        const prefix = await readMetadataRecordsBounded(file, {
          maxBytes: TITLE_READ_BYTES,
          maxRecords: 4096,
          diagnostic: noDiagnostic,
        });
        return pickTitle(prefix.records);
      })().catch(() => null);
      titles.set(file, cached);
    }
    return cached;
  };

  const adapter: ClaudeCodeAdapter = {
    runtime: RUNTIME,
    titleFor,

    roots(home: string): StoreRoots {
      const root = path.join(home, '.claude', 'projects');
      const history = path.join(home, '.claude', 'history.jsonl');
      return {
        runtime: RUNTIME,
        root,
        exists: existsAs(root, 'dir'),
        paths: { history: existsAs(history, 'file') ? history : null },
      };
    },

    async enumerate(ctx: EnumerateContext): Promise<SessionFile[]> {
      if (!ctx.roots.exists) return [];
      const files: SessionFile[] = [];
      for (const project of await listDir(ctx.roots.root)) {
        if (!project.isDirectory()) continue;
        const projectDir = path.join(ctx.roots.root, project.name);
        for (const entry of await listDir(projectDir)) {
          const full = path.join(projectDir, entry.name);
          if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            const sessionId = entry.name.slice(0, -'.jsonl'.length);
            const file = await statSession(full, {
              runtime: RUNTIME,
              sessionId,
              parentSessionId: null,
              isSubagent: false,
              archived: false,
              projectSlug: project.name,
            });
            if (file) files.push(file);
          } else if (entry.isDirectory()) {
            const agentFiles: string[] = [];
            await collectAgentFiles(path.join(full, 'subagents'), agentFiles);
            for (const agentFile of agentFiles.toSorted()) {
              const file = await statSession(agentFile, {
                runtime: RUNTIME,
                sessionId: path.basename(agentFile, '.jsonl'),
                parentSessionId: entry.name,
                isSubagent: true,
                archived: false,
                projectSlug: project.name,
              });
              if (file) files.push(file);
            }
          }
        }
      }
      return files;
    },

    async historyHits(ctx: AdapterContext, matcher: Matcher): Promise<Hit[]> {
      const history = ctx.roots.paths.history;
      if (!history) return [];
      const hits: Hit[] = [];
      try {
        await readLines(
          history,
          { maxLineBytes: HISTORY_MAX_LINE_BYTES },
          (event) => {
            if (event.kind !== 'line') return;
            const record = parseJsonObject(event.text);
            const display = asString(record?.display);
            const sessionId = asString(record?.sessionId);
            if (!record || !display || !sessionId) return;
            const match = matcher.match(display);
            if (!match) return;
            const timestamp = record.timestamp;
            hits.push({
              runtime: RUNTIME,
              sessionId,
              tier: 'history',
              role: 'user',
              userTyped: true,
              patterns: match.patterns,
              text: display,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              transcriptPath: null,
              cwd: asString(record.project) ?? null,
              timestampMs:
                typeof timestamp === 'number' && Number.isFinite(timestamp)
                  ? timestamp
                  : null,
            });
          },
        );
      } catch {
        ctx.degrade('history.jsonl could not be read');
      }
      return hits;
    },

    async metadataHits(ctx: AdapterContext, matcher: Matcher): Promise<Hit[]> {
      const hits: Hit[] = [];
      for (const file of ctx.files) {
        if (ctx.deadline != null && Date.now() >= ctx.deadline) break;
        if (file.runtime !== RUNTIME || file.isSubagent) continue;
        const title = await titleFor(file.path);
        if (!title) continue;
        const match = matcher.match(title);
        if (!match) continue;
        hits.push({
          runtime: RUNTIME,
          sessionId: file.sessionId,
          tier: 'meta',
          role: 'title',
          userTyped: false,
          patterns: match.patterns,
          text: title,
          firstIndex: match.firstIndex,
          firstLength: match.firstLength,
          transcriptPath: file.path,
          cwd: file.cwd ?? null,
          timestampMs: file.mtimeMs,
        });
      }
      return hits;
    },

    sessionInfo(file: SessionFile): Promise<SessionInfo> {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async (): Promise<SessionInfo> => {
          const { records } = await readMetadataRecordsBounded(file.path, {
            maxBytes: INFO_READ_BYTES,
            maxRecords: 256,
            diagnostic: noDiagnostic,
          });
          let cwd: string | null = null;
          let startedAt: string | null = null;
          let firstPrompt: string | null = null;
          for (const record of records) {
            const recordCwd = asString(record.cwd);
            if (cwd === null && recordCwd && path.isAbsolute(recordCwd)) {
              cwd = recordCwd;
            }
            const timestamp = asString(record.timestamp);
            if (
              startedAt === null &&
              timestamp &&
              !Number.isNaN(Date.parse(timestamp))
            ) {
              startedAt = new Date(timestamp).toISOString();
            }
            if (firstPrompt === null) {
              const unit = classifyClaudeRecord(record, false).find(
                (candidate) => candidate.role === 'user',
              );
              if (unit) firstPrompt = unit.text;
            }
            if (cwd !== null && startedAt !== null && firstPrompt !== null)
              break;
          }
          const title = file.isSubagent ? null : await titleFor(file.path);
          return { cwd, title, firstPrompt, startedAt };
        })().catch(() => ({
          cwd: null,
          title: null,
          firstPrompt: null,
          startedAt: null,
        }));
        infos.set(file.path, cached);
      }
      return cached;
    },

    classifyRecord: classifyClaudeRecord,
    fileClassifier: createClaudeFileClassifier,

    openHint(sessionId: string, info: SessionInfo) {
      return {
        command: `claude --resume ${sessionId}`,
        hint: info.cwd
          ? `run from ${info.cwd}`
          : "run from the session's project directory",
      };
    },
  };
  return adapter;
}
