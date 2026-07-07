---
id: BL-260620-llm-section-auto-chunking
title: LLM section auto-chunking fallback (--sections auto-llm) — for discussion
status: wont_do
priority: low
scope: idea
scope_estimate: S
labels:
  - consensus
  - consensus-loop
  - decision-sweep
assignee: null
created: 2026-06-20T00:10:39Z
updated: 2026-07-07T03:50:31Z
associated_issues: []
legacy_id: bl-db5d
---

## Description

**Status: undecided / for discussion — captured so it is not lost, not yet a
commitment.**

v3 open question #5 ("Section detection fallback"): markdown headings + explicit
`<!-- section: name -->` markers + user-specified boundaries cover most cases.
Should there be an **LLM auto-chunking fallback** for unstructured documents that
have no usable headings? The architecture notes this should be **opt-in only**
(`--sections auto-llm`) given the non-determinism it introduces.

**Source:** `research/consensus/architecture-v3.md` (Open design questions #5;
"Skill invocation surface" — `--sections auto | explicit`).

**Today:** sectioning is deterministic (headings / explicit markers / user
boundaries). An unstructured doc with no headings falls back to whole-document
treatment.

**Open for discussion:** is whole-document fallback good enough, or is there a
real need for LLM-driven chunking? Non-determinism in section boundaries would
complicate resume, convergence-per-section, and audit reproducibility — so this
needs a deliberate decision, and if built must stay opt-in.

## Verdict

Resolved `wont_do` on 2026-07-07.

Do not add `--sections auto-llm`. Deterministic sectioning by explicit markers or
markdown headings, followed by the whole-document fallback, remains the contract.
LLM-generated boundaries would make section IDs and ranges unstable, complicating
resume, per-section convergence, and audit reproducibility.

Revisit only with documented user pain from heading-less documents and a design
that makes generated boundaries explicit, reviewable, and stable across resume.
Until then, prefer adding headings or `<!-- section: name -->` markers.

## Acceptance Criteria

- Decision recorded: LLM section auto-chunking is not worth the non-determinism
  relative to the current deterministic fallback.
- No implementation planned.
