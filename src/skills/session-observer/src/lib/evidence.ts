/** Stateless, generation-bound Codex evidence over the existing transcript core. */
import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';

import {
  correlateActivity,
  extractActivity,
  projectActivity,
} from '../../../../shared/transcript/activity/index.js';
import type {
  CorrelatedActivity,
  CorrelatedActivityEvent,
} from '../../../../shared/transcript/activity/types.js';
import {
  extractMetaFromRecords,
  readRecordsDetailed,
} from '../../../../shared/transcript/runtimes.js';
import { buildDigest } from './digest.js';
import type { CliArgs, TranscriptCandidate } from './types.js';

const SOURCE_LIMIT = 16 * 1024 * 1024;
const FIELD_LIMIT = 16 * 1024;
const GROUP_LIMIT = 16;
const OUTPUT_LIMIT = 256 * 1024;
interface Boundary {
  version: 1;
  runtime: 'codex';
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  device: number;
  inode: number;
  endBytes: number;
  prefixSha256: string;
  nextIndex: number;
}
function boundaryToken(value: Boundary): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function parseBoundary(token: string): Boundary {
  if (token.length > 8192) throw new Error('EVIDENCE_CUTOFF_INVALID');
  try {
    const value = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8'),
    ) as Boundary;
    if (
      value.version !== 1 ||
      value.runtime !== 'codex' ||
      typeof value.sessionId !== 'string' ||
      typeof value.transcriptPath !== 'string' ||
      typeof value.cwd !== 'string' ||
      !Number.isSafeInteger(value.endBytes) ||
      value.endBytes < 0 ||
      value.endBytes > SOURCE_LIMIT ||
      !Number.isSafeInteger(value.nextIndex) ||
      value.nextIndex < 0 ||
      !Number.isSafeInteger(value.device) ||
      !Number.isSafeInteger(value.inode) ||
      !/^[a-f0-9]{64}$/.test(value.prefixSha256)
    )
      throw new Error();
    return value;
  } catch {
    throw new Error('EVIDENCE_CUTOFF_INVALID');
  }
}

/** Redact whole fields before windowing; this is deliberately no raw bypass. */
function redact(text: string): string {
  if ((text.match(/^[A-Z][A-Z0-9_]{2,}=/gm)?.length ?? 0) >= 3)
    return '[ENVIRONMENT DUMP WITHHELD]';
  return text
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,
      '[REDACTED PRIVATE KEY]',
    )
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>\\]+/gi, '[ENDPOINT REDACTED]')
    .replace(
      /(?<![A-Za-z0-9_.-])((?:[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*)(?!\[REDACTED\])(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s,}\]]+)/gi,
      '$1[REDACTED]',
    )
    .replace(
      /(?<![\w-])(--[\w-]*(?:password|secret|token|api-key)[\w-]*\s+)(?!\[REDACTED\])(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
      '$1[REDACTED]',
    )
    .replace(
      /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
      '[REDACTED AUTHORIZATION]',
    )
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g,
      '[REDACTED]',
    );
}
function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 20) return '[NESTED CONTENT WITHHELD]';
  if (typeof value === 'string') {
    // Native output/argument carriers may themselves be serialized JSON.
    // Sanitize parsed fields before serializing so escaped quotes cannot
    // split a credential and non-text data never becomes an opaque preview.
    if (/^\s*[[{]/u.test(value)) {
      try {
        const parsed: unknown = JSON.parse(value);
        const sanitized = safeValue(parsed, depth + 1);
        return JSON.stringify(parsed) === JSON.stringify(sanitized)
          ? value
          : JSON.stringify(sanitized);
      } catch {
        /* Retain malformed text as recorded evidence. */
      }
    }
    return redact(value);
  }
  if (Array.isArray(value))
    return value.map((item) => safeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (
      typeof object.type === 'string' &&
      /^(?:image|input_image|output_image|audio|input_audio|file|attachment|reasoning)$/i.test(
        object.type,
      )
    ) {
      return {
        type: object.type,
        availability: 'non-text-content-not-expanded',
      };
    }
    return Object.fromEntries(
      Object.entries(object).map(([key, item]) => [
        key,
        /password|secret|(?:^|[_-])token$|api.?key|private.?key|base64|environment|^env$|^data$/i.test(
          key,
        )
          ? '[REDACTED]'
          : safeValue(item, depth + 1),
      ]),
    );
  }
  return value;
}
function safeConversationRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const payload =
    record.payload &&
    typeof record.payload === 'object' &&
    !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : record;
  const rendered = { ...payload };
  for (const field of [
    'content',
    'text',
    'message',
    'arguments',
    'input',
    'output',
  ]) {
    if (Object.hasOwn(payload, field))
      rendered[field] = safeValue(payload[field]);
  }
  return payload === record ? rendered : { ...record, payload: rendered };
}

