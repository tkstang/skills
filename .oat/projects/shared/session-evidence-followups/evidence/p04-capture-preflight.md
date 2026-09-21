# p04 frozen-capture acceptance preflight

**Status:** preparation complete; p04 implementation and acceptance remain pending  
**Repository HEAD:** `72bbc1c6f7866d1a8f451c0083fa484f04c0782e`  
**Repository state:** clean before capture; this work wrote only the authorized `/tmp` artifacts  
**Provider calls:** none

## Export contract and commands

The generated CLI help at this HEAD exposes `--runtime`, `--session`,
`--activity-output`, `--cwd`, and `--out`. It says activity output is complete,
sensitive JSON for one exact `--session`; exit codes are 0 success, 1 hard
error, 2 no candidates, and 3 ambiguous.

The fixture home was isolated inside each Node process by
`SESSION_EVIDENCE_FIXTURE_ROOT` and
`/tmp/evidence-p04-fixtures/homedir-preload.mjs`. `HOME` and `CODEX_HOME` were
not changed.

```sh
SESSION_EVIDENCE_FIXTURE_ROOT=/tmp/evidence-p04-fixtures/native-home \
  node --import /tmp/evidence-p04-fixtures/homedir-preload.mjs \
  skills/session-export-transcript/scripts/session-export-transcript.mjs \
  --runtime claude-code --cwd /fixture/project \
  --session 11111111-1111-4111-8111-111111111111 \
  --out /tmp/evidence-p04-fixtures/frozen/claude.md \
  --activity-output /tmp/evidence-p04-fixtures/frozen/claude.activity.json

SESSION_EVIDENCE_FIXTURE_ROOT=/tmp/evidence-p04-fixtures/native-home \
  node --import /tmp/evidence-p04-fixtures/homedir-preload.mjs \
  skills/session-export-transcript/scripts/session-export-transcript.mjs \
  --runtime cursor --cwd /fixture/project \
  --session 22222222-2222-4222-8222-222222222222 \
  --out /tmp/evidence-p04-fixtures/frozen/cursor.md \
  --activity-output /tmp/evidence-p04-fixtures/frozen/cursor.activity.json
```

Both commands exited 0 and reported both destinations. No export was rerun
after analysis began.

## Frozen artifact inventory

| Artifact | SHA-256 | Size/mode |
| --- | --- | --- |
| `/tmp/evidence-p04-fixtures/frozen/claude.md` | `023fb3b9f3541ddb929351bb6fdd80f739a919d601b3fd44b44d4169f2e699c5` | 2,305 bytes, regular `0644` |
| `/tmp/evidence-p04-fixtures/frozen/claude.activity.json` | `47f1970f25e82717afebea4dba2d7bf4697d243e45849629bf2e6b766ee2fb87` | 11,895 bytes, regular `0600` |
| `/tmp/evidence-p04-fixtures/frozen/cursor.md` | `c5734d39488a3cdf921d06f8c22051417cc54dcfbca13a20c81c22f843549fb3` | 1,737 bytes, regular `0644` |
| `/tmp/evidence-p04-fixtures/frozen/cursor.activity.json` | `58031329289480845561d218211eeec09667d572d918d0d5c74a8ea398ba9a4f` | 5,931 bytes, regular `0600` |

Each Markdown `Exported` value exactly matches its JSON `capturedAt`, and each
Markdown native-session value matches the envelope `nativeSessionId`.

The observed envelope is `formatVersion: 1`, `activitySchemaVersion: 1`, and
`sensitive: not-publish-safe`. Its top-level fields are `formatVersion`,
`activitySchemaVersion`, `sensitive`, `runtime`, `nativeSessionId`, `capturedAt`,
`identityEvidence`, `recordCounts`, `narrativeEntries`, and `activity`.

## Findings from frozen files only

No raw fixture/source transcript was read after freezing for these findings.

### Claude Code

- Identity is corroborated by `claude-record-session-id` at physical line 1,
  record 0, `/sessionId`; source and decoded counts are both 10.
