import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runConsensusEvaluate } from '../../../src/consensus/evaluate/consensus-evaluate.js';
import { makeProviderCliEnv, parseJsonl } from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

async function fixtureFiles() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-evaluate-cli-integration-'),
  );
  const artifactPath = path.join(tempRoot, 'artifact.md');
  const rubricPath = path.join(tempRoot, 'rubric.md');
  const outputPath = path.join(tempRoot, 'evaluation.md');
  const runDir = path.join(tempRoot, '.consensus/evaluate-run');
  const callsPath = path.join(tempRoot, 'calls.jsonl');

  await writeFile(artifactPath, '# Artifact\n\nShip candidate.\n');
  await writeFile(rubricPath, '# Rubric\n\n- Identify release risk.\n');

  return { tempRoot, artifactPath, rubricPath, outputPath, runDir, callsPath };
}

it('runs Evaluate through the consensus CLI backend with provider-neutral records', async () => {
  const files = await fixtureFiles();
  const env = makeProviderCliEnv({
    CONSENSUS_STUB_CALLS_JSONL: files.callsPath,
    CONSENSUS_STUB_VERDICT: 'REVISE',
    CONSENSUS_STUB_PROPOSED_ARTIFACT:
      '# Evaluation\n\n## Unified Findings\n\n- Release readiness is medium.\n',
    CONSENSUS_STUB_SYNTHESIZED_ARTIFACT:
      '# Evaluation\n\n## Unified Findings\n\n- Release readiness is medium.\n',
  });

  const result = await runConsensusEvaluate(
    [
      files.artifactPath,
      '--rubric',
      files.rubricPath,
      '--output',
      files.outputPath,
      '--run-dir',
      files.runDir,
      '--allow-root',
      files.tempRoot,
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
      cwd: files.tempRoot,
      env,
    },
  );

  const calls = parseJsonl<JsonRecord>(await readFile(files.callsPath, 'utf8'));
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
  expect(result.status.status).toBe('max-rounds');
  expect(result.records[0]).toMatchObject({
    raw_provider_response: expect.stringContaining('Release readiness'),
    provider_diagnostics: {
      strategy_used: 'fixture_consensus_cli',
    },
    attempts: {
      cli_attempts: 1,
      terminal_reason: 'success',
    },
  });
  expect(result.records[0]).not.toHaveProperty('raw_paseo_response');

  const artifact = await readFile(files.outputPath, 'utf8');
  expect(artifact).toContain('Release readiness is medium.');
  expect(artifact).not.toContain('raw_paseo_response');
});
