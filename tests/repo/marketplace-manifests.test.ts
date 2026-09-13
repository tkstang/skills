import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url);

const marketplaces = [
  { path: '.claude-plugin/marketplace.json', sourceKind: 'string' },
  { path: '.cursor-plugin/marketplace.json', sourceKind: 'string' },
  { path: '.agents/plugins/marketplace.json', sourceKind: 'object' },
] as const;

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

describe('marketplace-manifests', () => {
  it('declares local consensus and session plugin sources', async () => {
    for (const { path: marketplacePath, sourceKind } of marketplaces) {
      const manifest = await readJson(marketplacePath);
      expect(manifest.name).toBe('skills');

      for (const pluginName of ['consensus', 'session']) {
        const entry = manifest.plugins?.find(
          (plugin: any) => plugin.name === pluginName,
        );
        const sourcePath =
          typeof entry?.source === 'string'
            ? entry.source
            : entry?.source?.path;

        expect(
          entry,
          `${marketplacePath} should declare ${pluginName}`,
        ).toBeTruthy();
        expect(typeof entry.source).toBe(sourceKind);
        expect(sourcePath).toBe(`./plugins/${pluginName}`);
        expect(sourcePath.includes('..')).toBe(false);

        const resolvedSourcePath = path.resolve(
          (repoRoot as URL).pathname,
          sourcePath,
        );
        expect(
          resolvedSourcePath.startsWith(
            path.resolve((repoRoot as URL).pathname),
          ),
        ).toBe(true);
        expect((await stat(resolvedSourcePath)).isDirectory()).toBe(true);
      }
    }
  });
});
