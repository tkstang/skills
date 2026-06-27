#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  addInternalFlag,
  listAgentSkillFiles,
} from './lib/skill-frontmatter.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_SKILLS_DIR = path.join(REPO_ROOT, '.agents', 'skills');

/**
 * Stamp `metadata.internal: true` onto every OAT tooling SKILL.md under
 * `skillsDir` that lacks it. Idempotent and symlink-aware (canonical standalone
 * skills symlinked into the mirror are skipped).
 *
 * @param {string} [skillsDir]
 * @returns {Promise<{ checked: number, changed: string[] }>}
 */
export async function applyInternalFlags(skillsDir = DEFAULT_SKILLS_DIR) {
  const files = await listAgentSkillFiles(skillsDir);
  const changed = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const result = addInternalFlag(content);
    if (result.changed) {
      await writeFile(file, result.content);
      changed.push(file);
    }
  }
  return { checked: files.length, changed };
}

function parseArgs(argv) {
  const positional = argv.filter((token) => !token.startsWith('-'));
  return {
    skillsDir: positional[0] ? path.resolve(positional[0]) : DEFAULT_SKILLS_DIR,
  };
}

async function main(argv = process.argv.slice(2)) {
  const { skillsDir } = parseArgs(argv);
  const { checked, changed } = await applyInternalFlags(skillsDir);
  if (changed.length === 0) {
    console.log(
      `apply-internal-flags: ${checked} skill(s) checked; all already carry metadata.internal: true`,
    );
  } else {
    console.log(
      `apply-internal-flags: flagged ${changed.length} of ${checked} skill(s):`,
    );
    for (const file of changed) {
      console.log(`  + ${path.relative(process.cwd(), file)}`);
    }
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`apply-internal-flags error: ${error.message}`);
      process.exitCode = 2;
    });
}
