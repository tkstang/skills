import { parsePeers, parsePositiveInteger } from '../shared/cli-helpers.js';
import type {
  Agency,
  ColdStartMode,
  IterationMode,
  LoopOptions,
} from './loop-types.js';
import {
  COLD_START_MODES,
  invalidIterationModeError,
  ITERATION_MODES,
  required,
} from './loop-validation.js';

export function parseLoopArgs(argv: string[]): LoopOptions {
  const parsed: {
    sectionFile?: string;
    outputRecords?: string;
    outputSection?: string;
    outputStatus?: string;
    peers?: string[];
    goal: string;
    maxRounds: number;
    iteration: string;
    coldStart: string;
    agency: string;
    synthesizer: string | null;
  } = {
    goal: '',
    maxRounds: 12,
    iteration: 'alternating',
    coldStart: 'shared_input',
    agency: 'moderate',
    synthesizer: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`${token} requires a value`);
      }
      return argv[index];
    };

    switch (token) {
      case '--section-file':
        parsed.sectionFile = next();
        break;
      case '--goal':
        parsed.goal = next();
        break;
      case '--peers':
        parsed.peers = parsePeers(next());
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(next(), '--max-rounds');
        break;
      case '--iteration':
        parsed.iteration = next();
        break;
      case '--synthesizer':
        parsed.synthesizer = next();
        break;
      case '--cold-start':
        parsed.coldStart = next();
        break;
      case '--agency':
        parsed.agency = next();
        break;
      case '--output-records':
        parsed.outputRecords = next();
        break;
      case '--output-section':
        parsed.outputSection = next();
        break;
      case '--output-status':
        parsed.outputStatus = next();
        break;
      default:
        throw new Error(`unknown option: ${token}`);
    }
  }

  if (!ITERATION_MODES.includes(parsed.iteration as IterationMode)) {
    throw invalidIterationModeError(parsed.iteration);
  }
  if (!COLD_START_MODES.includes(parsed.coldStart as ColdStartMode)) {
    throw new Error(
      `--cold-start must be one of ${COLD_START_MODES.join(', ')}`,
    );
  }
  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  required(parsed.sectionFile, '--section-file');
  required(parsed.peers, '--peers');
  required(parsed.outputRecords, '--output-records');
  required(parsed.outputSection, '--output-section');
  required(parsed.outputStatus, '--output-status');

  return {
    sectionFile: parsed.sectionFile,
    goal: parsed.goal,
    peers: parsed.peers,
    maxRounds: parsed.maxRounds,
    iteration: parsed.iteration as IterationMode,
    coldStart: parsed.coldStart as ColdStartMode,
    agency: parsed.agency as Agency,
    synthesizer: parsed.synthesizer,
    outputRecords: parsed.outputRecords,
    outputSection: parsed.outputSection,
    outputStatus: parsed.outputStatus,
  } as LoopOptions;
}
