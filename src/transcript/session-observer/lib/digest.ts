/**
 * digest.mjs — Digest builder, filter, and renderer.
 *
 * Exports:
 *   buildDigest(runtime, transcriptPath, opts)  → Promise<Digest>
 *   renderMarkdown(digest)                      → string
 *   renderJson(digest)                          → string
 *
 * Opts:
 *   fromIndex       {number}  — first record index to include (default 0)
 *   mode            {string}  — 'review' | 'catch-up' | 'locate' (default 'review')
 *   includeToolCalls    {boolean}  (default false)
 *   includeToolResults  {boolean}  (default false)
 *   includeCommandMessages {boolean} (default false)
 *   maxTurns        {number}  — tail-slice: keep only last N turn groups
 *   maxBytes        {number}  — tail-slice: keep only tail entries whose cumulative text fits
 *
 * Digest schema (schemaVersion: 1):
 *   { schemaVersion, runtime, sessionId, transcriptPath, recordedCwd,
 *     matchedTier, widenedFrom, active, mode, range, accounting, entries, filters, warnings, fallbacks }
 */

import type {
  CursorAssistantContentRecord,
  CursorTurnAnalysis,
} from '../../core/cursor-analysis.js';
import {
  type DigestEntry,
  type Runtime,
  readRecords,
  normalizeEntries,
  extractMeta,
} from '../../core/runtimes.js';
import { classifyTranscriptRecords } from './session-classifier.js';
import type {
  BuildDigestOptions,
  CursorBuildDigestOptions,
  CursorDigestAccountingV2,
  CursorDigestEntryV2,
  CursorDigestV2,
  CursorLifecycleEvent,
  CursorRecoveryPointerV2,
  Digest,
  DigestAccounting,
  DigestFilters,
  DigestRecoveryPointer,
  DigestRange,
  SessionDigest,
  TranscriptClassification,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1 as const;
const LARGE_OUTPUT_THRESHOLD = 20_000; // chars
const AUTO_LARGE_DIGEST_TURNS = 8;

// ---------------------------------------------------------------------------
// applyTailSlice
// ---------------------------------------------------------------------------

/**
 * Slice entries from the tail by maxTurns or maxBytes.
 *
 * @param {object[]} entries  — DigestEntry[]
 * @param {{ maxTurns?: number, maxBytes?: number }} opts
 * @returns {object[]}
 */
function applyTailSlice<T extends DigestEntry>(
  entries: T[],
  opts: Pick<BuildDigestOptions, 'maxTurns' | 'maxBytes'>,
): T[] {
  const { maxTurns, maxBytes } = opts;

  if (maxBytes && maxBytes > 0) {
    // Walk from the tail, accumulate byte count, include entries until we exceed maxBytes
    let cumBytes = 0;
    const result: T[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entryBytes = Buffer.byteLength(entries[i].text || '', 'utf8');
      if (cumBytes + entryBytes > maxBytes && result.length > 0) break;
      cumBytes += entryBytes;
      result.unshift(entries[i]);
    }
    return result;
  }

  if (maxTurns && maxTurns > 0) {
    // "Turn" = a consecutive block of same-role entries. Count turn groups from the tail.
    const groups = groupByRole(entries);
    const tailGroups = groups.slice(-maxTurns);
    return tailGroups.flat();
  }

  return entries;
}

function renderedCharCount(entries: DigestEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.text?.length ?? 0), 0);
}

/**
 * A tail cap may omit whole human user entries, but it must never make their
 * decision-bearing content unrecoverable.  Keep a pointer for every omitted
 * human entry; automatic control input is not human direction and is excluded.
 */
function omittedUserMessageRecoveryPointers(
  entriesBeforeTailSlice: DigestEntry[],
  retainedEntries: DigestEntry[],
  transcriptPath: string,
): DigestRecoveryPointer[] {
  const retained = new Set(retainedEntries);
  const seenRecordIndexes = new Set<number>();
  const pointers: DigestRecoveryPointer[] = [];

  for (const entry of entriesBeforeTailSlice) {
    const recoveryRecordIndex = entry.sourceRecordIndex ?? entry.recordIndex;
    if (
      retained.has(entry) ||
      entry.role !== 'user' ||
      entry.origin === 'automatic-control' ||
      seenRecordIndexes.has(recoveryRecordIndex)
    ) {
      continue;
    }
    seenRecordIndexes.add(recoveryRecordIndex);
    pointers.push({
      transcriptPath,
      indexBase: 'zero-based-jsonl-record-index',
      recordIndex: recoveryRecordIndex,
    });
  }

  return pointers;
}

// ---------------------------------------------------------------------------
// groupByRole
// ---------------------------------------------------------------------------

/**
 * Group consecutive same-role entries together.
 * Returns an array of arrays (each inner array is one role group).
 *
 * @param {object[]} entries
 * @returns {object[][]}
 */
