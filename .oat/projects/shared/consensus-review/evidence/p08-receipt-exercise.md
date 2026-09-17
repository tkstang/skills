# p08 Receipt Exercise

**Date:** 2026-09-17

**Alternate:** Codex independent receipt alternate / `oat-reviewer-gpt-5-6-sol-high`

**Reason for alternate:** Fable was unavailable as an executable collaborator in this run.

**Receiving skill:** `oat-review-receive` 1.4.1 at `.agents/skills/oat-review-receive/SKILL.md`

**Execution boundary:** local deterministic fixtures in a disposable `/tmp` destination; no live provider, global install, publication, network, or external mutation.

## Historical independent receiver inputs

| Fixture | Source | SHA-256 |
| --- | --- | --- |
| Clean completed review | `tests/fixtures/consensus-review-receipt/clean-review.md` | `3e7dcc04da2b9cb763cff072c277426b68db089c6aa28d58cc5d54a849d850d6` |
| Combined findings review | `tests/fixtures/consensus-review-receipt/findings-review.md` | `0e49b8317b4bfd7de86de283c8c73d2175c568316adeaf95dc2349515739b30a` |
| Defective diagnostic | `tests/fixtures/consensus-review-receipt/diagnostic.json` | `fd63fabd0d2912811b8ae4c1e7752510c2214d4a16def988d626ef28f12009cf` |

These are the exact bytes consumed by the independent p08 receiver exercise.
The disposable destination and task-list identity below belong to these
historical inputs.

## Current renderer-parity fixture identities

| Fixture | SHA-256 |
| --- | --- |
| Clean completed review | `2a14076b1672186cf3a80a06f37bc2e4b66db950d8125203b23115a2b52e830a` |
| Combined findings review | `e3cfc7b4c6462ebf729f25f22bf7a7e6ba7cc6184266862457c07b3db361db06` |
| Defective diagnostic | `fd63fabd0d2912811b8ae4c1e7752510c2214d4a16def988d626ef28f12009cf` |

The p09 Markdown refresh adds the renderer's literal escaping and preserves one
repository-valid terminal newline. Renderer and receipt tests verify these
current hashes and byte parity. The refreshed Markdown bytes were **not**
separately rerun through the instruction-driven receiver, so the historical
receiver outcome below is not attributed to the current hashes.

## Normalized outcomes from the historical exercise

The clean artifact normalized to zero Critical, Important, Medium, and Minor findings. The receiving workflow stopped cleanly without triage, archive, or task-list output.

The combined findings artifact normalized as follows after the required overview:

| ID | Severity | Title | File | Line | Body | Fix guidance | Explicit disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | critical | Reject unsafe destination | `src/reviewed.ts` | 12 | present | present | convert |
| I1 | important | Preserve the explicit acceptance rule | null (document anchor) | null | present | present | convert |
| M1 | medium | Record fixture identity | `src/reviewed.ts` | 28 | present | present | convert |
| m1 | minor | Clarify retained state | null (document anchor) | null | present | present | convert |

Counts were exactly 1 Critical, 1 Important, 1 Medium, and 1 Minor. The overview was presented before all four dispositions were explicitly selected as `convert`. In the final disposable destination, the source was archived to `/tmp/consensus-review-receipt-repeat.PjWQHz/findings/archived/findings-review.md`, and the task list was written to `/tmp/consensus-review-receipt-repeat.PjWQHz/findings/review-tasks.md` with SHA-256 `a0cb730acf3d8cda0d7628ba8b81371ff14ffb825ded2fd9e9777bb0653e67cd`.

The `.json` diagnostic was rejected and not offered as a completed review: it carried `status: defective` and no completed Markdown artifact. It produced no normalized findings, archive, or task list.

## Verification and limitations

- The p08 implementer independently verified the three historical SHA-256 identities and inspected the disposable archive/task-list inventory and task-list contents.
- The p09 checks establish current renderer-to-fixture byte parity and canonical fixture hashes only; they do not establish a second independent receiver run.
- The alternate wrote only to `/tmp/consensus-review-receipt-repeat.PjWQHz`. It observed the parent concurrently modifying the staged test file, but no repository write originated from the exercise.
- Receipt is instruction-driven, not a stable machine-parser contract.
- Deterministic local fixtures do not prove live provider discovery or invocation, external installation, native continuation, or fresh-session skill discovery.
- Live product acceptance remains unverified and was not authorized for this run.
