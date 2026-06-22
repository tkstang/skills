# Reference Directory Guidance

This directory is the skills repo's file-backed planning and provenance area. It inherits the repo root `AGENTS.md`; this file covers only the meaning and maintenance rules for `.oat/repo/reference/`.

## Source of Truth Map

- `roadmap.md` is the active planning surface: Now / Next / Later priorities and lane framing.
- `current-state.md` is the shipped-product snapshot: plugin and skill capabilities, validation posture, release posture.
- `decision-record.md` holds durable architecture and product decisions (DR-NNN with context and rationale). Seeded retroactively 2026-06-12 from archived project artifacts.
- `backlog/items/*.md` are executable active backlog records. Completed backlog item files move to `backlog/archived/*.md`; `backlog/index.md` and `backlog/completed.md` summarize backlog state. If item files move or change, run `oat backlog regenerate-index`.
- `project-summaries/*.md` are completion records for shipped projects.
- `research/` holds evidence inputs (e.g. `research/consensus/` — the consensus design lineage). Research does not become an active commitment until promoted into the roadmap, backlog, or decision record.
- Deep project provenance (discovery/spec/design/plan/reviews) is machine-local under `.oat/projects/archived/` (gitignored); the tracked record of a completed project is its project summary plus any decisions promoted into `decision-record.md`.

## Update Rules

- Prefer updating the active source of truth over adding parallel notes.
- Keep `roadmap.md`, `current-state.md`, and affected backlog items in agreement when planning language changes.
- When closing or shipping work: move completed backlog records to `backlog/archived/`, update the completed summary, the project summary, and `current-state.md`; promote durable decisions into `decision-record.md`.
- Research snapshots are read-only history — annotate implementation divergence with pointers to the decision record rather than rewriting them.
