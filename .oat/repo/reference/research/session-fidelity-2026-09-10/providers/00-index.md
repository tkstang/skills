# Provider schema catalog

These 17 guides cover the union of providers implemented in the reviewed repository registries. The native schemas are partial observational references. They describe known carriers and permit unknown fields; they are **not** an assertion of complete log fidelity or live compatibility with the newest client release.

The initial implementation target remains Claude Code, Codex, and then Cursor. The other providers are future adapter references, not requirements for the first optional flag.

| Provider guide | Schema fragments | Evidence keys |
|---|---:|---|
| [Claude Code](01-claude-code.md) | 1 | S-CORE, S-FORMATS, C-SCHEMAS, C-CLAUDE, C-TOOLS, R-CLAUDE |
| [Codex](02-codex.md) | 1 | S-CORE, S-FORMATS, C-SCHEMAS, C-CODEX, R-CODEX, X-PARSER |
| [Cursor agent transcripts](03-cursor.md) | 1 | S-CORE, S-OBSERVER-GUIDE, C-CURSOR, C-SCHEMAS |
| [GitHub Copilot CLI](04-copilot.md) | 2 | C-SCHEMAS, C-COPILOT |
| [Gemini CLI](05-gemini.md) | 2 | C-SCHEMAS, C-GEMINI |
| [OpenCode](06-opencode.md) | 2 | C-SCHEMAS, C-OPENCODE, R-README |
| [Factory Droid](07-droid.md) | 2 | C-SCHEMAS, C-DROID, C-TOOLS |
| [Amp](08-amp.md) | 1 | C-AMP, R-AMP, R-README |
| [Kiro IDE, persisted logs, and ACP](09-kiro.md) | 3 | C-KIRO |
| [Crush](10-crush.md) | 2 | C-CRUSH |
| [Cline](11-cline.md) | 2 | C-CLINE, C-REGISTRY |
| [Roo Code](12-roo-code.md) | 2 | C-CLINE, C-REGISTRY |
| [Kilo Code](13-kilo-code.md) | 3 | C-CLINE, C-REGISTRY |
| [Antigravity: CLI and IDE surfaces](14-antigravity.md) | 1 | R-ANTIGRAVITY, C-ANTIGRAVITY |
| [Kimi](15-kimi.md) | 2 | C-SCHEMAS, C-KIMI |
| [Qwen Code](16-qwen-code.md) | 1 | C-SCHEMAS, C-QWEN |
| [Pi](17-pi.md) | 1 | R-PI, R-README, R-PROVIDER |

## Surface distinctions worth keeping

Antigravity CLI transcript JSONL is separate from IDE protobuf/artifact state. Kiro IDE, persisted envelopes, ACP replay, and opaque ordinary CLI SQLite are separate. Amp local threads differ from authenticated cloud exports. Cline-family UI history differs from API history. OpenCode/Crush/Kilo SQL rows are not JSONL records.

Every guide includes storage/identity, field descriptions, ordering and correlation rules, tool fidelity limitations, reuse implications, and a synthetic example. Read the [schema interpretation guide](../10-schema-guide-and-coverage.md) before treating a schema as an ingestion contract.

[Source manifest](../sources/evidence.json) · [Schema/example manifest](../schemas/catalog.json) · [Packet README](../README.md)
