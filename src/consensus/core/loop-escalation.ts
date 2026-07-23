import type {
  Agency,
  ConvergenceResult,
  EscalationDetection,
  EscalationTrigger,
  HashOptions,
  IterationMode,
  JsonRecord,
  LoopRecord,
  OscillationResult,
} from './loop-types.js';
import {
  convergenceOptionsForAgency,
  hashArtifact,
  hashOptionsForAgency,
  PARALLEL_MODES,
  recordHash,
  verdictDecision,
} from './loop-validation.js';

export function detectConvergence(
  records: LoopRecord[],
  options: HashOptions = {},
): ConvergenceResult {
  if (!Array.isArray(records) || records.length < 2) {
    return { converged: false, reason: null };
  }

  const rightIndex = records.length - 1;
  const leftIndex = records.length - 2;
  const left = records[leftIndex];
  const right = records[rightIndex];
  const leftHash = recordHash(left, options);
  const rightHash = recordHash(right, options);

  const leftDecision = verdictDecision(left);
  const rightDecision = verdictDecision(right);
  const doubleAccept = leftDecision === 'ACCEPT' && rightDecision === 'ACCEPT';

  if (!leftHash || !rightHash) {
    return { converged: false, reason: null };
  }

  if (leftHash !== rightHash) {
    if (options.agency === 'maximum' && doubleAccept) {
      return {
        converged: true,
        reason: 'double_accept',
        record_indexes: [leftIndex, rightIndex],
        artifact_hash: rightHash,
        agency_decision: 'maximum_double_accept_near_match',
      };
    }
    return { converged: false, reason: null };
  }

  const reason = doubleAccept ? 'double_accept' : 'hash_match';

  return {
    converged: true,
    reason,
    record_indexes: [leftIndex, rightIndex],
    artifact_hash: rightHash,
  };
}

export function detectOscillation(
  records: LoopRecord[],
  options: HashOptions = {},
): OscillationResult {
  if (!Array.isArray(records) || records.length < 4) {
    return { oscillating: false, reason: null };
  }

  for (let end = records.length; end >= 4; end -= 1) {
    const window = records.slice(end - 4, end);
    const hashes = window.map((record) => recordHash(record, options));
    if (
      hashes.every(Boolean) &&
      hashes[0] === hashes[2] &&
      hashes[1] === hashes[3] &&
      hashes[0] !== hashes[1]
    ) {
      return {
        oscillating: true,
        reason: 'oscillation_detected',
        record_indexes: [end - 4, end - 3, end - 2, end - 1],
        hashes: [hashes[0], hashes[1]],
      };
    }
  }

  return { oscillating: false, reason: null };
}

function parallelRevisionHash(
  record: LoopRecord | null | undefined,
  options: HashOptions = {},
): string | null {
  const hashOptions =
    options.hashOptions ?? hashOptionsForAgency(options.agency);
  if (typeof record?.proposed_artifact === 'string') {
    return hashArtifact(record.proposed_artifact, hashOptions);
  }
  return recordHash(record, options);
}

/**
 * Parallel-revision convergence (p02-t05):
 *   - same-round normalized-hash match between the two peer revisions, OR
 *   - mutual ACCEPT_PEER adopting identical prior text (differing text = swap, not converged), OR
 *   - mutual CONVERGED at moderate/maximum agency (at minimal, mutual CONVERGED escalates,
 *     handled by the escalation layer in Phase 4; here it simply does not converge).
 * Hash normalization follows agency (minimal = strict bytewise).
 */
