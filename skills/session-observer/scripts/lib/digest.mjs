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

import { readRecords, normalizeEntries, extractMeta } from './runtimes.mjs';
import { classifyTranscriptRecords } from './session-classifier.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;
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
function applyTailSlice(entries, opts) {
  const { maxTurns, maxBytes } = opts;

  if (maxBytes && maxBytes > 0) {
    // Walk from the tail, accumulate byte count, include entries until we exceed maxBytes
    let cumBytes = 0;
    const result = [];
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

function renderedCharCount(entries) {
  return entries.reduce((sum, entry) => sum + (entry.text?.length ?? 0), 0);
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
function groupByRole(entries) {
  if (entries.length === 0) return [];
  const groups = [];
  let currentGroup = [entries[0]];

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].role === currentGroup[0].role) {
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
function formatHeader(digest) {
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
  const lines = [];
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
    const filterParts = [];
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

  // Filters
  const filterParts = [];
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
export async function buildDigest(runtime, transcriptPath, opts = {}) {
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

  const warnings = [...(opts.warnings ?? [])];

  // Read records
  const records = await readRecords(transcriptPath);
  const totalRecords = records.length;
  const engagement = classifyTranscriptRecords(runtime, records);
  const bootstrapRecordIndexes = new Set(engagement.bootstrapRecordIndexes);

  // Extract metadata
  let sessionId = opts.sessionId;
  let recordedCwd = opts.recordedCwd ?? null;
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
  let autoLargeDigest = null;
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

  const range = {
    indexBase: 'zero-based-jsonl-record-index',
    fromIndex: rawFromIndex,
    toIndex: rawToIndex,
    nextIndex: totalRecords,
    totalRecords,
    renderedFromIndex,
    renderedToIndex,
  };

  if (mode === 'catch-up') {
    range.newRecords = rawCount;
  } else {
    range.newRecords = rawCount;
  }

  const filters = {
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
  const rawRecordIndexes = new Set();
  for (let i = rawFromIndex; i < totalRecords; i++) rawRecordIndexes.add(i);

  const accounting = {
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
export function renderMarkdown(digest) {
  const parts = [];

  // Header
  parts.push(formatHeader(digest));

  // Content: group by role
  const groups = groupByRole(digest.entries);

  if (groups.length === 0) {
    parts.push('*No messages in range.*\n');
  } else {
    for (const group of groups) {
      const role = group[0].role;
      const header = role === 'user' ? '### User' : '### Assistant';
      parts.push(header);
      parts.push('');
      for (const entry of group) {
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
export function renderJson(digest) {
  return JSON.stringify(digest, null, 2);
}
