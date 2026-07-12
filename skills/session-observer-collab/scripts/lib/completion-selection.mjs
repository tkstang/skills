const INDEX_BASE = 'zero-based-jsonl-record-index';
const NO_OP_PREFIX = /^\s*\[no-op\](?:\s|$)/iu;
const ACKNOWLEDGMENT =
  /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
const STATUS_ECHO =
  /^\s*(?:status:\s*)?(?:waiting\b|still waiting\b|idle\b|armed\b|monitoring\b|no (?:new )?(?:input|updates?|messages?|changes?)\b)/iu;

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}

function validateDigest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('observer result must be an object');
  if (input.schemaVersion !== 1)
    throw new TypeError('observer result schemaVersion must be 1');
  if (!Array.isArray(input.entries))
    throw new TypeError('observer result entries must be an array');

  const range = input.range;
  const raw = input.accounting?.raw;
  if (
    !range ||
    range.indexBase !== INDEX_BASE ||
    input.accounting?.indexBase !== INDEX_BASE ||
    !raw
  ) {
    throw new TypeError('observer result must include raw range accounting');
  }
  const fromIndex = integer(range.fromIndex, 'range.fromIndex');
  const nextIndex = integer(range.nextIndex, 'range.nextIndex');
  const totalRecords = integer(range.totalRecords, 'range.totalRecords');
  if (
    nextIndex !== totalRecords ||
    raw.fromIndex !== fromIndex ||
    raw.nextIndex !== nextIndex ||
    raw.totalRecords !== totalRecords ||
    raw.count !== Math.max(0, nextIndex - fromIndex) ||
    range.newRecords !== raw.count
  ) {
    throw new TypeError('observer range and accounting must agree exactly');
  }
  if (
    input.accounting.rendered?.count !== input.entries.length ||
    input.accounting.filtered?.tailSliceEntries > 0 ||
    input.accounting.autoLargeDigest
  ) {
    throw new TypeError(
      'observer result must contain the complete normalized range',
    );
  }

  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new TypeError(`entries[${index}] must be an object`);
    integer(entry.recordIndex, `entries[${index}].recordIndex`);
    if (
      entry.recordIndex < fromIndex ||
      entry.recordIndex >= nextIndex ||
      (entry.role !== 'user' && entry.role !== 'assistant') ||
      typeof entry.text !== 'string' ||
      typeof entry.kind !== 'string'
    ) {
      throw new TypeError(
        `entries[${index}] is outside the normalized contract`,
      );
    }
    return entry;
  });
  entries.sort((left, right) => left.recordIndex - right.recordIndex);
  return { entries, fromIndex, nextIndex };
}

function isAutomatic(entry) {
  return (
    entry.origin === 'automatic-control' ||
    entry.displayRole === 'automatic-control' ||
    entry.automaticControl?.automatic === true
  );
}

function completedTurns(entries, fromIndex) {
  const turns = [];
  let start = fromIndex;
  let current = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    current.push(entry);
    if (
      entry.role !== 'assistant' ||
      entry.kind !== 'message' ||
      entry.origin === 'runtime-diagnostic'
    ) {
      continue;
    }
    const next = entries[index + 1];
    if (
      next?.role === 'assistant' &&
      next.kind === 'message' &&
      next.origin !== 'runtime-diagnostic'
    ) {
      continue;
    }

    const assistantEntries = current.filter(
      (candidate) =>
        candidate.role === 'assistant' &&
        candidate.kind === 'message' &&
        candidate.origin !== 'runtime-diagnostic' &&
        !isAutomatic(candidate),
    );
    const text = assistantEntries.map((candidate) => candidate.text).join('\n');
    const automaticWake = current.some(isAutomatic);
    const classification =
      text.trim().length === 0
        ? 'empty-turn'
        : NO_OP_PREFIX.test(text)
          ? 'no-op-turn'
          : automaticWake &&
              (ACKNOWLEDGMENT.test(text) || STATUS_ECHO.test(text))
            ? 'automatic-control-turn'
            : 'substantive-turn';
    turns.push({
      fromIndex: start,
      toIndex: entry.recordIndex,
      classification,
    });
    start = entry.recordIndex + 1;
    current = [];
  }
  return turns;
}

function mergeSkipped(turns, fromIndex, nextIndex) {
  const skipped = [];
  let cursor = fromIndex;
  for (const turn of turns) {
    if (turn.fromIndex > cursor) {
      skipped.push({
        fromIndex: cursor,
        toIndex: turn.fromIndex - 1,
        classification: 'metadata-only',
      });
    }
    skipped.push(turn);
    cursor = turn.toIndex + 1;
  }
  if (cursor < nextIndex) {
    skipped.push({
      fromIndex: cursor,
      toIndex: nextIndex - 1,
      classification: 'metadata-only',
    });
  }
  return skipped;
}

export function selectCompletedContinuation(observerResult) {
  const { entries, fromIndex, nextIndex } = validateDigest(observerResult);
  const turns = completedTurns(entries, fromIndex);
  const selected = turns.findLast(
    (turn) => turn.classification === 'substantive-turn',
  );

  if (!selected) {
    return Object.freeze({
      status: 'no-continuation',
      continuation: false,
      completedRecord: null,
      nextCursor: nextIndex,
      peerCursor: nextIndex,
      budgetCost: 0,
      range: null,
      reviewEntries: Object.freeze([]),
      skipped: Object.freeze(mergeSkipped(turns, fromIndex, nextIndex)),
    });
  }

  const completedRecord = selected.toIndex;
  const cursor = completedRecord + 1;
  return Object.freeze({
    status: 'continuation',
    continuation: true,
    completedRecord,
    nextCursor: cursor,
    peerCursor: cursor,
    budgetCost: 1,
    range: Object.freeze({
      indexBase: INDEX_BASE,
      fromIndex,
      toIndex: completedRecord,
    }),
    reviewEntries: Object.freeze(
      entries.filter((entry) => entry.recordIndex <= completedRecord),
    ),
    skipped: Object.freeze([]),
  });
}
