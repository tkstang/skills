import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const {
  MAX_TESTED_PASEO_VERSION,
  MIN_PASEO_VERSION,
  detectHost,
  parseWrapperArgs,
  preflightPaseo,
  resolvePeers,
  resolveSynthesizer,
  resolveRunDir,
} = consensusRefine;

function inventory(ids: string[]) {
  return ids.map((id) => ({ id, available: true }));
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
  ).toThrow(/not yet supported/);
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

it('resolvePeers uses host-aware defaults and paseo inventory as source of truth', () => {
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
  ).toThrow(/missing.*paseo provider ls --json/i);
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

it('resolvePeers reads real Paseo provider ls status/enabled shape', () => {
  // `paseo provider ls --json` emits { provider, status, enabled: "Enabled"|"Disabled" },
  // not the { id, available } booleans the synthetic inventory() helper uses.
  const ready = [
    { provider: 'claude', status: 'available', enabled: 'Enabled' },
    { provider: 'codex', status: 'available', enabled: 'Enabled' },
  ];
  expect(
    resolvePeers({ peers: ['claude', 'codex'] }, 'claude', ready).peers,
  ).toEqual(['claude', 'codex']);

  // A peer Paseo reports as errored (e.g. cursor when cursor-agent can't auth)
  // must fail preflight rather than surface later as a paseo run timeout.
  expect(() =>
    resolvePeers({ peers: ['claude', 'cursor'] }, 'claude', [
      { provider: 'claude', status: 'available', enabled: 'Enabled' },
      { provider: 'cursor', status: 'error', enabled: 'Enabled' },
    ]),
  ).toThrow(/unavailable.*cursor/i);

  // Paseo's "Disabled" display string means unavailable too.
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

it('preflightPaseo reads version and providers and warns outside tested range', async () => {
  const calls: Array<[string, string[]]> = [];
  const result = await preflightPaseo({
    peers: ['claude', 'codex'],
    env: { CLAUDECODE: '1' },
    runCommand: async (command: string, args: string[]) => {
      calls.push([command, args]);
      if (args[0] === '--version') {
        return { stdout: `paseo ${MAX_TESTED_PASEO_VERSION}\n`, stderr: '' };
      }
      return {
        stdout: JSON.stringify(inventory(['claude', 'codex'])),
        stderr: '',
      };
    },
  });

  expect(calls).toEqual([
    ['paseo', ['--version']],
    ['paseo', ['provider', 'ls', '--json']],
  ]);
  expect(result.ok).toBe(true);
  expect(result.version).toBe(MAX_TESTED_PASEO_VERSION);
  expect(result.peers).toEqual(['claude', 'codex']);
  expect(result.warnings).toEqual([]);

  const old = await preflightPaseo({
    runCommand: async (_command: string, args: string[]) => {
      if (args[0] === '--version')
        return { stdout: 'paseo 0.0.1\n', stderr: '' };
      return {
        stdout: JSON.stringify(inventory(['claude', 'codex'])),
        stderr: '',
      };
    },
  });
  expect(old.warnings[0].message).toMatch(
    new RegExp(`${MIN_PASEO_VERSION}.*${MAX_TESTED_PASEO_VERSION}`),
  );
});

it('preflightPaseo surfaces missing paseo with install remediation', async () => {
  await expect(
    preflightPaseo({
      runCommand: async () => {
        const error = new Error('spawn paseo ENOENT') as Error & {
          code?: string;
        };
        error.code = 'ENOENT';
        throw error;
      },
    }),
  ).rejects.toSatisfy((error: any) => {
    expect(error.message).toMatch(/paseo.*missing/i);
    expect(error.remediation.install_command).toBe(
      'npm install -g @getpaseo/cli',
    );
    expect(error.remediation.source_url).toMatch(
      /github\.com\/getpaseo\/paseo/,
    );
    expect(error.remediation.install_script).toBe('scripts/install-paseo.mjs');
    return true;
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
