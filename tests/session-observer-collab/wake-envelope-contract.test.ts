import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { wakeEnvelope } from '../../skills/session-observer-collab/scripts/hooks/codex-stop.mjs';
import { cursorWakeEnvelope } from '../../skills/session-observer-collab/scripts/hooks/cursor-stop.mjs';
import { selectCompletedContinuation } from '../../skills/session-observer-collab/scripts/lib/completion-selection.mjs';
import type {
  JsonObject,
  Runtime,
} from '../../src/transcript/core/runtimes.js';
import {
  buildDigest,
  renderMarkdown,
} from '../../src/transcript/session-observer/lib/digest.js';

const RANGE = { fromIndex: 12, toIndex: 19 };
const LEASE = {
  leaseId: 'lease-&-"quoted"',
  peerRuntime: 'claude-code',
  peerSession: 'peer<&>',
} as const;

const envelopeBuilders = [
  ['codex', () => wakeEnvelope(LEASE, RANGE)],
  ['cursor', () => cursorWakeEnvelope(LEASE, RANGE)],
] as const;

const runtimes: Runtime[] = ['claude-code', 'codex', 'cursor'];

function recordsFor(runtime: Runtime, envelope: string): JsonObject[] {
  if (runtime === 'claude-code') {
    return [
      { message: { role: 'user', content: envelope } },
      { message: { role: 'assistant', content: 'Acknowledged.' } },
    ];
  }
  if (runtime === 'codex') {
    return [
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: envelope }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Acknowledged.' }],
        },
      },
    ];
  }
  return [
    { role: 'user', message: { content: envelope } },
    { role: 'assistant', message: { content: 'Acknowledged.' } },
    { type: 'turn_ended', status: 'success' },
  ];
}

describe('production wake-envelope cross-contract', () => {
  test.each(envelopeBuilders)(
    'literal %s hook output stays automatic across every runtime',
    async (producerRuntime, buildEnvelope) => {
      const envelope = buildEnvelope();
      expect(envelope).toMatch(/^<session_observer_wake automatic="true"/u);

      for (const runtime of runtimes) {
        const directory = await mkdtemp(join(tmpdir(), 'wake-contract-'));
        try {
          const transcriptPath = join(directory, `${runtime}.jsonl`);
          const records = recordsFor(runtime, envelope);
          await writeFile(
            transcriptPath,
            `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
          );

          const digest = await buildDigest(runtime, transcriptPath, {
            fromIndex: 0,
            mode: 'review',
            sessionId: `${runtime}-session`,
          });
          const control = digest.entries.find(
            (entry) => entry.origin === 'automatic-control',
          );

          expect(control).toMatchObject({
            role: 'user',
            displayRole: 'automatic-control',
            kind: 'message',
            origin: 'automatic-control',
            automaticControl: {
              automatic: true,
              runtime: producerRuntime,
              leaseId: LEASE.leaseId,
              pinnedPeer: `${LEASE.peerRuntime}:${LEASE.peerSession}`,
              range: RANGE,
            },
          });
          expect(renderMarkdown(digest)).toContain(
            '### Hook/control (automatic)',
          );
          expect(digest.engagement).toMatchObject({
            status: 'unengaged',
            engaged: false,
            genuineUserMessages: 0,
            syntheticUserMessages: 1,
          });

          expect(selectCompletedContinuation(digest)).toMatchObject({
            status: 'no-continuation',
            continuation: false,
            budgetCost: 0,
            range: null,
          });
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      }
    },
  );
});
