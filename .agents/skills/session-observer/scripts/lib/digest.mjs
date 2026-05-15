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
 *   maxTurns        {number}  — tail-slice: keep only last N turn groups (review only)
 *   maxBytes        {number}  — tail-slice: keep only tail entries whose cumulative text fits
 *
 * Digest schema (schemaVersion: 1):
 *   { schemaVersion, runtime, sessionId, transcriptPath, recordedCwd,
 *     matchedTier, widenedFrom, active, mode, range, entries, filters, warnings, fallbacks }
 */

import { readRecords, normalizeEntries, extractMeta } from './runtimes.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;
const LARGE_OUTPUT_THRESHOLD = 20_000; // chars

// ---------------------------------------------------------------------------
// applyTailSlice
// ---------------------------------------------------------------------------

/**
 * Slice entries from the tail by maxTurns or maxBytes.
 * Only applied in 'review' mode.
 *
 * @param {object[]} entries  — DigestEntry[]
 * @param {{ maxTurns?: number, maxBytes?: number, mode?: string }} opts
 * @returns {object[]}
 */
function applyTailSlice(entries, opts) {
  const { maxTurns, maxBytes, mode } = opts;
  if (mode !== 'review') return entries;

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
  const { runtime, transcriptPath, recordedCwd, mode, range, filters, active, warnings } = digest;
  const lines = [];
  lines.push(`## session-observer digest`);
  lines.push('');
  lines.push(`**runtime:** ${runtime}`);
  lines.push(`**mode:** ${mode}`);
  if (recordedCwd) lines.push(`**cwd:** ${recordedCwd}`);
  lines.push(`**transcript:** ${transcriptPath}`);
  if (active) lines.push(`**status:** ACTIVE (modified < 60s ago)`);

  // Range info
  lines.push(`**range:** records ${range.fromIndex}–${range.toIndex} of ${range.totalRecords}`);
  if (mode === 'catch-up' && range.newRecords !== undefined) {
    lines.push(`**new records:** ${range.newRecords}`);
  }

  // Filters
  const filterParts = [];
  if (!filters.includeToolCalls) filterParts.push('tool calls excluded');
  if (!filters.includeToolResults) filterParts.push('tool results excluded');
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
    maxTurns,
    maxBytes,
    fallbacks = [],
  } = opts;

  const warnings = [];

  // Read records
  const records = await readRecords(transcriptPath);
  const totalRecords = records.length;

  // Extract metadata
  let sessionId = opts.sessionId;
  let recordedCwd = opts.recordedCwd ?? null;
  if (!sessionId || recordedCwd === undefined) {
    try {
      const meta = await extractMeta(runtime, transcriptPath);
      if (!sessionId) sessionId = meta?.sessionId ?? 'unknown';
      if (recordedCwd === null && meta?.recordedCwd) recordedCwd = meta.recordedCwd;
    } catch {
      if (!sessionId) sessionId = 'unknown';
    }
  }

  // Check for transcript shrinkage
  const effectiveFromIndex = fromIndex > totalRecords ? 0 : fromIndex;
  if (fromIndex > totalRecords && totalRecords > 0) {
    warnings.push(`Transcript shrank (stored offset ${fromIndex} > totalRecords ${totalRecords}); reset to 0.`);
  }

  // Normalize all records to entries
  const allEntries = normalizeEntries(runtime, records, { includeToolCalls, includeToolResults });

  // Filter to only entries with recordIndex >= effectiveFromIndex
  let filteredEntries = allEntries.filter(e => e.recordIndex >= effectiveFromIndex);

  // Apply tail-slice (review mode only)
  filteredEntries = applyTailSlice(filteredEntries, { maxTurns, maxBytes, mode });

  // Compute range
  const toIndex = filteredEntries.length > 0
    ? Math.max(...filteredEntries.map(e => e.recordIndex))
    : effectiveFromIndex;

  const range = {
    fromIndex: effectiveFromIndex,
    toIndex,
    totalRecords,
  };

  if (mode === 'catch-up') {
    range.newRecords = totalRecords - effectiveFromIndex;
  }

  const filters = { includeToolCalls, includeToolResults };

  return {
    schemaVersion: SCHEMA_VERSION,
    runtime,
    sessionId,
    transcriptPath,
    recordedCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    mode,
    range,
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
