import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { resolveConsensusComposition } from '../config/consensus-config.js';
import {
  callsPerRound,
  ConsensusError,
  consensusProviderCliMissingError,
  EXIT_CODES,
  exitCodeForError,
  hashArtifact,
  invokeConsensusProviderCli,
  invokeProviderCliWithRetry,
  invalidIterationModeError,
  ITERATION_MODES,
  peerSchemaPathForMode,
  providerCliSpawnTarget,
  requireConsensusCliPath,
  runConsensusLoop,
} from '../core/consensus-loop.js';
import type { ProviderInventoryEntry as ConsensusProviderInventoryEntry } from '../provider-cli/types.js';
import {
  isJsonRecord,
  asErrorLike,
  asConsensusRecord,
  asConsensusRecords,
  asSectionStatus,
  inside,
  nearestExistingPath,
  syncPathIfAvailable,
  nowIso,
  writeJsonl,
  renderHumanError,
  consensusBlockPattern,
  readInputFile,
  confineWrite,
  atomicWriteFile,
  resolveRunDir,
  resolveOutputPath,
  resolveResumePath,
  readJsonFile,
  readJsonIfPresent,
  readTextIfPresent,
} from './refine-shared.js';
import type {
  JsonRecord,
  IterationModeValue,
  AgencyValue,
  ColdStartValue,
  HostId,
  LoopRunOptions,
  LoopInitialRecords,
  LoopEscalationTrigger,
  JsonlWritable,
  ErrorLike,
  AnnotatedError,
  TryJsonBlockResult,
  ResumeValidationError,
  ConsensusRecord,
  SectionStatus,
  SectionPaths,
  ParsedSection,
  SectionResult,
  ArtifactResolution,
  WrapperRunResult,
  ResumeLogSection,
  ResumeState,
  ProviderInventoryEntry,
  NormalizedProviderInventoryEntry,
  ProviderInventoryInput,
  PreflightResult,
  CommandRunnerResult,
  CommandRunner,
  WrapperOptions,
  ParsedWrapperOptions,
  WrapperRunOptions,
  ParallelManifestEntry,
  ParallelManifest,
  LoopInvocationPayload,
} from './refine-types.js';

export {
  INPUT_SIZE_CAP_BYTES,
  createJsonlEvent,
  renderHumanError,
  readInputFile,
  confineWrite,
  atomicWriteFile,
  resolveRunDir,
  resolveOutputPath,
  resolveResumePath,
} from './refine-shared.js';

import {
  pathConfinementError,
  resolveManifestPathValue,
  assertPathResolvesInside,
  normalizeParallelManifest,
} from './refine-manifest.js';

const execFileAsync = promisify(execFile);
export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const STRICT_RESUME_HASH_OPTIONS = Object.freeze({
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false,
});

function asProviderInventoryEntry(value: unknown): ProviderInventoryEntry {
  return isJsonRecord(value) ? (value as ProviderInventoryEntry) : {};
}

function asLoopInitialRecords(records: ConsensusRecord[] | undefined) {
  return (records ?? []) as LoopInitialRecords;
}

function dynamicFence(contents: unknown, info = '') {
  const text = String(contents ?? '');
  const maxRun = Math.max(
    0,
    ...[...text.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const ticks = '`'.repeat(Math.max(3, maxRun + 1));
  const opener = info ? `${ticks}${info}` : ticks;
  return `${opener}\n${text.replace(/\n*$/u, '\n')}${ticks}`;
}

function canonicalJsonBlock(label: string, value: unknown) {
  // Escape any `-->` in the serialized JSON so an untrusted string value cannot
  // close the enclosing HTML comment early and truncate the block. This block is
  // round-tripped back through consensusBlockPattern/JSON.parse, and `>`
  // decodes to `>`, so the reconstructed value is unchanged.
  const json = JSON.stringify(value, null, 2).replace(/-->/gu, '--\\u003e');
  return `<!-- consensus:${label}\n${json}\n-->`;
}

function sanitizeProse(text: unknown) {
  return String(text ?? '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '[removed]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function containMarkdownHeadings(text: unknown) {
  return String(text ?? '').replace(
    /^([ \t]{0,3})(#{1,6})([ \t]+.*)$/gmu,
    '$1\\$2$3',
  );
}

function sanitizeLogProse(text: unknown) {
  return containMarkdownHeadings(sanitizeProse(text));
}

function sectionOutput(section: SectionResult) {
  return section.output ?? section.result?.output ?? section.markdown ?? '';
}

function resumeDataError(message: string, details: JsonRecord = {}) {
  return new ConsensusError(message, {
    code:
      typeof details.code === 'string' ? details.code : 'RESUME_DATA_INVALID',
    exitCode: EXIT_CODES.DATA,
    details: details.details,
  });
}

function parseYamlScalar(value: unknown): unknown {
  const text = String(value ?? '').trim();
  if (text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(text)) return Number(text);
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}

function parseFrontmatter(markdown: unknown): JsonRecord {
  const text = String(markdown ?? '');
  if (!text.startsWith('---\n')) {
    return {};
  }

  const endIndex = text.indexOf('\n---', 4);
  if (endIndex === -1) {
    throw resumeDataError('resume artifact frontmatter is unterminated', {
      code: 'RESUME_FRONTMATTER_INVALID',
    });
  }

  const frontmatter: JsonRecord = {};
  for (const line of text.slice(4, endIndex).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) continue;
    frontmatter[match[1]] = parseYamlScalar(match[2]);
  }
  return frontmatter;
}

function parseConsensusJsonBlock(
  label: string,
  jsonText: string,
  index: number,
): unknown {
  try {
    return JSON.parse(jsonText) as unknown;
  } catch (error) {
    throw resumeDataError(
      `corrupt consensus:${label} JSON block at index ${index}: ${asErrorLike(error).message}`,
      {
        code: 'RESUME_JSON_CORRUPT',
        details: { label, index },
      },
    );
  }
}

function tryParseConsensusJsonBlock(
  label: string,
  jsonText: string,
  index: number,
): TryJsonBlockResult {
  try {
    return { ok: true, value: JSON.parse(jsonText) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'RESUME_JSON_CORRUPT',
        message: `corrupt consensus:${label} JSON block at index ${index}: ${asErrorLike(error).message}`,
        block_label: label,
        block_index: index,
      },
    };
  }
}

function extractConsensusJsonBlocks(markdown: unknown, label: string) {
  const blocks: unknown[] = [];
  for (const [index, match] of [
    ...String(markdown ?? '').matchAll(consensusBlockPattern(label)),
  ].entries()) {
    blocks.push(parseConsensusJsonBlock(label, match[1], index));
  }
  return blocks;
}

function extractLogSectionBlocks(markdown: unknown): {
  logSections: ResumeLogSection[];
  unscopedErrors: ResumeValidationError[];
} {
  const logStart = String(markdown ?? '').match(/^## Deliberation Log\s*$/mu);
  const logText = logStart
    ? String(markdown).slice(logStart.index)
    : String(markdown ?? '');
  // Resume canonical record stream (p05-t01): peer verdicts, synthesis records,
  // and synthesis-error records all flow into the section's record array in
  // document order so the loop can derive parallel-mode resume state.
  const blockPattern =
    /<!-- consensus:(consensus-section-status|consensus-verdict|consensus-synthesis|consensus-synthesis-error)\n([\s\S]*?)\n-->/g;
  const logSections: ResumeLogSection[] = [];
  const unscopedErrors: ResumeValidationError[] = [];
  let current: ResumeLogSection | null = null;

  for (const [index, match] of [...logText.matchAll(blockPattern)].entries()) {
    const [, label, jsonText] = match;
    const parsed = tryParseConsensusJsonBlock(label, jsonText, index);
    if (label === 'consensus-section-status') {
      current = { status: null, records: [], errors: [] };
      if (parsed.ok) {
        current.status = asSectionStatus(parsed.value);
      } else {
        current.errors.push(parsed.error);
      }
      logSections.push(current);
      continue;
    }

    if (!current) {
      unscopedErrors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        message: `resume artifact has ${label} records before any section status block`,
        block_label: label,
        block_index: index,
      });
      continue;
    }

    if (parsed.ok) {
      current.records.push(asConsensusRecord(parsed.value));
    } else {
      current.errors.push(parsed.error);
    }
  }

  return { logSections, unscopedErrors };
}

function lastProposedArtifact(records: ConsensusRecord[]) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (typeof records[index]?.proposed_artifact === 'string') {
      return records[index].proposed_artifact;
    }
  }
  return null;
}

function resumeAgencyFromMetadata(
  resolution: JsonRecord = {},
  frontmatter: JsonRecord = {},
  options: Pick<WrapperOptions, 'agency'> = {},
): AgencyValue {
  const agency =
    resolution.agency ?? frontmatter.agency ?? options.agency ?? 'moderate';
  return typeof agency === 'string' &&
    ['minimal', 'moderate', 'maximum'].includes(agency)
    ? (agency as AgencyValue)
    : 'moderate';
}

function resumeHashOptionsForAgency(agency: unknown = 'moderate') {
  return agency === 'minimal' ? STRICT_RESUME_HASH_OPTIONS : {};
}

function normalizeResumeRecords(
  records: unknown,
  peers: string[] = ['claude', 'codex'],
  options: Pick<WrapperOptions, 'agency'> = {},
) {
  let peerIndex = 0;
  let currentArtifact: string | null = null;
  const hashOptions = resumeHashOptionsForAgency(options.agency);
  return asConsensusRecords(records).map((record) => {
    const isSynthesis = record?.record_type === 'synthesis';
    const isSynthesisError = record?.record_type === 'synthesis-error';
    const isHost =
      record?.verdict === 'HOST_DECISION' ||
      record?.agent === 'host-orchestrator';
    const isUser =
      record?.verdict === 'USER_INTERVENTION' || record?.agent === 'user';
    const normalized = {
      schema_version: 'v1',
      ...record,
    };

    // The shared artifact tracks the latest peer revision OR the latest synthesis
    // output (synthesized mode), so derived hashes stay consistent on resume.
    if (typeof normalized.proposed_artifact === 'string') {
      currentArtifact = normalized.proposed_artifact;
    } else if (
      isSynthesis &&
      typeof normalized.synthesized_artifact === 'string'
    ) {
      currentArtifact = normalized.synthesized_artifact;
    }

    if (isSynthesis || isSynthesisError) {
      // Synthesis records are round-attributed, not peer-attributed: never consume
      // a peer slot. round_index falls back to the current peer round.
      normalized.round_index ??=
        Math.floor(Math.max(peerIndex - 1, 0) / peers.length) + 1;
    } else if (isHost) {
      normalized.agent = 'host-orchestrator';
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      normalized.turn_index ??= peerIndex + 1;
    } else if (isUser) {
      normalized.agent = 'user';
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      normalized.turn_index ??= peerIndex + 1;
      normalized.reasoning ??= normalized.user_direction ?? '';
      normalized.user_direction ??= normalized.reasoning;
    } else {
      normalized.agent ??=
        peers[peerIndex % peers.length] ?? `peer-${peerIndex + 1}`;
      normalized.turn_index ??= peerIndex + 1;
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      peerIndex += 1;
    }

    if (
      !normalized.artifact_hash &&
      currentArtifact !== null &&
      !isSynthesisError
    ) {
      normalized.artifact_hash = hashArtifact(currentArtifact, hashOptions);
    }

    return normalized;
  });
}

