# Consensus Design Research

Evidence inputs for the consensus plugin (`plugins/consensus/`). These are read-only snapshots of the design lineage that produced v0.1; they are not active planning surfaces. Active commitments live in `../../roadmap.md`, `../../decision-record.md`, and `../../backlog/`.

## Contents

- `architecture-v3.md` — the canonical family architecture: 6 skills, 3 iteration modes, 2 cold-start strategies, 3 editorial agency levels, shared `consensus-loop` primitive, and the original phased implementation plan. The v0.1 plugin implemented Phase 1 plus parts of Phases 3–5; see `roadmap.md` for the gap analysis.
- `brainstorms/2026-04-30-consensus-cli-v1.md` — original brainstorm framed as a standalone CLI. Still-relevant content: prior-art survey, the "symmetric peer beats host+tool" arguments, large-document strategy, artifact-as-ADR format.
- `brainstorms/2026-05-01-consensus-skill-orchestrator-v2.md` — v2 pivot from CLI to skill-as-orchestrator. Still-relevant content: Paseo source findings (`--output-schema` mechanics, stateless-per-iteration validation, AGPL shell-out analysis), harmonization pass design, parallel sub-agent model.

## Provenance

Snapshots were generalized (personal vault frontmatter and machine-specific paths removed) from design notes written 2026-04-30 to 2026-05-01, and copied into the repo on 2026-06-12. The v3 document supersedes v2's architecture sections, which supersede v1's — but each earlier doc retains analysis the later ones reference without repeating.

The full v0.1 project lifecycle (discovery, spec, design, plan, implementation, reviews, summary) is preserved machine-locally under `.oat/projects/archived/consensus-plugin/` (gitignored) and in `../../project-summaries/20260518-consensus-plugin.md` (tracked).

## Canonical ownership

As of 2026-06-12, these repo copies are canonical for consensus plugin design going forward. The personal-vault originals are historical brainstorms; future design changes land here (or in new dated research docs alongside these).
