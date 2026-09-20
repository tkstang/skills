import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
import { decodeCodexLifecycleRecord } from '../terminal-events.js';
import { structuredSkillFileReadEvidence } from './skill-evidence.js';
import {
  eventKey,
  isJsonObject,
  numberValue,
  outcomeFromStatus,
  recordLocator,
  stringValue,
} from './types.js';
import type {
  ActivityDiagnostic,
  ActivityOutcome,
  ActivitySource,
  ExtractedRecordActivity,
} from './types.js';

const ITEM_ACTIVITY_TYPES = new Set([
  'CollabAgentToolCall',
  'CommandExecution',
  'FileChange',
  'McpToolCall',
  'SubAgentActivity',
  'WebSearch',
]);

const ITEM_NON_ACTIVITY_TYPES = new Set([
  'AgentMessage',
  'Extension',
  'ImageView',
  'Reasoning',
  'UserMessage',
]);

const CODEX_OUTPUT_CAPS: Readonly<Record<string, number>> = {
  stdout: 1_048_608,
  aggregated_output: 1_048_608,
  formatted_output: 40_109,
};

interface CodexCallArguments {
  fields: {
    arguments?: unknown;
    originalArguments?: unknown;
  };
  diagnostics: ActivityDiagnostic[];
}

function codexCallArguments(
  nativeType: 'function_call' | 'custom_tool_call',
  payload: JsonObject,
  locator: ReturnType<typeof recordLocator>,
): CodexCallArguments {
  const field = nativeType === 'function_call' ? 'arguments' : 'input';
  if (!Object.hasOwn(payload, field)) {
    return { fields: {}, diagnostics: [] };
  }

  const originalArguments = payload[field];
  if (nativeType !== 'function_call' || typeof originalArguments !== 'string') {
    return {
      fields: { arguments: originalArguments, originalArguments },
      diagnostics: [],
    };
  }

  try {
    const parsed: unknown = JSON.parse(originalArguments);
    if (!isJsonObject(parsed)) throw new Error('arguments are not an object');
    return {
      fields: { arguments: parsed, originalArguments },
      diagnostics: [],
    };
  } catch {
    return {
      fields: { originalArguments },
      diagnostics: [
        {
          code: 'ARGUMENT_PARSE_ERROR',
          locator,
          field,
        },
      ],
    };
  }
}

function codexItemOutcome(item: JsonObject): ActivityOutcome {
  const statusOutcome = outcomeFromStatus(item.status);
  if (statusOutcome !== 'unknown') return statusOutcome;
  const exitCode = numberValue(item.exit_code);
  if (exitCode === undefined) return 'unknown';
  return exitCode === 0 ? 'success' : 'error';
}

function selectedCompactionMetadata(payload: JsonObject): JsonObject {
  const fields = [
    'first_window_id',
    'previous_window_id',
    'window_id',
    'window_number',
  ] as const;
  return Object.fromEntries(
    fields.flatMap((field) =>
      Object.hasOwn(payload, field) ? [[field, payload[field]]] : [],
    ),
  );
}

function selectedSessionMetadata(payload: JsonObject): JsonObject {
  const cliVersion = stringValue(payload.cli_version);
  const modelProvider = stringValue(payload.model_provider);
  const nativeSessionId = stringValue(payload.id);
  const directParentMarkerPresent = Object.hasOwn(payload, 'parent_thread_id');
  const directParentThreadId = stringValue(payload.parent_thread_id);
  const source = isJsonObject(payload.source) ? payload.source : undefined;
  const subagent =
    source && isJsonObject(source.subagent) ? source.subagent : undefined;
  const threadSpawn =
    subagent && isJsonObject(subagent.thread_spawn)
      ? subagent.thread_spawn
      : undefined;
  const nestedParentThreadId = threadSpawn
    ? stringValue(threadSpawn.parent_thread_id)
    : undefined;
  const nestedParentMarkerPresent =
    threadSpawn !== undefined && Object.hasOwn(threadSpawn, 'parent_thread_id');
  const subagentMarkerPresent = subagent !== undefined;
  const subagentHistoryStartOrdinalPresent = Object.hasOwn(
    payload,
    'subagent_history_start_ordinal',
  );
  const subagentHistoryStartOrdinal = numberValue(
    payload.subagent_history_start_ordinal,
  );
  return {
    ...(cliVersion === undefined ? {} : { cliVersion }),
    ...(modelProvider === undefined ? {} : { modelProvider }),
    ...(nativeSessionId === undefined ? {} : { nativeSessionId }),
    ...(directParentThreadId === undefined ? {} : { directParentThreadId }),
    ...(nestedParentThreadId === undefined ? {} : { nestedParentThreadId }),
    ...(directParentMarkerPresent ? { directParentMarkerPresent: true } : {}),
    ...(nestedParentMarkerPresent ? { nestedParentMarkerPresent: true } : {}),
    ...(subagentMarkerPresent ? { subagentMarkerPresent: true } : {}),
    ...(subagentHistoryStartOrdinalPresent
      ? { subagentHistoryStartOrdinalPresent: true }
      : {}),
    ...(subagentHistoryStartOrdinal === undefined
      ? {}
      : { subagentHistoryStartOrdinal }),
  };
}

