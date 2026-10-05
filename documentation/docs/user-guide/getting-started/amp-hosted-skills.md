---
title: 'Amp Hosted Skills'
description: 'Select generated standalone skills, publish a reviewed copy to Amp personal or workspace storage, and preserve upstream provenance when updating.'
---

# Amp Hosted Skills

Start with one instruction-only skill such as [Next Steps](../skills/next-steps.md).
A hosted copy makes the instructions available across Amp environments; it does
not supply local tools, credentials, transcript stores, or a new provider adapter.
This guide is based on Amp's [Skills](https://ampcode.com/docs/customize/skills)
and [Global Plugins & Skills](https://ampcode.com/docs/customize/global-plugins-and-skills)
documentation checked on 2026-10-04. Hosted publication and live skill execution
have not been verified for this collection.

## Choose the scope

| Scope            | Destination and owner                                             | Use it for                                                |
| ---------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| Hosted personal  | Your Amp personal skills Git repository                           | A reviewed skill you want across Amp environments         |
| Hosted workspace | The workspace skills Git repository, managed by workspace admins  | A tested skill shared with all workspace members          |
| Project          | The project's `.agents/skills/`                                   | Skills and resources that should travel with that project |
| Machine-local    | `amp skill add <source> --global` uses `~/.config/agents/skills/` | Skills needed only on that machine                        |

The first-party [`--agent amp` installer](../installation.md#first-party-installer)
selects project `.agents/skills/` or user `~/.agents/skills/` placement. Its user
scope is also machine-local; neither installer publishes to hosted personal or
workspace storage. Amp's use of “global” for hosted repositories and the CLI's
`--global` flag refer to different scopes.

## Select a compatible payload

Copy from the generated `skills/<name>/` directory in a reviewed upstream
revision. Preserve its complete files and its `metadata.version`. The canonical
owner remains `src/skills/<name>/` in `tkstang/skills`; the hosted directory is a
distribution copy. Never import `src/skills/`, the entire repository, or plugin
skill directories as a substitute for a standalone payload.

Hosted repositories require immediate children such as `next-steps/SKILL.md`,
with directory and frontmatter `name` matching. A nested `skills/next-steps/`
layout is not the hosted layout. Amp's recursive local discovery does not
establish hosted nesting or symlink support. Copy regular files and directories.

Amp documents a per-repository maximum of 200 skills and 25 MiB, plus 200 files
per skill, 10 MiB per file, and 25 MiB per skill; hosted files must be text.
Include the repository's existing contents when checking capacity. Above 200
skills, a Git push can succeed while only the first 200 alphabetical directories
are loaded. Keep large or non-text resources in a project skill rather than
removing required resources to fit the hosted limit.

At upstream revision `1f9f4e2` on 2026-10-04, the 17 standalone payloads contain
102 regular text files totaling 5,611,693 bytes. The largest skill has 19 files
and 2,180,634 bytes; the largest file is 516,172 bytes. No symlinks or
name/directory mismatches were found. These are static packaging measurements,
not live Amp acceptance. Do not bulk-import the collection: choose by its
runtime requirements and existing skill names.

| Selection                                                                                                                                    | Static portability boundary                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `next-steps`, `align`, `must-we`                                                                                                             | Instruction-only starting points; no bundled runtime                                                                                        |
| `author-skill`, `complexity-review`                                                                                                          | Instruction-only; filesystem/repository access is needed for file work, and Complexity Review uses Git for repository history               |
| `session-handoff`                                                                                                                            | Core handoff can use conversation and repository evidence; observer/export integrations are optional and do not gain Amp transcript support |
| `babysit-pr`, `land-pr`                                                                                                                      | Need authenticated GitHub access, Git and repository checks; Land PR also requires Babysit PR and merge authority                           |
| `phone-a-friend`                                                                                                                             | Needs Node.js 22+ and an installed, authenticated supported peer CLI; hosted storage does not provide these prerequisites                   |
| `consensus-review`                                                                                                                           | Requires Node.js 22+ and a supported actual host/provider; its current `--host` accepts Claude, Codex or Cursor, not Amp                    |
| `session-export-transcript`, `session-search`, `session-fork-to-destination`, `session-observer`, `session-observer-collab`, `session-retro` | Depend on supported local provider stores, identities or exporter/observer workflows; no Amp transcript adapter is included                 |
| `agent-messaging`                                                                                                                            | Local collaboration state and exact supported native identities; its current runtime pins exclude Amp                                       |

Six plugin-only Consensus workflows (`create`, `decide`, `evaluate`, `panel`,
`plan`, `refine`) use a shared helper outside their skill directory. Extracting
those directories loses the complete plugin boundary. Use the supported plugin
form in an appropriate host; the collection's Claude/Codex/Cursor plugin
manifests are not Amp plugin registrations.

## Prepare a hosted personal copy

Amp can manage hosted repositories through a thread. For a skill already
published with an Amp share URL, ask it to import that shared skill into your
personal skills. Amp records import origin and can prepare later updates. A
GitHub directory URL is not established here as an Amp share URL.

For this upstream Git distribution, use the documented repository workflow:

1. Choose a reviewed upstream commit or release checkout containing the generated
   payload. Run `pnpm run build:check` in that developer checkout to verify
   generation freshness; installation itself needs no build. Note the full
   commit SHA, payload path, skill version and upstream license.
2. Run `amp skills repositories` to identify your repository and write access,
   then `amp clone user-skills` to obtain its checkout. Inspect existing skills
   and capacity before adding the selected payload.
3. In that hosted checkout, copy the complete reviewed `skills/next-steps/`
   payload to a new immediate child named `next-steps/`. Refuse an existing
   destination, including a symlink. Do not overwrite a same-name skill or
   copy the surrounding upstream `skills/` directory.
4. Compare the copied file inventory and bytes with the upstream payload.
   Review the Git diff, preserve upstream attribution/license notices, and
   record `tkstang/skills`, the full source SHA, `skills/next-steps/`, and its
   `metadata.version` in the hosted commit message. Keep authored fixes upstream.
5. Review and commit the copy. Push only when you intend to publish to that
   account. Publication is a separate action from preparing the local copy.
6. Start a fresh Amp thread or ask Amp to reload skills. Ask which `next-steps`
   skill was loaded and where it came from, then try the bounded request in
   [Getting Started](index.md#try-a-bounded-request). Record actual discovery,
   invocation and permission results before claiming live compatibility.

Local and built-in skills take precedence over hosted skills; hosted personal
skills also mask same-name workspace skills. Inspect origin, not only the name.
`amp skills list` in another shell does not reload an existing thread. If a
required tool or compatible identity is missing, stop that dependent workflow.
Do not relabel Amp as Codex or install a provider CLI merely because the payload
was accepted.

## Update and share deliberately

A copied upstream payload has no continuous synchronization contract. Select a
new reviewed upstream revision, compare it with the recorded source revision,
and prepare replacement of only the previously imported skill directory in the
hosted checkout. Review local modifications before replacement, include added
and removed payload files, and compare the resulting inventory and bytes with
the new generated payload. Preserve its version and record the new source SHA.
Review, commit and push to publish; then reload or start a fresh thread and
repeat bounded acceptance. Bring portable fixes back to the canonical upstream
owner instead of maintaining a second authored skill.

For an **Amp shared import**, Amp documents asking it to check imported skills
for updates or running `amp skill update <name>` from the hosted repository
checkout. Review, commit and push the prepared update. This updates the recorded
shared origin; it does not establish automatic tracking of `tkstang/skills`
for a manual Git copy, nor does it silently overwrite your changes.

After personal acceptance, share through Personal Settings → Skills → Share.
A workspace admin can copy a tested shared skill into the workspace repository,
review and publish it. Sharing a URL and publishing for every workspace member
are distinct actions. Recheck the destination's capacity and name conflicts,
then verify discovery and bounded behavior in that scope.
