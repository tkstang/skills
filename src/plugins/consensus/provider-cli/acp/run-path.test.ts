// Extended (ACP) runs end to end through runProviderTurn and the
// `consensus run --request-json` entry: the real adapter and descriptors,
// with the fake ACP agent in place of the provider command, in a temporary
// git checkout so the working-tree check runs as it does for callers.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitEnv } from '../../../../../tests/helpers/git-env.mjs';
import { providerRegistry } from '../adapters.js';
import { runConsensusCli } from '../commands.js';
import { runProviderTurn } from '../structured-output.js';
import type {
  ConsensusCliRunEnvelope,
  ConsensusCliRunRequest,
} from '../types.js';
import { acpAdapter } from './adapter.js';
import type { AcpProviderDescriptor } from './descriptors.js';
import { ANTIGRAVITY_DESCRIPTOR, DROID_DESCRIPTOR } from './descriptors.js';
import type { FakeAgentHarness, Scenario } from './test-helpers.js';
import {
  acpFixture,
  cutAfter,
  dropSteps,
  expects,
  FAST_ACP_TIMING,
  fakeAgentHarness,
  insertAfter,
  sessionNewResult,
  waitForExit,
} from './test-helpers.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((step) => step()));
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    env: gitEnv({
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.invalid',
    }),
    encoding: 'utf8',
  });

