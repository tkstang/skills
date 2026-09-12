---
title: 'Complexity Review'
description: 'Judge whether each schema, script, test, harness, agent pass, or abstraction in a plan or implementation earns its ongoing cost, and get the minimum sufficient version.'
---

# Complexity Review

`complexity-review` is a standalone, instruction-only Agent Skill that reviews a
plan, design, implementation, skill, prompt, or workflow and decides whether its
complexity is justified by the outcome it produces. It works before you build
(review a design and plan) and after (review what shipped, including the
planning artifacts that produced it).

The premise: generated artifacts are cheap, owned complexity is not. Models tend
to read "do a good job" as "build a comprehensive system", and each individual
addition sounds reasonable while the total drifts far from the original ask.
This review is the counterweight. It is not anti-engineering: schemas, tests,
scripts, harnesses, and review passes can all be right. The question is whether
each one earns its keep for this contract.

## What it produces

A fixed-shape report:

- **Verdict** — deletion-rule compliant, partially compliant, or not compliant.
- **Contract** — the outcome, hard constraints, acceptance criteria, and the
  minimum proof that would show success, separated from implementation choices
  that were treated as requirements.
- **Simplest viable solution** — the least complex version that satisfies the
  contract, used as the reference every addition must beat.
- **Complexity ledger** — one row per schema, script, test suite, harness,
  agent pass, abstraction, config system, or piece of process ceremony, with
  claimed value, cited evidence, ownership cost, and a recommendation of
  `Keep`, `Simplify`, `Defer`, or `Delete`. Evidence is graded as a hard
  requirement, observed, strongly inferred, speculative, or unsupported, and
  unsupported machinery is deferred with a trigger or deleted, never parked.
- **Proposed changes**, **risks of simplifying**, and **reintroduction
  triggers** — observable conditions under which deferred machinery should come
  back.
- **Out of lane** — correctness or staleness findings noticed in passing, one
  line each. The skill does not chase them; that is a correctness review's job.

## Usage

```
/complexity-review <target ...> [--out <path>]
```

- **target** — files, directories, a git range such as `main..HEAD`, or a
  project directory containing plan, design, or spec documents. With no
  target, the skill reviews the artifact the conversation is already about.
- **--out** — write the full report to a path and summarize in chat.

Without `--out` the report is delivered inline. A target path is never treated
as an output destination. If the request asks to save the review without naming
a path, the review still runs inline and says that no file was written.
Conversational prompts work too:

```
Before I implement this plan, run a complexity review on it.
```

```
This recon skill started as a one-hour prose task and turned into schemas, three scripts, and a test suite. Is any of that earning its keep?
```

## How it judges

Every inventory item passes a deletion test: if it can be deleted, deferred, or
substantially simplified while the contract and its proof remain intact, it
should be. "Best practice", "clean architecture", and "every sibling does it this
way" are claimed value, never evidence. Volume is a signal to investigate, not a
finding. The stance is skeptical, not reflexively minimalist: hard requirements,
credible threat models, and expensive-to-retrofit interfaces justify machinery
without a prior failure, and a replacement is acceptable only when it lowers
total lifecycle cost. The full method lives in the skill file itself,
`skills/complexity-review/SKILL.md`.

## Limitations

- Model invocation is disabled; the skill runs only when you ask for it. It is
  not a lifecycle gate.
- It judges necessity, not correctness. Pair it with a code or artifact review
  when you need both.
