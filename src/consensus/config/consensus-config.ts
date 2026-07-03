import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type {
  ProviderId,
  ProviderInventoryEntry,
} from '../provider-cli/types.js';

export type ConsensusWorkflow = 'convergence' | 'panel';
export type ConsensusConfigScope = 'user' | 'project';
export type ConsensusConfigKey =
  | 'peers'
  | 'panelists'
  | 'panel-size'
  | 'roles'
  | 'all';
export type ConsensusCompositionSource =
  | 'invocation'
  | 'project'
  | 'user'
  | 'built-in';

export interface ConsensusAgentRef {
  provider: ProviderId;
  model?: string;
  effort?: string;
}

export interface ConsensusRolesConfig {
  panelist?: ConsensusAgentRef[];
  advisor?: ConsensusAgentRef;
  synthesizer?: ConsensusAgentRef;
}

export interface ConsensusDefaults {
  peers?: ConsensusAgentRef[];
  panelists?: ConsensusAgentRef[];
  panel_size?: number;
  roles?: ConsensusRolesConfig;
}

export interface ConsensusDefaultsConfig {
  schema_version: 'v1';
  defaults?: ConsensusDefaults;
}

export interface ConsensusConfigIo {
  scope: ConsensusConfigScope;
  cwd: string;
  env?: Record<string, string | undefined>;
}

export interface WriteConsensusConfigInput extends ConsensusConfigIo {
  config: ConsensusDefaultsConfig;
}

export interface ClearConsensusConfigInput extends ConsensusConfigIo {
  key?: ConsensusConfigKey;
}

export interface ResolveConsensusCompositionInput {
  workflow: ConsensusWorkflow;
  invocation?: ConsensusDefaults;
  cwd: string;
  env?: Record<string, string | undefined>;
  inventory?: ProviderInventoryEntry[];
}

export interface ResolvedConsensusComposition {
  source: ConsensusCompositionSource;
  workflow: ConsensusWorkflow;
  agents: ConsensusAgentRef[];
  warnings: string[];
}

interface ConfigCandidate {
  source: ConsensusCompositionSource;
  config: ConsensusDefaultsConfig;
}

const BUILT_IN_PROVIDER_ORDER: ProviderId[] = ['claude', 'codex'];
const CONFIG_KEYS = new Set(['schema_version', 'defaults']);
const DEFAULTS_KEYS = new Set(['peers', 'panelists', 'panel_size', 'roles']);
const AGENT_KEYS = new Set(['provider', 'model', 'effort']);
const ROLE_KEYS = new Set(['panelist', 'advisor', 'synthesizer']);

export function parseConsensusDefaultsConfig(
  value: unknown,
): ConsensusDefaultsConfig {
  if (!isRecord(value)) {
    throw new Error('Consensus config must be an object');
  }
  assertKnownKeys(value, CONFIG_KEYS, 'Consensus config');

  if (value.schema_version !== 'v1') {
    throw new Error('Consensus config schema_version must be "v1"');
  }

  const config: ConsensusDefaultsConfig = { schema_version: 'v1' };
  if (value.defaults !== undefined) {
    config.defaults = parseConsensusDefaults(value.defaults);
  }

  return config;
}

function parseConsensusDefaults(value: unknown): ConsensusDefaults {
  if (!isRecord(value)) {
    throw new Error('Consensus config defaults must be an object');
  }
  assertKnownKeys(value, DEFAULTS_KEYS, 'Consensus config defaults');

  const defaults: ConsensusDefaults = {};

  if (value.peers !== undefined) {
    defaults.peers = parseAgentList(value.peers, {
      label: 'Consensus config peers',
      exactLength: 2,
    });
  }
  if (value.panelists !== undefined) {
    defaults.panelists = parseAgentList(value.panelists, {
      label: 'Consensus config panelists',
      minLength: 2,
    });
  }
  if (value.panel_size !== undefined) {
    defaults.panel_size = parsePanelSize(value.panel_size);
  }
  if (value.roles !== undefined) {
    defaults.roles = parseRolesConfig(value.roles);
  }

  return defaults;
}

