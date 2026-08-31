import { describe, expect, test, vi } from 'vitest';

import {
  createHandoffPlan,
  executeHandoffPlan,
  HandoffPolicyError,
  selectHandoffCandidates,
  type CreateHandoffPlanInput,
} from '../../src/transcript/coding-session-handoff/handoff.js';
import type {
  CapabilityProbe,
  GitWorktreeEvidence,
  ProviderBehaviorContract,
  SessionCandidate,
} from '../../src/transcript/coding-session-handoff/types.js';

const source: GitWorktreeEvidence = {
  requestedPath: '/repo/source',
  canonicalPath: '/repo/source',
  worktreeRoot: '/repo/source',
  commonGitDir: '/repo/.git',
  branch: 'feature',
  head: 'a'.repeat(40),
  dirty: false,
  statusFingerprint: '0'.repeat(64),
};

const target: GitWorktreeEvidence = {
  ...source,
  requestedPath: '/repo/target',
  canonicalPath: '/repo/target',
  worktreeRoot: '/repo/target',
  branch: 'target',
  head: 'b'.repeat(40),
  dirty: true,
  statusFingerprint: '1'.repeat(64),
};

const candidates: SessionCandidate[] = [
  {
    key: 'claude:parent-b',
    provider: 'claude',
    nativeId: 'parent-b',
    recordedCwd: '/repo/source',
    modifiedAtMs: 20,
    size: 200,
    engagement: 'engaged',
    currentEvidence: 'none',
  },
  {
    key: 'codex:parent-a',
    provider: 'codex',
    nativeId: 'parent-a',
    recordedCwd: '/repo/source',
    modifiedAtMs: 10,
    size: 100,
    engagement: 'engaged',
    currentEvidence: 'none',
  },
];

function capability(provider: 'codex' | 'claude'): CapabilityProbe {
  return {
    provider,
    executable: `/usr/local/bin/${provider}`,
    detectedVersion: provider === 'codex' ? '0.151.0' : '2.1.251',
    verifiedSyntaxVersion: provider === 'codex' ? '0.151.0' : '2.1.251',
    status: 'syntax-verified',
    contractFingerprint: provider === 'codex' ? '2'.repeat(64) : '3'.repeat(64),
    executionContextFingerprint:
      provider === 'codex' ? '4'.repeat(64) : '5'.repeat(64),
    missingCapabilities: [],
  };
}

function contract(provider: 'codex' | 'claude'): ProviderBehaviorContract {
  const probe = capability(provider);
  return {
    provider,
    exactVersion: probe.detectedVersion!,
    syntaxFingerprint: probe.contractFingerprint!,
    executionContextFingerprint: probe.executionContextFingerprint!,
    successor: {
      status: 'verified',
      receiptDigest: provider === 'codex' ? '6'.repeat(64) : '7'.repeat(64),
      verifiedAt: '2026-08-31T00:00:00Z',
    },
    resume: { status: 'unverified' },
  };
}

function input(
  overrides: Partial<CreateHandoffPlanInput> = {},
): CreateHandoffPlanInput {
  return {
    source,
    target,
    candidates,
    targetBaselineIds: ['codex:existing'],
    selection: { all: true },
    mode: 'successor',
    capabilities: [capability('codex'), capability('claude')],
    contracts: {
      codex: contract('codex'),
      claude: contract('claude'),
    },
    uuidFactory: () => 'expected-claude-child',
    ...overrides,
  };
}

