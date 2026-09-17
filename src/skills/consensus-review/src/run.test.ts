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
        runId: 'complete-run',
      },
      reviewExecutionDependencies(fixture, async (request) => {
        invocations += 1;
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
            scope_coverage: 'unknown',
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
    await expect(readFile(result.artifactPath, 'utf8')).resolves.toContain(
      '"status": "complete"',
    );
    expect(result.artifactPath).toBe(
      path.join(result.runState.runDirectory, 'result.json'),
    );
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
  });

  it('reports output persistence failure without rerunning the provider', async () => {
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
        runId: 'output-run',
      },
      {
        ...reviewExecutionDependencies(fixture, async (request) => {
          invocations += 1;
          return successEnvelope(validPassReply(scopeToken(request.prompt)));
        }),
        async persist() {
          writes += 1;
          if (writes === 3) throw new Error('fixture output failure');
        },
      },
    );

    expect(invocations).toBe(1);
    expect(writes).toBe(3);
    expect(result).toMatchObject({
      ok: false,
      status: 'output_failed',
      invocation_count: 1,
      reason: 'result_persistence_failed',
    });
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
  });
});

describe('deep review reply validation', () => {
  it('validates captured source versions, line ranges, anchors, and verdict consistency', async () => {
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
          severity: 'important',
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
