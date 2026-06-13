# Position: we should rewrite the billing service in Rust

## The case for the rewrite

The billing service is the most important service we run and also the most error-prone. It is written in Python, and over the last year we have shipped four separate incidents that traced back to dynamic typing bugs — a None where a Decimal was expected, a silent string-to-float coercion that lost a cent on every thousandth invoice, that kind of thing. A rewrite in Rust would make entire categories of these bugs impossible at compile time. Billing is also our most latency-sensitive batch job, and the current implementation spends most of its wall-clock time in the interpreter; a Rust rewrite would plausibly cut the nightly run from six hours to under one.

## Why now

We are about to take on a large project to support multi-currency billing, which will touch nearly every line of the service anyway. If we are going to be rewriting most of it for multi-currency support regardless, the marginal cost of doing that rewrite in Rust instead of Python is much lower than it would be at any other time. This is the cheapest this rewrite will ever be.

## The risks

The team does not know Rust today. Realistically there would be a two-to-three month ramp where velocity drops, and during that ramp we would still be on the hook for keeping the existing Python service running and correct. There is also a real risk that we under-estimate the rewrite and end up maintaining two billing services in parallel for longer than planned, which is the worst of all worlds.

## Recommendation

On balance the correctness argument wins. Billing bugs cost us real money and real customer trust, and a class of them simply cannot happen in Rust. We should staff a small team, accept the temporary velocity hit, and do the rewrite alongside the multi-currency work.
