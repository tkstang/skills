# Codex identity fixtures

These synthetic JSONL slices model the documented Codex rollout header shapes from the
2026-09-18 structure-only schema inventory. UUIDs, paths, timestamps, messages, and call
identifiers are authored test values. No user transcript content or private locator is
included.

The fixtures cover a root session, a child whose file repeats an inherited parent header,
a fork, and a filename/header contradiction. Call and message identifiers intentionally do
not equal session identifiers.
