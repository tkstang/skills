#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROBE_NAME = 'cursor-wake-surfaces';
const TEMPORARY_PREFIX = 'cursor-wake-probe-';
const VERSION_PROCESS_CAP_MS = 10_000;
const HOOK_TIMEOUT_SECONDS = 10;
const FOLLOWUP_LOOP_LIMIT = 1;
const TERMINATION_GRACE_MS = 2_000;
const OUTPUT_TAIL_LIMIT = 8_192;
const PROVIDER_ARTIFACT_CLOCK_SKEW_MS = 2_000;
const PROVIDER_ARTIFACT_MAX_ENTRIES = 512;
const PROVIDER_ARTIFACT_MAX_DEPTH = 8;
const PROVIDER_METADATA_MAX_BYTES = 1_048_576;

export const CURSOR_PROVIDER_STATE_ROOTS = Object.freeze([
  Object.freeze({
    id: 'projects',
    relativePath: '.cursor/projects',
    policy: 'encoded-workspace',
  }),
  Object.freeze({
    id: 'chats',
    relativePath: '.cursor/chats',
    policy: 'workspace-metadata',
  }),
]);

export const CURSOR_WAKE_PROBE_MODES = Object.freeze({
  TOP_LEVEL_STOP: 'top-level-stop',
  MANAGED_SUBAGENT: 'managed-subagent',
});

export const CURSOR_WAKE_PROBE_BOUNDS = Object.freeze({
  [CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP]: Object.freeze({
    processCapMs: 90_000,
    hookTimeoutSeconds: HOOK_TIMEOUT_SECONDS,
    followupLoopLimit: FOLLOWUP_LOOP_LIMIT,
  }),
  [CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT]: Object.freeze({
    processCapMs: 120_000,
    hookTimeoutSeconds: HOOK_TIMEOUT_SECONDS,
    followupLoopLimit: FOLLOWUP_LOOP_LIMIT,
  }),
});

export const CURSOR_WAKE_PROBE_MARKERS = Object.freeze({
  stopInitial: 'CURSOR_WAKE_PROBE_STOP_INITIAL',
  stopFollowup: 'CURSOR_WAKE_PROBE_STOP_FOLLOWUP',
  managedChild: 'CURSOR_WAKE_PROBE_MANAGED_CHILD',
  managedParent: 'CURSOR_WAKE_PROBE_MANAGED_PARENT',
  managedFollowup: 'CURSOR_WAKE_PROBE_MANAGED_FOLLOWUP',
});

const STOP_PROMPT = [
  `Return exactly ${CURSOR_WAKE_PROBE_MARKERS.stopInitial}.`,
  'Do not use tools, inspect files, or add commentary.',
].join(' ');

const MANAGED_PROMPT = [
  'Use the wake-probe-child subagent exactly once.',
  `Ask it to return exactly ${CURSOR_WAKE_PROBE_MARKERS.managedChild}.`,
  `After it finishes, return exactly ${CURSOR_WAKE_PROBE_MARKERS.managedParent}.`,
  `If a lifecycle follow-up supplies ${CURSOR_WAKE_PROBE_MARKERS.managedFollowup}, return that marker exactly.`,
  'Do not use any other tool or add commentary.',
].join(' ');

const MANAGED_CHILD_DEFINITION = `---
name: wake-probe-child
description: Fixed child used only by the isolated Cursor managed-callback probe.
---

Use no tools. On the initial task, return exactly
${CURSOR_WAKE_PROBE_MARKERS.managedChild}.

If a lifecycle follow-up supplies
${CURSOR_WAKE_PROBE_MARKERS.managedFollowup}, return that marker exactly.
`;

const STRUCTURAL_HOOK_SCRIPT = `#!/usr/bin/env node
import { appendFile } from 'node:fs/promises';

const hook = process.argv[2] ?? 'unknown';
let input = {};
try {
  input = JSON.parse(await new Promise((resolve) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      value += chunk;
    });
    process.stdin.on('end', () => resolve(value));
  }));
} catch {
  input = {};
}

const record = {
  schemaVersion: 1,
  hook,
  input: {
    conversationIdPresent: typeof input.conversation_id === 'string',
    generationIdPresent: typeof input.generation_id === 'string',
    statusPresent: typeof input.status === 'string',
    loopCountFinite: Number.isFinite(input.loop_count),
    subagentTypePresent:
      typeof input.subagent_type === 'string' ||
      typeof input.subagentType === 'string',
  },
};

await appendFile(
  new URL('../probe-events.jsonl', import.meta.url),
  \`\${JSON.stringify(record)}\\n\`,
  { mode: 0o600 },
);

if (hook === 'subagent-start') {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
} else if (hook === 'managed-subagent-stop') {
  process.stdout.write(
    JSON.stringify({
      followup_message: '${CURSOR_WAKE_PROBE_MARKERS.managedFollowup}',
    }),
  );
} else if (hook === 'top-level-stop') {
  process.stdout.write(
    JSON.stringify({
      followup_message: '${CURSOR_WAKE_PROBE_MARKERS.stopFollowup}',
    }),
  );
} else {
  process.stdout.write('{}');
}
`;

