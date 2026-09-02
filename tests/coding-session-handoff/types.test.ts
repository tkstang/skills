import { describe, expect, expectTypeOf, test } from 'vitest';

import {
  DEFAULT_PREVIEW_BATCH_LIMITS,
  HANDOFF_SCHEMA_VERSION,
  SchemaValidationError,
  parseBehavioralGateReceipt,
  parseBatchOutcome,
  parseCapabilityProbe,
  parseErrorEnvelope,
  parseGitWorktreeEvidence,
  parseHandoffPlan,
  parseNativeInvocation,
  parsePreviewBatchLimits,
  parseProviderBehaviorContract,
  parseQualifiedSessionId,
  parseSessionCandidate,
  parseSessionPreview,
  parseSuccessEnvelope,
  type ItemOutcome,
} from '../../src/transcript/coding-session-handoff/types.js';

const gitEvidence = {
  requestedPath: '/repo/source',
  canonicalPath: '/repo/source',
  worktreeRoot: '/repo/source',
  commonGitDir: '/repo/.git',
  branch: 'feature',
  head: 'a'.repeat(40),
  dirty: false,
  statusFingerprint: 'b'.repeat(64),
};

const invocation = {
  executable: 'codex',
  argv: ['exec', 'fork', '--json', 'parent'],
  cwd: '/repo/target',
  shell: false,
  stdio: 'pipe',
  timeoutMs: 60_000,
  maxOutputBytes: 65_536,
};

const capability = {
  provider: 'codex',
  executable: '/usr/local/bin/codex',
  detectedVersion: '0.151.0',
  verifiedSyntaxVersion: '0.151.0',
  status: 'syntax-verified',
  contractFingerprint: 'c'.repeat(64),
  executionContextFingerprint: 'd'.repeat(64),
  missingCapabilities: [],
};

const plan = {
  schemaVersion: HANDOFF_SCHEMA_VERSION,
  source: gitEvidence,
  target: {
    ...gitEvidence,
    requestedPath: '/repo/target',
    canonicalPath: '/repo/target',
    worktreeRoot: '/repo/target',
  },
  selected: ['codex:parent'],
  baselineTargetIds: ['claude:existing'],
  capabilities: [capability],
  items: [
    {
      key: 'codex:parent',
      parentNativeId: 'parent',
      provider: 'codex',
      mode: 'successor',
      disposition: 'ready',
      reasonCodes: [],
      invocation,
    },
  ],
  confirmationDigest: 'e'.repeat(64),
};

const codexReceipt = {
  schemaVersion: 1,
  provider: 'codex',
  executablePath: '/usr/local/bin/codex',
  exactVersion: '0.151.0',
  syntaxFingerprint: '1'.repeat(64),
  executionContextFingerprint: '2'.repeat(64),
  operation: 'successor',
  fixture: {
    repositoryRoot: '/tmp/gate',
    sourceWorktree: '/tmp/gate/source',
    targetWorktree: '/tmp/gate/target',
  },
  observations: {
    parentNativeId: 'parent',
    observedChildNativeId: 'child',
    recordedChildCwd: '/tmp/gate/target',
    exactParentLineage: true,
    sourceParentResumable: true,
    metadataEffects: ['created-child-record'],
  },
  bounds: {
    calls: 4,
    timeoutMsPerCall: 60_000,
    outputBytesPerCall: 65_536,
  },
  cleanup: {
    gitFixture: 'removed',
    providerState: 'removed',
    method: 'codex-delete-exact-session-ids',
    reasonCodes: [],
  },
  status: 'passed',
  reasonCodes: [],
  createdAt: '2026-08-31T05:00:00Z',
};

const claudeReceipt = {
  ...codexReceipt,
  provider: 'claude',
  executablePath: '/usr/local/bin/claude',
  exactVersion: '2.1.251',
  observations: {
    ...codexReceipt.observations,
    requestedChildNativeId: 'child',
  },
  bounds: { ...codexReceipt.bounds, maxBudgetUsd: 0.15 },
  cleanup: {
    ...codexReceipt.cleanup,
    method: 'claude-purge-exact-disposable-project-paths',
  },
};

