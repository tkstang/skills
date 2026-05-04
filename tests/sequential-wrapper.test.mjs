import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  renderDeliberationArtifact,
  runSequential
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

function stubEnv(overrides = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides
  };
}

function extractJsonBlock(markdown, label) {
  const pattern = new RegExp('```json ' + label + '\\n([\\s\\S]*?)\\n```');
  const match = markdown.match(pattern);
  assert.ok(match, `missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

test('runSequential refines sections, creates run files, and writes an artifact', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-sequential-'));
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const result = await runSequential({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Make each section clearer.',
    peers: ['claude', 'codex'],
    maxRounds: 2,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    env: stubEnv()
  });

  assert.equal(result.sections.length, 3);
  assert.equal(result.status, 'converged');
  assert.equal((await stat(outputPath)).isFile(), true);

  for (const section of result.sections) {
    assert.equal((await stat(section.paths.records)).isFile(), true);
    assert.equal((await stat(section.paths.status)).isFile(), true);
    assert.equal((await stat(section.paths.output)).isFile(), true);
  }

  const artifact = await readFile(outputPath, 'utf8');
  assert.match(artifact, /^# Consensus Refine Artifact/m);
  assert.match(artifact, /## Final Output/);
  assert.match(artifact, /# Intro/);
  assert.match(artifact, /## Details/);
  assert.match(artifact, /## Resolution/);
  assert.match(artifact, /Make each section clearer\./);
  assert.match(artifact, /## Deliberation Log/);

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.consensus_schema_version, 'v0');
  assert.equal(resolution.mode, 'sequential');
  assert.equal(resolution.sections.total, 3);
  assert.equal(resolution.sections.converged, 3);

  const sectionStates = extractJsonBlock(artifact, 'consensus-section-states');
  assert.equal(sectionStates.length, 3);
  assert.deepEqual(
    sectionStates.map((section) => section.original_index),
    [0, 1, 2]
  );
});

test('renderDeliberationArtifact uses dynamic fences and sanitizes prose without changing JSON blocks', () => {
  const artifact = renderDeliberationArtifact({
    goal: 'Review tricky text.',
    mode: 'sequential',
    parallel: false,
    peers: ['claude', 'codex'],
    agency: 'moderate',
    maxRounds: 2,
    startedAt: '2026-05-04T02:00:00.000Z',
    endedAt: '2026-05-04T02:00:01.000Z',
    wallClockMs: 1000,
    sections: [
      {
        id: 'tricky-0',
        name: 'Tricky',
        original_index: 0,
        output: 'Final with ``` fenced content.\n',
        status: { status: 'converged', termination_reason: 'hash_match', turns: 2, rounds: 1 },
        records: [
          {
            round: 1,
            agent: 'claude',
            verdict: {
              decision: 'REVISE',
              reasoning: 'Remove <script>alert(1)</script> from prose.',
              proposed_artifact: 'Draft with ``` fence.\n'
            }
          }
        ]
      }
    ]
  });

  assert.match(artifact, /````markdown\nDraft with ``` fence\.\n````/);
  assert.doesNotMatch(artifact, /Reasoning:\nRemove <script>/);
  assert.match(artifact, /"proposed_artifact": "Draft with ``` fence\.\\n"/);
});
