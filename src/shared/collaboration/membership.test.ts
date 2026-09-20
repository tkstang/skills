import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  closeCollaboration,
  joinCollaboration,
  leaveCollaboration,
  openCollaboration,
  resolveMember,
  takeOverMembership,
} from './membership.js';
import { collaborationPaths } from './paths.js';

async function fixture() {
  const root = await mkdtemp(
    path.join(tmpdir(), 'agent-messaging-membership-'),
  );
  const collaborationId = crypto.randomUUID();
  const driver = { runtime: 'codex' as const, sessionId: 'driver-session' };
  await openCollaboration({
    root,
    collaborationId,
    label: 'test',
    task: 'coordinate work',
    alias: 'driver',
    pin: driver,
    worktree: process.cwd(),
  });
  return { root, collaborationId, driver };
}

describe('membership lifecycle', () => {
  test('opens and joins three exact cross-repository participants', async () => {
    const f = await fixture();
    await joinCollaboration({
      ...f,
      alias: 'implementer',
      pin: { runtime: 'claude-code', sessionId: 'impl' },
      worktree: '/tmp/repo-b',
    });
    await joinCollaboration({
      ...f,
      alias: 'reviewer',
      pin: { runtime: 'cursor', sessionId: 'review' },
      worktree: '/tmp/repo-c',
    });
    expect(
      (await resolveMember(f.root, f.collaborationId, 'reviewer')).binding.pin,
    ).toEqual({
      runtime: 'cursor',
      sessionId: 'review',
    });
  });

  test.each([
    'members',
    'bindings',
    'departures',
    'inbox',
    'acks',
    'log',
    'entries',
  ])('supports a legal configured root named %s', async (reserved) => {
    const parent = await mkdtemp(path.join(tmpdir(), 'agent-messaging-root-'));
    const root = path.join(parent, reserved);
    const collaborationId = crypto.randomUUID();
    const pin = { runtime: 'codex' as const, sessionId: `driver-${reserved}` };
    await openCollaboration({
      root,
      collaborationId,
      label: 'reserved root',
      task: 'prove root-relative classification',
      alias: 'driver',
      pin,
      worktree: process.cwd(),
    });
    expect(
      (await resolveMember(root, collaborationId, 'driver')).binding.pin,
    ).toEqual(pin);
  });

  test('races duplicate joins and never redirects an alias', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      joinCollaboration({
        ...f,
        alias: 'reviewer',
        pin: { runtime: 'codex', sessionId: 'one' },
        worktree: '/tmp/one',
      }),
      joinCollaboration({
        ...f,
        alias: 'reviewer',
        pin: { runtime: 'codex', sessionId: 'two' },
        worktree: '/tmp/two',
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
  });

  test('requires the exact predecessor and allows only one successor generation', async () => {
    const f = await fixture();
    const previous = { runtime: 'codex' as const, sessionId: 'old' };
    await joinCollaboration({
      ...f,
      alias: 'reviewer',
      pin: previous,
      worktree: '/tmp/old',
    });
    await expect(
      takeOverMembership({
        ...f,
        alias: 'reviewer',
        pin: { runtime: 'codex', sessionId: 'new' },
        expectedPreviousPin: { runtime: 'codex', sessionId: 'wrong' },
        reason: 'human directed replacement',
        worktree: '/tmp/new',
      }),
    ).rejects.toMatchObject({ code: 'STALE_BINDING' });
    const outcomes = await Promise.allSettled([
      takeOverMembership({
        ...f,
        alias: 'reviewer',
        pin: { runtime: 'codex', sessionId: 'new-a' },
        expectedPreviousPin: previous,
        reason: 'human directed replacement',
        worktree: '/tmp/new-a',
      }),
      takeOverMembership({
        ...f,
        alias: 'reviewer',
        pin: { runtime: 'codex', sessionId: 'new-b' },
        expectedPreviousPin: previous,
        reason: 'human directed replacement',
        worktree: '/tmp/new-b',
      }),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (await resolveMember(f.root, f.collaborationId, 'reviewer')).binding
        .generation,
    ).toBe(1);
  });

  test('departure and close are immutable and closure rejects later admission', async () => {
    const f = await fixture();
    await closeCollaboration({ ...f, pin: f.driver });
    const departure = await leaveCollaboration({
      ...f,
      pin: f.driver,
      alias: 'driver',
    });
    expect(departure.created).toBe(true);
    expect(
      (await leaveCollaboration({ ...f, pin: f.driver, alias: 'driver' }))
        .created,
    ).toBe(false);
    await expect(
      joinCollaboration({
        ...f,
        alias: 'late',
        pin: { runtime: 'codex', sessionId: 'late' },
        worktree: '/tmp/late',
      }),
    ).rejects.toMatchObject({ code: 'COLLABORATION_CLOSED' });
    expect(
      (await resolveMember(f.root, f.collaborationId, 'driver')).departed,
    ).toBe(true);
  });

  test('recovers an initial join interrupted after alias publication', async () => {
    const f = await fixture();
    const input = {
      ...f,
      alias: 'reviewer',
      pin: { runtime: 'cursor' as const, sessionId: 'recover' },
      worktree: '/tmp/recover',
    };
    await expect(
      joinCollaboration({
        ...input,
        hooks: { afterAliasPublish: () => Promise.reject(new Error('kill')) },
      }),
    ).rejects.toThrow('kill');
    const recovered = await joinCollaboration(input);
    expect(recovered.member.binding.generation).toBe(0);
    expect(
      (await resolveMember(f.root, f.collaborationId, 'reviewer')).binding.pin,
    ).toEqual(input.pin);
  });

  test('reuses the committed collaboration timestamp on a partial open retry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-open-'));
    const input = {
      root,
      collaborationId: crypto.randomUUID(),
      label: 'partial open',
      task: 'recover the initial join',
      alias: 'driver',
      pin: { runtime: 'codex' as const, sessionId: 'partial-open' },
      worktree: process.cwd(),
    };
    await expect(
      openCollaboration({
        ...input,
        now: '2026-01-01T00:00:00.000Z',
        hooks: { afterAliasPublish: () => Promise.reject(new Error('crash')) },
      }),
    ).rejects.toThrow('crash');
    const recovered = await openCollaboration({
      ...input,
      now: '2026-01-01T00:00:01.000Z',
    });
    expect(recovered.collaboration.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(recovered.member.binding.createdAt).toBe('2026-01-01T00:00:00.000Z');
    await expect(
      openCollaboration({ ...input, label: 'changed label' }),
    ).rejects.toMatchObject({ code: 'RECORD_CONFLICT' });
  });

  test('recovers after actual process termination at every open publication boundary', async () => {
    const helper = fileURLToPath(
      new URL('./process-fixture.ts', import.meta.url),
    );
    for (const stage of [
      'afterCollaborationPublish',
      'afterAliasPublish',
      'afterBindingPublish',
    ] as const) {
      const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-open-'));
      const input = {
        root,
        collaborationId: crypto.randomUUID(),
        label: `open ${stage}`,
        task: 'survive process termination',
        alias: 'driver',
        pin: { runtime: 'codex' as const, sessionId: stage },
        worktree: process.cwd(),
      };
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          helper,
          'open',
          JSON.stringify({ ...input, stage }),
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      await once(child.stdout!, 'data');
      child.kill('SIGKILL');
      const [, signal] = await once(child, 'exit');
      expect(signal).toBe('SIGKILL');
      const collaborationFile = collaborationPaths(
        root,
        input.collaborationId,
      ).collaboration;
      const committed = JSON.parse(await readFile(collaborationFile, 'utf8'));
      await new Promise((resolve) => setTimeout(resolve, 5));
      const recovered = await openCollaboration(input);
      expect(recovered.collaboration.createdAt).toBe(committed.createdAt);
      expect(recovered.member.binding.generation).toBe(0);
      expect(
        (await resolveMember(root, input.collaborationId, 'driver')).binding
          .pin,
      ).toEqual(input.pin);
    }
  }, 30_000);

  test('rejects stale initial-join retries after takeover or departure', async () => {
    const takeover = await fixture();
    const old = { runtime: 'cursor' as const, sessionId: 'old-retry' };
    const original = {
      ...takeover,
      alias: 'reviewer',
      pin: old,
      worktree: '/tmp/old-retry',
    };
    await joinCollaboration(original);
    await takeOverMembership({
      ...takeover,
      alias: 'reviewer',
      pin: { runtime: 'cursor', sessionId: 'successor' },
      expectedPreviousPin: old,
      reason: 'replace old session',
      worktree: '/tmp/successor',
    });
    await expect(joinCollaboration(original)).rejects.toMatchObject({
      code: 'STALE_BINDING',
    });

    const departed = await fixture();
    const departing = { runtime: 'cursor' as const, sessionId: 'departing' };
    const departureInput = {
      ...departed,
      alias: 'reviewer',
      pin: departing,
      worktree: '/tmp/departing',
    };
    await joinCollaboration(departureInput);
    await leaveCollaboration({
      ...departed,
      alias: 'reviewer',
      pin: departing,
    });
    await expect(joinCollaboration(departureInput)).rejects.toMatchObject({
      code: 'STALE_BINDING',
    });
  });

  test('concurrent orphan recovery resolves only generation zero', async () => {
    const f = await fixture();
    const input = {
      ...f,
      alias: 'reviewer',
      pin: { runtime: 'cursor' as const, sessionId: 'orphan' },
      worktree: '/tmp/orphan',
    };
    await expect(
      joinCollaboration({
        ...input,
        hooks: { afterAliasPublish: () => Promise.reject(new Error('stop')) },
      }),
    ).rejects.toThrow('stop');
    const recovered = await Promise.all([
      joinCollaboration(input),
      joinCollaboration(input),
    ]);
    expect(recovered.map((result) => result.member.binding.generation)).toEqual(
      [0, 0],
    );
  });

  test('caps bindings at generation 63 and keeps a competing winner readable', async () => {
    const f = await fixture();
    let current = f.driver;
    for (let generation = 1; generation < 63; generation += 1) {
      const next = {
        runtime: 'codex' as const,
        sessionId: `generation-${generation}`,
      };
      await takeOverMembership({
        ...f,
        alias: 'driver',
        pin: next,
        expectedPreviousPin: current,
        reason: `generation ${generation}`,
        worktree: `/tmp/generation-${generation}`,
      });
      current = next;
    }
    expect(
      (await resolveMember(f.root, f.collaborationId, 'driver')).binding
        .generation,
    ).toBe(62);
    const outcomes = await Promise.allSettled([
      takeOverMembership({
        ...f,
        alias: 'driver',
        pin: { runtime: 'codex', sessionId: 'generation-63-a' },
        expectedPreviousPin: current,
        reason: 'boundary a',
        worktree: '/tmp/generation-63-a',
      }),
      takeOverMembership({
        ...f,
        alias: 'driver',
        pin: { runtime: 'codex', sessionId: 'generation-63-b' },
        expectedPreviousPin: current,
        reason: 'boundary b',
        worktree: '/tmp/generation-63-b',
      }),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const winner = await resolveMember(f.root, f.collaborationId, 'driver');
    expect(winner.binding.generation).toBe(63);
    await expect(
      takeOverMembership({
        ...f,
        alias: 'driver',
        pin: { runtime: 'codex', sessionId: 'generation-64' },
        expectedPreviousPin: winner.binding.pin,
        reason: 'one over',
        worktree: '/tmp/generation-64',
      }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    expect(
      (await resolveMember(f.root, f.collaborationId, 'driver')).binding
        .generation,
    ).toBe(63);
  }, 30_000);

  test('marks close races during join and takeover as closed', async () => {
    const first = await fixture();
    await expect(
      joinCollaboration({
        ...first,
        alias: 'racer',
        pin: { runtime: 'cursor', sessionId: 'racer' },
        worktree: '/tmp/racer',
        hooks: {
          afterAliasPublish: async () => {
            await closeCollaboration({ ...first, pin: first.driver });
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'COLLABORATION_CLOSED' });

    const second = await fixture();
    const old = { runtime: 'cursor' as const, sessionId: 'old' };
    await joinCollaboration({
      ...second,
      alias: 'reviewer',
      pin: old,
      worktree: '/tmp/old',
    });
    await expect(
      takeOverMembership({
        ...second,
        alias: 'reviewer',
        pin: { runtime: 'cursor', sessionId: 'new' },
        expectedPreviousPin: old,
        reason: 'race',
        worktree: '/tmp/new',
        hooks: {
          afterBindingPublish: async () => {
            await closeCollaboration({ ...second, pin: second.driver });
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'COLLABORATION_CLOSED' });
  });

  test('allows the member cap boundary and rejects one over', async () => {
    const f = await fixture();
    for (let index = 1; index < 128; index += 1) {
      await joinCollaboration({
        ...f,
        alias: `member-${index}`,
        pin: { runtime: 'codex', sessionId: `member-${index}` },
        worktree: `/tmp/member-${index}`,
      });
    }
    expect(
      (await resolveMember(f.root, f.collaborationId, 'member-127')).binding
        .generation,
    ).toBe(0);
    await expect(
      joinCollaboration({
        ...f,
        alias: 'overflow',
        pin: { runtime: 'codex', sessionId: 'overflow' },
        worktree: '/tmp/overflow',
      }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  }, 20_000);
});
