import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import {
  makeProviderCliEnv,
  sampleInput,
} from '../../helpers/process.mjs';

const { prepareParallelRun, runSequential, runWrapperCli } = consensusRefine;

type JsonRecord = Record<string, any>;

// NFR5 — host-context discipline.
//
// Routine coordination events (run_started, run_completed,
// parallel_dispatch_required) must carry status/metadata only. Full
// revision/synthesis content crosses to the host exclusively at escalation
// points: escalation_required is the only content-bearing event in the
// protocol. This test enumerates the JSONL events emitted across every mode
// (including an escalation) and asserts that boundary structurally.

// Distinctive content markers. If any of these strings leak into a routine
// event payload, host-context discipline is broken. They are intentionally
// improbable so a substring scan cannot false-positive on metadata.
const PEER_REVISION_MARKER = 'PEER_REVISION_CONTENT_MARKER_7f3a';
const SYNTHESIS_TEXT_MARKER = 'SYNTHESIS_TEXT_CONTENT_MARKER_9b2c';

const ROUTINE_EVENTS = new Set([
  'run_started',
  'run_completed',
  'parallel_dispatch_required',
]);

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

function stubEnv(overrides: NodeJS.ProcessEnv = {}) {
  return makeProviderCliEnv(overrides);
}

const synthPreflight = async () => ({
  peers: ['claude', 'codex'],
  providerInventory: [
    { id: 'claude', available: true },
    { id: 'codex', available: true },
  ],
  warnings: [],
});

function synthesizedStubs(mergedText: string) {
  const invokePeer = async () => ({
    json: {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'adopt the merge',
      critique: {
        own_previous: `own ${PEER_REVISION_MARKER}`,
        peer_previous: `peer ${PEER_REVISION_MARKER}`,
      },
      proposed_artifact: mergedText,
    },
    stdout: '{"id":"peer"}',
  });
  const invokeSynthesizer = async () => ({
    json: {
      schema_version: 'v1',
      synthesized_artifact: mergedText,
      synthesis_reasoning: `Merged favoring stronger reasoning. ${SYNTHESIS_TEXT_MARKER}`,
      unresolved_disagreements: [],
    },
    stdout: '{"id":"synth"}',
  });
  return { invokePeer, invokeSynthesizer };
}

// Escalating synthesized stubs: peers keep diverging so synthesis stability never
// fires; persistent_disagreement accumulates across 3 synthesis records and the
// section escalates to the host with the divergent content in the event.
function escalatingStubs() {
  let peerCall = 0;
  const invokePeer = async () => {
    peerCall += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'revise',
        critique: {
          own_previous: `own ${PEER_REVISION_MARKER}`,
          peer_previous: `peer ${PEER_REVISION_MARKER}`,
        },
        proposed_artifact: `stuck-${peerCall} ${PEER_REVISION_MARKER}\n`,
      },
      stdout: '{"id":"peer"}',
    };
  };
  const invokeSynthesizer = async () => ({
    json: {
      schema_version: 'v1',
      synthesized_artifact: `merge ${SYNTHESIS_TEXT_MARKER}\n`,
      synthesis_reasoning: `still merging ${SYNTHESIS_TEXT_MARKER}`,
      unresolved_disagreements: ['scope boundary unresolved'],
    },
    stdout: '{"id":"synth"}',
  });
  return { invokePeer, invokeSynthesizer };
}

/**
 * Assert that no routine event payload contains either content marker. Routine
 * events may carry section ids, statuses, counts, paths — never revision or
 * synthesis text.
 */
function assertRoutineEventsCarryNoContent(events: JsonRecord[]) {
  for (const event of events) {
    if (!ROUTINE_EVENTS.has(event.event)) continue;
    const serialized = JSON.stringify(event);
    expect(
      serialized,
      `routine event ${event.event} leaked peer revision content`,
    ).not.toMatch(new RegExp(PEER_REVISION_MARKER));
    expect(
      serialized,
      `routine event ${event.event} leaked synthesis content`,
    ).not.toMatch(new RegExp(SYNTHESIS_TEXT_MARKER));
  }
}

it('alternating run: full CLI emits run_started/run_completed with no revision content', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-inventory-alt-'),
  );
  const stdout = captureStdout();
  await runWrapperCli(
    [
      sampleInput,
      '--peers',
      'claude,codex',
      '--iteration',
      'alternating',
      '--max-rounds',
      '3',
      '--agency',
      'moderate',
      '--output',
      path.join(tempRoot, 'out.consensus.md'),
      '--run-dir',
      path.join(tempRoot, '.consensus/run'),
      '--allow-root',
      tempRoot,
    ],
    {
      stdout,
      cwd: tempRoot,
      env: stubEnv({
        CONSENSUS_STUB_VERDICT: 'REVISE',
        CONSENSUS_STUB_PROPOSED_ARTIFACT: `Accepted body. ${PEER_REVISION_MARKER}\n`,
      }),
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    },
  );

  const events = stdout.events();
  expect(
    events.some((event) => event.event === 'run_started'),
    'run_started emitted',
  ).toBeTruthy();
  expect(
    events.some((event) => event.event === 'run_completed'),
    'run_completed emitted',
  ).toBeTruthy();
  assertRoutineEventsCarryNoContent(events);
  expect(
    !events.some((event) => event.event === 'escalation_required'),
  ).toBeTruthy();
});

