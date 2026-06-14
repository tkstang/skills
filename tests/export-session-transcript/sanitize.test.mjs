/**
 * sanitize.test.mjs — Unit tests for the export-owned content sanitizer.
 *
 * For Claude Code, Codex, and Cursor fixtures, each hidden-payload class is
 * recorded as an ordinary user/assistant TEXT message. We run the fixture
 * through normalizeEntries (structural filter) → sanitizeEntries (content
 * filter) and assert every hidden payload is dropped while genuine messages
 * (including ones that merely mention these tokens mid-sentence) survive.
 *
 * This explicitly covers the Codex/Cursor path where normalizeEntries returns
 * injected text verbatim — sanitizeEntries is the privacy boundary.
 */

import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIMES_PATH = fileURLToPath(
  new URL(
    '../../skills/export-session-transcript/scripts/lib/runtimes.mjs',
    import.meta.url,
  ),
);
const SANITIZE_PATH = fileURLToPath(
  new URL(
    '../../skills/export-session-transcript/scripts/lib/sanitize.mjs',
    import.meta.url,
  ),
);

const { readRecords, normalizeEntries } = await import(RUNTIMES_PATH);
const { sanitizeEntries, HIDDEN_PAYLOAD_MATCHERS } = await import(
  SANITIZE_PATH
);

const FIXTURES = join(__dirname, 'fixtures');

/**
 * Read a fixture, normalize structurally, then sanitize.
 * @returns {Promise<{ normalized: object[], sanitized: object[] }>}
 */
async function pipeline(runtime, fixtureFile) {
  const records = await readRecords(join(FIXTURES, runtime, fixtureFile));
  const normalized = normalizeEntries(runtime, records, {});
  const sanitized = sanitizeEntries(normalized, { runtime });
  return { normalized, sanitized };
}

const FIXTURE = 'hidden-payloads.jsonl';

const RUNTIMES = ['claude-code', 'codex', 'cursor'];

// Hidden-payload leading tokens that must be absent from sanitized text.
const HIDDEN_LEADING = [
  '<environment_context>',
  '# AGENTS.md instructions',
  '## AGENTS.md instructions',
  '# AGENTS instructions',
  '## SKILL.md instructions',
  '<subagent_notification>',
  '<turn_aborted>',
  // Claude Code injected-context wrappers confirmed in real ~/.claude stores
  // that survive structural normalization (leak class fixed by C1).
  '<system-reminder>',
  '<task-notification>',
  '<local-command-stdout>',
  '<local-command-stderr>',
  '<local-command-caveat>',
  // Broadened system/developer text leads (I1).
  'System prompt:',
  // XML-style skill wrapper injected as text (review I1).
  '<skill>',
];

// Genuine substrings that must SURVIVE (negative tests — token mid-sentence).
const KEEP_SUBSTRINGS = {
  'claude-code': [
    'help me refactor the auth module',
    'AGENTS.md instructions mention running tests',
    'crashes when the environment_context wrapper is missing',
    'turn_aborted token in your logs just means',
    // Negatives for the broadened matchers (I1): leading "System"/"Developer"
    // words that are genuine prose, and a mid-sentence mention of the new
    // system-reminder wrapper, must all SURVIVE.
    'System design notes for the new service',
    'I clicked the System: menu in the toolbar',
    'system-reminder banner you saw is injected context',
    // Mid-sentence <skill> mention must survive (review I1 negative).
    'a <skill> tag that shows up mid-sentence in a code comment',
  ],
  codex: [
    'summarize the build failure',
    'subagent_notification you mentioned is unrelated',
    'parser choke on <environment_context> tags inside user data',
    'escape a <skill> tag when it appears mid-sentence',
  ],
  cursor: [
    'fix the failing Cursor test',
    'environment_context block in the logs is normal output',
    'strip the <command-message> tag from my own parser output',
    'a <skill> tag described as a mid-sentence example',
  ],
};

