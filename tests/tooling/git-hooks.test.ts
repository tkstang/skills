// Characterization tests for tools/git-hooks/manage-hooks.mjs and the four
// thin hook scripts it installs (commit-msg, pre-commit, pre-push,
// post-checkout).
//
// manage-hooks.mjs resolves both its hook *source* directory
// (`path.resolve('tools/git-hooks')`) and its *target* `.git/hooks` directory
// (`git rev-parse --git-path hooks`) relative to the current working
// directory — so every invocation here runs against a scratch git repo that
// also has its own `tools/git-hooks/` copy, with `cwd` set to that scratch
// repo. Running it with cwd pointed at the real repo (even with GIT_DIR
// scrubbed) would symlink/unlink hooks in the *real* .git/hooks — the same
// class of mistake the prior-incident rule in tests/helpers/git-env.mjs
// guards against. Every spawned `git` call also goes through that scrub.
import { execFile as execFileCallback, spawn } from 'node:child_process';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

import { fixtureBin, repoRoot } from '../helpers/process.mjs';
import { gitEnv } from '../helpers/git-env.mjs';

const execFile = promisify(execFileCallback);

const realHooksDir = path.join(repoRoot, 'tools/git-hooks');
const manageHooksScript = path.join(realHooksDir, 'manage-hooks.mjs');
const hookNames = ['commit-msg', 'pre-commit', 'pre-push', 'post-checkout'];

const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function makeScratchArtifactDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'git-hooks-out-'));
  cleanupDirs.push(dir);
  return dir;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  input?: string,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env });
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
    if (input !== undefined) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

function pnpmStubEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  // Deliberately exclude any ambient `oat` so `command -v oat` guards in
  // pre-commit/pre-push resolve false unless a test opts in.
  const entries = (process.env.PATH ?? '').split(path.delimiter);
  const withoutOat = entries
    .filter((dir) => dir && !existsSync(path.join(dir, 'oat')))
    .join(path.delimiter);
  return gitEnv({
    PATH: `${fixtureBin}${path.delimiter}${withoutOat}`,
    ...overrides,
  });
}

/** PATH with no `pnpm` resolvable at all (not even the fixture stub) — for
 * the DX-05 pnpm-missing guard case. */
function envWithoutPnpm(): NodeJS.ProcessEnv {
  const entries = (process.env.PATH ?? '').split(path.delimiter);
  const withoutPnpm = entries
    .filter((dir) => dir && !existsSync(path.join(dir, 'pnpm')))
    .join(path.delimiter);
  return gitEnv({ PATH: withoutPnpm });
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
  return contents
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as T);
}

describe('tools/git-hooks/manage-hooks.mjs', () => {
  async function makeScratchHooksRepo(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), 'git-hooks-repo-'));
    cleanupDirs.push(root);
    await execFile('git', ['init', '-q'], { cwd: root, env: gitEnv() });

    // manage-hooks.mjs resolves its hook SOURCE dir relative to cwd too, so
    // the scratch repo needs its own tools/git-hooks/ copy of the real
    // scripts (executable bit included).
    const scratchHooksDir = path.join(root, 'tools/git-hooks');
    await mkdir(scratchHooksDir, { recursive: true });
    for (const hook of hookNames) {
      const dest = path.join(scratchHooksDir, hook);
      await copyFile(path.join(realHooksDir, hook), dest);
      await chmod(dest, 0o755);
    }

    return root;
  }

  function gitHooksDirFor(root: string): string {
    return path.join(root, '.git/hooks');
  }

  async function runManageHooks(
    root: string,
    args: string[],
  ): Promise<RunResult> {
    return run(process.execPath, [manageHooksScript, ...args], root, gitEnv());
  }

  it('status reports every hook as not installed on a fresh repo', async () => {
    const root = await makeScratchHooksRepo();

    const result = await runManageHooks(root, ['status']);

    expect(result.code).toBe(0);
    for (const hook of hookNames) {
      expect(result.stdout).toMatch(new RegExp(`${hook}\\s+.*Not installed`));
    }
  });

  it('enable-all symlinks every hook into the resolved hooks dir', async () => {
    const root = await makeScratchHooksRepo();
    const gitHooksDir = gitHooksDirFor(root);

    const result = await runManageHooks(root, ['enable-all']);
    expect(result.code).toBe(0);

    for (const hook of hookNames) {
      const hookPath = path.join(gitHooksDir, hook);
      const linkStat = await lstat(hookPath);
      expect(linkStat.isSymbolicLink(), `${hook} should be a symlink`).toBe(
        true,
      );

      const target = await readlink(hookPath);
      const expectedTarget = path.relative(
        gitHooksDir,
        path.join(root, 'tools/git-hooks', hook),
      );
      expect(target).toBe(expectedTarget);
    }

    // enable-all round trip: status now reports every hook Enabled.
    const status = await runManageHooks(root, ['status']);
    for (const hook of hookNames) {
      expect(status.stdout).toMatch(new RegExp(`${hook}\\s+.*Enabled`));
    }

    // .disabled-hooks must not exist after a clean enable-all.
    expect(existsSync(path.join(gitHooksDir, '.disabled-hooks'))).toBe(false);
  });

  it('disable-all removes symlinks and records intentional disablement', async () => {
    const root = await makeScratchHooksRepo();
    const gitHooksDir = gitHooksDirFor(root);

    await runManageHooks(root, ['enable-all']);
    const result = await runManageHooks(root, ['disable-all']);
    expect(result.code).toBe(0);

    for (const hook of hookNames) {
      expect(existsSync(path.join(gitHooksDir, hook))).toBe(false);
    }

    const disabledFile = path.join(gitHooksDir, '.disabled-hooks');
    expect(existsSync(disabledFile)).toBe(true);
    const disabledContents = (await readFile(disabledFile, 'utf8'))
      .trim()
      .split('\n')
      .sort();
    expect(disabledContents).toEqual([...hookNames].sort());

    // disable-all round trip: status now reports every hook intentionally disabled.
    const status = await runManageHooks(root, ['status']);
    for (const hook of hookNames) {
      expect(status.stdout).toMatch(
        new RegExp(`${hook}\\s+.*Disabled \\(intentional\\)`),
      );
    }
  });
});

