/**
 * Export-owned content sanitizer for export-session-transcript.
 *
 * normalizeEntries (shared transcript-core) does structural filtering only: it
 * drops tool calls/results and Claude slash-command records. It does not
 * classify injected instruction/context that arrives as ordinary
 * user/assistant text. This module adds the content layer: given normalized
 * entries, it drops entries whose content is a hidden/injected payload rather
 * than a genuine human/agent message.
 */

export type ExportRuntime = 'claude-code' | 'codex' | 'cursor';

export interface SanitizableEntry {
  role?: string;
  text?: string;
}

export interface HiddenPayloadMatcher {
  id: string;
  test: (
    text: string,
    role: string,
    runtime: ExportRuntime | undefined,
  ) => boolean;
}

export interface SanitizeEntriesOptions {
  runtime?: ExportRuntime;
}

/**
 * Return the leading (trimmed) form of a text for prefix matching.
 */
function lead(text: string): string {
  return typeof text === 'string' ? text.trimStart() : '';
}

/**
 * Declarative hidden-payload matcher table. Each matcher returns true when an
 * entry should be dropped. Matchers are content/role based and anchored at the
 * start of the message so mid-sentence mentions survive.
 */
export const HIDDEN_PAYLOAD_MATCHERS: HiddenPayloadMatcher[] = [
  {
    // Role-tagged system/developer records are never emitted.
    id: 'system-or-developer-role',
    test: (_text, role) => role === 'system' || role === 'developer',
  },
  {
    // Text-form system/developer instruction records.
    id: 'system-or-developer-text',
    test: (text) => {
      const l = lead(text);
      if (/^(System|Developer)\b\s*[:-]/.test(l)) return true;
      return /^(System|Developer)\s+(prompt|note|notes|message|instruction|instructions|directive|directives|guidelines?)\b\s*[:-]/i.test(
        l,
      );
    },
  },
  {
    id: 'environment-context',
    test: (text) => lead(text).startsWith('<environment_context>'),
  },
  {
    id: 'subagent-notification',
    test: (text) => lead(text).startsWith('<subagent_notification>'),
  },
  {
    id: 'turn-aborted',
    test: (text) => lead(text).startsWith('<turn_aborted>'),
  },
  {
    // XML-style skill wrappers injected as ordinary text.
    id: 'skill-wrapper',
    test: (text) => /^<skill(\s[^>]*)?>/.test(lead(text)),
  },
  {
    // Claude Code's primary injected-context wrapper.
    id: 'system-reminder',
    test: (text) => lead(text).startsWith('<system-reminder>'),
  },
  {
    id: 'task-notification',
    test: (text) => lead(text).startsWith('<task-notification>'),
  },
  {
    id: 'local-command-output',
    test: (text) => /^<local-command-(stdout|stderr|caveat)>/.test(lead(text)),
  },
  {
    id: 'command-message',
    test: (text) =>
      /^<(command-message|command-name|command-args)>/.test(lead(text)),
  },
  {
    id: 'agents-or-skill-md-heading',
    test: (text) => /^#{1,6}\s+(AGENTS|SKILL)(\.md)?\b/i.test(lead(text)),
  },
  {
    id: 'skill-frontmatter',
    test: (text) => {
      const l = lead(text);
      if (!l.startsWith('---')) return false;
      const firstKey = l.split(/\r?\n/, 2)[1] ?? '';
      return /^(name|description|license|compatibility|allowed-tools|argument-hint):/.test(
        firstKey.trim(),
      );
    },
  },
];

/**
 * Drop hidden-payload entries from a normalized entry list.
 */
export function sanitizeEntries<T extends SanitizableEntry>(
  entries: readonly T[],
  options?: SanitizeEntriesOptions,
): T[];
export function sanitizeEntries(
  entries: unknown,
  options?: SanitizeEntriesOptions,
): SanitizableEntry[];
export function sanitizeEntries<T extends SanitizableEntry>(
  entries: readonly T[] | unknown,
  { runtime }: SanitizeEntriesOptions = {},
): T[] | SanitizableEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => {
    const text = entry?.text ?? '';
    const role = entry?.role ?? '';
    for (const matcher of HIDDEN_PAYLOAD_MATCHERS) {
      if (matcher.test(text, role, runtime)) return false;
    }
    return true;
  }) as T[];
}
