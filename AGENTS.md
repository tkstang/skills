<!-- OAT tools -->
## Tool Packs

- **Skills directory:** `.agents/skills/`
- **Discover available skills:** scan `.agents/skills/*/SKILL.md`
- **Refresh provider views:** `oat sync --scope all`
- **Update skills to latest versions:** `oat tools update`
- **User-scoped skills:** `~/.agents/skills/` (core, brainstorm packs installed at user scope)

### Installed Packs

- **core** — Diagnostics and documentation (oat-doctor, oat-docs) _(user scope)_
- **ideas** — Idea capture and refinement
- **docs** — Documentation and instruction governance workflows
- **workflows** — Project lifecycle (create, discover, plan, implement, review, complete)
- **utility** — Standalone utilities (skill authoring, maintainability review, code reviews)
- **research** — Research, analysis, verification, and synthesis
- **brainstorm** — Always-on brainstorming entry point with visual companion _(user scope)_

### Workflow Execution Continuation

- This guidance applies only to OAT project lifecycle execution, such as `oat-project-implement`, and OAT project review/receive flows. It does not apply to non-OAT tasks or ad-hoc work outside the OAT project workflow.
- When executing an OAT project implementation or OAT project review workflow, do not stop at task boundaries, phase boundaries, or other clean checkpoints unless the configured HiLL checkpoint has been reached, a real blocker exists, or explicit user input is required.
- Status summaries, completed bookkeeping, and "clean boundary" pauses are not valid stop reasons. After updating tracking artifacts, continue execution until an allowed stop condition applies.
<!-- END OAT tools -->

## Repository Conventions

- Use Node >=22 for runtime and test scripts.
- Keep runtime plugin code dependency-free and use Node standard library APIs unless a future project explicitly changes that contract.
- Do not document provider support, marketplace availability, or skills.sh discovery as complete until the release checklist verifies the live provider path.
- Keep plugin-facing documentation accurate to source code and manifests; do not preserve stale workaround notes when the implementation contract changes.
- When editing a standalone skill under `skills/` for local dogfooding, keep the user-level install in sync before closeout. Refresh the canonical copy at `~/.agents/skills/<skill-name>/`, verify provider-specific user skill entries such as `~/.claude/skills/<skill-name>` and `~/.cursor/skills/<skill-name>` resolve to that canonical copy when present, then run `oat sync --scope user`.
- Shared transcript-format logic has a single source of truth at `shared/transcript-core/runtimes.mjs`. Skills that need it (e.g. `session-observer`, `export-session-transcript`) carry a **generated** committed copy at `scripts/lib/runtimes.mjs`. Edit only the canonical file, then run `npm run sync:transcript-core` to regenerate every consumer copy; never hand-edit the generated copies (they carry a `// GENERATED` banner). A drift guard (`tests/transcript-core/sync.test.mjs`) fails `npm test` if any copy diverges from canonical.

## Verification

- Run `npm test` for the full Node test suite.
- Run `npm run validate` for repository structure, manifest, and docs invariants.
- Run `npm run smoke` for the mocked end-to-end consensus wrapper flow.
