import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseWrapperArgs,
  runSequential
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import { hashArtifact, runConsensusLoop } from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

function loopArgvFor(files, extra = []) {
  return [
    '--section-file',
    files.sectionPath,
    '--goal',
    'Tighten it.',
    '--peers',
    'claude,codex',
    '--max-rounds',
    '4',
    '--agency',
    'moderate',
    '--output-records',
    files.recordsPath,
    '--output-section',
    files.outputPath,
    '--output-status',
    files.statusPath,
    ...extra
  ];
}

async function escalationRunFiles() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'host-direction-'));
  const sectionPath = path.join(tempRoot, 'section.md');
  await writeFile(sectionPath, 'Seed.\n');
  return {
    tempRoot,
    sectionPath,
    recordsPath: path.join(tempRoot, 'records.json'),
    outputPath: path.join(tempRoot, 'output.md'),
    statusPath: path.join(tempRoot, 'status.json')
  };
}

// Synthesized peers that converge once the merged text is fed back in.
function convergingSynthesizedStubs(mergedText = 'Merged.\n') {
  const invokePeer = async () => ({
    json: {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'adopt the merge',
      critique: { own_previous: 'o', peer_previous: 'p' },
      proposed_artifact: mergedText
    },
    stdout: '{"id":"peer"}'
  });
  const invokeSynthesizer = async () => ({
    json: {
      schema_version: 'v1',
      synthesized_artifact: mergedText,
      synthesis_reasoning: 'merged',
      unresolved_disagreements: []
    },
    stdout: '{"id":"synth"}'
  });
  return { invokePeer, invokeSynthesizer };
}

const original = '# Intro\n\nNeeds work.\n';
const resumed = '# Intro\n\nUse decisive language.\n';

function consensusBlock(label, value) {
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function resumeArtifact() {
  const resumedHash = hashArtifact(resumed);
  return [
    '---',
    'consensus_schema_version: v1',
    'status: partial',
    'mode: sequential',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
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

function maxRoundsConsumedResumeArtifact() {
  const resumedHash = hashArtifact(resumed);
  const priorVerdicts = [
    {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Claude first pass asked for stronger language.',
      proposed_artifact: '# Intro\n\nRevision one.\n'
    },
    {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Codex first pass kept tightening.',
      proposed_artifact: '# Intro\n\nRevision two.\n'
    },
    {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Claude second pass still disagreed.',
      proposed_artifact: '# Intro\n\nRevision three.\n'
    },
    {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'Codex second pass hit the configured ceiling.',
      proposed_artifact: resumed
    }
  ];

  return [
    '---',
    'consensus_schema_version: v1',
    'status: partial',
    'mode: sequential',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
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
        turns: 4,
        rounds: 2,
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
      turns: 4,
      rounds: 2,
      final_artifact_hash: resumedHash
    }),
    '',
    ...priorVerdicts.flatMap((verdict) => [consensusBlock('consensus-verdict', verdict), ''])
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
        stdout: '{"schema_version":"v1","verdict":"ACCEPT","reasoning":"Direction resolved the issue."}',
        json: {
          schema_version: 'v1',
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

test('resume with user direction continues after max-rounds budget was already consumed', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'user-intervention-budget-'));
  const inputPath = path.join(tempRoot, 'draft.md');
  const resumePath = path.join(tempRoot, 'draft.consensus.md');
  const outputPath = path.join(tempRoot, 'draft.resumed.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  await writeFile(inputPath, original);
  await writeFile(resumePath, maxRoundsConsumedResumeArtifact());

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
    invokePeer: async ({ provider, round, turn, prompt }) => {
      prompts.push({ provider, round, turn, prompt });
      return {
        provider,
        stdout: '{"schema_version":"v1","verdict":"ACCEPT","reasoning":"Direction resolved the issue."}',
        json: {
          schema_version: 'v1',
          verdict: 'ACCEPT',
          reasoning: 'Direction resolved the issue.'
        }
      };
    }
  });

  assert.deepEqual(prompts.map((entry) => entry.provider), ['claude']);
  assert.equal(prompts[0].round, 3);
  assert.equal(prompts[0].turn, 5);
  assert.match(prompts[0].prompt, /Codex second pass hit the configured ceiling/);
  assert.match(prompts[0].prompt, /Use the decisive version/);

  const records = result.sections[0].records;
  assert.deepEqual(
    records.map((record) => record.agent),
    ['claude', 'codex', 'claude', 'codex', 'user', 'claude']
  );
  assert.equal(result.sections[0].status.status, 'converged');
  assert.equal(result.sections[0].status.turns, 5);

  const output = await readFile(outputPath, 'utf8');
  assert.match(output, /#### <user round=3> - USER_INTERVENTION/);
  assert.match(output, /Direction resolved the issue\./);
});

// --- p04-t05: --host-direction re-entry + HOST_DECISION rounds ------------

test('parseWrapperArgs accepts --host-direction for resume', () => {
  const parsed = parseWrapperArgs([
    'draft.md',
    '--resume',
    'draft.consensus.md',
    '--host-direction',
    'Blend both revisions.'
  ]);
  assert.equal(parsed.hostDirection, 'Blend both revisions.');
});

test('parseWrapperArgs rejects --host-direction together with --user-direction', () => {
  assert.throws(
    () =>
      parseWrapperArgs([
        'draft.md',
        '--resume',
        'draft.consensus.md',
        '--user-direction',
        'a',
        '--host-direction',
        'b'
      ]),
    /mutually exclusive/i
  );
});

test('--host-direction appends a HOST_DECISION round and converges with refreshed budget', async () => {
  const files = await escalationRunFiles();
  const { invokePeer, invokeSynthesizer } = convergingSynthesizedStubs();
  const result = await runConsensusLoop(
    loopArgvFor(files, ['--iteration', 'parallel_synthesized', '--synthesizer', 'claude', '--max-rounds', '4']),
    {
      invokePeer,
      invokeSynthesizer,
      hostDirection: 'Blend both revisions.',
      hostDecisionKind: 'blend',
      escalationTrigger: 'persistent_disagreement'
    }
  );

  const hostRound = result.records.find((record) => record.verdict === 'HOST_DECISION');
  assert.ok(hostRound, 'expected a HOST_DECISION record');
  assert.equal(hostRound.agent, 'host-orchestrator');
  assert.equal(hostRound.decision_kind, 'blend');
  assert.equal(hostRound.escalation_trigger, 'persistent_disagreement');
  assert.equal(hostRound.reasoning, 'Blend both revisions.');
  assert.equal(result.status.status, 'converged');
});

function escalationResumeArtifact({ decideVia = 'host' } = {}) {
  const seedHash = hashArtifact(resumed);
  const escalation = {
    trigger: 'persistent_disagreement',
    decide_via: decideVia,
    decision_kinds:
      decideVia === 'host'
        ? ['pick_a', 'pick_b', 'blend', 'direct', 'accept_impasse', 'extend_budget', 'defer_to_user']
        : ['pick_a', 'pick_b', 'blend', 'direct', 'accept_impasse', 'extend_budget']
  };
  return [
    '---',
    'consensus_schema_version: v1',
    'status: partial',
    'mode: sequential',
    '---',
    '',
    '# Consensus Refine Artifact',
    '',
    '## Resolution',
    '',
    consensusBlock('consensus-resolution', {
      consensus_schema_version: 'v1',
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
        status: 'escalation',
        turns: 2,
        rounds: 1,
        final_artifact_hash: seedHash
      }
    ]),
    '',
    '## Deliberation Log',
    '',
    '### 1. Intro (escalation)',
    '',
    consensusBlock('consensus-section-status', {
      schema_version: 'v0',
      status: 'escalation',
      termination_reason: 'escalation_persistent_disagreement',
      turns: 2,
      rounds: 1,
      final_artifact_hash: seedHash,
      escalation
    }),
    '',
    consensusBlock('consensus-verdict', {
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'still drifting',
      proposed_artifact: resumed
    }),
    ''
  ].join('\n');
}