export async function readConsensusConfig(
  input: ConsensusConfigIo,
): Promise<ConsensusDefaultsConfig | null> {
  const configPath = await consensusConfigPath(input);
  let contents: string;
  try {
    contents = await readFile(configPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Could not parse consensus config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return parseConsensusDefaultsConfig(parsed);
}

export async function writeConsensusConfig(
  input: WriteConsensusConfigInput,
): Promise<void> {
  const configPath = await consensusConfigPath(input);
  const config = parseConsensusDefaultsConfig(input.config);
  await writeJsonAtomic(configPath, config);
}

export async function clearConsensusConfig(
  input: ClearConsensusConfigInput,
): Promise<void> {
  const key = input.key ?? 'all';
  const configPath = await consensusConfigPath(input);

  if (key === 'all') {
    await rm(configPath, { force: true });
    return;
  }

  const existing = await readConsensusConfig(input);
  if (!existing) return;

  const defaults: ConsensusDefaults = { ...(existing.defaults ?? {}) };
  if (key === 'peers') {
    delete defaults.peers;
  } else if (key === 'panelists') {
    delete defaults.panelists;
  } else if (key === 'panel-size') {
    delete defaults.panel_size;
  } else if (key === 'roles') {
    delete defaults.roles;
  } else {
    assertNever(key);
  }

  const next: ConsensusDefaultsConfig = { schema_version: 'v1' };
  if (hasConsensusDefaults(defaults)) next.defaults = defaults;
  await writeJsonAtomic(configPath, next);
}

export async function consensusConfigPath(
  input: ConsensusConfigIo,
): Promise<string> {
  if (input.scope === 'user') {
    return path.join(userConfigDir(input.env), 'consensus', 'config.json');
  }

  return path.join(path.resolve(input.cwd), '.consensus', 'config.json');
}

export async function resolveConsensusComposition(
  input: ResolveConsensusCompositionInput,
): Promise<ResolvedConsensusComposition> {
  const candidates = await loadCandidates(input);
  if (input.workflow === 'convergence') {
    return resolveConvergenceComposition(input, candidates);
  }
  return resolvePanelComposition(input, candidates);
}

async function loadCandidates(
  input: ResolveConsensusCompositionInput,
): Promise<ConfigCandidate[]> {
  const candidates: ConfigCandidate[] = [];
  if (input.invocation && hasConsensusDefaults(input.invocation)) {
    candidates.push({
      source: 'invocation',
      config: {
        schema_version: 'v1',
        defaults: parseConsensusDefaults(input.invocation),
      },
    });
  }

  const project = await readConsensusConfig({
    scope: 'project',
    cwd: input.cwd,
    env: input.env,
  });
  if (project) candidates.push({ source: 'project', config: project });

  const user = await readConsensusConfig({
    scope: 'user',
    cwd: input.cwd,
    env: input.env,
  });
  if (user) candidates.push({ source: 'user', config: user });

  return candidates;
}

function resolveConvergenceComposition(
  input: ResolveConsensusCompositionInput,
  candidates: ConfigCandidate[],
): ResolvedConsensusComposition {
  const candidate = candidates.find(
    ({ config }) => config.defaults?.peers !== undefined,
  );
  const peers = candidate?.config.defaults?.peers;
  if (peers) {
    return {
      source: candidate.source,
      workflow: 'convergence',
      agents: peers,
      warnings: inventoryWarnings(peers, input.inventory),
    };
  }

  return {
    source: 'built-in',
    workflow: 'convergence',
    agents: builtInConvergenceAgents(2),
    warnings: [],
  };
}

function resolvePanelComposition(
  input: ResolveConsensusCompositionInput,
  candidates: ConfigCandidate[],
): ResolvedConsensusComposition {
  const panelistsCandidate = candidates.find(
    ({ config }) => config.defaults?.panelists !== undefined,
  );
  const firstPanelSizeCandidate = candidates.find(
    ({ config }) => config.defaults?.panel_size !== undefined,
  );
  const panelSizeCandidate =
    panelistsCandidate?.source === 'invocation' &&
    firstPanelSizeCandidate?.source !== 'invocation'
      ? undefined
      : firstPanelSizeCandidate;
  const source =
    panelSizeCandidate?.source === 'invocation'
      ? 'invocation'
      : panelistsCandidate?.source ?? panelSizeCandidate?.source;
  const configuredPanelists = panelistsCandidate?.config.defaults?.panelists;
  const targetSize =
    panelSizeCandidate?.config.defaults?.panel_size ??
    configuredPanelists?.length ??
    2;

  const selected = selectPanelAgents(
    configuredPanelists ?? builtInAgents(input.inventory, 2),
    targetSize,
    input.inventory,
  );
  const warnings = [
    ...inventoryWarnings(configuredPanelists ?? [], input.inventory),
  ];

  if (selected.length < targetSize) {
    warnings.push(
      `Only ${selected.length} panelists are available for requested panel_size ${targetSize}.`,
    );
  }

  if (selected.length < 2) {
    selected.push(...missingBuiltInAgents(selected).slice(0, 2 - selected.length));
  }

  return {
    source: source ?? 'built-in',
    workflow: 'panel',
    agents: selected,
    warnings,
  };
}

function selectPanelAgents(
  configuredPanelists: ConsensusAgentRef[],
  targetSize: number,
  inventory: ProviderInventoryEntry[] | undefined,
): ConsensusAgentRef[] {
  const selected = configuredPanelists.slice(0, targetSize);
  if (selected.length >= targetSize) return selected;

  const seen = new Set(selected.map((agent) => agent.provider));
  for (const entry of inventory ?? []) {
    if (selected.length >= targetSize) break;
    if (entry.status !== 'ready' || seen.has(entry.id)) continue;
    selected.push({ provider: entry.id });
    seen.add(entry.id);
  }

  if (selected.length < 2) {
    for (const agent of missingBuiltInAgents(selected)) {
      selected.push(agent);
      if (selected.length >= 2) break;
    }
  }

  return selected;
}

function builtInAgents(
  inventory: ProviderInventoryEntry[] | undefined,
  count: number,
): ConsensusAgentRef[] {
  const ready = (inventory ?? [])
    .filter((entry) => entry.status === 'ready')
    .map((entry) => ({ provider: entry.id }));
  const selected = ready.slice(0, count);
  for (const agent of missingBuiltInAgents(selected)) {
    if (selected.length >= count) break;
    selected.push(agent);
  }
  return selected;
}

function builtInConvergenceAgents(count: number): ConsensusAgentRef[] {
  return BUILT_IN_PROVIDER_ORDER.slice(0, count).map((provider) => ({
    provider,
  }));
}

function missingBuiltInAgents(
  current: readonly ConsensusAgentRef[],
): ConsensusAgentRef[] {
  const seen = new Set(current.map((agent) => agent.provider));
  return BUILT_IN_PROVIDER_ORDER.filter((provider) => !seen.has(provider)).map(
    (provider) => ({ provider }),
  );
}

function inventoryWarnings(
  agents: readonly ConsensusAgentRef[],
  inventory: ProviderInventoryEntry[] | undefined,
): string[] {
  if (!inventory || inventory.length === 0) return [];

  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const warnings: string[] = [];
  for (const agent of agents) {
    const entry = byId.get(agent.provider);
    if (!entry) {
      warnings.push(`Configured provider is not registered: ${agent.provider}`);
    } else if (entry.status !== 'ready') {
      warnings.push(
        `Configured provider is not ready: ${agent.provider} (${entry.status})`,
      );
    }
  }
  return warnings;
}

function parseAgentList(
  value: unknown,
  options: {
    label: string;
    minLength?: number;
    exactLength?: number;
  },
): ConsensusAgentRef[] {
  if (!Array.isArray(value)) {
    throw new Error(`${options.label} must be an array`);
  }
  if (
    options.exactLength !== undefined &&
    value.length !== options.exactLength
  ) {
    throw new Error(
      `${options.label} must contain exactly ${formatCount(options.exactLength)} agents`,
    );
  }
  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new Error(
      `${options.label} must contain at least ${formatCount(options.minLength)} agents`,
    );
  }

  const agents = value.map((item, index) =>
    parseAgentRef(item, `${options.label}[${index}]`),
  );
  assertUniqueProviders(agents, options.label);
  return agents;
}

function parseAgentRef(value: unknown, label: string): ConsensusAgentRef {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  assertKnownKeys(value, AGENT_KEYS, label);
  if (typeof value.provider !== 'string' || value.provider.length === 0) {
    throw new Error(`${label}.provider must be a non-empty string`);
  }
  if (!isProviderId(value.provider)) {
    throw new Error(`${label}.provider must be a provider id`);
  }

  const agent: ConsensusAgentRef = { provider: value.provider };
  if (value.model !== undefined) {
    if (typeof value.model !== 'string' || value.model.length === 0) {
      throw new Error(`${label}.model must be a non-empty string`);
    }
    agent.model = value.model;
  }
  if (value.effort !== undefined) {
    if (typeof value.effort !== 'string' || value.effort.length === 0) {
      throw new Error(`${label}.effort must be a non-empty string`);
    }
    agent.effort = value.effort;
  }

  return agent;
}

function parsePanelSize(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 2) {
    throw new Error(
      'Consensus config panel_size must be an integer greater than 1',
    );
  }
  return Number(value);
}

