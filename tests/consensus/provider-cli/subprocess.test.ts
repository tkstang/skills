import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ProviderInvocation } from '../../../src/consensus/provider-cli/invocation.js';
import { runProviderSubprocess } from '../../../src/consensus/provider-cli/subprocess.js';
import { fixtureBin, repoRoot } from '../../helpers/process.mjs';

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
