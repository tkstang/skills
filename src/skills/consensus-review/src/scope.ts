import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { inside } from '../../../plugins/consensus/shared/cli-helpers-core.js';

const execFileAsync = promisify(execFile);

export const REVIEW_SCOPE_LIMITS = {
  maxSelectedFiles: 100,
  maxEvidenceBytes: 2 * 1024 * 1024,
  maxGitOutputBytes: 4 * 1024 * 1024,
} as const;

export type ReviewScopeRequest =
  | { kind: 'base_branch'; ref: string }
  | { kind: 'files'; paths: string[] }
  | { kind: 'document'; path: string };

export interface CapturedFileVersion {
  source: 'live' | 'base';
  path: string;
  kind: 'file' | 'deleted';
  mode: number | null;
  bytes: number;
  sha256: string | null;
  text: string | null;
}

export interface CapturedReviewScope {
  token: string;
  request: ReviewScopeRequest;
  canonicalWorktree: string;
  head: string;
  mergeBase?: string;
  selectedPaths: string[];
  externalDocuments: string[];
  versions: CapturedFileVersion[];
  evidenceBytes: number;
}

export interface SelectedPathState {
  path: string;
  location: 'worktree' | 'external';
  kind: 'file' | 'deleted';
  mode: number | null;
  bytes: number;
  sha256: string | null;
}

export interface ScopeStateSnapshot {
  head: string;
  index: string;
  status: string;
  selected: SelectedPathState[];
}

export interface ScopeComparison {
  checked: boolean;
  stable: boolean;
  differences: string[];
  limitation: string;
}

export interface ReviewRunState {
  stateRoot: string;
  worktreeKey: string;
  runId: string;
  runDirectory: string;
}

export async function captureReviewScope(input: {
  cwd: string;
  request: ReviewScopeRequest;
}): Promise<CapturedReviewScope> {
  const canonicalWorktree = await canonicalGitWorktree(input.cwd);
  const head = await gitText(canonicalWorktree, [
    'rev-parse',
    '--verify',
    'HEAD',
  ]);
  let mergeBase: string | undefined;
  let selectedPaths: string[] = [];
  let externalDocuments: string[] = [];
  const versions: CapturedFileVersion[] = [];

  if (input.request.kind === 'base_branch') {
    const ref = input.request.ref;
    assertRef(ref);
    await rejectUnresolvedMerges(canonicalWorktree);
    const resolvedRef = await gitText(canonicalWorktree, [
      'rev-parse',
      '--verify',
      `${ref}^{commit}`,
    ]).catch(() => {
      throw new Error(`base_ref_invalid: could not resolve ${ref}`);
    });
    mergeBase = await gitText(canonicalWorktree, [
      'merge-base',
      resolvedRef,
      head,
    ]).catch(() => {
      throw new Error(
        `base_ref_invalid: could not resolve a merge base for ${ref}`,
      );
    });
    selectedPaths = await changedTrackedPaths(canonicalWorktree, mergeBase);
    enforceFileCount(selectedPaths);
    for (const relativePath of selectedPaths) {
      versions.push(
        await captureWorktreeVersion(canonicalWorktree, relativePath),
      );
      versions.push(
        await captureGitVersion(canonicalWorktree, mergeBase, relativePath),
      );
    }
  } else if (input.request.kind === 'files') {
    if (input.request.paths.length === 0) {
      throw new Error('scope_required: --files requires at least one path');
    }
    selectedPaths = unique(input.request.paths).map((candidate) =>
      normalizeRepositoryPath(candidate),
    );
    enforceFileCount(selectedPaths);
    for (const relativePath of selectedPaths) {
      versions.push(
        await captureWorktreeVersion(canonicalWorktree, relativePath, true),
      );
    }
  } else {
    if (!input.request.path.trim()) {
      throw new Error('scope_required: --document requires a path');
    }
    const document = await resolveDocument(
      canonicalWorktree,
      input.request.path,
    );
    if (document.location === 'worktree') selectedPaths = [document.path];
    else externalDocuments = [document.path];
    versions.push(document.version);
  }

  const evidenceBytes = versions.reduce(
    (total, version) => total + version.bytes,
    0,
  );
  if (evidenceBytes > REVIEW_SCOPE_LIMITS.maxEvidenceBytes) {
    throw new Error(
      `scope_too_large: selected textual evidence exceeds ${REVIEW_SCOPE_LIMITS.maxEvidenceBytes} bytes`,
    );
  }

  const token = sha256(
    JSON.stringify({
      request: input.request,
      canonicalWorktree,
      head,
      mergeBase,
      versions: versions.map(({ text: _text, ...version }) => version),
    }),
  );
  return {
    token,
    request: input.request,
    canonicalWorktree,
    head,
    ...(mergeBase ? { mergeBase } : {}),
    selectedPaths,
    externalDocuments,
    versions,
    evidenceBytes,
  };
}

