import {
  lstat,
  mkdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { ConsensusError, EXIT_CODES } from '../core/consensus-loop.js';
import type { ProviderInventoryEntry } from '../provider-cli/types.js';

// Shared CLI helper primitives used by the consensus command modules
// (create/decide/plan/evaluate). Extracted verbatim from those modules'
// previously-duplicated copies so a fix lands once. `parsePositiveInteger`
// and `parsePeers` are the canonical (bounded, provider-id-validating)
// variants; `consensus-loop.ts` imports them to reconcile its previously-laxer
// copies. Panel keeps its own decoupled copies deliberately (it does not import
// consensus-loop; see consensus-panel.ts).

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/u;


export function requireValue(argv: readonly string[], index: number, token: string) {
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

export function providerCliUnavailableError(
  providers: Array<{ id: string; status: string }>,
) {
  const summary = providers
    .map((provider) => `${provider.id} (${provider.status})`)
    .join(', ');
  return new ConsensusError(
    `Consensus providers are unavailable: ${summary}. Run "consensus preflight --json --provider <id>" and resolve provider authentication or availability before retrying.`,
    {
      code: 'PEER_UNAVAILABLE',
      exitCode: EXIT_CODES.CONFIG,
      details: { providers },
    },
  );
}

export async function confineWrite(targetPath: string, rootPath: string) {
  const root = path.resolve(rootPath);
  const target = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(root, targetPath);

  if (!inside(root, target)) {
    throw new ConsensusError(`write path is outside allowed root: ${target}`, {
      code: 'WRITE_PATH_OUTSIDE_ROOT',
      exitCode: EXIT_CODES.NOPERM,
      details: { root, path: target },
    });
  }

  if (await pathExists(target)) {
    const targetStat = await lstat(target);
    if (targetStat.isSymbolicLink()) {
      throw new ConsensusError(`write target may not be a symlink: ${target}`, {
        code: 'WRITE_TARGET_SYMLINK',
        exitCode: EXIT_CODES.NOPERM,
        details: { path: target },
      });
    }
  }

  const realRoot = await realpath(root);
  const parent = path.dirname(target);
  const existing = await nearestExistingPath(parent);
  const realExisting = await realpath(existing);
  const realParent = path.resolve(
    realExisting,
    path.relative(existing, parent),
  );

  if (!inside(realRoot, realParent)) {
    throw new ConsensusError(
      `write path resolves outside allowed root: ${target}`,
      {
        code: 'WRITE_PATH_OUTSIDE_ROOT',
        exitCode: EXIT_CODES.NOPERM,
        details: { root, path: target },
      },
    );
  }

  return target;
}

export async function atomicWriteFile(
  targetPath: string,
  contents: string,
  options: { rootPath?: string } = {},
) {
  const writePath = options.rootPath
    ? await confineWrite(targetPath, options.rootPath)
    : path.resolve(targetPath);

  if (await pathExists(writePath)) {
    const targetStat = await lstat(writePath);
    if (targetStat.isSymbolicLink()) {
      throw new ConsensusError(
        `write target may not be a symlink: ${writePath}`,
        {
          code: 'WRITE_TARGET_SYMLINK',
          exitCode: EXIT_CODES.NOPERM,
          details: { path: writePath },
        },
      );
    }
  }

  await mkdir(path.dirname(writePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(writePath),
    `.${path.basename(writePath)}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`,
  );

  try {
    await writeFile(tempPath, contents);
    await rename(tempPath, writePath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch (cleanupError) {
      const code = (cleanupError as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        (error as Error & { cleanupError?: unknown }).cleanupError =
          cleanupError;
      }
    }
    throw error;
  }

  return writePath;
}
