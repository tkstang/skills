import {
  renderActivityMarkdown,
  renderActivityReport,
  stableActivityStringify,
} from './render.js';
import type {
  ActivityCallContext,
  ActivityCoverageEntry,
  ActivityDeliveryRange,
  ActivityDiagnostic,
  ActivityPreview,
  ActivityProjectionLimits,
  ActivityProjectionMode,
  ActivityReport,
  ActivityScopedCounts,
  ActivitySourceSkill,
  ActivityUsageMetadata,
  CorrelatedActivity,
  CorrelatedActivityEvent,
  ProjectActivityOptions,
  ProjectedActivityEvent,
} from './types.js';

const KIB = 1024;
const MIB = 1024 * KIB;

export const ACTIVITY_PROJECTION_LIMITS: Readonly<
  Record<ActivityProjectionMode, ActivityProjectionLimits>
> = {
  watch: {
    maxBytes: 32 * KIB,
    maxInvocations: 80,
    previewBytes: 2 * KIB,
    lateContextBytes: 256,
  },
  'catch-up': {
    maxBytes: 32 * KIB,
    maxInvocations: 80,
    previewBytes: 2 * KIB,
    lateContextBytes: 256,
  },
  review: {
    maxBytes: 128 * KIB,
    maxInvocations: 1024,
    previewBytes: 2 * KIB,
    lateContextBytes: 256,
  },
  export: {
    maxBytes: 64 * MIB,
    maxInvocations: null,
    previewBytes: 2 * KIB,
    lateContextBytes: 256,
  },
};

interface EvidenceGroup {
  key: string;
  events: CorrelatedActivityEvent[];
  call?: CorrelatedActivityEvent;
  displayedInvocation: boolean;
  failure: boolean;
  recency: number;
}

interface OmissionReasons {
  invocationLimitGroups: number;
  byteLimitGroups: number;
  coverageEntries: number;
  diagnostics: number;
  sourceSkills: number;
  usageSamples: number;
  usageDiagnostics: number;
}

interface ReportMetadata {
  coverage: ActivityCoverageEntry[];
  diagnostics: ActivityDiagnostic[];
  sourceSkills: ActivitySourceSkill[];
  usage: ActivityUsageMetadata;
}

interface MetadataCandidate {
  kind:
    | 'coverage'
    | 'diagnostics'
    | 'sourceSkills'
    | 'usageSamples'
    | 'usageDiagnostics';
  index: number;
  locator: ActivityCoverageEntry['locator'];
}

function inRange(
  event: CorrelatedActivityEvent,
  range: ActivityDeliveryRange,
): boolean {
  return (
    event.locator.recordIndex >= range.start &&
    event.locator.recordIndex < range.end
  );
}

function validateRange(range: ActivityDeliveryRange): void {
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end) ||
    range.start < 0 ||
    range.end < range.start
  ) {
    throw new Error('Activity delivery range must be a valid half-open range');
  }
}

function validateLimits(limits: ActivityProjectionLimits): void {
  if (
    !Number.isSafeInteger(limits.maxBytes) ||
    limits.maxBytes <= 0 ||
    (limits.maxInvocations !== null &&
      (!Number.isSafeInteger(limits.maxInvocations) ||
        limits.maxInvocations < 0)) ||
    !Number.isSafeInteger(limits.previewBytes) ||
    limits.previewBytes <= 0 ||
    !Number.isSafeInteger(limits.lateContextBytes) ||
    limits.lateContextBytes <= 0
  ) {
    throw new Error('Activity projection limits must be positive integers');
  }
}

function clipUtf8(text: string, maxBytes: number): ActivityPreview {
  const sourceBytes = Buffer.byteLength(text, 'utf8');
  if (sourceBytes <= maxBytes) {
    return {
      text,
      sourceBytes,
      displayedBytes: sourceBytes,
      truncated: false,
    };
  }
  let displayed = '';
  let displayedBytes = 0;
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (displayedBytes + characterBytes > maxBytes) break;
    displayed += character;
    displayedBytes += characterBytes;
  }
  return {
    text: displayed,
    sourceBytes,
    displayedBytes,
    truncated: true,
  };
}

