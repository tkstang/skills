#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  runSequential,
  runWrapperCli,
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

function parseJsonl(contents) {
  return String(contents)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function defaultRunCommand(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

function smokeEnv(env = process.env) {
  const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');
  return {
    ...env,
    PATH: `${fixtureBin}${path.delimiter}${env.PATH ?? ''}`,
    CONSENSUS_CLI_PATH:
      env.CONSENSUS_CLI_PATH ?? path.join(fixtureBin, 'consensus'),
  };
}

function assertArtifactShape(artifact) {
  assert.match(artifact, /## Final Output/);
  assert.match(artifact, /# Intro/);
  assert.match(artifact, /## Details/);
  assert.match(artifact, /## Close/);
  assert.match(artifact, /## Deliberation Log/);
  assert.match(artifact, /<!-- consensus:consensus-resolution\n/);
  assert.match(artifact, /<!-- consensus:consensus-section-states\n/);
}

function captureEventsWriter() {
  const lines = [];
  return {
    stream: {
      write(chunk) {
        lines.push(String(chunk));
        return true;
      },
    },
    events() {
      return parseJsonl(lines.join(''));
    },
  };
}

const SYNTH_PREFLIGHT = async () => ({
  peers: ['claude', 'codex'],
  providerInventory: [
    { id: 'claude', available: true },
    { id: 'codex', available: true },
  ],
  warnings: [],
});

/**
 * Stubs for a parallel-synthesized run that escalates on persistent_disagreement
 * (peers keep diverging so synthesis never stabilizes), then converges once the
 * host answers via --host-direction (both peers adopt the resolved merge).
 */
function escalationStubs() {
  let hostDecided = false;
  let peerCall = 0;
  const resolved = 'Resolved merge.\n';

  const invokePeer = async () => {
    peerCall += 1;
    const text = hostDecided ? resolved : `stuck-${peerCall}.\n`;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'revise',
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: text,
      },
      stdout: '{"id":"peer"}',
    };
  };

  const invokeSynthesizer = async () => ({
    json: {
      schema_version: 'v1',
      synthesized_artifact: resolved,
      synthesis_reasoning: hostDecided
        ? 'host direction settled it'
        : 'still merging',
      unresolved_disagreements: hostDecided
        ? []
        : ['scope boundary unresolved'],
    },
    stdout: '{"id":"synth"}',
  });

  return {
    invokePeer,
    invokeSynthesizer,
    markHostDecided() {
      hostDecided = true;
    },
  };
}

/**
 * Drive a mocked parallel-synthesized flow through one escalation and a
 * --host-direction resume to convergence. Exercises the synthesizer seam, the
 * escalation_required event, host-decision re-entry, and v1 resume on top of the
 * default alternating smoke path. Deterministic and dependency-free.
 */
export async function runParallelSynthesizedSmoke(_options = {}) {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-smoke-synth-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  await writeFile(inputPath, '# Intro\n\nSeed text.\n');

  const stubs = escalationStubs();
  const firstStdout = captureEventsWriter();

  const baseOptions = {
    inputPath,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Run deterministic parallel-synthesized smoke validation.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 8,
    agency: 'moderate',
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer,
  };

  // Pass 1: run until persistent_disagreement escalates to the host.
  const escalateOutput = path.join(tempRoot, 'draft.consensus.md');
  const first = await runSequential(
    {
      ...baseOptions,
      output: escalateOutput,
      runDir: path.join(tempRoot, '.consensus/run1'),
      preflight: SYNTH_PREFLIGHT,
    },
    { stdout: firstStdout.stream },
  );

  assert.equal(
    first.sections[0].status.status,
    'escalation',
    'parallel-synthesized smoke did not reach an escalation',
  );
  const escalation = firstStdout
    .events()
    .find((event) => event.event === 'escalation_required');
  assert.ok(escalation, 'escalation_required not emitted');
  assert.equal(escalation.trigger, 'persistent_disagreement');
  assert.equal(escalation.decide_via, 'host');
  assert.equal(escalation.resume.flag, '--host-direction');

  // Pass 2: host answers via --host-direction; disagreements clear → converges.
  stubs.markHostDecided();
  const resumeOutput = path.join(tempRoot, 'draft.resumed.consensus.md');
  const second = await runSequential({
    ...baseOptions,
    resume: escalateOutput,
    output: resumeOutput,
    runDir: path.join(tempRoot, '.consensus/run2'),
    preflight: false,
    hostDirection: 'Adopt the resolved merge.',
    hostDecisionKind: 'blend',
  });

  assert.equal(
    second.sections[0].status.status,
    'converged',
    'parallel-synthesized smoke did not converge after --host-direction',
  );
  const hostRound = second.sections[0].records.find(
    (record) => record.verdict === 'HOST_DECISION',
  );
  assert.ok(
    hostRound,
    'HOST_DECISION orchestrator round not recorded on resume',
  );
  assert.equal(hostRound.agent, 'host-orchestrator');
  assert.equal(hostRound.escalation_trigger, 'persistent_disagreement');

  const resumedArtifact = await readFile(resumeOutput, 'utf8');
  assert.match(resumedArtifact, /## Final Output/);
  assert.match(resumedArtifact, /HOST_DECISION/);

  return {
    escalationOutput: escalateOutput,
    resumeOutput,
    escalation,
    status: second.sections[0].status.status,
  };
}

export async function runSmokeTest(options = {}) {
  const root = path.resolve(options.root ?? repoRoot);
  const stdout = options.stdout ?? process.stdout;
  const runCommand = options.runCommand ?? defaultRunCommand;
  const inputEnv = options.env ?? process.env;
  const env = smokeEnv(inputEnv);
  const expectedStatus = env.CONSENSUS_SMOKE_EXPECT_STATUS ?? 'converged';

  await runCommand(
    process.execPath,
    [path.join(root, 'scripts/validate.mjs')],
    {
      cwd: root,
      env,
    },
  );

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-smoke-'));
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const wrapperStdout = captureWriter();
  const wrapperStderr = captureWriter();
  const sampleInput = path.join(root, 'tests/fixtures/sample-input.md');

  const wrapperOptions = {
    stdout: wrapperStdout.stream,
    stderr: wrapperStderr.stream,
    cwd: tempRoot,
    env,
  };
  const exitCode = await runWrapperCli(
    [
      sampleInput,
      '--output',
      outputPath,
      '--run-dir',
      runDir,
      '--allow-root',
      tempRoot,
      '--goal',
      'Run deterministic smoke validation.',
      '--peers',
      'claude,codex',
      '--max-rounds',
      '2',
    ],
    wrapperOptions,
  );

  assert.equal(exitCode, 0, wrapperStderr.value());
  const events = parseJsonl(wrapperStdout.value());
  const completed = events.find((event) => event.event === 'run_completed');
  assert.ok(completed, 'wrapper did not emit run_completed');
  assert.equal(
    completed.status,
    expectedStatus,
    `expected smoke status ${expectedStatus}`,
  );

  const artifact = await readFile(outputPath, 'utf8');
  assertArtifactShape(artifact);

  // Second scenario: a mocked parallel-synthesized flow that escalates once and
  // resumes to convergence via --host-direction (exercises synthesizer, the
  // escalation_required event, and host-decision re-entry on top of v1 resume).
  const parallelSynthesized = await runParallelSynthesizedSmoke({ root });

  stdout.write('smoke passed\n');
  return {
    status: 'passed',
    env,
    events,
    artifact,
    outputPath,
    runDir,
    parallelSynthesized,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runSmokeTest().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
