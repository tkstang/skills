import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, open, realpath, stat, unlink } from 'node:fs/promises';
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
import { captureScopeState, compareScopeState } from './scope.js';
import type { CapturedReviewScope, ScopeStateSnapshot } from './scope.js';
import { captureReviewScope, createReviewRunState } from './scope.js';
import type {
  ReviewScopeRequest,
  ReviewRunState,
  ScopeComparison,
} from './scope.js';
import { buildReviewPrompt, resolveReviewer } from './selection.js';
import type {
  ResolvedReviewer,
  ReviewSelectionDependencies,
} from './selection.js';

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
  scopeGuard?: {
    scope: CapturedReviewScope;
    before: ScopeStateSnapshot;
  };
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
  scanScopeState?: typeof captureScopeState;
}

export type ReviewRunResult =
  | ReviewFoundationResult
  | {
      ok: true;
      status: 'completed';
      invocation_count: number;
      envelope: Extract<ConsensusCliRunEnvelope, { ok: true }>;
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

  if (input.scopeGuard) {
    let after: ScopeStateSnapshot;
    try {
      after = await (dependencies.scanScopeState ?? captureScopeState)(
        input.scopeGuard.scope,
      );
    } catch (error) {
      return preflightFailure(
        'scope_comparison_failed',
        `Review scope could not be revalidated before dispatch: ${fsMessage(error)}.`,
      );
    }
    const comparison = compareScopeState(input.scopeGuard.before, after);
    if (!comparison.stable) {
      return preflightFailure(
        'scope_drift',
        `Review scope changed before dispatch: ${comparison.differences.join('; ')}.`,
      );
    }
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
    max_runtime_sec: input.maxRuntimeSec ?? 900,
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

export interface ReviewLocation {
  path: string;
  start_line: number;
  end_line: number;
  source_version: string;
}

export interface ReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  location?: ReviewLocation;
  anchor?: string;
  claim: string;
  evidence: string;
  suggestion: string;
  confidence: number;
}

export interface ReviewReply {
  schema_version: 'v1';
  scope_token: string;
  verdict: 'pass' | 'changes_requested' | 'inconclusive';
  summary: string;
  findings: ReviewFinding[];
  questions: string[];
  limitations: string[];
  coverage: string[];
  inspected_context: Array<{ subject: string; source_version: string }>;
  checks: Array<{
    name: string;
    status: 'passed' | 'failed' | 'not_run';
    detail?: string;
  }>;
  reviewer_identity: {
    provider: string;
    model?: string;
    effort?: string;
  };
}

export interface ExecuteReviewInput {
  cwd: string;
  scope: ReviewScopeRequest;
  host: KnownHostRuntime;
  request: string;
  hostSummary: string;
  schemaPath: string;
  reviewer?: string;
  model?: string;
  effort?: string;
  maxRuntimeSec?: number;
  allowSameProvider?: boolean;
  runId?: string;
  authoredBy?: AuthorEvidence[];
}

export interface AuthorEvidence {
  identity: string;
  evidence_source: 'detected' | 'declared' | 'unknown';
  evidence_reference: string;
  scope_coverage: 'full' | 'partial' | 'unknown';
  covered_paths: string[];
}

export interface ExecuteReviewDependencies {
  env?: NodeJS.ProcessEnv;
  selection?: ReviewSelectionDependencies;
  transport?: typeof runReview;
  transportDependencies?: ReviewRunDependencies;
  captureScope?: typeof captureReviewScope;
  scanScopeState?: typeof captureScopeState;
  createRunState?: typeof createReviewRunState;
  persist?: typeof persistPrivateJson;
}

export type ExecuteReviewResult =
  | {
      ok: true;
      status: 'empty_scope';
      invocation_count: 0;
      scope: CapturedReviewScope;
    }
  | {
      ok: true;
      status: 'completed';
      invocation_count: 1;
      artifactPath: string;
      runState: ReviewRunState;
      aggregate: ReviewAggregate;
    }
  | {
      ok: false;
      status:
        | 'predispatch_failed'
        | 'incomplete'
        | 'defective'
        | 'output_failed';
      invocation_count: number;
      reason: string;
      message: string;
      diagnosticPath?: string;
      runState?: ReviewRunState;
      drift?: ScopeComparison;
    };

export interface ReviewAggregate {
  schema_version: 'v1';
  run_id: string;
  status: 'complete';
  worktree_root: string;
  request: string;
  request_sha256: string;
  scope: CapturedReviewScope;
  reviewer: {
    selected: ResolvedReviewer['reviewer'];
    requested: {
      reviewer: string | null;
      model: string | null;
      effort: string | null;
    };
    passed: {
      provider: string;
      model: string | null;
      effort: string | null;
    };
    source: ResolvedReviewer['source'];
    skipped: ResolvedReviewer['skipped'];
    observed: {
      provider: string;
      model: string | null;
      effort: string | null;
      evidence: string;
    };
    claimed: ReviewReply['reviewer_identity'];
  };
  authored_by: AuthorEvidence[];
  diversity: {
    classification: 'unknown';
    evidence: string;
  };
  invocation_count: 1;
  policy: {
    max_depth: 1;
    max_attempts: 1;
    read_only: true;
    repair: false;
    fallback_after_dispatch: false;
  };
  drift: ScopeComparison;
  validation: { ok: true };
  reply: ReviewReply;
  paths: {
    run_directory: string;
    request: string;
    evidence: string;
    result: string;
  };
}

export async function executeBoundedReview(
  input: ExecuteReviewInput,
  dependencies: ExecuteReviewDependencies = {},
): Promise<ExecuteReviewResult> {
  const env = dependencies.env ?? process.env;
  let scope: CapturedReviewScope;
  try {
    scope = await (dependencies.captureScope ?? captureReviewScope)({
      cwd: input.cwd,
      request: input.scope,
    });
  } catch (error) {
    return executeFailure(
      'predispatch_failed',
      0,
      'scope_capture_failed',
      fsMessage(error),
    );
  }
  if (
    scope.selectedPaths.length === 0 &&
    scope.externalDocuments.length === 0
  ) {
    return { ok: true, status: 'empty_scope', invocation_count: 0, scope };
  }
  let authoredBy: AuthorEvidence[];
  try {
    authoredBy = normalizeAuthorEvidence(input.authoredBy, scope);
  } catch (error) {
    return executeFailure(
      'predispatch_failed',
      0,
      'author_evidence_invalid',
      fsMessage(error),
    );
  }

  let runState: ReviewRunState;
  try {
    runState = await (dependencies.createRunState ?? createReviewRunState)({
      cwd: scope.canonicalWorktree,
      env,
      ...(input.runId ? { runId: input.runId } : {}),
    });
  } catch (error) {
    return executeFailure(
      'predispatch_failed',
      0,
      'state_creation_failed',
      fsMessage(error),
    );
  }

  const requestPath = path.join(runState.runDirectory, 'request.txt');
  const evidencePath = path.join(runState.runDirectory, 'evidence.json');
  const resultPath = path.join(runState.runDirectory, 'result.json');
  const diagnosticPath = path.join(runState.runDirectory, 'diagnostic.json');
  const persist = dependencies.persist ?? persistPrivateJson;
  try {
    await persist(requestPath, input.request);
    await persist(evidencePath, scope);
  } catch (error) {
    return executeFailure(
      'output_failed',
      0,
      'capture_persistence_failed',
      fsMessage(error),
      { runState },
    );
  }

  const scanScope = dependencies.scanScopeState ?? captureScopeState;
  let before: ScopeStateSnapshot;
  try {
    before = await scanScope(scope);
  } catch (error) {
    return await persistDiagnosticFailure({
      status: 'predispatch_failed',
      invocationCount: 0,
      reason: 'before_scan_failed',
      message: fsMessage(error),
      runState,
      diagnosticPath,
      persist,
    });
  }
  const captureToBaseline = compareScopeState(scope.captureState, before);
  if (!captureToBaseline.stable) {
    return await persistDiagnosticFailure({
      status: 'predispatch_failed',
      invocationCount: 0,
      reason: 'captured_scope_drift',
      message: captureToBaseline.differences.join('; '),
      runState,
      diagnosticPath,
      drift: captureToBaseline,
      persist,
    });
  }

  let selected: ResolvedReviewer;
  try {
    selected = await resolveReviewer(
      {
        cwd: scope.canonicalWorktree,
        host: input.host,
        env,
        ...(input.reviewer ? { reviewer: input.reviewer } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.effort ? { effort: input.effort } : {}),
        ...(input.allowSameProvider
          ? { allowSameProvider: input.allowSameProvider }
          : {}),
      },
      dependencies.selection,
    );
  } catch (error) {
    return await persistDiagnosticFailure({
      status: 'predispatch_failed',
      invocationCount: 0,
      reason: 'reviewer_selection_failed',
      message: fsMessage(error),
      runState,
      diagnosticPath,
      persist,
    });
  }

  let prompt: string;
  try {
    prompt = buildReviewPrompt({
      request: input.request,
      hostSummary: input.hostSummary,
      scope,
      evidencePath,
      requestPath,
    });
  } catch (error) {
    return await persistDiagnosticFailure({
      status: 'predispatch_failed',
      invocationCount: 0,
      reason: 'prompt_build_failed',
      message: fsMessage(error),
      runState,
      diagnosticPath,
      persist,
    });
  }

  const transport = dependencies.transport ?? runReview;
  const transportResult = await transport(
    {
      provider: selected.reviewer.provider as 'claude' | 'codex',
      prompt,
      schemaPath: input.schemaPath,
      cwd: scope.canonicalWorktree,
      host: input.host,
      allowSameProvider: selected.allowSameProvider,
      ...(selected.reviewer.model ? { model: selected.reviewer.model } : {}),
      ...(selected.reviewer.effort ? { effort: selected.reviewer.effort } : {}),
      ...(input.maxRuntimeSec !== undefined
        ? { maxRuntimeSec: input.maxRuntimeSec }
        : {}),
      ...(selected.reviewer.provider === 'codex'
        ? {
            codexCapturePath: path.join(
              runState.runDirectory,
              'last-message.json',
            ),
          }
        : {}),
      scopeGuard: { scope, before },
    },
    {
      ...dependencies.transportDependencies,
      env,
      scanScopeState: scanScope,
      preflight: async () => selected.readiness,
    },
  );

  let drift: ScopeComparison;
  try {
    drift = compareScopeState(before, await scanScope(scope));
  } catch (error) {
    drift = compareScopeState(before, toError(error));
  }

  if (!transportResult.ok) {
    const reason =
      transportResult.status === 'foundation_only'
        ? 'foundation_only'
        : transportResult.reason;
    const message =
      transportResult.status === 'foundation_only'
        ? 'Review transport was not configured.'
        : transportResult.message;
    return await persistDiagnosticFailure({
      status:
        transportResult.status === 'preflight_failed'
          ? 'predispatch_failed'
          : 'incomplete',
      invocationCount: transportResult.invocation_count,
      reason,
      message,
      runState,
      diagnosticPath,
      drift,
      persist,
    });
  }
  if (transportResult.invocation_count !== 1) {
    return await persistDiagnosticFailure({
      status: 'defective',
      invocationCount: transportResult.invocation_count,
      reason: 'invocation_count_invalid',
      message:
        'A completed review must contain exactly one provider invocation.',
      runState,
      diagnosticPath,
      drift,
      persist,
    });
  }
  if (!drift.checked || !drift.stable) {
    return await persistDiagnosticFailure({
      status: 'defective',
      invocationCount: 1,
      reason: drift.checked ? 'scope_drift' : 'scope_comparison_failed',
      message: drift.differences.join('; '),
      runState,
      diagnosticPath,
      drift,
      persist,
    });
  }

  const validation = validateReviewReply(transportResult.envelope.json, scope);
  if (!validation.ok) {
    return await persistDiagnosticFailure({
      status: 'defective',
      invocationCount: 1,
      reason: 'invalid_review_reply',
      message: validation.errors.join('; '),
      runState,
      diagnosticPath,
      drift,
      persist,
    });
  }

  const aggregate: ReviewAggregate = {
    schema_version: 'v1',
    run_id: runState.runId,
    status: 'complete',
    worktree_root: scope.canonicalWorktree,
    request: input.request,
    request_sha256: sha256(input.request),
    scope,
    reviewer: {
      selected: selected.reviewer,
      requested: {
        reviewer: input.reviewer ?? null,
        model: input.model ?? null,
        effort: input.effort ?? null,
      },
      passed: {
        provider: selected.reviewer.provider,
        model: selected.reviewer.model ?? null,
        effort: selected.reviewer.effort ?? null,
      },
      source: selected.source,
      skipped: selected.skipped,
      observed: {
        provider: String(transportResult.envelope.provider),
        model: null,
        effort: null,
        evidence:
          'The provider envelope identifies the provider only; model and effort were not independently observed.',
      },
      claimed: validation.value.reviewer_identity,
    },
    authored_by: authoredBy,
    diversity: {
      classification: 'unknown',
      evidence:
        'Provider selection alone does not establish a different model family.',
    },
    invocation_count: 1,
    policy: {
      max_depth: 1,
      max_attempts: 1,
      read_only: true,
      repair: false,
      fallback_after_dispatch: false,
    },
    drift,
    validation: { ok: true },
    reply: validation.value,
    paths: {
      run_directory: runState.runDirectory,
      request: requestPath,
      evidence: evidencePath,
      result: resultPath,
    },
  };
  try {
    await persist(resultPath, aggregate);
  } catch (error) {
    return await persistDiagnosticFailure({
      status: 'output_failed',
      invocationCount: 1,
      reason: 'result_persistence_failed',
      message: fsMessage(error),
      runState,
      diagnosticPath,
      drift,
      persist,
    });
  }
  return {
    ok: true,
    status: 'completed',
    invocation_count: 1,
    artifactPath: resultPath,
    runState,
    aggregate,
  };
}

export function validateReviewReply(
  value: unknown,
  scope: CapturedReviewScope,
): { ok: true; value: ReviewReply } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['reply must be an object'] };
  }
  assertKeys(
    value,
    [
      'schema_version',
      'scope_token',
      'verdict',
      'summary',
      'findings',
      'questions',
      'limitations',
      'coverage',
      'inspected_context',
      'checks',
      'reviewer_identity',
    ],
    'reply',
    errors,
  );
  requireEqual(value.schema_version, 'v1', 'reply.schema_version', errors);
  requireEqual(value.scope_token, scope.token, 'reply.scope_token', errors);
  requireEnum(
    value.verdict,
    ['pass', 'changes_requested', 'inconclusive'],
    'reply.verdict',
    errors,
  );
  requireString(value.summary, 'reply.summary', 1, 8192, errors);
  const findings = validateFindings(value.findings, scope, errors);
  validateStringArray(value.questions, 'reply.questions', 50, 4096, errors);
  validateStringArray(value.limitations, 'reply.limitations', 50, 4096, errors);
  validateStringArray(value.coverage, 'reply.coverage', 200, 4096, errors);
  validateInspectedContext(value.inspected_context, errors);
  validateChecks(value.checks, errors);
  validateReviewerIdentity(value.reviewer_identity, errors);

  const blockingFindings = findings.filter(
    (finding) => finding.severity === 'critical' || finding.severity === 'high',
  );
  const failedChecks = Array.isArray(value.checks)
    ? value.checks.some((check) => isRecord(check) && check.status === 'failed')
    : false;
  if (
    value.verdict === 'pass' &&
    (blockingFindings.length > 0 || failedChecks)
  ) {
    errors.push(
      'reply.verdict pass forbids critical/high findings and failed checks',
    );
  }
  if (value.verdict === 'changes_requested' && blockingFindings.length === 0) {
    errors.push(
      'reply.verdict changes_requested requires a critical or high finding',
    );
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as unknown as ReviewReply };
}

