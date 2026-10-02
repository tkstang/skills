// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/window.ts
function inTimeWindow(file, since, until) {
  const end = file.mtimeMs;
  const start = Math.min(file.createdAtMs ?? end, end);
  if (since !== null && end < since) return false;
  if (until !== null && start > until) return false;
  return true;
}
function timeInWindow(ms, since, until) {
  if (since !== null && ms < since) return false;
  if (until !== null && ms > until) return false;
  return true;
}
export {
  inTimeWindow,
  timeInWindow
};