export async function captureScopeState(
  scope: Pick<
    CapturedReviewScope,
    'canonicalWorktree' | 'selectedPaths' | 'externalDocuments'
  >,
): Promise<ScopeStateSnapshot> {
  const [head, index, status] = await Promise.all([
    gitText(scope.canonicalWorktree, ['rev-parse', '--verify', 'HEAD']),
    gitBytes(scope.canonicalWorktree, ['ls-files', '-s', '-z']).then(sha256),
    gitBytes(scope.canonicalWorktree, [
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
    ]).then((value) => value.toString('base64')),
  ]);
  const selected: SelectedPathState[] = [];
  for (const relativePath of scope.selectedPaths) {
    selected.push(
      stateFromVersion(
        await captureWorktreeVersion(
          scope.canonicalWorktree,
          relativePath,
          false,
          false,
        ),
        'worktree',
      ),
    );
  }
  for (const documentPath of scope.externalDocuments) {
    selected.push(
      stateFromVersion(
        await captureAbsoluteFile(documentPath, 'live'),
        'external',
      ),
    );
  }
  return { head, index, status, selected };
}

export function compareScopeState(
  before: ScopeStateSnapshot,
  after: ScopeStateSnapshot | Error,
): ScopeComparison {
  const limitation =
    'Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write-then-revert activity are not fully monitored.';
  if (after instanceof Error) {
    return {
      checked: false,
      stable: false,
      differences: [`after_scan_failed: ${after.message}`],
      limitation,
    };
  }
  const differences: string[] = [];
  if (before.head !== after.head) differences.push('HEAD changed');
  if (before.index !== after.index) differences.push('index changed');
  if (before.status !== after.status) differences.push('Git status changed');

  const prior = new Map(
    before.selected.map((entry) => [stateKey(entry), JSON.stringify(entry)]),
  );
  const next = new Map(
    after.selected.map((entry) => [stateKey(entry), JSON.stringify(entry)]),
  );
  for (const key of new Set([...prior.keys(), ...next.keys()])) {
    if (prior.get(key) !== next.get(key)) {
      differences.push(`selected path changed: ${key}`);
    }
  }
  return {
    checked: true,
    stable: differences.length === 0,
    differences,
    limitation,
  };
}

export async function createReviewRunState(input: {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  runId?: string;
}): Promise<ReviewRunState> {
  const canonicalWorktree = await canonicalGitWorktree(input.cwd);
  const env = input.env ?? process.env;
  const configuredRoot = env.XDG_STATE_HOME;
  if (configuredRoot && !path.isAbsolute(configuredRoot)) {
    throw new Error('XDG_STATE_HOME must be absolute');
  }
  const home = env.HOME || os.homedir();
  if (!configuredRoot && !path.isAbsolute(home)) {
    throw new Error('HOME must resolve to an absolute path');
  }
  const stateRoot = path.resolve(
    configuredRoot ?? path.join(home, '.local', 'state'),
    'consensus',
  );
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });
  const canonicalStateRoot = await realpath(stateRoot);
  if (inside(canonicalWorktree, canonicalStateRoot)) {
    throw new Error('review_state_inside_worktree');
  }

  const worktreeKey = sha256(canonicalWorktree);
  const reviews = path.join(canonicalStateRoot, worktreeKey, 'reviews');
  await mkdir(reviews, { recursive: true, mode: 0o700 });
  await chmod(path.join(canonicalStateRoot, worktreeKey), 0o700);
  await chmod(reviews, 0o700);

  const runId = input.runId ?? randomUUID();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(runId)) {
    throw new Error('run_id_invalid');
  }
  const runDirectory = path.join(reviews, runId);
  await mkdir(runDirectory, { mode: 0o700 });
  const canonicalRunDirectory = await realpath(runDirectory);
  if (
    canonicalRunDirectory !== runDirectory ||
    !inside(canonicalStateRoot, canonicalRunDirectory) ||
    inside(canonicalWorktree, canonicalRunDirectory)
  ) {
    throw new Error('review_state_boundary_invalid');
  }
  const info = await lstat(canonicalRunDirectory);
  const uid = process.getuid?.();
  if (
    !info.isDirectory() ||
    (info.mode & 0o077) !== 0 ||
    (uid !== undefined && info.uid !== uid)
  ) {
    throw new Error('review_state_not_private');
  }
  return {
    stateRoot: canonicalStateRoot,
    worktreeKey,
    runId,
    runDirectory: canonicalRunDirectory,
  };
}

