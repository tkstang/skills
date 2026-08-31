import { execFile as nodeExecFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpath as nodeRealpath } from 'node:fs/promises';
import { promisify } from 'node:util';

import type { GitWorktreeEvidence } from './types.js';

const execFileAsync = promisify(nodeExecFile);
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export interface GitExecOptions {
  timeout: number;
  maxBuffer: number;
  encoding: 'utf8';
  shell: false;
  windowsHide: true;
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
}

export interface GitTargetDependencies {
  realpath: (path: string) => Promise<string>;
  execFile: (
    executable: string,
    argv: readonly string[],
    options: GitExecOptions,
  ) => Promise<GitExecResult>;
}

export interface GitTargetOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  deps?: GitTargetDependencies;
}

export type GitTargetFailure =
  | 'path-missing'
  | 'not-worktree'
  | 'not-registered-worktree'
  | 'same-worktree'
  | 'repository-mismatch'
  | 'source-dirty'
  | 'status-oversized'
  | 'git-output-oversized'
  | 'git-timeout'
  | 'git-evidence-drift';

export class GitTargetError extends Error {
  readonly code: GitTargetFailure;
  readonly role?: 'source' | 'target';

  constructor(code: GitTargetFailure, role?: 'source' | 'target') {
    super(code);
    this.name = 'GitTargetError';
    this.code = code;
    this.role = role;
  }
}

const DEFAULT_DEPENDENCIES: GitTargetDependencies = {
  realpath: nodeRealpath,
  execFile: async (executable, argv, options) => {
    const result = await execFileAsync(executable, [...argv], options);
    return { stdout: result.stdout, stderr: result.stderr };
  },
};

function errorProperty(error: unknown, key: string): unknown {
  if (error === null || typeof error !== 'object') return undefined;
  return (error as Record<string, unknown>)[key];
}

function mapGitError(error: unknown, operation: 'status' | 'other'): never {
  const code = errorProperty(error, 'code');
  if (
    code === 'ETIMEDOUT' ||
    errorProperty(error, 'killed') === true ||
    errorProperty(error, 'signal') === 'SIGTERM'
  ) {
    throw new GitTargetError('git-timeout');
  }
  if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    throw new GitTargetError(
      operation === 'status' ? 'status-oversized' : 'git-output-oversized',
    );
  }
  throw new GitTargetError('not-worktree');
}

interface ResolvedGitTargetOptions {
  timeoutMs: number;
  maxOutputBytes: number;
  deps: GitTargetDependencies;
}

function resolveOptions(options: GitTargetOptions): ResolvedGitTargetOptions {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive safe integer');
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new TypeError('maxOutputBytes must be a positive safe integer');
  }
  return {
    timeoutMs,
    maxOutputBytes,
    deps: options.deps ?? DEFAULT_DEPENDENCIES,
  };
}

