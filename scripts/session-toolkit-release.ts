import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { inspectArchive, validateArchive } from './session-toolkit-package.js';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const packagePath = 'packages/session-toolkit';
const packageName = '@tkstang/session-toolkit';
const registry = 'https://registry.npmjs.org/';

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed: ${result.error ?? result.stderr + result.stdout}`,
  );
  return result.stdout;
}

function git(root: string, ...args: string[]): string {
  return run('git', args, root).trim();
}

function cleanSource(root: string) {
  assert.equal(
    git(root, 'status', '--porcelain', '--untracked-files=all'),
    '',
    'Release requires a clean source checkout',
  );
  const commit = git(root, 'rev-parse', 'HEAD');
  const tree = git(root, 'rev-parse', 'HEAD^{tree}');
  const pkg = JSON.parse(git(root, 'show', `HEAD:${packagePath}/package.json`));
  assert.equal(pkg.name, packageName);
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const tag = `session-toolkit-v${pkg.version}`;
  const changelog = git(root, 'show', `HEAD:${packagePath}/CHANGELOG.md`);
  const heading = `## [${pkg.version}]`;
  const start = changelog.indexOf(`${heading}\n`);
  assert.ok(start >= 0, `Missing curated release notes: ${heading}`);
  const end = changelog.indexOf('\n## ', start + heading.length);
  const notes = `${changelog.slice(start, end < 0 ? undefined : end).trim()}\n`;
  assert.ok(
    notes.split('\n').some((line) => line.startsWith('- ')),
    'Release notes must describe the release',
  );
  return { commit, tree, pkg, tag, notes, changelog: `${changelog}\n` };
}

function hash(
  bytes: string | Buffer,
  algorithm = 'sha256',
  encoding: 'hex' | 'base64' = 'hex',
) {
  return createHash(algorithm).update(bytes).digest(encoding);
}

export interface ReleaseManifest {
  schema_version: 1;
  name: string;
  version: string;
  tag: string;
  commit: string;
  source_tree: string;
  archive: string;
  sha256: string;
  integrity: string;
  notes: 'RELEASE_NOTES.md';
  notes_sha256: string;
}

/** Validate downloaded bytes against the actual clean checkout and optional Git tag. */
export function readRelease(
  directory: string,
  root = repositoryRoot,
  requireTag = false,
) {
  const source = cleanSource(root);
  const manifest: ReleaseManifest = JSON.parse(
    readFileSync(join(directory, 'release.json'), 'utf8'),
  );
  assert.equal(manifest.schema_version, 1);
  for (const [key, expected] of Object.entries({
    name: source.pkg.name,
    version: source.pkg.version,
    tag: source.tag,
    commit: source.commit,
    source_tree: source.tree,
  })) {
    assert.equal(
      manifest[key as keyof ReleaseManifest],
      expected,
      `Release ${key} does not match clean source`,
    );
  }
  assert.equal(
    manifest.archive,
    `tkstang-session-toolkit-${source.pkg.version}.tgz`,
    'Unexpected archive filename',
  );
  assert.equal(manifest.archive, basename(manifest.archive));
  const archive = join(directory, manifest.archive);
  const bytes = readFileSync(archive);
  assert.equal(manifest.sha256, hash(bytes), 'Archive SHA-256 mismatch');
  assert.equal(
    manifest.integrity,
    `sha512-${hash(bytes, 'sha512', 'base64')}`,
    'Archive integrity mismatch',
  );
  assert.equal(
    readFileSync(join(directory, 'SHA256SUMS'), 'utf8'),
    `${manifest.sha256}  ${manifest.archive}\n`,
    'Checksum manifest mismatch',
  );
  assert.equal(manifest.notes, 'RELEASE_NOTES.md');
  assert.equal(
    readFileSync(join(directory, manifest.notes), 'utf8'),
    source.notes,
    'Release notes do not match source',
  );
  assert.equal(
    manifest.notes_sha256,
    hash(source.notes),
    'Release notes checksum mismatch',
  );
  const { pkg } = inspectArchive(archive);
  // pnpm may reorder keys, but this package has no workspace protocols to rewrite.
  assert.deepEqual(pkg, source.pkg, 'Packed metadata does not match source');
  assert.equal(
    run('tar', ['-xOzf', archive, 'package/CHANGELOG.md'], root),
    source.changelog,
    'Packed changelog does not match source',
  );
  const tagExists = spawnSync(
    'git',
    ['show-ref', '--verify', '--quiet', `refs/tags/${source.tag}`],
    { cwd: root },
  );
  assert.ok(
    tagExists.status === 0 || tagExists.status === 1,
    'Could not inspect release tag',
  );
  if (requireTag || tagExists.status === 0) {
    assert.equal(
      git(root, 'rev-parse', `refs/tags/${source.tag}^{commit}`),
      source.commit,
      'Release tag must point to the exact source commit',
    );
  }
  return { manifest, archive };
}

