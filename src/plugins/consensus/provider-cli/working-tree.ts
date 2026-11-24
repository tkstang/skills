// Read-only snapshot of a git checkout, taken before and after an extended
// read-only turn so any change to the working tree fails the run loudly.
//
// A snapshot is HEAD plus `git status --porcelain=v1 -z
// --untracked-files=all` (ignored files are not covered) plus a sha256 of the
// current content of every path status lists and of every index entry
// marked assume-unchanged or skip-worktree, which status never reports.
// Every other tracked path gets its permission bits, because status reports
// only an executable-bit change. fsmonitor and the untracked cache are
// disabled and file modes are always compared for these commands, so a
// repository setting cannot make status skip a change. The repository's
// info/exclude file is hashed too, so a rule added to hide a new file is
// itself a change.
//
// Known limits, accepted because the check is the loud backstop and deny-all
// plus the confirmed read-only mode are the prevention (each would need a raw
// hash of every tracked file or a directory walk on every run):
// - a byte change that git's built-in conversions (line endings, `ident`,
//   working-tree-encoding) normalize back to the indexed content;
// - a case-only rename on a case-insensitive filesystem;
// - files changed inside an untracked nested git repository (status lists
//   only the directory).
//
// Every configured filter driver is switched off for these commands, so
// status compares raw bytes and never runs a filter command, including one a
// peer added to the repository config or to the config of a checked-out
// submodule, which status recurses into. Nothing writes objects or the index:
// no `git add`, and status runs with --no-optional-locks so it never takes
// index.lock or refreshes the index. git runs with shell:false and an
// allowlisted environment, so it never sees the caller's credentials and an
// inherited GIT_DIR or GIT_INDEX_FILE cannot point it at another repository.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import path from 'node:path';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const MAX_LISTED_PATHS = 20;
// Tracked paths lstat-ed at once when recording permission bits.
const LSTAT_BATCH = 256;
// What git needs to find itself, the user's global config, and a locale.
const SNAPSHOT_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'XDG_CONFIG_HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'USER',
  'LOGNAME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'GIT_CEILING_DIRECTORIES',
] as const;
// Status must look at the files themselves: no fsmonitor daemon or hook, no
// cached untracked-directory results, and no index refresh written back.
const TRUTHFUL_STATUS_CONFIG = [
  '--no-optional-locks',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.untrackedCache=false',
  '-c',
  'core.filemode=true',
] as const;

export interface WorkingTreeSnapshot {
  root: string;
  // Empty on an unborn branch.
  head: string;
  // Porcelain status code (XY) by repository-relative path.
  status: ReadonlyMap<string, string>;
  // Fingerprint by path. The status paths and the index entries status hides
  // get `<mode>:<sha256>`, `deleted`, `dir`, or `link:<sha>`; every other
  // tracked path gets `mode:<mode>`.
  content: ReadonlyMap<string, string>;
}

export type WorkingTreeSnapshotResult =
  | { ok: true; snapshot: WorkingTreeSnapshot }
  | { ok: false; message: string };

export interface WorkingTreeOptions {
  env?: NodeJS.ProcessEnv;
}