function groupByRole<T extends DigestEntry>(entries: T[]): T[][] {
  if (entries.length === 0) return [];
  const groups: T[][] = [];
  let currentGroup = [entries[0]!];

  for (let i = 1; i < entries.length; i++) {
    if (
      (entries[i].displayRole ?? entries[i].role) ===
      (currentGroup[0].displayRole ?? currentGroup[0].role)
    ) {
      currentGroup.push(entries[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [entries[i]];
    }
  }
  groups.push(currentGroup);
  return groups;
}

// ---------------------------------------------------------------------------
// formatHeader
// ---------------------------------------------------------------------------

/**
 * Render the markdown digest header block.
 *
 * @param {object} digest
 * @returns {string}
 */
function formatHeader(digest: Digest): string {
  const {
    runtime,
    transcriptPath,
    recordedCwd,
    mode,
    range,
    accounting,
    filters,
    active,
    warnings,
  } = digest;
  const lines: string[] = [];
  lines.push(`## session-observer digest`);
  lines.push('');
  lines.push(`**runtime:** ${runtime}`);
  lines.push(`**mode:** ${mode}`);
  if (recordedCwd) lines.push(`**cwd:** ${recordedCwd}`);
  lines.push(`**transcript:** ${transcriptPath}`);
  if (active) lines.push(`**status:** ACTIVE (modified < 60s ago)`);

  // Range info. `range` is raw transcript consumption; rendered message
  // ranges are shown separately because tool filtering can consume raw records
  // without emitting digest entries.
  if (range.newRecords > 0) {
    lines.push(
      `**raw range (zero-based JSONL indices):** records ${range.fromIndex}–${range.toIndex} of ${range.totalRecords}`,
    );
  } else {
    lines.push(
      `**raw range (zero-based JSONL indices):** no new records at offset ${range.fromIndex} of ${range.totalRecords}`,
    );
  }
  if (mode === 'catch-up' && range.newRecords !== undefined) {
    lines.push(`**raw records consumed:** ${range.newRecords}`);
  }
  if (accounting?.rendered) {
    const { count, fromIndex, toIndex } = accounting.rendered;
    const renderedRange =
      count > 0 ? `zero-based records ${fromIndex}–${toIndex}` : 'none';
    lines.push(`**rendered messages:** ${count} (${renderedRange})`);
  }
  if (accounting?.filtered) {
    const filtered = accounting.filtered;
    const filterParts: string[] = [];
    if (filtered.toolCalls > 0)
      filterParts.push(`tool calls: ${filtered.toolCalls}`);
    if (filtered.toolResults > 0)
      filterParts.push(`tool results: ${filtered.toolResults}`);
    if (filtered.commandMessages > 0)
      filterParts.push(`command messages: ${filtered.commandMessages}`);
    if (filtered.bootstrapRecords > 0)
      filterParts.push(`bootstrap records: ${filtered.bootstrapRecords}`);
    if (filtered.metadataRecords > 0)
      filterParts.push(
        `metadata/non-message records: ${filtered.metadataRecords}`,
      );
    if (filtered.tailSliceEntries > 0)
      filterParts.push(`tail-sliced entries: ${filtered.tailSliceEntries}`);
    if (filterParts.length > 0) {
      lines.push(`**filtered out:** ${filterParts.join(' · ')}`);
    }
  }
  if (accounting.recovery.omittedUserMessages.length > 0) {
    const { transcriptPath: recoveryTranscriptPath, indexBase } =
      accounting.recovery.omittedUserMessages[0]!;
    const recordIndexes = accounting.recovery.omittedUserMessages.map(
      (pointer) => pointer.recordIndex,
    );
    const indexDescription =
      indexBase === 'zero-based-jsonl-record-index'
        ? 'zero-based JSONL indices'
        : indexBase;
    lines.push(
      `**User-message recovery:** ${recoveryTranscriptPath} records ${recordIndexes.join(', ')} (${indexDescription}).`,
    );
  }

  // Filters
  const filterParts: string[] = [];
  if (!filters.includeToolCalls) filterParts.push('tool calls excluded');
  if (!filters.includeToolResults) filterParts.push('tool results excluded');
  if (!filters.includeCommandMessages)
    filterParts.push('command messages excluded');
  if (filterParts.length > 0) {
    lines.push(`**filters:** ${filterParts.join(' · ')}`);
  }

  // Warnings
  if (warnings && warnings.length > 0) {
    for (const w of warnings) {
      lines.push(`**warning:** ${w}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function recoveryPointerKey(pointer: CursorRecoveryPointerV2): string {
  return `${pointer.frameIndex}:${pointer.entryKey}`;
}

function addCursorRecoveryPointer(
  pointers: CursorRecoveryPointerV2[],
  seen: Set<string>,
  pointer: CursorRecoveryPointerV2,
): void {
  const key = recoveryPointerKey(pointer);
  if (seen.has(key)) return;
  seen.add(key);
  pointers.push(pointer);
}

function cursorRecoveryPointer(
  transcriptPath: string,
  frameIndex: number,
  entryKey: string,
): CursorRecoveryPointerV2 {
  return {
    transcriptPath,
    indexBase: 'zero-based-jsonl-frame-index',
    frameIndex,
    entryKey,
  };
}

function cursorEntry(
  record: CursorAssistantContentRecord,
  deliveryFrameIndex: number,
  availability: CursorDigestEntryV2['availability'],
): CursorDigestEntryV2 {
  return {
    role: 'assistant',
    text: record.text,
    recordIndex: deliveryFrameIndex,
    sourceFrameIndex: record.sourceFrameIndex,
    kind: 'message',
    entryKey: record.entryKey,
    turnId: record.turnId,
    availability,
  };
}

function isCursorBuildDigestOptions(
  opts: BuildDigestOptions | CursorBuildDigestOptions,
): opts is CursorBuildDigestOptions {
  return (
    'cursorProjection' in opts &&
    'cursorScan' in opts &&
    'cursorAnalysis' in opts &&
    'cursorIdentity' in opts &&
    'cursorContinuity' in opts
  );
}

function cursorStateTurn(
  turn: CursorTurnAnalysis,
  opts: CursorBuildDigestOptions,
) {
  const openTurn = opts.cursorState?.openTurn ?? null;
  if (openTurn === null) return null;
  if (openTurn.turnId === turn.turnId) return openTurn;
  if (
    turn.lifecycle !== 'pending' &&
    turn.assistantRecords.length === 0 &&
    turn.terminalFrameIndex !== null &&
    opts.cursorAnalysis.turns.find(
      (candidate) => candidate.terminalFrameIndex !== null,
    ) === turn
  ) {
    return openTurn;
  }
  return null;
}

function cursorEngagement(
  opts: CursorBuildDigestOptions,
): TranscriptClassification {
  const humanFrames = new Set<number>();
  let assistantMessages = 0;
  let hasAutomaticControlInput = false;

  for (const turn of opts.cursorAnalysis.turns) {
    const stateTurn = cursorStateTurn(turn, opts);
    for (const frameIndex of turn.humanRecordIndexes) {
      humanFrames.add(frameIndex);
    }
    assistantMessages += Math.max(
      turn.assistantRecords.length,
      stateTurn?.assistantEntryKeys.length ?? 0,
    );
    if (stateTurn) {
      for (const frameIndex of stateTurn.humanRecordIndexes) {
        humanFrames.add(frameIndex);
      }
      hasAutomaticControlInput ||= stateTurn.hasAutomaticControlInput;
    }
  }

  const genuineUserMessages = humanFrames.size;
  const syntheticUserMessages = hasAutomaticControlInput ? 1 : 0;
  const engaged = genuineUserMessages > 0 && assistantMessages > 0;
  return {
    status: engaged
      ? 'engaged'
      : genuineUserMessages > 0 ||
          assistantMessages > 0 ||
          syntheticUserMessages > 0
        ? 'unengaged'
        : 'unknown',
    engaged,
    recordCount: opts.cursorScan.totalFrames,
    genuineUserMessages,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount: genuineUserMessages + assistantMessages,
    hasAssistantAndUser: engaged,
    bootstrapRecordIndexes: [],
    bootstrapRecordCount: 0,
  };
}

function formatCursorHeader(digest: CursorDigestV2): string {
  const { status } = digest.cursorEvidence;
  const lines = [
    '## session-observer digest',
    '',
    `**runtime:** ${digest.runtime}`,
    `**mode:** ${digest.mode}`,
  ];
  if (digest.recordedCwd) lines.push(`**cwd:** ${digest.recordedCwd}`);
  lines.push(`**transcript:** ${digest.transcriptPath}`);
  if (digest.active) lines.push('**status:** ACTIVE (modified < 60s ago)');

  const { range, accounting } = digest;
  if (range.newFrames > 0) {
    lines.push(
      `**raw range (zero-based JSONL frame indices):** frames ${range.fromIndex}–${range.toIndex} of ${range.totalFrames}`,
    );
  } else {
    lines.push(
      `**raw range (zero-based JSONL frame indices):** no consumed frames at offset ${range.fromIndex} of ${range.totalFrames}`,
    );
  }
  lines.push(`**raw frames consumed:** ${range.newFrames}`);
  lines.push(`**rendered messages:** ${accounting.rendered.count}`);
  lines.push(`**engagement:** ${status.engagement}`);
  lines.push(`**activity:** ${status.activity}`);
  lines.push(`**content:** ${status.content}`);
  lines.push(`**lifecycle:** ${status.lifecycle}`);
  lines.push(`**delivery:** ${status.delivery}`);
  lines.push(`**health:** ${status.health}`);
  lines.push(`**projection:** ${digest.cursorEvidence.projection}`);
  lines.push(`**continuity:** ${digest.cursorEvidence.continuity}`);

  if (accounting.buffered.count > 0) {
    lines.push(
      `**buffered:** ${accounting.buffered.count} frame(s) from ${accounting.buffered.fromIndex} (${accounting.buffered.reason})`,
    );
  }
  if (digest.cursorEvidence.blockingFrame) {
    const blocking = digest.cursorEvidence.blockingFrame;
    lines.push(
      `**blocking frame:** ${blocking.frameIndex} (${blocking.parseState}, bytes ${blocking.byteStart}–${blocking.byteEnd})`,
    );
  }
  for (const event of digest.cursorEvidence.lifecycleEvents) {
    lines.push(
      `**lifecycle event:** ${event.lifecycle} at frame ${event.terminalFrameIndex} (turn ${event.turnId}, final entry ${event.finalEntryKey ?? 'none'}, previously observable ${event.contentPreviouslyObservable})`,
    );
  }

  const recoveryPointers = [
    ...accounting.recovery.omittedUserMessages,
    ...accounting.recovery.omittedAssistantEntries,
  ];
  if (recoveryPointers.length > 0) {
    lines.push(
      `**recovery pointers:** ${recoveryPointers
        .map((pointer) => `frame ${pointer.frameIndex} (${pointer.entryKey})`)
        .join(' · ')}`,
    );
  }
  for (const warning of digest.warnings) {
    lines.push(`**warning:** ${warning}`);
  }
  lines.push('', '---', '');
  return lines.join('\n');
}

function buildCursorDigest(
  transcriptPath: string,
  opts: CursorBuildDigestOptions,
): CursorDigestV2 {
  const { cursorScan: scan, cursorAnalysis: analysis } = opts;
  if (
    scan.indexBase !== 'zero-based-jsonl-frame-index' ||
    opts.cursorIdentity.runtime !== 'cursor'
  ) {
    throw new TypeError('Cursor digest requires frame-index Cursor evidence');
  }

  const fromIndex =
    opts.fromIndex ?? opts.cursorState?.continuity.nextFrameIndex ?? 0;
  if (!Number.isSafeInteger(fromIndex) || fromIndex < 0) {
    throw new TypeError('Cursor digest fromIndex must be non-negative');
  }
  const safeNextIndex = Math.max(
    fromIndex,
    Math.min(
      scan.totalFrames,
      scan.safeThroughFrame === null ? 0 : scan.safeThroughFrame + 1,
    ),
  );
  let nextIndex = safeNextIndex;
  let stabilityWaitFrom: number | null = null;
  let latestLifecycle: CursorDigestV2['cursorEvidence']['status']['lifecycle'] =
    'none';
  let hasAssistantActivity = false;
  let hasToolActivity = false;
  let hasHumanActivity = false;
  let suppressedContent = false;
  let unstableContent = 0;
  const entriesBeforeTailSlice: CursorDigestEntryV2[] = [];
  const lifecycleEvents: CursorLifecycleEvent[] = [];
  const omittedUserMessages: CursorRecoveryPointerV2[] = [];
  const omittedAssistantEntries: CursorRecoveryPointerV2[] = [];
  const seenUserPointers = new Set<string>();
  const seenAssistantPointers = new Set<string>();

  for (const turn of analysis.turns) {
    const stateTurn = cursorStateTurn(turn, opts);
    const turnId = stateTurn?.turnId ?? turn.turnId;
    const deliveredEntryKeys = new Set(stateTurn?.deliveredEntryKeys ?? []);
    const substantiveRecords = turn.assistantRecords.filter(
      (record) => record.classification === 'substantive',
    );
    hasAssistantActivity ||=
      turn.assistantRecords.length > 0 ||
      (stateTurn?.assistantEntryKeys.length ?? 0) > 0;
    hasToolActivity ||=
      turn.toolRecordIndexes.length > 0 ||
      (stateTurn?.toolRecordIndexes.length ?? 0) > 0;
    hasHumanActivity ||=
      turn.humanRecordIndexes.length > 0 ||
      (stateTurn?.humanRecordIndexes.length ?? 0) > 0;
    latestLifecycle = turn.lifecycle;

    const humanFrameIndexes = new Set([
      ...turn.humanRecordIndexes,
      ...(stateTurn?.humanRecordIndexes ?? []),
    ]);
    for (const frameIndex of humanFrameIndexes) {
      if (frameIndex < fromIndex || frameIndex >= safeNextIndex) continue;
      addCursorRecoveryPointer(
        omittedUserMessages,
        seenUserPointers,
        cursorRecoveryPointer(
          transcriptPath,
          frameIndex,
          `${turnId}:frame:${frameIndex}:user`,
        ),
      );
    }

    if (turn.lifecycle === 'pending') {
      if (opts.cursorProjection === 'confirmed-completion') {
        stabilityWaitFrom =
          stabilityWaitFrom === null
            ? turn.fromFrameIndex
            : Math.min(stabilityWaitFrom, turn.fromFrameIndex);
        continue;
      }

      const candidate = opts.cursorState?.stabilityCandidate;
      const stableEntryKeys =
        candidate?.turnId === turnId && candidate.confirmedAt !== null
          ? new Set(candidate.entryKeys)
          : new Set<string>();
      for (const record of substantiveRecords) {
        if (deliveredEntryKeys.has(record.entryKey)) continue;
        if (!stableEntryKeys.has(record.entryKey)) {
          unstableContent += 1;
          stabilityWaitFrom =
            stabilityWaitFrom === null
              ? record.sourceFrameIndex
              : Math.min(stabilityWaitFrom, record.sourceFrameIndex);
          continue;
        }
        entriesBeforeTailSlice.push(
          cursorEntry(record, record.sourceFrameIndex, 'pending-lifecycle'),
        );
      }
      continue;
    }

    const finalEntryKey =
      turn.finalSubstantiveEntryKey ??
      (turn.lifecycle === 'success'
        ? (stateTurn?.assistantEntryKeys.at(-1) ?? null)
        : null);
    lifecycleEvents.push({
      turnId,
      terminalFrameIndex: turn.terminalFrameIndex!,
      lifecycle: turn.lifecycle,
      finalEntryKey,
      contentPreviouslyObservable:
        finalEntryKey !== null && deliveredEntryKeys.has(finalEntryKey),
    });

    if (turn.lifecycle !== 'success') {
      suppressedContent ||=
        substantiveRecords.length > 0 ||
        (stateTurn?.assistantEntryKeys.length ?? 0) > 0;
      continue;
    }

    const finalRecord = substantiveRecords.find(
      (record) => record.entryKey === finalEntryKey,
    );
    if (
      finalRecord &&
      (opts.cursorProjection === 'confirmed-completion' ||
        !deliveredEntryKeys.has(finalRecord.entryKey))
    ) {
      entriesBeforeTailSlice.push(
        cursorEntry(finalRecord, turn.terminalFrameIndex!, 'completed'),
      );
    }
    for (const record of substantiveRecords) {
      if (record.entryKey === finalEntryKey) continue;
      if (
        opts.cursorProjection === 'observation' &&
        deliveredEntryKeys.has(record.entryKey)
      ) {
        continue;
      }
      addCursorRecoveryPointer(
        omittedAssistantEntries,
        seenAssistantPointers,
        cursorRecoveryPointer(
          transcriptPath,
          record.sourceFrameIndex,
          record.entryKey,
        ),
      );
    }
  }

  if (stabilityWaitFrom !== null) {
    nextIndex = Math.min(nextIndex, stabilityWaitFrom);
  }
  const entries = applyTailSlice(entriesBeforeTailSlice, {
    maxTurns: opts.maxTurns,
    maxBytes: opts.maxBytes,
  });
  const retainedEntries = new Set(entries);
  for (const entry of entriesBeforeTailSlice) {
    if (retainedEntries.has(entry)) continue;
    addCursorRecoveryPointer(
      omittedAssistantEntries,
      seenAssistantPointers,
      cursorRecoveryPointer(
        transcriptPath,
        entry.sourceFrameIndex,
        entry.entryKey,
      ),
    );
  }

  const blockingFrame = scan.blockingFrame ?? analysis.blockingFrame;
  const blockingReason =
    blockingFrame !== null && blockingFrame.frameIndex <= nextIndex
      ? blockingFrame.parseState
      : null;
  const bufferedReason =
    stabilityWaitFrom !== null &&
    (blockingFrame === null || stabilityWaitFrom < blockingFrame.frameIndex)
      ? 'stability-wait'
      : blockingReason;
  const bufferedCount = Math.max(0, scan.totalFrames - nextIndex);
  const bufferedFromIndex = bufferedCount > 0 ? nextIndex : null;
  const renderedFromIndex =
    entries.length > 0
      ? Math.min(...entries.map((entry) => entry.recordIndex))
      : null;
  const renderedToIndex =
    entries.length > 0
      ? Math.max(...entries.map((entry) => entry.recordIndex))
      : null;
  const rawCount = Math.max(0, nextIndex - fromIndex);
  const rawToIndex = rawCount > 0 ? nextIndex - 1 : null;
  const inRawRange = (frameIndex: number) =>
    frameIndex >= fromIndex && frameIndex < nextIndex;
  const toolFrames = new Set<number>();
  let automaticControls = 0;
  let emptyOrNoOp = 0;
  for (const turn of analysis.turns) {
    for (const frameIndex of turn.toolRecordIndexes) {
      if (inRawRange(frameIndex)) toolFrames.add(frameIndex);
    }
    for (const record of turn.assistantRecords) {
      if (!inRawRange(record.sourceFrameIndex)) continue;
      if (record.classification === 'automatic-control') {
        automaticControls += 1;
      } else if (
        record.classification === 'empty' ||
        record.classification === 'no-op'
      ) {
        emptyOrNoOp += 1;
      }
    }
  }
  const accounting: CursorDigestAccountingV2 = {
    indexBase: 'zero-based-jsonl-frame-index',
    raw: {
      fromIndex,
      toIndex: rawToIndex,
      count: rawCount,
      nextIndex,
      totalFrames: scan.totalFrames,
    },
    rendered: {
      count: entries.length,
      fromIndex: renderedFromIndex,
      toIndex: renderedToIndex,
    },
    filtered: {
      toolCalls: toolFrames.size,
      automaticControls,
      emptyOrNoOp,
      metadataFrames: analysis.metadataFrameIndexes.filter(inRawRange).length,
      unstableContent,
    },
    buffered: {
      fromIndex: bufferedFromIndex,
      count: bufferedCount,
      reason: bufferedCount > 0 ? bufferedReason : null,
    },
    recovery: {
      omittedUserMessages,
      omittedAssistantEntries,
    },
  };

  const warnings = [...(opts.warnings ?? [])];
  for (const event of lifecycleEvents) {
    if (event.lifecycle !== 'success') {
      warnings.push(
        `Cursor lifecycle ${event.lifecycle} at frame ${event.terminalFrameIndex}; observed content did not become a successful completion.`,
      );
    }
  }
  if (blockingFrame) {
    warnings.push(
      blockingFrame.parseState === 'malformed'
        ? `Cursor transcript is blocked by malformed frame ${blockingFrame.frameIndex}.`
        : `Cursor transcript has a partial frame at ${blockingFrame.frameIndex}.`,
    );
  }

  const engagement = cursorEngagement(opts);
  const content = entries.length
    ? 'available'
    : suppressedContent
      ? 'suppressed'
      : bufferedCount > 0
        ? 'buffered'
        : 'none';
  const status: CursorDigestV2['cursorEvidence']['status'] = {
    engagement: engagement.status,
    activity: hasAssistantActivity
      ? 'assistant-progress'
      : hasToolActivity
        ? 'tool-activity'
        : hasHumanActivity
          ? 'human-input'
          : 'none',
    content,
    lifecycle: latestLifecycle,
    delivery:
      opts.cursorState?.pendingDelivery !== null &&
      opts.cursorState?.pendingDelivery !== undefined
        ? 'uncertain'
        : opts.cursorState?.lastStatus.delivery === 'uncertain'
          ? 'uncertain'
          : 'none',
    health: blockingFrame?.parseState === 'malformed' ? 'blocked' : 'healthy',
  };
  const filters: DigestFilters = {
    includeToolCalls: opts.includeToolCalls ?? false,
    includeToolResults: opts.includeToolResults ?? false,
    includeCommandMessages: opts.includeCommandMessages ?? false,
  };

  return {
    schemaVersion: 2,
    runtime: 'cursor',
    sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
    transcriptPath,
    recordedCwd: opts.recordedCwd ?? opts.cursorIdentity.canonicalCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    engagement,
    mode: opts.mode ?? 'review',
    range: {
      indexBase: 'zero-based-jsonl-frame-index',
      fromIndex,
      toIndex: rawToIndex,
      nextIndex,
      totalFrames: scan.totalFrames,
      renderedFromIndex,
      renderedToIndex,
      newFrames: rawCount,
    },
    accounting,
    entries,
    filters,
    warnings,
    fallbacks: opts.fallbacks ?? [],
    cursorEvidence: {
      projection: opts.cursorProjection,
      continuity: opts.cursorContinuity,
      status,
      lifecycleEvents,
      bufferedFromFrame: bufferedFromIndex,
      blockingFrame,
    },
  };
}

// ---------------------------------------------------------------------------
// buildDigest
// ---------------------------------------------------------------------------

/**
 * Build a Digest object from a transcript file.
 *
 * @param {'claude-code' | 'codex'} runtime
 * @param {string} transcriptPath
 * @param {object} [opts]
 * @param {number} [opts.fromIndex=0]
 * @param {'review'|'catch-up'|'locate'} [opts.mode='review']
 * @param {boolean} [opts.includeToolCalls=false]
 * @param {boolean} [opts.includeToolResults=false]
 * @param {boolean} [opts.includeCommandMessages=false]
 * @param {number} [opts.maxTurns]
 * @param {number} [opts.maxBytes]
 * @param {string} [opts.sessionId]
 * @param {string} [opts.recordedCwd]
 * @param {string} [opts.matchedTier]
 * @param {string|null} [opts.widenedFrom]
 * @param {boolean} [opts.active]
 * @param {object[]} [opts.fallbacks]
 * @returns {Promise<object>}  Digest
 */
export function buildDigest(
  runtime: 'cursor',
  transcriptPath: string,
  opts: CursorBuildDigestOptions,
): Promise<CursorDigestV2>;
export function buildDigest(
  runtime: Runtime,
  transcriptPath: string,
  opts?: BuildDigestOptions,
): Promise<Digest>;
export async function buildDigest(
  runtime: Runtime,
  transcriptPath: string,
  opts: BuildDigestOptions | CursorBuildDigestOptions = {},
): Promise<SessionDigest> {
  if (runtime === 'cursor' && isCursorBuildDigestOptions(opts)) {
    return buildCursorDigest(transcriptPath, opts);
  }

  const {
    fromIndex = 0,
    mode = 'review',
    includeToolCalls = false,
    includeToolResults = false,
    includeCommandMessages = false,
    maxTurns,
    maxBytes,
    fallbacks = [],
  } = opts;

  const warnings: string[] = [...(opts.warnings ?? [])];

  // Read records
  const records = await readRecords(transcriptPath);
  const totalRecords = records.length;
  const engagement = classifyTranscriptRecords(runtime, records);
  const bootstrapRecordIndexes = new Set(engagement.bootstrapRecordIndexes);

  // Extract metadata
  let sessionId = opts.sessionId;
  let recordedCwd: string | null = opts.recordedCwd ?? null;
  if (!sessionId || recordedCwd === undefined) {
    try {
      const meta = await extractMeta(runtime, transcriptPath);
      if (!sessionId) sessionId = meta?.sessionId ?? 'unknown';
      if (recordedCwd === null && meta?.recordedCwd)
        recordedCwd = meta.recordedCwd;
    } catch {
      if (!sessionId) sessionId = 'unknown';
    }
  }
  sessionId ??= 'unknown';

  // Check for transcript shrinkage
  const effectiveFromIndex = fromIndex > totalRecords ? 0 : fromIndex;
  if (fromIndex > totalRecords && totalRecords > 0) {
    warnings.push(
      `Transcript shrank (stored offset ${fromIndex} > totalRecords ${totalRecords}); reset to 0.`,
    );
  }

  const rawFromIndex = effectiveFromIndex;
  const rawToIndex =
    totalRecords > rawFromIndex ? totalRecords - 1 : rawFromIndex;
  const rawCount = Math.max(0, totalRecords - rawFromIndex);

  // Normalize all records to entries. Keep an unfiltered view for accounting so
  // the digest can explain records consumed but omitted by default filters.
  const allEntriesWithToolsBeforeBootstrap = normalizeEntries(
    runtime,
    records,
    {
      includeToolCalls: true,
      includeToolResults: true,
      includeCommandMessages: true,
    },
  );
  const allEntriesBeforeBootstrap = normalizeEntries(runtime, records, {
    includeToolCalls,
    includeToolResults,
    includeCommandMessages,
  });
  const allEntriesWithTools = allEntriesWithToolsBeforeBootstrap.filter(
    (e) => !bootstrapRecordIndexes.has(e.recordIndex),
  );
  const allEntries = allEntriesBeforeBootstrap.filter(
    (e) => !bootstrapRecordIndexes.has(e.recordIndex),
  );

  // Filter to only entries with recordIndex >= effectiveFromIndex
  const entriesBeforeTailSlice = allEntries.filter(
    (e) => e.recordIndex >= effectiveFromIndex,
  );
  let filteredEntries = entriesBeforeTailSlice;

  // Apply explicit tail-slice first. If the caller did not request a slice and
  // the digest is still huge, fall back to the last few role turns automatically.
  filteredEntries = applyTailSlice(filteredEntries, { maxTurns, maxBytes });
  let autoLargeDigest: DigestAccounting['autoLargeDigest'] = null;
  const explicitTailSlice = Boolean(
    (maxTurns && maxTurns > 0) || (maxBytes && maxBytes > 0),
  );
  if (
    !explicitTailSlice &&
    renderedCharCount(filteredEntries) > LARGE_OUTPUT_THRESHOLD
  ) {
    const beforeCount = filteredEntries.length;
    filteredEntries = applyTailSlice(filteredEntries, {
      maxTurns: AUTO_LARGE_DIGEST_TURNS,
    });
    autoLargeDigest = {
      thresholdChars: LARGE_OUTPUT_THRESHOLD,
      retainedTurnGroups: AUTO_LARGE_DIGEST_TURNS,
      originalRenderedMessages: beforeCount,
      retainedRenderedMessages: filteredEntries.length,
      omittedRenderedMessages: Math.max(
        0,
        beforeCount - filteredEntries.length,
      ),
    };
    warnings.push(
      `Large digest fallback: rendered content exceeded ${LARGE_OUTPUT_THRESHOLD.toLocaleString()} chars; ` +
        `showing the last ${AUTO_LARGE_DIGEST_TURNS} user/assistant turn groups. ` +
        `Use --max-turns, --max-bytes, or --include-command-messages for a different view.`,
    );
  }

  const renderedFromIndex =
    filteredEntries.length > 0
      ? Math.min(...filteredEntries.map((e) => e.recordIndex))
      : null;
  const renderedToIndex =
    filteredEntries.length > 0
      ? Math.max(...filteredEntries.map((e) => e.recordIndex))
      : null;

  const range: DigestRange = {
    indexBase: 'zero-based-jsonl-record-index',
    fromIndex: rawFromIndex,
    toIndex: rawToIndex,
    nextIndex: totalRecords,
    totalRecords,
    renderedFromIndex,
    renderedToIndex,
    newRecords: rawCount,
  };

  const filters: DigestFilters = {
    includeToolCalls,
    includeToolResults,
    includeCommandMessages,
  };
  const fullEntriesInRawRange = allEntriesWithTools.filter(
    (e) => e.recordIndex >= rawFromIndex,
  );
  const fullEntriesInRawRangeBeforeBootstrap =
    allEntriesWithToolsBeforeBootstrap.filter(
      (e) => e.recordIndex >= rawFromIndex,
    );
  const rawRecordIndexesWithAnyEntry = new Set(
    fullEntriesInRawRangeBeforeBootstrap.map((e) => e.recordIndex),
  );
  const rawRecordIndexes = new Set<number>();
  for (let i = rawFromIndex; i < totalRecords; i++) rawRecordIndexes.add(i);

  const accounting: DigestAccounting = {
    indexBase: 'zero-based-jsonl-record-index',
    raw: {
      fromIndex: rawFromIndex,
      toIndex: rawToIndex,
      count: rawCount,
      nextIndex: totalRecords,
      totalRecords,
    },
    rendered: {
      count: filteredEntries.length,
      fromIndex: renderedFromIndex,
      toIndex: renderedToIndex,
    },
    filtered: {
      toolCalls: includeToolCalls
        ? 0
        : fullEntriesInRawRange.filter((e) => e.kind === 'tool_call').length,
      toolResults: includeToolResults
        ? 0
        : fullEntriesInRawRange.filter((e) => e.kind === 'tool_result').length,
      commandMessages: includeCommandMessages
        ? 0
        : fullEntriesInRawRange.filter((e) => e.kind === 'command_message')
            .length,
      bootstrapRecords: [...bootstrapRecordIndexes].filter(
        (index) => index >= rawFromIndex,
      ).length,
      bootstrapMessages: fullEntriesInRawRangeBeforeBootstrap.filter((e) =>
        bootstrapRecordIndexes.has(e.recordIndex),
      ).length,
      metadataRecords: [...rawRecordIndexes].filter(
        (index) => !rawRecordIndexesWithAnyEntry.has(index),
      ).length,
      tailSliceEntries: Math.max(
        0,
        entriesBeforeTailSlice.length - filteredEntries.length,
      ),
    },
    recovery: {
      omittedUserMessages: omittedUserMessageRecoveryPointers(
        entriesBeforeTailSlice,
        filteredEntries,
        transcriptPath,
      ),
    },
    autoLargeDigest,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    runtime,
    sessionId,
    transcriptPath,
    recordedCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    engagement,
    mode,
    range,
    accounting,
    entries: filteredEntries,
    filters,
    warnings,
    fallbacks,
  };
}

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

/**
 * Render a Digest as a markdown string.
 * Groups consecutive same-role entries under a single ### header.
 * Prepends a 20K-char warning if the output exceeds the threshold.
 *
 * @param {object} digest
 * @returns {string}
 */
export function renderMarkdown(digest: SessionDigest): string {
  const parts: string[] = [];

  // Header
  parts.push(
    digest.schemaVersion === 2
      ? formatCursorHeader(digest)
      : formatHeader(digest),
  );

  // Content: group by role
  const groups = groupByRole(digest.entries);

  if (groups.length === 0) {
    parts.push('*No messages in range.*\n');
  } else {
    for (const group of groups) {
      const role = group[0].role;
      const header =
        group[0].displayRole === 'queued-user'
          ? '### User (queued mid-turn)'
          : group[0].displayRole === 'automatic-control'
            ? '### Hook/control (automatic)'
            : role === 'user'
              ? '### User'
              : '### Assistant';
      parts.push(header);
      parts.push('');
      for (const entry of group) {
        if (digest.schemaVersion === 2) {
          const cursorDigestEntry = entry as CursorDigestEntryV2;
          parts.push(
            `*${cursorDigestEntry.availability}; source frame ${cursorDigestEntry.sourceFrameIndex}; entry ${cursorDigestEntry.entryKey}*`,
          );
          parts.push('');
        }
        parts.push(entry.text);
        parts.push('');
      }
    }
  }

  const output = parts.join('\n');

  // Prepend 20K warning if needed
  if (output.length > LARGE_OUTPUT_THRESHOLD) {
    const warning =
      `> **Warning:** This digest is large (${output.length.toLocaleString()} chars). ` +
      `Consider using \`--max-turns\` or \`--max-bytes\` to limit output.\n\n`;
    return warning + output;
  }

  return output;
}

// ---------------------------------------------------------------------------
// renderJson
// ---------------------------------------------------------------------------

/**
 * Render a Digest as a pretty-printed JSON string.
 *
 * @param {object} digest
 * @returns {string}
 */
export function renderJson(digest: SessionDigest): string {
  return JSON.stringify(digest, null, 2);
}
