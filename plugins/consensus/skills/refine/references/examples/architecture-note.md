# Design note: rate limiter for the public API

## Problem

Our public API currently has no rate limiting. A handful of clients have begun issuing bursts large enough to degrade latency for everyone else, and we have no mechanism to push back. We need per-client rate limiting that is fair, observable, and cheap enough to run in the request hot path.

## Goals

We want to cap each API key to a configurable requests-per-second budget, return a clear 429 response with a Retry-After header when the budget is exceeded, and expose metrics so we can see who is being throttled and when. It should add no more than a millisecond of overhead at the median and should not become a single point of failure.

## Approach

We will use a token bucket algorithm per API key. Each bucket refills at the configured rate and has a burst capacity equal to two seconds of budget. Buckets live in Redis so that the limit is enforced consistently across all of our stateless API nodes. We will use a small Lua script to make the check-and-decrement atomic, avoiding a read-modify-write race between nodes.

## Failure handling

If Redis is unavailable, the limiter will fail open rather than fail closed. We would rather serve unthrottled traffic for a few minutes than take a hard dependency on Redis for every single request. We will alert on the fail-open condition so that an operator can intervene.

## Rollout

We will ship the limiter in shadow mode first, where it computes the decision and emits the metric but does not actually reject anything. After a week of watching the shadow metrics we will turn on enforcement for internal keys, then external keys, raising the limits conservatively and tightening them as we learn.
