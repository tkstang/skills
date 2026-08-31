import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import {
  cleanupDefaultProvider,
  createBehaviorPlan,
  evaluateSourceResumeSnapshots,
  exactTranscriptSnapshot,
  ProviderGateError,
  verifyProviderBehavior,
  type BehaviorGateDependencies,
} from '../../src/transcript/coding-session-handoff/behavior-gate.js';
import type { ProviderProbeResult } from '../../src/transcript/coding-session-handoff/providers.js';
import type { BehavioralGateReceipt } from '../../src/transcript/coding-session-handoff/types.js';

function probe(provider: 'codex' | 'claude'): ProviderProbeResult {
  const exactVersion = provider === 'codex' ? '0.151.0' : '2.1.251';
  return {
    capability: {
      provider,
      executable: `/usr/local/bin/${provider}`,
      detectedVersion: exactVersion,
      verifiedSyntaxVersion: exactVersion,
      status: 'syntax-verified',
      contractFingerprint: 'a'.repeat(64),
      executionContextFingerprint: 'b'.repeat(64),
      missingCapabilities: [],
    },
    authentication: {
      status: 'authenticated',
      method: 'test-auth',
      loginCommand: provider === 'codex' ? 'codex login' : 'claude auth login',
    },
  };
}

function dependencies(
  events: string[],
  receipts: BehavioralGateReceipt[],
  overrides: Partial<BehaviorGateDependencies> = {},
): BehaviorGateDependencies {
  let providerCalls = 0;
  return {
    pathExists: async () => false,
    createFixture: async () => {
      events.push('fixture:create');
      return {
        repositoryRoot: '/tmp/private-gate',
        sourceWorktree: '/tmp/private-gate/source',
        targetWorktree: '/tmp/private-gate/target',
      };
    },
    runProvider: async (invocation) => {
      providerCalls += 1;
      events.push(`provider:${providerCalls}:${invocation.executable}`);
      expect(invocation.timeoutMs).toBe(60_000);
      expect(invocation.maxOutputBytes).toBe(65_536);
      expect(invocation.shell).toBe(false);
      if (invocation.executable === 'codex') {
        return {
          exitCode: 0,
          signal: null,
          stdout: `{"type":"thread.started","thread_id":"${providerCalls === 1 ? 'parent-id' : providerCalls === 2 ? 'child-id' : 'parent-id'}"}\n`,
          stderr: '',
        };
      }
      const id =
        providerCalls === 1
          ? '00000000-0000-4000-a000-000000000001'
          : providerCalls === 2
            ? '00000000-0000-4000-a000-000000000002'
            : '00000000-0000-4000-a000-000000000001';
      return {
        exitCode: 0,
        signal: null,
        stdout: JSON.stringify({ session_id: id }),
        stderr: '',
      };
    },
    captureParentEvidence: async () => {
      events.push('evidence:parent');
      return {
        recordUuids: ['10000000-0000-4000-a000-000000000001'],
      };
    },
    captureChildEvidence: async ({ fixture }) => {
      events.push('evidence:child-before');
      return {
        recordedChildCwd: fixture.targetWorktree,
        exactParentLineage: true,
        recordUuids: [
          '10000000-0000-4000-a000-000000000001',
          '10000000-0000-4000-a000-000000000002',
        ],
        contentSha256: 'c'.repeat(64),
        metadataEffects: ['created-child-record'],
      };
    },
    captureSourceEvidence: async ({ fixture, parentNativeId }) => {
      events.push('evidence:source-before');
      return {
        nativeSessionId: parentNativeId,
        recordedCwd: fixture.sourceWorktree,
        recordUuids: [
          '10000000-0000-4000-a000-000000000001',
          '10000000-0000-4000-a000-000000000003',
        ],
        contentSha256: 'a'.repeat(64),
      };
    },
    inspectSourceResumeEvidence: async (_context, sourceBeforeResume) => {
      events.push('evidence:source-resume');
      expect(sourceBeforeResume.recordUuids).toHaveLength(2);
      return {
        sourceParentResumable: true,
        childUnchanged: true,
        metadataEffects: ['resumed-source-parent', 'preserved-child-record'],
      };
    },
    cleanupProvider: async ({ provider }) => {
      events.push('cleanup:provider');
      return {
        status: 'removed',
        method:
          provider === 'codex'
            ? 'codex-delete-exact-session-ids'
            : 'claude-purge-exact-disposable-project-paths',
        reasonCodes: [],
      };
    },
    cleanupFixture: async () => {
      events.push('cleanup:git');
      return { status: 'removed', reasonCodes: [] };
    },
    writeReceiptAtomically: async (_path, receipt, mode) => {
      events.push('receipt:write');
      expect(mode).toBe(0o600);
      receipts.push(receipt);
    },
    now: () => new Date('2026-08-31T12:00:00Z'),
    uuid: (() => {
      const values = [
        '00000000-0000-4000-a000-000000000001',
        '00000000-0000-4000-a000-000000000002',
      ];
      return () => values.shift()!;
    })(),
    ...overrides,
  };
}

