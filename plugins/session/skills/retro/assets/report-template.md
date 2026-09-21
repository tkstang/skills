# <Session retrospective | Captured activity review>

Use **Captured activity review** when the target was active at capture time or
its ending is unknown.

## Scope and frozen evidence

- **Scope:** `<skill invocation or bounded session episode>`
- **Goal:** `<intended outcome>`
- **Target:** `<runtime and exact native session identity>`
- **Reviewing session:** `<different native session identity and evidence>`
- **Target state at capture:** `<completed | active | unknown-ended>`
- **Frozen narrative:** `<path and hash>`
- **Frozen activity:** `<path and hash>`
- **Capture pairing:** `<matching identity, captured timestamp, and identity evidence>`
- **Evidence cutoff:** `<captured range or artifact boundary>`
- **Contamination signals:** `<none observed or exact evidence; detection is not exhaustive>`
- **Coverage gaps:** `<identity, malformed/truncated range, unread reference, unsupported data, or other limits>`

## Outcome

`<recorded outcome and what remains unknown>`

## What worked

`<effective behavior supported by narrative anchors or activity keys and locators>`

## Friction

`<recorded retries, failures, corrections, delays, or ambiguity>`

## Human interventions

| Request evidence     | Activity evidence                | Native-human correction           | Recovery/outcome                         | Assessment                                                       |
| -------------------- | -------------------------------- | --------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `<narrative anchor>` | `<event/source key and locator>` | `<anchor and origin, or unknown>` | `<anchor/event and locator, or missing>` | `<proven intervention, partial sequence, or unknown authorship>` |

Automated notifications, automatic-control records, diagnostics, and
`role=user` without native origin proof are not human corrections.

## Coverage and runtime limits

Preserve the exact status vocabulary from the activity artifact: `available`,
`not-recorded`, `not-found`, `not-read`, `unsupported`, `malformed`, and
`truncated`.

| Data class              | Status              |  Captured | Locator                      | What it permits            |
| ----------------------- | ------------------- | --------: | ---------------------------- | -------------------------- |
| `<recorded data class>` | `<recorded status>` | `<count>` | `<recorded locator or none>` | `<bounded interpretation>` |

- **Runtime limits:** `<applicable Cursor, Codex, or Claude limits>`
- **Usage ownership:** `<owned, inherited, or unknown samples/reset segments and limits>`
- **Absence-proof basis:** `<reliable native recording plus adequate frozen coverage, or no negative claim>`

## Self-assessment first

### Observed episode

`<goal, actions, results, corrections, completion evidence, and locators>`

### Assessment

`<what worked, what did not, and what remains unknown>`

## Feedback-guided revision

`<Omit when no feedback was supplied. Preserve the first assessment and state what changed.>`

## Improvement candidates

### `<short title>` — `<classification>`

- **Observed evidence:** `<frozen anchor/event/source key and locator>`
- **Interpretation:** `<bounded meaning and uncertainty>`
- **Likely cause:** `<hypothesis, explicitly qualified>`
- **Owner:** `<skill, tool, documentation, repository, or user decision owner>`
- **Proposed change:** `<smallest useful proposal, or “no change”>`
- **Validation:** `<specific proportional check>`

## Result

`<no change | proposal ready | accepted follow-up owned elsewhere>`
