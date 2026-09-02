import { execFile as nodeExecFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

import {
  extractMetaFromRecords,
  readMetadataRecordsBounded,
  type Runtime,
} from '../core/runtimes.js';
import {
  ClassificationCache,
  discover,
} from '../session-observer/lib/locate.js';
import type { TranscriptCandidate } from '../session-observer/lib/types.js';
import {
  buildNativeInvocation,
  HANDOFF_MARKER_PROMPT,
  sha256Canonical,
} from './behavior-contracts.js';
import { HANDOFF_DISCOVERY_OPTIONS } from './discovery.js';
import type { NativeExecutionResult } from './handoff.js';
import type { ProviderProbeResult } from './providers.js';
import type {
  BehaviorGateFailureStage,
  BehavioralGateReceipt,
  HandoffProvider,
  HandoffReasonCode,
  NativeInvocation,
} from './types.js';
import { parseBehavioralGateReceipt } from './types.js';

const execFileAsync = promisify(nodeExecFile);

const PARENT_PROMPT = 'Reply exactly HANDOFF_PARENT_READY. Do not use tools.';
const SOURCE_PROMPT = 'Reply exactly HANDOFF_SOURCE_READY. Do not use tools.';
const PROVIDER_CALLS = 3;
const EXACT_PROVIDER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ProviderGateFailure =
  | 'plan-stale'
  | 'provider-auth-required'
  | 'provider-capability-unavailable'
  | 'receipt-path-exists'
  | 'receipt-path-unavailable'
  | 'fixture-creation-failed'
  | 'provider-call-failed'
  | 'provider-evidence-failed'
  | 'receipt-write-failed';

export class ProviderGateError extends Error {
  readonly code: ProviderGateFailure;

  constructor(code: ProviderGateFailure) {
    super(code);
    this.name = 'ProviderGateError';
    this.code = code;
  }
}

class BehaviorGateStageError extends Error {
  readonly failureStage: BehaviorGateFailureStage;

  constructor(failureStage: BehaviorGateFailureStage) {
    super(failureStage);
    this.name = 'BehaviorGateStageError';
    this.failureStage = failureStage;
  }
}

export interface BehaviorPlan {
  schemaVersion: 1;
  provider: HandoffProvider;
  exactVersion: string;
  syntaxFingerprint?: string;
  executionContextFingerprint?: string;
  authentication: ProviderProbeResult['authentication']['status'];
  fixture: 'fresh-disposable-repository-with-two-worktrees';
  calls: 3;
  prompts: readonly [string, string, string];
  bounds: {
    timeoutMsPerCall: 60_000;
    outputBytesPerCall: 65_536;
    maxBudgetUsd?: 0.15;
  };
  cleanup: {
    method:
      | 'codex-delete-exact-session-ids'
      | 'claude-purge-exact-disposable-project-paths';
    limitations: readonly [
      'provider-telemetry-cache-and-consumed-quota-may-remain',
    ];
  };
  confirmationDigest: string;
}

export interface BehaviorGateFixture {
  repositoryRoot: string;
  sourceWorktree: string;
  targetWorktree: string;
}

export interface ParentEvidence {
  recordUuids: string[];
}

export interface ChildEvidence {
  recordedChildCwd: string;
  exactParentLineage: boolean;
  recordUuids: string[];
  contentSha256: string;
  metadataEffects: string[];
}

export interface TranscriptEvidenceSnapshot {
  nativeSessionId: string;
  recordedCwd: string;
  forkedFromSessionId?: string;
  recordUuids: string[];
  contentSha256: string;
}

export interface SourceResumeEvidence {
  sourceParentResumable: boolean;
  childUnchanged: boolean;
  metadataEffects: string[];
}

export interface BehaviorGateContext {
  provider: HandoffProvider;
  executablePath: string;
  fixture: BehaviorGateFixture;
  parentNativeId: string;
  childNativeId: string;
  requestedChildNativeId?: string;
  parentEvidence: ParentEvidence;
}

export interface PartialBehaviorGateContext {
  provider: HandoffProvider;
  executablePath: string;
  fixture: BehaviorGateFixture;
  parentCreationAttempted: boolean;
  successorCreationAttempted: boolean;
  parentNativeId?: string;
  childNativeId?: string;
  requestedChildNativeId?: string;
  parentEvidence?: ParentEvidence;
}

export interface ProviderCleanupResult {
  status: 'removed' | 'failed';
  method:
    | 'codex-delete-exact-session-ids'
    | 'claude-purge-exact-disposable-project-paths';
  reasonCodes: HandoffReasonCode[];
}

export interface FixtureCleanupResult {
  status: 'removed' | 'failed';
  reasonCodes: HandoffReasonCode[];
}

export interface BehaviorGateDependencies {
  pathExists: (path: string) => Promise<boolean>;
  createFixture: () => Promise<BehaviorGateFixture>;
  runProvider: (
    invocation: NativeInvocation,
    executablePath: string,
  ) => Promise<NativeExecutionResult>;
  captureParentEvidence: (
    context: Omit<
      BehaviorGateContext,
      'childNativeId' | 'requestedChildNativeId' | 'parentEvidence'
    >,
  ) => Promise<ParentEvidence>;
  captureChildEvidence: (
    context: BehaviorGateContext,
  ) => Promise<ChildEvidence>;
  captureSourceEvidence: (
    context: BehaviorGateContext,
  ) => Promise<TranscriptEvidenceSnapshot>;
  inspectSourceResumeEvidence: (
    context: BehaviorGateContext,
    sourceBeforeResume: TranscriptEvidenceSnapshot,
    childBeforeResume: ChildEvidence,
  ) => Promise<SourceResumeEvidence>;
  cleanupProvider: (
    context: PartialBehaviorGateContext,
  ) => Promise<ProviderCleanupResult>;
  cleanupFixture: (
    fixture: BehaviorGateFixture,
  ) => Promise<FixtureCleanupResult>;
  writeReceiptAtomically: (
    path: string,
    receipt: BehavioralGateReceipt,
    mode: 0o600,
  ) => Promise<void>;
  now: () => Date;
  uuid: () => string;
}

export interface VerifyProviderBehaviorInput {
  provider: HandoffProvider;
  providerProbe: ProviderProbeResult;
  confirmedDigest: string;
  receiptPath: string;
  deps?: BehaviorGateDependencies;
}

export interface SafeBehaviorGateResult {
  provider: HandoffProvider;
  status: BehavioralGateReceipt['status'];
  receiptDigest: string;
  failureStage?: BehaviorGateFailureStage;
  reasonCodes: HandoffReasonCode[];
}

function behaviorPlanProjection(
  provider: HandoffProvider,
  providerProbe: ProviderProbeResult,
) {
  const capability = providerProbe.capability;
  return {
    schemaVersion: 1 as const,
    provider,
    exactVersion:
      capability.detectedVersion ?? capability.verifiedSyntaxVersion,
    syntaxFingerprint: capability.contractFingerprint,
    executionContextFingerprint: capability.executionContextFingerprint,
    authentication: providerProbe.authentication.status,
    authenticationMethod: providerProbe.authentication.method ?? null,
    fixture: 'fresh-disposable-repository-with-two-worktrees' as const,
    calls: PROVIDER_CALLS as 3,
    prompts: [PARENT_PROMPT, HANDOFF_MARKER_PROMPT, SOURCE_PROMPT] as const,
    bounds: {
      timeoutMsPerCall: 60_000 as const,
      outputBytesPerCall: 65_536 as const,
      ...(provider === 'claude' ? { maxBudgetUsd: 0.15 as const } : {}),
    },
    cleanup: {
      method:
        provider === 'codex'
          ? ('codex-delete-exact-session-ids' as const)
          : ('claude-purge-exact-disposable-project-paths' as const),
      limitations: [
        'provider-telemetry-cache-and-consumed-quota-may-remain' as const,
      ] as const,
    },
  };
}

/** Produce the complete disposable gate plan without filesystem or process I/O. */
export function createBehaviorPlan(
  provider: HandoffProvider,
  providerProbe: ProviderProbeResult,
): BehaviorPlan {
  if (providerProbe.capability.provider !== provider) {
    throw new ProviderGateError('provider-capability-unavailable');
  }
  const projection = behaviorPlanProjection(provider, providerProbe);
  const { authenticationMethod: _authenticationMethod, ...publicPlan } =
    projection;
  return {
    ...publicPlan,
    confirmationDigest: sha256Canonical(projection),
  };
}

function invocation(
  executable: HandoffProvider,
  argv: string[],
  cwd: string,
): NativeInvocation {
  return {
    executable,
    argv,
    cwd,
    shell: false,
    stdio: 'pipe',
    timeoutMs: 60_000,
    maxOutputBytes: 65_536,
  };
}

function parentInvocation(
  provider: HandoffProvider,
  cwd: string,
  parentNativeId?: string,
): NativeInvocation {
  return provider === 'codex'
    ? invocation(
        'codex',
        [
          'exec',
          '--json',
          '--disable',
          'hooks',
          '--ignore-user-config',
          '--ignore-rules',
          '-c',
          'sandbox_mode="read-only"',
          PARENT_PROMPT,
        ],
        cwd,
      )
    : invocation(
        'claude',
        [
          '--safe-mode',
          '--print',
          '--output-format',
          'json',
          '--session-id',
          parentNativeId!,
          '--permission-mode',
          'plan',
          '--tools',
          '',
          '--max-budget-usd',
          '0.15',
          PARENT_PROMPT,
        ],
        cwd,
      );
}

function sourceResumeInvocation(
  provider: HandoffProvider,
  cwd: string,
  parentNativeId: string,
): NativeInvocation {
  return provider === 'codex'
    ? invocation(
        'codex',
        [
          'exec',
          'resume',
          '--json',
          '--disable',
          'hooks',
          '--ignore-user-config',
          '--ignore-rules',
          '-c',
          'sandbox_mode="read-only"',
          parentNativeId,
          SOURCE_PROMPT,
        ],
        cwd,
      )
    : invocation(
        'claude',
        [
          '--safe-mode',
          '--print',
          '--output-format',
          'json',
          '--resume',
          parentNativeId,
          '--permission-mode',
          'plan',
          '--tools',
          '',
          '--max-budget-usd',
          '0.15',
          SOURCE_PROMPT,
        ],
        cwd,
      );
}

function isExactProviderUuid(value: unknown): value is string {
  return typeof value === 'string' && EXACT_PROVIDER_UUID.test(value);
}

function isValidMachineObservedId(
  provider: HandoffProvider,
  value: unknown,
): value is string {
  return provider === 'codex'
    ? isExactProviderUuid(value)
    : typeof value === 'string' && value.length > 0;
}

function observedId(
  provider: HandoffProvider,
  result: NativeExecutionResult,
): string {
  if (
    result.timedOut === true ||
    (typeof result.signal === 'string' && result.signal.length > 0)
  ) {
    throw new BehaviorGateStageError('provider-timeout-or-signal');
  }
  if (
    Buffer.byteLength(result.stdout) > 65_536 ||
    Buffer.byteLength(result.stderr) > 65_536
  ) {
    throw new BehaviorGateStageError('provider-output-bound');
  }
  if (result.exitCode !== 0) {
    throw new BehaviorGateStageError('provider-nonzero-exit');
  }
  const values: string[] = [];
  for (const line of result.stdout.split('\n')) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      continue;
    }
    const record = parsed as Record<string, unknown>;
    const value =
      provider === 'codex' && record.type === 'thread.started'
        ? record.thread_id
        : provider === 'claude'
          ? record.session_id
          : undefined;
    if (value !== undefined) {
      if (!isValidMachineObservedId(provider, value)) {
        throw new BehaviorGateStageError('native-identity-unresolved');
      }
      values.push(value);
    }
  }
  if (new Set(values).size !== 1) {
    throw new BehaviorGateStageError('native-identity-unresolved');
  }
  return values[0];
}

