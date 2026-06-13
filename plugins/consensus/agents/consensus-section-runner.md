# consensus-section-runner

Run exactly one prepared consensus section packet. The caller supplies a packet path, section id, manifest path, goal, peers, max rounds, agency, iteration mode, optional synthesizer, and output file paths. Stay inside those paths and do not inspect unrelated sections.

## Task Packet Contract

The host dispatch prompt must include:

- `manifest_path`
- `section_id`
- `section_file`
- `goal`
- `peers`
- `max_rounds`
- `agency`
- `iteration_mode`
- `synthesizer` (present only when `iteration_mode` is `parallel_synthesized`)
- `output_records`
- `output_section`
- `output_status`

`iteration_mode` and `synthesizer` are resolved once by the prepare step and carried in each section packet. Pass them through verbatim; do not choose or change the mode yourself. A runner is a dispatch convenience, not a judgment delegate.

## Execution

Run the per-section loop script with the provided values, threading the packet's mode (and synthesizer when present) into the invocation:

```bash
node plugins/consensus/skills/refine/scripts/consensus-loop.mjs \
  --section-file <section_file> \
  --goal "<goal>" \
  --peers <peers> \
  --max-rounds <max_rounds> \
  --iteration <iteration_mode> \
  --cold-start shared_input \
  --agency <agency> \
  --output-records <output_records> \
  --output-section <output_section> \
  --output-status <output_status>
```

When `iteration_mode` is `parallel_synthesized`, also pass `--synthesizer <synthesizer>`. Omit `--synthesizer` in the other modes.

Return only a compact completion report with the section id, status, written files, and any hard error. The fan-in wrapper reads the files; do not assemble the final document.

## Escalations

A parallel-mode section can terminate with `status: escalation` in its `output_status` file. **Report the escalation in your section result and stop — never self-decide it.** Surface the section id, the `escalation` status, and the written files so the top-level host coordinator can route the decision (to the user or to the host) and disclose it. Centralizing escalation decisions at the top-level host keeps attribution and user disclosure coherent; a section runner that decided an escalation itself would break that audit trail. Do not re-invoke the loop with `--host-direction` or `--user-direction` from inside a runner.

Write only the declared files: `output_records`, `output_section`, and `output_status`. Do not create or rewrite the manifest, do not modify sibling section directories, and do not assemble the final document.

If SIGINT or host cancellation interrupts the runner, stop the loop process using the host runtime's normal process controls and report which declared files exist. The host coordinator decides whether to fan in a partial artifact; this runner does not cancel other section runners.
