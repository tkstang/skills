#!/usr/bin/env node
// Structure-only JSONL schema inventory for agent session transcripts.
//
// Reads a newline-separated file list on stdin; writes one JSON report to stdout.
// The report is fully reproducible from this script: no post-processing is applied.
//
//   <file list> | node inventory.mjs --allowlist reviewed-vocabulary.json > inventory.json
//   <file list> | node inventory.mjs --discover > local-unreviewed.json   # never commit
//
// Without --allowlist the report is marked UNREVIEWED: it may contain repeated private
// identifiers and must stay machine-local. With --allowlist, only human-reviewed key
// names and enum values are emitted; everything else becomes `<unreviewed-key>` /
// `<unreviewed-value>` (counted, never described).
//
// PRIVACY CONTRACT
// 1. Field VALUES are emitted only at the exact schema paths in ENUM_PATHS, only when
//    identifier-shaped, and MCP-style tool names are generalised.
// 2. Object KEYS are emitted only when identifier-shaped AND seen in at least
//    --min-files distinct files (default 3). Anything else becomes `<dynamic-key>` or
//    `<rare-key>`, and its subtree is not described further.
// 3. JSON-encoded strings are reported as `string(json)`; the script descends only
//    into the argument carriers in JSON_CARRIERS, never into tool output.
// 4. Array-item `[type=X]` tags and record discriminators use the same value guard.
// 4a. Data-keyed maps (DICTIONARY_PATH) and third-party/MCP call arguments and results
//    are counted but never described.
// 5. Lines are split on the LF byte only. Node's `readline` must not be used here: it
//    also breaks on U+2028/U+2029, which occur unescaped inside transcript strings and
//    would be miscounted as malformed records.
// 6. No file paths, session ids, timestamps finer than a date, or text are emitted.
import { createReadStream, readFileSync } from 'node:fs';

const ENUM_PATHS = new Set([
  '$.type', '$.subtype', '$.role', '$.level', '$.userType', '$.version', '$.isSidechain',
  '$.status',
  '$.payload.type', '$.payload.role', '$.payload.status', '$.payload.name',
  '$.payload.cli_version', '$.payload.originator', '$.payload.phase',
  '$.payload.history_mode', '$.payload.multi_agent_version',
  '$.payload.item.type', '$.payload.item.status', '$.payload.item.kind',
  '$.message.role', '$.message.model', '$.message.stop_reason', '$.message.type',
  '$.message.content[].type', '$.message.content[].name', '$.message.content[].is_error',
  '$.payload.content[].type', '$.content[].type',
]);
// Only these JSON-encoded string carriers are descended into (tool arguments).
const JSON_CARRIERS = new Set(['$.payload.arguments']);
const SAFE_VALUE = /^[\w.:-]{1,64}$/;
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_-]{0,39}$/;
const isDynamicKey = (k) =>
  !SAFE_KEY.test(k) || /\d{4,}/.test(k) || /^[A-Z][A-Z0-9_]{3,}$/.test(k);
// Objects at these paths are maps keyed by data (tool schemas, file paths, ids).
const DICTIONARY_PATH =
  /\.(properties|\$defs|definitions|answers|trackedFileBackups|wireToolInputs|wireIngestContext|agents_states|modelUsage|structuredContent|mcpMeta|env|headers)$/;
// Third-party (MCP / namespaced) tool calls: argument and result shapes are not described.
const isThirdPartyCall = (o) =>
  (typeof o.name === 'string' && o.name.startsWith('mcp__')) ||
  (typeof o.namespace === 'string' && o.namespace.length > 0) ||
  o.type === 'McpToolCall' || o.name === 'CallMcpTool' || o.name === 'CallDynamicTool';
const OPAQUE_FOR_THIRD_PARTY = new Set(['input', 'arguments', 'result', 'output', 'error']);
const MAX_OBJECT_KEYS = 40; // wider objects are treated as dictionaries
const MAX_ENUM_VALUES = 200;
const MAX_DEPTH = 12;
const MAX_JSON_DEPTH = 3; // levels described inside a decoded argument carrier

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && Number(args[i + 1]) > 0 ? Number(args[i + 1]) : fallback;
};
const maxLineBytes = flag('--max-line-bytes', 8_000_000);
const minFiles = flag('--min-files', 3);
const allowIdx = args.indexOf('--allowlist');
const allow = allowIdx >= 0 ? JSON.parse(readFileSync(args[allowIdx + 1], 'utf8')) : null;
if (!allow && !args.includes('--discover')) {
  console.error('inventory: pass --allowlist <file> (committable) or --discover (local only)');
  process.exit(2);
}
const allowedKeys = allow ? new Set(allow.keys) : null;
const allowedValues = allow ? new Set(allow.values) : null;

