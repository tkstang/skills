# Claude Code delivery boundary

## Capability labels

The bundled `scripts/hooks/claude-code.mjs` adapter and generated session hook
declaration are fixture-tested only. Presence does not prove installation,
permission, invocation, recipient context, continuation, Monitor wake, or
cleanup. A later finite foreground watch is a notification source, not a daemon.

## Bounded inventory

Inventory is limited to the loaded user, project, local, and managed settings
files supplied by the acting environment plus hook declarations from enabled
plugins resolved to their installed versions. Disabled plugins and
marketplace/catalog-only copies are ignored. Missing optional files are empty;
unreadable configured files and unresolved enabled plugins refuse automatic
delivery.

Session-scoped skill/agent frontmatter hooks are not enumerable from those
files. This is disclosed as a visibility limit, not mislabeled as complete host
enumeration or an unreadable-file error. The acting session must not arm a known
competing observer through that excluded scope.

## Monitor ownership attestation

The CLI cannot enumerate in-session Monitors. Standalone Claude enablement
therefore requires `--confirm-no-observer-monitor` from the exact acting session.
The immutable activation records its pin and epoch. This is an attestation, not
host proof. Lost context remains manual. Every finite watch start/re-arm requires
fresh confirmation without changing the epoch or replenishing its budget.

## Boundary contract

Exact session ID, absolute cwd, stable event identity, activation, and ownership
are revalidated before output. Missing/uncertain identity, changed inventory,
observer ownership, interruption, continuation markers, or expiry emit nothing.
Human-idle renewal requires a trustworthy human event identity; automatic turns,
peer messages, replays, and notifications never renew.

Prompt context and Stop output use the same 6,000-character attributed,
untrusted envelope as Codex. Oversized bodies become exact full-read commands.
Errors cannot block a human prompt or create a Stop loop. Fixture evidence is
not live acceptance; `live-acceptance.md` owns separately authorized receipts.
