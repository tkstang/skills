import { createHash } from 'node:crypto';

import {
  buildNativeInvocation,
  PROVIDER_BEHAVIOR_CONTRACTS,
  sha256Canonical,
} from './behavior-contracts.js';
import { compareQualifiedSessionIds } from './discovery.js';
import {
  parseBatchOutcome,
  parseQualifiedSessionId,
  type BatchOutcome,
  type CapabilityProbe,
  type ContinuityMode,
  type GitWorktreeEvidence,
  type HandoffPlan,
  type HandoffPlanItem,
  type HandoffProvider,
  type HandoffReasonCode,
  type ItemOutcome,
  type NativeInvocation,
  type ProviderBehaviorContract,
  type QualifiedSessionId,
  type ReportingOutcome,
  type SessionCandidate,
} from './types.js';

export type HandoffPolicyFailure =
  | 'duplicate-session'
  | 'invalid-selection'
  | 'unknown-session'
  | 'repository-mismatch'
  | 'same-worktree'
  | 'plan-stale';

export class HandoffPolicyError extends Error {
  readonly code: HandoffPolicyFailure;

  constructor(code: HandoffPolicyFailure) {
    super(code);
    this.name = 'HandoffPolicyError';
    this.code = code;
  }
}

export interface HandoffSelection {
  sessions?: readonly QualifiedSessionId[];
  all?: boolean;
}

export interface CreateHandoffPlanInput {
  source: GitWorktreeEvidence;
  target: GitWorktreeEvidence;
  candidates: readonly SessionCandidate[];
  targetBaselineIds: readonly QualifiedSessionId[];
  selection: HandoffSelection;
  mode: ContinuityMode;
  capabilities: readonly CapabilityProbe[];
  contracts?: Readonly<Record<HandoffProvider, ProviderBehaviorContract>>;
  writerClosedKeys?: ReadonlySet<QualifiedSessionId>;
  uuidFactory?: () => string;
}

export function selectHandoffCandidates(
  candidates: readonly SessionCandidate[],
  selection: HandoffSelection,
): SessionCandidate[] {
  const sessions = selection.sessions ?? [];
  if (
    selection.all === true
      ? sessions.length > 0
      : selection.all !== undefined || sessions.length === 0
  ) {
    throw new HandoffPolicyError('invalid-selection');
  }
  const byKey = new Map(
    candidates.map((candidate) => [candidate.key, candidate]),
  );
  const selectedKeys =
    selection.all === true ? [...byKey.keys()] : [...sessions];
  if (selectedKeys.length === 0) {
    throw new HandoffPolicyError('invalid-selection');
  }
  const parsed: QualifiedSessionId[] = [];
  for (const key of selectedKeys) {
    try {
      parsed.push(parseQualifiedSessionId(key));
    } catch {
      throw new HandoffPolicyError('invalid-selection');
    }
  }
  if (new Set(parsed).size !== parsed.length) {
    throw new HandoffPolicyError('duplicate-session');
  }
  const result = parsed.map((key) => {
    const candidate = byKey.get(key);
    if (candidate === undefined)
      throw new HandoffPolicyError('unknown-session');
    return candidate;
  });
  return result.toSorted((left, right) =>
    compareQualifiedSessionIds(left.key, right.key),
  );
}

function capabilityReason(
  capability: CapabilityProbe | undefined,
): HandoffReasonCode | undefined {
  if (capability === undefined || capability.status === 'missing') {
    return 'provider-missing';
  }
  if (capability.status === 'version-drift') return 'provider-version-drift';
  if (capability.status === 'help-shape-drift') {
    return 'provider-help-shape-drift';
  }
  if (capability.status === 'execution-context-unreadable') {
    return 'provider-execution-context-unreadable';
  }
  if (capability.status === 'execution-context-drift') {
    return 'provider-execution-context-drift';
  }
  if (capability.status === 'probe-failed') return 'provider-probe-failed';
  return undefined;
}

function contractReasons(
  capability: CapabilityProbe | undefined,
  contract: ProviderBehaviorContract,
  mode: ContinuityMode,
): HandoffReasonCode[] {
  if (capability === undefined || capability.status !== 'syntax-verified')
    return [];
  const reasons: HandoffReasonCode[] = [];
  if (
    capability.detectedVersion !== contract.exactVersion ||
    capability.verifiedSyntaxVersion !== contract.exactVersion
  ) {
    reasons.push('provider-version-drift');
  }
  if (capability.contractFingerprint !== contract.syntaxFingerprint) {
    reasons.push('provider-help-shape-drift');
  }
  if (
    capability.executionContextFingerprint !==
    contract.executionContextFingerprint
  ) {
    reasons.push('provider-execution-context-drift');
  }
  if (mode === 'resume' || contract.successor.status !== 'verified') {
    reasons.push('behavior-unverified');
  }
  return reasons;
}

