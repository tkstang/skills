import { opendir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';

import { ToolkitError, positive, provider, selector } from './domain.js';
import type { Provider } from './domain.js';
import {
  encodeCwdVariants,
  extractMetaFromRecords,
  readMetadataRecordsBounded,
} from './provider-runtime.js';
import type { TranscriptMeta } from './provider-runtime.js';
import { parseTranscript } from './reader.js';
import type { ReadOptions, TranscriptPage } from './reader.js';
import { timeBound } from './time.js';

export interface StoreContext {
  homeDir?: string;
  storeRoots?: Partial<Record<Provider, string>>;
}
export interface DiscoveryOptions extends StoreContext {
  runtime?: Provider | 'auto';
  cwd?: string;
  session?: string;
  since?: string;
  until?: string;
  limit?: number;
  budget?: {
    maxEntries?: number;
    maxAggregateBytes?: number;
    maxMetadataBytesPerEntry?: number;
    deadlineMs?: number;
    maxCandidates?: number;
  };
}
export interface SessionCandidate {
  runtime: Provider;
  sessionId: string;
  session: string;
  transcriptPath: string;
  recordedCwd: string | null;
  metadata: TranscriptMeta;
  mtime: number;
  size: number;
  cwdEvidence: 'metadata' | 'project-layout' | 'none';
  matchedTier: 'cwd' | 'global-recent';
  metadataIncomplete: boolean;
}
export interface DiscoveryResult {
  kind: 'historical';
  candidates: SessionCandidate[];
  coverage: {
    complete: boolean;
    reasons: string[];
    entriesInspected: number;
    sourceBytes: number;
    metadataBytesRead: number;
    omittedCandidates: number;
  };
}
const PROVIDERS: Provider[] = ['claude-code', 'codex', 'cursor'];
/** Historical discovery never proves current identity and never writes a cwd cache. */
export async function listSessions(
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const runtimes =
    options.runtime && options.runtime !== 'auto'
      ? [provider(options.runtime)]
      : PROVIDERS;
  const pin = options.session ? selector(options.session) : undefined;
  if (
    pin &&
    options.runtime &&
    options.runtime !== 'auto' &&
    pin.runtime !== options.runtime
  )
    throw new ToolkitError(
      'E_USAGE',
      'Session/runtime conflict.',
      'Use the session provider.',
    );
  const limit = positive(options.limit, 'limit', 100)!;
  const now = new Date();
  const since = timeBound(options.since, false, now),
    until = timeBound(options.until, true, now);
  if (since !== undefined && until !== undefined && since >= until)
    throw new ToolkitError(
      'E_USAGE',
      'Inverted time range.',
      'Use since before until.',
    );
  const cwd = options.cwd ? await realpath(resolve(options.cwd)) : undefined;
  const candidates: SessionCandidate[] = [],
    reasons = new Set<string>();
  let entriesInspected = 0,
    sourceBytes = 0,
    metadataBytesRead = 0,
    omittedCandidates = 0;
  for (const runtime of runtimes) {
    if (pin && pin.runtime !== runtime) continue;
    const cursor = runtime === 'cursor';
    const maxEntries = positive(
      options.budget?.maxEntries,
      'maxEntries',
      cursor ? 20_000 : 50_000,
    )!;
    const maxSource = positive(
      options.budget?.maxAggregateBytes,
      'maxAggregateBytes',
      cursor ? 64 * 1024 * 1024 : 512 * 1024 * 1024,
    )!;
    const maxMetadata = positive(
      options.budget?.maxMetadataBytesPerEntry,
      'maxMetadataBytesPerEntry',
      256 * 1024,
    )!;
    const maxCandidates = positive(
      options.budget?.maxCandidates,
      'maxCandidates',
      cursor ? 5000 : 50_000,
    )!;
    const deadline =
      Date.now() +
      positive(
        options.budget?.deadlineMs,
        'deadlineMs',
        cursor ? 2000 : 30_000,
      )!;
    const root = resolve(
      options.storeRoots?.[runtime] ??
        join(
          options.homeDir ?? homedir(),
          runtime === 'claude-code' ? '.claude' : `.${runtime}`,
          runtime === 'codex' ? 'sessions' : 'projects',
        ),
    );
    let entries = 0,
      bytes = 0,
      retained = 0,
      stopped = false;
    const stop = (reason: string) => {
      reasons.add(`${runtime}:${reason}`);
      stopped = true;
    };
    async function walk(directory: string, depth: number): Promise<void> {
      if (stopped) return;
      if (Date.now() >= deadline) {
        stop('deadline');
        return;
      }
      try {
        const dir = await opendir(directory, { bufferSize: 1 });
        for await (const entry of dir) {
          if (Date.now() >= deadline) {
            stop('deadline');
            break;
          }
          if (entries >= maxEntries) {
            stop('entry-budget');
            break;
          }
          entries++;
          entriesInspected++;
          const path = join(directory, entry.name);
          if (entry.isSymbolicLink()) {
            reasons.add(`${runtime}:symlink-skipped`);
            continue;
          }
          if (entry.isDirectory()) {
            if (depth < 8) await walk(path, depth + 1);
            else reasons.add(`${runtime}:depth-budget`);
            if (stopped) break;
            continue;
          }
          if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
          if (pin && runtime !== 'codex' && basename(path, '.jsonl') !== pin.id)
            continue;
          const info = await stat(path);
          if (
            (since !== undefined && info.mtimeMs < since) ||
            (until !== undefined && info.mtimeMs >= until)
          )
            continue;
          if (bytes + info.size > maxSource) {
            stop('source-byte-budget');
            break;
          }
          bytes += info.size;
          sourceBytes += info.size;
          let read;
          try {
            read = await readMetadataRecordsBounded(path, {
              maxBytes: maxMetadata,
              maxRecords: 128,
              deadlineMs: Math.max(1, deadline - Date.now()),
              diagnostic: (event) =>
                reasons.add(`${runtime}:metadata-${event.code}`),
            });
          } catch {
            reasons.add(`${runtime}:metadata-unavailable`);
            continue;
          }
          metadataBytesRead += read.bytesRead;
          const meta = extractMetaFromRecords(runtime, read.records, path);
          if (!meta) {
            reasons.add(`${runtime}:invalid-metadata`);
            continue;
          }
          if (pin && meta.sessionId !== pin.id) {
            // Codex scans native metadata across the store. A different valid
            // session is a filtered nonmatch; a filename claiming this pin is
            // contradictory evidence and must still refuse exact selection.
            const carrierId = basename(path, '.jsonl').toLowerCase();
            if (
              runtime !== 'codex' ||
              carrierId === pin.id.toLowerCase() ||
              carrierId.endsWith(`-${pin.id.toLowerCase()}`)
            )
              reasons.add(`${runtime}:identity-mismatch`);
            continue;
          }
          const project = relative(root, path).split(sep)[0];
          const layoutMatch =
            cwd !== undefined &&
            encodeCwdVariants(runtime, cwd).includes(project);
          let recordedCwd = meta.recordedCwd,
            cwdEvidence: SessionCandidate['cwdEvidence'] = 'none';
          if (recordedCwd) {
            try {
              recordedCwd = await realpath(recordedCwd);
              cwdEvidence = 'metadata';
            } catch {
              reasons.add(`${runtime}:cwd-unresolvable`);
            }
          }
          if (
            layoutMatch &&
            (runtime === 'cursor' ||
              !read.records.some((r) => typeof r.cwd === 'string'))
          ) {
            recordedCwd = cwd!;
            cwdEvidence = 'project-layout';
          }
          if (cwd !== undefined && recordedCwd !== cwd) continue;
          if (retained >= maxCandidates) {
            omittedCandidates++;
            stop('candidate-budget');
            break;
          }
          retained++;
          candidates.push({
            runtime,
            sessionId: meta.sessionId,
            session: `${runtime}:${meta.sessionId}`,
            transcriptPath: path,
            recordedCwd,
            metadata: { ...meta, recordedCwd },
            mtime: info.mtimeMs,
            size: info.size,
            cwdEvidence,
            matchedTier:
              cwd !== undefined && recordedCwd === cwd
                ? 'cwd'
                : 'global-recent',
            metadataIncomplete: read.incomplete,
          });
          if (read.incomplete)
            reasons.add(`${runtime}:metadata-prefix-incomplete`);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          reasons.add(`${runtime}:scan-inaccessible`);
      }
    }
    await walk(root, 0);
  }
  candidates.sort(
    (a, b) =>
      (a.cwdEvidence === 'metadata' ? 0 : 1) -
        (b.cwdEvidence === 'metadata' ? 0 : 1) ||
      b.mtime - a.mtime ||
      a.session.localeCompare(b.session),
  );
  if (candidates.length > limit) {
    omittedCandidates += candidates.length - limit;
    reasons.add('result-limit');
  }
  return {
    kind: 'historical',
    candidates: candidates.slice(0, limit),
    coverage: {
      complete: reasons.size === 0,
      reasons: [...reasons],
      entriesInspected,
      sourceBytes,
      metadataBytesRead,
      omittedCandidates,
    },
  };
}
export interface SessionReadOptions
  extends Omit<ReadOptions, 'runtime' | 'path'>, StoreContext {
  session: string;
}
/** Exact historical selection refuses duplicates or incomplete discovery. */
export async function readTranscript(
  options: SessionReadOptions,
): Promise<TranscriptPage> {
  const selected = await resolveSession(options.session, options);
  return parseTranscript({
    ...options,
    runtime: selected.runtime,
    path: selected.transcriptPath,
  });
}
export async function resolveSession(
  session: string,
  context: StoreContext = {},
): Promise<SessionCandidate> {
  const result = await listSessions({ ...context, session, limit: 2 });
  if (result.candidates.length > 1)
    throw new ToolkitError(
      'E_AMBIGUOUS',
      'Multiple transcript carriers match this session.',
      'Remove the ambiguity or use parse with an explicit file.',
    );
  if (
    result.coverage.reasons.some(
      (r) =>
        !r.endsWith('metadata-prefix-incomplete') &&
        !r.endsWith('metadata-malformed-record'),
    )
  )
    throw new ToolkitError(
      'E_UNAVAILABLE',
      'Exact session discovery was incomplete.',
      'Retry with a complete readable provider store or parse an explicit file.',
    );
  if (!result.candidates.length)
    throw new ToolkitError(
      'E_UNAVAILABLE',
      'Session transcript unavailable.',
      'Use list to inspect historical sessions or parse an explicit file.',
    );
  return result.candidates[0];
}
