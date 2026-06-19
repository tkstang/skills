# Code Review Rubric

Use when evaluating a pull request description, code diff summary, or implementation proposal. Adapt criteria to the language and project conventions.

> **Authoring note:** The 12 headings below are the machine-parsed criteria. The wrapper extracts `##`–`######` headings and `-`/`*` bullets, dedupes, and caps at 12. Scoring scales, examples, and guidance paragraphs are peer-facing only.

---

## Correctness

The implementation does what it claims. Logic is sound and handles the expected inputs and edge cases.

_Pass/fail criterion. A failing score here blocks acceptance regardless of other criteria._

## Test Coverage

Appropriate tests are added or updated. Tests verify behavior, not just that functions execute without error.

_Weight: high. A change without tests requires explicit justification._

## Scope and Focus

The change does one coherent thing. Unrelated refactors, style fixes, or features are not bundled in.

_Weight: high._

## Security and Safety

No new injection vectors, secrets in code, unsafe deserialization, or path traversal vulnerabilities introduced.

_Weight: high. Flag any concern, however speculative._

## Error Handling

Failures are caught, reported, or propagated in a way consistent with the codebase's conventions. Callers are not left to guess.

_Weight: medium._

## Readability

The code is understandable without running it. Variable names, function names, and structure communicate intent.

_Weight: medium._

## Performance

No obvious performance regressions. Algorithmic complexity is appropriate for the scale and usage pattern.

_Weight: medium._

## Backwards Compatibility

Public APIs, serialized formats, and observable behaviors are not changed in breaking ways without explicit versioning.

_Weight: medium._

## Documentation

Public functions, modules, or APIs carry accurate doc comments. Relevant README or runbook changes are included.

_Weight: low._

## Conventions

The code follows project style: naming, file structure, import conventions, and lint rules.

_Weight: low._

---

## How to adapt this rubric

1. Remove criteria irrelevant to the PR type (e.g., omit Backwards Compatibility for a pure internal refactor).
2. Add project-specific criteria such as migration safety, feature-flag discipline, or observability requirements.
3. Adjust pass/fail vs. weighted scoring to match your team's review norms.
4. Keep the total at 12 or fewer headings/bullets — the most important criteria should be headings.