function normalizeResumeSection(
  state: unknown,
  logSection: ResumeLogSection | undefined,
  index: number,
  options: Pick<WrapperOptions, 'agency' | 'peers'> = {},
) {
  const stateRecord = isJsonRecord(state) ? state : {};
  const records = normalizeResumeRecords(
    logSection?.records ?? [],
    options.peers ?? undefined,
    {
      agency: options.agency,
    },
  );
  const canonicalArtifact =
    typeof stateRecord.final_output === 'string'
      ? stateRecord.final_output
      : null;
  const logArtifact = lastProposedArtifact(records);
  const resumedArtifact = canonicalArtifact ?? logArtifact;
  const status = logSection?.status ?? {};
  const sectionStatus = stateRecord.status ?? status.status ?? 'unknown';
  const completed = sectionStatus === 'converged';
  const hashOptions = resumeHashOptionsForAgency(options.agency);

  return {
    id: typeof stateRecord.id === 'string' ? stateRecord.id : undefined,
    name: typeof stateRecord.name === 'string' ? stateRecord.name : undefined,
    original_index:
      typeof stateRecord.original_index === 'number'
        ? stateRecord.original_index
        : index,
    state: stateRecord,
    status,
    records,
    completed,
    inFlight: !completed,
    skipped: false,
    corruptErrors: [],
    resumedArtifact,
    resumedArtifactHash:
      resumedArtifact === null
        ? null
        : hashArtifact(resumedArtifact, hashOptions),
    resumedArtifactSource:
      canonicalArtifact !== null
        ? 'section_state.final_output'
        : logArtifact !== null
          ? 'deliberation_log.proposed_artifact'
          : null,
  } as SectionResult;
}

function resumeHashError(
  section: SectionResult,
  expectedHash: string,
  actualHash: string | null,
): ResumeValidationError {
  return {
    code: 'RESUME_HASH_MISMATCH',
    section_id: section.id,
    section_name: section.name,
    message: `hash mismatch for section ${section.id}: expected ${expectedHash}, recomputed ${actualHash}`,
    expected_hash: expectedHash,
    actual_hash: actualHash,
  };
}

function collectResumeValidationErrors(
  resumeSectionStates: unknown[],
  logSections: ResumeLogSection[],
  unscopedErrors: ResumeValidationError[],
  options: Pick<WrapperOptions, 'agency' | 'peers'> = {},
) {
  const errors = [...unscopedErrors];

  if (logSections.length < resumeSectionStates.length) {
    for (
      let index = logSections.length;
      index < resumeSectionStates.length;
      index += 1
    ) {
      const candidate = resumeSectionStates[index];
      const state: JsonRecord = isJsonRecord(candidate) ? candidate : {};
      const sectionId = typeof state.id === 'string' ? state.id : undefined;
      const sectionName =
        typeof state.name === 'string' ? state.name : undefined;
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_id: sectionId,
        section_name: sectionName,
        section_index: index,
        message: `missing section state for ${sectionId ?? `section index ${index}`}`,
      });
    }
  } else if (logSections.length > resumeSectionStates.length) {
    for (
      let index = resumeSectionStates.length;
      index < logSections.length;
      index += 1
    ) {
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_index: index,
        message: `deliberation log has no canonical section state for section index ${index}`,
      });
    }
  }

  const sections = resumeSectionStates.map((state, index) => {
    const section = normalizeResumeSection(
      state,
      logSections[index],
      index,
      options,
    );
    if (
      !state ||
      typeof state !== 'object' ||
      Array.isArray(state) ||
      !isJsonRecord(state) ||
      !state.id
    ) {
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_index: index,
        message: `missing section state for section index ${index}`,
      });
    }

    for (const error of logSections[index]?.errors ?? []) {
      errors.push({
        ...error,
        section_id: section.id,
        section_name: section.name,
        section_index: index,
      });
    }

    if (!logSections[index]?.status) {
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_id: section.id,
        section_name: section.name,
        section_index: index,
        message: `missing section state for ${section.id}`,
      });
    }

    const stateRecord = isJsonRecord(state) ? state : {};
    const stateHash =
      typeof stateRecord.final_artifact_hash === 'string'
        ? stateRecord.final_artifact_hash
        : null;
    const statusHash = logSections[index]?.status?.final_artifact_hash ?? null;
    if (stateHash && statusHash && stateHash !== statusHash) {
      errors.push(resumeHashError(section, stateHash, statusHash));
    }

    // Synthesis records carry the hash of their synthesized text; validate it
    // fail-closed (p05-t01) like peer revisions so a tampered synthesis block is
    // detected on resume.
    const hashOptions = resumeHashOptionsForAgency(options.agency);
    const peerCount = Array.isArray(options.peers) ? options.peers.length : 2;
    const peerRoundCounts = new Map<number, number>();
    for (const record of section.records ?? []) {
      const isPeer =
        record?.record_type !== 'synthesis' &&
        record?.record_type !== 'synthesis-error' &&
        record?.agent !== 'user' &&
        record?.agent !== 'host-orchestrator' &&
        record?.verdict !== 'USER_INTERVENTION' &&
        record?.verdict !== 'HOST_DECISION';
      if (isPeer && Number.isInteger(Number(record?.round_index))) {
        const round = Number(record.round_index);
        peerRoundCounts.set(round, (peerRoundCounts.get(round) ?? 0) + 1);
      }
      if (record?.record_type !== 'synthesis') continue;
      // A synthesis record requires a complete peer pair in its round (p05-t03):
      // a half-missing pair is fail-closed corrupt state.
      const round = Number(record?.round_index);
      if (
        Number.isInteger(round) &&
        (peerRoundCounts.get(round) ?? 0) < peerCount
      ) {
        errors.push({
          code: 'RESUME_PAIR_INCOMPLETE',
          section_id: section.id,
          section_name: section.name,
          section_index: index,
          message: `incomplete peer pair for synthesized round ${round} in section ${section.id}: expected ${peerCount} peer records`,
        });
      }
      if (
        typeof record.synthesized_artifact !== 'string' ||
        !record.artifact_hash
      )
        continue;
      const recomputed = hashArtifact(record.synthesized_artifact, hashOptions);
      if (recomputed !== record.artifact_hash) {
        errors.push({
          ...resumeHashError(section, record.artifact_hash, recomputed),
          code: 'RESUME_SYNTHESIS_HASH_MISMATCH',
          message: `synthesis hash mismatch for section ${section.id}: expected ${record.artifact_hash}, recomputed ${recomputed}`,
        });
      }
    }

    const expectedHash = statusHash ?? stateHash;
    if (expectedHash && section.resumedArtifact === null) {
      errors.push({
        code: 'RESUME_SECTION_OUTPUT_MISSING',
        section_id: section.id,
        section_name: section.name,
        section_index: index,
        message: `missing canonical final output for section ${section.id}`,
      });
    }
    if (
      section.resumedArtifact !== null &&
      expectedHash &&
      section.resumedArtifactHash !== expectedHash
    ) {
      errors.push(
        resumeHashError(
          section,
          expectedHash,
          section.resumedArtifactHash ?? null,
        ),
      );
    }

    return section;
  });

  return { sections, errors };
}

