import { createHash } from 'node:crypto';
import { mkdir, open, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { listSessions, resolveSession } from './discovery.js';
import type {
  DiscoveryOptions,
  DiscoveryResult,
  SessionCandidate,
} from './discovery.js';
import { ToolkitError, provider } from './domain.js';
import { parseTranscript } from './reader.js';
import type { ReadOptions, TranscriptPage } from './reader.js';
import { sanitizeEntries } from './sanitize.js';
export interface ExportOptions extends DiscoveryOptions {
  out: string;
  match?: string;
  all?: boolean;
  includeToolCalls?: boolean;
  includeToolResults?: boolean;
  includeActivity?: boolean;
  maxBytes?: number;
}
export interface ExportResult {
  written: {
    session: string;
    path: string;
    messages: number;
    coverage: TranscriptPage['coverage'];
  }[];
  discovery: DiscoveryResult['coverage'] | null;
}
/** Pure conversational projection. Hidden instructions/control payloads are removed; this is not a credential audit. */
export function renderTranscriptMarkdown(page: TranscriptPage): string {
  const entries = sanitizeEntries(page.messages, { runtime: page.runtime });
  const lines = [
    '# Session transcript',
    '',
    `Runtime: ${page.runtime}`,
    '',
    'Visible conversation; hidden instruction/control payloads removed. Review before sharing.',
    '',
    `Source coverage: ${page.coverage.complete ? 'complete' : `partial (${page.coverage.reasons.join(', ')})`}.`,
    '',
  ];
  for (const entry of entries)
    lines.push(
      `## ${entry.role === 'user' ? 'User' : 'Assistant'}${entry.kind === 'message' ? '' : ` (${entry.kind})`}`,
      '',
      entry.text,
      '',
    );
  if (page.activity) {
    lines.push(
      '## Activity summary',
      '',
      `Recorded calls: ${page.activity.counts.capturedSource.calls}; results: ${page.activity.counts.capturedSource.results}; failures: ${page.activity.counts.capturedSource.failures}.`,
      '',
      `Summary source coverage: ${page.activity.sourceComplete ? 'complete' : 'partial'}.`,
      '',
    );
  }
  return lines.join('\n');
}
function filename(candidate: SessionCandidate): string {
  const id =
    candidate.sessionId.replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 96) ||
    'session';
  const suffix = createHash('sha256')
    .update(candidate.transcriptPath)
    .digest('hex')
    .slice(0, 12);
  return `${candidate.runtime}-${id}-${suffix}.md`;
}
async function writeNew(path: string, markdown: string): Promise<void> {
  let handle;
  try {
    handle = await open(path, 'wx', 0o600);
    await handle.writeFile(markdown);
    await handle.close();
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
      await unlink(path).catch(() => {});
    }
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ToolkitError(
        'E_USAGE',
        'Export destination already exists.',
        'Choose a new file; exports never overwrite existing artifacts.',
      );
    throw error;
  }
}
/** Explicit write operation; selection/read/watch state remains with consumers. */
export async function exportMarkdown(
  options: ExportOptions,
): Promise<ExportResult> {
  if (!options.out?.trim())
    throw new ToolkitError(
      'E_USAGE',
      'An output path is required.',
      'Supply --out <file> or --all --out <directory>.',
    );
  if (options.session && (options.match !== undefined || options.all))
    throw new ToolkitError(
      'E_USAGE',
      'Session conflicts with marker/batch selection.',
      'Use a session or historical selectors.',
    );
  if (options.match !== undefined && !options.match.trim())
    throw new ToolkitError(
      'E_USAGE',
      'Marker must not be empty.',
      'Supply a visible conversation marker.',
    );
  let candidates: SessionCandidate[],
    discovery: DiscoveryResult['coverage'] | null = null;
  if (options.session) {
    const candidate = await resolveSession(options.session, options);
    if (
      options.runtime &&
      options.runtime !== 'auto' &&
      provider(options.runtime) !== candidate.runtime
    )
      throw new ToolkitError(
        'E_USAGE',
        'Session/runtime conflict.',
        'Use the session provider.',
      );
    if (options.cwd && (await realpath(options.cwd)) !== candidate.recordedCwd)
      throw new ToolkitError(
        'E_UNAVAILABLE',
        'Session cwd does not match.',
        'Use the recorded cwd or omit the cwd filter.',
      );
    candidates = [candidate];
  } else {
    const result = await listSessions({
      ...options,
      cwd: options.cwd ?? process.cwd(),
    });
    candidates = result.candidates;
    discovery = result.coverage;
  }
  const selected: { candidate: SessionCandidate; page: TranscriptPage }[] = [];
  for (const candidate of candidates) {
    const read: ReadOptions = {
      path: candidate.transcriptPath,
      runtime: candidate.runtime,
      maxBytes: options.maxBytes,
      includeToolCalls: options.includeToolCalls,
      includeToolResults: options.includeToolResults,
      includeActivity: options.includeActivity,
    };
    const page = await parseTranscript(read);
    if (
      options.match !== undefined &&
      !sanitizeEntries(page.messages, { runtime: page.runtime }).some((entry) =>
        entry.text.includes(options.match!),
      )
    ) {
      if (!page.coverage.complete)
        throw new ToolkitError(
          'E_UNAVAILABLE',
          'Marker scan was incomplete.',
          'Increase maxBytes or choose an exact session.',
        );
      continue;
    }
    selected.push({ candidate, page });
  }
  if (!selected.length)
    throw new ToolkitError(
      'E_UNAVAILABLE',
      options.match
        ? 'No visible conversation matched the marker.'
        : 'No session matched the selection.',
      'Use list or change the explicit session/marker.',
    );
  if (!options.all && selected.length > 1)
    throw new ToolkitError(
      'E_AMBIGUOUS',
      'Multiple historical sessions match.',
      'Use --session, a unique --match marker, or --all.',
    );
  if (
    !options.all &&
    discovery &&
    !discovery.complete &&
    discovery.reasons.some((r) => !r.endsWith('metadata-prefix-incomplete'))
  )
    throw new ToolkitError(
      'E_UNAVAILABLE',
      'Historical discovery was incomplete.',
      'Use an exact session or --all to export the explicitly bounded set.',
    );
  const out = resolve(options.out);
  await mkdir(options.all ? out : dirname(out), { recursive: true });
  const directory = await realpath(options.all ? out : dirname(out));
  const written: ExportResult['written'] = [];
  for (const { candidate, page } of selected) {
    const path = join(
      directory,
      options.all ? filename(candidate) : basename(out),
    );
    if (relative(directory, path).startsWith('..'))
      throw new ToolkitError(
        'E_USAGE',
        'Unsafe export destination.',
        'Choose a confined output filename.',
      );
    await writeNew(path, renderTranscriptMarkdown(page));
    written.push({
      session: candidate.session,
      path,
      messages: sanitizeEntries(page.messages, { runtime: page.runtime })
        .length,
      coverage: page.coverage,
    });
  }
  return { written, discovery };
}
