---
id: BL-260619-shared-session-log-substrate
title: Stateless multi-session activity merge
status: open
priority: medium
scope: initiative
scope_estimate: L
labels:
  - multi-agent
  - substrate
  - session-observer
  - foundation
assignee: null
created: 2026-06-19T23:57:18Z
updated: 2026-09-16T18:06:09Z
associated_issues: []
legacy_id: bl-4e2e
---

## Description

An on-demand merged activity view over multiple exact session pins. Retains the
original backlog ID and vault lineage, but replaces the daemon-first proposal
with a stateless projection over the session-fidelity contract.

**Vault source notes:**

- `02 - Projects/Skills/Ideas/2026-06-19-multi-agent-collaboration-substrate-index.md` (MOC + build order)
- `02 - Projects/Skills/Ideas/2026-06-19-shared-session-log-substrate.md` (this item's design)
- `02 - Projects/Skills/Research/2026-06-19-cass-cross-provider-session-tooling.md` (prior-art assessment)

**Relationship to shipped work:** reuse session discovery, exact identity, and
the activity contract from **BL-260916-session-fidelity-opt — Session fidelity:
opt-in --include-activity for observer and exporter**. Do not create another
provider parser or own stateful consumer cursors. A merged view does not solve
**BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2
collaboration mesh**.

**Design gate:** assess `cass` as prior art, output bounds and missing-source
semantics, deterministic ordering, and packaging through the current declared
distribution model. The June daemon/registration/lifecycle design is historical
input, not an implementation requirement.

**Design update (2026-09-16, Fable + Astra):** the first merged view is a **stateless multi-pin merge** over exact pins (e.g. `session-observer merge --session a --session b`), retaining source provenance and deterministic tie-breaking, and not implying that cross-machine timestamps establish causal order. No become-observable daemon or registration in v1; add one only if a real workflow shows stateless merging is insufficient. The merged log should be a projection over the session-fidelity activity contract (BL-260916-session-fidelity-opt) rather than a bespoke noise filter, so this sequences after fidelity. It shares the identity convention with inbox messaging (BL-260619-inter-agent-direct-messaging) but neither depends on the other.

## Acceptance Criteria

- A design pass records (DR) the adopt-vs-build decision on `cass` and packaging through the declared observer distributions, and confirms the merged log is a projection over **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**, not a bespoke noise filter.
- `session-observer merge --session <runtime:id> ...` produces one timestamp-ordered view over two or more exact pins, statelessly: no registration, no daemon, no heartbeat or crash cleanup. Each rendered record keeps its source pin and record/frame index; ties are broken deterministically; the output states that ordering is by recorded timestamp and does not establish causal order across machines.
- The merge reuses the existing identity (`whoami`) and per-pin offset conventions and never takes ownership of another observer's stateful cursor.
- The shared project-scoped state directory and the identity/alias convention are defined as primitives that BL-260619-inter-agent-direct-messaging also uses; neither item depends on the other.
- A daemon is explicitly deferred; the item records the trigger that would justify one (a measured workflow where stateless merging over pinned transcripts is too slow or incomplete).