async function tempDir(prefix: string) {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function checkout() {
  const dir = await tempDir('consensus-acp-repo-');
  git(dir, 'init', '-q', '-b', 'main');
  await writeFile(path.join(dir, 'README.md'), 'hello\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

interface Run {
  envelope: ConsensusCliRunEnvelope;
  harness: FakeAgentHarness;
  methods: string[];
  cwd: string;
}

async function setup(
  descriptor: AcpProviderDescriptor,
  scenario: Scenario,
  options: { cwd?: string } = {},
) {
  const harness = await fakeAgentHarness(scenario);
  cleanup.push(() => harness.cleanup());
  const cwd = options.cwd ?? (await checkout());
  const home = await tempDir('consensus-acp-home-');
  const parentEnv = {
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    [descriptor.executable_env]: process.execPath,
  };
  const registry = providerRegistry([
    acpAdapter(descriptor, { spawn: harness.spawn, timing: FAST_ACP_TIMING }),
  ]);
  return { harness, cwd, parentEnv, registry };
}

async function runTurn(
  descriptor: AcpProviderDescriptor,
  scenario: Scenario,
  request: Partial<ConsensusCliRunRequest> = {},
  options: { cwd?: string } = {},
): Promise<Run> {
  const { harness, cwd, parentEnv, registry } = await setup(
    descriptor,
    scenario,
    options,
  );
  const envelope = await runProviderTurn(
    {
      schema_version: 'v1',
      provider: descriptor.id,
      output: 'text',
      prompt: 'Reply with the marker.',
      cwd,
      runtime_policy: { permission_mode: 'read-only' },
      ...request,
    },
    { registry, parentEnv },
  );
  expect(envelope.stderr ?? '').not.toContain('scenario mismatch');
  return { envelope, harness, methods: await harness.methods(), cwd };
}

// agy-key-default without its second set_config_option (thought_level),
// which the descriptor does not set.
const agySession = async () =>
  dropSteps(
    await acpFixture('agy-key-default'),
    expects('session/set_config_option'),
    3,
    1,
  );

// The recorded sessions ran without our setup steps; these add the replies
// an agent gives to them.
async function withAgySetup(name: string) {
  const scenario = await acpFixture(name);
  return insertAfter(
    scenario,
    (step) => 'respond' in step && JSON.stringify(step).includes('"sessionId"'),
    [
      { expect: 'session/set_mode' },
      { respond: { result: {} } },
      { expect: 'session/set_config_option' },
      {
        respond: {
          result: { configOptions: sessionNewResult(scenario).configOptions },
        },
      },
    ],
  );
}

describe('extended runs through runProviderTurn', () => {
  it('returns the answer text with the provider-reported model and session', async () => {
    const { envelope, methods } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      { model: 'gemini-3.8-flash' },
    );

    expect(methods).toContain('session/prompt');
    expect(envelope).toMatchObject({
      ok: true,
      output_kind: 'text',
      text: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
      stdout: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
      json: null,
      attempts: { cli_attempts: 1, terminal_reason: 'success' },
      diagnostics: {
        strategy_used: 'text',
        output_mode: 'acp_session',
        redacted_command: [process.execPath, 'acp'],
        acp: { agent: { version: '1.5.13' }, auth: 'existing_login' },
      },
      continuation: {
        turn: 'completed',
        session_id: 'd1dc1bef-c052-4b55-a232-505704b45765',
        requested_model: 'gemini-3.8-flash',
        observed_models: ['gemini-3.8-flash'],
      },
    });
  });

  it('fails as permission denied when a denial leaves no answer (agy)', async () => {
    const { envelope } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await withAgySetup('agy-gui-write-nocaps'),
      { model: 'gemini-3.8-flash' },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_PERMISSION_DENIED',
      retryable: false,
      attempts: { cli_attempts: 1, terminal_reason: 'acp_permission_denied' },
      diagnostics: { permission_denials: { count: 1 } },
      continuation: { turn: 'completed' },
    });
    expect(envelope.ok === false && envelope.message).toMatch(
      /tried to act outside read-only/,
    );
  });

  it('fails as permission denied when Droid cancels the turn after a denial', async () => {
    const scenario = await acpFixture('droid-gui-normal-write-nocaps');
    const { envelope } = await runTurn(
      DROID_DESCRIPTOR,
      insertAfter(
        scenario,
        (step) => JSON.stringify(step) === '{"respond":{"result":{}}}',
        [
          { expect: 'session/set_config_option' },
          {
            respond: {
              result: {
                configOptions: sessionNewResult(scenario).configOptions,
              },
            },
          },
        ],
      ),
      { model: 'custom:Claude-Opus-5.5-(Proxy)-0' },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_PERMISSION_DENIED',
      diagnostics: {
        permission_denials: { count: 1, tools: ['Execute'] },
        acp: { stop_reason: 'cancelled' },
      },
      continuation: { turn: 'completed' },
    });
  });

  it('reports auth required before the turn, without the pairing code', async () => {
    const { envelope } = await runTurn(
      DROID_DESCRIPTOR,
      await acpFixture('authchk-droid'),
      { model: 'custom:GPT-6-Luna-(Proxy)-0' },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_AUTH_REQUIRED',
      attempts: { cli_attempts: 1 },
      continuation: { turn: 'not_started' },
    });
    expect(JSON.stringify(envelope)).not.toContain('QZXW-7342');
  });

  it('stops before the prompt, as not started, when the read-only mode is not confirmed', async () => {
    // Droid normally echoes the mode change; here set_mode answers without one.
    const scenario = cutAfter(
      await acpFixture('droid-kill'),
      expects('session/set_mode'),
      [
        { respond: { result: {} } },
        { expect: 'session/close' },
        { respond: { result: {} } },
      ],
    );
    const { envelope, methods } = await runTurn(DROID_DESCRIPTOR, scenario, {
      model: 'custom:GPT-6-Luna-(Proxy)-0',
    });

    expect(methods).not.toContain('session/prompt');
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      attempts: { terminal_reason: 'acp_setup_unconfirmed' },
      continuation: { turn: 'not_started' },
    });
  });

  it('cancels a timed-out prompt, then kills the process group including a grandchild', async () => {
    const scenario = cutAfter(await agySession(), expects('session/prompt'), [
      { spawnGrandchild: true },
      { hang: true },
    ]);
    const { envelope, harness } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.8-flash', max_runtime_sec: 1 },
    );

    const grandchild = Number(await readFile(harness.pidFile, 'utf8'));
    expect(await harness.methods()).toContain('session/cancel');
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_TIMEOUT',
      diagnostics: {
        termination: { reason: 'timeout', scope: 'process_group' },
        acp: { cancel_sent: true },
      },
      continuation: { turn: 'unknown' },
    });
    expect(await waitForExit(grandchild)).toBe(true);
  });

  it('fails loudly when the agent changes the working tree, listing the path', async () => {
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [
        {
          writeFile: {
            path: 'peer-note.txt',
            content: 'written by the peer\n',
          },
        },
      ],
    );
    const { envelope } = await runTurn(ANTIGRAVITY_DESCRIPTOR, scenario, {
      model: 'gemini-3.8-flash',
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
      retryable: false,
      stdout: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
      attempts: { cli_attempts: 1, terminal_reason: 'working_tree_changed' },
      diagnostics: { working_tree_changes: ['peer-note.txt'] },
      continuation: { turn: 'completed' },
    });
    expect(envelope.ok === false && envelope.message).toContain(
      'peer-note.txt',
    );
  });

  it('refuses to launch outside a git checkout', async () => {
    const cwd = await tempDir('consensus-acp-plain-');
    const { envelope, harness } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      { model: 'gemini-3.8-flash' },
      { cwd },
    );

    expect(harness.launches).toEqual([]);
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      attempts: {
        cli_attempts: 0,
        terminal_reason: 'working_tree_unavailable',
      },
      continuation: { turn: 'not_started' },
    });
  });

  it('refuses to launch without a model', async () => {
    const { envelope, harness } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
    );

    expect(harness.launches).toEqual([]);
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      attempts: { cli_attempts: 0, terminal_reason: 'model_required' },
      continuation: { turn: 'not_started' },
    });
    expect(envelope.ok === false && envelope.message).toMatch(
      /^antigravity needs a model: pass --model/,
    );
  });
});

