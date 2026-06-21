# Migration Map — README.md → docs site (no-info-loss gate)

Source: root `README.md` (205 lines, the dense pre-migration version) plus the
named secondary sources. Every README block has a destination page in the
two-trunk IA. **`migrated?`** is flipped to `yes` as each destination page lands;
p03-t01 must not slim the README until every row is `yes`.

Trunk legend: **UG** = `documentation/docs/user-guide/`, **ENG** = `documentation/docs/engineering/`.

| # | README section (heading / lines) | Destination page | migrated? |
|---|---|---|---|
| 1 | `# skills` + "Status: v0.1 pre-release" + intro ("personal Agent Skills home…") | `docs/index.md` (overview) + `UG/index.md` | yes |
| 2 | What Ships Here → **Consensus plugin** (summary, scope, modes) | `UG/consensus/index.md` (overview + capabilities) | yes |
| 3 | What Ships Here → **Session observer skill** | `UG/skills/session-observer.md` + `UG/skills/index.md` (one-liner) | yes |
| 4 | What Ships Here → **Export session transcript skill** | `UG/skills/export-session-transcript.md` + `UG/skills/index.md` | yes |
| 5 | What Ships Here → **Shared transcript-core** | `ENG/architecture/transcript-core.md` | yes |
| 6 | What Ships Here → **Generated runtime outputs** (build contract) | `ENG/architecture/generated-runtime.md` | yes |
| 7 | **Local Git Repository Install** (claude/codex/cursor + caveats) — the install matrix | `UG/installation.md` | yes |
| 8 | **Prerequisites** (Node 22+, provider CLIs, inventory/preflight) | `UG/installation.md` | yes |
| 9 | **Usage** → consensus refine command + example | `UG/consensus/refine.md` | yes |
| 10 | **Usage** → consensus evaluate command + example | `UG/consensus/evaluate.md` | yes |
| 11 | **Usage** → session-observer commands | `UG/skills/session-observer.md` | yes |
| 12 | **Usage** → export-session-transcript (modes/flags from intro) | `UG/skills/export-session-transcript.md` | yes |
| 13 | **Permissions** → consensus | `UG/consensus/configuration.md` | yes |
| 14 | **Permissions** → session-observer | `UG/skills/session-observer.md` | yes |
| 15 | **Advanced Configuration** → consensus (peers, provider floor, synthesizer, agency, Cursor auth) | `UG/consensus/configuration.md` | yes |
| 16 | **Advanced Configuration** → session-observer (runtime auto, watch, watch-ctl) | `UG/skills/session-observer.md` | yes |
| 17 | **Limitations** → consensus | `UG/consensus/index.md` (Limitations section) | yes |
| 18 | **Limitations** → session-observer / export / cursor / prompt-injection / telemetry | respective skill pages + `UG/index.md` (cross-cutting: prompt-injection, no-telemetry) | yes |
| 19 | **Repository Layout** | `ENG/repository-layout.md` | yes |
| 20 | **Development** (verification commands) | `ENG/contributing/development/index.md` | yes |

## Secondary sources (authored into the site, beyond the root README)

| Source | Destination | migrated? |
|---|---|---|
| `plugins/consensus/README.md` Usage (refine/evaluate/iteration modes/guided rubric) — link target, not copied (decision B) | linked from `UG/consensus/*` | n/a (link) |
| Root `CLAUDE.md` "Repository Conventions" | `ENG/contributing/development/conventions.md` | yes |
| Root `CLAUDE.md` "Commits" | `ENG/contributing/development/commit-conventions.md` | yes |
| Root `CLAUDE.md` hooks / lint-staged / version-bump enforcement | `ENG/contributing/development/hooks-and-safety.md` | yes |
| `CONTRIBUTING.md` | `ENG/contributing/development/index.md` | yes |
| Authored fresh (refs: oat-docs/stoa/gizmo) — docs authoring contract | `ENG/contributing/documentation/{index,authoring,markdown-features,review-checklist}.md` | yes |
| `decision-record.md` (Fumadocs DR + pointer) | `ENG/decisions.md` (future slot — pointer only) | yes |

## Notes

- Install commands are **relocated verbatim** (no rewrite) — install-matrix accuracy is the bl-d85f tag-time gate.
- Consensus deep usage is **linked** to the untouched `plugins/consensus/README.md` (decision B); `UG/consensus/refine.md` / `evaluate.md` carry curated user-facing usage migrated from the *root* README plus pointers for depth.
- `ENG/decisions.md` is a defined future slot — a pointer, not fabricated content.
