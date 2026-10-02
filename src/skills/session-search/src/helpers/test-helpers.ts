/**
 * Test-only builders for synthetic, real-shaped session stores.
 *
 * Record shapes follow documentation/docs/engineering/architecture/
 * session-schemas/{claude-code,codex,cursor}.md. Every builder writes under a
 * temporary HOME and sets file mtimes with `utimes`, so time-window tests are
 * deterministic. `src/helpers/` is exempt from the runtime closure and is never
 * bundled.
 */
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveOptions, type RawOptionValues } from '../lib/options.js';
import type {
  AdapterContext,
  SessionFile,
  SourceAdapter,
  ToolPaths,
} from '../lib/types.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** Harness-detection variables blanked in every CLI run. */
export const HARNESS_ENV: Readonly<Record<string, string>> = {
  CLAUDECODE: '',
  CLAUDE_CODE_ENTRYPOINT: '',
  CLAUDE_CODE_SESSION_ID: '',
  CLAUDE_SESSION_ID: '',
  CODEX_THREAD_ID: '',
  CODEX_SESSION_ID: '',
  CODEX_SANDBOX: '',
  OPENAI_CODEX_SESSION_ID: '',
  CURSOR_TRACE_ID: '',
  CURSOR_AGENT: '',
  CURSOR_SESSION_ID: '',
};

export interface TempHome {
  root: string;
  home: string;
  stateDir: string;
  cleanup(): void;
}

/** Create a temporary HOME plus STATE_DIR. Call `cleanup()` in `afterEach`. */
export function makeTempHome(prefix = 'session-search-'): TempHome {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  const home = path.join(root, 'home');
  const stateDir = path.join(root, 'state');
  mkdirSync(home, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  return {
    root,
    home,
    stateDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/**
 * Environment for running search code against a temp HOME: HOME and STATE_DIR
 * point at the temp tree, harness detection is blanked, and accelerators are
 * forced off unless `extra` re-enables them.
 */
export function searchEnv(
  temp: TempHome,
  extra: Record<string, string> = {},
): Record<string, string | undefined> {
  return {
    PATH: process.env.PATH,
    HOME: temp.home,
    STATE_DIR: temp.stateDir,
    ...HARNESS_ENV,
    SESSION_SEARCH_NO_RG: '1',
    SESSION_SEARCH_NO_SQLITE3: '1',
    ...STUB_PROBE_ENV,
    ...extra,
  };
}

/**
 * Generous `--version` probe timeout for tests that spawn stub executables.
 * Under heavy load a shell stub can take longer than the 3 s default to
 * answer, and the probe would then report it as absent.
 */
export const STUB_PROBE_ENV: Readonly<Record<string, string>> = {
  SESSION_SEARCH_PROBE_TIMEOUT_MS: '20000',
};

/** Add the stub probe timeout to an ad-hoc probe environment. */
export function withStubProbe(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return { ...STUB_PROBE_ENV, ...env };
}

export interface TestContext {
  ctx: AdapterContext;
  /** Notes passed to `ctx.degrade`. */
  degraded: string[];
}

/**
 * Build an adapter context over a temp HOME. `raw` uses CLI flag names
 * (e.g. `{ pattern: ['x'], 'include-tools': true }`).
 */
export function adapterContext(
  adapter: SourceAdapter,
  temp: TempHome,
  init: {
    raw?: RawOptionValues;
    files?: SessionFile[];
    tools?: Partial<ToolPaths>;
    env?: Record<string, string | undefined>;
  } = {},
): TestContext {
  const degraded: string[] = [];
  const ctx: AdapterContext = {
    home: temp.home,
    env: init.env ?? searchEnv(temp),
    options: resolveOptions(init.raw ?? { pattern: ['x'] }, {
      home: temp.home,
      cwd: temp.home,
    }),
    tools: { rg: null, sqlite3: null, ...init.tools },
    roots: adapter.roots(temp.home),
    files: init.files ?? [],
    degrade: (note) => {
      degraded.push(note);
    },
  };
  return { ctx, degraded };
}

/** Set a file's mtime (and atime) to `ms`. */
export function setMtime(file: string, ms: number): void {
  const seconds = ms / 1000;
  utimesSync(file, seconds, seconds);
}

/** Write records as JSONL (LF-terminated) and optionally set the mtime. */
export function writeJsonl(
  file: string,
  records: readonly unknown[],
  mtimeMs?: number,
): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    records
      .map((record) =>
        typeof record === 'string' ? record : JSON.stringify(record),
      )
      .join('\n') + '\n',
  );
  if (mtimeMs !== undefined) setMtime(file, mtimeMs);
  return file;
}

/** Write an executable stub script and return its path. */
export function writeExecutable(file: string, body: string): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  chmodSync(file, 0o755);
  return file;
}

