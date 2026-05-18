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
      }
    },
    value() {
      return value;
    }
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
    }
  });

  assert.equal(result.status, 'passed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, [path.join(repoRoot, 'scripts/validate.mjs')]);
  assert.match(result.env.PATH.split(path.delimiter)[0], /tests\/fixtures\/bin$/);
  assert.equal(result.events.at(-1).event, 'run_completed');
  assert.equal(result.events.at(-1).status, 'converged');
  assert.match(result.artifact, /## Final Output/);
  assert.match(result.artifact, /<!-- consensus:consensus-resolution/);
  assert.match(stdout.value(), /smoke passed/);
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
        CONSENSUS_SMOKE_EXPECT_STATUS: 'partial'
      }
    }),
    /expected smoke status partial/
  );
});