async function writeResumeErrors(
  runDir: string | null | undefined,
  errors: ResumeValidationError[],
  skippedIds: string[] = [],
) {
  if (!runDir) return null;

  const outputPath = path.join(runDir, 'resume-errors.json');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        consensus_schema_version: 'v1',
        generated_at: nowIso(),
        errors,
        skipped_section_ids: skippedIds,
      },
      null,
      2,
    )}\n`,
  );
  await syncPathIfAvailable(outputPath);
  return outputPath;
}

async function defaultConfirmSkipAllCorrupt({
  errors,
  stdin = process.stdin,
  stdout = process.stdout,
}: {
  errors: ResumeValidationError[];
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
  stdout?: NodeJS.WritableStream;
}) {
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      `Skip ${errors.length} corrupt resume section(s) and continue? [y/N] `,
    );
    return /^y(?:es)?$/iu.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function applyResumeSkipPolicy(
  sections: SectionResult[],
  errors: ResumeValidationError[],
  options: Pick<
    WrapperOptions,
    'skipCorruptSections' | 'skipAllCorrupt' | 'yesSkipCorrupt'
  > & {
    confirmSkipAllCorrupt?: typeof defaultConfirmSkipAllCorrupt;
    stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
    stdout?: NodeJS.WritableStream;
  } = {},
) {
  const sectionErrors = errors.filter(
    (error): error is ResumeValidationError & { section_id: string } =>
      typeof error.section_id === 'string',
  );
  const explicitSkipIds = new Set(options.skipCorruptSections ?? []);
  let skipAll = Boolean(options.yesSkipCorrupt);

  if (!skipAll && options.skipAllCorrupt && sectionErrors.length > 0) {
    const confirm =
      options.confirmSkipAllCorrupt ?? defaultConfirmSkipAllCorrupt;
    skipAll = await confirm({
      errors: sectionErrors,
      stdin: options.stdin,
      stdout: options.stdout,
    });
  }

  const skippedIds = new Set<string>();
  for (const error of sectionErrors) {
    if (skipAll || explicitSkipIds.has(error.section_id)) {
      skippedIds.add(error.section_id);
    }
  }

  for (const section of sections) {
    if (!skippedIds.has(section.id)) continue;
    section.skipped = true;
    section.inFlight = false;
    section.completed = false;
    section.corruptErrors = errors.filter(
      (error) => error.section_id === section.id,
    );
  }

  return {
    skippedIds,
    unhandledErrors: errors.filter(
      (error) => !error.section_id || !skippedIds.has(error.section_id),
    ),
  };
}

function corruptResumeError(
  errors: ResumeValidationError[],
  diagnosticsPath: string | null,
) {
  const details = {
    errors,
    ...(diagnosticsPath ? { resume_errors_path: diagnosticsPath } : {}),
  };
  const firstMessage = errors[0]?.message ? `: ${errors[0].message}` : '';
  return resumeDataError(
    `corrupt resume state${firstMessage}; resume is blocked until corrupt sections are skipped explicitly`,
    {
      code: 'RESUME_CORRUPT',
      details,
    },
  );
}

async function readResumePathOrText(pathOrText: string) {
  const value = String(pathOrText ?? '');
  if (!value.includes('\n')) {
    try {
      const fileStatus = await stat(value);
      if (fileStatus.isFile()) {
        return {
          text: await readFile(value, 'utf8'),
          sourcePath: path.resolve(value),
        };
      }
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(asErrorLike(error).code ?? '')) {
        throw error;
      }
    }
  }
  return { text: value, sourcePath: null };
}

function latestRevisedOutput(records: ConsensusRecord[], fallback: string) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (typeof record?.proposed_artifact === 'string') {
      return record.proposed_artifact;
    }
  }
  return fallback;
}

function fallbackErrorStatus(
  error: unknown,
  records: ConsensusRecord[],
  peerCount: number,
): SectionStatus {
  const turns = records.length;
  return {
    status: 'error',
    termination_reason: 'hard_error',
    turns,
    rounds: turns === 0 ? 0 : Math.ceil(turns / peerCount),
    error: asErrorLike(error).message,
  };
}

function aggregateStatus(sections: SectionResult[]) {
  const statuses = sections.map(
    (section) =>
      section.status?.status ?? section.result?.status?.status ?? 'unknown',
  );
  if (statuses.every((status) => status === 'converged')) return 'converged';
  if (statuses.some((status) => status === 'error')) return 'error';
  if (
    statuses.some(
      (status) =>
        status === 'impasse' ||
        status === 'max-rounds' ||
        status === 'oscillation' ||
        status === 'escalation',
    )
  ) {
    return 'partial';
  }
  return 'unknown';
}

function aggregateParallelStatus(sections: SectionResult[]) {
  const statuses = sections.map(
    (section) => section.status?.status ?? 'unknown',
  );
  if (statuses.every((status) => status === 'converged')) return 'converged';
  if (statuses.some((status) => ['error', 'impasse'].includes(status))) {
    return statuses.some((status) => status === 'converged')
      ? 'partial'
      : 'error';
  }
  return aggregateStatus(sections);
}

function sectionStates(sections: SectionResult[]) {
  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    original_index: section.original_index,
    status: section.status?.status ?? 'unknown',
    termination_reason: section.status?.termination_reason ?? null,
    turns: section.status?.turns ?? 0,
    rounds: section.status?.rounds ?? 0,
    final_artifact_hash: section.status?.final_artifact_hash ?? null,
    final_output: sectionOutput(section),
    subagent_id: section.subagent_id ?? null,
  }));
}

function countByStatus(sections: SectionResult[], statusName: string) {
  return sections.filter((section) => section.status?.status === statusName)
    .length;
}

function lastTwoPeerRevisionRecords(records: ConsensusRecord[]) {
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

function latestSynthesisRecord(records: ConsensusRecord[]) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]?.record_type === 'synthesis') return records[index];
  }
  return null;
}

function revisionText(record: ConsensusRecord | null | undefined) {
  if (typeof record?.proposed_artifact === 'string')
    return record.proposed_artifact;
  if (typeof record?.synthesized_artifact === 'string')
    return record.synthesized_artifact;
  return '';
}

/**
 * Build the escalation_required event payload for a section (p04-t04). Resolves
 * the FULL divergent text from the section's records (both latest peer revisions,
 * plus synthesis text + unresolved disagreements in synthesized mode) and the
 * resume vector. This is the only content-bearing routine event (NFR5 boundary).
 */
export function buildEscalationEvent(
  section: SectionResult,
  { artifactPath }: { artifactPath?: string | null } = {},
) {
  const escalation = section?.status?.escalation;
  if (!escalation) return null;

  const records = section.records ?? [];
  const [left, right] = lastTwoPeerRevisionRecords(records);
  const synthesis = latestSynthesisRecord(records);

  const divergent: JsonRecord = {
    a: {
      agent: left?.agent ?? escalation.divergent?.a?.agent ?? null,
      text: revisionText(left),
    },
    b: {
      agent: right?.agent ?? escalation.divergent?.b?.agent ?? null,
      text: revisionText(right),
    },
  };
  if (synthesis || escalation.divergent?.synthesis) {
    divergent.synthesis = {
      text: revisionText(synthesis),
      unresolved_disagreements: Array.isArray(
        synthesis?.unresolved_disagreements,
      )
        ? synthesis.unresolved_disagreements
        : (escalation.divergent?.synthesis?.unresolved_disagreements ?? []),
    };
  }

  const flag =
    escalation.decide_via === 'user' ? '--user-direction' : '--host-direction';

  const event: JsonRecord = {
    section_id: section.id,
    section_name: section.name,
    trigger: escalation.trigger,
    decide_via: escalation.decide_via,
    decision_kinds: escalation.decision_kinds ?? [],
    divergent,
    resume: { artifact_path: artifactPath ?? null, flag },
  };
  if (escalation.promoted_from) {
    event.promoted_from = escalation.promoted_from;
  }
  return event;
}

function escalatedSections(sections: SectionResult[]) {
  return sections.filter((section) => section.status?.status === 'escalation');
}

function escalationRoutingError(message: string, details: JsonRecord = {}) {
  return new ConsensusError(message, {
    code: 'ESCALATION_ROUTING',
    exitCode: EXIT_CODES.CONFIG,
    details,
  });
}

/**
 * Fail-closed routing guard for --host-direction (p04-t05). A host direction is
 * only valid against a pending escalation whose decide_via is 'host'. It is
 * rejected when no escalation is pending or when the pending escalation routes
 * to the user (ESCALATION_ROUTING).
 */
function assertHostDirectionRoutable(resumeSection: SectionResult) {
  const escalation = resumeSection?.status?.escalation;
  if (resumeSection?.status?.status !== 'escalation' || !escalation) {
    throw escalationRoutingError(
      '--host-direction supplied but no escalation is pending for resume',
      {
        section_status: resumeSection?.status?.status ?? null,
      },
    );
  }
  if (escalation.decide_via !== 'host') {
    throw escalationRoutingError(
      `--host-direction rejected: pending escalation routes to ${escalation.decide_via}`,
      { decide_via: escalation.decide_via, trigger: escalation.trigger },
    );
  }
  return escalation;
}

function failingSections(sections: SectionResult[]) {
  return sections
    .filter((section) => {
      const sectionStatus = section.status?.status;
      return sectionStatus === 'error' || sectionStatus === 'impasse';
    })
    .map((section) => ({
      id: section.id,
      name: section.name,
      original_index: section.original_index,
      status: section.status?.status ?? 'unknown',
      termination_reason: section.status?.termination_reason ?? null,
    }));
}

function renderSynthesisRecord(record: ConsensusRecord) {
  const roundLabel = record.round_index ?? record.round ?? '?';
  const synthesizer = record.synthesizer ?? 'synthesizer';
  const synthesisDocument = {
    schema_version: record.schema_version ?? 'v1',
    record_type: 'synthesis',
    synthesizer,
    synthesized_artifact: record.synthesized_artifact ?? '',
    synthesis_reasoning: record.synthesis_reasoning ?? '',
    unresolved_disagreements: Array.isArray(record.unresolved_disagreements)
      ? record.unresolved_disagreements
      : [],
  };

  const parts = [`#### Round ${roundLabel} - ${synthesizer} - SYNTHESIS`];
  if (synthesisDocument.synthesis_reasoning) {
    parts.push(
      '',
      'Synthesis reasoning:',
      sanitizeLogProse(synthesisDocument.synthesis_reasoning),
    );
  }
  if (synthesisDocument.synthesized_artifact) {
    parts.push(
      '',
      'Synthesized Artifact:',
      dynamicFence(
        sanitizeProse(synthesisDocument.synthesized_artifact),
        'markdown',
      ),
    );
  }
  if (synthesisDocument.unresolved_disagreements.length > 0) {
    parts.push(
      '',
      'Unresolved disagreements:',
      ...synthesisDocument.unresolved_disagreements.map(
        (entry) => `- ${sanitizeLogProse(entry)}`,
      ),
    );
  }
  parts.push('', canonicalJsonBlock('consensus-synthesis', synthesisDocument));
  return parts.join('\n');
}

function renderSynthesisErrorRecord(record: ConsensusRecord) {
  const roundLabel = record.round_index ?? record.round ?? '?';
  const synthesizer = record.synthesizer ?? 'synthesizer';
  const errorDocument = {
    schema_version: record.schema_version ?? 'v1',
    record_type: 'synthesis-error',
    synthesizer,
    code: record.code ?? 'INVALID_SYNTHESIS',
    metadata: record.metadata ?? null,
  };
  return [
    `#### Round ${roundLabel} - ${synthesizer} - SYNTHESIS_ERROR`,
    '',
    canonicalJsonBlock('consensus-synthesis-error', errorDocument),
  ].join('\n');
}

function renderRecord(record: ConsensusRecord) {
  if (record.record_type === 'synthesis') {
    return renderSynthesisRecord(record);
  }
  if (record.record_type === 'synthesis-error') {
    return renderSynthesisErrorRecord(record);
  }
  const verdictDocument: JsonRecord = {
    schema_version: record.schema_version ?? 'v0',
    verdict: record.verdict ?? 'UNKNOWN',
    reasoning: record.reasoning ?? '',
  };
  if ('user_direction' in record) {
    verdictDocument.user_direction = record.user_direction;
  }
  // Intervention rounds (HOST_DECISION / USER_INTERVENTION) carry the routing
  // metadata that genuinely-stuck promotion depends on across resumes:
  // priorHostDecisionForTrigger() matches on escalation_trigger, and defer_to_user
  // is recognized via decision_kind. Persist them so a twice-resumed artifact stays
  // restart-safe (FR5) — without this the canonical block dropped them and a re-fired
  // trigger could route back to the host instead of escalating to the user.
  if ('decision_kind' in record) {
    verdictDocument.decision_kind = record.decision_kind;
  }
  if ('escalation_trigger' in record) {
    verdictDocument.escalation_trigger = record.escalation_trigger;
  }
  if ('critique' in record && record.critique) {
    verdictDocument.critique = record.critique;
  }
  if ('proposed_artifact' in record) {
    verdictDocument.proposed_artifact = record.proposed_artifact;
  }
  if ('concerns' in record) {
    verdictDocument.concerns = record.concerns;
  }

  const roundLabel = record.round_index ?? record.round ?? '?';
  const heading =
    verdictDocument.verdict === 'USER_INTERVENTION'
      ? `#### <user round=${roundLabel}> - USER_INTERVENTION`
      : `#### Round ${roundLabel} - ${record.agent ?? record.provider ?? 'peer'} - ${verdictDocument.verdict}`;
  const parts = [heading];

  if (verdictDocument.verdict === 'USER_INTERVENTION') {
    parts.push(
      '',
      'User direction:',
      sanitizeLogProse(record.user_direction ?? verdictDocument.reasoning),
    );
    parts.push('', canonicalJsonBlock('consensus-verdict', verdictDocument));
    return parts.join('\n');
  }

  if (verdictDocument.reasoning) {
    parts.push('', 'Reasoning:', sanitizeLogProse(verdictDocument.reasoning));
  }

  if (verdictDocument.proposed_artifact) {
    parts.push(
      '',
      'Proposed Artifact:',
      dynamicFence(
        sanitizeProse(verdictDocument.proposed_artifact),
        'markdown',
      ),
    );
  }

  parts.push('', canonicalJsonBlock('consensus-verdict', verdictDocument));
  return parts.join('\n');
}

