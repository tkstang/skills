import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';

import { SCHEMA_VERSION } from './types.js';

export type CollaborationErrorCode =
  | 'CAPACITY_EXCEEDED'
  | 'COMMIT_UNCERTAIN'
  | 'INVALID_ID'
  | 'INVALID_ROOT'
  | 'MALFORMED_RECORD'
  | 'RECORD_CONFLICT'
  | 'RECORD_TOO_LARGE'
  | 'STORAGE_UNSUPPORTED'
  | 'UNKNOWN_SCHEMA'
  | 'UNSAFE_PATH';

export class CollaborationError extends Error {
  readonly code: CollaborationErrorCode;
  readonly retryable: boolean;

  constructor(
    code: CollaborationErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'CollaborationError';
    this.code = code;
    this.retryable = retryable;
  }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(stable(value))}\n`;
}

export function canonicalHash(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex');
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function assertSchema(
  record: unknown,
): asserts record is Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      'record must be a JSON object',
    );
  }
  const version = (record as { schemaVersion?: unknown }).schemaVersion;
  if (version !== SCHEMA_VERSION) {
    throw new CollaborationError(
      'UNKNOWN_SCHEMA',
      `unsupported schema version: ${String(version)}`,
    );
  }
}

export async function readJsonRecord<T>(
  file: string,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const info = await lstat(file).catch((error) => {
    if (isMissing(error)) throw error;
    throw new CollaborationError(
      'UNSAFE_PATH',
      `cannot inspect record: ${(error as Error).message}`,
    );
  });
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'record must be a regular file',
    );
  }
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'record owner does not match the current user',
    );
  }
  const maxBytes = options.maxBytes ?? 128 * 1024;
  if (info.size > maxBytes) {
    throw new CollaborationError(
      'RECORD_TOO_LARGE',
      `record exceeds ${maxBytes} bytes`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      `invalid JSON record: ${(error as Error).message}`,
    );
  }
  assertSchema(parsed);
  return parsed as T;
}

async function ensurePrivateDirectory(
  directory: string,
  root: string,
): Promise<void> {
  if (!path.isAbsolute(root) || !path.isAbsolute(directory)) {
    throw new CollaborationError(
      'INVALID_ROOT',
      'storage paths must be absolute',
    );
  }
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'record path escapes the collaboration root',
    );
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  const canonicalRoot = await realpath(root);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const info = await lstat(directory);
  const canonicalDirectory = await realpath(directory);
  const canonicalRelative = path.relative(canonicalRoot, canonicalDirectory);
  if (
    !info.isDirectory() ||
    canonicalRelative.startsWith('..') ||
    path.isAbsolute(canonicalRelative) ||
    (typeof process.getuid === 'function' && info.uid !== process.getuid())
  ) {
    throw new CollaborationError('UNSAFE_PATH', 'storage directory is unsafe');
  }
}

export interface PublicationResult<T> {
  created: boolean;
  path: string;
  hash: string;
  record: T;
}

export interface PublicationHooks {
  afterFileSync?: () => void | Promise<void>;
  afterLink?: () => void | Promise<void>;
  beforeDirectorySync?: () => void | Promise<void>;
}

export async function publishImmutableRecord<T extends { schemaVersion: 1 }>(
  target: string,
  record: T,
  options: { root: string; hooks?: PublicationHooks },
): Promise<PublicationResult<T>> {
  assertSchema(record);
  const directory = path.dirname(target);
  await ensurePrivateDirectory(directory, options.root);
  const bytes = canonicalJson(record);
  const hash = canonicalHash(record);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.tmp-${process.pid}-${randomUUID()}`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let published = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await options.hooks?.afterFileSync?.();
    await handle.close();
    handle = undefined;
    await import('node:fs/promises').then(({ link }) =>
      link(temporary, target),
    );
    published = true;
    await options.hooks?.afterLink?.();
    await options.hooks?.beforeDirectorySync?.();
    const directoryHandle = await open(directory, 'r');
    try {
      await directoryHandle.sync();
    } catch (error) {
      throw new CollaborationError(
        'COMMIT_UNCERTAIN',
        `record was published but directory sync failed: ${(error as Error).message}`,
        true,
      );
    } finally {
      await directoryHandle.close();
    }
    return { created: true, path: target, hash, record };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {
      const existing = await readJsonRecord<T>(target);
      if (canonicalHash(existing) !== hash) {
        throw new CollaborationError(
          'RECORD_CONFLICT',
          'record ID already has different content',
        );
      }
      return { created: false, path: target, hash, record: existing };
    }
    if (error instanceof CollaborationError) throw error;
    if (
      code === 'EXDEV' ||
      code === 'EPERM' ||
      code === 'EOPNOTSUPP' ||
      code === 'ENOTSUP'
    ) {
      throw new CollaborationError(
        'STORAGE_UNSUPPORTED',
        `hard-link publication is unsupported: ${code}`,
      );
    }
    if (published) {
      throw new CollaborationError(
        'COMMIT_UNCERTAIN',
        `record publication outcome is uncertain: ${(error as Error).message}`,
        true,
      );
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }
}

export async function enumerateJsonRecords(
  directory: string,
  options: { maxEntries: number },
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (isMissing(error)) return [];
      throw error;
    },
  );
  const records = entries
    .filter(
      (entry) => !entry.name.startsWith('.') && entry.name.endsWith('.json'),
    )
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new CollaborationError(
          'UNSAFE_PATH',
          `record entry ${entry.name} is not a regular file`,
        );
      }
      return path.join(directory, entry.name);
    })
    .toSorted();
  if (records.length > options.maxEntries) {
    throw new CollaborationError(
      'CAPACITY_EXCEEDED',
      `record directory exceeds ${options.maxEntries} entries`,
    );
  }
  return records;
}
