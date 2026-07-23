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
  AttemptSummary,
  ConsensusCliRunEnvelope,
  ConsensusCliRunFailure,
  ProviderDiagnostics,
  ProviderErrorCode,
} from '../provider-cli/types.js';
import { parsePeers, parsePositiveInteger } from '../shared/cli-helpers.js';

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

function outputCapError(streamName: 'stdout' | 'stderr', capBytes: number) {
  return new ConsensusError(
    `${streamName} exceeded subprocess output cap (${capBytes} bytes)`,
    {
      code: 'SUBPROCESS_OUTPUT_CAP',
      exitCode: EXIT_CODES.CONFIG,
      details: { stream: streamName, cap_bytes: capBytes },
    },
  );
}

export const CONSENSUS_SHARED_CLI_RELATIVE_PATH = path.join(
  '.consensus',
  'consensus.mjs',
);

export function consensusSharedCliPath(homeDir = os.homedir()) {
  return path.join(homeDir, CONSENSUS_SHARED_CLI_RELATIVE_PATH);
}

function defaultConsensusCliPath() {
  return fileURLToPath(new URL('./consensus.mjs', import.meta.url));
}

export function resolveConsensusCliPathDetails({
  consensusCliPath,
  env = process.env,
  defaultCliPath = defaultConsensusCliPath(),
}: ConsensusCliPathOptions = {}): ConsensusCliResolution {
  if (consensusCliPath) {
    return { status: 'resolved', source: 'explicit', path: consensusCliPath };
  }

  if (env.CONSENSUS_CLI_PATH) {
    return {
      status: 'resolved',
      source: 'env',
      path: env.CONSENSUS_CLI_PATH,
    };
  }

  const sharedCliPath = consensusSharedCliPath(env.HOME || os.homedir());
  const attemptedPaths = [defaultCliPath, sharedCliPath];

  if (existsSync(defaultCliPath)) {
    return { status: 'resolved', source: 'plugin', path: defaultCliPath };
  }

  if (existsSync(sharedCliPath)) {
    return { status: 'resolved', source: 'shared-home', path: sharedCliPath };
  }

  return { status: 'missing', attemptedPaths };
}

export function resolveConsensusCliPath(
  options: ConsensusCliPathOptions = {},
): string {
  const resolution = resolveConsensusCliPathDetails(options);
  if (resolution.status === 'resolved') return resolution.path;
  return resolution.attemptedPaths[0];
}

export function consensusProviderCliMissingError({
  attemptedPaths,
  cause,
}: {
  attemptedPaths: readonly string[];
  cause?: unknown;
}) {
  return new ConsensusError(
    'Consensus provider CLI is missing. Install the consensus plugin, or run the pinned install.sh installer from the README alternative-install section to provision ~/.consensus/consensus.mjs.',
    {
      code: 'CONSENSUS_PROVIDER_CLI_MISSING',
      exitCode: EXIT_CODES.CONFIG,
      cause,
      details: { attemptedPaths: [...new Set(attemptedPaths)] },
    },
  );
}

export function requireConsensusCliPath(
  options: ConsensusCliPathOptions = {},
): string {
  const resolution = resolveConsensusCliPathDetails(options);
  if (resolution.status === 'resolved') return resolution.path;
  throw consensusProviderCliMissingError({
    attemptedPaths: resolution.attemptedPaths,
  });
}

export function providerCliSpawnTarget(command: string, args: string[]) {
  if (path.extname(command) === '.mjs') {
    return { command: process.execPath, args: [command, ...args] };
  }
  return { command, args };
}

