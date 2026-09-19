import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readRecordsDetailed } from '../runtimes.js';
import { correlateActivity } from './correlate.js';
import { extractActivity } from './extract.js';
import {
  ACTIVITY_PROJECTION_LIMITS,
  projectActivity,
  projectActivityWithLimits,
} from './project.js';
import { renderActivityMarkdown, renderActivityReport } from './render.js';
import type {
  ActivityProjectionLimits,
  ActivitySource,
  CorrelatedActivity,
  CorrelatedActivityEvent,
} from './types.js';

const SOURCE: ActivitySource = {
  runtime: 'codex',
  sessionId: 'session-id',
  nativeSessionId: 'native-session-id',
  transcriptPath: '/fixture/activity.jsonl',
};

const GENEROUS_LIMITS: ActivityProjectionLimits = {
  maxBytes: 1024 * 1024,
  maxInvocations: null,
  previewBytes: 2 * 1024,
  lateContextBytes: 256,
};

function event(
  eventKey: string,
  kind: CorrelatedActivityEvent['kind'],
  recordIndex: number,
  fields: Partial<CorrelatedActivityEvent> = {},
): CorrelatedActivityEvent {
  return {
    eventKey,
    kind,
    nativeType: kind,
    locator: {
      recordIndex,
      physicalLine: recordIndex + 1,
      jsonPointer: `/records/${recordIndex}`,
    },
    outcome: 'unknown',
    ownership: 'owned',
    ...fields,
  };
}

function activity(events: CorrelatedActivityEvent[]): CorrelatedActivity {
  const calls = events.filter((candidate) => candidate.kind === 'call');
  const results = events.filter((candidate) => candidate.kind === 'result');
  const items = events.filter((candidate) => candidate.kind === 'item');
  return {
    activitySchemaVersion: 1,
    source: SOURCE,
    sourceSnapshot: {
      capturedAt: '2026-09-19T00:00:00.000Z',
      sourceBytes: 0,
    },
    events,
    coverage: [],
    diagnostics: [],
    correlationCounts: {
      responseStreamCalls: {
        captured: calls.length,
        counted: calls.filter((candidate) => candidate.ownership === 'owned')
          .length,
        owned: calls.filter((candidate) => candidate.ownership === 'owned')
          .length,
        inherited: calls.filter(
          (candidate) => candidate.ownership === 'inherited',
        ).length,
        unknown: calls.filter((candidate) => candidate.ownership === 'unknown')
          .length,
      },
      results: {
        matched: results.filter(
          (candidate) => candidate.relatedCallKey !== undefined,
        ).length,
        unmatched: results.filter(
          (candidate) => candidate.relatedCallKey === undefined,
        ).length,
      },
      itemEvidence: {
        linked: items.filter(
          (candidate) => candidate.relatedCallKey !== undefined,
        ).length,
        standalone: items.filter(
          (candidate) => candidate.relatedCallKey === undefined,
        ).length,
      },
    },
  };
}

function wholeRange(events: readonly CorrelatedActivityEvent[]) {
  return {
    indexBase: 'zero-based-decoded-record-index' as const,
    start: 0,
    end:
      events.reduce(
        (maximum, candidate) =>
          Math.max(maximum, candidate.locator.recordIndex),
        -1,
      ) + 1,
  };
}

