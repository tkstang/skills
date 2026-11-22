import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';

import { redactText } from './acp/transcript.js';
import type { ProviderAdapter, ProviderAdapterRegistry } from './adapters.js';
import { resolveProviderExecutable } from './executable.js';
import { buildProviderProbeEnvironment } from './runtime-policy.js';
import { runProviderSubprocess } from './subprocess.js';
import type { RunProviderSubprocessOptions } from './subprocess.js';
import type {
  ProviderDiagnostics,
  ProviderId,
  ProviderInventoryEntry,
  ProviderPreflightCapability,
} from './types.js';

export interface ProviderCapabilityProbeDefinition {
  args: readonly string[];
  required_output_patterns: readonly RegExp[];
}

// A program that must be installed before the provider can run, such as a
// launcher or agent CLI the provider command starts. Without `version` it is
// checked for presence only.
export interface ProviderProbePrerequisite {
  name: string;
  command: string;
  // Parent-only override for `command`, like the adapter's `executable_env`.
  executable_env: string;
  version?: ProviderPrerequisiteVersion;
  install_hint: string;
}

// Inclusive bounds. `exact` compares the full version, prerelease included.
export interface ProviderPrerequisiteVersion {
  args: readonly string[];
  min?: string;
  max?: string;
  exact?: string;
}

export interface ProviderProbeDefinition {
  version_args: readonly string[];
  minimum_version: string;
  // Checked in order, before the provider binary.
  prerequisites?: readonly ProviderProbePrerequisite[];
  capabilities: Readonly<
    Record<ProviderPreflightCapability, ProviderCapabilityProbeDefinition>
  >;
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
    | 'PROVIDER_ARGV_TOO_LARGE'
    | 'PROVIDER_EXIT';
  diagnostics?: ProviderDiagnostics;
}

export interface ProbeCommandRunner {
  // The parent environment, read for CONSENSUS_<PROVIDER>_EXECUTABLE overrides.
  readonly env?: Record<string, string | undefined>;
  findExecutable(command: string): Promise<string | undefined>;
  // `adapter` selects the credential variables the probe environment keeps.
  run(
    command: string,
    args: readonly string[],
    adapter: ProbedAdapter,
  ): Promise<ProbeCommandResult>;
}

export type ProbedAdapter = Pick<ProviderAdapter, 'id' | 'credential_env'>;

export interface ProviderProbeOptions {
  runner: ProbeCommandRunner;
  requiredCapabilities?: readonly ProviderPreflightCapability[];
}

export interface ProviderRegistryProbeOptions extends ProviderProbeOptions {
  registry: ProviderAdapterRegistry;
  provider?: ProviderId;
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
  provider,
  requiredCapabilities,
}: ProviderRegistryProbeOptions): Promise<ProviderInventoryEntry[]> {
  // A named provider resolves from any tier; the unnamed inventory lists
  // core providers only, so extended providers are used only by name.
  const adapters = provider
    ? [registry.get(provider)].filter(
        (adapter): adapter is ProviderAdapter => adapter !== undefined,
      )
    : registry.list().filter((adapter) => adapter.tier === 'core');
  return Promise.all(
    adapters.map((adapter) =>
      probeProviderReadiness(adapter, { runner, requiredCapabilities }),
    ),
  );
}

