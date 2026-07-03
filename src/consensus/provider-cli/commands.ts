import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import {
  clearConsensusConfig,
  parseConsensusDefaultsConfig,
  readConsensusConfig,
  resolveConsensusComposition,
  writeConsensusConfig,
} from '../config/consensus-config.js';
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
import {
  assertWithinSubmitCaptureLimit,
  CONSENSUS_SUBMIT_MAX_BYTES_ENV,
  parseSubmitCaptureMaxBytes,
  SubmitCaptureLimitError,
} from './submit-capture.js';

import type {
  ParsedConfigClearCommand,
  ParsedConfigGetCommand,
  ParsedConfigSetCommand,
  ParsedSubmitCommand,
  PromptSource,
} from './args.js';
import type {
  ConsensusAgentRef,
  ConsensusConfigKey,
  ConsensusConfigScope,
  ConsensusCompositionSource,
  ConsensusDefaultsConfig,
  ConsensusWorkflow,
} from '../config/consensus-config.js';
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
  readFile(path: string, maxBytes?: number): Promise<string>;
  readStdin(maxBytes?: number): Promise<string>;
  writeSubmitCapture?(path: string, contents: string): Promise<void>;
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

export interface ConfigScopedEnvelope {
  schema_version: 'v1';
  ok: true;
  scope: 'user' | 'project';
  config: ConsensusDefaultsConfig | null;
}

export interface ConfigEffectiveEnvelope {
  schema_version: 'v1';
  ok: true;
  scope: 'effective';
  source: ConsensusCompositionSource;
  config: ConsensusDefaultsConfig;
  workflow?: ConsensusWorkflow;
  agents?: ConsensusAgentRef[];
  diagnostics?: CommandDiagnostics;
}

export interface ConfigListEnvelope {
  schema_version: 'v1';
  ok: true;
  scopes: ['user', 'project', 'effective'];
  writable_scopes: ['user', 'project'];
  keys: ['peers', 'panelists', 'panel-size', 'roles', 'all'];
  workflows: ['convergence', 'panel'];
}

export interface ConfigSetEnvelope {
  schema_version: 'v1';
  ok: true;
  scope: ConsensusConfigScope;
  config: ConsensusDefaultsConfig;
}

export interface ConfigClearEnvelope {
  schema_version: 'v1';
  ok: true;
  scope: ConsensusConfigScope;
  key: ConsensusConfigKey;
  config: ConsensusDefaultsConfig | null;
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
  config get --json [--scope user|project|effective] [--workflow convergence|panel] [--cwd <path>]
  config list --json [--cwd <path>]
  config set --json --scope user|project [--peers <a,b>] [--panelists <a,b,c>]
      [--panel-size <n>] [--from-file <path>] [--cwd <path>]
  config clear --json --scope user|project [--key peers|panelists|panel-size|roles|all] [--cwd <path>]
  provider ls --json
  preflight --json [--provider <id>] [--max-depth <n>]
  submit --json [-|--verdict-file <path>] [--schema <path>] [--out <path>]
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

