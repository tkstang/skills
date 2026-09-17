import { lstat, open, realpath, stat, unlink } from 'node:fs/promises';
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
import {
  inside,
  nearestExistingPath,
} from '../../../plugins/consensus/shared/cli-helpers-core.js';

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

  const transport = await reviewTransport(input);
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

  const claimedTransport = await claimReviewTransport(input, transport.options);
  if (!claimedTransport.ok) {
    return preflightFailure(claimedTransport.reason, claimedTransport.message);
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
    transport: claimedTransport.options,
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

async function reviewTransport(
  input: ReviewTransportRequest,
): Promise<
  | { ok: true; options: ProviderTurnTransportOptions }
  | { ok: false; reason: string; message: string }
> {
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
  const capture = await validateCodexCapture(input);
  if (!capture.ok) return capture;
  return {
    ok: true,
    options: {
      submitCaptureEnabled: false,
      strategy: 'prompt_only',
      lastMessageFile: capture.path,
      preserveLastMessageFile: true,
    },
  };
}

async function claimReviewTransport(
  input: ReviewTransportRequest,
  options: ProviderTurnTransportOptions,
): Promise<
  | { ok: true; options: ProviderTurnTransportOptions }
  | { ok: false; reason: string; message: string }
> {
  if (input.provider === 'claude') return { ok: true, options };

  const capture = await validateCodexCapture(input);
  if (!capture.ok) return capture;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(capture.path, 'wx', 0o600);
    await handle.close();
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (handle) await unlink(capture.path).catch(() => undefined);
    return captureFailure(
      'capture_destination_unsafe',
      `Codex review capture could not be claimed exclusively: ${fsMessage(error)}.`,
    );
  }

  try {
    const [info, canonical] = await Promise.all([
      lstat(capture.path),
      realpath(capture.path),
    ]);
    if (
      info.isSymbolicLink() ||
      !info.isFile() ||
      canonical !== capture.path ||
      (info.mode & 0o077) !== 0
    ) {
      await unlink(capture.path).catch(() => undefined);
      return captureFailure(
        'capture_destination_unsafe',
        'Codex review capture lost its private canonical file identity.',
      );
    }
  } catch (error) {
    await unlink(capture.path).catch(() => undefined);
    return captureFailure(
      'capture_destination_unsafe',
      `Codex review capture identity could not be verified: ${fsMessage(error)}.`,
    );
  }

  return {
    ok: true,
    options: { ...options, lastMessageFile: capture.path },
  };
}

async function validateCodexCapture(
  input: ReviewTransportRequest,
): Promise<
  { ok: true; path: string } | { ok: false; reason: string; message: string }
> {
  const capturePath = path.resolve(input.codexCapturePath!);
  let canonicalWorktree: string;
  try {
    canonicalWorktree = await realpath(input.cwd);
  } catch (error) {
    return captureFailure(
      'capture_boundary_invalid',
      `Reviewed worktree identity could not be resolved: ${fsMessage(error)}.`,
    );
  }

  let targetInfo: Awaited<ReturnType<typeof lstat>> | null = null;
  try {
    targetInfo = await lstat(capturePath);
  } catch (error) {
    if (!isMissing(error)) {
      return captureFailure(
        'capture_destination_unsafe',
        `Codex review capture could not be inspected: ${fsMessage(error)}.`,
      );
    }
  }
  if (targetInfo?.isSymbolicLink()) {
    return captureFailure(
      'capture_destination_unsafe',
      'Codex review capture must not be a symbolic link.',
    );
  }
  if (targetInfo) {
    let protectedAlias: boolean;
    try {
      protectedAlias = await aliasesProtectedInput(capturePath, input);
    } catch (error) {
      return captureFailure(
        'capture_destination_unsafe',
        `Codex review capture identity could not be compared: ${fsMessage(error)}.`,
      );
    }
    if (protectedAlias) {
      return captureFailure(
        'capture_protected_alias',
        'Codex review capture must not alias a protected review input.',
      );
    }
    return captureFailure(
      'capture_destination_unsafe',
      'Codex review capture must not already exist.',
    );
  }

  const parent = path.dirname(capturePath);
  let existing: string;
  let canonicalExisting: string;
  let existingInfo: Awaited<ReturnType<typeof lstat>>;
  try {
    existing = await nearestExistingPath(parent);
    [canonicalExisting, existingInfo] = await Promise.all([
      realpath(existing),
      lstat(existing),
    ]);
  } catch (error) {
    return captureFailure(
      'capture_destination_unsafe',
      `Codex review capture parent could not be resolved: ${fsMessage(error)}.`,
    );
  }
  if (!existingInfo.isDirectory()) {
    return captureFailure(
      'capture_destination_unsafe',
      'Codex review capture parent must be a directory.',
    );
  }

  const canonicalParent = path.resolve(
    canonicalExisting,
    path.relative(existing, parent),
  );
  const canonicalCapture = path.join(
    canonicalParent,
    path.basename(capturePath),
  );
  if (inside(canonicalWorktree, canonicalCapture)) {
    return captureFailure(
      'capture_not_external',
      'Codex review capture must remain outside the reviewed worktree.',
    );
  }
  if (
    path.resolve(existing) !== canonicalExisting ||
    path.resolve(parent) !== canonicalParent
  ) {
    return captureFailure(
      'capture_destination_unsafe',
      'Codex review capture path must not contain symbolic-link aliases.',
    );
  }
  if (path.resolve(existing) !== path.resolve(parent)) {
    return captureFailure(
      'capture_destination_unsafe',
      'Codex review capture requires an existing private run directory.',
    );
  }

  const currentUid = process.getuid?.();
  if (
    (existingInfo.mode & 0o077) !== 0 ||
    (currentUid !== undefined && existingInfo.uid !== currentUid)
  ) {
    return captureFailure(
      'capture_destination_unsafe',
      'Codex review capture run directory must be private to the current user.',
    );
  }

  let protectedPaths: string[];
  try {
    protectedPaths = await canonicalProtectedPaths(input);
  } catch (error) {
    return captureFailure(
      'capture_destination_unsafe',
      `Protected review input identity could not be resolved: ${fsMessage(error)}.`,
    );
  }
  if (protectedPaths.includes(canonicalCapture)) {
    return captureFailure(
      'capture_protected_alias',
      'Codex review capture must not alias a protected review input.',
    );
  }
  return { ok: true, path: canonicalCapture };
}

async function aliasesProtectedInput(
  capturePath: string,
  input: ReviewTransportRequest,
): Promise<boolean> {
  try {
    const captureInfo = await stat(capturePath);
    for (const protectedPath of [input.schemaPath, input.cwd]) {
      try {
        const protectedInfo = await stat(protectedPath);
        if (
          captureInfo.dev === protectedInfo.dev &&
          captureInfo.ino === protectedInfo.ino
        ) {
          return true;
        }
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  return false;
}

async function canonicalProtectedPaths(
  input: ReviewTransportRequest,
): Promise<string[]> {
  const protectedPaths: string[] = [];
  for (const protectedPath of [input.schemaPath, input.cwd]) {
    try {
      protectedPaths.push(await realpath(protectedPath));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return protectedPaths;
}

function captureFailure(reason: string, message: string) {
  return { ok: false as const, reason, message };
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function fsMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