// Twin: src/consensus/panel/consensus-panel.ts has an independently
// maintained copy of this function. Keep both in sync — subprocess-runner
// unification is explicitly deferred, out of scope for both the subprocess
// hardening and cli-helper consolidation plans.
export function runProviderCliCommand(
  command: string,
  args: string[],
  options: ProviderCliCommandRunnerOptions = {},
): Promise<ProviderCliCommandRunnerResult> {
  if (path.extname(command) === '.mjs' && !existsSync(command)) {
    return Promise.reject(
      consensusProviderCliMissingError({
        attemptedPaths: [
          command,
          consensusSharedCliPath(options.env?.HOME || os.homedir()),
        ],
      }),
    );
  }

  return new Promise((resolve, reject) => {
    const spawnTarget = providerCliSpawnTarget(command, args);
    const child = spawn(spawnTarget.command, spawnTarget.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let capError: ConsensusError | null = null;
    let timedOut = false;
    let settled = false;
    let deadlineTimer: NodeJS.Timeout | undefined;
    let killEscalationTimer: NodeJS.Timeout | undefined;
    let finalResolutionTimer: NodeJS.Timeout | undefined;

    function clearDeadlineTimers() {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      if (killEscalationTimer) clearTimeout(killEscalationTimer);
      if (finalResolutionTimer) clearTimeout(finalResolutionTimer);
    }

    function settleResolve(value: ProviderCliCommandRunnerResult) {
      if (settled) return;
      settled = true;
      clearDeadlineTimers();
      resolve(value);
    }

    function settleReject(error: unknown) {
      if (settled) return;
      settled = true;
      clearDeadlineTimers();
      reject(error);
    }

    // Safety net for a killed child whose stdio pipes were inherited by a
    // descendant (e.g. a provider CLI that backgrounds a helper process): the
    // pipes' write ends can stay open after the child dies, so 'close' never
    // fires. Force settlement instead of hanging forever, mirroring
    // subprocess.ts's finalResolutionMs. Shared by BOTH kill paths — the
    // optional-timeout escalation and the output-cap breach below — so a cap
    // kill is bounded even when no timeoutMs deadline is configured.
    // Idempotent: the first scheduler wins; a second caller (e.g. a timeout
    // firing after a cap kill already scheduled this) is a no-op.
    function scheduleFinalResolution() {
      if (finalResolutionTimer || settled) return;
      finalResolutionTimer = setTimeout(() => {
        // Destroy our own stdio handles so a held-open pipe (from a surviving
        // descendant) can't keep this process's event loop alive after we've
        // given up waiting on 'close'. stdin included: it was only .end()ed,
        // not destroyed, and an unacknowledged write can leave it as an active
        // handle too.
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
        // A capture-cap breach (see `capture` below) is a more specific,
        // earlier-determined failure than a bare timeout — preserve it
        // (SUBPROCESS_OUTPUT_CAP must win) instead of overwriting it with a
        // generic timedOut result.
        if (capError) {
          settleReject(capError);
          return;
        }
        settleResolve({
          code: null,
          signal: 'SIGKILL',
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          timedOut: true,
        });
      }, PROVIDER_CLI_FINAL_RESOLUTION_MS);
    }

    if (options.timeoutMs !== undefined) {
      deadlineTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        killEscalationTimer = setTimeout(() => {
          child.kill('SIGKILL');
          scheduleFinalResolution();
        }, PROVIDER_CLI_KILL_GRACE_MS);
      }, options.timeoutMs);
    }

    function capture(
      streamName: 'stdout' | 'stderr',
      chunks: Buffer[],
      chunk: Buffer,
    ) {
      if (capError) return;

      const nextBytes =
        streamName === 'stdout'
          ? stdoutBytes + chunk.length
          : stderrBytes + chunk.length;
      if (nextBytes > SUBPROCESS_OUTPUT_CAP_BYTES) {
        capError = outputCapError(streamName, SUBPROCESS_OUTPUT_CAP_BYTES);
        child.kill('SIGKILL');
        // If a descendant inherited our stdio pipes, this kill may not make
        // 'close' fire, so schedule forced settlement to bound the cap
        // rejection regardless of whether a timeoutMs deadline was set.
        scheduleFinalResolution();
        return;
      }

      chunks.push(chunk);
      if (streamName === 'stdout') {
        stdoutBytes = nextBytes;
      } else {
        stderrBytes = nextBytes;
      }
    }

    child.stdout.on('data', (chunk: Buffer) =>
      capture('stdout', stdoutChunks, chunk),
    );
    child.stderr.on('data', (chunk: Buffer) =>
      capture('stderr', stderrChunks, chunk),
    );
    child.on('error', (error) => {
      settleReject(error);
    });
    child.on('close', (code, signal) => {
      if (capError) {
        settleReject(capError);
        return;
      }
      settleResolve({
        code,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        ...(timedOut ? { timedOut: true } : {}),
      });
    });

    child.stdin.on('error', () => {});
    child.stdin.end(options.input ?? '');
  });
}

