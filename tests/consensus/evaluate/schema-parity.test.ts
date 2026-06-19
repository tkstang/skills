import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = path.resolve(new URL('../../..', import.meta.url).pathname);
const refineSchemasDir = path.join(
  repoRoot,
  'plugins/consensus/skills/refine/schemas',
);
const evaluateSchemasDir = path.join(
  repoRoot,
  'plugins/consensus/skills/evaluate/schemas',
);

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

it('copies every evaluate schema from the canonical refine distribution schemas', async () => {
  expect(await schemaNames(refineSchemasDir)).toEqual(
    [...schemaFiles].toSorted(),
  );
  expect(await schemaNames(evaluateSchemasDir)).toEqual(
    [...schemaFiles].toSorted(),
  );

  for (const schemaFile of schemaFiles) {
    await expect(readSchema(evaluateSchemasDir, schemaFile)).resolves.toBe(
      await readSchema(refineSchemasDir, schemaFile),
    );
  }
});
