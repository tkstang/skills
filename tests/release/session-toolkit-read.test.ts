import { mkdtemp, writeFile, appendFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { parseTranscript } from '../../packages/session-toolkit/src/index.js';

async function fixture(run: (path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'seshtk-read-'));
  try {
    await run(join(dir, 'session.jsonl'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
describe('bounded public parsing', () => {
  it('keeps malformed nonblank ordinals separate from decoded objects, physical lines and source bytes', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        '\n{"type":"user","message":{"content":"hello"}}\nBROKEN\n{"type":"assistant","message":{"content":"answer"}}\n{"partial":',
      );
      const page = await parseTranscript({ runtime: 'claude-code', path });
      expect(
        page.records.map((r) => [
          r.recordIndex,
          r.sourceOrdinal,
          r.physicalLine,
        ]),
      ).toEqual([
        [0, 0, 2],
        [1, 2, 4],
      ]);
      expect(page.records[0].byteStart).toBe(1);
      expect(page.records[0].sourceCarrier).toBe(
        '{"type":"user","message":{"content":"hello"}}',
      );
      expect(
        page.diagnostics.map((d) => [d.kind, d.sourceOrdinal, d.physicalLine]),
      ).toEqual([
        ['malformed', 1, 3],
        ['partial-tail', 3, 5],
      ]);
      expect(page.coverage.reasons).toEqual(['incomplete-tail']);
      expect(page.nextOffset).toBe(3);
      expect(page.messages.map((m) => m.text)).toEqual(['hello', 'answer']);
    }));
  it('bounds source bytes, resumes records, and rejects generation/projection mismatches', async () =>
    fixture(async (path) => {
      const line = '{"type":"user","message":{"content":"hello"}}\n';
      await writeFile(path, line.repeat(3));
      const first = await parseTranscript({
        runtime: 'claude-code',
        path,
        maxBytes: Buffer.byteLength(line) + 3,
      });
      expect(first.bytesRead).toBe(Buffer.byteLength(line) + 3);
      expect(first.records).toHaveLength(1);
      expect(first.nextOffset).toBe(1);
      const second = await parseTranscript({
        runtime: 'claude-code',
        path,
        cursor: first.nextCursor!,
        maxRecords: 1,
      });
      expect(second.records[0]).toMatchObject({
        recordIndex: 1,
        sourceOrdinal: 1,
        physicalLine: 2,
      });
      await expect(
        parseTranscript({
          runtime: 'claude-code',
          path,
          cursor: first.nextCursor!,
          includeToolCalls: true,
        }),
      ).rejects.toMatchObject({ code: 'E_CURSOR_INVALID' });
      await expect(
        parseTranscript({
          runtime: 'claude-code',
          path,
          cursor: first.nextCursor!,
          fromOffset: 0,
        }),
      ).rejects.toMatchObject({ code: 'E_USAGE' });
      await appendFile(path, line);
      await expect(
        parseTranscript({
          runtime: 'claude-code',
          path,
          cursor: first.nextCursor!,
        }),
      ).rejects.toMatchObject({ code: 'E_SOURCE_CHANGED' });
    }));
  it('includes Codex tool results independently and preserves their page coordinates', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          {
            type: 'response_item',
            payload: {
              type: 'function_call',
              call_id: 'a',
              name: 'exec_command',
              arguments: '{"cmd":"echo fixture"}',
            },
          },
          {
            type: 'response_item',
            payload: {
              type: 'function_call_output',
              call_id: 'a',
              output: 'recorded-output',
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      for (const [flags, expected] of [
        [{}, []],
        [{ includeToolCalls: true }, ['[exec_command] {"cmd":"echo fixture"}']],
        [
          { includeToolResults: true },
          ['[exec_command → result] recorded-output'],
        ],
        [
          { includeToolCalls: true, includeToolResults: true },
          [
            '[exec_command] {"cmd":"echo fixture"}',
            '[exec_command → result] recorded-output',
          ],
        ],
      ] as const) {
        const page = await parseTranscript({
          runtime: 'codex',
          path,
          ...flags,
        });
        expect(page.messages.map((message) => message.text)).toEqual(expected);
      }
      const first = await parseTranscript({
        runtime: 'codex',
        path,
        includeToolCalls: true,
        includeToolResults: true,
        maxMessages: 1,
      });
      expect(first.nextOffset).toBe(1);
      const next = await parseTranscript({
        runtime: 'codex',
        path,
        includeToolCalls: true,
        includeToolResults: true,
        cursor: first.nextCursor!,
      });
      expect(next.messages).toMatchObject([
        {
          kind: 'tool_result',
          toolName: 'tool_result',
          recordIndex: 1,
          sourceOrdinal: 1,
          physicalLine: 2,
          text: '[tool_result → result] recorded-output',
        },
      ]);
    }));
  it('uses Cursor frame coordinates, retaining malformed frames and blocking an unclosed valid frame', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        '\nINVALID\n{"role":"user","message":{"content":[{"type":"text","text":"question"}]}}\n{"role":"assistant","message":{"content":[{"type":"text","text":"pending"}]}}',
      );
      const page = await parseTranscript({ runtime: 'cursor', path });
      expect(page.coordinate).toBe('zero-based-jsonl-frame-index');
      expect(page.records[0]).toMatchObject({
        frameIndex: 2,
        recordIndex: 0,
        sourceOrdinal: 2,
        physicalLine: 3,
      });
      expect(page.nextOffset).toBe(3);
      expect(page.coverage.reasons).toEqual(['incomplete-tail']);
      expect(page.diagnostics.map((d) => d.kind)).toEqual([
        'malformed',
        'partial-tail',
      ]);
    }));
  it('retains global Cursor message origins after a resumed metadata page', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          { type: 'session_meta' },
          {
            role: 'user',
            message: { content: [{ type: 'text', text: 'question' }] },
          },
          {
            role: 'assistant',
            message: { content: [{ type: 'text', text: 'answer' }] },
          },
          { type: 'turn_ended', status: 'success' },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const first = await parseTranscript({
        runtime: 'cursor',
        path,
        maxRecords: 1,
      });
      const resumed = await parseTranscript({
        runtime: 'cursor',
        path,
        cursor: first.nextCursor!,
      });
      expect(
        resumed.messages.map((message) => [
          message.recordIndex,
          message.sourceRecordIndex,
        ]),
      ).toEqual([
        [3, 1],
        [3, 2],
      ]);
    }));
  it('counts Cursor delivered activity in frame coordinates across malformed frames', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        'BAD\nBAD\n' +
          [
            {
              role: 'assistant',
              message: {
                content: [
                  {
                    type: 'tool_use',
                    name: 'Shell',
                    input: { command: 'echo hi' },
                  },
                ],
              },
            },
            { type: 'turn_ended', status: 'success' },
          ]
            .map((record) => JSON.stringify(record))
            .join('\n') +
          '\n',
      );
      const page = await parseTranscript({
        runtime: 'cursor',
        path,
        includeActivity: true,
      });
      expect(page.activity?.counts.capturedSource.calls).toBe(1);
      expect(page.activity?.counts.deliveredRange.calls).toBe(1);
      expect(page.activity?.counts.displayed.calls).toBe(1);
    }));
  it(
    'projects multi-thousand-record pages with and without a message limit in practical time',
    async () =>
      fixture(async (path) => {
        await writeFile(
          path,
          Array.from({ length: 5000 }, (_, index) =>
            JSON.stringify({
              type: 'user',
              message: { content: `line ${index}` },
            }),
          ).join('\n') + '\n',
        );
        const started = performance.now();
        const all = await parseTranscript({ runtime: 'claude-code', path });
        expect(performance.now() - started).toBeLessThan(5000);
        expect(all.messages).toHaveLength(5000);
        expect(all.messages[0].text).toBe('line 0');
        expect(all.messages[4999].text).toBe('line 4999');
        expect(all.coverage.complete).toBe(true);
        const limitedStarted = performance.now();
        const limited = await parseTranscript({
          runtime: 'claude-code',
          path,
          maxMessages: 4500,
        });
        expect(performance.now() - limitedStarted).toBeLessThan(5000);
        expect(limited.messages).toHaveLength(4500);
        expect(limited.messages[4499].text).toBe('line 4499');
        expect(limited.nextOffset).toBe(4500);
        expect(limited.coverage.reasons).toEqual(['message-limit']);
      }),
    30000,
  );
  it('keeps message-limited content records atomic and resumes the excluded record', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          { type: 'user', message: { content: 'one' } },
          {
            type: 'assistant',
            message: { content: [{ text: 'two' }, { text: 'three' }] },
          },
          { type: 'user', message: { content: 'four' } },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const first = await parseTranscript({
        runtime: 'claude-code',
        path,
        maxMessages: 2,
      });
      expect(first.messages.map((message) => message.text)).toEqual(['one']);
      expect(first.records).toHaveLength(1);
      const second = await parseTranscript({
        runtime: 'claude-code',
        path,
        maxMessages: 1,
        cursor: first.nextCursor!,
      });
      expect(second.messages.map((message) => message.text)).toEqual([
        'two',
        'three',
      ]);
      expect(second.nextOffset).toBe(2);
    }));
  it('stops exact message limits before later diagnostics but retains diagnostics before an excluded oversized record', async () =>
    fixture(async (path) => {
      const first = JSON.stringify({
        type: 'user',
        message: { content: 'one' },
      });
      const next = JSON.stringify({
        type: 'assistant',
        message: { content: [{ text: 'two' }, { text: 'three' }] },
      });
      await writeFile(path, `${first}\nBAD\n${next}\n`);
      const exact = await parseTranscript({
        runtime: 'claude-code',
        path,
        maxMessages: 1,
      });
      expect(exact.diagnostics).toEqual([]);
      expect(exact.nextOffset).toBe(1);
      const resumed = await parseTranscript({
        runtime: 'claude-code',
        path,
        cursor: exact.nextCursor!,
      });
      expect(
        resumed.diagnostics.map((diagnostic) => diagnostic.sourceOrdinal),
      ).toEqual([1]);
      expect(resumed.messages.map((message) => message.text)).toEqual([
        'two',
        'three',
      ]);
      const oversized = await parseTranscript({
        runtime: 'claude-code',
        path,
        maxMessages: 2,
      });
      expect(
        oversized.diagnostics.map((diagnostic) => diagnostic.sourceOrdinal),
      ).toEqual([1]);
      expect(oversized.nextOffset).toBe(2);
      expect(oversized.messages.map((message) => message.text)).toEqual([
        'one',
      ]);
    }));
  it('preserves Cursor pending-question boundaries before terminal collapse for both tool projections', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          {
            role: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  name: 'AskQuestion',
                  input: {
                    title: 'Gate',
                    questions: [{ id: 'q', prompt: 'Proceed?' }],
                  },
                },
              ],
            },
          },
          {
            role: 'user',
            message: { content: [{ type: 'text', text: 'Yes' }] },
          },
          {
            role: 'assistant',
            message: { content: [{ type: 'text', text: 'Done' }] },
          },
          { type: 'turn_ended', status: 'success' },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      for (const includeToolCalls of [false, true]) {
        const first = await parseTranscript({
          runtime: 'cursor',
          path,
          includeToolCalls,
          maxMessages: 2,
        });
        expect(first.records).toHaveLength(2);
        expect(first.messages.map((message) => message.kind)).toEqual([
          'ask_user',
          'message',
        ]);
        expect(first.messages[1].text).toBe('Yes');
        expect(first.nextOffset).toBe(2);
        expect(first.coverage.reasons).toEqual(['message-limit']);
        const rest = await parseTranscript({
          runtime: 'cursor',
          path,
          includeToolCalls,
          cursor: first.nextCursor!,
        });
        expect(rest.messages.map((message) => message.text)).toEqual(['Done']);
        expect(rest.messages[0]).toMatchObject({
          recordIndex: 3,
          sourceRecordIndex: 2,
          physicalLine: 4,
        });
      }
    }));
  it('preserves the first message boundary when conflicting Claude tool IDs later reduce the projection', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          {
            type: 'user',
            message: {
              content: [
                { type: 'tool_result', tool_use_id: 'a', content: 'answer' },
              ],
            },
          },
          {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  id: 'a',
                  name: 'AskUserQuestion',
                  input: { questions: [{ question: 'Choice?' }] },
                },
              ],
            },
          },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'tool_use', id: 'a', name: 'Read', input: {} }],
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const page = await parseTranscript({
        runtime: 'claude-code',
        path,
        maxMessages: 2,
      });
      expect(page.records).toHaveLength(2);
      expect(page.messages.map((message) => message.kind)).toEqual([
        'ask_user',
        'ask_user',
      ]);
      expect(page.nextOffset).toBe(2);
    }));
  it('keeps tools opt-in and raw fields intact under message limits', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          { type: 'user', message: { content: 'hello' } },
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
                { type: 'tool_result', tool_use_id: 'call', content: 'hi' },
              ],
            },
          },
        ]
          .map((v) => JSON.stringify(v))
          .join('\n') + '\n',
      );
      const plain = await parseTranscript({ runtime: 'claude-code', path });
      expect(plain.messages.map((m) => m.kind)).toEqual(['message']);
      expect(plain.records[1].record.message).toMatchObject({
        content: [{ input: { command: 'echo hi' } }],
      });
      const calls = await parseTranscript({
        runtime: 'claude-code',
        path,
        includeToolCalls: true,
      });
      expect(calls.messages.map((m) => m.kind)).toEqual([
        'message',
        'tool_call',
      ]);
      const results = await parseTranscript({
        runtime: 'claude-code',
        path,
        includeToolResults: true,
      });
      expect(results.messages.map((m) => m.kind)).toEqual([
        'message',
        'tool_result',
      ]);
    }));
  it('keeps activity summaries separate from tool opt-ins and reports page usage/coverage', async () =>
    fixture(async (path) => {
      await writeFile(
        path,
        [
          {
            type: 'session_meta',
            payload: { id: 'fixture-id', cwd: '/fixture' },
          },
          {
            type: 'response_item',
            payload: {
              type: 'function_call',
              call_id: 'a',
              name: 'exec_command',
              arguments: '{}',
            },
          },
          {
            type: 'event_msg',
            payload: {
              type: 'token_count',
              info: {
                total_token_usage: {
                  input_tokens: 50,
                  output_tokens: 7,
                  total_tokens: 57,
                },
              },
            },
          },
        ]
          .map((r) => JSON.stringify(r))
          .join('\n') + '\n',
      );
      const plain = await parseTranscript({ runtime: 'codex', path });
      expect(plain.activity).toBeUndefined();
      const summary = await parseTranscript({
        runtime: 'codex',
        path,
        includeActivity: true,
      });
      expect(summary.messages).toEqual([]);
      expect(summary.activity).toMatchObject({
        scope: 'captured-page',
        sourceComplete: true,
        counts: { capturedSource: { calls: 1 } },
        sourceMetadata: { usage: { availability: 'recorded' } },
      });
      const bounded = await parseTranscript({
        runtime: 'codex',
        path,
        includeActivity: true,
        maxRecords: 1,
      });
      expect(bounded.activity?.sourceComplete).toBe(false);
    }));
});
