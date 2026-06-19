import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Absolute path to the repository root (parent of tests/). */
export const repoRoot = path.resolve(
  new URL('../..', import.meta.url).pathname,
);

/** Absolute path to the fixture stub binaries directory. */
export const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');

/** Absolute path to the shared sample-input fixture. */
export const sampleInput = path.join(
  repoRoot,
  'tests/fixtures/sample-input.md',
);

/**
 * Build a stub process env that prepends the fixture bin directory to PATH.
 * Consensus tests use this to inject the paseo stub without touching real PATH.
 */
export function makeStubEnv(overrides = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides,
  };
}

export function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

export function parseJsonl(contents) {
  return String(contents)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Read a JSON file and parse it. */
export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function runNodeScript(scriptPath, args = [], options = {}) {
  try {
    return await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: options.cwd,
      env: options.env,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
    });
  } catch (error) {
    error.message = `${error.message}\nstdout:\n${error.stdout ?? ''}\nstderr:\n${error.stderr ?? ''}`;
    throw error;
  }
}
