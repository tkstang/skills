import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  runSubmit,
  runConsensusCli,
  runPreflight,
  runProviderList,
} from '../../../src/consensus/provider-cli/commands.js';
import type { ProviderInventoryEntry } from '../../../src/consensus/provider-cli/types.js';
import { captureWriter } from '../../helpers/process.mjs';

describe('provider CLI command handlers', () => {
  it('returns provider inventory as a command envelope', async () => {
    await expect(
      runProviderList({ registry: providerEntries() }),
    ).resolves.toEqual({
      schema_version: 'v1',
      ok: true,
      providers: providerEntries(),
    });
  });

  it('keeps missing providers as entries instead of command failures', async () => {
    const envelope = await runProviderList({
      registry: [
        providerEntry('claude', 'ready'),
        providerEntry('codex', 'missing'),
      ],
    });

    expect(envelope.ok).toBe(true);
    expect(envelope.providers).toContainEqual(
      expect.objectContaining({
        id: 'codex',
        status: 'missing',
      }),
    );
  });

  it('reports usable preflight when selected providers are ready', async () => {
    await expect(
      runPreflight({ registry: providerEntries(['ready', 'ready']) }),
    ).resolves.toMatchObject({
      schema_version: 'v1',
      ok: true,
      usable: true,
      providers: [
        { id: 'claude', status: 'ready' },
        { id: 'codex', status: 'ready' },
      ],
    });
  });

  it('reports unusable provider-specific preflight for auth-required providers', async () => {
    await expect(
      runPreflight({
        provider: 'cursor',
        registry: [providerEntry('cursor', 'auth_required')],
      }),
    ).resolves.toMatchObject({
      ok: true,
      usable: false,
      providers: [{ id: 'cursor', status: 'auth_required' }],
    });
  });

  it('keeps envelope-level diagnostics command-level only', async () => {
    const envelope = await runPreflight({
      provider: 'missing-provider',
      registry: [],
    });

    expect(envelope).toEqual({
      schema_version: 'v1',
      ok: true,
      usable: false,
      providers: [
        expect.objectContaining({
          id: 'missing-provider',
          status: 'unsupported',
        }),
      ],
      diagnostics: {
        warnings: ['Requested provider is not registered: missing-provider'],
      },
    });
  });

  it('routes parsed commands and centralizes stdout writing', async () => {
    const stdout = captureWriter();
    const stderr = captureWriter();
    const code = await runConsensusCli(
      ['provider', 'ls', '--json'],
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        stdin: process.stdin,
        cwd: '/workspace',
        readFile: unexpectedRead,
        readStdin: unexpectedRead,
      },
      { registry: [providerEntry('claude', 'missing')] },
    );

    expect(code).toBe(0);
    expect(stderr.value()).toBe('');
    expect(JSON.parse(stdout.value())).toMatchObject({
      ok: true,
      providers: [{ id: 'claude', status: 'missing' }],
    });
  });

  it('writes exactly one SubmitResult JSON line on stdout for valid submissions', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'consensus-submit-'));
    try {
      const outPath = path.join(tempDir, 'capture.json');
      const stdout = captureWriter();
      const stderr = captureWriter();

      const code = await runSubmit(
        {
          kind: 'submit',
          json: true,
          verdictSource: { kind: 'stdin' },
          schemaPath: 'schema.json',
          outPath,
        },
        submitIo({
          stdout,
          stderr,
          stdin: '{"verdict":"accept"}',
          files: { 'schema.json': JSON.stringify(schema()) },
        }),
      );

      expect(code).toBe(0);
      expect(stderr.value()).toBe('');
      expect(stdout.value().trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(stdout.value())).toEqual({
        schema_version: 'v1',
        ok: true,
        captured: true,
        message: 'verdict captured',
      });
      expect(JSON.parse(await readFile(outPath, 'utf8'))).toEqual({
        verdict: 'accept',
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns ok:false JSON and mirrors schema errors to stderr', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'consensus-submit-'));
    try {
      const stdout = captureWriter();
      const stderr = captureWriter();

      const code = await runSubmit(
        {
          kind: 'submit',
          json: true,
          verdictSource: { kind: 'stdin' },
          schemaPath: 'schema.json',
          outPath: path.join(tempDir, 'capture.json'),
        },
        submitIo({
          stdout,
          stderr,
          stdin: '{"other":"value"}',
          files: { 'schema.json': JSON.stringify(schema()) },
        }),
      );

      expect(code).toBe(1);
      expect(stdout.value().trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(stdout.value())).toEqual({
        schema_version: 'v1',
        ok: false,
        captured: false,
        message: 'Missing required JSON field: verdict',
      });
      expect(stderr.value()).toContain(
        'Missing required JSON field: verdict',
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not overwrite a prior valid capture with an invalid submission', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'consensus-submit-'));
    try {
      const outPath = path.join(tempDir, 'capture.json');
      const files = { 'schema.json': JSON.stringify(schema()) };

      await runSubmit(
        {
          kind: 'submit',
          json: true,
          verdictSource: { kind: 'stdin' },
          schemaPath: 'schema.json',
          outPath,
        },
        submitIo({
          stdout: captureWriter(),
          stderr: captureWriter(),
          stdin: '{"verdict":"accept"}',
          files,
        }),
      );

      const stdout = captureWriter();
      const stderr = captureWriter();
      const code = await runSubmit(
        {
          kind: 'submit',
          json: true,
          verdictSource: { kind: 'stdin' },
          schemaPath: 'schema.json',
          outPath,
        },
        submitIo({
          stdout,
          stderr,
          stdin: '{"other":"value"}',
          files,
        }),
      );

      expect(code).toBe(1);
      expect(JSON.parse(await readFile(outPath, 'utf8'))).toEqual({
        verdict: 'accept',
      });
      expect(JSON.parse(stdout.value())).toMatchObject({
        ok: false,
        captured: false,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function providerEntries(
  statuses: Array<ProviderInventoryEntry['status']> = ['ready', 'ready'],
) {
  return [providerEntry('claude', statuses[0]), providerEntry('codex', statuses[1])];
}

function providerEntry(
  id: string,
  status: ProviderInventoryEntry['status'],
): ProviderInventoryEntry {
  return {
    id,
    status,
    capabilities: {
      schema_strategies: ['prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  };
}

async function unexpectedRead(): Promise<string> {
  throw new Error('Unexpected IO read');
}

function schema() {
  return {
    type: 'object',
    required: ['verdict'],
    properties: {
      verdict: { type: 'string' },
    },
  };
}

function submitIo(options: {
  stdout: ReturnType<typeof captureWriter>;
  stderr: ReturnType<typeof captureWriter>;
  stdin: string;
  files: Record<string, string>;
  env?: Record<string, string | undefined>;
}) {
  return {
    stdout: options.stdout.stream,
    stderr: options.stderr.stream,
    stdin: process.stdin,
    cwd: '/workspace',
    env: options.env,
    async readFile(filePath: string) {
      const contents = options.files[filePath];
      if (contents === undefined) {
        throw new Error(`Unexpected file read: ${filePath}`);
      }
      return contents;
    },
    async readStdin() {
      return options.stdin;
    },
  };
}
