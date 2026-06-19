export interface CapturedWriter {
  stream: {
    write(chunk: unknown): void;
  };
  value(): string;
}

export interface RunNodeScriptOptions {
  cwd?: string | URL;
  env?: NodeJS.ProcessEnv;
  input?: string;
  maxBuffer?: number;
}

export interface RunNodeScriptResult {
  stdout: string;
  stderr: string;
}

export interface RunNodeScriptProcessResult extends RunNodeScriptResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

/** Absolute path to the repository root (parent of tests/). */
export const repoRoot: string;

/** Absolute path to the fixture stub binaries directory. */
export const fixtureBin: string;

/** Absolute path to the shared consensus CLI fixture. */
export const consensusCliFixture: string;

/** Absolute path to the shared sample-input fixture. */
export const sampleInput: string;

/**
 * Build a stub process env that prepends the fixture bin directory to PATH.
 * Consensus tests use this to inject fixture binaries without touching real PATH.
 */
export function makeStubEnv(
  overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv;

/**
 * Build a stub process env that routes wrappers through the owned consensus CLI
 * fixture.
 */
export function makeProviderCliEnv(
  overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv;

export function captureWriter(): CapturedWriter;
export function parseJsonl<T = unknown>(contents: unknown): T[];

/** Read a JSON file and parse it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readJson(filePath: string): Promise<any>;

export function runNodeScript(
  scriptPath: string,
  args?: readonly string[],
  options?: RunNodeScriptOptions,
): Promise<RunNodeScriptResult>;

export function runNodeScriptResult(
  scriptPath: string,
  args?: readonly string[],
  options?: RunNodeScriptOptions,
): Promise<RunNodeScriptProcessResult>;
