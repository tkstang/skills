/**
 * Shared role mapping from normalized transcript entries to search units.
 *
 * - `kind` `tool_call`/`tool_result` → `tool`.
 * - `origin`/`displayRole` `automatic-control`, `runtime-notification`, or
 *   `runtime-diagnostic` → `context`.
 * - Otherwise the entry `role`.
 *
 * Then injected-context demotion: user text that the repo's hidden-payload
 * matchers recognize (system reminders, environment context, AGENTS.md or
 * skill bodies, …), or that starts with `<user_instructions>`, is `context`.
 * Context is never counted as user-typed.
 */
import type { DigestEntry } from './runtimes.js';
import { HIDDEN_PAYLOAD_MATCHERS } from './sanitize.js';
import type { Runtime, TextUnit, TextUnitRole } from './types.js';

const CONTEXT_PROVENANCE = new Set<string>([
  'automatic-control',
  'runtime-notification',
  'runtime-diagnostic',
]);

/** True when user-role text is injected context rather than typed input. */
export function isInjectedUserText(text: string, runtime: Runtime): boolean {
  if (text.trimStart().startsWith('<user_instructions>')) return true;
  return HIDDEN_PAYLOAD_MATCHERS.some((matcher) =>
    matcher.test(text, 'user', runtime),
  );
}

/** Demote a user-role unit to `context` when its text is injected. */
export function demoteRole(
  role: TextUnitRole,
  text: string,
  runtime: Runtime,
): TextUnitRole {
  return role === 'user' && isInjectedUserText(text, runtime)
    ? 'context'
    : role;
}

/** Map one normalized entry to its search role. */
export function roleForEntry(
  entry: DigestEntry,
  runtime: Runtime,
): TextUnitRole {
  if (entry.kind === 'tool_call' || entry.kind === 'tool_result') return 'tool';
  if (
    (entry.origin !== undefined && CONTEXT_PROVENANCE.has(entry.origin)) ||
    (entry.displayRole !== undefined &&
      CONTEXT_PROVENANCE.has(entry.displayRole))
  ) {
    return 'context';
  }
  return demoteRole(entry.role, entry.text, runtime);
}

/** Convert normalized entries into role-tagged units, dropping empty text. */
export function unitsFromEntries(
  entries: readonly DigestEntry[],
  runtime: Runtime,
): TextUnit[] {
  const units: TextUnit[] = [];
  for (const entry of entries) {
    if (typeof entry.text !== 'string' || entry.text.trim() === '') continue;
    units.push({ role: roleForEntry(entry, runtime), text: entry.text });
  }
  return units;
}
