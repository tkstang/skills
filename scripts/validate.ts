import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginReleaseTargets } from '../src/distributions.js';
import { isStableSemver, isValidSemver } from './bump-version.js';
import { discoverSkillDirectories } from './lib/discover-skills.js';

const DEFAULT_ROOT = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);
const PROVIDER_MANIFESTS = pluginReleaseTargets.flatMap(
  (target) => target.providerManifests,
);
const MARKETPLACE_MANIFESTS = [
  ...new Set(
    pluginReleaseTargets.flatMap((target) => target.marketplaceManifests),
  ),
];
const REQUIRED_SKILL_FIELDS = [
  'name',
  'description',
  'license',
  'compatibility',
];
const COLLABORATION_SKILL_PATH = 'skills/session-observer-collab';
const GUIDANCE_SKILL_PATH = 'skills/coding-session-handoff';
const COLLABORATION_REQUIRED_FILES = [
  'SKILL.md',
  'references/runtime-claude-code.md',
  'references/runtime-codex.md',
  'references/runtime-cursor.md',
  'scripts/collab-control.mjs',
  'scripts/codex-lifecycle.mjs',
  'scripts/hooks/codex-stop.mjs',
  'scripts/hooks/cursor-stop.mjs',
];

type FrontmatterValue = string | Record<string, string>;
interface ParsedFrontmatter {
  [key: string]: FrontmatterValue | undefined;
  name?: string;
  version?: string;
  metadata?: Record<string, string>;
}

interface SkillReference {
  name?: string;
  path?: string;
}

interface MarketplaceEntry {
  name?: string;
  source?: string | { path?: string };
  version?: string;
}

type JsonObject = Record<string, unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

// Re-exported for existing consumers (e.g. scripts/validate-skill-versions.ts)
// that import skill discovery from this module.
export { discoverSkillDirectories };

export function parseFrontmatter(
  markdown: string,
  source = 'markdown',
): ParsedFrontmatter {
  const match = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    throw new Error(`${source}: missing frontmatter block`);
  }

  const result: ParsedFrontmatter = {};
  let activeMap: string | null = null;

  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;

    const nested = line.match(/^  ([^:]+):\s*(.+)$/);
    if (nested && activeMap) {
      const map = result[activeMap];
      if (typeof map !== 'object') {
        throw new Error(`${source}: invalid nested frontmatter map`);
      }
      map[nested[1].trim()] = stripQuotes(nested[2]);
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

export async function parseJsonFile(filePath: string): Promise<JsonObject> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as JsonObject;
  } catch (error: unknown) {
    throw new Error(`${filePath}: ${errorMessage(error)}`, { cause: error });
  }
}

