import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../provider-cli/adapters.js';
import {
  normalizeRunRequest,
  parseConsensusCliArgs,
} from '../provider-cli/args.js';
import {
  buildChildEnvironment,
  buildProviderProbeEnvironment,
  defaultRuntimePolicy,
  redactedRuntimePolicyDiagnostics,
  validateProviderOptions,
} from '../provider-cli/runtime-policy.js';
import type {
  ConsensusCliRunRequest,
  ProviderCapabilities,
  ProviderRuntimePolicy,
} from '../provider-cli/types.js';

describe('provider runtime policy validation', () => {
  it('accepts supported model, effort, and runtime policy options', () => {
    const result = validateProviderOptions(
      request({
        provider: 'codex',
        model: 'gpt-5.1-codex',
        effort: 'high',
        runtime_policy: {
          permission_mode: 'non-interactive',
          sandbox: 'workspace-write',
          approval_policy: 'never',
          env_allowlist: ['OPENAI_API_KEY'],
        },
      }),
      capabilities('codex'),
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects unsupported model, effort, and runtime policy options', () => {
    expect(
      validateProviderOptions(
        request({ provider: 'cursor', model: 'cursor-model' }),
        capabilities('cursor'),
      ),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      option: 'model',
    });

    expect(
      validateProviderOptions(
        request({ provider: 'cursor', effort: 'high' }),
        capabilities('cursor'),
      ),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      option: 'effort',
    });

    expect(
      validateProviderOptions(
        request({
          provider: 'claude',
          runtime_policy: { sandbox: 'workspace-write' },
        }),
        capabilities('claude'),
      ),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      option: 'runtime_policy.sandbox',
    });
  });

  it('uses a non-interactive default runtime policy', () => {
    expect(defaultRuntimePolicy()).toEqual({
      permission_mode: 'non-interactive',
    });
    expect(defaultRuntimePolicy({ sandbox: 'read-only' })).toEqual({
      permission_mode: 'non-interactive',
      sandbox: 'read-only',
    });
  });

  it('rejects scoped grants for other providers, broad paths, and incompatible modes', () => {
    expect(
      validateProviderOptions(
        request({
          provider: 'codex',
          runtime_policy: { read_paths: ['/private/brief.md'] },
        }),
        capabilities('codex'),
      ),
    ).toMatchObject({ ok: false, option: 'runtime_policy.scoped_tools' });
    expect(
      validateProviderOptions(
        request({
          provider: 'claude',
          runtime_policy: { read_paths: ['/private/**'] },
        }),
        capabilities('claude'),
      ),
    ).toMatchObject({ ok: false, option: 'runtime_policy.read_paths' });
    expect(
      validateProviderOptions(
        request({
          provider: 'claude',
          runtime_policy: {
            permission_mode: 'read-only',
            web_search: true,
          },
        }),
        capabilities('claude'),
      ),
    ).toMatchObject({ ok: false, option: 'runtime_policy.permission_mode' });
  });

  describe('attempt budget', () => {
    const readPath = realpathSync(fileURLToPath(import.meta.url));

    it.each<[string, Partial<ConsensusCliRunRequest>]>([
      [
        'Codex with an explicit read-only sandbox',
        { provider: 'codex', runtime_policy: { sandbox: 'read-only' } },
      ],
      [
        'Claude read-only',
        {
          provider: 'claude',
          runtime_policy: { permission_mode: 'read-only' },
        },
      ],
      [
        'Claude read-only with a read grant',
        {
          provider: 'claude',
          runtime_policy: {
            permission_mode: 'read-only',
            read_paths: [readPath],
          },
        },
      ],
      [
        'Cursor read-only',
        {
          provider: 'cursor',
          runtime_policy: { permission_mode: 'read-only' },
        },
      ],
    ])('allows retries for %s', (_label, overrides) => {
      expect(
        validateProviderOptions(
          request({ ...overrides, max_attempts: 3 }),
          capabilities(overrides.provider as 'claude' | 'codex' | 'cursor'),
        ),
      ).toEqual({ ok: true });
    });

    it.each<[string, Partial<ConsensusCliRunRequest>]>([
      ['Codex with an omitted sandbox', { provider: 'codex' }],
      [
        'Codex workspace-write',
        { provider: 'codex', runtime_policy: { sandbox: 'workspace-write' } },
      ],
      ['unscoped Claude non-interactive', { provider: 'claude' }],
      [
        'Claude with an edit grant',
        {
          provider: 'claude',
          runtime_policy: {
            permission_mode: 'non-interactive',
            edit_paths: [path.join(path.dirname(readPath), 'out.md')],
          },
        },
      ],
      [
        'Claude with a Bash grant',
        {
          provider: 'claude',
          runtime_policy: {
            permission_mode: 'workspace-write',
            bash_patterns: ['git status:*'],
          },
        },
      ],
      [
        'Claude workspace-write',
        {
          provider: 'claude',
          runtime_policy: { permission_mode: 'workspace-write' },
        },
      ],
      ['Cursor non-interactive', { provider: 'cursor' }],
    ])('rejects retries for %s', (_label, overrides) => {
      const id = overrides.provider as 'claude' | 'codex' | 'cursor';
      expect(
        validateProviderOptions(
          request({ ...overrides, max_attempts: 2 }),
          capabilities(id),
        ),
      ).toMatchObject({
        ok: false,
        code: 'CONSENSUS_CLI_USAGE',
        option: 'max_attempts',
      });
      expect(
        validateProviderOptions(
          request({ ...overrides, max_attempts: 1 }),
          capabilities(id),
        ),
      ).toEqual({ ok: true });
    });
  });

  describe('Cursor text mode', () => {
    const textIo = (stdin = '') => ({
      cwd: '/workspace',
      readFile: async (filePath: string): Promise<string> => {
        throw new Error(`Unexpected file read: ${filePath}`);
      },
      readStdin: async () => stdin,
    });
    const fromFlags = (policyFlags: string[]) =>
      normalizeRunRequest(
        parseConsensusCliArgs([
          'run',
          '--provider',
          'cursor',
          '--output',
          'text',
          ...policyFlags,
          '--json',
          '--prompt',
          'Reply in prose.',
        ]),
        textIo(),
      );
    const fromRequestJson = (runtimePolicy?: ProviderRuntimePolicy) =>
      normalizeRunRequest(
        parseConsensusCliArgs(['run', '--request-json', '-', '--json']),
        textIo(
          JSON.stringify({
            schema_version: 'v1',
            provider: 'cursor',
            output: 'text',
            prompt: 'Reply in prose.',
            ...(runtimePolicy ? { runtime_policy: runtimePolicy } : {}),
          }),
        ),
      );

    // Each of these would otherwise reach `--print ... --force`.
    it.each<[string, () => Promise<ConsensusCliRunRequest>]>([
      ['an omitted policy through flags', () => fromFlags([])],
      [
        'non-interactive through flags',
        () => fromFlags(['--permission-mode', 'non-interactive']),
      ],
      [
        'workspace-write through flags',
        () => fromFlags(['--permission-mode', 'workspace-write']),
      ],
      ['an omitted policy through request JSON', () => fromRequestJson()],
      [
        'non-interactive through request JSON',
        () => fromRequestJson({ permission_mode: 'non-interactive' }),
      ],
      [
        'workspace-write through request JSON',
        () => fromRequestJson({ permission_mode: 'workspace-write' }),
      ],
    ])('rejects %s', async (_label, build) => {
      expect(
        validateProviderOptions(await build(), capabilities('cursor')),
      ).toMatchObject({
        ok: false,
        code: 'PROVIDER_UNSUPPORTED_OPTION',
        option: 'runtime_policy.permission_mode',
      });
    });

    it('accepts read-only through flags and request JSON', async () => {
      for (const built of [
        await fromFlags(['--permission-mode', 'read-only']),
        await fromRequestJson({ permission_mode: 'read-only' }),
      ]) {
        expect(validateProviderOptions(built, capabilities('cursor'))).toEqual({
          ok: true,
        });
      }
    });

    it('leaves JSON-mode Cursor profiles unchanged', () => {
      expect(
        validateProviderOptions(
          request({ provider: 'cursor' }),
          capabilities('cursor'),
        ),
      ).toEqual({ ok: true });
    });
  });

  describe('Claude permission composition', () => {
    const readPath = realpathSync(fileURLToPath(import.meta.url));
    const editPath = path.join(path.dirname(readPath), 'new-output.md');

    it.each<[string, ProviderRuntimePolicy]>([
      ['read-only without grants', { permission_mode: 'read-only' }],
      [
        'read-only with read grants',
        { permission_mode: 'read-only', read_paths: [readPath] },
      ],
      [
        'non-interactive without grants',
        { permission_mode: 'non-interactive' },
      ],
      [
        'non-interactive with read, edit, and web grants',
        {
          permission_mode: 'non-interactive',
          read_paths: [readPath],
          edit_paths: [editPath],
          web_search: true,
          web_fetch_domains: ['example.org'],
        },
      ],
      [
        'workspace-write without grants',
        { permission_mode: 'workspace-write' },
      ],
      [
        'workspace-write with Bash grants',
        {
          permission_mode: 'workspace-write',
          bash_patterns: ['git status:*', 'pnpm run test'],
        },
      ],
    ])('accepts %s', (_label, runtimePolicy) => {
      expect(
        validateProviderOptions(
          request({ provider: 'claude', runtime_policy: runtimePolicy }),
          capabilities('claude'),
        ),
      ).toEqual({ ok: true });
    });

    it.each<[string, ProviderRuntimePolicy]>([
      ['read-only', { edit_paths: [editPath] }],
      ['read-only', { bash_patterns: ['git status:*'] }],
      ['read-only', { web_search: true }],
      ['read-only', { web_fetch_domains: ['example.org'] }],
      ['non-interactive', { bash_patterns: ['git status:*'] }],
      ['workspace-write', { read_paths: [readPath] }],
      ['workspace-write', { edit_paths: [editPath] }],
      ['workspace-write', { web_search: true }],
      ['workspace-write', { web_fetch_domains: ['example.org'] }],
    ])('rejects %s with %j', (mode, grants) => {
      expect(
        validateProviderOptions(
          request({
            provider: 'claude',
            runtime_policy: { permission_mode: mode, ...grants },
          }),
          capabilities('claude'),
        ),
      ).toMatchObject({
        ok: false,
        code: 'PROVIDER_UNSUPPORTED_OPTION',
        option: 'runtime_policy.permission_mode',
      });
    });

    it('rejects Claude modes outside the composition table', () => {
      for (const mode of ['plan', 'acceptEdits', 'bypassPermissions']) {
        expect(
          validateProviderOptions(
            request({
              provider: 'claude',
              runtime_policy: { permission_mode: mode },
            }),
            capabilities('claude'),
          ),
        ).toMatchObject({
          ok: false,
          option: 'runtime_policy.permission_mode',
        });
      }
    });

    it('rejects Bash grants that are not one exact command pattern', () => {
      for (const pattern of [
        '*',
        ':*',
        ' git status',
        'git status)',
        'git (status)',
        'git status,rm -rf',
        'git status\nrm -rf /',
      ]) {
        expect(
          validateProviderOptions(
            request({
              provider: 'claude',
              runtime_policy: {
                permission_mode: 'workspace-write',
                bash_patterns: [pattern],
              },
            }),
            capabilities('claude'),
          ),
        ).toMatchObject({ ok: false, option: 'runtime_policy.bash_patterns' });
      }
      expect(
        validateProviderOptions(
          request({
            provider: 'codex',
            runtime_policy: { bash_patterns: ['git status:*'] },
          }),
          capabilities('codex'),
        ),
      ).toMatchObject({ ok: false, option: 'runtime_policy.scoped_tools' });
    });
  });

  it('rejects directory grants while allowing a file and a new file in a canonical parent', () => {
    const testFile = realpathSync(fileURLToPath(import.meta.url));
    const directory = path.dirname(testFile);
    for (const filePath of [directory, `${directory}/`, '/']) {
      expect(
        validateProviderOptions(
          request({
            provider: 'claude',
            runtime_policy: { edit_paths: [filePath] },
          }),
          capabilities('claude'),
        ),
      ).toMatchObject({ ok: false, option: 'runtime_policy.edit_paths' });
    }
    expect(
      validateProviderOptions(
        request({
          provider: 'claude',
          runtime_policy: {
            read_paths: [testFile],
            edit_paths: [path.join(directory, 'new-advisory-output.md')],
          },
        }),
        capabilities('claude'),
      ),
    ).toEqual({ ok: true });
  });

  it.each([
    [
      'claude',
      ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
      ['OPENAI_API_KEY', 'CURSOR_API_KEY'],
    ],
    ['codex', ['OPENAI_API_KEY'], ['ANTHROPIC_API_KEY', 'CURSOR_API_KEY']],
    ['cursor', ['CURSOR_API_KEY'], ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']],
  ] as const)(
    'passes only %s provider credentials plus base and host environment',
    (provider, expectedProviderKeys, omittedProviderKeys) => {
      const env = buildChildEnvironment({
        parentEnv: {
          PATH: '/usr/bin',
          HOME: '/Users/test',
          ANTHROPIC_API_KEY: 'anthropic-secret',
          CLAUDE_CODE_OAUTH_TOKEN: 'claude-token',
          OPENAI_API_KEY: 'openai-secret',
          CURSOR_API_KEY: 'cursor-secret',
          SECRET_TOKEN: 'do-not-pass',
        },
        request: request({ provider }),
        hostEnv: {
          CONSENSUS_RUN_ID: 'run-123',
          CONSENSUS_PARENT_HOST: provider,
          CONSENSUS_DEPTH: '1',
        },
      });

      expect(env).toMatchObject({
        PATH: '/usr/bin',
        HOME: '/Users/test',
        CONSENSUS_RUN_ID: 'run-123',
        CONSENSUS_PARENT_HOST: provider,
        CONSENSUS_DEPTH: '1',
      });
      for (const key of expectedProviderKeys) {
        expect(env).toHaveProperty(key);
      }
      for (const key of omittedProviderKeys) {
        expect(env).not.toHaveProperty(key);
      }
      expect(env).not.toHaveProperty('SECRET_TOKEN');
    },
  );

  it('strips reserved submit variables in text mode even when allowlisted', () => {
    const submitEnv = {
      CONSENSUS_SUBMIT_FILE: '/workspace/.consensus/submit/x.json',
      CONSENSUS_SUBMIT_SCHEMA: '/workspace/schema.json',
      CONSENSUS_SUBMIT_COMMAND: 'consensus submit',
    };
    const build = (output: 'json' | 'text') =>
      buildChildEnvironment({
        parentEnv: { PATH: '/usr/bin', ...submitEnv },
        request: request({
          provider: 'codex',
          output,
          runtime_policy: { env_allowlist: Object.keys(submitEnv) },
        }),
        hostEnv: {
          CONSENSUS_RUN_ID: 'run-123',
          CONSENSUS_SUBMIT_FILE: '/host/submit.json',
        },
      });

    const textEnv = build('text');
    expect(
      Object.keys(textEnv).filter((name) =>
        name.startsWith('CONSENSUS_SUBMIT_'),
      ),
    ).toEqual([]);
    expect(textEnv).toMatchObject({
      PATH: '/usr/bin',
      CONSENSUS_RUN_ID: 'run-123',
    });
    // JSON mode keeps today's allowlist behaviour.
    expect(build('json')).toMatchObject({
      CONSENSUS_SUBMIT_SCHEMA: '/workspace/schema.json',
      CONSENSUS_SUBMIT_FILE: '/host/submit.json',
    });
  });

  it('allows explicit env allowlist variables even when unrelated to the selected provider', () => {
    const env = buildChildEnvironment({
      parentEnv: {
        PATH: '/usr/bin',
        HOME: '/Users/test',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        OPENAI_API_KEY: 'openai-secret',
        CUSTOM_OPENAI_COMPATIBLE_KEY: 'custom-secret',
        SECRET_TOKEN: 'do-not-pass',
      },
      request: request({
        provider: 'claude',
        runtime_policy: {
          env_allowlist: ['CUSTOM_OPENAI_COMPATIBLE_KEY'],
        },
      }),
      hostEnv: {
        CONSENSUS_RUN_ID: 'run-123',
        CONSENSUS_PARENT_HOST: 'claude',
        CONSENSUS_DEPTH: '1',
      },
    });

    expect(env).toMatchObject({
      PATH: '/usr/bin',
      HOME: '/Users/test',
      ANTHROPIC_API_KEY: 'anthropic-secret',
      CUSTOM_OPENAI_COMPATIBLE_KEY: 'custom-secret',
      CONSENSUS_RUN_ID: 'run-123',
      CONSENSUS_PARENT_HOST: 'claude',
      CONSENSUS_DEPTH: '1',
    });
    expect(env).not.toHaveProperty('OPENAI_API_KEY');
    expect(env).not.toHaveProperty('SECRET_TOKEN');
  });

  it('never forwards CONSENSUS_<PROVIDER>_EXECUTABLE, even when a request allowlists it', () => {
    const env = buildChildEnvironment({
      parentEnv: {
        PATH: '/usr/bin',
        CONSENSUS_CLAUDE_EXECUTABLE: '/opt/bin/claude-wrapper',
        CONSENSUS_CODEX_EXECUTABLE: '/opt/bin/codex-wrapper',
        CONSENSUS_CURSOR_EXECUTABLE: '/opt/bin/cursor-wrapper',
      },
      request: request({
        provider: 'cursor',
        runtime_policy: {
          env_allowlist: [
            'CONSENSUS_CLAUDE_EXECUTABLE',
            'CONSENSUS_CODEX_EXECUTABLE',
            'CONSENSUS_CURSOR_EXECUTABLE',
          ],
        },
      }),
      hostEnv: {},
    });

    expect(env).toEqual({ PATH: '/usr/bin' });
  });

  it('merges submit capture variables from host env without requiring allowlist', () => {
    const env = buildChildEnvironment({
      parentEnv: {
        PATH: '/usr/bin',
        CONSENSUS_SUBMIT_FILE: '/untrusted/capture.json',
        CONSENSUS_SUBMIT_SCHEMA: '/untrusted/schema.json',
      },
      request: request({ provider: 'claude' }),
      hostEnv: {
        CONSENSUS_SUBMIT_FILE: '/tmp/capture.json',
        CONSENSUS_SUBMIT_SCHEMA: '/tmp/schema.json',
      },
    });

    expect(env).toMatchObject({
      PATH: '/usr/bin',
      CONSENSUS_SUBMIT_FILE: '/tmp/capture.json',
      CONSENSUS_SUBMIT_SCHEMA: '/tmp/schema.json',
    });
  });

  it('allows caller-named env variables without exposing values in diagnostics', () => {
    const policy = {
      env_allowlist: ['CUSTOM_SECRET'],
    };
    const env = buildChildEnvironment({
      parentEnv: {
        CUSTOM_SECRET: 'custom-secret-value',
      },
      request: request({ provider: 'claude', runtime_policy: policy }),
      hostEnv: {},
    });
    const diagnostics = redactedRuntimePolicyDiagnostics(policy);

    expect(env.CUSTOM_SECRET).toBe('custom-secret-value');
    expect(diagnostics).toEqual({
      permission_mode: 'non-interactive',
      env_allowlist: ['CUSTOM_SECRET'],
    });
    expect(JSON.stringify(diagnostics)).not.toContain('custom-secret-value');
  });

  it.each([
    ['claude', ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']],
    ['codex', ['OPENAI_API_KEY']],
    ['cursor', ['CURSOR_API_KEY']],
  ] as const)(
    'limits the %s readiness probe environment to base and selected-provider variables',
    (provider, selectedKeys) => {
      const env = buildProviderProbeEnvironment({
        parentEnv: {
          PATH: '/usr/bin',
          HOME: '/Users/test',
          ANTHROPIC_API_KEY: 'anthropic-secret',
          CLAUDE_CODE_OAUTH_TOKEN: 'claude-token',
          OPENAI_API_KEY: 'openai-secret',
          CURSOR_API_KEY: 'cursor-secret',
          HTTPS_PROXY: 'https://proxy.example.test',
          SECRET_TOKEN: 'do-not-pass',
        },
        provider,
      });

      expect(env).toMatchObject({ PATH: '/usr/bin', HOME: '/Users/test' });
      for (const key of selectedKeys) expect(env).toHaveProperty(key);
      for (const key of [
        'ANTHROPIC_API_KEY',
        'CLAUDE_CODE_OAUTH_TOKEN',
        'OPENAI_API_KEY',
        'CURSOR_API_KEY',
      ]) {
        if (!selectedKeys.includes(key as never))
          expect(env).not.toHaveProperty(key);
      }
      expect(env).not.toHaveProperty('HTTPS_PROXY');
      expect(env).not.toHaveProperty('SECRET_TOKEN');
    },
  );
});

function capabilities(id: 'claude' | 'codex' | 'cursor'): ProviderCapabilities {
  const selected = providerRegistry().get(id);
  if (!selected) throw new Error(`Missing adapter fixture: ${id}`);
  return selected.capabilities;
}

function request(
  overrides: Partial<ConsensusCliRunRequest>,
): ConsensusCliRunRequest {
  return {
    schema_version: 'v1',
    provider: 'claude',
    schema_path: 'schema.json',
    prompt: 'Return JSON.',
    ...overrides,
  };
}
