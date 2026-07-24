const RECORD_INDEX_BASE = 'zero-based-jsonl-record-index';
const FRAME_INDEX_BASE = 'zero-based-jsonl-frame-index';
const NO_OP_PREFIX = /^\s*\[no-op\](?:\s|$)/iu;
const ACKNOWLEDGMENT =
  /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
const STATUS_ECHO =
  /^\s*(?:status:\s*)?(?:(?:still\s+)?(?:waiting|holding|idle|armed|monitoring)(?:\s+(?:for|on|until)\s+[^.!?;:]+)?|no (?:new )?(?:input|updates?|messages?|changes?))[.!]*\s*$/iu;

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}

function requireObserverResult(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('observer result must be an object');
  if (!Array.isArray(input.entries))
    throw new TypeError('observer result entries must be an array');
  return input;
}

function validateV1Digest(input) {
  const range = input.range;
  const raw = input.accounting?.raw;
  if (
    !range ||
    range.indexBase !== RECORD_INDEX_BASE ||
    input.accounting?.indexBase !== RECORD_INDEX_BASE ||
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
  return {
    entries,
    fromIndex,
    indexBase: RECORD_INDEX_BASE,
    nextIndex,
    selectedPrefix: null,
  };
}

function nullableIndex(value, label) {
  if (value === null) return null;
  return integer(value, label);
}

function validateSelectedPrefix(value, nextIndex) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.indexBase !== FRAME_INDEX_BASE ||
    integer(value.nextFrameIndex, 'selectedPrefix.nextFrameIndex') !==
      nextIndex ||
    !Number.isSafeInteger(value.prefixBytes) ||
    value.prefixBytes < 0 ||
    value.observedSize !== value.prefixBytes ||
    !/^[a-f0-9]{64}$/u.test(value.prefixSha256) ||
    !Number.isSafeInteger(value.device) ||
    value.device < 0 ||
    !Number.isSafeInteger(value.inode) ||
    value.inode < 0
  ) {
    throw new TypeError(
      'observer result must bind the selected Cursor prefix snapshot',
    );
  }
  return Object.freeze({ ...value });
}

function validateV2Digest(input) {
  if (input.runtime !== 'cursor') {
    throw new TypeError('observer result schemaVersion 2 must use Cursor');
  }
  if (input.cursorEvidence?.projection !== 'confirmed-completion') {
    throw new TypeError(
      'observer result schemaVersion 2 must use confirmed-completion projection',
    );
  }

  const range = input.range;
  const accounting = input.accounting;
  const raw = accounting?.raw;
  if (
    !range ||
    range.indexBase !== FRAME_INDEX_BASE ||
    accounting?.indexBase !== FRAME_INDEX_BASE ||
    !raw
  ) {
    throw new TypeError(
      'observer result schemaVersion 2 must use the frame index base',
    );
  }

  const fromIndex = integer(range.fromIndex, 'range.fromIndex');
  const nextIndex = integer(range.nextIndex, 'range.nextIndex');
  const totalFrames = integer(range.totalFrames, 'range.totalFrames');
  const rawCount = Math.max(0, nextIndex - fromIndex);
  const expectedToIndex = rawCount > 0 ? nextIndex - 1 : null;
  if (
    fromIndex > nextIndex ||
    nextIndex > totalFrames ||
    nullableIndex(range.toIndex, 'range.toIndex') !== expectedToIndex ||
    range.newFrames !== rawCount ||
    raw.fromIndex !== fromIndex ||
    raw.toIndex !== expectedToIndex ||
    raw.count !== rawCount ||
    raw.nextIndex !== nextIndex ||
    raw.totalFrames !== totalFrames
  ) {
    throw new TypeError(
      'observer result must contain complete frame range accounting',
    );
  }

  const rendered = accounting.rendered;
  const buffered = accounting.buffered;
  const bufferedCount = totalFrames - nextIndex;
  const hasPendingSuffix = bufferedCount > 0;
  const completeBufferedSuffix =
    buffered &&
    (hasPendingSuffix
      ? buffered.fromIndex === nextIndex &&
        buffered.count === bufferedCount &&
        buffered.reason === 'stability-wait' &&
        input.cursorEvidence.bufferedFromFrame === nextIndex &&
        input.cursorEvidence.status?.lifecycle === 'pending'
      : buffered.fromIndex === null &&
        buffered.count === 0 &&
        buffered.reason === null &&
        input.cursorEvidence.bufferedFromFrame === null);
  if (
    !rendered ||
    rendered.count !== input.entries.length ||
    !buffered ||
    !completeBufferedSuffix ||
    accounting.filtered?.unstableContent !== 0 ||
    input.cursorEvidence.blockingFrame !== null ||
    input.cursorEvidence.status?.health !== 'healthy'
  ) {
    throw new TypeError(
      'observer result must contain the complete confirmed-completion range',
    );
  }

  const lifecycleEvents = input.cursorEvidence.lifecycleEvents;
  if (!Array.isArray(lifecycleEvents)) {
    throw new TypeError(
      'observer result must include confirmed completion lifecycle events',
    );
  }

  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`entries[${index}] must be an object`);
    }
    const deliveryIndex = integer(
      entry.recordIndex,
      `entries[${index}].recordIndex`,
    );
    const sourceFrameIndex = integer(
      entry.sourceFrameIndex,
      `entries[${index}].sourceFrameIndex`,
    );
    const matchingLifecycle = lifecycleEvents.some(
      (event) =>
        event?.turnId === entry.turnId &&
        event.terminalFrameIndex === deliveryIndex &&
        event.lifecycle === 'success' &&
        event.finalEntryKey === entry.entryKey,
    );
    if (
      deliveryIndex < fromIndex ||
      deliveryIndex >= nextIndex ||
      sourceFrameIndex < fromIndex ||
      sourceFrameIndex > deliveryIndex ||
      entry.role !== 'assistant' ||
      entry.kind !== 'message' ||
      typeof entry.text !== 'string' ||
      typeof entry.entryKey !== 'string' ||
      entry.entryKey.length === 0 ||
      typeof entry.turnId !== 'string' ||
      entry.turnId.length === 0 ||
      entry.availability !== 'completed' ||
      !matchingLifecycle
    ) {
      throw new TypeError(
        `entries[${index}] is outside the confirmed-completion contract`,
      );
    }
    return entry;
  });
  entries.sort((left, right) => left.recordIndex - right.recordIndex);

  const renderedFromIndex = entries.length > 0 ? entries[0].recordIndex : null;
  const renderedToIndex =
    entries.length > 0 ? entries.at(-1).recordIndex : null;
  if (
    range.renderedFromIndex !== renderedFromIndex ||
    range.renderedToIndex !== renderedToIndex ||
    rendered.fromIndex !== renderedFromIndex ||
    rendered.toIndex !== renderedToIndex
  ) {
    throw new TypeError(
      'observer result must contain complete rendered frame accounting',
    );
  }

  return {
    entries,
    fromIndex,
    indexBase: FRAME_INDEX_BASE,
    nextIndex,
    selectedPrefix: validateSelectedPrefix(
      input.cursorEvidence.selectedPrefix,
      nextIndex,
    ),
  };
}

