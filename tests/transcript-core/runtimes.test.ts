/**
 * runtimes.test.ts — Unit tests for the canonical transcript runtime source.
 *
 * Tests are organized around the five public exports:
 *   discoverPaths, encodeCwd, extractMeta, readRecords, normalizeEntries
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  JsonObject,
  Runtime,
} from '../../src/transcript/core/runtimes.js';
import {
  discoverPaths,
  encodeCwd,
  encodeCwdVariants,
  extractMeta,
  normalizeEntries,
  readRecords,
} from '../../src/transcript/core/runtimes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixtures remain in tests/session-observer/fixtures (shared with the
// session-observer suite); reference them from the relocated location.
const FIXTURES_CC = join(__dirname, '../session-observer/fixtures/claude-code');
const FIXTURES_CX = join(__dirname, '../session-observer/fixtures/codex');
const FIXTURES_CURSOR = join(__dirname, '../session-observer/fixtures/cursor');

function expectEqual<T>(actual: T, expected: T, message?: string) {
  expect(actual, message).toBe(expected);
}

function expectDeepEqual(actual: unknown, expected: unknown, message?: string) {
  expect(actual, message).toEqual(expected);
}

function expectOk(actual: unknown, message?: string): asserts actual {
  expect(actual, message).toBeTruthy();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixturePath(runtime: Runtime, name: string): string {
  if (runtime === 'claude-code') return join(FIXTURES_CC, name);
  if (runtime === 'codex') return join(FIXTURES_CX, name);
  if (runtime === 'cursor') return join(FIXTURES_CURSOR, name);
  throw new Error(`Unknown fixture runtime: ${runtime}`);
}

// ---------------------------------------------------------------------------
// readRecords
// ---------------------------------------------------------------------------

describe('readRecords', () => {
  it('typical.jsonl — returns expected count and parsed objects (claude-code)', async () => {
    const records = await readRecords(
      fixturePath('claude-code', 'typical.jsonl'),
    );
    // 13 lines in the fixture
    expectEqual(records.length, 13);
    expectEqual(typeof records[0], 'object');
    expectEqual(records[0].sessionId, 'cc-session-001');
  });

  it('typical.jsonl — returns expected count and parsed objects (codex)', async () => {
    const records = await readRecords(fixturePath('codex', 'typical.jsonl'));
    // 13 lines in the fixture
    expectEqual(records.length, 13);
    expectEqual(typeof records[0], 'object');
  });

  it('typical.jsonl — returns expected count and parsed objects (cursor)', async () => {
    const records = await readRecords(fixturePath('cursor', 'typical.jsonl'));
    expectEqual(records.length, 4);
    expectEqual(typeof records[0], 'object');
    expectEqual(records[0].role, 'user');
  });

  it('malformed.jsonl — returns valid records, warns, does not throw (claude-code)', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(
        fixturePath('claude-code', 'malformed.jsonl'),
      );
      // 5 valid JSON lines + 1 non-JSON → 5 records returned
      expectEqual(records.length, 5);
      expectOk(warnings.length > 0, 'expected a console.warn for the bad line');
    } finally {
      console.warn = origWarn;
    }
  });

  it('malformed.jsonl — returns valid records, warns, does not throw (codex)', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(
        fixturePath('codex', 'malformed.jsonl'),
      );
      expectEqual(records.length, 5);
      expectOk(warnings.length > 0, 'expected a console.warn for the bad line');
    } finally {
      console.warn = origWarn;
    }
  });

  it('malformed.jsonl — returns valid records, warns, does not throw (cursor)', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(
        fixturePath('cursor', 'malformed.jsonl'),
      );
      expectEqual(records.length, 4);
      expectOk(warnings.length > 0, 'expected a console.warn for the bad line');
    } finally {
      console.warn = origWarn;
    }
  });

  it('partial-tail.jsonl — drops the partial last line with a warning (claude-code)', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(
        fixturePath('claude-code', 'partial-tail.jsonl'),
      );
      // 4 good lines + 1 partial → 4 records returned
      expectEqual(records.length, 4);
      expectOk(
        warnings.length > 0,
        'expected a console.warn for the partial tail',
      );
    } finally {
      console.warn = origWarn;
    }
  });

  it('partial-tail.jsonl — drops the partial last line with a warning (codex)', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(
        fixturePath('codex', 'partial-tail.jsonl'),
      );
      expectEqual(records.length, 4);
      expectOk(
        warnings.length > 0,
        'expected a console.warn for the partial tail',
      );
    } finally {
      console.warn = origWarn;
    }
  });

  it('partial-tail.jsonl — drops the partial last line with a warning (cursor)', async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(
        fixturePath('cursor', 'partial-tail.jsonl'),
      );
      expectEqual(records.length, 4);
      expectOk(
        warnings.length > 0,
        'expected a console.warn for the partial tail',
      );
    } finally {
      console.warn = origWarn;
    }
  });

  it('empty.jsonl — returns empty array', async () => {
    const records = await readRecords(
      fixturePath('claude-code', 'empty.jsonl'),
    );
    expectDeepEqual(records, []);
  });
});

// ---------------------------------------------------------------------------
// encodeCwd
// ---------------------------------------------------------------------------

describe('encodeCwd', () => {
  it('claude-code: encodes absolute path by replacing / and . with -', () => {
    const encoded = encodeCwd('claude-code', '/Users/x/Code/y');
    expectEqual(encoded, '-Users-x-Code-y');
  });

  it('claude-code: matches observed dot-sanitized project dirs', () => {
    const encoded = encodeCwd(
      'claude-code',
      '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5',
    );
    expectEqual(
      encoded,
      '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
    );
  });

  it('claude-code: exposes dot-sanitized and slash-only variants', () => {
    const variants = encodeCwdVariants(
      'claude-code',
      '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5',
    );
    expectDeepEqual(variants, [
      '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
      '-Users-thomas.stang-.superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
    ]);
  });

  it('codex: returns null (no path encoding)', () => {
    const encoded = encodeCwd('codex', '/Users/x/Code/y');
    expectEqual(encoded, null);
  });

  it('cursor: encodes absolute path by joining slash and dot separated segments', () => {
    const encoded = encodeCwd('cursor', '/Users/thomas.stang/Code/vox/duet');
    expectEqual(encoded, 'Users-thomas-stang-Code-vox-duet');
  });

  it('cursor: exposes the observed project slug variant', () => {
    const variants = encodeCwdVariants(
      'cursor',
      '/Users/thomas.stang/Code/vox/duet',
    );
    expectDeepEqual(variants, ['Users-thomas-stang-Code-vox-duet']);
  });
});

// ---------------------------------------------------------------------------
// extractMeta
// ---------------------------------------------------------------------------

describe('extractMeta (claude-code)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'runtimes-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns sessionId from the first record with a sessionId field', async () => {
    // Use the typical fixture directly — it has sessionId in record[0]
    const meta = await extractMeta(
      'claude-code',
      fixturePath('claude-code', 'typical.jsonl'),
    );
    expectOk(meta !== null, 'meta should not be null');
    expectEqual(meta.sessionId, 'cc-session-001');
  });

  it('returns recordedCwd decoded from the parent-directory name', async () => {
    // Claude Code encodes cwd as the dir name: /Users/x/Code/y → -Users-x-Code-y
    // We create a temp file inside a dir whose name encodes a cwd.
    // Use a path with no hyphens in segment names to avoid ambiguity in decoding.
    const encodedCwd = '-Users-testuser-Code-myproject';
    const sessionDir = join(tmpDir, encodedCwd);
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session.jsonl');
    // Write a single record with a sessionId
    await writeFile(
      transcriptPath,
      JSON.stringify({ sessionId: 'cc-test-session', type: 'summary' }) + '\n',
      'utf8',
    );

    const meta = await extractMeta('claude-code', transcriptPath);
    expectOk(meta !== null);
    expectEqual(meta.sessionId, 'cc-test-session');
    // Decoded cwd: '-Users-testuser-Code-myproject' → '/Users/testuser/Code/myproject'
    expectEqual(meta.recordedCwd, '/Users/testuser/Code/myproject');
  });

  it('returns recordedCwd as null when dir name has no leading dash (not encoded)', async () => {
    // A file not in an encoded dir (e.g., direct temp dir)
    const transcriptPath = join(tmpDir, 'plain-session.jsonl');
    await writeFile(
      transcriptPath,
      JSON.stringify({ sessionId: 'cc-plain', type: 'summary' }) + '\n',
      'utf8',
    );

    const meta = await extractMeta('claude-code', transcriptPath);
    // The parent dir name does not start with '-', so cwd is not decodeable
    // We accept null or an undefined-like value
    expectOk(meta !== null);
    expectEqual(meta.sessionId, 'cc-plain');
    // recordedCwd should be null when the dir name doesn't encode a cwd
    expectEqual(meta.recordedCwd, null);
  });
});

describe('extractMeta (codex)', () => {
  it('extracts sessionId and cwd from session-meta record (typical)', async () => {
    const meta = await extractMeta(
      'codex',
      fixturePath('codex', 'typical.jsonl'),
    );
    expectOk(meta !== null);
    expectEqual(meta.sessionId, 'codex-session-001');
    expectEqual(meta.recordedCwd, '/Users/testuser/Code/my-project');
  });

  it('no-cwd-record: returns sessionId with recordedCwd null', async () => {
    const meta = await extractMeta(
      'codex',
      fixturePath('codex', 'no-cwd-record.jsonl'),
    );
    expectOk(meta !== null);
    expectEqual(meta.sessionId, 'codex-session-003');
    expectEqual(meta.recordedCwd, null);
  });

  it('payload-cwd: extracts recordedCwd from payload.cwd when top-level cwd is absent', async () => {
    const meta = await extractMeta(
      'codex',
      fixturePath('codex', 'payload-cwd.jsonl'),
    );
    expectOk(meta !== null, 'meta should not be null');
    expectEqual(meta.sessionId, 'codex-payload-cwd-001');
    expectEqual(meta.recordedCwd, '/Users/testuser/Code/payload-project');
  });
});

describe('extractMeta (cursor)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'runtimes-cursor-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns sessionId from transcript basename', async () => {
    const meta = await extractMeta(
      'cursor',
      fixturePath('cursor', 'typical.jsonl'),
    );
    expectOk(meta !== null);
    expectEqual(meta.sessionId, 'typical');
    expectEqual(meta.recordedCwd, null);
  });

  it('returns sessionId from parent transcript directory for generic transcript files', async () => {
    const sessionDir = join(tmpDir, 'cursor-session-001');
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'transcript.jsonl');
    await writeFile(
      transcriptPath,
      JSON.stringify({
        role: 'user',
        message: { content: [{ type: 'text', text: 'Hello' }] },
      }) + '\n',
      'utf8',
    );

    const meta = await extractMeta('cursor', transcriptPath);
    expectOk(meta !== null);
    expectEqual(meta.sessionId, 'cursor-session-001');
    expectEqual(meta.recordedCwd, null);
  });
});

// ---------------------------------------------------------------------------
// normalizeEntries (claude-code)
// ---------------------------------------------------------------------------

describe('normalizeEntries (claude-code)', () => {
  let records: JsonObject[];

  beforeAll(async () => {
    records = await readRecords(fixturePath('claude-code', 'typical.jsonl'));
  });

  it('default (no tools): returns only message-kind entries', () => {
    const entries = normalizeEntries('claude-code', records, {
      includeToolCalls: false,
      includeToolResults: false,
    });
    expectOk(entries.length > 0, 'should have entries');
    // All entries should be message kind
    for (const e of entries) {
      expectEqual(e.kind, 'message', `expected kind=message, got ${e.kind}`);
      expectOk(
        e.role === 'user' || e.role === 'assistant',
        `unexpected role: ${e.role}`,
      );
      expectOk(typeof e.text === 'string');
      expectOk(typeof e.recordIndex === 'number');
    }
    // Should not include tool_use or tool_result entries
    const toolEntries = entries.filter((e) => e.kind !== 'message');
    expectEqual(toolEntries.length, 0);
  });

  it('includeToolCalls: true — includes [ToolName] args entries (truncated to 200)', () => {
    const entries = normalizeEntries('claude-code', records, {
      includeToolCalls: true,
      includeToolResults: false,
    });
    const toolCallEntries = entries.filter((e) => e.kind === 'tool_call');
    expectOk(
      toolCallEntries.length > 0,
      'should have at least one tool_call entry',
    );
    for (const e of toolCallEntries) {
      // Must match spec: [ToolName] args — no "Tool: " prefix
      expectOk(
        /^\[[^\]]+\] /.test(e.text),
        `tool_call text must match [ToolName] args, got: ${e.text}`,
      );
      expectOk(
        !e.text.startsWith('[Tool: '),
        `tool_call text must not have "Tool: " prefix, got: ${e.text}`,
      );
      expectOk(
        typeof e.toolName === 'string' && e.toolName.length > 0,
        `toolName must be set on tool_call entry`,
      );
      // Args should be truncated at 200 chars
      expectOk(e.text.length <= 300, 'text should not be excessively long'); // brackets + name + args
    }
  });

  it('includeToolCalls: true, includeToolResults: true — includes [ToolName → result] entries with toolName set', () => {
    const entries = normalizeEntries('claude-code', records, {
      includeToolCalls: true,
      includeToolResults: true,
    });
    const toolResultEntries = entries.filter((e) => e.kind === 'tool_result');
    expectOk(
      toolResultEntries.length > 0,
      'should have at least one tool_result entry',
    );
    for (const e of toolResultEntries) {
      // Must match spec: [ToolName → result] output — with the tool name, not bare [Tool → result]
      expectOk(
        /^\[[^\]]+\s→\s+result\]/.test(e.text),
        `tool_result text must match [ToolName → result] output, got: ${e.text}`,
      );
      expectOk(
        !e.text.startsWith('[Tool →'),
        `tool_result text must not use bare "[Tool →", got: ${e.text}`,
      );
      // toolName must be set and match the name in the marker
      expectOk(
        typeof e.toolName === 'string' && e.toolName.length > 0,
        `toolName must be set on tool_result entry, got: ${e.toolName}`,
      );
      expectOk(
        e.text.startsWith(`[${e.toolName} →`),
        `text marker [${e.toolName} →] must match toolName field, got: ${e.text}`,
      );
    }
  });

  it('tool call args are truncated at 200 chars', async () => {
    // Create a record with a very long tool input
    const longInput = 'a'.repeat(300);
    const testRecord = {
      sessionId: 'cc-test',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'long_tool',
            name: 'EditFile',
            input: longInput,
          },
        ],
      },
    };
    const entries = normalizeEntries('claude-code', [testRecord], {
      includeToolCalls: true,
    });
    expectEqual(entries.length, 1);
    // The args portion should be truncated: 200 chars + '...' (3) = 203
    // The full text is `[EditFile] <truncated-args>`, so total can be up to ~220
    // Verify it ends with '...' when over limit
    expectOk(
      entries[0].text.endsWith('...'),
      `expected truncation, got: ${entries[0].text.slice(-10)}`,
    );
    // The args portion should not exceed 203 chars (200 + '...')
    const argsStart = entries[0].text.indexOf('] ') + 2;
    const argsStr = entries[0].text.slice(argsStart);
    expectOk(argsStr.length <= 203, `args too long: ${argsStr.length}`);
  });

  it('entries have recordIndex set to the record position in the array', () => {
    const entries = normalizeEntries('claude-code', records, {
      includeToolCalls: false,
    });
    // Entries should have monotonically non-decreasing recordIndex
    let prevIndex = -1;
    for (const e of entries) {
      expectOk(e.recordIndex >= 0);
      expectOk(e.recordIndex >= prevIndex);
      prevIndex = e.recordIndex;
    }
  });

  it('filters Claude slash-command message payloads by default', () => {
    const commandRecord = {
      sessionId: 'cc-command',
      message: {
        role: 'user',
        content:
          '<command-message>oat-project-open</command-message>\n<command-name>/oat-project-open</command-name>',
      },
    };
    const naturalRecord = {
      sessionId: 'cc-command',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Natural language response.' }],
      },
    };

    const entries = normalizeEntries(
      'claude-code',
      [commandRecord, naturalRecord],
      {},
    );

    expectEqual(entries.length, 1);
    expectEqual(entries[0].text, 'Natural language response.');
  });

  it('can include Claude slash-command message payloads for debugging', () => {
    const commandRecord = {
      sessionId: 'cc-command',
      message: {
        role: 'user',
        content:
          '<command-message>oat-project-open</command-message>\n<command-name>/oat-project-open</command-name>',
      },
    };

    const entries = normalizeEntries('claude-code', [commandRecord], {
      includeCommandMessages: true,
    });

    expectEqual(entries.length, 1);
    expectEqual(entries[0].kind, 'command_message');
    expectOk(entries[0].text.includes('<command-message>'));
  });

  it('with-tool-burst: multiple tool calls all included', async () => {
    const burstRecords = await readRecords(
      fixturePath('claude-code', 'with-tool-burst.jsonl'),
    );
    const entries = normalizeEntries('claude-code', burstRecords, {
      includeToolCalls: true,
      includeToolResults: true,
    });
    const toolCallEntries = entries.filter((e) => e.kind === 'tool_call');
    // 3 tool_use blocks in the fixture
    expectOk(toolCallEntries.length >= 3);
  });

  it('preserves repeated attachment-only queued input after suppressing one matching delivery', async () => {
    const repeatedQueuedRecords = await readRecords(
      fixturePath('claude-code', 'queued-repeated-input.jsonl'),
    );

    const entries = normalizeEntries('claude-code', repeatedQueuedRecords, {});
    const queuedEntries = entries.filter(
      (entry) => entry.displayRole === 'queued-user',
    );

    expect(queuedEntries).toEqual([
      expect.objectContaining({
        text: 'Keep the conservative migration path.',
        recordIndex: 0,
      }),
      expect.objectContaining({
        text: 'Keep the conservative migration path.',
        recordIndex: 3,
      }),
      expect.objectContaining({
        text: 'Keep the conservative migration path.',
        recordIndex: 4,
      }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// normalizeEntries (codex)
// ---------------------------------------------------------------------------

describe('normalizeEntries (codex)', () => {
  let records: JsonObject[];
  let withFcRecords: JsonObject[];

  beforeAll(async () => {
    records = await readRecords(fixturePath('codex', 'typical.jsonl'));
    withFcRecords = await readRecords(
      fixturePath('codex', 'with-function-calls.jsonl'),
    );
  });

  it('default (no tools): returns only message-kind entries, no function_calls', () => {
    const entries = normalizeEntries('codex', records, {
      includeToolCalls: false,
      includeToolResults: false,
    });
    expectOk(entries.length > 0, 'should have entries');
    for (const e of entries) {
      expectEqual(e.kind, 'message');
    }
    // function_calls should be excluded
    expectEqual(entries.filter((e) => e.kind !== 'message').length, 0);
  });

  it('includeToolCalls: true — function_call records produce tool_call entries with [ToolName] format', () => {
    const entries = normalizeEntries('codex', withFcRecords, {
      includeToolCalls: true,
      includeToolResults: false,
    });
    const toolCallEntries = entries.filter((e) => e.kind === 'tool_call');
    expectOk(
      toolCallEntries.length > 0,
      'should have tool_call entries from function_calls',
    );
    for (const e of toolCallEntries) {
      // Must match spec: [ToolName] args — no "Tool: " prefix
      expectOk(
        /^\[[^\]]+\] /.test(e.text),
        `tool_call text must match [ToolName] args, got: ${e.text}`,
      );
      expectOk(
        !e.text.startsWith('[Tool: '),
        `tool_call text must not have "Tool: " prefix, got: ${e.text}`,
      );
      expectOk(
        typeof e.toolName === 'string' && e.toolName.length > 0,
        `toolName must be set on tool_call entry`,
      );
    }
  });

  it('function_call args are truncated at 200 chars', () => {
    const longArgs = 'b'.repeat(300);
    const testRecord = {
      type: 'response_item',
      sessionId: 'codex-test',
      payload: {
        type: 'function_call',
        name: 'shell',
        arguments: longArgs,
      },
    };
    const entries = normalizeEntries('codex', [testRecord], {
      includeToolCalls: true,
    });
    expectEqual(entries.length, 1);
    expectEqual(entries[0].kind, 'tool_call');
    expectOk(
      entries[0].text.endsWith('...'),
      `expected truncation, got: ${entries[0].text.slice(-10)}`,
    );
    const argsStart = entries[0].text.indexOf('] ') + 2;
    const argsStr = entries[0].text.slice(argsStart);
    expectOk(argsStr.length <= 203, `args too long: ${argsStr.length}`);
  });

  it('entries have recordIndex set correctly', () => {
    const entries = normalizeEntries('codex', records, {
      includeToolCalls: false,
    });
    let prevIndex = -1;
    for (const e of entries) {
      expectOk(e.recordIndex >= 0);
      expectOk(e.recordIndex >= prevIndex);
      prevIndex = e.recordIndex;
    }
  });

  it('no-cwd-record: normalizeEntries still works (no session-meta required)', async () => {
    const noCwdRecords = await readRecords(
      fixturePath('codex', 'no-cwd-record.jsonl'),
    );
    const entries = normalizeEntries('codex', noCwdRecords, {
      includeToolCalls: false,
    });
    expectOk(entries.length > 0);
  });
});

// ---------------------------------------------------------------------------
// normalizeEntries (cursor)
// ---------------------------------------------------------------------------

describe('normalizeEntries (cursor)', () => {
  let records: JsonObject[];
  let withToolUseRecords: JsonObject[];

  beforeAll(async () => {
    records = await readRecords(fixturePath('cursor', 'typical.jsonl'));
    withToolUseRecords = await readRecords(
      fixturePath('cursor', 'with-tool-use.jsonl'),
    );
  });

  it('default (no tools): returns only message-kind entries', () => {
    const entries = normalizeEntries('cursor', records, {
      includeToolCalls: false,
    });
    expectEqual(entries.length, 2);
    for (const e of entries) {
      expectEqual(e.kind, 'message');
      expectOk(e.role === 'user' || e.role === 'assistant');
      expectOk(typeof e.text === 'string');
      expectOk(typeof e.recordIndex === 'number');
    }
  });

  it('default (no tools): excludes tool_use blocks', () => {
    const entries = normalizeEntries('cursor', withToolUseRecords, {
      includeToolCalls: false,
    });
    expectEqual(entries.filter((e) => e.kind === 'tool_call').length, 0);
    expectDeepEqual(
      entries.map((e) => e.text),
      ['Please read the runtime adapter.', 'I will open the file.'],
    );
  });

  it('includeToolCalls: true — tool_use blocks produce compact tool_call entries', () => {
    const entries = normalizeEntries('cursor', withToolUseRecords, {
      includeToolCalls: true,
    });
    const toolCallEntries = entries.filter((e) => e.kind === 'tool_call');
    expectEqual(toolCallEntries.length, 1);
    expectEqual(toolCallEntries[0].toolName, 'read_file');
    expectOk(
      toolCallEntries[0].text.startsWith('[read_file] '),
      `tool_call text must match [ToolName] args, got: ${toolCallEntries[0].text}`,
    );
    expectOk(toolCallEntries[0].text.includes('runtimes.mjs'));
  });

  it('buffers provisional activity and emits one final response on success', async () => {
    const terminalRecords = await readRecords(
      fixturePath('cursor', 'terminal-success.jsonl'),
    );
    const entries = normalizeEntries('cursor', terminalRecords, {
      includeToolCalls: false,
    });

    expectDeepEqual(
      entries.map((entry) => [
        entry.role,
        entry.text,
        entry.recordIndex,
        entry.sourceRecordIndex,
      ]),
      [
        ['user', 'Implement the Cursor lifecycle.', 5, 0],
        ['assistant', 'The completed implementation is ready.', 5, 4],
      ],
    );
  });

  it('keeps completed tool activity available only when requested', async () => {
    const terminalRecords = await readRecords(
      fixturePath('cursor', 'terminal-success.jsonl'),
    );
    const entries = normalizeEntries('cursor', terminalRecords, {
      includeToolCalls: true,
    });

    expectDeepEqual(
      entries.map((entry) => [
        entry.kind,
        entry.recordIndex,
        entry.sourceRecordIndex,
      ]),
      [
        ['message', 5, 0],
        ['tool_call', 5, 2],
        ['message', 5, 4],
      ],
    );
  });

  for (const status of ['aborted', 'error', 'cancelled']) {
    it(`emits a diagnostic without provisional content for ${status}`, async () => {
      const terminalRecords = await readRecords(
        fixturePath('cursor', `terminal-${status}.jsonl`),
      );
      const entries = normalizeEntries('cursor', terminalRecords, {
        includeToolCalls: true,
      });

      expectEqual(entries.length, 2);
      expectEqual(entries[0].role, 'user');
      expectEqual(entries[0].recordIndex, 2);
      expectEqual(entries[0].sourceRecordIndex, 0);
      expectEqual(entries[1].origin, 'runtime-diagnostic');
      expectOk(entries[1].text.includes(status));
      expectOk(entries.every((entry) => !entry.text.includes('provisional')));
      expectEqual(
        entries.filter((entry) => entry.kind === 'tool_call').length,
        0,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// discoverPaths
// ---------------------------------------------------------------------------

describe('discoverPaths', () => {
  it('claude-code: returns array containing ~/.claude/projects/ path', () => {
    const paths = discoverPaths('claude-code');
    expectOk(Array.isArray(paths));
    expectOk(paths.length > 0);
    expectOk(
      paths[0].includes('.claude/projects'),
      `expected .claude/projects in path, got: ${paths[0]}`,
    );
  });

  it('codex: returns array containing ~/.codex/sessions/ path', () => {
    const paths = discoverPaths('codex');
    expectOk(Array.isArray(paths));
    expectOk(paths.length > 0);
    expectOk(
      paths[0].includes('.codex/sessions'),
      `expected .codex/sessions in path, got: ${paths[0]}`,
    );
  });

  it('cursor: returns array containing ~/.cursor/projects/ path', () => {
    const paths = discoverPaths('cursor');
    expectOk(Array.isArray(paths));
    expectOk(paths.length > 0);
    expectOk(
      paths[0].includes('.cursor/projects'),
      `expected .cursor/projects in path, got: ${paths[0]}`,
    );
  });
});
