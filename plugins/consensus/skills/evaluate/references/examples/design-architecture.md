# Design and Architecture Review Rubric

Use when evaluating architecture decision records (ADRs), system design documents, RFCs, or technical proposals.

> **Authoring note:** The 12 headings below are the machine-parsed criteria. The wrapper extracts `##`–`######` headings and `-`/`*` bullets, dedupes, and caps at 12. Scoring scales and guidance paragraphs are peer-facing only.

---

## Problem Statement

The problem being solved is clearly defined. Success looks different from the status quo in a verifiable way.

_Weight: high. A weak problem statement undermines every downstream criterion._

## Decision Rationale

The proposed approach is justified. The document explains why this option was chosen over realistic alternatives.

_Weight: high._

## Alternatives Considered

Credible alternatives are described with their trade-offs. The rejected options section is not a strawman list.

_Weight: high._

## Constraints and Assumptions

Explicit assumptions and constraints are stated. The reader can assess how sensitive the design is to those assumptions changing.

_Weight: medium._

## Scalability and Performance

The design handles the expected load and growth trajectory. Bottlenecks are identified and addressed or explicitly accepted.

_Weight: medium._

## Security and Compliance

Threat surface, trust boundaries, and data sensitivity are addressed. Regulatory or compliance requirements are identified where applicable.

_Weight: medium._

## Operability

The system can be deployed, monitored, debugged, and rolled back. On-call burden is considered.

_Weight: medium._

## Incremental Delivery

The design can be delivered in stages. A first milestone that delivers value with reduced risk is identifiable.

_Weight: medium._

## Dependencies and Coupling

External service dependencies and inter-component coupling are minimized or explicitly justified. Integration contracts are defined.

_Weight: low._

## Open Questions

Unresolved issues are clearly listed. Each open question has a stated owner or resolution path.

_Weight: low._

---

**How to adapt this rubric**

1. For an ADR evaluating a specific technology choice, weight Decision Rationale and Alternatives Considered most heavily.
2. For a system design covering a user-facing product, add a User Experience Impact criterion.
3. For infrastructure or platform designs, raise Operability and Scalability to high weight.
4. Keep the total at 12 or fewer headings/bullets — the wrapper silently drops criteria beyond the first 12 it finds.
