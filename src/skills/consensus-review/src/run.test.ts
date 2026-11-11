import { readFileSync } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  ConsensusCliRunEnvelope,
  ProviderInventoryEntry,
} from '../../../plugins/consensus/provider-cli/types.js';
import { executeBoundedReview, runReview, validateReviewReply } from './run.js';
import type {
  ExecuteReviewDependencies,
  ReviewRunDependencies,
} from './run.js';
import { captureReviewScope } from './scope.js';

const fixtureRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('review transport runner', () => {
  it('uses the same explicit host context for scoped preflight and dispatch', async () => {
    const fixture = await reviewFixture();
    const seen: unknown[] = [];
    const result = await runReview(
      {
        provider: 'codex',
        prompt: 'Review the captured scope.',
        schemaPath: fixture.schema,
        cwd: fixture.worktree,
        host: 'codex',
        allowSameProvider: true,
        codexCapturePath: fixture.capture,
      },
      {
        env: {
          CONSENSUS_PARENT_HOST: 'codex',
          CONSENSUS_RUN_ID: 'run-123',
          CONSENSUS_DEPTH: '0',
        },
        async preflight(input) {
          seen.push(input.host);
          return readyProvider('codex');
        },
        async runTurn(request, dependencies) {
          seen.push(request.host);
          expect(request.runtime_policy).toEqual({
            permission_mode: 'non-interactive',
            sandbox: 'read-only',
            approval_policy: 'never',
          });
          expect(request.max_runtime_sec).toBe(900);
          expect(dependencies.transport).toEqual({
            submitCaptureEnabled: false,
            strategy: 'prompt_only',
            lastMessageFile: fixture.capture,
            preserveLastMessageFile: true,
          });
          return {
            schema_version: 'v1',
            ok: true,
            provider: 'codex',
            args: ['codex', 'exec'],
            stdout: '{"verdict":"pass"}',
            json: { verdict: 'pass' },
            attempts: {
              cli_attempts: 1,
              terminal_reason: 'success',
              retryable: false,
            },
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      invocation_count: 1,
    });
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(seen[0]);
    expect((await lstat(fixture.capture)).isFile()).toBe(true);
    expect((await lstat(fixture.capture)).mode & 0o777).toBe(0o600);
  });

  it('accepts matching parent identity despite unrelated live host markers', async () => {
    const fixture = await reviewFixture();
    let invocations = 0;
    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: fixture.schema,
          cwd: fixture.worktree,
          host: 'codex',
          allowSameProvider: true,
          codexCapturePath: fixture.capture,
        },
        {
          env: {
            CONSENSUS_PARENT_HOST: 'codex',
            CLAUDECODE: '1',
            CURSOR_TRACE_ID: 'trace',
          },
          preflight: async () => readyProvider('codex'),
          async runTurn() {
            invocations += 1;
            return successEnvelope({ verdict: 'pass' });
          },
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 'completed',
      invocation_count: 1,
    });
    expect(invocations).toBe(1);
  });

  it('blocks explicit host mismatch before preflight or provider invocation', async () => {
    let preflights = 0;
    let invocations = 0;
    await expect(
      runReview(
        {
          provider: 'claude',
          prompt: 'Review.',
          schemaPath: '/external/review.schema.json',
          cwd: '/workspace/repo',
          host: 'codex',
        },
        {
          env: {
            CONSENSUS_PARENT_HOST: 'claude',
            CODEX_SESSION_ID: 'session',
          },
          async preflight() {
            preflights += 1;
            return readyProvider('claude');
          },
          async runTurn() {
            invocations += 1;
            throw new Error('host mismatch reached provider invocation');
          },
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      invocation_count: 0,
      reason: 'contradictory_host',
    });
    expect(preflights).toBe(0);
    expect(invocations).toBe(0);
  });

  it('blocks unknown host evidence and an in-worktree Codex capture before preflight', async () => {
    const fixture = await reviewFixture();
    const preflight = async () => readyProvider('codex');

    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: fixture.schema,
          cwd: fixture.worktree,
          host: 'codex',
          allowSameProvider: true,
          codexCapturePath: fixture.capture,
        },
        { env: {}, preflight },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      invocation_count: 0,
      reason: 'unknown_host',
    });

    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: fixture.schema,
          cwd: fixture.worktree,
          host: 'codex',
          allowSameProvider: true,
          codexCapturePath: path.join(fixture.worktree, 'last-message.json'),
        },
        {
          env: { CONSENSUS_PARENT_HOST: 'codex' },
          preflight,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      invocation_count: 0,
      reason: 'capture_not_external',
    });
  });

  it('rejects canonical capture aliases and unsafe destinations before dispatch', async () => {
    const fixture = await reviewFixture();
    const actualParent = path.join(fixture.root, 'actual-run');
    const linkedParent = path.join(fixture.root, 'linked-run');
    const symlinkTarget = path.join(fixture.root, 'symlink-target.json');
    const symlinkCapture = path.join(fixture.root, 'symlink-capture.json');
    const preExisting = path.join(fixture.runRoot, 'pre-existing.json');
    const protectedAlias = path.join(fixture.runRoot, 'schema-alias.json');
    const worktreeState = path.join(fixture.worktree, '.review');
    const worktreeAlias = path.join(fixture.root, 'worktree-alias');
    await mkdir(actualParent, { mode: 0o700 });
    await chmod(actualParent, 0o700);
    await symlink(actualParent, linkedParent, 'dir');
    await writeFile(symlinkTarget, '{}');
    await symlink(symlinkTarget, symlinkCapture);
    await writeFile(preExisting, '{}');
    await link(fixture.schema, protectedAlias);
    await mkdir(worktreeState, { mode: 0o700 });
    await chmod(worktreeState, 0o700);
    await symlink(fixture.worktree, worktreeAlias, 'dir');

    const captures = [
      path.join(linkedParent, 'last-message.json'),
      symlinkCapture,
      path.join(worktreeAlias, '.review', 'last-message.json'),
      preExisting,
      protectedAlias,
    ];
    let dispatched = 0;
    for (const capture of captures) {
      await expect(
        runReview(
          {
            provider: 'codex',
            prompt: 'Review.',
            schemaPath: fixture.schema,
            cwd: fixture.worktree,
            host: 'codex',
            allowSameProvider: true,
            codexCapturePath: capture,
          },
          {
            env: { CONSENSUS_PARENT_HOST: 'codex' },
            preflight: async () => readyProvider('codex'),
            async runTurn() {
              dispatched += 1;
              throw new Error('unsafe capture reached dispatch');
            },
          },
        ),
      ).resolves.toMatchObject({
        ok: false,
        status: 'preflight_failed',
        invocation_count: 0,
      });
    }
    expect(dispatched).toBe(0);
  });

  it('claims the absent capture exclusively after provider preflight', async () => {
    const fixture = await reviewFixture();
    let dispatched = 0;
    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: fixture.schema,
          cwd: fixture.worktree,
          host: 'codex',
          allowSameProvider: true,
          codexCapturePath: fixture.capture,
        },
        {
          env: { CONSENSUS_PARENT_HOST: 'codex' },
          async preflight() {
            await writeFile(fixture.capture, 'occupied');
            return readyProvider('codex');
          },
          async runTurn() {
            dispatched += 1;
            throw new Error('occupied capture reached dispatch');
          },
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      reason: 'capture_destination_unsafe',
      invocation_count: 0,
    });
    expect(dispatched).toBe(0);
    await expect(readFile(fixture.capture, 'utf8')).resolves.toBe('occupied');
  });

  it.each(['malformed', '-1', '1.5', '2', '9007199254740992'])(
    'rejects present invalid inherited depth %s before preflight or dispatch',
    async (depth) => {
      let preflights = 0;
      let dispatched = 0;
      await expect(
        runReview(
          {
            provider: 'codex',
            prompt: 'Review.',
            schemaPath: '/external/review.schema.json',
            cwd: '/workspace/repo',
            host: 'codex',
            allowSameProvider: true,
            codexCapturePath: '/external/reviews/run/last-message.json',
          },
          {
            env: {
              CONSENSUS_PARENT_HOST: 'codex',
              CONSENSUS_DEPTH: depth,
            },
            async preflight() {
              preflights += 1;
              return readyProvider('codex');
            },
            async runTurn() {
              dispatched += 1;
              throw new Error('invalid depth reached dispatch');
            },
          },
        ),
      ).resolves.toMatchObject({
        ok: false,
        status: 'preflight_failed',
        reason: 'invalid_depth',
        invocation_count: 0,
      });
      expect(preflights).toBe(0);
      expect(dispatched).toBe(0);
    },
  );

  it('maps Claude review transport to provider validation and plan mode', async () => {
    await runReview(
      {
        provider: 'claude',
        prompt: 'Review.',
        schemaPath: '/external/review.schema.json',
        cwd: '/workspace/repo',
        host: 'codex',
      },
      {
        env: { CONSENSUS_PARENT_HOST: 'codex' },
        preflight: async () => readyProvider('claude'),
        async runTurn(request, dependencies) {
          expect(request.runtime_policy).toEqual({
            permission_mode: 'read-only',
          });
          expect(dependencies.transport).toEqual({
            submitCaptureEnabled: false,
            strategy: 'provider_validated',
          });
          return {
            schema_version: 'v1',
            ok: false,
            provider: 'claude',
            code: 'PROVIDER_EXIT',
            message: 'fixture stop',
            retryable: false,
            attempts: {
              cli_attempts: 1,
              terminal_reason: 'fixture',
              retryable: false,
            },
          };
        },
      },
    );
  });

  it('requires explicit consent before a same-provider review', async () => {
    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: '/external/review.schema.json',
          cwd: '/workspace/repo',
          host: 'codex',
          codexCapturePath: '/external/reviews/run/last-message.json',
        },
        { env: { CONSENSUS_PARENT_HOST: 'codex' } },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      reason: 'same_provider_consent_required',
      invocation_count: 0,
    });
  });
});

