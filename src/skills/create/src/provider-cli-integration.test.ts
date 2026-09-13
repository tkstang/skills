import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  runConsensusCreate,
  runCreateCli,
} from '../../../src/consensus/create/consensus-create.js';
import {
  makeProviderCliEnv,
  parseJsonl,
} from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

function captureCreateWriter() {
  let contents = '';
  return {
    stream: {
      write(chunk: string | Uint8Array) {
        contents += String(chunk);
        return true;
      },
    },
    value() {
      return contents;
    },
  };
}

it('classifies missing and duplicate brief sources as usage errors before provider calls', async () => {
  const cases = [
    {
      argv: [],
      code: 'MISSING_BRIEF_SOURCE',
      message: /requires --brief or --brief-file/,
    },
    {
      argv: ['--brief', 'x', '--brief-file', 'y'],
      code: 'DUPLICATE_BRIEF_SOURCE',
      message: /exactly one of --brief or --brief-file/,
    },
  ];

  for (const testCase of cases) {
    const stdout = captureCreateWriter();
    const stderr = captureCreateWriter();
    const providerCalls: string[] = [];
    const exitCode = await runCreateCli(testCase.argv, {
      env: makeProviderCliEnv(),
      stdout: stdout.stream,
      stderr: stderr.stream,
      invokePeer: async () => {
        providerCalls.push('peer');
        throw new Error('provider call should not run');
      },
      invokeSynthesizer: async () => {
        providerCalls.push('synthesizer');
        throw new Error('synthesizer call should not run');
      },
    });

    expect(exitCode).toBe(64);
    expect(providerCalls).toEqual([]);
    const events = parseJsonl<JsonRecord>(stdout.value());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'error',
      code: testCase.code,
      exit_code: 64,
    });
    expect(events[0].message).toMatch(testCase.message);
    expect(stderr.value()).toMatch(testCase.message);
  }
});

it('keeps first-round independent create prompts free of shared placeholder drafts', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-create-cli-integration-'),
  );
  const outputPath = path.join(tempRoot, 'created.md');
  const runDir = path.join(tempRoot, '.consensus/create-run');
  await writeFile(
    path.join(tempRoot, 'template.md'),
    '# Template\n\nUse a title and one concise paragraph.\n',
  );

  const peerPrompts: JsonRecord[] = [];

  const result = await runConsensusCreate(
    [
      '--brief',
      'Draft a concise launch announcement.',
      '--template',
      'template.md',
      '--output',
      outputPath,
      '--run-dir',
      runDir,
      '--allow-root',
      tempRoot,
      '--peers',
      'claude,codex',
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'cursor',
      '--max-rounds',
      '1',
    ],
    {
      cwd: tempRoot,
      env: makeProviderCliEnv(),
      invokePeer: async ({ provider, round, prompt, artifact }) => {
        peerPrompts.push({ provider, round, prompt, artifact });
        return {
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: `${provider} drafted from the brief.`,
            proposed_artifact: `# ${provider} launch draft\n\nCreated from the brief.\n`,
          },
        };
      },
      invokeSynthesizer: async () => ({
        json: {
          schema_version: 'v1',
          synthesized_artifact:
            '# Synthesized Launch Draft\n\nCreated from both peer drafts.\n',
          synthesis_reasoning: 'fixture synthesis',
          unresolved_disagreements: [],
        },
      }),
    },
  );

  const firstRoundPrompts = peerPrompts.filter((call) => call.round === 1);
  expect(firstRoundPrompts).toHaveLength(2);
  for (const call of firstRoundPrompts) {
    expect(call.artifact).toBe('');
    expect(call.prompt).toContain('<CREATE_BRIEF>');
    expect(call.prompt).toContain('Draft a concise launch announcement.');
    expect(call.prompt).toContain('<CREATE_TEMPLATE>');
    expect(call.prompt).toContain('Use a title and one concise paragraph.');
    expect(call.prompt).toContain('produce a complete draft artifact');
    expect(call.prompt).not.toContain('Current draft artifact:');
    expect(call.prompt).not.toContain('<CREATE_DRAFT>');
    expect(call.prompt).not.toContain('Pending peer creation.');
  }
  await expect(readFile(result.paths.input, 'utf8')).resolves.toBe('');
});

it('runs Create through the consensus loop with provider-neutral records', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-create-cli-integration-'),
  );
  const outputPath = path.join(tempRoot, 'created.md');
  const runDir = path.join(tempRoot, '.consensus/create-run');
  const callsPath = path.join(tempRoot, 'calls.jsonl');
  const env = makeProviderCliEnv({
    CONSENSUS_STUB_CALLS_JSONL: callsPath,
    CONSENSUS_STUB_VERDICT: 'REVISE',
    CONSENSUS_STUB_PROPOSED_ARTIFACT:
      '# Created Artifact\n\nPeer draft from the launch brief.\n',
    CONSENSUS_STUB_SYNTHESIZED_ARTIFACT:
      '# Created Artifact\n\nSynthesized artifact from the launch brief.\n',
  });

  const result = await runConsensusCreate(
    [
      '--brief',
      'Draft a concise launch announcement.',
      '--output',
      outputPath,
      '--run-dir',
      runDir,
      '--allow-root',
      tempRoot,
      '--peers',
      'claude,codex',
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'cursor',
      '--max-rounds',
      '1',
    ],
    {
      cwd: tempRoot,
      env,
    },
  );

  expect(result.loopArgv).toEqual(
    expect.arrayContaining(['--cold-start', 'independent_draft']),
  );
  expect(result.status).toMatchObject({
    status: 'converged',
    cold_start: 'independent_draft',
    iteration_mode: 'parallel_synthesized',
    agency: 'maximum',
    peer_calls: 2,
    synthesis_calls: 1,
  });

  const calls = parseJsonl<JsonRecord>(await readFile(callsPath, 'utf8'));
  expect(calls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ event: 'provider_ls' }),
      expect.objectContaining({ event: 'preflight', provider: 'claude' }),
      expect.objectContaining({ event: 'preflight', provider: 'codex' }),
      expect.objectContaining({ event: 'preflight', provider: 'cursor' }),
      expect.objectContaining({ event: 'run', provider: 'claude' }),
      expect.objectContaining({ event: 'run', provider: 'codex' }),
      expect.objectContaining({ event: 'run', provider: 'cursor' }),
    ]),
  );

  const artifact = await readFile(outputPath, 'utf8');
  expect(artifact).toContain('Synthesized artifact from the launch brief.');
  expect(artifact).toContain('## Deliberation Log');
  expect(artifact).toContain('<!-- consensus:consensus-resolution');
  expect(artifact).toContain('"cold_start": "independent_draft"');
  expect(artifact).toContain('"iteration": "parallel_synthesized"');
  expect(artifact).toContain('"agency": "maximum"');
  expect(artifact).toContain('"peer_calls": 2');
  expect(artifact).toContain('"synthesis_calls": 1');
});
