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

test('SKILL.md documents iteration modes, synthesizer, and cost multipliers', async () => {
  const skill = await readFile(skillPath, 'utf8');

  // Iteration-mode selection with the three modes and the alternating default.
  assert.match(skill, /--iteration/);
  assert.match(skill, /alternating/);
  assert.match(skill, /parallel_revision/);
  assert.match(skill, /parallel_synthesized/);
  assert.match(skill, /default/i);

  // Cost multipliers must be disclosed (2x peer calls; +1 synthesis).
  assert.match(skill, /2x|2×|two peer calls/i);
  assert.match(skill, /synthesis call/i);
  assert.match(skill, /calls_per_round/);

  // Synthesizer configuration.
  assert.match(skill, /--synthesizer/);
  assert.match(skill, /first.*peer/i);
});

test('SKILL.md documents escalation handling branched on decide_via', async () => {
  const skill = await readFile(skillPath, 'utf8');

  assert.match(skill, /escalation_required/);
  assert.match(skill, /decide_via/);

  // user-routed: present options to the user.
  assert.match(skill, /decide_via.*user|user.*present/is);

  // host-routed: the host decides AND discloses the decision to the user.
  assert.match(skill, /--host-direction/);
  assert.match(skill, /disclose.*decision.*user|tell the user.*decision/is);

  // Decline path.
  assert.match(skill, /defer_to_user/);

  // The host never silently overrides routing.
  assert.match(skill, /never self-decide|do not self-decide|routes to the user|fail closed/i);
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

test('section runner passes mode/synthesizer through and never self-decides escalations', async () => {
  const runner = await readFile(runnerPath, 'utf8');

  // Mode/synthesizer are packet fields threaded into the loop invocation, not
  // hardcoded to alternating.
  assert.match(runner, /iteration_mode/);
  assert.match(runner, /synthesizer/);
  assert.match(runner, /--iteration <iteration_mode>/);
  assert.match(runner, /--synthesizer/);

  // Runners report escalations; they never decide them.
  assert.match(runner, /report.*escalation.*section result/is);
  assert.match(runner, /never self-decide|do not self-decide/i);
  assert.match(runner, /escalation/i);
});