describe('selection and immutable planning', () => {
  test('requires exact one, many, or all selection and sorts deterministically', () => {
    expect(
      selectHandoffCandidates(candidates, {
        sessions: ['codex:parent-a', 'claude:parent-b'],
      }).map((candidate) => candidate.key),
    ).toEqual(['claude:parent-b', 'codex:parent-a']);
    expect(
      selectHandoffCandidates(candidates, { all: true }).map(
        (candidate) => candidate.key,
      ),
    ).toEqual(['claude:parent-b', 'codex:parent-a']);
    expect(() => selectHandoffCandidates(candidates, {})).toThrow(
      'invalid-selection',
    );
    expect(() =>
      selectHandoffCandidates(candidates, {
        all: true,
        sessions: ['codex:parent-a'],
      }),
    ).toThrow('invalid-selection');
    expect(() =>
      selectHandoffCandidates(candidates, { sessions: ['parent-a' as never] }),
    ).toThrow('invalid-selection');
    expect(() =>
      selectHandoffCandidates(candidates, {
        sessions: ['codex:parent-a', 'codex:parent-a'],
      }),
    ).toThrow('duplicate-session');
    expect(() =>
      selectHandoffCandidates(candidates, {
        sessions: ['codex:unknown'],
      }),
    ).toThrow('unknown-session');
  });

  test('builds ready exact invocations and pre-generates only Claude IDs', () => {
    const plan = createHandoffPlan(input());
    expect(plan.selected).toEqual(['claude:parent-b', 'codex:parent-a']);
    expect(plan.baselineTargetIds).toEqual(['codex:existing']);
    expect(plan.items[0]).toMatchObject({
      key: 'claude:parent-b',
      disposition: 'ready',
      expectedChildNativeId: 'expected-claude-child',
      invocation: { executable: 'claude', cwd: '/repo/target', shell: false },
    });
    expect(plan.items[1]).toMatchObject({
      key: 'codex:parent-a',
      disposition: 'ready',
      invocation: { executable: 'codex', cwd: '/repo/target', shell: false },
    });
    expect(plan.confirmationDigest).toMatch(/^[0-9a-f]{64}$/u);
  });

  test('defers current turns and unverified or drifted provider contracts', () => {
    const current = {
      ...candidates[1],
      currentEvidence: 'explicit-self' as const,
    };
    const codexContract = contract('codex');
    codexContract.executionContextFingerprint = 'f'.repeat(64);
    const plan = createHandoffPlan(
      input({
        candidates: [current, candidates[0]],
        contracts: {
          codex: codexContract,
          claude: {
            ...contract('claude'),
            successor: { status: 'unverified' },
          },
        },
      }),
    );
    expect(plan.items).toEqual([
      expect.objectContaining({
        key: 'claude:parent-b',
        disposition: 'deferred',
        reasonCodes: ['behavior-unverified'],
      }),
      expect.objectContaining({
        key: 'codex:parent-a',
        disposition: 'deferred',
        reasonCodes: [
          'current-turn-active',
          'provider-execution-context-drift',
        ],
      }),
    ]);
    expect(plan.items.every((item) => item.invocation === undefined)).toBe(
      true,
    );
  });

  test('refuses resume without writer proof and keeps resume behavior unverified', () => {
    const refused = createHandoffPlan(
      input({ mode: 'resume', selection: { sessions: ['codex:parent-a'] } }),
    );
    expect(refused.items[0]).toMatchObject({
      disposition: 'refused',
      reasonCodes: ['resume-writer-state-unknown'],
    });

    const deferred = createHandoffPlan(
      input({
        mode: 'resume',
        selection: { sessions: ['codex:parent-a'] },
        writerClosedKeys: new Set(['codex:parent-a']),
      }),
    );
    expect(deferred.items[0]).toMatchObject({
      disposition: 'deferred',
      reasonCodes: ['behavior-unverified'],
    });
  });

  test('produces stable canonical digests and binds mutation-relevant drift', () => {
    const first = createHandoffPlan(input());
    const reordered = createHandoffPlan(
      input({
        capabilities: [capability('claude'), capability('codex')],
        candidates: candidates.toReversed(),
      }),
    );
    expect(reordered.confirmationDigest).toBe(first.confirmationDigest);
    expect(
      createHandoffPlan(input({ target: { ...target, head: 'c'.repeat(40) } }))
        .confirmationDigest,
    ).not.toBe(first.confirmationDigest);
    expect(
      createHandoffPlan(
        input({ candidates: [{ ...candidates[0], size: 201 }, candidates[1]] }),
      ).confirmationDigest,
    ).not.toBe(first.confirmationDigest);
  });
});

