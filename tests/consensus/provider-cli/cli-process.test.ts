import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  repoRoot,
  runNodeScriptResult,
} from '../../helpers/process.mjs';

const consensusCli = path.join(
  repoRoot,
  'plugins/consensus/scripts/consensus.mjs',
);

describe('generated consensus provider CLI process contract', () => {
  it('writes a single parseable JSON document for provider inventory', async () => {
    const result = await runConsensusCli(['provider', 'ls', '--json']);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      schema_version: 'v1',
      ok: true,
      providers: [
        { id: 'claude' },
        { id: 'codex' },
        { id: 'cursor' },
      ],
    });
  });

  it('exits nonzero for bad flags', async () => {
    const result = await runConsensusCli(['provider', 'ls', '--bad-flag']);

    expect(result.code).not.toBe(0);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: false,
      code: 'CONSENSUS_CLI_USAGE',
      message: 'Unknown flag: --bad-flag',
    });
  });

  it('exits zero for structured provider absence', async () => {
    const result = await runConsensusCli([
      'preflight',
      '--json',
      '--provider',
      'cursor',
    ]);

    expect(result.code).toBe(0);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: true,
      usable: false,
      providers: [{ id: 'cursor', status: 'missing' }],
    });
  });

  it('consumes request JSON from stdin', async () => {
    const result = await runConsensusCli(
      ['run', '--request-json', '-', '--json'],
      {
        input: JSON.stringify({
          schema_version: 'v1',
          provider: 'claude',
          schema_path: 'schema.json',
          prompt: 'Prompt from stdin.',
        }),
      },
    );

    expect(result.code).toBe(2);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: false,
      code: 'CONSENSUS_CLI_USAGE',
      message: expect.stringContaining('Could not read schema'),
    });
  });

  it('accepts runtime-policy and max-depth flags for run commands', async () => {
    const result = await runConsensusCli([
      'run',
      '--provider',
      'codex',
      '--schema',
      'schema.json',
      '--json',
      '--prompt',
      'Prompt.',
      '--permission-mode',
      'read-only',
      '--sandbox',
      'workspace-write',
      '--approval-policy',
      'never',
      '--env-allow',
      'OPENAI_API_KEY',
      '--max-depth',
      '2',
    ]);

    expect(result.code).toBe(0);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      provider: 'codex',
      message: expect.stringContaining('runtime_policy.permission_mode'),
    });
  });

  it('uses native host markers for same-host run guard metadata', async () => {
    const schemaPath = await writeSchemaFixture();
    try {
      const result = await runConsensusCli(
        [
          'run',
          '--provider',
          'codex',
          '--schema',
          schemaPath,
          '--json',
          '--prompt',
          'Prompt.',
          '--max-depth',
          '1',
        ],
        {
          env: {
            PATH: '',
            CODEX_SESSION_ID: 'session',
          },
        },
      );

      expect(result.code).toBe(0);
      expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
        ok: false,
        code: 'PROVIDER_MISSING',
        provider: 'codex',
        diagnostics: {
          host_relation: 'same_host',
          guard: 'subprocess_isolated',
        },
      });
    } finally {
      await rm(path.dirname(schemaPath), { recursive: true, force: true });
    }
  });

  it('blocks depth-1 same-host run recursion from native host markers', async () => {
    const result = await runConsensusCli(
      [
        'run',
        '--provider',
        'codex',
        '--schema',
        'schema.json',
        '--json',
        '--prompt',
        'Prompt.',
        '--max-depth',
        '1',
      ],
      {
        env: {
          PATH: '',
          CODEX_SESSION_ID: 'session',
          CONSENSUS_DEPTH: '1',
        },
      },
    );

    expect(result.code).toBe(0);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: false,
      code: 'HOST_RECURSION_BLOCKED',
      provider: 'codex',
      diagnostics: {
        host_relation: 'same_host',
        guard: 'blocked',
      },
    });
  });

  it('documents runtime-policy and max-depth run flags in help text', async () => {
    const result = await runConsensusCli(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--permission-mode <mode>');
    expect(result.stdout).toContain('--sandbox <name>');
    expect(result.stdout).toContain('--approval-policy <policy>');
    expect(result.stdout).toContain('--env-allow <name>');
    expect(result.stdout).toContain('--max-depth <n>');
  });

  it('rejects request JSON mixed with conflicting flags', async () => {
    const result = await runConsensusCli(
      [
        'run',
        '--request-json',
        '-',
        '--max-depth',
        '2',
        '--json',
      ],
      {
        input: JSON.stringify({
          schema_version: 'v1',
          provider: 'claude',
          schema_path: 'schema.json',
          prompt: 'Prompt from stdin.',
        }),
      },
    );

    expect(result.code).toBe(2);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: false,
      code: 'CONSENSUS_CLI_USAGE',
      message: expect.stringContaining(
        '--request-json cannot be combined with request-shaping flags',
      ),
    });
  });
});

function runConsensusCli(
  args: string[],
  options: { input?: string; env?: Record<string, string | undefined> } = {},
) {
  return runNodeScriptResult(consensusCli, args, {
    cwd: repoRoot,
    input: options.input,
    env: options.env,
  });
}

function parseSingleJsonDocument(stdout: string) {
  const lines = stdout.trim().split('\n');
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]);
}

async function writeSchemaFixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'consensus-schema-'));
  const schemaPath = path.join(dir, 'schema.json');
  await writeFile(
    schemaPath,
    JSON.stringify({
      type: 'object',
      required: ['verdict'],
      properties: {
        verdict: { type: 'string' },
      },
    }),
  );
  return schemaPath;
}
