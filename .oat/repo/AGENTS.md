# Repo Reference Guidance

Use this directory as the canonical OAT repo-reference root.

- Active operational planning lives in `pjm/`.
- Durable append-mostly references live in `reference/`.
- Keep generated indexes inside their managed marker pairs.
- When an index conflicts, regenerate it with the owning OAT command and stage
  the result.
- The backlog close-out workflow is defined in `pjm/AGENTS.md` (Backlog
  Lifecycle). Follow it whenever shipped work satisfies a backlog item —
  including work done outside an OAT project lifecycle.
- `README.md` in this directory is the human-facing orientation; keep it in
  sync when the directory layout changes.
