import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


import type {
  JsonRecord,
  IterationMode,
  Agency,
  ColdStartMode,
  CostSource,
  AlternatingVerdictValue,
  ParallelVerdictValue,
  VerdictValue,
  CritiquePayload,
  BaseVerdictPayload,
  RevisionVerdictPayload,
  TerminalVerdictPayload,
  PeerVerdictPayload,
  SynthesisPayload,
  LoopRecordType,
  InterventionVerdict,
  LoopRecord,
  NormalizeOptions,
  HashOptions,
  LoopOptions,
  RunOptions,
  Intervention,
  LoopStatus,
  RecordsWriter,
  TerminalStatus,
  ProviderInvocationArgs,
  ProviderResult,
  RetryOptions,
  ProviderCliCommandRunnerOptions,
  ProviderCliCommandRunnerResult,
  ProviderCliCommandRunner,
  ConsensusCliResolutionSource,
  ConsensusCliResolution,
  ConsensusCliPathOptions,
  PeerInvocation,
  PeerInvoker,
  SynthesizerInvocation,
  SynthesizerInvoker,
  ParallelTurnPromptInput,
  SynthesisPromptInput,
  TurnPromptInput,
  TurnPromptBuilder,
  ParallelTurnPromptBuilder,
  SynthesisPromptBuilder,
  PromptProfile,
  ResolvedPromptProfile,
  BaseRoundContext,
  AlternatingTurnContext,
  AlternatingTurnResult,
  ParallelRoundResult,
  SynthesisErrorResult,
  SynthesisResult,
  EscalationTrigger,
  DecideVia,
  EscalationDetection,
  EscalationRoute,
  ConvergenceResult,
  OscillationResult,
  ConsensusErrorOptions,
  ErrorLike,
  ValidationResult,
} from './loop-types.js';

// Type surface re-exported from ./loop-types.js (facade preserves the
// pre-split public type exports).
export type {
  JsonRecord,
  IterationMode,
  Agency,
  ColdStartMode,
  CostSource,
  AlternatingVerdictValue,
  ParallelVerdictValue,
  VerdictValue,
  CritiquePayload,
  BaseVerdictPayload,
  RevisionVerdictPayload,
  TerminalVerdictPayload,
  PeerVerdictPayload,
  SynthesisPayload,
  LoopRecordType,
  InterventionVerdict,
  LoopRecord,
  NormalizeOptions,
  HashOptions,
  LoopOptions,
  RunOptions,
  LoopStatus,
  TerminalStatus,
  ProviderInvocationArgs,
  ProviderResult,
  ProviderCliCommandRunnerOptions,
  ProviderCliCommandRunnerResult,
  ProviderCliCommandRunner,
  ConsensusCliResolutionSource,
  ConsensusCliResolution,
  ConsensusCliPathOptions,
  PeerInvocation,
  PeerInvoker,
  SynthesizerInvocation,
  SynthesizerInvoker,
  ParallelTurnPromptInput,
  SynthesisPromptInput,
  TurnPromptInput,
  TurnPromptBuilder,
  ParallelTurnPromptBuilder,
  SynthesisPromptBuilder,
  PromptProfile,
  AlternatingTurnResult,
  ParallelRoundResult,
  SynthesisErrorResult,
  SynthesisResult,
  EscalationTrigger,
  DecideVia,
} from './loop-types.js';

import {
  VERDICT_CAPS,
  SYNTHESIS_CAPS,
  LOOP_SCHEMA_VERSION,
  SUBPROCESS_OUTPUT_CAP_BYTES,
  PROVIDER_CLI_KILL_GRACE_MS,
  PROVIDER_CLI_FINAL_RESOLUTION_MS,
  EXIT_CODES,
  ConsensusError,
  ITERATION_MODES,
  COLD_START_MODES,
  callsPerRound,
  invalidIterationModeError,
  parallelSchemaPath,
  peerSchemaPathForMode,
  synthesisSchemaPath,
  exitCodeForError,
  normalizeForHash,
  hashArtifact,
  validateVerdictShape,
  normalizeVerdict,
  validateSynthesisShape,
  validateSynthesisCaps,
  validateVerdictCaps,
  isJsonRecord,
  asErrorLike,
  validationErrors,
  validationMetadata,
  hashOptionsForAgency,
  convergenceOptionsForAgency,
  verdictDecision,
  roundCount,
  required,
  schemaPath,
  hardErrorMessage,
  recordHash,
  formatArtifactHash,
  PARALLEL_MODES,
} from './loop-validation.js';

// Value surface re-exported from ./loop-validation.js (facade preserves
// the pre-split public value exports).
export {
  VERDICT_CAPS,
  SYNTHESIS_CAPS,
  LOOP_SCHEMA_VERSION,
  SUBPROCESS_OUTPUT_CAP_BYTES,
  PROVIDER_CLI_KILL_GRACE_MS,
  PROVIDER_CLI_FINAL_RESOLUTION_MS,
  EXIT_CODES,
  ConsensusError,
  ITERATION_MODES,
  COLD_START_MODES,
  callsPerRound,
  invalidIterationModeError,
  parallelSchemaPath,
  peerSchemaPathForMode,
  synthesisSchemaPath,
  exitCodeForError,
  normalizeForHash,
  hashArtifact,
  validateVerdictShape,
  normalizeVerdict,
  validateSynthesisShape,
  validateSynthesisCaps,
  validateVerdictCaps,
};

import {
  createRecordsWriter,
  peerRecords,
  peerTurnCount,
  readExistingRecords,
  synthesisRecordCount,
  syncFileIfAvailable,
  withRecordMetadata,
  writeLoopStatus,
} from './loop-records.js';

// Value surface re-exported from ./loop-records.js.
export { createRecordsWriter, writeLoopStatus };

