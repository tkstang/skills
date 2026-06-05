/**
 * sanitize.mjs — Export-owned CONTENT sanitizer (the privacy boundary).
 *
 * `normalizeEntries` (shared transcript-core) does STRUCTURAL filtering only: it
 * drops tool calls/results and Claude slash-command records. It does NOT classify
 * injected instruction/context that arrives as ordinary user/assistant TEXT — on
 * Codex/Cursor those text blocks pass through verbatim, and Claude can record
 * environment/AGENTS.md/skill payloads as plain text too.
 *
 * This module adds the missing CONTENT layer: given the normalized entries, it
 * drops any entry whose content is a hidden/injected payload rather than a genuine
 * human/agent message. Detection is content/role based (not runtime-structural) so
 * one declarative matcher table covers all three runtimes; `runtime` is accepted
 * for the rare provider-specific case and for forward extension.
 *
 * Policy: drop-on-LEADING-match. We only drop when a payload marker appears at the
 * START of the (trimmed) message, so genuine messages that merely *mention* a token
 * mid-sentence are preserved. We prefer false-drops of hidden payloads over leaks,
 * but anchoring at the start keeps that conservatism from eating real conversation.
 *
 * Dependency-free: Node standard library only (in fact, no imports needed).
 *
 * Exports:
 *   sanitizeEntries(entries, { runtime })  → entries   (new array; input untouched)
 *   HIDDEN_PAYLOAD_MATCHERS                → Array<{ id, test(text, role, runtime) }>
 */

/**
 * Return the leading (trimmed) form of a text for prefix matching.
 * @param {string} text
 * @returns {string}
 */
function lead(text) {
  return typeof text === 'string' ? text.trimStart() : '';
}

/**
 * Declarative hidden-payload matcher table. Each matcher returns true when an
 * entry should be DROPPED. Matchers are content/role based and anchored at the
 * start of the message so mid-sentence mentions survive.
 *
 * @type {Array<{ id: string, test: (text: string, role: string, runtime: string) => boolean }>}
 */
export const HIDDEN_PAYLOAD_MATCHERS = [
  {
    // role-tagged system/developer records — never emit, any runtime.
    id: 'system-or-developer-role',
    test: (_text, role) => role === 'system' || role === 'developer',
  },
  {
    // text-form system/developer instruction records (role lost to 'user' on some
    // providers but the body is clearly a system/developer instruction header).
    id: 'system-or-developer-text',
    test: (text) => /^(System|Developer)\b\s*[:\-]/.test(lead(text)),
  },
  {
    // environment-context wrappers injected at turn start.
    id: 'environment-context',
    test: (text) => lead(text).startsWith('<environment_context>'),
  },
  {
    // subagent notifications surfaced as ordinary text.
    id: 'subagent-notification',
    test: (text) => lead(text).startsWith('<subagent_notification>'),
  },
  {
    // turn-aborted markers.
    id: 'turn-aborted',
    test: (text) => lead(text).startsWith('<turn_aborted>'),
  },
  {
    // Claude slash-command payloads that survive as text (defense-in-depth: the
    // structural layer already drops these for Claude, but Codex/Cursor pasted
    // copies would not be caught there).
    id: 'command-message',
    test: (text) => /^<(command-message|command-name|command-args)>/.test(lead(text)),
  },
  {
    // AGENTS.md / SKILL.md instruction headers pasted as text.
    id: 'agents-or-skill-md-heading',
    test: (text) => /^#\s+(AGENTS\.md|SKILL\.md)\b/i.test(lead(text)),
  },
  {
    // Pasted skill-body frontmatter blocks: a leading `---` fence whose first
    // key is a skill-frontmatter field. Anchored so prose using `---` rules and
    // genuine YAML discussions mid-message are not affected.
    id: 'skill-frontmatter',
    test: (text) => {
      const l = lead(text);
      if (!l.startsWith('---')) return false;
      // First non-fence line should be a skill frontmatter key.
      const firstKey = l.split(/\r?\n/, 2)[1] ?? '';
      return /^(name|description|license|compatibility|allowed-tools|argument-hint):/.test(
        firstKey.trim()
      );
    },
  },
];

/**
 * Drop hidden-payload entries from a normalized entry list.
 *
 * @param {Array<{ role: string, text: string }>} entries normalized DigestEntry[]
 * @param {{ runtime: 'claude-code' | 'codex' | 'cursor' }} options
 * @returns {Array<object>} a new array with hidden payloads removed
 */
export function sanitizeEntries(entries, { runtime } = {}) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => {
    const text = entry?.text ?? '';
    const role = entry?.role ?? '';
    for (const matcher of HIDDEN_PAYLOAD_MATCHERS) {
      if (matcher.test(text, role, runtime)) return false;
    }
    return true;
  });
}
