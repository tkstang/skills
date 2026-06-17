import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { EXIT_CODES, hashArtifact } = consensusLoop;
const { parseDeliberationArtifactForResume, parseWrapperArgs } =
  consensusRefine;

type JsonRecord = Record<string, any>;

const intro = '# Intro\n\nClear.\n';
const details = '## Details\n\nStill unresolved.\n';

function consensusBlock(label: string, value: unknown) {
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
      status: 'partial',
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
      },
      {
        id: 'details-1',
        name: 'Details',
        original_index: 1,
        status: 'max-rounds',
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
      final_artifact_hash: introHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Updated.',
      proposed_artifact: intro,
    }),
    '',
    '### 2. Details (max-rounds)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'max-rounds',
      final_artifact_hash: detailsHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Updated.',
      proposed_artifact: details,
    }),
    '',
  ].join('\n');
}

function corruptDetailsStatusArtifact() {
  return baseArtifact().replace(
    /<!-- consensus:consensus-section-status\n\{\n  "schema_version": "v0",\n  "status": "max-rounds",[\s\S]*?\n-->/u,
    '<!-- consensus:consensus-section-status\n{ bad json\n-->',
  );
}

function hashMismatchArtifact() {
  return baseArtifact().replaceAll(
    hashArtifact(details),
    hashArtifact('tampered\n'),
  );
}

function missingSectionStatusArtifact() {
  return baseArtifact().replace(
    /\n### 2\. Details \(max-rounds\)[\s\S]*?<!-- consensus:consensus-verdict\n\{\n  "schema_version": "v0",\n  "verdict": "REVISE",\n  "reasoning": "Updated\.",\n  "proposed_artifact": "## Details\\n\\nStill unresolved\.\\n"\n\}\n-->\n/u,
    '\n',
  );
}

it('resume corruption exits as data error and writes diagnostics', async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-corruption-'));

  await expect(
    parseDeliberationArtifactForResume(corruptDetailsStatusArtifact(), {
      runDir,
    }),
  ).rejects.toSatisfy((error: any) => {
    expect(error.exitCode).toBe(EXIT_CODES.DATA);
    expect(error.code).toBe('RESUME_CORRUPT');
    expect(error.message).toMatch(/corrupt resume state/i);
    return true;
  });

  const diagnostics = JSON.parse(
    await readFile(path.join(runDir, 'resume-errors.json'), 'utf8'),
  );
  expect(diagnostics.consensus_schema_version).toBe('v1');
  expect(diagnostics.errors[0].section_id).toBe('details-1');
  expect(diagnostics.errors[0].code).toBe('RESUME_JSON_CORRUPT');
});

it('resume rejects final artifact hash mismatches and missing section state', async () => {
  await expect(
    parseDeliberationArtifactForResume(hashMismatchArtifact()),
  ).rejects.toThrow(/hash mismatch/i);
  await expect(
    parseDeliberationArtifactForResume(missingSectionStatusArtifact()),
  ).rejects.toThrow(/missing section state/i);
});

it('resume can skip explicitly named corrupt sections', async () => {
  const parsed = await parseDeliberationArtifactForResume(
    hashMismatchArtifact(),
    {
      skipCorruptSections: ['details-1'],
    },
  );

  expect(
    parsed.skippedCorruptSections.map((section: JsonRecord) => section.id),
  ).toEqual(['details-1']);
  expect(
    parsed.inFlightSections.map((section: JsonRecord) => section.id),
  ).toEqual([]);
  expect(
    parsed.sections.find((section: JsonRecord) => section.id === 'details-1')
      .skipped,
  ).toBe(true);
});

it('resume supports interactive skip-all and non-interactive yes skip', async () => {
  let prompted = false;
  const interactive = await parseDeliberationArtifactForResume(
    hashMismatchArtifact(),
    {
      skipAllCorrupt: true,
      confirmSkipAllCorrupt: async ({ errors }: { errors: JsonRecord[] }) => {
        prompted = true;
        expect(errors.length).toBe(1);
        return true;
      },
    },
  );
  expect(prompted).toBe(true);
  expect(
    interactive.skippedCorruptSections.map((section: JsonRecord) => section.id),
  ).toEqual(['details-1']);

  let yesPrompted = false;
  const nonInteractive = await parseDeliberationArtifactForResume(
    hashMismatchArtifact(),
    {
      yesSkipCorrupt: true,
      confirmSkipAllCorrupt: async () => {
        yesPrompted = true;
        return false;
      },
    },
  );
  expect(yesPrompted).toBe(false);
  expect(
    nonInteractive.skippedCorruptSections.map(
      (section: JsonRecord) => section.id,
    ),
  ).toEqual(['details-1']);
});