import {
  CONSENSUS_SHARED_CLI_RELATIVE_PATH,
  consensusProviderCliMissingError,
  consensusSharedCliPath,
  invokeConsensusProviderCli,
  invokeProviderCliWithRetry,
  invokeValidatedPeer,
  providerAuditFields,
  providerCliSpawnTarget,
  requireConsensusCliPath,
  resolveConsensusCliPath,
  resolveConsensusCliPathDetails,
  runProviderCliCommand,
} from './loop-provider.js';

// Value surface re-exported from ./loop-provider.js.
export {
  CONSENSUS_SHARED_CLI_RELATIVE_PATH,
  consensusProviderCliMissingError,
  consensusSharedCliPath,
  invokeConsensusProviderCli,
  invokeProviderCliWithRetry,
  invokeValidatedPeer,
  providerCliSpawnTarget,
  requireConsensusCliPath,
  resolveConsensusCliPath,
  resolveConsensusCliPathDetails,
  runProviderCliCommand,
};

import { parseLoopArgs } from './loop-args.js';

// Value surface re-exported from ./loop-args.js.
export { parseLoopArgs };

import {
  buildParallelTurnPrompt,
  buildSynthesisPrompt,
  buildTurnPrompt,
  resolvePromptProfile,
  verdictForPrompt,
} from './loop-prompts.js';

// Value surface re-exported from ./loop-prompts.js.
export { buildParallelTurnPrompt, buildSynthesisPrompt, buildTurnPrompt };

async function writeSectionOutput(
  outputPath: string,
  artifact: string,
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, artifact);
  await syncFileIfAvailable(outputPath);
}

async function writeTerminalArtifacts(
  options: LoopOptions,
  status: LoopStatus,
  artifact: string,
  records: LoopRecord[],
) {
  await writeSectionOutput(options.outputSection, artifact);
  const normalizedStatus = await writeLoopStatus(options.outputStatus, status);
  return {
    status: normalizedStatus,
    output: artifact,
    records,
  };
}

function resultStatus(
  status: string,
  terminationReason: string | null,
  records: LoopRecord[],
  options: LoopOptions,
  extra: JsonRecord = {},
): LoopStatus {
  const peerCalls = peerRecords(records).filter(
    (record) => record?.record_type !== 'synthesis',
  ).length;
  const synthesisCalls = synthesisRecordCount(records);
  const turns = peerCalls;
  return {
    status,
    termination_reason: terminationReason,
    turns,
    rounds: roundCount(turns, options.peers.length),
    agency: options.agency,
    iteration_mode: options.iteration,
    cold_start: options.coldStart,
    peer_calls: peerCalls,
    synthesis_calls: synthesisCalls,
    ...extra,
  };
}

async function seedRecordsFile(
  recordsPath: string,
  records: unknown,
  options: { now?: () => string } = {},
): Promise<LoopRecord[]> {
  const seedRecords = Array.isArray(records) ? records : [];
  const existingRecords = await readExistingRecords(recordsPath);
  if (existingRecords.length > 0 || seedRecords.length === 0) {
    return existingRecords;
  }

  const normalizedRecords = seedRecords.map((record) =>
    withRecordMetadata(record as LoopRecord, options),
  );
  await mkdir(path.dirname(recordsPath), { recursive: true });
  await writeFile(
    recordsPath,
    `${JSON.stringify(normalizedRecords, null, 2)}\n`,
  );
  await syncFileIfAvailable(recordsPath);
  return normalizedRecords;
}

/**
 * Append an attributed intervention round (p04-t05). Generalizes the original
 * user-intervention path to also cover host-orchestrator decisions:
 *   - user (`USER_INTERVENTION`): direction text recorded as reasoning + user_direction.
 *   - host (`HOST_DECISION`): adds decision_kind + escalation_trigger attribution.
 * Both refresh the round budget identically (the caller extends maxTurns).
 */
async function appendIntervention({
  writer,
  records,
  options,
  currentArtifact,
  intervention,
}: {
  writer: RecordsWriter;
  records: LoopRecord[];
  options: LoopOptions;
  currentArtifact: string;
  intervention: Intervention | null;
}): Promise<LoopRecord | null> {
  if (!intervention) return null;

  const isHost = intervention.agent === 'host-orchestrator';
  const nextRound =
    Math.max(0, ...records.map((record) => Number(record.round_index) || 0)) +
    1;
  const payload: LoopRecord = {
    turn_index: records.length + 1,
    round_index: nextRound,
    agent: isHost ? 'host-orchestrator' : 'user',
    verdict: isHost ? 'HOST_DECISION' : 'USER_INTERVENTION',
    reasoning: intervention.direction,
    artifact_hash: hashArtifact(
      currentArtifact,
      hashOptionsForAgency(options.agency),
    ),
    iteration_mode: options.iteration,
  };
  if (isHost) {
    if (intervention.decisionKind)
      payload.decision_kind = intervention.decisionKind;
    if (intervention.escalationTrigger)
      payload.escalation_trigger = intervention.escalationTrigger;
  } else {
    payload.user_direction = intervention.direction;
  }

  const record = await writer.append(payload);
  records.push(record);
  return record;
}

function resolveIntervention(
  runOptions: RunOptions,
  options: LoopOptions,
): Intervention | null {
  const userDirection = runOptions.userDirection ?? options.userDirection;
  const hostDirection = runOptions.hostDirection ?? options.hostDirection;
  if (hostDirection) {
    return {
      agent: 'host-orchestrator',
      direction: hostDirection,
      decisionKind:
        runOptions.hostDecisionKind ?? options.hostDecisionKind ?? 'direct',
      escalationTrigger:
        runOptions.escalationTrigger ?? options.escalationTrigger ?? null,
    };
  }
  if (userDirection) {
    return { agent: 'user', direction: userDirection };
  }
  return null;
}

