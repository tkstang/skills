import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error lint-staged requires an executable JavaScript config.
import lintStagedConfig from '../../.lintstagedrc.mjs';
import {
  checkGenerated,
  GENERATED_BANNER_PREFIX,
  generatedOutputRoots,
  generatedOutputs,
  isGeneratedOutputPath,
  rewriteImportSpecifiers,
  writeGenerated,
  type GeneratedOutput,
} from '../../scripts/build-generated.js';
import type { DistributionDeclaration } from '../../scripts/lib/packaging.js';
import { distributions } from '../../src/distributions.js';

const repoRoot = new URL('../..', import.meta.url);

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
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runBuilder(...args: string[]) {
  return runCommand('pnpm', ['tsx', 'scripts/build-generated.ts', ...args]);
}

function runBuildCheck() {
  return runCommand('pnpm', ['run', 'build:check']);
}

async function makeGeneratedFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'generated-output-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src/entry.ts'), 'export const value = 1;\n');
  const mappings: GeneratedOutput[] = [
    {
      id: 'fixture',
      source: 'src/entry.ts',
      output: 'generated/entry.mjs',
      bundle: true,
    },
  ];
  await writeGenerated({
    repoRoot: root,
    mappings,
    declarations: [],
    log: () => {},
  });
  return { root, mappings };
}

