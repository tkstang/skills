#!/usr/bin/env node
import { constants } from 'node:fs';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { KnownHostRuntime } from '../../../plugins/consensus/provider-cli/host-guard.js';
import { executeBoundedReview } from './run.js';
import type {
  ExecuteReviewInput,
  ExecuteReviewResult,
  ReviewAggregate,
  ReviewFinding,
} from './run.js';
import type { ReviewScopeRequest } from './scope.js';

export { executeBoundedReview, runReview, validateReviewReply } from './run.js';
export { buildReviewPrompt, resolveReviewer } from './selection.js';

const USAGE = `Usage: review <exactly one scope> --host <runtime> [options]

Scopes (exactly one):
  base_branch=<ref>       Review tracked changes from the merge base through the current worktree
  --files <path...>       Review explicitly named repository files; named untracked files are allowed
  --document <path>       Review one repository or external document/plan

Options:
  --request <text>        Exact review request
  --request-file <path>   Read the exact review request from a bounded text file
  --reviewer <id[:model]> Pin one reviewer provider and optional model
  --model <id>            Model for an explicitly pinned reviewer
  --effort <value>        Effort for an explicitly pinned reviewer
  --allow-same-provider   Confirm user consent for a pinned same-provider reviewer
  --output <path>         Export completed Markdown after drift checking; refuses overwrite
  --json                  Emit one JSON result
  --help                  Show this usage

Exit 0: completed review or empty-scope no-op. Exit 1: incomplete, defective,
or output failure. Exit 2: usage or pre-dispatch argument error.`;

const REQUEST_FILE_MAX_BYTES = 256 * 1024;

export interface ReviewCliDependencies {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  execute?: typeof executeBoundedReview;
  schemaPath?: string;
}

export interface ReviewCliOutcome {
  exitCode: 0 | 1 | 2;
  json: boolean;
  payload: Record<string, unknown>;
  human: string;
}

interface ParsedReviewArgs {
  scope: ReviewScopeRequest;
  host: KnownHostRuntime;
  request: string;
  reviewer?: string;
  model?: string;
  effort?: string;
  allowSameProvider?: boolean;
  output?: string;
  json: boolean;
}

class UsageError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

export async function reviewMain(
  argv = process.argv.slice(2),
  dependencies: ReviewCliDependencies = {},
): Promise<number> {
  const outcome = await runReviewCli(argv, dependencies);
  process.stdout.write(
    outcome.json
      ? `${JSON.stringify(outcome.payload)}\n`
      : `${outcome.human.trimEnd()}\n`,
  );
  return outcome.exitCode;
}

