/**
 * session-classifier.test.ts — Tests for
 * src/transcript/session-observer/lib/session-classifier.ts
 *
 * Focus: engagement classification for sessions whose only human input is an
 * answer to a structured ask-user prompt. Those sessions carry exactly the
 * decision an observer needs, so they must not classify as unengaged — but
 * attribution has to stay honest where a runtime can answer its own question.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../../src/transcript/core/runtimes.js';
import { readRecords } from '../../src/transcript/core/runtimes.js';
import { rank } from '../../src/transcript/session-observer/lib/rank.js';
import { classifyTranscriptRecords } from '../../src/transcript/session-observer/lib/session-classifier.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const TARGET_CWD = '/Users/test/project';

/**
 * Strip the opening free-form user message so the transcript's only human
 * input is the ask-user answer. Without this, an ordinary user message would
 * carry engagement on its own and hide the behavior under test.
 */
function withoutOpeningUserMessage(records: JsonObject[]): JsonObject[] {
  // Content shape varies by runtime (string, or an array of text blocks), so
  // match on role and take the first user record the fixture opens with.
  const index = records.findIndex((record) => {
    const message = (record.message ?? record.payload) as
      | JsonObject
      | undefined;
    return (message?.role ?? record.role) === 'user';
  });
  expect(index, 'fixture must open with a user message').toBeGreaterThan(-1);
  return records.filter((_, i) => i !== index);
}

describe('classifyTranscriptRecords — ask-user engagement', () => {
  test('claude-code: an ask-user answer alone counts as engagement', async () => {
    const records = await readRecords(
      join(FIXTURES, 'claude-code', 'ask-user-question.jsonl'),
    );
    const promptOnly = withoutOpeningUserMessage(records);
    const classification = classifyTranscriptRecords('claude-code', promptOnly);

    expect(classification.status).toBe('engaged');
    expect(classification.operatorAskUserAnswers).toBeGreaterThan(0);
    // Kept distinct: answering a prompt is not a free-form message.
    expect(classification.genuineUserMessages).toBe(0);
    expect(classification.hasAssistantAndUser).toBe(true);
  });

  test('codex: an ask-user answer alone counts as engagement', async () => {
    const records = await readRecords(
      join(FIXTURES, 'codex', 'request-user-input.jsonl'),
    );
    const promptOnly = withoutOpeningUserMessage(records);
    const classification = classifyTranscriptRecords('codex', promptOnly);

    expect(classification.status).toBe('engaged');
    expect(classification.operatorAskUserAnswers).toBeGreaterThan(0);
    expect(classification.genuineUserMessages).toBe(0);
  });

  test('codex: an auto-resolvable answer is not attributed to the operator', async () => {
    const records = await readRecords(
      join(FIXTURES, 'codex', 'request-user-input.jsonl'),
    );
    // The fixture's second call sets autoResolutionMs; keep only that exchange,
    // so the transcript's sole "answer" could have been the runtime's timer.
    const autoResolvedOnly = records.filter((record) => {
      const payload = (record.payload ?? {}) as JsonObject;
      const callId = payload.call_id;
      return (
        record.type === 'session_started' ||
        callId === 'call_ask_2' ||
        callId === 'call_exec_1'
      );
    });
    const classification = classifyTranscriptRecords('codex', autoResolvedOnly);

    expect(classification.operatorAskUserAnswers).toBe(0);
    expect(classification.status).toBe('unengaged');
  });

  test('cursor: a recorded question alone is not engagement', async () => {
    const records = await readRecords(
      join(FIXTURES, 'cursor', 'ask-question.jsonl'),
    );
    const promptOnly = withoutOpeningUserMessage(records);
    const classification = classifyTranscriptRecords('cursor', promptOnly);

    // Cursor never records the answer, so there is nothing to attribute — the
    // question by itself does not prove a person was there.
    expect(classification.operatorAskUserAnswers).toBe(0);
    expect(classification.status).toBe('unengaged');
  });

  test('ordinary sessions are unaffected by the ask-user signal', async () => {
    const records = await readRecords(
      join(FIXTURES, 'claude-code', 'typical.jsonl'),
    );
    const classification = classifyTranscriptRecords('claude-code', records);

    expect(classification.status).toBe('engaged');
    expect(classification.operatorAskUserAnswers).toBe(0);
    expect(classification.genuineUserMessages).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Classifier → ranking integration
//
// The classifier and the ranker have to agree. A rank test that hand-supplies
// candidate metrics can pass while the classifier never produces them, so
// these cases derive every metric from real classification output.
// ---------------------------------------------------------------------------

/** The minimum ask-user exchange: one question, one answer, no prose. */
const MINIMAL_ASK_USER_RECORDS: JsonObject[] = [
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'AskUserQuestion',
          input: {
            questions: [
              {
                question: 'Ship it?',
                header: 'Ship',
                options: [{ label: 'Ship' }, { label: 'Hold' }],
              },
            ],
          },
        },
      ],
    },
  },
  {
    type: 'user',
    message: {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'tu1', content: 'answered' },
      ],
    },
    toolUseResult: {
      questions: [{ question: 'Ship it?', header: 'Ship', options: [] }],
      answers: { 'Ship it?': 'Ship' },
      annotations: {},
    },
  },
];

