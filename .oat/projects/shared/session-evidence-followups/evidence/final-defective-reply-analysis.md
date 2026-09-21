# Final Consensus defective-reply diagnosis

## Scope and disposition

This is a read-only diagnosis of Consensus review run
`30f3bf0c-a928-4f56-8ef3-acb086cce479`, which reviewed HEAD
`e514e7f8`. It does not assign or repair a review verdict. The retained reply
is invalid under the host contract and must not be treated as a valid pass or
as a manufactured `changes_requested` result.

The review state diagnostic records:

- status: `defective`
- reason: `invalid_review_reply`
- message: `reply.verdict pass forbids critical/high findings and failed checks`
- invocation count: 1
- selected packet:
  `/private/tmp/evidence-final-review-packet.md`
- packet SHA-256:
  `100728b82e8e6a2f76ed9ab329428bec5429c2dcabda43af3e7df15226e225e4`

## Exact native-session proof

The exact scope token
`b43205deb860d903adce3ca4067f3635aaa7e2147a1aab3485597fed60c6fde4`
occurs in exactly one Claude transcript under the recorded repository project
directory:

`/Users/tstang/.claude/projects/-Users-tstang-orca-workspaces-skills-session-fidelity/33f30d68-bece-44a0-9a1d-6f46ef7f1e1d.jsonl`

A pinned Session Observer review of
`claude-code:33f30d68-bece-44a0-9a1d-6f46ef7f1e1d` confirmed:

- native session ID:
  `33f30d68-bece-44a0-9a1d-6f46ef7f1e1d`
- recorded cwd:
  `/Users/tstang/orca/workspaces/skills/session-fidelity`
- the exact scope token and immutable packet identity in the request
- inactive session with 734 captured records
- the retained final reply at transcript record 722, timestamp
  `2026-09-21T01:43:08.601Z`
- the corresponding successful StructuredOutput tool result at record 726,
  timestamp `2026-09-21T01:43:08.696Z`

Transcript SHA-256:
`1f2a8bb498124100b870d9e0f4cabc71069cbf66ad0820c2687f918e7c585809`.

The earlier StructuredOutput attempt at record 712 was rejected locally because
both findings included an unsupported `failure_scenario` property. Its tool
result at record 715 is an error. The second attempt removed that property and
was accepted locally. The final retained input at record 722 has SHA-256
`4f38a6922c8358e265421237c8ed0f913e1d97e740d6ce93e96e9f31ea6e5ce2`
over its compact JSON serialization.

## Precise contradiction

The final retained structured reply contains:

- `verdict: "pass"`
- zero Critical findings
- zero High findings
- two Low findings
- check counts: 16 `passed`, 2 `failed`, 10 `not_run`

The two failed checks are:

1. `Newly added Markdown "Structured Activity Capture Index" is documented`
2. `Usage extraction failure is distinguishable from a runtime that does not record usage`

Thus the contradiction is specifically a `pass` verdict combined with failed
checks. The host diagnostic mentions both prohibited conditions in its generic
message; this reply has no Critical or High findings, so the failed checks are
the operative violation.

## Retained diagnostic findings

These are actionable diagnostic candidates from the invalid reply. They are not
a valid review verdict, and neither was reproduced by this diagnosis.

### 1. Usage extraction errors collapse into `not-recorded`

Severity reported by the defective reply: Low.

At `src/shared/transcript/activity/extract.ts:144-148`,
`extractUsageMetadata(...)` is wrapped in a catch that substitutes
`notRecordedUsage()`. That fallback has no error diagnostic and uses the same
`availability: not-recorded` representation as a runtime that legitimately
does not record usage. The adjacent per-record extraction failure path reports
a diagnostic, so this fallback can conceal a reader failure as a runtime
capability limitation.

The reply identifies deeply nested usage input causing recursion overflow as a
possible trigger, but explicitly says it did not reproduce the case. A bounded
follow-up should decide whether to add a content-free usage-extraction
diagnostic, add a distinct availability state, or document the overloaded
meaning.

### 2. Narrative activity index is emitted but undocumented

Severity reported by the defective reply: Low.

At
`src/skills/session-export-transcript/src/session-export-transcript.ts:1213-1226`,
complete activity output appends
`## Structured Activity Capture Index` and one invocation-key line per call.
The behavior is asserted at
`src/skills/session-export-transcript/src/cli.test.ts:2265-2272`.
A narrow search found no matching section name or invocation-key description in
the exporter or Retro user-facing documentation; Retro currently assigns
event/source keys to the activity JSON.

The reply characterizes the list as uncapped and notes that it can dominate a
long narrative. A bounded follow-up should determine whether this emitted
surface is intended. If retained, its purpose and source-of-truth relationship
to the JSON should be documented; changing or removing it would require a
separate product decision.

## Questions retained from the invalid reply

The reply also raised two questions without classifying them as findings:

- whether `recordCounts.source` cross-runtime counting differences are
  intentional
- whether user-supplied exact native identity is the intended sufficient path
  after optional Observer discovery was removed

They require separate triage and do not alter the invalid-review disposition.

## Limits

No tests, builds, validators, provider calls, product edits, or review reruns
were performed. The two findings were corroborated only against the cited
current source/doc surfaces; their failure scenarios were not executed. This
diagnosis inspected only the exact token-matched native session and its run
diagnostic.

At diagnosis time the checkout was clean at
`0641fb4dd340dd5a8e93f8641f638968c3dcc37f`; the reviewed product head remains
the immutable `e514e7f8` named in the request and retained reply. Diagnostic
JSON SHA-256:
`e219c7764077cf4101278f56f343b0370121461dfb65cda35eee663815cc05c3`.
