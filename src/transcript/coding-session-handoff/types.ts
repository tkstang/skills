export const HANDOFF_SCHEMA_VERSION = 1 as const;

export const HANDOFF_PROVIDERS = ['codex', 'claude'] as const;
export type HandoffProvider = (typeof HANDOFF_PROVIDERS)[number];
export type QualifiedSessionId = `${HandoffProvider}:${string}`;

const EXACT_PROVIDER_NATIVE_ID_PATTERNS: Readonly<
  Record<HandoffProvider, RegExp>
> = Object.freeze({
  codex:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
  claude:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
});

export function isValidProviderNativeId(
  provider: HandoffProvider,
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    EXACT_PROVIDER_NATIVE_ID_PATTERNS[provider].test(value)
  );
}

export const HANDOFF_REASON_CODES = [
  'behavior-unverified',
  'child-ambiguous',
  'child-unresolved',
  'current-turn-active',
  'discovery-incomplete',
  'duplicate-session',
  'forbidden-flag',
  'git-evidence-drift',
  'invalid-selection',
  'native-failed-before-child',
  'native-indeterminate',
  'plan-stale',
  'preview-incomplete',
  'provider-auth-required',
  'provider-execution-context-drift',
  'provider-execution-context-unreadable',
  'provider-help-shape-drift',
  'provider-missing',
  'provider-probe-failed',
  'provider-version-drift',
  'reporting-failed',
  'repository-mismatch',
  'resume-writer-state-unknown',
  'same-worktree',
  'source-dirty',
  'target-missing',
  'target-not-worktree',
  'unknown-session',
] as const;
export type HandoffReasonCode = (typeof HANDOFF_REASON_CODES)[number];

export const BEHAVIOR_GATE_FAILURE_STAGES = [
  'provider-call-exception',
  'provider-nonzero-exit',
  'provider-timeout-or-signal',
  'provider-output-bound',
  'native-identity-missing',
  'native-identity-invalid',
  'native-identity-multiple',
  'native-identity-unresolved',
  'evidence-validation',
] as const;
export type BehaviorGateFailureStage =
  (typeof BEHAVIOR_GATE_FAILURE_STAGES)[number];

export const CAPABILITY_STATUSES = [
  'syntax-verified',
  'missing',
  'version-drift',
  'help-shape-drift',
  'execution-context-unreadable',
  'execution-context-drift',
  'probe-failed',
] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const HANDOFF_COMMANDS = [
  'discover',
  'preview',
  'plan',
  'execute',
  'reconcile',
  'behavior-plan',
  'behavior-verify',
] as const;
export type HandoffCommand = (typeof HANDOFF_COMMANDS)[number];

export const DEFAULT_PREVIEW_BATCH_LIMITS = Object.freeze({
  maxCandidates: 20,
  maxAggregateInputBytes: 33_554_432,
  maxAggregateInputRecords: 100_000,
  deadlineMs: 10_000,
  maxAggregateRenderedCharacters: 131_072,
});

export const DEFAULT_SESSION_PREVIEW_LIMITS = Object.freeze({
  maxRounds: 3,
  maxCharacters: 4_000,
});

export const MAX_SESSION_PREVIEW_LIMITS = Object.freeze({
  maxRounds: 20,
  maxCharacters: 32 * 1024,
});

export interface SessionCandidate {
  key: QualifiedSessionId;
  provider: HandoffProvider;
  nativeId: string;
  recordedCwd: string;
  modifiedAtMs: number;
  size: number;
  engagement: 'engaged' | 'unengaged' | 'unknown';
  currentEvidence: 'direct-environment' | 'explicit-self' | 'none';
}

export interface PreviewEntry {
  role: 'user' | 'assistant';
  text: string;
}

export interface SessionPreview {
  key: QualifiedSessionId;
  rounds: PreviewEntry[][];
  truncated: boolean;
  omittedEntries: number;
  warning: 'hidden-payload-sanitized-not-secret-free';
}

export interface PreviewBatchLimits {
  maxCandidates: number;
  maxAggregateInputBytes: number;
  maxAggregateInputRecords: number;
  deadlineMs: number;
  maxAggregateRenderedCharacters: number;
}

export interface SessionPreviewLimits {
  maxRounds: number;
  maxCharacters: number;
}

export interface GitWorktreeEvidence {
  requestedPath: string;
  canonicalPath: string;
  worktreeRoot: string;
  commonGitDir: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  statusFingerprint: string;
}

export type ContinuityMode = 'successor' | 'resume';

export interface CapabilityProbe {
  provider: HandoffProvider;
  executable: string;
  detectedVersion?: string;
  verifiedSyntaxVersion: string;
  status: CapabilityStatus;
  contractFingerprint?: string;
  executionContextFingerprint?: string;
  missingCapabilities: string[];
}

export interface ProviderBehaviorContract {
  provider: HandoffProvider;
  exactVersion: string;
  syntaxFingerprint: string;
  executionContextFingerprint: string;
  successor: {
    status: 'verified' | 'unverified';
    receiptDigest?: string;
    verifiedAt?: string;
  };
  resume: { status: 'unverified' };
}

export interface NativeInvocation {
  executable: 'codex' | 'claude';
  argv: string[];
  cwd: string;
  shell: false;
  stdio: 'pipe';
  timeoutMs: 60_000;
  maxOutputBytes: 65_536;
}

