import { homedir } from 'node:os';

import { ToolkitError, type Provider } from './domain.js';
import { compileMatcher } from './search-matcher.js';
import {
  resolveOptions,
  type RawOptionValues,
  UsageError,
} from './search-options.js';
import { estimate, runSearch, type EstimateResult } from './search-pipeline.js';
import type { SearchResult } from './search-types.js';

/** Stateless search input. Cwd hints widen when they find no hits. */
export interface SearchOptions {
  patterns: string[];
  literal?: boolean;
  runtime?: Provider | 'auto';
  cwd?: string[];
  since?: string;
  until?: string;
  tiers?: Array<'history' | 'meta' | 'content'>;
  deep?: boolean;
  includeTools?: boolean;
  allowLargeScan?: boolean;
  largeScanBytes?: number;
  maxLineBytes?: number;
  limit?: number;
  deadlineMs?: number;
  home?: string;
  env?: Readonly<Record<string, string | undefined>>;
}
function resolved(input: SearchOptions) {
  const raw: RawOptionValues = {
    pattern: input.patterns,
    literal: input.literal,
    runtime: input.runtime === 'auto' ? undefined : input.runtime,
    cwd: input.cwd,
    since: input.since,
    until: input.until,
    tiers: input.tiers?.join(','),
    'no-deep': input.deep === false,
    'include-tools': input.includeTools,
    'allow-large-scan': input.allowLargeScan,
  };
  for (const [key, value] of Object.entries({
    'large-scan-bytes': input.largeScanBytes,
    'max-line-bytes': input.maxLineBytes,
    limit: input.limit,
    'deadline-ms': input.deadlineMs,
  }))
    if (value !== undefined) raw[key] = String(value);
  if (
    !Array.isArray(input.patterns) ||
    input.patterns.length === 0 ||
    input.patterns.some((p) => typeof p !== 'string')
  )
    throw new UsageError('At least one nonempty pattern is required.');
  const options = resolveOptions(raw, { home: input.home });
  compileMatcher(options.patterns, { literal: options.literal });
  return options;
}
function usage(error: unknown): never {
  if (error instanceof UsageError)
    throw new ToolkitError(
      'E_USAGE',
      error.message,
      'Supply nonempty valid patterns and supported search options.',
    );
  throw error;
}
/** Search raw classified units; no conversation digest or persistent state. */
export async function searchSessions(
  input: SearchOptions,
): Promise<SearchResult> {
  try {
    const result = await runSearch(resolved(input), {
      home: input.home ?? homedir(),
      env: input.env ?? process.env,
    });
    if (result.needsConfirmation)
      throw new ToolkitError(
        'E_SCAN_CONFIRMATION',
        'The estimated content scan exceeds the authorized byte threshold.',
        'Inspect search estimate, then rerun with --allow-large-scan to authorize it.',
        {
          estimate: result.needsConfirmation,
          sources: result.sources,
          partialResults: result.results,
        },
      );
    return result;
  } catch (error) {
    return usage(error);
  }
}
/** Measure candidate bytes and coverage without searching transcript content. */
export async function estimateSearch(
  input: SearchOptions,
): Promise<EstimateResult> {
  try {
    return await estimate(resolved(input), {
      home: input.home ?? homedir(),
      env: input.env ?? process.env,
    });
  } catch (error) {
    return usage(error);
  }
}
export type {
  SearchResult,
  SessionHit,
  Snippet,
  SearchDiagnostics,
  SourceReport,
} from './search-types.js';
export type { EstimateResult, EstimateRuntime } from './search-pipeline.js';
