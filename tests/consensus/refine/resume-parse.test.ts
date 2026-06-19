import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { EXIT_CODES, hashArtifact, routeEscalation } = consensusLoop;
const { parseDeliberationArtifactForResume, renderDeliberationArtifact } =
  consensusRefine;

type JsonRecord = Record<string, any>;

const revisedIntro = '# Intro\n\nClearer intro.\n';
const stalledDetails = '## Details\n\nStill unresolved.\n';
const acceptedIntro = '# Intro\n\nOld stable text.\n';
const strictHashOptions = {
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false,
};

function consensusBlock(label: string, value: unknown) {
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function artifact({ schemaVersion = 'v1' } = {}) {
  const introHash = hashArtifact(revisedIntro);
  const detailsHash = hashArtifact(stalledDetails);
  return [
    '---',
    `consensus_schema_version: ${schemaVersion}`,
    'status: partial',
    'mode: sequential',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    revisedIntro,
    stalledDetails,
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'partial',
      mode: 'sequential',
      parallel: false,
      peers: ['claude', 'codex'],
    }),
    '',
    '## Section States',
    '',
    consensusBlock('consensus-section-states', [
      {
        id: 'intro-0',
        name: 'Intro',
        original_index: 0,
        status: 'converged',
        turns: 2,
        rounds: 1,
        final_artifact_hash: introHash,
      },
      {
        id: 'details-1',
        name: 'Details',
        original_index: 1,
        status: 'max-rounds',
        turns: 3,
        rounds: 2,
        final_artifact_hash: detailsHash,
      },
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (converged)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'converged',
      termination_reason: 'hash_match',
      turns: 2,
      rounds: 1,
      final_artifact_hash: introHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Tightened.',
      proposed_artifact: revisedIntro,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Good.',
    }),
    '',
    '### 2. Details (max-rounds)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'max-rounds',
      termination_reason: 'max_rounds_exhausted',
      turns: 3,
      rounds: 2,
      final_artifact_hash: detailsHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Needs more specificity.',
      proposed_artifact: stalledDetails,
    }),
    '',
  ].join('\n');
}

function acceptOnlyArtifact() {
  const introHash = hashArtifact(acceptedIntro);
  return [
    '---',
    'consensus_schema_version: v1',
    'status: converged',
    'mode: sequential',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    acceptedIntro,
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'converged',
      mode: 'sequential',
      parallel: false,
      peers: ['claude', 'codex'],
    }),
    '',
    '## Section States',
    '',
    consensusBlock('consensus-section-states', [
      {
        id: 'intro-0',
        name: 'Intro',
        original_index: 0,
        status: 'converged',
        turns: 2,
        rounds: 1,
        final_artifact_hash: introHash,
        final_output: acceptedIntro,
      },
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (converged)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'converged',
      termination_reason: 'accept_twice',
      turns: 2,
      rounds: 1,
      final_artifact_hash: introHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Stable.',
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Still stable.',
    }),
    '',
  ].join('\n');
}

function minimalAgencyArtifactWithTrailingWhitespace() {
  const output = '# Intro\n\nKeep trailing spaces here.  \n';
  const outputHash = hashArtifact(output, strictHashOptions);
  return [
    '---',
    'consensus_schema_version: v1',
    'status: converged',
    'mode: sequential',
    'agency: minimal',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    output,
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'converged',
      mode: 'sequential',
      parallel: false,
      agency: 'minimal',
      peers: ['claude', 'codex'],
    }),
    '',
    '## Section States',
    '',
    consensusBlock('consensus-section-states', [
      {
        id: 'intro-0',
        name: 'Intro',
        original_index: 0,
        status: 'converged',
        turns: 2,
        rounds: 1,
        final_artifact_hash: outputHash,
        final_output: output,
      },
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (converged)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'converged',
      termination_reason: 'accept_twice',
      turns: 2,
      rounds: 1,
      final_artifact_hash: outputHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Preserve whitespace for strict mode.',
      proposed_artifact: output,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Strict bytes match.',
    }),
    '',
  ].join('\n');
}

