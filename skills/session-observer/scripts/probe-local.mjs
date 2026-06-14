#!/usr/bin/env node
/**
 * probe-local.mjs — Opt-in helper for manual local verification.
 *
 * Resolves the sibling CLI via import.meta.url so it works regardless of
 * the caller's cwd. Never spawns a bare relative 'scripts/session-observer.mjs'.
 *
 * Usage:
 *   node probe-local.mjs [--runtime <claude-code|codex|cursor>] [--cwd <path>]
 *
 * Exit codes propagate from the CLI.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { discover } from './lib/locate.mjs';
import { rank } from './lib/rank.mjs';

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    runtime: { type: 'string', default: 'claude-code' },
    cwd: { type: 'string', default: process.cwd() },
  },
});

const runtime = values.runtime;
const cwd = values.cwd;

// ---------------------------------------------------------------------------
// Resolve sibling CLI via import.meta.url — never a bare relative path
// ---------------------------------------------------------------------------

const cliPath = fileURLToPath(
  new URL('./session-observer.mjs', import.meta.url),
);

// ---------------------------------------------------------------------------
// Brief header: discover candidates and show summary
// ---------------------------------------------------------------------------

process.stdout.write(`[probe-local] runtime: ${runtime}\n`);
process.stdout.write(`[probe-local] cwd: ${cwd}\n`);
const transcriptStoreByRuntime = {
  'claude-code': '~/.claude/projects/',
  codex: '~/.codex/sessions/',
  cursor: '~/.cursor/projects/',
};
process.stdout.write(
  `[probe-local] transcript store: ${transcriptStoreByRuntime[runtime] ?? '(unknown runtime)'}\n`,
);

let candidates = [];
try {
  candidates = await discover(runtime, cwd);
} catch (err) {
  process.stderr.write(`[probe-local] discover failed: ${err.message}\n`);
}

process.stdout.write(`[probe-local] candidates found: ${candidates.length}\n`);

if (candidates.length > 0) {
  const rankResult = rank(candidates, cwd);
  if (rankResult.winner) {
    process.stdout.write(
      `[probe-local] winner: ${rankResult.winner.sessionId} (tier ${rankResult.tier})\n`,
    );
    process.stdout.write(
      `[probe-local] transcript: ${rankResult.winner.transcriptPath}\n`,
    );
  } else if (rankResult.noMatch) {
    process.stdout.write(`[probe-local] no match in target cwd (noMatch)\n`);
  }
}

process.stdout.write(`[probe-local] --- spawning CLI review ---\n\n`);

// ---------------------------------------------------------------------------
// Spawn the CLI and pipe output
// ---------------------------------------------------------------------------

const result = spawnSync(
  'node',
  [cliPath, 'review', '--runtime', runtime, '--cwd', cwd],
  {
    stdio: 'inherit',
    timeout: 30000,
  },
);

// Propagate exit code from CLI
process.exit(result.status ?? 1);
