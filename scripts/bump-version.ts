#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginReleaseTargets } from '../src/distributions.js';
import { discoverSkillDirectories } from './lib/discover-skills.js';

const DEFAULT_ROOT = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);

async function skillFilesForRoot(root: string): Promise<string[]> {
  return (await discoverSkillDirectories(root)).map(
    (skillDirectory) =>
      `${path.relative(root, skillDirectory).split(path.sep).join('/')}/SKILL.md`,
  );
}

export const SKILL_FILES = await skillFilesForRoot(DEFAULT_ROOT);

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const STABLE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function isValidSemver(version: unknown): boolean {
  return SEMVER_PATTERN.test(String(version ?? ''));
}

export function isStableSemver(version: unknown): boolean {
  return STABLE_SEMVER_PATTERN.test(String(version ?? ''));
}

async function readJson(
  root: string,
  relativePath: string,
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(path.join(root, relativePath), 'utf8'),
  ) as Record<string, unknown>;
}

async function writeJson(
  root: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  await writeFile(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function replaceSkillVersion(
  markdown: string,
  version: string,
  relativePath: string,
): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u);
  if (!match || match.index === undefined) {
    throw new Error(`${relativePath}: missing frontmatter block`);
  }
  if (/^version:\s*/mu.test(match[1])) {
    throw new Error(
      `${relativePath}: top-level version is not allowed; use quoted metadata.version`,
    );
  }
  const updatedFrontmatter = match[1].replace(
    /(^metadata:\n(?:  .+\n)*?  version:\s*)["']?[^"'\n]+["']?\s*$/mu,
    `$1"${version}"`,
  );
  if (updatedFrontmatter === match[1]) {
    throw new Error(`${relativePath}: missing metadata.version`);
  }
  const trailingNewline = match[0].endsWith('\n') ? '\n' : '';
  return `${markdown.slice(0, match.index)}---\n${updatedFrontmatter}\n---${trailingNewline}${markdown.slice(
    match.index + match[0].length,
  )}`;
}

function requireVersion(version: unknown, stable = false): string {
  const text = String(version ?? '');
  const valid = stable ? isStableSemver(text) : isValidSemver(text);
  if (!valid) {
    throw new Error(
      `${stable ? 'skill version must be stable semver' : 'version must be semver'} without a leading v: ${text}`,
    );
  }
  return text;
}

function tagToVersion(tag: unknown): string {
  const text = String(tag ?? '');
  if (!text.startsWith('v')) {
    throw new Error(`release tag must start with v: ${text}`);
  }
  return requireVersion(text.slice(1));
}

function pluginTarget(name: string) {
  const target = pluginReleaseTargets.find(
    (candidate) => candidate.name === name,
  );
  if (!target) {
    throw new Error(`unknown plugin release target: ${name}`);
  }
  return target;
}

type MarketplacePlugin = { name?: unknown; version?: unknown };
type MarketplaceManifest = Record<string, unknown> & {
  plugins?: MarketplacePlugin[];
};

export type VersionTarget =
  | { kind: 'plugin'; name: string }
  | { kind: 'skill'; name: string };

export async function bumpVersion({
  root = process.cwd(),
  version,
  target,
}: {
  root?: string;
  version: string;
  target: VersionTarget;
}): Promise<{
  version: string;
  target: VersionTarget;
  updatedFiles: string[];
}> {
  if (!target) throw new Error('version target is required');
  const updatedFiles: string[] = [];

  if (target.kind === 'skill') {
    const nextVersion = requireVersion(version, true);
    const relativePath = `src/skills/${target.name}/SKILL.md`;
    const knownSkills = await skillFilesForRoot(root);
    if (!knownSkills.includes(relativePath)) {
      throw new Error(`unknown skill version target: ${target.name}`);
    }
    const filePath = path.join(root, relativePath);
    const updated = replaceSkillVersion(
      await readFile(filePath, 'utf8'),
      nextVersion,
      relativePath,
    );
    await writeFile(filePath, updated);
    updatedFiles.push(relativePath);
    return { version: nextVersion, target, updatedFiles };
  }

  if (target.kind !== 'plugin') {
    throw new Error('version target kind must be plugin or skill');
  }

  const nextVersion = requireVersion(version);
  const release = pluginTarget(target.name);
  for (const relativePath of release.providerManifests) {
    const manifest = await readJson(root, relativePath);
    manifest.version = nextVersion;
    await writeJson(root, relativePath, manifest);
    updatedFiles.push(relativePath);
  }
  for (const relativePath of release.marketplaceManifests) {
    const manifest = (await readJson(
      root,
      relativePath,
    )) as MarketplaceManifest;
    const plugin = manifest.plugins?.find(
      (entry) => entry.name === release.name,
    );
    if (!plugin) {
      throw new Error(`${relativePath}: missing ${release.name} plugin entry`);
    }
    if (Object.hasOwn(plugin, 'version')) {
      plugin.version = nextVersion;
      await writeJson(root, relativePath, manifest);
      updatedFiles.push(relativePath);
    }
  }
  return { version: nextVersion, target, updatedFiles };
}

