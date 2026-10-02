import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';

import {
  ClassificationCache,
  discover,
} from '../../session-observer/src/lib/locate.js';
import {
  revalidateHandoffTarget,
  validateGuidanceTarget,
  type HandoffGitTargetEvidence,
} from './git-target.js';
import {
  discoverGuidanceCandidates,
  GUIDANCE_DISCOVERY_OPTIONS,
  readGuidanceCodexNativeId,
  selectGuidanceCandidate,
  type GuidanceQualifiedSessionId,
} from './guidance-discovery.js';
import {
  quoteShellWord,
  type GuidanceEntryPoint,
  type PreparedGuidanceInstruction,
} from './guidance.js';
import {
  checkDeadline,
  IMPORT_MAX_BYTES,
  refuse,
  SessionImportError,
} from './import-errors.js';
import {
  inspectImportOccupancy,
  publishImportSeed,
  readImportSnapshot,
  revalidateImportSnapshot,
  sha256,
  type ImportOccupancy,
  type SourceSnapshot,
} from './import-store.js';
import {
  decodeNativeHistory,
  deterministicUuid,
  encodeNativeHistory,
  type ImportProvider,
} from './native-history.js';
export { SessionImportError } from './import-errors.js';
export const SESSION_IMPORT_CONVERTER_REVISION = 'session-import-v1';
export interface SessionImportInput {
  sourcePath: string;
  destinationPath: string;
  session: GuidanceQualifiedSessionId;
  to: ImportProvider;
  entryPoint: GuidanceEntryPoint;
  targetHome?: string;
}
export interface SessionImportPlan {
  version: 1;
  converterRevision: string;
  source: {
    key: GuidanceQualifiedSessionId;
    provider: ImportProvider;
    nativeId: string;
    byteSha256: string;
    byteCount: number;
    recordCount: number;
    inheritedIds: string[];
  };
  destination: string;
  destinationDirty: boolean;
  targetProvider: ImportProvider;
  entryPoint: GuidanceEntryPoint;
  targetHome: {
    source: 'default' | 'environment' | 'explicit';
    routingPath: string;
    canonicalPath: string;
    variable: 'CODEX_HOME' | 'CLAUDE_CONFIG_DIR';
  };
  git: HandoffGitTargetEvidence;
  seed: { id: string; path: string; sha256: string; byteCount: number };
  counts: { items: number; messages: number; calls: number; results: number };
  omissions: Record<string, number>;
  occupancy: ImportOccupancy;
  instructions: PreparedGuidanceInstruction[];
  limitations: string[];
  digest: string;
}
export interface SessionImportResult {
  status: 'imported' | 'already-imported';
  message: 'seed imported; native fork not created';
  plan: SessionImportPlan;
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) refuse('invalid-plan');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object')
    return `{${Object.entries(value)
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`)
      .join(',')}}`;
  refuse('invalid-plan');
}
async function targetHome(
  input: SessionImportInput,
): Promise<SessionImportPlan['targetHome']> {
  const variable = input.to === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR';
  const env = process.env[variable];
  if (input.targetHome === undefined && env === '')
    refuse('invalid-target-home');
  const source =
    input.targetHome !== undefined
      ? 'explicit'
      : env !== undefined
        ? 'environment'
        : 'default';
  const supplied =
    input.targetHome ??
    env ??
    join(homedir(), input.to === 'codex' ? '.codex' : '.claude');
  if (
    !supplied ||
    supplied.includes('\0') ||
    supplied.includes('\r') ||
    supplied.includes('\n')
  )
    refuse('invalid-target-home');
  const routingPath = isAbsolute(supplied)
    ? supplied
    : `${process.cwd()}${sep}${supplied}`;
  const canonicalPath = await realpath(routingPath).catch(() =>
    refuse('target-home-unavailable'),
  );
  return { source, routingPath, canonicalPath, variable };
}
function instructions(
  destination: string,
  home: SessionImportPlan['targetHome'],
  provider: ImportProvider,
  id: string,
  entryPoint: GuidanceEntryPoint,
): PreparedGuidanceInstruction[] {
  const route =
    home.source === 'default'
      ? ''
      : `env ${quoteShellWord(`${home.variable}=${home.routingPath}`)} `;
  const argv =
    provider === 'codex'
      ? `codex fork ${quoteShellWord(id)}`
      : `claude --resume ${quoteShellWord(id)} --fork-session`;
  const defaultGuard =
    home.source === 'default'
      ? ` && test "\${${home.variable}+set}" != set`
      : '';
  const command = `if test "$(pwd -P)" = ${quoteShellWord(destination)}${defaultGuard}; then exec ${route}${argv}; else printf '%s\\n' 'Refusing: open the canonical destination and preserve the reviewed provider-home routing.' >&2; fi`;
  const terminal: PreparedGuidanceInstruction = {
    kind: 'terminal',
    runIn: destination,
    command,
  };
  return entryPoint === 'destination-fresh'
    ? [
        {
          kind: 'manual',
          action: 'exit-current-session',
          explanation:
            'Exit the fresh provider session, remain in the canonical destination, then run this terminal command.',
        },
        terminal,
      ]
    : [terminal];
}
function replay(
  input: SessionImportInput,
  digest: string,
  home: SessionImportPlan['targetHome'],
): string {
  const argv = [
    process.execPath,
    process.argv[1] ?? 'session-fork-to-destination',
    'import',
    '--source',
    input.sourcePath,
    '--target',
    input.destinationPath,
    '--session',
    input.session,
    '--to',
    input.to,
    '--entry-point',
    input.entryPoint,
    ...(input.targetHome === undefined
      ? []
      : ['--target-home', input.targetHome]),
    '--apply',
    '--expect-plan',
    digest,
    '--json',
  ];
  const prefix =
    home.source === 'environment'
      ? `env ${quoteShellWord(`${home.variable}=${home.routingPath}`)} `
      : '';
  const guard =
    home.source === 'default'
      ? ` && test "\${${home.variable}+set}" != set`
      : '';
  return `if test "$(pwd -P)" = ${quoteShellWord(process.cwd())}${guard}; then ${prefix}${argv.map(quoteShellWord).join(' ')}; else printf '%s\\n' 'Refusing: return to the original invocation directory and reviewed home environment.' >&2; fi`;
}
function importDiscoveryFailure(error: unknown): never {
  const e = error as { code?: string; reason?: string };
  if (/BUDGET|DEADLINE|LIMIT/u.test(e.reason ?? e.code ?? ''))
    refuse('import-limit-exceeded');
  refuse('import-source-incomplete');
}

interface InternalPlan {
  plan: SessionImportPlan;
  bytes: Buffer;
  snapshot: SourceSnapshot;
  rawPath: string;
  deadline: number;
}
async function makePlan(input: SessionImportInput): Promise<InternalPlan> {
  const deadline = Date.now() + 30_000;
  if (input.entryPoint === 'source-current')
    refuse(
      'source-current-import-unsupported',
      'Finish the source turn, exit the source session, then invoke from the destination or another session.',
    );
  if (
    !['source-other', 'destination-fresh'].includes(input.entryPoint) ||
    !['codex', 'claude'].includes(input.to)
  )
    refuse('invalid-import-selection');
  if (
    !/^(claude|codex):cli:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      input.session,
    )
  )
    refuse('invalid-import-selection');
  const provider = input.session.split(':')[0] as ImportProvider;
  if (provider === input.to) refuse('same-provider-import-unsupported');
  const git = await validateGuidanceTarget(
    input.sourcePath,
    input.destinationPath,
  );
  checkDeadline(deadline);
  const candidates = await discoverGuidanceCandidates(
    git.source.canonicalPath,
    { providers: [provider] },
  ).catch(importDiscoveryFailure);
  const candidate = (() => {
    try {
      return selectGuidanceCandidate(candidates, input.session);
    } catch {
      refuse('import-source-incomplete');
    }
  })();
  checkDeadline(deadline);
  const runtime = provider === 'codex' ? 'codex' : 'claude-code';
  const raw = await discover(
    runtime,
    git.source.canonicalPath,
    new ClassificationCache(),
    { ...GUIDANCE_DISCOVERY_OPTIONS, unattributablePolicy: 'summarize' },
  ).catch(importDiscoveryFailure);
  const matches = [];
  for (const r of raw) {
    checkDeadline(deadline);
    if (
      r.recordedCwd === null ||
      (await realpath(r.recordedCwd).catch(() => null)) !==
        git.source.canonicalPath
    )
      continue;
    const id =
      provider === 'codex' ? await readGuidanceCodexNativeId(r) : r.sessionId;
    if (id === candidate.nativeId) matches.push(r);
  }
  if (matches.length !== 1) refuse('import-source-incomplete');
  const rawPath = matches[0].transcriptPath;
  const snapshot = await readImportSnapshot(rawPath, deadline);
  const history = await decodeNativeHistory(
    provider,
    snapshot.records,
    candidate.nativeId,
    git.source.canonicalPath,
    rawPath,
    deadline,
  );
  if (input.to === 'claude')
    for (const item of history.items) {
      if (item.kind === 'call' && item.namespace !== undefined)
        history.omissions['tool-namespace'] =
          (history.omissions['tool-namespace'] ?? 0) + 1;
      if (item.kind === 'call' && item.callKind === 'custom_tool_call')
        history.omissions['custom-call-kind'] =
          (history.omissions['custom-call-kind'] ?? 0) + 1;
      if (item.kind === 'text' && item.phase !== undefined)
        history.omissions['assistant-phase'] =
          (history.omissions['assistant-phase'] ?? 0) + 1;
    }
  const home = await targetHome(input);
  for (const worktree of [git.source.canonicalPath, git.target.canonicalPath]) {
    const rel = relative(worktree, home.canonicalPath);
    if (
      rel === '' ||
      (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep))
    )
      refuse(
        'target-home-within-worktree',
        'Provider homes inside either selected worktree are unsupported; choose a home outside the worktrees.',
      );
  }
  checkDeadline(deadline);
  const id = deterministicUuid(
    canonicalJson({
      converterRevision: SESSION_IMPORT_CONVERTER_REVISION,
      provider,
      nativeId: candidate.nativeId,
      sourceDigest: snapshot.digest,
      to: input.to,
      destination: git.target.canonicalPath,
      home: home.canonicalPath,
    }),
  );
  let path: string;
  if (input.to === 'codex')
    path = join(
      home.canonicalPath,
      'sessions',
      ...history.timestamp.slice(0, 10).split('-'),
      `rollout-${history.timestamp.slice(0, 19).replaceAll(':', '-')}-${id}.jsonl`,
    );
  else {
    const key = git.target.canonicalPath.replace(/[^A-Za-z0-9]/gu, '-');
    if (key.length > 200) refuse('unsupported-claude-project-key');
    path = join(home.canonicalPath, 'projects', key, `${id}.jsonl`);
  }
  const provenance = {
    version: 1,
    sourceProvider: provider,
    sourceId: candidate.nativeId,
    sourceDigest: snapshot.digest,
    converterRevision: SESSION_IMPORT_CONVERTER_REVISION,
    omissions: history.omissions,
  };
  const bytes = Buffer.from(
    encodeNativeHistory(
      input.to,
      history,
      id,
      git.target.canonicalPath,
      provenance,
    ),
  );
  if (bytes.length > IMPORT_MAX_BYTES) refuse('import-limit-exceeded');
  const occupancy = await inspectImportOccupancy(
    home.canonicalPath,
    path,
    id,
    input.to,
    bytes,
    deadline,
  ).catch((error) => {
    if (
      ['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')
    )
      refuse('store-unreadable');
    throw error;
  });
  const planWithoutDigest: Omit<SessionImportPlan, 'digest'> = {
    version: 1,
    converterRevision: SESSION_IMPORT_CONVERTER_REVISION,
    source: {
      key: input.session,
      provider,
      nativeId: candidate.nativeId,
      byteSha256: snapshot.digest,
      byteCount: snapshot.bytes.length,
      recordCount: snapshot.records.length,
      inheritedIds: history.inheritedIds,
    },
    destination: git.target.canonicalPath,
    destinationDirty: git.target.dirty,
    targetProvider: input.to,
    entryPoint: input.entryPoint,
    targetHome: home,
    git,
    seed: { id, path, sha256: sha256(bytes), byteCount: bytes.length },
    counts: {
      items: history.items.length,
      messages: history.items.filter((i) => i.kind === 'text').length,
      calls: history.items.filter((i) => i.kind === 'call').length,
      results: history.items.filter((i) => i.kind === 'result').length,
    },
    omissions: history.omissions,
    occupancy,
    instructions: instructions(
      git.target.canonicalPath,
      home,
      input.to,
      id,
      input.entryPoint,
    ),
    limitations: [
      'Raw supported text and tool payloads are preserved and may contain secrets; metadata omission is not secret detection or redaction.',
      'This is a reconstructed seed; native fork not created.',
      'Source lookup uses conventional source homes and exact recorded cwd.',
      'Provider client acceptance is version-specific; historical baselines Codex 0.157.1 and Claude Code 2.1.284 do not establish this generated importer acceptance or sidebar placement.',
      'Requires an inactive completed CLI source; source-current is unsupported.',
      'Provider homes inside either selected worktree are unsupported.',
      'Source and output are capped at 32 MiB; source records at 100,000; lines at 4 MiB; operations at 30 seconds and store enumeration at 50,000 entries.',
      'Summary-only Codex compaction is unsupported; Claude project keys over 200 characters are unsupported.',
    ],
  };
  const { occupancy: _occupancy, ...digestFields } = planWithoutDigest;
  const plan = {
    ...planWithoutDigest,
    digest: sha256(canonicalJson(digestFields)),
  };
  checkDeadline(deadline);
  return { plan, bytes, snapshot, rawPath, deadline };
}
export async function planSessionImport(
  input: SessionImportInput,
): Promise<SessionImportPlan> {
  return (await makePlan(input)).plan;
}
export async function applySessionImport(
  input: SessionImportInput,
  expectedDigest: string,
): Promise<SessionImportResult> {
  if (!/^[0-9a-f]{64}$/u.test(expectedDigest)) refuse('invalid-plan-digest');
  const internal = await makePlan(input);
  const { plan, bytes, snapshot, rawPath, deadline } = internal;
  if (plan.digest !== expectedDigest)
    refuse(
      'import-plan-stale',
      'The source, routing, Git evidence, or conversion changed. Review a new plan before applying.',
    );
  const revalidate = async () => {
    checkDeadline(deadline);
    await revalidateHandoffTarget(plan.git);
    await revalidateImportSnapshot(rawPath, snapshot, deadline);
    const current = await targetHome(input);
    if (canonicalJson(current) !== canonicalJson(plan.targetHome))
      refuse('target-home-drift');
    checkDeadline(deadline);
  };
  try {
    const status = await publishImportSeed(
      plan.targetHome.canonicalPath,
      plan.seed.path,
      plan.seed.id,
      input.to,
      bytes,
      deadline,
      revalidate,
    );
    return {
      status,
      message: 'seed imported; native fork not created',
      plan: { ...plan, occupancy: 'exact' },
    };
  } catch (error) {
    if (
      error instanceof SessionImportError &&
      error.code === 'store-write-denied'
    )
      throw new SessionImportError(
        error.code,
        'The provider store is not writable. Run this exact reviewed apply command in a terminal.' +
          (error.message === error.code ? '' : ` ${error.message}`),
        replay(input, expectedDigest, plan.targetHome),
      );
    throw error;
  }
}
