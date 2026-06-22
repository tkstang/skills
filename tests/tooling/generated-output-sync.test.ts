import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations; this test exercises the shipped artifact.
import lintStagedConfig from '../../.lintstagedrc.mjs';
// @ts-expect-error No type declarations; this test exercises the shipped artifact.
import { generatedOutputs } from '../../scripts/build-generated.mjs';

const repoRoot = new URL('../..', import.meta.url);
const generatedOutputPaths = generatedOutputs.map(
  (mapping: any) => mapping.output,
);

function runCommand(
  command: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
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

function runNode(args: string[]) {
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
    expect(result.stdout).toContain('consensus-evaluate-loop: in sync');
    expect(result.stdout).toContain('consensus-evaluate: in sync');
    expect(result.stdout).toContain('consensus-create-loop: in sync');
    expect(result.stdout).toContain('consensus-create: in sync');
    expect(result.stdout).toContain('consensus-decide-loop: in sync');
    expect(result.stdout).toContain('consensus-decide: in sync');
    expect(result.stdout).toContain('consensus-plan-loop: in sync');
    expect(result.stdout).toContain('consensus-plan: in sync');
    expect(result.stdout).toContain('consensus-provider-cli: in sync');
    expect(result.stdout).toContain(
      'transcript-core-session-observer: in sync',
    );
    expect(result.stdout).toContain('session-observer-digest: in sync');
    expect(result.stdout).toContain('session-observer-locate: in sync');
    expect(result.stdout).toContain('session-observer-observe: in sync');
    expect(result.stdout).toContain('session-observer-rank: in sync');
    expect(result.stdout).toContain(
      'session-observer-session-classifier: in sync',
    );
    expect(result.stdout).toContain('session-observer-state: in sync');
    expect(result.stdout).toContain('session-observer-watch-state: in sync');
    expect(result.stdout).toContain('session-observer-watch: in sync');
    expect(result.stdout).toContain('session-observer-cli: in sync');
    expect(result.stdout).toContain('session-observer-probe-local: in sync');
    expect(result.stdout).toContain('transcript-core-export-session: in sync');
    expect(result.stdout).toContain('export-session-sanitize: in sync');
    expect(result.stdout).toContain('export-session-transcript-cli: in sync');
    expect(result.stdout).not.toContain('pending');
    expect(result.code).toBe(0);
  });

  it('lists generated output paths for hook and CI guards', async () => {
    const result = await runNode([
      'scripts/build-generated.mjs',
      '--list-outputs',
    ]);

    expect(result.stderr).toBe('');
    expect(result.stdout.trim().split('\n')).toEqual(generatedOutputPaths);
    expect(result.code).toBe(0);
  });

  it('declares source to generated-output mappings', async () => {
    const script = await readFile(
      new URL('../../scripts/build-generated.mjs', import.meta.url),
      'utf8',
    );

    expect(script).toContain('src/consensus/core/consensus-loop.ts');
    expect(script).toContain(
      'plugins/consensus/skills/refine/scripts/consensus-loop.mjs',
    );
    expect(script).toContain(
      'plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs',
    );
    expect(script).toContain('src/consensus/refine/consensus-refine.ts');
    expect(script).toContain(
      'plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
    );
    expect(script).toContain('src/consensus/evaluate/consensus-evaluate.ts');
    expect(script).toContain(
      'plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs',
    );
    expect(script).toContain(
      'plugins/consensus/skills/create/scripts/consensus-loop.mjs',
    );
    expect(script).toContain('src/consensus/create/consensus-create.ts');
    expect(script).toContain(
      'plugins/consensus/skills/create/scripts/consensus-create.mjs',
    );
    expect(script).toContain(
      'plugins/consensus/skills/decide/scripts/consensus-loop.mjs',
    );
    expect(script).toContain('src/consensus/decide/consensus-decide.ts');
    expect(script).toContain(
      'plugins/consensus/skills/decide/scripts/consensus-decide.mjs',
    );
    expect(script).toContain(
      'plugins/consensus/skills/plan/scripts/consensus-loop.mjs',
    );
    expect(script).toContain('src/consensus/plan/consensus-plan.ts');
    expect(script).toContain(
      'plugins/consensus/skills/plan/scripts/consensus-plan.mjs',
    );
    expect(script).toContain('src/consensus/provider-cli/cli.ts');
    expect(script).toContain('plugins/consensus/scripts/consensus.mjs');
    expect(script).toContain('src/transcript/core/runtimes.ts');
    expect(script).toContain(
      'skills/session-observer/scripts/lib/runtimes.mjs',
    );
    expect(script).toContain(
      'src/transcript/session-observer/session-observer.ts',
    );
    expect(script).toContain(
      'skills/session-observer/scripts/session-observer.mjs',
    );
    expect(script).toContain('src/transcript/session-observer/probe-local.ts');
    expect(script).toContain('skills/session-observer/scripts/probe-local.mjs');
    expect(script).toContain('src/transcript/session-observer/lib/digest.ts');
    expect(script).toContain('skills/session-observer/scripts/lib/digest.mjs');
    expect(script).toContain('src/transcript/session-observer/lib/locate.ts');
    expect(script).toContain('skills/session-observer/scripts/lib/locate.mjs');
    expect(script).toContain('src/transcript/session-observer/lib/observe.ts');
    expect(script).toContain('skills/session-observer/scripts/lib/observe.mjs');
    expect(script).toContain('src/transcript/session-observer/lib/rank.ts');
    expect(script).toContain('skills/session-observer/scripts/lib/rank.mjs');
    expect(script).toContain(
      'src/transcript/session-observer/lib/session-classifier.ts',
    );
    expect(script).toContain(
      'skills/session-observer/scripts/lib/session-classifier.mjs',
    );
    expect(script).toContain('src/transcript/session-observer/lib/state.ts');
    expect(script).toContain('skills/session-observer/scripts/lib/state.mjs');
    expect(script).toContain(
      'src/transcript/session-observer/lib/watch-state.ts',
    );
    expect(script).toContain(
      'skills/session-observer/scripts/lib/watch-state.mjs',
    );
    expect(script).toContain('src/transcript/session-observer/lib/watch.ts');
    expect(script).toContain('skills/session-observer/scripts/lib/watch.mjs');
    expect(script).toContain(
      'skills/export-session-transcript/scripts/lib/runtimes.mjs',
    );
    expect(script).toContain('src/transcript/export-session/sanitize.ts');
    expect(script).toContain(
      'skills/export-session-transcript/scripts/lib/sanitize.mjs',
    );
    expect(script).toContain(
      'src/transcript/export-session/export-session-transcript.ts',
    );
    expect(script).toContain(
      'skills/export-session-transcript/scripts/export-session-transcript.mjs',
    );
  });

  it('documents generated runtime outputs for the creation skill family', async () => {
    const docs = await readFile(
      new URL(
        '../../documentation/docs/engineering/architecture/generated-runtime.md',
        import.meta.url,
      ),
      'utf8',
    );

    expect(docs).toContain('src/consensus/create/consensus-create.ts');
    expect(docs).toContain(
      'plugins/consensus/skills/create/scripts/consensus-create.mjs',
    );
    expect(docs).toContain('src/consensus/decide/consensus-decide.ts');
    expect(docs).toContain(
      'plugins/consensus/skills/decide/scripts/consensus-decide.mjs',
    );
    expect(docs).toContain('src/consensus/plan/consensus-plan.ts');
    expect(docs).toContain(
      'plugins/consensus/skills/plan/scripts/consensus-plan.mjs',
    );
  });

  it('excludes generated outputs from static lint and format configs', async () => {
    const [oxfmt, oxlint] = await Promise.all([
      readFile(new URL('../../.oxfmtrc.json', import.meta.url), 'utf8').then(
        JSON.parse,
      ),
      readFile(new URL('../../.oxlintrc.json', import.meta.url), 'utf8').then(
        JSON.parse,
      ),
    ]);

    // TODO(generated-output): If the config moves to globbed ignore patterns,
    // replace this exact-entry assertion with a glob-match assertion so every
    // generated output remains covered.
    for (const output of generatedOutputPaths) {
      expect(oxfmt.ignorePatterns).toContain(output);
      expect(oxlint.ignorePatterns).toContain(output);
    }
  });

  it('excludes generated outputs from lint-staged tasks', () => {
    const jsTask = lintStagedConfig['*.{mjs,js}'];

    for (const output of generatedOutputPaths) {
      expect(jsTask([output])).toEqual([]);
      expect(jsTask([new URL(output, repoRoot).pathname])).toEqual([]);
    }
  });

  it('derives CI generated-output guards from build-generated mappings', async () => {
    const workflow = await readFile(
      new URL('../../.github/workflows/validate.yml', import.meta.url),
      'utf8',
    );

    expect(workflow).toContain(
      'node scripts/build-generated.mjs --list-outputs > "$RUNNER_TEMP/generated-output-paths.txt"',
    );
    expect(workflow).toContain('generated_outputs+=("$file")');
    expect(
      workflow.match(
        /grep -vxF -f <\(node scripts\/build-generated\.mjs --list-outputs\)/g,
      ),
    ).toHaveLength(2);
  });

  it('rewrites generated export-session CLI imports to shipped runtime files', async () => {
    const cli = await readFile(
      new URL(
        '../../skills/export-session-transcript/scripts/export-session-transcript.mjs',
        import.meta.url,
      ),
      'utf8',
    );

    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli).toContain(
      '// GENERATED by scripts/build-generated.mjs. Do not edit directly.',
    );
    expect(cli).toContain(
      '// Source: src/transcript/export-session/export-session-transcript.ts',
    );
    expect(cli).toContain("from './lib/runtimes.mjs'");
    expect(cli).toContain("from './lib/sanitize.mjs'");
    expect(cli).not.toContain("from '../core/runtimes.js'");
    expect(cli).not.toContain("from './sanitize.js'");
  });

  it('rewrites generated session-observer imports to shipped runtime files', async () => {
    const cli = await readFile(
      new URL(
        '../../skills/session-observer/scripts/session-observer.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    const digest = await readFile(
      new URL(
        '../../skills/session-observer/scripts/lib/digest.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    const watch = await readFile(
      new URL(
        '../../skills/session-observer/scripts/lib/watch.mjs',
        import.meta.url,
      ),
      'utf8',
    );

    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli).toContain(
      '// GENERATED by scripts/build-generated.mjs. Do not edit directly.',
    );
    expect(cli).toContain(
      '// Source: src/transcript/session-observer/session-observer.ts',
    );
    expect(cli).toContain("from './lib/runtimes.mjs'");
    expect(cli).toContain("from './lib/digest.mjs'");
    expect(cli).toContain("from './lib/watch.mjs'");
    expect(cli).not.toContain("from '../core/runtimes.js'");
    expect(cli).not.toContain("from './lib/digest.js'");
    expect(digest).toContain("from './runtimes.mjs'");
    expect(digest).toContain("from './session-classifier.mjs'");
    expect(digest).not.toContain("from '../../core/runtimes.js'");
    expect(watch).toContain("from './runtimes.mjs'");
    expect(watch).toContain("from './observe.mjs'");
    expect(watch).not.toContain("from '../../core/runtimes.js'");
  });

  it('generates a shipped consensus provider CLI entrypoint', async () => {
    const cli = await readFile(
      new URL('../../plugins/consensus/scripts/consensus.mjs', import.meta.url),
      'utf8',
    );

    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli).toContain(
      '// GENERATED by scripts/build-generated.mjs. Do not edit directly.',
    );
    expect(cli).toContain('// Source: src/consensus/provider-cli/cli.ts');
  });

  it('fails build:check when transcript-core generated output is stale and restores it', async () => {
    const target = new URL(
      '../../skills/session-observer/scripts/lib/runtimes.mjs',
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
    // @ts-expect-error No type declarations; this test exercises the shipped artifact.
    const buildGenerated = await import('../../scripts/build-generated.mjs');
    const { rewriteImportSpecifiers } = buildGenerated;
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
    // @ts-expect-error No type declarations; this test exercises the shipped artifact.
    const buildGenerated = await import('../../scripts/build-generated.mjs');
    const { rewriteImportSpecifiers } = buildGenerated;

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
