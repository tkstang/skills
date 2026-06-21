import { expect, it } from 'vitest';

import { parseCreateArgs } from '../../../src/consensus/create/consensus-create.js';

it('parses inline briefs and create defaults', () => {
  const parsed = parseCreateArgs(['--brief', 'Draft a launch note.']);

  expect(parsed).toMatchObject({
    brief: 'Draft a launch note.',
    briefFile: null,
    template: null,
    coldStart: 'independent_draft',
    iteration: 'parallel_synthesized',
    agency: 'maximum',
    maxRounds: 12,
    peers: null,
    synthesizer: null,
    output: null,
    runDir: null,
    allowRoot: null,
  });
});

it('parses file briefs, templates, and shared consensus flags', () => {
  const parsed = parseCreateArgs([
    '--brief-file',
    'brief.md',
    '--template',
    'template.md',
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
    'created.md',
    '--run-dir',
    '.consensus/create-run',
    '--allow-root',
    '.',
  ]);

  expect(parsed).toMatchObject({
    brief: null,
    briefFile: 'brief.md',
    template: 'template.md',
    coldStart: 'shared_input',
    iteration: 'alternating',
    agency: 'moderate',
    peers: ['claude', 'codex'],
    synthesizer: 'codex',
    maxRounds: 4,
    output: 'created.md',
    runDir: '.consensus/create-run',
    allowRoot: '.',
  });
});

it('requires exactly one brief source', () => {
  expect(() => parseCreateArgs([])).toThrow(/requires --brief or --brief-file/);
  expect(() =>
    parseCreateArgs([
      '--brief',
      'Draft a launch note.',
      '--brief-file',
      'brief.md',
    ]),
  ).toThrow(/exactly one of --brief or --brief-file/);
});

it('validates shared consensus flags', () => {
  expect(() => parseCreateArgs(['--brief', 'x', '--peers', 'claude'])).toThrow(
    /exactly two peers/,
  );
  expect(() =>
    parseCreateArgs(['--brief', 'x', '--peers', 'claude,Codex']),
  ).toThrow(/must match/);
  expect(() => parseCreateArgs(['--brief', 'x', '--max-rounds', '0'])).toThrow(
    /between 1 and 100/,
  );
  expect(() =>
    parseCreateArgs(['--brief', 'x', '--agency', 'reckless']),
  ).toThrow(/agency/);
  expect(() =>
    parseCreateArgs(['--brief', 'x', '--iteration', 'bogus']),
  ).toThrow(/alternating.*parallel_revision.*parallel_synthesized/);
  expect(() =>
    parseCreateArgs(['--brief', 'x', '--cold-start', 'bogus']),
  ).toThrow(/shared_input.*independent_draft/);
  expect(() => parseCreateArgs(['--brief', 'x', '--unknown'])).toThrow(
    /unknown option/,
  );
});
