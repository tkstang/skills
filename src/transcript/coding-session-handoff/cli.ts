#!/usr/bin/env node

import { execFile as nodeExecFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  extractMetaFromRecords,
  readMetadataRecordsBounded,
  type Runtime,
  type TranscriptMeta,
} from '../core/runtimes.js';
import {
  ClassificationCache,
  discover,
} from '../session-observer/lib/locate.js';
import type { TranscriptCandidate } from '../session-observer/lib/types.js';
import { createBehaviorPlan, verifyProviderBehavior } from './behavior-gate.js';
import {
  discoverHandoffCandidates,
  HANDOFF_DISCOVERY_OPTIONS,
  type HandoffCurrentIdentity,
} from './discovery.js';
import { validateHandoffTarget } from './git-target.js';
import {
  createHandoffPlan,
  executeHandoffPlan,
  reconcileBatchOutcome,
  selectHandoffCandidates,
  type HandoffSelection,
  type NativeExecutionResult,
  type ReconcileEvidenceRequest,
  type ReconcileEvidenceResult,
} from './handoff.js';
import { previewHandoffCandidates, type PreviewSource } from './preview.js';
import { probeProvider } from './providers.js';
import {
  HANDOFF_COMMANDS,
  parseBatchOutcome,
  parseQualifiedSessionId,
  SchemaValidationError,
  type BatchOutcome,
  type ContinuityMode,
  type HandoffCommand,
  type HandoffPlan,
  type HandoffProvider,
  type NativeInvocation,
  type QualifiedSessionId,
} from './types.js';

const execFileAsync = promisify(nodeExecFile);
const MAX_RECONCILE_INPUT_BYTES = 1024 * 1024;

export interface HandoffCliIo {
  stdin: () => Promise<string>;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

export interface HandoffCliDependencies {
  discover: (
    source: string,
    provider: HandoffProvider | 'all',
  ) => Promise<unknown>;
  preview: (
    source: string,
    sessions: QualifiedSessionId[],
    rounds?: number,
    maxCharacters?: number,
  ) => Promise<unknown>;
  plan: (
    source: string,
    target: string,
    selection: HandoffSelection,
    mode: ContinuityMode,
  ) => Promise<unknown>;
  execute: (
    source: string,
    target: string,
    selection: HandoffSelection,
    mode: ContinuityMode,
    confirmedDigest: string,
  ) => Promise<unknown>;
  reconcile: (
    source: string,
    target: string,
    batch: BatchOutcome,
  ) => Promise<unknown>;
  behaviorPlan: (provider: HandoffProvider) => Promise<unknown>;
  behaviorVerify: (
    provider: HandoffProvider,
    confirmedDigest: string,
    receiptPath: string,
  ) => Promise<unknown>;
  readInputFile: (path: string) => Promise<string>;
}

class CliArgumentError extends Error {
  readonly code = 'invalid-arguments';

  constructor() {
    super('invalid-arguments');
    this.name = 'CliArgumentError';
  }
}

interface ParsedFlags {
  command: HandoffCommand;
  values: Map<string, string[]>;
  booleans: Set<string>;
}

const VALUE_FLAGS = new Set([
  '--source',
  '--target',
  '--session',
  '--provider',
  '--rounds',
  '--max-chars',
  '--mode',
  '--confirm',
  '--receipt',
  '--input',
]);
const BOOLEAN_FLAGS = new Set(['--all', '--json']);

function parseFlags(argv: readonly string[]): ParsedFlags {
  const [rawCommand, ...tokens] = argv;
  if (!HANDOFF_COMMANDS.includes(rawCommand as HandoffCommand)) {
    throw new CliArgumentError();
  }
  const command = rawCommand as HandoffCommand;
  const values = new Map<string, string[]>();
  const booleans = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const flag = tokens[index];
    if (BOOLEAN_FLAGS.has(flag)) {
      if (booleans.has(flag)) throw new CliArgumentError();
      booleans.add(flag);
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) throw new CliArgumentError();
    const flagValue = tokens[index + 1];
    if (
      flagValue === undefined ||
      flagValue.startsWith('--') ||
      flagValue.length === 0
    ) {
      throw new CliArgumentError();
    }
    index += 1;
    const existing = values.get(flag) ?? [];
    if (flag !== '--session' && existing.length > 0) {
      throw new CliArgumentError();
    }
    existing.push(flagValue);
    values.set(flag, existing);
  }
  return { command, values, booleans };
}

