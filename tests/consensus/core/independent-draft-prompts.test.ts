import { expect, it } from 'vitest';

import {
  buildParallelTurnPrompt,
  buildTurnPrompt,
} from '../../../src/consensus/core/consensus-loop.js';

it('keeps shared_input round-one parallel prompts framed as revision of a shared artifact', () => {
  const prompt = buildParallelTurnPrompt({
    provider: 'claude',
    mode: 'parallel_revision',
    coldStart: 'shared_input',
    round: 1,
    turn: 1,
    goal: 'Improve the draft.',
    artifact: 'Existing draft.\n',
  });

  expect(prompt).toContain('untrusted document content');
  expect(prompt).toContain('Your task: Independently revise the section');
  expect(prompt).toContain('Your previous revision:\nnone');
  expect(prompt).not.toContain('Produce your own draft from this brief');
});

it('frames independent_draft round-one parallel prompts as drafting from an untrusted brief', () => {
  const prompt = buildParallelTurnPrompt({
    provider: 'codex',
    mode: 'parallel_synthesized',
    coldStart: 'independent_draft',
    round: 1,
    turn: 2,
    goal: 'Create a release note.',
    artifact: 'Brief: summarize the launch.\n',
  });

  expect(prompt).toContain('untrusted brief');
  expect(prompt).toContain('<SECTION>\nBrief: summarize the launch.');
  expect(prompt).toContain('Produce your own draft from this brief');
  expect(prompt).toContain('Your previous revision:\nnone');
  expect(prompt).not.toContain('Independently revise the section');
});

it('returns independent_draft parallel prompts to revision framing after round one', () => {
  const prompt = buildParallelTurnPrompt({
    provider: 'claude',
    mode: 'parallel_revision',
    coldStart: 'independent_draft',
    round: 2,
    turn: 3,
    goal: 'Create a release note.',
    artifact: 'Synthesized draft.\n',
    ownPreviousRevision: 'Claude draft.',
    peerPreviousRevision: 'Codex draft.',
  });

  expect(prompt).toContain('untrusted document content');
  expect(prompt).toContain('Your task: Independently revise the section');
  expect(prompt).toContain('Your previous revision:\nClaude draft.');
  expect(prompt).toContain("The other peer's previous revision:\nCodex draft.");
  expect(prompt).not.toContain('Produce your own draft from this brief');
});

it('frames alternating independent_draft turn one as drafting from the brief', () => {
  const prompt = buildTurnPrompt({
    provider: 'claude',
    peerIndex: 0,
    coldStart: 'independent_draft',
    round: 1,
    turn: 1,
    goal: 'Create a rollout plan.',
    artifact: 'Brief: launch the feature safely.\n',
  });

  expect(prompt).toContain('untrusted brief');
  expect(prompt).toContain('Produce your own draft from this brief');
  expect(prompt).toContain('None - you are first');
  expect(prompt).not.toContain('Review the section against the goal');
});

it('documents alternating independent_draft turn two as revising the first peer draft', () => {
  const prompt = buildTurnPrompt({
    provider: 'codex',
    peerIndex: 1,
    coldStart: 'independent_draft',
    round: 1,
    turn: 2,
    goal: 'Create a rollout plan.',
    artifact: 'Peer A rollout draft.\n',
    previousVerdict: {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'first draft',
      proposed_artifact: 'Peer A rollout draft.\n',
    },
  });

  expect(prompt).toContain('untrusted document content');
  expect(prompt).toContain("Revise the first peer's draft against the goal");
  expect(prompt).toContain('Peer A rollout draft.');
  expect(prompt).not.toContain('Produce your own draft from this brief');
});
