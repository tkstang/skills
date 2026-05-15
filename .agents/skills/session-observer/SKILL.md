---
name: session-observer
version: 1.0.0
description: Use when checking what the other coding agent (Claude Code or Codex) just did in this project, reviewing a peer session, or catching up on new messages. Locates the active transcript, renders a tool-free digest, and tracks per-runtime read offsets.
argument-hint: '[review|catch-up|locate|state] [--runtime <claude-code|codex|auto>] [--debug]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion
---

# session-observer

<!-- Body filled in p05-t01 -->