export function detectParallelConvergence(
  records: LoopRecord[],
  options: HashOptions = {},
): ConvergenceResult {
  if (!Array.isArray(records) || records.length < 2) {
    return { converged: false, reason: null };
  }

  const rightIndex = records.length - 1;
  const leftIndex = records.length - 2;
  const left = records[leftIndex];
  const right = records[rightIndex];
  const agency = options.agency ?? 'moderate';

  const leftDecision = verdictDecision(left);
  const rightDecision = verdictDecision(right);
  const leftHash = parallelRevisionHash(left, options);
  const rightHash = parallelRevisionHash(right, options);
  const hashMatch = Boolean(leftHash) && leftHash === rightHash;
  const mutualAcceptPeer =
    leftDecision === 'ACCEPT_PEER' && rightDecision === 'ACCEPT_PEER';

  if (mutualAcceptPeer) {
    // Mutual adoption converges only when both adopt the SAME text (hash match);
    // adopting differing texts is a swap, not convergence.
    if (hashMatch) {
      return {
        converged: true,
        reason: 'mutual_accept_peer',
        record_indexes: [leftIndex, rightIndex],
        artifact_hash: rightHash,
      };
    }
    return { converged: false, reason: null };
  }

  if (hashMatch) {
    return {
      converged: true,
      reason: 'parallel_hash_match',
      record_indexes: [leftIndex, rightIndex],
      artifact_hash: rightHash,
    };
  }

  if (leftDecision === 'CONVERGED' && rightDecision === 'CONVERGED') {
    if (agency === 'moderate' || agency === 'maximum') {
      return {
        converged: true,
        reason: 'mutual_converged',
        record_indexes: [leftIndex, rightIndex],
        artifact_hash: rightHash,
      };
    }
    // minimal: do not converge; mutual-CONVERGED without hash match escalates (Phase 4).
    return { converged: false, reason: null };
  }

  return { converged: false, reason: null };
}

/**
 * Parallel-synthesized convergence (p03-t04): synthesis stability. The loop has
 * converged when both of the latest round's peer revisions hash-match the PREVIOUS
 * round's synthesis hash — i.e. neither peer changed the synthesized text. Hash
 * normalization follows agency (minimal = strict bytewise).
 */
export function detectSynthesisStability(
  records: LoopRecord[],
  options: HashOptions = {},
): ConvergenceResult {
  if (!Array.isArray(records) || records.length < 2) {
    return { converged: false, reason: null };
  }

  const isPeer = (record: LoopRecord) =>
    record?.record_type !== 'synthesis' &&
    record?.agent !== 'user' &&
    record?.agent !== 'host-orchestrator';

  // The latest peer round and its two revisions.
  let latestPeerRound = null;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (
      isPeer(records[index]) &&
      Number.isInteger(Number(records[index].round_index))
    ) {
      latestPeerRound = Number(records[index].round_index);
      break;
    }
  }
  if (latestPeerRound === null || latestPeerRound < 2) {
    // No prior synthesis round to stabilize on.
    return { converged: false, reason: null };
  }

  const currentPeers = records.filter(
    (record) =>
      isPeer(record) && Number(record.round_index) === latestPeerRound,
  );
  if (currentPeers.length < 2) {
    return { converged: false, reason: null };
  }

  // The synthesis of the PREVIOUS round (latestPeerRound - 1).
  const priorSynthesis = records.find(
    (record) =>
      record?.record_type === 'synthesis' &&
      Number(record.round_index) === latestPeerRound - 1,
  );
  if (!priorSynthesis) {
    return { converged: false, reason: null };
  }

  const synthHash = parallelRevisionHash(priorSynthesis, options);
  if (!synthHash) {
    return { converged: false, reason: null };
  }

  const allMatch = currentPeers.every(
    (record) => parallelRevisionHash(record, options) === synthHash,
  );
  if (!allMatch) {
    return { converged: false, reason: null };
  }

  return {
    converged: true,
    reason: 'synthesis_stability',
    synthesis_round: latestPeerRound - 1,
    artifact_hash: synthHash,
  };
}

