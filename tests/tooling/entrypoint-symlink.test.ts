import { execFile } from 'node:child_process';
import {
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Standalone installs are reached through provider symlinks such as
// ~/.claude/skills/<name> -> ~/.agents/skills/<name>. Every generated script
// with a CLI entrypoint guard must run the same way through such a link.

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const generatedRoots = ['skills', 'plugins'];
const guard = /process\.argv\[1\] &&/u;
const timestamp = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/gu;

async function listScripts(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory())
        return entry.name === 'node_modules' ? [] : listScripts(full);
      return entry.name.endsWith('.mjs') ? [full] : [];
    }),
  );
  return nested.flat();
}

async function entrypoints(): Promise<string[]> {
  const scripts = (
    await Promise.all(
      generatedRoots.map((root) => listScripts(path.join(repoRoot, root))),
    )
  ).flat();
  const withGuard: string[] = [];
  for (const script of scripts)
    if (guard.test(await readFile(script, 'utf8')))
      withGuard.push(path.relative(repoRoot, script));
  return withGuard.toSorted();
}

function run(script: string, home: string) {
  return new Promise<{ code: number | null; output: string }>((resolve) => {
    execFile(
      process.execPath,
      [script, '--help'],
      { cwd: home, env: { ...process.env, HOME: home }, timeout: 15_000 },
      (error, stdout, stderr) => {
        const code =
          error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({
          code,
          output: `${stdout}${stderr}`.replace(timestamp, '<timestamp>'),
        });
      },
    ).stdin?.end();
  });
}

describe('generated entrypoints through symlinks', () => {
  let temporary: string;
  let linkedRoot: string;

  beforeAll(async () => {
    temporary = await realpath(
      await mkdtemp(path.join(tmpdir(), 'entrypoint-symlink-')),
    );
    linkedRoot = path.join(temporary, 'linked');
    await symlink(repoRoot, linkedRoot, 'dir');
  });

  afterAll(async () => {
    await rm(temporary, { recursive: true, force: true });
  });

  it('finds the known CLI entrypoints', async () => {
    const found = await entrypoints();
    expect(found).toContain('skills/consensus-review/scripts/review.mjs');
    expect(found).toContain(
      'skills/session-observer-collab/scripts/collab-control.mjs',
    );
    expect(found).toContain('plugins/consensus/scripts/consensus-loop.mjs');
    expect(found).toContain('plugins/consensus/scripts/consensus.mjs');
  });

  it('keeps the shared loop entrypoint out of bundled wrappers', async () => {
    for (const script of await entrypoints()) {
      if (script === 'plugins/consensus/scripts/consensus-loop.mjs') continue;
      const text = await readFile(path.join(repoRoot, script), 'utf8');
      expect(text, script).not.toMatch(/runConsensusLoop\(process\.argv/u);
    }
  });

  it('produces the same output through a symlinked install', async () => {
    const scripts = await entrypoints();
    const results = await Promise.all(
      scripts.map(async (script) => {
        const home = await mkdtemp(path.join(temporary, 'home-'));
        const direct = await run(path.join(repoRoot, script), home);
        const linked = await run(path.join(linkedRoot, script), home);
        return {
          script,
          direct,
          linked: {
            ...linked,
            output: linked.output.replaceAll(linkedRoot, repoRoot),
          },
        };
      }),
    );
    for (const { script, direct, linked } of results) {
      // Lifecycle hooks are silent by design; every other CLI prints usage
      // or an argument error, so empty output means main() never ran.
      if (!script.includes('/hooks/'))
        expect(direct.output, script).not.toBe('');
      expect(linked, script).toEqual(direct);
    }
  }, 120_000);
});
