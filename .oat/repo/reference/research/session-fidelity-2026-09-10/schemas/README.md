# Schema bundle

## Native observational schemas

`native/*.schema.json` uses JSON Schema Draft 2020-12 and documents the known field carriers observed in the pinned readers and declarations. Unknown properties are allowed. Many fields are intentionally optional because metadata records, client versions, and storage surfaces differ.

A successful validation means only that an example fits the modeled subset. It does not mean all data is present, all fields have been interpreted, or the record belongs to the active branch. Never drop an unknown record solely because it does not match a familiar branch.

JSONL examples here are individual decoded records stored as `.json` so they can be validated directly. Whole-session arrays/objects and decoded SQLite parts are explicitly identified in their descriptions. SQLite row examples are exported JSON representations, not database files. Kiro's opaque ordinary CLI SQLite and Antigravity IDE's opaque protobuf are documented gaps, not guessed schemas.

Every known modeled field has an inline description and the provider guides expand its meaning. The [catalog](catalog.json) joins each schema, its synthetic example, its provider guide, and its pinned source evidence.

## Proposed activity schema

`proposed/activity-report.schema.json` is an authored design contract, not a provider's native format. It makes output omissions, raw-source references, correlation, and availability explicit. The companion [TypeScript contract](../design/activity-contract.ts) is a starting point for implementation, not installed code.

## Validation

The [local validation report](../validation/REPORT.md) states which checks were actually run. No example is a captured private session. Schema/example checks are not upstream parser tests or live CLI compatibility tests.
