---
name: oat-idea-scratchpad
version: 1.2.0
description: Use when you need quick idea capture or want to review scratchpad entries. Manages lightweight idea seeds and optional notes.
argument-hint: '[review | capture] [--global]'
disable-model-invocation: true
user-invocable: true
allowed-tools: Read, Write, Bash, Glob, AskUserQuestion
metadata:
  internal: true
---

# Scratchpad

Review your ideas scratchpad or quick-capture a new idea seed.

## Progress Indicators (User-Facing)

- Print a phase banner once at start using horizontal separators, e.g.:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OAT ▸ SCRATCHPAD [project]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Replace `[project]` with `[global]` when operating at user level.

- Before multi-step work, print step indicators, e.g.:
  - `[1/2] Resolving ideas level…`
  - `[2/2] Reading scratchpad…` (review mode) or `[2/2] Capturing new idea…` (capture mode)

## Process

### Step 0: Resolve Ideas Level

Determine whether to operate at project level or user (global) level. The scratchpad does not require an active idea.

**Resolution order:**

1. If `$ARGUMENTS` contains `--global` → use **user level**
2. If `.oat/config.local.json` has `activeIdea` pointing to a valid directory → use **project level**
3. If `~/.oat/config.json` has `activeIdea` pointing to a valid directory → use **user level**
4. If BOTH `.oat/ideas/` AND `~/.oat/ideas/` exist →
   ask: "Ideas exist at both project and user level. Where should this idea go?"
   options: "Project (.oat/ideas/)" / "Global (~/.oat/ideas/)"
5. If `.oat/ideas/` exists → use **project level**
6. If `~/.oat/ideas/` exists → use **user level**
7. Otherwise → ask: "Project-level or global (user-level) ideas?"

**Set variables:**

| Variable         | Project Level          | User Level               |
| ---------------- | ---------------------- | ------------------------ |
| `IDEAS_ROOT`     | `.oat/ideas`           | `~/.oat/ideas`           |
| `TEMPLATES_ROOT` | `.oat/templates/ideas` | `~/.oat/templates/ideas` |

### Step 1: Determine Mode

If `$ARGUMENTS` contains `review`, go to Step 2.
If `$ARGUMENTS` contains `capture`, go to Step 3.
Otherwise, ask the user: "Would you like to **review** what's on the scratchpad, or **capture** a new idea?"

### Step 2: Review Mode

1. Read `{IDEAS_ROOT}/scratchpad.md`
2. If the file does not exist or contains only the template placeholder entry, tell the user: "Scratchpad is empty. Would you like to capture your first idea?" If yes, go to Step 3. Otherwise, stop.
3. Parse entries and display grouped by status:
   - **Open ideas** (`- [ ]`): show count and list with summaries and any nested notes
   - **Started** (`- [x]`): show count and list (collapsed summary)
4. Offer next actions (suggest to the user — do **not** auto-invoke):
   - "Capture a new idea" → go to Step 3
   - "Start brainstorming on one" → "Run the `oat-idea-new` skill with the idea name"
   - "Done" → stop

### Step 3: Capture Mode

1. Ask for idea name if not provided in `$ARGUMENTS`. **Validation:** slug format only — alphanumeric, dashes, and underscores.
2. Ask for a one-liner summary (required, 1 sentence).
3. Ask: "Any quick notes? (optional — press enter to skip)"
   - If the user provides notes, capture them. Ask "Another note?" until the user declines or provides an empty response.
4. Initialize scratchpad if needed:
   - Create `{IDEAS_ROOT}/` directory if it does not exist (`mkdir -p`)
   - If `{IDEAS_ROOT}/scratchpad.md` does not exist, copy from template:
     - Source: `{TEMPLATES_ROOT}/ideas-scratchpad.md`
     - Target: `{IDEAS_ROOT}/scratchpad.md`
   - If `{IDEAS_ROOT}/backlog.md` does not exist, copy from template:
     - Source: `{TEMPLATES_ROOT}/ideas-backlog.md`
     - Target: `{IDEAS_ROOT}/backlog.md`
5. Append entry to `{IDEAS_ROOT}/scratchpad.md` under the `## Ideas` section:

   ```markdown
   - [ ] **{idea-name}** - {one-liner summary} _(YYYY-MM-DD)_
     - {note 1}
     - {note 2}
   ```

   Include nested bullets only if the user provided notes.

6. Confirm capture:

   ```
   Captured "{idea-name}" on the scratchpad.

   Scratchpad: {IDEAS_ROOT}/scratchpad.md
   ```

7. Ask: "Capture another idea, or done for now?"
   - If another → repeat from step 1 of Capture Mode
   - If done → suggest next steps (suggest to the user — do **not** auto-invoke):
     - "Start brainstorming: run the `oat-idea-new` skill with the idea name"
     - "Review scratchpad: run the `oat-idea-scratchpad` skill with `review`"

## Success Criteria

- ✅ Scratchpad reviewed or new entry captured
- ✅ `{IDEAS_ROOT}/scratchpad.md` exists (initialized from template if first use)
- ✅ New entries use nested-bullet format (name + summary + optional notes)
- ✅ User informed of next steps
