import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { runAgentMessagingCli } from './agent-messaging.js';

async function run(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runAgentMessagingCli(argv, {
    env,
    cwd: '/tmp/worktree',
    readStdin: async () => '',
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  });
  return { code, stdout: stdout.join(''), stderr: stderr.join('') };
}

describe('agent messaging CLI', () => {
  test('opens, joins, sends, reads, and acknowledges with JSON envelopes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    const opened = await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'test',
      '--json',
    ]);
    expect(opened.code).toBe(0);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'claude-code:reviewer',
      '--alias',
      'reviewer',
      '--json',
    ]);
    const id = crypto.randomUUID();
    expect(
      (
        await run([
          'send',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'codex:driver',
          '--to',
          'reviewer',
          '--id',
          id,
          '--kind',
          'request',
          '--subject',
          'Review',
          '--body',
          'Please review',
          '--json',
        ])
      ).code,
    ).toBe(0);
    const inbox = await run([
      'inbox',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'claude-code:reviewer',
      '--json',
    ]);
    expect(JSON.parse(inbox.stdout).data.messages[0].id).toBe(id);
    expect(
      (
        await run([
          'ack',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'claude-code:reviewer',
          '--message',
          id,
          '--json',
        ])
      ).code,
    ).toBe(0);
  });

  test('rejects explicit self conflicting with a harness signal before mutation', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const result = await run(
      [
        'open',
        '--root',
        root,
        '--self',
        'codex:explicit',
        '--alias',
        'driver',
        '--label',
        'cli',
        '--task',
        'test',
        '--json',
      ],
      { AGENT_MESSAGING_SELF_PIN: 'codex:harness' },
    );
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr).code).toBe('IDENTITY_CONFLICT');
  });

  test('treats shell-looking bodies as inert data', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'test',
    ]);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:peer',
      '--alias',
      'peer',
    ]);
    const body = '$(touch /tmp/agent-messaging-must-not-execute)';
    await run([
      'send',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--to',
      'peer',
      '--id',
      crypto.randomUUID(),
      '--subject',
      'data',
      '--body',
      body,
    ]);
    const inbox = await run([
      'inbox',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:peer',
      '--json',
    ]);
    expect(JSON.parse(inbox.stdout).data.messages[0].body).toBe(body);
  });
});
