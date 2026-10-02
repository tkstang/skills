import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { withStubProbe } from '../helpers/test-helpers.js';
import {
  DEFAULT_PROBE_TIMEOUT_MS,
  probeTimeoutMs,
  probeTools,
} from './tools.js';

let root: string;
let stubDir: string;

function writeStub(dir: string, name: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, '#!/bin/sh\necho stub\n');
  chmodSync(file, 0o755);
  return file;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'session-search-tools-'));
  stubDir = path.join(root, 'bin');
  mkdirSync(stubDir);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// The absolute fallback directories are part of the contract, so a machine
// with real rg/sqlite3 installed there would resolve them. Tests therefore
// assert on overrides, forced fallbacks, and PATH stubs only.
describe.skipIf(process.platform === 'win32')('probeTools', () => {
  it('resolves explicit overrides that point at an executable', () => {
    const rg = writeStub(stubDir, 'custom-rg');
    const sqlite3 = writeStub(stubDir, 'custom-sqlite3');

    const probe = probeTools(
      withStubProbe({
        PATH: '',
        SESSION_SEARCH_RG: rg,
        SESSION_SEARCH_SQLITE3: sqlite3,
      }),
    );

    expect(probe.rg).toBe(rg);
    expect(probe.sqlite3).toBe(sqlite3);
    expect(probe.notes).toEqual([]);
  });

  it('turns an unusable explicit override into null with a note', () => {
    const missing = path.join(root, 'does-not-exist');
    const notExecutable = path.join(root, 'plain.txt');
    writeFileSync(notExecutable, 'not a program');
    writeStub(stubDir, 'rg');

    const probe = probeTools(
      withStubProbe({
        PATH: stubDir,
        SESSION_SEARCH_RG: missing,
        SESSION_SEARCH_SQLITE3: notExecutable,
      }),
    );

    // An explicit override never falls through to PATH.
    expect(probe.rg).toBeNull();
    expect(probe.sqlite3).toBeNull();
    expect(probe.notes).toHaveLength(2);
    expect(probe.notes[0]).toContain('SESSION_SEARCH_RG');
    expect(probe.notes[0]).toContain(missing);
    expect(probe.notes[1]).toContain('SESSION_SEARCH_SQLITE3');
  });

  it('honors forced fallbacks even when the tools are on PATH', () => {
    writeStub(stubDir, 'rg');
    writeStub(stubDir, 'sqlite3');

    const probe = probeTools(
      withStubProbe({
        PATH: stubDir,
        SESSION_SEARCH_NO_RG: '1',
        SESSION_SEARCH_NO_SQLITE3: '1',
      }),
    );

    expect(probe.rg).toBeNull();
    expect(probe.sqlite3).toBeNull();
  });

  it('finds verified executables on PATH', () => {
    const rg = writeStub(stubDir, 'rg');
    const sqlite3 = writeStub(stubDir, 'sqlite3');

    const probe = probeTools(
      withStubProbe({
        PATH: `${path.join(root, 'empty')}:${stubDir}`,
      }),
    );

    expect(probe.rg).toBe(rg);
    expect(probe.sqlite3).toBe(sqlite3);
  });

  it('honors SESSION_SEARCH_PROBE_TIMEOUT_MS for slow --version answers', () => {
    const slow = path.join(stubDir, 'slow-rg');
    writeFileSync(slow, '#!/bin/sh\nsleep 1.5\necho stub\n');
    chmodSync(slow, 0o755);

    const patient = probeTools({
      SESSION_SEARCH_RG: slow,
      SESSION_SEARCH_NO_SQLITE3: '1',
      SESSION_SEARCH_PROBE_TIMEOUT_MS: '5000',
    });
    const hasty = probeTools({
      SESSION_SEARCH_RG: slow,
      SESSION_SEARCH_NO_SQLITE3: '1',
      SESSION_SEARCH_PROBE_TIMEOUT_MS: '500',
    });

    expect(patient.rg).toBe(slow);
    expect(hasty.rg).toBeNull();
  });

  it.each(['abc', '0', '-5', '1.5'])(
    'falls back to the default timeout with a note for %s',
    (value) => {
      const rg = writeStub(stubDir, 'rg');
      const probe = probeTools({
        SESSION_SEARCH_RG: rg,
        SESSION_SEARCH_NO_SQLITE3: '1',
        SESSION_SEARCH_PROBE_TIMEOUT_MS: value,
      });

      expect(probe.rg).toBe(rg);
      expect(probe.notes).toEqual([
        expect.stringContaining('SESSION_SEARCH_PROBE_TIMEOUT_MS'),
      ]);
      expect(probeTimeoutMs({ SESSION_SEARCH_PROBE_TIMEOUT_MS: value })).toBe(
        DEFAULT_PROBE_TIMEOUT_MS,
      );
    },
  );

  it('clamps the probe timeout to 500..60000 ms', () => {
    expect(probeTimeoutMs({})).toBe(3000);
    expect(probeTimeoutMs({ SESSION_SEARCH_PROBE_TIMEOUT_MS: '100' })).toBe(
      500,
    );
    expect(probeTimeoutMs({ SESSION_SEARCH_PROBE_TIMEOUT_MS: '20000' })).toBe(
      20000,
    );
    expect(probeTimeoutMs({ SESSION_SEARCH_PROBE_TIMEOUT_MS: '999999' })).toBe(
      60000,
    );
  });

  it('skips a PATH candidate whose --version run fails', () => {
    const broken = path.join(stubDir, 'rg');
    writeFileSync(broken, '#!/bin/sh\nexit 3\n');
    chmodSync(broken, 0o755);

    const probe = probeTools(
      withStubProbe({ PATH: stubDir, SESSION_SEARCH_NO_SQLITE3: '1' }),
    );

    expect(probe.rg).not.toBe(broken);
  });
});