async function executeAlternatingTurn({
  turnIndex,
  options,
  records,
  currentArtifact,
  invokePeer,
  prompts = resolvePromptProfile(),
}: AlternatingTurnContext): Promise<AlternatingTurnResult> {
  const peerIndex = turnIndex % options.peers.length;
  const provider = options.peers[peerIndex];
  const turn = turnIndex + 1;
  const round = Math.floor(turnIndex / options.peers.length) + 1;
  const prompt = prompts.buildTurnPrompt({
    provider,
    peerIndex,
    coldStart: options.coldStart,
    round,
    turn,
    goal: options.goal,
    artifact: currentArtifact,
    previousVerdict: verdictForPrompt(records.at(-1)),
    priorRecords: records,
  });
  const peerResult = await invokePeer({
    provider,
    peerIndex,
    round,
    turn,
    prompt,
    artifact: currentArtifact,
  });
  const verdict = normalizeVerdict(
    peerResult.json,
    options.iteration,
  ) as PeerVerdictPayload;
  const shape = validateVerdictShape(verdict, { mode: options.iteration });
  if (!shape.ok) {
    throw new ConsensusError(
      `invalid verdict shape: ${validationErrors(shape).join('; ')}`,
      {
        code: 'INVALID_VERDICT_SHAPE',
        exitCode: EXIT_CODES.DATA,
        details: { errors: validationErrors(shape) },
      },
    );
  }

  const caps = validateVerdictCaps(verdict, { mode: options.iteration });
  if (!caps.ok) {
    throw new ConsensusError(
      `invalid verdict caps: ${JSON.stringify(validationMetadata(caps))}`,
      {
        code: 'INVALID_VERDICT_CAPS',
        exitCode: EXIT_CODES.DATA,
        details: validationMetadata(caps),
      },
    );
  }

  let nextArtifact = currentArtifact;
  if (verdict.verdict === 'REVISE') {
    nextArtifact = verdict.proposed_artifact;
  }

  const recordPayload: LoopRecord = {
    turn_index: turn,
    round_index: round,
    agent: provider,
    verdict: verdict.verdict,
    reasoning: verdict.reasoning,
    artifact_hash: hashArtifact(
      nextArtifact,
      hashOptionsForAgency(options.agency),
    ),
    iteration_mode: options.iteration,
    ...providerAuditFields(peerResult),
  };
  if (typeof verdict.proposed_artifact === 'string') {
    recordPayload.proposed_artifact = verdict.proposed_artifact;
  }
  if (Array.isArray(verdict.concerns)) {
    recordPayload.concerns = verdict.concerns;
  }

  return { verdict, recordPayload, nextArtifact };
}

function lastRoundPeerRecords(
  records: LoopRecord[],
  peers: string[],
): Record<string, LoopRecord | null> {
  const peers0 = peers[0];
  const peers1 = peers[1];
  let own = null;
  let peer = null;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record?.agent === peers0 && !own) own = record;
    if (record?.agent === peers1 && !peer) peer = record;
    if (own && peer) break;
  }
  return { [peers0]: own, [peers1]: peer };
}

function revisionTextFor(record: LoopRecord | null | undefined): string | null {
  if (!record) return null;
  if (typeof record.proposed_artifact === 'string')
    return record.proposed_artifact;
  return null;
}

function critiqueFor(
  record: LoopRecord | null | undefined,
): CritiquePayload | JsonRecord | null {
  if (record && record.critique && typeof record.critique === 'object')
    return record.critique;
  return null;
}

function validatePeerVerdict(
  verdict: unknown,
  mode: IterationMode,
  provider: string,
): void {
  const shape = validateVerdictShape(verdict, { mode });
  if (!shape.ok) {
    throw new ConsensusError(
      `invalid verdict shape from ${provider}: ${validationErrors(shape).join('; ')}`,
      {
        code: 'INVALID_VERDICT_SHAPE',
        exitCode: EXIT_CODES.DATA,
        details: { peer: provider, errors: validationErrors(shape) },
      },
    );
  }
  const caps = validateVerdictCaps(verdict, { mode });
  if (!caps.ok) {
    throw new ConsensusError(
      `invalid verdict caps from ${provider}: ${JSON.stringify(validationMetadata(caps))}`,
      {
        code: 'INVALID_VERDICT_CAPS',
        exitCode: EXIT_CODES.DATA,
        details: { peer: provider, ...validationMetadata(caps) },
      },
    );
  }
}

/**
 * Parallel-revision round: two concurrent peer calls committed as an atomic pair.
 *
 * - Both calls run concurrently; a failed peer call discards the surviving peer's
 *   response and aborts the round (PEER_SUBROUND_FAILED) — no half-pairs in the stream.
 * - Both verdicts are validated (shape + caps) before either record is materialized.
 * - Records are returned in FIXED peer order (peers[0] then peers[1]) regardless of
 *   completion order, keeping the stream byte-reproducible (NFR1).
 */
