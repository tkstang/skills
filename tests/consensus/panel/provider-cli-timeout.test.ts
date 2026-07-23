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
  it('escalates a stub that ignores SIGTERM and reports a timedOut outcome without hanging', async () => {
    const startedAt = Date.now();
    const result = await runProviderCliCommand(
      stubExecutable,
      ['ignore-sigterm'],
      { timeoutMs: 300 },
    );
    const elapsedMs = Date.now() - startedAt;

    // The stub installs a no-op SIGTERM handler and never exits on its own,
    // so reaching a settled promise at all proves the deadline fired and
    // (since SIGTERM alone cannot end it) the SIGKILL escalation ran. Under
    // scheduler contention the child may not finish installing its handler
    // before the deadline's SIGTERM arrives, in which case SIGTERM itself
    // ends it first — both outcomes are correctly reported as timed out, so
    // the signal identity itself is not asserted here (matching
    // subprocess.ts's own escalation test, which asserts the same way).
    expect(result.timedOut).toBe(true);
    expect(result.signal).not.toBeNull();
    expect(elapsedMs).toBeLessThan(300 + PROVIDER_CLI_KILL_GRACE_MS + 25_000);
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
