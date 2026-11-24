import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { fixtureBin } from '../../../../../tests/helpers/process.mjs';
import type { AcpRunOutcome, AcpSessionPlan } from './client.js';
import { runAcpTurn } from './client.js';
import type { SpawnProcessGroup } from './process.js';
import { spawnProcessGroup } from './process.js';
import { classifyAcpTurn, serializeAcpTurnResult } from './transcript.js';

// Scenarios replay sanitized frames from the ACP spike logs (see each
// fixture's `source`); a few are derived from them or built inline.
const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);
const fakeAgent = path.join(fixtureBin, 'fake-acp-agent');
const FAST_TIMING = {
  cancelGraceMs: 300,
  closeTimeoutMs: 300,
  exitGraceMs: 500,
  killGraceMs: 200,
  settleMs: 1000,
};

interface Scenario {
  source?: unknown;
  onStdinEnd?: 'exit' | 'ignore';
  ignoreSigterm?: boolean;
  steps: Record<string, unknown>[];
}

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function fixture(name: string): Promise<Scenario> {
  return JSON.parse(
    await readFile(path.join(fixtureDir, `${name}.json`), 'utf8'),
  );
}

// Keeps the steps up to and including the first matching one, then ends the
// session with a close round trip.
function cutAfter(
  scenario: Scenario,
  matches: (step: Record<string, unknown>, index: number) => boolean,
  tail: Record<string, unknown>[] = [
    { expect: 'session/close' },
    { respond: { result: {} } },
  ],
): Scenario {
  const index = scenario.steps.findIndex(matches);
  if (index === -1) throw new Error('cut point not found');
  return {
    ...scenario,
    steps: [...scenario.steps.slice(0, index + 1), ...tail],
  };
}

function nthIndex(
  predicate: (step: Record<string, unknown>) => boolean,
  n: number,
) {
  let seen = 0;
  return (step: Record<string, unknown>) => predicate(step) && ++seen === n;
}

async function run(
  scenario: Scenario,
  plan: Partial<AcpSessionPlan> = {},
  options: {
    timeoutMs?: number;
    maxOutputBytes?: number;
    env?: NodeJS.ProcessEnv;
    wrapSpawn?: (spawn: SpawnProcessGroup) => SpawnProcessGroup;
  } = {},
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'consensus-acp-'));
  cleanup.push(dir);
  const scenarioPath = path.join(dir, 'scenario.json');
  const receivedLog = path.join(dir, 'received.jsonl');
  const pidFile = path.join(dir, 'grandchild.pid');
  await writeFile(scenarioPath, JSON.stringify(scenario));
  const started = Date.now();
  const outcome = await runAcpTurn({
    executable: process.execPath,
    argv: [fakeAgent, scenarioPath],
    cwd: dir,
    env: {
      PATH: process.env.PATH,
      FAKE_ACP_RECEIVED_LOG: receivedLog,
      FAKE_ACP_PID_FILE: pidFile,
      ...options.env,
    },
    prompt: 'Reply with the marker.',
    plan: { clientInfo: { name: 'consensus', version: '0' }, ...plan },
    timeoutMs: options.timeoutMs ?? 10_000,
    maxOutputBytes: options.maxOutputBytes,
    timing: FAST_TIMING,
    ...(options.wrapSpawn
      ? { spawn: options.wrapSpawn(spawnProcessGroup) }
      : {}),
  });
  const received = (await readFile(receivedLog, 'utf8').catch(() => ''))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
  return {
    outcome,
    received,
    methods: received
      .filter((frame) => frame.method)
      .map((frame) => frame.method),
    responses: received.filter((frame) => !frame.method),
    dir,
    pidFile,
    elapsedMs: Date.now() - started,
  };
}

function expectNoMismatch(outcome: AcpRunOutcome) {
  expect(outcome.stderr).not.toContain('scenario mismatch');
}

const AGY_MODE = {
  modeId: 'default',
  confirm: { initialState: true, currentModeUpdate: true },
};
const AGY_CONFIG = [
  { configId: 'model', value: 'gemini-3.8-flash', requireAdvertised: true },
  { configId: 'thought_level', value: 'low' },
];
const AGY_SESSION = 'd1dc1bef-c052-4b55-a232-505704b45765';

