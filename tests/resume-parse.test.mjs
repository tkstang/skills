import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseDeliberationArtifactForResume
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import { hashArtifact } from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const revisedIntro = '# Intro\n\nClearer intro.\n';
const stalledDetails = '## Details\n\nStill unresolved.\n';
const acceptedIntro = '# Intro\n\nOld stable text.\n';
const strictHashOptions = {
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false
};

function consensusBlock(label, value) {
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function artifact({ schemaVersion = 'v0' } = {}) {
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
      consensus_schema_version: 'v0',
      status: 'partial',
      mode: 'sequential',
      parallel: false,
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
        turns: 2,
        rounds: 1,
        final_artifact_hash: introHash
      },
      {
        id: 'details-1',
        name: 'Details',
        original_index: 1,
        status: 'max-rounds',
        turns: 3,
        rounds: 2,
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
      termination_reason: 'hash_match',
      turns: 2,
      rounds: 1,
      final_artifact_hash: introHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Tightened.',
      proposed_artifact: revisedIntro
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Good.'
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
      final_artifact_hash: detailsHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Needs more specificity.',
      proposed_artifact: stalledDetails
    }),
    ''
  ].join('\n');
}

function acceptOnlyArtifact() {
  const introHash = hashArtifact(acceptedIntro);
  return [
    '---',
    'consensus_schema_version: v0',
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
      consensus_schema_version: 'v0',
      status: 'converged',
      mode: 'sequential',
      parallel: false,
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
        turns: 2,
        rounds: 1,
        final_artifact_hash: introHash,
        final_output: acceptedIntro
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
      termination_reason: 'accept_twice',
      turns: 2,
      rounds: 1,
      final_artifact_hash: introHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Stable.'
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Still stable.'
    }),
    ''
  ].join('\n');
}

function minimalAgencyArtifactWithTrailingWhitespace() {
  const output = '# Intro\n\nKeep trailing spaces here.  \n';
  const outputHash = hashArtifact(output, strictHashOptions);
  return [
    '---',
    'consensus_schema_version: v0',
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
      consensus_schema_version: 'v0',
      status: 'converged',
      mode: 'sequential',
      parallel: false,
      agency: 'minimal',
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
        turns: 2,
        rounds: 1,
        final_artifact_hash: outputHash,
        final_output: output
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
      termination_reason: 'accept_twice',
      turns: 2,
      rounds: 1,
      final_artifact_hash: outputHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Preserve whitespace for strict mode.',
      proposed_artifact: output
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'ACCEPT',
      reasoning: 'Strict bytes match.'
    }),
    ''
  ].join('\n');
}

test('parseDeliberationArtifactForResume reads frontmatter and canonical state blocks from text', async () => {
  const parsed = await parseDeliberationArtifactForResume(artifact());

  assert.equal(parsed.consensusSchemaVersion, 'v0');
  assert.equal(parsed.frontmatter.status, 'partial');
  assert.equal(parsed.resolution.mode, 'sequential');
  assert.deepEqual(
    parsed.sectionStates.map((section) => section.id),
    ['intro-0', 'details-1']
  );
  assert.deepEqual(
    parsed.sections.map((section) => ({
      id: section.id,
      completed: section.completed,
      inFlight: section.inFlight,
      recordCount: section.records.length
    })),
    [
      { id: 'intro-0', completed: true, inFlight: false, recordCount: 2 },
      { id: 'details-1', completed: false, inFlight: true, recordCount: 1 }
    ]
  );
  assert.deepEqual(parsed.inFlightSections.map((section) => section.id), ['details-1']);
});

test('parseDeliberationArtifactForResume uses canonical final output for ACCEPT-only completed sections', async () => {
  const parsed = await parseDeliberationArtifactForResume(acceptOnlyArtifact());

  assert.equal(parsed.sections[0].resumedArtifact, acceptedIntro);
  assert.equal(parsed.sections[0].resumedArtifactHash, hashArtifact(acceptedIntro));
});

test('parseDeliberationArtifactForResume validates minimal-agency hashes bytewise', async () => {
  const output = '# Intro\n\nKeep trailing spaces here.  \n';
  const parsed = await parseDeliberationArtifactForResume(minimalAgencyArtifactWithTrailingWhitespace());

  assert.equal(parsed.resolution.agency, 'minimal');
  assert.equal(parsed.sections[0].resumedArtifact, output);
  assert.equal(parsed.sections[0].resumedArtifactHash, hashArtifact(output, strictHashOptions));
});

test('parseDeliberationArtifactForResume accepts a file path input', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'resume-parse-'));
  const artifactPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(artifactPath, artifact());

  const parsed = await parseDeliberationArtifactForResume(artifactPath);

  assert.equal(parsed.sourcePath, artifactPath);
  assert.equal(parsed.sections.length, 2);
});

test('parseDeliberationArtifactForResume rejects unsupported schema versions', async () => {
  await assert.rejects(
    parseDeliberationArtifactForResume(artifact({ schemaVersion: 'v9' })),
    /unsupported consensus_schema_version/i
  );
});
