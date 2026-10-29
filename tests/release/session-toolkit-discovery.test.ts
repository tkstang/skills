import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  identifyCurrentTranscript,
  listSessions,
  readTranscript,
} from '../../packages/session-toolkit/src/index.js';
const ID = '11111111-1111-4111-8111-111111111111';
const PARENT = '22222222-2222-4222-8222-222222222222';
async function fixture(run: (home: string, cwd: string) => Promise<void>) {
  const home = await realpath(
    await mkdtemp(join(tmpdir(), 'seshtk-discover-')),
  );
  const cwd = join(home, 'repo');
  await mkdir(cwd);
  try {
    await run(home, cwd);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
async function put(path: string, records: unknown[]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    records.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
}
describe('historical listing and exact identity remain separate', () => {
  it('lists all providers with cwd provenance while refusing cwd-only current identity', async () =>
    fixture(async (home, cwd) => {
      await put(
        join(
          home,
          '.claude/projects',
          cwd.replace(/[/.]/gu, '-'),
          `${ID}.jsonl`,
        ),
        [{ sessionId: ID, cwd, type: 'user', message: { content: 'hello' } }],
      );
      await put(
        join(
          home,
          '.codex/sessions/2026/10/29',
          `rollout-2026-10-29T10-00-00-${ID}.jsonl`,
        ),
        [{ type: 'session_meta', payload: { id: ID, cwd } }],
      );
      await put(
        join(
          home,
          '.cursor/projects',
          cwd.split(/[/.]/u).filter(Boolean).join('-'),
          'agent-transcripts',
          ID,
          `${ID}.jsonl`,
        ),
        [
          {
            role: 'user',
            message: { content: [{ type: 'text', text: 'hello' }] },
          },
        ],
      );
      const listed = await listSessions({ homeDir: home, cwd });
      expect(listed.kind).toBe('historical');
      expect(listed.candidates.map((c) => c.runtime).toSorted()).toEqual([
        'claude-code',
        'codex',
        'cursor',
      ]);
      expect(
        listed.candidates.find((c) => c.runtime === 'cursor')?.cwdEvidence,
      ).toBe('project-layout');
      expect(
        await identifyCurrentTranscript({ homeDir: home, cwd, env: {} }),
      ).toMatchObject({ status: 'unavailable', runtimeId: null, path: null });
      const read = await readTranscript({
        homeDir: home,
        session: `claude-code:${ID}`,
      });
      expect(read.messages[0].text).toBe('hello');
      for (const [name, runtime] of [
        ['CLAUDE_SESSION_ID', 'claude-code'],
        ['CODEX_THREAD_ID', 'codex'],
        ['CURSOR_CONVERSATION_ID', 'cursor'],
      ] as const)
        expect(
          await identifyCurrentTranscript({
            homeDir: home,
            cwd,
            env: { [name]: ID },
          }),
        ).toMatchObject({ runtime, status: 'authoritative', runtimeId: ID });
    }));
  it('preserves native/root/parent/fork identity without treating grouping env as the native thread', async () =>
    fixture(async (home, cwd) => {
      await put(
        join(
          home,
          '.codex/sessions/2026/10/29',
          `rollout-2026-10-29T10-00-00-${ID}.jsonl`,
        ),
        [
          {
            type: 'session_meta',
            payload: {
              id: ID,
              cwd,
              session_id: PARENT,
              parent_thread_id: PARENT,
              forked_from_id: PARENT,
              subagent_history_start_ordinal: 7,
            },
          },
        ],
      );
      const exact = await identifyCurrentTranscript({
        homeDir: home,
        cwd,
        env: { CODEX_THREAD_ID: ID, CODEX_SESSION_ID: PARENT },
      });
      expect(exact).toMatchObject({
        status: 'authoritative',
        runtimeId: ID,
        parentSessionId: PARENT,
        lineage: {
          nativeSessionId: ID,
          rootSessionId: PARENT,
          parentSessionId: PARENT,
          forkedFromSessionId: PARENT,
          subagentHistoryStartOrdinal: 7,
        },
      });
      expect(
        await identifyCurrentTranscript({
          homeDir: home,
          cwd,
          env: { CODEX_SESSION_ID: PARENT },
        }),
      ).toMatchObject({ status: 'unavailable', runtimeId: null });
    }));
  it('merges explicit-self and harness variables fail-closed', async () =>
    fixture(async (home, cwd) => {
      expect(
        await identifyCurrentTranscript({
          homeDir: home,
          cwd,
          env: {
            SESSION_OBSERVER_SELF: `codex:${ID}`,
            CODEX_THREAD_ID: PARENT,
          },
        }),
      ).toMatchObject({ status: 'ambiguous', path: null });
      expect(
        await identifyCurrentTranscript({
          homeDir: home,
          cwd,
          env: {
            SESSION_OBSERVER_SELF: 'codex',
            SESSION_OBSERVER_SESSION_ID: ID,
          },
        }),
      ).toMatchObject({
        runtime: 'codex',
        runtimeId: ID,
        status: 'unavailable',
      });
      expect(
        await identifyCurrentTranscript({
          homeDir: home,
          cwd,
          env: { SESSION_OBSERVER_SELF: 'wrong' },
        }),
      ).toMatchObject({ status: 'invalid', path: null });
    }));
  it('finds native Codex IDs under nonstandard or case-varied filenames and refuses duplicate carriers', async () =>
    fixture(async (home, cwd) => {
      const dir = join(home, '.codex/sessions/2026/10/29');
      await put(join(dir, 'native-carrier.jsonl'), [
        { type: 'session_meta', payload: { id: ID, cwd } },
      ]);
      expect(
        (await readTranscript({ homeDir: home, session: `codex:${ID}` }))
          .metadata?.nativeSessionId,
      ).toBe(ID);
      await put(
        join(dir, `rollout-2026-10-29T10-00-00-${ID.toUpperCase()}.jsonl`),
        [{ type: 'session_meta', payload: { id: ID, cwd } }],
      );
      await expect(
        readTranscript({ homeDir: home, session: `codex:${ID}` }),
      ).rejects.toMatchObject({ code: 'E_AMBIGUOUS' });
    }));
  it('filters unrelated valid Codex sessions but refuses a carrier claiming the selected ID', async () =>
    fixture(async (home, cwd) => {
      const dir = join(home, '.codex/sessions');
      await put(join(dir, 'native-carrier.jsonl'), [
        { type: 'session_meta', payload: { id: ID, cwd } },
        {
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: 'selected conversation',
          },
        },
      ]);
      await put(join(dir, `rollout-${PARENT}.jsonl`), [
        { type: 'session_meta', payload: { id: PARENT, cwd } },
      ]);
      const options = { homeDir: home, session: `codex:${ID}` };
      const listed = await listSessions(options);
      expect(listed.coverage.complete).toBe(true);
      expect(listed.candidates.map((candidate) => candidate.sessionId)).toEqual(
        [ID],
      );
      expect(
        (await readTranscript(options)).messages.map((message) => message.text),
      ).toEqual(['selected conversation']);
      await put(join(dir, `rollout-${ID}.jsonl`), [
        { type: 'session_meta', payload: { id: PARENT, cwd } },
      ]);
      await expect(readTranscript(options)).rejects.toMatchObject({
        code: 'E_UNAVAILABLE',
      });
    }));
  it('reads listed generic Cursor carriers and refuses duplicates', async () =>
    fixture(async (home, cwd) => {
      const dir = join(
        home,
        '.cursor/projects',
        cwd.split(/[/.]/u).filter(Boolean).join('-'),
        'agent-transcripts',
        ID,
      );
      await put(join(dir, 'transcript.jsonl'), [
        {
          role: 'user',
          message: { content: [{ type: 'text', text: 'generic carrier' }] },
        },
      ]);
      const listed = await listSessions({
        homeDir: home,
        cwd,
        runtime: 'cursor',
      });
      expect(listed.candidates.map((candidate) => candidate.sessionId)).toEqual(
        [ID],
      );
      const options = { homeDir: home, session: `cursor:${ID}` };
      expect((await readTranscript(options)).records[0].record).toEqual({
        role: 'user',
        message: { content: [{ type: 'text', text: 'generic carrier' }] },
      });
      await put(join(dir, 'conversation.jsonl'), [
        {
          role: 'user',
          message: { content: [{ type: 'text', text: 'duplicate carrier' }] },
        },
      ]);
      await expect(readTranscript(options)).rejects.toMatchObject({
        code: 'E_AMBIGUOUS',
      });
    }));
  it('reports budgets, result omissions, time filters and exact duplicate refusal', async () =>
    fixture(async (home, cwd) => {
      for (const n of ['one', 'two'])
        await put(
          join(
            home,
            '.codex/sessions/2026/10',
            n,
            `rollout-2026-10-29T10-00-00-${ID}.jsonl`,
          ),
          [{ type: 'session_meta', payload: { id: ID, cwd } }],
        );
      const limited = await listSessions({
        homeDir: home,
        runtime: 'codex',
        limit: 1,
      });
      expect(limited.coverage).toMatchObject({
        complete: false,
        omittedCandidates: 1,
      });
      const budget = await listSessions({
        homeDir: home,
        runtime: 'codex',
        budget: { maxEntries: 1 },
      });
      expect(budget.coverage.reasons).toContain('codex:entry-budget');
      await expect(
        readTranscript({ homeDir: home, session: `codex:${ID}` }),
      ).rejects.toMatchObject({ code: 'E_AMBIGUOUS' });
      expect(
        (await listSessions({ homeDir: home, until: '2001-01-01' })).candidates,
      ).toEqual([]);
      await expect(
        listSessions({
          homeDir: home,
          since: '2026-10-29',
          until: '2020-01-01',
        }),
      ).rejects.toMatchObject({ code: 'E_USAGE' });
    }));
});