function notificationLine(method: string, params: unknown) {
  return JSON.stringify({ jsonrpc: '2.0', method, params });
}

function modeUpdate(sessionId: string, currentModeId: string) {
  return notificationLine('session/update', {
    sessionId,
    update: { sessionUpdate: 'current_mode_update', currentModeId },
  });
}

// Runs the recorded agy session with the given lines delivered right before
// and right after the session/new response, before the driver's await
// resumes, as one stdout chunk carrying them all would.
async function runWithEarlyUpdates(
  early: { before?: string[]; after?: string[] },
  options: {
    cutAtResponse?: number;
    tail?: Record<string, unknown>[];
    configOptions?: AcpSessionPlan['configOptions'];
  } = {},
) {
  const scenario = cutAfter(
    await fixture('agy-key-default'),
    nthIndex((step) => 'respond' in step, options.cutAtResponse ?? 3),
    options.tail,
  );
  return run(
    scenario,
    { mode: AGY_MODE, configOptions: options.configOptions ?? AGY_CONFIG },
    {
      wrapSpawn: (spawn) => (spawnOptions) =>
        spawn({
          ...spawnOptions,
          onLine: (line) => {
            const created = JSON.parse(line).result?.sessionId === AGY_SESSION;
            if (created) early.before?.forEach(spawnOptions.onLine);
            spawnOptions.onLine(line);
            if (created) early.after?.forEach(spawnOptions.onLine);
          },
        }),
    },
  );
}

const DROID_MODE = {
  modeId: 'normal',
  confirm: { currentModeUpdate: true, configOptionId: 'autonomy_level' },
};