async function persistDiagnosticFailure(input: {
  status: 'predispatch_failed' | 'incomplete' | 'defective' | 'output_failed';
  invocationCount: number;
  reason: string;
  message: string;
  runState: ReviewRunState;
  diagnosticPath: string;
  persist: typeof persistPrivateJson;
  drift?: ScopeComparison;
}): Promise<ExecuteReviewResult> {
  const diagnostic = {
    schema_version: 'v1',
    status: input.status,
    invocation_count: input.invocationCount,
    reason: input.reason,
    message: input.message,
    ...(input.drift ? { drift: input.drift } : {}),
  };
  try {
    await input.persist(input.diagnosticPath, diagnostic);
  } catch (error) {
    const diagnosticError = fsMessage(error);
    if (input.reason === 'result_persistence_failed') {
      return executeFailure(
        'output_failed',
        input.invocationCount,
        'result_and_diagnostic_persistence_failed',
        `Result persistence failed: ${input.message}; diagnostic persistence failed: ${diagnosticError}`,
        { runState: input.runState, drift: input.drift },
      );
    }
    return executeFailure(
      'output_failed',
      input.invocationCount,
      'diagnostic_persistence_failed',
      fsMessage(error),
      { runState: input.runState, drift: input.drift },
    );
  }
  return executeFailure(
    input.status,
    input.invocationCount,
    input.reason,
    input.message,
    {
      runState: input.runState,
      diagnosticPath: input.diagnosticPath,
      drift: input.drift,
    },
  );
}

