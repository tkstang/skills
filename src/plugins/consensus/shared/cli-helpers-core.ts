import { lstat } from 'node:fs/promises';
import path from 'node:path';

import type { ProviderInventoryEntry } from '../provider-cli/types.js';

// Loop-free core of the shared consensus CLI helpers. Every export here is a
// pure primitive: argument parsing, path predicates, newline/prompt-block
// encoding, and JSON-envelope reading. Nothing in this module imports
// `consensus-loop.js`, so it carries no `ConsensusError`/`EXIT_CODES` edge and
// can be shared with owners that are deliberately decoupled from the loop
// (notably `src/skills/panel`, which keeps its own `PanelError` and
// `PANEL_EXIT_CODES`). The single import is a type-only provider type, which
// creates no runtime edge.
//
// The loop-coupled layer (`cli-helpers.ts`) re-exports this entire surface, so
// existing consumers keep identical exports and behavior; the helpers that
// raise `ConsensusError` (`providerCliUnavailableError`, `confineWrite`,
// `atomicWriteFile`) stay there. Do not add a loop import to this file — the
// panel decoupling guard in `tests/tooling/shared-cli-helpers-guard.test.ts`
// enforces that boundary.

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/u;

export function requireValue(
  argv: readonly string[],
  index: number,
  token: string,
) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${token} requires a value`);
  }
  return value;
}

export function parsePositiveInteger(
  value: string,
  flag: string,
  min = MAX_ROUNDS_MIN,
  max = MAX_ROUNDS_MAX,
) {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function validateProviderId(value: string, flag: string) {
  if (!PROVIDER_ID_PATTERN.test(value)) {
    throw new Error(
      `${flag} provider ids must match ${PROVIDER_ID_PATTERN.source}`,
    );
  }
  return value;
}

export function parsePeers(value: string) {
  const peers = value
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);
  if (peers.length !== 2) {
    throw new Error('--peers must list exactly two peers');
  }
  return peers.map((peer) => validateProviderId(peer, '--peers'));
}

export function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export function pathExists(targetPath: string) {
  return lstat(targetPath)
    .then(() => true)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    });
}

export async function nearestExistingPath(targetPath: string): Promise<string> {
  if (await pathExists(targetPath)) return targetPath;
  const parent = path.dirname(targetPath);
  if (parent === targetPath) return targetPath;
  return await nearestExistingPath(parent);
}

export function ensureFinalNewline(text: string) {
  return String(text ?? '').replace(/\n*$/u, '\n');
}

export function encodePromptBlockData(text: string) {
  return String(text ?? '')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function promptBlockData(text: string) {
  return ensureFinalNewline(encodePromptBlockData(text));
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseProviderCliEnvelope(stdout: string, label: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch (error) {
    throw new Error(
      `consensus ${label} output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!isJsonRecord(parsed) || parsed.schema_version !== 'v1') {
    throw new Error(`consensus ${label} output was not a v1 JSON envelope`);
  }
  return parsed;
}

export function providerStatusMap(envelope: Record<string, unknown>) {
  const providers = Array.isArray(envelope.providers) ? envelope.providers : [];
  const entries: Array<[string, string]> = [];
  for (const provider of providers) {
    if (!isJsonRecord(provider)) continue;
    const id = String(provider.id ?? provider.provider ?? provider.name ?? '');
    if (!id) continue;
    entries.push([id, String(provider.status ?? 'unavailable')]);
  }
  return new Map(entries);
}

export function providerInventoryEntries(
  envelope: Record<string, unknown>,
): ProviderInventoryEntry[] {
  return [...providerStatusMap(envelope)].map(
    ([id, status]) => ({ id, status }) as ProviderInventoryEntry,
  );
}
