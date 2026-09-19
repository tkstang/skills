import { spawnSync } from 'node:child_process';
import { access, cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { distributions } from '../../../distributions.js';

const repoRoot = path.resolve(new URL('../../../..', import.meta.url).pathname);

describe('agent messaging packaging', () => {
  test('declares standalone and session plugin forms with one shared source root', () => {
    const declaration = distributions.find(
      (candidate) => candidate.owner === 'agent-messaging',
    );
    expect(declaration?.allowedSourceRoots).toEqual([
      'src/shared/collaboration',
    ]);
    expect(declaration?.targets).toEqual([
      {
        kind: 'standalone',
        name: 'agent-messaging',
        output: 'skills/agent-messaging',
      },
      {
        kind: 'plugin',
        plugin: 'session',
        name: 'messaging',
        output: 'plugins/session/skills/messaging',
      },
    ]);
  });

  test.each(['skills/agent-messaging', 'plugins/session/skills/messaging'])(
    'copied %s payload executes with Node alone',
    async (relative) => {
      const source = path.join(repoRoot, relative);
      await access(path.join(source, 'scripts', 'agent-messaging.mjs'));
      const destination = await mkdtemp(
        path.join(tmpdir(), 'agent-messaging-installed-'),
      );
      await cp(source, destination, { recursive: true });
      const executable = path.join(
        destination,
        'scripts',
        'agent-messaging.mjs',
      );
      const result = spawnSync(process.execPath, [executable, '--help'], {
        encoding: 'utf8',
        env: { HOME: destination, PATH: process.env.PATH },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('agent-messaging');
      expect(
        await readFile(path.join(destination, 'SKILL.md'), 'utf8'),
      ).toContain("version: '1.0.4'");

      const root = path.join(destination, 'state');
      const collaborationId = crypto.randomUUID();
      const invoke = (args: string[]) => {
        const invoked = spawnSync(process.execPath, [executable, ...args], {
          encoding: 'utf8',
          env: { HOME: destination, PATH: process.env.PATH },
        });
        expect(invoked.status, invoked.stderr).toBe(0);
        return JSON.parse(invoked.stdout);
      };
      invoke([
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
        'copied',
        '--task',
        'three participant exchange',
        '--json',
      ]);
      const reviewer = invoke([
        'join',
        '--root',
        root,
        '--collab',
        collaborationId,
        '--self',
        'cursor:reviewer',
        '--alias',
        'reviewer',
        '--json',
      ]);
      invoke([
        'join',
        '--root',
        root,
        '--collab',
        collaborationId,
        '--self',
        'claude-code:third',
        '--alias',
        'third',
        '--json',
      ]);
      const originalId = crypto.randomUUID();
      invoke([
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
        originalId,
        '--subject',
        'question',
        '--body',
        'review this',
        '--json',
      ]);
      const reviewerId = reviewer.data.member.member.participantId;
      invoke([
        'send',
        '--root',
        root,
        '--collab',
        collaborationId,
        '--self',
        'cursor:reviewer',
        '--to',
        'driver',
        '--id',
        crypto.randomUUID(),
        '--subject',
        'reply',
        '--body',
        'reviewed',
        '--reply-to',
        `${reviewerId}/${originalId}`,
        '--json',
      ]);
      const inbox = invoke([
        'inbox',
        '--root',
        root,
        '--collab',
        collaborationId,
        '--self',
        'codex:driver',
        '--json',
      ]);
      expect(inbox.data.messages[0].replyTo).toEqual({
        participantId: reviewerId,
        messageId: originalId,
      });
    },
  );
});
