---
title: 'Refine'
description: 'Run the refine skill to deliberate two AI peers toward a converged markdown artifact, including iteration modes, resume, escalation, and host-mediated parallel sections.'
---

# Refine

`refine` improves a markdown draft by asking two provider-CLI-backed AI peers to
deliberate toward a converged artifact with an audit trail. The wrapper parses
the document into sections, runs the configured peers through verdict rounds, and
writes a deliberation artifact beside the input as `<input>.consensus.md` unless
`--output <path>` is given. The artifact contains the final output, resolution
metadata, section states, and a per-section deliberation log.

For the full hands-on walkthrough of all three iteration modes and the escalation
ladder against live peers — exact commands, example inputs, and expected output —
see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md) and
[`skills/refine/references/operator-qa.md`](https://github.com/tkstang/skills/blob/main/plugins/consensus/skills/refine/references/operator-qa.md).

## Sequential refinement (default)

The default flow is sequential section processing with the `alternating`
iteration mode. Run the wrapper against a markdown file:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --goal "Make this clearer."
```

## Iteration modes

Select how the two peers deliberate with `--iteration`. The default is
`alternating`.

### Round-flow comparison

```mermaid
flowchart TB
  Input[Current section state]

  subgraph Alternating[alternating - 1 peer call per round]
    A1["Selected peer revises<br/>Peers alternate across rounds"] --> A2[One revised state]
  end

  subgraph ParallelRevision[parallel_revision - 2 peer calls per round]
    PR1[Peer A revises]
    PR2[Peer B revises]
    PR1 --> PR3["Two revisions retained<br/>for the next round"]
    PR2 --> PR3
  end

  subgraph ParallelSynthesized[parallel_synthesized - 2 peer calls + 1 synthesis call per round]
    PS1[Peer A revises]
    PS2[Peer B revises]
    PS1 --> Synthesis[Synthesis call: merge revisions]
    PS2 --> Synthesis
  end

  Input --> A1
  Input --> PR1
  Input --> PR2
  Input --> PS1
  Input --> PS2
  A2 --> Resolved{Agreement reached?}
  PR3 --> Resolved
  Synthesis --> Resolved
  Resolved -->|yes| Output[Converged artifact]
  Resolved -->|no| Continue{Can another normal round run?}
  Continue -->|yes| Input
  Continue -->|no, parallel escalation trigger| Escalation[escalation_required]
  Continue -->|no, other stop| Stopped[Stop with unresolved state recorded]
  Escalation --> User[User direction: --user-direction]
  Escalation --> Host[Host direction: --host-direction]
  User --> Resume[Resume artifact]
  Host --> Resume
  Resume --> Input
```

```bash
# Both peers revise in parallel each round; converge on emergent agreement (2x peer calls).
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md \
  --goal "Tighten the draft." --iteration parallel_revision

# Parallel revision plus a per-round synthesis merge (2x peer calls + 1 synthesis call).
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md \
  --goal "Tighten the draft." --iteration parallel_synthesized --synthesizer claude
```

Parallel modes disclose their per-round call multiplier in the `run_started`
JSONL event (`calls_per_round`) and report actual `peer_calls` /
`synthesis_calls` totals at completion. The synthesizer defaults to the first
peer and must be present in the peer inventory (`SYNTHESIZER_UNAVAILABLE`
otherwise); it is warned-and-ignored outside `parallel_synthesized`.

## Resume and recovery

Resume from a prior artifact with `--resume <artifact-path>`. Use
`--user-direction "<direction>"` when continuing after an impasse or max-rounds
stop. User direction is recorded as a user round in the new deliberation
artifact.

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md \
  --resume draft.consensus.md \
  --user-direction "Prefer the shorter introduction."
```

Use the corrupt-section controls only when the wrapper reports blocked resume
state.

## Escalation

When a parallel-mode section gets stuck — persistent disagreement, oscillation,
budget exhaustion, or near-done drift — the wrapper emits an
`escalation_required` JSONL event routed by `--agency` to the user or the host.

- A **user** decision re-enters with `--resume <artifact> --user-direction
"<text>"`.
- A **host** decision re-enters with `--resume <artifact> --host-direction
"<text>"` (optionally `--host-decision-kind <kind>`) and records as an
  attributed orchestrator round. Always disclose a host-decided round to the user
  — host-decided rounds are not silent.

### Verdict precedence

The order is load-bearing: an explicit `IMPASSE` short-circuits, convergence is tested next, and only a declined convergence consults the escalation triggers, which are then routed by agency.

```mermaid
flowchart TD
  ROUND["Round complete<br/>two peer records appended"]
  IMP{"Either verdict is IMPASSE?"}
  STOP["status: impasse<br/>reason: explicit_impasse"]
  CONV{"Converged?<br/>parallel_synthesized: synthesis stability<br/>otherwise: parallel convergence"}
  DONE["status: converged"]
  ESC["Escalation triggers consulted<br/>only after impasse and convergence decline"]
  T1{"persistent_disagreement<br/>parallel_synthesized only:<br/>same unresolved set in 3 syntheses"}
  T2{"oscillation"}
  T3{"near_done_drift<br/>both declared agreement,<br/>hashes differ"}
  T4{"budget_exhausted<br/>supplied when the round budget is spent"}
  NEXT["No trigger: run another round"]
  ROUTE["routeEscalation(trigger, agency, records)"]
  AUTO["decide_via: auto<br/>terminates deterministically<br/>declare_done or near_match"]
  HOST["decide_via: host<br/>resume with --host-direction"]
  USER["decide_via: user<br/>resume with --user-direction"]
  PROMO["Repeat-fire after a HOST_DECISION,<br/>or decision_kind defer_to_user<br/>promotes host to user"]

  ROUND --> IMP
  IMP -->|yes| STOP
  IMP -->|no| CONV
  CONV -->|yes| DONE
  CONV -->|no| ESC
  ESC --> T1
  T1 -->|no| T2
  T2 -->|no| T3
  T3 -->|no| T4
  T4 -->|no| NEXT
  NEXT --> ROUND
  T1 -->|yes| ROUTE
  T2 -->|yes| ROUTE
  T3 -->|yes| ROUTE
  T4 -->|yes| ROUTE
  ROUTE --> AUTO
  ROUTE --> HOST
  ROUTE --> USER
  HOST -.-> PROMO
  PROMO -.-> USER
```

_Mermaid updated 2026-09-16_

## Host-mediated parallel sections

Parallel section orchestration is host mediated: the wrapper prepares packets and
the host runtime dispatches section runners. Prepare packets first, dispatch
section runners with the host runtime, then fan in the completed section outputs:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --prepare-parallel --goal "Tighten the draft."
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs --fan-in .consensus/<run-id>/manifest.json
```

Parallel section mode requires host-native subagent dispatch. Under Codex,
dispatch authorization must fail closed: if approval is unavailable or denied, the
host reports that parallel mode did not run rather than silently falling back to
sequential.
