import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildConsensusSubmitCommand,
  runProviderTurn,
} from '../../../../src/consensus/provider-cli/structured-output.js';
import type {
  ConsensusCliRunRequest,
  FirstScopeProviderId,
  ProviderRuntimePolicy,
} from '../../../../src/consensus/provider-cli/types.js';

// CONSENSUS_LIVE_SUBMIT_E2E=1 is an explicit opt-in request to spend real
// provider quota. When it is unset, this suite must stay a silent skip (the
// pnpm test default). When it IS set, "no usable provider" must fail loudly
// instead of silently skipping — a set-but-unusable env var is a
// misconfiguration the caller asked to be told about, not a green run.
const liveE2eRequested = process.env.CONSENSUS_LIVE_SUBMIT_E2E === '1';
const liveConfig = liveE2eRequested ? resolveLiveConfig() : undefined;

describe('live provider submit E2E', () => {
  it.skipIf(!liveE2eRequested)(
    'a live peer submits a verdict via consensus submit (set CONSENSUS_LIVE_SUBMIT_E2E=1; default provider codex/workspace-write)',
    async () => {
      if (!liveConfig) {
        const provider = process.env.CONSENSUS_LIVE_SUBMIT_PROVIDER ?? 'codex';
        throw new Error(
          [
            `CONSENSUS_LIVE_SUBMIT_E2E=1 was set, but no usable "${provider}" provider was found.`,
            `Checked via: node plugins/consensus/scripts/consensus.mjs preflight --json --provider ${provider}`,
            'Authenticate/install that provider CLI (or set CONSENSUS_LIVE_SUBMIT_PROVIDER to one that is ready), then re-run `pnpm run test:live-e2e`.',
          ].join('\n'),
        );
      }
      const config = liveConfig;
      const tempDir = await mkdtemp(
        path.join(tmpdir(), 'consensus-submit-live-'),
      );
      const schemaPath = path.join(tempDir, 'schema.json');
      const nonce = `submit-live-${Date.now()}`;

      await writeFile(schemaPath, JSON.stringify(schema()), 'utf8');

      try {
        const envelope = await runProviderTurn(
          request({
            provider: config.provider,
            schema_path: schemaPath,
            prompt: livePrompt(nonce),
            cwd: process.cwd(),
            runtime_policy: config.runtimePolicy,
            max_attempts: 1,
            max_runtime_sec: Number(
              process.env.CONSENSUS_LIVE_SUBMIT_TIMEOUT_SEC ?? 180,
            ),
          }),
          {
            readSchema: async () => schema(),
            submitCommand: buildConsensusSubmitCommand({
              nodePath: process.execPath,
              cliPath: config.cliPath,
            }),
          },
        );

        if (!envelope.ok) {
          throw new Error(
            `Live submit E2E failed:\n${JSON.stringify(envelope, null, 2)}`,
          );
        }
        expect(envelope.json).toEqual({ verdict: nonce });
        expect(envelope.diagnostics).toMatchObject({
          verdict_source: 'submit',
        });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    240_000,
  );
});

function resolveLiveConfig():
  | {
      provider: FirstScopeProviderId;
      runtimePolicy: ProviderRuntimePolicy;
      cliPath: string;
    }
  | undefined {
  const provider = liveProvider();
  const cliPath = path.resolve('plugins/consensus/scripts/consensus.mjs');
  if (!liveProviderIsReady(cliPath, provider)) return undefined;

  return {
    provider,
    cliPath,
    runtimePolicy: runtimePolicyFor(provider),
  };
}

function liveProvider(): FirstScopeProviderId {
  const value = process.env.CONSENSUS_LIVE_SUBMIT_PROVIDER ?? 'codex';
  if (value === 'claude' || value === 'codex' || value === 'cursor') {
    return value;
  }
  throw new Error(
    `Unsupported CONSENSUS_LIVE_SUBMIT_PROVIDER: ${value}. Use claude, codex, or cursor.`,
  );
}

function liveProviderIsReady(cliPath: string, provider: FirstScopeProviderId) {
  const result = spawnSync(
    process.execPath,
    [cliPath, 'preflight', '--json', '--provider', provider],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      timeout: 30_000,
    },
  );
  if (result.status !== 0) return false;

  try {
    const preflight = JSON.parse(result.stdout) as {
      ok?: boolean;
      providers?: Array<{ id?: string; status?: string }>;
    };
    return (
      preflight.ok === true &&
      preflight.providers?.some(
        (entry) => entry.id === provider && entry.status === 'ready',
      ) === true
    );
  } catch {
    return false;
  }
}

function runtimePolicyFor(
  provider: FirstScopeProviderId,
): ProviderRuntimePolicy {
  if (provider === 'codex') {
    return {
      permission_mode: 'non-interactive',
      // Submit capture now lives under the provider cwd instead of the process
      // tmpdir, matching the DR-024 read-only relocation.
      sandbox: process.env.CONSENSUS_LIVE_CODEX_SANDBOX ?? 'read-only',
      approval_policy: 'never',
    };
  }
  if (provider === 'claude') {
    return { permission_mode: 'read-only' };
  }
  return { permission_mode: 'non-interactive' };
}

function request(
  overrides: Partial<ConsensusCliRunRequest> = {},
): ConsensusCliRunRequest {
  return {
    schema_version: 'v1',
    provider: 'codex',
    schema_path: 'schema.json',
    prompt: 'Return JSON.',
    max_attempts: 1,
    ...overrides,
  };
}

function schema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['verdict'],
    properties: {
      verdict: { type: 'string' },
    },
  };
}

function livePrompt(nonce: string) {
  return [
    'This is a live E2E check for the consensus provider CLI.',
    `Submit exactly this JSON verdict using the command in CONSENSUS_SUBMIT_COMMAND: {"verdict":"${nonce}"}`,
    'Pass the JSON on stdin to that exact command.',
    'If the command reports a schema error, fix the payload and run it again before ending.',
    'After the submit command succeeds, end with only the same JSON object.',
  ].join('\n');
}
