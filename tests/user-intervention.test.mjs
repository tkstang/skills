import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseWrapperArgs,
  runSequential
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs';
import { hashArtifact } from '../plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs';

const original = '# Intro\n\nNeeds work.\n';
const resumed = '# Intro\n\nUse decisive language.\n';

function consensusBlock(label, value) {
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function resumeArtifact() {
  const resumedHash = hashArtifact(resumed);
  return [
    '---',
    'consensus_schema_version: v0',
    'status: partial',
    'mode: sequential',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v0',
      status: 'partial',
      mode: 'sequential',
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
        status: 'max-rounds',
        turns: 1,
        rounds: 1,
        final_artifact_hash: resumedHash
      }
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (max-rounds)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'max-rounds',
      termination_reason: 'max_rounds_exhausted',
      turns: 1,
      rounds: 1,
      final_artifact_hash: resumedHash
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'The intro needs a stronger verb.',
      proposed_artifact: resumed
    }),
    ''
  ].join('\n');
}

test('parseWrapperArgs accepts user direction for resume intervention', () => {
  const parsed = parseWrapperArgs(['draft.md', '--resume', 'draft.consensus.md', '--user-direction', 'Use the decisive version.']);
  assert.equal(parsed.userDirection, 'Use the decisive version.');
});

test('resume adds a user intervention record and continues from the next peer turn', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'user-intervention-'));
  const inputPath = path.join(tempRoot, 'draft.md');
  const resumePath = path.join(tempRoot, 'draft.consensus.md');
  const outputPath = path.join(tempRoot, 'draft.resumed.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  await writeFile(inputPath, original);
  await writeFile(resumePath, resumeArtifact());

  const prompts = [];
  const result = await runSequential({
    inputPath,
    resume: resumePath,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Make it direct.',
    maxRounds: 2,
    agency: 'moderate',
    userDirection: 'Use the decisive version.',
    preflight: false,
    invokePeer: async ({ provider, prompt }) => {
      prompts.push({ provider, prompt });
      return {
        provider,
        stdout: '{"schema_version":"v0","verdict":"ACCEPT","reasoning":"Direction resolved the issue."}',
        json: {
          schema_version: 'v0',
          verdict: 'ACCEPT',
          reasoning: 'Direction resolved the issue.'
        }
      };
    }
  });

  assert.deepEqual(prompts.map((entry) => entry.provider), ['codex']);
  assert.match(prompts[0].prompt, /Prior deliberation records/);
  assert.match(prompts[0].prompt, /The intro needs a stronger verb/);
  assert.match(prompts[0].prompt, /Use the decisive version/);

  const records = result.sections[0].records;
  assert.deepEqual(
    records.map((record) => record.verdict),
    ['REVISE', 'USER_INTERVENTION', 'ACCEPT']
  );
  assert.deepEqual(
    records.map((record) => record.agent),
    ['claude', 'user', 'codex']
  );
  assert.equal(records[1].user_direction, 'Use the decisive version.');

  const output = await readFile(outputPath, 'utf8');
  assert.match(output, /#### <user round=2> - USER_INTERVENTION/);
  assert.match(output, /Use the decisive version\./);
  assert.match(output, /Direction resolved the issue\./);
});
