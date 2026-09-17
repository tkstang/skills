import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  appendFile,
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  symlink,
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

  it.each([
    ['write', { writeError: 'fixture canonical write failure' }],
    ['sync', { syncError: 'fixture canonical sync failure' }],
  ] as const)(
    'does not publish partial canonical Markdown after a %s failure',
    async (_stage, fault) => {
      const root = await temporaryRoot();
      const runDirectory = path.join(root, 'state', 'canonical-failure');
      await mkdir(runDirectory, { recursive: true });
      const aggregate = aggregateFixture(root, runDirectory);
      const canonicalMarkdown = path.join(runDirectory, 'review.md');

      const result = await runReviewCli(
        ['--files', 'src/example.ts', '--host', 'codex', '--json'],
        {
          cwd: root,
          execute: async () => completedResult(aggregate, runDirectory),
          fileSystem: {
            openFile: faultingOpen({
              matches: (target) => target.includes('.review.md.'),
              ...fault,
            }),
          },
        },
      );

      expect(result).toMatchObject({
        exitCode: 1,
        payload: {
          status: 'output_failed',
          reason: 'markdown_persistence_failed',
          invocation_count: 1,
          diagnostic_persisted: true,
          artifacts: {
            diagnostic: path.join(runDirectory, 'cli-diagnostic.json'),
          },
        },
      });
      await expect(access(canonicalMarkdown)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await expectNoPublicationTemporary(runDirectory, 'review.md');
    },
  );

  it('preserves canonical Markdown and removes the export temporary after an export write failure', async () => {
    const root = await temporaryRoot();
    const runDirectory = path.join(root, 'state', 'export-failure');
    await mkdir(runDirectory, { recursive: true });
    const aggregate = aggregateFixture(root, runDirectory);
    const destination = path.join(root, 'exported-review.md');

    const result = await runReviewCli(
      [
        '--files',
        'src/example.ts',
        '--host',
        'codex',
        '--output',
        destination,
        '--json',
      ],
      {
        cwd: root,
        execute: async () => completedResult(aggregate, runDirectory),
        fileSystem: {
          openFile: faultingOpen({
            matches: (target) => target.includes('.exported-review.md.'),
            writeError: 'fixture export write failure',
          }),
        },
      },
    );

    expect(result).toMatchObject({
      exitCode: 1,
      payload: {
        reason: 'export_failed',
        diagnostic_persisted: true,
        artifacts: {
          markdown: path.join(runDirectory, 'review.md'),
          diagnostic: path.join(runDirectory, 'cli-diagnostic.json'),
        },
      },
    });
    await expect(
      access(path.join(runDirectory, 'review.md')),
    ).resolves.toBeUndefined();
    await expect(access(destination)).rejects.toMatchObject({ code: 'ENOENT' });
    await expectNoPublicationTemporary(root, 'exported-review.md');
  });

  it('fails closed when a competing publisher wins the canonical destination', async () => {
    const root = await temporaryRoot();
    const runDirectory = path.join(root, 'state', 'publish-collision');
    await mkdir(runDirectory, { recursive: true });
    const aggregate = aggregateFixture(root, runDirectory);
    const canonicalMarkdown = path.join(runDirectory, 'review.md');
    const linkFile: typeof link = async (source, destination) => {
      if (destination === canonicalMarkdown) {
        await writeFile(destination, 'competing publisher\n', { flag: 'wx' });
      }
      await link(source, destination);
    };

    const result = await runReviewCli(
      ['--files', 'src/example.ts', '--host', 'codex', '--json'],
      {
        cwd: root,
        execute: async () => completedResult(aggregate, runDirectory),
        fileSystem: { linkFile },
      },
    );

    expect(result).toMatchObject({
      exitCode: 1,
      payload: {
        reason: 'markdown_persistence_failed',
        diagnostic_persisted: true,
      },
    });
    expect(await readFile(canonicalMarkdown, 'utf8')).toBe(
      'competing publisher\n',
    );
    await expectNoPublicationTemporary(runDirectory, 'review.md');
  });

  it('does not advertise a diagnostic path when diagnostic persistence fails', async () => {
    const root = await temporaryRoot();
    const runDirectory = path.join(root, 'state', 'diagnostic-failure');
    await mkdir(runDirectory, { recursive: true });
    const aggregate = aggregateFixture(root, runDirectory);

    const result = await runReviewCli(
      ['--files', 'src/example.ts', '--host', 'codex', '--json'],
      {
        cwd: root,
        execute: async () => completedResult(aggregate, runDirectory),
        fileSystem: {
          openFile: faultingOpen({
            matches: (target) =>
              target.includes('.review.md.') ||
              target.includes('.cli-diagnostic.json.'),
            writeError: 'fixture persistence failure',
          }),
        },
      },
    );

    expect(result).toMatchObject({
      exitCode: 1,
      payload: {
        status: 'output_failed',
        diagnostic_persisted: false,
        diagnostic_error: 'fixture persistence failure',
      },
    });
    expect(result.payload).toMatchObject({
      artifacts: { json: path.join(runDirectory, 'result.json') },
    });
    expect(result.payload).not.toHaveProperty('artifacts.diagnostic');
    expect(result.human).toContain('Diagnostic persistence: failed');
    expect(result.human).not.toContain('Diagnostic artifact:');
    await expect(
      access(path.join(runDirectory, 'cli-diagnostic.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expectNoPublicationTemporary(runDirectory, 'review.md');
    await expectNoPublicationTemporary(runDirectory, 'cli-diagnostic.json');
  });

  it('rejects a request that grows after stat without an unbounded read or provider invocation', async () => {
    const root = await temporaryRoot();
    const requestPath = path.join(root, 'request.txt');
    await writeFile(requestPath, 'a'.repeat(200 * 1024));
    const execute = vi.fn();
    let appended = false;
    let requestedBytes = 0;

    const result = await runReviewCli(
      [
        '--files',
        'src/example.ts',
        '--host',
        'codex',
        '--request-file',
        requestPath,
        '--json',
      ],
      {
        cwd: root,
        execute,
        fileSystem: {
          openFile: faultingOpen({
            matches: (target) => target === requestPath,
            beforeRead: async (length) => {
              requestedBytes += length;
              if (!appended) {
                appended = true;
                await appendFile(requestPath, 'b'.repeat(200 * 1024));
              }
            },
          }),
        },
      },
    );

    expect(result).toMatchObject({
      exitCode: 2,
      payload: {
        status: 'usage_error',
        reason: 'argument_invalid',
        invocation_count: 0,
        message: 'request file exceeds 262144 bytes',
      },
    });
    expect(appended).toBe(true);
    expect(requestedBytes).toBe(256 * 1024 + 1);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a symlinked request file before open or provider invocation', async () => {
    const root = await temporaryRoot();
    const requestPath = path.join(root, 'request.txt');
    const linkedRequestPath = path.join(root, 'linked-request.txt');
    await writeFile(requestPath, 'Review the selected file.');
    await symlink(requestPath, linkedRequestPath);
    const execute = vi.fn();
    const openFile = vi.fn(async () => {
      throw new Error('symlink reached open');
    }) as unknown as typeof open;

    const result = await runReviewCli(
      [
        '--files',
        'src/example.ts',
        '--host',
        'codex',
        '--request-file',
        linkedRequestPath,
      ],
      { cwd: root, execute, fileSystem: { openFile } },
    );

    expect(result).toMatchObject({
      exitCode: 2,
      payload: {
        status: 'usage_error',
        reason: 'argument_invalid',
        invocation_count: 0,
        message: 'request file must be a regular file and cannot be a symlink',
      },
    });
    expect(openFile).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.runIf(process.platform !== 'win32')(
    'rejects a FIFO request file before a blocking open or provider invocation',
    async () => {
      const root = await temporaryRoot();
      const requestPath = path.join(root, 'request.fifo');
      execFileSync('mkfifo', [requestPath]);
      const execute = vi.fn();
      const openFile = vi.fn(async () => {
        throw new Error('FIFO reached open');
      }) as unknown as typeof open;

      const result = await runReviewCli(
        [
          '--files',
          'src/example.ts',
          '--host',
          'codex',
          '--request-file',
          requestPath,
        ],
        { cwd: root, execute, fileSystem: { openFile } },
      );

      expect(result).toMatchObject({
        exitCode: 2,
        payload: {
          status: 'usage_error',
          reason: 'argument_invalid',
          invocation_count: 0,
          message:
            'request file must be a regular file and cannot be a symlink',
        },
      });
      expect(openFile).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('reads a bounded regular request file with no-follow nonblocking flags', async () => {
    const root = await temporaryRoot();
    const requestPath = path.join(root, 'request.txt');
    await writeFile(requestPath, 'Review the selected file.');
    const execute = vi.fn(async (input: ExecuteReviewInput) => {
      expect(input.request).toBe('Review the selected file.');
      return {
        ok: true,
        status: 'empty_scope',
        invocation_count: 0,
        scope: { selectedPaths: [], externalDocuments: [] },
      } as unknown as ExecuteReviewResult;
    });
    const flags: Array<string | number> = [];
    const openFile = (async (target, openFlags, mode) => {
      flags.push(openFlags!);
      return open(target, openFlags, mode);
    }) as typeof open;

    const result = await runReviewCli(
      [
        '--files',
        'src/example.ts',
        '--host',
        'codex',
        '--request-file',
        requestPath,
      ],
      { cwd: root, execute, fileSystem: { openFile } },
    );

    expect(result.exitCode).toBe(0);
    expect(flags).toEqual([
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    ]);
    expect(execute).toHaveBeenCalledOnce();
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

  it.each([
    ['clean', 'clean-review.md'],
    ['findings', 'findings-review.md'],
  ] as const)(
    'renders the %s receipt aggregate byte-for-byte as its exercised fixture',
    async (kind, fixtureName) => {
      const fixture = await readFile(
        new URL(
          `../../../../tests/fixtures/consensus-review-receipt/${fixtureName}`,
          import.meta.url,
        ),
        'utf8',
      );

      expect(renderReviewMarkdown(receiptAggregateFixture(kind))).toBe(fixture);
    },
  );
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

function faultingOpen(options: {
  matches: (target: string) => boolean;
  writeError?: string;
  syncError?: string;
  beforeRead?: (length: number) => Promise<void>;
}): typeof open {
  return (async (targetPath, flags, mode) => {
    const handle = await open(targetPath, flags, mode);
    const target = String(targetPath);
    if (!options.matches(target)) return handle;
    return new Proxy(handle, {
      get(actual, property) {
        if (property === 'writeFile' && options.writeError) {
          return async () => {
            throw new Error(options.writeError);
          };
        }
        if (property === 'sync' && options.syncError) {
          return async () => {
            throw new Error(options.syncError);
          };
        }
        if (property === 'read' && options.beforeRead) {
          return async (
            buffer: Buffer,
            offset: number,
            length: number,
            position: number | null,
          ) => {
            await options.beforeRead!(length);
            return actual.read(buffer, offset, length, position);
          };
        }
        const value = Reflect.get(actual, property, actual) as unknown;
        return typeof value === 'function' ? value.bind(actual) : value;
      },
    });
  }) as typeof open;
}

async function expectNoPublicationTemporary(
  directory: string,
  basename: string,
): Promise<void> {
  const names = await readdir(directory);
  expect(
    names.filter(
      (name) => name.startsWith(`.${basename}.`) && name.endsWith('.tmp'),
    ),
  ).toEqual([]);
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

function receiptAggregateFixture(kind: 'clean' | 'findings'): ReviewAggregate {
  const root = '/tmp/consensus-review-receipt/worktree';
  const runDirectory = `/tmp/consensus-review-receipt/${kind}`;
  const aggregate = aggregateFixture(root, runDirectory);
  aggregate.run_id = `receipt-${kind}-v1`;
  aggregate.reviewer.observed = {
    provider: 'claude',
    model: null,
    effort: null,
    evidence: 'Provider envelope only.',
  };
  aggregate.reviewer.claimed = { provider: 'claude' };

  if (kind === 'clean') {
    aggregate.request = 'Review the bounded receipt fixture.';
    aggregate.scope.token = 'receipt-clean-token';
    aggregate.scope.request = { kind: 'files', paths: ['src/clean.ts'] };
    aggregate.scope.selectedPaths = ['src/clean.ts'];
    aggregate.scope.externalDocuments = [];
    aggregate.scope.evidenceBytes = 24;
    aggregate.reply = {
      schema_version: 'v1',
      scope_token: 'receipt-clean-token',
      verdict: 'pass',
      summary: 'No findings in the bounded fixture.',
      findings: [],
      questions: [],
      limitations: ['Fixture execution does not prove live provider behavior.'],
      coverage: ['src/clean.ts'],
      inspected_context: [
        { subject: 'src/clean.ts', source_version: 'clean-source-v1' },
      ],
      checks: [
        {
          name: 'renderer fixture',
          status: 'passed',
          detail: 'deterministic local output',
        },
        {
          name: 'live provider',
          status: 'not_run',
          detail: 'not authorized',
        },
      ],
      reviewer_identity: { provider: 'claude' },
    };
    return aggregate;
  }

  const planPath = '/tmp/consensus-review-receipt/plan.md';
  aggregate.request = 'Review all supported severity and location forms.';
  aggregate.scope.token = 'receipt-findings-token';
  aggregate.scope.request = { kind: 'document', path: planPath };
  aggregate.scope.selectedPaths = ['src/reviewed.ts'];
  aggregate.scope.externalDocuments = [planPath];
  aggregate.scope.evidenceBytes = 256;
  aggregate.reply = {
    schema_version: 'v1',
    scope_token: 'receipt-findings-token',
    verdict: 'changes_requested',
    summary: 'The fixture contains four independently actionable findings.',
    findings: [
      {
        severity: 'critical',
        title: 'Reject unsafe destination',
        location: {
          path: 'src/reviewed.ts',
          start_line: 12,
          end_line: 14,
          source_version: 'reviewed-source-v1',
        },
        claim: 'The destination can escape its declared root.',
        evidence: 'The resolved path is used without a containment check.',
        suggestion:
          'Resolve canonically and reject paths outside the declared root.',
        confidence: 0.99,
      },
      {
        severity: 'important',
        title: 'Preserve the explicit acceptance rule',
        anchor: 'Acceptance Criteria > Receipt',
        claim: 'The document omits the diagnostic rejection requirement.',
        evidence: 'The receipt section describes completed reviews only.',
        suggestion:
          'State that diagnostics are not receivable completed reviews.',
        confidence: 0.92,
      },
      {
        severity: 'medium',
        title: 'Record fixture identity',
        location: {
          path: 'src/reviewed.ts',
          start_line: 28,
          end_line: 28,
          source_version: 'reviewed-source-v1',
        },
        claim: 'The evidence omits the fixture identity.',
        evidence: 'The result records only a count.',
        suggestion:
          'Persist the stable fixture name with the normalized outcome.',
        confidence: 0.83,
      },
      {
        severity: 'minor',
        title: 'Clarify retained state',
        anchor: 'Limitations > Retention',
        claim: 'Retention ownership is implied rather than stated.',
        evidence: 'The text names the directory but not the cleanup owner.',
        suggestion: 'Say that retention is operator-managed.',
        confidence: 0.74,
      },
    ],
    questions: [
      'Should the operator archive the completed review after triage?',
    ],
    limitations: [
      'This is a deterministic fixture, not live provider acceptance.',
    ],
    coverage: ['src/reviewed.ts', 'external plan'],
    inspected_context: [
      { subject: 'src/reviewed.ts', source_version: 'reviewed-source-v1' },
      { subject: 'external plan', source_version: 'plan-source-v1' },
    ],
    checks: [
      {
        name: 'renderer fixture',
        status: 'passed',
        detail: 'all four severity sections rendered',
      },
      {
        name: 'live provider',
        status: 'not_run',
        detail: 'not authorized',
      },
    ],
    reviewer_identity: { provider: 'claude' },
  };
  return aggregate;
}
