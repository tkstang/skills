import { describe, expect, it } from 'vitest';

import {
  probeProviderReadiness,
  probeProviderRegistry,
  type ProbeCommandRunner,
} from '../../../src/consensus/provider-cli/probe.js';
import { providerRegistry } from '../../../src/consensus/provider-cli/adapters.js';
import { runPreflight, runProviderList } from '../../../src/consensus/provider-cli/commands.js';

describe('provider readiness probes', () => {
  it('maps a missing executable to a missing provider entry', async () => {
    const entry = await probeProviderReadiness(adapter('claude'), {
      runner: fakeRunner({ executables: {} }),
    });

    expect(entry).toMatchObject({
      id: 'claude',
      status: 'missing',
      diagnostics: {
        warnings: [expect.stringContaining('PROVIDER_MISSING')],
      },
    });
  });

  it('maps successful version output to a ready provider entry', async () => {
    const entry = await probeProviderReadiness(adapter('codex'), {
      runner: fakeRunner({
        executables: { codex: '/usr/local/bin/codex' },
        results: {
          'codex --version': {
            code: 0,
            stdout: 'codex 1.2.3\n',
            stderr: '',
          },
        },
      }),
    });

    expect(entry).toMatchObject({
      id: 'codex',
      status: 'ready',
      executable: '/usr/local/bin/codex',
      version: 'codex 1.2.3',
    });
  });

  it('maps locked or auth-required probe output to auth_required', async () => {
    const entry = await probeProviderReadiness(adapter('cursor'), {
      runner: fakeRunner({
        executables: { 'cursor-agent': '/usr/local/bin/cursor-agent' },
        results: {
          'cursor-agent --version': {
            code: 1,
            stdout: '',
            stderr: 'OS keychain is locked; authentication required\n',
          },
        },
      }),
    });

    expect(entry).toMatchObject({
      id: 'cursor',
      status: 'auth_required',
      diagnostics: {
        warnings: [expect.stringContaining('PROVIDER_AUTH_REQUIRED')],
      },
    });
  });

  it('maps terminal local configuration or platform issues to unavailable', async () => {
    const entry = await probeProviderReadiness(adapter('claude'), {
      runner: fakeRunner({
        executables: { claude: '/usr/local/bin/claude' },
        results: {
          'claude --version': {
            code: 1,
            stdout: '',
            stderr: 'unsupported platform for local Claude runtime\n',
          },
        },
      }),
    });

    expect(entry).toMatchObject({
      id: 'claude',
      status: 'unavailable',
      diagnostics: {
        warnings: [expect.stringContaining('PROVIDER_UNAVAILABLE')],
      },
    });
  });

  it('probes the default command inventory with an injected runner', async () => {
    const envelope = await runProviderList({
      probeRunner: fakeRunner({
        executables: { codex: '/usr/local/bin/codex' },
        results: {
          'codex --version': {
            code: 0,
            stdout: 'codex 1.2.3\n',
            stderr: '',
          },
        },
      }),
    });

    expect(envelope.providers).toEqual([
      expect.objectContaining({ id: 'claude', status: 'missing' }),
      expect.objectContaining({ id: 'codex', status: 'ready' }),
      expect.objectContaining({ id: 'cursor', status: 'missing' }),
    ]);
  });

  it('returns an unsupported entry for unsupported requested provider IDs', async () => {
    await expect(
      runPreflight({
        provider: 'gemini',
        registry: await probeProviderRegistry({
          registry: providerRegistry(),
          runner: fakeRunner({ executables: {} }),
        }),
      }),
    ).resolves.toMatchObject({
      ok: true,
      usable: false,
      providers: [{ id: 'gemini', status: 'unsupported' }],
    });
  });
});

function adapter(id: 'claude' | 'codex' | 'cursor') {
  const selected = providerRegistry().get(id);
  if (!selected) throw new Error(`Missing adapter fixture: ${id}`);
  return selected;
}

function fakeRunner(options: {
  executables: Record<string, string>;
  results?: Record<
    string,
    { code: number; stdout: string; stderr: string; signal?: string | null }
  >;
}): ProbeCommandRunner {
  return {
    async findExecutable(command) {
      return options.executables[command];
    },
    async run(command, args) {
      const key = [command, ...args].join(' ');
      const result = options.results?.[key];
      if (!result) {
        return { code: 127, signal: null, stdout: '', stderr: 'not found' };
      }
      return { signal: null, ...result };
    },
  };
}
