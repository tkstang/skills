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
 *     1. Encode targetCwd → dir name via encodeCwd.
 *     2. Check if ~/.claude/projects/<encoded>/ exists.
 *     3a. If yes: read *.jsonl files from that dir (guaranteed exact-cwd match).
 *         For these, set recordedCwd = targetCwd directly (not a lossy decode).
 *     3b. If no: glob ~/.claude/projects/*\/*.jsonl and check approximate decoded cwd.
 *
 *   Codex:
 *     1. Glob ~/.codex/sessions/**\/*.jsonl within LOOKBACK_DAYS.
 *     2. For each, check mtime against LOOKBACK_DAYS cutoff.
 *     3. Extract cwd from session-meta record, using the cwd cache to avoid re-parsing.
 */

import { readdir, stat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { discoverPaths, encodeCwd, extractMeta } from './runtimes.mjs';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 7;

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
    process.env.STATE_DIR ?? join(homedir(), '.local', 'state', 'session-observer');
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
  const encoded = encodeCwd('claude-code', targetCwd);
  const encodedDir = join(projectsRoot, encoded);

  const now = Date.now() / 1000;
  const candidates = [];

  // Try the direct encoded-dir lookup first
  let directHit = false;
  try {
    const entries = await readdir(encodedDir);
    const jsonlFiles = entries.filter(e => e.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const transcriptPath = join(encodedDir, file);
      let fileStat;
      try {
        fileStat = await stat(transcriptPath);
      } catch {
        continue;
      }

      const mtime = Math.floor(fileStat.mtime.getTime() / 1000);
      const ageSec = now - mtime;

      // Extract sessionId — for direct hits, recordedCwd is definitively targetCwd
      let meta;
      try {
        meta = await extractMeta('claude-code', transcriptPath);
      } catch {
        meta = null;
      }

      const sessionId = meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, '');

      candidates.push({
        runtime: 'claude-code',
        transcriptPath,
        sessionId,
        // Guaranteed exact match: do NOT use decodeCwdDirName (lossy).
        recordedCwd: targetCwd,
        mtime,
        size: fileStat.size,
        ageSec,
      });
    }
    directHit = true;
  } catch {
    // encodedDir doesn't exist — fall through to glob fallback
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
      if (dirName === encoded) continue; // already tried (but didn't exist)
      const projectDir = join(projectsRoot, dirName);

      let dirEntries;
      try {
        dirEntries = await readdir(projectDir);
      } catch {
        continue;
      }

      const jsonlFiles = dirEntries.filter(e => e.endsWith('.jsonl'));
      for (const file of jsonlFiles) {
        const transcriptPath = join(projectDir, file);
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

        const sessionId = meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, '');
        // Glob fallback: recordedCwd comes from the (approximate) decode
        const recordedCwd = meta?.recordedCwd ?? null;

        candidates.push({
          runtime: 'claude-code',
          transcriptPath,
          sessionId,
          recordedCwd,
          mtime,
          size: fileStat.size,
          ageSec,
        });
      }
    }
  }

  return candidates;
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
async function discoverCodex(targetCwd) {
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
      sessionId = meta?.sessionId ?? basename(transcriptPath).replace(/\.jsonl$/, '');

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
    });
  }

  if (cacheModified) {
    await saveCwdCache(cache);
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover candidate transcripts for the given runtime and target cwd.
 *
 * @param {'claude-code' | 'codex'} runtime
 * @param {string} targetCwd
 * @returns {Promise<object[]>} Candidate[]
 */
export async function discover(runtime, targetCwd) {
  if (runtime === 'claude-code') return discoverClaudeCode(targetCwd);
  if (runtime === 'codex') return discoverCodex(targetCwd);
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
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'worktree', 'list', '--porcelain'], {
      timeout: 5000,
    });
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
