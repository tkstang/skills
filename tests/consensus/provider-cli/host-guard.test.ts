import { describe, expect, it } from 'vitest';

import {
  buildChildHostEnv,
  detectHostRuntime,
  evaluateHostGuard,
  hostContextFromEnv,
} from '../../../src/consensus/provider-cli/host-guard.js';
import { runPreflight } from '../../../src/consensus/provider-cli/commands.js';
import type {
  HostContext,
  ProviderInventoryEntry,
} from '../../../src/consensus/provider-cli/types.js';

describe('provider host runtime guard', () => {
  it('detects host runtimes from Claude, Codex, and Cursor environment markers', () => {
    expect(detectHostRuntime({ CLAUDECODE: '1' })).toBe('claude');
    expect(detectHostRuntime({ CODEX_SESSION_ID: 'session' })).toBe('codex');
    expect(detectHostRuntime({ CURSOR_TRACE_ID: 'trace' })).toBe('cursor');
    expect(detectHostRuntime({})).toBe('unknown');
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
    let host = hostContext({ runtime: 'claude', depth: 0, max_depth: maxDepth });
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
    expect(buildChildHostEnv(hostContext({ runtime: 'claude', depth: 0 }))).toEqual({
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

  it('marks blocked same-host preflight entries unavailable', async () => {
    await expect(
      runPreflight({
        provider: 'codex',
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
