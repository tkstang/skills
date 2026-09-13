import { execFile } from 'node:child_process';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import type { DistributionDeclaration } from '../../scripts/lib/packaging.js';
import {
  buildDeclaredDistributions,
  checkDeclaredDistributions,
  cleanupBuiltDistributions,
  compareInventories,
  inventoryTree,
  replaceDeclaredDistribution,
  validateDistributionDeclarations,
  writeDeclaredDistributions,
} from '../../scripts/lib/packaging.js';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const fixtureRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'skill-packaging-test-'));
  fixtureRoots.push(root);
  return root;
}

async function write(
  root: string,
  relative: string,
  value: string,
): Promise<void> {
  const output = path.join(root, relative);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, value);
}

function target(
  owner: string,
  overrides: Partial<DistributionDeclaration> = {},
): DistributionDeclaration {
  return {
    owner,
    source: `src/skills/${owner}`,
    targets: [
      {
        kind: 'standalone',
        name: owner,
        output: `skills/${owner}`,
      },
    ],
    ...overrides,
  };
}

async function promptSkill(root: string, owner: string): Promise<void> {
  await write(
    root,
    `src/skills/${owner}/SKILL.md`,
    `---\nname: ${owner}\nmetadata:\n  version: '1.0.0'\n---\n\n# {{distribution.name}}\n`,
  );
}

