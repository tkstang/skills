# p04 Session Retro manual acceptance

**Product source base:** `f1c2a7a5b3ee2f8e1bba25c645c905f5168e954c`  
**Reviewing native session:** Codex thread
`01a0c095-7354-75d1-b7df-e96ed6c4cc08`, obtained from the explicit
`CODEX_THREAD_ID` runtime metadata key  
**Method:** apply the final canonical Session Retro instructions and report
template to the unchanged frozen pairs. Fixture findings below use only those
frozen files; current source is used separately for contract comparison.

## Frozen evidence

| Runtime     | Narrative                                                                                                          | Activity                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `/tmp/evidence-p04-fixtures/frozen/claude.md` — `023fb3b9f3541ddb929351bb6fdd80f739a919d601b3fd44b44d4169f2e699c5` | `/tmp/evidence-p04-fixtures/frozen/claude.activity.json` — `47f1970f25e82717afebea4dba2d7bf4697d243e45849629bf2e6b766ee2fb87` |
| Cursor      | `/tmp/evidence-p04-fixtures/frozen/cursor.md` — `c5734d39488a3cdf921d06f8c22051417cc54dcfbca13a20c81c22f843549fb3` | `/tmp/evidence-p04-fixtures/frozen/cursor.activity.json` — `58031329289480845561d218211eeec09667d572d918d0d5c74a8ea398ba9a4f` |

The reviewing Codex thread differs from both synthetic native target IDs. Each
Markdown native session and exported timestamp matches its JSON
`nativeSessionId` and `capturedAt`. Claude uses record-native identity evidence;
Cursor uses documented native-path identity.

## Requirement checklist

| Requirement                                | Evidence and disposition                                                                                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Different exact reviewing session          | Pass: reviewer `01a0c095-7354-75d1-b7df-e96ed6c4cc08` differs from Claude `11111111-1111-4111-8111-111111111111` and Cursor `22222222-2222-4222-8222-222222222222`.                                                                                            |
| Full frozen pair before analysis           | Pass: both pairs were written by one exact-session exporter invocation per fixture and hashed before this exercise.                                                                                                                                            |
| Frozen-only fixture claims                 | Pass: no raw/native fixture read contributes to the two reports below.                                                                                                                                                                                         |
| Exact identity and pairing                 | Pass: narrative identity/timestamp matches the envelope; identity evidence is `claude-record-session-id` or `cursor-native-path`.                                                                                                                              |
| Active/unknown-ended title                 | Pass: neither pair proves session end; both examples use **Captured activity review**. Cursor's settled turn is not session completion.                                                                                                                        |
| Contamination limits                       | Pass: no mixed identity or count mismatch is observed; both examples state that detection is not exhaustive.                                                                                                                                                   |
| Observed / interpretation / proposal split | Pass: every improvement candidate uses the final template's three distinct fields.                                                                                                                                                                             |
| Seven exact coverage states                | Pass: canonical skill, template, and guide preserve `available`, `not-recorded`, `not-found`, `not-read`, `unsupported`, `malformed`, `truncated`. This matches `ActivityCoverageStatus` at `src/shared/transcript/activity/types.ts:39-46`.                   |
| Actual coverage union                      | Pass: the two frozen reports observe only `available` and `not-recorded`; no fixture invents the other five states.                                                                                                                                            |
| Honest negative evidence                   | Pass: Cursor `not-recorded` results support no per-call result claim. The reports do not treat unavailable, unread, malformed, or truncated evidence as absence.                                                                                               |
| Human intervention chain                   | Pass: Claude has native-human request and correction but no later recorded recovery activity, so the sequence is partial. The task notification remains automated. Cursor user authorship stays unknown.                                                       |
| Codex origin caveat                        | Pass by current-source comparison: `src/shared/transcript/runtimes.ts:1927-1955` marks only non-auto-resolvable correlated `request_user_input` answers human; ordinary messages at `:2078-2094` and auto-resolvable answers remain unknown.                   |
| Runtime limits                             | Pass: examples preserve Cursor calls-only/no results/no timestamps, separate Codex outcome-stream guidance, and Claude's lack of numeric exit codes.                                                                                                           |
| Skill and usage semantics                  | Pass: Claude caller args remain visible, attachment bodies/paths do not; source names remain separate from event skill evidence. One owned deduplicated usage sample is not presented as cost, total usage, version, or cause. Cursor usage is `not-recorded`. |
| Partial pair versus partial source         | Pass: instructions fail a missing/partially written destination pair but preserve malformed/truncated captured-source counts and coverage.                                                                                                                     |
| Read-only outcome                          | Pass: both reports propose no product mutation and conclude `no change`.                                                                                                                                                                                       |

## Compact example 1: Captured activity review — Claude Code

### Scope and frozen evidence

