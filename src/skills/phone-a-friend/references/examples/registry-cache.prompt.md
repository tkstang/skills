# Advisory Request: Registry Cache Ownership

You are advising the host agent. Provide one structured advisory take using the
schema you were given. Your response is advisory only; the host will decide what
to apply.

Question: Should registry lookup caching live inside the registry loader, or
should each caller cache registry lookups independently?

Relevant context:

- The registry is read often during skill/plugin discovery.
- Provider changes are uncommon, but stale entries can cause confusing behavior
  after a provider update.
- The host wants one consistent lookup behavior across callers.
- Tests need a deterministic way to clear cached state.

Please restate the question, give your take, recommend an action, list risks or
missed considerations, include follow-up questions, and state confidence.
