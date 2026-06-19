import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import {
  makeProviderCliEnv,
  parseJsonl,
  sampleInput,
} from '../../helpers/process.mjs';

const { runSequential } = consensusRefine;

type JsonRecord = Record<string, any>;

async function readCalls(callsPath: string) {
  return parseJsonl<JsonRecord>(await readFile(callsPath, 'utf8'));
}

it('runs Refine through the consensus CLI backend and resumes provider-neutral records', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-refine-cli-integration-'),
  );
  const callsPath = path.join(tempRoot, 'calls.jsonl');
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const env = makeProviderCliEnv({
    CONSENSUS_STUB_CALLS_JSONL: callsPath,
    CONSENSUS_STUB_VERDICT: 'ACCEPT',
  });

  const result = await runSequential({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    env,
    goal: 'Exercise the owned provider CLI backend.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
  });

  expect(result.status).toBe('converged');
  const firstRecords = JSON.parse(
    await readFile(result.sections[0].paths.records, 'utf8'),
  );
  expect(firstRecords[0]).toMatchObject({
    raw_provider_response: expect.stringContaining('"verdict":"ACCEPT"'),
    provider_diagnostics: {
      strategy_used: 'fixture_consensus_cli',
    },
    attempts: {
      cli_attempts: 1,
      terminal_reason: 'success',
    },
  });
  expect(firstRecords[0]).not.toHaveProperty('raw_paseo_response');

  const callsAfterFirstRun = await readCalls(callsPath);
  const providerCalls = callsAfterFirstRun.filter(
    (call) => call.event === 'provider_ls',
  );
  const preflightProviders = callsAfterFirstRun
    .filter((call) => call.event === 'preflight')
    .map((call) => call.provider);
  const runCalls = callsAfterFirstRun.filter((call) => call.event === 'run');

  expect(providerCalls).toHaveLength(1);
  expect(preflightProviders).toEqual(['claude', 'codex']);
  expect(runCalls.map((call) => call.provider)).toEqual([
    'claude',
    'codex',
    'claude',
    'codex',
    'claude',
    'codex',
  ]);

  const resumed = await runSequential({
    inputPath: sampleInput,
    resume: outputPath,
    output: path.join(tempRoot, 'sample.resumed.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/resume'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    env,
    goal: 'Exercise the owned provider CLI backend.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
  });

  expect(resumed.status).toBe('converged');
  const callsAfterResume = await readCalls(callsPath);
  expect(callsAfterResume.filter((call) => call.event === 'run')).toHaveLength(
    runCalls.length,
  );

  const resumedArtifact = await readFile(
    path.join(tempRoot, 'sample.resumed.consensus.md'),
    'utf8',
  );
  expect(resumedArtifact).not.toContain('raw_paseo_response');
});

it('does not add wrapper retries after the consensus CLI reports a terminal provider failure', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-refine-cli-failure-'),
  );
  const callsPath = path.join(tempRoot, 'calls.jsonl');
  const inputPath = path.join(tempRoot, 'single-section.md');
  await writeFile(inputPath, '# Only\n\nOne section.\n');
  const env = makeProviderCliEnv({
    CONSENSUS_STUB_CALLS_JSONL: callsPath,
    CONSENSUS_STUB_RUN_FAILURE_CODE: 'PROVIDER_INVALID_JSON',
  });

  const result = await runSequential({
    inputPath,
    output: path.join(tempRoot, 'sample.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    env,
    goal: 'Fail once at the provider tier.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
  });

  expect(result.status).toBe('error');
  expect(result.sections[0].status).toMatchObject({
    status: 'error',
    termination_reason: 'hard_error',
    error: expect.stringMatching(/provider_invalid_json/i),
  });

  const runCalls = (await readCalls(callsPath)).filter(
    (call) => call.event === 'run',
  );
  expect(runCalls).toHaveLength(1);
  expect(runCalls[0].provider).toBe('claude');
});
