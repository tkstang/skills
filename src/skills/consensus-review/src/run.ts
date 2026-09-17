import path from 'node:path';

import { providerRegistry } from '../../../plugins/consensus/provider-cli/adapters.js';
import type { ProviderAdapterRegistry } from '../../../plugins/consensus/provider-cli/adapters.js';
import {
  evaluateHostGuard,
  resolveExplicitHostContext,
} from '../../../plugins/consensus/provider-cli/host-guard.js';
import type { KnownHostRuntime } from '../../../plugins/consensus/provider-cli/host-guard.js';
import {
  nodeProbeCommandRunner,
  probeProviderRegistry,
} from '../../../plugins/consensus/provider-cli/probe.js';
import type { ProbeCommandRunner } from '../../../plugins/consensus/provider-cli/probe.js';
import { runProviderTurn } from '../../../plugins/consensus/provider-cli/structured-output.js';
import type {
  ProviderTurnTransportOptions,
  RunProviderTurnDependencies,
} from '../../../plugins/consensus/provider-cli/structured-output.js';
import type {
  ConsensusCliRunEnvelope,
  ConsensusCliRunRequest,
  HostContext,
  ProviderInventoryEntry,
} from '../../../plugins/consensus/provider-cli/types.js';
import { inside } from '../../../plugins/consensus/shared/cli-helpers-core.js';

export interface ReviewFoundationResult {
  ok: false;
  status: 'foundation_only';
  invocation_count: 0;
}

export interface ReviewTransportRequest {
  provider: 'claude' | 'codex';
  prompt: string;
  schemaPath: string;
  cwd: string;
  host: KnownHostRuntime;
  allowSameProvider?: boolean;
  codexCapturePath?: string;
  model?: string;
  effort?: string;
  maxRuntimeSec?: number;
  maxOutputBytes?: number;
}

export interface ReviewPreflightInput {
  provider: ReviewTransportRequest['provider'];
  host: HostContext;
  registry: ProviderAdapterRegistry;
  probeRunner: ProbeCommandRunner;
}

export interface ReviewRunDependencies {
  env?: NodeJS.ProcessEnv;
  registry?: ProviderAdapterRegistry;
  probeRunner?: ProbeCommandRunner;
  preflight?: (input: ReviewPreflightInput) => Promise<ProviderInventoryEntry>;
  runTurn?: (
    request: ConsensusCliRunRequest,
    dependencies: RunProviderTurnDependencies,
  ) => Promise<ConsensusCliRunEnvelope>;
}

export type ReviewRunResult =
  | ReviewFoundationResult
  | {
      ok: true;
      status: 'completed';
      invocation_count: number;
      envelope: ConsensusCliRunEnvelope;
    }
  | {
      ok: false;
      status: 'preflight_failed' | 'execution_failed';
      invocation_count: number;
      reason: string;
      message: string;
      envelope?: ConsensusCliRunEnvelope;
    };

/**
 * Skill-owned provider transport seam. Scope capture and end-user CLI parsing
 * are intentionally owned by later phases; this function accepts only an
 * already-bounded prompt and invokes one eligible reviewer.
 */