it('parseDeliberationArtifactForResume reads frontmatter and canonical state blocks from text', async () => {
  const parsed = await parseDeliberationArtifactForResume(artifact());

  expect(parsed.consensusSchemaVersion).toBe('v1');
  expect(parsed.frontmatter.status).toBe('partial');
  expect(parsed.resolution.mode).toBe('sequential');
  expect(parsed.sectionStates.map((section: JsonRecord) => section.id)).toEqual(
    ['intro-0', 'details-1'],
  );
  expect(
    parsed.sections.map((section: JsonRecord) => ({
      id: section.id,
      completed: section.completed,
      inFlight: section.inFlight,
      recordCount: section.records.length,
    })),
  ).toEqual([
    { id: 'intro-0', completed: true, inFlight: false, recordCount: 2 },
    { id: 'details-1', completed: false, inFlight: true, recordCount: 1 },
  ]);
  expect(
    parsed.inFlightSections.map((section: JsonRecord) => section.id),
  ).toEqual(['details-1']);
});

it('parseDeliberationArtifactForResume uses canonical final output for ACCEPT-only completed sections', async () => {
  const parsed = await parseDeliberationArtifactForResume(acceptOnlyArtifact());

  expect(parsed.sections[0].resumedArtifact).toBe(acceptedIntro);
  expect(parsed.sections[0].resumedArtifactHash).toBe(
    hashArtifact(acceptedIntro),
  );
});

it('parseDeliberationArtifactForResume validates minimal-agency hashes bytewise', async () => {
  const output = '# Intro\n\nKeep trailing spaces here.  \n';
  const parsed = await parseDeliberationArtifactForResume(
    minimalAgencyArtifactWithTrailingWhitespace(),
  );

  expect(parsed.resolution.agency).toBe('minimal');
  expect(parsed.sections[0].resumedArtifact).toBe(output);
  expect(parsed.sections[0].resumedArtifactHash).toBe(
    hashArtifact(output, strictHashOptions),
  );
});

it('parseDeliberationArtifactForResume accepts a file path input', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'resume-parse-'));
  const artifactPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(artifactPath, artifact());

  const parsed = await parseDeliberationArtifactForResume(artifactPath);

  expect(parsed.sourcePath).toBe(artifactPath);
  expect(parsed.sections.length).toBe(2);
});

it('parseDeliberationArtifactForResume rejects unsupported schema versions', async () => {
  await expect(
    parseDeliberationArtifactForResume(artifact({ schemaVersion: 'v9' })),
  ).rejects.toThrow(/consensus_schema_version/i);
});

// p05-t05: only v1 artifacts resume. A v0 artifact is rejected fail-closed with
// SCHEMA_VERSION_MISMATCH (exit DATA) and a message naming v0, v1, and the
// no-migration policy. v0 artifacts must be completed under v0.1 or restarted.
it('parseDeliberationArtifactForResume rejects v0 artifacts with no migration', async () => {
  await expect(
    parseDeliberationArtifactForResume(artifact({ schemaVersion: 'v0' })),
  ).rejects.toSatisfy((error: any) => {
    expect(error.code).toBe('SCHEMA_VERSION_MISMATCH');
    expect(error.exitCode).toBe(EXIT_CODES.DATA);
    expect(error.message).toMatch(/v0/);
    expect(error.message).toMatch(/v1/);
    expect(error.message).toMatch(/no migration|not migrat/i);
    return true;
  });
});

const peerRevisionA = '# Intro\n\nPeer A revision.\n';
const peerRevisionB = '# Intro\n\nPeer B revision.\n';
const synthesizedText = '# Intro\n\nSynthesized merge.\n';

// A v1 parallel_synthesized artifact: a peer pair (with critiques), a synthesis
// record carrying the synthesized text + its hash, then a host-orchestrator
// intervention round. The section's canonical hash is the synthesized text.
function synthesizedArtifact({ tamperSynthesisHash = false } = {}) {
  const synthHash = hashArtifact(synthesizedText);
  return [
    '---',
    'consensus_schema_version: v1',
    'status: partial',
    'mode: sequential',
    'iteration: parallel_synthesized',
    'synthesizer: claude',
    'agency: moderate',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    synthesizedText,
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'partial',
      mode: 'sequential',
      parallel: false,
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      agency: 'moderate',
      peers: ['claude', 'codex'],
    }),
    '',
    '## Section States',
    '',
    consensusBlock('consensus-section-states', [
      {
        id: 'intro-0',
        name: 'Intro',
        original_index: 0,
        status: 'escalation',
        turns: 2,
        rounds: 1,
        final_artifact_hash: synthHash,
        final_output: synthesizedText,
      },
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (escalation)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v1',
      status: 'escalation',
      termination_reason: 'persistent_disagreement',
      turns: 2,
      rounds: 1,
      iteration_mode: 'parallel_synthesized',
      synthesizer: 'claude',
      final_artifact_hash: synthHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'Peer A revises.',
      critique: { own_previous: 'own A', peer_previous: 'peer A' },
      proposed_artifact: peerRevisionA,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'Peer B revises.',
      critique: { own_previous: 'own B', peer_previous: 'peer B' },
      proposed_artifact: peerRevisionB,
    }),
    '',
    consensusBlock('consensus-synthesis', {
      schema_version: 'v1',
      record_type: 'synthesis',
      synthesizer: 'claude',
      synthesized_artifact: synthesizedText,
      synthesis_reasoning: 'Merged both revisions.',
      unresolved_disagreements: ['Heading capitalization unresolved.'],
      artifact_hash: tamperSynthesisHash
        ? hashArtifact('tampered\n')
        : synthHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'HOST_DECISION',
      reasoning: 'Adopt the merge.',
      decision_kind: 'blend',
      escalation_trigger: 'persistent_disagreement',
    }),
    '',
  ].join('\n');
}

