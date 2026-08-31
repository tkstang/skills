import { describe, expect, test } from 'vitest';

import {
  DEFAULT_PREVIEW_BATCH_LIMITS,
  HANDOFF_SCHEMA_VERSION,
  SchemaValidationError,
  parseBatchOutcome,
  parseCapabilityProbe,
  parseErrorEnvelope,
  parseGitWorktreeEvidence,
  parseHandoffPlan,
  parseNativeInvocation,
  parsePreviewBatchLimits,
  parseQualifiedSessionId,
  parseSessionCandidate,
  parseSessionPreview,
  parseSuccessEnvelope,
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

describe('cross-discriminated batch outcomes', () => {
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
