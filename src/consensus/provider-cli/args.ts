import type {
  ConsensusCliRunRequest,
  HostRuntime,
  ProviderId,
} from './types.js';

export class ConsensusCliUsageError extends Error {
  readonly code = 'CONSENSUS_CLI_USAGE' as const;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ConsensusCliUsageError';
    this.details = details;
  }
}

export type ParsedConsensusCliCommand =
  | ParsedHelpCommand
  | ParsedProviderListCommand
  | ParsedPreflightCommand
  | ParsedRunCommand;

export interface ParsedHelpCommand {
  kind: 'help';
}

export interface ParsedProviderListCommand {
  kind: 'provider-list';
  json: true;
}

export interface ParsedPreflightCommand {
  kind: 'preflight';
  json: true;
  provider?: ProviderId;
  maxDepth?: number;
}

export type PromptSource =
  | { kind: 'stdin' }
  | { kind: 'prompt'; value: string }
  | { kind: 'file'; path: string };

export interface ParsedRunCommand {
  kind: 'run';
  json: true;
  provider?: ProviderId;
  schemaPath?: string;
  promptSource?: PromptSource;
  requestJson?: string;
  maxAttempts?: number;
  timeoutSec?: number;
  maxOutputBytes?: number;
  maxDepth?: number;
  model?: string;
  effort?: string;
  cwd?: string;
  permissionMode?: string;
  sandbox?: string;
  approvalPolicy?: string;
  envAllow?: string[];
}

export interface NormalizeRunRequestIo {
  cwd?: string;
  env?: Record<string, string | undefined>;
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

export function parseConsensusCliArgs(
  argv: readonly string[],
): ParsedConsensusCliCommand {
  const tokens = [...argv];
  const command = tokens.shift();

  if (!command || command === '--help' || command === '-h') {
    requireNoExtraTokens(tokens);
    return { kind: 'help' };
  }

  if (command === 'provider') {
    return parseProviderCommand(tokens);
  }

  if (command === 'preflight') {
    return parsePreflightCommand(tokens);
  }

  if (command === 'run') {
    return parseRunCommand(tokens);
  }

  throw new ConsensusCliUsageError(`Unknown command: ${command}`);
}

export async function normalizeRunRequest(
  command: ParsedConsensusCliCommand,
  io: NormalizeRunRequestIo,
): Promise<ConsensusCliRunRequest> {
  if (command.kind !== 'run') {
    throw new ConsensusCliUsageError('Expected a run command');
  }

  if (command.requestJson) {
    const source =
      command.requestJson === '-'
        ? await io.readStdin()
        : await io.readFile(command.requestJson);
    return parseRequestJson(source);
  }

  if (!command.provider) {
    throw new ConsensusCliUsageError('Missing required --provider');
  }
  if (!command.schemaPath) {
    throw new ConsensusCliUsageError('Missing required --schema');
  }
  if (!command.promptSource) {
    throw new ConsensusCliUsageError(
      'Missing prompt source: use -, --prompt, --prompt-file, or --request-json',
    );
  }

  const prompt = await readPromptSource(command.promptSource, io);
  const request: ConsensusCliRunRequest = {
    schema_version: 'v1',
    provider: command.provider,
    schema_path: command.schemaPath,
    prompt,
  };

  if (command.cwd) request.cwd = command.cwd;
  if (command.model) request.model = command.model;
  if (command.effort) request.effort = command.effort;
  const runtimePolicy = normalizeRuntimePolicy(command);
  if (runtimePolicy) request.runtime_policy = runtimePolicy;
  if (command.maxDepth !== undefined) {
    request.host = normalizeHostContext(command.maxDepth, command, io);
  }
  if (command.maxAttempts !== undefined) {
    request.max_attempts = command.maxAttempts;
  }
  if (command.timeoutSec !== undefined) {
    request.max_runtime_sec = command.timeoutSec;
  }
  if (command.maxOutputBytes !== undefined) {
    request.max_output_bytes = command.maxOutputBytes;
  }

  return request;
}

function parseProviderCommand(
  tokens: readonly string[],
): ParsedProviderListCommand {
  const [subcommand, ...rest] = tokens;
  if (subcommand !== 'ls') {
    throw new ConsensusCliUsageError(
      'Expected provider subcommand: provider ls --json',
    );
  }

  const parsed = parseOptionTokens(rest, {
    allowedFlags: new Set(['--json']),
    valueFlags: new Set(),
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);

  return { kind: 'provider-list', json: true };
}

function parsePreflightCommand(
  tokens: readonly string[],
): ParsedPreflightCommand {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: new Set(['--json', '--provider', '--max-depth']),
    valueFlags: new Set(['--provider', '--max-depth']),
  });
  requireJson(parsed.flags);
  requireNoPositionals(parsed.positionals);

