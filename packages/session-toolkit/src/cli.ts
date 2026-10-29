import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

import { Command, CommanderError, InvalidArgumentError } from 'commander';

import { captureActivity } from './activity.js';
import { getCapabilities, type Envelope } from './capabilities.js';
import { listSessions, readTranscript } from './discovery.js';
import { ToolkitError, provider, selector } from './domain.js';
import { readEvidence } from './evidence.js';
import { exportMarkdown } from './export.js';
import { identifyCurrentTranscript } from './identity.js';
import { parseTranscript } from './reader.js';
import type { ReadOptions } from './reader.js';
import {
  searchSessions,
  estimateSearch,
  type SearchOptions,
} from './search.js';
interface Output {
  stdout(text: string): void;
  stderr(text: string): void;
}
function emit(output: Output, envelope: Envelope<unknown>): void {
  output.stdout(`${JSON.stringify(envelope)}\n`);
}
function path(value: string): string {
  return resolve(
    value === '~'
      ? homedir()
      : value.startsWith('~/')
        ? join(homedir(), value.slice(2))
        : value,
  );
}
function integer(value: string): number {
  const n = Number(value);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(n) || n < 0)
    throw new InvalidArgumentError('Must be a nonnegative safe integer.');
  return n;
}
function positiveInteger(value: string): number {
  const n = integer(value);
  if (n === 0)
    throw new InvalidArgumentError('Must be a positive safe integer.');
  return n;
}
function discovery(command: Command): Command {
  return command
    .option(
      '--runtime <provider-or-auto>',
      'claude-code, codex, cursor or auto',
      'auto',
    )
    .option('--cwd <path>', 'Historical cwd filter', path)
    .option('--session <provider:id>', 'Qualified native session')
    .option('--since <time>', 'Inclusive lower time bound')
    .option(
      '--until <time>',
      'Exclusive upper time bound (calendar days include the whole day)',
    )
    .option(
      '--limit <positive-int>',
      'Returned candidate limit',
      positiveInteger,
      100,
    );
}
function bounds(command: Command): Command {
  return command
    .option(
      '--from-offset <nonnegative-int>',
      'Provider source ordinal',
      integer,
    )
    .option('--cursor <token>', 'Generation/projection-bound continuation')
    .option(
      '--max-records <positive-int>',
      'Maximum decoded records (whole source records)',
      positiveInteger,
    )
    .option(
      '--max-messages <positive-int>',
      'Maximum conversation entries (whole source records)',
      positiveInteger,
    )
    .option(
      '--max-bytes <positive-int>',
      'Source byte budget',
      positiveInteger,
      4_000_000,
    );
}
function projections(command: Command): Command {
  return command
    .option('--include-tool-calls', 'Include recorded tool call previews')
    .option('--include-tool-results', 'Include recorded tool result previews')
    .option(
      '--include-activity',
      'Include a separate captured-page activity summary',
    );
}
function readOptions(
  o: Record<string, unknown>,
): Omit<ReadOptions, 'runtime' | 'path'> {
  return {
    fromOffset: o.fromOffset as number | undefined,
    cursor: o.cursor as string | undefined,
    maxBytes: o.maxBytes as number,
    maxRecords: o.maxRecords as number | undefined,
    maxMessages: o.maxMessages as number | undefined,
    includeToolCalls: !!o.includeToolCalls,
    includeToolResults: !!o.includeToolResults,
    includeActivity: !!o.includeActivity,
  };
}
/** Each invocation owns its parser. This module is reached only from the bin. */
function createProgram(output: Output, json: boolean): Command {
  const program = new Command()
    .name('seshtk')
    .description(
      'Session Toolkit — exact identity, historical discovery and bounded transcript evidence',
    )
    .version(
      getCapabilities().version,
      '-V, --version',
      'Print the package version',
    )
    .option('--json', 'Emit one JSON envelope')
    .showSuggestionAfterError(false)
    .exitOverride();
  function operation(
    name: string,
    description: string,
    configure: (command: Command) => Command,
    run: (o: Record<string, unknown>, args: string[]) => Promise<unknown>,
  ): Command {
    const command = configure(
      new Command(name)
        .description(description)
        .option('--json', 'Emit one JSON envelope'),
    );
    command.action(async (...args: unknown[]) => {
      const options = command.optsWithGlobals();
      const data = await run(
        options,
        args.filter((a) => typeof a === 'string') as string[],
      );
      if (json) emit(output, { ok: true, schema_version: 1, data });
      else if (data && typeof data === 'object' && 'messages' in data) {
        const page = data as Awaited<ReturnType<typeof parseTranscript>>;
        output.stdout(
          page.messages
            .map(
              (m) =>
                `[${m.role}${m.kind === 'message' ? '' : ` ${m.kind}`}] ${m.text}`,
            )
            .join('\n\n') + '\n',
        );
        if (!page.coverage.complete)
          output.stderr(
            `Partial source coverage: ${page.coverage.reasons.join(', ')}. Use --json for continuation.\n`,
          );
      } else output.stdout(JSON.stringify(data, null, 2) + '\n');
    });
    program.addCommand(command);
    return command;
  }
  program.addCommand(
    new Command('capabilities')
      .description('Report implemented versioned capabilities (JSON envelope)')
      .option('--json', 'Emit one JSON envelope')
      .action(() =>
        emit(output, { ok: true, schema_version: 1, data: getCapabilities() }),
      ),
  );
  operation(
    'self-identify',
    'Resolve exact current identity; cwd/recency never selects a winner',
    (c) => c.option('--cwd <path>', 'Scope/revalidate canonical cwd', path),
    async (o) => {
      const identity = await identifyCurrentTranscript({
        cwd: (o.cwd as string | undefined) ?? process.cwd(),
      });
      if (identity.status !== 'authoritative')
        throw new ToolkitError(
          identity.status === 'ambiguous' ? 'E_AMBIGUOUS' : 'E_UNAVAILABLE',
          'Exact current identity could not be established.',
          'Inspect harness identity and provider-store evidence; use list for historical candidates.',
          identity,
        );
      return identity;
    },
  );
  operation(
    'list',
    'List historical candidates with explicit discovery coverage',
    discovery,
    async (o) =>
      listSessions({
        ...o,
        cwd: (o.cwd as string | undefined) ?? process.cwd(),
      }),
  );
  operation(
    'read',
    'Read an explicitly qualified session without persisting selection/offsets',
    (c) =>
      projections(
        bounds(
          c.requiredOption(
            '--session <provider:id>',
            'Qualified native session',
          ),
        ),
      )
        .option('--evidence', 'Exact Codex evidence (JSON only)')
        .option('--cutoff <token>', 'Freeze the captured Codex source prefix')
        .option('--expand <ref>', 'Expand a recorded tool evidence reference')
        .option('--related', 'Expand related recorded events (at most 16)')
        .option(
          '--expand-offset <nonnegative-byte-count>',
          'Byte offset within redacted expansion fields',
          integer,
        ),
    async (o) => {
      const session = o.session as string;
      selector(session);
      const evidence =
        !!o.evidence ||
        ['cutoff', 'expand', 'related', 'expandOffset'].some(
          (k) => o[k] !== undefined,
        );
      if (evidence) {
        if (!json)
          throw new ToolkitError(
            'E_USAGE',
            'Exact evidence requires JSON output.',
            'Add --json.',
          );
        if (o.cursor !== undefined || o.fromOffset !== undefined)
          throw new ToolkitError(
            'E_USAGE',
            'Evidence conflicts with ordinary cursor/offset pagination.',
            'Use a cutoff for evidence continuation.',
          );
        return readEvidence({
          session,
          cutoff: o.cutoff as string | undefined,
          expand: o.expand as string | undefined,
          related: !!o.related,
          expandOffset: o.expandOffset as number | undefined,
          maxBytes: o.maxBytes as number,
          maxRecords: o.maxRecords as number | undefined,
          maxMessages: o.maxMessages as number | undefined,
        });
      }
      return readTranscript({ session, ...readOptions(o) });
    },
  );
  operation(
    'parse',
    'Parse an explicit JSONL file; no discovery',
    (c) =>
      projections(
        bounds(
          c
            .argument('<transcript-path>')
            .requiredOption('--runtime <provider>', 'Explicit provider'),
        ),
      ),
    async (o, args) =>
      parseTranscript({
        runtime: provider(o.runtime as string),
        path: path(args[0]),
        ...readOptions(o),
      }),
  );
  operation(
    'export',
    'Write sanitized conversational Markdown to new destinations',
    (c) =>
      projections(discovery(c))
        .requiredOption(
          '--out <path>',
          'Output file, or directory with --all',
          path,
        )
        .option('--match <marker>', 'Visible conversation marker')
        .option('--all', 'Export the bounded historical candidate set')
        .option(
          '--max-bytes <positive-int>',
          'Source byte budget per transcript',
          positiveInteger,
          4_000_000,
        ),
    async (o) => exportMarkdown({ ...o, out: o.out as string }),
  );
  operation(
    'activity',
    'Capture sensitive full structured activity (not sanitized)',
    (c) =>
      bounds(
        c.requiredOption('--session <provider:id>', 'Qualified native session'),
      ).option(
        '--out <path>',
        'Write sensitive JSON artifact to a new file',
        path,
      ),
    async (o) => {
      const capture = await captureActivity({
        session: o.session as string,
        ...readOptions(o),
      });
      if (o.out) {
        await writeFile(
          o.out as string,
          JSON.stringify(capture, null, 2) + '\n',
          { flag: 'wx' },
        );
        return {
          kind: 'sensitive-activity-artifact',
          out: o.out,
          source: capture.source,
          coverage: capture.sourceRead.coverage,
        };
      }
      return capture;
    },
  );
  function searchFlags(c: Command): Command {
    const collect = (value: string, previous: string[]) => [...previous, value];
    return c
      .option(
        '-p, --pattern <pattern>',
        'Repeatable regex or literal pattern',
        collect,
        [],
      )
      .option('--literal', 'Match literal text instead of regex')
      .option(
        '--runtime <provider-or-auto>',
        'claude-code, codex, cursor or auto',
        'auto',
      )
      .option('--cwd <path>', 'Repeatable widening cwd hint', collect, [])
      .option('--since <time>', 'Inclusive lower time bound')
      .option('--until <time>', 'Exclusive upper time bound')
      .option(
        '--tiers <comma-list>',
        'history,meta,content in canonical order',
        'history,meta,content',
      )
      .option('--no-deep', 'Disable tool-output fallback')
      .option('--include-tools', 'Include raw tool units')
      .option(
        '--allow-large-scan',
        'Explicitly authorize scans over the byte threshold',
      )
      .option(
        '--large-scan-bytes <positive-int>',
        'Scan authorization threshold',
        positiveInteger,
        2147483648,
      )
      .option(
        '--max-line-bytes <positive-int>',
        'Decoded line budget (oversize carriers reported)',
        positiveInteger,
        65536,
      )
      .option(
        '--limit <positive-int>',
        'Returned ranked sessions',
        positiveInteger,
        15,
      )
      .option(
        '--deadline-ms <positive-int>',
        'Operation deadline',
        positiveInteger,
      );
  }
  const searchInput = (o: Record<string, unknown>): SearchOptions => ({
    ...o,
    patterns: o.pattern as string[],
    tiers: (o.tiers as string).split(',') as SearchOptions['tiers'],
  });
  const search = operation(
    'search',
    'Search raw historical evidence with tiered widening',
    searchFlags,
    async (o) => searchSessions(searchInput(o)),
  );
  const estimate = searchFlags(
    new Command('estimate')
      .description('Estimate candidate bytes without content hits')
      .option('--json', 'Emit one JSON envelope'),
  );
  estimate.action(async () => {
    const data = await estimateSearch(searchInput(estimate.optsWithGlobals()));
    if (json) emit(output, { ok: true, schema_version: 1, data });
    else output.stdout(JSON.stringify(data, null, 2) + '\n');
  });
  search.addCommand(estimate);
  return program;
}
/** Only the bin sets process.exitCode. Domain errors never expose provider content. */
export async function main(
  argv: readonly string[],
  output: Output,
): Promise<number> {
  const json = argv.includes('--json');
  let captured = '';
  const program = createProgram(output, json);
  const commands = (command: Command): Command[] => [
    command,
    ...command.commands.flatMap(commands),
  ];
  for (const command of commands(program))
    command.exitOverride().configureOutput({
      writeOut: (text) => {
        captured += text;
      },
      writeErr: () => {},
    });
  try {
    if (argv.length === 0 || (argv.length === 1 && json)) {
      captured = program.helpInformation();
      if (json)
        emit(output, { ok: true, schema_version: 1, data: { help: captured } });
      else output.stdout(captured);
      return 0;
    }
    await program.parseAsync([...argv], { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      if (json)
        emit(output, {
          ok: true,
          schema_version: 1,
          data:
            error.code === 'commander.version'
              ? { version: getCapabilities().version }
              : { help: captured },
        });
      else output.stdout(captured);
      return 0;
    }
    const usage = error instanceof CommanderError;
    const domain = error instanceof ToolkitError;
    const io =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR', 'EEXIST'].includes(
        String(error.code),
      );
    const envelope: Envelope<never> = {
      ok: false,
      schema_version: 1,
      error: {
        code: domain
          ? error.code
          : usage
            ? 'E_USAGE'
            : io
              ? 'E_IO'
              : 'E_INTERNAL',
        message:
          domain || usage
            ? error.message
            : io
              ? 'Cannot access the requested source or destination.'
              : 'An unexpected error occurred.',
        hint: domain
          ? error.hint
          : usage
            ? 'Run seshtk --help for available commands and options.'
            : io
              ? 'Check paths, permissions and provider-store availability.'
              : 'Retry and report the installed seshtk version.',
        ...(domain && error.details !== undefined
          ? { details: error.details }
          : {}),
      },
    };
    if (json) emit(output, envelope);
    else output.stderr(`${envelope.error.message}\n${envelope.error.hint}\n`);
    return (domain && error.code !== 'E_IO' && error.code !== 'E_INTERNAL') ||
      usage
      ? 1
      : 2;
  }
}
