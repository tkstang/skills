# Upstream Handoff Prompt: Hide OAT Tooling Skills from Public Skill Discovery

You are working in the `open-agent-toolkit` repository.

## Goal

Add `metadata.internal: true` to the OAT tooling skill definitions at the pack
source so the skills installed by `oat init`, `oat tools install`, and
`oat sync` are hidden from normal `npx skills` discovery when they are synced
into downstream repositories as `.agents/skills/**`.

## Why This Must Be Fixed Upstream

Downstream repositories receive `.agents/skills/**` as synced mirror files. A
hand-edited `metadata.internal: true` flag in a downstream repo is overwritten
the next time `oat sync` or the relevant OAT tools install path regenerates those
files.

The durable source of truth must be the `open-agent-toolkit` pack source that
emits the OAT tooling skills. Once the upstream pack source carries the flag,
the flag can flow through every install/sync path instead of depending on local
post-edits.

## Affected Skill Set

Apply the flag to OAT framework/tooling skills that are installed into
downstream repos under `.agents/skills/**`, including the `oat-*` workflow,
project-management, docs, review, repo, and core-pack tooling skills.

Do not apply this change to downstream standalone public skills such as
`skills/session-observer` or `skills/export-session-transcript` in
`tkstang/skills`.

Do not apply this change to the `tkstang/skills` consensus plugin skills under
`plugins/consensus/skills/**`; those remain discoverable through the plugin
path and are handled separately by standalone recovery work.

## Implementation Requirements

1. Locate the `open-agent-toolkit` source definitions or templates that generate
   the OAT tooling skill `SKILL.md` files installed by `oat init`,
   `oat tools install`, and `oat sync`.
2. Add `metadata.internal: true` to those OAT tooling skill definitions at the
   source level.
3. Preserve any existing `metadata` fields, including version fields, names,
   descriptions, and other pack metadata.
4. Regenerate or refresh any committed derived skill files according to the
   `open-agent-toolkit` repository's existing build/sync workflow.
5. Run the repository's normal validation for skill metadata and generated
   output.

## Expected Post-Sync Verification

After the upstream change lands, sync the updated OAT tooling skills into a
downstream repository such as `tkstang/skills`, then verify the public discovery
surface with the Vercel skills CLI:

```bash
npx skills add tkstang/skills --list
```

Expected result: normal discovery no longer surfaces the downstream
`.agents/skills/**` OAT tooling skills.

Then verify the internal entries are still available when explicitly requested:

```bash
INSTALL_INTERNAL_SKILLS=1 npx skills add tkstang/skills --list
```

Expected result: the `.agents/skills/**` OAT tooling skills reappear in the
internal-inclusive listing.

Also confirm that the intended public standalone entries in `skills/**` and the
consensus plugin discovery path are not hidden by this change.

## Boundary for `tkstang/skills` Public Discovery Project

For the `tkstang/skills` public-discovery project, this prompt is the committed
handoff deliverable for the category-3 OAT tooling skill work. The actual hiding
outcome is deferred until this upstream change lands and is synced back into
`tkstang/skills`.

Track that follow-up verification against backlog item
`BL-260621-control-public-skill-discovery`; do not treat the downstream hiding
outcome as closed before the post-sync checks above pass.
