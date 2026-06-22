import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runConsensusPlan } from '../../../src/consensus/plan/consensus-plan.js';
import { makeProviderCliEnv } from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

it('runs Plan through the consensus loop with plan headings and resolution metadata', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-plan-cli-integration-'),
  );
  const outputPath = path.join(tempRoot, 'plan.md');
  const runDir = path.join(tempRoot, '.consensus/plan-run');

  const peerPrompts: JsonRecord[] = [];
  const synthesisPrompts: JsonRecord[] = [];

  const result = await runConsensusPlan(
    [
      '--goal',
      'Migrate the release process to staged rollouts.',
      '--constraints',
      'Keep downtime under five minutes and preserve rollback.',
      '--output',
      outputPath,
      '--run-dir',
      runDir,
      '--allow-root',
      tempRoot,
      '--peers',
      'claude,codex',
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'cursor',
      '--max-rounds',
      '1',
    ],
    {
      cwd: tempRoot,
      env: makeProviderCliEnv(),
      invokePeer: async ({ provider, round, prompt, artifact }) => {
        peerPrompts.push({ provider, round, prompt, artifact });
        return {
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: `${provider} drafted a plan.`,
            proposed_artifact: `## Steps\n\n1. Prepare rollout.\n\n## Dependencies\n\n- Feature flags.\n\n## Risks\n\n- Rollback complexity.\n`,
          },
        };
      },
      invokeSynthesizer: async ({ provider, round, prompt }) => {
        synthesisPrompts.push({ provider, round, prompt });
        return {
          json: {
            schema_version: 'v1',
            synthesized_artifact:
              '## Steps\n\n1. Prepare rollout.\n2. Run staged deployment.\n\n## Dependencies\n\n- Feature flags.\n- Rollback runbook.\n\n## Risks\n\n- Rollback complexity.\n',
            synthesis_reasoning: 'fixture synthesis',
            unresolved_disagreements: [],
          },
        };
      },
    },
  );

  expect(result.loopArgv).toEqual(
    expect.arrayContaining(['--cold-start', 'independent_draft']),
  );
  expect(result.status).toMatchObject({
    status: 'max-rounds',
    cold_start: 'independent_draft',
    iteration_mode: 'parallel_synthesized',
    agency: 'moderate',
    peer_calls: 2,
    synthesis_calls: 1,
  });

  const firstRoundPrompts = peerPrompts.filter((call) => call.round === 1);
  expect(firstRoundPrompts).toHaveLength(2);
  for (const call of firstRoundPrompts) {
    expect(call.artifact).toBe('');
    expect(call.prompt).toContain('<PLAN_GOAL>');
    expect(call.prompt).toContain('<PLAN_CONSTRAINTS>');
    expect(call.prompt).toContain('Migrate the release process');
    expect(call.prompt).toContain('Keep downtime under five minutes');
    expect(call.prompt).toContain('## Steps');
    expect(call.prompt).toContain('## Dependencies');
    expect(call.prompt).toContain('## Risks');
    expect(call.prompt).not.toContain('Current plan draft:');
  }
  expect(synthesisPrompts).toHaveLength(1);
  expect(synthesisPrompts[0].prompt).toContain('unresolved_disagreements');

  const artifact = await readFile(outputPath, 'utf8');
  expect(artifact).toContain('## Steps');
  expect(artifact).toContain('## Dependencies');
  expect(artifact).toContain('## Risks');
  expect(artifact).toContain('<!-- consensus:consensus-resolution');
  expect(artifact).toContain('"kind": "consensus-plan"');
  expect(artifact).toContain('"cold_start": "independent_draft"');
  expect(artifact).toContain('"iteration": "parallel_synthesized"');
  expect(artifact).toContain('"agency": "moderate"');
});
