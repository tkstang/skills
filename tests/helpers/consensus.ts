/**
 * consensus.ts — shared test helpers for consensus domain tests.
 *
 * Domain-specific utilities that recur across consensus loop/wrapper/evaluate
 * suites. Domain-neutral utilities (captureWriter, parseJsonl, runNodeScript,
 * repoRoot, fixtureBin, sampleInput, makeStubEnv, readJson) live in process.mjs.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'vitest';

import type {
  Agency,
  ColdStartMode,
  IterationMode,
  LoopOptions,
} from '../../src/consensus/core/consensus-loop.js';

/**
 * Extract and parse a `<!-- consensus:<label>\n...\n-->` JSON block from a
 * markdown deliberation artifact. Fails the calling test if the block is absent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJsonBlock(markdown: string, label: string): any {
  const pattern = new RegExp(
    '<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->',
  );
  const match = markdown.match(pattern);
  expect(match, `missing ${label} JSON block`).toBeTruthy();
  if (!match) throw new Error(`missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

export async function makeLoopOptions({
  sectionText = 'Brief: create a useful artifact.\n',
  iteration = 'alternating',
  coldStart = 'independent_draft',
  agency = 'moderate',
  maxRounds = 1,
  synthesizer = null,
}: {
  sectionText?: string;
  iteration?: IterationMode;
  coldStart?: ColdStartMode;
  agency?: Agency;
  maxRounds?: number;
  synthesizer?: string | null;
} = {}) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-loop-'));
  const sectionFile = path.join(tempRoot, 'section.md');
  await writeFile(sectionFile, sectionText);

  return {
    tempRoot,
    options: {
      sectionFile,
      goal: 'Create an artifact from the brief.',
      peers: ['claude', 'codex'],
      maxRounds,
      iteration,
      coldStart,
      agency,
      synthesizer,
      outputRecords: path.join(tempRoot, 'records.json'),
      outputSection: path.join(tempRoot, 'output.md'),
      outputStatus: path.join(tempRoot, 'status.json'),
    } satisfies LoopOptions,
  };
}