async function copyIfPresent(
  source: string,
  destination: string,
): Promise<void> {
  try {
    await stat(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function copySkillResources(
  source: string,
  destination: string,
): Promise<void> {
  for (const name of [
    'SKILL.md',
    'agents',
    'assets',
    'references',
    'schemas',
  ]) {
    await copyIfPresent(path.join(source, name), path.join(destination, name));
  }
}

function codexTranscript(sessionId: string, cwd: string): string {
  return [
    {
      type: 'session_started',
      sessionId,
      cwd,
      timestamp: '2026-09-13T12:00:00Z',
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'user',
        content: 'Synthetic installed-boundary request.',
      },
    },
    {
      type: 'response_item',
      sessionId,
      payload: {
        type: 'message',
        role: 'assistant',
        content: 'Synthetic installed-boundary response.',
      },
    },
  ]
    .map((record) => JSON.stringify(record))
    .join('\n')
    .concat('\n');
}

describe('declared skill packaging', () => {
  it('renders prompt-only standalone and plugin names without build machinery', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'example');
    await write(root, 'src/skills/example/references/guide.md', '# Guide\n');
    const declarations: DistributionDeclaration[] = [
      target('example', {
        targets: [
          { kind: 'standalone', name: 'example', output: 'skills/example' },
          {
            kind: 'plugin',
            plugin: 'demo',
            name: 'short-example',
            output: 'plugins/demo/skills/short-example',
          },
        ],
      }),
    ];

    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations,
    });
    expect(built).toHaveLength(2);
    expect(
      await readFile(path.join(built[1].stagedPath, 'SKILL.md'), 'utf8'),
    ).toContain('name: short-example');
    expect(built[0].inventory.map((entry) => entry.path)).toEqual([
      'SKILL.md',
      'references/guide.md',
    ]);
  });

  it('bundles shared TypeScript into an executable installed unit', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'runner');
    await write(
      root,
      'src/skills/runner/build.json',
      '{"runtime":["src/main.ts"]}\n',
    );
    await write(
      root,
      'src/skills/runner/src/main.ts',
      "#!/usr/bin/env node\nimport { value } from '../../../shared/value.js';\nprocess.stdout.write(value);\n",
    );
    await write(
      root,
      'src/shared/value.ts',
      "export const value = 'installed';\n",
    );
    const declarations = [
      target('runner', { allowedSourceRoots: ['src/shared'] }),
    ];

    const [unit] = await buildDeclaredDistributions({
      repoRoot: root,
      declarations,
    });
    const installed = path.join(unit.stagedPath, 'scripts/main.mjs');
    const result = await execFileAsync(process.execPath, [installed], {
      cwd: os.tmpdir(),
      env: { PATH: process.env.PATH ?? '' },
    });

    expect(result.stdout).toBe('installed');
    expect((await stat(installed)).mode & 0o777).toBe(0o755);
    expect(await readFile(installed, 'utf8')).not.toMatch(
      /from\s+['"](?:\.\.?\/|\/).*src\/shared/,
    );
  });

  it('renders required skill names for the same plugin and standalone fallback', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'observer');
    await write(
      root,
      'src/skills/collab/SKILL.md',
      "---\nname: collab\nmetadata:\n  version: '1.0.0'\n---\n\nRequires {{skill:observer}}.\n",
    );
    const dependency = target('observer', {
      targets: [
        {
          kind: 'standalone',
          name: 'session-observer',
          output: 'skills/session-observer',
        },
        {
          kind: 'plugin',
          plugin: 'consensus',
          name: 'observer',
          output: 'plugins/consensus/skills/observer',
        },
      ],
    });
    const dependent = target('collab', {
      targets: [
        {
          kind: 'standalone',
          name: 'session-observer-collab',
          output: 'skills/session-observer-collab',
        },
        {
          kind: 'plugin',
          plugin: 'consensus',
          name: 'observer-collab',
          output: 'plugins/consensus/skills/observer-collab',
        },
      ],
      requiredSkills: [
        { name: 'observer', installUrl: 'https://example.test/install' },
      ],
    });

    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [dependency, dependent],
    });
    const standalone = built.find(
      (unit) => unit.target.name === 'session-observer-collab',
    );
    const plugin = built.find((unit) => unit.target.name === 'observer-collab');
    expect(
      await readFile(path.join(standalone!.stagedPath, 'SKILL.md'), 'utf8'),
    ).toContain('Requires session-observer.');
    expect(
      await readFile(path.join(plugin!.stagedPath, 'SKILL.md'), 'utf8'),
    ).toContain('Requires observer.');
  });

  it.each([
    [
      'duplicate output',
      [target('a'), target('b', { targets: target('a').targets })],
    ],
    ['escaping source', [target('a', { source: '../a' })]],
    [
      'missing dependency',
      [
        target('a', {
          requiredSkills: [
            { name: 'missing', installUrl: 'https://example.test/install' },
          ],
        }),
      ],
    ],
    [
      'required cycle',
      [
        target('a', {
          requiredSkills: [{ name: 'b', installUrl: 'https://example.test/b' }],
        }),
        target('b', {
          requiredSkills: [{ name: 'a', installUrl: 'https://example.test/a' }],
        }),
      ],
    ],
  ])('rejects invalid declarations: %s', (_name, declarations) => {
    expect(() => validateDistributionDeclarations(declarations)).toThrow();
  });

  it.each([
    [
      'runtime package dependency',
      "import leftPad from 'left-pad';\nconsole.log(leftPad);\n",
    ],
    ['source escape', "import '../../../outside.js';\n"],
  ])('rejects %s', async (_name, source) => {
    const root = await fixtureRoot();
    await promptSkill(root, 'runner');
    await write(
      root,
      'src/skills/runner/build.json',
      '{"runtime":["src/main.ts"]}\n',
    );
    await write(root, 'src/skills/runner/src/main.ts', source);
    await write(root, 'src/outside.ts', 'export {};\n');
    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('runner')],
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['test entrypoint', '{"runtime":["src/main.test.ts"]}\n'],
    ['declaration entrypoint', '{"runtime":["src/main.d.ts"]}\n'],
    ['absolute entrypoint', '{"runtime":["/tmp/main.ts"]}\n'],
    [
      'duplicate output basename',
      '{"runtime":["src/one/main.ts","src/two/main.ts"]}\n',
    ],
  ])('rejects invalid build manifests: %s', async (_name, manifest) => {
    const root = await fixtureRoot();
    await promptSkill(root, 'runner');
    await write(root, 'src/skills/runner/build.json', manifest);
    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('runner')],
      }),
    ).rejects.toThrow();
  });

  it('rejects executable source outside the declared runtime closure', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'runner');
    await write(
      root,
      'src/skills/runner/build.json',
      '{"runtime":["src/main.ts"]}\n',
    );
    await write(
      root,
      'src/skills/runner/src/main.ts',
      'process.stdout.write("ok");\n',
    );
    await write(
      root,
      'src/skills/runner/src/unused.ts',
      'export const unused = true;\n',
    );
    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('runner')],
      }),
    ).rejects.toThrow('outside runtime closure');
  });

  it('rejects symlinks and missing installed resources', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'linked');
    await write(
      root,
      'src/skills/linked/SKILL.md',
      "---\nname: linked\nmetadata:\n  version: '1.0.0'\n---\n\n[missing](references/missing.md)\n",
    );
    await symlink(
      path.join(root, 'src/skills/linked/SKILL.md'),
      path.join(root, 'src/skills/linked/link.md'),
    );
    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('linked')],
      }),
    ).rejects.toThrow('symlinks are unsupported');
  });

  it('rejects broken installed resource links', async () => {
    const root = await fixtureRoot();
    await write(
      root,
      'src/skills/linked/SKILL.md',
      "---\nname: linked\nmetadata:\n  version: '1.0.0'\n---\n\n[missing](references/missing.md)\n",
    );
    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('linked')],
      }),
    ).rejects.toThrow('resource link is missing');
  });

  it('rejects authored scripts that collide with generated runtime', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'scripted');
    await write(
      root,
      'src/skills/scripted/scripts/manual.mjs',
      'process.stdout.write("manual");\n',
    );
    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('scripted')],
      }),
    ).rejects.toThrow('authored scripts collide');
  });

  it('reports stale, missing, orphaned, and mode-drifted outputs without repair', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'checked');
    const [unit] = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('checked')],
    });
    await mkdir(path.join(root, 'skills/checked'), { recursive: true });
    await write(root, 'skills/checked/SKILL.md', 'stale');
    await write(root, 'skills/checked/orphan.md', 'orphan');
    await chmod(path.join(root, 'skills/checked/SKILL.md'), 0o755);
    const failures = await checkDeclaredDistributions({
      repoRoot: root,
      built: [unit],
    });

    expect(failures).toEqual([
      'skills/checked/SKILL.md: stale',
      'skills/checked/orphan.md: orphan',
    ]);
    expect(
      await readFile(path.join(root, 'skills/checked/SKILL.md'), 'utf8'),
    ).toBe('stale');
  });

  it('reports an entirely missing generated unit without creating it', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'missing');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('missing')],
    });
    await expect(
      checkDeclaredDistributions({ repoRoot: root, built }),
    ).resolves.toEqual(['skills/missing: missing output']);
    await expect(stat(path.join(root, 'skills/missing'))).rejects.toMatchObject(
      {
        code: 'ENOENT',
      },
    );
    await cleanupBuiltDistributions(built);
  });

  it('compares executable modes independently from content', () => {
    const hash = 'same';
    expect(
      compareInventories(
        [{ path: 'scripts/main.mjs', mode: 0o644, hash }],
        [{ path: 'scripts/main.mjs', mode: 0o755, hash }],
      ),
    ).toEqual(['scripts/main.mjs: mode 644 != 755']);
  });

  it('replaces only the owned tree and restores it on replacement failure', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'safe');
    const [unit] = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('safe')],
    });
    await write(root, 'skills/safe/prior.md', 'prior');
    let calls = 0;
    await expect(
      replaceDeclaredDistribution(root, unit, {
        rename: async (from, to) => {
          calls += 1;
          if (calls === 2) throw new Error('controlled replacement failure');
          await import('node:fs/promises').then((fs) => fs.rename(from, to));
        },
        remove: async (...args) =>
          import('node:fs/promises').then((fs) => fs.rm(...args)),
      }),
    ).rejects.toThrow('prior output restored');
    expect(
      await readFile(path.join(root, 'skills/safe/prior.md'), 'utf8'),
    ).toBe('prior');
  });

  it('writes all staged units only after every declaration builds', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'one');
    await promptSkill(root, 'two');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('one'), target('two')],
    });
    await writeDeclaredDistributions({ repoRoot: root, built });
    expect(
      compareInventories(
        await inventoryTree(path.join(root, 'skills/one')),
        built[0].inventory,
      ),
    ).toEqual([]);
    expect(
      compareInventories(
        await inventoryTree(path.join(root, 'skills/two')),
        built[1].inventory,
      ),
    ).toEqual([]);
    await cleanupBuiltDistributions(built);
  });
});

