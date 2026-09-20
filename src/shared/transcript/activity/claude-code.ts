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
  ActivitySkillEvidence,
  ActivitySource,
  ActivitySourceSkill,
  ExtractedActivityEvent,
  ExtractedRecordActivity,
} from './types.js';

function nonEmptyString(value: unknown): string | undefined {
  const text = stringValue(value)?.trim();
  return text ? text : undefined;
}

function claudeSkillEvidence(
  record: Record<string, unknown>,
  nativeName?: string,
  input?: unknown,
): ActivitySkillEvidence[] | undefined {
  const evidence: ActivitySkillEvidence[] = [];
  const attributed = nonEmptyString(record.attributionSkill);
  if (attributed) {
    evidence.push({ kind: 'native-attribution', name: attributed });
  }
  if (nativeName === 'Skill') {
    const structured = isJsonObject(input) ? input : undefined;
    const name = structured
      ? (nonEmptyString(structured.skill) ?? nonEmptyString(structured.name))
      : undefined;
    evidence.push({
      kind: 'native-invocation',
      ...(name === undefined ? {} : { name }),
    });
  }
  return evidence.length === 0 ? undefined : evidence;
}

function claudeSourceSkills(
  detailed: DetailedTranscriptRecord,
): ActivitySourceSkill[] {
  const { record } = detailed;
  if (record.type !== 'attachment' || !isJsonObject(record.attachment)) {
    return [];
  }
  const attachment = record.attachment;
  const type = stringValue(attachment.type);
  if (type === 'skill_listing' && Array.isArray(attachment.names)) {
    return attachment.names.flatMap((candidate, index) => {
      const name = nonEmptyString(candidate);
      return name
        ? [
            {
              scope: 'captured-source' as const,
              evidence: 'available' as const,
              name,
              locator: recordLocator(detailed, `/attachment/names/${index}`),
            },
          ]
        : [];
    });
  }
  if (type === 'invoked_skills' && Array.isArray(attachment.skills)) {
    return attachment.skills.flatMap((candidate, index) => {
      const name = isJsonObject(candidate)
        ? nonEmptyString(candidate.name)
        : undefined;
      return name
        ? [
            {
              scope: 'captured-source' as const,
              evidence: 'invoked' as const,
              name,
              locator: recordLocator(
                detailed,
                `/attachment/skills/${index}/name`,
              ),
            },
          ]
        : [];
    });
  }
  return [];
}

function claudeResultOutcome(block: Record<string, unknown>): ActivityOutcome {
  if (block.is_error === true) return 'error';
  if (block.is_error === false) return 'success';
  return 'unknown';
}

function topLevelResultOutcome(toolUseResult: unknown): ActivityOutcome {
  if (!isJsonObject(toolUseResult)) return 'unknown';
  if (toolUseResult.interrupted === true) return 'cancelled';
  return outcomeFromStatus(toolUseResult.status);
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

function topLevelToolUseResultActivity(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
  origin?: string,
): ExtractedRecordActivity {
  const { record } = detailed;
  if (!Object.hasOwn(record, 'toolUseResult')) {
    return { events: [], coverage: [], diagnostics: [] };
  }
  const toolUseResult = record.toolUseResult;
  const locator = recordLocator(detailed, '/toolUseResult');
  const persisted = externalReference(toolUseResult);
  const child = childReference(toolUseResult);
  const status = isJsonObject(toolUseResult)
    ? toolUseResult.interrupted === true
      ? 'interrupted'
      : stringValue(toolUseResult.status)
    : undefined;
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: 'item',
        nativeType: 'toolUseResult',
        locator,
        outcome: topLevelResultOutcome(toolUseResult),
        ...(status === undefined ? {} : { nativeStatus: status }),
        ...(origin === undefined ? {} : { origin }),
        result: toolUseResult,
        ...(persisted === undefined ? {} : { externalReference: persisted }),
        ...(child === undefined ? {} : { childReference: child }),
      },
    ],
    coverage: [
      ...(persisted
        ? [
            {
              dataClass: 'persisted-output' as const,
              status: 'not-read' as const,
              captured: 1,
              locator,
            },
          ]
        : []),
      ...(child
        ? [
            {
              dataClass: 'child-trajectory' as const,
              status: 'not-read' as const,
              captured: 1,
              locator,
            },
          ]
        : []),
    ],
    diagnostics: [],
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
  const sourceSkills = claudeSourceSkills(detailed);
  const sourceSkillNamesRecorded =
    record.type === 'attachment' &&
    isJsonObject(record.attachment) &&
    ((record.attachment.type === 'skill_listing' &&
      Array.isArray(record.attachment.names)) ||
      (record.attachment.type === 'invoked_skills' &&
        Array.isArray(record.attachment.skills)));

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
        ...(claudeSkillEvidence(record) === undefined
          ? {}
          : { skillEvidence: claudeSkillEvidence(record) }),
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
        const input = Object.hasOwn(candidate, 'input')
          ? candidate.input
          : undefined;
        const skillEvidence = claudeSkillEvidence(record, nativeName, input);
        events.push({
          eventKey: eventKey(source, locator),
          kind: 'call',
          nativeType: blockType,
          locator,
          outcome: 'pending',
          ...(nativeCallId === undefined ? {} : { nativeCallId }),
          ...(nativeName === undefined ? {} : { nativeName }),
          ...(input === undefined ? {} : { arguments: input }),
          ...(skillEvidence === undefined ? {} : { skillEvidence }),
        });
        return;
      }

      if (blockType === 'tool_result') {
        const nativeCallId = stringValue(candidate.tool_use_id);
        const result = Object.hasOwn(candidate, 'content')
          ? { content: candidate.content }
          : {};
        events.push({
          eventKey: eventKey(source, locator),
          kind: 'result',
          nativeType: blockType,
          locator,
          outcome: claudeResultOutcome(candidate),
          ...(nativeCallId === undefined ? {} : { nativeCallId }),
          result,
          ...(provenance === 'legacy-absent' ? {} : { origin: provenance }),
        });
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

  const topLevelResult = topLevelToolUseResultActivity(
    source,
    detailed,
    provenance === 'legacy-absent' ? undefined : provenance,
  );
  events.push(...topLevelResult.events);
  coverage.push(...topLevelResult.coverage);

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

  return {
    events,
    coverage,
    diagnostics: [],
    sourceSkills,
    ...(sourceSkillNamesRecorded ? { sourceSkillNamesRecorded: true } : {}),
  };
}
