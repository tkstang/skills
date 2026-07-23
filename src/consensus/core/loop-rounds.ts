import type {
  AlternatingTurnContext,
  AlternatingTurnResult,
  BaseRoundContext,
  CritiquePayload,
  IterationMode,
  JsonRecord,
  LoopOptions,
  LoopRecord,
  ParallelRoundResult,
  PeerVerdictPayload,
  ProviderResult,
  ResolvedPromptProfile,
  SynthesisPayload,
  SynthesisResult,
  SynthesizerInvoker,
} from './loop-types.js';
import { resolvePromptProfile, verdictForPrompt } from './loop-prompts.js';
import { providerAuditFields } from './loop-provider.js';
import { peerTurnCount } from './loop-records.js';
import {
  ConsensusError,
  EXIT_CODES,
  hardErrorMessage,
  hashArtifact,
  hashOptionsForAgency,
  normalizeVerdict,
  PARALLEL_MODES,
  synthesisSchemaPath,
  validateSynthesisCaps,
  validateSynthesisShape,
  validateVerdictCaps,
  validateVerdictShape,
  validationErrors,
  validationMetadata,
} from './loop-validation.js';

export async function executeAlternatingTurn({
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

export function revisionTextFor(record: LoopRecord | null | undefined): string | null {
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
export async function executeParallelRound(
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
export async function executeSynthesis({
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
