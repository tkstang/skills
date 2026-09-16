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
import type { PeerAgent, PeerSpec } from '../core/loop-types.js';
import {
  inside,
  nearestExistingPath,
  pathExists,
  validateProviderId,
} from './cli-helpers-core.js';

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

// Peer-spec helpers for `--peers provider[:model[:effort]]`. Kept in this
// layer because they type against the loop's PeerAgent/PeerSpec.
/**
 * Parse a `--peers` value that may carry per-peer model/effort selections:
 * `claude,codex` (compatibility path, provider ids only) or
 * `claude:opus:high,codex:gpt-5:medium`. Trailing segments are optional, so
 * `claude:opus` selects a model and leaves effort to the provider CLI.
 */
export function parsePeerAgents(value: string): PeerAgent[] {
  const specs = value
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);
  if (specs.length !== 2) {
    throw new Error('--peers must list exactly two peers');
  }
  return specs.map((spec) => parsePeerAgentSpec(spec));
}

function parsePeerAgentSpec(spec: string): PeerAgent {
  const [provider, model, effort, ...extra] = spec.split(':');
  if (extra.length > 0) {
    throw new Error('--peers entries must use provider[:model[:effort]]');
  }
  const agent: PeerAgent = {
    provider: validateProviderId(provider ?? '', '--peers'),
  };
  // An empty segment means "omitted": `claude::high` selects an effort without
  // pinning a model, which is how formatPeerAgents renders that combination.
  if (model !== undefined && model.length > 0) agent.model = model;
  if (effort !== undefined && effort.length > 0) agent.effort = effort;
  return agent;
}

/**
 * Normalize resolved composition agents — or an invocation `--peers` override —
 * into loop peer agents. Invocation peers replace the whole list, so a
 * provider-only override deliberately carries no model or effort.
 */
export function peerAgentsFromComposition(
  agents: readonly PeerSpec[],
): PeerAgent[] {
  return agents.map((agent) => {
    const normalized = normalizePeerAgent(agent);
    return {
      provider: normalized.provider,
      ...(normalized.model ? { model: normalized.model } : {}),
      ...(normalized.effort ? { effort: normalized.effort } : {}),
    };
  });
}

/** Normalize a bare provider id or an agent reference into a `PeerAgent`. */
export function normalizePeerAgent(peer: PeerSpec): PeerAgent {
  return typeof peer === 'string' ? { provider: peer } : peer;
}

/**
 * Render peers back into a `--peers` value. Provider-only peers render exactly
 * as before (`claude,codex`), so argv stays byte-identical when no model or
 * effort is selected.
 */
export function formatPeerAgents(peers: readonly PeerSpec[]): string {
  return peers.map((peer) => formatPeerAgent(peer)).join(',');
}

function formatPeerAgent(peer: PeerSpec): string {
  const agent = normalizePeerAgent(peer);
  if (agent.effort) {
    return `${agent.provider}:${agent.model ?? ''}:${agent.effort}`;
  }
  if (agent.model) return `${agent.provider}:${agent.model}`;
  return agent.provider;
}