  const command: ParsedPreflightCommand = {
    kind: 'preflight',
    json: true,
  };
  const provider = singleValue(parsed.flags, '--provider');
  if (provider) command.provider = provider;
  const maxDepth = singleValue(parsed.flags, '--max-depth');
  if (maxDepth) {
    command.maxDepth = parsePositiveInteger('--max-depth', maxDepth);
  }

  return command;
}

function parseRunCommand(tokens: readonly string[]): ParsedRunCommand {
  const parsed = parseOptionTokens(tokens, {
    allowedFlags: new Set([
      '--json',
      '--provider',
      '--schema',
      '--prompt',
      '--prompt-file',
      '--request-json',
      '--max-attempts',
      '--timeout-sec',
      '--max-output-bytes',
      '--model',
      '--effort',
      '--cwd',
      '--permission-mode',
      '--sandbox',
      '--approval-policy',
      '--env-allow',
      '--max-depth',
    ]),
    valueFlags: new Set([
      '--provider',
      '--schema',
      '--prompt',
      '--prompt-file',
      '--request-json',
      '--max-attempts',
      '--timeout-sec',
      '--max-output-bytes',
      '--model',
      '--effort',
      '--cwd',
      '--permission-mode',
      '--sandbox',
      '--approval-policy',
      '--env-allow',
      '--max-depth',
    ]),
  });
  requireJson(parsed.flags);

  const command: ParsedRunCommand = {
    kind: 'run',
    json: true,
  };

  assignIfDefined(command, 'provider', singleValue(parsed.flags, '--provider'));
  assignIfDefined(
    command,
    'schemaPath',
    singleValue(parsed.flags, '--schema'),
  );
  assignIfDefined(
    command,
    'requestJson',
    singleValue(parsed.flags, '--request-json'),
  );
  assignIfDefined(command, 'model', singleValue(parsed.flags, '--model'));
  assignIfDefined(command, 'effort', singleValue(parsed.flags, '--effort'));
  assignIfDefined(command, 'cwd', singleValue(parsed.flags, '--cwd'));
  assignIfDefined(
    command,
    'permissionMode',
    singleValue(parsed.flags, '--permission-mode'),
  );
  assignIfDefined(command, 'sandbox', singleValue(parsed.flags, '--sandbox'));
  assignIfDefined(
    command,
    'approvalPolicy',
    singleValue(parsed.flags, '--approval-policy'),
  );
  const envAllow = valuesFor(parsed.flags, '--env-allow');
  if (envAllow.length > 0) command.envAllow = envAllow;

  const prompt = singleValue(parsed.flags, '--prompt');
  const promptFile = singleValue(parsed.flags, '--prompt-file');
  const stdinMarkers = parsed.positionals.filter((value) => value === '-');
  const unknownPositionals = parsed.positionals.filter((value) => value !== '-');
  if (unknownPositionals.length > 0) {
    throw new ConsensusCliUsageError(
      `Unexpected positional argument: ${unknownPositionals[0]}`,
    );
  }

  const promptSources = [
    prompt === undefined ? undefined : { kind: 'prompt', value: prompt },
    promptFile === undefined ? undefined : { kind: 'file', path: promptFile },
    ...stdinMarkers.map(() => ({ kind: 'stdin' }) as const),
  ].filter((source): source is PromptSource => source !== undefined);

  if (promptSources.length > 1) {
    throw new ConsensusCliUsageError('Use only one prompt source');
  }
  command.promptSource = promptSources[0];

  const maxAttempts = singleValue(parsed.flags, '--max-attempts');
  if (maxAttempts) {
    command.maxAttempts = parsePositiveInteger('--max-attempts', maxAttempts);
  }
  const timeoutSec = singleValue(parsed.flags, '--timeout-sec');
  if (timeoutSec) {
    command.timeoutSec = parsePositiveInteger('--timeout-sec', timeoutSec);
  }
  const maxOutputBytes = singleValue(parsed.flags, '--max-output-bytes');
  if (maxOutputBytes) {
    command.maxOutputBytes = parsePositiveInteger(
      '--max-output-bytes',
      maxOutputBytes,
    );
  }
  const maxDepth = singleValue(parsed.flags, '--max-depth');
  if (maxDepth) {
    command.maxDepth = parsePositiveInteger('--max-depth', maxDepth);
  }

  if (command.requestJson) {
    assertNoRequestJsonConflicts(command, parsed.positionals.length);
  }

  return command;
}

