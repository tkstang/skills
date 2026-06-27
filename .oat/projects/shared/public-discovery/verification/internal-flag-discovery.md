# Verification: Category 3 internal-flag discovery drop

**Date:** 2026-06-27
**Task:** prev1-t03 — stamp `metadata.internal: true` on `.agents/skills/**` and
verify the `npx skills` discovery drop.
**CLI under test:** `skills@1.5.13` (pinned; unversioned `npx skills` from this
checkout shadows the local package named `skills`).

## What was applied

1. `node scripts/apply-internal-flags.mjs` — stamped `metadata.internal: true`
   onto every OAT tooling `SKILL.md` under `.agents/skills/` that lacked it.
   - Result: **57** `.agents/skills/**/SKILL.md` files flagged.
   - The `.agents/skills/session-observer` entry is a **symlink** to the
     canonical `skills/session-observer` standalone skill; the apply script
     skips symlinked skill dirs, so the canonical standalone skill is **not**
     flagged.
2. `oat sync` (bare; `Scope: project` on oat 0.1.33) — provider mirrors
   (`.claude/skills/*`, `.cursor/skills/*`) are symlinks into `.agents/skills/*`,
   so the edits are reflected with no mirror/manifest writes. `oat sync` reported
   `No changes required` and left `.oat/sync/manifest.json`, `.claude`, and
   `.cursor` unchanged.

## Local gate

| Check | Command | Result |
| ----- | ------- | ------ |
| Detector | `pnpm run validate:internal-flags` | `57 .agents/skills SKILL.md file(s) carry metadata.internal: true` (exit 0) |
| Generated drift | `pnpm run build:check` | in sync (no drift) |
| Standalone not flagged | `grep -L "internal: true" skills/session-observer/SKILL.md skills/export-session-transcript/SKILL.md` | both listed (neither flagged) |

## Live discovery drop (skills@1.5.13)

> **Scope note:** the live `npx skills … --list` checks below run against the
> **local checkout** (a local path source the CLI accepts: `Local path
> validated`), because the flags live on this unmerged branch. A remote
> `npx skills add tkstang/skills --list` resolves the public **default branch**,
> which does not carry the flags until this branch merges — so the remote drop is
> observable only post-merge. The local-checkout run exercises the exact same
> discovery code path on the same CLI version and is the meaningful pre-merge
> proof that the flag drops the skills.

Run in an isolated `HOME`/`XDG_CACHE_HOME` sandbox.

| Check | Command | Output | Result |
| ----- | ------- | ------ | ------ |
| Default discovery | `npx -y skills@1.5.13 add <repo> --list` | `Found 7 skills`; only `export-session-transcript`, `session-observer`, and the 5 consensus skills (`create`, `decide`, `evaluate`, `plan`, `refine`) | `.agents/skills/**` OAT tooling skills **dropped** from normal discovery |
| Internal-inclusive | `INSTALL_INTERNAL_SKILLS=1 npx -y skills@1.5.13 add <repo> --list` | `Found 64 skills`; OAT tooling skills (`analyze`, `skeptic`, `synthesize`, `oat-project-implement`, …) reappear | the 57 flagged skills **reappear** only under the internal flag |
| OAT absent (default) | `… --list \| grep -iwE "analyze\|compare\|skeptic\|deep-research"` | (no match) | confirmed: OAT tooling skills absent from the default surface |

`<repo>` = `/Users/tstang/Code/feat-public-discovery`.

Counts reconcile: `7` public (2 standalone + 5 consensus plugin) `+ 57` flagged
OAT tooling `= 64` total under `INSTALL_INTERNAL_SKILLS=1`.

## Conclusion

Category 3 is now **solved in-repo** and the discovery drop is **verified**, not
deferred:

- The 57 `.agents/skills/**` OAT tooling skills carry `metadata.internal: true`
  and drop out of normal `npx skills` discovery on `skills@1.5.13`, reappearing
  only with `INSTALL_INTERNAL_SKILLS=1`.
- `skills/session-observer` and `skills/export-session-transcript` remain the
  only individually-installable standalone entries (neither is flagged).
- The consensus plugin skills remain discoverable via plugin-manifest discovery.
- The flag is enforced by `pnpm run validate:internal-flags` (CI + pre-push,
  prev1-t04) so it cannot silently regress after `oat tools update` / `oat sync`.

Remote/hosted re-verification against the public default branch remains a
post-merge confirmation (the branch is not yet merged); it does not gate this
project's completion because the mechanism and the local discovery drop are
already proven here.