describe('one bounded review transaction', () => {
  it('captures, dispatches once, validates, compares, and persists a complete aggregate', async () => {
    const fixture = await gitReviewFixture();
    let invocations = 0;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review the selected file for correctness.',
        hostSummary: 'No author identity evidence is available.',
        schemaPath: fixture.schema,
        maxRuntimeSec: 1200,
        maxOutputBytes: 2_000_000,
        runId: 'complete-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        invocations += 1;
        expect(request.max_runtime_sec).toBe(1200);
        expect(request.max_output_bytes).toBe(2_000_000);
        return successEnvelope(validPassReply(scopeToken(request.prompt)));
      }),
    );

    expect(invocations).toBe(1);
    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      invocation_count: 1,
      aggregate: {
        authored_by: [
          {
            identity: 'unknown',
            evidence_source: 'unknown',
            evidence_reference: 'No bounded author evidence was supplied.',
            scope_coverage: 'unknown',
            covered_paths: [],
          },
        ],
        diversity: { classification: 'unknown' },
        policy: {
          max_depth: 1,
          max_attempts: 1,
          repair: false,
          fallback_after_dispatch: false,
        },
        drift: { checked: true, stable: true },
      },
    });
    if (!result.ok || result.status !== 'completed') {
      throw new Error('expected completed fixture');
    }
    expect(result.aggregate.scope.captureState).toMatchObject({
      head: fixture.head,
      index: expect.stringMatching(/^[a-f0-9]{64}$/u),
      status: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(result.aggregate.drift.before).toMatchObject({
      head: fixture.head,
      index: expect.stringMatching(/^[a-f0-9]{64}$/u),
      status: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(result.aggregate.drift.after).toMatchObject({
      head: fixture.head,
      index: expect.stringMatching(/^[a-f0-9]{64}$/u),
      status: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    await expect(readFile(result.artifactPath, 'utf8')).resolves.toContain(
      '"status": "complete"',
    );
    expect(result.artifactPath).toBe(
      path.join(result.runState.runDirectory, 'result.json'),
    );
  });

  it('dispatches a branch review whose diff contains a tracked directory symlink', async () => {
    const fixture = await gitReviewFixture();
    const skillDirectory = path.join(
      fixture.worktree,
      '.agents',
      'skills',
      'example',
    );
    const providerDirectory = path.join(fixture.worktree, '.claude', 'skills');
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(providerDirectory, { recursive: true });
    await writeFile(path.join(skillDirectory, 'SKILL.md'), '# Example\n');
    await symlink(
      '../../.agents/skills/example',
      path.join(providerDirectory, 'example'),
      'dir',
    );
    execFileSync('git', ['add', '.agents', '.claude'], {
      cwd: fixture.worktree,
    });
    execFileSync('git', ['commit', '-q', '-m', 'add provider view'], {
      cwd: fixture.worktree,
    });
    let invocations = 0;

    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'base_branch', ref: fixture.head },
        host: 'codex',
        request: 'Review the branch diff.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'symlink-branch-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        invocations += 1;
        expect(request.prompt).toContain(
          'Entries with kind "symlink" contain the unfollowed link target',
        );
        return successEnvelope(validPassReply(scopeToken(request.prompt)));
      }),
    );

    expect(invocations).toBe(1);
    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      invocation_count: 1,
    });
    if (!result.ok || result.status !== 'completed') {
      throw new Error('expected completed symlink branch fixture');
    }
    const evidence = JSON.parse(
      await readFile(result.aggregate.paths.evidence, 'utf8'),
    ) as {
      versions: Array<Record<string, unknown>>;
    };
    expect(evidence.versions).toContainEqual(
      expect.objectContaining({
        source: 'live',
        path: '.claude/skills/example',
        kind: 'symlink',
        mode: 0o120000,
        text: '../../.agents/skills/example',
      }),
    );
  });

  it('persists mixed bounded author evidence and keeps requested options separate from observed identity', async () => {
    const fixture = await gitReviewFixture();
    await writeFile(path.join(fixture.worktree, 'second.ts'), 'second\n');
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts', 'second.ts'] },
        host: 'codex',
        request: 'Review the selected files.',
        hostSummary: 'Bounded author evidence is supplied separately.',
        schemaPath: fixture.schema,
        reviewer: 'claude',
        model: 'opus-review',
        effort: 'high',
        runId: 'author-evidence-run',
        authoredBy: [
          {
            identity: 'alice@example.com',
            evidence_source: 'detected',
            evidence_reference: 'git author metadata for both selected paths',
            scope_coverage: 'full',
            covered_paths: ['reviewed.ts', 'second.ts'],
          },
          {
            identity: 'pairing partner',
            evidence_source: 'declared',
            evidence_reference: 'operator declaration for second.ts',
            scope_coverage: 'partial',
            covered_paths: ['second.ts'],
          },
        ],
      },
      reviewExecutionDependencies(fixture, async (request) =>
        successEnvelope(validPassReply(scopeToken(request.prompt))),
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      aggregate: {
        authored_by: [
          {
            identity: 'alice@example.com',
            evidence_source: 'detected',
            scope_coverage: 'full',
            covered_paths: ['reviewed.ts', 'second.ts'],
          },
          {
            identity: 'pairing partner',
            evidence_source: 'declared',
            scope_coverage: 'partial',
            covered_paths: ['second.ts'],
          },
        ],
        reviewer: {
          requested: {
            reviewer: 'claude',
            model: 'opus-review',
            effort: 'high',
          },
          passed: {
            provider: 'claude',
            model: 'opus-review',
            effort: 'high',
          },
          observed: {
            provider: 'claude',
            model: null,
            effort: null,
          },
        },
      },
    });
  });

  it('rejects drift between evidence capture and the first baseline before provider selection', async () => {
    const fixture = await gitReviewFixture();
    let preflights = 0;
    let invocations = 0;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'capture-drift-run',
      },
      {
        ...reviewExecutionDependencies(fixture, async () => {
          invocations += 1;
          throw new Error('capture drift reached provider invocation');
        }),
        async captureScope(input) {
          const scope = await captureReviewScope(input);
          await writeFile(
            path.join(fixture.worktree, 'reviewed.ts'),
            'changed before baseline\n',
          );
          return scope;
        },
        selection: {
          async preflight() {
            preflights += 1;
            return readyProvider('claude');
          },
        },
      },
    );

    expect(preflights).toBe(0);
    expect(invocations).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      status: 'predispatch_failed',
      invocation_count: 0,
      reason: 'captured_scope_drift',
      drift: { checked: true, stable: false },
    });
  });

  it('returns an empty-scope no-op with zero provider invocations', async () => {
    const fixture = await gitReviewFixture();
    let preflights = 0;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'base_branch', ref: fixture.head },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
      },
      {
        env: fixture.env,
        selection: {
          async preflight() {
            preflights += 1;
            return readyProvider('claude');
          },
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'empty_scope',
      invocation_count: 0,
    });
    expect(preflights).toBe(0);
  });

  it('marks invalid and hostile nested replies defective without repair or fallback', async () => {
    const fixture = await gitReviewFixture();
    let invocations = 0;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'invalid-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        invocations += 1;
        const reply = validPassReply(scopeToken(request.prompt));
        return successEnvelope({
          ...reply,
          checks: [{ name: 'fixture', status: 'passed', hostile: true }],
        });
      }),
    );

    expect(invocations).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      status: 'defective',
      invocation_count: 1,
      reason: 'invalid_review_reply',
    });
    if (result.ok || !result.diagnosticPath) {
      throw new Error('expected diagnostic fixture');
    }
    await expect(readFile(result.diagnosticPath, 'utf8')).resolves.toContain(
      'unknown key: hostile',
    );
  });

  it('compares returned timeout failures and does not invent a completed check', async () => {
    const fixture = await gitReviewFixture();
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'timeout-run',
      },
      reviewExecutionDependencies(fixture, async () => ({
        schema_version: 'v1',
        ok: false,
        provider: 'claude',
        code: 'PROVIDER_TIMEOUT',
        message: 'fixture timeout',
        retryable: false,
        attempts: {
          cli_attempts: 1,
          terminal_reason: 'timeout',
          retryable: false,
        },
      })),
    );

    expect(result).toMatchObject({
      ok: false,
      status: 'incomplete',
      invocation_count: 1,
      reason: 'PROVIDER_TIMEOUT',
      drift: { checked: true, stable: true },
    });
  });

  it('persists a defective diagnostic when selected content drifts during the invocation', async () => {
    const fixture = await gitReviewFixture();
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'drift-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        await writeFile(
          path.join(fixture.worktree, 'reviewed.ts'),
          'changed\n',
        );
        return successEnvelope(validPassReply(scopeToken(request.prompt)));
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      status: 'defective',
      invocation_count: 1,
      reason: 'scope_drift',
      drift: { checked: true, stable: false },
    });
    await expectDiagnosticReferencesEvidence(
      result,
      'The bounded fixture passes.',
    );
  });

  it('persists a labeled diagnostic after result persistence failure without rerunning the provider', async () => {
    const fixture = await gitReviewFixture();
    let writes = 0;
    let invocations = 0;
    let diagnosticTarget = '';
    let diagnosticValue: unknown;
    let providerEvidenceTarget = '';
    let providerEvidenceValue: unknown;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'output-run',
      },
      {
        ...reviewExecutionDependencies(fixture, async (request) => {
          invocations += 1;
          return successEnvelope(validPassReply(scopeToken(request.prompt)));
        }),
        async persist(target, value) {
          writes += 1;
          if (writes === 3) {
            providerEvidenceTarget = target;
            providerEvidenceValue = value;
          }
          if (writes === 4) throw new Error('fixture output failure');
          if (writes === 5) {
            diagnosticTarget = target;
            diagnosticValue = value;
          }
        },
      },
    );

    expect(invocations).toBe(1);
    expect(writes).toBe(5);
    expect(path.basename(providerEvidenceTarget)).toBe(
      'provider-evidence.json',
    );
    expect(providerEvidenceValue).toMatchObject({
      stdout: { text: expect.stringContaining('The bounded fixture passes.') },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 'output_failed',
      invocation_count: 1,
      reason: 'result_persistence_failed',
      diagnosticPath: diagnosticTarget,
      drift: { checked: true, stable: true },
    });
    expect(diagnosticValue).toMatchObject({
      status: 'output_failed',
      invocation_count: 1,
      reason: 'result_persistence_failed',
      message: 'fixture output failure',
      drift: { checked: true, stable: true },
      provider_evidence: providerEvidenceTarget,
    });
  });

  it('reports both result and diagnostic persistence errors without rerunning the provider', async () => {
    const fixture = await gitReviewFixture();
    let writes = 0;
    let invocations = 0;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'double-output-failure-run',
      },
      {
        ...reviewExecutionDependencies(fixture, async (request) => {
          invocations += 1;
          return successEnvelope(validPassReply(scopeToken(request.prompt)));
        }),
        async persist() {
          writes += 1;
          if (writes === 4) throw new Error('fixture result failure');
          if (writes === 5) throw new Error('fixture diagnostic failure');
        },
      },
    );

    expect(invocations).toBe(1);
    expect(writes).toBe(5);
    expect(result).toMatchObject({
      ok: false,
      status: 'output_failed',
      invocation_count: 1,
      reason: 'result_and_diagnostic_persistence_failed',
    });
    if (result.ok) throw new Error('expected output failure');
    expect(result.message).toContain('fixture result failure');
    expect(result.message).toContain('fixture diagnostic failure');
  });

  it('rejects a transport envelope that reports more than one invocation', async () => {
    const fixture = await gitReviewFixture();
    let calls = 0;
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'attempt-count-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        calls += 1;
        const envelope = successEnvelope(
          validPassReply(scopeToken(request.prompt)),
        );
        envelope.attempts.cli_attempts = 2;
        return envelope;
      }),
    );

    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      status: 'defective',
      invocation_count: 2,
      reason: 'invocation_count_invalid',
    });
    await expectDiagnosticReferencesEvidence(
      result,
      'The bounded fixture passes.',
    );
  });

  it('derives pass from a changes_requested reply with only medium findings and keeps the claim', async () => {
    const fixture = await gitReviewFixture();
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'derived-pass-run',
      },
      reviewExecutionDependencies(fixture, async (request) =>
        successEnvelope({
          ...validPassReply(scopeToken(request.prompt)),
          verdict: 'changes_requested',
          findings: [findingAt('medium', 1, sourceVersion(request.prompt))],
        }),
      ),
    );

    if (!result.ok || result.status !== 'completed') {
      throw new Error(`expected completed review: ${JSON.stringify(result)}`);
    }
    expect(result.aggregate.reply.verdict).toBe('pass');
    expect(result.aggregate.claimed_verdict).toBe('changes_requested');
    expect(result.aggregate.warnings).toEqual([
      expect.stringContaining('claimed changes_requested'),
    ]);
  });

  it('derives changes_requested from a high finding past the cap and stores only the capped findings', async () => {
    const fixture = await gitReviewFixture();
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'over-cap-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        const version = sourceVersion(request.prompt);
        return successEnvelope({
          ...validPassReply(scopeToken(request.prompt)),
          verdict: 'pass',
          findings: Array.from({ length: 150 }, (_, index) =>
            findingAt(index === 139 ? 'high' : 'low', index + 1, version),
          ),
        });
      }),
    );

    if (!result.ok || result.status !== 'completed') {
      throw new Error(`expected completed review: ${JSON.stringify(result)}`);
    }
    expect(result.aggregate.reply.verdict).toBe('changes_requested');
    expect(result.aggregate.claimed_verdict).toBe('pass');
    expect(result.aggregate.reply.findings).toHaveLength(100);
    expect(result.aggregate.reply.findings[0]).toMatchObject({
      severity: 'high',
      title: 'Finding 140',
    });
    expect(result.aggregate.truncation).toMatchObject({
      truncated: true,
      omitted: { findings: 50 },
    });
  });

  it('cuts an over-long summary, derives from a failed check past the cap, and lists skipped binaries', async () => {
    const fixture = await gitReviewFixture();
    await writeFile(
      path.join(fixture.worktree, 'image.bin'),
      Buffer.from([0x89, 0x00]),
    );
    const summary = 's'.repeat(9000);
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts', 'image.bin'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'over-cap-checks-run',
      },
      reviewExecutionDependencies(fixture, async (request) =>
        successEnvelope({
          ...validPassReply(scopeToken(request.prompt)),
          summary,
          checks: Array.from({ length: 120 }, (_, index) => ({
            name: `check ${index + 1}`,
            status: index === 119 ? 'failed' : 'passed',
          })),
        }),
      ),
    );

    if (!result.ok || result.status !== 'completed') {
      throw new Error(`expected completed review: ${JSON.stringify(result)}`);
    }
    const reply = result.aggregate.reply;
    expect(reply.verdict).toBe('changes_requested');
    expect(reply.checks).toHaveLength(100);
    expect(reply.checks[0]).toMatchObject({
      name: 'check 120',
      status: 'failed',
    });
    expect(reply.summary.length).toBeLessThanOrEqual(8192);
    expect(reply.summary).toMatch(/^s+ \[truncated \d+ of 9000 characters\]$/u);
    const kept = reply.summary.indexOf(' ');
    expect(reply.summary).toContain(`[truncated ${9000 - kept} of 9000`);
    expect(result.aggregate.truncation).toMatchObject({
      omitted: { checks: 20 },
      strings_cut: 1,
    });
    expect(result.aggregate.host_limitations).toEqual([
      expect.stringContaining('image.bin'),
    ]);
  });

  it('saves no provider evidence when the transport stops before dispatch', async () => {
    const fixture = await gitReviewFixture();
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'codex',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'predispatch-transport-run',
      },
      {
        ...reviewExecutionDependencies(fixture, async () => {
          throw new Error('no provider should run');
        }),
        transport: async () => ({
          ok: false,
          status: 'preflight_failed',
          invocation_count: 0,
          reason: 'provider_not_ready',
          message: 'Provider is not ready.',
        }),
      },
    );

    if (result.ok || !result.diagnosticPath || !result.runState) {
      throw new Error(`expected a diagnostic: ${JSON.stringify(result)}`);
    }
    expect(result).toMatchObject({ status: 'predispatch_failed' });
    expect(result.providerEvidencePath).toBeUndefined();
    const diagnostic = JSON.parse(
      await readFile(result.diagnosticPath, 'utf8'),
    );
    expect(diagnostic).not.toHaveProperty('provider_evidence');
    expect(diagnostic).not.toHaveProperty('codex_last_message');
    await expect(
      lstat(path.join(result.runState.runDirectory, 'provider-evidence.json')),
    ).rejects.toThrow('ENOENT');
  });

  it('references the preserved Codex last-message capture when a Codex review fails', async () => {
    const fixture = await gitReviewFixture();
    const result = await executeBoundedReview(
      {
        cwd: fixture.worktree,
        scope: { kind: 'files', paths: ['reviewed.ts'] },
        host: 'claude',
        request: 'Review.',
        hostSummary: '',
        schemaPath: fixture.schema,
        runId: 'codex-failure-run',
      },
      {
        env: { ...fixture.env, CONSENSUS_PARENT_HOST: 'claude' },
        selection: { preflight: async () => readyProvider('codex') },
        transportDependencies: {
          async runTurn(_request, dependencies) {
            await writeFile(
              dependencies.transport!.lastMessageFile!,
              '{"verdict":"pass","partial":true}',
            );
            return {
              schema_version: 'v1',
              ok: false,
              provider: 'codex',
              code: 'PROVIDER_INVALID_JSON',
              message: 'fixture invalid reply',
              retryable: false,
              stdout: '{"type":"turn.completed"}',
              attempts: {
                cli_attempts: 1,
                terminal_reason: 'invalid_json',
                retryable: false,
              },
            };
          },
        },
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 'incomplete',
      reason: 'PROVIDER_INVALID_JSON',
    });
    if (result.ok || !result.diagnosticPath) {
      throw new Error('expected diagnostic');
    }
    const diagnostic = JSON.parse(
      await readFile(result.diagnosticPath, 'utf8'),
    );
    expect(path.basename(diagnostic.codex_last_message)).toBe(
      'last-message.json',
    );
    const evidence = JSON.parse(
      await readFile(diagnostic.provider_evidence, 'utf8'),
    );
    expect(evidence.codex_last_message).toMatchObject({
      path: diagnostic.codex_last_message,
      text: '{"verdict":"pass","partial":true}',
    });
    expect(evidence.stdout.text).toBe('{"type":"turn.completed"}');
  });
});

