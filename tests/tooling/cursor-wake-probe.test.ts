import { execFile as execFileCallback } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

// @ts-expect-error The probe is an authored Node CLI without declarations.
import * as wakeProbe from '../../scripts/probe-cursor-wake-surfaces.mjs';
// @ts-expect-error The validator is an authored Node CLI without declarations.
import * as cursorEvidence from '../../scripts/validate-cursor-evidence.mjs';

const {
  createCursorWakeProbeWorkspace,
  CURSOR_WAKE_PROBE_BOUNDS,
  CURSOR_WAKE_PROBE_MARKERS,
  CURSOR_WAKE_PROBE_MODES,
  describeCursorWakeProbeRecipes,
  runCursorWakeProbe,
  verifyCursorWakeProbeIsolationContract,
} = wakeProbe;
const { scanCursorEvidenceText } = cursorEvidence;
const execFile = promisify(execFileCallback);
const temporaryRoots: string[] = [];

const FAKE_PROVIDER = `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const arguments_ = process.argv.slice(2);
if (process.env.CURSOR_WAKE_FAKE_INVOCATION_MARKER) {
  writeFileSync(process.env.CURSOR_WAKE_FAKE_INVOCATION_MARKER, 'invoked\\n');
}
if (arguments_.includes('--version')) {
  if (process.env.CURSOR_WAKE_FAKE_VERSION_UNAVAILABLE === '1') {
    process.exit(1);
  }
  process.stdout.write('test-version\\n');
  process.exit(0);
}
const workspaceIndex = arguments_.indexOf('--workspace');
const workspace = arguments_[workspaceIndex + 1];
const encodeWorkspace = (value) =>
  value
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
const compactProjectName = (root, value) => {
  const unbounded = path.join(root, encodeWorkspace(value));
  if (unbounded.length <= 92) return path.basename(unbounded);
  const digest = createHash('sha256')
    .update(unbounded)
    .digest('hex')
    .substring(0, 7);
  return path.basename(
    \`\${unbounded.substring(0, Math.min(84, unbounded.length))}-\${digest}\`,
  );
};
if (process.env.CURSOR_WAKE_FAKE_PROJECTS_ROOT) {
  const projectNames = process.env.CURSOR_WAKE_FAKE_PROJECT_SYMLINK_TARGET
    ? [encodeWorkspace(workspace)]
    : [
        encodeWorkspace(workspace),
        encodeWorkspace(realpathSync(workspace)),
        compactProjectName(
          process.env.CURSOR_WAKE_FAKE_PROJECTS_ROOT,
          workspace,
        ),
      ];
  const uniqueProjectNames = [...new Set(projectNames)];
  const project = path.join(
    process.env.CURSOR_WAKE_FAKE_PROJECTS_ROOT,
    uniqueProjectNames[0],
  );
  if (process.env.CURSOR_WAKE_FAKE_PROJECT_SYMLINK_TARGET) {
    symlinkSync(process.env.CURSOR_WAKE_FAKE_PROJECT_SYMLINK_TARGET, project);
  } else {
    for (const name of uniqueProjectNames) {
      const owned = path.join(process.env.CURSOR_WAKE_FAKE_PROJECTS_ROOT, name);
      mkdirSync(owned, { recursive: true });
      writeFileSync(path.join(owned, 'worker.log'), 'structural fake\\n');
    }
  }
  if (process.env.CURSOR_WAKE_FAKE_AMBIGUOUS_PROJECT === '1') {
    const ambiguous = path.join(
      process.env.CURSOR_WAKE_FAKE_PROJECTS_ROOT,
      \`unrelated-\${path.basename(workspace)}\`,
    );
    mkdirSync(ambiguous, { recursive: true });
    writeFileSync(path.join(ambiguous, 'worker.log'), 'ambiguous fake\\n');
  }
}
if (process.env.CURSOR_WAKE_FAKE_CHATS_ROOT) {
  const chat = path.join(
    process.env.CURSOR_WAKE_FAKE_CHATS_ROOT,
    \`chat-\${path.basename(workspace)}\`,
  );
  mkdirSync(chat, { recursive: true });
  writeFileSync(
    path.join(chat, 'metadata.json'),
    JSON.stringify({ workspace: realpathSync(workspace) }),
  );
}
if (process.env.CURSOR_WAKE_FAKE_MUTATE_EXISTING) {
  writeFileSync(
    process.env.CURSOR_WAKE_FAKE_MUTATE_EXISTING,
    'mutated structural fake\\n',
  );
}
if (process.env.CURSOR_WAKE_FAKE_EXPAND_EXISTING) {
  writeFileSync(
    path.join(process.env.CURSOR_WAKE_FAKE_EXPAND_EXISTING, 'expanded.log'),
    'expanded structural fake\\n',
  );
}
if (process.env.CURSOR_WAKE_FAKE_HANG === '1') {
  setInterval(() => {}, 1000);
} else {
  const hooks = JSON.parse(
    readFileSync(path.join(workspace, '.cursor', 'hooks.json'), 'utf8'),
  );
  const hook = path.join(workspace, '.cursor', 'hooks', 'probe-hook.mjs');
  const input = JSON.stringify({
    conversation_id: 'synthetic-conversation',
    generation_id: 'synthetic-generation',
    status: 'success',
    loop_count: 0,
    subagent_type: 'wake-probe-child',
  });
  const invoke = (event) =>
    execFileSync(process.execPath, [hook, event], {
      cwd: workspace,
      input,
      encoding: 'utf8',
    });

  if (hooks.hooks.stop) {
    const followup = invoke('top-level-stop');
    process.stdout.write(
      ['CURSOR_WAKE_PROBE_STOP_INITIAL', followup].join('\\n'),
    );
  } else {
    const child = readFileSync(
      path.join(workspace, '.cursor', 'agents', 'wake-probe-child.md'),
      'utf8',
    );
    if (!child.includes('CURSOR_WAKE_PROBE_MANAGED_CHILD')) process.exit(5);
    invoke('subagent-start');
    const followup = invoke('managed-subagent-stop');
    process.stdout.write(
      [
        'CURSOR_WAKE_PROBE_MANAGED_CHILD',
        'CURSOR_WAKE_PROBE_MANAGED_PARENT',
        followup,
      ].join('\\n'),
    );
  }
}
`;

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cursor-wake-probe-test-'));
  temporaryRoots.push(root);
  return root;
}