describe('generated output drift guard', () => {
  it('rolls back file and declared-tree replacements as one transaction', async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), 'generated-transaction-'),
    );
    const write = async (relative: string, value: string) => {
      const output = path.join(root, relative);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, value);
    };
    try {
      await write('src/entry.ts', 'process.stdout.write("new");\n');
      await write(
        'src/skills/one/SKILL.md',
        "---\nname: one\nmetadata:\n  version: '1.0.0'\n---\n",
      );
      await write('skills/one/prior.md', 'prior one');
      await write('generated/entry.mjs', 'prior runtime');
      let renameCalls = 0;
      await expect(
        writeGenerated({
          repoRoot: root,
          mappings: [
            {
              id: 'entry',
              source: 'src/entry.ts',
              output: 'generated/entry.mjs',
              bundle: true,
            },
          ],
          declarations: [
            {
              owner: 'one',
              source: 'src/skills/one',
              targets: [
                { kind: 'standalone', name: 'one', output: 'skills/one' },
              ],
            },
          ],
          operations: {
            rename: async (from, to) => {
              renameCalls += 1;
              if (renameCalls === 4) throw new Error('controlled failure');
              await rename(from, to);
            },
            remove: rm,
          },
          log: () => {},
        }),
      ).rejects.toThrow(/restored|controlled failure/);
      expect(
        await readFile(path.join(root, 'generated/entry.mjs'), 'utf8'),
      ).toBe('prior runtime');
      expect(
        await readFile(path.join(root, 'skills/one/prior.md'), 'utf8'),
      ).toBe('prior one');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('checks committed generated outputs without mutating them', async () => {
    const before = await readFile(
      new URL(
        '../../plugins/consensus/scripts/consensus-loop.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    const result = await runBuilder('--check');
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('consensus-loop: in sync');
    expect(
      await readFile(
        new URL(
          '../../plugins/consensus/scripts/consensus-loop.mjs',
          import.meta.url,
        ),
        'utf8',
      ),
    ).toBe(before);
  });

  it('lists every generated file and declared installation root', async () => {
    const result = await runBuilder('--list-outputs');
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(generatedOutputRoots);
  });

  it('keeps only the three non-skill runtime mappings', () => {
    expect(generatedOutputs).toEqual([
      {
        id: 'consensus-loop',
        source: 'src/plugins/consensus/core/consensus-loop.ts',
        output: 'plugins/consensus/scripts/consensus-loop.mjs',
        bundle: true,
      },
      {
        id: 'consensus-provider-cli',
        source: 'src/plugins/consensus/provider-cli/cli.ts',
        output: 'plugins/consensus/scripts/consensus.mjs',
        bundle: true,
      },
      {
        id: 'coding-session-handoff-cli',
        source: 'src/tools/coding-session-handoff/cli.ts',
        output: 'tools/coding-session-handoff/coding-session-handoff.mjs',
        bundle: true,
      },
    ]);
  });

  it('derives skill output roots from distribution declarations', () => {
    const declared = distributions.flatMap((distribution) =>
      distribution.targets.map((target) => target.output),
    );
    for (const output of declared)
      expect(generatedOutputRoots).toContain(output);
  });

  it('bundles the shared consensus loop as a dependency-free runtime', async () => {
    const text = await readFile(
      new URL(
        '../../plugins/consensus/scripts/consensus-loop.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    expect(text).toContain(
      '// Source: src/plugins/consensus/core/consensus-loop.ts',
    );
    expect(text).not.toMatch(/from\s+['"]\.\.?\//u);
  });

  it('bundles the consensus provider CLI', async () => {
    const text = await readFile(
      new URL('../../plugins/consensus/scripts/consensus.mjs', import.meta.url),
      'utf8',
    );
    expect(text).toContain(
      '// Source: src/plugins/consensus/provider-cli/cli.ts',
    );
    expect(text).not.toMatch(/from\s+['"]\.\.?\//u);
  });

  it('bundles the repository handoff tool', async () => {
    const text = await readFile(
      new URL(
        '../../tools/coding-session-handoff/coding-session-handoff.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    expect(text).toContain(
      '// Source: src/tools/coding-session-handoff/cli.ts',
    );
    expect(text).not.toMatch(/from\s+['"]\.\.?\//u);
  });

  it('does not retain obsolete leaf runtime mappings', () => {
    expect(generatedOutputs.map((mapping) => mapping.id)).not.toContain(
      'consensus-loop-validation',
    );
    expect(generatedOutputRoots).not.toContain(
      'plugins/consensus/scripts/loop-validation.mjs',
    );
  });

  it('uses the canonical TypeScript generator banner', async () => {
    const text = await readFile(
      new URL(
        '../../plugins/consensus/scripts/consensus-loop.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    expect(text.startsWith(GENERATED_BANNER_PREFIX)).toBe(true);
    expect(text).not.toContain('scripts/build-generated.mjs');
  });

  it('keeps generated skill payloads free of TypeScript sources', async () => {
    const entries = await import('node:fs/promises').then(({ readdir }) =>
      readdir(
        new URL('../../skills/session-observer/scripts', import.meta.url),
        { recursive: true },
      ),
    );
    expect(entries.some((entry) => String(entry).endsWith('.ts'))).toBe(false);
  });

  it('includes complete standalone outputs in generated roots', () => {
    expect(generatedOutputRoots).toContain('skills/consensus-review');
    expect(generatedOutputRoots).toContain('skills/must-we');
    expect(generatedOutputRoots).toContain('skills/next-steps');
    expect(generatedOutputRoots).toContain('skills/session-retro');
    expect(generatedOutputRoots).toContain('skills/session-observer');
    expect(generatedOutputRoots).toContain('skills/session-export-transcript');
    expect(generatedOutputRoots).toContain(
      'skills/session-fork-to-destination',
    );
    expect(generatedOutputRoots).not.toContain(
      'skills/export-session-transcript',
    );
    expect(generatedOutputRoots).not.toContain('skills/coding-session-handoff');
  });

  it('includes complete plugin skill outputs in generated roots', () => {
    expect(generatedOutputRoots).toContain('plugins/consensus/skills/review');
    expect(generatedOutputRoots).toContain('plugins/consensus/skills/refine');
    expect(generatedOutputRoots).toContain('plugins/consensus/skills/create');
    expect(generatedOutputRoots).toContain('plugins/consensus/skills/observer');
    expect(generatedOutputRoots).toContain(
      'plugins/session/skills/export-transcript',
    );
    expect(generatedOutputRoots).toContain(
      'plugins/session/skills/fork-to-destination',
    );
    expect(generatedOutputRoots).toContain('plugins/session/skills/retro');
  });

  it('covers generated roots in static lint and format configs', async () => {
    const [oxfmt, oxlint] = await Promise.all(
      ['.oxfmtrc.json', '.oxlintrc.json'].map(async (file) =>
        JSON.parse(
          await readFile(new URL(`../../${file}`, import.meta.url), 'utf8'),
        ),
      ),
    );
    for (const root of generatedOutputRoots) {
      const expected = root.endsWith('.mjs') ? root : `${root}/**`;
      expect(oxfmt.ignorePatterns).toContain(expected);
      expect(oxlint.ignorePatterns).toContain(expected);
    }
  });

  it('excludes generated roots from lint-staged tasks', () => {
    const task = lintStagedConfig['*.{ts,mts,mjs,js}'];
    for (const root of generatedOutputRoots) {
      const file = root.endsWith('.mjs') ? root : `${root}/scripts/example.mjs`;
      expect(task([file])).toEqual([]);
      expect(task([new URL(file, repoRoot).pathname])).toEqual([]);
    }
  });

  it('includes authored TypeScript in lint-staged tasks', () => {
    const task = lintStagedConfig['*.{ts,mts,mjs,js}'];
    expect(task(['src/example.ts'])).toEqual([
      'oxlint --fix "src/example.ts"',
      'oxfmt --write "src/example.ts"',
    ]);
  });

  it('uses the TypeScript generator in CI selectors', async () => {
    const workflow = await readFile(
      new URL('../../.github/workflows/validate.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain(
      'pnpm tsx scripts/build-generated.ts --list-outputs',
    );
    expect(workflow).not.toContain('scripts/build-generated.mjs');
  });

  it('checks freshness before tests without repairing outputs in CI', async () => {
    const workflow = await readFile(
      new URL('../../.github/workflows/validate.yml', import.meta.url),
      'utf8',
    );
    expect(workflow.indexOf('pnpm run build:check')).toBeLessThan(
      workflow.indexOf('pnpm run test'),
    );
    expect(workflow).not.toContain('- run: pnpm run build\n');
  });

  it('resolves and validates the PR merge base for changed-file gates', async () => {
    const workflow = await readFile(
      new URL('../../.github/workflows/validate.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('git cat-file -e "$BASE_SHA^{commit}"');
    expect(workflow).toContain('git merge-base "$BASE_SHA" "$HEAD_SHA"');
    expect(workflow).toContain('--base-ref "$MERGE_BASE"');
    expect(workflow).toContain('edited');
  });

  it('fails build:check on stale generated output and permits restoration', async () => {
    const target = new URL(
      '../../skills/session-observer/scripts/lib/runtimes.mjs',
      import.meta.url,
    );
    const original = await readFile(target, 'utf8');
    try {
      await writeFile(target, `${original}\n// drift\n`);
      const result = await runBuildCheck();
      expect(result.code).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'skills/session-observer/scripts/lib/runtimes.mjs: stale',
      );
    } finally {
      await writeFile(target, original);
    }
    expect((await runBuildCheck()).code).toBe(0);
  });

  it('fails on an orphan generated runtime before rebuilding', async () => {
    const { root, mappings } = await makeGeneratedFixture();
    try {
      await writeFile(
        path.join(root, 'generated/orphan.mjs'),
        `${GENERATED_BANNER_PREFIX}\nexport {};\n`,
      );
      await expect(
        checkGenerated({ repoRoot: root, mappings, declarations: [] }),
      ).rejects.toThrow(/orphan generated output/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('checks nonempty declared outputs within a custom repository root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'declared-output-'));
    const declarations: readonly DistributionDeclaration[] = [
      {
        owner: 'demo',
        source: 'src/skills/demo',
        targets: [{ kind: 'standalone', name: 'demo', output: 'skills/demo' }],
      },
    ];
    const options = { repoRoot: root, mappings: [], declarations } as const;
    try {
      await mkdir(path.join(root, 'src/skills/demo'), { recursive: true });
      await writeFile(
        path.join(root, 'src/skills/demo/SKILL.md'),
        "---\nname: demo\nmetadata:\n  version: '1.0.0'\n---\n",
      );
      await writeGenerated({ ...options, log: () => {} });
      await expect(checkGenerated(options)).resolves.toBeUndefined();

      await writeFile(path.join(root, 'skills/demo/SKILL.md'), 'stale\n');
      await expect(checkGenerated(options)).rejects.toThrow(
        /skills\/demo\/SKILL\.md: stale/,
      );
      await writeGenerated({ ...options, log: () => {} });

      await rm(path.join(root, 'skills/demo'), { recursive: true });
      await expect(checkGenerated(options)).rejects.toThrow(
        /skills\/demo: missing output/,
      );
      await writeGenerated({ ...options, log: () => {} });

      await writeFile(path.join(root, 'skills/demo/orphan.md'), 'orphan\n');
      await expect(checkGenerated(options)).rejects.toThrow(
        /skills\/demo\/orphan\.md: orphan/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('removes orphan generated runtimes during an explicit build', async () => {
    const { root, mappings } = await makeGeneratedFixture();
    try {
      const orphan = path.join(root, 'generated/orphan.mjs');
      await writeFile(orphan, `${GENERATED_BANNER_PREFIX}\nexport {};\n`);
      await writeGenerated({
        repoRoot: root,
        mappings,
        declarations: [],
        log: () => {},
      });
      await expect(readFile(orphan, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rewrites only emitted module specifiers', () => {
    const rewritten = rewriteImportSpecifiers(
      [
        'import { value } from "./old.js";',
        'const diagnostic = "./old.js";',
      ].join('\n'),
      { from: './old.js', to: './new.mjs' },
      'fixture',
    );
    expect(rewritten).toContain("from './new.mjs'");
    expect(rewritten).toContain('const diagnostic = "./old.js";');
  });
});