function assertNoRequestJsonConflicts(
  command: ParsedRunCommand,
  positionalCount: number,
) {
  const conflicts = [
    command.provider ? '--provider' : undefined,
    command.schemaPath ? '--schema' : undefined,
    command.promptSource ? 'prompt source' : undefined,
    command.maxAttempts !== undefined ? '--max-attempts' : undefined,
    command.timeoutSec !== undefined ? '--timeout-sec' : undefined,
    command.maxOutputBytes !== undefined ? '--max-output-bytes' : undefined,
    command.model ? '--model' : undefined,
    command.effort ? '--effort' : undefined,
    command.cwd ? '--cwd' : undefined,
    command.permissionMode ? '--permission-mode' : undefined,
    command.sandbox ? '--sandbox' : undefined,
    command.approvalPolicy ? '--approval-policy' : undefined,
    command.envAllow && command.envAllow.length > 0 ? '--env-allow' : undefined,
    command.maxDepth !== undefined ? '--max-depth' : undefined,
    positionalCount > 0 ? 'positional prompt' : undefined,
  ].filter(Boolean);

  if (conflicts.length > 0) {
    throw new ConsensusCliUsageError(
      `--request-json cannot be combined with request-shaping flags: ${conflicts.join(', ')}`,
    );
  }
}

function normalizeRuntimePolicy(command: ParsedRunCommand) {
  const runtimePolicy: NonNullable<ConsensusCliRunRequest['runtime_policy']> =
    {};
  if (command.permissionMode) {
    runtimePolicy.permission_mode = command.permissionMode;
  }
  if (command.sandbox) runtimePolicy.sandbox = command.sandbox;
  if (command.approvalPolicy) {
    runtimePolicy.approval_policy = command.approvalPolicy;
  }
  if (command.envAllow && command.envAllow.length > 0) {
    runtimePolicy.env_allowlist = command.envAllow;
  }

  return Object.keys(runtimePolicy).length > 0 ? runtimePolicy : undefined;
}

function assignIfDefined<
  T extends object,
  K extends keyof T,
>(target: T, key: K, value: T[K] | undefined) {
  if (value !== undefined) target[key] = value;
}

function normalizeHostContext(
  maxDepth: number,
  command: ParsedRunCommand,
  io: NormalizeRunRequestIo,
): NonNullable<ConsensusCliRunRequest['host']> {
  return {
    runtime: normalizeHostRuntime(io.env?.CONSENSUS_PARENT_HOST),
    cwd: command.cwd ?? io.cwd ?? process.cwd(),
    run_id: io.env?.CONSENSUS_RUN_ID ?? 'local',
    depth: parseNonNegativeInteger(io.env?.CONSENSUS_DEPTH) ?? 0,
    max_depth: maxDepth,
  };
}

