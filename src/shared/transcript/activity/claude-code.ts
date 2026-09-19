import { claudeUserRecordProvenance } from '../runtimes.js';
import type { DetailedTranscriptRecord } from '../runtimes.js';
import {
  eventKey,
  isJsonObject,
  numberValue,
  outcomeFromStatus,
  recordLocator,
  stringValue,
} from './types.js';
import type {
  ActivityOutcome,
  ActivitySource,
  ExtractedActivityEvent,
  ExtractedRecordActivity,
} from './types.js';

function claudeResultOutcome(
  block: Record<string, unknown>,
  toolUseResult: unknown,
): ActivityOutcome {
  if (block.is_error === true) return 'error';
  if (block.is_error === false) return 'success';
  if (isJsonObject(toolUseResult)) {
    return outcomeFromStatus(toolUseResult.status);
  }
  return 'unknown';
}

function externalReference(toolUseResult: unknown) {
  if (!isJsonObject(toolUseResult)) return undefined;
  const path = stringValue(toolUseResult.persistedOutputPath);
  const size = numberValue(toolUseResult.persistedOutputSize);
  if (path === undefined && size === undefined) return undefined;
  return {
    kind: 'persisted-output' as const,
    availability: 'not-read' as const,
    ...(path === undefined ? {} : { path }),
    ...(size === undefined ? {} : { size }),
  };
}

function childReference(toolUseResult: unknown) {
  if (!isJsonObject(toolUseResult)) return undefined;
  const nativeId = stringValue(toolUseResult.agentId);
  if (!nativeId) return undefined;
  const nickname = stringValue(toolUseResult.description);
  const status = stringValue(toolUseResult.status);
  return {
    nativeId,
    ...(nickname === undefined ? {} : { nickname }),
    ...(status === undefined ? {} : { status }),
    trajectoryAvailability: 'not-read' as const,
  };
}

function selectedClaudeMetadata(record: Record<string, unknown>) {
  const message = isJsonObject(record.message) ? record.message : undefined;
  const model = message ? stringValue(message.model) : undefined;
  const effort = stringValue(record.effort);
  const perTurnEffort = stringValue(record.perTurnEffort);
  const timestamp = stringValue(record.timestamp);
  if (
    model === undefined &&
    effort === undefined &&
    perTurnEffort === undefined &&
    timestamp === undefined
  ) {
    return undefined;
  }
  return {
    ...(model === undefined ? {} : { model }),
    ...(effort === undefined ? {} : { effort }),
    ...(perTurnEffort === undefined ? {} : { perTurnEffort }),
    ...(timestamp === undefined ? {} : { timestamp }),
  };
}

function claudeSystemActivity(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
): ExtractedActivityEvent | undefined {
  const { record } = detailed;
  if (record.type !== 'system') return undefined;
  const subtype = stringValue(record.subtype);
  if (subtype === 'turn_duration') {
    const locator = recordLocator(detailed, '');
    const durationMs = numberValue(record.durationMs);
    const messageCount = numberValue(record.messageCount);
    const pendingBackgroundAgentCount = numberValue(
      record.pendingBackgroundAgentCount,
    );
    return {
      eventKey: eventKey(source, locator),
      kind: 'lifecycle',
      nativeType: subtype,
      locator,
      outcome: 'unknown',
      metadata: {
        ...(durationMs === undefined ? {} : { durationMs }),
        ...(messageCount === undefined ? {} : { messageCount }),
        ...(pendingBackgroundAgentCount === undefined
          ? {}
          : { pendingBackgroundAgentCount }),
      },
    };
  }
  if (subtype === 'compact_boundary') {
    const locator = recordLocator(detailed, '');
    const compactMetadata = isJsonObject(record.compactMetadata)
      ? record.compactMetadata
      : undefined;
    const trigger = compactMetadata
      ? stringValue(compactMetadata.trigger)
      : undefined;
    const durationMs = compactMetadata
      ? numberValue(compactMetadata.durationMs)
      : undefined;
    return {
      eventKey: eventKey(source, locator),
      kind: 'compaction',
      nativeType: subtype,
      locator,
      outcome: 'unknown',
      metadata: {
        ...(trigger === undefined ? {} : { trigger }),
        ...(durationMs === undefined ? {} : { durationMs }),
      },
    };
  }
  return undefined;
}

