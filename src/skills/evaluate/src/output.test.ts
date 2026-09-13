import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  renderEvaluationArtifact,
  runConsensusEvaluate,
  runEvaluateCli,
} from '../../../src/consensus/evaluate/consensus-evaluate.js';
import { makeProviderCliEnv } from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

const unifiedFindings =
  '# Evaluation\n\n## Unified Findings\n\n- Release readiness is medium.\n';

async function fixtureFiles(prefix = 'consensus-evaluate-output-') {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  const artifactPath = path.join(tempRoot, 'artifact.md');
  const rubricPath = path.join(tempRoot, 'rubric.md');
  const outputPath = path.join(tempRoot, 'evaluation.md');
  const runDir = path.join(tempRoot, '.consensus/evaluate-run');

  await writeFile(artifactPath, '# Artifact\n\nShip candidate.\n');
  await writeFile(
    rubricPath,
    '# Rubric\n\n- Correctness\n- Risk disclosure\n',
  );

  return { tempRoot, artifactPath, rubricPath, outputPath, runDir };
}

function extractJsonBlocks(markdown: string, label: string): JsonRecord[] {
  const pattern = new RegExp(
    '<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->',
    'g',
  );
  const blocks: JsonRecord[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

it('runs the evaluate wrapper with loop state files and renders unified findings', async () => {
  const files = await fixtureFiles();
  const prompts: string[] = [];

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
      '--max-rounds',
      '1',
    ],
    {
      cwd: files.tempRoot,
      env: makeProviderCliEnv(),
      now: () => '2026-06-17T00:00:00.000Z',
      invokePeer: async ({ provider, prompt }) => {
        prompts.push(prompt);
        return {
          stdout: JSON.stringify({ provider }),
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: `${provider} found release-readiness risks.`,
            proposed_artifact: unifiedFindings,
          },
        };
      },
    },
  );

  expect(result.loopArgv).toEqual(
    expect.arrayContaining([
      '--output-records',
      result.paths.records,
      '--output-section',
      result.paths.output,
      '--output-status',
      result.paths.status,
    ]),
  );
  await expect(stat(result.paths.records)).resolves.toMatchObject({});
  await expect(stat(result.paths.output)).resolves.toMatchObject({});
  await expect(stat(result.paths.status)).resolves.toMatchObject({});

  const artifact = await readFile(files.outputPath, 'utf8');
  expect(prompts.every((prompt) => prompt.includes('<RUBRIC>'))).toBe(true);
  expect(result.status.status).toBe('converged');
  expect(artifact).toContain('## Unified findings');
  expect(artifact).toContain('Release readiness is medium.');
  expect(artifact).toContain('## Deliberation log');
  expect(artifact).not.toContain('## Dissent');

  const verdicts = extractJsonBlocks(artifact, 'consensus-verdict');
  expect(verdicts).toHaveLength(2);
  expect(verdicts.map((record) => record.verdict)).toEqual([
    'REVISE',
    'REVISE',
  ]);
  expect(verdicts.map((record) => record.reasoning)).toEqual([
    'claude found release-readiness risks.',
    'codex found release-readiness risks.',
  ]);
});

it('writes a default sidecar evaluation for CLI runs without --output', async () => {
  const files = await fixtureFiles('consensus-evaluate-default-output-');
  let stdout = '';
  let stderr = '';

  const exitCode = await runEvaluateCli(
    [
      files.artifactPath,
      '--rubric',
      files.rubricPath,
      '--run-dir',
      files.runDir,
      '--allow-root',
      files.tempRoot,
      '--peers',
      'claude,codex',
      '--max-rounds',
      '1',
    ],
    {
      cwd: files.tempRoot,
      env: makeProviderCliEnv(),
      now: () => '2026-06-17T00:00:00.000Z',
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
      invokePeer: async ({ provider }) => ({
        stdout: JSON.stringify({ provider }),
        json: {
          schema_version: 'v1',
          verdict: 'REVISE',
          reasoning: `${provider} found release-readiness risks.`,
          proposed_artifact: unifiedFindings,
        },
      }),
    },
  );

  expect(exitCode).toBe(0);
  expect(stderr).toBe('');
  const events = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as JsonRecord);
  const completed = events.find((event) => event.event === 'run_completed');
  const defaultOutputPath = `${files.artifactPath}.evaluation.md`;

  expect(completed?.output_path).toBe(defaultOutputPath);
  expect(stdout).not.toContain('# Consensus Evaluate Artifact');

  const artifact = await readFile(defaultOutputPath, 'utf8');
  expect(artifact).toContain('# Consensus Evaluate Artifact');
  expect(artifact).toContain('Release readiness is medium.');
});

