import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('..', import.meta.url);

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
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

describe('generated output drift guard', () => {
  it('checks committed generated outputs without mutating tracked files', async () => {
    const result = await runNode(['scripts/build-generated.mjs', '--check']);

    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('consensus-loop');
    expect(result.code).toBe(0);
  });

  it('declares the consensus-loop source to generated-output mapping', async () => {
    const script = await readFile(
      new URL('../scripts/build-generated.mjs', import.meta.url),
      'utf8',
    );

    expect(script).toContain(
      'plugins/consensus/skills/refine/src/consensus-loop.ts',
    );
    expect(script).toContain(
      'plugins/consensus/skills/refine/scripts/consensus-loop.mjs',
    );
  });
});
