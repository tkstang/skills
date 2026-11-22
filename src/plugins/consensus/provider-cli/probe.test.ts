import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../provider-cli/adapters.js';
import type { ProviderAdapter } from '../provider-cli/adapters.js';
import { runPreflight, runProviderList } from '../provider-cli/commands.js';
import {
  nodeProbeCommandRunner,
  probeProviderReadiness,
  probeProviderRegistry,
  type ProbeCommandRunner,
  type ProviderPrerequisiteVersion,
} from '../provider-cli/probe.js';

describe('provider readiness probes', () => {
  it.each([
    ['2.1.258', 'unavailable'],
    ['2.1.259', 'ready'],
  ])(
    'requires Claude permission-prompt support at %s',
    async (version, status) => {
      const entry = await probeProviderReadiness(adapter('claude'), {
        runner: fakeRunner({
          executables: { claude: '/fixture/claude' },
          results: {
            '/fixture/claude --version': {
              code: 0,
              stdout: `Claude Code ${version}\n`,
              stderr: '',
            },
          },
        }),
      });
      expect(entry.status).toBe(status);
      if (status === 'unavailable') {
        expect(entry.diagnostics?.warnings?.join(' ')).toContain(
          'PROVIDER_VERSION_UNSUPPORTED',
        );
      }
    },
  );

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
          '/usr/local/bin/codex --version': {
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
          '/usr/local/bin/cursor-agent --version': {
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
          '/usr/local/bin/claude --version': {
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
          '/usr/local/bin/codex --version': {
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

  it('preflights only the selected provider CLI, running the resolved executable', async () => {
    const calls: string[] = [];
    const runner: ProbeCommandRunner = {
      async findExecutable(command) {
        calls.push(`find:${command}`);
        if (command !== 'codex') throw new Error(`unexpected CLI: ${command}`);
        return '/usr/local/bin/codex';
      },
      async run(command, args, probed) {
        calls.push(`run:${probed.id}:${command} ${args.join(' ')}`);
        const help = args.join(' ') === 'exec --help';
        return {
          code: 0,
          signal: null,
          stdout: help
            ? '--json --output-last-message --output-schema\n'
            : 'codex 1.2.3\n',
          stderr: '',
        };
      },
    };

    await expect(
      runPreflight({
        provider: 'codex',
        capabilities: ['run'],
        probeRunner: runner,
      }),
    ).resolves.toMatchObject({
      usable: true,
      providers: [{ id: 'codex', status: 'ready' }],
    });
    expect(calls).toEqual([
      'find:codex',
      'run:codex:/usr/local/bin/codex --version',
      'run:codex:/usr/local/bin/codex exec --help',
    ]);
  });

  it.each([
    ['below minimum', 'codex 0.1.0\n', 'PROVIDER_VERSION_UNSUPPORTED'],
    [
      'unparseable',
      'codex development build\n',
      'PROVIDER_VERSION_UNPARSEABLE',
    ],
  ])(
    'rejects %s version output deterministically',
    async (_case, output, code) => {
      const entry = await probeProviderReadiness(adapter('codex'), {
        requiredCapabilities: ['run'],
        runner: fakeRunner({
          executables: { codex: '/usr/local/bin/codex' },
          results: {
            '/usr/local/bin/codex --version': {
              code: 0,
              stdout: output,
              stderr: '',
            },
          },
        }),
      });

      expect(entry).toMatchObject({
        id: 'codex',
        status: 'unavailable',
        diagnostics: { warnings: [expect.stringContaining(code)] },
      });
    },
  );

  it('accepts a compatible version with the required local run capability', async () => {
    const entry = await probeProviderReadiness(adapter('codex'), {
      requiredCapabilities: ['run'],
      runner: fakeRunner({
        executables: { codex: '/usr/local/bin/codex' },
        results: {
          '/usr/local/bin/codex --version': {
            code: 0,
            stdout: 'codex-cli 0.139.0\n',
            stderr: '',
          },
          '/usr/local/bin/codex exec --help': {
            code: 0,
            stdout: '--json --output-last-message --output-schema\n',
            stderr: '',
          },
        },
      }),
    });

    expect(entry).toMatchObject({
      id: 'codex',
      status: 'ready',
      version: 'codex-cli 0.139.0',
    });
  });

  it('probes the CONSENSUS_<PROVIDER>_EXECUTABLE program instead of the default command', async () => {
    const wrapper = '/opt/keyed/cursor-agent-keyed';
    const calls: string[] = [];
    const entry = await probeProviderReadiness(adapter('cursor'), {
      requiredCapabilities: ['run'],
      runner: fakeRunner({
        env: { CONSENSUS_CURSOR_EXECUTABLE: wrapper },
        calls,
        // A cursor-agent on PATH must not be probed once the override is set.
        executables: {
          'cursor-agent': '/usr/local/bin/cursor-agent',
          [wrapper]: wrapper,
        },
        results: {
          [`${wrapper} --version`]: {
            code: 0,
            stdout: '2026.11.05-86047df\n',
            stderr: '',
          },
          [`${wrapper} --help`]: {
            code: 0,
            stdout: '--output-format --force\n',
            stderr: '',
          },
        },
      }),
    });

    expect(entry).toMatchObject({
      id: 'cursor',
      status: 'ready',
      executable: wrapper,
    });
    expect(calls).toEqual([`${wrapper} --version`, `${wrapper} --help`]);
  });

  it('probes CONSENSUS_CURSOR_EXECUTABLE through the default node runner', async () => {
    const binDir = await mkdtemp(path.join(os.tmpdir(), 'consensus-probe-'));
    const wrapper = await writeExecutableFixture(
      binDir,
      'cursor-agent-keyed',
      '#!/bin/sh\ncase "$1" in\n  --version) echo 2026.11.05-test ;;\n  --help) echo "--output-format --force" ;;\nesac\n',
    );

    try {
      const entry = await probeProviderReadiness(adapter('cursor'), {
        requiredCapabilities: ['run'],
        runner: nodeProbeCommandRunner({
          PATH: '/usr/bin:/bin',
          CONSENSUS_CURSOR_EXECUTABLE: wrapper,
        }),
      });

      expect(entry).toMatchObject({
        id: 'cursor',
        status: 'ready',
        executable: wrapper,
        version: '2026.11.05-test',
      });
    } finally {
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('reports a relative CONSENSUS_<PROVIDER>_EXECUTABLE as missing without probing it', async () => {
    const entry = await probeProviderReadiness(adapter('cursor'), {
      runner: fakeRunner({
        env: { CONSENSUS_CURSOR_EXECUTABLE: 'bin/cursor-agent-keyed' },
        executables: { 'bin/cursor-agent-keyed': 'bin/cursor-agent-keyed' },
      }),
    });

    expect(entry).toMatchObject({
      id: 'cursor',
      status: 'missing',
      diagnostics: {
        warnings: [
          expect.stringContaining(
            'CONSENSUS_CURSOR_EXECUTABLE must be an absolute path',
          ),
        ],
      },
    });
  });

  it('rejects a compatible version missing a required local run capability', async () => {
    const entry = await probeProviderReadiness(adapter('codex'), {
      requiredCapabilities: ['run'],
      runner: fakeRunner({
        executables: { codex: '/usr/local/bin/codex' },
        results: {
          '/usr/local/bin/codex --version': {
            code: 0,
            stdout: 'codex-cli 0.142.5\n',
            stderr: '',
          },
          '/usr/local/bin/codex exec --help': {
            code: 0,
            stdout: '--json --output-last-message\n',
            stderr: '',
          },
        },
      }),
    });

    expect(entry).toMatchObject({
      id: 'codex',
      status: 'unavailable',
      diagnostics: {
        warnings: [expect.stringContaining('PROVIDER_CAPABILITY_MISSING')],
      },
    });
  });

  it('bounds sleeping provider probes as unavailable timeouts', async () => {
    const binDir = await mkdtemp(path.join(os.tmpdir(), 'consensus-probe-'));
    await writeExecutableFixture(binDir, 'claude', '#!/bin/sh\n/bin/sleep 5\n');

    const startedAt = Date.now();
    try {
      const entry = await probeProviderReadiness(adapter('claude'), {
        runner: nodeProbeCommandRunner(
          {
            PATH: binDir,
          },
          {
            timeoutSec: 0.01,
            terminationGraceMs: 25,
            finalResolutionMs: 25,
          },
        ),
      });

      expect(Date.now() - startedAt).toBeLessThan(1000);
      expect(entry).toMatchObject({
        id: 'claude',
        status: 'unavailable',
        diagnostics: {
          timeout_sec: 0.01,
          warnings: [expect.stringContaining('PROVIDER_TIMEOUT')],
        },
      });
    } finally {
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('bounds oversized provider probe output as unavailable', async () => {
    const binDir = await mkdtemp(path.join(os.tmpdir(), 'consensus-probe-'));
    await writeExecutableFixture(
      binDir,
      'codex',
      `#!/bin/sh\nprintf '${'x'.repeat(4096)}'\n`,
    );

    try {
      const entry = await probeProviderReadiness(adapter('codex'), {
        runner: nodeProbeCommandRunner(
          {
            PATH: binDir,
          },
          {
            maxOutputBytes: 16,
            timeoutSec: 5,
            terminationGraceMs: 25,
            finalResolutionMs: 25,
          },
        ),
      });

      expect(entry).toMatchObject({
        id: 'codex',
        status: 'unavailable',
        diagnostics: {
          output_bytes: {
            max: 16,
          },
          warnings: [expect.stringContaining('PROVIDER_OUTPUT_CAP_EXCEEDED')],
        },
      });
    } finally {
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('returns an unsupported entry for unsupported requested provider IDs', async () => {
    await expect(
      runPreflight({
        provider: 'gemini',
        capabilities: ['run'],
        registry: await probeProviderRegistry({
          registry: providerRegistry(),
          runner: fakeRunner({ executables: {} }),
        }),
      }),
    ).resolves.toMatchObject({
      ok: true,
      usable: false,
      providers: [{ id: 'gemini', status: 'unsupported' }],
      diagnostics: {
        warnings: ['Requested provider is not registered: gemini'],
      },
    });
  });
});

describe('extended provider registration', () => {
  const launcher = {
    name: 'launcher',
    command: 'launcher',
    executable_env: 'CONSENSUS_FIXTURE_LAUNCHER_EXECUTABLE',
    install_hint: 'Install launcher 0.2.2-rc.5.',
  };
  const agentReady = {
    '/opt/bin/fixture-agent --version': {
      code: 0,
      stdout: 'fixture-agent 1.0.0\n',
      stderr: '',
    },
  };

  it('checks a presence-only prerequisite without running it', async () => {
    const calls: string[] = [];
    const entry = await probeProviderReadiness(
      fixtureAdapter({ prerequisites: [launcher] }),
      {
        runner: fakeRunner({
          calls,
          executables: {
            launcher: '/opt/bin/launcher',
            'fixture-agent': '/opt/bin/fixture-agent',
          },
          results: agentReady,
        }),
      },
    );

    expect(entry).toMatchObject({ id: 'fixture', status: 'ready' });
    expect(entry).not.toHaveProperty('install_hint');
    expect(calls).toEqual(['/opt/bin/fixture-agent --version']);
  });

  it('reports a missing prerequisite with its install hint before probing the provider', async () => {
    const calls: string[] = [];
    const entry = await probeProviderReadiness(
      fixtureAdapter({ prerequisites: [launcher] }),
      {
        runner: fakeRunner({
          calls,
          executables: { 'fixture-agent': '/opt/bin/fixture-agent' },
          results: agentReady,
        }),
      },
    );

    expect(entry).toMatchObject({
      id: 'fixture',
      status: 'missing',
      install_hint: 'Install launcher 0.2.2-rc.5.',
      diagnostics: {
        warnings: [
          'PROVIDER_PREREQUISITE_MISSING: launcher was not found (launcher)',
        ],
      },
    });
    expect(calls).toEqual([]);
  });

  it.each<[ProviderPrerequisiteVersion, string, 'ready' | 'unsupported']>([
    [{ args: ['--version'], exact: '0.2.2-rc.5' }, '0.2.2-rc.5', 'ready'],
    [{ args: ['--version'], exact: '0.2.2-rc.5' }, '0.2.2-rc.4', 'unsupported'],
    [{ args: ['--version'], exact: '0.2.2-rc.5' }, '0.2.2', 'unsupported'],
    [{ args: ['--version'], min: '0.20.0', max: '0.22.0' }, '0.22.0', 'ready'],
    [
      { args: ['--version'], min: '0.20.0', max: '0.22.0' },
      '0.23.0',
      'unsupported',
    ],
    // Exact pins compare build metadata; ranges ignore it.
    [
      { args: ['--version'], exact: '0.2.2-rc.5+approved' },
      '0.2.2-rc.5+approved',
      'ready',
    ],
    [
      { args: ['--version'], exact: '0.2.2-rc.5+approved' },
      '0.2.2-rc.5+other',
      'unsupported',
    ],
    [
      { args: ['--version'], min: '0.20.0', max: '0.22.0' },
      '0.22.0+build.7',
      'ready',
    ],
    // Only a complete version token parses.
    [
      { args: ['--version'], exact: '0.2.2-rc.5' },
      '0.2.2-rc.5.',
      'unsupported',
    ],
    // Exact pins compare the token as written, not numeric precedence.
    [{ args: ['--version'], exact: '0.2.2' }, '0.2.2.0', 'unsupported'],
    [{ args: ['--version'], exact: '0.2.2' }, '00.2.2', 'unsupported'],
  ])(
    'checks prerequisite pin %j against version %s',
    async (version, detected, status) => {
      const entry = await probeProviderReadiness(
        fixtureAdapter({ prerequisites: [{ ...launcher, version }] }),
        {
          runner: fakeRunner({
            executables: {
              launcher: '/opt/bin/launcher',
              'fixture-agent': '/opt/bin/fixture-agent',
            },
            results: {
              ...agentReady,
              '/opt/bin/launcher --version': {
                code: 0,
                stdout: `launcher ${detected}\n`,
                stderr: '',
              },
            },
          }),
        },
      );

      expect(entry.status).toBe(status);
      if (status === 'unsupported') {
        expect(entry).toMatchObject({
          install_hint: 'Install launcher 0.2.2-rc.5.',
          diagnostics: {
            warnings: [
              expect.stringMatching(
                /^PROVIDER_PREREQUISITE_VERSION_UNSUPPORTED: launcher .* is outside the required version /,
              ),
            ],
          },
        });
      }
    },
  );

  it.each<[string, ProviderPrerequisiteVersion]>([
    ['a partial version', { args: ['--version'], exact: '0.2' }],
    ['surrounding text', { args: ['--version'], min: 'v0.20.0 or later' }],
    ['an empty range', { args: ['--version'], min: '0.22.0', max: '0.20.0' }],
    [
      'an exact pin with a range',
      { args: ['--version'], exact: '0.2.2', min: '0.2.3' },
    ],
  ])(
    'rejects a pin with %s before running the version command',
    async (_label, version) => {
      const calls: string[] = [];
      const entry = await probeProviderReadiness(
        fixtureAdapter({ prerequisites: [{ ...launcher, version }] }),
        {
          runner: fakeRunner({
            calls,
            executables: {
              launcher: '/opt/bin/launcher',
              'fixture-agent': '/opt/bin/fixture-agent',
            },
            results: agentReady,
          }),
        },
      );

      expect(entry).toMatchObject({
        status: 'unsupported',
        diagnostics: {
          warnings: [
            expect.stringMatching(
              /^PROVIDER_PREREQUISITE_PIN_INVALID: launcher declares an invalid version pin/,
            ),
          ],
        },
      });
      expect(entry).not.toHaveProperty('install_hint');
      expect(calls).toEqual([]);
    },
  );

  it.each([
    ['is not found', {}],
    [
      'fails to start',
      {
        executables: { 'fixture-agent': '/opt/bin/fixture-agent' },
        results: {
          '/opt/bin/fixture-agent --version': {
            code: -2,
            stdout: '',
            stderr: '',
            failure_code: 'PROVIDER_MISSING' as const,
          },
        },
      },
    ],
  ])(
    "reports the adapter's install hint when its binary %s",
    async (_label, runner) => {
      const entry = await probeProviderReadiness(
        fixtureAdapter({ install_hint: 'Install fixture-agent.' }),
        { runner: fakeRunner({ executables: {}, ...runner }) },
      );

      expect(entry).toMatchObject({
        status: 'missing',
        install_hint: 'Install fixture-agent.',
      });
    },
  );

  it('lists only core providers by default but resolves a named extended provider', async () => {
    const adapters = providerRegistry([
      ...providerRegistry().list(),
      fixtureAdapter(),
    ]);
    const runner = fakeRunner({
      executables: { 'fixture-agent': '/opt/bin/fixture-agent' },
      results: {
        ...agentReady,
        '/opt/bin/fixture-agent exec --help': {
          code: 0,
          stdout: '--json --output-last-message --output-schema\n',
          stderr: '',
        },
      },
    });

    const listed = await runProviderList({ adapters, probeRunner: runner });
    const unprobed = await runProviderList({ adapters, registry: undefined });
    const named = await runPreflight({
      provider: 'fixture',
      capabilities: ['run'],
      adapters,
      probeRunner: runner,
    });

    expect(listed.providers.map((entry) => entry.id)).toEqual([
      'claude',
      'codex',
      'cursor',
    ]);
    expect(unprobed.providers.map((entry) => entry.id)).toEqual([
      'claude',
      'codex',
      'cursor',
    ]);
    expect(named).toMatchObject({
      usable: true,
      providers: [{ id: 'fixture', status: 'ready' }],
    });
  });

  it.each([
    ['antigravity', 'agy', '1.5.13'],
    ['gemini', 'gemini', '0.70.0'],
    ['droid', 'droid', '1.16.0'],
  ])(
    'registers %s as an admitted extended provider probed by --version only, with a numeric floor',
    async (id, command, floor) => {
      const probe = async (version: string) => {
        const calls: string[] = [];
        const envelope = await runPreflight({
          provider: id,
          capabilities: ['run'],
          probeRunner: fakeRunner({
            calls,
            executables: { [command]: `/opt/bin/${command}` },
            results: {
              [`/opt/bin/${command} --version`]: {
                code: 0,
                stdout: `${version}\n`,
                stderr: '',
              },
            },
          }),
        });
        return { envelope, calls };
      };

      const atFloor = await probe(floor);
      const below = await probe('0.0.1');
      const listed = await runProviderList({
        probeRunner: fakeRunner({ executables: {} }),
      });

      expect(atFloor.envelope.providers).toMatchObject([
        { id, status: 'ready', version: floor },
      ]);
      // No ACP handshake: Droid mints a pairing code on session/new.
      expect(new Set(atFloor.calls)).toEqual(
        new Set([`/opt/bin/${command} --version`]),
      );
      expect(below.envelope.providers).toMatchObject([
        { id, status: 'unavailable' },
      ]);
      expect(listed.providers.map((entry) => entry.id)).toEqual([
        'claude',
        'codex',
        'cursor',
      ]);
    },
  );

  it.each(['a probe runner', 'no probe runner'])(
    'reports a registered but not admitted provider without launching it, with %s',
    async (runnerCase) => {
      const calls: string[] = [];
      const envelope = await runPreflight({
        provider: 'fixture',
        capabilities: ['run'],
        adapters: providerRegistry([
          fixtureAdapter({
            not_admitted_reason: 'read-only admission pending',
          }),
        ]),
        ...(runnerCase === 'a probe runner'
          ? {
              probeRunner: fakeRunner({
                calls,
                executables: { 'fixture-agent': '/opt/bin/fixture-agent' },
                results: agentReady,
              }),
            }
          : {}),
      });

      expect(envelope).toEqual({
        schema_version: 'v1',
        ok: true,
        usable: false,
        providers: [
          expect.objectContaining({
            id: 'fixture',
            status: 'unsupported',
            diagnostics: {
              warnings: [
                'PROVIDER_NOT_ADMITTED: registered, not admitted: read-only admission pending',
              ],
            },
          }),
        ],
      });
      expect(calls).toEqual([]);
    },
  );
});

describe('node probe command runner', () => {
  it('probes an extended provider without its credentials and publishes only the version token', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'consensus-probe-env-'));
    try {
      const secret = 'zq-literal-credential-4711';
      const stub = await writeExecutableFixture(
        root,
        'gemini',
        `#!/bin/sh\necho "\${GEMINI_API_KEY:-none}" > '${root}/seen-key'\necho "gemini-cli 0.70.0 (build abc)"\n`,
      );
      const entry = await probeProviderReadiness(
        providerRegistry().get('gemini')!,
        {
          runner: nodeProbeCommandRunner({
            PATH: process.env.PATH,
            GEMINI_API_KEY: secret,
            CONSENSUS_GEMINI_EXECUTABLE: stub,
          }),
          requiredCapabilities: ['run'],
        },
      );

      expect(entry).toMatchObject({ status: 'ready', version: '0.70.0' });
      expect(await readFile(path.join(root, 'seen-key'), 'utf8')).toBe(
        'none\n',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('redacts a credential value from the unsupported-version warning', async () => {
    const secret = '123456';
    const entry = await probeProviderReadiness(
      providerRegistry().get('droid')!,
      {
        runner: fakeRunner({
          env: { FACTORY_API_KEY: secret },
          executables: { droid: '/opt/bin/droid' },
          results: {
            '/opt/bin/droid --version': {
              code: 0,
              stdout: `droid 1.15.${secret}\n`,
              stderr: '',
            },
          },
        }),
      },
    );

    expect(entry).toMatchObject({
      status: 'unavailable',
      diagnostics: {
        warnings: [expect.stringContaining('PROVIDER_VERSION_UNSUPPORTED')],
      },
    });
    expect(JSON.stringify(entry)).not.toContain(secret);
  });

  it.each([
    [
      'zqliteralcredential4711',
      'droid 1.17.0-zqliteralcredential4711+meta',
      '1.17.0',
      'ready',
    ],
    ['123456', 'droid 1.17.123456-rc.2', undefined, 'ready'],
    // Too large to round-trip, so the version is unparseable.
    [
      '98765432109876543210',
      'droid 1.17.98765432109876543210',
      undefined,
      'unavailable',
    ],
  ])(
    'drops a credential value %j from the extended version label',
    async (secret, line, version, status) => {
      const entry = await probeProviderReadiness(
        providerRegistry().get('droid')!,
        {
          runner: fakeRunner({
            env: { FACTORY_API_KEY: secret },
            executables: { droid: '/opt/bin/droid' },
            results: {
              '/opt/bin/droid --version': {
                code: 0,
                stdout: `${line}\n`,
                stderr: '',
              },
            },
          }),
        },
      );

      expect(entry.status).toBe(status);
      expect(entry.version).toBe(version);
      expect(JSON.stringify(entry)).not.toContain(secret);
    },
  );

  it.each([
    ['droid 1.16.0+sha.zq-literal-4711 (build abc)', '1.16.0'],
    ['droid 1.17.0-rc.2 linux', '1.17.0-rc.2'],
    ['droid 1.18.0-beta-x.1+meta', '1.18.0'],
  ])(
    'publishes only the release of extended version output %j',
    async (line, version) => {
      const entry = await probeProviderReadiness(
        providerRegistry().get('droid')!,
        {
          runner: fakeRunner({
            executables: { droid: '/opt/bin/droid' },
            results: {
              '/opt/bin/droid --version': {
                code: 0,
                stdout: `${line}\n`,
                stderr: '',
              },
            },
          }),
        },
      );

      expect(entry).toMatchObject({ status: 'ready', version });
    },
  );

  it('redacts credential values from core probe output kept in warnings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'consensus-probe-env-'));
    try {
      const secret = 'zq-literal-credential-4711';
      const stub = await writeExecutableFixture(
        root,
        'codex',
        '#!/bin/sh\necho "rejected key $OPENAI_API_KEY" >&2\nexit 1\n',
      );
      const entry = await probeProviderReadiness(adapter('codex'), {
        runner: nodeProbeCommandRunner({
          PATH: process.env.PATH,
          OPENAI_API_KEY: secret,
          CONSENSUS_CODEX_EXECUTABLE: stub,
        }),
      });

      expect(entry).toMatchObject({
        status: 'unavailable',
        diagnostics: {
          warnings: ['PROVIDER_UNAVAILABLE: rejected key <redacted>'],
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips relative PATH entries so probes and runs find the same absolute binary', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'consensus-finder-'));
    try {
      const relativeDir = path.join(root, 'relative-bin');
      const absoluteDir = path.join(root, 'absolute-bin');
      await mkdir(relativeDir);
      await mkdir(absoluteDir);
      await writeExecutableFixture(relativeDir, 'fixture-agent', '#!/bin/sh\n');
      const absoluteStub = await writeExecutableFixture(
        absoluteDir,
        'fixture-agent',
        '#!/bin/sh\n',
      );
      // Relative to this process's working directory, as a PATH entry such
      // as `bin` would be.
      const relativeEntry = path.relative(process.cwd(), relativeDir);

      const onlyRelative = nodeProbeCommandRunner({ PATH: relativeEntry });
      const relativeFirst = nodeProbeCommandRunner({
        PATH: ['', relativeEntry, absoluteDir].join(path.delimiter),
      });

      await expect(
        onlyRelative.findExecutable('fixture-agent'),
      ).resolves.toBeUndefined();
      await expect(relativeFirst.findExecutable('fixture-agent')).resolves.toBe(
        absoluteStub,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips a directory with the command name so it cannot shadow a later executable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'consensus-finder-'));
    try {
      const firstDir = path.join(root, 'first');
      const secondDir = path.join(root, 'second');
      // A searchable directory named like the command passes an X_OK check.
      await mkdir(path.join(firstDir, 'fixture-agent'), { recursive: true });
      await mkdir(secondDir);
      const stub = await writeExecutableFixture(
        secondDir,
        'fixture-agent',
        '#!/bin/sh\n',
      );

      const runner = nodeProbeCommandRunner({
        PATH: [firstDir, secondDir].join(path.delimiter),
      });

      await expect(runner.findExecutable('fixture-agent')).resolves.toBe(stub);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// An extended-tier adapter built from the Codex probe surface.
function fixtureAdapter(
  overrides: Partial<ProviderAdapter> & {
    prerequisites?: NonNullable<ProviderAdapter['probe']['prerequisites']>;
  } = {},
): ProviderAdapter {
  const codex = adapter('codex');
  const { prerequisites, ...rest } = overrides;
  return {
    ...codex,
    id: 'fixture',
    tier: 'extended',
    display_name: 'Fixture',
    executable: 'fixture-agent',
    executable_env: 'CONSENSUS_FIXTURE_EXECUTABLE',
    credential_env: [],
    probe: { ...codex.probe, ...(prerequisites ? { prerequisites } : {}) },
    ...rest,
  };
}

function adapter(id: 'claude' | 'codex' | 'cursor') {
  const selected = providerRegistry().get(id);
  if (!selected) throw new Error(`Missing adapter fixture: ${id}`);
  return selected;
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

function fakeRunner(options: {
  env?: Record<string, string>;
  calls?: string[];
  executables: Record<string, string>;
  results?: Record<
    string,
    {
      code: number;
      stdout: string;
      stderr: string;
      signal?: string | null;
      failure_code?: 'PROVIDER_MISSING';
    }
  >;
}): ProbeCommandRunner {
  return {
    env: options.env,
    async findExecutable(command) {
      return options.executables[command];
    },
    async run(command, args) {
      const key = [command, ...args].join(' ');
      options.calls?.push(key);
      const result = options.results?.[key];
      if (!result) {
        return { code: 127, signal: null, stdout: '', stderr: 'not found' };
      }
      return { signal: null, ...result };
    },
  };
}
