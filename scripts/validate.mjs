import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isValidSemver } from './bump-version.mjs';

const DEFAULT_ROOT = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);
const PROVIDER_MANIFESTS = [
  'plugins/consensus/.claude-plugin/plugin.json',
  'plugins/consensus/.cursor-plugin/plugin.json',
  'plugins/consensus/.codex-plugin/plugin.json',
];
const MARKETPLACE_MANIFESTS = [
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];
const REQUIRED_SKILL_FIELDS = [
  'name',
  'description',
  'license',
  'compatibility',
];

function inside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function stripQuotes(value) {
  return value.trim().replace(/^["']|["']$/g, '');
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function listSubdirectories(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function discoverSkillDirectories(root) {
  const skillDirectories = new Set();

  for (const skillPath of await listSubdirectories(path.join(root, 'skills'))) {
    if (await pathExists(path.join(skillPath, 'SKILL.md'))) {
      skillDirectories.add(skillPath);
    }
  }

  for (const pluginPath of await listSubdirectories(
    path.join(root, 'plugins'),
  )) {
    for (const skillPath of await listSubdirectories(
      path.join(pluginPath, 'skills'),
    )) {
      if (await pathExists(path.join(skillPath, 'SKILL.md'))) {
        skillDirectories.add(skillPath);
      }
    }
  }

  return [...skillDirectories].sort((left, right) =>
    path.relative(root, left).localeCompare(path.relative(root, right)),
  );
}

export function parseFrontmatter(markdown, source = 'markdown') {
  const match = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    throw new Error(`${source}: missing frontmatter block`);
  }

  const result = {};
  let activeMap = null;

  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;

    const nested = line.match(/^  ([^:]+):\s*(.+)$/);
    if (nested && activeMap) {
      result[activeMap][nested[1].trim()] = stripQuotes(nested[2]);
      continue;
    }

    activeMap = null;
    const pair = line.match(/^([^:]+):\s*(.*)$/);
    if (!pair) {
      throw new Error(`${source}: unsupported frontmatter line "${line}"`);
    }

    const key = pair[1].trim();
    const rawValue = pair[2].trim();
    if (rawValue === '') {
      result[key] = {};
      activeMap = key;
    } else {
      result[key] = stripQuotes(rawValue);
    }
  }

  return result;
}

export async function parseJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${filePath}: ${error.message}`);
  }
}

export async function validateSkillReference(root, skill, pluginRoot = root) {
  const issues = [];

  if (!skill?.path) {
    return ['skill reference is missing path'];
  }

  if (skill.path.includes('..')) {
    issues.push(`skill path may not escape plugin root: ${skill.path}`);
    return issues;
  }

  const resolvedPath = path.resolve(pluginRoot, skill.path);
  if (!inside(pluginRoot, resolvedPath)) {
    issues.push(`skill path escapes plugin root: ${skill.path}`);
    return issues;
  }

  if (!(await pathExists(resolvedPath))) {
    issues.push(
      `skill path does not exist: ${path.relative(root, resolvedPath)}`,
    );
  }

  return issues;
}

async function validateSkillFrontmatter(root, skillPath) {
  const issues = [];
  const skillFile = path.join(skillPath, 'SKILL.md');

  if (!(await pathExists(skillFile))) {
    return [`missing SKILL.md: ${path.relative(root, skillFile)}`];
  }

  let parsed;
  try {
    parsed = parseFrontmatter(
      await readFile(skillFile, 'utf8'),
      path.relative(root, skillFile),
    );
  } catch (error) {
    return [error.message];
  }

  for (const field of REQUIRED_SKILL_FIELDS) {
    if (!parsed[field]) {
      issues.push(
        `${path.relative(root, skillFile)} missing frontmatter field: ${field}`,
      );
    }
  }

  if (parsed.name && parsed.name !== path.basename(skillPath)) {
    issues.push(`${path.relative(root, skillFile)} name does not match folder`);
  }

  if (!isValidSemver(parsed.metadata?.version)) {
    issues.push(
      `${path.relative(root, skillFile)} metadata.version must be valid semver`,
    );
  }

  return issues;
}

async function validateDiscoveredSkillDirectories(root) {
  const issues = [];

  for (const skillPath of await discoverSkillDirectories(root)) {
    issues.push(...(await validateSkillFrontmatter(root, skillPath)));
  }

  return issues;
}

export async function validateMarketplaceSource(root, entry) {
  const issues = [];
  const sourcePath =
    typeof entry?.source === 'string' ? entry.source : entry?.source?.path;

  if (!sourcePath) {
    return [
      `marketplace entry ${entry?.name ?? '<unknown>'} missing source.path`,
    ];
  }

  if (sourcePath.includes('..')) {
    issues.push(
      `marketplace source path may not escape repo root: ${sourcePath}`,
    );
    return issues;
  }

  const resolvedPath = path.resolve(root, sourcePath);
  if (!inside(root, resolvedPath)) {
    issues.push(`marketplace source path escapes repo root: ${sourcePath}`);
    return issues;
  }

  if (!(await pathExists(resolvedPath))) {
    issues.push(`marketplace source path does not exist: ${sourcePath}`);
  }

  return issues;
}

export async function validateReadmeInstallMatrix(root) {
  const readmePath = path.join(root, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const issues = [];

  if (!/^## Local Git Repository Install$/m.test(readme)) {
    issues.push('README.md missing Local Git Repository Install section');
  }

  return issues;
}

export async function validateSessionObserverWatchDocs(root) {
  const issues = [];
  const canonicalSkillPath = path.join(
    root,
    'skills/session-observer/SKILL.md',
  );
  if (!(await pathExists(canonicalSkillPath))) {
    return issues;
  }

  const docPaths = [
    'skills/session-observer/SKILL.md',
    'skills/session-observer/references/watch-design.md',
    '.agents/skills/session-observer/SKILL.md',
    '.agents/skills/session-observer/references/watch-design.md',
  ];

  for (const relativePath of docPaths) {
    const docPath = path.join(root, relativePath);
    if (!(await pathExists(docPath))) {
      issues.push(
        `${relativePath} missing session-observer watch documentation`,
      );
      continue;
    }

    const content = await readFile(docPath, 'utf8');
    if (
      /\bnot implemented\b/iu.test(content) ||
      /\bdesign-only\b/iu.test(content)
    ) {
      issues.push(
        `${relativePath} contains stale watch-mode implementation status`,
      );
    }

    for (const token of ['watch', 'watch-ctl', '--watch']) {
      if (!content.includes(token)) {
        issues.push(
          `${relativePath} missing watch command surface token: ${token}`,
        );
      }
    }
  }

  return issues;
}

export async function validateVersionConsistency(root) {
  const versions = new Map();
  const issues = [];

  for (const relativePath of PROVIDER_MANIFESTS) {
    const manifest = await parseJsonFile(path.join(root, relativePath));
    versions.set(relativePath, manifest.version);
    if (!isValidSemver(manifest.version)) {
      issues.push(`${relativePath} version must be valid semver`);
    }
  }

  const uniqueVersions = new Set(versions.values());
  if (uniqueVersions.size > 1) {
    issues.push(
      `plugin manifest versions differ: ${[...versions.entries()]
        .map(([relativePath, version]) => `${relativePath}=${version}`)
        .join(', ')}`,
    );
  }

  return issues;
}

async function validateProviderManifest(root, relativePath) {
  const issues = [];
  const manifestPath = path.join(root, relativePath);
  const pluginRoot = path.resolve(path.dirname(manifestPath), '..');
  const manifest = await parseJsonFile(manifestPath);
  const provider = relativePath.match(/\.([^.\/]+)-plugin/u)?.[1];

  if (manifest.name !== 'consensus') {
    issues.push(`${relativePath} name should be consensus`);
  }

  if (!isValidSemver(manifest.version)) {
    issues.push('version must be valid semver');
  }

  if (provider === 'codex') {
    if (manifest.skills !== './skills/') {
      issues.push(`${relativePath} skills should be ./skills/`);
    }
  } else {
    if (manifest.skills !== undefined) {
      issues.push(
        `${relativePath} should rely on skills/ directory discovery, not manifest.skills`,
      );
    }
  }

  const requiredSkillPath = path.join(pluginRoot, 'skills/refine');
  if (!(await pathExists(requiredSkillPath))) {
    issues.push(`${relativePath} missing skills/refine directory`);
  } else {
    issues.push(...(await validateSkillFrontmatter(root, requiredSkillPath)));
  }

  if (Array.isArray(manifest.skills)) {
    for (const skill of manifest.skills) {
      issues.push(...(await validateSkillReference(root, skill, pluginRoot)));
      const skillPath = path.resolve(pluginRoot, skill.path);
      issues.push(...(await validateSkillFrontmatter(root, skillPath)));
    }
  }

  return issues.map((issue) => `${relativePath}: ${issue}`);
}

async function validateMarketplaceManifest(root, relativePath) {
  const issues = [];
  const manifest = await parseJsonFile(path.join(root, relativePath));

  if (!Array.isArray(manifest.plugins)) {
    return [`${relativePath}: missing plugins array`];
  }

  const consensus = manifest.plugins.find(
    (plugin) => plugin.name === 'consensus',
  );
  if (!consensus) {
    return [`${relativePath}: missing consensus plugin entry`];
  }

  issues.push(...(await validateMarketplaceSource(root, consensus)));
  const sourcePath =
    typeof consensus.source === 'string'
      ? consensus.source
      : consensus.source?.path;
  if (sourcePath !== './plugins/consensus') {
    issues.push(
      `${relativePath}: consensus source.path should be ./plugins/consensus`,
    );
  }

  return issues.map((issue) =>
    issue.startsWith(relativePath) ? issue : `${relativePath}: ${issue}`,
  );
}

async function validateDocs(root) {
  const issues = [];
  const docs = [
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'RELEASING.md',
  ];

  for (const doc of docs) {
    if (!(await pathExists(path.join(root, doc)))) {
      issues.push(`missing ${doc}`);
    }
  }

  const claudePath = path.join(root, 'CLAUDE.md');
  const claude = await lstat(claudePath);
  if (!claude.isSymbolicLink()) {
    issues.push('CLAUDE.md should be a symlink to AGENTS.md');
  }

  issues.push(...(await validateReadmeInstallMatrix(root)));
  issues.push(...(await validateSessionObserverWatchDocs(root)));
  return issues;
}

async function validateDirectoryLayout(root) {
  const issues = [];
  const directories = [
    'skills',
    'plugins/consensus/skills/refine',
    'plugins/consensus/agents',
    'plugins/consensus/.claude-plugin',
    'plugins/consensus/.cursor-plugin',
    'plugins/consensus/.codex-plugin',
  ];

  for (const directory of directories) {
    const details = await stat(path.join(root, directory)).catch(() => null);
    if (!details?.isDirectory()) {
      issues.push(`missing directory ${directory}`);
    }
  }

  return issues;
}

export async function validateRepository(options = {}) {
  const root = path.resolve(options.root ?? DEFAULT_ROOT);
  const errors = [];

  errors.push(...(await validateDirectoryLayout(root)));
  errors.push(...(await validateDocs(root)));
  errors.push(...(await validateVersionConsistency(root)));
  errors.push(...(await validateDiscoveredSkillDirectories(root)));

  for (const manifest of PROVIDER_MANIFESTS) {
    errors.push(...(await validateProviderManifest(root, manifest)));
  }

  for (const marketplace of MARKETPLACE_MANIFESTS) {
    errors.push(...(await validateMarketplaceManifest(root, marketplace)));
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

async function main() {
  const result = await validateRepository({ root: DEFAULT_ROOT });

  if (result.ok) {
    console.log('validation passed');
    return;
  }

  for (const error of result.errors.sort()) {
    console.error(`validation error: ${error}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`validation error: ${error.message}`);
    process.exitCode = 1;
  });
}
