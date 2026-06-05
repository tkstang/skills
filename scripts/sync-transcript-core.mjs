#!/usr/bin/env node
/**
 * sync-transcript-core.mjs — Materialize the canonical transcript-core module
 * into each consuming skill's scripts/lib as a committed, byte-identical copy.
 *
 * The canonical source of truth is shared/transcript-core/runtimes.mjs. Each
 * consumer copy is generated as: <banner>\n<canonical contents>. The banner
 * marks the copy as generated so it is never hand-edited.
 *
 * Modes:
 *   node scripts/sync-transcript-core.mjs            write synced copies
 *   node scripts/sync-transcript-core.mjs --check    verify in-sync (exit 1 on drift)
 *
 * Dependency-free: Node standard library only.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// Canonical single source of truth.
const CANONICAL = join(REPO_ROOT, 'shared', 'transcript-core', 'runtimes.mjs');

// Generated-copy banner. Consumers receive this banner followed by a blank line
// and then the canonical contents, byte-for-byte.
const BANNER = [
  '// GENERATED — do not edit. Source: shared/transcript-core/runtimes.mjs',
  '// Run: npm run sync:transcript-core',
].join('\n');

// Consumers that receive a synced copy of the canonical module. Paths are
// relative to the repository root.
const CONSUMERS = [
  'skills/session-observer/scripts/lib/runtimes.mjs',
  'skills/export-session-transcript/scripts/lib/runtimes.mjs',
];

/**
 * Build the expected synced content for a consumer from the canonical source.
 * @param {string} canonicalContents
 * @returns {string}
 */
function buildSyncedContent(canonicalContents) {
  return `${BANNER}\n\n${canonicalContents}`;
}

/**
 * Write the synced copy to every consumer, creating parent dirs as needed.
 * @param {string} expected
 * @returns {Promise<void>}
 */
async function writeConsumers(expected) {
  for (const rel of CONSUMERS) {
    const dest = join(REPO_ROOT, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, expected, 'utf8');
    console.log(`[sync-transcript-core] wrote ${rel}`);
  }
}

/**
 * Verify every consumer is byte-identical to the expected synced content.
 * @param {string} expected
 * @returns {Promise<string[]>} list of consumer paths that drifted
 */
async function checkConsumers(expected) {
  const drifted = [];
  for (const rel of CONSUMERS) {
    const dest = join(REPO_ROOT, rel);
    let actual;
    try {
      actual = await readFile(dest, 'utf8');
    } catch (err) {
      drifted.push(`${rel} (missing: ${err.code ?? err.message})`);
      continue;
    }
    if (actual !== expected) drifted.push(rel);
  }
  return drifted;
}

async function main() {
  const check = process.argv.includes('--check');
  const canonicalContents = await readFile(CANONICAL, 'utf8');
  const expected = buildSyncedContent(canonicalContents);

  if (check) {
    const drifted = await checkConsumers(expected);
    if (drifted.length > 0) {
      console.error('[sync-transcript-core] DRIFT detected in:');
      for (const rel of drifted) console.error(`  - ${rel}`);
      console.error('Run: npm run sync:transcript-core');
      process.exit(1);
    }
    console.log('[sync-transcript-core] all consumers in sync');
    return;
  }

  await writeConsumers(expected);
}

main().catch((err) => {
  console.error(`[sync-transcript-core] ${err.stack ?? err.message}`);
  process.exit(1);
});