function deterministicClaudeChildId(
  candidate: SessionCandidate,
  source: GitWorktreeEvidence,
  target: GitWorktreeEvidence,
): string {
  const hex = createHash('sha256')
    .update(
      sha256Canonical({
        provider: 'claude',
        parentNativeId: candidate.nativeId,
        source: [source.worktreeRoot, source.head, source.statusFingerprint],
        target: [target.worktreeRoot, target.head, target.statusFingerprint],
      }),
    )
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function gitDigestProjection(evidence: GitWorktreeEvidence) {
  return {
    canonicalPath: evidence.canonicalPath,
    worktreeRoot: evidence.worktreeRoot,
    commonGitDir: evidence.commonGitDir,
    branch: evidence.branch,
    head: evidence.head,
    dirty: evidence.dirty,
    statusFingerprint: evidence.statusFingerprint,
  };
}

function planDigestProjection(
  input: CreateHandoffPlanInput,
  selected: readonly SessionCandidate[],
  capabilities: readonly CapabilityProbe[],
  contracts: Readonly<Record<HandoffProvider, ProviderBehaviorContract>>,
  items: readonly HandoffPlanItem[],
) {
  return {
    schemaVersion: 1,
    source: gitDigestProjection(input.source),
    target: gitDigestProjection(input.target),
    selected: selected.map((candidate) => candidate.key),
    candidateSignatures: selected.map((candidate) => ({
      key: candidate.key,
      recordedCwd: candidate.recordedCwd,
      modifiedAtMs: candidate.modifiedAtMs,
      size: candidate.size,
      engagement: candidate.engagement,
      currentEvidence: candidate.currentEvidence,
    })),
    targetBaselineIds: [...input.targetBaselineIds].toSorted(),
    mode: input.mode,
    capabilities,
    contracts: [...new Set(selected.map((candidate) => candidate.provider))]
      .toSorted()
      .map((provider) => contracts[provider]),
    items,
  };
}

/** Construct the complete mutation-relevant plan and stable confirmation digest. */
export function createHandoffPlan(input: CreateHandoffPlanInput): HandoffPlan {
  if (input.source.worktreeRoot === input.target.worktreeRoot) {
    throw new HandoffPolicyError('same-worktree');
  }
  if (input.source.commonGitDir !== input.target.commonGitDir) {
    throw new HandoffPolicyError('repository-mismatch');
  }
  const selected = selectHandoffCandidates(input.candidates, input.selection);
  const capabilities = [...input.capabilities].toSorted((left, right) =>
    left.provider < right.provider
      ? -1
      : left.provider > right.provider
        ? 1
        : 0,
  );
  const capabilityByProvider = new Map(
    capabilities.map((capability) => [capability.provider, capability]),
  );
  const contracts = input.contracts ?? PROVIDER_BEHAVIOR_CONTRACTS;
  const items = selected.map((candidate): HandoffPlanItem => {
    const capability = capabilityByProvider.get(candidate.provider);
    const reasons: HandoffReasonCode[] = [];
    if (input.source.dirty) reasons.push('source-dirty');
    if (candidate.currentEvidence !== 'none')
      reasons.push('current-turn-active');
    const writerStateUnknown =
      input.mode === 'resume' && !input.writerClosedKeys?.has(candidate.key);
    if (writerStateUnknown) {
      reasons.push('resume-writer-state-unknown');
    }
    if (!writerStateUnknown) {
      const probeReason = capabilityReason(capability);
      if (probeReason !== undefined) reasons.push(probeReason);
      reasons.push(
        ...contractReasons(
          capability,
          contracts[candidate.provider],
          input.mode,
        ),
      );
    }
    const uniqueReasons = [...new Set(reasons)];
    const refused = uniqueReasons.some((reason) =>
      ['source-dirty', 'resume-writer-state-unknown'].includes(reason),
    );
    const disposition =
      uniqueReasons.length === 0 ? 'ready' : refused ? 'refused' : 'deferred';
    const expectedChildNativeId =
      candidate.provider === 'claude' && input.mode === 'successor'
        ? (input.uuidFactory?.() ??
          deterministicClaudeChildId(candidate, input.source, input.target))
        : undefined;
    const invocation =
      disposition === 'ready'
        ? buildNativeInvocation(
            candidate.provider,
            candidate.nativeId,
            input.target.worktreeRoot,
            expectedChildNativeId,
          )
        : undefined;
    return {
      key: candidate.key,
      parentNativeId: candidate.nativeId,
      provider: candidate.provider,
      mode: input.mode,
      disposition,
      reasonCodes: uniqueReasons,
      ...(expectedChildNativeId === undefined ? {} : { expectedChildNativeId }),
      ...(invocation === undefined ? {} : { invocation }),
    };
  });
  const confirmationDigest = sha256Canonical(
    planDigestProjection(input, selected, capabilities, contracts, items),
  );
  return {
    schemaVersion: 1,
    source: input.source,
    target: input.target,
    selected: selected.map((candidate) => candidate.key),
    baselineTargetIds: [...input.targetBaselineIds].toSorted(),
    capabilities,
    items,
    confirmationDigest,
  };
}

export interface NativeExecutionResult {
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  beforeChildCreationProven?: boolean;
}

export interface ReconcileEvidenceRequest {
  provider: HandoffProvider;
  parentNativeId: string;
  expectedChildNativeId?: string;
  observedChildNativeId?: string;
  targetBaselineIds: QualifiedSessionId[];
}

export type ReconcileEvidenceResult =
  | { status: 'mapped' }
  | {
      status: 'ambiguous';
      reasonCode: 'child-ambiguous';
      candidateChildIds?: string[];
    }
  | {
      status: 'unresolved' | 'failed';
      reasonCode: 'child-unresolved' | 'reporting-failed';
      candidateChildIds?: string[];
    };

export interface ExecuteHandoffPlanInput {
  confirmedDigest: string;
  rebuildPlan: () => Promise<HandoffPlan>;
  run: (invocation: NativeInvocation) => Promise<NativeExecutionResult>;
  corroborate: (
    request: ReconcileEvidenceRequest,
  ) => Promise<ReconcileEvidenceResult>;
}

function parseObservedChildId(
  provider: HandoffProvider,
  output: string,
): string | undefined {
  if (Buffer.byteLength(output) > 65_536) return undefined;
  const values: string[] = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const record = value as Record<string, unknown>;
    const observed =
      provider === 'codex' && record.type === 'thread.started'
        ? record.thread_id
        : provider === 'claude'
          ? record.session_id
          : undefined;
    if (typeof observed === 'string' && observed.length > 0)
      values.push(observed);
  }
  return new Set(values).size === 1 ? values[0] : undefined;
}