async function executeParallelRound(
  context: BaseRoundContext,
): Promise<ParallelRoundResult> {
  const {
    options,
    records,
    currentArtifact,
    invokePeer,
    prompts = resolvePromptProfile(),
  } = context;
  const mode = options.iteration;
  const peers = options.peers;
  const priorPeerTurns = peerTurnCount(records);
  const round = Math.floor(priorPeerTurns / peers.length) + 1;
  const baseTurn = priorPeerTurns;

  const previous = lastRoundPeerRecords(records, peers);

  const invocations = peers.map((provider, peerIndex) => {
    const ownRecord = previous[provider];
    const peerRecord = previous[peers[peerIndex === 0 ? 1 : 0]];
    const prompt = prompts.buildParallelTurnPrompt({
      provider,
      mode,
      coldStart: options.coldStart,
      round,
      turn: baseTurn + peerIndex + 1,
      goal: options.goal,
      artifact: currentArtifact,
      ownPreviousRevision: revisionTextFor(ownRecord),
      peerPreviousRevision: revisionTextFor(peerRecord),
      ownPreviousCritique: critiqueFor(ownRecord),
      peerPreviousCritique: critiqueFor(peerRecord),
    });
    return Promise.resolve(
      invokePeer({
        provider,
        peerIndex,
        round,
        turn: baseTurn + peerIndex + 1,
        prompt,
        artifact: currentArtifact,
      }),
    );
  });

  const settled = await Promise.allSettled(invocations);

  const failedIndex = settled.findIndex(
    (result) => result.status === 'rejected',
  );
  if (failedIndex !== -1) {
    const failedPeer = peers[failedIndex];
    const cause = (settled[failedIndex] as PromiseRejectedResult).reason;
    throw new ConsensusError(
      `peer subround failed: ${failedPeer} (${hardErrorMessage(cause)})`,
      {
        code: 'PEER_SUBROUND_FAILED',
        exitCode: EXIT_CODES.CONFIG,
        cause,
        details: { failed_peer: failedPeer, round },
      },
    );
  }

  const peerResults = settled.map(
    (result) => (result as PromiseFulfilledResult<ProviderResult>).value,
  );
  // Normalize each verdict (strip empty disallowed fields from strict
  // structured-output providers), then validate BOTH before materializing
  // either record (atomic pair).
  const normalizedVerdicts = peerResults.map(
    (peerResult) =>
      normalizeVerdict(peerResult.json, mode) as PeerVerdictPayload,
  );
  normalizedVerdicts.forEach((verdict, peerIndex) => {
    validatePeerVerdict(verdict, mode, peers[peerIndex]);
  });

  const recordsOut = peerResults.map((peerResult, peerIndex) => {
    const provider = peers[peerIndex];
    const verdict = normalizedVerdicts[peerIndex];
    const proposed =
      'proposed_artifact' in verdict
        ? verdict.proposed_artifact
        : currentArtifact;
    const recordPayload: LoopRecord = {
      turn_index: baseTurn + peerIndex + 1,
      round_index: round,
      agent: provider,
      verdict: verdict.verdict,
      reasoning: verdict.reasoning,
      critique: verdict.critique,
      artifact_hash: hashArtifact(
        proposed,
        hashOptionsForAgency(options.agency),
      ),
      iteration_mode: mode,
      ...providerAuditFields(peerResult),
    };
    if (typeof verdict.proposed_artifact === 'string') {
      recordPayload.proposed_artifact = verdict.proposed_artifact;
    }
    if (Array.isArray(verdict.concerns)) {
      recordPayload.concerns = verdict.concerns;
    }
    return recordPayload;
  });

  // For parallel-revision the shared input is unchanged round-to-round; the terminal
  // output artifact tracks the latest peer revision in fixed order (peers[1] last).
  const nextArtifact = revisionTextFor(recordsOut.at(-1)) ?? currentArtifact;

  return {
    records: recordsOut,
    nextArtifact,
    verdicts: peerResults.map((result) => result.json),
  };
}

function priorUnresolvedDisagreements(records: LoopRecord[]): string[] {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record?.record_type === 'synthesis') {
      return Array.isArray(record.unresolved_disagreements)
        ? record.unresolved_disagreements.map(String)
        : [];
    }
  }
  return [];
}

/**
 * Validate a synthesis payload. On failure returns a discriminated descriptor used
 * to (a) write a metadata-only synthesis-error record and (b) throw the matching
 * ConsensusError — keeping the two-level transaction contract (p03-t05): invalid or
 * oversized synthesis terminates the section as `error` with a metadata-only record,
 * never leaking synthesized text.
 */
function classifySynthesisFailure(
  synthesis: unknown,
  synthesizer: string,
): {
  code: string;
  message: string;
  details: JsonRecord;
  metadata: JsonRecord;
} | null {
  const shape = validateSynthesisShape(synthesis);
  if (!shape.ok) {
    return {
      code: 'INVALID_SYNTHESIS_SHAPE',
      message: `invalid synthesis shape from ${synthesizer}: ${validationErrors(shape).join('; ')}`,
      details: { synthesizer, errors: validationErrors(shape) },
      metadata: {
        code: 'INVALID_SYNTHESIS_SHAPE',
        errors: validationErrors(shape),
      },
    };
  }
  const caps = validateSynthesisCaps(synthesis);
  if (!caps.ok) {
    return {
      code: 'INVALID_SYNTHESIS_CAPS',
      message: `invalid synthesis caps from ${synthesizer}: ${JSON.stringify(validationMetadata(caps))}`,
      details: { synthesizer, ...validationMetadata(caps) },
      metadata: validationMetadata(caps),
    };
  }
  return null;
}

/**
 * Synthesis subround (p03-t03): a stateless third call after the committed peer pair.
 * Builds the synthesis prompt from both revisions + critiques + prior unresolved
 * disagreements, invokes the synthesizer seam, validates shape/caps, and returns a
 * synthesis record (record_type: 'synthesis'). The synthesized text becomes the next
 * round's shared artifact (p03-t04).
 */
