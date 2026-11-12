import { spawn } from 'node:child_process';
import {
  appendFile,
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixtureBin, repoRoot } from '../../../../tests/helpers/process.mjs';
import type { ProviderInvocation } from '../provider-cli/invocation.js';
import {
  readBoundedRegularFile,
  runProviderSubprocess,
} from '../provider-cli/subprocess.js';

const stubExecutable = path.join(fixtureBin, 'consensus-provider-stub');

describe('bounded provider subprocess runner', () => {
  it('delivers prompts through stdin', async () => {
    const result = await runProviderSubprocess(invocation(['echo-stdin']), {
      maxOutputBytes: 1024,
      timeoutSec: 5,
    });

    expect(result).toMatchObject({
      ok: true,
      stdout: 'Prompt from stdin.',
      stderr: '',
    });
  });

  it('captures stdout and stderr', async () => {
    const result = await runProviderSubprocess(invocation(['stdout-stderr']), {
      maxOutputBytes: 1024,
      timeoutSec: 5,
    });

    expect(result).toMatchObject({
      ok: true,
      stdout: 'stdout text',
      stderr: 'stderr text',
      exit_code: 0,
    });
  });

  it('maps nonzero exits to PROVIDER_EXIT', async () => {
    const result = await runProviderSubprocess(invocation(['exit-code']), {
      maxOutputBytes: 1024,
      timeoutSec: 5,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      retryable: true,
      stderr: 'provider failed',
      diagnostics: {
        provider_exit_code: 7,
        provider_signal: null,
      },
    });
  });

  it('surfaces plain signal-terminated subprocesses as provider exits', async () => {
    const result = await runProviderSubprocess(
      {
        executable: process.execPath,
        argv: ['-e', 'process.kill(process.pid, "SIGTERM")'],
        stdin: '',
        cwd: repoRoot,
        output_mode: 'stdout_json',
        strategy: 'prompt_only',
        redacted_command: ['node', '-e', '<script>'],
        shell: false,
      },
      {
        maxOutputBytes: 1024,
        timeoutSec: 5,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      retryable: true,
      exit_code: null,
      signal: 'SIGTERM',
      diagnostics: {
        provider_exit_code: null,
        provider_signal: 'SIGTERM',
      },
    });
  });

  it('kills timed-out subprocesses as PROVIDER_TIMEOUT', async () => {
    const result = await runProviderSubprocess(invocation(['sleep', '1000']), {
      maxOutputBytes: 1024,
      timeoutSec: 0.01,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_TIMEOUT',
      retryable: false,
      diagnostics: {
        timeout_sec: 0.01,
      },
    });
  });

  it('escalates timed-out subprocesses that ignore SIGTERM', async () => {
    const startedAt = Date.now();
    const result = await runProviderSubprocess(invocation(['ignore-sigterm']), {
      maxOutputBytes: 1024,
      timeoutSec: 0.01,
      terminationGraceMs: 25,
      finalResolutionMs: 25,
    });

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_TIMEOUT',
      retryable: false,
      diagnostics: {
        timeout_sec: 0.01,
      },
    });
  });

  it('enforces stdout and stderr output caps', async () => {
    const result = await runProviderSubprocess(
      invocation(['big-output', '64']),
      {
        maxOutputBytes: 16,
        timeoutSec: 5,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
      retryable: false,
      diagnostics: {
        output_bytes: {
          max: 16,
        },
      },
    });
    expect(
      Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr),
    ).toBeLessThanOrEqual(16);
    expect(result.diagnostics.output_bytes?.stdout ?? 0).toBeLessThanOrEqual(
      16,
    );
    expect(result.diagnostics.output_bytes?.stderr ?? 0).toBeLessThanOrEqual(
      16,
    );
    expect(
      (result.diagnostics.output_bytes?.stdout ?? 0) +
        (result.diagnostics.output_bytes?.stderr ?? 0),
    ).toBeLessThanOrEqual(16);
  });

  it('reads and cleans last-message-file provider output', async () => {
    const dir = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-last-message-'),
    );
    const outputPath = path.join(dir, 'last-message.json');

    try {
      const result = await runProviderSubprocess(
        {
          ...invocation(['last-message', outputPath]),
          output_mode: 'last_message_file',
          last_message_file: outputPath,
        },
        {
          maxOutputBytes: 1024,
          timeoutSec: 5,
        },
      );

      expect(result).toMatchObject({
        ok: true,
        stdout: '{"type":"session.started"}\n{"type":"turn.completed"}\n',
        last_message: '{"verdict":"accept"}\n',
      });
      await expect(readFile(outputPath, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('bounds last-message reads and preserves caller-owned captures', async () => {
    const dir = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-last-message-bounded-'),
    );
    const outputPath = path.join(dir, 'last-message.json');

    try {
      const oversized = await runProviderSubprocess(
        {
          ...invocation(['last-message-sized', outputPath, '64']),
          output_mode: 'last_message_file',
          last_message_file: outputPath,
          cleanup_last_message_file: false,
        },
        {
          maxOutputBytes: 16,
          timeoutSec: 5,
        },
      );
      expect(oversized).toMatchObject({
        ok: false,
        code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
      });
      expect(Buffer.byteLength(await readFile(outputPath, 'utf8'))).toBe(64);

      const retained = await runProviderSubprocess(
        {
          ...invocation(['last-message', outputPath]),
          output_mode: 'last_message_file',
          last_message_file: outputPath,
          cleanup_last_message_file: false,
        },
        {
          maxOutputBytes: 1024,
          timeoutSec: 5,
        },
      );
      expect(retained).toMatchObject({
        ok: true,
        last_message: '{"verdict":"accept"}\n',
      });
      await expect(readFile(outputPath, 'utf8')).resolves.toContain('accept');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects a capture that grows beyond its bound after the initial stat', async () => {
    const dir = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-growing-capture-'),
    );
    const outputPath = path.join(dir, 'capture.json');

    try {
      await writeFile(outputPath, '12345678');
      await expect(
        readBoundedRegularFile(outputPath, 16, {
          afterStat: async () => appendFile(outputPath, 'x'.repeat(32)),
        }),
      ).resolves.toMatchObject({ ok: false, reason: 'too_large' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps captured output bounded when cap-terminated subprocesses ignore SIGTERM', async () => {
    const startedAt = Date.now();
    const result = await runProviderSubprocess(
      invocation(['ignore-sigterm-output', '1024']),
      {
        maxOutputBytes: 16,
        timeoutSec: 5,
        terminationGraceMs: 25,
        finalResolutionMs: 25,
      },
    );

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
      retryable: false,
      diagnostics: {
        output_bytes: {
          max: 16,
        },
      },
    });
    expect(
      Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr),
    ).toBeLessThanOrEqual(16);
    expect(result.diagnostics.output_bytes?.stdout ?? 0).toBeLessThanOrEqual(
      16,
    );
    expect(result.diagnostics.output_bytes?.stderr ?? 0).toBeLessThanOrEqual(
      16,
    );
    expect(
      (result.diagnostics.output_bytes?.stdout ?? 0) +
        (result.diagnostics.output_bytes?.stderr ?? 0),
    ).toBeLessThanOrEqual(16);
  });

  describe.skipIf(process.platform === 'win32')('process group', () => {
    // The parent must be a separate process that a signal can kill, so this
    // runs the generated CLI against a provider program whose grandchild, in
    // the provider's group, ignores SIGINT and SIGTERM. Only the escalation to
    // SIGKILL stops it, and the CLI must not exit before that.
    it.each(['SIGINT', 'SIGTERM'] as const)(
      'stops the provider group before the consensus CLI exits on %s',
      async (signal) => {
        const dir = await mkdtemp(
          path.join(os.tmpdir(), 'consensus-interrupt-'),
        );
        const pidFile = path.join(dir, 'pids');
        const provider = path.join(dir, 'provider');
        const grandchildSource = [
          "process.on('SIGINT', () => {});",
          "process.on('SIGTERM', () => {});",
          `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, process.argv[1] + ':' + process.pid);`,
          'setInterval(() => {}, 1000);',
        ].join(' ');
        await writeFile(
          provider,
          `#!${process.execPath}
const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}, String(process.pid)], { stdio: 'ignore' });
setInterval(() => {}, 1000);
`,
        );
        await chmod(provider, 0o755);
        const pids: number[] = [];
        try {
          const parent = spawn(
            process.execPath,
            [
              path.join(repoRoot, 'plugins/consensus/scripts/consensus.mjs'),
              'run',
              '--provider',
              'codex',
              '--output',
              'text',
              '--json',
              '--prompt',
              'Reply in prose.',
            ],
            {
              cwd: dir,
              env: { ...process.env, CONSENSUS_CODEX_EXECUTABLE: provider },
              stdio: 'ignore',
            },
          );
          const exited = new Promise<NodeJS.Signals | null>((resolve) => {
            parent.on('exit', (_code, exitSignal) => resolve(exitSignal));
          });
          pids.push(...(await waitForPids(pidFile)));

          parent.kill(signal);

          await expect(exited).resolves.toBe(signal);
          for (const pid of pids) {
            await expect(waitForExit(pid)).resolves.toBe(true);
          }
        } finally {
          pids.forEach(killQuietly);
          await rm(dir, { recursive: true, force: true });
        }
      },
    );

    it('forwards to each concurrent run and leaves the signal to remaining listeners', async () => {
      const ownedBefore = process.listeners('SIGTERM').length;
      // Another listener stands in for a host handler, so the forwarders must
      // not re-raise the signal on this test process.
      const hostHandler = () => {};
      process.on('SIGTERM', hostHandler);
      try {
        const runs = [1, 2].map(() =>
          runProviderSubprocess(invocation(['sleep', '30000']), {
            maxOutputBytes: 1024,
            timeoutSec: 20,
          }),
        );
        const forwarders = process.listeners('SIGTERM').slice(ownedBefore + 1);
        expect(forwarders).toHaveLength(2);
        for (const forward of forwarders) {
          (forward as (signal: NodeJS.Signals) => void)('SIGTERM');
        }

        const results = await Promise.all(runs);
        for (const result of results) {
          expect(result).toMatchObject({
            ok: false,
            code: 'PROVIDER_EXIT',
            retryable: false,
            message:
              'Provider run was interrupted by SIGTERM sent to consensus.',
            signal: 'SIGTERM',
            diagnostics: {
              termination: {
                reason: 'interrupt',
                signals: ['SIGTERM'],
                settled_by: 'forwarded_signal',
              },
            },
          });
        }
        expect(process.listeners('SIGTERM')).toHaveLength(ownedBefore + 1);
      } finally {
        process.removeListener('SIGTERM', hostHandler);
      }
    });

    it('escalates a repeated interrupt straight to SIGKILL', async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), 'consensus-repeat-'));
      const pidFile = path.join(dir, 'pids');
      const provider = path.join(dir, 'provider');
      // The grandchild records its pid only after it ignores SIGTERM.
      const grandchildSource = [
        "process.on('SIGTERM', () => {});",
        `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, process.argv[1] + ':' + process.pid);`,
        'setInterval(() => {}, 1000);',
      ].join(' ');
      await writeFile(
        provider,
        `#!${process.execPath}
const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}, String(process.pid)], { stdio: 'ignore' });
setInterval(() => {}, 1000);
`,
      );
      await chmod(provider, 0o755);
      const ownedBefore = process.listeners('SIGTERM').length;
      const hostHandler = () => {};
      process.on('SIGTERM', hostHandler);
      const pids: number[] = [];
      try {
        // The grandchild ignores SIGTERM, so the long grace period would hold
        // the run open unless the repeated signal escalates. A host listener
        // keeps the signal from being re-raised on this test process.
        const run = runProviderSubprocess(
          { ...invocation([]), executable: provider },
          {
            maxOutputBytes: 1024,
            timeoutSec: 20,
            terminationGraceMs: 10000,
            finalResolutionMs: 2000,
          },
        );
        const [forward] = process.listeners('SIGTERM').slice(ownedBefore + 1);
        pids.push(...(await waitForPids(pidFile)));
        const signalledAt = Date.now();
        (forward as (signal: NodeJS.Signals) => void)('SIGTERM');
        (forward as (signal: NodeJS.Signals) => void)('SIGTERM');

        const result = await run;

        expect(Date.now() - signalledAt).toBeLessThan(5000);
        expect(result).toMatchObject({
          ok: false,
          code: 'PROVIDER_EXIT',
          retryable: false,
          diagnostics: {
            termination: {
              reason: 'interrupt',
              signals: ['SIGTERM', 'SIGKILL'],
              settled_by: 'sigkill',
            },
          },
        });
        for (const pid of pids) {
          await expect(waitForExit(pid)).resolves.toBe(true);
        }
      } finally {
        process.removeListener('SIGTERM', hostHandler);
        pids.forEach(killQuietly);
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('leaves no interrupt listeners after a run settles', async () => {
      const counts = () =>
        ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) =>
          process.listenerCount(signal),
        );
      const before = counts();

      await runProviderSubprocess(invocation(['echo-stdin']), {
        maxOutputBytes: 1024,
        timeoutSec: 5,
      });
      await runProviderSubprocess(
        {
          ...invocation(['echo-stdin']),
          executable: path.join(fixtureBin, 'no-such-provider'),
        },
        { maxOutputBytes: 1024, timeoutSec: 5 },
      );

      expect(counts()).toEqual(before);
    });

    it('SIGKILLs a SIGTERM-ignoring grandchild after the leader exits on timeout', async () => {
      let grandchild: number | undefined;
      try {
        const result = await runProviderSubprocess(
          invocation(['sigterm-grandchild', 'wait']),
          {
            maxOutputBytes: 1024,
            timeoutSec: 1,
            terminationGraceMs: 100,
            finalResolutionMs: 2000,
          },
        );
        grandchild = grandchildPid(result.stdout);

        expect(result).toMatchObject({
          ok: false,
          code: 'PROVIDER_TIMEOUT',
          diagnostics: {
            termination: {
              reason: 'timeout',
              scope: 'process_group',
              signals: ['SIGTERM', 'SIGKILL'],
              settled_by: 'sigkill',
            },
          },
        });
        await expect(waitForExit(grandchild)).resolves.toBe(true);
      } finally {
        killQuietly(grandchild);
      }
    });

    it('SIGKILLs a SIGTERM-ignoring grandchild on the output cap', async () => {
      let grandchild: number | undefined;
      try {
        const result = await runProviderSubprocess(
          invocation(['sigterm-grandchild', 'flood']),
          {
            maxOutputBytes: 16 * 1024,
            timeoutSec: 30,
            terminationGraceMs: 100,
            finalResolutionMs: 2000,
          },
        );
        grandchild = grandchildPid(result.stdout);

        expect(result).toMatchObject({
          ok: false,
          code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
          diagnostics: {
            termination: {
              reason: 'output_cap',
              scope: 'process_group',
              signals: ['SIGTERM', 'SIGKILL'],
              settled_by: 'sigkill',
            },
          },
        });
        await expect(waitForExit(grandchild)).resolves.toBe(true);
      } finally {
        killQuietly(grandchild);
      }
    });

    it('settles at once when the group is already gone (ESRCH)', async () => {
      let grandchild: number | undefined;
      const startedAt = Date.now();
      try {
        // The escaped grandchild holds the output pipes, so the run cannot
        // end on 'close'; without ESRCH handling it waits out both bounds.
        const result = await runProviderSubprocess(
          invocation(['escaped-grandchild']),
          {
            maxOutputBytes: 1024,
            timeoutSec: 0.5,
            terminationGraceMs: 5000,
            finalResolutionMs: 5000,
          },
        );
        grandchild = grandchildPid(result.stdout);

        expect(Date.now() - startedAt).toBeLessThan(3000);
        expect(result).toMatchObject({
          ok: false,
          code: 'PROVIDER_TIMEOUT',
          diagnostics: {
            termination: {
              reason: 'timeout',
              signals: [],
              settled_by: 'group_gone',
            },
          },
        });
      } finally {
        killQuietly(grandchild);
      }
    });

    it('ends on the settlement bound when an escaped process holds the pipes', async () => {
      let grandchild: number | undefined;
      const startedAt = Date.now();
      try {
        // Group SIGKILL ends the leader, but the escaped grandchild keeps the
        // pipes open, so 'close' never fires and only the bound settles.
        const result = await runProviderSubprocess(
          invocation(['escaped-grandchild-holds-pipes']),
          {
            maxOutputBytes: 1024,
            timeoutSec: 1,
            terminationGraceMs: 200,
            finalResolutionMs: 500,
          },
        );
        const elapsed = Date.now() - startedAt;
        grandchild = grandchildPid(result.stdout);

        expect(elapsed).toBeGreaterThanOrEqual(1000 + 200 + 500);
        expect(elapsed).toBeLessThan(5000);
        expect(result).toMatchObject({
          ok: false,
          code: 'PROVIDER_TIMEOUT',
          signal: 'SIGKILL',
          diagnostics: {
            termination: {
              reason: 'timeout',
              scope: 'process_group',
              signals: ['SIGTERM', 'SIGKILL'],
              settled_by: 'settlement_timeout',
            },
          },
        });
      } finally {
        killQuietly(grandchild);
      }
    });

    it('does not signal the group when the provider exits normally', async () => {
      let grandchild: number | undefined;
      try {
        const result = await runProviderSubprocess(
          invocation(['sigterm-grandchild', 'exit']),
          { maxOutputBytes: 1024, timeoutSec: 5 },
        );
        grandchild = grandchildPid(result.stdout);

        expect(result).toMatchObject({ ok: true, exit_code: 0 });
        expect(result.diagnostics.termination).toBeUndefined();
        expect(isAlive(grandchild)).toBe(true);
      } finally {
        killQuietly(grandchild);
      }
    });
  });

  it('reports an oversized argv as PROVIDER_ARGV_TOO_LARGE, not a missing executable', async () => {
    // 4 MiB exceeds both the macOS ARG_MAX and Linux's per-argument limit.
    const oversized = await runProviderSubprocess(
      invocation(['echo-stdin', 'x'.repeat(4 * 1024 * 1024)]),
      { maxOutputBytes: 1024, timeoutSec: 5 },
    );
    expect(oversized).toMatchObject({
      ok: false,
      code: 'PROVIDER_ARGV_TOO_LARGE',
      retryable: false,
      message: expect.stringContaining('too large for argv'),
    });

    const missing = await runProviderSubprocess(
      {
        ...invocation(['echo-stdin']),
        executable: path.join(fixtureBin, 'no-such-provider'),
      },
      { maxOutputBytes: 1024, timeoutSec: 5 },
    );
    expect(missing).toMatchObject({ ok: false, code: 'PROVIDER_MISSING' });
  });

  it('reports redacted command diagnostics without prompt content', async () => {
    const result = await runProviderSubprocess(invocation(['echo-stdin']), {
      maxOutputBytes: 1024,
      timeoutSec: 5,
    });

    expect(result.diagnostics.redacted_command).toEqual([
      'consensus-provider-stub',
      'echo-stdin',
    ]);
    expect(JSON.stringify(result.diagnostics)).not.toContain(
      'Prompt from stdin.',
    );
  });

  it('passes argv literally without shell execution', async () => {
    const result = await runProviderSubprocess(
      invocation(['argv-json', '; touch should-not-run']),
      {
        maxOutputBytes: 1024,
        timeoutSec: 5,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      stdout: JSON.stringify(['; touch should-not-run']),
    });
  });
});

function invocation(argv: string[]): ProviderInvocation {
  return {
    executable: stubExecutable,
    argv,
    stdin: 'Prompt from stdin.',
    cwd: repoRoot,
    output_mode: 'stdout_json',
    strategy: 'prompt_only',
    redacted_command: ['consensus-provider-stub', ...argv],
    shell: false,
  };
}

function grandchildPid(stdout: string): number {
  const match = /grandchild:(\d+)/.exec(stdout);
  if (!match) throw new Error(`Fixture did not report a grandchild: ${stdout}`);
  return Number(match[1]);
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return !isAlive(pid);
}

async function waitForPids(pidFile: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const contents = await readFile(pidFile, 'utf8').catch(() => '');
    if (contents.includes(':')) return contents.split(':').map(Number);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Provider fixture did not record its pids.');
}

function killQuietly(pid: number | undefined) {
  if (pid === undefined) return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}