export function extractClaudeRecord(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
): ExtractedRecordActivity {
  const { record } = detailed;
  const events: ExtractedActivityEvent[] = [];
  const coverage: ExtractedRecordActivity['coverage'] = [];
  const message = isJsonObject(record.message) ? record.message : undefined;
  const content = message?.content;
  const provenance = claudeUserRecordProvenance(record);
  const systemActivity = claudeSystemActivity(source, detailed);

  if (systemActivity) events.push(systemActivity);

  if (record.type === 'assistant') {
    const metadata = selectedClaudeMetadata(record);
    if (metadata) {
      const locator = recordLocator(detailed, '/message');
      events.push({
        eventKey: eventKey(source, locator),
        kind: 'metadata',
        nativeType: 'assistant-metadata',
        locator,
        outcome: 'unknown',
        metadata,
      });
    }
  }

  if (Array.isArray(content)) {
    content.forEach((candidate, blockIndex) => {
      if (!isJsonObject(candidate)) return;
      const blockType = stringValue(candidate.type);
      const locator = recordLocator(detailed, `/message/content/${blockIndex}`);

      if (blockType === 'tool_use') {
        const nativeCallId = stringValue(candidate.id);
        const nativeName = stringValue(candidate.name);
        events.push({
          eventKey: eventKey(source, locator),
          kind: 'call',
          nativeType: blockType,
          locator,
          outcome: 'pending',
          ...(nativeCallId === undefined ? {} : { nativeCallId }),
          ...(nativeName === undefined ? {} : { nativeName }),
          ...(Object.hasOwn(candidate, 'input')
            ? { arguments: candidate.input }
            : {}),
        });
        return;
      }

      if (blockType === 'tool_result') {
        const nativeCallId = stringValue(candidate.tool_use_id);
        const persisted = externalReference(record.toolUseResult);
        const child = childReference(record.toolUseResult);
        const result = {
          ...(Object.hasOwn(candidate, 'content')
            ? { content: candidate.content }
            : {}),
          ...(Object.hasOwn(record, 'toolUseResult')
            ? { toolUseResult: record.toolUseResult }
            : {}),
        };
        events.push({
          eventKey: eventKey(source, locator),
          kind: 'result',
          nativeType: blockType,
          locator,
          outcome: claudeResultOutcome(candidate, record.toolUseResult),
          ...(nativeCallId === undefined ? {} : { nativeCallId }),
          result,
          ...(provenance === 'legacy-absent' ? {} : { origin: provenance }),
          ...(persisted === undefined ? {} : { externalReference: persisted }),
          ...(child === undefined ? {} : { childReference: child }),
        });
        if (persisted) {
          coverage.push({
            dataClass: 'persisted-output',
            status: 'not-read',
            captured: 1,
            locator,
          });
        }
        if (child) {
          coverage.push({
            dataClass: 'child-trajectory',
            status: 'not-read',
            captured: 1,
            locator,
          });
        }
        return;
      }

      if (blockType?.includes('tool')) {
        coverage.push({
          dataClass: 'record-activity',
          status: 'unsupported',
          captured: 0,
          locator,
        });
      }
    });
  }

  if (provenance === 'runtime-notification') {
    const locator = recordLocator(detailed, '/origin/kind');
    events.push({
      eventKey: eventKey(source, locator),
      kind: 'notification',
      nativeType: 'task-notification',
      locator,
      outcome: 'unknown',
      origin: provenance,
    });
  }

  return { events, coverage, diagnostics: [] };
}
