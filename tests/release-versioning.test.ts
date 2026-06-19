import {
  cp,
  mkdir,
  readFile,
  writeFile,
  mkdtemp,
  symlink,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import { bumpVersion, checkTagVersion, isValidSemver } from '../scripts/bump-version.mjs';
// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import { validateRepository } from '../scripts/validate.mjs';
import { repoRoot } from './helpers/process.mjs';
const jsonFiles = [
  'plugins/consensus/.claude-plugin/plugin.json',
  'plugins/consensus/.cursor-plugin/plugin.json',
  'plugins/consensus/.codex-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];
const skillFiles = ['plugins/consensus/skills/refine/SKILL.md'];
const requiredDocs = [
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'RELEASING.md',
  'AGENTS.md',
];

async function tempReleaseRoot() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'release-versioning-'));
  await mkdir(path.join(tempRoot, 'skills'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/agents'), {
    recursive: true,
  });
  for (const file of jsonFiles) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  for (const file of skillFiles) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  for (const file of requiredDocs) {
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  await symlink('AGENTS.md', path.join(tempRoot, 'CLAUDE.md'));
  return tempRoot;
}

async function readJson(root: string, relativePath: string) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

describe('release-versioning', () => {
  it('isValidSemver accepts release and prerelease versions only', () => {
    expect(isValidSemver('0.2.0')).toBe(true);
    expect(isValidSemver('0.2.0-beta.1')).toBe(true);
    expect(isValidSemver('v0.2.0')).toBe(false);
    expect(isValidSemver('0.2')).toBe(false);
    expect(isValidSemver('0.2.0+build')).toBe(false);
  });

  it('bumpVersion updates plugin manifests and present marketplace versions', async () => {
    const root = await tempReleaseRoot();
    const cursorMarketplacePath = '.cursor-plugin/marketplace.json';
    const cursorMarketplace = await readJson(root, cursorMarketplacePath);
    delete cursorMarketplace.plugins[0].version;
    await writeFile(
      path.join(root, cursorMarketplacePath),
      `${JSON.stringify(cursorMarketplace, null, 2)}\n`,
    );

    const result = await bumpVersion({ root, version: '0.2.0-beta.1' });

    expect([...result.updatedFiles].toSorted()).toEqual(
      [...jsonFiles, ...skillFiles].toSorted(),
    );
    for (const file of jsonFiles.slice(0, 3)) {
      expect((await readJson(root, file)).version).toBe('0.2.0-beta.1');
    }
    expect(
      (await readJson(root, '.claude-plugin/marketplace.json')).plugins[0]
        .version,
    ).toBe('0.2.0-beta.1');
    expect(
      (await readJson(root, '.agents/plugins/marketplace.json')).plugins[0]
        .version,
    ).toBe('0.2.0-beta.1');
    expect(
      'version' in (await readJson(root, cursorMarketplacePath)).plugins[0],
    ).toBe(false);
    expect(
      await readFile(path.join(root, skillFiles[0]), 'utf8'),
    ).toMatch(/version: "0\.2\.0-beta\.1"/);
  });

  it('bumpVersion rejects malformed semver before modifying files', async () => {
    const root = await tempReleaseRoot();

    await expect(bumpVersion({ root, version: 'v0.2.0' })).rejects.toThrow(
      /semver/i,
    );
    expect(
      (await readJson(root, 'plugins/consensus/.claude-plugin/plugin.json'))
        .version,
    ).toBe('0.1.0');
  });

  it('bumped patch versions validate and pass release tag consistency', async () => {
    const root = await tempReleaseRoot();

    await bumpVersion({ root, version: '0.1.1' });

    const validation = await validateRepository({ root });
    expect(validation.ok, validation.errors.join('\n')).toBe(true);
    expect(await checkTagVersion({ root, tag: 'v0.1.1' })).toEqual({
      version: '0.1.1',
      ok: true,
    });
  });
});