function preview(value: unknown, maxBytes: number): ActivityPreview {
  return clipUtf8(stableActivityStringify(value), maxBytes);
}

function compareChronology(
  left: CorrelatedActivityEvent,
  right: CorrelatedActivityEvent,
): number {
  return (
    left.locator.recordIndex - right.locator.recordIndex ||
    left.locator.jsonPointer.localeCompare(right.locator.jsonPointer) ||
    left.eventKey.localeCompare(right.eventKey)
  );
}

function compareHighPriority(
  left: EvidenceGroup,
  right: EvidenceGroup,
): number {
  return (
    Number(right.failure) - Number(left.failure) ||
    right.recency - left.recency ||
    left.key.localeCompare(right.key)
  );
}

function compareLowPriority(left: EvidenceGroup, right: EvidenceGroup): number {
  return (
    Number(left.failure) - Number(right.failure) ||
    left.recency - right.recency ||
    right.key.localeCompare(left.key)
  );
}

function buildGroups(activity: CorrelatedActivity): EvidenceGroup[] {
  const calls = new Map(
    activity.events
      .filter((event) => event.kind === 'call')
      .map((event) => [event.eventKey, event]),
  );
  const grouped = new Map<string, CorrelatedActivityEvent[]>();
  for (const event of activity.events) {
    const key =
      event.kind === 'call'
        ? event.eventKey
        : (event.relatedCallKey ?? event.eventKey);
    const events = grouped.get(key) ?? [];
    events.push(event);
    grouped.set(key, events);
  }
  return [...grouped.entries()].map(([key, events]) => {
    const call = calls.get(key);
    return {
      key,
      events: events.toSorted(compareChronology),
      ...(call === undefined ? {} : { call }),
      displayedInvocation: call !== undefined,
      failure: events.some(
        (event) => event.outcome === 'error' || event.outcome === 'cancelled',
      ),
      recency: Math.max(...events.map((event) => event.locator.recordIndex)),
    };
  });
}

function deliveredGroups(
  activity: CorrelatedActivity,
  range: ActivityDeliveryRange,
): EvidenceGroup[] {
  return buildGroups(activity).flatMap((group) => {
    const events = group.events.filter((event) => inRange(event, range));
    if (events.length === 0) return [];
    const deliveredCall = events.find((event) => event.kind === 'call');
    return [
      {
        ...group,
        events,
        displayedInvocation: deliveredCall !== undefined,
        failure: events.some(
          (event) => event.outcome === 'error' || event.outcome === 'cancelled',
        ),
        recency: Math.max(...events.map((event) => event.locator.recordIndex)),
      },
    ];
  });
}

function deliveredMetadata(
  activity: CorrelatedActivity,
  range: ActivityDeliveryRange,
): ReportMetadata {
  const locatorInRange = (
    locator: ActivityCoverageEntry['locator'],
  ): boolean => {
    const index = locator?.recordIndex;
    return index === undefined || (index >= range.start && index < range.end);
  };
  return {
    coverage: activity.coverage.filter((entry) =>
      locatorInRange(entry.locator),
    ),
    diagnostics: activity.diagnostics.filter((entry) =>
      locatorInRange(entry.locator),
    ),
    sourceSkills: activity.sourceMetadata?.skills ?? [],
    usage: activity.sourceMetadata?.usage ?? {
      scope: 'captured-source',
      availability: 'not-recorded',
      samples: [],
      diagnostics: [],
    },
  };
}

function compareMetadataPriority(
  left: MetadataCandidate,
  right: MetadataCandidate,
): number {
  return (
    (right.locator?.recordIndex ?? -1) - (left.locator?.recordIndex ?? -1) ||
    (right.locator?.physicalLine ?? -1) - (left.locator?.physicalLine ?? -1) ||
    Number(right.kind === 'diagnostics') -
      Number(left.kind === 'diagnostics') ||
    left.index - right.index
  );
}

