# Immutable phase review packet

Captured: 2026-09-21T02:17:13.370090+00:00
Repository: /Users/tstang/orca/workspaces/skills/session-fidelity
Base: 59285699e76d29b3e7f63df702e6e1f72085344d
Reviewed HEAD: 8c65be6c1b6c4b819c9da4b93551c03d2a175192
Checkout status: clean

## Request

Focused verification of one instruction-only follow-up to a VALID full final integration pass (Consensus run a0d67b6b-d460-42c9-b1a6-5d7c6da06367, reviewed39aeee12). Full review had0Critical/High/Medium, three Low: L1 root declined after observing legacy pollTargets already skips unchanged source signatures; suggested same-signature check does not change later changed-source deltas, and Cursor same-signature paths never produce usage errors. L3 packet prose undercount is corrected by authoritative2521pass/1skip receipt and a separate immutable-packet erratum. Do not reopen the full product audit. Verify only L2: canonical exporter instructions now mirror maintained docs describing the opt-in Structured Activity Capture Index, one stable key per captured call, can be large, JSON graph source of truth. Check version/generated/changelog closure, and that no runtime/test behavior changed. Reference the prior full pass as context; assess this bounded delta independently. Read-only, no tools that mutate, no tests/builds/provider calls. Return valid schema: no invented fields; external-document anchors, supplied packet SHA for inspected_context; checks not personally run must be not_run. A pass forbids C/H and failed checks; if an actual check failed without C/H, return inconclusive. Do not inflate severity or alter check statuses to force a verdict. The current full suite is2521passed/1skip and runtime unchanged from931f81db; this instruction-only delta has build/freshness/validate/two-owner phasebaseversions/scopedformat/self-review passed.


## Scope adaptation

The base-branch selector captures entire before/after files including generated bundles and is capped at 2 MiB. This packet preserves the exact authored before/after Git diff (including deletions), all changed-file hashes, and immutable base/head references instead. Historical review artifacts and previously captured review packets are represented by hashes rather than recursively embedded; they remain available through the immutable revisions for context. Generated content is checked by build:check and version validation, with parity inspected where needed. The reviewer may read repository context and git-show either immutable revision but must not mutate any file or invoke providers. The whole checkout stays stable during review. Findings should use an anchor into THIS external packet with the exact packet SHA256 supplied by the wrapper; name the affected repository path/line in the claim/evidence. Never invent captured repository locations for files that are only context. This is a code-diff review carried as an external document, not an architecture-only plan review.

## Changed file manifest

```json
[
  {
    "path": "CHANGELOG.md",
    "generated": false,
    "base": {
      "bytes": 47046,
      "sha256": "c4c9d9704f1c53918ec2d1afed267206bee71098cd407eeffe2b2070531bb562"
    },
    "head": {
      "bytes": 47437,
      "sha256": "4721233e0cb0f3db8e25e1e150b04e1e976a2c2273c8a73ae7cf849b4ee27fbe"
    }
  },
  {
    "path": "plugins/session/skills/export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 14119,
      "sha256": "860c2488f872abe13be60fbd5f3b2f77afdebd08febbf72c78088ef077d1c60a"
    },
    "head": {
      "bytes": 14350,
      "sha256": "ae53021dddf66d72c0ba1f0745c59f0009208dd00e76bf017af04d883fff0370"
    }
  },
  {
    "path": "plugins/session/skills/fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4412,
      "sha256": "47810c223b7eae2327f852addedfbcbc319062d538d5a0eb45481f27c971530b"
    },
    "head": {
      "bytes": 4412,
      "sha256": "7f59eaf40a3a8a10976c011e67acf99d9deb2bc5f0cf68d51979928f89d73051"
    }
  },
  {
    "path": "skills/session-export-transcript/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 14135,
      "sha256": "901faf4c17bc4cb62c2111cd4b140171e0a49b3f571febf64c056f3f77ef4db2"
    },
    "head": {
      "bytes": 14366,
      "sha256": "e8a1af841ce1d98d96930143bb329c47dfa991f97e45dc11da2fb77d05bb0c2c"
    }
  },
  {
    "path": "skills/session-fork-to-destination/SKILL.md",
    "generated": true,
    "base": {
      "bytes": 4428,
      "sha256": "01d15dcd1b3136859a957649f506d1fcc82626ea4d05c1077aac1368a9821886"
    },
    "head": {
      "bytes": 4428,
      "sha256": "ae48f1a41ff68694d6cd9e95a855b40ccd02f934b53c1860ef9e254612ff2987"
    }
  },
  {
    "path": "src/skills/session-export-transcript/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 14131,
      "sha256": "303e8af22d41445fcb3b82c5bb18db92fd72553fe552869e1ea16a78d6d6690b"
    },
    "head": {
      "bytes": 14362,
      "sha256": "7e70e44baa17afe0642fd054d59bfe120444a7a8282d0318c927f4fe8b0a79a9"
    }
  },
  {
    "path": "src/skills/session-fork-to-destination/SKILL.md",
    "generated": false,
    "base": {
      "bytes": 4422,
      "sha256": "18f0513ca6936839772a4bde056cd2f3454253c88ceb0bf93efb10f61c6d6171"
    },
    "head": {
      "bytes": 4422,
      "sha256": "0afccbec460f8535c4b63ba4aae4c44c12835d15ddcc8e49a79b3f87b9954001"
    }
  }
]
```

