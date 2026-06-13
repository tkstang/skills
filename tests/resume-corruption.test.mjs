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
