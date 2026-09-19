import type { JsonObject } from '../runtimes.js';
import { classifyNativeName, classifyStandaloneItem } from './classify.js';
import type {
  ActivityCategory,
  ActivityCorrelationCounts,
  ActivityDiagnostic,
  ActivityOwnership,
  CorrelatedActivity,
  CorrelatedActivityEvent,
  ExtractedActivity,
  ExtractedActivityEvent,
} from './types.js';

type CallLookup = ReadonlyMap<string, readonly ExtractedActivityEvent[]>;

interface OwnershipContext {
  kind: 'root' | 'bounded-child' | 'unknown';
  boundary?: number;
}

function metadataObject(event: ExtractedActivityEvent): JsonObject | undefined {
  return event.metadata;
}

function ownershipContext(activity: ExtractedActivity): OwnershipContext {
  if (activity.source.runtime !== 'codex') return { kind: 'root' };
  const headers = activity.events.filter((event) => {
    if (event.kind !== 'metadata' || event.nativeType !== 'session_meta') {
      return false;
    }
    return (
      metadataObject(event)?.nativeSessionId === activity.source.nativeSessionId
    );
  });
  if (headers.length === 0) return { kind: 'unknown' };

  const childFlags = new Set(
    headers.map(
      (event) => typeof metadataObject(event)?.parentThreadId === 'string',
    ),
  );
  if (childFlags.size !== 1) return { kind: 'unknown' };
  if (!childFlags.has(true)) return { kind: 'root' };
  const parentThreadIds = new Set(
    headers.map((event) => metadataObject(event)?.parentThreadId),
  );
  if (parentThreadIds.size !== 1) return { kind: 'unknown' };

  const boundaries = headers.map(
    (event) => metadataObject(event)?.subagentHistoryStartOrdinal,
  );
  if (
    boundaries.some(
      (boundary) =>
        typeof boundary !== 'number' ||
        !Number.isSafeInteger(boundary) ||
        boundary < 0,
    )
  ) {
    return { kind: 'unknown' };
  }
  const uniqueBoundaries = new Set(boundaries as number[]);
  if (uniqueBoundaries.size !== 1) return { kind: 'unknown' };
  return { kind: 'bounded-child', boundary: boundaries[0] as number };
}

function ownershipFor(
  event: ExtractedActivityEvent,
  context: OwnershipContext,
): ActivityOwnership {
  if (context.kind === 'root') return 'owned';
  if (
    context.kind === 'unknown' ||
    typeof event.locator.ordinal !== 'number' ||
    !Number.isSafeInteger(event.locator.ordinal)
  ) {
    return 'unknown';
  }
  return event.locator.ordinal < (context.boundary as number)
    ? 'inherited'
    : 'owned';
}

function callsBy(
  calls: readonly ExtractedActivityEvent[],
  field: 'nativeCallId' | 'nativeId',
): Map<string, ExtractedActivityEvent[]> {
  const lookup = new Map<string, ExtractedActivityEvent[]>();
  for (const call of calls) {
    const value = call[field];
    if (!value) continue;
    const matches = lookup.get(value) ?? [];
    matches.push(call);
    lookup.set(value, matches);
  }
  return lookup;
}

function uniqueCall(
  lookup: CallLookup,
  nativeId: string | undefined,
): ExtractedActivityEvent | undefined {
  if (!nativeId) return undefined;
  const matches = lookup.get(nativeId);
  return matches?.length === 1 ? matches[0] : undefined;
}

function relatedCall(
  event: ExtractedActivityEvent,
  byCallId: CallLookup,
  byNativeId: CallLookup,
): ExtractedActivityEvent | undefined {
  if (event.kind === 'result') {
    return uniqueCall(byCallId, event.nativeCallId);
  }
  if (event.kind !== 'item') return undefined;

  const candidates = new Map<string, ExtractedActivityEvent>();
  const byCall = uniqueCall(byCallId, event.nativeCallId);
  const byItem = uniqueCall(byNativeId, event.nativeId);
  if (byCall) candidates.set(byCall.eventKey, byCall);
  if (byItem) candidates.set(byItem.eventKey, byItem);
  return candidates.size === 1 ? [...candidates.values()][0] : undefined;
}

