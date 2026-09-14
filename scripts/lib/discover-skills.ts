import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function listSubdirectories(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name))
      .toSorted();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

// Canonical skill-directory discovery contract, shared by scripts/validate.ts
// (structural validation) and scripts/bump-version.js (release tooling).
// Only `src/skills/*/` directories with a `SKILL.md` count; generated and
// synced trees are never canonical roots.
export async function discoverSkillDirectories(
  root: string,
): Promise<string[]> {
  const skillDirectories = new Set<string>();
  for (const skillPath of await listSubdirectories(
    path.join(root, 'src', 'skills'),
  )) {
    if (await pathExists(path.join(skillPath, 'SKILL.md'))) {
      skillDirectories.add(skillPath);
    }
  }
  return [...skillDirectories].toSorted((left, right) =>
    path.relative(root, left).localeCompare(path.relative(root, right)),
  );
}
