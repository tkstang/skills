import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import {
  makeProviderCliEnv,
  makeStubEnv,
  parseJsonl,
  repoRoot,
  runNodeScript,
  sampleInput,
} from '../../helpers/process.mjs';

const { prepareParallelRun, runSequential } = consensusRefine;

type JsonRecord = Record<string, any>;

async function readCalls(callsPath: string) {
  return parseJsonl<JsonRecord>(await readFile(callsPath, 'utf8'));
}

function scrubHostEnv(env: NodeJS.ProcessEnv) {
  for (const key of [
    'CLAUDECODE',
    'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_SESSION_ID',
    'CODEX_SESSION_ID',
    'CODEX_SANDBOX',
    'OPENAI_CODEX_SESSION_ID',
    'CURSOR_TRACE_ID',
    'CURSOR_AGENT',
    'CURSOR_SESSION_ID',
    'CURSOR',
    'CONSENSUS_PARENT_HOST',
    'CONSENSUS_RUN_ID',
    'CONSENSUS_DEPTH',
  ]) {
    delete env[key];
  }
  return env;
}

async function writeProviderExecutable(binDir: string, name: string) {
  const providerPath = path.join(binDir, name);
  await writeFile(
    providerPath,
    [
      '#!/usr/bin/env node',
      'if (process.argv.includes("--version")) {',
      '  console.log("fixture provider 1.0.0");',
      '  process.exit(0);',
      '}',
      'const verdict = process.env.CONSENSUS_PROVIDER_FIXTURE_VERDICT ?? "ACCEPT";',
      'const payload = { schema_version: "v1", verdict, reasoning: `${process.argv[1]} accepts` };',
      'if (verdict !== "ACCEPT") payload.proposed_artifact = "# Proposed\\n\\nFixture."; ',
      'console.log(JSON.stringify(payload));',
      '',
    ].join('\n'),
  );
  await chmod(providerPath, 0o755);
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

it('runs the generated default provider CLI path without CONSENSUS_CLI_PATH', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-refine-cli-default-'),
  );
  const binDir = path.join(tempRoot, 'bin');
  await mkdir(binDir, { recursive: true });
  await writeProviderExecutable(binDir, 'claude');
  await writeProviderExecutable(binDir, 'codex');
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const env = scrubHostEnv(
    makeStubEnv({
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      CONSENSUS_PROVIDER_BACKEND: 'provider-cli',
    }),
  );
  delete env.CONSENSUS_CLI_PATH;

  const result = await runSequential({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    env,
    goal: 'Exercise the generated provider CLI path.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
  });

  expect(result.status).toBe('converged');
  const records = JSON.parse(
    await readFile(result.sections[0].paths.records, 'utf8'),
  );
  expect(records[0]).toMatchObject({
    raw_provider_response: expect.stringContaining('"verdict":"ACCEPT"'),
    provider_diagnostics: expect.objectContaining({
      strategy_used: expect.any(String),
    }),
    attempts: { cli_attempts: 1, terminal_reason: 'success' },
  });
  expect(records[0]).not.toHaveProperty('raw_paseo_response');
});

it('runs prepared parallel section packets through the provider CLI backend', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-refine-cli-prepared-'),
  );
  const callsPath = path.join(tempRoot, 'calls.jsonl');
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const env = makeProviderCliEnv({
    CONSENSUS_STUB_CALLS_JSONL: callsPath,
    CONSENSUS_STUB_VERDICT: 'CONVERGED',
  });

  const prepared = await prepareParallelRun({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    env,
    goal: 'Exercise prepared parallel provider CLI backend.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
    iteration: 'parallel_synthesized',
    synthesizer: 'codex',
    parallelism: 1,
  });
  const manifest = JSON.parse(await readFile(prepared.manifestPath, 'utf8'));
  const [section] = manifest.sections;
  expect(manifest.provider_backend).toBe('provider-cli');
  expect(section.provider_backend).toBe('provider-cli');
  expect(section.provider_env).toMatchObject({
    CONSENSUS_PROVIDER_BACKEND: 'provider-cli',
    CONSENSUS_CLI_PATH: expect.stringContaining('tests/fixtures/bin/consensus'),
  });
  expect(section.loop_argv).toContain('--provider-backend');
  expect(
    section.loop_argv[section.loop_argv.indexOf('--provider-backend') + 1],
  ).toBe('provider-cli');

  await runNodeScript(
    path.join(
      repoRoot,
      'plugins/consensus/skills/refine/scripts/consensus-loop.mjs',
    ),
    section.loop_argv,
    { cwd: tempRoot, env },
  );

  const records = JSON.parse(await readFile(section.output_records, 'utf8'));
  expect(
    records.some((record: JsonRecord) => record.raw_provider_response),
  ).toBe(true);
  expect(records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        raw_provider_response: expect.stringContaining('"verdict":"CONVERGED"'),
        provider_diagnostics: expect.objectContaining({
          strategy_used: 'fixture_consensus_cli',
        }),
      }),
    ]),
  );
  expect(records).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ raw_paseo_response: expect.any(String) }),
    ]),
  );
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