function normalizeAuthorEvidence(
  input: AuthorEvidence[] | undefined,
  scope: CapturedReviewScope,
): AuthorEvidence[] {
  if (input === undefined || (Array.isArray(input) && input.length === 0)) {
    return [
      {
        identity: 'unknown',
        evidence_source: 'unknown',
        evidence_reference: 'No bounded author evidence was supplied.',
        scope_coverage: 'unknown',
        covered_paths: [],
      },
    ];
  }
  if (!Array.isArray(input) || input.length > 50) {
    throw new Error('author evidence must contain between 1 and 50 entries');
  }
  const scopePaths = [...scope.selectedPaths, ...scope.externalDocuments];
  const allowedPaths = new Set(scopePaths);
  return input.map((entry, index) => {
    const label = `author evidence[${index}]`;
    if (!isRecord(entry)) throw new Error(`${label} must be an object`);
    const errors: string[] = [];
    assertKeys(
      entry,
      [
        'identity',
        'evidence_source',
        'evidence_reference',
        'scope_coverage',
        'covered_paths',
      ],
      label,
      errors,
    );
    requireString(entry.identity, `${label}.identity`, 1, 256, errors);
    requireEnum(
      entry.evidence_source,
      ['detected', 'declared', 'unknown'],
      `${label}.evidence_source`,
      errors,
    );
    requireString(
      entry.evidence_reference,
      `${label}.evidence_reference`,
      1,
      4096,
      errors,
    );
    requireEnum(
      entry.scope_coverage,
      ['full', 'partial', 'unknown'],
      `${label}.scope_coverage`,
      errors,
    );
    validateStringArray(
      entry.covered_paths,
      `${label}.covered_paths`,
      100,
      4096,
      errors,
    );
    const coveredPaths = Array.isArray(entry.covered_paths)
      ? entry.covered_paths.filter(
          (candidate): candidate is string => typeof candidate === 'string',
        )
      : [];
    if (new Set(coveredPaths).size !== coveredPaths.length) {
      errors.push(`${label}.covered_paths must not contain duplicates`);
    }
    for (const coveredPath of coveredPaths) {
      if (!allowedPaths.has(coveredPath)) {
        errors.push(`${label}.covered_paths contains an out-of-scope path`);
      }
    }
    if (entry.evidence_source === 'unknown') {
      if (entry.identity !== 'unknown') {
        errors.push(`${label}.identity must be unknown for unknown evidence`);
      }
      if (entry.scope_coverage !== 'unknown' || coveredPaths.length !== 0) {
        errors.push(
          `${label} unknown evidence must have unknown coverage and no covered paths`,
        );
      }
    } else if (entry.identity === 'unknown') {
      errors.push(`${label}.identity must name detected or declared evidence`);
    }
    if (entry.scope_coverage === 'unknown' && coveredPaths.length !== 0) {
      errors.push(`${label} unknown coverage must not list covered paths`);
    }
    if (entry.scope_coverage === 'partial') {
      if (coveredPaths.length === 0) {
        errors.push(
          `${label} partial coverage must identify at least one scoped path`,
        );
      }
    }
    if (
      entry.scope_coverage === 'full' &&
      (coveredPaths.length !== scopePaths.length ||
        scopePaths.some((scopePath) => !coveredPaths.includes(scopePath)))
    ) {
      errors.push(`${label} full coverage must identify every scoped path`);
    }
    if (errors.length > 0) throw new Error(errors.join('; '));
    return {
      identity: entry.identity,
      evidence_source: entry.evidence_source,
      evidence_reference: entry.evidence_reference,
      scope_coverage: entry.scope_coverage,
      covered_paths: [...coveredPaths],
    } as AuthorEvidence;
  });
}