describe('qualified session and candidate schemas', () => {
  test('accepts provider-qualified IDs and rejects bare or empty IDs', () => {
    expect(parseQualifiedSessionId('codex:abc')).toBe('codex:abc');
    expect(parseQualifiedSessionId('claude:abc:def')).toBe('claude:abc:def');
    expect(() => parseQualifiedSessionId('abc')).toThrow(SchemaValidationError);
    expect(() => parseQualifiedSessionId('cursor:abc')).toThrow(
      'qualified-session-id',
    );
    expect(() => parseQualifiedSessionId('codex:')).toThrow(
      'qualified-session-id',
    );
  });

  test('requires candidate key/provider/native ID agreement', () => {
    expect(
      parseSessionCandidate({
        key: 'codex:abc',
        provider: 'codex',
        nativeId: 'abc',
        recordedCwd: '/repo/source',
        modifiedAtMs: 10,
        size: 20,
        engagement: 'engaged',
        currentEvidence: 'direct-environment',
      }),
    ).toMatchObject({ key: 'codex:abc' });
    expect(() =>
      parseSessionCandidate({
        key: 'claude:abc',
        provider: 'codex',
        nativeId: 'abc',
        recordedCwd: '/repo/source',
        modifiedAtMs: 10,
        size: 20,
        engagement: 'unknown',
        currentEvidence: 'none',
      }),
    ).toThrow('candidate-identity-mismatch');
  });
});

describe('preview schemas and limits', () => {
  test('freezes aggregate defaults and validates configured hard bounds', () => {
    expect(DEFAULT_PREVIEW_BATCH_LIMITS).toEqual({
      maxCandidates: 20,
      maxAggregateInputBytes: 33_554_432,
      maxAggregateInputRecords: 100_000,
      deadlineMs: 10_000,
      maxAggregateRenderedCharacters: 131_072,
    });
    expect(parsePreviewBatchLimits(DEFAULT_PREVIEW_BATCH_LIMITS)).toEqual(
      DEFAULT_PREVIEW_BATCH_LIMITS,
    );
    expect(() =>
      parsePreviewBatchLimits({
        ...DEFAULT_PREVIEW_BATCH_LIMITS,
        maxCandidates: 21,
      }),
    ).toThrow('preview-limit-out-of-range');
  });

  test('accepts only bounded conversation entries and the required warning', () => {
    expect(
      parseSessionPreview({
        key: 'claude:abc',
        rounds: [
          [
            { role: 'user', text: 'hello' },
            { role: 'assistant', text: 'hi' },
          ],
        ],
        truncated: false,
        omittedEntries: 0,
        warning: 'hidden-payload-sanitized-not-secret-free',
      }),
    ).toMatchObject({ key: 'claude:abc' });
    expect(() =>
      parseSessionPreview({
        key: 'claude:abc',
        rounds: [[{ role: 'tool', text: 'secret' }]],
        truncated: false,
        omittedEntries: 0,
        warning: 'hidden-payload-sanitized-not-secret-free',
      }),
    ).toThrow('preview-entry-role');
  });

  test('allows preview newlines and tabs while rejecting unsafe controls', () => {
    const preview = {
      key: 'claude:abc',
      rounds: [
        [
          {
            role: 'user',
            text: 'first line\n\tindented second line',
          },
        ],
      ],
      truncated: false,
      omittedEntries: 0,
      warning: 'hidden-payload-sanitized-not-secret-free',
    };

    expect(parseSessionPreview(preview).rounds[0]?.[0]?.text).toBe(
      'first line\n\tindented second line',
    );
    for (const control of ['\0', '\u001b', '\u007f', '\u009b']) {
      expect(() =>
        parseSessionPreview({
          ...preview,
          rounds: [[{ role: 'user', text: `unsafe${control}text` }]],
        }),
      ).toThrow('preview-entry-text');
    }
  });
});

describe('Git, capability, invocation, plan, and envelope schemas', () => {
  test('accepts detached Git evidence and rejects raw status additions', () => {
    expect(
      parseGitWorktreeEvidence({ ...gitEvidence, branch: null }).branch,
    ).toBeNull();
    expect(() =>
      parseGitWorktreeEvidence({ ...gitEvidence, status: ' M private.txt' }),
    ).toThrow('unknown-field');
  });

  test('validates capability and exact bounded invocation constants', () => {
    expect(parseCapabilityProbe(capability).status).toBe('syntax-verified');
    expect(parseNativeInvocation(invocation).shell).toBe(false);
    expect(() => parseNativeInvocation({ ...invocation, shell: true })).toThrow(
      'native-invocation-shell',
    );
    expect(() =>
      parseNativeInvocation({ ...invocation, timeoutMs: 60_001 }),
    ).toThrow('native-invocation-timeout');
  });

  test('keeps preview structurally absent from plans', () => {
    expect(parseHandoffPlan(plan)).toMatchObject({
      selected: ['codex:parent'],
    });
    expect(() => parseHandoffPlan({ ...plan, preview: [] })).toThrow(
      'unknown-field',
    );
  });

  test('validates success and error JSON envelopes', () => {
    expect(
      parseSuccessEnvelope({ ok: true, command: 'plan', data: plan }).ok,
    ).toBe(true);
    expect(
      parseErrorEnvelope({
        ok: false,
        command: 'plan',
        error: { code: 'source-dirty', message: 'Source worktree is dirty' },
      }).ok,
    ).toBe(false);
  });
});

