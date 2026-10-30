# @tkstang/session-toolkit

Find a past coding-agent session, read its conversation, and save a Markdown
copy from your terminal or JavaScript. Session Toolkit works with local Claude
Code, Codex, and Cursor transcripts through the `seshtk` CLI and a typed ESM
library.

## Install

Requires **Node.js 22 or later**.

```sh
npm install --global @tkstang/session-toolkit@0.1.0
seshtk --version
```

For a one-off command:

```sh
npx --package=@tkstang/session-toolkit@0.1.0 -- seshtk --help
```

## Find, read, and export a session

Search for something you remember, optionally starting with a repository and a
time window:

```sh
seshtk search -p 'deployment failed' --literal --cwd ~/Code/project --since 7d
```

Choose a result's provider and native session ID, then read or export it.
Replace `SESSION_ID` below with that ID:

```sh
seshtk read --session 'codex:SESSION_ID' --max-records 100
seshtk export --session 'codex:SESSION_ID' --out ./conversation.md
```

Reads are bounded; `--json` includes coverage and continuation details. Exports
create new files and refuse to overwrite existing destinations. Review exported
text before sharing: sanitization removes hidden instructions and control
payloads, but visible text can still contain secrets.

## Commands

| Command                      | Use it to                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- |
| `search` / `search estimate` | Find historical sessions or estimate a scan's size.                         |
| `list`                       | Browse historical sessions for a directory or time window.                  |
| `self-identify`              | Establish the exact current session when the host provides enough evidence. |
| `read`                       | Read a session by its provider-qualified native ID.                         |
| `parse`                      | Read an explicit transcript file with a specified provider.                 |
| `export`                     | Write conversational Markdown for a selected session or bounded batch.      |
| `activity`                   | Capture sensitive structured records, tool calls, and recorded results.     |
| `capabilities`               | Inspect the installed version, providers, and supported operations.         |

Run `seshtk <command> --help` for options. Add `--json` for a single machine-readable
response. Full usage and output contracts are in the
[CLI reference](https://tkstang.github.io/skills/user-guide/session-toolkit/cli/).

## Use the library

```sh
npm install @tkstang/session-toolkit@0.1.0
```

```js
import { listSessions, readTranscript } from '@tkstang/session-toolkit';

const history = await listSessions({ cwd: process.cwd() });
const candidate = history.candidates[0];
if (candidate) {
  const page = await readTranscript({
    session: candidate.session,
    maxRecords: 100,
  });
  console.log(page.messages);
  console.log(page.coverage);
}
```

The package root is the public import path. See the
[library reference](https://tkstang.github.io/skills/user-guide/session-toolkit/library/)
for search, export, identity, evidence, and activity APIs.

## Providers and privacy

Claude Code, Codex, and Cursor support local session discovery, transcript reads,
search, export, and captured activity. Exact evidence cutoffs and tool expansion
currently support **Codex only**. Cursor activity lacks individual tool results,
per-call outcomes, and usage on the supported transcript surface.

Provider storage formats can change. Missing or inaccessible stores, read limits,
and malformed records affect coverage; results report those gaps. Historical
search or a recent session never proves which session is current. The toolkit
reads local stores and leaves session selection and watch state to its caller.

Raw reads, evidence, and activity may contain sensitive data. Interactive CLI
commands can check npm for an update once a day; set `SESHTK_NO_UPDATE_CHECK=1`
to disable this. JSON, CI, noninteractive invocations, and library calls perform
no update lookup. No automatic upgrade runs.

[Full documentation](https://tkstang.github.io/skills/user-guide/session-toolkit/) ·
[Package changelog](CHANGELOG.md) ·
[Development and releases](https://github.com/tkstang/skills/blob/main/RELEASING.md#session-toolkit-package)
