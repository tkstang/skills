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

export function captureWriter(): CapturedWriter;
export function parseJsonl<T = unknown>(contents: unknown): T[];
export function runNodeScript(
  scriptPath: string,
  args?: readonly string[],
  options?: RunNodeScriptOptions,
): Promise<RunNodeScriptResult>;