function executeFailure(
  status: Extract<ExecuteReviewResult, { ok: false }>['status'],
  invocationCount: number,
  reason: string,
  message: string,
  details: {
    diagnosticPath?: string;
    runState?: ReviewRunState;
    drift?: ScopeComparison;
  } = {},
): ExecuteReviewResult {
  return {
    ok: false,
    status,
    invocation_count: invocationCount,
    reason,
    message,
    ...details,
  };
}

async function persistPrivateJson(
  targetPath: string,
  value: unknown,
): Promise<void> {
  const contents =
    typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  const temporary = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporary, targetPath);
    await unlink(temporary);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function validateFindings(
  value: unknown,
  scope: CapturedReviewScope,
  errors: string[],
): ReviewFinding[] {
  if (!Array.isArray(value)) {
    errors.push('reply.findings must be an array');
    return [];
  }
  if (value.length > 100) errors.push('reply.findings exceeds 100 items');
  const findings: ReviewFinding[] = [];
  value.slice(0, 100).forEach((candidate, index) => {
    const label = `reply.findings[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${label} must be an object`);
      return;
    }
    assertKeys(
      candidate,
      [
        'severity',
        'title',
        'location',
        'anchor',
        'claim',
        'evidence',
        'suggestion',
        'confidence',
      ],
      label,
      errors,
    );
    requireEnum(
      candidate.severity,
      ['critical', 'high', 'medium', 'low'],
      `${label}.severity`,
      errors,
    );
    requireString(candidate.title, `${label}.title`, 1, 512, errors);
    requireString(candidate.claim, `${label}.claim`, 1, 8192, errors);
    requireString(candidate.evidence, `${label}.evidence`, 1, 8192, errors);
    requireString(candidate.suggestion, `${label}.suggestion`, 1, 8192, errors);
    if (
      typeof candidate.confidence !== 'number' ||
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      errors.push(`${label}.confidence must be finite and between 0 and 1`);
    }
    const hasLocation = candidate.location !== undefined;
    const hasAnchor = candidate.anchor !== undefined;
    if (hasLocation === hasAnchor) {
      errors.push(`${label} must contain exactly one of location or anchor`);
    }
    if (hasLocation) validateLocation(candidate.location, scope, label, errors);
    if (hasAnchor) {
      requireString(candidate.anchor, `${label}.anchor`, 1, 1024, errors);
      if (scope.externalDocuments.length === 0) {
        errors.push(`${label}.anchor requires an external document scope`);
      }
    }
    findings.push(candidate as unknown as ReviewFinding);
  });
  return findings;
}

