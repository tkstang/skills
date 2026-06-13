---
id: bl-0cff
title: 'Make consensus output schemas compatible with OpenAI/codex structured output'
status: open
priority: high
scope: feature
scope_estimate: M
labels: [consensus, paseo, structured-output, codex, pre-existing-bug]
assignee: null
created: '2026-06-13T15:22:05Z'
updated: '2026-06-13T15:22:05Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The consensus plugin's structured-output schemas and verdict model are incompatible with OpenAI's strict structured output, so **codex (OpenAI) has never worked as a deliberation peer** — including in v0.1. The automated suite never caught this because it uses a paseo stub with hand-rolled JS validators; the real `paseo run --output-schema` path (paseo builds an OpenAI/Anthropic `response_format` from the schema file) was only exercised by live dogfooding on 2026-06-13.

Four incompatibility layers were found, in order:

1. **JSON Schema draft** — schemas declared draft 2020-12; paseo's default Ajv is draft-07. → **Fixed** (draft-07), commit `ea45752`.
2. **`oneOf` / `not`** — OpenAI structured output forbids them; we used `oneOf` to make `proposed_artifact` conditional on the verdict. → **Fixed** (removed; the JS validator's per-verdict branch tables already enforce the conditional), commit `fbc9e61`.
3. **Missing `type` keys** — OpenAI requires every property to declare `type`; our `const`/`enum` properties omitted it. → **Fixed**, commit `f680ad0`.
4. **All-fields-always (the remaining blocker)** — OpenAI strict structured output **emits every schema property in every response** (it cannot omit "optional" fields). So codex returns `proposed_artifact` on an ACCEPT/IMPASSE, and our `validateVerdictShape` per-verdict branch tables reject it as `additional property: proposed_artifact`. The Anthropic path doesn't hit this because Claude omits optionals. **Not yet fixed.**

Layer 4 is a genuine design mismatch (OpenAI "all fields present" vs. our conditional/optional verdict model), not a one-line schema tweak, which is why it is tracked here rather than hot-patched.

## Source

Live dogfooding of the `consensus-iteration-modes` project (p06-t06 / NFR4), 2026-06-13. Layers 1–3 fixed inline during that session; layer 4 deferred here. Pre-existing since v0.1 (the v0.1 plugin's "end-to-end refine works" criterion was validated only against stubs + `paseo provider ls`, never a live codex turn).

## Acceptance Criteria

- A live `refine` run with `--peers claude,codex` completes a converging deliberation in all three iteration modes (alternating, parallel_revision, parallel_synthesized) without `OUTPUT_SCHEMA_FAILED` or validator `additional property` errors.
- Decide and implement the layer-4 strategy, e.g. one of:
  - normalize peer verdicts before validation (treat empty-string `proposed_artifact` / empty `concerns` emitted under strict output as absent), or
  - relax the validator so known-optional fields are always allowed (keeping the "REVISE/ACCEPT_PEER must carry a non-empty `proposed_artifact`" requirement), or
  - emit per-provider schema variants if paseo exposes the provider at schema-build time.
- The chosen approach is covered by tests that exercise a strict-structured-output-shaped verdict (all fields present) per mode, including synthesis payloads.
- Add a real (non-stub) smoke or integration check, or at minimum a documented manual gate, so the live codex path can't silently regress again.
- Update `operator-qa.md` once codex works end-to-end (drop the "substitute another provider" workaround note).

## Notes

- The three committed fixes (layers 1–3) are correct and provider-portable regardless of layer 4; keep them.
- Until layer 4 is resolved, the operator-qa guide documents using a substitute available peer pair (e.g. two Anthropic-family peers) to exercise the modes.