describe('activity projection budgets', () => {
  it('publishes the exact mode, preview, and late-context limits', () => {
    expect(ACTIVITY_PROJECTION_LIMITS).toEqual({
      watch: {
        maxBytes: 32 * 1024,
        maxInvocations: 80,
        previewBytes: 2 * 1024,
        lateContextBytes: 256,
      },
      'catch-up': {
        maxBytes: 32 * 1024,
        maxInvocations: 80,
        previewBytes: 2 * 1024,
        lateContextBytes: 256,
      },
      review: {
        maxBytes: 128 * 1024,
        maxInvocations: 1024,
        previewBytes: 2 * 1024,
        lateContextBytes: 256,
      },
      export: {
        maxBytes: 64 * 1024 * 1024,
        maxInvocations: null,
        previewBytes: 2 * 1024,
        lateContextBytes: 256,
      },
    });
  });

  it('clips previews by UTF-8 bytes and serializes deterministically', () => {
    const events = [
      event('unicode-call', 'call', 0, {
        nativeName: 'custom_tool',
        arguments: {
          zeta: `prefix-${'😀'.repeat(900)}`,
          alpha: 'line one\nline two',
        },
        originalArguments: ` {"zeta":"${'😀'.repeat(900)}"} `,
      }),
    ];
    const options = {
      mode: 'review' as const,
      deliveryRange: wholeRange(events),
    };

    const first = projectActivity(activity(events), options);
    const second = projectActivity(activity(events), options);
    const serialized = renderActivityReport(first);
    const preview = first.events[0]?.inputPreview;
    const originalPreview = first.events[0]?.originalInputPreview;

    expect(renderActivityReport(second)).toBe(serialized);
    expect(first.renderedBytes).toBe(Buffer.byteLength(serialized, 'utf8'));
    expect(first.renderedBytes).toBeLessThanOrEqual(first.limits.maxBytes);
    expect(preview).toBeDefined();
    expect(preview?.truncated).toBe(true);
    expect(preview?.displayedBytes).toBe(
      Buffer.byteLength(preview?.text ?? '', 'utf8'),
    );
    expect(preview?.displayedBytes).toBeLessThanOrEqual(2 * 1024);
    expect(preview?.text.endsWith('\ufffd')).toBe(false);
    expect(originalPreview?.truncated).toBe(true);
    expect(originalPreview?.displayedBytes).toBe(
      Buffer.byteLength(originalPreview?.text ?? '', 'utf8'),
    );
    expect(originalPreview?.displayedBytes).toBeLessThanOrEqual(2 * 1024);
    expect(serialized).not.toContain('SyntaxError');
  });

  it('keeps failures and recent invocations, then renders them chronologically', () => {
    const events = [
      event('old-call', 'call', 0, { nativeName: 'old' }),
      event('old-result', 'result', 1, {
        relatedCallKey: 'old-call',
        outcome: 'success',
        result: 'old output',
      }),
      event('failed-call', 'call', 2, { nativeName: 'failed' }),
      event('failed-result', 'result', 3, {
        relatedCallKey: 'failed-call',
        outcome: 'error',
        result: 'failure output',
      }),
      event('recent-call', 'call', 4, { nativeName: 'recent' }),
      event('recent-result', 'result', 5, {
        relatedCallKey: 'recent-call',
        outcome: 'success',
        result: 'recent output',
      }),
    ];
    const report = projectActivityWithLimits(
      activity(events),
      { mode: 'review', deliveryRange: wholeRange(events) },
      { ...GENEROUS_LIMITS, maxInvocations: 2 },
    );

    expect(report.events.map((candidate) => candidate.eventKey)).toEqual([
      'failed-call',
      'failed-result',
      'recent-call',
      'recent-result',
    ]);
    expect(report.omitted).toMatchObject({
      calls: 1,
      results: 1,
      failures: 0,
      invocationLimitGroups: 1,
    });
    expect(report.counts.deliveredRange).toMatchObject({
      scope: 'delivered-range',
      calls: 3,
      countedInvocations: 3,
    });
    expect(report.counts.displayed).toMatchObject({
      scope: 'displayed',
      calls: 2,
      countedInvocations: 2,
    });
  });

  it('applies the watch invocation limit to inherited calls', () => {
    const events = Array.from({ length: 81 }, (_, index) =>
      event(`inherited-${index}`, 'call', index, {
        ownership: 'inherited',
      }),
    );
    const report = projectActivity(activity(events), {
      mode: 'watch',
      deliveryRange: wholeRange(events),
    });

    expect(report.events).toHaveLength(80);
    expect(report.events[0]?.eventKey).toBe('inherited-1');
    expect(report.omitted).toMatchObject({
      calls: 1,
      invocationLimitGroups: 1,
    });
    expect(report.counts.deliveredRange).toMatchObject({
      calls: 81,
      countedInvocations: 0,
    });
    expect(report.counts.displayed).toMatchObject({
      calls: 80,
      countedInvocations: 0,
    });
  });

  it('applies the review invocation limit to unknown calls', () => {
    const events = Array.from({ length: 1_025 }, (_, index) =>
      event(`unknown-${index}`, 'call', index, { ownership: 'unknown' }),
    );
    const report = projectActivityWithLimits(
      activity(events),
      { mode: 'review', deliveryRange: wholeRange(events) },
      { ...ACTIVITY_PROJECTION_LIMITS.review, maxBytes: 2 * 1024 * 1024 },
    );

    expect(report.events).toHaveLength(1_024);
    expect(report.events[0]?.eventKey).toBe('unknown-1');
    expect(report.omitted).toMatchObject({
      calls: 1,
      invocationLimitGroups: 1,
    });
    expect(report.counts.deliveredRange).toMatchObject({
      calls: 1_025,
      countedInvocations: 0,
    });
    expect(report.counts.displayed).toMatchObject({
      calls: 1_024,
      countedInvocations: 0,
    });
  });

  it('prioritizes failures across mixed ownership without changing owned counts', () => {
    const calls = Array.from({ length: 81 }, (_, index) =>
      event(`mixed-${index}`, 'call', index, {
        ownership: (['inherited', 'unknown', 'owned'] as const)[index % 3],
      }),
    );
    const events = [
      ...calls,
      event('mixed-failure', 'result', 81, {
        ownership: 'inherited',
        relatedCallKey: 'mixed-0',
        outcome: 'error',
      }),
    ];
    const report = projectActivity(activity(events), {
      mode: 'watch',
      deliveryRange: wholeRange(events),
    });

    expect(
      report.events.some((candidate) => candidate.eventKey === 'mixed-0'),
    ).toBe(true);
    expect(
      report.events.some((candidate) => candidate.eventKey === 'mixed-1'),
    ).toBe(false);
    expect(report.omitted).toMatchObject({
      calls: 1,
      results: 0,
      failures: 0,
      invocationLimitGroups: 1,
    });
    expect(report.counts.deliveredRange).toMatchObject({
      calls: 81,
      countedInvocations: 27,
      results: 1,
      failures: 1,
    });
    expect(report.counts.displayed).toMatchObject({
      calls: 80,
      countedInvocations: 27,
      results: 1,
      failures: 1,
    });
  });

  it('reports a bounded earlier call context for a late result', () => {
    const events = [
      event('early-call', 'call', 0, {
        nativeCallId: 'native-call-id',
        nativeName: 'exec_command',
        category: 'shell',
        arguments: { cmd: 'é'.repeat(500) },
      }),
      event('late-result', 'result', 9, {
        nativeCallId: 'native-call-id',
        relatedCallKey: 'early-call',
        outcome: 'success',
        result: 'done',
      }),
    ];
    const report = projectActivity(activity(events), {
      mode: 'watch',
      deliveryRange: {
        indexBase: 'zero-based-decoded-record-index',
        start: 5,
        end: 10,
      },
    });

    expect(report.events.map((candidate) => candidate.eventKey)).toEqual([
      'late-result',
    ]);
    expect(report.callContexts).toHaveLength(1);
    expect(report.callContexts[0]).toMatchObject({
      callKey: 'early-call',
      availability: 'outside-delivered-range',
      nativeCallId: 'native-call-id',
      nativeName: 'exec_command',
      category: 'shell',
      locator: { recordIndex: 0, physicalLine: 1 },
    });
    expect(
      report.callContexts[0]?.inputPreview?.displayedBytes,
    ).toBeLessThanOrEqual(256);
    expect(report.counts.deliveredRange).toMatchObject({
      calls: 0,
      countedInvocations: 0,
      results: 1,
    });
  });

  it('shares one preview for exact-linked duplicate carriers only', () => {
    const events = [
      event('call', 'call', 0, {
        nativeCallId: 'call-id',
        arguments: { query: 'needle' },
      }),
      event('result', 'result', 1, {
        nativeCallId: 'call-id',
        relatedCallKey: 'call',
        result: { output: 'same evidence' },
      }),
      event('linked-item', 'item', 2, {
        nativeId: 'call-id',
        relatedCallKey: 'call',
        nativeValue: { output: 'same evidence' },
      }),
      event('standalone-item', 'item', 3, {
        nativeId: 'other-id',
        nativeValue: { output: 'same evidence' },
      }),
    ];
    const report = projectActivity(activity(events), {
      mode: 'review',
      deliveryRange: wholeRange(events),
    });
    const linked = report.events.find(
      (candidate) => candidate.eventKey === 'linked-item',
    );
    const standalone = report.events.find(
      (candidate) => candidate.eventKey === 'standalone-item',
    );

    expect(
      report.events.find((candidate) => candidate.eventKey === 'result'),
    ).toHaveProperty('outputPreview');
    expect(linked).toMatchObject({
      outputPreviewOmitted: 'exact-linked-duplicate-carrier',
    });
    expect(linked).not.toHaveProperty('outputPreview');
    expect(standalone).toHaveProperty('outputPreview');
  });

  it('retains a linked failed item preview when its result has no output', () => {
    const events = [
      event('call', 'call', 0, {
        nativeCallId: 'call-id',
      }),
      event('result-without-output', 'result', 1, {
        nativeCallId: 'call-id',
        relatedCallKey: 'call',
        outcome: 'unknown',
      }),
      event('failed-linked-item', 'item', 2, {
        nativeId: 'call-id',
        relatedCallKey: 'call',
        outcome: 'error',
        nativeValue: { output: 'only persisted failure evidence' },
      }),
    ];
    const report = projectActivity(activity(events), {
      mode: 'review',
      deliveryRange: wholeRange(events),
    });
    const result = report.events.find(
      (candidate) => candidate.eventKey === 'result-without-output',
    );
    const item = report.events.find(
      (candidate) => candidate.eventKey === 'failed-linked-item',
    );

    expect(result).not.toHaveProperty('outputPreview');
    expect(item).toHaveProperty('outputPreview');
    expect(item).not.toHaveProperty('outputPreviewOmitted');
    expect(item?.outputPreview?.text).toContain(
      'only persisted failure evidence',
    );
  });

  it('retains a standalone failed item ahead of a lower-priority call group', () => {
    const failedItem = event('failed-item', 'item', 1, {
      outcome: 'error',
      nativeValue: { output: `failed-${'x'.repeat(700)}` },
    });
    const failedOnly = projectActivityWithLimits(
      activity([failedItem]),
      { mode: 'review', deliveryRange: wholeRange([failedItem]) },
      GENEROUS_LIMITS,
    );
    const events = [
      event('ordinary-call', 'call', 0, {
        arguments: { input: 'y'.repeat(1400) },
      }),
      failedItem,
    ];
    const report = projectActivityWithLimits(
      activity(events),
      { mode: 'review', deliveryRange: wholeRange(events) },
      {
        ...GENEROUS_LIMITS,
        maxBytes: failedOnly.renderedBytes + 256,
      },
    );

    expect(report.events.map((candidate) => candidate.eventKey)).toEqual([
      'failed-item',
    ]);
    expect(report.omitted).toMatchObject({
      calls: 1,
      results: 0,
      failures: 0,
      byteLimitGroups: 1,
    });
    expect(report.events[0]?.relatedCallKey).toBeUndefined();
    expect(report.callContexts).toEqual([]);
  });

  it('explicitly reports a failed group that is too large to fit', () => {
    const empty = projectActivityWithLimits(
      activity([]),
      {
        mode: 'review',
        deliveryRange: {
          indexBase: 'zero-based-decoded-record-index',
          start: 0,
          end: 1,
        },
      },
      GENEROUS_LIMITS,
    );
    const events = [
      event('oversized-call', 'call', 0, {
        arguments: { input: 'z'.repeat(5000) },
      }),
      event('oversized-result', 'result', 0, {
        relatedCallKey: 'oversized-call',
        outcome: 'error',
        result: { output: 'z'.repeat(5000) },
      }),
    ];
    const report = projectActivityWithLimits(
      activity(events),
      { mode: 'review', deliveryRange: wholeRange(events) },
      { ...GENEROUS_LIMITS, maxBytes: empty.renderedBytes + 256 },
    );

    expect(report.renderedBytes).toBeLessThanOrEqual(report.limits.maxBytes);
    expect(report.events).toEqual([]);
    expect(report.omitted).toMatchObject({
      calls: 1,
      results: 1,
      failures: 1,
      byteLimitGroups: 1,
    });
  });

  it('bounds malformed-source metadata with deterministic explicit omissions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'activity-project-'));
    const transcriptPath = join(directory, 'malformed.jsonl');
    const privateSourceMarker = 'private-malformed-source';
    const sourceText = `${Array.from(
      { length: 1_000 },
      (_, index) => `${privateSourceMarker}-${index}`,
    ).join('\n')}\n`;
    try {
      await writeFile(transcriptPath, sourceText, 'utf8');
      const read = await readRecordsDetailed(transcriptPath);
      const extracted = extractActivity({
        source: { ...SOURCE, transcriptPath },
        read,
      });
      const correlated = correlateActivity(extracted);
      const options = {
        mode: 'watch' as const,
        deliveryRange: {
          indexBase: 'zero-based-decoded-record-index' as const,
          start: 0,
          end: 0,
        },
      };

      const first = projectActivity(correlated, options);
      const second = projectActivity(correlated, options);
      const serialized = renderActivityReport(first);

      expect(first.events).toEqual([]);
      expect(first.renderedBytes).toBe(Buffer.byteLength(serialized, 'utf8'));
      expect(first.renderedBytes).toBeLessThanOrEqual(first.limits.maxBytes);
      expect(first.omitted.diagnostics).toBeGreaterThan(0);
      expect(first.omitted.coverageEntries).toBeGreaterThan(0);
      expect(first.diagnostics.length + first.omitted.diagnostics).toBe(1_000);
      expect(first.coverage.length + first.omitted.coverageEntries).toBe(1_004);
      expect(second.diagnostics).toEqual(first.diagnostics);
      expect(second.coverage).toEqual(first.coverage);
      expect(second.omitted).toEqual(first.omitted);
      expect(first.diagnostics.at(-1)?.locator.physicalLine).toBe(1_000);
      expect(serialized).not.toContain(privateSourceMarker);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps the activity budget independent from conversation content', () => {
    const events = [
      event('call', 'call', 0, { arguments: { value: 'activity' } }),
    ];
    const options = {
      mode: 'watch' as const,
      deliveryRange: wholeRange(events),
    };
    const before = renderActivityReport(
      projectActivity(activity(events), options),
    );
    const unrelatedConversation = 'conversation-only-content'.repeat(20_000);
    const after = renderActivityReport(
      projectActivity(activity(events), options),
    );

    expect(after).toBe(before);
    expect(after).not.toContain(unrelatedConversation.slice(0, 100));
  });

  it('renders hostile Markdown punctuation as inert data', () => {
    const events = [
      event('hostile-call', 'call', 0, {
        nativeName: '[tool](javascript:synthetic)',
        arguments: {
          prompt:
            '```md\n<script>synthetic()</script>\n[click](javascript:synthetic) **bold** _italics_ ~~strike~~',
        },
      }),
    ];
    const report = projectActivity(activity(events), {
      mode: 'export',
      deliveryRange: wholeRange(events),
    });
    const markdown = renderActivityMarkdown(report);

    expect(markdown).not.toContain('```');
    expect(markdown).not.toContain('<script>');
    expect(markdown).not.toContain('[click](javascript:synthetic)');
    expect(markdown).not.toContain('**bold**');
    expect(markdown).not.toContain('_italics_');
    expect(markdown).not.toContain('~~strike~~');
    expect(markdown).toContain(
      '\\u005bclick\\u005d\\u0028javascript:synthetic\\u0029',
    );
    expect(markdown).toContain('\\u003cscript\\u003e');
    expect(markdown).toContain('\\u002a\\u002abold\\u002a\\u002a');
    expect(markdown).toContain('\\u005fitalics\\u005f');
    expect(markdown).toContain('\\u007e\\u007estrike\\u007e\\u007e');
    expect(report.renderedBytes).toBe(Buffer.byteLength(markdown, 'utf8'));
  });

  it('exports every invocation without a count cap under the 64 MiB guard', () => {
    const events = Array.from({ length: 1_100 }, (_, index) =>
      event(`call-${index}`, 'call', index, {
        nativeName: 'custom_tool',
        arguments: { index },
      }),
    );
    const extracted = activity(events);
    extracted.coverage = [
      {
        dataClass: 'record-activity',
        status: 'truncated',
        captured: 1_100,
        locator: events.at(-1)?.locator,
      },
    ];
    extracted.diagnostics = [
      {
        code: 'POSSIBLE_SOURCE_TRUNCATION',
        locator: events.at(-1)?.locator ?? {
          physicalLine: 1_100,
          recordIndex: 1_099,
          jsonPointer: '/records/1099',
        },
        bytes: 512,
      },
    ];
    const report = projectActivity(extracted, {
      mode: 'export',
      deliveryRange: wholeRange(events),
    });
    const markdown = renderActivityMarkdown(report);

    expect(report.limits).toMatchObject({
      maxBytes: 64 * 1024 * 1024,
      maxInvocations: null,
    });
    expect(report.counts.displayed).toMatchObject({
      scope: 'displayed',
      calls: 1_100,
      countedInvocations: 1_100,
    });
    expect(report.omitted.calls).toBe(0);
    expect(report.renderedBytes).toBe(Buffer.byteLength(markdown, 'utf8'));
    expect(markdown).toContain('Activity bytes:');
    expect(markdown).toContain('/67108864');
    expect(markdown).toContain(
      'delivered-range: calls 1100; counted invocations 1100',
    );
    expect(markdown).toContain(
      'Omitted evidence: calls 0; results 0; failures 0',
    );
    expect(markdown).toContain('record-activity: truncated; captured 1100');
    expect(markdown).toContain('POSSIBLE_SOURCE_TRUNCATION');
  });
});