function normalizeHostRuntime(value: string | undefined): HostRuntime {
  return value === 'claude' || value === 'codex' || value === 'cursor'
    ? value
    : 'unknown';
}

function parseNonNegativeInteger(value: string | undefined) {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

async function readPromptSource(
  source: PromptSource,
  io: NormalizeRunRequestIo,
) {
  if (source.kind === 'stdin') return io.readStdin();
  if (source.kind === 'file') return io.readFile(source.path);
  return source.value;
}

function parseRequestJson(contents: string): ConsensusCliRunRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new ConsensusCliUsageError('Invalid request JSON', {
      cause: String(error),
    });
  }

  if (!isRecord(parsed)) {
    throw new ConsensusCliUsageError('Request JSON must be an object');
  }
  if (parsed.schema_version !== 'v1') {
    throw new ConsensusCliUsageError(
      'Request JSON schema_version must be "v1"',
    );
  }
  if (typeof parsed.provider !== 'string' || parsed.provider.length === 0) {
    throw new ConsensusCliUsageError('Request JSON provider must be a string');
  }
  if (
    typeof parsed.schema_path !== 'string' ||
    parsed.schema_path.length === 0
  ) {
    throw new ConsensusCliUsageError(
      'Request JSON schema_path must be a string',
    );
  }
  if (typeof parsed.prompt !== 'string') {
    throw new ConsensusCliUsageError('Request JSON prompt must be a string');
  }

  return parsed as unknown as ConsensusCliRunRequest;
}

interface ParseOptionsSpec {
  allowedFlags: Set<string>;
  valueFlags: Set<string>;
}

interface ParsedOptionTokens {
  flags: Map<string, string[]>;
  positionals: string[];
}

function parseOptionTokens(
  tokens: readonly string[],
  spec: ParseOptionsSpec,
): ParsedOptionTokens {
  const flags = new Map<string, string[]>();
  const positionals: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const [flag, inlineValue] = splitFlag(token);
    if (!spec.allowedFlags.has(flag)) {
      throw new ConsensusCliUsageError(`Unknown flag: ${flag}`);
    }

    if (!spec.valueFlags.has(flag)) {
      if (inlineValue !== undefined) {
        throw new ConsensusCliUsageError(`${flag} does not accept a value`);
      }
      pushFlag(flags, flag, 'true');
      continue;
    }

    const value = inlineValue ?? tokens[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new ConsensusCliUsageError(`${flag} requires a value`);
    }
    if (inlineValue === undefined) index += 1;
    pushFlag(flags, flag, value);
  }

  return { flags, positionals };
}

function splitFlag(token: string) {
  const equalsIndex = token.indexOf('=');
  if (equalsIndex === -1) return [token, undefined] as const;
  return [token.slice(0, equalsIndex), token.slice(equalsIndex + 1)] as const;
}

function pushFlag(flags: Map<string, string[]>, flag: string, value: string) {
  const values = flags.get(flag) ?? [];
  values.push(value);
  flags.set(flag, values);
}

function singleValue(flags: Map<string, string[]>, flag: string) {
  const values = flags.get(flag);
  if (!values || values.length === 0) return undefined;
  if (values.length > 1) {
    throw new ConsensusCliUsageError(`${flag} can only be provided once`);
  }
  return values[0];
}

function valuesFor(flags: Map<string, string[]>, flag: string) {
  return flags.get(flag) ?? [];
}

function requireJson(flags: Map<string, string[]>) {
  if (!flags.has('--json')) {
    throw new ConsensusCliUsageError('Missing required --json flag');
  }
}

function requireNoPositionals(positionals: readonly string[]) {
  if (positionals.length > 0) {
    throw new ConsensusCliUsageError(
      `Unexpected positional argument: ${positionals[0]}`,
    );
  }
}

function requireNoExtraTokens(tokens: readonly string[]) {
  if (tokens.length > 0) {
    throw new ConsensusCliUsageError(`Unexpected argument: ${tokens[0]}`);
  }
}

function parsePositiveInteger(flag: string, value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ConsensusCliUsageError(`${flag} must be a positive integer`);
  }
  return Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