function retainMetadata(
  metadata: ReportMetadata,
  retainedCount: number,
): ReportMetadata {
  const priority = [
    ...metadata.coverage.map(
      (entry, index): MetadataCandidate => ({
        kind: 'coverage',
        index,
        locator: entry.locator,
      }),
    ),
    ...metadata.diagnostics.map(
      (entry, index): MetadataCandidate => ({
        kind: 'diagnostics',
        index,
        locator: entry.locator,
      }),
    ),
    ...metadata.sourceSkills.map(
      (entry, index): MetadataCandidate => ({
        kind: 'sourceSkills',
        index,
        locator: entry.locator,
      }),
    ),
    ...metadata.usage.samples.map(
      (entry, index): MetadataCandidate => ({
        kind: 'usageSamples',
        index,
        locator: entry.locator,
      }),
    ),
    ...metadata.usage.diagnostics.map(
      (entry, index): MetadataCandidate => ({
        kind: 'usageDiagnostics',
        index,
        locator: entry.locator,
      }),
    ),
  ].toSorted(compareMetadataPriority);
  const retainedCoverage = new Set<number>();
  const retainedDiagnostics = new Set<number>();
  const retainedSourceSkills = new Set<number>();
  const retainedUsageSamples = new Set<number>();
  const retainedUsageDiagnostics = new Set<number>();
  for (const candidate of priority.slice(0, retainedCount)) {
    let target = retainedUsageDiagnostics;
    switch (candidate.kind) {
      case 'coverage':
        target = retainedCoverage;
        break;
      case 'diagnostics':
        target = retainedDiagnostics;
        break;
      case 'sourceSkills':
        target = retainedSourceSkills;
        break;
      case 'usageSamples':
        target = retainedUsageSamples;
        break;
      case 'usageDiagnostics':
        target = retainedUsageDiagnostics;
        break;
    }
    target.add(candidate.index);
  }
  return {
    coverage: metadata.coverage.filter((_, index) =>
      retainedCoverage.has(index),
    ),
    diagnostics: metadata.diagnostics.filter((_, index) =>
      retainedDiagnostics.has(index),
    ),
    sourceSkills: metadata.sourceSkills.filter((_, index) =>
      retainedSourceSkills.has(index),
    ),
    usage: {
      ...metadata.usage,
      samples: metadata.usage.samples.filter((_, index) =>
        retainedUsageSamples.has(index),
      ),
      diagnostics: metadata.usage.diagnostics.filter((_, index) =>
        retainedUsageDiagnostics.has(index),
      ),
    },
  };
}

function retainOptionalSourceMetadata(
  metadata: ReportMetadata,
  retainedCount: number,
): ReportMetadata {
  const priority = [
    ...metadata.sourceSkills.map(
      (entry, index): MetadataCandidate => ({
        kind: 'sourceSkills',
        index,
        locator: entry.locator,
      }),
    ),
    ...metadata.usage.samples.map(
      (entry, index): MetadataCandidate => ({
        kind: 'usageSamples',
        index,
        locator: entry.locator,
      }),
    ),
    ...metadata.usage.diagnostics.map(
      (entry, index): MetadataCandidate => ({
        kind: 'usageDiagnostics',
        index,
        locator: entry.locator,
      }),
    ),
  ].toSorted(compareMetadataPriority);
  const retainedSourceSkills = new Set<number>();
  const retainedUsageSamples = new Set<number>();
  const retainedUsageDiagnostics = new Set<number>();
  for (const candidate of priority.slice(0, retainedCount)) {
    const target =
      candidate.kind === 'sourceSkills'
        ? retainedSourceSkills
        : candidate.kind === 'usageSamples'
          ? retainedUsageSamples
          : retainedUsageDiagnostics;
    target.add(candidate.index);
  }
  return {
    coverage: metadata.coverage,
    diagnostics: metadata.diagnostics,
    sourceSkills: metadata.sourceSkills.filter((_, index) =>
      retainedSourceSkills.has(index),
    ),
    usage: {
      ...metadata.usage,
      samples: metadata.usage.samples.filter((_, index) =>
        retainedUsageSamples.has(index),
      ),
      diagnostics: metadata.usage.diagnostics.filter((_, index) =>
        retainedUsageDiagnostics.has(index),
      ),
    },
  };
}

