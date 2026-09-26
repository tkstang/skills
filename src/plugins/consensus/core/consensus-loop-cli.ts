import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runConsensusLoop } from './consensus-loop.js';
import { exitCodeForError, hardErrorMessage } from './loop-validation.js';

// CLI entry for the generated consensus-loop.mjs. Kept out of consensus-loop.ts
// so wrappers that bundle the loop do not also inherit its entrypoint.
export * from './consensus-loop.js';

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  runConsensusLoop(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${hardErrorMessage(error)}\n`);
    process.exitCode = exitCodeForError(error);
  });
}
