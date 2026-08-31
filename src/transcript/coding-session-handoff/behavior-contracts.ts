import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';

import type {
  HandoffProvider,
  NativeInvocation,
  ProviderBehaviorContract,
} from './types.js';

export const HANDOFF_MARKER_PROMPT =
  'Reply exactly HANDOFF_READY. Do not use tools.';

export const PROVIDER_EXACT_VERSIONS = Object.freeze({
  codex: '0.151.0',
  claude: '2.1.251',
}) satisfies Readonly<Record<HandoffProvider, string>>;

export const PROVIDER_REQUIRED_HELP_SHAPES = Object.freeze({
  codex: Object.freeze([
    'usage: codex exec fork',
    '--json',
    '--disable',
    'hooks',
  ]),
  claude: Object.freeze([
    '--safe-mode',
    '--print',
    '--output-format',
    '--resume',
    '--fork-session',
    '--session-id',
    '--permission-mode',
    '--tools',
    '--max-budget-usd',
  ]),
}) satisfies Readonly<Record<HandoffProvider, readonly string[]>>;

export const PROVIDER_SAFETY_ARGV = Object.freeze({
  codex: Object.freeze([
    '--json',
    '--disable',
    'hooks',
    '-c',
    'sandbox_mode="read-only"',
  ]),
  claude: Object.freeze([
    '--safe-mode',
    '--print',
    '--output-format',
    'json',
    '--permission-mode',
    'plan',
    '--tools',
    '',
    '--max-budget-usd',
    '0.15',
  ]),
}) satisfies Readonly<Record<HandoffProvider, readonly string[]>>;

const FORBIDDEN_BYPASS_FLAGS = new Set([
  '--allow-unverified',
  '--bypass',
  '--dangerously-skip-permissions',
  '--disable-sandbox',
  '--force',
  '--full-auto',
  '--no-sandbox',
  '--yolo',
]);

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function stripAnsiControlSequences(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value.codePointAt(index) !== 0x1b || value[index + 1] !== '[') {
      result += value[index];
      continue;
    }
    index += 2;
    while (index < value.length) {
      const code = value.codePointAt(index);
      if (code !== undefined && code >= 0x40 && code <= 0x7e) break;
      index += 1;
    }
  }
  return result;
}

export function normalizeCapabilityOutput(output: string): string {
  return stripAnsiControlSequences(output)
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/gu, ' ').toLowerCase())
    .filter(Boolean)
    .toSorted()
    .join('\n');
}

export function computeSyntaxFingerprint(
  provider: HandoffProvider,
  exactVersion: string,
  helpOutput: string,
): string {
  const normalized = normalizeCapabilityOutput(helpOutput);
  const matchedCapabilities = PROVIDER_REQUIRED_HELP_SHAPES[provider].map(
    (capability) => ({ capability, present: normalized.includes(capability) }),
  );
  return sha256Canonical({ provider, exactVersion, matchedCapabilities });
}

export interface ExecutionContextFingerprintInput {
  provider: HandoffProvider;
  executableSha256: string;
  exactVersion: string;
  syntaxFingerprint: string;
  safetyArgv: readonly string[];
  configInputs: readonly { name: string; redactedContents: string }[];
  authenticationMethod?: string;
}

export function computeExecutionContextFingerprint(
  input: ExecutionContextFingerprintInput,
): string {
  return sha256Canonical({
    provider: input.provider,
    executableSha256: input.executableSha256,
    exactVersion: input.exactVersion,
    syntaxFingerprint: input.syntaxFingerprint,
    safetyArgv: [...input.safetyArgv],
    configInputs: [...input.configInputs]
      .map((entry) => ({
        name: entry.name,
        redactedContents: entry.redactedContents,
      }))
      .toSorted((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      ),
    authenticationMethod: input.authenticationMethod ?? null,
  });
}

export function redactProviderConfig(contents: string): string {
  return contents
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => {
      const assignment = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/u);
      if (
        assignment &&
        /(?:auth|credential|key|password|secret|token)/iu.test(assignment[1])
      ) {
        return `${assignment[1]} = <redacted>`;
      }
      return line.trimEnd();
    })
    .join('\n');
}

export function containsForbiddenBypassFlag(argv: readonly string[]): boolean {
  return argv.some((argument) => FORBIDDEN_BYPASS_FLAGS.has(argument));
}

function assertInvocationInput(value: string, code: string): void {
  if (value.length === 0 || value.includes('\0')) throw new TypeError(code);
}

export function buildNativeInvocation(
  provider: HandoffProvider,
  parentNativeId: string,
  targetCwd: string,
  expectedChildNativeId?: string,
): NativeInvocation {
  assertInvocationInput(parentNativeId, 'parent-native-id-invalid');
  assertInvocationInput(targetCwd, 'target-cwd-invalid');
  if (!isAbsolute(targetCwd)) throw new TypeError('target-cwd-not-absolute');

  let argv: string[];
  if (provider === 'codex') {
    argv = [
      'exec',
      'fork',
      '--json',
      '--disable',
      'hooks',
      '-c',
      'sandbox_mode="read-only"',
      parentNativeId,
      HANDOFF_MARKER_PROMPT,
    ];
  } else {
    if (expectedChildNativeId === undefined) {
      throw new TypeError('claude-child-id-required');
    }
    assertInvocationInput(expectedChildNativeId, 'claude-child-id-invalid');
    argv = [
      '--safe-mode',
      '--print',
      '--output-format',
      'json',
      '--resume',
      parentNativeId,
      '--fork-session',
      '--session-id',
      expectedChildNativeId,
      '--permission-mode',
      'plan',
      '--tools',
      '',
      '--max-budget-usd',
      '0.15',
      HANDOFF_MARKER_PROMPT,
    ];
  }
  if (containsForbiddenBypassFlag(argv)) {
    throw new TypeError('forbidden-provider-flag');
  }
  return {
    executable: provider,
    argv,
    cwd: targetCwd,
    shell: false,
    stdio: 'pipe',
    timeoutMs: 60_000,
    maxOutputBytes: 65_536,
  };
}

function unverifiedContract(
  provider: HandoffProvider,
): ProviderBehaviorContract {
  const exactVersion = PROVIDER_EXACT_VERSIONS[provider];
  const syntaxFingerprint = sha256Canonical({
    provider,
    exactVersion,
    requiredCapabilities: PROVIDER_REQUIRED_HELP_SHAPES[provider],
  });
  return Object.freeze({
    provider,
    exactVersion,
    syntaxFingerprint,
    executionContextFingerprint: sha256Canonical({
      provider,
      exactVersion,
      status: 'unverified',
    }),
    successor: Object.freeze({ status: 'unverified' as const }),
    resume: Object.freeze({ status: 'unverified' as const }),
  });
}

export const PROVIDER_BEHAVIOR_CONTRACTS = Object.freeze({
  codex: unverifiedContract('codex'),
  claude: unverifiedContract('claude'),
}) satisfies Readonly<Record<HandoffProvider, ProviderBehaviorContract>>;