async function safeRun(
  deps: BehaviorGateDependencies,
  invocationValue: NativeInvocation,
  executablePath: string,
): Promise<NativeExecutionResult> {
  try {
    return await deps.runProvider(invocationValue, executablePath);
  } catch (error) {
    if (error instanceof BehaviorGateStageError) throw error;
    throw new BehaviorGateStageError('provider-call-exception');
  }
}

function exactCapabilitiesAvailable(
  provider: HandoffProvider,
  probe: ProviderProbeResult,
): boolean {
  return (
    probe.capability.provider === provider &&
    probe.capability.status === 'syntax-verified' &&
    probe.capability.detectedVersion ===
      probe.capability.verifiedSyntaxVersion &&
    probe.capability.contractFingerprint !== undefined &&
    probe.capability.executionContextFingerprint !== undefined
  );
}

function cleanupMethod(
  provider: HandoffProvider,
): ProviderCleanupResult['method'] {
  return provider === 'codex'
    ? 'codex-delete-exact-session-ids'
    : 'claude-purge-exact-disposable-project-paths';
}

function uniqueReasonCodes(
  ...groups: readonly HandoffReasonCode[][]
): HandoffReasonCode[] {
  return [...new Set(groups.flat())];
}

function validClaudeLineage(recordUuids: readonly string[]): boolean {
  return (
    recordUuids.length > 0 &&
    recordUuids.every((uuid) => isExactProviderUuid(uuid))
  );
}

function validSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}

async function cleanupProviderState(
  deps: BehaviorGateDependencies,
  state: PartialBehaviorGateContext,
): Promise<ProviderCleanupResult> {
  try {
    return await deps.cleanupProvider(state);
  } catch {
    return {
      status: 'failed',
      method: cleanupMethod(state.provider),
      reasonCodes: ['reporting-failed'],
    };
  }
}

async function cleanupGitFixture(
  deps: BehaviorGateDependencies,
  fixture: BehaviorGateFixture,
): Promise<FixtureCleanupResult> {
  try {
    return await deps.cleanupFixture(fixture);
  } catch {
    return { status: 'failed', reasonCodes: ['reporting-failed'] };
  }
}

async function finalizeReceipt(
  input: VerifyProviderBehaviorInput,
  deps: BehaviorGateDependencies,
  plan: BehaviorPlan,
  state: PartialBehaviorGateContext,
  providerCleanup: ProviderCleanupResult,
  fixtureCleanup: FixtureCleanupResult,
  childEvidence: ChildEvidence | undefined,
  resumeEvidence: SourceResumeEvidence | undefined,
  incomplete: boolean,
  failureStage: BehaviorGateFailureStage | undefined,
): Promise<SafeBehaviorGateResult> {
  const cleanupReasonCodes = uniqueReasonCodes(
    providerCleanup.reasonCodes,
    fixtureCleanup.reasonCodes,
  );
  const evidencePassed =
    !incomplete &&
    childEvidence !== undefined &&
    resumeEvidence !== undefined &&
    childEvidence.recordedChildCwd === state.fixture.targetWorktree &&
    childEvidence.exactParentLineage &&
    resumeEvidence.sourceParentResumable &&
    resumeEvidence.childUnchanged;
  const cleanupPassed =
    providerCleanup.status === 'removed' && fixtureCleanup.status === 'removed';
  const status: BehavioralGateReceipt['status'] =
    incomplete || !cleanupPassed
      ? 'inconclusive'
      : evidencePassed
        ? 'passed'
        : 'failed';
  const reasonCodes = uniqueReasonCodes(
    evidencePassed && !incomplete ? [] : ['reporting-failed'],
    cleanupReasonCodes,
  );
  const sourceParentResumable =
    resumeEvidence?.sourceParentResumable === true &&
    resumeEvidence.childUnchanged;
  const resolvedFailureStage =
    failureStage ?? (evidencePassed ? undefined : 'evidence-validation');
  const receipt = parseBehavioralGateReceipt({
    schemaVersion: 1,
    provider: input.provider,
    executablePath: state.executablePath,
    exactVersion: plan.exactVersion,
    syntaxFingerprint: plan.syntaxFingerprint!,
    executionContextFingerprint: plan.executionContextFingerprint!,
    operation: 'successor',
    fixture: state.fixture,
    observations: {
      parentNativeId: state.parentNativeId ?? 'unobserved-parent',
      ...(state.requestedChildNativeId === undefined
        ? {}
        : { requestedChildNativeId: state.requestedChildNativeId }),
      observedChildNativeId: state.childNativeId ?? 'unobserved-child',
      recordedChildCwd: childEvidence?.recordedChildCwd ?? 'unobserved-cwd',
      exactParentLineage: childEvidence?.exactParentLineage ?? false,
      sourceParentResumable,
      metadataEffects: [
        ...(childEvidence?.metadataEffects ?? []),
        ...(resumeEvidence?.metadataEffects ?? []),
      ],
    },
    bounds: {
      calls: PROVIDER_CALLS,
      timeoutMsPerCall: 60_000,
      outputBytesPerCall: 65_536,
      ...(input.provider === 'claude' ? { maxBudgetUsd: 0.15 } : {}),
    },
    cleanup: {
      gitFixture: fixtureCleanup.status,
      providerState: providerCleanup.status,
      method: providerCleanup.method,
      reasonCodes: cleanupReasonCodes,
    },
    status,
    ...(resolvedFailureStage === undefined
      ? {}
      : { failureStage: resolvedFailureStage }),
    reasonCodes,
    createdAt: deps.now().toISOString(),
  });
  try {
    await deps.writeReceiptAtomically(input.receiptPath, receipt, 0o600);
  } catch {
    throw new ProviderGateError('receipt-write-failed');
  }
  const receiptContents = `${JSON.stringify(receipt, null, 2)}\n`;
  return {
    provider: input.provider,
    status,
    receiptDigest: createHash('sha256').update(receiptContents).digest('hex'),
    ...(resolvedFailureStage === undefined
      ? {}
      : { failureStage: resolvedFailureStage }),
    reasonCodes,
  };
}

