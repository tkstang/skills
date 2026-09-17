#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { distributions, pluginReleaseTargets } from '../src/distributions.js';
import { isStableSemver, isValidSemver } from './bump-version.js';
import { discoverSkillDirectories } from './lib/discover-skills.js';
import type { DistributionDeclaration } from './lib/packaging.js';
import { parseFrontmatter } from './validate.js';

const DEFAULT_ROOT = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);
const execFileAsync = promisify(execFileCallback);

const GIT_ENV_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
];

type GitRunner = (args: string[]) => Promise<string>;

export interface VersionFinding {
  skill: string;
  message: string;
}

interface ParsedSkillFrontmatter {
  name?: unknown;
  version?: unknown;
  metadata?: { version?: unknown };
}

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of GIT_ENV_VARS) delete env[key];
  return env;
}

function defaultGitExecFile(root: string): GitRunner {
  return async (args) => {
    const { stdout } = await execFileAsync('git', args, {
      cwd: root,
      env: gitEnv(),
    });
    return stdout;
  };
}

function posix(value: string): string {
  return value.split(path.sep).join('/');
}

function toRelativePosix(root: string, target: string): string {
  return posix(path.relative(root, target));
}

interface ParsedSemver {
  main: [number, number, number];
  pre: string[];
}

function parseSemver(version: string): ParsedSemver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/u.exec(version);
  if (!match) return null;
  return {
    main: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.') : [],
  };
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function comparePrerelease(left: string[], right: string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = comparePrereleaseIdentifier(left[index], right[index]);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

function compareSemver(left: string, right: string): number {
  const leftParsed = parseSemver(left);
  const rightParsed = parseSemver(right);
  if (!leftParsed || !rightParsed) return 0;
  for (let index = 0; index < 3; index += 1) {
    const diff = leftParsed.main[index] - rightParsed.main[index];
    if (diff !== 0) return diff;
  }
  if (leftParsed.pre.length === 0 && rightParsed.pre.length === 0) return 0;
  if (leftParsed.pre.length === 0) return 1;
  if (rightParsed.pre.length === 0) return -1;
  return comparePrerelease(leftParsed.pre, rightParsed.pre);
}

function historicalVersions(parsed: ParsedSkillFrontmatter): string[] {
  return [parsed.version, parsed.metadata?.version]
    .filter((value): value is string => value != null)
    .map(String)
    .filter(isValidSemver);
}

function reconciledHistoricalVersion(
  parsed: ParsedSkillFrontmatter,
): string | null {
  return (
    historicalVersions(parsed).toSorted((left, right) =>
      compareSemver(right, left),
    )[0] ?? null
  );
}

function currentVersion(
  parsed: ParsedSkillFrontmatter,
  content: string,
  label: string,
): string {
  if (parsed.version != null) {
    throw new Error(
      `${label}: top-level version is not allowed; use quoted metadata.version`,
    );
  }
  const version =
    parsed.metadata?.version == null ? '' : String(parsed.metadata.version);
  if (!isStableSemver(version)) {
    throw new Error(`${label}: metadata.version must be stable semver`);
  }
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u)?.[1];
  if (
    !frontmatter ||
    !/^metadata:\n(?:  .+\n)*?  version:\s*(["'])[^"'\n]+\1\s*$/mu.test(
      frontmatter,
    )
  ) {
    throw new Error(`${label}: metadata.version must be quoted`);
  }
  return version;
}

async function changedFilesSince(
  git: GitRunner,
  baseRef: string,
): Promise<Set<string>> {
  // The explicit merge-base diff is authoritative for committed changes. The
  // remaining calls add local index, worktree and untracked edits so pre-push
  // use cannot silently miss a version-sensitive change.
  const outputs = await Promise.all([
    git([
      'diff',
      '--name-only',
      '--diff-filter=ACMRD',
      `${baseRef}...HEAD`,
      '--',
    ]),
    git(['diff', '--name-only', '--diff-filter=ACMRD', 'HEAD', '--']),
    git(['ls-files', '--others', '--exclude-standard']),
  ]);
  return new Set(
    outputs
      .flatMap((output) => output.split('\n'))
      .map((file) => posix(file.trim()))
      .filter(Boolean),
  );
}

function affectedOwners(
  changedFiles: Set<string>,
  declarations: readonly DistributionDeclaration[],
  legacyOwners: Readonly<Record<string, string>>,
): { owners: Set<string>; ownerlessOutputs: string[] } {
  const owners = new Set<string>();
  const outputs = new Map<string, string>();
  for (const declaration of declarations) {
    const sourceRoots = [
      declaration.source,
      ...(declaration.allowedSourceRoots ?? []),
    ];
    for (const file of changedFiles) {
      if (
        sourceRoots.some((root) => file === root || file.startsWith(`${root}/`))
      ) {
        owners.add(declaration.owner);
      }
    }
    for (const target of declaration.targets)
      outputs.set(target.output, declaration.owner);
  }

  const ownerlessOutputs: string[] = [];
  for (const file of changedFiles) {
    let matched = false;
    for (const [output, owner] of outputs) {
      if (file === output || file.startsWith(`${output}/`)) {
        owners.add(owner);
        matched = true;
      }
    }
    const pluginShared =
      /^plugins\/([^/]+)\/(?:scripts|agents|references)\//u.exec(file);
    if (pluginShared) {
      for (const declaration of declarations) {
        if (
          declaration.targets.some(
            (target) =>
              target.kind === 'plugin' && target.plugin === pluginShared[1],
          )
        ) {
          owners.add(declaration.owner);
          matched = true;
        }
      }
    }
    if (
      !matched &&
      (/^skills\/[^/]+\//u.test(file) ||
        /^plugins\/[^/]+\/skills\/[^/]+\//u.test(file))
    ) {
      const oldName = file.startsWith('skills/')
        ? file.split('/')[1]
        : file.split('/')[3];
      const renamedOwner = legacyOwners[oldName];
      if (renamedOwner) owners.add(renamedOwner);
      else ownerlessOutputs.push(file);
    }
  }
  return { owners, ownerlessOutputs: ownerlessOutputs.toSorted() };
}

async function baselineCandidates(
  git: GitRunner,
  baseRef: string,
  owner: string,
  legacyOwners: Readonly<Record<string, string>>,
): Promise<Array<{ path: string; content: string }>> {
  const tree = await git(['ls-tree', '-r', '--name-only', baseRef, '--']);
  const skillFiles = tree
    .split('\n')
    .map((file) => posix(file.trim()))
    .filter((file) => file.endsWith('/SKILL.md'));
  const candidates: Array<{ path: string; content: string }> = [];
  for (const skillFile of skillFiles) {
    const content = await git(['show', `${baseRef}:${skillFile}`]);
    let parsed: ParsedSkillFrontmatter;
    try {
      parsed = parseFrontmatter(
        content,
        `${skillFile}@${baseRef}`,
      ) as ParsedSkillFrontmatter;
    } catch {
      continue;
    }
    const historicalName = String(
      parsed.name ?? path.basename(path.dirname(skillFile)),
    );
    const historicalOwner = legacyOwners[historicalName] ?? historicalName;
    if (historicalOwner === owner)
      candidates.push({ path: skillFile, content });
  }
  return candidates;
}

const CHANGELOG_FILE = 'CHANGELOG.md';
const UNRELEASED_HEADING = /^##\s+\[Unreleased\]\s*$/u;

/** Lines inside `## [Unreleased]`, up to the next `## ` heading. */
function unreleasedSection(changelog: string): string[] {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => UNRELEASED_HEADING.test(line));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/u.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Content lines present in `next` beyond what `base` already had, ignoring
 * blank lines and `###` group headings so a bare `### Added` is not an entry.
 */
function addedUnreleasedLines(base: string, next: string): string[] {
  const remaining = new Map<string, number>();
  for (const line of unreleasedSection(base)) {
    const key = line.trim();
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const added: string[] = [];
  for (const line of unreleasedSection(next)) {
    const key = line.trim();
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
      continue;
    }
    if (key !== '' && !key.startsWith('#')) added.push(key);
  }
  return added;
}

/**
 * Versioned release headings (`## [x.y.z] - date`) present in `next` but not
 * in `base`. A release moves the Unreleased entries under a new heading, which
 * leaves `## [Unreleased]` empty by design.
 */
function addedReleaseHeadings(base: string, next: string): string[] {
  const headings = (changelog: string): Set<string> =>
    new Set(
      changelog
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            /^##\s+\[[^\]]+\]/u.test(line) && !UNRELEASED_HEADING.test(line),
        ),
    );
  const known = headings(base);
  return [...headings(next)].filter((heading) => !known.has(heading));
}

async function showAtBase(
  runner: GitRunner,
  baseRef: string,
  file: string,
): Promise<string | null> {
  try {
    return await runner(['show', `${baseRef}:${file}`]);
  } catch {
    return null;
  }
}

function manifestVersion(contents: string): string | null {
  try {
    const parsed: unknown = JSON.parse(contents);
    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      const version = (parsed as { version?: unknown }).version;
      return version == null ? null : String(version);
    }
  } catch {
    // Manifest structure is validated by scripts/validate.ts.
  }
  return null;
}

