---
oat_generated: true
oat_review_scope: bounded
oat_review_type: code
oat_review_run_id: "996c14ac-75ba-402a-8588-dcdaef163229"
---

# Consensus Review

**Verdict:** pass
**Worktree:** `/Users/tstang/.t3/worktrees/skills/t3code-0a05071c`
**Scope token:** `de9253d719d70aacdd3d749d3f18ce85f91cae12d30984721cffaba0bf10498a`
**Reviewer:** claude (model unobserved, effort unobserved)
**Findings:** 0 critical, 0 high, 0 medium, 5 low

## Request

Review the revised design for implementation readiness after your prior changes\_requested review, preserved in sibling design\-review\.md and reviews/design\-01\.md\. Read those and evidence\.md as supporting context\. Scope is this concrete design, not implementation\. Check that high/material findings are now resolved and identify any remaining actionable blocker\. Deliberate first\-release scope: inactive completed CLI sources only; source\-current cross\-provider import refuses instead of building live\-prefix cutting; source/target distinct registered worktrees; no automatic native fork\. Home default remains unset and configured routing spelling retained\. Conservative tool identifier limits, supported subset, and raw content limitations are intentional\. Please avoid requiring new features outside scope or turning explicitly reported proof gaps into claims of guaranteed support\. Check actual existing helpers where needed\. No product changes, client executions, personal session inspection or external messages\. Return consensus review schema\. Separate verified evidence from provider\-client assumptions\. Once design is sound, implementation will be GPT\-6\.1 Sol, with generated\-importer isolated native client tests and a separate Opus high implementation review\.

## Summary

The revised design resolves all four high findings and all six medium findings from design\-01, and I found no remaining implementation blocker\. On the highs: \(H1\) cross\-provider source\-current now refuses with a named code and requires an inactive, completed source; a pending in\-flight call still fails closed through the strict reader\. \(H2\) There is now an explicit, shape\-based classification of injected user\-role context, with counted omissions and an ambiguity refusal\. \(H3\) The default home now emits no environment assignment and adds an unset\-guard, and the user's routing spelling is kept separate from the realpath\. \(H4\) The Claude project key is specified privately as non\-alphanumeric→'\-' with a 200\-character refusal\. I verified this against the pinned upstream encode\_cwd\.<br><br>On the mediums: occupancy is out of the digest, and exact repeats return already\-imported\. Diverged and archived seeds refuse with manual recovery guidance\. The design adds a conservative identifier profile, no Codex item IDs, and a required final assistant text\. Claude ownership separates the leaf owner from active\-chain ancestry\. Summary\-only Codex compaction is an explicit refusal\. store\-write\-denied has an exact terminal fallback\. The acceptance test now pre\-initializes homes and exercises the printed command, recording the RPC and terminal proofs separately\. The lows are also addressed\. The cited helpers exist and behave as the design describes: guidance\.ts:77\-108 quoting and pwd guard, git\-target\.ts:260\-333 distinct\-worktree and drift revalidation, guidance\-discovery\.ts:353\-361 exact selection, and guidance\-cli\.ts:252\-345, which currently maps failures to preview\-incomplete\. The existing UUID regex already accepts v8\.<br><br>The remaining findings are low\-severity clarifications that an implementer could otherwise guess at\. None requires new features or changes scope\.

## Scope and provenance

- Selector: `document=.oat/repo/reference/research/session-import-fork-2026-09-30/design.md`
- Requested paths: `.oat/repo/reference/research/session-import-fork-2026-09-30/design.md`
- External documents: none
- Captured evidence: 14904 bytes
- Reviewer claim: \{"provider":"anthropic","model":"claude\-opus\-5\-5","effort":"medium"\}
- Observed reviewer evidence: The provider envelope identifies the provider only; model and effort were not independently observed\.
- Diversity: unknown — Provider selection alone does not establish a different model family\.
- Drift comparison: stable within stated coverage
- Detection limit: Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.

### Authorship evidence

- unknown — unknown, unknown coverage; No bounded author evidence was supplied\.

### Reviewer-reported inspected context

- \.oat/repo/reference/research/session\-import\-fork\-2026\-09\-30/design\.md (`04138befbbfff8fb09b36cffe591906e91ed0b792e196b6f9436381cafb9695d`)
- \.oat/repo/reference/research/session\-import\-fork\-2026\-09\-30/design\-review\.md, reviews/design\-01\.md, reviews/design\-01\.json, evidence\.md \(working tree, uncommitted\) (`worktree-2026-09-30`)
- src/skills/session\-fork\-to\-destination/src/\{guidance\.ts,guidance\-cli\.ts,guidance\-discovery\.ts,git\-target\.ts,guidance\-capabilities\.ts\} (`HEAD-3e383a07`)
- /tmp/teleporter\-review\.pjO2qj/aviadr1\-claude\-session\-teleporter\-39fd13a/claude\_sessions\.py \(external, pinned commit 39fd13a\) (`39fd13ae4e4f1c7b484872561226da3764ab5a21`)

