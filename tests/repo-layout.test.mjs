import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url);

async function assertDirectory(relativePath) {
  const details = await stat(new URL(`${relativePath}/`, root));
  assert.equal(
    details.isDirectory(),
    true,
    `${relativePath} should be a directory`,
  );
}

async function pathExists(relativePath) {
  try {
    await stat(new URL(relativePath, root));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function listFiles(relativePath) {
  const directoryUrl = new URL(`${relativePath}/`, root);
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

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

test('repository exposes standalone and consensus plugin layout', async () => {
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

test('transcript runtime source lives under src and generated output stays in skills', async () => {
  assert.equal(
    await pathExists('shared/transcript-core/runtimes.mjs'),
    false,
    'shared transcript-core runtime should not remain a canonical source file',
  );

  assert.equal(
    await pathExists('src/transcript/core/runtimes.ts'),
    true,
    'transcript-core canonical source should live under src/transcript/core',
  );
  assert.equal(
    await pathExists(
      'src/transcript/export-session/export-session-transcript.ts',
    ),
    true,
    'export CLI canonical source should live under src/transcript/export-session',
  );
  assert.equal(
    await pathExists('src/transcript/export-session/sanitize.ts'),
    true,
    'export sanitizer canonical source should live under src/transcript/export-session',
  );
});

test('consensus distribution tree does not include canonical TypeScript source', async () => {
  assert.equal(
    await pathExists('plugins/consensus/skills/refine/src'),
    false,
    'refine skill distribution should not include a src directory',
  );

  const skillFiles = await listFiles('plugins/consensus/skills');
  assert.deepEqual(
    skillFiles.filter((file) => file.endsWith('.ts')),
    [],
    'plugin skill distribution should not include TypeScript source files',
  );
});
