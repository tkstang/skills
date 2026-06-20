#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { isValidSemver } from './bump-version.mjs';
import { discoverSkillDirectories, parseFrontmatter } from './validate.mjs';

const DEFAULT_ROOT = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);

const execFileAsync = promisify(execFileCallback);

/** Default git runner; returns stdout for `git <args>` executed at `root`. */
function defaultGitExecFile(root) {
  return async (args) => {
    const { stdout } = await execFileAsync('git', args, { cwd: root });
    return stdout;
  };
}

/** Convert an absolute path to a posix-style path relative to `root`. */
function toRelativePosix(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

/** Parse a semver string into `{ main: [major, minor, patch], pre: string[] }`. */
function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/u.exec(String(version));
  if (!match) {
    return null;
  }
  return {
    main: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.') : [],
  };
}

/** Compare two prerelease identifiers per SemVer precedence rules. */
function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }
  // Numeric identifiers always have lower precedence than alphanumeric ones.
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Compare two prerelease identifier lists per SemVer precedence rules. */
function comparePrerelease(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = comparePrereleaseIdentifier(left[index], right[index]);
    if (diff !== 0) {
      return diff;
    }
  }
  // A larger set of prerelease fields has higher precedence when all the
  // preceding identifiers are equal (1.0.0-alpha < 1.0.0-alpha.1).
  return left.length - right.length;
}

/**
 * Compare two semver strings following SemVer precedence, including prerelease
 * ordering. Returns >0 when left is greater, <0 when right is greater, 0 equal.
 */
function compareSemver(left, right) {
  const leftParsed = parseSemver(left);
  const rightParsed = parseSemver(right);
  // Both inputs are gated by isValidSemver before this runs; bail out neutrally
  // if an unexpected value slips through rather than emitting a NaN comparison.
  if (!leftParsed || !rightParsed) {
    return 0;
  }

  for (let index = 0; index < 3; index += 1) {
    const diff = leftParsed.main[index] - rightParsed.main[index];
    if (diff !== 0) {
      return diff;
    }
  }

  const leftHasPre = leftParsed.pre.length > 0;
  const rightHasPre = rightParsed.pre.length > 0;
  if (!leftHasPre && !rightHasPre) return 0;
  // A version with a prerelease has lower precedence than the same without one
  // (1.0.0-alpha < 1.0.0).
  if (!leftHasPre) return 1;
  if (!rightHasPre) return -1;
  return comparePrerelease(leftParsed.pre, rightParsed.pre);
}

/** Effective version = top-level `version` ?? `metadata.version`, or null. */
function effectiveVersion(parsed) {
  const topLevel = parsed.version != null ? String(parsed.version) : null;
  const metaVersion =
    parsed.metadata?.version != null ? String(parsed.metadata.version) : null;
  return topLevel ?? metaVersion;
}

/**
 * Validate that every canonical skill whose directory changed (relative to
 * `baseRef`) bumped its SKILL.md version.
 *
 * @param {string} root repository root
 * @param {{ baseRef: string, gitExecFile?: (args: string[]) => Promise<string> }} options
 * @returns {Promise<{ checkedSkillCount: number, findings: Array<{ skill: string, message: string }> }>}
 */
