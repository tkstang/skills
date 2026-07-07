import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = path.resolve(new URL('../../..', import.meta.url).pathname);

const loopUsingSkills = ['create', 'decide', 'evaluate', 'plan', 'refine'] as const;
const canonicalSkill = 'refine';

function schemasDir(skill: (typeof loopUsingSkills)[number]) {
  return path.join(repoRoot, 'plugins/consensus/skills', skill, 'schemas');
}

const schemaFiles = [
  'verdict-alternating.schema.json',
  'verdict-parallel.schema.json',
  'synthesis.schema.json',
] as const;

async function schemaNames(dir: string) {
  return (await readdir(dir))
    .filter((name) => name.endsWith('.schema.json'))
    .toSorted();
}

async function readSchema(dir: string, name: string) {
  return readFile(path.join(dir, name), 'utf8');
}

it('copies every loop-using skill schema from the canonical refine distribution schemas', async () => {
  const canonicalSchemasDir = schemasDir(canonicalSkill);
  expect(await schemaNames(canonicalSchemasDir)).toEqual(
    [...schemaFiles].toSorted(),
  );

  for (const skill of loopUsingSkills) {
    const skillSchemasDir = schemasDir(skill);
    expect(await schemaNames(skillSchemasDir)).toEqual(
      [...schemaFiles].toSorted(),
    );

    for (const schemaFile of schemaFiles) {
      await expect(readSchema(skillSchemasDir, schemaFile)).resolves.toBe(
        await readSchema(canonicalSchemasDir, schemaFile),
      );
    }
  }
});