async function executeSynthesis({
  options,
  records,
  pairRecords,
  round,
  invokeSynthesizer,
  prompts = resolvePromptProfile(),
}: {
  options: LoopOptions;
  records: LoopRecord[];
  pairRecords: LoopRecord[];
  round: number;
  invokeSynthesizer: SynthesizerInvoker;
  prompts?: ResolvedPromptProfile;
}): Promise<SynthesisResult> {
  const synthesizer = options.synthesizer ?? options.peers[0];
  const [recordA, recordB] = pairRecords;
  const prompt = prompts.buildSynthesisPrompt({
    provider: synthesizer,
    round,
    goal: options.goal,
    revisionA: { agent: recordA.agent, text: revisionTextFor(recordA) },
    revisionB: { agent: recordB.agent, text: revisionTextFor(recordB) },
    critiqueA: critiqueFor(recordA),
    critiqueB: critiqueFor(recordB),
    priorUnresolved: priorUnresolvedDisagreements(records),
  });

  // A synthesis PROCESS failure (spawn/exit/reject) propagates without writing any
  // synthesis record: the committed peer pair remains durable and the section is
  // resumable at pending-synthesis (two-level transaction contract).
  const synthResult = await invokeSynthesizer({
    provider: synthesizer,
    schemaPath: synthesisSchemaPath(),
    round,
    prompt,
  });

  const synthesis = synthResult.json as SynthesisPayload;

  // An INVALID or OVERSIZED synthesis writes a metadata-only synthesis-error record
  // (no synthesized text) and surfaces as a section error.
  const failure = classifySynthesisFailure(synthesis, synthesizer);
  if (failure) {
    const errorRecord: LoopRecord = {
      record_type: 'synthesis-error',
      round_index: round,
      synthesizer,
      code: failure.code,
      metadata: failure.metadata,
      iteration_mode: options.iteration,
    };
    return {
      synthesisError: {
        record: errorRecord,
        error: new ConsensusError(failure.message, {
          code: failure.code,
          exitCode: EXIT_CODES.DATA,
          details: failure.details,
        }),
      },
    };
  }

  const synthesizedArtifact = synthesis.synthesized_artifact;
  const recordPayload: LoopRecord = {
    record_type: 'synthesis',
    round_index: round,
    synthesizer,
    synthesized_artifact: synthesizedArtifact,
    synthesis_reasoning: synthesis.synthesis_reasoning,
    unresolved_disagreements: synthesis.unresolved_disagreements,
    artifact_hash: hashArtifact(
      synthesizedArtifact,
      hashOptionsForAgency(options.agency),
    ),
    iteration_mode: options.iteration,
    ...providerAuditFields(synthResult),
  };

  return { synthesis: recordPayload, nextArtifact: synthesizedArtifact };
}

/**
 * Per-mode round executor. Alternating executes one peer turn per loop step;
 * parallel modes execute two concurrent peer calls per round (see executeParallelRound).
 * In parallel_synthesized mode a synthesis call follows the committed peer pair, and the
 * synthesized text becomes the next round's shared artifact.
 * Returns the record payloads to append (in fixed peer order) plus the next shared artifact.
 */
export async function executeRound(
  context: BaseRoundContext,
): Promise<ParallelRoundResult> {
  const { mode } = context;
  if (mode && PARALLEL_MODES.has(mode)) {
    const parallel = await executeParallelRound(context);
    if (mode === 'parallel_synthesized') {
      const round = parallel.records[0]?.round_index;
      const synthesisResult = await executeSynthesis({
        options: context.options,
        records: context.records,
        pairRecords: parallel.records,
        round: Number(round),
        invokeSynthesizer: context.invokeSynthesizer as SynthesizerInvoker,
        prompts: context.prompts,
      });
      if (synthesisResult.synthesisError) {
        return { ...parallel, synthesisError: synthesisResult.synthesisError };
      }
      return {
        ...parallel,
        synthesis: synthesisResult.synthesis,
        nextArtifact: synthesisResult.nextArtifact,
      };
    }
    return parallel;
  }
  const { verdict, recordPayload, nextArtifact } = await executeAlternatingTurn(
    context as AlternatingTurnContext,
  );
  return { records: [recordPayload], nextArtifact, verdicts: [verdict] };
}

// Triggers whose user-routed escalation preserves a v0.1 terminal status
// (surface-and-stop). These are the `user`-routed rows that v0.1 already had.
const LEGACY_USER_STATUS = Object.freeze({
  oscillation: {
    status: 'oscillation',
    termination_reason: 'oscillation_detected',
  },
  budget_exhausted: {
    status: 'max-rounds',
    termination_reason: 'max_rounds_exhausted',
  },
}) satisfies Partial<
  Record<EscalationTrigger, { status: string; termination_reason: string }>
>;

/**
 * Build the terminal result for a fired escalation trigger (p04-t03). Routing
 * decides the decision-maker:
 *   - auto: terminate deterministically (declare-done / near-match) as converged.
 *   - user + legacy trigger (oscillation/budget_exhausted): preserve the v0.1
 *     terminal status unchanged (the minimal-agency surface-and-stop column).
 *   - otherwise (host-routed, or user-routed persistent_disagreement/near_done_drift):
 *     terminate with status 'escalation' carrying the decision packet.
 */
function escalationTerminal({
  trigger,
  detected,
  options,
  records,
  artifact,
}: {
  trigger: EscalationTrigger;
  detected?: EscalationDetection | null;
  options: LoopOptions;
  records: LoopRecord[];
  artifact: string;
}): { status: LoopStatus; artifact: string } {
  const route = routeEscalation(trigger, options.agency, records);
  const finalHash = hashArtifact(
    artifact,
    hashOptionsForAgency(options.agency),
  );

  if (route.decide_via === 'auto') {
    const agencyDecision =
      trigger === ESCALATION_TRIGGERS.budget_exhausted
        ? 'maximum_declared_done_at_max_rounds'
        : 'maximum_near_match';
    const reason =
      trigger === ESCALATION_TRIGGERS.budget_exhausted
        ? 'max_rounds_exhausted'
        : 'near_done_drift';
    return {
      status: resultStatus('converged', reason, records, options, {
        final_artifact_hash: finalHash,
        agency_decision: agencyDecision,
      }),
      artifact,
    };
  }

  if (route.decide_via === 'user' && trigger in LEGACY_USER_STATUS) {
    const legacy =
      LEGACY_USER_STATUS[trigger as keyof typeof LEGACY_USER_STATUS];
    return {
      status: resultStatus(
        legacy.status,
        legacy.termination_reason,
        records,
        options,
        {
          final_artifact_hash: finalHash,
        },
      ),
      artifact,
    };
  }

  const escalation: JsonRecord = {
    trigger,
    decide_via: route.decide_via,
    decision_kinds: route.decision_kinds,
  };
  if (route.promoted_from) {
    escalation.promoted_from = route.promoted_from;
  }
  if (detected?.divergent) {
    escalation.divergent = detected.divergent;
  }
  return {
    status: resultStatus(
      'escalation',
      `escalation_${trigger}`,
      records,
      options,
      {
        final_artifact_hash: finalHash,
        escalation,
      },
    ),
    artifact,
  };
}

