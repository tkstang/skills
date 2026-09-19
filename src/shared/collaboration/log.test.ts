import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { appendLogEntry, getLogView, renderLog } from './log.js';
import { openCollaboration } from './membership.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-log-'));
  const collaborationId = crypto.randomUUID();
  const pin = { runtime: 'codex' as const, sessionId: 'driver' };
  await openCollaboration({
    root,
    collaborationId,
    alias: 'driver',
    pin,
    worktree: '/tmp/a',
    label: 'log',
    task: 'test',
  });
  return { root, collaborationId, pin };
}

describe('authoritative collaboration log', () => {
  test('preserves concurrent authors and deterministically renders entries', async () => {
    const f = await fixture();
    await Promise.all([
      appendLogEntry({
        ...f,
        id: crypto.randomUUID(),
        category: 'decision',
        title: 'Choose A',
        whatHappened: 'Selected A.',
        assessment: 'works-well',
        skillImplication: 'Document it.',
        now: '2026-01-01T00:00:02.000Z',
      }),
      appendLogEntry({
        ...f,
        id: crypto.randomUUID(),
        category: 'observation',
        title: 'Earlier',
        whatHappened: 'Observed first.',
        assessment: 'neutral',
        skillImplication: 'None.',
        now: '2026-01-01T00:00:01.000Z',
      }),
    ]);
    const first = await renderLog(f);
    const second = await renderLog(f);
    expect(second.markdown).toBe(first.markdown);
    expect(first.markdown.indexOf('## Earlier')).toBeLessThan(
      first.markdown.indexOf('## Choose A'),
    );
    expect((await getLogView(f)).stale).toBe(false);
  });

  test('same ID retry is idempotent and conflicting entry is rejected', async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    const input = {
      ...f,
      id,
      category: 'content',
      title: 'Result',
      whatHappened: 'Done.',
      assessment: 'works-well',
      skillImplication: 'Reuse.',
    };
    expect((await appendLogEntry(input)).duplicate).toBe(false);
    expect((await appendLogEntry(input)).duplicate).toBe(true);
    await expect(
      appendLogEntry({ ...input, title: 'Changed' }),
    ).rejects.toMatchObject({ code: 'RECORD_CONFLICT' });
  });

  test('detects a stale rendered view after append and supports explicit correction', async () => {
    const f = await fixture();
    await appendLogEntry({
      ...f,
      id: crypto.randomUUID(),
      category: 'content',
      title: 'Initial',
      whatHappened: 'Original.',
      assessment: 'neutral',
      skillImplication: 'None.',
    });
    const rendered = await renderLog(f);
    await appendLogEntry({
      ...f,
      id: crypto.randomUUID(),
      category: 'correction',
      title: 'Correction',
      whatHappened: 'Correct the prior assessment.',
      assessment: 'fixed',
      skillImplication: 'Use corrected result.',
    });
    expect((await getLogView(f)).stale).toBe(true);
    expect(await readFile(rendered.path, 'utf8')).not.toContain(
      '## Correction',
    );
    expect((await renderLog(f)).markdown).toContain('## Correction');
  });
});
