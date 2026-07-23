import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function listSubdirectories(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name))
      .toSorted();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Canonical skill-directory discovery contract, shared by scripts/validate.mjs
// (structural validation) and scripts/bump-version.mjs (release tooling).
// Only `skills/*/` and `plugins/*/skills/*/` with a `SKILL.md` count; synced
// mirrors under `.agents/`, `.claude/`, `.cursor/` are never canonical roots.
export async function discoverSkillDirectories(root) {
  const skillDirectories = new Set();

  for (const skillPath of await listSubdirectories(path.join(root, 'skills'))) {
    if (await pathExists(path.join(skillPath, 'SKILL.md'))) {
      skillDirectories.add(skillPath);
    }
  }

  for (const pluginPath of await listSubdirectories(
    path.join(root, 'plugins'),
  )) {
    for (const skillPath of await listSubdirectories(
      path.join(pluginPath, 'skills'),
    )) {
      if (await pathExists(path.join(skillPath, 'SKILL.md'))) {
        skillDirectories.add(skillPath);
      }
    }
  }

  return [...skillDirectories].toSorted((left, right) =>
    path.relative(root, left).localeCompare(path.relative(root, right)),
  );
}