function value(flags: ParsedFlags, name: string, required = false) {
  const values = flags.values.get(name) ?? [];
  if (required && values.length !== 1) throw new CliArgumentError();
  return values[0];
}

function onlyAllowed(flags: ParsedFlags, allowed: readonly string[]): void {
  const allowedSet = new Set([...allowed, '--json']);
  for (const key of [...flags.values.keys(), ...flags.booleans]) {
    if (!allowedSet.has(key)) throw new CliArgumentError();
  }
}

function sessions(flags: ParsedFlags): QualifiedSessionId[] {
  const raw = flags.values.get('--session') ?? [];
  if (raw.length === 0) throw new CliArgumentError();
  try {
    return raw.map(parseQualifiedSessionId);
  } catch {
    throw new CliArgumentError();
  }
}

function selection(flags: ParsedFlags): HandoffSelection {
  const hasAll = flags.booleans.has('--all');
  const rawSessions = flags.values.get('--session') ?? [];
  if (hasAll === rawSessions.length > 0) throw new CliArgumentError();
  return hasAll ? { all: true } : { sessions: sessions(flags) };
}

function provider(
  flags: ParsedFlags,
  allowAll: boolean,
): HandoffProvider | 'all' {
  const selected = value(flags, '--provider', !allowAll);
  if (selected === undefined && allowAll) return 'all';
  if (
    selected !== 'codex' &&
    selected !== 'claude' &&
    !(allowAll && selected === 'all')
  ) {
    throw new CliArgumentError();
  }
  return selected;
}

function mode(flags: ParsedFlags): ContinuityMode {
  const selected = value(flags, '--mode', true);
  if (selected !== 'successor' && selected !== 'resume') {
    throw new CliArgumentError();
  }
  return selected;
}

function positiveInteger(flags: ParsedFlags, name: string): number | undefined {
  const raw = value(flags, name);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new CliArgumentError();
  return parsed;
}

function confirmation(flags: ParsedFlags): string {
  const digest = value(flags, '--confirm', true)!;
  if (!/^[0-9a-f]{64}$/u.test(digest)) throw new CliArgumentError();
  return digest;
}

function errorCode(error: unknown): string {
  if (error instanceof SchemaValidationError) return error.code;
  if (error !== null && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[a-z][a-z0-9-]*$/u.test(code))
      return code;
  }
  return 'unexpected-failure';
}

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'invalid-arguments': 'Invalid command arguments.',
  'provider-auth-required': 'Provider authentication is required.',
  'provider-capability-unavailable': 'Provider capability is unavailable.',
  'behavior-unverified': 'Provider behavior is not verified.',
  'plan-stale': 'The confirmed plan is stale.',
  'receipt-path-exists': 'The receipt path already exists.',
  'receipt-path-unavailable': 'The receipt path cannot be used safely.',
  'input-too-large': 'The reconciliation input exceeds its limit.',
  'input-invalid': 'The reconciliation input is invalid.',
  'unexpected-failure': 'The command failed safely.',
};

function safeMessage(code: string): string {
  return (
    SAFE_ERROR_MESSAGES[code] ??
    (code.startsWith('provider-') || code.startsWith('behavior-')
      ? 'Provider safety requirements were not satisfied.'
      : 'The request could not be completed safely.')
  );
}

