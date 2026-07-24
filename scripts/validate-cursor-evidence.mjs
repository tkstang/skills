#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const CURSOR_EVIDENCE_REFERENCE =
  'skills/session-observer-collab/references/runtime-cursor.md';
export const CURSOR_FRAME_FIXTURE_DIRECTORY =
  'tests/session-observer/fixtures/cursor';
export const CURSOR_WAKE_PROBE_SCRIPT =
  'scripts/probe-cursor-wake-surfaces.mjs';

const PERSONAL_PATH_PATTERNS = [
  /\/(?:Users|home)\/(?!<|\[|\{|\$)[A-Za-z0-9._-]+(?:\/|\b)/iu,
  /\/root(?:\/|\b)/u,
  /\b[A-Za-z]:[\\/]+Users[\\/]+(?!<|\[|\{|\$)[^\\/\s"'`<>]+/iu,
];

const RAW_RUNTIME_IDENTITY =
  /\b(?:cursor|codex|claude-code):(?!<|\[|\{|\$|redacted\b)[A-Za-z0-9][A-Za-z0-9._-]{2,}/iu;
const RAW_OPAQUE_IDENTITY = /\b[A-Fa-f0-9]{32,}\b/u;
const RAW_UUID_IDENTITY =
  /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5A-Fa-f0-9][A-Fa-f0-9]{3}-[89ABabA-Fa-f0-9][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b/u;
const OAT_GATE_BOOKKEEPING_FILE =
  /^\.oat\/projects\/shared\/[^/]+\/(?:implementation|plan|project-log|state)\.md$/u;
const SAFE_GATE_EVIDENCE = [
  /\b(?:reviewed_head|freshness_head|receive_pre_head|receive_commit|commit)\b\s*(?::|=)\s*["'`]?[A-Fa-f0-9]{40}\b/giu,
  /\bconfig_fingerprint\b\s*(?::|=)\s*["'`]?sha256:[A-Fa-f0-9]{64}\b/giu,
  /\b(?:implementation|freshness)_fingerprint\b\s*(?::|=)\s*["'`]?sha256:effective-delta-v1:[A-Fa-f0-9]{64}\b/giu,
  /\b(?:gate_run_id|launch_attempt_id|run)\b\s*(?::|=)\s*["'`]?[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5A-Fa-f0-9][A-Fa-f0-9]{3}-[89ABabA-Fa-f0-9][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b/giu,
  /\bGate run\s+`[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5A-Fa-f0-9][A-Fa-f0-9]{3}-[89ABabA-Fa-f0-9][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}`/gu,
  /\blaunch_result_receipt\b\s*(?::|=)\s*["'`]?[.]oat\/projects\/local\/[A-Za-z0-9._-]+\/gate-runs\/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5A-Fa-f0-9][A-Fa-f0-9]{3}-[89ABabA-Fa-f0-9][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\.result\.json\b/giu,
  /\bgate_run_marker\b\s*(?::|=)\s*["'`]?\bsystem-temp:oat-gate-runs\/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5A-Fa-f0-9][A-Fa-f0-9]{3}-[89ABabA-Fa-f0-9][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\.json\b/giu,
  /--base-ref\s+[A-Fa-f0-9]{40}\b/giu,
];
const IDENTITY_KEYS = new Set([
  'sessionid',
  'conversationid',
  'generationid',
  'leaseid',
  'ownersession',
  'peeridentity',
]);
const IDENTITY_ASSIGNMENT =
  /(?:^|[\s{,[|])(?:[*_]{1,2})?["'`]?([A-Za-z][A-Za-z0-9_-]*?)["'`]?(?:[*_]{1,2})?\s*(?::|=)\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^\s,}\]|]+)/gu;

const CREDENTIAL_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b(?:github_pat_|gh[pousr]_|sk-(?:live-|test-)?)[A-Za-z0-9_-]{12,}\b/u,
  /\bBearer\s+(?!<|\[|\{|\$|redacted\b)[A-Za-z0-9._~+/=-]{10,}/iu,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|client[_-]?secret)\b\s*(?::|=)\s*["'`]?(?!<|\[|\{|\$|redacted\b)[^\s"'`]{6,}/iu,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
];

const TRANSCRIPT_PROSE_CANARIES = [
  /<environment_context>/iu,
  /# AGENTS(?:\.md)? instructions/iu,
  /<subagent_notification>/iu,
  /<task-notification>/iu,
  /<local-command-caveat>/iu,
  /\bSystem prompt:/iu,
  /\bDeveloper:\s+(?:avoid|must|never|always)\b/iu,
];

function isDocumentedRedaction(value) {
  const normalized = value.trim();
  return (
    /^<[^>\r\n]+>$/u.test(normalized) ||
    /^\[(?:REDACTED|redacted)(?:[^\]\r\n]*)\]$/u.test(normalized) ||
    /^(?:REDACTED|redacted|\*{3,})$/u.test(normalized) ||
    /^redacted(?:[-_:][A-Za-z0-9._-]+)+$/iu.test(normalized) ||
    /^(?:cc|codex)-session-0*1$/iu.test(normalized)
  );
}

function isIdentityKey(key) {
  return IDENTITY_KEYS.has(key.replace(/[^A-Za-z0-9]/gu, '').toLowerCase());
}

function unquote(value) {
  const normalized = value.trim();
  if (
    normalized.length >= 2 &&
    ['"', "'", '`'].includes(normalized[0]) &&
    normalized.at(-1) === normalized[0]
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function isRawIdentityValue(value) {
  const normalized = unquote(String(value));
  if (
    isDocumentedRedaction(normalized) ||
    /^(?:null|none|unknown|unavailable|unmeasured|not-run)$/iu.test(normalized)
  ) {
    return false;
  }
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,}$/u.test(normalized);
}

function structuredRawIdentity(value) {
  if (Array.isArray(value)) return value.some(structuredRawIdentity);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      (isIdentityKey(key) &&
        (typeof entry === 'string' || typeof entry === 'number') &&
        isRawIdentityValue(entry)) ||
      structuredRawIdentity(entry),
  );
}

function containsRawIdentityAssignment(line) {
  try {
    if (structuredRawIdentity(JSON.parse(line.trim()))) return true;
  } catch {
    // Most evidence lines are Markdown rather than standalone JSON.
  }

  for (const match of line.matchAll(IDENTITY_ASSIGNMENT)) {
    if (isIdentityKey(match[1]) && isRawIdentityValue(match[2])) return true;
  }
  return false;
}

function redactSafeGateEvidence(file, line) {
  if (!OAT_GATE_BOOKKEEPING_FILE.test(file)) return line;
  return SAFE_GATE_EVIDENCE.reduce(
    (redacted, pattern) => redacted.replaceAll(pattern, '<gate-evidence>'),
    line,
  );
}

function finding(file, line, category, detail) {
  return { file, line, category, detail };
}

function scanLine(file, line, lineNumber) {
  const findings = [];
  const identityEvidence = redactSafeGateEvidence(file, line);

  if (PERSONAL_PATH_PATTERNS.some((pattern) => pattern.test(line))) {
    findings.push(
      finding(
        file,
        lineNumber,
        'personal-absolute-path',
        'personal path shape',
      ),
    );
  }

  if (
    containsRawIdentityAssignment(identityEvidence) ||
    RAW_RUNTIME_IDENTITY.test(identityEvidence) ||
    RAW_UUID_IDENTITY.test(identityEvidence) ||
    RAW_OPAQUE_IDENTITY.test(identityEvidence)
  ) {
    findings.push(
      finding(file, lineNumber, 'raw-identity', 'raw session/lease/identity'),
    );
  }

  if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(line))) {
    findings.push(
      finding(file, lineNumber, 'credential-shape', 'credential-like value'),
    );
  }

  if (TRANSCRIPT_PROSE_CANARIES.some((pattern) => pattern.test(line))) {
    findings.push(
      finding(file, lineNumber, 'transcript-prose', 'transcript prose canary'),
    );
  }

  const transcriptRole = /"role"\s*:\s*"(?:user|assistant)"/u.test(line);
  const textValuePattern = /"text"\s*:\s*"((?:\\.|[^"\\])*)"/gu;
  let textMatch;
  while ((textMatch = textValuePattern.exec(line)) !== null) {
    const value = textMatch[1];
    const syntheticFixture =
      file.startsWith(`${CURSOR_FRAME_FIXTURE_DIRECTORY}/framed-`) &&
      value.startsWith('Synthetic ');
    if (transcriptRole && !syntheticFixture && !isDocumentedRedaction(value)) {
      findings.push(
        finding(
          file,
          lineNumber,
          'transcript-prose',
          'non-redacted transcript text',
        ),
      );
      break;
    }
  }

  return findings;
}

export function scanCursorEvidenceText(file, text) {
  return text
    .split(/\r?\n/u)
    .flatMap((line, index) => scanLine(file, line, index + 1));
}

function validateCapabilityMatrix(file, text) {
  const findings = [];
  const requiredFields = [
    'Capability',
    'Host',
    'Provider',
    'Version',
    'Store',
    'Path shape',
    'Record shape',
    'Identity',
    'Action',
    'Outcome',
    'Evidence label',
  ];
  const evidenceLabels = new Set([
    'live-validated',
    'automated-only',
    'documented-but-unvalidated',
    'unavailable',
    'unsupported',
  ]);
  const lines = text.split(/\r?\n/u);

  if (!text.includes('## Measured capability matrix')) {
    findings.push(
      finding(file, 1, 'matrix-schema', 'missing measured capability matrix'),
    );
  }
  const headerIndex = lines.findIndex(
    (line) => line.startsWith('|') && line.includes('Capability'),
  );
  const header = lines[headerIndex]
    ?.split('|')
    .slice(1, -1)
    .map((field) => field.trim());
  if (JSON.stringify(header) !== JSON.stringify(requiredFields)) {
    findings.push(
      finding(file, 1, 'matrix-schema', 'missing required capability fields'),
    );
  }

  const rows = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    if (!lines[index].startsWith('|')) break;
    rows.push({ line: lines[index], lineNumber: index + 1 });
  }

  for (const row of rows) {
    const fields = row.line
      .split('|')
      .slice(1, -1)
      .map((field) => field.trim());
    if (fields.length !== requiredFields.length) {
      findings.push(
        finding(
          file,
          row.lineNumber,
          'matrix-schema',
          `capability row has ${fields.length} fields; expected ${requiredFields.length}`,
        ),
      );
      continue;
    }
    fields.forEach((field, index) => {
      if (!field) {
        findings.push(
          finding(
            file,
            row.lineNumber,
            'matrix-schema',
            `missing required field ${requiredFields[index]}`,
          ),
        );
      }
    });

    const labelMatch = /^`([^`]+)`$/u.exec(fields.at(-1) ?? '');
    const label = labelMatch?.[1] ?? null;
    if (label === null || !evidenceLabels.has(label)) {
      findings.push(
        finding(
          file,
          row.lineNumber,
          'matrix-schema',
          `invalid evidence label ${fields.at(-1) || '(empty)'}`,
        ),
      );
    }
    if (/fixture/iu.test(row.line) && label !== 'automated-only') {
      findings.push(
        finding(
          file,
          row.lineNumber,
          'matrix-schema',
          'fixture-only row must be automated-only',
        ),
      );
    }
  }

  if (!/Failure outcomes are retained as\s+failures/iu.test(text)) {
    findings.push(
      finding(
        file,
        1,
        'matrix-schema',
        'missing honest failure retention rule',
      ),
    );
  }

  return findings;
}

function probeRecipeFinding(detail) {
  return finding(CURSOR_WAKE_PROBE_SCRIPT, 1, 'phase6-probe-recipe', detail);
}

function requiredReferenceFinding(detail) {
  return finding(CURSOR_EVIDENCE_REFERENCE, 1, 'phase6-probe-recipe', detail);
}

function hookDefinitions(recipe) {
  const hooks = recipe?.hooksConfig?.hooks;
  if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return [];
  }
  return Object.values(hooks).flatMap((definitions) =>
    Array.isArray(definitions) ? definitions : [],
  );
}

export function validateCursorWakeProbeDescription(reference, description) {
  const findings = [];
  if (
    description?.schemaVersion !== 1 ||
    description?.probe !== 'cursor-wake-surfaces'
  ) {
    findings.push(probeRecipeFinding('missing structural probe schema'));
  }
  if (
    description?.provider?.name !== 'Cursor Agent' ||
    description?.provider?.command !== 'agent' ||
    JSON.stringify(description?.provider?.versionCommand) !==
      JSON.stringify(['agent', '--version'])
  ) {
    findings.push(
      probeRecipeFinding('missing provider/version command fields'),
    );
  }

  const requiredSafety = {
    workspacePolicy: 'exact-created-workspace',
    providerStatePolicy: 'snapshot-new-exact-owned-remove',
    preExistingArtifacts: 'preserved',
    ambiguousArtifacts: 'fail-without-removal',
    credentialsRequested: false,
    daemonStarted: false,
    schedulerStarted: false,
    externalServiceStarted: false,
    cleanup: 'remove-exact-created-workspace-and-proven-provider-state',
  };
  for (const [field, expected] of Object.entries(requiredSafety)) {
    if (description?.safety?.[field] !== expected) {
      findings.push(probeRecipeFinding(`missing safe probe boundary ${field}`));
    }
  }
  const requiredProviderRoots = [
    {
      id: 'projects',
      location: 'cursor-home/projects',
      attribution: 'exact-encoded-workspace',
    },
    {
      id: 'chats',
      location: 'cursor-home/chats',
      attribution: 'exact-workspace-metadata',
    },
  ];
  if (
    JSON.stringify(description?.safety?.declaredProviderRoots) !==
    JSON.stringify(requiredProviderRoots)
  ) {
    findings.push(
      probeRecipeFinding('missing exact declared provider-state roots'),
    );
  }

  const expectedModes = new Map([
    [
      'top-level-stop',
      {
        processCapMs: 90_000,
        childDefinitionPresent: false,
        hookEvents: ['stop'],
        expectedHooks: ['top-level-stop'],
      },
    ],
    [
      'managed-subagent',
      {
        processCapMs: 120_000,
        childDefinitionPresent: true,
        hookEvents: ['subagentStart', 'subagentStop'],
        expectedHooks: ['subagent-start', 'managed-subagent-stop'],
      },
    ],
  ]);
  const modes = Array.isArray(description?.modes) ? description.modes : [];
  for (const [mode, expected] of expectedModes) {
    const recipe = modes.find((candidate) => candidate?.mode === mode);
    if (!recipe) {
      findings.push(probeRecipeFinding(`missing ${mode} recipe mode`));
      continue;
    }
    if (
      recipe?.bounds?.processCapMs !== expected.processCapMs ||
      recipe?.bounds?.hookTimeoutSeconds !== 10 ||
      recipe?.bounds?.followupLoopLimit !== 1
    ) {
      findings.push(probeRecipeFinding(`invalid ${mode} finite bounds`));
    }
    if (
      typeof recipe.prompt !== 'string' ||
      recipe.prompt.length === 0 ||
      /<[^>]+>/u.test(recipe.prompt)
    ) {
      findings.push(probeRecipeFinding(`incomplete ${mode} fixed prompt`));
    }
    if (
      !Array.isArray(recipe.markers) ||
      recipe.markers.length < 2 ||
      recipe.markers.some(
        (marker) =>
          typeof marker !== 'string' ||
          !marker.startsWith('CURSOR_WAKE_PROBE_'),
      )
    ) {
      findings.push(probeRecipeFinding(`incomplete ${mode} fixed markers`));
    }
    if (
      JSON.stringify(recipe.expectedHooks) !==
      JSON.stringify(expected.expectedHooks)
    ) {
      findings.push(probeRecipeFinding(`invalid ${mode} expected hook list`));
    }
    if (
      recipe?.hooksConfig?.version !== 1 ||
      JSON.stringify(Object.keys(recipe?.hooksConfig?.hooks ?? {})) !==
        JSON.stringify(expected.hookEvents)
    ) {
      findings.push(probeRecipeFinding(`incomplete ${mode} hooks.json`));
    }
    const definitions = hookDefinitions(recipe);
    if (
      definitions.length !== expected.hookEvents.length ||
      definitions.some(
        (definition) =>
          typeof definition.command !== 'string' ||
          !definition.command.startsWith(
            'node .cursor/hooks/probe-hook.mjs ',
          ) ||
          definition.timeout !== 10 ||
          definition.failClosed !== false,
      ) ||
      !definitions.some((definition) => definition.loop_limit === 1)
    ) {
      findings.push(
        probeRecipeFinding(`incomplete ${mode} structural hook definitions`),
      );
    }
    if (recipe.childDefinitionPresent !== expected.childDefinitionPresent) {
      findings.push(
        probeRecipeFinding(`invalid ${mode} child-definition contract`),
      );
    }
  }
  if (modes.length !== expectedModes.size) {
    findings.push(probeRecipeFinding('unexpected probe recipe mode count'));
  }

  const requiredReferenceText = [
    'node scripts/probe-cursor-wake-surfaces.mjs --mode top-level-stop --json',
    'node scripts/probe-cursor-wake-surfaces.mjs --mode managed-subagent --json',
    'processCapMs',
    'provider-version',
    'bounded-provider-process',
    'lifecycle-hooks',
    'fixed-markers',
    'surface-outcome',
    'provider-state-boundary',
    'cleanup',
  ];
  for (const required of requiredReferenceText) {
    if (!reference.includes(required)) {
      findings.push(
        requiredReferenceFinding(
          `runtime reference missing executable probe evidence: ${required}`,
        ),
      );
    }
  }
  if (
    reference.includes('<sanitized-probe-prompt>') ||
    reference.includes('<sanitized-managed-probe-prompt>')
  ) {
    findings.push(
      requiredReferenceFinding(
        'runtime reference retains non-executable probe placeholders',
      ),
    );
  }

  return findings;
}

export function validateCursorWakeProbeIsolationContract(contract) {
  const findings = [];
  const required = {
    schemaVersion: 1,
    succeeded: true,
    declaredRootCount: 2,
    ownershipProvenCount: 2,
    removedCount: 2,
    preExistingPreserved: true,
    ownedArtifactsAbsent: true,
  };
  for (const [field, expected] of Object.entries(required)) {
    if (contract?.[field] !== expected) {
      findings.push(
        probeRecipeFinding(`executable isolation contract failed: ${field}`),
      );
    }
  }
  return findings;
}

async function loadCursorWakeProbeDescription(root) {
  const script = confinedPath(root, CURSOR_WAKE_PROBE_SCRIPT);
  const module = await import(pathToFileURL(script).href);
  if (
    typeof module.describeCursorWakeProbeRecipes !== 'function' ||
    typeof module.verifyCursorWakeProbeIsolationContract !== 'function'
  ) {
    throw new Error('probe executable contract export is unavailable');
  }
  return {
    description: module.describeCursorWakeProbeRecipes(),
    isolation: await module.verifyCursorWakeProbeIsolationContract(),
  };
}

async function changedMarkdownFiles(root, baseRef) {
  const requestedBase =
    baseRef ?? process.env.CURSOR_EVIDENCE_BASE_REF ?? 'origin/main';
  const { stdout: mergeBaseStdout } = await execFile(
    'git',
    ['merge-base', requestedBase, 'HEAD'],
    { cwd: root },
  );
  const mergeBase = mergeBaseStdout.trim();
  if (!mergeBase) {
    throw new Error(
      `could not resolve evidence merge base for ${requestedBase}`,
    );
  }

  const diffArgs = [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    mergeBase,
    'HEAD',
    '--',
    '*.md',
  ];
  const [{ stdout: committed }, { stdout: working }] = await Promise.all([
    execFile('git', diffArgs, { cwd: root }),
    execFile(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', '*.md'],
      { cwd: root },
    ),
  ]);
  return [...new Set(`${committed}\n${working}`.split('\n'))]
    .map((file) => file.trim())
    .filter(Boolean);
}

async function cursorFrameFixtures(root) {
  const directory = path.join(root, CURSOR_FRAME_FIXTURE_DIRECTORY);
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith('framed-') &&
        entry.name.endsWith('.jsonl'),
    )
    .map((entry) => `${CURSOR_FRAME_FIXTURE_DIRECTORY}/${entry.name}`)
    .toSorted();
}

function confinedPath(root, relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  const relative = path.relative(root, absolutePath);
  if (
    relative.length === 0 ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`evidence path escapes repository root: ${relativePath}`);
  }
  return absolutePath;
}

export async function collectCursorEvidenceFiles(
  root = REPO_ROOT,
  options = {},
) {
  const changedDocs =
    options.changedDocs ?? (await changedMarkdownFiles(root, options.baseRef));
  const fixtures = options.fixtures ?? (await cursorFrameFixtures(root));
  return [
    CURSOR_EVIDENCE_REFERENCE,
    CURSOR_WAKE_PROBE_SCRIPT,
    ...fixtures,
    ...changedDocs.filter(
      (file) => file.endsWith('.md') && !/(^|\/)reviews\//u.test(file),
    ),
  ]
    .map((file) => file.split(path.sep).join('/'))
    .filter((file, index, files) => files.indexOf(file) === index)
    .toSorted();
}

export async function validateCursorEvidence(root = REPO_ROOT, options = {}) {
  const files =
    options.files ?? (await collectCursorEvidenceFiles(root, options));
  const findings = [];
  let reference = '';

  for (const file of files) {
    const normalizedFile = file.split(path.sep).join('/');
    const text = await readFile(confinedPath(root, normalizedFile), 'utf8');
    findings.push(...scanCursorEvidenceText(normalizedFile, text));
    if (normalizedFile === CURSOR_EVIDENCE_REFERENCE) {
      reference = text;
      findings.push(...validateCapabilityMatrix(normalizedFile, text));
    }
  }

  if (reference) {
    try {
      const { description, isolation } =
        await loadCursorWakeProbeDescription(root);
      findings.push(
        ...validateCursorWakeProbeDescription(reference, description),
        ...validateCursorWakeProbeIsolationContract(isolation),
      );
    } catch {
      findings.push(
        probeRecipeFinding('executable probe recipe could not be loaded'),
      );
    }
  }

  return { files, findings };
}

function parseArgs(argv) {
  let root = REPO_ROOT;
  let baseRef;
  const changedDocs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      root = path.resolve(argv[++index] ?? '');
    } else if (argument === '--base-ref') {
      baseRef = argv[++index] ?? '';
    } else if (argument === '--changed-doc') {
      changedDocs.push(argv[++index] ?? '');
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return {
    root,
    baseRef,
    changedDocs: changedDocs.length > 0 ? changedDocs : undefined,
  };
}

async function main(argv = process.argv.slice(2)) {
  const { root, baseRef, changedDocs } = parseArgs(argv);
  const result = await validateCursorEvidence(root, { baseRef, changedDocs });

  if (result.findings.length > 0) {
    console.error(
      `Cursor evidence validation failed with ${result.findings.length} finding(s):`,
    );
    for (const item of result.findings) {
      console.error(
        `- ${item.file}:${item.line} [${item.category}] ${item.detail}`,
      );
    }
    return 1;
  }

  console.log(
    `Cursor evidence validation passed for ${result.files.length} file(s).`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Cursor evidence validation error: ${error.message}`);
      process.exitCode = 2;
    });
}
