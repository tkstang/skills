// Behavioral tests for scripts/worktree/validate.sh and scripts/worktree/init.sh.
//
// Both scripts are executed for real against a scratch git repo (never the
// real repo) with a stub `pnpm` (and, for init.sh, a stub `oat`) prepended to
// PATH so no real install/build/test/validate/smoke pipeline runs. Every
// spawned `git` call goes through the GIT_*-scrubbed env from
// tests/helpers/git-env.mjs — see the prior-incident note there: an
// unscrubbed GIT_DIR/GIT_WORK_TREE previously let a temp-git test suite
// corrupt the real repository when run from inside a git hook.
import { execFile as execFileCallback, spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

import { fixtureBin, parseJsonl, repoRoot } from '../helpers/process.mjs';
import { gitEnv } from '../helpers/git-env.mjs';

const execFile = promisify(execFileCallback);

const validateScriptPath = path.join(
  repoRoot,
  'scripts/worktree/validate.sh',
);
const initScriptPath = path.join(repoRoot, 'scripts/worktree/init.sh');
const oatStubDir = path.join(repoRoot, 'tests/fixtures/bin-oat');

/**
 * PATH entries from the ambient environment, with any directory that
 * resolves a real `oat` executable removed. Some dev machines have `oat`
 * installed globally; init.sh's `command -v oat` guards must be exercised
 * deterministically (stubbed-and-invoked, or genuinely absent), never by
 * accident running the real CLI against a scratch worktree.
 */
function ambientPathWithoutRealOat(): string {
  const entries = (process.env.PATH ?? '').split(path.delimiter);
  return entries
    .filter((dir) => dir && !existsSync(path.join(dir, 'oat')))
    .join(path.delimiter);
}

const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function makeScratchRepo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'worktree-script-'));
  cleanupDirs.push(root);
  await execFile('git', ['init', '-q'], { cwd: root, env: gitEnv() });
  await execFile('git', ['config', 'user.email', 'test@example.com'], {
    cwd: root,
    env: gitEnv(),
  });
  await execFile('git', ['config', 'user.name', 'Test'], {
    cwd: root,
    env: gitEnv(),
  });
  return root;
}

/** A scratch dir for artifacts (call logs) that must NOT live inside the
 * scratch git repo, since writing there would itself dirty the tree. */
async function makeScratchArtifactDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'worktree-script-out-'));
  cleanupDirs.push(dir);
  return dir;
}

interface RunOptions {
  env?: NodeJS.ProcessEnv;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runScript(
  scriptPath: string,
  cwd: string,
  options: RunOptions = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath], {
      cwd,
      env: options.env ?? gitEnv(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function pnpmStubEnv(
  overrides: NodeJS.ProcessEnv = {},
  extraPathDirs: string[] = [],
): NodeJS.ProcessEnv {
  const path_ = [...extraPathDirs, fixtureBin, ambientPathWithoutRealOat()]
    .filter(Boolean)
    .join(path.delimiter);
  return gitEnv({
    PATH: path_,
    ...overrides,
  });
}

async function readCalls<T = { step: string }>(
  callsPath: string,
): Promise<T[]> {
  if (!existsSync(callsPath)) {
    return [];
  }
  const contents = await readFile(callsPath, 'utf8');
  if (!contents.trim()) {
    return [];
  }
  return parseJsonl<T>(contents);
}

describe('scripts/worktree/validate.sh', () => {
  const documentedStepOrder = [
    'install',
    'build',
    'type-check',
    'build:check',
    'test',
    'validate',
    'smoke',
    'build:check',
  ];

  it('fails closed on a dirty tree before invoking the pipeline', async () => {
    const repo = await makeScratchRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    // An untracked file makes `git status --short` non-empty.
    await writeFile(path.join(repo, 'untracked.txt'), 'dirty\n');

    const result = await runScript(validateScriptPath, repo, {
      env: pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: callsPath }),
    });

    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/worktree is not clean before validation/);

    const calls = await readCalls(callsPath);
    expect(calls).toEqual([]);
  });

  it('passes and runs the documented pipeline in order on a clean tree', async () => {
    const repo = await makeScratchRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    const result = await runScript(validateScriptPath, repo, {
      env: pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: callsPath }),
    });

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/worktree validation passed/);

