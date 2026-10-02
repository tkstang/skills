/**
 * Time-window test for enumerated sessions.
 *
 * A session matches when its activity interval overlaps the window. The
 * interval ends at the file mtime (last activity) and starts at the known
 * session start (`createdAtMs`), never later than the mtime.
 */
import type { SessionFile } from './types.js';

export function inTimeWindow(
  file: Pick<SessionFile, 'mtimeMs' | 'createdAtMs'>,
  since: number | null,
  until: number | null,
): boolean {
  const end = file.mtimeMs;
  const start = Math.min(file.createdAtMs ?? end, end);
  if (since !== null && end < since) return false;
  if (until !== null && start > until) return false;
  return true;
}

/** True when a point in time (epoch ms) lies inside the window. */
export function timeInWindow(
  ms: number,
  since: number | null,
  until: number | null,
): boolean {
  if (since !== null && ms < since) return false;
  if (until !== null && ms > until) return false;
  return true;
}
