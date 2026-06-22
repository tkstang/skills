import { expect, it } from 'vitest';

import { parsePlanArgs } from '../../../src/consensus/plan/consensus-plan.js';

it('parses goal text and plan defaults', () => {
  const parsed = parsePlanArgs(['--goal', 'Ship a migration plan']);

  expect(parsed).toMatchObject({
    goal: 'Ship a migration plan',
    constraints: null,
    coldStart: 'independent_draft',
    iteration: 'parallel_synthesized',
    agency: 'moderate',
    maxRounds: 12,
    peers: null,
    synthesizer: null,
    output: null,
    runDir: null,
    allowRoot: null,
  });
});

it('parses inline constraints and shared consensus override flags', () => {
  const parsed = parsePlanArgs([
    '--goal',
    'Plan the release',
    '--constraints',
    'Keep downtime under five minutes.',
    '--cold-start',
    'shared_input',
    '--iteration',
    'parallel_revision',
    '--agency',
    'maximum',
    '--peers',
    'claude,codex',
    '--synthesizer',
    'codex',
    '--max-rounds',
    '4',
    '--output',
    'plan.md',
    '--run-dir',
    '.consensus/plan-run',
    '--allow-root',
    '.',
  ]);

  expect(parsed).toMatchObject({
    goal: 'Plan the release',
    constraints: 'Keep downtime under five minutes.',
    coldStart: 'shared_input',
    iteration: 'parallel_revision',
    agency: 'maximum',
    peers: ['claude', 'codex'],
    synthesizer: 'codex',
    maxRounds: 4,
    output: 'plan.md',
    runDir: '.consensus/plan-run',
    allowRoot: '.',
  });
});

it('requires exactly one goal and keeps constraints inline-only', () => {
  expect(() => parsePlanArgs([])).toThrow(/requires --goal/);
  expect(() =>
    parsePlanArgs(['--goal', 'A', '--goal', 'B']),
  ).toThrow(/exactly one --goal/);
  expect(() =>
    parsePlanArgs(['--goal', 'A', '--constraints-file', 'constraints.md']),
  ).toThrow(/unknown option: --constraints-file/);
});

it('validates shared consensus flags', () => {
  expect(() =>
    parsePlanArgs(['--goal', 'x', '--peers', 'claude']),
  ).toThrow(/exactly two peers/);
  expect(() =>
    parsePlanArgs(['--goal', 'x', '--peers', 'claude,Codex']),
  ).toThrow(/must match/);
  expect(() =>
    parsePlanArgs(['--goal', 'x', '--max-rounds', '0']),
  ).toThrow(/between 1 and 100/);
  expect(() =>
    parsePlanArgs(['--goal', 'x', '--agency', 'reckless']),
  ).toThrow(/agency/);
  expect(() =>
    parsePlanArgs(['--goal', 'x', '--iteration', 'bogus']),
  ).toThrow(/alternating.*parallel_revision.*parallel_synthesized/);
  expect(() =>
    parsePlanArgs(['--goal', 'x', '--cold-start', 'bogus']),
  ).toThrow(/shared_input.*independent_draft/);
  expect(() => parsePlanArgs(['--goal', 'x', '--unknown'])).toThrow(
    /unknown option/,
  );
});
