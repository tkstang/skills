import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
import type {
  ActivitySource,
  ActivityTokenUsageSample,
  ActivityUsageDiagnostic,
  ActivityUsageMetadata,
} from './types.js';
import {
  isJsonObject,
  numberValue,
  recordLocator,
  stringValue,
} from './types.js';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isJsonObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function signature(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function tokenFields(value: unknown): JsonObject | undefined {
  if (!isJsonObject(value)) return undefined;
  const entries: Array<[string, unknown]> = [];
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === 'number' &&
      Number.isFinite(item) &&
      /token/iu.test(key)
    ) {
      entries.push([key, item]);
      continue;
    }
    const nested = tokenFields(item);
    if (nested && Object.keys(nested).length > 0) entries.push([key, nested]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function claudeRecordSessionId(record: JsonObject): string | undefined {
  const message = isJsonObject(record.message) ? record.message : undefined;
  return (
    stringValue(record.sessionId) ??
    stringValue(record.session_id) ??
    stringValue(record.sessionID) ??
    (message ? stringValue(message.sessionId) : undefined) ??
    (message ? stringValue(message.session_id) : undefined)
  );
}

function claudeUsage(
  source: ActivitySource,
  records: readonly DetailedTranscriptRecord[],
): ActivityUsageMetadata {
  const samples: ActivityTokenUsageSample[] = [];
  const diagnostics: ActivityUsageDiagnostic[] = [];
  const byMessage = new Map<
    string,
    { signature: string; sample: ActivityTokenUsageSample }
  >();

  for (const detailed of records) {
    const { record } = detailed;
    if (record.type !== 'assistant' || !isJsonObject(record.message)) continue;
    const message = record.message;
    const tokens = tokenFields(message.usage);
    if (!tokens) continue;
    const locator = recordLocator(detailed, '/message/usage');
    const recordedSessionId = claudeRecordSessionId(record);
    if (
      recordedSessionId !== undefined &&
      recordedSessionId !== source.nativeSessionId
    ) {
      diagnostics.push({ code: 'USAGE_SESSION_MISMATCH', locator });
      continue;
    }
    const messageId = stringValue(message.id)?.trim() || undefined;
    const model = stringValue(message.model)?.trim() || undefined;
    const sample: ActivityTokenUsageSample = {
      semantics: 'claude-message',
      locator,
      tokens,
      ...(model === undefined ? {} : { model }),
      ...(messageId === undefined
        ? { uncertainty: 'missing-message-id' as const }
        : { messageId }),
    };
    if (messageId === undefined) {
      samples.push(sample);
      diagnostics.push({ code: 'USAGE_DEDUP_UNCERTAIN', locator });
      continue;
    }
    const key = `${source.nativeSessionId}:${messageId}`;
    const sampleSignature = signature({ tokens, model });
    const prior = byMessage.get(key);
    if (!prior) {
      byMessage.set(key, { signature: sampleSignature, sample });
      samples.push(sample);
      continue;
    }
    if (prior.signature !== sampleSignature) {
      diagnostics.push({ code: 'USAGE_CONFLICT', locator, messageId });
    }
  }

  return {
    scope: 'captured-source',
    availability: samples.length > 0 ? 'recorded' : 'not-recorded',
    samples,
    diagnostics,
  };
}

function codexUsage(
  source: ActivitySource,
  records: readonly DetailedTranscriptRecord[],
): ActivityUsageMetadata {
  const samples: ActivityTokenUsageSample[] = [];
  const diagnostics: ActivityUsageDiagnostic[] = [];
  const turnModels = new Map<string, string>();
  for (const { record } of records) {
    if (record.type !== 'turn_context' || !isJsonObject(record.payload))
      continue;
    const turnId = stringValue(record.payload.turn_id);
    const model = stringValue(record.payload.model);
    if (turnId && model) turnModels.set(turnId, model);
  }

  let previousSnapshot: string | undefined;
  let previousTotal: number | undefined;
  let segment = 0;
  const responses = new Map<string, string>();

  for (const detailed of records) {
    const { record } = detailed;
    const payload = isJsonObject(record.payload) ? record.payload : undefined;
    if (record.type === 'event_msg' && payload?.type === 'token_count') {
      const info = isJsonObject(payload.info) ? payload.info : undefined;
      if (!info) continue;
      const total = tokenFields(info.total_token_usage);
      const last = tokenFields(info.last_token_usage);
      if (!total && !last) continue;
      const snapshot = signature({ total, last });
      if (snapshot === previousSnapshot) continue;
      previousSnapshot = snapshot;
      const totalTokens = total ? numberValue(total.total_tokens) : undefined;
      if (
        totalTokens !== undefined &&
        previousTotal !== undefined &&
        totalTokens < previousTotal
      ) {
        segment += 1;
        diagnostics.push({
          code: 'USAGE_COUNTER_RESET',
          locator: recordLocator(detailed, '/payload/info/total_token_usage'),
        });
      }
      if (totalTokens !== undefined) previousTotal = totalTokens;
      if (total) {
        samples.push({
          semantics: 'codex-cumulative',
          locator: recordLocator(detailed, '/payload/info/total_token_usage'),
          tokens: total,
          segment,
        });
      }
      if (last) {
        samples.push({
          semantics: 'codex-last-turn',
          locator: recordLocator(detailed, '/payload/info/last_token_usage'),
          tokens: last,
          segment,
        });
      }
      continue;
    }

    if (record.type !== 'token_usage_record' || !payload) continue;
    const recordedSessionId = stringValue(payload.session_id);
    const locator = recordLocator(detailed, '/payload');
    if (
      recordedSessionId !== undefined &&
      recordedSessionId !== source.nativeSessionId
    ) {
      diagnostics.push({ code: 'USAGE_SESSION_MISMATCH', locator });
      continue;
    }
    const usage = tokenFields(payload.usage);
    const turnUsage = tokenFields(payload.turn_token_usage);
    const threadUsage = tokenFields(payload.thread_token_usage);
    if (!usage && !turnUsage && !threadUsage) continue;
    const tokens: JsonObject = {
      ...(usage === undefined ? {} : { usage }),
      ...(turnUsage === undefined ? {} : { turn_token_usage: turnUsage }),
      ...(threadUsage === undefined ? {} : { thread_token_usage: threadUsage }),
    };
    const responseId = stringValue(payload.response_id)?.trim() || undefined;
    const turnId = stringValue(payload.turn_id)?.trim() || undefined;
    const sampleSignature = signature(tokens);
    if (responseId !== undefined) {
      const prior = responses.get(responseId);
      if (prior === sampleSignature) continue;
      if (prior !== undefined) {
        diagnostics.push({ code: 'USAGE_CONFLICT', locator });
        continue;
      }
      responses.set(responseId, sampleSignature);
    }
    const model = turnId ? turnModels.get(turnId) : undefined;
    samples.push({
      semantics: 'codex-response',
      locator,
      tokens,
      ...(model === undefined ? {} : { model }),
      ...(turnId === undefined ? {} : { turnId }),
      ...(responseId === undefined ? {} : { responseId }),
    });
  }

  return {
    scope: 'captured-source',
    availability: samples.length > 0 ? 'recorded' : 'not-recorded',
    samples,
    diagnostics,
  };
}

export function extractUsageMetadata(
  source: ActivitySource,
  records: readonly DetailedTranscriptRecord[],
): ActivityUsageMetadata {
  return source.runtime === 'claude-code'
    ? claudeUsage(source, records)
    : codexUsage(source, records);
}

export function notRecordedUsage(): ActivityUsageMetadata {
  return {
    scope: 'captured-source',
    availability: 'not-recorded',
    samples: [],
    diagnostics: [],
  };
}
