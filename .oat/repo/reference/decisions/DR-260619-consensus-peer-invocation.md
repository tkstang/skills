---
id: DR-260619-consensus-peer-invocation
title: Consensus peer invocation owned by provider CLI
date: 2026-06-19
status: Accepted.
legacy_id: DR-023
---

### DR-023: Consensus peer invocation owned by provider CLI

- **Date:** 2026-06-19
**Context:** The consensus plugin only needs a narrow per-turn peer-run boundary: provider inventory, readiness checks, prompt delivery, structured verdict extraction, retry/cap/timeout behavior, and provider-neutral diagnostics. The prior external peer-run dependency added install drift and made the live Refine/Evaluate surface harder to reason about. The `consensus-peer-invocation` discovery, synthesized research, design, implementation, and final review confirmed that this repository can own the narrower Claude/Codex/Cursor path while keeping shipped plugin code dependency-free.
**Decision:** Consensus now ships a generated `consensus` provider CLI at `plugins/consensus/scripts/consensus.mjs`, backed by canonical TypeScript under `src/consensus/provider-cli/`. The CLI owns `provider ls`, `preflight`, and `run`; provider-neutral envelopes and errors; structured-output strategy selection; runtime policy validation; host recursion guard; bounded probes and subprocesses; schema delivery; redacted diagnostics; and provider-tier retry/cap/timeout behavior. Claude receives inline JSON schema, Codex uses output-schema plus last-message extraction, and Cursor remains prompt-only with local validation/retry. Refine and Evaluate default to this CLI for new runs. Historical `.oat` artifacts remain untouched, and maintained source/runtime/docs/tests do not keep old compatibility aliases.
**Rationale:** Owning the peer-invocation boundary removes a runtime prerequisite, aligns the implementation with the Stoa/provider-adapter evidence gathered during research, keeps the published plugin on Node standard library plus generated runtime outputs, and gives the consensus loop direct control over its failure taxonomy, security posture, and retry ownership. Cursor submit-tool support remains deferred as future hardening, and authenticated Cursor-as-peer verification remains open until local keychain/auth state allows a live run.
- **Status:** Accepted.