function ambiguousDiagnostics(
  lookup: CallLookup,
  field: 'nativeCallId' | 'nativeId',
): ActivityDiagnostic[] {
  return [...lookup.entries()].flatMap(([nativeId, calls]) => {
    if (calls.length < 2) return [];
    return [
      {
        code: 'AMBIGUOUS_NATIVE_CORRELATION' as const,
        locator: calls[0].locator,
        field,
        nativeId,
      },
    ];
  });
}

function conflictingItemDiagnostics(
  events: readonly ExtractedActivityEvent[],
  byCallId: CallLookup,
  byNativeId: CallLookup,
): ActivityDiagnostic[] {
  return events.flatMap((event) => {
    if (event.kind !== 'item') return [];
    const byCall = uniqueCall(byCallId, event.nativeCallId);
    const byItem = uniqueCall(byNativeId, event.nativeId);
    if (!byCall || !byItem || byCall.eventKey === byItem.eventKey) return [];
    return [
      {
        code: 'AMBIGUOUS_NATIVE_CORRELATION' as const,
        locator: event.locator,
        field: 'nativeCallId+nativeId',
      },
    ];
  });
}

function categoryFor(
  event: ExtractedActivityEvent,
  related: ExtractedActivityEvent | undefined,
): ActivityCategory | undefined {
  if (event.kind === 'call') return classifyNativeName(event.nativeName);
  if (related) return classifyNativeName(related.nativeName);
  if (event.kind === 'result') return 'other';
  return classifyStandaloneItem(event);
}

function correlationCounts(
  events: readonly CorrelatedActivityEvent[],
): ActivityCorrelationCounts {
  const calls = events.filter((event) => event.kind === 'call');
  const results = events.filter((event) => event.kind === 'result');
  const items = events.filter((event) => event.kind === 'item');
  const countOwnership = (ownership: ActivityOwnership): number =>
    calls.filter((event) => event.ownership === ownership).length;
  const owned = countOwnership('owned');
  return {
    responseStreamCalls: {
      captured: calls.length,
      counted: owned,
      owned,
      inherited: countOwnership('inherited'),
      unknown: countOwnership('unknown'),
    },
    results: {
      matched: results.filter((event) => event.relatedCallKey !== undefined)
        .length,
      unmatched: results.filter((event) => event.relatedCallKey === undefined)
        .length,
    },
    itemEvidence: {
      linked: items.filter((event) => event.relatedCallKey !== undefined)
        .length,
      standalone: items.filter((event) => event.relatedCallKey === undefined)
        .length,
    },
  };
}

export function correlateActivity(
  activity: ExtractedActivity,
): CorrelatedActivity {
  const context = ownershipContext(activity);
  const calls = activity.events.filter((event) => event.kind === 'call');
  const byCallId = callsBy(calls, 'nativeCallId');
  const byNativeId = callsBy(calls, 'nativeId');
  const events = activity.events.map((event): CorrelatedActivityEvent => {
    const related = relatedCall(event, byCallId, byNativeId);
    const category = categoryFor(event, related);
    return {
      ...event,
      ownership: ownershipFor(event, context),
      ...(category === undefined ? {} : { category }),
      ...(related === undefined ? {} : { relatedCallKey: related.eventKey }),
    };
  });

  return {
    ...activity,
    events,
    correlationCounts: correlationCounts(events),
    diagnostics: [
      ...activity.diagnostics,
      ...ambiguousDiagnostics(byCallId, 'nativeCallId'),
      ...ambiguousDiagnostics(byNativeId, 'nativeId'),
      ...conflictingItemDiagnostics(activity.events, byCallId, byNativeId),
    ],
  };
}
