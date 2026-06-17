#!/usr/bin/env node
/**
 * Compatibility wrapper for the legacy transcript-core sync command.
 *
 * Transcript-core generated outputs are now owned by
 * scripts/build-generated.mjs. This wrapper preserves the old command entrypoint
 * while delegating all write and --check behavior to the canonical build path.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildGeneratedScript = join(__dirname, 'build-generated.mjs');

const child = spawn(
  process.execPath,
  [buildGeneratedScript, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);

child.on('error', (error) => {
  console.error(`[sync-transcript-core] ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
