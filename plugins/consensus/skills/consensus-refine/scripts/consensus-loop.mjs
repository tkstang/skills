import { createHash } from 'node:crypto';

const DEFAULT_NORMALIZE_OPTIONS = {
  normalizeLineEndings: true,
  trimTrailingWhitespace: true,
  collapseEofNewlines: true,
  finalNewline: true
};

function normalizeOptions(options = {}) {
  return { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
}

function verdictDecision(record) {
  return record?.verdict?.decision ?? record?.decision ?? null;
}

function recordHash(record, options = {}) {
  if (record?.artifact_hash) return record.artifact_hash;
  if (record?.artifactHash) return record.artifactHash;
  if (typeof record?.artifact === 'string') return hashArtifact(record.artifact, options);
  if (typeof record?.proposed_artifact === 'string') return hashArtifact(record.proposed_artifact, options);
  if (typeof record?.verdict?.proposed_artifact === 'string') {
    return hashArtifact(record.verdict.proposed_artifact, options);
  }
  return null;
}

export function normalizeForHash(text, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  let normalized = String(text ?? '');

  if (normalizedOptions.normalizeLineEndings) {
    normalized = normalized.replace(/\r\n?/g, '\n');
  }

  if (normalizedOptions.trimTrailingWhitespace) {
    normalized = normalized
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n');
  }

  if (normalizedOptions.collapseEofNewlines) {
    normalized = normalized.replace(/\n+$/g, '');
  }

  if (normalizedOptions.finalNewline && normalized.length > 0) {
    normalized += '\n';
  }

  return normalized;
}

export function hashArtifact(text, options = {}) {
  return createHash('sha256').update(normalizeForHash(text, options), 'utf8').digest('hex');
}

export function detectConvergence(records, options = {}) {
  if (!Array.isArray(records) || records.length < 2) {
    return { converged: false, reason: null };
  }

  const rightIndex = records.length - 1;
  const leftIndex = records.length - 2;
  const left = records[leftIndex];
  const right = records[rightIndex];
  const leftHash = recordHash(left, options);
  const rightHash = recordHash(right, options);

  if (!leftHash || !rightHash || leftHash !== rightHash) {
    return { converged: false, reason: null };
  }

  const leftDecision = verdictDecision(left);
  const rightDecision = verdictDecision(right);
  const reason =
    leftDecision === 'ACCEPT' && rightDecision === 'ACCEPT' ? 'double_accept_same_hash' : 'hash_match';

  return {
    converged: true,
    reason,
    record_indexes: [leftIndex, rightIndex],
    artifact_hash: rightHash
  };
}

export function detectOscillation(records) {
  if (!Array.isArray(records) || records.length < 4) {
    return { oscillating: false, reason: null };
  }

  for (let end = records.length; end >= 4; end -= 1) {
    const window = records.slice(end - 4, end);
    const hashes = window.map((record) => recordHash(record));
    if (hashes.every(Boolean) && hashes[0] === hashes[2] && hashes[1] === hashes[3] && hashes[0] !== hashes[1]) {
      return {
        oscillating: true,
        reason: 'two_state_oscillation',
        record_indexes: [end - 4, end - 3, end - 2, end - 1],
        hashes: [hashes[0], hashes[1]]
      };
    }
  }

  return { oscillating: false, reason: null };
}