export interface BehavioralGateReceipt {
  schemaVersion: 1;
  provider: HandoffProvider;
  executablePath: string;
  exactVersion: string;
  syntaxFingerprint: string;
  executionContextFingerprint: string;
  operation: 'successor';
  fixture: {
    repositoryRoot: string;
    sourceWorktree: string;
    targetWorktree: string;
  };
  observations: {
    parentNativeId: string;
    requestedChildNativeId?: string;
    observedChildNativeId: string;
    recordedChildCwd: string;
    exactParentLineage: boolean;
    sourceParentResumable: boolean;
    metadataEffects: string[];
  };
  bounds: {
    calls: number;
    timeoutMsPerCall: number;
    outputBytesPerCall: number;
    maxBudgetUsd?: number;
  };
  cleanup: {
    gitFixture: 'removed' | 'failed';
    providerState: 'removed' | 'failed';
    method:
      | 'codex-delete-exact-session-ids'
      | 'claude-purge-exact-disposable-project-paths';
    reasonCodes: HandoffReasonCode[];
  };
  status: 'passed' | 'failed' | 'inconclusive';
  failureStage?: BehaviorGateFailureStage;
  reasonCodes: HandoffReasonCode[];
  createdAt: string;
}

export type PlanDisposition = 'ready' | 'deferred' | 'refused';

export interface HandoffPlanItem {
  key: QualifiedSessionId;
  parentNativeId: string;
  provider: HandoffProvider;
  mode: ContinuityMode;
  disposition: PlanDisposition;
  reasonCodes: HandoffReasonCode[];
  expectedChildNativeId?: string;
  invocation?: NativeInvocation;
}

export interface HandoffPlan {
  schemaVersion: 1;
  source: GitWorktreeEvidence;
  target: GitWorktreeEvidence;
  selected: QualifiedSessionId[];
  baselineTargetIds: QualifiedSessionId[];
  capabilities: CapabilityProbe[];
  items: HandoffPlanItem[];
  confirmationDigest: string;
}

export type NativeOutcome =
  | {
      status: 'not-run' | 'refused';
      retryable: false;
      reasonCode: HandoffReasonCode;
    }
  | { status: 'deferred'; retryable: true; reasonCode: HandoffReasonCode }
  | { status: 'succeeded'; retryable: false; exitCode: 0 }
  | {
      status: 'failed';
      retryable: true;
      failureBoundary: 'before-child-creation';
      exitCode: number | null;
      signal?: string | null;
      reasonCode: HandoffReasonCode;
    }
  | {
      status: 'indeterminate';
      retryable: false;
      exitCode?: number | null;
      signal?: string | null;
      reasonCode: HandoffReasonCode;
    };

export type NotAttemptedReporting = {
  status: 'not-attempted';
  reasonCode?: HandoffReasonCode;
};
export type MappedReporting = {
  status: 'mapped';
  childNativeId: string;
  evidence: 'machine-output-and-transcript';
};
export type UnmappedReporting = {
  status: 'ambiguous' | 'unresolved' | 'failed';
  reasonCode: HandoffReasonCode;
  candidateChildIds?: string[];
};
export type ReportingOutcome =
  | NotAttemptedReporting
  | MappedReporting
  | UnmappedReporting;

export interface ItemOutcomeBase {
  key: QualifiedSessionId;
  parentNativeId: string;
  expectedChildNativeId?: string;
  targetBaselineIds: QualifiedSessionId[];
}

export type ItemOutcome =
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'succeeded' }>;
      observedChildNativeId: string;
      reporting: MappedReporting | UnmappedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'indeterminate' }>;
      observedChildNativeId: string;
      reporting: MappedReporting | UnmappedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'indeterminate' }>;
      observedChildNativeId?: never;
      reporting: UnmappedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<NativeOutcome, { status: 'failed' }>;
      observedChildNativeId?: never;
      reporting: NotAttemptedReporting;
    })
  | (ItemOutcomeBase & {
      native: Extract<
        NativeOutcome,
        { status: 'not-run' | 'deferred' | 'refused' }
      >;
      observedChildNativeId?: never;
      reporting: NotAttemptedReporting;
    });

export interface BatchOutcome {
  schemaVersion: 1;
  planDigest: string;
  items: ItemOutcome[];
  retryableKeys: QualifiedSessionId[];
}

export interface SuccessEnvelope<T> {
  ok: true;
  command: HandoffCommand;
  data: T;
}

