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

import type { ProviderInventoryEntry } from '../../../plugins/consensus/provider-cli/types.js';
import { runReview } from './run.js';

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