function exitCodeFor(error: unknown, code: string): 2 | 3 | 4 {
  if (
    error instanceof CliArgumentError ||
    error instanceof SchemaValidationError
  ) {
    return 2;
  }
  if (
    code === 'plan-stale' ||
    code.startsWith('provider-') ||
    code.startsWith('behavior-') ||
    code === 'source-dirty' ||
    code === 'git-evidence-drift'
  ) {
    return 3;
  }
  if (
    code.includes('selection') ||
    code.includes('session') ||
    code.includes('target') ||
    code.includes('input') ||
    code.includes('receipt-path') ||
    code.includes('worktree') ||
    code === 'repository-mismatch' ||
    code === 'same-worktree'
  ) {
    return 2;
  }
  return 4;
}

function writeSuccess(
  io: HandoffCliIo,
  command: HandoffCommand,
  data: unknown,
  json: boolean,
): void {
  if (json) {
    io.stdout(`${JSON.stringify({ ok: true, command, data })}\n`);
    return;
  }
  io.stdout(`${JSON.stringify(data, null, 2)}\n`);
}

function writeFailure(
  io: HandoffCliIo,
  command: HandoffCommand | undefined,
  code: string,
  json: boolean,
): void {
  const error = { code, message: safeMessage(code) };
  if (json) {
    io.stdout(
      `${JSON.stringify({ ok: false, ...(command ? { command } : {}), error })}\n`,
    );
  } else {
    io.stderr(`error: ${code}: ${error.message}\n`);
  }
}

async function reconcileInput(
  flags: ParsedFlags,
  dependencies: HandoffCliDependencies,
  io: HandoffCliIo,
): Promise<BatchOutcome> {
  const input = value(flags, '--input', true)!;
  let contents: string;
  try {
    contents =
      input === '-'
        ? await io.stdin()
        : await dependencies.readInputFile(input);
  } catch {
    throw Object.assign(new Error('input-invalid'), { code: 'input-invalid' });
  }
  if (Buffer.byteLength(contents) > MAX_RECONCILE_INPUT_BYTES) {
    throw Object.assign(new Error('input-too-large'), {
      code: 'input-too-large',
    });
  }
  try {
    return parseBatchOutcome(JSON.parse(contents));
  } catch {
    throw Object.assign(new Error('input-invalid'), { code: 'input-invalid' });
  }
}

/** Parse, route, and render exactly one command without exposing raw boundaries. */
export async function runHandoffCli(
  argv: readonly string[],
  dependencies: HandoffCliDependencies = DEFAULT_DEPENDENCIES,
  io: HandoffCliIo = nodeIo(),
): Promise<number> {
  let flags: ParsedFlags | undefined;
  try {
    flags = parseFlags(argv);
    const json = flags.booleans.has('--json');
    let data: unknown;
    if (flags.command === 'discover') {
      onlyAllowed(flags, ['--source', '--provider']);
      data = await dependencies.discover(
        value(flags, '--source', true)!,
        provider(flags, true),
      );
    } else if (flags.command === 'preview') {
      onlyAllowed(flags, ['--source', '--session', '--rounds', '--max-chars']);
      data = await dependencies.preview(
        value(flags, '--source', true)!,
        sessions(flags),
        positiveInteger(flags, '--rounds'),
        positiveInteger(flags, '--max-chars'),
      );
    } else if (flags.command === 'plan' || flags.command === 'execute') {
      onlyAllowed(flags, [
        '--source',
        '--target',
        '--session',
        '--all',
        '--mode',
        ...(flags.command === 'execute' ? ['--confirm'] : []),
      ]);
      const args = [
        value(flags, '--source', true)!,
        value(flags, '--target', true)!,
        selection(flags),
        mode(flags),
      ] as const;
      data =
        flags.command === 'plan'
          ? await dependencies.plan(...args)
          : await dependencies.execute(...args, confirmation(flags));
    } else if (flags.command === 'reconcile') {
      onlyAllowed(flags, ['--source', '--target', '--input']);
      data = await dependencies.reconcile(
        value(flags, '--source', true)!,
        value(flags, '--target', true)!,
        await reconcileInput(flags, dependencies, io),
      );
    } else if (flags.command === 'behavior-plan') {
      onlyAllowed(flags, ['--provider']);
      data = await dependencies.behaviorPlan(
        provider(flags, false) as HandoffProvider,
      );
    } else {
      onlyAllowed(flags, ['--provider', '--confirm', '--receipt']);
      data = await dependencies.behaviorVerify(
        provider(flags, false) as HandoffProvider,
        confirmation(flags),
        value(flags, '--receipt', true)!,
      );
    }
    writeSuccess(io, flags.command, data, json);
    return 0;
  } catch (error) {
    const code = errorCode(error);
    writeFailure(
      io,
      flags?.command,
      code,
      flags?.booleans.has('--json') ?? argv.includes('--json'),
    );
    return exitCodeFor(error, code);
  }
}

