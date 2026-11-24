import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';

import { ToolkitError, positive, provider } from './domain.js';
import type { Provider } from './domain.js';
import { summarizePage } from './page-summary.js';
import type { PageActivitySummary } from './page-summary.js';
import {
  normalizeEntries,
  extractMetaFromRecords,
} from './provider-runtime.js';
import type {
  DigestEntry,
  JsonObject,
  TranscriptMeta,
} from './provider-runtime.js';

export interface ReadOptions {
  runtime: Provider;
  path: string;
  fromOffset?: number;
  cursor?: string;
  fromEnd?: boolean;
  beforeCursor?: string;
  maxBytes?: number;
  maxRecords?: number;
  maxMessages?: number;
  includeToolCalls?: boolean;
  includeToolResults?: boolean;
  includeActivity?: boolean;
}
export interface SourceRecord {
  record: JsonObject;
  sourceCarrier: string;
  /** Zero-based decoded-object ordinal, independent of malformed source lines. */
  recordIndex: number;
  /** Nonblank source ordinal for Claude/Codex; frame ordinal for Cursor. */
  sourceOrdinal: number;
  physicalLine: number;
  frameIndex?: number;
  byteStart: number;
  byteEnd: number;
  closed: boolean;
}
export interface ReadDiagnostic {
  kind: 'malformed' | 'not-object' | 'partial-tail';
  sourceOrdinal: number;
  physicalLine: number;
  frameIndex?: number;
  byteStart: number;
  byteEnd: number;
}
export interface TranscriptPage {
  activity?: PageActivitySummary;
  runtime: Provider;
  path: string;
  coordinate:
    | 'zero-based-nonblank-source-record'
    | 'zero-based-jsonl-frame-index';
  capturedAt: string;
  sourceBytes: number;
  bytesRead: number;
  generation: string;
  metadata: TranscriptMeta | null;
  records: SourceRecord[];
  messages: (DigestEntry & { sourceOrdinal: number; physicalLine: number })[];
  diagnostics: ReadDiagnostic[];
  nextOffset: number;
  nextCursor: string | null;
  prevCursor?: string | null;
  /** Backward pages count record, line and frame indexes from the page start. */
  indexScope?: 'page';
  coverage: {
    complete: boolean;
    reasons: string[];
    fromByte: number;
    throughByte: number;
    omittedStart?: boolean;
    omittedEnd?: boolean;
  };
}
interface Position {
  byte: number;
  source: number;
  decoded: number;
  line: number;
  from: number;
}
interface Continuation extends Position {
  v: 1;
  runtime: Provider;
  path: string;
  generation: string;
  projection: string;
}
interface BeforeContinuation extends Pick<
  Continuation,
  'byte' | 'runtime' | 'path' | 'generation' | 'projection'
> {
  v: 2;
  fileId: string;
  sourceBytes: number;
}
function projection(o: ReadOptions): string {
  return JSON.stringify([
    !!o.includeToolCalls,
    !!o.includeToolResults,
    !!o.includeActivity,
  ]);
}
function decodeToken<T>(token: string): T {
  if (token.length > 16384 || !/^[\w-]+$/u.test(token)) throw new Error();
  return JSON.parse(Buffer.from(token, 'base64url').toString()) as T;
}
function decode(token: string): Continuation {
  try {
    const c = decodeToken<Continuation>(token);
    if (
      c.v !== 1 ||
      typeof c.path !== 'string' ||
      typeof c.generation !== 'string' ||
      typeof c.projection !== 'string' ||
      ![c.byte, c.source, c.decoded, c.from].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      !Number.isSafeInteger(c.line) ||
      c.line < 1
    )
      throw new Error();
    provider(c.runtime);
    return c;
  } catch {
    throw new ToolkitError(
      'E_CURSOR_INVALID',
      'Invalid read cursor.',
      'Start a new read without the cursor.',
    );
  }
}
function decodeBefore(
  options: ReadOptions,
  path: string,
  generation: string,
  fileId: string,
  sourceBytes: number,
): number {
  let c: BeforeContinuation;
  try {
    c = decodeToken<BeforeContinuation>(options.beforeCursor!);
    if (
      c.v !== 2 ||
      c.runtime !== options.runtime ||
      c.path !== path ||
      c.projection !== projection(options) ||
      typeof c.fileId !== 'string' ||
      typeof c.generation !== 'string' ||
      !Number.isSafeInteger(c.byte) ||
      c.byte < 1 ||
      !Number.isSafeInteger(c.sourceBytes) ||
      c.sourceBytes <= c.byte
    )
      throw new Error();
  } catch {
    throw new ToolkitError(
      'E_CURSOR_INVALID',
      'Invalid backward cursor or cursor belongs to a different source or projection.',
      'Start a fresh read with --from-end or use matching options.',
    );
  }
  // A live transcript can append between pages. Keep the original byte
  // boundary, and reject replacement, shrinkage and same-size mutations.
  if (
    c.fileId !== fileId ||
    c.sourceBytes > sourceBytes ||
    (c.sourceBytes === sourceBytes && c.generation !== generation)
  )
    throw new ToolkitError(
      'E_SOURCE_CHANGED',
      'Transcript generation changed.',
      'Start a fresh read with --from-end.',
    );
  return c.byte;
}
/**
 * Prefix counts are nondecreasing for Codex (correlation only adds answers),
 * Cursor (settled groups retain the question/user tail and add terminal output),
 * and Claude except when a reused tool ID changes an earlier answer's type.
 * A matched Claude dequeue replaces one queued entry with one user entry.
 * With tool results included, both Claude result forms still contribute one.
 */
