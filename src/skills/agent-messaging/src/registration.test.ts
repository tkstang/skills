import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  assessAutomaticOwnership,
  inspectClaudeStopInventory,
  inspectCodexStopInventory,
  installCodexMessagingHooks,
  resolveClaudeInventoryInput,
  uninstallCodexMessagingHooks,
} from './registration.js';

describe('messaging hook registration', () => {
  test('installs and removes only the exact Codex commands', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const hooksPath = path.join(home, 'hooks.json');
    const scriptPath = path.join(home, 'messaging hook.mjs');
    await writeFile(scriptPath, '');
    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node third-party.mjs',
                  timeout: 5,
                },
              ],
            },
          ],
        },
      }),
    );
    const installed = await installCodexMessagingHooks({
      hooksPath,
      scriptPath,
    });
    expect(installed.changed).toBe(true);
    expect(
      await installCodexMessagingHooks({ hooksPath, scriptPath }),
    ).toMatchObject({ changed: false });
    const config = JSON.parse(await readFile(hooksPath, 'utf8'));
    expect(JSON.stringify(config)).toContain('node third-party.mjs');
    expect(JSON.stringify(config)).toContain('messaging hook.mjs');
    expect(
      (await uninstallCodexMessagingHooks({ hooksPath, scriptPath })).changed,
    ).toBe(true);
    expect(await readFile(hooksPath, 'utf8')).toContain('node third-party.mjs');
  });

  test('recognizes only a marked owned messaging launcher', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const hooksPath = path.join(root, 'hooks.json');
    const scriptPath = path.join(root, 'messaging.mjs');
    await writeFile(
      scriptPath,
      '#!/usr/bin/env node\n// GENERATED skill payload for agent-messaging.\n// src/skills/agent-messaging/src/hooks/codex.ts\nvar marker = "agent-messaging-host-hook-v1";\n',
    );
    await installCodexMessagingHooks({ hooksPath, scriptPath });
    const inventory = await inspectCodexStopInventory(hooksPath);
    expect(inventory.registrations).toHaveLength(1);
    expect(inventory.registrations[0]).toMatchObject({
      recognizedMessaging: true,
      recognizedObserver: false,
    });
    expect(
      await assessAutomaticOwnership({
        root,
        pin: { runtime: 'codex', sessionId: 'session' },
        worktree: '/tmp/worktree',
        inventory,
      }),
    ).toMatchObject({ automaticAllowed: true });
    await writeFile(scriptPath, '#!/usr/bin/env node\n// drifted\n');
    expect(
      (await inspectCodexStopInventory(hooksPath)).registrations[0]
        ?.recognizedMessaging,
    ).toBe(false);
  });

  test('recognizes the built standalone hook without importing source modules', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const hooksPath = path.join(root, 'hooks.json');
    const scriptPath = path.resolve(
      'skills/agent-messaging/scripts/hooks/codex.mjs',
    );
    await installCodexMessagingHooks({ hooksPath, scriptPath });
    expect(
      (await inspectCodexStopInventory(hooksPath)).registrations[0],
    ).toMatchObject({ recognizedMessaging: true });
  });

  test('requires the exact fingerprint for unrelated Stop hooks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const hooksPath = path.join(root, 'hooks.json');
    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ command: 'node unknown.mjs' }] }] },
      }),
    );
    const inventory = await inspectCodexStopInventory(hooksPath);
    const base = {
      root,
      pin: { runtime: 'codex' as const, sessionId: 'session' },
      worktree: '/tmp/worktree',
      inventory,
    };
    expect(await assessAutomaticOwnership(base)).toMatchObject({
      automaticAllowed: false,
      thirdPartyAcknowledgmentRequired: true,
    });
    expect(
      await assessAutomaticOwnership({
        ...base,
        acknowledgedFingerprint: inventory.fingerprint,
      }),
    ).toMatchObject({
      automaticAllowed: true,
      acknowledgedFingerprint: inventory.fingerprint,
    });
    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ command: 'node changed.mjs' }] }] },
      }),
    );
    const changed = await inspectCodexStopInventory(hooksPath);
    expect(changed.fingerprint).not.toBe(inventory.fingerprint);
  });

  test('fingerprints same-command matcher, timeout, type, group, order, and source changes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const hooksPath = path.join(root, 'hooks.json');
    const write = async (group: Record<string, unknown>) => {
      await writeFile(hooksPath, JSON.stringify({ hooks: { Stop: [group] } }));
      return (await inspectCodexStopInventory(hooksPath)).fingerprint;
    };
    const base = await write({
      matcher: 'all',
      scope: 'session',
      hooks: [{ type: 'command', command: 'node same.mjs', timeout: 5 }],
    });
    for (const mutation of [
      {
        matcher: 'final',
        scope: 'session',
        hooks: [{ type: 'command', command: 'node same.mjs', timeout: 5 }],
      },
      {
        matcher: 'all',
        scope: 'project',
        hooks: [{ type: 'command', command: 'node same.mjs', timeout: 5 }],
      },
      {
        matcher: 'all',
        scope: 'session',
        hooks: [{ type: 'command', command: 'node same.mjs', timeout: 10 }],
      },
      {
        matcher: 'all',
        scope: 'session',
        hooks: [{ type: 'prompt', command: 'node same.mjs', timeout: 5 }],
      },
      {
        matcher: 'all',
        scope: 'session',
        hooks: [
          { command: 'node preceding.mjs' },
          { type: 'command', command: 'node same.mjs', timeout: 5 },
        ],
      },
    ]) {
      expect(await write(mutation)).not.toBe(base);
    }
    const pluginA = path.join(root, 'plugins', 'a');
    const pluginB = path.join(root, 'plugins', 'b');
    for (const plugin of [pluginA, pluginB]) {
      await mkdir(path.join(plugin, 'hooks'), { recursive: true });
      await writeFile(
        path.join(plugin, 'hooks', 'hooks.json'),
        JSON.stringify({
          hooks: { Stop: [{ hooks: [{ command: 'node same.mjs' }] }] },
        }),
      );
    }
    await writeFile(
      hooksPath,
      JSON.stringify({ enabledPlugins: { reviewer: true } }),
    );
    const fromA = await inspectClaudeStopInventory({
      settingsPaths: [hooksPath],
      installedPlugins: { reviewer: pluginA },
    });
    const fromB = await inspectClaudeStopInventory({
      settingsPaths: [hooksPath],
      installedPlugins: { reviewer: pluginB },
    });
    expect(fromB.fingerprint).not.toBe(fromA.fingerprint);
  });

  test('bounds Claude inventory to loaded settings and enabled installed plugins', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const settings = path.join(root, 'settings.json');
    const plugin = path.join(root, 'installed', 'reviewer');
    await mkdir(path.join(plugin, 'hooks'), { recursive: true });
    await writeFile(
      settings,
      JSON.stringify({
        enabledPlugins: { reviewer: true, disabled: false },
        hooks: { Stop: [{ hooks: [{ command: 'node settings.mjs' }] }] },
      }),
    );
    await writeFile(
      path.join(plugin, 'hooks', 'hooks.json'),
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ command: 'node plugin.mjs' }] }] },
      }),
    );
    const inventory = await inspectClaudeStopInventory({
      settingsPaths: [settings],
      installedPlugins: {
        reviewer: plugin,
        catalogOnly: path.join(root, 'catalog'),
      },
    });
    expect(
      inventory.registrations.map((entry) => entry.command).toSorted(),
    ).toEqual(['node plugin.mjs', 'node settings.mjs']);
    expect(inventory.unresolvedPlugins).toEqual([]);
    expect(inventory.visibilityLimits[0]).toContain('frontmatter');
  });

  test('fails closed for unreadable configured settings and unresolved enabled plugins', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'registration-'));
    const settings = path.join(root, 'settings.json');
    await writeFile(
      settings,
      JSON.stringify({ enabledPlugins: { missing: true } }),
    );
    const unreadable = path.join(root, 'not-a-file');
    await mkdir(unreadable);
    const inventory = await inspectClaudeStopInventory({
      settingsPaths: [settings, unreadable],
    });
    expect(inventory.unreadableSources).toEqual([unreadable]);
    expect(inventory.unresolvedPlugins).toEqual(['missing']);
  });

  test('resolves standard Claude settings and refuses when every source is absent', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'claude-defaults-'));
    const home = path.join(root, 'home');
    const cwd = path.join(root, 'project');
    await mkdir(path.join(home, '.claude'), { recursive: true });
    await mkdir(cwd);
    const userSettings = path.join(home, '.claude', 'settings.json');
    await writeFile(
      userSettings,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ command: 'node third-party.mjs' }] }] },
      }),
    );
    const defaults = resolveClaudeInventoryInput({ cwd, env: { HOME: home } });
    const inventory = await inspectClaudeStopInventory(defaults);
    expect(inventory.resolvedSources).toEqual([userSettings]);
    expect(inventory.registrations[0]?.command).toBe('node third-party.mjs');
    expect(inventory.sourceSet).toEqual(defaults);

    const absentRoot = await mkdtemp(path.join(tmpdir(), 'claude-absent-'));
    const absent = await inspectClaudeStopInventory(
      resolveClaudeInventoryInput({
        cwd: absentRoot,
        env: { HOME: path.join(absentRoot, 'home') },
      }),
    );
    expect(
      await assessAutomaticOwnership({
        root: absentRoot,
        pin: { runtime: 'claude-code', sessionId: 'session' },
        worktree: absentRoot,
        inventory: absent,
      }),
    ).toMatchObject({ automaticAllowed: false });
  });

  test('preserves explicit Claude inventory overrides as the resolved source set', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'claude-explicit-'));
    const settings = path.join(root, 'settings.json');
    await writeFile(settings, '{}\n');
    const resolved = resolveClaudeInventoryInput({
      cwd: root,
      env: {},
      settingsPaths: [settings],
      installedPlugins: {},
    });
    expect((await inspectClaudeStopInventory(resolved)).sourceSet).toEqual({
      settingsPaths: [settings],
      installedPlugins: {},
    });
  });
});
