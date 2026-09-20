import type { CursorTranscriptAnalysis } from './cursor-analysis.js';
import type {
  DetailedTranscriptRead,
  DetailedTranscriptRecord,
  JsonObject,
  Runtime,
} from './runtimes.js';

export type UnsuccessfulTerminalStatus =
  | 'api-error'
  | 'aborted-mid-stream'
  | 'truncated-after-output'
  | 'interrupted'
  | 'error'
  | 'aborted'
  | 'cancelled';

export interface TerminalRecordLocator {
  indexBase: 'zero-based-jsonl-record-index' | 'zero-based-jsonl-frame-index';
  physicalLine: number;
  jsonPointer: string;
  recordIndex?: number;
  frameIndex?: number;
}

export interface TerminalRetryEvidence {
  fragment: string;
  provenance: 'inferred-from-error-message';
  source: TerminalRecordLocator;
}

export interface UnsuccessfulTerminalEvent {
  type: 'terminal';
  runtime: Runtime;
  sessionId: string;
  nativeSessionId: string;
  nativeType:
    | 'task_complete'
    | 'turn_aborted'
    | 'assistant'
    | 'user-interruption'
    | 'turn_ended';
  status: UnsuccessfulTerminalStatus;
  source: TerminalRecordLocator;
  nativeErrorCode?: string | number;
  retryEvidence?: TerminalRetryEvidence;
}

export interface CodexLifecycleSignal {
  nativeType: 'task_started' | 'task_complete' | 'turn_aborted';
  outcome: 'pending' | 'success' | 'error' | 'cancelled';
  turnId?: string;
  nativeStatus?: string;
  errorInfo?: string;
  errorMessage?: string;
}

interface ExactTerminalSource {
  runtime: Exclude<Runtime, 'cursor'>;
  sessionId: string;
  nativeSessionId: string;
  read: DetailedTranscriptRead;
  fromIndex: number;
  nextIndex: number;
}

interface CursorTerminalSource {
  runtime: 'cursor';
  sessionId: string;
  nativeSessionId: string;
  analysis: CursorTranscriptAnalysis;
  fromIndex: number;
  nextIndex: number;
}

const MONTH_INDEX = new Map(
  [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ].map((month, index) => [month.toLowerCase(), index]),
);

