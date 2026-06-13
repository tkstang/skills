import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  ConsensusError,
  EXIT_CODES,
  exitCodeForError,
  hashArtifact,
  invalidIterationModeError,
  ITERATION_MODES,
  runConsensusLoop
} from './consensus-loop.mjs';

const execFileAsync = promisify(execFile);

export const MIN_PASEO_VERSION = '0.1.0';
export const MAX_TESTED_PASEO_VERSION = '0.9.0';
export const INPUT_SIZE_CAP_BYTES = 1024 * 1024;
export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const STRICT_RESUME_HASH_OPTIONS = Object.freeze({
  normalizeLineEndings: false,
  trimTrailingWhitespace: false,
  collapseEofNewlines: false,
  finalNewline: false
});
const PASEO_REMEDIATION = Object.freeze({
  install_command: 'npm install -g @getpaseo/cli',
  source_url: 'https://github.com/getpaseo/paseo',
  install_script: 'scripts/install-paseo.mjs'
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
  return `<!-- consensus:${label}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function sanitizeProse(text) {
  return String(text ?? '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '[removed]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function containMarkdownHeadings(text) {
  return String(text ?? '').replace(/^([ \t]{0,3})(#{1,6})([ \t]+.*)$/gmu, '$1\\$2$3');
}

function sanitizeLogProse(text) {
  return containMarkdownHeadings(sanitizeProse(text));
}

function sectionOutput(section) {
  return section.output ?? section.result?.output ?? section.markdown ?? '';
}

function resumeDataError(message, details = {}) {
  return new ConsensusError(message, {
    code: details.code ?? 'RESUME_DATA_INVALID',
    exitCode: EXIT_CODES.DATA,
    details: details.details
  });
}

function parseYamlScalar(value) {
  const text = String(value ?? '').trim();
  if (text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(text)) return Number(text);
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}

function parseFrontmatter(markdown) {
  const text = String(markdown ?? '');
  if (!text.startsWith('---\n')) {
    return {};
  }

  const endIndex = text.indexOf('\n---', 4);
  if (endIndex === -1) {
    throw resumeDataError('resume artifact frontmatter is unterminated', {
      code: 'RESUME_FRONTMATTER_INVALID'
    });
  }

  const frontmatter = {};
  for (const line of text.slice(4, endIndex).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) continue;
    frontmatter[match[1]] = parseYamlScalar(match[2]);
  }
  return frontmatter;
}

function consensusBlockPattern(label) {
  return new RegExp(`<!-- consensus:${label}\\n([\\s\\S]*?)\\n-->`, 'g');
}

function parseConsensusJsonBlock(label, jsonText, index) {
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw resumeDataError(`corrupt consensus:${label} JSON block at index ${index}: ${error.message}`, {
      code: 'RESUME_JSON_CORRUPT',
      details: { label, index }
    });
  }
}

function tryParseConsensusJsonBlock(label, jsonText, index) {
  try {
    return { ok: true, value: JSON.parse(jsonText) };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'RESUME_JSON_CORRUPT',
        message: `corrupt consensus:${label} JSON block at index ${index}: ${error.message}`,
        block_label: label,
        block_index: index
      }
    };
  }
}

function extractConsensusJsonBlocks(markdown, label) {
  const blocks = [];
  for (const [index, match] of [...String(markdown ?? '').matchAll(consensusBlockPattern(label))].entries()) {
    blocks.push(parseConsensusJsonBlock(label, match[1], index));
  }
  return blocks;
}

function extractLogSectionBlocks(markdown) {
  const logStart = String(markdown ?? '').match(/^## Deliberation Log\s*$/mu);
  const logText = logStart ? String(markdown).slice(logStart.index) : String(markdown ?? '');
  const blockPattern = /<!-- consensus:(consensus-section-status|consensus-verdict)\n([\s\S]*?)\n-->/g;
  const logSections = [];
  const unscopedErrors = [];
  let current = null;

  for (const [index, match] of [...logText.matchAll(blockPattern)].entries()) {
    const [, label, jsonText] = match;
    const parsed = tryParseConsensusJsonBlock(label, jsonText, index);
    if (label === 'consensus-section-status') {
      current = { status: null, records: [], errors: [] };
      if (parsed.ok) {
        current.status = parsed.value;
      } else {
        current.errors.push(parsed.error);
      }
      logSections.push(current);
      continue;
    }

    if (!current) {
      unscopedErrors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        message: 'resume artifact has verdict records before any section status block',
        block_label: label,
        block_index: index
      });
      continue;
    }

    if (parsed.ok) {
      current.records.push(parsed.value);
    } else {
      current.errors.push(parsed.error);
    }
  }

  return { logSections, unscopedErrors };
}

function lastProposedArtifact(records) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (typeof records[index]?.proposed_artifact === 'string') {
      return records[index].proposed_artifact;
    }
  }
  return null;
}

function resumeAgencyFromMetadata(resolution = {}, frontmatter = {}, options = {}) {
  const agency = resolution.agency ?? frontmatter.agency ?? options.agency ?? 'moderate';
  return ['minimal', 'moderate', 'maximum'].includes(agency) ? agency : 'moderate';
}

function resumeHashOptionsForAgency(agency = 'moderate') {
  return agency === 'minimal' ? STRICT_RESUME_HASH_OPTIONS : {};
}

function normalizeResumeRecords(records, peers = ['claude', 'codex'], options = {}) {
  let peerIndex = 0;
  let currentArtifact = null;
  const hashOptions = resumeHashOptionsForAgency(options.agency);
  return (records ?? []).map((record) => {
    const isUser = record?.verdict === 'USER_INTERVENTION' || record?.agent === 'user';
    const normalized = {
      schema_version: 'v0',
      ...record
    };

    if (typeof normalized.proposed_artifact === 'string') {
      currentArtifact = normalized.proposed_artifact;
    }

    if (isUser) {
      normalized.agent = 'user';
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      normalized.turn_index ??= peerIndex + 1;
      normalized.reasoning ??= normalized.user_direction ?? '';
      normalized.user_direction ??= normalized.reasoning;
    } else {
      normalized.agent ??= peers[peerIndex % peers.length] ?? `peer-${peerIndex + 1}`;
      normalized.turn_index ??= peerIndex + 1;
      normalized.round_index ??= Math.floor(peerIndex / peers.length) + 1;
      peerIndex += 1;
    }

    if (!normalized.artifact_hash && currentArtifact !== null) {
      normalized.artifact_hash = hashArtifact(currentArtifact, hashOptions);
    }

    return normalized;
  });
}

function normalizeResumeSection(state, logSection, index, options = {}) {
  const records = normalizeResumeRecords(logSection?.records ?? [], options.peers, {
    agency: options.agency
  });
  const canonicalArtifact = typeof state?.final_output === 'string' ? state.final_output : null;
  const logArtifact = lastProposedArtifact(records);
  const resumedArtifact = canonicalArtifact ?? logArtifact;
  const status = logSection?.status ?? {};
  const sectionStatus = state?.status ?? status.status ?? 'unknown';
  const completed = sectionStatus === 'converged';
  const hashOptions = resumeHashOptionsForAgency(options.agency);

  return {
    id: state?.id,
    name: state?.name,
    original_index: state?.original_index ?? index,
    state,
    status,
    records,
    completed,
    inFlight: !completed,
    skipped: false,
    corruptErrors: [],
    resumedArtifact,
    resumedArtifactHash: resumedArtifact === null ? null : hashArtifact(resumedArtifact, hashOptions),
    resumedArtifactSource:
      canonicalArtifact !== null ? 'section_state.final_output' : logArtifact !== null ? 'deliberation_log.proposed_artifact' : null
  };
}

function resumeHashError(section, expectedHash, actualHash) {
  return {
    code: 'RESUME_HASH_MISMATCH',
    section_id: section.id,
    section_name: section.name,
    message: `hash mismatch for section ${section.id}: expected ${expectedHash}, recomputed ${actualHash}`,
    expected_hash: expectedHash,
    actual_hash: actualHash
  };
}

function collectResumeValidationErrors(sectionStates, logSections, unscopedErrors, options = {}) {
  const errors = [...unscopedErrors];

  if (logSections.length < sectionStates.length) {
    for (let index = logSections.length; index < sectionStates.length; index += 1) {
      const state = sectionStates[index] ?? {};
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_id: state.id,
        section_name: state.name,
        section_index: index,
        message: `missing section state for ${state.id ?? `section index ${index}`}`
      });
    }
  } else if (logSections.length > sectionStates.length) {
    for (let index = sectionStates.length; index < logSections.length; index += 1) {
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_index: index,
        message: `deliberation log has no canonical section state for section index ${index}`
      });
    }
  }

  const sections = sectionStates.map((state, index) => {
    const section = normalizeResumeSection(state, logSections[index], index, options);
    if (!state || typeof state !== 'object' || Array.isArray(state) || !state.id) {
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_index: index,
        message: `missing section state for section index ${index}`
      });
    }

    for (const error of logSections[index]?.errors ?? []) {
      errors.push({
        ...error,
        section_id: section.id,
        section_name: section.name,
        section_index: index
      });
    }

    if (!logSections[index]?.status) {
      errors.push({
        code: 'RESUME_SECTION_STATE_MISSING',
        section_id: section.id,
        section_name: section.name,
        section_index: index,
        message: `missing section state for ${section.id}`
      });
    }

    const stateHash = state?.final_artifact_hash ?? null;
    const statusHash = logSections[index]?.status?.final_artifact_hash ?? null;
    if (stateHash && statusHash && stateHash !== statusHash) {
      errors.push(resumeHashError(section, stateHash, statusHash));
    }

    const expectedHash = statusHash ?? stateHash;
    if (expectedHash && section.resumedArtifact === null) {
      errors.push({
        code: 'RESUME_SECTION_OUTPUT_MISSING',
        section_id: section.id,
        section_name: section.name,
        section_index: index,
        message: `missing canonical final output for section ${section.id}`
      });
    }
    if (section.resumedArtifact !== null && expectedHash && section.resumedArtifactHash !== expectedHash) {
      errors.push(resumeHashError(section, expectedHash, section.resumedArtifactHash));
    }

    return section;
  });

  return { sections, errors };
}

async function writeResumeErrors(runDir, errors, skippedIds = []) {
  if (!runDir) return null;

  const outputPath = path.join(runDir, 'resume-errors.json');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        consensus_schema_version: 'v0',
        generated_at: nowIso(),
        errors,
        skipped_section_ids: skippedIds
      },
      null,
      2
    )}\n`
  );
  await syncPathIfAvailable(outputPath);
  return outputPath;
}

