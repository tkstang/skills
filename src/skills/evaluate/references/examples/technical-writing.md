# Technical Writing Rubric

Use when evaluating technical documentation, API reference, runbooks, tutorials, or developer guides.

> **Authoring note:** The headings below are the machine-parsed criteria. The wrapper extracts `##`–`######` headings and `-`/`*` bullets, dedupes, and caps at 12. Scoring scales and guidance paragraphs are peer-facing only.

---

## Accuracy

Technical content is correct. Commands, code samples, API signatures, and parameter descriptions match the actual implementation.

_Weight: high. Inaccurate documentation is worse than no documentation._

## Completeness

The document covers what a reader needs to accomplish the stated goal. Prerequisites, configuration, and common failure modes are not silently omitted.

_Weight: high._

## Clarity

Instructions are unambiguous. A reader following the steps literally should reach the expected outcome.

_Weight: high._

## Task Orientation

The document is organized around what the reader wants to accomplish, not around how the system is internally structured.

_Weight: medium._

## Code Sample Quality

Code examples are self-contained, runnable (or clearly annotated when not), and consistent with the prose around them.

_Weight: medium._

## Error Guidance

The document explains what to do when things go wrong: common errors, diagnostics, and remediation steps.

_Weight: medium._

## Audience Calibration

Assumed knowledge level is stated or implied and is consistent throughout. Jargon is explained or linked on first use.

_Weight: medium._

## Structure and Navigation

The document uses headings, numbered steps, and summaries to let the reader scan, jump to relevant sections, and understand progress.

_Weight: low._

## Freshness

The document does not contain stale version references, deprecated flags, or outdated screenshots that would mislead a reader today.

_Weight: low._

## Consistency

Terminology, casing, and formatting are consistent throughout. The document follows the project's style guide where one exists.

_Weight: low._

---

**How to adapt this rubric**

1. For API reference, weight Accuracy and Code Sample Quality highest.
2. For tutorials, weight Task Orientation and Error Guidance highest.
3. For runbooks, add an Operational Safety criterion (does following this runbook create risk?).
4. Keep the total at 12 or fewer headings/bullets — prioritize the criteria that matter most for your doc type.
