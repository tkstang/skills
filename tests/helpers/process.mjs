import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Absolute path to the repository root (parent of tests/). */
export const repoRoot = path.resolve(
  new URL('../..', import.meta.url).pathname,
);

/** Absolute path to the fixture stub binaries directory. */
export const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');

/** Absolute path to the shared consensus CLI fixture. */
export const consensusCliFixture = path.join(fixtureBin, 'consensus');

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

/**
 * Build a stub process env that routes wrappers through the owned consensus CLI
 * fixture instead of the legacy Paseo fixture.
 */
export function makeProviderCliEnv(overrides = {}) {
  return makeStubEnv({
    CONSENSUS_PROVIDER_BACKEND: 'provider-cli',
    CONSENSUS_CLI_PATH: consensusCliFixture,
    ...overrides,
  });
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
  const result = await runNodeScriptResult(scriptPath, args, options);
  if (result.code === 0) {
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  const error = new Error(
    `Command failed with exit code ${result.code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  error.stdout = result.stdout;
  error.stderr = result.stderr;
  error.code = result.code;
  throw error;
}

export function runNodeScriptResult(scriptPath, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve({
        code,
        signal,
        stdout,
        stderr,
      });
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}
