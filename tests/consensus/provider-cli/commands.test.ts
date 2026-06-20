import { describe, expect, it } from 'vitest';

import {
  runConsensusCli,
  runPreflight,
  runProviderList,
} from '../../../src/consensus/provider-cli/commands.js';
import type { ProviderInventoryEntry } from '../../../src/consensus/provider-cli/types.js';
import { captureWriter } from '../../helpers/process.mjs';

describe('provider CLI command handlers', () => {
  it('returns provider inventory as a command envelope', async () => {
    await expect(
      runProviderList({ registry: providerEntries() }),
    ).resolves.toEqual({
      schema_version: 'v1',
      ok: true,
      providers: providerEntries(),
    });
  });

  it('keeps missing providers as entries instead of command failures', async () => {
    const envelope = await runProviderList({
      registry: [
        providerEntry('claude', 'ready'),
        providerEntry('codex', 'missing'),
      ],
    });

    expect(envelope.ok).toBe(true);
    expect(envelope.providers).toContainEqual(
      expect.objectContaining({
        id: 'codex',
        status: 'missing',
      }),
    );
  });

  it('reports usable preflight when selected providers are ready', async () => {
    await expect(
      runPreflight({ registry: providerEntries(['ready', 'ready']) }),
    ).resolves.toMatchObject({
      schema_version: 'v1',
      ok: true,
      usable: true,
      providers: [
        { id: 'claude', status: 'ready' },
        { id: 'codex', status: 'ready' },
      ],
    });
  });

  it('reports unusable provider-specific preflight for auth-required providers', async () => {
    await expect(
      runPreflight({
        provider: 'cursor',
        registry: [providerEntry('cursor', 'auth_required')],
      }),
    ).resolves.toMatchObject({
      ok: true,
      usable: false,
      providers: [{ id: 'cursor', status: 'auth_required' }],
    });
  });

  it('keeps envelope-level diagnostics command-level only', async () => {
    const envelope = await runPreflight({
      provider: 'missing-provider',
      registry: [],
    });

    expect(envelope).toEqual({
      schema_version: 'v1',
      ok: true,
      usable: false,
      providers: [
        expect.objectContaining({
          id: 'missing-provider',
          status: 'unsupported',
        }),
      ],
      diagnostics: {
        warnings: ['Requested provider is not registered: missing-provider'],
      },
    });
  });

  it('routes parsed commands and centralizes stdout writing', async () => {
    const stdout = captureWriter();
    const stderr = captureWriter();
    const code = await runConsensusCli(
      ['provider', 'ls', '--json'],
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        stdin: process.stdin,
        cwd: '/workspace',
        readFile: unexpectedRead,
        readStdin: unexpectedRead,
      },
      { registry: [providerEntry('claude', 'missing')] },
    );

    expect(code).toBe(0);
    expect(stderr.value()).toBe('');
    expect(JSON.parse(stdout.value())).toMatchObject({
      ok: true,
      providers: [{ id: 'claude', status: 'missing' }],
    });
  });
});

function providerEntries(
  statuses: Array<ProviderInventoryEntry['status']> = ['ready', 'ready'],
) {
  return [providerEntry('claude', statuses[0]), providerEntry('codex', statuses[1])];
}

function providerEntry(
  id: string,
  status: ProviderInventoryEntry['status'],
): ProviderInventoryEntry {
  return {
    id,
    status,
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
  };
}

async function unexpectedRead(): Promise<string> {
  throw new Error('Unexpected IO read');
}
