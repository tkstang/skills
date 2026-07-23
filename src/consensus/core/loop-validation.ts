import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type {
  Agency,
  ColdStartMode,
  ConsensusErrorOptions,
  ErrorLike,
  HashOptions,
  IterationMode,
  JsonRecord,
  LoopRecord,
  NormalizeOptions,
  PeerVerdictPayload,
  SynthesisPayload,
  ValidationResult,
} from './loop-types.js';

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asErrorLike(error: unknown): ErrorLike {
  return isJsonRecord(error) ? (error as ErrorLike) : {};
}

export function validationErrors(result: ValidationResult): string[] {
  return result.errors ?? [];
}

export function validationMetadata(result: ValidationResult): JsonRecord {
  return result.metadata ?? {};
}

export const VERDICT_CAPS = Object.freeze({
  reasoning_bytes: 16 * 1024,
  critique_field_bytes: 16 * 1024,
  proposed_artifact_bytes: 256 * 1024,
  concern_bytes: 4 * 1024,
  max_concerns: 20,
  total_verdict_bytes: 512 * 1024,
});

export const SYNTHESIS_CAPS = Object.freeze({
  synthesized_artifact_bytes: 256 * 1024,
  synthesis_reasoning_bytes: 16 * 1024,
  disagreement_bytes: 4 * 1024,
  max_disagreements: 20,
  total_synthesis_bytes: 512 * 1024,
});

export const LOOP_SCHEMA_VERSION = 'v1';
export const SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024;
// Mirrors provider-cli/subprocess.ts's DEFAULT_TERMINATION_GRACE_MS: the pause
// between SIGTERM and SIGKILL when a caller-supplied timeoutMs expires.
export const PROVIDER_CLI_KILL_GRACE_MS = 250;
// Mirrors provider-cli/subprocess.ts's DEFAULT_FINAL_RESOLUTION_MS: how long
// to wait after SIGKILL for 'close' before forcing settlement anyway (guards
// against a descendant process holding the stdio pipes open).
export const PROVIDER_CLI_FINAL_RESOLUTION_MS = 1000;
export const EXIT_CODES = Object.freeze({
  USAGE: 64,
  DATA: 65,
  IO: 73,
  SECTION_ERROR: 74,
  NOPERM: 77,
  CONFIG: 78,
  INTERRUPTED: 130,
});

export class ConsensusError extends Error {
  code: string;
  exitCode: number;
  details: unknown;
  stderr?: string;

  constructor(message: string, options: ConsensusErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ConsensusError';
    this.code = options.code ?? 'CONSENSUS_ERROR';
    this.exitCode = options.exitCode ?? EXIT_CODES.CONFIG;
    this.details = options.details;
  }
}

const DEFAULT_NORMALIZE_OPTIONS = {
  normalizeLineEndings: true,
  trimTrailingWhitespace: true,
  collapseEofNewlines: true,
  finalNewline: true,
} satisfies Required<NormalizeOptions>;

const STRICT_HASH_OPTIONS = {
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false,
} satisfies Required<NormalizeOptions>;

interface VerdictBranch {
  required: string[];
  optional: string[];
}

type VerdictBranchTable = Record<string, VerdictBranch>;

const ALTERNATING_VERDICT_BRANCHES = {
  ACCEPT: {
    required: ['schema_version', 'verdict', 'reasoning'],
    optional: ['concerns'],
  },
  REVISE: {
    required: ['schema_version', 'verdict', 'reasoning', 'proposed_artifact'],
    optional: ['concerns'],
  },
  IMPASSE: {
    required: ['schema_version', 'verdict', 'reasoning'],
    optional: ['concerns'],
  },
} satisfies VerdictBranchTable;

// `critique` is optional: round 1 (cold start) has no prior revision to critique,
// so peers legitimately omit it. Rounds 2+ supply it because the prompt asks for
// it; when present it is structurally validated. Keeping it optional avoids
// hard-failing a deliberation over a missing round-1 critique.
const PARALLEL_VERDICT_BRANCHES = {
  REVISE: {
    required: ['schema_version', 'verdict', 'reasoning', 'proposed_artifact'],
    optional: ['concerns', 'critique'],
  },
  ACCEPT_PEER: {
    required: ['schema_version', 'verdict', 'reasoning', 'proposed_artifact'],
    optional: ['concerns', 'critique'],
  },
  CONVERGED: {
    required: ['schema_version', 'verdict', 'reasoning'],
    optional: ['concerns', 'critique'],
  },
  IMPASSE: {
    required: ['schema_version', 'verdict', 'reasoning'],
    optional: ['concerns', 'critique'],
  },
} satisfies VerdictBranchTable;