function reportingFromEvidence(
  evidence: ReconcileEvidenceResult,
  childNativeId: string,
): ReportingOutcome {
  if (evidence.status === 'mapped') {
    return {
      status: 'mapped',
      childNativeId,
      evidence: 'machine-output-and-transcript',
    };
  }
  return {
    status: evidence.status,
    reasonCode: evidence.reasonCode,
    ...(evidence.candidateChildIds === undefined
      ? {}
      : { candidateChildIds: evidence.candidateChildIds }),
  };
}

async function executeReadyItem(
  plan: HandoffPlan,
  item: HandoffPlanItem,
  input: ExecuteHandoffPlanInput,
): Promise<ItemOutcome> {
  const result = await input.run(item.invocation!);
  const observedChildNativeId = parseObservedChildId(
    item.provider,
    result.stdout,
  );
  const selectorMismatch =
    observedChildNativeId !== undefined &&
    item.expectedChildNativeId !== undefined &&
    observedChildNativeId !== item.expectedChildNativeId;
  const request: ReconcileEvidenceRequest = {
    provider: item.provider,
    parentNativeId: item.parentNativeId,
    ...(item.expectedChildNativeId === undefined
      ? {}
      : { expectedChildNativeId: item.expectedChildNativeId }),
    ...(observedChildNativeId === undefined ? {} : { observedChildNativeId }),
    targetBaselineIds: [...plan.baselineTargetIds],
  };
  const base = {
    key: item.key,
    parentNativeId: item.parentNativeId,
    targetBaselineIds: [...plan.baselineTargetIds],
    ...(item.expectedChildNativeId === undefined
      ? {}
      : { expectedChildNativeId: item.expectedChildNativeId }),
    ...(observedChildNativeId === undefined ? {} : { observedChildNativeId }),
  };

  if (result.exitCode === 0 && observedChildNativeId !== undefined) {
    const evidence = selectorMismatch
      ? ({ status: 'unresolved', reasonCode: 'child-unresolved' } as const)
      : await input.corroborate(request);
    return {
      ...base,
      native: { status: 'succeeded', retryable: false, exitCode: 0 },
      reporting: reportingFromEvidence(evidence, observedChildNativeId),
    } as ItemOutcome;
  }

  if (
    observedChildNativeId === undefined &&
    result.beforeChildCreationProven === true
  ) {
    return {
      ...base,
      native: {
        status: 'failed',
        retryable: true,
        failureBoundary: 'before-child-creation',
        exitCode: result.exitCode,
        ...(result.signal === undefined ? {} : { signal: result.signal }),
        reasonCode: 'native-failed-before-child',
      },
      reporting: { status: 'not-attempted' },
    } as ItemOutcome;
  }

  const evidence =
    observedChildNativeId === undefined || selectorMismatch
      ? ({ status: 'unresolved', reasonCode: 'child-unresolved' } as const)
      : await input.corroborate(request);
  return {
    ...base,
    native: {
      status: 'indeterminate',
      retryable: false,
      exitCode: result.exitCode,
      ...(result.signal === undefined ? {} : { signal: result.signal }),
      reasonCode: 'native-indeterminate',
    },
    reporting: reportingFromEvidence(
      evidence,
      observedChildNativeId ?? item.expectedChildNativeId ?? 'unresolved-child',
    ),
  } as ItemOutcome;
}

