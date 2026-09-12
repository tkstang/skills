---
name: complexity-review
description: Use when a plan, design, implementation, skill, prompt, or workflow has accumulated schemas, scripts, tests, harnesses, agents, abstractions, or process ceremony and you need to judge whether each piece earns its cost, before building it or after. Produces a complexity ledger and the minimum sufficient version, not a correctness review.
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no language runtime or package dependencies. Uses git, when the target is in a repository, for commit-range targets and history checks.
argument-hint: '[target ...] [--out <path>]'
disable-model-invocation: true
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git status:*), Bash(git ls-files:*), AskUserQuestion
version: '1.0.0'
metadata:
  author: thomas.stang
  version: '1.0.0'
---

# Complexity Review

Review an artifact and decide whether its complexity is justified by the outcome it produces. Identify machinery that is valid in isolation but unnecessary for the actual contract, then recommend the smallest solution that still satisfies the requested outcome and still provides sufficient proof that it works.

**Core premise: generated artifacts are cheap. Owned complexity is not.** Models read "do a good job" as "build a comprehensive system." A prose skill becomes a schema, several scripts, a validation layer, fixtures, tests, review agents, and documentation. Each step can sound reasonable while the total becomes disproportionate to the problem. This review is the counterweight.

This is not an anti-engineering review. Schemas, tests, scripts, harnesses, abstractions, and review passes can all be appropriate. The question is whether each one earns its cost **for this contract**. The simplest solution is not the one with the fewest lines. It is the one with the lowest total lifecycle cost that still meets the contract.

## When to Use

Use when:

- A design or plan is about to be implemented and it proposes machinery beyond what the request named.
- A skill, prompt, or workflow has grown scripts, schemas, validation, fixtures, or multi-agent passes.
- Someone asks "is this over-engineered?", "do we need all this?", or "what is the smallest version of this?"
- A project keeps failing review cycles on machinery that the original request never asked for.

Artifact count, line count, and the ratio of planning material to shipped implementation are signals to investigate, never findings by themselves. A three-sentence request can legitimately need a substantial implementation.

## When NOT to Use

Do not use when:

- The user wants bugs, security issues, stale references, or spec violations found. That is a correctness review. This skill lists such findings out of lane, in one line each, and does not chase them.
- The complexity is a hard requirement the user has already reaffirmed. Say so in the ledger as `Keep`, and stop relitigating it.
- The artifact is already complete, truly disposable, and the review cannot affect its execution cost, future ownership, or future work patterns. Do not review it solely to criticize sunk complexity. An unfinished throwaway that is still consuming build time or model spend is in scope.

## Arguments

Parse from `$ARGUMENTS`:

- **target** (optional, repeatable): files, directories, a git range such as `main..HEAD`, or a project directory containing plan, design, or spec documents. If absent, use the artifact the conversation is already about. If there is no such artifact, ask for one. Files changed in the same commits or working tree, including untracked files, are candidate context. Include them only when they implement, support, verify, document, or were introduced because of the target.
- **--out `<path>`** (optional): write the full report to this path and give a short summary in chat.

Output rules:

- When `--out <path>` is present, write the report there and summarize it in chat.
- When the request names an output destination in prose, treat it as `--out`.
- Otherwise return the full report inline. Never infer an output destination from a target path.
- When the request asks to save the review but names no destination, run the review inline and state that no file was written because no destination was given.

## Workflow

Complete every step in order. The analysis is exhaustive; the report is proportional. A small artifact with one questionable mechanism gets a small report.

### Step 1: Restate the contract

Reduce the request that produced the artifact to four lines:

- **Outcome**: what the user actually asked for, in their terms.
- **Hard constraints**: limits the user or the repository imposes (dependency policy, provider compatibility, security boundaries).
- **Acceptance criteria**: how the user would know it is done.
- **Minimum proof**: the smallest evidence that would show the outcome is achieved. Often this is a few representative runs inspected by a person.

Separate requirements from implementation choices that have been treated as requirements. "Structured output" is usually a choice. "A downstream consumer parses the output" is a requirement. Write down which is which.

