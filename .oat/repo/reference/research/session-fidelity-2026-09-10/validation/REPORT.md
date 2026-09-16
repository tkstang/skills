# Validation report

This report covers the authored packet only, not live provider compatibility or correctness of any implemented activity extension.

## Checks performed

The local validator parses all JSON artifacts, checks every native/proposed JSON Schema, validates the associated synthetic examples, checks activity-example count and truncation invariants, rejects several deliberately invalid proposed-report variants, checks Markdown file targets/source placeholders/code fences, and verifies the exact 17-provider catalog against the pinned-source manifest. It also type-checks the proposed TypeScript declarations with `tsc --noEmit --strict` when tsc is available.

[Machine-readable results](results.json) · [Reproducible validator](validate_packet.py)

```bash
python validation/validate_packet.py
```

The validator requires Python's `jsonschema` package; TypeScript checking additionally requires `tsc`. These are development checks for this reference packet, not new runtime dependencies proposed for your skills.

## What the checks do not establish

No real user session corpus was supplied or accessed. No Claude, Codex, Cursor, or other provider process was launched. No upstream repository build or test suite was run. No proposed activity flag was implemented or installed, and no user repository was modified. External source links were generated from inspected pinned repository paths; a full network link-check was not performed.

Native reference schemas are intentionally partial and permissive. A synthetic example passing one does not establish that the source provider records all tool calls/results, that the parser reconstructs the active branch, that timestamps are accurate, or that no fields are lost. The JSON Schema tests are artifact consistency checks, not ingestion certification.

The proposal's semantic checks cover its authored ASCII example. Production implementation must select and test its character/byte counting policy, including Unicode and multibyte tool output. The source locators in synthetic examples are illustrative, not real files to read.

## Archive integrity

The distributed ZIP preserves this directory structure. `MANIFEST.json` records SHA-256 hashes and byte lengths of packet files, excluding the manifest itself. The ZIP was tested for archive integrity after creation. Re-running the validator updates results.json, so the original manifest hashes refer to the distributed files, not subsequent local modifications.