function hookDefinition(command, { loop = false } = {}) {
  return {
    command,
    type: 'command',
    timeout: HOOK_TIMEOUT_SECONDS,
    failClosed: false,
    ...(loop ? { loop_limit: FOLLOWUP_LOOP_LIMIT } : {}),
  };
}

function modeRecipe(mode) {
  if (mode === CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP) {
    return {
      mode,
      bounds: CURSOR_WAKE_PROBE_BOUNDS[mode],
      prompt: STOP_PROMPT,
      markers: [
        CURSOR_WAKE_PROBE_MARKERS.stopInitial,
        CURSOR_WAKE_PROBE_MARKERS.stopFollowup,
      ],
      expectedHooks: ['top-level-stop'],
      hooksConfig: {
        version: 1,
        hooks: {
          stop: [
            hookDefinition('node .cursor/hooks/probe-hook.mjs top-level-stop', {
              loop: true,
            }),
          ],
        },
      },
      childDefinition: null,
      agentArguments: ['--mode', 'ask'],
    };
  }

  if (mode === CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT) {
    return {
      mode,
      bounds: CURSOR_WAKE_PROBE_BOUNDS[mode],
      prompt: MANAGED_PROMPT,
      markers: [
        CURSOR_WAKE_PROBE_MARKERS.managedChild,
        CURSOR_WAKE_PROBE_MARKERS.managedParent,
        CURSOR_WAKE_PROBE_MARKERS.managedFollowup,
      ],
      expectedHooks: ['subagent-start', 'managed-subagent-stop'],
      hooksConfig: {
        version: 1,
        hooks: {
          subagentStart: [
            hookDefinition('node .cursor/hooks/probe-hook.mjs subagent-start'),
          ],
          subagentStop: [
            hookDefinition(
              'node .cursor/hooks/probe-hook.mjs managed-subagent-stop',
              { loop: true },
            ),
          ],
        },
      },
      childDefinition: MANAGED_CHILD_DEFINITION,
      agentArguments: [],
    };
  }

  throw new Error(`unsupported probe mode: ${mode}`);
}

export function describeCursorWakeProbeRecipes() {
  return {
    schemaVersion: 1,
    probe: PROBE_NAME,
    provider: {
      name: 'Cursor Agent',
      command: 'agent',
      versionCommand: ['agent', '--version'],
      versionProcessCapMs: VERSION_PROCESS_CAP_MS,
    },
    safety: {
      workspacePolicy: 'exact-created-workspace',
      providerStatePolicy: 'snapshot-new-exact-owned-remove',
      declaredProviderRoots: CURSOR_PROVIDER_STATE_ROOTS.map(
        ({ id, relativePath, policy }) => ({
          id,
          location: `cursor-home/${path.basename(relativePath)}`,
          attribution:
            policy === 'encoded-workspace'
              ? 'exact-encoded-workspace'
              : 'exact-workspace-metadata',
        }),
      ),
      preExistingArtifacts: 'preserved',
      ambiguousArtifacts: 'fail-without-removal',
      credentialsRequested: false,
      daemonStarted: false,
      schedulerStarted: false,
      externalServiceStarted: false,
      cleanup: 'remove-exact-created-workspace-and-proven-provider-state',
    },
    modes: [
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT,
    ].map((mode) => {
      const recipe = modeRecipe(mode);
      return {
        mode,
        bounds: recipe.bounds,
        prompt: recipe.prompt,
        markers: recipe.markers,
        expectedHooks: recipe.expectedHooks,
        hooksConfig: recipe.hooksConfig,
        childDefinitionPresent: recipe.childDefinition !== null,
      };
    }),
  };
}

function safeTemporaryWorkspace(workspace, temporaryParent) {
  const resolvedWorkspace = path.resolve(workspace);
  const resolvedParent = path.resolve(temporaryParent);
  return (
    resolvedWorkspace !== resolvedParent &&
    path.dirname(resolvedWorkspace) === resolvedParent &&
    path.basename(resolvedWorkspace).startsWith(TEMPORARY_PREFIX)
  );
}

