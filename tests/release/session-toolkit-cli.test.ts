import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const bin = resolve('packages/session-toolkit/dist/bin.js');
const library = new URL(
  '../../packages/session-toolkit/dist/index.js',
  import.meta.url,
).href;

function isolated<T>(run: (cwd: string, env: NodeJS.ProcessEnv) => T): T {
  const cwd = mkdtempSync(join(tmpdir(), 'session-toolkit-cli-'));
  try {
    return run(cwd, {
      ...process.env,
      HOME: cwd,
      STATE_DIR: join(cwd, 'state'),
      NO_COLOR: '1',
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function cli(args: string[]) {
  return isolated((cwd, env) =>
    spawnSync(process.execPath, [bin, ...args], { cwd, env, encoding: 'utf8' }),
  );
}

describe('Session Toolkit public CLI boundary', () => {
  it('advertises only implemented capabilities and accepts JSON on either side of the command', () => {
    for (const args of [
      ['capabilities'],
      ['--json', 'capabilities'],
      ['capabilities', '--json'],
    ]) {
      const result = cli(args);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        ok: true,
        schema_version: 1,
        data: {
          package: '@tkstang/session-toolkit',
          version: '0.1.0',
          schema_version: 1,
          node: '>=22.0.0',
          capabilities: [
            'toolkit.capabilities.v1',
            'cli.help.v1',
            'cli.version.v1',
          ],
          providers: [],
        },
      });
    }
  });

  it('preserves machine framing for help, version and actionable usage errors', () => {
    for (const args of [
      ['--help', '--json'],
      ['capabilities', '--help', '--json'],
      ['--json', '--version'],
    ]) {
      const result = cli(args);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        schema_version: 1,
      });
    }
    for (const args of [
      ['read', '--json'],
      ['capabilities', '--unknown', '--json'],
      ['capabilities', 'unexpected', '--json'],
    ]) {
      const result = cli(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        schema_version: 1,
        error: { code: 'E_USAGE', hint: expect.any(String) },
      });
    }
    const plain = cli(['read']);
    expect(plain.status).toBe(1);
    expect(plain.stdout).toBe('');
    expect(plain.stderr).toContain('seshtk --help');
  });

  it('keeps library imports silent, argument-independent and free of state writes', () => {
    isolated((cwd, env) => {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
        process.argv.push('read', '--unknown');
        const { getCapabilities } = await import(${JSON.stringify(library)});
        const capabilities = getCapabilities();
        if (capabilities.providers.length !== 0) throw new Error('Unexpected provider support');
      `,
        ],
        { cwd, env, encoding: 'utf8' },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(readdirSync(cwd)).toEqual([]);
    });
  });
});
