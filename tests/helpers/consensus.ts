/**
 * consensus.ts — shared test helpers for consensus domain tests.
 *
 * Domain-specific utilities that recur across consensus loop/wrapper/evaluate
 * suites. Domain-neutral utilities (captureWriter, parseJsonl, runNodeScript,
 * repoRoot, fixtureBin, sampleInput, makeStubEnv, readJson) live in process.mjs.
 */

import { expect } from 'vitest';

/**
 * Extract and parse a `<!-- consensus:<label>\n...\n-->` JSON block from a
 * markdown deliberation artifact. Fails the calling test if the block is absent.
 */
export function extractJsonBlock(markdown: string, label: string): unknown {
  const pattern = new RegExp(
    '<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->',
  );
  const match = markdown.match(pattern);
  expect(match, `missing ${label} JSON block`).toBeTruthy();
  if (!match) throw new Error(`missing ${label} JSON block`);
  return JSON.parse(match[1]);
}
