import { constants, type Stats } from 'node:fs';
import { access, lstat, open, opendir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';

// Staged extraction from ORC packages/session-log/src/identity.ts at cc845945.
import { extractMetaFromRecords } from './provider-runtime.js';
import type { TranscriptMeta } from './provider-runtime.js';

export type TranscriptIdentityRuntime =
  | 'codex'
  | 'claude-code'
  | 'cursor'
  | 'unknown';
export type TranscriptIdentityStatus =
  | 'authoritative'
  | 'corroborated'
  | 'ambiguous'
  | 'invalid'
  | 'unavailable';

export interface CurrentTranscriptOptions {
  readonly cwd: string;
  readonly homeDir?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Entries consumed across the selected provider tree, including directories. */
  readonly maxEntries?: number;
}

export interface CurrentTranscriptIdentity {
  readonly runtime: TranscriptIdentityRuntime;
  readonly status: TranscriptIdentityStatus;
  readonly runtimeId: string | null;
  readonly transcriptMetadataId: string | null;
  readonly idSource: string | null;
  readonly parentSessionId: string | null;
  readonly path: string | null;
  /** Exact layout/filename matches, including rejected candidates. */
  readonly matchCount: number;
  readonly scanSaturated: boolean;
  readonly warningCodes: readonly string[];
  readonly contract: 'documented' | 'observed' | null;
  readonly lineage?: Pick<
    TranscriptMeta,
    | 'nativeSessionId'
    | 'rootSessionId'
    | 'parentSessionId'
    | 'forkedFromSessionId'
    | 'subagentHistoryStartOrdinal'
  >;
}

const MAX_ENTRIES = 25_000;
const MAX_METADATA_BYTES = 256 * 1024;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const SOURCES = {
  codex: ['CODEX_THREAD_ID'],
  'claude-code': ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_SESSION_ID'],
  cursor: ['CURSOR_CONVERSATION_ID', 'CURSOR_SESSION_ID'],
} as const;

type TranscriptFileIdentity = Pick<
  Stats,
  'dev' | 'ino' | 'size' | 'mtimeMs' | 'ctimeMs' | 'uid' | 'mode'
>;

interface SelectedId {
  readonly id: string | null;
  readonly source: string | null;
  readonly state: 'absent' | 'valid' | 'invalid' | 'ambiguous';
}

/** Selects only explicit IDs; never ranks historical sessions or reads messages. */
export async function identifyCurrentTranscript(
  options: CurrentTranscriptOptions,
): Promise<CurrentTranscriptIdentity> {
  const env = options.env ?? process.env;
  const deniedValues = sensitiveEnvValues(env);
  const parent = selectId(
    env,
    ['CODEX_SESSION_ID', 'OPENAI_CODEX_SESSION_ID'],
    deniedValues,
  );
  // Consumer explicit-self variables are evidence inputs only; no consumer state is read.
  const explicit = env.SESSION_OBSERVER_SELF;
  const [explicitRuntime, ...explicitParts] = explicit?.split(':') ?? [];
  const explicitId = explicitParts.join(':') || env.SESSION_OBSERVER_SESSION_ID;
  const selections = Object.entries(SOURCES).map(([runtime, sources]) => ({
    runtime: runtime as Exclude<TranscriptIdentityRuntime, 'unknown'>,
    selected: selectId(
      explicitRuntime === runtime && explicitId !== undefined
        ? { ...env, SESSION_OBSERVER_SELF: explicitId }
        : env,
      explicitRuntime === runtime && explicitId !== undefined
        ? [...sources, 'SESSION_OBSERVER_SELF']
        : sources,
      deniedValues,
    ),
  }));
  const present = selections.filter(
    ({ runtime, selected }) =>
      selected.state !== 'absent' ||
      (runtime === 'codex' && parent.state !== 'absent'),
  );
  const base: CurrentTranscriptIdentity = {
    runtime: present.length === 1 ? present[0]!.runtime : 'unknown',
    status: 'unavailable',
    runtimeId: null,
    transcriptMetadataId: null,
    idSource: null,
    parentSessionId: baseParent(parent),
    path: null,
    matchCount: 0,
    scanSaturated: false,
    warningCodes: [],
    contract: present.length === 1 ? 'observed' : null,
  };
  if (
    explicit !== undefined &&
    (!Object.hasOwn(SOURCES, explicitRuntime ?? '') || !explicitId)
  )
    return failed(base, 'invalid', 'W_INVALID_EXPLICIT_SELF');
  if (present.length > 1)
    return failed(base, 'ambiguous', 'W_CONFLICTING_PROVIDERS');
  if (present.length === 0) return base;
  const { runtime, selected } = present[0]!;
  const identified = {
    ...base,
    runtimeId: selected.id,
    idSource: selected.source,
  };
  if (
    selected.state === 'ambiguous' ||
    (runtime === 'codex' && parent.state === 'ambiguous')
  ) {
    return failed(identified, 'ambiguous', 'W_CONFLICTING_IDS');
  }
  if (
    selected.state === 'invalid' ||
    (runtime === 'codex' && parent.state === 'invalid')
  ) {
    return failed(identified, 'invalid', 'W_INVALID_ID');
  }
  if (!selected.id)
    return failed(identified, 'unavailable', 'W_THREAD_ID_UNAVAILABLE');
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  if (
    !Number.isSafeInteger(maxEntries) ||
    maxEntries < 1 ||
    maxEntries > MAX_ENTRIES
  ) {
    return failed(identified, 'invalid', 'W_INVALID_SCAN_LIMIT');
  }
  if (typeof process.getuid !== 'function') {
    return failed(identified, 'unavailable', 'W_OWNERSHIP_UNAVAILABLE');
  }
  let outcome: CurrentTranscriptIdentity = identified;
  try {
    if (!isAbsolute(options.cwd))
      return failed(identified, 'invalid', 'W_INVALID_CWD');
    const cwd = await realpath(options.cwd);
    const home = await realpath(options.homeDir ?? homedir());
    const provider = runtime === 'claude-code' ? '.claude' : `.${runtime}`;
    const root = join(
      home,
      provider,
      runtime === 'codex' ? 'sessions' : 'projects',
    );
    if (!(await safePath(home, root, false))) {
      return failed(identified, 'invalid', 'W_UNSAFE_PROVIDER_ROOT');
    }
    const scan = await scanExact(root, runtime, selected.id, maxEntries, home);
    const counted = {
      ...identified,
      matchCount: scan.paths.length,
      scanSaturated: scan.saturated,
    };
    outcome = counted;
    if (scan.saturated) return failed(counted, 'ambiguous', 'W_SCAN_SATURATED');
    if (scan.inaccessible)
      return failed(counted, 'unavailable', 'W_SCAN_INACCESSIBLE');
    if (scan.paths.length > 1)
      return failed(counted, 'ambiguous', 'W_DUPLICATE_TRANSCRIPTS');
    const path = scan.paths[0];
    if (!path) return { ...counted, status: 'corroborated' };
    if (!(await safePath(home, path, true)))
      return failed(counted, 'invalid', 'W_UNSAFE_TRANSCRIPT');
    if (runtime === 'codex') {
      const metadata = await codexMetadata(path);
      if (!metadata || metadata.id !== selected.id)
        return failed(counted, 'invalid', 'W_INVALID_METADATA');
      let metadataCwd: string | null = null;
      try {
        metadataCwd = isAbsolute(metadata.cwd)
          ? await realpath(metadata.cwd)
          : null;
      } catch {
        /* Invalid metadata cwd. */
      }
      if (metadataCwd !== cwd)
        return failed(counted, 'invalid', 'W_CWD_MISMATCH');
      if (!(await safePath(home, path, true)))
        return failed(counted, 'invalid', 'W_UNSAFE_TRANSCRIPT');
      const finalPath = await realpath(path);
      const finalInfo = await lstat(path);
      if (
        finalPath !== path ||
        !sameTranscriptFile(metadata.fileIdentity, finalInfo)
      )
        return failed(counted, 'invalid', 'W_TRANSCRIPT_CHANGED');
      // No further asynchronous check may occur after this comparison.
      return {
        ...counted,
        status: 'authoritative',
        transcriptMetadataId: metadata.id,
        path: finalPath,
        ...(metadata.lineage ? { lineage: metadata.lineage } : {}),
      };
    }
    const fileIdentity = await lstat(path);
    const project = relative(root, path).split(sep)[0];
    const slugs =
      runtime === 'claude-code'
        ? [cwd.replace(/[/.]/g, '-'), cwd.replace(/\//g, '-')]
        : [
            cwd.split(/[/.]/).filter(Boolean).join('-'),
            cwd.replace(/[/.]/g, '-'),
          ];
    if (!project || !slugs.includes(project))
      return failed(counted, 'invalid', 'W_CWD_MISMATCH');
    const finalPath = await realpath(path);
    const finalInfo = await lstat(path);
    if (finalPath !== path || !sameTranscriptFile(fileIdentity, finalInfo))
      return failed(counted, 'invalid', 'W_TRANSCRIPT_CHANGED');
    return { ...counted, status: 'authoritative', path: finalPath };
  } catch (error) {
    return failed(
      outcome,
      'unavailable',
      errorCode(error) === 'ENOENT'
        ? 'W_TRANSCRIPT_UNAVAILABLE'
        : 'W_SCAN_INACCESSIBLE',
    );
  }
}

/** Where an exact session id's transcript is, as far as this machine shows. */
export type TranscriptLocation =
  | { readonly status: 'found'; readonly path: string; readonly cwd: string }
  /** The session's cwd does not exist here (a remote or removed worktree). */
  | { readonly status: 'not-local' }
  /** No transcript with this id under the cwd's project. */
  | { readonly status: 'missing' }
  | {
      readonly status: 'ambiguous' | 'invalid' | 'unavailable';
    };

/**
 * Locates the transcript of one exact session id that another runtime
 * reported (super.engineering's terminal `session_id`), with the same
 * safeguards as current-session identity: a credential-free id, a
 * canonical cwd, no links or foreign owners on the path, and a project
 * directory that matches the cwd. It never ranks or picks among sessions:
 * a second exact match is ambiguous. Claude Code paths are checked
 * directly; Codex rollouts are found by a bounded exact-name scan. The
 * caller must still confirm, on the handle it reads, that the file's own
 * first records name this session and cwd: the file can be replaced after
 * it is located.
 */
export async function locateTranscriptById(options: {
  readonly runtime: 'claude-code' | 'codex';
  readonly id: string;
  readonly cwd: string;
  readonly homeDir?: string;
  readonly maxEntries?: number;
}): Promise<TranscriptLocation> {
  if (!safeRuntimeId(options.id, new Set()) || !isAbsolute(options.cwd)) {
    return { status: 'invalid' };
  }
  if (typeof process.getuid !== 'function') {
    return { status: 'unavailable' };
  }
  let cwd: string;
  try {
    cwd = await realpath(options.cwd);
  } catch (error) {
    return errorCode(error) === 'ENOENT'
      ? { status: 'not-local' }
      : { status: 'unavailable' };
  }
  try {
    const home = await realpath(options.homeDir ?? homedir());
    if (options.runtime === 'codex') {
      const root = join(home, '.codex', 'sessions');
      if (!(await safePath(home, root, false))) return { status: 'invalid' };
      const scan = await scanExact(
        root,
        'codex',
        options.id,
        options.maxEntries ?? MAX_ENTRIES,
        home,
      );
      if (scan.saturated || scan.paths.length > 1)
        return { status: 'ambiguous' };
      if (scan.inaccessible) return { status: 'unavailable' };
      const path = scan.paths[0];
      if (path === undefined) return { status: 'missing' };
      return (await safePath(home, path, true))
        ? { status: 'found', path, cwd }
        : { status: 'invalid' };
    }

    const root = join(home, '.claude', 'projects');
    // Claude Code names a project directory by its cwd with every other
    // character than a letter or digit turned into `-` (all 364 CLI and SDK
    // transcripts checked on 2026-10-26); the older forms are kept too.
    const slugs = new Set(
      [options.cwd, cwd].flatMap((path) => [
        path.replace(/[^A-Za-z0-9]/g, '-'),
        path.replace(/[/.]/g, '-'),
      ]),
    );
    const found: string[] = [];
    for (const slug of slugs) {
      const path = join(root, slug, `${options.id}.jsonl`);
      try {
        await lstat(path);
      } catch (error) {
        if (errorCode(error) === 'ENOENT') continue;
        return { status: 'unavailable' };
      }
      found.push(path);
    }
    if (found.length > 1) return { status: 'ambiguous' };
    const path = found[0];
    if (path === undefined) return { status: 'missing' };
    return (await safePath(home, path, true))
      ? { status: 'found', path, cwd }
      : { status: 'invalid' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Repeats bounded uniqueness selection after live probes; never keeps a stale path. */
export async function revalidateCurrentTranscript(
  previous: CurrentTranscriptIdentity,
  options: CurrentTranscriptOptions,
): Promise<CurrentTranscriptIdentity> {
  const current = await identifyCurrentTranscript(options);
  if (
    previous.runtime !== current.runtime ||
    previous.runtimeId !== current.runtimeId ||
    (previous.path !== null &&
      current.path !== null &&
      previous.path !== current.path)
  ) {
    return failed(current, 'ambiguous', 'W_IDENTITY_CHANGED');
  }
  return current;
}

function baseParent(parent: SelectedId): string | null {
  return parent.state === 'valid' ? parent.id : null;
}

function selectId(
  env: Readonly<Record<string, string | undefined>>,
  sources: readonly string[],
  deniedValues: ReadonlySet<string>,
): SelectedId {
  const present = sources.filter((source) => env[source] !== undefined);
  if (present.length === 0) return { id: null, source: null, state: 'absent' };
  const source = present.join('+');
  if (present.some((name) => !safeRuntimeId(env[name]!, deniedValues)))
    return { id: null, source, state: 'invalid' };
  const ids = new Set(present.map((name) => env[name]!));
  if (ids.size !== 1) return { id: null, source, state: 'ambiguous' };
  return { id: env[present[0]!]!, source, state: 'valid' };
}

function failed(
  base: CurrentTranscriptIdentity,
  status: TranscriptIdentityStatus,
  warning: string,
): CurrentTranscriptIdentity {
  return {
    ...base,
    status,
    path: null,
    transcriptMetadataId: null,
    warningCodes: [...base.warningCodes, warning],
  };
}

/** Checks every provider path segment beneath canonical home, without following links. */
async function safePath(
  home: string,
  path: string,
  file: boolean,
): Promise<boolean> {
  const rel = relative(home, path);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
    return false;
  let segment = home;
  const parts = rel.split(sep);
  for (let index = 0; index < parts.length; index += 1) {
    segment = join(segment, parts[index]!);
    const info = await lstat(segment);
    if (info.isSymbolicLink() || info.uid !== process.getuid!()) return false;
    if (
      index === parts.length - 1 && file ? !info.isFile() : !info.isDirectory()
    )
      return false;
  }
  await access(path, constants.R_OK);
  return (await realpath(path)) === path;
}

/** Streams entries; bounded traversal stores only the current path and exact matches. */
async function scanExact(
  root: string,
  runtime: Exclude<TranscriptIdentityRuntime, 'unknown'>,
  id: string,
  maxEntries: number,
  home: string,
) {
  const paths: string[] = [];
  let entries = 0;
  let saturated = false;
  let inaccessible = false;
  async function walk(directory: string, depth: number): Promise<void> {
    if (saturated) return;
    try {
      if (!(await safePath(home, directory, false))) {
        inaccessible = true;
        return;
      }
      const dir = await opendir(directory, { bufferSize: 1 });
      for await (const entry of dir) {
        if (entries >= maxEntries) {
          saturated = true;
          break;
        }
        entries += 1;
        const path = join(directory, entry.name);
        const filename =
          runtime === 'codex'
            ? depth === 3 &&
              /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/.exec(
                entry.name,
              )?.[1] === id
            : entry.name === `${id}.jsonl` &&
              depth === (runtime === 'claude-code' ? 1 : 3);
        if (filename) paths.push(path);
        const descend =
          runtime === 'codex'
            ? depth < 3 &&
              (depth === 0
                ? /^\d{4}$/.test(entry.name)
                : /^\d{2}$/.test(entry.name))
            : runtime === 'claude-code'
              ? depth === 0
              : depth === 0 ||
                (depth === 1 && entry.name === 'agent-transcripts') ||
                (depth === 2 && entry.name === id);
        if (descend && entry.isSymbolicLink()) inaccessible = true;
        else if (descend && entry.isDirectory()) await walk(path, depth + 1);
        if (saturated) break;
      }
    } catch {
      inaccessible = true;
    }
  }
  await walk(root, 0);
  return { paths, saturated, inaccessible };
}

function sensitiveEnvValues(
  env: Readonly<Record<string, string | undefined>>,
): ReadonlySet<string> {
  // Values are used only as a denylist, never copied into diagnostics.
  const sensitiveName =
    /(?:^|_)(?:KEY|API_?KEY|ACCESS_KEY|PRIVATE_KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?|AUTH|AUTHORIZATION|ENDPOINT|URL|URI|DSN)(?:_|$)/i;
  return new Set(
    Object.entries(env).flatMap(([name, value]) =>
      sensitiveName.test(name) && typeof value === 'string' && value.length > 0
        ? [value]
        : [],
    ),
  );
}

function safeRuntimeId(
  value: string,
  deniedValues: ReadonlySet<string>,
): boolean {
  if (!ID.test(value) || deniedValues.has(value)) return false;
  const credential =
    /^(?:sk[-_]|gh[pousr]_|github_pat_|glpat-|xox[baprs]-|AKIA[A-Z0-9]{16}$|eyJ[A-Za-z0-9_-]+\.)/i;
  const credentialLabel =
    /(?:^|[-_.])(?:secret|token|credentials?|password|api[-_.]?key)(?:[-_.]|$)/i;
  const endpoint =
    /^(?:[a-z][a-z0-9+.-]*:\/\/|(?:[a-z0-9-]+\.)+[a-z]{2,}$|(?:\d{1,3}\.){3}\d{1,3}$|localhost$)/i;
  return (
    !credential.test(value) &&
    !credentialLabel.test(value) &&
    !endpoint.test(value)
  );
}

function sameTranscriptFile(
  expected: TranscriptFileIdentity,
  current: Stats,
): boolean {
  return (
    current.isFile() &&
    !current.isSymbolicLink() &&
    current.uid === process.getuid!() &&
    expected.dev === current.dev &&
    expected.ino === current.ino &&
    expected.size === current.size &&
    expected.mtimeMs === current.mtimeMs &&
    expected.ctimeMs === current.ctimeMs &&
    expected.uid === current.uid &&
    expected.mode === current.mode
  );
}

/** Only the first complete metadata line is decoded; subsequent content is ignored. */
async function codexMetadata(path: string): Promise<{
  id: string;
  cwd: string;
  fileIdentity: TranscriptFileIdentity;
  lineage?: CurrentTranscriptIdentity['lineage'];
} | null> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.uid !== process.getuid!()) return null;
    const buffer = Buffer.alloc(1024);
    const chunks: Buffer[] = [];
    let size = 0;
    let complete = false;
    while (size < MAX_METADATA_BYTES) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.length, MAX_METADATA_BYTES - size),
        null,
      );
      if (bytesRead === 0) break;
      const newline = buffer.subarray(0, bytesRead).indexOf(10);
      const chunk = Buffer.from(
        buffer.subarray(0, newline < 0 ? bytesRead : newline),
      );
      chunks.push(chunk);
      size += chunk.length;
      if (newline >= 0) {
        complete = true;
        break;
      }
    }
    if (!complete) return null;
    const after = await lstat(path);
    if (!sameTranscriptFile(before, after)) return null;
    const record: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !isRecord(record) ||
      record.type !== 'session_meta' ||
      !isRecord(record.payload)
    )
      return null;
    const { id, cwd } = record.payload;
    const meta = extractMetaFromRecords('codex', [record], path);
    if (!meta) return null;
    const {
      rootSessionId,
      parentSessionId,
      forkedFromSessionId,
      subagentHistoryStartOrdinal,
    } = meta;
    const lineage =
      rootSessionId ||
      parentSessionId ||
      forkedFromSessionId ||
      subagentHistoryStartOrdinal !== undefined
        ? {
            nativeSessionId: meta.nativeSessionId,
            ...(rootSessionId ? { rootSessionId } : {}),
            ...(parentSessionId ? { parentSessionId } : {}),
            ...(forkedFromSessionId ? { forkedFromSessionId } : {}),
            ...(subagentHistoryStartOrdinal !== undefined
              ? { subagentHistoryStartOrdinal }
              : {}),
          }
        : undefined;
    if (
      [rootSessionId, parentSessionId, forkedFromSessionId].some(
        (value) => value !== undefined && !safeRuntimeId(value, new Set()),
      )
    )
      return null;
    return typeof id === 'string' && ID.test(id) && typeof cwd === 'string'
      ? { id, cwd, fileIdentity: before, ...(lineage ? { lineage } : {}) }
      : null;
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorCode(error: unknown): unknown {
  return isRecord(error) ? error.code : null;
}