it('parseDeliberationArtifactForResume round-trips parallel_synthesized canonical blocks', async () => {
  const parsed = await parseDeliberationArtifactForResume(
    synthesizedArtifact(),
  );

  // Mode, synthesizer, and agency restored from the resolution block.
  expect(parsed.resolution.iteration).toBe('parallel_synthesized');
  expect(parsed.resolution.synthesizer).toBe('claude');
  expect(parsed.resolution.agency).toBe('moderate');

  const [section] = parsed.sections;
  expect(section.inFlight).toBe(true);

  // The record stream preserves the peer pair, the synthesis record, and the
  // attributed intervention round so the loop can derive resume state.
  const synthesis = section.records.find(
    (record: JsonRecord) => record.record_type === 'synthesis',
  );
  expect(synthesis, 'synthesis record preserved in resume stream').toBeTruthy();
  expect(synthesis.synthesized_artifact).toBe(synthesizedText);
  expect(synthesis.schema_version).toBe('v1');

  const hostRound = section.records.find(
    (record: JsonRecord) => record.verdict === 'HOST_DECISION',
  );
  expect(
    hostRound,
    'intervention round preserved in resume stream',
  ).toBeTruthy();
  expect(hostRound.agent).toBe('host-orchestrator');

  // The synthesized text is the section's resumable artifact.
  expect(section.resumedArtifact).toBe(synthesizedText);
  expect(section.resumedArtifactHash).toBe(hashArtifact(synthesizedText));
});

it('parseDeliberationArtifactForResume fails closed on a tampered synthesis hash', async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-synth-corrupt-'));
  await expect(
    parseDeliberationArtifactForResume(
      synthesizedArtifact({ tamperSynthesisHash: true }),
      { runDir },
    ),
  ).rejects.toSatisfy((error: any) => {
    expect(error.code).toBe('RESUME_CORRUPT');
    return true;
  });
});

// p05-t02: a pending-synthesis artifact (committed peer pair, no synthesis block)
// round-trips with the pair preserved and the section in-flight, so the loop can
// derive the pending-synthesis state from the resumed record stream.
function pendingSynthesisArtifact() {
  const pairHash = hashArtifact(peerRevisionB);
  return [
    '---',
    'consensus_schema_version: v1',
    'status: partial',
    'mode: sequential',
    'iteration: parallel_synthesized',
    'synthesizer: claude',
    'agency: moderate',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    peerRevisionB,
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'partial',
      mode: 'sequential',
      parallel: false,
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      agency: 'moderate',
      peers: ['claude', 'codex'],
    }),
    '',
    '## Section States',
    '',
    consensusBlock('consensus-section-states', [
      {
        id: 'intro-0',
        name: 'Intro',
        original_index: 0,
        status: 'max-rounds',
        turns: 2,
        rounds: 1,
        final_artifact_hash: pairHash,
        final_output: peerRevisionB,
      },
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (max-rounds)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v1',
      status: 'max-rounds',
      termination_reason: 'pending_synthesis',
      turns: 2,
      rounds: 1,
      iteration_mode: 'parallel_synthesized',
      final_artifact_hash: pairHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'Peer A revises.',
      critique: { own_previous: 'own A', peer_previous: 'peer A' },
      proposed_artifact: peerRevisionA,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'Peer B revises.',
      critique: { own_previous: 'own B', peer_previous: 'peer B' },
      proposed_artifact: peerRevisionB,
    }),
    '',
  ].join('\n');
}

