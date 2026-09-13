#!/usr/bin/env node

import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  normalizeEntries,
  readTailRecordsBounded,
  type Runtime,
} from '../core/runtimes.js';
import {
  ClassificationCache,
  discover,
} from '../session-observer/lib/locate.js';
import type { TranscriptCandidate } from '../session-observer/lib/types.js';
import { readExactCodexNativeId } from './discovery.js';
import type { GuidanceProvider } from './guidance-capabilities.js';
import {
  discoverGuidanceCandidates,
  discoverGuidance,
  GuidanceDiscoveryError,
  GUIDANCE_DISCOVERY_OPTIONS,
  selectGuidanceCandidate,
  type GuidanceQualifiedSessionId,
  type GuidanceSessionCandidate,
} from './guidance-discovery.js';
import { prepareForkGuidance, type GuidanceEntryPoint } from './guidance.js';
import { sanitizePreviewConversationEntries } from './preview.js';

export interface GuidanceCliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

export interface GuidanceCliDependencies {
  discover: (
    source: string,
    provider: 'claude' | 'codex' | 'cursor' | 'all',
  ) => Promise<unknown>;
  preview: (
    source: string,
    session: GuidanceQualifiedSessionId,
  ) => Promise<unknown>;
  prepare: (
    source: string,
    target: string,
    session: GuidanceQualifiedSessionId,
    entryPoint: GuidanceEntryPoint,
  ) => Promise<unknown>;
}

const HELP = `coding-session-handoff — EXPERIMENTAL / NOT RELEASED

Read-only discovery and destination-tab fork guidance. Preparing guidance does not
run a provider, create a fork, authenticate, or modify provider session stores.

Usage:
  coding-session-handoff discover --source PATH [--provider claude|codex|cursor|all] [--json]
  coding-session-handoff preview --source PATH --session PROVIDER:SURFACE:ID [--json]
  coding-session-handoff prepare --source PATH --target PATH --session PROVIDER:SURFACE:ID \\
    --entry-point source-current|source-other|destination-fresh [--json]
`;

class GuidanceCliArgumentError extends Error {
  readonly code = 'invalid-arguments';
}

interface Flags {
  command: 'discover' | 'preview' | 'prepare';
  values: Map<string, string>;
  json: boolean;
}

const VALUE_FLAGS = new Set([
  '--source',
  '--target',
  '--session',
  '--provider',
  '--entry-point',
]);

function parse(argv: readonly string[]): Flags {
  const command = argv[0];
  if (!['discover', 'preview', 'prepare'].includes(command)) {
    throw new GuidanceCliArgumentError();
  }
  const values = new Map<string, string>();
  let json = false;
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--json') {
      if (json) throw new GuidanceCliArgumentError();
      json = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag) || values.has(flag)) {
      throw new GuidanceCliArgumentError();
    }
    const flagValue = argv[index + 1];
    if (
      flagValue === undefined ||
      flagValue.startsWith('--') ||
      flagValue.length === 0
    ) {
      throw new GuidanceCliArgumentError();
    }
    values.set(flag, flagValue);
    index += 1;
  }
  return { command: command as Flags['command'], values, json };
}

function required(flags: Flags, name: string): string {
  const result = flags.values.get(name);
  if (result === undefined) throw new GuidanceCliArgumentError();
  return result;
}

function allowOnly(flags: Flags, allowed: readonly string[]): void {
  if ([...flags.values.keys()].some((key) => !allowed.includes(key))) {
    throw new GuidanceCliArgumentError();
  }
}

function provider(flags: Flags): 'claude' | 'codex' | 'cursor' | 'all' {
  const result = flags.values.get('--provider') ?? 'all';
  if (!['claude', 'codex', 'cursor', 'all'].includes(result)) {
    throw new GuidanceCliArgumentError();
  }
  return result as 'claude' | 'codex' | 'cursor' | 'all';
}

function session(flags: Flags): GuidanceQualifiedSessionId {
  const result = required(flags, '--session');
  if (
    !/^(?:claude|codex|cursor):(?:cli|ide|ambiguous):[^:\s]+$/u.test(result) ||
    [...result].some((character) => character.codePointAt(0)! < 32)
  ) {
    throw new GuidanceCliArgumentError();
  }
  return result as GuidanceQualifiedSessionId;
}

function entryPoint(flags: Flags): GuidanceEntryPoint {
  const result = required(flags, '--entry-point');
  if (
    !['source-current', 'source-other', 'destination-fresh'].includes(result)
  ) {
    throw new GuidanceCliArgumentError();
  }
  return result as GuidanceEntryPoint;
}

function errorCode(error: unknown): string {
  if (error instanceof GuidanceCliArgumentError) return error.code;
  if (error !== null && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[a-z][a-z0-9-]*$/u.test(code))
      return code;
  }
  return 'unexpected-failure';
}

function errorProvenance(error: unknown) {
  return error instanceof GuidanceDiscoveryError &&
    error.provider !== undefined &&
    error.reason !== undefined
    ? { provider: error.provider, reason: error.reason }
    : {};
}

function render(
  io: GuidanceCliIo,
  command: Flags['command'],
  data: unknown,
  json: boolean,
): void {
  const envelope = {
    ok: true,
    command,
    status: 'experimental-not-released',
    currentSelection: 'explicit-required',
    noForkCreated: true,
    data,
  };
  io.stdout(`${JSON.stringify(envelope, null, json ? 0 : 2)}\n`);
}

