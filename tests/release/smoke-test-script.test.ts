import path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import { runSmokeTest } from '../../scripts/smoke-test.mjs';
import { runNodeScript } from '../helpers/process.mjs';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const smokeScript = path.join(repoRoot, 'scripts/smoke-test.mjs');

function writer() {
  let value = '';
  return {
    stream: {
      write(chunk: string) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

function cleanSmokeEnv(overrides: NodeJS.ProcessEnv = {}) {
  const { CONSENSUS_CLI_PATH: _consensusCliPath, ...env } = process.env;
  return { ...env, ...overrides };
}

describe('smoke-test-script', () => {
  it('runSmokeTest runs validation, uses the consensus CLI stub, and verifies wrapper output', async () => {
    const stdout = writer();
    const calls: { command: string; args: string[]; env: NodeJS.ProcessEnv }[] =
      [];

    const result = await runSmokeTest({
      stdout: stdout.stream,
      env: cleanSmokeEnv(),
      runCommand: async (
        command: string,
        args: string[],
        options: { env: NodeJS.ProcessEnv },
      ) => {
        calls.push({ command, args, env: options.env });
        return { stdout: '', stderr: '' };
      },
    });

    expect(result.status).toBe('passed');
    expect(calls.length).toBe(1);
    expect(calls[0].command).toBe(process.execPath);
    expect(calls[0].args).toEqual([
      path.join(repoRoot, 'scripts/validate.mjs'),
    ]);
    expect(result.env.PATH.split(path.delimiter)[0]).toMatch(
      /tests\/fixtures\/bin$/,
    );
    expect(calls[0].env.CONSENSUS_CLI_PATH).toBe(
      path.join(repoRoot, 'tests/fixtures/bin/consensus'),
    );
    expect(result.events.at(-1).event).toBe('run_completed');
    expect(result.events.at(-1).status).toBe('converged');
    expect(result.artifact).toMatch(/## Final Output/);
    expect(result.artifact).toMatch(/<!-- consensus:consensus-resolution/);
    expect(stdout.value()).toMatch(/smoke passed/);

    expect(result.create, 'create smoke scenario missing').toBeTruthy();
    expect(result.create.status).toBe('converged');
    expect(result.create.artifact).toMatch(/## Created Artifact/);
    expect(result.create.artifact).toMatch(/## Deliberation Log/);
    expect(result.create.artifact).toMatch(
      /<!-- consensus:consensus-resolution/,
    );
    expect(result.create.artifact).toMatch(/"cold_start": "independent_draft"/);
    expect(result.create.artifact).toMatch(
      /"iteration": "parallel_synthesized"/,
    );
    expect(result.create.artifact).toMatch(/"agency": "maximum"/);

    expect(result.decide, 'decide smoke scenario missing').toBeTruthy();
    expect(result.decide.status).toBe('converged');
    expect(result.decide.artifact).toMatch(/## Recommendation/);
    expect(result.decide.artifact).toMatch(/## Reasoning/);
    expect(result.decide.artifact).toMatch(/## Alternatives/);
    expect(result.decide.artifact).toMatch(
      /## Dissent \/ Unresolved Disagreement/,
    );
    expect(result.decide.artifact).toMatch(
      /<!-- consensus:consensus-resolution/,
    );
    expect(result.decide.artifact).toMatch(/"cold_start": "independent_draft"/);
    expect(result.decide.artifact).toMatch(
      /"iteration": "parallel_synthesized"/,
    );
    expect(result.decide.artifact).toMatch(/"agency": "minimal"/);

    expect(result.plan, 'plan smoke scenario missing').toBeTruthy();
    expect(result.plan.status).toBe('converged');
    expect(result.plan.artifact).toMatch(/## Steps/);
    expect(result.plan.artifact).toMatch(/## Dependencies/);
    expect(result.plan.artifact).toMatch(/## Risks/);
    expect(result.plan.artifact).toMatch(/<!-- consensus:consensus-resolution/);
    expect(result.plan.artifact).toMatch(/"cold_start": "independent_draft"/);
    expect(result.plan.artifact).toMatch(
      /"iteration": "parallel_synthesized"/,
    );
    expect(result.plan.artifact).toMatch(/"agency": "moderate"/);

    // The smoke now also drives a parallel-synthesized escalation + host-direction
    // resume to convergence.
    expect(
      result.parallelSynthesized,
      'parallel-synthesized smoke scenario missing',
    ).toBeTruthy();
    expect(result.parallelSynthesized.status).toBe('converged');
    expect(result.parallelSynthesized.escalation.trigger).toBe(
      'persistent_disagreement',
    );
    expect(result.parallelSynthesized.escalation.decide_via).toBe('host');
    expect(result.parallelSynthesized.escalation.resume.flag).toBe(
      '--host-direction',
    );
  });

  it('runSmokeTest keeps the consensus CLI path for wrapper execution', async () => {
    const stdout = writer();
    const calls: { command: string; args: string[]; env: NodeJS.ProcessEnv }[] =
      [];

    const result = await runSmokeTest({
      stdout: stdout.stream,
      env: cleanSmokeEnv(),
      runCommand: async (
        command: string,
        args: string[],
        options: { env: NodeJS.ProcessEnv },
      ) => {
        calls.push({ command, args, env: options.env });
        return { stdout: '', stderr: '' };
      },
    });

    expect(result.status).toBe('passed');
    expect(calls[0].env.CONSENSUS_CLI_PATH).toBe(
      path.join(repoRoot, 'tests/fixtures/bin/consensus'),
    );
    expect(result.events.at(-1).event).toBe('run_completed');
    expect(result.events.at(-1).status).toBe('converged');
    expect(result.artifact).toMatch(/## Final Output/);
    expect(stdout.value()).toMatch(/smoke passed/);
    expect(result.create.status).toBe('converged');
    expect(result.create.artifact).toMatch(/Synthesized/);
    expect(result.decide.status).toBe('converged');
    expect(result.decide.artifact).toMatch(
      /Dissent \/ Unresolved Disagreement/,
    );
    expect(result.plan.status).toBe('converged');
    expect(result.plan.artifact).toMatch(/## Dependencies/);
  });

  it('runParallelSynthesizedSmoke escalates once then converges via --host-direction', async () => {
    // @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
    const smokeModule = await import('../../scripts/smoke-test.mjs');
    const { runParallelSynthesizedSmoke } = smokeModule;
    const result = await runParallelSynthesizedSmoke();

    expect(result.status).toBe('converged');
    expect(result.escalation.event).toBe('escalation_required');
    expect(result.escalation.trigger).toBe('persistent_disagreement');
  });

  it('smoke-test CLI exits zero on deterministic fixture run', async () => {
    const result = await runNodeScript(smokeScript, [], { cwd: repoRoot });
    expect(result.stdout).toMatch(/smoke passed/);
  });

  it('smoke-test CLI exits non-zero on failed assertions', async () => {
    await expect(
      runNodeScript(smokeScript, [], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CONSENSUS_SMOKE_EXPECT_STATUS: 'partial',
        },
      }),
    ).rejects.toThrow(/expected smoke status partial/);
  });
});
