import type { SessionCandidate } from './types.js';

/** Compare qualified IDs by UTF-16 code units without host-locale state. */
export function compareQualifiedSessionIds(
  left: SessionCandidate['key'],
  right: SessionCandidate['key'],
): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
