// Regression coverage for the standalone loop's DEFAULT peer invoker.
//
// The convergence wrappers install their own `invokePeer` (see
// `providerCliLoopInvokers` in create/decide/plan/evaluate), so their outgoing
// `consensus run` requests carried the configured model/effort. The parallel
// section path does not: refine's `prepare_parallel` packets hand `loop_argv` to
// the host, which executes the generated standalone `consensus-loop.mjs`, and
// that dispatch always uses `runConsensusLoop`'s default invoker. That invoker
// previously passed only provider/schema/prompt, so every parallel section
// request went out with `model: null, effort: null`.
//
// These tests execute the GENERATED loop runtime on purpose: the defect only
// exists on the standalone/installed dispatch path, and the assertions read the
// provider CLI fixture's recorded run calls so they observe the request that
// actually left the loop.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../../plugins/consensus/scripts/consensus-loop.mjs';
import {
  makeProviderCliEnv,
  parseJsonl,
} from '../../../../tests/helpers/process.mjs';

const { runConsensusLoop } = consensusLoop as {
  runConsensusLoop: (
    argv: string[],
    runOptions?: Record<string, unknown>,
  ) => Promise<unknown>;
};

type JsonRecord = Record<string, any>;

interface DispatchContext {
  callsPath: string;
  argvFor: (peerArgv: string[], extra?: string[]) => string[];
  runCalls: () => Promise<JsonRecord[]>;
  env: NodeJS.ProcessEnv;
}

async function withDispatchContext(
  fn: (context: DispatchContext) => Promise<void>,
  envOverrides: NodeJS.ProcessEnv = {},
) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-standalone-dispatch-'),
  );
  const sectionPath = path.join(root, 'section.md');
  const callsPath = path.join(root, 'calls.jsonl');
  await writeFile(sectionPath, 'Initial section.\n');

  const env = makeProviderCliEnv({
    CONSENSUS_STUB_PROVIDERS: 'claude,codex',
    CONSENSUS_STUB_CALLS_JSONL: callsPath,
    CONSENSUS_STUB_VERDICT: 'ACCEPT',
    ...envOverrides,
  });

  await fn({
    callsPath,
    env,
    argvFor: (peerArgv, extra = []) => [
      '--section-file',
      sectionPath,
      '--goal',
      'Make this clearer.',
      ...peerArgv,
      '--max-rounds',
      '1',
      '--agency',
      'moderate',
      '--output-records',
      path.join(root, 'records.json'),
      '--output-section',
      path.join(root, 'output.md'),
      '--output-status',
      path.join(root, 'status.json'),
      ...extra,
    ],
    runCalls: async () =>
      parseJsonl<JsonRecord>(await readFile(callsPath, 'utf8')).filter(
        (call) => call.event === 'run',
      ),
  });
}

describe('standalone loop default peer invoker', () => {
  it('sends each peer its own model and effort on the alternating path', async () => {
    await withDispatchContext(async (context) => {
      await runConsensusLoop(
        context.argvFor(['--peers', 'claude:configured-model:high,codex']),
        { env: context.env },
      );

      const runs = await context.runCalls();
      expect(runs.length).toBeGreaterThan(0);
      const claude = runs.find((call) => call.provider === 'claude');
      const codex = runs.find((call) => call.provider === 'codex');
      expect(claude).toMatchObject({
        model: 'configured-model',
        effort: 'high',
      });
      // An unselected peer keeps sending nothing, so the provider CLI applies
      // its own defaults.
      expect(codex).toMatchObject({ model: null, effort: null });
    });
  });

  it('sends each peer its own model and effort on the parallel path', async () => {
    await withDispatchContext(
      async (context) => {
        await runConsensusLoop(
          context.argvFor(
            ['--peers', 'claude:configured-model:high,codex::medium'],
            ['--iteration', 'parallel_revision'],
          ),
          { env: context.env },
        );

        const runs = await context.runCalls();
        expect(runs.length).toBeGreaterThan(0);
        expect(runs.find((call) => call.provider === 'claude')).toMatchObject({
          model: 'configured-model',
          effort: 'high',
        });
        expect(runs.find((call) => call.provider === 'codex')).toMatchObject({
          model: null,
          effort: 'medium',
        });
      },
      { CONSENSUS_STUB_VERDICT: 'CONVERGED' },
    );
  });

  it('carries a model id containing the peer-spec delimiters through --peer-agents', async () => {
    await withDispatchContext(async (context) => {
      await runConsensusLoop(
        context.argvFor([
          '--peers',
          'claude,codex',
          '--peer-agents',
          JSON.stringify([
            {
              provider: 'claude',
              model: 'us.anthropic.claude-sonnet-4-5-v1:0',
              effort: 'high',
            },
            { provider: 'codex', model: 'gpt-x,fallback' },
          ]),
        ]),
        { env: context.env },
      );

      const runs = await context.runCalls();
      expect(runs.find((call) => call.provider === 'claude')).toMatchObject({
        model: 'us.anthropic.claude-sonnet-4-5-v1:0',
        effort: 'high',
      });
      expect(runs.find((call) => call.provider === 'codex')).toMatchObject({
        model: 'gpt-x,fallback',
        effort: null,
      });
    });
  });
});
