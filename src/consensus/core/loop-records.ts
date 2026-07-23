import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type { LoopRecord, LoopStatus, RecordsWriter } from './loop-types.js';
import {
  asErrorLike,
  formatArtifactHash,
  LOOP_SCHEMA_VERSION,
} from './loop-validation.js';

function timestamp(options: { now?: () => string } = {}): string {
  return options.now?.() ?? new Date().toISOString();
}

export function withRecordMetadata(
  record: LoopRecord,
  options: { now?: () => string } = {},
): LoopRecord {
  const entry = {
    schema_version: LOOP_SCHEMA_VERSION,
    ...record,
  };
  if (!entry.timestamp) {
    entry.timestamp = timestamp(options);
  }
  return entry;
}

export async function readExistingRecords(recordsPath: string): Promise<LoopRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(recordsPath, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('records file must contain a JSON array');
    }
    return parsed;
  } catch (error) {
    if (asErrorLike(error).code === 'ENOENT') return [];
    throw error;
  }
}

export async function syncFileIfAvailable(filePath: string): Promise<void> {
  let handle;
  try {
    handle = await open(filePath, 'r');
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

/**
 * Write `data` to `targetPath` atomically: write to a same-directory temp
 * file, fsync it, then rename over the target. Same-directory placement is
 * what makes the rename atomic on POSIX (no cross-device rename). On any
 * failure, best-effort remove the temp file and rethrow so the previous
 * `targetPath` contents are left intact.
 */
async function atomicWriteFile(
  targetPath: string,
  data: string,
): Promise<void> {
  const tmpPath = `${targetPath}.${process.pid}.tmp`;
  try {
    await writeFile(tmpPath, data);
    await syncFileIfAvailable(tmpPath);
    await rename(tmpPath, targetPath);
  } catch (error) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore ENOENT */
    }
    throw error;
  }
}

function normalizeCost(
  status: LoopStatus,
): Pick<LoopStatus, 'cost_source'> &
  Partial<Pick<LoopStatus, 'approximate_cost_usd'>> {
  const source = status.cost_source ?? status.cost?.source ?? 'unavailable';
  const normalized = ['provider_cli', 'estimated', 'unavailable'].includes(
    source,
  )
    ? source
    : 'unavailable';
  const costUsd =
    status.approximate_cost_usd ?? status.cost_usd ?? status.cost?.usd;

  if (normalized === 'unavailable' || typeof costUsd !== 'number') {
    return { cost_source: normalized };
  }

  return { cost_source: normalized, approximate_cost_usd: costUsd };
}

export async function createRecordsWriter(
  recordsPath: string,
  options: { now?: () => string } = {},
): Promise<RecordsWriter> {
  await mkdir(path.dirname(recordsPath), { recursive: true });
  const records = await readExistingRecords(recordsPath);

  async function flush() {
    await atomicWriteFile(recordsPath, `${JSON.stringify(records, null, 2)}\n`);
  }

  if (records.length === 0) {
    await flush();
  }

  return {
    path: recordsPath,
    async append(record: LoopRecord) {
      const entry = withRecordMetadata(record, options);
      records.push(entry);
      await flush();
      return entry;
    },
    async close() {
      await flush();
    },
  };
}

export async function writeLoopStatus(
  statusPath: string,
  status: LoopStatus,
  _options = {},
): Promise<LoopStatus> {
  await mkdir(path.dirname(statusPath), { recursive: true });
  const reserved = new Set([
    'schema_version',
    'status',
    'termination_reason',
    'turns',
    'rounds',
    'final_artifact_hash',
    'artifact_hash',
    'cost',
    'cost_source',
    'cost_usd',
    'approximate_cost_usd',
  ]);
  const normalizedStatus: LoopStatus = {
    schema_version: LOOP_SCHEMA_VERSION,
    status: status.status,
    termination_reason: status.termination_reason ?? null,
    turns: status.turns ?? 0,
    rounds: status.rounds ?? 0,
    final_artifact_hash: formatArtifactHash(
      status.final_artifact_hash ?? status.artifact_hash,
    ),
  };

  for (const [key, value] of Object.entries(status)) {
    if (!reserved.has(key)) {
      normalizedStatus[key] = value;
    }
  }

  Object.assign(normalizedStatus, normalizeCost(status));

  await atomicWriteFile(
    statusPath,
    `${JSON.stringify(normalizedStatus, null, 2)}\n`,
  );
  return normalizedStatus;
}

export function peerRecords(records: LoopRecord[]): LoopRecord[] {
  return records.filter(
    (record) =>
      record?.agent !== 'user' &&
      record?.verdict !== 'USER_INTERVENTION' &&
      record?.record_type !== 'synthesis-error',
  );
}

export function peerTurnCount(records: LoopRecord[]): number {
  return peerRecords(records).length;
}

export function synthesisRecordCount(records: LoopRecord[]): number {
  return records.filter((record) => record?.record_type === 'synthesis').length;
}