export async function runReview(
  input?: ReviewTransportRequest,
  dependencies: ReviewRunDependencies = {},
): Promise<ReviewRunResult> {
  if (!input) return foundationOnly();
  if (input.provider !== 'claude' && input.provider !== 'codex') {
    return preflightFailure(
      'provider_ineligible',
      `Provider is not eligible for read-only review transport: ${String(input.provider)}.`,
    );
  }

  const env = dependencies.env ?? process.env;
  const hostResolution = resolveExplicitHostContext({
    runtime: input.host,
    cwd: input.cwd,
    env,
    maxDepth: 1,
  });
  if (!hostResolution.ok) {
    return preflightFailure(hostResolution.reason, hostResolution.message);
  }
  if (
    hostResolution.context.runtime === input.provider &&
    input.allowSameProvider !== true
  ) {
    return preflightFailure(
      'same_provider_consent_required',
      'Same-provider review requires explicit user consent.',
    );
  }

  const transport = reviewTransport(input);
  if (!transport.ok) {
    return preflightFailure(transport.reason, transport.message);
  }

  const hostGuard = evaluateHostGuard({
    host: hostResolution.context,
    provider: input.provider,
  });
  if (!hostGuard.allowed) {
    return preflightFailure('host_recursion_blocked', hostGuard.message);
  }

  const registry = dependencies.registry ?? providerRegistry();
  const probeRunner = dependencies.probeRunner ?? nodeProbeCommandRunner(env);
  const preflight = dependencies.preflight ?? defaultReviewPreflight;
  const readiness = await preflight({
    provider: input.provider,
    host: hostResolution.context,
    registry,
    probeRunner,
  });
  if (readiness.status !== 'ready') {
    return preflightFailure(
      `provider_${readiness.status}`,
      `Review provider ${input.provider} is not ready (${readiness.status}).`,
    );
  }

  const request: ConsensusCliRunRequest = {
    schema_version: 'v1',
    provider: input.provider,
    schema_path: input.schemaPath,
    prompt: input.prompt,
    cwd: input.cwd,
    host: hostResolution.context,
    runtime_policy:
      input.provider === 'claude'
        ? { permission_mode: 'read-only' }
        : {
            permission_mode: 'non-interactive',
            sandbox: 'read-only',
            approval_policy: 'never',
          },
    max_attempts: 1,
    max_runtime_sec: input.maxRuntimeSec ?? 600,
    max_output_bytes: input.maxOutputBytes ?? 1024 * 1024,
    ...(input.model ? { model: input.model } : {}),
    ...(input.effort ? { effort: input.effort } : {}),
  };
  const envelope = await (dependencies.runTurn ?? runProviderTurn)(request, {
    registry,
    parentEnv: env,
    transport: transport.options,
  });
  if (!envelope.ok) {
    return {
      ok: false,
      status: 'execution_failed',
      invocation_count: envelope.attempts.cli_attempts,
      reason: envelope.code,
      message: envelope.message,
      envelope,
    };
  }
  return {
    ok: true,
    status: 'completed',
    invocation_count: envelope.attempts.cli_attempts,
    envelope,
  };
}

async function defaultReviewPreflight(
  input: ReviewPreflightInput,
): Promise<ProviderInventoryEntry> {
  const [entry] = await probeProviderRegistry({
    registry: input.registry,
    runner: input.probeRunner,
    provider: input.provider,
    requiredCapabilities: ['run'],
  });
  if (entry) return entry;
  throw new Error(`Review provider is not registered: ${input.provider}`);
}

function reviewTransport(
  input: ReviewTransportRequest,
):
  | { ok: true; options: ProviderTurnTransportOptions }
  | { ok: false; reason: string; message: string } {
  if (input.provider === 'claude') {
    return {
      ok: true,
      options: {
        submitCaptureEnabled: false,
        strategy: 'provider_validated',
      },
    };
  }

  if (!input.codexCapturePath || !path.isAbsolute(input.codexCapturePath)) {
    return {
      ok: false,
      reason: 'capture_not_external',
      message: 'Codex review capture must be an absolute external path.',
    };
  }
  const capturePath = path.resolve(input.codexCapturePath);
  if (inside(path.resolve(input.cwd), capturePath)) {
    return {
      ok: false,
      reason: 'capture_not_external',
      message:
        'Codex review capture must remain outside the reviewed worktree.',
    };
  }
  return {
    ok: true,
    options: {
      submitCaptureEnabled: false,
      strategy: 'prompt_only',
      lastMessageFile: capturePath,
      preserveLastMessageFile: true,
    },
  };
}

function preflightFailure(reason: string, message: string): ReviewRunResult {
  return {
    ok: false,
    status: 'preflight_failed',
    invocation_count: 0,
    reason,
    message,
  };
}

function foundationOnly(): ReviewFoundationResult {
  return { ok: false, status: 'foundation_only', invocation_count: 0 };
}