function validateLocation(
  value: unknown,
  scope: CapturedReviewScope,
  findingLabel: string,
  errors: string[],
): void {
  const label = `${findingLabel}.location`;
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  assertKeys(
    value,
    ['path', 'start_line', 'end_line', 'source_version'],
    label,
    errors,
  );
  requireString(value.path, `${label}.path`, 1, 4096, errors);
  requireString(
    value.source_version,
    `${label}.source_version`,
    1,
    256,
    errors,
  );
  if (
    typeof value.path !== 'string' ||
    path.isAbsolute(value.path) ||
    value.path.split('/').includes('..') ||
    !scope.selectedPaths.includes(value.path)
  ) {
    errors.push(`${label}.path must be a complete selected repository path`);
  }
  if (!isPositiveInteger(value.start_line)) {
    errors.push(`${label}.start_line must be a positive integer`);
  }
  if (!isPositiveInteger(value.end_line)) {
    errors.push(`${label}.end_line must be a positive integer`);
  }
  if (
    isPositiveInteger(value.start_line) &&
    isPositiveInteger(value.end_line) &&
    value.end_line < value.start_line
  ) {
    errors.push(
      `${label}.end_line must be greater than or equal to start_line`,
    );
  }
  const version = scope.versions.find(
    (entry) =>
      entry.path === value.path && entry.sha256 === value.source_version,
  );
  if (
    !version ||
    (version.kind !== 'file' && version.kind !== 'symlink') ||
    version.text === null
  ) {
    errors.push(`${label}.source_version must identify captured bytes`);
    return;
  }
  const lineCount =
    version.text.length === 0 ? 1 : version.text.split('\n').length;
  if (isPositiveInteger(value.end_line) && value.end_line > lineCount) {
    errors.push(`${label}.end_line exceeds captured source lines`);
  }
}

