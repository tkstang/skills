import { describe, expect, test, vi } from 'vitest';

import {
  reconcileBatchOutcome,
  type ReconcileEvidenceRequest,
} from '../../src/transcript/coding-session-handoff/handoff.js';
import type { BatchOutcome } from '../../src/transcript/coding-session-handoff/types.js';

function outcome(): BatchOutcome {
  return {
    schemaVersion: 1,
    planDigest: 'a'.repeat(64),
    items: [
      {
        key: 'claude:parent',
        parentNativeId: 'parent',
        expectedChildNativeId: 'expected-child',
        observedChildNativeId: 'expected-child',
        targetBaselineIds: ['claude:existing'],
        native: { status: 'succeeded', retryable: false, exitCode: 0 },
        reporting: {
          status: 'unresolved',
          reasonCode: 'child-unresolved',
        },
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
    retryableKeys: ['codex:deferred'],
  };
}

describe('read-only exact reconciliation', () => {
  test('uses only retained selectors and baseline evidence', async () => {
    const requests: ReconcileEvidenceRequest[] = [];
    const inspect = vi.fn(async (request: ReconcileEvidenceRequest) => {
      requests.push(request);
      return { status: 'mapped' as const };
    });
    const reconciled = await reconcileBatchOutcome(outcome(), { inspect });

    expect(requests).toEqual([
      {
        provider: 'claude',
        parentNativeId: 'parent',
        expectedChildNativeId: 'expected-child',
        observedChildNativeId: 'expected-child',
        targetBaselineIds: ['claude:existing'],
      },
    ]);
    expect(reconciled.items[0].reporting).toEqual({
      status: 'mapped',
      childNativeId: 'expected-child',
      evidence: 'machine-output-and-transcript',
    });
    expect(reconciled.items[1]).toEqual(outcome().items[1]);
    expect(reconciled.retryableKeys).toEqual(['codex:deferred']);
  });

  test('preserves ambiguity without recency or target-set inference', async () => {
    const reconciled = await reconcileBatchOutcome(outcome(), {
      inspect: async () => ({
        status: 'ambiguous',
        reasonCode: 'child-ambiguous',
        candidateChildIds: ['candidate-one', 'candidate-two'],
      }),
    });
    expect(reconciled.items[0].reporting).toEqual({
      status: 'ambiguous',
      reasonCode: 'child-ambiguous',
      candidateChildIds: ['candidate-one', 'candidate-two'],
    });
  });

  test('rejects malformed outcome selectors before inspecting provider state', async () => {
    const malformed = outcome() as unknown as Record<string, unknown>;
    const first = (malformed.items as Record<string, unknown>[])[0];
    delete first.observedChildNativeId;
    const inspect = vi.fn();
    await expect(reconcileBatchOutcome(malformed, { inspect })).rejects.toThrow(
      'succeeded-observed-child-required',
    );
    expect(inspect).not.toHaveBeenCalled();
  });
});
