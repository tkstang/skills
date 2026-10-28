---
name: explain-options
description: 'Use when the agent has just offered choices (a question, a list, "A or B", or an AskUserQuestion) and the user wants context to decide: "explain the options", "what are the trade-offs", "why pick one over the other", how they differ, or more detail on them. Explains background, trade-offs, and what decides it, recommends, then asks. Not for comparing tools from scratch, explaining why a system is built as it is, re-explaining an unclear point, or recommending next steps overall.'
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
user-invocable: true
metadata:
  author: Thomas Stang
  version: '1.0.0'
---

# Explain the options

When the agent has offered choices and the user lacks the context to pick one,
explain them well enough to decide: the background that creates the choice, what
each option means and costs, what actually separates them, and a recommendation.
This skill explains. It does not make the choice for the user or act on it.

Nearby requests need a different answer:

- Comparing tools, products, or approaches that nobody has offered yet is a
  from-scratch comparison, such as `compare`.
- Asking why code or a system has its current shape is a design-history question,
  such as `why`.
- An unclear concept or explanation needs a re-pitch, such as `wait-what`, even
  while a choice is pending. "Why would I choose B?" stays with this skill; "I
  didn't follow how the scheduler works" goes to the re-pitch.
- Asking what to do next overall needs a next-step recommendation, such as
  `next-steps`. This skill covers one pending decision.

## Step 1: Find the decision

Use the most recent set of choices the agent offered, in any form: a question, a
list, "A or B", or a structured question prompt such as AskUserQuestion. When the
user names an earlier one, such as "the options about X", use that.

- **Several open decisions, none named:** list them in one line each and ask which
  one, or cover each briefly when they are small. When they interact, say how.
- **No choices offered:** say so and ask what decision is meant. Do not invent
  options.
- **Already decided:** do not reopen a decision the user already made unless they
  ask to revisit it. Acknowledge the choice instead of asking for approval again.

When you ask which decision is meant, stop and wait for the answer. The remaining
steps apply once the decision is established.

Restate the decision in one sentence: what is being chosen, and what happens once
it is chosen.

## Step 2: Recover the context

Use the conversation first, including preferences and standing instructions the
user has already stated. When an option depends on a load-bearing claim nobody
has verified, such as "this would break X", make a bounded check: a few targeted
reads of the code, docs, or configuration that settle it. Do not run open-ended
research. Say when a claim turns out true but overstated, or when the check finds
a cost nobody mentioned, and say which claims you could not verify.

## Step 3: Explain

**Background.** Give the two to five facts someone needs before the options make
sense, such as how things work today and the constraint that creates the choice.
Use plain language and define terms the user may not know.

**Each option,** keeping its original label:

- what it means concretely: what changes, and who does what;
- benefits;
- costs and risks;
- reversibility: how hard and costly it is to change later;
- effort or time, when it differs meaningfully between options.

**What actually decides it.** Name the one to three factors that separate the
options, and when each favors which option. For example: "If this lane becomes a
PR gate, B's guard matters; today nothing depends on it."

**Choose A if… / Choose B if…** One line per option, tied to what the user may
care about: speed, safety, team effort, cost, or flexibility later.

**Recommendation.** Your pick, why, your confidence, and what would change your
mind. When a deciding fact is missing, make the pick conditional on it rather
than guessing. When a staged or hybrid path, or a small safeguard added to an
offered option, is clearly better than every option as offered, such as "A now,
then add the guard before gating", recommend it and label it as new. Do not add
other options.

**What would settle it.** When the choice turns on a fact or preference only the
user has, name it once, here or in the closing question.

Throughout:

- Be honest about trade-offs. Do not present the recommended option as free, and
  give each other option its strongest case.
- Keep facts distinct from opinions, and verified claims distinct from
  assumptions.
- Keep it proportional. A small choice gets a few lines, and nothing should run
  longer than the user needs to choose. A clearly weak option still gets a fair
  line, kept brief: why it is weak, and what would make it viable, if anything.
- Follow the session's output style.

## Visuals

Use a picture when it explains the choice faster than sentences: how the system
works today and where each option changes it, a staged path over time, or numbers
that separate the options. Skip it for a simple choice. A Markdown table is not a
visual.

- Draw only from facts you have. Never invent a number or a screen.
- Keep it small, about six boxes with a few plain words each. Do not narrate the
  picture, but keep every fact needed to decide in the text.
- Use what the host renders, such as a Mermaid diagram, a chart, or an existing
  screenshot. When nothing renders, or you are unsure, leave it out.

## Step 4: Hand back

End by asking which option to take, or whether to proceed with the
recommendation. For a decision the user already made, confirm their choice
instead. Do not act on it: do not modify files, change workflow state,
merge, or resume work as part of explaining.

## Output shape

```markdown
**The decision:** <one sentence>

**Background:**

- <two to five facts>

## Option A: <name>

<what it means>

- **Pros:** …
- **Cons and risks:** …
- **Reversibility:** …

## Option B: <name>

…

**What actually decides it:** <one to three factors>

**Choose A if** … **Choose B if** …

**My recommendation:** <pick, why, confidence; what would change it>

<the question back to the user>
```

A side-by-side table can replace the per-option sections when it is shorter,
which is common with three or more brief options. Omit any part with nothing to
say.

## Examples

- Codex: `$explain-options`
- Claude Code: `/explain-options`
- Natural language: "I don't have enough context to choose. Explain the options."
- Natural language: "What are the trade-offs between the two approaches you just
  gave me?"
- Natural language, right after a question with three choices: "Can you say more
  about these before I pick?"

"Compare Postgres and SQLite for this project", with no options on the table, is a
from-scratch comparison. "Just pick one and go" asks the agent to decide and act,
not to explain.
