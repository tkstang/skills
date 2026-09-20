# Cursor delivery boundary

## Current result

Cursor remains manual-only. Current bounded repository evidence does not expose
a verified native prompt-start, Stop-continuation, or async idle-rewake contract
that can carry exact session/worktree/event provenance and the required finite
ownership checks. No Cursor adapter is shipped or fabricated.

The probe tool can document one plan for each relevant boundary and at most one
configuration-correction retry. This phase had no authorization to invoke a
live Cursor provider, alter configuration or trust, spend quota, or perform
cleanup, so those plans were not executed and their observed result is
`unverified`. Repeating plans would not turn absence of authorization into
evidence.

## Safe fallback

Use the manual inbox at turn start and attempted turn end. The finite foreground
watch is not presented as native Cursor async wake, and no daemon or alternate
product is substituted. An enabled activation record alone does not change this
capability label.

Any future live investigation must name the exact Cursor version, native
surface, command, session/worktree identity, event provenance, timeout, quota,
trust/configuration mutation, and cleanup authority. An unsupported or unknown
receipt preserves manual fallback. One correction/retry is the maximum for that
authorized boundary.
