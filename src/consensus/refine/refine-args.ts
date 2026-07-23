import {
  ConsensusError,
  EXIT_CODES,
  invalidIterationModeError,
  ITERATION_MODES,
} from '../core/consensus-loop.js';
import { isJsonRecord } from './refine-shared.js';
import type {
  AgencyValue,
  AnnotatedError,
  ColdStartValue,
  HostId,
  IterationModeValue,
  JsonRecord,
  NormalizedProviderInventoryEntry,
  ParsedWrapperOptions,
  ProviderInventoryEntry,
  ProviderInventoryInput,
  WrapperOptions,
} from './refine-types.js';

export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;

const MAX_ROUNDS_MIN = 1;

const MAX_ROUNDS_MAX = 100;

function asProviderInventoryEntry(value: unknown): ProviderInventoryEntry {
  return isJsonRecord(value) ? (value as ProviderInventoryEntry) : {};
}

function requireValue(argv: readonly string[], index: number, flag: string) {
  if (index + 1 >= argv.length) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index + 1];
}

function parsePositiveInteger(
  value: string,
  label: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
) {
  const parsed = Number.parseInt(value, 10);
  if (
    !Number.isInteger(parsed) ||
    String(parsed) !== String(value) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parsePeers(value: unknown) {
  const peers = String(value)
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);

  if (peers.length !== 2) {
    throw new Error('--peers must contain exactly two peers');
  }

  for (const peer of peers) {
    validateProviderId(peer, '--peers');
  }

  return peers;
}

function validateProviderId(providerId: unknown, label = 'provider id') {
  if (typeof providerId !== 'string' || !PROVIDER_ID_PATTERN.test(providerId)) {
    throw new Error(
      `${label} "${providerId}" must match ^[a-z][a-z0-9-]{0,31}$`,
    );
  }
  return providerId;
}

// Provider inventory readiness is reported through status strings. Treat
// known-bad statuses as unavailable so PEER_UNAVAILABLE fires during preflight
// with actionable provider CLI guidance. "loading" is tolerated because provider
// CLIs can briefly report a warming state before settling to ready or a terminal
// unavailable status.
const PROVIDER_UNAVAILABLE_STATUSES = new Set([
  'auth_required',
  'error',
  'missing',
  'unavailable',
  'not found',
  'notfound',
  'disabled',
  'offline',
  'unsupported',
]);

function providerEntryAvailable(entry: ProviderInventoryEntry) {
  // Explicit boolean availability wins (injected/test inventories use this shape).
  if (typeof entry.available === 'boolean') {
    return entry.available;
  }
  // Disabled providers are never usable, in either boolean or display-string form.
  if (entry.enabled === false || entry.enabled === 'Disabled') {
    return false;
  }
  if (typeof entry.status === 'string') {
    return !PROVIDER_UNAVAILABLE_STATUSES.has(
      entry.status.trim().toLowerCase(),
    );
  }
  return true;
}

export function normalizeProviderInventory(
  providerInventory: ProviderInventoryInput,
): NormalizedProviderInventoryEntry[] {
  const entries = Array.isArray(providerInventory)
    ? providerInventory
    : isJsonRecord(providerInventory)
      ? (providerInventory.providers ?? providerInventory.data ?? [])
      : [];

  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (typeof entry === 'string') {
      return {
        id: validateProviderId(entry, 'provider inventory id'),
        available: true,
      };
    }

    const providerEntry = asProviderInventoryEntry(entry);
    const id = validateProviderId(
      providerEntry.id ?? providerEntry.name ?? providerEntry.provider,
      'provider inventory id',
    );
    const available = providerEntryAvailable(providerEntry);
    return { ...providerEntry, id, available };
  });
}