export async function validateChangedSkillVersions(root, options) {
  const { baseRef } = options;
  if (!baseRef) {
    throw new Error('validateChangedSkillVersions requires a baseRef');
  }
  const git = options.gitExecFile ?? defaultGitExecFile(root);
  const findings = [];

  // Include deletions (D): removing a script/reference/generated file under a
  // skill directory is a change that must still require a SKILL.md version bump.
  const diffOutput = await git([
    'diff',
    '--name-only',
    '--diff-filter=ACMRD',
    `${baseRef}...HEAD`,
    '--',
  ]);
  const changedFiles = diffOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(path.sep).join('/'));

  const skillDirectories = await discoverSkillDirectories(root);
  let checkedSkillCount = 0;

  for (const absoluteSkillDir of skillDirectories) {
    const relativeSkillDir = toRelativePosix(root, absoluteSkillDir);
    const skillName = path.basename(absoluteSkillDir);
    const prefix = `${relativeSkillDir}/`;

    const skillChanged = changedFiles.some((file) => file.startsWith(prefix));
    if (!skillChanged) {
      continue;
    }

    const relativeSkillFile = `${relativeSkillDir}/SKILL.md`;

    let baseContent;
    try {
      baseContent = await git(['show', `${baseRef}:${relativeSkillFile}`]);
    } catch {
      // No base content means the skill is new at this ref; nothing to bump.
      continue;
    }

    checkedSkillCount += 1;

    let baseVersion;
    let currentVersion;
    try {
      baseVersion = effectiveVersion(
        parseFrontmatter(baseContent, `${relativeSkillFile}@${baseRef}`),
      );
      const currentContent = await readFile(
        path.join(absoluteSkillDir, 'SKILL.md'),
        'utf8',
      );
      currentVersion = effectiveVersion(
        parseFrontmatter(currentContent, relativeSkillFile),
      );
    } catch (error) {
      findings.push({ skill: skillName, message: error.message });
      continue;
    }

    if (!baseVersion || !currentVersion) {
      // Version consistency/validity is enforced by validate.mjs; skip here.
      continue;
    }

    if (currentVersion === baseVersion) {
      findings.push({
        skill: skillName,
        message: `Changed skill ${skillName} must bump SKILL.md version (still ${currentVersion}); something under ${relativeSkillDir}/ changed relative to ${baseRef}.`,
      });
      continue;
    }

    if (
      isValidSemver(baseVersion) &&
      isValidSemver(currentVersion) &&
      compareSemver(currentVersion, baseVersion) <= 0
    ) {
      findings.push({
        skill: skillName,
        message: `Changed skill ${skillName} version must increase relative to ${baseRef} (base ${baseVersion}, current ${currentVersion}).`,
      });
    }
  }

  return { checkedSkillCount, findings };
}

/** Resolve the first base ref that git can verify, or null if none. */
async function resolveDefaultBaseRef(root) {
  const git = defaultGitExecFile(root);
  const candidates = [process.env.BASE_REF, 'origin/main', 'main'].filter(
    Boolean,
  );

  for (const candidate of candidates) {
    try {
      await git(['rev-parse', '--verify', '--quiet', candidate]);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function parseCli(argv) {
  const parsed = { baseRef: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--base-ref') {
      index += 1;
      parsed.baseRef = argv[index];
    } else if (token.startsWith('--base-ref=')) {
      parsed.baseRef = token.slice('--base-ref='.length);
    } else if (token === '--json') {
      parsed.json = true;
    } else {
      throw new Error(`unexpected argument: ${token}`);
    }
  }
  return parsed;
}

async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseCli(argv);
  } catch (error) {
    console.error(`skill-version validation error: ${error.message}`);
    return 2;
  }

  const baseRef = parsed.baseRef ?? (await resolveDefaultBaseRef(DEFAULT_ROOT));
  if (!baseRef) {
    const message =
      'no base ref resolved (set --base-ref, BASE_REF, or fetch origin/main); skipping skill-version check';
    if (parsed.json) {
      console.log(JSON.stringify({ status: 'skipped', message }));
    } else {
      console.log(`skill-version validation: ${message}`);
    }
    return 0;
  }

  let result;
  try {
    result = await validateChangedSkillVersions(DEFAULT_ROOT, { baseRef });
  } catch (error) {
    if (parsed.json) {
      console.log(JSON.stringify({ status: 'error', message: error.message }));
    } else {
      console.error(`skill-version validation error: ${error.message}`);
    }
    return 2;
  }

  if (result.findings.length > 0) {
    if (parsed.json) {
      console.log(
        JSON.stringify({
          status: 'failed',
          baseRef,
          checkedSkillCount: result.checkedSkillCount,
          findings: result.findings,
        }),
      );
    } else {
      console.error('skill-version validation failed:');
      for (const finding of result.findings) {
        console.error(`- ${finding.skill}: ${finding.message}`);
      }
      console.error(
        `\nBump the skill's SKILL.md version (keep top-level version and metadata.version in sync), then re-run: node scripts/validate-skill-versions.mjs --base-ref ${baseRef}`,
      );
    }
    return 1;
  }

  if (parsed.json) {
    console.log(
      JSON.stringify({
        status: 'ok',
        baseRef,
        checkedSkillCount: result.checkedSkillCount,
        findings: [],
      }),
    );
  } else if (result.checkedSkillCount === 0) {
    console.log(
      `skill-version validation: no changed skills relative to ${baseRef}`,
    );
  } else {
    console.log(
      `skill-version validation: ${result.checkedSkillCount} changed skill(s) verified against ${baseRef}`,
    );
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`skill-version validation error: ${error.message}`);
      process.exitCode = 2;
    });
}