export async function checkTagVersion({
  root = process.cwd(),
  tag,
  plugin,
}: {
  root?: string;
  tag: string;
  plugin: string;
}): Promise<{ version: string; plugin: string; ok: true }> {
  const expectedVersion = tagToVersion(tag);
  const release = pluginTarget(plugin);
  const mismatches: string[] = [];

  for (const relativePath of release.providerManifests) {
    const manifest = await readJson(root, relativePath);
    if (manifest.version !== expectedVersion) {
      mismatches.push(`${relativePath}=${String(manifest.version)}`);
    }
  }
  for (const relativePath of release.marketplaceManifests) {
    const manifest = (await readJson(
      root,
      relativePath,
    )) as MarketplaceManifest;
    const entry = manifest.plugins?.find(
      (candidate) => candidate.name === plugin,
    );
    if (
      entry &&
      Object.hasOwn(entry, 'version') &&
      entry.version !== expectedVersion
    ) {
      mismatches.push(
        `${relativePath}:${plugin}.version=${String(entry.version)}`,
      );
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `tag ${tag} does not match ${plugin} plugin versions: ${mismatches.join(', ')}`,
    );
  }
  return { version: expectedVersion, plugin, ok: true };
}

interface ParsedCli {
  root: string;
  version: string | null;
  checkTag: string | null;
  target: VersionTarget | null;
}

function parseCli(argv: string[]): ParsedCli {
  const parsed: ParsedCli = {
    root: process.cwd(),
    version: null,
    checkTag: null,
    target: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root') {
      parsed.root = argv[++index] ?? '';
    } else if (token === '--check-tag') {
      parsed.checkTag = argv[++index] ?? '';
    } else if (token === '--plugin') {
      parsed.target = { kind: 'plugin', name: argv[++index] ?? '' };
    } else if (token === '--skill') {
      parsed.target = { kind: 'skill', name: argv[++index] ?? '' };
    } else if (!parsed.version) {
      parsed.version = token;
    } else {
      throw new Error(`unexpected argument: ${token}`);
    }
  }
  return parsed;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const parsed = parseCli(argv);
  if (!parsed.target) {
    throw new Error(
      'choose exactly one version target with --plugin or --skill',
    );
  }
  if (parsed.checkTag) {
    if (parsed.target.kind !== 'plugin') {
      throw new Error('--check-tag requires --plugin');
    }
    const result = await checkTagVersion({
      root: parsed.root,
      tag: parsed.checkTag,
      plugin: parsed.target.name,
    });
    process.stdout.write(
      `tag ${parsed.checkTag} matches ${result.plugin} plugin version ${result.version}\n`,
    );
    return 0;
  }
  if (!parsed.version) {
    throw new Error(
      'usage: pnpm tsx scripts/bump-version.ts <version> (--plugin <name> | --skill <name>) [--root <path>]',
    );
  }
  const result = await bumpVersion({
    root: parsed.root,
    version: parsed.version,
    target: parsed.target,
  });
  process.stdout.write(
    `updated ${result.updatedFiles.length} files for ${result.target.kind} ${result.target.name} to ${result.version}\n`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        `version update error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
