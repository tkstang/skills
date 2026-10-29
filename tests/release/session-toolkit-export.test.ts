import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  realpath,
  unlink,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { exportMarkdown } from '../../packages/session-toolkit/src/index.js';
async function fixture(run: (home: string, cwd: string) => Promise<void>) {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'seshtk-export-'))),
    cwd = join(home, 'repo');
  await mkdir(cwd);
  try {
    await run(home, cwd);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
async function session(home: string, cwd: string, id: string, text: string) {
  const path = join(
    home,
    '.claude/projects',
    cwd.replace(/[/.]/gu, '-'),
    `${id.replaceAll('/', '_')}.jsonl`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    [
      {
        sessionId: id,
        cwd,
        type: 'user',
        message: { content: '# AGENTS.md instructions for private repo' },
      },
      { type: 'user', message: { content: text } },
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'call',
              name: 'Bash',
              input: { command: 'echo hi' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call',
              content: 'tool result text',
            },
          ],
        },
      },
      { type: 'assistant', message: { content: 'answer' } },
    ]
      .map((r) => JSON.stringify(r))
      .join('\n') + '\n',
  );
  return path;
}
describe('safe Markdown export', () => {
  it('preserves sanitizer and independent tool opt-ins at the file boundary', async () =>
    fixture(async (home, cwd) => {
      await session(home, cwd, 'session-00000001', 'visible question');
      for (const [name, flags, calls, results] of [
        ['plain', {}, false, false],
        ['calls', { includeToolCalls: true }, true, false],
        ['results', { includeToolResults: true }, false, true],
      ] as const) {
        const out = join(home, `${name}.md`);
        const result = await exportMarkdown({
          homeDir: home,
          session: 'claude-code:session-00000001',
          out,
          ...flags,
        });
        const text = await readFile(out, 'utf8');
        expect(text).toContain('visible question');
        expect(text).toContain('answer');
        expect(text).not.toContain('AGENTS.md instructions');
        expect(text.includes('(tool_call)')).toBe(calls);
        expect(text.includes('tool result text')).toBe(results);
        expect(result.written[0].coverage.complete).toBe(true);
      }
    }));
  it('refuses ambiguity/no marker match and supports unique markers and bounded batch discovery', async () =>
    fixture(async (home, cwd) => {
      await session(home, cwd, 'session-00000001', 'marker-one');
      await session(home, cwd, 'session-00000002', 'marker-two');
      await expect(
        exportMarkdown({ homeDir: home, cwd, out: join(home, 'ambiguous.md') }),
      ).rejects.toMatchObject({ code: 'E_AMBIGUOUS' });
      await expect(
        exportMarkdown({
          homeDir: home,
          cwd,
          match: 'not-present',
          out: join(home, 'miss.md'),
        }),
      ).rejects.toMatchObject({ code: 'E_UNAVAILABLE' });
      const marked = await exportMarkdown({
        homeDir: home,
        cwd,
        match: 'marker-two',
        out: join(home, 'one.md'),
      });
      expect(marked.written[0].session).toBe('claude-code:session-00000002');
      const all = await exportMarkdown({
        homeDir: home,
        cwd,
        all: true,
        limit: 1,
        out: join(home, 'batch'),
      });
      expect(all.written).toHaveLength(1);
      expect(all.discovery).toMatchObject({
        complete: false,
        omittedCandidates: 1,
      });
      await expect(
        exportMarkdown({
          homeDir: home,
          session: 'claude-code:session-00000001',
          all: true,
          out: join(home, 'bad'),
        }),
      ).rejects.toMatchObject({ code: 'E_USAGE' });
    }));
  it('confines unsafe native IDs and refuses symlink/existing destination overwrites', async () =>
    fixture(async (home, cwd) => {
      await session(home, cwd, '../../outside', 'visible');
      const out = join(home, 'batch');
      const batch = await exportMarkdown({
        homeDir: home,
        cwd,
        all: true,
        out,
      });
      expect(dirname(batch.written[0].path)).toBe(out);
      expect(await readdir(out)).toHaveLength(1);
      const sentinel = join(home, 'sentinel');
      await writeFile(sentinel, 'untouched');
      await unlink(batch.written[0].path);
      await symlink(sentinel, batch.written[0].path);
      await expect(
        exportMarkdown({ homeDir: home, cwd, all: true, out }),
      ).rejects.toMatchObject({ code: 'E_USAGE' });
      expect(await readFile(sentinel, 'utf8')).toBe('untouched');
    }));
});