function runtime(providerValue: HandoffProvider): Runtime {
  return providerValue === 'codex' ? 'codex' : 'claude-code';
}

async function rawCandidates(providerValue: HandoffProvider, cwd: string) {
  return discover(
    runtime(providerValue),
    cwd,
    new ClassificationCache(),
    HANDOFF_DISCOVERY_OPTIONS,
  );
}

async function defaultPreview(
  source: string,
  selected: QualifiedSessionId[],
  rounds?: number,
  maxCharacters?: number,
) {
  const candidates = await discoverHandoffCandidates(source);
  const candidateByKey = new Map(
    candidates.map((candidate) => [candidate.key, candidate]),
  );
  const sources: PreviewSource[] = [];
  for (const key of selected) {
    const candidate = candidateByKey.get(key);
    if (candidate === undefined)
      throw Object.assign(new Error('unknown-session'), {
        code: 'unknown-session',
      });
    const exact = await exactTranscript(
      candidate.provider,
      source,
      candidate.nativeId,
    );
    if (exact === null || exact.status !== 'one') {
      throw Object.assign(new Error('preview-incomplete'), {
        code: 'preview-incomplete',
      });
    }
    sources.push({
      candidate,
      runtime: runtime(candidate.provider) as 'codex' | 'claude-code',
      transcriptPath: exact.candidate.transcriptPath,
    });
  }
  return previewHandoffCandidates(
    sources,
    rounds === undefined && maxCharacters === undefined
      ? {}
      : {
          sessionLimits: {
            maxRounds: rounds ?? 3,
            maxCharacters: maxCharacters ?? 4_000,
          },
        },
  );
}

function currentIdentities(
  env: NodeJS.ProcessEnv = process.env,
): HandoffCurrentIdentity[] {
  const providers: Array<{
    provider: HandoffProvider;
    values: Array<string | undefined>;
  }> = [
    {
      provider: 'codex',
      values: [
        env.CODEX_THREAD_ID,
        env.CODEX_SESSION_ID,
        env.OPENAI_CODEX_SESSION_ID,
      ],
    },
    {
      provider: 'claude',
      values: [env.CLAUDE_CODE_SESSION_ID, env.CLAUDE_SESSION_ID],
    },
  ];
  return providers.flatMap(({ provider: providerValue, values }) => {
    const ids = [...new Set(values.filter(Boolean))] as string[];
    return ids.length === 1
      ? [
          {
            provider: providerValue,
            nativeId: ids[0],
            evidence: 'direct-environment' as const,
          },
        ]
      : [];
  });
}

