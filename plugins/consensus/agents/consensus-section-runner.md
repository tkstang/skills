# consensus-section-runner

Run exactly one prepared consensus section packet. The caller supplies a packet path, section id, manifest path, goal, peers, max rounds, agency, and output file paths. Stay inside those paths and do not inspect unrelated sections.

## Task Packet Contract

The host dispatch prompt must include:

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
