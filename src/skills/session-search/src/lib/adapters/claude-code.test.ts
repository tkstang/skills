import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  adapterContext,
  claudeAssistant,
  claudeTitle,
  claudeToolResult,
  claudeToolUse,
  claudeUser,
  makeTempHome,
  writeClaudeHistory,
  writeClaudeSession,
  type ClaudeEnvelope,
  type TempHome,
} from '../../helpers/test-helpers.js';
import { compileMatcher } from '../matcher.js';
import type { JsonObject } from '../types.js';
import {
  claudeSlugMatchesCwd,
  classifyClaudeRecord,
  createClaudeCodeAdapter,
} from './claude-code.js';

let temp: TempHome;

beforeEach(() => {
  temp = makeTempHome('session-search-claude-');
});

afterEach(() => {
  temp.cleanup();
});

const env: ClaudeEnvelope = { sessionId: 'sid', cwd: '/work/repo' };
const record = (value: unknown) => value as JsonObject;

describe('Claude Code enumeration', () => {
  it('lists parents and agent-* subagents but not workflow journals', async () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [claudeUser(e, 'hello')],
      subagents: [
        {
          agentId: 'a1111111111111111',
          records: (e) => [claudeUser(e, 'task')],
        },
        {
          agentId: 'a2222222222222222',
          workflow: 'build',
          records: (e) => [claudeUser(e, 'workflow task')],
        },
      ],
      journal: ['decoy journal text'],
    });
    const adapter = createClaudeCodeAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const files = await adapter.enumerate(ctx);
    const byPath = new Map(files.map((file) => [file.path, file]));

    expect(files).toHaveLength(3);
    expect(byPath.get(session.path)).toMatchObject({
      sessionId: session.sessionId,
      isSubagent: false,
      parentSessionId: null,
      projectSlug: session.slug,
    });
    for (const agentPath of session.subagentPaths) {
      expect(byPath.get(agentPath)).toMatchObject({
        sessionId: path.basename(agentPath, '.jsonl'),
        isSubagent: true,
        parentSessionId: session.sessionId,
      });
    }
    expect(byPath.has(session.journalPath ?? '')).toBe(false);
  });

  it('reports a missing store root as absent', async () => {
    const adapter = createClaudeCodeAdapter();
    const roots = adapter.roots(temp.home);
    expect(roots.exists).toBe(false);
    expect(roots.paths.history).toBeNull();
    const { ctx } = adapterContext(adapter, temp);
    expect(await adapter.enumerate(ctx)).toEqual([]);
    expect(
      await adapter.historyHits(ctx, compileMatcher(['x'], { literal: false })),
    ).toEqual([]);
  });

  it('matches cwd hints against equal and descendant project slugs', () => {
    expect(claudeSlugMatchesCwd('-work-repo', '/work/repo')).toBe(true);
    expect(claudeSlugMatchesCwd('-work-repo-pkg', '/work/repo')).toBe(true);
    expect(claudeSlugMatchesCwd('-work-other', '/work/repo')).toBe(false);
    expect(claudeSlugMatchesCwd('-Users-me--dotted', '/Users/me/.dotted')).toBe(
      true,
    );
  });
});

describe('Claude Code history tier', () => {
  it('turns matching history prompts into user-typed history hits', async () => {
    writeClaudeHistory(temp.home, [
      {
        display: 'vet the Perceive Now idea',
        project: '/work/repo',
        sessionId: 's1',
        timestamp: 1_790_000_000_000,
      },
      {
        display: 'unrelated prompt',
        project: '/work/other',
        sessionId: 's2',
        timestamp: 1_790_000_100_000,
      },
    ]);
    const adapter = createClaudeCodeAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const hits = await adapter.historyHits(
      ctx,
      compileMatcher(['perceive ?now'], { literal: false }),
    );

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      runtime: 'claude-code',
      sessionId: 's1',
      tier: 'history',
      role: 'user',
      userTyped: true,
      cwd: '/work/repo',
      timestampMs: 1_790_000_000_000,
      patterns: ['perceive ?now'],
    });
  });
});

describe('Claude Code titles', () => {
  it('prefers the latest custom title over any generated title', async () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeTitle('ai-title', e.sessionId, 'First generated'),
        claudeUser(e, 'hello'),
        claudeTitle('custom-title', e.sessionId, 'Old custom'),
        claudeTitle('custom-title', e.sessionId, 'Renamed by user'),
        claudeTitle('ai-title', e.sessionId, 'Later generated'),
      ],
    });
    const adapter = createClaudeCodeAdapter();
    expect(await adapter.titleFor(session.path)).toBe('Renamed by user');
  });

  it('uses the latest generated title when no custom title exists', async () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeTitle('ai-title', e.sessionId, 'Early title'),
        claudeAssistant(e, 'working'),
        claudeTitle('ai-title', e.sessionId, 'Newest title'),
      ],
    });
    const adapter = createClaudeCodeAdapter();
    const { ctx } = adapterContext(adapter, temp);
    const files = await adapter.enumerate(ctx);
    ctx.files = files;

    const hits = await adapter.metadataHits(
      ctx,
      compileMatcher(['title'], { literal: false }),
    );

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      sessionId: session.sessionId,
      tier: 'meta',
      role: 'title',
      userTyped: false,
      text: 'Newest title',
    });
  });

  it('falls back to a prefix read when the tail window holds no title', async () => {
    const filler = 'y'.repeat(4000);
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeTitle('ai-title', e.sessionId, 'Title near the start'),
        ...Array.from({ length: 120 }, () => claudeAssistant(e, filler)),
      ],
    });
    const adapter = createClaudeCodeAdapter();
    expect(await adapter.titleFor(session.path)).toBe('Title near the start');
  });
});

