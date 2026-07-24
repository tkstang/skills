import { describe, expect, it } from 'vitest';

// @ts-expect-error The probe is an authored Node CLI without declarations.
import * as cursorAcceptanceProbe from '../../scripts/probe-cursor-acceptance.mjs';

const { runLiveAcceptance, runSyntheticAcceptance } = cursorAcceptanceProbe;

describe('Cursor observation acceptance probe', () => {
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
      _command: string,
      args: string[],
    ): Promise<Record<string, unknown>> => {
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
});
