# Contested Rollout Options

## Context

The team needs to choose how to ship the new workspace export flow. The feature is useful now, but the broader migration would reduce future cleanup.

## Options

### Option A: Ship the Smaller Scope This Week

- Enables customers to export one workspace at a time.
- Keeps the release reversible.
- Leaves bulk export and scheduling for a later iteration.

### Option B: Wait for the Broader Migration

- Ships workspace export with the new bulk export backend.
- Reduces duplicate migration work.
- Delays customer access by at least two weeks.

## Decision Criteria

- Prefer reversible releases.
- Do not hide migration risk.
- Keep customer-visible value moving unless the operational risk is high.

## Known Dissent

- Support prefers Option A because customers are already asking for single-workspace export.
- Platform prefers Option B because it reduces duplicated backend work.