export interface ErrorEnvelope {
  ok: false;
  command?: string;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class SchemaValidationError extends TypeError {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'SchemaValidationError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new SchemaValidationError(code);
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`unknown-field:${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`missing-field:${key}`);
  }
}

function string(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code);
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || codePoint < 0x20 || codePoint === 0x7f)
      fail(code);
  }
  return value;
}

function previewText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail('preview-entry-text');
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const allowedWhitespace =
      codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d;
    if (
      codePoint === undefined ||
      (codePoint < 0x20 && !allowedWhitespace) ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    ) {
      fail('preview-entry-text');
    }
  }
  return value;
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function integer(value: unknown, code: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) fail(code);
  return value as number;
}

function finite(value: unknown, code: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum)
    fail(code);
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  code: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(code);
  return value as T;
}

function array<T>(
  value: unknown,
  parser: (item: unknown) => T,
  code: string,
): T[] {
  if (!Array.isArray(value)) fail(code);
  return value.map(parser);
}

function unique<T>(values: readonly T[], code: string): void {
  if (new Set(values).size !== values.length) fail(code);
}

function digest(value: unknown, code: string): string {
  const parsed = string(value, code);
  if (!/^[0-9a-f]{64}$/u.test(parsed)) fail(code);
  return parsed;
}

function isoTimestamp(value: unknown, code: string): string {
  const parsed = string(value, code);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(parsed) ||
    !Number.isFinite(Date.parse(parsed))
  ) {
    fail(code);
  }
  return parsed;
}

function gitObjectId(value: unknown): string {
  const parsed = string(value, 'git-head');
  if (!/^[0-9a-f]{40,64}$/u.test(parsed)) fail('git-head');
  return parsed;
}

function nativeId(value: unknown): string {
  return string(value, 'native-session-id');
}

function parseReasonCode(value: unknown): HandoffReasonCode {
  return enumValue(value, HANDOFF_REASON_CODES, 'reason-code');
}

function parseReasonCodes(value: unknown): HandoffReasonCode[] {
  const parsed = array(value, parseReasonCode, 'reason-codes');
  unique(parsed, 'duplicate-reason-code');
  return parsed;
}

export function parseQualifiedSessionId(value: unknown): QualifiedSessionId {
  const parsed = string(value, 'qualified-session-id');
  const separator = parsed.indexOf(':');
  if (separator <= 0 || separator === parsed.length - 1)
    fail('qualified-session-id');
  const provider = parsed.slice(0, separator);
  if (!HANDOFF_PROVIDERS.includes(provider as HandoffProvider))
    fail('qualified-session-id');
  nativeId(parsed.slice(separator + 1));
  return parsed as QualifiedSessionId;
}

export function parseSessionCandidate(value: unknown): SessionCandidate {
  const candidate = record(value, 'session-candidate');
  exactKeys(candidate, [
    'key',
    'provider',
    'nativeId',
    'recordedCwd',
    'modifiedAtMs',
    'size',
    'engagement',
    'currentEvidence',
  ]);
  const key = parseQualifiedSessionId(candidate.key);
  const provider = enumValue(
    candidate.provider,
    HANDOFF_PROVIDERS,
    'handoff-provider',
  );
  const id = nativeId(candidate.nativeId);
  if (key !== `${provider}:${id}`) fail('candidate-identity-mismatch');
  return {
    key,
    provider,
    nativeId: id,
    recordedCwd: string(candidate.recordedCwd, 'recorded-cwd'),
    modifiedAtMs: finite(candidate.modifiedAtMs, 'modified-at-ms'),
    size: integer(candidate.size, 'candidate-size'),
    engagement: enumValue(
      candidate.engagement,
      ['engaged', 'unengaged', 'unknown'] as const,
      'candidate-engagement',
    ),
    currentEvidence: enumValue(
      candidate.currentEvidence,
      ['direct-environment', 'explicit-self', 'none'] as const,
      'candidate-current-evidence',
    ),
  };
}

export function parsePreviewBatchLimits(value: unknown): PreviewBatchLimits {
  const limits = record(value, 'preview-batch-limits');
  exactKeys(limits, [
    'maxCandidates',
    'maxAggregateInputBytes',
    'maxAggregateInputRecords',
    'deadlineMs',
    'maxAggregateRenderedCharacters',
  ]);
  const parsed = {
    maxCandidates: integer(
      limits.maxCandidates,
      'preview-limit-out-of-range',
      1,
    ),
    maxAggregateInputBytes: integer(
      limits.maxAggregateInputBytes,
      'preview-limit-out-of-range',
      1,
    ),
    maxAggregateInputRecords: integer(
      limits.maxAggregateInputRecords,
      'preview-limit-out-of-range',
      1,
    ),
    deadlineMs: integer(limits.deadlineMs, 'preview-limit-out-of-range', 1),
    maxAggregateRenderedCharacters: integer(
      limits.maxAggregateRenderedCharacters,
      'preview-limit-out-of-range',
      1,
    ),
  };
  for (const key of Object.keys(parsed) as (keyof PreviewBatchLimits)[]) {
    if (parsed[key] > DEFAULT_PREVIEW_BATCH_LIMITS[key])
      fail('preview-limit-out-of-range');
  }
  return parsed;
}

export function parseSessionPreviewLimits(
  value: unknown,
): SessionPreviewLimits {
  const limits = record(value, 'session-preview-limits');
  exactKeys(limits, ['maxRounds', 'maxCharacters']);
  const parsed = {
    maxRounds: integer(limits.maxRounds, 'preview-limit-out-of-range', 1),
    maxCharacters: integer(
      limits.maxCharacters,
      'preview-limit-out-of-range',
      1,
    ),
  };
  if (
    parsed.maxRounds > MAX_SESSION_PREVIEW_LIMITS.maxRounds ||
    parsed.maxCharacters > MAX_SESSION_PREVIEW_LIMITS.maxCharacters
  ) {
    fail('preview-limit-out-of-range');
  }
  return parsed;
}

function parsePreviewEntry(value: unknown): PreviewEntry {
  const entry = record(value, 'preview-entry');
  exactKeys(entry, ['role', 'text']);
  return {
    role: enumValue(
      entry.role,
      ['user', 'assistant'] as const,
      'preview-entry-role',
    ),
    text: previewText(entry.text),
  };
}

export function parseSessionPreview(value: unknown): SessionPreview {
  const preview = record(value, 'session-preview');
  exactKeys(preview, [
    'key',
    'rounds',
    'truncated',
    'omittedEntries',
    'warning',
  ]);
  const rounds = array(
    preview.rounds,
    (round) => array(round, parsePreviewEntry, 'preview-round'),
    'preview-rounds',
  );
  return {
    key: parseQualifiedSessionId(preview.key),
    rounds,
    truncated: boolean(preview.truncated, 'preview-truncated'),
    omittedEntries: integer(preview.omittedEntries, 'preview-omitted-entries'),
    warning: enumValue(
      preview.warning,
      ['hidden-payload-sanitized-not-secret-free'] as const,
      'preview-warning',
    ),
  };
}

export function parseGitWorktreeEvidence(value: unknown): GitWorktreeEvidence {
  const evidence = record(value, 'git-worktree-evidence');
  exactKeys(evidence, [
    'requestedPath',
    'canonicalPath',
    'worktreeRoot',
    'commonGitDir',
    'branch',
    'head',
    'dirty',
    'statusFingerprint',
  ]);
  const branch = evidence.branch;
  if (branch !== null && typeof branch !== 'string') fail('git-branch');
  if (branch === '') fail('git-branch');
  return {
    requestedPath: string(evidence.requestedPath, 'git-requested-path'),
    canonicalPath: string(evidence.canonicalPath, 'git-canonical-path'),
    worktreeRoot: string(evidence.worktreeRoot, 'git-worktree-root'),
    commonGitDir: string(evidence.commonGitDir, 'git-common-dir'),
    branch: branch as string | null,
    head: gitObjectId(evidence.head),
    dirty: boolean(evidence.dirty, 'git-dirty'),
    statusFingerprint: digest(
      evidence.statusFingerprint,
      'git-status-fingerprint',
    ),
  };
}

export function parseCapabilityProbe(value: unknown): CapabilityProbe {
  const probe = record(value, 'capability-probe');
  exactKeys(
    probe,
    [
      'provider',
      'executable',
      'verifiedSyntaxVersion',
      'status',
      'missingCapabilities',
    ],
    ['detectedVersion', 'contractFingerprint', 'executionContextFingerprint'],
  );
  const status = enumValue(
    probe.status,
    CAPABILITY_STATUSES,
    'capability-status',
  );
  const parsed: CapabilityProbe = {
    provider: enumValue(probe.provider, HANDOFF_PROVIDERS, 'handoff-provider'),
    executable: string(probe.executable, 'capability-executable'),
    verifiedSyntaxVersion: string(
      probe.verifiedSyntaxVersion,
      'verified-syntax-version',
    ),
    status,
    missingCapabilities: array(
      probe.missingCapabilities,
      (item) => string(item, 'missing-capability'),
      'missing-capabilities',
    ),
  };
  if (probe.detectedVersion !== undefined) {
    parsed.detectedVersion = string(probe.detectedVersion, 'detected-version');
  }
  if (probe.contractFingerprint !== undefined) {
    parsed.contractFingerprint = digest(
      probe.contractFingerprint,
      'contract-fingerprint',
    );
  }
  if (probe.executionContextFingerprint !== undefined) {
    parsed.executionContextFingerprint = digest(
      probe.executionContextFingerprint,
      'execution-context-fingerprint',
    );
  }
  if (
    status === 'syntax-verified' &&
    (!parsed.detectedVersion ||
      !parsed.contractFingerprint ||
      !parsed.executionContextFingerprint ||
      parsed.missingCapabilities.length > 0)
  ) {
    fail('syntax-verified-evidence');
  }
  return parsed;
}

export function parseProviderBehaviorContract(
  value: unknown,
): ProviderBehaviorContract {
  const contract = record(value, 'provider-behavior-contract');
  exactKeys(contract, [
    'provider',
    'exactVersion',
    'syntaxFingerprint',
    'executionContextFingerprint',
    'successor',
    'resume',
  ]);
  const provider = enumValue(
    contract.provider,
    HANDOFF_PROVIDERS,
    'handoff-provider',
  );
  const successorValue = record(
    contract.successor,
    'provider-behavior-successor',
  );
  const successorStatus = enumValue(
    successorValue.status,
    ['verified', 'unverified'] as const,
    'provider-behavior-status',
  );
  let successor: ProviderBehaviorContract['successor'];
  if (successorStatus === 'verified') {
    exactKeys(successorValue, ['status', 'receiptDigest', 'verifiedAt']);
    successor = {
      status: 'verified',
      receiptDigest: digest(
        successorValue.receiptDigest,
        'behavior-receipt-digest',
      ),
      verifiedAt: isoTimestamp(
        successorValue.verifiedAt,
        'behavior-verified-at',
      ),
    };
  } else {
    exactKeys(successorValue, ['status']);
    successor = { status: 'unverified' };
  }
  const resumeValue = record(contract.resume, 'provider-behavior-resume');
  exactKeys(resumeValue, ['status']);
  if (resumeValue.status !== 'unverified') fail('provider-resume-status');
  return {
    provider,
    exactVersion: string(contract.exactVersion, 'behavior-exact-version'),
    syntaxFingerprint: digest(
      contract.syntaxFingerprint,
      'behavior-syntax-fingerprint',
    ),
    executionContextFingerprint: digest(
      contract.executionContextFingerprint,
      'behavior-execution-context-fingerprint',
    ),
    successor,
    resume: { status: 'unverified' },
  };
}

export function parseBehavioralGateReceipt(
  value: unknown,
): BehavioralGateReceipt {
  const receipt = record(value, 'behavioral-gate-receipt');
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'provider',
      'executablePath',
      'exactVersion',
      'syntaxFingerprint',
      'executionContextFingerprint',
      'operation',
      'fixture',
      'observations',
      'bounds',
      'cleanup',
      'status',
      'createdAt',
      'reasonCodes',
    ],
    ['failureStage'],
  );
  if (receipt.schemaVersion !== HANDOFF_SCHEMA_VERSION) fail('schema-version');
  const provider = enumValue(
    receipt.provider,
    HANDOFF_PROVIDERS,
    'handoff-provider',
  );
  if (receipt.operation !== 'successor') fail('behavior-operation');

  const fixtureValue = record(receipt.fixture, 'behavior-fixture');
  exactKeys(fixtureValue, [
    'repositoryRoot',
    'sourceWorktree',
    'targetWorktree',
  ]);
  const fixture = {
    repositoryRoot: string(
      fixtureValue.repositoryRoot,
      'behavior-repository-root',
    ),
    sourceWorktree: string(
      fixtureValue.sourceWorktree,
      'behavior-source-worktree',
    ),
    targetWorktree: string(
      fixtureValue.targetWorktree,
      'behavior-target-worktree',
    ),
  };
  if (
    fixture.sourceWorktree === fixture.targetWorktree ||
    fixture.repositoryRoot === fixture.sourceWorktree ||
    fixture.repositoryRoot === fixture.targetWorktree
  ) {
    fail('behavior-fixture-paths');
  }

  const observationsValue = record(
    receipt.observations,
    'behavior-observations',
  );
  exactKeys(
    observationsValue,
    [
      'parentNativeId',
      'observedChildNativeId',
      'recordedChildCwd',
      'exactParentLineage',
      'sourceParentResumable',
      'metadataEffects',
    ],
    ['requestedChildNativeId'],
  );
  const metadataEffects = array(
    observationsValue.metadataEffects,
    (item) => string(item, 'behavior-metadata-effect'),
    'behavior-metadata-effects',
  );
  unique(metadataEffects, 'duplicate-behavior-metadata-effect');
  const requestedChildNativeId =
    observationsValue.requestedChildNativeId === undefined
      ? undefined
      : nativeId(observationsValue.requestedChildNativeId);
  if (
    (provider === 'claude' && requestedChildNativeId === undefined) ||
    (provider === 'codex' && requestedChildNativeId !== undefined)
  ) {
    fail('behavior-requested-child-selector');
  }
  const observations: BehavioralGateReceipt['observations'] = {
    parentNativeId: nativeId(observationsValue.parentNativeId),
    observedChildNativeId: nativeId(observationsValue.observedChildNativeId),
    recordedChildCwd: string(
      observationsValue.recordedChildCwd,
      'behavior-recorded-child-cwd',
    ),
    exactParentLineage: boolean(
      observationsValue.exactParentLineage,
      'behavior-exact-parent-lineage',
    ),
    sourceParentResumable: boolean(
      observationsValue.sourceParentResumable,
      'behavior-source-parent-resumable',
    ),
    metadataEffects,
  };
  if (requestedChildNativeId !== undefined) {
    observations.requestedChildNativeId = requestedChildNativeId;
  }

  const boundsValue = record(receipt.bounds, 'behavior-bounds');
  exactKeys(
    boundsValue,
    ['calls', 'timeoutMsPerCall', 'outputBytesPerCall'],
    ['maxBudgetUsd'],
  );
  const calls = integer(boundsValue.calls, 'behavior-calls-bound', 1);
  const timeoutMsPerCall = integer(
    boundsValue.timeoutMsPerCall,
    'behavior-timeout-bound',
    1,
  );
  const outputBytesPerCall = integer(
    boundsValue.outputBytesPerCall,
    'behavior-output-bound',
    1,
  );
  if (calls > 16) fail('behavior-calls-bound');
  if (timeoutMsPerCall > 60_000) fail('behavior-timeout-bound');
  if (outputBytesPerCall > 65_536) fail('behavior-output-bound');
  let maxBudgetUsd: number | undefined;
  if (boundsValue.maxBudgetUsd !== undefined) {
    maxBudgetUsd = finite(
      boundsValue.maxBudgetUsd,
      'behavior-budget-bound',
      Number.EPSILON,
    );
    if (maxBudgetUsd > 0.15) fail('behavior-budget-bound');
  }
  if (
    (provider === 'claude' && maxBudgetUsd === undefined) ||
    (provider === 'codex' && maxBudgetUsd !== undefined)
  ) {
    fail('behavior-budget-provider');
  }
  const bounds: BehavioralGateReceipt['bounds'] = {
    calls,
    timeoutMsPerCall,
    outputBytesPerCall,
  };
  if (maxBudgetUsd !== undefined) bounds.maxBudgetUsd = maxBudgetUsd;

  const cleanupValue = record(receipt.cleanup, 'behavior-cleanup');
  exactKeys(cleanupValue, [
    'gitFixture',
    'providerState',
    'method',
    'reasonCodes',
  ]);
  const cleanup = {
    gitFixture: enumValue(
      cleanupValue.gitFixture,
      ['removed', 'failed'] as const,
      'behavior-git-cleanup',
    ),
    providerState: enumValue(
      cleanupValue.providerState,
      ['removed', 'failed'] as const,
      'behavior-provider-cleanup',
    ),
    method: enumValue(
      cleanupValue.method,
      [
        'codex-delete-exact-session-ids',
        'claude-purge-exact-disposable-project-paths',
      ] as const,
      'behavior-cleanup-method',
    ),
    reasonCodes: parseReasonCodes(cleanupValue.reasonCodes),
  };
  const expectedCleanupMethod =
    provider === 'codex'
      ? 'codex-delete-exact-session-ids'
      : 'claude-purge-exact-disposable-project-paths';
  if (cleanup.method !== expectedCleanupMethod) {
    fail('behavior-cleanup-provider-mismatch');
  }
  const cleanupFailed =
    cleanup.gitFixture === 'failed' || cleanup.providerState === 'failed';
  if (cleanupFailed !== cleanup.reasonCodes.length > 0) {
    fail('behavior-cleanup-reasons');
  }

  const status = enumValue(
    receipt.status,
    ['passed', 'failed', 'inconclusive'] as const,
    'behavior-receipt-status',
  );
  const reasonCodes = parseReasonCodes(receipt.reasonCodes);
  const failureStage =
    receipt.failureStage === undefined
      ? undefined
      : enumValue(
          receipt.failureStage,
          BEHAVIOR_GATE_FAILURE_STAGES,
          'behavior-failure-stage',
        );
  if (cleanupFailed && status !== 'inconclusive') {
    fail('behavior-cleanup-inconclusive');
  }
  if (status === 'passed') {
    if (
      cleanupFailed ||
      failureStage !== undefined ||
      reasonCodes.length > 0 ||
      observations.parentNativeId === observations.observedChildNativeId ||
      !observations.exactParentLineage ||
      !observations.sourceParentResumable ||
      observations.recordedChildCwd !== fixture.targetWorktree ||
      observations.metadataEffects.length === 0 ||
      (provider === 'claude' &&
        observations.requestedChildNativeId !==
          observations.observedChildNativeId)
    ) {
      fail('behavior-passed-evidence');
    }
  } else if (reasonCodes.length === 0) {
    fail('behavior-failure-reason');
  } else if (
    failureStage !== undefined &&
    !reasonCodes.includes('reporting-failed')
  ) {
    fail('behavior-failure-stage-reason');
  }

  return {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    provider,
    executablePath: string(receipt.executablePath, 'behavior-executable-path'),
    exactVersion: string(receipt.exactVersion, 'behavior-exact-version'),
    syntaxFingerprint: digest(
      receipt.syntaxFingerprint,
      'behavior-syntax-fingerprint',
    ),
    executionContextFingerprint: digest(
      receipt.executionContextFingerprint,
      'behavior-execution-context-fingerprint',
    ),
    operation: 'successor',
    fixture,
    observations,
    bounds,
    cleanup,
    status,
    ...(failureStage === undefined ? {} : { failureStage }),
    reasonCodes,
    createdAt: isoTimestamp(receipt.createdAt, 'behavior-created-at'),
  };
}

export function parseNativeInvocation(value: unknown): NativeInvocation {
  const invocation = record(value, 'native-invocation');
  exactKeys(invocation, [
    'executable',
    'argv',
    'cwd',
    'shell',
    'stdio',
    'timeoutMs',
    'maxOutputBytes',
  ]);
  if (invocation.shell !== false) fail('native-invocation-shell');
  if (invocation.timeoutMs !== 60_000) fail('native-invocation-timeout');
  if (invocation.maxOutputBytes !== 65_536)
    fail('native-invocation-output-bound');
  return {
    executable: enumValue(
      invocation.executable,
      ['codex', 'claude'] as const,
      'native-invocation-executable',
    ),
    argv: array(
      invocation.argv,
      (item) => string(item, 'native-invocation-argument'),
      'native-invocation-argv',
    ),
    cwd: string(invocation.cwd, 'native-invocation-cwd'),
    shell: false,
    stdio: enumValue(
      invocation.stdio,
      ['pipe'] as const,
      'native-invocation-stdio',
    ),
    timeoutMs: 60_000,
    maxOutputBytes: 65_536,
  };
}

function parsePlanItem(value: unknown): HandoffPlanItem {
  const item = record(value, 'handoff-plan-item');
  exactKeys(
    item,
    ['key', 'parentNativeId', 'provider', 'mode', 'disposition', 'reasonCodes'],
    ['expectedChildNativeId', 'invocation'],
  );
  const key = parseQualifiedSessionId(item.key);
  const provider = enumValue(
    item.provider,
    HANDOFF_PROVIDERS,
    'handoff-provider',
  );
  const parentNativeId = nativeId(item.parentNativeId);
  if (key !== `${provider}:${parentNativeId}`)
    fail('plan-item-identity-mismatch');
  const disposition = enumValue(
    item.disposition,
    ['ready', 'deferred', 'refused'] as const,
    'plan-disposition',
  );
  const reasonCodes = parseReasonCodes(item.reasonCodes);
  if (disposition === 'ready' && reasonCodes.length > 0)
    fail('ready-item-reason-codes');
  if (disposition !== 'ready' && reasonCodes.length === 0)
    fail('non-ready-reason-code');
  if (disposition === 'ready' && item.invocation === undefined)
    fail('ready-item-invocation');
  if (disposition !== 'ready' && item.invocation !== undefined) {
    fail('non-ready-item-invocation');
  }
  const parsed: HandoffPlanItem = {
    key,
    parentNativeId,
    provider,
    mode: enumValue(
      item.mode,
      ['successor', 'resume'] as const,
      'continuity-mode',
    ),
    disposition,
    reasonCodes,
  };
  if (item.expectedChildNativeId !== undefined) {
    parsed.expectedChildNativeId = nativeId(item.expectedChildNativeId);
  }
  if (item.invocation !== undefined)
    parsed.invocation = parseNativeInvocation(item.invocation);
  return parsed;
}

export function parseHandoffPlan(value: unknown): HandoffPlan {
  const plan = record(value, 'handoff-plan');
  exactKeys(plan, [
    'schemaVersion',
    'source',
    'target',
    'selected',
    'baselineTargetIds',
    'capabilities',
    'items',
    'confirmationDigest',
  ]);
  if (plan.schemaVersion !== HANDOFF_SCHEMA_VERSION) fail('schema-version');
  const selected = array(
    plan.selected,
    parseQualifiedSessionId,
    'selected-session-ids',
  );
  if (selected.length === 0) fail('empty-selection');
  unique(selected, 'duplicate-selection');
  const baselineTargetIds = array(
    plan.baselineTargetIds,
    parseQualifiedSessionId,
    'baseline-target-ids',
  );
  unique(baselineTargetIds, 'duplicate-baseline-target-id');
  const capabilities = array(
    plan.capabilities,
    parseCapabilityProbe,
    'capability-probes',
  );
  unique(
    capabilities.map((probe) => probe.provider),
    'duplicate-capability-provider',
  );
  const items = array(plan.items, parsePlanItem, 'handoff-plan-items');
  unique(
    items.map((item) => item.key),
    'duplicate-plan-item',
  );
  if (
    selected.length !== items.length ||
    selected.some((key, index) => items[index]?.key !== key)
  ) {
    fail('plan-selection-items-mismatch');
  }
  return {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    source: parseGitWorktreeEvidence(plan.source),
    target: parseGitWorktreeEvidence(plan.target),
    selected,
    baselineTargetIds,
    capabilities,
    items,
    confirmationDigest: digest(plan.confirmationDigest, 'confirmation-digest'),
  };
}

function parseReporting(value: unknown): ReportingOutcome {
  const reporting = record(value, 'reporting-outcome');
  const status = enumValue(
    reporting.status,
    ['not-attempted', 'mapped', 'ambiguous', 'unresolved', 'failed'] as const,
    'reporting-status',
  );
  if (status === 'not-attempted') {
    exactKeys(reporting, ['status'], ['reasonCode']);
    const parsed: NotAttemptedReporting = { status };
    if (reporting.reasonCode !== undefined)
      parsed.reasonCode = parseReasonCode(reporting.reasonCode);
    return parsed;
  }
  if (status === 'mapped') {
    exactKeys(reporting, ['status', 'childNativeId', 'evidence']);
    return {
      status,
      childNativeId: nativeId(reporting.childNativeId),
      evidence: enumValue(
        reporting.evidence,
        ['machine-output-and-transcript'] as const,
        'reporting-evidence',
      ),
    };
  }
  exactKeys(reporting, ['status', 'reasonCode'], ['candidateChildIds']);
  const parsed: UnmappedReporting = {
    status,
    reasonCode: parseReasonCode(reporting.reasonCode),
  };
  if (reporting.candidateChildIds !== undefined) {
    parsed.candidateChildIds = array(
      reporting.candidateChildIds,
      nativeId,
      'candidate-child-ids',
    );
    unique(parsed.candidateChildIds, 'duplicate-candidate-child-id');
  }
  return parsed;
}

function parseExitCode(value: unknown, code: string): number | null {
  if (value === null) return null;
  return integer(value, code);
}

function parseSignal(value: unknown): string | null {
  if (value === null) return null;
  return string(value, 'native-signal');
}

function parseNativeOutcome(value: unknown): NativeOutcome {
  const native = record(value, 'native-outcome');
  const status = enumValue(
    native.status,
    [
      'not-run',
      'refused',
      'deferred',
      'succeeded',
      'failed',
      'indeterminate',
    ] as const,
    'native-status',
  );
  if (status === 'not-run' || status === 'refused') {
    exactKeys(native, ['status', 'retryable', 'reasonCode']);
    if (native.retryable !== false) fail('native-retryable');
    return {
      status,
      retryable: false,
      reasonCode: parseReasonCode(native.reasonCode),
    };
  }
  if (status === 'deferred') {
    exactKeys(native, ['status', 'retryable', 'reasonCode']);
    if (native.retryable !== true) fail('native-retryable');
    return {
      status,
      retryable: true,
      reasonCode: parseReasonCode(native.reasonCode),
    };
  }
  if (status === 'succeeded') {
    exactKeys(native, ['status', 'retryable', 'exitCode']);
    if (native.retryable !== false || native.exitCode !== 0)
      fail('native-succeeded-shape');
    return { status, retryable: false, exitCode: 0 };
  }
  if (status === 'failed') {
    exactKeys(
      native,
      ['status', 'retryable', 'failureBoundary', 'exitCode', 'reasonCode'],
      ['signal'],
    );
    if (
      native.retryable !== true ||
      native.failureBoundary !== 'before-child-creation'
    ) {
      fail('native-failed-shape');
    }
    const parsed: Extract<NativeOutcome, { status: 'failed' }> = {
      status,
      retryable: true,
      failureBoundary: 'before-child-creation',
      exitCode: parseExitCode(native.exitCode, 'native-exit-code'),
      reasonCode: parseReasonCode(native.reasonCode),
    };
    if (native.signal !== undefined) parsed.signal = parseSignal(native.signal);
    return parsed;
  }
  exactKeys(
    native,
    ['status', 'retryable', 'reasonCode'],
    ['exitCode', 'signal'],
  );
  if (native.retryable !== false) fail('native-retryable');
  const parsed: Extract<NativeOutcome, { status: 'indeterminate' }> = {
    status,
    retryable: false,
    reasonCode: parseReasonCode(native.reasonCode),
  };
  if (native.exitCode !== undefined) {
    parsed.exitCode = parseExitCode(native.exitCode, 'native-exit-code');
  }
  if (native.signal !== undefined) parsed.signal = parseSignal(native.signal);
  return parsed;
}

function parseItemOutcome(value: unknown): ItemOutcome {
  const item = record(value, 'item-outcome');
  exactKeys(
    item,
    ['key', 'parentNativeId', 'targetBaselineIds', 'native', 'reporting'],
    ['expectedChildNativeId', 'observedChildNativeId'],
  );
  const key = parseQualifiedSessionId(item.key);
  const parentNativeId = nativeId(item.parentNativeId);
  if (key.slice(key.indexOf(':') + 1) !== parentNativeId)
    fail('outcome-identity-mismatch');
  const native = parseNativeOutcome(item.native);
  const reporting = parseReporting(item.reporting);
  const targetBaselineIds = array(
    item.targetBaselineIds,
    parseQualifiedSessionId,
    'target-baseline-ids',
  );
  unique(targetBaselineIds, 'duplicate-baseline-target-id');
  const expectedChildNativeId =
    item.expectedChildNativeId === undefined
      ? undefined
      : nativeId(item.expectedChildNativeId);
  const observedChildNativeId =
    item.observedChildNativeId === undefined
      ? undefined
      : nativeId(item.observedChildNativeId);

  if (native.status === 'succeeded' && observedChildNativeId === undefined) {
    fail('succeeded-observed-child-required');
  }
  if (
    ['failed', 'deferred', 'not-run', 'refused'].includes(native.status) &&
    observedChildNativeId !== undefined
  ) {
    fail(
      native.status === 'failed'
        ? 'failed-child-evidence'
        : 'unattempted-child-evidence',
    );
  }
  if (
    (native.status === 'failed' ||
      native.status === 'deferred' ||
      native.status === 'not-run' ||
      native.status === 'refused') !==
    (reporting.status === 'not-attempted')
  ) {
    fail('native-reporting-state-mismatch');
  }
  if (reporting.status === 'mapped') {
    if (
      observedChildNativeId === undefined ||
      reporting.childNativeId !== observedChildNativeId ||
      (expectedChildNativeId !== undefined &&
        reporting.childNativeId !== expectedChildNativeId)
    ) {
      fail('mapped-selector-mismatch');
    }
  }

  const parsed = {
    key,
    parentNativeId,
    targetBaselineIds,
    native,
    reporting,
    ...(expectedChildNativeId === undefined ? {} : { expectedChildNativeId }),
    ...(observedChildNativeId === undefined ? {} : { observedChildNativeId }),
  };
  return parsed as ItemOutcome;
}

export function parseBatchOutcome(value: unknown): BatchOutcome {
  const batch = record(value, 'batch-outcome');
  exactKeys(batch, ['schemaVersion', 'planDigest', 'items', 'retryableKeys']);
  if (batch.schemaVersion !== HANDOFF_SCHEMA_VERSION) fail('schema-version');
  const items = array(batch.items, parseItemOutcome, 'item-outcomes');
  unique(
    items.map((item) => item.key),
    'duplicate-outcome-item',
  );
  const retryableKeys = array(
    batch.retryableKeys,
    parseQualifiedSessionId,
    'retryable-keys',
  );
  unique(retryableKeys, 'duplicate-retryable-key');
  const expected = items
    .filter(
      (item) =>
        item.native.status === 'deferred' || item.native.status === 'failed',
    )
    .map((item) => item.key);
  if (
    expected.length !== retryableKeys.length ||
    expected.some((key, index) => retryableKeys[index] !== key)
  ) {
    fail('retryable-keys-mismatch');
  }
  return {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    planDigest: digest(batch.planDigest, 'plan-digest'),
    items,
    retryableKeys,
  };
}

export function parseSuccessEnvelope<T = unknown>(
  value: unknown,
): SuccessEnvelope<T> {
  const envelope = record(value, 'success-envelope');
  exactKeys(envelope, ['ok', 'command', 'data']);
  if (envelope.ok !== true) fail('success-envelope-ok');
  return {
    ok: true,
    command: enumValue(envelope.command, HANDOFF_COMMANDS, 'handoff-command'),
    data: envelope.data as T,
  };
}

export function parseErrorEnvelope(value: unknown): ErrorEnvelope {
  const envelope = record(value, 'error-envelope');
  exactKeys(envelope, ['ok', 'error'], ['command']);
  if (envelope.ok !== false) fail('error-envelope-ok');
  const error = record(envelope.error, 'error-envelope-error');
  exactKeys(error, ['code', 'message'], ['details']);
  let details: Record<string, unknown> | undefined;
  if (error.details !== undefined)
    details = record(error.details, 'error-details');
  const parsed: ErrorEnvelope = {
    ok: false,
    error: {
      code: string(error.code, 'error-code'),
      message: string(error.message, 'error-message'),
      ...(details === undefined ? {} : { details }),
    },
  };
  if (envelope.command !== undefined) {
    parsed.command = string(envelope.command, 'error-command');
  }
  return parsed;
}
