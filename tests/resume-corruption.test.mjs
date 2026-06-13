import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseDeliberationArtifactForResume,
  parseWrapperArgs
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import { EXIT_CODES, hashArtifact } from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const intro = '# Intro\n\nClear.\n';
const details = '## Details\n\nStill unresolved.\n';

function consensusBlock(label, value) {
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function baseArtifact() {
  const introHash = hashArtifact(intro);
  const detailsHash = hashArtifact(details);
  return [
    '---',
    'consensus_schema_version: v1',
    'status: partial',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'partial'
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
        final_artifact_hash: introHash
      },
      {
        id: 'details-1',
        name: 'Details',
        original_index: 1,
        status: 'max-rounds',
        final_artifact_hash: detailsHash
      }
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (converged)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'converged',
      final_artifact_hash: introHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Updated.',
      proposed_artifact: intro
    }),
    '',
    '### 2. Details (max-rounds)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'max-rounds',
      final_artifact_hash: detailsHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Updated.',
      proposed_artifact: details
    }),
    ''
  ].join('\n');
}

function corruptDetailsStatusArtifact() {
  return baseArtifact().replace(
    /<!-- consensus:consensus-section-status\n\{\n  "schema_version": "v0",\n  "status": "max-rounds",[\s\S]*?\n-->/u,
    '<!-- consensus:consensus-section-status\n{ bad json\n-->'
  );
}

function hashMismatchArtifact() {
  return baseArtifact().replaceAll(hashArtifact(details), hashArtifact('tampered\n'));
}

function missingSectionStatusArtifact() {
  return baseArtifact().replace(
    /\n### 2\. Details \(max-rounds\)[\s\S]*?<!-- consensus:consensus-verdict\n\{\n  "schema_version": "v0",\n  "verdict": "REVISE",\n  "reasoning": "Updated\.",\n  "proposed_artifact": "## Details\\n\\nStill unresolved\.\\n"\n\}\n-->\n/u,
    '\n'
  );
}

test('resume corruption exits as data error and writes diagnostics', async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-corruption-'));

  await assert.rejects(
    parseDeliberationArtifactForResume(corruptDetailsStatusArtifact(), { runDir }),
    (error) => {
      assert.equal(error.exitCode, EXIT_CODES.DATA);
      assert.equal(error.code, 'RESUME_CORRUPT');
      assert.match(error.message, /corrupt resume state/i);
      return true;
    }
  );

  const diagnostics = JSON.parse(await readFile(path.join(runDir, 'resume-errors.json'), 'utf8'));
  assert.equal(diagnostics.consensus_schema_version, 'v1');
  assert.equal(diagnostics.errors[0].section_id, 'details-1');
  assert.equal(diagnostics.errors[0].code, 'RESUME_JSON_CORRUPT');
});

test('resume rejects final artifact hash mismatches and missing section state', async () => {
  await assert.rejects(
    parseDeliberationArtifactForResume(hashMismatchArtifact()),
    /hash mismatch/i
  );
  await assert.rejects(
    parseDeliberationArtifactForResume(missingSectionStatusArtifact()),
    /missing section state/i
  );
});

test('resume can skip explicitly named corrupt sections', async () => {
  const parsed = await parseDeliberationArtifactForResume(hashMismatchArtifact(), {
    skipCorruptSections: ['details-1']
  });

  assert.deepEqual(parsed.skippedCorruptSections.map((section) => section.id), ['details-1']);
  assert.deepEqual(parsed.inFlightSections.map((section) => section.id), []);
  assert.equal(parsed.sections.find((section) => section.id === 'details-1').skipped, true);
});

test('resume supports interactive skip-all and non-interactive yes skip', async () => {
  let prompted = false;
  const interactive = await parseDeliberationArtifactForResume(hashMismatchArtifact(), {
    skipAllCorrupt: true,
    confirmSkipAllCorrupt: async ({ errors }) => {
      prompted = true;
      assert.equal(errors.length, 1);
      return true;
    }
  });
  assert.equal(prompted, true);
  assert.deepEqual(interactive.skippedCorruptSections.map((section) => section.id), ['details-1']);

  let yesPrompted = false;
  const nonInteractive = await parseDeliberationArtifactForResume(hashMismatchArtifact(), {
    yesSkipCorrupt: true,
    confirmSkipAllCorrupt: async () => {
      yesPrompted = true;
      return false;
    }
  });
  assert.equal(yesPrompted, false);
  assert.deepEqual(nonInteractive.skippedCorruptSections.map((section) => section.id), ['details-1']);
});

test('parseWrapperArgs exposes skip-all-corrupt for resume flows', () => {
  const parsed = parseWrapperArgs(['draft.md', '--skip-all-corrupt']);
  assert.equal(parsed.skipAllCorrupt, true);
});

// --- p05-t03: corrupt-section fail-closed for v1 record types -----------

const peerA = '# Intro\n\nPeer A revision.\n';
const peerB = '# Intro\n\nPeer B revision.\n';
const synthText = '# Intro\n\nSynthesized merge.\n';

