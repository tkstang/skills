import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../provider-cli/adapters.js';
import {
  buildProviderInvocation,
  type ProviderInvocation,
} from '../provider-cli/invocation.js';
import { defaultRuntimePolicy } from '../provider-cli/runtime-policy.js';
import type {
  ConsensusCliRunRequest,
  StructuredOutputStrategy,
} from '../provider-cli/types.js';

describe('provider invocation builders', () => {
  it.each(['codex', 'cursor'] as const)(
    'builds %s argv arrays without shell interpolation or prompt argv leakage',
    (id) => {
      const invocation = buildInvocation(id, 'prompt_only');

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

  it('passes Claude prompt as a redacted positional argument for print mode', () => {
    const invocation = buildInvocation('claude', 'provider_validated');

    expect(invocation.shell).toBe(false);
    expect(invocation.stdin).toBe('');
    expect(invocation.argv.at(-1)).toBe('Sensitive prompt text.');
    expect(invocation.redacted_command.at(-1)).toBe('<prompt>');
    expect(invocation.redacted_command.join(' ')).not.toContain(
      'Sensitive prompt text.',
    );
  });

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
      'Sensitive prompt text.',
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
      '<prompt>',
    ]);
    expect(JSON.stringify(invocation.redacted_command)).not.toContain(
      'properties',
    );
  });

  it('passes only explicit scoped Claude tool grants and redacts private paths', () => {
    const invocation = buildInvocation('claude', 'provider_validated', {
      runtime_policy: {
        permission_mode: 'non-interactive',
        read_paths: ['/private/vault/brief with spaces.md'],
        edit_paths: ['/private/scratch/result.md'],
        web_search: true,
        web_fetch_domains: ['example.org'],
      },
    });

    expect(invocation.argv).toEqual(
      expect.arrayContaining([
        'Read(//private/vault/brief with spaces.md)',
        'Edit(//private/scratch/result.md)',
        'WebFetch(domain:example.org)',
        'Read,Edit,Write,WebSearch,WebFetch',
        'dontAsk',
        '--strict-mcp-config',
      ]),
    );
    expect(invocation.argv.at(-1)).toBe('Sensitive prompt text.');
    expect(invocation.redacted_command.join(' ')).not.toContain('/private/');
    expect(invocation.argv).not.toContain('bypassPermissions');
  });

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
    expect(invocation.argv.at(-1)).toBe('Sensitive prompt text.');
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
  builderOptions: { resumeSessionId?: string } = {},
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
