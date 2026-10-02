import { describe, expect, it } from 'vitest';

import { compileMatcher } from './matcher.js';
import { rankSessions, type RankSession } from './rank.js';
import type { Hit, Matcher, Runtime, SnippetRole, Tier } from './types.js';

const T0 = Date.parse('2026-09-20T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function session(
  sessionId: string,
  overrides: Partial<RankSession> = {},
): RankSession {
  return {
    runtime: 'claude-code',
    sessionId,
    archived: false,
    isSubagent: false,
    parentSessionId: null,
    cwd: '/work/other',
    title: null,
    firstPrompt: null,
    startedAt: null,
    lastActivityMs: T0,
    transcriptPath: `/store/${sessionId}.jsonl`,
    open: {
      command: `claude --resume ${sessionId}`,
      hint: 'run from /work/other',
    },
    ...overrides,
  };
}

function hit(
  matcher: Matcher,
  sessionId: string,
  text: string,
  overrides: {
    role?: SnippetRole;
    tier?: Tier;
    runtime?: Runtime;
    userTyped?: boolean;
    fromSubagent?: boolean;
    parentSessionId?: string | null;
  } = {},
): Hit {
  const match = matcher.match(text);
  if (!match) throw new Error(`test hit text does not match: ${text}`);
  const role = overrides.role ?? 'assistant';
  return {
    runtime: overrides.runtime ?? 'claude-code',
    sessionId,
    tier: overrides.tier ?? 'content',
    role,
    userTyped: overrides.userTyped ?? role === 'user',
    patterns: match.patterns,
    text,
    firstIndex: match.firstIndex,
    firstLength: match.firstLength,
    transcriptPath: `/store/${sessionId}.jsonl`,
    cwd: null,
    timestampMs: T0,
    ...(overrides.fromSubagent ? { fromSubagent: true } : {}),
    ...(overrides.parentSessionId !== undefined
      ? { parentSessionId: overrides.parentSessionId }
      : {}),
  };
}

const order = (results: { sessionId: string }[]) =>
  results.map((result) => result.sessionId);

describe('rankSessions scoring', () => {
  it('ranks a user-typed hit above an assistant-only hit with equal patterns', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [
        hit(m, 'typed', 'about zebra', { role: 'user' }),
        hit(m, 'said', 'zebra reply'),
      ],
      [session('typed'), session('said', { lastActivityMs: T0 + HOUR })],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(order(results)).toEqual(['typed', 'said']);
  });

  it('ranks more distinct patterns above more raw hits', () => {
    const m = compileMatcher(['zebra', 'okapi'], { literal: true });
    const results = rankSessions(
      [
        hit(m, 'both', 'zebra'),
        hit(m, 'both', 'okapi'),
        ...Array.from({ length: 5 }, (_, i) => hit(m, 'many', `zebra ${i}`)),
      ],
      [session('both'), session('many', { lastActivityMs: T0 + HOUR })],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(order(results)).toEqual(['both', 'many']);
    expect(results[0].matchedPatterns).toEqual(['zebra', 'okapi']);
    expect(results[1].matchedPatterns).toEqual(['zebra']);
  });

  it('boosts a title hit', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [
        hit(m, 'titled', 'Zebra planning', { role: 'title', tier: 'meta' }),
        hit(m, 'plain', 'zebra mention'),
      ],
      [session('titled'), session('plain', { lastActivityMs: T0 + HOUR })],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(order(results)).toEqual(['titled', 'plain']);
    expect(results[0].matchedTiers).toEqual(['meta']);
  });

  it('boosts a session inside a cwd hint', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [hit(m, 'here', 'zebra'), hit(m, 'there', 'zebra')],
      [
        session('here', { cwd: '/work/repo/pkg' }),
        session('there', { lastActivityMs: T0 + HOUR }),
      ],
      { matcher: m, cwdHints: ['/work/repo'], limit: 10 },
    );
    expect(order(results)).toEqual(['here', 'there']);
  });

  it('breaks otherwise equal sessions by recency', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [hit(m, 'older', 'zebra'), hit(m, 'newer', 'zebra')],
      [session('older'), session('newer', { lastActivityMs: T0 + HOUR })],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(order(results)).toEqual(['newer', 'older']);
    expect(results.map((result) => result.rank)).toEqual([1, 2]);
  });

  it('applies the limit after ordering', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      ['a', 'b', 'c'].map((id) => hit(m, id, 'zebra')),
      ['a', 'b', 'c'].map((id, i) =>
        session(id, { lastActivityMs: T0 + i * HOUR }),
      ),
      { matcher: m, cwdHints: [], limit: 2 },
    );
    expect(order(results)).toEqual(['c', 'b']);
  });
});

