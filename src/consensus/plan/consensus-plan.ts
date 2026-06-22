import {
  ConsensusError,
  EXIT_CODES,
  invalidIterationModeError,
  ITERATION_MODES,
} from '../core/consensus-loop.js';
import type {
  Agency,
  ColdStartMode,
  IterationMode,
} from '../core/consensus-loop.js';

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/u;

export interface ParsedPlanOptions {
  goal: string;
  constraints: string | null;
  peers: string[] | null;
  maxRounds: number;
  agency: Agency;
  iteration: IterationMode;
  synthesizer: string | null;
  coldStart: ColdStartMode;
  output: string | null;
  runDir: string | null;
  allowRoot: string | null;
}

function requireValue(argv: readonly string[], index: number, token: string) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${token} requires a value`);
  }
  return value;
}

function parsePositiveInteger(
  value: string,
  flag: string,
  min = MAX_ROUNDS_MIN,
  max = MAX_ROUNDS_MAX,
) {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function validateProviderId(value: string, flag: string) {
  if (!PROVIDER_ID_PATTERN.test(value)) {
    throw new Error(
      `${flag} provider ids must match ${PROVIDER_ID_PATTERN.source}`,
    );
  }
  return value;
}

function parsePeers(value: string) {
  const peers = value
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);
  if (peers.length !== 2) {
    throw new Error('--peers must list exactly two peers');
  }
  return peers.map((peer) => validateProviderId(peer, '--peers'));
}

function parseAgency(value: string): Agency {
  if (value === 'minimal' || value === 'moderate' || value === 'maximum') {
    return value;
  }
  throw new Error('--agency must be minimal, moderate, or maximum');
}

function parseIteration(value: string): IterationMode {
  if (ITERATION_MODES.includes(value as IterationMode)) {
    return value as IterationMode;
  }
  throw invalidIterationModeError(value);
}

function parseColdStart(value: string): ColdStartMode {
  if (value === 'shared_input' || value === 'independent_draft') {
    return value;
  }
  throw new Error('--cold-start must be shared_input or independent_draft');
}

export function parsePlanArgs(argv: readonly string[]): ParsedPlanOptions {
  const parsed: ParsedPlanOptions = {
    goal: '',
    constraints: null,
    peers: null,
    maxRounds: 12,
    agency: 'moderate',
    iteration: 'parallel_synthesized',
    synthesizer: null,
    coldStart: 'independent_draft',
    output: null,
    runDir: null,
    allowRoot: null,
  };
  let goalSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--goal':
        if (goalSeen) {
          throw new ConsensusError(
            'consensus-plan accepts exactly one --goal value',
            {
              code: 'DUPLICATE_GOAL_SOURCE',
              exitCode: EXIT_CODES.USAGE,
            },
          );
        }
        parsed.goal = requireValue(argv, index, token);
        goalSeen = true;
        index += 1;
        break;
      case '--constraints':
        parsed.constraints = requireValue(argv, index, token);
        index += 1;
        break;
      case '--peers':
        parsed.peers = parsePeers(requireValue(argv, index, token));
        index += 1;
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(
          requireValue(argv, index, token),
          token,
        );
        index += 1;
        break;
      case '--agency':
        parsed.agency = parseAgency(requireValue(argv, index, token));
        index += 1;
        break;
      case '--iteration':
        parsed.iteration = parseIteration(requireValue(argv, index, token));
        index += 1;
        break;
      case '--synthesizer':
        parsed.synthesizer = validateProviderId(
          requireValue(argv, index, token),
          token,
        );
        index += 1;
        break;
      case '--cold-start':
        parsed.coldStart = parseColdStart(requireValue(argv, index, token));
        index += 1;
        break;
      case '--output':
        parsed.output = requireValue(argv, index, token);
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
      default:
        if (token.startsWith('--')) {
          throw new Error(`unknown option: ${token}`);
        }
        throw new Error(`unexpected positional argument: ${token}`);
    }
  }

  if (!goalSeen) {
    throw new ConsensusError('consensus-plan requires --goal <text>', {
      code: 'MISSING_GOAL_SOURCE',
      exitCode: EXIT_CODES.USAGE,
    });
  }

  return parsed;
}
