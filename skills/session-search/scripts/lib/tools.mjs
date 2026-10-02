// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/tools.ts
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
var ABSOLUTE_TOOL_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin"
];
var DEFAULT_PROBE_TIMEOUT_MS = 3e3;
var MIN_PROBE_TIMEOUT_MS = 500;
var MAX_PROBE_TIMEOUT_MS = 6e4;
var PROBE_TIMEOUT_VAR = "SESSION_SEARCH_PROBE_TIMEOUT_MS";
var TOOLS = [
  {
    name: "rg",
    overrideVar: "SESSION_SEARCH_RG",
    disableVar: "SESSION_SEARCH_NO_RG"
  },
  {
    name: "sqlite3",
    overrideVar: "SESSION_SEARCH_SQLITE3",
    disableVar: "SESSION_SEARCH_NO_SQLITE3"
  }
];
function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}
function probeTimeoutMs(env, notes) {
  const raw = env[PROBE_TIMEOUT_VAR]?.trim();
  if (!raw) return DEFAULT_PROBE_TIMEOUT_MS;
  const value = /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    notes?.push(
      `${PROBE_TIMEOUT_VAR}=${raw} is not a positive integer; using ${DEFAULT_PROBE_TIMEOUT_MS} ms.`
    );
    return DEFAULT_PROBE_TIMEOUT_MS;
  }
  return Math.min(MAX_PROBE_TIMEOUT_MS, Math.max(MIN_PROBE_TIMEOUT_MS, value));
}
function verifyExecutable(candidate, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS) {
  if (!path.isAbsolute(candidate) || !isFile(candidate)) return false;
  try {
    const result = spawnSync(candidate, ["--version"], {
      timeout: timeoutMs,
      stdio: "ignore",
      windowsHide: true
    });
    return result.error === void 0 && result.status === 0;
  } catch {
    return false;
  }
}
function executableNames(name) {
  return process.platform === "win32" ? [`${name}.exe`, name] : [name];
}
function isEnabled(value) {
  return value === "1" || value?.toLowerCase() === "true";
}
function resolveTool(spec, env, notes, timeoutMs) {
  const override = env[spec.overrideVar]?.trim();
  if (override) {
    const candidate = path.resolve(override);
    if (verifyExecutable(candidate, timeoutMs)) return candidate;
    notes.push(
      `${spec.overrideVar}=${override} is not a usable ${spec.name} executable; continuing without ${spec.name}.`
    );
    return null;
  }
  if (isEnabled(env[spec.disableVar])) return null;
  const pathDirs = (env.PATH ?? "").split(path.delimiter).filter((dir) => dir !== "" && path.isAbsolute(dir));
  const seen = /* @__PURE__ */ new Set();
  for (const dir of [...pathDirs, ...ABSOLUTE_TOOL_DIRS]) {
    for (const name of executableNames(spec.name)) {
      const candidate = path.join(dir, name);
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (verifyExecutable(candidate, timeoutMs)) return candidate;
    }
  }
  return null;
}
function probeTools(env = process.env) {
  const notes = [];
  const timeoutMs = probeTimeoutMs(env, notes);
  const [rg, sqlite3] = TOOLS.map(
    (spec) => resolveTool(spec, env, notes, timeoutMs)
  );
  return { rg, sqlite3, notes };
}
export {
  ABSOLUTE_TOOL_DIRS,
  DEFAULT_PROBE_TIMEOUT_MS,
  MAX_PROBE_TIMEOUT_MS,
  MIN_PROBE_TIMEOUT_MS,
  probeTimeoutMs,
  probeTools,
  verifyExecutable
};