describe('deep review reply validation', () => {
  it('validates captured source versions, line ranges, anchors, and derives the verdict', async () => {
    const fixture = await gitReviewFixture();
    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'files', paths: ['reviewed.ts'] },
    });
    const version = scope.versions[0];
    const reply = {
      ...validPassReply(scope.token),
      verdict: 'changes_requested',
      findings: [
        {
          severity: 'high',
          title: 'Fixture finding',
          location: {
            path: 'reviewed.ts',
            start_line: 1,
            end_line: 1,
            source_version: version.sha256,
          },
          claim: 'A bounded claim.',
          evidence: 'Captured evidence.',
          suggestion: 'Apply a bounded correction.',
          confidence: 0.8,
        },
      ],
    };

    expect(validateReviewReply(reply, scope)).toMatchObject({ ok: true });
    expect(
      validateReviewReply(
        {
          ...reply,
          findings: [
            {
              ...reply.findings[0],
              location: {
                ...reply.findings[0].location,
                path: '../escape.ts',
                end_line: 99,
                source_version: 'wrong',
              },
              anchor: 'cannot have both',
              confidence: Number.POSITIVE_INFINITY,
            },
          ],
        },
        scope,
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateReviewReply(
        { ...validPassReply(scope.token), findings: [reply.findings[0]] },
        scope,
      ),
    ).toMatchObject({
      ok: true,
      claimedVerdict: 'pass',
      value: { verdict: 'changes_requested' },
    });
    expect(
      validateReviewReply(
        {
          ...reply,
          findings: [{ ...reply.findings[0], severity: 'important' }],
        },
        scope,
      ),
    ).toMatchObject({ ok: false });
  });
});

