# Domain evidence and review red flags

Read this reference only when a complexity review contains one of the mechanism
categories below or the review reasoning shows one of the listed drift patterns.
Use it to calibrate the ledger; do not reproduce the tables in the report.

## Evidence thresholds

| Category                        | Evidence that earns `Keep`                                                                                                                           | Not evidence                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Schema for a skill or prompt    | A downstream consumer parses it; models repeatedly omit or misread fields; several renderers share it; validation caught a real failure              | “Clean architecture”; a possible future consumer              |
| Script or harness               | The operation runs often; manual execution is error-prone; reproducibility matters; it removes a measured burden                                     | The task could be automated; behavior has not stabilized      |
| Tests and fixtures              | A regression occurred or would be costly; the assertion is a stable contract; failures score objectively; coverage enables otherwise risky iteration | Code exists, therefore tests; snapshots of incidental details |
| Eval system                     | A defined decision the eval informs; representative fixtures exist; scoring separates meaningful differences; results affect routing or release      | Nobody has defined what “good” means                          |
| Multiple agents or verification | A single pass misses a named evidence class; verification measurably reduces false claims; fan-out beats one stronger model at comparable cost       | “More agents should be more robust”                           |
| Generalized abstraction         | Two real implementations share it; near-term consumers have materially different needs; duplication causes defects; total complexity goes down       | A hypothetical second use case; a sibling has one             |
| Process ceremony                | A decision was contested; review found something the author could not; a phase gate blocked a real defect                                            | A template has a slot; the lifecycle always does it           |

## Drift checks

If any thought below drives the review, return to the originating contract and apply
the deletion test again.

| Thought                                                 | Correction                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| “Proceed, with corrections”                             | A verdict before the ledger is a guess. Build the ledger first.                                                       |
| “This part is fine as-is”                               | Internal correctness is not the bar. Identify the contract line and evidence it serves.                               |
| “Every sibling does it this way”                        | Consistency is claimed value, not evidence. Siblings can be over-built too.                                           |
| “Mechanical enforcement is safer”                       | Name the failure, threat, hard requirement, or irreversible boundary it addresses; otherwise defer it with a trigger. |
| “We will probably need this later”                      | Classify it as `Defer` and name an observable trigger.                                                                |
| “It has not failed yet, so delete it”                   | Hard requirements, credible threat models, and irreversible interfaces may justify machinery before a failure.        |
| “It is already built, so removing it wastes work”       | Sunk cost is irrelevant. Put removal cost in Risks and compare forward ownership cost.                                |
| “The plan justifies it”                                 | A plan cannot justify its own machinery. Return to the request or other independent contract source.                  |
| “The plan is much larger than the artifact, so fail it” | Volume is a signal. Trace material ownership cost to the contract before deciding.                                    |
