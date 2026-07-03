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

import { expect, it } from 'vitest';

import {
  detectHost,
  parseWrapperArgs,
  preflightConsensusProviderCli,
  resolvePeers,
  resolveSynthesizer,
  resolveRunDir,
  runSequential,
} from '../../../src/consensus/refine/consensus-refine.js';
import { writeConsensusConfig } from '../../../src/consensus/config/consensus-config.js';

function inventory(ids: string[]) {
  return ids.map((id) => ({ id, available: true }));
}

interface IsolatedConfigContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

async function withIsolatedConsensusConfig(
  fn: (context: IsolatedConfigContext) => Promise<void>,
  envOverrides: NodeJS.ProcessEnv = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consensus-refine-config-'));
  try {
    const cwd = path.join(root, 'project');
    const home = path.join(root, 'home');
    const xdg = path.join(root, 'xdg');
    await Promise.all([
      mkdir(cwd, { recursive: true }),
      mkdir(home, { recursive: true }),
      mkdir(xdg, { recursive: true }),
    ]);

    await fn({
      cwd,
      env: {
        CONSENSUS_CLI_PATH: '/tmp/bin/consensus',
        HOME: home,
        XDG_CONFIG_HOME: xdg,
        ...envOverrides,
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function providerCliCommand(
  statuses: Record<string, string> = {},
  providers = ['claude', 'codex', 'cursor'],
) {
  const calls: Array<[string, string[]]> = [];
  return {
    calls,
    runCommand: async (command: string, args: string[]) => {
      calls.push([command, args]);
      if (args[0] === 'provider') {
        return {
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: true,
            providers: providers.map((id) => ({
              id,
              status: statuses[id] ?? 'ready',
            })),
          }),
          stderr: '',
        };
      }

      const provider = args.at(-1) ?? '';
      const status = statuses[provider] ?? 'ready';
      return {
        stdout: JSON.stringify({
          schema_version: 'v1',
          ok: true,
          usable: status === 'ready',
          providers: [{ id: provider, status }],
        }),
        stderr: '',
      };
    },
  };
}

it('parseWrapperArgs handles sequential options and defaults', () => {
  const parsed = parseWrapperArgs([
    'draft.md',
    '--goal',
    'Tighten it.',
    '--peers',
    'claude,codex',
    '--max-rounds',
    '8',
    '--agency',
    'maximum',
    '--output',
    'draft.consensus.md',
    '--run-dir',
    '.consensus/run',
    '--allow-root',
    '.',
    '--fail-on-section-error',
    '--skip-corrupt-section',
    'intro',
    '--yes-skip-corrupt',
  ]);

  expect(parsed.inputPath).toBe('draft.md');
  expect(parsed.goal).toBe('Tighten it.');
  expect(parsed.peers).toEqual(['claude', 'codex']);
  expect(parsed.maxRounds).toBe(8);
  expect(parsed.agency).toBe('maximum');
  expect(parsed.coldStart).toBe('shared_input');
  expect(parsed.output).toBe('draft.consensus.md');
  expect(parsed.runDir).toBe('.consensus/run');
  expect(parsed.allowRoot).toBe('.');
  expect(parsed.failOnSectionError).toBe(true);
  expect(parsed.skipCorruptSections).toEqual(['intro']);
  expect(parsed.yesSkipCorrupt).toBe(true);
});

it('parseWrapperArgs accepts iteration modes, defaults to alternating, and rejects invalid', () => {
  expect(parseWrapperArgs(['draft.md']).iteration).toBe('alternating');
  expect(
    parseWrapperArgs(['draft.md', '--iteration', 'parallel_revision'])
      .iteration,
  ).toBe('parallel_revision');
  expect(
    parseWrapperArgs(['draft.md', '--iteration', 'parallel_synthesized'])
      .iteration,
  ).toBe('parallel_synthesized');
  expect(
    parseWrapperArgs(['draft.md', '--cold-start', 'shared_input']).coldStart,
  ).toBe('shared_input');

  let thrown: any;
  try {
    parseWrapperArgs(['draft.md', '--iteration', 'bogus']);
  } catch (error) {
    thrown = error;
  }
  expect(thrown, 'expected an error').toBeTruthy();
  expect(thrown.code).toBe('INVALID_ITERATION_MODE');
  expect(thrown.message).toMatch(
    /alternating.*parallel_revision.*parallel_synthesized/,
  );

  expect(() =>
    parseWrapperArgs(['draft.md', '--cold-start', 'independent_draft']),
  ).toThrow(/supports `shared_input` only/);
});

it('parseWrapperArgs parses --synthesizer and defaults it to null (resolved at run time)', () => {
  expect(parseWrapperArgs(['draft.md']).synthesizer).toBe(null);
  expect(
    parseWrapperArgs([
      'draft.md',
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'codex',
    ]).synthesizer,
  ).toBe('codex');
});

it('resolveSynthesizer defaults to the first peer and validates against the inventory', () => {
  // Default: first peer when unspecified.
  expect(
    resolveSynthesizer(
      { peers: ['claude', 'codex'], iteration: 'parallel_synthesized' },
      inventory(['claude', 'codex']),
    ).synthesizer,
  ).toBe('claude');

  // Explicit override present in the inventory.
  expect(
    resolveSynthesizer(
      {
        peers: ['claude', 'codex'],
        iteration: 'parallel_synthesized',
        synthesizer: 'codex',
      },
      inventory(['claude', 'codex']),
    ).synthesizer,
  ).toBe('codex');
});

it('resolveSynthesizer rejects a synthesizer missing from the inventory with SYNTHESIZER_UNAVAILABLE', () => {
  let thrown: any;
  try {
    resolveSynthesizer(
      {
        peers: ['claude', 'codex'],
        iteration: 'parallel_synthesized',
        synthesizer: 'gemini',
      },
      inventory(['claude', 'codex']),
    );
  } catch (error) {
    thrown = error;
  }
  expect(thrown, 'expected an error').toBeTruthy();
  expect(thrown.code).toBe('SYNTHESIZER_UNAVAILABLE');
  expect(thrown.message).toMatch(/gemini/);
});

it('resolveSynthesizer warns and ignores a synthesizer outside parallel_synthesized mode', () => {
  const result = resolveSynthesizer(
    {
      peers: ['claude', 'codex'],
      iteration: 'parallel_revision',
      synthesizer: 'codex',
    },
    inventory(['claude', 'codex']),
  );
  expect(result.synthesizer).toBe(null);
  expect(
    result.warnings.some((warning: any) =>
      /synthesizer/i.test(warning.message),
    ),
  ).toBeTruthy();
});

it('parseWrapperArgs handles prepare-parallel and fan-in modes', () => {
  const prepare = parseWrapperArgs([
    'draft.md',
    '--prepare-parallel',
    '--parallelism',
    '3',
  ]);
  expect(prepare.mode).toBe('prepare_parallel');
  expect(prepare.parallelism).toBe(3);

  const fanIn = parseWrapperArgs(['--fan-in', '.consensus/run/manifest.json']);
  expect(fanIn.mode).toBe('fan_in');
  expect(fanIn.manifestPath).toBe('.consensus/run/manifest.json');
  expect(fanIn.inputPath).toBe(null);
});

it('parseWrapperArgs validates peers, max-rounds bounds, agency, and positional shape', () => {
  expect(() => parseWrapperArgs(['draft.md', '--peers', 'claude'])).toThrow(
    /exactly two peers/,
  );
  expect(() =>
    parseWrapperArgs(['draft.md', '--peers', 'claude,Codex']),
  ).toThrow(/must match/);
  expect(() =>
    parseWrapperArgs(['draft.md', '--peers', '1claude,codex']),
  ).toThrow(/must match/);
  expect(() =>
    parseWrapperArgs(['draft.md', '--peers', 'claude,co.dex']),
  ).toThrow(/must match/);
  expect(() =>
    parseWrapperArgs(['draft.md', '--peers', `claude,${'a'.repeat(33)}`]),
  ).toThrow(/must match/);
  expect(() => parseWrapperArgs(['draft.md', '--max-rounds', '0'])).toThrow(
    /between 1 and 100/,
  );
  expect(() => parseWrapperArgs(['draft.md', '--max-rounds', '101'])).toThrow(
    /between 1 and 100/,
  );
  expect(() => parseWrapperArgs(['draft.md', '--agency', 'reckless'])).toThrow(
    /agency/,
  );
  expect(() => parseWrapperArgs(['one.md', 'two.md'])).toThrow(
    /unexpected positional/,
  );
  expect(() => parseWrapperArgs(['--prepare-parallel'])).toThrow(/input path/);
});

it('detectHost recognizes Claude, Codex, Cursor, and unknown environments', () => {
  expect(detectHost({ CLAUDECODE: '1' })).toBe('claude');
  expect(detectHost({ CODEX_SANDBOX: '1' })).toBe('codex');
  expect(detectHost({ CURSOR_TRACE_ID: 'abc' })).toBe('cursor');
  expect(detectHost({})).toBe('unknown');
});

it('resolvePeers uses host-aware defaults and provider inventory as source of truth', () => {
  expect(
    resolvePeers({}, 'claude', inventory(['claude', 'codex'])).peers,
  ).toEqual(['claude', 'codex']);
  expect(
    resolvePeers({}, 'codex', inventory(['claude', 'codex'])).peers,
  ).toEqual(['codex', 'claude']);
  expect(
    resolvePeers({}, 'cursor', inventory(['claude', 'codex'])).peers,
  ).toEqual(['claude', 'codex']);
  expect(
    resolvePeers(
      { peers: ['opencode', 'pi'] },
      'claude',
      inventory(['opencode', 'pi']),
    ).peers,
  ).toEqual(['opencode', 'pi']);

  expect(() =>
    resolvePeers(
      { peers: ['claude', 'missing'] },
      'claude',
      inventory(['claude']),
    ),
  ).toThrow(/missing.*consensus provider ls --json/i);
  expect(() =>
    resolvePeers({ peers: ['claude', 'codex'] }, 'claude', [
      { id: 'claude', available: true },
      { id: 'codex', available: false },
    ]),
  ).toThrow(/unavailable.*codex/i);
  expect(() =>
    resolvePeers({ peers: ['claude', 'codex'] }, 'claude', [
      { id: 'claude', available: true },
      { id: 'Codex', available: true },
    ]),
  ).toThrow(/provider inventory id.*must match/);
});

it('resolvePeers reads provider status/enabled inventory shape', () => {
  // Provider inventories can emit { provider, status, enabled: "Enabled"|"Disabled" },
  // not only the { id, available } booleans the synthetic inventory() helper uses.
  const ready = [
    { provider: 'claude', status: 'available', enabled: 'Enabled' },
    { provider: 'codex', status: 'available', enabled: 'Enabled' },
  ];
  expect(
    resolvePeers({ peers: ['claude', 'codex'] }, 'claude', ready).peers,
  ).toEqual(['claude', 'codex']);

  // A provider reported as errored (for example, cursor auth failure) must fail
  // preflight before any mid-loop invocation.
  expect(() =>
    resolvePeers({ peers: ['claude', 'cursor'] }, 'claude', [
      { provider: 'claude', status: 'available', enabled: 'Enabled' },
      { provider: 'cursor', status: 'error', enabled: 'Enabled' },
    ]),
  ).toThrow(/unavailable.*cursor/i);

  // The "Disabled" display string means unavailable too.
  expect(() =>
    resolvePeers({ peers: ['claude', 'omp'] }, 'claude', [
      { provider: 'claude', status: 'available', enabled: 'Enabled' },
      { provider: 'omp', status: 'available', enabled: 'Disabled' },
    ]),
  ).toThrow(/unavailable.*omp/i);

  // A cold-daemon snapshot can briefly report a healthy provider as loading;
  // that must not false-fail preflight.
  expect(
    resolvePeers({ peers: ['claude', 'codex'] }, 'claude', [
      { provider: 'claude', status: 'available', enabled: 'Enabled' },
      { provider: 'codex', status: 'loading', enabled: 'Enabled' },
    ]).peers,
  ).toEqual(['claude', 'codex']);
});

it('preflightConsensusProviderCli uses provider inventory and selected-provider preflight', async () => {
  const calls: Array<[string, string[]]> = [];
  const result = await preflightConsensusProviderCli({
    peers: ['claude', 'codex'],
    env: { CONSENSUS_CLI_PATH: '/tmp/bin/consensus' },
    runCommand: async (command: string, args: string[]) => {
      calls.push([command, args]);
      if (args[0] === 'provider') {
        return {
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: true,
            providers: [
              { id: 'claude', status: 'ready' },
              { id: 'codex', status: 'ready' },
            ],
          }),
          stderr: '',
        };
      }
      return {
        stdout: JSON.stringify({
          schema_version: 'v1',
          ok: true,
          usable: true,
          providers: [{ id: args.at(-1), status: 'ready' }],
        }),
        stderr: '',
      };
    },
  });

  expect(calls).toEqual([
    ['/tmp/bin/consensus', ['provider', 'ls', '--json']],
    ['/tmp/bin/consensus', ['preflight', '--json', '--provider', 'claude']],
    ['/tmp/bin/consensus', ['preflight', '--json', '--provider', 'codex']],
  ]);
  expect(result.peers).toEqual(['claude', 'codex']);
  expect(result.providerInventory).toEqual([
    expect.objectContaining({ id: 'claude', available: true }),
    expect.objectContaining({ id: 'codex', available: true }),
  ]);
});

it('preflightConsensusProviderCli preserves host-aware defaults without config', async () => {
  await withIsolatedConsensusConfig(
    async ({ cwd, env }) => {
      const command = providerCliCommand();
      const result = await preflightConsensusProviderCli({
        cwd,
        env,
        runCommand: command.runCommand,
      });

      expect(result.peers).toEqual(['codex', 'claude']);
    },
    { CODEX_SANDBOX: '1' },
  );
});

it('preflightConsensusProviderCli uses configured defaults only without explicit peers', async () => {
  await withIsolatedConsensusConfig(async ({ cwd, env }) => {
    const command = providerCliCommand();
    await writeConsensusConfig({
      scope: 'user',
      cwd,
      env,
      config: {
        schema_version: 'v1',
        defaults: {
          peers: [{ provider: 'codex' }, { provider: 'cursor' }],
        },
      },
    });

    await expect(
      preflightConsensusProviderCli({
        cwd,
        env,
        runCommand: command.runCommand,
      }),
    ).resolves.toMatchObject({
      peers: ['codex', 'cursor'],
    });

    await writeConsensusConfig({
      scope: 'project',
      cwd,
      env,
      config: {
        schema_version: 'v1',
        defaults: {
          peers: [{ provider: 'cursor' }, { provider: 'claude' }],
        },
      },
    });

    await expect(
      preflightConsensusProviderCli({
        cwd,
        env,
        runCommand: command.runCommand,
      }),
    ).resolves.toMatchObject({
      peers: ['cursor', 'claude'],
    });

    await expect(
      preflightConsensusProviderCli({
        cwd,
        env,
        peers: ['claude', 'codex'],
        runCommand: command.runCommand,
      }),
    ).resolves.toMatchObject({
      peers: ['claude', 'codex'],
    });
  });
});

it('preflightConsensusProviderCli still fails closed for unavailable explicit peers', async () => {
  await withIsolatedConsensusConfig(async ({ cwd, env }) => {
    const command = providerCliCommand({ cursor: 'auth_required' });

    await expect(
      preflightConsensusProviderCli({
        cwd,
        env,
        peers: ['claude', 'cursor'],
        runCommand: command.runCommand,
      }),
    ).rejects.toSatisfy((error: { code?: string; message: string }) => {
      expect(error.code).toBe('PEER_UNAVAILABLE');
      expect(error.message).toMatch(/cursor/);
      expect(error.message).toMatch(/auth_required/);
      return true;
    });
  });
});

it('preflightConsensusProviderCli reports provider-neutral configured default diagnostics', async () => {
  await withIsolatedConsensusConfig(async ({ cwd, env }) => {
    const command = providerCliCommand({ cursor: 'auth_required' });
    await writeConsensusConfig({
      scope: 'project',
      cwd,
      env,
      config: {
        schema_version: 'v1',
        defaults: {
          peers: [{ provider: 'claude' }, { provider: 'cursor' }],
        },
      },
    });

    await expect(
      preflightConsensusProviderCli({
        cwd,
        env,
        runCommand: command.runCommand,
      }),
    ).rejects.toSatisfy((error: { code?: string; message: string }) => {
      expect(error.code).toBe('PEER_UNAVAILABLE');
      expect(error.message).toMatch(/cursor/);
      expect(error.message).toMatch(/auth_required/);
      expect(error.message).not.toMatch(/install/i);
      return true;
    });
  });
});

it('preflightConsensusProviderCli reports auth-required providers without install remediation', async () => {
  await expect(
    preflightConsensusProviderCli({
      peers: ['cursor'],
      env: { CONSENSUS_CLI_PATH: '/tmp/bin/consensus' },
      runCommand: async (_command: string, args: string[]) => {
        if (args[0] === 'provider') {
          return {
            stdout: JSON.stringify({
              schema_version: 'v1',
              ok: true,
              providers: [{ id: 'cursor', status: 'auth_required' }],
            }),
            stderr: '',
          };
        }
        return {
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: true,
            usable: false,
            providers: [{ id: 'cursor', status: 'auth_required' }],
          }),
          stderr: '',
        };
      },
    }),
  ).rejects.toSatisfy((error: { code?: string; message: string }) => {
    expect(error.code).toBe('PEER_UNAVAILABLE');
    expect(error.message).toMatch(/cursor/);
    expect(error.message).toMatch(/auth_required/);
    expect(error.message).not.toMatch(/install/i);
    return true;
  });
});

