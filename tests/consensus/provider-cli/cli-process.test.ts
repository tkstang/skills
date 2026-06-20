import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

  it('probes generated provider inventory and preflight with the default Node runner', async () => {
    const binDir = await mkdtemp(path.join(os.tmpdir(), 'consensus-bin-'));
    const codexPath = await writeExecutableFixture(
      binDir,
      'codex',
      '#!/bin/sh\nprintf "codex 9.9.9\\n"\n',
    );
    const env = { ...process.env, PATH: binDir };

    try {
      const inventoryResult = await runConsensusCli(
        ['provider', 'ls', '--json'],
        { env },
      );

      expect(inventoryResult.code).toBe(0);
      expect(parseSingleJsonDocument(inventoryResult.stdout)).toMatchObject({
        ok: true,
        providers: [
          { id: 'claude', status: 'missing' },
          {
            id: 'codex',
            status: 'ready',
            executable: codexPath,
            version: 'codex 9.9.9',
          },
          { id: 'cursor', status: 'missing' },
        ],
      });

      const codexPreflightResult = await runConsensusCli(
        ['preflight', '--json', '--provider', 'codex'],
        { env },
      );

      expect(codexPreflightResult.code).toBe(0);
      expect(parseSingleJsonDocument(codexPreflightResult.stdout)).toMatchObject(
        {
          ok: true,
          usable: true,
          providers: [{ id: 'codex', status: 'ready' }],
        },
      );

      const cursorPreflightResult = await runConsensusCli(
        ['preflight', '--json', '--provider', 'cursor'],
        { env },
      );

      expect(cursorPreflightResult.code).toBe(0);
      expect(parseSingleJsonDocument(cursorPreflightResult.stdout)).toMatchObject(
        {
          ok: true,
          usable: false,
          providers: [{ id: 'cursor', status: 'missing' }],
        },
      );
    } finally {
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('runs generated Claude and Codex argv against strict provider flag fixtures', async () => {
    const binDir = await mkdtemp(path.join(os.tmpdir(), 'consensus-bin-'));
    const schemaPath = await writeSchemaFixture();
    const env = { ...process.env, PATH: binDir };

    await writeExecutableFixture(binDir, 'claude', strictClaudeFixture());
    await writeExecutableFixture(binDir, 'codex', strictCodexFixture());

    try {
      const claudeResult = await runConsensusCli(
        [
          'run',
          '--provider',
          'claude',
          '--schema',
          schemaPath,
          '--json',
          '--prompt',
          'Return JSON.',
        ],
        { env },
      );

      expect(claudeResult.code).toBe(0);
      const claudeEnvelope = parseSingleJsonDocument(claudeResult.stdout);
      expect(claudeEnvelope).toMatchObject({
        ok: true,
        provider: 'claude',
        json: { verdict: 'accept' },
        diagnostics: {
          redacted_command: expect.arrayContaining([
            '--json-schema',
            '<inline-json-schema>',
          ]),
        },
      });
      expect(JSON.stringify(claudeEnvelope)).not.toContain('"properties"');

      const codexResult = await runConsensusCli(
        [
          'run',
          '--provider',
          'codex',
          '--schema',
          schemaPath,
          '--json',
          '--prompt',
          'Return JSON.',
        ],
        { env },
      );

      expect(codexResult.code).toBe(0);
      expect(parseSingleJsonDocument(codexResult.stdout)).toMatchObject({
        ok: true,
        provider: 'codex',
        json: { verdict: 'accept' },
      });
    } finally {
      await rm(binDir, { recursive: true, force: true });
      await rm(path.dirname(schemaPath), { recursive: true, force: true });
    }
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
    const result = await runConsensusCli(
      ['preflight', '--json', '--provider', 'cursor'],
      { env: { PATH: '' } },
    );

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

  it('rejects malformed optional request JSON fields', async () => {
    const result = await runConsensusCli(
      ['run', '--request-json', '-', '--json'],
      {
        input: JSON.stringify({
          schema_version: 'v1',
          provider: 'claude',
          schema_path: 'schema.json',
          prompt: 'Prompt from stdin.',
          runtime_policy: {
            env_allowlist: 'ANTHROPIC_API_KEY',
          },
        }),
      },
    );

    expect(result.code).toBe(2);
    expect(parseSingleJsonDocument(result.stdout)).toMatchObject({
      ok: false,
      code: 'CONSENSUS_CLI_USAGE',
      message: expect.stringContaining(
        'Request JSON runtime_policy.env_allowlist must be a string array',
      ),
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

async function writeExecutableFixture(
  dir: string,
  name: string,
  contents: string,
) {
  const executablePath = path.join(dir, name);
  await writeFile(executablePath, contents);
  await chmod(executablePath, 0o755);
  return executablePath;
}

function strictClaudeFixture() {
  return `#!/bin/sh
seen_schema=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --print)
      shift
      ;;
    --output-format|--model|--effort)
      shift 2
      ;;
    --json-schema)
      case "$2" in
        /*|*.json|*schema.json)
          printf 'schema path passed to --json-schema: %s\\n' "$2" >&2
          exit 64
          ;;
        '{'*'}')
          ;;
        *)
          printf 'schema argument is not inline JSON: %s\\n' "$2" >&2
          exit 64
          ;;
      esac
      case "$2" in
        *'"verdict"'*)
          seen_schema=1
          ;;
        *)
          printf 'schema argument missing verdict property\\n' >&2
          exit 64
          ;;
      esac
      shift 2
      ;;
    --permission-mode)
      case "$2" in
        acceptEdits|auto|bypassPermissions|default|dontAsk|plan)
          shift 2
          ;;
        *)
          printf 'invalid permission mode: %s\\n' "$2" >&2
          exit 64
          ;;
      esac
      ;;
    *)
      printf 'unknown option: %s\\n' "$1" >&2
      exit 64
      ;;
  esac
done
if [ "$seen_schema" != "1" ]; then
  printf 'missing --json-schema\\n' >&2
  exit 64
fi
printf '{"verdict":"accept"}\\n'
`;
}

function strictCodexFixture() {
  return `#!/bin/sh
if [ "$1" != "exec" ]; then
  printf 'expected exec subcommand\\n' >&2
  exit 64
fi
shift
output_file=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --json)
      shift
      ;;
    --output-schema|--model|-m|--sandbox|-s|-c|--config)
      shift 2
      ;;
    -o|--output-last-message)
      output_file="$2"
      shift 2
      ;;
    *)
      printf 'unknown option: %s\\n' "$1" >&2
      exit 64
      ;;
  esac
done
if [ -n "$output_file" ]; then
  printf '{"verdict":"accept"}\\n' > "$output_file"
  printf '{"type":"session.started"}\\n{"type":"turn.completed"}\\n'
else
  printf '{"verdict":"accept"}\\n'
fi
`;
}
