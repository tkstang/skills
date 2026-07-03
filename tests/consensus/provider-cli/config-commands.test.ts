import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeConsensusConfig } from '../../../src/consensus/config/consensus-config.js';
import { runConsensusCli } from '../../../src/consensus/provider-cli/commands.js';
import type { ProviderInventoryEntry } from '../../../src/consensus/provider-cli/types.js';
import { captureWriter } from '../../helpers/process.mjs';

describe('provider CLI consensus config commands', () => {
  it('gets user, project, and effective config as JSON', async () => {
    await withTempCli(async (context) => {
      await writeConsensusConfig({
        scope: 'user',
        cwd: context.cwd,
        env: context.env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'claude' }, { provider: 'codex' }],
        },
      });
      await writeConsensusConfig({
        scope: 'project',
        cwd: context.cwd,
        env: context.env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'codex' }, { provider: 'cursor' }],
          panelists: [
            { provider: 'claude' },
            { provider: 'codex' },
            { provider: 'cursor' },
          ],
        },
      });

      await expect(
        runCli(context, ['config', 'get', '--json', '--scope', 'user']),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          schema_version: 'v1',
          ok: true,
          scope: 'user',
          config: {
            schema_version: 'v1',
            peers: [{ provider: 'claude' }, { provider: 'codex' }],
          },
        },
      });

      await expect(
        runCli(context, ['config', 'get', '--json', '--scope', 'project']),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'project',
          config: {
            peers: [{ provider: 'codex' }, { provider: 'cursor' }],
          },
        },
      });

      await expect(
        runCli(context, [
          'config',
          'get',
          '--json',
          '--scope',
          'effective',
          '--workflow',
          'convergence',
        ]),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'effective',
          source: 'project',
          workflow: 'convergence',
          agents: [{ provider: 'codex' }, { provider: 'cursor' }],
          config: {
            peers: [{ provider: 'codex' }, { provider: 'cursor' }],
            panelists: [
              { provider: 'claude' },
              { provider: 'codex' },
              { provider: 'cursor' },
            ],
          },
          diagnostics: {
            warnings: [],
          },
        },
      });
    });
  });

  it('lists config scopes, keys, and workflows without mutating config', async () => {
    await withTempCli(async (context) => {
      await expect(
        runCli(context, ['config', 'list', '--json']),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          schema_version: 'v1',
          ok: true,
          scopes: ['user', 'project', 'effective'],
          writable_scopes: ['user', 'project'],
          keys: ['peers', 'panelists', 'panel-size', 'roles', 'all'],
          workflows: ['convergence', 'panel'],
        },
      });

      await expect(
        readFile(path.join(context.cwd, '.consensus', 'config.json'), 'utf8'),
      ).rejects.toThrow();
      await expect(
        readFile(
          path.join(context.xdg, 'consensus', 'config.json'),
          'utf8',
        ),
      ).rejects.toThrow();
    });
  });

  it('sets user peers and project panel defaults with temp HOME/XDG/cwd isolation', async () => {
    await withTempCli(async (context) => {
      await expect(
        runCli(context, [
          'config',
          'set',
          '--json',
          '--scope',
          'user',
          '--peers',
          'claude,codex',
        ]),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'user',
          config: {
            schema_version: 'v1',
            peers: [{ provider: 'claude' }, { provider: 'codex' }],
          },
        },
      });

      await expect(
        runCli(context, [
          'config',
          'set',
          '--json',
          '--scope',
          'project',
          '--panelists',
          'claude,codex,cursor',
          '--panel-size',
          '3',
        ]),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'project',
          config: {
            panelists: [
              { provider: 'claude' },
              { provider: 'codex' },
              { provider: 'cursor' },
            ],
            panel_size: 3,
          },
        },
      });

      await expect(
        JSON.parse(
          await readFile(
            path.join(context.xdg, 'consensus', 'config.json'),
            'utf8',
          ),
        ),
      ).toMatchObject({
        peers: [{ provider: 'claude' }, { provider: 'codex' }],
      });
      await expect(
        JSON.parse(
          await readFile(
            path.join(context.cwd, '.consensus', 'config.json'),
            'utf8',
          ),
        ),
      ).toMatchObject({
        panelists: [
          { provider: 'claude' },
          { provider: 'codex' },
          { provider: 'cursor' },
        ],
        panel_size: 3,
      });
    });
  });

  it('sets config from a JSON file', async () => {
    await withTempCli(async (context) => {
      const filePath = path.join(context.root, 'consensus-config.json');
      await writeFile(
        filePath,
        JSON.stringify({
          schema_version: 'v1',
          peers: [{ provider: 'codex' }, { provider: 'claude' }],
          roles: {
            advisor: [{ provider: 'cursor' }],
          },
        }),
      );

      await expect(
        runCli(context, [
          'config',
          'set',
          '--json',
          '--scope',
          'project',
          '--from-file',
          filePath,
        ]),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'project',
          config: {
            peers: [{ provider: 'codex' }, { provider: 'claude' }],
            roles: {
              advisor: [{ provider: 'cursor' }],
            },
          },
        },
      });
    });
  });

  it('clears scoped config keys and all config', async () => {
    await withTempCli(async (context) => {
      await runCli(context, [
        'config',
        'set',
        '--json',
        '--scope',
        'project',
        '--panelists',
        'claude,codex,cursor',
        '--panel-size',
        '3',
      ]);

      await expect(
        runCli(context, [
          'config',
          'clear',
          '--json',
          '--scope',
          'project',
          '--key',
          'panel-size',
        ]),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'project',
          key: 'panel-size',
          config: {
            schema_version: 'v1',
            panelists: [
              { provider: 'claude' },
              { provider: 'codex' },
              { provider: 'cursor' },
            ],
          },
        },
      });

      await expect(
        runCli(context, [
          'config',
          'clear',
          '--json',
          '--scope',
          'project',
          '--key',
          'all',
        ]),
      ).resolves.toMatchObject({
        code: 0,
        json: {
          ok: true,
          scope: 'project',
          key: 'all',
          config: null,
        },
      });
    });
  });

  it.each([
    [
      ['config', 'get', '--scope', 'user'],
      'Missing required --json flag',
    ],
    [
      ['config', 'get', '--json', '--scope', 'machine'],
      'Invalid config scope: machine',
    ],
    [
      [
        'config',
        'clear',
        '--json',
        '--scope',
        'project',
        '--key',
        'unknown',
      ],
      'Invalid config key: unknown',
    ],
    [
      [
        'config',
        'get',
        '--json',
        '--scope',
        'effective',
        '--workflow',
        'brainstorm',
      ],
      'Unsupported config workflow: brainstorm',
    ],
  ])('returns usage envelopes for invalid config command %#', async (argv, message) => {
    await withTempCli(async (context) => {
      await expect(runCli(context, argv)).resolves.toMatchObject({
        code: 2,
        json: {
          ok: false,
          code: 'CONSENSUS_CLI_USAGE',
          message,
        },
      });
    });
  });

  it('returns usage envelopes for malformed config files', async () => {
    await withTempCli(async (context) => {
      const filePath = path.join(context.root, 'bad-config.json');
      await writeFile(
        filePath,
        JSON.stringify({
          schema_version: 'v1',
          panelists: [{ provider: 'claude' }],
        }),
      );

      await expect(
        runCli(context, [
          'config',
          'set',
          '--json',
          '--scope',
          'project',
          '--from-file',
          filePath,
        ]),
      ).resolves.toMatchObject({
        code: 2,
        json: {
          ok: false,
          code: 'CONSENSUS_CLI_USAGE',
          message:
            'Malformed consensus config: Consensus config panelists must contain at least two agents',
        },
      });
    });
  });
});

