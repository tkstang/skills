// Each descriptor's session plan against the sanitized spike frames it was
// written from, driven through the adapter's own run hook and read back
// through its hooks. Envelope mapping is covered in run-path.test.ts.
import { existsSync, readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import type { ProviderAdapter } from '../adapters.js';
import type { ProviderProcessResult } from '../subprocess.js';
import type { ConsensusCliRunRequest } from '../types.js';
import { ACP_READ_ONLY_BRIEF_LINE, acpAdapter } from './adapter.js';
import type { AcpProviderDescriptor } from './descriptors.js';
import {
  ANTIGRAVITY_DESCRIPTOR,
  DROID_DESCRIPTOR,
  GEMINI_DESCRIPTOR,
} from './descriptors.js';
import type {
  FakeAgentHarness,
  FakeAgentLaunch,
  Scenario,
} from './test-helpers.js';
import {
  acpFixture,
  cutAfter,
  dropSteps,
  expects,
  FAST_ACP_TIMING,
  fakeAgentHarness,
} from './test-helpers.js';

const harnesses: FakeAgentHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.cleanup()));
});

const FAKE_GEMINI_KEY = 'AIzaFAKEFAKEFAKEFAKEFAKEFAKEFAKE00';

async function runDescriptor(
  descriptor: AcpProviderDescriptor,
  scenario: Scenario,
  request: Partial<ConsensusCliRunRequest>,
  options: {
    env?: NodeJS.ProcessEnv;
    onLaunch?: (launch: FakeAgentLaunch) => void;
  } = {},
) {
  const harness = await fakeAgentHarness(scenario, {
    onLaunch: options.onLaunch,
  });
  harnesses.push(harness);
  const adapter: ProviderAdapter = acpAdapter(descriptor, {
    spawn: harness.spawn,
    timing: FAST_ACP_TIMING,
  });
  const invocation = adapter.buildInvocation(
    {
      schema_version: 'v1',
      provider: descriptor.id,
      output: 'text',
      prompt: 'Reply with the marker.',
      cwd: harness.dir,
      runtime_policy: { permission_mode: 'read-only' },
      ...request,
    },
    { executable: `/usr/local/bin/${descriptor.executable}` },
  );
  const result = await adapter.run!(invocation, {
    env: { PATH: process.env.PATH, ...options.env },
    timeoutSec: 10,
  });
  expect(result.stderr).not.toContain('scenario mismatch');
  const received = await harness.received();
  return {
    adapter,
    result,
    received,
    methods: received
      .filter((frame) => frame.method)
      .map((frame) => frame.method),
    launch: harness.launches[0],
    prompt: received.find((frame) => frame.method === 'session/prompt')?.params
      .prompt[0].text as string | undefined,
  };
}

function reported(adapter: ProviderAdapter, result: ProviderProcessResult) {
  return result.ok
    ? adapter.classifyReportedFailure?.(result.stdout)
    : adapter.classifyRunFailure(result);
}

