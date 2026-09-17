// Regression coverage for BL-260916: configured peer model/effort must reach
// Refine's outgoing `consensus run` requests, survive a resume, and be absent
// for a provider-only `--peers` override. Assertions read the provider CLI
// fixture's recorded run calls, so they observe the request that left Refine.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  makeProviderCliEnv,
  parseJsonl,
  repoRoot,
  runNodeScript,
} from '../../../../tests/helpers/process.mjs';
import { writeConsensusConfig } from '../../../plugins/consensus/config/consensus-config.js';
import type { ConsensusConfigScope } from '../../../plugins/consensus/config/consensus-config.js';
import { prepareParallelRun, runSequential } from './consensus-refine.js';

type JsonRecord = Record<string, any>;

// The parallel section path hands `loop_argv` to the host, which executes this
// generated standalone runtime; exercising it is what proves the argv transport
// and the loop's default peer invoker agree.
const loopScript = path.join(
  repoRoot,
  'plugins/consensus/scripts/consensus-loop.mjs',
);

interface PeerModelContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  callsPath: string;
  inputPath: string;
}

// Host markers belonging to the process that runs this suite must not choose
// the default peer order. `detectHost` puts the detected host first in the
// built-in peer composition, and the stub env spreads `process.env`, so a
// Claude- or Codex-hosted runner would silently reorder `--peers` (CI, with no
// markers at all, sees host `unknown`). Strip the inherited markers so these
// tests are deterministic on every host; a test that genuinely needs a host can
// still pin one through `envOverrides`, which is applied afterwards.
function withoutInheritedHostMarkers(env: NodeJS.ProcessEnv) {
  const stripped: NodeJS.ProcessEnv = { ...env };
  for (const key of Object.keys(stripped)) {
    if (
      key === 'CLAUDECODE' ||
      key === 'CLAUDE_CODE' ||
      key === 'CLAUDECODE_SESSION_ID' ||
      key.startsWith('CODEX_') ||
      key.startsWith('CURSOR_')
    ) {
      delete stripped[key];
    }
  }
  return stripped;
}

async function withPeerModelContext(
  fn: (context: PeerModelContext) => Promise<void>,
  envOverrides: NodeJS.ProcessEnv = {},
) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-refine-peer-model-'),
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
    const inputPath = path.join(cwd, 'draft.md');
    await writeFile(inputPath, '# Intro\n\nOne paragraph to refine.\n');

    await fn({
      cwd,
      callsPath,
      inputPath,
      env: {
        ...withoutInheritedHostMarkers(
          makeProviderCliEnv({
            HOME: home,
            XDG_CONFIG_HOME: xdg,
            CONSENSUS_STUB_PROVIDERS: 'claude,codex,cursor',
            CONSENSUS_STUB_CALLS_JSONL: callsPath,
            CONSENSUS_STUB_VERDICT: 'ACCEPT',
          }),
        ),
        ...envOverrides,
      },
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

function refineOptions(
  context: PeerModelContext,
  label: string,
  extra: JsonRecord = {},
) {
  return {
    inputPath: context.inputPath,
    output: path.join(context.cwd, `${label}.consensus.md`),
    runDir: path.join(context.cwd, `.consensus/${label}`),
    allowRoot: context.cwd,
    cwd: context.cwd,
    env: context.env,
    goal: 'Refine the draft.',
    maxRounds: 1,
    agency: 'moderate' as const,
    ...extra,
  };
}

async function runCalls(context: PeerModelContext) {
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

    const result = await runSequential(refineOptions(context, 'configured'));

    expect(result.peers).toEqual(['claude', 'codex']);
    const runs = await runCalls(context);
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

it('drops configured model and effort for a provider-only peers override', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'project', [
      { provider: 'claude', model: 'claude-model-x', effort: 'high' },
      { provider: 'codex', model: 'codex-model-x', effort: 'medium' },
    ]);

    await runSequential(
      refineOptions(context, 'override', { peers: ['claude', 'codex'] }),
    );

    const runs = await runCalls(context);
    expect(runs.length).toBeGreaterThan(0);
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

    await runSequential(refineOptions(context, 'project-wins'));

    const runs = await runCalls(context);
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

    await runSequential(refineOptions(context, 'user-only'));

    const runs = await runCalls(context);
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
    await runSequential(refineOptions(context, 'built-in'));

    const runs = await runCalls(context);
    expect(runs.length).toBeGreaterThan(0);
    for (const call of runs) {
      expect(call.model).toBeNull();
      expect(call.effort).toBeNull();
    }
  });
});

