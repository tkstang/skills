import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createRecordsWriter,
  writeLoopStatus
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs';

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

test('createRecordsWriter writes a valid JSON array after each append', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-records-'));
  const recordsPath = path.join(tempRoot, 'records.json');
  const writer = await createRecordsWriter(recordsPath, {
    now: () => '2026-05-04T01:00:00.000Z'
  });

  await writer.append({ turn: 1, verdict: { decision: 'ACCEPT' }, raw_paseo_response: { id: 'raw' } });

  assert.deepEqual(await readJson(recordsPath), [
    {
      schema_version: 'v0',
      recorded_at: '2026-05-04T01:00:00.000Z',
      turn: 1,
      verdict: { decision: 'ACCEPT' },
      raw_paseo_response: { id: 'raw' }
    }
  ]);

  await writer.append({ turn: 2, verdict: { decision: 'ACCEPT' } });
  await writer.close();

  const records = await readJson(recordsPath);
  assert.equal(records.length, 2);
  assert.equal(records[1].schema_version, 'v0');
});

test('createRecordsWriter can continue from a one-record write-through file', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-records-'));
  const recordsPath = path.join(tempRoot, 'records.json');
  const firstWriter = await createRecordsWriter(recordsPath);
  await firstWriter.append({ turn: 1, verdict: { decision: 'REVISE' } });

  const secondWriter = await createRecordsWriter(recordsPath);
  await secondWriter.append({ turn: 2, verdict: { decision: 'ACCEPT' } });
  await secondWriter.close();

  const records = await readJson(recordsPath);
  assert.deepEqual(
    records.map((record) => record.turn),
    [1, 2]
  );
});

test('writeLoopStatus emits stable status fields and paseo cost metadata', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-status-'));
  const statusPath = path.join(tempRoot, 'status.json');

  await writeLoopStatus(
    statusPath,
    {
      status: 'converged',
      termination_reason: 'hash_match',
      turns: 2,
      rounds: 1,
      peers: ['claude', 'codex'],
      cost: { source: 'paseo', usd: 0.0123 }
    },
    { now: () => '2026-05-04T01:02:00.000Z' }
  );

  assert.deepEqual(await readJson(statusPath), {
    schema_version: 'v0',
    written_at: '2026-05-04T01:02:00.000Z',
    status: 'converged',
    termination_reason: 'hash_match',
    turns: 2,
    rounds: 1,
    peers: ['claude', 'codex'],
    cost_source: 'paseo',
    cost_usd: 0.0123
  });
});

test('writeLoopStatus supports estimated and unavailable cost branches', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-status-'));
  const estimatedPath = path.join(tempRoot, 'estimated.json');
  const unavailablePath = path.join(tempRoot, 'unavailable.json');

  await writeLoopStatus(estimatedPath, { status: 'max_rounds', cost_source: 'estimated', cost_usd: 0.25 });
  await writeLoopStatus(unavailablePath, { status: 'impasse' });

  assert.equal((await readJson(estimatedPath)).cost_source, 'estimated');
  assert.equal((await readJson(estimatedPath)).cost_usd, 0.25);
  assert.equal((await readJson(unavailablePath)).cost_source, 'unavailable');
  assert.equal('cost_usd' in (await readJson(unavailablePath)), false);
});
