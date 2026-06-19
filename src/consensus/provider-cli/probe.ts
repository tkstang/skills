import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

import type { ProviderAdapter, ProviderAdapterRegistry } from './adapters.js';
import type { ProviderInventoryEntry } from './types.js';

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
): ProbeCommandRunner {
  return {
    findExecutable(command) {
      return findExecutable(command, env);
    },
    run(command, args) {
      return runProbeCommand(command, args, env);
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
): Promise<ProbeCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
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
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function providerEntry(
  adapter: ProviderAdapter,
  status: ProviderInventoryEntry['status'],
  options: {
    executable?: string;
    version?: string;
    warnings?: string[];
  } = {},
): ProviderInventoryEntry {
  return {
    id: adapter.id,
    status,
    capabilities: adapter.capabilities,
    ...(options.executable ? { executable: options.executable } : {}),
    ...(options.version ? { version: options.version } : {}),
    ...(options.warnings ? { diagnostics: { warnings: options.warnings } } : {}),
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
