#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASEO_PACKAGE = '@getpaseo/cli';
export const INSTALL_COMMAND = `npm install -g ${PASEO_PACKAGE}`;

function defaultStream(stream, fallback) {
  return stream ?? fallback;
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        code,
        signal
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      const error = new Error(`${command} exited with code ${code}`);
      Object.assign(error, result);
      reject(error);
    });
  });
}

async function confirmInstall({ stdin, stdout }) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  try {
    const answer = await rl.question(`About to run "${INSTALL_COMMAND}". Continue? [y/N] `);
    return /^y(?:es)?$/iu.test(answer.trim());
  } finally {
    rl.close();
  }
}

function errorText(error) {
  return String(error?.stderr || error?.message || error || '').trim();
}

export async function runInstallPaseo(options = {}) {
  const stdin = defaultStream(options.stdin, process.stdin);
  const stdout = defaultStream(options.stdout, process.stdout);
  const stderr = defaultStream(options.stderr, process.stderr);
  const execute = options.runCommand ?? runCommand;

  const confirmed = await confirmInstall({ stdin, stdout });
  if (!confirmed) {
    stdout.write('\nInstall cancelled. Install manually with "npm install -g @getpaseo/cli" or build from https://github.com/getpaseo/paseo.\n');
    return { status: 'declined', exitCode: 1 };
  }

  try {
    await execute('npm', ['install', '-g', PASEO_PACKAGE], {
      cwd: options.cwd,
      env: options.env
    });
  } catch (error) {
    stderr.write(`\n${errorText(error) || 'npm install failed'}\n`);
    return { status: 'failed', exitCode: 1, error };
  }

  try {
    const version = await execute('paseo', ['--version'], {
      cwd: options.cwd,
      env: options.env
    });
    const versionText = version.stdout.trim();
    stdout.write(`\nPaseo install verified: ${versionText}\n`);
    return { status: 'installed', exitCode: 0, version: versionText };
  } catch (error) {
    stderr.write(`\npaseo --version failed after install.\n${errorText(error)}\n`);
    return { status: 'failed', exitCode: 1, error };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runInstallPaseo().then((result) => {
    process.exitCode = result.exitCode;
  });
}
