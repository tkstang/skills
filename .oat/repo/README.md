# OAT Repo Reference

Human-facing orientation for `.oat/repo/` — the canonical project-management
and reference surface for this repository. Agent-facing rules live in the
`AGENTS.md` files alongside each directory.

## Layout

| Path | What it is | Maintained by |
| ---- | ---------- | ------------- |
| `pjm/current-state.md` | Shipped-product snapshot | Curated |
| `pjm/roadmap.md` | Now / Next / Later direction | Curated |
| `pjm/backlog/items/` | Active backlog items, one file each | Curated + `oat backlog` |
| `pjm/backlog/archived/` | Completed/abandoned item files | Moved here at close-out |
| `pjm/backlog/completed.md` | Newest-first completion summaries | Appended at close-out |
| `pjm/backlog/index.md` | Curated overview + generated item table | Overview curated; table via `oat backlog regenerate-index` |
| `pjm/backlog/reviews/` | Backlog review + priority-alignment artifacts | `oat-pjm-review-backlog` skill |
| `pjm/handoffs/` | One-shot kickoff prompts for kickoff-stack items (one file per item, `git rm`'d in the PR that ships the item) | Alignment walkthrough; consumed at project kickoff |
| `reference/decisions/` | Durable decision records + index | `oat decision` |
| `reference/project-summaries/` | Completion records for shipped projects | Project lifecycle |
| `reference/research/` | Evidence inputs by topic (read-only history) | Research workflows |
| `reference/external-plans/` | Imported provider/external plans | Ad hoc |

Deep project provenance (discovery/spec/design/plan/reviews) is machine-local
under `.oat/projects/archived/` (gitignored); the tracked record of a completed
project is its project summary plus any promoted decisions.

## Conventions

- Generated tables live inside `<!-- OAT ... -->` marker pairs; regenerate with
  the owning `oat` command instead of hand-editing.
- Backlog items follow `BL-YYMMDD-slug` naming (`oat backlog generate-id`);
  older records use legacy `bl-XXXX` ids. Decisions follow `DR-*` naming.
- When work ships that satisfies a backlog item's acceptance criteria, the
  item gets closed and archived in the same commit/PR — see the Backlog
  Lifecycle in `pjm/AGENTS.md`.