function yamlScalar(value: unknown) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'null';
  const text = String(value);
  return /^[A-Za-z0-9_.-]+$/u.test(text) ? text : JSON.stringify(text);
}

function renderArtifactFrontmatter(resolution: ArtifactResolution) {
  const fields = {
    consensus_schema_version: resolution.consensus_schema_version,
    status: resolution.status,
    mode: resolution.mode,
    parallel: resolution.parallel,
    iteration: resolution.iteration,
    synthesizer: resolution.synthesizer,
    cold_start: resolution.cold_start,
    agency: resolution.agency,
    peers: resolution.peers,
    host: resolution.host,
    sections_total: resolution.sections.total,
    sections_converged: resolution.sections.converged,
    sections_impasse: resolution.sections.impasse,
    sections_error: resolution.sections.error,
    total_turns: resolution.total_turns,
    total_rounds: resolution.total_rounds,
    peer_calls: resolution.peer_calls,
    synthesis_calls: resolution.synthesis_calls,
    wall_clock_ms: resolution.wall_clock_ms,
    cost_source: resolution.cost_source,
    approximate_cost_usd: resolution.approximate_cost_usd,
    input_path: resolution.input_path,
    run_id: resolution.run_id,
    generated_at: resolution.ended_at,
  };

  return [
    '---',
    ...Object.entries(fields).map(
      ([key, value]) => `${key}: ${yamlScalar(value)}`,
    ),
    '---',
  ].join('\n');
}

function renderResolutionSummary(resolution: ArtifactResolution) {
  const rows = [
    `- Status: ${resolution.status}`,
    `- Mode: ${resolution.mode}`,
    `- Parallel: ${resolution.parallel ? 'true' : 'false'}`,
    `- Agency: ${resolution.agency}`,
    `- Peers: ${resolution.peers.join(', ')}`,
    `- Sections: ${resolution.sections.converged}/${resolution.sections.total} converged; ${resolution.sections.impasse} impasse; ${resolution.sections.escalation ?? 0} escalation; ${resolution.sections.error} error`,
    `- Turns: ${resolution.total_turns}; rounds: ${resolution.total_rounds}`,
    `- Calls: ${resolution.peer_calls} peer; ${resolution.synthesis_calls} synthesis`,
  ];

  if (resolution.subagent_ids.length > 0) {
    rows.push(`- Subagents: ${resolution.subagent_ids.join(', ')}`);
  }

  return rows.join('\n');
}

function tableCell(value: unknown) {
  return sanitizeProse(value).replace(/\|/g, '\\|') || '-';
}

function renderSectionStatesSummary(states: ReturnType<typeof sectionStates>) {
  const rows = [
    '| Section | Status | Turns | Rounds |',
    '| --- | --- | ---: | ---: |',
  ];
  for (const state of states) {
    rows.push(
      `| ${tableCell(state.name)} | ${tableCell(state.status)} | ${state.turns} | ${state.rounds} |`,
    );
  }
  return rows.join('\n');
}

function requireValue(argv: readonly string[], index: number, flag: string) {
  if (index + 1 >= argv.length) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index + 1];
}

function parsePositiveInteger(
  value: string,
  label: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
) {
  const parsed = Number.parseInt(value, 10);
  if (
    !Number.isInteger(parsed) ||
    String(parsed) !== String(value) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parsePeers(value: unknown) {
  const peers = String(value)
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);

  if (peers.length !== 2) {
    throw new Error('--peers must contain exactly two peers');
  }

  for (const peer of peers) {
    validateProviderId(peer, '--peers');
  }

  return peers;
}

function validateProviderId(providerId: unknown, label = 'provider id') {
  if (typeof providerId !== 'string' || !PROVIDER_ID_PATTERN.test(providerId)) {
    throw new Error(
      `${label} "${providerId}" must match ^[a-z][a-z0-9-]{0,31}$`,
    );
  }
  return providerId;
}

// Provider inventory readiness is reported through status strings. Treat
// known-bad statuses as unavailable so PEER_UNAVAILABLE fires during preflight
// with actionable provider CLI guidance. "loading" is tolerated because provider
// CLIs can briefly report a warming state before settling to ready or a terminal
// unavailable status.
const PROVIDER_UNAVAILABLE_STATUSES = new Set([
  'auth_required',
  'error',
  'missing',
  'unavailable',
  'not found',
  'notfound',
  'disabled',
  'offline',
  'unsupported',
]);

function providerEntryAvailable(entry: ProviderInventoryEntry) {
  // Explicit boolean availability wins (injected/test inventories use this shape).
  if (typeof entry.available === 'boolean') {
    return entry.available;
  }
  // Disabled providers are never usable, in either boolean or display-string form.
  if (entry.enabled === false || entry.enabled === 'Disabled') {
    return false;
  }
  if (typeof entry.status === 'string') {
    return !PROVIDER_UNAVAILABLE_STATUSES.has(
      entry.status.trim().toLowerCase(),
    );
  }
  return true;
}

function normalizeProviderInventory(
  providerInventory: ProviderInventoryInput,
): NormalizedProviderInventoryEntry[] {
  const entries = Array.isArray(providerInventory)
    ? providerInventory
    : isJsonRecord(providerInventory)
      ? (providerInventory.providers ?? providerInventory.data ?? [])
      : [];

  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (typeof entry === 'string') {
      return {
        id: validateProviderId(entry, 'provider inventory id'),
        available: true,
      };
    }

    const providerEntry = asProviderInventoryEntry(entry);
    const id = validateProviderId(
      providerEntry.id ?? providerEntry.name ?? providerEntry.provider,
      'provider inventory id',
    );
    const available = providerEntryAvailable(providerEntry);
    return { ...providerEntry, id, available };
  });
}

