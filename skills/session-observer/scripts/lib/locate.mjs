/**
 * locate.mjs — Candidate transcript discovery for a given (runtime, cwd).
 *
 * Exports:
 *   discover(runtime, targetCwd)  → Promise<Candidate[]>
 *   gitWorktrees(cwd)             → Promise<string[]>
 *
 * Candidate shape:
 *   { runtime, transcriptPath, sessionId, recordedCwd, mtime, size, ageSec }
 *
 * Strategy:
 *   Claude Code:
 *     1. Encode targetCwd → known dir-name variants via encodeCwdVariants.
 *     2. Check if ~/.claude/projects/<encoded>/ exists for each variant.
 *     3a. If yes: read *.jsonl files from that dir (guaranteed exact-cwd match).
 *         For these, set recordedCwd = targetCwd directly (not a lossy decode).
 *     3b. If no: glob ~/.claude/projects/*\/*.jsonl and check approximate decoded cwd.
 *
 *   Codex:
 *     1. Glob ~/.codex/sessions/**\/*.jsonl within LOOKBACK_DAYS.
 *     2. For each, check mtime against LOOKBACK_DAYS cutoff.
 *     3. Extract cwd from session-meta record, using the cwd cache to avoid re-parsing.
 *
 *   Cursor:
 *     1. Encode targetCwd → ~/.cursor/projects/<encoded>/agent-transcripts.
 *     2. Read one-level nested JSONL files below the direct transcripts dir and
 *        mark exact cwd evidence.
 *     3. If no direct dir exists, scan all project slugs under ~/.cursor/projects
 *        within LOOKBACK_DAYS and preserve cwdSlug as weak ranking evidence.
 */

