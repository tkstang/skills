/**
 * Optional accelerator probe: locate `rg` and `sqlite3`.
 *
 * Resolution order per tool:
 * 1. An explicit `SESSION_SEARCH_RG` / `SESSION_SEARCH_SQLITE3` path. An
 *    unusable explicit path yields `null` plus a note (no fall-through).
 * 2. A forced fallback `SESSION_SEARCH_NO_RG=1` / `SESSION_SEARCH_NO_SQLITE3=1`.
 * 3. A `PATH` lookup.
 * 4. Common absolute locations, because non-interactive remote shells often
 *    lack Homebrew on `PATH`.
 *
 * Every candidate is verified by running `<path> --version` within the probe
 * timeout: `SESSION_SEARCH_PROBE_TIMEOUT_MS` (default 3000, clamped to
 * 500–60000; an invalid value uses the default and adds a note). Slow wrapper
 * shims need a larger value. The probe never throws.
 */
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';

import type { ToolProbe } from './types.js';

export type ProbeEnv = Readonly<Record<string, string | undefined>>;

export const ABSOLUTE_TOOL_DIRS: readonly string[] = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
];
export const DEFAULT_PROBE_TIMEOUT_MS = 3000;
export const MIN_PROBE_TIMEOUT_MS = 500;
export const MAX_PROBE_TIMEOUT_MS = 60_000;
const PROBE_TIMEOUT_VAR = 'SESSION_SEARCH_PROBE_TIMEOUT_MS';

interface ToolSpec {
  name: 'rg' | 'sqlite3';
  overrideVar: string;
  disableVar: string;
}

const TOOLS: readonly ToolSpec[] = [
  {
    name: 'rg',
    overrideVar: 'SESSION_SEARCH_RG',
    disableVar: 'SESSION_SEARCH_NO_RG',
  },
  {
    name: 'sqlite3',
    overrideVar: 'SESSION_SEARCH_SQLITE3',
    disableVar: 'SESSION_SEARCH_NO_SQLITE3',
  },
];

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve the `--version` probe timeout from the environment. An invalid value
 * yields the default and, when `notes` is given, a diagnostic note.
 */
export function probeTimeoutMs(env: ProbeEnv, notes?: string[]): number {
  const raw = env[PROBE_TIMEOUT_VAR]?.trim();
  if (!raw) return DEFAULT_PROBE_TIMEOUT_MS;
  const value = /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    notes?.push(
      `${PROBE_TIMEOUT_VAR}=${raw} is not a positive integer; using ${DEFAULT_PROBE_TIMEOUT_MS} ms.`,
    );
    return DEFAULT_PROBE_TIMEOUT_MS;
  }
  return Math.min(MAX_PROBE_TIMEOUT_MS, Math.max(MIN_PROBE_TIMEOUT_MS, value));
}

/** True when `candidate --version` runs and exits 0 within the timeout. */
export function verifyExecutable(
  candidate: string,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
): boolean {
  if (!path.isAbsolute(candidate) || !isFile(candidate)) return false;
  try {
    const result = spawnSync(candidate, ['--version'], {
      timeout: timeoutMs,
      stdio: 'ignore',
      windowsHide: true,
    });
    // ENOENT, EACCES, timeouts, and signals all surface as absence.
    return result.error === undefined && result.status === 0;
  } catch {
    return false;
  }
}

function executableNames(name: string): string[] {
  return process.platform === 'win32' ? [`${name}.exe`, name] : [name];
}

function isEnabled(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function resolveTool(
  spec: ToolSpec,
  env: ProbeEnv,
  notes: string[],
  timeoutMs: number,
): string | null {
  const override = env[spec.overrideVar]?.trim();
  if (override) {
    const candidate = path.resolve(override);
    if (verifyExecutable(candidate, timeoutMs)) return candidate;
    notes.push(
      `${spec.overrideVar}=${override} is not a usable ${spec.name} executable; continuing without ${spec.name}.`,
    );
    return null;
  }
  if (isEnabled(env[spec.disableVar])) return null;

  const pathDirs = (env.PATH ?? '')
    .split(path.delimiter)
    .filter((dir) => dir !== '' && path.isAbsolute(dir));
  const seen = new Set<string>();
  for (const dir of [...pathDirs, ...ABSOLUTE_TOOL_DIRS]) {
    for (const name of executableNames(spec.name)) {
      const candidate = path.join(dir, name);
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (verifyExecutable(candidate, timeoutMs)) return candidate;
    }
  }
  return null;
}

/** Resolve optional `rg` and `sqlite3` paths. Never throws. */
export function probeTools(env: ProbeEnv = process.env): ToolProbe {
  const notes: string[] = [];
  const timeoutMs = probeTimeoutMs(env, notes);
  const [rg, sqlite3] = TOOLS.map((spec) =>
    resolveTool(spec, env, notes, timeoutMs),
  );
  return { rg, sqlite3, notes };
}