describe('behavioral receipt and provider contract schemas', () => {
  test('accepts canonical passed Codex and Claude receipts', () => {
    expect(parseBehavioralGateReceipt(codexReceipt)).toMatchObject({
      provider: 'codex',
      status: 'passed',
    });
    expect(parseBehavioralGateReceipt(claudeReceipt)).toMatchObject({
      provider: 'claude',
      observations: { requestedChildNativeId: 'child' },
    });
  });

  test('accepts an optional stable gate failure stage without weakening legacy receipts', () => {
    for (const failureStage of [
      'provider-call-exception',
      'native-identity-missing',
      'native-identity-invalid',
      'native-identity-multiple',
      'native-identity-unresolved',
    ]) {
      expect(
        parseBehavioralGateReceipt({
          ...codexReceipt,
          failureStage,
          status: 'inconclusive',
          reasonCodes: ['reporting-failed'],
        }),
      ).toMatchObject({
        status: 'inconclusive',
        failureStage,
      });
    }
    expect(parseBehavioralGateReceipt(codexReceipt)).not.toHaveProperty(
      'failureStage',
    );
  });

  test('rejects unknown gate failure stages and stages on passed receipts', () => {
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        failureStage: 'raw-provider-message',
        status: 'inconclusive',
        reasonCodes: ['reporting-failed'],
      }),
    ).toThrow();
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        failureStage: 'evidence-validation',
      }),
    ).toThrow();
  });

  test('accepts verified and unverified provider behavior contracts with exact provenance', () => {
    expect(
      parseProviderBehaviorContract({
        provider: 'codex',
        exactVersion: '0.151.0',
        syntaxFingerprint: '3'.repeat(64),
        executionContextFingerprint: '4'.repeat(64),
        successor: {
          status: 'verified',
          receiptDigest: '5'.repeat(64),
          verifiedAt: '2026-08-31T05:00:00Z',
        },
        resume: { status: 'unverified' },
      }),
    ).toMatchObject({ successor: { status: 'verified' } });
    expect(
      parseProviderBehaviorContract({
        provider: 'claude',
        exactVersion: '2.1.251',
        syntaxFingerprint: '3'.repeat(64),
        executionContextFingerprint: '4'.repeat(64),
        successor: { status: 'unverified' },
        resume: { status: 'unverified' },
      }),
    ).toMatchObject({ successor: { status: 'unverified' } });
  });

  test('rejects unknown fields and contradictory passed cleanup', () => {
    expect(() =>
      parseBehavioralGateReceipt({ ...codexReceipt, rawOutput: 'secret' }),
    ).toThrow('unknown-field');
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        cleanup: {
          ...codexReceipt.cleanup,
          providerState: 'failed',
          reasonCodes: ['provider-probe-failed'],
        },
      }),
    ).toThrow('behavior-cleanup-inconclusive');
  });

  test('accepts cleanup failure only as an inconclusive receipt', () => {
    expect(
      parseBehavioralGateReceipt({
        ...codexReceipt,
        cleanup: {
          ...codexReceipt.cleanup,
          providerState: 'failed',
          reasonCodes: ['provider-probe-failed'],
        },
        status: 'inconclusive',
        reasonCodes: ['provider-probe-failed'],
      }),
    ).toMatchObject({ status: 'inconclusive' });
  });

  test('rejects missing Claude selector and missing passed lineage evidence', () => {
    const { requestedChildNativeId: _selector, ...withoutSelector } =
      claudeReceipt.observations;
    expect(() =>
      parseBehavioralGateReceipt({
        ...claudeReceipt,
        observations: withoutSelector,
      }),
    ).toThrow('behavior-requested-child-selector');
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        observations: {
          ...codexReceipt.observations,
          exactParentLineage: false,
        },
      }),
    ).toThrow('behavior-passed-evidence');
  });

  test('rejects passed Codex and Claude receipts whose child equals the parent', () => {
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        observations: {
          ...codexReceipt.observations,
          observedChildNativeId: codexReceipt.observations.parentNativeId,
        },
      }),
    ).toThrow('behavior-passed-evidence');
    expect(() =>
      parseBehavioralGateReceipt({
        ...claudeReceipt,
        observations: {
          ...claudeReceipt.observations,
          requestedChildNativeId: claudeReceipt.observations.parentNativeId,
          observedChildNativeId: claudeReceipt.observations.parentNativeId,
        },
      }),
    ).toThrow('behavior-passed-evidence');
  });

  test('rejects malformed digests, provider cleanup mismatch, and unbounded calls', () => {
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        syntaxFingerprint: 'not-a-digest',
      }),
    ).toThrow('behavior-syntax-fingerprint');
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        cleanup: {
          ...codexReceipt.cleanup,
          method: 'claude-purge-exact-disposable-project-paths',
        },
      }),
    ).toThrow('behavior-cleanup-provider-mismatch');
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        bounds: { ...codexReceipt.bounds, calls: 17 },
      }),
    ).toThrow('behavior-calls-bound');
    expect(() =>
      parseBehavioralGateReceipt({
        ...codexReceipt,
        createdAt: '2026-08-31',
      }),
    ).toThrow('behavior-created-at');
  });

  test('rejects verified contracts without receipt provenance and unverified contracts with it', () => {
    const base = {
      provider: 'codex',
      exactVersion: '0.151.0',
      syntaxFingerprint: '3'.repeat(64),
      executionContextFingerprint: '4'.repeat(64),
      resume: { status: 'unverified' },
    };
    expect(() =>
      parseProviderBehaviorContract({
        ...base,
        successor: { status: 'verified' },
      }),
    ).toThrow('missing-field:receiptDigest');
    expect(() =>
      parseProviderBehaviorContract({
        ...base,
        successor: {
          status: 'unverified',
          receiptDigest: '5'.repeat(64),
        },
      }),
    ).toThrow('unknown-field:receiptDigest');
  });
});