describe('ACP session driver', () => {
  it('runs setup, confirms each step, answers, and closes the session (agy)', async () => {
    const { outcome, received, methods } = await run(
      await fixture('agy-key-default'),
      {
        mode: AGY_MODE,
        configOptions: AGY_CONFIG,
        briefLines: ['This is a read-only run.'],
      },
    );

    expectNoMismatch(outcome);
    expect(methods).toEqual([
      'initialize',
      'session/new',
      'session/set_mode',
      'session/set_config_option',
      'session/set_config_option',
      'session/prompt',
      'session/close',
    ]);
    expect(received[0].params).toEqual({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo: { name: 'consensus', version: '0' },
    });
    expect(received[1].params.mcpServers).toEqual([]);
    expect(received[5].params.prompt[0].text).toBe(
      'This is a read-only run.\n\nReply with the marker.',
    );
    expect(outcome.result).toMatchObject({
      agent: { name: 'Antigravity ACP Server', version: '1.5.13' },
      session_id: 'd1dc1bef-c052-4b55-a232-505704b45765',
      phase: 'complete',
      stop_reason: 'end_turn',
      text: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
      models: {
        current_model_id: 'gemini-3.8-flash-high',
        config_model: 'gemini-3.8-flash',
      },
      setup: [
        {
          step: 'mode',
          value: 'default',
          confirmed: true,
          evidence: 'initial_state',
        },
        {
          step: 'config_option',
          id: 'model',
          confirmed: true,
          evidence: 'response',
        },
        { step: 'config_option', id: 'thought_level', confirmed: true },
      ],
      usage: { totalTokens: 17909 },
      session_closed: true,
    });
    expect(classifyAcpTurn(outcome.result)).toEqual({
      ok: true,
      text: 'marker-85b2d6a11e65\nGemini 3.8 Flash',
      warnings: [],
    });
  });

  it('takes the Gemini plan-mode marker as mode evidence and keeps it out of the answer', async () => {
    const { outcome, methods } = await run(
      await fixture('gem-planset-write-nocaps'),
      {
        authenticate: { methodId: 'gemini-api-key' },
        mode: {
          modeId: 'plan',
          confirm: { marker: '[MODE_UPDATE] plan', currentModeUpdate: true },
        },
        expectCurrentModel: 'gemini-3.5-flash-lite',
      },
    );

    expectNoMismatch(outcome);
    // No sessionCapabilities.close, so no session/close.
    expect(methods).toEqual([
      'initialize',
      'authenticate',
      'session/new',
      'session/set_mode',
      'session/prompt',
    ]);
    expect(outcome.result.setup).toEqual([
      {
        step: 'model_state',
        id: 'currentModelId',
        value: 'gemini-3.5-flash-lite',
        confirmed: true,
        evidence: 'session_state',
      },
      {
        step: 'mode',
        id: 'mode',
        value: 'plan',
        confirmed: true,
        evidence: 'marker',
      },
    ]);
    expect(outcome.result.text).not.toContain('[MODE_UPDATE]');
    expect(
      outcome.result.text.startsWith(
        'I am currently operating in **Plan Mode**',
      ),
    ).toBe(true);
    expect(outcome.result.models.usage_models).toEqual([
      'gemini-3.5-flash-lite',
    ]);
    expect(classifyAcpTurn(outcome.result).ok).toBe(true);
  });

  it('fails the turn as permission denied when a denial leaves no answer (agy, string request id)', async () => {
    const { outcome, responses } = await run(
      await fixture('agy-gui-write-nocaps'),
    );

    expectNoMismatch(outcome);
    // agy's request id is the string "1"; the reply must echo it as a string.
    expect(responses).toEqual([
      {
        jsonrpc: '2.0',
        id: '1',
        result: { outcome: { outcome: 'selected', optionId: 'deny' } },
      },
    ]);
    expect(outcome.result.denials).toEqual([
      {
        tool: 'write_file',
        kind: 'edit',
        // Outside the run's cwd, so kept as reported.
        path: '/home/user/acp-spike/fixture/probe-write.txt',
        outcome: 'rejected',
      },
    ]);
    expect(classifyAcpTurn(outcome.result)).toMatchObject({
      ok: false,
      code: 'PROVIDER_PERMISSION_DENIED',
      turn: 'completed',
    });
  });

  it('accepts an answer after denials and reports them (Gemini, request ids 0 and 1)', async () => {
    const { outcome, responses } = await run(
      await fixture('gem-default-write-nocaps'),
      {
        authenticate: { methodId: 'gemini-api-key' },
      },
    );

    expectNoMismatch(outcome);
    expect(
      responses.map((frame) => [frame.id, frame.result.outcome.optionId]),
    ).toEqual([
      [0, 'cancel'],
      [1, 'cancel'],
    ]);
    expect(outcome.result.denials.map((denial) => denial.tool)).toEqual([
      'Writing to probe-write.txt',
      'touch probe-shell.txt',
    ]);
    const classification = classifyAcpTurn(outcome.result, {
      displayName: 'Gemini CLI',
    });
    expect(classification).toMatchObject({ ok: true });
    expect(classification.ok && classification.warnings).toEqual([
      'Gemini CLI asked for 2 tool permission(s) outside read-only; all were denied (Writing to probe-write.txt, touch probe-shell.txt).',
    ]);
  });

  it('fails as permission denied when the agent cancels the turn after a denial (Droid)', async () => {
    const { outcome, responses } = await run(
      await fixture('droid-gui-normal-write-nocaps'),
      {
        mode: DROID_MODE,
      },
    );

    expectNoMismatch(outcome);
    expect(responses).toEqual([
      {
        jsonrpc: '2.0',
        id: 0,
        result: { outcome: { outcome: 'selected', optionId: 'cancel' } },
      },
    ]);
    expect(outcome.result).toMatchObject({
      setup: [
        {
          step: 'mode',
          value: 'normal',
          confirmed: true,
          evidence: 'current_mode_update',
        },
      ],
      stop_reason: 'cancelled',
      text: '',
      session_closed: true,
    });
    expect(classifyAcpTurn(outcome.result)).toMatchObject({
      ok: false,
      code: 'PROVIDER_PERMISSION_DENIED',
    });
    // The denied command's rawInput never reaches the serialized result.
    const serialized = serializeAcpTurnResult(outcome.result);
    expect(serialized).not.toContain('rawInput');
    expect(serialized).not.toContain('riskLevel');
  });

  it('refuses fs/* requests with -32601 and records the method', async () => {
    const { outcome, responses } = await run(
      await fixture('gem-default-write-caps'),
      {
        authenticate: { methodId: 'gemini-api-key' },
      },
    );

    expectNoMismatch(outcome);
    expect(responses.slice(0, 2)).toEqual([
      {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32601,
          message: 'Method not found',
          data: { method: 'fs/read_text_file' },
        },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found',
          data: { method: 'fs/read_text_file' },
        },
      },
    ]);
    expect(outcome.result.refused_methods).toEqual(['fs/read_text_file']);
  });

  it('maps -32000 at session/new to auth required with the pairing code redacted (Droid)', async () => {
    const { outcome, methods } = await run(await fixture('authchk-droid'), {
      redactions: [/Your code: [A-Z0-9]{4}-[A-Z0-9]{4}/],
    });

    expectNoMismatch(outcome);
    expect(methods).toEqual(['initialize', 'session/new']);
    expect(outcome.result.error).toMatchObject({
      phase: 'session_new',
      kind: 'jsonrpc',
      code: -32000,
    });
    const classification = classifyAcpTurn(outcome.result, {
      displayName: 'Droid',
      authHint:
        'Sign in with droid from a desktop terminal, or set FACTORY_API_KEY.',
    });
    expect(classification).toMatchObject({
      ok: false,
      code: 'PROVIDER_AUTH_REQUIRED',
      turn: 'not_started',
    });
    expect(serializeAcpTurnResult(outcome.result)).not.toContain('QZXW-7342');
    expect(classification.ok === false && classification.message).not.toContain(
      'QZXW-7342',
    );
  });

  it('maps a descriptor auth pattern at authenticate to auth required (agy "No browser")', async () => {
    const { outcome } = await run(await fixture('agy-init2'), {
      authenticate: { methodId: 'oauth-personal' },
    });

    expect(outcome.result.error).toMatchObject({
      phase: 'authenticate',
      code: -32603,
    });
    expect(classifyAcpTurn(outcome.result)).toMatchObject({
      code: 'PROVIDER_EXIT',
    });
    expect(
      classifyAcpTurn(outcome.result, {
        authErrorPatterns: [/No browser is available/],
      }),
    ).toMatchObject({ code: 'PROVIDER_AUTH_REQUIRED', turn: 'not_started' });
  });

  it('stops before the prompt when the mode change is not confirmed', async () => {
    // agy answers set_mode with {} and no echo; a plan that needs an echo
    // cannot confirm it.
    const scenario = cutAfter(
      await fixture('agy-key-default'),
      nthIndex((step) => 'respond' in step, 3),
    );
    const { outcome, methods } = await run(scenario, {
      mode: { modeId: 'default', confirm: { currentModeUpdate: true } },
      configOptions: AGY_CONFIG,
    });

    expectNoMismatch(outcome);
    expect(methods).toEqual([
      'initialize',
      'session/new',
      'session/set_mode',
      'session/close',
    ]);
    expect(outcome.result).toMatchObject({
      prompt_sent: false,
      setup: [{ step: 'mode', confirmed: false }],
      error: { phase: 'setup', kind: 'unconfirmed_setup' },
    });
    expect(classifyAcpTurn(outcome.result)).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      turn: 'not_started',
    });
  });

  it('does not confirm the starting mode when a contrary report shares the session/new chunk (agy)', async () => {
    const { outcome, methods } = await runWithEarlyUpdates({
      after: [modeUpdate(AGY_SESSION, 'accept-edits')],
    });

    expectNoMismatch(outcome);
    expect(methods).toEqual([
      'initialize',
      'session/new',
      'session/set_mode',
      'session/close',
    ]);
    expect(outcome.result).toMatchObject({
      prompt_sent: false,
      setup: [{ step: 'mode', confirmed: false }],
      error: { phase: 'setup', kind: 'unconfirmed_setup' },
    });
  });

  it('keeps an early contrary mode report when a malformed one follows it (agy)', async () => {
    const malformed = notificationLine('session/update', {
      sessionId: AGY_SESSION,
      update: { sessionUpdate: 'current_mode_update' },
    });
    const { outcome, methods } = await runWithEarlyUpdates({
      after: [modeUpdate(AGY_SESSION, 'accept-edits'), malformed],
    });

    expectNoMismatch(outcome);
    expect(methods).not.toContain('session/set_config_option');
    expect(outcome.result).toMatchObject({
      prompt_sent: false,
      setup: [{ step: 'mode', confirmed: false }],
      error: { phase: 'setup', kind: 'unconfirmed_setup' },
    });
  });

  it('leaves the starting mode unknown when early reports overflow the buffer (agy)', async () => {
    // Reports for four other sessions fill the buffer, so the contrary
    // report for the created session cannot be kept.
    const others = ['s1', 's2', 's3', 's4'].map((id) =>
      modeUpdate(id, 'default'),
    );
    const { outcome, methods } = await runWithEarlyUpdates({
      before: [...others, modeUpdate(AGY_SESSION, 'accept-edits')],
    });

    expectNoMismatch(outcome);
    expect(methods).not.toContain('session/set_config_option');
    expect(outcome.result).toMatchObject({
      prompt_sent: false,
      setup: [{ step: 'mode', confirmed: false }],
      error: { phase: 'setup', kind: 'unconfirmed_setup' },
    });
  });

  it('keeps the session/new config options over an update sent before them (agy)', async () => {
    // The update offers one model; session/new, sent after it, also offers
    // gemini-3.8-flash.
    const older = notificationLine('session/update', {
      sessionId: AGY_SESSION,
      update: {
        sessionUpdate: 'config_option_update',
        configOptions: [
          {
            id: 'model',
            currentValue: 'claude-sonnet-4-6',
            options: [{ value: 'claude-sonnet-4-6' }],
          },
        ],
      },
    });
    const { outcome, methods } = await runWithEarlyUpdates(
      { before: [older] },
      {
        cutAtResponse: 4,
        tail: [
          { expect: 'session/prompt' },
          { respond: { result: { stopReason: 'end_turn' } } },
          { expect: 'session/close' },
          { respond: { result: {} } },
        ],
        configOptions: [AGY_CONFIG[0]],
      },
    );

    expectNoMismatch(outcome);
    expect(methods).toContain('session/set_config_option');
    expect(outcome.result).toMatchObject({
      phase: 'complete',
      setup: [
        { step: 'mode', confirmed: true },
        { step: 'config_option', id: 'model', confirmed: true },
      ],
    });
  });

  it('refuses a model the agent does not offer, listing offered ids, without setting it', async () => {
    const scenario = cutAfter(
      await fixture('agy-key-default'),
      nthIndex((step) => 'respond' in step, 3),
    );
    const { outcome, methods } = await run(scenario, {
      mode: AGY_MODE,
      configOptions: [
        { configId: 'model', value: 'gpt-9', requireAdvertised: true },
      ],
    });

    expectNoMismatch(outcome);
    expect(methods).not.toContain('session/set_config_option');
    expect(outcome.result.error).toEqual({
      phase: 'setup',
      kind: 'unsupported_option',
      message:
        'model gpt-9 is not offered by Antigravity ACP Server (offered: gemini-3.8-flash, claude-sonnet-4-6, claude-opus-4-6-thinking, gpt-oss-120b-medium)',
    });
  });

  it('stops before the prompt when the set_config_option response reports another value', async () => {
    // The recorded response keeps gemini-3.8-flash, so asking for another
    // advertised model is unconfirmed.
    const scenario = cutAfter(
      await fixture('agy-key-default'),
      nthIndex((step) => 'respond' in step, 4),
    );
    const { outcome, methods } = await run(scenario, {
      mode: AGY_MODE,
      configOptions: [
        {
          configId: 'model',
          value: 'claude-sonnet-4-6',
          requireAdvertised: true,
        },
      ],
    });

    expectNoMismatch(outcome);
    expect(methods).not.toContain('session/prompt');
    expect(outcome.result.error).toMatchObject({
      kind: 'unconfirmed_setup',
      message: 'model is gemini-3.8-flash after setting claude-sonnet-4-6',
    });
  });

  it('classifies a quota error that arrives as answer text (agy 429)', async () => {
    const { outcome } = await run(await fixture('agy-key2-default'), {
      authenticate: { methodId: 'gemini-api-key' },
      mode: AGY_MODE,
      configOptions: [
        { configId: 'model', value: 'gemini-3.1-pro', requireAdvertised: true },
        { configId: 'thought_level', value: 'low' },
      ],
    });

    expectNoMismatch(outcome);
    expect(outcome.result.stop_reason).toBe('end_turn');
    expect(
      classifyAcpTurn(outcome.result, {
        errorTextPatterns: [
          {
            pattern: /Error 429|exceeded your current quota/i,
            code: 'PROVIDER_LIMIT_REACHED',
          },
          { pattern: /agent executor error/i, code: 'PROVIDER_EXIT' },
        ],
      }),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_LIMIT_REACHED',
      turn: 'completed',
    });
  });

  it('reports an agent that dies mid-prompt as an exit with the turn unknown (Droid SIGKILL)', async () => {
    const { outcome } = await run(await fixture('droid-kill'), {
      mode: DROID_MODE,
      configOptions: [
        {
          configId: 'model',
          value: 'custom:GPT-6-Luna-(Proxy)-0',
          requireAdvertised: true,
        },
      ],
    });

    expectNoMismatch(outcome);
    expect(outcome.result.setup).toContainEqual({
      step: 'config_option',
      id: 'model',
      value: 'custom:GPT-6-Luna-(Proxy)-0',
      confirmed: true,
      evidence: 'response',
    });
    expect(outcome.signal).toBe('SIGKILL');
    expect(outcome.result.error).toMatchObject({
      phase: 'prompt',
      kind: 'agent_exit',
    });
    expect(classifyAcpTurn(outcome.result)).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      turn: 'unknown',
    });
  });

  describe.skipIf(process.platform === 'win32')('process group', () => {
    it('kills a lingering helper after a clean session', async () => {
      const scenario = await fixture('agy-key-default');
      scenario.steps.unshift({ spawnGrandchild: true });
      const { outcome, pidFile } = await run(scenario, {
        mode: AGY_MODE,
        configOptions: AGY_CONFIG,
      });

      expectNoMismatch(outcome);
      expect(classifyAcpTurn(outcome.result).ok).toBe(true);
      const grandchild = Number(await readFile(pidFile, 'utf8'));
      expect(outcome.teardown).toMatchObject({
        exited_before_signal: true,
        signals: ['SIGTERM', 'SIGKILL'],
        settled_by: 'sigkill',
      });
      expect(await waitForExit(grandchild)).toBe(true);
    });

    it('tears the group down and reports a failure when a stdin write throws', async () => {
      const recorded = await fixture('agy-key-default');
      const scenario = {
        ...recorded,
        onStdinEnd: 'ignore' as const,
        ignoreSigterm: true,
        steps: [{ spawnGrandchild: true }, ...recorded.steps],
      };
      let agentPid: number | undefined;
      const { outcome, pidFile } = await run(
        scenario,
        { mode: AGY_MODE, configOptions: AGY_CONFIG },
        {
          wrapSpawn: (spawn) => async (options) => {
            const spawned = await spawn(options);
            if (!spawned.ok) return spawned;
            const handle = spawned.handle;
            agentPid = handle.pid;
            return {
              ok: true,
              handle: Object.assign(Object.create(handle), {
                write(line: string) {
                  if (line.includes('"session/prompt"')) {
                    throw new Error('EPIPE: broken pipe');
                  }
                  handle.write(line);
                },
              }),
            };
          },
        },
      );

      expect(outcome.result.error).toMatchObject({
        kind: 'client_error',
        message: 'EPIPE: broken pipe',
      });
      expect(classifyAcpTurn(outcome.result)).toMatchObject({
        ok: false,
        code: 'PROVIDER_EXIT',
        terminal_reason: 'acp_client_error',
      });
      expect(outcome.teardown?.signals).toContain('SIGKILL');
      const grandchild = Number(await readFile(pidFile, 'utf8'));
      expect(await waitForExit(agentPid!)).toBe(true);
      expect(await waitForExit(grandchild)).toBe(true);
    });

    it('cancels the prompt on timeout, then kills the group including a grandchild', async () => {
      const recorded = await fixture('agy-key-default');
      const scenario = cutAfter(
        { ...recorded, onStdinEnd: 'ignore', ignoreSigterm: true },
        (step) => step.expect === 'session/prompt',
        [{ spawnGrandchild: true }, { hang: true }],
      );
      const { outcome, received, pidFile, elapsedMs } = await run(
        scenario,
        { mode: AGY_MODE, configOptions: AGY_CONFIG },
        { timeoutMs: 1500 },
      );

      const grandchild = Number(await readFile(pidFile, 'utf8'));
      expect(
        received.slice(-2).map((frame) => [frame.method, frame.params]),
      ).toEqual([
        [
          'session/cancel',
          { sessionId: 'd1dc1bef-c052-4b55-a232-505704b45765' },
        ],
        [
          'session/close',
          { sessionId: 'd1dc1bef-c052-4b55-a232-505704b45765' },
        ],
      ]);
      expect(outcome.result).toMatchObject({
        abort: 'timeout',
        cancel_sent: true,
        prompt_sent: true,
      });
      expect(outcome.teardown).toMatchObject({
        exited_before_signal: false,
        signals: ['SIGTERM', 'SIGKILL'],
        settled_by: 'sigkill',
      });
      expect(await waitForExit(grandchild)).toBe(true);
      expect(classifyAcpTurn(outcome.result)).toMatchObject({
        ok: false,
        code: 'PROVIDER_TIMEOUT',
        turn: 'unknown',
      });
      // Deadline, then bounded cancel, close, exit and kill waits.
      expect(elapsedMs).toBeLessThan(6000);
    });

    it('times out a hung initialize without cancelling, as not started', async () => {
      const { outcome, methods } = await run(
        await fixture('gem-expose2-trusted'),
        {},
        { timeoutMs: 500 },
      );

      expect(methods).toEqual(['initialize']);
      expect(outcome.result).toMatchObject({
        abort: 'timeout',
        prompt_sent: false,
      });
      expect(outcome.result.cancel_sent).toBeUndefined();
      expect(classifyAcpTurn(outcome.result)).toMatchObject({
        code: 'PROVIDER_TIMEOUT',
        turn: 'not_started',
      });
    });
  });

  describe('large frames', () => {
    // One agent_message_chunk far larger than a pipe buffer, with multibyte
    // characters, so it arrives split across reads.
    const bigText = 'é✓'.repeat(60_000);
    const scenario: Scenario = {
      steps: [
        { expect: 'initialize' },
        { respond: { result: { protocolVersion: 1, agentCapabilities: {} } } },
        { expect: 'session/new' },
        { respond: { result: { sessionId: 'large-1' } } },
        { expect: 'session/prompt' },
        {
          send: {
            method: 'session/update',
            params: {
              sessionId: 'large-1',
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: bigText },
              },
            },
          },
        },
        { respond: { result: { stopReason: 'end_turn' } } },
      ],
    };

    it('reassembles a frame split across reads', async () => {
      const { outcome } = await run(scenario);

      expectNoMismatch(outcome);
      expect(outcome.result.text).toBe(bigText);
      expect(outcome.output_bytes.stdout).toBeGreaterThan(300_000);
    });

    it('stops at the overall output cap', async () => {
      const { outcome } = await run(scenario, {}, { maxOutputBytes: 100_000 });

      expect(outcome.result).toMatchObject({
        abort: 'output_cap',
        cancel_sent: true,
      });
      expect(classifyAcpTurn(outcome.result)).toMatchObject({
        code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
        turn: 'unknown',
      });
    });
  });
});

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return !isAlive(pid);
}