async function defaultConfirmSkipAllCorrupt({ errors, stdin = process.stdin, stdout = process.stdout } = {}) {
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      `Skip ${errors.length} corrupt resume section(s) and continue? [y/N] `
    );
    return /^y(?:es)?$/iu.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function applyResumeSkipPolicy(sections, errors, options = {}) {
  const sectionErrors = errors.filter((error) => error.section_id);
  const explicitSkipIds = new Set(options.skipCorruptSections ?? []);
  let skipAll = Boolean(options.yesSkipCorrupt);

  if (!skipAll && options.skipAllCorrupt && sectionErrors.length > 0) {
    const confirm = options.confirmSkipAllCorrupt ?? defaultConfirmSkipAllCorrupt;
    skipAll = await confirm({
      errors: sectionErrors,
      stdin: options.stdin,
      stdout: options.stdout
    });
  }

  const skippedIds = new Set();
  for (const error of sectionErrors) {
    if (skipAll || explicitSkipIds.has(error.section_id)) {
      skippedIds.add(error.section_id);
    }
  }

  for (const section of sections) {
    if (!skippedIds.has(section.id)) continue;
    section.skipped = true;
    section.inFlight = false;
    section.completed = false;
    section.corruptErrors = errors.filter((error) => error.section_id === section.id);
  }

  return {
    skippedIds,
    unhandledErrors: errors.filter((error) => !error.section_id || !skippedIds.has(error.section_id))
  };
}

function corruptResumeError(errors, diagnosticsPath) {
  const details = {
    errors,
    ...(diagnosticsPath ? { resume_errors_path: diagnosticsPath } : {})
  };
  const firstMessage = errors[0]?.message ? `: ${errors[0].message}` : '';
  return resumeDataError(`corrupt resume state${firstMessage}; resume is blocked until corrupt sections are skipped explicitly`, {
    code: 'RESUME_CORRUPT',
    details
  });
}

async function readResumePathOrText(pathOrText) {
  const value = String(pathOrText ?? '');
  if (!value.includes('\n')) {
    try {
      const fileStatus = await stat(value);
      if (fileStatus.isFile()) {
        return {
          text: await readFile(value, 'utf8'),
          sourcePath: path.resolve(value)
        };
      }
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) {
        throw error;
      }
    }
  }
  return { text: value, sourcePath: null };
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    return fallback;
  }
}