export async function probeProviderReadiness(
  adapter: ProviderAdapter,
  options: ProviderProbeOptions,
): Promise<ProviderInventoryEntry> {
  const notAdmitted = notAdmittedEntry(adapter);
  if (notAdmitted) return notAdmitted;

  const prerequisites = await checkProviderPrerequisites(
    adapter,
    options.runner,
  );
  if (!prerequisites.ok) {
    const prerequisite = prerequisites.failure;
    return providerEntry(adapter, prerequisite.status, {
      ...(prerequisite.install_hint
        ? { install_hint: prerequisite.install_hint }
        : {}),
      diagnostics: prerequisite.diagnostics,
      warnings: [prerequisite.warning],
    });
  }

  const resolved = resolveProviderExecutable(adapter, options.runner.env ?? {});
  if (!resolved.ok) {
    return providerEntry(adapter, 'missing', {
      warnings: [`PROVIDER_MISSING: ${resolved.message}`],
    });
  }
  const command = resolved.executable;
  const executable = await options.runner.findExecutable(command);
  if (!executable || !path.isAbsolute(executable)) {
    return providerEntry(adapter, 'missing', {
      ...(adapter.install_hint ? { install_hint: adapter.install_hint } : {}),
      warnings: [
        `PROVIDER_MISSING: executable not found for ${adapter.id} (${command})`,
      ],
    });
  }

  // Extended providers are probed without their credentials and publish
  // only the parsed version token; any output kept in a warning is redacted
  // for every provider.
  const extended = adapter.tier === 'extended';
  const probed: ProbedAdapter = extended
    ? { id: adapter.id, credential_env: [] }
    : adapter;
  const redact = probeOutputRedactor(adapter, options.runner.env ?? {});
  // An extended provider publishes no version at all when its version
  // output holds anything redaction would alter: a token extracted from
  // that output can keep a credential fragment that no longer matches once
  // its context is gone. Otherwise a prerelease that redaction would alter
  // falls back to the bare release.
  const outputRedacts = (output: string) => redact(output) !== output;
  const versionLabel = (output: string): { version?: string } => {
    const version = extended
      ? outputRedacts(output)
        ? undefined
        : releaseLabel(output, redact)
      : redact(firstNonEmptyLine(output) ?? '') || undefined;
    return version ? { version } : {};
  };
  const detectedLabel = (output: string, detected: number[]) => {
    if (!extended) return formatNumericVersion(detected);
    if (outputRedacts(output)) return 'version';
    return printedNumericVersion(output) ?? formatNumericVersion(detected);
  };

  // Run the program that was found, not the bare command: PATH lookup at
  // spawn time could pick a different binary than the one checked.
  const result = await options.runner.run(
    executable,
    adapter.probe.version_args,
    probed,
  );
  const probeFailure = probeFailureEntry(adapter, executable, result);
  if (probeFailure) return probeFailure;

  const output = `${result.stdout}\n${result.stderr}`;

  if (matchesAny(output, adapter.probe.auth_required_patterns)) {
    return providerEntry(adapter, 'auth_required', {
      executable,
      warnings: [
        `PROVIDER_AUTH_REQUIRED: ${redact(`${firstNonEmptyLine(output)}`)}`,
      ],
    });
  }

  if (
    result.code !== 0 ||
    matchesAny(output, adapter.probe.unavailable_patterns)
  ) {
    return providerEntry(adapter, 'unavailable', {
      executable,
      warnings: [
        `PROVIDER_UNAVAILABLE: ${redact(`${firstNonEmptyLine(output)}`)}`,
      ],
    });
  }

  const detectedVersion = parseNumericVersion(output);
  const minimumVersion = parseNumericVersion(adapter.probe.minimum_version);
  if (!detectedVersion || !minimumVersion) {
    return providerEntry(adapter, 'unavailable', {
      executable,
      ...versionLabel(output),
      warnings: [
        `PROVIDER_VERSION_UNPARSEABLE: could not establish ${adapter.id} compatibility from version output`,
      ],
    });
  }
  if (compareNumericVersions(detectedVersion, minimumVersion) < 0) {
    return providerEntry(adapter, 'unavailable', {
      executable,
      ...versionLabel(output),
      warnings: [
        `PROVIDER_VERSION_UNSUPPORTED: ${adapter.id} ${redact(detectedLabel(output, detectedVersion))} is below required ${adapter.probe.minimum_version}`,
      ],
    });
  }

  for (const capability of options.requiredCapabilities ?? []) {
    const definition = adapter.probe.capabilities[capability];
    const capabilityResult = await options.runner.run(
      executable,
      definition.args,
      probed,
    );
    const capabilityFailure = probeFailureEntry(
      adapter,
      executable,
      capabilityResult,
    );
    if (capabilityFailure) return capabilityFailure;
    const capabilityOutput = `${capabilityResult.stdout}\n${capabilityResult.stderr}`;
    if (
      capabilityResult.code !== 0 ||
      !definition.required_output_patterns.every((pattern) =>
        pattern.test(capabilityOutput),
      )
    ) {
      return providerEntry(adapter, 'unavailable', {
        executable,
        ...versionLabel(output),
        warnings: [
          `PROVIDER_CAPABILITY_MISSING: ${adapter.id} does not expose required local capability ${capability}`,
        ],
      });
    }
  }

  return providerEntry(adapter, 'ready', {
    executable,
    ...versionLabel(output),
  });
}