async function canonicalGitWorktree(cwd: string): Promise<string> {
  const worktree = await gitText(path.resolve(cwd), [
    'rev-parse',
    '--show-toplevel',
  ]).catch(() => {
    throw new Error('review_scope_requires_git_worktree');
  });
  return await realpath(worktree);
}

async function changedTrackedPaths(
  cwd: string,
  mergeBase: string,
): Promise<string[]> {
  const output = await gitBytes(cwd, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    '--no-ext-diff',
    mergeBase,
    '--',
  ]);
  const fields = splitNul(output);
  const paths: string[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (!status) break;
    const first = fields[index++];
    if (first === undefined) throw new Error('git_diff_malformed');
    paths.push(normalizeRepositoryPath(first));
    if (status.startsWith('R') || status.startsWith('C')) {
      const second = fields[index++];
      if (second === undefined) throw new Error('git_diff_malformed');
      paths.push(normalizeRepositoryPath(second));
    }
  }
  return unique(paths).toSorted();
}

async function rejectUnresolvedMerges(cwd: string): Promise<void> {
  const unresolved = await gitBytes(cwd, [
    'diff',
    '--name-only',
    '--diff-filter=U',
    '-z',
    '--',
  ]);
  if (unresolved.length > 0) throw new Error('unresolved_merge_not_supported');
}

async function captureWorktreeVersion(
  root: string,
  relativePath: string,
  requirePresent = false,
  includeText = true,
): Promise<CapturedFileVersion> {
  const normalized = normalizeRepositoryPath(relativePath);
  const requested = path.resolve(root, normalized);
  if (!inside(root, requested)) throw new Error(`path_escape: ${relativePath}`);
  let info: Awaited<ReturnType<typeof lstat>>;
  try {
    info = await lstat(requested);
  } catch (error) {
    if (isMissing(error) && !requirePresent) {
      return deletedVersion(normalized, 'live');
    }
    throw new Error(
      `scope_path_unreadable: ${normalized}: ${fsMessage(error)}`,
      { cause: error },
    );
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`scope_path_not_regular: ${normalized}`);
  }
  const canonical = await realpath(requested);
  if (!inside(root, canonical)) throw new Error(`path_escape: ${normalized}`);
  const bytes = await boundedRead(canonical);
  return versionFromBytes(
    normalized,
    'live',
    info.mode & 0o777,
    bytes,
    includeText,
  );
}

async function captureGitVersion(
  root: string,
  revision: string,
  relativePath: string,
): Promise<CapturedFileVersion> {
  const normalized = normalizeRepositoryPath(relativePath);
  let bytes: Buffer;
  try {
    bytes = await gitBytes(root, ['show', `${revision}:${normalized}`]);
  } catch {
    return deletedVersion(normalized, 'base');
  }
  return versionFromBytes(normalized, 'base', null, bytes, true);
}

async function resolveDocument(
  root: string,
  candidate: string,
): Promise<{
  location: 'worktree' | 'external';
  path: string;
  version: CapturedFileVersion;
}> {
  const requested = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  const canonical = await realpath(requested).catch((error) => {
    throw new Error(`document_unreadable: ${fsMessage(error)}`);
  });
  const location = inside(root, canonical) ? 'worktree' : 'external';
  if (location === 'worktree') {
    const relativePath = normalizeRepositoryPath(
      path.relative(root, canonical),
    );
    return {
      location,
      path: relativePath,
      version: await captureWorktreeVersion(root, relativePath, true),
    };
  }
  return {
    location,
    path: canonical,
    version: await captureAbsoluteFile(canonical, 'live'),
  };
}

