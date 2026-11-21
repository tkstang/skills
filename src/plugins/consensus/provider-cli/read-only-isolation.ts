import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Read-only peers must not run code the repository controls. Claude and
// Codex get per-invocation flags for that (invocation.ts). Cursor has no flag
// that disables project hooks, so a read-only Cursor run is refused before
// spawn when the repository configures any. Write runs keep loading repo
// config: letting a peer change a repository already means trusting it.

export interface HostFileSystem {
  realpath(filePath: string): string;
  exists(filePath: string): boolean;
  // Undefined when the file does not exist (including a dangling symlink).
  // Any other read error throws.
  readFile(filePath: string): string | undefined;
}

export const nodeHostFileSystem: HostFileSystem = {
  realpath: (filePath) => realpathSync(filePath),
  exists: (filePath) => existsSync(filePath),
  readFile(filePath) {
    try {
      return readFileSync(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  },
};

export interface CodexUserDefaults {
  model?: string;
  effort?: string;
}

// `--ignore-user-config` drops the user's default model and reasoning effort
// along with the rest of `$CODEX_HOME/config.toml`. Read-only Codex runs read
// back only those two top-level keys from the home the child resolves, and
// pass them as explicit flags. Nothing else from the file is used.
export function readCodexUserDefaults(
  env: Record<string, string | undefined>,
  fs: HostFileSystem,
): CodexUserDefaults {
  const codexHome =
    env.CODEX_HOME || path.join(env.HOME || homedir(), '.codex');
  // A relative home would resolve differently for the child, which starts in
  // the requested working directory; leave the defaults to Codex.
  if (!path.isAbsolute(codexHome)) return {};
  let text: string | undefined;
  try {
    text = fs.readFile(path.join(codexHome, 'config.toml'));
  } catch {
    return {};
  }
  if (text === undefined) return {};
  return parseCodexTopLevelDefaults(text);
}

const TOP_LEVEL_KEY =
  /^(model|model_reasoning_effort)\s*=\s*(?:"([^"\\\r\n]*)"|'([^'\r\n]*)')\s*(?:#.*)?$/;

// Top-level keys end at the first table header. Only plain basic or literal
// strings are read; anything else (escapes, multi-line strings, inline tables)
// is ignored, which leaves that default to Codex. Lines inside a multi-line
// string are text, not keys.
export function parseCodexTopLevelDefaults(text: string): CodexUserDefaults {
  const defaults: CodexUserDefaults = {};
  let openDelimiter: '"""' | "'''" | undefined;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const startsInside = openDelimiter !== undefined;
    openDelimiter = multilineStateAfter(line, openDelimiter);
    if (startsInside) continue;
    if (line.startsWith('[')) break;
    const match = TOP_LEVEL_KEY.exec(line);
    if (!match) continue;
    const value = match[2] ?? match[3];
    if (!value) continue;
    if (match[1] === 'model') defaults.model = value;
    else defaults.effort = value;
  }
  return defaults;
}

// Tracks whether a line leaves a TOML multi-line string open. A line that
// opens one is still read as a key line (`key = """...`), which never matches
// the plain-string pattern.
function multilineStateAfter(
  line: string,
  open: '"""' | "'''" | undefined,
): '"""' | "'''" | undefined {
  let state = open;
  let index = 0;
  while (index < line.length) {
    if (state) {
      const close = line.indexOf(state, index);
      if (close === -1) return state;
      index = close + 3;
      state = undefined;
      continue;
    }
    const basic = line.indexOf('"""', index);
    const literal = line.indexOf("'''", index);
    if (basic === -1 && literal === -1) return undefined;
    const useBasic = basic !== -1 && (literal === -1 || basic < literal);
    state = useBasic ? '"""' : "'''";
    index = (useBasic ? basic : literal) + 3;
  }
  return state;
}

// The repo files cursor-agent 2026.11.13 reads hooks from, relative to the
// root it resolves (hooks-exec paths in the installed bundle).
export const CURSOR_REPO_HOOK_FILES = [
  '.cursor/hooks.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
] as const;

