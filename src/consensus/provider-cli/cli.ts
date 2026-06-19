#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import {
  ConsensusCliUsageError,
  parseConsensusCliArgs,
} from './args.js';
import {
  processExitForEnvelope,
  usageFailure,
} from './envelope.js';

import type { ConsensusCliRunEnvelope } from './types.js';

export interface ConsensusCliIo {
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  stderr: Pick<NodeJS.WriteStream, 'write'>;
  stdin: NodeJS.ReadStream;
  cwd: string;
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

export function helpText() {
  return `Usage: consensus <command> --json

Commands:
  provider ls --json
  preflight --json [--provider <id>] [--max-depth <n>]
  run --provider <id> --schema <path> --json [-|--prompt <text>|--prompt-file <path>]
  run --request-json <path|-> --json
`;
}

export async function runConsensusCli(
  argv: readonly string[] = process.argv.slice(2),
  io: ConsensusCliIo = nodeIo(),
): Promise<number> {
  try {
    const command = parseConsensusCliArgs(argv);
    if (command.kind === 'help') {
      io.stdout.write(helpText());
      return 0;
    }

    const envelope = usageFailure(
      `Command is not implemented yet: ${command.kind}`,
    );
    writeEnvelope(io, envelope);
    return processExitForEnvelope(envelope);
  } catch (error) {
    if (error instanceof ConsensusCliUsageError) {
      const envelope = usageFailure(error.message, error.details);
      writeEnvelope(io, envelope);
      return processExitForEnvelope(envelope);
    }

    io.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

export function writeEnvelope(
  io: Pick<ConsensusCliIo, 'stdout'>,
  envelope: ConsensusCliRunEnvelope,
) {
  io.stdout.write(`${JSON.stringify(envelope)}\n`);
}

function nodeIo(): ConsensusCliIo {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    cwd: process.cwd(),
    readFile: (filePath) => readFile(filePath, 'utf8'),
    readStdin: () => readAllStdin(process.stdin),
  };
}

function readAllStdin(stdin: NodeJS.ReadStream): Promise<string> {
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    stdin.on('data', (chunk) => {
      value += chunk;
    });
    stdin.on('error', reject);
    stdin.on('end', () => {
      resolve(value);
    });
    stdin.resume();
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runConsensusCli().then((code) => {
    process.exitCode = code;
  });
}
