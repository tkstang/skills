export interface CapturedWriter {
  stream: {
    write(chunk: unknown): void;
  };
  value(): string;
}

export interface RunNodeScriptOptions {
  cwd?: string | URL;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

export interface RunNodeScriptResult {
  stdout: string;
  stderr: string;
}

/** Absolute path to the repository root (parent of tests/). */
export const repoRoot: string;

/** Absolute path to the fixture stub binaries directory. */
export const fixtureBin: string;

/** Absolute path to the shared sample-input fixture. */
export const sampleInput: string;

/**
 * Build a stub process env that prepends the fixture bin directory to PATH.
 * Consensus tests use this to inject the paseo stub without touching real PATH.
 */
export function makeStubEnv(
  overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv;

export function captureWriter(): CapturedWriter;
export function parseJsonl<T = unknown>(contents: unknown): T[];

/** Read a JSON file and parse it. */
export function readJson<T = unknown>(filePath: string): Promise<T>;

export function runNodeScript(
  scriptPath: string,
  args?: readonly string[],
  options?: RunNodeScriptOptions,
): Promise<RunNodeScriptResult>;
