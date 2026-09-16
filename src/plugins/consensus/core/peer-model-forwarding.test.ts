// Peer model/effort forwarding through the loop: `--peers` peer specs are
// parsed into index-aligned peer agents, the loop hands each peer's selections
// to its invoker, and `invokeConsensusProviderCli` puts them on the outgoing
// `consensus run` request (or leaves them out entirely when unselected).
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  formatPeerAgents,
  parsePeerAgents,
  peerAgentsFromComposition,
} from '../shared/cli-helpers.js';
import {
  ConsensusError,
  invokeConsensusProviderCli,
  parseLoopArgs,
  runConsensusLoop,
} from './consensus-loop.js';

type JsonRecord = Record<string, any>;

async function makeRunFiles() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-peer-model-'),
  );
  const files = {
    sectionPath: path.join(tempRoot, 'section.md'),
    recordsPath: path.join(tempRoot, 'records.json'),
    outputPath: path.join(tempRoot, 'output.md'),
    statusPath: path.join(tempRoot, 'status.json'),
  };
  await writeFile(files.sectionPath, 'Initial section.\n');
  return files;
}

function argvFor(
  files: Awaited<ReturnType<typeof makeRunFiles>>,
  peers: string,
  extra: string[] = [],
) {
  return [
    '--section-file',
    files.sectionPath,
    '--goal',
    'Make this clearer.',
    '--peers',
    peers,
    '--max-rounds',
    '1',
    '--agency',
    'moderate',
    '--output-records',
    files.recordsPath,
    '--output-section',
    files.outputPath,
    '--output-status',
    files.statusPath,
    ...extra,
  ];
}

function acceptVerdict(provider: string) {
  return {
    json: {
      schema_version: 'v1',
      verdict: 'ACCEPT',
      reasoning: `${provider} accepts`,
    },
  };
}

describe('peer spec parsing', () => {
  it('parses bare provider ids and provider[:model[:effort]] specs', () => {
    expect(parsePeerAgents('claude,codex')).toEqual([
      { provider: 'claude' },
      { provider: 'codex' },
    ]);
    expect(parsePeerAgents('claude:sonnet-x:high,codex:gpt-x')).toEqual([
      { provider: 'claude', model: 'sonnet-x', effort: 'high' },
      { provider: 'codex', model: 'gpt-x' },
    ]);
    expect(parsePeerAgents('claude::high,codex')).toEqual([
      { provider: 'claude', effort: 'high' },
      { provider: 'codex' },
    ]);
    expect(() => parsePeerAgents('claude')).toThrow(/exactly two peers/);
    expect(() => parsePeerAgents('Claude,codex')).toThrow(
      /provider ids must match/,
    );
    expect(() => parsePeerAgents('claude:a:b:c,codex')).toThrow(
      /provider\[:model\[:effort\]\]/,
    );
  });

  it('renders provider-only peers unchanged and round-trips selections', () => {
    expect(formatPeerAgents([{ provider: 'claude' }, 'codex'])).toBe(
      'claude,codex',
    );
    const agents = parsePeerAgents('claude:sonnet-x:high,codex::medium');
    expect(formatPeerAgents(agents)).toBe('claude:sonnet-x:high,codex::medium');
    expect(parsePeerAgents(formatPeerAgents(agents))).toEqual(agents);
  });

  it('keeps only provider/model/effort when normalizing composition agents', () => {
    expect(
      peerAgentsFromComposition([
        { provider: 'claude', model: 'sonnet-x', effort: 'high' },
        'codex',
      ]),
    ).toEqual([
      { provider: 'claude', model: 'sonnet-x', effort: 'high' },
      { provider: 'codex' },
    ]);
  });
});

describe('loop option parsing', () => {
  it('splits peer specs into provider ids and index-aligned peer agents', () => {
    const parsed = parseLoopArgs([
      '--section-file',
      'section.md',
      '--peers',
      'claude:sonnet-x:high,codex',
      '--output-records',
      'records.json',
      '--output-section',
      'output.md',
      '--output-status',
      'status.json',
    ]);

    expect(parsed.peers).toEqual(['claude', 'codex']);
    expect(parsed.peerAgents).toEqual([
      { provider: 'claude', model: 'sonnet-x', effort: 'high' },
      { provider: 'codex' },
    ]);
  });

  it('leaves peer agents provider-only for a bare provider list', () => {
    const parsed = parseLoopArgs([
      '--section-file',
      'section.md',
      '--peers',
      'claude,codex',
      '--output-records',
      'records.json',
      '--output-section',
      'output.md',
      '--output-status',
      'status.json',
    ]);

    expect(parsed.peerAgents).toEqual([
      { provider: 'claude' },
      { provider: 'codex' },
    ]);
  });
});