async function readTextIfPresent(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return null;
  }
}

function manifestError(message, details = {}) {
  return new ConsensusError(message, {
    code: details.code ?? 'INVALID_MANIFEST',
    exitCode: details.exitCode ?? EXIT_CODES.CONFIG,
    details: details.details
  });
}

function pathConfinementError(field, target, root) {
  return manifestError(`${field} path is outside allowed root: ${target}`, {
    code: 'PATH_OUTSIDE_ROOT',
    exitCode: EXIT_CODES.NOPERM,
    details: { field, path: target, root }
  });
}

function runDirConfinementError(field, target, runDir) {
  return manifestError(`${field} path is outside prepared run directory: ${target}`, {
    code: 'PATH_OUTSIDE_RUN_DIR',
    exitCode: EXIT_CODES.NOPERM,
    details: { field, path: target, run_dir: runDir }
  });
}

function requiredManifestString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw manifestError(`parallel manifest ${field} must be a non-empty string`);
  }
}

function requiredManifestInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw manifestError(`parallel manifest ${field} must be a non-negative integer`);
  }
}

function validateParallelManifestShape(manifest) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw manifestError('parallel manifest must be a JSON object');
  }
  if (manifest.consensus_schema_version !== 'v0') {
    throw manifestError('parallel manifest consensus_schema_version must be v0');
  }
  if (manifest.manifest_type !== 'consensus-parallel-run') {
    throw manifestError('parallel manifest manifest_type must be consensus-parallel-run');
  }
  if (manifest.mode !== 'parallel') {
    throw manifestError('parallel manifest mode must be parallel');
  }

  for (const field of ['input_path', 'output_path', 'run_dir']) {
    requiredManifestString(manifest[field], field);
  }
  if (!Array.isArray(manifest.sections)) {
    throw manifestError('parallel manifest sections must be an array');
  }

  for (const [index, entry] of manifest.sections.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw manifestError(`parallel manifest sections[${index}] must be a JSON object`);
    }
    for (const field of [
      'section_id',
      'name',
      'packet_path',
      'section_file',
      'output_records',
      'output_section',
      'output_status',
      'subagent_id'
    ]) {
      requiredManifestString(entry[field], `sections[${index}].${field}`);
    }
    requiredManifestInteger(entry.original_index, `sections[${index}].original_index`);
  }
}

function resolveManifestPathValue(value, basePath) {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(basePath, value);
}

async function assertPathResolvesInside(rootPath, targetPath, field, errorFactory) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  const realRoot = await realpath(root);
  const existing = await nearestExistingPath(target);
  const realExisting = await realpath(existing);
  const realTarget = path.resolve(realExisting, path.relative(existing, target));

  if (!inside(realRoot, realTarget)) {
    throw errorFactory(field, target, root);
  }
}

async function resolveConfinedManifestPath(value, { root, base, field, errorFactory }) {
  requiredManifestString(value, field);
  const resolved = resolveManifestPathValue(value, base);
  const resolvedRoot = path.resolve(root);
  if (!inside(resolvedRoot, resolved)) {
    throw errorFactory(field, resolved, resolvedRoot);
  }
  await assertPathResolvesInside(resolvedRoot, resolved, field, errorFactory);
  return resolved;
}

async function resolveManifestOutputPath(manifest, { cwd, trustedRoot }) {
  const inputPath = resolveManifestPathValue(manifest.input_path, cwd);
  const outputPath = resolveManifestPathValue(manifest.output_path, cwd);
  const defaultOutputPath = path.resolve(`${inputPath}.consensus.md`);

  if (outputPath === defaultOutputPath) {
    const outputWriteRoot = path.dirname(inputPath);
    await assertPathResolvesInside(outputWriteRoot, outputPath, 'output_path', pathConfinementError);
    return { inputPath, outputPath, outputWriteRoot };
  }

  return {
    inputPath,
    outputPath: await resolveConfinedManifestPath(manifest.output_path, {
      root: trustedRoot,
      base: cwd,
      field: 'output_path',
      errorFactory: pathConfinementError
    }),
    outputWriteRoot: trustedRoot
  };
}

async function normalizeParallelManifest(manifest, options) {
  validateParallelManifestShape(manifest);

  const cwd = path.resolve(options.cwd);
  const trustedRoot = path.resolve(options.trustedRoot);
  const manifestPath = path.resolve(options.manifestPath);
  const runDir = await resolveConfinedManifestPath(manifest.run_dir, {
    root: trustedRoot,
    base: cwd,
    field: 'run_dir',
    errorFactory: pathConfinementError
  });

  if (runDir !== path.dirname(manifestPath)) {
    throw manifestError('parallel manifest run_dir must match the manifest file directory');
  }

  if (manifest.manifest_path !== undefined) {
    const declaredManifestPath = await resolveConfinedManifestPath(manifest.manifest_path, {
      root: trustedRoot,
      base: cwd,
      field: 'manifest_path',
      errorFactory: pathConfinementError
    });
    if (declaredManifestPath !== manifestPath) {
      throw manifestError('parallel manifest manifest_path must match the fan-in manifest path');
    }
  }

  const { inputPath, outputPath, outputWriteRoot } = await resolveManifestOutputPath(manifest, { cwd, trustedRoot });

  const sections = [];
  for (const entry of manifest.sections) {
    sections.push({
      ...entry,
      packet_path: await resolveConfinedManifestPath(entry.packet_path, {
        root: runDir,
        base: runDir,
        field: 'packet_path',
        errorFactory: runDirConfinementError
      }),
      section_file: await resolveConfinedManifestPath(entry.section_file, {
        root: runDir,
        base: runDir,
        field: 'section_file',
        errorFactory: runDirConfinementError
      }),
      output_records: await resolveConfinedManifestPath(entry.output_records, {
        root: runDir,
        base: runDir,
        field: 'output_records',
        errorFactory: runDirConfinementError
      }),
      output_section: await resolveConfinedManifestPath(entry.output_section, {
        root: runDir,
        base: runDir,
        field: 'output_section',
        errorFactory: runDirConfinementError
      }),
      output_status: await resolveConfinedManifestPath(entry.output_status, {
        root: runDir,
        base: runDir,
        field: 'output_status',
        errorFactory: runDirConfinementError
      })
    });
  }

  return {
    ...manifest,
    input_path: inputPath,
    output_path: outputPath,
    output_write_root: outputWriteRoot,
    run_dir: runDir,
    manifest_path: manifestPath,
    sections
  };
}

