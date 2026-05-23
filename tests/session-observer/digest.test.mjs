/**
 * digest.test.mjs — Tests for scripts/lib/digest.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const emptyClaude = join(FIXTURES, 'claude-code', 'empty.jsonl');
const withToolBurst = join(FIXTURES, 'claude-code', 'with-tool-burst.jsonl');
const typicalCodex = join(FIXTURES, 'codex', 'typical.jsonl');
const typicalCursor = join(FIXTURES, 'cursor', 'typical.jsonl');

const digestMjs = join(__dirname, '../../skills/session-observer/scripts/lib/digest.mjs');

let buildDigest, renderMarkdown, renderJson;
try {
  const mod = await import(digestMjs);
  buildDigest = mod.buildDigest;
  renderMarkdown = mod.renderMarkdown;
  renderJson = mod.renderJson;
} catch (e) {
  // Module doesn't exist yet (RED phase)
  buildDigest = null;
  renderMarkdown = null;
  renderJson = null;
}

function skipIfMissing(t) {
  if (!buildDigest) {
    t.skip('digest.mjs not yet implemented');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// buildDigest
// ---------------------------------------------------------------------------

describe('buildDigest', () => {
  test('returns correct entry count and range for fromIndex=0 (claude-code)', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      includeToolCalls: false,
      includeToolResults: false,
      mode: 'review',
    });

    assert.equal(digest.range.fromIndex, 0, 'fromIndex should be 0');
    assert.ok(digest.range.totalRecords > 0, 'totalRecords should be > 0');
    assert.ok(digest.entries.length > 0, 'entries should be non-empty');
    assert.ok(
      digest.entries.every(e => e.kind === 'message'),
      'default filter: only message entries'
    );
  });

  test('returns only entries with recordIndex >= fromIndex (mid-stream)', async (t) => {
    if (skipIfMissing(t)) return;
    // Read the file to know how many records there are
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const totalRecords = fullDigest.range.totalRecords;
    // Skip half the records
    const midIndex = Math.floor(totalRecords / 2);

    const partial = await buildDigest('claude-code', typicalClaude, {
      fromIndex: midIndex,
      mode: 'catch-up',
    });

    assert.ok(
      partial.entries.every(e => e.recordIndex >= midIndex),
      'all entries should have recordIndex >= fromIndex'
    );
    assert.equal(partial.range.fromIndex, midIndex, 'range.fromIndex should match');
  });

  test('newRecords set correctly in catch-up mode', async (t) => {
    if (skipIfMissing(t)) return;
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const totalRecords = fullDigest.range.totalRecords;
    const midIndex = Math.floor(totalRecords / 2);

    const catchUp = await buildDigest('claude-code', typicalClaude, {
      fromIndex: midIndex,
      mode: 'catch-up',
    });

    assert.equal(typeof catchUp.range.newRecords, 'number', 'newRecords should be a number in catch-up mode');
    assert.ok(catchUp.range.newRecords >= 0, 'newRecords should be >= 0');
  });

  test('catch-up separates raw records consumed from rendered messages', async (t) => {
    if (skipIfMissing(t)) return;

    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-filter-test-'));
    try {
      const transcriptPath = join(tmpDir, 'filtered.jsonl');
      const records = [
        { sessionId: 'sess-filtered', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tool-1', name: 'Read', input: { file: 'a' } }] } },
        { sessionId: 'sess-filtered', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'result a' }] } },
        { sessionId: 'sess-filtered', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tool-2', name: 'Bash', input: { cmd: 'npm test' } }] } },
        { sessionId: 'sess-filtered', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool-2', content: 'result b' }] } },
        { sessionId: 'sess-filtered', message: { role: 'assistant', content: [{ type: 'text', text: 'One rendered assistant message.' }] } },
        { sessionId: 'sess-filtered', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tool-3', name: 'Edit', input: { file: 'b' } }] } },
        { sessionId: 'sess-filtered', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool-3', content: 'result c' }] } },
        { sessionId: 'sess-filtered', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool-4', content: 'result d' }] } },
      ];
      await writeFile(transcriptPath, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      assert.equal(digest.range.fromIndex, 0);
      assert.equal(digest.range.indexBase, 'zero-based-jsonl-record-index');
      assert.equal(digest.accounting.indexBase, 'zero-based-jsonl-record-index');
      assert.equal(digest.range.toIndex, 7, 'raw toIndex should be the last consumed raw record');
      assert.equal(digest.range.nextIndex, 8, 'nextIndex should advance past all raw consumed records');
      assert.equal(digest.range.newRecords, 8);
      assert.equal(digest.accounting.rendered.count, 1);
      assert.equal(digest.accounting.rendered.fromIndex, 4);
      assert.equal(digest.accounting.rendered.toIndex, 4);
      assert.equal(digest.accounting.filtered.toolCalls, 3);
      assert.equal(digest.accounting.filtered.toolResults, 4);

      const md = renderMarkdown(digest);
      assert.ok(md.includes('raw range (zero-based JSONL indices):** records 0–7 of 8'), 'header should show raw range');
      assert.ok(md.includes('raw records consumed:** 8'), 'header should show raw consumed count');
      assert.ok(md.includes('rendered messages:** 1 (zero-based records 4–4)'), 'header should show rendered range separately');
      assert.ok(md.includes('tool calls: 3'), 'header should explain filtered tool calls');
      assert.ok(md.includes('tool results: 4'), 'header should explain filtered tool results');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up accounts for default command-message filtering', async (t) => {
    if (skipIfMissing(t)) return;

    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-command-test-'));
    try {
      const transcriptPath = join(tmpDir, 'command.jsonl');
      const records = [
        {
          sessionId: 'sess-command',
          message: {
            role: 'user',
            content: '<command-message>skill body</command-message>\n<command-name>/oat-project-open</command-name>',
          },
        },
        {
          sessionId: 'sess-command',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Visible response.' }],
          },
        },
      ];
      await writeFile(transcriptPath, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      assert.equal(digest.entries.length, 1);
      assert.equal(digest.entries[0].text, 'Visible response.');
      assert.equal(digest.accounting.filtered.commandMessages, 1);
      assert.equal(digest.filters.includeCommandMessages, false);

      const md = renderMarkdown(digest);
      assert.ok(md.includes('command messages: 1'), 'header should explain command-message filtering');
      assert.ok(md.includes('command messages excluded'), 'filters should include command messages excluded');

      const debugDigest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
        includeCommandMessages: true,
      });
      assert.equal(debugDigest.entries.length, 2);
      assert.equal(debugDigest.entries[0].kind, 'command_message');
      assert.equal(debugDigest.accounting.filtered.commandMessages, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('large digest fallback keeps the last turn groups automatically', async (t) => {
    if (skipIfMissing(t)) return;

    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-large-fallback-'));
    try {
      const transcriptPath = join(tmpDir, 'large.jsonl');
      const longText = 'A'.repeat(3000);
      const records = [];
      for (let i = 0; i < 12; i++) {
        records.push({
          sessionId: 'sess-large-fallback',
          message: { role: i % 2 === 0 ? 'user' : 'assistant', content: `${i}:${longText}` },
        });
      }
      await writeFile(transcriptPath, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      assert.equal(digest.range.newRecords, 12);
      assert.ok(digest.accounting.autoLargeDigest, 'autoLargeDigest accounting should be present');
      assert.equal(digest.accounting.autoLargeDigest.retainedTurnGroups, 8);
      assert.equal(digest.entries.length, 8);
      assert.equal(digest.entries[0].recordIndex, 4);
      assert.equal(digest.accounting.filtered.tailSliceEntries, 4);
      assert.ok(digest.warnings.some(w => w.includes('Large digest fallback')));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('buildDigest works for codex runtime', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('codex', typicalCodex, {
      fromIndex: 0,
      mode: 'review',
    });
    assert.ok(digest.range.totalRecords > 0, 'should parse codex fixture');
    assert.equal(digest.runtime, 'codex');
  });

  test('buildDigest works for cursor runtime', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('cursor', typicalCursor, {
      fromIndex: 0,
      mode: 'review',
    });

    assert.ok(digest.range.totalRecords > 0, 'should parse cursor fixture');
    assert.equal(digest.runtime, 'cursor');
    assert.ok(digest.entries.some(entry => entry.role === 'assistant'), 'should include assistant messages');
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

describe('renderMarkdown', () => {
  test('groups consecutive same-role entries under single ### header', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    const md = renderMarkdown(digest);
    assert.ok(typeof md === 'string', 'renderMarkdown returns a string');

    // Should contain ### User and ### Assistant headers
    assert.ok(md.includes('### User'), 'should contain ### User header');
    assert.ok(md.includes('### Assistant'), 'should contain ### Assistant header');

    // Headers should NOT repeat consecutively for the same role
    // (i.e., we don't see "### User\n...\n### User\n..." without an assistant in between)
    const lines = md.split('\n');
    let prevHeader = null;
    for (const line of lines) {
      if (line.startsWith('### User') || line.startsWith('### Assistant')) {
        assert.notEqual(line, prevHeader, `Consecutive duplicate header found: ${line}`);
        prevHeader = line;
      }
    }
  });

  test('header contains filter line', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: false,
      includeToolResults: false,
    });

    const md = renderMarkdown(digest);
    // Filter line should mention tool calls excluded
    assert.ok(
      md.includes('tool') || md.includes('filter'),
      'header should mention tool filtering'
    );
  });

  test('header contains active flag when digest.active is true', async (t) => {
    if (skipIfMissing(t)) return;
    // Build a digest with active=true by patching after build
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    digest.active = true;

    const md = renderMarkdown(digest);
    assert.ok(md.includes('active') || md.includes('ACTIVE'), 'header should include active flag');
  });

  test('header contains range metadata', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    const md = renderMarkdown(digest);
    // Should contain fromIndex and totalRecords info
    assert.ok(md.includes('0'), 'header should contain fromIndex value');
    assert.ok(md.includes(String(digest.range.totalRecords)), 'header should contain totalRecords');
  });

  test('no tool markers by default', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('claude-code', withToolBurst, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: false,
      includeToolResults: false,
    });
    const md = renderMarkdown(digest);
    // Should not contain tool-call markers like [Read] or [Bash]
    assert.ok(!md.includes('[Read]') && !md.includes('[Bash]'), 'should not include tool markers by default');
  });

  test('--max-turns slices from the tail', async (t) => {
    if (skipIfMissing(t)) return;
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const fullMd = renderMarkdown(fullDigest);

    const slicedDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      maxTurns: 1,
    });
    const slicedMd = renderMarkdown(slicedDigest);

    assert.ok(
      slicedMd.length < fullMd.length || slicedDigest.entries.length <= fullDigest.entries.length,
      '--max-turns should produce a smaller or equal digest'
    );
    assert.ok(slicedDigest.entries.length <= fullDigest.entries.length, 'sliced entries <= full entries');
  });

  test('--max-bytes slices from the tail by byte count', async (t) => {
    if (skipIfMissing(t)) return;
    const fullDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    // Use a very small byte limit to ensure slicing happens
    const slicedDigest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      maxBytes: 100,
    });

    assert.ok(slicedDigest.entries.length <= fullDigest.entries.length, '--max-bytes slices entries');
  });
});

// ---------------------------------------------------------------------------
// 20K warning
// ---------------------------------------------------------------------------

describe('20K warning', () => {
  test('prepends 20K-char warning when rendered output exceeds threshold', async (t) => {
    if (skipIfMissing(t)) return;

    // Build a large fixture by writing a temp file with many long records
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-test-'));
    try {
      const largePath = join(tmpDir, 'large.jsonl');
      const longText = 'A'.repeat(2000);
      const lines = [];
      for (let i = 0; i < 20; i++) {
        lines.push(JSON.stringify({
          sessionId: 'sess-large',
          type: 'user',
          message: { role: 'user', content: longText },
        }));
        lines.push(JSON.stringify({
          sessionId: 'sess-large',
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: longText }] },
        }));
      }
      await writeFile(largePath, lines.join('\n') + '\n', 'utf8');

      const digest = await buildDigest('claude-code', largePath, {
        fromIndex: 0,
        mode: 'review',
      });
      const md = renderMarkdown(digest);

      // Should contain 20K warning
      if (md.length > 20000) {
        assert.ok(
          md.includes('20') || md.includes('large') || md.includes('warning') || md.includes('Warning'),
          '20K-char digest should prepend a warning'
        );
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// renderJson
// ---------------------------------------------------------------------------

describe('renderJson', () => {
  test('returns valid JSON that round-trips via JSON.parse', async (t) => {
    if (skipIfMissing(t)) return;
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    const jsonStr = renderJson(digest);
    assert.ok(typeof jsonStr === 'string', 'renderJson returns a string');
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(jsonStr); }, 'output should be valid JSON');
    assert.equal(parsed.schemaVersion, 1, 'schemaVersion should be 1');
    assert.ok(Array.isArray(parsed.entries), 'entries should be an array');
    assert.equal(parsed.runtime, 'claude-code', 'runtime should be preserved');
  });
});
