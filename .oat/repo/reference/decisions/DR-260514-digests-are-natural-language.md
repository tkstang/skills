---
id: DR-260514-digests-are-natural-language
title: Digests are natural-language-only by default; tool activity is opt-in
date: 2026-05-14
status: Accepted.
legacy_id: DR-010
---

### DR-010: Digests are natural-language-only by default; tool activity is opt-in

- **Date:** 2026-05-14
**Context:** Raw transcripts are dominated by tool calls/results that drown the conversational signal a reviewing peer needs.
**Decision:** Default digests exclude tool calls and results. `--include-tools` adds compact `[Name] args` markers (calls only, truncated); `--debug` adds results too. Every digest header states what was filtered.
**Rationale:** The digest's consumer is an agent (or human) reviewing what a peer *said and decided*, not a replay log. Always-visible filter lines prevent silent-omission surprises.
- **Status:** Accepted.