async function fakeProvider(root: string) {
  const script = join(root, 'fake-provider.mjs');
  await writeFile(script, FAKE_PROVIDER, { mode: 0o700 });
  return script;
}

async function providerBoundary(root: string) {
  const projects = join(root, 'provider-projects');
  const chats = join(root, 'provider-chats');
  await Promise.all([mkdir(projects), mkdir(chats)]);
  return {
    projects,
    chats,
    providerStateRoots: [
      { id: 'projects', path: projects, policy: 'encoded-workspace' },
      { id: 'chats', path: chats, policy: 'workspace-metadata' },
    ],
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe('Cursor wake-surface probe', () => {
  it('describes both complete recipes with fixed external bounds', () => {
    const description = describeCursorWakeProbeRecipes();

    expect(description.provider).toEqual({
      name: 'Cursor Agent',
      command: 'agent',
      versionCommand: ['agent', '--version'],
      versionProcessCapMs: 10_000,
    });
    expect(description.safety).toMatchObject({
      workspacePolicy: 'exact-created-workspace',
      providerStatePolicy: 'snapshot-new-exact-owned-remove',
      preExistingArtifacts: 'preserved',
      ambiguousArtifacts: 'fail-without-removal',
      credentialsRequested: false,
      daemonStarted: false,
      schedulerStarted: false,
      externalServiceStarted: false,
      cleanup: 'remove-exact-created-workspace-and-proven-provider-state',
    });
    expect(description.safety.declaredProviderRoots).toEqual([
      {
        id: 'projects',
        location: 'cursor-home/projects',
        attribution: 'exact-encoded-workspace',
      },
      {
        id: 'chats',
        location: 'cursor-home/chats',
        attribution: 'exact-workspace-metadata',
      },
    ]);
    expect(description.modes.map(({ mode }: { mode: string }) => mode)).toEqual(
      [
        CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
        CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT,
      ],
    );
    expect(CURSOR_WAKE_PROBE_BOUNDS).toEqual({
      [CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP]: {
        processCapMs: 90_000,
        hookTimeoutSeconds: 10,
        followupLoopLimit: 1,
      },
      [CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT]: {
        processCapMs: 120_000,
        hookTimeoutSeconds: 10,
        followupLoopLimit: 1,
      },
    });

    for (const recipe of description.modes) {
      expect(recipe.prompt).not.toMatch(/<[^>]+>/u);
      expect(recipe.markers.length).toBeGreaterThanOrEqual(2);
      expect(recipe.expectedHooks.length).toBeGreaterThanOrEqual(1);
      expect(recipe.hooksConfig.version).toBe(1);
      expect(JSON.stringify(recipe.hooksConfig)).toContain('"timeout":10');
      expect(JSON.stringify(recipe.hooksConfig)).toContain('"loop_limit":1');
    }
    expect(description.modes[0].childDefinitionPresent).toBe(false);
    expect(description.modes[1].childDefinitionPresent).toBe(true);
  });

  it.each([
    [
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      ['stop'],
      false,
      'node .cursor/hooks/probe-hook.mjs top-level-stop',
    ],
    [
      CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT,
      ['subagentStart', 'subagentStop'],
      true,
      'node .cursor/hooks/probe-hook.mjs managed-subagent-stop',
    ],
  ])(
    'creates and safely removes the complete %s workspace',
    async (mode, hookEvents, childDefinitionPresent, expectedCommand) => {
      const root = await temporaryRoot();
      const temporary = await createCursorWakeProbeWorkspace(mode, {
        temporaryParent: root,
      });
      const hooks = JSON.parse(
        await readFile(
          join(temporary.workspace, '.cursor', 'hooks.json'),
          'utf8',
        ),
      );
      const hookScript = await readFile(
        join(temporary.workspace, '.cursor', 'hooks', 'probe-hook.mjs'),
        'utf8',
      );

      expect(hooks.version).toBe(1);
      expect(Object.keys(hooks.hooks)).toEqual(hookEvents);
      expect(JSON.stringify(hooks)).toContain(expectedCommand);
      expect(JSON.stringify(hooks)).toContain('"timeout":10');
      expect(JSON.stringify(hooks)).toContain('"loop_limit":1');
      expect(hookScript).toContain('conversationIdPresent');
      expect(hookScript).toContain('generationIdPresent');
      expect(hookScript).not.toContain('JSON.stringify(input)');

      if (childDefinitionPresent) {
        const child = await readFile(
          join(temporary.workspace, '.cursor', 'agents', 'wake-probe-child.md'),
          'utf8',
        );
        expect(child).toContain('name: wake-probe-child');
        expect(child).toContain(CURSOR_WAKE_PROBE_MARKERS.managedChild);
        expect(child).toContain(CURSOR_WAKE_PROBE_MARKERS.managedFollowup);
      }

      await expect(temporary.cleanup()).resolves.toEqual({
        attempted: true,
        succeeded: true,
        workspaceExistsAfter: false,
        diagnostic: 'removed-exact-created-workspace',
      });
      await expect(access(temporary.workspace)).rejects.toThrow();
    },
  );

  it.each([
    CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
    CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT,
  ])(
    'emits structural expected-vs-actual JSON and cleans up for %s',
    async (mode) => {
      const root = await temporaryRoot();
      const provider = await fakeProvider(root);
      const boundary = await providerBoundary(root);
      const result = await runCursorWakeProbe(mode, {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
      });

      expect(result).toMatchObject({
        schemaVersion: 1,
        probe: 'cursor-wake-surfaces',
        mode,
        executionStatus: 'completed',
        evidenceLabel: 'live-validated',
        provider: {
          name: 'Cursor Agent',
          version: 'test-version',
        },
        bounds: {
          processCapMs: 2_000,
          hookTimeoutSeconds: 10,
          followupLoopLimit: 1,
        },
        safety: {
          workspacePolicy: 'exact-created-workspace',
          providerStatePolicy: 'snapshot-new-exact-owned-remove',
          preExistingArtifacts: 'preserved',
          ambiguousArtifacts: 'fail-without-removal',
          credentialsRequested: false,
          daemonStarted: false,
          schedulerStarted: false,
          externalServiceStarted: false,
        },
        cleanup: {
          attempted: true,
          succeeded: true,
          workspaceExistsAfter: false,
          providerArtifacts: {
            snapshotSucceeded: true,
            ambiguousCount: 0,
            existsAfterCount: 0,
            succeeded: true,
          },
        },
      });
      expect(result.rows.map(({ id }: { id: string }) => id)).toEqual([
        'provider-version',
        'bounded-provider-process',
        'lifecycle-hooks',
        'fixed-markers',
        'surface-outcome',
        'provider-state-boundary',
      ]);
      expect(result.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'lifecycle-hooks',
            status: 'passed',
            expected: expect.any(Object),
            actual: expect.any(Object),
          }),
          expect.objectContaining({
            id: 'surface-outcome',
            status: 'passed',
            actual: {
              callbackDelivered: true,
              outcome: 'callback-delivered',
            },
          }),
        ]),
      );
      expect(
        scanCursorEvidenceText('probe-result.json', JSON.stringify(result)),
      ).toEqual([]);
      expect(
        (await readdir(root)).filter((entry) =>
          entry.startsWith('cursor-wake-probe-'),
        ),
      ).toEqual([]);
    },
  );

  it('terminates an over-cap provider process and still removes the workspace', async () => {
    const root = await temporaryRoot();
    const provider = await fakeProvider(root);
    const boundary = await providerBoundary(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 500,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_HANG: '1',
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
        },
      },
    );

    expect(result.rows).toContainEqual(
      expect.objectContaining({
        id: 'bounded-provider-process',
        status: 'unavailable',
        actual: expect.objectContaining({ timedOut: true }),
      }),
    );
    expect(result.cleanup).toMatchObject({
      attempted: true,
      succeeded: true,
      workspaceExistsAfter: false,
      providerArtifacts: {
        discoveredNewCount: 4,
        removedCount: 4,
        existsAfterCount: 0,
        succeeded: true,
      },
    });
    expect(await readdir(boundary.projects)).toEqual([]);
    expect(await readdir(boundary.chats)).toEqual([]);
    expect(
      (await readdir(root)).filter((entry) =>
        entry.startsWith('cursor-wake-probe-'),
      ),
    ).toEqual([]);
  });

  it('does not promote successful callbacks without provider version evidence', async () => {
    const root = await temporaryRoot();
    const provider = await fakeProvider(root);
    const boundary = await providerBoundary(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_VERSION_UNAVAILABLE: '1',
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'completed',
      evidenceLabel: 'unavailable',
      provider: { version: 'unavailable' },
      cleanup: { succeeded: true },
    });
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'provider-version',
          status: 'unavailable',
          actual: { available: false },
        }),
        expect.objectContaining({
          id: 'surface-outcome',
          status: 'passed',
          actual: {
            callbackDelivered: true,
            outcome: 'callback-delivered',
          },
        }),
      ]),
    );
  });

  it('removes exact provider-owned artifacts written outside --workspace', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
        },
      },
    );

    expect(result.cleanup).toMatchObject({
      succeeded: true,
      workspaceExistsAfter: false,
      providerArtifacts: {
        declaredRootCount: 2,
        discoveredNewCount: 4,
        ownershipProvenCount: 4,
        ambiguousCount: 0,
        removedCount: 4,
        existsAfterCount: 0,
        succeeded: true,
      },
    });
    expect(await readdir(boundary.projects)).toEqual([]);
    expect(await readdir(boundary.chats)).toEqual([]);
  });

  it('preserves every pre-existing provider entry while removing newly owned state', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const preexistingProject = 'cursor-wake-probe-preexisting-project';
    const preexistingChat = 'cursor-wake-probe-preexisting-chat';
    await Promise.all([
      mkdir(join(boundary.projects, preexistingProject)),
      mkdir(join(boundary.chats, preexistingChat)),
    ]);
    await writeFile(
      join(boundary.chats, preexistingChat, 'metadata.json'),
      JSON.stringify({ workspace: '/private/var/old-cursor-wake-probe' }),
    );
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
        },
      },
    );

    expect(result.cleanup.providerArtifacts).toMatchObject({
      discoveredNewCount: 4,
      ownershipProvenCount: 4,
      removedCount: 4,
      ambiguousCount: 0,
      succeeded: true,
    });
    expect(await readdir(boundary.projects)).toEqual([preexistingProject]);
    expect(await readdir(boundary.chats)).toEqual([preexistingChat]);
  });

  it('fails cleanup evidence when a pre-existing provider entry is mutated', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const preexistingProject = join(
      boundary.projects,
      'cursor-wake-probe-preexisting-project',
    );
    const preexistingFile = join(preexistingProject, 'worker.log');
    await mkdir(preexistingProject);
    await writeFile(preexistingFile, 'original structural fake\n');
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
          CURSOR_WAKE_FAKE_MUTATE_EXISTING: preexistingFile,
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      evidenceLabel: 'unavailable',
      cleanup: {
        succeeded: false,
        providerArtifacts: {
          preExistingPreserved: false,
          discoveredNewCount: 4,
          ownershipProvenCount: 4,
          removedCount: 4,
          existsAfterCount: 0,
          succeeded: false,
          diagnostic: 'pre-existing-provider-state-changed',
        },
      },
    });
    expect(await readdir(boundary.projects)).toEqual([
      'cursor-wake-probe-preexisting-project',
    ]);
    expect(await readdir(boundary.chats)).toEqual([]);
    expect(await readFile(preexistingFile, 'utf8')).toBe(
      'mutated structural fake\n',
    );
  });

  it('fails before provider launch when the shared pre-run state budget is exceeded', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const invocationMarker = join(root, 'provider-invoked');
    await Promise.all(
      [
        join(boundary.projects, 'project-one'),
        join(boundary.projects, 'project-two'),
        join(boundary.chats, 'chat-one'),
        join(boundary.chats, 'chat-two'),
      ].map(async (entry) => {
        await mkdir(entry);
        await writeFile(join(entry, 'state.log'), 'bounded structural fake\n');
      }),
    );
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        providerStateScanMaxEntries: 7,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_INVOCATION_MARKER: invocationMarker,
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      evidenceLabel: 'unavailable',
      provider: { version: 'unavailable' },
      cleanup: {
        succeeded: false,
        workspaceExistsAfter: false,
        providerArtifacts: {
          snapshotSucceeded: false,
          succeeded: false,
          diagnostic: 'provider-state-scan-entry-budget-exceeded',
        },
      },
    });
    expect(result.rows.map(({ id }: { id: string }) => id)).toEqual([
      'provider-state-boundary',
    ]);
    await expect(access(invocationMarker)).rejects.toThrow();
  });

  it.each([
    [
      'byte',
      { providerStateScanMaxBytes: 20 },
      'provider-state-scan-byte-budget-exceeded',
    ],
    [
      'time',
      {
        providerStateScanMaxElapsedMs: 2,
        providerStateScanNow: (() => {
          let tick = 0;
          return () => tick++;
        })(),
      },
      'provider-state-scan-time-budget-exceeded',
    ],
  ])(
    'fails before provider launch when the shared pre-run %s budget is exceeded',
    async (_budget, budgetOptions, diagnostic) => {
      const root = await temporaryRoot();
      const boundary = await providerBoundary(root);
      const invocationMarker = join(root, 'provider-invoked');
      const project = join(boundary.projects, 'project-one');
      const chat = join(boundary.chats, 'chat-one');
      await Promise.all([mkdir(project), mkdir(chat)]);
      await Promise.all([
        writeFile(join(project, 'state.log'), 'project structural fake\n'),
        writeFile(join(chat, 'state.log'), 'chat structural fake\n'),
      ]);
      const provider = await fakeProvider(root);
      const result = await runCursorWakeProbe(
        CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
        {
          providerCommand: process.execPath,
          providerArgumentPrefix: [provider],
          providerStateRoots: boundary.providerStateRoots,
          temporaryParent: root,
          processCapMs: 2_000,
          env: {
            ...process.env,
            CURSOR_WAKE_FAKE_INVOCATION_MARKER: invocationMarker,
          },
          ...budgetOptions,
        },
      );

      expect(result).toMatchObject({
        executionStatus: 'safety-failed',
        evidenceLabel: 'unavailable',
        provider: { version: 'unavailable' },
        cleanup: {
          succeeded: false,
          workspaceExistsAfter: false,
          providerArtifacts: {
            snapshotSucceeded: false,
            succeeded: false,
            diagnostic,
          },
        },
      });
      await expect(access(invocationMarker)).rejects.toThrow();
    },
  );

  it('surfaces shared post-run preservation budget exhaustion while cleaning proven new state', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const preexistingProject = join(
      boundary.projects,
      'cursor-wake-probe-preexisting-project',
    );
    await mkdir(preexistingProject);
    await writeFile(
      join(preexistingProject, 'worker.log'),
      'original structural fake\n',
    );
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        providerStateScanMaxEntries: 2,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
          CURSOR_WAKE_FAKE_EXPAND_EXISTING: preexistingProject,
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      evidenceLabel: 'unavailable',
      cleanup: {
        succeeded: false,
        workspaceExistsAfter: false,
        providerArtifacts: {
          snapshotSucceeded: true,
          preExistingPreserved: false,
          discoveredNewCount: 4,
          ownershipProvenCount: 4,
          removedCount: 4,
          existsAfterCount: 0,
          succeeded: false,
          diagnostic: 'provider-state-scan-entry-budget-exceeded',
        },
      },
    });
    expect(await readdir(boundary.projects)).toEqual([
      'cursor-wake-probe-preexisting-project',
    ]);
    expect(await readdir(preexistingProject)).toEqual([
      'expanded.log',
      'worker.log',
    ]);
    expect(await readdir(boundary.chats)).toEqual([]);
  });

  it.each([
    ['entry', 'provider-state-scan-entry-budget-exceeded'],
    ['byte', 'provider-state-scan-byte-budget-exceeded'],
    ['time', 'provider-state-scan-time-budget-exceeded'],
  ])(
    'preserves cross-root exact cleanup after post-run %s-budget exhaustion',
    async (budget, diagnostic) => {
      const root = await temporaryRoot();
      const boundary = await providerBoundary(root);
      const preexistingChat = join(
        boundary.chats,
        'cursor-wake-probe-preexisting-chat',
      );
      await mkdir(preexistingChat);
      if (budget === 'byte') {
        await writeFile(join(preexistingChat, 'state.log'), 'x');
      }
      const provider = await fakeProvider(root);
      let clockCalls = 0;
      const scanOptions =
        budget === 'entry'
          ? { providerStateScanMaxEntries: 1 }
          : budget === 'byte'
            ? { providerStateScanMaxBytes: 1 }
            : {
                providerStateScanMaxElapsedMs: 1,
                providerStateScanNow: () => {
                  clockCalls += 1;
                  return clockCalls <= 6 ? 0 : 2;
                },
              };
      const result = await runCursorWakeProbe(
        CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
        {
          providerCommand: process.execPath,
          providerArgumentPrefix: [provider],
          providerStateRoots: boundary.providerStateRoots,
          temporaryParent: root,
          processCapMs: 2_000,
          env: {
            ...process.env,
            CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
            CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
            CURSOR_WAKE_FAKE_EXPAND_EXISTING: preexistingChat,
          },
          ...scanOptions,
        },
      );

      expect(result).toMatchObject({
        executionStatus: 'safety-failed',
        evidenceLabel: 'unavailable',
        cleanup: {
          succeeded: false,
          workspaceExistsAfter: false,
          providerArtifacts: {
            snapshotSucceeded: true,
            preExistingPreserved: false,
            discoveredNewCount: 4,
            ownershipProvenCount: 4,
            removedCount: 4,
            existsAfterCount: 0,
            succeeded: false,
            diagnostic,
          },
        },
      });
      expect(await readdir(boundary.projects)).toEqual([]);
      expect(await readdir(boundary.chats)).toEqual([
        'cursor-wake-probe-preexisting-chat',
      ]);
      expect(await readdir(preexistingChat)).toEqual(
        budget === 'byte' ? ['expanded.log', 'state.log'] : ['expanded.log'],
      );
    },
  );

  it('retains and removes partial exact discovery when the cleanup discovery budget is exhausted', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        providerStateCleanupMaxEntries: 3,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_CHATS_ROOT: boundary.chats,
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      evidenceLabel: 'unavailable',
      cleanup: {
        succeeded: false,
        workspaceExistsAfter: false,
        providerArtifacts: {
          snapshotSucceeded: true,
          preExistingPreserved: true,
          discoveredNewCount: 1,
          ownershipProvenCount: 1,
          removedCount: 1,
          existsAfterCount: 0,
          succeeded: false,
          diagnostic: 'provider-state-cleanup-entry-budget-exceeded',
        },
      },
    });
    expect(await readdir(boundary.projects)).toHaveLength(2);
    expect(await readdir(boundary.chats)).toHaveLength(1);
  });

  it('fails closed and preserves a new symlink that escapes a provider root', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const escapeTarget = join(root, 'unrelated-provider-state');
    await mkdir(escapeTarget);
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_PROJECT_SYMLINK_TARGET: escapeTarget,
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      evidenceLabel: 'unavailable',
      cleanup: {
        succeeded: false,
        workspaceExistsAfter: false,
        providerArtifacts: {
          discoveredNewCount: 1,
          ownershipProvenCount: 0,
          ambiguousCount: 1,
          removedCount: 0,
          existsAfterCount: 1,
          succeeded: false,
          diagnostic: 'ambiguous-provider-state-preserved',
        },
      },
    });
    expect(await readdir(boundary.projects)).toHaveLength(1);
    expect(await readdir(escapeTarget)).toEqual([]);
  });

  it('removes proven state but fails closed on an unrelated new provider entry', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
          CURSOR_WAKE_FAKE_AMBIGUOUS_PROJECT: '1',
        },
      },
    );

    expect(result.cleanup.providerArtifacts).toMatchObject({
      discoveredNewCount: 4,
      ownershipProvenCount: 3,
      ambiguousCount: 1,
      removedCount: 3,
      existsAfterCount: 1,
      succeeded: false,
    });
    expect(result.executionStatus).toBe('safety-failed');
    expect(await readdir(boundary.projects)).toEqual([
      expect.stringMatching(/^unrelated-cursor-wake-probe-/u),
    ]);
  });

  it('surfaces exact provider-state deletion failure and verifies the artifact remains', async () => {
    const root = await temporaryRoot();
    const boundary = await providerBoundary(root);
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: boundary.providerStateRoots,
        temporaryParent: root,
        processCapMs: 2_000,
        env: {
          ...process.env,
          CURSOR_WAKE_FAKE_PROJECTS_ROOT: boundary.projects,
        },
        removeProviderArtifact: async () => {
          throw new Error('synthetic deletion failure');
        },
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      cleanup: {
        succeeded: false,
        workspaceExistsAfter: false,
        providerArtifacts: {
          ownershipProvenCount: 3,
          removedCount: 0,
          existsAfterCount: 3,
          succeeded: false,
          diagnostic: 'provider-state-cleanup-failed',
        },
      },
    });
    expect(await readdir(boundary.projects)).toHaveLength(3);
  });

  it('rejects a symlinked provider root before invoking the provider', async () => {
    const root = await temporaryRoot();
    const actualProjects = join(root, 'actual-projects');
    const linkedProjects = join(root, 'linked-projects');
    const chats = join(root, 'provider-chats');
    await Promise.all([mkdir(actualProjects), mkdir(chats)]);
    await symlink(actualProjects, linkedProjects);
    const provider = await fakeProvider(root);
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        providerStateRoots: [
          {
            id: 'projects',
            path: linkedProjects,
            policy: 'encoded-workspace',
          },
          { id: 'chats', path: chats, policy: 'workspace-metadata' },
        ],
        temporaryParent: root,
        processCapMs: 2_000,
      },
    );

    expect(result).toMatchObject({
      executionStatus: 'safety-failed',
      provider: { version: 'unavailable' },
      cleanup: {
        succeeded: false,
        workspaceExistsAfter: false,
        providerArtifacts: {
          snapshotSucceeded: false,
          succeeded: false,
          diagnostic: 'unsafe-provider-root',
        },
      },
    });
    expect(result.rows.map(({ id }: { id: string }) => id)).toEqual([
      'provider-state-boundary',
    ]);
    expect(await readdir(actualProjects)).toEqual([]);
  });

  it('executes the provider-state isolation contract used by the validator', async () => {
    await expect(verifyCursorWakeProbeIsolationContract()).resolves.toEqual({
      schemaVersion: 1,
      succeeded: true,
      declaredRootCount: 2,
      ownershipProvenCount: 2,
      removedCount: 2,
      preExistingPreserved: true,
      ownedArtifactsAbsent: true,
    });
  });

  it('exposes the same complete recipe through the structural CLI', async () => {
    const script = new URL(
      '../../scripts/probe-cursor-wake-surfaces.mjs',
      import.meta.url,
    );
    const { stdout } = await execFile(process.execPath, [
      script.pathname,
      '--describe',
      '--json',
    ]);
    const description = JSON.parse(stdout);

    expect(description.modes).toHaveLength(2);
    expect(description.modes[0].bounds.processCapMs).toBe(90_000);
    expect(description.modes[1].bounds.processCapMs).toBe(120_000);
    expect(scanCursorEvidenceText('probe-description.json', stdout)).toEqual(
      [],
    );
  });
});
