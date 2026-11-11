import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readlink,
  realpath,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { inside } from '../../../plugins/consensus/shared/cli-helpers-core.js';

const execFileAsync = promisify(execFile);

export const REVIEW_SCOPE_LIMITS = {
  // A rename or copy counts once.
  maxSelectedFiles: 100,
  // Charged per path as max(live, base) textual bytes, so evidence.json can
  // retain up to twice this when both versions of every path are large.
  maxEvidenceBytes: 8 * 1024 * 1024,
  // One git call returns at most one blob, so it shares the evidence bound
  // plus room for metadata output such as an index listing.
  maxGitOutputBytes: 8 * 1024 * 1024 + 1024 * 1024,
} as const;

const REVIEW_SCOPE_WORKAROUND =
  'Narrow the scope with --files <paths...>, use a closer base_branch=<ref>, or pass base_branch=<sha> naming the commit your branch actually starts from.';

export type ReviewScopeRequest =
  | { kind: 'base_branch'; ref: string }
  | { kind: 'files'; paths: string[] }
  | { kind: 'document'; path: string };

export interface CapturedFileVersion {
  source: 'live' | 'base';
  path: string;
  // `binary_skipped` keeps the size and hash for drift checks but no text.
  kind: 'file' | 'symlink' | 'deleted' | 'binary_skipped';
  mode: number | null;
  bytes: number;
  sha256: string | null;
  blobId: string | null;
  text: string | null;
}

export interface CapturedReviewScope {
  token: string;
  request: ReviewScopeRequest;
  canonicalWorktree: string;
  head: string | null;
  resolvedBaseRef?: string;
  mergeBase?: string;
  selectedPaths: string[];
  externalDocuments: string[];
  versions: CapturedFileVersion[];
  // Textual bytes actually retained in the evidence (live plus base).
  evidenceBytes: number;
  // Bytes charged against maxEvidenceBytes: max(live, base) per path.
  chargedBytes: number;
  captureState: ScopeStateSnapshot;
}

export interface SelectedPathState {
  path: string;
  location: 'worktree' | 'external';
  kind: CapturedFileVersion['kind'];
  mode: number | null;
  bytes: number;
  sha256: string | null;
}

export interface ScopeStateSnapshot {
  head: string | null;
  index: string;
  status: string;
  selected: SelectedPathState[];
}

export interface ScopeComparison {
  checked: boolean;
  stable: boolean;
  differences: string[];
  limitation: string;
  before: ScopeStateSnapshot;
  after: ScopeStateSnapshot | null;
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
  const head = await gitOptionalHead(canonicalWorktree);
  let resolvedBaseRef: string | undefined;
  let mergeBase: string | undefined;
  let selectedPaths: string[] = [];
  let externalDocuments: string[] = [];
  const versions: CapturedFileVersion[] = [];