When the target is a plan or design, the contract comes from the request, spec, backlog item, or discovery notes, not from the plan itself. A plan cannot justify its own machinery. Contract sources are exempt from target scoping: read them even when they were not listed as targets.

When the originating request is unavailable or materially ambiguous, label the contract as inferred, cite each inference, and mark the verdict provisional. Do not promote claims from the reviewed plan into hard requirements without independent support.

Verify mechanically enforced constraints in implementation source, validators, tests, or actual tool behavior rather than descriptive documentation alone. Whether a CLI actually requires a flag decides whether the file it reads is a requirement or a choice. Explicit user instructions, policies, security requirements, external contracts, and accepted decisions remain authoritative even when nothing in source encodes them. When sources conflict, report the conflict instead of choosing whichever one justifies the machinery.

### Step 2: Establish the simplest plausible baseline

Describe the least complex version that could satisfy the contract and the minimum proof. For a skill, this is typically one prose document with clear inputs and outputs, a short workflow, a small output template, and manual inspection of a few representative runs. For a pipeline, it is often a single script or a single agent turn.

The baseline is not automatically the recommendation. It is the reference point every additional piece of machinery must beat.

### Step 3: Inventory the complexity

Consider every one of these categories during analysis. Report only material items; do not create rows or lines for empty categories.

- Schemas and structured intermediate representations
- Scripts, command-line tools, and generated runtime output
- Test suites, fixtures, and snapshot files
- Eval harnesses and scoring systems
- Validation and repair loops
- Multiple agents, model passes, verification passes, or adversarial passes
- State machines, orchestration phases, and resumable sessions
- Custom abstractions, provider-independent interfaces, plugin seams
- Configuration systems, persistence, caching
- Generated reports, duplicated documentation, reference files that restate the primary document
- Observability, telemetry, dashboards
- Process ceremony: planning documents, decision records, review passes, and phase gates produced to ship the artifact

Process ceremony counts. When project artifacts are in scope, note the volume of process material relative to the shipped artifact as a signal, then investigate it. Report disproportion only when the extra material has identifiable ownership cost and cannot be traced to the contract.

Review the system as a whole. Ten individually defensible additions can still produce an indefensible solution.

### Step 4: Apply the deletion test

Apply these seven questions to every inventory item as an internal decision test. The report does not print the answers; the ledger must make the contract link, evidence, cheaper alternative, lifecycle cost, and recommendation recoverable. Expand the reasoning only for disputed or consequential items.

1. What requested outcome does this support?
2. What concrete failure occurs without it?
3. Is that failure observed, likely, or merely imaginable?
4. Can a smaller mechanism address the same failure?
5. How will we know this addition improved the result?
6. What build-time, runtime, model-cost, latency, maintenance, coupling, migration, and cognitive cost does it introduce?
7. Could it be added later, after the need is demonstrated, and what would adding it later cost?

Then grade the evidence and decide. Evidence strength is one of: **hard requirement**, **observed**, **strongly inferred**, **speculative**, **unsupported**. The decision is one of:

- **Keep**: required by the contract, or observed or strongly inferred evidence shows that this mechanism materially improves the outcome and is proportionate compared with simpler alternatives. Cite the need and, when disputed, why this mechanism earns its cost.
- **Simplify**: valuable, but implemented at a higher level of complexity than the failure needs.
- **Defer**: speculative or unsupported today, with a credible trigger. Name the trigger.
- **Delete**: no concrete need and no plausible trigger.

Every reported item gets one of those four. There is no "unproven" verdict; unsupported machinery is deferred when a trigger exists and deleted when none does. Evidence for the underlying problem is not automatically evidence for the current solution. The ledger grades the mechanism; cite the observed problem in the same cell when it exists.

Cost gates the ledger. An item with negligible lifecycle cost that serves a repository convention or a stated preference is `Keep` and does not get a row. Ledger rows are for machinery someone will have to own. Review such items collectively when many negligible additions accumulate into material complexity, obscure the primary contract, or create meaningful authoring burden.

