import { createHash } from 'node:crypto';

export const VERDICT_CAPS = Object.freeze({
  reasoning_bytes: 64 * 1024,
  proposed_artifact_bytes: 1024 * 1024,
  concern_bytes: 16 * 1024,
  concerns_total_bytes: 64 * 1024
});

const DEFAULT_NORMALIZE_OPTIONS = {
  normalizeLineEndings: true,
  trimTrailingWhitespace: true,
  collapseEofNewlines: true,
  finalNewline: true
};

const VERDICT_BRANCHES = {
  ACCEPT: {
    required: ['schema_version', 'decision', 'reasoning'],
    optional: ['concerns']
  },
  REVISE: {
    required: ['schema_version', 'decision', 'reasoning', 'proposed_artifact'],
    optional: ['concerns']
  },
  IMPASSE: {
    required: ['schema_version', 'decision', 'reasoning', 'concerns'],
    optional: []
  }
};

function normalizeOptions(options = {}) {
  return { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
}

function verdictDecision(record) {
  return record?.verdict?.decision ?? record?.decision ?? null;
}

function byteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function oversizedResult(field, limitBytes, actualBytes) {
  return {
    ok: false,
    metadata: {
      code: 'OVERSIZE_REJECTED',
      field,
      limit_bytes: limitBytes,
      actual_bytes: actualBytes
    }
  };
}

function pushTypeError(errors, field, expected) {
  errors.push(`${field} must be ${expected}`);
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

export function validateVerdictShape(verdict) {
  const errors = [];

  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) {
    return { ok: false, errors: ['verdict must be an object'] };
  }

  if (verdict.schema_version !== 'v0') {
    errors.push('schema_version must be "v0"');
  }

  const branch = VERDICT_BRANCHES[verdict.decision];
  if (!branch) {
    errors.push('decision must be ACCEPT, REVISE, or IMPASSE');
  }

  if (!branch) {
    return { ok: false, errors };
  }

  const allowed = new Set([...branch.required, ...branch.optional]);
  for (const key of Object.keys(verdict)) {
    if (!allowed.has(key)) {
      errors.push(`additional property: ${key}`);
    }
  }

  for (const key of branch.required) {
    if (!(key in verdict)) {
      errors.push(`missing required property: ${key}`);
    }
  }

  if ('reasoning' in verdict && typeof verdict.reasoning !== 'string') {
    pushTypeError(errors, 'reasoning', 'a string');
  }

  if ('proposed_artifact' in verdict && typeof verdict.proposed_artifact !== 'string') {
    pushTypeError(errors, 'proposed_artifact', 'a string');
  }

  if ('concerns' in verdict) {
    if (!Array.isArray(verdict.concerns)) {
      pushTypeError(errors, 'concerns', 'an array');
    } else if (verdict.decision === 'IMPASSE' && verdict.concerns.length === 0) {
      errors.push('concerns must include at least one entry for IMPASSE');
    } else {
      verdict.concerns.forEach((concern, index) => {
        if (typeof concern !== 'string') {
          pushTypeError(errors, `concerns[${index}]`, 'a string');
        }
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateVerdictCaps(verdict) {
  const shape = validateVerdictShape(verdict);
  if (!shape.ok) return shape;

  const reasoningBytes = byteLength(verdict.reasoning);
  if (reasoningBytes > VERDICT_CAPS.reasoning_bytes) {
    return oversizedResult('reasoning', VERDICT_CAPS.reasoning_bytes, reasoningBytes);
  }

  if ('proposed_artifact' in verdict) {
    const proposedBytes = byteLength(verdict.proposed_artifact);
    if (proposedBytes > VERDICT_CAPS.proposed_artifact_bytes) {
      return oversizedResult('proposed_artifact', VERDICT_CAPS.proposed_artifact_bytes, proposedBytes);
    }
  }

  if (Array.isArray(verdict.concerns)) {
    let totalBytes = 0;
    for (const [index, concern] of verdict.concerns.entries()) {
      const concernBytes = byteLength(concern);
      if (concernBytes > VERDICT_CAPS.concern_bytes) {
        return oversizedResult(`concerns[${index}]`, VERDICT_CAPS.concern_bytes, concernBytes);
      }
      totalBytes += concernBytes;
    }

    if (totalBytes > VERDICT_CAPS.concerns_total_bytes) {
      return oversizedResult('concerns', VERDICT_CAPS.concerns_total_bytes, totalBytes);
    }
  }

  return { ok: true, errors: [] };
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
