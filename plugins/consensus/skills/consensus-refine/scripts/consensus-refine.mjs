import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { ConsensusError, EXIT_CODES, exitCodeForError, runConsensusLoop } from './consensus-loop.mjs';

const execFileAsync = promisify(execFile);

export const MIN_PASEO_VERSION = '0.1.0';
export const MAX_TESTED_PASEO_VERSION = '0.9.0';
export const INPUT_SIZE_CAP_BYTES = 1024 * 1024;

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const PASEO_REMEDIATION = Object.freeze({
  install_command: 'npm install -g @getpaseo/cli',
  source_url: 'https://github.com/getpaseo/paseo',
  install_script: 'plugins/consensus/skills/consensus-refine/scripts/install-paseo.mjs'
});

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function nearestExistingPath(targetPath) {
  let current = path.resolve(targetPath);
  while (!(await pathExists(current))) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

async function syncPathIfAvailable(targetPath) {
  let handle;
  try {
    handle = await open(targetPath, 'r');
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function createJsonlEvent(event, payload = {}, options = {}) {
  return {
    consensus_schema_version: 'v0',
    event,
    timestamp: options.now?.() ?? nowIso(),
    ...payload
  };
}

function writeJsonl(stream, event, payload = {}, options = {}) {
  const entry = createJsonlEvent(event, payload, options);
  stream.write(`${JSON.stringify(entry)}\n`);
  return entry;
}

export function renderHumanError(error, env = process.env) {
  if (env.CONSENSUS_LOG === 'trace' && error?.stack) {
    return error.stack;
  }
  return error?.message ?? String(error);
}

function dynamicFence(contents, info = '') {
  const text = String(contents ?? '');
  const maxRun = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const ticks = '`'.repeat(Math.max(3, maxRun + 1));
  const opener = info ? `${ticks}${info}` : ticks;
  return `${opener}\n${text.replace(/\n*$/u, '\n')}${ticks}`;
}

function canonicalJsonBlock(label, value) {
  return dynamicFence(JSON.stringify(value, null, 2), `json ${label}`);
}

function sanitizeProse(text) {
  return String(text ?? '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '[removed]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sectionOutput(section) {
  return section.output ?? section.result?.output ?? section.markdown ?? '';
}

function aggregateStatus(sections) {
  const statuses = sections.map((section) => section.status?.status ?? section.result?.status?.status ?? 'unknown');
  if (statuses.every((status) => status === 'converged')) return 'converged';
  if (statuses.some((status) => status === 'error')) return 'error';
  if (statuses.some((status) => status === 'impasse' || status === 'max_rounds')) return 'partial';
  return 'unknown';
}

function sectionStates(sections) {
  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    original_index: section.original_index,
    status: section.status?.status ?? 'unknown',
    termination_reason: section.status?.termination_reason ?? null,
    turns: section.status?.turns ?? 0,
    rounds: section.status?.rounds ?? 0,
    artifact_hash: section.status?.artifact_hash ?? null
  }));
}

function countByStatus(sections, statusName) {
  return sections.filter((section) => section.status?.status === statusName).length;
}

function renderRecord(record) {
  const verdict = record.verdict ?? {};
  const parts = [
    `#### Round ${record.round ?? '?'} - ${record.agent ?? record.provider ?? 'peer'} - ${verdict.decision ?? 'UNKNOWN'}`
  ];

  if (verdict.reasoning) {
    parts.push('', 'Reasoning:', sanitizeProse(verdict.reasoning));
  }

  if (verdict.proposed_artifact) {
    parts.push('', 'Proposed Artifact:', dynamicFence(sanitizeProse(verdict.proposed_artifact), 'markdown'));
  }

  parts.push('', canonicalJsonBlock('consensus-verdict', verdict));
  return parts.join('\n');
}

function requireValue(argv, index, flag) {
  if (index + 1 >= argv.length) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index + 1];
}

function parsePositiveInteger(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== String(value) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parsePeers(value) {
  const peers = String(value)
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);

  if (peers.length !== 2) {
    throw new Error('--peers must contain exactly two peers');
  }

  return peers;
}

function normalizeProviderInventory(providerInventory) {
  const entries = Array.isArray(providerInventory)
    ? providerInventory
    : providerInventory?.providers ?? providerInventory?.data ?? [];

  return entries.map((entry) => {
    if (typeof entry === 'string') {
      return { id: entry, available: true };
    }

    const id = entry.id ?? entry.name ?? entry.provider;
    const available = entry.available === false || entry.enabled === false ? false : true;
    return { ...entry, id, available };
  });
}

function markdownLines(markdown) {
  const normalized = String(markdown ?? '').replace(/\r\n?/g, '\n');
  return normalized.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function markerName(line) {
  const match = line.trim().match(/^<!--\s*section:\s*(.*?)\s*-->$/i);
  return match?.[1]?.trim() || null;
}

function headingName(line) {
  const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
  if (!match) return null;
  return match[1].replace(/\s+#+\s*$/u, '').trim() || null;
}

function buildSectionsFromBoundaries(lines, boundaries) {
  const sections = [];
  const firstBoundary = boundaries[0];

  if (firstBoundary?.lineIndex > 0) {
    const preamble = lines.slice(0, firstBoundary.lineIndex).join('');
    if (preamble.trim()) {
      sections.push({
        id: slugSectionId('Preamble', sections.length),
        name: 'Preamble',
        original_index: sections.length,
        start_line: 1,
        end_line: firstBoundary.lineIndex,
        markdown: preamble
      });
    }
  }

  for (const [boundaryIndex, boundary] of boundaries.entries()) {
    const nextBoundary = boundaries[boundaryIndex + 1];
    const markdown = lines.slice(boundary.lineIndex, nextBoundary?.lineIndex ?? lines.length).join('');
    sections.push({
      id: slugSectionId(boundary.name, sections.length),
      name: boundary.name,
      original_index: sections.length,
      start_line: boundary.lineIndex + 1,
      end_line: nextBoundary?.lineIndex ?? lines.length,
      markdown
    });
  }

  return sections;
}

function parseVersionText(text) {
  const match = String(text).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`could not parse paseo version from: ${String(text).trim()}`);
  }
  return match[0];
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

function missingPaseoError(cause) {
  const error = new Error(
    `paseo appears to be missing or unavailable. Install with "${PASEO_REMEDIATION.install_command}", build from ${PASEO_REMEDIATION.source_url}, or run ${PASEO_REMEDIATION.install_script}.`
  );
  error.code = 'PASEO_MISSING';
  error.cause = cause;
  error.remediation = PASEO_REMEDIATION;
  return error;
}

export async function readInputFile(inputPath, options = {}) {
  const capBytes = options.sizeCapBytes ?? INPUT_SIZE_CAP_BYTES;
  const fileStat = await stat(inputPath);
  if (fileStat.size > capBytes) {
    throw new Error(`input exceeds size cap of ${capBytes} bytes`);
  }

  const contents = await readFile(inputPath, 'utf8');
  if (Buffer.byteLength(contents, 'utf8') > capBytes) {
    throw new Error(`input exceeds size cap of ${capBytes} bytes`);
  }
  return contents;
}

export async function confineWrite(targetPath, rootPath) {
  const root = path.resolve(rootPath);
  const target = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(root, targetPath);

  if (!inside(root, target)) {
    throw new Error(`write path is outside allowed root: ${target}`);
  }

  if (await pathExists(target)) {
    const targetStat = await lstat(target);
    if (targetStat.isSymbolicLink()) {
      throw new Error(`write target may not be a symlink: ${target}`);
    }
  }

  const realRoot = await realpath(root);
  const parent = path.dirname(target);
  const existing = await nearestExistingPath(parent);
  const realExisting = await realpath(existing);
  const realParent = path.resolve(realExisting, path.relative(existing, parent));
  if (!inside(realRoot, realParent)) {
    throw new Error(`write path resolves outside allowed root: ${target}`);
  }

  return target;
}

export async function atomicWriteFile(targetPath, contents) {
  if (await pathExists(targetPath)) {
    const targetStat = await lstat(targetPath);
    if (targetStat.isSymbolicLink()) {
      throw new Error(`write target may not be a symlink: ${targetPath}`);
    }
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`
  );

  try {
    await writeFile(tempPath, contents);
    await syncPathIfAvailable(tempPath);
    await rename(tempPath, targetPath);
    await syncPathIfAvailable(path.dirname(targetPath));
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        error.cleanupError = cleanupError;
      }
    }
    throw error;
  }
}

export async function resolveRunDir(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const root = path.resolve(options.allowRoot ?? cwd);
  const target = options.runDir
    ? path.isAbsolute(options.runDir)
      ? options.runDir
      : path.resolve(cwd, options.runDir)
    : path.resolve(cwd, '.consensus', 'run');

  return await confineWrite(target, root);
}

export async function resolveOutputPath(options = {}, inputPath) {
  if (options.output) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const root = path.resolve(options.allowRoot ?? cwd);
    const target = path.isAbsolute(options.output) ? options.output : path.resolve(cwd, options.output);
    return await confineWrite(target, root);
  }

  const target = path.resolve(`${inputPath}.consensus.md`);
  return await confineWrite(target, path.dirname(path.resolve(inputPath)));
}

async function defaultRunCommand(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 2 * 1024 * 1024
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

export function parseWrapperArgs(argv) {
  const parsed = {
    mode: 'sequential',
    inputPath: null,
    goal: '',
    peers: null,
    maxRounds: 12,
    agency: 'moderate',
    output: null,
    resume: null,
    runDir: null,
    allowRoot: null,
    failOnSectionError: false,
    skipCorruptSections: [],
    yesSkipCorrupt: false,
    prepareParallel: false,
    parallelism: null,
    fanIn: false,
    manifestPath: null
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--goal':
        parsed.goal = requireValue(argv, index, token);
        index += 1;
        break;
      case '--peers':
        parsed.peers = parsePeers(requireValue(argv, index, token));
        index += 1;
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(
          requireValue(argv, index, token),
          '--max-rounds',
          MAX_ROUNDS_MIN,
          MAX_ROUNDS_MAX
        );
        index += 1;
        break;
      case '--agency':
        parsed.agency = requireValue(argv, index, token);
        index += 1;
        break;
      case '--output':
        parsed.output = requireValue(argv, index, token);
        index += 1;
        break;
      case '--resume':
        parsed.resume = requireValue(argv, index, token);
        index += 1;
        break;
      case '--run-dir':
        parsed.runDir = requireValue(argv, index, token);
        index += 1;
        break;
      case '--allow-root':
        parsed.allowRoot = requireValue(argv, index, token);
        index += 1;
        break;
      case '--fail-on-section-error':
        parsed.failOnSectionError = true;
        break;
      case '--skip-corrupt-section':
        parsed.skipCorruptSections.push(requireValue(argv, index, token));
        index += 1;
        break;
      case '--yes-skip-corrupt':
        parsed.yesSkipCorrupt = true;
        break;
      case '--prepare-parallel':
        parsed.prepareParallel = true;
        parsed.mode = 'prepare_parallel';
        break;
      case '--parallelism':
        parsed.parallelism = parsePositiveInteger(requireValue(argv, index, token), '--parallelism', 1, 64);
        index += 1;
        break;
      case '--fan-in':
        parsed.fanIn = true;
        parsed.mode = 'fan_in';
        parsed.manifestPath = requireValue(argv, index, token);
        index += 1;
        break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
    }
  }

  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  if (parsed.fanIn) {
    if (positionals.length > 0) {
      throw new Error('--fan-in does not accept an input path');
    }
    return parsed;
  }

  if (positionals.length > 1) {
    throw new Error(`unexpected positional argument: ${positionals[1]}`);
  }

  parsed.inputPath = positionals[0] ?? null;
  if (!parsed.inputPath) {
    throw new Error('input path is required');
  }

  return parsed;
}

export function detectHost(env = process.env) {
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

export function slugSectionId(name, index) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'section'}-${index}`;
}

export function parseSections(markdown) {
  const lines = markdownLines(markdown);
  const markerBoundaries = [];
  const headingBoundaries = [];

  lines.forEach((line, lineIndex) => {
    const sectionMarkerName = markerName(line);
    if (sectionMarkerName) {
      markerBoundaries.push({ lineIndex, name: sectionMarkerName });
      return;
    }

    const sectionHeadingName = headingName(line);
    if (sectionHeadingName) {
      headingBoundaries.push({ lineIndex, name: sectionHeadingName });
    }
  });

  const boundaries = markerBoundaries.length > 0 ? markerBoundaries : headingBoundaries;
  if (boundaries.length > 0) {
    return buildSectionsFromBoundaries(lines, boundaries);
  }

  return [
    {
      id: slugSectionId('Document', 0),
      name: 'Document',
      original_index: 0,
      start_line: 1,
      end_line: lines.length,
      markdown: lines.join('')
    }
  ];
}

function normalizeSequentialOptions(options) {
  const parsed = Array.isArray(options) ? parseWrapperArgs(options) : options;
  return {
    goal: '',
    maxRounds: 12,
    agency: 'moderate',
    failOnSectionError: false,
    ...parsed
  };
}

function sectionRunDirectory(runDir, section) {
  return path.join(runDir, 'sections', `${String(section.original_index + 1).padStart(2, '0')}-${section.id}`);
}

function loopArgvForSection({ section, paths, options, peers }) {
  return [
    '--section-file',
    paths.input,
    '--goal',
    options.goal ?? '',
    '--peers',
    peers.join(','),
    '--max-rounds',
    String(options.maxRounds),
    '--agency',
    options.agency,
    '--output-records',
    paths.records,
    '--output-section',
    paths.output,
    '--output-status',
    paths.status
  ];
}

export function renderDeliberationArtifact(runResult) {
  const sections = [...runResult.sections].sort((left, right) => left.original_index - right.original_index);
  const status = aggregateStatus(sections);
  const states = sectionStates(sections);
  const finalOutput = sections.map(sectionOutput).join('\n\n').replace(/\n*$/u, '\n');
  const totalRounds = sections.reduce((sum, section) => sum + (section.status?.rounds ?? 0), 0);
  const totalTurns = sections.reduce((sum, section) => sum + (section.status?.turns ?? 0), 0);
  const resolution = {
    consensus_schema_version: 'v0',
    status,
    mode: runResult.mode ?? 'sequential',
    parallel: Boolean(runResult.parallel),
    iteration: 'alternating',
    cold_start: 'shared_input',
    agency: runResult.agency,
    peers: runResult.peers,
    max_rounds: runResult.maxRounds,
    sections: {
      total: sections.length,
      converged: countByStatus(sections, 'converged'),
      impasse: countByStatus(sections, 'impasse'),
      max_rounds: countByStatus(sections, 'max_rounds'),
      error: countByStatus(sections, 'error')
    },
    total_rounds: totalRounds,
    total_turns: totalTurns,
    wall_clock_ms: runResult.wallClockMs ?? null,
    cost_source: 'unavailable',
    approximate_cost_usd: null,
    started_at: runResult.startedAt ?? null,
    ended_at: runResult.endedAt ?? null
  };

  const parts = [
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    finalOutput,
    '## Resolution',
    '',
    canonicalJsonBlock('consensus-resolution', resolution),
    '',
    '## Goal',
    '',
    sanitizeProse(runResult.goal || '(no explicit goal provided)'),
    '',
    '## Section States',
    '',
    canonicalJsonBlock('consensus-section-states', states),
    '',
    '## Deliberation Log'
  ];

  for (const section of sections) {
    parts.push(
      '',
      `### ${section.original_index + 1}. ${sanitizeProse(section.name)} (${section.status?.status ?? 'unknown'})`,
      '',
      canonicalJsonBlock('consensus-section-status', section.status ?? {}),
      ''
    );

    for (const record of section.records ?? []) {
      parts.push(renderRecord(record), '');
    }
  }

  return `${parts.join('\n').replace(/\n{4,}/g, '\n\n\n').replace(/\s+$/u, '')}\n`;
}

export async function runSequential(options, runOptions = {}) {
  const normalized = normalizeSequentialOptions(options);
  const cwd = path.resolve(normalized.cwd ?? runOptions.cwd ?? process.cwd());
  const env = normalized.env ?? runOptions.env ?? process.env;
  const inputPath = path.isAbsolute(normalized.inputPath) ? normalized.inputPath : path.resolve(cwd, normalized.inputPath);
  const startedAt = nowIso();
  const startMs = Date.now();
  const markdown = await readInputFile(inputPath);
  const parsedSections = parseSections(markdown);
  const runDir = await resolveRunDir({ ...normalized, cwd });
  const outputPath = await resolveOutputPath({ ...normalized, cwd }, inputPath);
  const preflight =
    normalized.preflight === false
      ? { peers: normalized.peers ?? ['claude', 'codex'], warnings: [] }
      : await (normalized.preflight ?? preflightPaseo)({ ...normalized, env, cwd });
  const peers = normalized.peers ?? preflight.peers;
  const sectionResults = [];

  for (const section of parsedSections) {
    const sectionDir = sectionRunDirectory(runDir, section);
    const paths = {
      input: path.join(sectionDir, 'section.md'),
      records: path.join(sectionDir, 'records.json'),
      output: path.join(sectionDir, 'output.md'),
      status: path.join(sectionDir, 'status.json')
    };

    await atomicWriteFile(paths.input, section.markdown);

    try {
      const result = await runConsensusLoop(loopArgvForSection({ section, paths, options: normalized, peers }), {
        env,
        cwd,
        invokePeer: normalized.invokePeer ?? runOptions.invokePeer
      });
      sectionResults.push({
        ...section,
        paths,
        output: result.output,
        status: result.status,
        records: result.records
      });
    } catch (error) {
      const status = {
        status: 'error',
        termination_reason: 'hard_error',
        turns: 0,
        rounds: 0,
        error: error.message
      };
      sectionResults.push({
        ...section,
        paths,
        output: section.markdown,
        status,
        records: []
      });
      if (normalized.failOnSectionError) {
        throw new ConsensusError(`section ${section.id} failed: ${error.message}`, {
          code: 'SECTION_ERROR',
          exitCode: EXIT_CODES.SECTION_ERROR,
          cause: error,
          details: { section_id: section.id }
        });
      }
    }
  }

  const endedAt = nowIso();
  const runResult = {
    mode: 'sequential',
    parallel: false,
    inputPath,
    outputPath,
    runDir,
    goal: normalized.goal,
    peers,
    agency: normalized.agency,
    maxRounds: normalized.maxRounds,
    startedAt,
    endedAt,
    wallClockMs: Date.now() - startMs,
    sections: sectionResults
  };
  runResult.status = aggregateStatus(sectionResults);

  const artifact = renderDeliberationArtifact(runResult);
  await atomicWriteFile(outputPath, artifact);
  return { ...runResult, artifact };
}

export function resolvePeers(options = {}, host = 'unknown', providerInventory = []) {
  const defaultPeers = host === 'codex' ? ['codex', 'claude'] : ['claude', 'codex'];
  const peers = options.peers ?? defaultPeers;
  const inventory = normalizeProviderInventory(providerInventory);
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const missing = [];
  const unavailable = [];

  for (const peer of peers) {
    const entry = byId.get(peer);
    if (!entry) {
      missing.push(peer);
    } else if (entry.available === false) {
      unavailable.push(peer);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing peers in Paseo inventory: ${missing.join(', ')}. Verify configured providers with "paseo provider ls --json".`
    );
  }

  if (unavailable.length > 0) {
    throw new Error(`Paseo providers are unavailable: ${unavailable.join(', ')}.`);
  }

  return { peers, inventory };
}

export async function preflightPaseo(options = {}) {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  let versionOutput;
  let inventoryOutput;
  try {
    versionOutput = await runCommand('paseo', ['--version'], { env, cwd });
    inventoryOutput = await runCommand('paseo', ['provider', 'ls', '--json'], { env, cwd });
  } catch (error) {
    if (error.code === 'ENOENT' || /ENOENT|not found/i.test(error.message)) {
      throw missingPaseoError(error);
    }
    throw error;
  }

  const version = parseVersionText(versionOutput.stdout);
  let providerInventory;
  try {
    providerInventory = JSON.parse(inventoryOutput.stdout);
  } catch (error) {
    throw new Error(`paseo provider inventory was not valid JSON: ${error.message}`);
  }

  const host = detectHost(env);
  const resolved = resolvePeers(options, host, providerInventory);
  const warnings = [];
  if (compareVersions(version, MIN_PASEO_VERSION) < 0 || compareVersions(version, MAX_TESTED_PASEO_VERSION) > 0) {
    warnings.push({
      code: 'PASEO_VERSION_UNTESTED',
      level: 'warning',
      version,
      min: MIN_PASEO_VERSION,
      max: MAX_TESTED_PASEO_VERSION,
      message: `Paseo ${version} is outside the tested range ${MIN_PASEO_VERSION} to ${MAX_TESTED_PASEO_VERSION}.`
    });
  }

  return {
    ok: true,
    version,
    providerInventory: normalizeProviderInventory(providerInventory),
    peers: resolved.peers,
    warnings
  };
}

export async function runWrapperCli(argv, options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  try {
    const parsed = parseWrapperArgs(argv);
    writeJsonl(stdout, 'run_started', {
      mode: parsed.mode,
      input_path: parsed.inputPath,
      manifest_path: parsed.manifestPath
    });

    if (parsed.mode !== 'sequential') {
      throw new ConsensusError(`${parsed.mode} is not implemented in Phase 2`, {
        code: 'MODE_NOT_IMPLEMENTED',
        exitCode: EXIT_CODES.CONFIG
      });
    }

    const result = await runSequential({ ...parsed, env, cwd });
    writeJsonl(stdout, 'run_completed', {
      status: result.status,
      output_path: result.outputPath,
      run_dir: result.runDir,
      sections: result.sections.length
    });
    return 0;
  } catch (error) {
    const exitCode = exitCodeForError(error);
    writeJsonl(stdout, 'error', {
      code: error.code ?? 'ERROR',
      exit_code: exitCode,
      message: renderHumanError(error, env)
    });
    stderr.write(`${renderHumanError(error, env)}\n`);
    return exitCode;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWrapperCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