/**
 * Detect the deterministic pending-synthesis state (p05-t02): the latest peer round
 * has a complete pair (peers.length peer records) and NO following synthesis record.
 * Returns { round, pairRecords } when pending, else null. Derived purely from the
 * record stream — pending-synthesis is never stored separately (design §1).
 */
function pendingSynthesisRound(
  records: LoopRecord[],
  peers: string[],
): { round: number; pairRecords: LoopRecord[] } | null {
  const peerOnly = peerRecords(records).filter(
    (record) => record?.record_type !== 'synthesis',
  );
  if (peerOnly.length === 0) return null;
  const latestRound = Math.max(
    ...peerOnly.map((record) => Number(record.round_index) || 0),
  );
  if (latestRound < 1) return null;
  const pairRecords = peerOnly.filter(
    (record) => Number(record.round_index) === latestRound,
  );
  if (pairRecords.length < peers.length) return null;
  const hasSynthesis = records.some(
    (record) =>
      record?.record_type === 'synthesis' &&
      Number(record.round_index) === latestRound,
  );
  if (hasSynthesis) return null;
  return { round: latestRound, pairRecords: pairRecords.slice(-peers.length) };
}

/**
 * Post-round terminal evaluation shared by the main parallel loop and the
 * pending-synthesis resume step (p05-t02): impasse → convergence → escalation,
 * in the order mandated by design §5. Returns a terminal { status, artifact } or null.
 */
function evaluateParallelTerminal({
  records,
  options,
  artifact,
}: {
  records: LoopRecord[];
  options: LoopOptions;
  artifact: string;
}): { status: LoopStatus; artifact: string } | null {
  const lastTwoPeers = peerRecords(records)
    .filter((record) => record?.record_type !== 'synthesis')
    .slice(-2);
  const verdicts = lastTwoPeers.map((record) => verdictDecision(record));

  if (verdicts.includes('IMPASSE')) {
    return {
      status: resultStatus('impasse', 'explicit_impasse', records, options, {
        final_artifact_hash: hashArtifact(
          artifact,
          hashOptionsForAgency(options.agency),
        ),
      }),
      artifact,
    };
  }

  const convergence =
    options.iteration === 'parallel_synthesized'
      ? detectSynthesisStability(
          records,
          convergenceOptionsForAgency(options.agency),
        )
      : detectParallelConvergence(
          records,
          convergenceOptionsForAgency(options.agency),
        );
  if (convergence.converged) {
    const statusExtra: JsonRecord = {
      final_artifact_hash: convergence.artifact_hash,
    };
    if (convergence.agency_decision) {
      statusExtra.agency_decision = convergence.agency_decision;
    }
    return {
      status: resultStatus(
        'converged',
        convergence.reason,
        records,
        options,
        statusExtra,
      ),
      artifact,
    };
  }

  // Escalation triggers run AFTER convergence/impasse declined (design §5):
  // oscillation, persistent_disagreement, near_done_drift. budget_exhausted is
  // evaluated after the round budget is spent (in runParallelRounds).
  const detected = detectEscalation(records, {
    mode: options.iteration,
    agency: options.agency,
  });
  if (detected) {
    return escalationTerminal({
      trigger: detected.trigger,
      detected,
      options,
      records,
      artifact,
    });
  }

  return null;
}

async function runParallelRounds({
  options,
  records,
  writer,
  currentArtifact,
  invokePeer,
  invokeSynthesizer,
  prompts = resolvePromptProfile(),
  budgetRefreshed = false,
}: {
  options: LoopOptions;
  records: LoopRecord[];
  writer: RecordsWriter;
  currentArtifact: string;
  invokePeer: PeerInvoker;
  invokeSynthesizer: SynthesizerInvoker;
  prompts?: ResolvedPromptProfile;
  budgetRefreshed?: boolean;
}): Promise<{ status: LoopStatus; artifact: string }> {
  let artifact = currentArtifact;

  // Pending-synthesis resume (p05-t02): a complete peer pair without a following
  // synthesis record is the deterministic pending-synthesis state (design §1, two-level
  // transaction contract). On resume, re-execute ONLY the synthesis step for that round
  // before continuing — never re-run the durable peer pair. State is derived from the
  // stream, not separately stored.
  if (options.iteration === 'parallel_synthesized') {
    const pending = pendingSynthesisRound(records, options.peers);
    if (pending) {
      const synthesisResult = await executeSynthesis({
        options,
        records,
        pairRecords: pending.pairRecords,
        round: pending.round,
        invokeSynthesizer,
        prompts,
      });
      if (synthesisResult.synthesisError) {
        const errorRecord = await writer.append({
          ...synthesisResult.synthesisError.record,
        });
        records.push(errorRecord);
        throw synthesisResult.synthesisError.error;
      }
      const synthesisRecord = await writer.append({
        ...synthesisResult.synthesis,
      });
      records.push(synthesisRecord);
      artifact = synthesisResult.nextArtifact;

      // The completed round may itself be terminal (convergence/escalation): re-run the
      // post-synthesis predicates exactly as the main loop does before advancing.
      const terminal = evaluateParallelTerminal({ records, options, artifact });
      if (terminal) return terminal;
    }
  }

  const startRound = Math.floor(peerTurnCount(records) / options.peers.length);
  // A re-entry (user or host intervention) refreshes the round budget exactly
  // like the alternating path: maxRounds fresh rounds beyond the resumed point.
  const roundBudget = budgetRefreshed
    ? startRound + options.maxRounds
    : options.maxRounds;

  for (
    let roundOffset = startRound;
    roundOffset < roundBudget;
    roundOffset += 1
  ) {
    // Phase 1 — peer subround: build and validate both peer records atomically.
    const { records: pair } = await executeParallelRound({
      mode: options.iteration,
      options,
      records,
      currentArtifact: artifact,
      invokePeer,
      prompts,
    });

    // Commit both peer records in fixed order. The pair is durable BEFORE any
    // synthesis step, so a synthesis process failure leaves it resumable
    // (pending-synthesis) and an invalid synthesis still keeps the pair.
    const committedPair: LoopRecord[] = [];
    for (const payload of pair) {
      const record = await writer.append({ ...payload });
      records.push(record);
      committedPair.push(record);
    }
    artifact = revisionTextFor(committedPair.at(-1)) ?? artifact;

    // Phase 2 — synthesis subround (synthesized mode only): a separate required record
    // after the committed peer pair. A process failure here propagates (pair durable,
    // no synthesis record); invalid/oversized writes a metadata-only synthesis-error.
    if (options.iteration === 'parallel_synthesized') {
      const round = committedPair[0]?.round_index;
      const synthesisResult = await executeSynthesis({
        options,
        records,
        pairRecords: committedPair,
        round: Number(round),
        invokeSynthesizer,
        prompts,
      });

      if (synthesisResult.synthesisError) {
        const errorRecord = await writer.append({
          ...synthesisResult.synthesisError.record,
        });
        records.push(errorRecord);
        throw synthesisResult.synthesisError.error;
      }

      const synthesisRecord = await writer.append({
        ...synthesisResult.synthesis,
      });
      records.push(synthesisRecord);
      artifact = synthesisResult.nextArtifact;
    }

    const terminal = evaluateParallelTerminal({ records, options, artifact });
    if (terminal) return terminal;
  }

  // Round budget spent without convergence → budget_exhausted escalation.
  const budgetDetected = detectEscalation(records, {
    mode: options.iteration,
    agency: options.agency,
    budgetExhausted: true,
  });
  return escalationTerminal({
    trigger: budgetDetected?.trigger ?? ESCALATION_TRIGGERS.budget_exhausted,
    detected: budgetDetected,
    options,
    records,
    artifact,
  });
}

