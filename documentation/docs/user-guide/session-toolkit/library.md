---
title: 'Library Reference'
description: 'Use public typed ESM APIs for identity, discovery, reading, evidence, export, search, and activity.'
---

# Library Reference

Install into an ESM application running Node.js 22 or later:

```sh
npm install @tkstang/session-toolkit@0.1.0
```

## Read and export

Replace the explicit transcript path and `SESSION_ID` placeholders below with
real inputs. Calls are independent examples; you do not need to perform each
operation to read one session.

```js
import {
  getCapabilities,
  identifyCurrentTranscript,
  listSessions,
  parseTranscript,
  readTranscript,
  readEvidence,
  exportMarkdown,
} from '@tkstang/session-toolkit';

const capabilities = getCapabilities(); // pure, no I/O
const identity = await identifyCurrentTranscript({ cwd: process.cwd() });
const historical = await listSessions({ cwd: process.cwd(), runtime: 'auto' });
const page = await parseTranscript({
  runtime: 'codex',
  path: '/explicit/transcript.jsonl',
  maxRecords: 100,
});
// Qualified native identity; historical selection never establishes "current".
const selected = await readTranscript({ session: 'codex:SESSION_ID' });
const evidence = await readEvidence({ session: 'codex:SESSION_ID' });
await exportMarkdown({
  session: 'codex:SESSION_ID',
  out: '/new/transcript.md',
});
```

## Public API

The package root is the only export path. Additional value exports are
`revalidateCurrentTranscript(previous, options)`, `renderTranscriptMarkdown(page)`
(a pure projection), and `ToolkitError`.
Public option/result types include
`CurrentTranscriptOptions`, `CurrentTranscriptIdentity`, `DiscoveryOptions`,
`DiscoveryResult`, `SessionCandidate`, `StoreContext`, `ReadOptions`,
`SessionReadOptions`, `TranscriptPage`, `SourceRecord`, `ReadDiagnostic`,
`EvidenceOptions`, `ExportOptions`, `ExportResult`, `Provider`, `ErrorCode`,
`Capabilities`, `CapabilityId`, `Envelope<T>`, `SearchOptions`, `SearchResult`,
`SessionHit`, `Snippet`, `SearchDiagnostics`, `SourceReport`, `EstimateResult`,
`EstimateRuntime`, `ActivityOptions`, `ActivityCapture` and `ActivityEvent`.

Value exports also include `searchSessions`, `estimateSearch` and `captureActivity`. Declarations also describe the
inferred exact-evidence result. Internal parser/activity helpers are not APIs.

## Import behavior and isolated stores

Library imports do not parse arguments, resolve stores, perform network access,
write state or exit.
Calls accept explicit inputs; discovery/read/export accept
`homeDir` and optional per-provider `storeRoots` for isolated stores. Exact
identity accepts `homeDir` and `env`.
Only `exportMarkdown` writes destination artifacts through the library. The CLI
can also write an activity artifact with `activity --out`.
Search uses `home` and
`env` for isolated stores; those options differ from `homeDir` and `storeRoots`.

## Search and activity

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

## Errors and identity

Search throws `ToolkitError` with `E_SCAN_CONFIRMATION` when the estimated scan
exceeds its threshold; inspect the error details before authorizing a new call
with `allowLargeScan: true`. See [Historical Search](search.md) for bounds and
accelerator controls, and [Sensitive Activity](activity.md) for capture privacy.

`identifyCurrentTranscript` returns an authoritative, ambiguous, or unavailable
status. `revalidateCurrentTranscript(previous, options)` checks a prior identity;
historical selection never establishes current identity. Other operations can
throw `ToolkitError`; inspect `code`, `hint`, and any `details` rather than
matching message text. CLI envelopes wrap results at the command boundary;
library functions return their typed result directly.

For coordinate, continuation, evidence, and export semantics, see
[Transcripts and Export](transcripts.md). The installed package declarations
provide the precise option and result shapes.
