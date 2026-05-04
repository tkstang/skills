#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROVIDER_MANIFESTS = [
  'plugins/consensus/.claude-plugin/plugin.json',
  'plugins/consensus/.cursor-plugin/plugin.json',
  'plugins/consensus/.codex-plugin/plugin.json'
];

export const MARKETPLACE_MANIFESTS = [
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json'
];

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function isValidSemver(version) {
  return SEMVER_PATTERN.test(String(version ?? ''));
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function writeJson(root, relativePath, value) {
  await writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function requireSemver(version) {
  if (!isValidSemver(version)) {
    throw new Error(`version must be semver without a leading v: ${version}`);
  }
  return version;
}

function tagToVersion(tag) {
  const text = String(tag ?? '');
  if (!text.startsWith('v')) {
    throw new Error(`release tag must start with v: ${text}`);
  }
  return requireSemver(text.slice(1));
}

export async function bumpVersion({ root = process.cwd(), version }) {
  const nextVersion = requireSemver(version);
  const updatedFiles = [];

  for (const relativePath of PROVIDER_MANIFESTS) {
    const manifest = await readJson(root, relativePath);
    manifest.version = nextVersion;
    await writeJson(root, relativePath, manifest);
    updatedFiles.push(relativePath);
  }

  for (const relativePath of MARKETPLACE_MANIFESTS) {
    const manifest = await readJson(root, relativePath);
    for (const plugin of manifest.plugins ?? []) {
      if (Object.hasOwn(plugin, 'version')) {
        plugin.version = nextVersion;
      }
    }
    await writeJson(root, relativePath, manifest);
    updatedFiles.push(relativePath);
  }

  return { version: nextVersion, updatedFiles };
}

export async function checkTagVersion({ root = process.cwd(), tag }) {
  const expectedVersion = tagToVersion(tag);
  const mismatches = [];

  for (const relativePath of PROVIDER_MANIFESTS) {
    const manifest = await readJson(root, relativePath);
    if (manifest.version !== expectedVersion) {
      mismatches.push(`${relativePath}=${manifest.version}`);
    }
  }

  for (const relativePath of MARKETPLACE_MANIFESTS) {
    const manifest = await readJson(root, relativePath);
    for (const [index, plugin] of (manifest.plugins ?? []).entries()) {
      if (Object.hasOwn(plugin, 'version') && plugin.version !== expectedVersion) {
        mismatches.push(`${relativePath}:plugins[${index}].version=${plugin.version}`);
      }
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`tag ${tag} does not match manifest versions: ${mismatches.join(', ')}`);
  }

  return { version: expectedVersion, ok: true };
}

function parseCli(argv) {
  const parsed = { root: process.cwd(), version: null, checkTag: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root') {
      index += 1;
      parsed.root = argv[index];
    } else if (token === '--check-tag') {
      index += 1;
      parsed.checkTag = argv[index];
    } else if (!parsed.version) {
      parsed.version = token;
    } else {
      throw new Error(`unexpected argument: ${token}`);
    }
  }
  return parsed;
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseCli(argv);
  if (parsed.checkTag) {
    const result = await checkTagVersion({ root: parsed.root, tag: parsed.checkTag });
    process.stdout.write(`tag ${parsed.checkTag} matches manifest version ${result.version}\n`);
    return 0;
  }
  if (!parsed.version) {
    throw new Error('usage: node scripts/bump-version.mjs <version> [--root <path>]');
  }
  const result = await bumpVersion({ root: parsed.root, version: parsed.version });
  process.stdout.write(`updated ${result.updatedFiles.length} files to ${result.version}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