function validateInspectedContext(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push('reply.inspected_context must be an array');
    return;
  }
  if (value.length > 200) {
    errors.push('reply.inspected_context exceeds 200 items');
  }
  value.slice(0, 200).forEach((candidate, index) => {
    const label = `reply.inspected_context[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${label} must be an object`);
      return;
    }
    assertKeys(candidate, ['subject', 'source_version'], label, errors);
    requireString(candidate.subject, `${label}.subject`, 1, 4096, errors);
    requireString(
      candidate.source_version,
      `${label}.source_version`,
      1,
      256,
      errors,
    );
  });
}

function validateChecks(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push('reply.checks must be an array');
    return;
  }
  if (value.length > 100) errors.push('reply.checks exceeds 100 items');
  value.slice(0, 100).forEach((candidate, index) => {
    const label = `reply.checks[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${label} must be an object`);
      return;
    }
    assertKeys(candidate, ['name', 'status', 'detail'], label, errors);
    requireString(candidate.name, `${label}.name`, 1, 512, errors);
    requireEnum(
      candidate.status,
      ['passed', 'failed', 'not_run'],
      `${label}.status`,
      errors,
    );
    if (candidate.detail !== undefined) {
      requireString(candidate.detail, `${label}.detail`, 0, 4096, errors);
    }
  });
}