function readyProvider(id: 'claude' | 'codex'): ProviderInventoryEntry {
  return {
    id,
    status: 'ready',
    capabilities: {
      schema_strategies:
        id === 'codex'
          ? ['constrained_native', 'prompt_only']
          : ['provider_validated', 'prompt_only'],
      output_modes: id === 'codex' ? ['last_message_file'] : ['stdout_json'],
      options: {
        model: true,
        effort: id === 'codex' ? 'reasoning_effort' : 'effort',
        runtime_policy: {
          permission_modes: ['non-interactive', 'read-only'],
          ...(id === 'codex'
            ? {
                sandboxes: ['read-only'],
                approval_policies: ['never'],
              }
            : {}),
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  };
}

async function reviewFixture() {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'consensus-review-run-')),
  );
  fixtureRoots.push(root);
  const worktree = path.join(root, 'worktree');
  const runRoot = path.join(root, 'private-run');
  const schema = path.join(root, 'review.schema.json');
  await mkdir(worktree);
  await mkdir(runRoot, { mode: 0o700 });
  await chmod(runRoot, 0o700);
  await writeFile(schema, '{}');
  return {
    root,
    worktree,
    runRoot,
    schema,
    capture: path.join(runRoot, 'last-message.json'),
  };
}

async function gitReviewFixture(): Promise<{
  root: string;
  worktree: string;
  schema: string;
  head: string;
  env: NodeJS.ProcessEnv;
}> {
  const fixture = await reviewFixture();
  execFileSync('git', ['init', '-q'], { cwd: fixture.worktree });
  execFileSync('git', ['config', 'user.email', 'fixture@example.com'], {
    cwd: fixture.worktree,
  });
  execFileSync('git', ['config', 'user.name', 'Fixture'], {
    cwd: fixture.worktree,
  });
  await writeFile(
    path.join(fixture.worktree, 'reviewed.ts'),
    'const value = 1;\n',
  );
  execFileSync('git', ['add', '.'], { cwd: fixture.worktree });
  execFileSync('git', ['commit', '-q', '-m', 'base'], {
    cwd: fixture.worktree,
  });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fixture.worktree,
    encoding: 'utf8',
  }).trim();
  return {
    root: fixture.root,
    worktree: fixture.worktree,
    schema: fixture.schema,
    head,
    env: {
      HOME: fixture.root,
      XDG_STATE_HOME: path.join(fixture.root, 'state'),
      CONSENSUS_PARENT_HOST: 'codex',
      CONSENSUS_DEPTH: '0',
    },
  };
}

