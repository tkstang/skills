/**
 * session-search CLI — find past Claude Code, Codex, and Cursor sessions on
 * this machine from agent-expanded patterns plus optional time and cwd hints.
 *
 * Read-only: it never writes to session stores. Output is a ranked, redacted
 * candidate list (`--json` emits the `session-search/v1` schema).
 *
 * Exit codes: 0 results · 2 no sessions matched · 3 needs confirmation
 * (large scan; regardless of result count) · 1 usage or hard error.
 */
import { realpathSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  resolveOptions,
  UsageError,
  type RawOptionValues,
} from './lib/options.js';
import { estimate, runSearch, type EstimateResult } from './lib/pipeline.js';
import type { SearchResult } from './lib/types.js';

const PREFIX = '[session-search]';

const OPTIONS = {
  pattern: { type: 'string', short: 'p', multiple: true },
  literal: { type: 'boolean' },
  since: { type: 'string' },
  until: { type: 'string' },
  cwd: { type: 'string', multiple: true },
  runtime: { type: 'string', multiple: true },
  tiers: { type: 'string', multiple: true },
  'no-deep': { type: 'boolean' },
  'include-tools': { type: 'boolean' },
  'allow-large-scan': { type: 'boolean' },
  'large-scan-bytes': { type: 'string' },
  'max-line-bytes': { type: 'string' },
  limit: { type: 'string' },
  'deadline-ms': { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

export const HELP = `session-search — find a past Claude Code, Codex, or Cursor session on this machine

Usage:
  node session-search.mjs [search] -p <pattern> [-p <pattern> …] [flags]
  node session-search.mjs estimate [--since …] [--until …] [--cwd …] [--runtime …] [--json]

Search flags:
  -p, --pattern <regex>     case-insensitive pattern; repeatable; required for search.
                            Regexes are dotAll: \`.\` also matches newlines.
  --literal                 match patterns as plain text
  --since <spec>            24h | 7d | 2w | today | yesterday | YYYY-MM-DD | ISO date-time
  --until <spec>            same forms; must not be earlier than --since
  --cwd <path>              search this directory (and below) first; widens when empty.
                            Repeatable.
  --runtime <list>          claude-code,codex,cursor (default: all)
  --tiers <list>            history,meta,content (default: all)
  --no-deep                 never run the deep (tool-output) rung
  --include-tools           include tool output in the content tier
  --allow-large-scan        scan past the large-scan threshold
  --large-scan-bytes <n>    large-scan threshold in bytes (default: 2 GiB)
  --max-line-bytes <n>      skip transcript lines longer than this (default: 65536)
  --limit <n>               maximum results (default: 15)
  --deadline-ms <n>         return partial results after this many milliseconds
  --json                    emit session-search/v1 JSON
  -h, --help                this message

estimate prints per-runtime file counts and bytes inside the window (and cwd scope).

Environment:
  SESSION_SEARCH_RG, SESSION_SEARCH_SQLITE3        explicit tool paths
  SESSION_SEARCH_NO_RG=1, SESSION_SEARCH_NO_SQLITE3=1  force the fallbacks
  SESSION_SEARCH_PROBE_TIMEOUT_MS                  tool-probe timeout in ms (default 3000)

Exit codes: 0 results · 2 no sessions matched · 3 needs confirmation (large scan) · 1 usage or hard error`;

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: Readonly<Record<string, string | undefined>>;
  cwd: string;
}

const defaultIo = (): CliIo => ({
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  env: process.env,
  cwd: process.cwd(),
});

function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${bytes} B` : `${value.toFixed(1)} ${units[unit]}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Compact human-readable rendering of a search result. */
export function renderSearchText(result: SearchResult): string {
  const lines: string[] = [];
  const count = result.results.length;
  lines.push(
    `session-search: ${count} result${count === 1 ? '' : 's'} (tiers: ${
      result.tiersRun.join(', ') || 'none'
    })`,
  );
  if (result.widened) {
    lines.push(
      'note: nothing matched inside the --cwd hint; widened to all locations.',
    );
  }
  if (result.needsConfirmation) {
    const { estimatedBytes, fileCount } = result.needsConfirmation;
    lines.push(
      `note: a full content scan covers ${formatBytes(estimatedBytes)} across ${fileCount} files; re-run with --allow-large-scan to include it.`,
    );
  }
  if (result.incomplete)
    lines.push('note: results are incomplete (deadline reached).');
  for (const source of result.sources) {
    if (source.status === 'degraded') {
      lines.push(
        `note: ${source.runtime} source degraded: ${source.note ?? 'unknown reason'}`,
      );
    }
  }
  for (const hit of result.results) {
    const labels = [
      hit.archived ? 'archived' : null,
      hit.isSubagent ? 'subagent' : null,
    ]
      .filter((label) => label !== null)
      .join(', ');
    lines.push('');
    lines.push(
      `${hit.rank}. [${hit.runtime}] ${formatWhen(hit.lastActivity)}  ${hit.cwd ?? '(cwd unknown)'}${
        labels ? `  (${labels})` : ''
      }`,
    );
    if (hit.title) lines.push(`   title: ${hit.title}`);
    else if (hit.firstPrompt) lines.push(`   first prompt: ${hit.firstPrompt}`);
    const best = hit.snippets[0];
    if (best) lines.push(`   > [${best.role}/${best.tier}] ${best.text}`);
    lines.push(
      `   open: ${hit.open.command ? `${hit.open.command} — ` : ''}${hit.open.hint}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Compact human-readable rendering of an estimate. */
export function renderEstimateText(result: EstimateResult): string {
  const lines = [
    `session-search estimate (since ${result.query.since ?? 'the beginning'}, until ${
      result.query.until ?? 'now'
    })`,
  ];
  for (const entry of result.runtimes) {
    lines.push(
      `${entry.runtime.padEnd(12)} ${entry.status.padEnd(9)} ${String(entry.files).padStart(6)} files  ${formatBytes(
        entry.bytes,
      ).padStart(10)}  ${entry.root}${entry.note ? `  (${entry.note})` : ''}`,
    );
  }
  lines.push(
    `${'total'.padEnd(22)} ${String(result.totalFiles).padStart(6)} files  ${formatBytes(
      result.totalBytes,
    ).padStart(
      10,
    )}  (large-scan threshold ${formatBytes(result.largeScanBytes)}: ${
      result.exceedsLargeScan ? 'over' : 'under'
    })`,
  );
  return `${lines.join('\n')}\n`;
}

function parse(argv: readonly string[]) {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const unknown = Object.keys(values).filter((key) => !(key in OPTIONS));
  if (unknown.length > 0) {
    throw new UsageError(`Unknown option --${unknown[0]}.`);
  }
  if (positionals.length > 1) {
    throw new UsageError(`Unexpected argument "${positionals[1]}".`);
  }
  const command = positionals[0] ?? 'search';
  if (command !== 'search' && command !== 'estimate') {
    throw new UsageError(
      `Unknown command "${command}". Use search or estimate.`,
    );
  }
  const raw: RawOptionValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
    ) {
      raw[key] = value;
    }
  }
  return { command, raw, help: values.help === true };
}

/** Run the CLI and return its exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: CliIo = defaultIo(),
): Promise<number> {
  try {
    const { command, raw, help } = parse(argv);
    if (help) {
      io.stdout(`${HELP}\n`);
      return 0;
    }
    const home = io.env.HOME?.trim() || os.homedir();
    const options = resolveOptions(raw, { home, cwd: io.cwd });

    if (command === 'estimate') {
      const result = await estimate(options, { home, env: io.env });
      io.stdout(
        options.json
          ? `${JSON.stringify(result, null, 2)}\n`
          : renderEstimateText(result),
      );
      return 0;
    }

    if (options.patterns.length === 0) {
      throw new UsageError(
        'At least one --pattern (-p) is required for search.',
      );
    }
    const result = await runSearch(options, {
      home,
      env: io.env,
      // Notes go to stderr in every mode, so --json stdout stays pure JSON.
      onNote: (note) => io.stderr(`${PREFIX} note: ${note}\n`),
    });
    io.stdout(
      options.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : renderSearchText(result),
    );
    if (result.needsConfirmation) return 3;
    return result.results.length > 0 ? 0 : 2;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${PREFIX} ${error.message}\nRun with --help for usage.\n`);
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${PREFIX} error: ${message}\n`);
    return 1;
  }
}

// `node -e` code can set argv[1] to a positional argument that is not a path;
// importing this module that way must not throw or run the CLI.
function isEntrypointPath(argvPath: string): boolean {
  try {
    return (
      realpathSync(argvPath) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
}

if (process.argv[1] && isEntrypointPath(process.argv[1])) {
  process.exitCode = await main();
}