function latestRevisedOutput(records, fallback) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (typeof record?.proposed_artifact === 'string') {
      return record.proposed_artifact;
    }
  }
  return fallback;
}

function fallbackErrorStatus(error, records, peerCount) {
  const turns = records.length;
  return {
    status: 'error',
    termination_reason: 'hard_error',
    turns,
    rounds: turns === 0 ? 0 : Math.ceil(turns / peerCount),
    error: error.message
  };
}

function aggregateStatus(sections) {
  const statuses = sections.map((section) => section.status?.status ?? section.result?.status?.status ?? 'unknown');
  if (statuses.every((status) => status === 'converged')) return 'converged';
  if (statuses.some((status) => status === 'error')) return 'error';
  if (statuses.some((status) => status === 'impasse' || status === 'max-rounds' || status === 'oscillation')) {
    return 'partial';
  }
  return 'unknown';
}

function aggregateParallelStatus(sections) {
  const statuses = sections.map((section) => section.status?.status ?? 'unknown');
  if (statuses.every((status) => status === 'converged')) return 'converged';
  if (statuses.some((status) => ['error', 'impasse'].includes(status))) {
    return statuses.some((status) => status === 'converged') ? 'partial' : 'error';
  }
  return aggregateStatus(sections);
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
    final_artifact_hash: section.status?.final_artifact_hash ?? null,
    final_output: sectionOutput(section),
    subagent_id: section.subagent_id ?? null
  }));
}

function countByStatus(sections, statusName) {
  return sections.filter((section) => section.status?.status === statusName).length;
}

function failingSections(sections) {
  return sections
    .filter((section) => ['error', 'impasse'].includes(section.status?.status))
    .map((section) => ({
      id: section.id,
      name: section.name,
      original_index: section.original_index,
      status: section.status.status,
      termination_reason: section.status?.termination_reason ?? null
    }));
}

function renderRecord(record) {
  const verdictDocument = {
    schema_version: record.schema_version ?? 'v0',
    verdict: record.verdict ?? 'UNKNOWN',
    reasoning: record.reasoning ?? ''
  };
  if ('user_direction' in record) {
    verdictDocument.user_direction = record.user_direction;
  }
  if ('proposed_artifact' in record) {
    verdictDocument.proposed_artifact = record.proposed_artifact;
  }
  if ('concerns' in record) {
    verdictDocument.concerns = record.concerns;
  }

  const roundLabel = record.round_index ?? record.round ?? '?';
  const heading =
    verdictDocument.verdict === 'USER_INTERVENTION'
      ? `#### <user round=${roundLabel}> - USER_INTERVENTION`
      : `#### Round ${roundLabel} - ${record.agent ?? record.provider ?? 'peer'} - ${verdictDocument.verdict}`;
  const parts = [heading];

  if (verdictDocument.verdict === 'USER_INTERVENTION') {
    parts.push('', 'User direction:', sanitizeLogProse(record.user_direction ?? verdictDocument.reasoning));
    parts.push('', canonicalJsonBlock('consensus-verdict', verdictDocument));
    return parts.join('\n');
  }

  if (verdictDocument.reasoning) {
    parts.push('', 'Reasoning:', sanitizeLogProse(verdictDocument.reasoning));
  }

  if (verdictDocument.proposed_artifact) {
    parts.push('', 'Proposed Artifact:', dynamicFence(sanitizeProse(verdictDocument.proposed_artifact), 'markdown'));
  }

  parts.push('', canonicalJsonBlock('consensus-verdict', verdictDocument));
  return parts.join('\n');
}

function yamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  const text = String(value);
  return /^[A-Za-z0-9_.-]+$/u.test(text) ? text : JSON.stringify(text);
}

function renderArtifactFrontmatter(resolution) {
  const fields = {
    consensus_schema_version: resolution.consensus_schema_version,
    status: resolution.status,
    mode: resolution.mode,
    parallel: resolution.parallel,
    iteration: resolution.iteration,
    cold_start: resolution.cold_start,
    agency: resolution.agency,
    peers: resolution.peers,
    host: resolution.host,
    sections_total: resolution.sections.total,
    sections_converged: resolution.sections.converged,
    sections_impasse: resolution.sections.impasse,
    sections_error: resolution.sections.error,
    total_turns: resolution.total_turns,
    total_rounds: resolution.total_rounds,
    wall_clock_ms: resolution.wall_clock_ms,
    cost_source: resolution.cost_source,
    approximate_cost_usd: resolution.approximate_cost_usd,
    input_path: resolution.input_path,
    run_id: resolution.run_id,
    generated_at: resolution.ended_at
  };

  return ['---', ...Object.entries(fields).map(([key, value]) => `${key}: ${yamlScalar(value)}`), '---'].join('\n');
}

function renderResolutionSummary(resolution) {
  const rows = [
    `- Status: ${resolution.status}`,
    `- Mode: ${resolution.mode}`,
    `- Parallel: ${resolution.parallel ? 'true' : 'false'}`,
    `- Agency: ${resolution.agency}`,
    `- Peers: ${resolution.peers.join(', ')}`,
    `- Sections: ${resolution.sections.converged}/${resolution.sections.total} converged; ${resolution.sections.impasse} impasse; ${resolution.sections.error} error`,
    `- Turns: ${resolution.total_turns}; rounds: ${resolution.total_rounds}`
  ];

  if (resolution.subagent_ids?.length > 0) {
    rows.push(`- Subagents: ${resolution.subagent_ids.join(', ')}`);
  }

  return rows.join('\n');
}

function tableCell(value) {
  return sanitizeProse(value).replace(/\|/g, '\\|') || '-';
}

function renderSectionStatesSummary(states) {
  const rows = [
    '| Section | Status | Turns | Rounds |',
    '| --- | --- | ---: | ---: |'
  ];
  for (const state of states) {
    rows.push(`| ${tableCell(state.name)} | ${tableCell(state.status)} | ${state.turns} | ${state.rounds} |`);
  }
  return rows.join('\n');
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

  for (const peer of peers) {
    validateProviderId(peer, '--peers');
  }

  return peers;
}

function validateProviderId(providerId, label = 'provider id') {
  if (typeof providerId !== 'string' || !PROVIDER_ID_PATTERN.test(providerId)) {
    throw new Error(`${label} "${providerId}" must match ^[a-z][a-z0-9-]{0,31}$`);
  }
  return providerId;
}

