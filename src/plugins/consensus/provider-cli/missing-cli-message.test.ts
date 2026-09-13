import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  consensusProviderCliMissingError,
  consensusSharedCliPath,
  type ConsensusError,
} from '../../../src/consensus/core/consensus-loop.js';
import { runConsensusCreate } from '../../../src/consensus/create/consensus-create.js';
import { runConsensusDecide } from '../../../src/consensus/decide/consensus-decide.js';
import { runConsensusEvaluate } from '../../../src/consensus/evaluate/consensus-evaluate.js';
import { runConsensusPlan } from '../../../src/consensus/plan/consensus-plan.js';
import { runSequential } from '../../../src/consensus/refine/consensus-refine.js';

interface WrapperCase {
  name: string;
  run: (context: MissingCliContext) => Promise<unknown>;
}

interface MissingCliContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  draftPath: string;
  artifactPath: string;
  rubricPath: string;
  optionsPath: string;
}

function isolatedEnv(home: string): NodeJS.ProcessEnv {
  return {
    HOME: home,
    PATH: process.env.PATH,
  };
}

async function createContext(): Promise<MissingCliContext> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'consensus-missing-cli-'));
  const home = path.join(cwd, 'home');
  await mkdir(home, { recursive: true });

  const draftPath = path.join(cwd, 'draft.md');
  const artifactPath = path.join(cwd, 'artifact.md');
  const rubricPath = path.join(cwd, 'rubric.md');
  const optionsPath = path.join(cwd, 'options.md');
  await Promise.all([
    writeFile(draftPath, '# Draft\n\nKeep this text.\n'),
    writeFile(artifactPath, '# Artifact\n\nA thing to evaluate.\n'),
    writeFile(rubricPath, '# Rubric\n\n- Check clarity.\n'),
    writeFile(optionsPath, '# Options\n\n## A\n\nFirst.\n\n## B\n\nSecond.\n'),
  ]);

  return {
    cwd,
    env: isolatedEnv(home),
    draftPath,
    artifactPath,
    rubricPath,
    optionsPath,
  };
}

function assertMissingCliError(error: unknown) {
  const thrown = error as ConsensusError;
  expect(thrown.code).toBe('CONSENSUS_PROVIDER_CLI_MISSING');
  expect(thrown.message).toContain('Install the consensus plugin');
  expect(thrown.message).toContain('run the pinned install.sh installer');
  expect(thrown.message).toContain('README');
  expect(thrown.message).toContain('~/.consensus/consensus.mjs');
  return thrown.message;
}

const wrappers: WrapperCase[] = [
  {
    name: 'refine',
    run: ({ cwd, env, draftPath }) =>
      runSequential({
        cwd,
        env,
        inputPath: draftPath,
        goal: 'Tighten the draft.',
        output: path.join(cwd, 'refine-output.md'),
        runDir: path.join(cwd, '.consensus', 'refine-run'),
        allowRoot: cwd,
      }),
  },
  {
    name: 'evaluate',
    run: ({ cwd, env, artifactPath, rubricPath }) =>
      runConsensusEvaluate({
        cwd,
        env,
        artifactPath,
        rubricPath,
        output: path.join(cwd, 'evaluate-output.md'),
        runDir: path.join(cwd, '.consensus', 'evaluate-run'),
        allowRoot: cwd,
      }),
  },
  {
    name: 'decide',
    run: ({ cwd, env, optionsPath }) =>
      runConsensusDecide({
        cwd,
        env,
        optionsPath,
        output: path.join(cwd, 'decide-output.md'),
        runDir: path.join(cwd, '.consensus', 'decide-run'),
        allowRoot: cwd,
      }),
  },
  {
    name: 'plan',
    run: ({ cwd, env }) =>
      runConsensusPlan({
        cwd,
        env,
        goal: 'Plan a tiny rollout.',
        output: path.join(cwd, 'plan-output.md'),
        runDir: path.join(cwd, '.consensus', 'plan-run'),
        allowRoot: cwd,
      }),
  },
  {
    name: 'create',
    run: ({ cwd, env }) =>
      runConsensusCreate({
        cwd,
        env,
        brief: 'Draft a short announcement.',
        output: path.join(cwd, 'create-output.md'),
        runDir: path.join(cwd, '.consensus', 'create-run'),
        allowRoot: cwd,
      }),
  },
];

describe('missing consensus provider CLI message', () => {
  it('is shared across refine, evaluate, decide, plan, and create wrappers', async () => {
    const context = await createContext();
    try {
      const sharedMessage = consensusProviderCliMissingError({
        attemptedPaths: [
          path.join(context.cwd, 'missing-plugin', 'consensus.mjs'),
          consensusSharedCliPath(context.env.HOME),
        ],
      }).message;
      const messages: string[] = [];

      for (const wrapper of wrappers) {
        try {
          await wrapper.run(context);
          throw new Error(`${wrapper.name} unexpectedly resolved a CLI`);
        } catch (error) {
          messages.push(assertMissingCliError(error));
        }
      }

      expect(new Set(messages).size).toBe(1);
      expect(messages[0]).toBe(sharedMessage);
    } finally {
      await rm(context.cwd, { recursive: true, force: true });
    }
  });
});
