/**
 * runtimes.test.mjs — Unit tests for scripts/lib/runtimes.mjs
 *
 * Tests are organized around the five public exports:
 *   discoverPaths, encodeCwd, extractMeta, readRecords, normalizeEntries
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_CC = join(__dirname, 'fixtures/claude-code');
const FIXTURES_CX = join(__dirname, 'fixtures/codex');

// Import the module under test — will fail RED until runtimes.mjs exists
const {
  discoverPaths,
  encodeCwd,
  extractMeta,
  readRecords,
  normalizeEntries,
  encodeCwdVariants,
} = await import('../../skills/session-observer/scripts/lib/runtimes.mjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixturePath(runtime, name) {
  return runtime === 'claude-code'
    ? join(FIXTURES_CC, name)
    : join(FIXTURES_CX, name);
}

// ---------------------------------------------------------------------------
// readRecords
// ---------------------------------------------------------------------------

describe('readRecords', () => {
  it('typical.jsonl — returns expected count and parsed objects (claude-code)', async () => {
    const records = await readRecords(fixturePath('claude-code', 'typical.jsonl'));
    // 13 lines in the fixture
    assert.equal(records.length, 13);
    assert.equal(typeof records[0], 'object');
    assert.equal(records[0].sessionId, 'cc-session-001');
  });

  it('typical.jsonl — returns expected count and parsed objects (codex)', async () => {
    const records = await readRecords(fixturePath('codex', 'typical.jsonl'));
    // 13 lines in the fixture
    assert.equal(records.length, 13);
    assert.equal(typeof records[0], 'object');
  });

  it('malformed.jsonl — returns valid records, warns, does not throw (claude-code)', async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(fixturePath('claude-code', 'malformed.jsonl'));
      // 5 valid JSON lines + 1 non-JSON → 5 records returned
      assert.equal(records.length, 5);
      assert.ok(warnings.length > 0, 'expected a console.warn for the bad line');
    } finally {
      console.warn = origWarn;
    }
  });

  it('malformed.jsonl — returns valid records, warns, does not throw (codex)', async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(fixturePath('codex', 'malformed.jsonl'));
      assert.equal(records.length, 5);
      assert.ok(warnings.length > 0, 'expected a console.warn for the bad line');
    } finally {
      console.warn = origWarn;
    }
  });

  it('partial-tail.jsonl — drops the partial last line with a warning (claude-code)', async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(fixturePath('claude-code', 'partial-tail.jsonl'));
      // 4 good lines + 1 partial → 4 records returned
      assert.equal(records.length, 4);
      assert.ok(warnings.length > 0, 'expected a console.warn for the partial tail');
    } finally {
      console.warn = origWarn;
    }
  });

  it('partial-tail.jsonl — drops the partial last line with a warning (codex)', async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const records = await readRecords(fixturePath('codex', 'partial-tail.jsonl'));
      assert.equal(records.length, 4);
      assert.ok(warnings.length > 0, 'expected a console.warn for the partial tail');
    } finally {
      console.warn = origWarn;
    }
  });

  it('empty.jsonl — returns empty array', async () => {
    const records = await readRecords(fixturePath('claude-code', 'empty.jsonl'));
    assert.deepEqual(records, []);
  });
});

// ---------------------------------------------------------------------------
// encodeCwd
// ---------------------------------------------------------------------------

describe('encodeCwd', () => {
  it('claude-code: encodes absolute path by replacing / and . with -', () => {
    const encoded = encodeCwd('claude-code', '/Users/x/Code/y');
    assert.equal(encoded, '-Users-x-Code-y');
  });

  it('claude-code: matches observed dot-sanitized project dirs', () => {
    const encoded = encodeCwd(
      'claude-code',
      '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5'
    );
    assert.equal(
      encoded,
      '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5'
    );
  });

  it('claude-code: exposes dot-sanitized and slash-only variants', () => {
    const variants = encodeCwdVariants(
      'claude-code',
      '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5'
    );
    assert.deepEqual(variants, [
      '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
      '-Users-thomas.stang-.superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
    ]);
  });

  it('codex: returns null (no path encoding)', () => {
    const encoded = encodeCwd('codex', '/Users/x/Code/y');
    assert.equal(encoded, null);
  });
});

// ---------------------------------------------------------------------------
// extractMeta
// ---------------------------------------------------------------------------

describe('extractMeta (claude-code)', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'runtimes-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns sessionId from the first record with a sessionId field', async () => {
    // Use the typical fixture directly — it has sessionId in record[0]
    const meta = await extractMeta('claude-code', fixturePath('claude-code', 'typical.jsonl'));
    assert.ok(meta !== null, 'meta should not be null');
    assert.equal(meta.sessionId, 'cc-session-001');
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
    await writeFile(transcriptPath, JSON.stringify({ sessionId: 'cc-test-session', type: 'summary' }) + '\n', 'utf8');

    const meta = await extractMeta('claude-code', transcriptPath);
    assert.ok(meta !== null);
    assert.equal(meta.sessionId, 'cc-test-session');
    // Decoded cwd: '-Users-testuser-Code-myproject' → '/Users/testuser/Code/myproject'
    assert.equal(meta.recordedCwd, '/Users/testuser/Code/myproject');
  });

  it('returns recordedCwd as null when dir name has no leading dash (not encoded)', async () => {
    // A file not in an encoded dir (e.g., direct temp dir)
    const transcriptPath = join(tmpDir, 'plain-session.jsonl');
    await writeFile(transcriptPath, JSON.stringify({ sessionId: 'cc-plain', type: 'summary' }) + '\n', 'utf8');

    const meta = await extractMeta('claude-code', transcriptPath);
    // The parent dir name does not start with '-', so cwd is not decodeable
    // We accept null or an undefined-like value
    assert.ok(meta !== null);
    assert.equal(meta.sessionId, 'cc-plain');
    // recordedCwd should be null when the dir name doesn't encode a cwd
    assert.equal(meta.recordedCwd, null);
  });
});

describe('extractMeta (codex)', () => {
  it('extracts sessionId and cwd from session-meta record (typical)', async () => {
    const meta = await extractMeta('codex', fixturePath('codex', 'typical.jsonl'));
    assert.ok(meta !== null);
    assert.equal(meta.sessionId, 'codex-session-001');
    assert.equal(meta.recordedCwd, '/Users/testuser/Code/my-project');
  });

  it('no-cwd-record: returns sessionId with recordedCwd null', async () => {
    const meta = await extractMeta('codex', fixturePath('codex', 'no-cwd-record.jsonl'));
    assert.ok(meta !== null);
    assert.equal(meta.sessionId, 'codex-session-003');
    assert.equal(meta.recordedCwd, null);
  });

  it('payload-cwd: extracts recordedCwd from payload.cwd when top-level cwd is absent', async () => {
    const meta = await extractMeta('codex', fixturePath('codex', 'payload-cwd.jsonl'));
    assert.ok(meta !== null, 'meta should not be null');
    assert.equal(meta.sessionId, 'codex-payload-cwd-001');
    assert.equal(meta.recordedCwd, '/Users/testuser/Code/payload-project');
  });
});

// ---------------------------------------------------------------------------
// normalizeEntries (claude-code)
// ---------------------------------------------------------------------------

describe('normalizeEntries (claude-code)', () => {
  let records;

  before(async () => {
    records = await readRecords(fixturePath('claude-code', 'typical.jsonl'));
  });

  it('default (no tools): returns only message-kind entries', () => {
    const entries = normalizeEntries('claude-code', records, { includeToolCalls: false, includeToolResults: false });
    assert.ok(entries.length > 0, 'should have entries');
    // All entries should be message kind
    for (const e of entries) {
      assert.equal(e.kind, 'message', `expected kind=message, got ${e.kind}`);
      assert.ok(e.role === 'user' || e.role === 'assistant', `unexpected role: ${e.role}`);
      assert.ok(typeof e.text === 'string');
      assert.ok(typeof e.recordIndex === 'number');
    }
    // Should not include tool_use or tool_result entries
    const toolEntries = entries.filter(e => e.kind !== 'message');
    assert.equal(toolEntries.length, 0);
  });

  it('includeToolCalls: true — includes [ToolName] args entries (truncated to 200)', () => {
    const entries = normalizeEntries('claude-code', records, { includeToolCalls: true, includeToolResults: false });
    const toolCallEntries = entries.filter(e => e.kind === 'tool_call');
    assert.ok(toolCallEntries.length > 0, 'should have at least one tool_call entry');
    for (const e of toolCallEntries) {
      // Must match spec: [ToolName] args — no "Tool: " prefix
      assert.ok(/^\[[^\]]+\] /.test(e.text), `tool_call text must match [ToolName] args, got: ${e.text}`);
      assert.ok(!e.text.startsWith('[Tool: '), `tool_call text must not have "Tool: " prefix, got: ${e.text}`);
      assert.ok(typeof e.toolName === 'string' && e.toolName.length > 0, `toolName must be set on tool_call entry`);
      // Args should be truncated at 200 chars
      assert.ok(e.text.length <= 300, 'text should not be excessively long'); // brackets + name + args
    }
  });

  it('includeToolCalls: true, includeToolResults: true — includes [ToolName → result] entries with toolName set', () => {
    const entries = normalizeEntries('claude-code', records, { includeToolCalls: true, includeToolResults: true });
    const toolResultEntries = entries.filter(e => e.kind === 'tool_result');
    assert.ok(toolResultEntries.length > 0, 'should have at least one tool_result entry');
    for (const e of toolResultEntries) {
      // Must match spec: [ToolName → result] output — with the tool name, not bare [Tool → result]
      assert.ok(/^\[[^\]]+\s→\s+result\]/.test(e.text), `tool_result text must match [ToolName → result] output, got: ${e.text}`);
      assert.ok(!e.text.startsWith('[Tool →'), `tool_result text must not use bare "[Tool →", got: ${e.text}`);
      // toolName must be set and match the name in the marker
      assert.ok(typeof e.toolName === 'string' && e.toolName.length > 0, `toolName must be set on tool_result entry, got: ${e.toolName}`);
      assert.ok(e.text.startsWith(`[${e.toolName} →`), `text marker [${e.toolName} →] must match toolName field, got: ${e.text}`);
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
          { type: 'tool_use', id: 'long_tool', name: 'EditFile', input: longInput },
        ],
      },
    };
    const entries = normalizeEntries('claude-code', [testRecord], { includeToolCalls: true });
    assert.equal(entries.length, 1);
    // The args portion should be truncated: 200 chars + '...' (3) = 203
    // The full text is `[EditFile] <truncated-args>`, so total can be up to ~220
    // Verify it ends with '...' when over limit
    assert.ok(entries[0].text.endsWith('...'), `expected truncation, got: ${entries[0].text.slice(-10)}`);
    // The args portion should not exceed 203 chars (200 + '...')
    const argsStart = entries[0].text.indexOf('] ') + 2;
    const argsStr = entries[0].text.slice(argsStart);
    assert.ok(argsStr.length <= 203, `args too long: ${argsStr.length}`);
  });

  it('entries have recordIndex set to the record position in the array', () => {
    const entries = normalizeEntries('claude-code', records, { includeToolCalls: false });
    // Entries should have monotonically non-decreasing recordIndex
    let prevIndex = -1;
    for (const e of entries) {
      assert.ok(e.recordIndex >= 0);
      assert.ok(e.recordIndex >= prevIndex);
      prevIndex = e.recordIndex;
    }
  });

  it('filters Claude slash-command message payloads by default', () => {
    const commandRecord = {
      sessionId: 'cc-command',
      message: {
        role: 'user',
        content: '<command-message>oat-project-open</command-message>\n<command-name>/oat-project-open</command-name>',
      },
    };
    const naturalRecord = {
      sessionId: 'cc-command',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Natural language response.' }],
      },
    };

    const entries = normalizeEntries('claude-code', [commandRecord, naturalRecord], {});

    assert.equal(entries.length, 1);
    assert.equal(entries[0].text, 'Natural language response.');
  });

  it('can include Claude slash-command message payloads for debugging', () => {
    const commandRecord = {
      sessionId: 'cc-command',
      message: {
        role: 'user',
        content: '<command-message>oat-project-open</command-message>\n<command-name>/oat-project-open</command-name>',
      },
    };

    const entries = normalizeEntries('claude-code', [commandRecord], { includeCommandMessages: true });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, 'command_message');
    assert.ok(entries[0].text.includes('<command-message>'));
  });

  it('with-tool-burst: multiple tool calls all included', async () => {
    const burstRecords = await readRecords(fixturePath('claude-code', 'with-tool-burst.jsonl'));
    const entries = normalizeEntries('claude-code', burstRecords, { includeToolCalls: true, includeToolResults: true });
    const toolCallEntries = entries.filter(e => e.kind === 'tool_call');
    // 3 tool_use blocks in the fixture
    assert.ok(toolCallEntries.length >= 3);
  });
});

// ---------------------------------------------------------------------------
// normalizeEntries (codex)
// ---------------------------------------------------------------------------

describe('normalizeEntries (codex)', () => {
  let records;
  let withFcRecords;

  before(async () => {
    records = await readRecords(fixturePath('codex', 'typical.jsonl'));
    withFcRecords = await readRecords(fixturePath('codex', 'with-function-calls.jsonl'));
  });

  it('default (no tools): returns only message-kind entries, no function_calls', () => {
    const entries = normalizeEntries('codex', records, { includeToolCalls: false, includeToolResults: false });
    assert.ok(entries.length > 0, 'should have entries');
    for (const e of entries) {
      assert.equal(e.kind, 'message');
    }
    // function_calls should be excluded
    assert.equal(entries.filter(e => e.kind !== 'message').length, 0);
  });

  it('includeToolCalls: true — function_call records produce tool_call entries with [ToolName] format', () => {
    const entries = normalizeEntries('codex', withFcRecords, { includeToolCalls: true, includeToolResults: false });
    const toolCallEntries = entries.filter(e => e.kind === 'tool_call');
    assert.ok(toolCallEntries.length > 0, 'should have tool_call entries from function_calls');
    for (const e of toolCallEntries) {
      // Must match spec: [ToolName] args — no "Tool: " prefix
      assert.ok(/^\[[^\]]+\] /.test(e.text), `tool_call text must match [ToolName] args, got: ${e.text}`);
      assert.ok(!e.text.startsWith('[Tool: '), `tool_call text must not have "Tool: " prefix, got: ${e.text}`);
      assert.ok(typeof e.toolName === 'string' && e.toolName.length > 0, `toolName must be set on tool_call entry`);
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
    const entries = normalizeEntries('codex', [testRecord], { includeToolCalls: true });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, 'tool_call');
    assert.ok(entries[0].text.endsWith('...'), `expected truncation, got: ${entries[0].text.slice(-10)}`);
    const argsStart = entries[0].text.indexOf('] ') + 2;
    const argsStr = entries[0].text.slice(argsStart);
    assert.ok(argsStr.length <= 203, `args too long: ${argsStr.length}`);
  });

  it('entries have recordIndex set correctly', () => {
    const entries = normalizeEntries('codex', records, { includeToolCalls: false });
    let prevIndex = -1;
    for (const e of entries) {
      assert.ok(e.recordIndex >= 0);
      assert.ok(e.recordIndex >= prevIndex);
      prevIndex = e.recordIndex;
    }
  });

  it('no-cwd-record: normalizeEntries still works (no session-meta required)', async () => {
    const noCwdRecords = await readRecords(fixturePath('codex', 'no-cwd-record.jsonl'));
    const entries = normalizeEntries('codex', noCwdRecords, { includeToolCalls: false });
    assert.ok(entries.length > 0);
  });
});

// ---------------------------------------------------------------------------
// discoverPaths
// ---------------------------------------------------------------------------

describe('discoverPaths', () => {
  it('claude-code: returns array containing ~/.claude/projects/ path', () => {
    const paths = discoverPaths('claude-code');
    assert.ok(Array.isArray(paths));
    assert.ok(paths.length > 0);
    assert.ok(paths[0].includes('.claude/projects'), `expected .claude/projects in path, got: ${paths[0]}`);
  });

  it('codex: returns array containing ~/.codex/sessions/ path', () => {
    const paths = discoverPaths('codex');
    assert.ok(Array.isArray(paths));
    assert.ok(paths.length > 0);
    assert.ok(paths[0].includes('.codex/sessions'), `expected .codex/sessions in path, got: ${paths[0]}`);
  });
});