export async function prepareRelease(out: string, root = repositoryRoot) {
  assert.match(
    process.version,
    /^v24\./,
    'Release preparation runs on Node 24',
  );
  const source = cleanSource(root);
  // Build only after cleanliness is established; ignored stale dist cannot enter a candidate.
  run('pnpm', ['run', 'build:toolkit'], root);
  mkdirSync(out);
  run('pnpm', ['pack', '--pack-destination', out], join(root, packagePath));
  const archiveName = `tkstang-session-toolkit-${source.pkg.version}.tgz`;
  const archive = join(out, archiveName);
  validateArchive(archive);
  run(
    'npm',
    [
      'publish',
      archive,
      '--dry-run',
      '--ignore-scripts',
      '--access',
      'public',
      '--registry',
      registry,
    ],
    root,
  );
  assert.equal(
    cleanSource(root).commit,
    source.commit,
    'Source changed during release preparation',
  );
  const bytes = readFileSync(archive);
  const manifest: ReleaseManifest = {
    schema_version: 1,
    name: source.pkg.name,
    version: source.pkg.version,
    tag: source.tag,
    commit: source.commit,
    source_tree: source.tree,
    archive: archiveName,
    sha256: hash(bytes),
    integrity: `sha512-${hash(bytes, 'sha512', 'base64')}`,
    notes: 'RELEASE_NOTES.md',
    notes_sha256: hash(source.notes),
  };
  for (const [file, content] of Object.entries({
    'release.json': `${JSON.stringify(manifest, null, 2)}\n`,
    SHA256SUMS: `${manifest.sha256}  ${archiveName}\n`,
    'RELEASE_NOTES.md': source.notes,
  }))
    writeFileSync(join(out, file), content, { flag: 'wx' });
  readRelease(out, root);
  console.log(
    `Prepared clean exact-archive candidate ${manifest.tag} at ${manifest.commit}: ${manifest.sha256}. Publication requires independent review, the real tag and account/environment prerequisites.`,
  );
}

/** A registry miss is only an explicit E404, never a network/auth/server failure. */
function publishedIntegrity(
  manifest: ReleaseManifest,
  root: string,
): string | null {
  const result = spawnSync(
    'npm',
    [
      'view',
      `${manifest.name}@${manifest.version}`,
      'dist.integrity',
      '--json',
      '--registry',
      registry,
    ],
    { cwd: root, encoding: 'utf8', timeout: 30_000 },
  );
  let value: unknown;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      'Registry returned no valid integrity response; refusing publication',
    );
  }
  if (result.status !== 0) {
    if (
      result.status !== null &&
      (value as { error?: { code?: string } })?.error?.code === 'E404'
    )
      return null;
    throw new Error('Registry lookup failed; refusing publication');
  }
  assert.equal(
    typeof value,
    'string',
    'Registry returned no published integrity',
  );
  assert.match(
    value as string,
    /^sha512-[A-Za-z0-9+/]+={0,2}$/,
    'Registry returned invalid published integrity',
  );
  return value as string;
}