Apply the rule: **if an item can be deleted, deferred, or substantially simplified while the contract and its proof remain intact, it should be.** A component is not justified because it is well designed, follows a best practice, or matches its siblings. It must materially improve the outcome for this problem.

Do not require a previous failure when a hard requirement, a credible threat model, an irreversible interface, or a low-frequency high-impact risk justifies the mechanism. "It has not failed yet" is not evidence that a safety boundary is unnecessary. Public APIs, persisted data formats, security boundaries, and interoperability contracts can be far more expensive to retrofit than to design early; question 7 exists for them.

Two classification notes:

- A file or field that a validator, CLI, or lifecycle tool requires is a hard constraint and is `Keep`. The depth of prose inside it is not, and is reviewed like anything else.
- Do not recommend rewriting an archived artifact solely to reduce historical complexity. If it remains in active discovery paths, misleads agents, duplicates current guidance, or carries maintenance cost, classify it normally. Otherwise omit it from the ledger and record the lesson as future process guidance under Proposed changes.

The following categories are where engineering most often becomes theater. Use the evidence column as the bar for `Keep`.

| Category                    | Evidence that earns `Keep`                                                                                                                                   | Not evidence                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Schema for a skill/prompt   | A downstream consumer parses it; models repeatedly omit or misread fields; several renderers share it; validation has caught a real failure                  | "Clean architecture"; a consumer that may exist later         |
| Script or harness           | The operation runs often; manual execution is error-prone; reproducibility matters; a measured burden is eliminated                                          | The task could be automated; behavior has not stabilized yet  |
| Tests and fixtures          | A regression occurred or would be costly; the assertion is a stable contract; failures score objectively; coverage unlocks iteration that is otherwise risky | Code exists, therefore tests; snapshots of incidental details |
| Eval system                 | A defined decision the eval informs; representative fixtures exist; scoring separates meaningful differences; the result changes routing or release          | Nobody has yet said what "good" means                         |
| Multi-agent or verification | A single pass misses a named class of evidence; verification measurably reduces false claims; fan-out beats one stronger model at comparable cost            | "More agents should be more robust"                           |
| Generalized abstraction     | Two real implementations share it; near-term consumers have materially different needs; duplication is already causing defects; total complexity goes down   | A hypothetical second use case; a sibling has one             |
| Process ceremony            | A decision was genuinely contested; a review pass found something the author could not; a phase gate blocked a real defect                                   | The template has a slot for it; the lifecycle always does it  |

### Step 5: Recommend the minimum sufficient version

Describe the smallest coherent solution, not merely the list of deleted pieces. Say what it is made of and how its proof is obtained.

For every `Defer` item, write an explicit reintroduction trigger. Good triggers are observable:

- A recurring failure appears in real usage.
- Manual work exceeds a stated frequency or cost.
- A second consumer requires a stable machine-readable contract.
- Model variance causes a measurable reliability problem.
- A second implementation shows the abstraction is real.
- Regression frequency justifies automated coverage.
- Scale makes the simple approach operationally insufficient.

### Step 6: Deliver the report

Use this shape. Verdict, Contract, Simplest viable solution, and Complexity ledger are always present. Include the other sections only when they have content.

```markdown
# Complexity Review: {target}

**Verdict:** {Deletion-rule compliant | Partially compliant | Not compliant}{, provisional}
{One sentence: what the contract is and how far the artifact overshoots or undershoots it.}

## Contract

- Outcome: …
- Hard constraints: …
- Acceptance criteria: …
- Minimum proof: …

## Simplest viable solution

{Two to five sentences.}

## Complexity ledger

| Item                | Claimed value | Evidence                                                                                       | Lifecycle cost | Recommendation                   |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------- | -------------- | -------------------------------- |
| {file or component} | …             | {hard requirement / observed / strongly inferred / speculative / unsupported, with a citation} | …              | Keep / Simplify / Defer / Delete |

## Proposed changes

- Keep: …
- Simplify: …
- Defer: …
- Delete: …

## Risks of simplifying

{Real risks only, including removal and migration cost. No speculative edge cases.}

## Reintroduction triggers

- {Deferred item}: reintroduce when …

## Out of lane

{Correctness, security, or staleness findings noticed in passing. One line each. Not investigated.}
```

