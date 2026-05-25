import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_TESTED_PASEO_VERSION,
  MIN_PASEO_VERSION,
  detectHost,
  parseWrapperArgs,
  preflightPaseo,
  resolvePeers
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

function inventory(ids) {
  return ids.map((id) => ({ id, available: true }));
}

test('parseWrapperArgs handles sequential options and defaults', () => {
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
    '--yes-skip-corrupt'
  ]);

  assert.equal(parsed.inputPath, 'draft.md');
  assert.equal(parsed.goal, 'Tighten it.');
  assert.deepEqual(parsed.peers, ['claude', 'codex']);
  assert.equal(parsed.maxRounds, 8);
  assert.equal(parsed.agency, 'maximum');
  assert.equal(parsed.output, 'draft.consensus.md');
  assert.equal(parsed.runDir, '.consensus/run');
  assert.equal(parsed.allowRoot, '.');
  assert.equal(parsed.failOnSectionError, true);
  assert.deepEqual(parsed.skipCorruptSections, ['intro']);
  assert.equal(parsed.yesSkipCorrupt, true);
});

test('parseWrapperArgs handles prepare-parallel and fan-in modes', () => {
  const prepare = parseWrapperArgs(['draft.md', '--prepare-parallel', '--parallelism', '3']);
  assert.equal(prepare.mode, 'prepare_parallel');
  assert.equal(prepare.parallelism, 3);

  const fanIn = parseWrapperArgs(['--fan-in', '.consensus/run/manifest.json']);
  assert.equal(fanIn.mode, 'fan_in');
  assert.equal(fanIn.manifestPath, '.consensus/run/manifest.json');
  assert.equal(fanIn.inputPath, null);
});

test('parseWrapperArgs validates peers, max-rounds bounds, agency, and positional shape', () => {
  assert.throws(() => parseWrapperArgs(['draft.md', '--peers', 'claude']), /exactly two peers/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--peers', 'claude,Codex']), /must match/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--peers', '1claude,codex']), /must match/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--peers', 'claude,co.dex']), /must match/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--peers', `claude,${'a'.repeat(33)}`]), /must match/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--max-rounds', '0']), /between 1 and 100/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--max-rounds', '101']), /between 1 and 100/);
  assert.throws(() => parseWrapperArgs(['draft.md', '--agency', 'reckless']), /agency/);
  assert.throws(() => parseWrapperArgs(['one.md', 'two.md']), /unexpected positional/);
  assert.throws(() => parseWrapperArgs(['--prepare-parallel']), /input path/);
});

test('detectHost recognizes Claude, Codex, Cursor, and unknown environments', () => {
  assert.equal(detectHost({ CLAUDECODE: '1' }), 'claude');
  assert.equal(detectHost({ CODEX_SANDBOX: '1' }), 'codex');
  assert.equal(detectHost({ CURSOR_TRACE_ID: 'abc' }), 'cursor');
  assert.equal(detectHost({}), 'unknown');
});

test('resolvePeers uses host-aware defaults and paseo inventory as source of truth', () => {
  assert.deepEqual(resolvePeers({}, 'claude', inventory(['claude', 'codex'])).peers, ['claude', 'codex']);
  assert.deepEqual(resolvePeers({}, 'codex', inventory(['claude', 'codex'])).peers, ['codex', 'claude']);
  assert.deepEqual(resolvePeers({}, 'cursor', inventory(['claude', 'codex'])).peers, ['claude', 'codex']);
  assert.deepEqual(
    resolvePeers({ peers: ['opencode', 'pi'] }, 'claude', inventory(['opencode', 'pi'])).peers,
    ['opencode', 'pi']
  );

  assert.throws(
    () => resolvePeers({ peers: ['claude', 'missing'] }, 'claude', inventory(['claude'])),
    /missing.*paseo provider ls --json/i
  );
  assert.throws(
    () => resolvePeers({ peers: ['claude', 'codex'] }, 'claude', [{ id: 'claude', available: true }, { id: 'codex', available: false }]),
    /unavailable.*codex/i
  );
  assert.throws(
    () => resolvePeers({ peers: ['claude', 'codex'] }, 'claude', [{ id: 'claude', available: true }, { id: 'Codex', available: true }]),
    /provider inventory id.*must match/
  );
});

test('preflightPaseo reads version and providers and warns outside tested range', async () => {
  const calls = [];
  const result = await preflightPaseo({
    peers: ['claude', 'codex'],
    env: { CLAUDECODE: '1' },
    runCommand: async (command, args) => {
      calls.push([command, args]);
      if (args[0] === '--version') {
        return { stdout: `paseo ${MAX_TESTED_PASEO_VERSION}\n`, stderr: '' };
      }
      return { stdout: JSON.stringify(inventory(['claude', 'codex'])), stderr: '' };
    }
  });

  assert.deepEqual(calls, [
    ['paseo', ['--version']],
    ['paseo', ['provider', 'ls', '--json']]
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.version, MAX_TESTED_PASEO_VERSION);
  assert.deepEqual(result.peers, ['claude', 'codex']);
  assert.deepEqual(result.warnings, []);

  const old = await preflightPaseo({
    runCommand: async (_command, args) => {
      if (args[0] === '--version') return { stdout: 'paseo 0.0.1\n', stderr: '' };
      return { stdout: JSON.stringify(inventory(['claude', 'codex'])), stderr: '' };
    }
  });
  assert.match(old.warnings[0].message, new RegExp(`${MIN_PASEO_VERSION}.*${MAX_TESTED_PASEO_VERSION}`));
});

test('preflightPaseo surfaces missing paseo with install remediation', async () => {
  await assert.rejects(
    preflightPaseo({
      runCommand: async () => {
        const error = new Error('spawn paseo ENOENT');
        error.code = 'ENOENT';
        throw error;
      }
    }),
    (error) => {
      assert.match(error.message, /paseo.*missing/i);
      assert.equal(error.remediation.install_command, 'npm install -g @getpaseo/cli');
      assert.match(error.remediation.source_url, /github\.com\/getpaseo\/paseo/);
      assert.equal(error.remediation.install_script, 'scripts/install-paseo.mjs');
      return true;
    }
  );
});