  const maxSubmitBytes = parseSubmitCaptureMaxBytes(
    io.env?.[CONSENSUS_SUBMIT_MAX_BYTES_ENV],
  );
  if (maxSubmitBytes === undefined) {
    return submitFailure(io, 'Invalid submit capture byte limit.', 2);
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

  let rawVerdict: string;
  try {
    rawVerdict = await readSubmitSource(
      command.verdictSource,
      io,
      maxSubmitBytes,
    );
    assertWithinSubmitCaptureLimit(rawVerdict, maxSubmitBytes);
  } catch (error) {
    return submitFailure(
      io,
      error instanceof Error ? error.message : String(error),
      1,
    );
  }

  let verdict: unknown;
  try {
    verdict = JSON.parse(rawVerdict);
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

  const captureContents = `${JSON.stringify(verdict)}\n`;
  try {
    assertWithinSubmitCaptureLimit(captureContents, maxSubmitBytes);
  } catch (error) {
    return submitFailure(
      io,
      error instanceof SubmitCaptureLimitError
        ? error.message
        : `Could not size submit capture: ${error instanceof Error ? error.message : String(error)}`,
      1,
    );
  }

  try {
    await (io.writeSubmitCapture ?? writeJsonFileAtomic)(
      outPath,
      captureContents,
    );
  } catch (error) {
    return submitFailure(
      io,
      `Could not write submit capture: ${error instanceof Error ? error.message : String(error)}`,
      1,
    );
  }

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
    if (command.kind === 'config-list') {
      writeJson(io, runConfigList());
      return 0;
    }
    if (command.kind === 'config-get') {
      writeJson(io, await runConfigGet(command, io, options));
      return 0;
    }
    if (command.kind === 'config-set') {
      writeJson(io, await runConfigSet(command, io));
      return 0;
    }
    if (command.kind === 'config-clear') {
      writeJson(io, await runConfigClear(command, io));
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
    if (command.kind === 'submit') {
      return runSubmit(command, io);
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

function runConfigList(): ConfigListEnvelope {
  return {
    schema_version: 'v1',
    ok: true,
    scopes: ['user', 'project', 'effective'],
    writable_scopes: ['user', 'project'],
    keys: ['peers', 'panelists', 'panel-size', 'roles', 'all'],
    workflows: ['convergence', 'panel'],
  };
}

async function runConfigGet(
  command: ParsedConfigGetCommand,
  io: ConsensusCliIo,
  options: ConsensusCliCommandOptions,
): Promise<ConfigScopedEnvelope | ConfigEffectiveEnvelope> {
  const cwd = command.cwd ?? io.cwd;
  if (command.scope === 'user' || command.scope === 'project') {
    return {
      schema_version: 'v1',
      ok: true,
      scope: command.scope,
      config: await readConsensusConfig({
        scope: command.scope,
        cwd,
        env: io.env,
      }),
    };
  }

  const effective = await readEffectiveConfig(cwd, io.env);
  if (!command.workflow) {
    return {
      schema_version: 'v1',
      ok: true,
      scope: 'effective',
      source: effective.source,
      config: effective.config,
      diagnostics: { warnings: [] },
    };
  }

  const composition = await resolveConsensusComposition({
    workflow: command.workflow,
    cwd,
    env: io.env,
    inventory: await resolveRegistry(
      options.registry,
      defaultProbeOptions(options, io.env),
    ),
  });

  return {
    schema_version: 'v1',
    ok: true,
    scope: 'effective',
    source: composition.source,
    config: effective.config,
    workflow: composition.workflow,
    agents: composition.agents,
    diagnostics: { warnings: composition.warnings },
  };
}

async function runConfigSet(
  command: ParsedConfigSetCommand,
  io: ConsensusCliIo,
): Promise<ConfigSetEnvelope> {
  const cwd = command.cwd ?? io.cwd;
  const patch = parseConfigSetPatch(command);
  if (!command.fromFile && Object.keys(patch).length === 1) {
    throw new ConsensusCliUsageError(
      'config set requires --peers, --panelists, --panel-size, or --from-file',
    );
  }

  const base = command.fromFile
    ? await readConfigFromFile(command.fromFile, io)
    : ((await readConsensusConfig({
        scope: command.scope,
        cwd,
        env: io.env,
      })) ?? { schema_version: 'v1' });
  const config = parseConfigForCli({
    ...base,
    ...patch,
  });

  await writeConsensusConfig({
    scope: command.scope,
    cwd,
    env: io.env,
    config,
  });

  return {
    schema_version: 'v1',
    ok: true,
    scope: command.scope,
    config,
  };
}

async function runConfigClear(
  command: ParsedConfigClearCommand,
  io: ConsensusCliIo,
): Promise<ConfigClearEnvelope> {
  const cwd = command.cwd ?? io.cwd;
  await clearConsensusConfig({
    scope: command.scope,
    cwd,
    env: io.env,
    key: command.key,
  });

  return {
    schema_version: 'v1',
    ok: true,
    scope: command.scope,
    key: command.key,
    config: await readConsensusConfig({
      scope: command.scope,
      cwd,
      env: io.env,
    }),
  };
}

async function readEffectiveConfig(
  cwd: string,
  env: ConsensusCliIo['env'],
): Promise<{
  source: 'project' | 'user' | 'built-in';
  config: ConsensusDefaultsConfig;
}> {
  const user = await readConsensusConfig({ scope: 'user', cwd, env });
  const project = await readConsensusConfig({ scope: 'project', cwd, env });
  const config = mergeConfigs(user, project);
  const source = configHasDefaults(project)
    ? 'project'
    : configHasDefaults(user)
      ? 'user'
      : 'built-in';
  return { source, config };
}

function mergeConfigs(
  user: ConsensusDefaultsConfig | null,
  project: ConsensusDefaultsConfig | null,
): ConsensusDefaultsConfig {
  const config: ConsensusDefaultsConfig = { schema_version: 'v1' };
  mergeConfigFields(config, user);
  mergeConfigFields(config, project);
  return config;
}

function mergeConfigFields(
  target: ConsensusDefaultsConfig,
  source: ConsensusDefaultsConfig | null,
) {
  if (!source) return;
  if (source.peers !== undefined) target.peers = source.peers;
  if (source.panelists !== undefined) target.panelists = source.panelists;
  if (source.panel_size !== undefined) target.panel_size = source.panel_size;
  if (source.roles !== undefined) target.roles = source.roles;
}

function configHasDefaults(
  config: ConsensusDefaultsConfig | null,
): config is ConsensusDefaultsConfig {
  return (
    config !== null &&
    (config.peers !== undefined ||
      config.panelists !== undefined ||
      config.panel_size !== undefined ||
      config.roles !== undefined)
  );
}

async function readConfigFromFile(
  filePath: string,
  io: ConsensusCliIo,
): Promise<ConsensusDefaultsConfig> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await io.readFile(filePath));
  } catch (error) {
    throw new ConsensusCliUsageError(
      `Malformed consensus config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseConfigForCli(parsed);
}

function parseConfigForCli(value: unknown): ConsensusDefaultsConfig {
  try {
    return parseConsensusDefaultsConfig(value);
  } catch (error) {
    throw new ConsensusCliUsageError(
      `Malformed consensus config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseConfigSetPatch(
  command: ParsedConfigSetCommand,
): Partial<ConsensusDefaultsConfig> & { schema_version: 'v1' } {
  const patch: Partial<ConsensusDefaultsConfig> & { schema_version: 'v1' } = {
    schema_version: 'v1',
  };
  if (command.peers !== undefined) {
    patch.peers = parseAgentSpecList(command.peers);
  }
  if (command.panelists !== undefined) {
    patch.panelists = parseAgentSpecList(command.panelists);
  }
  if (command.panelSize !== undefined) {
    patch.panel_size = command.panelSize;
  }
  return patch;
}

function parseAgentSpecList(value: string): ConsensusAgentRef[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map(parseAgentSpec);
}

function parseAgentSpec(value: string): ConsensusAgentRef {
  const [provider, model, effort, extra] = value.split(':');
  if (extra !== undefined) {
    throw new ConsensusCliUsageError(
      'Agent specs must use provider[:model[:effort]]',
    );
  }

  const agent: ConsensusAgentRef = { provider };
  if (model !== undefined && model.length > 0) agent.model = model;
  if (effort !== undefined && effort.length > 0) agent.effort = effort;
  return agent;
}

async function readSubmitSource(
  source: PromptSource,
  io: ConsensusCliIo,
  maxBytes: number,
): Promise<string> {
  if (source.kind === 'stdin') return io.readStdin(maxBytes);
  if (source.kind === 'file') return io.readFile(source.path, maxBytes);
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