import { execFile } from 'node:child_process';
import { readdir, stat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { promisify } from 'node:util';

import { discoverPaths, encodeCwdVariants, extractMeta } from './runtimes.mjs';
import {
  classifyTranscript,
  engagementCandidateFields,
} from './session-classifier.mjs';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 7;

async function candidateEngagementFields(runtime, transcriptPath) {
  try {
    return engagementCandidateFields(
      await classifyTranscript(runtime, transcriptPath),
    );
  } catch {
    return engagementCandidateFields({
      status: 'unknown',
      engaged: true,
      recordCount: null,
      genuineUserMessages: 0,
      syntheticUserMessages: 0,
      assistantMessages: 0,
      realMessageCount: 0,
      hasAssistantAndUser: false,
      bootstrapRecordIndexes: [],
      bootstrapRecordCount: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Codex CWD cache helpers
// ---------------------------------------------------------------------------

/**
 * Returns the path to the codex-cwd-cache.json file.
 * Reads STATE_DIR from environment (same convention as state.mjs).
 * @returns {string}
 */
function cwdCachePath() {
  const stateDir =
    process.env.STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer');
  return join(stateDir, 'codex-cwd-cache.json');
}

/**
 * Load the codex cwd cache from disk.
 * Returns an empty object on any read/parse error.
 * @returns {Promise<Record<string, { recordedCwd: string | null, sessionId?: string }>>}
 */
async function loadCwdCache() {
  try {
    const raw = await readFile(cwdCachePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Persist the codex cwd cache to disk.
 * Creates the state dir if needed. Silently drops errors.
 * @param {Record<string, { recordedCwd: string }>} cache
 */
async function saveCwdCache(cache) {
  try {
    const path = cwdCachePath();
    const stateDir = path.replace(/\/[^/]+$/, '');
    await mkdir(stateDir, { recursive: true });
    await writeFile(path, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Cache is best-effort; ignore write failures.
  }
}

/**
 * Build the cache key for a transcript + mtime pair.
 * @param {string} transcriptPath
 * @param {number} mtimeSec  — epoch seconds (integer)
 * @returns {string}
 */
function cwdCacheKey(transcriptPath, mtimeSec) {
  return `${transcriptPath}:${mtimeSec}`;
}

// ---------------------------------------------------------------------------
// discover — Claude Code
// ---------------------------------------------------------------------------

/**
 * Discover Claude Code transcript candidates for a target cwd.
 *
 * @param {string} targetCwd
 * @returns {Promise<object[]>} Candidate[]
 */
async function discoverClaudeCode(targetCwd) {
  const [projectsRoot] = discoverPaths('claude-code');
  const encodedVariants = encodeCwdVariants('claude-code', targetCwd);

  const now = Date.now() / 1000;
  const candidates = [];
  const seenTranscripts = new Set();

  let directHit = false;
  for (const encoded of encodedVariants) {
    const encodedDir = join(projectsRoot, encoded);
    try {
      const entries = await readdir(encodedDir);
      const jsonlFiles = entries.filter((e) => e.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const transcriptPath = join(encodedDir, file);
        if (seenTranscripts.has(transcriptPath)) continue;
        seenTranscripts.add(transcriptPath);

        let fileStat;
        try {
          fileStat = await stat(transcriptPath);
        } catch {
          continue;
        }

        const mtime = Math.floor(fileStat.mtime.getTime() / 1000);
        const ageSec = now - mtime;

        let meta;
        try {
          meta = await extractMeta('claude-code', transcriptPath);
        } catch {
          meta = null;
        }

        const sessionId =
          meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, '');

        candidates.push({
          runtime: 'claude-code',
          transcriptPath,
          sessionId,
          // Guaranteed exact match: do NOT use decodeCwdDirName (lossy).
          recordedCwd: targetCwd,
          cwdSlug: encoded,
          cwdEvidence: 'direct-parent-dir',
          mtime,
          size: fileStat.size,
          ageSec,
          ...(await candidateEngagementFields('claude-code', transcriptPath)),
        });
      }
      directHit = true;
    } catch {
      // This slug variant doesn't exist — keep trying other known variants.
    }
  }

  if (!directHit) {
    // Glob fallback: scan all project dirs
    let projectDirs = [];
    try {
      projectDirs = await readdir(projectsRoot);
    } catch {
      // projects root doesn't exist
      return candidates;
    }

    for (const dirName of projectDirs) {
      if (encodedVariants.includes(dirName)) continue; // already tried
      const projectDir = join(projectsRoot, dirName);

      let dirEntries;
      try {
        dirEntries = await readdir(projectDir);
      } catch {
        continue;
      }

      const jsonlFiles = dirEntries.filter((e) => e.endsWith('.jsonl'));
      for (const file of jsonlFiles) {
        const transcriptPath = join(projectDir, file);
        if (seenTranscripts.has(transcriptPath)) continue;
        seenTranscripts.add(transcriptPath);

        let fileStat;
        try {
          fileStat = await stat(transcriptPath);
        } catch {
          continue;
        }

        const mtime = Math.floor(fileStat.mtime.getTime() / 1000);
        const ageSec = now - mtime;

        let meta;
        try {
          meta = await extractMeta('claude-code', transcriptPath);
        } catch {
          meta = null;
        }

        const sessionId =
          meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, '');
        // Glob fallback: recordedCwd comes from the (approximate) decode
        const recordedCwd = meta?.recordedCwd ?? null;

        candidates.push({
          runtime: 'claude-code',
          transcriptPath,
          sessionId,
          recordedCwd,
          cwdSlug: dirName,
          cwdEvidence: 'decoded-parent-dir',
          mtime,
          size: fileStat.size,
          ageSec,
          ...(await candidateEngagementFields('claude-code', transcriptPath)),
        });
      }
    }
  }

  return candidates;
}

/**
 * Return Claude Code direct lookup diagnostics for `locate --debug`.
 *
 * @param {string} targetCwd
 * @returns {Promise<Array<{ encoded: string, path: string, exists: boolean }>>}
 */
export async function claudeCodeLookupDiagnostics(targetCwd) {
  const [projectsRoot] = discoverPaths('claude-code');
  const diagnostics = [];
  for (const encoded of encodeCwdVariants('claude-code', targetCwd)) {
    const path = join(projectsRoot, encoded);
    let exists = false;
    try {
      const s = await stat(path);
      exists = s.isDirectory();
    } catch {
      exists = false;
    }
    diagnostics.push({ encoded, path, exists });
  }
  return diagnostics;
}

// ---------------------------------------------------------------------------
// discover — Codex
// ---------------------------------------------------------------------------

/**
 * Recursively collect all *.jsonl files from a directory tree.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectJsonlFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJsonlFiles(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Discover Codex transcript candidates for a target cwd.
 * Uses a cwd-cache keyed by (transcriptPath:mtime) to avoid re-parsing.
 *
 * @param {string} targetCwd
 * @returns {Promise<object[]>} Candidate[]
 */
async function discoverCodex(_targetCwd) {
  const [sessionsRoot] = discoverPaths('codex');
  const now = Date.now() / 1000;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;

  // Collect all jsonl files under sessionsRoot
  const allFiles = await collectJsonlFiles(sessionsRoot);

  const cache = await loadCwdCache();
  let cacheModified = false;

  const candidates = [];

  for (const transcriptPath of allFiles) {
    let fileStat;
    try {
      fileStat = await stat(transcriptPath);
    } catch {
      continue;
    }

    const mtime = Math.floor(fileStat.mtime.getTime() / 1000);

    // Apply LOOKBACK_DAYS filter
    if (mtime < cutoffSec) continue;

    const ageSec = now - mtime;
    const key = cwdCacheKey(transcriptPath, mtime);

    let recordedCwd;
    let sessionId;
    if (cache[key] && cache[key].sessionId !== undefined) {
      // Cache hit: use cached values for both recordedCwd and sessionId
      recordedCwd = cache[key].recordedCwd;
      sessionId = cache[key].sessionId;
    } else {
      // Cache miss: parse the transcript
      let meta;
      try {
        meta = await extractMeta('codex', transcriptPath);
      } catch {
        meta = null;
      }
      recordedCwd = meta?.recordedCwd ?? null;
      sessionId =
        meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, '');

      // Populate cache with both recordedCwd and sessionId
      cache[key] = { recordedCwd, sessionId };
      cacheModified = true;
    }

    candidates.push({
      runtime: 'codex',
      transcriptPath,
      sessionId,
      recordedCwd,
      mtime,
      size: fileStat.size,
      ageSec,
      ...(await candidateEngagementFields('codex', transcriptPath)),
    });
  }

  if (cacheModified) {
    await saveCwdCache(cache);
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// discover — Cursor
// ---------------------------------------------------------------------------

/**
 * Collect Cursor agent transcript paths from one-level nested session dirs.
 *
 * @param {string} transcriptsRoot
 * @returns {Promise<string[]>}
 */
async function collectCursorAgentTranscripts(transcriptsRoot) {
  const results = [];
  let sessionDirs;
  try {
    sessionDirs = await readdir(transcriptsRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const sessionDir of sessionDirs) {
    if (!sessionDir.isDirectory()) continue;
    const sessionPath = join(transcriptsRoot, sessionDir.name);

    let entries;
    try {
      entries = await readdir(sessionPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(join(sessionPath, entry.name));
      }
    }
  }

  return results;
}

/**
 * Build a Cursor candidate from a transcript path.
 *
 * @param {string} transcriptPath
 * @param {number} now
 * @param {object} evidence
 * @param {string | null} evidence.recordedCwd
 * @param {string} evidence.cwdSlug
 * @param {string} evidence.cwdEvidence
 * @param {import('node:fs').Stats | null} [fileStat]
 * @returns {Promise<object | null>}
 */
async function cursorCandidate(transcriptPath, now, evidence, fileStat = null) {
  let resolvedStat = fileStat;
  if (!resolvedStat) {
    try {
      resolvedStat = await stat(transcriptPath);
    } catch {
      return null;
    }
  }

  const mtime = Math.floor(resolvedStat.mtime.getTime() / 1000);
  const ageSec = now - mtime;

  let meta;
  try {
    meta = await extractMeta('cursor', transcriptPath);
  } catch {
    meta = null;
  }

  return {
    runtime: 'cursor',
    transcriptPath,
    sessionId:
      meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, ''),
    recordedCwd: evidence.recordedCwd,
    cwdSlug: evidence.cwdSlug,
    cwdEvidence: evidence.cwdEvidence,
    mtime,
    size: resolvedStat.size,
    ageSec,
    ...(await candidateEngagementFields('cursor', transcriptPath)),
  };
}

/**
 * Discover Cursor transcript candidates for a target cwd.
 *
 * @param {string} targetCwd
 * @returns {Promise<object[]>} Candidate[]
 */
async function discoverCursor(targetCwd) {
  const [projectsRoot] = discoverPaths('cursor');
  const encodedVariants = encodeCwdVariants('cursor', targetCwd);
  const now = Date.now() / 1000;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;

  const candidates = [];
  const seenTranscripts = new Set();
  let directHit = false;

  // Cursor direct lookup is intentionally transcript-based, not directory-based:
  // an encoded project dir can exist before it contains usable agent JSONL, so
  // an empty direct dir should still fall through to the fallback project scan.
  for (const encoded of encodedVariants) {
    const transcriptsRoot = join(projectsRoot, encoded, 'agent-transcripts');
    const transcriptPaths =
      await collectCursorAgentTranscripts(transcriptsRoot);
    if (transcriptPaths.length === 0) continue;

    directHit = true;
    for (const transcriptPath of transcriptPaths) {
      if (seenTranscripts.has(transcriptPath)) continue;
      seenTranscripts.add(transcriptPath);

      const candidate = await cursorCandidate(transcriptPath, now, {
        recordedCwd: targetCwd,
        cwdSlug: encoded,
        cwdEvidence: 'direct-parent-dir',
      });
      if (candidate) candidates.push(candidate);
    }
  }

  if (directHit) return candidates;

  let projectDirs = [];
  try {
    projectDirs = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return candidates;
  }

  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue;
    if (encodedVariants.includes(projectDir.name)) continue;

    const transcriptsRoot = join(
      projectsRoot,
      projectDir.name,
      'agent-transcripts',
    );
    const transcriptPaths =
      await collectCursorAgentTranscripts(transcriptsRoot);

    for (const transcriptPath of transcriptPaths) {
      if (seenTranscripts.has(transcriptPath)) continue;
      seenTranscripts.add(transcriptPath);

      let fileStat;
      try {
        fileStat = await stat(transcriptPath);
      } catch {
        continue;
      }

      const mtime = Math.floor(fileStat.mtime.getTime() / 1000);
      if (mtime < cutoffSec) continue;

      const candidate = await cursorCandidate(
        transcriptPath,
        now,
        {
          recordedCwd: null,
          cwdSlug: projectDir.name,
          cwdEvidence: 'project-dir-slug',
        },
        fileStat,
      );
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover candidate transcripts for the given runtime and target cwd.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {string} targetCwd
 * @returns {Promise<object[]>} Candidate[]
 */
export async function discover(runtime, targetCwd) {
  if (runtime === 'claude-code') return discoverClaudeCode(targetCwd);
  if (runtime === 'codex') return discoverCodex(targetCwd);
  if (runtime === 'cursor') return discoverCursor(targetCwd);
  throw new Error(`Unknown runtime: ${runtime}`);
}

/**
 * Enumerate sister git worktrees for the given cwd.
 * Shells out to `git worktree list --porcelain` and parses `worktree <path>` lines.
 * Returns [] on any error (not a git repo, git not in PATH, etc.).
 *
 * @param {string} cwd
 * @returns {Promise<string[]>}
 */
export async function gitWorktrees(cwd) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'worktree', 'list', '--porcelain'],
      {
        timeout: 5000,
      },
    );
    const paths = [];
    for (const line of stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        paths.push(line.slice('worktree '.length).trim());
      }
    }
    return paths;
  } catch {
    return [];
  }
}