  if (input.request.kind === 'base_branch') {
    if (head === null) {
      throw new Error('base_scope_requires_head');
    }
    const ref = input.request.ref;
    assertRef(ref);
    await rejectUnresolvedMerges(canonicalWorktree);
    resolvedBaseRef = await gitText(canonicalWorktree, [
      'rev-parse',
      '--verify',
      `${ref}^{commit}`,
    ]).catch(() => {
      throw new Error(`base_ref_invalid: could not resolve ${ref}`);
    });
    mergeBase = await gitText(canonicalWorktree, [
      'merge-base',
      resolvedBaseRef,
      head,
    ]).catch(() => {
      throw new Error(
        `base_ref_invalid: could not resolve a merge base for ${ref}`,
      );
    });
    const changed = await changedTrackedPaths(canonicalWorktree, mergeBase);
    selectedPaths = changed.paths;
    enforceFileCount(selectedPaths, changed.countedFiles);
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
    enforceFileCount(selectedPaths, selectedPaths.length);
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

  rejectBinaryOnlyScope(versions);
  const evidenceBytes = versions.reduce(
    (total, version) => total + textualBytes(version),
    0,
  );
  const charges = chargedBytesByPath(versions);
  const chargedBytes = [...charges.values()].reduce(
    (total, bytes) => total + bytes,
    0,
  );
  if (chargedBytes > REVIEW_SCOPE_LIMITS.maxEvidenceBytes) {
    throw new Error(
      `scope_too_large: selected textual evidence is ${chargedBytes} bytes, over the ${REVIEW_SCOPE_LIMITS.maxEvidenceBytes}-byte limit (each path is charged the larger of its live and base versions). Largest: ${largestOffenders(
        [...charges.entries()].map(([name, bytes]) => ({
          name,
          size: bytes,
          unit: 'bytes',
        })),
      )}. ${REVIEW_SCOPE_WORKAROUND}`,
    );
  }

  const scopeWithoutState = {
    request: input.request,
    canonicalWorktree,
    head,
    ...(resolvedBaseRef ? { resolvedBaseRef } : {}),
    ...(mergeBase ? { mergeBase } : {}),
    selectedPaths,
    externalDocuments,
    versions,
    evidenceBytes,
    chargedBytes,
  };
  const captureState = await captureScopeState(scopeWithoutState);
  const captureComparison = compareCapturedScopeToState(
    scopeWithoutState,
    captureState,
  );
  if (!captureComparison.stable) {
    throw new Error(
      `scope_changed_during_capture: ${captureComparison.differences.join('; ')}`,
    );
  }
  const token = sha256(
    JSON.stringify({
      ...scopeWithoutState,
      captureState,
      versions: versions.map(({ text: _text, ...version }) => version),
    }),
  );
  return {
    token,
    ...scopeWithoutState,
    captureState,
  };
}

export async function captureScopeState(
  scope: Pick<
    CapturedReviewScope,
    'canonicalWorktree' | 'selectedPaths' | 'externalDocuments'
  >,
): Promise<ScopeStateSnapshot> {
  const [head, index, status] = await Promise.all([
    gitOptionalHead(scope.canonicalWorktree),
    gitBytes(scope.canonicalWorktree, ['ls-files', '-s', '-z']).then(sha256),
    gitBytes(scope.canonicalWorktree, [
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
    ]).then(sha256),
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
      before,
      after: null,
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
    before,
    after,
  };
}

export function compareCapturedScopeToState(
  scope: Pick<
    CapturedReviewScope,
    | 'head'
    | 'canonicalWorktree'
    | 'selectedPaths'
    | 'externalDocuments'
    | 'versions'
  >,
  state: ScopeStateSnapshot,
): ScopeComparison {
  const expected: ScopeStateSnapshot = {
    head: scope.head,
    index: state.index,
    status: state.status,
    selected: scope.versions
      .filter((version) => version.source === 'live')
      .map((version) =>
        stateFromVersion(
          version,
          scope.externalDocuments.includes(version.path)
            ? 'external'
            : 'worktree',
        ),
      ),
  };
  return compareScopeState(expected, state);
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
): Promise<{ paths: string[]; countedFiles: number }> {
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
  // A rename or copy is one changed file with two paths; both stay in scope.
  let countedFiles = 0;
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (!status) break;
    const first = fields[index++];
    if (first === undefined) throw new Error('git_diff_malformed');
    paths.push(normalizeRepositoryPath(first));
    countedFiles += 1;
    if (status.startsWith('R') || status.startsWith('C')) {
      const second = fields[index++];
      if (second === undefined) throw new Error('git_diff_malformed');
      paths.push(normalizeRepositoryPath(second));
    }
  }
  return { paths: unique(paths).toSorted(), countedFiles };
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
  if (info.isSymbolicLink()) {
    const canonicalParent = await realpath(path.dirname(requested));
    if (!inside(root, canonicalParent)) {
      throw new Error(`path_escape: ${normalized}`);
    }
    const canonicalLink = path.join(canonicalParent, path.basename(requested));
    const target = await readlink(canonicalLink, {
      encoding: 'buffer',
    }).catch((error) => {
      throw new Error(
        `scope_path_unreadable: ${normalized}: ${fsMessage(error)}`,
        { cause: error },
      );
    });
    return versionFromBytes(
      normalized,
      'live',
      0o120000,
      target,
      includeText,
      null,
      'symlink',
    );
  }
  if (!info.isFile()) {
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
  const tree = await gitBytes(root, [
    'ls-tree',
    '-z',
    revision,
    '--',
    normalized,
  ]);
  if (tree.length === 0) return deletedVersion(normalized, 'base');
  const header = tree.toString('utf8').split('\t', 1)[0];
  const [mode, kind, blobId] = header.split(' ');
  if (
    kind !== 'blob' ||
    !/^[0-7]{6}$/u.test(mode) ||
    !/^[a-f0-9]{40,64}$/u.test(blobId)
  ) {
    throw new Error(`unsupported_git_entry: ${normalized}`);
  }
  // Only an empty tree listing above means the path is absent at the base.
  // A failed or oversized read is a scope error, never deletion evidence.
  const size = Number(
    await gitText(root, ['cat-file', '-s', blobId]).catch((error) => {
      throw new Error(
        `scope_base_unreadable: ${normalized}: ${fsMessage(error)}`,
        { cause: error },
      );
    }),
  );
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(`scope_base_unreadable: ${normalized}: invalid blob size`);
  }
  let bytes: Buffer | LargeBinary;
  if (size > REVIEW_SCOPE_LIMITS.maxEvidenceBytes) {
    bytes = await hashLargeGitBlob(root, blobId, normalized, size);
  } else {
    try {
      bytes = await gitBytes(root, ['cat-file', 'blob', blobId]);
    } catch (error) {
      throw new Error(
        `scope_base_unreadable: ${normalized}: ${fsMessage(error)}`,
        { cause: error },
      );
    }
    if (bytes.length !== size) {
      throw new Error(`scope_base_unreadable: ${normalized}: short blob read`);
    }
  }
  const symlink = mode === '120000';
  return versionFromBytes(
    normalized,
    'base',
    symlink ? 0o120000 : Number.parseInt(mode, 8) & 0o777,
    bytes,
    true,
    blobId,
    symlink ? 'symlink' : 'file',
  );
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

// Git's own binary heuristic: a NUL byte in the first 8000 bytes.
const BINARY_SNIFF_BYTES = 8000;
const HASH_CHUNK_BYTES = 1024 * 1024;

// An oversized binary is recorded by size and hash only, so it never needs to
// fit the evidence allowance; an oversized text file is still a scope error.
interface LargeBinary {
  size: number;
  sha256: string;
}

async function boundedRead(filePath: string): Promise<Buffer | LargeBinary> {
  const handle = await open(filePath, 'r');
  try {
    const current = await handle.stat();
    if (current.size > REVIEW_SCOPE_LIMITS.maxEvidenceBytes) {
      return await hashLargeBinary(handle, filePath, current.size);
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

async function hashLargeBinary(
  handle: Awaited<ReturnType<typeof open>>,
  filePath: string,
  size: number,
): Promise<LargeBinary> {
  const hash = createHash('sha256');
  const chunk = Buffer.alloc(HASH_CHUNK_BYTES);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
    if (bytesRead === 0) break;
    if (
      offset === 0 &&
      !chunk.subarray(0, Math.min(bytesRead, BINARY_SNIFF_BYTES)).includes(0)
    ) {
      throw oversizedFile(filePath, size);
    }
    hash.update(chunk.subarray(0, bytesRead));
    offset += bytesRead;
  }
  const final = await handle.stat();
  if (final.size !== size || offset !== size) {
    throw new Error(`scope_changed_during_read: ${filePath}`);
  }
  return { size, sha256: hash.digest('hex') };
}

// Streams an oversized base blob through the same binary check and hash
// without holding it in memory.
function hashLargeGitBlob(
  root: string,
  blobId: string,
  filePath: string,
  size: number,
): Promise<LargeBinary> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', 'blob', blobId], {
      cwd: root,
      env: gitEnv(),
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const hash = createHash('sha256');
    let prefix = Buffer.alloc(0);
    let sniffed = false;
    let received = 0;
    let failure: Error | undefined;
    child.stdout.on('data', (data: Buffer) => {
      if (failure) return;
      received += data.length;
      hash.update(data);
      if (!sniffed) {
        prefix = Buffer.concat([prefix, data]).subarray(0, BINARY_SNIFF_BYTES);
        if (prefix.includes(0)) sniffed = true;
        else if (prefix.length >= BINARY_SNIFF_BYTES) {
          failure = oversizedFile(filePath, size);
          child.kill();
        }
      }
    });
    child.on('error', (error) => {
      failure ??= new Error(
        `scope_base_unreadable: ${filePath}: ${fsMessage(error)}`,
        { cause: error },
      );
    });
    child.on('close', (code) => {
      if (!failure && !sniffed) failure = oversizedFile(filePath, size);
      if (!failure && (code !== 0 || received !== size)) {
        failure = new Error(
          `scope_base_unreadable: ${filePath}: short blob read`,
        );
      }
      if (failure) reject(failure);
      else resolve({ size, sha256: hash.digest('hex') });
    });
  });
}

function versionFromBytes(
  filePath: string,
  source: CapturedFileVersion['source'],
  mode: number | null,
  bytes: Buffer | LargeBinary,
  includeText: boolean,
  blobId: string | null = null,
  kind: 'file' | 'symlink' = 'file',
): CapturedFileVersion {
  if (!Buffer.isBuffer(bytes)) {
    return {
      source,
      path: filePath,
      kind: 'binary_skipped',
      mode,
      bytes: bytes.size,
      sha256: bytes.sha256,
      blobId,
      text: null,
    };
  }
  if (bytes.includes(0)) {
    return {
      source,
      path: filePath,
      kind: 'binary_skipped',
      mode,
      bytes: bytes.length,
      sha256: sha256(bytes),
      blobId,
      text: null,
    };
  }
  return {
    source,
    path: filePath,
    kind,
    mode,
    bytes: bytes.length,
    sha256: sha256(bytes),
    blobId,
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
    blobId: null,
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

async function gitOptionalHead(cwd: string): Promise<string | null> {
  try {
    return await gitText(cwd, ['rev-parse', '--verify', 'HEAD']);
  } catch (error) {
    try {
      await gitText(cwd, ['symbolic-ref', '-q', 'HEAD']);
      return null;
    } catch {
      throw error;
    }
  }
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'diff.external',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'core.attributesFile',
    GIT_CONFIG_VALUE_1: '/dev/null',
  };
}

async function gitBytes(cwd: string, args: string[]): Promise<Buffer> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: REVIEW_SCOPE_LIMITS.maxGitOutputBytes,
    env: gitEnv(),
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

function enforceFileCount(paths: string[], countedFiles: number): void {
  if (countedFiles <= REVIEW_SCOPE_LIMITS.maxSelectedFiles) return;
  const directories = new Map<string, number>();
  for (const candidate of paths) {
    const directory = path.posix.dirname(candidate);
    const key = directory === '.' ? './' : `${directory}/`;
    directories.set(key, (directories.get(key) ?? 0) + 1);
  }
  throw new Error(
    `scope_too_large: ${countedFiles} changed files selected, over the ${REVIEW_SCOPE_LIMITS.maxSelectedFiles}-file limit (a rename counts once). Largest directories: ${largestOffenders(
      [...directories.entries()].map(([name, size]) => ({
        name,
        size,
        unit: 'files',
      })),
    )}. ${REVIEW_SCOPE_WORKAROUND}`,
  );
}

function oversizedFile(filePath: string, size: number): Error {
  return new Error(
    `scope_too_large: ${filePath} is ${size} bytes, over the ${REVIEW_SCOPE_LIMITS.maxEvidenceBytes}-byte per-file limit. ${REVIEW_SCOPE_WORKAROUND}`,
  );
}

function largestOffenders(
  entries: Array<{ name: string; size: number; unit: string }>,
): string {
  return entries
    .toSorted(
      (left, right) =>
        right.size - left.size || left.name.localeCompare(right.name),
    )
    .slice(0, 5)
    .map((entry) => `${entry.name} (${entry.size} ${entry.unit})`)
    .join(', ');
}

function textualBytes(version: CapturedFileVersion): number {
  return version.kind === 'file' || version.kind === 'symlink'
    ? version.bytes
    : 0;
}

function chargedBytesByPath(
  versions: CapturedFileVersion[],
): Map<string, number> {
  const charges = new Map<string, number>();
  for (const version of versions) {
    charges.set(
      version.path,
      Math.max(charges.get(version.path) ?? 0, textualBytes(version)),
    );
  }
  return charges;
}

// Binary files are skipped individually, but the scope still needs a change
// the reviewer can read: a textual live version, or a deleted path whose base
// was textual. Base text whose live version is binary does not count.
function rejectBinaryOnlyScope(versions: CapturedFileVersion[]): void {
  const binaries = versions.filter(
    (version) => version.kind === 'binary_skipped',
  );
  if (binaries.length === 0) return;
  const textual = (version: CapturedFileVersion) =>
    version.kind === 'file' || version.kind === 'symlink';
  const deletedLive = new Set(
    versions
      .filter(
        (version) => version.source === 'live' && version.kind === 'deleted',
      )
      .map((version) => version.path),
  );
  if (
    versions.some(
      (version) =>
        textual(version) &&
        (version.source === 'live' || deletedLive.has(version.path)),
    )
  ) {
    return;
  }
  throw new Error(
    `binary_scope_not_supported: every changed version is binary (${unique(
      binaries.map((version) => version.path),
    ).join(', ')})`,
  );
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
