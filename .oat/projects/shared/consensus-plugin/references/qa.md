# Dogfooding QA

Manual scenarios to run before public v0.1. Automated coverage lives in `npm test`, `npm run validate`, and `npm run smoke`; the release gate lives in `RELEASING.md`. This doc is for the human-in-the-loop signal those can't capture: does the skill actually feel right when invoked through a real host against a real Paseo + real provider runtime?

Fill in the **Notes** column as you run each row. If something feels off but isn't broken, capture it — that's the whole point.

## Setup

- Node.js >= 22 and `paseo` on PATH (`paseo --version`).
- A working repo checkout. Run `node scripts/install-paseo.mjs --check` if Paseo is missing and you want to verify the install assist.
- A draft to refine. `tests/fixtures/sample-input.md` is the fastest start; for richer signal, use a real document you'd actually want refined (PRD section, design doc, README draft).
- Provider runtime configured for whichever host you're testing (Claude Code session, Cursor session, or Codex CLI with marketplace install).

## Provider Install Matrix

Run each install path once, then move to the scenarios. Scenarios are mostly host-agnostic, but parallel and Codex-authorization rows are host-specific.

| Provider | Install command | Verified | Notes |
| --- | --- | --- | --- |
| Claude Code | Add this repo as a local plugin marketplace, then `/plugin install consensus@<marketplace>` | | |
| Cursor | Add `.cursor-plugin/marketplace.json` via Cursor's plugin marketplace UI pointed at this repo | | |
| Codex | `codex plugin marketplace add <repo path>` then install `consensus` | | |
| Standalone skill | Symlink-style: invoke wrapper directly via `node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs ...` | | |

## Scenarios

For each scenario, "Expected vibe" describes what a healthy run feels like — convergence pace, summary quality, JSONL clarity, artifact readability. If the wrapper exits 0 but the deliberation feels mechanical or the artifact is hard to read, that's a signal worth capturing even though no test failed.

| # | Scenario | Provider(s) | Invocation sketch | Expected vibe | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Single-section sequential, real input | any | `consensus-refine <small.md> --goal "<goal>"` | Converges in 1-3 rounds; final artifact reads cleaner than input; JSONL stream is followable | |
| 2 | Multi-section sequential with one genuinely contested section | any | same as #1 with `tests/fixtures/sample-input.md` or richer doc | Most sections converge fast; contested section actually surfaces disagreement before ACCEPT | |
| 3 | Hit `--max-rounds` deliberately on a contested section | any | add `--max-rounds 2` | Stops cleanly at max-rounds with impasse summary, not silent give-up | |
| 4 | `--user-direction` to break impasse | any | rerun #3 with `--resume <artifact> --user-direction "<direction>"` | New deliberation continues from prior state; user round is captured in artifact | |
| 5 | Resume after Ctrl-C mid-turn | any | start a long run, Ctrl-C between turns, then `--resume <artifact>` | Completed sections preserved; in-flight section restarts from last canonical state | |
| 6 | Corrupt resume detection | any | edit a section's deliberation block by hand, then `--resume` | Wrapper refuses, surfaces diagnostics path, suggests `--skip-corrupt-section` | |
| 7 | Host-mediated parallel prepare + dispatch | Claude Code (primary), Cursor, Codex | `--prepare-parallel`, parse `parallel_dispatch_required` JSONL, host dispatches `consensus-section-runner` per packet, then `--fan-in <manifest>` | Parallel batches respect `parallelism`; section files written; fan-in produces an artifact that matches sequential output for the same input | |
| 8 | Codex authorization prompt for parallel dispatch | Codex | scenario #7 under Codex | Authorization asked exactly once; denial fails closed (no silent sequential fallback) | |
| 9 | Missing-paseo path | any | rename `paseo` on PATH temporarily, run scenario #1 | Preflight fails with actionable message; `install-paseo.mjs` is mentioned/usable | |
| 10 | Agency level comparison | any | run scenario #2 with `--agency minimal`, then `--agency maximum` | Minimal feels constrained but final; maximum feels exploratory but converges | |
| 11 | `--fail-on-section-error` aggregation | any | construct an input where one section will impasse, with and without the flag | Without flag: partial artifact + non-zero only at end. With flag: exits 74, partial artifact still rendered | |
| 12 | Artifact frontmatter readability | any | open the artifact from any prior scenario | Frontmatter has goal, peers, host, iteration, cold-start, turn/round totals, wall-clock, cost, run id, input path; canonical JSON block is HTML-commented; prose log uses readable headings | |
| 13 | Real PR/design draft (the actual dogfood test) | any | run on a doc you'd actually ship | The artifact is something you'd actually use, not just technically correct | |

## Sign-Off

A v0.1 dogfooding pass means every row above has a Notes entry, every scenario was run on at least one provider, and scenarios 7-8 were run on every provider you're claiming as supported. If a row's outcome was unhealthy but not broken, file it as a follow-up, not a release blocker — but record it here so the signal isn't lost.

## See Also

- `plugins/consensus/skills/consensus-refine/SKILL.md` — host-facing skill contract and flag reference
- `RELEASING.md` — release gating + provider install verification
- `scripts/smoke-test.mjs` — mocked end-to-end (read this before crafting scenario inputs so dogfooding doesn't duplicate it)
- `plugins/consensus/agents/consensus-section-runner.md` — section runner contract for parallel scenarios
