---
id: DR-261002-adapter-owned-record
title: Adapter-owned record classification
date: 2026-10-02
status: accepted
legacy_id: null
---

# Adapter-owned record classification

## Context

The shared transcript normalizers truncate or drop text needed for search: Cursor emits only at turn_ended, Codex drops tool output, and Claude truncates tool text.

## Decision

Each runtime adapter (Claude Code, Codex, Cursor) owns enumeration, extraction, and role classification of raw records, including Codex item_completed MCP, Extension, and FileChange items, while still reusing the shared library for record parsing and metadata.

## Consequences

Search sees untruncated user, assistant, and tool text per runtime, and agent-authored Codex text is never scored as user-typed; adapters carry provider-specific extraction logic that must track schema drift.
