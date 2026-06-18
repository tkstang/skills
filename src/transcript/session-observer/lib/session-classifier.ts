/**
 * session-classifier.mjs - transcript engagement and bootstrap filtering.
 *
 * The classifier deliberately separates "genuine user engagement" from raw
 * user-role records. Superconductor/Codex bootstrap records can be stored as
 * user messages, but they are not human-authored conversation turns.
 */

import { readRecords, normalizeEntries } from '../../core/runtimes.js';

function textStart(text: any): any {
  return String(text ?? '').trimStart();
}

function isTitlePrompt(text: any): any {
  return textStart(text).startsWith(
    'Generate a concise tab title for this coding chat.\nRules:',
  );
}

function isHiddenBootstrapUserText(text: any): any {
  const normalized = textStart(text);
  return (
    normalized.startsWith('# AGENTS.md instructions for ') ||
    normalized.startsWith('<environment_context>') ||
    normalized.startsWith('<skill>\n<name>') ||
    normalized.startsWith('<permissions instructions>') ||
    normalized.startsWith('<apps_instructions>') ||
    normalized.startsWith('<stoa-profile ') ||
    isTitlePrompt(normalized)
  );
}

function isSyntheticForEngagement(entry: any): any {
  if (entry.role !== 'user') return false;
  return (
    entry.kind === 'command_message' || isHiddenBootstrapUserText(entry.text)
  );
}

function publicBootstrapIndexes(indexes: any): any {
  return [...indexes].toSorted((a: any, b: any): any => a - b);
}

function entriesByRecordIndex(entries: any): any {
  const byRecord = new Map();
  for (const entry of entries) {
    const existing = byRecord.get(entry.recordIndex) ?? [];
    existing.push(entry);
    byRecord.set(entry.recordIndex, existing);
  }
  return byRecord;
}

function visibleConversationEntries(entries: any): any {
  return entries.filter(
    (entry: any): any =>
      entry.kind === 'message' || entry.kind === 'command_message',
  );
}

/**
 * Classify transcript records for human engagement and bootstrap records.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {object[]} records
 * @returns {object}
 */
export function classifyTranscriptRecords(runtime: any, records: any): any {
  const allEntries = normalizeEntries(runtime, records, {
    includeToolCalls: false,
    includeToolResults: false,
    includeCommandMessages: true,
  });
  const byRecord = entriesByRecordIndex(allEntries);
  const bootstrapRecordIndexes = new Set();

  let genuineUserMessages = 0;
  let syntheticUserMessages = 0;
  let assistantMessages = 0;
  let realMessageCount = 0;
  let pendingTitleAssistant = false;

  for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
    const entries = visibleConversationEntries(byRecord.get(recordIndex) ?? []);
    if (entries.length === 0) continue;

    if (
      pendingTitleAssistant &&
      entries.every(
        (entry: any): any =>
          entry.role === 'assistant' && entry.kind === 'message',
      )
    ) {
      bootstrapRecordIndexes.add(recordIndex);
      pendingTitleAssistant = false;
      continue;
    }
    pendingTitleAssistant = false;

    const userEntries = entries.filter(
      (entry: any): any => entry.role === 'user',
    );
    const hiddenBootstrapUserRecord =
      userEntries.length > 0 &&
      entries.every((entry: any): any => entry.role === 'user') &&
      userEntries.every((entry: any): any =>
        isHiddenBootstrapUserText(entry.text),
      );

    if (hiddenBootstrapUserRecord) {
      bootstrapRecordIndexes.add(recordIndex);
      syntheticUserMessages += userEntries.length;
      if (userEntries.some((entry: any): any => isTitlePrompt(entry.text))) {
        pendingTitleAssistant = true;
      }
      continue;
    }

    for (const entry of entries) {
      if (entry.role === 'user') {
        if (isSyntheticForEngagement(entry)) {
          syntheticUserMessages++;
          continue;
        }
        if (entry.kind === 'message') {
          genuineUserMessages++;
          realMessageCount++;
        }
      } else if (entry.role === 'assistant' && entry.kind === 'message') {
        assistantMessages++;
        realMessageCount++;
      }
    }
  }

  const status = genuineUserMessages > 0 ? 'engaged' : 'unengaged';
  return {
    status,
    engaged: status === 'engaged',
    recordCount: records.length,
    genuineUserMessages,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount,
    hasAssistantAndUser: genuineUserMessages > 0 && assistantMessages > 0,
    bootstrapRecordIndexes: publicBootstrapIndexes(bootstrapRecordIndexes),
    bootstrapRecordCount: bootstrapRecordIndexes.size,
  };
}

/**
 * Read and classify a transcript path.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {string} transcriptPath
 * @returns {Promise<object>}
 */
export async function classifyTranscript(
  runtime: any,
  transcriptPath: any,
): Promise<any> {
  const records = await readRecords(transcriptPath);
  return classifyTranscriptRecords(runtime, records);
}

/**
 * Candidate-safe summary fields. Keeps JSON output compact and avoids Set
 * serialization surprises.
 *
 * @param {object} classification
 * @returns {object}
 */
export function engagementCandidateFields(classification: any): any {
  return {
    engagement: classification,
    engagementStatus: classification.status,
    engaged: classification.engaged,
    recordCount: classification.recordCount,
    genuineUserMessages: classification.genuineUserMessages,
    assistantMessages: classification.assistantMessages,
    realMessageCount: classification.realMessageCount,
    hasAssistantAndUser: classification.hasAssistantAndUser,
    bootstrapRecordCount: classification.bootstrapRecordCount,
  };
}
