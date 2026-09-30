# Operator QA: phone-a-friend advisory call

Manual dogfood guide for the `phone-a-friend` skill. The automated schema test
proves the advisory contract; this guide is the human pass that confirms a host
can ask one different provider for advice, read the structured JSON envelope,
and disposition the take without treating it as an automatic decision.

Live cross-provider invocation is manual. It depends on locally authenticated
provider CLIs and may cost real API spend.

## Prerequisites

```bash
# From the repo root
node --version
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json --provider <id> --capability run
```

For an installed plugin, the same checks may be exposed as:

```bash
consensus provider ls --json
consensus preflight --json --provider <id> --capability run
```

Confirm at least one peer provider is `ready`, preferably a provider different
from the current host. Provider inventory uses provider-neutral statuses such as
`missing`, `auth_required`, `unavailable`, and `unsupported`; treat these as
local setup diagnostics, not consensus failures.

## Scenario: registry cache ownership

This scenario asks a peer whether a registry lookup cache belongs in the loader
or in each caller. The sample prompt and expected advisory payload live in
`references/examples/`:

- [`examples/registry-cache.prompt.md`](examples/registry-cache.prompt.md)
- [`examples/registry-cache.advisory.json`](examples/registry-cache.advisory.json)

Run the one-shot advisory call from the repo root, replacing `<peer>` with a
ready provider id:

```bash
node plugins/consensus/scripts/consensus.mjs run \
  --provider <peer> \
  --schema plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json \
  --prompt-file plugins/consensus/skills/phone-a-friend/references/examples/registry-cache.prompt.md \
  --json \
  --max-depth 1
```

Installed-plugin form:

```bash
consensus run \
  --provider <peer> \
  --schema ./schemas/advisory.schema.json \
  --prompt-file ./references/examples/registry-cache.prompt.md \
  --json \
  --max-depth 1
```

## Expected JSON envelope

The CLI prints a provider-turn envelope. The advisory payload is under `json`
and should match this shape:

```json
{
  "schema_version": "v1",
  "ok": true,
  "provider": "<peer>",
  "json": {
    "schema_version": "v1",
    "understood_question": "Whether registry lookup caching should live in the loader or at each caller.",
    "take": "The loader is the better owner if all callers need the same lookup semantics.",
    "recommendation": "Centralize a short-TTL cache in the loader and expose an explicit bust path for tests or provider changes.",
    "risks": [
      "A loader-owned cache can hide provider changes until the TTL expires.",
      "Callers with unusual freshness needs may need an opt-out."
    ],
    "follow_up_questions": [
      "How often does the registry change during a typical session?",
      "Do any callers require strongly fresh reads?"
    ],
    "confidence": "medium",
    "assumptions": ["Registry reads are common and provider changes are rare."]
  }
}
```

Exact wording will differ. The important checks are:

- `ok` is true.
- `json.schema_version` is `v1`.
- `json.confidence` is `low`, `medium`, or `high`.
- `json.risks` and `json.follow_up_questions` are arrays of strings.
- The peer restates the question in `understood_question` clearly enough for
  the host to detect a misunderstanding.

If `ok` is false, read the envelope diagnostics and stderr. Common failures are
provider auth/setup issues, schema read errors, malformed peer JSON, or schema
validation errors. Do not fabricate an advisory payload.

## Sample disposition

After reading the advisory, the host dispositions it before continuing:

> Disposition: apply. The peer's cache-placement recommendation matches the
> design constraint that all callers should share registry semantics. I will put
> the cache in the loader, keep the TTL short, and add an explicit bust hook so
> tests and provider-change flows do not rely on process restart.

Other valid dispositions are `agree`, `disagree`, `ignore`, and `follow-up`.
The host should state what changed because of the peer and what did not.

## Sensitivity gate check

Before sending a prompt that includes customer data, private incident details,
credentials, proprietary strategy, or broad workspace context, stop and ask the
user which exact context is approved for the peer. The correct outcome for a
sensitive ambiguous request is a user confirmation question, not a peer call.

## Scenario: follow-up rounds

This pass confirms that a follow-up either natively resumes the exact peer
session or honestly starts a reconstructed one. Use synthetic, non-sensitive
prompts, a disposable workspace, and explicit read-only controls. Each run makes
real provider calls.

### Native resume proof

1. Create a scratch workspace (`mktemp -d`) and keep prompts and the schema
   outside it.
2. Round 1, session A: a prompt containing a random marker (for example,
   `kestrel-4f2a91`) and a rule ("when asked later, return the marker in
   uppercase"). Pass `--consultation-id qa-a --round 1`. Record
   `continuation.session_id`.
3. Session B: the same prompt with a different marker, in the same workspace,
   under `--consultation-id qa-b`.
4. Resume A in a separate process with `--resume <session-A-id> --round 2`. The
   follow-up asks for "the marker you were given earlier" without including it.
5. Check the envelope:
   - `ok` is true and `json` carries A's marker, uppercased.
   - `continuation.mode` is `native-resume`, and `continuation.session_id`
     equals `continuation.requested_session_id` (session A).
   - The workspace has no new files (`git status --porcelain` is empty).
6. Resume B the same way and confirm it returns B's marker, not A's.

### Failure and fallback checks

- `--resume <random-uuid>` returns `PROVIDER_SESSION_NOT_FOUND` with
  `continuation.turn: not_started`, and the provider is called only once.
- The same command plus `--resume-fallback reconstructed --fallback-prompt-file
<packet>` returns `continuation.mode: reconstructed`, a new `session_id`,
  `previous_session_id` set to the missing session, `fallback_reason:
session_not_found`, and `attempts.cli_attempts: 2`.
- `--resume my-session-title` is rejected with `CONSENSUS_CLI_USAGE` before
  any provider call.
- `--provider cursor --resume <uuid>` returns `PROVIDER_UNSUPPORTED_OPTION`
  while Cursor resume is unverified. It is not reported as an authentication
  failure.

### Reconstructed continuation proof

Run the continuation packet with `--continuation reconstructed
--previous-session <session-A-id>`. The receipt must say `mode: reconstructed`
with a session ID different from A's. The peer should state that it has no
memory of the earlier conversation. This test covers the fallback path, not
native memory.

### Sample multi-round disposition

> Round 2 of 3 (consultation `retry-policy`, revision r2, native resume of
> session `0199…8c41`). Disposition: modified. The peer accepts r2 except for
> retrying `429`. I narrowed that retry to `Retry-After` ≤ 200 ms and will ask
> in round 3 whether r3 is acceptable as written.

> Outcome: agreement on r3 between me and the peer (one peer, resumed session;
> not independent review). This does not authorize merging; the change still
> needs your approval.