function markdownLines(markdown: unknown) {
  const normalized = String(markdown ?? '').replace(/\r\n?/g, '\n');
  return normalized.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function markerName(line: string) {
  const match = line.trim().match(/^<!--\s*section:\s*(.*?)\s*-->$/i);
  return match?.[1]?.trim() || null;
}

function headingName(line: string) {
  const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
  if (!match) return null;
  return match[1].replace(/\s+#+\s*$/u, '').trim() || null;
}

function buildSectionsFromBoundaries(
  lines: string[],
  boundaries: { lineIndex: number; name: string }[],
) {
  const sections: ParsedSection[] = [];
  const firstBoundary = boundaries[0];

  if (firstBoundary?.lineIndex > 0) {
    const preamble = lines.slice(0, firstBoundary.lineIndex).join('');
    if (preamble.trim()) {
      sections.push({
        id: slugSectionId('Preamble', sections.length),
        name: 'Preamble',
        original_index: sections.length,
        start_line: 1,
        end_line: firstBoundary.lineIndex,
        markdown: preamble,
      });
    }
  }

  for (const [boundaryIndex, boundary] of boundaries.entries()) {
    const nextBoundary = boundaries[boundaryIndex + 1];
    const markdown = lines
      .slice(boundary.lineIndex, nextBoundary?.lineIndex ?? lines.length)
      .join('');
    sections.push({
      id: slugSectionId(boundary.name, sections.length),
      name: boundary.name,
      original_index: sections.length,
      start_line: boundary.lineIndex + 1,
      end_line: nextBoundary?.lineIndex ?? lines.length,
      markdown,
    });
  }

  return sections;
}

async function defaultRunCommand(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; cwd?: string } = {},
) {
  const spawnTarget = providerCliSpawnTarget(command, args);
  const result = await execFileAsync(spawnTarget.command, spawnTarget.args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 2 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

export function parseWrapperArgs(
  argv: readonly string[],
): ParsedWrapperOptions {
  const parsed: ParsedWrapperOptions = {
    mode: 'sequential',
    inputPath: null,
    goal: '',
    peers: null,
    maxRounds: 12,
    agency: 'moderate',
    iteration: 'alternating',
    synthesizer: null,
    coldStart: 'shared_input',
    output: null,
    resume: null,
    userDirection: null,
    hostDirection: null,
    hostDecisionKind: null,
    runDir: null,
    allowRoot: null,
    failOnSectionError: false,
    skipCorruptSections: [],
    skipAllCorrupt: false,
    yesSkipCorrupt: false,
    prepareParallel: false,
    parallelism: null,
    fanIn: false,
    manifestPath: null,
  };
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--goal':
        parsed.goal = requireValue(argv, index, token);
        index += 1;
        break;
      case '--peers':
        parsed.peers = parsePeers(requireValue(argv, index, token));
        index += 1;
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(
          requireValue(argv, index, token),
          '--max-rounds',
          MAX_ROUNDS_MIN,
          MAX_ROUNDS_MAX,
        );
        index += 1;
        break;
      case '--agency':
        parsed.agency = requireValue(argv, index, token) as AgencyValue;
        index += 1;
        break;
      case '--iteration':
        parsed.iteration = requireValue(
          argv,
          index,
          token,
        ) as IterationModeValue;
        index += 1;
        break;
      case '--synthesizer':
        parsed.synthesizer = validateProviderId(
          requireValue(argv, index, token),
          '--synthesizer',
        );
        index += 1;
        break;
      case '--cold-start':
        parsed.coldStart = requireValue(argv, index, token) as ColdStartValue;
        index += 1;
        break;
      case '--output':
        parsed.output = requireValue(argv, index, token);
        index += 1;
        break;
      case '--resume':
        parsed.resume = requireValue(argv, index, token);
        index += 1;
        break;
      case '--user-direction':
        parsed.userDirection = requireValue(argv, index, token);
        index += 1;
        break;
      case '--host-direction':
        parsed.hostDirection = requireValue(argv, index, token);
        index += 1;
        break;
      case '--host-decision-kind':
        parsed.hostDecisionKind = requireValue(argv, index, token);
        index += 1;
        break;
      case '--run-dir':
        parsed.runDir = requireValue(argv, index, token);
        index += 1;
        break;
      case '--allow-root':
        parsed.allowRoot = requireValue(argv, index, token);
        index += 1;
        break;
      case '--fail-on-section-error':
        parsed.failOnSectionError = true;
        break;
      case '--skip-corrupt-section':
        parsed.skipCorruptSections.push(requireValue(argv, index, token));
        index += 1;
        break;
      case '--skip-all-corrupt':
        parsed.skipAllCorrupt = true;
        break;
      case '--yes-skip-corrupt':
        parsed.yesSkipCorrupt = true;
        break;
      case '--prepare-parallel':
        parsed.prepareParallel = true;
        parsed.mode = 'prepare_parallel';
        break;
      case '--parallelism':
        parsed.parallelism = parsePositiveInteger(
          requireValue(argv, index, token),
          '--parallelism',
          1,
          64,
        );
        index += 1;
        break;
      case '--fan-in':
        parsed.fanIn = true;
        parsed.mode = 'fan_in';
        parsed.manifestPath = requireValue(argv, index, token);
        index += 1;
        break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
    }
  }

  if (parsed.userDirection !== null && parsed.hostDirection !== null) {
    throw new Error(
      '--user-direction and --host-direction are mutually exclusive',
    );
  }

  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  if (!ITERATION_MODES.includes(parsed.iteration as IterationModeValue)) {
    throw invalidIterationModeError(parsed.iteration);
  }

  if (parsed.coldStart === 'independent_draft') {
    throw new Error(
      'consensus-refine supports `shared_input` only because it refines an existing draft',
    );
  }
  if (parsed.coldStart !== 'shared_input') {
    throw new Error(
      'consensus-refine supports `shared_input` only; --cold-start must be shared_input',
    );
  }

  if (parsed.fanIn) {
    if (positionals.length > 0) {
      throw new Error('--fan-in does not accept an input path');
    }
    return parsed;
  }

  if (positionals.length > 1) {
    throw new Error(`unexpected positional argument: ${positionals[1]}`);
  }

  parsed.inputPath = positionals[0] ?? null;
  if (!parsed.inputPath) {
    throw new Error('input path is required');
  }

  return parsed;
}

export async function parseDeliberationArtifactForResume(
  pathOrText: string,
  options: WrapperOptions & {
    stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
    stdout?: NodeJS.WritableStream;
  } = {},
): Promise<ResumeState> {
  const { text, sourcePath } = await readResumePathOrText(pathOrText);
  const frontmatter = parseFrontmatter(text);
  const consensusSchemaVersion = frontmatter.consensus_schema_version;
  // Fail-closed version gate (p05-t05, FR4): only v1 artifacts resume. v0 artifacts
  // are rejected with no migration — they must be completed under v0.1 or restarted.
  if (consensusSchemaVersion !== 'v1') {
    const found = consensusSchemaVersion ?? '(missing)';
    throw resumeDataError(
      `cannot resume consensus_schema_version ${found}: this build resumes only v1 artifacts, and there is no migration from v0. Complete in-flight v0 runs under consensus v0.1 or restart them under v1.`,
      {
        code: 'SCHEMA_VERSION_MISMATCH',
        details: { found: consensusSchemaVersion ?? null, expected: 'v1' },
      },
    );
  }

  const resolutions = extractConsensusJsonBlocks(text, 'consensus-resolution');
  const sectionStatesBlocks = extractConsensusJsonBlocks(
    text,
    'consensus-section-states',
  );
  if (resolutions.length !== 1) {
    throw resumeDataError(
      'resume artifact must contain exactly one consensus-resolution block',
      {
        code: 'RESUME_RESOLUTION_MISSING',
        details: { count: resolutions.length },
      },
    );
  }
  if (
    sectionStatesBlocks.length !== 1 ||
    !Array.isArray(sectionStatesBlocks[0])
  ) {
    throw resumeDataError(
      'resume artifact must contain one consensus-section-states array block',
      {
        code: 'RESUME_SECTION_STATE_MISSING',
        details: { count: sectionStatesBlocks.length },
      },
    );
  }

  const resolution = isJsonRecord(resolutions[0]) ? resolutions[0] : {};
  const resumeSectionStates = sectionStatesBlocks[0] as unknown[];
  const { logSections, unscopedErrors } = extractLogSectionBlocks(text);
  const resumeAgency = resumeAgencyFromMetadata(
    resolution,
    frontmatter,
    options,
  );
  const { sections, errors } = collectResumeValidationErrors(
    resumeSectionStates,
    logSections,
    unscopedErrors,
    {
      peers: Array.isArray(resolution.peers)
        ? resolution.peers.map(String)
        : undefined,
      agency: resumeAgency,
    },
  );
  const { skippedIds, unhandledErrors } = await applyResumeSkipPolicy(
    sections,
    errors,
    options,
  );
  const diagnosticsPath =
    errors.length > 0
      ? await writeResumeErrors(options.runDir, errors, [...skippedIds])
      : null;
  if (unhandledErrors.length > 0) {
    throw corruptResumeError(unhandledErrors, diagnosticsPath);
  }

  return {
    sourcePath,
    consensusSchemaVersion,
    frontmatter,
    resolution,
    sectionStates: resumeSectionStates,
    sections,
    completedSections: sections.filter((section) => section.completed),
    inFlightSections: sections.filter((section) => section.inFlight),
    skippedCorruptSections: sections.filter((section) => section.skipped),
    resumeErrors: errors,
    resumeErrorsPath: diagnosticsPath,
  };
}

export function detectHost(env: NodeJS.ProcessEnv = process.env): HostId {
  if (env.CLAUDECODE || env.CLAUDE_CODE || env.CLAUDECODE_SESSION_ID) {
    return 'claude';
  }
  if (Object.keys(env).some((key) => key.startsWith('CODEX_'))) {
    return 'codex';
  }
  if (Object.keys(env).some((key) => key.startsWith('CURSOR_'))) {
    return 'cursor';
  }
  return 'unknown';
}

export function slugSectionId(name: unknown, index: number) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'section'}-${index}`;
}

export function parseSections(markdown: unknown): ParsedSection[] {
  const lines = markdownLines(markdown);
  const markerBoundaries: { lineIndex: number; name: string }[] = [];
  const headingBoundaries: { lineIndex: number; name: string }[] = [];

  lines.forEach((line, lineIndex) => {
    const sectionMarkerName = markerName(line);
    if (sectionMarkerName) {
      markerBoundaries.push({ lineIndex, name: sectionMarkerName });
      return;
    }

    const sectionHeadingName = headingName(line);
    if (sectionHeadingName) {
      headingBoundaries.push({ lineIndex, name: sectionHeadingName });
    }
  });

  const boundaries =
    markerBoundaries.length > 0 ? markerBoundaries : headingBoundaries;
  if (boundaries.length > 0) {
    return buildSectionsFromBoundaries(lines, boundaries);
  }

  return [
    {
      id: slugSectionId('Document', 0),
      name: 'Document',
      original_index: 0,
      start_line: 1,
      end_line: lines.length,
      markdown: lines.join(''),
    },
  ];
}

function normalizeSequentialOptions(
  options: readonly string[] | WrapperOptions,
): ParsedWrapperOptions {
  const parsed = Array.isArray(options) ? parseWrapperArgs(options) : options;
  return {
    goal: '',
    maxRounds: 12,
    agency: 'moderate',
    iteration: 'alternating',
    coldStart: 'shared_input',
    failOnSectionError: false,
    ...parsed,
  } as ParsedWrapperOptions;
}

function sectionRunDirectory(runDir: string, section: ParsedSection) {
  return path.join(
    runDir,
    'sections',
    `${String(section.original_index + 1).padStart(2, '0')}-${section.id}`,
  );
}

function sectionLookup<T extends { id: string; original_index: number }>(
  sections: T[] | undefined,
) {
  return new Map(
    (sections ?? []).flatMap((section) => [
      [`id:${section.id}`, section],
      [`index:${section.original_index}`, section],
    ]),
  );
}

function sequentialRunSections(
  parsedSections: ParsedSection[],
  resumeState: ResumeState | null,
): ParsedSection[] {
  if (!resumeState) return parsedSections;
  const currentSections = sectionLookup(parsedSections);
  return resumeState.sections.map((resumeSection, index) => {
    const currentSection =
      currentSections.get(`id:${resumeSection.id}`) ??
      currentSections.get(`index:${resumeSection.original_index}`) ??
      null;

    return {
      id: resumeSection.id,
      name: resumeSection.name,
      original_index: resumeSection.original_index ?? index,
      markdown: currentSection?.markdown ?? resumeSection.resumedArtifact ?? '',
    };
  });
}

function loopArgvForSection({
  paths,
  options,
  peers,
  synthesizer = null,
}: LoopInvocationPayload) {
  const argv = [
    '--section-file',
    paths.input,
    '--goal',
    options.goal ?? '',
    '--peers',
    peers.join(','),
    '--max-rounds',
    String(options.maxRounds),
    '--agency',
    options.agency,
    '--iteration',
    options.iteration ?? 'alternating',
  ];
  if (synthesizer) {
    argv.push('--synthesizer', synthesizer);
  }
  argv.push(
    '--output-records',
    paths.records,
    '--output-section',
    paths.output,
    '--output-status',
    paths.status,
  );
  return argv;
}

function parallelismFor(sectionCount: number, requested: number | null) {
  if (requested !== null && requested !== undefined) {
    return Math.min(requested, sectionCount);
  }
  return Math.min(sectionCount, 4);
}

function manifestSectionEntry({
  section,
  paths,
  packetPath,
  loopArgv,
  iterationMode = 'alternating',
  synthesizer = null,
}: {
  section: ParsedSection;
  paths: SectionPaths;
  packetPath: string;
  loopArgv: string[];
  iterationMode?: IterationModeValue;
  synthesizer?: string | null;
}): ParallelManifestEntry {
  return {
    section_id: section.id,
    name: section.name,
    original_index: section.original_index,
    packet_path: packetPath,
    section_file: paths.input,
    output_records: paths.records,
    output_section: paths.output,
    output_status: paths.status,
    subagent_id: `section-runner-${String(section.original_index + 1).padStart(2, '0')}-${section.id}`,
    iteration_mode: iterationMode,
    synthesizer,
    loop_argv: loopArgv,
  };
}

function dispatchInstructions(manifest: ParallelManifest) {
  return {
    phase: 'parallel_dispatch_required',
    manifest: manifest.manifest_path,
    parallelism: manifest.parallelism,
    iteration_mode: manifest.iteration_mode ?? 'alternating',
    synthesizer: manifest.synthesizer ?? null,
    sections: manifest.sections.map((section) => ({
      section_id: section.section_id,
      name: section.name,
      original_index: section.original_index,
      packet_path: section.packet_path,
      subagent_id: section.subagent_id,
      iteration_mode:
        section.iteration_mode ?? manifest.iteration_mode ?? 'alternating',
      synthesizer: section.synthesizer ?? manifest.synthesizer ?? null,
      output_records: section.output_records,
      output_section: section.output_section,
      output_status: section.output_status,
    })),
  };
}

export function renderDeliberationArtifact(runResult: WrapperRunResult) {
  const sections = [...runResult.sections].toSorted(
    (left, right) => left.original_index - right.original_index,
  );
  const status = runResult.status ?? aggregateStatus(sections);
  const states = sectionStates(sections);
  const finalOutput = sections
    .map(sectionOutput)
    .join('\n\n')
    .replace(/\n*$/u, '\n');
  const totalRounds = sections.reduce(
    (sum, section) => sum + (section.status?.rounds ?? 0),
    0,
  );
  const totalTurns = sections.reduce(
    (sum, section) => sum + (section.status?.turns ?? 0),
    0,
  );
  const peerCalls = sections.reduce(
    (sum, section) =>
      sum + (section.status?.peer_calls ?? section.status?.turns ?? 0),
    0,
  );
  const synthesisCalls = sections.reduce(
    (sum, section) => sum + (section.status?.synthesis_calls ?? 0),
    0,
  );
  const resolution: ArtifactResolution = {
    consensus_schema_version: 'v1',
    status,
    mode: runResult.mode ?? 'sequential',
    parallel: Boolean(runResult.parallel),
    iteration: runResult.iteration ?? 'alternating',
    synthesizer: runResult.synthesizer ?? null,
    cold_start: runResult.coldStart ?? 'shared_input',
    agency: runResult.agency,
    peers: runResult.peers,
    host: runResult.host ?? 'unknown',
    max_rounds: runResult.maxRounds,
    sections: {
      total: sections.length,
      converged: countByStatus(sections, 'converged'),
      impasse: countByStatus(sections, 'impasse'),
      escalation: countByStatus(sections, 'escalation'),
      max_rounds: countByStatus(sections, 'max-rounds'),
      oscillation: countByStatus(sections, 'oscillation'),
      error: countByStatus(sections, 'error'),
    },
    total_rounds: totalRounds,
    total_turns: totalTurns,
    peer_calls: peerCalls,
    synthesis_calls: synthesisCalls,
    wall_clock_ms: runResult.wallClockMs ?? null,
    cost_source: 'unavailable',
    approximate_cost_usd: null,
    input_path: runResult.inputPath ?? null,
    run_id:
      runResult.runId ??
      (runResult.runDir ? path.basename(runResult.runDir) : null),
    started_at: runResult.startedAt ?? null,
    ended_at: runResult.endedAt ?? null,
    subagent_ids: sections
      .map((section) => section.subagent_id)
      .filter((id): id is string => Boolean(id)),
  };

  const parts = [
    renderArtifactFrontmatter(resolution),
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    finalOutput,
    '## Resolution',
    '',
    renderResolutionSummary(resolution),
    '',
    canonicalJsonBlock('consensus-resolution', resolution),
    '',
    '## Goal',
    '',
    sanitizeProse(runResult.goal || '(no explicit goal provided)'),
    '',
    '## Section States',
    '',
    renderSectionStatesSummary(states),
    '',
    canonicalJsonBlock('consensus-section-states', states),
    '',
    '## Deliberation Log',
  ];

  for (const section of sections) {
    parts.push(
      '',
      `### ${section.original_index + 1}. ${sanitizeProse(section.name)} (${section.status?.status ?? 'unknown'})`,
      '',
      canonicalJsonBlock('consensus-section-status', section.status ?? {}),
      '',
    );

    for (const record of section.records ?? []) {
      parts.push(renderRecord(record), '');
    }
  }

  return `${parts
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\s+$/u, '')}\n`;
}