Verdict criteria: `Deletion-rule compliant` when every item is `Keep` or a trivial `Simplify`, where trivial means wording or duplication changes with no change in behavior. `Partially compliant` when the central approach is right and the overshoot is peripheral. `Not compliant` when the central approach itself fails the deletion test. The central approach is the mechanism as built, not the goal it serves. Add `provisional` whenever the contract was inferred.

Cite evidence with a file path and line, a section heading, a commit, a log, a run, or a short quoted excerpt from the originating request. Target lines establish what exists, how it behaves, and what it costs. Claims that machinery is necessary are corroborated, where possible, by the originating contract, consumers, tests, runs, history, incidents, or observed outcomes. A plan, design, or comment does not justify its own machinery merely by asserting its value. When a decision depends on claimed reuse, recurring failures, or historical maintenance cost, inspect the available history to see whether those claims materialized. "Best practice" and "consistency with siblings" go in the Claimed value column, never in Evidence.

## Reviewer Stance

Be skeptical, not reflexively minimalist.

- Do not remove complexity that directly satisfies a hard requirement.
- Do not replace clear code with a clever abstraction to reduce line count.
- Do not recommend a week-long rewrite to eliminate a minor maintenance burden.
- Do not increase net machinery. A new mechanism is acceptable only when it closes a named contract gap or replaces more expensive machinery, and the review shows that total lifecycle cost decreases.
- Sunk implementation cost is irrelevant. Removal and migration cost are not. Compare the forward ownership cost with the cost and risk of simplifying now.
- Do not grade the artifact on whether it is correct. Grade it on whether it is necessary. Correctness findings go under Out of lane.

### Red flags

These thoughts mean the review has drifted into a correctness review, an approval, or reckless deletion. Return to Step 1.

| Thought                                           | Reality                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| "Proceed, with corrections"                       | A verdict before the ledger is a guess. Build the ledger first.                                                                                 |
| "This part is fine as-is"                         | Internally correct is not the bar. Which contract line does it serve, and what is the evidence?                                                 |
| "Every sibling does it this way"                  | Consistency is claimed value, not evidence. Siblings can be over-built too.                                                                     |
| "Making it mechanically enforced is safer"        | Enforcement is machinery. Name the failure, threat, hard requirement, or irreversible boundary it addresses; otherwise defer it with a trigger. |
| "We will probably need this later"                | Then it is Defer, with a trigger. Not Keep.                                                                                                     |
| "It has not failed yet, so delete it"             | A hard requirement, credible threat model, or irreversible interface justifies machinery without a prior failure.                               |
| "It is already built, removing it is wasted work" | Sunk cost is irrelevant. Removal cost is real; put it in Risks and decide on forward cost.                                                      |
| "The plan already justifies it"                   | A plan cannot justify its own machinery. Go back to the request.                                                                                |
| "The plan is four times the artifact, so fail it" | Volume is a signal to investigate, not a verdict. Trace the material to the contract first.                                                     |

## Examples

### Basic usage

```
/complexity-review .oat/projects/my-skill/design.md .oat/projects/my-skill/plan.md
/complexity-review main..HEAD --out reviews/complexity-review.md
/complexity-review skills/recon-agent/
```

### Conversational

```
This recon skill started as a one-hour prose task and turned into schemas, three scripts, and a test suite. Is any of that earning its keep?
```

```
Before I implement this plan, run a complexity review on it.
```

## Success Criteria

- The originating contract and minimum proof appear before any recommendation.
- Every `Keep` item maps to a hard requirement or credible evidence.
- Evidence establishes that the retained mechanism is proportionate, not merely that the underlying problem exists.
- Every reported item has an actionable decision: Keep, Simplify, Defer, or Delete.
- Every `Defer` item has an observable reintroduction trigger.
- The recommendation is a coherent minimum sufficient solution, not merely a deletion list.
- The report is proportional to the target.
- Out-of-lane findings are incidental, concise, and were not actively investigated.
- Any proposed replacement reduces total lifecycle cost.
