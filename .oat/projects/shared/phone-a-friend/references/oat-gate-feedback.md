# OAT Workflow-Gate Dogfood Feedback

**Date:** 2026-06-28
**Source session:** Building the `phone-a-friend` consensus skill via
`oat-project-quick-start`, then hand-testing `oat gate cross-provider-exec`.
**Capability under test:** PR #114 — _"feat: add workflow gates and cross-runtime
execution"_ (`voxmedia/open-agent-toolkit`, merged 2026-06-21), `oat` CLI 0.1.35.
**Status:** Temporary file — hand to the OAT agent, then delete.

---

## How this came up

Ran a quick-start project to completion (discovery → lightweight design → plan →
plan artifact-review gate → ready for implement). The plan artifact-review gate
(Step 3.6 in `oat-project-quick-start`, the shared _Auto Artifact-Review Loop_
from `oat-project-plan-writing`) dispatched the in-house `oat-reviewer` as a
**same-runtime** (Claude) subagent. That review passed.

The question that triggered this feedback: _shouldn't the plan get an independent
**cross-provider** review gate?_ Investigation showed the new `oat gate`
capability is exactly that mechanism, but:

- it's only wired into `oat-project-plan` and `oat-project-implement`
  (`oat_gateable: true`), **not** `oat-project-quick-start` or
  `oat-project-import-plan`; and
- when exercised by hand, it exposed several defects.

### Reproduction

Host runtime = Claude. Both `codex` and `cursor-agent` installed. Ran the same
command a plan gate would run:

```bash
oat gate cross-provider-exec --target codex-default \
  "Use oat-project-review-provide artifact plan to review the current project plan. \
   Use project state to determine the most appropriate review scope. \
   Return blocking findings clearly, or say no blocking findings."
```

Codex (gpt-5.5, reasoning effort **medium**, sandbox danger-full-access) ran the
full `oat-project-review-provide` flow, reported **"1 blocking finding,"** wrote a
review artifact, **committed it** (`98e77b0 chore(oat): record plan review
artifact`), flipped the plan's Reviews row to `received` — and the dispatcher
**exited 0**.

---

## Findings

### 1. 🔴 HIGH — `onFailure: block` does not actually block for review gates

`oat gate cross-provider-exec` exits with the **child process status**, and
`codex exec` running `oat-project-review-provide` returns `0` regardless of the
review verdict. So a review that reports a **blocking** finding still produces
**exit 0**, and a gate configured with `onFailure: block` **passes**.