export async function runReviewCli(
  argv: string[],
  dependencies: ReviewCliDependencies = {},
): Promise<ReviewCliOutcome> {
  if (argv.includes('--help')) {
    return {
      exitCode: 0,
      json: argv.includes('--json'),
      payload: {
        ok: true,
        status: 'usage',
        invocation_count: 0,
        usage: USAGE,
      },
      human: USAGE,
    };
  }

  let parsed: ParsedReviewArgs;
  try {
    parsed = await parseReviewArgs(argv, dependencies.cwd ?? process.cwd());
  } catch (error) {
    const failure =
      error instanceof UsageError
        ? error
        : new UsageError('argument_invalid', errorMessage(error));
    return usageOutcome(failure, argv.includes('--json'));
  }

  const cwd = path.resolve(dependencies.cwd ?? process.cwd());
  const execute = dependencies.execute ?? executeBoundedReview;
  const input: ExecuteReviewInput = {
    cwd,
    scope: parsed.scope,
    host: parsed.host,
    request: parsed.request,
    hostSummary:
      'The host requested one bounded read-only review. The reviewer must report checks honestly and must not modify user files.',
    schemaPath:
      dependencies.schemaPath ??
      fileURLToPath(new URL('../schemas/review.schema.json', import.meta.url)),
    ...(parsed.reviewer ? { reviewer: parsed.reviewer } : {}),
    ...(parsed.model ? { model: parsed.model } : {}),
    ...(parsed.effort ? { effort: parsed.effort } : {}),
    ...(parsed.allowSameProvider
      ? { allowSameProvider: parsed.allowSameProvider }
      : {}),
  };

  const result = await execute(input, { env: dependencies.env });
  if (!result.ok) return diagnosticOutcome(result, parsed.json);
  if (result.status === 'empty_scope') {
    return {
      exitCode: 0,
      json: parsed.json,
      payload: {
        ok: true,
        status: 'empty_scope',
        invocation_count: 0,
        message: 'The explicit scope contains no reviewable files.',
      },
      human:
        'Review completed as an empty-scope no-op. Provider invocations: 0.',
    };
  }

  const canonicalMarkdown = path.join(
    result.runState.runDirectory,
    'review.md',
  );
  try {
    await writeExclusive(
      canonicalMarkdown,
      renderReviewMarkdown(result.aggregate),
      0o600,
    );
  } catch (error) {
    return localOutputFailure(
      result,
      'markdown_persistence_failed',
      `Completed review Markdown could not be written: ${errorMessage(error)}`,
      parsed.json,
    );
  }

  let exportedMarkdown: string | null = null;
  if (parsed.output) {
    try {
      exportedMarkdown = await exportCompletedMarkdown({
        cwd,
        requestedPath: parsed.output,
        contents: await readFile(canonicalMarkdown, 'utf8'),
        aggregate: result.aggregate,
        canonicalMarkdown,
      });
    } catch (error) {
      return localOutputFailure(
        result,
        'export_failed',
        `Completed review was preserved at ${canonicalMarkdown}; export failed: ${errorMessage(error)}`,
        parsed.json,
        canonicalMarkdown,
      );
    }
  }

  const payload = {
    ok: true,
    status: 'completed',
    verdict: result.aggregate.reply.verdict,
    invocation_count: result.invocation_count,
    artifacts: {
      markdown: canonicalMarkdown,
      json: result.artifactPath,
      ...(exportedMarkdown ? { exported_markdown: exportedMarkdown } : {}),
    },
  };
  const human = [
    `Review completed: ${result.aggregate.reply.verdict}.`,
    `Markdown artifact: ${canonicalMarkdown}`,
    `JSON artifact: ${result.artifactPath}`,
    ...(exportedMarkdown ? [`Exported Markdown: ${exportedMarkdown}`] : []),
    `Provider invocations: ${result.invocation_count}.`,
  ].join('\n');
  return { exitCode: 0, json: parsed.json, payload, human };
}