export type ProviderPrerequisiteCheck =
  | {
      ok: true;
      // Absolute path of each checked prerequisite, keyed by its name.
      executables: Record<string, string>;
    }
  | { ok: false; failure: ProviderPrerequisiteFailure };

export interface ProviderPrerequisiteFailure {
  status: 'missing' | 'unsupported' | 'unavailable';
  // Coded warning, for example `PROVIDER_PREREQUISITE_MISSING: ...`.
  warning: string;
  // Plain-language reason for a run failure.
  message: string;
  // Present when installing or upgrading the prerequisite fixes it.
  install_hint?: string;
  diagnostics?: ProviderDiagnostics;
}

// Checks each declared prerequisite: presence, then its version pin when it
// declares one. Returns the first failure, or the checked executables. Shared
// by readiness probes and the run path, which never probes.
export async function checkProviderPrerequisites(
  adapter: ProbedAdapter & Pick<ProviderAdapter, 'probe'>,
  runner: ProbeCommandRunner,
): Promise<ProviderPrerequisiteCheck> {
  const executables: Record<string, string> = {};
  const failed = (
    failure: ProviderPrerequisiteFailure,
  ): ProviderPrerequisiteCheck => ({ ok: false, failure });
  for (const prerequisite of adapter.probe.prerequisites ?? []) {
    const missing = (detail: string): ProviderPrerequisiteFailure => ({
      status: 'missing',
      warning: `PROVIDER_PREREQUISITE_MISSING: ${detail}`,
      message: `Provider ${adapter.id} prerequisite ${detail}.`,
      install_hint: prerequisite.install_hint,
    });
    const resolved = resolveProviderExecutable(
      {
        executable: prerequisite.command,
        executable_env: prerequisite.executable_env,
      },
      runner.env ?? {},
    );
    if (!resolved.ok) {
      return failed(
        missing(`${prerequisite.name} is unusable: ${resolved.message}`),
      );
    }
    const executable = await runner.findExecutable(resolved.executable);
    // Only an absolute path binds the launch to the binary checked here.
    if (!executable || !path.isAbsolute(executable)) {
      return failed(
        missing(`${prerequisite.name} was not found (${resolved.executable})`),
      );
    }
    const pin = prerequisite.version;
    if (!pin) {
      executables[prerequisite.name] = executable;
      continue;
    }
    const pinError = versionPinError(pin);
    if (pinError) {
      const detail = `${prerequisite.name} declares an invalid version pin: ${pinError}`;
      return failed({
        status: 'unsupported',
        warning: `PROVIDER_PREREQUISITE_PIN_INVALID: ${detail}`,
        message: `Provider ${adapter.id} prerequisite ${detail}.`,
      });
    }

    const result = await runner.run(executable, pin.args, adapter);
    if (result.failure_code === 'PROVIDER_MISSING') {
      return failed(
        missing(`${prerequisite.name} failed to start (${executable})`),
      );
    }
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.failure_code || result.code !== 0) {
      const detail = `${prerequisite.name} version check failed: ${result.failure_code ?? firstNonEmptyLine(output) ?? `exit ${result.code}`}`;
      return failed({
        status: 'unavailable',
        warning: `PROVIDER_PREREQUISITE_UNAVAILABLE: ${detail}`,
        message: `Provider ${adapter.id} prerequisite ${detail}.`,
        diagnostics: result.diagnostics,
      });
    }
    const detected = parseVersion(output);
    const required = describeVersionPin(pin);
    if (!detected || !satisfiesVersionPin(detected, pin)) {
      const found = detected
        ? formatVersion(detected)
        : `unparseable version output ${JSON.stringify(firstNonEmptyLine(output) ?? '')}`;
      const detail = `${prerequisite.name} ${found} is outside the required ${required}`;
      return failed({
        status: 'unsupported',
        warning: `PROVIDER_PREREQUISITE_VERSION_UNSUPPORTED: ${detail}`,
        message: `Provider ${adapter.id} prerequisite ${detail}.`,
        install_hint: prerequisite.install_hint,
      });
    }
    executables[prerequisite.name] = executable;
  }
  return { ok: true, executables };
}

// A registered provider that has not passed admission is never launched; every
// inventory path reports it with this entry.
export function notAdmittedEntry(
  adapter: ProviderAdapter,
): ProviderInventoryEntry | undefined {
  if (!adapter.not_admitted_reason) return undefined;
  return providerEntry(adapter, 'unsupported', {
    warnings: [
      `PROVIDER_NOT_ADMITTED: registered, not admitted: ${adapter.not_admitted_reason}`,
    ],
  });
}