async function removeTemporaryWorkspace(workspace, temporaryParent) {
  if (!safeTemporaryWorkspace(workspace, temporaryParent)) {
    return {
      attempted: false,
      succeeded: false,
      workspaceExistsAfter: true,
      diagnostic: 'unsafe-workspace-boundary',
    };
  }

  try {
    await rm(workspace, { recursive: true, force: true });
    const entries = await readdir(temporaryParent);
    return {
      attempted: true,
      succeeded: true,
      workspaceExistsAfter: entries.includes(path.basename(workspace)),
      diagnostic: 'removed-exact-created-workspace',
    };
  } catch {
    return {
      attempted: true,
      succeeded: false,
      workspaceExistsAfter: true,
      diagnostic: 'cleanup-failed',
    };
  }
}

export async function createCursorWakeProbeWorkspace(
  mode,
  { temporaryParent = tmpdir() } = {},
) {
  const recipe = modeRecipe(mode);
  const workspace = await mkdtemp(
    path.join(temporaryParent, `${TEMPORARY_PREFIX}${mode}-`),
  );
  const cursorDirectory = path.join(workspace, '.cursor');
  const hooksDirectory = path.join(cursorDirectory, 'hooks');
  const agentsDirectory = path.join(cursorDirectory, 'agents');
  await mkdir(hooksDirectory, { recursive: true });
  if (recipe.childDefinition !== null) {
    await mkdir(agentsDirectory, { recursive: true });
  }

  await Promise.all([
    writeFile(
      path.join(cursorDirectory, 'hooks.json'),
      `${JSON.stringify(recipe.hooksConfig, null, 2)}\n`,
      { mode: 0o600 },
    ),
    writeFile(
      path.join(hooksDirectory, 'probe-hook.mjs'),
      STRUCTURAL_HOOK_SCRIPT,
      { mode: 0o700 },
    ),
    writeFile(
      path.join(workspace, 'README.md'),
      '# Isolated Cursor wake probe\n',
      { mode: 0o600 },
    ),
    ...(recipe.childDefinition === null
      ? []
      : [
          writeFile(
            path.join(agentsDirectory, 'wake-probe-child.md'),
            recipe.childDefinition,
            { mode: 0o600 },
          ),
        ]),
  ]);
  await chmod(path.join(hooksDirectory, 'probe-hook.mjs'), 0o700);

  return {
    mode,
    recipe,
    workspace,
    cleanup: () => removeTemporaryWorkspace(workspace, temporaryParent),
  };
}

function cursorWakeProbeSafety() {
  return describeCursorWakeProbeRecipes().safety;
}

