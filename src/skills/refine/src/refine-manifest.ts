import { realpath } from 'node:fs/promises';
import path from 'node:path';

import { ConsensusError, EXIT_CODES } from '../core/consensus-loop.js';
import { inside, nearestExistingPath } from './refine-shared.js';
import type {
  JsonRecord,
  ParallelManifest,
  ParallelManifestEntry,
} from './refine-types.js';

function manifestError(message: string, details: JsonRecord = {}) {
  return new ConsensusError(message, {
    code: typeof details.code === 'string' ? details.code : 'INVALID_MANIFEST',
    exitCode:
      typeof details.exitCode === 'number'
        ? details.exitCode
        : EXIT_CODES.CONFIG,
    details: details.details,
  });
}

export function pathConfinementError(
  field: string,
  target: string,
  root: string,
) {
  return manifestError(`${field} path is outside allowed root: ${target}`, {
    code: 'PATH_OUTSIDE_ROOT',
    exitCode: EXIT_CODES.NOPERM,
    details: { field, path: target, root },
  });
}

function runDirConfinementError(field: string, target: string, runDir: string) {
  return manifestError(
    `${field} path is outside prepared run directory: ${target}`,
    {
      code: 'PATH_OUTSIDE_RUN_DIR',
      exitCode: EXIT_CODES.NOPERM,
      details: { field, path: target, run_dir: runDir },
    },
  );
}

function requiredManifestString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw manifestError(
      `parallel manifest ${field} must be a non-empty string`,
    );
  }
}

function requiredManifestInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw manifestError(
      `parallel manifest ${field} must be a non-negative integer`,
    );
  }
}

function validateParallelManifestShape(
  manifest: unknown,
): asserts manifest is ParallelManifest {
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest)
  ) {
    throw manifestError('parallel manifest must be a JSON object');
  }
  const record = manifest as JsonRecord;
  if (record.consensus_schema_version !== 'v1') {
    throw manifestError(
      'parallel manifest consensus_schema_version must be v1',
    );
  }
  if (record.manifest_type !== 'consensus-parallel-run') {
    throw manifestError(
      'parallel manifest manifest_type must be consensus-parallel-run',
    );
  }
  if (record.mode !== 'parallel') {
    throw manifestError('parallel manifest mode must be parallel');
  }

  for (const field of ['input_path', 'output_path', 'run_dir']) {
    requiredManifestString(record[field], field);
  }
  if (!Array.isArray(record.sections)) {
    throw manifestError('parallel manifest sections must be an array');
  }

  for (const [index, entry] of record.sections.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw manifestError(
        `parallel manifest sections[${index}] must be a JSON object`,
      );
    }
    const section = entry as JsonRecord;
    for (const field of [
      'section_id',
      'name',
      'packet_path',
      'section_file',
      'output_records',
      'output_section',
      'output_status',
      'subagent_id',
    ]) {
      requiredManifestString(section[field], `sections[${index}].${field}`);
    }
    requiredManifestInteger(
      section.original_index,
      `sections[${index}].original_index`,
    );
  }
}

export function resolveManifestPathValue(value: string, basePath: string) {
  return path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(basePath, value);
}

export async function assertPathResolvesInside(
  rootPath: string,
  targetPath: string,
  field: string,
  errorFactory: (field: string, target: string, root: string) => Error,
) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  const realRoot = await realpath(root);
  const existing = await nearestExistingPath(target);
  const realExisting = await realpath(existing);
  const realTarget = path.resolve(
    realExisting,
    path.relative(existing, target),
  );

  if (!inside(realRoot, realTarget)) {
    throw errorFactory(field, target, root);
  }
}

