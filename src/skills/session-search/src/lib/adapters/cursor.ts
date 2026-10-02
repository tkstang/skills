/**
 * Cursor source adapter.
 *
 * Store layout (session-schemas/cursor.md):
 * `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl`, plus child
 * transcripts in `<id>/subagents/<child>.jsonl`. Transcripts carry no
 * timestamps, identity, or cwd: time is the file mtime, identity is the path,
 * and cwd hints match the project slug (`encodeCwdVariants('cursor', cwd)`).
 * There is no history file or metadata index.
 *
 * Records are classified directly from the raw frame. The shared Cursor
 * normalizer only emits at `turn_ended`, so it returns nothing for a lone
 * record and would hide an open trailing turn entirely.
 */
import { statSync, type Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { demoteRole } from '../classify.js';
import {
  cursorAskUserQuestionText,
  encodeCwdVariants,
  readMetadataRecordsBounded,
} from '../runtimes.js';
import type {
  EnumerateContext,
  Hit,
  JsonObject,
  SessionFile,
  SessionInfo,
  SourceAdapter,
  StoreRoots,
  TextUnit,
  TextUnitRole,
} from '../types.js';

const RUNTIME = 'cursor' as const;
const INFO_READ_BYTES = 256 * 1024;
const noDiagnostic = () => {};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function listDir(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function blockText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isObject)
    .map((part) => asString(part.text) ?? '')
    .filter((part) => part !== '')
    .join('\n');
}

/** Classify one raw Cursor frame into role-tagged search units. */
export function classifyCursorRecord(
  record: JsonObject,
  includeTools: boolean,
): TextUnit[] {
  const role = asString(record.role);
  if (role !== 'user' && role !== 'assistant') return [];
  const message = isObject(record.message) ? record.message : record;
  const content = message.content;
  const unit = (text: string): TextUnit => ({
    role: demoteRole(role as TextUnitRole, text, RUNTIME),
    text,
  });
  if (typeof content === 'string') {
    return content.trim() === '' ? [] : [unit(content)];
  }
  if (!Array.isArray(content)) return [];

  const units: TextUnit[] = [];
  for (const block of content) {
    if (!isObject(block)) continue;
    if (block.type === 'tool_use') {
      if (role === 'assistant') {
        // Questions put to the operator are conversation, not tool traffic.
        const question = cursorAskUserQuestionText(block);
        if (question) {
          units.push({ role: 'assistant', text: question });
          continue;
        }
      }
      if (!includeTools) continue;
      const name = asString(block.name) ?? 'tool_use';
      const input =
        typeof block.input === 'string'
          ? block.input
          : JSON.stringify(block.input ?? {});
      units.push({ role: 'tool', text: `[${name}] ${input}` });
      continue;
    }
    if (block.type === 'tool_result') {
      const text = blockText(block.content);
      if (includeTools && text.trim() !== '') {
        units.push({ role: 'tool', text });
      }
      continue;
    }
    const text = asString(block.text) ?? asString(block.content);
    if (text && text.trim() !== '') units.push(unit(text));
  }
  return units;
}

/**
 * True when a Cursor project slug can hold sessions for `hint` or one of its
 * descendants (equal slug, or the slug plus a `-` separated suffix).
 */
export function cursorSlugMatchesCwd(slug: string, hint: string): boolean {
  const [encoded] = encodeCwdVariants(RUNTIME, hint);
  if (!encoded) return true;
  return slug === encoded || slug.startsWith(`${encoded}-`);
}

/** Strip Cursor's `<user_query>` wrapper for presentation. */
function unwrapQuery(text: string): string {
  const match = /^\s*<user_query>\s*([\s\S]*?)\s*<\/user_query>\s*$/u.exec(
    text,
  );
  return match ? match[1] : text;
}

export function createCursorAdapter(): SourceAdapter {
  const infos = new Map<string, Promise<SessionInfo>>();

  const statSession = async (
    file: string,
    base: Pick<
      SessionFile,
      'sessionId' | 'parentSessionId' | 'isSubagent' | 'projectSlug'
    >,
  ): Promise<SessionFile | null> => {
    try {
      const stats = await stat(file);
      if (!stats.isFile()) return null;
      return {
        runtime: RUNTIME,
        path: file,
        archived: false,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        createdAtMs:
          stats.birthtimeMs > 0 && stats.birthtimeMs <= stats.mtimeMs
            ? stats.birthtimeMs
            : null,
        ...base,
      };
    } catch {
      return null;
    }
  };

  return {
    runtime: RUNTIME,

    roots(home: string): StoreRoots {
      const root = path.join(home, '.cursor', 'projects');
      let exists = false;
      try {
        exists = statSync(root).isDirectory();
      } catch {
        exists = false;
      }
      return { runtime: RUNTIME, root, exists, paths: {} };
    },

    async enumerate(ctx: EnumerateContext): Promise<SessionFile[]> {
      if (!ctx.roots.exists) return [];
      const files: SessionFile[] = [];
      for (const project of await listDir(ctx.roots.root)) {
        if (!project.isDirectory()) continue;
        const transcripts = path.join(
          ctx.roots.root,
          project.name,
          'agent-transcripts',
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
              projectSlug: project.name,
            },
          );
          if (parent) files.push(parent);
          const children = (await listDir(path.join(dir, 'subagents')))
            .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
            .map((entry) => entry.name)
            .toSorted();
          for (const name of children) {
            const child = await statSession(path.join(dir, 'subagents', name), {
              sessionId: name.slice(0, -'.jsonl'.length),
              parentSessionId: session.name,
              isSubagent: true,
              projectSlug: project.name,
            });
            if (child) files.push(child);
          }
        }
      }
      return files;
    },

    async historyHits(): Promise<Hit[]> {
      return [];
    },

    async metadataHits(): Promise<Hit[]> {
      return [];
    },

    sessionInfo(file: SessionFile): Promise<SessionInfo> {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async (): Promise<SessionInfo> => {
          const { records } = await readMetadataRecordsBounded(file.path, {
            maxBytes: INFO_READ_BYTES,
            maxRecords: 128,
            diagnostic: noDiagnostic,
          });
          let firstPrompt: string | null = null;
          for (const record of records) {
            const unit = classifyCursorRecord(record, false).find(
              (candidate) => candidate.role === 'user',
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
          startedAt: null,
        }));
        infos.set(file.path, cached);
      }
      return cached;
    },

    classifyRecord: classifyCursorRecord,

    openHint(
      _sessionId: string,
      _info: SessionInfo,
      transcriptPath: string | null,
    ) {
      return {
        command: null,
        hint: transcriptPath
          ? `open in Cursor (transcript: ${transcriptPath})`
          : 'open in Cursor',
      };
    },
  };
}
