import {
  normalizeEntries,
  readTailRecordsBounded,
  type DigestEntry,
  type Runtime,
  type SafeTranscriptDiagnosticCode,
} from '../core/runtimes.js';
import { sanitizeEntries } from '../export-session/sanitize.js';
import { compareQualifiedSessionIds } from './discovery.js';
import {
  DEFAULT_PREVIEW_BATCH_LIMITS,
  DEFAULT_SESSION_PREVIEW_LIMITS,
  parsePreviewBatchLimits,
  parseSessionCandidate,
  parseSessionPreviewLimits,
  type PreviewBatchLimits,
  type PreviewEntry,
  type SessionCandidate,
  type SessionPreview,
  type SessionPreviewLimits,
} from './types.js';

const PER_TRANSCRIPT_MAX_BYTES = 2 * 1024 * 1024;
const PER_TRANSCRIPT_MAX_RECORDS = 10_000;

export interface PreviewSource {
  candidate: SessionCandidate;
  runtime: 'codex' | 'claude-code';
  /** Internal-only input. It is never copied into a result or error. */
  transcriptPath: string;
}

export interface HandoffPreviewDependencies {
  now: () => number;
  readTailRecordsBounded: typeof readTailRecordsBounded;
  normalizeEntries: typeof normalizeEntries;
}

export interface PreviewHandoffCandidatesOptions {
  batchLimits?: PreviewBatchLimits;
  sessionLimits?: SessionPreviewLimits;
  deps?: HandoffPreviewDependencies;
}

export type HandoffPreviewFailure =
  | 'candidate-limit'
  | 'duplicate-candidate'
  | 'aggregate-input-bytes'
  | 'aggregate-input-records'
  | 'aggregate-rendered-characters'
  | 'deadline'
  | 'transcript-malformed'
  | 'transcript-oversized'
  | 'transcript-read-failed';

export class HandoffPreviewError extends Error {
  readonly code = 'preview-incomplete' as const;
  readonly reason: HandoffPreviewFailure;
  readonly key?: SessionCandidate['key'];

  constructor(reason: HandoffPreviewFailure, key?: SessionCandidate['key']) {
    super('preview-incomplete');
    this.name = 'HandoffPreviewError';
    this.reason = reason;
    this.key = key;
  }
}

const DEFAULT_DEPENDENCIES: HandoffPreviewDependencies = {
  now: Date.now,
  readTailRecordsBounded,
  normalizeEntries,
};

function ensureDeadline(
  now: () => number,
  startedAt: number,
  limits: PreviewBatchLimits,
): number {
  const elapsed = now() - startedAt;
  if (elapsed >= limits.deadlineMs) throw new HandoffPreviewError('deadline');
  return Math.max(1, limits.deadlineMs - elapsed);
}

function diagnosticFailure(
  diagnostics: readonly SafeTranscriptDiagnosticCode[],
  key: SessionCandidate['key'],
): void {
  if (diagnostics.includes('deadline-exceeded')) {
    throw new HandoffPreviewError('deadline');
  }
  if (diagnostics.includes('read-failed')) {
    throw new HandoffPreviewError('transcript-read-failed', key);
  }
  if (diagnostics.includes('oversized-record')) {
    throw new HandoffPreviewError('transcript-oversized', key);
  }
  if (diagnostics.includes('malformed-record')) {
    throw new HandoffPreviewError('transcript-malformed', key);
  }
}

function conversationEntries(
  runtime: Runtime,
  entries: readonly DigestEntry[],
): PreviewEntry[] {
  const structurallySafe = entries.filter(
    (entry) =>
      entry.kind === 'message' &&
      (entry.role === 'user' || entry.role === 'assistant') &&
      entry.origin !== 'automatic-control' &&
      entry.displayRole !== 'automatic-control',
  );
  return sanitizeEntries(structurallySafe, { runtime })
    .map((entry) => ({ role: entry.role, text: entry.text.trim() }))
    .filter((entry) => entry.text.length > 0);
}

