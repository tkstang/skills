#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';

import { runConsensusCli } from './commands.js';
import {
  byteLength,
  SubmitCaptureLimitError,
} from './submit-capture.js';

import type { ConsensusCliIo } from './commands.js';

export { helpText, runConsensusCli } from './commands.js';

function nodeIo(): ConsensusCliIo {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    cwd: process.cwd(),
    env: process.env,
    readFile: (filePath, maxBytes) => readUtf8File(filePath, maxBytes),
    readStdin: (maxBytes) => readAllStdin(process.stdin, maxBytes),
  };
}

async function readUtf8File(
  filePath: string,
  maxBytes: number | undefined,
): Promise<string> {
  if (maxBytes !== undefined) {
    const file = await stat(filePath);
    if (file.size > maxBytes) {
      throw new SubmitCaptureLimitError(file.size, maxBytes);
    }
  }

  const contents = await readFile(filePath, 'utf8');
  if (maxBytes !== undefined && byteLength(contents) > maxBytes) {
    throw new SubmitCaptureLimitError(byteLength(contents), maxBytes);
  }
  return contents;
}

function readAllStdin(
  stdin: NodeJS.ReadStream,
  maxBytes: number | undefined,
): Promise<string> {
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    let bytes = 0;
    stdin.on('data', (chunk) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      if (maxBytes !== undefined) {
        bytes += byteLength(text);
        if (bytes > maxBytes) {
          reject(new SubmitCaptureLimitError(bytes, maxBytes));
          stdin.destroy();
          return;
        }
      }
      value += text;
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