async function withTempCli(
  fn: (context: {
    root: string;
    cwd: string;
    home: string;
    xdg: string;
    env: Record<string, string | undefined>;
  }) => Promise<void>,
) {
  const root = await mkdtemp(path.join(tmpdir(), 'consensus-cli-config-'));
  try {
    const cwd = path.join(root, 'project');
    const home = path.join(root, 'home');
    const xdg = path.join(root, 'xdg');
    await mkdir(cwd, { recursive: true });
    await mkdir(home, { recursive: true });
    await mkdir(xdg, { recursive: true });
    await fn({
      root,
      cwd,
      home,
      xdg,
      env: {
        HOME: home,
        XDG_CONFIG_HOME: xdg,
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runCli(
  context: {
    cwd: string;
    env: Record<string, string | undefined>;
  },
  argv: readonly string[],
) {
  const stdout = captureWriter();
  const stderr = captureWriter();
  const code = await runConsensusCli(
    argv,
    {
      stdout: stdout.stream,
      stderr: stderr.stream,
      stdin: process.stdin,
      cwd: context.cwd,
      env: context.env,
      readFile: (filePath) => readFile(filePath, 'utf8'),
      readStdin: async () => '',
    },
    {
      registry: inventory(['claude', 'codex', 'cursor']),
    },
  );

  expect(stderr.value()).toBe('');
  const lines = stdout.value().trim().split('\n');
  expect(lines).toHaveLength(1);
  return {
    code,
    json: JSON.parse(lines[0] ?? '{}') as unknown,
  };
}

function inventory(ids: string[]): ProviderInventoryEntry[] {
  return ids.map((id) => ({
    id,
    status: 'ready',
    capabilities: {
      schema_strategies: ['prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  }));
}
