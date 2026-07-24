import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

// @ts-expect-error The validator is an authored Node CLI without declarations.
import * as cursorEvidence from '../../scripts/validate-cursor-evidence.mjs';

const {
  collectCursorEvidenceFiles,
  CURSOR_EVIDENCE_REFERENCE,
  scanCursorEvidenceText,
  validateCursorEvidence,
} = cursorEvidence;

const execFile = promisify(execFileCallback);
const temporaryRoots: string[] = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cursor-evidence-'));
  temporaryRoots.push(root);
  return root;
}

async function write(root: string, file: string, text: string) {
  const target = join(root, file);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, text);
}

async function git(root: string, ...args: string[]) {
  return execFile('git', args, { cwd: root });
}

function capabilityMatrix(row: string) {
  return [
    '## Measured capability matrix',
    '',
    '| Capability | Host | Provider | Version | Store | Path shape | Record shape | Identity | Action | Outcome | Evidence label |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    row,
    '',
    'Failure outcomes are retained as failures and never relabeled.',
    '',
  ].join('\n');
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe('Cursor evidence validation', () => {
  it('accepts the durable reference and synthetic framed fixtures', async () => {
    const repoRoot = new URL('../..', import.meta.url);
    const result = await validateCursorEvidence(repoRoot.pathname, {
      changedDocs: [],
    });

    expect(result.findings).toEqual([]);
    expect(result.files).toContain(CURSOR_EVIDENCE_REFERENCE);
    expect(result.files).toContain(
      'tests/session-observer/fixtures/cursor/framed-closed.jsonl',
    );
    expect(result.files).not.toContain(
      'tests/session-observer/fixtures/cursor/typical.jsonl',
    );

    const reference = await readFile(
      new URL(
        '../../skills/session-observer-collab/references/runtime-cursor.md',
        import.meta.url,
      ),
      'utf8',
    );
    expect(reference).toContain('`automated-only`');
    expect(reference).toContain('`documented-but-unvalidated`');
    expect(reference).toContain('`unavailable`');
    expect(reference).toContain('`live-validated`');
    expect(reference).not.toContain('`live-sanitized`');
    expect(reference).not.toContain('`measured-structural-only`');
    expect(reference).toMatch(
      /Failure outcomes are retained as\s+failures and never relabeled/iu,
    );
  });

  it.each([
    ['/Users/example/Code/private', 'personal-absolute-path'],
    ['/home/example/project', 'personal-absolute-path'],
    ['C:\\Users\\example\\project', 'personal-absolute-path'],
    ['session_id: session-actual-123', 'raw-identity'],
    ['lease_id="lease-actual-123"', 'raw-identity'],
    ['{"session_id":"actual-session-123"}', 'raw-identity'],
    ['{"conversationId":"actual-conversation-123"}', 'raw-identity'],
    ['"generation_id": "actual-generation-123"', 'raw-identity'],
    ['**lease_id**: "lease-actual-123"', 'raw-identity'],
    ['cursor:actual-session-123', 'raw-identity'],
    ['AKIAIOSFODNN7EXAMPLE', 'credential-shape'],
    ['Bearer abcdefghijklmnop', 'credential-shape'],
    ['api_key=supersecretvalue', 'credential-shape'],
    ['System prompt: retain this raw instruction.', 'transcript-prose'],
    [
      '{"role":"user","message":{"content":[{"type":"text","text":"Private transcript sentence."}]}}',
      'transcript-prose',
    ],
  ])('detects %s as %s', (text, category) => {
    expect(
      scanCursorEvidenceText('documentation/docs/cursor.md', text),
    ).toEqual([
      expect.objectContaining({
        category,
        file: 'documentation/docs/cursor.md',
        line: 1,
      }),
    ]);
  });

  it('allows documented redactions and explicitly synthetic fixture prose', () => {
    const redacted = [
      '/Users/<redacted-user>/Code/project',
      'C:\\Users\\<redacted-user>\\project',
      'session_id: <redacted-session-id>',
      'lease_id="<redacted-lease-id>"',
      '{"session_id":"<redacted-session-id>"}',
      '"conversation_id": "[REDACTED]"',
      '**generation_id**: "<redacted-generation-id>"',
      'lease_id="redacted-lease"',
      '"sessionId": "cc-session-001"',
      '"sessionId": "codex-session-001"',
      'cursor:<redacted-session-id>',
      'Bearer <redacted-token>',
      'api_key=<redacted-api-key>',
      '{"role":"user","message":{"content":[{"type":"text","text":"<redacted-transcript-prose>"}]}}',
    ].join('\n');
    const synthetic =
      '{"role":"assistant","message":{"content":[{"type":"text","text":"Synthetic response."}]}}';

    expect(
      scanCursorEvidenceText('documentation/docs/cursor.md', redacted),
    ).toEqual([]);
    expect(
      scanCursorEvidenceText(
        'tests/session-observer/fixtures/cursor/framed-example.jsonl',
        synthetic,
      ),
    ).toEqual([]);
  });

  it('includes explicitly changed Markdown in the durable scan', async () => {
    const root = await temporaryRoot();
    await write(root, CURSOR_EVIDENCE_REFERENCE, '# placeholder');
    await write(
      root,
      'tests/session-observer/fixtures/cursor/framed-clean.jsonl',
      '{"type":"turn_ended","status":"success"}\n',
    );
    await write(root, 'documentation/docs/cursor.md', '# Cursor\n');

    const files = await collectCursorEvidenceFiles(root, {
      changedDocs: ['documentation/docs/cursor.md'],
    });

    expect(files).toEqual([
      'documentation/docs/cursor.md',
      CURSOR_EVIDENCE_REFERENCE,
      'tests/session-observer/fixtures/cursor/framed-clean.jsonl',
    ]);
  });

  it('discovers Markdown from a clean committed range using an explicit base', async () => {
    const root = await temporaryRoot();
    await git(root, 'init', '-q');
    await git(root, 'config', 'user.name', 'Cursor Evidence Test');
    await git(root, 'config', 'user.email', 'cursor-evidence@example.invalid');
    await write(root, CURSOR_EVIDENCE_REFERENCE, '# placeholder\n');
    await write(
      root,
      'tests/session-observer/fixtures/cursor/framed-clean.jsonl',
      '{"type":"turn_ended","status":"success"}\n',
    );
    await write(root, 'documentation/docs/cursor.md', '# Cursor\n');
    await git(root, 'add', '.');
    await git(root, 'commit', '-qm', 'base');
    const { stdout: baseStdout } = await git(root, 'rev-parse', 'HEAD');
    const baseRef = baseStdout.trim();

    await write(root, 'documentation/docs/cursor.md', '# Cursor\n\nChanged.\n');
    await git(root, 'add', 'documentation/docs/cursor.md');
    await git(root, 'commit', '-qm', 'change docs');
    expect((await git(root, 'status', '--porcelain')).stdout).toBe('');

    const files = await collectCursorEvidenceFiles(root, { baseRef });

    expect(files).toContain('documentation/docs/cursor.md');
  });

  it.each([
    [
      '| Baseline | Host | Cursor | 3.11.13 | Store | Path | Record | Identity | Probe | Passed | `live-sanitized` |',
      'invalid evidence label',
    ],
    [
      '| Baseline | Host | Cursor | 3.11.13 |  | Path | Record | Identity | Probe | Passed | `live-validated` |',
      'missing required field Store',
    ],
    [
      '| Baseline | Host | Cursor | 3.11.13 | Store | Path | Record | Identity | Probe | Passed | `live-validated` / `automated-only` |',
      'invalid evidence label',
    ],
  ])('rejects an invalid capability row: %s', async (row, detail) => {
    const root = await temporaryRoot();
    await write(root, CURSOR_EVIDENCE_REFERENCE, capabilityMatrix(row));

    const result = await validateCursorEvidence(root, {
      files: [CURSOR_EVIDENCE_REFERENCE],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        category: 'matrix-schema',
        detail: expect.stringContaining(detail),
      }),
    );
  });
});