function providerCliLoopInvokers({
  env,
  cwd,
  iteration,
}: {
  env: NodeJS.ProcessEnv;
  cwd: string;
  iteration: IterationModeValue;
}): Pick<LoopRunOptions, 'invokePeer' | 'invokeSynthesizer'> {
  return {
    invokePeer: (turn) =>
      invokeProviderCliWithRetry(
        {
          provider: turn.provider,
          schemaPath: turn.schemaPath ?? peerSchemaPathForMode(iteration),
          prompt: turn.prompt,
          env,
          cwd,
        },
        { mode: iteration },
      ),
    invokeSynthesizer: (call) =>
      invokeConsensusProviderCli({
        provider: call.provider,
        schemaPath: call.schemaPath,
        prompt: call.prompt,
        env,
        cwd,
      }),
  };
}

export async function runSequential(
  options: readonly string[] | WrapperOptions,
  runOptions: WrapperRunOptions = {},
) {
  const normalized = normalizeSequentialOptions(options);
  const cwd = path.resolve(normalized.cwd ?? runOptions.cwd ?? process.cwd());
  const env = normalized.env ?? runOptions.env ?? process.env;
  const inputPathValue = normalized.inputPath as string;
  const inputPath = path.isAbsolute(inputPathValue)
    ? inputPathValue
    : path.resolve(cwd, inputPathValue);
  const startedAt = nowIso();
  const startMs = Date.now();
  const markdown = await readInputFile(inputPath);
  const parsedSections = parseSections(markdown);
  const runDir = await resolveRunDir({ ...normalized, cwd });
  const outputPath = await resolveOutputPath({ ...normalized, cwd }, inputPath);
  const resumePath = await resolveResumePath({ ...normalized, cwd });
  const resumeState = resumePath
    ? await parseDeliberationArtifactForResume(resumePath, {
        runDir,
        skipCorruptSections: normalized.skipCorruptSections,
        skipAllCorrupt: normalized.skipAllCorrupt,
        yesSkipCorrupt: normalized.yesSkipCorrupt,
        stdin: runOptions.stdin,
        stdout: runOptions.stdout,
      })
    : null;
  const runWriteRoot = path.resolve(normalized.allowRoot ?? cwd);
  const outputWriteRoot = normalized.output
    ? path.resolve(normalized.allowRoot ?? cwd)
    : path.dirname(inputPath);
  const preflight =
    normalized.preflight === false
      ? { peers: normalized.peers ?? ['claude', 'codex'], warnings: [] }
      : await (normalized.preflight ?? preflightConsensusProviderCli)({
          ...normalized,
          env,
          cwd,
        });
  const peers = normalized.peers ?? preflight.peers;
  const host = preflight.host ?? detectHost(env);
  const { synthesizer } = resolveSynthesizer(
    { ...normalized, peers },
    preflight.providerInventory ?? peers.map((id) => ({ id, available: true })),
  );
  const resumeSections = sectionLookup(resumeState?.sections);
  const runSections = sequentialRunSections(parsedSections, resumeState);
  const sectionResults: SectionResult[] = [];
  const providerCliInvokers = providerCliLoopInvokers({
    env,
    cwd,
    iteration: normalized.iteration,
  });

  for (const section of runSections) {
    const sectionDir = sectionRunDirectory(runDir, section);
    const paths = {
      input: path.join(sectionDir, 'section.md'),
      records: path.join(sectionDir, 'records.json'),
      output: path.join(sectionDir, 'output.md'),
      status: path.join(sectionDir, 'status.json'),
    };
    const resumeSection =
      resumeSections.get(`id:${section.id}`) ??
      resumeSections.get(`index:${section.original_index}`) ??
      null;
    const sectionInput = resumeSection?.resumedArtifact ?? section.markdown;

    await Promise.all([
      confineWrite(paths.records, runWriteRoot),
      confineWrite(paths.output, runWriteRoot),
      confineWrite(paths.status, runWriteRoot),
    ]);
    await atomicWriteFile(paths.input, sectionInput, {
      rootPath: runWriteRoot,
    });

    if (resumeSection?.skipped) {
      const status: SectionStatus = {
        schema_version: 'v1',
        status: 'skipped',
        termination_reason: 'corrupt_resume_skipped',
        turns: 0,
        rounds: 0,
        final_artifact_hash: hashArtifact(section.markdown),
        resume_errors: resumeSection.corruptErrors,
      };
      await Promise.all([
        atomicWriteFile(
          paths.records,
          `${JSON.stringify(resumeSection.records, null, 2)}\n`,
          { rootPath: runWriteRoot },
        ),
        atomicWriteFile(paths.output, section.markdown, {
          rootPath: runWriteRoot,
        }),
        atomicWriteFile(paths.status, `${JSON.stringify(status, null, 2)}\n`, {
          rootPath: runWriteRoot,
        }),
      ]);
      sectionResults.push({
        ...section,
        paths,
        output: section.markdown,
        status,
        records: resumeSection.records,
      });
      continue;
    }

    if (resumeSection?.completed) {
      await Promise.all([
        atomicWriteFile(
          paths.records,
          `${JSON.stringify(resumeSection.records, null, 2)}\n`,
          { rootPath: runWriteRoot },
        ),
        atomicWriteFile(paths.output, sectionInput, { rootPath: runWriteRoot }),
        atomicWriteFile(
          paths.status,
          `${JSON.stringify(resumeSection.status, null, 2)}\n`,
          { rootPath: runWriteRoot },
        ),
      ]);
      sectionResults.push({
        ...section,
        paths,
        output: sectionInput,
        status: resumeSection.status,
        records: resumeSection.records,
      });
      continue;
    }

    // Host-direction re-entry: validate routing against the pending escalation
    // before re-invoking the loop (fail-closed). Only applied to the in-flight
    // escalated section being resumed.
    let hostDirection: string | undefined;
    let hostDecisionKind: string | undefined;
    let escalationTrigger: LoopEscalationTrigger | null = null;
    if (normalized.hostDirection && resumeSection?.inFlight) {
      const escalation = assertHostDirectionRoutable(resumeSection);
      hostDirection = normalized.hostDirection;
      hostDecisionKind = normalized.hostDecisionKind ?? 'direct';
      escalationTrigger = escalation.trigger as LoopEscalationTrigger;
    }

    try {
      const loopRunOptions = {
        env,
        cwd,
        invokePeer:
          normalized.invokePeer ??
          runOptions.invokePeer ??
          providerCliInvokers.invokePeer,
        invokeSynthesizer:
          normalized.invokeSynthesizer ??
          runOptions.invokeSynthesizer ??
          providerCliInvokers.invokeSynthesizer,
        initialRecords: asLoopInitialRecords(resumeSection?.records),
        initialArtifact: sectionInput,
        userDirection: resumeSection?.inFlight
          ? (normalized.userDirection ?? undefined)
          : undefined,
        hostDirection,
        hostDecisionKind,
        escalationTrigger,
      } satisfies LoopRunOptions;
      const result = await runConsensusLoop(
        loopArgvForSection({
          section,
          paths,
          options: normalized,
          peers,
          synthesizer,
        }),
        loopRunOptions,
      );
      sectionResults.push({
        ...section,
        paths,
        output: result.output,
        status: result.status,
        records: result.records,
      });
    } catch (error) {
      const records = await readJsonIfPresent<ConsensusRecord[]>(
        paths.records,
        [],
      );
      const persistedStatus = await readJsonIfPresent<SectionStatus | null>(
        paths.status,
        null,
      );
      const recoveredOutput =
        (await readTextIfPresent(paths.output)) ??
        latestRevisedOutput(records, section.markdown);
      const status: SectionStatus = {
        ...fallbackErrorStatus(error, records, peers.length),
        ...persistedStatus,
      };
      if (!status.error) {
        status.error = asErrorLike(error).message;
      }
      sectionResults.push({
        ...section,
        paths,
        output: recoveredOutput,
        status,
        records,
      });
    }
  }

  const endedAt = nowIso();
  const runResult: WrapperRunResult = {
    mode: 'sequential',
    parallel: false,
    inputPath,
    outputPath,
    resumePath,
    resumeState,
    runDir,
    goal: normalized.goal,
    peers,
    host,
    agency: normalized.agency,
    iteration: normalized.iteration ?? 'alternating',
    synthesizer,
    coldStart: normalized.coldStart ?? 'shared_input',
    maxRounds: normalized.maxRounds,
    startedAt,
    endedAt,
    wallClockMs: Date.now() - startMs,
    sections: sectionResults,
  };
  runResult.status = aggregateStatus(sectionResults);

  const artifact = renderDeliberationArtifact(runResult);
  await atomicWriteFile(outputPath, artifact, { rootPath: outputWriteRoot });

  // Emit escalation_required for any escalated section. Escalation is a terminal
  // status + resume (design §5): the wrapper resolves the full divergent text
  // into the event and exits, mirroring impasse's success-with-partial semantics.
  if (runOptions.stdout) {
    for (const section of escalatedSections(sectionResults)) {
      const event = buildEscalationEvent(section, { artifactPath: outputPath });
      if (event) {
        writeJsonl(runOptions.stdout, 'escalation_required', event);
      }
    }
  }

  const failedSections = failingSections(sectionResults);
  if (normalized.failOnSectionError && failedSections.length > 0) {
    throw new ConsensusError(
      `section error or impasse in ${failedSections.length} section(s)`,
      {
        code: 'SECTION_ERROR',
        exitCode: EXIT_CODES.SECTION_ERROR,
        details: {
          output_path: outputPath,
          run_dir: runDir,
          failing_sections: failedSections,
        },
      },
    );
  }
  return { ...runResult, artifact };
}

