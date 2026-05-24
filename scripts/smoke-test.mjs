#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { runWrapperCli } from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      }
    },
    value() {
      return value;
    }
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
    maxBuffer: 8 * 1024 * 1024
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

function smokeEnv(env = process.env) {
  const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');
  return {
    ...env,
    PATH: `${fixtureBin}${path.delimiter}${env.PATH ?? ''}`
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

export async function runSmokeTest(options = {}) {
  const root = path.resolve(options.root ?? repoRoot);
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const runCommand = options.runCommand ?? defaultRunCommand;
  const env = smokeEnv(options.env ?? process.env);
  const expectedStatus = env.CONSENSUS_SMOKE_EXPECT_STATUS ?? 'converged';

  await runCommand(process.execPath, [path.join(root, 'scripts/validate.mjs')], {
    cwd: root,
    env
  });

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-smoke-'));
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const wrapperStdout = captureWriter();
  const wrapperStderr = captureWriter();
  const sampleInput = path.join(root, 'tests/fixtures/sample-input.md');

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
      '2'
    ],
    {
      stdout: wrapperStdout.stream,
      stderr: wrapperStderr.stream,
      cwd: tempRoot,
      env,
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] })
    }
  );

  assert.equal(exitCode, 0, wrapperStderr.value());
  const events = parseJsonl(wrapperStdout.value());
  const completed = events.find((event) => event.event === 'run_completed');
  assert.ok(completed, 'wrapper did not emit run_completed');
  assert.equal(completed.status, expectedStatus, `expected smoke status ${expectedStatus}`);

  const artifact = await readFile(outputPath, 'utf8');
  assertArtifactShape(artifact);

  stdout.write('smoke passed\n');
  return { status: 'passed', env, events, artifact, outputPath, runDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSmokeTest().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
