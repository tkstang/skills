# Evidence for import then native fork

Snapshot: 2026-09-30; historical experiment ran 2026-09-29. Read-only inspection this turn verified all 12 [manifest](experiment/manifest.json) hashes and tool structures in both providers' first/second requests. No clients were rerun.

| Tested boundary | Client | Evidence and limit |
| --- | --- | --- |
| Claude → Codex seed → native child → continuation/restart/resume | Codex 0.157.1 | [Result](experiment/codex-result.json), [first request](experiment/codex-first-request.json), [second request](experiment/codex-second-request.json), [persisted history](experiment/codex-child-final.json). Full lifecycle uses app-server `thread/fork`. |
| Codex → Claude seed → native child → continuation/restart/resume | Claude Code 2.1.284 | [Result](experiment/claude-result.json), [first request](experiment/claude-first-request.json), [second request](experiment/claude-second-request.json). Uses `--resume SEED --fork-session`. |
| Separate terminal Codex fork | Codex 0.157.1 | [Result](experiment/codex-cli-fork-result.json): distinct child, `forked_from_id`, canonical destination cwd, imported text/tools; no model turn. |

Each lifecycle request pair contains two completed native tool calls/results with matching original IDs; second requests also retain the first synthetic reply. Results report unchanged source/seed hashes and distinct children. Codex terminal child differs from its RPC lifecycle child. Initial Claude lookup failed for `/tmp` versus `/private/tmp`; canonical destination fixed its project-store key. [Report](experiment/report.md) and [probe](experiment/probe.py) preserve details.

Historical isolation used synthetic fixtures, disposable Git worktrees/provider homes, dummy credentials, allowlisted environment and [loopback-only sandbox](experiment/loopback.sb). This proves tested loading/request construction/persistence, not production service acceptance, GUI placement, arbitrary histories or future clients. Preserved scripts retain historical local paths/dependencies and are evidence, not a portable supported runner; implementation migrates synthetic behavior into Node tests.

Source reference: Claude Session Teleporter 1.2.0, commit `39fd13ae4e4f1c7b484872561226da3764ab5a21`, retained locally under `/tmp/teleporter-review.pjO2qj/aviadr1-claude-session-teleporter-39fd13a`. `claude_sessions.py:2499-2667` covers active chains/sibling results and compaction/inherited headers; `2724-2835` native encoders/adjacency; `2854-2906` no-clobber publication. `docs/teleport-native-tools.md` records loader-repair failures. Adapted substantial logic/fixtures require Aviad Rozenhek's MIT copyright/permission notice from `LICENSE`. Desktop registration, round-trip metadata and upstream Python are outside scope.

Existing reuse: `guidance.ts:110-223` prepares commands; `git-target.ts:260-333` qualifies/revalidates worktrees; `guidance-discovery.ts:332-361` selects exact candidates. Shared `transcript/runtimes.ts:1074-1169` skips malformed lines; `1965-2083` omits ordinary function outputs. Neither sanitized preview nor observation normalization is native-import input. [Design](design.md) uses a private strict reader and preserves the retired executor boundary recorded in [DR-260912](../../decisions/DR-260912-separate-forks-and-handoffs.md).