function projectEvent(
  event: CorrelatedActivityEvent,
  limits: ActivityProjectionLimits,
  suppressLinkedItemOutput: boolean,
): ProjectedActivityEvent {
  return {
    eventKey: event.eventKey,
    kind: event.kind,
    nativeType: event.nativeType,
    locator: event.locator,
    outcome: event.outcome,
    ownership: event.ownership,
    ...(event.category === undefined ? {} : { category: event.category }),
    ...(event.relatedCallKey === undefined
      ? {}
      : { relatedCallKey: event.relatedCallKey }),
    ...(event.nativeId === undefined ? {} : { nativeId: event.nativeId }),
    ...(event.nativeCallId === undefined
      ? {}
      : { nativeCallId: event.nativeCallId }),
    ...(event.nativeName === undefined ? {} : { nativeName: event.nativeName }),
    ...(event.nativeStatus === undefined
      ? {}
      : { nativeStatus: event.nativeStatus }),
    ...(event.origin === undefined ? {} : { origin: event.origin }),
    ...(event.turnId === undefined ? {} : { turnId: event.turnId }),
    ...(event.lifecycleAvailability === undefined
      ? {}
      : { lifecycleAvailability: event.lifecycleAvailability }),
    ...(event.turnOutcome === undefined
      ? {}
      : { turnOutcome: event.turnOutcome }),
    ...(Object.hasOwn(event, 'arguments')
      ? { inputPreview: preview(event.arguments, limits.previewBytes) }
      : {}),
    ...(Object.hasOwn(event, 'originalArguments')
      ? {
          originalInputPreview: preview(
            event.originalArguments,
            limits.previewBytes,
          ),
        }
      : {}),
    ...(event.kind === 'result' && Object.hasOwn(event, 'result')
      ? { outputPreview: preview(event.result, limits.previewBytes) }
      : {}),
    ...(event.kind === 'item' && suppressLinkedItemOutput
      ? { outputPreviewOmitted: 'exact-linked-duplicate-carrier' as const }
      : event.kind === 'item' && Object.hasOwn(event, 'nativeValue')
        ? { outputPreview: preview(event.nativeValue, limits.previewBytes) }
        : event.kind === 'item' && Object.hasOwn(event, 'result')
          ? { outputPreview: preview(event.result, limits.previewBytes) }
          : {}),
    ...(event.metadata === undefined
      ? {}
      : { metadataPreview: preview(event.metadata, limits.previewBytes) }),
    ...(event.externalReference === undefined
      ? {}
      : { externalReference: event.externalReference }),
    ...(event.childReference === undefined
      ? {}
      : { childReference: event.childReference }),
    ...(event.skillEvidence === undefined
      ? {}
      : { skillEvidence: event.skillEvidence }),
  };
}

function countEvents(
  scope: ActivityScopedCounts['scope'],
  events: readonly CorrelatedActivityEvent[],
): ActivityScopedCounts {
  return {
    scope,
    calls: events.filter((event) => event.kind === 'call').length,
    countedInvocations: events.filter(
      (event) => event.kind === 'call' && event.ownership === 'owned',
    ).length,
    pendingLifecycleCalls: events.filter(
      (event) =>
        event.kind === 'call' &&
        event.lifecycleAvailability === 'pending-lifecycle',
    ).length,
    results: events.filter((event) => event.kind === 'result').length,
    items: events.filter((event) => event.kind === 'item').length,
    failures: events.filter(
      (event) => event.outcome === 'error' || event.outcome === 'cancelled',
    ).length,
  };
}

function finalizeRenderedBytes(report: ActivityReport): ActivityReport {
  let finalized = report;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const rendered =
      finalized.renderedFormat === 'markdown'
        ? renderActivityMarkdown(finalized)
        : renderActivityReport(finalized);
    const renderedBytes = Buffer.byteLength(rendered, 'utf8');
    if (renderedBytes === finalized.renderedBytes) return finalized;
    finalized = { ...finalized, renderedBytes };
  }
  throw new Error('Activity report byte size did not stabilize');
}

