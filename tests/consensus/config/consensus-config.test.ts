import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  clearConsensusConfig,
  parseConsensusDefaultsConfig,
  readConsensusConfig,
  resolveConsensusComposition,
  writeConsensusConfig,
} from '../../../src/consensus/config/consensus-config.js';
import type { ProviderInventoryEntry } from '../../../src/consensus/provider-cli/types.js';

describe('consensus config schema and resolver', () => {
  it('parses valid default config and rejects invalid values', () => {
    expect(
      parseConsensusDefaultsConfig({
        schema_version: 'v1',
        peers: [
          { provider: 'claude', model: 'sonnet', effort: 'high' },
          { provider: 'codex', model: 'gpt-5', effort: 'xhigh' },
        ],
        panelists: [
          { provider: 'claude' },
          { provider: 'codex' },
          { provider: 'cursor' },
        ],
        panel_size: 2,
        roles: {
          advisor: [{ provider: 'cursor' }],
        },
      }),
    ).toEqual({
      schema_version: 'v1',
      peers: [
        { provider: 'claude', model: 'sonnet', effort: 'high' },
        { provider: 'codex', model: 'gpt-5', effort: 'xhigh' },
      ],
      panelists: [
        { provider: 'claude' },
        { provider: 'codex' },
        { provider: 'cursor' },
      ],
      panel_size: 2,
      roles: {
        advisor: [{ provider: 'cursor' }],
      },
    });

    expect(() => parseConsensusDefaultsConfig(null)).toThrow(
      'Consensus config must be an object',
    );
    expect(() =>
      parseConsensusDefaultsConfig({ schema_version: 'v2' }),
    ).toThrow('Consensus config schema_version must be "v1"');
    expect(() =>
      parseConsensusDefaultsConfig({ peers: [{ provider: 'claude' }] }),
    ).toThrow('Consensus config peers must contain exactly two agents');
    expect(() =>
      parseConsensusDefaultsConfig({
        panelists: [{ provider: 'claude' }],
      }),
    ).toThrow('Consensus config panelists must contain at least two agents');
    expect(() =>
      parseConsensusDefaultsConfig({ panel_size: 1 }),
    ).toThrow('Consensus config panel_size must be an integer greater than 1');
  });

  it('resolves built-in, user, and project config in precedence order', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await expect(
        resolveConsensusComposition({
          workflow: 'convergence',
          cwd,
          env,
          inventory: inventory(['claude', 'codex', 'cursor']),
        }),
      ).resolves.toMatchObject({
        source: 'built-in',
        agents: [{ provider: 'claude' }, { provider: 'codex' }],
      });

      await writeConsensusConfig({
        scope: 'user',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'codex' }, { provider: 'cursor' }],
        },
      });

      await expect(
        resolveConsensusComposition({
          workflow: 'convergence',
          cwd,
          env,
          inventory: inventory(['claude', 'codex', 'cursor']),
        }),
      ).resolves.toMatchObject({
        source: 'user',
        agents: [{ provider: 'codex' }, { provider: 'cursor' }],
      });

      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'cursor' }, { provider: 'claude' }],
        },
      });

      await expect(
        resolveConsensusComposition({
          workflow: 'convergence',
          cwd,
          env,
          inventory: inventory(['claude', 'codex', 'cursor']),
        }),
      ).resolves.toMatchObject({
        source: 'project',
        agents: [{ provider: 'cursor' }, { provider: 'claude' }],
      });
    });
  });

  it('lets explicit invocation composition override persisted defaults', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'user',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'claude' }, { provider: 'codex' }],
        },
      });
      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'codex' }, { provider: 'cursor' }],
        },
      });

      await expect(
        resolveConsensusComposition({
          workflow: 'convergence',
          cwd,
          env,
          inventory: inventory(['claude', 'codex', 'cursor']),
          invocation: {
            peers: [{ provider: 'cursor' }, { provider: 'claude' }],
          },
        }),
      ).resolves.toMatchObject({
        source: 'invocation',
        agents: [{ provider: 'cursor' }, { provider: 'claude' }],
      });
    });
  });

  it('returns exactly two agents for convergence workflows', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          panelists: [
            { provider: 'claude' },
            { provider: 'codex' },
            { provider: 'cursor' },
          ],
          panel_size: 3,
        },
      });

      const result = await resolveConsensusComposition({
        workflow: 'convergence',
        cwd,
        env,
        inventory: inventory(['claude', 'codex', 'cursor']),
      });

      expect(result.agents).toEqual([
        { provider: 'claude' },
        { provider: 'codex' },
      ]);
    });
  });

  it('returns at least two agents for panel workflows', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'user',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          panelists: [{ provider: 'claude' }, { provider: 'codex' }],
        },
      });

      const result = await resolveConsensusComposition({
        workflow: 'panel',
        cwd,
        env,
        inventory: inventory(['claude', 'codex']),
      });

      expect(result.source).toBe('user');
      expect(result.agents).toEqual([
        { provider: 'claude' },
        { provider: 'codex' },
      ]);
      expect(result.agents).toHaveLength(2);
    });
  });

  it('uses deterministic first-N selection for panel_size', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          panelists: [
            { provider: 'claude' },
            { provider: 'codex' },
            { provider: 'cursor' },
          ],
          panel_size: 2,
        },
      });

      await expect(
        resolveConsensusComposition({
          workflow: 'panel',
          cwd,
          env,
          inventory: inventory(['cursor', 'codex', 'claude']),
        }),
      ).resolves.toMatchObject({
        source: 'project',
        agents: [{ provider: 'claude' }, { provider: 'codex' }],
      });
    });
  });

  it('expands panel_size shortfalls from ready inventory order', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          panelists: [{ provider: 'cursor' }, { provider: 'claude' }],
          panel_size: 4,
        },
      });

      await expect(
        resolveConsensusComposition({
          workflow: 'panel',
          cwd,
          env,
          inventory: inventory(['claude', 'codex', 'cursor', 'gemini']),
        }),
      ).resolves.toMatchObject({
        source: 'project',
        agents: [
          { provider: 'cursor' },
          { provider: 'claude' },
          { provider: 'codex' },
          { provider: 'gemini' },
        ],
      });
    });
  });

  it('accepts reserved advisor roles without returning them from v1 resolver workflows', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          roles: {
            advisor: [{ provider: 'cursor' }],
          },
        },
      });

      const stored = await readConsensusConfig({ scope: 'project', cwd, env });
      expect(stored).toMatchObject({
        roles: {
          advisor: [{ provider: 'cursor' }],
        },
      });

      const panel = await resolveConsensusComposition({
        workflow: 'panel',
        cwd,
        env,
        inventory: inventory(['claude', 'codex', 'cursor']),
      });
      const convergence = await resolveConsensusComposition({
        workflow: 'convergence',
        cwd,
        env,
        inventory: inventory(['claude', 'codex', 'cursor']),
      });

      expect(panel.agents).toEqual([
        { provider: 'claude' },
        { provider: 'codex' },
      ]);
      expect(convergence.agents).toEqual([
        { provider: 'claude' },
        { provider: 'codex' },
      ]);
    });
  });

  it('clears scoped config keys and all config', async () => {
    await withTempConfig(async ({ cwd, env }) => {
      await writeConsensusConfig({
        scope: 'project',
        cwd,
        env,
        config: {
          schema_version: 'v1',
          peers: [{ provider: 'claude' }, { provider: 'codex' }],
          panelists: [{ provider: 'claude' }, { provider: 'codex' }],
          panel_size: 2,
          roles: {
            advisor: [{ provider: 'cursor' }],
          },
        },
      });

      await clearConsensusConfig({
        scope: 'project',
        cwd,
        env,
        key: 'panel-size',
      });
      expect(await readConsensusConfig({ scope: 'project', cwd, env })).toEqual({
        schema_version: 'v1',
        peers: [{ provider: 'claude' }, { provider: 'codex' }],
        panelists: [{ provider: 'claude' }, { provider: 'codex' }],
        roles: {
          advisor: [{ provider: 'cursor' }],
        },
      });

      await clearConsensusConfig({
        scope: 'project',
        cwd,
        env,
        key: 'all',
      });
      await expect(
        readFile(path.join(cwd, '.consensus', 'config.json'), 'utf8'),
      ).rejects.toThrow();
      expect(await readConsensusConfig({ scope: 'project', cwd, env })).toBeNull();
    });
  });
});

async function withTempConfig(
  fn: (context: {
    cwd: string;
    env: Record<string, string | undefined>;
  }) => Promise<void>,
) {
  const root = await mkdtemp(path.join(tmpdir(), 'consensus-config-'));
  try {
    const cwd = path.join(root, 'project');
    const home = path.join(root, 'home');
    const xdg = path.join(root, 'xdg');
    await mkdir(cwd, { recursive: true });
    await mkdir(home, { recursive: true });
    await fn({
      cwd,
      env: {
        HOME: home,
        XDG_CONFIG_HOME: xdg,
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
