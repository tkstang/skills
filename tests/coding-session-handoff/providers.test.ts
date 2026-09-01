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
        'Usage: codex exec fork [OPTIONS] ID PROMPT\n--json\n--disable <FEATURE> hooks\n--ignore-user-config\n--ignore-rules\n-C, --cd <DIR>\n',
      stderr: '',
    });
  }
  return Promise.resolve({
    stdout: '',
    stderr: 'Logged in using ChatGPT\r\n',
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
    const readConfigInputs = vi.fn(async () => [
      { name: 'config.toml', contents: 'model = "safe"\ntoken = "secret"' },
    ]);
    const result = await probeProvider('codex', {
      targetCwd: '/repo/target',
      deps: dependencies(run, { readConfigInputs }),
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
    expect(run.mock.calls[2]?.[1]).toEqual(['login', 'status']);
    expect(readConfigInputs).toHaveBeenCalledWith('codex', '/repo/target');
  });

  test.each([
    [
      'PATH warning plus authenticated text',
      '',
      'WARNING: proceeding, even though we could not update PATH\nLogged in using ChatGPT\n',
    ],
    ['extra stderr', '', 'Logged in using ChatGPT\nextra\n'],
    ['nonempty stdout', 'unexpected\n', 'Logged in using ChatGPT\n'],
    ['wrong stdout channel', 'Logged in using ChatGPT\n', ''],
    ['logged out', '', 'Not logged in\n'],
    ['contradictory text', '', 'Logged in using ChatGPT\nNot logged in\n'],
    ['unknown', '', 'Authentication status unavailable\n'],
    ['legacy JSON', '{"loggedIn":true,"authMethod":"chatgpt"}\n', ''],
  ] as const)(
    'fails Codex authentication closed for %s output',
    async (_case, authStdout, authStderr) => {
      const result = await probeProvider('codex', {
        deps: dependencies(async (executable, argv, options) => {
          if (argv[0] !== 'login') return codexRun(executable, argv, options);
          expect(argv).toEqual(['login', 'status']);
          expect(options).toEqual({
            timeoutMs: 10_000,
            maxOutputBytes: 65_536,
            shell: false,
          });
          return { stdout: authStdout, stderr: authStderr };
        }),
      });

      expect(result.capability.status).toBe('syntax-verified');
      expect(result.authentication).toEqual({
        status: 'required',
        loginCommand: 'codex login',
      });
    },
  );

  test('fails Codex authentication closed when login status exits nonzero', async () => {
    const result = await probeProvider('codex', {
      deps: dependencies(async (executable, argv, options) => {
        if (argv[0] !== 'login') return codexRun(executable, argv, options);
        throw Object.assign(new Error('status failed'), { code: 1 });
      }),
    });

    expect(result.capability.status).toBe('syntax-verified');
    expect(result.authentication).toEqual({
      status: 'required',
      loginCommand: 'codex login',
    });
  });

  test('preserves Claude JSON authentication probing', async () => {
    const run = vi.fn(async (_executable, argv, options) => {
      expect(options).toEqual({
        timeoutMs: 10_000,
        maxOutputBytes: 65_536,
        shell: false,
      });
      if (argv[0] === '--version') {
        return { stdout: '2.1.251 (Claude Code)\n', stderr: '' };
      }
      if (argv[0] === '--help') {
        return {
          stdout:
            '--safe-mode --print --output-format json --resume --fork-session --session-id --permission-mode plan --tools --max-budget-usd\n',
          stderr: '',
        };
      }
      expect(argv).toEqual(['auth', 'status', '--json']);
      return {
        stdout: '{"authenticated":true,"method":"oauth"}\n',
        stderr: '',
      };
    });
    const result = await probeProvider('claude', {
      deps: dependencies(run),
    });

    expect(result.capability.status).toBe('syntax-verified');
    expect(result.authentication).toEqual({
      status: 'authenticated',
      method: 'oauth',
      loginCommand: 'claude auth login',
    });
  });

  test('detects target-local Codex context drift before invocation planning', async () => {
    let targetInstructions = 'policy = "first"';
    const readConfigInputs = vi.fn(async (_provider, targetCwd) => [
      {
        name: `target:${targetCwd}:AGENTS.md`,
        contents: targetInstructions,
      },
    ]);
    const first = await probeProvider('codex', {
      targetCwd: '/repo/target',
      deps: dependencies(codexRun, { readConfigInputs }),
    });
    targetInstructions = 'policy = "changed"';
    const drifted = await probeProvider('codex', {
      targetCwd: '/repo/target',
      expectedExecutionContextFingerprint:
        first.capability.executionContextFingerprint,
      deps: dependencies(codexRun, { readConfigInputs }),
    });

    expect(first.capability.status).toBe('syntax-verified');
    expect(drifted.capability.status).toBe('execution-context-drift');
    expect(readConfigInputs).toHaveBeenLastCalledWith('codex', '/repo/target');
  });

  test.each([
    ['version-drift', 'codex-cli 0.152.0\n', undefined],
    [
      'help-shape-drift',
      'codex-cli 0.151.0\n',
      'Usage: codex exec fork ID\n--json\n',
    ],
  ] as const)('fails closed on %s', async (status, version, help) => {
    const run = vi.fn(async (_file, argv) => {
      if (argv[0] === '--version') return { stdout: version, stderr: '' };
      if (argv[0] === 'exec') {
        return { stdout: help ?? '', stderr: '' };
      }
      return { stdout: '', stderr: 'Logged in using ChatGPT\n' };
    });
    const result = await probeProvider('codex', {
      deps: dependencies(run),
    });
    expect(result.capability.status).toBe(status);
    expect(result.capability.executionContextFingerprint).toBeUndefined();
    expect(run.mock.calls.some(([, argv]) => argv[0] === 'login')).toBe(false);
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
        '--ignore-user-config',
        '--ignore-rules',
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
    expect(
      containsForbiddenBypassFlag([
        '--dangerously-bypass-approvals-and-sandbox',
      ]),
    ).toBe(true);
    expect(
      containsForbiddenBypassFlag(['--dangerously-bypass-hook-trust']),
    ).toBe(true);
    expect(containsForbiddenBypassFlag(['safe; --force'])).toBe(false);
    expect(containsForbiddenBypassFlag(['--safe-mode'])).toBe(false);
    for (const optionShapedId of [
      '--dangerously-bypass-approvals-and-sandbox',
      '--dangerously-bypass-hook-trust',
      '--unknown-provider-option',
      '-c',
    ]) {
      expect(() =>
        buildNativeInvocation('codex', optionShapedId, '/target'),
      ).toThrow('parent-native-id-invalid');
    }
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