describe('loop peer dispatch', () => {
  it('hands each alternating peer its own model and effort', async () => {
    const files = await makeRunFiles();
    const invocations: JsonRecord[] = [];

    await runConsensusLoop(
      argvFor(files, 'claude:sonnet-x:high,codex::medium'),
      {
        invokePeer: async (turn) => {
          invocations.push({
            provider: turn.provider,
            model: turn.model,
            effort: turn.effort,
          });
          return acceptVerdict(turn.provider);
        },
      },
    );

    expect(invocations[0]).toEqual({
      provider: 'claude',
      model: 'sonnet-x',
      effort: 'high',
    });
  });

  it('hands parallel peers their own selections and omits unselected ones', async () => {
    const files = await makeRunFiles();
    const invocations: JsonRecord[] = [];

    await runConsensusLoop(
      argvFor(files, 'claude:sonnet-x:high,codex', [
        '--iteration',
        'parallel_revision',
      ]),
      {
        invokePeer: async (turn) => {
          invocations.push({ ...turn, prompt: undefined });
          return {
            json: {
              schema_version: 'v1',
              verdict: 'CONVERGED',
              reasoning: `${turn.provider} converged`,
              critique: {
                own_previous: 'own',
                peer_previous: 'peer',
              },
            },
          };
        },
      },
    );

    const claudeCall = invocations.find((call) => call.provider === 'claude');
    const codexCall = invocations.find((call) => call.provider === 'codex');
    expect(claudeCall).toMatchObject({ model: 'sonnet-x', effort: 'high' });
    expect(codexCall).not.toHaveProperty('model');
    expect(codexCall).not.toHaveProperty('effort');
  });
});

describe('outgoing consensus run request', () => {
  async function captureRequest(
    args: Partial<{ model: string; effort: string }>,
  ) {
    let input = '';
    await invokeConsensusProviderCli({
      provider: 'claude',
      schemaPath: '/schemas/verdict.json',
      prompt: 'Review this section.',
      cwd: '/tmp/consensus-run',
      env: { CONSENSUS_CLI_PATH: '/tmp/bin/consensus' },
      ...args,
      runCommand: async (_command, _cliArgs, options) => {
        input = options.input ?? '';
        return {
          code: 0,
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: true,
            provider: 'claude',
            json: {
              schema_version: 'v1',
              verdict: 'ACCEPT',
              reasoning: 'ready',
            },
          }),
          stderr: '',
        };
      },
    });
    return JSON.parse(input) as JsonRecord;
  }

  it('forwards the selected model and effort', async () => {
    expect(
      await captureRequest({ model: 'sonnet-x', effort: 'high' }),
    ).toMatchObject({
      provider: 'claude',
      model: 'sonnet-x',
      effort: 'high',
    });
  });

  it('omits both options when neither is selected', async () => {
    const request = await captureRequest({});
    expect(request).not.toHaveProperty('model');
    expect(request).not.toHaveProperty('effort');
  });

  it('surfaces the provider CLI unsupported-option failure instead of dropping the option', async () => {
    const invocation = invokeConsensusProviderCli({
      provider: 'cursor',
      schemaPath: '/schemas/verdict.json',
      prompt: 'Review this section.',
      model: 'sonnet-x',
      env: { CONSENSUS_CLI_PATH: '/tmp/bin/consensus' },
      runCommand: async () => ({
        code: 0,
        stdout: JSON.stringify({
          schema_version: 'v1',
          ok: false,
          provider: 'cursor',
          code: 'PROVIDER_UNSUPPORTED_OPTION',
          message: 'Provider does not support model selection.',
          retryable: false,
        }),
        stderr: '',
      }),
    });

    await expect(invocation).rejects.toBeInstanceOf(ConsensusError);
    await invocation.catch((error: unknown) => {
      expect(error).toMatchObject({
        code: 'PROVIDER_UNSUPPORTED_OPTION',
        message: 'Provider does not support model selection.',
      });
    });
  });
});
