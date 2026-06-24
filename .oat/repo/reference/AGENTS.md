# Reference Directory Guidance

This directory is the skills repo's durable, append-mostly provenance area. It inherits the repo root `AGENTS.md`; this file covers only the meaning and maintenance rules for `.oat/repo/reference/`.

## Source of Truth Map

- `../pjm/roadmap.md` is the active planning surface: Now / Next / Later priorities and lane framing.
- `../pjm/current-state.md` is the shipped-product snapshot: plugin and skill capabilities, validation posture, release posture.
- `decisions/*.md` holds durable architecture and product decisions. Seeded retroactively 2026-06-12 from archived project artifacts and migrated from the legacy monolith into file-per-record form.
- `../pjm/backlog/items/*.md` are executable active backlog records. Completed backlog item files move to `../pjm/backlog/archived/*.md`; `../pjm/backlog/index.md` and `../pjm/backlog/completed.md` summarize backlog state. If item files move or change, run `oat backlog regenerate-index`.
- `project-summaries/*.md` are completion records for shipped projects.
- `research/` holds evidence inputs (e.g. `research/consensus/` — the consensus design lineage). Research does not become an active commitment until promoted into the roadmap, backlog, or decision record.
- Deep project provenance (discovery/spec/design/plan/reviews) is machine-local under `.oat/projects/archived/` (gitignored); the tracked record of a completed project is its project summary plus any decisions promoted into `decisions/`.

## Update Rules

- Prefer updating the active source of truth over adding parallel notes.
- Keep `../pjm/roadmap.md`, `../pjm/current-state.md`, and affected backlog items in agreement when planning language changes.
- When closing or shipping work: move completed backlog records to `../pjm/backlog/archived/`, update the completed summary, the project summary, and `../pjm/current-state.md`; promote durable decisions into `decisions/`.
- Research snapshots are read-only history — annotate implementation divergence with pointers to the decision record rather than rewriting them.
