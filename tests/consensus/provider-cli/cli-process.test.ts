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
      message: 'Command is not implemented yet: run',
    });
  });

  it('rejects request JSON mixed with conflicting flags', async () => {
    const result = await runConsensusCli(
      [
        'run',
        '--request-json',
        '-',
        '--provider',
        'claude',
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
  options: { input?: string } = {},
) {
  return runNodeScriptResult(consensusCli, args, {
    cwd: repoRoot,
    input: options.input,
  });
}

function parseSingleJsonDocument(stdout: string) {
  const lines = stdout.trim().split('\n');
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]);
}
