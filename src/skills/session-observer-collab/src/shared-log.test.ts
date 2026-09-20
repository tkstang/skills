import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = path.resolve(
  fileURLToPath(new URL('../../../..', import.meta.url)),
);
const roots: string[] = [];

function invoke(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: string,
) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    encoding: 'utf8',
    env,
    input,
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout);
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe.each([
  'skills/session-observer-collab',
  'plugins/consensus/skills/observer-collab',
])('shared collaboration log from %s', (observerRelative) => {
  test('shares immutable entries with messaging while preserving observer offsets', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'observer-shared-log-'));
    roots.push(home);
    const stateRoot = path.join(home, 'state');
    const worktree = path.join(home, 'worktree');
    const offset = path.join(home, 'observer-offset.json');
    const offsetBytes = '{"nextRecordIndex":17}\n';
    await mkdir(worktree);
    await writeFile(offset, offsetBytes);

    const observer = path.join(
      repoRoot,
      observerRelative,
      'scripts',
      'collab-control.mjs',
    );
    const messaging = path.join(
      repoRoot,
      'skills/agent-messaging/scripts/agent-messaging.mjs',
    );
    const env = {
      HOME: home,
      PATH: process.env.PATH,
      SESSION_OBSERVER_STATE_DIR: stateRoot,
    };
    const collaborationId = crypto.randomUUID();

    const opened = invoke(
      observer,
      [
        'collaboration-open',
        '--collab',
        collaborationId,
        '--self',
        'codex:observer-a',
        '--alias',
        'observer-a',
        '--label',
        'shared-log',
        '--task',
        'prove shared storage',
        '--cwd',
        worktree,
        '--json',
      ],
      env,
    );
    expect(opened).toMatchObject({
      delivery: 'disabled',
      collaborationId,
      root: stateRoot,
    });
    expect(opened.paths.logEntries).toBe(
      path.join(stateRoot, 'collaborations', collaborationId, 'log', 'entries'),
    );
    expect(opened.paths.renderedLog).toBe(
      path.join(
        stateRoot,
        'collaborations',
        collaborationId,
        'collaboration.md',
      ),
    );

    invoke(
      observer,
      [
        'collaboration-join',
        '--collab',
        collaborationId,
        '--self',
        'cursor:observer-b',
        '--alias',
        'observer-b',
        '--cwd',
        worktree,
        '--json',
      ],
      env,
    );
    invoke(
      messaging,
      [
        'join',
        '--root',
        stateRoot,
        '--collab',
        collaborationId,
        '--self',
        'claude-code:messenger-c',
        '--alias',
        'messenger-c',
        '--cwd',
        worktree,
        '--json',
      ],
      env,
    );

    const observerEntry = crypto.randomUUID();
    invoke(
      observer,
      [
        'log-append',
        '--collab',
        collaborationId,
        '--self',
        'codex:observer-a',
        '--id',
        observerEntry,
        '--category',
        'protocol',
        '--title',
        'Observer entry',
        '--assessment',
        'works-well',
        '--what-stdin',
        '--implication',
        'Use immutable entries',
        '--json',
      ],
      env,
      'Observer wrote this entry.',
    );
    const messagingEntry = crypto.randomUUID();
    invoke(
      messaging,
      [
        'log',
        'append',
        '--root',
        stateRoot,
        '--collab',
        collaborationId,
        '--self',
        'claude-code:messenger-c',
        '--id',
        messagingEntry,
        '--category',
        'content',
        '--title',
        'Messaging entry',
        '--assessment',
        'works-well',
        '--what',
        'Messaging wrote this entry.',
        '--implication',
        'One authoritative log',
        '--json',
      ],
      env,
    );

    const rendered = invoke(
      observer,
      ['log-render', '--collab', collaborationId, '--json'],
      env,
    );
    expect(rendered.data.markdown).toContain('## Observer entry');
    expect(rendered.data.markdown).toContain('## Messaging entry');
    expect(rendered.data.staleAfterRender).toBe(false);
    expect(await readFile(offset, 'utf8')).toBe(offsetBytes);

    const status = invoke(
      messaging,
      [
        'status',
        '--root',
        stateRoot,
        '--collab',
        collaborationId,
        '--self',
        'codex:observer-a',
        '--json',
      ],
      env,
    );
    expect(status.data.delivery.active).toBe(false);
    expect(status.data.inbox.messages).toEqual([]);
    expect(await readFile(offset, 'utf8')).toBe(offsetBytes);
  });
});
