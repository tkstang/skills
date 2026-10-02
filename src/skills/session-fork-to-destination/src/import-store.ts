import { createHash, randomUUID } from 'node:crypto';
import { constants, type BigIntStats } from 'node:fs';
import {
  link,
  lstat,
  mkdir,
  open,
  opendir,
  realpath,
  unlink,
} from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import {
  checkDeadline,
  IMPORT_MAX_BYTES,
  object,
  refuse,
  SessionImportError,
} from './import-errors.js';
import type { ImportProvider } from './native-history.js';
export const sha256 = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');
export interface SourceSnapshot {
  bytes: Buffer;
  records: Record<string, unknown>[];
  digest: string;
  identity: {
    dev: string;
    ino: string;
    size: string;
    mtimeNs: string;
    ctimeNs: string;
  };
}
export async function readImportSnapshot(
  path: string,
  deadline: number,
): Promise<SourceSnapshot> {
  checkDeadline(deadline);
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    refuse('source-unreadable');
  }
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile()) refuse('source-unreadable');
    if (before.size > BigInt(IMPORT_MAX_BYTES)) refuse('import-limit-exceeded');
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      checkDeadline(deadline);
      const read = await file.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (!read.bytesRead) refuse('source-snapshot-changed');
      offset += read.bytesRead;
    }
    const after = await file.stat({ bigint: true });
    const identity = {
      dev: String(before.dev),
      ino: String(before.ino),
      size: String(before.size),
      mtimeNs: String(before.mtimeNs),
      ctimeNs: String(before.ctimeNs),
    };
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    )
      refuse('source-snapshot-changed');
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      refuse('malformed-native-history');
    }
    if (!text.endsWith('\n')) refuse('malformed-native-history');
    const lines = text.slice(0, -1).split('\n');
    if (lines.length > 100_000) refuse('import-limit-exceeded');
    const records = lines.map((line) => {
      checkDeadline(deadline);
      if (Buffer.byteLength(line) > 4 * 1024 * 1024)
        refuse('import-limit-exceeded');
      try {
        return object(JSON.parse(line));
      } catch (error) {
        if (error instanceof SessionImportError) throw error;
        refuse('malformed-native-history');
      }
    });
    return { bytes, records, digest: sha256(bytes), identity };
  } finally {
    await file.close();
  }
}
export async function revalidateImportSnapshot(
  path: string,
  snapshot: SourceSnapshot,
  deadline: number,
): Promise<void> {
  const current = await readImportSnapshot(path, deadline);
  if (
    current.digest !== snapshot.digest ||
    JSON.stringify(current.identity) !== JSON.stringify(snapshot.identity)
  )
    refuse('source-snapshot-changed');
}
export type ImportOccupancy = 'absent' | 'exact' | 'diverged' | 'archived';
function within(home: string, path: string): void {
  const rel = relative(home, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith(sep))
    refuse('invalid-store-path');
}
async function exists(path: string) {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function storeWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM')
      throw new SessionImportError('store-write-denied');
    throw error;
  }
}
async function inspectParents(
  home: string,
  path: string,
  create: boolean,
  deadline: number,
): Promise<Array<{ path: string; dev: bigint; ino: bigint }>> {
  within(home, path);
  const parts = relative(home, dirname(path)).split(sep).filter(Boolean);
  const parents = [];
  let current = home;
  const root = await lstat(home, { bigint: true });
  if (
    !root.isDirectory() ||
    root.isSymbolicLink() ||
    (await realpath(home)) !== home
  )
    refuse('store-path-drift');
  parents.push({ path: home, dev: root.dev, ino: root.ino });
  for (const part of parts) {
    checkDeadline(deadline);
    current = join(current, part);
    let stat = await exists(current);
    if (!stat && create) {
      try {
        await storeWrite(() => mkdir(current, { mode: 0o700 }));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      stat = await exists(current);
    }
    if (!stat) break;
    if (!stat.isDirectory() || stat.isSymbolicLink())
      refuse('unsafe-store-path');
    parents.push({ path: current, dev: stat.dev, ino: stat.ino });
  }
  return parents;
}
function sameSeedIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return (
    right.isFile() &&
    !right.isSymbolicLink() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.mode === right.mode &&
    left.uid === right.uid &&
    left.gid === right.gid
  );
}
async function matchesBytes(
  path: string,
  bytes: Buffer,
  deadline: number,
): Promise<boolean> {
  checkDeadline(deadline);
  const anchor = await exists(path);
  if (!anchor) return false;
  if (!anchor.isFile() || anchor.isSymbolicLink()) refuse('unsafe-store-path');
  if (anchor.size !== BigInt(bytes.length)) return false;
  // Removing a winner's staging hardlink changes ctime without changing data.
  // Restart the entire bounded read once for ctime-only drift; never ignore it,
  // reanchor to a replacement inode, or retry byte/mtime/ownership/path drift.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    checkDeadline(deadline);
    const pathBefore = attempt === 0 ? anchor : await exists(path);
    if (!pathBefore || !sameSeedIdentity(anchor, pathBefore))
      refuse('store-path-drift');
    let file;
    try {
      file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = await file.stat({ bigint: true });
      if (!sameSeedIdentity(anchor, opened)) refuse('store-path-drift');
      if (opened.ctimeNs !== pathBefore.ctimeNs) continue;
      const existing = Buffer.alloc(bytes.length);
      let offset = 0;
      while (offset < existing.length) {
        checkDeadline(deadline);
        const read = await file.read(
          existing,
          offset,
          existing.length - offset,
          offset,
        );
        if (!read.bytesRead) refuse('store-path-drift');
        offset += read.bytesRead;
      }
      const after = await file.stat({ bigint: true });
      if (!sameSeedIdentity(anchor, after)) refuse('store-path-drift');
      if (after.ctimeNs !== opened.ctimeNs) continue;
      const pathAfter = await exists(path);
      if (!pathAfter || !sameSeedIdentity(anchor, pathAfter))
        refuse('store-path-drift');
      if (pathAfter.ctimeNs !== after.ctimeNs) continue;
      return existing.equals(bytes);
    } finally {
      await file?.close();
    }
  }
  refuse('store-path-drift');
}

