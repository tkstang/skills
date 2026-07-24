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
  CURSOR_WAKE_PROBE_SCRIPT,
  scanCursorEvidenceText,
  validateCursorEvidence,
  validateCursorWakeProbeDescription,
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
    expect(result.files).toContain(CURSOR_WAKE_PROBE_SCRIPT);
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

  it('accepts typed gate IDs, Git SHAs, and qualified structural fingerprints only in gate bookkeeping', () => {
    const sha = '5d02b9144cc263660590a7c982024bf29f7351c4';
    const fingerprint =
      'ce1cc10c980e670bbb5b28cd62f8c370df088ae47db55f07a4f6aa0ce262c693';
    const runId = '09729d68-6f2a-4a63-be4f-b344c8ac96a0';
    const safe = [
      `reviewed_head: ${sha}`,
      `receive_commit: ${sha}`,
      `implementation_fingerprint: 'sha256:effective-delta-v1:${fingerprint}'`,
      `gate_run_id: ${runId}`,
      `launch_attempt_id: ${runId}`,
      `launch_result_receipt: '.oat/projects/local/project/gate-runs/${runId}.result.json'`,
      `gate_run_marker: 'system-temp:oat-gate-runs/${runId}.json'`,
      `receive_correlation: 'run=${runId} scope=final type=code'`,
      `status=received run=${runId} commit=${sha} correlation=preserved`,
      `Gate run \`${runId}\` completed with a validated blocked envelope.`,
      `command=node scripts/validate-cursor-evidence.mjs --base-ref ${sha}`,
    ].join('\n');

    expect(
      scanCursorEvidenceText('.oat/projects/shared/project/state.md', safe),
    ).toEqual([]);
  });

  it.each([
    [`session_id: 09729d68-6f2a-4a63-be4f-b344c8ac96a0`, 'raw-identity'],
    [`lease_id=09729d68-6f2a-4a63-be4f-b344c8ac96a0`, 'raw-identity'],
    [`event_id: 09729d68-6f2a-4a63-be4f-b344c8ac96a0`, 'raw-identity'],
    [
      `reviewed_head: ${'a'.repeat(40)}`,
      'raw-identity',
      'documentation/docs/cursor.md',
    ],
    [`arbitrary_hash: ${'b'.repeat(40)}`, 'raw-identity'],
    [`fingerprint: sha256:${'c'.repeat(64)}`, 'raw-identity'],
    [
      `config_fingerprint: sha256:${'d'.repeat(64)}`,
      'raw-identity',
      'documentation/docs/cursor.md',
    ],
    [
      `gate_run_id: 09729d68-6f2a-4a63-be4f-b344c8ac96a0 /Users/example/gate.json`,
      'personal-absolute-path',
    ],
  ])(
    'does not use a gate-evidence exemption for %s',
    (text, category, file = '.oat/projects/shared/project/state.md') => {
      expect(scanCursorEvidenceText(file, text)).toContainEqual(
        expect.objectContaining({ category }),
      );
    },
  );

  it('accepts terminally normalized accepted/result/receive gate bookkeeping end to end', async () => {
    const root = await temporaryRoot();
    const project = '.oat/projects/shared/cursor-collaboration-reliability';
    const runId = '09729d68-6f2a-4a63-be4f-b344c8ac96a0';
    const launchId = '55369892-1344-48b0-be2e-22605af4a252';
    const reviewedHead = '5d02b9144cc263660590a7c982024bf29f7351c4';
    const receiveCommit = '56db672ca4bfbd07f4824b023c40ba9b64aadd1a';
    const fingerprint =
      'ce1cc10c980e670bbb5b28cd62f8c370df088ae47db55f07a4f6aa0ce262c693';
    await write(
      root,
      `${project}/state.md`,
      [
        'oat_implement_exit_gate:',
        '  status: stale',
        '  resolution: configured',
        `  reviewed_head: ${reviewedHead}`,
        `  implementation_fingerprint: 'sha256:effective-delta-v1:${fingerprint}'`,
        '  launch_state: result_persisted',
        `  launch_attempt_id: ${launchId}`,
        `  launch_result_receipt: '.oat/projects/local/cursor-collaboration-reliability/gate-runs/${launchId}.result.json'`,
        `  gate_run_marker: 'system-temp:oat-gate-runs/${runId}.json'`,
        `  gate_run_id: ${runId}`,
        '  envelope_status: blocked',
        '  receive_state: completed',
        `  receive_correlation: 'run=${runId} scope=final type=code source=final-review.md handoff=corroborated'`,
        `  receive_commit: ${receiveCommit}`,
      ].join('\n'),
    );
    await write(
      root,
      `${project}/project-log.md`,
      [
        `status=accepted run=${runId} reviewed_head=${reviewedHead} implementation_fingerprint=sha256:effective-delta-v1:${fingerprint}`,
        `status=result run=${runId} exit=1 artifact=reviews/final-review.md`,
        `status=received run=${runId} receive_state=completed receive_commit=${receiveCommit} event=final|code|final-review.md`,
        `receipt=local-only:.oat/projects/local/cursor-collaboration-reliability/gate-runs marker=logical:system-temp:oat-gate-runs correlation=preserved scope=terminal-received-gate`,
      ].join('\n'),
    );

    await expect(
      validateCursorEvidence(root, {
        files: [`${project}/project-log.md`, `${project}/state.md`],
      }),
    ).resolves.toMatchObject({ findings: [] });
  });

  it('accepts an active launch only with typed fingerprints and a logical system-temporary marker', async () => {
    const root = await temporaryRoot();
    const project = '.oat/projects/shared/cursor-collaboration-reliability';
    const runId = '24448ac0-ac55-4175-a873-1611596f0385';
    const launchId = 'f5cb895a-f08c-4e0e-b7a0-a5b2ad38ad72';
    const fingerprint =
      '4222336c3eec6bf0973b683c9d25a0b8be5f8c06be8e13f46c9fff72795237d8';
    await write(
      root,
      `${project}/state.md`,
      [
        'oat_implement_exit_gate:',
        '  launch_state: accepted',
        `  launch_attempt_id: ${launchId}`,
        `  implementation_fingerprint: 'sha256:effective-delta-v1:${fingerprint}'`,
        `  launch_result_receipt: '.oat/projects/local/cursor-collaboration-reliability/gate-runs/${launchId}.result.json'`,
        `  gate_run_marker: 'system-temp:oat-gate-runs/${runId}.json'`,
        `  gate_run_id: ${runId}`,
      ].join('\n'),
    );

    await expect(
      validateCursorEvidence(root, {
        files: [`${project}/state.md`],
      }),
    ).resolves.toMatchObject({ findings: [] });
  });

  it.each([
    [
      "gate_run_marker: '/var/folders/example/T/oat-gate-runs/24448ac0-ac55-4175-a873-1611596f0385.json'",
    ],
    [
      `The implementation basis is \`sha256:effective-delta-v1:${'4'.repeat(64)}\`.`,
    ],
    [
      'marker: system-temp:oat-gate-runs/24448ac0-ac55-4175-a873-1611596f0385.json',
    ],
  ])('rejects untyped active-launch evidence: %s', (text) => {
    expect(
      scanCursorEvidenceText(
        '.oat/projects/shared/project/implementation.md',
        text,
      ),
    ).toContainEqual(expect.objectContaining({ category: 'raw-identity' }));
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
      CURSOR_WAKE_PROBE_SCRIPT,
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

  it('rejects an incomplete Phase 6 recipe mode', async () => {
    // @ts-expect-error The probe is an authored Node CLI without declarations.
    const probe = await import('../../scripts/probe-cursor-wake-surfaces.mjs');
    const reference = await readFile(
      new URL(
        '../../skills/session-observer-collab/references/runtime-cursor.md',
        import.meta.url,
      ),
      'utf8',
    );
    const description = structuredClone(probe.describeCursorWakeProbeRecipes());
    description.modes = description.modes.filter(
      ({ mode }: { mode: string }) => mode !== 'managed-subagent',
    );

    expect(
      validateCursorWakeProbeDescription(reference, description),
    ).toContainEqual(
      expect.objectContaining({
        category: 'phase6-probe-recipe',
        detail: 'missing managed-subagent recipe mode',
      }),
    );
  });

  it('rejects placeholder Phase 6 commands even with a complete script', async () => {
    // @ts-expect-error The probe is an authored Node CLI without declarations.
    const probe = await import('../../scripts/probe-cursor-wake-surfaces.mjs');
    const reference = [
      'node scripts/probe-cursor-wake-surfaces.mjs --mode top-level-stop --json',
      'node scripts/probe-cursor-wake-surfaces.mjs --mode managed-subagent --json',
      'processCapMs provider-version bounded-provider-process lifecycle-hooks',
      'fixed-markers surface-outcome cleanup',
      '<sanitized-probe-prompt>',
    ].join('\n');

    expect(
      validateCursorWakeProbeDescription(
        reference,
        probe.describeCursorWakeProbeRecipes(),
      ),
    ).toContainEqual(
      expect.objectContaining({
        category: 'phase6-probe-recipe',
        detail: 'runtime reference retains non-executable probe placeholders',
      }),
    );
  });
});