function buildReport(
  activity: CorrelatedActivity,
  options: ProjectActivityOptions,
  limits: ActivityProjectionLimits,
  groups: readonly EvidenceGroup[],
  retainedKeys: ReadonlySet<string>,
  metadata: ReportMetadata,
  reasons: OmissionReasons,
): ActivityReport {
  const deliveredEvents = groups.flatMap((group) => group.events);
  const retainedGroups = groups.filter((group) => retainedKeys.has(group.key));
  const displayedRaw = retainedGroups
    .flatMap((group) => group.events)
    .toSorted(compareChronology);
  const groupWithOutputResult = new Set(
    retainedGroups
      .filter((group) =>
        group.events.some(
          (event) => event.kind === 'result' && Object.hasOwn(event, 'result'),
        ),
      )
      .map((group) => group.key),
  );
  const eventGroup = new Map(
    retainedGroups.flatMap((group) =>
      group.events.map((event) => [event.eventKey, group.key]),
    ),
  );
  const events = displayedRaw.map((event) =>
    projectEvent(
      event,
      limits,
      event.kind === 'item' &&
        event.relatedCallKey !== undefined &&
        groupWithOutputResult.has(eventGroup.get(event.eventKey) ?? ''),
    ),
  );
  const callContexts: ActivityCallContext[] = retainedGroups
    .flatMap((group) => {
      if (!group.call || inRange(group.call, options.deliveryRange)) return [];
      return [
        {
          callKey: group.call.eventKey,
          availability: 'outside-delivered-range' as const,
          locator: group.call.locator,
          ...(group.call.nativeCallId === undefined
            ? {}
            : { nativeCallId: group.call.nativeCallId }),
          ...(group.call.nativeName === undefined
            ? {}
            : { nativeName: group.call.nativeName }),
          ...(group.call.category === undefined
            ? {}
            : { category: group.call.category }),
          ...(Object.hasOwn(group.call, 'arguments')
            ? {
                inputPreview: preview(
                  group.call.arguments,
                  limits.lateContextBytes,
                ),
              }
            : {}),
          ...(Object.hasOwn(group.call, 'originalArguments')
            ? {
                originalInputPreview: preview(
                  group.call.originalArguments,
                  limits.lateContextBytes,
                ),
              }
            : {}),
        },
      ];
    })
    .toSorted(
      (left, right) =>
        left.locator.recordIndex - right.locator.recordIndex ||
        left.callKey.localeCompare(right.callKey),
    );
  const captured = countEvents('captured-source', activity.events);
  const delivered = countEvents('delivered-range', deliveredEvents);
  const displayed = countEvents('displayed', displayedRaw);
  const report: ActivityReport = {
    activitySchemaVersion: activity.activitySchemaVersion,
    mode: options.mode,
    renderedFormat: options.renderFormat,
    source: activity.source,
    sourceSnapshot: activity.sourceSnapshot,
    deliveryRange: options.deliveryRange,
    limits,
    renderedBytes: 0,
    counts: {
      capturedSource: captured,
      deliveredRange: delivered,
      displayed,
    },
    omitted: {
      calls: delivered.calls - displayed.calls,
      results: delivered.results - displayed.results,
      failures: delivered.failures - displayed.failures,
      ...reasons,
    },
    events,
    callContexts,
    coverage: metadata.coverage,
    diagnostics: metadata.diagnostics,
    sourceMetadata: {
      scope: 'captured-source',
      skills: metadata.sourceSkills,
      usage: metadata.usage,
    },
  };
  return finalizeRenderedBytes(report);
}