describe('bounded sequential execution', () => {
  test('revalidates the full digest and rejects stale plans before running', async () => {
    const plan = createHandoffPlan(input());
    const run = vi.fn();
    await expect(
      executeHandoffPlan({
        confirmedDigest: plan.confirmationDigest,
        rebuildPlan: async () =>
          createHandoffPlan(input({ target: { ...target, dirty: false } })),
        run,
        corroborate: vi.fn(),
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'plan-stale' }));
    expect(run).not.toHaveBeenCalled();
  });

  test('executes ready items sequentially and separates native/reporting status', async () => {
    const plan = createHandoffPlan(input());
    const order: string[] = [];
    const run = vi.fn(async (invocation) => {
      order.push(invocation.executable);
      return invocation.executable === 'claude'
        ? {
            exitCode: 0,
            signal: null,
            stdout: '{"session_id":"expected-claude-child"}',
            stderr: '',
          }
        : {
            exitCode: 0,
            signal: null,
            stdout:
              '{"type":"thread.started","thread_id":"observed-codex-child"}\n',
            stderr: '',
          };
    });
    const corroborate = vi.fn(async ({ provider }) =>
      provider === 'claude'
        ? { status: 'mapped' as const }
        : {
            status: 'unresolved' as const,
            reasonCode: 'child-unresolved' as const,
          },
    );
    const outcome = await executeHandoffPlan({
      confirmedDigest: plan.confirmationDigest,
      rebuildPlan: async () => plan,
      run,
      corroborate,
    });

    expect(order).toEqual(['claude', 'codex']);
    expect(outcome.items[0]).toMatchObject({
      native: { status: 'succeeded' },
      expectedChildNativeId: 'expected-claude-child',
      observedChildNativeId: 'expected-claude-child',
      reporting: {
        status: 'mapped',
        childNativeId: 'expected-claude-child',
      },
    });
    expect(outcome.items[1]).toMatchObject({
      native: { status: 'succeeded' },
      observedChildNativeId: 'observed-codex-child',
      reporting: { status: 'unresolved', reasonCode: 'child-unresolved' },
    });
    expect(outcome.retryableKeys).toEqual([]);
  });

  test('allows retry only for deferral or explicit failed-before-child proof', async () => {
    const codexOnly = createHandoffPlan(
      input({ selection: { sessions: ['codex:parent-a'] } }),
    );
    const failed = await executeHandoffPlan({
      confirmedDigest: codexOnly.confirmationDigest,
      rebuildPlan: async () => codexOnly,
      run: async () => ({
        exitCode: 2,
        signal: null,
        stdout: '',
        stderr: 'redacted by boundary',
        beforeChildCreationProven: true,
      }),
      corroborate: vi.fn(),
    });
    expect(failed.items[0]).toMatchObject({
      native: {
        status: 'failed',
        failureBoundary: 'before-child-creation',
      },
      reporting: { status: 'not-attempted' },
    });
    expect(failed.retryableKeys).toEqual(['codex:parent-a']);

    const indeterminate = await executeHandoffPlan({
      confirmedDigest: codexOnly.confirmationDigest,
      rebuildPlan: async () => codexOnly,
      run: async () => ({
        exitCode: null,
        signal: 'SIGTERM',
        stdout: '{"type":"thread.started","thread_id":"possible-child"}\n',
        stderr: '',
        timedOut: true,
        beforeChildCreationProven: true,
      }),
      corroborate: async () => ({
        status: 'unresolved',
        reasonCode: 'child-unresolved',
      }),
    });
    expect(indeterminate.items[0]).toMatchObject({
      native: { status: 'indeterminate', retryable: false },
      observedChildNativeId: 'possible-child',
    });
    expect(indeterminate.retryableKeys).toEqual([]);
  });

  test('rejects missing confirmation without exposing provider control output', async () => {
    const plan = createHandoffPlan(input());
    await expect(
      executeHandoffPlan({
        confirmedDigest: '',
        rebuildPlan: async () => plan,
        run: vi.fn(),
        corroborate: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(HandoffPolicyError);
  });
});