- The narrative has two user entries with `origin: human`. The automated task
  record appears separately as an activity `notification` with
  `origin: runtime-notification`; it is not a human correction.
- Two calls have two linked successful results through native call IDs and
  `relatedCallKey`: the Skill call/result and Read call/result.
- Native skill attribution/invocation and source skill names are retained. The
  caller argument `SYNTHETIC_CALLER_ARGS_MUST_REMAIN_VISIBLE` remains in the
  Skill call input preview.
- Attachment body/path sentinels do not occur in either frozen Claude artifact.
- Repeated usage for `fixture-api-message-1` yields one owned Claude-message
  sample with no usage diagnostic. This supports deduplication only, not cost,
  version, intent, effectiveness, or causality.
- The frozen sequence shows a human request, relevant activity, a later
  recorded-human correction, and an assistant acknowledgement. It has no later
  recorded recovery activity or authoritative session-end record, so this is a
  partial intervention sequence and the future report title should be
  **Captured activity review**.

### Cursor

- Identity is `cursor-native-path` for exact native ID
  `22222222-2222-4222-8222-222222222222`; source and decoded counts are both 3.
- The ordinary user narrative entry has `origin: unknown`.
- Two calls are available. Each has unknown per-call outcome, while the enclosing
  turn is settled with `turnOutcome: success`; no call result may be inferred.
- Results are explicitly `not-recorded`. Usage availability is also
  `not-recorded`, with no samples or diagnostics.
- The direct `ReadFile` supplies inferred file-read skill evidence. The Shell
  event supplies none.
- The supported Cursor surface has no timestamps, but this envelope does not
  emit a separate timestamp coverage row. A p04 report may state the documented
  runtime limitation and must not invent such a row or chronology.
- A settled turn is not proof that the native session ended. Use **Captured
  activity review** unless other frozen ending evidence exists.

## Coverage comparison

The actual union across both frozen `activity.coverage` arrays is:

```text
available
not-recorded
```

The committed `ActivityCoverageStatus` union at
`src/shared/transcript/activity/types.ts:39-46` contains all seven exact states:
`available`, `not-recorded`, `not-found`, `not-read`, `unsupported`, `malformed`,
and `truncated`. These fixtures exercise two states. The other five remain valid
and must not be collapsed, renamed, or represented as tested by this preflight.
No negative claim follows from `not-recorded`.

## Codex origin caveat from committed source

The two fixtures do not include Codex. Current committed normalization provides
the required p04 rule:

- `src/shared/transcript/runtimes.ts:1927-1955` assigns `origin: human` to a
  correlated `request_user_input` answer only when its call is not
  auto-resolvable.
- `src/shared/transcript/runtimes.ts:1972-2008` recognizes positive
  `autoResolutionMs`; `src/shared/transcript/runtimes.ts:2035-2059` records the
  timer caveat on the question.
- `src/shared/transcript/runtimes.ts:2078-2094` normalizes ordinary Codex user
  messages without native human-origin attribution.

Therefore only a non-auto-resolvable recorded AskUser answer may be treated as
native-human evidence. Ordinary Codex user messages and auto-resolvable answers
remain unknown-origin for a retrospective.

## Preparation artifacts and remaining gaps

- Reconciled draft: `/tmp/evidence-p04-retro-draft.md`, now records the actual
  CLI/envelope and distinguishes a partially captured native source from a
  partially written destination pair.
- Updated checklist: `/tmp/evidence-p04-fixture-checklist.md`, now distinguishes
  Cursor's explicit usage availability from its absent timestamp coverage row.
- No p03 defect was observed in this bounded capture. Identity, destination,
  pairing, provenance, redaction, result correlation, and usage-dedup checks
  passed.
- Remaining acceptance gaps: no Codex frozen fixture; five coverage states are
  unexercised; no malformed/truncated capture, collision, alias, overwrite, or
  destination-failure scenario was run; different-reviewing-session identity
  and a complete session ending are not established; p04 source, template,
  guide, packaging, version, build, and final manual report remain unimplemented.
