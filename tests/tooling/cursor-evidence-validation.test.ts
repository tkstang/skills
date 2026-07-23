import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// @ts-expect-error The validator is an authored Node CLI without declarations.
import {
  collectCursorEvidenceFiles,
  CURSOR_EVIDENCE_REFERENCE,
  scanCursorEvidenceText,
  validateCursorEvidence,
} from '../../scripts/validate-cursor-evidence.mjs';

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
    expect(reference).toMatch(
      /Failure outcomes are retained as failures and never relabeled/iu,
    );
  });

  it.each([
    ['/Users/example/Code/private', 'personal-absolute-path'],
    ['/home/example/project', 'personal-absolute-path'],
    ['C:\\Users\\example\\project', 'personal-absolute-path'],
    ['session_id: session-actual-123', 'raw-identity'],
    ['lease_id="lease-actual-123"', 'raw-identity'],
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
});
