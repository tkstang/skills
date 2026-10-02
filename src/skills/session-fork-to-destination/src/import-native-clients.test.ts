import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import {
  IsolationUnavailable,
  api,
  app,
  codexConfig,
  createFixture,
  hash,
  history,
  printedCodexCreation,
  run,
  sourceId,
  sourceTranscript,
  transcriptBytes,
} from './helpers/import-native-clients-support.js';
import type { Fixture } from './helpers/import-native-clients-support.js';

type Json = Record<string, unknown>;
interface Plan {
  digest: string;
  seed: { id: string; path: string; sha256: string };
  instructions: Array<{ kind: string; runIn: string; command: string }>;
}
const bundle = fileURLToPath(
  new URL(
    '../../../../skills/session-fork-to-destination/scripts/session-fork-to-destination.mjs',
    import.meta.url,
  ),
);

async function importSeed(
  fixture: Fixture,
  provider: 'codex' | 'claude',
): Promise<Plan> {
  const sourceProvider = provider === 'codex' ? 'claude' : 'codex';
  const args = [
    bundle,
    'import',
    '--source',
    fixture.source,
    '--target',
    fixture.destination,
    '--session',
    `${sourceProvider}:cli:${sourceId}`,
    '--to',
    provider,
    '--entry-point',
    'destination-fresh',
    '--target-home',
    fixture.targetHome,
    '--json',
  ];
  const planned = JSON.parse(
    await run(fixture, [process.execPath, ...args]),
  ) as { ok: boolean; data: Plan };
  expect(planned.ok).toBe(true);
  expect(planned.data.digest).toMatch(/^[a-f0-9]{64}$/u);
  const applied = JSON.parse(
    await run(fixture, [
      process.execPath,
      ...args,
      '--apply',
      '--expect-plan',
      planned.data.digest,
    ]),
  ) as {
    ok: boolean;
    data: { status: string; message: string; plan: Plan };
  };
  expect(applied).toMatchObject({
    ok: true,
    data: {
      status: 'imported',
      message: 'seed imported; native fork not created',
    },
  });
  expect(applied.data.plan.digest).toBe(planned.data.digest);
  expect(hash(await transcriptBytes(planned.data.seed.path))).toBe(
    planned.data.seed.sha256,
  );
  expect(planned.data.instructions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'terminal', runIn: fixture.destination }),
    ]),
  );
  return planned.data;
}

function assertRequest(
  provider: 'codex' | 'claude',
  request: Json,
  previousReply?: string,
): void {
  const context = JSON.stringify(
    provider === 'codex' ? request.input : request.messages,
  );
  for (const value of [
    history.prompt,
    history.answer,
    history.output,
    ...(previousReply ? [previousReply] : []),
  ])
    expect(context).toContain(value);
  if (provider === 'codex') {
    const input = request.input as Json[];
    const call = input.find(
      (item) =>
        item.type === 'function_call' && item.call_id === history.callId,
    );
    expect(call).toMatchObject({ name: history.tool, call_id: history.callId });
    expect(JSON.parse(call!.arguments as string)).toEqual(history.arguments);
    expect(
      input.find(
        (item) =>
          item.type === 'function_call_output' &&
          item.call_id === history.callId,
      ),
    ).toMatchObject({ output: history.output });
  } else {
    const blocks = (request.messages as Array<{ content: unknown }>).flatMap(
      (message) =>
        Array.isArray(message.content) ? (message.content as Json[]) : [],
    );
    expect(
      blocks.find(
        (block) => block.type === 'tool_use' && block.id === history.callId,
      ),
    ).toMatchObject({ name: history.tool, input: history.arguments });
    const result = blocks.find(
      (block) =>
        block.type === 'tool_result' && block.tool_use_id === history.callId,
    );
    expect(result).toBeDefined();
    expect([
      history.output,
      [{ type: 'text', text: history.output }],
    ]).toContainEqual(result!.content);
  }
}

async function claude(
  fixture: Fixture,
  mode: string[],
  prompt: string,
): Promise<{ session_id: string; result: string }> {
  return JSON.parse(
    await run(
      fixture,
      [
        fixture.client,
        '--bare',
        '-p',
        ...mode,
        '--model',
        'claude-sonnet-4-6',
        '--tools',
        '',
        '--setting-sources',
        '',
        '--strict-mcp-config',
        '--mcp-config',
        '{"mcpServers":{}}',
        '--output-format',
        'json',
        '--',
        prompt,
      ],
      55_000,
    ),
  ) as { session_id: string; result: string };
}

