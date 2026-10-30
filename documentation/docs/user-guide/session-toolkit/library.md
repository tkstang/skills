---
title: 'Library Reference'
description: 'Use the public ESM APIs to discover, read, search, export, and inspect sessions with explicit stores and identity handling.'
---

# Library Reference

The typed ESM library provides the same session operations as the CLI, without
argument parsing or response envelopes. Install it into an application running
Node.js 22 or later:

```sh
npm install @tkstang/session-toolkit@0.1.0
```

Import only from `@tkstang/session-toolkit`. Internal parser and activity modules
are not public APIs. Importing the package does not scan stores, resolve session
paths, perform network access, write state, or exit the process.

## Find and read a session

List historical candidates, then use a candidate's provider-qualified `session`
field to read it. This does not identify the current session.

```js
import { listSessions, readTranscript } from '@tkstang/session-toolkit';

const history = await listSessions({ cwd: process.cwd(), runtime: 'auto' });
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

Inspect `history.coverage` for discovery gaps and `page.coverage` for read gaps.
The [transcript reference](transcripts.md) explains coordinates, continuations,
message options, and source changes.

## Choose an API

- `getCapabilities()` — Pure version, provider, and capability discovery; no I/O.
- `identifyCurrentTranscript()` — Evaluate current identity and return its status and evidence.
- `revalidateCurrentTranscript()` — Recheck a previously evaluated identity.
- `listSessions()` — Discover historical candidates with coverage.
- `readTranscript()` — Read a selected provider-qualified native session.
- `parseTranscript()` — Read an explicit file with an explicit provider.
- `readEvidence()` — Capture Codex-only cutoff and expansion evidence.
- `renderTranscriptMarkdown()` — Render sanitized Markdown from a captured page without I/O.
- `exportMarkdown()` — Select, read, and write new Markdown files.
- `searchSessions()` — Search raw local historical evidence.
- `estimateSearch()` — Estimate candidate files and bytes without content hits.
- `captureActivity()` — Return sensitive full activity within a captured page.

`ToolkitError` is also exported for domain errors. Check `getCapabilities()`
before depending on a specific versioned operation; see
[capability IDs](cli.md#capabilities).

## Parse, inspect evidence, or export

These are independent examples. Replace the path and `SESSION_ID` with real
inputs; the evidence call requires a Codex session.

```js
import {
  parseTranscript,
  readEvidence,
  exportMarkdown,
} from '@tkstang/session-toolkit';

const page = await parseTranscript({
  runtime: 'codex',
  path: '/path/to/transcript.jsonl',
  maxRecords: 100,
});
const evidence = await readEvidence({ session: 'codex:SESSION_ID' });
const result = await exportMarkdown({
  session: 'codex:SESSION_ID',
  out: './conversation.md',
  maxBytes: 4_000_000,
});
console.log(result.written.map((file) => file.coverage));
```

Export can succeed with partial source coverage. It has no continuation option;
increase `maxBytes` and export to a new destination when a byte limit truncated
the source. See [export safety](transcripts.md#export-safety) before sharing.

## Search and activity

Search and scan estimation share the same query shape. Activity requires a
selected native session ID and returns sensitive raw fields.

```js
import {
  searchSessions,
  estimateSearch,
  captureActivity,
} from '@tkstang/session-toolkit';

const query = { patterns: ['deployment.*failed'], runtime: 'codex' };
const estimate = await estimateSearch(query);
const hits = await searchSessions({ ...query, deadlineMs: 5000 });
const capture = await captureActivity({ session: 'codex:SESSION_ID' });
```

If a scan exceeds its authorization threshold, `searchSessions` throws
`ToolkitError` with `E_SCAN_CONFIRMATION`. Inspect its estimate and partial
results before authorizing a new call with `allowLargeScan: true`. See
[search controls](search.md) and [activity privacy](activity.md).

## Current identity and errors

`identifyCurrentTranscript` returns one of five statuses. Only `authoritative`
establishes exact current identity:

| Status          | Meaning for the caller                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `authoritative` | Exact transcript identity passed the provider and source checks.                                          |
| `corroborated`  | An explicit ID is present, but no exact matching transcript was found; exact identity is not established. |
| `ambiguous`     | Conflicting evidence, multiple matches, or a saturated identity scan prevents a unique answer.            |
| `invalid`       | An input, path, metadata value, or source check failed validation.                                        |
| `unavailable`   | Required identity evidence or source access is unavailable.                                               |

Inspect `warningCodes` and the returned evidence when identity is not
authoritative. `revalidateCurrentTranscript(previous, options)` rechecks a prior
result. Historical selection, directory, and recency never establish current
identity. The CLI accepts only authoritative identity and puts other statuses in
error details.

Other operations can throw `ToolkitError`. Handle its `code`, `hint`, and optional
`details` rather than matching message text. Library functions return their typed
results directly; the CLI adds the `ok` and `schema_version` envelope at its
command boundary.

## Isolated stores and writes

Calls accept explicit inputs. Store overrides differ by API family:

| APIs                                                      | Store options                                     |
| --------------------------------------------------------- | ------------------------------------------------- |
| Discovery, selected reads, evidence, export, and activity | `homeDir` and optional per-provider `storeRoots`. |
| Current identity                                          | `homeDir` and `env`.                              |
| Search and estimation                                     | `home` and `env`.                                 |
| Explicit-file parsing                                     | `path` and `runtime`; no store discovery.         |

Only `exportMarkdown` writes destination artifacts through the library. The CLI
also offers `activity --out` to write a capture. Session selection, offsets,
watching, and delivery state remain the caller's responsibility.

## Public types

The package declarations contain the precise option and result shapes. The
exported types are grouped below for discovery:

- **Identity:** `CurrentTranscriptOptions`, `CurrentTranscriptIdentity`.
- **Discovery:** `DiscoveryOptions`, `DiscoveryResult`, `SessionCandidate`, `StoreContext`.
- **Reading:** `ReadOptions`, `SessionReadOptions`, `TranscriptPage`, `SourceRecord`, `ReadDiagnostic`.
- **Evidence and export:** `EvidenceOptions`, `ExportOptions`, `ExportResult`.
- **Search:** `SearchOptions`, `SearchResult`, `SessionHit`, `Snippet`, `SearchDiagnostics`, `SourceReport`, `EstimateResult`, `EstimateRuntime`.
- **Activity:** `ActivityOptions`, `ActivityCapture`, `ActivityEvent`.
- **Shared contracts:** `Provider`, `ErrorCode`, `Capabilities`, `CapabilityId`, `Envelope<T>`.

The declarations also describe the inferred `readEvidence` result. Import
functions and types from the package root; implementation helpers are private.