// ---------------------------------------------------------------------------
// Claude Code
// ---------------------------------------------------------------------------

/** Claude's current project-directory slug: '/' and '.' become '-'. */
export function claudeSlug(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

export interface ClaudeEnvelope {
  sessionId: string;
  cwd: string;
  timestamp?: string;
  isSidechain?: boolean;
  agentId?: string;
}

function claudeEnvelope(env: ClaudeEnvelope) {
  return {
    parentUuid: null,
    isSidechain: env.isSidechain ?? false,
    userType: 'external',
    cwd: env.cwd,
    sessionId: env.sessionId,
    version: '2.1.270',
    gitBranch: 'main',
    ...(env.agentId ? { agentId: env.agentId } : {}),
    uuid: randomUUID(),
    timestamp: env.timestamp ?? '2026-09-20T10:00:00.000Z',
  };
}

/** A human-typed Claude user message (string content). */
export function claudeUser(
  env: ClaudeEnvelope,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return {
    ...claudeEnvelope(env),
    type: 'user',
    promptSource: 'typed',
    origin: { kind: 'human' },
    message: { role: 'user', content: text },
    ...extra,
  };
}

/** One Claude assistant content-block record carrying text. */
export function claudeAssistant(env: ClaudeEnvelope, text: string) {
  return {
    ...claudeEnvelope(env),
    type: 'assistant',
    requestId: `req_${randomUUID()}`,
    message: {
      id: `msg_${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
    },
  };
}

/** A Claude assistant record carrying one `tool_use` block. */
export function claudeToolUse(
  env: ClaudeEnvelope,
  id: string,
  name: string,
  input: Record<string, unknown>,
) {
  return {
    ...claudeEnvelope(env),
    type: 'assistant',
    message: {
      id: `msg_${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [{ type: 'tool_use', id, name, input }],
      stop_reason: 'tool_use',
    },
  };
}

/** A Claude user record carrying one `tool_result` block. */
export function claudeToolResult(
  env: ClaudeEnvelope,
  toolUseId: string,
  content: string | Array<{ type: 'text'; text: string }>,
) {
  return {
    ...claudeEnvelope(env),
    type: 'user',
    sourceToolAssistantUUID: randomUUID(),
    message: {
      role: 'user',
      content: [
        {
          tool_use_id: toolUseId,
          type: 'tool_result',
          content,
          is_error: false,
        },
      ],
    },
    toolUseResult: {
      stdout: typeof content === 'string' ? content : '',
      stderr: '',
      interrupted: false,
      isImage: false,
    },
  };
}

/** A Claude `ai-title` or `custom-title` record. */
export function claudeTitle(
  kind: 'ai-title' | 'custom-title',
  sessionId: string,
  title: string,
) {
  return kind === 'ai-title'
    ? { type: 'ai-title', aiTitle: title, sessionId }
    : { type: 'custom-title', customTitle: title, sessionId };
}

export interface ClaudeSessionSpec {
  cwd: string;
  sessionId?: string;
  /** Build records for this session (the envelope carries id and cwd). */
  records: (env: ClaudeEnvelope) => unknown[];
  mtimeMs?: number;
  /** Directly spawned subagents under `<sid>/subagents/agent-<id>.jsonl`. */
  subagents?: Array<{
    agentId: string;
    records: (env: ClaudeEnvelope) => unknown[];
    /** Workflow-spawned: nested under `subagents/workflows/wf_<id>/`. */
    workflow?: string;
  }>;
  /** Also write a workflow `journal.jsonl` decoy with these texts. */
  journal?: string[];
}

export interface WrittenClaudeSession {
  sessionId: string;
  path: string;
  slug: string;
  subagentPaths: string[];
  journalPath: string | null;
}

/** Write a Claude parent transcript plus optional subagents and a journal. */
export function writeClaudeSession(
  home: string,
  spec: ClaudeSessionSpec,
): WrittenClaudeSession {
  const sessionId = spec.sessionId ?? randomUUID();
  const slug = claudeSlug(spec.cwd);
  const projectDir = path.join(home, '.claude', 'projects', slug);
  const file = writeJsonl(
    path.join(projectDir, `${sessionId}.jsonl`),
    spec.records({ sessionId, cwd: spec.cwd }),
    spec.mtimeMs,
  );
  const subagentPaths: string[] = [];
  for (const subagent of spec.subagents ?? []) {
    const dir = subagent.workflow
      ? path.join(
          projectDir,
          sessionId,
          'subagents',
          'workflows',
          `wf_${subagent.workflow}`,
        )
      : path.join(projectDir, sessionId, 'subagents');
    const agentFile = path.join(dir, `agent-${subagent.agentId}.jsonl`);
    writeJsonl(
      agentFile,
      subagent.records({
        sessionId,
        cwd: spec.cwd,
        isSidechain: true,
        agentId: subagent.agentId,
      }),
      spec.mtimeMs,
    );
    writeFileSync(
      agentFile.replace(/\.jsonl$/, '.meta.json'),
      JSON.stringify({ agentType: 'general-purpose', spawnDepth: 1 }),
    );
    subagentPaths.push(agentFile);
  }
  let journalPath: string | null = null;
  if (spec.journal) {
    journalPath = writeJsonl(
      path.join(
        projectDir,
        sessionId,
        'subagents',
        'workflows',
        'wf_journal',
        'journal.jsonl',
      ),
      spec.journal.map((text) => ({ type: 'started', text })),
      spec.mtimeMs,
    );
  }
  return { sessionId, path: file, slug, subagentPaths, journalPath };
}

/** Write `~/.claude/history.jsonl`. `timestamp` is epoch milliseconds. */
export function writeClaudeHistory(
  home: string,
  entries: Array<{
    display: string;
    project: string;
    sessionId: string;
    timestamp: number;
  }>,
): string {
  return writeJsonl(
    path.join(home, '.claude', 'history.jsonl'),
    entries.map((entry) => ({
      display: entry.display,
      pastedContents: {},
      timestamp: entry.timestamp,
      project: entry.project,
      sessionId: entry.sessionId,
    })),
  );
}

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

export interface CodexMetaSpec {
  id: string;
  /** Root thread id; differs from `id` for a child (subagent) rollout. */
  sessionId?: string;
  cwd: string;
  timestamp?: string;
  subagentHistoryStartOrdinal?: number;
  /** Size of a synthetic `base_instructions.text` (bytes). */
  baseInstructionsBytes?: number;
  /** Override `payload.source` (e.g. `{ subagent: 'review' }`). */
  source?: unknown;
}

/** A Codex `session_meta` header record (ordinal 0). */
export function codexSessionMeta(spec: CodexMetaSpec, ordinal = 0) {
  const isChild = spec.sessionId !== undefined && spec.sessionId !== spec.id;
  return {
    timestamp: spec.timestamp ?? '2026-09-20T10:00:00.000Z',
    ordinal,
    type: 'session_meta',
    payload: {
      session_id: spec.sessionId ?? spec.id,
      id: spec.id,
      timestamp: spec.timestamp ?? '2026-09-20T10:00:00.000Z',
      cwd: spec.cwd,
      originator: 'codex_cli_rs',
      cli_version: '0.153.0',
      source:
        spec.source !== undefined
          ? spec.source
          : isChild
            ? {
                subagent: {
                  thread_spawn: {
                    parent_thread_id: spec.sessionId,
                    depth: 1,
                    agent_nickname: 'helper',
                  },
                },
              }
            : 'cli',
      model_provider: 'openai',
      base_instructions: {
        text: 'x'.repeat(spec.baseInstructionsBytes ?? 2048),
      },
      ...(spec.subagentHistoryStartOrdinal === undefined
        ? {}
        : {
            subagent_history_start_ordinal: spec.subagentHistoryStartOrdinal,
          }),
      git: { branch: 'main', commit_hash: 'abc', repository_url: 'local' },
    },
  };
}

/** A Codex `response_item` message record. */
export function codexMessage(
  role: 'user' | 'assistant' | 'developer',
  text: string,
  ordinal: number,
) {
  return {
    timestamp: '2026-09-20T10:01:00.000Z',
    ordinal,
    type: 'response_item',
    payload: {
      type: 'message',
      id: `msg_${ordinal}`,
      role,
      content: [
        { type: role === 'assistant' ? 'output_text' : 'input_text', text },
      ],
    },
  };
}

/** The duplicate `event_msg` `user_message` record. */
export function codexEventUserMessage(text: string, ordinal: number) {
  return {
    timestamp: '2026-09-20T10:01:00.000Z',
    ordinal,
    type: 'event_msg',
    payload: { type: 'user_message', message: text, images: [] },
  };
}

/** A `response_item` `function_call` with JSON-string arguments. */
export function codexFunctionCall(
  callId: string,
  name: string,
  args: Record<string, unknown>,
  ordinal: number,
) {
  return {
    timestamp: '2026-09-20T10:02:00.000Z',
    ordinal,
    type: 'response_item',
    payload: {
      type: 'function_call',
      id: `fc_${ordinal}`,
      name,
      arguments: JSON.stringify(args),
      call_id: callId,
    },
  };
}

/** A `function_call_output` / `custom_tool_call_output` record. */
export function codexToolOutput(
  kind: 'function_call_output' | 'custom_tool_call_output',
  callId: string,
  output: string | Array<{ type: 'input_text'; text: string }>,
  ordinal: number,
) {
  return {
    timestamp: '2026-09-20T10:02:01.000Z',
    ordinal,
    type: 'response_item',
    payload: { type: kind, id: `out_${ordinal}`, call_id: callId, output },
    metadata: { client_authored: false },
  };
}

/** An `event_msg` `item_completed` `CommandExecution` record. */
export function codexCommandExecution(output: string, ordinal: number) {
  return {
    timestamp: '2026-09-20T10:02:02.000Z',
    ordinal,
    type: 'event_msg',
    payload: {
      type: 'item_completed',
      thread_id: 'thread',
      turn_id: 'turn',
      item: {
        type: 'CommandExecution',
        id: `item_${ordinal}`,
        command: ['/bin/zsh', '-lc', 'ls'],
        status: 'completed',
        stdout: output,
        stderr: '',
        aggregated_output: output,
        exit_code: 0,
      },
    },
  };
}

/** An `event_msg` `item_completed` record wrapping an `item` (type first). */
export function codexItemCompleted(
  item: Record<string, unknown>,
  ordinal: number,
) {
  return {
    timestamp: '2026-09-20T10:02:03.000Z',
    ordinal,
    type: 'event_msg',
    payload: {
      type: 'item_completed',
      thread_id: 'thread',
      turn_id: 'turn',
      // Observed records lead with `type`, which the raw-carrier prefix
      // check relies on.
      item: {
        type: item.type,
        id: `item_${ordinal}`,
        status: 'completed',
        ...item,
      },
      started_at_ms: 1_790_000_000_000,
      completed_at_ms: 1_790_000_001_000,
    },
  };
}

export interface CodexMcpToolCallSpec {
  server?: string;
  tool?: string;
  arguments?: unknown;
  /** `result.content` blocks; strings become `{type: 'text', text}`. */
  content: Array<string | Record<string, unknown>>;
  structuredContent?: unknown;
  isError?: boolean;
}

/** An `item_completed` `McpToolCall` in the shape real Codex rollouts record. */
export function codexMcpToolCall(spec: CodexMcpToolCallSpec, ordinal: number) {
  return codexItemCompleted(
    {
      type: 'McpToolCall',
      server: spec.server ?? 'chat',
      tool: spec.tool ?? 'list_threads',
      arguments: spec.arguments ?? { limit: 20 },
      result: {
        content: spec.content.map((block) =>
          typeof block === 'string' ? { type: 'text', text: block } : block,
        ),
        isError: spec.isError ?? false,
        ...(spec.structuredContent === undefined
          ? {}
          : { structuredContent: spec.structuredContent }),
      },
      duration: { secs: 1, nanos: 0 },
    },
    ordinal,
  );
}

/** An `item_completed` `Extension` web search, in the observed key shape. */
export function codexExtensionWebSearch(
  query: string,
  results: Array<{ title: string; snippet: string }>,
  ordinal: number,
) {
  return codexItemCompleted(
    {
      type: 'Extension',
      kind: 'web_search',
      query,
      action: { type: 'search', url: 'https://example.invalid/search' },
      results: results.map((result, index) => ({
        type: 'web_result',
        ref_id: `ref_${index}`,
        ...result,
      })),
    },
    ordinal,
  );
}

/**
 * An `item_completed` `CollabAgentToolCall`, in the observed key shape: agent
 * routing metadata only, with no result, output, or content text.
 */
export function codexCollabAgentToolCall(
  agentsStates: Record<string, unknown>,
  ordinal: number,
) {
  return codexItemCompleted(
    {
      type: 'CollabAgentToolCall',
      tool: 'spawn_agent',
      sender_thread_id: 'thread-parent',
      receiver_thread_ids: ['thread-child'],
      receiver_agents: [],
      agents_states: agentsStates,
    },
    ordinal,
  );
}

/** A Codex `world_state` record carrying AGENTS.md text. */
export function codexWorldState(agentsMd: string, ordinal: number) {
  return {
    timestamp: '2026-09-20T10:00:01.000Z',
    ordinal,
    type: 'world_state',
    payload: {
      full: true,
      state: { agents_md: { directory: '/repo', text: agentsMd } },
    },
  };
}

/** Rollout filename timestamp: local `YYYY-MM-DDTHH-MM-SS`. */
export function codexFileStamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export interface CodexRolloutSpec {
  id: string;
  records: unknown[];
  startedAtMs: number;
  mtimeMs?: number;
  archived?: boolean;
}

/** Write a rollout under `sessions/YYYY/MM/DD/` or `archived_sessions/`. */
export function writeCodexRollout(
  home: string,
  spec: CodexRolloutSpec,
): string {
  const stamp = codexFileStamp(spec.startedAtMs);
  const name = `rollout-${stamp}-${spec.id}.jsonl`;
  const [year, month, day] = stamp.slice(0, 10).split('-');
  const dir = spec.archived
    ? path.join(home, '.codex', 'archived_sessions')
    : path.join(home, '.codex', 'sessions', year, month, day);
  return writeJsonl(
    path.join(dir, name),
    spec.records,
    spec.mtimeMs ?? spec.startedAtMs,
  );
}

/** Write `~/.codex/history.jsonl`. `ts` is epoch seconds. */
export function writeCodexHistory(
  home: string,
  entries: Array<{ session_id: string; ts: number; text: string }>,
): string {
  return writeJsonl(path.join(home, '.codex', 'history.jsonl'), entries);
}

/** Write `~/.codex/session_index.jsonl`. */
export function writeCodexSessionIndex(
  home: string,
  entries: Array<{ id: string; thread_name: string; updated_at: string }>,
): string {
  return writeJsonl(path.join(home, '.codex', 'session_index.jsonl'), entries);
}

/**
 * Write a stub `sqlite3` that answers `--version`, the threads PRAGMA, and the
 * SELECT with canned JSON, and touch `~/.codex/state_5.sqlite`.
 */
export function writeSqliteStub(
  temp: TempHome,
  columns: string[],
  rows: Array<Record<string, unknown>>,
): string {
  mkdirSync(path.join(temp.home, '.codex'), { recursive: true });
  writeFileSync(path.join(temp.home, '.codex', 'state_5.sqlite'), '', {
    flag: 'a',
  });
  const dataDir = path.join(temp.root, 'sqlite-stub');
  mkdirSync(dataDir, { recursive: true });
  const pragma = path.join(dataDir, 'pragma.json');
  const select = path.join(dataDir, 'select.json');
  writeFileSync(
    pragma,
    JSON.stringify(
      columns.map((name, cid) => ({
        cid,
        name,
        type: 'TEXT',
        notnull: 0,
        dflt_value: null,
        pk: name === 'id' ? 1 : 0,
      })),
    ),
  );
  writeFileSync(select, JSON.stringify(rows));
  return writeExecutable(
    path.join(dataDir, 'sqlite3'),
    [
      '#!/bin/sh',
      'case "$*" in',
      '  *--version*) echo "3.45.0 stub"; exit 0 ;;',
      `  *PRAGMA*) cat '${pragma}'; exit 0 ;;`,
      `  *SELECT*) cat '${select}'; exit 0 ;;`,
      'esac',
      'exit 1',
      '',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/** Cursor's project slug: non-empty '/'- and '.'-separated segments joined by '-'. */
export function cursorSlug(cwd: string): string {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

export function cursorUser(text: string) {
  return {
    role: 'user',
    message: {
      content: [{ type: 'text', text: `<user_query>\n${text}\n</user_query>` }],
    },
  };
}

export function cursorAssistant(text: string) {
  return { role: 'assistant', message: { content: [{ type: 'text', text }] } };
}

export function cursorToolUse(name: string, input: Record<string, unknown>) {
  return {
    role: 'assistant',
    message: { content: [{ type: 'tool_use', name, input }] },
  };
}

export function cursorTurnEnded(status: 'success' | 'error' = 'success') {
  return status === 'success'
    ? { type: 'turn_ended', status }
    : { type: 'turn_ended', status, error: 'failed' };
}

export interface CursorTranscriptSpec {
  cwd: string;
  id?: string;
  records: unknown[];
  mtimeMs?: number;
  subagents?: Array<{ id: string; records: unknown[] }>;
}

/** Write `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl`. */
export function writeCursorTranscript(
  home: string,
  spec: CursorTranscriptSpec,
): { id: string; path: string; slug: string; subagentPaths: string[] } {
  const id = spec.id ?? randomUUID();
  const slug = cursorSlug(spec.cwd);
  const dir = path.join(
    home,
    '.cursor',
    'projects',
    slug,
    'agent-transcripts',
    id,
  );
  const file = writeJsonl(
    path.join(dir, `${id}.jsonl`),
    spec.records,
    spec.mtimeMs,
  );
  const subagentPaths = (spec.subagents ?? []).map((child) =>
    writeJsonl(
      path.join(dir, 'subagents', `${child.id}.jsonl`),
      child.records,
      spec.mtimeMs,
    ),
  );
  return { id, path: file, slug, subagentPaths };
}
