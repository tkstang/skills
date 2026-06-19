import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(new URL('../../..', import.meta.url).pathname);
const skillPath = path.join(
  repoRoot,
  'plugins/consensus/skills/refine/SKILL.md',
);
const runnerPath = path.join(
  repoRoot,
  'plugins/consensus/agents/consensus-section-runner.md',
);

describe('host-dispatch-docs', () => {
  it('SKILL.md documents the host-mediated parallel dispatch contract', async () => {
    const skill = await readFile(skillPath, 'utf8');

    expect(skill).toMatch(/--prepare-parallel/);
    expect(skill).toMatch(/parallel_dispatch_required/);
    expect(skill).toMatch(/consensus-section-runner\.md/);
    expect(skill).toMatch(/--fan-in <manifest-path>/);
    expect(skill).toMatch(/batch/i);
    expect(skill).toMatch(/parallelism/i);
    expect(skill).toMatch(/SIGINT/i);
    expect(skill).toMatch(/cancel outstanding subagents/i);
    expect(skill).toMatch(/Codex[\s\S]*authorization[\s\S]*fail closed/i);
    expect(skill).toMatch(/do not silently switch to sequential mode/i);
  });

  it('SKILL.md documents iteration modes, synthesizer, and cost multipliers', async () => {
    const skill = await readFile(skillPath, 'utf8');

    // Iteration-mode selection with the three modes and the alternating default.
    expect(skill).toMatch(/--iteration/);
    expect(skill).toMatch(/alternating/);
    expect(skill).toMatch(/parallel_revision/);
    expect(skill).toMatch(/parallel_synthesized/);
    expect(skill).toMatch(/default/i);

    // Cost multipliers must be disclosed (2x peer calls; +1 synthesis).
    expect(skill).toMatch(/2x|2×|two peer calls/i);
    expect(skill).toMatch(/synthesis call/i);
    expect(skill).toMatch(/calls_per_round/);

    // Synthesizer configuration.
    expect(skill).toMatch(/--synthesizer/);
    expect(skill).toMatch(/first.*peer/i);
  });

  it('SKILL.md documents escalation handling branched on decide_via', async () => {
    const skill = await readFile(skillPath, 'utf8');

    expect(skill).toMatch(/escalation_required/);
    expect(skill).toMatch(/decide_via/);

    // user-routed: present options to the user.
    expect(skill).toMatch(/decide_via.*user|user.*present/is);

    // host-routed: the host decides AND discloses the decision to the user.
    expect(skill).toMatch(/--host-direction/);
    expect(skill).toMatch(/disclose.*decision.*user|tell the user.*decision/is);

    // Decline path.
    expect(skill).toMatch(/defer_to_user/);

    // The host never silently overrides routing.
    expect(skill).toMatch(
      /never self-decide|do not self-decide|routes to the user|fail closed/i,
    );
  });

  it('section runner documents the packet schema and bounded execution rules', async () => {
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
      'output_status',
    ]) {
      expect(runner).toMatch(new RegExp(field));
    }

    expect(runner).toMatch(/one prepared consensus section packet/i);
    expect(runner).toMatch(/do not inspect unrelated sections/i);
    expect(runner).toMatch(/write.*declared files/i);
    expect(runner).toMatch(/do not assemble the final document/i);
    expect(runner).toMatch(/SIGINT/i);
  });

  it('section runner passes mode/synthesizer through and never self-decides escalations', async () => {
    const runner = await readFile(runnerPath, 'utf8');

    // Mode/synthesizer are packet fields threaded into the loop invocation, not
    // hardcoded to alternating.
    expect(runner).toMatch(/iteration_mode/);
    expect(runner).toMatch(/synthesizer/);
    expect(runner).toMatch(/--iteration <iteration_mode>/);
    expect(runner).toMatch(/--synthesizer/);

    // Runners report escalations; they never decide them.
    expect(runner).toMatch(/report.*escalation.*section result/is);
    expect(runner).toMatch(/never self-decide|do not self-decide/i);
    expect(runner).toMatch(/escalation/i);
  });
});