function groupRounds(entries: readonly PreviewEntry[]): PreviewEntry[][] {
  const rounds: PreviewEntry[][] = [];
  for (const entry of entries) {
    if (entry.role === 'user' || rounds.length === 0) rounds.push([]);
    rounds.at(-1)?.push(entry);
  }
  return rounds;
}

interface LimitedConversation {
  rounds: PreviewEntry[][];
  omittedEntries: number;
  truncated: boolean;
  renderedCharacters: number;
}

function limitConversation(
  entries: readonly PreviewEntry[],
  limits: SessionPreviewLimits,
): LimitedConversation {
  const allRounds = groupRounds(entries);
  const selectedRounds = allRounds.slice(-limits.maxRounds);
  const retainedReverse: PreviewEntry[][] = [];
  let remaining = limits.maxCharacters;
  let retainedEntries = 0;
  let partialEntry = false;

  for (const round of selectedRounds.toReversed()) {
    const retainedRoundReverse: PreviewEntry[] = [];
    for (const entry of round.toReversed()) {
      if (remaining === 0) continue;
      if (entry.text.length <= remaining) {
        retainedRoundReverse.push(entry);
        retainedEntries += 1;
        remaining -= entry.text.length;
      } else {
        retainedRoundReverse.push({
          ...entry,
          text: entry.text.slice(-remaining),
        });
        retainedEntries += 1;
        remaining = 0;
        partialEntry = true;
      }
    }
    if (retainedRoundReverse.length > 0) {
      retainedReverse.push(retainedRoundReverse.toReversed());
    }
  }

  const omittedEntries = entries.length - retainedEntries;
  const rounds = retainedReverse.toReversed();
  return {
    rounds,
    omittedEntries,
    truncated: omittedEntries > 0 || partialEntry,
    renderedCharacters: rounds
      .flat()
      .reduce((sum, entry) => sum + entry.text.length, 0),
  };
}

function validateSource(source: PreviewSource): PreviewSource {
  const candidate = parseSessionCandidate(source.candidate);
  const expectedRuntime =
    candidate.provider === 'codex' ? 'codex' : 'claude-code';
  if (
    source.runtime !== expectedRuntime ||
    typeof source.transcriptPath !== 'string'
  ) {
    throw new HandoffPreviewError('transcript-read-failed', candidate.key);
  }
  return {
    candidate,
    runtime: expectedRuntime,
    transcriptPath: source.transcriptPath,
  };
}

/**
 * Render an all-or-error comparison. Path-bearing sources are accepted only as
 * internal inputs and every public result/error is provider-qualified and path-free.
 */