describe('rankSessions subagents', () => {
  it('rolls subagent hits up to a known parent at half weight', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [
        hit(m, 'agent-a1', 'zebra from the helper', {
          fromSubagent: true,
          parentSessionId: 'parent',
        }),
        hit(m, 'other', 'zebra direct'),
      ],
      [
        session('parent', { lastActivityMs: T0 + HOUR }),
        session('agent-a1', { isSubagent: true, parentSessionId: 'parent' }),
        session('other'),
      ],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(order(results)).toEqual(['other', 'parent']);
    const parent = results[1];
    expect(parent.isSubagent).toBe(false);
    expect(parent.snippets).toEqual([
      {
        role: 'assistant',
        tier: 'content',
        text: 'zebra from the helper',
        via: 'subagent',
      },
    ]);
  });

  it('lists an orphan subagent on its own', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [
        hit(m, 'agent-b2', 'zebra', {
          fromSubagent: true,
          parentSessionId: 'gone',
        }),
      ],
      [session('agent-b2', { isSubagent: true, parentSessionId: 'gone' })],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      sessionId: 'agent-b2',
      isSubagent: true,
    });
    expect(results[0].snippets[0].via).toBeUndefined();
  });
});

describe('rankSessions output', () => {
  it('emits a scanner-built snippet as-is without re-windowing', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const prebuilt = `…${'w '.repeat(60)}zebra ${'v '.repeat(40)}…`;
    const results = rankSessions(
      [{ ...hit(m, 's', 'zebra'), text: '', snippet: prebuilt }],
      [session('s')],
      { matcher: m, cwdHints: [], limit: 10 },
    );

    expect(results[0].snippets.map((snippet) => snippet.text)).toEqual([
      prebuilt,
    ]);
  });

  it('redacts snippets, titles, and first prompts', () => {
    // Built by concatenation so secret scanners do not flag the fixture.
    const secret = ['gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join(
      '',
    );
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [hit(m, 's', `token ${secret} then zebra notes`, { role: 'user' })],
      [
        session('s', {
          title: `Zebra rollout with ${secret}`,
          firstPrompt: `deploy with password=hunter2-synthetic and ${'x '.repeat(200)}`,
        }),
      ],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    const [result] = results;
    const emitted = JSON.stringify(result);
    expect(emitted).not.toContain(secret);
    expect(emitted).not.toContain('hunter2-synthetic');
    expect(result.snippets[0].text).toContain('zebra');
    expect(result.snippets[0].text).toContain('[REDACTED]');
    expect(result.title).toBe('Zebra rollout with [REDACTED]');
    expect(
      result.firstPrompt?.startsWith('deploy with password=[REDACTED]'),
    ).toBe(true);
    expect(result.firstPrompt?.length).toBeLessThanOrEqual(160);
  });

  it('caps snippets at three, preferring user over assistant over tool', () => {
    const m = compileMatcher(['zebra'], { literal: true });
    const results = rankSessions(
      [
        hit(m, 's', 'zebra tool output', { role: 'tool', tier: 'deep' }),
        hit(m, 's', 'zebra answer'),
        hit(m, 's', 'zebra context', { role: 'context' }),
        hit(m, 's', 'zebra question', { role: 'user' }),
      ],
      [session('s')],
      { matcher: m, cwdHints: [], limit: 10 },
    );
    expect(results[0].snippets.map((snippet) => snippet.role)).toEqual([
      'user',
      'assistant',
      'context',
    ]);
    expect(results[0].matchedTiers).toEqual(['content', 'deep']);
  });

  it('is deterministic across input orderings', () => {
    const m = compileMatcher(['zebra', 'okapi'], { literal: true });
    const hits = [
      hit(m, 'a', 'zebra', { role: 'user' }),
      hit(m, 'a', 'okapi'),
      hit(m, 'b', 'zebra okapi', { tier: 'history', role: 'user' }),
      hit(m, 'c', 'okapi'),
      hit(m, 'agent-x', 'zebra', { fromSubagent: true, parentSessionId: 'c' }),
      hit(m, 'ghost', 'zebra history', { tier: 'history', role: 'user' }),
    ];
    const sessions = [
      session('a'),
      session('b', { lastActivityMs: T0 + HOUR }),
      session('c', { lastActivityMs: T0 + 2 * HOUR }),
      session('agent-x', { isSubagent: true, parentSessionId: 'c' }),
    ];
    const options = { matcher: m, cwdHints: [], limit: 10 };

    const forward = rankSessions(hits, sessions, options);
    const backward = rankSessions(
      hits.toReversed(),
      sessions.toReversed(),
      options,
    );

    expect(backward).toEqual(forward);
    expect(order(forward)).toContain('ghost');
  });
});
