/**
 * sync.test.mjs — Drift guard for the transcript-core sync script.
 *
 * Asserts that `node scripts/sync-transcript-core.mjs --check`:
 *   - exits 0 when every consumer copy is byte-in-sync with the canonical source
 *   - exits non-zero (and names the drifted consumer) when a copy is mutated
 *
 * The mutation test mutates a consumer copy in place and restores it in a
 * finally block so the working tree is left clean regardless of outcome.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SYNC_SCRIPT = join(REPO_ROOT, 'scripts', 'sync-transcript-core.mjs');

// Keep in sync with the CONSUMERS list in scripts/sync-transcript-core.mjs.
const CONSUMER = join(
  REPO_ROOT,
  'skills',
  'session-observer',
  'scripts',
  'lib',
  'runtimes.mjs',
);

function runCheck() {
  return spawnSync(process.execPath, [SYNC_SCRIPT, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

describe('sync-transcript-core --check (drift guard)', () => {
  it('exits 0 when every consumer is in sync', () => {
    const result = runCheck();
    assert.equal(
      result.status,
      0,
      `--check should pass; stderr: ${result.stderr}`,
    );
    assert.match(result.stdout, /all consumers in sync/);
  });

  it('exits non-zero and names the drifted consumer when a copy is mutated', async () => {
    const original = await readFile(CONSUMER, 'utf8');
    try {
      await writeFile(CONSUMER, original + '\n// drift\n', 'utf8');
      const result = runCheck();
      assert.notEqual(result.status, 0, '--check should fail on drift');
      assert.match(result.stderr, /DRIFT detected/);
      assert.match(result.stderr, /runtimes\.mjs/);
    } finally {
      // Restore the canonical synced content so the tree stays clean.
      await writeFile(CONSUMER, original, 'utf8');
    }

    // Confirm restoration leaves the guard green again.
    const restored = runCheck();
    assert.equal(
      restored.status,
      0,
      `--check should pass after restore; stderr: ${restored.stderr}`,
    );
  });
});