export async function previewHandoffCandidates(
  sources: readonly PreviewSource[],
  options: PreviewHandoffCandidatesOptions = {},
): Promise<SessionPreview[]> {
  const deps = options.deps ?? DEFAULT_DEPENDENCIES;
  const batchLimits = parsePreviewBatchLimits(
    options.batchLimits ?? DEFAULT_PREVIEW_BATCH_LIMITS,
  );
  const sessionLimits = parseSessionPreviewLimits(
    options.sessionLimits ?? DEFAULT_SESSION_PREVIEW_LIMITS,
  );
  if (sources.length > batchLimits.maxCandidates) {
    throw new HandoffPreviewError('candidate-limit');
  }

  const ordered = sources
    .map(validateSource)
    .toSorted((left, right) =>
      compareQualifiedSessionIds(left.candidate.key, right.candidate.key),
    );
  const keys = ordered.map(({ candidate }) => candidate.key);
  if (new Set(keys).size !== keys.length) {
    throw new HandoffPreviewError('duplicate-candidate');
  }

  const startedAt = deps.now();
  let aggregateInputBytes = 0;
  let aggregateInputRecords = 0;
  let aggregateRenderedCharacters = 0;
  const previews: SessionPreview[] = [];

  for (const source of ordered) {
    const remainingDeadlineMs = ensureDeadline(
      deps.now,
      startedAt,
      batchLimits,
    );
    const remainingInputBytes =
      batchLimits.maxAggregateInputBytes - aggregateInputBytes;
    const remainingInputRecords =
      batchLimits.maxAggregateInputRecords - aggregateInputRecords;
    if (remainingInputBytes <= 0) {
      throw new HandoffPreviewError('aggregate-input-bytes');
    }
    if (remainingInputRecords <= 0) {
      throw new HandoffPreviewError('aggregate-input-records');
    }
    const maxBytes = Math.min(PER_TRANSCRIPT_MAX_BYTES, remainingInputBytes);
    const maxInspectedRecords = Math.min(
      PER_TRANSCRIPT_MAX_RECORDS,
      remainingInputRecords,
    );
    const diagnostics: SafeTranscriptDiagnosticCode[] = [];
    const read = await deps.readTailRecordsBounded(source.transcriptPath, {
      maxBytes,
      maxRecords: PER_TRANSCRIPT_MAX_RECORDS,
      maxInspectedRecords,
      deadlineMs: remainingDeadlineMs,
      diagnostic: ({ code }) => diagnostics.push(code),
    });
    ensureDeadline(deps.now, startedAt, batchLimits);
    if (read.recordLimitExceeded === true) {
      throw new HandoffPreviewError(
        remainingInputRecords <= PER_TRANSCRIPT_MAX_RECORDS
          ? 'aggregate-input-records'
          : 'transcript-oversized',
        source.candidate.key,
      );
    }
    diagnosticFailure(diagnostics, source.candidate.key);

    if (
      !Number.isSafeInteger(read.bytesRead) ||
      read.bytesRead < 0 ||
      read.bytesRead > maxBytes
    ) {
      throw new HandoffPreviewError(
        maxBytes < PER_TRANSCRIPT_MAX_BYTES
          ? 'aggregate-input-bytes'
          : 'transcript-read-failed',
        source.candidate.key,
      );
    }
    if (
      !Number.isSafeInteger(read.recordsInspected) ||
      read.recordsInspected < read.records.length ||
      read.records.length > PER_TRANSCRIPT_MAX_RECORDS
    ) {
      throw new HandoffPreviewError(
        'transcript-read-failed',
        source.candidate.key,
      );
    }
    if (read.recordsInspected > maxInspectedRecords) {
      throw new HandoffPreviewError(
        maxInspectedRecords < PER_TRANSCRIPT_MAX_RECORDS
          ? 'aggregate-input-records'
          : 'transcript-read-failed',
        source.candidate.key,
      );
    }
    if (
      read.truncated &&
      maxBytes < PER_TRANSCRIPT_MAX_BYTES &&
      read.bytesRead === maxBytes
    ) {
      throw new HandoffPreviewError('aggregate-input-bytes');
    }
    aggregateInputBytes += read.bytesRead;
    if (aggregateInputBytes > batchLimits.maxAggregateInputBytes) {
      throw new HandoffPreviewError('aggregate-input-bytes');
    }
    aggregateInputRecords += read.recordsInspected;
    if (aggregateInputRecords > batchLimits.maxAggregateInputRecords) {
      throw new HandoffPreviewError('aggregate-input-records');
    }

    const normalized = deps.normalizeEntries(source.runtime, read.records, {
      includeToolCalls: false,
      includeToolResults: false,
      includeCommandMessages: false,
    });
    const limited = limitConversation(
      conversationEntries(source.runtime, normalized),
      sessionLimits,
    );
    aggregateRenderedCharacters += limited.renderedCharacters;
    if (
      aggregateRenderedCharacters > batchLimits.maxAggregateRenderedCharacters
    ) {
      throw new HandoffPreviewError('aggregate-rendered-characters');
    }
    ensureDeadline(deps.now, startedAt, batchLimits);

    previews.push({
      key: source.candidate.key,
      rounds: limited.rounds,
      truncated: read.truncated || limited.truncated,
      omittedEntries: limited.omittedEntries,
      warning: 'hidden-payload-sanitized-not-secret-free',
    });
  }

  ensureDeadline(deps.now, startedAt, batchLimits);
  return previews;
}