describe('Antigravity descriptor', () => {
  // The recorded session set a second option (thought_level) the descriptor
  // does not set.
  const desktopSession = async () =>
    dropSteps(
      await acpFixture('agy-key-default'),
      expects('session/set_config_option'),
      3,
      1,
    );

  it('uses the saved login, confirms default mode without an echo, and sets the model from config', async () => {
    const { adapter, result, methods, received, launch, prompt } =
      await runDescriptor(ANTIGRAVITY_DESCRIPTOR, await desktopSession(), {
        model: 'gemini-3.8-flash',
      });

    expect(launch).toMatchObject({
      executable: '/usr/local/bin/agy',
      argv: ['acp'],
    });
    expect(methods).toEqual([
      'initialize',
      'session/new',
      'session/set_mode',
      'session/set_config_option',
      'session/prompt',
      'session/close',
    ]);
    expect(
      received.find((frame) => frame.method === 'session/set_mode')?.params
        .modeId,
    ).toBe('default');
    expect(
      received.find((frame) => frame.method === 'session/set_config_option')
        ?.params,
    ).toMatchObject({ configId: 'model', value: 'gemini-3.8-flash' });
    expect(prompt).toBe(
      [
        ACP_READ_ONLY_BRIEF_LINE,
        'Do not use invoke_subagent, swarm, run_workflow or schedule.',
        'Reply with the marker.',
      ].join('\n\n'),
    );
    expect(result.ok).toBe(true);
    expect(reported(adapter, result)).toBeUndefined();
    expect(result.diagnostics.acp).toMatchObject({
      agent: { name: 'Antigravity ACP Server', version: '1.5.13' },
      auth: 'existing_login',
      setup: [
        { step: 'mode', value: 'default', evidence: 'initial_state' },
        { step: 'config_option', id: 'model', evidence: 'response' },
      ],
      session_closed: true,
    });
    // The joined currentModelId (gemini-3.8-flash-high) is the session's
    // starting model, not the one set.
    expect(adapter.extractSession(result.stdout)).toEqual({
      session_id: 'd1dc1bef-c052-4b55-a232-505704b45765',
      observed_models: ['gemini-3.8-flash'],
    });
  });

  it('refuses a model agy does not offer before setting anything', async () => {
    const scenario = cutAfter(
      await desktopSession(),
      (step) =>
        'respond' in step && JSON.stringify(step).includes('"sessionId"'),
      [
        { expect: 'session/set_mode' },
        { respond: { result: {} } },
        { expect: 'session/close' },
        { respond: { result: {} } },
      ],
    );
    const { adapter, result, methods } = await runDescriptor(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gpt-9' },
    );

    expect(methods).not.toContain('session/set_config_option');
    expect(reported(adapter, result)).toMatchObject({
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      turn: 'not_started',
    });
  });

  it('authenticates with an API key against a private settings directory, removed afterwards, and reports a 429 in the text as a limit', async () => {
    const scenario = dropSteps(
      await acpFixture('agy-key2-default'),
      expects('session/set_config_option'),
      3,
      1,
    );
    let privateHome: string | undefined;
    let settingsAtLaunch: string[] = [];
    const { adapter, result, methods, received, launch } = await runDescriptor(
      ANTIGRAVITY_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.1-pro' },
      {
        env: { GEMINI_API_KEY: FAKE_GEMINI_KEY },
        onLaunch: (requested) => {
          privateHome = requested.argv
            .find((arg) => arg.startsWith('--gemini-dir='))
            ?.slice('--gemini-dir='.length);
          settingsAtLaunch = [
            'antigravity-cli/settings.json',
            'config/settings.json',
          ].map((file) => readFileSync(`${privateHome}/${file}`, 'utf8'));
        },
      },
    );

    expect(launch.argv).toEqual([
      'acp',
      `--gemini-dir=${privateHome}`,
      '--app-data-dir=consensus-agy',
    ]);
    expect(privateHome).toMatch(/consensus-antigravity-/);
    expect(settingsAtLaunch.map((text) => JSON.parse(text))).toEqual([
      { modelProvider: 'gemini' },
      { modelProvider: 'gemini' },
    ]);
    expect(existsSync(privateHome!)).toBe(false);
    expect(methods.slice(0, 3)).toEqual([
      'initialize',
      'authenticate',
      'session/new',
    ]);
    expect(
      received.find((frame) => frame.method === 'authenticate')?.params,
    ).toEqual({ methodId: 'gemini-api-key' });
    expect(result.diagnostics.acp?.auth).toBe('api_key');
    expect(reported(adapter, result)).toMatchObject({
      code: 'PROVIDER_LIMIT_REACHED',
      turn: 'completed',
    });
  });
});

