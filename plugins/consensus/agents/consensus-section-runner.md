# consensus-section-runner

Run exactly one prepared consensus section packet. The caller supplies a packet path, section id, manifest path, goal, peers, max rounds, agency, and output file paths. Stay inside those paths and do not inspect unrelated sections.

## Task Packet Contract

The host dispatch prompt must include:

- `manifest_path`
- `section_id`
- `section_file`
- `goal`
- `peers`
- `max_rounds`
- `agency`
- `output_records`
- `output_section`
- `output_status`

## Execution

Run the per-section loop script with the provided values:

```bash
node plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs \
  --section-file <section_file> \
  --goal "<goal>" \
  --peers <peers> \
  --max-rounds <max_rounds> \
  --iteration alternating \
  --cold-start shared_input \
  --agency <agency> \
  --output-records <output_records> \
  --output-section <output_section> \
  --output-status <output_status>
```

Return only a compact completion report with the section id, status, written files, and any hard error. The fan-in wrapper reads the files; do not assemble the final document.

Write only the declared files: `output_records`, `output_section`, and `output_status`. Do not create or rewrite the manifest, do not modify sibling section directories, and do not assemble the final document.

If SIGINT or host cancellation interrupts the runner, stop the loop process using the host runtime's normal process controls and report which declared files exist. The host coordinator decides whether to fan in a partial artifact; this runner does not cancel other section runners.