export async function runConsensusLoop(
  argv: string[] | LoopOptions,
  runOptions: RunOptions = {},
) {
  const options = Array.isArray(argv) ? parseLoopArgs(argv) : argv;
  const initialRecords =
    runOptions.initialRecords ?? options.initialRecords ?? [];
  const records = await seedRecordsFile(
    options.outputRecords,
    initialRecords,
    runOptions,
  );
  const writer = await createRecordsWriter(options.outputRecords, runOptions);
  let currentArtifact =
    runOptions.initialArtifact ??
    options.initialArtifact ??
    (await readFile(options.sectionFile, 'utf8'));
  const initialPeerTurns = peerTurnCount(records);
  const intervention = await appendIntervention({
    writer,
    records,
    options,
    currentArtifact,
    intervention: resolveIntervention(runOptions, options),
  });
  const turnBudget = options.maxRounds * options.peers.length;
  const maxTurns = intervention ? initialPeerTurns + turnBudget : turnBudget;
  const env = runOptions.env ?? process.env;
  const cwd = runOptions.cwd ?? process.cwd();
  const invokePeer =
    runOptions.invokePeer ??
    ((turn: PeerInvocation) =>
      invokeProviderCliWithRetry(
        {
          provider: turn.provider,
          schemaPath: peerSchemaPathForMode(options.iteration),
          prompt: turn.prompt,
          env,
          cwd,
        },
        { mode: options.iteration },
      ));
  const invokeSynthesizer =
    runOptions.invokeSynthesizer ??
    ((call: SynthesizerInvocation) =>
      invokeConsensusProviderCli({
        provider: call.provider,
        schemaPath: call.schemaPath,
        prompt: call.prompt,
        env,
        cwd,
      }));
  const prompts = resolvePromptProfile(runOptions.promptProfile);

  try {
    if (PARALLEL_MODES.has(options.iteration)) {
      const terminal = await runParallelRounds({
        options,
        records,
        writer,
        currentArtifact,
        invokePeer,
        invokeSynthesizer,
        prompts,
        budgetRefreshed: Boolean(intervention),
      });
      return await writeTerminalArtifacts(
        options,
        terminal.status,
        terminal.artifact,
        records,
      );
    }

    for (
      let turnIndex = peerTurnCount(records);
      turnIndex < maxTurns;
      turnIndex += 1
    ) {
      const { verdict, recordPayload, nextArtifact } =
        await executeAlternatingTurn({
          turnIndex,
          options,
          records,
          currentArtifact,
          invokePeer,
          prompts,
        });
      currentArtifact = nextArtifact;

      const record = await writer.append({
        ...recordPayload,
      });
      records.push(record);

      if (verdict.verdict === 'IMPASSE') {
        const status = resultStatus(
          'impasse',
          'explicit_impasse',
          records,
          options,
          {
            final_artifact_hash: hashArtifact(
              currentArtifact,
              hashOptionsForAgency(options.agency),
            ),
          },
        );
        return await writeTerminalArtifacts(
          options,
          status,
          currentArtifact,
          records,
        );
      }

      const convergence = detectConvergence(
        records,
        convergenceOptionsForAgency(options.agency),
      );
      if (convergence.converged) {
        const statusExtra: JsonRecord = {
          final_artifact_hash: convergence.artifact_hash,
        };
        if (convergence.agency_decision) {
          statusExtra.agency_decision = convergence.agency_decision;
        }
        const status = resultStatus(
          'converged',
          convergence.reason,
          records,
          options,
          statusExtra,
        );
        return await writeTerminalArtifacts(
          options,
          status,
          currentArtifact,
          records,
        );
      }

      const oscillation = detectOscillation(
        records,
        convergenceOptionsForAgency(options.agency),
      );
      if (oscillation.oscillating) {
        const status = resultStatus(
          'oscillation',
          'oscillation_detected',
          records,
          options,
          {
            final_artifact_hash: hashArtifact(
              currentArtifact,
              hashOptionsForAgency(options.agency),
            ),
          },
        );
        return await writeTerminalArtifacts(
          options,
          status,
          currentArtifact,
          records,
        );
      }
    }

    const maxRoundsStatus =
      options.agency === 'maximum'
        ? resultStatus('converged', 'max_rounds_exhausted', records, options, {
            final_artifact_hash: hashArtifact(
              currentArtifact,
              hashOptionsForAgency(options.agency),
            ),
            agency_decision: 'maximum_declared_done_at_max_rounds',
          })
        : resultStatus('max-rounds', 'max_rounds_exhausted', records, options, {
            final_artifact_hash: hashArtifact(
              currentArtifact,
              hashOptionsForAgency(options.agency),
            ),
          });
    return await writeTerminalArtifacts(
      options,
      maxRoundsStatus,
      currentArtifact,
      records,
    );
  } catch (error) {
    const status = resultStatus('error', 'hard_error', records, options, {
      final_artifact_hash: hashArtifact(
        currentArtifact,
        hashOptionsForAgency(options.agency),
      ),
      error: hardErrorMessage(error),
    });
    await writeLoopStatus(options.outputStatus, status);
    throw error;
  } finally {
    await writer.close();
  }
}