function encodeWorkspaceForProjectState(workspace) {
  return workspace
    .replace(/[^a-zA-Z0-9]/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function compactProjectStateName(root, workspace) {
  const unbounded = path.join(
    root.path,
    encodeWorkspaceForProjectState(workspace),
  );
  if (unbounded.length <= 92) return path.basename(unbounded);
  const digest = createHash('sha256')
    .update(unbounded)
    .digest('hex')
    .substring(0, 7);
  return path.basename(
    `${unbounded.substring(0, Math.min(84, unbounded.length))}-${digest}`,
  );
}

function resolveProviderStateRoots(options) {
  const configured = options.providerStateRoots;
  if (configured !== undefined) {
    if (!Array.isArray(configured)) {
      throw new Error('provider state roots must be an array');
    }
    return configured.map((root) => ({
      id: root.id,
      path: path.resolve(root.path),
      policy: root.policy,
    }));
  }

  const providerEnvironment = options.env ?? process.env;
  const cursorHome = providerEnvironment.CURSOR_DATA_DIR?.trim()
    ? path.resolve(providerEnvironment.CURSOR_DATA_DIR)
    : path.join(
        providerEnvironment.HOME ?? process.env.HOME ?? homedir(),
        '.cursor',
      );
  return CURSOR_PROVIDER_STATE_ROOTS.map(({ id, relativePath, policy }) => ({
    id,
    path: path.join(cursorHome, path.basename(relativePath)),
    policy,
  }));
}

function validProviderRootSet(roots) {
  return (
    roots.length === CURSOR_PROVIDER_STATE_ROOTS.length &&
    CURSOR_PROVIDER_STATE_ROOTS.every(({ id, policy }) => {
      const matches = roots.filter((root) => root.id === id);
      return (
        matches.length === 1 &&
        matches[0].policy === policy &&
        path.isAbsolute(matches[0].path)
      );
    })
  );
}

function safeArtifactFingerprint(stats) {
  return {
    device: stats.dev,
    inode: stats.ino,
    birthtimeMs: stats.birthtimeMs,
  };
}

function sameArtifactFingerprint(left, right) {
  return left.device === right.dev && left.inode === right.ino;
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function snapshotProviderState(options) {
  try {
    const roots = resolveProviderStateRoots(options);
    if (!validProviderRootSet(roots)) {
      return {
        succeeded: false,
        roots: [],
        takenAtMs: Date.now(),
        diagnostic: 'invalid-provider-root-contract',
      };
    }

    const snapshots = [];
    for (const root of roots) {
      const stats = await lstat(root.path);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        return {
          succeeded: false,
          roots: [],
          takenAtMs: Date.now(),
          diagnostic: 'unsafe-provider-root',
        };
      }
      const canonical = await realpath(root.path);
      snapshots.push({
        ...root,
        realPath: canonical,
        fingerprint: safeArtifactFingerprint(stats),
        entries: new Set(await readdir(root.path)),
      });
    }
    return {
      succeeded: true,
      roots: snapshots,
      takenAtMs: Date.now(),
      diagnostic: 'snapshotted-declared-provider-roots',
    };
  } catch {
    return {
      succeeded: false,
      roots: [],
      takenAtMs: Date.now(),
      diagnostic: 'provider-root-snapshot-failed',
    };
  }
}

function containsExactWorkspace(value, workspaces) {
  if (typeof value === 'string') return workspaces.has(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsExactWorkspace(entry, workspaces));
  }
  if (value === null || typeof value !== 'object') return false;
  return Object.values(value).some((entry) =>
    containsExactWorkspace(entry, workspaces),
  );
}

async function inspectArtifactTree(
  target,
  workspaces,
  { readWorkspaceMetadata },
) {
  const queue = [{ target, depth: 0 }];
  let entryCount = 0;
  let workspaceMetadataPresent = false;

  while (queue.length > 0) {
    const current = queue.shift();
    const stats = await lstat(current.target);
    entryCount += 1;
    if (
      stats.isSymbolicLink() ||
      entryCount > PROVIDER_ARTIFACT_MAX_ENTRIES ||
      current.depth > PROVIDER_ARTIFACT_MAX_DEPTH
    ) {
      return {
        safe: false,
        workspaceMetadataPresent: false,
        diagnostic: 'unsafe-provider-artifact-tree',
      };
    }
    if (stats.isDirectory()) {
      const entries = await readdir(current.target);
      queue.push(
        ...entries.map((entry) => ({
          target: path.join(current.target, entry),
          depth: current.depth + 1,
        })),
      );
      continue;
    }
    if (
      readWorkspaceMetadata &&
      stats.isFile() &&
      path.extname(current.target) === '.json' &&
      stats.size <= PROVIDER_METADATA_MAX_BYTES
    ) {
      try {
        const value = JSON.parse(await readFile(current.target, 'utf8'));
        workspaceMetadataPresent ||= containsExactWorkspace(value, workspaces);
      } catch {
        // Non-metadata JSON is not sufficient to establish ownership.
      }
    }
  }

  return {
    safe: true,
    workspaceMetadataPresent,
    diagnostic: 'bounded-provider-artifact-tree',
  };
}

async function inspectProviderArtifact(
  root,
  name,
  workspaceContext,
  providerWindow,
) {
  const target = path.join(root.path, name);
  try {
    const stats = await lstat(target);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return { target, owned: false, diagnostic: 'unsafe-artifact-target' };
    }
    const canonical = await realpath(target);
    if (path.dirname(canonical) !== root.realPath) {
      return { target, owned: false, diagnostic: 'artifact-root-escape' };
    }
    if (
      stats.birthtimeMs <
        providerWindow.startedAtMs - PROVIDER_ARTIFACT_CLOCK_SKEW_MS ||
      stats.birthtimeMs >
        providerWindow.endedAtMs + PROVIDER_ARTIFACT_CLOCK_SKEW_MS
    ) {
      return { target, owned: false, diagnostic: 'artifact-time-ambiguous' };
    }

    const tree = await inspectArtifactTree(
      target,
      workspaceContext.exactWorkspaces,
      { readWorkspaceMetadata: root.policy === 'workspace-metadata' },
    );
    if (!tree.safe) {
      return { target, owned: false, diagnostic: tree.diagnostic };
    }
    const owned =
      (root.policy === 'encoded-workspace' &&
        workspaceContext.encodedWorkspacesByRoot.get(root.id)?.has(name)) ||
      (root.policy === 'workspace-metadata' && tree.workspaceMetadataPresent);
    return {
      target,
      name,
      root,
      owned,
      fingerprint: safeArtifactFingerprint(stats),
      diagnostic: owned ? 'exact-provider-ownership-proven' : 'ambiguous-state',
    };
  } catch {
    return { target, owned: false, diagnostic: 'artifact-inspection-failed' };
  }
}

