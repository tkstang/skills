import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  INPUT_SIZE_CAP_BYTES,
  loadDecideInputs,
  parseDecideArgs,
} from '../../../src/consensus/decide/consensus-decide.js';

it('parses options paths and decide defaults', () => {
  const parsed = parseDecideArgs(['--options', 'options.md']);

  expect(parsed).toMatchObject({
    optionsPath: 'options.md',
    coldStart: 'independent_draft',
    iteration: 'parallel_synthesized',
    agency: 'minimal',
    maxRounds: 12,
    peers: null,
    synthesizer: null,
    output: null,
    runDir: null,
    allowRoot: null,
  });
});

it('parses shared consensus override flags', () => {
  const parsed = parseDecideArgs([
    '--options',
    'options.md',
    '--cold-start',
    'shared_input',
    '--iteration',
    'alternating',
    '--agency',
    'moderate',
    '--peers',
    'claude,codex',
    '--synthesizer',
    'codex',
    '--max-rounds',
    '4',
    '--output',
    'decision.md',
    '--run-dir',
    '.consensus/decide-run',
    '--allow-root',
    '.',
  ]);

  expect(parsed).toMatchObject({
    optionsPath: 'options.md',
    coldStart: 'shared_input',
    iteration: 'alternating',
    agency: 'moderate',
    peers: ['claude', 'codex'],
    synthesizer: 'codex',
    maxRounds: 4,
    output: 'decision.md',
    runDir: '.consensus/decide-run',
    allowRoot: '.',
  });
});

it('requires exactly one options path', () => {
  expect(() => parseDecideArgs([])).toThrow(/requires --options/);
  expect(() =>
    parseDecideArgs(['--options', 'a.md', '--options', 'b.md']),
  ).toThrow(/exactly one --options/);
});

it('validates shared consensus flags', () => {
  expect(() =>
    parseDecideArgs(['--options', 'x', '--peers', 'claude']),
  ).toThrow(/exactly two peers/);
  expect(() =>
    parseDecideArgs(['--options', 'x', '--peers', 'claude,Codex']),
  ).toThrow(/must match/);
  expect(() =>
    parseDecideArgs(['--options', 'x', '--max-rounds', '0']),
  ).toThrow(/between 1 and 100/);
  expect(() =>
    parseDecideArgs(['--options', 'x', '--agency', 'reckless']),
  ).toThrow(/agency/);
  expect(() =>
    parseDecideArgs(['--options', 'x', '--iteration', 'bogus']),
  ).toThrow(/alternating.*parallel_revision.*parallel_synthesized/);
  expect(() =>
    parseDecideArgs(['--options', 'x', '--cold-start', 'bogus']),
  ).toThrow(/shared_input.*independent_draft/);
  expect(() => parseDecideArgs(['--options', 'x', '--unknown'])).toThrow(
    /unknown option/,
  );
});

it('loads options files relative to the invocation cwd', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-decide-'));
  await writeFile(path.join(tempRoot, 'options.md'), '# Options\n\n- A\n- B\n');

  const inputs = await loadDecideInputs(
    parseDecideArgs(['--options', 'options.md', '--allow-root', tempRoot]),
    { cwd: tempRoot },
  );

  expect(inputs.optionsPath).toBe(path.join(tempRoot, 'options.md'));
  expect(inputs.options).toBe('# Options\n\n- A\n- B\n');
});

it('rejects empty and oversized options before decide runs', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-decide-'));
  await writeFile(path.join(tempRoot, 'empty.md'), '');
  await writeFile(
    path.join(tempRoot, 'huge.md'),
    'x'.repeat(INPUT_SIZE_CAP_BYTES + 1),
  );

  await expect(
    loadDecideInputs(parseDecideArgs(['--options', 'empty.md']), {
      cwd: tempRoot,
    }),
  ).rejects.toThrow(/options must not be empty/);

  await expect(
    loadDecideInputs(parseDecideArgs(['--options', 'huge.md']), {
      cwd: tempRoot,
    }),
  ).rejects.toThrow(/input exceeds size cap/);
});

it('confines options file reads to the allowed root', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-decide-'));
  const outsideRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-decide-outside-'),
  );
  const outsideOptions = path.join(outsideRoot, 'options.md');
  await writeFile(outsideOptions, '# Options\n\nOutside.\n');

  await expect(
    loadDecideInputs(
      parseDecideArgs(['--options', outsideOptions, '--allow-root', tempRoot]),
      { cwd: tempRoot },
    ),
  ).rejects.toThrow(/read path.*outside allowed root/);
});