export type CursorRepoHookGateResult =
  | { ok: true; root: string }
  | { ok: false; root?: string; file?: string; message: string };

// Mirrors cursor-agent's root walk: from the start directory up to the first
// directory holding a `.git` entry of any kind (a linked worktree's `.git`
// file stops the walk at the worktree), never testing the filesystem root as
// an ancestor; with no `.git`, the start directory itself.
export function resolveCursorHookRoot(
  startDir: string,
  fs: Pick<HostFileSystem, 'exists'>,
): string {
  const fsRoot = path.parse(startDir).root;
  let dir = startDir;
  for (;;) {
    if (fs.exists(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir || parent === fsRoot) return startDir;
    dir = parent;
  }
}

// Refuses when any repo hook file configures a hook. The rule is deliberately
// broader than Cursor's loader, so a Cursor upgrade cannot quietly start
// running something the gate allowed:
// - any `hooks` key holding a non-empty array refuses, whatever the event
//   name, entry shape, `version` or Claude `matcher` (Cursor 2026.11.13 skips
//   Claude files without a `matcher` key, and ignores `disableAllHooks`);
// - a file that does not parse, or cannot be read, refuses;
// - symlinked files are judged by their target's content;
// - a root that is also the home directory is checked too: a checkout rooted
//   at home can track those files.
export function checkCursorRepoHooks(input: {
  cwd: string;
  fs: HostFileSystem;
}): CursorRepoHookGateResult {
  const { fs } = input;
  let start: string;
  try {
    start = fs.realpath(input.cwd);
  } catch (error) {
    return {
      ok: false,
      message: `Cursor read-only run refused: could not resolve the working directory ${input.cwd} to check for repository hooks (${errorText(error)}).`,
    };
  }
  const root = resolveCursorHookRoot(start, fs);

  for (const file of CURSOR_REPO_HOOK_FILES) {
    const filePath = path.join(root, file);
    let text: string | undefined;
    try {
      text = fs.readFile(filePath);
    } catch (error) {
      return refusal(
        root,
        file,
        `${file} in ${root} could not be read (${errorText(error)}), so the gate cannot rule out hooks.`,
      );
    }
    if (text === undefined || text.trim() === '') continue;
    const parsed = parseHookFile(text, file === '.cursor/hooks.json');
    if (!parsed.ok) {
      return refusal(
        root,
        file,
        `${file} in ${root} is not valid JSON, so the gate cannot rule out hooks.`,
      );
    }
    const events = configuredHookEvents(parsed.values);
    if (events.length > 0) {
      return refusal(
        root,
        file,
        `${file} in ${root} configures hooks (${events.join(', ')}). cursor-agent runs repository hooks without a permission request, even in ask mode, and has no flag to disable them.`,
      );
    }
  }
  return { ok: true, root };
}

function refusal(
  root: string,
  file: string,
  detail: string,
): CursorRepoHookGateResult {
  return {
    ok: false,
    root,
    file,
    message: `Cursor read-only run refused: ${detail} Remove or empty those hooks, or choose another read-only peer.`,
  };
}

// Cursor reads hooks.json as JSONC by stripping comments with two regexes.
// Both readings are checked, and a hook found by either refuses.
function parseHookFile(
  text: string,
  jsonc: boolean,
): { ok: true; values: unknown[] } | { ok: false } {
  const values: unknown[] = [];
  const attempts = jsonc
    ? [text, text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')]
    : [text];
  for (const attempt of attempts) {
    try {
      values.push(JSON.parse(attempt));
    } catch {
      // Try the next reading.
    }
  }
  return values.length > 0 ? { ok: true, values } : { ok: false };
}

function configuredHookEvents(values: unknown[]): string[] {
  const events = new Set<string>();
  for (const value of values) {
    if (!isObject(value) || !isObject(value.hooks)) continue;
    for (const [event, entries] of Object.entries(value.hooks)) {
      if (Array.isArray(entries) && entries.length > 0) events.add(event);
    }
  }
  return [...events].toSorted();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorText(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code ?? String(error);
}
