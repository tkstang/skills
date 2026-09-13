import type {
  HostContext,
  HostRuntime,
  ProviderDiagnostics,
  ProviderErrorCode,
  ProviderId,
} from './types.js';

export type HostGuardResult =
  | HostGuardAllowedResult
  | HostGuardBlockedResult;

export interface HostGuardAllowedResult {
  allowed: true;
  host_relation: NonNullable<ProviderDiagnostics['host_relation']>;
  guard: 'none' | 'subprocess_isolated';
  child_env?: Record<string, string>;
  diagnostics: ProviderDiagnostics;
}

export interface HostGuardBlockedResult {
  allowed: false;
  code: Extract<ProviderErrorCode, 'HOST_RECURSION_BLOCKED'>;
  message: string;
  host_relation: 'same_host' | 'different_host';
  guard: 'blocked';
  diagnostics: ProviderDiagnostics;
}

export function detectHostRuntime(
  env: Record<string, string | undefined>,
): HostRuntime {
  if (
    env.CONSENSUS_PARENT_HOST === 'claude' ||
    env.CLAUDECODE ||
    env.CLAUDE_CODE_ENTRYPOINT ||
    env.CLAUDE_CODE_SESSION_ID ||
    env.CLAUDE_SESSION_ID
  ) {
    return 'claude';
  }
  if (
    env.CONSENSUS_PARENT_HOST === 'codex' ||
    env.CODEX_SESSION_ID ||
    env.CODEX_SANDBOX ||
    env.OPENAI_CODEX_SESSION_ID
  ) {
    return 'codex';
  }
  if (
    env.CONSENSUS_PARENT_HOST === 'cursor' ||
    env.CURSOR_TRACE_ID ||
    env.CURSOR_AGENT ||
    env.CURSOR_SESSION_ID ||
    env.CURSOR
  ) {
    return 'cursor';
  }
  return 'unknown';
}

export function hostContextFromEnv(
  env: Record<string, string | undefined>,
  cwd: string,
  maxDepth = 1,
): HostContext {
  return {
    runtime: detectHostRuntime(env),
    cwd,
    run_id: env.CONSENSUS_RUN_ID ?? 'local',
    depth: parseNonNegativeInteger(env.CONSENSUS_DEPTH) ?? 0,
    max_depth: maxDepth,
  };
}

export function buildChildHostEnv(context: HostContext): Record<string, string> {
  return {
    CONSENSUS_RUN_ID: context.run_id,
    CONSENSUS_PARENT_HOST: context.runtime,
    CONSENSUS_DEPTH: String(context.depth + 1),
  };
}

export function evaluateHostGuard(input: {
  host?: HostContext;
  provider: ProviderId;
}): HostGuardResult {
  const { host, provider } = input;
  if (!host || host.runtime === 'unknown') {
    return allowed('unknown', 'none');
  }

  if (host.runtime !== provider) {
    const crossDepth = host.depth + 1;
    if (crossDepth > host.max_depth) {
      return {
        allowed: false,
        code: 'HOST_RECURSION_BLOCKED',
        message: `Blocked cross-provider peer spawn (${host.runtime}→${provider}) at depth ${crossDepth}; max_depth is ${host.max_depth}.`,
        host_relation: 'different_host',
        guard: 'blocked',
        diagnostics: {
          host_relation: 'different_host',
          guard: 'blocked',
          warnings: [
            `HOST_RECURSION_BLOCKED: cross-provider ${host.runtime}→${provider} peer would exceed max_depth ${host.max_depth}`,
          ],
        },
      };
    }

    return allowed(
      'different_host',
      'subprocess_isolated',
      buildChildHostEnv(host),
    );
  }

  const childDepth = host.depth + 1;
  if (childDepth > host.max_depth) {
    return {
      allowed: false,
      code: 'HOST_RECURSION_BLOCKED',
      message: `Blocked recursive ${provider} peer spawn at depth ${childDepth}; max_depth is ${host.max_depth}.`,
      host_relation: 'same_host',
      guard: 'blocked',
      diagnostics: {
        host_relation: 'same_host',
        guard: 'blocked',
        warnings: [
          `HOST_RECURSION_BLOCKED: ${provider} peer would exceed max_depth ${host.max_depth}`,
        ],
      },
    };
  }

  return allowed('same_host', 'subprocess_isolated', buildChildHostEnv(host));
}

function allowed(
  hostRelation: NonNullable<ProviderDiagnostics['host_relation']>,
  guard: 'none' | 'subprocess_isolated',
  childEnv?: Record<string, string>,
): HostGuardAllowedResult {
  return {
    allowed: true,
    host_relation: hostRelation,
    guard,
    ...(childEnv ? { child_env: childEnv } : {}),
    diagnostics: {
      host_relation: hostRelation,
      guard,
    },
  };
}

function parseNonNegativeInteger(value: string | undefined) {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}
