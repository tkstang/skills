---
oat_generated: true
oat_generated_at: 2026-05-22
oat_review_scope: p-rev1
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer
---

# Code Review: p-rev1 (independent second-look)

**Reviewed:** 2026-05-22
**Scope:** Revision phase p-rev1 (`prev1-t01` … `prev1-t05`), commit range `0e452a1^..bd41e3f`
**Files reviewed:** 24 changed (skills/session-observer/**, tests/session-observer/**, plus OAT/Codex bookkeeping skimmed for sanity)
**Commits in scope:** 5 task commits (`0e452a1`, `6fe9aa2`, `214918f`, `d5d19e1`, `bd41e3f`) + 4 tracking commits skimmed only

This is an independent second-look review at user request. The prior review at `reviews/archived/p-rev1-review-2026-05-21.md` was intentionally not consulted while reading the code.

## Summary

**Verdict: pass.** Zero Critical, zero Important findings.

The revision cleanly extends `session-observer` from a two-runtime to a three-runtime skill. Cursor support is grafted onto the existing Claude Code / Codex contracts in a way that respects the established invariants: direct encoded-dir lookups still set `recordedCwd = targetCwd` exactly (no lossy decode), fallback discovery preserves slug evidence, tool markers use the `[Name] args` / `[Name → result] output` format with `toolName` set, default tool exclusion is honored, JSONL parsing is tolerant. The dogfood hardening folded under `prev1-t01` adds non-trivial new behavior (snippet selection, command-message filtering, large-digest auto-fallback, bidirectional Tier B from p07-t03 confirmed intact, slug variant matching, state-cwd auto-runtime preference) with reasonable test coverage. `npm test` (260/260), `npm run validate`, and `npm run smoke` all pass. The Codex `payload.cwd` fix from p07-t01 and the state.mjs hardening from p07-t04 (locked backups, atomic+unique backup filenames, migration persistence) are still in place.

I independently rediscovered the same Minor that the prior reviewer flagged as `m1` (pinned `--session` does not bypass `--runtime auto` ambiguity); the project has already converted it into `prev1-t06`, which is pending. I also surface a handful of small parity/documentation gaps as Minors below.

## Findings

### Critical

None.

### Important

None.

### Medium

None.

### Minor

- **`--runtime auto --session <r>:<id>` still exits 3 (`ambiguousRuntime`) before the pinned override is considered.** (`skills/session-observer/scripts/session-observer.mjs:259-280` and `:461-482`)
  - Issue: In both `runReview` and `runCatchUp`, `resolveAutoRuntime(cwd)` runs before `--session` is parsed. When more than one runtime has candidates for the cwd and state has no single previously read same-cwd runtime, the CLI returns `ambiguousRuntime` (exit 3) even though the user has supplied a fully-qualified pinned session. The pinned-runtime intent is already encoded in `--session <r>:<id>`, so this should short-circuit auto resolution.
  - Fix: Parse `args.session` first; if present, validate it (existing `<r>:<id>` shape and `VALID_RUNTIMES` membership) and use `pinnedRuntime` as the effective runtime, discovering only that one runtime. Apply consistently to `runReview` and `runCatchUp`. Add a `cli.test.mjs` case for `--runtime auto --session cursor:<id>` when Claude + Cursor (or Codex) both match.
  - Status: Already tracked as `prev1-t06` in `plan.md` / `implementation.md`. Re-flagging independently for visibility. Workaround exists today (`--runtime cursor --session cursor:<id>` works and is tested at `tests/session-observer/cli.test.mjs:532`), which keeps this Minor rather than Important.

- **Cursor fixture parity is thinner than Claude/Codex.** (`tests/session-observer/fixtures/cursor/`)
  - Issue: `typical.jsonl` is 3 records vs 13 for Claude/Codex; `with-tool-use.jsonl` is 2 records; there is no `malformed.jsonl`, `partial-tail.jsonl`, `empty.jsonl`, or `no-cwd-record`/`no-session-meta` equivalent for Cursor. Parser tolerance behavior is exercised on Claude/Codex fixtures and is implementation-shared via `readRecords`, so this is parity gap rather than a missing-coverage bug — but a Cursor-flavored malformed or partial-tail fixture would have caught any future Cursor-only parsing branch divergence.
  - Fix: Add `tests/session-observer/fixtures/cursor/malformed.jsonl` and `partial-tail.jsonl`, plus a runtimes test that calls `readRecords` on each and asserts warn-and-skip / warn-and-drop behavior. Optional but cheap.

- **`discoverCursor` direct-hit `seenTranscripts` dedupes across slug variants, but `directHit` is set per-variant — fine today (only one Cursor variant) but easy to forget if more variants are added.** (`skills/session-observer/scripts/lib/locate.mjs:461-482`)
  - Issue: `directHit = true` is set inside the loop only when `transcriptPaths.length > 0`, which is *better* than Claude's behavior at `:121-167` (Claude sets `directHit = true` whenever `readdir` succeeds, including for an empty `<encoded>/` dir). The two branches now follow subtly different rules. Today `encodeCwdVariants('cursor', cwd)` returns a single value so it doesn't matter, but if Cursor ever grows multiple slug variants, Cursor will keep scanning fallbacks if any direct variant exists-but-is-empty, while Claude will not.
  - Fix: Optional. If Cursor adds variants, decide intentionally whether an existing-but-empty `<encoded>/agent-transcripts/` should suppress the fallback (Claude's behavior) or not (current Cursor behavior). For now, document the deviation in `locate.mjs` strategy comments.

- **`discoverCursor` fallback path stats the file twice.** (`skills/session-observer/scripts/lib/locate.mjs:502-517`)
  - Issue: After `stat(transcriptPath)` at `:504` to apply the 7-day cutoff, `cursorCandidate()` re-runs `stat()` at `:417`. Not a correctness issue; both succeed unless the file disappeared between calls. The two-call pattern is also present in Claude/Codex fallback paths via `extractMeta` re-reading the file, so this is consistent with the codebase rather than a regression.
  - Fix: Optional — pass `fileStat` (or `mtime`/`size`) through into `cursorCandidate` to skip the second stat. Not blocking.

- **Realpath/symlink normalization is still not applied in `rank.tierOf`.** (`skills/session-observer/scripts/lib/rank.mjs:50-58`)
  - Issue: Carry-over Minor from the original final-scope review (`tierOf` uses raw string equality rather than realpath-normalized comparison; spec failure mode #14, symlinked cwds). Not in p-rev1's declared scope (the revision was Cursor + dogfood hardening, not symlink hygiene), but the user prompt asked me to call this out independently. Real-world impact: a Claude session recorded under `/private/tmp/foo` will not match a target cwd `/tmp/foo` and vice versa on macOS, where `/tmp` is a symlink to `/private/tmp`.
  - Fix: Wrap `recordedCwd` and `targetCwd` through `fs.realpath(...).catch(() => path)` before the equality / startsWith comparisons. Optional; no current real-world report. Defer or convert to a task only if a user hits it.

- **`runCatchUp` calls `markRead` even when `newRecords === 0`.** (`skills/session-observer/scripts/session-observer.mjs:629-639`)
  - Issue: Pre-existing Minor from p04 review; still present. A no-op `catch-up` always writes the high-water mark back through the locked `mutate()` path, which is wasted I/O and lock contention against any concurrent `catch-up` from another shell. Behavior remains correct (writing the same `nextIndex` is idempotent).
  - Fix: Guard `markRead` with `if (digest.range.newRecords > 0 || sessionState === null)` or similar; or accept the small cost. Not blocking.

- **Cursor digest tests are runtime-agnostic by inheritance only.** (`tests/session-observer/digest.test.mjs`)
  - Issue: There is no Cursor-flavored digest test (only `claude-code` and `codex`). `buildDigest` is genuinely runtime-agnostic (it dispatches to `normalizeEntries(runtime, ...)`), and Cursor parsing is covered in `runtimes.test.mjs`, so this is parity polish rather than a missing safety net.
  - Fix: Optional — add one `buildDigest('cursor', cursor/typical.jsonl, ...)` smoke case so future digest refactors notice Cursor-specific regressions.

## Requirements/Design Alignment

**Workflow mode:** `quick`. Required artifacts: `discovery.md`, `plan.md`. Optional and present: `design.md`. Source-of-truth spec at `.superpowers/specs/2026-05-14-session-observer-design.md` declared Cursor out-of-scope for v1; the p-rev1 plan and implementation log explicitly mark this as a deliberate post-v1 expansion. No drift between what the spec said and what the docs now claim.

**Evidence sources used:**
- `.oat/projects/shared/session-observer/plan.md` (p-rev1 phase, tasks `prev1-t01`..`prev1-t06`)
- `.oat/projects/shared/session-observer/implementation.md` (phase log + outcomes)
- `.oat/projects/shared/session-observer/discovery.md` (quick-mode discovery)
- `.oat/projects/shared/session-observer/design.md` (lightweight design)
- `.superpowers/specs/2026-05-14-session-observer-design.md` (source-of-truth spec, skimmed for Cursor scope statement)
- Git diff `0e452a1^..bd41e3f` (authoritative change set)

### Requirements Coverage

| Plan task | Status | Notes |
|---|---|---|
| prev1-t01 — dogfood hardening | implemented | Dot-sanitized slug lookup, slug-evidence fallback, snippet selection, raw-vs-rendered accounting, exclusive `nextIndex`, command-message filtering and `--include-command-messages`, large-digest auto-fallback, `--max-turns/--max-bytes` for catch-up, state-cwd auto-runtime preference all present and tested. |
| prev1-t02 — Cursor runtime adapter | implemented | `discoverPaths('cursor')`, `encodeCwd[Variants]('cursor', cwd)`, `extractMeta('cursor', ...)`, `normalizeCursor()` with text/tool_use blocks all wired. Fixtures present. Tool-marker format matches Claude/Codex contract. |
| prev1-t03 — Cursor discovery + ranking | implemented | `discoverCursor` with direct lookup (`recordedCwd = targetCwd`, `cwdEvidence = 'direct-parent-dir'`) and fallback (`cwdSlug` preserved, `cwdEvidence = 'project-dir-slug'`). `rank.parentSlugMatches` extended to recognize Cursor slug variants for Tier C weak recovery. |
| prev1-t04 — CLI wiring | implemented | `VALID_RUNTIMES` extended to include `'cursor'`; help text, `--session`, `state reset --runtime`, `probe-local` all accept cursor. Three-runtime `--runtime auto` works via env-self exclusion + state-cwd preference + ambiguousRuntime fallback. `probe-local` reports `~/.cursor/projects/`. |
| prev1-t05 — docs + validation refresh | implemented | `SKILL.md` + `references/transcript-formats.md` describe Cursor accurately. Frontmatter still satisfies `validate.mjs` (`license`, `compatibility`, `metadata.version = "1.0.0"`, name matches dir). Implementation log records the local spike evidence. |

### Contract consistency checks (independent re-verification)

| Contract | Status | Evidence |
|---|---|---|
| Tool-marker format `[Name] args` / `[Name → result] output` with `toolName` set | consistent across all 3 runtimes | `runtimes.test.mjs` lines 315–341 (Claude), 449–478 (Codex), 531–541 (Cursor) |
| 200/500-char truncation | consistent | `TOOL_INPUT_LIMIT = 200`, `TOOL_RESULT_LIMIT = 500` in `runtimes.mjs:26-27`; per-runtime tests verify |
| Default tool exclusion | consistent | Tests `normalizeEntries('cursor', ..., {})` returns only `kind: 'message'` |
| Tolerant JSONL parsing (warn+skip / warn+drop) | shared via `readRecords` | Single implementation used by all 3 runtimes |
| `tool_use_id → name` correlation pattern | Claude-only; not needed for Codex (no tool_result) or Cursor (no tool_result blocks observed in spike) | Documented in `references/transcript-formats.md:307-315` |
| Exit codes 0/1/2/3/4 | unchanged contract | 4 still reserved/unused; ambiguousRuntime returns 3 with three runtimes — same as two |
| Path-encoding lossiness (`recordedCwd = targetCwd` on direct hit) | maintained for Claude (`locate.mjs:151-162`) and Cursor (`:473-478`); Codex has no path encoding | |
| Tier B bidirectional path-prefix (p07-t03) | intact | `rank.mjs:55-56`; `rank.test.mjs:333-352` ancestor/descendant/boundary cases |
| State-key `${runtime}:${sessionId}` collision risk | low | Cursor session IDs are UUID-like (directory names) — no realistic collision with Claude UUIDs or Codex session UUIDs even before the `runtime:` prefix |
| `probe-local` sibling resolution | preserved | `fileURLToPath(new URL('./session-observer.mjs', import.meta.url))` at `probe-local.mjs:41` |

### Spec/design alignment

The source-of-truth spec at `.superpowers/specs/2026-05-14-session-observer-design.md` declares Cursor out-of-scope for v1. The p-rev1 revision is a deliberate post-v1 extension; the plan, `discovery.md`, `implementation.md` 2026-05-21 entries, and the SKILL.md / `references/transcript-formats.md` updates all describe the new contract honestly, including the explicit deferral of `~/.cursor/chats/*/store.db` SQLite chat history.

The post-p07 Codex `payload.cwd` extraction is preserved in `runtimes.mjs:341-355`, and the codex cwd-cache still caches `sessionId` alongside `recordedCwd` in `locate.mjs:327-345`. The state.mjs hardening from p07-t04 (locked backups, atomic+unique backup filenames, migration persistence) is all intact in the current `state.mjs`.

### Extra Work (not in declared requirements)

The four `chore(oat):` tracking commits also added three pinned-effort Codex implementer agent TOMLs (`oat-phase-implementer-{high,low,medium}.toml`) and updated `.codex/config.toml`. These are OAT orchestration agent configs, not session-observer code; orthogonal to the revision scope and not a session-observer concern.

## Verification Commands

```bash
# Full repository test suite (must be 260/260 green)
npm test

# Manifest, docs, and frontmatter invariants (must say "validation passed")
npm run validate

# Mocked end-to-end consensus wrapper flow (must say "smoke passed")
npm run smoke

# Targeted Cursor + dogfood tests
node --test tests/session-observer/runtimes.test.mjs \
              tests/session-observer/locate.test.mjs \
              tests/session-observer/rank.test.mjs \
              tests/session-observer/cli.test.mjs \
              tests/session-observer/integration.test.mjs

# Real-world probe (acceptable: exit 0 or 2; only exit 1 is failure)
node skills/session-observer/scripts/probe-local.mjs --runtime cursor --cwd "$PWD"
```

All four commands ran green in this review: `npm test` → 260 pass, 0 fail; `npm run validate` → passed; `npm run smoke` → passed.

## Recommended Next Step

Verdict is **pass** — no Critical or Important findings. The Minor list above includes one item already tracked as `prev1-t06` and several optional polish items that the team can defer or convert to tasks as desired.

If you want to convert any of these Minors into tasks, run the `oat-project-review-receive` skill against this artifact. Otherwise, p-rev1 is ready to close as `passed` and the project can proceed to PR-final once `prev1-t06` lands (or is consciously deferred again).
