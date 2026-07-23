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
  parseWrapperArgs,
  normalizeProviderInventory,
  resolveSynthesizer,
} from './refine-args.js';

export {
  PROVIDER_ID_PATTERN,
  parseWrapperArgs,
  resolvePeers,
  resolveSynthesizer,
} from './refine-args.js';

import {
  parseSections,
  normalizeSequentialOptions,
  sectionRunDirectory,
  sectionLookup,
  sequentialRunSections,
  loopArgvForSection,
  parallelismFor,
  manifestSectionEntry,
  dispatchInstructions,
} from './refine-sections.js';

export { slugSectionId, parseSections } from './refine-sections.js';

import {
  canonicalJsonBlock,
  latestRevisedOutput,
  fallbackErrorStatus,
  aggregateStatus,
  aggregateParallelStatus,
  renderDeliberationArtifact,
} from './refine-render.js';

export { renderDeliberationArtifact } from './refine-render.js';

import { parseDeliberationArtifactForResume } from './refine-resume.js';

export { parseDeliberationArtifactForResume } from './refine-resume.js';

import {
  pathConfinementError,
  resolveManifestPathValue,
  assertPathResolvesInside,
  normalizeParallelManifest,
} from './refine-manifest.js';

const execFileAsync = promisify(execFile);

function asLoopInitialRecords(records: ConsensusRecord[] | undefined) {
  return (records ?? []) as LoopInitialRecords;
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
