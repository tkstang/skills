/**
 * tmpdir.ts — shared test helper for per-test temp STATE_DIR.
 *
 * Usage:
 *   import { withTmpStateDir } from './helpers/tmpdir.js';
 *
 *   // Inside a test:
 *   await withTmpStateDir(async (dir) => {
 *     // process.env.STATE_DIR === dir
 *   });
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates a fresh temp directory, sets process.env.STATE_DIR to it,
 * runs fn(dir), then cleans up regardless of whether fn throws.
 *
 */
export async function withTmpStateDir(
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'session-observer-test-'));
  const prev = process.env.STATE_DIR;
  process.env.STATE_DIR = dir;
  try {
    await fn(dir);
  } finally {
    if (prev === undefined) {
      delete process.env.STATE_DIR;
    } else {
      process.env.STATE_DIR = prev;
    }
    await rm(dir, { recursive: true, force: true });
  }
}
