# Plan review disposition — initial Opus attempt

The installed Consensus Review runner failed before model output because Claude CLI 2.1.278 rejects its draft-2020-12 `$schema` annotation. A temporary copied runner omits only that annotation from the Claude invocation; the original schema and deep reply validation remain unchanged. No installed or shipped source was changed. The corrected invocation ran on observed `claude-opus-5`, high effort.

Canonical diagnostic: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/54af4981-54d8-4610-b7ab-816699cfd58e/diagnostic.json`.

The provider completed inspection but returned section anchors for a repository document. Deep validation rejected all five finding anchors; this is **not a passed or valid completed review artifact**. Root recovered only the final structured reply from the local provider transcript as advisory evidence, verified claims against source, and requires a fresh valid review before readiness.

| Finding                                                | Disposition                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| High: Claude assistant errors excluded                 | Accepted. Native schema and a second bounded structural audit confirmed explicit API-error, abort and truncated-output assistant flags. p01 now specifies their precedence, joined interruption evidence, recovery semantics and positive/negative fixtures. Tool errors alone remain excluded.              |
| High: frozen narrative loses native human provenance   | Accepted. p03 preserves per-entry native origin/displayRole and source anchors in the explicitly opted-in Markdown capture, with unknown origin honest; p04 consumes those fields. Default narrative is unchanged.                                                                                           |
| Medium: retry grammar unresolved                       | Accepted. Native suffix formats, CLI versions 0.147.0/0.155.1, exact local locators and positive/negative matcher cases added to p01-t02.                                                                                                                                                                    |
| Low: add permanent coverage-state prose equality check | Declined mechanism. Explicitly compare all seven names and pass-through behavior during p04 acceptance; existing build/manifest checks remain. A regex that tests skill wording against a TypeScript union adds a brittle implementation-mirroring test without proving the prose consumer follows the rule. |
| Low: state no native skill version explicitly          | Accepted. p02 documentation scope now requires the explicit statement before describing inferential resolution.                                                                                                                                                                                              |

## Second Opus attempt

Canonical diagnostic: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/e7781435-a36e-4dca-8342-72d1140b55e7/diagnostic.json`.

The second Opus inspection returned two Medium and four Low findings with valid file locations, but its `changes_requested` verdict contradicted the wrapper contract (that verdict requires Critical/High). Therefore the wrapper correctly rejected the result; it is not recorded as a valid review pass. The original high findings were resolved; the reviewer explicitly accepted the manual coverage-state inspection disposition.

| Finding                                        | Disposition                                                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium: Cursor terminal support conditional    | Accepted: support is mandatory, using the existing frame scan/turn accumulator.                                                                                                                               |
| Medium: missing human-origin runtime limits    | Accepted: plan explicitly identifies Claude native provenance, bounded Codex AskUser evidence, and unknown ordinary Codex/Cursor authorship.                                                                  |
| Low: duplicate native Codex lifecycle decoding | Accepted intent: prefer a pure shared decoder or common native fixture; retain watch independence from optional activity. No broad refactor.                                                                  |
| Low: no injectable projection-limit seam       | Incorrect as stated: `projectActivityWithLimits` already exists at project.ts:513 and is called by production projectActivity. Plan now names it and nullable-byte-limit mode explicitly to remove ambiguity. |
| Low: undocumented overwrite behavior           | Accepted: explicit atomic replacement of an existing ordinary activity file, documentation and tests; reject unsafe aliases/symlink/special destinations. No force flag added.                                |
| Low: exact native identity fallback            | Accepted: corroborate identity in the snapshot, label native-record/native-source-path evidence, reject contradictions or arbitrary fallback; preserve Cursor's native path identity.                         |

Questions resolved: Cursor uses its existing scan/accumulator snapshot, not JSONL detailed records. Claude bare error strings are not independently terminal evidence; explicit assistant failure flags and joined interruption pointers are the supported evidence, with negative fixtures and documented limitations. No inference from error prose.

## First valid wrapper review — one High finding

[Canonical exported review](plan-opus-review-1.md), run `2a5dae3d-94b7-4c26-9214-f1c9ac9db668`, stable reviewed HEAD `fd106e85`. One High finding, all other checks passed.

H1 accepted: the native 0.155.1 retry date has an ordinal day (`19th`). The earlier recon summary removed that load-bearing detail. Root directly re-read only the gated error record and verified the ordinal shape. The plan now requires the observed ordinal fixture, allows an optional ordinal suffix, and anchors only the retry clause so unrelated prefix punctuation cannot break it. No other plan behavior changed. A bounded independent Opus verification follows; prior review evidence remains valid for unchanged sections.