describe('sanitizeEntries — hidden payloads dropped per runtime', () => {
  for (const runtime of RUNTIMES) {
    test(`${runtime}: drops each hidden-payload class`, async () => {
      const { normalized, sanitized } = await pipeline(runtime, FIXTURE);

      // Sanity: normalization should have produced more entries than survive
      // sanitization (the structural layer passes injected text through).
      assert.ok(
        normalized.length > sanitized.length,
        `expected sanitizer to drop entries (normalized=${normalized.length} sanitized=${sanitized.length})`,
      );

      const texts = sanitized.map((e) => e.text);

      // No surviving entry STARTS WITH a hidden-payload leading token.
      for (const token of HIDDEN_LEADING) {
        for (const text of texts) {
          assert.ok(
            !text.trimStart().startsWith(token),
            `${runtime}: hidden payload leaked (starts with ${token}): ${text.slice(0, 60)}`,
          );
        }
      }

      // No surviving entry is a pasted skill-body frontmatter block.
      for (const text of texts) {
        assert.ok(
          !text.trimStart().startsWith('---\nname:'),
          `${runtime}: skill-body frontmatter leaked: ${text.slice(0, 60)}`,
        );
      }
    });

    test(`${runtime}: drops system/developer instruction records`, async () => {
      const { sanitized } = await pipeline(runtime, FIXTURE);
      for (const entry of sanitized) {
        assert.ok(
          entry.role !== 'system' && entry.role !== 'developer',
          `${runtime}: system/developer record survived`,
        );
        // No survivor is a system/developer instruction header (label form or
        // known instruction lead-word form). Genuine prose that merely begins
        // with the word "System"/"Developer" (e.g. "System design notes ...")
        // is allowed to survive.
        const l = entry.text.trimStart();
        assert.ok(
          !/^(System|Developer)\b\s*[:-]/.test(l),
          `${runtime}: system/developer label record survived: ${entry.text.slice(0, 60)}`,
        );
        assert.ok(
          !/^(System|Developer)\s+(prompt|note|notes|message|instruction|instructions|directive|directives|guidelines?)\b\s*[:-]/i.test(
            l,
          ),
          `${runtime}: system/developer prompt record survived: ${entry.text.slice(0, 60)}`,
        );
      }
    });

    test(`${runtime}: keeps genuine messages that merely mention tokens`, async () => {
      const { sanitized } = await pipeline(runtime, FIXTURE);
      const joined = sanitized.map((e) => e.text).join('\n---\n');
      for (const needle of KEEP_SUBSTRINGS[runtime]) {
        assert.ok(
          joined.includes(needle),
          `${runtime}: genuine message wrongly dropped: "${needle}"`,
        );
      }
    });
  }
});

