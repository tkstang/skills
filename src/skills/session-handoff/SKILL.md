---
name: session-handoff
description: Use when the user asks to hand off, transfer, or let another agent continue coding work. Produce concise evidence-grounded continuation context with an optional accepted sanitized transcript link.
license: MIT
metadata:
  author: thomas.stang
  version: '1.1.2'
compatibility: Agent Skills baseline. Uses read-only repository inspection when a repository is in scope. An exact stateless observer review is optional and may be unavailable for the current session.
argument-hint: '[successor or scope] [--out <path>]'
disable-model-invocation: false
user-invocable: true
---

# {{distribution.name}}

Prepare the next agent to continue a bounded piece of work. A handoff is a concise,
actionable account of the goal, decisions, evidence, remaining work, and approval
boundaries. It is not a verbatim transcript, retrospective, progress claim, or request
to modify the repository.

## When to Use

Use when the user asks to:

- hand work to another agent or person;
- prepare continuation context before starting a new coding session; or
- make an implementation-ready account of the current work and its safe next step.

Do not invoke merely because a turn is ending, when the user only wants a summary, or
when they only want a transcript export. Use the transcript-export workflow directly for
an explicit archive/export request. Use a retrospective workflow to assess the session
itself.

## Inputs and output destination

Resolve the intended successor, work scope, and any output path from the request. A
handoff request authorizes creating the named handoff artifact, but does not authorize
other repository changes, commits, pushes, installation, recovery, provider actions, or
broad transcript collection. A transcript companion is a separate optional write and
requires the user's acceptance before invocation.

- An explicit `--out <path>` or prose path selects the artifact destination.
- Default to inline output when no saved artifact is requested.
- For a requested saved artifact without a path, use
  `.oat/projects/shared/<active-project>/handoff.md` only when the project is
  explicitly identified by the user or established project context, that directory
  already exists, and the handoff belongs there. Do not infer a project from a branch
  name.
- Otherwise draft the handoff inline. Ask for a destination only when the user wants a
  saved artifact and no appropriate existing destination is available. Do not create OAT
  directories, project state, or other scaffolding merely to obtain a destination.
- Never overwrite an existing handoff unless the user explicitly asks to update that
  exact file. Preserve it and propose a unique adjacent filename when possible.

Read [the handoff template](assets/handoff-template.md) only when preparing the output.
It defines the compact artifact shape; omit headings with no useful content.

## Optional integration preflight

The `{{skill:session-observer}}` and `{{skill:session-export-transcript}}`
integrations are optional. Check only the current host's effective skill inventory
before choosing either integration. If one is absent, continue the core handoff with
conversation and repository evidence and omit that integration. Do not install or
fetch an optional skill, access transcripts directly, or use network discovery as a
preflight step.

## Workflow

### 1. Establish the continuation boundary

Restate the requested outcome, in-scope repository/worktree, intended successor, and
what the successor should do next. Keep requested, suggested, approved, completed, and
claimed states distinct. If a missing recipient or destination does not prevent an
inline draft, proceed with an explicit placeholder rather than blocking.

Preserve existing scoped authorization and record its exact action and boundary. A
handoff does not broaden it. Identify approval still needed only when the successor's
proposed work exceeds the authorization already in context, including implementation,
external writes, publication, deletion, recovery, or other consequential work.

### 2. Gather bounded continuation evidence

Use active-session context first. It may establish user intent, decisions made in this
conversation, and tool outcomes already visible here, but it is not a substitute for a
fresh repository snapshot when current Git state matters.

For each in-scope repository or worktree, inspect only what supports the handoff:

1. `git status --short`, current branch, and `HEAD` identity.
2. A bounded diff or changed-file summary when it explains work that remains or needs
   review. Do not inspect unrelated history or broad repository content.
3. Named artifacts, test output, jobs, and resources only when relevant to the stated
   successor task. Existing test output is evidence; an assertion that tests passed
   without inspectable output is a claim.

When a named pull request, remote job, or external resource materially affects the next
step, bounded read-only inspection may establish its current state. Do not broaden into
unrelated remote discovery, operate the resource, or wait for it merely to improve a
handoff.

Never switch branches, stash, reset, install dependencies, start/stop jobs, recover a
process, or rerun tests merely to improve a handoff. If fresh inspection is unavailable,
state the gap instead of presenting prior context as current.

