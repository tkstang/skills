import { describe, expect, it } from 'vitest';

import { runPreflight } from '../provider-cli/commands.js';
import {
  buildChildHostEnv,
  detectHostRuntime,
  evaluateHostGuard,
  hostContextFromEnv,
  resolveExplicitHostContext,
} from '../provider-cli/host-guard.js';
import type {
  HostContext,
  ProviderInventoryEntry,
} from '../provider-cli/types.js';

describe('provider host runtime guard', () => {
  it('detects host runtimes from Claude, Codex, and Cursor environment markers', () => {
    expect(detectHostRuntime({ CLAUDECODE: '1' })).toBe('claude');
    expect(detectHostRuntime({ CODEX_SESSION_ID: 'session' })).toBe('codex');
    expect(detectHostRuntime({ CURSOR_TRACE_ID: 'trace' })).toBe('cursor');
    expect(detectHostRuntime({})).toBe('unknown');
  });

  it('uses the established host priority when ambient markers are mixed', () => {
    expect(
      detectHostRuntime({ CLAUDECODE: '1', CURSOR_TRACE_ID: 'trace' }),
    ).toBe('claude');
    expect(
      detectHostRuntime({
        CODEX_SESSION_ID: 'session',
        CURSOR_TRACE_ID: 'trace',
      }),
    ).toBe('codex');
  });

  it('gives an explicit parent precedence over unrelated ambient markers', () => {
    expect(
      detectHostRuntime({
        CONSENSUS_PARENT_HOST: 'codex',
        CURSOR_AGENT: '1',
      }),
    ).toBe('codex');
  });

  it('allows a depth 0 host to spawn a same-provider leaf subprocess at depth 1', () => {
    const host = hostContext({ runtime: 'codex', depth: 0, max_depth: 1 });

    expect(evaluateHostGuard({ host, provider: 'codex' })).toMatchObject({
      allowed: true,
      host_relation: 'same_host',
      guard: 'subprocess_isolated',
      child_env: {
        CONSENSUS_RUN_ID: 'run-123',
        CONSENSUS_PARENT_HOST: 'codex',
        CONSENSUS_DEPTH: '1',
      },
    });
  });

  it('blocks depth 1 peers from spawning depth 2 by default', () => {
    const host = hostContext({ runtime: 'claude', depth: 1, max_depth: 1 });

    expect(evaluateHostGuard({ host, provider: 'claude' })).toMatchObject({
      allowed: false,
      code: 'HOST_RECURSION_BLOCKED',
      host_relation: 'same_host',
      guard: 'blocked',
      diagnostics: {
        guard: 'blocked',
      },
    });
  });

  it('allows explicitly configured deeper recursion within max_depth', () => {
    const host = hostContext({ runtime: 'cursor', depth: 1, max_depth: 2 });

    expect(evaluateHostGuard({ host, provider: 'cursor' })).toMatchObject({
      allowed: true,
      host_relation: 'same_host',
      guard: 'subprocess_isolated',
      child_env: {
        CONSENSUS_DEPTH: '2',
      },
    });
  });

  it('propagates depth to a cross-provider peer and allows within max_depth', () => {
    const host = hostContext({ runtime: 'claude', depth: 0, max_depth: 1 });

    expect(evaluateHostGuard({ host, provider: 'codex' })).toMatchObject({
      allowed: true,
      host_relation: 'different_host',
      guard: 'subprocess_isolated',
      child_env: {
        CONSENSUS_RUN_ID: 'run-123',
        CONSENSUS_PARENT_HOST: 'claude',
        CONSENSUS_DEPTH: '1',
      },
    });
  });

  it('blocks a cross-provider peer spawn at the depth cap', () => {
    const host = hostContext({ runtime: 'claude', depth: 1, max_depth: 1 });

    expect(evaluateHostGuard({ host, provider: 'codex' })).toMatchObject({
      allowed: false,
      code: 'HOST_RECURSION_BLOCKED',
      host_relation: 'different_host',
      guard: 'blocked',
      diagnostics: {
        guard: 'blocked',
        warnings: [expect.stringContaining('HOST_RECURSION_BLOCKED')],
      },
    });
  });

  it('blocks an alternating cross-provider chain once cumulative depth exceeds max_depth', () => {
    const maxDepth = 2;
    // Each hop spawns a peer whose runtime differs from its host, so every
    // evaluation takes the different_host branch. The spawned peer process
    // becomes the host for the next hop, carrying the incremented depth
    // forward via child_env — the exact path that previously reset to 0.
    let host = hostContext({
      runtime: 'claude',
      depth: 0,
      max_depth: maxDepth,
    });
    const providers = ['codex', 'claude', 'codex'] as const;
    const results = [];

    for (const provider of providers) {
      const result = evaluateHostGuard({ host, provider });
      results.push(result);
      if (!result.allowed) break;
      host = {
        ...host,
        runtime: provider,
        depth: Number(result.child_env!.CONSENSUS_DEPTH),
      };
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      allowed: true,
      host_relation: 'different_host',
      child_env: { CONSENSUS_DEPTH: '1' },
    });
    expect(results[1]).toMatchObject({
      allowed: true,
      host_relation: 'different_host',
      child_env: { CONSENSUS_DEPTH: '2' },
    });
    expect(results[2]).toMatchObject({
      allowed: false,
      code: 'HOST_RECURSION_BLOCKED',
      host_relation: 'different_host',
      guard: 'blocked',
    });
  });

  it('allows an unknown host and emits no child environment', () => {
    const host = hostContext({ runtime: 'unknown', depth: 0, max_depth: 1 });
    const result = evaluateHostGuard({ host, provider: 'codex' });

    expect(result).toMatchObject({
      allowed: true,
      host_relation: 'unknown',
      guard: 'none',
    });
    expect(result).not.toHaveProperty('child_env');
  });

  it('never emits the reserved host-native safe-packet guard in first scope', () => {
    const results = [
      evaluateHostGuard({
        host: hostContext({ runtime: 'codex', depth: 0, max_depth: 1 }),
        provider: 'claude',
      }),
      evaluateHostGuard({
        host: hostContext({ runtime: 'codex', depth: 0, max_depth: 1 }),
        provider: 'codex',
      }),
      evaluateHostGuard({
        host: hostContext({ runtime: 'codex', depth: 1, max_depth: 1 }),
        provider: 'codex',
      }),
    ];

    expect(JSON.stringify(results)).not.toContain(
      'host_native_safe_packet_required',
    );
  });

  it('builds child host environment by incrementing depth', () => {
    expect(
      buildChildHostEnv(hostContext({ runtime: 'claude', depth: 0 })),
    ).toEqual({
      CONSENSUS_RUN_ID: 'run-123',
      CONSENSUS_PARENT_HOST: 'claude',
      CONSENSUS_DEPTH: '1',
    });
  });

  it('can derive a host context from process environment markers', () => {
    expect(
      hostContextFromEnv(
        {
          CODEX_SESSION_ID: 'session',
          CONSENSUS_RUN_ID: 'run-from-env',
          CONSENSUS_DEPTH: '1',
        },
        '/repo',
        2,
      ),
    ).toEqual({
      runtime: 'codex',
      cwd: '/repo',
      run_id: 'run-from-env',
      depth: 1,
      max_depth: 2,
    });
  });

  it.each([
    {
      env: { CLAUDECODE: '1', CURSOR_TRACE_ID: 'trace' },
      runtime: 'claude' as const,
    },
    {
      env: { CONSENSUS_PARENT_HOST: 'codex', CURSOR_AGENT: '1' },
      runtime: 'codex' as const,
    },
  ])(
    'propagates child host state for mixed marker evidence as $runtime',
    ({ env, runtime }) => {
      const host = hostContextFromEnv(
        { ...env, CONSENSUS_RUN_ID: 'mixed-run' },
        '/repo',
      );

      expect(evaluateHostGuard({ host, provider: 'cursor' })).toMatchObject({
        allowed: true,
        child_env: {
          CONSENSUS_RUN_ID: 'mixed-run',
          CONSENSUS_PARENT_HOST: runtime,
          CONSENSUS_DEPTH: '1',
        },
      });
    },
  );

  it('resolves one explicit review host while preserving inherited depth', () => {
    expect(
      resolveExplicitHostContext({
        runtime: 'codex',
        cwd: '/repo',
        env: {
          CONSENSUS_PARENT_HOST: 'codex',
          CONSENSUS_RUN_ID: 'review-123',
          CONSENSUS_DEPTH: '0',
        },
        maxDepth: 1,
      }),
    ).toEqual({
      ok: true,
      context: {
        runtime: 'codex',
        cwd: '/repo',
        run_id: 'review-123',
        depth: 0,
        max_depth: 1,
      },
    });
  });

  it.each(['malformed', '-1', '1.5', '2', '9007199254740992'])(
    'rejects present invalid review depth %s instead of resetting it to zero',
    (depth) => {
      expect(
        resolveExplicitHostContext({
          runtime: 'codex',
          cwd: '/repo',
          env: {
            CONSENSUS_PARENT_HOST: 'codex',
            CONSENSUS_DEPTH: depth,
          },
          maxDepth: 1,
        }),
      ).toMatchObject({ ok: false, reason: 'invalid_depth' });
    },
  );

  it('defaults an absent explicit review depth to the root depth', () => {
    expect(
      resolveExplicitHostContext({
        runtime: 'codex',
        cwd: '/repo',
        env: { CONSENSUS_PARENT_HOST: 'codex' },
        maxDepth: 1,
      }),
    ).toMatchObject({ ok: true, context: { depth: 0, max_depth: 1 } });
  });

  it('blocks unknown and contradictory explicit review host identity', () => {
    expect(
      resolveExplicitHostContext({
        runtime: 'codex',
        cwd: '/repo',
        env: {},
        maxDepth: 1,
      }),
    ).toMatchObject({ ok: false, reason: 'unknown_host' });

    expect(
      resolveExplicitHostContext({
        runtime: 'codex',
        cwd: '/repo',
        env: { CLAUDECODE: '1', CODEX_SESSION_ID: 'session' },
        maxDepth: 1,
      }),
    ).toMatchObject({ ok: false, reason: 'contradictory_host' });
  });

  it('marks blocked same-host preflight entries unavailable', async () => {
    await expect(
      runPreflight({
        provider: 'codex',
        capabilities: ['run'],
        host: hostContext({ runtime: 'codex', depth: 1, max_depth: 1 }),
        registry: [providerEntry('codex', 'ready')],
      }),
    ).resolves.toMatchObject({
      ok: true,
      usable: false,
      providers: [
        {
          id: 'codex',
          status: 'unavailable',
          host_relation: 'same_host',
          guard: 'blocked',
          diagnostics: {
            guard: 'blocked',
            warnings: [expect.stringContaining('HOST_RECURSION_BLOCKED')],
          },
        },
      ],
    });
  });
});

function hostContext(
  overrides: Partial<HostContext> & Pick<HostContext, 'runtime'>,
): HostContext {
  return {
    runtime: overrides.runtime,
    cwd: overrides.cwd ?? '/repo',
    run_id: overrides.run_id ?? 'run-123',
    depth: overrides.depth ?? 0,
    max_depth: overrides.max_depth ?? 1,
  };
}

function providerEntry(
  id: string,
  status: ProviderInventoryEntry['status'],
): ProviderInventoryEntry {
  return {
    id,
    status,
    capabilities: {
      schema_strategies: ['prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  };
}
