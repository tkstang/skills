import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { runConsensusCreate } from '../../../src/consensus/create/consensus-create.js';
import { makeProviderCliEnv, parseJsonl } from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

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
