import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PROVIDER_CLI_KILL_GRACE_MS,
  runProviderCliCommand,
} from '../../../src/consensus/core/consensus-loop.js';
import { fixtureBin } from '../../helpers/process.mjs';

const stubExecutable = path.join(fixtureBin, 'consensus-provider-stub');
// A shell script, not a Node script: it reaches its `trap '' TERM` line
// (SIG_IGN, which survives exec) far faster than a Node process can finish
// booting, so a short deadline doesn't race the stub's own startup — SIGTERM
// reliably reaches it only after the ignore is already installed.
const fastIgnoreSigtermStub = path.join(fixtureBin, 'ignore-sigterm-fast');

describe('runProviderCliCommand deadline escalation (core)', () => {
  it('escalates a stub that ignores SIGTERM to SIGKILL and reports a timedOut outcome within the deadline+grace window', async () => {
    const startedAt = Date.now();
    const result = await runProviderCliCommand(fastIgnoreSigtermStub, [], {
      timeoutMs: 500,
    });
    const elapsedMs = Date.now() - startedAt;

    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe('SIGKILL');
    expect(elapsedMs).toBeLessThan(500 + PROVIDER_CLI_KILL_GRACE_MS + 1000);
  });

  it('force-settles instead of hanging when a descendant process keeps the stdio pipes open after SIGKILL', async () => {
    // Regression test: this fixture backgrounds a detached descendant that
    // inherits its stdio (the pipes the runner reads from) before it even
    // installs its own SIGTERM trap, so the descendant is holding the pipes
    // open regardless of which signal ends the direct child. 'close' can
    // then never fire on its own — without the finalResolutionMs safety net
    // this hangs forever (reproduced directly: it hung until an external
    // harness timeout).
    const startedAt = Date.now();
    const result = await runProviderCliCommand(
      path.join(fixtureBin, 'descendant-holds-pipes-fast'),
      [],
      { timeoutMs: 200 },
    );
    const elapsedMs = Date.now() - startedAt;

    expect(result.timedOut).toBe(true);
    expect(result.code).toBeNull();
    // The direct child dies from whichever signal reaches it first (SIGTERM
    // if the trap is installed in time, SIGKILL otherwise) — either is a
    // correct outcome here. What this test proves is that the descendant
    // holding the pipes open does not stall resolution.
    expect(result.signal).not.toBeNull();
    // 200ms deadline + 250ms kill grace + 1000ms final-resolution safety net,
    // with headroom for scheduling.
    expect(elapsedMs).toBeLessThan(200 + PROVIDER_CLI_KILL_GRACE_MS + 2000);
  });

  it('force-settles with the cap error when an output-cap SIGKILL leaves a descendant holding the pipes open and no timeoutMs is set', async () => {
    // Regression (final gate F1): an output-cap breach SIGKILLs the direct
    // child, but a detached descendant that inherited the stdio pipes keeps
    // 'close' from ever firing. The final-resolution safety net used to live
    // only inside the optional-timeout branch, so with NO timeoutMs the cap
    // rejection could hang forever (reproduced directly: it hung until an
    // external harness timeout). The cap kill now schedules forced settlement
    // independently of timeoutMs, and the cap error must still win.
    const startedAt = Date.now();
    await expect(
      // Intentionally NO timeoutMs — this is the branch the old code missed.
      runProviderCliCommand(
        path.join(fixtureBin, 'cap-descendant-holds-pipes'),
        [],
      ),
    ).rejects.toMatchObject({ code: 'SUBPROCESS_OUTPUT_CAP' });
    const elapsedMs = Date.now() - startedAt;
    // Bounded purely by the final-resolution safety net (1000ms) plus headroom
    // for emitting/reading 11 MiB and scheduling — must not hang on the 10s
    // descendant sleep.
    expect(elapsedMs).toBeLessThan(1000 + 5000);
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