describe('behavior-plan', () => {
  test('is mutation-free and binds exact capability, auth, bounds, and cleanup shape', () => {
    const providerProbe = probe('codex');
    const before = structuredClone(providerProbe);
    const plan = createBehaviorPlan('codex', providerProbe);
    expect(providerProbe).toEqual(before);
    expect(plan).toMatchObject({
      schemaVersion: 1,
      provider: 'codex',
      exactVersion: '0.151.0',
      authentication: 'authenticated',
      fixture: 'fresh-disposable-repository-with-two-worktrees',
      calls: 3,
      bounds: {
        timeoutMsPerCall: 60_000,
        outputBytesPerCall: 65_536,
      },
      cleanup: {
        method: 'codex-delete-exact-session-ids',
        limitations: ['provider-telemetry-cache-and-consumed-quota-may-remain'],
      },
    });
    expect(plan.confirmationDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(plan)).not.toContain('/tmp/');
  });
});

describe('behavior-verify', () => {
  test.each([
    {
      name: 'unknown parent after an attempted parent creation',
      state: {
        parentCreationAttempted: true,
        successorCreationAttempted: false,
      },
      expectedIds: [],
      expectedStatus: 'failed',
    },
    {
      name: 'known parent and unknown child after an attempted successor',
      state: {
        parentCreationAttempted: true,
        successorCreationAttempted: true,
        parentNativeId: 'parent-id',
      },
      expectedIds: ['parent-id'],
      expectedStatus: 'failed',
    },
    {
      name: 'known parent and child after both creation attempts',
      state: {
        parentCreationAttempted: true,
        successorCreationAttempted: true,
        parentNativeId: 'parent-id',
        childNativeId: 'child-id',
      },
      expectedIds: ['child-id', 'parent-id'],
      expectedStatus: 'removed',
    },
  ] as const)(
    'makes default Codex cleanup truthful for $name',
    async (fixture) => {
      const deletedIds: string[] = [];
      const result = await cleanupDefaultProvider(
        {
          provider: 'codex',
          executablePath: '/usr/local/bin/codex',
          fixture: {
            repositoryRoot: '/tmp/private-gate',
            sourceWorktree: '/tmp/private-gate/source',
            targetWorktree: '/tmp/private-gate/target',
          },
          ...fixture.state,
        },
        async (_executablePath, argv) => {
          expect(argv.slice(0, 2)).toEqual(['delete', '--force']);
          deletedIds.push(argv[2]);
        },
      );

      expect(deletedIds).toEqual(fixture.expectedIds);
      expect(result.status).toBe(fixture.expectedStatus);
      expect(result.reasonCodes).toEqual(
        fixture.expectedStatus === 'failed' ? ['reporting-failed'] : [],
      );
    },
  );

  test.sequential('locates exact Codex evidence by payload.id, not legacy or root ID', async () => {
    const createdHome = await mkdtemp(join(tmpdir(), 'gate-codex-native-'));
    const home = await realpath(createdHome);
    const previousHome = process.env.HOME;
    const previousStateDir = process.env.STATE_DIR;
    process.env.HOME = home;
    process.env.STATE_DIR = join(home, '.local', 'state', 'session-observer');

    try {
      const target = join(home, 'repo', 'target');
      await mkdir(target, { recursive: true });
      const canonicalTarget = await realpath(target);
      const sessionDir = join(home, '.codex', 'sessions', '2026', '08', '31');
      await mkdir(sessionDir, { recursive: true });
      await writeFile(
        join(sessionDir, 'legacy-child-id.jsonl'),
        `${JSON.stringify({
          type: 'session_meta',
          sessionId: 'legacy-child-id',
          payload: {
            id: 'native-child-id',
            session_id: 'root-session-id',
            forked_from_id: 'native-parent-id',
            cwd: canonicalTarget,
          },
        })}\n`,
        'utf8',
      );

      await expect(
        exactTranscriptSnapshot('codex', canonicalTarget, 'native-child-id'),
      ).resolves.toMatchObject({
        nativeSessionId: 'native-child-id',
        forkedFromSessionId: 'native-parent-id',
        recordedCwd: canonicalTarget,
      });
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousStateDir === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = previousStateDir;
      await rm(home, { recursive: true, force: true });
    }
  });

  test('rejects digest mismatch, auth failure, and an existing receipt before mutation', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const deps = dependencies(events, receipts);
    await expect(
      verifyProviderBehavior({
        provider: 'codex',
        providerProbe: probe('codex'),
        confirmedDigest: '0'.repeat(64),
        receiptPath: '/tmp/receipt.json',
        deps,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'plan-stale' }));
    expect(events).toEqual([]);

    const authRequired = probe('codex');
    authRequired.authentication.status = 'required';
    await expect(
      verifyProviderBehavior({
        provider: 'codex',
        providerProbe: authRequired,
        confirmedDigest: createBehaviorPlan('codex', authRequired)
          .confirmationDigest,
        receiptPath: '/tmp/receipt.json',
        deps,
      }),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'provider-auth-required' }),
    );
    expect(events).toEqual([]);

    const plan = createBehaviorPlan('codex', probe('codex'));
    await expect(
      verifyProviderBehavior({
        provider: 'codex',
        providerProbe: probe('codex'),
        confirmedDigest: plan.confirmationDigest,
        receiptPath: '/tmp/receipt.json',
        deps: dependencies(events, receipts, {
          pathExists: async () => true,
        }),
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'receipt-path-exists' }));
    expect(events).toEqual([]);
  });

  test('runs exact Codex fixture argv, cleans provider before Git, then writes mode 0600', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const invocations: string[][] = [];
    const base = dependencies(events, receipts);
    const plan = createBehaviorPlan('codex', probe('codex'));
    const result = await verifyProviderBehavior({
      provider: 'codex',
      providerProbe: probe('codex'),
      confirmedDigest: plan.confirmationDigest,
      receiptPath: '/tmp/receipt.json',
      deps: {
        ...base,
        runProvider: async (invocation) => {
          invocations.push(invocation.argv);
          return base.runProvider(invocation, '/usr/local/bin/codex');
        },
      },
    });

    expect(invocations).toEqual([
      [
        'exec',
        '--json',
        '--disable',
        'hooks',
        '--ignore-user-config',
        '--ignore-rules',
        '-c',
        'sandbox_mode="read-only"',
        'Reply exactly HANDOFF_PARENT_READY. Do not use tools.',
      ],
      [
        'exec',
        'fork',
        '--json',
        '--disable',
        'hooks',
        '--ignore-user-config',
        '--ignore-rules',
        '-c',
        'sandbox_mode="read-only"',
        'parent-id',
        'Reply exactly HANDOFF_READY. Do not use tools.',
      ],
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
        'parent-id',
        'Reply exactly HANDOFF_SOURCE_READY. Do not use tools.',
      ],
    ]);
    expect(events).toEqual([
      'fixture:create',
      'provider:1:codex',
      'evidence:parent',
      'provider:2:codex',
      'evidence:child-before',
      'evidence:source-before',
      'provider:3:codex',
      'evidence:source-resume',
      'cleanup:provider',
      'cleanup:git',
      'receipt:write',
    ]);
    expect(receipts[0].status).toBe('passed');
    expect(result).toEqual({
      provider: 'codex',
      status: 'passed',
      receiptDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
      reasonCodes: [],
    });
    expect(JSON.stringify(result)).not.toContain('parent-id');
    expect(JSON.stringify(result)).not.toContain('/tmp/private-gate');
  });

  test('uses exact Claude safe-mode/budget argv and requested child identity', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const invocations: string[][] = [];
    const base = dependencies(events, receipts);
    const plan = createBehaviorPlan('claude', probe('claude'));
    const result = await verifyProviderBehavior({
      provider: 'claude',
      providerProbe: probe('claude'),
      confirmedDigest: plan.confirmationDigest,
      receiptPath: '/tmp/receipt.json',
      deps: {
        ...base,
        runProvider: async (invocation) => {
          invocations.push(invocation.argv);
          return base.runProvider(invocation, '/usr/local/bin/claude');
        },
      },
    });
    expect(invocations[1]).toEqual([
      '--safe-mode',
      '--print',
      '--output-format',
      'json',
      '--resume',
      '00000000-0000-4000-a000-000000000001',
      '--fork-session',
      '--session-id',
      '00000000-0000-4000-a000-000000000002',
      '--permission-mode',
      'plan',
      '--tools',
      '',
      '--max-budget-usd',
      '0.15',
      'Reply exactly HANDOFF_READY. Do not use tools.',
    ]);
    expect(receipts[0].observations.requestedChildNativeId).toBe(
      '00000000-0000-4000-a000-000000000002',
    );
    expect(receipts[0].bounds.maxBudgetUsd).toBe(0.15);
    expect(result.status).toBe('passed');
  });

  test('finalizes cleanup failures as inconclusive before hashing/writing', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const plan = createBehaviorPlan('codex', probe('codex'));
    const result = await verifyProviderBehavior({
      provider: 'codex',
      providerProbe: probe('codex'),
      confirmedDigest: plan.confirmationDigest,
      receiptPath: '/tmp/receipt.json',
      deps: dependencies(events, receipts, {
        cleanupProvider: async () => {
          events.push('cleanup:provider');
          return {
            status: 'failed',
            method: 'codex-delete-exact-session-ids',
            reasonCodes: ['reporting-failed'],
          };
        },
      }),
    });
    expect(result.status).toBe('inconclusive');
    expect(receipts[0]).toMatchObject({
      status: 'inconclusive',
      cleanup: { providerState: 'failed', gitFixture: 'removed' },
    });
    expect(events.indexOf('cleanup:provider')).toBeLessThan(
      events.indexOf('cleanup:git'),
    );
    expect(events.indexOf('cleanup:git')).toBeLessThan(
      events.indexOf('receipt:write'),
    );
  });

  test('fails closed on empty Claude lineage and finalizes cleanup before receipt', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const plan = createBehaviorPlan('claude', probe('claude'));
    const result = await verifyProviderBehavior({
      provider: 'claude',
      providerProbe: probe('claude'),
      confirmedDigest: plan.confirmationDigest,
      receiptPath: '/tmp/receipt.json',
      deps: dependencies(events, receipts, {
        captureParentEvidence: async () => {
          events.push('evidence:parent');
          return { recordUuids: [] };
        },
      }),
    });

    expect(result.status).toBe('inconclusive');
    expect(receipts[0]).toMatchObject({
      status: 'inconclusive',
      observations: {
        exactParentLineage: false,
        sourceParentResumable: false,
      },
    });
    expect(events.indexOf('cleanup:provider')).toBeLessThan(
      events.indexOf('cleanup:git'),
    );
    expect(events.indexOf('cleanup:git')).toBeLessThan(
      events.indexOf('receipt:write'),
    );
  });

  test('derives source resumability from source growth and unchanged child evidence', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const plan = createBehaviorPlan('claude', probe('claude'));
    const result = await verifyProviderBehavior({
      provider: 'claude',
      providerProbe: probe('claude'),
      confirmedDigest: plan.confirmationDigest,
      receiptPath: '/tmp/receipt.json',
      deps: dependencies(events, receipts, {
        inspectSourceResumeEvidence: async () => {
          events.push('evidence:source-resume');
          return {
            sourceParentResumable: true,
            childUnchanged: false,
            metadataEffects: ['cross-written-child-record'],
          };
        },
      }),
    });

    expect(result.status).toBe('failed');
    expect(receipts[0]).toMatchObject({
      status: 'failed',
      observations: {
        exactParentLineage: true,
        sourceParentResumable: false,
      },
    });
    expect(receipts[0].observations.metadataEffects).toContain(
      'cross-written-child-record',
    );
  });

  test('does not mistake a successor source write for the later Claude resume', () => {
    const sourceBeforeResume = {
      nativeSessionId: 'parent-id',
      recordedCwd: '/source',
      recordUuids: [
        '10000000-0000-4000-a000-000000000001',
        '10000000-0000-4000-a000-000000000002',
      ],
      contentSha256: 'a'.repeat(64),
    };
    const childBeforeResume = {
      recordedChildCwd: '/target',
      exactParentLineage: true,
      recordUuids: [
        '10000000-0000-4000-a000-000000000001',
        '10000000-0000-4000-a000-000000000003',
      ],
      contentSha256: 'b'.repeat(64),
      metadataEffects: [],
    };
    const unchangedChild = {
      nativeSessionId: 'child-id',
      recordedCwd: '/target',
      forkedFromSessionId: undefined,
      recordUuids: [...childBeforeResume.recordUuids],
      contentSha256: childBeforeResume.contentSha256,
    };
    const identity = {
      parentNativeId: 'parent-id',
      childNativeId: 'child-id',
      sourceWorktree: '/source',
      targetWorktree: '/target',
    };

    expect(
      evaluateSourceResumeSnapshots(
        'claude',
        identity,
        sourceBeforeResume,
        { ...sourceBeforeResume },
        childBeforeResume,
        unchangedChild,
      ),
    ).toMatchObject({
      sourceParentResumable: false,
      childUnchanged: true,
    });

    expect(
      evaluateSourceResumeSnapshots(
        'claude',
        identity,
        sourceBeforeResume,
        {
          ...sourceBeforeResume,
          recordUuids: [
            ...sourceBeforeResume.recordUuids,
            '10000000-0000-4000-a000-000000000004',
          ],
          contentSha256: 'd'.repeat(64),
        },
        childBeforeResume,
        unchangedChild,
      ),
    ).toMatchObject({
      sourceParentResumable: true,
      childUnchanged: true,
    });
  });

  test.each([
    'provider-1',
    'parent-evidence',
    'provider-2',
    'child-evidence',
    'source-evidence',
    'provider-3',
    'resume-evidence',
  ] as const)(
    'cleans partial state and writes an inconclusive receipt after %s failure',
    async (failureStage) => {
      const events: string[] = [];
      const receipts: BehavioralGateReceipt[] = [];
      const cleanupStates: Array<{
        parentCreationAttempted: boolean;
        successorCreationAttempted: boolean;
        parentNativeId?: string;
        childNativeId?: string;
      }> = [];
      const base = dependencies(events, receipts);
      let providerCall = 0;
      const plan = createBehaviorPlan('codex', probe('codex'));
      const result = await verifyProviderBehavior({
        provider: 'codex',
        providerProbe: probe('codex'),
        confirmedDigest: plan.confirmationDigest,
        receiptPath: '/tmp/receipt.json',
        deps: {
          ...base,
          runProvider: async (invocation, executablePath) => {
            providerCall += 1;
            if (failureStage === `provider-${providerCall}`) {
              events.push(`provider:${providerCall}:codex`);
              throw new Error('raw provider failure');
            }
            return base.runProvider(invocation, executablePath);
          },
          captureParentEvidence: async (...args) => {
            if (failureStage === 'parent-evidence') {
              events.push('evidence:parent');
              throw new Error('raw parent evidence failure');
            }
            return base.captureParentEvidence(...args);
          },
          captureChildEvidence: async (...args) => {
            if (failureStage === 'child-evidence') {
              events.push('evidence:child-before');
              throw new Error('raw child evidence failure');
            }
            return base.captureChildEvidence(...args);
          },
          captureSourceEvidence: async (...args) => {
            if (failureStage === 'source-evidence') {
              events.push('evidence:source-before');
              throw new Error('raw source evidence failure');
            }
            return base.captureSourceEvidence(...args);
          },
          inspectSourceResumeEvidence: async (...args) => {
            if (failureStage === 'resume-evidence') {
              events.push('evidence:source-resume');
              throw new Error('raw resume evidence failure');
            }
            return base.inspectSourceResumeEvidence(...args);
          },
          cleanupProvider: async (state) => {
            events.push('cleanup:provider');
            cleanupStates.push({
              parentCreationAttempted: state.parentCreationAttempted,
              successorCreationAttempted: state.successorCreationAttempted,
              parentNativeId: state.parentNativeId,
              childNativeId: state.childNativeId,
            });
            return {
              status: 'removed',
              method: 'codex-delete-exact-session-ids',
              reasonCodes: [],
            };
          },
        },
      });

      expect(result.status).toBe('inconclusive');
      expect(result.reasonCodes).toContain('reporting-failed');
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({
        status: 'inconclusive',
        observations: {
          exactParentLineage: [
            'source-evidence',
            'provider-3',
            'resume-evidence',
          ].includes(failureStage),
          sourceParentResumable: false,
        },
      });
      expect(cleanupStates).toHaveLength(1);
      expect(cleanupStates[0]).toMatchObject({
        parentCreationAttempted: true,
        successorCreationAttempted: !['provider-1', 'parent-evidence'].includes(
          failureStage,
        ),
      });
      expect(events.indexOf('cleanup:provider')).toBeLessThan(
        events.indexOf('cleanup:git'),
      );
      expect(events.indexOf('cleanup:git')).toBeLessThan(
        events.indexOf('receipt:write'),
      );
    },
  );

  test('uses path-free results when a bounded provider call cannot prove identity', async () => {
    const events: string[] = [];
    const receipts: BehavioralGateReceipt[] = [];
    const base = dependencies(events, receipts);
    const plan = createBehaviorPlan('codex', probe('codex'));
    const result = await verifyProviderBehavior({
      provider: 'codex',
      providerProbe: probe('codex'),
      confirmedDigest: plan.confirmationDigest,
      receiptPath: '/tmp/sensitive-receipt.json',
      deps: {
        ...base,
        runProvider: async () => {
          throw new Error('/private/provider-output SECRET');
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('/private');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result).toMatchObject({
      provider: 'codex',
      status: 'inconclusive',
      reasonCodes: ['reporting-failed'],
    });
  });
});

test('gate errors expose stable codes only', () => {
  expect(new ProviderGateError('plan-stale').message).toBe('plan-stale');
});
