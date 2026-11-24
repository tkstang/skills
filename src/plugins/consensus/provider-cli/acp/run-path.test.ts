// Extended (ACP) runs end to end through runProviderTurn and the
// `consensus run --request-json` entry: the real adapter and descriptors,
// with the fake ACP agent in place of the provider command, in a temporary
// git checkout so the working-tree check runs as it does for callers.
import { execFileSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
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
import type { AcpTransport } from './client.js';
import { stdioAcpTransport } from './client.js';
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

interface SetupOptions {
  cwd?: string;
  parentEnv?: Record<string, string>;
  // Written as the user consensus config.
  userConfig?: unknown;
  transport?: AcpTransport;
}

async function setup(
  descriptor: AcpProviderDescriptor,
  scenario: Scenario,
  options: SetupOptions = {},
) {
  const harness = await fakeAgentHarness(scenario);
  cleanup.push(() => harness.cleanup());
  const cwd = options.cwd ?? (await checkout());
  const home = await tempDir('consensus-acp-home-');
  if (options.userConfig) {
    await mkdir(path.join(home, '.config', 'consensus'), { recursive: true });
    await writeFile(
      path.join(home, '.config', 'consensus', 'config.json'),
      JSON.stringify(options.userConfig),
    );
  }
  const parentEnv = {
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    [descriptor.executable_env]: process.execPath,
    ...options.parentEnv,
  };
  const registry = providerRegistry([
    acpAdapter(descriptor, {
      spawn: harness.spawn,
      timing: FAST_ACP_TIMING,
      ...(options.transport ? { transport: options.transport } : {}),
    }),
  ]);
  return { harness, cwd, parentEnv, registry };
}

async function runTurn(
  descriptor: AcpProviderDescriptor,
  scenario: Scenario,
  request: Partial<ConsensusCliRunRequest> = {},
  options: SetupOptions = {},
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

  it('fails as permission denied when a denial leaves no answer (agy), naming its kind and path', async () => {
    const realCwd = await checkout();
    // The run is given the cwd through the tmpdir symlink (macOS /var ->
    // /private/var); agy reports the real path.
    const cwd = path.join(os.tmpdir(), path.basename(realCwd));
    const scenario = await withAgySetup('agy-gui-write-nocaps');
    const request = scenario.steps.find(
      (step) => (step.send as any)?.method === 'session/request_permission',
    ) as { send: { params: { toolCall: Record<string, unknown> } } };
    request.send.params.toolCall.locations = [
      { path: path.join(realCwd, 'notes', 'probe-write.txt') },
      { path: '/elsewhere/second.txt' },
    ];
    const { envelope } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.8-flash' },
      { cwd },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_PERMISSION_DENIED',
      retryable: false,
      attempts: { cli_attempts: 1, terminal_reason: 'acp_permission_denied' },
      diagnostics: {
        permission_denials: {
          count: 1,
          tools: ['write_file'],
          requests: [
            {
              tool: 'write_file',
              kind: 'edit',
              path: path.join('notes', 'probe-write.txt'),
            },
          ],
        },
      },
      continuation: { turn: 'completed' },
    });
    expect(envelope.ok === false && envelope.message).toMatch(
      /tried to act outside read-only/,
    );
  });

  it('redacts a credential in denial details before shortening them', async () => {
    const secret = 'zq-literal-credential-4711';
    const realCwd = await checkout();
    const scenario = await withAgySetup('agy-gui-write-nocaps');
    const request = scenario.steps.find(
      (step) => (step.send as any)?.method === 'session/request_permission',
    ) as { send: { params: { toolCall: Record<string, unknown> } } };
    // Both values cross their display limit inside the credential.
    request.send.params.toolCall.name = `${'t'.repeat(110)}${secret}`;
    request.send.params.toolCall.locations = [
      { path: path.join(realCwd, 'd'.repeat(230), `${secret}.txt`) },
    ];
    const { envelope } = await runTurn(
      { ...ANTIGRAVITY_DESCRIPTOR, api_key: undefined },
      scenario,
      { model: 'gemini-3.8-flash' },
      { cwd: realCwd, parentEnv: { GEMINI_API_KEY: secret } },
    );

    const denials = envelope.diagnostics?.permission_denials;
    expect(denials?.requests?.[0]).toMatchObject({
      tool: `${'t'.repeat(110)}<redacted>`,
      path: `${'d'.repeat(230)}/<redacted…`,
    });
    expect(JSON.stringify(envelope)).not.toContain('zq-lit');
  });

  // The recorded Droid session never set its model; this adds the
  // set_config_option reply, reporting `autonomy` as its autonomy level.
  async function droidWithModelSet(autonomy: string) {
    const scenario = await acpFixture('droid-gui-normal-write-nocaps');
    const configOptions = sessionNewResult(scenario).configOptions.map(
      (option: Record<string, unknown>) =>
        option.id === 'autonomy_level'
          ? { ...option, currentValue: autonomy }
          : option,
    );
    return insertAfter(
      scenario,
      (step) => JSON.stringify(step) === '{"respond":{"result":{}}}',
      [
        { expect: 'session/set_config_option' },
        { respond: { result: { configOptions } } },
      ],
    );
  }

  it('stops before the prompt when Droid leaves normal mode during model setup', async () => {
    const { envelope, methods } = await runTurn(
      DROID_DESCRIPTOR,
      cutAfter(
        await droidWithModelSet('auto-medium'),
        (step) =>
          JSON.stringify(step).includes('"configOptions"') &&
          'respond' in step &&
          !JSON.stringify(step).includes('"sessionId"'),
        [{ expect: 'session/close' }, { respond: { result: {} } }],
      ),
      { model: 'custom:Claude-Opus-5.5-(Proxy)-0' },
    );

    expect(methods).not.toContain('session/prompt');
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      attempts: { terminal_reason: 'acp_setup_unconfirmed' },
      continuation: { turn: 'not_started' },
    });
    expect(envelope.ok === false && envelope.message).toContain(
      'left mode normal (now auto-medium) before the prompt',
    );
  });

  it('stops before the prompt when Droid reports another mode while normal is being confirmed', async () => {
    const recorded = await acpFixture('droid-kill');
    const echo = recorded.steps[7] as { send: { params: any } };
    const contrary = structuredClone(echo);
    for (const option of contrary.send.params.update.configOptions) {
      if (option.id === 'autonomy_level') option.currentValue = 'auto-medium';
    }
    const scenario = cutAfter(recorded, expects('session/set_mode'), [
      echo,
      contrary,
      { respond: { result: {} } },
      { expect: 'session/close' },
      { respond: { result: {} } },
    ]);
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

  it('cancels and fails a turn when the agent leaves read-only mode mid-turn', async () => {
    const scenario = cutAfter(await agySession(), expects('session/prompt'), [
      {
        send: {
          method: 'session/update',
          params: {
            sessionId: 'd1dc1bef-c052-4b55-a232-505704b45765',
            update: {
              sessionUpdate: 'current_mode_update',
              currentModeId: 'accept-edits',
            },
          },
        },
      },
      {
        send: {
          method: 'session/update',
          params: {
            sessionId: 'd1dc1bef-c052-4b55-a232-505704b45765',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'ANSWER-AFTER-DRIFT' },
            },
          },
        },
      },
      { expect: 'session/cancel' },
      { respond: { result: { stopReason: 'end_turn' } } },
      { expect: 'session/close' },
      { respond: { result: {} } },
    ]);
    const { envelope, methods } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.8-flash' },
    );

    expect(methods).toContain('session/cancel');
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      attempts: { terminal_reason: 'acp_mode_changed' },
      continuation: { turn: 'unknown' },
    });
    expect(JSON.stringify(envelope)).not.toContain('ANSWER-AFTER-DRIFT');
  });

  it('fails as permission denied when Droid cancels the turn after a denial', async () => {
    const { envelope } = await runTurn(
      DROID_DESCRIPTOR,
      await droidWithModelSet('normal'),
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
    // The failure carries the (empty) answer, not the internal turn record.
    expect(envelope.stdout ?? '').toBe('');
  });

  it('redacts a credential the agent echoes in its answer, title and stderr', async () => {
    // A literal value no built-in credential pattern matches.
    const secret = 'zq-literal-credential-4711';
    const scenario = await agySession();
    const initialize = scenario.steps[1] as { respond: { result: any } };
    initialize.respond.result.agentInfo.title = `Signed in with ${secret}`;
    const echoing = insertAfter(scenario, expects('session/prompt'), [
      { stderr: `debug: key=${secret}\n` },
      {
        send: {
          method: 'session/update',
          params: {
            sessionId: 'd1dc1bef-c052-4b55-a232-505704b45765',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: `Your key is ${secret}. ` },
            },
          },
        },
      },
      { writeFile: { path: 'leak.txt', content: 'x\n' } },
    ]);
    // The key is passed to the agent but selects no API-key login here.
    const descriptor = { ...ANTIGRAVITY_DESCRIPTOR, api_key: undefined };
    const { envelope } = await runTurn(
      descriptor,
      echoing,
      { model: 'gemini-3.8-flash' },
      { parentEnv: { GEMINI_API_KEY: secret } },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
      stdout: 'Your key is <redacted>. marker-85b2d6a11e65\nGemini 3.8 Flash',
      diagnostics: {
        acp: { agent: { title: 'Signed in with <redacted>' } },
      },
    });
    expect(envelope.stderr).toContain('key=<redacted>');
    expect(JSON.stringify(envelope)).not.toContain(secret);
  });

  it('redacts the default credential shapes from the stdout of an error-text failure', async () => {
    const token = 'Bearer abcdef0123456789xyz';
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [
        {
          send: {
            method: 'session/update',
            params: {
              sessionId: 'd1dc1bef-c052-4b55-a232-505704b45765',
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: {
                  type: 'text',
                  text: `agent executor error (${token}) `,
                },
              },
            },
          },
        },
      ],
    );
    const { envelope } = await runTurn(ANTIGRAVITY_DESCRIPTOR, scenario, {
      model: 'gemini-3.8-flash',
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      attempts: { terminal_reason: 'acp_error_text' },
      stdout:
        'agent executor error (<redacted>) marker-85b2d6a11e65\nGemini 3.8 Flash',
    });
    expect(JSON.stringify(envelope)).not.toContain('abcdef0123456789xyz');
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
    expect(envelope.ok === false && envelope.message).toContain(
      'With GEMINI_API_KEY, Gemini API retries (503 high demand) or an exhausted quota can also cause this.',
    );
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

  it('fails as changed when a turn that wrote a file then times out', async () => {
    const scenario = cutAfter(await agySession(), expects('session/prompt'), [
      { writeFile: { path: 'peer-note.txt', content: 'written\n' } },
      { hang: true },
    ]);
    const { envelope } = await runTurn(ANTIGRAVITY_DESCRIPTOR, scenario, {
      model: 'gemini-3.8-flash',
      max_runtime_sec: 1,
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
      diagnostics: { working_tree_changes: ['peer-note.txt'] },
    });
    expect(envelope.ok === false && envelope.message).toContain(
      'failed with PROVIDER_TIMEOUT',
    );
  });

  it('fails as changed when the checkout cannot be re-checked after the turn', async () => {
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [{ writeFile: { path: '.git/HEAD', content: 'not a ref\n' } }],
    );
    const { envelope } = await runTurn(ANTIGRAVITY_DESCRIPTOR, scenario, {
      model: 'gemini-3.8-flash',
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
    });
    expect(envelope.ok === false && envelope.message).toMatch(
      /could not be re-checked/,
    );
  });

  it('redacts a credential in the changed paths it reports', async () => {
    const secret = 'zq-literal-credential-4711';
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [{ writeFile: { path: `${secret}.txt`, content: 'x\n' } }],
    );
    const { envelope } = await runTurn(
      { ...ANTIGRAVITY_DESCRIPTOR, api_key: undefined },
      scenario,
      { model: 'gemini-3.8-flash' },
      { parentEnv: { GEMINI_API_KEY: secret } },
    );

    expect(envelope).toMatchObject({
      code: 'PROVIDER_WORKTREE_CHANGED',
      diagnostics: { working_tree_changes: ['<redacted>.txt'] },
    });
    expect(envelope.ok === false && envelope.message).toContain(
      'run: <redacted>.txt.',
    );
    expect(JSON.stringify(envelope)).not.toContain(secret);
  });

  // Stands in for a cleanup that rejects after the turn, such as removing the
  // private settings directory.
  const failingCleanup: AcpTransport = {
    async run(input) {
      await stdioAcpTransport.run(input);
      throw new Error('cleanup failed');
    },
  };

  it('fails as changed, keeping the error, when a run that wrote a file then throws', async () => {
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [{ writeFile: { path: 'peer-note.txt', content: 'written\n' } }],
    );
    const { envelope } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.8-flash' },
      { transport: failingCleanup },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
      attempts: { terminal_reason: 'working_tree_changed' },
      diagnostics: {
        working_tree_changes: ['peer-note.txt'],
        warnings: ['The run failed: cleanup failed'],
      },
      continuation: { turn: 'unknown' },
    });
    expect(envelope.ok === false && envelope.message).toContain(
      'the run failed: cleanup failed.',
    );
  });

  it('lets the error through when a run that changed nothing throws', async () => {
    await expect(
      runTurn(
        ANTIGRAVITY_DESCRIPTOR,
        await agySession(),
        { model: 'gemini-3.8-flash' },
        { transport: failingCleanup },
      ),
    ).rejects.toThrow('cleanup failed');
  });

  it('keeps the run error, naming the cleanup failure, when both fail', async () => {
    // Throws after making the private settings directory unremovable.
    const failingRunAndCleanup: AcpTransport = {
      async run(input) {
        const flag = input.argv.find((arg) => arg.startsWith('--gemini-dir='));
        if (!flag) throw new Error('expected a private settings directory');
        const locked = path.join(flag.slice('--gemini-dir='.length), 'config');
        cleanup.push(async () => {
          await chmod(locked, 0o700);
          await rm(path.dirname(locked), { recursive: true, force: true });
        });
        await chmod(locked, 0o500);
        throw new Error('run failed');
      },
    };
    const error = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      { model: 'gemini-3.8-flash' },
      {
        transport: failingRunAndCleanup,
        parentEnv: { GEMINI_API_KEY: 'test-api-key-value' },
      },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /^run failed \(removing the private settings directory also failed: EACCES/,
    );
    // The cause would carry the unredacted text.
    expect((error as Error).cause).toBeUndefined();
  });

  it('keeps the teardown warning when the private settings directory cannot be removed', async () => {
    // Returns an unsettled outcome after making the private settings directory
    // unremovable.
    const unsettledAndLocked: AcpTransport = {
      async run(input) {
        const flag = input.argv.find((arg) => arg.startsWith('--gemini-dir='));
        if (!flag) throw new Error('expected a private settings directory');
        const locked = path.join(flag.slice('--gemini-dir='.length), 'config');
        cleanup.push(async () => {
          await chmod(locked, 0o700);
          await rm(path.dirname(locked), { recursive: true, force: true });
        });
        await chmod(locked, 0o500);
        // The recorded session has no authenticate step.
        const { authenticate: _authenticate, ...plan } = input.plan;
        const outcome = await stdioAcpTransport.run({ ...input, plan });
        return {
          ...outcome,
          teardown: {
            scope: 'process_group',
            exited_before_signal: false,
            signals: ['SIGTERM', 'SIGKILL'],
            settled_by: 'settlement_timeout',
          },
        };
      },
    };
    const scenario = insertAfter(
      await agySession(),
      expects('session/prompt'),
      [{ writeFile: { path: 'peer-note.txt', content: 'written\n' } }],
    );
    const { envelope } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.8-flash' },
      {
        transport: unsettledAndLocked,
        parentEnv: { GEMINI_API_KEY: 'test-api-key-value' },
      },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_WORKTREE_CHANGED',
      diagnostics: { working_tree_changes: ['peer-note.txt'] },
    });
    expect(envelope.diagnostics?.warnings).toEqual([
      expect.stringMatching(
        /^The run failed: EACCES.*The agent's process group was still present after SIGKILL; the post-run working-tree check could not confirm the group had exited\.$/,
      ),
    ]);
  });

  it('succeeds with a warning when teardown could not confirm the group exited', async () => {
    const unsettled: AcpTransport = {
      async run(input) {
        const outcome = await stdioAcpTransport.run(input);
        return {
          ...outcome,
          teardown: {
            scope: 'process_group',
            exited_before_signal: false,
            signals: ['SIGTERM', 'SIGKILL'],
            settled_by: 'settlement_timeout',
          },
        };
      },
    };
    const { envelope } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      { model: 'gemini-3.8-flash' },
      { transport: unsettled },
    );

    expect(envelope).toMatchObject({
      ok: true,
      diagnostics: {
        warnings: [
          "The agent's process group was still present after SIGKILL; the post-run working-tree check could not confirm the group had exited.",
        ],
        acp: { teardown: { settled_by: 'settlement_timeout' } },
      },
    });
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

  it.each<[string, Partial<ConsensusCliRunRequest>, string]>([
    [
      'an omitted policy (non-interactive)',
      { runtime_policy: undefined },
      'runtime_policy.permission_mode',
    ],
    [
      'workspace-write',
      { runtime_policy: { permission_mode: 'workspace-write' } },
      'runtime_policy.permission_mode',
    ],
    [
      'a sandbox',
      {
        runtime_policy: { permission_mode: 'read-only', sandbox: 'read-only' },
      },
      'runtime_policy.sandbox',
    ],
    [
      'an env allowlist',
      {
        runtime_policy: {
          permission_mode: 'read-only',
          env_allowlist: ['GITHUB_TOKEN'],
        },
      },
      'runtime_policy.env_allowlist',
    ],
    ['an effort', { effort: 'high' }, 'effort'],
    [
      'JSON output',
      { output: 'json', schema_path: 'SCHEMA' },
      'structured_output_strategy',
    ],
  ])('refuses %s before launch', async (_label, overrides, terminalReason) => {
    const schemaDir = await tempDir('consensus-acp-schema-');
    const schemaPath = path.join(schemaDir, 'schema.json');
    await writeFile(schemaPath, '{"type":"object"}');
    const { envelope, harness } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      {
        model: 'gemini-3.8-flash',
        ...overrides,
        ...(overrides.schema_path ? { schema_path: schemaPath } : {}),
      },
    );

    expect(harness.launches).toEqual([]);
    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      attempts: { cli_attempts: 0, terminal_reason: terminalReason },
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
    expect(envelope.ok === false && envelope.message).toBe(
      'antigravity needs a model: pass --model or set defaults.provider_models.antigravity.',
    );
  });

  it('runs the configured default model and reports it apart from the requested one', async () => {
    const { envelope, harness } = await runTurn(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      {},
      {
        userConfig: {
          schema_version: 'v1',
          defaults: { provider_models: { antigravity: 'gemini-3.8-flash' } },
        },
      },
    );

    expect(harness.launches).toHaveLength(1);
    expect(envelope.ok).toBe(true);
    expect(envelope.continuation).toMatchObject({
      default_model: 'gemini-3.8-flash',
      observed_models: ['gemini-3.8-flash'],
    });
    expect(envelope.continuation).not.toHaveProperty('requested_model');
  });
});

