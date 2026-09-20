import type {
  ActivityLocator,
  ActivityPreview,
  ActivityReport,
  ActivityScopedCounts,
  ProjectedActivityEvent,
} from './types.js';

function stableJsonValue(value: unknown, seen: Set<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item, seen));
  }
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const result = Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableJsonValue(item, seen)]),
  );
  seen.delete(value);
  return result;
}

export function stableActivityStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(stableJsonValue(value, new Set()));
}

export function renderActivityReport(report: ActivityReport): string {
  return stableActivityStringify(report);
}

function markdownData(value: unknown): string {
  return stableActivityStringify(value)
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('`', '\\u0060')
    .replaceAll('[', '\\u005b')
    .replaceAll(']', '\\u005d')
    .replaceAll('(', '\\u0028')
    .replaceAll(')', '\\u0029')
    .replaceAll('*', '\\u002a')
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\u005f')
    .replaceAll('~', '\\u007e');
}

function locatorText(locator: ActivityLocator | undefined): string {
  if (!locator) return 'source-wide';
  if (locator.sourceFrameIndex !== undefined) {
    const delivery =
      locator.deliveryFrameIndex === undefined
        ? ''
        : `, delivery frame ${locator.deliveryFrameIndex}`;
    return `source frame ${locator.sourceFrameIndex}${delivery}, line ${locator.physicalLine}, pointer ${locator.jsonPointer || '/'}`;
  }
  const record =
    locator.recordIndex === undefined ? '' : `, record ${locator.recordIndex}`;
  return `line ${locator.physicalLine}${record}, pointer ${locator.jsonPointer || '/'}`;
}

function previewLine(
  label: string,
  preview: ActivityPreview | undefined,
): string[] {
  if (!preview) return [];
  const clipped = preview.truncated
    ? `; clipped ${preview.displayedBytes}/${preview.sourceBytes} bytes`
    : `; ${preview.displayedBytes} bytes`;
  return [`  - ${label}${clipped}: ${markdownData(preview.text)}`];
}

function eventLines(event: ProjectedActivityEvent): string[] {
  const identity = event.nativeName ?? event.nativeType;
  const source = locatorText(event.locator);
  const relation = event.relatedCallKey
    ? `; related call ${markdownData(event.relatedCallKey)}`
    : '';
  const evidence = Object.fromEntries(
    Object.entries({
      nativeType: event.nativeName === undefined ? undefined : event.nativeType,
      category: event.category,
      nativeId: event.nativeId,
      nativeCallId: event.nativeCallId,
      nativeStatus: event.nativeStatus,
      origin: event.origin,
      turnId: event.turnId,
      lifecycleAvailability: event.lifecycleAvailability,
      turnOutcome: event.turnOutcome,
      externalReference: event.externalReference,
      childReference: event.childReference,
      skillEvidence: event.skillEvidence,
    }).filter(([, value]) => value !== undefined),
  );
  return [
    `- ${event.kind} ${markdownData(identity)}; ${event.outcome}; ${event.ownership}; ${source}${relation}`,
    ...(Object.keys(evidence).length === 0
      ? []
      : [`  - native evidence: ${markdownData(evidence)}`]),
    ...previewLine('input', event.inputPreview),
    ...previewLine('original input', event.originalInputPreview),
    ...previewLine('output', event.outputPreview),
    ...previewLine('metadata', event.metadataPreview),
    ...(event.outputPreviewOmitted
      ? [`  - output preview: ${event.outputPreviewOmitted}`]
      : []),
  ];
}

function countLine(counts: ActivityScopedCounts): string {
  return `- ${counts.scope}: calls ${counts.calls}; counted invocations ${counts.countedInvocations}; pending lifecycle ${counts.pendingLifecycleCalls}; results ${counts.results}; items ${counts.items}; failures ${counts.failures}`;
}

export function renderActivityMarkdown(report: ActivityReport): string {
  const lines = [
    '## Activity',
    '',
    `- Schema: ${report.activitySchemaVersion}`,
    `- Mode: ${report.mode}`,
    `- Budgeted format: ${report.renderedFormat}`,
    `- Runtime: ${report.source.runtime}`,
    `- Native session: ${markdownData(report.source.nativeSessionId)}`,
    `- Source: ${markdownData(report.source.transcriptPath)}`,
    `- Source snapshot: ${report.sourceSnapshot.sourceBytes} bytes captured at ${report.sourceSnapshot.capturedAt}`,
    `- Delivery range: [${report.deliveryRange.start}, ${report.deliveryRange.end}) ${report.deliveryRange.indexBase}`,
    `- Activity bytes: ${report.renderedBytes}/${report.limits.maxBytes}; preview cap: ${report.limits.previewBytes}; late context cap: ${report.limits.lateContextBytes}`,
    countLine(report.counts.capturedSource),
    countLine(report.counts.deliveredRange),
    countLine(report.counts.displayed),
    `- Omitted evidence: calls ${report.omitted.calls}; results ${report.omitted.results}; failures ${report.omitted.failures}`,
    `- Omitted groups: invocation limit ${report.omitted.invocationLimitGroups}; byte limit ${report.omitted.byteLimitGroups}`,
    `- Omitted metadata: coverage ${report.omitted.coverageEntries}; diagnostics ${report.omitted.diagnostics}`,
    `- Source metadata: ${report.sourceMetadata.scope}; skills ${report.sourceMetadata.skills.length}; omitted skills ${report.omitted.sourceSkills}`,
    '',
    '### Events',
    '',
    ...(report.events.length === 0
      ? ['- None in the displayed range.']
      : report.events.flatMap(eventLines)),
  ];

  if (report.callContexts.length > 0) {
    lines.push('', '### Earlier call context', '');
    for (const context of report.callContexts) {
      lines.push(
        `- ${markdownData(context.nativeName ?? context.callKey)}; ${context.availability}; ${locatorText(context.locator)}`,
        ...previewLine('input context', context.inputPreview),
        ...previewLine('original input context', context.originalInputPreview),
      );
    }
  }

  if (report.coverage.length > 0) {
    lines.push('', '### Coverage', '');
    for (const coverage of report.coverage) {
      lines.push(
        `- ${coverage.dataClass}: ${coverage.status}; captured ${coverage.captured}; ${locatorText(coverage.locator)}`,
      );
    }
  }

  if (report.diagnostics.length > 0) {
    lines.push('', '### Diagnostics', '');
    for (const diagnostic of report.diagnostics) {
      const details = Object.fromEntries(
        Object.entries({
          field: diagnostic.field,
          bytes: diagnostic.bytes,
          nativeId: diagnostic.nativeId,
        }).filter(([, value]) => value !== undefined),
      );
      lines.push(
        `- ${diagnostic.code}; ${locatorText(diagnostic.locator)}${Object.keys(details).length === 0 ? '' : `; ${markdownData(details)}`}`,
      );
    }
  }
  if (report.sourceMetadata.skills.length > 0) {
    lines.push('', '### Captured-source skills', '');
    for (const skill of report.sourceMetadata.skills) {
      lines.push(
        `- ${skill.evidence}: ${markdownData(skill.name)}; ${locatorText(skill.locator)}`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}
