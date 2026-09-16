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
import { distributions } from '../../src/distributions.js';

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

function documentedObserverPreflight(
  instruction: string,
  installedIdentities: readonly string[],
): 'continue' | 'stop' {
  const identityLine = instruction.match(
    /documented observer identity:\s*\n([^\n]+)/,
  )?.[1];
  if (!identityLine) throw new Error('observer identity set is missing');
  const accepted = [...identityLine.matchAll(/`([^`]+)`/g)].map(
    (match) => match[1],
  );
  return installedIdentities.some((identity) => accepted.includes(identity))
    ? 'continue'
    : 'stop';
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

  it('rejects standalone outputs outside the installed skill directory', () => {
    expect(() =>
      validateDistributionDeclarations([
        target('example', {
          targets: [
            { kind: 'standalone', name: 'example', output: 'package.json' },
          ],
        }),
      ]),
    ).toThrow('standalone target example must own skills/example');
  });

  it('rejects plugin identifiers that are not one safe path segment', () => {
    expect(() =>
      validateDistributionDeclarations([
        target('example', {
          targets: [
            {
              kind: 'plugin',
              name: 'example',
              plugin: '../../escape',
              output: 'plugins/../../escape/skills/example',
            },
          ],
        }),
      ]),
    ).toThrow('plugin identifier is invalid');
  });

  it('rejects non-escaping traversal segments before normalization', () => {
    expect(() =>
      validateDistributionDeclarations([
        target('example', { source: 'src/skills/one/../example' }),
      ]),
    ).toThrow('contains a traversal segment');
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

  it('preserves runtime subdirectories under the generated scripts tree', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'runner');
    await write(
      root,
      'src/skills/runner/build.json',
      '{"runtime":["src/hooks/stop.ts","src/lib/stop.ts"]}\n',
    );
    await write(root, 'src/skills/runner/src/hooks/stop.ts', 'export {};\n');
    await write(root, 'src/skills/runner/src/lib/stop.ts', 'export {};\n');

    const [unit] = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('runner')],
    });

    expect(unit.inventory.map((entry) => entry.path)).toContain(
      'scripts/hooks/stop.mjs',
    );
    expect(unit.inventory.map((entry) => entry.path)).toContain(
      'scripts/lib/stop.mjs',
    );
  });

  it('includes every allowed shared source root in the input fingerprint', async () => {
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
      "import { value } from '../../../shared/value.js';\nprocess.stdout.write(value);\n",
    );
    await write(root, 'src/shared/value.ts', "export const value = 'one';\n");
    const declarations = [
      target('runner', { allowedSourceRoots: ['src/shared'] }),
    ];

    const first = await buildDeclaredDistributions({
      repoRoot: root,
      declarations,
    });
    await write(root, 'src/shared/value.ts', "export const value = 'two';\n");
    const second = await buildDeclaredDistributions({
      repoRoot: root,
      declarations,
    });

    expect(second[0].inputFingerprint).not.toBe(first[0].inputFingerprint);
    await cleanupBuiltDistributions(first);
    await cleanupBuiltDistributions(second);
  });

  it('renders required skill names for the same plugin and standalone fallback', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'observer');
    await write(
      root,
      'src/skills/collab/SKILL.md',
      "---\nname: collab\nmetadata:\n  version: '1.0.0'\n---\n\nPrefer {{skill:observer}}. Accept {{skill-identities:observer}}. Stop only when none is present.\n",
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
    ).toContain(
      'Prefer session-observer. Accept `session-observer` or `observer` or `consensus:observer`. Stop only when none is present.',
    );
    expect(
      await readFile(path.join(plugin!.stagedPath, 'SKILL.md'), 'utf8'),
    ).toContain(
      'Prefer observer. Accept `observer` or `consensus:observer` or `session-observer`. Stop only when none is present.',
    );
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
    ['unpaired MJS entrypoint', '{"runtime":["src/main.mjs"]}\n'],
    ['absolute entrypoint', '{"runtime":["/tmp/main.ts"]}\n'],
    ['duplicate output', '{"runtime":["src/main.ts","src/main.ts"]}\n'],
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

  it('permits type-only modules erased from the installed runtime', async () => {
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
      'src/skills/runner/src/types.ts',
      'export interface RuntimeContract { ok: true }\n',
    );

    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('runner')],
      }),
    ).resolves.toHaveLength(1);
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

  it('rejects a declared source root that is a symlink', async () => {
    const root = await fixtureRoot();
    const external = await fixtureRoot();
    await promptSkill(external, 'linked');
    await mkdir(path.join(root, 'src/skills'), { recursive: true });
    await symlink(
      path.join(external, 'src/skills/linked'),
      path.join(root, 'src/skills/linked'),
    );

    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('linked')],
      }),
    ).rejects.toThrow('source for linked has a symlinked segment');
  });

  it('rejects an allowed source root that is a symlink', async () => {
    const root = await fixtureRoot();
    const external = await fixtureRoot();
    await promptSkill(root, 'linked');
    await write(external, 'shared/value.ts', 'export const value = true;\n');
    await mkdir(path.join(root, 'src'), { recursive: true });
    await symlink(path.join(external, 'shared'), path.join(root, 'src/shared'));

    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [
          target('linked', { allowedSourceRoots: ['src/shared'] }),
        ],
      }),
    ).rejects.toThrow('allowed source root has a symlinked segment');
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

  it('rejects a direct declared-output symlink during freshness checks', async () => {
    const root = await fixtureRoot();
    const external = await fixtureRoot();
    await promptSkill(root, 'linked-output');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('linked-output')],
    });
    const externalPayload = path.join(external, 'payload');
    await cp(built[0].stagedPath, externalPayload, { recursive: true });
    const before = await inventoryTree(externalPayload);
    await mkdir(path.join(root, 'skills'), { recursive: true });
    await symlink(externalPayload, path.join(root, 'skills/linked-output'));

    const failures = await checkDeclaredDistributions({
      repoRoot: root,
      built,
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('symlinked segment');
    expect(await inventoryTree(externalPayload)).toEqual(before);
    await cleanupBuiltDistributions(built);
  });

  it('rejects a symlinked declared-output ancestor during freshness checks', async () => {
    const root = await fixtureRoot();
    const external = await fixtureRoot();
    await promptSkill(root, 'linked-ancestor');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('linked-ancestor')],
    });
    const externalPayload = path.join(external, 'linked-ancestor');
    await cp(built[0].stagedPath, externalPayload, { recursive: true });
    const before = await inventoryTree(externalPayload);
    await symlink(external, path.join(root, 'skills'));

    const failures = await checkDeclaredDistributions({
      repoRoot: root,
      built,
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('symlinked segment');
    expect(await inventoryTree(externalPayload)).toEqual(before);
    await cleanupBuiltDistributions(built);
  });

  it('rejects a source-root ancestor symlink', async () => {
    const root = await fixtureRoot();
    await write(
      root,
      'authored/skills/linked-source/SKILL.md',
      "---\nname: linked-source\nmetadata:\n  version: '1.0.0'\n---\n",
    );
    await symlink(path.join(root, 'authored'), path.join(root, 'src'));

    await expect(
      buildDeclaredDistributions({
        repoRoot: root,
        declarations: [target('linked-source')],
      }),
    ).rejects.toThrow('source for linked-source has a symlinked segment: src');
  });

  it.each([
    {
      name: 'standalone',
      declaration: target('escaped'),
      link: 'skills',
      externalOutput: 'escaped',
    },
    {
      name: 'plugin',
      declaration: target('escaped', {
        targets: [
          {
            kind: 'plugin',
            plugin: 'demo',
            name: 'escaped',
            output: 'plugins/demo/skills/escaped',
          },
        ],
      }),
      link: 'plugins/demo',
      externalOutput: 'skills/escaped',
    },
  ])('rejects a symlinked $name output ancestor', async (fixture) => {
    const root = await fixtureRoot();
    const external = await fixtureRoot();
    await promptSkill(root, 'escaped');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [fixture.declaration],
    });
    await mkdir(path.dirname(path.join(root, fixture.link)), {
      recursive: true,
    });
    await symlink(external, path.join(root, fixture.link));

    await expect(
      writeDeclaredDistributions({ repoRoot: root, built }),
    ).rejects.toThrow('symlinked ancestor');
    await expect(
      stat(path.join(external, fixture.externalOutput)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await cleanupBuiltDistributions(built);
  });

  it('rejects staged inventory drift before moving any output', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'stable');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('stable')],
    });
    await write(root, 'skills/stable/prior.md', 'prior');
    await writeFile(path.join(built[0].stagedPath, 'SKILL.md'), 'changed');

    await expect(
      writeDeclaredDistributions({ repoRoot: root, built }),
    ).rejects.toThrow('staged inventory drift');
    expect(
      await readFile(path.join(root, 'skills/stable/prior.md'), 'utf8'),
    ).toBe('prior');
    expect(
      (await readdir(path.join(root, 'skills'))).some((name) =>
        name.includes('.recovery-'),
      ),
    ).toBe(false);
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
    ).rejects.toThrow('all prior outputs restored');
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

  it('removes superseded outputs in the same atomic replacement', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'renamed');
    const [unit] = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('renamed')],
    });
    await write(root, 'skills/old-name/SKILL.md', 'legacy\n');

    await writeDeclaredDistributions({
      repoRoot: root,
      built: [unit],
      obsoleteOutputs: ['skills/old-name'],
    });

    await expect(
      stat(path.join(root, 'skills/old-name')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await stat(path.join(root, 'skills/renamed'))).toBeTruthy();
    await cleanupBuiltDistributions([unit]);
  });

  it('restores every prior unit when a later staged installation fails', async () => {
    const root = await fixtureRoot();
    await promptSkill(root, 'one');
    await promptSkill(root, 'two');
    const built = await buildDeclaredDistributions({
      repoRoot: root,
      declarations: [target('one'), target('two')],
    });
    await write(root, 'skills/one/prior.md', 'prior one');
    await write(root, 'skills/two/prior.md', 'prior two');
    const priorOne = await inventoryTree(path.join(root, 'skills/one'));
    const priorTwo = await inventoryTree(path.join(root, 'skills/two'));
    let renameCalls = 0;

    await expect(
      writeDeclaredDistributions({
        repoRoot: root,
        built,
        operations: {
          rename: async (from, to) => {
            renameCalls += 1;
            if (renameCalls === 4)
              throw new Error('controlled second installation failure');
            await import('node:fs/promises').then((fs) => fs.rename(from, to));
          },
          remove: async (...args) =>
            import('node:fs/promises').then((fs) => fs.rm(...args)),
        },
      }),
    ).rejects.toThrow('all prior outputs restored');

    expect(await inventoryTree(path.join(root, 'skills/one'))).toEqual(
      priorOne,
    );
    expect(await inventoryTree(path.join(root, 'skills/two'))).toEqual(
      priorTwo,
    );
    expect(
      (await readdir(path.join(root, 'skills'))).some((name) =>
        name.includes('.recovery-'),
      ),
    ).toBe(false);
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
      path.join(repositoryRoot, 'src/skills/complexity-review'),
      path.join(root, 'src/skills/complexity-review'),
    );
    for (const skill of ['must-we', 'next-steps', 'session-retro']) {
      await copySkillResources(
        path.join(repositoryRoot, 'src/skills', skill),
        path.join(root, 'src/skills', skill),
      );
    }

    await copyIfPresent(
      path.join(repositoryRoot, 'src/skills/session-export-transcript'),
      path.join(root, 'src/skills/session-export-transcript'),
    );
    await copyIfPresent(
      path.join(repositoryRoot, 'src/skills/session-handoff'),
      path.join(root, 'src/skills/session-handoff'),
    );
    await copyIfPresent(
      path.join(repositoryRoot, 'src/shared/transcript'),
      path.join(root, 'src/shared/transcript'),
    );

    await copyIfPresent(
      path.join(repositoryRoot, 'src/plugins/consensus'),
      path.join(root, 'src/plugins/consensus'),
    );
    const consensusDeclarations = distributions.filter((declaration) =>
      declaration.targets.some(
        (distributionTarget) =>
          distributionTarget.kind === 'plugin' &&
          distributionTarget.plugin === 'consensus',
      ),
    );
    const consensusSkills = consensusDeclarations
      .flatMap((declaration) =>
        declaration.targets
          .filter(
            (distributionTarget) =>
              distributionTarget.kind === 'plugin' &&
              distributionTarget.plugin === 'consensus',
          )
          .map((distributionTarget) => distributionTarget.name),
      )
      .toSorted();
    for (const declaration of consensusDeclarations) {
      const skill = declaration.owner;
      await copySkillResources(
        path.join(repositoryRoot, 'src/skills', skill),
        path.join(root, 'src/skills', skill),
      );
      await copyIfPresent(
        path.join(repositoryRoot, 'src/skills', skill, 'build.json'),
        path.join(root, 'src/skills', skill, 'build.json'),
      );
      await copyIfPresent(
        path.join(repositoryRoot, 'src/skills', skill, 'src'),
        path.join(root, 'src/skills', skill, 'src'),
      );
    }
    await write(
      root,
      'src/skills/create/build.json',
      '{"runtime":["src/consensus-create-cli.ts","src/consensus.ts"]}\n',
    );
    await write(
      root,
      'src/skills/create/src/consensus-create-cli.ts',
      "import { runCreateCli } from './consensus-create.js';\nprocess.exitCode = await runCreateCli(process.argv.slice(2));\n",
    );
    await write(
      root,
      'src/skills/create/src/consensus.ts',
      "import { readFile } from 'node:fs/promises';\nimport { runConsensusCli } from '../../../plugins/consensus/provider-cli/commands.js';\nconst io = { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin, cwd: process.cwd(), env: process.env, readFile: (filePath: string) => readFile(filePath, 'utf8'), readStdin: async () => '' };\nprocess.exitCode = await runConsensusCli(process.argv.slice(2), io);\n",
    );

    const declarations: DistributionDeclaration[] = [
      target('complexity-review'),
      distributions.find((declaration) => declaration.owner === 'must-we')!,
      target('next-steps'),
      target('session-export-transcript', {
        allowedSourceRoots: ['src/shared/transcript'],
        targets: [
          {
            kind: 'standalone',
            name: 'session-export-transcript',
            output: 'skills/session-export-transcript',
          },
          {
            kind: 'plugin',
            plugin: 'session',
            name: 'export-transcript',
            output: 'plugins/session/skills/export-transcript',
          },
        ],
      }),
      distributions.find(
        (declaration) => declaration.owner === 'session-handoff',
      )!,
      distributions.find(
        (declaration) => declaration.owner === 'session-retro',
      )!,
      ...consensusDeclarations.map((declaration) =>
        target(declaration.owner, {
          allowedSourceRoots: declaration.allowedSourceRoots,
          requiredSkills: declaration.requiredSkills,
          targets: [
            ...(declaration.owner === 'create'
              ? [
                  {
                    kind: 'standalone' as const,
                    name: 'consensus-create',
                    output: 'skills/consensus-create',
                  },
                ]
              : []),
            ...declaration.targets,
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
    expect(complexityFiles.map((entry) => entry.path)).toEqual([
      'SKILL.md',
      'references/evidence-guide.md',
    ]);

    for (const installedSkill of ['skills/must-we', 'skills/next-steps']) {
      expect(
        (await inventoryTree(path.join(root, installedSkill))).map(
          (entry) => entry.path,
        ),
      ).toEqual(['SKILL.md']);
    }

    for (const [installedRetro, expectedName] of [
      ['skills/session-retro', 'session-retro'],
      ['plugins/session/skills/retro', 'retro'],
    ] as const) {
      const retroFiles = await inventoryTree(path.join(root, installedRetro));
      expect(retroFiles.map((entry) => entry.path)).toEqual([
        'SKILL.md',
        'assets/report-template.md',
      ]);
      const retroInstruction = await readFile(
        path.join(root, installedRetro, 'SKILL.md'),
        'utf8',
      );
      expect(retroInstruction).toMatch(
        new RegExp(`^name: ${expectedName}$`, 'm'),
      );
      expect(retroInstruction).toContain(
        'An optional transcript reader such as `session-observer`',
      );
      expect(retroInstruction).not.toContain('{{');
    }

    for (const installedHandoff of [
      'skills/session-handoff',
      'plugins/session/skills/handoff',
    ]) {
      const handoffFiles = await inventoryTree(
        path.join(root, installedHandoff),
      );
      expect(handoffFiles.map((entry) => entry.path)).toEqual([
        'SKILL.md',
        'assets/handoff-template.md',
      ]);
      expect(handoffFiles.some((entry) => entry.path.endsWith('.mjs'))).toBe(
        false,
      );
      const handoffInstruction = await readFile(
        path.join(root, installedHandoff, 'SKILL.md'),
        'utf8',
      );
      expect(handoffInstruction).toContain('integrations are optional');
      expect(handoffInstruction).toContain(
        'If one is absent, continue the core handoff',
      );
    }

    const standaloneCollabInstruction = await readFile(
      path.join(root, 'skills/session-observer-collab/SKILL.md'),
      'utf8',
    );
    expect(standaloneCollabInstruction).toContain(
      'effective skill inventory for any documented observer identity',
    );
    expect(standaloneCollabInstruction).toContain(
      '`session-observer` or `observer` or `consensus:observer`',
    );
    expect(standaloneCollabInstruction).toContain(
      'https://github.com/tkstang/skills/tree/main/skills/session-observer',
    );
    expect(standaloneCollabInstruction).toContain(
      'Do not fetch the URL, install the skill, or continue',
    );

    const pluginCollabInstruction = await readFile(
      path.join(root, 'plugins/consensus/skills/observer-collab/SKILL.md'),
      'utf8',
    );
    expect(pluginCollabInstruction).toContain(
      'effective skill inventory for any documented observer identity',
    );
    expect(pluginCollabInstruction).toContain(
      '`observer` or `consensus:observer` or `session-observer`',
    );
    expect(pluginCollabInstruction).toContain(
      'required canonical skill is `session-observer`',
    );
    expect(
      documentedObserverPreflight(standaloneCollabInstruction, ['observer']),
    ).toBe('continue');
    expect(
      documentedObserverPreflight(pluginCollabInstruction, [
        'session-observer',
      ]),
    ).toBe('continue');
    expect(
      documentedObserverPreflight(standaloneCollabInstruction, [
        'consensus:observer',
      ]),
    ).toBe('continue');
    expect(
      documentedObserverPreflight(pluginCollabInstruction, [
        'consensus:observer',
      ]),
    ).toBe('continue');
    expect(documentedObserverPreflight(standaloneCollabInstruction, [])).toBe(
      'stop',
    );
    expect(documentedObserverPreflight(pluginCollabInstruction, [])).toBe(
      'stop',
    );
    for (const instruction of [
      standaloneCollabInstruction,
      pluginCollabInstruction,
    ]) {
      expect(instruction).toContain(
        'Only when none of these identities is available, stop',
      );
      expect(instruction).toContain('Do not fetch the URL, install the skill');
    }
    const standaloneObserverInstruction = await readFile(
      path.join(root, 'skills/session-observer/SKILL.md'),
      'utf8',
    );
    expect(standaloneObserverInstruction).toContain(
      'Before any observer command or transcript access',
    );
    expect(standaloneObserverInstruction).toContain(
      'Do not install or fetch Node',
    );

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
      'plugins/session/skills/export-transcript/scripts/session-export-transcript.mjs',
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
    expect(
      (
        await inventoryTree(
          path.join(root, 'plugins/session/skills/export-transcript'),
        )
      ).map((entry) => entry.path),
    ).toContain('references/transcript-formats.md');

    await write(
      root,
      'bin/codex',
      '#!/bin/sh\nif [ "$1" = "--version" ]; then printf "codex 9.9.9\\n"; elif [ "$1" = "exec" ] && [ "$2" = "--help" ]; then printf "%s\\n" "--json --output-last-message --output-schema"; else exit 2; fi\n',
    );
    await chmod(path.join(bin, 'codex'), 0o755);
    const isolatedEnv = { HOME: home, PATH: bin };
    const standaloneCreate = path.join(
      root,
      'skills/consensus-create/scripts/consensus-create-cli.mjs',
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
