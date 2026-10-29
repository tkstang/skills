# Session Toolkit changelog

Toolkit SemVer and `session-toolkit-vX.Y.Z` tags are independent of Skills and
plugin versions. These notes describe package content, not publication receipts.

## [0.1.0]

- Introduce `@tkstang/session-toolkit` and the `seshtk` CLI for Node 22.0.0 and 24,
  with typed, import-safe ESM APIs and stable JSON envelopes/capabilities.
- Share exact current identity, historical discovery and bounded reads for
  Claude Code, Codex and Cursor; preserve provider coordinates, generation-bound
  continuation and explicit incomplete/ambiguous/unavailable evidence.
- Provide Codex cutoff/expansion evidence, stateless tiered search and estimates,
  sanitized conversational Markdown export and separate sensitive full activity.
- Offer cached, best-effort stable-release notices only for interactive CLI
  operations; machine/library/hook contexts do not check for updates.
- Create sensitive activity JSON artifacts with owner-only permissions and
  refuse existing destinations.
- Validate one exact archive through clean installed API, declaration and CLI
  checks on supported runtimes. Skills and ORC migration is separate delivery;
  their state, watch/control and host policy remain consumer-owned.
