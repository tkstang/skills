import { expect, it } from 'vitest';

import {
  runConsensusLoop,
  type PeerInvocation,
  type SynthesizerInvocation,
} from '../../../src/consensus/core/consensus-loop.js';
import { makeLoopOptions } from '../../helpers/consensus.js';

it('converges alternating independent_draft when peer B matches peer A draft', async () => {
  const { options } = await makeLoopOptions({
    iteration: 'alternating',
    coldStart: 'independent_draft',
    sectionText: 'Brief: draft a launch plan.\n',
  });
  const calls: PeerInvocation[] = [];
  const convergedDraft = 'Converged launch plan draft.\n';

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
                proposed_artifact: convergedDraft,
              }
            : {
                schema_version: 'v1',
                verdict: 'REVISE',
                reasoning: 'matched the first peer draft',
                proposed_artifact: convergedDraft,
              },
      };
    },
  });

  expect(calls).toHaveLength(2);
  expect(calls[0].artifact).toBe('Brief: draft a launch plan.\n');
  expect(calls[0].prompt).toContain('Produce your own draft from this brief');
  expect(calls[1].artifact).toBe(convergedDraft);
  expect(calls[1].prompt).toContain(
    "Revise the first peer's draft against the goal",
  );
  expect(result.output).toBe(convergedDraft);
  expect(result.status.status).toBe('converged');
  expect(result.status.termination_reason).toBe('hash_match');
  expect(result.status.cold_start).toBe('independent_draft');
});

it('converges parallel_revision independent_draft with matching round-one drafts', async () => {
  const { options } = await makeLoopOptions({
    iteration: 'parallel_revision',
    coldStart: 'independent_draft',
    sectionText: 'Brief: draft release notes.\n',
  });
  const calls: PeerInvocation[] = [];
  const convergedDraft = 'Converged release notes draft.\n';

  const result = await runConsensusLoop(options, {
    invokePeer: async (call) => {
      calls.push(call);
      return {
        json: {
          schema_version: 'v1',
          verdict: 'REVISE',
          reasoning: `${call.provider} drafted independently`,
          proposed_artifact: convergedDraft,
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
  expect(result.output).toBe(convergedDraft);
  expect(result.status.status).toBe('converged');
  expect(result.status.termination_reason).toBe('parallel_hash_match');
  expect(result.status.cold_start).toBe('independent_draft');
});

it('converges parallel_synthesized independent_draft after synthesis stability', async () => {
  const { options } = await makeLoopOptions({
    iteration: 'parallel_synthesized',
    coldStart: 'independent_draft',
    sectionText: 'Brief: draft a migration note.\n',
    synthesizer: 'cursor',
    maxRounds: 2,
  });
  const peerCalls: PeerInvocation[] = [];
  const synthCalls: SynthesizerInvocation[] = [];
  const synthesizedDraft = 'Synthesized migration note.\n';

  const result = await runConsensusLoop(options, {
    invokePeer: async (call) => {
      peerCalls.push(call);
      const proposedArtifact =
        call.round === 1
          ? `${call.provider} migration note draft.\n`
          : synthesizedDraft;
      return {
        json: {
          schema_version: 'v1',
          verdict: 'REVISE',
          reasoning: `${call.provider} drafted independently`,
          proposed_artifact: proposedArtifact,
        },
      };
    },
    invokeSynthesizer: async (call) => {
      synthCalls.push(call);
      return {
        json: {
          schema_version: 'v1',
          synthesized_artifact: synthesizedDraft,
          synthesis_reasoning: 'merged both independent drafts',
          unresolved_disagreements: [],
        },
      };
    },
  });

  expect(peerCalls).toHaveLength(4);
  expect(peerCalls.map((call) => call.artifact)).toEqual([
    'Brief: draft a migration note.\n',
    'Brief: draft a migration note.\n',
    synthesizedDraft,
    synthesizedDraft,
  ]);
  expect(
    peerCalls.slice(0, 2).every((call) =>
      call.prompt.includes('Produce your own draft from this brief'),
    ),
  ).toBe(true);
  expect(synthCalls).toHaveLength(2);
  expect(synthCalls[0].provider).toBe('cursor');
  expect(
    result.records.some((record) => record.record_type === 'synthesis'),
  ).toBe(true);
  expect(result.output).toBe(synthesizedDraft);
  expect(result.status.status).toBe('converged');
  expect(result.status.termination_reason).toBe('synthesis_stability');
  expect(result.status.cold_start).toBe('independent_draft');
});
