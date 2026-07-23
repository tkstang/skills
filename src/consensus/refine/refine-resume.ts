import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import {
  ConsensusError,
  EXIT_CODES,
  hashArtifact,
} from '../core/consensus-loop.js';
import { sectionStates } from './refine-render.js';
import {
  asConsensusRecord,
  asConsensusRecords,
  asErrorLike,
  asSectionStatus,
  consensusBlockPattern,
  isJsonRecord,
  nowIso,
  syncPathIfAvailable,
} from './refine-shared.js';
import type {
  AgencyValue,
  ConsensusRecord,
  JsonRecord,
  ResumeLogSection,
  ResumeState,
  ResumeValidationError,
  SectionResult,
  TryJsonBlockResult,
  WrapperOptions,
} from './refine-types.js';

const STRICT_RESUME_HASH_OPTIONS = Object.freeze({
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false,
});

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
