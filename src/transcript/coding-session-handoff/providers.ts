import { execFile as nodeExecFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

import {
  computeExecutionContextFingerprint,
  computeSyntaxFingerprint,
  normalizeCapabilityOutput,
  PROVIDER_EXACT_VERSIONS,
  PROVIDER_REQUIRED_HELP_SHAPES,
  PROVIDER_SAFETY_ARGV,
  redactProviderConfig,
} from './behavior-contracts.js';
import type { CapabilityProbe, HandoffProvider } from './types.js';

const execFileAsync = promisify(nodeExecFile);

export const PROVIDER_PROBE_TIMEOUT_MS = 10_000;
export const PROVIDER_PROBE_MAX_OUTPUT_BYTES = 65_536;
export const PROVIDER_EXECUTABLE_MAX_BYTES = 256 * 1024 * 1024;
export const PROVIDER_EXECUTABLE_HASH_CHUNK_BYTES = 1024 * 1024;

interface ProviderProcessResult {
  stdout: string;
  stderr: string;
}

interface ProviderExecutableMetadata {
  size: number;
  isFile: boolean;
}

interface ProviderExecutableHash {
  update(bytes: Uint8Array): unknown;
  digest(encoding: 'hex'): string;
}

export interface ProviderProbeDependencies {
  resolveExecutable: (name: HandoffProvider) => Promise<string | null>;
  readExecutableMetadata: (path: string) => Promise<ProviderExecutableMetadata>;
  streamExecutable: (path: string) => AsyncIterable<Uint8Array>;
  createExecutableHash: () => ProviderExecutableHash;
  readConfigInputs: (
    provider: HandoffProvider,
    targetCwd?: string,
  ) => Promise<readonly { name: string; contents: string }[]>;
  run: (
    executable: string,
    argv: readonly string[],
    options: {
      timeoutMs: number;
      maxOutputBytes: number;
      shell: false;
    },
  ) => Promise<ProviderProcessResult>;
}

export interface ProviderAuthenticationMetadata {
  status: 'authenticated' | 'required' | 'unavailable';
  method?: string;
  loginCommand: string;
}

export interface ProviderProbeResult {
  capability: CapabilityProbe;
  authentication: ProviderAuthenticationMetadata;
}

export interface ProbeProviderOptions {
  deps?: ProviderProbeDependencies;
  expectedExecutionContextFingerprint?: string;
  targetCwd?: string;
}

const PROVIDER_PROBE_COMMANDS = Object.freeze({
  codex: Object.freeze({
    version: Object.freeze(['--version']),
    help: Object.freeze(['exec', 'fork', '--help']),
    auth: Object.freeze(['login', 'status']),
    loginCommand: 'codex login',
  }),
  claude: Object.freeze({
    version: Object.freeze(['--version']),
    help: Object.freeze(['--help']),
    auth: Object.freeze(['auth', 'status', '--json']),
    loginCommand: 'claude auth login',
  }),
});

async function resolveFromPath(
  provider: HandoffProvider,
): Promise<string | null> {
  const pathEntries = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = join(entry, provider);
    try {
      await access(candidate);
      return await realpath(candidate);
    } catch {
      // Continue through the bounded PATH entry list.
    }
  }
  return null;
}

async function defaultConfigInputs(
  provider: HandoffProvider,
  targetCwd?: string,
): Promise<readonly { name: string; contents: string }[]> {
  if (provider === 'claude') return [];
  const inputs: { name: string; contents: string }[] = [];
  const codexRoot = process.env.CODEX_HOME;
  const userRoot = process.env.HOME;
  const codexHome = codexRoot
    ? codexRoot
    : userRoot
      ? join(userRoot, '.codex')
      : null;
  const paths = [
    ...(codexHome === null
      ? []
      : [{ name: 'user/AGENTS.md', path: join(codexHome, 'AGENTS.md') }]),
    ...(targetCwd === undefined
      ? []
      : [
          {
            name: 'target/.codex/config.toml',
            path: join(targetCwd, '.codex', 'config.toml'),
          },
          {
            name: 'target/AGENTS.override.md',
            path: join(targetCwd, 'AGENTS.override.md'),
          },
          { name: 'target/AGENTS.md', path: join(targetCwd, 'AGENTS.md') },
        ]),
  ];
  for (const entry of paths) {
    let contents: string;
    try {
      contents = await readFile(entry.path, { encoding: 'utf8' });
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        continue;
      }
      throw error;
    }
    if (Buffer.byteLength(contents) > PROVIDER_PROBE_MAX_OUTPUT_BYTES) {
      throw new Error('config-input-oversized');
    }
    inputs.push({ name: entry.name, contents });
  }
  return inputs;
}

