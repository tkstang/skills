# p08 Receipt Exercise

**Date:** 2026-09-17

**Alternate:** Codex independent receipt alternate / `oat-reviewer-gpt-5-6-sol-high`

**Reason for alternate:** Fable was unavailable as an executable collaborator in this run.

**Receiving skill:** `oat-review-receive` 1.4.1 at `.agents/skills/oat-review-receive/SKILL.md`

**Execution boundary:** local deterministic fixtures in a disposable `/tmp` destination; no live provider, global install, publication, network, or external mutation.

## Fixture identities

| Fixture | Source | SHA-256 |
| --- | --- | --- |
| Clean completed review | `tests/fixtures/consensus-review-receipt/clean-review.md` | `2a14076b1672186cf3a80a06f37bc2e4b66db950d8125203b23115a2b52e830a` |
| Combined findings review | `tests/fixtures/consensus-review-receipt/findings-review.md` | `e3cfc7b4c6462ebf729f25f22bf7a7e6ba7cc6184266862457c07b3db361db06` |
| Defective diagnostic | `tests/fixtures/consensus-review-receipt/diagnostic.json` | `fd63fabd0d2912811b8ae4c1e7752510c2214d4a16def988d626ef28f12009cf` |

## Normalized outcomes

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

- The implementer independently verified all three SHA-256 identities and inspected the disposable archive/task-list inventory and task-list contents. During p09 remediation, the two Markdown fixtures were regenerated from the deterministic renderer aggregate used by the new byte-parity test. The refresh adds the renderer's literal escaping and preserves one repository-valid terminal newline without changing headings, findings, locations, anchors, counts, or the normalized receipt outcomes recorded above; the hashes now identify the exact renderer output guarded by both renderer and receipt tests.
- The alternate wrote only to `/tmp/consensus-review-receipt-repeat.PjWQHz`. It observed the parent concurrently modifying the staged test file, but no repository write originated from the exercise.
- Receipt is instruction-driven, not a stable machine-parser contract.
- Deterministic local fixtures do not prove live provider discovery or invocation, external installation, native continuation, or fresh-session skill discovery.
- Live product acceptance remains unverified and was not authorized for this run.