async function discoverProviderArtifacts(snapshot, workspace, providerWindow) {
  const canonicalWorkspace = await realpath(workspace);
  const exactWorkspaces = new Set([workspace, canonicalWorkspace]);
  const workspaceContext = {
    exactWorkspaces,
    encodedWorkspacesByRoot: new Map(
      snapshot.roots.map((root) => [
        root.id,
        new Set(
          [...exactWorkspaces].flatMap((exactWorkspace) => [
            encodeWorkspaceForProjectState(exactWorkspace),
            compactProjectStateName(root, exactWorkspace),
          ]),
        ),
      ]),
    ),
  };
  const artifacts = [];

  for (const root of snapshot.roots) {
    const currentRootStats = await lstat(root.path);
    const currentRootCanonical = await realpath(root.path);
    if (
      !currentRootStats.isDirectory() ||
      currentRootStats.isSymbolicLink() ||
      currentRootCanonical !== root.realPath ||
      !sameArtifactFingerprint(root.fingerprint, currentRootStats)
    ) {
      return {
        succeeded: false,
        workspaceContext,
        artifacts: [],
        diagnostic: 'provider-root-changed-during-probe',
      };
    }
    const newNames = (await readdir(root.path)).filter(
      (name) => !root.entries.has(name),
    );
    for (const name of newNames) {
      artifacts.push(
        await inspectProviderArtifact(
          root,
          name,
          workspaceContext,
          providerWindow,
        ),
      );
    }
  }

  return {
    succeeded: true,
    workspaceContext,
    artifacts,
    diagnostic: 'discovered-new-provider-state',
  };
}

async function cleanupProviderArtifacts(
  snapshot,
  workspace,
  providerWindow,
  options,
) {
  if (!snapshot.succeeded) {
    return {
      declaredRootCount: CURSOR_PROVIDER_STATE_ROOTS.length,
      snapshotSucceeded: false,
      discoveredNewCount: 0,
      ownershipProvenCount: 0,
      ambiguousCount: 0,
      removedCount: 0,
      existsAfterCount: 0,
      succeeded: false,
      diagnostic: snapshot.diagnostic,
    };
  }

  let discovery;
  try {
    discovery = await discoverProviderArtifacts(
      snapshot,
      workspace,
      providerWindow,
    );
  } catch {
    discovery = {
      succeeded: false,
      workspaceContext: null,
      artifacts: [],
      diagnostic: 'provider-artifact-discovery-failed',
    };
  }
  if (!discovery.succeeded) {
    return {
      declaredRootCount: snapshot.roots.length,
      snapshotSucceeded: true,
      discoveredNewCount: 0,
      ownershipProvenCount: 0,
      ambiguousCount: 0,
      removedCount: 0,
      existsAfterCount: 0,
      succeeded: false,
      diagnostic: discovery.diagnostic,
    };
  }

  const owned = discovery.artifacts.filter((artifact) => artifact.owned);
  const ambiguous = discovery.artifacts.filter((artifact) => !artifact.owned);
  const removeProviderArtifact =
    options.removeProviderArtifact ??
    ((target) => rm(target, { recursive: true, force: false }));
  let removedCount = 0;
  let removalFailed = false;

  for (const artifact of owned) {
    try {
      const reinspection = await inspectProviderArtifact(
        artifact.root,
        artifact.name,
        discovery.workspaceContext,
        providerWindow,
      );
      const stats = await lstat(artifact.target);
      if (
        !reinspection.owned ||
        reinspection.target !== artifact.target ||
        !sameArtifactFingerprint(artifact.fingerprint, stats)
      ) {
        removalFailed = true;
        continue;
      }
      await removeProviderArtifact(artifact.target);
      if (await pathExists(artifact.target)) {
        removalFailed = true;
      } else {
        removedCount += 1;
      }
    } catch {
      removalFailed = true;
    }
  }

  let existsAfterCount = 0;
  for (const artifact of discovery.artifacts) {
    try {
      if (await pathExists(artifact.target)) existsAfterCount += 1;
    } catch {
      existsAfterCount += 1;
    }
  }
  const succeeded =
    ambiguous.length === 0 &&
    !removalFailed &&
    removedCount === owned.length &&
    existsAfterCount === 0;
  return {
    declaredRootCount: snapshot.roots.length,
    snapshotSucceeded: true,
    discoveredNewCount: discovery.artifacts.length,
    ownershipProvenCount: owned.length,
    ambiguousCount: ambiguous.length,
    removedCount,
    existsAfterCount,
    succeeded,
    diagnostic: succeeded
      ? 'removed-exact-proven-provider-state'
      : ambiguous.length > 0
        ? 'ambiguous-provider-state-preserved'
        : 'provider-state-cleanup-failed',
  };
}

