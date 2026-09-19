// Synthetic privacy canaries for inventory.mjs. Run: node --test inventory.canary.test.mjs
// Every string containing "canary" below is a stand-in for private data and must never
// reach the report, whether it is a value, a key, a discriminator, or a tool name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'inventory.mjs');

function run(files, extraArgs) {
  const res = spawnSync('node', [script, ...extraArgs], { input: files.join('\n'), encoding: 'utf8' });
  return res;
}

function writeCorpusFile(dir, name, records) {
  const file = join(dir, name);
  writeFileSync(file, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  return file;
}

function resultGroup(report) {
  return report.groups.find((group) => group.discriminator === 'user | message.role=user');
}

function corpus(dir) {
  const files = [];
  for (let i = 0; i < 5; i++) {
    const records = [
      { type: 'session_meta', payload: { id: 'canary-session-id', cli_version: 'canaryversion', originator: 'canary_originator', cwd: '/Users/canary/secret-project' } },
      { type: 'canary_record_type', payload: { type: 'canary_payload_type' } },
      { type: 'response_item', payload: { type: 'function_call', name: 'CanaryPrivateTool', call_id: 'c1', arguments: JSON.stringify({ canary_arg_key: 'canary arg value', command: 'echo canary' }) } },
      { type: 'response_item', payload: { type: 'function_call', name: 'mcp__canaryserver__canarytool', namespace: 'canary_ns', call_id: 'c2', arguments: JSON.stringify({ canary_mcp_param: 1 }) } },
      { type: 'response_item', payload: { type: 'function_call_output', call_id: 'c1', output: JSON.stringify({ canary_output_key: 'canary output' }) } },
      { type: 'assistant', message: { role: 'assistant', model: 'canary-model', content: [
        { type: 'tool_use', id: 't1', name: 'CanaryTool', input: { canary_repeated_key: 'x', file_path: '/Users/canary/file' } },
        { type: 'canary_block_type', text: 'canary text' },
        { type: 'text', text: 'line separator   paragraph separator   carriage \r inside canary text' },
      ] } },
      { type: 'user', toolUseResult: { structuredContent: { canary_structured: true }, stdout: 'canary stdout' },
        snapshot: { trackedFileBackups: { '/Users/canary/tracked.txt': { version: 1 } } },
        env: { CANARY_SECRET_NAME: 'canary-secret' } },
    ];
    const file = join(dir, `canary-file-${i}.jsonl`);
    writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
    files.push(file);
  }
  return files;
}

test('no canary reaches an allowlisted report, and LF-only splitting parses every record', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inventory-canary-'));
  try {
    const files = corpus(dir);
    const res = run(files, ['--allowlist', join(here, 'reviewed-vocabulary.json')]);
    assert.equal(res.status, 0, res.stderr);
    assert.doesNotMatch(res.stdout, /canary/i);
    assert.doesNotMatch(res.stdout, /\/Users\//);
    const report = JSON.parse(res.stdout);
    assert.equal(report.diagnostics.malformed, 0);
    assert.equal(report.diagnostics.lines, 35);
    assert.match(report.review, /allowlist applied/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('refuses to run without an explicit mode, and discover output is labelled unreviewed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inventory-canary-'));
  try {
    const files = corpus(dir);
    assert.equal(run(files, []).status, 2);
    const res = run(files, ['--discover']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(JSON.parse(res.stdout).review, /UNREVIEWED/);
    // Even unreviewed output never carries values outside enum paths, paths, or third-party shapes.
    assert.doesNotMatch(res.stdout, /canary arg value|canary output|canary stdout|canary text|canary-secret|\/Users\/|canary_mcp_param|canary_output_key|canary_structured|CANARY_SECRET_NAME/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('exact file-local MCP matches keep detached results opaque in both report modes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inventory-canary-'));
  try {
    const file = writeCorpusFile(dir, 'matched-mcp.jsonl', [
      { type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'mcp-call-1', name: 'mcp__canaryserver__canarytool', input: { canary_mcp_param: true } },
      ] } },
      { type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'mcp-call-1', content: 'canary matched result' },
      ] }, toolUseResult: { stdout: 'canary detached stdout', structuredContent: { type: 'canary_private_shape' } } },
    ]);
    for (const mode of [
      ['--allowlist', join(here, 'reviewed-vocabulary.json'), '--min-files', '1'],
      ['--discover', '--min-files', '1'],
    ]) {
      const res = run([file], mode);
      assert.equal(res.status, 0, res.stderr);
      const report = JSON.parse(res.stdout);
      const group = resultGroup(report);
      const carrier = group?.paths['$.toolUseResult'];
      assert.equal(report.diagnostics.lines, 2);
      assert.equal(group?.count, 1);
      assert.equal(carrier?.count, 1);
      assert.equal(carrier?.types['object(third-party, not described)'], 1);
      assert.deepEqual(Object.keys(group.paths).filter((path) => path.startsWith('$.toolUseResult.')), []);
      assert.doesNotMatch(res.stdout, /canary detached stdout|canary_private_shape/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a cross-file result remains unmatched, traversed, and counted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inventory-canary-'));
  try {
    const callFile = writeCorpusFile(dir, 'mcp-call.jsonl', [
      { type: 'assistant', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'mcp-call-cross-file', name: 'mcp__canaryserver__canarytool', input: { canary_mcp_param: true } },
      ] } },
    ]);
    const resultFile = writeCorpusFile(dir, 'mcp-result.jsonl', [
      { type: 'user', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'mcp-call-cross-file', content: 'canary unmatched result' },
      ] }, toolUseResult: { stdout: 'canary ordinary stdout' } },
    ]);
    for (const mode of [
      ['--allowlist', join(here, 'reviewed-vocabulary.json'), '--min-files', '1'],
      ['--discover', '--min-files', '1'],
    ]) {
      const res = run([callFile, resultFile], mode);
      assert.equal(res.status, 0, res.stderr);
      const report = JSON.parse(res.stdout);
      const group = resultGroup(report);
      assert.equal(report.diagnostics.lines, 2);
      assert.equal(group?.count, 1);
      assert.ok(group.paths['$.toolUseResult.stdout']);
      assert.doesNotMatch(res.stdout, /canary ordinary stdout/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
