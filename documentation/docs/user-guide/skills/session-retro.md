---
title: 'Session Retro'
description: 'Review one exact frozen session episode and propose evidence-backed improvements without applying them.'
---

# Session Retro

`session-retro` reviews a completed or bounded episode to identify what would
improve a future run. It is generated as the standalone `session-retro` skill
and as `retro` in the Session plugin. Both forms share one canonical owner,
version, and report template.

The review is read-only. It proposes changes but does not edit skills, rules,
memory, repositories, installed copies, generated packages, or publications.

## Freeze an exact session first

Run the retrospective from a different native session than the target. Resolve
the reviewing and target runtime/native session identities and prove that they
differ before capture. If either identity is unknown or they match, stop and
request the missing identity or a different session. Do not substitute the
current, newest, matched, auto-ranked, or peer session.

Read the installed Session Export Transcript contract and generated CLI help.
Capture one exact session to two new destinations before analysis:

```bash
node <session-export-transcript-skill-dir>/scripts/session-export-transcript.mjs \
  --runtime <claude-code|codex|cursor> \
  --cwd <project-path> \
  --session <exact-native-id> \
  --out <frozen-narrative.md> \
  --activity-output <frozen-activity.json>
```

The Markdown is the full sanitized narrative. The JSON is complete captured
activity with bounded previews and is marked `sensitive: not-publish-safe`.
Confirm that the narrative's exported timestamp and native session match the
JSON `capturedAt` and `nativeSessionId`, and retain `identityEvidence` plus both
file hashes. Contradictory identity or a missing/partially written destination
pair fails capture. Malformed or truncated source input instead preserves
honest counts, diagnostics, and coverage for the captured supported prefix.

Analyze only this frozen pair. Do not mix later transcript reads, Observer
digests, repository changes, or a second capture into findings. When the frozen
evidence does not prove that the target ended, title the report **Captured
activity review**. Report mixed-identity, multiple-writer, or out-of-episode
contamination signals without claiming detection is exhaustive.

The complete workflow requires
[Session Export Transcript](session-export-transcript.md). The Session plugin
includes `export-transcript` beside `retro`; standalone `session-retro` users
must also install the standalone `session-export-transcript` skill. The retro
checks the current host inventory and reports a missing dependency instead of
installing or fetching it.

## Read provenance and coverage literally

The narrative supplies conversation sequence, stable entry anchors, and native
origin labels. The activity JSON supplies event/source keys, calls, results,
metadata, locators, diagnostics, omissions, and coverage. A finding cites those
recorded coordinates before interpretation.

Coverage keeps all seven states unchanged:

| Status         | Meaning for a retro                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `available`    | The named evidence class is present within the captured scope.                                      |
| `not-recorded` | The supported native surface does not record that class; it does not prove absence.                 |
| `not-found`    | The attempted evidence lookup found no matching record; it does not prove the event never occurred. |
| `not-read`     | A recorded reference was intentionally not opened.                                                  |
| `unsupported`  | The captured form is outside current extraction support.                                            |
| `malformed`    | Invalid captured input limits interpretation.                                                       |
| `truncated`    | Only a captured prefix or bounded preview is available.                                             |

A negative claim needs both reliable native recording and adequate frozen
coverage for the relevant range. The last six statuses cannot be collapsed
into a generic missing or complete result.

Runtime limits also remain explicit:

- Cursor records calls but no tool results, per-call status, exit code,
  duration, or timestamps in the supported surface. A settled turn is not a
  per-call result.
- Codex call/output records and item-completion outcome streams are separate.
  A retro correlates them only when the frozen evidence supplies a labelled
  link.
- Claude Code records explicit result success/failure but no numeric tool exit
  code.

Source skill names are separate from per-event skill evidence. Available names
are deduplicated at the latest locator, while invoked names retain occurrence
evidence. Usage samples preserve `owned`, `inherited`, or `unknown` ownership
and ownership-separated reset segments. They do not prove skill versions,
complete-session totals, price, cost, intent, effectiveness, or causality.

## Identify human intervention conservatively

A human intervention requires a linked frozen sequence: request → relevant
activity → native-human correction → recovery or later outcome. Missing links
produce a partial sequence, not a proven correction or recovery.

- Claude Code records `human` and `task-notification` origins. Task/runtime
  notifications are automated, not human corrections.
- Codex gives human origin only to a recorded `request_user_input` answer whose
  call was not auto-resolvable. Ordinary user messages and auto-resolvable
  answers have unknown human origin.
- Cursor supplies no native human-origin label. Ordinary user messages and
  typed replies remain unknown authorship; selected AskQuestion options are not
  recorded.

`role=user`, conversational wording, notifications, automatic-control records,
and diagnostics never substitute for native origin evidence.

## Assessment and report

The first pass reconstructs only the selected episode and separates observed
evidence, interpretation, and proposed change. It reports outcome, what worked,
friction, human interventions, runtime limits, and improvement candidates.

Each candidate is classified as `skill defect`, `skill noncompliance`,
`tool/runtime failure`, `documentation gap`, `changed requirement`, or
`no change`. It records frozen anchors or event/source keys and locators,
interpretation, likely cause with uncertainty, owner, smallest useful proposed
change, and proportionate validation. Skill noncompliance requires the
recoverable executed instruction; today's source alone cannot prove it.

Optional user feedback follows the preserved self-assessment. Reports are
inline by default; saving one requires an authorized destination. A valid
result can be `no change`, `proposal ready`, or `accepted follow-up owned
elsewhere`. Applying any proposal belongs to its separately authorized owner.

## Installation and validation

Choose the Session plugin for both `retro` and `export-transcript`, or install
both standalone skills. Installing duplicate forms may expose duplicate host
entries.

Static checks verify source, manifests, generated payloads, links, and the
bundled template. Manual acceptance uses an exact result-bearing capture and a
limited-runtime capture, compares their observed coverage with the seven-state
contract, and confirms frozen-only claims, origins, and runtime gaps. It does
not require every status to appear in synthetic evidence, and it does not prove
fresh provider discovery or live runtime behavior.
