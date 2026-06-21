import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runConsensusDecide } from '../../../src/consensus/decide/consensus-decide.js';
import { makeProviderCliEnv } from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

it('runs Decide through the consensus loop and surfaces synthesis dissent', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-decide-cli-integration-'),
  );
  const optionsPath = path.join(tempRoot, 'options.md');
  const outputPath = path.join(tempRoot, 'decision.md');
  const runDir = path.join(tempRoot, '.consensus/decide-run');
  await writeFile(
    optionsPath,
    '# Options\n\n- Option A: ship the smaller scope this week.\n- Option B: wait for the broader migration.\n',
  );

  const peerPrompts: JsonRecord[] = [];
  const synthesisPrompts: JsonRecord[] = [];

  const result = await runConsensusDecide(
    [
      '--options',
      optionsPath,
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
            reasoning: `${provider} drafted a decision.`,
            proposed_artifact: `## Recommendation\n\nChoose option A.\n\n## Reasoning\n\n${provider} favors speed.\n\n## Alternatives\n\n- Option B\n\n## Dissent / Unresolved Disagreement\n\n- Risk remains.\n`,
          },
        };
      },
      invokeSynthesizer: async ({ provider, round, prompt }) => {
        synthesisPrompts.push({ provider, round, prompt });
        return {
          json: {
            schema_version: 'v1',
            synthesized_artifact:
              '## Recommendation\n\nChoose option A.\n\n## Reasoning\n\nIt gives the team a reversible path.\n\n## Alternatives\n\n- Option B: wait for the broader migration.\n\n## Dissent / Unresolved Disagreement\n\n- Option B has lower migration risk.\n',
            synthesis_reasoning: 'fixture synthesis',
            unresolved_disagreements: ['Option B has lower migration risk.'],
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
    agency: 'minimal',
    peer_calls: 2,
    synthesis_calls: 1,
  });

  const firstRoundPrompts = peerPrompts.filter((call) => call.round === 1);
  expect(firstRoundPrompts).toHaveLength(2);
  for (const call of firstRoundPrompts) {
    expect(call.artifact).toBe('');
    expect(call.prompt).toContain('<DECISION_OPTIONS>');
    expect(call.prompt).toContain('Option A: ship the smaller scope');
    expect(call.prompt).toContain('## Recommendation');
    expect(call.prompt).toContain('## Dissent / Unresolved Disagreement');
    expect(call.prompt).not.toContain('Current decision draft:');
  }
  expect(synthesisPrompts).toHaveLength(1);
  expect(synthesisPrompts[0].prompt).toContain('unresolved_disagreements');

  const artifact = await readFile(outputPath, 'utf8');
  expect(artifact).toContain('## Recommendation');
  expect(artifact).toContain('## Reasoning');
  expect(artifact).toContain('## Alternatives');
  expect(artifact).toContain('## Dissent / Unresolved Disagreement');
  expect(artifact).toContain('- Option B has lower migration risk.');
  expect(artifact).toContain('<!-- consensus:consensus-resolution');
  expect(artifact).toContain('"kind": "consensus-decide"');
  expect(artifact).toContain('"cold_start": "independent_draft"');
  expect(artifact).toContain('"iteration": "parallel_synthesized"');
  expect(artifact).toContain('"agency": "minimal"');
});
