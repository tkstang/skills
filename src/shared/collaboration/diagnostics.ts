import path from 'node:path';

import { activationDirectory } from './paths.js';
import {
  canonicalJson,
  canonicalRecordHash,
  CollaborationError,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
} from './records.js';
import {
  assertBoundedString,
  assertUuid,
  SCHEMA_VERSION,
  type DeliveryDiagnosticRecord,
  type Pin,
} from './types.js';

export const MAX_DIAGNOSTICS = 4096;
export const MAX_DIAGNOSTIC_BYTES = 8192;

export type DeliveryDiagnosticInput = Omit<
  DeliveryDiagnosticRecord,
  'schemaVersion' | 'contentHash'
>;

function validate(input: DeliveryDiagnosticInput): void {
  assertBoundedString(input.attemptId, 'diagnostic attempt ID', 128);
  assertUuid(input.activationId, 'diagnostic activation ID');
  assertBoundedString(input.eventKey, 'diagnostic event key', 256);
  if (!['prompt-start', 'stop', 'watch', 'manual'].includes(input.boundary))
    throw new TypeError('diagnostic boundary is unsupported');
  if (
    ![
      'event-claimed',
      'slot-claimed',
      'messages-claimed',
      'final-validation',
      'output-attempted',
    ].includes(input.stage)
  )
    throw new TypeError('diagnostic stage is unsupported');
  assertBoundedString(input.outcomeCode, 'diagnostic outcome code', 64);
  if (input.errorCode !== null)
    assertBoundedString(input.errorCode, 'diagnostic error code', 64);
  if (Number.isNaN(Date.parse(input.recordedAt)))
    throw new TypeError('diagnostic recordedAt must be a timestamp');
  for (const value of Object.values(input)) {
    if (
      typeof value === 'string' &&
      /(password|token=|secret|prompt|credential)/iu.test(value)
    ) {
      throw new TypeError('diagnostic contains disallowed sensitive text');
    }
  }
}

export async function publishDeliveryDiagnostic(input: {
  root: string;
  pin: Pin;
  diagnostic: DeliveryDiagnosticInput;
}): Promise<DeliveryDiagnosticRecord> {
  validate(input.diagnostic);
  const base = {
    schemaVersion: SCHEMA_VERSION,
    ...input.diagnostic,
  } satisfies Omit<DeliveryDiagnosticRecord, 'contentHash'>;
  const record: DeliveryDiagnosticRecord = {
    ...base,
    contentHash: canonicalRecordHash(
      base as unknown as Record<string, unknown>,
    ),
  };
  if (Buffer.byteLength(canonicalJson(record), 'utf8') > MAX_DIAGNOSTIC_BYTES)
    throw new CollaborationError(
      'RECORD_TOO_LARGE',
      'delivery diagnostic exceeds 8 KiB',
    );
  const directory = path.join(
    activationDirectory(input.root, input.pin),
    'diagnostics',
  );
  const existing = await enumerateJsonRecords(directory, {
    root: input.root,
    maxEntries: MAX_DIAGNOSTICS,
  });
  if (
    existing.length >= MAX_DIAGNOSTICS &&
    !existing.some(
      (file) => path.basename(file) === `${input.diagnostic.attemptId}.json`,
    )
  )
    throw new CollaborationError(
      'CAPACITY_EXCEEDED',
      'diagnostic capacity is exhausted',
    );
  return (
    await publishImmutableRecord(
      path.join(directory, `${input.diagnostic.attemptId}.json`),
      record,
      { root: input.root },
    )
  ).record;
}

export async function latestDeliveryDiagnostic(input: {
  root: string;
  pin: Pin;
}): Promise<{
  latest: DeliveryDiagnosticRecord | null;
  capacityError: string | null;
}> {
  const directory = path.join(
    activationDirectory(input.root, input.pin),
    'diagnostics',
  );
  let files: string[];
  try {
    files = await enumerateJsonRecords(directory, {
      root: input.root,
      maxEntries: MAX_DIAGNOSTICS,
    });
  } catch (error) {
    if (
      error instanceof CollaborationError &&
      error.code === 'CAPACITY_EXCEEDED'
    )
      return { latest: null, capacityError: error.message };
    throw error;
  }
  const records = await Promise.all(
    files.map((file) =>
      readJsonRecord<DeliveryDiagnosticRecord>(file, {
        root: input.root,
        maxBytes: MAX_DIAGNOSTIC_BYTES,
      }),
    ),
  );
  for (const record of records) {
    if (
      record.contentHash !==
      canonicalRecordHash(
        record as unknown as Record<string, unknown> & { contentHash: string },
      )
    )
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'diagnostic contentHash does not match content',
      );
  }
  return {
    latest:
      records.toSorted(
        (left, right) =>
          right.recordedAt.localeCompare(left.recordedAt) ||
          right.attemptId.localeCompare(left.attemptId),
      )[0] ?? null,
    capacityError: null,
  };
}
