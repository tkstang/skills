import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  INSTALL_COMMAND,
  PASEO_PACKAGE,
  runInstallPaseo
} from '../scripts/install-paseo.mjs';

function input(text) {
  return Readable.from([text]);
}

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

test('default decline does not run npm', async () => {
  const stdout = writer();
  const calls = [];

  const result = await runInstallPaseo({
    stdin: input('\n'),
    stdout: stdout.stream,
    runCommand: async (command, args) => {
      calls.push([command, args]);
    }
  });

  assert.equal(result.status, 'declined');
  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls, []);
  assert.match(stdout.value(), /About to run "npm install -g @getpaseo\/cli"\. Continue\? \[y\/N\]/);
});

test('explicit yes installs hardcoded package and verifies paseo version', async () => {
  const stdout = writer();
  const calls = [];

  const result = await runInstallPaseo({
    stdin: input('y\n--not-an-arg\n'),
    stdout: stdout.stream,
    runCommand: async (command, args) => {
      calls.push([command, args]);
      if (command === 'paseo') return { stdout: 'paseo 0.4.0\n', stderr: '' };
      return { stdout: 'installed\n', stderr: '' };
    }
  });

  assert.equal(PASEO_PACKAGE, '@getpaseo/cli');
  assert.equal(INSTALL_COMMAND, 'npm install -g @getpaseo/cli');
  assert.deepEqual(calls, [
    ['npm', ['install', '-g', '@getpaseo/cli']],
    ['paseo', ['--version']]
  ]);
  assert.equal(result.status, 'installed');
  assert.equal(result.exitCode, 0);
  assert.equal(result.version, 'paseo 0.4.0');
  assert.doesNotMatch(JSON.stringify(calls), /not-an-arg/);
});

test('npm failure is surfaced without retry or version check', async () => {
  const stdout = writer();
  const stderr = writer();
  const calls = [];

  const result = await runInstallPaseo({
    stdin: input('y\n'),
    stdout: stdout.stream,
    stderr: stderr.stream,
    runCommand: async (command, args) => {
      calls.push([command, args]);
      const error = new Error('npm failed');
      error.stderr = 'permission denied\n';
      throw error;
    }
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls, [['npm', ['install', '-g', '@getpaseo/cli']]]);
  assert.match(stderr.value(), /permission denied/);
});

test('post-install paseo version failure is surfaced plainly', async () => {
  const stdout = writer();
  const stderr = writer();
  const calls = [];

  const result = await runInstallPaseo({
    stdin: input('y\n'),
    stdout: stdout.stream,
    stderr: stderr.stream,
    runCommand: async (command, args) => {
      calls.push([command, args]);
      if (command === 'paseo') {
        const error = new Error('paseo missing');
        error.stderr = 'paseo: command not found\n';
        throw error;
      }
      return { stdout: 'installed\n', stderr: '' };
    }
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls, [
    ['npm', ['install', '-g', '@getpaseo/cli']],
    ['paseo', ['--version']]
  ]);
  assert.match(stderr.value(), /paseo --version failed/);
  assert.match(stderr.value(), /paseo: command not found/);
});