function validateDigest(input) {
  const result = requireObserverResult(input);
  if (result.schemaVersion === 1) return validateV1Digest(result);
  if (result.schemaVersion === 2) return validateV2Digest(result);
  throw new TypeError('observer result schemaVersion must be 1 or 2');
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
  const incompleteFrom = current.some(
    (entry) => entry.role === 'user' && !isAutomatic(entry),
  )
    ? start
    : null;
  return { turns, incompleteFrom };
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
  const { entries, fromIndex, indexBase, nextIndex, selectedPrefix } =
    validateDigest(observerResult);
  if (indexBase === FRAME_INDEX_BASE) {
    const selected = entries.at(-1);
    if (!selected) {
      return Object.freeze({
        status: 'no-continuation',
        continuation: false,
        indexBase,
        fromIndex,
        completedIndex: null,
        completedRecord: null,
        nextCursor: nextIndex,
        peerCursor: nextIndex,
        budgetCost: 0,
        range: null,
        reviewEntries: Object.freeze([]),
        skipped: Object.freeze(mergeSkipped([], fromIndex, nextIndex)),
        selectedPrefix,
      });
    }

    const completedIndex = selected.recordIndex;
    const cursor = completedIndex + 1;
    return Object.freeze({
      status: 'continuation',
      continuation: true,
      indexBase,
      fromIndex,
      completedIndex,
      completedRecord: completedIndex,
      nextCursor: cursor,
      peerCursor: cursor,
      budgetCost: 1,
      range: Object.freeze({
        indexBase,
        fromIndex,
        toIndex: completedIndex,
      }),
      reviewEntries: Object.freeze(
        entries.filter((entry) => entry.recordIndex <= completedIndex),
      ),
      skipped: Object.freeze([]),
      selectedPrefix,
    });
  }

  const { turns, incompleteFrom } = completedTurns(entries, fromIndex);
  const selected = turns.findLast(
    (turn) => turn.classification === 'substantive-turn',
  );

  if (!selected) {
    const safeCursor = incompleteFrom ?? nextIndex;
    return Object.freeze({
      status: 'no-continuation',
      continuation: false,
      indexBase,
      fromIndex,
      completedIndex: null,
      completedRecord: null,
      nextCursor: safeCursor,
      peerCursor: safeCursor,
      budgetCost: 0,
      range: null,
      reviewEntries: Object.freeze([]),
      skipped: Object.freeze(mergeSkipped(turns, fromIndex, safeCursor)),
      selectedPrefix,
    });
  }

  const completedRecord = selected.toIndex;
  const cursor = completedRecord + 1;
  return Object.freeze({
    status: 'continuation',
    continuation: true,
    indexBase,
    fromIndex,
    completedIndex: completedRecord,
    completedRecord,
    nextCursor: cursor,
    peerCursor: cursor,
    budgetCost: 1,
    range: Object.freeze({
      indexBase,
      fromIndex,
      toIndex: completedRecord,
    }),
    reviewEntries: Object.freeze(
      entries.filter((entry) => entry.recordIndex <= completedRecord),
    ),
    skipped: Object.freeze([]),
    selectedPrefix,
  });
}