describe('cross-discriminated batch outcomes', () => {
  test('cross-discriminates child and reporting states statically', () => {
    const validDivergent: ItemOutcome = {
      key: 'codex:parent',
      parentNativeId: 'parent',
      expectedChildNativeId: 'expected',
      observedChildNativeId: 'observed',
      targetBaselineIds: [],
      native: { status: 'succeeded', retryable: false, exitCode: 0 },
      reporting: { status: 'unresolved', reasonCode: 'child-unresolved' },
    };
    expectTypeOf(validDivergent).toMatchTypeOf<ItemOutcome>();

    // @ts-expect-error failed outcomes statically forbid observed child evidence
    const failedWithChild: ItemOutcome = {
      key: 'codex:parent',
      parentNativeId: 'parent',
      observedChildNativeId: 'child',
      targetBaselineIds: [],
      native: {
        status: 'failed',
        retryable: true,
        failureBoundary: 'before-child-creation' as const,
        exitCode: 1,
        reasonCode: 'native-failed-before-child',
      },
      reporting: { status: 'not-attempted' },
    };
    // @ts-expect-error succeeded outcomes statically require reporting reconciliation
    const succeededNotAttempted: ItemOutcome = {
      key: 'codex:parent',
      parentNativeId: 'parent',
      observedChildNativeId: 'child',
      targetBaselineIds: [],
      native: { status: 'succeeded', retryable: false, exitCode: 0 },
      reporting: { status: 'not-attempted' },
    };
    // @ts-expect-error deferred outcomes statically require not-attempted reporting
    const deferredWithReporting: ItemOutcome = {
      key: 'codex:parent',
      parentNativeId: 'parent',
      targetBaselineIds: [],
      native: {
        status: 'deferred',
        retryable: true,
        reasonCode: 'current-turn-active',
      },
      reporting: { status: 'unresolved', reasonCode: 'child-unresolved' },
    };
    expect([
      failedWithChild,
      succeededNotAttempted,
      deferredWithReporting,
    ]).toHaveLength(3);
  });

  test('accepts succeeded/mapped, failed, and deferred outcomes with exact retry keys', () => {
    const outcome = parseBatchOutcome({
      schemaVersion: 1,
      planDigest: 'e'.repeat(64),
      items: [
        {
          key: 'codex:parent',
          parentNativeId: 'parent',
          observedChildNativeId: 'child',
          targetBaselineIds: ['claude:existing'],
          native: { status: 'succeeded', retryable: false, exitCode: 0 },
          reporting: {
            status: 'mapped',
            childNativeId: 'child',
            evidence: 'machine-output-and-transcript',
          },
        },
        {
          key: 'claude:failed',
          parentNativeId: 'failed',
          targetBaselineIds: [],
          native: {
            status: 'failed',
            retryable: true,
            failureBoundary: 'before-child-creation',
            exitCode: 1,
            reasonCode: 'native-failed-before-child',
          },
          reporting: { status: 'not-attempted' },
        },
        {
          key: 'codex:deferred',
          parentNativeId: 'deferred',
          targetBaselineIds: [],
          native: {
            status: 'deferred',
            retryable: true,
            reasonCode: 'current-turn-active',
          },
          reporting: { status: 'not-attempted' },
        },
      ],
      retryableKeys: ['claude:failed', 'codex:deferred'],
    });
    expect(outcome.retryableKeys).toEqual(['claude:failed', 'codex:deferred']);
  });

  test('preserves different expected and observed selectors for unmapped outcomes', () => {
    const outcome = parseBatchOutcome({
      schemaVersion: 1,
      planDigest: 'e'.repeat(64),
      items: [
        {
          key: 'codex:succeeded',
          parentNativeId: 'succeeded',
          expectedChildNativeId: 'expected-a',
          observedChildNativeId: 'observed-a',
          targetBaselineIds: [],
          native: { status: 'succeeded', retryable: false, exitCode: 0 },
          reporting: {
            status: 'unresolved',
            reasonCode: 'child-unresolved',
          },
        },
        {
          key: 'claude:indeterminate',
          parentNativeId: 'indeterminate',
          expectedChildNativeId: 'expected-b',
          observedChildNativeId: 'observed-b',
          targetBaselineIds: [],
          native: {
            status: 'indeterminate',
            retryable: false,
            reasonCode: 'native-indeterminate',
          },
          reporting: {
            status: 'ambiguous',
            reasonCode: 'child-ambiguous',
            candidateChildIds: ['observed-b', 'other'],
          },
        },
        {
          key: 'codex:reporting-failed',
          parentNativeId: 'reporting-failed',
          expectedChildNativeId: 'expected-c',
          observedChildNativeId: 'observed-c',
          targetBaselineIds: [],
          native: {
            status: 'indeterminate',
            retryable: false,
            reasonCode: 'native-indeterminate',
          },
          reporting: {
            status: 'failed',
            reasonCode: 'reporting-failed',
          },
        },
      ],
      retryableKeys: [],
    });
    expect(outcome.items).toMatchObject([
      {
        expectedChildNativeId: 'expected-a',
        observedChildNativeId: 'observed-a',
      },
      {
        expectedChildNativeId: 'expected-b',
        observedChildNativeId: 'observed-b',
      },
      {
        expectedChildNativeId: 'expected-c',
        observedChildNativeId: 'observed-c',
      },
    ]);
  });

  test('rejects failed plus child evidence and mapped selector disagreement', () => {
    expect(() =>
      parseBatchOutcome({
        schemaVersion: 1,
        planDigest: 'e'.repeat(64),
        items: [
          {
            key: 'codex:parent',
            parentNativeId: 'parent',
            observedChildNativeId: 'child',
            targetBaselineIds: [],
            native: {
              status: 'failed',
              retryable: true,
              failureBoundary: 'before-child-creation',
              exitCode: 1,
              reasonCode: 'native-failed-before-child',
            },
            reporting: { status: 'not-attempted' },
          },
        ],
        retryableKeys: ['codex:parent'],
      }),
    ).toThrow('failed-child-evidence');

    expect(() =>
      parseBatchOutcome({
        schemaVersion: 1,
        planDigest: 'e'.repeat(64),
        items: [
          {
            key: 'codex:parent',
            parentNativeId: 'parent',
            expectedChildNativeId: 'expected',
            observedChildNativeId: 'observed',
            targetBaselineIds: [],
            native: { status: 'succeeded', retryable: false, exitCode: 0 },
            reporting: {
              status: 'mapped',
              childNativeId: 'observed',
              evidence: 'machine-output-and-transcript',
            },
          },
        ],
        retryableKeys: [],
      }),
    ).toThrow('mapped-selector-mismatch');
  });

  test('rejects retry lists that omit or add non-retryable items', () => {
    expect(() =>
      parseBatchOutcome({
        schemaVersion: 1,
        planDigest: 'e'.repeat(64),
        items: [
          {
            key: 'codex:deferred',
            parentNativeId: 'deferred',
            targetBaselineIds: [],
            native: {
              status: 'deferred',
              retryable: true,
              reasonCode: 'behavior-unverified',
            },
            reporting: { status: 'not-attempted' },
          },
        ],
        retryableKeys: [],
      }),
    ).toThrow('retryable-keys-mismatch');
  });
});