function parseRolesConfig(value: unknown): ConsensusRolesConfig {
  if (!isRecord(value)) {
    throw new Error('Consensus config roles must be an object');
  }
  assertKnownKeys(value, ROLE_KEYS, 'Consensus config roles');

  const roles: ConsensusRolesConfig = {};
  if (value.panelist !== undefined) {
    roles.panelist = parseAgentList(value.panelist, {
      label: 'Consensus config roles.panelist',
      minLength: 1,
    });
  }
  if (value.advisor !== undefined) {
    roles.advisor = parseAgentRef(value.advisor, 'Consensus config roles.advisor');
  }
  if (value.synthesizer !== undefined) {
    roles.synthesizer = parseAgentRef(
      value.synthesizer,
      'Consensus config roles.synthesizer',
    );
  }

  return roles;
}

function assertUniqueProviders(
  agents: readonly ConsensusAgentRef[],
  label: string,
) {
  const seen = new Set<ProviderId>();
  for (const agent of agents) {
    if (seen.has(agent.provider)) {
      throw new Error(`${label} must not contain duplicate providers`);
    }
    seen.add(agent.provider);
  }
}

function assertKnownKeys(
  record: Record<string, unknown>,
  knownKeys: Set<string>,
  label: string,
) {
  for (const key of Object.keys(record)) {
    if (!knownKeys.has(key)) {
      throw new Error(`${label} has unknown key: ${key}`);
    }
  }
}

function hasConsensusDefaults(value: ConsensusDefaults): boolean {
  return (
    value.peers !== undefined ||
    value.panelists !== undefined ||
    value.panel_size !== undefined ||
    value.roles !== undefined
  );
}

function isProviderId(value: string): value is ProviderId {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function userConfigDir(env: Record<string, string | undefined> = {}) {
  const xdg = env.XDG_CONFIG_HOME ?? process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) return path.resolve(xdg);

  const home = env.HOME ?? process.env.HOME;
  if (!home) {
    throw new Error('HOME is required to resolve user consensus config');
  }
  return path.join(path.resolve(home), '.config');
}

async function writeJsonAtomic(
  filePath: string,
  config: ConsensusDefaultsConfig,
): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function formatCount(count: number): string {
  return count === 2 ? 'two' : String(count);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected consensus config key: ${String(value)}`);
}
