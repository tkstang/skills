import { realpath } from 'node:fs/promises';

import {
  ClassificationCache,
  discover,
} from '../session-observer/lib/locate.js';
import type {
  DiscoveryOptions,
  DiscoveryUnattributableReason,
  TranscriptCandidate,
} from '../session-observer/lib/types.js';
import { readExactCodexNativeId } from './discovery.js';
import type {
  GuidanceProvider,
  GuidanceSurface,
} from './guidance-capabilities.js';

export const GUIDANCE_DISCOVERY_OPTIONS = Object.freeze({
  persistence: 'forbid',
  recency: 'exact-all',
  budget: Object.freeze({
    maxEntries: 50_000,
    maxAggregateBytes: 512 * 1024 * 1024,
    maxMetadataBytesPerEntry: 256 * 1024,
    deadlineMs: 30_000,
  }),
}) satisfies DiscoveryOptions;

export type GuidanceCandidateSurface = GuidanceSurface | 'ambiguous';
export type GuidanceQualifiedSessionId =
  `${GuidanceProvider}:${GuidanceCandidateSurface}:${string}`;

export interface GuidanceSessionCandidate {
  key: GuidanceQualifiedSessionId;
  provider: GuidanceProvider;
  surface: GuidanceCandidateSurface;
  nativeId: string;
  recordedCwd: string;
  modifiedAtMs: number;
  size: number;
  engagement: 'engaged' | 'unengaged' | 'unknown';
  originEvidence: 'cli-transcript' | 'store-origin-ambiguous';
}

export interface GuidanceCurrentIdentity {
  provider: GuidanceProvider;
  surface: GuidanceSurface;
  nativeId: string;
  evidence: 'direct-environment' | 'explicit-self';
}

export interface GuidanceDiscoveryDependencies {
  discover: typeof discover;
  canonicalize: (path: string) => Promise<string | null>;
  readCodexNativeId: (candidate: TranscriptCandidate) => Promise<string | null>;
}

export interface DiscoverGuidanceCandidatesOptions {
  providers?: readonly GuidanceProvider[];
  deps?: GuidanceDiscoveryDependencies;
}

export interface GuidanceUnattributableSummary {
  provider: GuidanceProvider;
  reasons: Array<{ code: DiscoveryUnattributableReason; count: number }>;
}

export interface GuidanceDiscoveryResult {
  candidates: GuidanceSessionCandidate[];
  unattributable: GuidanceUnattributableSummary[];
}

export class GuidanceDiscoveryError extends Error {
  constructor(
    readonly code:
      | 'source-unavailable'
      | 'discovery-incomplete'
      | 'invalid-selection',
    readonly provider?: GuidanceProvider,
  ) {
    super(code);
    this.name = 'GuidanceDiscoveryError';
  }
}

const RUNTIME_BY_PROVIDER = {
  claude: 'claude-code',
  codex: 'codex',
  cursor: 'cursor',
} as const;

const DEFAULT_DEPENDENCIES: GuidanceDiscoveryDependencies = {
  discover,
  canonicalize: async (path) => realpath(path).catch(() => null),
  readCodexNativeId: readExactCodexNativeId,
};

