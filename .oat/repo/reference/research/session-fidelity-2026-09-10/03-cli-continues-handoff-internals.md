# 03. How cli-continues builds a handoff

## It is deterministic extraction, not an LLM-written summary

The main path is:

```text
Native source -> provider discovery -> UnifiedSession
                                      |
                                      v
                            adapter.extractContext()
                                      |
                  +-------------------+------------------+
                  |                   |                  |
            conversation        tools/results       session notes
                  |                   |                  |
             tail selection      category samples      selected metadata
                  +-------------------+------------------+
                                      |
                          generateHandoffMarkdown()
                                      |
                   inline prompt or .continues-handoff.md
                                      |
                              receiving agent
```

The extraction and rendering functions assemble the document in code. A native same-provider resume bypasses this handoff extraction and invokes the original CLI. [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

## Shared Anthropic-style tool machinery

`extractAnthropicToolData()` is reused by Claude, Droid, and Cursor adapters. It performs two passes. First, it indexes tool-result text by `tool_use_id`. Second, it scans `tool_use` blocks, attaches the matching result, classifies the original tool, derives a category-specific sample, and passes it to `SummaryCollector`. [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

| Category | Data derived by the inspected implementation | Important omissions or qualifications |
|---|---|---|
| Shell | Command, parsed exit code, output tail, error preview | Wrapper text is not necessarily pure stdout; no general process-lifecycle graph. |
| Read | File path, optional start/end line | Actual file contents are normally reduced to a short result excerpt/path-oriented sample. |
| Write | Path, content displayed as additions, optional new-file inference | New-file status can be inferred; no guaranteed filesystem snapshot. |
| Edit | Path, old/new replacement display or patch preview, displayed line counts | Synthesized replacement display is not necessarily an applyable or verified Git diff. |
| Grep/glob | Query/pattern/path and heuristic match counts | Counts can be parsed from prose; they are not universally native fields. |
| Search/fetch | Search query or URL and small result preview | Full retrieved documents are not carried through. |
| Task/agent | Description, agent type where present; selected task-result preview | Parent-visible summary, not every child event. |
| Ask | A short question sample | Your richer ask-user answer/provenance logic should take precedence. |
| MCP/generic | Tool identity, serialized parameters, short output | Classification/grouping and truncation vary by adapter. |
| Reasoning-style tools | Recorded step/thought/outcome/next-action fields | These are source-recorded values, not access to hidden model state. |

Evidence: [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts)

### Shortcuts not to copy blindly

* **Only the first text block of an array result is taken** in the shared tool-result first pass. Later text blocks, images, or structured blocks are lost in that projection.
* **The first pass truncates the head** of results before a later stage computes the tail. For long output, that can produce the tail of a retained prefix, not the true final lines.
* **Empty results are not inserted into the result map.** An empty-but-error result can lose its error evidence in this path.
* **Unknown/absent error state is often collapsed into a false boolean internally.** That is acceptable only as a local rendering decision, not as proof of success.
* **Tool names can become category names**, such as grouping shell tools under `Bash`.

These are direct consequences of the inspected code. The packet does not claim a live end-to-end reproduction of each case. [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

## The collector and presentation layers add further loss

`SummaryCollector.add()` counts every added invocation but keeps samples only while the category is below its cap. In ordinary source iteration order, that is **first-N sampling**, not last-N, error-prioritized sampling, or a statistically representative selection. Later failures can be counted without appearing in the samples. [C-SUMMARIZER](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts)

Category caps are matched by string keys. Unrecognized keys fall back to five samples. Thus a Codex category such as `git` can retain only five samples even when a preset advertises a much larger shell cap. Category enums should be separate from original names in a port. [C-SUMMARIZER](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts)

The renderer groups and sorts category summaries, including MCP namespace grouping. Chronology is therefore not preserved by the tool appendix. `SessionEvent` can express richer events, but Claude's inspected timeline contains selected conversation messages, Codex's selected messages plus lifecycle events, while Copilot has a more explicit retained-message-linked tool timeline. Do not infer uniform fidelity from the shared type. [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-COPILOT](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/copilot.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

## Presets and hard limits

| Limit | Standard preset | Full preset |
|---|---:|---:|
| Recent conversation messages | 10 | 50 |
| Rendered message characters | 500 | 10,000 |
| Configured shell tail lines | 5 | 100 |
| Configured shell sample cap | 8 | 999 |
| Configured MCP parameter/result characters | 100 | 10,000 |
| Timeline event window | 20 | 200 |
| Subagent result characters | 500 | 10,000 |

These are configuration values, not uniform guarantees. Codex still has adapter-local five-line shell tails and 100-character generic MCP argument/result samples. Its compacted summary is capped at 500 characters in the inspected notes extractor. The Markdown event renderer caps serialized tool arguments at 500 characters separately. [C-CONFIG](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/config/verbosity.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

The shared diff utilities are intentionally simple. Replacement snippets are rendered with removed/added lines; truncation adds a `+N lines truncated` marker. Counting diff statistics on that already-truncated display can count the marker as an added line. Compute statistics before display truncation, and keep a structured truncation count outside the diff text. [C-DIFF](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/diff.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

## Extra Claude data

The Claude adapter can collect model and recorded token/cache usage, compaction summaries, selected recorded thinking highlights, file-history snapshot metadata, local-command/bootstrap details, task/agent sidecar final outputs, subagent tool counts, and external tool-result file sizes/previews. Not every field retained in `SessionNotes` has a dedicated full renderer section. [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

External result files are read into 200-character previews. A subagent result is typically a selected final output plus status/tool count, not a recursively preserved execution trace. File-history notes retain metadata/counts, not a full repository state. These are useful additions for orientation, but should not be advertised as complete preservation. [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts)

Claude predecessor chaining deserves special caution: on compaction cues it selects older same-cwd sessions by time. That is not verified parentage. Keep it disabled for attribution-sensitive retrospectives unless an explicit relationship is independently known. [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts)

## Codex-specific extraction

The parser indexes `function_call_output` and `custom_tool_call_output` by `call_id`, then handles normal function calls, raw custom-tool input such as `apply_patch`, and web-search calls. This is the principal coverage your Codex observer lacks. Copy the correlation pattern, not the early string slicing or heuristic category reassignment. [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

The conversation extractor chooses a response-item representation wholesale when usable response-item messages exist; it does not perform a general per-event reconciliation with unmatched event messages. Its user-retention tail branch can also omit the final assistant answer when many assistant messages follow the last user prompt. This is a source-level edge case, not a tested claim about your local logs. [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts)

## Output and side effects

`dump --json` writes `UnifiedSession`; Markdown dumping calls extraction. `inspect` is a useful diagnostic but is not a universal completeness oracle: the inspected format detector still classifies Gemini as JSON and Copilot as YAML, while actual session content includes JSONL. Its raw tool counting is oriented toward Anthropic-style content blocks. [C-DUMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/dump.ts) [C-INSPECT](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/inspect.ts) [C-GEMINI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts) [C-COPILOT](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/copilot.ts)

Cross-provider resume writes a fixed `.continues-handoff.md` in the source cwd and saves a global context copy. Reference mode can therefore race with another handoff in the same directory. `--debug-prompt` still performs the handoff writes before printing. The generated Markdown also contains instructions to continue work; a retro should consume data, not obey those embedded instructions. [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

## What to copy

Copy **native parsing knowledge, call/result matching, tool categorization, structured summaries, and display helpers**. Keep original IDs and names, process all result blocks, preserve raw pointers, distinguish unknown from success, calculate counts before truncation, and apply output budgets only to the final view. That is a bounded adaptation, not reinventing the entire tool.