import {
  ESCALATION_TRIGGERS,
  detectConvergence,
  detectEscalation,
  detectOscillation,
  detectParallelConvergence,
  detectParallelOscillation,
  detectSynthesisStability,
} from './loop-escalation.js';

// Value surface re-exported from ./loop-escalation.js.
export {
  ESCALATION_TRIGGERS,
  detectConvergence,
  detectEscalation,
  detectOscillation,
  detectParallelConvergence,
  detectParallelOscillation,
  detectSynthesisStability,
};

// Design §5 routing table (trigger × agency → base decide_via). Cells marked
// 'auto' terminate deterministically (no decision request); host cells are
// subject to genuinely-stuck promotion.
const ESCALATION_ROUTING_TABLE = Object.freeze({
  [ESCALATION_TRIGGERS.persistent_disagreement]: {
    minimal: 'user',
    moderate: 'host',
    maximum: 'host',
  },
  [ESCALATION_TRIGGERS.oscillation]: {
    minimal: 'user',
    moderate: 'user',
    maximum: 'host',
  },
  [ESCALATION_TRIGGERS.budget_exhausted]: {
    minimal: 'user',
    moderate: 'user',
    maximum: 'auto',
  },
  [ESCALATION_TRIGGERS.near_done_drift]: {
    minimal: 'user',
    moderate: 'host',
    maximum: 'auto',
  },
} satisfies Record<EscalationTrigger, Record<Agency, DecideVia>>);

const BASE_DECISION_KINDS = Object.freeze([
  'pick_a',
  'pick_b',
  'blend',
  'direct',
  'accept_impasse',
  'extend_budget',
]);

function decisionKindsFor(decideVia: DecideVia): string[] {
  return decideVia === 'host'
    ? [...BASE_DECISION_KINDS, 'defer_to_user']
    : [...BASE_DECISION_KINDS];
}

function priorHostDecisionForTrigger(
  records: LoopRecord[],
  trigger: EscalationTrigger,
): LoopRecord | null {
  if (!Array.isArray(records)) return null;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (
      record?.verdict === 'HOST_DECISION' &&
      record?.escalation_trigger === trigger
    ) {
      return record;
    }
  }
  return null;
}

/**
 * routeEscalation (p04-t02): pure function over (trigger, agency, records).
 * Applies the design §5 routing table, then genuinely-stuck promotion for
 * host-routed cells:
 *   (a) repeat-fire — the same trigger re-fires after a HOST_DECISION already
 *       answered it (a prior HOST_DECISION round for this trigger exists), OR
 *   (b) the host explicitly declined with decision_kind 'defer_to_user'.
 * Both promote to decide_via: 'user' with promoted_from: 'host'.
 * The maximum-agency budget_exhausted 'auto' cell is exempt (it terminates,
 * never loops) and preserves regression-locked v0.1 declare-done behavior.
 */
export function routeEscalation(
  trigger: EscalationTrigger,
  agency: Agency = 'moderate',
  records: LoopRecord[] = [],
): EscalationRoute {
  const row = ESCALATION_ROUTING_TABLE[trigger];
  if (!row) {
    throw new ConsensusError(`unknown escalation trigger: ${trigger}`, {
      code: 'ESCALATION_ROUTING',
      exitCode: EXIT_CODES.CONFIG,
      details: { trigger, agency },
    });
  }

  const baseDecideVia = row[agency] ?? 'user';

  if (baseDecideVia === 'auto') {
    const route: EscalationRoute = {
      trigger,
      agency,
      decide_via: 'auto',
      decision_kinds: [],
    };
    if (trigger === ESCALATION_TRIGGERS.budget_exhausted) {
      route.auto_resolution = 'declare_done';
    } else if (trigger === ESCALATION_TRIGGERS.near_done_drift) {
      route.auto_resolution = 'near_match';
    }
    return route;
  }

  if (baseDecideVia === 'host') {
    const priorHostDecision = priorHostDecisionForTrigger(records, trigger);
    const deferred = priorHostDecision?.decision_kind === 'defer_to_user';
    if (priorHostDecision) {
      // Repeat-fire after a host decision (or an explicit defer) is genuinely
      // stuck → promote to the user.
      return {
        trigger,
        agency,
        decide_via: 'user',
        promoted_from: 'host',
        promotion_reason: deferred ? 'defer_to_user' : 'repeat_fire',
        decision_kinds: decisionKindsFor('user'),
      };
    }
    return {
      trigger,
      agency,
      decide_via: 'host',
      decision_kinds: decisionKindsFor('host'),
    };
  }

  return {
    trigger,
    agency,
    decide_via: 'user',
    decision_kinds: decisionKindsFor('user'),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runConsensusLoop(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${hardErrorMessage(error)}\n`);
    process.exitCode = exitCodeForError(error);
  });
}