export async function runGuidanceCli(
  argv: readonly string[],
  dependencies: GuidanceCliDependencies = DEFAULT_DEPENDENCIES,
  io: GuidanceCliIo = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  },
): Promise<number> {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    io.stdout(HELP);
    return 0;
  }
  let flags: Flags | undefined;
  try {
    flags = parse(argv);
    let data: unknown;
    if (flags.command === 'discover') {
      allowOnly(flags, ['--source', '--provider']);
      data = await dependencies.discover(
        required(flags, '--source'),
        provider(flags),
      );
    } else if (flags.command === 'preview') {
      allowOnly(flags, ['--source', '--session']);
      data = await dependencies.preview(
        required(flags, '--source'),
        session(flags),
      );
    } else {
      allowOnly(flags, ['--source', '--target', '--session', '--entry-point']);
      data = await dependencies.prepare(
        required(flags, '--source'),
        required(flags, '--target'),
        session(flags),
        entryPoint(flags),
      );
    }
    render(io, flags.command, data, flags.json);
    return 0;
  } catch (error) {
    const code = errorCode(error);
    const failure = {
      ok: false,
      ...(flags ? { command: flags.command } : {}),
      error: {
        code,
        ...errorProvenance(error),
        message:
          'The read-only guidance request could not be completed safely.',
      },
    };
    if (flags?.json ?? argv.includes('--json'))
      io.stdout(`${JSON.stringify(failure)}\n`);
    else io.stderr(`error: ${code}\n`);
    return code === 'unexpected-failure' ? 4 : 2;
  }
}

function runtimeFor(candidate: GuidanceSessionCandidate): Runtime {
  if (candidate.provider === 'claude') return 'claude-code';
  return candidate.provider;
}

function providerForKey(key: GuidanceQualifiedSessionId): GuidanceProvider {
  return key.slice(0, key.indexOf(':')) as GuidanceProvider;
}

async function rawMatch(
  source: string,
  selected: GuidanceSessionCandidate,
): Promise<TranscriptCandidate> {
  const runtime = runtimeFor(selected);
  const raw = await discover(
    runtime,
    source,
    new ClassificationCache(),
    GUIDANCE_DISCOVERY_OPTIONS,
  );
  const matches: TranscriptCandidate[] = [];
  for (const candidate of raw) {
    if (candidate.recordedCwd === null) continue;
    const recorded = await realpath(candidate.recordedCwd).catch(() => null);
    if (recorded !== selected.recordedCwd) continue;
    const nativeId =
      selected.provider === 'codex'
        ? await readExactCodexNativeId(candidate)
        : candidate.sessionId;
    if (nativeId === selected.nativeId) matches.push(candidate);
  }
  if (matches.length !== 1) {
    throw Object.assign(new Error('preview-incomplete'), {
      code: 'preview-incomplete',
    });
  }
  return matches[0];
}

async function defaultPreview(source: string, key: GuidanceQualifiedSessionId) {
  const candidates = await discoverGuidanceCandidates(source, {
    providers: [providerForKey(key)],
  });
  const selected = selectGuidanceCandidate(candidates, key);
  const raw = await rawMatch(selected.recordedCwd, selected);
  const diagnostics: string[] = [];
  const bounded = await readTailRecordsBounded(raw.transcriptPath, {
    maxBytes: 2 * 1024 * 1024,
    maxRecords: 10_000,
    maxInspectedRecords: 10_000,
    deadlineMs: 10_000,
    diagnostic: ({ code }) => diagnostics.push(code),
  });
  if (diagnostics.length > 0 || bounded.recordLimitExceeded === true) {
    throw Object.assign(new Error('preview-incomplete'), {
      code: 'preview-incomplete',
    });
  }
  const entries = sanitizePreviewConversationEntries(
    runtimeFor(selected),
    normalizeEntries(runtimeFor(selected), bounded.records, {
      includeToolCalls: false,
      includeToolResults: false,
      includeCommandMessages: false,
    }),
  );
  const retained = entries.slice(-8);
  let remaining = 4_000;
  let entryTextTrimmed = false;
  const limited = retained
    .toReversed()
    .flatMap((entry) => {
      if (remaining === 0) return [];
      const text = entry.text.slice(-remaining);
      if (text.length < entry.text.length) entryTextTrimmed = true;
      remaining -= text.length;
      return [{ ...entry, text }];
    })
    .toReversed();
  return {
    key,
    entries: limited,
    truncated:
      bounded.truncated || limited.length < entries.length || entryTextTrimmed,
    warning: 'hidden-payload-sanitized-not-secret-free',
  };
}

const DEFAULT_DEPENDENCIES: GuidanceCliDependencies = {
  discover: async (source, selectedProvider) =>
    discoverGuidance(source, {
      providers: selectedProvider === 'all' ? undefined : [selectedProvider],
    }),
  preview: defaultPreview,
  prepare: async (source, target, key, selectedEntryPoint) => {
    const candidates = await discoverGuidanceCandidates(source, {
      providers: [providerForKey(key)],
    });
    const candidate = selectGuidanceCandidate(candidates, key);
    return prepareForkGuidance({
      sourcePath: source,
      destinationPath: target,
      entryPoint: selectedEntryPoint,
      candidate,
    });
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runGuidanceCli(process.argv.slice(2));
}