async function enumerateMatches(
  dir: string,
  id: string,
  deadline: number,
  recursive: boolean,
  counter: { value: number },
  matches: string[],
): Promise<void> {
  checkDeadline(deadline);
  const stat = await exists(dir);
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('unsafe-store-path');
  const handle = await opendir(dir);
  for await (const entry of handle) {
    checkDeadline(deadline);
    if (++counter.value > 50_000) refuse('import-limit-exceeded');
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      if (entry.name.endsWith(`${id}.jsonl`) || recursive)
        refuse('unsafe-store-path');
      continue;
    }
    if (entry.name.endsWith(`-${id}.jsonl`)) matches.push(path);
    if (recursive && entry.isDirectory())
      await enumerateMatches(path, id, deadline, true, counter, matches);
  }
}
export async function inspectImportOccupancy(
  home: string,
  path: string,
  id: string,
  provider: ImportProvider,
  bytes: Buffer,
  deadline: number,
): Promise<ImportOccupancy> {
  await inspectParents(home, path, false, deadline);
  if (provider === 'codex') {
    const counter = { value: 0 };
    const archives: string[] = [];
    await enumerateMatches(
      join(home, 'archived_sessions'),
      id,
      deadline,
      true,
      counter,
      archives,
    );
    if (archives.length) return 'archived';
    const active: string[] = [];
    await enumerateMatches(dirname(path), id, deadline, false, counter, active);
    if (active.some((p) => p !== path)) return 'diverged';
  }
  const stat = await exists(path);
  if (!stat) return 'absent';
  return (await matchesBytes(path, bytes, deadline)) ? 'exact' : 'diverged';
}
export async function publishImportSeed(
  home: string,
  path: string,
  id: string,
  provider: ImportProvider,
  bytes: Buffer,
  deadline: number,
  revalidate: () => Promise<void>,
): Promise<'imported' | 'already-imported'> {
  let temporary: string | undefined;
  let published = false;
  let ownsTemporary = false;
  const publish = async (): Promise<'imported' | 'already-imported'> => {
    try {
      const occupancy = await inspectImportOccupancy(
        home,
        path,
        id,
        provider,
        bytes,
        deadline,
      );
      if (occupancy === 'exact') {
        await revalidate();
        const current = await inspectImportOccupancy(
          home,
          path,
          id,
          provider,
          bytes,
          deadline,
        );
        if (current !== 'exact')
          refuse(current === 'archived' ? 'seed-archived' : 'seed-diverged');
        return 'already-imported';
      }
      if (occupancy === 'archived')
        refuse(
          'seed-archived',
          'Restore the seed through the provider archive workflow, then replan.',
        );
      if (occupancy === 'diverged')
        refuse(
          'seed-diverged',
          'The existing seed evolved. Manually fork that seed if its additional history is wanted.',
        );
      const parents = await inspectParents(home, path, true, deadline);
      const stagingPath = join(
        dirname(path),
        `.session-import-${randomUUID()}.tmp`,
      );
      temporary = stagingPath;
      const file = await storeWrite(() =>
        open(
          stagingPath,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          0o600,
        ),
      );
      ownsTemporary = true;
      try {
        await storeWrite(() => file.writeFile(bytes));
        await storeWrite(() => file.sync());
      } finally {
        await file.close();
      }
      await revalidate();
      checkDeadline(deadline);
      for (const expected of parents) {
        const actual = await lstat(expected.path, { bigint: true });
        if (
          !actual.isDirectory() ||
          actual.isSymbolicLink() ||
          actual.dev !== expected.dev ||
          actual.ino !== expected.ino
        )
          refuse('store-path-drift');
      }
      const now = await inspectImportOccupancy(
        home,
        path,
        id,
        provider,
        bytes,
        deadline,
      );
      if (now === 'archived') refuse('seed-archived');
      if (now === 'diverged') refuse('seed-diverged');
      if (now === 'exact') return 'already-imported';
      try {
        await storeWrite(() => link(stagingPath, path));
        published = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          if (await matchesBytes(path, bytes, deadline))
            return 'already-imported';
          refuse('seed-diverged');
        }
        if (
          ['ENOTSUP', 'EOPNOTSUPP', 'EXDEV'].includes(
            (error as NodeJS.ErrnoException).code ?? '',
          )
        )
          throw new SessionImportError('store-publication-unsupported');
        throw error;
      }
      const dir = await open(dirname(path), constants.O_RDONLY);
      try {
        await dir.sync();
      } finally {
        await dir.close();
      }
      return 'imported';
    } catch (error) {
      if (published)
        throw new SessionImportError(
          'seed-published-durability-failed',
          'The seed was published, but durability verification failed. Exact bytes are safe to retry.',
        );
      throw error;
    }
  };
  let result: 'imported' | 'already-imported' | undefined;
  let failure: unknown;
  try {
    result = await publish();
  } catch (error) {
    failure = error;
  }
  if (temporary && ownsTemporary) {
    try {
      await unlink(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const cleanupFailure = new SessionImportError(
          published ? 'seed-published-cleanup-failed' : 'store-cleanup-failed',
          'Owned staging-file cleanup failed; inspect the destination directory before retrying.',
        );
        if (failure === undefined) throw cleanupFailure;
        if (failure instanceof Error)
          failure.message += ` Secondary cleanup failure (${cleanupFailure.code}): ${cleanupFailure.message}`;
      }
    }
  }
  if (failure !== undefined) throw failure;
  return result!;
}
