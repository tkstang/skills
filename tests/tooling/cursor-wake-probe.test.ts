import { execFile as execFileCallback } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
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
} = wakeProbe;
const { scanCursorEvidenceText } = cursorEvidence;
const execFile = promisify(execFileCallback);
const temporaryRoots: string[] = [];

const FAKE_PROVIDER = `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const arguments_ = process.argv.slice(2);
if (arguments_.includes('--version')) {
  process.stdout.write('test-version\\n');
  process.exit(0);
}
if (process.env.CURSOR_WAKE_FAKE_HANG === '1') {
  setInterval(() => {}, 1000);
} else {
  const workspaceIndex = arguments_.indexOf('--workspace');
  const workspace = arguments_[workspaceIndex + 1];
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
      temporaryWorkspaceOnly: true,
      existingProviderTranscripts: 'not-read-or-mutated',
      credentialsRequested: false,
      daemonStarted: false,
      schedulerStarted: false,
      externalServiceStarted: false,
      cleanup: 'remove-exact-created-workspace',
    });
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
      const result = await runCursorWakeProbe(mode, {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
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
          temporaryWorkspaceOnly: true,
          existingProviderTranscripts: 'not-read-or-mutated',
          credentialsRequested: false,
          daemonStarted: false,
          schedulerStarted: false,
          externalServiceStarted: false,
        },
        cleanup: {
          attempted: true,
          succeeded: true,
          workspaceExistsAfter: false,
        },
      });
      expect(result.rows.map(({ id }: { id: string }) => id)).toEqual([
        'provider-version',
        'bounded-provider-process',
        'lifecycle-hooks',
        'fixed-markers',
        'surface-outcome',
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
    const result = await runCursorWakeProbe(
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      {
        providerCommand: process.execPath,
        providerArgumentPrefix: [provider],
        temporaryParent: root,
        processCapMs: 50,
        env: { ...process.env, CURSOR_WAKE_FAKE_HANG: '1' },
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
    });
    expect(
      (await readdir(root)).filter((entry) =>
        entry.startsWith('cursor-wake-probe-'),
      ),
    ).toEqual([]);
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