export async function validateSkillReference(
  root: string,
  skill: SkillReference,
  pluginRoot = root,
): Promise<string[]> {
  const issues: string[] = [];

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

function resolveEffectiveSkillVersion(
  parsed: ParsedFrontmatter,
  sourceLabel: string,
): string | null {
  const topLevel = parsed.version != null ? String(parsed.version) : null;
  const metaVersion =
    parsed.metadata?.version != null ? String(parsed.metadata.version) : null;

  if (topLevel) {
    return `${sourceLabel} top-level version is not allowed; use quoted metadata.version`;
  }

  if (!metaVersion || !isStableSemver(metaVersion)) {
    return `${sourceLabel} metadata.version must be quoted stable semver`;
  }

  return null;
}

async function validateSkillFrontmatter(
  root: string,
  skillPath: string,
): Promise<string[]> {
  const issues: string[] = [];
  const skillFile = path.join(skillPath, 'SKILL.md');

  if (!(await pathExists(skillFile))) {
    return [`missing SKILL.md: ${path.relative(root, skillFile)}`];
  }

  let parsed: ParsedFrontmatter;
  let markdown: string;
  try {
    markdown = await readFile(skillFile, 'utf8');
    parsed = parseFrontmatter(markdown, path.relative(root, skillFile));
  } catch (error: unknown) {
    return [errorMessage(error)];
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

  const versionIssue = resolveEffectiveSkillVersion(
    parsed,
    path.relative(root, skillFile),
  );
  if (versionIssue) {
    issues.push(versionIssue);
  }
  if (
    parsed.metadata?.version &&
    !/^metadata:\n(?:  .+\n)*?  version:\s*(["'])[^"'\n]+\1\s*$/mu.test(
      markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u)?.[1] ?? '',
    )
  ) {
    issues.push(
      `${path.relative(root, skillFile)} metadata.version must be quoted`,
    );
  }

  return issues;
}

async function validateDiscoveredSkillDirectories(
  root: string,
): Promise<string[]> {
  const issues: string[] = [];

  for (const skillPath of await discoverSkillDirectories(root)) {
    issues.push(...(await validateSkillFrontmatter(root, skillPath)));
  }

  return issues;
}

async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function validateCollaborationSkillDistribution(
  root: string,
): Promise<string[]> {
  const issues: string[] = [];
  const skillRoot = path.join(root, COLLABORATION_SKILL_PATH);
  if (!(await pathExists(skillRoot))) return issues;

  for (const relativePath of COLLABORATION_REQUIRED_FILES) {
    if (!(await pathExists(path.join(skillRoot, relativePath)))) {
      issues.push(
        `${COLLABORATION_SKILL_PATH} missing required distribution file: ${relativePath}`,
      );
    }
  }

  const skillFile = path.join(skillRoot, 'SKILL.md');
  if (await pathExists(skillFile)) {
    const parsed = parseFrontmatter(
      await readFile(skillFile, 'utf8'),
      `${COLLABORATION_SKILL_PATH}/SKILL.md`,
    );
    if (parsed.metadata?.internal === 'true') {
      issues.push(
        `${COLLABORATION_SKILL_PATH}/SKILL.md must remain a public standalone skill`,
      );
    }
  }

  const scriptsDirectory = path.join(skillRoot, 'scripts');
  if (!(await pathExists(scriptsDirectory))) return issues;

  for (const scriptPath of await listFilesRecursively(scriptsDirectory)) {
    if (path.extname(scriptPath) !== '.mjs') continue;
    const source = await readFile(scriptPath, 'utf8');
    const specifiers = [
      ...source.matchAll(
        /\b(?:import|export)\s+(?:[^'"\n;]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
      ),
      ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu),
      ...source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/gu),
    ];
    for (const match of specifiers) {
      const specifier = match[1];
      if (!specifier.startsWith('node:') && !specifier.startsWith('.')) {
        issues.push(
          `${path.relative(root, scriptPath)} imports non-builtin runtime dependency: ${specifier}`,
        );
      }
    }
  }

  return issues;
}

export async function validateGuidanceSkillDistribution(
  root: string,
): Promise<string[]> {
  const issues: string[] = [];
  const required = [
    'SKILL.md',
    'references/provider-guidance.md',
    'scripts/coding-session-handoff.mjs',
  ];
  for (const relativePath of required) {
    if (
      !(await pathExists(path.join(root, GUIDANCE_SKILL_PATH, relativePath)))
    ) {
      issues.push(
        `${GUIDANCE_SKILL_PATH} missing required distribution file: ${relativePath}`,
      );
    }
  }
  const skillFile = path.join(root, GUIDANCE_SKILL_PATH, 'SKILL.md');
  if (await pathExists(skillFile)) {
    const parsed = parseFrontmatter(
      await readFile(skillFile, 'utf8'),
      `${GUIDANCE_SKILL_PATH}/SKILL.md`,
    );
    if (parsed.metadata?.internal === 'true') {
      issues.push(
        `${GUIDANCE_SKILL_PATH}/SKILL.md must remain a public standalone skill`,
      );
    }
  }
  const bundleFile = path.join(
    root,
    GUIDANCE_SKILL_PATH,
    'scripts/coding-session-handoff.mjs',
  );
  if (await pathExists(bundleFile)) {
    const bundle = await readFile(bundleFile, 'utf8');
    for (const forbidden of [
      'behavior-verify',
      'executeHandoffPlan',
      'probeProvider',
    ]) {
      if (bundle.includes(forbidden)) {
        issues.push(
          `${GUIDANCE_SKILL_PATH} public bundle exposes old executor surface: ${forbidden}`,
        );
      }
    }
  }
  return issues;
}

export async function validateMarketplaceSource(
  root: string,
  entry: MarketplaceEntry,
): Promise<string[]> {
  const issues: string[] = [];
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

export async function validateReadmeInstallMatrix(
  root: string,
): Promise<string[]> {
  const readmePath = path.join(root, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const issues: string[] = [];

  if (!/^## Install$/m.test(readme)) {
    issues.push('README.md missing Install section');
  }

  // The README carries the three-provider install matrix: it is the tag-time
  // gate, re-verified against live provider CLIs at release, and the entry
  // point claims cross-provider support in its first sentence.
  const matrixCommands: Array<[string, RegExp]> = [
    [
      'Claude Code marketplace',
      /claude plugin marketplace add "\$PWD" --scope user/,
    ],
    [
      'Claude Code install',
      /claude plugin install consensus@skills --scope user/,
    ],
    ['Codex marketplace', /codex plugin marketplace add "\$PWD"/],
    ['Codex install', /codex plugin add consensus --marketplace skills/],
    [
      'Cursor plugin-dir',
      /cursor agent --plugin-dir "\$PWD\/plugins\/consensus"/,
    ],
  ];

  for (const [label, pattern] of matrixCommands) {
    if (!pattern.test(readme)) {
      issues.push(`README.md missing ${label} command`);
    }
  }

  // Prerequisites and caveats stay on the docs site, so the matrix must route
  // readers there rather than growing a second copy of that prose.
  if (!/user-guide\/installation\//.test(readme)) {
    issues.push('README.md missing link to the Installation docs page');
  }

  return issues;
}

export async function validateSessionObserverWatchDocs(
  root: string,
): Promise<string[]> {
  const issues: string[] = [];
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

export async function validateVersionConsistency(
  root: string,
): Promise<string[]> {
  const issues: string[] = [];

  for (const target of pluginReleaseTargets) {
    const versions = new Map<string, unknown>();
    for (const relativePath of target.providerManifests) {
      const manifest = await parseJsonFile(path.join(root, relativePath));
      versions.set(relativePath, manifest.version);
      if (!isValidSemver(manifest.version)) {
        issues.push(`${relativePath} version must be valid semver`);
      }
    }
    const uniqueVersions = new Set(versions.values());
    if (uniqueVersions.size > 1) {
      issues.push(
        `${target.name} plugin manifest versions differ: ${[
          ...versions.entries(),
        ]
          .map(([relativePath, version]) => `${relativePath}=${version}`)
          .join(', ')}`,
      );
    }
  }

  return issues;
}

async function validateProviderManifest(
  root: string,
  relativePath: string,
): Promise<string[]> {
  const issues: string[] = [];
  const manifestPath = path.join(root, relativePath);
  const pluginRoot = path.resolve(path.dirname(manifestPath), '..');
  const manifest = await parseJsonFile(manifestPath);
  const provider = relativePath.match(/\.([^./]+)-plugin/u)?.[1];

  const expectedName = relativePath.split('/')[1];
  if (manifest.name !== expectedName) {
    issues.push(`${relativePath} name should be ${expectedName}`);
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

  if (Array.isArray(manifest.skills)) {
    for (const skill of manifest.skills) {
      if (!skill || typeof skill !== 'object') continue;
      const reference = skill as SkillReference;
      issues.push(
        ...(await validateSkillReference(root, reference, pluginRoot)),
      );
      if (!reference.path) continue;
      const skillPath = path.resolve(pluginRoot, reference.path);
      issues.push(...(await validateSkillFrontmatter(root, skillPath)));
    }
  }

  return issues.map((issue) => `${relativePath}: ${issue}`);
}

async function validateMarketplaceManifest(
  root: string,
  relativePath: string,
): Promise<string[]> {
  const issues: string[] = [];
  const manifest = await parseJsonFile(path.join(root, relativePath));

  if (!Array.isArray(manifest.plugins)) {
    return [`${relativePath}: missing plugins array`];
  }

  for (const target of pluginReleaseTargets) {
    const entries = manifest.plugins.filter(
      (plugin): plugin is MarketplaceEntry =>
        Boolean(plugin) && typeof plugin === 'object',
    );
    const entry = entries.find((plugin) => plugin.name === target.name);
    if (!entry) {
      issues.push(`${relativePath}: missing ${target.name} plugin entry`);
      continue;
    }
    issues.push(...(await validateMarketplaceSource(root, entry)));
    const sourcePath =
      typeof entry.source === 'string' ? entry.source : entry.source?.path;
    if (sourcePath !== `./plugins/${target.name}`) {
      issues.push(
        `${relativePath}: ${target.name} source.path should be ./plugins/${target.name}`,
      );
    }
  }

  return issues.map((issue) =>
    issue.startsWith(relativePath) ? issue : `${relativePath}: ${issue}`,
  );
}

async function validateDocs(root: string): Promise<string[]> {
  const issues: string[] = [];
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

  // Every directory carrying an AGENTS.md must pair it with a CLAUDE.md
  // pointer stub (regular file containing exactly "@AGENTS.md" — symlinks
  // degrade under copy-based tooling). Directories absent from a checkout
  // (e.g. test fixture repos) are skipped via the AGENTS.md existence gate.
  const agentsDirs = [
    '.',
    'documentation',
    'plugins/consensus',
    'tests',
    '.oat/repo',
    '.oat/repo/pjm',
    '.oat/repo/reference',
  ];
  for (const dir of agentsDirs) {
    if (!(await pathExists(path.join(root, dir, 'AGENTS.md')))) continue;
    const claudePath = path.join(root, dir, 'CLAUDE.md');
    const label = path.normalize(path.join(dir, 'CLAUDE.md'));
    const claude = await lstat(claudePath).catch(() => null);
    if (!claude) {
      issues.push(`missing ${label} (@AGENTS.md pointer stub)`);
    } else if (claude.isSymbolicLink()) {
      issues.push(
        `${label} should be an @AGENTS.md pointer stub, not a symlink`,
      );
    } else if ((await readFile(claudePath, 'utf8')).trim() !== '@AGENTS.md') {
      issues.push(`${label} should contain exactly "@AGENTS.md"`);
    }
  }

  issues.push(...(await validateReadmeInstallMatrix(root)));
  issues.push(...(await validateSessionObserverWatchDocs(root)));
  return issues;
}

async function validateDirectoryLayout(root: string): Promise<string[]> {
  const issues: string[] = [];
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

export async function validateRepository(
  options: { root?: string } = {},
): Promise<{ ok: boolean; errors: string[] }> {
  const root = path.resolve(options.root ?? DEFAULT_ROOT);
  const errors: string[] = [];

  errors.push(...(await validateDirectoryLayout(root)));
  errors.push(...(await validateDocs(root)));
  errors.push(...(await validateVersionConsistency(root)));
  errors.push(...(await validateDiscoveredSkillDirectories(root)));
  errors.push(...(await validateCollaborationSkillDistribution(root)));
  errors.push(...(await validateGuidanceSkillDistribution(root)));

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

  for (const error of result.errors.toSorted()) {
    console.error(`validation error: ${error}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`validation error: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
