import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { beforeEach, afterEach, expect, it } from 'vitest';

import {
  captureActivity,
  parseTranscript,
} from '../../packages/session-toolkit/src/index.js';
import {
  makeTempHome,
  searchEnv,
  writeCodexRollout,
  codexSessionMeta,
  codexMessage,
  codexToolOutput,
  writeClaudeSession,
  claudeToolUse,
  claudeToolResult,
  writeCursorTranscript,
  cursorToolUse,
  cursorTurnEnded,
  type TempHome,
} from '../helpers/session-toolkit-search.js';
let temp: TempHome;
const id = '019a0000-0000-7000-8000-000000000112';
const long = 'retained-raw-'.repeat(1000) + 'tail-evidence';
beforeEach(() => {
  temp = makeTempHome('seshtk-activity-public-');
});
afterEach(() => temp.cleanup());
function options(session = 'codex:' + id) {
  return { homeDir: temp.home, session };
}
function codex() {
  return writeCodexRollout(temp.home, {
    id,
    startedAtMs: Date.now(),
    records: [
      codexSessionMeta({ id, cwd: temp.home }),
      codexMessage('user', 'question', 1),
      {
        type: 'response_item',
        ordinal: 2,
        payload: {
          type: 'function_call',
          name: 'exec_command',
          call_id: 'call',
          arguments: JSON.stringify({ command: long }),
        },
      },
      codexToolOutput('function_call_output', 'call', long, 3),
      {
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: { input_tokens: 41, output_tokens: 7 },
            last_token_usage: { input_tokens: 11, output_tokens: 3 },
          },
        },
      },
    ],
  });
}
function cli(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      resolve('packages/session-toolkit/dist/bin.js'),
      'activity',
      ...args,
      '--json',
    ],
    { env: { ...process.env, ...searchEnv(temp) }, encoding: 'utf8' },
  );
}
it('preserves full Codex fields, associations, usage and source evidence absent from digest', async () => {
  const path = codex();
  const digest = await parseTranscript({
    runtime: 'codex',
    path,
    includeToolCalls: true,
    includeToolResults: true,
  });
  expect(JSON.stringify(digest.messages)).not.toContain('tail-evidence');
  const capture = await captureActivity(options());
  const call = capture.events.find((e) => e.kind === 'call')!;
  const result = capture.events.find((e) => e.kind === 'result')!;
  expect(call.arguments).toEqual({ command: long });
  expect(result.result).toBe(long);
  expect(result.relatedCallKey).toBe(call.eventKey);
  expect(
    capture.sourceMetadata?.usage?.samples.map((s) => s.tokens),
  ).toContainEqual({ input_tokens: 41, output_tokens: 7 });
  expect(capture.sourceRead.coverage.fullSource).toBe(true);
  expect(capture.sourceRead.records[2]).toMatchObject({
    sourceOrdinal: 2,
    recordIndex: 2,
    physicalLine: 3,
    byteStart: expect.any(Number),
    byteEnd: expect.any(Number),
  });
  expect(capture.sourceRead.records[3].sourceCarrier).toContain(
    'tail-evidence',
  );
});
it('retains Claude arguments/results and honest malformed/paged source coordinates', async () => {
  const path = writeClaudeSession(temp.home, {
    sessionId: id,
    cwd: temp.home,
    records: (e) => [
      claudeToolUse(e, 'call', 'Bash', { command: long }),
      claudeToolResult(e, 'call', long),
    ],
  });
  const capture = await captureActivity(options('claude-code:' + id));
  expect(capture.events.find((e) => e.kind === 'call')?.arguments).toEqual({
    command: long,
  });
  expect(capture.events.find((e) => e.kind === 'result')?.result).toEqual({
    content: long,
  });
  appendFileSync(path.path, '{broken}\n');
  const malformed = await captureActivity(options('claude-code:' + id));
  expect(malformed.sourceRead.coverage.fullSource).toBe(false);
  expect(
    malformed.diagnostics.some((d) => d.code === 'SOURCE_MALFORMED_RECORD'),
  ).toBe(true);
  const page = await captureActivity({
    ...options('claude-code:' + id),
    maxRecords: 1,
  });
  expect(page.sourceRead.coverage.fullSource).toBe(false);
  expect(page.sourceRead.nextCursor).toBeTypeOf('string');
  const next = await captureActivity({
    ...options('claude-code:' + id),
    cursor: page.sourceRead.nextCursor!,
  });
  expect(next.sourceRead.records[0]).toMatchObject({
    sourceOrdinal: 1,
    recordIndex: 1,
    physicalLine: 2,
  });
  expect(next.sourceRead.coverage.reasons).toContain('prefix-not-read');
});
it('uses Cursor frame calls with explicit missing results/usage rather than invented fidelity', async () => {
  writeCursorTranscript(temp.home, {
    id,
    cwd: temp.home,
    records: [cursorToolUse('Shell', { command: long }), cursorTurnEnded()],
  });
  const capture = await captureActivity(options('cursor:' + id));
  expect(capture.support).toMatchObject({
    results: 'not-recorded',
    usage: 'not-recorded',
  });
  expect(capture.events.find((e) => e.kind === 'call')).toMatchObject({
    arguments: { command: long },
    outcome: 'unknown',
    locator: { sourceFrameIndex: 0, deliveryFrameIndex: 1, physicalLine: 1 },
  });
  expect(capture.sourceRead.records[0].frameIndex).toBe(0);
  expect(capture.coverage).toContainEqual({
    dataClass: 'results',
    status: 'not-recorded',
    captured: 0,
  });
});
it('returns the same sensitive evidence through the built CLI and exclusive JSON artifact', () => {
  codex();
  const response = cli(['--session', 'codex:' + id]);
  expect(response.status).toBe(0);
  expect(response.stderr).toBe('');
  expect(
    JSON.parse(response.stdout).data.events.find(
      (e: { kind: string }) => e.kind === 'result',
    ).result,
  ).toBe(long);
  const out = join(temp.root, 'activity.json');
  expect(cli(['--session', 'codex:' + id, '--out', out]).status).toBe(0);
  expect(
    JSON.parse(readFileSync(out, 'utf8')).sourceRead.coverage.fullSource,
  ).toBe(true);
  expect(cli(['--session', 'codex:' + id, '--out', out]).status).toBe(2);
});