/** Execute the confirmed disposable gate, finalize cleanup, then atomically write. */
export async function verifyProviderBehavior(
  input: VerifyProviderBehaviorInput,
): Promise<SafeBehaviorGateResult> {
  const deps = input.deps ?? DEFAULT_DEPENDENCIES;
  const plan = createBehaviorPlan(input.provider, input.providerProbe);
  if (plan.confirmationDigest !== input.confirmedDigest) {
    throw new ProviderGateError('plan-stale');
  }
  if (input.providerProbe.authentication.status !== 'authenticated') {
    throw new ProviderGateError('provider-auth-required');
  }
  if (!exactCapabilitiesAvailable(input.provider, input.providerProbe)) {
    throw new ProviderGateError('provider-capability-unavailable');
  }
  let receiptExists: boolean;
  try {
    receiptExists = await deps.pathExists(input.receiptPath);
  } catch {
    throw new ProviderGateError('receipt-path-unavailable');
  }
  if (receiptExists) throw new ProviderGateError('receipt-path-exists');

  let fixture: BehaviorGateFixture;
  try {
    fixture = await deps.createFixture();
  } catch {
    throw new ProviderGateError('fixture-creation-failed');
  }
  const requestedParentId =
    input.provider === 'claude' ? deps.uuid() : undefined;
  const requestedChildId =
    input.provider === 'claude' ? deps.uuid() : undefined;
  const state: PartialBehaviorGateContext = {
    provider: input.provider,
    executablePath: input.providerProbe.capability.executable,
    fixture,
    parentCreationAttempted: false,
    successorCreationAttempted: false,
    ...(requestedChildId === undefined
      ? {}
      : { requestedChildNativeId: requestedChildId }),
  };
  let childEvidence: ChildEvidence | undefined;
  let resumeEvidence: SourceResumeEvidence | undefined;
  let incomplete = false;
  let failureStage: BehaviorGateFailureStage | undefined;

  try {
    state.parentCreationAttempted = true;
    const parentResult = await safeRun(
      deps,
      parentInvocation(
        input.provider,
        fixture.sourceWorktree,
        requestedParentId,
      ),
      state.executablePath,
    );
    const parentNativeId = observedId(input.provider, parentResult);
    if (
      requestedParentId !== undefined &&
      parentNativeId !== requestedParentId
    ) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    state.parentNativeId = parentNativeId;
    const parentEvidence = await deps.captureParentEvidence({
      provider: input.provider,
      executablePath: state.executablePath,
      fixture,
      parentNativeId,
    });
    if (
      input.provider === 'claude' &&
      !validClaudeLineage(parentEvidence.recordUuids)
    ) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    state.parentEvidence = parentEvidence;

    state.successorCreationAttempted = true;
    const successorResult = await safeRun(
      deps,
      buildNativeInvocation(
        input.provider,
        parentNativeId,
        fixture.targetWorktree,
        requestedChildId,
      ),
      state.executablePath,
    );
    const childNativeId = observedId(input.provider, successorResult);
    if (requestedChildId !== undefined && childNativeId !== requestedChildId) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    state.childNativeId = childNativeId;
    const context: BehaviorGateContext = {
      provider: input.provider,
      executablePath: state.executablePath,
      fixture,
      parentNativeId,
      childNativeId,
      ...(requestedChildId === undefined
        ? {}
        : { requestedChildNativeId: requestedChildId }),
      parentEvidence,
    };
    childEvidence = await deps.captureChildEvidence(context);
    if (
      !childEvidence.exactParentLineage ||
      !validSha256(childEvidence.contentSha256) ||
      (input.provider === 'claude' &&
        !validClaudeLineage(childEvidence.recordUuids))
    ) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    const sourceBeforeResume = await deps.captureSourceEvidence(context);
    if (
      sourceBeforeResume.nativeSessionId !== context.parentNativeId ||
      sourceBeforeResume.recordedCwd !== context.fixture.sourceWorktree ||
      !validSha256(sourceBeforeResume.contentSha256) ||
      (input.provider === 'claude' &&
        !validClaudeLineage(sourceBeforeResume.recordUuids))
    ) {
      throw new ProviderGateError('provider-evidence-failed');
    }

    const sourceResult = await safeRun(
      deps,
      sourceResumeInvocation(
        input.provider,
        fixture.sourceWorktree,
        parentNativeId,
      ),
      state.executablePath,
    );
    if (observedId(input.provider, sourceResult) !== parentNativeId) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    resumeEvidence = await deps.inspectSourceResumeEvidence(
      context,
      sourceBeforeResume,
      childEvidence,
    );
  } catch (error) {
    incomplete = true;
    failureStage =
      error instanceof BehaviorGateStageError
        ? error.failureStage
        : 'evidence-validation';
  }

  const providerCleanup = await cleanupProviderState(deps, state);
  const fixtureCleanup = await cleanupGitFixture(deps, fixture);
  return finalizeReceipt(
    input,
    deps,
    plan,
    state,
    providerCleanup,
    fixtureCleanup,
    childEvidence,
    resumeEvidence,
    incomplete,
    failureStage,
  );
}

