---
id: DR-260502-normalized-hash-convergence
title: Normalized-hash convergence with ACCEPT-twice-same-hash guard; versioned
  verdicts with post-receive byte caps
date: 2026-05-02
status: Accepted.
legacy_id: DR-004
---

### DR-004: Normalized-hash convergence with ACCEPT-twice-same-hash guard; versioned verdicts with post-receive byte caps

- **Date:** 2026-05-02
**Context:** Convergence detection must tolerate whitespace/line-ending variation without false positives, and peer-emitted JSON verdicts must be forward-compatible and bounded.
**Decision:** Convergence requires normalized hash equality (strip trailing whitespace per line, normalize line endings to `\n`, collapse trailing newlines); ACCEPT-twice convergence additionally requires both ACCEPTs to be against the same normalized hash, not different states. Verdicts carry explicit `schema_version: "v0"`. After Paseo's structural validation, the wrapper enforces UTF-8 byte caps (reasoning ≤ 16 KB, proposed_artifact ≤ 256 KB, concerns ≤ 4 KB × 20, total ≤ 512 KB); oversized verdicts are recorded as metadata-only `OVERSIZE_REJECTED` and the section aborts as error.
**Rationale:** Normalization prevents whitespace-variant artifacts from blocking convergence; the same-hash guard prevents two agents "agreeing" on different versions. Explicit schema versioning lets resume detect incompatibility and fail closed. Byte caps defend against runaway or malicious peer output while preserving an auditable rejection record.
- **Status:** Accepted.
