/**
 * session-classifier.mjs - transcript engagement and bootstrap filtering.
 *
 * The classifier deliberately separates "genuine user engagement" from raw
 * user-role records. Superconductor/Codex bootstrap records can be stored as
 * user messages, but they are not human-authored conversation turns.
 */

import type { DigestEntry, JsonObject, Runtime } from '../../core/runtimes.js';
import { readRecords, normalizeEntries } from '../../core/runtimes.js';
import type {
  EngagementCandidateFields,
  TranscriptClassification,
} from './types.js';

function textStart(text: unknown): string {
  return String(text ?? '').trimStart();
}

function isTitlePrompt(text: unknown): boolean {
  return textStart(text).startsWith(
    'Generate a concise tab title for this coding chat.\nRules:',
  );
}

function isHiddenBootstrapUserText(text: unknown): boolean {
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

function isSyntheticForEngagement(entry: DigestEntry): boolean {
  if (entry.role !== 'user') return false;
  return (
    entry.kind === 'command_message' ||
    entry.origin === 'automatic-control' ||
    isHiddenBootstrapUserText(entry.text)
  );
}

function publicBootstrapIndexes(indexes: Set<number>): number[] {
  return [...indexes].toSorted((a, b) => a - b);
}

function entriesByRecordIndex(
  entries: DigestEntry[],
): Map<number, DigestEntry[]> {
  const byRecord = new Map<number, DigestEntry[]>();
  for (const entry of entries) {
    const existing = byRecord.get(entry.recordIndex) ?? [];
    existing.push(entry);
    byRecord.set(entry.recordIndex, existing);
  }
  return byRecord;
}

function visibleConversationEntries(entries: DigestEntry[]): DigestEntry[] {
  return entries.filter(
    (entry) =>
      entry.kind === 'message' ||
      entry.kind === 'command_message' ||
      entry.kind === 'ask_user',
  );
}

/**
 * An ask-user answer the runtime attributes to the operator.
 *
 * Answering a structured prompt is real human engagement, so a session whose
 * only human input arrived that way must not classify as unengaged — that is
 * exactly the session an observer needs. Attribution is deliberately narrow:
 * the normalizers set `origin: 'human'` only where the runtime's record proves
 * a person answered. Codex calls that could auto-resolve on a timer produce
 * output indistinguishable from an operator's choice, so they are left
 * unattributed and do not count here.
 */
function isOperatorAskUserAnswer(entry: DigestEntry): boolean {
  return (
    entry.kind === 'ask_user' &&
    entry.role === 'user' &&
    entry.origin === 'human'
  );
}

/**
 * Classify transcript records for human engagement and bootstrap records.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {object[]} records
 * @returns {object}
 */
export function classifyTranscriptRecords(
  runtime: Runtime,
  records: JsonObject[],
): TranscriptClassification {
  const allEntries = normalizeEntries(runtime, records, {
    includeToolCalls: false,
    includeToolResults: false,
    includeCommandMessages: true,
  });
  const byRecord = entriesByRecordIndex(allEntries);
  const bootstrapRecordIndexes = new Set<number>();

  let genuineUserMessages = 0;
  let syntheticUserMessages = 0;
  let assistantMessages = 0;
  let realMessageCount = 0;
  let operatorAskUserAnswers = 0;
  let pendingTitleAssistant = false;

  for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
    const entries = visibleConversationEntries(byRecord.get(recordIndex) ?? []);
    if (entries.length === 0) continue;

    if (
      pendingTitleAssistant &&
      entries.every(
        (entry) => entry.role === 'assistant' && entry.kind === 'message',
      )
    ) {
      bootstrapRecordIndexes.add(recordIndex);
      pendingTitleAssistant = false;
      continue;
    }
    pendingTitleAssistant = false;

    const userEntries = entries.filter((entry) => entry.role === 'user');
    const hiddenBootstrapUserRecord =
      userEntries.length > 0 &&
      entries.every((entry) => entry.role === 'user') &&
      userEntries.every((entry) => isHiddenBootstrapUserText(entry.text));

    if (hiddenBootstrapUserRecord) {
      bootstrapRecordIndexes.add(recordIndex);
      syntheticUserMessages += userEntries.length;
      if (userEntries.some((entry) => isTitlePrompt(entry.text))) {
        pendingTitleAssistant = true;
      }
      continue;
    }

    for (const entry of entries) {
      if (entry.role === 'user') {
        if (isOperatorAskUserAnswer(entry)) {
          // Counted separately from free-form messages so the distinction
          // stays visible to ranking and diagnostics rather than silently
          // inflating the genuine-message count.
          operatorAskUserAnswers++;
          realMessageCount++;
          continue;
        }
        if (isSyntheticForEngagement(entry)) {
          syntheticUserMessages++;
          continue;
        }
        if (entry.kind === 'message') {
          genuineUserMessages++;
          realMessageCount++;
        }
      } else if (
        entry.role === 'assistant' &&
        (entry.kind === 'message' || entry.kind === 'ask_user')
      ) {
        // A question put to the operator is the assistant's half of the
        // exchange. Ranking compares `hasAssistantAndUser` before recency, so
        // omitting it would leave a prompt-only session engaged-but-outranked
        // by any older ordinary session.
        assistantMessages++;
        realMessageCount++;
      }
    }
  }

  const humanInputs = genuineUserMessages + operatorAskUserAnswers;
  const status = humanInputs > 0 ? 'engaged' : 'unengaged';
  return {
    status,
    engaged: status === 'engaged',
    recordCount: records.length,
    genuineUserMessages,
    operatorAskUserAnswers,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount,
    hasAssistantAndUser: humanInputs > 0 && assistantMessages > 0,
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
  runtime: Runtime,
  transcriptPath: string,
): Promise<TranscriptClassification> {
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
export function engagementCandidateFields(
  classification: TranscriptClassification,
): EngagementCandidateFields {
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
