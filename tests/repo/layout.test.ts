import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('../..', import.meta.url);

async function assertDirectory(relativePath: string) {
  const details = await stat(new URL(`${relativePath}/`, root));
  expect(
    details.isDirectory(),
    `${relativePath} should be a directory`,
  ).toBe(true);
}

async function pathExists(relativePath: string) {
  try {
    await stat(new URL(relativePath, root));
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function listFiles(relativePath: string): Promise<string[]> {
  const directoryUrl = new URL(`${relativePath}/`, root);
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)));
    } else {
      files.push(child);
    }
  }

  return files;
}

describe('repo-layout', () => {
  it('repository exposes standalone and consensus plugin layout', async () => {
    const requiredDirectories = [
      'skills',
      path.posix.join('shared', 'transcript-core'),
      path.posix.join('skills', 'export-session-transcript'),
      path.posix.join('plugins', 'consensus'),
      path.posix.join('plugins', 'consensus', 'skills'),
      path.posix.join('plugins', 'consensus', 'skills', 'refine'),
      path.posix.join('plugins', 'consensus', 'skills', 'refine', 'scripts'),
      path.posix.join('plugins', 'consensus', 'skills', 'evaluate'),
      path.posix.join('plugins', 'consensus', 'skills', 'evaluate', 'scripts'),
      path.posix.join('plugins', 'consensus', 'agents'),
      path.posix.join('plugins', 'consensus', '.claude-plugin'),
      path.posix.join('plugins', 'consensus', '.cursor-plugin'),
      path.posix.join('plugins', 'consensus', '.codex-plugin'),
      path.posix.join('src', 'consensus', 'core'),
      path.posix.join('src', 'consensus', 'refine'),
      path.posix.join('src', 'transcript', 'core'),
      path.posix.join('src', 'transcript', 'export-session'),
      'scripts',
    ];

    await Promise.all(requiredDirectories.map(assertDirectory));
  });

  it('transcript runtime source lives under src and generated output stays in skills', async () => {
    expect(
      await pathExists('shared/transcript-core/runtimes.mjs'),
      'shared transcript-core runtime should not remain a canonical source file',
    ).toBe(false);

    expect(
      await pathExists('src/transcript/core/runtimes.ts'),
      'transcript-core canonical source should live under src/transcript/core',
    ).toBe(true);
    expect(
      await pathExists(
        'src/transcript/export-session/export-session-transcript.ts',
      ),
      'export CLI canonical source should live under src/transcript/export-session',
    ).toBe(true);
    expect(
      await pathExists('src/transcript/export-session/sanitize.ts'),
      'export sanitizer canonical source should live under src/transcript/export-session',
    ).toBe(true);
  });

  it('consensus distribution tree does not include canonical TypeScript source', async () => {
    expect(
      await pathExists('plugins/consensus/skills/refine/src'),
      'refine skill distribution should not include a src directory',
    ).toBe(false);

    const skillFiles = await listFiles('plugins/consensus/skills');
    expect(
      skillFiles.filter((file) => file.endsWith('.ts')),
      'plugin skill distribution should not include TypeScript source files',
    ).toEqual([]);
  });
});
