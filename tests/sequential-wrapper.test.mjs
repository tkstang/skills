import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hashArtifact } from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
import {
  renderDeliberationArtifact,
  runSequential,
  runWrapperCli,
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

function captureStdout() {
  const lines = [];
  return {
    write(chunk) {
      lines.push(String(chunk));
      return true;
    },
    events() {
      return lines
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

function stubEnv(overrides = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides,
  };
}

function extractJsonBlock(markdown, label) {
  const pattern = new RegExp(
    '<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->',
  );
  const match = markdown.match(pattern);
  assert.ok(match, `missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

function consensusBlock(label, value) {
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function completedResumeArtifact(sections) {
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
    sections
      .map((section) => section.output)
      .join('\n\n')
      .replace(/\n*$/u, '\n'),
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
    consensusBlock(
      'consensus-section-states',
      sections.map((section, index) => ({
        id: section.id,
        name: section.name,
        original_index: index,
        status: 'converged',
        turns: 2,
        rounds: 1,
        final_artifact_hash: hashArtifact(section.output),
        final_output: section.output,
      })),
    ),
    '',
    '## Deliberation Log',
    '',
    ...sections.flatMap((section, index) => [
      `### ${index + 1}. ${section.name} (converged)`,
      '',
      consensusBlock('consensus-section-status', {
        schema_version: 'v0',
        status: 'converged',
        termination_reason: 'accept_twice',
        turns: 2,
        rounds: 1,
        final_artifact_hash: hashArtifact(section.output),
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
    ]),
  ].join('\n');
}

test('runSequential refines sections, creates run files, and writes an artifact', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-sequential-'),
  );
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const env = {
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    CURSOR_TRACE_ID: 'artifact-host-test',
  };
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
    env,
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
  assert.match(artifact, /^---\nconsensus_schema_version: v1\n/m);
  assert.match(artifact, /^iteration: alternating$/m);
  assert.match(artifact, /^cold_start: shared_input$/m);
  assert.match(artifact, /^peers: \["claude","codex"\]$/m);
  assert.match(artifact, /^host: cursor$/m);
  assert.match(artifact, /^total_turns: [1-9]\d*$/m);
  assert.match(artifact, /^total_rounds: [1-9]\d*$/m);
  assert.match(artifact, /^wall_clock_ms: \d+$/m);
  assert.match(artifact, /^cost_source: unavailable$/m);
  assert.match(artifact, /^approximate_cost_usd: null$/m);
  assert.match(
    artifact,
    new RegExp(
      `^input_path: ${JSON.stringify(sampleInput).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'm',
    ),
  );
  assert.match(artifact, /^run_id: run$/m);
  assert.match(artifact, /\n---\n\n# Consensus Refine Artifact/m);
  assert.match(artifact, /## Final Output/);
  assert.match(artifact, /# Intro/);
  assert.match(artifact, /## Details/);
  assert.match(artifact, /## Resolution/);
  assert.match(artifact, /Make each section clearer\./);
  assert.match(artifact, /## Deliberation Log/);
  assert.doesNotMatch(artifact, /```json consensus-resolution/);
  assert.match(artifact, /<!-- consensus:consensus-resolution\n/);

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.consensus_schema_version, 'v1');
  assert.equal(resolution.mode, 'sequential');
  assert.equal(resolution.host, 'cursor');
  assert.equal(resolution.sections.total, 3);
  assert.equal(resolution.sections.converged, 3);

  const sectionStates = extractJsonBlock(artifact, 'consensus-section-states');
  assert.equal(sectionStates.length, 3);
  assert.ok(
    sectionStates.every(
      (section) =>
        typeof section.final_output === 'string' &&
        section.final_output.length > 0,
    ),
  );
  assert.deepEqual(
    sectionStates.map((section) => section.original_index),
    [0, 1, 2],
  );
});

test('run_started discloses iteration mode and per-round call multiplier', async () => {
  const alternating = captureStdout();
  await runWrapperCli([sampleInput, '--peers', 'claude,codex'], {
    stdout: alternating,
    env: stubEnv(),
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
  });
  const altStart = alternating
    .events()
    .find((event) => event.event === 'run_started');
  assert.ok(altStart, 'expected run_started event');
  assert.equal(altStart.iteration_mode, 'alternating');
  assert.deepEqual(altStart.calls_per_round, { peer: 1, synthesis: 0 });

  const parallel = captureStdout();
  await runWrapperCli(
    [
      sampleInput,
      '--peers',
      'claude,codex',
      '--iteration',
      'parallel_revision',
    ],
    {
      stdout: parallel,
      env: stubEnv({
        PASEO_STUB_RESPONSE_JSON: JSON.stringify({
          schema_version: 'v1',
          verdict: 'CONVERGED',
          reasoning: 'agreed',
          critique: { own_previous: 'o', peer_previous: 'p' },
        }),
      }),
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    },
  );
  const parStart = parallel
    .events()
    .find((event) => event.event === 'run_started');
  assert.equal(parStart.iteration_mode, 'parallel_revision');
  assert.deepEqual(parStart.calls_per_round, { peer: 2, synthesis: 0 });
});

test('parallel-revision artifact resolution reports peer_calls totals', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-peer-calls-'),
  );
  const outputPath = path.join(tempRoot, 'out.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const converged = JSON.stringify({
    schema_version: 'v1',
    verdict: 'CONVERGED',
    reasoning: 'agreed',
    critique: { own_previous: 'o', peer_previous: 'p' },
  });

  const result = await runSequential({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    peers: ['claude', 'codex'],
    iteration: 'parallel_revision',
    maxRounds: 2,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    env: stubEnv({ PASEO_STUB_RESPONSE_JSON: converged }),
  });

  const artifact = await readFile(outputPath, 'utf8');
  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.iteration, 'parallel_revision');
  assert.ok(
    Number.isInteger(resolution.peer_calls),
    'expected integer peer_calls',
  );
  assert.ok(
    resolution.peer_calls >= 2,
    'expected at least one round of two peer calls',
  );
  // peer_calls equals the total peer turns across sections.
  const totalTurns = result.sections.reduce(
    (sum, section) => sum + (section.status?.turns ?? 0),
    0,
  );
  assert.equal(resolution.peer_calls, totalTurns);
});

