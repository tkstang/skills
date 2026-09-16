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
import { inside, nearestExistingPath, pathExists } from './cli-helpers-core.js';

// Shared CLI helper primitives used by the consensus command modules
// (create/decide/plan/evaluate). Extracted verbatim from those modules'
// previously-duplicated copies so a fix lands once. `parsePositiveInteger`
// and `parsePeers` are the canonical (bounded, provider-id-validating)
// variants; `consensus-loop.ts` imports them to reconcile its previously-laxer
// copies.
//
// This is the loop-coupled layer: it holds only the helpers that raise
// `ConsensusError` with a loop `EXIT_CODES` value. Every pure primitive lives
// in `./cli-helpers-core.js` and is re-exported below, so this module's export
// surface is unchanged for existing consumers. Panel imports the loop-free core
// directly to keep its own `PanelError`/`PANEL_EXIT_CODES` decoupling; see
// `src/skills/panel/src/consensus-panel.ts` and
// `tests/tooling/shared-cli-helpers-guard.test.ts`.
export {
  encodePromptBlockData,
  ensureFinalNewline,
  inside,
  isJsonRecord,
  nearestExistingPath,
  parsePeers,
  parsePositiveInteger,
  parseProviderCliEnvelope,
  pathExists,
  promptBlockData,
  providerInventoryEntries,
  providerStatusMap,
  requireValue,
  validateProviderId,
} from './cli-helpers-core.js';

export function providerCliUnavailableError(
  providers: Array<{ id: string; status: string }>,
) {
  const summary = providers
    .map((provider) => `${provider.id} (${provider.status})`)
    .join(', ');
  return new ConsensusError(
    `Consensus providers are unavailable: ${summary}. Run "consensus preflight --json --provider <id> --capability run" and resolve provider compatibility, authentication, or availability before retrying.`,
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
