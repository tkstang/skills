import {
  cp,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
  mkdtemp,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import * as bumpVersionScript from '../../scripts/bump-version.mjs';
// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import * as validateScript from '../../scripts/validate.mjs';
import { repoRoot } from '../helpers/process.mjs';
const { bumpVersion, checkTagVersion, isValidSemver, SKILL_FILES } =
  bumpVersionScript;
const { validateRepository } = validateScript;
const jsonFiles = [
  'plugins/consensus/.claude-plugin/plugin.json',
  'plugins/consensus/.cursor-plugin/plugin.json',
  'plugins/consensus/.codex-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];
const skillFiles = [
  'skills/session-observer/SKILL.md',
  'skills/session-observer-collab/SKILL.md',
  'skills/export-session-transcript/SKILL.md',
  'plugins/consensus/skills/refine/SKILL.md',
  'plugins/consensus/skills/evaluate/SKILL.md',
  'plugins/consensus/skills/create/SKILL.md',
  'plugins/consensus/skills/decide/SKILL.md',
  'plugins/consensus/skills/plan/SKILL.md',
  'plugins/consensus/skills/panel/SKILL.md',
  'plugins/consensus/skills/phone-a-friend/SKILL.md',
];
const sessionObserverWatchDocs = [
  'skills/session-observer/references/watch-design.md',
  '.agents/skills/session-observer/SKILL.md',
  '.agents/skills/session-observer/references/watch-design.md',
];
const collaborationDistributionFiles = [
  'skills/session-observer-collab/references/runtime-claude-code.md',
  'skills/session-observer-collab/references/runtime-codex.md',
  'skills/session-observer-collab/references/runtime-cursor.md',
  'skills/session-observer-collab/scripts/collab-control.mjs',
  'skills/session-observer-collab/scripts/codex-lifecycle.mjs',
  'skills/session-observer-collab/scripts/hooks/codex-stop.mjs',
  'skills/session-observer-collab/scripts/hooks/cursor-stop.mjs',
];
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
  for (const file of [
    ...sessionObserverWatchDocs,
    ...collaborationDistributionFiles,
  ]) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  for (const file of requiredDocs) {
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  await writeFile(path.join(tempRoot, 'CLAUDE.md'), '@AGENTS.md\n');
  return tempRoot;
}

async function readJson(root: string, relativePath: string) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function fileExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function listDirectoryNames(directory: string) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

// Independent re-implementation of the "skills/<name>/SKILL.md" and
// "plugins/<name>/skills/<name>/SKILL.md" discovery contract, deliberately
// not sharing code with scripts/lib/discover-skills.mjs, so this test proves
// SKILL_FILES matches disk rather than merely echoing the same
// implementation.
async function globSkillMarkdownFiles(root: string) {
  const found: string[] = [];

  for (const skillName of await listDirectoryNames(path.join(root, 'skills'))) {
    if (await fileExists(path.join(root, 'skills', skillName, 'SKILL.md'))) {
      found.push(`skills/${skillName}/SKILL.md`);
    }
  }

  for (const pluginName of await listDirectoryNames(
    path.join(root, 'plugins'),
  )) {
    const skillsDir = path.join(root, 'plugins', pluginName, 'skills');
    for (const skillName of await listDirectoryNames(skillsDir)) {
      if (await fileExists(path.join(skillsDir, skillName, 'SKILL.md'))) {
        found.push(`plugins/${pluginName}/skills/${skillName}/SKILL.md`);
      }
    }
  }

  return found.toSorted();
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
    for (const file of skillFiles) {
      const skillMarkdown = await readFile(path.join(root, file), 'utf8');
      const frontmatterMatch = skillMarkdown.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = frontmatterMatch![1];
      if (/^version:/m.test(frontmatter)) {
        expect(
          frontmatter,
          `${file} top-level version should be bumped`,
        ).toMatch(/^version: "0\.2\.0-beta\.1"$/m);
      }
      if (/^metadata:\n(?:  .+\n)*?  version:/m.test(frontmatter)) {
        expect(
          frontmatter,
          `${file} metadata.version should be bumped`,
        ).toMatch(/^metadata:\n(?:  .+\n)*?  version: "0\.2\.0-beta\.1"$/m);
      }
    }
  });

  it('SKILL_FILES matches an independently globbed skill set', async () => {
    const globbed = await globSkillMarkdownFiles(repoRoot);
    expect([...SKILL_FILES].toSorted()).toEqual(globbed);
  });

  it('SKILL_FILES pins the current shipped skill set (update deliberately on change)', () => {
    expect([...SKILL_FILES].toSorted()).toEqual([
      'plugins/consensus/skills/create/SKILL.md',
      'plugins/consensus/skills/decide/SKILL.md',
      'plugins/consensus/skills/evaluate/SKILL.md',
      'plugins/consensus/skills/panel/SKILL.md',
      'plugins/consensus/skills/phone-a-friend/SKILL.md',
      'plugins/consensus/skills/plan/SKILL.md',
      'plugins/consensus/skills/refine/SKILL.md',
      'skills/export-session-transcript/SKILL.md',
      'skills/session-observer-collab/SKILL.md',
      'skills/session-observer/SKILL.md',
    ]);
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
