# Continuation packet (reconstructed round)

Use this template when a phone-a-friend follow-up cannot natively resume the
peer's session. The wrapper prepends a notice that this is a new session. The
packet itself must still be accurate, compact, and honest about what it leaves
out.

---

## A. Objective and constraints

Decide the retry policy for the registry loader's remote fetch. Constraints:
callers must never wait more than 2 s in total, and the loader must not retry
non-idempotent requests.

## B. Evidence (with provenance and caveats)

- Production logs from the last 7 days: 0.4% of fetches fail with a
  connection reset, and 91% of those succeed on an immediate retry. (Source: the
  host's log query. It covers one region only.)
- The fetch client already applies a 1.5 s socket timeout. (Source:
  `src/registry/fetch.ts`.)

## C. Previous peer advice (round 1, summarized by the host)

- Recommended one retry with jittered backoff capped at 300 ms.
- Disagreed with the host's draft on retrying `429` responses: the peer said
  honoring `Retry-After` could exceed the 2 s budget.
- Risk raised: retries can hide a regional outage from alerting.

## D. Host dispositions

- One retry with jittered backoff: **accepted**.
- Retrying `429`: **modified**. Retry only when `Retry-After` is ≤ 200 ms;
  otherwise fail fast.
- Outage masking: **accepted**. Retries now increment a metric.
- Peer's suggestion to add a circuit breaker: **unresolved**. Deferred as out of
  scope for this change; see question F.

## E. Exact current candidate (revision r2)

> Retry once on connection reset or `503`, after a jittered 100–300 ms delay.
> Retry `429` only when `Retry-After` ≤ 200 ms. Never retry non-idempotent
> requests. Count every retry in `registry_fetch_retry_total`.

## F. Focused question

Is revision r2 acceptable exactly as written? Name any material blocker. Is
deferring the circuit breaker a material problem for this change, or a
reasonable follow-up?

## G. Response and stop boundary

Return the advisory schema only. This is the last planned round: if a
material blocker remains, state it rather than softening it.

## H. Disclosure

This is a new provider session. You have no memory of round 1, and this
summary is the host's reconstruction, not the original transcript.