describe('git hook scripts (delegation and exit-code propagation)', () => {
  async function makeScratchHookRunRepo(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), 'git-hook-run-'));
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

  /** Stub scripts/validate-skill-versions.mjs and scripts/validate-internal-flags.mjs
   * that pre-push invokes by relative path (not via PATH), so the hook's
   * delegation chain can be exercised without touching the real repo's
   * validators. */
  async function stubPrePushNodeScripts(
    root: string,
    callsPath: string,
    failScript?: string,
  ): Promise<void> {
    await mkdir(path.join(root, 'scripts'), { recursive: true });
    for (const name of [
      'validate-skill-versions.mjs',
      'validate-internal-flags.mjs',
    ]) {
      const exitLine =
        failScript === name ? 'process.exit(1);' : 'process.exit(0);';
      await writeFile(
        path.join(root, 'scripts', name),
        [
          "import { appendFileSync } from 'node:fs';",
          `appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify({ script: ${JSON.stringify(name)}, args: process.argv.slice(2) }) + '\\n');`,
          exitLine,
          '',
        ].join('\n'),
      );
    }
  }

  it('commit-msg delegates to `pnpm exec commitlint` and propagates its exit code', async () => {
    const root = await makeScratchHookRunRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');
    const msgFile = path.join(artifacts, 'COMMIT_EDITMSG');
    await writeFile(msgFile, 'feat(x): message\n');

    const ok = await run(
      'sh',
      [path.join(realHooksDir, 'commit-msg'), msgFile],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: callsPath }),
    );
    expect(ok.code).toBe(0);
    const calls = await readCalls(callsPath);
    expect(calls).toEqual([
      { step: 'commitlint', args: ['exec', 'commitlint', '--edit', msgFile] },
    ]);

    const failCallsPath = path.join(artifacts, 'fail-calls.jsonl');
    const failed = await run(
      'sh',
      [path.join(realHooksDir, 'commit-msg'), msgFile],
      root,
      pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: failCallsPath,
        PNPM_STUB_FAIL_STEP: 'commitlint',
      }),
    );
    expect(failed.code).not.toBe(0);
  });

  it('pre-commit delegates to `pnpm exec lint-staged` and propagates its exit code', async () => {
    const root = await makeScratchHookRunRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');

    const ok = await run(
      'sh',
      [path.join(realHooksDir, 'pre-commit')],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: callsPath }),
    );
    expect(ok.code, ok.stderr).toBe(0);
    const calls = await readCalls(callsPath);
    expect(calls.map((call) => call.step)).toEqual(['lint-staged']);

    const failCallsPath = path.join(artifacts, 'fail-calls.jsonl');
    const failed = await run(
      'sh',
      [path.join(realHooksDir, 'pre-commit')],
      root,
      pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: failCallsPath,
        PNPM_STUB_FAIL_STEP: 'lint-staged',
      }),
    );
    expect(failed.code).not.toBe(0);
  });

  it('pre-commit fails closed with an actionable message when pnpm is missing (DX-05)', async () => {
    const root = await makeScratchHookRunRepo();

    const result = await run(
      'sh',
      [path.join(realHooksDir, 'pre-commit')],
      root,
      envWithoutPnpm(),
    );

    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/pnpm not found on PATH/);
  });

  it('pre-push runs its static checks in order, then the skill-version and internal-flag validators', async () => {
    const root = await makeScratchHookRunRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');
    const nodeCallsPath = path.join(artifacts, 'node-calls.jsonl');
    await stubPrePushNodeScripts(root, nodeCallsPath);

    const result = await run(
      'sh',
      [path.join(realHooksDir, 'pre-push')],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: callsPath }),
    );

    expect(result.code, result.stderr).toBe(0);
    const calls = await readCalls(callsPath);
    expect(calls.map((call) => call.step)).toEqual([
      'validate',
      'build:check',
      'type-check',
    ]);

    const nodeCalls = await readCalls<{ script: string }>(nodeCallsPath);
    expect(nodeCalls.map((call) => call.script)).toEqual([
      'validate-skill-versions.mjs',
      'validate-internal-flags.mjs',
    ]);
  });

  it('pre-push stops before the node validators when a pnpm step fails', async () => {
    const root = await makeScratchHookRunRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');
    const nodeCallsPath = path.join(artifacts, 'node-calls.jsonl');
    await stubPrePushNodeScripts(root, nodeCallsPath);

    const result = await run(
      'sh',
      [path.join(realHooksDir, 'pre-push')],
      root,
      pnpmStubEnv({
        PNPM_STUB_CALLS_JSONL: callsPath,
        PNPM_STUB_FAIL_STEP: 'build:check',
      }),
    );

    expect(result.code).not.toBe(0);
    const calls = await readCalls(callsPath);
    // `type-check` (after the failing build:check) never runs — `set -e`.
    expect(calls.map((call) => call.step)).toEqual(['validate', 'build:check']);

    const nodeCalls = await readCalls<{ script: string }>(nodeCallsPath);
    expect(nodeCalls).toEqual([]);
  });

  it('pre-push propagates a failure from the skill-version validator', async () => {
    const root = await makeScratchHookRunRepo();
    const artifacts = await makeScratchArtifactDir();
    const callsPath = path.join(artifacts, 'calls.jsonl');
    const nodeCallsPath = path.join(artifacts, 'node-calls.jsonl');
    await stubPrePushNodeScripts(
      root,
      nodeCallsPath,
      'validate-skill-versions.mjs',
    );

    const result = await run(
      'sh',
      [path.join(realHooksDir, 'pre-push')],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: callsPath }),
    );

    expect(result.code).not.toBe(0);
    const nodeCalls = await readCalls<{ script: string }>(nodeCallsPath);
    // internal-flags validator never runs once skill-versions fails.
    expect(nodeCalls.map((call) => call.script)).toEqual([
      'validate-skill-versions.mjs',
    ]);
  });

  it('pre-push fails closed with an actionable message when pnpm is missing (DX-05)', async () => {
    const root = await makeScratchHookRunRepo();

    const result = await run(
      'sh',
      [path.join(realHooksDir, 'pre-push')],
      root,
      envWithoutPnpm(),
    );

    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/pnpm not found on PATH/);
  });

  it('post-checkout reinstalls only when pnpm-lock.yaml changed and only on branch checkouts', async () => {
    const root = await makeScratchHookRunRepo();
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 1\n');
    await execFile('git', ['add', '-A'], { cwd: root, env: gitEnv() });
    await execFile('git', ['commit', '-q', '-m', 'base'], {
      cwd: root,
      env: gitEnv(),
    });
    const sha1 = (
      await execFile('git', ['rev-parse', 'HEAD'], { cwd: root, env: gitEnv() })
    ).stdout.trim();

    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 2\n');
    await execFile('git', ['commit', '-aqm', 'bump lockfile'], {
      cwd: root,
      env: gitEnv(),
    });
    const sha2 = (
      await execFile('git', ['rev-parse', 'HEAD'], { cwd: root, env: gitEnv() })
    ).stdout.trim();

    const artifacts = await makeScratchArtifactDir();

    // Lockfile changed + branch checkout ($3=1) -> pnpm invoked.
    const changedCallsPath = path.join(artifacts, 'changed-calls.jsonl');
    const changed = await run(
      'sh',
      [path.join(realHooksDir, 'post-checkout'), sha1, sha2, '1'],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: changedCallsPath }),
    );
    expect(changed.code, changed.stderr).toBe(0);
    const changedCalls = await readCalls(changedCallsPath);
    expect(changedCalls.map((call) => call.step)).toEqual(['install']);

    // Lockfile unchanged (sha2 -> sha2) -> pnpm never invoked.
    const sameCallsPath = path.join(artifacts, 'same-calls.jsonl');
    const same = await run(
      'sh',
      [path.join(realHooksDir, 'post-checkout'), sha2, sha2, '1'],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: sameCallsPath }),
    );
    expect(same.code, same.stderr).toBe(0);
    expect(await readCalls(sameCallsPath)).toEqual([]);

    // File checkout ($3=0), even with a lockfile change -> exits immediately,
    // pnpm never invoked.
    const fileCallsPath = path.join(artifacts, 'file-calls.jsonl');
    const fileCheckout = await run(
      'sh',
      [path.join(realHooksDir, 'post-checkout'), sha1, sha2, '0'],
      root,
      pnpmStubEnv({ PNPM_STUB_CALLS_JSONL: fileCallsPath }),
    );
    expect(fileCheckout.code, fileCheckout.stderr).toBe(0);
    expect(await readCalls(fileCallsPath)).toEqual([]);
  });
});
