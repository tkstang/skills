import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  readConfig,
  stopCommands,
} from '../../../shared/collaboration/ownership.js';

export * from '../../../shared/collaboration/ownership.js';

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function codexMessagingCommand(scriptPath: string): string {
  if (!path.isAbsolute(scriptPath))
    throw new TypeError('messaging hook script path must be absolute');
  return `node -- ${shellQuote(path.resolve(scriptPath))}`;
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, file);
}

export async function installCodexMessagingHooks(input: {
  hooksPath: string;
  scriptPath: string;
}): Promise<{ changed: boolean; exactCommand: string }> {
  if (!path.isAbsolute(input.hooksPath))
    throw new TypeError('Codex hooks path must be absolute');
  const config = ((await readConfig(input.hooksPath)) ?? {}) as Record<
    string,
    unknown
  >;
  const hooks =
    config.hooks &&
    typeof config.hooks === 'object' &&
    !Array.isArray(config.hooks)
      ? (structuredClone(config.hooks) as Record<string, unknown>)
      : {};
  const command = codexMessagingCommand(input.scriptPath);
  let changed = false;
  for (const event of ['UserPromptSubmit', 'Stop']) {
    const groups = Array.isArray(hooks[event])
      ? structuredClone(hooks[event])
      : [];
    const exists = stopCommands({ hooks: { Stop: groups } }).includes(command);
    if (!exists) {
      groups.push({ hooks: [{ type: 'command', command, timeout: 65 }] });
      hooks[event] = groups;
      changed = true;
    }
  }
  if (changed) await writeJsonAtomic(input.hooksPath, { ...config, hooks });
  return { changed, exactCommand: command };
}

export async function uninstallCodexMessagingHooks(input: {
  hooksPath: string;
  scriptPath: string;
}): Promise<{ changed: boolean }> {
  if (!path.isAbsolute(input.hooksPath))
    throw new TypeError('Codex hooks path must be absolute');
  const config = await readConfig(input.hooksPath);
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return { changed: false };
  const next = structuredClone(config) as Record<string, unknown>;
  if (
    !next.hooks ||
    typeof next.hooks !== 'object' ||
    Array.isArray(next.hooks)
  ) {
    return { changed: false };
  }
  const hooks = next.hooks as Record<string, unknown>;
  const command = codexMessagingCommand(input.scriptPath);
  let changed = false;
  const removeGroup = Symbol('remove-group');
  for (const event of ['UserPromptSubmit', 'Stop']) {
    if (!Array.isArray(hooks[event])) continue;
    let eventChanged = false;
    const groups = hooks[event] as unknown[];
    const filteredGroups = groups
      .map((group) => {
        if (!group || typeof group !== 'object' || Array.isArray(group))
          return group;
        const entries = (group as { hooks?: unknown }).hooks;
        if (!Array.isArray(entries)) return group;
        const filtered = entries.filter(
          (entry) =>
            !entry ||
            typeof entry !== 'object' ||
            Array.isArray(entry) ||
            (entry as { command?: unknown }).command !== command,
        );
        if (filtered.length === entries.length) return group;
        eventChanged = true;
        changed = true;
        if (filtered.length === 0) return removeGroup;
        return { ...group, hooks: filtered };
      })
      .filter((group) => group !== removeGroup);
    if (eventChanged) hooks[event] = filteredGroups;
  }
  if (changed) await writeJsonAtomic(input.hooksPath, next);
  return { changed };
}

export function claudeSessionHookDeclaration(scriptPath: string): object {
  const command = codexMessagingCommand(scriptPath);
  return {
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command, timeout: 65 }] },
      ],
      Stop: [{ hooks: [{ type: 'command', command, timeout: 65 }] }],
    },
  };
}
