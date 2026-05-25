import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const skillPath = path.join(repoRoot, 'plugins/consensus/skills/refine/SKILL.md');
const runnerPath = path.join(repoRoot, 'plugins/consensus/agents/consensus-section-runner.md');

test('SKILL.md documents the host-mediated parallel dispatch contract', async () => {
  const skill = await readFile(skillPath, 'utf8');

  assert.match(skill, /--prepare-parallel/);
  assert.match(skill, /parallel_dispatch_required/);
  assert.match(skill, /consensus-section-runner\.md/);
  assert.match(skill, /--fan-in <manifest-path>/);
  assert.match(skill, /batch/i);
  assert.match(skill, /parallelism/i);
  assert.match(skill, /SIGINT/i);
  assert.match(skill, /cancel outstanding subagents/i);
  assert.match(skill, /Codex[\s\S]*authorization[\s\S]*fail closed/i);
  assert.match(skill, /do not silently switch to sequential mode/i);
});

test('section runner documents the packet schema and bounded execution rules', async () => {
  const runner = await readFile(runnerPath, 'utf8');

  for (const field of [
    'manifest_path',
    'section_id',
    'section_file',
    'goal',
    'peers',
    'max_rounds',
    'agency',
    'output_records',
    'output_section',
    'output_status'
  ]) {
    assert.match(runner, new RegExp(field));
  }

  assert.match(runner, /one prepared consensus section packet/i);
  assert.match(runner, /do not inspect unrelated sections/i);
  assert.match(runner, /write.*declared files/i);
  assert.match(runner, /do not assemble the final document/i);
  assert.match(runner, /SIGINT/i);
});