function combineCleanup(workspaceCleanup, providerArtifacts) {
  return {
    attempted: workspaceCleanup.attempted,
    succeeded: workspaceCleanup.succeeded && providerArtifacts.succeeded,
    workspaceExistsAfter: workspaceCleanup.workspaceExistsAfter,
    providerArtifacts,
    diagnostic:
      workspaceCleanup.succeeded && providerArtifacts.succeeded
        ? 'removed-exact-probe-state'
        : 'probe-state-cleanup-failed',
  };
}

export async function verifyCursorWakeProbeIsolationContract() {
  const root = await mkdtemp(
    path.join(tmpdir(), 'cursor-wake-isolation-contract-'),
  );
  try {
    const workspace = path.join(root, `${TEMPORARY_PREFIX}contract`);
    const projects = path.join(root, 'projects');
    const chats = path.join(root, 'chats');
    await Promise.all([
      mkdir(workspace),
      mkdir(projects),
      mkdir(chats),
      mkdir(path.join(root, 'preexisting-placeholder')),
    ]);
    const preexisting = path.join(projects, 'preexisting-provider-state');
    await mkdir(preexisting);
    const options = {
      providerStateRoots: [
        { id: 'projects', path: projects, policy: 'encoded-workspace' },
        { id: 'chats', path: chats, policy: 'workspace-metadata' },
      ],
    };
    const snapshot = await snapshotProviderState(options);
    const startedAtMs = Date.now();
    const project = path.join(
      projects,
      encodeWorkspaceForProjectState(await realpath(workspace)),
    );
    const chat = path.join(chats, 'contract-chat');
    await Promise.all([mkdir(project), mkdir(chat)]);
    await Promise.all([
      writeFile(path.join(project, 'worker.log'), 'contract\n'),
      writeFile(
        path.join(chat, 'metadata.json'),
        JSON.stringify({ workspace: await realpath(workspace) }),
      ),
    ]);
    const endedAtMs = Date.now();
    const cleanup = await cleanupProviderArtifacts(
      snapshot,
      workspace,
      { startedAtMs, endedAtMs },
      options,
    );
    return {
      schemaVersion: 1,
      succeeded:
        cleanup.succeeded &&
        cleanup.ownershipProvenCount === 2 &&
        cleanup.removedCount === 2 &&
        (await pathExists(preexisting)) &&
        !(await pathExists(project)) &&
        !(await pathExists(chat)),
      declaredRootCount: cleanup.declaredRootCount,
      ownershipProvenCount: cleanup.ownershipProvenCount,
      removedCount: cleanup.removedCount,
      preExistingPreserved: await pathExists(preexisting),
      ownedArtifactsAbsent:
        !(await pathExists(project)) && !(await pathExists(chat)),
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function appendOutputTail(current, chunk) {
  const next = `${current}${chunk.toString('utf8')}`;
  return next.slice(-OUTPUT_TAIL_LIMIT);
}

function terminateChild(child, signal) {
  if (child.pid && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child below.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The process has already exited.
  }
}

async function runBoundedProcess(command, arguments_, options) {
  const { cwd, env, timeoutMs } = options;
  return new Promise((resolve) => {
    let stdoutTail = '';
    let stderrTail = '';
    let timedOut = false;
    let spawnFailed = false;
    let settled = false;
    let killTimer;
    const child = spawn(command, arguments_, {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutTail = appendOutputTail(stdoutTail, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrTail = appendOutputTail(stderrTail, chunk);
    });
    child.once('error', () => {
      spawnFailed = true;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      terminateChild(child, 'SIGTERM');
      killTimer = setTimeout(() => {
        terminateChild(child, 'SIGKILL');
      }, TERMINATION_GRACE_MS);
    }, timeoutMs);

    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({
        commandRun: !spawnFailed,
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal ?? null,
        timedOut,
        spawnFailed,
        stdoutTail,
        stderrTail,
      });
    });
  });
}

function sanitizedProviderVersion(run) {
  if (run.exitCode !== 0 || run.timedOut || run.spawnFailed) {
    return 'unavailable';
  }
  const candidate = run.stdoutTail.trim().split(/\s+/u)[0] ?? '';
  return /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/u.test(candidate)
    ? candidate
    : 'unavailable';
}

async function readHookEvents(workspace) {
  try {
    const text = await readFile(
      path.join(workspace, '.cursor', 'probe-events.jsonl'),
      'utf8',
    );
    return text
      .split(/\r?\n/u)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const value = JSON.parse(line);
          return value?.schemaVersion === 1 && typeof value.hook === 'string'
            ? [value]
            : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function outcomeRow(id, expected, actual, status) {
  return { id, expected, actual, status };
}

function markerPresence(output, markers) {
  return Object.fromEntries(
    markers.map((marker) => [marker, output.includes(marker)]),
  );
}

function actualHookCounts(events, expectedHooks) {
  return Object.fromEntries(
    expectedHooks.map((hook) => [
      hook,
      events.filter((event) => event.hook === hook).length,
    ]),
  );
}

function allExpectedHooksRan(counts) {
  return Object.values(counts).every((count) => count >= 1);
}

function deliveredFollowup(mode, markers) {
  const marker =
    mode === CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP
      ? CURSOR_WAKE_PROBE_MARKERS.stopFollowup
      : CURSOR_WAKE_PROBE_MARKERS.managedFollowup;
  return markers[marker] === true;
}

export async function runCursorWakeProbe(mode, options = {}) {
  const recipe = modeRecipe(mode);
  const providerCommand = options.providerCommand ?? 'agent';
  const providerArgumentPrefix = options.providerArgumentPrefix ?? [];
  const processCapMs = options.processCapMs ?? recipe.bounds.processCapMs;
  const temporary = await createCursorWakeProbeWorkspace(mode, options);
  const providerSnapshot = await snapshotProviderState(options);

  if (!providerSnapshot.succeeded) {
    const workspaceCleanup = await temporary.cleanup();
    const providerArtifacts = await cleanupProviderArtifacts(
      providerSnapshot,
      temporary.workspace,
      {
        startedAtMs: providerSnapshot.takenAtMs,
        endedAtMs: Date.now(),
      },
      options,
    );
    return {
      schemaVersion: 1,
      probe: PROBE_NAME,
      mode,
      executionStatus: 'safety-failed',
      evidenceLabel: 'unavailable',
      provider: {
        name: 'Cursor Agent',
        version: 'unavailable',
        architecture: process.arch,
      },
      bounds: {
        processCapMs,
        hookTimeoutSeconds: recipe.bounds.hookTimeoutSeconds,
        followupLoopLimit: recipe.bounds.followupLoopLimit,
      },
      safety: cursorWakeProbeSafety(),
      setup: {
        hooksConfigVersion: recipe.hooksConfig.version,
        hookEvents: Object.keys(recipe.hooksConfig.hooks),
        hookScriptPresent: true,
        childDefinitionPresent: recipe.childDefinition !== null,
        fixedPrompt: true,
        fixedMarkers: recipe.markers,
      },
      rows: [
        outcomeRow(
          'provider-state-boundary',
          {
            snapshotSucceeded: true,
            ambiguousCount: 0,
            existsAfterCount: 0,
          },
          {
            snapshotSucceeded: false,
            ambiguousCount: 0,
            existsAfterCount: 0,
          },
          'failed',
        ),
      ],
      cleanup: combineCleanup(workspaceCleanup, providerArtifacts),
    };
  }

  const providerStartedAtMs = Date.now();
  let versionRun;
  let providerRun;
  let events;
  let providerEndedAtMs;
  let providerArtifacts;
  let workspaceCleanup;
  try {
    versionRun = await runBoundedProcess(
      providerCommand,
      [...providerArgumentPrefix, '--version'],
      {
        cwd: temporary.workspace,
        env: options.env ?? process.env,
        timeoutMs: options.versionProcessCapMs ?? VERSION_PROCESS_CAP_MS,
      },
    );
    providerRun = await runBoundedProcess(
      providerCommand,
      [
        ...providerArgumentPrefix,
        '-p',
        '--output-format',
        'text',
        '--trust',
        '--workspace',
        temporary.workspace,
        ...recipe.agentArguments,
        recipe.prompt,
      ],
      {
        cwd: temporary.workspace,
        env: options.env ?? process.env,
        timeoutMs: processCapMs,
      },
    );
    providerEndedAtMs = Date.now();
    events = await readHookEvents(temporary.workspace);
  } finally {
    providerEndedAtMs ??= Date.now();
    try {
      providerArtifacts = await cleanupProviderArtifacts(
        providerSnapshot,
        temporary.workspace,
        { startedAtMs: providerStartedAtMs, endedAtMs: providerEndedAtMs },
        options,
      );
    } finally {
      workspaceCleanup = await temporary.cleanup();
    }
  }
  const cleanup = combineCleanup(workspaceCleanup, providerArtifacts);
  const hooks = actualHookCounts(events, recipe.expectedHooks);
  const markers = markerPresence(providerRun.stdoutTail, recipe.markers);
  const providerCompleted =
    providerRun.commandRun &&
    providerRun.exitCode === 0 &&
    providerRun.timedOut === false;
  const callbacksRan = allExpectedHooksRan(hooks);
  const followupDelivered = deliveredFollowup(mode, markers);
  const surfaceOutcome =
    providerCompleted && callbacksRan && followupDelivered
      ? 'callback-delivered'
      : providerCompleted
        ? 'callback-unavailable'
        : versionRun.spawnFailed
          ? 'provider-unavailable'
          : 'provider-process-failed';
  const safetySucceeded = cleanup.succeeded;

  return {
    schemaVersion: 1,
    probe: PROBE_NAME,
    mode,
    executionStatus: safetySucceeded ? 'completed' : 'safety-failed',
    evidenceLabel:
      safetySucceeded && surfaceOutcome === 'callback-delivered'
        ? 'live-validated'
        : 'unavailable',
    provider: {
      name: 'Cursor Agent',
      version: sanitizedProviderVersion(versionRun),
      architecture: process.arch,
    },
    bounds: {
      processCapMs,
      hookTimeoutSeconds: recipe.bounds.hookTimeoutSeconds,
      followupLoopLimit: recipe.bounds.followupLoopLimit,
    },
    safety: cursorWakeProbeSafety(),
    setup: {
      hooksConfigVersion: recipe.hooksConfig.version,
      hookEvents: Object.keys(recipe.hooksConfig.hooks),
      hookScriptPresent: true,
      childDefinitionPresent: recipe.childDefinition !== null,
      fixedPrompt: true,
      fixedMarkers: recipe.markers,
    },
    rows: [
      outcomeRow(
        'provider-version',
        { available: true },
        { available: sanitizedProviderVersion(versionRun) !== 'unavailable' },
        sanitizedProviderVersion(versionRun) !== 'unavailable'
          ? 'passed'
          : 'unavailable',
      ),
      outcomeRow(
        'bounded-provider-process',
        { commandRun: true, exitCode: 0, timedOut: false },
        {
          commandRun: providerRun.commandRun,
          exitCode: providerRun.exitCode,
          timedOut: providerRun.timedOut,
        },
        providerCompleted ? 'passed' : 'unavailable',
      ),
      outcomeRow(
        'lifecycle-hooks',
        Object.fromEntries(recipe.expectedHooks.map((hook) => [hook, 1])),
        hooks,
        callbacksRan ? 'passed' : 'unavailable',
      ),
      outcomeRow(
        'fixed-markers',
        Object.fromEntries(recipe.markers.map((marker) => [marker, true])),
        markers,
        followupDelivered ? 'passed' : 'unavailable',
      ),
      outcomeRow(
        'surface-outcome',
        { callbackDelivered: true },
        {
          callbackDelivered: followupDelivered,
          outcome: surfaceOutcome,
        },
        surfaceOutcome === 'callback-delivered' ? 'passed' : 'unavailable',
      ),
      outcomeRow(
        'provider-state-boundary',
        {
          snapshotSucceeded: true,
          ambiguousCount: 0,
          existsAfterCount: 0,
        },
        {
          snapshotSucceeded: providerArtifacts.snapshotSucceeded,
          ambiguousCount: providerArtifacts.ambiguousCount,
          existsAfterCount: providerArtifacts.existsAfterCount,
        },
        providerArtifacts.succeeded ? 'passed' : 'failed',
      ),
    ],
    cleanup,
  };
}

function parseArgs(argv) {
  let mode;
  let describe = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--mode') {
      mode = argv[++index];
    } else if (argument === '--describe') {
      describe = true;
    } else if (argument !== '--json') {
      throw new Error('unknown argument');
    }
  }

  if (describe) return { describe: true };
  if (
    mode !== CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP &&
    mode !== CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT
  ) {
    throw new Error('mode must be top-level-stop or managed-subagent');
  }
  return { describe: false, mode };
}

async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const output = options.describe
      ? describeCursorWakeProbeRecipes()
      : await runCursorWakeProbe(options.mode);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output.cleanup?.succeeded === false ? 2 : 0;
  } catch {
    process.stdout.write(
      `${JSON.stringify({
        schemaVersion: 1,
        probe: PROBE_NAME,
        executionStatus: 'error',
        diagnostic: 'probe-error',
      })}\n`,
    );
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
