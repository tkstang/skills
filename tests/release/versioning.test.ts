import { execFile as execFileCallback } from 'node:child_process';
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
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import * as bumpVersionScript from '../../scripts/bump-version.js';
import * as validateScript from '../../scripts/validate.js';
import { repoRoot } from '../helpers/process.mjs';
const { bumpVersion, checkTagVersion, isValidSemver, SKILL_FILES } =
  bumpVersionScript;
const { validateRepository } = validateScript;
const execFile = promisify(execFileCallback);
const jsonFiles = [
  'plugins/consensus/.claude-plugin/plugin.json',
  'plugins/consensus/.cursor-plugin/plugin.json',
  'plugins/consensus/.codex-plugin/plugin.json',
  'plugins/session/.claude-plugin/plugin.json',
  'plugins/session/.cursor-plugin/plugin.json',
  'plugins/session/.codex-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];
const MARKETPLACE_FILES_WITH_VERSIONS = [
  '.claude-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];
const skillFiles = [
  'src/skills/session-fork-to-destination/SKILL.md',
  'src/skills/session-handoff/SKILL.md',
  'src/skills/complexity-review/SKILL.md',
  'src/skills/must-we/SKILL.md',
  'src/skills/next-steps/SKILL.md',
  'src/skills/session-observer/SKILL.md',
  'src/skills/session-observer-collab/SKILL.md',
  'src/skills/session-export-transcript/SKILL.md',
  'src/skills/session-retro/SKILL.md',
  'src/skills/refine/SKILL.md',
  'src/skills/evaluate/SKILL.md',
  'src/skills/create/SKILL.md',
  'src/skills/decide/SKILL.md',
  'src/skills/plan/SKILL.md',
  'src/skills/panel/SKILL.md',
  'src/skills/phone-a-friend/SKILL.md',
];
const generatedSkillFiles = [
  'plugins/consensus/skills/refine/SKILL.md',
  'plugins/session/skills/export-transcript/SKILL.md',
  'plugins/session/skills/fork-to-destination/SKILL.md',
  'plugins/session/skills/handoff/SKILL.md',
  'plugins/session/skills/retro/SKILL.md',
  'skills/must-we/SKILL.md',
  'skills/next-steps/SKILL.md',
  'skills/session-retro/SKILL.md',
  'skills/session-fork-to-destination/SKILL.md',
  'skills/session-observer-collab/SKILL.md',
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
const guidanceDistributionFiles = [
  'skills/session-fork-to-destination/references/provider-guidance.md',
  'skills/session-fork-to-destination/scripts/session-fork-to-destination.mjs',
];
const requiredDocs = [
  'README.md',
  'documentation/docs/user-guide/installation.md',
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
  for (const file of generatedSkillFiles) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  for (const file of [
    ...sessionObserverWatchDocs,
    ...collaborationDistributionFiles,
    ...guidanceDistributionFiles,
  ]) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  for (const file of requiredDocs) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
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

// Independent re-implementation of the "src/skills/<name>/SKILL.md" discovery contract, deliberately
// not sharing code with scripts/lib/discover-skills.js, so this test proves
// SKILL_FILES matches disk rather than merely echoing the same
// implementation.
async function globSkillMarkdownFiles(root: string) {
  const found: string[] = [];

  const skillsDir = path.join(root, 'src/skills');
  for (const skillName of await listDirectoryNames(skillsDir)) {
    if (await fileExists(path.join(skillsDir, skillName, 'SKILL.md'))) {
      found.push(`src/skills/${skillName}/SKILL.md`);
    }
  }

  return found.toSorted();
}

describe('release-versioning', () => {
  it('release workflow selects the plugin from a namespaced tag', async () => {
    const workflow = await readFile(
      path.join(repoRoot, '.github/workflows/release.yml'),
      'utf8',
    );
    expect(workflow).toContain('consensus-v*');
    expect(workflow).toContain('session-v*');
    expect(workflow).toContain('--plugin "$PLUGIN_NAME"');
    expect(workflow).not.toContain('--plugin consensus');

    const pluginVersion = (
      await readJson(repoRoot, 'plugins/consensus/.claude-plugin/plugin.json')
    ).version as string;
    const releaseTag = `v${pluginVersion}`;
    const { stdout } = await execFile(
      'pnpm',
      [
        'tsx',
        'scripts/bump-version.ts',
        '--check-tag',
        releaseTag,
        '--plugin',
        'consensus',
      ],
      { cwd: repoRoot },
    );
    expect(stdout).toContain(
      `tag ${releaseTag} matches consensus plugin version ${pluginVersion}`,
    );

    const sessionVersion = (
      await readJson(repoRoot, 'plugins/session/.claude-plugin/plugin.json')
    ).version as string;
    const sessionTag = `v${sessionVersion}`;
    const sessionResult = await execFile(
      'pnpm',
      [
        'tsx',
        'scripts/bump-version.ts',
        '--check-tag',
        sessionTag,
        '--plugin',
        'session',
      ],
      { cwd: repoRoot },
    );
    expect(sessionResult.stdout).toContain(
      `tag ${sessionTag} matches session plugin version ${sessionVersion}`,
    );
  });

  it('isValidSemver accepts release and prerelease versions only', () => {
    expect(isValidSemver('0.2.0')).toBe(true);
    expect(isValidSemver('0.2.0-beta.1')).toBe(true);
    expect(isValidSemver('v0.2.0')).toBe(false);
    expect(isValidSemver('0.2')).toBe(false);
    expect(isValidSemver('0.2.0+build')).toBe(false);
  });

  it('bumpVersion updates one explicit plugin without changing skill versions', async () => {
    const root = await tempReleaseRoot();
    const cursorMarketplacePath = '.cursor-plugin/marketplace.json';
    const cursorMarketplace = await readJson(root, cursorMarketplacePath);
    delete cursorMarketplace.plugins[0].version;
    await writeFile(
      path.join(root, cursorMarketplacePath),
      `${JSON.stringify(cursorMarketplace, null, 2)}\n`,
    );
    const beforeSessionManifests = await Promise.all(
      jsonFiles
        .slice(3, 6)
        .map((file) => readFile(path.join(root, file), 'utf8')),
    );
    const beforeSessionMarketplaceVersions = await Promise.all(
      MARKETPLACE_FILES_WITH_VERSIONS.map(
        async (marketplacePath) =>
          (await readJson(root, marketplacePath)).plugins.find(
            (plugin: { name: string }) => plugin.name === 'session',
          ).version,
      ),
    );

    const beforeSkills = await Promise.all(
      skillFiles.map((file) => readFile(path.join(root, file), 'utf8')),
    );
    const result = await bumpVersion({
      root,
      version: '0.2.0-beta.1',
      target: { kind: 'plugin', name: 'consensus' },
    });

    expect([...result.updatedFiles].toSorted()).toEqual(
      [
        ...jsonFiles.slice(0, 3),
        '.claude-plugin/marketplace.json',
        '.agents/plugins/marketplace.json',
      ].toSorted(),
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
    await expect(
      Promise.all(
        jsonFiles
          .slice(3, 6)
          .map((file) => readFile(path.join(root, file), 'utf8')),
      ),
    ).resolves.toEqual(beforeSessionManifests);
    await expect(
      Promise.all(
        MARKETPLACE_FILES_WITH_VERSIONS.map(
          async (marketplacePath) =>
            (await readJson(root, marketplacePath)).plugins.find(
              (plugin: { name: string }) => plugin.name === 'session',
            ).version,
        ),
      ),
    ).resolves.toEqual(beforeSessionMarketplaceVersions);
    await expect(
      Promise.all(
        skillFiles.map((file) => readFile(path.join(root, file), 'utf8')),
      ),
    ).resolves.toEqual(beforeSkills);
  });

  it('SKILL_FILES matches an independently globbed skill set', async () => {
    const globbed = await globSkillMarkdownFiles(repoRoot);
    expect([...SKILL_FILES].toSorted()).toEqual(globbed);
  });

  it('SKILL_FILES pins the current shipped skill set (update deliberately on change)', () => {
    expect([...SKILL_FILES].toSorted()).toEqual([
      'src/skills/complexity-review/SKILL.md',
      'src/skills/consensus-review/SKILL.md',
      'src/skills/create/SKILL.md',
      'src/skills/decide/SKILL.md',
      'src/skills/evaluate/SKILL.md',
      'src/skills/must-we/SKILL.md',
      'src/skills/next-steps/SKILL.md',
      'src/skills/panel/SKILL.md',
      'src/skills/phone-a-friend/SKILL.md',
      'src/skills/plan/SKILL.md',
      'src/skills/refine/SKILL.md',
      'src/skills/session-export-transcript/SKILL.md',
      'src/skills/session-fork-to-destination/SKILL.md',
      'src/skills/session-handoff/SKILL.md',
      'src/skills/session-observer-collab/SKILL.md',
      'src/skills/session-observer/SKILL.md',
      'src/skills/session-retro/SKILL.md',
    ]);
  });

  it('bumpVersion rejects malformed semver before modifying files', async () => {
    const root = await tempReleaseRoot();
    const initialVersion = (
      await readJson(root, 'plugins/consensus/.claude-plugin/plugin.json')
    ).version;

    await expect(
      bumpVersion({
        root,
        version: 'v0.2.0',
        target: { kind: 'plugin', name: 'consensus' },
      }),
    ).rejects.toThrow(/semver/i);
    expect(
      (await readJson(root, 'plugins/consensus/.claude-plugin/plugin.json'))
        .version,
    ).toBe(initialVersion);
  });

  it('bumped patch versions validate and pass release tag consistency', async () => {
    const root = await tempReleaseRoot();

    await bumpVersion({
      root,
      version: '0.1.1',
      target: { kind: 'plugin', name: 'consensus' },
    });

    const validation = await validateRepository({ root });
    expect(validation.ok, validation.errors.join('\n')).toBe(true);
    expect(
      await checkTagVersion({ root, tag: 'v0.1.1', plugin: 'consensus' }),
    ).toEqual({
      version: '0.1.1',
      plugin: 'consensus',
      ok: true,
    });
  });

  it('skill selection derives from the effective root and updates metadata.version only', async () => {
    const root = await tempReleaseRoot();
    // A skill that exists ONLY in this target checkout — not in the source
    // checkout the module-level SKILL_FILES was derived from. If the
    // operations reused that DEFAULT_ROOT snapshot they would silently skip
    // it (under-bumping the target).
    const extraSkillRelPath = 'src/skills/extra-scratch-skill/SKILL.md';
    await mkdir(path.dirname(path.join(root, extraSkillRelPath)), {
      recursive: true,
    });
    await writeFile(
      path.join(root, extraSkillRelPath),
      [
        '---',
        'name: extra-scratch-skill',
        'description: Scratch skill present only in this target checkout.',
        'metadata:',
        '  version: "0.1.0"',
        '---',
        '',
        '# Extra scratch skill',
        '',
      ].join('\n'),
    );

    // Guard: the DEFAULT_ROOT snapshot does not know about this skill.
    expect(SKILL_FILES).not.toContain(extraSkillRelPath);

    const result = await bumpVersion({
      root,
      version: '0.3.0',
      target: { kind: 'skill', name: 'extra-scratch-skill' },
    });

    // Derived from the target root: the extra skill is bumped at the sole
    // canonical metadata.version field.
    expect(result.updatedFiles).toContain(extraSkillRelPath);
    const bumped = await readFile(path.join(root, extraSkillRelPath), 'utf8');
    expect(bumped).not.toMatch(/^version:/m);
    expect(bumped).toMatch(/^metadata:\n {2}version: "0\.3\.0"$/m);
  });

  it('rejects nonstable skill versions and requires an explicit target', async () => {
    const root = await tempReleaseRoot();
    await expect(
      bumpVersion({
        root,
        version: '1.0.0-alpha.1',
        target: { kind: 'skill', name: 'refine' },
      }),
    ).rejects.toThrow(/stable semver/i);
    await expect(
      bumpVersion({ root, version: '1.0.0', target: undefined as never }),
    ).rejects.toThrow(/target is required/i);
  });
});
