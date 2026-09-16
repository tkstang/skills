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
  isJsonRecord,
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

// Peer-spec helpers. Kept in this layer because they type against the loop's
// PeerAgent/PeerSpec.
//
// Two transports exist, deliberately:
//
// - `--peer-agents '<json array>'` is the LOSSLESS transport and the only form
//   the wrappers emit. Model ids are arbitrary non-empty strings (config accepts
//   e.g. the Bedrock-style `anthropic.claude-...-v2:0`, or an id containing a
//   comma), so a delimiter-based encoding cannot round-trip them.
// - `--peers claude[:model[:effort]],codex[...]` stays as a human-friendly form
//   for direct CLI use. It is LOSSY: `:` and `,` are the delimiters, so a model
//   id containing either cannot be expressed. Wrappers must never emit it with
//   a model or effort attached — use `peerAgentsArgv` instead.
export const PEER_AGENTS_OPTION = '--peer-agents';

/**
 * Parse a `--peers` value. Accepts the JSON array form (anything starting with
 * `[`, delegated to {@link parsePeerAgentsJson}) and the human-friendly
 * colon/comma form: `claude,codex` (compatibility path, provider ids only) or
 * `claude:opus:high,codex:gpt-5:medium`. Trailing segments are optional, so
 * `claude:opus` selects a model and leaves effort to the provider CLI.
 *
 * The colon form cannot express a model id containing `:` or `,`; pass those
 * through `--peer-agents` instead.
 */
export function parsePeerAgents(value: string): PeerAgent[] {
  if (value.trimStart().startsWith('[')) {
    return parsePeerAgentsJson(value, '--peers');
  }
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
    throw new Error(
      '--peers entries must use provider[:model[:effort]]; model ids containing ":" or "," must be passed with --peer-agents',
    );
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

const PEER_AGENT_JSON_SHAPE =
  'a JSON array of two {provider, model?, effort?} objects';
const PEER_AGENT_KEYS = new Set(['provider', 'model', 'effort']);

/**
 * Parse the lossless `--peer-agents` transport: a JSON array of exactly two
 * `{provider, model?, effort?}` objects. Model and effort are arbitrary
 * non-empty strings, so nothing about their contents is reserved.
 */
export function parsePeerAgentsJson(
  value: string,
  option: string = PEER_AGENTS_OPTION,
): PeerAgent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(
      `${option} must be ${PEER_AGENT_JSON_SHAPE}: ${(error as Error).message}`,
      { cause: error },
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${option} must be ${PEER_AGENT_JSON_SHAPE}`);
  }
  if (parsed.length !== 2) {
    throw new Error(`${option} must list exactly two peers`);
  }
  return parsed.map((entry) => parsePeerAgentObject(entry, option));
}

function parsePeerAgentObject(entry: unknown, option: string): PeerAgent {
  if (!isJsonRecord(entry)) {
    throw new Error(`${option} entries must be ${PEER_AGENT_JSON_SHAPE}`);
  }
  for (const key of Object.keys(entry)) {
    if (!PEER_AGENT_KEYS.has(key)) {
      throw new Error(
        `${option} entries must not carry an unknown key: ${key}`,
      );
    }
  }
  const agent: PeerAgent = {
    provider: validateProviderId(
      typeof entry.provider === 'string' ? entry.provider : '',
      option,
    ),
  };
  // `undefined`/absent means "provider CLI default". Anything else present must
  // be a non-empty string; an empty or non-string value is a caller bug, not a
  // silent fallback.
  for (const key of ['model', 'effort'] as const) {
    const field = entry[key];
    if (field === undefined || field === null) continue;
    if (typeof field !== 'string' || field.length === 0) {
      throw new Error(`${option} ${key} must be a non-empty string`);
    }
    agent[key] = field;
  }
  return agent;
}

/** Render peers into the lossless `--peer-agents` JSON value. */
export function formatPeerAgentsJson(peers: readonly PeerSpec[]): string {
  return JSON.stringify(peerAgentsFromComposition(peers));
}

/**
 * Build the peer argv the wrappers emit. `--peers` stays provider-ids-only, so
 * argv is byte-identical to the pre-model-forwarding behavior whenever no model
 * or effort is selected; the lossless `--peer-agents` JSON is appended only when
 * at least one peer carries a selection.
 */
export function peerAgentsArgv(peers: readonly PeerSpec[]): string[] {
  const agents = peerAgentsFromComposition(peers);
  const argv = ['--peers', agents.map((agent) => agent.provider).join(',')];
  if (agents.some((agent) => agent.model || agent.effort)) {
    argv.push(PEER_AGENTS_OPTION, JSON.stringify(agents));
  }
  return argv;
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
 * Render peers back into a human-friendly `--peers` value. Provider-only peers
 * render exactly as before (`claude,codex`), so argv stays byte-identical when
 * no model or effort is selected.
 *
 * LOSSY when a model or effort is attached: `:` and `,` are the delimiters, so a
 * model id containing either does not round-trip. Wrappers must use
 * {@link peerAgentsArgv} — this stays for the human-facing `--peers` surface and
 * for rendering provider-only lists.
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