it('keeps configured selections on the turns a resumed run re-issues', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'project', [
      { provider: 'claude', model: 'claude-model-x', effort: 'high' },
      { provider: 'codex', model: 'codex-model-x', effort: 'medium' },
    ]);

    // Fail the first run's provider turns so the section is in-flight in the
    // resume artifact, then resume it against a healthy provider CLI.
    const first = await runSequential(
      refineOptions(context, 'resume-first', {
        env: {
          ...context.env,
          CONSENSUS_STUB_RUN_FAILURE_CODE: 'PROVIDER_EXIT',
        },
      }),
    );
    expect(first.status).toBe('error');
    const callsBeforeResume = (await runCalls(context)).length;

    await runSequential(
      refineOptions(context, 'resume-second', { resume: first.outputPath }),
    );

    const resumedCalls = (await runCalls(context)).slice(callsBeforeResume);
    expect(resumedCalls.length).toBeGreaterThan(0);
    for (const call of resumedCalls) {
      expect(call.model).toBe(
        call.provider === 'claude' ? 'claude-model-x' : 'codex-model-x',
      );
      expect(call.effort).toBe(call.provider === 'claude' ? 'high' : 'medium');
    }
  });
});

async function manifestLoopArgv(manifestPath: string, index = 0) {
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8'),
  ) as JsonRecord;
  return manifest.sections[index].loop_argv as string[];
}

function argvValue(loopArgv: string[], option: string) {
  const index = loopArgv.indexOf(option);
  return index === -1 ? null : loopArgv[index + 1];
}

it('records peer agents in the parallel manifest loop argv', async () => {
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'project', [
      { provider: 'claude', model: 'claude-model-x', effort: 'high' },
      { provider: 'codex' },
    ]);

    const prepared = await prepareParallelRun(
      refineOptions(context, 'parallel'),
    );

    // `--peers` stays provider-ids-only; selections ride the lossless JSON
    // transport so a model id may contain the `:`/`,` peer-spec delimiters.
    const loopArgv = await manifestLoopArgv(prepared.manifestPath);
    expect(argvValue(loopArgv, '--peers')).toBe('claude,codex');
    expect(JSON.parse(argvValue(loopArgv, '--peer-agents') as string)).toEqual([
      { provider: 'claude', model: 'claude-model-x', effort: 'high' },
      { provider: 'codex' },
    ]);
  });
});

it('omits the peer-agents transport when no model or effort is configured', async () => {
  await withPeerModelContext(async (context) => {
    const prepared = await prepareParallelRun(
      refineOptions(context, 'parallel-bare'),
    );

    const loopArgv = await manifestLoopArgv(prepared.manifestPath);
    expect(argvValue(loopArgv, '--peers')).toBe('claude,codex');
    expect(loopArgv).not.toContain('--peer-agents');
  });
});

it('carries model ids containing peer-spec delimiters end-to-end through a parallel section', async () => {
  // BL-260916 follow-up: a Bedrock-style id ending in `:0`, and an id with a
  // comma, both broke the colon-delimited `--peers` encoding. Drive the whole
  // path — wrapper -> loop argv -> generated standalone loop -> outgoing
  // `consensus run` request.
  await withPeerModelContext(async (context) => {
    await writePeerDefaults(context, 'project', [
      {
        provider: 'claude',
        model: 'us.anthropic.claude-sonnet-4-5-v1:0',
        effort: 'high',
      },
      { provider: 'codex', model: 'gpt-x,fallback' },
    ]);

    const prepared = await prepareParallelRun(
      refineOptions(context, 'parallel-delimiters'),
    );
    const loopArgv = await manifestLoopArgv(prepared.manifestPath);
    await runNodeScript(loopScript, loopArgv, {
      cwd: context.cwd,
      env: context.env,
    });

    const runs = await runCalls(context);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.find((call) => call.provider === 'claude')).toMatchObject({
      model: 'us.anthropic.claude-sonnet-4-5-v1:0',
      effort: 'high',
    });
    expect(runs.find((call) => call.provider === 'codex')).toMatchObject({
      model: 'gpt-x,fallback',
      effort: null,
    });
  });
});