export function registryReleaseDecision(
  manifest: ReleaseManifest,
  root = repositoryRoot,
): 'publish' | 'already-published' {
  const integrity = publishedIntegrity(manifest, root);
  if (integrity === null) return 'publish';
  assert.equal(
    integrity,
    manifest.integrity,
    'Published version integrity mismatch; refusing publication',
  );
  return 'already-published';
}

/** Root-owned execution only: never rebuild and never infer authentication from a dry run. */
export function publishRelease(
  directory: string,
  root = repositoryRoot,
  bootstrap = false,
) {
  assert.match(process.version, /^v24\./, 'Publication runs on Node 24');
  const npmVersion = run('npm', ['--version'], root).trim();
  const [major, minor, patch] = npmVersion.split('.').map(Number);
  assert.ok(
    major! > 11 ||
      (major === 11 && (minor! > 5 || (minor === 5 && patch! >= 1))),
    'Publication requires npm >=11.5.1',
  );
  if (!bootstrap)
    assert.equal(
      process.env.SESSION_TOOLKIT_RELEASE_ENABLED,
      'true',
      'Trusted publication must be explicitly enabled',
    );
  const { manifest, archive } = readRelease(directory, root, true);
  // Releases must be merged. Fetch origin/main and tags before this command.
  git(
    root,
    'merge-base',
    '--is-ancestor',
    manifest.commit,
    'refs/remotes/origin/main',
  );
  validateArchive(archive);
  if (registryReleaseDecision(manifest, root) === 'already-published') {
    console.log(
      `Already published with matching integrity: ${manifest.name}@${manifest.version}`,
    );
    return;
  }
  // Recheck after installation/registry I/O, immediately before the external write.
  readRelease(directory, root, true);
  run(
    'npm',
    [
      'publish',
      archive,
      '--ignore-scripts',
      '--access',
      'public',
      '--registry',
      registry,
      ...(bootstrap ? [] : ['--provenance']),
    ],
    root,
  );
  assert.equal(
    publishedIntegrity(manifest, root),
    manifest.integrity,
    'Published registry integrity does not match the validated archive',
  );
  console.log(
    `Published exact archive: ${manifest.name}@${manifest.version} ${manifest.integrity}`,
  );
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      directory: { type: 'string' },
      node: { type: 'string' },
      bootstrap: { type: 'boolean', default: false },
      'require-tag': { type: 'boolean', default: false },
      tag: { type: 'string' },
    },
  });
  const [command] = positionals;
  assert.equal(positionals.length, 1, 'Choose prepare, verify or publish');
  if (command === 'prepare') {
    assert.ok(
      values.out &&
        !values.directory &&
        !values.node &&
        !values.bootstrap &&
        !values['require-tag'] &&
        !values.tag,
      'prepare requires only --out <new-directory>',
    );
    await prepareRelease(resolve(values.out));
  } else if (command === 'verify') {
    assert.ok(
      values.directory && !values.out && !values.bootstrap,
      'verify requires --directory <candidate-directory>',
    );
    const { manifest, archive } = readRelease(
      resolve(values.directory),
      repositoryRoot,
      values['require-tag'] || Boolean(values.tag),
    );
    if (values.tag)
      assert.equal(
        manifest.tag,
        values.tag,
        'Requested tag does not match release version',
      );
    validateArchive(
      archive,
      values.node ? resolve(values.node) : process.execPath,
    );
  } else if (command === 'publish') {
    assert.ok(
      values.directory &&
        values.tag &&
        !values.out &&
        !values.node &&
        !values['require-tag'],
      'publish requires --directory <candidate-directory> --tag <existing-tag> [--bootstrap]',
    );
    assert.equal(
      readRelease(resolve(values.directory), repositoryRoot, true).manifest.tag,
      values.tag,
      'Requested tag does not match release version',
    );
    publishRelease(resolve(values.directory), repositoryRoot, values.bootstrap);
  } else throw new Error('Choose prepare, verify or publish');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