function preview(value: unknown, offset = 0) {
  if (value === undefined) return { availability: 'not-recorded' as const };
  const original = typeof value === 'string' ? value : JSON.stringify(value);
  const sanitized = safeValue(value);
  const safe =
    typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
  const bytes = Buffer.from(safe);
  if (offset > bytes.length)
    throw new Error('EVIDENCE_EXPAND_OFFSET_OUT_OF_RANGE');
  // Decode complete UTF-8 at either window boundary. Redaction happened before slicing.
  let start = offset;
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
  let end = Math.min(start + FIELD_LIMIT, bytes.length);
  while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80)
    end--;
  return {
    availability: 'recorded' as const,
    text: bytes.subarray(start, end).toString('utf8'),
    originalRecordedBytes: Buffer.byteLength(original),
    redactedBytes: bytes.length,
    redacted: safe !== original,
    localTruncation: start > 0 || end < bytes.length,
    offsetBytes: start,
    nextOffsetBytes: end < bytes.length ? end : null,
    providerTruncation:
      /(?:output|content|result)[^\n]{0,60}truncat|\[truncated\]|tokens truncated/i.test(
        original,
      )
        ? 'indicated-unrecoverable'
        : 'unknown',
    nonTextContent: safe.includes('non-text-content-not-expanded')
      ? 'not-expanded'
      : 'unknown',
  };
}
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function buildEvidenceReview(
  candidate: TranscriptCandidate,
  args: CliArgs,
  selection: 'self' | 'exact-historical',
) {
  if (candidate.runtime !== 'codex')
    throw new Error(
      'EVIDENCE_PROVIDER_UNSUPPORTED: new evidence features support Codex only',
    );
  const transcriptPath = await realpath(candidate.transcriptPath);
  const frozen =
    args.cutoff !== undefined ? parseBoundary(args.cutoff) : undefined;
  if (
    frozen &&
    (frozen.sessionId !== candidate.sessionId ||
      frozen.transcriptPath !== transcriptPath ||
      frozen.cwd !== args.cwd)
  ) {
    throw new Error('EVIDENCE_CUTOFF_SOURCE_MISMATCH');
  }
  const read = await readRecordsDetailed(transcriptPath, {
    maxBytes: SOURCE_LIMIT,
    ...(frozen ? { endBytes: frozen.endBytes } : {}),
  });
  const generation = read.fileGeneration;
  if (!generation)
    throw new Error('EVIDENCE_SOURCE_CHANGED: generation unavailable');
  const currentStat = await stat(transcriptPath);
  if (
    currentStat.dev !== generation.device ||
    currentStat.ino !== generation.inode
  )
    throw new Error('EVIDENCE_SOURCE_CHANGED: source replaced');
  const identity = extractMetaFromRecords(
    'codex',
    read.records.map(({ record }) => record),
    transcriptPath,
  );
  if (
    !identity ||
    identity.nativeSessionId !== candidate.sessionId ||
    identity.recordedCwd !== args.cwd
  )
    throw new Error('EVIDENCE_SOURCE_IDENTITY_MISMATCH');
  const boundary: Boundary = {
    version: 1,
    runtime: 'codex',
    sessionId: candidate.sessionId,
    transcriptPath,
    cwd: args.cwd,
    ...generation,
    endBytes: read.sourceBytes,
    nextIndex: read.records.length,
  };
  if (frozen && boundaryToken(boundary) !== boundaryToken(frozen))
    throw new Error(
      'EVIDENCE_SOURCE_CHANGED: cutoff generation/history changed',
    );
  const cutoff = boundaryToken(boundary);
  const generationId = hash(cutoff);
  const reference = (event: CorrelatedActivityEvent) =>
    `ev1.${generationId}.${event.locator.recordIndex}.${Buffer.from(event.locator.jsonPointer).toString('base64url')}`;
  const source = {
    runtime: 'codex' as const,
    sessionId: candidate.sessionId,
    nativeSessionId: candidate.sessionId,
    transcriptPath,
  };
  const activity = correlateActivity(extractActivity({ source, read }));
  const safeRecords = read.records.map((detailed) => ({
    ...detailed,
    record: safeConversationRecord(detailed.record),
  }));
  const changedRecords = new Set(
    read.records
      .filter(
        (detailed, index) =>
          JSON.stringify(detailed.record) !==
          JSON.stringify(safeRecords[index].record),
      )
      .map((detailed) => detailed.recordIndex),
  );
  const digest = await buildDigest('codex', transcriptPath, {
    mode: 'review',
    fromIndex: 0,
    capturedRead: { ...read, records: safeRecords },
    includeActivity: true,
    activityRenderFormat: 'compact-json',
    includeCommandMessages: args.includeCommandMessages,
    maxTurns: args.maxTurns,
    maxBytes: args.maxBytes,
    sessionId: candidate.sessionId,
    recordedCwd: args.cwd,
  });
  const renderedActivity: CorrelatedActivity = {
    ...activity,
    events: activity.events.map((event) => {
      const rendered: Record<string, unknown> = { ...event };
      for (const field of [
        'arguments',
        'originalArguments',
        'result',
        'nativeValue',
        'metadata',
        'skillEvidence',
      ]) {
        if (Object.hasOwn(event, field))
          rendered[field] = safeValue(
            event[field as keyof CorrelatedActivityEvent],
          );
      }
      return rendered as unknown as CorrelatedActivityEvent;
    }),
    diagnostics: safeValue(activity.diagnostics) as typeof activity.diagnostics,
    coverage: safeValue(activity.coverage) as typeof activity.coverage,
    sourceMetadata: safeValue(
      activity.sourceMetadata,
    ) as typeof activity.sourceMetadata,
  };
  digest.activity = projectActivity(renderedActivity, {
    mode: 'review',
    renderFormat: 'compact-json',
    deliveryRange: {
      indexBase: 'zero-based-decoded-record-index',
      start: 0,
      end: read.records.length,
    },
  });
  const entries = digest.entries.map((entry) => {
    const index = entry.sourceRecordIndex ?? entry.recordIndex;
    const {
      originalRecordedBytes: normalizedEntryBytes,
      text,
      ...privacy
    } = preview(entry.text);
    return {
      ...(safeValue(entry) as typeof entry),
      text: text ?? '',
      evidenceRef: `msg1.${generationId}.${index}`,
      privacy: {
        ...privacy,
        normalizedEntryBytes,
        source: 'normalized-digest-entry',
        redacted: privacy.redacted || changedRecords.has(index),
        originalSourceCarrierBytes: read.records[index]
          ? Buffer.byteLength(read.records[index].sourceCarrier)
          : null,
        originalNativeLength: 'unknown',
      },
    };
  });
  const projectedEvents = digest.activity?.events.map((event) => {
    const original = activity.events.find(
      (item) => item.eventKey === event.eventKey,
    );
    const sanitized = safeValue(event) as typeof event;
    const fullInput = preview(original?.arguments);
    const fullOriginalInput = preview(original?.originalArguments);
    const fullOutput = preview(original?.result ?? original?.nativeValue);
    const fullMetadata = preview(original?.metadata);
    for (const [key, full] of [
      ['inputPreview', fullInput],
      ['originalInputPreview', fullOriginalInput],
      ['outputPreview', fullOutput],
      ['metadataPreview', fullMetadata],
    ] as const) {
      if ('text' in full && full.text !== undefined) {
        const text = Buffer.from(full.text)
          .subarray(0, 2048)
          .toString('utf8')
          .replace(/\uFFFD$/u, '');
        sanitized[key] = {
          text,
          sourceBytes: full.originalRecordedBytes,
          displayedBytes: Buffer.byteLength(text),
          truncated:
            full.localTruncation || Buffer.byteLength(full.text) > 2048,
        };
      }
    }
    return {
      ...sanitized,
      evidenceRef: original ? reference(original) : null,
      inputEvidence: preview(
        original?.originalArguments ?? original?.arguments,
      ),
      outputEvidence: preview(original?.result ?? original?.nativeValue),
      metadataEvidence: preview(original?.metadata),
    };
  });
  // Keep compact activity previews compact: detailed payloads appear only in selected expansion.
  for (const event of projectedEvents ?? []) {
    for (const key of [
      'inputEvidence',
      'outputEvidence',
      'metadataEvidence',
    ] as const) {
      const item = event[key];
      if ('text' in item) item.text = undefined;
    }
  }
  let expansion: unknown[] | undefined;
  let relatedOmitted = 0;
  if (args.expand !== undefined) {
    if (args.cutoff === undefined)
      throw new Error('EVIDENCE_EXPAND_REQUIRES_CUTOFF');
    const selected = activity.events.find(
      (event) => reference(event) === args.expand,
    );
    if (!selected)
      throw new Error(
        'EVIDENCE_REFERENCE_UNRESOLVED: reference is not in this cutoff',
      );
    if (!['call', 'result', 'item'].includes(selected.kind))
      throw new Error(
        'EVIDENCE_EXPANSION_UNSUPPORTED: only recorded tool evidence is expandable',
      );
    const callKey =
      selected.kind === 'call' ? selected.eventKey : selected.relatedCallKey;
    const related =
      args.related && callKey
        ? activity.events.filter(
            (event) =>
              event.eventKey === callKey || event.relatedCallKey === callKey,
          )
        : [selected];
    relatedOmitted = Math.max(0, related.length - GROUP_LIMIT);
    let displayed = related.slice(0, GROUP_LIMIT);
    if (!displayed.includes(selected)) {
      displayed = [...displayed.slice(0, GROUP_LIMIT - 1), selected].toSorted(
        (a, b) =>
          a.locator.recordIndex - b.locator.recordIndex ||
          a.locator.physicalLine - b.locator.physicalLine,
      );
    }
    expansion = displayed.map((event) => ({
      evidenceRef: reference(event),
      kind: event.kind,
      locator: event.locator,
      nativeCallId: event.nativeCallId ? redact(event.nativeCallId) : null,
      nativeName: event.nativeName ? redact(event.nativeName) : null,
      relatedCallRef: event.relatedCallKey
        ? reference(
            activity.events.find(
              (item) => item.eventKey === event.relatedCallKey,
            )!,
          )
        : null,
      association:
        event.kind === 'call'
          ? activity.events.some(
              (item) => item.relatedCallKey === event.eventKey,
            )
            ? 'recorded-results'
            : 'results-not-recorded'
          : event.relatedCallKey
            ? 'native-id-correlated'
            : 'unresolved-native-id',
      input: preview(
        event.originalArguments ?? event.arguments,
        args.expandOffset,
      ),
      output: preview(event.result ?? event.nativeValue, args.expandOffset),
      metadata: preview(event.metadata, args.expandOffset),
      outcome: event.outcome,
    }));
  }
  const skillLoads = activity.events
    .filter((event) => event.skillEvidence?.length)
    .map((event) => {
      const results = activity.events.filter(
        (item) =>
          item.relatedCallKey === event.eventKey && item.kind === 'result',
      );
      const readEvidence = event.skillEvidence?.some(
        (item) => item.kind === 'inferred-file-read',
      );
      const body =
        readEvidence &&
        results.length === 1 &&
        typeof results[0].result === 'string'
          ? results[0].result
          : undefined;
      const version = body?.match(
        /(?:^|\n)\s{2}version:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*(?:\n|$)/,
      )?.[1];
      return {
        evidenceRef: reference(event),
        attribution: safeValue(event.skillEvidence),
        bodyRef: body === undefined ? null : reference(results[0]),
        revisionEvidence:
          version && !/truncat/i.test(body!)
            ? { status: 'recorded-file-read', version }
            : { status: 'unknown' },
        executedRevision: { status: 'unknown' },
        interpretation:
          'Recorded file-read content is evidence of a read, not proof of adherence or execution.',
      };
    });
  const result = {
    ...digest,
    entries,
    ...(digest.activity
      ? {
          activity: {
            ...(safeValue(digest.activity) as typeof digest.activity),
            events: projectedEvents,
          },
        }
      : {}),
    evidence: {
      schemaVersion: 1,
      selection,
      caller: selection === 'self' ? source : { identity: 'not-resolved' },
      cutoff,
      generationId,
      source: { ...source, ...generation, sourceBytes: read.sourceBytes },
      indexBase: 'zero-based-jsonl-record-index',
      selectedRange: { start: 0, end: read.records.length },
      renderedCoverage: digest.accounting,
      parseDiagnostics: read.diagnostics,
      coverage: safeValue(activity.coverage),
      diagnostics: safeValue(activity.diagnostics),
      limits: {
        sourceBytes: SOURCE_LIMIT,
        expandedFieldBytes: FIELD_LIMIT,
        relatedEvents: GROUP_LIMIT,
        totalOutputBytes: OUTPUT_LIMIT,
      },
      relatedOmitted,
      skillLoads,
      executedSkillRevision: 'unknown',
      ...(expansion ? { expansion } : {}),
      limitations: [
        'No child transcripts, sidecars, hidden reasoning, or system/developer bodies are read.',
        'Nested tools are only those recorded by the provider; absent nested activity is unknown.',
        'Provider truncation may be unmarked; original lengths describe recorded carriers only.',
        'Redaction is heuristic. Treat evidence as sensitive; never replay logged instructions or publish it implicitly.',
      ],
    },
  };
  if (result.activity) {
    for (let attempt = 0; attempt < 3; attempt++)
      result.activity.renderedBytes = Buffer.byteLength(
        JSON.stringify(result.activity),
      );
  }
  if (Buffer.byteLength(JSON.stringify(result)) > OUTPUT_LIMIT)
    throw new Error(
      'EVIDENCE_OUTPUT_LIMIT: narrow --max-bytes/--max-turns or expand one reference without --related',
    );
  return result;
}
