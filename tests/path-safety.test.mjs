import assert from 'node:assert/strict';
import { lstat, mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  INPUT_SIZE_CAP_BYTES,
  atomicWriteFile,
  confineWrite,
  readInputFile,
  resolveOutputPath,
  resolveRunDir
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

test('readInputFile allows unrestricted reads but enforces size cap', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const inputPath = path.join(tempRoot, 'input.md');
  await writeFile(inputPath, 'small');

  assert.equal(await readInputFile(inputPath), 'small');

  const largePath = path.join(tempRoot, 'large.md');
  await writeFile(largePath, `${'x'.repeat(INPUT_SIZE_CAP_BYTES)}x`);
  await assert.rejects(readInputFile(largePath), /input exceeds size cap/);
});

test('confineWrite accepts paths inside root and rejects escaping paths', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const inside = await confineWrite(path.join(tempRoot, 'out.md'), tempRoot);
  assert.equal(inside, path.join(tempRoot, 'out.md'));

  await assert.rejects(confineWrite(path.join(tempRoot, '../outside.md'), tempRoot), /outside allowed root/);
});

test('confineWrite rejects symlink targets and symlink parent escapes', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'consensus-outside-'));
  const symlinkPath = path.join(tempRoot, 'linked.md');
  await symlink(path.join(outside, 'target.md'), symlinkPath);
  await assert.rejects(confineWrite(symlinkPath, tempRoot), /symlink/);

  const linkDir = path.join(tempRoot, 'link-dir');
  await symlink(outside, linkDir);
  await assert.rejects(confineWrite(path.join(linkDir, 'out.md'), tempRoot), /outside allowed root/);
});

test('resolveRunDir confines run directories under cwd unless allow-root is provided', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'consensus-outside-'));

  assert.equal(await resolveRunDir({ cwd: tempRoot, runDir: '.consensus/run' }), path.join(tempRoot, '.consensus/run'));
  await assert.rejects(resolveRunDir({ cwd: tempRoot, runDir: path.join(outside, 'run') }), /outside allowed root/);
  assert.equal(
    await resolveRunDir({ cwd: tempRoot, allowRoot: outside, runDir: path.join(outside, 'run') }),
    path.join(outside, 'run')
  );
});

test('resolveOutputPath defaults next to readable input and confines explicit output', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'consensus-outside-'));
  const inputPath = path.join(outside, 'draft.md');
  await writeFile(inputPath, 'draft');

  assert.equal(await resolveOutputPath({ cwd: tempRoot }, inputPath), `${inputPath}.consensus.md`);
  assert.equal(await resolveOutputPath({ cwd: tempRoot, output: 'out.md' }, inputPath), path.join(tempRoot, 'out.md'));
  await assert.rejects(resolveOutputPath({ cwd: tempRoot, output: path.join(outside, 'out.md') }, inputPath), /outside/);
  assert.equal(
    await resolveOutputPath({ cwd: tempRoot, allowRoot: outside, output: path.join(outside, 'out.md') }, inputPath),
    path.join(outside, 'out.md')
  );
});

test('atomicWriteFile writes through temp file then renames over the target', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const outputPath = path.join(tempRoot, 'nested/out.md');
  await atomicWriteFile(outputPath, 'final');

  assert.equal(await readFile(outputPath, 'utf8'), 'final');
  assert.equal((await stat(outputPath)).isFile(), true);
  assert.deepEqual(
    (await lstat(path.join(tempRoot, 'nested'))).isDirectory(),
    true
  );

  const symlinkPath = path.join(tempRoot, 'linked.md');
  await symlink(outputPath, symlinkPath);
  await assert.rejects(atomicWriteFile(symlinkPath, 'nope'), /symlink/);
});

test('atomicWriteFile rejects symlink parents under a confined run directory', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'consensus-outside-'));
  const runDir = path.join(tempRoot, '.consensus/run');
  await mkdir(runDir, { recursive: true });
  await symlink(outside, path.join(runDir, 'sections'));

  await assert.rejects(
    atomicWriteFile(path.join(runDir, 'sections/01-intro/section.md'), 'escaped', { rootPath: tempRoot }),
    /outside allowed root/
  );
});
