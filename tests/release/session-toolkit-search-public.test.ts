import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  searchSessions,
  estimateSearch,
  parseTranscript,
} from '../../packages/session-toolkit/src/index.js';
import {
  makeTempHome,
  searchEnv,
  writeCodexRollout,
  codexSessionMeta,
  codexToolOutput,
  codexMessage,
  type TempHome,
} from '../helpers/session-toolkit-search.js';
let temp: TempHome;
const id = '019a0000-0000-7000-8000-000000000111';
beforeEach(() => {
  temp = makeTempHome('seshtk-search-public-');
});
afterEach(() => temp.cleanup());
function options() {
  return {
    home: temp.home,
    env: searchEnv(temp),
    runtime: 'codex' as const,
    patterns: ['retained-marker'],
    deep: false,
  };
}
function fixture() {
  return writeCodexRollout(temp.home, {
    id,
    startedAtMs: Date.now(),
    records: [
      codexSessionMeta({ id, cwd: '/work/fixture' }),
      codexMessage('user', 'ordinary question', 1),
      codexToolOutput(
        'function_call_output',
        'call',
        'x'.repeat(1500) + ' retained-marker tail',
        2,
      ),
    ],
  });
}
function cli(args: string[]) {
  return spawnSync(
    process.execPath,
    [resolve('packages/session-toolkit/dist/bin.js'), ...args, '--json'],
    { env: { ...process.env, ...searchEnv(temp) }, encoding: 'utf8' },
  );
}
it('searches full tool output absent from the lossy conversation projection', async () => {
  const file = fixture();
  const digest = await parseTranscript({
    runtime: 'codex',
    path: file,
    includeToolResults: true,
  });
  expect(JSON.stringify(digest.messages)).not.toContain('retained-marker');
  expect((await searchSessions(options())).results).toEqual([]);
  const result = await searchSessions({ ...options(), includeTools: true });
  expect(result.results[0].snippets[0].text).toContain('retained-marker');
  expect(result.results[0].snippets[0].role).toBe('tool');
  expect(result.incomplete).toBe(false);
});
it('refuses oversized scans with an actionable estimate until explicitly authorized', async () => {
  fixture();
  const input = { ...options(), includeTools: true, largeScanBytes: 1 };
  const estimate = await estimateSearch(input);
  expect(estimate).toMatchObject({
    exceedsLargeScan: true,
    totalFiles: 1,
    incomplete: false,
  });
  expect(estimate.totalBytes).toBeGreaterThan(1500);
  await expect(searchSessions(input)).rejects.toMatchObject({
    code: 'E_SCAN_CONFIRMATION',
    details: {
      estimate: {
        estimatedBytes: estimate.totalBytes,
        rerunFlag: '--allow-large-scan',
      },
    },
  });
  expect(
    (await searchSessions({ ...input, allowLargeScan: true })).results,
  ).toHaveLength(1);
  const refusal = cli([
    'search',
    '-p',
    'retained-marker',
    '--runtime',
    'codex',
    '--include-tools',
    '--large-scan-bytes',
    '1',
  ]);
  expect(refusal.status).toBe(1);
  expect(JSON.parse(refusal.stdout)).toMatchObject({
    ok: false,
    error: { code: 'E_SCAN_CONFIRMATION' },
  });
  expect(refusal.stderr).toBe('');
});
it('validates API queries and CLI regex/literal/estimate nesting', async () => {
  fixture();
  for (const patterns of [[], [''], ['[']])
    await expect(
      searchSessions({ ...options(), patterns }),
    ).rejects.toMatchObject({ code: 'E_USAGE' });
  const regex = cli([
    'search',
    '-p',
    'ordinary.*question',
    '--runtime',
    'codex',
  ]);
  expect(regex.status).toBe(0);
  expect(JSON.parse(regex.stdout).data.results).toHaveLength(1);
  const literal = cli([
    'search',
    '-p',
    'ordinary.*question',
    '--literal',
    '--runtime',
    'codex',
  ]);
  expect(JSON.parse(literal.stdout).data.results).toEqual([]);
  const estimate = cli([
    'search',
    'estimate',
    '-p',
    'ordinary',
    '--runtime',
    'codex',
    '--large-scan-bytes',
    '1',
  ]);
  expect(estimate.status).toBe(0);
  expect(JSON.parse(estimate.stdout).data).toMatchObject({
    exceedsLargeScan: true,
    totalFiles: 1,
  });
  expect(cli(['search', 'estimate', '--help']).status).toBe(0);
});
