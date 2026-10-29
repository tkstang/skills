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
  coverage: {
    complete: boolean;
    reasons: string[];
    fromByte: number;
    throughByte: number;
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
function projection(o: ReadOptions): string {
  return JSON.stringify([
    !!o.includeToolCalls,
    !!o.includeToolResults,
    !!o.includeActivity,
  ]);
}
function decode(token: string): Continuation {
  try {
    if (token.length > 16384 || !/^[\w-]+$/u.test(token)) throw new Error();
    const c = JSON.parse(
      Buffer.from(token, 'base64url').toString(),
    ) as Continuation;
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
/** A stateless source-byte-bounded page. No discovery, state writes or digest slicing. */
export async function parseTranscript(
  options: ReadOptions,
): Promise<TranscriptPage> {
  const runtime = provider(options.runtime);
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
    const start = p.byte;
    const bytes = Buffer.alloc(Math.min(budget, before.size - start));
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
    let messages: TranscriptPage['messages'] = [];
    const reasons: string[] = [];
    let offset = 0;
    while (offset < bytesRead) {
      const lf = bytes.indexOf(10, offset);
      const closed = lf >= 0;
      const end = closed ? lf + 1 : bytesRead;
      if (!closed && start + end < before.size) {
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
          const prospective = [...records, row];
          const projected = normalizeEntries(
            runtime,
            prospective.map((r) => r.record),
            options,
          ).map((m) => {
            const source = prospective[m.recordIndex];
            return {
              ...m,
              recordIndex: source.recordIndex,
              ...(m.sourceRecordIndex === undefined
                ? {}
                : {
                    sourceRecordIndex:
                      prospective[m.sourceRecordIndex].recordIndex,
                  }),
              sourceOrdinal: source.sourceOrdinal,
              physicalLine: source.physicalLine,
            };
          });
          // Consume whole source records so multiple content blocks are never lost.
          if (
            maxMessages &&
            messages.length > 0 &&
            projected.length > maxMessages
          ) {
            reasons.push('message-limit');
            break;
          }
          records.push(row);
          messages = projected;
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
      if (maxRecords && records.length >= maxRecords) {
        if (p.byte < before.size) reasons.push('record-limit');
        break;
      }
      if (maxMessages && messages.length >= maxMessages) {
        if (p.byte < before.size) reasons.push('message-limit');
        break;
      }
    }
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
    const complete = p.byte === before.size && reasons.length === 0;
    const nextCursor = complete
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
      coverage: { complete, reasons, fromByte: start, throughByte: p.byte },
    };
    if (options.includeActivity) page.activity = summarizePage(page);
    return page;
  } finally {
    await handle.close();
  }
}