test('runSequential preserves completed resume section output when source input changes', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-resume-completed-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const resumePath = path.join(tempRoot, 'draft.old.consensus.md');
  const outputPath = path.join(tempRoot, 'draft.new.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const oldIntro = '# Intro\n\nOld stable text.\n';
  const oldDetails = '## Details\n\nOld stable details.\n';

  await writeFile(
    resumePath,
    completedResumeArtifact([
      { id: 'intro-0', name: 'Intro', output: oldIntro },
      { id: 'details-1', name: 'Details', output: oldDetails },
    ]),
  );
  await writeFile(
    inputPath,
    '# Intro\n\nCHANGED INPUT SHOULD NOT BE RESUME STATE.\n\n## Details\n\nChanged details.\n',
  );

  const result = await runSequential({
    inputPath,
    resume: resumePath,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    peers: ['claude', 'codex'],
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    env: stubEnv(),
  });

  const artifact = await readFile(outputPath, 'utf8');
  assert.equal(result.sections[0].output, oldIntro);
  assert.equal(result.sections[1].output, oldDetails);
  assert.match(artifact, /Old stable text\./);
  assert.match(artifact, /Old stable details\./);
  assert.doesNotMatch(artifact, /CHANGED INPUT SHOULD NOT BE RESUME STATE/);
  assert.doesNotMatch(artifact, /Changed details\./);
});

test('runSequential preserves artifact section inventory when source headings drift', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-resume-inventory-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const resumePath = path.join(tempRoot, 'draft.old.consensus.md');
  const outputPath = path.join(tempRoot, 'draft.new.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const oldIntro = '# Intro\n\nOld stable text.\n';
  const oldDetails = '## Details\n\nOld stable details.\n';

  await writeFile(
    resumePath,
    completedResumeArtifact([
      { id: 'intro-0', name: 'Intro', output: oldIntro },
      { id: 'details-1', name: 'Details', output: oldDetails },
    ]),
  );
  await writeFile(
    inputPath,
    '# Renamed Intro\n\nThe current source no longer has Details.\n',
  );

  const result = await runSequential({
    inputPath,
    resume: resumePath,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    peers: ['claude', 'codex'],
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    env: stubEnv(),
  });

  const artifact = await readFile(outputPath, 'utf8');
  const sectionStates = extractJsonBlock(artifact, 'consensus-section-states');

  assert.equal(result.sections.length, 2);
  assert.deepEqual(
    result.sections.map((section) => section.name),
    ['Intro', 'Details'],
  );
  assert.deepEqual(
    sectionStates.map((section) => section.id),
    ['intro-0', 'details-1'],
  );
  assert.match(artifact, /Old stable text\./);
  assert.match(artifact, /Old stable details\./);
  assert.doesNotMatch(artifact, /The current source no longer has Details/);
});