export function parseWrapperArgs(
  argv: readonly string[],
): ParsedWrapperOptions {
  const parsed: ParsedWrapperOptions = {
    mode: 'sequential',
    inputPath: null,
    goal: '',
    peers: null,
    maxRounds: 12,
    agency: 'moderate',
    iteration: 'alternating',
    synthesizer: null,
    coldStart: 'shared_input',
    output: null,
    resume: null,
    userDirection: null,
    hostDirection: null,
    hostDecisionKind: null,
    runDir: null,
    allowRoot: null,
    failOnSectionError: false,
    skipCorruptSections: [],
    skipAllCorrupt: false,
    yesSkipCorrupt: false,
    prepareParallel: false,
    parallelism: null,
    fanIn: false,
    manifestPath: null,
  };
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--goal':
        parsed.goal = requireValue(argv, index, token);
        index += 1;
        break;
      case '--peers':
        parsed.peers = parsePeers(requireValue(argv, index, token));
        index += 1;
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(
          requireValue(argv, index, token),
          '--max-rounds',
          MAX_ROUNDS_MIN,
          MAX_ROUNDS_MAX,
        );
        index += 1;
        break;
      case '--agency':
        parsed.agency = requireValue(argv, index, token) as AgencyValue;
        index += 1;
        break;
      case '--iteration':
        parsed.iteration = requireValue(
          argv,
          index,
          token,
        ) as IterationModeValue;
        index += 1;
        break;
      case '--synthesizer':
        parsed.synthesizer = validateProviderId(
          requireValue(argv, index, token),
          '--synthesizer',
        );
        index += 1;
        break;
      case '--cold-start':
        parsed.coldStart = requireValue(argv, index, token) as ColdStartValue;
        index += 1;
        break;
      case '--output':
        parsed.output = requireValue(argv, index, token);
        index += 1;
        break;
      case '--resume':
        parsed.resume = requireValue(argv, index, token);
        index += 1;
        break;
      case '--user-direction':
        parsed.userDirection = requireValue(argv, index, token);
        index += 1;
        break;
      case '--host-direction':
        parsed.hostDirection = requireValue(argv, index, token);
        index += 1;
        break;
      case '--host-decision-kind':
        parsed.hostDecisionKind = requireValue(argv, index, token);
        index += 1;
        break;
      case '--run-dir':
        parsed.runDir = requireValue(argv, index, token);
        index += 1;
        break;
      case '--allow-root':
        parsed.allowRoot = requireValue(argv, index, token);
        index += 1;
        break;
      case '--fail-on-section-error':
        parsed.failOnSectionError = true;
        break;
      case '--skip-corrupt-section':
        parsed.skipCorruptSections.push(requireValue(argv, index, token));
        index += 1;
        break;
      case '--skip-all-corrupt':
        parsed.skipAllCorrupt = true;
        break;
      case '--yes-skip-corrupt':
        parsed.yesSkipCorrupt = true;
        break;
      case '--prepare-parallel':
        parsed.prepareParallel = true;
        parsed.mode = 'prepare_parallel';
        break;
      case '--parallelism':
        parsed.parallelism = parsePositiveInteger(
          requireValue(argv, index, token),
          '--parallelism',
          1,
          64,
        );
        index += 1;
        break;
      case '--fan-in':
        parsed.fanIn = true;
        parsed.mode = 'fan_in';
        parsed.manifestPath = requireValue(argv, index, token);
        index += 1;
        break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
    }
  }

  if (parsed.userDirection !== null && parsed.hostDirection !== null) {
    throw new Error(
      '--user-direction and --host-direction are mutually exclusive',
    );
  }

  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  if (!ITERATION_MODES.includes(parsed.iteration as IterationModeValue)) {
    throw invalidIterationModeError(parsed.iteration);
  }

  if (parsed.coldStart === 'independent_draft') {
    throw new Error(
      'consensus-refine supports `shared_input` only because it refines an existing draft',
    );
  }
  if (parsed.coldStart !== 'shared_input') {
    throw new Error(
      'consensus-refine supports `shared_input` only; --cold-start must be shared_input',
    );
  }

  if (parsed.fanIn) {
    if (positionals.length > 0) {
      throw new Error('--fan-in does not accept an input path');
    }
    return parsed;
  }

  if (positionals.length > 1) {
    throw new Error(`unexpected positional argument: ${positionals[1]}`);
  }

  parsed.inputPath = positionals[0] ?? null;
  if (!parsed.inputPath) {
    throw new Error('input path is required');
  }

  return parsed;
}

export function resolvePeers(
  options: Pick<WrapperOptions, 'peers'> = {},
  host: HostId = 'unknown',
  providerInventory: ProviderInventoryInput = [],
) {
  const defaultPeers =
    host === 'codex' ? ['codex', 'claude'] : ['claude', 'codex'];
  const peers = options.peers ?? defaultPeers;
  const inventory = normalizeProviderInventory(providerInventory);
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const missing: string[] = [];
  const unavailable: string[] = [];

  for (const peer of peers) {
    const entry = byId.get(peer);
    if (!entry) {
      missing.push(peer);
    } else if (entry.available === false) {
      unavailable.push(peer);
    }
  }

  if (missing.length > 0) {
    const error: AnnotatedError = new Error(
      `Missing peers in provider inventory: ${missing.join(', ')}. Verify configured providers with "consensus provider ls --json".`,
    );
    error.code = 'PEER_UNAVAILABLE';
    throw error;
  }

  if (unavailable.length > 0) {
    const error: AnnotatedError = new Error(
      `Consensus providers are unavailable: ${unavailable.join(', ')}.`,
    );
    error.code = 'PEER_UNAVAILABLE';
    throw error;
  }

  return { peers, inventory };
}

/**
 * Resolve the per-run synthesizer (FR6). Meaningful only in parallel_synthesized
 * mode: outside it, an explicit --synthesizer is warned-and-ignored. Inside it the
 * synthesizer defaults to the first peer and any explicit override must be present
 * in the provider inventory (SYNTHESIZER_UNAVAILABLE otherwise).
 */
export function resolveSynthesizer(
  options: Pick<WrapperOptions, 'iteration' | 'peers' | 'synthesizer'> = {},
  providerInventory: ProviderInventoryInput = [],
) {
  const warnings: JsonRecord[] = [];
  const requested = options.synthesizer ?? null;

  if (options.iteration !== 'parallel_synthesized') {
    if (requested) {
      warnings.push({
        code: 'SYNTHESIZER_IGNORED',
        level: 'warning',
        synthesizer: requested,
        iteration: options.iteration ?? 'alternating',
        message: `--synthesizer "${requested}" is ignored outside parallel_synthesized mode.`,
      });
    }
    return { synthesizer: null, warnings };
  }

  const peers = options.peers ?? [];
  const synthesizer = requested ?? peers[0] ?? null;

  if (!synthesizer) {
    throw new ConsensusError(
      'no synthesizer could be resolved (no peers available)',
      {
        code: 'SYNTHESIZER_UNAVAILABLE',
        exitCode: EXIT_CODES.CONFIG,
        details: { requested, peers },
      },
    );
  }

  const inventory = normalizeProviderInventory(providerInventory);
  const entry = inventory.find((candidate) => candidate.id === synthesizer);
  if (!entry || entry.available === false) {
    throw new ConsensusError(
      `Synthesizer "${synthesizer}" is not an available provider in the provider CLI inventory. Verify configured providers with "consensus provider ls --json".`,
      {
        code: 'SYNTHESIZER_UNAVAILABLE',
        exitCode: EXIT_CODES.CONFIG,
        details: { synthesizer },
      },
    );
  }

  return { synthesizer, warnings };
}