function parallelRoundPairs(
  records: LoopRecord[],
  options: HashOptions = {},
): (string | null)[] {
  const byRound = new Map<number, (string | null)[]>();
  for (const record of records) {
    if (record?.agent === 'user' || record?.agent === 'host-orchestrator')
      continue;
    if (record?.record_type === 'synthesis') continue;
    const round = Number(record?.round_index);
    if (!Number.isInteger(round)) continue;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round)?.push(parallelRevisionHash(record, options));
  }

  return [...byRound.keys()]
    .toSorted((a, b) => a - b)
    .map((round) => {
      const hashes = (byRound.get(round) ?? []).filter(Boolean).toSorted();
      // Order-normalized pair signature for the round.
      return hashes.length > 0 ? hashes.join('|') : null;
    });
}

/**
 * Parallel oscillation (p02-t06): the order-normalized per-round hash PAIR cycles
 * alternately — pair(N) == pair(N-2) != pair(N-1) — across a 4-round window.
 */
export function detectParallelOscillation(
  records: LoopRecord[],
  options: HashOptions = {},
): OscillationResult {
  if (!Array.isArray(records)) {
    return { oscillating: false, reason: null };
  }

  const pairs = parallelRoundPairs(records, options);
  for (let end = pairs.length; end >= 4; end -= 1) {
    const window = pairs.slice(end - 4, end);
    if (
      window.every(Boolean) &&
      window[0] === window[2] &&
      window[1] === window[3] &&
      window[0] !== window[1]
    ) {
      return {
        oscillating: true,
        reason: 'oscillation_detected',
        round_indexes: [end - 4, end - 3, end - 2, end - 1],
        pairs: [window[0], window[1]],
      };
    }
  }

  return { oscillating: false, reason: null };
}

// ---------------------------------------------------------------------------
// Escalation layer (p04). Deterministic triggers + agency routing over the
// record stream. Triggers are pure functions of recorded state; the only model
// judgment is the host/user decision text supplied on resume.
// ---------------------------------------------------------------------------

export const ESCALATION_TRIGGERS = Object.freeze({
  persistent_disagreement: 'persistent_disagreement',
  oscillation: 'oscillation',
  budget_exhausted: 'budget_exhausted',
  near_done_drift: 'near_done_drift',
} satisfies Record<EscalationTrigger, EscalationTrigger>);

const PERSISTENT_DISAGREEMENT_WINDOW = 3;

function synthesisRecords(records: LoopRecord[]): LoopRecord[] {
  return records.filter((record) => record?.record_type === 'synthesis');
}

function normalizedDisagreementSet(record: LoopRecord): Set<string> {
  const list = Array.isArray(record?.unresolved_disagreements)
    ? record.unresolved_disagreements
    : [];
  return new Set(
    list.map((entry: unknown) => String(entry).trim()).filter(Boolean),
  );
}

function sameDisagreementSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/**
 * persistent_disagreement (synthesized only): the same trimmed, non-empty
 * unresolved-disagreement set across the last PERSISTENT_DISAGREEMENT_WINDOW
 * consecutive synthesis records (set equality on trimmed strings).
 */
function detectPersistentDisagreement(
  records: LoopRecord[],
): EscalationDetection | null {
  const synth = synthesisRecords(records);
  if (synth.length < PERSISTENT_DISAGREEMENT_WINDOW) return null;
  const window = synth.slice(-PERSISTENT_DISAGREEMENT_WINDOW);
  const sets = window.map(normalizedDisagreementSet);
  if (sets.some((set) => set.size === 0)) return null;
  for (let index = 1; index < sets.length; index += 1) {
    if (!sameDisagreementSet(sets[0], sets[index])) return null;
  }
  const latest = window.at(-1);
  if (!latest) return null;
  return {
    trigger: ESCALATION_TRIGGERS.persistent_disagreement,
    disagreements: [...sets[0]],
    synthesis_round: latest.round_index ?? null,
    divergent: {
      synthesis: {
        artifact_hash: recordHash(latest),
        unresolved_disagreements: Array.isArray(latest.unresolved_disagreements)
          ? latest.unresolved_disagreements
          : [],
      },
    },
  };
}

