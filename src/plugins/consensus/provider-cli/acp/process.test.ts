import { describe, expect, it } from 'vitest';

import type { ProcessGroupOptions } from './process.js';
import { LineBuffer, spawnProcessGroup } from './process.js';

describe('LineBuffer', () => {
  it('reassembles lines split across chunks and keeps an unterminated rest', () => {
    const buffer = new LineBuffer();

    expect(buffer.push('{"a":')).toEqual([]);
    expect(buffer.push('1}\n{"b":2}\r\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
    expect(buffer.push(':3}')).toEqual([]);
    expect(buffer.flush()).toBe('{"c":3}');
    expect(buffer.flush()).toBeUndefined();
  });
});

function options(
  overrides: Partial<ProcessGroupOptions> & Pick<ProcessGroupOptions, 'argv'>,
): ProcessGroupOptions {
  return {
    executable: process.execPath,
    cwd: process.cwd(),
    env: { PATH: process.env.PATH },
    maxOutputBytes: 1024 * 1024,
    timeoutMs: 10_000,
    onLine: () => {},
    ...overrides,
  };
}

const TEARDOWN = { exitGraceMs: 1000, killGraceMs: 200, settleMs: 1000 };

describe('spawnProcessGroup', () => {
  it('reports a missing executable without starting anything', async () => {
    const spawned = await spawnProcessGroup(
      options({ executable: '/nonexistent/acp-agent', argv: [] }),
    );

    expect(spawned).toMatchObject({
      ok: false,
      reason: 'spawn_failed',
      errno: 'ENOENT',
    });
  });

  it('keeps stdin live, delivers stdout lines, and caps kept stderr', async () => {
    const lines: string[] = [];
    // Echoes each stdin line back once, writes 110 bytes of stderr ending
    // in a credential that the cap cuts, and exits when stdin closes.
    const source = [
      "process.stderr.write('ok\\nBearer ' + 'e'.repeat(100));",
      "let rest = '';",
      "process.stdin.on('data', (c) => { rest += c; let i; while ((i = rest.indexOf('\\n')) >= 0) { process.stdout.write('echo:' + rest.slice(0, i) + '\\n'); rest = rest.slice(i + 1); } });",
    ].join(' ');
    const spawned = await spawnProcessGroup(
      options({
        argv: ['-e', source],
        maxStderrBytes: 10,
        onLine: (line) => lines.push(line),
      }),
    );
    if (!spawned.ok) throw new Error(spawned.message);
    const { handle } = spawned;

    handle.write('one\n');
    await waitFor(() => lines.length === 1);
    handle.write('two\n');
    await waitFor(() => lines.length === 2);
    const teardown = await handle.teardown(TEARDOWN);

    expect(lines).toEqual(['echo:one', 'echo:two']);
    // The cut line ('Bearer eee…' kept as 'Bearer ') is dropped whole.
    expect(handle.stderr()).toBe('ok\n');
    expect(handle.outputBytes().stderr).toBe(110);
    // It exited on stdin close, so the group signal finds nothing left.
    expect(teardown).toMatchObject({
      exited_before_signal: true,
      signals: [],
      settled_by: 'group_gone',
    });
  });

  it('keeps stderr closed after a multibyte cut so a later newline cannot end the cut line', async () => {
    // Writes 'ok\nBearer eeeé' (2-byte é), then on stdin writes a lone
    // newline as a separate stderr chunk and exits.
    const source = [
      "process.stderr.write('ok\\nBearer eee\\u00e9');",
      "process.stdin.on('data', () => process.stderr.write('\\n', () => process.exit(0)));",
    ].join(' ');
    // One byte of room is left at the é, which the newline could fill.
    const spawned = await spawnProcessGroup(
      options({
        argv: ['-e', source],
        maxStderrBytes: 'ok\nBearer eee'.length + 1,
      }),
    );
    if (!spawned.ok) throw new Error(spawned.message);
    const { handle } = spawned;

    await waitFor(() => handle.outputBytes().stderr === 15);
    handle.write('go\n');
    await waitFor(() => handle.outputBytes().stderr === 16);
    await handle.teardown(TEARDOWN);

    expect(handle.stderr()).toBe('ok\n');
  });

  it.skipIf(process.platform === 'win32')(
    'forwards an interrupt to the caller and removes its listeners at teardown',
    async () => {
      const before = process.listenerCount('SIGINT');
      // A host listener keeps the forwarded signal from being re-raised on
      // the test process.
      const host = () => {};
      process.on('SIGINT', host);
      const interrupts: string[] = [];
      try {
        const spawned = await spawnProcessGroup(
          options({
            argv: ['-e', 'setInterval(() => {}, 1000)'],
            onInterrupt: (signal) => interrupts.push(signal),
          }),
        );
        if (!spawned.ok) throw new Error(spawned.message);
        const forwarders = process.listeners('SIGINT').slice(before + 1);
        expect(forwarders).toHaveLength(1);
        (forwarders[0] as (signal: NodeJS.Signals) => void)('SIGINT');

        const teardown = await spawned.handle.teardown({
          ...TEARDOWN,
          firstSignal: 'SIGINT',
          waitForExit: false,
        });
        spawned.handle.reraiseInterrupt();

        expect(interrupts).toEqual(['SIGINT']);
        expect(teardown.signals[0]).toBe('SIGINT');
        expect(process.listenerCount('SIGINT')).toBe(before + 1);
      } finally {
        process.removeListener('SIGINT', host);
      }
    },
  );
});

async function waitFor(condition: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition not met');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
