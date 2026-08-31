import { createHash } from 'node:crypto';

import { describe, expect, test, vi } from 'vitest';

import {
  buildNativeInvocation,
  computeExecutionContextFingerprint,
  containsForbiddenBypassFlag,
  PROVIDER_BEHAVIOR_CONTRACTS,
} from '../../src/transcript/coding-session-handoff/behavior-contracts.js';
import {
  probeProvider,
  type ProviderProbeDependencies,
} from '../../src/transcript/coding-session-handoff/providers.js';

const executableBytes = Buffer.from('provider executable');

function dependencies(
  run: ProviderProbeDependencies['run'],
  overrides: Partial<ProviderProbeDependencies> = {},
): ProviderProbeDependencies {
  return {
    resolveExecutable: async (name) => `/usr/local/bin/${name}`,
    readFile: async () => executableBytes,
    readConfigInputs: async () => [
      { name: 'config.toml', contents: 'model = "safe"\ntoken = "secret"' },
    ],
    run,
    ...overrides,
  };
}

function codexRun(
  executable: string,
  argv: readonly string[],
  options: { timeoutMs: number; maxOutputBytes: number; shell: false },
) {
  expect(executable).toBe('/usr/local/bin/codex');
  expect(options).toEqual({
    timeoutMs: 10_000,
    maxOutputBytes: 65_536,
    shell: false,
  });
  if (argv[0] === '--version') {
    return Promise.resolve({ stdout: 'codex-cli 0.151.0\n', stderr: '' });
  }
  if (argv[0] === 'exec') {
    return Promise.resolve({
      stdout:
        'Usage: codex exec fork [OPTIONS] ID PROMPT\n--json\n--disable <FEATURE> hooks\n-C, --cd <DIR>\n',
      stderr: '',
    });
  }
  return Promise.resolve({
    stdout: '{"loggedIn":true,"authMethod":"chatgpt"}\n',
    stderr: '',
  });
}

