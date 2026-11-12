import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../provider-cli/adapters.js';
import {
  buildProviderInvocation,
  type ProviderInvocation,
} from '../provider-cli/invocation.js';
import { defaultRuntimePolicy } from '../provider-cli/runtime-policy.js';
import type {
  ConsensusCliRunRequest,
  ProviderPermissionProfile,
  ProviderRuntimePolicy,
  StructuredOutputStrategy,
} from '../provider-cli/types.js';

describe('provider invocation builders', () => {
  it.each([
    ['claude', 'prompt_only'],
    ['codex', 'prompt_only'],
    ['cursor', 'prompt_only'],
  ] as const)(
    'builds %s argv arrays without shell interpolation or prompt argv leakage',
    (id, strategy) => {
      const invocation = buildInvocation(id, strategy);

      expect(invocation.shell).toBe(false);
      expect(invocation.argv).toEqual(expect.any(Array));
      expect(invocation.stdin).toBe('Sensitive prompt text.');
      expect(invocation.argv.join(' ')).not.toContain('Sensitive prompt text.');
      expect(invocation.redacted_command).toEqual([
        invocation.executable,
        ...invocation.argv,
      ]);
    },
  );

  it('reflects Claude provider-validated schema strategy in argv', () => {
    const invocation = buildInvocation('claude', 'provider_validated', {
      model: 'claude-sonnet',
      effort: 'high',
    });

    expect(invocation).toMatchObject({
      executable: 'claude',
      output_mode: 'stdout_json',
      strategy: 'provider_validated',
    });
    expect(invocation.argv).toEqual([
      '--print',
      '--output-format',
      'json',
      '--json-schema',
      schemaJson(),
      '--model',
      'claude-sonnet',
      '--effort',
      'high',
    ]);
    expect(argumentAfter(invocation.argv, '--json-schema')).not.toMatch(
      /(?:^|\/)schema\.json$/,
    );
    expect(JSON.parse(argumentAfter(invocation.argv, '--json-schema'))).toEqual(
      schema(),
    );
    expect(invocation.redacted_command).toEqual([
      'claude',
      '--print',
      '--output-format',
      'json',
      '--json-schema',
      '<inline-json-schema>',
      '--model',
      'claude-sonnet',
      '--effort',
      'high',
    ]);
    expect(JSON.stringify(invocation.redacted_command)).not.toContain(
      'properties',
    );
  });

  it.each<[string, ProviderRuntimePolicy, string[], ProviderPermissionProfile]>(
    [
      [
        'read-only',
        { permission_mode: 'read-only' },
        ['--permission-mode', 'plan'],
        { mode: 'plan' },
      ],
      [
        'read-only with a read grant',
        {
          permission_mode: 'read-only',
          read_paths: ['/private/vault/brief with spaces.md'],
        },
        [
          '--allowedTools',
          'Read(//private/vault/brief with spaces.md)',
          '--tools',
          'Read,Glob,Grep',
          '--permission-prompts',
          'none',
          '--permission-mode',
          'dontAsk',
          '--strict-mcp-config',
        ],
        {
          mode: 'dontAsk',
          tools: ['Read', 'Glob', 'Grep'],
          allowed_tools: ['Read(<path>)'],
        },
      ],
      [
        'non-interactive',
        { permission_mode: 'non-interactive' },
        [],
        { mode: 'provider_default' },
      ],
      [
        'non-interactive with scoped grants',
        {
          permission_mode: 'non-interactive',
          read_paths: ['/private/vault/brief with spaces.md'],
          edit_paths: ['/private/scratch/result.md'],
          web_search: true,
          web_fetch_domains: ['example.org'],
        },
        [
          '--allowedTools',
          'Read(//private/vault/brief with spaces.md)',
          'Edit(//private/scratch/result.md)',
          'WebSearch',
          'WebFetch(domain:example.org)',
          '--tools',
          'Read,Edit,Write,WebSearch,WebFetch',
          '--permission-prompts',
          'none',
          '--permission-mode',
          'dontAsk',
          '--strict-mcp-config',
        ],
        {
          mode: 'dontAsk',
          tools: ['Read', 'Edit', 'Write', 'WebSearch', 'WebFetch'],
          allowed_tools: [
            'Read(<path>)',
            'Edit(<path>)',
            'WebSearch',
            'WebFetch(domain:example.org)',
          ],
        },
      ],
      [
        'workspace-write',
        { permission_mode: 'workspace-write' },
        [
          '--tools',
          'Read,Glob,Grep,Edit,Write',
          '--permission-prompts',
          'none',
          '--permission-mode',
          'acceptEdits',
          '--strict-mcp-config',
        ],
        {
          mode: 'acceptEdits',
          tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write'],
        },
      ],
      [
        'workspace-write with Bash grants',
        {
          permission_mode: 'workspace-write',
          bash_patterns: ['git status:*', 'pnpm run test'],
        },
        [
          '--allowedTools',
          'Bash(git status:*)',
          'Bash(pnpm run test)',
          '--tools',
          'Read,Glob,Grep,Edit,Write,Bash',
          '--permission-prompts',
          'none',
          '--permission-mode',
          'acceptEdits',
          '--strict-mcp-config',
        ],
        {
          mode: 'acceptEdits',
          tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'],
          allowed_tools: ['Bash(git status:*)', 'Bash(pnpm run test)'],
        },
      ],
    ],
  )(
    'builds the exact Claude permission flags for %s',
    (_label, runtimePolicy, policyArgv, permissionProfile) => {
      const invocation = buildInvocation('claude', 'prompt_only', {
        runtime_policy: runtimePolicy,
      });

      expect(invocation.argv).toEqual([
        '--print',
        '--output-format',
        'json',
        ...policyArgv,
      ]);
      expect(invocation.permission_profile).toEqual(permissionProfile);
      expect(JSON.stringify(invocation.permission_profile)).not.toContain(
        '/private/',
      );
      expect(invocation.redacted_command.join(' ')).not.toContain('/private/');
    },
  );

  it.each<['claude' | 'codex', ProviderRuntimePolicy, string[], string[]]>([
    [
      'claude',
      {
        permission_mode: 'workspace-write',
        bash_patterns: ['git status:*'],
      },
      [
        '--print',
        '--output-format',
        'json',
        '--allowedTools',
        'Bash(git status:*)',
        '--tools',
        'Read,Glob,Grep,Edit,Write,Bash',
        '--permission-prompts',
        'none',
        '--permission-mode',
        'acceptEdits',
        '--strict-mcp-config',
      ],
      [
        '--print',
        '--output-format',
        'json',
        '--allowedTools',
        'Bash(git status:*)',
        '--tools',
        'Read,Glob,Grep,Edit,Write,Bash',
        '--permission-prompts',
        'none',
        '--permission-mode',
        'acceptEdits',
        '--strict-mcp-config',
        '--resume',
        '0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41',
      ],
    ],
    [
      'codex',
      {
        permission_mode: 'non-interactive',
        sandbox: 'workspace-write',
        approval_policy: 'never',
      },
      [
        'exec',
        '--json',
        '--output-last-message',
        '<last-message>',
        '--sandbox',
        'workspace-write',
        '-c',
        'approval_policy="never"',
      ],
      // `codex exec resume` rejects `--sandbox`, so the same sandbox is set
      // through the config override (live check 2026-11-11, codex-cli 0.166.0:
      // it applies over an ambient danger-full-access config).
      [
        'exec',
        'resume',
        '--json',
        '--output-last-message',
        '<last-message>',
        '-c',
        'sandbox_mode="workspace-write"',
        '-c',
        'approval_policy="never"',
        '0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41',
        '-',
      ],
    ],
  ])(
    'keeps the %s write policy on a resumed write turn',
    (id, runtimePolicy, firstTurnArgv, resumedArgv) => {
      const lastMessageFile = '<last-message>';
      const first = buildInvocation(
        id,
        'prompt_only',
        {
          runtime_policy: runtimePolicy,
        },
        { lastMessageFile },
      );
      const resumed = buildInvocation(
        id,
        'prompt_only',
        { runtime_policy: runtimePolicy },
        { resumeSessionId: SESSION_ID, lastMessageFile },
      );

      expect(first.argv).toEqual(firstTurnArgv);
      expect(resumed.argv).toEqual(resumedArgv);
    },
  );

  it('reflects Codex constrained-native schema and reasoning effort in argv', () => {
    const invocation = buildInvocation('codex', 'constrained_native', {
      model: 'gpt-5.1-codex',
      effort: 'xhigh',
      runtime_policy: {
        sandbox: 'workspace-write',
        approval_policy: 'never',
      },
    });

    expect(invocation.output_mode).toBe('last_message_file');
    expect(invocation.last_message_file).toMatch(
      /consensus-codex-last-message-.*\.txt$/,
    );
    expect(invocation.argv).toEqual([
      'exec',
      '--json',
      '--output-last-message',
      invocation.last_message_file,
      '--output-schema',
      'schema.json',
      '--model',
      'gpt-5.1-codex',
      '-c',
      'model_reasoning_effort="xhigh"',
      '--sandbox',
      'workspace-write',
      '-c',
      'approval_policy="never"',
    ]);
  });

  it('uses a caller-owned Codex capture without scheduling its cleanup', () => {
    const capturePath = '/external/reviews/run-123/codex-last-message.json';
    const adapter = providerRegistry().get('codex')!;
    const invocation = buildProviderInvocation(
      adapter,
      {
        schema_version: 'v1',
        provider: 'codex',
        schema_path: 'schema.json',
        prompt: 'Sensitive prompt text.',
      },
      {
        strategy: 'prompt_only',
        lastMessageFile: capturePath,
        preserveLastMessageFile: true,
      },
    );

    expect(invocation.last_message_file).toBe(capturePath);
    expect(invocation.cleanup_last_message_file).toBe(false);
    expect(invocation.argv).toEqual(
      expect.arrayContaining(['--output-last-message', capturePath]),
    );
    expect(invocation.argv).not.toContain('--output-schema');
  });

  it('maps effective non-interactive runtime policies to provider controls', () => {
    const claude = buildInvocation('claude', 'provider_validated', {
      runtime_policy: defaultRuntimePolicy(),
    });
    const codex = buildInvocation('codex', 'constrained_native', {
      runtime_policy: defaultRuntimePolicy(),
    });
    const cursor = buildInvocation('cursor', 'prompt_only', {
      runtime_policy: defaultRuntimePolicy(),
    });

    expect(claude.argv).not.toContain('--permission-mode');
    expect(codex.argv).toEqual(
      expect.arrayContaining(['-c', 'approval_policy="never"']),
    );
    expect(cursor.argv).toContain('--force');
  });

  it('maps provider-neutral Claude read-only policy to a supported permission mode', () => {
    const claude = buildInvocation('claude', 'provider_validated', {
      runtime_policy: { permission_mode: 'read-only' },
    });

    expect(claude.argv).toEqual(
      expect.arrayContaining(['--permission-mode', 'plan']),
    );
  });

  it('keeps Cursor on prompt-only argv shape unless submit-tool is explicitly implemented later', () => {
    const invocation = buildInvocation('cursor', 'prompt_only', {
      model: 'ignored-model',
      effort: 'ignored-effort',
    });

    expect(invocation).toMatchObject({
      executable: 'cursor-agent',
      output_mode: 'stdout_json',
      strategy: 'prompt_only',
    });
    expect(invocation.argv).toEqual([
      '--print',
      '--output-format',
      'json',
      '--force',
    ]);
    expect(invocation.argv.join(' ')).not.toContain('ignored-model');
    expect(invocation.argv.join(' ')).not.toContain('ignored-effort');
  });

  it('resumes an exact Codex thread with stdin prompt and config-override sandbox', () => {
    const invocation = buildInvocation(
      'codex',
      'constrained_native',
      { runtime_policy: { sandbox: 'read-only', approval_policy: 'never' } },
      { resumeSessionId: SESSION_ID },
    );

    // `codex exec resume` rejects `--sandbox` and takes the thread positionally.
    expect(invocation.argv.slice(0, 2)).toEqual(['exec', 'resume']);
    expect(invocation.argv.slice(-2)).toEqual([SESSION_ID, '-']);
    expect(invocation.argv).not.toContain('--sandbox');
    expect(invocation.argv).not.toContain('--last');
    expect(invocation.argv).toEqual(
      expect.arrayContaining([
        '--json',
        '--output-schema',
        'schema.json',
        '-c',
        'sandbox_mode="read-only"',
        '-c',
        'approval_policy="never"',
      ]),
    );
    expect(invocation.stdin).toBe('Sensitive prompt text.');
  });

  it('resumes an exact Claude session without latest, fork, or ephemeral flags', () => {
    const invocation = buildInvocation(
      'claude',
      'provider_validated',
      {
        model: 'claude-fable-5-1',
        runtime_policy: { permission_mode: 'read-only' },
      },
      { resumeSessionId: SESSION_ID },
    );

    expect(argumentAfter(invocation.argv, '--resume')).toBe(SESSION_ID);
    expect(invocation.argv).toEqual(
      expect.arrayContaining([
        '--json-schema',
        '--model',
        'claude-fable-5-1',
        '--permission-mode',
        'plan',
      ]),
    );
    for (const flag of [
      '--continue',
      '-c',
      '--fork-session',
      '--no-session-persistence',
    ]) {
      expect(invocation.argv).not.toContain(flag);
    }
    expect(invocation.stdin).toBe('Sensitive prompt text.');
  });

  it('refuses to build an unverified Cursor resume', () => {
    expect(() =>
      buildInvocation(
        'cursor',
        'prompt_only',
        {},
        { resumeSessionId: SESSION_ID },
      ),
    ).toThrow(/not verified/);
  });

  it('runs read-only Cursor with trust, ask mode, and sandbox instead of force', () => {
    const invocation = buildInvocation('cursor', 'prompt_only', {
      runtime_policy: { permission_mode: 'read-only' },
    });

    // Live check 2026-09-29 (cursor-agent 2026.09.28): print mode refuses an
    // untrusted workspace without `--trust` or `--force`; ask mode ran `ls`
    // but refused a file write.
    expect(invocation.argv).toEqual([
      '--print',
      '--output-format',
      'json',
      '--trust',
      '--mode',
      'ask',
      '--sandbox',
      'enabled',
    ]);
  });

  it('keeps host-native dispatch unsupported for every first-scope invocation', () => {
    expect(
      providerRegistry()
        .list()
        .map((adapter) => adapter.capabilities.supports_host_native_dispatch),
    ).toEqual([false, false, false]);
  });
});