const DEFAULT_DEPENDENCIES: ProviderProbeDependencies = {
  resolveExecutable: resolveFromPath,
  readExecutableMetadata: async (path) => {
    const metadata = await stat(path);
    return { size: metadata.size, isFile: metadata.isFile() };
  },
  streamExecutable: (path) =>
    createReadStream(path, {
      highWaterMark: PROVIDER_EXECUTABLE_HASH_CHUNK_BYTES,
    }),
  createExecutableHash: () => createHash('sha256'),
  readConfigInputs: defaultConfigInputs,
  run: async (executable, argv, options) => {
    const result = await execFileAsync(executable, [...argv], {
      timeout: options.timeoutMs,
      maxBuffer: options.maxOutputBytes,
      encoding: 'utf8',
      shell: options.shell,
      windowsHide: true,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  },
};

async function hashExecutable(
  executable: string,
  deps: ProviderProbeDependencies,
): Promise<string> {
  const metadata = await deps.readExecutableMetadata(executable);
  if (
    !metadata.isFile ||
    !Number.isSafeInteger(metadata.size) ||
    metadata.size < 0 ||
    metadata.size > PROVIDER_EXECUTABLE_MAX_BYTES
  ) {
    throw new Error('executable-metadata-invalid');
  }

  const hash = deps.createExecutableHash();
  let bytesRead = 0;
  for await (const chunk of deps.streamExecutable(executable)) {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) {
      throw new Error('executable-stream-invalid');
    }
    bytesRead += chunk.byteLength;
    if (
      !Number.isSafeInteger(bytesRead) ||
      bytesRead > metadata.size ||
      bytesRead > PROVIDER_EXECUTABLE_MAX_BYTES
    ) {
      throw new Error('executable-stream-oversized');
    }
    hash.update(chunk);
  }
  if (bytesRead !== metadata.size) {
    throw new Error('executable-stream-size-mismatch');
  }
  const digest = hash.digest('hex');
  if (!/^[0-9a-f]{64}$/u.test(digest)) {
    throw new Error('executable-digest-invalid');
  }
  return digest;
}

function probeOptions() {
  return {
    timeoutMs: PROVIDER_PROBE_TIMEOUT_MS,
    maxOutputBytes: PROVIDER_PROBE_MAX_OUTPUT_BYTES,
    shell: false as const,
  };
}

function parseVersion(
  provider: HandoffProvider,
  output: string,
): string | null {
  const normalized = normalizeCapabilityOutput(output);
  const match =
    provider === 'codex'
      ? normalized.match(/(?:codex(?:-cli)?\s+)?(\d+\.\d+\.\d+)/u)
      : normalized.match(/(?:claude(?: code)?\s+)?(\d+\.\d+\.\d+)/u);
  return match?.[1] ?? null;
}

function isExactCodexAuthentication(stdout: string, stderr: string): boolean {
  if (stdout !== '') return false;
  const normalizedStderr = stderr.replace(/\r\n?/gu, '\n');
  const message = normalizedStderr.endsWith('\n')
    ? normalizedStderr.slice(0, -1)
    : normalizedStderr;
  return message === 'Logged in using ChatGPT';
}

function parseAuthentication(
  provider: HandoffProvider,
  stdout: string,
  stderr: string,
): ProviderAuthenticationMetadata {
  const loginCommand = PROVIDER_PROBE_COMMANDS[provider].loginCommand;
  if (provider === 'codex') {
    return isExactCodexAuthentication(stdout, stderr)
      ? { status: 'authenticated', method: 'chatgpt', loginCommand }
      : { status: 'required', loginCommand };
  }
  let value: unknown;
  try {
    value = JSON.parse(`${stdout}\n${stderr}`.trim());
  } catch {
    return { status: 'required', loginCommand };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'required', loginCommand };
  }
  const record = value as Record<string, unknown>;
  const authenticated =
    record.loggedIn === true ||
    record.authenticated === true ||
    record.status === 'authenticated';
  const methodValue = record.authMethod ?? record.method;
  const method =
    typeof methodValue === 'string' && methodValue.length > 0
      ? methodValue
      : undefined;
  return {
    status: authenticated ? 'authenticated' : 'required',
    method,
    loginCommand,
  };
}

