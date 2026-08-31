import { execFile as nodeExecFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  open,
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
import {
  buildNativeInvocation,
  HANDOFF_MARKER_PROMPT,
  sha256Canonical,
} from './behavior-contracts.js';
import { HANDOFF_DISCOVERY_OPTIONS } from './discovery.js';
import type { NativeExecutionResult } from './handoff.js';
import type { ProviderProbeResult } from './providers.js';
import type {
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
  inspectEvidence: (context: BehaviorGateContext) => Promise<ChildEvidence>;
  cleanupProvider: (
    context: BehaviorGateContext,
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

function observedId(
  provider: HandoffProvider,
  result: NativeExecutionResult,
): string | null {
  if (
    result.exitCode !== 0 ||
    result.signal !== null ||
    Buffer.byteLength(result.stdout) > 65_536 ||
    Buffer.byteLength(result.stderr) > 65_536
  ) {
    return null;
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
    if (typeof value === 'string' && value.length > 0) values.push(value);
  }
  return new Set(values).size === 1 ? values[0] : null;
}

async function safeRun(
  deps: BehaviorGateDependencies,
  invocationValue: NativeInvocation,
  executablePath: string,
): Promise<NativeExecutionResult> {
  try {
    return await deps.runProvider(invocationValue, executablePath);
  } catch {
    throw new ProviderGateError('provider-call-failed');
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
  if (receiptExists) {
    throw new ProviderGateError('receipt-path-exists');
  }

  let fixture: BehaviorGateFixture;
  try {
    fixture = await deps.createFixture();
  } catch {
    throw new ProviderGateError('fixture-creation-failed');
  }
  const executablePath = input.providerProbe.capability.executable;
  const requestedParentId =
    input.provider === 'claude' ? deps.uuid() : undefined;
  const requestedChildId =
    input.provider === 'claude' ? deps.uuid() : undefined;

  let context: BehaviorGateContext | undefined;
  let cleanupFinalized = false;
  try {
    const parentResult = await safeRun(
      deps,
      parentInvocation(
        input.provider,
        fixture.sourceWorktree,
        requestedParentId,
      ),
      executablePath,
    );
    const parentNativeId = observedId(input.provider, parentResult);
    if (
      parentNativeId === null ||
      (requestedParentId !== undefined && parentNativeId !== requestedParentId)
    ) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    const parentEvidence = await deps.captureParentEvidence({
      provider: input.provider,
      executablePath,
      fixture,
      parentNativeId,
    });
    const successor = buildNativeInvocation(
      input.provider,
      parentNativeId,
      fixture.targetWorktree,
      requestedChildId,
    );
    const successorResult = await safeRun(deps, successor, executablePath);
    const childNativeId = observedId(input.provider, successorResult);
    if (
      childNativeId === null ||
      (requestedChildId !== undefined && childNativeId !== requestedChildId)
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
      executablePath,
    );
    if (observedId(input.provider, sourceResult) !== parentNativeId) {
      throw new ProviderGateError('provider-evidence-failed');
    }
    context = {
      provider: input.provider,
      executablePath,
      fixture,
      parentNativeId,
      childNativeId,
      ...(requestedChildId === undefined
        ? {}
        : { requestedChildNativeId: requestedChildId }),
      parentEvidence,
    };
    const evidence = await deps.inspectEvidence(context);

    let providerCleanup: ProviderCleanupResult;
    try {
      providerCleanup = await deps.cleanupProvider(context);
    } catch {
      providerCleanup = {
        status: 'failed',
        method:
          input.provider === 'codex'
            ? 'codex-delete-exact-session-ids'
            : 'claude-purge-exact-disposable-project-paths',
        reasonCodes: ['reporting-failed'],
      };
    }
    let fixtureCleanup: FixtureCleanupResult;
    try {
      fixtureCleanup = await deps.cleanupFixture(fixture);
    } catch {
      fixtureCleanup = { status: 'failed', reasonCodes: ['reporting-failed'] };
    }
    cleanupFinalized = true;

    const evidencePassed =
      evidence.recordedChildCwd === fixture.targetWorktree &&
      evidence.exactParentLineage;
    const cleanupPassed =
      providerCleanup.status === 'removed' &&
      fixtureCleanup.status === 'removed';
    const status: BehavioralGateReceipt['status'] = !cleanupPassed
      ? 'inconclusive'
      : evidencePassed
        ? 'passed'
        : 'failed';
    const reasonCodes = [
      ...(evidencePassed ? [] : (['reporting-failed'] as const)),
      ...providerCleanup.reasonCodes,
      ...fixtureCleanup.reasonCodes,
    ].filter(
      (reason, index, values) => values.indexOf(reason) === index,
    ) as HandoffReasonCode[];
    const cleanupReasonCodes = [
      ...providerCleanup.reasonCodes,
      ...fixtureCleanup.reasonCodes,
    ].filter((reason, index, values) => values.indexOf(reason) === index);
    const receipt = parseBehavioralGateReceipt({
      schemaVersion: 1,
      provider: input.provider,
      executablePath,
      exactVersion: plan.exactVersion,
      syntaxFingerprint: plan.syntaxFingerprint!,
      executionContextFingerprint: plan.executionContextFingerprint!,
      operation: 'successor',
      fixture,
      observations: {
        parentNativeId,
        ...(requestedChildId === undefined
          ? {}
          : { requestedChildNativeId: requestedChildId }),
        observedChildNativeId: childNativeId,
        recordedChildCwd: evidence.recordedChildCwd,
        exactParentLineage: evidence.exactParentLineage,
        sourceParentResumable: true,
        metadataEffects: evidence.metadataEffects,
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
      reasonCodes,
    };
  } catch (error) {
    if (!cleanupFinalized && context !== undefined) {
      await deps.cleanupProvider(context).catch(() => undefined);
    }
    if (!cleanupFinalized) {
      await deps.cleanupFixture(fixture).catch(() => undefined);
    }
    if (error instanceof ProviderGateError) throw error;
    throw new ProviderGateError('provider-evidence-failed');
  }
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

async function exactTranscriptMeta(
  provider: HandoffProvider,
  cwd: string,
  nativeId: string,
) {
  const candidates = await discover(
    runtime(provider),
    cwd,
    new ClassificationCache(),
    HANDOFF_DISCOVERY_OPTIONS,
  );
  const matches = candidates.filter(
    (candidate) =>
      candidate.sessionId === nativeId && candidate.recordedCwd === cwd,
  );
  if (matches.length !== 1) throw new Error('exact-transcript-unavailable');
  const bounded = await readMetadataRecordsBounded(matches[0].transcriptPath, {
    maxBytes: 256 * 1024,
    maxRecords: 128,
    diagnostic: () => {},
  });
  if (bounded.incomplete) throw new Error('exact-transcript-incomplete');
  return extractMetaFromRecords(
    runtime(provider),
    bounded.records,
    matches[0].transcriptPath,
  );
}

async function captureDefaultParentEvidence(
  context: Omit<
    BehaviorGateContext,
    'childNativeId' | 'requestedChildNativeId' | 'parentEvidence'
  >,
): Promise<ParentEvidence> {
  const meta = await exactTranscriptMeta(
    context.provider,
    context.fixture.sourceWorktree,
    context.parentNativeId,
  );
  if (meta === null) throw new Error('parent-evidence-unavailable');
  return {
    recordUuids: meta.recordLineage?.map((entry) => entry.uuid) ?? [],
  };
}

async function inspectDefaultEvidence(
  context: BehaviorGateContext,
): Promise<ChildEvidence> {
  const meta = await exactTranscriptMeta(
    context.provider,
    context.fixture.targetWorktree,
    context.childNativeId,
  );
  if (meta === null) throw new Error('child-evidence-unavailable');
  const exactParentLineage =
    context.provider === 'codex'
      ? meta.nativeSessionId === context.childNativeId &&
        meta.forkedFromSessionId === context.parentNativeId
      : meta.nativeSessionId === context.childNativeId &&
        context.parentEvidence.recordUuids.every(
          (uuid, index) => meta.recordLineage?.[index]?.uuid === uuid,
        );
  return {
    recordedChildCwd: meta.recordedCwd ?? '',
    exactParentLineage,
    metadataEffects: [
      'created-child-record',
      'recorded-target-cwd',
      'linked-parent-lineage',
    ],
  };
}

async function cleanupDefaultProvider(
  context: BehaviorGateContext,
): Promise<ProviderCleanupResult> {
  const commands =
    context.provider === 'codex'
      ? [
          ['delete', '--force', context.childNativeId],
          ['delete', '--force', context.parentNativeId],
        ]
      : [
          ['project', 'purge', '-y', context.fixture.targetWorktree],
          ['project', 'purge', '-y', context.fixture.sourceWorktree],
        ];
  let failed = false;
  for (const argv of commands) {
    try {
      await execFileAsync(context.executablePath, argv, {
        timeout: 60_000,
        maxBuffer: 65_536,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      });
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
  inspectEvidence: inspectDefaultEvidence,
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
