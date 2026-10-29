import { Command, CommanderError } from 'commander';

import { getCapabilities, type Envelope } from './capabilities.js';

interface Output {
  stdout(text: string): void;
  stderr(text: string): void;
}

function emit(output: Output, envelope: Envelope<unknown>): void {
  output.stdout(`${JSON.stringify(envelope)}\n`);
}

function createCapabilitiesCommand(output: Output): Command {
  return new Command('capabilities')
    .description('Report implemented, versioned capabilities (JSON envelope)')
    .option('--json', 'Emit one JSON envelope; suppress interactive behavior')
    .action(() => {
      emit(output, { ok: true, schema_version: 1, data: getCapabilities() });
    });
}

/** Each invocation owns its parser; library imports do not construct a CLI. */
function createProgram(output: Output): Command {
  return new Command()
    .name('seshtk')
    .description(
      'Session Toolkit — package boundary; session operations are not yet available',
    )
    .version(
      getCapabilities().version,
      '-V, --version',
      'Print the package version',
    )
    .option('--json', 'Emit one JSON envelope; suppress interactive behavior')
    .addCommand(createCapabilitiesCommand(output))
    .showSuggestionAfterError(false)
    .exitOverride();
}

/** Return an exit code; only the bin sets process.exitCode. */
export function main(argv: readonly string[], output: Output): number {
  const json = argv.includes('--json');
  let captured = '';
  const program = createProgram(output);
  for (const command of [program, ...program.commands]) {
    command.exitOverride().configureOutput({
      writeOut: (text) => {
        captured += text;
      },
      writeErr: () => {},
    });
  }
  try {
    // No implicit interactive prompt when invoked without a command.
    if (argv.length === 0 || (argv.length === 1 && json)) {
      captured = program.helpInformation();
      if (json)
        emit(output, { ok: true, schema_version: 1, data: { help: captured } });
      else output.stdout(captured);
      return 0;
    }
    program.parse([...argv], { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      if (json) {
        const data =
          error.code === 'commander.version'
            ? { version: getCapabilities().version }
            : { help: captured };
        emit(output, { ok: true, schema_version: 1, data });
      } else output.stdout(captured);
      return 0;
    }
    const usage = error instanceof CommanderError;
    const envelope: Envelope<never> = {
      ok: false,
      schema_version: 1,
      error: {
        code: usage ? 'E_USAGE' : 'E_INTERNAL',
        message: usage ? error.message : 'An unexpected error occurred',
        hint: usage
          ? 'Run seshtk --help for available commands and options.'
          : 'Retry and report the failure with the installed seshtk version.',
      },
    };
    if (json) emit(output, envelope);
    else output.stderr(`${envelope.error.message}\n${envelope.error.hint}\n`);
    return usage ? 1 : 2;
  }
}
