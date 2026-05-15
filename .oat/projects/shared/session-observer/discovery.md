---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-05-14
oat_generated: false
---

# Discovery: session-observer

## Phase Guardrails (Discovery)

Discovery captures the outcomes and decisions that shaped this project. Implementation details live in `design.md` and `plan.md`. Source-of-truth design spec: `.superpowers/specs/2026-05-14-session-observer-design.md` (committed; brainstormed and approved before this OAT project was scaffolded).

## Initial Request

The user often runs Claude Code and Codex in the same project tree (sometimes side-by-side terminals, sometimes asynchronously). They want either agent to be able to:

1. Locate the *other* runtime's current or most recent session for the active project cwd.
2. Read the conversation, filter out noisy transcript tokens (raw tool results), and comment on what was just said.
3. Catch up later with "check again" semantics that only surface new content since the last check.
4. Eventually, watch continuously and weigh in as the peer session evolves.

This must work bidirectionally: Codex inspects Claude Code sessions; Claude Code inspects Codex sessions. It must be a portable, user-installable Agent Skill (open standard) — not vault-local, not tied to any project repo.

Stoa was named as the implementation reference for transcript parsing and capture (`/Users/thomas.stang/Code/stoa`, read-only) but the skill itself must not require Stoa at runtime.

## Solution Space

The brainstorm explored three structural shapes for the skill and three sub-decisions on scope:

### Approach 1: One user-facing skill + design-only watcher *(Chosen)*

**Description:** A single skill `session-observer` with helper Node scripts under `scripts/` and `scripts/lib/`. Ships three working modes in v1 (`review`, `catch-up`, `locate`) plus a `state` management subcommand. The continuous `watch` mode is fully designed in `references/watch-design.md` but not implemented in v1.

**When this is the right choice:** When the simpler modes carry most of the value, and the ergonomics of `watch` aren't yet known. Keeps v1 scope tight and matches the `create-agnostic-skill` "prefer one skill plus references" guidance.

**Tradeoffs:** Users who want continuous monitoring have to wait for v2 or invoke `catch-up` manually. The design doc preserves the decisions so v2 implementation is cheap.

### Approach 2: Small skill family from day one

**Description:** Two skills shipped together: `session-observer` (one-shot + catch-up) and `session-observer-watch` (continuous monitor with daemon plumbing).

**When this is the right choice:** When watch ergonomics are well-understood and the user wants both modes from day one.

**Tradeoffs:** Larger surface, more code to maintain, premature commitment to a CLI shape we haven't yet used.

### Approach 3: One skill with watcher built in

**Description:** Single skill, single CLI, but ships `--watch` mode in v1 along with launchd/cron/daemon plumbing.

**When this is the right choice:** Same as Approach 2 but consolidated. Most ambitious option.

**Tradeoffs:** Biggest risk of bloating v1 and over-fitting the watcher's shape before the simpler modes are used in anger.

### Chosen Direction

**Approach:** Approach 1 — one skill, watcher design-only.
**Rationale:** Locating + summarizing + catching up cover the majority of expected use. The watcher's right ergonomics are unclear (terminal foreground vs daemon, polling vs `fs.watch`, where notifications surface). Locking the design in a reference doc captures the decisions so v2 starts from a settled baseline rather than re-litigating.
**User validated:** Yes — explicit choice via `AskUserQuestion` during brainstorming.

## Options Considered

### Helper script topology

- **Thin SKILL.md + Node CLI with a small `scripts/lib/` *(Chosen)*** — splits parsing, ranking, digest, state, locate into focused files. Easier to test, easier to extend to new runtimes. ~600–700 lines of Node total.
- All-in-one `.mjs` — lower file count but mixes concerns; rejected.
- SKILL.md as pseudo-code, no scripts — brittle, heavy on context tokens, no durable state; rejected.

### Skill name

- `session-observer` *(Chosen)* — short, two-word, reads well in natural language. "Coding" is implied by Claude/Codex.
- `coding-session-observer` — more disambiguated but longer to invoke.
- `peer-session` — tight but less self-descriptive in skill listings.

### State location

- `~/.local/state/session-observer/` *(Chosen)* — XDG state semantic, durable, portable to Linux.
- `~/.session-observer/` — flat dotfile, simpler but less tidy.
- `~/.cache/session-observer/` — wrong semantic (cache implies deletable; losing the high-water mark would replay old content).

### Default tool-filtering behavior

- **Natural-language only, tools excluded by default *(Chosen)*** — agent sees a clean conversation; opts in to tool markers via `--include-tools` or full debug via `--debug`.
- Tool calls included by default (Stoa adapter default) — rejected per user preference.

### Tier C (no cwd match) behavior

- **Don't auto-fall-through; ask the user before widening *(Chosen)*** — offer sister git worktrees first, then specific cwd, then global most-recent.
- Silently fall through to global most-recent — rejected as it can pull up unrelated sessions.

### Watch-mode control surface (future)

- **`watch-ctl` subcommand + control file *(Chosen)*** — discoverable, extensible (flush/pause/resume/status/stop), trivially scriptable and testable.
- SIGUSR1 handler — rejected as unfriendly UX and one-action-per-signal limit.

