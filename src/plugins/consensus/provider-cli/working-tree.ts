// Read-only snapshot of a git checkout, taken before and after an extended
// read-only turn so any change to the working tree fails the run loudly.
//
// A snapshot is HEAD plus `git status --porcelain=v1 -z
// --untracked-files=all` (ignored files are not covered) plus a sha256 of the
// current content of every path status lists and of every index entry
// marked assume-unchanged or skip-worktree, which status never reports.
// fsmonitor and the untracked cache are disabled for these commands, so a
// repository setting cannot make status skip a change. Nothing writes objects or the
// index: no `git add`, and status runs with --no-optional-locks so it never
// takes index.lock or refreshes the index. git runs with shell:false and
// with git's repository-local environment variables cleared, so an inherited
// GIT_DIR or GIT_INDEX_FILE cannot point it at another repository.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import path from 'node:path';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const MAX_LISTED_PATHS = 20;
// Status must look at the files themselves: no fsmonitor daemon or hook, no
// cached untracked-directory results, and no index refresh written back.
const TRUTHFUL_STATUS_CONFIG = [
  '--no-optional-locks',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.untrackedCache=false',
] as const;

export interface WorkingTreeSnapshot {
  root: string;
  // Empty on an unborn branch.
  head: string;
  // Porcelain status code (XY) by repository-relative path.
  status: ReadonlyMap<string, string>;
  // Content fingerprint by path, for the status paths and the index entries
  // status hides: sha256, `deleted`, `dir`, or `link:<sha>`.
  content: ReadonlyMap<string, string>;
}

export type WorkingTreeSnapshotResult =
  | { ok: true; snapshot: WorkingTreeSnapshot }
  | { ok: false; message: string };

export interface WorkingTreeOptions {
  env?: NodeJS.ProcessEnv;
  git?: string;
}

export async function snapshotWorkingTree(
  cwd: string,
  options: WorkingTreeOptions = {},
): Promise<WorkingTreeSnapshotResult> {
  const git = gitRunner(cwd, options);
  try {
    const env = await git.cleanEnv();
    const inside = await git.run(env, ['rev-parse', '--is-inside-work-tree']);
    if (inside.trim() !== 'true') {
      return { ok: false, message: `${cwd} is not inside a git work tree` };
    }
    const root = (await git.run(env, ['rev-parse', '--show-toplevel'])).trim();
    const head = (
      await git.run(env, ['rev-parse', '--verify', '--quiet', 'HEAD'], {
        allowExit: [1],
      })
    ).trim();
    const raw = await git.run(env, [
      ...TRUTHFUL_STATUS_CONFIG,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--ignored=no',
    ]);
    const status = parsePorcelainZ(raw);
    const hidden = parseHiddenIndexEntries(
      await git.run(env, [...TRUTHFUL_STATUS_CONFIG, 'ls-files', '-v', '-z']),
    );
    const content = new Map<string, string>();
    for (const file of new Set([...status.keys(), ...hidden])) {
      content.set(file, await fingerprint(path.join(root, file)));
    }
    return { ok: true, snapshot: { root, head, status, content } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface WorkingTreeChanges {
  head_changed: boolean;
  paths: string[];
}

// Paths whose status entry or content differs, sorted. A changed HEAD is
// reported separately.
export function compareWorkingTrees(
  before: WorkingTreeSnapshot,
  after: WorkingTreeSnapshot,
): WorkingTreeChanges {
  const paths = new Set<string>();
  for (const file of new Set([
    ...before.status.keys(),
    ...after.status.keys(),
    ...before.content.keys(),
    ...after.content.keys(),
  ])) {
    if (
      before.status.get(file) !== after.status.get(file) ||
      before.content.get(file) !== after.content.get(file)
    ) {
      paths.add(file);
    }
  }
  return {
    head_changed: before.head !== after.head,
    paths: [...paths].toSorted(),
  };
}

export function hasWorkingTreeChanges(changes: WorkingTreeChanges) {
  return changes.head_changed || changes.paths.length > 0;
}

// The changes as one list for envelopes: `HEAD` first when it moved.
export function workingTreeChangeList(changes: WorkingTreeChanges): string[] {
  return [...(changes.head_changed ? ['HEAD'] : []), ...changes.paths];
}

export function describeWorkingTreeChanges(changes: WorkingTreeChanges) {
  const list = workingTreeChangeList(changes);
  const shown = list.slice(0, MAX_LISTED_PATHS).join(', ');
  const more =
    list.length > MAX_LISTED_PATHS
      ? ` and ${list.length - MAX_LISTED_PATHS} more`
      : '';
  return `${shown}${more}`;
}

// Entries are `XY <path>`; a rename or copy is followed by its source path.
function parsePorcelainZ(raw: string): Map<string, string> {
  const status = new Map<string, string>();
  const tokens = raw.split('\0');
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 4) continue;
    const code = token.slice(0, 2);
    status.set(token.slice(3), code);
    if (code.includes('R') || code.includes('C')) {
      const source = tokens[index + 1];
      if (source) status.set(source, `${code}<`);
      index += 1;
    }
  }
  return status;
}

// `ls-files -v` tags: lowercase means assume-unchanged, `S` (or `s`)
// skip-worktree. Git does not compare either kind against the working tree.
function parseHiddenIndexEntries(raw: string): string[] {
  const hidden: string[] = [];
  for (const entry of raw.split('\0')) {
    if (entry.length < 3) continue;
    const tag = entry[0];
    if (tag === 'S' || (tag >= 'a' && tag <= 'z')) hidden.push(entry.slice(2));
  }
  return hidden;
}

async function fingerprint(file: string): Promise<string> {
  let stats;
  try {
    stats = await lstat(file);
  } catch (error) {
    if (isMissing(error)) return 'deleted';
    throw error;
  }
  if (stats.isSymbolicLink()) {
    return `link:${sha256(await readlink(file))}`;
  }
  if (stats.isDirectory()) return 'dir';
  return hashFile(file);
}

function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', (error) => {
        if (isMissing(error)) resolve('deleted');
        else reject(error);
      })
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isMissing(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

function gitRunner(cwd: string, options: WorkingTreeOptions) {
  const command = options.git ?? 'git';
  const base = options.env ?? process.env;
  const run = (
    env: NodeJS.ProcessEnv,
    args: string[],
    runOptions: { allowExit?: number[] } = {},
  ) =>
    new Promise<string>((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd,
          env,
          encoding: 'utf8',
          maxBuffer: GIT_MAX_BUFFER,
          timeout: GIT_TIMEOUT_MS,
          shell: false,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          const exitCode =
            error && typeof error.code === 'number' ? error.code : undefined;
          if (!error || runOptions.allowExit?.includes(exitCode ?? -1)) {
            resolve(error ? '' : stdout);
            return;
          }
          const detail =
            String(stderr).trim().split(/\r?\n/)[0] || error.message;
          reject(
            new Error(
              `git ${args.filter((arg) => !TRUTHFUL_STATUS_CONFIG.includes(arg as never)).join(' ')} failed${detail ? `: ${detail}` : ''}`,
            ),
          );
        },
      );
    });
  return {
    run,
    // Drops the variables git itself names as repository-local.
    async cleanEnv(): Promise<NodeJS.ProcessEnv> {
      const names = await run(base, ['rev-parse', '--local-env-vars']);
      const env: NodeJS.ProcessEnv = { ...base, GIT_OPTIONAL_LOCKS: '0' };
      for (const name of names.split(/\r?\n/)) {
        if (name) delete env[name];
      }
      return env;
    },
  };
}
