import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readRelease,
  registryReleaseDecision,
  type ReleaseManifest,
} from '../../scripts/session-toolkit-release.js';

const pkg = JSON.parse(
  readFileSync(
    new URL('../../packages/session-toolkit/package.json', import.meta.url),
    'utf8',
  ),
);
let owned: string, root: string, directory: string, manifest: ReleaseManifest;
const originalPath = process.env.PATH;

function command(name: string, args: string[], cwd = root) {
  const result = spawnSync(name, args, { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function writeManifest() {
  writeFileSync(join(directory, 'release.json'), JSON.stringify(manifest));
}

beforeEach(() => {
  owned = mkdtempSync(join(tmpdir(), 'toolkit-release-contract-'));
  root = join(owned, 'source');
  directory = join(owned, 'candidate');
  const packed = join(owned, 'package');
  for (const path of [
    join(root, 'packages/session-toolkit'),
    directory,
    join(packed, 'dist'),
  ])
    mkdirSync(path, { recursive: true });
  const changelog = '# Toolkit\n\n## [0.1.0]\n\n- Controlled release note.\n';
  for (const path of [join(root, 'packages/session-toolkit'), packed]) {
    writeFileSync(join(path, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(path, 'CHANGELOG.md'), changelog);
  }
  for (const [name, content] of Object.entries({
    'README.md': 'fixture',
    LICENSE: 'fixture',
    'dist/index.js': 'export {};',
    'dist/index.d.ts': 'export {};',
    'dist/bin.js': '#!/usr/bin/env node\n',
  }))
    writeFileSync(join(packed, name), content, { mode: 0o755 });
  command('git', ['init', '--quiet']);
  command('git', ['add', '.']);
  command('git', [
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'user.name=Release fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ]);
  const archive = `tkstang-session-toolkit-${pkg.version}.tgz`;
  command('tar', [
    '-czf',
    join(directory, archive),
    '-C',
    owned,
    ...[
      'package.json',
      'CHANGELOG.md',
      'README.md',
      'LICENSE',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/bin.js',
    ].map((path) => `package/${path}`),
  ]);
  const bytes = readFileSync(join(directory, archive));
  const notes = '## [0.1.0]\n\n- Controlled release note.\n';
  manifest = {
    schema_version: 1,
    name: pkg.name,
    version: pkg.version,
    tag: `session-toolkit-v${pkg.version}`,
    commit: command('git', ['rev-parse', 'HEAD']),
    source_tree: command('git', ['rev-parse', 'HEAD^{tree}']),
    archive,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    notes: 'RELEASE_NOTES.md',
    notes_sha256: createHash('sha256').update(notes).digest('hex'),
  };
  writeManifest();
  writeFileSync(
    join(directory, 'SHA256SUMS'),
    `${manifest.sha256}  ${archive}\n`,
  );
  writeFileSync(join(directory, 'RELEASE_NOTES.md'), notes);
});

afterEach(() => {
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  rmSync(owned, { recursive: true, force: true });
});

describe('clean exact-archive release binding', () => {
  it('accepts a clean candidate, but requires the real tag for publication', () => {
    expect(readRelease(directory, root).archive).toBe(
      join(directory, manifest.archive),
    );
    expect(() => readRelease(directory, root, true)).toThrow();
    command('git', ['tag', manifest.tag]);
    expect(readRelease(directory, root, true).manifest.commit).toBe(
      manifest.commit,
    );
    command('git', [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'user.name=Release fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--allow-empty',
      '--quiet',
      '-m',
      'successor',
    ]);
    manifest.commit = command('git', ['rev-parse', 'HEAD']);
    writeManifest();
    expect(() => readRelease(directory, root)).toThrow(
      'Release tag must point to the exact source commit',
    );
  });

  it('refuses dirty source and false commit/version/tree/tag metadata', () => {
    writeFileSync(join(root, 'uncommitted'), 'dirty');
    expect(() => readRelease(directory, root)).toThrow('clean source checkout');
    rmSync(join(root, 'uncommitted'));
    for (const key of ['commit', 'version', 'source_tree', 'tag'] as const) {
      const previous = manifest[key];
      manifest[key] = 'incorrect';
      writeManifest();
      expect(() => readRelease(directory, root)).toThrow(
        `Release ${key} does not match clean source`,
      );
      manifest[key] = previous;
    }
  });

  it('refuses substituted archive bytes and release notes', () => {
    writeFileSync(
      join(directory, 'RELEASE_NOTES.md'),
      '- Unreviewed replacement.\n',
    );
    expect(() => readRelease(directory, root)).toThrow(
      'Release notes do not match source',
    );
    writeFileSync(join(directory, manifest.archive), 'substituted archive');
    expect(() => readRelease(directory, root)).toThrow(
      'Archive SHA-256 mismatch',
    );
  });

  it('rejects an archive hash relabeled to another package version', () => {
    const packed = join(owned, 'package/package.json');
    writeFileSync(packed, JSON.stringify({ ...pkg, version: '9.9.9' }));
    command('tar', [
      '-czf',
      join(directory, manifest.archive),
      '-C',
      owned,
      ...[
        'package.json',
        'CHANGELOG.md',
        'README.md',
        'LICENSE',
        'dist/index.js',
        'dist/index.d.ts',
        'dist/bin.js',
      ].map((path) => `package/${path}`),
    ]);
    const bytes = readFileSync(join(directory, manifest.archive));
    manifest.sha256 = createHash('sha256').update(bytes).digest('hex');
    manifest.integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    writeManifest();
    writeFileSync(
      join(directory, 'SHA256SUMS'),
      `${manifest.sha256}  ${manifest.archive}\n`,
    );
    expect(() => readRelease(directory, root)).toThrow(
      'Packed metadata does not match source',
    );
  });
});

// Mock only npm, the external registry boundary. The production decision consumes
// its actual exit status/JSON rather than source scans or a stubbed own module.
describe('registry publication/retry decision', () => {
  function registryResult(status: number, output: unknown) {
    const bin = join(owned, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, 'npm'),
      `#!/bin/sh\nprintf '%s' '${JSON.stringify(output)}'\nexit ${status}\n`,
      { mode: 0o755 },
    );
    process.env.PATH = `${bin}:${originalPath ?? ''}`;
  }

  it('publishes only an explicit miss and treats matching integrity as an idempotent retry', () => {
    registryResult(1, { error: { code: 'E404' } });
    expect(registryReleaseDecision(manifest, root)).toBe('publish');
    registryResult(0, manifest.integrity);
    expect(registryReleaseDecision(manifest, root)).toBe('already-published');
  });

  it('refuses mismatches, registry/auth failures and empty responses', () => {
    registryResult(0, 'sha512-bWlzbWF0Y2g=');
    expect(() => registryReleaseDecision(manifest, root)).toThrow(
      'integrity mismatch',
    );
    for (const code of ['E401', 'E500', 'ENOTFOUND']) {
      registryResult(1, { error: { code } });
      expect(() => registryReleaseDecision(manifest, root)).toThrow(
        'Registry lookup failed',
      );
    }
    registryResult(0, null);
    expect(() => registryReleaseDecision(manifest, root)).toThrow(
      'no published integrity',
    );
  });
});