const groups = new Map();
const diagnostics = { files: 0, lines: 0, blank: 0, malformed: 0, oversizedBytes: 0, unreadable: 0, depthTruncated: 0, jsonDepthTruncated: 0 };
let fileSeq = 0;

const jsonType = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const safeValue = (v) => {
  if (typeof v !== 'string' || !SAFE_VALUE.test(v)) return undefined;
  if (v.startsWith('mcp__')) return 'mcp__<server>__<tool>';
  return allowedValues && !allowedValues.has(v) ? '<unreviewed-value>' : v;
};

function discriminator(rec) {
  const p = rec && typeof rec.payload === 'object' && rec.payload ? rec.payload : null;
  const part = (label, v) => `${label}${safeValue(v) ?? '<unsafe-value>'}`;
  const parts = [typeof rec.type === 'string' ? part('', rec.type) : '(no-type)'];
  if (p && typeof p.type === 'string') parts.push(part('payload.type=', p.type));
  else if (typeof rec.subtype === 'string') parts.push(part('subtype=', rec.subtype));
  else if (rec.message && typeof rec.message.role === 'string') parts.push(part('message.role=', rec.message.role));
  else if (typeof rec.role === 'string') parts.push(part('role=', rec.role));
  return parts.join(' | ');
}

function note(group, path, type, value) {
  let entry = group.paths.get(path);
  if (!entry) group.paths.set(path, (entry = { types: {}, count: 0, fileCount: 0, lastFile: -1 }));
  entry.count += 1;
  if (entry.lastFile !== fileSeq) { entry.lastFile = fileSeq; entry.fileCount += 1; }
  entry.types[type] = (entry.types[type] || 0) + 1;
  if (!ENUM_PATHS.has(path.replace(/\[type=[^\]]*\]/g, '[]'))) return;
  const v = type === 'boolean' ? String(value) : type === 'string' ? safeValue(value) : undefined;
  if (v === undefined) { if (type === 'string') entry.unsafeValues = (entry.unsafeValues || 0) + 1; return; }
  entry.values ??= {};
  if (v in entry.values || Object.keys(entry.values).length < MAX_ENUM_VALUES) {
    entry.values[v] = (entry.values[v] || 0) + 1;
  } else entry.valuesOverflow = true;
}

function walk(group, value, path, depth, jsonDepth) {
  const type = jsonType(value);
  if (type === 'string' && value.length > 1 && (value[0] === '{' || value[0] === '[')) {
    let inner;
    try { inner = JSON.parse(value); } catch { /* plain string */ }
    if (inner && typeof inner === 'object') {
      note(group, path, 'string(json)', '');
      if (JSON_CARRIERS.has(path)) walk(group, inner, `${path}<json>`, depth + 1, 1);
      return;
    }
  }
  note(group, path, type, value);
  const container = type === 'object' || type === 'array';
  if (depth >= MAX_DEPTH) { if (container) diagnostics.depthTruncated += 1; return; }
  if (jsonDepth && jsonDepth > MAX_JSON_DEPTH) { if (container) diagnostics.jsonDepthTruncated += 1; return; }
  const nextJson = jsonDepth ? jsonDepth + 1 : 0;
  if (type === 'object') {
    const entries = Object.entries(value);
    const dictionary = entries.length > MAX_OBJECT_KEYS || DICTIONARY_PATH.test(path);
    const thirdParty = isThirdPartyCall(value);
    let sawDynamic = false;
    for (const [k, v] of entries) {
      if (thirdParty && OPAQUE_FOR_THIRD_PARTY.has(k)) {
        note(group, `${path}.${k}`, `${jsonType(v)}(third-party, not described)`, '');
        continue;
      }
      if (!dictionary && !isDynamicKey(k) && allowedKeys && !allowedKeys.has(k)) {
        note(group, `${path}.<unreviewed-key>`, jsonType(v), '');
        continue;
      }
      if (dictionary || isDynamicKey(k)) {
        if (!sawDynamic) note(group, `${path}.<dynamic-key>`, jsonType(v), '');
        sawDynamic = true; // dynamic subtrees are counted once per object, never described
        continue;
      }
      walk(group, v, `${path}.${k}`, depth + 1, nextJson);
    }
  } else if (type === 'array') {
    for (const item of value) {
      const tagValue = !jsonDepth && item && typeof item === 'object' && !Array.isArray(item)
        ? safeValue(item.type) : undefined;
      walk(group, item, `${path}${tagValue ? `[type=${tagValue}]` : '[]'}`, depth + 1, nextJson);
    }
  }
}

