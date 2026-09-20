import { extractClaudeRecord } from './claude-code.js';
import { extractCodexRecord } from './codex.js';
import { ACTIVITY_SCHEMA_VERSION } from './types.js';
import type {
  ActivityCoverageEntry,
  ActivityDataClass,
  ActivityDiagnosticCode,
  ActivityLocator,
  ActivitySourceSkill,
  ExtractActivityInput,
  ExtractedActivity,
  ExtractedActivityEvent,
  ExtractedRecordActivity,
} from './types.js';

function validateInput(input: ExtractActivityInput): void {
  const { source } = input;
  if (!source.sessionId || !source.nativeSessionId || !source.transcriptPath) {
    throw new Error('Activity extraction requires an exact selected source');
  }
  if (source.runtime !== 'claude-code' && source.runtime !== 'codex') {
    throw new Error(`Unsupported activity runtime: ${String(source.runtime)}`);
  }
}

function sourceDiagnosticCode(
  kind: ExtractActivityInput['read']['diagnostics'][number]['kind'],
): ActivityDiagnosticCode {
  switch (kind) {
    case 'malformed':
      return 'SOURCE_MALFORMED_RECORD';
    case 'not-object':
      return 'SOURCE_NOT_OBJECT';
    case 'partial-tail':
      return 'SOURCE_PARTIAL_TAIL';
  }
}

function baseCoverage(events: readonly ExtractedActivityEvent[]) {
  const count = (dataClass: ActivityDataClass): number => {
    switch (dataClass) {
      case 'calls':
        return events.filter((event) => event.kind === 'call').length;
      case 'results':
        return events.filter((event) => event.kind === 'result').length;
      case 'items':
        return events.filter((event) => event.kind === 'item').length;
      case 'metadata':
        return events.filter((event) =>
          ['metadata', 'notification', 'lifecycle', 'compaction'].includes(
            event.kind,
          ),
        ).length;
      default:
        return 0;
    }
  };

  return (['calls', 'results', 'items', 'metadata'] as const).map(
    (dataClass): ActivityCoverageEntry => ({
      dataClass,
      status: 'available',
      captured: count(dataClass),
    }),
  );
}

function extractionFailure(locator: ActivityLocator): ExtractedRecordActivity {
  return {
    events: [],
    diagnostics: [{ code: 'ACTIVITY_EXTRACTION_ERROR', locator }],
    coverage: [
      {
        dataClass: 'record-activity',
        status: 'not-read',
        captured: 0,
        locator,
      },
    ],
  };
}

export function extractActivity(
  input: ExtractActivityInput,
): ExtractedActivity {
  validateInput(input);
  const events: ExtractedActivity['events'] = [];
  const coverage: ExtractedActivity['coverage'] = [];
  const diagnostics: ExtractedActivity['diagnostics'] = [];
  const sourceSkills: ActivitySourceSkill[] = [];

  for (const sourceDiagnostic of input.read.diagnostics) {
    const locator: ActivityLocator = {
      physicalLine: sourceDiagnostic.physicalLine,
      jsonPointer: '',
    };
    diagnostics.push({
      code: sourceDiagnosticCode(sourceDiagnostic.kind),
      locator,
    });
    coverage.push({
      dataClass: 'record-activity',
      status: 'malformed',
      captured: 0,
      locator,
    });
  }

  for (const detailed of input.read.records) {
    let extracted: ExtractedRecordActivity;
    try {
      extracted =
        input.source.runtime === 'claude-code'
          ? extractClaudeRecord(input.source, detailed)
          : extractCodexRecord(input.source, detailed);
    } catch {
      extracted = extractionFailure({
        recordIndex: detailed.recordIndex,
        physicalLine: detailed.physicalLine,
        jsonPointer: '',
      });
    }
    events.push(...extracted.events);
    coverage.push(...extracted.coverage);
    diagnostics.push(...extracted.diagnostics);
    sourceSkills.push(...(extracted.sourceSkills ?? []));
  }

  return {
    activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
    source: input.source,
    sourceSnapshot: {
      capturedAt: input.read.capturedAt,
      sourceBytes: input.read.sourceBytes,
    },
    events,
    diagnostics,
    sourceMetadata: {
      scope: 'captured-source',
      skills: sourceSkills,
    },
    coverage: [
      ...baseCoverage(events),
      ...coverage,
      {
        dataClass: 'skills',
        status:
          input.source.runtime === 'claude-code' && sourceSkills.length > 0
            ? 'available'
            : 'not-recorded',
        captured: sourceSkills.length,
      },
    ],
  };
}