it('runSequential preflights an explicit synthesized-mode synthesizer outside the peer set', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-cli-refine-synth-preflight-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const calls: Array<[string, string[]]> = [];
  await writeFile(inputPath, '# Intro\n\nStable text.\n');

  await expect(
    runSequential({
      inputPath,
      output: path.join(tempRoot, 'draft.consensus.md'),
      runDir: path.join(tempRoot, '.consensus/run'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      env: {
        ...process.env,
        CONSENSUS_CLI_PATH: '/tmp/bin/consensus',
      },
      goal: 'Run synthesized mode.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'cursor',
      maxRounds: 1,
      agency: 'moderate',
      runCommand: async (command: string, args: string[]) => {
        calls.push([command, args]);
        if (args[0] === 'provider') {
          return {
            stdout: JSON.stringify({
              schema_version: 'v1',
              ok: true,
              providers: [
                { id: 'claude', status: 'ready' },
                { id: 'codex', status: 'ready' },
                { id: 'cursor', status: 'ready' },
              ],
            }),
            stderr: '',
          };
        }
        const provider = args.at(-1);
        return {
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: true,
            usable: provider !== 'cursor',
            providers: [
              {
                id: provider,
                status: provider === 'cursor' ? 'auth_required' : 'ready',
              },
            ],
          }),
          stderr: '',
        };
      },
    }),
  ).rejects.toSatisfy((error: { code?: string; message: string }) => {
    expect(error.code).toBe('PEER_UNAVAILABLE');
    expect(error.message).toMatch(/cursor/);
    expect(error.message).toMatch(/auth_required/);
    return true;
  });

  expect(calls).toEqual([
    ['/tmp/bin/consensus', ['provider', 'ls', '--json']],
    ['/tmp/bin/consensus', ['preflight', '--json', '--provider', 'claude']],
    ['/tmp/bin/consensus', ['preflight', '--json', '--provider', 'codex']],
    ['/tmp/bin/consensus', ['preflight', '--json', '--provider', 'cursor']],
  ]);
});