function selectedTurnMetadata(payload: JsonObject): JsonObject {
  const model = stringValue(payload.model);
  const effort = stringValue(payload.effort);
  return {
    ...(model === undefined ? {} : { model }),
    ...(effort === undefined ? {} : { effort }),
  };
}

function selectedLifecycleMetadata(payload: JsonObject): JsonObject {
  const fields = [
    'started_at',
    'completed_at',
    'duration_ms',
    'time_to_first_token_ms',
  ] as const;
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = numberValue(payload[field]);
      return value === undefined ? [] : [[field, value]];
    }),
  );
}

function codexLifecycleActivity(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
  payload: JsonObject,
): ExtractedRecordActivity | undefined {
  const lifecycle = decodeCodexLifecycleRecord(detailed);
  if (!lifecycle) return undefined;
  const { nativeType, outcome, turnId, nativeStatus, errorInfo } = lifecycle;
  const locator = recordLocator(detailed, '/payload');
  const metadata = selectedLifecycleMetadata(payload);
  if (errorInfo !== undefined) metadata.errorInfo = errorInfo;
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: 'lifecycle',
        nativeType,
        locator,
        outcome,
        ...(turnId === undefined ? {} : { turnId }),
        ...(nativeStatus === undefined ? {} : { nativeStatus }),
        ...(Object.keys(metadata).length === 0 ? {} : { metadata }),
      },
    ],
    coverage: [],
    diagnostics: [],
  };
}

function outputCapDiagnostics(
  detailed: DetailedTranscriptRecord,
  item: JsonObject,
  itemPointer: string,
): ActivityDiagnostic[] {
  return Object.entries(CODEX_OUTPUT_CAPS).flatMap(([field, cap]) => {
    const value = item[field];
    if (typeof value !== 'string') return [];
    const bytes = Buffer.byteLength(value, 'utf8');
    if (bytes !== cap) return [];
    return [
      {
        code: 'POSSIBLE_SOURCE_TRUNCATION' as const,
        locator: recordLocator(detailed, `${itemPointer}/${field}`),
        field,
        bytes,
      },
    ];
  });
}

function responseItemActivity(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
  payload: JsonObject,
): ExtractedRecordActivity {
  const nativeType = stringValue(payload.type);
  const locator = recordLocator(detailed, '/payload');
  if (nativeType === 'function_call' || nativeType === 'custom_tool_call') {
    const nativeCallId = stringValue(payload.call_id);
    const nativeId = stringValue(payload.id);
    const nativeName = stringValue(payload.name);
    const nativeStatus = stringValue(payload.status);
    const argumentEvidence = codexCallArguments(nativeType, payload, locator);
    const skillEvidence = structuredSkillFileReadEvidence(
      'codex',
      nativeName,
      argumentEvidence.fields.arguments,
    );
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'call',
          nativeType,
          locator,
          // custom_tool_call.status is a constant carrier value, not outcome.
          outcome: 'pending',
          ...(nativeId === undefined ? {} : { nativeId }),
          ...(nativeCallId === undefined ? {} : { nativeCallId }),
          ...(nativeName === undefined ? {} : { nativeName }),
          ...(nativeStatus === undefined ? {} : { nativeStatus }),
          ...(Object.hasOwn(payload, 'namespace')
            ? { metadata: { namespace: payload.namespace } }
            : {}),
          ...argumentEvidence.fields,
          ...(skillEvidence === undefined
            ? {}
            : { skillEvidence: [skillEvidence] }),
        },
      ],
      coverage: [],
      diagnostics: argumentEvidence.diagnostics,
    };
  }

  if (
    nativeType === 'function_call_output' ||
    nativeType === 'custom_tool_call_output'
  ) {
    const nativeCallId = stringValue(payload.call_id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'result',
          nativeType,
          locator,
          outcome: 'unknown',
          ...(nativeCallId === undefined ? {} : { nativeCallId }),
          ...(Object.hasOwn(payload, 'output')
            ? { result: payload.output }
            : {}),
        },
      ],
      coverage: [],
      diagnostics: [],
    };
  }

  if (nativeType === 'web_search_call') {
    const nativeId = stringValue(payload.id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'call',
          nativeType,
          locator,
          outcome: 'pending',
          nativeName: 'web_search',
          ...(nativeId === undefined ? {} : { nativeId }),
          ...(Object.hasOwn(payload, 'query')
            ? { arguments: payload.query }
            : {}),
        },
      ],
      coverage: [],
      diagnostics: [],
    };
  }

  if (nativeType === 'message' || nativeType === 'reasoning') {
    return { events: [], coverage: [], diagnostics: [] };
  }

  return {
    events: [],
    coverage: [
      {
        dataClass: 'record-activity',
        status: 'unsupported',
        captured: 0,
        locator,
      },
    ],
    diagnostics: [],
  };
}