### macOS notification center integration (future)

- **Not implemented *(Chosen)*** — user's typical pattern is side-by-side terminals; system notifications add noise.

## Key Decisions

1. **Skill name and home:** `session-observer` at `.agents/skills/session-observer/` per the Agent Skills open standard. Portable across Claude Code, Cursor, Codex, Gemini CLI.
2. **Scope:** Three working modes (`review`, `catch-up`, `locate`) plus `state` management. Watcher designed only.
3. **No Stoa runtime dependency:** Stoa is the *reference* for parsing logic only; the skill works on a machine that has never installed Stoa.
4. **No transcript writes, no network calls:** strictly read-only against `~/.claude/projects/**` and `~/.codex/sessions/**`. All writes confined to `~/.local/state/session-observer/`.
5. **State keyed by `${runtime}:${sessionId}`** (not by cwd) — `sessionId` is the most stable identifier and survives mid-session cwd moves.
6. **Tool calls and tool results excluded by default;** opt in via `--include-tools` or `--debug`.
7. **Tier C is an explicit ask, not auto-widening.** Sister git worktrees offered first.
8. **Helper script structure under `scripts/lib/`** (not flat `lib/`) per user preference and per Agent Skills convention.
9. **`AskUserQuestion` on Claude Code; conversational fallback on other hosts** — when arguments are absent the agent asks rather than guessing.

## Constraints

- Node ≥ 22 (repo requirement).
- Node ESM and the Node standard library only (no third-party runtime dependencies; matches repo's `consensus` plugin pattern).
- ≤ 500 lines / ~5K tokens in `SKILL.md` body (Agent Skills spec).
- `description` field single line, ≤ 500 chars, leading with "Use when…".
- Portable across Claude Code, Cursor, Codex, Gemini CLI — `name` + `description` are the only truly portable frontmatter fields; Claude-specific fields are layered on top.
- No destructive operations on transcripts or peer sessions.

## Success Criteria

- Either agent can locate the other's current-project session, render a tool-free digest, and comment on it, with one CLI invocation and zero per-host configuration beyond installing the skill.
- `check again` only surfaces records added since the last check; the high-water mark survives crashes and is per `(runtime, sessionId)`.
- When no session is found for the cwd, the skill asks the user how to widen rather than silently picking an unrelated transcript.
- `npm test` passes with unit + integration tests for ranking, digesting, state, and CLI.
- A manual probe against the user's real local `~/.claude/projects` and `~/.codex/sessions` returns a sensible digest.
- The watcher's design is recorded in `references/watch-design.md` such that v2 can implement it without re-deciding the shape.

## Out of Scope

- `watch` and `watch-ctl` subcommand implementation (designed only).
- Cursor and Gemini CLI runtime adapters.
- Hooks integration (e.g., Claude Code `UserPromptSubmit`) for push-notify of peer activity.
- macOS notification center (`--notify`) integration.
- Writing summarized "notable" findings into Stoa memory/vault.
- Anything that mutates peer transcripts.
- Anything that posts notifications/messages outside the local machine.

## Deferred Ideas

- **Continuous watcher.** Designed but deferred to v2; reference doc preserves the decisions.
- **`--capture-notable` flag** routing summarized findings into Stoa. Opt-in only; v2 design question.
- **Hook integration** with Claude Code's `UserPromptSubmit` / Codex equivalents so the host prompts the agent when fresh peer activity is available. Post-v2 due to per-host settings.json plumbing.

## Open Questions

None at the design-spec level — the spec is committed and self-consistent after the self-review pass. Anything that surfaces during implementation will be captured as a deviation in `implementation.md`.

## Assumptions

- The user's home directory layout follows defaults: `~/.claude/projects/`, `~/.codex/sessions/`, and `~/.local/state/` are writable.
- `git` is on `$PATH` for sister-worktree enumeration (gracefully degrades if not, per the spec's failure-mode table).
- Real local transcripts will share enough structure with the synthetic fixtures that the unit tests are predictive of behavior on real data; manual probe verifies.

## Risks

- **Codex JSONL shape drift.** Codex's transcript schema is less documented than Claude Code's; the `extractMeta` and `normalizeEntries` paths may need iteration after running against real fixtures.
  - **Likelihood:** Medium
  - **Impact:** Low (parsing is isolated in `scripts/lib/runtimes.mjs`; fixes are local)
  - **Mitigation:** Lift logic from Stoa's `apps/server/src/client/adapters/codex.ts` which has shipped against real Codex output; add `tests/session-observer/fixtures/codex/` with representative cases; manual probe step in acceptance criteria.

- **State-lock contention under tight concurrent watcher + catch-up.** Two writers competing for the lock could timeout; benign but noisy.
  - **Likelihood:** Low
  - **Impact:** Low (warn-not-refuse semantics; race is benign)
  - **Mitigation:** Atomic temp+rename + exclusive-create lock pattern, lifted directly from Stoa's `session-capture.sh.tpl`.

## Next Steps

Proceed to lightweight design (`design.md`) covering Overview, Architecture, Component Design, and Testing Strategy, then generate `plan.md` for `oat-project-implement`.