## Authored before/after diff

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index b7dd3a29..07779d2d 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -9,16 +9,22 @@
   all seven coverage states, and separates frozen observations from
   interpretation and proposed changes. The exact-session workflow requires
   Session Export Transcript and removes the former optional Session Observer
   enrichment path; active or unknown-ended targets remain captured-activity
   reviews.
 
 ### Fixed
 
+- `session-export-transcript` 2.0.34 adds the opt-in Structured Activity Capture
+  Index contract to its canonical instructions: one stable invocation key per
+  captured call, a potentially large list, and the sensitive JSON as graph
+  source of truth. `session-fork-to-destination` 0.2.48 receives the required
+  validation-only exporter source closure; its runtime behavior is unchanged.
+
 - `session-observer` 1.0.81 and `session-export-transcript` 2.0.33 distinguish a
   source-wide usage extraction failure as `not-read` with a content-free
   diagnostic instead of reporting runtime capability absence; the exporter now
   also documents its opt-in narrative invocation-key index.
   `session-observer-collab` 1.0.69 and `session-fork-to-destination` 0.2.47
   receive the required shared activity source closure.
 
 - `session-export-transcript` 2.0.32 protects external hardlink aliases to any
diff --git a/src/skills/session-export-transcript/SKILL.md b/src/skills/session-export-transcript/SKILL.md
index ab47e079..7e393fc4 100644
--- a/src/skills/session-export-transcript/SKILL.md
+++ b/src/skills/session-export-transcript/SKILL.md
@@ -4,17 +4,17 @@ description: Use when the user asks to export, save, or download the current cod
 license: MIT
 compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies.
 argument-hint: '[output-path] [--runtime <claude-code|codex|cursor|auto>] [--match <marker>] [--session <id>] [--all] [--include-activity] [--activity-output <path>] [--out <path>]'
 disable-model-invocation: false
 user-invocable: true
 allowed-tools: Bash, Read
 metadata:
   author: thomas.stang
-  version: '2.0.33'
+  version: '2.0.34'
 ---
 
 # {{distribution.name}}
 
 Exports the **current** conversation (yours — Claude Code, Codex, or Cursor) to a
 sanitized Markdown transcript, named after the current git branch, written by
 default to `~/Downloads`. Tool calls, tool results, system/developer instructions,
 environment/AGENTS.md/skill payloads, subagent notifications, automatic-control
@@ -168,16 +168,20 @@ activity report schema in `complete-capture` mode, with no total-byte or
 invocation eviction and the same 2 KiB cap on each preview. It also carries the
 shared capture timestamp, native identity evidence, source/decoded record
 counts, and message-free narrative entry coordinates matching stable anchors in
 the paired Markdown. Malformed or partial records remain visible through honest
 coverage, diagnostics, and counts. Complete means every supported invocation in
 the captured bytes; it does not prove the session stopped or that the runtime
 recorded every action.
 
+The paired Markdown adds a **Structured Activity Capture Index** with one stable
+invocation key per captured call; this opt-in list can be large, and the
+sensitive JSON remains the source of truth for the captured activity graph.
+
 The activity destination may be absent or an existing ordinary file. An
 existing ordinary file is replaced atomically through an exporter-owned
 temporary sibling. Directories, symlinks, special files, the source transcript,
 the narrative output, and both Observer checkpoint/watch roots — the effective
 `STATE_DIR` root and the fixed default `~/.local/state/session-observer` — are
 rejected before either output is written. Independently relocated collaboration roots are
 outside this guard. Destination validation precedes both writes, but the pair is
 not a filesystem transaction: a later activity JSON failure leaves the already
diff --git a/src/skills/session-fork-to-destination/SKILL.md b/src/skills/session-fork-to-destination/SKILL.md
index c2eb252c..cc0f7c92 100644
--- a/src/skills/session-fork-to-destination/SKILL.md
+++ b/src/skills/session-fork-to-destination/SKILL.md
@@ -4,17 +4,17 @@ description: Use when the user wants to find a Codex or Claude Code conversation
 license: MIT
 compatibility: Alpha guidance workflow; provider coverage and end-to-end verification are incomplete. Requires Node.js 22+ and local provider transcript stores for read-only discovery. The user runs any provider command manually.
 argument-hint: '[source-worktree] [destination-worktree]'
 disable-model-invocation: false
 user-invocable: true
 allowed-tools: Read, Bash(node <skill-dir>/scripts/session-fork-to-destination.mjs:*)
 metadata:
   author: thomas.stang
-  version: '0.2.47'
+  version: '0.2.48'
 ---
 
 # {{distribution.name}}
 
 > **Alpha.** This skill discovers and previews local sessions
 > read-only, then prepares instructions. It does not run a provider, authenticate,
 > create a fork, write a receipt, retry, reconcile a child ID, or control an IDE tab.
 

```