// Opt-in only: real local client binaries, dummy credentials, verified loopback-only network.
for (const provider of ['codex', 'claude'] as const) {
  it.skipIf(process.env.SESSION_IMPORT_NATIVE_CLIENTS !== '1')(
    `generated import survives ${provider} native fork, process restart and continuation`,
    async (context) => {
      let isolated: Fixture;
      try {
        isolated = await createFixture(provider);
      } catch (error) {
        if (error instanceof IsolationUnavailable) {
          context.skip(error.message);
          return;
        }
        throw error;
      }
      const fixtureData = isolated;
      let server: Awaited<ReturnType<typeof api>> | undefined;
      try {
        const version = (
          await run(fixtureData, [fixtureData.client, '--version'])
        ).trim();
        const firstReply = `${provider.toUpperCase()}_FORK_REPLY_91`;
        const secondReply = `${provider.toUpperCase()}_RESUME_REPLY_92`;
        server = await api(provider, [
          'SYNTHETIC_BOOTSTRAP_REPLY',
          firstReply,
          secondReply,
        ]);
        let bootstrapId: string | undefined;
        if (provider === 'codex') {
          await writeFile(
            join(fixtureData.targetHome, 'config.toml'),
            codexConfig(server.url, fixtureData.destination),
          );
          // Populate and restart the native store before import: an empty-index scan is insufficient evidence of seed lookup.
          const bootstrap = await app(fixtureData);
          try {
            const started = await bootstrap.rpc('thread/start', {
              modelProvider: 'probe',
              model: 'probe-model',
              cwd: fixtureData.destination,
              sandbox: 'read-only',
              approvalPolicy: 'untrusted',
            });
            bootstrapId = (started.thread as { id: string }).id;
            expect(bootstrapId).toBeTruthy();
            await bootstrap.rpc('turn/start', {
              threadId: bootstrapId,
              input: [{ type: 'text', text: 'SYNTHETIC_BOOTSTRAP_PROMPT' }],
            });
            expect(JSON.stringify((await server.next()).input)).toContain(
              'SYNTHETIC_BOOTSTRAP_PROMPT',
            );
            expect(await bootstrap.completed()).toBe('completed');
          } finally {
            await bootstrap.close();
          }
          const initialized = await app(fixtureData);
          try {
            const listing = await initialized.rpc('thread/list', { limit: 20 });
            expect(
              (listing.data as Json[]).map((thread) => thread.id),
            ).toContain(bootstrapId);
            const persisted = await initialized.rpc('thread/read', {
              threadId: bootstrapId,
              includeTurns: true,
            });
            expect(JSON.stringify(persisted)).toContain(
              'SYNTHETIC_BOOTSTRAP_REPLY',
            );
          } finally {
            await initialized.close();
          }
        } else {
          fixtureData.env.ANTHROPIC_BASE_URL = server.url;
          await claude(
            fixtureData,
            ['--session-id', '550e8400-e29b-41d4-a716-446655440099'],
            'Initialize synthetic isolated home.',
          );
          await server.next();
        }
        const source = await sourceTranscript(
          fixtureData,
          provider === 'codex' ? 'claude' : 'codex',
        );
        const sourceHash = hash(await transcriptBytes(source));
        const plan = await importSeed(fixtureData, provider);
        const seedHash = hash(await transcriptBytes(plan.seed.path));
        let child: string;
        if (provider === 'codex') {
          const initial = await app(fixtureData);
          try {
            const listing = await initial.rpc('thread/list', { limit: 20 });
            expect(
              (listing.data as Json[]).map((thread) => thread.id),
            ).toContain(plan.seed.id);
            expect(
              (listing.data as Json[]).map((thread) => thread.id),
            ).toContain(bootstrapId);
            expect(plan.seed.id).not.toBe(bootstrapId);
            const fork = await initial.rpc('thread/fork', {
              threadId: plan.seed.id,
              modelProvider: 'probe',
              model: 'probe-model',
              cwd: fixtureData.destination,
              sandbox: 'read-only',
              approvalPolicy: 'untrusted',
            });
            const thread = fork.thread as {
              id: string;
              forkedFromId: string;
              cwd: string;
            };
            child = thread.id;
            expect(thread.forkedFromId).toBe(plan.seed.id);
            expect(thread.cwd).toBe(fixtureData.destination);
            expect(child).not.toBe(plan.seed.id);
            await initial.rpc('turn/start', {
              threadId: child,
              input: [
                { type: 'text', text: 'Continue synthetic imported tools.' },
              ],
            });
            assertRequest(provider, await server.next());
            expect(await initial.completed()).toBe('completed');
          } finally {
            await initial.close();
          }
          const restarted = await app(fixtureData);
          try {
            const read = await restarted.rpc('thread/read', {
              threadId: child!,
              includeTurns: true,
            });
            expect(JSON.stringify(read)).toContain(firstReply);
            const resume = await restarted.rpc('thread/resume', {
              threadId: child!,
              modelProvider: 'probe',
              model: 'probe-model',
              cwd: fixtureData.destination,
              sandbox: 'read-only',
              approvalPolicy: 'untrusted',
            });
            expect((resume.thread as Json).id).toBe(child!);
            await restarted.rpc('turn/start', {
              threadId: child!,
              input: [
                { type: 'text', text: 'Check previous synthetic reply.' },
              ],
            });
            assertRequest(provider, await server.next(), firstReply);
            expect(await restarted.completed()).toBe('completed');
          } finally {
            await restarted.close();
          }
          const final = await app(fixtureData);
          try {
            const persisted = await final.rpc('thread/read', {
              threadId: child!,
              includeTurns: true,
            });
            for (const marker of [
              history.prompt,
              history.answer,
              history.output,
              history.callId,
              firstReply,
              secondReply,
            ])
              expect(JSON.stringify(persisted)).toContain(marker);
            expect((persisted.thread as Json).cwd).toBe(
              fixtureData.destination,
            );
          } finally {
            await final.close();
          }
        } else {
          const first = await claude(
            fixtureData,
            ['--resume', plan.seed.id, '--fork-session'],
            'Continue synthetic imported tools.',
          );
          child = first.session_id;
          expect(child).not.toBe(plan.seed.id);
          expect(first.result).toContain(firstReply);
          assertRequest(provider, await server.next());
          // A new process performs resume; this is the restart boundary.
          const second = await claude(
            fixtureData,
            ['--resume', child],
            'Check previous synthetic reply.',
          );
          expect(second.session_id).toBe(child);
          expect(second.result).toContain(secondReply);
          assertRequest(provider, await server.next(), firstReply);
          const project = join(
            fixtureData.targetHome,
            'projects',
            fixtureData.destination.replace(/[^A-Za-z0-9]/gu, '-'),
          );
          expect(await readdir(project)).toContain(`${child}.jsonl`);
          const persisted = await readFile(
            join(project, `${child}.jsonl`),
            'utf8',
          );
          for (const marker of [
            history.prompt,
            history.answer,
            history.output,
            history.callId,
            firstReply,
            secondReply,
          ])
            expect(persisted).toContain(marker);
          const rows = persisted
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as Json);
          expect(
            rows.some(
              (row) =>
                row.sessionId === child && row.cwd === fixtureData.destination,
            ),
          ).toBe(true);
        }
        const printedCommand =
          provider === 'codex'
            ? await printedCodexCreation(
                fixtureData,
                plan.instructions.find(
                  (instruction) => instruction.kind === 'terminal',
                )!.command,
                plan.seed.id,
              )
            : 'not exercised; noninteractive native CLI continuation adds flags';
        expect(hash(await transcriptBytes(source))).toBe(sourceHash);
        expect(hash(await transcriptBytes(plan.seed.path))).toBe(seedHash);
        // Keep compatibility evidence outside the disposable stores if explicitly requested.
        const evidence = {
          provider,
          version,
          preinitializedHomeLookup: 'passed',
          nativeChildId: child!,
          sourceUnchanged: true,
          seedUnchanged: true,
          continuation:
            provider === 'codex'
              ? 'RPC fork/start/restart/resume passed'
              : 'CLI fork/resume with additional noninteractive flags passed',
          exactPrintedCommandCreation: printedCommand,
          terminalContinuation: 'not exercised',
        };
        console.info(JSON.stringify(evidence));
        if (process.env.SESSION_IMPORT_NATIVE_EVIDENCE_DIR) {
          await mkdir(process.env.SESSION_IMPORT_NATIVE_EVIDENCE_DIR, {
            recursive: true,
          });
          await writeFile(
            join(
              process.env.SESSION_IMPORT_NATIVE_EVIDENCE_DIR,
              `${provider}-native-clients.json`,
            ),
            JSON.stringify(evidence, null, 2) + '\n',
          );
        }
      } finally {
        await server?.close();
        await fixtureData.cleanup();
      }
    },
    240_000,
  );
}
