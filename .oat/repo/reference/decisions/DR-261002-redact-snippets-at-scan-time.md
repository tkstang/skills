---
id: DR-261002-redact-snippets-at-scan-time
title: Redact snippets at scan time
date: 2026-10-02
status: accepted
legacy_id: null
---

# Redact snippets at scan time

## Context

Transcripts contain credentials, and retaining full hit text until ranking let peak memory reach about 1.5 GB on broad deep queries.

## Decision

Each hit keeps only a bounded, already redacted snippet (via snippetFor: redact, then window) plus a sequence number; ties break on file position.

## Consequences

Peak RSS on broad deep queries fell from about 1.5 GB to about 0.4 GB, while broad deep wall time rose (9.9 to 11.9 s and 10.5 to 17.4 s); narrow queries are unchanged and no unredacted text reaches output.
