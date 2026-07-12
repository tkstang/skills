# Cursor runtime reference

Use this reference only after resolving the peer as Cursor. Cursor continuation
is documented as a lifecycle mechanism and remains `documented-but-unvalidated`
until a live arm, peer post, follow-up generation, and disarm probe succeeds.

## Observed and continuation behavior

Use the base observer for pinned, stateless review. Buffer Cursor activity until
the top-level `turn_ended` marker: a successful turn yields one completed
response, while aborted, error, and cancelled turns yield diagnostics rather
than provisional peer positions.

If a Stop hook is available, its `followup_message` must carry a
`session_observer_wake` envelope with the lease, peer, and exact completed
record range. Enforce an independent finite loop limit and lease expiry; a
follow-up cannot wake an already-idle conversation. Until live validation,
scheduled polling is the honest operational floor.
