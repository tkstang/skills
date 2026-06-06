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
    //
    // NOTE (defense-in-depth): in the real pipeline this matcher is effectively
    // dead code — `normalizeEntries` (the STRUCTURAL layer) already drops every
    // record whose role is not user/assistant, so a role-bearing system/developer
    // entry never reaches the sanitizer. The structural layer is the real role
    // guard; we keep this matcher as a belt-and-suspenders guard for any future
    // caller that hands sanitizeEntries un-normalized, role-bearing entries.
    id: 'system-or-developer-role',
    test: (_text, role) => role === 'system' || role === 'developer',
  },
  {
    // Text-form system/developer instruction records (role lost to 'user' on some
    // providers but the body is clearly a system/developer instruction header).
    // Anchored at the start and requires a header/label shape so genuine
    // mid-sentence mentions ("the System: menu", "I used a developer build")
    // survive:
    //   - "System:" / "Developer -"        (label punctuation)
    //   - "System prompt:" / "Developer note:" / "System instructions ..."
    //     (common injected-instruction lead words)
    id: 'system-or-developer-text',
    test: (text) => {
      const l = lead(text);
      // Classic label form: leading System/Developer immediately followed by
      // ':' or '-' punctuation.
      if (/^(System|Developer)\b\s*[:\-]/.test(l)) return true;
      // Lead-word form: "System prompt", "Developer note", "System instructions",
      // "Developer message", etc. — a known instruction-header phrasing followed
      // by ':' or '-'. Kept narrow so prose like "System design notes for X"
      // (no following ':'/'-') is NOT dropped.
      return /^(System|Developer)\s+(prompt|note|notes|message|instruction|instructions|directive|directives|guidelines?)\b\s*[:\-]/i.test(
        l
      );
    },
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
    // XML-style skill wrappers injected as ordinary text — e.g.
    //   <skill>
    //   <name>oat-project-review-provide</name>
    //   ---
    //   name: oat-project-review-provide
    //   </skill>
    // Leaked skill bodies recorded as plain user/assistant transcript text would
    // otherwise survive normalization and render into the export, violating the
    // privacy boundary. Leading-anchored so genuine mid-sentence mentions of
    // "<skill>" in real conversation are PRESERVED. Accept either the bare
    // opening tag or one carrying attributes (`<skill name="…">`).
    id: 'skill-wrapper',
    test: (text) => /^<skill(\s[^>]*)?>/.test(lead(text)),
  },
  {
    // Claude Code's primary injected-context wrapper. Carries environment
    // changes and "the user sent a new message while you were working"
    // subagent-style notifications. Confirmed present in real ~/.claude
    // transcripts as the LEADING content of normalized user/assistant entries,
    // so without this matcher the wrapper renders verbatim into the export.
    id: 'system-reminder',
    test: (text) => lead(text).startsWith('<system-reminder>'),
  },
  {
    // Claude Code task/subagent dispatch + completion notifications recorded as
    // ordinary text (e.g. <task-notification><task-id>…</task-id>…). Confirmed
    // present and leading-anchored in real ~/.claude transcripts.
    id: 'task-notification',
    test: (text) => lead(text).startsWith('<task-notification>'),
  },
  {
    // Claude Code local-command execution wrappers (slash-command stdout/stderr
    // and caveat banners) recorded as text. The structural layer only drops the
    // <command-*> request payloads, not these execution-result wrappers.
    id: 'local-command-output',
    test: (text) =>
      /^<local-command-(stdout|stderr|caveat)>/.test(lead(text)),
  },
  {
    // Claude slash-command payloads that survive as text (defense-in-depth: the
    // structural layer already drops these for Claude, but Codex/Cursor pasted
    // copies would not be caught there).
    id: 'command-message',
    test: (text) => /^<(command-message|command-name|command-args)>/.test(lead(text)),
  },
  {
    // AGENTS.md / SKILL.md instruction headers pasted as text. Accept any
    // heading level (#..######) and an optional ".md" suffix so variants like
    // "## AGENTS.md instructions" and "# AGENTS instructions" are also dropped.
    // Still anchored at the start of the message.
    id: 'agents-or-skill-md-heading',
    test: (text) => /^#{1,6}\s+(AGENTS|SKILL)(\.md)?\b/i.test(lead(text)),
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