async function resolveConfinedManifestPath(
  value: unknown,
  {
    root,
    base,
    field,
    errorFactory,
  }: {
    root: string;
    base: string;
    field: string;
    errorFactory: (field: string, target: string, root: string) => Error;
  },
) {
  requiredManifestString(value, field);
  const resolved = resolveManifestPathValue(value as string, base);
  const resolvedRoot = path.resolve(root);
  if (!inside(resolvedRoot, resolved)) {
    throw errorFactory(field, resolved, resolvedRoot);
  }
  await assertPathResolvesInside(resolvedRoot, resolved, field, errorFactory);
  return resolved;
}

async function resolveManifestOutputPath(
  manifest: ParallelManifest,
  { cwd, trustedRoot }: { cwd: string; trustedRoot: string },
) {
  const inputPath = resolveManifestPathValue(manifest.input_path, cwd);
  const outputPath = resolveManifestPathValue(manifest.output_path, cwd);
  const defaultOutputPath = path.resolve(`${inputPath}.consensus.md`);

  if (outputPath === defaultOutputPath) {
    const outputWriteRoot = path.dirname(inputPath);
    await assertPathResolvesInside(
      outputWriteRoot,
      outputPath,
      'output_path',
      pathConfinementError,
    );
    return { inputPath, outputPath, outputWriteRoot };
  }

  return {
    inputPath,
    outputPath: await resolveConfinedManifestPath(manifest.output_path, {
      root: trustedRoot,
      base: cwd,
      field: 'output_path',
      errorFactory: pathConfinementError,
    }),
    outputWriteRoot: trustedRoot,
  };
}

export async function normalizeParallelManifest(
  manifest: unknown,
  options: { cwd: string; trustedRoot: string; manifestPath: string },
): Promise<ParallelManifest> {
  validateParallelManifestShape(manifest);

  const cwd = path.resolve(options.cwd);
  const trustedRoot = path.resolve(options.trustedRoot);
  const manifestPath = path.resolve(options.manifestPath);
  const runDir = await resolveConfinedManifestPath(manifest.run_dir, {
    root: trustedRoot,
    base: cwd,
    field: 'run_dir',
    errorFactory: pathConfinementError,
  });

  if (runDir !== path.dirname(manifestPath)) {
    throw manifestError(
      'parallel manifest run_dir must match the manifest file directory',
    );
  }

  if (manifest.manifest_path !== undefined) {
    const declaredManifestPath = await resolveConfinedManifestPath(
      manifest.manifest_path,
      {
        root: trustedRoot,
        base: cwd,
        field: 'manifest_path',
        errorFactory: pathConfinementError,
      },
    );
    if (declaredManifestPath !== manifestPath) {
      throw manifestError(
        'parallel manifest manifest_path must match the fan-in manifest path',
      );
    }
  }

  const { inputPath, outputPath, outputWriteRoot } =
    await resolveManifestOutputPath(manifest, { cwd, trustedRoot });

  const sections: ParallelManifestEntry[] = [];
  for (const entry of manifest.sections) {
    sections.push({
      ...entry,
      packet_path: await resolveConfinedManifestPath(entry.packet_path, {
        root: runDir,
        base: runDir,
        field: 'packet_path',
        errorFactory: runDirConfinementError,
      }),
      section_file: await resolveConfinedManifestPath(entry.section_file, {
        root: runDir,
        base: runDir,
        field: 'section_file',
        errorFactory: runDirConfinementError,
      }),
      output_records: await resolveConfinedManifestPath(entry.output_records, {
        root: runDir,
        base: runDir,
        field: 'output_records',
        errorFactory: runDirConfinementError,
      }),
      output_section: await resolveConfinedManifestPath(entry.output_section, {
        root: runDir,
        base: runDir,
        field: 'output_section',
        errorFactory: runDirConfinementError,
      }),
      output_status: await resolveConfinedManifestPath(entry.output_status, {
        root: runDir,
        base: runDir,
        field: 'output_status',
        errorFactory: runDirConfinementError,
      }),
    });
  }

  return {
    ...manifest,
    input_path: inputPath,
    output_path: outputPath,
    output_write_root: outputWriteRoot,
    run_dir: runDir,
    manifest_path: manifestPath,
    sections,
  };
}
