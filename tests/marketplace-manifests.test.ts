import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('..', import.meta.url);

const marketplaces = [
  {
    path: '.claude-plugin/marketplace.json',
    sourceKind: 'string',
  },
  {
    path: '.cursor-plugin/marketplace.json',
    sourceKind: 'string',
  },
  {
    path: '.agents/plugins/marketplace.json',
    sourceKind: 'object',
  },
];

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

describe('marketplace-manifests', () => {
  it('marketplace manifests declare local consensus plugin source', async () => {
    for (const { path: marketplacePath, sourceKind } of marketplaces) {
      const manifest = await readJson(marketplacePath);
      const entry = manifest.plugins?.find(
        (plugin: any) => plugin.name === 'consensus',
      );
      const sourcePath =
        typeof entry?.source === 'string' ? entry.source : entry?.source?.path;

      expect(manifest.name).toBe('skills');
      expect(entry, `${marketplacePath} should declare consensus`).toBeTruthy();
      expect(typeof entry.source).toBe(sourceKind);
      expect(sourcePath).toBe('./plugins/consensus');
      expect(
        sourcePath.includes('..'),
        `${marketplacePath} should not escape repo root`,
      ).toBe(false);

      const resolvedSourcePath = path.resolve((repoRoot as URL).pathname, sourcePath);
      expect(resolvedSourcePath.startsWith(path.resolve((repoRoot as URL).pathname))).toBeTruthy();
      expect((await stat(resolvedSourcePath)).isDirectory()).toBe(true);
    }
  });
});