export function nodeProbeCommandRunner(
  env: NodeJS.ProcessEnv = process.env,
  options: NodeProbeCommandRunnerOptions = {},
): ProbeCommandRunner {
  return {
    env,
    findExecutable(command) {
      return findExecutable(command, env);
    },
    run(command, args, adapter) {
      return runProbeCommand(
        command,
        args,
        buildProviderProbeEnvironment({
          parentEnv: env,
          credentialEnv: adapter.credential_env,
        }),
        options,
      );
    },
  };
}

async function findExecutable(
  command: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (command.includes(path.sep)) {
    return firstExecutable(command);
  }

  const pathValue = env.PATH ?? '';
  for (const searchPath of pathValue.split(path.delimiter)) {
    // A relative entry would resolve against whichever directory a probe or
    // run starts in, so the binary checked and the one launched could differ.
    if (!path.isAbsolute(searchPath)) continue;
    const found = await firstExecutable(path.join(searchPath, command));
    if (found) return found;
  }
  return undefined;
}

// Windows spawn without a shell runs `.exe` and `.com` files found for a bare
// name; `.cmd` and `.bat` need a shell, which provider runs never use.
const WINDOWS_EXECUTABLE_EXTENSIONS = ['.exe', '.com'] as const;

async function firstExecutable(filePath: string) {
  const candidates =
    process.platform === 'win32' && !path.extname(filePath)
      ? [
          filePath,
          ...WINDOWS_EXECUTABLE_EXTENSIONS.map((ext) => filePath + ext),
        ]
      : [filePath];
  for (const candidate of candidates) {
    if (await canExecute(candidate)) return candidate;
  }
  return undefined;
}