function buildInvocation(
  id: 'claude' | 'codex' | 'cursor',
  strategy: StructuredOutputStrategy,
  overrides: Partial<ConsensusCliRunRequest> = {},
  builderOptions: { resumeSessionId?: string; lastMessageFile?: string } = {},
): ProviderInvocation {
  const adapter = providerRegistry().get(id);
  if (!adapter) throw new Error(`Missing adapter fixture: ${id}`);

  return buildProviderInvocation(
    adapter,
    {
      schema_version: 'v1',
      provider: id,
      schema_path: 'schema.json',
      prompt: 'Sensitive prompt text.',
      ...overrides,
    },
    {
      strategy,
      inlineJsonSchema:
        id === 'claude' && strategy === 'provider_validated'
          ? schemaJson()
          : undefined,
      ...builderOptions,
    },
  );
}

const SESSION_ID = '0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41';

function argumentAfter(argv: string[], flag: string): string {
  const index = argv.indexOf(flag);
  if (index === -1 || argv[index + 1] === undefined) {
    throw new Error(`Missing argument after ${flag}`);
  }
  return argv[index + 1];
}

function schemaJson() {
  return JSON.stringify(schema());
}

function schema() {
  return {
    type: 'object',
    required: ['verdict'],
    properties: {
      verdict: { type: 'string' },
    },
  };
}
