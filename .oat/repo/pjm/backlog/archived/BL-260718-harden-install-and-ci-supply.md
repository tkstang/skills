---
id: BL-260718-harden-install-and-ci-supply
title: Harden install and CI supply-chain posture
status: closed
priority: medium
scope: task
scope_estimate: S
labels:
  - repo-audit
  - security
  - ci
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T08:18:21Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-supply-chain-ci-hardening.md
---

## Description

install.sh fetches and installs the runtime with no integrity verification (TOFU-over-HTTPS only); all GitHub Actions are tag-pinned rather than SHA-pinned (release.yml runs with contents: write); validate.yml has no concurrency group so rapid pushes queue duplicate six-job runs. Add optional CONSENSUS_INSTALL_SHA256 verification, SHA-pin all actions with Dependabot upkeep, and add the concurrency group.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-supply-chain-ci-hardening.md`, planned at commit 8309623).

## Acceptance Criteria

- CONSENSUS_INSTALL_SHA256 verified on both install paths; unset behavior unchanged; RELEASING.md documents checksum publication
- Every workflow uses: is a 40-hex SHA pin with version comment; Dependabot covers github-actions
- validate.yml has a cancel-in-progress concurrency group; full contract passes
