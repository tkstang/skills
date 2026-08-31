import { describe, expect, test, vi } from 'vitest';

import {
  runHandoffCli,
  type HandoffCliDependencies,
  type HandoffCliIo,
} from '../../src/transcript/coding-session-handoff/cli.js';

const EMPTY_BATCH = {
  schemaVersion: 1 as const,
  planDigest: 'd'.repeat(64),
  items: [],
  retryableKeys: [],
};

function harness(overrides: Partial<HandoffCliDependencies> = {}) {
  let stdout = '';
  let stderr = '';
  const io: HandoffCliIo = {
    stdin: async () => JSON.stringify(EMPTY_BATCH),
    stdout: (value) => {
      stdout += value;
    },
    stderr: (value) => {
      stderr += value;
    },
  };
  const services: HandoffCliDependencies = {
    discover: vi.fn(async () => [{ key: 'codex:one' }]),
    preview: vi.fn(async () => [{ key: 'codex:one', rounds: [] }]),
    plan: vi.fn(async () => ({ confirmationDigest: 'a'.repeat(64) })),
    execute: vi.fn(async () => ({ schemaVersion: 1, items: [] })),
    reconcile: vi.fn(async () => ({ schemaVersion: 1, items: [] })),
    behaviorPlan: vi.fn(async () => ({ confirmationDigest: 'b'.repeat(64) })),
    behaviorVerify: vi.fn(async () => ({
      provider: 'codex',
      status: 'passed',
      receiptDigest: 'c'.repeat(64),
      reasonCodes: [],
    })),
    readInputFile: vi.fn(async () => JSON.stringify(EMPTY_BATCH)),
    ...overrides,
  };
  return {
    io,
    services,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

function parsedSingleObject(stdout: string) {
  expect(stdout.endsWith('\n')).toBe(true);
  expect(stdout.trim().split('\n')).toHaveLength(1);
  return JSON.parse(stdout);
}

describe('seven-command routing', () => {
  test.each([
    {
      command: 'discover',
      argv: [
        'discover',
        '--source',
        '/repo;literal',
        '--provider',
        'all',
        '--json',
      ],
      method: 'discover',
      expected: ['/repo;literal', 'all'],
    },
    {
      command: 'preview',
      argv: [
        'preview',
        '--source',
        '/repo',
        '--session',
        'codex:one',
        '--session',
        'claude:two',
        '--rounds',
        '4',
        '--max-chars',
        '500',
        '--json',
      ],
      method: 'preview',
      expected: ['/repo', ['codex:one', 'claude:two'], 4, 500],
    },
    {
      command: 'plan',
      argv: [
        'plan',
        '--source',
        '/source',
        '--target',
        '/target',
        '--session',
        'codex:one;literal',
        '--mode',
        'successor',
        '--json',
      ],
      method: 'plan',
      expected: [
        '/source',
        '/target',
        { sessions: ['codex:one;literal'] },
        'successor',
      ],
    },
    {
      command: 'execute',
      argv: [
        'execute',
        '--source',
        '/source',
        '--target',
        '/target',
        '--all',
        '--mode',
        'successor',
        '--confirm',
        'a'.repeat(64),
        '--json',
      ],
      method: 'execute',
      expected: [
        '/source',
        '/target',
        { all: true },
        'successor',
        'a'.repeat(64),
      ],
    },
    {
      command: 'reconcile',
      argv: [
        'reconcile',
        '--source',
        '/source',
        '--target',
        '/target',
        '--input',
        '-',
        '--json',
      ],
      method: 'reconcile',
      expected: ['/source', '/target', EMPTY_BATCH],
    },
    {
      command: 'behavior-plan',
      argv: ['behavior-plan', '--provider', 'codex', '--json'],
      method: 'behaviorPlan',
      expected: ['codex'],
    },
    {
      command: 'behavior-verify',
      argv: [
        'behavior-verify',
        '--provider',
        'claude',
        '--confirm',
        'b'.repeat(64),
        '--receipt',
        '/tmp/new-receipt.json',
        '--json',
      ],
      method: 'behaviorVerify',
      expected: ['claude', 'b'.repeat(64), '/tmp/new-receipt.json'],
    },
  ])('routes $command with one JSON envelope', async (entry) => {
    const run = harness();
    const exitCode = await runHandoffCli(entry.argv, run.services, run.io);
    expect(exitCode).toBe(0);
    expect(
      run.services[entry.method as keyof HandoffCliDependencies] as any,
    ).toHaveBeenCalledWith(...entry.expected);
    expect(parsedSingleObject(run.stdout())).toMatchObject({
      ok: true,
      command: entry.command,
    });
    expect(run.stderr()).toBe('');
  });
});

describe('strict parsing and safe output', () => {
  test.each([
    [
      'implicit selection',
      ['plan', '--source', '/s', '--target', '/t', '--mode', 'successor'],
    ],
    [
      'bare ID',
      [
        'plan',
        '--source',
        '/s',
        '--target',
        '/t',
        '--session',
        'bare-id',
        '--mode',
        'successor',
      ],
    ],
    [
      'force option',
      [
        'execute',
        '--source',
        '/s',
        '--target',
        '/t',
        '--all',
        '--mode',
        'successor',
        '--confirm',
        'a'.repeat(64),
        '--force',
      ],
    ],
    ['recency option', ['discover', '--source', '/s', '--recent', '1']],
    [
      'plan mode on execute',
      [
        'execute',
        '--source',
        '/s',
        '--target',
        '/t',
        '--all',
        '--mode',
        'plan',
        '--confirm',
        'a'.repeat(64),
      ],
    ],
  ])('rejects %s before calling services', async (_name, argv) => {
    const run = harness();
    expect(await runHandoffCli([...argv, '--json'], run.services, run.io)).toBe(
      2,
    );
    expect(parsedSingleObject(run.stdout())).toMatchObject({
      ok: false,
      error: { code: 'invalid-arguments' },
    });
    expect(run.services.plan).not.toHaveBeenCalled();
    expect(run.services.execute).not.toHaveBeenCalled();
  });

  test('requires exact confirmation digests before execute or behavior verification', async () => {
    const run = harness();
    const exitCode = await runHandoffCli(
      [
        'execute',
        '--source',
        '/s',
        '--target',
        '/t',
        '--all',
        '--mode',
        'successor',
        '--confirm',
        'short',
        '--json',
      ],
      run.services,
      run.io,
    );
    expect(exitCode).toBe(2);
    expect(run.services.execute).not.toHaveBeenCalled();
  });

  test('reports explicit --all over zero candidates as invalid selection', async () => {
    const plan = vi.fn(async () => {
      throw Object.assign(new Error('invalid-selection'), {
        code: 'invalid-selection',
      });
    });
    const run = harness({ plan });

    const exitCode = await runHandoffCli(
      [
        'plan',
        '--source',
        '/s',
        '--target',
        '/t',
        '--all',
        '--mode',
        'successor',
        '--json',
      ],
      run.services,
      run.io,
    );

    expect(exitCode).toBe(2);
    expect(parsedSingleObject(run.stdout())).toMatchObject({
      ok: false,
      command: 'plan',
      error: { code: 'invalid-selection' },
    });
    expect(plan).toHaveBeenCalledTimes(1);
  });

  test('caps reconcile input at 1 MiB before JSON parsing', async () => {
    const run = harness({
      readInputFile: vi.fn(async () => 'x'.repeat(1024 * 1024 + 1)),
    });
    const exitCode = await runHandoffCli(
      [
        'reconcile',
        '--source',
        '/s',
        '--target',
        '/t',
        '--input',
        '/private/outcome.json',
        '--json',
      ],
      run.services,
      run.io,
    );
    expect(exitCode).toBe(2);
    expect(run.stdout()).not.toContain('/private/outcome.json');
    expect(run.services.reconcile).not.toHaveBeenCalled();
  });

  test('maps capability refusals to exit 3 with path-free stable errors', async () => {
    const run = harness({
      behaviorPlan: vi.fn(async () => {
        throw Object.assign(new Error('/private/raw provider output'), {
          code: 'provider-auth-required',
        });
      }),
    });
    const exitCode = await runHandoffCli(
      ['behavior-plan', '--provider', 'codex', '--json'],
      run.services,
      run.io,
    );
    expect(exitCode).toBe(3);
    expect(parsedSingleObject(run.stdout())).toEqual({
      ok: false,
      command: 'behavior-plan',
      error: {
        code: 'provider-auth-required',
        message: 'Provider authentication is required.',
      },
    });
    expect(run.stdout()).not.toContain('/private');
  });

  test('labels unverified plans without offering a bypass', async () => {
    const run = harness({
      plan: vi.fn(async () => ({
        confirmationDigest: 'a'.repeat(64),
        items: [
          {
            key: 'codex:one',
            disposition: 'deferred',
            reasonCodes: ['behavior-unverified'],
          },
        ],
      })),
    });
    const exitCode = await runHandoffCli(
      [
        'plan',
        '--source',
        '/s',
        '--target',
        '/t',
        '--all',
        '--mode',
        'successor',
      ],
      run.services,
      run.io,
    );
    expect(exitCode).toBe(0);
    expect(run.stdout()).toContain('behavior-unverified');
    expect(run.stdout()).not.toContain('force');
    expect(run.stdout()).not.toContain('allow-unverified');
  });

  test('does not pass raw provider control fields through JSON results', async () => {
    const run = harness({
      execute: vi.fn(async () => ({
        schemaVersion: 1,
        planDigest: 'a'.repeat(64),
        items: [],
        retryableKeys: [],
      })),
    });
    await runHandoffCli(
      [
        'execute',
        '--source',
        '/s',
        '--target',
        '/t',
        '--all',
        '--mode',
        'successor',
        '--confirm',
        'a'.repeat(64),
        '--json',
      ],
      run.services,
      run.io,
    );
    expect(run.stdout()).not.toContain('stdout');
    expect(run.stdout()).not.toContain('stderr');
    expect(run.stdout()).not.toContain('thread.started');
  });
});