function itemCompletedActivity(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
  payload: JsonObject,
): ExtractedRecordActivity {
  const item = isJsonObject(payload.item) ? payload.item : undefined;
  const locator = recordLocator(detailed, '/payload/item');
  if (!item) {
    return {
      events: [],
      coverage: [
        {
          dataClass: 'items',
          status: 'unsupported',
          captured: 0,
          locator,
        },
      ],
      diagnostics: [],
    };
  }

  const nativeType = stringValue(item.type);
  if (nativeType === 'ContextCompaction') {
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'compaction',
          nativeType,
          locator,
          outcome: 'unknown',
          metadata: selectedCompactionMetadata(item),
        },
      ],
      coverage: [],
      diagnostics: [],
    };
  }

  if (!nativeType || ITEM_NON_ACTIVITY_TYPES.has(nativeType)) {
    return { events: [], coverage: [], diagnostics: [] };
  }

  if (!ITEM_ACTIVITY_TYPES.has(nativeType)) {
    return {
      events: [],
      coverage: [
        {
          dataClass: 'items',
          status: 'unsupported',
          captured: 0,
          locator,
        },
      ],
      diagnostics: [],
    };
  }

  const nativeId = stringValue(item.id);
  const nativeCallId = stringValue(item.call_id);
  const nativeStatus = stringValue(item.status);
  const turnId = stringValue(payload.turn_id);
  const childNativeId = stringValue(item.agent_thread_id);
  const childNickname = stringValue(item.agent_nickname);
  const childReference = childNativeId
    ? {
        nativeId: childNativeId,
        ...(childNickname === undefined ? {} : { nickname: childNickname }),
        ...(nativeStatus === undefined ? {} : { status: nativeStatus }),
        trajectoryAvailability: 'not-read' as const,
      }
    : undefined;
  const coverage: ExtractedRecordActivity['coverage'] = childReference
    ? [
        {
          dataClass: 'child-trajectory',
          status: 'not-read',
          captured: 1,
          locator,
        },
      ]
    : [];
  const diagnostics = outputCapDiagnostics(detailed, item, '/payload/item');
  if (diagnostics.length > 0) {
    coverage.push(
      ...diagnostics.map((diagnostic) => ({
        dataClass: 'items' as const,
        status: 'truncated' as const,
        captured: 1,
        locator: diagnostic.locator,
      })),
    );
  }

  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: 'item',
        nativeType,
        locator,
        outcome: codexItemOutcome(item),
        ...(nativeId === undefined ? {} : { nativeId }),
        ...(nativeCallId === undefined ? {} : { nativeCallId }),
        ...(nativeStatus === undefined ? {} : { nativeStatus }),
        ...(turnId === undefined ? {} : { turnId }),
        nativeValue: item,
        ...(childReference === undefined ? {} : { childReference }),
      },
    ],
    coverage,
    diagnostics,
  };
}

export function extractCodexRecord(
  source: ActivitySource,
  detailed: DetailedTranscriptRecord,
): ExtractedRecordActivity {
  const { record } = detailed;
  const payload = isJsonObject(record.payload) ? record.payload : undefined;

  if (record.type === 'response_item' && payload) {
    return responseItemActivity(source, detailed, payload);
  }

  if (record.type === 'event_msg' && payload) {
    if (payload.type === 'item_completed') {
      return itemCompletedActivity(source, detailed, payload);
    }
    if (payload.type === 'web_search_call') {
      return responseItemActivity(source, detailed, payload);
    }
    const lifecycle = codexLifecycleActivity(source, detailed, payload);
    if (lifecycle) return lifecycle;
    return { events: [], coverage: [], diagnostics: [] };
  }

  if (record.type === 'session_meta' && payload) {
    const locator = recordLocator(detailed, '/payload');
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'metadata',
          nativeType: 'session_meta',
          locator,
          outcome: 'unknown',
          metadata: selectedSessionMetadata(payload),
        },
      ],
      coverage: [],
      diagnostics: [],
    };
  }

  if (record.type === 'turn_context' && payload) {
    const locator = recordLocator(detailed, '/payload');
    const turnId = stringValue(payload.turn_id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'metadata',
          nativeType: 'turn_context',
          locator,
          outcome: 'unknown',
          ...(turnId === undefined ? {} : { turnId }),
          metadata: selectedTurnMetadata(payload),
        },
      ],
      coverage: [],
      diagnostics: [],
    };
  }

  if (record.type === 'compacted' && payload) {
    const locator = recordLocator(detailed, '/payload');
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: 'compaction',
          nativeType: 'compacted',
          locator,
          outcome: 'unknown',
          metadata: selectedCompactionMetadata(payload),
        },
      ],
      coverage: [],
      diagnostics: [],
    };
  }

  return { events: [], coverage: [], diagnostics: [] };
}
