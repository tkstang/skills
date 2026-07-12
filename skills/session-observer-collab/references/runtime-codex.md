# Codex runtime reference

Use this reference only after resolving the peer as Codex. It describes the
runtime boundary for a bounded lifecycle continuation; lease control and hook
implementation are supplied by the collaboration skill's future control
surface and must consume normalized base-observer output.

## Wake posture

Treat Codex continuation as `lifecycle-continuation` only after exact-command
trust and effective hook execution are verified in the acting session. A
bounded wait may select one latest completed substantive peer range and emit a
machine-readable `session_observer_wake` envelope. A timeout becomes idle;
missing, malformed, expired, or mismatched state fails closed.

Keep continuation count, expiry, and the default short catch window finite.
User steering wins over automatic continuation. Preserve unrelated hooks and
make disarm deterministic; never treat a missing configuration field as proof
that a hook is enabled.
