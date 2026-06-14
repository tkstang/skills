import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSections,
  slugSectionId,
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

test('slugSectionId creates deterministic stable IDs', () => {
  assert.equal(slugSectionId('Intro & Scope', 0), 'intro-scope-0');
  assert.equal(slugSectionId('!!!', 2), 'section-2');
});

test('parseSections splits markdown by headings and preserves heading markdown', () => {
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

  assert.deepEqual(
    sections.map((section) => [
      section.id,
      section.name,
      section.original_index,
    ]),
    [
      ['intro-0', 'Intro', 0],
      ['details-1', 'Details', 1],
    ],
  );
  assert.equal(sections[0].markdown, '# Intro\n\nOpening copy.\n\n');
  assert.equal(sections[1].markdown, '## Details\n\n- one\n- two\n');
});

test('parseSections treats pre-heading content as a stable preamble section', () => {
  const sections = parseSections('Lead paragraph.\n\n# Body\n\nBody text.\n');

  assert.equal(sections.length, 2);
  assert.equal(sections[0].id, 'preamble-0');
  assert.equal(sections[0].name, 'Preamble');
  assert.equal(sections[0].markdown, 'Lead paragraph.\n\n');
  assert.equal(sections[1].markdown, '# Body\n\nBody text.\n');
});

test('explicit section markers override heading-based detection', () => {
  const markdown = [
    '<!-- section: first pass -->',
    '# Heading inside first',
    'Text A.',
    '<!-- section: second pass -->',
    'Text B.',
    '',
  ].join('\n');

  const sections = parseSections(markdown);

  assert.deepEqual(
    sections.map((section) => [
      section.id,
      section.name,
      section.original_index,
    ]),
    [
      ['first-pass-0', 'first pass', 0],
      ['second-pass-1', 'second pass', 1],
    ],
  );
  assert.equal(
    sections[0].markdown,
    '<!-- section: first pass -->\n# Heading inside first\nText A.\n',
  );
  assert.equal(
    sections[1].markdown,
    '<!-- section: second pass -->\nText B.\n',
  );
});

test('parseSections falls back to one section for documents without section boundaries', () => {
  const sections = parseSections('Just a short note.\n\nNo headings.\n');

  assert.deepEqual(
    sections.map((section) => [
      section.id,
      section.name,
      section.original_index,
    ]),
    [['document-0', 'Document', 0]],
  );
  assert.equal(sections[0].markdown, 'Just a short note.\n\nNo headings.\n');
});