function mayReduceMessageCount(
  records: SourceRecord[],
  options: ReadOptions,
): boolean {
  if (options.runtime !== 'claude-code' || options.includeToolResults)
    return false;
  const names = new Map<string, string>();
  for (const { record } of records) {
    const message =
      record.message &&
      typeof record.message === 'object' &&
      !Array.isArray(record.message)
        ? (record.message as JsonObject)
        : record;
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
      const tool = block as JsonObject;
      if (
        tool.type !== 'tool_use' ||
        typeof tool.id !== 'string' ||
        !tool.id ||
        typeof tool.name !== 'string' ||
        !tool.name
      )
        continue;
      if (names.has(tool.id) && names.get(tool.id) !== tool.name) return true;
      names.set(tool.id, tool.name);
    }
  }
  return false;
}
/** Find the first whole-record boundary without rendering every growing prefix. */
function messageBoundary(
  records: SourceRecord[],
  options: ReadOptions,
  limit: number,
): { length: number; excludeCrossing: boolean } | null {
  const raw = records.map((row) => row.record);
  const counts = new Map<number, number>([[0, 0]]);
  const count = (length: number): number => {
    let value = counts.get(length);
    if (value === undefined) {
      value = normalizeEntries(
        options.runtime,
        raw.slice(0, length),
        options,
      ).length;
      counts.set(length, value);
    }
    return value;
  };
  let end: number;
  if (mayReduceMessageCount(records, options)) {
    // Preserve the donor's first boundary for contradictory reused-ID input.
    // This exceptional path retains prefix cost; ordinary pages never use it.
    end = 1;
    while (end <= records.length && count(end) < limit) end++;
    if (end > records.length) return null;
  } else {
    if (count(records.length) < limit) return null;
    let start = 1;
    end = records.length;
    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      if (count(middle) >= limit) end = middle;
      else start = middle + 1;
    }
  }
  // A single first contributing record may exceed the requested message limit.
  const excludeCrossing = count(end) > limit && count(end - 1) > 0;
  return { length: excludeCrossing ? end - 1 : end, excludeCrossing };
}
/** A stateless source-byte-bounded page. No discovery, state writes or digest slicing. */
export async function parseTranscript(
  options: ReadOptions,
): Promise<TranscriptPage> {
  const runtime = provider(options.runtime);
  const backward = !!options.fromEnd || options.beforeCursor !== undefined;
  if (
    backward &&
    ((options.fromEnd && options.beforeCursor !== undefined) ||
      options.cursor !== undefined ||
      options.fromOffset !== undefined ||
      options.maxMessages !== undefined)
  )
    throw new ToolkitError(
      'E_USAGE',
      'Backward paging conflicts with another starting position or a message limit.',
      'Use --from-end or --before-cursor with --max-records or --max-bytes.',
    );
  if (options.cursor !== undefined && options.fromOffset !== undefined)
    throw new ToolkitError(
      'E_USAGE',
      'Cursor conflicts with fromOffset.',
      'Use one continuation coordinate.',
    );
  const from = options.fromOffset ?? 0;
  if (!Number.isSafeInteger(from) || from < 0)
    throw new ToolkitError(
      'E_USAGE',
      'Invalid fromOffset.',
      'Use a nonnegative safe integer.',
    );
  const budget = positive(options.maxBytes, 'maxBytes', 4_000_000)!;
  const maxRecords = positive(options.maxRecords, 'maxRecords');
  const maxMessages = positive(options.maxMessages, 'maxMessages');
  const path = await realpath(options.path);
  const handle = await open(path, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile())
      throw new ToolkitError(
        'E_USAGE',
        'Transcript must be a regular file.',
        'Select a JSONL file.',
      );
    const generation = createHash('sha256')
      .update(
        JSON.stringify([
          before.dev,
          before.ino,
          before.size,
          before.mtimeMs,
          before.ctimeMs,
        ]),
      )
      .digest('hex');
    let p: Position = { byte: 0, source: 0, decoded: 0, line: 1, from };
    if (options.cursor) {
      const c = decode(options.cursor);
      if (
        c.runtime !== runtime ||
        c.path !== path ||
        c.projection !== projection(options)
      )
        throw new ToolkitError(
          'E_CURSOR_INVALID',
          'Cursor belongs to a different source or projection.',
          'Restart this read with matching options.',
        );
      if (c.generation !== generation)
        throw new ToolkitError(
          'E_SOURCE_CHANGED',
          'Transcript generation changed.',
          'Start a fresh read; do not reuse saved offsets without consumer revalidation.',
        );
      if (c.byte > before.size)
        throw new ToolkitError(
          'E_CURSOR_INVALID',
          'Cursor exceeds source.',
          'Start a fresh read.',
        );
      p = c;
    }
    const fileId = `${before.dev}:${before.ino}`;
    const endByte =
      options.beforeCursor === undefined
        ? before.size
        : decodeBefore(options, path, generation, fileId, before.size);
    const start = backward ? Math.max(0, endByte - budget) : p.byte;
    const bytes = Buffer.alloc(Math.min(budget, endByte - start));
    let bytesRead = 0;
    while (bytesRead < bytes.length) {
      const n = await handle.read(
        bytes,
        bytesRead,
        bytes.length - bytesRead,
        start + bytesRead,
      );
      if (!n.bytesRead) break;
      bytesRead += n.bytesRead;
    }
    const records: SourceRecord[] = [],
      diagnostics: ReadDiagnostic[] = [];
    const reasons: string[] = [];
    let offset = 0;
    if (backward && start > 0) {
      // The first byte serves as a boundary byte. It may be inside a UTF-8
      // sequence or JSONL record, so decode only after the first LF.
      const lf = bytes.subarray(0, bytesRead).indexOf(10);
      offset = lf < 0 ? bytesRead : lf + 1;
    }
    if (options.beforeCursor !== undefined && bytes[bytesRead - 1] !== 10)
      throw new ToolkitError(
        'E_SOURCE_CHANGED',
        'Backward cursor no longer points to a record boundary.',
        'Start a fresh read with --from-end.',
      );
    let pageStart = start + offset;
    if (backward) p.byte = pageStart;
    while (offset < bytesRead) {
      const lf = bytes.indexOf(10, offset);
      const closed = lf >= 0;
      const end = closed ? lf + 1 : bytesRead;
      if (!closed && start + end < endByte) {
        reasons.push('byte-budget');
        break;
      }
      const carrier = bytes
        .subarray(offset, closed ? lf : end)
        .toString('utf8');
      const nonblank = carrier.trim().length > 0;
      const locator = {
        sourceOrdinal: p.source,
        physicalLine: p.line,
        ...(runtime === 'cursor' ? { frameIndex: p.line - 1 } : {}),
        byteStart: start + offset,
        byteEnd: start + end,
      };
      let record: JsonObject | null = null;
      if (nonblank) {
        try {
          const parsed: unknown = JSON.parse(carrier.trim());
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
            record = parsed as JsonObject;
          else if (p.source >= p.from)
            diagnostics.push({ kind: 'not-object', ...locator });
        } catch {
          if (p.source >= p.from)
            diagnostics.push({
              kind: closed ? 'malformed' : 'partial-tail',
              ...locator,
            });
        }
      }
      // Cursor's unclosed frame is never consumable, even when valid JSON.
      if (!closed && runtime === 'cursor' && nonblank) {
        if (record && p.source >= p.from)
          diagnostics.push({ kind: 'partial-tail', ...locator });
        reasons.push('incomplete-tail');
        break;
      }
      if (record) {
        const row = {
          record,
          sourceCarrier: carrier,
          recordIndex: p.decoded,
          ...locator,
          closed,
        };
        if (p.source >= p.from) {
          records.push(row);
        }
        p.decoded++;
      }
      if (runtime === 'cursor' || nonblank) p.source++;
      p.line++;
      offset = end;
      p.byte = start + offset;
      if (
        !closed &&
        diagnostics.some(
          (d) => d.byteStart === locator.byteStart && d.kind === 'partial-tail',
        )
      ) {
        reasons.push('incomplete-tail');
        p.byte = locator.byteStart;
        p.source--;
        p.line--;
        break;
      }
      if (!backward && maxRecords && records.length >= maxRecords) {
        if (p.byte < before.size) reasons.push('record-limit');
        break;
      }
    }
    if (backward) {
      if (maxRecords && records.length > maxRecords) {
        records.splice(0, records.length - maxRecords);
        const first = records[0];
        pageStart = first.byteStart;
        p.source -= first.sourceOrdinal;
        const firstKeptDiagnostic = diagnostics.findIndex(
          (row) => row.byteStart >= pageStart,
        );
        diagnostics.splice(
          0,
          firstKeptDiagnostic < 0 ? diagnostics.length : firstKeptDiagnostic,
        );
        const { sourceOrdinal, physicalLine, recordIndex } = first;
        for (const row of [...records, ...diagnostics]) {
          row.sourceOrdinal -= sourceOrdinal;
          row.physicalLine -= physicalLine - 1;
          if (row.frameIndex !== undefined) row.frameIndex -= physicalLine - 1;
          if ('recordIndex' in row) row.recordIndex -= recordIndex;
        }
        reasons.unshift('record-limit');
      } else if (pageStart > 0) {
        reasons.unshift('byte-budget');
      }
      if (endByte < before.size) reasons.push('before-cursor');
    }
    if (maxMessages) {
      const boundary = messageBoundary(records, options, maxMessages);
      if (boundary !== null) {
        const excluded = boundary.excludeCrossing
          ? records[boundary.length]
          : undefined;
        const last = records[boundary.length - 1];
        p = excluded
          ? {
              byte: excluded.byteStart,
              source: excluded.sourceOrdinal,
              decoded: excluded.recordIndex,
              line: excluded.physicalLine,
              from: p.from,
            }
          : {
              byte: last.byteEnd,
              source: last.sourceOrdinal + 1,
              decoded: last.recordIndex + 1,
              line: last.physicalLine + 1,
              from: p.from,
            };
        records.length = boundary.length;
        const firstOmittedDiagnostic = diagnostics.findIndex(
          (diagnostic) => diagnostic.byteStart >= p.byte,
        );
        if (firstOmittedDiagnostic !== -1)
          diagnostics.length = firstOmittedDiagnostic;
        reasons.length = 0;
        if (p.byte < before.size)
          reasons.push(
            maxRecords && boundary.length >= maxRecords
              ? 'record-limit'
              : 'message-limit',
          );
      }
    }
    const messages: TranscriptPage['messages'] = normalizeEntries(
      runtime,
      records.map((row) => row.record),
      options,
    ).map((message) => {
      const source = records[message.recordIndex];
      return {
        ...message,
        recordIndex: source.recordIndex,
        ...(message.sourceRecordIndex === undefined
          ? {}
          : {
              sourceRecordIndex: records[message.sourceRecordIndex].recordIndex,
            }),
        sourceOrdinal: source.sourceOrdinal,
        physicalLine: source.physicalLine,
      };
    });
    if (p.byte < before.size && reasons.length === 0)
      reasons.push('byte-budget');
    const after = await handle.stat();
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw new ToolkitError(
        'E_SOURCE_CHANGED',
        'Source changed during read.',
        'Retry a fresh page.',
      );
    const complete =
      (!backward || pageStart === 0) &&
      p.byte === before.size &&
      reasons.length === 0;
    const nextCursor =
      backward || complete
        ? null
        : Buffer.from(
            JSON.stringify({
              v: 1,
              runtime,
              path,
              generation,
              projection: projection(options),
              ...p,
            } satisfies Continuation),
          ).toString('base64url');
    const page: TranscriptPage = {
      runtime,
      path,
      coordinate:
        runtime === 'cursor'
          ? 'zero-based-jsonl-frame-index'
          : 'zero-based-nonblank-source-record',
      capturedAt: new Date().toISOString(),
      sourceBytes: before.size,
      bytesRead,
      generation,
      metadata: extractMetaFromRecords(
        runtime,
        records.map((r) => r.record),
        path,
      ),
      records,
      messages,
      diagnostics,
      nextOffset: p.source,
      nextCursor,
      coverage: { complete, reasons, fromByte: pageStart, throughByte: p.byte },
    };
    if (backward) {
      page.indexScope = 'page';
      page.coverage.omittedStart = pageStart > 0;
      page.coverage.omittedEnd = p.byte < before.size;
      page.prevCursor =
        pageStart > 0 && pageStart < endByte
          ? Buffer.from(
              JSON.stringify({
                v: 2,
                runtime,
                path,
                fileId,
                generation,
                projection: projection(options),
                sourceBytes: before.size,
                byte: pageStart,
              } satisfies BeforeContinuation),
            ).toString('base64url')
          : null;
    }
    if (options.includeActivity) page.activity = summarizePage(page);
    return page;
  } finally {
    await handle.close();
  }
}