export async function snapshotWorkingTree(
  cwd: string,
  options: WorkingTreeOptions = {},
): Promise<WorkingTreeSnapshotResult> {
  const git = gitRunner(cwd, options);
  try {
    const inside = await git.run(['rev-parse', '--is-inside-work-tree']);
    if (inside.trim() !== 'true') {
      return { ok: false, message: `${cwd} is not inside a git work tree` };
    }
    const root = (await git.run(['rev-parse', '--show-toplevel'])).trim();
    const head = (
      await git.run(['rev-parse', '--verify', '--quiet', 'HEAD'], {
        allowExit: [1],
      })
    ).trim();
    const unfiltered = await git.withoutFilters(root);
    const raw = await unfiltered.run([
      ...TRUTHFUL_STATUS_CONFIG,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--ignored=no',
    ]);
    const status = parsePorcelainZ(raw);
    // Every tracked path, relative to the root even when cwd is below it.
    const index = parseIndexEntries(
      await unfiltered.run([
        ...TRUTHFUL_STATUS_CONFIG,
        'ls-files',
        '-v',
        '-z',
        '--full-name',
        ':/',
      ]),
    );
    const content = new Map<string, string>();
    for (const file of new Set([...status.keys(), ...index.hidden])) {
      content.set(file, await fingerprint(path.join(root, file)));
    }
    const modeOnly = index.tracked.filter((file) => !content.has(file));
    for (let start = 0; start < modeOnly.length; start += LSTAT_BATCH) {
      const batch = modeOnly.slice(start, start + LSTAT_BATCH);
      const modes = await Promise.all(
        batch.map((file) => permissionBits(path.join(root, file))),
      );
      batch.forEach((file, offset) => content.set(file, modes[offset]));
    }
    const exclude = path.resolve(
      cwd,
      (await git.run(['rev-parse', '--git-path', 'info/exclude'])).trim(),
    );
    const excludeKey = path.relative(root, exclude).startsWith('..')
      ? exclude
      : path.relative(root, exclude);
    content.set(excludeKey, await fingerprint(exclude));
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
function parseIndexEntries(raw: string) {
  const tracked = new Set<string>();
  const hidden: string[] = [];
  for (const entry of raw.split('\0')) {
    if (entry.length < 3) continue;
    const tag = entry[0];
    const file = entry.slice(2);
    tracked.add(file);
    if (tag === 'S' || (tag >= 'a' && tag <= 'z')) hidden.push(file);
  }
  return { tracked: [...tracked], hidden };
}

// Status reports only an executable-bit change on a clean file, so a chmod
// 600 would otherwise go unseen. No read, so this is cheap for every path.
async function permissionBits(file: string): Promise<string> {
  try {
    return `mode:${((await lstat(file)).mode & 0o7777).toString(8)}`;
  } catch (error) {
    if (isMissing(error)) return 'deleted';
    throw error;
  }
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
  // Permission bits too: git status cannot show a mode change on a path
  // that is already modified.
  return `${(stats.mode & 0o7777).toString(8)}:${await hashFile(file)}`;
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
  const env = snapshotEnv(options.env ?? process.env);
  const run = runGit(cwd, env);
  return {
    run,
    // A runner with every configured filter driver switched off, including
    // the drivers of checked-out submodules. The overrides go through
    // GIT_CONFIG_COUNT because `-c` splits at the first `=` and so cannot
    // name a driver whose name contains one; git passes them on to the git
    // process status starts in each submodule.
    async withoutFilters(root: string) {
      const drivers = new Set<string>();
      await collectFilterDrivers(root, env, drivers);
      const overrides = [...drivers].flatMap((driver) => [
        [`filter.${driver}.clean`, ''],
        [`filter.${driver}.smudge`, ''],
        [`filter.${driver}.process`, ''],
        [`filter.${driver}.required`, 'false'],
      ]);
      const unfiltered: NodeJS.ProcessEnv = {
        ...env,
        GIT_CONFIG_COUNT: String(overrides.length),
      };
      overrides.forEach(([key, value], index) => {
        unfiltered[`GIT_CONFIG_KEY_${index}`] = key;
        unfiltered[`GIT_CONFIG_VALUE_${index}`] = value;
      });
      return { run: runGit(cwd, unfiltered) };
    },
  };
}

// Adds the filter driver names configured for the repository at `root`,
// then recurses into each checked-out submodule, whose own config status reads.
async function collectFilterDrivers(
  root: string,
  env: NodeJS.ProcessEnv,
  drivers: Set<string>,
) {
  const run = runGit(root, env);
  const keys = await run(
    ['config', '-z', '--name-only', '--get-regexp', '^filter\\.'],
    { allowExit: [1] },
  );
  for (const key of keys.split('\0')) {
    const end = key.lastIndexOf('.');
    if (key.startsWith('filter.') && end > 'filter.'.length) {
      drivers.add(key.slice('filter.'.length, end));
    }
  }
  // Gitlinks (mode 160000), relative to `root`; a conflict lists each stage.
  const submodules = new Set<string>();
  for (const entry of (await run(['ls-files', '-s', '-z'])).split('\0')) {
    const tab = entry.indexOf('\t');
    if (entry.startsWith('160000 ') && tab > 0) {
      submodules.add(entry.slice(tab + 1));
    }
  }
  for (const submodule of submodules) {
    const dir = path.join(root, submodule);
    // Status skips a submodule that is not checked out, and git run there
    // would find this repository instead.
    try {
      await lstat(path.join(dir, '.git'));
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }
    await collectFilterDrivers(dir, env, drivers);
  }
}

// Only allowlisted variables reach git: no credentials, none of git's
// repository-local variables, and no inherited config injection.
function snapshotEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { GIT_OPTIONAL_LOCKS: '0' };
  for (const name of SNAPSHOT_ENV_ALLOWLIST) {
    if (base[name] !== undefined) env[name] = base[name];
  }
  return env;
}

function runGit(cwd: string, env: NodeJS.ProcessEnv) {
  return (args: string[], runOptions: { allowExit?: number[] } = {}) =>
    new Promise<string>((resolve, reject) => {
      execFile(
        'git',
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
}
