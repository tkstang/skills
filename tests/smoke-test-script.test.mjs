import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { runSmokeTest } from '../scripts/smoke-test.mjs';
import { runNodeScript } from './helpers/process.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const smokeScript = path.join(repoRoot, 'scripts/smoke-test.mjs');

function writer() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

test('runSmokeTest runs validation, uses the Paseo stub, and verifies wrapper output', async () => {
  const stdout = writer();
  const calls = [];

  const result = await runSmokeTest({
    stdout: stdout.stream,
    runCommand: async (command, args, options) => {
      calls.push({ command, args, env: options.env });
      return { stdout: '', stderr: '' };
    },
  });

  assert.equal(result.status, 'passed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, [
    path.join(repoRoot, 'scripts/validate.mjs'),
  ]);
  assert.match(
    result.env.PATH.split(path.delimiter)[0],
    /tests\/fixtures\/bin$/,
  );
  assert.equal(result.events.at(-1).event, 'run_completed');
  assert.equal(result.events.at(-1).status, 'converged');
  assert.match(result.artifact, /## Final Output/);
  assert.match(result.artifact, /<!-- consensus:consensus-resolution/);
  assert.match(stdout.value(), /smoke passed/);

  // The smoke now also drives a parallel-synthesized escalation + host-direction
  // resume to convergence.
  assert.ok(
    result.parallelSynthesized,
    'parallel-synthesized smoke scenario missing',
  );
  assert.equal(result.parallelSynthesized.status, 'converged');
  assert.equal(
    result.parallelSynthesized.escalation.trigger,
    'persistent_disagreement',
  );
  assert.equal(result.parallelSynthesized.escalation.decide_via, 'host');
  assert.equal(
    result.parallelSynthesized.escalation.resume.flag,
    '--host-direction',
  );
});

test('runParallelSynthesizedSmoke escalates once then converges via --host-direction', async () => {
  const { runParallelSynthesizedSmoke } =
    await import('../scripts/smoke-test.mjs');
  const result = await runParallelSynthesizedSmoke();

  assert.equal(result.status, 'converged');
  assert.equal(result.escalation.event, 'escalation_required');
  assert.equal(result.escalation.trigger, 'persistent_disagreement');
});

test('smoke-test CLI exits zero on deterministic fixture run', async () => {
  const result = await runNodeScript(smokeScript, [], { cwd: repoRoot });
  assert.match(result.stdout, /smoke passed/);
});

test('smoke-test CLI exits non-zero on failed assertions', async () => {
  await assert.rejects(
    runNodeScript(smokeScript, [], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CONSENSUS_SMOKE_EXPECT_STATUS: 'partial',
      },
    }),
    /expected smoke status partial/,
  );
});