## Findings

### Critical

None

### High

None

### Medium

None

### Low

- **L1: Codex event\_msg and off\-chain record handling is ambiguous under 'unknown control types refuse'** (`.oat/repo/reference/research/session-import-fork-2026-09-30/design.md:32-36 (04138befbbfff8fb09b36cffe591906e91ed0b792e196b6f9436381cafb9695d)`)
  - Claim: The design ignores 'duplicate display events', reads response\_item directly, and refuses 'unknown active/control types' via 'a small explicit allowlist' for off\-chain metadata\. It does not say whether Codex event\_msg subtypes \(which are numerous and change between releases\) are ignored by default, or must each be allowlisted\. A strict per\-subtype allowlist would make real Codex sessions refuse on client updates for display\-only events\. Ignoring all of them risks missing history\-altering controls\.
  - Evidence: design\.md:32 'Ignore duplicate display events\. Read native response\_item messages and function/custom calls/results directly\.' design\.md:36 'Unknown active/control types refuse; known off\-chain metadata uses a small explicit allowlist\.' Pinned upstream claude\_sessions\.py:2612\-2667 ignores every event\_msg except thread\_rolled\_back \(which refuses\) and takes owning cwd from turn\_context\. The revised design instead pins cwd to the first session\_meta\.
  - Suggestion: State the Codex rule in one sentence\. Treat event\_msg as display\-only and ignore it, except for named history\-altering events \(thread\_rolled\_back → unsupported rollback refusal\)\. Treat turn\_context as metadata that must not override the owning cwd\. Unknown top\-level record types and unknown response\_item types fail closed\. Add one fixture with an unrecognized event\_msg subtype\.
  - Confidence: 0.55

- **L2: Opaque items inside Codex replacement\_history need the named compaction refusal, not a reasoning omission** (`.oat/repo/reference/research/session-import-fork-2026-09-30/design.md:32 (04138befbbfff8fb09b36cffe591906e91ed0b792e196b6f9436381cafb9695d)`)
  - Claim: The design accepts replacement\_history when present and omits 'private reasoning'\. If a Codex replacement\_history carries an opaque or encrypted compaction item that stands in for the pre\-compaction context, an implementer could classify it as omitted reasoning\. The result would be a seed that silently loses the surviving context except for a count\. The pinned upstream turns unknown items into placeholder text, which the design \(correctly\) does not want\.
  - Evidence: design\.md:32 'missing/invalid replacement history fails with unsupported\-codex\-compaction'\. design\.md:36 'Omit private reasoning'\. Upstream claude\_sessions\.py:2660\-2662 emits an '\[Imported \{kind\} item unavailable…\]' placeholder for unknown Codex items\. That encrypted compaction items appear in current Codex replacement\_history is a provider\-client assumption; I did not verify it against Codex 0\.157\.1\.
  - Suggestion: Specify that any non\-message, non\-tool item inside replacement\_history other than a reasoning item refuses with unsupported\-codex\-compaction\. Cover this with one fixture\.
  - Confidence: 0.4

- **L3: The terminal fallback for store\-write\-denied can go stale when home routing came from the agent's environment** (`.oat/repo/reference/research/session-import-fork-2026-09-30/design.md:61 (04138befbbfff8fb09b36cffe591906e91ed0b792e196b6f9436381cafb9695d)`)
  - Claim: The plan digest covers the home source and routing spelling\. For environment\-selected homes, the value comes from the invoking agent process's CODEX\_HOME/CLAUDE\_CONFIG\_DIR\. Replaying the 'exact same import/apply/digest command' in the user's own terminal recomputes the plan from that terminal's environment\. If the variable differs or is unset, apply refuses as stale\. That is safe, but it defeats the purpose of the fallback without explaining why\.
  - Evidence: design\.md:42 resolves the home from \-\-target\-home, then the environment, then the default, and tracks the home source\. design\.md:20 says routing changes require a new plan\. design\.md:61 prints 'the exact same import/apply/digest command' for terminal use\.
  - Suggestion: When the plan's home source is 'environment', have the fallback text state the required variable assignment\. Alternatively, print the replay with that assignment as an env prefix, so the terminal recomputes the same home source and spelling\. Add one CLI test for the fallback text\.
  - Confidence: 0.5