export async function invokeConsensusProviderCli({
  provider,
  schemaPath,
  prompt,
  env = process.env,
  cwd = process.cwd(),
  consensusCliPath,
  runCommand = runProviderCliCommand,
}: ProviderInvocationArgs): Promise<ProviderResult> {
  const command =
    runCommand === runProviderCliCommand
      ? requireConsensusCliPath({ consensusCliPath, env })
      : resolveConsensusCliPath({ consensusCliPath, env });
  const request = {
    schema_version: 'v1',
    provider,
    schema_path: schemaPath,
    prompt,
    cwd,
  };
  const result = await runCommand(
    command,
    ['run', '--request-json', '-', '--json'],
    {
      env,
      cwd,
      input: JSON.stringify(request),
    },
  );
  const envelope = parseConsensusCliRunEnvelope(result);

  if (!envelope.ok) {
    throw providerCliEnvelopeError(envelope);
  }

  return {
    provider: envelope.provider,
    args: envelope.args,
    stdout: envelope.stdout,
    stderr: envelope.stderr,
    json: envelope.json,
    raw_provider_response: envelope.stdout ?? JSON.stringify(envelope.json),
    provider_diagnostics: envelope.diagnostics,
    attempts: envelope.attempts,
  };
}

export async function invokeProviderCliWithRetry(
  args: ProviderInvocationArgs,
  {
    attempts = 3,
    delayMs = 750,
    sleep,
    invoke = invokeConsensusProviderCli,
    mode = 'alternating',
  }: RetryOptions = {},
): Promise<ProviderResult> {
  const wait =
    sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await invoke(args);
      const verdictError = peerVerdictError(
        normalizeVerdict(result.json, mode),
        mode,
      );
      if (verdictError) throw verdictError;
      return result;
    } catch (error) {
      lastError = error;
      const retryable =
        asErrorLike(error).code === 'INVALID_VERDICT_SHAPE' ||
        asErrorLike(error).code === 'INVALID_VERDICT_CAPS';
      if (!retryable || attempt === attempts) throw error;
      await wait(delayMs);
    }
  }

  throw lastError;
}

function parseConsensusCliRunEnvelope(
  result: ProviderCliCommandRunnerResult,
): ConsensusCliRunEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new ConsensusError(
      `consensus provider CLI returned invalid JSON: ${hardErrorMessage(error)}`,
      {
        code:
          result.code && result.code !== 0
            ? 'CONSENSUS_CLI_USAGE'
            : 'PROVIDER_INVALID_JSON',
        exitCode:
          result.code && result.code !== 0 ? EXIT_CODES.USAGE : EXIT_CODES.DATA,
        cause: error,
        details: {
          exit_code: result.code,
          signal: result.signal ?? null,
          stdout: result.stdout,
          stderr: result.stderr ?? '',
        },
      },
    );
  }

  if (!isConsensusCliRunEnvelope(parsed)) {
    throw new ConsensusError(
      'consensus provider CLI returned an invalid envelope',
      {
        code: 'PROVIDER_INVALID_JSON',
        exitCode: EXIT_CODES.DATA,
        details: {
          exit_code: result.code,
          signal: result.signal ?? null,
          stdout: result.stdout,
          stderr: result.stderr ?? '',
        },
      },
    );
  }

  return parsed;
}

function isConsensusCliRunEnvelope(
  value: unknown,
): value is ConsensusCliRunEnvelope {
  if (!isJsonRecord(value)) return false;
  return value.schema_version === 'v1' && typeof value.ok === 'boolean';
}

function providerCliEnvelopeError(envelope: ConsensusCliRunFailure) {
  return new ConsensusError(envelope.message, {
    code: envelope.code,
    exitCode: exitCodeForProviderError(envelope.code),
    details: {
      provider: envelope.provider ?? null,
      retryable: envelope.retryable,
      attempts: envelope.attempts,
      diagnostics: envelope.diagnostics,
      stdout: envelope.stdout,
      stderr: envelope.stderr,
    },
  });
}

function exitCodeForProviderError(code: ProviderErrorCode) {
  if (code === 'CONSENSUS_CLI_USAGE') return EXIT_CODES.USAGE;
  if (
    code === 'PROVIDER_INVALID_JSON' ||
    code === 'PROVIDER_SCHEMA_VALIDATION'
  ) {
    return EXIT_CODES.DATA;
  }
  return EXIT_CODES.CONFIG;
}

function peerVerdictError(
  verdict: unknown,
  mode: IterationMode,
): ConsensusError | null {
  const shape = validateVerdictShape(verdict, { mode });
  if (!shape.ok) {
    return new ConsensusError(
      `invalid verdict shape: ${validationErrors(shape).join('; ')}`,
      {
        code: 'INVALID_VERDICT_SHAPE',
        exitCode: EXIT_CODES.DATA,
        details: { errors: validationErrors(shape) },
      },
    );
  }
  const caps = validateVerdictCaps(verdict, { mode });
  if (!caps.ok) {
    return new ConsensusError(
      `invalid verdict caps: ${JSON.stringify(validationMetadata(caps))}`,
      {
        code: 'INVALID_VERDICT_CAPS',
        exitCode: EXIT_CODES.DATA,
        details: validationMetadata(caps),
      },
    );
  }
  return null;
}