    const calls = await readCalls(callsPath);
    expect(calls.map((call) => call.step)).toEqual(documentedStepOrder);
  });

  it('detects post-pipeline drift (generated output left uncommitted)', async () => {
    const repo = await makeScratchRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    const result = await runScript(validateScriptPath, repo, {
      env: pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: callsPath,
        // Simulate the `test` step leaving a generated file behind.
        PNPM_STUB_DIRTY_ON_STEP: 'test',
      }),
    });

    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/worktree is not clean after validation/);

    // The whole pipeline still ran (drift is only checked at the explicit
    // checkpoints, not after every step) — proves this is a *post-run*
    // detection, not a fail-fast short-circuit.
    const calls = await readCalls(callsPath);
    expect(calls.map((call) => call.step)).toEqual(documentedStepOrder);
  });

  it('propagates a nonzero exit code from a failing pipeline step', async () => {
    const repo = await makeScratchRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    const result = await runScript(validateScriptPath, repo, {
      env: pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: callsPath,
        PNPM_STUB_FAIL_STEP: 'validate',
      }),
    });

    expect(result.code).not.toBe(0);

    // `set -euo pipefail` must stop the pipeline at the failing step: smoke
    // and the final build:check never run.
    const calls = await readCalls(callsPath);
    expect(calls.map((call) => call.step)).toEqual([
      'install',
      'build',
      'type-check',
      'build:check',
      'test',
      'validate',
    ]);
  });
});

