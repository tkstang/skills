import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = new URL('../..', import.meta.url);

async function assertDirectory(relativePath: string) {
  const details = await stat(new URL(`${relativePath}/`, root));
  expect(details.isDirectory(), `${relativePath} should be a directory`).toBe(
    true,
  );
}

async function pathExists(relativePath: string) {
  try {
    await stat(new URL(relativePath, root));
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function listFiles(relativePath: string): Promise<string[]> {
  const directoryUrl = new URL(`${relativePath}/`, root);
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)));
    } else {
      files.push(child);
    }
  }

  return files;
}

describe('repo-layout', () => {
  it('keeps the canonical public standalone skill set explicit', async () => {
    const standaloneSkills = (await readdir(new URL('skills/', root), {
      withFileTypes: true,
    }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();

    expect(standaloneSkills).toEqual([
      'export-session-transcript',
      'session-observer',
      'session-observer-collab',
    ]);

    for (const skill of standaloneSkills) {
      const markdown = await readFile(
        new URL(`skills/${skill}/SKILL.md`, root),
        'utf8',
      );
      expect(markdown, `${skill} should be publicly discoverable`).not.toMatch(
        /^\s{0,2}internal:\s*true\s*$/m,
      );
    }
  });

  it('repository exposes standalone and consensus plugin layout', async () => {
    const requiredDirectories = [
      'skills',
      path.posix.join('skills', 'session-observer-collab'),
      path.posix.join('skills', 'session-observer-collab', 'references'),
      path.posix.join('skills', 'session-observer-collab', 'scripts'),
      path.posix.join('shared', 'transcript-core'),
      path.posix.join('skills', 'export-session-transcript'),
      path.posix.join('plugins', 'consensus'),
      path.posix.join('plugins', 'consensus', 'skills'),
      path.posix.join('plugins', 'consensus', 'skills', 'refine'),
      path.posix.join('plugins', 'consensus', 'skills', 'refine', 'scripts'),
      path.posix.join('plugins', 'consensus', 'skills', 'evaluate'),
      path.posix.join('plugins', 'consensus', 'skills', 'evaluate', 'scripts'),
      path.posix.join('plugins', 'consensus', 'skills', 'create'),
      path.posix.join('plugins', 'consensus', 'skills', 'create', 'scripts'),
      path.posix.join('plugins', 'consensus', 'skills', 'decide'),
      path.posix.join('plugins', 'consensus', 'skills', 'decide', 'scripts'),
      path.posix.join('plugins', 'consensus', 'skills', 'plan'),
      path.posix.join('plugins', 'consensus', 'skills', 'plan', 'scripts'),
      path.posix.join('plugins', 'consensus', 'skills', 'panel'),
      path.posix.join('plugins', 'consensus', 'skills', 'panel', 'scripts'),
      path.posix.join('plugins', 'consensus', 'agents'),
      path.posix.join('plugins', 'consensus', '.claude-plugin'),
      path.posix.join('plugins', 'consensus', '.cursor-plugin'),
      path.posix.join('plugins', 'consensus', '.codex-plugin'),
      path.posix.join('src', 'consensus', 'core'),
      path.posix.join('src', 'consensus', 'refine'),
      path.posix.join('src', 'transcript', 'core'),
      path.posix.join('src', 'transcript', 'export-session'),
      'scripts',
    ];

    await Promise.all(requiredDirectories.map(assertDirectory));
  });

  it('transcript runtime source lives under src and generated output stays in skills', async () => {
    expect(
      await pathExists('shared/transcript-core/runtimes.mjs'),
      'shared transcript-core runtime should not remain a canonical source file',
    ).toBe(false);

    expect(
      await pathExists('src/transcript/core/runtimes.ts'),
      'transcript-core canonical source should live under src/transcript/core',
    ).toBe(true);
    expect(
      await pathExists(
        'src/transcript/export-session/export-session-transcript.ts',
      ),
      'export CLI canonical source should live under src/transcript/export-session',
    ).toBe(true);
    expect(
      await pathExists('src/transcript/export-session/sanitize.ts'),
      'export sanitizer canonical source should live under src/transcript/export-session',
    ).toBe(true);
  });

  it('session observer collaboration skill keeps canonical references and scripts', async () => {
    const skillRoot = path.posix.join('skills', 'session-observer-collab');
    const requiredFiles = [
      path.posix.join(skillRoot, 'SKILL.md'),
      path.posix.join(skillRoot, 'references', 'runtime-claude-code.md'),
      path.posix.join(skillRoot, 'references', 'runtime-codex.md'),
      path.posix.join(skillRoot, 'references', 'runtime-cursor.md'),
      path.posix.join(skillRoot, 'scripts', 'collab-control.mjs'),
      path.posix.join(skillRoot, 'scripts', 'codex-lifecycle.mjs'),
      path.posix.join(skillRoot, 'scripts', 'hooks', 'codex-stop.mjs'),
      path.posix.join(skillRoot, 'scripts', 'hooks', 'cursor-stop.mjs'),
    ];

    for (const relativePath of requiredFiles) {
      expect(
        await pathExists(relativePath),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it('ships collaboration scripts with builtin or local runtime imports only', async () => {
    const scriptsRoot = path.posix.join(
      'skills',
      'session-observer-collab',
      'scripts',
    );

    for (const scriptPath of (await listFiles(scriptsRoot)).filter((file) =>
      file.endsWith('.mjs'),
    )) {
      const script = await readFile(new URL(scriptPath, root), 'utf8');
      const specifiers = [
        ...script.matchAll(
          /\b(?:import|export)\s+(?:[^'"\n;]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
        ),
        ...script.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu),
        ...script.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/gu),
      ];
      for (const match of specifiers) {
        expect(
          match[1].startsWith('node:') || match[1].startsWith('.'),
          `${scriptPath} should not import a third-party runtime dependency`,
        ).toBe(true);
      }
    }
  });

  it('evaluate skill ships bundled rubric examples', async () => {
    const examplesDir = path.posix.join(
      'plugins',
      'consensus',
      'skills',
      'evaluate',
      'references',
      'examples',
    );

    await assertDirectory(examplesDir);

    const requiredExamples = [
      path.posix.join(examplesDir, 'general-purpose.md'),
      path.posix.join(examplesDir, 'code-review.md'),
      path.posix.join(examplesDir, 'technical-writing.md'),
      path.posix.join(examplesDir, 'design-architecture.md'),
    ];

    for (const examplePath of requiredExamples) {
      const exists = await pathExists(examplePath);
      expect(exists, `${examplePath} should exist`).toBe(true);
    }
  });

  it('create skill ships bundled brief examples', async () => {
    const examplesDir = path.posix.join(
      'plugins',
      'consensus',
      'skills',
      'create',
      'references',
      'examples',
    );

    await assertDirectory(examplesDir);

    const requiredExamples = [
      path.posix.join(examplesDir, 'artifact-brief.md'),
    ];

    for (const examplePath of requiredExamples) {
      const exists = await pathExists(examplePath);
      expect(exists, `${examplePath} should exist`).toBe(true);
    }
  });

  it('decide skill ships bundled options examples', async () => {
    const examplesDir = path.posix.join(
      'plugins',
      'consensus',
      'skills',
      'decide',
      'references',
      'examples',
    );

    await assertDirectory(examplesDir);

    const requiredExamples = [
      path.posix.join(examplesDir, 'contested-options.md'),
    ];

    for (const examplePath of requiredExamples) {
      const exists = await pathExists(examplePath);
      expect(exists, `${examplePath} should exist`).toBe(true);
    }
  });

  it('plan skill ships bundled goal and constraints examples', async () => {
    const examplesDir = path.posix.join(
      'plugins',
      'consensus',
      'skills',
      'plan',
      'references',
      'examples',
    );

    await assertDirectory(examplesDir);

    const requiredExamples = [
      path.posix.join(examplesDir, 'goal-and-constraints.md'),
    ];

    for (const examplePath of requiredExamples) {
      const exists = await pathExists(examplePath);
      expect(exists, `${examplePath} should exist`).toBe(true);
    }
  });

  it('panel skill ships bundled question examples', async () => {
    const examplesDir = path.posix.join(
      'plugins',
      'consensus',
      'skills',
      'panel',
      'references',
      'examples',
    );

    await assertDirectory(examplesDir);

    const requiredExamples = [
      path.posix.join(examplesDir, 'design-risk-question.md'),
      path.posix.join(examplesDir, 'privacy-boundary-question.md'),
    ];

    for (const examplePath of requiredExamples) {
      const exists = await pathExists(examplePath);
      expect(exists, `${examplePath} should exist`).toBe(true);
    }
  });

  it('consensus distribution tree does not include canonical TypeScript source', async () => {
    expect(
      await pathExists('plugins/consensus/skills/refine/src'),
      'refine skill distribution should not include a src directory',
    ).toBe(false);

    const skillFiles = await listFiles('plugins/consensus/skills');
    expect(
      skillFiles.filter((file) => file.endsWith('.ts')),
      'plugin skill distribution should not include TypeScript source files',
    ).toEqual([]);
  });
});
