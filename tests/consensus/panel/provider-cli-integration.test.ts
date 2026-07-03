import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeConsensusConfig } from '../../../src/consensus/config/consensus-config.js';
import {
  runConsensusPanel,
  runPanelCli,
  type PanelistInvoker,
} from '../../../src/consensus/panel/consensus-panel.js';
import {
  captureWriter,
  makeProviderCliEnv,
  parseJsonl,
} from '../../helpers/process.mjs';

type JsonRecord = Record<string, any>;

interface IsolatedPanelContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  root: string;
}

describe('consensus panel provider execution', () => {
  it('invokes one independent provider turn per usable explicit panelist', async () => {
    await withIsolatedPanelContext(async (context) => {
      const calls: Array<{ provider: string; prompt: string; schemaPath: string }> =
        [];
      const result = await runConsensusPanel(
        [
          '--question',
          'Which migration risks matter?',
          '--panelists',
          'claude,codex,cursor',
          '--output',
          'panel.md',
          '--run-dir',
          '.consensus/panel-run',
          '--allow-root',
          context.cwd,
        ],
        {
          cwd: context.cwd,
          env: context.env,
          now: () => '2026-07-03T00:00:00.000Z',
          invokePanelist: async ({ panelist, prompt, schemaPath }) => {
            calls.push({ provider: panelist.provider, prompt, schemaPath });
            return okPanelist(panelist.provider);
          },
        },
      );

      expect(result.status).toBe('passed');
      expect(calls.map((call) => call.provider)).toEqual([
        'claude',
        'codex',
        'cursor',
      ]);
      expect(new Set(calls.map((call) => call.prompt)).size).toBe(1);
      for (const call of calls) {
        expect(call.prompt).toContain('Which migration risks matter?');
        expect(call.prompt).not.toContain('fixture response from');
        expect(call.schemaPath).toMatch(/panel-response\.schema\.json$/);
      }

      const artifact = await readFile(path.join(context.cwd, 'panel.md'), 'utf8');
      expect(artifact).toContain('fixture response from claude');
      expect(artifact).toContain('fixture response from codex');
      expect(artifact).toContain('fixture response from cursor');
    });
  });

  it('uses configured defaults when --panelists is absent and lets explicit panelists win', async () => {
    await withIsolatedPanelContext(async (context) => {
      await writeConsensusConfig({
        scope: 'user',
        cwd: context.cwd,
        env: context.env,
        config: {
          schema_version: 'v1',
          defaults: {
            panelists: [{ provider: 'codex' }, { provider: 'cursor' }],
          },
        },
      });

      const defaultCalls: string[] = [];
      await runConsensusPanel(
        panelArgv(context, 'configured-defaults'),
        runOptions(context, defaultCalls),
      );
      expect(defaultCalls).toEqual(['codex', 'cursor']);

      const explicitCalls: string[] = [];
      await runConsensusPanel(
        [
          ...panelArgv(context, 'explicit-panelists'),
          '--panelists',
          'claude,codex',
        ],
        runOptions(context, explicitCalls),
      );
      expect(explicitCalls).toEqual(['claude', 'codex']);
    });
  });

  it('honors panel_size first-N selection and expands from inventory order', async () => {
    await withIsolatedPanelContext(
      async (context) => {
        await writeConsensusConfig({
          scope: 'project',
          cwd: context.cwd,
          env: context.env,
          config: {
            schema_version: 'v1',
            defaults: {
              panelists: [
                { provider: 'claude' },
                { provider: 'codex' },
                { provider: 'cursor' },
              ],
              panel_size: 2,
            },
          },
        });

        const firstNCalls: string[] = [];
        await runConsensusPanel(
          panelArgv(context, 'first-n'),
          runOptions(context, firstNCalls),
        );
        expect(firstNCalls).toEqual(['claude', 'codex']);

        await writeConsensusConfig({
          scope: 'project',
          cwd: context.cwd,
          env: context.env,
          config: {
            schema_version: 'v1',
            defaults: {
              panelists: [{ provider: 'claude' }, { provider: 'codex' }],
              panel_size: 4,
            },
          },
        });

        const expandedCalls: string[] = [];
        await runConsensusPanel(
          panelArgv(context, 'expanded'),
          runOptions(context, expandedCalls),
        );
        expect(expandedCalls).toEqual(['claude', 'codex', 'cursor', 'gemini']);
      },
      { CONSENSUS_STUB_PROVIDERS: 'claude,codex,cursor,gemini' },
    );
  });

  it('records configured unavailable panelists as diagnostics and shortfalls', async () => {
    await withIsolatedPanelContext(
      async (context) => {
        await writeConsensusConfig({
          scope: 'project',
          cwd: context.cwd,
          env: context.env,
          config: {
            schema_version: 'v1',
            defaults: {
              panelists: [
                { provider: 'claude' },
                { provider: 'codex' },
                { provider: 'cursor' },
              ],
            },
          },
        });

        const calls: string[] = [];
        const result = await runConsensusPanel(
          panelArgv(context, 'unavailable-default'),
          runOptions(context, calls),
        );

        expect(result.status).toBe('passed');
        expect(calls).toEqual(['claude', 'codex']);
        expect(result.responses).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              panelist: { provider: 'cursor' },
              status: 'unavailable',
              diagnostics: expect.arrayContaining([
                expect.stringMatching(/cursor.*unavailable/),
              ]),
            }),
          ]),
        );
        expect(result.shortfalls).toEqual(
          expect.arrayContaining([expect.stringMatching(/cursor.*unavailable/)]),
        );

        const artifact = await readFile(result.outputPath, 'utf8');
        expect(artifact).toContain('status: passed');
        expect(artifact).toContain('cursor - unavailable');
      },
      { CONSENSUS_STUB_UNAVAILABLE: 'cursor' },
    );
  });

  it('returns non-zero from the CLI and writes failed evidence when fewer than two responses succeed', async () => {
    await withIsolatedPanelContext(async (context) => {
      const stdout = captureWriter();
      const stderr = captureWriter();
      const outputPath = path.join(context.cwd, 'failed-panel.md');

      const exitCode = await runPanelCli(
        [
          '--question',
          'Should this release ship?',
          '--panelists',
          'claude,codex',
          '--output',
          outputPath,
          '--allow-root',
          context.cwd,
        ],
        {
          cwd: context.cwd,
          env: context.env,
          stdout: stdout.stream,
          stderr: stderr.stream,
          now: () => '2026-07-03T00:00:00.000Z',
          invokePanelist: async ({ panelist }) =>
            panelist.provider === 'claude'
              ? okPanelist('claude')
              : {
                  ok: true,
                  payload: {
                    schema_version: 'v1',
                    understood_question: 'Should this release ship?',
                  },
                  diagnostics: ['invalid fixture payload'],
                },
        },
      );

      expect(exitCode).toBe(65);
      expect(stderr.value()).toMatch(/fewer than two successful panel responses/i);
      const events = parseJsonl<JsonRecord>(stdout.value());
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'run_completed', status: 'failed' }),
        ]),
      );

      const artifact = await readFile(outputPath, 'utf8');
      expect(artifact).toContain('status: failed');
      expect(artifact).toContain('claude - ok');
      expect(artifact).toContain('codex - error');
      expect(artifact).toContain('Missing required JSON field: response');
    });
  });

  it('runs provider turns through consensus run --json after inventory and preflight', async () => {
    await withIsolatedPanelContext(async (context) => {
      const callsPath = path.join(context.root, 'calls.jsonl');
      const consensusCli = await writePanelConsensusCli(context.root, callsPath);
      const env = {
        ...context.env,
        CONSENSUS_CLI_PATH: consensusCli,
      };

      const result = await runConsensusPanel(
        [
          '--question',
          'How should we test this?',
          '--panelists',
          'claude,codex',
          '--output',
          'provider-panel.md',
          '--allow-root',
          context.cwd,
        ],
        {
          cwd: context.cwd,
          env,
          now: () => '2026-07-03T00:00:00.000Z',
        },
      );

      expect(result.status).toBe('passed');
      const calls = parseJsonl<JsonRecord>(await readFile(callsPath, 'utf8'));
      expect(calls.map((call) => call.event)).toEqual([
        'provider_ls',
        'preflight',
        'preflight',
        'run',
        'run',
      ]);
      expect(calls.filter((call) => call.event === 'preflight')).toMatchObject([
        { provider: 'claude' },
        { provider: 'codex' },
      ]);
      const runCalls = calls.filter((call) => call.event === 'run');
      expect(runCalls.map((call) => call.provider)).toEqual(['claude', 'codex']);
      for (const call of runCalls) {
        expect(call.args).toEqual(['run', '--request-json', '-', '--json']);
        expect(call.schema_path).toMatch(/panel-response\.schema\.json$/);
        expect(call.prompt).toContain('How should we test this?');
        expect(call.prompt).not.toContain('fixture response from claude');
        expect(call.prompt).not.toContain('fixture response from codex');
      }
    });
  });
});