function normalizeProviderInventory(providerInventory) {
  const entries = Array.isArray(providerInventory)
    ? providerInventory
    : providerInventory?.providers ?? providerInventory?.data ?? [];

  return entries.map((entry) => {
    if (typeof entry === 'string') {
      return { id: validateProviderId(entry, 'provider inventory id'), available: true };
    }

    const id = validateProviderId(entry.id ?? entry.name ?? entry.provider, 'provider inventory id');
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

export async function atomicWriteFile(targetPath, contents, options = {}) {
  const writePath = options.rootPath ? await confineWrite(targetPath, options.rootPath) : path.resolve(targetPath);

  if (await pathExists(writePath)) {
    const targetStat = await lstat(writePath);
    if (targetStat.isSymbolicLink()) {
      throw new Error(`write target may not be a symlink: ${writePath}`);
    }
  }

  await mkdir(path.dirname(writePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(writePath),
    `.${path.basename(writePath)}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`
  );

  try {
    await writeFile(tempPath, contents);
    await syncPathIfAvailable(tempPath);
    await rename(tempPath, writePath);
    await syncPathIfAvailable(path.dirname(writePath));
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

  return writePath;
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

export async function resolveResumePath(options = {}) {
  if (!options.resume) return null;

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const root = path.resolve(options.allowRoot ?? cwd);
  const target = path.isAbsolute(options.resume) ? options.resume : path.resolve(cwd, options.resume);
  return await confineWrite(target, root);
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
    iteration: 'alternating',
    coldStart: 'shared_input',
    output: null,
    resume: null,
    userDirection: null,
    runDir: null,
    allowRoot: null,
    failOnSectionError: false,
    skipCorruptSections: [],
    skipAllCorrupt: false,
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
      case '--iteration':
        parsed.iteration = requireValue(argv, index, token);
        index += 1;
        break;
      case '--cold-start':
        parsed.coldStart = requireValue(argv, index, token);
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
      case '--user-direction':
        parsed.userDirection = requireValue(argv, index, token);
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
      case '--skip-all-corrupt':
        parsed.skipAllCorrupt = true;
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

  if (!ITERATION_MODES.includes(parsed.iteration)) {
    throw invalidIterationModeError(parsed.iteration);
  }

  if (parsed.coldStart === 'independent_draft') {
    throw new Error('--cold-start independent_draft is not yet supported');
  }
  if (parsed.coldStart !== 'shared_input') {
    throw new Error('--cold-start must be shared_input');
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

export async function parseDeliberationArtifactForResume(pathOrText, options = {}) {
  const { text, sourcePath } = await readResumePathOrText(pathOrText);
  const frontmatter = parseFrontmatter(text);
  const consensusSchemaVersion = frontmatter.consensus_schema_version;
  if (consensusSchemaVersion !== 'v0') {
    throw resumeDataError(`unsupported consensus_schema_version for resume: ${consensusSchemaVersion ?? '(missing)'}`, {
      code: 'RESUME_SCHEMA_UNSUPPORTED',
      details: { consensus_schema_version: consensusSchemaVersion ?? null }
    });
  }

  const resolutions = extractConsensusJsonBlocks(text, 'consensus-resolution');
  const sectionStatesBlocks = extractConsensusJsonBlocks(text, 'consensus-section-states');
  if (resolutions.length !== 1) {
    throw resumeDataError('resume artifact must contain exactly one consensus-resolution block', {
      code: 'RESUME_RESOLUTION_MISSING',
      details: { count: resolutions.length }
    });
  }
  if (sectionStatesBlocks.length !== 1 || !Array.isArray(sectionStatesBlocks[0])) {
    throw resumeDataError('resume artifact must contain one consensus-section-states array block', {
      code: 'RESUME_SECTION_STATE_MISSING',
      details: { count: sectionStatesBlocks.length }
    });
  }

  const resolution = resolutions[0];
  const sectionStates = sectionStatesBlocks[0];
  const { logSections, unscopedErrors } = extractLogSectionBlocks(text);
  const resumeAgency = resumeAgencyFromMetadata(resolution, frontmatter, options);
  const { sections, errors } = collectResumeValidationErrors(sectionStates, logSections, unscopedErrors, {
    peers: resolution.peers,
    agency: resumeAgency
  });
  const { skippedIds, unhandledErrors } = await applyResumeSkipPolicy(sections, errors, options);
  const diagnosticsPath = errors.length > 0 ? await writeResumeErrors(options.runDir, errors, [...skippedIds]) : null;
  if (unhandledErrors.length > 0) {
    throw corruptResumeError(unhandledErrors, diagnosticsPath);
  }

  return {
    sourcePath,
    consensusSchemaVersion,
    frontmatter,
    resolution,
    sectionStates,
    sections,
    completedSections: sections.filter((section) => section.completed),
    inFlightSections: sections.filter((section) => section.inFlight),
    skippedCorruptSections: sections.filter((section) => section.skipped),
    resumeErrors: errors,
    resumeErrorsPath: diagnosticsPath
  };
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
    iteration: 'alternating',
    coldStart: 'shared_input',
    failOnSectionError: false,
    ...parsed
  };
}

function sectionRunDirectory(runDir, section) {
  return path.join(runDir, 'sections', `${String(section.original_index + 1).padStart(2, '0')}-${section.id}`);
}

function sectionLookup(sections) {
  return new Map(
    (sections ?? []).flatMap((section) => [
      [`id:${section.id}`, section],
      [`index:${section.original_index}`, section]
    ])
  );
}

function sequentialRunSections(parsedSections, resumeState) {
  if (!resumeState) return parsedSections;
  const currentSections = sectionLookup(parsedSections);
  return resumeState.sections.map((resumeSection, index) => {
    const currentSection =
      currentSections.get(`id:${resumeSection.id}`) ??
      currentSections.get(`index:${resumeSection.original_index}`) ??
      null;

    return {
      id: resumeSection.id,
      name: resumeSection.name,
      original_index: resumeSection.original_index ?? index,
      markdown: currentSection?.markdown ?? resumeSection.resumedArtifact ?? ''
    };
  });
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
    '--iteration',
    options.iteration ?? 'alternating',
    '--output-records',
    paths.records,
    '--output-section',
    paths.output,
    '--output-status',
    paths.status
  ];
}

function parallelismFor(sectionCount, requested) {
  if (requested !== null && requested !== undefined) {
    return Math.min(requested, sectionCount);
  }
  return Math.min(sectionCount, 4);
}

function manifestSectionEntry({ section, paths, packetPath, loopArgv }) {
  return {
    section_id: section.id,
    name: section.name,
    original_index: section.original_index,
    packet_path: packetPath,
    section_file: paths.input,
    output_records: paths.records,
    output_section: paths.output,
    output_status: paths.status,
    subagent_id: `section-runner-${String(section.original_index + 1).padStart(2, '0')}-${section.id}`,
    loop_argv: loopArgv
  };
}

function dispatchInstructions(manifest) {
  return {
    phase: 'parallel_dispatch_required',
    manifest: manifest.manifest_path,
    parallelism: manifest.parallelism,
    sections: manifest.sections.map((section) => ({
      section_id: section.section_id,
      name: section.name,
      original_index: section.original_index,
      packet_path: section.packet_path,
      subagent_id: section.subagent_id,
      output_records: section.output_records,
      output_section: section.output_section,
      output_status: section.output_status
    }))
  };
}

export function renderDeliberationArtifact(runResult) {
  const sections = [...runResult.sections].sort((left, right) => left.original_index - right.original_index);
  const status = runResult.status ?? aggregateStatus(sections);
  const states = sectionStates(sections);
  const finalOutput = sections.map(sectionOutput).join('\n\n').replace(/\n*$/u, '\n');
  const totalRounds = sections.reduce((sum, section) => sum + (section.status?.rounds ?? 0), 0);
  const totalTurns = sections.reduce((sum, section) => sum + (section.status?.turns ?? 0), 0);
  const resolution = {
    consensus_schema_version: 'v0',
    status,
    mode: runResult.mode ?? 'sequential',
    parallel: Boolean(runResult.parallel),
    iteration: runResult.iteration ?? 'alternating',
    cold_start: runResult.coldStart ?? 'shared_input',
    agency: runResult.agency,
    peers: runResult.peers,
    host: runResult.host ?? 'unknown',
    max_rounds: runResult.maxRounds,
    sections: {
      total: sections.length,
      converged: countByStatus(sections, 'converged'),
      impasse: countByStatus(sections, 'impasse'),
      max_rounds: countByStatus(sections, 'max-rounds'),
      oscillation: countByStatus(sections, 'oscillation'),
      error: countByStatus(sections, 'error')
    },
    total_rounds: totalRounds,
    total_turns: totalTurns,
    wall_clock_ms: runResult.wallClockMs ?? null,
    cost_source: 'unavailable',
    approximate_cost_usd: null,
    input_path: runResult.inputPath ?? null,
    run_id: runResult.runId ?? (runResult.runDir ? path.basename(runResult.runDir) : null),
    started_at: runResult.startedAt ?? null,
    ended_at: runResult.endedAt ?? null,
    subagent_ids: sections.map((section) => section.subagent_id).filter(Boolean)
  };

  const parts = [
    renderArtifactFrontmatter(resolution),
    '',
    '# Consensus Refine Artifact',
    '',
    '## Final Output',
    '',
    finalOutput,
    '## Resolution',
    '',
    renderResolutionSummary(resolution),
    '',
    canonicalJsonBlock('consensus-resolution', resolution),
    '',
    '## Goal',
    '',
    sanitizeProse(runResult.goal || '(no explicit goal provided)'),
    '',
    '## Section States',
    '',
    renderSectionStatesSummary(states),
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
  const resumePath = await resolveResumePath({ ...normalized, cwd });
  const resumeState = resumePath
    ? await parseDeliberationArtifactForResume(resumePath, {
        runDir,
        skipCorruptSections: normalized.skipCorruptSections,
        skipAllCorrupt: normalized.skipAllCorrupt,
        yesSkipCorrupt: normalized.yesSkipCorrupt,
        stdin: runOptions.stdin,
        stdout: runOptions.stdout
      })
    : null;
  const runWriteRoot = path.resolve(normalized.allowRoot ?? cwd);
  const outputWriteRoot = normalized.output ? path.resolve(normalized.allowRoot ?? cwd) : path.dirname(inputPath);
  const preflight =
    normalized.preflight === false
      ? { peers: normalized.peers ?? ['claude', 'codex'], warnings: [] }
      : await (normalized.preflight ?? preflightPaseo)({ ...normalized, env, cwd });
  const peers = normalized.peers ?? preflight.peers;
  const host = preflight.host ?? detectHost(env);
  const resumeSections = sectionLookup(resumeState?.sections);
  const runSections = sequentialRunSections(parsedSections, resumeState);
  const sectionResults = [];

  for (const section of runSections) {
    const sectionDir = sectionRunDirectory(runDir, section);
    const paths = {
      input: path.join(sectionDir, 'section.md'),
      records: path.join(sectionDir, 'records.json'),
      output: path.join(sectionDir, 'output.md'),
      status: path.join(sectionDir, 'status.json')
    };
    const resumeSection =
      resumeSections.get(`id:${section.id}`) ?? resumeSections.get(`index:${section.original_index}`) ?? null;
    const sectionInput = resumeSection?.resumedArtifact ?? section.markdown;

    await Promise.all([
      confineWrite(paths.records, runWriteRoot),
      confineWrite(paths.output, runWriteRoot),
      confineWrite(paths.status, runWriteRoot)
    ]);
    await atomicWriteFile(paths.input, sectionInput, { rootPath: runWriteRoot });

    if (resumeSection?.skipped) {
      const status = {
        schema_version: 'v0',
        status: 'skipped',
        termination_reason: 'corrupt_resume_skipped',
        turns: 0,
        rounds: 0,
        final_artifact_hash: hashArtifact(section.markdown),
        resume_errors: resumeSection.corruptErrors
      };
      await Promise.all([
        atomicWriteFile(paths.records, `${JSON.stringify(resumeSection.records, null, 2)}\n`, { rootPath: runWriteRoot }),
        atomicWriteFile(paths.output, section.markdown, { rootPath: runWriteRoot }),
        atomicWriteFile(paths.status, `${JSON.stringify(status, null, 2)}\n`, { rootPath: runWriteRoot })
      ]);
      sectionResults.push({
        ...section,
        paths,
        output: section.markdown,
        status,
        records: resumeSection.records
      });
      continue;
    }

    if (resumeSection?.completed) {
      await Promise.all([
        atomicWriteFile(paths.records, `${JSON.stringify(resumeSection.records, null, 2)}\n`, { rootPath: runWriteRoot }),
        atomicWriteFile(paths.output, sectionInput, { rootPath: runWriteRoot }),
        atomicWriteFile(paths.status, `${JSON.stringify(resumeSection.status, null, 2)}\n`, { rootPath: runWriteRoot })
      ]);
      sectionResults.push({
        ...section,
        paths,
        output: sectionInput,
        status: resumeSection.status,
        records: resumeSection.records
      });
      continue;
    }

    try {
      const result = await runConsensusLoop(loopArgvForSection({ section, paths, options: normalized, peers }), {
        env,
        cwd,
        invokePeer: normalized.invokePeer ?? runOptions.invokePeer,
        initialRecords: resumeSection?.records ?? [],
        initialArtifact: sectionInput,
        userDirection: resumeSection?.inFlight ? normalized.userDirection : null
      });
      sectionResults.push({
        ...section,
        paths,
        output: result.output,
        status: result.status,
        records: result.records
      });
    } catch (error) {
      const records = await readJsonIfPresent(paths.records, []);
      const persistedStatus = await readJsonIfPresent(paths.status, null);
      const recoveredOutput =
        (await readTextIfPresent(paths.output)) ?? latestRevisedOutput(records, section.markdown);
      const status = {
        ...fallbackErrorStatus(error, records, peers.length),
        ...(persistedStatus ?? {})
      };
      if (!status.error) {
        status.error = error.message;
      }
      sectionResults.push({
        ...section,
        paths,
        output: recoveredOutput,
        status,
        records
      });
    }
  }

  const endedAt = nowIso();
  const runResult = {
    mode: 'sequential',
    parallel: false,
    inputPath,
    outputPath,
    resumePath,
    resumeState,
    runDir,
    goal: normalized.goal,
    peers,
    host,
    agency: normalized.agency,
    iteration: normalized.iteration ?? 'alternating',
    coldStart: normalized.coldStart ?? 'shared_input',
    maxRounds: normalized.maxRounds,
    startedAt,
    endedAt,
    wallClockMs: Date.now() - startMs,
    sections: sectionResults
  };
  runResult.status = aggregateStatus(sectionResults);

  const artifact = renderDeliberationArtifact(runResult);
  await atomicWriteFile(outputPath, artifact, { rootPath: outputWriteRoot });
  const failedSections = failingSections(sectionResults);
  if (normalized.failOnSectionError && failedSections.length > 0) {
    throw new ConsensusError(`section error or impasse in ${failedSections.length} section(s)`, {
      code: 'SECTION_ERROR',
      exitCode: EXIT_CODES.SECTION_ERROR,
      details: {
        output_path: outputPath,
        run_dir: runDir,
        failing_sections: failedSections
      }
    });
  }
  return { ...runResult, artifact };
}

export async function prepareParallelRun(options, runOptions = {}) {
  const normalized = normalizeSequentialOptions(options);
  const cwd = path.resolve(normalized.cwd ?? runOptions.cwd ?? process.cwd());
  const env = normalized.env ?? runOptions.env ?? process.env;
  const inputPath = path.isAbsolute(normalized.inputPath) ? normalized.inputPath : path.resolve(cwd, normalized.inputPath);
  const startedAt = nowIso();
  const markdown = await readInputFile(inputPath);
  const parsedSections = parseSections(markdown);
  const runDir = await resolveRunDir({ ...normalized, cwd });
  const outputPath = await resolveOutputPath({ ...normalized, cwd }, inputPath);
  const runWriteRoot = path.resolve(normalized.allowRoot ?? cwd);
  const preflight =
    normalized.preflight === false
      ? { peers: normalized.peers ?? ['claude', 'codex'], warnings: [] }
      : await (normalized.preflight ?? preflightPaseo)({ ...normalized, env, cwd });
  const peers = normalized.peers ?? preflight.peers;
  const host = preflight.host ?? detectHost(env);
  const parallelism = parallelismFor(parsedSections.length, normalized.parallelism);
  const sections = [];

  for (const section of parsedSections) {
    const sectionDir = sectionRunDirectory(runDir, section);
    const paths = {
      input: path.join(sectionDir, 'section.md'),
      records: path.join(sectionDir, 'records.json'),
      output: path.join(sectionDir, 'output.md'),
      status: path.join(sectionDir, 'status.json')
    };
    const packetPath = path.join(sectionDir, 'packet.json');
    const loopArgv = loopArgvForSection({ section, paths, options: normalized, peers });

    await Promise.all([
      confineWrite(paths.input, runWriteRoot),
      confineWrite(paths.records, runWriteRoot),
      confineWrite(paths.output, runWriteRoot),
      confineWrite(paths.status, runWriteRoot),
      confineWrite(packetPath, runWriteRoot)
    ]);

    const packet = {
      consensus_schema_version: 'v0',
      packet_type: 'consensus-section-runner',
      manifest_path: path.join(runDir, 'manifest.json'),
      section_id: section.id,
      name: section.name,
      original_index: section.original_index,
      section_file: paths.input,
      goal: normalized.goal ?? '',
      peers,
      max_rounds: normalized.maxRounds,
      agency: normalized.agency,
      output_records: paths.records,
      output_section: paths.output,
      output_status: paths.status,
      loop_argv: loopArgv
    };

    await atomicWriteFile(paths.input, section.markdown, { rootPath: runWriteRoot });
    await atomicWriteFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, { rootPath: runWriteRoot });
    sections.push(manifestSectionEntry({ section, paths, packetPath, loopArgv }));
  }

  const manifestPath = path.join(runDir, 'manifest.json');
  await confineWrite(manifestPath, runWriteRoot);
  const manifest = {
    consensus_schema_version: 'v0',
    manifest_type: 'consensus-parallel-run',
    mode: 'parallel',
    status: 'prepared',
    created_at: startedAt,
    input_path: inputPath,
    output_path: outputPath,
    run_dir: runDir,
    goal: normalized.goal ?? '',
    peers,
    host,
    max_rounds: normalized.maxRounds,
    agency: normalized.agency,
    parallelism,
    sections,
    manifest_path: manifestPath
  };

  await atomicWriteFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { rootPath: runWriteRoot });
  const dispatchEvent = dispatchInstructions(manifest);

  return {
    mode: 'prepare_parallel',
    parallel: true,
    status: 'prepared',
    inputPath,
    outputPath,
    runDir,
    manifestPath,
    goal: normalized.goal ?? '',
    peers,
    host,
    agency: normalized.agency,
    maxRounds: normalized.maxRounds,
    parallelism,
    sections,
    dispatchEvent
  };
}

export async function fanInParallelRun(manifestPath, options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const trustedRoot = path.resolve(options.allowRoot ?? cwd);
  const resolvedManifestPath = resolveManifestPathValue(manifestPath, cwd);
  if (!inside(trustedRoot, resolvedManifestPath)) {
    throw pathConfinementError('manifest_path', resolvedManifestPath, trustedRoot);
  }
  await assertPathResolvesInside(trustedRoot, resolvedManifestPath, 'manifest_path', pathConfinementError);
  const startedAt = nowIso();
  const startMs = Date.now();
  const manifest = await normalizeParallelManifest(await readJsonFile(resolvedManifestPath), {
    cwd,
    trustedRoot,
    manifestPath: resolvedManifestPath
  });
  const sections = [];

  for (const entry of manifest.sections ?? []) {
    const errors = [];
    let output = null;
    let records = [];
    let status = null;

    try {
      output = await readFile(entry.output_section, 'utf8');
    } catch (error) {
      errors.push({
        code: 'missing output file',
        path: entry.output_section,
        message: error.message
      });
    }

    try {
      records = await readJsonFile(entry.output_records);
      if (!Array.isArray(records)) {
        errors.push({
          code: 'malformed result JSON',
          path: entry.output_records,
          message: 'records file must contain a JSON array'
        });
        records = [];
      }
    } catch (error) {
      errors.push({
        code: 'malformed result JSON',
        path: entry.output_records,
        message: error.message
      });
      records = [];
    }

    try {
      status = await readJsonFile(entry.output_status);
    } catch (error) {
      errors.push({
        code: 'malformed result JSON',
        path: entry.output_status,
        message: error.message
      });
      status = null;
    }

    if (status?.status === 'timeout' || status?.termination_reason === 'section_timeout') {
      errors.push({
        code: 'section_timeout',
        path: entry.output_status,
        message: 'section runner reported timeout'
      });
    }

    if (status?.status === 'error') {
      errors.push({
        code: 'section_error',
        path: entry.output_status,
        message: status.error ?? status.termination_reason ?? 'section runner reported error'
      });
    }

    if (errors.length > 0) {
      const original = (await readTextIfPresent(entry.section_file)) ?? '';
      const marker = {
        consensus_schema_version: 'v0',
        section_id: entry.section_id,
        subagent_id: entry.subagent_id,
        status_path: entry.output_status,
        errors
      };
      output = `${original.replace(/\n*$/u, '\n')}\n${canonicalJsonBlock('section-error', marker)}\n`;
      status = {
        schema_version: 'v0',
        ...(status ?? {}),
        status: 'error',
        termination_reason: status?.termination_reason ?? errors[0].code,
        turns: status?.turns ?? records.length,
        rounds: status?.rounds ?? 0,
        error: errors.map((error) => `${error.code}: ${error.message}`).join('; '),
        parallel_errors: errors
      };
    }

    sections.push({
      id: entry.section_id,
      name: entry.name,
      original_index: entry.original_index,
      subagent_id: entry.subagent_id,
      paths: {
        input: entry.section_file,
        records: entry.output_records,
        output: entry.output_section,
        status: entry.output_status,
        packet: entry.packet_path
      },
      output,
      records,
      status
    });
  }

  const endedAt = nowIso();
  const runResult = {
    mode: 'parallel',
    parallel: true,
    inputPath: manifest.input_path,
    outputPath: manifest.output_path,
    runDir: manifest.run_dir,
    manifestPath: resolvedManifestPath,
    goal: manifest.goal,
    peers: manifest.peers,
    host: manifest.host ?? 'unknown',
    agency: manifest.agency,
    maxRounds: manifest.max_rounds,
    startedAt,
    endedAt,
    wallClockMs: Date.now() - startMs,
    sections
  };
  runResult.status = aggregateParallelStatus(sections);

  const artifact = renderDeliberationArtifact(runResult);
  await atomicWriteFile(manifest.output_path, artifact, { rootPath: manifest.output_write_root });
  const failedSections = failingSections(sections);
  if (options.failOnSectionError && failedSections.length > 0) {
    throw new ConsensusError(`section error or impasse in ${failedSections.length} section(s)`, {
      code: 'SECTION_ERROR',
      exitCode: EXIT_CODES.SECTION_ERROR,
      details: {
        output_path: manifest.output_path,
        run_dir: manifest.run_dir,
        manifest_path: resolvedManifestPath,
        failing_sections: failedSections
      }
    });
  }
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
    const error = new Error(
      `Missing peers in Paseo inventory: ${missing.join(', ')}. Verify configured providers with "paseo provider ls --json".`
    );
    error.code = 'PEER_UNAVAILABLE';
    throw error;
  }

  if (unavailable.length > 0) {
    const error = new Error(`Paseo providers are unavailable: ${unavailable.join(', ')}.`);
    error.code = 'PEER_UNAVAILABLE';
    throw error;
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
    host,
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
      manifest_path: parsed.manifestPath,
      iteration_mode: parsed.iteration ?? 'alternating'
    });

    if (parsed.mode === 'prepare_parallel') {
      const result = await prepareParallelRun({ ...parsed, env, cwd, preflight: options.preflight });
      writeJsonl(stdout, 'parallel_dispatch_required', result.dispatchEvent);
      writeJsonl(stdout, 'run_completed', {
        status: result.status,
        manifest_path: result.manifestPath,
        run_dir: result.runDir,
        sections: result.sections.length
      });
      return 0;
    }

    if (parsed.mode === 'fan_in') {
      const result = await fanInParallelRun(parsed.manifestPath, {
        env,
        cwd,
        allowRoot: parsed.allowRoot,
        failOnSectionError: parsed.failOnSectionError
      });
      writeJsonl(stdout, 'run_completed', {
        status: result.status,
        output_path: result.outputPath,
        run_dir: result.runDir,
        sections: result.sections.length
      });
      return 0;
    }

    if (parsed.mode !== 'sequential') {
      throw new ConsensusError(`${parsed.mode} is not implemented in Phase 3 prepare`, {
        code: 'MODE_NOT_IMPLEMENTED',
        exitCode: EXIT_CODES.CONFIG
      });
    }

    const result = await runSequential(
      { ...parsed, env, cwd, preflight: options.preflight },
      { stdin: options.stdin ?? process.stdin, stdout }
    );
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
      message: error?.message ?? String(error),
      ...(error.details === undefined ? {} : { details: error.details })
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
