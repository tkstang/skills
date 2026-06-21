import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

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
export const INPUT_SIZE_CAP_BYTES = 1024 * 1024;

export interface ParsedDecideOptions {
  optionsPath: string;
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

export interface LoadedDecideInputs {
  options: string;
  optionsPath: string;
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

export function parseDecideArgs(argv: readonly string[]): ParsedDecideOptions {
  const parsed: ParsedDecideOptions = {
    optionsPath: '',
    peers: null,
    maxRounds: 12,
    agency: 'minimal',
    iteration: 'parallel_synthesized',
    synthesizer: null,
    coldStart: 'independent_draft',
    output: null,
    runDir: null,
    allowRoot: null,
  };
  let optionsSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--options':
        if (optionsSeen) {
          throw new ConsensusError(
            'consensus-decide accepts exactly one --options path',
            {
              code: 'DUPLICATE_OPTIONS_SOURCE',
              exitCode: EXIT_CODES.USAGE,
            },
          );
        }
        parsed.optionsPath = requireValue(argv, index, token);
        optionsSeen = true;
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

  if (!optionsSeen) {
    throw new ConsensusError('consensus-decide requires --options <path>', {
      code: 'MISSING_OPTIONS_SOURCE',
      exitCode: EXIT_CODES.USAGE,
    });
  }

  return parsed;
}

function ensureUnderSizeCap(contents: string, label: string) {
  if (Buffer.byteLength(contents, 'utf8') > INPUT_SIZE_CAP_BYTES) {
    throw new Error(
      `${label} input exceeds size cap of ${INPUT_SIZE_CAP_BYTES} bytes`,
    );
  }
}

function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function resolvePath(inputPath: string, cwd: string) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);
}

async function confineRead(inputPath: string, cwd: string, rootPath: string) {
  const root = path.resolve(rootPath);
  const target = resolvePath(inputPath, cwd);

  if (!inside(root, target)) {
    throw new ConsensusError(`read path is outside allowed root: ${target}`, {
      code: 'READ_PATH_OUTSIDE_ROOT',
      exitCode: EXIT_CODES.NOPERM,
      details: { root, path: target },
    });
  }

  const [realRoot, targetStat] = await Promise.all([
    realpath(root),
    lstat(target),
  ]);
  if (!targetStat.isFile() && !targetStat.isSymbolicLink()) {
    throw new Error(`input path must be a file: ${target}`);
  }

  const realTarget = await realpath(target);
  if (!inside(realRoot, realTarget)) {
    throw new ConsensusError(
      `read path resolves outside allowed root: ${target}`,
      {
        code: 'READ_PATH_OUTSIDE_ROOT',
        exitCode: EXIT_CODES.NOPERM,
        details: { root, path: target },
      },
    );
  }

  return target;
}

export async function readDecideInputFile(inputPath: string) {
  const fileStat = await stat(inputPath);
  if (fileStat.size > INPUT_SIZE_CAP_BYTES) {
    throw new Error(`input exceeds size cap of ${INPUT_SIZE_CAP_BYTES} bytes`);
  }

  const contents = await readFile(inputPath, 'utf8');
  ensureUnderSizeCap(contents, 'input');
  return contents;
}

export async function loadDecideInputs(
  options: ParsedDecideOptions,
  { cwd = process.cwd() }: { cwd?: string } = {},
): Promise<LoadedDecideInputs> {
  const resolvedCwd = path.resolve(cwd);
  const allowedRoot = path.resolve(options.allowRoot ?? resolvedCwd);
  const optionsPath = await confineRead(
    options.optionsPath,
    resolvedCwd,
    allowedRoot,
  );
  const optionsText = await readDecideInputFile(optionsPath);

  ensureUnderSizeCap(optionsText, 'options');
  if (optionsText.trim().length === 0) {
    throw new ConsensusError('consensus-decide options must not be empty', {
      code: 'EMPTY_OPTIONS',
      exitCode: EXIT_CODES.USAGE,
    });
  }

  return {
    options: optionsText,
    optionsPath,
  };
}
