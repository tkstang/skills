import { describe, expect, it } from 'vitest';

import {
  ConsensusCliUsageError,
  normalizeRunRequest,
  parseConsensusCliArgs,
} from '../../../src/consensus/provider-cli/args.js';

describe('provider CLI argument parsing', () => {
  it('parses provider inventory commands', () => {
    expect(parseConsensusCliArgs(['provider', 'ls', '--json'])).toEqual({
      kind: 'provider-list',
      json: true,
    });
  });

  it('parses preflight commands with optional provider and max depth', () => {
    expect(
      parseConsensusCliArgs([
        'preflight',
        '--json',
        '--provider',
        'codex',
        '--max-depth',
        '2',
      ]),
    ).toEqual({
      kind: 'preflight',
      json: true,
      provider: 'codex',
      maxDepth: 2,
    });
  });

  it('parses run commands with stdin prompt markers', () => {
    expect(
      parseConsensusCliArgs([
        'run',
        '--provider',
        'claude',
        '--schema',
        'schema.json',
        '--json',
        '-',
      ]),
    ).toEqual({
      kind: 'run',
      json: true,
      provider: 'claude',
      schemaPath: 'schema.json',
      promptSource: { kind: 'stdin' },
    });
  });

  it('normalizes short prompts', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--provider',
      'cursor',
      '--schema',
      'schema.json',
      '--json',
      '--prompt',
      'Return JSON.',
    ]);

    await expect(normalizeRunRequest(command, testIo())).resolves.toMatchObject(
      {
        schema_version: 'v1',
        provider: 'cursor',
        schema_path: 'schema.json',
        prompt: 'Return JSON.',
      },
    );
  });

  it('normalizes runtime policy and host max-depth flags', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--provider',
      'codex',
      '--schema',
      'schema.json',
      '--json',
      '--prompt',
      'Return JSON.',
      '--permission-mode',
      'read-only',
      '--sandbox',
      'workspace-write',
      '--approval-policy',
      'never',
      '--env-allow',
      'OPENAI_API_KEY',
      '--env-allow',
      'ANTHROPIC_API_KEY',
      '--max-depth',
      '2',
    ]);

    const request = await normalizeRunRequest(
      command,
      testIo({
        env: {
          CONSENSUS_PARENT_HOST: 'codex',
          CONSENSUS_RUN_ID: 'run-123',
          CONSENSUS_DEPTH: '1',
        },
      }),
    );

    expect(request).toMatchObject({
      runtime_policy: {
        permission_mode: 'read-only',
        sandbox: 'workspace-write',
        approval_policy: 'never',
        env_allowlist: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
      },
      host: {
        runtime: 'codex',
        cwd: '/workspace',
        run_id: 'run-123',
        depth: 1,
        max_depth: 2,
      },
    });
  });

  it('normalizes run host context from native runtime markers', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--provider',
      'codex',
      '--schema',
      'schema.json',
      '--json',
      '--prompt',
      'Return JSON.',
      '--max-depth',
      '1',
    ]);

    const request = await normalizeRunRequest(
      command,
      testIo({
        env: {
          CODEX_SESSION_ID: 'session',
          CONSENSUS_DEPTH: '1',
        },
      }),
    );

    expect(request.host).toMatchObject({
      runtime: 'codex',
      depth: 1,
      max_depth: 1,
    });
  });

  it('adds default host guard context for request JSON when native markers are present', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--request-json',
      '-',
      '--json',
    ]);

    const request = await normalizeRunRequest(
      command,
      testIo({
        stdin: JSON.stringify({
          schema_version: 'v1',
          provider: 'codex',
          schema_path: 'schema.json',
          prompt: 'Prompt from stdin.',
        }),
        env: {
          CODEX_SESSION_ID: 'session',
        },
      }),
    );

    expect(request.host).toMatchObject({
      runtime: 'codex',
      depth: 0,
      max_depth: 1,
    });
  });

  it('normalizes prompt files', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--provider',
      'codex',
      '--schema',
      'schema.json',
      '--json',
      '--prompt-file',
      'prompt.md',
    ]);

    const request = await normalizeRunRequest(
      command,
      testIo({ files: { 'prompt.md': 'Prompt from file.' } }),
    );

    expect(request.prompt).toBe('Prompt from file.');
  });

  it('normalizes full request JSON from a file', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--request-json',
      'request.json',
      '--json',
    ]);

    const request = await normalizeRunRequest(
      command,
      testIo({
        files: {
          'request.json': JSON.stringify({
            schema_version: 'v1',
            provider: 'claude',
            schema_path: 'schema.json',
            prompt: 'Prompt from request.',
            max_attempts: 2,
          }),
        },
      }),
    );

    expect(request).toEqual({
      schema_version: 'v1',
      provider: 'claude',
      schema_path: 'schema.json',
      prompt: 'Prompt from request.',
      max_attempts: 2,
    });
  });

  it('normalizes full request JSON from stdin', async () => {
    const command = parseConsensusCliArgs([
      'run',
      '--request-json',
      '-',
      '--json',
    ]);

    const request = await normalizeRunRequest(
      command,
      testIo({
        stdin: JSON.stringify({
          schema_version: 'v1',
          provider: 'codex',
          schema_path: 'schema.json',
          prompt: 'Prompt from stdin.',
        }),
      }),
    );

    expect(request.prompt).toBe('Prompt from stdin.');
  });

  it('normalizes valid optional request JSON fields', async () => {
    await expect(
      normalizeRequestJson({
        cwd: '/workspace/project',
        model: 'gpt-5.1-codex',
        effort: 'xhigh',
        runtime_policy: {
          permission_mode: 'non-interactive',
          sandbox: 'workspace-write',
          approval_policy: 'never',
          env_allowlist: ['OPENAI_API_KEY'],
        },
        host: {
          runtime: 'codex',
          cwd: '/workspace/project',
          run_id: 'run-123',
          depth: 0,
          max_depth: 1,
        },
        max_attempts: 2,
        max_runtime_sec: 30,
        max_output_bytes: 4096,
        redaction: {
          include_args: true,
          include_stderr: false,
        },
      }),
    ).resolves.toMatchObject({
      cwd: '/workspace/project',
      model: 'gpt-5.1-codex',
      effort: 'xhigh',
      runtime_policy: {
        env_allowlist: ['OPENAI_API_KEY'],
      },
      host: {
        runtime: 'codex',
        max_depth: 1,
      },
      max_attempts: 2,
      max_runtime_sec: 30,
      max_output_bytes: 4096,
      redaction: {
        include_args: true,
        include_stderr: false,
      },
    });
  });

  it.each([
    [{ model: 123 }, 'Request JSON model must be a string'],
    [
      { max_attempts: 0 },
      'Request JSON max_attempts must be a positive integer',
    ],
    [
      { max_runtime_sec: '30' },
      'Request JSON max_runtime_sec must be a positive integer',
    ],
    [
      { max_output_bytes: 1.5 },
      'Request JSON max_output_bytes must be a positive integer',
    ],
    [
      { runtime_policy: [] },
      'Request JSON runtime_policy must be an object',
    ],
    [
      { runtime_policy: { sandbox: false } },
      'Request JSON runtime_policy.sandbox must be a string',
    ],
    [
      { runtime_policy: { env_allowlist: 'OPENAI_API_KEY' } },
      'Request JSON runtime_policy.env_allowlist must be a string array',
    ],
    [
      { runtime_policy: { env_allowlist: ['OPENAI_API_KEY', 42] } },
      'Request JSON runtime_policy.env_allowlist must be a string array',
    ],
    [{ host: [] }, 'Request JSON host must be an object'],
    [
      {
        host: {
          runtime: 'codex',
          cwd: '/workspace',
          run_id: 'run-123',
          depth: 0,
          max_depth: 0,
        },
      },
      'Request JSON host.max_depth must be a positive integer',
    ],
    [
      {
        host: {
          runtime: 'codex',
          cwd: '/workspace',
          run_id: 'run-123',
          depth: -1,
          max_depth: 1,
        },
      },
      'Request JSON host.depth must be a non-negative integer',
    ],
    [
      { redaction: { include_args: 'yes' } },
      'Request JSON redaction.include_args must be a boolean',
    ],
  ])(
    'rejects invalid optional request JSON value %#',
    async (overrides, error) => {
      await expect(normalizeRequestJson(overrides)).rejects.toThrow(error);
    },
  );

  it('rejects request JSON mixed with request-shaping flags', () => {
    expect(() =>
      parseConsensusCliArgs([
        'run',
        '--request-json',
        'request.json',
        '--permission-mode',
        'read-only',
        '--json',
      ]),
    ).toThrow(/--permission-mode/);
  });

  it.each([
    ['--max-attempts', '0'],
    ['--timeout-sec', '-1'],
    ['--max-output-bytes', '1.5'],
    ['--max-depth', 'many'],
  ])('rejects invalid positive integers for %s', (flag, value) => {
    const argv = [
      'run',
      '--provider',
      'claude',
      '--schema',
      'schema.json',
      '--json',
      '--prompt',
      'prompt',
      flag,
      value,
    ];

    expect(() => parseConsensusCliArgs(argv)).toThrow(
      `${flag} must be a positive integer`,
    );
  });
});

function normalizeRequestJson(overrides: Record<string, unknown>) {
  const command = parseConsensusCliArgs([
    'run',
    '--request-json',
    '-',
    '--json',
  ]);

  return normalizeRunRequest(
    command,
    testIo({
      stdin: JSON.stringify({
        schema_version: 'v1',
        provider: 'codex',
        schema_path: 'schema.json',
        prompt: 'Prompt from request.',
        ...overrides,
      }),
    }),
  );
}

function testIo(options?: {
  files?: Record<string, string>;
  stdin?: string;
  env?: Record<string, string | undefined>;
}) {
  return {
    cwd: '/workspace',
    env: options?.env,
    async readFile(filePath: string) {
      const contents = options?.files?.[filePath];
      if (contents === undefined) {
        throw new Error(`Unexpected file read: ${filePath}`);
      }
      return contents;
    },
    async readStdin() {
      return options?.stdin ?? '';
    },
  };
}