describe('Claude Code record classification', () => {
  it('maps typed, assistant, notification, and injected text to roles', () => {
    expect(
      classifyClaudeRecord(record(claudeUser(env, 'typed by me')), false),
    ).toEqual([{ role: 'user', text: 'typed by me' }]);
    expect(
      classifyClaudeRecord(record(claudeAssistant(env, 'answer')), false),
    ).toEqual([{ role: 'assistant', text: 'answer' }]);
    expect(
      classifyClaudeRecord(
        record(
          claudeUser(env, 'agent finished', {
            origin: { kind: 'task-notification' },
          }),
        ),
        false,
      ),
    ).toEqual([{ role: 'context', text: 'agent finished' }]);
    expect(
      classifyClaudeRecord(
        record(
          claudeUser(env, 'Summary of the earlier conversation', {
            isCompactSummary: true,
          }),
        ),
        false,
      ),
    ).toEqual([
      { role: 'context', text: 'Summary of the earlier conversation' },
    ]);
  });

  it('demotes injected user text through the shared hidden-payload matchers', () => {
    const injected = [
      '<system-reminder>remember the rules</system-reminder>',
      '<environment_context>cwd</environment_context>',
      '# AGENTS.md instructions for /work/repo',
      '<user_instructions>be terse</user_instructions>',
    ];
    for (const text of injected) {
      expect(
        classifyClaudeRecord(record(claudeUser(env, text)), false),
      ).toEqual([{ role: 'context', text }]);
    }
  });

  it('labels a tool_result carrying the phrase as tool, never user-typed', () => {
    const result = record(
      claudeToolResult(env, 'toolu_1', 'output mentions Perceive Now here'),
    );
    const matcher = compileMatcher(['perceive now'], { literal: false });

    const units = classifyClaudeRecord(result, true);
    expect(units).toEqual([
      { role: 'tool', text: 'output mentions Perceive Now here' },
    ]);
    expect(classifyClaudeRecord(result, false)).toEqual([]);
    expect(
      units.some((unit) => unit.role === 'user' && matcher.match(unit.text)),
    ).toBe(false);
  });

  it('finds a tool_result phrase past character 600 only with includeTools', () => {
    const long = `${'filler text '.repeat(60)}needle phrase at the end`;
    expect(long.indexOf('needle')).toBeGreaterThan(600);
    const matcher = compileMatcher(['needle phrase'], { literal: true });
    const blocks = record(
      claudeToolResult(env, 'toolu_2', [{ type: 'text', text: long }]),
    );

    const withTools = classifyClaudeRecord(blocks, true);
    expect(withTools.filter((unit) => matcher.match(unit.text))).toEqual([
      { role: 'tool', text: long },
    ]);
    expect(
      classifyClaudeRecord(blocks, false).some((unit) =>
        matcher.match(unit.text),
      ),
    ).toBe(false);
  });

  it('emits full-length tool_use input only with includeTools', () => {
    const command = `${'echo step && '.repeat(30)}run-the-zebra-script`;
    const use = record(claudeToolUse(env, 'toolu_3', 'Bash', { command }));
    const matcher = compileMatcher(['zebra-script'], { literal: true });

    const units = classifyClaudeRecord(use, true);
    expect(units).toHaveLength(1);
    expect(units[0].role).toBe('tool');
    expect(matcher.match(units[0].text)).not.toBeNull();
    expect(classifyClaudeRecord(use, false)).toEqual([]);
  });
});

describe('Claude Code session info and open hint', () => {
  it('reads cwd, start, first typed prompt, and title with a bounded read', async () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeUser(e, '<system-reminder>injected</system-reminder>'),
        claudeUser(
          { ...e, timestamp: '2026-09-20T10:05:00.000Z' },
          'first real prompt',
        ),
        claudeTitle('ai-title', e.sessionId, 'Session title'),
      ],
    });
    const adapter = createClaudeCodeAdapter();
    const { ctx } = adapterContext(adapter, temp);
    const [file] = await adapter.enumerate(ctx);

    const info = await adapter.sessionInfo(file);
    expect(info).toEqual({
      cwd: '/work/repo',
      title: 'Session title',
      firstPrompt: 'first real prompt',
      startedAt: '2026-09-20T10:00:00.000Z',
    });
    expect(adapter.openHint(session.sessionId, info, session.path)).toEqual({
      command: `claude --resume ${session.sessionId}`,
      hint: 'run from /work/repo',
    });
  });
});