export function renderReviewMarkdown(aggregate: ReviewAggregate): string {
  const findings = groupFindings(aggregate.reply.findings);
  const lines = [
    '---',
    'oat_generated: true',
    `oat_generated_at: ${JSON.stringify(new Date().toISOString())}`,
    'oat_review_scope: bounded',
    'oat_review_type: code',
    `oat_review_run_id: ${JSON.stringify(aggregate.run_id)}`,
    '---',
    '',
    '# Consensus Review',
    '',
    `**Verdict:** ${escapeMarkdown(aggregate.reply.verdict)}`,
    `**Worktree:** ${inlineCode(aggregate.worktree_root)}`,
    `**Scope token:** ${inlineCode(aggregate.scope.token)}`,
    `**Reviewer:** ${escapeMarkdown(aggregate.reviewer.observed.provider)} (model ${escapeMarkdown(aggregate.reviewer.observed.model ?? 'unobserved')}, effort ${escapeMarkdown(aggregate.reviewer.observed.effort ?? 'unobserved')})`,
    `**Findings:** ${findings.critical.length} critical, ${findings.important.length} important, ${findings.medium.length} medium, ${findings.minor.length} minor`,
    '',
    '## Request',
    '',
    escapeMarkdown(aggregate.request),
    '',
    '## Summary',
    '',
    escapeMarkdown(aggregate.reply.summary),
    '',
    '## Scope and provenance',
    '',
    `- Selector: ${inlineCode(scopeDescription(aggregate))}`,
    `- Requested paths: ${aggregate.scope.selectedPaths.length > 0 ? aggregate.scope.selectedPaths.map(inlineCode).join(', ') : 'none'}`,
    `- External documents: ${aggregate.scope.externalDocuments.length > 0 ? aggregate.scope.externalDocuments.map(inlineCode).join(', ') : 'none'}`,
    `- Captured evidence: ${aggregate.scope.evidenceBytes} bytes`,
    `- Reviewer claim: ${escapeMarkdown(JSON.stringify(aggregate.reviewer.claimed))}`,
    `- Observed reviewer evidence: ${escapeMarkdown(aggregate.reviewer.observed.evidence)}`,
    `- Diversity: ${escapeMarkdown(aggregate.diversity.classification)} — ${escapeMarkdown(aggregate.diversity.evidence)}`,
    `- Drift comparison: ${aggregate.drift.stable ? 'stable within stated coverage' : 'not stable'}`,
    `- Detection limit: ${escapeMarkdown(aggregate.drift.limitation)}`,
    '',
    '### Authorship evidence',
    '',
    ...aggregate.authored_by.map(
      (entry) =>
        `- ${escapeMarkdown(entry.identity)} — ${escapeMarkdown(entry.evidence_source)}, ${escapeMarkdown(entry.scope_coverage)} coverage; ${escapeMarkdown(entry.evidence_reference)}`,
    ),
    '',
    '### Reviewer-reported inspected context',
    '',
    ...(aggregate.reply.inspected_context.length > 0
      ? aggregate.reply.inspected_context.map(
          (entry) =>
            `- ${escapeMarkdown(entry.subject)} (${inlineCode(entry.source_version)})`,
        )
      : ['None reported.']),
    '',
    '## Findings',
    '',
    ...renderSeverity('Critical', 'C', findings.critical),
    ...renderSeverity('Important', 'I', findings.important),
    ...renderSeverity('Medium', 'M', findings.medium),
    ...renderSeverity('Minor', 'm', findings.minor),
    '## Questions',
    '',
    ...renderStringList(aggregate.reply.questions),
    '',
    '## Limitations',
    '',
    ...renderStringList([
      ...aggregate.reply.limitations,
      aggregate.drift.limitation,
      'Provider read-only controls are not universal filesystem or network isolation.',
      'Retention is operator-managed; the external run directory has no automatic cleanup or replay policy.',
    ]),
    '',
    '## Checks reported',
    '',
    ...renderChecks(
      aggregate.reply.checks.filter((check) => check.status !== 'not_run'),
    ),
    '',
    '## Suggested verification',
    '',
    ...renderChecks(
      aggregate.reply.checks.filter((check) => check.status === 'not_run'),
    ),
    '',
    '## Artifact paths',
    '',
    `- Run directory: ${inlineCode(aggregate.paths.run_directory)}`,
    `- Captured request: ${inlineCode(aggregate.paths.request)}`,
    `- Captured evidence: ${inlineCode(aggregate.paths.evidence)}`,
    `- Host result JSON: ${inlineCode(aggregate.paths.result)}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function parseReviewArgs(
  argv: string[],
  cwd: string,
): Promise<ParsedReviewArgs> {
  let baseRef: string | undefined;
  let files: string[] | undefined;
  let document: string | undefined;
  let host: KnownHostRuntime | undefined;
  let request: string | undefined;
  let requestFile: string | undefined;
  let reviewer: string | undefined;
  let model: string | undefined;
  let effort: string | undefined;
  let output: string | undefined;
  let allowSameProvider = false;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument.startsWith('base_branch=')) {
      if (baseRef !== undefined)
        throw new UsageError('selector_duplicate', 'base_branch was repeated');
      baseRef = argument.slice('base_branch='.length);
      if (!baseRef)
        throw new UsageError('scope_required', 'base_branch requires a ref');
      continue;
    }
    if (argument === '--files') {
      const values: string[] = [];
      while (argv[index + 1] && !argv[index + 1]!.startsWith('--')) {
        const candidate = argv[index + 1]!;
        if (candidate.startsWith('base_branch=')) break;
        values.push(candidate);
        index += 1;
      }
      if (values.length === 0)
        throw new UsageError(
          'scope_required',
          '--files requires at least one path',
        );
      files = values;
      continue;
    }
    if (argument === '--allow-same-provider') {
      allowSameProvider = true;
      continue;
    }
    if (argument === '--json') {
      json = true;
      continue;
    }
    if (['--staged', '--unstaged', '--commits', '--range'].includes(argument)) {
      throw new UsageError(
        'selector_deferred',
        `${argument} is not supported; use base_branch=<ref>, --files, or --document`,
      );
    }
    const option = optionValue(argv, index, argument);
    if (option) {
      index += 1;
      if (argument === '--document') document = option;
      else if (argument === '--host') {
        if (!['claude', 'codex', 'cursor'].includes(option)) {
          throw new UsageError(
            'host_invalid',
            '--host must be claude, codex, or cursor',
          );
        }
        host = option as KnownHostRuntime;
      } else if (argument === '--request') request = option;
      else if (argument === '--request-file') requestFile = option;
      else if (argument === '--reviewer') reviewer = option;
      else if (argument === '--model') model = option;
      else if (argument === '--effort') effort = option;
      else if (argument === '--output') output = option;
      continue;
    }
    throw new UsageError('argument_unknown', `Unknown argument: ${argument}`);
  }

  const selectors = [
    baseRef !== undefined,
    files !== undefined,
    document !== undefined,
  ].filter(Boolean).length;
  if (selectors === 0) {
    throw new UsageError(
      'scope_required',
      'Choose Branch diff, Selected files, or Document or plan before dispatch',
    );
  }
  if (selectors !== 1) {
    throw new UsageError(
      'selector_conflict',
      'Exactly one of base_branch=<ref>, --files, or --document is allowed',
    );
  }
  if (!host) throw new UsageError('host_required', '--host is required');
  if (request !== undefined && requestFile !== undefined) {
    throw new UsageError(
      'request_conflict',
      'Use only one of --request or --request-file',
    );
  }
  if ((model || effort) && !reviewer) {
    throw new UsageError(
      'reviewer_required',
      '--model and --effort require --reviewer',
    );
  }
  if (allowSameProvider && !reviewer) {
    throw new UsageError(
      'reviewer_required',
      '--allow-same-provider requires --reviewer and explicit user consent',
    );
  }
  if (requestFile) {
    request = await readBoundedText(path.resolve(cwd, requestFile));
  }
  const scope: ReviewScopeRequest = baseRef
    ? { kind: 'base_branch', ref: baseRef }
    : files
      ? { kind: 'files', paths: files }
      : { kind: 'document', path: document! };
  return {
    scope,
    host,
    request: request ?? defaultRequest(scope),
    ...(reviewer ? { reviewer } : {}),
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {}),
    ...(allowSameProvider ? { allowSameProvider } : {}),
    ...(output ? { output } : {}),
    json,
  };
}

function optionValue(
  argv: string[],
  index: number,
  argument: string,
): string | null {
  const valued = new Set([
    '--document',
    '--host',
    '--request',
    '--request-file',
    '--reviewer',
    '--model',
    '--effort',
    '--output',
  ]);
  if (!valued.has(argument)) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new UsageError(
      'argument_value_required',
      `${argument} requires a value`,
    );
  }
  return value;
}

function defaultRequest(scope: ReviewScopeRequest): string {
  if (scope.kind === 'base_branch') {
    return `Review the bounded branch diff against ${scope.ref} for correctness, regressions, missing requirements, and verification gaps.`;
  }
  if (scope.kind === 'files') {
    return 'Review the explicitly selected files for correctness, regressions, missing requirements, and verification gaps.';
  }
  return 'Review the selected document or plan for correctness, completeness, internal consistency, and actionable risks.';
}

async function readBoundedText(targetPath: string): Promise<string> {
  const handle = await open(targetPath, constants.O_RDONLY);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('request file must be a regular file');
    if (info.size > REQUEST_FILE_MAX_BYTES) {
      throw new Error(`request file exceeds ${REQUEST_FILE_MAX_BYTES} bytes`);
    }
    return await handle.readFile('utf8');
  } finally {
    await handle.close();
  }
}

function usageOutcome(error: UsageError, json: boolean): ReviewCliOutcome {
  const payload = {
    ok: false,
    status: 'usage_error',
    reason: error.reason,
    message: error.message,
    invocation_count: 0,
    supported_scopes: [
      'base_branch=<ref>',
      '--files <paths...>',
      '--document <path>',
    ],
  };
  return {
    exitCode: 2,
    json,
    payload,
    human: `${error.reason}: ${error.message}\n\n${USAGE}`,
  };
}

function diagnosticOutcome(
  result: Extract<ExecuteReviewResult, { ok: false }>,
  json: boolean,
): ReviewCliOutcome {
  const payload = {
    ok: false,
    status: result.status,
    reason: result.reason,
    message: result.message,
    invocation_count: result.invocation_count,
    ...(result.diagnosticPath
      ? { artifacts: { diagnostic: path.resolve(result.diagnosticPath) } }
      : {}),
  };
  return {
    exitCode: 1,
    json,
    payload,
    human: [
      `Review did not complete: ${result.status} (${result.reason}).`,
      result.message,
      ...(result.diagnosticPath
        ? [`Diagnostic artifact: ${path.resolve(result.diagnosticPath)}`]
        : []),
      `Provider invocations: ${result.invocation_count}.`,
    ].join('\n'),
  };
}

async function exportCompletedMarkdown(input: {
  cwd: string;
  requestedPath: string;
  contents: string;
  aggregate: ReviewAggregate;
  canonicalMarkdown: string;
}): Promise<string> {
  const requested = path.resolve(input.cwd, input.requestedPath);
  try {
    await lstat(requested);
    throw new Error('output destination already exists');
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  const parent = await realpath(path.dirname(requested));
  const destination = path.join(parent, path.basename(requested));
  const protectedPaths = new Set([
    input.canonicalMarkdown,
    input.aggregate.paths.request,
    input.aggregate.paths.evidence,
    input.aggregate.paths.result,
    ...input.aggregate.scope.externalDocuments,
    ...input.aggregate.scope.selectedPaths.map((candidate) =>
      path.join(input.aggregate.worktree_root, candidate),
    ),
  ]);
  if (protectedPaths.has(destination)) {
    throw new Error('output destination aliases a protected review input');
  }
  await writeExclusive(destination, input.contents, 0o600);
  return destination;
}

async function writeExclusive(
  targetPath: string,
  contents: string,
  mode: number,
): Promise<void> {
  const handle = await open(targetPath, 'wx', mode);
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function localOutputFailure(
  result: Extract<ExecuteReviewResult, { ok: true; status: 'completed' }>,
  reason: string,
  message: string,
  json: boolean,
  markdown?: string,
): Promise<ReviewCliOutcome> {
  const diagnosticPath = path.join(
    result.runState.runDirectory,
    'cli-diagnostic.json',
  );
  const payload = {
    ok: false,
    status: 'output_failed',
    reason,
    message,
    invocation_count: result.invocation_count,
    artifacts: {
      json: result.artifactPath,
      ...(markdown ? { markdown } : {}),
      diagnostic: diagnosticPath,
    },
  };
  await writeExclusive(
    diagnosticPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    0o600,
  ).catch(() => undefined);
  return {
    exitCode: 1,
    json,
    payload,
    human: `${message}\nDiagnostic artifact: ${diagnosticPath}`,
  };
}

function groupFindings(findings: ReviewFinding[]) {
  return {
    critical: findings.filter((entry) => entry.severity === 'critical'),
    important: findings.filter((entry) => entry.severity === 'important'),
    medium: findings.filter((entry) => entry.severity === 'medium'),
    minor: findings.filter((entry) => entry.severity === 'minor'),
  };
}

function renderSeverity(
  heading: string,
  prefix: string,
  findings: ReviewFinding[],
): string[] {
  const lines = [`### ${heading}`, ''];
  if (findings.length === 0) return [...lines, 'None', ''];
  findings.forEach((finding, index) => {
    const location = finding.location
      ? `${finding.location.path}:${finding.location.start_line}${finding.location.end_line === finding.location.start_line ? '' : `-${finding.location.end_line}`} (${finding.location.source_version})`
      : `anchor: ${finding.anchor}`;
    lines.push(
      `- **${prefix}${index + 1}: ${escapeMarkdown(finding.title)}** (${inlineCode(location)})`,
      `  - Claim: ${escapeMarkdown(finding.claim)}`,
      `  - Evidence: ${escapeMarkdown(finding.evidence)}`,
      `  - Suggestion: ${escapeMarkdown(finding.suggestion)}`,
      `  - Confidence: ${finding.confidence}`,
      '',
    );
  });
  return lines;
}

function renderStringList(values: string[]): string[] {
  return values.length > 0
    ? values.map((entry) => `- ${escapeMarkdown(entry)}`)
    : ['None'];
}

function renderChecks(checks: ReviewAggregate['reply']['checks']): string[] {
  return checks.length > 0
    ? checks.map(
        (check) =>
          `- ${escapeMarkdown(check.name)} — ${escapeMarkdown(check.status)}${check.detail ? `: ${escapeMarkdown(check.detail)}` : ''}`,
      )
    : ['None'];
}

function scopeDescription(aggregate: ReviewAggregate): string {
  const scope = aggregate.scope.request;
  if (scope.kind === 'base_branch') return `base_branch=${scope.ref}`;
  if (scope.kind === 'files') return `files=${scope.paths.join(',')}`;
  return `document=${scope.path}`;
}

function inlineCode(value: string): string {
  const longest = Math.max(
    0,
    ...Array.from(value.matchAll(/`+/gu), (match) => match[0].length),
  );
  const fence = '`'.repeat(longest + 1);
  return `${fence}${value}${fence}`;
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/([`*_{}[\]()<>#+.!|-])/gu, '\\$1')
    .replaceAll('\r', '')
    .replaceAll('\n', '<br>');
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await reviewMain();
}
