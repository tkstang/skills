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
  it('keeps README, install.sh, and resolver shared-path/ref values aligned', async () => {
    const [readme, installSh, resolver] = await Promise.all([
      repoFile('README.md'),
      repoFile('install.sh'),
      repoFile('src/consensus/core/consensus-loop.ts'),
    ]);

    const readmeRefs = extractInstallRefs(readme);
    expect(readmeRefs).toHaveLength(1);
    const [readmeRef] = readmeRefs;
    expect(readmeRef).toMatch(/^v\d+\.\d+\.\d+$/u);
    expect(['main', 'HEAD']).not.toContain(readmeRef);
    expect(readme).not.toContain('<tag>');
    expect(`${readme}\n${resolver}`).not.toMatch(
      /raw\.githubusercontent\.com\/tkstang\/skills\/(?:main|HEAD)\//iu,
    );

    expect(extractInstallShRef(installSh)).toBe(readmeRef);
    expect(extractInstallTargetRelative(installSh)).toBe(
      CONSENSUS_SHARED_CLI_RELATIVE_PATH,
    );
    expect(readme).toContain(`~/${CONSENSUS_SHARED_CLI_RELATIVE_PATH}`);
    expect(installSh).toContain(
      'plugins/consensus/scripts/consensus.mjs',
    );
  });
});
