#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const CURSOR_EVIDENCE_REFERENCE =
  'skills/session-observer-collab/references/runtime-cursor.md';
export const CURSOR_FRAME_FIXTURE_DIRECTORY =
  'tests/session-observer/fixtures/cursor';

const PERSONAL_PATH_PATTERNS = [
  /\/(?:Users|home)\/(?!<|\[|\{|\$)[A-Za-z0-9._-]+(?:\/|\b)/iu,
  /\/root(?:\/|\b)/u,
  /\b[A-Za-z]:[\\/]+Users[\\/]+(?!<|\[|\{|\$)[^\\/\s"'`<>]+/iu,
];

const RAW_ID_ASSIGNMENT =
  /\b(?:session[_-]?id|conversation[_-]?id|generation[_-]?id|lease[_-]?id|owner[_-]?session|peer[_-]?identity)\b\s*(?::|=)\s*["'`]?(?!<|\[|\{|\$|redacted\b)[A-Za-z0-9][A-Za-z0-9._:/-]{2,}/iu;
const RAW_RUNTIME_IDENTITY =
  /\b(?:cursor|codex|claude-code):(?!<|\[|\{|\$|redacted\b)[A-Za-z0-9][A-Za-z0-9._-]{2,}/iu;
const RAW_OPAQUE_IDENTITY = /\b[A-Fa-f0-9]{32,}\b/u;

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
    /^(?:REDACTED|redacted|\*{3,})$/u.test(normalized)
  );
}

function finding(file, line, category, detail) {
  return { file, line, category, detail };
}

function scanLine(file, line, lineNumber) {
  const findings = [];

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
    RAW_ID_ASSIGNMENT.test(line) ||
    RAW_RUNTIME_IDENTITY.test(line) ||
    RAW_OPAQUE_IDENTITY.test(line)
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
  const requiredLabels = [
    '`automated-only`',
    '`documented-but-unvalidated`',
    '`measured-structural-only`',
    '`unavailable`',
  ];

  if (!text.includes('## Measured capability matrix')) {
    findings.push(
      finding(file, 1, 'matrix-schema', 'missing measured capability matrix'),
    );
  }
  const header = text
    .split(/\r?\n/u)
    .find((line) => line.startsWith('|') && line.includes('Capability'))
    ?.split('|')
    .slice(1, -1)
    .map((field) => field.trim());
  if (JSON.stringify(header) !== JSON.stringify(requiredFields)) {
    findings.push(
      finding(file, 1, 'matrix-schema', 'missing required capability fields'),
    );
  }
  for (const label of requiredLabels) {
    if (!text.includes(label)) {
      findings.push(
        finding(file, 1, 'matrix-schema', `missing evidence label ${label}`),
      );
    }
  }

  const tableLines = text
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('|') && /fixture/iu.test(line));
  for (const line of tableLines) {
    if (!line.includes('`automated-only`')) {
      findings.push(
        finding(
          file,
          1,
          'matrix-schema',
          'fixture-only row must be automated-only',
        ),
      );
    }
  }

  if (!/Failure outcomes are retained as failures/iu.test(text)) {
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

async function changedMarkdownFiles(root) {
  try {
    const { stdout } = await execFile(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', '*.md'],
      { cwd: root },
    );
    return stdout
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
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
  const changedDocs = options.changedDocs ?? (await changedMarkdownFiles(root));
  const fixtures = options.fixtures ?? (await cursorFrameFixtures(root));
  return [
    CURSOR_EVIDENCE_REFERENCE,
    ...fixtures,
    ...changedDocs.filter((file) => file.endsWith('.md')),
  ]
    .map((file) => file.split(path.sep).join('/'))
    .filter((file, index, files) => files.indexOf(file) === index)
    .toSorted();
}

export async function validateCursorEvidence(root = REPO_ROOT, options = {}) {
  const files =
    options.files ?? (await collectCursorEvidenceFiles(root, options));
  const findings = [];

  for (const file of files) {
    const normalizedFile = file.split(path.sep).join('/');
    const text = await readFile(confinedPath(root, normalizedFile), 'utf8');
    findings.push(...scanCursorEvidenceText(normalizedFile, text));
    if (normalizedFile === CURSOR_EVIDENCE_REFERENCE) {
      findings.push(...validateCapabilityMatrix(normalizedFile, text));
    }
  }

  return { files, findings };
}

function parseArgs(argv) {
  let root = REPO_ROOT;
  const changedDocs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      root = path.resolve(argv[++index] ?? '');
    } else if (argument === '--changed-doc') {
      changedDocs.push(argv[++index] ?? '');
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return {
    root,
    changedDocs: changedDocs.length > 0 ? changedDocs : undefined,
  };
}

async function main(argv = process.argv.slice(2)) {
  const { root, changedDocs } = parseArgs(argv);
  const result = await validateCursorEvidence(root, { changedDocs });

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
