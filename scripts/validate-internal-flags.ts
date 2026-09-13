#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hasInternalFlag,
  listAgentSkillFiles,
} from './lib/skill-frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_SKILLS_DIR = path.join(REPO_ROOT, '.agents', 'skills');

/**
 * Check that every OAT tooling SKILL.md under `skillsDir` carries
 * `metadata.internal: true`. Symlinked standalone skills are skipped (they must
 * stay publicly discoverable). Returns the offenders that still lack the flag.
 *
 * @param {string} [skillsDir]
 * @returns {Promise<{ checked: number, offenders: string[] }>}
 */
export async function validateInternalFlags(
  skillsDir = DEFAULT_SKILLS_DIR,
): Promise<{ checked: number; offenders: string[] }> {
  const files = await listAgentSkillFiles(skillsDir);
  const offenders: string[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (!hasInternalFlag(content)) {
      offenders.push(file);
    }
  }
  return { checked: files.length, offenders };
}

function parseArgs(argv: string[]): { skillsDir: string } {
  const positional = argv.filter((token) => !token.startsWith('-'));
  return {
    skillsDir: positional[0] ? path.resolve(positional[0]) : DEFAULT_SKILLS_DIR,
  };
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  const { skillsDir } = parseArgs(argv);
  const { checked, offenders } = await validateInternalFlags(skillsDir);

  if (offenders.length > 0) {
    console.error(
      'internal-flag validation failed: the following .agents/skills SKILL.md file(s) are missing metadata.internal: true:',
    );
    for (const file of offenders) {
      console.error(`- ${path.relative(process.cwd(), file)}`);
    }
    console.error(
      '\nRe-stamp the flag after refreshing tooling: pnpm exec tsx scripts/apply-internal-flags.ts',
    );
    return 1;
  }

  console.log(
    `internal-flag validation: ${checked} .agents/skills SKILL.md file(s) carry metadata.internal: true`,
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
        `internal-flag validation error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 2;
    });
}
