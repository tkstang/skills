import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  adapterContext,
  cursorAssistant,
  cursorToolUse,
  cursorTurnEnded,
  cursorUser,
  makeTempHome,
  writeCursorTranscript,
  type TempHome,
} from '../../helpers/test-helpers.js';
import { compileMatcher } from '../matcher.js';
import type { JsonObject } from '../types.js';
import {
  classifyCursorRecord,
  createCursorAdapter,
  cursorSlugMatchesCwd,
} from './cursor.js';

let temp: TempHome;

beforeEach(() => {
  temp = makeTempHome('session-search-cursor-');
});

afterEach(() => {
  temp.cleanup();
});

const record = (value: unknown) => value as JsonObject;

describe('Cursor enumeration', () => {
  it('lists transcripts and their subagent children', async () => {
    const written = writeCursorTranscript(temp.home, {
      cwd: '/work/repo',
      records: [cursorUser('hello'), cursorTurnEnded()],
      subagents: [{ id: 'child-1', records: [cursorUser('task')] }],
    });
    const adapter = createCursorAdapter();
    const { ctx } = adapterContext(adapter, temp);

    const files = await adapter.enumerate(ctx);

    expect(files).toEqual([
      expect.objectContaining({
        path: written.path,
        sessionId: written.id,
        isSubagent: false,
        parentSessionId: null,
        projectSlug: 'work-repo',
      }),
      expect.objectContaining({
        path: written.subagentPaths[0],
        sessionId: 'child-1',
        isSubagent: true,
        parentSessionId: written.id,
      }),
    ]);
    expect(
      await adapter.historyHits(ctx, compileMatcher(['x'], { literal: false })),
    ).toEqual([]);
    expect(
      await adapter.metadataHits(
        ctx,
        compileMatcher(['x'], { literal: false }),
      ),
    ).toEqual([]);
  });

  it('reports a missing store root as absent', async () => {
    const adapter = createCursorAdapter();
    const { ctx } = adapterContext(adapter, temp);
    expect(ctx.roots.exists).toBe(false);
    expect(await adapter.enumerate(ctx)).toEqual([]);
  });

  it('matches cwd hints against equal and descendant project slugs', () => {
    expect(
      cursorSlugMatchesCwd('Users-me-code-repo', '/Users/me/code/repo'),
    ).toBe(true);
    expect(
      cursorSlugMatchesCwd('Users-me-code-repo-pkg', '/Users/me/code/repo'),
    ).toBe(true);
    expect(
      cursorSlugMatchesCwd('Users-me-code-other', '/Users/me/code/repo'),
    ).toBe(false);
    expect(
      cursorSlugMatchesCwd('Users-me-dotted-dir', '/Users/me/.dotted/dir'),
    ).toBe(true);
  });
});

describe('Cursor record classification', () => {
  it('matches user and assistant text in an open trailing turn', () => {
    const records = [
      cursorUser('first question'),
      cursorAssistant('first answer'),
      cursorTurnEnded(),
      cursorUser('what about perceive now'),
      cursorAssistant('perceive now looks promising'),
    ].map(record);
    const matcher = compileMatcher(['perceive now'], { literal: true });

    const units = records.flatMap((frame) =>
      classifyCursorRecord(frame, false),
    );
    const matched = units.filter((unit) => matcher.match(unit.text));

    expect(matched.map((unit) => unit.role)).toEqual(['user', 'assistant']);
    expect(classifyCursorRecord(record(cursorTurnEnded()), true)).toEqual([]);
  });

  it('emits tool_use blocks only with includeTools', () => {
    const shell = record(
      cursorToolUse('Shell', { command: 'grep -r zebra-marker .' }),
    );
    const matcher = compileMatcher(['zebra-marker'], { literal: true });

    const withTools = classifyCursorRecord(shell, true);
    expect(withTools).toHaveLength(1);
    expect(withTools[0].role).toBe('tool');
    expect(matcher.match(withTools[0].text)).not.toBeNull();
    expect(classifyCursorRecord(shell, false)).toEqual([]);
  });

  it('demotes injected user text and keeps ask-user questions as conversation', () => {
    const injected = record({
      role: 'user',
      message: {
        content: [
          { type: 'text', text: '<system-reminder>rules</system-reminder>' },
        ],
      },
    });
    expect(classifyCursorRecord(injected, false)).toEqual([
      { role: 'context', text: '<system-reminder>rules</system-reminder>' },
    ]);
    const ask = record(
      cursorToolUse('AskQuestion', {
        questions: [
          { id: 'q1', prompt: 'Which zebra?', options: [{ label: 'striped' }] },
        ],
      }),
    );
    const units = classifyCursorRecord(ask, false);
    expect(units).toHaveLength(1);
    expect(units[0].role).toBe('assistant');
    expect(units[0].text).toContain('Which zebra?');
  });
});

describe('Cursor session info and open hint', () => {
  it('reads the first prompt without the user_query wrapper', async () => {
    const written = writeCursorTranscript(temp.home, {
      cwd: '/work/repo',
      records: [
        cursorUser('find the zebra bug'),
        cursorAssistant('ok'),
        cursorTurnEnded(),
      ],
    });
    const adapter = createCursorAdapter();
    const { ctx } = adapterContext(adapter, temp);
    const [file] = await adapter.enumerate(ctx);

    const info = await adapter.sessionInfo(file);

    expect(info).toEqual({
      cwd: null,
      title: null,
      firstPrompt: 'find the zebra bug',
      startedAt: null,
    });
    expect(adapter.openHint(written.id, info, written.path)).toEqual({
      command: null,
      hint: `open in Cursor (transcript: ${written.path})`,
    });
  });
});
