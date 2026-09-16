// Regression coverage for BL-260916: configured peer model/effort must reach
// the outgoing `consensus run` requests, and an invocation `--peers` override
// must not inherit them. Assertions read the provider CLI fixture's recorded
// run calls, so they observe the request that left the wrapper.
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  makeProviderCliEnv,
  parseJsonl,
} from '../../../../tests/helpers/process.mjs';
import { writeConsensusConfig } from '../../../plugins/consensus/config/consensus-config.js';
import type { ConsensusConfigScope } from '../../../plugins/consensus/config/consensus-config.js';
import { runConsensusPlan } from './consensus-plan.js';

type JsonRecord = Record<string, any>;

interface PeerModelContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  callsPath: string;
}

async function withPeerModelContext(
  fn: (context: PeerModelContext) => Promise<void>,
  envOverrides: NodeJS.ProcessEnv = {},
) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-plan-peer-model-'),
  );
  try {
    const cwd = path.join(root, 'project');
    const home = path.join(root, 'home');
    const xdg = path.join(root, 'xdg');
    const callsPath = path.join(root, 'calls.jsonl');
    await Promise.all([
      mkdir(cwd, { recursive: true }),
      mkdir(home, { recursive: true }),
      mkdir(xdg, { recursive: true }),
    ]);

    await fn({
      cwd,
      callsPath,
      env: makeProviderCliEnv({
        HOME: home,
        XDG_CONFIG_HOME: xdg,
        CONSENSUS_STUB_PROVIDERS: 'claude,codex,cursor',
        CONSENSUS_STUB_CALLS_JSONL: callsPath,
        CONSENSUS_STUB_VERDICT: 'CONVERGED',
        ...envOverrides,
      }),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writePeerDefaults(
  context: PeerModelContext,
  scope: ConsensusConfigScope,
  peers: Array<{ provider: string; model?: string; effort?: string }>,
) {
  await writeConsensusConfig({
    scope,
    cwd: context.cwd,
    env: context.env,
    config: { schema_version: 'v1', defaults: { peers } },
  });
}

async function runFixture(
  context: PeerModelContext,
  label: string,
  extraArgv: readonly string[] = [],
) {
  return await runConsensusPlan(
    [
      '--goal',
      'Plan a small release.',
      '--output',
      `${label}.md`,
      '--run-dir',
      `.consensus/${label}`,
      '--allow-root',
      context.cwd,
      '--max-rounds',
      '1',
      '--iteration',
      'parallel_revision',
      ...extraArgv,
    ],
    { cwd: context.cwd, env: context.env },
  );
}

async function peerRunCalls(context: PeerModelContext) {
  const calls = parseJsonl<JsonRecord>(
    await readFile(context.callsPath, 'utf8'),
  );
  return calls.filter((call) => call.event === 'run');
}

it('forwards configured peer model and effort to the provider requests', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'project', [
      { provider: 'claude', model: 'claude-model-x', effort: 'high' },
      { provider: 'codex', model: 'codex-model-x' },
    ]);

    const result = await runFixture(context, 'configured');

    expect(result.peers).toEqual(['claude', 'codex']);
    // `--peers` stays provider-ids-only; the selections ride the lossless JSON
    // `--peer-agents` transport, so a model id may contain `:` or `,`.
    expect(result.loopArgv).toEqual(
      expect.arrayContaining([
        '--peers',
        'claude,codex',
        '--peer-agents',
        JSON.stringify([
          { provider: 'claude', model: 'claude-model-x', effort: 'high' },
          { provider: 'codex', model: 'codex-model-x' },
        ]),
      ]),
    );
    const runs = await peerRunCalls(context);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'claude',
          model: 'claude-model-x',
          effort: 'high',
        }),
        // An omitted effort stays omitted: the provider CLI keeps its default.
        expect.objectContaining({
          provider: 'codex',
          model: 'codex-model-x',
          effort: null,
        }),
      ]),
    );
  });
});

it('drops configured model and effort for a provider-only --peers override', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'project', [
      { provider: 'claude', model: 'claude-model-x', effort: 'high' },
      { provider: 'codex', model: 'codex-model-x', effort: 'medium' },
    ]);

    await runFixture(context, 'override', ['--peers', 'claude,codex']);

    const runs = await peerRunCalls(context);
    expect(runs).toHaveLength(2);
    for (const call of runs) {
      expect(call.model).toBeNull();
      expect(call.effort).toBeNull();
    }
  });
});

it('prefers project peer selections over user peer selections', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'user', [
      { provider: 'claude', model: 'user-model', effort: 'low' },
      { provider: 'codex', model: 'user-model' },
    ]);
    await writePeerDefaults(context, 'project', [
      { provider: 'claude', model: 'project-model', effort: 'high' },
      { provider: 'codex' },
    ]);

    await runFixture(context, 'project-wins');

    const runs = await peerRunCalls(context);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'claude',
          model: 'project-model',
          effort: 'high',
        }),
        expect.objectContaining({
          provider: 'codex',
          model: null,
          effort: null,
        }),
      ]),
    );
  });
});

it('falls back to user peer selections when no project config exists', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'user', [
      { provider: 'claude', effort: 'high' },
      { provider: 'codex' },
    ]);

    await runFixture(context, 'user-only');

    const runs = await peerRunCalls(context);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'claude',
          model: null,
          effort: 'high',
        }),
      ]),
    );
  });
});

it('sends no model or effort when built-in defaults are used', async () => {
  await withPeerModelContext(async (context) => {
    await runFixture(context, 'built-in');

    const runs = await peerRunCalls(context);
    expect(runs).toHaveLength(2);
    for (const call of runs) {
      expect(call.model).toBeNull();
      expect(call.effort).toBeNull();
    }
  });
});

it('surfaces the provider CLI unsupported-option failure for a rejected selection', async () => {
  await withPeerModelContext(
    async (context) => {
      await writePeerDefaults(context, 'project', [
        { provider: 'cursor', model: 'unsupported-model' },
        { provider: 'codex' },
      ]);

      // The wrapper aborts the round instead of retrying without the option;
      // the provider CLI's PROVIDER_UNSUPPORTED_OPTION is the cause it reports.
      const failure = (await runFixture(context, 'unsupported').then(
        () => null,
        (error: JsonRecord) => error,
      )) as JsonRecord | null;
      expect(failure).not.toBeNull();
      const unsupported =
        failure?.code === 'PROVIDER_UNSUPPORTED_OPTION'
          ? failure
          : (failure?.cause as JsonRecord | undefined);
      expect(unsupported).toMatchObject({
        code: 'PROVIDER_UNSUPPORTED_OPTION',
      });

      const runs = await peerRunCalls(context);
      expect(runs.find((call) => call.provider === 'cursor')).toMatchObject({
        model: 'unsupported-model',
      });
    },
    { CONSENSUS_STUB_RUN_FAILURE_CODE: 'PROVIDER_UNSUPPORTED_OPTION' },
  );
});