async function* lfLines(file) {
  let rest = Buffer.alloc(0);
  for await (const chunk of createReadStream(file)) {
    let buf = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    let nl;
    while ((nl = buf.indexOf(0x0a)) !== -1) {
      yield buf.subarray(0, nl).toString('utf8');
      buf = buf.subarray(nl + 1);
    }
    rest = buf;
  }
  if (rest.length) yield rest.toString('utf8');
}

async function scan(file) {
  diagnostics.files += 1;
  fileSeq += 1;
  let fileVersion;
  const seen = new Set();
  try {
    for await (const line of lfLines(file)) {
      diagnostics.lines += 1;
      if (!line.trim()) { diagnostics.blank += 1; continue; }
      if (Buffer.byteLength(line, 'utf8') > maxLineBytes) { diagnostics.oversizedBytes += 1; continue; }
      let rec;
      try { rec = JSON.parse(line); } catch { diagnostics.malformed += 1; continue; }
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { diagnostics.malformed += 1; continue; }
      fileVersion ??= safeValue(rec.payload?.cli_version) ?? safeValue(rec.version);
      const d = discriminator(rec);
      let group = groups.get(d);
      if (!group) groups.set(d, (group = { count: 0, fileCount: 0, versions: new Set(), paths: new Map() }));
      group.count += 1;
      if (!seen.has(group)) { seen.add(group); group.fileCount += 1; }
      const day = typeof rec.timestamp === 'string' ? rec.timestamp.slice(0, 10) : undefined;
      if (day && /^\d{4}-\d\d-\d\d$/.test(day)) {
        if (!group.firstDay || day < group.firstDay) group.firstDay = day;
        if (!group.lastDay || day > group.lastDay) group.lastDay = day;
      }
      walk(group, rec, '$', 0, 0);
    }
  } catch { diagnostics.unreadable += 1; }
  if (fileVersion) for (const g of seen) g.versions.add(fileVersion);
}

// Collapse any path with a segment seen in fewer than minFiles files into its nearest
// well-attested ancestor + `.<rare-key>`; rare subtrees are not described.
function attestedPaths(paths) {
  const out = new Map();
  const rare = (p) => (paths.get(p)?.fileCount ?? 0) < minFiles;
  for (const [path, entry] of paths) {
    const segs = path.split(/(?=\.|\[|<json>)/);
    let prefix = '';
    let cut = null;
    for (const seg of segs) {
      const next = prefix + seg;
      if (paths.has(next) && rare(next)) { cut = prefix; break; }
      prefix = next;
    }
    const key = cut === null ? path : `${cut || '$'}.<rare-key>`;
    const { lastFile, ...clean } = entry;
    if (cut === null) { out.set(key, clean); continue; }
    const agg = out.get(key) ?? { types: {}, count: 0, fileCount: 0, collapsedPaths: 0 };
    agg.count += entry.count;
    agg.collapsedPaths += 1;
    agg.fileCount = Math.max(agg.fileCount, entry.fileCount);
    out.set(key, agg);
  }
  return Object.fromEntries([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const files = [];
let stdin = '';
for await (const chunk of process.stdin) stdin += chunk;
for (const line of stdin.split('\n')) if (line.trim()) files.push(line.trim());
for (const file of files) await scan(file);

const report = {
  generatedOn: new Date().toISOString().slice(0, 10),
  review: allow ? 'reviewed-vocabulary allowlist applied' : 'UNREVIEWED discover run: machine-local only, do not commit',
  privacy:
    'structure-only; values only at ENUM_PATHS when identifier-shaped (MCP names generalised); ' +
    `keys only when identifier-shaped and seen in >= ${minFiles} files; tool output never decoded; no post-processing`,
  options: { maxLineBytes, minFiles },
  diagnostics,
  groups: [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([disc, g]) => ({
      discriminator: disc,
      count: g.count,
      fileCount: g.fileCount,
      clientVersions: [...g.versions].sort(),
      firstDay: g.firstDay,
      lastDay: g.lastDay,
      paths: attestedPaths(g.paths),
    })),
};
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