- **Goal:** inspect the synthetic fixture using `fixture-review` and report only
  captured evidence.
- **Target:** Claude Code `11111111-1111-4111-8111-111111111111`.
- **Reviewing session:** Codex `01a0c095-7354-75d1-b7df-e96ed6c4cc08`.
- **Target state:** unknown-ended.
- **Pairing:** `capturedAt` matches the narrative export timestamp; native ID is
  corroborated at physical line 1, record 0, `/sessionId`.
- **Contamination:** none observed across 10 source/10 decoded records; detection
  is not exhaustive.

### Outcome, what worked, and friction

Two recorded calls have two linked successful results. The Skill caller args,
native attribution/invocation, source skill names, and one owned deduplicated
usage sample are retained. Attachment body/path sentinels are absent.

The frozen pair does not establish session completion. It records a later human
correction and assistant acknowledgement, but no later recovery activity or
outcome. This is a partial intervention sequence.

### Human intervention

| Request                                                     | Activity                                                                                                                                                            | Correction                                                  | Recovery/outcome                                                 | Assessment                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `entry-claude-code-0-0-1`, physical line 1, `origin: human` | Skill key `claude-code:11111111-1111-4111-8111-111111111111:1:/message/content/1`; Read key `claude-code:11111111-1111-4111-8111-111111111111:3:/message/content/0` | `entry-claude-code-8-8-1`, physical line 9, `origin: human` | `entry-claude-code-9-9-1` acknowledges; no later activity result | Partial sequence; no proven recovery |

Notification key
`claude-code:11111111-1111-4111-8111-111111111111:7:/origin/kind`
has `origin: runtime-notification` and is not a human correction.

### Coverage and limits

Calls `available` 2; results `available` 2; items `available` 0; metadata
`available` 4; source-skill-names `available` 3. Claude has no numeric tool exit
code. Available with count zero is reported literally and is not generalized
beyond this captured supported scope.

### Improvement candidate — no change

- **Observed evidence:** exact anchors, event keys, linked results, origins, and
  coverage above.
- **Interpretation:** the frozen pair supports the intended evidence distinctions;
  it does not support a completed-session or recovered-after-correction claim.
- **Likely cause:** no cause is established; the captured narrative ends after
  acknowledgement.
- **Owner:** none.
- **Proposed change:** no change.
- **Validation:** retain the paired hashes and repeat only if exporter behavior
  changes.

**Result:** `no change`.

## Compact example 2: Captured activity review — Cursor

### Scope and frozen evidence

- **Goal:** inspect only recorded synthetic Cursor calls.
- **Target:** Cursor `22222222-2222-4222-8222-222222222222`.
- **Reviewing session:** Codex `01a0c095-7354-75d1-b7df-e96ed6c4cc08`.
- **Target state:** unknown-ended; one turn is settled successfully.
- **Pairing:** `capturedAt` matches the narrative export timestamp; exact identity
  is established by `cursor-native-path`.
- **Contamination:** none observed across 3 source/3 decoded frames; detection is
  not exhaustive.

### Outcome, what worked, and friction

The activity captures a ReadFile call at
`cursor:f1ffe7e551188fe18f4154402b053a052cf2a2194d9b493546398a98da11d211:turn:0:frame:1:block:1`
and a Shell call at the corresponding `block:2`. Both have unknown per-call
outcome. Their enclosing turn outcome is success, which is not a call result.

The direct ReadFile has inferred skill evidence; Shell does not. Results and
usage are `not-recorded`. The supported surface has no timestamps and emits no
separate timestamp coverage row. The ordinary user entry
`entry-cursor-0-2-1` has `origin: unknown`, so no human intervention is proven.

### Coverage and limits

Calls `available` 2; source-skill-names `not-recorded` 0; results
`not-recorded` 0. Usage availability is separately `not-recorded` with no
samples. These limits support no negative claim that the calls lacked effects,
results, or user intent.

### Improvement candidate — no change

- **Observed evidence:** frozen call keys, locators, unknown per-call outcomes,
  unknown user origin, and exact coverage above.
- **Interpretation:** the report preserves the supported Cursor boundary without
  converting turn success into call success or `role=user` into human proof.
- **Likely cause:** Cursor's supported native transcript is calls-only for these
  evidence classes.
- **Owner:** none.
- **Proposed change:** no change.
- **Validation:** retain this limited fixture and verify future reports keep
  unknown authorship and `not-recorded` results unchanged.

**Result:** `no change`.

## Acceptance limits

The examples do not exercise a Codex frozen capture, the five unobserved
coverage states, malformed/truncated input, destination collision/alias failure,
or a proven completed session. Static source checks establish the Codex origin
caveat and seven-state vocabulary; they do not become evidence about either
fixture episode. No provider, global install, new evaluator, runtime harness,
snapshot suite, or prose-equality test was used.