function capability(
  provider: HandoffProvider,
  executable: string,
  status: CapabilityProbe['status'],
  values: Partial<CapabilityProbe> = {},
): CapabilityProbe {
  return {
    provider,
    executable,
    verifiedSyntaxVersion: PROVIDER_EXACT_VERSIONS[provider],
    status,
    missingCapabilities: [],
    ...values,
  };
}

/** Run bounded exact-version, help-shape, auth, and execution-context probes. */
export async function probeProvider(
  provider: HandoffProvider,
  options: ProbeProviderOptions = {},
): Promise<ProviderProbeResult> {
  const deps = options.deps ?? DEFAULT_DEPENDENCIES;
  const commands = PROVIDER_PROBE_COMMANDS[provider];
  const executable = await deps.resolveExecutable(provider).catch(() => null);
  if (executable === null) {
    return {
      capability: capability(provider, provider, 'missing', {
        missingCapabilities: ['executable'],
      }),
      authentication: {
        status: 'unavailable',
        method: undefined,
        loginCommand: commands.loginCommand,
      },
    };
  }

  let versionOutput: string;
  let helpOutput: string;
  try {
    const versionResult = await deps.run(
      executable,
      commands.version,
      probeOptions(),
    );
    versionOutput = `${versionResult.stdout}\n${versionResult.stderr}`;
    const helpResult = await deps.run(
      executable,
      commands.help,
      probeOptions(),
    );
    helpOutput = `${helpResult.stdout}\n${helpResult.stderr}`;
  } catch {
    return {
      capability: capability(provider, executable, 'probe-failed'),
      authentication: {
        status: 'unavailable',
        loginCommand: commands.loginCommand,
      },
    };
  }

  const detectedVersion = parseVersion(provider, versionOutput);
  if (detectedVersion !== PROVIDER_EXACT_VERSIONS[provider]) {
    return {
      capability: capability(provider, executable, 'version-drift', {
        detectedVersion: detectedVersion ?? undefined,
        missingCapabilities: detectedVersion === null ? ['version'] : [],
      }),
      authentication: {
        status: 'unavailable',
        loginCommand: commands.loginCommand,
      },
    };
  }

  const normalizedHelp = normalizeCapabilityOutput(helpOutput);
  const missingCapabilities = PROVIDER_REQUIRED_HELP_SHAPES[provider].filter(
    (required) => !normalizedHelp.includes(required),
  );
  if (missingCapabilities.length > 0) {
    return {
      capability: capability(provider, executable, 'help-shape-drift', {
        detectedVersion,
        missingCapabilities: [...missingCapabilities],
      }),
      authentication: {
        status: 'unavailable',
        loginCommand: commands.loginCommand,
      },
    };
  }

  let authentication: ProviderAuthenticationMetadata;
  try {
    const auth = await deps.run(executable, commands.auth, probeOptions());
    authentication = parseAuthentication(provider, auth.stdout, auth.stderr);
  } catch {
    authentication = {
      status: 'required',
      loginCommand: commands.loginCommand,
    };
  }

  const syntaxFingerprint = computeSyntaxFingerprint(
    provider,
    detectedVersion,
    helpOutput,
  );
  let executionContextFingerprint: string;
  try {
    const executableSha256 = await hashExecutable(executable, deps);
    const rawConfigInputs = await deps.readConfigInputs(
      provider,
      options.targetCwd,
    );
    const configInputs = rawConfigInputs.map((entry) => ({
      name: entry.name,
      redactedContents:
        provider === 'codex' ? redactProviderConfig(entry.contents) : '',
    }));
    executionContextFingerprint = computeExecutionContextFingerprint({
      provider,
      executableSha256,
      exactVersion: detectedVersion,
      syntaxFingerprint,
      safetyArgv: PROVIDER_SAFETY_ARGV[provider],
      configInputs,
      authenticationMethod: authentication.method,
    });
  } catch {
    return {
      capability: capability(
        provider,
        executable,
        'execution-context-unreadable',
        { detectedVersion, contractFingerprint: syntaxFingerprint },
      ),
      authentication,
    };
  }

  if (
    options.expectedExecutionContextFingerprint !== undefined &&
    options.expectedExecutionContextFingerprint !== executionContextFingerprint
  ) {
    return {
      capability: capability(provider, executable, 'execution-context-drift', {
        detectedVersion,
        contractFingerprint: syntaxFingerprint,
        executionContextFingerprint,
      }),
      authentication,
    };
  }

  return {
    capability: capability(provider, executable, 'syntax-verified', {
      detectedVersion,
      contractFingerprint: syntaxFingerprint,
      executionContextFingerprint,
    }),
    authentication,
  };
}
