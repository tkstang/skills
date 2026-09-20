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
  assertPin,
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
const DIAGNOSTIC_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127})$/u;
const OUTCOME_CODES = new Set<DeliveryDiagnosticRecord['outcomeCode']>([
  'claimed',
  'stdout-written',
  'host-output-attempted',
  'watch-notification-attempted',
  'observation-notification-attempted',
]);
const ERROR_CODES = new Set<NonNullable<DeliveryDiagnosticRecord['errorCode']>>(
  ['diagnostic-write-failed', 'host-timeout', 'host-protocol-error'],
);

function validate(input: DeliveryDiagnosticInput): void {
  assertBoundedString(input.attemptId, 'diagnostic attempt ID', 128);
  if (
    !DIAGNOSTIC_ID.test(input.attemptId) ||
    input.attemptId === '.' ||
    input.attemptId === '..'
  )
    throw new TypeError('diagnostic attempt ID is not path-safe');
  assertUuid(input.activationId, 'diagnostic activation ID');
  assertBoundedString(input.eventKey, 'diagnostic event key', 256);
  if (
    !['prompt-start', 'stop', 'watch', 'monitor', 'manual'].includes(
      input.boundary,
    )
  )
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
  if (!OUTCOME_CODES.has(input.outcomeCode))
    throw new TypeError('diagnostic outcome code is unsupported');
  if (
    input.attemptKind !== undefined &&
    !['message', 'observation'].includes(input.attemptKind)
  )
    throw new TypeError('diagnostic attempt kind is unsupported');
  if (input.attemptKind === 'observation' && !input.observation)
    throw new TypeError('observation diagnostic requires exact range identity');
  if (input.observation) {
    const observation = input.observation;
    assertPin(observation.owner);
    assertPin(observation.peer);
    if (
      ![
        'zero-based-jsonl-record-index',
        'zero-based-jsonl-frame-index',
      ].includes(observation.indexBase) ||
      !Number.isSafeInteger(observation.fromIndex) ||
      !Number.isSafeInteger(observation.toIndex) ||
      !Number.isSafeInteger(observation.nextIndex) ||
      observation.fromIndex < 0 ||
      observation.toIndex < observation.fromIndex ||
      observation.nextIndex !== observation.toIndex + 1 ||
      !/^[a-f0-9]{64}$/u.test(observation.selectedPrefixIdentity)
    )
      throw new TypeError('diagnostic observation identity is invalid');
  }
  if (input.errorCode !== null && !ERROR_CODES.has(input.errorCode))
    throw new TypeError('diagnostic error code is unsupported');
  if (Number.isNaN(Date.parse(input.recordedAt)))
    throw new TypeError('diagnostic recordedAt must be a timestamp');
  for (const value of Object.values(input)) {
    if (
      typeof value === 'string' &&
      /(password|token=|secret|credential)/iu.test(value)
    ) {
      throw new TypeError('diagnostic contains disallowed sensitive text');
    }
  }
}

function validateRecord(record: DeliveryDiagnosticRecord): void {
  if (record.schemaVersion !== SCHEMA_VERSION)
    throw new CollaborationError(
      'MALFORMED_RECORD',
      'diagnostic schema version is unsupported',
    );
  try {
    const {
      schemaVersion: _schemaVersion,
      contentHash: _contentHash,
      ...input
    } = record;
    validate(input);
  } catch (error) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      `diagnostic record is invalid: ${(error as Error).message}`,
    );
  }
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
  const target = path.resolve(directory, `${input.diagnostic.attemptId}.json`);
  if (path.dirname(target) !== path.resolve(directory))
    throw new TypeError('diagnostic target escapes its exact namespace');
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
  return (await publishImmutableRecord(target, record, { root: input.root }))
    .record;
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
    validateRecord(record);
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
