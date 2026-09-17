import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');
async function repoFile(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

describe('standalone install contract', () => {
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
});
