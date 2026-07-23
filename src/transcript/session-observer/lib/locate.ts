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
import { randomUUID } from 'node:crypto';
import type { Dirent, Stats } from 'node:fs';
import {
  readdir,
  stat,
  mkdir,
  readFile,
  rename,
  open,
  unlink,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { promisify } from 'node:util';

import type { Runtime } from '../../core/runtimes.js';
import {
  discoverPaths,
  encodeCwdVariants,
  extractMeta,
} from '../../core/runtimes.js';
import {
  classifyTranscript,
  engagementCandidateFields,
} from './session-classifier.js';
import type {
  EngagementCandidateFields,
  TranscriptCandidate,
  TranscriptClassification,
} from './types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 7;

// ---------------------------------------------------------------------------
// Classification cache — (path, mtimeMs, size) keyed, process-lifetime,
// size-capped. Discovery classifies every candidate transcript in a project
// directory on every call; the watch loop calls discovery on every poll
// tick, so unchanged past-session transcripts were being fully re-read and
// re-parsed every 2s for the life of the watch. A transcript's classification
// is deterministic given its content, and (mtimeMs, size) is this codebase's
// established change signature (see watch.ts's FileSignature), so a
// signature-keyed cache is a safe, transparent memoization: a hit returns
// byte-identical results to a fresh classify, and any content change (which
// always changes size, and in practice mtime too) invalidates it.
//
// Residual edge: a same-size, same-mtime rewrite on a coarse-mtime
// filesystem (e.g. some network/FAT filesystems truncate to 1-2s
// resolution) could in theory be missed. This is judged acceptable here:
// the cached candidates are past, non-watched sessions that are not
// expected to be rewritten in place during a live watch.
//
// Ownership: `discover()` accepts an optional cache and defaults to a fresh
// per-call instance, so one-shot callers (locate/observe) are unaffected.
// The watch loop (watch.ts) owns one instance for its process lifetime and
// threads it through every tick via `findNewerSameCwdCandidates`.
// ---------------------------------------------------------------------------

const DEFAULT_CLASSIFICATION_CACHE_MAX_ENTRIES = 300;

interface ClassificationCacheEntry {
  mtimeMs: number;
  size: number;
  result: TranscriptClassification;
}

/**
 * In-memory classification cache keyed by transcript path, guarded by a
 * (mtimeMs, size) signature. Bounded to `maxEntries`, evicting the least
 * recently used entry (insertion-ordered Map; a hit or write re-inserts at
 * the end) once the bound is exceeded.
 */
export class ClassificationCache {
  private readonly maxEntries: number;
  private readonly entries = new Map<string, ClassificationCacheEntry>();

  constructor(
    maxEntries: number = DEFAULT_CLASSIFICATION_CACHE_MAX_ENTRIES,
  ) {
    this.maxEntries = maxEntries;
  }

  get(
    transcriptPath: string,
    mtimeMs: number,
    size: number,
  ): TranscriptClassification | undefined {
    const entry = this.entries.get(transcriptPath);
    if (!entry) return undefined;
    if (entry.mtimeMs !== mtimeMs || entry.size !== size) {
      // Stale signature (the file changed) — drop it lazily.
      this.entries.delete(transcriptPath);
      return undefined;
    }
    // Bump recency: re-insert at the end so eviction drops the true LRU.
    this.entries.delete(transcriptPath);
    this.entries.set(transcriptPath, entry);
    return entry.result;
  }

  set(
    transcriptPath: string,
    mtimeMs: number,
    size: number,
    result: TranscriptClassification,
  ): void {
    this.entries.delete(transcriptPath);
    this.entries.set(transcriptPath, { mtimeMs, size, result });
    if (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

async function candidateEngagementFields(
  runtime: Runtime,
  transcriptPath: string,
  signature: { mtimeMs: number; size: number },
  cache: ClassificationCache,
): Promise<EngagementCandidateFields> {
  try {
    const cached = cache.get(
      transcriptPath,
      signature.mtimeMs,
      signature.size,
    );
    if (cached) return engagementCandidateFields(cached);
    const classification = await classifyTranscript(runtime, transcriptPath);
    cache.set(
      transcriptPath,
      signature.mtimeMs,
      signature.size,
      classification,
    );
    return engagementCandidateFields(classification);
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

interface CwdCacheEntry {
  recordedCwd: string | null;
  sessionId?: string;
}

type CwdCache = Record<string, CwdCacheEntry>;

interface ClaudeLookupDiagnostic {
  encoded: string;
  path: string;
  exists: boolean;
}

interface CursorCandidateEvidence {
  recordedCwd: string | null;
  cwdSlug: string;
  cwdEvidence: string;
}

/**
 * Returns the path to the codex-cwd-cache.json file.
 * Reads STATE_DIR from environment (same convention as state.mjs).
 * @returns {string}
 */
function cwdCachePath(): string {
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
async function loadCwdCache(): Promise<CwdCache> {
  try {
    const raw = await readFile(cwdCachePath(), 'utf8');
    return JSON.parse(raw) as CwdCache;
  } catch {
    return {};
  }
}

/**
 * Persist the codex cwd cache to disk atomically (temp file + rename), like
 * the module family's other state files (see state.ts's writeState). This is
 * a soft, unlocked cache — no lock protocol is added here, only atomicity —
 * so concurrent writers may still race on the final rename, but neither can
 * ever observe a partially-written file.
 * Creates the state dir if needed. Silently drops errors (best-effort).
 * @param {Record<string, { recordedCwd: string }>} cache
 */
async function saveCwdCache(cache: CwdCache): Promise<void> {
  try {
    const path = cwdCachePath();
    const dir = path.replace(/\/[^/]+$/, '');
    await mkdir(dir, { recursive: true });
    // pid + timestamp + a random component: two concurrent saves in the same
    // process landing in the same millisecond must not collide on this path
    // (a collision would let one writer's rename observe the other's
    // still-open tmp file, defeating atomicity).
    const tmp = join(
      dir,
      `codex-cwd-cache.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
    );
    let fh;
    try {
      fh = await open(tmp, 'w');
      await fh.write(JSON.stringify(cache, null, 2));
      await fh.datasync();
      await fh.close();
      fh = null;
      await rename(tmp, path);
    } finally {
      if (fh) {
        try {
          await fh.close();
        } catch {
          /* ignore */
        }
      }
      try {
        await unlink(tmp);
      } catch {
        /* ignore ENOENT (rename succeeded, or tmp was never created) */
      }
    }
  } catch {
    // Cache is best-effort; ignore write failures (create, write, or rename).
  }
}

/**
 * Build the cache key for a transcript + mtime pair.
 * @param {string} transcriptPath
 * @param {number} mtimeSec  — epoch seconds (integer)
 * @returns {string}
 */
function cwdCacheKey(transcriptPath: string, mtimeSec: number): string {
  return `${transcriptPath}:${mtimeSec}`;
}

// ---------------------------------------------------------------------------
// discover — Claude Code
// ---------------------------------------------------------------------------

/**
 * Discover Claude Code transcript candidates for a target cwd.
 *
 * @param {string} targetCwd
 * @param {ClassificationCache} cache
 * @returns {Promise<object[]>} Candidate[]
 */
async function discoverClaudeCode(
  targetCwd: string,
  cache: ClassificationCache,
): Promise<TranscriptCandidate[]> {
  const [projectsRoot] = discoverPaths('claude-code');
  const encodedVariants = encodeCwdVariants('claude-code', targetCwd);

  const now = Date.now() / 1000;
  const candidates: TranscriptCandidate[] = [];
  const seenTranscripts = new Set<string>();

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
          ...(await candidateEngagementFields(
            'claude-code',
            transcriptPath,
            fileStat,
            cache,
          )),
        });
      }
      directHit = true;
    } catch {
      // This slug variant doesn't exist — keep trying other known variants.
    }
  }

  if (!directHit) {
    // Glob fallback: scan all project dirs
    let projectDirs: string[] = [];
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
          ...(await candidateEngagementFields(
            'claude-code',
            transcriptPath,
            fileStat,
            cache,
          )),
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
export async function claudeCodeLookupDiagnostics(
  targetCwd: string,
): Promise<ClaudeLookupDiagnostic[]> {
  const [projectsRoot] = discoverPaths('claude-code');
  const diagnostics: ClaudeLookupDiagnostic[] = [];
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
async function collectJsonlFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
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
 * @param {ClassificationCache} classificationCache
 * @returns {Promise<object[]>} Candidate[]
 */
async function discoverCodex(
  _targetCwd: string,
  classificationCache: ClassificationCache,
): Promise<TranscriptCandidate[]> {
  const [sessionsRoot] = discoverPaths('codex');
  const now = Date.now() / 1000;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;

  // Collect all jsonl files under sessionsRoot
  const allFiles = await collectJsonlFiles(sessionsRoot);

  const cwdCache = await loadCwdCache();
  let cacheModified = false;

  const candidates: TranscriptCandidate[] = [];

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

    let recordedCwd: string | null;
    let sessionId: string;
    if (cwdCache[key] && cwdCache[key].sessionId !== undefined) {
      // Cache hit: use cached values for both recordedCwd and sessionId
      recordedCwd = cwdCache[key].recordedCwd;
      sessionId = cwdCache[key].sessionId;
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
      cwdCache[key] = { recordedCwd, sessionId };
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
      ...(await candidateEngagementFields(
        'codex',
        transcriptPath,
        fileStat,
        classificationCache,
      )),
    });
  }

  if (cacheModified) {
    await saveCwdCache(cwdCache);
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
async function collectCursorAgentTranscripts(
  transcriptsRoot: string,
): Promise<string[]> {
  const results: string[] = [];
  let sessionDirs: Dirent[];
  try {
    sessionDirs = await readdir(transcriptsRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const sessionDir of sessionDirs) {
    if (!sessionDir.isDirectory()) continue;
    const sessionPath = join(transcriptsRoot, sessionDir.name);

    let entries: Dirent[];
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
 * @param {ClassificationCache} cache
 * @returns {Promise<object | null>}
 */
async function cursorCandidate(
  transcriptPath: string,
  now: number,
  evidence: CursorCandidateEvidence,
  fileStat: Stats | null,
  cache: ClassificationCache,
): Promise<TranscriptCandidate | null> {
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
    ...(await candidateEngagementFields(
      'cursor',
      transcriptPath,
      resolvedStat,
      cache,
    )),
  };
}

/**
 * Discover Cursor transcript candidates for a target cwd.
 *
 * @param {string} targetCwd
 * @param {ClassificationCache} cache
 * @returns {Promise<object[]>} Candidate[]
 */
async function discoverCursor(
  targetCwd: string,
  cache: ClassificationCache,
): Promise<TranscriptCandidate[]> {
  const [projectsRoot] = discoverPaths('cursor');
  const encodedVariants = encodeCwdVariants('cursor', targetCwd);
  const now = Date.now() / 1000;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;

  const candidates: TranscriptCandidate[] = [];
  const seenTranscripts = new Set<string>();
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

      const candidate = await cursorCandidate(
        transcriptPath,
        now,
        {
          recordedCwd: targetCwd,
          cwdSlug: encoded,
          cwdEvidence: 'direct-parent-dir',
        },
        null,
        cache,
      );
      if (candidate) candidates.push(candidate);
    }
  }

  if (directHit) return candidates;

  let projectDirs: Dirent[] = [];
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
        cache,
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
 * `cache` is an optional classification cache (see `ClassificationCache`
 * above). Omit it for one-shot callers — a fresh per-call instance is used,
 * which keeps single-call semantics identical to the uncached behavior since
 * nothing outlives the call. Long-lived callers (the watch loop) should
 * create one instance and pass it on every call so unchanged candidates
 * across repeated calls are classified once.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {string} targetCwd
 * @param {ClassificationCache} [cache]
 * @returns {Promise<object[]>} Candidate[]
 */
export async function discover(
  runtime: Runtime,
  targetCwd: string,
  cache: ClassificationCache = new ClassificationCache(),
): Promise<TranscriptCandidate[]> {
  if (runtime === 'claude-code') return discoverClaudeCode(targetCwd, cache);
  if (runtime === 'codex') return discoverCodex(targetCwd, cache);
  if (runtime === 'cursor') return discoverCursor(targetCwd, cache);
  throw new Error(`Unknown runtime: ${runtime}`);
}

/** Find one exact session among the same-cwd candidates for a runtime. */
export async function findSessionCandidate(
  runtime: Runtime,
  targetCwd: string,
  sessionId: string,
): Promise<TranscriptCandidate | null> {
  const matches = (await discover(runtime, targetCwd)).filter(
    (candidate) =>
      candidate.recordedCwd === targetCwd && candidate.sessionId === sessionId,
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Return same-cwd sessions that are more recently modified than a watched pin.
 * The watcher remains responsible for deciding whether and how to report them.
 *
 * @param {ClassificationCache} [cache] See `discover`'s cache parameter.
 */
export async function findNewerSameCwdCandidates(
  runtime: Runtime,
  targetCwd: string,
  watched: Pick<TranscriptCandidate, 'sessionId' | 'transcriptPath' | 'mtime'>,
  cache: ClassificationCache = new ClassificationCache(),
): Promise<TranscriptCandidate[]> {
  const candidates = await discover(runtime, targetCwd, cache);
  return candidates
    .filter(
      (candidate) =>
        candidate.recordedCwd === targetCwd &&
        candidate.sessionId !== watched.sessionId &&
        candidate.transcriptPath !== watched.transcriptPath &&
        candidate.mtime > watched.mtime,
    )
    .toSorted(
      (left, right) =>
        right.mtime - left.mtime ||
        left.transcriptPath.localeCompare(right.transcriptPath),
    );
}

/**
 * Enumerate sister git worktrees for the given cwd.
 * Shells out to `git worktree list --porcelain` and parses `worktree <path>` lines.
 * Returns [] on any error (not a git repo, git not in PATH, etc.).
 *
 * @param {string} cwd
 * @returns {Promise<string[]>}
 */
export async function gitWorktrees(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'worktree', 'list', '--porcelain'],
      {
        timeout: 5000,
      },
    );
    const paths: string[] = [];
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