async function captureAbsoluteFile(
  canonicalPath: string,
  source: CapturedFileVersion['source'],
): Promise<CapturedFileVersion> {
  const info = await lstat(canonicalPath).catch((error) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (!info) return deletedVersion(canonicalPath, source);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`scope_path_not_regular: ${canonicalPath}`);
  }
  const bytes = await boundedRead(canonicalPath);
  return versionFromBytes(
    canonicalPath,
    source,
    info.mode & 0o777,
    bytes,
    true,
  );
}

async function boundedRead(filePath: string): Promise<Buffer> {
  const info = await stat(filePath);
  if (info.size > REVIEW_SCOPE_LIMITS.maxEvidenceBytes) {
    throw new Error(`scope_too_large: ${filePath}`);
  }
  const handle = await open(filePath, 'r');
  try {
    const current = await handle.stat();
    if (current.size > REVIEW_SCOPE_LIMITS.maxEvidenceBytes) {
      throw new Error(`scope_too_large: ${filePath}`);
    }
    const buffer = Buffer.alloc(current.size);
    let offset = 0;
    while (offset < buffer.length) {
      const read = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (read.bytesRead === 0) break;
      offset += read.bytesRead;
    }
    const final = await handle.stat();
    if (final.size !== current.size || offset !== current.size) {
      throw new Error(`scope_changed_during_read: ${filePath}`);
    }
    return buffer;
  } finally {
    await handle.close();
  }
}

function versionFromBytes(
  filePath: string,
  source: CapturedFileVersion['source'],
  mode: number | null,
  bytes: Buffer,
  includeText: boolean,
): CapturedFileVersion {
  if (bytes.includes(0))
    throw new Error(`binary_scope_not_supported: ${filePath}`);
  return {
    source,
    path: filePath,
    kind: 'file',
    mode,
    bytes: bytes.length,
    sha256: sha256(bytes),
    text: includeText ? bytes.toString('utf8') : null,
  };
}

function deletedVersion(
  filePath: string,
  source: CapturedFileVersion['source'],
): CapturedFileVersion {
  return {
    source,
    path: filePath,
    kind: 'deleted',
    mode: null,
    bytes: 0,
    sha256: null,
    text: null,
  };
}

function stateFromVersion(
  version: CapturedFileVersion,
  location: SelectedPathState['location'],
): SelectedPathState {
  return {
    path: version.path,
    location,
    kind: version.kind,
    mode: version.mode,
    bytes: version.bytes,
    sha256: version.sha256,
  };
}

async function gitText(cwd: string, args: string[]): Promise<string> {
  return (await gitBytes(cwd, args)).toString('utf8').trim();
}

async function gitBytes(cwd: string, args: string[]): Promise<Buffer> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: REVIEW_SCOPE_LIMITS.maxGitOutputBytes,
    env: {
      ...process.env,
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'diff.external',
      GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_KEY_1: 'core.attributesFile',
      GIT_CONFIG_VALUE_1: '/dev/null',
    },
  });
  return result.stdout as Buffer;
}

function assertRef(ref: string): void {
  if (!ref.trim() || ref.startsWith('-') || ref.includes('\0')) {
    throw new Error(`base_ref_invalid: ${ref}`);
  }
}

function normalizeRepositoryPath(candidate: string): string {
  if (!candidate || candidate.includes('\0') || path.isAbsolute(candidate)) {
    throw new Error(`scope_path_invalid: ${candidate}`);
  }
  const normalized = path.normalize(candidate);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`path_escape: ${candidate}`);
  }
  return normalized.split(path.sep).join('/');
}

function enforceFileCount(paths: string[]): void {
  if (paths.length > REVIEW_SCOPE_LIMITS.maxSelectedFiles) {
    throw new Error(
      `scope_too_large: selected file count exceeds ${REVIEW_SCOPE_LIMITS.maxSelectedFiles}`,
    );
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function splitNul(value: Buffer): string[] {
  const parts = value.toString('utf8').split('\0');
  if (parts.at(-1) === '') parts.pop();
  return parts;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stateKey(value: SelectedPathState): string {
  return `${value.location}:${value.path}`;
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function fsMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