async function git(
  cwd: string,
  argv: readonly string[],
  options: ResolvedGitTargetOptions,
  operation: 'status' | 'other' = 'other',
): Promise<string> {
  try {
    const result = await options.deps.execFile('git', ['-C', cwd, ...argv], {
      timeout: options.timeoutMs,
      maxBuffer: options.maxOutputBytes,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    return result.stdout;
  } catch (error) {
    mapGitError(error, operation);
  }
}

async function canonicalize(
  path: string,
  deps: GitTargetDependencies,
  failure: GitTargetFailure,
): Promise<string> {
  try {
    return await deps.realpath(path);
  } catch {
    throw new GitTargetError(failure);
  }
}

function oneLine(output: string): string {
  const value = output.trim();
  if (value.length === 0 || value.includes('\n') || value.includes('\0')) {
    throw new GitTargetError('not-worktree');
  }
  return value;
}

function registeredWorktreePaths(output: string): string[] {
  return output
    .split('\0')
    .flatMap((field) => field.split('\n'))
    .filter((field) => field.startsWith('worktree '))
    .map((field) => field.slice('worktree '.length));
}

/** Inspect one exact registered worktree root using bounded argv-only Git calls. */
export async function inspectWorktree(
  requestedPath: string,
  targetOptions: GitTargetOptions = {},
): Promise<GitWorktreeEvidence> {
  const options = resolveOptions(targetOptions);
  const canonicalPath = await canonicalize(
    requestedPath,
    options.deps,
    'path-missing',
  );
  const rawWorktreeRoot = oneLine(
    await git(canonicalPath, ['rev-parse', '--show-toplevel'], options),
  );
  const worktreeRoot = await canonicalize(
    rawWorktreeRoot,
    options.deps,
    'not-worktree',
  );
  if (canonicalPath !== worktreeRoot) {
    throw new GitTargetError('not-registered-worktree');
  }

  const rawCommonGitDir = oneLine(
    await git(
      canonicalPath,
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      options,
    ),
  );
  const commonGitDir = await canonicalize(
    rawCommonGitDir,
    options.deps,
    'not-worktree',
  );
  const worktreeList = await git(
    canonicalPath,
    ['worktree', 'list', '--porcelain', '-z'],
    options,
  );
  let matchingRegistrations = 0;
  for (const registeredPath of registeredWorktreePaths(worktreeList)) {
    let registeredRoot: string;
    try {
      registeredRoot = await options.deps.realpath(registeredPath);
    } catch {
      continue;
    }
    if (registeredRoot === worktreeRoot) matchingRegistrations += 1;
  }
  if (matchingRegistrations !== 1) {
    throw new GitTargetError('not-registered-worktree');
  }

  const head = oneLine(
    await git(canonicalPath, ['rev-parse', 'HEAD'], options),
  );
  if (!/^[0-9a-f]{40,64}$/u.test(head)) {
    throw new GitTargetError('not-worktree');
  }
  const branchOutput = oneLine(
    await git(canonicalPath, ['rev-parse', '--abbrev-ref', 'HEAD'], options),
  );
  const status = await git(
    canonicalPath,
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    options,
    'status',
  );

  return {
    requestedPath,
    canonicalPath,
    worktreeRoot,
    commonGitDir,
    branch: branchOutput === 'HEAD' ? null : branchOutput,
    head,
    dirty: status.length > 0,
    statusFingerprint: createHash('sha256').update(status).digest('hex'),
  };
}

export interface HandoffGitTargetEvidence {
  source: GitWorktreeEvidence;
  target: GitWorktreeEvidence;
}

/** Validate distinct registered worktrees with exact local repository identity. */
export async function validateHandoffTarget(
  sourcePath: string,
  targetPath: string,
  options: GitTargetOptions = {},
): Promise<HandoffGitTargetEvidence> {
  let source: GitWorktreeEvidence;
  let target: GitWorktreeEvidence;
  try {
    source = await inspectWorktree(sourcePath, options);
  } catch (error) {
    if (error instanceof GitTargetError) {
      throw new GitTargetError(error.code, 'source');
    }
    throw error;
  }
  try {
    target = await inspectWorktree(targetPath, options);
  } catch (error) {
    if (error instanceof GitTargetError) {
      throw new GitTargetError(error.code, 'target');
    }
    throw error;
  }
  if (source.worktreeRoot === target.worktreeRoot) {
    throw new GitTargetError('same-worktree', 'target');
  }
  if (source.commonGitDir !== target.commonGitDir) {
    throw new GitTargetError('repository-mismatch', 'target');
  }
  if (source.dirty) throw new GitTargetError('source-dirty', 'source');
  return { source, target };
}

function evidenceMatches(
  expected: GitWorktreeEvidence,
  actual: GitWorktreeEvidence,
): boolean {
  return (
    expected.requestedPath === actual.requestedPath &&
    expected.canonicalPath === actual.canonicalPath &&
    expected.worktreeRoot === actual.worktreeRoot &&
    expected.commonGitDir === actual.commonGitDir &&
    expected.branch === actual.branch &&
    expected.head === actual.head &&
    expected.dirty === actual.dirty &&
    expected.statusFingerprint === actual.statusFingerprint
  );
}

/** Recompute every evidence field and fail closed if either side drifted. */
export async function revalidateHandoffTarget(
  expected: HandoffGitTargetEvidence,
  options: GitTargetOptions = {},
): Promise<HandoffGitTargetEvidence> {
  const source = await inspectWorktree(expected.source.requestedPath, options);
  if (!evidenceMatches(expected.source, source)) {
    throw new GitTargetError('git-evidence-drift', 'source');
  }
  const target = await inspectWorktree(expected.target.requestedPath, options);
  if (!evidenceMatches(expected.target, target)) {
    throw new GitTargetError('git-evidence-drift', 'target');
  }
  if (
    source.worktreeRoot === target.worktreeRoot ||
    source.commonGitDir !== target.commonGitDir ||
    source.dirty
  ) {
    throw new GitTargetError('git-evidence-drift');
  }
  return { source, target };
}