const VERDICT_BRANCHES = {
  alternating: ALTERNATING_VERDICT_BRANCHES,
  parallel_revision: PARALLEL_VERDICT_BRANCHES,
  parallel_synthesized: PARALLEL_VERDICT_BRANCHES,
} satisfies Record<IterationMode, VerdictBranchTable>;

export const PARALLEL_MODES = new Set<IterationMode>([
  'parallel_revision',
  'parallel_synthesized',
]);

export const ITERATION_MODES = Object.freeze([
  'alternating',
  'parallel_revision',
  'parallel_synthesized',
]) as readonly IterationMode[];

export const COLD_START_MODES = Object.freeze([
  'shared_input',
  'independent_draft',
]) as readonly ColdStartMode[];

export function callsPerRound(mode: IterationMode) {
  if (mode === 'parallel_revision') return { peer: 2, synthesis: 0 };
  if (mode === 'parallel_synthesized') return { peer: 2, synthesis: 1 };
  return { peer: 1, synthesis: 0 };
}

export function invalidIterationModeError(value: unknown) {
  return new ConsensusError(
    `--iteration must be one of ${ITERATION_MODES.join(', ')} (received: ${value})`,
    {
      code: 'INVALID_ITERATION_MODE',
      exitCode: EXIT_CODES.USAGE,
      details: { received: value ?? null, allowed: [...ITERATION_MODES] },
    },
  );
}

function branchTableForMode(
  mode: IterationMode = 'alternating',
): VerdictBranchTable {
  return VERDICT_BRANCHES[mode] ?? ALTERNATING_VERDICT_BRANCHES;
}

function verdictVocabularyMessage(mode: IterationMode) {
  return PARALLEL_MODES.has(mode)
    ? 'verdict must be REVISE, ACCEPT_PEER, CONVERGED, or IMPASSE'
    : 'verdict must be ACCEPT, REVISE, or IMPASSE';
}