function reviewExecutionDependencies(
  fixture: Awaited<ReturnType<typeof gitReviewFixture>>,
  runTurn: NonNullable<ReviewRunDependencies['runTurn']>,
): ExecuteReviewDependencies {
  return {
    env: fixture.env,
    selection: {
      preflight: async () => readyProvider('claude'),
    },
    transportDependencies: { runTurn },
  };
}

async function expectDiagnosticReferencesEvidence(
  result: Awaited<ReturnType<typeof executeBoundedReview>>,
  stdoutFragment: string,
): Promise<void> {
  if (result.ok || !result.diagnosticPath) {
    throw new Error('expected a persisted diagnostic');
  }
  const diagnostic = JSON.parse(await readFile(result.diagnosticPath, 'utf8'));
  expect(diagnostic.provider_evidence).toBe(result.providerEvidencePath);
  const evidence = JSON.parse(
    await readFile(diagnostic.provider_evidence, 'utf8'),
  );
  expect(evidence.stdout.text).toContain(stdoutFragment);
}

// The prompt no longer carries the manifest, so a fixture reviewer reads the
// captured version from evidence.json like a real one.
function sourceVersion(prompt: string): string {
  const evidencePath = /^evidence_path=(.+)$/mu.exec(prompt)?.[1];
  if (!evidencePath) throw new Error('evidence path missing from prompt');
  const scope = JSON.parse(readFileSync(evidencePath, 'utf8'));
  return scope.versions[0].sha256;
}