const RETRY_SUFFIX =
  /try again at ((?:([A-Z][a-z]{2}) (\d{1,2})(st|nd|rd|th)?, (\d{4}) )?(\d{1,2}):(\d{2}) (AM|PM))\.$/iu;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function expectedOrdinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function validCalendarDate(
  month: string,
  dayText: string,
  ordinal: string | undefined,
  yearText: string,
): boolean {
  const monthIndex = MONTH_INDEX.get(month.toLowerCase());
  const day = Number(dayText);
  const year = Number(yearText);
  if (monthIndex === undefined || !Number.isInteger(day) || day < 1) {
    return false;
  }
  if (ordinal && ordinal.toLowerCase() !== expectedOrdinal(day)) return false;
  const date = new Date(Date.UTC(year, monthIndex, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === monthIndex &&
    date.getUTCDate() === day
  );
}

export function codexRetryEvidenceFragment(
  message: string,
): string | undefined {
  const match = RETRY_SUFFIX.exec(message);
  if (!match) return;
  const hour = Number(match[6]);
  const minute = Number(match[7]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return;
  if (
    match[2] !== undefined &&
    !validCalendarDate(match[2], match[3]!, match[4], match[5]!)
  ) {
    return;
  }
  return match[1];
}

export function decodeCodexLifecycleRecord(
  detailed: DetailedTranscriptRecord,
): CodexLifecycleSignal | null {
  const { record } = detailed;
  if (record.type !== 'event_msg' || !isJsonObject(record.payload)) return null;
  const payload = record.payload;
  const nativeType = stringValue(payload.type);
  if (
    nativeType !== 'task_started' &&
    nativeType !== 'task_complete' &&
    nativeType !== 'turn_aborted'
  ) {
    return null;
  }
  const error = isJsonObject(payload.error) ? payload.error : undefined;
  const outcome =
    nativeType === 'task_started'
      ? ('pending' as const)
      : nativeType === 'turn_aborted'
        ? ('cancelled' as const)
        : error
          ? ('error' as const)
          : ('success' as const);
  return {
    nativeType,
    outcome,
    ...(stringValue(payload.turn_id) === undefined
      ? {}
      : { turnId: stringValue(payload.turn_id) }),
    ...(stringValue(payload.status) === undefined
      ? {}
      : { nativeStatus: stringValue(payload.status) }),
    ...(error && stringValue(error.codex_error_info) !== undefined
      ? { errorInfo: stringValue(error.codex_error_info) }
      : {}),
    ...(error && stringValue(error.message) !== undefined
      ? { errorMessage: stringValue(error.message) }
      : {}),
  };
}

function recordLocator(
  detailed: DetailedTranscriptRecord,
  jsonPointer: string,
): TerminalRecordLocator {
  return {
    indexBase: 'zero-based-jsonl-record-index',
    recordIndex: detailed.recordIndex,
    physicalLine: detailed.physicalLine,
    jsonPointer,
  };
}

function codexTerminalEvent(
  source: ExactTerminalSource,
  detailed: DetailedTranscriptRecord,
): UnsuccessfulTerminalEvent | null {
  const lifecycle = decodeCodexLifecycleRecord(detailed);
  if (
    lifecycle === null ||
    (lifecycle.nativeType === 'task_complete' &&
      lifecycle.outcome !== 'error') ||
    lifecycle.nativeType === 'task_started'
  ) {
    return null;
  }
  const event: UnsuccessfulTerminalEvent = {
    type: 'terminal',
    runtime: 'codex',
    sessionId: source.sessionId,
    nativeSessionId: source.nativeSessionId,
    nativeType: lifecycle.nativeType,
    status: lifecycle.nativeType === 'turn_aborted' ? 'aborted' : 'error',
    source: recordLocator(detailed, '/payload'),
    ...(lifecycle.errorInfo === undefined
      ? {}
      : { nativeErrorCode: lifecycle.errorInfo }),
  };
  if (
    lifecycle.nativeType === 'task_complete' &&
    lifecycle.errorInfo === 'usage_limit_exceeded' &&
    lifecycle.errorMessage !== undefined
  ) {
    const fragment = codexRetryEvidenceFragment(lifecycle.errorMessage);
    if (fragment !== undefined) {
      event.retryEvidence = {
        fragment,
        provenance: 'inferred-from-error-message',
        source: recordLocator(detailed, '/payload/error/message'),
      };
    }
  }
  return event;
}

function claudeAssistantStatus(
  record: JsonObject,
): UnsuccessfulTerminalStatus | null {
  if (record.isApiErrorMessage === true) return 'api-error';
  if (record.isAbortedMidStream === true) return 'aborted-mid-stream';
  if (record.truncatedAfterOutput === true) return 'truncated-after-output';
  return null;
}

function claudeSessionId(record: JsonObject): string | undefined {
  return stringValue(record.sessionId);
}

function claudeTerminalEvents(
  source: ExactTerminalSource,
): UnsuccessfulTerminalEvent[] {
  const assistants = new Map<
    string,
    {
      detailed: DetailedTranscriptRecord;
      status: UnsuccessfulTerminalStatus | null;
    }
  >();
  for (const detailed of source.read.records) {
    const { record } = detailed;
    if (claudeSessionId(record) !== source.sessionId) continue;
    const message = isJsonObject(record.message) ? record.message : undefined;
    if (message?.role !== 'assistant') continue;
    const messageId = stringValue(message.id);
    if (!messageId) continue;
    assistants.set(messageId, {
      detailed,
      status: claudeAssistantStatus(record),
    });
  }

  return source.read.records.flatMap(
    (detailed): UnsuccessfulTerminalEvent[] => {
      if (
        detailed.recordIndex < source.fromIndex ||
        detailed.recordIndex >= source.nextIndex
      ) {
        return [];
      }
      const { record } = detailed;
      if (claudeSessionId(record) !== source.sessionId) return [];
      const message = isJsonObject(record.message) ? record.message : undefined;
      const status = claudeAssistantStatus(record);
      if (message?.role === 'assistant' && status !== null) {
        const apiErrorStatus = record.apiErrorStatus;
        return [
          {
            type: 'terminal' as const,
            runtime: 'claude-code' as const,
            sessionId: source.sessionId,
            nativeSessionId: source.nativeSessionId,
            nativeType: 'assistant' as const,
            status,
            source: recordLocator(detailed, ''),
            ...(status === 'api-error' &&
            typeof apiErrorStatus === 'number' &&
            Number.isFinite(apiErrorStatus)
              ? { nativeErrorCode: apiErrorStatus }
              : {}),
          },
        ];
      }

      if (message?.role !== 'user') return [];
      const interruptedMessageId = stringValue(record.interruptedMessageId);
      if (!interruptedMessageId) return [];
      const target = assistants.get(interruptedMessageId);
      if (!target || target.status === 'aborted-mid-stream') return [];
      return [
        {
          type: 'terminal' as const,
          runtime: 'claude-code' as const,
          sessionId: source.sessionId,
          nativeSessionId: source.nativeSessionId,
          nativeType: 'user-interruption' as const,
          status: 'interrupted' as const,
          source: recordLocator(detailed, '/interruptedMessageId'),
        },
      ];
    },
  );
}

export function extractRecordedTerminalEvents(
  source: ExactTerminalSource,
): UnsuccessfulTerminalEvent[] {
  if (source.runtime === 'claude-code') return claudeTerminalEvents(source);
  return source.read.records.flatMap((detailed) => {
    if (
      detailed.recordIndex < source.fromIndex ||
      detailed.recordIndex >= source.nextIndex
    ) {
      return [];
    }
    const event = codexTerminalEvent(source, detailed);
    return event ? [event] : [];
  });
}

export function extractCursorTerminalEvents(
  source: CursorTerminalSource,
): UnsuccessfulTerminalEvent[] {
  return source.analysis.turns.flatMap((turn) => {
    const frameIndex = turn.terminalFrameIndex;
    if (
      frameIndex === null ||
      frameIndex < source.fromIndex ||
      frameIndex >= source.nextIndex ||
      !['error', 'aborted', 'cancelled'].includes(turn.lifecycle)
    ) {
      return [];
    }
    return [
      {
        type: 'terminal' as const,
        runtime: 'cursor' as const,
        sessionId: source.sessionId,
        nativeSessionId: source.nativeSessionId,
        nativeType: 'turn_ended' as const,
        status: turn.lifecycle as 'error' | 'aborted' | 'cancelled',
        source: {
          indexBase: 'zero-based-jsonl-frame-index' as const,
          frameIndex,
          physicalLine: frameIndex + 1,
          jsonPointer: '/status',
        },
      },
    ];
  });
}