describe('extended runs through consensus run --request-json', () => {
  async function runCli(
    descriptor: AcpProviderDescriptor,
    scenario: Scenario,
    request: Record<string, unknown>,
  ) {
    const { harness, cwd, parentEnv, registry } = await setup(
      descriptor,
      scenario,
    );
    const requestDir = await tempDir('consensus-acp-request-');
    const requestPath = path.join(requestDir, 'request.json');
    await writeFile(
      requestPath,
      JSON.stringify({
        schema_version: 'v1',
        provider: descriptor.id,
        output: 'text',
        prompt: 'Reply with the marker.',
        cwd,
        runtime_policy: { permission_mode: 'read-only' },
        ...request,
      }),
    );
    let stdout = '';
    const code = await runConsensusCli(
      ['run', '--request-json', requestPath, '--json'],
      {
        stdout: { write: (chunk: unknown) => (stdout += String(chunk)) },
        stderr: { write: () => true },
        stdin: process.stdin,
        cwd,
        env: parentEnv,
        readFile: (file) => readFile(file, 'utf8'),
        readStdin: () => Promise.reject(new Error('no stdin')),
      },
      { adapters: registry },
    );
    return { code, envelope: JSON.parse(stdout), harness };
  }

  it('runs a registry adapter and returns the text envelope', async () => {
    const { code, envelope } = await runCli(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      { model: 'gemini-3.8-flash' },
    );

    expect(code).toBe(0);
    expect(envelope).toMatchObject({
      ok: true,
      text: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
    });
  });

  it('fails a run that changes the working tree', async () => {
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [{ writeFile: { path: 'README.md', content: 'rewritten\n' } }],
    );
    const { envelope } = await runCli(ANTIGRAVITY_DESCRIPTOR, scenario, {
      model: 'gemini-3.8-flash',
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
      diagnostics: { working_tree_changes: ['README.md'] },
    });
  });
});
