# Review and verification

Select checks that can reveal failures in the changed contract. Report evidence
and limitations; do not mark every item passed merely because metadata parses.

## Routing and content

- Check name/directory agreement, metadata types/version, and a concise description
  with distinct triggering conditions. Include a nearby request that should use a
  different skill or no skill.
- Trace representative requests through inputs, actions, outputs, and failure paths.
  Use an ordinary case, a missing/ambiguous input, and an authorization boundary
  when applicable. Record expected behavior and inspect the actual result when run.
- Label a written walkthrough as review, not a live invocation or measured routing
  result. Automated routing evaluations are justified when routing is repeatedly
  unreliable or consequential; do not build an eval framework for a simple edit.
- Confirm required constraints remain visible in the main body. Every supporting
  file needs a direct link and a clear loading condition; remove duplicate content.
- Review defaults and command examples against the actual helper. Distinguish
  external runtime prerequisites from bundled dependencies.
- For CLI-backed execution, verify availability/compatibility checks precede costly
  dependent work and missing tools lead to owner installation guidance. A freshness
  warning must not become an unconditional network check or automatic upgrade.
- Treat heading wording, section count, empty optional directories, and progress
  marker syntax as editorial choices. Judge whether the workflow is understandable.

## Executable and installed behavior

- Run focused regressions for changed deterministic behavior, especially privacy,
  state preservation, parsing, or filesystem collisions. Preserve existing useful
  tests. Do not add tests that merely mirror implementation or prose.
- Regenerate product payloads and verify freshness, metadata, resource links, and
  source containment. Confirm build-only source and tests remain out of installation.
- Check declared runtime entrypoints, colocated test exclusion, and the version
  guard against the correct PR base. Apply the repository's policy to tests-only
  skill changes as well.
- When paths or packaging change, install into a temporary destination and run
  helpers from outside the checkout with their declared runtime dependencies only.
- Provider parsing, actual discovery, and successful invocation are different
  checks. For live trials, identify the loaded skill path to exclude an older
  same-named installation. Do not mutate active configuration without authorization.
- Use mocks or fixtures for external writes and credentials. Do not perform a live
  operation merely to prove a skill was packaged correctly.

## Report

State the changed contract, applicable checks and results, unmet prerequisites,
and unverified behavior. Keep formatting nits separate from correctness, authority,
portability, and progressive-disclosure findings. Do not inflate optional editorial
improvements into release blockers.
