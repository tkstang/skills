# Claude Code delivery boundary

## Capability labels

The bundled `scripts/hooks/claude-code.mjs` adapter, generated session hook
declaration, and finite foreground watch are fixture-tested only. Presence does
not prove installation, permission, invocation, recipient context,
continuation, Monitor wake, or cleanup. The watch is a request-only notification
source, not a daemon or proof of native async wake support.

## Bounded inventory

Inventory is limited to the loaded user, project, local, and managed settings
files supplied by the acting environment plus hook declarations from enabled
plugins resolved to their installed versions. Disabled plugins and
marketplace/catalog-only copies are ignored. Missing optional files are empty;
unreadable configured files and unresolved enabled plugins refuse automatic
delivery.

Without flags, `delivery inspect` and `delivery enable` resolve the user
`~/.claude/settings.json`, project `.claude/settings.json`, project-local
`.claude/settings.local.json`, and the platform managed-settings path. At least
one settings source must exist. The immutable activation stores the exact
resolved paths and installed-plugin roots; hooks, watch, registration, and the
composed Monitor re-inspect that same set rather than accepting later
environment drift.

Use `--settings-paths <path-list>` to replace the standard settings list and
`--installed-plugins '<json-name-to-absolute-root-map>'` when the acting host
can enumerate enabled plugin installations. The environment equivalents are
`AGENT_MESSAGING_CLAUDE_SETTINGS` and
`AGENT_MESSAGING_CLAUDE_PLUGINS`. An enabled plugin without a resolved installed
root refuses automatic delivery; marketplace/catalog data is never inferred as
an installation.

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
The watch also rechecks inventory and ownership before each output, lasts no
more than 30 minutes or the activation expiry, and never self-rearms.

## Composed observer Monitor

Observer composition uses
`<observer-collab-skill>/scripts/claude-monitor.mjs`, not the standalone watch
and not the base observer's `catch-up-then-watch`. Initial arm names an explicit
activation UUID, exact self and peer pins, transcript, cwd and private cursor.
The acting session confirms that the legacy observer Monitor and standalone
messaging watcher are stopped; every foreground run repeats those confirmations.

Enable that exact UUID with controller `observer-collab` and mechanism
`monitor`. The command polls requests first. With no request, it reads a
candidate range without changing public observer offsets, reserves an immutable
event and shared slot, then applies the private-cursor CAS. A CAS loser emits
nothing. Each run emits at most one bounded ID/range notification and exits no
later than 30 minutes, activation expiry, or observer-lease expiry. Re-arm keeps
the same activation, peer, cursor, expiry and spent slots; it never self-rearms.

An observation claim is not a message and has no `delivery retry --message`
path. Status reports a recorded pre-slot interruption only when proven;
otherwise the outcome is unknown. Recovery is a normal explicit observer read
of the pinned range, which may advance public state but never clears claims,
changes the private Monitor cursor, or refunds slots.

## Boundary contract

Exact session ID, absolute cwd, stable event identity, activation, and ownership
are revalidated before output. Missing/uncertain identity, changed inventory,
observer ownership, interruption, continuation markers, or expiry emit nothing.
Human-idle renewal requires a trustworthy human event identity; automatic turns,
peer messages, replays, and notifications never renew.

Prompt context and Stop output use the same 6,000-character attributed,
untrusted envelope as Codex. Oversized bodies become exact full-read commands.
Errors cannot block a human prompt or create a Stop loop. Fixture evidence is
not live acceptance; [host delivery acceptance](live-acceptance.md) owns
separately authorized receipts.
