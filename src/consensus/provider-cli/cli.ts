#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { runConsensusCli } from './commands.js';

import type { ConsensusCliIo } from './commands.js';

export { helpText, runConsensusCli } from './commands.js';

function nodeIo(): ConsensusCliIo {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    cwd: process.cwd(),
    env: process.env,
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

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  runConsensusCli(process.argv.slice(2), nodeIo()).then((code) => {
    process.exitCode = code;
  });
}
