import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderReviewMarkdown, runReviewCli } from './review.js';
import type {
  ExecuteReviewInput,
  ExecuteReviewResult,
  ReviewAggregate,
} from './run.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('review CLI', () => {
  it('returns the three supported selectors and zero invocations without reading stdin', async () => {
    const execute = vi.fn();
    const result = await runReviewCli(['--host', 'codex', '--json'], {
      execute,
    });

    expect(result.exitCode).toBe(2);
    expect(result.payload).toMatchObject({
      status: 'usage_error',
      reason: 'scope_required',
      invocation_count: 0,
      supported_scopes: [
        'base_branch=<ref>',
        '--files <paths...>',
        '--document <path>',
      ],
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    {
      argv: ['base_branch=origin/main', '--host', 'codex'],
      expected: { kind: 'base_branch', ref: 'origin/main' },
    },
    {
      argv: ['--files', 'src/a.ts', 'docs/b.md', '--host', 'codex'],
      expected: { kind: 'files', paths: ['src/a.ts', 'docs/b.md'] },
    },
    {
      argv: ['--document', '/tmp/design.md', '--host', 'cursor'],
      expected: { kind: 'document', path: '/tmp/design.md' },
    },
  ])(
    'translates one explicit selector without a follow-up',
    async ({ argv, expected }) => {
      const execute = vi.fn(async (input: ExecuteReviewInput) => {
        expect(input.scope).toEqual(expected);
        return {
          ok: true,
          status: 'empty_scope',
          invocation_count: 0,
          scope: { selectedPaths: [], externalDocuments: [] },
        } as unknown as ExecuteReviewResult;
      });

      const result = await runReviewCli(argv, { execute });

      expect(result.exitCode).toBe(0);
      expect(execute).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [
      ['base_branch=main', '--document', 'plan.md', '--host', 'codex'],
      'selector_conflict',
    ],
    [['--staged', '--host', 'codex'], 'selector_deferred'],
    [
      ['--document', 'plan.md', '--model', 'x', '--host', 'codex'],
      'reviewer_required',
    ],
  ])(
    'rejects conflicting or deferred arguments before dispatch',
    async (argv, reason) => {
      const execute = vi.fn();
      const result = await runReviewCli(argv, { execute });
      expect(result).toMatchObject({
        exitCode: 2,
        payload: { reason, invocation_count: 0 },
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('writes canonical and explicit exported Markdown and returns absolute paths', async () => {
    const root = await temporaryRoot();
    const runDirectory = path.join(root, 'state', 'run-1');
    await mkdir(runDirectory, { recursive: true });
    const aggregate = aggregateFixture(root, runDirectory);
    const execute = vi.fn(async () => completedResult(aggregate, runDirectory));

    const result = await runReviewCli(
      [
        '--files',
        'src/example.ts',
        '--host',
        'codex',
        '--output',
        'exported-review.md',
        '--json',
      ],
      { cwd: root, execute },
    );

    expect(result.exitCode).toBe(0);
    expect(result.payload).toMatchObject({
      status: 'completed',
      invocation_count: 1,
      artifacts: {
        markdown: path.join(runDirectory, 'review.md'),
        json: path.join(runDirectory, 'result.json'),
        exported_markdown: path.join(
          await realpath(root),
          'exported-review.md',
        ),
      },
    });
    const markdown = await readFile(
      path.join(runDirectory, 'review.md'),
      'utf8',
    );
    expect(markdown).toContain('### Critical');
    expect(markdown).toContain('### Important');
    expect(markdown).toContain('### Medium');
    expect(markdown).toContain('### Minor');
    expect(markdown).toContain('C1: Escape \\[hostile\\] \\*title\\*');
    expect(markdown).not.toContain('[hostile] *title*');
    expect(await readFile(path.join(root, 'exported-review.md'), 'utf8')).toBe(
      markdown,
    );
  });

  it('preserves the canonical artifact and emits a diagnostic when export would overwrite', async () => {
    const root = await temporaryRoot();
    const runDirectory = path.join(root, 'state', 'run-2');
    await mkdir(runDirectory, { recursive: true });
    await writeFile(path.join(root, 'existing.md'), 'keep\n');
    const aggregate = aggregateFixture(root, runDirectory);

    const result = await runReviewCli(
      [
        '--files',
        'src/example.ts',
        '--host',
        'codex',
        '--output',
        'existing.md',
      ],
      {
        cwd: root,
        execute: async () => completedResult(aggregate, runDirectory),
      },
    );

    expect(result).toMatchObject({
      exitCode: 1,
      payload: {
        status: 'output_failed',
        reason: 'export_failed',
        invocation_count: 1,
      },
    });
    await expect(
      access(path.join(runDirectory, 'review.md')),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(runDirectory, 'cli-diagnostic.json')),
    ).resolves.toBeUndefined();
    expect(await readFile(path.join(root, 'existing.md'), 'utf8')).toBe(
      'keep\n',
    );
  });

  it('offers only a diagnostic path for an incomplete run', async () => {
    const root = await temporaryRoot();
    const diagnosticPath = path.join(root, 'diagnostic.json');
    await writeFile(diagnosticPath, '{}\n');
    const result = await runReviewCli(
      ['--document', 'plan.md', '--host', 'codex'],
      {
        cwd: root,
        execute: async () => ({
          ok: false,
          status: 'defective',
          reason: 'scope_drift',
          message: 'selected bytes changed',
          invocation_count: 1,
          diagnosticPath,
        }),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.payload).toEqual({
      ok: false,
      status: 'defective',
      reason: 'scope_drift',
      message: 'selected bytes changed',
      invocation_count: 1,
      artifacts: { diagnostic: diagnosticPath },
    });
    expect(result.human).not.toContain('Markdown artifact');
  });
});

describe('review Markdown rendering', () => {
  it('renders stable severity IDs, locations, anchors, provenance, and split checks', async () => {
    const root = await temporaryRoot();
    const aggregate = aggregateFixture(root, path.join(root, 'state'));
    aggregate.reply.findings.push({
      severity: 'important',
      title: 'Important issue',
      anchor: 'Section [two](bad)',
      claim: 'claim',
      evidence: 'evidence',
      suggestion: 'suggestion',
      confidence: 0.8,
    });
    aggregate.reply.findings.push({
      severity: 'medium',
      title: 'Medium issue',
      location: aggregate.reply.findings[0]!.location,
      claim: 'claim',
      evidence: 'evidence',
      suggestion: 'suggestion',
      confidence: 0.7,
    });
    aggregate.reply.findings.push({
      severity: 'minor',
      title: 'Minor issue',
      location: aggregate.reply.findings[0]!.location,
      claim: 'claim',
      evidence: 'evidence',
      suggestion: 'suggestion',
      confidence: 0.6,
    });

    const rendered = renderReviewMarkdown(aggregate);

    expect(rendered).toMatch(/\*\*C1:/u);
    expect(rendered).toMatch(/\*\*I1:/u);
    expect(rendered).toMatch(/\*\*M1:/u);
    expect(rendered).toMatch(/\*\*m1:/u);
    expect(rendered).toContain('src/example.ts:1');
    expect(rendered).toContain('anchor: Section [two](bad)');
    expect(rendered).toContain('## Checks reported');
    expect(rendered).toContain('unit test');
    expect(rendered).toContain('## Suggested verification');
    expect(rendered).toContain('live provider');
    expect(rendered).toContain('## Scope and provenance');
    expect(rendered).toContain('operator\\-managed');
    expect(renderReviewMarkdown(aggregate)).toBe(rendered);
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'review-cli-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(
    path.join(root, 'src/example.ts'),
    'export const ok = true;\n',
  );
  return root;
}

function completedResult(
  aggregate: ReviewAggregate,
  runDirectory: string,
): ExecuteReviewResult {
  return {
    ok: true,
    status: 'completed',
    invocation_count: 1,
    artifactPath: path.join(runDirectory, 'result.json'),
    runState: {
      stateRoot: path.dirname(runDirectory),
      worktreeKey: 'fixture',
      runId: aggregate.run_id,
      runDirectory,
    },
    aggregate,
  };
}

function aggregateFixture(root: string, runDirectory: string): ReviewAggregate {
  const snapshot = {
    head: 'abc',
    index: 'index',
    status: 'status',
    selected: [
      {
        path: 'src/example.ts',
        location: 'worktree' as const,
        kind: 'file' as const,
        mode: 0o100644,
        bytes: 24,
        sha256: 'source-version',
      },
    ],
  };
  return {
    schema_version: 'v1',
    run_id: 'run-fixture',
    status: 'complete',
    worktree_root: root,
    request: 'Check `request` and [links](bad).',
    request_sha256: 'request-sha',
    scope: {
      token: 'scope-token',
      request: { kind: 'files', paths: ['src/example.ts'] },
      canonicalWorktree: root,
      head: 'abc',
      selectedPaths: ['src/example.ts'],
      externalDocuments: ['/tmp/external-plan.md'],
      versions: [
        {
          source: 'live',
          path: 'src/example.ts',
          kind: 'file',
          mode: 0o100644,
          bytes: 24,
          sha256: 'source-version',
          blobId: null,
          text: 'export const ok = true;\n',
        },
      ],
      evidenceBytes: 24,
      captureState: snapshot,
    },
    reviewer: {
      selected: { provider: 'claude', model: 'review-model' },
      requested: { reviewer: null, model: null, effort: null },
      passed: { provider: 'claude', model: 'review-model', effort: null },
      source: 'built-in',
      skipped: [],
      observed: {
        provider: 'claude',
        model: null,
        effort: null,
        evidence: 'Provider envelope only.',
      },
      claimed: { provider: 'claude', model: 'claimed-model' },
    },
    authored_by: [
      {
        identity: 'unknown',
        evidence_source: 'unknown',
        evidence_reference: 'No bounded author evidence was supplied.',
        scope_coverage: 'unknown',
        covered_paths: [],
      },
    ],
    diversity: {
      classification: 'unknown',
      evidence: 'Provider identity does not establish model family.',
    },
    invocation_count: 1,
    policy: {
      max_depth: 1,
      max_attempts: 1,
      read_only: true,
      repair: false,
      fallback_after_dispatch: false,
    },
    drift: {
      checked: true,
      stable: true,
      differences: [],
      limitation:
        'Unselected content changes with unchanged Git status may go undetected.',
      before: snapshot,
      after: snapshot,
    },
    validation: { ok: true },
    reply: {
      schema_version: 'v1',
      scope_token: 'scope-token',
      verdict: 'changes_requested',
      summary: 'Summary with <tag> and *markup*.',
      findings: [
        {
          severity: 'critical',
          title: 'Escape [hostile] *title*',
          location: {
            path: 'src/example.ts',
            start_line: 1,
            end_line: 1,
            source_version: 'source-version',
          },
          claim: 'A [claim](bad).',
          evidence: 'Evidence *must* stay text.',
          suggestion: 'Fix it.',
          confidence: 0.9,
        },
      ],
      questions: ['Question?'],
      limitations: ['Fixture limitation.'],
      coverage: ['Selected file.'],
      inspected_context: [
        { subject: 'src/example.ts', source_version: 'source-version' },
      ],
      checks: [
        { name: 'unit test', status: 'passed', detail: 'fixture only' },
        { name: 'live provider', status: 'not_run', detail: 'not authorized' },
      ],
      reviewer_identity: { provider: 'claude', model: 'claimed-model' },
    },
    paths: {
      run_directory: runDirectory,
      request: path.join(runDirectory, 'request.txt'),
      evidence: path.join(runDirectory, 'evidence.json'),
      result: path.join(runDirectory, 'result.json'),
    },
  };
}
