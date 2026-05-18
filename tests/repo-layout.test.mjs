import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url);

async function assertDirectory(relativePath) {
  const details = await stat(new URL(`${relativePath}/`, root));
  assert.equal(details.isDirectory(), true, `${relativePath} should be a directory`);
}

test('repository exposes standalone and consensus plugin layout', async () => {
  const requiredDirectories = [
    'skills',
    path.posix.join('plugins', 'consensus'),
    path.posix.join('plugins', 'consensus', 'skills'),
    path.posix.join('plugins', 'consensus', 'skills', 'consensus-refine'),
    path.posix.join('plugins', 'consensus', 'skills', 'consensus-refine', 'scripts'),
    path.posix.join('plugins', 'consensus', 'agents'),
    path.posix.join('plugins', 'consensus', '.claude-plugin'),
    path.posix.join('plugins', 'consensus', '.cursor-plugin'),
    path.posix.join('plugins', 'consensus', '.codex-plugin'),
    'scripts'
  ];

  await Promise.all(requiredDirectories.map(assertDirectory));
});