async function withIsolatedPanelContext(
  fn: (context: IsolatedPanelContext) => Promise<void>,
  envOverrides: NodeJS.ProcessEnv = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consensus-panel-provider-'));
  try {
    const cwd = path.join(root, 'project');
    const home = path.join(root, 'home');
    const xdg = path.join(root, 'xdg');
    await Promise.all([
      mkdir(cwd, { recursive: true }),
      mkdir(home, { recursive: true }),
      mkdir(xdg, { recursive: true }),
    ]);
    await fn({
      cwd,
      root,
      env: makeProviderCliEnv({
        HOME: home,
        XDG_CONFIG_HOME: xdg,
        ...envOverrides,
      }),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function panelArgv(context: IsolatedPanelContext, label: string) {
  return [
    '--question',
    'What should the panel consider?',
    '--output',
    `${label}.md`,
    '--run-dir',
    `.consensus/${label}`,
    '--allow-root',
    context.cwd,
  ];
}

function runOptions(context: IsolatedPanelContext, calls: string[]) {
  return {
    cwd: context.cwd,
    env: context.env,
    now: () => '2026-07-03T00:00:00.000Z',
    invokePanelist: (async ({ panelist }) => {
      calls.push(panelist.provider);
      return okPanelist(panelist.provider);
    }) satisfies PanelistInvoker,
  };
}

function okPanelist(provider: string) {
  return {
    ok: true,
    payload: {
      schema_version: 'v1',
      understood_question: 'What should the panel consider?',
      response: `fixture response from ${provider}`,
      key_points: [`${provider} key point`],
      risks: [`${provider} risk`],
      assumptions: [`${provider} assumption`],
      confidence: 'medium',
    },
    diagnostics: [`${provider} diagnostic`],
  } as const;
}

async function writePanelConsensusCli(root: string, callsPath: string) {
  const scriptPath = path.join(root, 'consensus-panel-fixture.mjs');
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

const args = process.argv.slice(2);

function append(entry) {
  appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify({ args, ...entry }) + '\\n');
}

function print(value) {
  process.stdout.write(JSON.stringify(value) + '\\n');
}

function providerFromArgs() {
  const index = args.indexOf('--provider');
  return index >= 0 ? args[index + 1] : args.at(-1);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

if (args[0] === 'provider' && args[1] === 'ls') {
  append({ event: 'provider_ls' });
  print({
    schema_version: 'v1',
    ok: true,
    providers: [
      { id: 'claude', status: 'ready' },
      { id: 'codex', status: 'ready' },
    ],
  });
} else if (args[0] === 'preflight') {
  const provider = providerFromArgs();
  append({ event: 'preflight', provider });
  print({
    schema_version: 'v1',
    ok: true,
    usable: true,
    providers: [{ id: provider, status: 'ready' }],
  });
} else if (args[0] === 'run') {
  const request = JSON.parse(await readStdin());
  append({
    event: 'run',
    provider: request.provider,
    schema_path: request.schema_path,
    prompt: request.prompt,
  });
  const payload = {
    schema_version: 'v1',
    understood_question: 'How should we test this?',
    response: 'fixture response from ' + request.provider,
    key_points: ['test the provider fixture'],
    risks: ['fixture drift'],
    assumptions: ['the wrapper passes a schema path'],
    confidence: 'high',
  };
  print({
    schema_version: 'v1',
    ok: true,
    provider: request.provider,
    args: ['fixture-consensus-cli'],
    stdout: JSON.stringify(payload),
    stderr: '',
    json: payload,
    attempts: {
      cli_attempts: 1,
      terminal_reason: 'success',
      retryable: false,
    },
    diagnostics: {
      strategy_used: 'fixture_consensus_cli',
    },
  });
} else {
  process.stderr.write('unknown command: ' + args.join(' ') + '\\n');
  process.exitCode = 64;
}
`,
    'utf8',
  );
  await chmod(scriptPath, 0o755);
  return scriptPath;
}
