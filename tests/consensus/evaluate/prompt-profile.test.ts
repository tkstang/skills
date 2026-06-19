import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runConsensusLoop } from '../../../src/consensus/core/consensus-loop.js';
import type {
  LoopOptions,
  LoopRecord,
  LoopStatus,
  ParallelTurnPromptInput,
  PromptProfile,
  RunOptions,
  SynthesisPromptInput,
  TerminalStatus,
  TurnPromptInput,
} from '../../../src/consensus/core/consensus-loop.js';

const typedPromptProfile: PromptProfile = {
  buildTurnPrompt(input: TurnPromptInput) {
    return `${input.provider}:${input.round}:${input.artifact}`;
  },
  buildParallelTurnPrompt(input: ParallelTurnPromptInput) {
    return `${input.provider}:${input.mode ?? 'parallel_revision'}:${input.artifact}`;
  },
  buildSynthesisPrompt(input: SynthesisPromptInput) {
    return `${input.provider}:${input.revisionA.text ?? ''}:${(input.priorUnresolved ?? []).join(',')}`;
  },
};

const typedRunOptions: RunOptions = {
  initialRecords: [] satisfies LoopRecord[],
  promptProfile: typedPromptProfile,
};
const typedStatus: TerminalStatus = { status: 'converged' };

function acceptLoopStatus(status: LoopStatus): TerminalStatus {
  return status;
}

async function runParallelWithPrompts({
  promptProfile,
}: {
  promptProfile?: PromptProfile;
} = {}) {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-prompt-profile-'),
  );
  const sectionFile = path.join(tempRoot, 'section.md');
  await writeFile(sectionFile, 'The file input should not be read.\n');

  const prompts: string[] = [];
  const result = await runConsensusLoop(
    {
      sectionFile,
      goal: 'Judge the artifact against a rubric.',
      peers: ['claude', 'codex'],
      maxRounds: 1,
      iteration: 'parallel_revision',
      coldStart: 'shared_input',
      agency: 'moderate',
      synthesizer: null,
      outputRecords: path.join(tempRoot, 'records.json'),
      outputSection: path.join(tempRoot, 'section.out.md'),
      outputStatus: path.join(tempRoot, 'status.json'),
    } satisfies LoopOptions,
    {
      initialArtifact: 'Initial artifact.\n',
      now: () => '2026-06-17T00:00:00.000Z',
      promptProfile,
      invokePeer: async (turn) => {
        prompts.push(turn.prompt);
        return {
          stdout: JSON.stringify({ prompt: turn.prompt }),
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: `${turn.provider} revised from the supplied prompt.`,
            proposed_artifact: 'Shared evaluation.\n',
          },
        };
      },
    },
  );

  return { prompts, result };
}

it('uses a custom parallel prompt builder when a prompt profile is supplied', async () => {
  const builderInputs: ParallelTurnPromptInput[] = [];
  const promptProfile: PromptProfile = {
    buildParallelTurnPrompt(input) {
      builderInputs.push(input);
      return [
        'profile-parallel-prompt',
        `provider=${input.provider}`,
        `round=${input.round}`,
        `turn=${input.turn}`,
        `artifact=${input.artifact}`,
      ].join('\n');
    },
  };

  const { prompts, result } = await runParallelWithPrompts({ promptProfile });

  expect(result.status.status).toBe('converged');
  expect(builderInputs.map((input) => input.provider)).toEqual([
    'claude',
    'codex',
  ]);
  expect(builderInputs.map((input) => input.turn)).toEqual([1, 2]);
  expect(
    builderInputs.every((input) => input.artifact === 'Initial artifact.\n'),
  ).toBe(true);
  expect(prompts).toHaveLength(2);
  expect(
    prompts.every((prompt) => prompt.includes('profile-parallel-prompt')),
  ).toBe(true);
  expect(
    prompts.every((prompt) => prompt.includes('Independently revise')),
  ).toBe(false);
});

it('uses default prompt builders when no prompt profile is supplied', async () => {
  const { prompts, result } = await runParallelWithPrompts();

  expect(result.status.status).toBe('converged');
  expect(prompts).toHaveLength(2);
  expect(prompts[0]).toContain(
    'You are claude participating in consensus deliberation',
  );
  expect(prompts[1]).toContain(
    'You are codex participating in consensus deliberation',
  );
  expect(
    prompts.every((prompt) =>
      prompt.includes('Your task: Independently revise the section'),
    ),
  ).toBe(true);
  expect(
    prompts.every((prompt) => prompt.includes('profile-parallel-prompt')),
  ).toBe(false);
});

it('exposes loop-facing types for wrapper consumers', () => {
  expect(typeof typedPromptProfile.buildParallelTurnPrompt).toBe('function');
  expect(typedRunOptions.promptProfile).toBe(typedPromptProfile);
  expect(acceptLoopStatus(typedStatus).status).toBe('converged');
});