function findingAt(severity: string, index: number, version: string) {
  return {
    severity,
    title: `Finding ${index}`,
    location: {
      path: 'reviewed.ts',
      start_line: 1,
      end_line: 1,
      source_version: version,
    },
    claim: 'A bounded claim.',
    evidence: 'Captured evidence.',
    suggestion: 'Apply a bounded correction.',
    confidence: 0.5,
  };
}

function scopeToken(prompt: string): string {
  const token = /^scope_token=(.+)$/mu.exec(prompt)?.[1];
  if (!token) throw new Error('scope token missing from fixture prompt');
  return token;
}

function validPassReply(scopeTokenValue: string) {
  return {
    schema_version: 'v1',
    scope_token: scopeTokenValue,
    verdict: 'pass',
    summary: 'The bounded fixture passes.',
    findings: [],
    questions: [],
    limitations: ['No tests were run.'],
    coverage: ['reviewed.ts'],
    inspected_context: [
      { subject: 'reviewed.ts', source_version: 'fixture-current' },
    ],
    checks: [{ name: 'tests', status: 'not_run' }],
    reviewer_identity: { provider: 'claude' },
  };
}

function successEnvelope(
  json: unknown,
): Extract<ConsensusCliRunEnvelope, { ok: true }> {
  return {
    schema_version: 'v1',
    ok: true,
    provider: 'claude',
    args: ['claude'],
    stdout: JSON.stringify(json),
    json,
    attempts: {
      cli_attempts: 1,
      terminal_reason: 'success',
      retryable: false,
    },
  };
}
import { execFileSync } from 'node:child_process';