The review's _semantic_ verdict is never translated into an exit code. This
defeats the headline use case described in `workflow-gates.md` ("one runtime does
the work, then dispatch a review to another runtime" with `onFailure: block`).
In a real `oat-project-plan` run, the blocking finding below would have been
silently waved through.

**Suggested directions (pick one):**

- A structured verdict contract that `cross-provider-exec` parses (e.g. the
  dispatched review prints a machine-readable verdict the dispatcher maps to an
  exit code).
- `oat-project-review-provide` / `oat-review-provide` gain a gate mode, e.g.
  `--exit-nonzero-on <severity>`, so they exit non-zero when Critical/Important
  findings exist.
- A gate runner that inspects the produced review artifact's findings and sets
  the exit code.

### 2. 🔴 HIGH — Coverage gap: quick-start and import-plan are not gate-aware

Only `oat-project-plan` and `oat-project-implement` carry `oat_gateable: true`
plus a Gate Execution step. A plan produced via **`oat-project-quick-start`** or
**`oat-project-import-plan`** reaches implementation-ready with **no**
cross-runtime plan-review gate — so a user who configures a plan gate gets
**nothing** for those entry points, with no warning.

**Suggested fix:** Add `oat_gateable: true` and a Gate Execution step to
`oat-project-quick-start` and `oat-project-import-plan`, mirroring
`oat-project-plan` Step 12.5 / the shared plan-writing review loop, so the plan
gate fires regardless of how the plan was authored.

### 3. 🟠 MED — Gate dispatch ignores `oat_dispatch_ceiling` and "reviews run at max"

The project's `oat_dispatch_ceiling` was `maximum` (Codex: xhigh / Claude: opus),
and the ceiling prompt promises _"reviews always run at this tier (maximum)."_
But the gate ran Codex at its **default effort (medium)**, because the built-in
`codex-default` / `claude-default` / `cursor-default` targets pin **no
effort/model** and `cross-provider-exec` doesn't consult the dispatch ceiling.

A review — arguably the highest-stakes gate — quietly ran at medium.

**Suggested directions:** have gate dispatch honor the resolved dispatch ceiling;
or ship higher-effort built-in "review" targets; or clearly document that gate
targets are independent of the ceiling and must be configured for effort
(and surface the effective effort at run time).

### 4. 🟠 MED — Gate review mutates the repo and commits on the host branch

Because the canonical gate command invokes `oat-project-review-provide`, the
_other_ runtime **wrote a review artifact, made a bookkeeping commit on the
host's branch, and changed `plan.md`** (Reviews row → `received`). A pass/fail
"final check before the skill is done" that also commits and mutates project
state is surprising, and it can collide with the host skill's own bookkeeping
(here it reverted a row the host had just set).

**Suggested directions:** offer an inline/read-only review mode for gate use; or
explicitly document that gate reviews are stateful and own a commit, and define
how that interacts with the calling skill's bookkeeping.

### 5. 🟡 LOW — Gate command should prefer `oat` on PATH

The resolved gate config (`oat gate resolve oat-project-plan` /
`oat-project-implement`) pointed at an absolute dev-build path:

```
node /Users/<user>/Code/workflow-end-triggers/packages/cli/dist/index.js gate cross-provider-exec "..."
```

instead of `oat gate cross-provider-exec "..."`. It happened to still exist, but
it will drift from the installed CLI (0.1.35). The `oat gate set` UX and the
docs examples should steer toward the PATH binary (or validate/normalize the
command).

### 6. 🟡 LOW — Observed during `codex exec` (likely Codex-side, flagging anyway)

- `warning: failed to parse plugin hooks config
~/.codex/plugins/cache/openai-codex/codex/1.0.5/hooks/hooks.json: unknown field
'description', expected 'hooks'`
- `warning: Skill descriptions were shortened to fit the 2% skills context
budget.`

Flagging in case the OAT-installed Codex hooks/skill payloads contribute.

### 7. 🟠 MED — No handoff/guidance for processing the review a gate produces

The review a cross-provider gate produces **is** a normal review artifact: it was
written to the standard location
(`{PROJECT_PATH}/reviews/artifact-plan-review-2026-06-28.md`, matching
`oat-project-review-provide` Step 7 naming), with `oat_review_invocation: manual`
and a plan Reviews row at `received`, **self-committed by the dispatched
runtime**. The existing `oat-project-review-receive` flow can process it. But the
gate path leaves a lifecycle gap:

- The Gate Execution step only checks the command's **exit code** — it never
  routes the review it just generated to `oat-project-review-receive`. A gate run
  therefore leaves an unprocessed `received` review behind with no instruction to
  disposition/archive it. The gating skill should surface "review produced at
  `<path>` (received) — run `oat-project-review-receive` before proceeding," or
  hand off automatically.
- The artifact is tagged `oat_review_invocation: manual` even though it was
  **gate-originated**. Consider a distinct value (e.g. `gate`) so receive can
  apply gate-appropriate disposition and provenance is clear.
- The lifecycle spans two runtimes/commits (dispatched runtime writes+commits the
  artifact and flips the plan row; receive later archives it with another
  commit). Document that gate reviews follow the normal receive → archive flow so
  hosts don't treat the gate as having "consumed" its own review.

**Suggested:** define the post-gate review handoff explicitly (gating skill →
`oat-project-review-receive`), and tag gate-produced reviews distinctly.

---

## Positive signal (please preserve while fixing the above)

The cross-runtime review **caught a real Important plan gap that the same-runtime
(Claude) `oat-reviewer` gate missed.** The plan's manifest-registration task
updated only the prose plugin `description`, but `.codex-plugin/plugin.json` has
an `interface` block (`shortDescription` / `longDescription` / `defaultPrompt`)
that enumerates the shipped skill set, and `.agents/plugins/marketplace.json` has
its own `interface` — both would go stale. The different-provider reviewer not
sharing the host's blind spot is precisely the value of a cross-provider gate.
Fix the block-semantics bug (Finding 1) **without** losing this benefit.

---

## Ready-to-send prompt (copy/paste for the OAT agent)

> Dogfood feedback on the workflow-gate capability (PR #114, "feat: add workflow
> gates and cross-runtime execution"), from a real session that ran an OAT
> quick-start project and then exercised `oat gate cross-provider-exec` by hand
> to test the gate. Please treat each item and decide on fixes/backlog.
>
> CONTEXT / EVIDENCE
>
> - `@open-agent-toolkit/cli` 0.1.35. Host runtime = Claude. Project = a
>   quick-start project. Dispatched the same review a plan gate would run:
>   `oat gate cross-provider-exec --target codex-default "Use
oat-project-review-provide artifact plan to review the current project plan.
Use project state to determine the most appropriate review scope. Return
blocking findings clearly, or say no blocking findings."`
>   Codex reported "1 blocking finding," wrote a review artifact, committed it,
>   then the dispatcher exited 0.
>
> 1. [HIGH] `onFailure: block` does not block for review gates.
>    `cross-provider-exec` exits with the child status, and `codex exec` running
>    oat-project-review-provide returns 0 regardless of verdict, so a "blocking"
>    finding yields exit 0 and the gate PASSES. The verdict is never translated
>    into a non-zero exit code, defeating `onFailure: block` for the canonical
>    cross-runtime-review use case in workflow-gates.md. Define how a gate review
>    signals failure: a structured verdict contract cross-provider-exec parses,
>    or a `--exit-nonzero-on <severity>` mode on the review skills, or a gate
>    runner that inspects the produced review artifact.
> 2. [HIGH] Make oat-project-quick-start and oat-project-import-plan gate-aware.
>    Only oat-project-plan and oat-project-implement are `oat_gateable: true`, so
>    plans authored via quick-start/import reach implementation-ready with no
>    cross-runtime plan gate and no warning. Add `oat_gateable: true` + a Gate
>    Execution step to both, mirroring oat-project-plan Step 12.5.
> 3. [MED] Gate exec ignores `oat_dispatch_ceiling` and the "reviews always run
>    at maximum" convention. Built-in targets pin no effort/model, so the review
>    ran at Codex default (medium) despite a maximum/xhigh ceiling. Honor the
>    ceiling, ship higher-effort built-in review targets, or document the
>    independence and surface effective effort.
> 4. [MED] Clarify the gate side-effect contract. The canonical gate command
>    invokes oat-project-review-provide, which writes an artifact, commits on the
>    host branch, and flips the plan Reviews row. A pass/fail gate that mutates
>    project state and commits is surprising and collides with host bookkeeping.
>    Consider an inline/read-only review mode for gate use, or document that gate
>    reviews are stateful.
> 5. [LOW] Prefer `oat` on PATH in gate commands. Resolved gate config used an
>    absolute dev-build path (node .../workflow-end-triggers/.../dist/index.js
>    gate ...) instead of `oat gate ...`. Steer `oat gate set` UX / docs to the
>    PATH binary or validate/normalize.
> 6. [LOW/observed, likely Codex-side] During `codex exec`: "failed to parse
>    plugin hooks config ~/.codex/.../hooks.json: unknown field `description`"
>    and "Skill descriptions were shortened to fit the 2% skills context budget."
> 7. [MED] No handoff for the review the gate produces. The gate review is a
>    normal artifact in the standard reviews/ location (oat_review_invocation:
>    manual, plan row `received`), self-committed by the dispatched runtime, but
>    the Gate Execution step only checks exit code and never routes it to
>    oat-project-review-receive — leaving an unprocessed `received` review behind.
>    Define the post-gate handoff (gating skill → oat-project-review-receive),
>    tag gate-produced reviews distinctly (e.g. oat_review_invocation: gate), and
>    document that gate reviews follow the normal receive → archive lifecycle.
>
> POSITIVE SIGNAL (keep this): the cross-runtime review caught a real Important
> plan gap the same-runtime Claude reviewer missed — the plan updated only the
> prose plugin `description` and missed `.codex-plugin` `interface`
> (shortDescription/longDescription/defaultPrompt) and the
> `.agents/plugins/marketplace.json` interface, which also enumerate the skill
> set. Preserve that different-provider benefit while fixing the block-semantics
> bug.
