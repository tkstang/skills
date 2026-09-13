import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  RUBRIC_CRITERIA_CAP,
  parseRubricCriteria,
} from '../../../src/consensus/evaluate/consensus-evaluate.js';

const examplesDir = path.resolve(
  new URL(
    '../../../plugins/consensus/skills/evaluate/references/examples',
    import.meta.url,
  ).pathname,
);

// The evaluate wrapper parses `##`–`######` headings and `-`/`*` bullets, dedupes,
// and silently keeps only the first RUBRIC_CRITERIA_CAP criteria. The bundled
// example rubrics were authored to stay at or below that cap so nothing is
// truncated. This guard runs the canonical parser over each example and fails if
// one ever exceeds the cap, naming the offending files and counts.
it('keeps every bundled evaluate example rubric within the parser-visible criteria cap', async () => {
  const files = (await readdir(examplesDir))
    .filter((name) => name.endsWith('.md'))
    .toSorted();

  expect(
    files.length,
    `expected bundled example rubrics under ${examplesDir}`,
  ).toBeGreaterThan(0);

  const counts = await Promise.all(
    files.map(async (file) => {
      const rubric = await readFile(path.join(examplesDir, file), 'utf8');
      return { file, count: parseRubricCriteria(rubric).length };
    }),
  );

  const offenders = counts.filter(({ count }) => count > RUBRIC_CRITERIA_CAP);

  expect(
    offenders,
    `bundled example rubrics exceed the ${RUBRIC_CRITERIA_CAP}-criteria parser cap ` +
      `(truncation would silently drop criteria): ` +
      offenders.map(({ file, count }) => `${file}=${count}`).join(', '),
  ).toEqual([]);
});
