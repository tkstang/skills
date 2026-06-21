import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import {
  ConsensusCliUsageError,
  normalizeRunRequest,
  parseConsensusCliArgs,
} from './args.js';
import { providerRegistry } from './adapters.js';
import {
  processExitForEnvelope,
  usageFailure,
} from './envelope.js';
import { evaluateHostGuard, hostContextFromEnv } from './host-guard.js';
import {
  nodeProbeCommandRunner,
  probeProviderRegistry,
} from './probe.js';
import { validateSchemaSubset } from './schema-validate.js';
import { runProviderTurn } from './structured-output.js';

import type { ParsedSubmitCommand, PromptSource } from './args.js';
import type {
  HostContext,
  ProviderCapabilities,
  ProviderDiagnostics,
  ProviderId,
  ProviderInventoryEntry,
} from './types.js';
import type { ProbeCommandRunner } from './probe.js';

export interface ConsensusCliIo {
  stdout: WritableLike;
  stderr: WritableLike;
  stdin: NodeJS.ReadStream;
  cwd: string;
  env?: Record<string, string | undefined>;
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

export interface WritableLike {
  write(chunk: unknown): unknown;
}

export interface ProviderListEnvelope {
  schema_version: 'v1';
  ok: true;
  providers: ProviderInventoryEntry[];
  diagnostics?: CommandDiagnostics;
}

export interface PreflightEnvelope {
  schema_version: 'v1';
  ok: true;
  usable: boolean;
  providers: ProviderInventoryEntry[];
  diagnostics?: CommandDiagnostics;
}

export interface CommandDiagnostics {
  warnings?: string[];
}

export interface SubmitResult {
  schema_version: 'v1';
  ok: boolean;
  captured?: boolean;
  message: string;
}

export interface ProviderCommandOptions {
  registry?: ProviderInventoryEntry[] | ProviderRegistryLoader;
  probeRunner?: ProbeCommandRunner;
}

export interface PreflightCommandOptions extends ProviderCommandOptions {
  provider?: ProviderId;
  host?: HostContext;
}

export interface ConsensusCliCommandOptions extends ProviderCommandOptions {}

export type ProviderRegistryLoader =
  () => ProviderInventoryEntry[] | Promise<ProviderInventoryEntry[]>;

export function helpText() {
  return `Usage: consensus <command> --json

Commands:
  provider ls --json
  preflight --json [--provider <id>] [--max-depth <n>]
  run --provider <id> --schema <path> --json [-|--prompt <text>|--prompt-file <path>]
      [--model <name>] [--effort <level>]
      [--permission-mode <mode>] [--sandbox <name>] [--approval-policy <policy>]
      [--env-allow <name>] [--max-attempts <n>] [--timeout-sec <n>]
      [--max-output-bytes <n>] [--cwd <path>] [--max-depth <n>]
  run --request-json <path|-> --json
`;
}

export async function runProviderList(
  options: ProviderCommandOptions = {},
): Promise<ProviderListEnvelope> {
  return {
    schema_version: 'v1',
    ok: true,
    providers: await resolveRegistry(options.registry, options),
  };
}

export async function runPreflight(
  options: PreflightCommandOptions = {},
): Promise<PreflightEnvelope> {
  const registry = await resolveRegistry(options.registry, options);
  const providers = applyHostGuardToProviders(
    selectProviders(registry, options.provider),
    options.host,
  );
  const usable = providers.every((provider) => provider.status === 'ready');
  const diagnostics =
    options.provider && providers[0]?.status === 'unsupported'
      ? {
          warnings: [
            `Requested provider is not registered: ${options.provider}`,
          ],
        }
      : undefined;

  return {
    schema_version: 'v1',
    ok: true,
    usable,
    providers,
    ...(diagnostics ? { diagnostics } : {}),
  };
}

export async function runSubmit(
  command: ParsedSubmitCommand,
  io: ConsensusCliIo,
): Promise<number> {
  const schemaPath = command.schemaPath ?? io.env?.CONSENSUS_SUBMIT_SCHEMA;
  if (!schemaPath) {
    return submitFailure(io, 'Missing submit schema path.', 2);
  }

  const outPath = command.outPath ?? io.env?.CONSENSUS_SUBMIT_FILE;
  if (!outPath) {
    return submitFailure(io, 'Missing submit output path.', 2);
  }

  if (!command.verdictSource) {
    return submitFailure(io, 'Missing verdict source.', 2);
  }
  if (command.verdictSource.kind === 'prompt') {
    return submitFailure(
      io,
      'Submit verdict source must be stdin or --verdict-file.',
      2,
    );
  }

  let schema: unknown;
  try {
    schema = JSON.parse(await io.readFile(schemaPath));
  } catch (error) {
    return submitFailure(
      io,
      `Could not read submit schema: ${error instanceof Error ? error.message : String(error)}`,
      2,
    );
  }

  let verdict: unknown;
  try {
    verdict = JSON.parse(await readSubmitSource(command.verdictSource, io));
  } catch (error) {
    return submitFailure(
      io,
      `Submitted verdict must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      1,
    );
  }

  const validation = validateSchemaSubset(verdict, schema);
  if (!validation.ok) {
    return submitFailure(io, validation.message, 1);
  }

  await writeJsonFileAtomic(outPath, `${JSON.stringify(verdict)}\n`);
  writeJson(io, {
    schema_version: 'v1',
    ok: true,
    captured: true,
    message: 'verdict captured',
  } satisfies SubmitResult);
  return 0;
}

export async function runConsensusCli(
  argv: readonly string[],
  io: ConsensusCliIo,
  options: ConsensusCliCommandOptions = {},
): Promise<number> {
  try {
    const command = parseConsensusCliArgs(argv);
    if (command.kind === 'help') {
      io.stdout.write(helpText());
      return 0;
    }
    if (command.kind === 'provider-list') {
      writeJson(
        io,
        await runProviderList(defaultProbeOptions(options, io.env)),
      );
      return 0;
    }
    if (command.kind === 'preflight') {
      writeJson(
        io,
        await runPreflight({
          ...defaultProbeOptions(options, io.env),
          provider: command.provider,
          host:
            command.maxDepth === undefined
              ? undefined
              : hostContextFromEnv(io.env ?? {}, io.cwd, command.maxDepth),
        }),
      );
      return 0;
    }

    const request = await normalizeRunRequest(command, io);
    const envelope = await runProviderTurn(request, {
      readSchema: async (schemaPath) =>
        JSON.parse(await io.readFile(schemaPath)),
      parentEnv: io.env,
    });
    writeJson(io, envelope);
    return processExitForEnvelope(envelope);
  } catch (error) {
    if (error instanceof ConsensusCliUsageError) {
      const envelope = usageFailure(error.message, error.details);
      writeJson(io, envelope);
      return processExitForEnvelope(envelope);
    }

    io.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

async function readSubmitSource(
  source: PromptSource,
  io: ConsensusCliIo,
): Promise<string> {
  if (source.kind === 'stdin') return io.readStdin();
  if (source.kind === 'file') return io.readFile(source.path);
  return source.value;
}

function submitFailure(
  io: ConsensusCliIo,
  message: string,
  exitCode: 1 | 2,
): 1 | 2 {
  writeJson(io, {
    schema_version: 'v1',
    ok: false,
    captured: false,
    message,
  } satisfies SubmitResult);
  io.stderr.write(`${message}\n`);
  return exitCode;
}

async function writeJsonFileAtomic(filePath: string, contents: string) {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempPath = join(
    directory,
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(tempPath, contents, 'utf8');
  await rename(tempPath, filePath);
}

function defaultProbeOptions(
  options: ConsensusCliCommandOptions,
  env: ConsensusCliIo['env'],
): ConsensusCliCommandOptions {
  if (options.registry || options.probeRunner) return options;
  return {
    ...options,
    probeRunner: nodeProbeCommandRunner(env ?? {}),
  };
}

export function writeJson(
  io: Pick<ConsensusCliIo, 'stdout'>,
  value: unknown,
) {
  io.stdout.write(`${JSON.stringify(value)}\n`);
}

function selectProviders(
  registry: ProviderInventoryEntry[],
  provider?: ProviderId,
) {
  if (!provider) return registry;

  const selected = registry.find((entry) => entry.id === provider);
  if (selected) return [selected];

  return [
    {
      id: provider,
      status: 'unsupported',
      capabilities: placeholderCapabilities(),
    } satisfies ProviderInventoryEntry,
  ];
}

function applyHostGuardToProviders(
  providers: ProviderInventoryEntry[],
  host: HostContext | undefined,
) {
  if (!host) return providers;

  return providers.map((provider) => {
    const result = evaluateHostGuard({ host, provider: provider.id });
    if (result.allowed) {
      return {
        ...provider,
        host_relation: result.host_relation,
        guard: result.guard,
        diagnostics: mergeDiagnostics(provider.diagnostics, result.diagnostics),
      };
    }

    return {
      ...provider,
      status: 'unavailable' as const,
      host_relation: result.host_relation,
      guard: result.guard,
      diagnostics: mergeDiagnostics(provider.diagnostics, result.diagnostics),
    };
  });
}

function mergeDiagnostics(
  current: ProviderDiagnostics | undefined,
  next: ProviderDiagnostics,
): ProviderDiagnostics {
  const warnings = [
    ...(current?.warnings ?? []),
    ...(next.warnings ?? []),
  ];

  return {
    ...current,
    ...next,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

async function resolveRegistry(
  registry: ProviderCommandOptions['registry'],
  options: Pick<ProviderCommandOptions, 'probeRunner'> = {},
) {
  if (Array.isArray(registry)) return registry;
  if (typeof registry === 'function') return registry();
  if (options.probeRunner) {
    return probeProviderRegistry({
      registry: providerRegistry(),
      runner: options.probeRunner,
    });
  }
  return defaultProviderRegistry();
}

function defaultProviderRegistry(): ProviderInventoryEntry[] {
  return providerRegistry().list().map((adapter) => ({
    id: adapter.id,
    status: 'missing',
    capabilities: adapter.capabilities,
  }));
}

function placeholderCapabilities(): ProviderCapabilities {
  return {
    schema_strategies: ['prompt_only'],
    output_modes: ['stdout_json'],
    options: {
      model: false,
      effort: null,
      runtime_policy: {
        env_allowlist: false,
      },
    },
    supports_submit_tool: false,
    supports_same_host_subprocess: false,
    supports_host_native_dispatch: false,
  };
}