/** Plugin release targets whose provider-manifest version moved off the base. */
async function bumpedPluginReleases(
  root: string,
  runner: GitRunner,
  baseRef: string,
): Promise<string[]> {
  const bumped: string[] = [];
  for (const target of pluginReleaseTargets) {
    for (const manifest of target.providerManifests) {
      const current = await readFile(path.join(root, manifest), 'utf8').catch(
        () => null,
      );
      if (current === null) continue;
      const currentValue = manifestVersion(current);
      if (currentValue === null) continue;
      const base = await showAtBase(runner, baseRef, manifest);
      if (base === null || manifestVersion(base) !== currentValue) {
        bumped.push(target.name);
        break;
      }
    }
  }
  return [...new Set(bumped)].toSorted();
}

export async function validateChangedSkillVersions(
  root: string,
  options: {
    baseRef?: string;
    gitExecFile?: GitRunner;
    declarations?: readonly DistributionDeclaration[];
    legacyOwners?: Readonly<Record<string, string>>;
  },
): Promise<{
  checkedSkillCount: number;
  findings: VersionFinding[];
  newOwners: string[];
  removedOwners: string[];
  bumpedSkills: string[];
  bumpedPlugins: string[];
}> {
  const { baseRef } = options;
  if (!baseRef)
    throw new Error('validateChangedSkillVersions requires a baseRef');
  const git = options.gitExecFile ?? defaultGitExecFile(root);
  // Fail closed when the caller supplies an unresolved or shallow base.
  await git(['rev-parse', '--verify', `${baseRef}^{commit}`]);

  const declarations = options.declarations ?? distributions;
  // No repository-wide rename map: every merged rename is already on the base
  // ref. Callers may still inject one for an explicitly older base.
  const legacyOwners: Readonly<Record<string, string>> =
    options.legacyOwners ?? {};
  const changedFiles = await changedFilesSince(git, baseRef);
  const impact = affectedOwners(changedFiles, declarations, legacyOwners);
  const findings: VersionFinding[] = impact.ownerlessOutputs.map((file) => ({
    skill: '<ownerless>',
    message: `Changed generated skill output has no declared owner: ${file}`,
  }));

  const skillDirectories = await discoverSkillDirectories(root);
  const currentOwners = new Map(
    skillDirectories.map((directory) => [path.basename(directory), directory]),
  );
  // Direct canonical changes remain guarded even before a declaration is added.
  for (const directory of skillDirectories) {
    const relative = toRelativePosix(root, directory);
    if ([...changedFiles].some((file) => file.startsWith(`${relative}/`))) {
      impact.owners.add(path.basename(directory));
    }
  }

  let checkedSkillCount = 0;
  const newOwners: string[] = [];
  const bumpedSkills: string[] = [];
  for (const owner of [...impact.owners].toSorted()) {
    const directory = currentOwners.get(owner);
    if (!directory) continue;
    const relativeSkillFile = `${toRelativePosix(root, directory)}/SKILL.md`;
    const candidates = await baselineCandidates(
      git,
      baseRef,
      owner,
      legacyOwners,
    );
    if (candidates.length === 0) {
      newOwners.push(owner);
      continue;
    }
    checkedSkillCount += 1;

    try {
      const baseVersions = candidates
        .map(({ path: baselinePath, content }) => {
          const parsed = parseFrontmatter(
            content,
            `${baselinePath}@${baseRef}`,
          ) as ParsedSkillFrontmatter;
          return reconciledHistoricalVersion(parsed);
        })
        .filter((version): version is string => version !== null);
      if (baseVersions.length === 0) {
        throw new Error(`${owner}@${baseRef}: no valid historical version`);
      }
      const baseVersion = baseVersions.toSorted((left, right) =>
        compareSemver(right, left),
      )[0];
      const currentContent = await readFile(
        path.join(directory, 'SKILL.md'),
        'utf8',
      );
      const nextVersion = currentVersion(
        parseFrontmatter(
          currentContent,
          relativeSkillFile,
        ) as ParsedSkillFrontmatter,
        currentContent,
        relativeSkillFile,
      );
      if (compareSemver(nextVersion, baseVersion) > 0) bumpedSkills.push(owner);
      if (compareSemver(nextVersion, baseVersion) <= 0) {
        findings.push({
          skill: owner,
          message:
            nextVersion === baseVersion
              ? `Changed skill ${owner} must bump SKILL.md version (still ${nextVersion}); its authored or generated runtime closure changed relative to ${baseRef}.`
              : `Changed skill ${owner} version must increase relative to ${baseRef} (base ${baseVersion}, current ${nextVersion}).`,
        });
      }
    } catch (error: unknown) {
      findings.push({
        skill: owner,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const currentOwnerNames = new Set(currentOwners.keys());
  const baseTree = await git(['ls-tree', '-r', '--name-only', baseRef, '--']);
  const removedOwners = new Set<string>();
  for (const skillFile of baseTree
    .split('\n')
    .filter(
      (file) =>
        /^src\/skills\/[^/]+\/SKILL\.md$/u.test(file) ||
        /^skills\/[^/]+\/SKILL\.md$/u.test(file) ||
        /^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/u.test(file),
    )) {
    try {
      const parsed = parseFrontmatter(
        await git(['show', `${baseRef}:${skillFile}`]),
        `${skillFile}@${baseRef}`,
      ) as ParsedSkillFrontmatter;
      const name = String(
        parsed.name ?? path.basename(path.dirname(skillFile)),
      );
      const owner = legacyOwners[name] ?? name;
      if (!currentOwnerNames.has(owner)) removedOwners.add(owner);
    } catch {
      // Structural validation owns malformed historical files.
    }
  }

  // A released version change only reaches users through the changelog, so the
  // entry is required in the same change that moves the version.
  const bumpedPlugins = await bumpedPluginReleases(root, git, baseRef);
  if (bumpedSkills.length > 0 || bumpedPlugins.length > 0) {
    const currentChangelog = await readFile(
      path.join(root, CHANGELOG_FILE),
      'utf8',
    ).catch(() => null);
    const baseChangelog =
      (await showAtBase(git, baseRef, CHANGELOG_FILE)) ?? '';
    const added =
      currentChangelog === null
        ? []
        : [
            ...addedUnreleasedLines(baseChangelog, currentChangelog),
            ...addedReleaseHeadings(baseChangelog, currentChangelog),
          ];
    if (added.length === 0) {
      const bumped = [
        ...bumpedSkills.toSorted().map((skill) => `skill ${skill}`),
        ...bumpedPlugins.map((plugin) => `plugin ${plugin}`),
      ].join(', ');
      findings.push({
        skill: '<changelog>',
        message: `${bumped} changed version against ${baseRef} with no new changelog entry: add an entry under ## [Unreleased] in CHANGELOG.md (Added/Changed/Fixed/Removed) naming the affected skills and versions, or add the release heading that the Unreleased entries moved under.`,
      });
    }
  }

  return {
    checkedSkillCount,
    findings,
    newOwners: newOwners.toSorted(),
    removedOwners: [...removedOwners].toSorted(),
    bumpedSkills: bumpedSkills.toSorted(),
    bumpedPlugins,
  };
}

async function resolveDefaultBaseRef(root: string): Promise<string | null> {
  const git = defaultGitExecFile(root);
  const candidates = [process.env.BASE_REF, 'origin/main', 'main'].filter(
    (value): value is string => Boolean(value),
  );
  for (const candidate of candidates) {
    try {
      await git(['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`]);
      return candidate;
    } catch {
      // Try the next explicit candidate.
    }
  }
  return null;
}

function parseCli(argv: string[]): { baseRef: string | null; json: boolean } {
  const parsed: { baseRef: string | null; json: boolean } = {
    baseRef: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') continue;
    if (token === '--base-ref') parsed.baseRef = argv[++index] ?? null;
    else if (token.startsWith('--base-ref=')) {
      parsed.baseRef = token.slice('--base-ref='.length);
    } else if (token === '--json') parsed.json = true;
    else throw new Error(`unexpected argument: ${token}`);
  }
  return parsed;
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  let parsed;
  try {
    parsed = parseCli(argv);
  } catch (error: unknown) {
    console.error(
      `skill-version validation error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  const baseRef = parsed.baseRef ?? (await resolveDefaultBaseRef(DEFAULT_ROOT));
  if (!baseRef) {
    const message =
      'no base ref resolved (set --base-ref, BASE_REF, or fetch origin/main)';
    if (parsed.json) console.log(JSON.stringify({ status: 'error', message }));
    else console.error(`skill-version validation error: ${message}`);
    return 2;
  }
  try {
    const result = await validateChangedSkillVersions(DEFAULT_ROOT, {
      baseRef,
    });
    if (result.findings.length > 0) {
      if (parsed.json) {
        console.log(JSON.stringify({ status: 'failed', baseRef, ...result }));
      } else {
        console.error('skill-version validation failed:');
        for (const finding of result.findings) {
          console.error(`- ${finding.skill}: ${finding.message}`);
        }
      }
      return 1;
    }
    if (parsed.json) {
      console.log(JSON.stringify({ status: 'ok', baseRef, ...result }));
    } else {
      console.log(
        `skill-version validation: ${result.checkedSkillCount} changed skill(s) verified against ${baseRef}`,
      );
    }
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (parsed.json) console.log(JSON.stringify({ status: 'error', message }));
    else console.error(`skill-version validation error: ${message}`);
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
