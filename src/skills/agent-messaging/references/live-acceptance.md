# Host delivery acceptance

This page separates source and fixture evidence from live provider acceptance.
No row below is marked installed, trusted, invoked, or recipient-observed without
an operator-authorized receipt from that exact host, version, session, and
worktree.

## Acceptance matrix

| Host / boundary                  | Documented        | Fixture-tested | Installed  | Trusted    | Invoked    | Recipient context observed | Continuation observed | Cleanup verified |
| -------------------------------- | ----------------- | -------------- | ---------- | ---------- | ---------- | -------------------------- | --------------------- | ---------------- |
| Codex prompt start               | yes               | yes            | unverified | unverified | unverified | unverified                 | n/a                   | unverified       |
| Codex Stop                       | yes               | yes            | unverified | unverified | unverified | unverified                 | unverified            | unverified       |
| Codex composed observer Stop     | yes               | yes            | unverified | unverified | unverified | unverified                 | unverified            | unverified       |
| Codex finite watch               | yes               | yes            | unverified | unverified | unverified | unverified                 | n/a                   | unverified       |
| Codex human-origin renewal       | yes               | fixture only   | unverified | unverified | unverified | unverified                 | n/a                   | unverified       |
| Claude Code prompt start         | yes               | yes            | unverified | unverified | unverified | unverified                 | n/a                   | unverified       |
| Claude Code Stop                 | yes               | yes            | unverified | unverified | unverified | unverified                 | unverified            | unverified       |
| Claude Code finite watch         | yes               | yes            | unverified | unverified | unverified | unverified                 | n/a                   | unverified       |
| Claude composed observer Monitor | pending p04-t01   | unsupported    | unverified | unverified | unverified | unverified                 | unverified            | unverified       |
| Claude Code human-origin renewal | yes               | fixture only   | unverified | unverified | unverified | unverified                 | n/a                   | unverified       |
| Cursor start / Stop / idle       | bounded plan only | unsupported    | unverified | unverified | unverified | unverified                 | unverified            | unverified       |

All automatic rows therefore remain manual fallback. A generated payload or a
passing fixture is not an installed hook, host trust decision, invocation, or
recipient-context receipt.

## Explicit probe plan

Generate a non-executing, bounded plan only after naming the exact surface and
event provenance:

```bash
node <skill-dir>/scripts/agent-messaging.mjs delivery probe-plan \
  --probe-opt-in --collab <uuid> --self codex:<exact-session> \
  --probe-id <id> --host-version <exact-version> \
  --surface '<documented surface>' \
  --command '["/absolute/provider","arg"]' \
  --boundary stop-continuation \
  --event-provenance '<native event identity source>' \
  --timeout-ms 30000 --max-events 1 --max-attempts 1
```

The shipped command emits a fixture-only plan and does not invoke a provider.
A live executor must separately record all five approvals: exact host/session,
hook or trust changes, quota budget, timeout, and cleanup. Before a continuation
probe, it must also re-run the ownership truth table: readable inventory, exact
third-party fingerprint acknowledgment, and either no active or uncertain
observer owner or one exact verified composed observer owner. The acting-session
Claude Monitor attestation remains mandatory where applicable. Codex composed
Stop is fixture-tested but remains live unverified. Claude composed Monitor
belongs to p04-t01 and currently reports `composed-monitor-unavailable`.

Receipts contain only the probe/host/version/boundary, bounded event identity and
provenance, observation timestamp, explicit observed booleans, outcome, and a
small error code. Prompts, bodies, environment, credentials, and raw errors are
not receipt fields. Timeout or interruption is `unknown`, never support proof.
Cleanup receives only resources returned as owned by that probe.

## Activity-receipt validation benchmark

The benchmark validates the exact 4,096 immutable human-activity receipts twice
through `activationStatus`; it does not coalesce or approximate idle semantics.

- Recorded: 2026-09-19T17:05:57Z
- Machine: Darwin arm64, Apple M4
- Node: v25.9.0
- Receipt count: 4,096
- Cold validation: 326.84 ms
- Warm validation: 318.21 ms
- Host-timeout comparison: both readings are below the 60,000 ms adapter ceiling;
  measured headroom was 59,673.16 ms cold and 59,681.79 ms warm.

These local filesystem timings are bounded engineering evidence, not a promise
for every machine or proof that a provider hook will grant that much runtime.