it('parseDeliberationArtifactForResume derives pending-synthesis from a pair without synthesis', async () => {
  const parsed = await parseDeliberationArtifactForResume(
    pendingSynthesisArtifact(),
  );
  const [section] = parsed.sections;

  expect(section.inFlight).toBe(true);
  const peerRevisions = section.records.filter(
    (record: JsonRecord) => record.record_type !== 'synthesis',
  );
  expect(peerRevisions.length, 'committed peer pair preserved').toBe(2);
  expect(
    section.records.some(
      (record: JsonRecord) => record.record_type === 'synthesis',
    ),
    'no synthesis record present (pending-synthesis)',
  ).toBe(false);
});

// Regression (p07-t05): renderRecord must persist HOST_DECISION routing metadata so
// genuinely-stuck promotion stays restart-safe across a resume. Previously the
// canonical consensus-verdict block dropped decision_kind/escalation_trigger, so a
// re-fired trigger after a host decision routed back to the host instead of the user.
function hostDecisionRunResult() {
  const revision = '# Section\n\nMerged revision.\n';
  return {
    goal: 'Resolve the contested section.',
    agency: 'moderate',
    peers: ['claude', 'codex'],
    host: 'claude',
    maxRounds: 12,
    mode: 'sequential',
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    status: 'escalation',
    sections: [
      {
        id: 's0',
        name: 'Section',
        original_index: 0,
        output: revision,
        subagent_id: null,
        status: {
          status: 'escalation',
          rounds: 2,
          turns: 4,
          peer_calls: 4,
          synthesis_calls: 2,
          termination_reason: 'escalation',
          final_artifact_hash: hashArtifact(revision),
        },
        records: [
          {
            schema_version: 'v1',
            turn_index: 3,
            round_index: 2,
            agent: 'claude',
            verdict: 'REVISE',
            reasoning: 'Still diverging.',
            proposed_artifact: revision,
          },
          {
            schema_version: 'v1',
            turn_index: 4,
            round_index: 2,
            agent: 'host-orchestrator',
            verdict: 'HOST_DECISION',
            reasoning: 'Blend the two revisions and continue.',
            decision_kind: 'blend',
            escalation_trigger: 'persistent_disagreement',
            iteration_mode: 'parallel_synthesized',
          },
        ],
      },
    ],
  };
}

function extractVerdictBlocks(artifactText: string) {
  return [
    ...artifactText.matchAll(
      /<!-- consensus:consensus-verdict\n([\s\S]*?)\n-->/g,
    ),
  ].map((match) => JSON.parse(match[1]));
}

it('renderDeliberationArtifact persists HOST_DECISION routing metadata in the canonical block', () => {
  const artifact = renderDeliberationArtifact(hostDecisionRunResult());
  const hostBlock = extractVerdictBlocks(artifact).find(
    (block) => block.verdict === 'HOST_DECISION',
  );

  expect(hostBlock, 'HOST_DECISION verdict block is rendered').toBeTruthy();
  expect(hostBlock.decision_kind).toBe('blend');
  expect(hostBlock.escalation_trigger).toBe('persistent_disagreement');
});

it('rendered HOST_DECISION rehydrates so a re-fired trigger promotes to the user', () => {
  const artifact = renderDeliberationArtifact(hostDecisionRunResult());
  const hostBlock = extractVerdictBlocks(artifact).find(
    (block) => block.verdict === 'HOST_DECISION',
  );

  // The rehydrated record (canonical block JSON, as normalizeResumeRecords spreads it)
  // must carry escalation_trigger so priorHostDecisionForTrigger matches on repeat fire.
  const route = routeEscalation('persistent_disagreement', 'moderate', [
    hostBlock,
  ]);

  expect(route.decide_via).toBe('user');
  expect(route.promoted_from).toBe('host');
  expect(route.promotion_reason).toBe('repeat_fire');
});

it('rendered defer_to_user HOST_DECISION promotes with a defer reason on re-fire', () => {
  const runResult = hostDecisionRunResult();
  runResult.sections[0].records[1].decision_kind = 'defer_to_user';
  const artifact = renderDeliberationArtifact(runResult);
  const hostBlock = extractVerdictBlocks(artifact).find(
    (block) => block.verdict === 'HOST_DECISION',
  );

  expect(hostBlock.decision_kind).toBe('defer_to_user');
  const route = routeEscalation('persistent_disagreement', 'moderate', [
    hostBlock,
  ]);
  expect(route.decide_via).toBe('user');
  expect(route.promotion_reason).toBe('defer_to_user');
});
