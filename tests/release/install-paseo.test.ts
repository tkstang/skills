import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import { INSTALL_COMMAND, PASEO_PACKAGE, runInstallPaseo } from '../../scripts/install-paseo.mjs';

function input(text: string) {
  return Readable.from([text]);
}

function writer() {
  let value = '';
  return {
    stream: {
      write(chunk: string) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

describe('install-paseo', () => {
  it('default decline does not run npm', async () => {
    const stdout = writer();
    const calls: [string, string[]][] = [];

    const result = await runInstallPaseo({
      stdin: input('\n'),
      stdout: stdout.stream,
      runCommand: async (command: string, args: string[]) => {
        calls.push([command, args]);
      },
    });

    expect(result.status).toBe('declined');
    expect(result.exitCode).toBe(1);
    expect(calls).toEqual([]);
    expect(stdout.value()).toMatch(
      /About to run "npm install -g @getpaseo\/cli"\. Continue\? \[y\/N\]/,
    );
  });

  it('explicit yes installs hardcoded package and verifies paseo version', async () => {
    const stdout = writer();
    const calls: [string, string[]][] = [];

    const result = await runInstallPaseo({
      stdin: input('y\n--not-an-arg\n'),
      stdout: stdout.stream,
      runCommand: async (command: string, args: string[]) => {
        calls.push([command, args]);
        if (command === 'paseo') return { stdout: 'paseo 0.4.0\n', stderr: '' };
        return { stdout: 'installed\n', stderr: '' };
      },
    });

    expect(PASEO_PACKAGE).toBe('@getpaseo/cli');
    expect(INSTALL_COMMAND).toBe('npm install -g @getpaseo/cli');
    expect(calls).toEqual([
      ['npm', ['install', '-g', '@getpaseo/cli']],
      ['paseo', ['--version']],
    ]);
    expect(result.status).toBe('installed');
    expect(result.exitCode).toBe(0);
    expect(result.version).toBe('paseo 0.4.0');
    expect(JSON.stringify(calls)).not.toMatch(/not-an-arg/);
  });

  it('npm failure is surfaced without retry or version check', async () => {
    const stdout = writer();
    const stderr = writer();
    const calls: [string, string[]][] = [];

    const result = await runInstallPaseo({
      stdin: input('y\n'),
      stdout: stdout.stream,
      stderr: stderr.stream,
      runCommand: async (command: string, args: string[]) => {
        calls.push([command, args]);
        const error: any = new Error('npm failed');
        error.stderr = 'permission denied\n';
        throw error;
      },
    });

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
    expect(calls).toEqual([['npm', ['install', '-g', '@getpaseo/cli']]]);
    expect(stderr.value()).toMatch(/permission denied/);
  });

  it('post-install paseo version failure is surfaced plainly', async () => {
    const stdout = writer();
    const stderr = writer();
    const calls: [string, string[]][] = [];

    const result = await runInstallPaseo({
      stdin: input('y\n'),
      stdout: stdout.stream,
      stderr: stderr.stream,
      runCommand: async (command: string, args: string[]) => {
        calls.push([command, args]);
        if (command === 'paseo') {
          const error: any = new Error('paseo missing');
          error.stderr = 'paseo: command not found\n';
          throw error;
        }
        return { stdout: 'installed\n', stderr: '' };
      },
    });

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
    expect(calls).toEqual([
      ['npm', ['install', '-g', '@getpaseo/cli']],
      ['paseo', ['--version']],
    ]);
    expect(stderr.value()).toMatch(/paseo --version failed/);
    expect(stderr.value()).toMatch(/paseo: command not found/);
  });
});
