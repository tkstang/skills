import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONSENSUS_SHARED_CLI_RELATIVE_PATH } from '../../src/consensus/core/consensus-loop.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

async function repoFile(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function extractInstallRefs(readme: string) {
  return [
    ...readme.matchAll(
      /https:\/\/raw\.githubusercontent\.com\/tkstang\/skills\/([^/\s]+)\/install\.sh/gu,
    ),
  ].map((match) => match[1]);
}

function extractInstallShRef(installSh: string) {
  const match = installSh.match(
    /CONSENSUS_INSTALL_REF="\$\{CONSENSUS_INSTALL_REF:-([^}]+)\}"/u,
  );
  return match?.[1] ?? null;
}

function extractInstallTargetRelative(installSh: string) {
  const match = installSh.match(
    /CONSENSUS_INSTALL_TARGET_RELATIVE="([^"]+)"/u,
  );
  return match?.[1] ?? null;
}

describe('consensus install contract', () => {
  it('keeps README, user guide, install.sh, and resolver shared-path/ref values aligned', async () => {
    const [readme, installGuide, installSh, resolver] = await Promise.all([
      repoFile('README.md'),
      repoFile('documentation/docs/user-guide/installation.md'),
      repoFile('install.sh'),
      repoFile('src/consensus/core/consensus-loop.ts'),
    ]);

    // The standalone-recovery installer is owned by the docs site. The README
    // is a slim entry point and must not carry a second copy of the pinned
    // one-liner — that duplication is what drifted previously.
    expect(extractInstallRefs(readme)).toEqual([]);

    const installGuideRefs = extractInstallRefs(installGuide);
    expect(installGuideRefs).toHaveLength(1);
    const [installRef] = installGuideRefs;
    // The installer must stay pinned to an immutable release tag. A mutable
    // ref would let a `curl | bash` install change underneath users.
    expect(installRef).toMatch(/^v\d+\.\d+\.\d+$/u);
    expect(['main', 'HEAD']).not.toContain(installRef);

    const runtimeFacingInstallText = `${readme}\n${installGuide}\n${resolver}`;
    expect(runtimeFacingInstallText).not.toContain('<tag>');
    expect(runtimeFacingInstallText).not.toMatch(
      /raw\.githubusercontent\.com\/tkstang\/skills\/(?:main|HEAD)\//iu,
    );

    expect(extractInstallShRef(installSh)).toBe(installRef);
    expect(extractInstallTargetRelative(installSh)).toBe(
      CONSENSUS_SHARED_CLI_RELATIVE_PATH,
    );
    expect(installGuide).toContain(`~/${CONSENSUS_SHARED_CLI_RELATIVE_PATH}`);
    expect(installSh).toContain(
      'plugins/consensus/scripts/consensus.mjs',
    );
  });
});
