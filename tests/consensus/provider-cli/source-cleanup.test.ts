import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from '../../helpers/process.mjs';

const scanRoots = [
  'src',
  'plugins/consensus',
  'tests',
  'scripts',
  'README.md',
  'RELEASING.md',
  'CONTRIBUTING.md',
] as const;

const historicalExclusions = [
  '.oat',
  '.oat/projects/shared/consensus-peer-invocation/research',
] as const;

const cleanupScanPath = 'tests/consensus/provider-cli/source-cleanup.test.ts';

const retiredIdentifierPatterns = [
  /\bpaseo\b/i,
  /getpaseo/i,
  /install-paseo/i,
  /CONSENSUS_PROVIDER_BACKEND/,
  /CONSENSUS_SMOKE_PROVIDER_BACKEND/,
  /provider_backend/,
  /provider-backend/,
  /raw_paseo_response/,
  /PASEO_/,
  /invokePaseo/,
  /preflightPaseo/,
  /paseoExitCode/,
] as const;

async function collectFiles(relativePath: string): Promise<string[]> {
  const absolutePath = path.join(repoRoot, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(
    async (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOTDIR') return null;
      throw error;
    },
  );

  if (!entries) return [relativePath];

  const files: string[] = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

function isExcluded(relativePath: string) {
  return (
    relativePath === cleanupScanPath ||
    historicalExclusions.some(
      (excluded) =>
        relativePath === excluded || relativePath.startsWith(`${excluded}/`),
    )
  );
}

describe('provider CLI source cleanup', () => {
  it('does not keep retired backend identifiers in maintained source', async () => {
    const files = (
      await Promise.all(scanRoots.map((root) => collectFiles(root)))
    )
      .flat()
      .filter((file) => !isExcluded(file))
      .toSorted();

    const matches: string[] = [];
    for (const file of files) {
      const contents = await readFile(path.join(repoRoot, file), 'utf8');
      const matchedPatterns = retiredIdentifierPatterns.filter((pattern) =>
        pattern.test(contents),
      );
      if (matchedPatterns.length > 0) {
        matches.push(
          `${file}: ${matchedPatterns.map((pattern) => pattern.source).join(', ')}`,
        );
      }
    }

    expect(matches).toEqual([]);
  });
});
