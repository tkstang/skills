#!/usr/bin/env node
// agent-messaging-host-hook-v1

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleBoundary, type HookDependencies } from './common.js';

interface ClaudeEvent {
  hook_event_name?: unknown;
  session_id?: unknown;
  cwd?: unknown;
  event_id?: unknown;
  prompt_id?: unknown;
  is_human?: unknown;
  stop_hook_active?: unknown;
}

export async function runClaudeCodeHook(
  event: ClaudeEvent,
  dependencies: HookDependencies = {},
): Promise<object | null> {
  const boundary =
    event.hook_event_name === 'UserPromptSubmit'
      ? 'prompt-start'
      : event.hook_event_name === 'Stop'
        ? 'stop'
        : null;
  if (
    !boundary ||
    typeof event.session_id !== 'string' ||
    typeof event.cwd !== 'string' ||
    !path.isAbsolute(event.cwd)
  ) {
    return null;
  }
  const eventId =
    typeof event.event_id === 'string'
      ? event.event_id
      : typeof event.prompt_id === 'string'
        ? event.prompt_id
        : null;
  return (
    await handleBoundary(
      {
        runtime: 'claude-code',
        sessionId: event.session_id,
        cwd: event.cwd,
        boundary,
        eventId,
        provenHuman:
          boundary === 'prompt-start' &&
          event.is_human === true &&
          eventId !== null,
        continuationActive: event.stop_hook_active === true,
      },
      dependencies,
    )
  ).output;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new Error('HOOK_INPUT_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function runClaudeCodeHookMain(): Promise<void> {
  try {
    const output = await runClaudeCodeHook(
      JSON.parse(await readStdin()) as ClaudeEvent,
      { diagnostic: (message) => process.stderr.write(`${message}\n`) },
    );
    if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.name : 'HOOK_ERROR'}\n`,
    );
  }
}

if (
  process.argv[1] &&
  realpathSync(path.resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url))
) {
  runClaudeCodeHookMain().catch(() => undefined);
}
