/**
 * escalation-lifecycle.test.ts — End-to-end escalation lifecycle integration.
 *
 * Tests the two-pass escalation + resume flow: a run that escalates on
 * persistent_disagreement, then either converges via --host-direction or
 * promotes to the user when the host decision does not settle it.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { runSequential } = consensusRefine;

type JsonRecord = Record<string, any>;

function captureStdout() {
  const lines: string[] = [];
  return {
    write(chunk: unknown) {
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

// A synthesized scenario that escalates on persistent_disagreement, then either
// resolves (disagreements cleared after the host decision) or stays stuck.
function lifecycleStubs({
  resolveAfterHostDecision = true,
}: { resolveAfterHostDecision?: boolean } = {}) {
  let hostDecided = false;
  let peerCall = 0;
  const mergedResolved = 'Resolved merge.\n';

  const invokePeer = async () => {
    peerCall += 1;
    // While stuck, peers keep diverging (unique text per call) so synthesis
    // stability never fires — the run stays alive until persistent_disagreement
    // accumulates 3 synthesis records. After the host settles it, both peers
    // adopt the resolved text so stability converges.
    const text =
      hostDecided && resolveAfterHostDecision
        ? mergedResolved
        : `stuck-${peerCall}.\n`;
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

  const invokeSynthesizer = async () => {
    if (hostDecided && resolveAfterHostDecision) {
      return {
        json: {
          schema_version: 'v1',
          synthesized_artifact: mergedResolved,
          synthesis_reasoning: 'host direction settled it',
          unresolved_disagreements: [],
        },
        stdout: '{"id":"synth"}',
      };
    }
    return {
      json: {
        schema_version: 'v1',
        synthesized_artifact: mergedResolved,
        synthesis_reasoning: 'still merging',
        unresolved_disagreements: ['scope boundary unresolved'],
      },
      stdout: '{"id":"synth"}',
    };
  };

  return {
    invokePeer,
    invokeSynthesizer,
    markHostDecided() {
      hostDecided = true;
    },
  };
}

function singleSectionInput() {
  return '# Intro\n\nSeed text.\n';
}

const synthPreflight = async () => ({
  peers: ['claude', 'codex'],
  providerInventory: [
    { id: 'claude', available: true },
    { id: 'codex', available: true },
  ],
  warnings: [],
});

it('synthesized run escalates on persistent_disagreement (host) then converges via --host-direction', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-escalation-lifecycle-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(inputPath, singleSectionInput());

  const stubs = lifecycleStubs({ resolveAfterHostDecision: true });
  const stdout = captureStdout();

  // Pass 1: run until persistent_disagreement escalates to the host.
  const first = await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run1'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer,
    },
    { stdout },
  );

  expect(first.sections[0].status.status).toBe('escalation');
  const event = stdout
    .events()
    .find((entry) => entry.event === 'escalation_required');
  expect(event, 'escalation_required emitted').toBeTruthy();
  expect(event.trigger).toBe('persistent_disagreement');
  expect(event.decide_via).toBe('host');
  expect(event.resume.flag).toBe('--host-direction');

  // Pass 2: host answers via --host-direction; disagreements clear → converges.
  stubs.markHostDecided();
  const second = await runSequential({
    inputPath,
    resume: outputPath,
    output: path.join(tempRoot, 'draft.resumed.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run2'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten it.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 8,
    agency: 'moderate',
    preflight: false,
    hostDirection: 'Adopt the resolved merge.',
    hostDecisionKind: 'blend',
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer,
  });

  const records = second.sections[0].records;
  const hostRound = records.find(
    (record: JsonRecord) => record.verdict === 'HOST_DECISION',
  );
  expect(hostRound, 'HOST_DECISION round recorded on resume').toBeTruthy();
  expect(hostRound.agent).toBe('host-orchestrator');
  expect(hostRound.escalation_trigger).toBe('persistent_disagreement');
  expect(second.sections[0].status.status).toBe('converged');
});

it('promotion: re-fired trigger after a HOST_DECISION routes to the user', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-escalation-promote-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(inputPath, singleSectionInput());

  // The host decision does NOT settle the disagreement → trigger re-fires.
  const stubs = lifecycleStubs({ resolveAfterHostDecision: false });

  const first = await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run1'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer,
    },
    { stdout: captureStdout() },
  );
  expect(first.sections[0].status.status).toBe('escalation');
  expect(first.sections[0].status.escalation.decide_via).toBe('host');

  // Host answers, but the trigger persists → promotion re-routes to the user.
  const promoteStdout = captureStdout();
  const second = await runSequential(
    {
      inputPath,
      resume: outputPath,
      output: path.join(tempRoot, 'draft.resumed.consensus.md'),
      runDir: path.join(tempRoot, '.consensus/run2'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: false,
      hostDirection: 'Keep the stuck merge.',
      hostDecisionKind: 'blend',
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer,
    },
    { stdout: promoteStdout },
  );

  const status = second.sections[0].status;
  expect(status.status).toBe('escalation');
  expect(status.escalation.decide_via).toBe('user');
  expect(status.escalation.promoted_from).toBe('host');

  const event = promoteStdout
    .events()
    .find((entry) => entry.event === 'escalation_required');
  expect(
    event,
    'user-routed escalation re-emitted after promotion',
  ).toBeTruthy();
  expect(event.decide_via).toBe('user');
  expect(event.promoted_from).toBe('host');
  expect(event.resume.flag).toBe('--user-direction');
});

it('pending escalation resume is consumed by a supplied --host-direction', async () => {
  // Covered end-to-end by the escalation lifecycle test above (resume + --host-direction
  // converges). Here we assert the matrix entry-point: a pending escalation artifact
  // resumed with a host direction appends the HOST_DECISION and proceeds.
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-resume-escalation-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(inputPath, singleSectionInput());

  const stubs = lifecycleStubs({ resolveAfterHostDecision: true });
  await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run1'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer,
    },
    { stdout: captureStdout() },
  );

  stubs.markHostDecided();
  const second = await runSequential({
    inputPath,
    resume: outputPath,
    output: path.join(tempRoot, 'draft.resumed.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run2'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten it.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 8,
    agency: 'moderate',
    preflight: false,
    hostDirection: 'Adopt the resolved merge.',
    hostDecisionKind: 'blend',
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer,
  });

  const records = second.sections[0].records;
  expect(
    records.some((record: JsonRecord) => record.verdict === 'HOST_DECISION'),
  ).toBeTruthy();
  expect(second.sections[0].status.status).toBe('converged');
});