function lastTwoParallelPeers(records: LoopRecord[]): LoopRecord[] {
  const peers = records.filter(
    (record) =>
      record?.agent !== 'user' &&
      record?.agent !== 'host-orchestrator' &&
      record?.verdict !== 'USER_INTERVENTION' &&
      record?.verdict !== 'HOST_DECISION' &&
      record?.record_type !== 'synthesis' &&
      record?.record_type !== 'synthesis-error',
  );
  return peers.slice(-2);
}

function divergentPairRefs(
  left: LoopRecord | null | undefined,
  right: LoopRecord | null | undefined,
  options: HashOptions = {},
): JsonRecord {
  return {
    a: { agent: left?.agent ?? null, artifact_hash: recordHash(left, options) },
    b: {
      agent: right?.agent ?? null,
      artifact_hash: recordHash(right, options),
    },
  };
}

/**
 * near_done_drift: the loop is one step from done but the two latest peers
 * declared agreement (double-ACCEPT alternating / mutual-CONVERGED parallel)
 * while their hashes differ. Maximum agency keeps the existing auto near-match
 * rule (handled by convergence), so this trigger is only consulted when
 * convergence has already declined.
 */
function detectNearDoneDrift(
  records: LoopRecord[],
  options: HashOptions = {},
): EscalationDetection | null {
  const [left, right] = lastTwoParallelPeers(records);
  if (!left || !right) return null;
  const leftDecision = verdictDecision(left);
  const rightDecision = verdictDecision(right);
  const doubleAccept = leftDecision === 'ACCEPT' && rightDecision === 'ACCEPT';
  const mutualConverged =
    leftDecision === 'CONVERGED' && rightDecision === 'CONVERGED';
  if (!doubleAccept && !mutualConverged) return null;
  const leftHash = recordHash(left, options);
  const rightHash = recordHash(right, options);
  if (!leftHash || !rightHash || leftHash === rightHash) return null;
  return {
    trigger: ESCALATION_TRIGGERS.near_done_drift,
    divergent: divergentPairRefs(left, right, options),
  };
}

function detectBudgetExhausted(
  records: LoopRecord[],
  options: HashOptions = {},
): EscalationDetection {
  const [left, right] = lastTwoParallelPeers(records);
  return {
    trigger: ESCALATION_TRIGGERS.budget_exhausted,
    divergent:
      left && right ? divergentPairRefs(left, right, options) : undefined,
  };
}

function detectOscillationTrigger(
  records: LoopRecord[],
  mode: IterationMode,
  options: HashOptions = {},
): EscalationDetection | null {
  const oscillation = PARALLEL_MODES.has(mode)
    ? detectParallelOscillation(records, options)
    : detectOscillation(records, options);
  if (!oscillation.oscillating) return null;
  const [left, right] = lastTwoParallelPeers(records);
  return {
    trigger: ESCALATION_TRIGGERS.oscillation,
    divergent:
      left && right ? divergentPairRefs(left, right, options) : undefined,
  };
}

/**
 * detectEscalation (p04-t01): deterministic trigger detection over the record
 * stream. Returns `{ trigger, ... } | null`. Convergence/oscillation are checked
 * by the loop BEFORE this; `budgetExhausted` is supplied by the loop when the
 * round budget is spent without convergence.
 */
export function detectEscalation(
  records: LoopRecord[],
  {
    mode = 'alternating',
    agency = 'moderate',
    budgetExhausted = false,
  }: { mode?: IterationMode; agency?: Agency; budgetExhausted?: boolean } = {},
): EscalationDetection | null {
  if (!Array.isArray(records) || records.length === 0) return null;
  const options = convergenceOptionsForAgency(agency);

  if (mode === 'parallel_synthesized') {
    const persistent = detectPersistentDisagreement(records);
    if (persistent) return persistent;
  }

  const oscillation = detectOscillationTrigger(records, mode, options);
  if (oscillation) return oscillation;

  const nearDone = detectNearDoneDrift(records, options);
  if (nearDone) return nearDone;

  if (budgetExhausted) {
    return detectBudgetExhausted(records, options);
  }

  return null;
}