it('parseWrapperArgs exposes skip-all-corrupt for resume flows', () => {
  const parsed = parseWrapperArgs(['draft.md', '--skip-all-corrupt']);
  expect(parsed.skipAllCorrupt).toBe(true);
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
  dropOnePeer = false,
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
        artifact_hash: synthHash,
      });

  const interventionBlock = corruptIntervention
    ? '<!-- consensus:consensus-verdict\n{ bad intervention json\n-->'
    : consensusBlock('consensus-verdict', {
        schema_version: 'v1',
        verdict: 'HOST_DECISION',
        reasoning: 'Adopt the merge.',
        decision_kind: 'blend',
        escalation_trigger: 'persistent_disagreement',
      });

  const peerBlocks = [
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'Peer A.',
      critique: { own_previous: 'oA', peer_previous: 'pA' },
      proposed_artifact: peerA,
    }),
  ];
  if (!dropOnePeer) {
    peerBlocks.push(
      consensusBlock('consensus-verdict', {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'Peer B.',
        critique: { own_previous: 'oB', peer_previous: 'pB' },
        proposed_artifact: peerB,
      }),
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
        final_artifact_hash: introHash,
        final_output: intro,
      },
      {
        id: 'details-1',
        name: 'Details',
        original_index: 1,
        status: 'escalation',
        final_artifact_hash: synthHash,
        final_output: synthText,
      },
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (converged)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v1',
      status: 'converged',
      final_artifact_hash: introHash,
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'ok',
      proposed_artifact: intro,
    }),
    '',
    '### 2. Details (escalation)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v1',
      status: 'escalation',
      termination_reason: 'persistent_disagreement',
      iteration_mode: 'parallel_synthesized',
      final_artifact_hash: synthHash,
    }),
    '',
    ...peerBlocks,
    '',
    synthesisBlock,
    '',
    interventionBlock,
    '',
  ].join('\n');
}

it('resume fails closed on a corrupt v1 synthesis record', async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-v1-synth-'));
  await expect(
    parseDeliberationArtifactForResume(
      synthesizedTwoSectionArtifact({ corruptSynthesis: true }),
      { runDir },
    ),
  ).rejects.toSatisfy((error: any) => {
    expect(error.exitCode).toBe(EXIT_CODES.DATA);
    expect(error.code).toBe('RESUME_CORRUPT');
    return true;
  });
});

it('resume fails closed on a corrupt v1 intervention round', async () => {
  const runDir = await mkdtemp(
    path.join(os.tmpdir(), 'resume-v1-intervention-'),
  );
  await expect(
    parseDeliberationArtifactForResume(
      synthesizedTwoSectionArtifact({ corruptIntervention: true }),
      { runDir },
    ),
  ).rejects.toSatisfy((error: any) => {
    expect(error.code).toBe('RESUME_CORRUPT');
    return true;
  });
});

it('resume detects a half-missing peer pair before a synthesis record', async () => {
  // A synthesized round whose peer pair is incomplete is fail-closed corrupt state.
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'resume-v1-halfpair-'));
  await expect(
    parseDeliberationArtifactForResume(
      synthesizedTwoSectionArtifact({ dropOnePeer: true }),
      { runDir },
    ),
  ).rejects.toSatisfy((error: any) => {
    expect(error.code).toBe('RESUME_CORRUPT');
    return true;
  });

  const diagnostics = JSON.parse(
    await readFile(path.join(runDir, 'resume-errors.json'), 'utf8'),
  );
  expect(
    diagnostics.errors.some(
      (entry: JsonRecord) => entry.code === 'RESUME_PAIR_INCOMPLETE',
    ),
    'incomplete-pair error recorded',
  ).toBeTruthy();
});

it('skip controls behave as v0.1 for corrupt v1 record types', async () => {
  const explicit = await parseDeliberationArtifactForResume(
    synthesizedTwoSectionArtifact({ corruptSynthesis: true }),
    { skipCorruptSections: ['details-1'] },
  );
  expect(
    explicit.skippedCorruptSections.map((section: JsonRecord) => section.id),
  ).toEqual(['details-1']);
  expect(
    explicit.completedSections.map((section: JsonRecord) => section.id),
  ).toEqual(['intro-0']);

  const yesSkip = await parseDeliberationArtifactForResume(
    synthesizedTwoSectionArtifact({ corruptIntervention: true }),
    { yesSkipCorrupt: true },
  );
  expect(
    yesSkip.skippedCorruptSections.map((section: JsonRecord) => section.id),
  ).toEqual(['details-1']);

  let prompted = false;
  const skipAll = await parseDeliberationArtifactForResume(
    synthesizedTwoSectionArtifact({ corruptSynthesis: true }),
    {
      skipAllCorrupt: true,
      confirmSkipAllCorrupt: async () => {
        prompted = true;
        return true;
      },
    },
  );
  expect(prompted).toBe(true);
  expect(
    skipAll.skippedCorruptSections.map((section: JsonRecord) => section.id),
  ).toEqual(['details-1']);
});