// A v1 parallel_synthesized two-section artifact: section 0 is a converged
// good section; section 1 carries a peer pair + synthesis + intervention round.
function synthesizedTwoSectionArtifact({
  corruptSynthesis = false,
  corruptIntervention = false,
  dropOnePeer = false
} = {}) {
  const introHash = hashArtifact(intro);
  const synthHash = hashArtifact(synthText);

  const synthesisBlock = corruptSynthesis
    ? '<!-- consensus:consensus-synthesis\n{ bad synthesis json\n-->'
    : consensusBlock('consensus-synthesis', {
        schema_version: 'v1',
        record_type: 'synthesis',
        synthesizer: 'claude',
        synthesized_artifact: synthText,
        synthesis_reasoning: 'Merged.',
        unresolved_disagreements: [],
        artifact_hash: synthHash
      });

  const interventionBlock = corruptIntervention
    ? '<!-- consensus:consensus-verdict\n{ bad intervention json\n-->'
    : consensusBlock('consensus-verdict', {
        schema_version: 'v1',
        verdict: 'HOST_DECISION',
        reasoning: 'Adopt the merge.',
        decision_kind: 'blend',
        escalation_trigger: 'persistent_disagreement'
      });

  const peerBlocks = [
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'Peer A.',
      critique: { own_previous: 'oA', peer_previous: 'pA' },
      proposed_artifact: peerA
    })
  ];
  if (!dropOnePeer) {
    peerBlocks.push(
      consensusBlock('consensus-verdict', {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'Peer B.',
        critique: { own_previous: 'oB', peer_previous: 'pB' },
        proposed_artifact: peerB
      })
    );
  }

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
    intro,
    synthText,
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
      status: 'partial',
      mode: 'sequential',
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      agency: 'moderate',
      peers: ['claude', 'codex']
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
        final_artifact_hash: introHash,
        final_output: intro
      },
      {
        id: 'details-1',
        name: 'Details',
        original_index: 1,
        status: 'escalation',
        final_artifact_hash: synthHash,
        final_output: synthText
      }
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (converged)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v1',
      status: 'converged',
      final_artifact_hash: introHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'ok',
      proposed_artifact: intro
    }),
    '',
    '### 2. Details (escalation)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v1',
      status: 'escalation',
      termination_reason: 'persistent_disagreement',
      iteration_mode: 'parallel_synthesized',
      final_artifact_hash: synthHash
    }),
    '',
    ...peerBlocks,
    '',
    synthesisBlock,
    '',
    interventionBlock,
    ''
  ].join('\n');
}

test('resume fails closed on a corrupt v1 synthesis record', async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-v1-synth-'));
  await assert.rejects(
    parseDeliberationArtifactForResume(synthesizedTwoSectionArtifact({ corruptSynthesis: true }), { runDir }),
    (error) => {
      assert.equal(error.exitCode, EXIT_CODES.DATA);
      assert.equal(error.code, 'RESUME_CORRUPT');
      return true;
    }
  );
});

test('resume fails closed on a corrupt v1 intervention round', async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-v1-intervention-'));
  await assert.rejects(
    parseDeliberationArtifactForResume(synthesizedTwoSectionArtifact({ corruptIntervention: true }), { runDir }),
    (error) => {
      assert.equal(error.code, 'RESUME_CORRUPT');
      return true;
    }
  );
});

test('resume detects a half-missing peer pair before a synthesis record', async () => {
  // A synthesized round whose peer pair is incomplete is fail-closed corrupt state.
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-v1-halfpair-'));
  await assert.rejects(
    parseDeliberationArtifactForResume(synthesizedTwoSectionArtifact({ dropOnePeer: true }), { runDir }),
    (error) => {
      assert.equal(error.code, 'RESUME_CORRUPT');
      return true;
    }
  );

  const diagnostics = JSON.parse(await readFile(path.join(runDir, 'resume-errors.json'), 'utf8'));
  assert.ok(
    diagnostics.errors.some((entry) => entry.code === 'RESUME_PAIR_INCOMPLETE'),
    'incomplete-pair error recorded'
  );
});

test('skip controls behave as v0.1 for corrupt v1 record types', async () => {
  const explicit = await parseDeliberationArtifactForResume(
    synthesizedTwoSectionArtifact({ corruptSynthesis: true }),
    { skipCorruptSections: ['details-1'] }
  );
  assert.deepEqual(explicit.skippedCorruptSections.map((section) => section.id), ['details-1']);
  assert.deepEqual(explicit.completedSections.map((section) => section.id), ['intro-0']);

  const yesSkip = await parseDeliberationArtifactForResume(
    synthesizedTwoSectionArtifact({ corruptIntervention: true }),
    { yesSkipCorrupt: true }
  );
  assert.deepEqual(yesSkip.skippedCorruptSections.map((section) => section.id), ['details-1']);

  let prompted = false;
  const skipAll = await parseDeliberationArtifactForResume(
    synthesizedTwoSectionArtifact({ corruptSynthesis: true }),
    {
      skipAllCorrupt: true,
      confirmSkipAllCorrupt: async () => {
        prompted = true;
        return true;
      }
    }
  );
  assert.equal(prompted, true);
  assert.deepEqual(skipAll.skippedCorruptSections.map((section) => section.id), ['details-1']);
});