async function git(cwd: string, argv: string[]): Promise<void> {
  await execFileAsync('git', ['-C', cwd, ...argv], {
    timeout: 10_000,
    maxBuffer: 65_536,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
}

async function createDefaultFixture(): Promise<BehaviorGateFixture> {
  const repositoryRoot = await mkdtemp(
    join(tmpdir(), 'coding-session-handoff-gate-'),
  );
  const sourceWorktree = join(repositoryRoot, 'source-worktree');
  await mkdir(sourceWorktree);
  await git(sourceWorktree, ['init', '--initial-branch=main']);
  await git(sourceWorktree, ['config', 'user.name', 'Handoff Gate']);
  await git(sourceWorktree, ['config', 'user.email', 'handoff-gate@invalid']);
  await git(sourceWorktree, ['commit', '--allow-empty', '-m', 'gate fixture']);
  const targetWorktree = join(repositoryRoot, 'target-worktree');
  await git(sourceWorktree, [
    'worktree',
    'add',
    '-b',
    'handoff-gate-target',
    targetWorktree,
  ]);
  return { repositoryRoot, sourceWorktree, targetWorktree };
}

async function runDefaultProvider(
  invocationValue: NativeInvocation,
  executablePath: string,
): Promise<NativeExecutionResult> {
  try {
    const result = await execFileAsync(executablePath, invocationValue.argv, {
      cwd: invocationValue.cwd,
      timeout: invocationValue.timeoutMs,
      maxBuffer: invocationValue.maxOutputBytes,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    return {
      exitCode: 0,
      signal: null,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (error === null || typeof error !== 'object') throw error;
    const details = error as Record<string, unknown>;
    if (details.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new BehaviorGateStageError('provider-output-bound');
    }
    return {
      exitCode: typeof details.code === 'number' ? details.code : null,
      signal: typeof details.signal === 'string' ? details.signal : null,
      stdout: typeof details.stdout === 'string' ? details.stdout : '',
      stderr: typeof details.stderr === 'string' ? details.stderr : '',
      timedOut:
        details.code === 'ETIMEDOUT' ||
        details.killed === true ||
        details.signal === 'SIGTERM',
    };
  }
}

function runtime(provider: HandoffProvider): Runtime {
  return provider === 'codex' ? 'codex' : 'claude-code';
}

export async function exactTranscriptSnapshot(
  provider: HandoffProvider,
  cwd: string,
  nativeId: string,
): Promise<TranscriptEvidenceSnapshot> {
  const candidates = await discover(
    runtime(provider),
    cwd,
    new ClassificationCache(),
    HANDOFF_DISCOVERY_OPTIONS,
  );
  const snapshots = await Promise.all(
    candidates
      .filter((candidate) => candidate.recordedCwd === cwd)
      .map((candidate) => snapshotTranscriptCandidate(provider, candidate)),
  );
  const matches = snapshots.filter(
    (snapshot) => snapshot.nativeSessionId === nativeId,
  );
  if (matches.length !== 1) throw new Error('exact-transcript-unavailable');
  return matches[0];
}

async function snapshotTranscriptCandidate(
  provider: HandoffProvider,
  candidate: TranscriptCandidate,
): Promise<TranscriptEvidenceSnapshot> {
  const beforeStat = await stat(candidate.transcriptPath);
  if (beforeStat.size > 256 * 1024) {
    throw new Error('exact-transcript-oversized');
  }
  const bounded = await readMetadataRecordsBounded(candidate.transcriptPath, {
    maxBytes: 256 * 1024,
    maxRecords: 128,
    diagnostic: () => {},
  });
  if (bounded.incomplete) throw new Error('exact-transcript-incomplete');
  const meta = extractMetaFromRecords(
    runtime(provider),
    bounded.records,
    candidate.transcriptPath,
  );
  if (meta === null) throw new Error('exact-transcript-metadata-unavailable');
  const contents = await readFile(candidate.transcriptPath);
  const afterStat = await stat(candidate.transcriptPath);
  if (contents.byteLength > 256 * 1024) {
    throw new Error('exact-transcript-oversized');
  }
  if (
    beforeStat.size !== afterStat.size ||
    beforeStat.mtimeMs !== afterStat.mtimeMs
  ) {
    throw new Error('exact-transcript-unstable');
  }
  return {
    nativeSessionId: meta.nativeSessionId ?? '',
    recordedCwd: meta.recordedCwd ?? '',
    ...(meta.forkedFromSessionId === undefined
      ? {}
      : { forkedFromSessionId: meta.forkedFromSessionId }),
    recordUuids: meta.recordLineage?.map((entry) => entry.uuid) ?? [],
    contentSha256: createHash('sha256').update(contents).digest('hex'),
  };
}

async function captureDefaultParentEvidence(
  context: Omit<
    BehaviorGateContext,
    'childNativeId' | 'requestedChildNativeId' | 'parentEvidence'
  >,
): Promise<ParentEvidence> {
  const snapshot = await exactTranscriptSnapshot(
    context.provider,
    context.fixture.sourceWorktree,
    context.parentNativeId,
  );
  const recordUuids = snapshot.recordUuids;
  if (context.provider === 'claude' && !validClaudeLineage(recordUuids)) {
    throw new Error('parent-lineage-invalid');
  }
  return {
    recordUuids,
  };
}

async function captureDefaultChildEvidence(
  context: BehaviorGateContext,
): Promise<ChildEvidence> {
  const snapshot = await exactTranscriptSnapshot(
    context.provider,
    context.fixture.targetWorktree,
    context.childNativeId,
  );
  const recordUuids = snapshot.recordUuids;
  const exactParentLineage =
    context.provider === 'codex'
      ? snapshot.nativeSessionId === context.childNativeId &&
        snapshot.forkedFromSessionId === context.parentNativeId
      : snapshot.nativeSessionId === context.childNativeId &&
        validClaudeLineage(recordUuids) &&
        context.parentEvidence.recordUuids.every(
          (uuid, index) => recordUuids[index] === uuid,
        );
  return {
    recordedChildCwd: snapshot.recordedCwd,
    exactParentLineage,
    recordUuids,
    contentSha256: snapshot.contentSha256,
    metadataEffects: [
      'created-child-record',
      'recorded-target-cwd',
      'linked-parent-lineage',
    ],
  };
}

async function captureDefaultSourceEvidence(
  context: BehaviorGateContext,
): Promise<TranscriptEvidenceSnapshot> {
  const snapshot = await exactTranscriptSnapshot(
    context.provider,
    context.fixture.sourceWorktree,
    context.parentNativeId,
  );
  if (
    snapshot.nativeSessionId !== context.parentNativeId ||
    snapshot.recordedCwd !== context.fixture.sourceWorktree ||
    (context.provider === 'claude' && !validClaudeLineage(snapshot.recordUuids))
  ) {
    throw new Error('source-snapshot-invalid');
  }
  return snapshot;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function evaluateSourceResumeSnapshots(
  provider: HandoffProvider,
  identity: {
    parentNativeId: string;
    childNativeId: string;
    sourceWorktree: string;
    targetWorktree: string;
  },
  sourceBeforeResume: TranscriptEvidenceSnapshot,
  sourceAfterResume: TranscriptEvidenceSnapshot,
  childBeforeResume: ChildEvidence,
  childAfterResume: TranscriptEvidenceSnapshot,
): SourceResumeEvidence {
  const sourceBeforeIdentityExact =
    sourceBeforeResume.nativeSessionId === identity.parentNativeId &&
    sourceBeforeResume.recordedCwd === identity.sourceWorktree;
  const sourceAfterIdentityExact =
    sourceAfterResume.nativeSessionId === sourceBeforeResume.nativeSessionId &&
    sourceAfterResume.recordedCwd === sourceBeforeResume.recordedCwd;
  const sourcePrefixPreserved =
    sourceAfterResume.recordUuids.length >
      sourceBeforeResume.recordUuids.length &&
    sourceBeforeResume.recordUuids.every(
      (uuid, index) => sourceAfterResume.recordUuids[index] === uuid,
    );
  const sourceParentResumable =
    sourceBeforeIdentityExact &&
    sourceAfterIdentityExact &&
    validSha256(sourceBeforeResume.contentSha256) &&
    validSha256(sourceAfterResume.contentSha256) &&
    (provider === 'claude'
      ? validClaudeLineage(sourceBeforeResume.recordUuids) &&
        validClaudeLineage(sourceAfterResume.recordUuids) &&
        sourcePrefixPreserved
      : sourceBeforeResume.contentSha256 !== sourceAfterResume.contentSha256);
  const childIdentityExact =
    childAfterResume.nativeSessionId === identity.childNativeId &&
    childAfterResume.recordedCwd === identity.targetWorktree;
  const childUnchanged =
    childIdentityExact &&
    validSha256(childBeforeResume.contentSha256) &&
    validSha256(childAfterResume.contentSha256) &&
    childAfterResume.contentSha256 === childBeforeResume.contentSha256 &&
    sameStrings(childAfterResume.recordUuids, childBeforeResume.recordUuids) &&
    (provider === 'claude' ||
      childAfterResume.forkedFromSessionId === identity.parentNativeId);
  return {
    sourceParentResumable,
    childUnchanged,
    metadataEffects: [
      sourceParentResumable
        ? 'resumed-source-parent'
        : 'source-parent-resume-unproven',
      childUnchanged ? 'preserved-child-record' : 'cross-written-child-record',
    ],
  };
}

async function inspectDefaultSourceResumeEvidence(
  context: BehaviorGateContext,
  sourceBeforeResume: TranscriptEvidenceSnapshot,
  childBeforeResume: ChildEvidence,
): Promise<SourceResumeEvidence> {
  const [sourceAfterResume, childAfterResume] = await Promise.all([
    exactTranscriptSnapshot(
      context.provider,
      context.fixture.sourceWorktree,
      context.parentNativeId,
    ),
    exactTranscriptSnapshot(
      context.provider,
      context.fixture.targetWorktree,
      context.childNativeId,
    ),
  ]);
  return evaluateSourceResumeSnapshots(
    context.provider,
    {
      parentNativeId: context.parentNativeId,
      childNativeId: context.childNativeId,
      sourceWorktree: context.fixture.sourceWorktree,
      targetWorktree: context.fixture.targetWorktree,
    },
    sourceBeforeResume,
    sourceAfterResume,
    childBeforeResume,
    childAfterResume,
  );
}

export async function cleanupDefaultProvider(
  context: PartialBehaviorGateContext,
  runCleanupCommand: (
    executablePath: string,
    argv: string[],
  ) => Promise<void> = async (executablePath, argv) => {
    await execFileAsync(executablePath, argv, {
      timeout: 60_000,
      maxBuffer: 65_536,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
  },
): Promise<ProviderCleanupResult> {
  const hasExactParentId =
    context.provider !== 'codex' || isExactProviderUuid(context.parentNativeId);
  const hasExactChildId =
    context.provider !== 'codex' || isExactProviderUuid(context.childNativeId);
  const exactCodexIds = [context.childNativeId, context.parentNativeId].filter(
    (id): id is string => isExactProviderUuid(id),
  );
  const commands =
    context.provider === 'codex'
      ? [...new Set(exactCodexIds)].map((id) => ['delete', '--force', id])
      : [
          ['project', 'purge', '-y', context.fixture.targetWorktree],
          ['project', 'purge', '-y', context.fixture.sourceWorktree],
        ];
  let failed =
    context.provider === 'codex' &&
    ((context.parentCreationAttempted && !hasExactParentId) ||
      (context.successorCreationAttempted && !hasExactChildId));
  for (const argv of commands) {
    try {
      await runCleanupCommand(context.executablePath, argv);
    } catch {
      failed = true;
    }
  }
  return {
    status: failed ? 'failed' : 'removed',
    method:
      context.provider === 'codex'
        ? 'codex-delete-exact-session-ids'
        : 'claude-purge-exact-disposable-project-paths',
    reasonCodes: failed ? ['reporting-failed'] : [],
  };
}

async function writeReceiptDefault(
  path: string,
  receipt: BehavioralGateReceipt,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.${randomUUID()}.tmp`,
  );
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temporaryPath, 0o600);
  try {
    await link(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

const DEFAULT_DEPENDENCIES: BehaviorGateDependencies = {
  pathExists: async (path) => {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        return false;
      }
      throw error;
    }
  },
  createFixture: createDefaultFixture,
  runProvider: runDefaultProvider,
  captureParentEvidence: captureDefaultParentEvidence,
  captureChildEvidence: captureDefaultChildEvidence,
  captureSourceEvidence: captureDefaultSourceEvidence,
  inspectSourceResumeEvidence: inspectDefaultSourceResumeEvidence,
  cleanupProvider: cleanupDefaultProvider,
  cleanupFixture: async (fixture) => {
    try {
      await rm(fixture.repositoryRoot, { recursive: true, force: true });
      return { status: 'removed', reasonCodes: [] };
    } catch {
      return { status: 'failed', reasonCodes: ['reporting-failed'] };
    }
  },
  writeReceiptAtomically: writeReceiptDefault,
  now: () => new Date(),
  uuid: randomUUID,
};
