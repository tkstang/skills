import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  closeCollaboration,
  joinCollaboration,
  leaveCollaboration,
  openCollaboration,
  resolveMember,
  takeOverMembership,
} from './membership.js';

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
});