test('renderDeliberationArtifact uses canonical containers and contains prose headings', () => {
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
        status: {
          status: 'converged',
          termination_reason: 'hash_match',
          turns: 2,
          rounds: 1,
        },
        records: [
          {
            round_index: 1,
            agent: 'claude',
            verdict: 'REVISE',
            reasoning:
              '# Unexpected Heading\nRemove <script>alert(1)</script> from prose.',
            proposed_artifact: 'Draft with ``` fence.\n',
          },
        ],
      },
    ],
  });

  assert.match(artifact, /````markdown\nDraft with ``` fence\.\n````/);
  assert.doesNotMatch(artifact, /Reasoning:\nRemove <script>/);
  assert.match(
    artifact,
    /Reasoning:\n\\# Unexpected Heading\nRemove \[removed\] from prose\./,
  );
  assert.match(artifact, /<!-- consensus:consensus-verdict\n/);
  assert.match(artifact, /"proposed_artifact": "Draft with ``` fence\.\\n"/);
});

// --- p04-t04: escalation_required JSONL event -----------------------------

function persistentSynthesizedStubs() {
  let peerCall = 0;
  const invokePeer = async () => {
    peerCall += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `r${peerCall}`,
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: `peer revision ${peerCall}.\n`,
      },
      stdout: '{"id":"peer"}',
    };
  };
  let synthCall = 0;
  const invokeSynthesizer = async () => {
    synthCall += 1;
    return {
      json: {
        schema_version: 'v1',
        synthesized_artifact: `merged ${synthCall}.\n`,
        synthesis_reasoning: 'merged favoring stronger reasoning',
        unresolved_disagreements: ['heading style unresolved'],
      },
      stdout: '{"id":"synth"}',
    };
  };
  return { invokePeer, invokeSynthesizer };
}

test('escalation_required event resolves divergent full text and resume vector, emitted before run end', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-escalation-event-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'out.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  await writeFile(inputPath, '# Intro\n\nSeed.\n');

  const { invokePeer, invokeSynthesizer } = persistentSynthesizedStubs();
  const stdout = captureStdout();
  const result = await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir,
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: async () => ({
        peers: ['claude', 'codex'],
        providerInventory: [
          { id: 'claude', available: true },
          { id: 'codex', available: true },
        ],
        warnings: [],
      }),
      invokePeer,
      invokeSynthesizer,
    },
    { stdout },
  );

  assert.equal(result.sections[0].status.status, 'escalation');

  const events = stdout.events();
  const escalation = events.find(
    (event) => event.event === 'escalation_required',
  );
  assert.ok(escalation, 'expected escalation_required event');
  assert.equal(escalation.trigger, 'persistent_disagreement');
  assert.equal(escalation.decide_via, 'host');
  assert.ok(Array.isArray(escalation.decision_kinds));
  // Full divergent text resolved into the event (both revisions + synthesis).
  assert.equal(typeof escalation.divergent.a.text, 'string');
  assert.equal(typeof escalation.divergent.b.text, 'string');
  assert.ok(escalation.divergent.a.text.length > 0);
  assert.ok(
    escalation.divergent.synthesis,
    'synthesis text present in synthesized mode',
  );
  assert.match(escalation.divergent.synthesis.text, /merged/);
  assert.deepEqual(escalation.divergent.synthesis.unresolved_disagreements, [
    'heading style unresolved',
  ]);
  // Resume vector names the artifact path and the host flag.
  assert.equal(escalation.resume.artifact_path, outputPath);
  assert.equal(escalation.resume.flag, '--host-direction');
  assert.equal(escalation.section_id, result.sections[0].id);
});