it('runSequential uses the provider CLI backend with CONSENSUS_CLI_PATH override', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-cli-refine-'),
  );
  const consensusPath = path.join(tempRoot, 'consensus');
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');

  await writeFile(inputPath, '# Intro\n\nStable text.\n');
  await writeFile(
    consensusPath,
    [
      '#!/usr/bin/env node',
      'const args = process.argv.slice(2);',
      'const readStdin = () => new Promise((resolve) => { let data = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { data += chunk; }); process.stdin.on("end", () => resolve(data)); });',
      'async function main() {',
      '  if (args[0] === "provider") { console.log(JSON.stringify({ schema_version: "v1", ok: true, providers: [{ id: "claude", status: "ready" }, { id: "codex", status: "ready" }] })); return; }',
      '  if (args[0] === "preflight") { console.log(JSON.stringify({ schema_version: "v1", ok: true, usable: true, providers: [{ id: args.at(-1), status: "ready" }] })); return; }',
      '  const request = JSON.parse(await readStdin());',
      '  const payload = { schema_version: "v1", verdict: "ACCEPT", reasoning: `${request.provider} accepts` };',
      '  console.log(JSON.stringify({ schema_version: "v1", ok: true, provider: request.provider, args: ["stub"], stdout: JSON.stringify(payload), json: payload, attempts: { cli_attempts: 1, terminal_reason: "success", retryable: false }, diagnostics: { strategy_used: "prompt_only" } }));',
      '}',
      'main().catch((error) => { console.error(error.message); process.exitCode = 1; });',
      '',
    ].join('\n'),
  );
  await chmod(consensusPath, 0o755);

  const result = await runSequential({
    inputPath,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    env: {
      ...process.env,
      CONSENSUS_CLI_PATH: consensusPath,
    },
    goal: 'Run through the provider CLI backend.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
  });

  expect(result.status).toBe('converged');
  expect(result.sections).toHaveLength(1);
  const [section] = result.sections;
  if (!section) throw new Error('expected one result section');
  if (!section.paths) throw new Error('expected section output paths');
  const records = JSON.parse(await readFile(section.paths.records, 'utf8'));
  expect(records[0]).toMatchObject({
    raw_provider_response: expect.stringContaining('"verdict":"ACCEPT"'),
    provider_diagnostics: { strategy_used: 'prompt_only' },
    attempts: { cli_attempts: 1, terminal_reason: 'success' },
  });
});

it('resolveRunDir gives each fresh run a unique default dir (no rerun contamination)', async () => {
  const cwd = process.cwd();
  const a = await resolveRunDir({ cwd });
  const b = await resolveRunDir({ cwd });
  // Two consecutive fresh runs must not share a run dir (which is what let a
  // prior run's stale per-section records leak into the next run).
  expect(a).not.toBe(b);
  expect(a).toMatch(/\.consensus\/run-/);
  // An explicit --run-dir is honored verbatim (relative to cwd).
  const explicit = await resolveRunDir({ cwd, runDir: '.consensus/run' });
  expect(explicit).toBe(`${cwd}/.consensus/run`);
});
