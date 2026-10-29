import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  validateArchive,
  validatePackedMetadata,
} from '../../scripts/session-toolkit-package.js';

const pkg = JSON.parse(
  readFileSync(
    new URL('../../packages/session-toolkit/package.json', import.meta.url),
    'utf8',
  ),
);

describe('public toolkit packed dependency contract', () => {
  it('rejects a linked archive member before extraction or installation', () => {
    const owned = mkdtempSync(join(tmpdir(), 'session-toolkit-link-test-'));
    const originalPath = process.env.PATH;
    try {
      const packed = join(owned, 'package');
      mkdirSync(join(packed, 'dist'), { recursive: true });
      writeFileSync(join(packed, 'package.json'), JSON.stringify(pkg));
      writeFileSync(join(packed, 'LICENSE'), 'fixture license');
      writeFileSync(join(packed, 'dist/index.js'), 'export {};');
      writeFileSync(join(packed, 'dist/index.d.ts'), 'export {};');
      writeFileSync(join(packed, 'dist/bin.js'), '#!/usr/bin/env node\n', {
        mode: 0o755,
      });
      const sentinel = join(owned, 'sentinel');
      writeFileSync(sentinel, 'owned sentinel');
      symlinkSync(sentinel, join(packed, 'README.md'));
      const archive = join(owned, 'linked.tgz');
      const packedResult = spawnSync(
        'tar',
        [
          '-czf',
          archive,
          '-C',
          owned,
          'package/package.json',
          'package/README.md',
          'package/LICENSE',
          'package/dist/index.js',
          'package/dist/index.d.ts',
          'package/dist/bin.js',
        ],
        { encoding: 'utf8' },
      );
      expect(packedResult.status, packedResult.stderr).toBe(0);
      // npm is the external install boundary. A bad archive must never reach it.
      const marker = join(owned, 'npm-reached');
      const bin = join(owned, 'bin');
      mkdirSync(bin);
      writeFileSync(
        join(bin, 'npm'),
        `#!/bin/sh\ntouch '${marker}'\nexit 77\n`,
        {
          mode: 0o755,
        },
      );
      process.env.PATH = `${bin}:${originalPath ?? ''}`;
      expect(() => validateArchive(archive)).toThrow(
        'Packed member must be a regular file',
      );
      expect(existsSync(marker)).toBe(false);
      expect(readFileSync(sentinel, 'utf8')).toBe('owned sentinel');
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      rmSync(owned, { recursive: true, force: true });
    }
  });

  it('rejects private workspace names even after pack rewrites their protocol to semver', () => {
    expect(() =>
      validatePackedMetadata(
        { ...pkg, dependencies: { skills: '^0.1.0' } },
        new Set(['skills']),
      ),
    ).toThrow('Private workspace dependency: skills');
  });

  it('rejects unresolved protocols and local dependency paths', () => {
    for (const spec of [
      'workspace:*',
      'file:../private',
      'link:../private',
      '../private',
      '/tmp/private',
    ]) {
      expect(() =>
        validatePackedMetadata(
          { ...pkg, dependencies: { example: spec } },
          new Set(),
        ),
      ).toThrow('Unresolved/local dependency');
    }
  });

  it('rejects install-time execution in an otherwise valid packed manifest', () => {
    expect(() =>
      validatePackedMetadata(
        { ...pkg, scripts: { postinstall: 'node bootstrap.js' } },
        new Set(),
      ),
    ).toThrow('Installed lifecycle script');
  });
});