### 3. Use observer evidence only when exact and stateless

`{{skill:session-observer}}` is optional and its installed contract decides which
session targets it supports. Read that contract before relying on observer evidence,
and do not parse raw transcript files.

Use observer material only when the user supplies an exact supported review result, or
when they explicitly request a review of a named peer session and the installed observer
supports a stateless `review` pinned to that exact runtime/session. Do not use `auto`,
newest-session selection, `catch-up`, `--mark-read`, watching, state reset, or a raw
transcript parser. The current observer contract excludes its own session, so current
session handoffs normally use active context and repository evidence instead. If a later
installed contract documents a safe exact stateless current-session target, use only
that documented method and report the capability basis. If an exact review cannot be
obtained, continue from active context and repository evidence, naming the missing
session evidence.

Do not copy private tool results, credentials, full prompts, or transcript passages into
the handoff. Summarize only the decision or outcome needed by the successor, with a
source label such as “user-confirmed,” “current-session observation,” “Git snapshot,”
or “exact observer review.”

### 4. Offer an optional transcript companion

When the installed `{{skill:session-export-transcript}}` skill is available, offer its
sanitized export as an optional companion to the handoff. Do not invoke it until the
user accepts. If the user declines or the capability is unavailable, continue with the
useful inline or requested saved handoff without treating the transcript as required.

After acceptance, invoke `{{skill:session-export-transcript}}` under its installed
contract. Add one Markdown link to the returned sanitized file in the handoff. Do not
copy, summarize, or quote the transcript in the handoff; the handoff's evidence summary
remains bounded to what the successor needs.

### 5. Separate evidence from assertion

Mark every material status as one of:

- **Verified:** supported by a fresh command result, a file/artifact actually read, or a
  directly observed completed action.
- **Claimed:** reported in context but not independently supported for this handoff.
- **Unknown or blocked:** unavailable, ambiguous, or waiting on a named owner/resource.

Do not turn a plan, a draft, an old status message, or a passing static check into proof
of implementation, deployment, publication, runtime health, or approval.

### 6. Deliver a successor-ready handoff

Use the template to write a compact artifact or inline draft. Include exact repository
host, worktree path, branch, commit, and dirty state when inspected; otherwise say what
was not checked. Label host and absolute paths as machine-local; for a shareable
destination omit unrelated machine details and use repository-relative references where
they suffice for continuation. Order next steps so the successor can begin with the
smallest safe verification or decision. Include pending jobs/resources only when they
affect that work, and describe them read-only without waiting or operating them.

Before writing, recheck the exact destination and preserve any existing artifact under
the rule in **Inputs and output destination**. Report the file written or that the result
remains inline. Do not commit, push, publish, create a memory, or modify global state.

## Review cases

- A user asks another agent to finish a partly edited repository. The handoff records a
  fresh dirty-state snapshot, separates changed files from completed behavior, and
  leaves test execution as a next step when no result was inspected.
- A user supplies a peer's exact observer review. The handoff summarizes its relevant
  decisions without copying transcript content or advancing observer state.
- The requested path already contains a handoff. The skill preserves it unless the user
  explicitly asks to update that file, then drafts inline or proposes a unique name.
- A user asks for a handoff outside OAT. The skill works inline or at the supplied path;
  it does not initialize `.oat/`.
- A user says “handoff my current Codex session” and the installed observer contract
  does not support that exact target. The skill uses current-session and repository
  evidence and reports that gap.

## Examples

- “Write a handoff for the agent continuing this PR. Save it to
  `notes/next-agent.md`.”
- “What does the next coding session need to know to finish the installer fix?”
- “Review the exact peer session I named, then prepare a handoff; do not change files.”

## Success Criteria

- A successor can identify the goal, scope, decisions and rationale, verified work,
  remaining work, blockers, and approval boundaries without reading a full transcript.
- Repository identity and status are current only where freshly inspected; all other
  state is labelled claimed, unknown, or unavailable.
- The handoff creates no side effects beyond an explicitly or implicitly authorized
  handoff artifact and never overwrites an unapproved existing file.
- A transcript companion is exported only after explicit acceptance, linked once, and
  not duplicated or summarized inside the handoff.
