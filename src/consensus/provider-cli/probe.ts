import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

import type { ProviderAdapter, ProviderAdapterRegistry } from './adapters.js';
import { runProviderSubprocess } from './subprocess.js';
import type { ProviderInventoryEntry, ProviderDiagnostics } from './types.js';
import type { RunProviderSubprocessOptions } from './subprocess.js';

export interface ProviderProbeDefinition {
  version_args: readonly string[];
  auth_required_patterns?: readonly RegExp[];
  unavailable_patterns?: readonly RegExp[];
}

export interface ProbeCommandResult {
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  failure_code?:
    | 'PROVIDER_MISSING'
    | 'PROVIDER_TIMEOUT'
    | 'PROVIDER_OUTPUT_CAP_EXCEEDED'
    | 'PROVIDER_EXIT';
  diagnostics?: ProviderDiagnostics;
}

export interface ProbeCommandRunner {
  findExecutable(command: string): Promise<string | undefined>;
  run(command: string, args: readonly string[]): Promise<ProbeCommandResult>;
}

export interface ProviderProbeOptions {
  runner: ProbeCommandRunner;
}

export interface ProviderRegistryProbeOptions extends ProviderProbeOptions {
  registry: ProviderAdapterRegistry;
}

export interface NodeProbeCommandRunnerOptions {
  timeoutSec?: number;
  maxOutputBytes?: number;
  terminationGraceMs?: number;
  finalResolutionMs?: number;
}

const DEFAULT_PROBE_TIMEOUT_SEC = 10;
const DEFAULT_PROBE_MAX_OUTPUT_BYTES = 64 * 1024;

export async function probeProviderRegistry({
  registry,
  runner,
}: ProviderRegistryProbeOptions): Promise<ProviderInventoryEntry[]> {
  return Promise.all(
    registry.list().map((adapter) =>
      probeProviderReadiness(adapter, { runner }),
    ),
  );
}

export async function probeProviderReadiness(
  adapter: ProviderAdapter,
  options: ProviderProbeOptions,
): Promise<ProviderInventoryEntry> {
  const executable = await options.runner.findExecutable(adapter.executable);
  if (!executable) {
    return providerEntry(adapter, 'missing', {
      warnings: [
        `PROVIDER_MISSING: executable not found for ${adapter.id} (${adapter.executable})`,
      ],
    });
  }

  const result = await options.runner.run(
    adapter.executable,
    adapter.probe.version_args,
  );
  const probeFailure = probeFailureEntry(adapter, executable, result);
  if (probeFailure) return probeFailure;

  const output = `${result.stdout}\n${result.stderr}`;

  if (matchesAny(output, adapter.probe.auth_required_patterns)) {
    return providerEntry(adapter, 'auth_required', {
      executable,
      warnings: [`PROVIDER_AUTH_REQUIRED: ${firstNonEmptyLine(output)}`],
    });
  }

  if (
    result.code !== 0 ||
    matchesAny(output, adapter.probe.unavailable_patterns)
  ) {
    return providerEntry(adapter, 'unavailable', {
      executable,
      warnings: [`PROVIDER_UNAVAILABLE: ${firstNonEmptyLine(output)}`],
    });
  }

  return providerEntry(adapter, 'ready', {
    executable,
    version: firstNonEmptyLine(output),
  });
}

export function nodeProbeCommandRunner(
  env: NodeJS.ProcessEnv = process.env,
  options: NodeProbeCommandRunnerOptions = {},
): ProbeCommandRunner {
  return {
    findExecutable(command) {
      return findExecutable(command, env);
    },
    run(command, args) {
      return runProbeCommand(command, args, env, options);
    },
  };
}

async function findExecutable(
  command: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (command.includes(path.sep)) {
    return canExecute(command).then((ok) => (ok ? command : undefined));
  }

  const pathValue = env.PATH ?? '';
  for (const searchPath of pathValue.split(path.delimiter)) {
    if (!searchPath) continue;
    const candidate = path.join(searchPath, command);
    if (await canExecute(candidate)) return candidate;
  }
  return undefined;
}

async function canExecute(filePath: string) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runProbeCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options: NodeProbeCommandRunnerOptions,
): Promise<ProbeCommandResult> {
  const subprocessOptions: RunProviderSubprocessOptions = {
    env,
    timeoutSec: options.timeoutSec ?? DEFAULT_PROBE_TIMEOUT_SEC,
    maxOutputBytes: options.maxOutputBytes ?? DEFAULT_PROBE_MAX_OUTPUT_BYTES,
    ...(options.terminationGraceMs !== undefined
      ? { terminationGraceMs: options.terminationGraceMs }
      : {}),
    ...(options.finalResolutionMs !== undefined
      ? { finalResolutionMs: options.finalResolutionMs }
      : {}),
  };

  return runProviderSubprocess(
    {
      executable: command,
      argv: [...args],
      stdin: '',
      output_mode: 'stdout_json',
      strategy: 'prompt_only',
      redacted_command: [command, ...args],
      shell: false,
    },
    subprocessOptions,
  ).then((result) => ({
    code: result.exit_code,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.ok ? {} : { failure_code: result.code }),
    diagnostics: result.diagnostics,
  }));
}

function probeFailureEntry(
  adapter: ProviderAdapter,
  executable: string,
  result: ProbeCommandResult,
): ProviderInventoryEntry | undefined {
  if (!result.failure_code) return undefined;

  if (result.failure_code === 'PROVIDER_MISSING') {
    return providerEntry(adapter, 'missing', {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_MISSING: executable failed to start for ${adapter.id}`,
      ],
    });
  }

  if (result.failure_code === 'PROVIDER_TIMEOUT') {
    return providerEntry(adapter, 'unavailable', {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_TIMEOUT: readiness probe timed out after ${result.diagnostics?.timeout_sec ?? 'the configured'} seconds`,
      ],
    });
  }

  if (result.failure_code === 'PROVIDER_OUTPUT_CAP_EXCEEDED') {
    return providerEntry(adapter, 'unavailable', {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_OUTPUT_CAP_EXCEEDED: readiness probe exceeded output cap of ${result.diagnostics?.output_bytes?.max ?? 'the configured limit'} bytes`,
      ],
    });
  }

  return undefined;
}

function providerEntry(
  adapter: ProviderAdapter,
  status: ProviderInventoryEntry['status'],
  options: {
    executable?: string;
    version?: string;
    diagnostics?: ProviderDiagnostics;
    warnings?: string[];
  } = {},
): ProviderInventoryEntry {
  const diagnostics = mergeProviderDiagnostics(
    options.diagnostics,
    options.warnings,
  );

  return {
    id: adapter.id,
    status,
    capabilities: adapter.capabilities,
    ...(options.executable ? { executable: options.executable } : {}),
    ...(options.version ? { version: options.version } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  };
}

function mergeProviderDiagnostics(
  diagnostics: ProviderDiagnostics | undefined,
  warnings: string[] | undefined,
): ProviderDiagnostics | undefined {
  if (!diagnostics && !warnings) return undefined;
  const mergedWarnings = [
    ...(diagnostics?.warnings ?? []),
    ...(warnings ?? []),
  ];
  return {
    ...(diagnostics ?? {}),
    ...(mergedWarnings.length > 0 ? { warnings: mergedWarnings } : {}),
  };
}

function matchesAny(value: string, patterns: readonly RegExp[] | undefined) {
  return patterns?.some((pattern) => pattern.test(value)) ?? false;
}

function firstNonEmptyLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}
