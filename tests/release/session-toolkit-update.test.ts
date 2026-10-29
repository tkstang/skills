import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { beforeEach, afterEach, expect, it } from 'vitest';

let dir: string, preload: string, requests: string, transcript: string;
const bin = resolve('packages/session-toolkit/dist/bin.js');
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seshtk-update-'));
  requests = join(dir, 'requests.jsonl');
  preload = join(dir, 'network-boundary.mjs');
  transcript = join(dir, 'fixture.jsonl');
  writeFileSync(
    transcript,
    JSON.stringify({ type: 'user', message: { content: 'fixture question' } }) +
      '\n',
  );
  // Only external network and process TTY facts are controlled. The real built bin, command parser, updater and filesystem run.
  writeFileSync(
    preload,
    `import { appendFileSync } from 'node:fs';
Object.defineProperty(process.stdin, 'isTTY', { value: process.env.FIXTURE_STDIN_TTY === '1' });
Object.defineProperty(process.stderr, 'isTTY', { value: process.env.FIXTURE_STDERR_TTY === '1' });
globalThis.fetch = async (url, options) => {
 appendFileSync(process.env.FIXTURE_REQUESTS, JSON.stringify({url, timeout: !!options.signal}) + '\\n');
 if (process.env.FIXTURE_NETWORK === 'offline') throw new Error('offline');
 if (process.env.FIXTURE_NETWORK === 'timeout') return await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 60000); options.signal.addEventListener('abort', () => { clearTimeout(timer); appendFileSync(process.env.FIXTURE_REQUESTS + '.aborted', 'aborted'); reject(options.signal.reason); }); });
 if (process.env.FIXTURE_NETWORK === 'invalid-json') return new Response('broken');
 return new Response(JSON.stringify({ version: process.env.FIXTURE_LATEST || '0.2.0' }));
};`,
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
function run(
  args = ['parse', transcript, '--runtime', 'claude-code'],
  extra: NodeJS.ProcessEnv = {},
  library = false,
) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(preload).href,
      ...(library
        ? [
            '--input-type=module',
            '-e',
            `await import(${JSON.stringify(pathToFileURL(resolve('packages/session-toolkit/dist/index.js')).href)});`,
          ]
        : [bin, ...args]),
    ],
    {
      env: {
        ...process.env,
        HOME: dir,
        XDG_CACHE_HOME: join(dir, 'cache'),
        CI: '',
        SESHTK_NO_UPDATE_CHECK: '',
        FIXTURE_REQUESTS: requests,
        FIXTURE_STDIN_TTY: '1',
        FIXTURE_STDERR_TTY: '1',
        ...extra,
      },
      encoding: 'utf8',
      timeout: 5000,
    },
  );
}
function calls() {
  return existsSync(requests)
    ? readFileSync(requests, 'utf8').trim().split('\n').length
    : 0;
}
function cache(value: unknown) {
  const directory = join(dir, 'cache/session-toolkit');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'update.json'),
    typeof value === 'string' ? value : JSON.stringify(value),
  );
}
it('notifies only on stderr for a newer stable release and reuses its24-hour cache offline', () => {
  const first = run();
  expect(first.status).toBe(0);
  expect(first.stdout).toBe('[user] fixture question\n');
  expect(first.stderr).toContain('0.2.0 is available');
  expect(calls()).toBe(1);
  const cached = run(undefined, { FIXTURE_NETWORK: 'offline' });
  expect(cached.status).toBe(0);
  expect(cached.stdout).toBe(first.stdout);
  expect(cached.stderr).toBe(first.stderr);
  expect(calls()).toBe(1);
});
it.each(['0.1.0', '0.0.9', '0.2.0-beta.1', 'not-a-version'])(
  'stays quiet for current/older/nonstable registry version %s',
  (version) => {
    const result = run(undefined, { FIXTURE_LATEST: version });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(calls()).toBe(1);
  },
);
it.each(['offline', 'invalid-json'])(
  'keeps operations successful and caches failed lookup: %s',
  (network) => {
    const first = run(undefined, { FIXTURE_NETWORK: network });
    expect(first.status).toBe(0);
    expect(first.stderr).toBe('');
    const second = run();
    expect(second.status).toBe(0);
    expect(second.stderr).toBe('');
    expect(calls()).toBe(1);
  },
);
it('refreshes malformed/expired caches and uses the default cache root when XDG is absent', () => {
  cache('{broken');
  expect(run().stderr).toContain('0.2.0');
  expect(calls()).toBe(1);
  cache({ checkedAt: Date.now() - 25 * 3600000, latest: '0.2.0' });
  expect(run(undefined, { FIXTURE_LATEST: '0.1.0' }).stderr).toBe('');
  expect(calls()).toBe(2);
  const fallback = run(undefined, { XDG_CACHE_HOME: '' });
  expect(fallback.status).toBe(0);
  expect(existsSync(join(dir, '.cache/session-toolkit/update.json'))).toBe(
    true,
  );
  expect(calls()).toBe(3);
});
it('aborts an unresponsive registry at the1-second request deadline', () => {
  const started = Date.now();
  const result = run(undefined, { FIXTURE_NETWORK: 'timeout' });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(calls()).toBe(1);
  expect(readFileSync(requests + '.aborted', 'utf8')).toBe('aborted');
  expect(Date.now() - started).toBeLessThan(2000);
});
it('performs zero network/cache I/O or notices for every suppressed context and library import', () => {
  const quiet: [string[], NodeJS.ProcessEnv][] = [
    [['parse', transcript, '--runtime', 'claude-code', '--json'], {}],
    [['--json', 'parse', transcript, '--runtime', 'claude-code'], {}],
    [['capabilities'], {}],
    [['--help'], {}],
    [['parse', '--help'], {}],
    [['--version'], {}],
    [[], {}],
    [['parse', transcript, '--runtime', 'claude-code'], { CI: '1' }],
    [
      ['parse', transcript, '--runtime', 'claude-code'],
      { SESHTK_NO_UPDATE_CHECK: '1' },
    ],
    [
      ['parse', transcript, '--runtime', 'claude-code'],
      { FIXTURE_STDIN_TTY: '0' },
    ],
    [
      ['parse', transcript, '--runtime', 'claude-code'],
      { FIXTURE_STDERR_TTY: '0' },
    ],
  ];
  for (const [args, env] of quiet) {
    const result = run(args, env);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  }
  const imported = run([], {}, true);
  expect(imported.status).toBe(0);
  expect(imported.stdout).toBe('');
  expect(imported.stderr).toBe('');
  expect(calls()).toBe(0);
  expect(existsSync(join(dir, 'cache'))).toBe(false);
  expect(existsSync(join(dir, '.cache'))).toBe(false);
});