describe('provider capability probes', () => {
  test('reports missing binaries without attempting subprocesses', async () => {
    const run = vi.fn();
    const result = await probeProvider('codex', {
      deps: dependencies(run, {
        resolveExecutable: async () => null,
      }),
    });

    expect(result.capability).toMatchObject({
      provider: 'codex',
      status: 'missing',
      missingCapabilities: ['executable'],
    });
    expect(result.authentication).toEqual({
      status: 'unavailable',
      method: undefined,
      loginCommand: 'codex login',
    });
    expect(run).not.toHaveBeenCalled();
  });

  test('accepts the exact Codex contract and hashes only redacted context', async () => {
    const run = vi.fn(codexRun);
    const result = await probeProvider('codex', {
      deps: dependencies(run),
    });

    expect(result.capability.status).toBe('syntax-verified');
    expect(result.capability.detectedVersion).toBe('0.151.0');
    expect(result.capability.contractFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.capability.executionContextFingerprint).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(result.authentication).toEqual({
      status: 'authenticated',
      method: 'chatgpt',
      loginCommand: 'codex login',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(run).toHaveBeenCalledTimes(3);
  });

  test.each([
    ['version-drift', 'codex-cli 0.152.0\n', undefined],
    [
      'help-shape-drift',
      'codex-cli 0.151.0\n',
      'Usage: codex exec fork ID\n--json\n',
    ],
  ] as const)('fails closed on %s', async (status, version, help) => {
    const result = await probeProvider('codex', {
      deps: dependencies(async (_file, argv) => {
        if (argv[0] === '--version') return { stdout: version, stderr: '' };
        if (argv[0] === 'exec') {
          return { stdout: help ?? '', stderr: '' };
        }
        return { stdout: '{"loggedIn":true}', stderr: '' };
      }),
    });
    expect(result.capability.status).toBe(status);
    expect(result.capability.executionContextFingerprint).toBeUndefined();
  });

  test('maps bounded process and unreadable-context failures to safe states', async () => {
    const timeout = Object.assign(new Error('raw path /secret'), {
      code: 'ETIMEDOUT',
    });
    const timedOut = await probeProvider('claude', {
      deps: dependencies(async () => {
        throw timeout;
      }),
    });
    expect(timedOut.capability).toMatchObject({ status: 'probe-failed' });
    expect(JSON.stringify(timedOut)).not.toContain('/secret');

    const unreadable = await probeProvider('codex', {
      deps: dependencies(codexRun, {
        readConfigInputs: async () => {
          throw new Error('/private/config');
        },
      }),
    });
    expect(unreadable.capability.status).toBe('execution-context-unreadable');
  });
});

describe('provider invocation and fingerprint policy', () => {
  test('ships exact unverified behavior contracts', () => {
    expect(PROVIDER_BEHAVIOR_CONTRACTS.codex).toMatchObject({
      exactVersion: '0.151.0',
      successor: { status: 'unverified' },
      resume: { status: 'unverified' },
    });
    expect(PROVIDER_BEHAVIOR_CONTRACTS.claude).toMatchObject({
      exactVersion: '2.1.251',
      successor: { status: 'unverified' },
      resume: { status: 'unverified' },
    });
  });

  test('builds exact shell-free Codex and Claude successor argv', () => {
    const malicious = 'parent; $(touch /tmp/nope)';
    expect(buildNativeInvocation('codex', malicious, '/target')).toEqual({
      executable: 'codex',
      argv: [
        'exec',
        'fork',
        '--json',
        '--disable',
        'hooks',
        '-c',
        'sandbox_mode="read-only"',
        malicious,
        'Reply exactly HANDOFF_READY. Do not use tools.',
      ],
      cwd: '/target',
      shell: false,
      stdio: 'pipe',
      timeoutMs: 60_000,
      maxOutputBytes: 65_536,
    });
    expect(
      buildNativeInvocation('claude', malicious, '/target', 'child-id').argv,
    ).toEqual([
      '--safe-mode',
      '--print',
      '--output-format',
      'json',
      '--resume',
      malicious,
      '--fork-session',
      '--session-id',
      'child-id',
      '--permission-mode',
      'plan',
      '--tools',
      '',
      '--max-budget-usd',
      '0.15',
      'Reply exactly HANDOFF_READY. Do not use tools.',
    ]);
  });

  test('requires Claude child IDs and rejects bypass flags defensively', () => {
    expect(() => buildNativeInvocation('claude', 'parent', '/target')).toThrow(
      'claude-child-id-required',
    );
    expect(
      containsForbiddenBypassFlag(['--dangerously-skip-permissions']),
    ).toBe(true);
    expect(containsForbiddenBypassFlag(['--allow-unverified'])).toBe(true);
    expect(containsForbiddenBypassFlag(['safe; --force'])).toBe(false);
    expect(containsForbiddenBypassFlag(['--safe-mode'])).toBe(false);
  });

  test('fingerprints normalized context and detects any safe-context drift', () => {
    const base = computeExecutionContextFingerprint({
      provider: 'codex',
      executableSha256: createHash('sha256')
        .update(executableBytes)
        .digest('hex'),
      exactVersion: '0.151.0',
      syntaxFingerprint: 'a'.repeat(64),
      safetyArgv: ['--disable', 'hooks'],
      configInputs: [
        { name: 'config.toml', redactedContents: 'model = "safe"' },
      ],
      authenticationMethod: 'chatgpt',
    });
    expect(base).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      computeExecutionContextFingerprint({
        provider: 'codex',
        executableSha256: createHash('sha256')
          .update(executableBytes)
          .digest('hex'),
        exactVersion: '0.151.0',
        syntaxFingerprint: 'a'.repeat(64),
        safetyArgv: ['--disable', 'hooks'],
        configInputs: [
          { name: 'config.toml', redactedContents: 'model = "different"' },
        ],
        authenticationMethod: 'chatgpt',
      }),
    ).not.toBe(base);
  });
});
