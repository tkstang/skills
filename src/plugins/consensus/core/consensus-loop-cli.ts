import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runConsensusLoop } from './consensus-loop.js';
import { exitCodeForError, hardErrorMessage } from './loop-validation.js';

// CLI entry for the generated consensus-loop.mjs. Kept out of consensus-loop.ts
// so wrappers that bundle the loop do not also inherit its entrypoint.
export * from './consensus-loop.js';

// `node -e` code can set argv[1] to a positional argument that is not a path;
// importing this module that way must not throw or run the CLI.
function isEntrypointPath(argvPath: string): boolean {
  try {
    return (
      realpathSync(argvPath) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
}

if (process.argv[1] && isEntrypointPath(process.argv[1])) {
  runConsensusLoop(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${hardErrorMessage(error)}\n`);
    process.exitCode = exitCodeForError(error);
  });
}