async function runHostDirectionResume(resumeText, overrides = {}) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'host-direction-resume-'));
  const inputPath = path.join(tempRoot, 'draft.md');
  const resumePath = path.join(tempRoot, 'draft.consensus.md');
  const outputPath = path.join(tempRoot, 'draft.resumed.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  await writeFile(inputPath, original);
  await writeFile(resumePath, resumeText);
  const { invokePeer, invokeSynthesizer } = convergingSynthesizedStubs(resumed);
  return runSequential({
    inputPath,
    resume: resumePath,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten it.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 3,
    agency: 'moderate',
    preflight: false,
    invokePeer,
    invokeSynthesizer,
    ...overrides
  });
}

test('--host-direction is rejected (ESCALATION_ROUTING) when the pending escalation routes to user', async () => {
  await assert.rejects(
    () =>
      runHostDirectionResume(escalationResumeArtifact({ decideVia: 'user' }), {
        hostDirection: 'Blend both.',
        hostDecisionKind: 'blend'
      }),
    (error) => {
      assert.equal(error.code, 'ESCALATION_ROUTING');
      return true;
    }
  );
});

test('--host-direction is rejected (ESCALATION_ROUTING) when no escalation is pending', async () => {
  await assert.rejects(
    () =>
      runHostDirectionResume(resumeArtifact(), {
        iteration: 'alternating',
        synthesizer: undefined,
        hostDirection: 'Blend both.',
        hostDecisionKind: 'blend'
      }),
    (error) => {
      assert.equal(error.code, 'ESCALATION_ROUTING');
      return true;
    }
  );
});

test('--host-direction resume appends an attributed HOST_DECISION round and continues', async () => {
  const result = await runHostDirectionResume(escalationResumeArtifact({ decideVia: 'host' }), {
    hostDirection: 'Blend both revisions.',
    hostDecisionKind: 'blend'
  });
  const records = result.sections[0].records;
  const hostRound = records.find((record) => record.verdict === 'HOST_DECISION');
  assert.ok(hostRound, 'expected HOST_DECISION record');
  assert.equal(hostRound.agent, 'host-orchestrator');
  assert.equal(hostRound.decision_kind, 'blend');
  assert.equal(hostRound.escalation_trigger, 'persistent_disagreement');
});