function validateReviewerIdentity(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('reply.reviewer_identity must be an object');
    return;
  }
  assertKeys(
    value,
    ['provider', 'model', 'effort'],
    'reply.reviewer_identity',
    errors,
  );
  requireString(
    value.provider,
    'reply.reviewer_identity.provider',
    1,
    128,
    errors,
  );
  if (value.model !== undefined) {
    requireString(value.model, 'reply.reviewer_identity.model', 1, 256, errors);
  }
  if (value.effort !== undefined) {
    requireString(
      value.effort,
      'reply.reviewer_identity.effort',
      1,
      128,
      errors,
    );
  }
}

function validateStringArray(
  value: unknown,
  label: string,
  maxItems: number,
  maxLength: number,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.length > maxItems)
    errors.push(`${label} exceeds ${maxItems} items`);
  value
    .slice(0, maxItems)
    .forEach((entry, index) =>
      requireString(entry, `${label}[${index}]`, 1, maxLength, errors),
    );
}

function assertKeys(
  value: Record<string, unknown>,
  keys: string[],
  label: string,
  errors: string[],
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} has unknown key: ${key}`);
  }
  for (const key of keys) {
    if (
      !['location', 'anchor', 'detail', 'model', 'effort'].includes(key) &&
      !(key in value)
    ) {
      errors.push(`${label} is missing required key: ${key}`);
    }
  }
}

function requireString(
  value: unknown,
  label: string,
  minLength: number,
  maxLength: number,
  errors: string[],
): void {
  if (
    typeof value !== 'string' ||
    value.length < minLength ||
    value.length > maxLength
  ) {
    errors.push(
      `${label} must be a string between ${minLength} and ${maxLength} characters`,
    );
  }
}

function requireEnum(
  value: unknown,
  allowed: readonly string[],
  label: string,
  errors: string[],
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    errors.push(`${label} must be one of ${allowed.join(', ')}`);
  }
}

function requireEqual(
  value: unknown,
  expected: string,
  label: string,
  errors: string[],
): void {
  if (value !== expected) errors.push(`${label} must equal ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