function surfaceForCandidate(
  provider: GuidanceProvider,
): Pick<GuidanceSessionCandidate, 'surface' | 'originEvidence'> {
  return provider === 'cursor'
    ? { surface: 'ambiguous', originEvidence: 'store-origin-ambiguous' }
    : { surface: 'cli', originEvidence: 'cli-transcript' };
}

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function discoverGuidance(
  sourcePath: string,
  options: DiscoverGuidanceCandidatesOptions = {},
): Promise<GuidanceDiscoveryResult> {
  const deps = options.deps ?? DEFAULT_DEPENDENCIES;
  const sourceCanonical = await deps.canonicalize(sourcePath).catch(() => null);
  if (sourceCanonical === null)
    throw new GuidanceDiscoveryError('source-unavailable');
  const providers = [...(options.providers ?? ['claude', 'codex', 'cursor'])];
  if (
    providers.length === 0 ||
    new Set(providers).size !== providers.length ||
    providers.some((provider) => !(provider in RUNTIME_BY_PROVIDER))
  ) {
    throw new GuidanceDiscoveryError('discovery-incomplete');
  }

  const projected: GuidanceSessionCandidate[] = [];
  const unattributable = new Map<
    GuidanceProvider,
    Map<DiscoveryUnattributableReason, number>
  >();
  for (const provider of providers.toSorted()) {
    let transcripts: TranscriptCandidate[];
    try {
      transcripts = await deps.discover(
        RUNTIME_BY_PROVIDER[provider],
        sourceCanonical,
        new ClassificationCache(),
        provider === 'cursor'
          ? GUIDANCE_DISCOVERY_OPTIONS
          : {
              ...GUIDANCE_DISCOVERY_OPTIONS,
              unattributablePolicy: 'summarize',
              unattributable: ({ reason }) => {
                const reasons = unattributable.get(provider) ?? new Map();
                reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
                unattributable.set(provider, reasons);
              },
            },
      );
    } catch {
      throw new GuidanceDiscoveryError('discovery-incomplete', provider);
    }
    for (const transcript of transcripts) {
      if (
        provider === 'cursor' &&
        transcript.cwdEvidenceQuality !== 'independent-exact'
      ) {
        throw new GuidanceDiscoveryError('discovery-incomplete', provider);
      }
      if (
        transcript.runtime !== RUNTIME_BY_PROVIDER[provider] ||
        transcript.recordedCwd === null
      ) {
        throw new GuidanceDiscoveryError('discovery-incomplete', provider);
      }
      const recordedCwd = await deps
        .canonicalize(transcript.recordedCwd)
        .catch(() => null);
      if (recordedCwd === null)
        throw new GuidanceDiscoveryError('discovery-incomplete', provider);
      if (recordedCwd !== sourceCanonical) continue;
      const nativeId =
        provider === 'codex'
          ? await deps.readCodexNativeId(transcript).catch(() => null)
          : transcript.sessionId;
      if (nativeId === null || nativeId.length === 0) {
        throw new GuidanceDiscoveryError('discovery-incomplete', provider);
      }
      const surface = surfaceForCandidate(provider);
      projected.push({
        key: `${provider}:${surface.surface}:${nativeId}`,
        provider,
        surface: surface.surface,
        nativeId,
        recordedCwd,
        modifiedAtMs: transcript.mtime * 1_000,
        size: transcript.size,
        engagement: transcript.engagementStatus,
        originEvidence: surface.originEvidence,
      });
    }
  }

  const byKey = new Map<GuidanceQualifiedSessionId, GuidanceSessionCandidate>();
  for (const candidate of projected) {
    const existing = byKey.get(candidate.key);
    if (
      existing !== undefined &&
      JSON.stringify(existing) !== JSON.stringify(candidate)
    ) {
      throw new GuidanceDiscoveryError(
        'discovery-incomplete',
        candidate.provider,
      );
    }
    byKey.set(candidate.key, candidate);
  }
  return {
    candidates: [...byKey.values()].toSorted((left, right) =>
      compareKeys(left.key, right.key),
    ),
    unattributable: [...unattributable.entries()]
      .toSorted(([left], [right]) => compareKeys(left, right))
      .map(([provider, reasons]) => ({
        provider,
        reasons: [...reasons.entries()]
          .toSorted(([left], [right]) => compareKeys(left, right))
          .map(([code, count]) => ({ code, count })),
      })),
  };
}

export async function discoverGuidanceCandidates(
  sourcePath: string,
  options: DiscoverGuidanceCandidatesOptions = {},
): Promise<GuidanceSessionCandidate[]> {
  return (await discoverGuidance(sourcePath, options)).candidates;
}

export function selectCurrentGuidanceCandidate(
  candidates: readonly GuidanceSessionCandidate[],
  identity?: GuidanceCurrentIdentity,
): GuidanceSessionCandidate | null {
  if (identity === undefined || identity.nativeId.length === 0) return null;
  const matches = candidates.filter(
    (candidate) =>
      candidate.provider === identity.provider &&
      candidate.surface === identity.surface &&
      candidate.nativeId === identity.nativeId,
  );
  return matches.length === 1 ? matches[0] : null;
}

export function selectGuidanceCandidate(
  candidates: readonly GuidanceSessionCandidate[],
  key: GuidanceQualifiedSessionId,
): GuidanceSessionCandidate {
  const matches = candidates.filter((candidate) => candidate.key === key);
  if (matches.length !== 1)
    throw new GuidanceDiscoveryError('invalid-selection');
  return matches[0];
}
