import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readActivityReport } from './index.js';
import type {
  ActivityDeliveryRange,
  ActivityProjectionMode,
  ActivitySource,
} from './types.js';

const FIXTURE_ROOT = fileURLToPath(
  new URL('../fixtures/session-fidelity/', import.meta.url),
);
const CLAUDE_FIXTURE = join(
  FIXTURE_ROOT,
  'claude-code/captured-activity.jsonl',
);
const CODEX_FIXTURE = join(FIXTURE_ROOT, 'codex/captured-activity.jsonl');

const CODEX_SOURCE: ActivitySource = {
  runtime: 'codex',
  sessionId: '77777777-7777-4777-8777-777777777777',
  nativeSessionId: '88888888-8888-4888-8888-888888888888',
  transcriptPath: CODEX_FIXTURE,
};

function deliveryRange(start: number, end: number): ActivityDeliveryRange {
  return {
    indexBase: 'zero-based-decoded-record-index',
    start,
    end,
  };
}

async function inTemporaryTranscript(
  content: string,
  run: (transcriptPath: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'session-activity-'));
  const transcriptPath = join(directory, 'fixture.jsonl');
  try {
    await writeFile(transcriptPath, content, 'utf8');
    await run(transcriptPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function reportFromClaude(
  transcriptPath: string,
  mode: ActivityProjectionMode,
  range: ActivityDeliveryRange,
) {
  return readActivityReport(
    {
      runtime: 'claude-code',
      sessionId: 'fixture-claude-session',
      nativeSessionId: 'fixture-claude-session',
      transcriptPath,
    },
    { mode, renderFormat: 'compact-json', deliveryRange: range },
  );
}

describe('captured activity pipeline', () => {
  it('preserves captured child ownership, native IDs, locators, and count scopes', async () => {
    const sourceContent = await readFile(CODEX_FIXTURE, 'utf8');
    const report = await readActivityReport(CODEX_SOURCE, {
      mode: 'review',
      renderFormat: 'compact-json',
      deliveryRange: deliveryRange(0, 14),
    });
    const calls = report.events.filter(
      (candidate) => candidate.kind === 'call',
    );

    expect(
      calls.map((candidate) => ({
        nativeCallId: candidate.nativeCallId,
        ownership: candidate.ownership,
        recordIndex: candidate.locator.recordIndex,
        physicalLine: candidate.locator.physicalLine,
        jsonPointer: candidate.locator.jsonPointer,
      })),
    ).toEqual([
      {
        nativeCallId: 'fixture-call-inherited',
        ownership: 'inherited',
        recordIndex: 2,
        physicalLine: 3,
        jsonPointer: '/payload',
      },
      {
        nativeCallId: 'fixture-call-function',
        ownership: 'owned',
        recordIndex: 5,
        physicalLine: 6,
        jsonPointer: '/payload',
      },
      {
        nativeCallId: 'fixture-call-patch',
        ownership: 'owned',
        recordIndex: 7,
        physicalLine: 8,
        jsonPointer: '/payload',
      },
    ]);
    expect(report.counts).toMatchObject({
      capturedSource: {
        scope: 'captured-source',
        calls: 3,
        countedInvocations: 2,
        results: 3,
        items: 4,
        failures: 2,
      },
      deliveredRange: {
        scope: 'delivered-range',
        calls: 3,
        countedInvocations: 2,
        results: 3,
        items: 4,
        failures: 2,
      },
      displayed: {
        scope: 'displayed',
        calls: 3,
        countedInvocations: 2,
        results: 3,
        items: 4,
        failures: 2,
      },
    });
    expect(report.sourceSnapshot.sourceBytes).toBe(
      Buffer.byteLength(sourceContent, 'utf8'),
    );
    expect(Number.isNaN(Date.parse(report.sourceSnapshot.capturedAt))).toBe(
      false,
    );
    expect(calls[0]?.originalInputPreview).toMatchObject({ truncated: false });
    expect(calls[0]).not.toHaveProperty('arguments');
    expect(calls[0]).not.toHaveProperty('originalArguments');
    expect(calls[0]?.inputPreview?.text).toBe(
      '{"cmd":"printf inherited-fixture"}',
    );
    expect(calls[0]?.originalInputPreview?.text).toBe(
      '"{\\"cmd\\":\\"printf inherited-fixture\\"}"',
    );
    expect(JSON.stringify(report)).not.toContain('sourceCarrier');
  });

  it('projects a late captured result with bounded earlier call context', async () => {
    const report = await readActivityReport(CODEX_SOURCE, {
      mode: 'watch',
      renderFormat: 'compact-json',
      deliveryRange: deliveryRange(3, 4),
    });

    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({
      kind: 'result',
      nativeCallId: 'fixture-call-inherited',
      ownership: 'inherited',
      locator: {
        recordIndex: 3,
        physicalLine: 4,
        jsonPointer: '/payload',
      },
    });
    expect(report.callContexts).toHaveLength(1);
    expect(report.callContexts[0]).toMatchObject({
      availability: 'outside-delivered-range',
      nativeCallId: 'fixture-call-inherited',
      nativeName: 'exec_command',
      locator: {
        recordIndex: 2,
        physicalLine: 3,
        jsonPointer: '/payload',
      },
      inputPreview: { truncated: false },
    });
    expect(report.counts.deliveredRange).toMatchObject({
      scope: 'delivered-range',
      calls: 0,
      countedInvocations: 0,
      results: 1,
    });
  });

  it('keeps captured failed item evidence standalone under the watch budget', async () => {
    const report = await readActivityReport(CODEX_SOURCE, {
      mode: 'watch',
      renderFormat: 'compact-json',
      deliveryRange: deliveryRange(9, 11),
    });
    const items = report.events.filter(
      (candidate) => candidate.kind === 'item',
    );

    expect(
      items.map((candidate) => ({
        nativeId: candidate.nativeId,
        outcome: candidate.outcome,
        relatedCallKey: candidate.relatedCallKey,
        recordIndex: candidate.locator.recordIndex,
      })),
    ).toEqual([
      {
        nativeId: 'fixture-command-item',
        outcome: 'error',
        relatedCallKey: undefined,
        recordIndex: 9,
      },
      {
        nativeId: 'fixture-mcp-item',
        outcome: 'error',
        relatedCallKey: undefined,
        recordIndex: 10,
      },
    ]);
    expect(items.every((candidate) => candidate.outputPreview)).toBe(true);
    expect(report.counts.deliveredRange).toMatchObject({
      scope: 'delivered-range',
      items: 2,
      failures: 2,
    });
    expect(report.omitted).toMatchObject({
      calls: 0,
      results: 0,
      failures: 0,
    });
    expect(report.renderedBytes).toBeLessThanOrEqual(report.limits.maxBytes!);
  });

  it('keeps malformed input diagnostics stable and free of source content', async () => {
    const [capturedLine] = (await readFile(CLAUDE_FIXTURE, 'utf8')).split('\n');
    const privateFragment = 'malformed-fixture-private-fragment';
    const transcript = `${capturedLine}\n{${privateFragment}}\n${capturedLine}\n`;

    await inTemporaryTranscript(transcript, async (transcriptPath) => {
      const report = await reportFromClaude(
        transcriptPath,
        'review',
        deliveryRange(0, 2),
      );

      expect(report.diagnostics).toContainEqual({
        code: 'SOURCE_MALFORMED_RECORD',
        locator: {
          physicalLine: 2,
          jsonPointer: '',
        },
      });
      expect(JSON.stringify(report.diagnostics)).not.toContain(privateFragment);
      expect(report.counts.deliveredRange).toMatchObject({
        scope: 'delivered-range',
        calls: 6,
        countedInvocations: 6,
      });
    });
  });

  it('reports omissions when captured native-shaped calls exceed the watch cap', async () => {
    const records = Array.from({ length: 100 }, (_, index) =>
      JSON.stringify({
        type: 'assistant',
        uuid: `fixture-bulk-message-${index}`,
        parentUuid: index === 0 ? null : `fixture-bulk-message-${index - 1}`,
        sessionId: 'fixture-claude-session',
        version: '2.1.278',
        message: {
          id: `fixture-bulk-api-message-${index}`,
          type: 'message',
          role: 'assistant',
          model: 'fixture-model',
          content: [
            {
              type: 'tool_use',
              id: `toolu_fixture_bulk_${index}`,
              name: 'Read',
              input: { file_path: `/fixture/project/example-${index}.txt` },
            },
          ],
        },
      }),
    );

    await inTemporaryTranscript(
      `${records.join('\n')}\n`,
      async (transcriptPath) => {
        const report = await reportFromClaude(
          transcriptPath,
          'watch',
          deliveryRange(0, 100),
        );

        expect(report.counts.deliveredRange).toMatchObject({
          scope: 'delivered-range',
          calls: 100,
          countedInvocations: 100,
        });
        expect(report.counts.displayed.scope).toBe('displayed');
        expect(report.counts.displayed.countedInvocations).toBeLessThanOrEqual(
          80,
        );
        expect(report.omitted.invocationLimitGroups).toBe(20);
        expect(report.omitted.calls).toBe(
          report.counts.deliveredRange.calls - report.counts.displayed.calls,
        );
        expect(report.omitted.calls).toBeGreaterThan(0);
        expect(report.renderedBytes).toBeLessThanOrEqual(32 * 1024);
      },
    );
  });
});