it('parallel_revision run: full CLI routine events carry no revision content', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-inventory-par-'),
  );
  const stdout = captureStdout();
  await runWrapperCli(
    [
      sampleInput,
      '--peers',
      'claude,codex',
      '--iteration',
      'parallel_revision',
      '--max-rounds',
      '3',
      '--agency',
      'moderate',
      '--output',
      path.join(tempRoot, 'out.consensus.md'),
      '--run-dir',
      path.join(tempRoot, '.consensus/run'),
      '--allow-root',
      tempRoot,
    ],
    {
      stdout,
      cwd: tempRoot,
      env: stubEnv({ CONSENSUS_STUB_VERDICT: 'CONVERGED' }),
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    },
  );

  const events = stdout.events();
  expect(
    events.some((event) => event.event === 'run_started'),
    'run_started emitted',
  ).toBeTruthy();
  expect(
    events.some((event) => event.event === 'run_completed'),
    'run_completed emitted',
  ).toBeTruthy();
  assertRoutineEventsCarryNoContent(events);
});

it('parallel_synthesized run: emitted events carry no revision or synthesis content', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-inventory-synth-'),
  );
  const { invokePeer, invokeSynthesizer } = synthesizedStubs(
    `Merged. ${PEER_REVISION_MARKER}\n`,
  );
  const stdout = captureStdout();
  await runSequential(
    {
      inputPath: sampleInput,
      output: path.join(tempRoot, 'out.consensus.md'),
      runDir: path.join(tempRoot, '.consensus/run'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten every section.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 5,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer,
      invokeSynthesizer,
    },
    { stdout },
  );

  // runSequential itself only emits escalation events; on a converging run it
  // emits none. Assert no content leaks through whatever it does emit, and that
  // a clean converging run produces no escalation_required.
  const events = stdout.events();
  assertRoutineEventsCarryNoContent(events);
  expect(
    !events.some((event) => event.event === 'escalation_required'),
  ).toBeTruthy();
});

it('parallel_dispatch_required event carries no revision or synthesis content', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-inventory-prepare-'),
  );
  const result = await prepareParallelRun({
    inputPath: sampleInput,
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten every section.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 5,
    agency: 'moderate',
    parallelism: 2,
    preflight: synthPreflight,
  });

  // The dispatch event is a routine coordination event: it carries manifest
  // metadata and section packets, never deliberation content.
  const serialized = JSON.stringify(result.dispatchEvent);
  expect(serialized).not.toMatch(new RegExp(PEER_REVISION_MARKER));
  expect(serialized).not.toMatch(new RegExp(SYNTHESIS_TEXT_MARKER));
});

it('escalation_required is the ONLY content-bearing event', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-inventory-escalate-'),
  );
  const inputPath = path.join(tempRoot, 'draft.md');
  await writeFile(inputPath, '# Intro\n\nSeed text.\n');

  const { invokePeer, invokeSynthesizer } = escalatingStubs();
  const stdout = captureStdout();
  const result = await runSequential(
    {
      inputPath,
      output: path.join(tempRoot, 'draft.consensus.md'),
      runDir: path.join(tempRoot, '.consensus/run'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer,
      invokeSynthesizer,
    },
    { stdout },
  );

  expect(result.sections[0].status.status).toBe('escalation');
  const events = stdout.events();

  const escalation = events.find(
    (event) => event.event === 'escalation_required',
  );
  expect(escalation, 'escalation_required emitted').toBeTruthy();

  // The escalation event IS allowed to carry content — that is its purpose.
  const escalationSerialized = JSON.stringify(escalation);
  expect(escalationSerialized).toMatch(new RegExp(PEER_REVISION_MARKER));

  // Routine events emitted on the same run carry no content.
  assertRoutineEventsCarryNoContent(events);

  // Cross-check: escalation_required is the only event whose payload contains the
  // peer revision marker. No other event type leaks it.
  const contentBearing = events.filter((event) =>
    new RegExp(PEER_REVISION_MARKER).test(JSON.stringify(event)),
  );
  expect(
    [...new Set(contentBearing.map((event) => event.event))],
    'escalation_required must be the sole content-bearing event',
  ).toEqual(['escalation_required']);
});