function normalizeOptions(options: NormalizeOptions = {}) {
  return { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
}

export function hashOptionsForAgency(agency: Agency = 'moderate') {
  return agency === 'minimal' ? STRICT_HASH_OPTIONS : {};
}

export function convergenceOptionsForAgency(agency: Agency = 'moderate') {
  return { agency, hashOptions: hashOptionsForAgency(agency) };
}

export function verdictDecision(record: LoopRecord | null | undefined): string | null {
  if (typeof record?.verdict === 'string') return record.verdict;
  if (!isJsonRecord(record?.verdict)) return record?.decision ?? null;
  return (
    record?.verdict?.verdict ??
    record?.verdict?.decision ??
    record?.decision ??
    null
  );
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function oversizedResult(
  field: string,
  limitBytes: number,
  actualBytes: number,
): ValidationResult {
  return {
    ok: false,
    metadata: {
      code: 'OVERSIZE_REJECTED',
      field,
      limit_bytes: limitBytes,
      actual_bytes: actualBytes,
    },
  };
}

function pushTypeError(
  errors: string[],
  field: string,
  expected: string,
): void {
  errors.push(`${field} must be ${expected}`);
}

export function roundCount(turns: number, peerCount: number): number {
  if (turns === 0) return 0;
  return Math.ceil(turns / peerCount);
}

export function required<T>(value: T | null | undefined | '', name: string): T {
  if (!value) {
    throw new Error(`missing required option: ${name}`);
  }
  return value;
}

export function schemaPath() {
  return fileURLToPath(
    new URL(
      '../skills/refine/schemas/verdict-alternating.schema.json',
      import.meta.url,
    ),
  );
}

export function parallelSchemaPath() {
  return fileURLToPath(
    new URL(
      '../skills/refine/schemas/verdict-parallel.schema.json',
      import.meta.url,
    ),
  );
}

/** The output schema a peer is shown for a given iteration mode. Parallel modes
 *  MUST send the parallel schema (vocabulary REVISE/ACCEPT_PEER/CONVERGED/IMPASSE
 *  + critique); alternating sends the alternating schema. */
export function peerSchemaPathForMode(mode: IterationMode) {
  return PARALLEL_MODES.has(mode) ? parallelSchemaPath() : schemaPath();
}

export function synthesisSchemaPath() {
  return fileURLToPath(
    new URL('../skills/refine/schemas/synthesis.schema.json', import.meta.url),
  );
}

export function hardErrorMessage(error: unknown): string {
  return asErrorLike(error).message ?? String(error);
}

export function exitCodeForError(error: unknown): number {
  const candidate = asErrorLike(error);
  if (candidate.name === 'AbortError' || candidate.code === 'SIGINT') {
    return EXIT_CODES.INTERRUPTED;
  }
  if (Number.isInteger(candidate.exitCode)) {
    return Number(candidate.exitCode);
  }
  if (
    [
      'PEER_UNAVAILABLE',
      'NODE_TOO_OLD',
      'NODE_VERSION_UNSUPPORTED',
      'PROVIDER_MISSING',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_AUTH_REQUIRED',
      'HOST_RECURSION_BLOCKED',
    ].includes(candidate.code ?? '')
  ) {
    return EXIT_CODES.CONFIG;
  }
  if (['EACCES', 'EPERM'].includes(candidate.code ?? '')) {
    return EXIT_CODES.NOPERM;
  }
  if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(candidate.code ?? '')) {
    return EXIT_CODES.IO;
  }
  if (
    error instanceof SyntaxError ||
    candidate.code === 'PROVIDER_INVALID_JSON'
  ) {
    return EXIT_CODES.DATA;
  }
  if (
    /^(--|unknown option|missing required option|input path|unexpected positional)/i.test(
      candidate.message ?? '',
    )
  ) {
    return EXIT_CODES.USAGE;
  }
  return EXIT_CODES.CONFIG;
}

export function recordHash(
  record: LoopRecord | null | undefined,
  options: HashOptions = {},
): string | null {
  const hashOptions =
    options.hashOptions ?? hashOptionsForAgency(options.agency);
  if (record?.artifact_hash) return formatArtifactHash(record.artifact_hash);
  if (record?.final_artifact_hash)
    return formatArtifactHash(record.final_artifact_hash);
  if (record?.artifactHash) return formatArtifactHash(record.artifactHash);
  if (typeof record?.artifact === 'string')
    return hashArtifact(record.artifact, hashOptions);
  if (typeof record?.proposed_artifact === 'string')
    return hashArtifact(record.proposed_artifact, hashOptions);
  if (
    isJsonRecord(record?.verdict) &&
    typeof record.verdict.proposed_artifact === 'string'
  ) {
    return hashArtifact(record.verdict.proposed_artifact, hashOptions);
  }
  return null;
}

export function formatArtifactHash(value: unknown): string {
  const text = String(value ?? '');
  if (/^sha256:[0-9a-f]{64}$/u.test(text)) return text;
  if (/^[0-9a-f]{64}$/u.test(text)) return `sha256:${text}`;
  return text;
}

export function normalizeForHash(
  text: unknown,
  options: NormalizeOptions = {},
): string {
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

export function hashArtifact(text: unknown, options: NormalizeOptions = {}) {
  return `sha256:${createHash('sha256').update(normalizeForHash(text, options), 'utf8').digest('hex')}`;
}

export function validateVerdictShape(
  verdict: unknown,
  { mode = 'alternating' }: { mode?: IterationMode } = {},
): ValidationResult {
  const errors: string[] = [];

  if (!isJsonRecord(verdict)) {
    return { ok: false, errors: ['verdict must be an object'] };
  }

  if (verdict.schema_version !== LOOP_SCHEMA_VERSION) {
    errors.push(`schema_version must be "${LOOP_SCHEMA_VERSION}"`);
  }

  const branchTable = branchTableForMode(mode);
  const verdictValue =
    typeof verdict.verdict === 'string' ? verdict.verdict : '';
  const branch = branchTable[verdictValue];
  if (!branch) {
    errors.push(verdictVocabularyMessage(mode));
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

  if (
    'proposed_artifact' in verdict &&
    typeof verdict.proposed_artifact !== 'string'
  ) {
    pushTypeError(errors, 'proposed_artifact', 'a string');
  }

  if ('critique' in verdict) {
    const critique = verdict.critique;
    if (!isJsonRecord(critique)) {
      pushTypeError(errors, 'critique', 'an object');
    } else {
      for (const key of ['own_previous', 'peer_previous'] as const) {
        if (!(key in critique)) {
          errors.push(`missing required property: critique.${key}`);
        } else if (typeof critique[key] !== 'string') {
          pushTypeError(errors, `critique.${key}`, 'a string');
        }
      }
      for (const key of Object.keys(critique)) {
        if (key !== 'own_previous' && key !== 'peer_previous') {
          errors.push(`additional property: critique.${key}`);
        }
      }
    }
  }

  if ('concerns' in verdict) {
    if (!Array.isArray(verdict.concerns)) {
      pushTypeError(errors, 'concerns', 'an array');
    } else {
      verdict.concerns.forEach((concern: unknown, index: number) => {
        if (typeof concern !== 'string') {
          pushTypeError(errors, `concerns[${index}]`, 'a string');
        }
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Normalize a peer verdict before validation. Strict structured-output providers
 * (OpenAI/codex) emit *every* schema property in every response and cannot omit
 * "optional" fields, so a non-REVISE verdict arrives carrying a `proposed_artifact`
 * (often with content) that its branch does not use. The loop only acts on the
 * stated verdict — and, for REVISE/ACCEPT_PEER, the `proposed_artifact` — so drop
 * any field the verdict's branch table does not permit. This honors the stated
 * verdict and makes the contract provider-agnostic. Pure function — preserves
 * deterministic-engine semantics. (A hand-built verdict passed directly to
 * validateVerdictShape is still validated strictly; normalization cleans peer
 * input at the loop boundary.)
 */
export function normalizeVerdict(
  verdict: unknown,
  mode: IterationMode = 'alternating',
): unknown {
  if (!isJsonRecord(verdict)) return verdict;
  const verdictValue =
    typeof verdict.verdict === 'string' ? verdict.verdict : '';
  const branch = branchTableForMode(mode)[verdictValue];
  if (!branch) return verdict; // unknown verdict — let validation report it
  const allowed = new Set([...branch.required, ...branch.optional]);
  const normalized = { ...verdict };
  for (const key of Object.keys(normalized)) {
    if (!allowed.has(key)) delete normalized[key];
  }
  return normalized;
}

export function validateSynthesisShape(synthesis: unknown): ValidationResult {
  if (!isJsonRecord(synthesis)) {
    return { ok: false, errors: ['synthesis must be an object'] };
  }

  const errors: string[] = [];
  const allowed = new Set([
    'schema_version',
    'synthesized_artifact',
    'synthesis_reasoning',
    'unresolved_disagreements',
  ]);

  for (const key of Object.keys(synthesis)) {
    if (!allowed.has(key)) {
      errors.push(`additional property: ${key}`);
    }
  }

  if (synthesis.schema_version !== LOOP_SCHEMA_VERSION) {
    errors.push(`schema_version must be "${LOOP_SCHEMA_VERSION}"`);
  }

  if (!('synthesized_artifact' in synthesis)) {
    errors.push('missing required property: synthesized_artifact');
  } else if (typeof synthesis.synthesized_artifact !== 'string') {
    pushTypeError(errors, 'synthesized_artifact', 'a string');
  }

  if (!('synthesis_reasoning' in synthesis)) {
    errors.push('missing required property: synthesis_reasoning');
  } else if (typeof synthesis.synthesis_reasoning !== 'string') {
    pushTypeError(errors, 'synthesis_reasoning', 'a string');
  }

  if (!('unresolved_disagreements' in synthesis)) {
    errors.push('missing required property: unresolved_disagreements');
  } else if (!Array.isArray(synthesis.unresolved_disagreements)) {
    pushTypeError(errors, 'unresolved_disagreements', 'an array');
  } else {
    synthesis.unresolved_disagreements.forEach(
      (entry: unknown, index: number) => {
        if (typeof entry !== 'string') {
          pushTypeError(
            errors,
            `unresolved_disagreements[${index}]`,
            'a string',
          );
        }
      },
    );
  }

  return { ok: errors.length === 0, errors };
}

export function validateSynthesisCaps(synthesis: unknown): ValidationResult {
  const shape = validateSynthesisShape(synthesis);
  if (!shape.ok) return shape;
  const payload = synthesis as SynthesisPayload;

  const totalBytes = byteLength(JSON.stringify(payload));
  if (totalBytes > SYNTHESIS_CAPS.total_synthesis_bytes) {
    return oversizedResult(
      'synthesis',
      SYNTHESIS_CAPS.total_synthesis_bytes,
      totalBytes,
    );
  }

  const artifactBytes = byteLength(payload.synthesized_artifact);
  if (artifactBytes > SYNTHESIS_CAPS.synthesized_artifact_bytes) {
    return oversizedResult(
      'synthesized_artifact',
      SYNTHESIS_CAPS.synthesized_artifact_bytes,
      artifactBytes,
    );
  }

  const reasoningBytes = byteLength(payload.synthesis_reasoning);
  if (reasoningBytes > SYNTHESIS_CAPS.synthesis_reasoning_bytes) {
    return oversizedResult(
      'synthesis_reasoning',
      SYNTHESIS_CAPS.synthesis_reasoning_bytes,
      reasoningBytes,
    );
  }

  if (
    payload.unresolved_disagreements.length > SYNTHESIS_CAPS.max_disagreements
  ) {
    return {
      ok: false,
      metadata: {
        code: 'OVERSIZE_REJECTED',
        field: 'unresolved_disagreements',
        limit_count: SYNTHESIS_CAPS.max_disagreements,
        actual_count: payload.unresolved_disagreements.length,
      },
    };
  }

  for (const [
    index,
    disagreement,
  ] of payload.unresolved_disagreements.entries()) {
    const disagreementBytes = byteLength(disagreement);
    if (disagreementBytes > SYNTHESIS_CAPS.disagreement_bytes) {
      return oversizedResult(
        `unresolved_disagreements[${index}]`,
        SYNTHESIS_CAPS.disagreement_bytes,
        disagreementBytes,
      );
    }
  }

  return { ok: true, errors: [] };
}

export function validateVerdictCaps(
  verdict: unknown,
  { mode = 'alternating' }: { mode?: IterationMode } = {},
): ValidationResult {
  const shape = validateVerdictShape(verdict, { mode });
  if (!shape.ok) return shape;
  const payload = verdict as PeerVerdictPayload;

  const totalBytes = byteLength(JSON.stringify(payload));
  if (totalBytes > VERDICT_CAPS.total_verdict_bytes) {
    return oversizedResult(
      'verdict',
      VERDICT_CAPS.total_verdict_bytes,
      totalBytes,
    );
  }

  const reasoningBytes = byteLength(payload.reasoning);
  if (reasoningBytes > VERDICT_CAPS.reasoning_bytes) {
    return oversizedResult(
      'reasoning',
      VERDICT_CAPS.reasoning_bytes,
      reasoningBytes,
    );
  }

  if ('proposed_artifact' in payload) {
    const proposedBytes = byteLength(payload.proposed_artifact);
    if (proposedBytes > VERDICT_CAPS.proposed_artifact_bytes) {
      return oversizedResult(
        'proposed_artifact',
        VERDICT_CAPS.proposed_artifact_bytes,
        proposedBytes,
      );
    }
  }

  if (
    payload.critique &&
    typeof payload.critique === 'object' &&
    !Array.isArray(payload.critique)
  ) {
    for (const key of ['own_previous', 'peer_previous'] as const) {
      if (key in payload.critique) {
        const critiqueBytes = byteLength(payload.critique[key]);
        if (critiqueBytes > VERDICT_CAPS.critique_field_bytes) {
          return oversizedResult(
            `critique.${key}`,
            VERDICT_CAPS.critique_field_bytes,
            critiqueBytes,
          );
        }
      }
    }
  }

  if (Array.isArray(payload.concerns)) {
    if (payload.concerns.length > VERDICT_CAPS.max_concerns) {
      return {
        ok: false,
        metadata: {
          code: 'OVERSIZE_REJECTED',
          field: 'concerns',
          limit_count: VERDICT_CAPS.max_concerns,
          actual_count: payload.concerns.length,
        },
      };
    }

    for (const [index, concern] of payload.concerns.entries()) {
      const concernBytes = byteLength(concern);
      if (concernBytes > VERDICT_CAPS.concern_bytes) {
        return oversizedResult(
          `concerns[${index}]`,
          VERDICT_CAPS.concern_bytes,
          concernBytes,
        );
      }
    }
  }

  return { ok: true, errors: [] };
}