export async function prepareParallelRun(
  options: readonly string[] | WrapperOptions,
  runOptions: WrapperRunOptions = {},
) {
  const normalized = normalizeSequentialOptions(options);
  const cwd = path.resolve(normalized.cwd ?? runOptions.cwd ?? process.cwd());
  const env = normalized.env ?? runOptions.env ?? process.env;
  const inputPathValue = normalized.inputPath as string;
  const inputPath = path.isAbsolute(inputPathValue)
    ? inputPathValue
    : path.resolve(cwd, inputPathValue);
  const startedAt = nowIso();
  const markdown = await readInputFile(inputPath);
  const parsedSections = parseSections(markdown);
  const runDir = await resolveRunDir({ ...normalized, cwd });
  const outputPath = await resolveOutputPath({ ...normalized, cwd }, inputPath);
  const runWriteRoot = path.resolve(normalized.allowRoot ?? cwd);
  const preflight =
    normalized.preflight === false
      ? { peers: normalized.peers ?? ['claude', 'codex'], warnings: [] }
      : await (normalized.preflight ?? preflightConsensusProviderCli)({
          ...normalized,
          env,
          cwd,
        });
  const peers = normalized.peers ?? preflight.peers;
  const host = preflight.host ?? detectHost(env);
  // Resolve the synthesizer (FR6) so parallel_synthesized section runners receive
  // the same identity the sequential path would (p05-t04). Outside synthesized mode
  // this is null and warn-and-ignored.
  const { synthesizer } = resolveSynthesizer(
    { ...normalized, peers },
    preflight.providerInventory ?? normalized.providerInventory ?? [],
  );
  const iterationMode = normalized.iteration ?? 'alternating';
  const parallelism = parallelismFor(
    parsedSections.length,
    normalized.parallelism,
  );
  const sections: ParallelManifestEntry[] = [];

  for (const section of parsedSections) {
    const sectionDir = sectionRunDirectory(runDir, section);
    const paths = {
      input: path.join(sectionDir, 'section.md'),
      records: path.join(sectionDir, 'records.json'),
      output: path.join(sectionDir, 'output.md'),
      status: path.join(sectionDir, 'status.json'),
    };
    const packetPath = path.join(sectionDir, 'packet.json');
    const loopArgv = loopArgvForSection({
      section,
      paths,
      options: normalized,
      peers,
      synthesizer,
    });

    await Promise.all([
      confineWrite(paths.input, runWriteRoot),
      confineWrite(paths.records, runWriteRoot),
      confineWrite(paths.output, runWriteRoot),
      confineWrite(paths.status, runWriteRoot),
      confineWrite(packetPath, runWriteRoot),
    ]);

    const packet = {
      consensus_schema_version: 'v1',
      packet_type: 'consensus-section-runner',
      manifest_path: path.join(runDir, 'manifest.json'),
      section_id: section.id,
      name: section.name,
      original_index: section.original_index,
      section_file: paths.input,
      goal: normalized.goal ?? '',
      peers,
      max_rounds: normalized.maxRounds,
      agency: normalized.agency,
      iteration_mode: iterationMode,
      synthesizer,
      output_records: paths.records,
      output_section: paths.output,
      output_status: paths.status,
      loop_argv: loopArgv,
    };

    await atomicWriteFile(paths.input, section.markdown, {
      rootPath: runWriteRoot,
    });
    await atomicWriteFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, {
      rootPath: runWriteRoot,
    });
    sections.push(
      manifestSectionEntry({
        section,
        paths,
        packetPath,
        loopArgv,
        iterationMode,
        synthesizer,
      }),
    );
  }

  const manifestPath = path.join(runDir, 'manifest.json');
  await confineWrite(manifestPath, runWriteRoot);
  const manifest: ParallelManifest = {
    consensus_schema_version: 'v1',
    manifest_type: 'consensus-parallel-run',
    mode: 'parallel',
    status: 'prepared',
    created_at: startedAt,
    input_path: inputPath,
    output_path: outputPath,
    run_dir: runDir,
    goal: normalized.goal ?? '',
    peers,
    host,
    max_rounds: normalized.maxRounds,
    agency: normalized.agency,
    iteration_mode: iterationMode,
    synthesizer,
    parallelism,
    sections,
    manifest_path: manifestPath,
  };

  await atomicWriteFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { rootPath: runWriteRoot },
  );
  const dispatchEvent = dispatchInstructions(manifest);

  return {
    mode: 'prepare_parallel',
    parallel: true,
    status: 'prepared',
    inputPath,
    outputPath,
    runDir,
    manifestPath,
    goal: normalized.goal ?? '',
    peers,
    host,
    agency: normalized.agency,
    maxRounds: normalized.maxRounds,
    parallelism,
    sections,
    dispatchEvent,
  };
}

export async function fanInParallelRun(
  manifestPath: string,
  options: WrapperOptions = {},
) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const trustedRoot = path.resolve(options.allowRoot ?? cwd);
  const resolvedManifestPath = resolveManifestPathValue(manifestPath, cwd);
  if (!inside(trustedRoot, resolvedManifestPath)) {
    throw pathConfinementError(
      'manifest_path',
      resolvedManifestPath,
      trustedRoot,
    );
  }
  await assertPathResolvesInside(
    trustedRoot,
    resolvedManifestPath,
    'manifest_path',
    pathConfinementError,
  );
  const startedAt = nowIso();
  const startMs = Date.now();
  const manifest = await normalizeParallelManifest(
    await readJsonFile(resolvedManifestPath),
    {
      cwd,
      trustedRoot,
      manifestPath: resolvedManifestPath,
    },
  );
  const sections: SectionResult[] = [];

  for (const entry of manifest.sections ?? []) {
    const errors: ResumeValidationError[] = [];
    let output: string | null = null;
    let records: ConsensusRecord[] = [];
    let status: SectionStatus | null = null;

    try {
      output = await readFile(entry.output_section, 'utf8');
    } catch (error) {
      errors.push({
        code: 'missing output file',
        path: entry.output_section,
        message: asErrorLike(error).message ?? String(error),
      });
    }

    try {
      const parsedRecords = await readJsonFile(entry.output_records);
      if (!Array.isArray(parsedRecords)) {
        errors.push({
          code: 'malformed result JSON',
          path: entry.output_records,
          message: 'records file must contain a JSON array',
        });
        records = [];
      } else {
        records = parsedRecords.map(asConsensusRecord);
      }
    } catch (error) {
      errors.push({
        code: 'malformed result JSON',
        path: entry.output_records,
        message: asErrorLike(error).message ?? String(error),
      });
      records = [];
    }

    try {
      status = asSectionStatus(await readJsonFile(entry.output_status));
    } catch (error) {
      errors.push({
        code: 'malformed result JSON',
        path: entry.output_status,
        message: asErrorLike(error).message ?? String(error),
      });
      status = null;
    }

    if (
      status?.status === 'timeout' ||
      status?.termination_reason === 'section_timeout'
    ) {
      errors.push({
        code: 'section_timeout',
        path: entry.output_status,
        message: 'section runner reported timeout',
      });
    }

    if (status?.status === 'error') {
      errors.push({
        code: 'section_error',
        path: entry.output_status,
        message:
          status.error ??
          status.termination_reason ??
          'section runner reported error',
      });
    }

    if (errors.length > 0) {
      const original = (await readTextIfPresent(entry.section_file)) ?? '';
      const marker = {
        consensus_schema_version: 'v1',
        section_id: entry.section_id,
        subagent_id: entry.subagent_id,
        status_path: entry.output_status,
        errors,
      };
      output = `${original.replace(/\n*$/u, '\n')}\n${canonicalJsonBlock('section-error', marker)}\n`;
      status = {
        schema_version: 'v1',
        ...status,
        status: 'error',
        termination_reason: status?.termination_reason ?? errors[0].code,
        turns: status?.turns ?? records.length,
        rounds: status?.rounds ?? 0,
        error: errors
          .map((error) => `${error.code}: ${error.message}`)
          .join('; '),
        parallel_errors: errors,
      };
    }

    sections.push({
      id: entry.section_id,
      name: entry.name,
      original_index: entry.original_index,
      subagent_id: entry.subagent_id,
      paths: {
        input: entry.section_file,
        records: entry.output_records,
        output: entry.output_section,
        status: entry.output_status,
        packet: entry.packet_path,
      },
      output,
      records,
      status,
    });
  }

  const endedAt = nowIso();
  const runResult: WrapperRunResult = {
    mode: 'parallel',
    parallel: true,
    inputPath: manifest.input_path,
    outputPath: manifest.output_path,
    runDir: manifest.run_dir,
    manifestPath: resolvedManifestPath,
    goal: manifest.goal,
    peers: manifest.peers,
    host: manifest.host ?? 'unknown',
    agency: manifest.agency,
    iteration: manifest.iteration_mode ?? 'alternating',
    synthesizer: manifest.synthesizer ?? null,
    maxRounds: manifest.max_rounds,
    startedAt,
    endedAt,
    wallClockMs: Date.now() - startMs,
    sections,
  };
  runResult.status = aggregateParallelStatus(sections);

  const artifact = renderDeliberationArtifact(runResult);
  await atomicWriteFile(manifest.output_path, artifact, {
    rootPath: manifest.output_write_root,
  });
  const failedSections = failingSections(sections);
  if (options.failOnSectionError && failedSections.length > 0) {
    throw new ConsensusError(
      `section error or impasse in ${failedSections.length} section(s)`,
      {
        code: 'SECTION_ERROR',
        exitCode: EXIT_CODES.SECTION_ERROR,
        details: {
          output_path: manifest.output_path,
          run_dir: manifest.run_dir,
          manifest_path: resolvedManifestPath,
          failing_sections: failedSections,
        },
      },
    );
  }
  return { ...runResult, artifact };
}

