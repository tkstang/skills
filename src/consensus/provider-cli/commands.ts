import {
  ConsensusCliUsageError,
  normalizeRunRequest,
  parseConsensusCliArgs,
} from './args.js';
import {
  processExitForEnvelope,
  usageFailure,
} from './envelope.js';

import type {
  ProviderCapabilities,
  ProviderId,
  ProviderInventoryEntry,
} from './types.js';

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

export interface ProviderCommandOptions {
  registry?: ProviderInventoryEntry[] | ProviderRegistryLoader;
}

export interface PreflightCommandOptions extends ProviderCommandOptions {
  provider?: ProviderId;
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
    providers: await resolveRegistry(options.registry),
  };
}

export async function runPreflight(
  options: PreflightCommandOptions = {},
): Promise<PreflightEnvelope> {
  const registry = await resolveRegistry(options.registry);
  const providers = selectProviders(registry, options.provider);
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
      writeJson(io, await runProviderList(options));
      return 0;
    }
    if (command.kind === 'preflight') {
      writeJson(
        io,
        await runPreflight({
          ...options,
          provider: command.provider,
        }),
      );
      return 0;
    }

    await normalizeRunRequest(command, io);
    const envelope = usageFailure('Command is not implemented yet: run');
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

async function resolveRegistry(
  registry: ProviderCommandOptions['registry'],
) {
  if (Array.isArray(registry)) return registry;
  if (typeof registry === 'function') return registry();
  return defaultProviderRegistry();
}

function defaultProviderRegistry(): ProviderInventoryEntry[] {
  return ['claude', 'codex', 'cursor'].map((id) => ({
    id,
    status: 'missing',
    capabilities: placeholderCapabilities(),
  }));
}

function placeholderCapabilities(): ProviderCapabilities {
  return {
    schema_strategies: ['prompt_only'],
    output_modes: ['stdout_json'],
    options: {
      model: true,
      effort: null,
      runtime_policy: {
        env_allowlist: true,
      },
    },
    supports_submit_tool: false,
    supports_same_host_subprocess: true,
    supports_host_native_dispatch: false,
  };
}