it('reports provider CLI auth failures through Evaluate CLI JSONL', async () => {
  const files = await fixtureFiles('consensus-evaluate-auth-');
  const consensusPath = path.join(files.tempRoot, 'consensus');
  await writeFile(
    consensusPath,
    [
      '#!/usr/bin/env node',
      'const args = process.argv.slice(2);',
      'if (args[0] === "provider") { console.log(JSON.stringify({ schema_version: "v1", ok: true, providers: [{ id: "cursor", status: "auth_required" }, { id: "claude", status: "ready" }] })); process.exit(0); }',
      'console.log(JSON.stringify({ schema_version: "v1", ok: true, usable: false, providers: [{ id: args.at(-1), status: "auth_required" }] }));',
      '',
    ].join('\n'),
  );
  await chmod(consensusPath, 0o755);
  let stdout = '';
  let stderr = '';

  const exitCode = await runEvaluateCli(
    [
      files.artifactPath,
      '--rubric',
      files.rubricPath,
      '--run-dir',
      files.runDir,
      '--allow-root',
      files.tempRoot,
      '--peers',
      'cursor,claude',
      '--max-rounds',
      '1',
    ],
    {
      cwd: files.tempRoot,
      env: {
        ...process.env,
        CONSENSUS_CLI_PATH: consensusPath,
      },
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
    },
  );

  expect(exitCode).toBe(78);
  const events = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as JsonRecord);
  const error = events.find((event) => event.event === 'error');
  expect(error).toMatchObject({
    code: 'PEER_UNAVAILABLE',
    exit_code: 78,
  });
  expect(error?.message).toMatch(/cursor/);
  expect(error?.message).toMatch(/auth_required/);
  expect(stderr).toMatch(/cursor/);
  expect(stderr).not.toMatch(/install/i);
});

it('renders unresolved dissent for impasse runs', async () => {
  const files = await fixtureFiles('consensus-evaluate-impasse-');

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
      '--max-rounds',
      '1',
    ],
    {
      cwd: files.tempRoot,
      env: makeProviderCliEnv(),
      now: () => '2026-06-17T00:00:00.000Z',
      invokePeer: async ({ provider }) => ({
        stdout: JSON.stringify({ provider }),
        json: {
          schema_version: 'v1',
          verdict: 'IMPASSE',
          reasoning: `${provider} cannot reconcile the release risk.`,
        },
      }),
    },
  );

  const artifact = await readFile(files.outputPath, 'utf8');
  expect(result.status.status).toBe('impasse');
  expect(artifact).toContain('## Unresolved dissent');
  expect(artifact).toContain('claude cannot reconcile the release risk.');
  expect(artifact).toContain('codex cannot reconcile the release risk.');
});

it('renders converged dissent only when residual concerns remain', () => {
  const clean = renderEvaluationArtifact({
    unifiedFindings,
    records: [
      {
        agent: 'claude',
        round_index: 1,
        verdict: 'CONVERGED',
        reasoning: 'No remaining concerns.',
      },
      {
        agent: 'codex',
        round_index: 1,
        verdict: 'CONVERGED',
        reasoning: 'No remaining concerns.',
      },
    ],
    status: { status: 'converged' },
    metadata: { peers: ['claude', 'codex'] },
  });

  expect(clean).not.toContain('## Dissent');

  const withConcerns = renderEvaluationArtifact({
    unifiedFindings,
    records: [
      {
        agent: 'claude',
        round_index: 1,
        verdict: 'CONVERGED',
        reasoning: 'The evaluation is acceptable.',
        concerns: ['Evidence for criterion B is thin.'],
      },
      {
        agent: 'codex',
        round_index: 1,
        verdict: 'CONVERGED',
        reasoning: 'The evaluation is acceptable.',
      },
    ],
    status: { status: 'converged' },
    metadata: { peers: ['claude', 'codex'] },
  });

  expect(withConcerns).toContain('## Dissent');
  expect(withConcerns).toContain('Evidence for criterion B is thin.');
  expect(withConcerns).not.toContain('## Unresolved dissent');
});

it('renders escalation status as unresolved dissent', () => {
  const artifact = renderEvaluationArtifact({
    unifiedFindings,
    records: [
      {
        agent: 'claude',
        round_index: 3,
        verdict: 'REVISE',
        reasoning: 'Risk is blocking.',
        proposed_artifact: 'Blocking evaluation.\n',
      },
      {
        agent: 'codex',
        round_index: 3,
        verdict: 'REVISE',
        reasoning: 'Risk is manageable.',
        proposed_artifact: 'Non-blocking evaluation.\n',
      },
    ],
    status: {
      status: 'escalation',
      termination_reason: 'escalation_persistent_disagreement',
    },
    metadata: { peers: ['claude', 'codex'] },
  });

  expect(artifact).toContain('## Unresolved dissent');
  expect(artifact).toContain('Risk is blocking.');
  expect(artifact).toContain('Risk is manageable.');
});