/** Rebuild, compare, and execute ready items sequentially with bounded output parsing. */
export async function executeHandoffPlan(
  input: ExecuteHandoffPlanInput,
): Promise<BatchOutcome> {
  if (!/^[0-9a-f]{64}$/u.test(input.confirmedDigest)) {
    throw new HandoffPolicyError('plan-stale');
  }
  const plan = await input.rebuildPlan();
  if (plan.confirmationDigest !== input.confirmedDigest) {
    throw new HandoffPolicyError('plan-stale');
  }
  const items: ItemOutcome[] = [];
  for (const item of plan.items) {
    if (item.disposition === 'ready') {
      items.push(await executeReadyItem(plan, item, input));
      continue;
    }
    const reasonCode = item.reasonCodes[0];
    items.push({
      key: item.key,
      parentNativeId: item.parentNativeId,
      targetBaselineIds: [...plan.baselineTargetIds],
      ...(item.expectedChildNativeId === undefined
        ? {}
        : { expectedChildNativeId: item.expectedChildNativeId }),
      native:
        item.disposition === 'deferred'
          ? { status: 'deferred', retryable: true, reasonCode }
          : { status: 'refused', retryable: false, reasonCode },
      reporting: { status: 'not-attempted' },
    });
  }
  return parseBatchOutcome({
    schemaVersion: 1,
    planDigest: plan.confirmationDigest,
    items,
    retryableKeys: items
      .filter(
        (item) =>
          item.native.status === 'deferred' || item.native.status === 'failed',
      )
      .map((item) => item.key),
  });
}

export interface ReconcileBatchDependencies {
  inspect: (
    request: ReconcileEvidenceRequest,
  ) => Promise<ReconcileEvidenceResult>;
}

/** Retry only exact retained child selectors against provider lineage evidence. */
export async function reconcileBatchOutcome(
  value: unknown,
  dependencies: ReconcileBatchDependencies,
): Promise<BatchOutcome> {
  const batch = parseBatchOutcome(value);
  const items: ItemOutcome[] = [];
  for (const item of batch.items) {
    const retainedSelector =
      item.observedChildNativeId ?? item.expectedChildNativeId;
    if (
      (item.native.status !== 'succeeded' &&
        item.native.status !== 'indeterminate') ||
      retainedSelector === undefined
    ) {
      items.push(item);
      continue;
    }
    const provider = item.key.slice(
      0,
      item.key.indexOf(':'),
    ) as HandoffProvider;
    const selectorMismatch =
      item.expectedChildNativeId !== undefined &&
      item.observedChildNativeId !== undefined &&
      item.expectedChildNativeId !== item.observedChildNativeId;
    const evidence = selectorMismatch
      ? ({ status: 'unresolved', reasonCode: 'child-unresolved' } as const)
      : await dependencies.inspect({
          provider,
          parentNativeId: item.parentNativeId,
          ...(item.expectedChildNativeId === undefined
            ? {}
            : { expectedChildNativeId: item.expectedChildNativeId }),
          ...(item.observedChildNativeId === undefined
            ? {}
            : { observedChildNativeId: item.observedChildNativeId }),
          targetBaselineIds: [...item.targetBaselineIds],
        });
    items.push({
      ...item,
      ...(evidence.status === 'mapped' &&
      item.observedChildNativeId === undefined
        ? { observedChildNativeId: retainedSelector }
        : {}),
      reporting: reportingFromEvidence(evidence, retainedSelector),
    } as ItemOutcome);
  }
  return parseBatchOutcome({ ...batch, items });
}
