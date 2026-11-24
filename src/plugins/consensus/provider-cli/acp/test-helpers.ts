// Test support for the ACP adapter suites: sanitized spike fixtures, small
// scenario edits, and a spawn primitive that launches the fake ACP agent in
// place of the real provider command while recording what was launched.
import { writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixtureBin } from '../../../../../tests/helpers/process.mjs';
import type { ProcessGroupOptions, SpawnProcessGroup } from './process.js';
import { spawnProcessGroup } from './process.js';

export type ScenarioStep = Record<string, unknown>;

export interface Scenario {
  source?: unknown;
  onStdinEnd?: 'exit' | 'ignore';
  ignoreSigterm?: boolean;
  steps: ScenarioStep[];
}

export const FAST_ACP_TIMING = {
  cancelGraceMs: 300,
  closeTimeoutMs: 300,
  exitGraceMs: 500,
  killGraceMs: 200,
  settleMs: 1000,
};

const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);
const fakeAgent = path.join(fixtureBin, 'fake-acp-agent');

export async function acpFixture(name: string): Promise<Scenario> {
  return JSON.parse(
    await readFile(path.join(fixtureDir, `${name}.json`), 'utf8'),
  );
}

// The steps through the first one matching `matches`, then `tail`.
export function cutAfter(
  scenario: Scenario,
  matches: (step: ScenarioStep) => boolean,
  tail: ScenarioStep[],
): Scenario {
  const index = scenario.steps.findIndex(matches);
  if (index === -1) throw new Error('cut point not found');
  return {
    ...scenario,
    steps: [...scenario.steps.slice(0, index + 1), ...tail],
  };
}

// Removes `count` steps starting at the first one matching `matches`, after
// skipping `skip` earlier matches.
export function dropSteps(
  scenario: Scenario,
  matches: (step: ScenarioStep) => boolean,
  count: number,
  skip = 0,
): Scenario {
  let seen = 0;
  const index = scenario.steps.findIndex(
    (step) => matches(step) && seen++ === skip,
  );
  if (index === -1) throw new Error('drop point not found');
  const steps = [...scenario.steps];
  steps.splice(index, count);
  return { ...scenario, steps };
}

// Inserts `inserted` after the first step matching `matches`.
export function insertAfter(
  scenario: Scenario,
  matches: (step: ScenarioStep) => boolean,
  inserted: ScenarioStep[],
): Scenario {
  const index = scenario.steps.findIndex(matches);
  if (index === -1) throw new Error('insert point not found');
  const steps = [...scenario.steps];
  steps.splice(index + 1, 0, ...inserted);
  return { ...scenario, steps };
}

export const expects = (method: string) => (step: ScenarioStep) =>
  step.expect === method;

// The session/new result a scenario answers with.
export function sessionNewResult(scenario: Scenario): Record<string, any> {
  const index = scenario.steps.findIndex(expects('session/new'));
  const reply = scenario.steps
    .slice(index)
    .find((step) => 'respond' in step) as { respond: { result: any } };
  return reply.respond.result;
}

export interface FakeAgentLaunch {
  executable: string;
  argv: readonly string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}

export interface FakeAgentHarness {
  dir: string;
  spawn: SpawnProcessGroup;
  launches: FakeAgentLaunch[];
  pidFile: string;
  received(): Promise<Record<string, any>[]>;
  methods(): Promise<string[]>;
  cleanup(): Promise<void>;
}

// A spawn primitive that runs the fake agent on `scenario`, whatever command
// the adapter asked for. The requested executable, argv and env are kept in
// `launches`; `onLaunch` runs before the agent starts and may return a
// replacement scenario built from what was launched.
export async function fakeAgentHarness(
  scenario: Scenario,
  options: {
    onLaunch?: (launch: FakeAgentLaunch) => Scenario | void;
  } = {},
): Promise<FakeAgentHarness> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'consensus-acp-harness-'));
  const scenarioPath = path.join(dir, 'scenario.json');
  const receivedLog = path.join(dir, 'received.jsonl');
  const pidFile = path.join(dir, 'grandchild.pid');
  await writeFile(scenarioPath, JSON.stringify(scenario));
  const launches: FakeAgentLaunch[] = [];
  const spawn: SpawnProcessGroup = (requested: ProcessGroupOptions) => {
    const launch = {
      executable: requested.executable,
      argv: [...requested.argv],
      env: { ...requested.env },
      cwd: requested.cwd,
    };
    launches.push(launch);
    const replacement = options.onLaunch?.(launch);
    if (replacement) writeFileSync(scenarioPath, JSON.stringify(replacement));
    return spawnProcessGroup({
      ...requested,
      executable: process.execPath,
      argv: [fakeAgent, scenarioPath, ...requested.argv],
      env: {
        ...requested.env,
        FAKE_ACP_RECEIVED_LOG: receivedLog,
        FAKE_ACP_PID_FILE: pidFile,
      },
    });
  };
  const received = async () =>
    (await readFile(receivedLog, 'utf8').catch(() => ''))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, any>);
  return {
    dir,
    spawn,
    launches,
    pidFile,
    received,
    methods: async () =>
      (await received())
        .filter((frame) => frame.method)
        .map((frame) => frame.method as string),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export async function waitForExit(pid: number, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}
