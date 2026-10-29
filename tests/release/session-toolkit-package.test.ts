import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validatePackedMetadata } from '../../scripts/session-toolkit-package.js';

const pkg = JSON.parse(
  readFileSync(
    new URL('../../packages/session-toolkit/package.json', import.meta.url),
    'utf8',
  ),
);

describe('public toolkit packed dependency contract', () => {
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
