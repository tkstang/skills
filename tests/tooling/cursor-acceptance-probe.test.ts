import { describe, expect, it } from 'vitest';

// @ts-expect-error The probe is an authored Node CLI without declarations.
import * as cursorAcceptanceProbe from '../../scripts/probe-cursor-acceptance.mjs';

const { runCommand, runLiveAcceptance, runSyntheticAcceptance } =
  cursorAcceptanceProbe;
const CHILD_READINESS_TIMEOUT_MS = 1_000;

function processExists(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForProcessExit(pid: number) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (!processExists(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function successfulLiveCommandRunner({
  digest = {},
  whoamiExitCode = 2,
  whoamiPayload = { noIdentity: true },
  versionFailure = false,
  watchEvents = [
    { type: 'baseline' },
    { type: 'stopped', reason: 'max-runtime' },
  ],
  watchTimedOut = false,
}: {
  digest?: Record<string, unknown>;
  whoamiExitCode?: number;
  whoamiPayload?: Record<string, unknown>;
  versionFailure?: boolean;
  watchEvents?: Array<Record<string, unknown>>;
  watchTimedOut?: boolean;
} = {}) {
  return async (
    command: string,
    args: string[],
  ): Promise<Record<string, unknown>> => {
    if (command === 'cursor') {
      return {
        commandRun: true,
        exitCode: versionFailure ? 1 : 0,
        signal: null,
        timedOut: false,
        stdout: versionFailure ? '' : '3.11.13 arm64\n',
        stderr: '',
      };
    }

    const subcommand = args[1];
    if (subcommand === 'whoami') {
      return {
        commandRun: true,
        exitCode: whoamiExitCode,
        signal: null,
        timedOut: false,
        stdout: `${JSON.stringify(whoamiPayload)}\n`,
        stderr: '',
      };
    }
    if (subcommand === 'locate') {
      return {
        commandRun: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout:
          '{"winner":{"runtime":"cursor","sessionId":"synthetic-live-session"}}\n',
        stderr: '',
      };
    }
    if (subcommand === 'catch-up') {
      const baseStatus = {
        engagement: 'engaged',
        activity: 'assistant-progress',
        content: 'available',
        lifecycle: 'success',
        delivery: 'reserved',
        health: 'healthy',
      };
      const digestCursorEvidence =
        (digest.cursorEvidence as Record<string, unknown> | undefined) ?? {};
      const digestStatus =
        (digestCursorEvidence.status as Record<string, unknown> | undefined) ??
        {};
      const payload = {
        schemaVersion: 2,
        runtime: 'cursor',
        entries: [{ role: 'assistant', text: '<redacted>' }],
        ...digest,
        range: {
          indexBase: 'zero-based-jsonl-frame-index',
          fromIndex: 0,
          nextIndex: 3,
          ...(digest.range as Record<string, unknown> | undefined),
        },
        cursorEvidence: {
          ...digestCursorEvidence,
          status: { ...baseStatus, ...digestStatus },
        },
      };
      return {
        commandRun: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: `${JSON.stringify(payload)}\n`,
        stderr: '',
      };
    }
    return {
      commandRun: true,
      exitCode: 0,
      signal: null,
      timedOut: watchTimedOut,
      stdout: `${watchEvents.map((event) => JSON.stringify(event)).join('\n')}\n`,
      stderr: '',
    };
  };
}

describe('Cursor observation acceptance probe', () => {
  it.skipIf(process.platform === 'win32')(
    'hard-bounds a SIGTERM-resistant process tree',
    async () => {
      const startedAt = Date.now();
      const result = await runCommand(
        process.execPath,
        [
          '-e',
          `
            const { spawn } = require('node:child_process');
            process.on('SIGTERM', () => {});
            const descendant = spawn(
              process.execPath,
              ['-e', "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1_000);"],
              { stdio: ['ignore', 'pipe', 'ignore'] },
            );
            descendant.stdout.once('data', () => {
              process.stdout.write(JSON.stringify({
                type: 'ready',
                parent: process.pid,
                descendant: descendant.pid,
                readyAt: Date.now(),
              }));
            });
            setInterval(() => {}, 1_000);
          `,
        ],
        {
          timeoutMs: CHILD_READINESS_TIMEOUT_MS,
          terminationGraceMs: 40,
          resolutionGraceMs: 80,
        },
      );
      const readiness = JSON.parse(result.stdout);

      await Promise.all([
        waitForProcessExit(readiness.parent),
        waitForProcessExit(readiness.descendant),
      ]);

      expect(readiness.type).toBe('ready');
      expect(result).toMatchObject({
        commandRun: true,
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: true,
      });
      expect(readiness.readyAt).toBeGreaterThanOrEqual(startedAt);
      expect(Date.now() - readiness.readyAt).toBeLessThan(2_000);
      expect(processExists(readiness.parent)).toBe(false);
      expect(processExists(readiness.descendant)).toBe(false);
    },
  );

  it('hard-bounds a SIGTERM-resistant child without process-group support', async () => {
    const result = await runCommand(
      process.execPath,
      [
        '-e',
        "process.on('SIGTERM', () => {}); process.stdout.write(JSON.stringify({ type: 'ready', readyAt: Date.now() })); setInterval(() => {}, 1_000);",
      ],
      {
        timeoutMs: CHILD_READINESS_TIMEOUT_MS,
        terminationGraceMs: 40,
        resolutionGraceMs: 80,
        useProcessGroup: false,
      },
    );
    const readiness = JSON.parse(result.stdout);

    expect(readiness.type).toBe('ready');
    expect(result).toMatchObject({
      commandRun: true,
      exitCode: null,
      signal: 'SIGKILL',
      timedOut: true,
    });
    expect(Date.now() - readiness.readyAt).toBeLessThan(2_000);
  });

  it('preserves normal command completion before the hard deadline', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', "process.stdout.write('complete')"],
      {
        timeoutMs: 500,
        terminationGraceMs: 40,
        resolutionGraceMs: 80,
      },
    );

    expect(result).toMatchObject({
      commandRun: true,
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: 'complete',
    });
  });

  it('runs every sanitized temporary-store acceptance row to a structural result', async () => {
    const rows = await runSyntheticAcceptance();

    expect(rows.map((row: any) => row.id)).toEqual([
      'synthetic-whoami',
      'synthetic-exact-locate',
      'synthetic-pinned-catch-up',
      'synthetic-bounded-catch-up-then-watch',
      'synthetic-second-scan-stability',
      'synthetic-lifecycle-success',
      'synthetic-lifecycle-aborted',
      'synthetic-lifecycle-error',
      'synthetic-lifecycle-cancelled',
      'synthetic-malformed-repair',
      'synthetic-partial-repair',
      'synthetic-continuity-shrink',
      'synthetic-continuity-replacement',
      'synthetic-restart-append',
      'synthetic-reset-replay',
    ]);
    expect(rows.every((row: any) => row.commandRun)).toBe(true);
    expect(rows.every((row: any) => row.status === 'passed')).toBe(true);
    expect(
      rows.every((row: any) => row.evidenceLabel === 'automated-only'),
    ).toBe(true);

    const retained = Object.fromEntries(
      rows
        .filter((row: any) => row.id.startsWith('synthetic-lifecycle-'))
        .map((row: any) => [row.actual.lifecycle, row.actual.failureRetained]),
    );
    expect(retained).toEqual({
      success: false,
      aborted: true,
      error: true,
      cancelled: true,
    });
  });

  it('emits no raw identities, personal paths, credentials, or transcript prose', async () => {
    const output = JSON.stringify(await runSyntheticAcceptance());

    expect(output).not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\Users\\/u);
    expect(output).not.toMatch(
      /\b(?:session|conversation|generation|lease)[_-]?id["']?\s*[:=]\s*["']?(?!<)/iu,
    );
    expect(output).not.toMatch(
      /\b(?:AKIA[0-9A-Z]{16}|Bearer\s+\S+|api[_-]?key\s*[:=])/iu,
    );
    expect(output).not.toMatch(
      /Private transcript|System prompt:|<environment_context>/iu,
    );
  });

  it('runs all live command rows and retains unavailable support honestly', async () => {
    const commandRunner = async (
      command: string,
      args: string[],
    ): Promise<Record<string, unknown>> => {
      if (command === 'cursor') {
        return {
          commandRun: true,
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: '3.11.13 arm64\n',
          stderr: '',
        };
      }
      const subcommand = args[1];
      const payload =
        subcommand === 'whoami'
          ? { noIdentity: true }
          : subcommand === 'locate'
            ? { noMatch: true, runtime: 'cursor' }
            : subcommand === 'catch-up-then-watch'
              ? {
                  type: 'error',
                  message: 'synthetic unavailable',
                }
              : null;
      return {
        commandRun: true,
        exitCode: subcommand === 'whoami' || subcommand === 'locate' ? 2 : 1,
        signal: null,
        timedOut: false,
        stdout: payload === null ? '' : `${JSON.stringify(payload)}\n`,
        stderr: '',
      };
    };

    const live = await runLiveAcceptance('/synthetic-cwd', { commandRunner });

    expect(live.availability).toBe('unavailable');
    expect(live.rows).toHaveLength(4);
    expect(live.rows.every((row: any) => row.commandRun)).toBe(true);
    expect(live.rows.map((row: any) => row.status)).toEqual([
      'passed',
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
    expect(
      live.rows.slice(2).every((row: any) => {
        return row.evidenceLabel === 'documented-but-unvalidated';
      }),
    ).toBe(true);
  });

  it('promotes only rows that prove the complete live claim contract', async () => {
    const live = await runLiveAcceptance('/synthetic-cwd', {
      commandRunner: successfulLiveCommandRunner(),
    });

    expect(live.provider.status).toBe('passed');
    expect(live.rows).toHaveLength(4);
    expect(live.rows.every((row: any) => row.status === 'passed')).toBe(true);
    expect(
      live.rows.every((row: any) => row.evidenceLabel === 'live-validated'),
    ).toBe(true);
    expect(live.rows[2].actual).toMatchObject({
      schemaVersion: 2,
      indexBase: 'zero-based-jsonl-frame-index',
      engagement: 'engaged',
      activity: 'assistant-progress',
      content: 'available',
      lifecycle: 'success',
      delivery: 'reserved',
      health: 'healthy',
    });
    expect(live.rows[3].actual).toMatchObject({
      baselineObserved: true,
      stoppedEventCount: 1,
      stoppedIsFinal: true,
      finiteRuntimeConfigured: true,
      stopReason: 'max-runtime',
    });
  });

  it.each([
    ['schema', { schemaVersion: 1 }],
    ['index base', { range: { indexBase: 'zero-based-jsonl-record-index' } }],
    ['engagement', { cursorEvidence: { status: { engagement: 'unknown' } } }],
    ['activity', { cursorEvidence: { status: { activity: 'none' } } }],
    ['content', { cursorEvidence: { status: { content: 'buffered' } } }],
    ['lifecycle', { cursorEvidence: { status: { lifecycle: 'pending' } } }],
    ['delivery', { cursorEvidence: { status: { delivery: 'none' } } }],
    ['health', { cursorEvidence: { status: { health: 'blocked' } } }],
  ])(
    'rejects a live catch-up with the wrong %s claim',
    async (_name, digest) => {
      const live = await runLiveAcceptance('/synthetic-cwd', {
        commandRunner: successfulLiveCommandRunner({ digest }),
      });

      expect(live.rows[2]).toMatchObject({
        id: 'live-pinned-catch-up',
        status: 'failed',
      });
      expect(live.rows[2].evidenceLabel).not.toBe('live-validated');
    },
  );

  it('does not promote live evidence when provider version collection fails', async () => {
    const live = await runLiveAcceptance('/synthetic-cwd', {
      commandRunner: successfulLiveCommandRunner({ versionFailure: true }),
    });

    expect(live.provider.status).toBe('failed');
    expect(live.rows.some((row: any) => row.status === 'failed')).toBe(true);
    expect(
      live.rows.every((row: any) => row.evidenceLabel !== 'live-validated'),
    ).toBe(true);
  });

  it('does not promote a malformed structural whoami result', async () => {
    const live = await runLiveAcceptance('/synthetic-cwd', {
      commandRunner: successfulLiveCommandRunner({
        whoamiExitCode: 0,
        whoamiPayload: {},
      }),
    });

    expect(live.rows[0]).toMatchObject({
      id: 'live-whoami',
      status: 'failed',
      actual: { outcome: 'invalid' },
    });
    expect(live.rows[0].evidenceLabel).not.toBe('live-validated');
  });

  it.each([
    ['missing baseline', [{ type: 'stopped', reason: 'max-runtime' }], false],
    [
      'duplicate stopped events',
      [
        { type: 'baseline' },
        { type: 'stopped', reason: 'max-runtime' },
        { type: 'stopped', reason: 'max-runtime' },
      ],
      false,
    ],
    [
      'non-final stopped event',
      [
        { type: 'baseline' },
        { type: 'stopped', reason: 'max-runtime' },
        { type: 'heartbeat' },
      ],
      false,
    ],
    [
      'wrong stop reason',
      [{ type: 'baseline' }, { type: 'stopped', reason: 'signal' }],
      false,
    ],
    [
      'command timeout',
      [{ type: 'baseline' }, { type: 'stopped', reason: 'max-runtime' }],
      true,
    ],
  ])(
    'rejects inaccurate finite watch semantics: %s',
    async (_name, watchEvents, watchTimedOut) => {
      const live = await runLiveAcceptance('/synthetic-cwd', {
        commandRunner: successfulLiveCommandRunner({
          watchEvents,
          watchTimedOut,
        }),
      });

      expect(live.rows[3]).toMatchObject({
        id: 'live-bounded-catch-up-then-watch',
        status: 'failed',
      });
      expect(live.rows[3].evidenceLabel).not.toBe('live-validated');
    },
  );
});
