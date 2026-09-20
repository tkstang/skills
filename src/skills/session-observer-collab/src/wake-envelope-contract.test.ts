import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import type {
  JsonObject,
  Runtime,
} from '../../../shared/transcript/runtimes.js';
import {
  buildDigest,
  renderMarkdown,
} from '../../session-observer/src/lib/digest.js';
import { wakeEnvelope } from './hooks/codex-stop.mjs';
import { cursorWakeEnvelope } from './hooks/cursor-stop.mjs';
import { selectCompletedContinuation } from './lib/completion-selection.mjs';

const RECORDS = { fromIndex: 12, toIndex: 19 } as const;
const RANGE = {
  indexBase: 'zero-based-jsonl-record-index',
  ...RECORDS,
} as const;
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
      expect(envelope).toContain('schema_version="2"');
      expect(envelope).toContain('index_base="zero-based-jsonl-record-index"');

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
              schemaVersion: 2,
              runtime: producerRuntime,
              leaseId: LEASE.leaseId,
              pinnedPeer: `${LEASE.peerRuntime}:${LEASE.peerSession}`,
              indexBase: 'zero-based-jsonl-record-index',
              range: RECORDS,
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

  test('native Claude task-notification provenance cannot satisfy the wake-envelope contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wake-notification-'));
    try {
      const transcriptPath = join(directory, 'claude-code.jsonl');
      const envelope = wakeEnvelope(LEASE, RANGE);
      const records = [
        {
          type: 'user',
          origin: { kind: 'task-notification' },
          message: { role: 'user', content: envelope },
        },
        {
          type: 'assistant',
          message: { role: 'assistant', content: 'Acknowledged.' },
        },
      ];
      await writeFile(
        transcriptPath,
        `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'review',
        sessionId: 'claude-notification',
      });

      expect(digest.entries[0]).toMatchObject({
        role: 'user',
        displayRole: 'runtime-notification',
        origin: 'runtime-notification',
      });
      expect(digest.entries[0]).not.toHaveProperty('automaticControl');
      expect(
        digest.entries.some((entry) => entry.origin === 'automatic-control'),
      ).toBe(false);
      expect(renderMarkdown(digest)).toContain('### Runtime notification');
      expect(selectCompletedContinuation(digest)).toMatchObject({
        status: 'continuation',
        continuation: true,
        completedRecord: 1,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test.each([
    ['codex', wakeEnvelope],
    ['cursor', cursorWakeEnvelope],
  ] as const)(
    'emits %s frame-index provenance without granting receiver-side cursor authority',
    (producerRuntime, buildEnvelope) => {
      const frameRange = {
        ...RANGE,
        indexBase: 'zero-based-jsonl-frame-index',
      } as const;
      const envelope = buildEnvelope(
        { ...LEASE, peerRuntime: 'cursor' },
        frameRange,
      );

      expect(envelope).toContain('schema_version="2"');
      expect(envelope).toContain('index_base="zero-based-jsonl-frame-index"');
      expect(envelope).toContain(`runtime="${producerRuntime}"`);
      expect(envelope).toContain('records="12-19"');
    },
  );

  test.each([
    ['codex', wakeEnvelope],
    ['cursor', cursorWakeEnvelope],
  ] as const)(
    'refuses to emit a malformed %s v2 envelope without an index base',
    (_producerRuntime, buildEnvelope) => {
      expect(() => buildEnvelope(LEASE, RECORDS)).toThrow(
        'range.indexBase must be a supported index base',
      );
    },
  );
});