function providerAuditFields(result: ProviderResult): Partial<LoopRecord> {
  const rawResponse =
    result.raw_provider_response ??
    result.stdout ??
    JSON.stringify(result.json);

  return {
    raw_provider_response: rawResponse,
    ...(result.provider_diagnostics
      ? { provider_diagnostics: result.provider_diagnostics }
      : {}),
    ...(result.attempts ? { attempts: result.attempts } : {}),
  };
}

/**
 * Invoke a peer and re-invoke when the returned verdict fails our validation
 * after normalization. The provider CLI schema can express only part of the
 * contract, so a model can return a schema-valid-but-contract-invalid verdict.
 * Treat those as retryable here so a single non-compliant generation does not
 * hard-fail the section. Injected test stubs keep their exact call counts.
 */
export async function invokeValidatedPeer({
  mode,
  attempts = 3,
  delayMs = 750,
  sleep,
  invoke = invokeConsensusProviderCli,
  ...args
}: Partial<PeerInvocation> &
  RetryOptions & { mode?: IterationMode } = {}): Promise<ProviderResult> {
  const wait =
    sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await invoke(args as ProviderInvocationArgs);
      const verdictError = peerVerdictError(
        normalizeVerdict(result.json, mode ?? 'alternating'),
        mode ?? 'alternating',
      );
      if (verdictError) throw verdictError;
      return result;
    } catch (error) {
      lastError = error;
      const retryable =
        asErrorLike(error).code === 'INVALID_VERDICT_SHAPE' ||
        asErrorLike(error).code === 'INVALID_VERDICT_CAPS';
      if (!retryable || attempt === attempts) throw error;
      await wait(delayMs);
    }
  }
  throw lastError;
}

export function parseLoopArgs(argv: string[]): LoopOptions {
  const parsed: {
    sectionFile?: string;
    outputRecords?: string;
    outputSection?: string;
    outputStatus?: string;
    peers?: string[];
    goal: string;
    maxRounds: number;
    iteration: string;
    coldStart: string;
    agency: string;
    synthesizer: string | null;
  } = {
    goal: '',
    maxRounds: 12,
    iteration: 'alternating',
    coldStart: 'shared_input',
    agency: 'moderate',
    synthesizer: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`${token} requires a value`);
      }
      return argv[index];
    };

    switch (token) {
      case '--section-file':
        parsed.sectionFile = next();
        break;
      case '--goal':
        parsed.goal = next();
        break;
      case '--peers':
        parsed.peers = parsePeers(next());
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(next(), '--max-rounds');
        break;
      case '--iteration':
        parsed.iteration = next();
        break;
      case '--synthesizer':
        parsed.synthesizer = next();
        break;
      case '--cold-start':
        parsed.coldStart = next();
        break;
      case '--agency':
        parsed.agency = next();
        break;
      case '--output-records':
        parsed.outputRecords = next();
        break;
      case '--output-section':
        parsed.outputSection = next();
        break;
      case '--output-status':
        parsed.outputStatus = next();
        break;
      default:
        throw new Error(`unknown option: ${token}`);
    }
  }

  if (!ITERATION_MODES.includes(parsed.iteration as IterationMode)) {
    throw invalidIterationModeError(parsed.iteration);
  }
  if (!COLD_START_MODES.includes(parsed.coldStart as ColdStartMode)) {
    throw new Error(
      `--cold-start must be one of ${COLD_START_MODES.join(', ')}`,
    );
  }
  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  required(parsed.sectionFile, '--section-file');
  required(parsed.peers, '--peers');
  required(parsed.outputRecords, '--output-records');
  required(parsed.outputSection, '--output-section');
  required(parsed.outputStatus, '--output-status');

  return {
    sectionFile: parsed.sectionFile,
    goal: parsed.goal,
    peers: parsed.peers,
    maxRounds: parsed.maxRounds,
    iteration: parsed.iteration as IterationMode,
    coldStart: parsed.coldStart as ColdStartMode,
    agency: parsed.agency as Agency,
    synthesizer: parsed.synthesizer,
    outputRecords: parsed.outputRecords,
    outputSection: parsed.outputSection,
    outputStatus: parsed.outputStatus,
  } as LoopOptions;
}

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