/**
 * Build a rank() candidate whose every engagement field comes from real
 * classification output. Hand-supplying these is what let an earlier rank test
 * pass while the classifier produced different values.
 */
function candidateFrom(
  sessionId: string,
  classification: ReturnType<typeof classifyTranscriptRecords>,
  ageSec: number,
) {
  const now = Math.floor(Date.now() / 1000);
  return {
    runtime: 'claude-code' as const,
    transcriptPath: `/tmp/${sessionId}.jsonl`,
    sessionId,
    recordedCwd: TARGET_CWD,
    mtime: now - ageSec,
    size: 1000,
    ageSec,
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

describe('classifier metrics feed candidate ranking', () => {
  test('a minimal exchange yields both halves of hasAssistantAndUser', () => {
    const classification = classifyTranscriptRecords(
      'claude-code',
      MINIMAL_ASK_USER_RECORDS,
    );

    expect(classification.status).toBe('engaged');
    expect(classification.operatorAskUserAnswers).toBe(1);
    // The assistant's question is its half of the exchange. Ranking compares
    // hasAssistantAndUser before recency, so a false here would leave the
    // session engaged but outranked by any older ordinary session.
    expect(classification.assistantMessages).toBe(1);
    expect(classification.hasAssistantAndUser).toBe(true);
    // Still not counted as a free-form user message.
    expect(classification.genuineUserMessages).toBe(0);
  });

  test('a prompt-only session competes as an engaged candidate', async () => {
    // Before the fix a prompt-only session lost to *any* engaged session on
    // hasAssistantAndUser, whatever the message counts. It now competes on the
    // ordinary metrics: here it beats an older unengaged bootstrap session.
    //
    // Deliberately not asserted: that it beats a *richer* ordinary session.
    // Once both sides are engaged, ranking prefers realMessageCount and then
    // genuineUserMessages ahead of recency — long-standing policy that applies
    // to every sparse session, and reordering it for this feature would change
    // selection for everyone. The bug was being unselectable, not being ranked
    // below a session with more human conversation.
    const promptOnly = classifyTranscriptRecords(
      'claude-code',
      MINIMAL_ASK_USER_RECORDS,
    );
    const bootstrapOnly = classifyTranscriptRecords('claude-code', [
      {
        type: 'user',
        message: {
          role: 'user',
          content: '<environment_context><cwd>/x</cwd></environment_context>',
        },
      },
    ]);
    expect(bootstrapOnly.status).toBe('unengaged');

    const result: any = rank(
      [
        candidateFrom('sess-bootstrap-older', bootstrapOnly, 600),
        candidateFrom('sess-prompt-only-newer', promptOnly, 30),
      ],
      TARGET_CWD,
    );

    expect(result.winner?.sessionId).toBe('sess-prompt-only-newer');
  });

  test('a prompt-only session alone is selectable rather than unengagedOnly', () => {
    const classification = classifyTranscriptRecords(
      'claude-code',
      MINIMAL_ASK_USER_RECORDS,
    );
    const result: any = rank(
      [candidateFrom('sess-prompt-only', classification, 30)],
      TARGET_CWD,
    );

    expect(result.winner?.sessionId).toBe('sess-prompt-only');
    expect(result.unengagedOnly).toBeFalsy();
  });
});
