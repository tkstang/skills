import { realpath } from 'node:fs/promises';

import {
  ClassificationCache,
  discover,
} from '../session-observer/lib/locate.js';
import type {
  DiscoveryOptions,
  TranscriptCandidate,
} from '../session-observer/lib/types.js';
import {
  HANDOFF_PROVIDERS,
  parseSessionCandidate,
  type HandoffProvider,
  type SessionCandidate,
} from './types.js';

const PROVIDER_RUNTIME = {
  claude: 'claude-code',
  codex: 'codex',
} as const;

/** Compare qualified IDs by UTF-16 code units without host-locale state. */
export function compareQualifiedSessionIds(
  left: SessionCandidate['key'],
  right: SessionCandidate['key'],
): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export const HANDOFF_DISCOVERY_OPTIONS = Object.freeze({
  persistence: 'forbid',
  recency: 'exact-all',
  budget: Object.freeze({
    maxEntries: 50_000,
    maxAggregateBytes: 512 * 1024 * 1024,
    maxMetadataBytesPerEntry: 256 * 1024,
    deadlineMs: 30_000,
  }),
}) satisfies DiscoveryOptions;

export interface HandoffCurrentIdentity {
  provider: HandoffProvider;
  nativeId: string;
  evidence: 'direct-environment' | 'explicit-self';
}

export interface HandoffDiscoveryDependencies {
  discover: typeof discover;
  canonicalize: (path: string) => Promise<string | null>;
}

export interface DiscoverHandoffCandidatesOptions {
  providers?: readonly HandoffProvider[];
  currentIdentities?: readonly HandoffCurrentIdentity[];
  deps?: HandoffDiscoveryDependencies;
}

export type HandoffDiscoveryFailure =
  | 'source-unavailable'
  | 'discovery-incomplete'
  | 'invalid-current-identity';

export class HandoffDiscoveryError extends Error {
  readonly code: HandoffDiscoveryFailure;
  readonly provider?: HandoffProvider;

  constructor(code: HandoffDiscoveryFailure, provider?: HandoffProvider) {
    super(code);
    this.name = 'HandoffDiscoveryError';
    this.code = code;
    this.provider = provider;
  }
}

const DEFAULT_DEPENDENCIES: HandoffDiscoveryDependencies = {
  discover,
  canonicalize: async (path) => realpath(path).catch(() => null),
};

function candidateSignature(candidate: SessionCandidate): string {
  return JSON.stringify([
    candidate.key,
    candidate.recordedCwd,
    candidate.modifiedAtMs,
    candidate.size,
    candidate.engagement,
  ]);
}

function identityMap(
  identities: readonly HandoffCurrentIdentity[],
): Map<string, HandoffCurrentIdentity['evidence']> {
  const result = new Map<string, HandoffCurrentIdentity['evidence']>();
  for (const identity of identities) {
    if (
      !HANDOFF_PROVIDERS.includes(identity.provider) ||
      typeof identity.nativeId !== 'string' ||
      identity.nativeId.length === 0 ||
      !['direct-environment', 'explicit-self'].includes(identity.evidence)
    ) {
      throw new HandoffDiscoveryError('invalid-current-identity');
    }
    const key = `${identity.provider}:${identity.nativeId}`;
    if (result.has(key))
      throw new HandoffDiscoveryError('invalid-current-identity');
    result.set(key, identity.evidence);
  }
  return result;
}

function validateProviders(
  providers: readonly HandoffProvider[] | undefined,
): HandoffProvider[] {
  const selected =
    providers === undefined ? [...HANDOFF_PROVIDERS] : [...providers];
  if (
    selected.length === 0 ||
    selected.some((provider) => !HANDOFF_PROVIDERS.includes(provider)) ||
    new Set(selected).size !== selected.length
  ) {
    throw new HandoffDiscoveryError('discovery-incomplete');
  }
  return selected.toSorted();
}

async function projectCandidate(
  provider: HandoffProvider,
  candidate: TranscriptCandidate,
  sourceCanonicalPath: string,
  current: ReadonlyMap<string, HandoffCurrentIdentity['evidence']>,
  canonicalize: HandoffDiscoveryDependencies['canonicalize'],
): Promise<SessionCandidate | null> {
  if (candidate.runtime !== PROVIDER_RUNTIME[provider]) {
    throw new HandoffDiscoveryError('discovery-incomplete', provider);
  }
  if (candidate.recordedCwd === null) {
    throw new HandoffDiscoveryError('discovery-incomplete', provider);
  }
  let recordedCwd: string | null;
  try {
    recordedCwd = await canonicalize(candidate.recordedCwd);
  } catch {
    throw new HandoffDiscoveryError('discovery-incomplete', provider);
  }
  if (recordedCwd === null) {
    throw new HandoffDiscoveryError('discovery-incomplete', provider);
  }
  if (recordedCwd !== sourceCanonicalPath) return null;
  const key = `${provider}:${candidate.sessionId}` as const;
  try {
    return parseSessionCandidate({
      key,
      provider,
      nativeId: candidate.sessionId,
      recordedCwd,
      modifiedAtMs: candidate.mtime,
      size: candidate.size,
      engagement: candidate.engagementStatus,
      currentEvidence: current.get(key) ?? 'none',
    });
  } catch {
    throw new HandoffDiscoveryError('discovery-incomplete', provider);
  }
}

/**
 * Enumerate the complete exact-cwd Codex and Claude candidate set without
 * consulting or updating persistent discovery state.
 */
export async function discoverHandoffCandidates(
  sourcePath: string,
  options: DiscoverHandoffCandidatesOptions = {},
): Promise<SessionCandidate[]> {
  const deps = options.deps ?? DEFAULT_DEPENDENCIES;
  let sourceCanonicalPath: string | null;
  try {
    sourceCanonicalPath = await deps.canonicalize(sourcePath);
  } catch {
    throw new HandoffDiscoveryError('source-unavailable');
  }
  if (sourceCanonicalPath === null) {
    throw new HandoffDiscoveryError('source-unavailable');
  }
  const providers = validateProviders(options.providers);
  const current = identityMap(options.currentIdentities ?? []);
  const projected: SessionCandidate[] = [];

  for (const provider of providers) {
    let discovered: TranscriptCandidate[];
    try {
      discovered = await deps.discover(
        PROVIDER_RUNTIME[provider],
        sourceCanonicalPath,
        new ClassificationCache(),
        HANDOFF_DISCOVERY_OPTIONS,
      );
    } catch {
      throw new HandoffDiscoveryError('discovery-incomplete', provider);
    }

    for (const candidate of discovered) {
      const result = await projectCandidate(
        provider,
        candidate,
        sourceCanonicalPath,
        current,
        deps.canonicalize,
      );
      if (result !== null) projected.push(result);
    }
  }

  const byKey = new Map<
    string,
    { candidate: SessionCandidate; signature: string }
  >();
  for (const candidate of projected) {
    const signature = candidateSignature(candidate);
    const existing = byKey.get(candidate.key);
    if (existing !== undefined && existing.signature !== signature) {
      throw new HandoffDiscoveryError(
        'discovery-incomplete',
        candidate.provider,
      );
    }
    if (existing === undefined)
      byKey.set(candidate.key, { candidate, signature });
  }

  return [...byKey.values()]
    .map(({ candidate }) => candidate)
    .toSorted((left, right) => compareQualifiedSessionIds(left.key, right.key));
}
