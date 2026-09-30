# Starter template

Use this shape for a multi-step product skill. Replace placeholders and omit
unnecessary sections. Its version field is the default when the target repository
has no different skill-version policy. For a small command-like helper, collapse the workflow into
clear execution and result instructions. Add supporting files only when useful.

```markdown
---
name: example-skill
description: Use when [specific request or condition]. [Distinguishing capability].
metadata:
  version: '1.0.0'
---

# Example Skill

State the intended outcome and important scope boundary.

## Inputs

Document required and optional inputs, defaults, and how missing information is
resolved. Infer explicit user intent rather than requiring a particular command
parser on every host.

## Workflow

### Step 1: Establish context

Read the governing instructions and source evidence. Resolve required authority
and dependencies before work that needs them. Preserve existing authorization.
For a required CLI, first verify its executable and supported version/capabilities;
provide its installation/update link if unavailable or incompatible. Perform that
cheap check before loading lengthy task references. Do not auto-install or upgrade.

### Step 2: Perform the task

Give concrete instructions. Link directly to any supporting reference and state
the condition under which it should be loaded. Resolve bundled files from the
loaded skill directory; identify external resources separately.

### Step 3: Verify and report

Check the outcome and describe useful failure or partial-result behavior. Report
what was verified and what remains uncertain.

## Examples

- Codex: `$example-skill <input>`
- Claude Code: `/example-skill <input>`
- Natural language: “Perform this specific task with these inputs.”
```

Choose provider extensions only after checking their semantics. Do not mechanically
add manual-invocation flags, tool grants, delegation tiers, or approval gates to
every skill.