export function resolvePeers(
  options: Pick<WrapperOptions, 'peers'> = {},
  host: HostId = 'unknown',
  providerInventory: ProviderInventoryInput = [],
) {
  const defaultPeers =
    host === 'codex' ? ['codex', 'claude'] : ['claude', 'codex'];
  const peers = options.peers ?? defaultPeers;
  const inventory = normalizeProviderInventory(providerInventory);
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const missing: string[] = [];
  const unavailable: string[] = [];

  for (const peer of peers) {
    const entry = byId.get(peer);
    if (!entry) {
      missing.push(peer);
    } else if (entry.available === false) {
      unavailable.push(peer);
    }
  }

  if (missing.length > 0) {
    const error: AnnotatedError = new Error(
      `Missing peers in provider inventory: ${missing.join(', ')}. Verify configured providers with "consensus provider ls --json".`,
    );
    error.code = 'PEER_UNAVAILABLE';
    throw error;
  }

  if (unavailable.length > 0) {
    const error: AnnotatedError = new Error(
      `Consensus providers are unavailable: ${unavailable.join(', ')}.`,
    );
    error.code = 'PEER_UNAVAILABLE';
    throw error;
  }

  return { peers, inventory };
}

/**
 * Resolve the per-run synthesizer (FR6). Meaningful only in parallel_synthesized
 * mode: outside it, an explicit --synthesizer is warned-and-ignored. Inside it the
 * synthesizer defaults to the first peer and any explicit override must be present
 * in the provider inventory (SYNTHESIZER_UNAVAILABLE otherwise).
 */
export function resolveSynthesizer(
  options: Pick<WrapperOptions, 'iteration' | 'peers' | 'synthesizer'> = {},
  providerInventory: ProviderInventoryInput = [],
) {
  const warnings: JsonRecord[] = [];
  const requested = options.synthesizer ?? null;

  if (options.iteration !== 'parallel_synthesized') {
    if (requested) {
      warnings.push({
        code: 'SYNTHESIZER_IGNORED',
        level: 'warning',
        synthesizer: requested,
        iteration: options.iteration ?? 'alternating',
        message: `--synthesizer "${requested}" is ignored outside parallel_synthesized mode.`,
      });
    }
    return { synthesizer: null, warnings };
  }

  const peers = options.peers ?? [];
  const synthesizer = requested ?? peers[0] ?? null;

  if (!synthesizer) {
    throw new ConsensusError(
      'no synthesizer could be resolved (no peers available)',
      {
        code: 'SYNTHESIZER_UNAVAILABLE',
        exitCode: EXIT_CODES.CONFIG,
        details: { requested, peers },
      },
    );
  }

  const inventory = normalizeProviderInventory(providerInventory);
  const entry = inventory.find((candidate) => candidate.id === synthesizer);
  if (!entry || entry.available === false) {
    throw new ConsensusError(
      `Synthesizer "${synthesizer}" is not an available provider in the provider CLI inventory. Verify configured providers with "consensus provider ls --json".`,
      {
        code: 'SYNTHESIZER_UNAVAILABLE',
        exitCode: EXIT_CODES.CONFIG,
        details: { synthesizer },
      },
    );
  }

  return { synthesizer, warnings };
}

function providerCliUnavailableError(
  providers: NormalizedProviderInventoryEntry[],
  selected: string[],
) {
  const byId = new Map(providers.map((entry) => [entry.id, entry]));
  const details = selected.map((id) => {
    const entry = byId.get(id);
    return {
      id,
      status: String(entry?.status ?? (entry ? 'unavailable' : 'missing')),
    };
  });
  const summary = details
    .map((entry) => `${entry.id} (${entry.status})`)
    .join(', ');
  return new ConsensusError(
    `Consensus providers are unavailable: ${summary}. Run "consensus preflight --json --provider <id>" and resolve provider authentication or availability before retrying.`,
    {
      code: 'PEER_UNAVAILABLE',
      exitCode: EXIT_CODES.CONFIG,
      details: { providers: details },
    },
  );
}

function resolveProviderCliPeers(
  options: Pick<WrapperOptions, 'peers'> = {},
  host: HostId = 'unknown',
  providerInventory: ProviderInventoryInput = [],
) {
  const defaultPeers =
    host === 'codex' ? ['codex', 'claude'] : ['claude', 'codex'];
  const peers = options.peers ?? defaultPeers;
  const inventory = normalizeProviderInventory(providerInventory);
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const unavailable = peers.filter(
    (peer) => byId.get(peer)?.available !== true,
  );

  if (unavailable.length > 0) {
    throw providerCliUnavailableError(inventory, unavailable);
  }

  return { peers, inventory };
}

function providerInventoryForConsensusConfig(
  providerInventory: readonly NormalizedProviderInventoryEntry[],
): ConsensusProviderInventoryEntry[] {
  return providerInventory.map((entry) => {
    const status =
      entry.available === true
        ? 'ready'
        : typeof entry.status === 'string'
          ? entry.status
          : 'unavailable';
    return { id: entry.id, status } as ConsensusProviderInventoryEntry;
  });
}

async function resolveConfiguredProviderCliPeers({
  options,
  host,
  env,
  cwd,
  providerInventory,
}: {
  options: Pick<WrapperOptions, 'peers'>;
  host: HostId;
  env: NodeJS.ProcessEnv;
  cwd: string;
  providerInventory: NormalizedProviderInventoryEntry[];
}) {
  if (options.peers) {
    return resolveProviderCliPeers(options, host, providerInventory);
  }

  const composition = await resolveConsensusComposition({
    workflow: 'convergence',
    cwd,
    env,
    inventory: providerInventoryForConsensusConfig(providerInventory),
  });
  const peerOptions =
    composition.source === 'built-in'
      ? {}
      : { peers: composition.agents.map((agent) => agent.provider) };
  return resolveProviderCliPeers(peerOptions, host, providerInventory);
}

function parseProviderCliEnvelope(stdout: string, label: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch (error) {
    throw new Error(
      `consensus ${label} output was not valid JSON: ${asErrorLike(error).message}`,
      { cause: error },
    );
  }

  if (!isJsonRecord(parsed) || parsed.schema_version !== 'v1') {
    throw new Error(`consensus ${label} output was not a v1 JSON envelope`);
  }
  return parsed;
}

export async function preflightConsensusProviderCli(
  options: Pick<
    WrapperOptions,
    'runCommand' | 'env' | 'cwd' | 'peers' | 'iteration' | 'synthesizer'
  > = {},
): Promise<PreflightResult> {
  const runCommand: CommandRunner = options.runCommand ?? defaultRunCommand;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const command = requireConsensusCliPath({ env });

  let inventoryOutput: CommandRunnerResult;
  try {
    inventoryOutput = await runCommand(command, ['provider', 'ls', '--json'], {
      env,
      cwd,
    });
  } catch (error) {
    const details = asErrorLike(error);
    if (
      details.code === 'ENOENT' ||
      /ENOENT|not found/i.test(details.message ?? '')
    ) {
      throw consensusProviderCliMissingError({
        attemptedPaths: [command],
        cause: error,
      });
    }
    throw error;
  }

  const inventoryEnvelope = parseProviderCliEnvelope(
    inventoryOutput.stdout,
    'provider inventory',
  );
  const providerInventory = normalizeProviderInventory(
    inventoryEnvelope.providers,
  );
  const host = detectHost(env);
  const resolved = await resolveConfiguredProviderCliPeers({
    options,
    host,
    env,
    cwd,
    providerInventory,
  });
  const { synthesizer } = resolveSynthesizer(
    {
      iteration: options.iteration ?? 'alternating',
      synthesizer: options.synthesizer ?? null,
      peers: resolved.peers,
    },
    resolved.inventory,
  );
  const providersToPreflight = [
    ...new Set([...resolved.peers, ...(synthesizer ? [synthesizer] : [])]),
  ];

  for (const peer of providersToPreflight) {
    const preflightOutput = await runCommand(
      command,
      ['preflight', '--json', '--provider', peer],
      { env, cwd },
    );
    const preflightEnvelope = parseProviderCliEnvelope(
      preflightOutput.stdout,
      `${peer} preflight`,
    );
    if (preflightEnvelope.usable !== true) {
      throw providerCliUnavailableError(
        normalizeProviderInventory(preflightEnvelope.providers),
        [peer],
      );
    }
  }

  return {
    ok: true,
    version: 'provider-cli',
    providerInventory: resolved.inventory,
    host,
    peers: resolved.peers,
    warnings: [],
  };
}

export async function runWrapperCli(
  argv: readonly string[],
  options: WrapperRunOptions = {},
) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  try {
    const parsed = parseWrapperArgs(argv);
    writeJsonl(stdout, 'run_started', {
      mode: parsed.mode,
      input_path: parsed.inputPath,
      manifest_path: parsed.manifestPath,
      iteration_mode: parsed.iteration ?? 'alternating',
      calls_per_round: callsPerRound(
        (parsed.iteration ?? 'alternating') as IterationModeValue,
      ),
    });

    if (parsed.mode === 'prepare_parallel') {
      const result = await prepareParallelRun({
        ...parsed,
        env,
        cwd,
        preflight: options.preflight,
      });
      writeJsonl(stdout, 'parallel_dispatch_required', result.dispatchEvent);
      writeJsonl(stdout, 'run_completed', {
        status: result.status,
        manifest_path: result.manifestPath,
        run_dir: result.runDir,
        sections: result.sections.length,
      });
      return 0;
    }

    if (parsed.mode === 'fan_in') {
      const result = await fanInParallelRun(parsed.manifestPath as string, {
        env,
        cwd,
        allowRoot: parsed.allowRoot,
        failOnSectionError: parsed.failOnSectionError,
      });
      writeJsonl(stdout, 'run_completed', {
        status: result.status,
        output_path: result.outputPath,
        run_dir: result.runDir,
        sections: result.sections.length,
      });
      return 0;
    }

    if (parsed.mode !== 'sequential') {
      throw new ConsensusError(
        `${parsed.mode} is not implemented in Phase 3 prepare`,
        {
          code: 'MODE_NOT_IMPLEMENTED',
          exitCode: EXIT_CODES.CONFIG,
        },
      );
    }

    const result = await runSequential(
      { ...parsed, env, cwd, preflight: options.preflight },
      { stdin: options.stdin ?? process.stdin, stdout },
    );
    writeJsonl(stdout, 'run_completed', {
      status: result.status,
      output_path: result.outputPath,
      run_dir: result.runDir,
      sections: result.sections.length,
      sections_escalated: result.sections.filter(
        (section) => section.status?.status === 'escalation',
      ).length,
    });
    return 0;
  } catch (error) {
    const exitCode = exitCodeForError(error);
    const details = asErrorLike(error);
    writeJsonl(stdout, 'error', {
      code: details.code ?? 'ERROR',
      exit_code: exitCode,
      message: details.message ?? String(error),
      ...(details.details === undefined ? {} : { details: details.details }),
    });
    stderr.write(`${renderHumanError(error, env)}\n`);
    return exitCode;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runWrapperCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
