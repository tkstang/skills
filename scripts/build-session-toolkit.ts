import { execFileSync } from 'node:child_process';
import { chmod, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = fileURLToPath(
  new URL('../packages/session-toolkit/', import.meta.url),
);
// Only this package's ignored build output is replaced. Skill distributions
// retain their existing staged build and committed freshness checks.
await rm(new URL('../packages/session-toolkit/dist/', import.meta.url), {
  recursive: true,
  force: true,
});
execFileSync(
  process.execPath,
  [
    fileURLToPath(
      new URL('../node_modules/typescript/bin/tsc', import.meta.url),
    ),
    '-p',
    `${packageRoot}/tsconfig.json`,
  ],
  { cwd: root, stdio: 'inherit' },
);
await build({
  absWorkingDir: packageRoot,
  entryPoints: ['src/index.ts', 'src/bin.ts'],
  outdir: 'dist',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22.0',
  sourcemap: false,
});
await chmod(
  new URL('../packages/session-toolkit/dist/bin.js', import.meta.url),
  0o755,
);