// A directory is searchable (X_OK) but cannot be spawned; it must not shadow
// an executable later on PATH.
async function canExecute(filePath: string) {
  try {
    if (!(await stat(filePath)).isFile()) return false;
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

// MAJOR.MINOR.PATCH, plus a prerelease of plain alphanumerics and dots:
// never build metadata or the rest of the line.
function releaseLabel(
  output: string,
  redact: (text: string) => string,
): string | undefined {
  const parsed = parseVersion(output);
  if (!parsed || parsed.release.length !== 3) return undefined;
  // Checked and published as printed: normalizing (say, dropping a leading
  // zero) could turn a credential into digits redaction no longer matches.
  const release = parsed.text.split(/[-+]/)[0];
  if (redact(release) !== release) return undefined;
  const prerelease = parsed.prerelease.join('.');
  const label = `${release}-${prerelease}`;
  return prerelease &&
    /^[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*$/.test(prerelease) &&
    redact(label) === label
    ? label
    : release;
}

function probeOutputRedactor(
  adapter: ProviderAdapter,
  env: Record<string, string | undefined>,
) {
  const secretValues = adapter.credential_env
    .map((name) => env[name])
    .filter((value): value is string => typeof value === 'string');
  return (text: string) =>
    redactText(text, {
      patterns: adapter.redaction_patterns,
      secretValues,
    });
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
      ...(adapter.install_hint ? { install_hint: adapter.install_hint } : {}),
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
    install_hint?: string;
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
    ...(options.install_hint ? { install_hint: options.install_hint } : {}),
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
    ...diagnostics,
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

const NUMERIC_VERSION = /\b(\d+(?:\.\d+){2,})\b/;

function parseNumericVersion(value: string): number[] | undefined {
  const match = value.match(NUMERIC_VERSION);
  if (!match) return undefined;
  return safeComponents(match[1]);
}

// The numeric version as the output printed it.
function printedNumericVersion(value: string): string | undefined {
  return value.match(NUMERIC_VERSION)?.[1];
}

// Version components as numbers, or undefined when one is too large to
// compare exactly.
function safeComponents(release: string): number[] | undefined {
  const parts = release.split('.').map(Number);
  return parts.every((part) => Number.isSafeInteger(part)) ? parts : undefined;
}

function compareNumericVersions(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function formatNumericVersion(version: number[]): string {
  return version.join('.');
}

// Prerequisite versions keep their prerelease tag and build metadata so an
// exact pin such as `0.2.2-rc.5` is enforced; parseNumericVersion drops both.
interface ParsedVersion {
  // The token as written, without a leading `v`: exact pins compare it, so
  // `0.2.2.0` or `00.2.2` never equal `0.2.2`.
  text: string;
  release: number[];
  prerelease: string[];
  build: string[];
}

const IDENTIFIERS = '[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*';
const VERSION_TOKEN = `v?(\\d+(?:\\.\\d+){2,})(?:-(${IDENTIFIERS}))?(?:\\+(${IDENTIFIERS}))?`;
// A complete token in command output: not part of a longer run of version
// characters, so `0.2.2-rc.5.` or `x0.2.2` never parse as a shorter version.
const OUTPUT_VERSION = new RegExp(
  `(?<![0-9A-Za-z.+-])${VERSION_TOKEN}(?![0-9A-Za-z.+-])`,
);
// An authored pin bound is exactly one version.
const PIN_VERSION = new RegExp(`^${VERSION_TOKEN}$`);

function parseVersion(
  value: string,
  pattern: RegExp = OUTPUT_VERSION,
): ParsedVersion | undefined {
  const match = value.match(pattern);
  if (!match) return undefined;
  const release = safeComponents(match[1]);
  if (!release) return undefined;
  return {
    text: `${match[1]}${match[2] ? `-${match[2]}` : ''}${match[3] ? `+${match[3]}` : ''}`,
    release,
    prerelease: match[2] ? match[2].split('.') : [],
    build: match[3] ? match[3].split('.') : [],
  };
}

function formatVersion(version: ParsedVersion): string {
  const release = version.release.join('.');
  const prerelease =
    version.prerelease.length > 0 ? `-${version.prerelease.join('.')}` : '';
  const build = version.build.length > 0 ? `+${version.build.join('.')}` : '';
  return `${release}${prerelease}${build}`;
}

// SemVer precedence: a prerelease sorts below its release; numeric
// identifiers compare numerically and below alphanumeric ones.
function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  const release = compareNumericVersions(left.release, right.release);
  if (release !== 0) return release;
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return Math.sign(right.prerelease.length - left.prerelease.length);
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Math.sign(Number(a) - Number(b));
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

// Ranges use SemVer precedence, which ignores build metadata. An exact pin
// compares the whole token as written, build metadata included.
function satisfiesVersionPin(
  detected: ParsedVersion,
  pin: ProviderPrerequisiteVersion,
): boolean {
  const bound = (
    value: string | undefined,
    accept: (order: number, parsed: ParsedVersion) => boolean,
  ) => {
    if (value === undefined) return true;
    const parsed = parseVersion(value, PIN_VERSION);
    return (
      parsed !== undefined && accept(compareVersions(detected, parsed), parsed)
    );
  };
  return (
    bound(pin.exact, (_order, parsed) => detected.text === parsed.text) &&
    bound(pin.min, (order) => order >= 0) &&
    bound(pin.max, (order) => order <= 0)
  );
}

// An authored pin whose bound is not exactly one version, or whose range is
// empty, can never be satisfied; it is reported before any version probe.
function versionPinError(pin: ProviderPrerequisiteVersion): string | undefined {
  const bounds = { exact: pin.exact, min: pin.min, max: pin.max };
  const parsed: Partial<Record<keyof typeof bounds, ParsedVersion>> = {};
  for (const [field, value] of Object.entries(bounds) as Array<
    [keyof typeof bounds, string | undefined]
  >) {
    if (value === undefined) continue;
    const version = parseVersion(value, PIN_VERSION);
    if (!version) return `${field} ${JSON.stringify(value)} is not a version`;
    parsed[field] = version;
  }
  if (parsed.exact && (parsed.min || parsed.max)) {
    return 'exact cannot be combined with min or max';
  }
  if (parsed.min && parsed.max && compareVersions(parsed.min, parsed.max) > 0) {
    return `min ${pin.min} is above max ${pin.max}`;
  }
  return undefined;
}

function describeVersionPin(pin: ProviderPrerequisiteVersion): string {
  const parts = [
    ...(pin.exact !== undefined ? [`=${pin.exact}`] : []),
    ...(pin.min !== undefined ? [`>=${pin.min}`] : []),
    ...(pin.max !== undefined ? [`<=${pin.max}`] : []),
  ];
  return parts.length > 0 ? `version ${parts.join(' ')}` : 'version';
}