describe('Gemini CLI descriptor', () => {
  it('passes the model at launch, confirms it and plan mode by its marker, and reads the usage model', async () => {
    const { adapter, result, methods, launch } = await runDescriptor(
      GEMINI_DESCRIPTOR,
      await acpFixture('gem-planset-write-nocaps'),
      { model: 'gemini-3.5-flash-lite' },
      { env: { GEMINI_API_KEY: FAKE_GEMINI_KEY } },
    );

    expect(launch.argv).toEqual(['--acp', '-m', 'gemini-3.5-flash-lite']);
    expect(methods).toEqual([
      'initialize',
      'authenticate',
      'session/new',
      'session/set_mode',
      'session/prompt',
    ]);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.acp?.setup).toEqual([
      expect.objectContaining({ step: 'model_state', confirmed: true }),
      expect.objectContaining({ step: 'mode', evidence: 'marker' }),
    ]);
    const extracted = adapter.extractText!(
      adapter.buildInvocation({
        schema_version: 'v1',
        provider: 'gemini',
        prompt: '',
      }),
      result as Extract<ProviderProcessResult, { ok: true }>,
    );
    expect(extracted.ok && extracted.text).toMatch(/^I am currently operating/);
    expect(adapter.extractSession(result.stdout).observed_models).toEqual([
      'gemini-3.5-flash-lite',
    ]);
  });

  it('stops before the prompt when the session starts on another model', async () => {
    const scenario = cutAfter(
      await acpFixture('gem-planset-write-nocaps'),
      (step) =>
        'respond' in step && JSON.stringify(step).includes('"sessionId"'),
      [],
    );
    const { adapter, result, methods } = await runDescriptor(
      GEMINI_DESCRIPTOR,
      scenario,
      { model: 'gemini-3.1-pro-preview' },
      { env: { GEMINI_API_KEY: FAKE_GEMINI_KEY } },
    );

    expect(methods).toEqual(['initialize', 'authenticate', 'session/new']);
    expect(reported(adapter, result)).toMatchObject({
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      turn: 'not_started',
    });
  });
});

describe('Droid descriptor', () => {
  it('confirms normal mode from its echo and the model from the set_config_option response', async () => {
    const scenario = cutAfter(
      await acpFixture('droid-kill'),
      expects('session/prompt'),
      [
        {
          send: {
            method: 'session/update',
            params: {
              sessionId: '3a66071b-f102-48ca-b1e6-907051f6ce38',
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: 'Version control history.' },
              },
            },
          },
        },
        { respond: { result: { stopReason: 'end_turn' } } },
        { expect: 'session/close' },
        { respond: { result: {} } },
      ],
    );
    const { adapter, result, launch, prompt } = await runDescriptor(
      DROID_DESCRIPTOR,
      scenario,
      { model: 'custom:GPT-6-Luna-(Proxy)-0' },
    );

    expect(launch.argv).toEqual(['exec', '--output-format', 'acp']);
    expect(prompt).toContain(
      'Do not use loop, ConnectApp, automation, or cloud/computer tools.',
    );
    expect(result.ok).toBe(true);
    expect(result.diagnostics.acp?.setup).toEqual([
      expect.objectContaining({
        step: 'mode',
        value: 'normal',
        evidence: 'current_mode_update',
      }),
      expect.objectContaining({ id: 'model', evidence: 'response' }),
    ]);
    expect(adapter.extractSession(result.stdout).observed_models).toEqual([
      'custom:GPT-6-Luna-(Proxy)-0',
    ]);
  });

  it('reports a pairing-code auth error as auth required without the code', async () => {
    const { adapter, result } = await runDescriptor(
      DROID_DESCRIPTOR,
      await acpFixture('authchk-droid'),
      { model: 'custom:GPT-6-Luna-(Proxy)-0' },
    );

    const classification = reported(adapter, result);
    expect(classification).toMatchObject({
      code: 'PROVIDER_AUTH_REQUIRED',
      turn: 'not_started',
    });
    expect(classification?.message).toContain('set FACTORY_API_KEY');
    expect(classification?.message).toContain('Your code: <redacted>');
    expect(JSON.stringify(result)).not.toContain('QZXW-7342');
  });
});
