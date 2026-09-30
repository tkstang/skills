import { randomBytes } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type {
  AnnotatedError,
  ConsensusRecord,
  ErrorLike,
  JsonRecord,
  JsonlWritable,
  SectionStatus,
  WrapperOptions,
} from './refine-types.js';

export const INPUT_SIZE_CAP_BYTES = 1024 * 1024;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asErrorLike(error: unknown): ErrorLike {
  return isJsonRecord(error) ? (error as ErrorLike) : {};
}

export function asConsensusRecord(value: unknown): ConsensusRecord {
  return isJsonRecord(value) ? (value as ConsensusRecord) : {};
}

export function asConsensusRecords(value: unknown): ConsensusRecord[] {
  return Array.isArray(value) ? value.map(asConsensusRecord) : [];
}

export function asSectionStatus(value: unknown): SectionStatus {
  return isJsonRecord(value) ? (value as SectionStatus) : {};
}

export function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export async function pathExists(targetPath: string) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (asErrorLike(error).code === 'ENOENT') return false;
    throw error;
  }
}

export async function nearestExistingPath(targetPath: string) {
  let current = path.resolve(targetPath);
  while (!(await pathExists(current))) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

export async function syncPathIfAvailable(targetPath: string) {
  let handle;
  try {
    handle = await open(targetPath, 'r');
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function createJsonlEvent(
  event: string,
  payload: JsonRecord = {},
  options: { now?: () => string } = {},
) {
  return {
    consensus_schema_version: 'v1',
    event,
    timestamp: options.now?.() ?? nowIso(),
    ...payload,
  };
}

export function writeJsonl(
  stream: JsonlWritable,
  event: string,
  payload: JsonRecord = {},
  options: { now?: () => string } = {},
) {
  const entry = createJsonlEvent(event, payload, options);
  stream.write(`${JSON.stringify(entry)}\n`);
  return entry;
}

export function renderHumanError(
  error: unknown,
  env: NodeJS.ProcessEnv = process.env,
) {
  const details = asErrorLike(error);
  if (env.CONSENSUS_LOG === 'trace' && details.stack) {
    return details.stack;
  }
  return details.message ?? String(error);
}

export function consensusBlockPattern(label: string) {
  return new RegExp(`<!-- consensus:${label}\\n([\\s\\S]*?)\\n-->`, 'g');
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

export async function readJsonIfPresent<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    return (await readJsonFile(filePath)) as T;
  } catch (error) {
    if (asErrorLike(error).code === 'ENOENT') return fallback;
    return fallback;
  }
}

export async function readTextIfPresent(filePath: string) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (asErrorLike(error).code === 'ENOENT') return null;
    return null;
  }
}

export async function readInputFile(
  inputPath: string,
  options: Pick<WrapperOptions, 'sizeCapBytes'> = {},
) {
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

export async function confineWrite(targetPath: string, rootPath: string) {
  const root = path.resolve(rootPath);
  const target = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(root, targetPath);

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
  const realParent = path.resolve(
    realExisting,
    path.relative(existing, parent),
  );
  if (!inside(realRoot, realParent)) {
    throw new Error(`write path resolves outside allowed root: ${target}`);
  }

  return target;
}

export async function atomicWriteFile(
  targetPath: string,
  contents: string,
  options: { rootPath?: string } = {},
) {
  const writePath = options.rootPath
    ? await confineWrite(targetPath, options.rootPath)
    : path.resolve(targetPath);

  if (await pathExists(writePath)) {
    const targetStat = await lstat(writePath);
    if (targetStat.isSymbolicLink()) {
      throw new Error(`write target may not be a symlink: ${writePath}`);
    }
  }

  await mkdir(path.dirname(writePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(writePath),
    `.${path.basename(writePath)}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`,
  );

  try {
    await writeFile(tempPath, contents);
    await syncPathIfAvailable(tempPath);
    await rename(tempPath, writePath);
    await syncPathIfAvailable(path.dirname(writePath));
  } catch (error) {
    const annotatedError = error as AnnotatedError;
    try {
      await unlink(tempPath);
    } catch (cleanupError) {
      if (asErrorLike(cleanupError).code !== 'ENOENT') {
        annotatedError.cleanupError = cleanupError;
      }
    }
    throw annotatedError;
  }

  return writePath;
}

let defaultRunDirCounter = 0;

export function defaultRunDirName() {
  // Unique per invocation so a fresh run never inherits a prior run's
  // intermediate per-section records (which would resume from stale state and
  // can emit wrong output). An explicit --run-dir or --resume is unaffected.
  return `run-${Date.now()}-${process.pid}-${defaultRunDirCounter++}`;
}

export async function resolveRunDir(options: WrapperOptions = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const root = path.resolve(options.allowRoot ?? cwd);
  const target = options.runDir
    ? path.isAbsolute(options.runDir)
      ? options.runDir
      : path.resolve(cwd, options.runDir)
    : path.resolve(cwd, '.consensus', defaultRunDirName());

  return await confineWrite(target, root);
}

export async function resolveOutputPath(
  options: WrapperOptions = {},
  inputPath: string,
) {
  if (options.output) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const root = path.resolve(options.allowRoot ?? cwd);
    const target = path.isAbsolute(options.output)
      ? options.output
      : path.resolve(cwd, options.output);
    return await confineWrite(target, root);
  }

  const target = path.resolve(`${inputPath}.consensus.md`);
  return await confineWrite(target, path.dirname(path.resolve(inputPath)));
}

export async function resolveResumePath(options: WrapperOptions = {}) {
  if (!options.resume) return null;

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const root = path.resolve(options.allowRoot ?? cwd);
  const target = path.isAbsolute(options.resume)
    ? options.resume
    : path.resolve(cwd, options.resume);
  return await confineWrite(target, root);
}
