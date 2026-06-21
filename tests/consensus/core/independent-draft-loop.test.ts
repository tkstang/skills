import { expect, it } from 'vitest';

import {
  runConsensusLoop,
  type PeerInvocation,
  type SynthesizerInvocation,
} from '../../../src/consensus/core/consensus-loop.js';
import { makeLoopOptions } from '../../helpers/consensus.js';

it('runs alternating independent_draft as peer A draft then peer B revision', async () => {
  const { options } = await makeLoopOptions({
    iteration: 'alternating',
    coldStart: 'independent_draft',
    sectionText: 'Brief: draft a launch plan.\n',
  });
  const calls: PeerInvocation[] = [];

  const result = await runConsensusLoop(options, {
    invokePeer: async (call) => {
      calls.push(call);
      return {
        json:
          calls.length === 1
            ? {
                schema_version: 'v1',
                verdict: 'REVISE',
                reasoning: 'drafted from the brief',
                proposed_artifact: 'Claude launch plan draft.\n',
              }
            : {
                schema_version: 'v1',
                verdict: 'REVISE',
                reasoning: 'revised the first peer draft',
                proposed_artifact: 'Codex launch plan revision.\n',
              },
      };
    },
  });

  expect(calls).toHaveLength(2);
  expect(calls[0].artifact).toBe('Brief: draft a launch plan.\n');
  expect(calls[0].prompt).toContain('Produce your own draft from this brief');
  expect(calls[1].artifact).toBe('Claude launch plan draft.\n');
  expect(calls[1].prompt).toContain(
    "Revise the first peer's draft against the goal",
  );
  expect(result.output).toBe('Codex launch plan revision.\n');
  expect(result.status.cold_start).toBe('independent_draft');
});

it('runs parallel_revision independent_draft with two independent round-one drafts', async () => {
  const { options } = await makeLoopOptions({
    iteration: 'parallel_revision',
    coldStart: 'independent_draft',
    sectionText: 'Brief: draft release notes.\n',
  });
  const calls: PeerInvocation[] = [];

  const result = await runConsensusLoop(options, {
    invokePeer: async (call) => {
      calls.push(call);
      return {
        json: {
          schema_version: 'v1',
          verdict: 'REVISE',
          reasoning: `${call.provider} drafted independently`,
          proposed_artifact: `${call.provider} release notes draft.\n`,
        },
      };
    },
  });

  expect(calls).toHaveLength(2);
  expect(calls.map((call) => call.artifact)).toEqual([
    'Brief: draft release notes.\n',
    'Brief: draft release notes.\n',
  ]);
  expect(
    calls.every((call) =>
      call.prompt.includes('Produce your own draft from this brief'),
    ),
  ).toBe(true);
  expect(result.output).toBe('codex release notes draft.\n');
  expect(result.status.cold_start).toBe('independent_draft');
});

it('runs parallel_synthesized independent_draft and appends a synthesis record', async () => {
  const { options } = await makeLoopOptions({
    iteration: 'parallel_synthesized',
    coldStart: 'independent_draft',
    sectionText: 'Brief: draft a migration note.\n',
    synthesizer: 'cursor',
  });
  const peerCalls: PeerInvocation[] = [];
  const synthCalls: SynthesizerInvocation[] = [];

  const result = await runConsensusLoop(options, {
    invokePeer: async (call) => {
      peerCalls.push(call);
      return {
        json: {
          schema_version: 'v1',
          verdict: 'REVISE',
          reasoning: `${call.provider} drafted independently`,
          proposed_artifact: `${call.provider} migration note draft.\n`,
        },
      };
    },
    invokeSynthesizer: async (call) => {
      synthCalls.push(call);
      return {
        json: {
          schema_version: 'v1',
          synthesized_artifact: 'Synthesized migration note.\n',
          synthesis_reasoning: 'merged both independent drafts',
          unresolved_disagreements: [],
        },
      };
    },
  });

  expect(peerCalls).toHaveLength(2);
  expect(
    peerCalls.every((call) =>
      call.prompt.includes('Produce your own draft from this brief'),
    ),
  ).toBe(true);
  expect(synthCalls).toHaveLength(1);
  expect(synthCalls[0].provider).toBe('cursor');
  expect(
    result.records.some((record) => record.record_type === 'synthesis'),
  ).toBe(true);
  expect(result.output).toBe('Synthesized migration note.\n');
  expect(result.status.cold_start).toBe('independent_draft');
});