export function projectActivityWithLimits(
  activity: CorrelatedActivity,
  options: ProjectActivityOptions,
  limits: ActivityProjectionLimits,
): ActivityReport {
  validateRange(options.deliveryRange);
  validateLimits(limits);
  const groups = deliveredGroups(activity, options.deliveryRange);
  const displayedInvocations = groups
    .filter((group) => group.displayedInvocation)
    .toSorted(compareHighPriority);
  const invocationOmitted =
    limits.maxInvocations === null
      ? []
      : displayedInvocations.slice(limits.maxInvocations);
  const retained = new Set(groups.map((group) => group.key));
  for (const group of invocationOmitted) retained.delete(group.key);
  const metadata = deliveredMetadata(activity, options.deliveryRange);
  const initialReasons: OmissionReasons = {
    invocationLimitGroups: invocationOmitted.length,
    byteLimitGroups: 0,
    coverageEntries: 0,
    diagnostics: 0,
    sourceSkills: 0,
    usageSamples: 0,
    usageDiagnostics: 0,
  };
  const initial = buildReport(
    activity,
    options,
    limits,
    groups,
    retained,
    metadata,
    initialReasons,
  );
  if (initial.renderedBytes <= limits.maxBytes) return initial;

  const optionalMetadataCount =
    metadata.sourceSkills.length +
    metadata.usage.samples.length +
    metadata.usage.diagnostics.length;
  let optionalLow = 0;
  let optionalHigh = optionalMetadataCount;
  let best: ActivityReport | undefined;
  while (optionalLow <= optionalHigh) {
    const retainedCount = Math.floor((optionalLow + optionalHigh) / 2);
    const retainedMetadata = retainOptionalSourceMetadata(
      metadata,
      retainedCount,
    );
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      retained,
      retainedMetadata,
      {
        ...initialReasons,
        sourceSkills:
          metadata.sourceSkills.length - retainedMetadata.sourceSkills.length,
        usageSamples:
          metadata.usage.samples.length - retainedMetadata.usage.samples.length,
        usageDiagnostics:
          metadata.usage.diagnostics.length -
          retainedMetadata.usage.diagnostics.length,
      },
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      optionalLow = retainedCount + 1;
    } else {
      optionalHigh = retainedCount - 1;
    }
  }
  if (best) return best;

  const boundedMetadata = retainOptionalSourceMetadata(metadata, 0);
  const boundedReasons: OmissionReasons = {
    ...initialReasons,
    sourceSkills: metadata.sourceSkills.length,
    usageSamples: metadata.usage.samples.length,
    usageDiagnostics: metadata.usage.diagnostics.length,
  };

  const removable = groups
    .filter((group) => retained.has(group.key))
    .toSorted(compareLowPriority);
  let low = 1;
  let high = removable.length;
  best = undefined;
  while (low <= high) {
    const removedCount = Math.floor((low + high) / 2);
    const candidateKeys = new Set(retained);
    for (const group of removable.slice(0, removedCount)) {
      candidateKeys.delete(group.key);
    }
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      candidateKeys,
      boundedMetadata,
      {
        ...boundedReasons,
        byteLimitGroups: removedCount,
      },
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      high = removedCount - 1;
    } else {
      low = removedCount + 1;
    }
  }
  if (best) return best;

  const metadataCount =
    boundedMetadata.coverage.length + boundedMetadata.diagnostics.length;
  let metadataLow = 0;
  let metadataHigh = metadataCount;
  while (metadataLow <= metadataHigh) {
    const retainedCount = Math.floor((metadataLow + metadataHigh) / 2);
    const retainedMetadata = retainMetadata(boundedMetadata, retainedCount);
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      new Set(),
      retainedMetadata,
      {
        ...boundedReasons,
        byteLimitGroups: removable.length,
        coverageEntries:
          boundedMetadata.coverage.length - retainedMetadata.coverage.length,
        diagnostics:
          boundedMetadata.diagnostics.length -
          retainedMetadata.diagnostics.length,
      },
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      metadataLow = retainedCount + 1;
    } else {
      metadataHigh = retainedCount - 1;
    }
  }
  if (best) return best;
  throw new RangeError('Activity report envelope exceeds the byte limit');
}

export function projectActivity(
  activity: CorrelatedActivity,
  options: ProjectActivityOptions,
): ActivityReport {
  return projectActivityWithLimits(
    activity,
    options,
    ACTIVITY_PROJECTION_LIMITS[options.mode],
  );
}