- **L4: A mis\-declared entry point from inside the source session surfaces as a generic incomplete\-turn refusal** (`.oat/repo/reference/research/session-import-fork-2026-09-30/design.md:16 (04138befbbfff8fb09b36cffe591906e91ed0b792e196b6f9436381cafb9695d)`)
  - Claim: The entry point is declared by the caller\. guidance\-cli\.ts accepts it without detecting the current session\. If the skill runs import from the live source session but passes source\-other or destination\-fresh, the strict reader sees the in\-flight importer call and refuses with incomplete\-source\-turn or a pending\-tool error\. This fails closed, but the user gets no pointer to the documented remedy \(finish the turn, exit, and invoke from elsewhere\)\.
  - Evidence: design\.md:16 defines source\-current\-import\-unsupported and the remedy\. design\.md:34 defines incomplete\-source\-turn\. guidance\-cli\.ts:60,146 only validate the declared entry\-point string\. guidance\-discovery\.ts:339\-351 selectCurrentGuidanceCandidate exists but needs a caller\-supplied identity\.
  - Suggestion: Have the incomplete\-source\-turn and pending\-call refusal text include the source\-current remedy\. No detection machinery is needed\.
  - Confidence: 0.5

- **L5: The design should state that skipped isolated\-client runs cannot back support claims** (`.oat/repo/reference/research/session-import-fork-2026-09-30/design.md:71-73 (04138befbbfff8fb09b36cffe591906e91ed0b792e196b6f9436381cafb9695d)`)
  - Claim: The opt\-in integrated test 'skips explicitly' when isolation is unavailable\. The design records client versions but does not say that user\-guide support claims per direction depend on a recorded non\-skipped pass\. The key open proof is whether an imported Codex rollout can be found by \`codex fork ID\` in a pre\-initialized home\. Without this rule, a skipped run could still end up documented as supported\.
  - Evidence: design\.md:71 'unavailable isolation skips explicitly … Record exact client versions in compatibility/limitations'\. evidence\.md:7\-9: both fresh\-home lifecycles were proven, the terminal Codex fork made no model turn, and populated\-home lookup was never tested\. Root AGENTS\.md forbids documenting provider support before the live provider path is verified\.
  - Suggestion: Add one sentence: user\-facing docs claim each direction only on the client versions where the generated\-importer isolated test actually passed, including the pre\-initialized home and the printed command\. Otherwise the direction is listed as unverified in limitations\.
  - Confidence: 0.6

## Questions

- For Codex sessions whose turn\_context cwd differs from the owning session\_meta cwd \(the user changed directory mid\-session\), is refusal the intended first\-release behavior? The design pins the owning cwd, while upstream follows the latest turn\_context\.

## Limitations

- Read\-only design review\. No provider clients, tests, builds, or type\-checks were run\.
- Provider\-client assumptions were not verified against Codex 0\.157\.1 or Claude Code 2\.1\.284: the Codex event\_msg subtype churn, encrypted or opaque compaction items in replacement\_history, pre\-initialized\-home rollout lookup, and production API acceptance of historical tool calls for unregistered tools\.
- Experiment request/response JSON artifacts were not re\-hashed\. I relied on evidence\.md's statement that all 12 manifest hashes were verified\.
- Only the specific upstream Teleporter regions cited were inspected: encode\_cwd at ~177\-186, content conversion at ~2305\-2320, and the Codex reader at ~2612\-2667\.
- Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.
- Provider read\-only controls are not universal filesystem or network isolation\.
- Retention is operator\-managed; the external run directory has no automatic cleanup or replay policy\.

## Checks reported

- Captured design hash matches the evidence manifest — passed: shasum \-a 256 design\.md = 04138bef…6d9106da51fee, matching the manifest\.
- Prior high and medium findings resolved in the revised design — passed: H1\-H4 and M1\-M6 are each addressed at design\.md:16,20,30,32,34,36,42\-44,50,61,71\. The low findings are addressed at 26, 50, 52, 54\.
- Cited helper line ranges exist and match the described behavior — passed: The quoteShellWord and pwd \-P guard are at guidance\.ts:77\-108\. The UUID regex accepts versions 1\-8\. validateHandoffTarget refuses same\-worktree, repository mismatch, and source\-dirty\. revalidateHandoffTarget compares status fingerprints\. rawMatch and defaultPreview throw preview\-incomplete\.
- Claude project\-key encoder matches pinned upstream — passed: claude\_sessions\.py encode\_cwd: re\.sub\(r"\[^A\-Za\-z0\-9\]", "\-", cwd\)\.

## Suggested verification

- Unit tests, type\-check, build:check — not\_run: Design review only; there is no implementation yet\.
- Live or isolated provider client verification — not\_run: Out of scope; client execution not authorized\.

## Artifact paths

- Run directory: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/996c14ac-75ba-402a-8588-dcdaef163229`
- Captured request: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/996c14ac-75ba-402a-8588-dcdaef163229/request.txt`
- Captured evidence: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/996c14ac-75ba-402a-8588-dcdaef163229/evidence.json`
- Host result JSON: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/996c14ac-75ba-402a-8588-dcdaef163229/result.json`