async function buildDefaultPlan(
  source: string,
  target: string,
  handoffSelection: HandoffSelection,
  continuityMode: ContinuityMode,
): Promise<HandoffPlan> {
  const evidence = await validateHandoffTarget(source, target);
  const candidates = await discoverHandoffCandidates(source, {
    currentIdentities: currentIdentities(),
  });
  selectHandoffCandidates(candidates, handoffSelection);
  const baseline = await discoverHandoffCandidates(target);
  const capabilities = await Promise.all([
    probeProvider('codex', { targetCwd: evidence.target.worktreeRoot }),
    probeProvider('claude', { targetCwd: evidence.target.worktreeRoot }),
  ]);
  return createHandoffPlan({
    source: evidence.source,
    target: evidence.target,
    candidates,
    targetBaselineIds: baseline.map((candidate) => candidate.key),
    selection: handoffSelection,
    mode: continuityMode,
    capabilities: capabilities.map((result) =>
      result.authentication.status === 'authenticated'
        ? result.capability
        : {
            ...result.capability,
            status: 'probe-failed' as const,
            missingCapabilities: [
              ...result.capability.missingCapabilities,
              'authentication',
            ],
          },
    ),
  });
}

async function runNative(
  invocationValue: NativeInvocation,
  executablePath: string,
): Promise<NativeExecutionResult> {
  try {
    const result = await execFileAsync(executablePath, invocationValue.argv, {
      cwd: invocationValue.cwd,
      timeout: invocationValue.timeoutMs,
      maxBuffer: invocationValue.maxOutputBytes,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    return {
      exitCode: 0,
      signal: null,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const details =
      error !== null && typeof error === 'object'
        ? (error as Record<string, unknown>)
        : {};
    return {
      exitCode: typeof details.code === 'number' ? details.code : null,
      signal: typeof details.signal === 'string' ? details.signal : null,
      stdout: typeof details.stdout === 'string' ? details.stdout : '',
      stderr: typeof details.stderr === 'string' ? details.stderr : '',
      timedOut:
        details.code === 'ETIMEDOUT' ||
        details.killed === true ||
        details.signal === 'SIGTERM',
    };
  }
}

type ExactTranscriptResult =
  | {
      status: 'one';
      candidate: TranscriptCandidate;
      meta: TranscriptMeta;
    }
  | { status: 'ambiguous' };

async function exactTranscript(
  providerValue: HandoffProvider,
  cwd: string,
  nativeId: string,
): Promise<ExactTranscriptResult | null> {
  const discovered = await rawCandidates(providerValue, cwd);
  const matches: Array<{
    candidate: TranscriptCandidate;
    meta: TranscriptMeta;
  }> = [];
  for (const candidate of discovered) {
    if (candidate.recordedCwd !== cwd) continue;
    const bounded = await readMetadataRecordsBounded(candidate.transcriptPath, {
      maxBytes: 256 * 1024,
      maxRecords: 128,
      diagnostic: () => {},
    });
    if (bounded.incomplete) continue;
    const meta = extractMetaFromRecords(
      runtime(providerValue),
      bounded.records,
      candidate.transcriptPath,
    );
    if (meta?.nativeSessionId === nativeId) {
      matches.push({ candidate, meta });
    }
  }
  if (matches.length !== 1) {
    return matches.length > 1 ? { status: 'ambiguous' } : null;
  }
  return { status: 'one', ...matches[0] };
}

async function exactMeta(
  providerValue: HandoffProvider,
  cwd: string,
  nativeId: string,
): Promise<
  { status: 'one'; meta: TranscriptMeta } | { status: 'ambiguous' } | null
> {
  const exact = await exactTranscript(providerValue, cwd, nativeId);
  if (exact === null || exact.status === 'ambiguous') return exact;
  return { status: 'one', meta: exact.meta };
}

export async function corroborateExact(
  source: string,
  target: string,
  request: ReconcileEvidenceRequest,
): Promise<ReconcileEvidenceResult> {
  const selector =
    request.expectedChildNativeId ?? request.observedChildNativeId;
  if (
    selector === undefined ||
    (request.expectedChildNativeId !== undefined &&
      request.observedChildNativeId !== undefined &&
      request.expectedChildNativeId !== request.observedChildNativeId)
  ) {
    return { status: 'unresolved', reasonCode: 'child-unresolved' };
  }
  try {
    const child = await exactMeta(request.provider, target, selector);
    if (child === null) {
      return { status: 'unresolved', reasonCode: 'child-unresolved' };
    }
    if (child.status === 'ambiguous') {
      return { status: 'ambiguous', reasonCode: 'child-ambiguous' };
    }
    if (
      child.meta.nativeSessionId !== selector ||
      child.meta.recordedCwd !== target ||
      request.targetBaselineIds.includes(`${request.provider}:${selector}`)
    ) {
      return { status: 'unresolved', reasonCode: 'child-unresolved' };
    }
    if (request.provider === 'codex') {
      return child.meta.forkedFromSessionId === request.parentNativeId
        ? { status: 'mapped' }
        : { status: 'unresolved', reasonCode: 'child-unresolved' };
    }
    const parent = await exactMeta('claude', source, request.parentNativeId);
    if (parent === null || parent.status !== 'one') {
      return { status: 'unresolved', reasonCode: 'child-unresolved' };
    }
    const parentUuids =
      parent.meta.recordLineage?.map((entry) => entry.uuid) ?? [];
    const inherited = parentUuids.every(
      (uuid, index) => child.meta.recordLineage?.[index]?.uuid === uuid,
    );
    return inherited && parentUuids.length > 0
      ? { status: 'mapped' }
      : { status: 'unresolved', reasonCode: 'child-unresolved' };
  } catch {
    return { status: 'failed', reasonCode: 'reporting-failed' };
  }
}

async function defaultExecute(
  source: string,
  target: string,
  handoffSelection: HandoffSelection,
  continuityMode: ContinuityMode,
  confirmedDigest: string,
) {
  let currentPlan: HandoffPlan | undefined;
  return executeHandoffPlan({
    confirmedDigest,
    rebuildPlan: async () => {
      currentPlan = await buildDefaultPlan(
        source,
        target,
        handoffSelection,
        continuityMode,
      );
      return currentPlan;
    },
    run: async (invocationValue) => {
      const executablePath = currentPlan?.capabilities.find(
        (capability) => capability.provider === invocationValue.executable,
      )?.executable;
      if (executablePath === undefined) {
        return {
          exitCode: null,
          signal: null,
          stdout: '',
          stderr: '',
          beforeChildCreationProven: true,
        };
      }
      return runNative(invocationValue, executablePath);
    },
    corroborate: (request) => corroborateExact(source, target, request),
  });
}

async function readInputFileBounded(path: string): Promise<string> {
  const metadata = await stat(path);
  if (metadata.size > MAX_RECONCILE_INPUT_BYTES) {
    throw Object.assign(new Error('input-too-large'), {
      code: 'input-too-large',
    });
  }
  return readFile(path, 'utf8');
}

const DEFAULT_DEPENDENCIES: HandoffCliDependencies = {
  discover: (source, selectedProvider) =>
    discoverHandoffCandidates(source, {
      providers: selectedProvider === 'all' ? undefined : [selectedProvider],
      currentIdentities: currentIdentities(),
    }),
  preview: defaultPreview,
  plan: buildDefaultPlan,
  execute: defaultExecute,
  reconcile: (source, target, batch) =>
    reconcileBatchOutcome(batch, {
      inspect: (request) => corroborateExact(source, target, request),
    }),
  behaviorPlan: async (providerValue) =>
    createBehaviorPlan(providerValue, await probeProvider(providerValue)),
  behaviorVerify: async (providerValue, confirmedDigest, receiptPath) =>
    verifyProviderBehavior({
      provider: providerValue,
      providerProbe: await probeProvider(providerValue),
      confirmedDigest,
      receiptPath,
    }),
  readInputFile: readInputFileBounded,
};

function nodeIo(): HandoffCliIo {
  return {
    stdin: async () => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of process.stdin) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > MAX_RECONCILE_INPUT_BYTES) {
          throw Object.assign(new Error('input-too-large'), {
            code: 'input-too-large',
          });
        }
        chunks.push(buffer);
      }
      return Buffer.concat(chunks).toString('utf8');
    },
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runHandoffCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
