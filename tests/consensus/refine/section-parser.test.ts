import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { parseSections, slugSectionId } = consensusRefine;

type JsonRecord = Record<string, any>;

it('slugSectionId creates deterministic stable IDs', () => {
  expect(slugSectionId('Intro & Scope', 0)).toBe('intro-scope-0');
  expect(slugSectionId('!!!', 2)).toBe('section-2');
});

it('parseSections splits markdown by headings and preserves heading markdown', () => {
  const markdown = [
    '# Intro',
    '',
    'Opening copy.',
    '',
    '## Details',
    '',
    '- one',
    '- two',
    '',
  ].join('\n');

  const sections = parseSections(markdown);

  expect(
    sections.map((section: JsonRecord) => [
      section.id,
      section.name,
      section.original_index,
    ]),
  ).toEqual([
    ['intro-0', 'Intro', 0],
    ['details-1', 'Details', 1],
  ]);
  expect(sections[0].markdown).toBe('# Intro\n\nOpening copy.\n\n');
  expect(sections[1].markdown).toBe('## Details\n\n- one\n- two\n');
});

it('parseSections treats pre-heading content as a stable preamble section', () => {
  const sections = parseSections('Lead paragraph.\n\n# Body\n\nBody text.\n');

  expect(sections.length).toBe(2);
  expect(sections[0].id).toBe('preamble-0');
  expect(sections[0].name).toBe('Preamble');
  expect(sections[0].markdown).toBe('Lead paragraph.\n\n');
  expect(sections[1].markdown).toBe('# Body\n\nBody text.\n');
});

it('explicit section markers override heading-based detection', () => {
  const markdown = [
    '<!-- section: first pass -->',
    '# Heading inside first',
    'Text A.',
    '<!-- section: second pass -->',
    'Text B.',
    '',
  ].join('\n');

  const sections = parseSections(markdown);

  expect(
    sections.map((section: JsonRecord) => [
      section.id,
      section.name,
      section.original_index,
    ]),
  ).toEqual([
    ['first-pass-0', 'first pass', 0],
    ['second-pass-1', 'second pass', 1],
  ]);
  expect(sections[0].markdown).toBe(
    '<!-- section: first pass -->\n# Heading inside first\nText A.\n',
  );
  expect(sections[1].markdown).toBe('<!-- section: second pass -->\nText B.\n');
});

it('parseSections falls back to one section for documents without section boundaries', () => {
  const sections = parseSections('Just a short note.\n\nNo headings.\n');

  expect(
    sections.map((section: JsonRecord) => [
      section.id,
      section.name,
      section.original_index,
    ]),
  ).toEqual([['document-0', 'Document', 0]]);
  expect(sections[0].markdown).toBe('Just a short note.\n\nNo headings.\n');
});
