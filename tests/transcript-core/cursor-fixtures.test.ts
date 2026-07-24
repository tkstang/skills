import { readFile, readdir } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const fixtureDirectory = new URL(
  '../session-observer/fixtures/cursor/',
  import.meta.url,
);

const scenarios = {
  'framed-append-after.jsonl': {
    labels: ['parsed', 'parsed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-append-before.jsonl': {
    labels: ['parsed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-blank-lines.jsonl': {
    labels: ['parsed', 'blank', 'parsed', 'blank'],
    newlineTerminated: true,
  },
  'framed-closed.jsonl': {
    labels: ['parsed', 'parsed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-malformed-middle.jsonl': {
    labels: ['parsed', 'malformed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-repair-after.jsonl': {
    labels: ['parsed', 'parsed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-repair-before.jsonl': {
    labels: ['parsed', 'malformed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-replacement-after.jsonl': {
    labels: ['parsed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-replacement-before.jsonl': {
    labels: ['parsed', 'parsed'],
    newlineTerminated: true,
  },
  'framed-unterminated-tail.jsonl': {
    labels: ['parsed', 'partial'],
    newlineTerminated: false,
  },
} as const;

function physicalFrames(text: string): string[] {
  const frames = text.split('\n');
  if (text.endsWith('\n')) frames.pop();
  return frames;
}

function classifyFixtureFrame(
  frame: string,
  closed: boolean,
): 'parsed' | 'blank' | 'malformed' | 'partial' {
  if (!closed) return 'partial';
  if (frame.length === 0) return 'blank';

  try {
    JSON.parse(frame);
    return 'parsed';
  } catch {
    return 'malformed';
  }
}

describe('Cursor framed fixture contract', () => {
  it('keeps the complete framing scenario inventory', async () => {
    const files = (await readdir(fixtureDirectory))
      .filter((file) => file.startsWith('framed-'))
      .toSorted();

    expect(files).toEqual(Object.keys(scenarios).toSorted());
  });

  it.each(Object.entries(scenarios))(
    'preserves bytes and structural labels for %s',
    async (file, contract) => {
      const bytes = await readFile(new URL(file, fixtureDirectory));
      const text = bytes.toString('utf8');
      const frames = physicalFrames(text);
      const labels = frames.map((frame, index) =>
        classifyFixtureFrame(
          frame,
          index < frames.length - 1 || contract.newlineTerminated,
        ),
      );

      expect(Buffer.from(text, 'utf8')).toEqual(bytes);
      expect(text).not.toContain('\r');
      expect(text.endsWith('\n')).toBe(contract.newlineTerminated);
      expect(labels).toEqual(contract.labels);
    },
  );

  it('uses only synthetic, redacted fixture content', async () => {
    const fixtureText = (
      await Promise.all(
        Object.keys(scenarios).map((file) =>
          readFile(new URL(file, fixtureDirectory), 'utf8'),
        ),
      )
    ).join('\n');

    expect(fixtureText).not.toMatch(/\/Users\/|\/home\/|[A-Fa-f0-9]{32,}/);
    expect(fixtureText).not.toMatch(
      /session[_-]?id|conversation[_-]?id|lease[_-]?id|credential|token/i,
    );
    expect(fixtureText).toMatch(/Synthetic request/);
  });

  it('keeps append and replacement pairs byte-comparable', async () => {
    const appendBefore = await readFile(
      new URL('framed-append-before.jsonl', fixtureDirectory),
    );
    const appendAfter = await readFile(
      new URL('framed-append-after.jsonl', fixtureDirectory),
    );
    const replacementBefore = await readFile(
      new URL('framed-replacement-before.jsonl', fixtureDirectory),
    );
    const replacementAfter = await readFile(
      new URL('framed-replacement-after.jsonl', fixtureDirectory),
    );

    expect(appendAfter.subarray(0, appendBefore.length)).toEqual(appendBefore);
    expect(replacementAfter.length).toBe(replacementBefore.length);
    expect(replacementAfter).not.toEqual(replacementBefore);
  });
});
