import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('..', import.meta.url);

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function runNode(args) {
  return runCommand(process.execPath, args);
}

function runBuildCheck() {
  return runCommand('pnpm', ['run', 'build:check']);
}

describe('generated output drift guard', () => {
  it('checks committed generated outputs without mutating tracked files', async () => {
    const result = await runNode(['scripts/build-generated.mjs', '--check']);

    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('consensus-loop: in sync');
    expect(result.stdout).toContain('consensus-refine: in sync');
    expect(result.stdout).toContain(
      'transcript-core-session-observer: in sync',
    );
    expect(result.stdout).toContain('transcript-core-export-session: in sync');
    expect(result.stdout).not.toContain('pending');
    expect(result.code).toBe(0);
  });

  it('declares source to generated-output mappings', async () => {
    const script = await readFile(
      new URL('../scripts/build-generated.mjs', import.meta.url),
      'utf8',
    );

    expect(script).toContain('src/consensus/core/consensus-loop.ts');
    expect(script).toContain(
      'plugins/consensus/skills/refine/scripts/consensus-loop.mjs',
    );
    expect(script).toContain('src/consensus/refine/consensus-refine.ts');
    expect(script).toContain(
      'plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
    );
    expect(script).toContain('src/transcript/core/runtimes.ts');
    expect(script).toContain(
      'skills/session-observer/scripts/lib/runtimes.mjs',
    );
    expect(script).toContain(
      'skills/export-session-transcript/scripts/lib/runtimes.mjs',
    );
  });

  it('fails build:check when transcript-core generated output is stale and restores it', async () => {
    const target = new URL(
      '../skills/session-observer/scripts/lib/runtimes.mjs',
      import.meta.url,
    );
    const original = await readFile(target, 'utf8');

    try {
      await writeFile(
        target,
        `${original}\n// transcript-core drift\n`,
        'utf8',
      );
      const result = await runBuildCheck();
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.code).not.toBe(0);
      expect(output).toContain(
        'skills/session-observer/scripts/lib/runtimes.mjs',
      );
      expect(output).toContain('generated output is stale');
    } finally {
      await writeFile(target, original, 'utf8');
    }

    const restored = await runBuildCheck();
    expect(restored.code).toBe(0);
  });

  it('rewrites only emitted module specifiers', async () => {
    const { rewriteImportSpecifiers } =
      await import('../scripts/build-generated.mjs');
    const rewrite = {
      from: '../core/consensus-loop.js',
      to: './consensus-loop.mjs',
    };
    const source = [
      'import { runConsensusLoop } from "../core/consensus-loop.js";',
      'import "../core/consensus-loop.js";',
      'const dynamicLoop = () => import("../core/consensus-loop.js");',
      'const diagnostic = "../core/consensus-loop.js";',
      'const message = "from \'../core/consensus-loop.js\'";',
    ].join('\n');

    const rewritten = rewriteImportSpecifiers(source, rewrite, 'test-mapping');

    expect(rewritten).toContain(
      "import { runConsensusLoop } from './consensus-loop.mjs';",
    );
    expect(rewritten).toContain("import './consensus-loop.mjs';");
    expect(rewritten).toContain(
      "const dynamicLoop = () => import('./consensus-loop.mjs');",
    );
    expect(rewritten).toContain(
      'const diagnostic = "../core/consensus-loop.js";',
    );
    expect(rewritten).toContain(
      'const message = "from \'../core/consensus-loop.js\'";',
    );
  });

  it('fails when a configured rewrite source is absent from module specifiers', async () => {
    const { rewriteImportSpecifiers } =
      await import('../scripts/build-generated.mjs');

    expect(() =>
      rewriteImportSpecifiers(
        'const diagnostic = "../core/consensus-loop.js";',
        {
          from: '../core/consensus-loop.js',
          to: './consensus-loop.mjs',
        },
        'test-mapping',
      ),
    ).toThrow(
      'Import rewrite for test-mapping expected emitted output to contain module specifier ../core/consensus-loop.js',
    );
  });
});
