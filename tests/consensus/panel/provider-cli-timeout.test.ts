import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runProviderCliCommand } from '../../../src/consensus/panel/consensus-panel.js';
import { fixtureBin } from '../../helpers/process.mjs';

const stubExecutable = path.join(fixtureBin, 'consensus-provider-stub');

// Grace window mirrors PROVIDER_CLI_KILL_GRACE_MS in consensus-panel.ts
// (kept in sync with consensus-loop.ts's exported constant of the same
// value; not itself exported from this file's twin copy).
const PROVIDER_CLI_KILL_GRACE_MS = 250;

describe('runProviderCliCommand deadline escalation (panel)', () => {
  it('SIGKILLs a stub that ignores SIGTERM and reports a timedOut outcome within the deadline+grace window', async () => {
    const startedAt = Date.now();
    const result = await runProviderCliCommand(
      stubExecutable,
      ['ignore-sigterm'],
      { timeoutMs: 500 },
    );
    const elapsedMs = Date.now() - startedAt;

    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe('SIGKILL');
    expect(elapsedMs).toBeLessThan(500 + PROVIDER_CLI_KILL_GRACE_MS + 2000);
  });

  it('leaves a well-behaved stub unaffected by a timeout that never fires, with no dangling timers', async () => {
    const result = await runProviderCliCommand(stubExecutable, ['echo-stdin'], {
      input: 'hello',
      timeoutMs: 5000,
    });

    expect(result.timedOut).toBeUndefined();
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('hello');
  });

  it('behaves identically to today when no timeoutMs is supplied', async () => {
    const result = await runProviderCliCommand(stubExecutable, ['echo-stdin'], {
      input: 'hello',
    });

    expect(result.timedOut).toBeUndefined();
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('hello');
  });

  it('rejects cleanly on spawn failure with input queued, emitting no unhandled stdin error', async () => {
    const missingExecutable = path.join(fixtureBin, 'does-not-exist-binary');

    await expect(
      runProviderCliCommand(missingExecutable, ['run'], {
        input: 'payload that would be written to a dead pipe',
      }),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
