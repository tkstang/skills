import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONSENSUS_SHARED_CLI_RELATIVE_PATH } from './core/consensus-loop.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

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
  const match = installSh.match(/CONSENSUS_INSTALL_TARGET_RELATIVE="([^"]+)"/u);
  return match?.[1] ?? null;
}

describe('consensus install contract', () => {
  it('documents explicit scoped standalone commands with a planned exact release tag', async () => {
    const guide = await repoFile(
      'documentation/docs/user-guide/installation.md',
    );
    const commands = [...guide.matchAll(/^bash "\$INSTALLER" (.+)$/gm)].map(
      (match) => match[1],
    );
    expect(commands).toHaveLength(6);
    for (const agent of ['codex', 'claude-code', 'cursor']) {
      for (const scope of ['project', 'user']) {
        const command = commands.find((line) =>
          line.includes(`--agent ${agent} --scope ${scope}`),
        );
        expect(command).toContain('--skill next-steps');
        expect(command).toMatch(/--ref v0\.1\.2$/);
        expect(command).not.toMatch(/<|--ref (?:main|HEAD|latest)/);
      }
    }
    expect(guide).toMatch(/--scope.*required/);
    expect(guide).toContain('skills/<name>/');
    expect(guide).toContain('.standalone-install-incomplete');
    expect(guide).toMatch(/once a release contains the helper/);
    expect(guide).toMatch(/copy fidelity/);
    expect(guide).toMatch(/signed.tag/);
    expect(guide).toContain('temporary `HOME`');
    const helperPath = path.join(repoRoot, 'scripts/install-standalone.mjs');
    const { DEFAULT_REPOSITORY } = await import(helperPath);
    expect(DEFAULT_REPOSITORY).toBe('https://github.com/tkstang/skills.git');
    expect(guide).toContain(DEFAULT_REPOSITORY);
  });

  it('keeps live host and user-home release evidence separate from copy verification', async () => {
    const release = await repoFile('RELEASING.md');
    const section = release
      .split('## First-party standalone acceptance')[1]
      ?.split('\n## ')[0];
    expect(section).toBeDefined();
    for (const host of ['Codex', 'Claude Code', 'Cursor']) {
      for (const scope of ['project', 'user'])
        expect(section).toMatch(new RegExp(`\\| ${host} +\\| ${scope} +\\|`));
    }
    for (const evidence of [
      'pinned tag',
      'selected skill',
      'placement',
      'payload verification',
      'printed invocation',
      'fresh-session discovery',
      'permission behavior',
      'authorization',
    ])
      expect(section).toContain(evidence);
  });

  it('keeps README, user guide, install.sh, and resolver shared-path/ref values aligned', async () => {
    const [readme, installGuide, installSh, resolver] = await Promise.all([
      repoFile('README.md'),
      repoFile('documentation/docs/user-guide/installation.md'),
      repoFile('install.sh'),
      repoFile('src/plugins/consensus/core/consensus-loop.ts'),
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
    expect(installSh).toContain('plugins/consensus/scripts/consensus.mjs');
  });
});