describe('scripts/worktree/init.sh', () => {
  async function makeMainAndTargetWorktree(): Promise<{
    mainRoot: string;
    targetRoot: string;
  }> {
    // init.sh resolves the "main" worktree via `git rev-parse --git-common-dir`
    // from the target worktree, so this must be a real linked worktree pair,
    // not two unrelated repos.
    const mainRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-init-main-'));
    cleanupDirs.push(mainRoot);
    await execFile('git', ['init', '-q'], { cwd: mainRoot, env: gitEnv() });
    await execFile('git', ['config', 'user.email', 'test@example.com'], {
      cwd: mainRoot,
      env: gitEnv(),
    });
    await execFile('git', ['config', 'user.name', 'Test'], {
      cwd: mainRoot,
      env: gitEnv(),
    });
    await writeFile(path.join(mainRoot, 'README.md'), '# scratch\n');
    await execFile('git', ['add', '-A'], { cwd: mainRoot, env: gitEnv() });
    await execFile('git', ['commit', '-q', '-m', 'base'], {
      cwd: mainRoot,
      env: gitEnv(),
    });
    await execFile(
      'git',
      ['branch', 'feature'],
      { cwd: mainRoot, env: gitEnv() },
    );

    // Mirror this repo's own convention (`.worktrees/<wave>/<phase>`), which
    // init.sh's find-based copy steps deliberately exclude via
    // `-not -path "*/.worktrees/*"` / `-path "*/.worktrees" -prune`.
    const targetRoot = path.join(mainRoot, '.worktrees', 'target');
    await execFile(
      'git',
      ['worktree', 'add', '-q', targetRoot, 'feature'],
      { cwd: mainRoot, env: gitEnv() },
    );
    // targetRoot is under mainRoot, which is already queued for cleanup.

    return { mainRoot, targetRoot };
  }

  it('copies local-only files from the main worktree into the target', async () => {
    const { mainRoot, targetRoot } = await makeMainAndTargetWorktree();

    await writeFile(path.join(mainRoot, '.env.local'), 'SECRET=1\n');
    await mkdir(path.join(mainRoot, '.oat'), { recursive: true });
    await writeFile(
      path.join(mainRoot, '.oat/config.local.json'),
      '{"local":true}\n',
    );
    await mkdir(path.join(mainRoot, '.oat/projects/local'), {
      recursive: true,
    });
    await writeFile(
      path.join(mainRoot, '.oat/projects/local/note.md'),
      'local project\n',
    );
    await mkdir(path.join(mainRoot, '.oat/projects/archived/old-project'), {
      recursive: true,
    });
    await writeFile(
      path.join(mainRoot, '.oat/projects/archived/old-project/summary.md'),
      'archived project\n',
    );

    // Representative fixtures for copy_matching_files' three -o patterns
    // (init.sh:95-98): a top-level .mcp.json, a nested .claude/settings.local.json,
    // and a nested .cursor/mcp.json.
    await writeFile(
      path.join(mainRoot, '.mcp.json'),
      '{"mcpServers":{}}\n',
    );
    await mkdir(path.join(mainRoot, '.claude'), { recursive: true });
    await writeFile(
      path.join(mainRoot, '.claude/settings.local.json'),
      '{"claude":true}\n',
    );
    await mkdir(path.join(mainRoot, '.cursor'), { recursive: true });
    await writeFile(
      path.join(mainRoot, '.cursor/mcp.json'),
      '{"cursor":true}\n',
    );

    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    const result = await runScript(initScriptPath, targetRoot, {
      env: pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: callsPath,
        SKIP_S3_ARCHIVE_SYNC: '1',
      }),
    });

    expect(result.code, result.stderr).toBe(0);

    const copiedEnv = await readFile(
      path.join(targetRoot, '.env.local'),
      'utf8',
    );
    expect(copiedEnv).toBe('SECRET=1\n');

    const copiedConfig = await readFile(
      path.join(targetRoot, '.oat/config.local.json'),
      'utf8',
    );
    expect(copiedConfig).toBe('{"local":true}\n');

    const copiedProject = await readFile(
      path.join(targetRoot, '.oat/projects/local/note.md'),
      'utf8',
    );
    expect(copiedProject).toBe('local project\n');

    const copiedArchivedProject = await readFile(
      path.join(targetRoot, '.oat/projects/archived/old-project/summary.md'),
      'utf8',
    );
    expect(copiedArchivedProject).toBe('archived project\n');

    const copiedMcpJson = await readFile(
      path.join(targetRoot, '.mcp.json'),
      'utf8',
    );
    expect(copiedMcpJson).toBe('{"mcpServers":{}}\n');

    const copiedClaudeSettings = await readFile(
      path.join(targetRoot, '.claude/settings.local.json'),
      'utf8',
    );
    expect(copiedClaudeSettings).toBe('{"claude":true}\n');

    const copiedCursorMcp = await readFile(
      path.join(targetRoot, '.cursor/mcp.json'),
      'utf8',
    );
    expect(copiedCursorMcp).toBe('{"cursor":true}\n');

    // `oat` is not on the stub PATH, so OAT sync steps must be cleanly
    // skipped rather than erroring.
    expect(result.stdout).toMatch(/oat not on PATH/);

    // `pnpm install` (no lockfile assertions here — init.sh's contract is the
    // file-copy semantics) is still invoked.
    const calls = await readCalls(callsPath);
    expect(calls.map((call) => call.step)).toContain('install');
  });

  it('tolerates absent local-only files without failing', async () => {
    const { targetRoot } = await makeMainAndTargetWorktree();

    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    const result = await runScript(initScriptPath, targetRoot, {
      env: pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: callsPath,
        SKIP_S3_ARCHIVE_SYNC: '1',
      }),
    });

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/skip \(missing\).*config\.local\.json/);
    expect(result.stdout).toMatch(/worktree init complete/);
  });

  it('invokes oat sync steps when oat is on PATH', async () => {
    const { targetRoot } = await makeMainAndTargetWorktree();

    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');
    const oatCallsPath = path.join(artifacts, 'oat-calls.jsonl');

    const result = await runScript(
      initScriptPath,
      targetRoot,
      {
        env: pnpmStubEnv(
          {
            PNPM_STUB_CALLS_JSONL: callsPath,
            OAT_STUB_CALLS_JSONL: oatCallsPath,
            SKIP_S3_ARCHIVE_SYNC: '1',
          },
          [oatStubDir],
        ),
      },
    );

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/oat not on PATH/);

    const oatCalls = await readCalls<{ args: string[] }>(oatCallsPath);
    const oatInvocations = oatCalls.map((call) => call.args.join(' '));
    expect(oatInvocations).toContain('sync --scope all');

    // Compare via realpath: macOS temp dirs resolve through a symlink
    // (/var/folders -> /private/var/folders), and `git rev-parse
    // --show-toplevel` returns the physical path, so a raw string
    // comparison against the mkdtemp-returned path would be flaky.
    const localSyncCall = oatCalls.find(
      (call) => call.args[0] === 'local' && call.args[1] === 'sync',
    );
    expect(localSyncCall, oatInvocations.join('\n')).toBeDefined();
    const resolvedArg = await realpath(localSyncCall!.args[2]);
    const resolvedTarget = await realpath(targetRoot);
    expect(resolvedArg).toBe(resolvedTarget);
  });
});
