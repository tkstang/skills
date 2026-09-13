import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusEvaluate from '../../../plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs';

const runtimes = [
  {
    name: 'refine',
    runtime: consensusRefine,
    defaultOutputSuffix: '.consensus.md',
  },
  {
    name: 'evaluate',
    runtime: consensusEvaluate,
    defaultOutputSuffix: '.evaluation.md',
  },
] as const;

describe.each(runtimes)(
  '$name generated runtime path safety',
  ({ runtime, defaultOutputSuffix }) => {
    const {
      INPUT_SIZE_CAP_BYTES,
      atomicWriteFile,
      confineWrite,
      readInputFile,
      resolveOutputPath,
      resolveRunDir,
    } = runtime;

    it('readInputFile allows unrestricted reads but enforces size cap', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const inputPath = path.join(tempRoot, 'input.md');
      await writeFile(inputPath, 'small');

      expect(await readInputFile(inputPath)).toBe('small');

      const largePath = path.join(tempRoot, 'large.md');
      await writeFile(largePath, `${'x'.repeat(INPUT_SIZE_CAP_BYTES)}x`);
      await expect(readInputFile(largePath)).rejects.toThrow(
        /input exceeds size cap/,
      );
    });

    it('confineWrite accepts paths inside root and rejects escaping paths', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const inside = await confineWrite(path.join(tempRoot, 'out.md'), tempRoot);
      expect(inside).toBe(path.join(tempRoot, 'out.md'));

      await expect(
        confineWrite(path.join(tempRoot, '../outside.md'), tempRoot),
      ).rejects.toThrow(/outside allowed root/);
    });

    it('confineWrite rejects symlink targets and symlink parent escapes', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const outside = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-outside-'),
      );
      const symlinkPath = path.join(tempRoot, 'linked.md');
      await symlink(path.join(outside, 'target.md'), symlinkPath);
      await expect(confineWrite(symlinkPath, tempRoot)).rejects.toThrow(
        /symlink/,
      );

      const linkDir = path.join(tempRoot, 'link-dir');
      await symlink(outside, linkDir);
      await expect(
        confineWrite(path.join(linkDir, 'out.md'), tempRoot),
      ).rejects.toThrow(/outside allowed root/);
    });

    it('resolveRunDir confines run directories under cwd unless allow-root is provided', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const outside = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-outside-'),
      );

      expect(
        await resolveRunDir({ cwd: tempRoot, runDir: '.consensus/run' }),
      ).toBe(path.join(tempRoot, '.consensus/run'));
      await expect(
        resolveRunDir({ cwd: tempRoot, runDir: path.join(outside, 'run') }),
      ).rejects.toThrow(/outside allowed root/);
      expect(
        await resolveRunDir({
          cwd: tempRoot,
          allowRoot: outside,
          runDir: path.join(outside, 'run'),
        }),
      ).toBe(path.join(outside, 'run'));
    });

    it('resolveOutputPath defaults next to readable input and confines explicit output', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const outside = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-outside-'),
      );
      const inputPath = path.join(outside, 'draft.md');
      await writeFile(inputPath, 'draft');

      expect(await resolveOutputPath({ cwd: tempRoot }, inputPath)).toBe(
        `${inputPath}${defaultOutputSuffix}`,
      );
      expect(
        await resolveOutputPath({ cwd: tempRoot, output: 'out.md' }, inputPath),
      ).toBe(path.join(tempRoot, 'out.md'));
      await expect(
        resolveOutputPath(
          { cwd: tempRoot, output: path.join(outside, 'out.md') },
          inputPath,
        ),
      ).rejects.toThrow(/outside/);
      expect(
        await resolveOutputPath(
          {
            cwd: tempRoot,
            allowRoot: outside,
            output: path.join(outside, 'out.md'),
          },
          inputPath,
        ),
      ).toBe(path.join(outside, 'out.md'));
    });

    it('atomicWriteFile writes through temp file then renames over the target', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const outputPath = path.join(tempRoot, 'nested/out.md');
      await atomicWriteFile(outputPath, 'final');

      expect(await readFile(outputPath, 'utf8')).toBe('final');
      expect((await stat(outputPath)).isFile()).toBe(true);
      expect((await lstat(path.join(tempRoot, 'nested'))).isDirectory()).toEqual(
        true,
      );

      const symlinkPath = path.join(tempRoot, 'linked.md');
      await symlink(outputPath, symlinkPath);
      await expect(atomicWriteFile(symlinkPath, 'nope')).rejects.toThrow(
        /symlink/,
      );
    });

    it('atomicWriteFile rejects symlink parents under a confined run directory', async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
      const outside = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-outside-'),
      );
      const runDir = path.join(tempRoot, '.consensus/run');
      await mkdir(runDir, { recursive: true });
      await symlink(outside, path.join(runDir, 'sections'));

      await expect(
        atomicWriteFile(
          path.join(runDir, 'sections/01-intro/section.md'),
          'escaped',
          { rootPath: tempRoot },
        ),
      ).rejects.toThrow(/outside allowed root/);
    });
  },
);