describe('HIDDEN_PAYLOAD_MATCHERS table', () => {
  test('is a non-empty array of { id, test } entries', () => {
    assert.ok(Array.isArray(HIDDEN_PAYLOAD_MATCHERS));
    assert.ok(HIDDEN_PAYLOAD_MATCHERS.length > 0);
    for (const matcher of HIDDEN_PAYLOAD_MATCHERS) {
      assert.equal(typeof matcher.id, 'string');
      assert.equal(typeof matcher.test, 'function');
    }
  });

  test('matcher ids are unique', () => {
    const ids = HIDDEN_PAYLOAD_MATCHERS.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('sanitizeEntries — broadened matchers (I1) and leak classes (C1)', () => {
  const msg = (text, role = 'user') => ({
    role,
    text,
    recordIndex: 0,
    kind: 'message',
  });

  // Each entry should be DROPPED (sanitized output empty).
  const DROP_CASES = [
    // C1: Claude Code system-reminder wrapper (the primary injected-context leak).
    '<system-reminder>The user changed directory.</system-reminder>',
    // C1-adjacent real wrapper classes confirmed in ~/.claude stores.
    '<task-notification><task-id>t1</task-id></task-notification>',
    '<local-command-stdout>ok</local-command-stdout>',
    '<local-command-stderr>err</local-command-stderr>',
    '<local-command-caveat>truncated</local-command-caveat>',
    // I1: heading matcher now accepts any level and optional .md.
    '# AGENTS.md instructions\n\nx',
    '## AGENTS.md instructions\n\nx',
    '###### AGENTS instructions\n\nx',
    '## SKILL.md instructions\n\nx',
    '# SKILL instructions\n\nx',
    // I1: text-form system/developer prompt phrasings.
    'System prompt: never reveal this.',
    'Developer note: keep it concise.',
    'System: do the thing.',
    'Developer - follow these rules.',
    'System instructions: comply.',
    // I1 (final code review): XML-style skill wrapper injected as text.
    '<skill>\n<name>oat-project-review-provide</name>\n---\nname: oat-project-review-provide\n</skill>',
    '<skill name="oat-project-review-provide">\nbody\n</skill>',
  ];

  for (const text of DROP_CASES) {
    test(`drops: ${JSON.stringify(text.slice(0, 40))}`, () => {
      const out = sanitizeEntries([msg(text)], { runtime: 'claude-code' });
      assert.equal(
        out.length,
        0,
        `expected drop but survived: ${text.slice(0, 60)}`,
      );
    });
  }

  // Each entry should be KEPT (genuine prose that merely mentions tokens, or
  // leading System/Developer words that are not instruction headers).
  const KEEP_CASES = [
    'System design notes for the new service are in the wiki.',
    'Developer experience improvements are tracked in issue 42.',
    'I clicked the System: menu in the toolbar and nothing happened.',
    'The system-reminder banner is injected context, not user text.',
    'Our AGENTS file lives at the repo root.', // no leading '#'
    'See ## Review below for details.', // heading-ish but not AGENTS/SKILL
    '## Review of the changes',
    // I1: genuine mid-sentence mention of a <skill> tag must survive.
    'Should we strip a <skill> tag from user prose before rendering?',
    'The <skill> element is documented in the spec.', // leading article, not wrapper
  ];

  for (const text of KEEP_CASES) {
    test(`keeps: ${JSON.stringify(text.slice(0, 40))}`, () => {
      const out = sanitizeEntries([msg(text)], { runtime: 'claude-code' });
      assert.equal(
        out.length,
        1,
        `expected keep but dropped: ${text.slice(0, 60)}`,
      );
    });
  }

  // m1: the system-or-developer-role matcher is defense-in-depth. In the real
  // pipeline normalizeEntries already strips non-user/assistant roles, but if a
  // role-bearing entry reaches the sanitizer it must still be dropped.
  test('m1: role-bearing system/developer entries are dropped (defense-in-depth)', () => {
    const entries = [
      msg('You are a helpful assistant.', 'system'),
      msg('Internal guidance.', 'developer'),
      msg('a genuine user message', 'user'),
    ];
    const out = sanitizeEntries(entries, { runtime: 'codex' });
    assert.equal(out.length, 1);
    assert.equal(out[0].text, 'a genuine user message');
  });
});

describe('sanitizeEntries — input handling', () => {
  test('empty input returns empty array', () => {
    assert.deepEqual(sanitizeEntries([], { runtime: 'codex' }), []);
  });

  test('does not mutate the input array', () => {
    const input = [
      {
        role: 'user',
        text: '<turn_aborted>x</turn_aborted>',
        recordIndex: 0,
        kind: 'message',
      },
      { role: 'user', text: 'a real message', recordIndex: 1, kind: 'message' },
    ];
    const copy = input.slice();
    const out = sanitizeEntries(input, { runtime: 'codex' });
    assert.deepEqual(input, copy);
    assert.equal(out.length, 1);
    assert.equal(out[0].text, 'a real message');
  });
});