describe('representative real installation boundaries', () => {
  it('packages and executes prompt-only, shared-runtime, standalone-consensus, and complete-plugin units outside the checkout', async () => {
    const root = await fixtureRoot();
    const home = path.join(root, 'home');
    const outside = path.join(root, 'outside');
    const bin = path.join(root, 'bin');
    await Promise.all([
      mkdir(home, { recursive: true }),
      mkdir(outside, { recursive: true }),
      mkdir(bin, { recursive: true }),
    ]);

    await copySkillResources(
      path.join(repositoryRoot, 'skills/complexity-review'),
      path.join(root, 'src/skills/complexity-review'),
    );

    await copySkillResources(
      path.join(repositoryRoot, 'skills/export-session-transcript'),
      path.join(root, 'src/skills/session-export-transcript'),
    );
    await copyIfPresent(
      path.join(repositoryRoot, 'src/transcript'),
      path.join(root, 'src/transcript'),
    );
    await write(
      root,
      'src/skills/session-export-transcript/build.json',
      '{"runtime":["src/session-export-transcript.ts"]}\n',
    );
    await write(
      root,
      'src/skills/session-export-transcript/src/session-export-transcript.ts',
      "import '../../../transcript/export-session/export-session-transcript.js';\n",
    );

    await copyIfPresent(
      path.join(repositoryRoot, 'src/consensus'),
      path.join(root, 'src/consensus'),
    );
    const consensusSkills = (
      await readdir(path.join(repositoryRoot, 'plugins/consensus/skills'), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    for (const skill of consensusSkills) {
      await copySkillResources(
        path.join(repositoryRoot, 'plugins/consensus/skills', skill),
        path.join(root, 'src/skills', skill),
      );
    }
    await write(
      root,
      'src/skills/create/build.json',
      '{"runtime":["src/consensus-create.ts","src/consensus.ts"]}\n',
    );
    await write(
      root,
      'src/skills/create/src/consensus-create.ts',
      "import { runCreateCli } from '../../../consensus/create/consensus-create.js';\nprocess.exitCode = await runCreateCli(process.argv.slice(2));\n",
    );
    await write(
      root,
      'src/skills/create/src/consensus.ts',
      "import { readFile } from 'node:fs/promises';\nimport { runConsensusCli } from '../../../consensus/provider-cli/commands.js';\nconst io = { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin, cwd: process.cwd(), env: process.env, readFile: (filePath: string) => readFile(filePath, 'utf8'), readStdin: async () => '' };\nprocess.exitCode = await runConsensusCli(process.argv.slice(2), io);\n",
    );

    const declarations: DistributionDeclaration[] = [
      target('complexity-review'),
      target('session-export-transcript', {
        allowedSourceRoots: ['src/transcript'],
      }),
      ...consensusSkills.map((skill) =>
        target(skill, {
          allowedSourceRoots: skill === 'create' ? ['src/consensus'] : [],
          targets: [
            ...(skill === 'create'
              ? [
                  {
                    kind: 'standalone' as const,
                    name: 'consensus-create',
                    output: 'skills/consensus-create',
                  },
                ]
              : []),
            {
              kind: 'plugin' as const,
              plugin: 'consensus',
              name: skill,
              output: `plugins/consensus/skills/${skill}`,
            },
          ],
        }),
      ),
    ];
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations,
    });
    await writeDeclaredDistributions({ repoRoot: root, built });

    const complexityFiles = await inventoryTree(
      path.join(root, 'skills/complexity-review'),
    );
    expect(complexityFiles.map((entry) => entry.path)).toEqual(['SKILL.md']);

    const exportSessionId = 'installed-export';
    const exportCwd = '/synthetic/project';
    await write(
      home,
      `.codex/sessions/2026/09/13/session-${exportSessionId}.jsonl`,
      codexTranscript(exportSessionId, exportCwd),
    );
    const exportOutput = path.join(outside, 'export.md');
    const exportRuntime = path.join(
      root,
      'skills/session-export-transcript/scripts/session-export-transcript.mjs',
    );
    const exported = await execFileAsync(
      process.execPath,
      [
        exportRuntime,
        '--runtime',
        'codex',
        '--cwd',
        exportCwd,
        '--session',
        exportSessionId,
        '--out',
        exportOutput,
      ],
      { cwd: outside, env: { HOME: home, PATH: process.env.PATH ?? '' } },
    );
    expect(exported.stderr).toBe('');
    expect(await readFile(exportOutput, 'utf8')).toContain(
      'Synthetic installed-boundary response.',
    );

    await write(root, 'bin/codex', '#!/bin/sh\nprintf "codex 9.9.9\\n"\n');
    await chmod(path.join(bin, 'codex'), 0o755);
    const isolatedEnv = { HOME: home, PATH: bin };
    const standaloneCreate = path.join(
      root,
      'skills/consensus-create/scripts/consensus-create.mjs',
    );
    const standaloneCli = path.join(
      root,
      'skills/consensus-create/scripts/consensus.mjs',
    );
    await expect(
      execFileAsync(process.execPath, [standaloneCreate], {
        cwd: outside,
        env: isolatedEnv,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'consensus-create requires --brief or --brief-file',
      ),
    });
    const standaloneInventory = JSON.parse(
      (
        await execFileAsync(
          process.execPath,
          [standaloneCli, 'provider', 'ls', '--json'],
          { cwd: outside, env: isolatedEnv },
        )
      ).stdout,
    ) as { providers: Array<{ id: string; status: string }> };
    expect(
      standaloneInventory.providers.find((provider) => provider.id === 'codex'),
    ).toMatchObject({
      id: 'codex',
      status: 'ready',
      executable: path.join(bin, 'codex'),
      version: 'codex 9.9.9',
    });

    for (const name of [
      '.claude-plugin',
      '.cursor-plugin',
      '.codex-plugin',
      'agents',
      'references',
      'scripts',
      'README.md',
    ]) {
      await copyIfPresent(
        path.join(repositoryRoot, 'plugins/consensus', name),
        path.join(root, 'plugins/consensus', name),
      );
    }
    const installedPluginSkills = (
      await readdir(path.join(root, 'plugins/consensus/skills'), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    expect(installedPluginSkills).toEqual(consensusSkills);
    const pluginInventory = JSON.parse(
      (
        await execFileAsync(
          process.execPath,
          [
            await realpath(
              path.join(root, 'plugins/consensus/scripts/consensus.mjs'),
            ),
            'provider',
            'ls',
            '--json',
          ],
          { cwd: outside, env: isolatedEnv },
        )
      ).stdout,
    ) as { providers: Array<{ id: string; status: string }> };
    expect(
      pluginInventory.providers.find((provider) => provider.id === 'codex'),
    ).toMatchObject({ status: 'ready' });

    for (const unit of built) {
      for (const entry of unit.inventory) {
        expect(entry.path).not.toMatch(
          /(?:^|\/)(?:src|tests?|build\.json)(?:\/|$)/,
        );
      }
    }
    for (const runtime of [exportRuntime, standaloneCreate, standaloneCli]) {
      expect(await readFile(runtime, 'utf8')).not.toMatch(
        /from\s+['"](?:\.\.\/){2,}/,
      );
    }

    await cleanupBuiltDistributions(built);
    await rm(root, { recursive: true, force: true });
  });
});