describe('extended runs through consensus run --request-json', () => {
  async function runCli(
    descriptor: AcpProviderDescriptor,
    scenario: Scenario,
    request: Record<string, unknown>,
    projectConfig?: unknown,
    options: SetupOptions = {},
  ) {
    const { harness, cwd, parentEnv, registry } = await setup(
      descriptor,
      scenario,
      options,
    );
    if (projectConfig) {
      // Committed, so the checkout is clean apart from what the peer does.
      await mkdir(path.join(cwd, '.consensus'));
      await writeFile(
        path.join(cwd, '.consensus', 'config.json'),
        JSON.stringify(projectConfig),
      );
      git(cwd, 'add', '.');
      git(cwd, 'commit', '-q', '-m', 'config');
    }
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
    let stderr = '';
    const code = await runConsensusCli(
      ['run', '--request-json', requestPath, '--json'],
      {
        stdout: { write: (chunk: unknown) => (stdout += String(chunk)) },
        stderr: { write: (chunk: unknown) => (stderr += String(chunk)) },
        stdin: process.stdin,
        cwd,
        env: parentEnv,
        readFile: (file) => readFile(file, 'utf8'),
        readStdin: () => Promise.reject(new Error('no stdin')),
      },
      { adapters: registry },
    );
    return {
      code,
      envelope: stdout === '' ? undefined : JSON.parse(stdout),
      stderr,
      harness,
    };
  }

  it('redacts a cleanup error it prints when the checkout is unchanged', async () => {
    const secret = 'zq-literal-credential-4711';
    // Leaves an unremovable directory named after the key in the private
    // settings home, then throws.
    const failingRunAndCleanup: AcpTransport = {
      async run(input) {
        const flag = input.argv.find((arg) => arg.startsWith('--gemini-dir='));
        if (!flag) throw new Error('expected a private settings directory');
        const locked = path.join(flag.slice('--gemini-dir='.length), secret);
        await mkdir(locked);
        await writeFile(path.join(locked, 'note.txt'), 'x\n');
        cleanup.push(async () => {
          await chmod(locked, 0o700);
          await rm(path.dirname(locked), { recursive: true, force: true });
        });
        await chmod(locked, 0o500);
        throw new Error('run failed');
      },
    };
    const { code, envelope, stderr } = await runCli(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      { model: 'gemini-3.8-flash' },
      undefined,
      {
        transport: failingRunAndCleanup,
        parentEnv: { GEMINI_API_KEY: secret },
      },
    );

    expect(code).toBe(1);
    expect(envelope).toBeUndefined();
    expect(stderr).toMatch(
      /^run failed \(removing the private settings directory also failed: EACCES.*<redacted>/,
    );
    expect(stderr).not.toContain(secret);
  });

  it('runs a registry adapter on the project default model and returns the text envelope', async () => {
    const { code, envelope } = await runCli(
      ANTIGRAVITY_DESCRIPTOR,
      await agySession(),
      {},
      {
        schema_version: 'v1',
        defaults: { provider_models: { antigravity: 'gemini-3.8-flash' } },
      },
    );

    expect(code).toBe(0);
    expect(envelope).toMatchObject({
      ok: true,
      text: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
      continuation: { default_model: 'gemini-3.8-flash' },
    });
  });
});
