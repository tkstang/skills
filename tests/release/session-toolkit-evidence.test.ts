import {
  mkdtemp,
  mkdir,
  writeFile,
  appendFile,
  rm,
  realpath,
  rename,
  symlink,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { readEvidence } from '../../packages/session-toolkit/src/index.js';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const call = (id: string, args: unknown) => ({
  type: 'response_item',
  payload: {
    type: 'function_call',
    call_id: id,
    name: 'exec_command',
    arguments: JSON.stringify(args),
  },
});
const result = (id: string, output: unknown) => ({
  type: 'response_item',
  payload: { type: 'function_call_output', call_id: id, output },
});
async function fixture(
  run: (home: string, path: string, cwd: string) => Promise<void>,
) {
  const home = await realpath(
      await mkdtemp(join(tmpdir(), 'seshtk-evidence-')),
    ),
    cwd = join(home, 'repo'),
    dir = join(home, '.codex/sessions/2026/10/29');
  await mkdir(cwd);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `rollout-2026-10-29T00-00-00-${ID}.jsonl`);
  await writeFile(
    path,
    [
      { type: 'session_meta', payload: { id: ID, cwd } },
      call('a', { cmd: 'example --token private-token-value' }),
      call('b', { cmd: 'other' }),
      result('a', 'x'.repeat(22000) + ' secret=edge-secret-value'),
      result('b', 'ok'),
      result('a', 'second result'),
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'Complete https://private.example' },
          ],
        },
      },
    ]
      .map((v) => JSON.stringify(v))
      .join('\n') + '\n',
  );
  try {
    await run(home, path, cwd);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
describe('public exact Codex evidence', () => {
  it('keeps native associations and redacts entire fields before bounded expansion', async () =>
    fixture(async (home) => {
      const options = { homeDir: home, session: `codex:${ID}` };
      const base = await readEvidence(options);
      const selected = base.activity!.events!.find(
        (e) => e.kind === 'call' && e.nativeCallId === 'a',
      )!;
      const expanded = await readEvidence({
        ...options,
        cutoff: base.evidence.cutoff,
        expand: selected.evidenceRef!,
        related: true,
      });
      const expansion = expanded.evidence.expansion as {
        locator: { recordIndex: number };
        output: {
          text?: string;
          nextOffsetBytes?: number;
          localTruncation?: boolean;
        };
        evidenceRef: string;
      }[];
      expect(expansion.map((e) => e.locator.recordIndex)).toEqual([1, 3, 5]);
      expect(expansion[1].output.localTruncation).toBe(true);
      expect(expansion[1].output.nextOffsetBytes).toBe(16384);
      const tail = await readEvidence({
        ...options,
        cutoff: base.evidence.cutoff,
        expand: expansion[1].evidenceRef,
        expandOffset: 16384,
      });
      const serialized = JSON.stringify([base, expanded, tail]);
      expect(serialized).not.toContain('private-token-value');
      expect(serialized).not.toContain('edge-secret-value');
      expect(serialized).not.toContain('private.example');
      expect(serialized).toContain('[REDACTED]');
    }));
  it('canonicalizes captured cwd aliases while binding cutoffs to the original directory', async () =>
    fixture(async (home, path, cwd) => {
      const alias = join(home, 'repo-alias');
      await symlink(cwd, alias, 'dir');
      const raw = (await readFile(path, 'utf8')).replace(
        JSON.stringify(cwd),
        JSON.stringify(alias),
      );
      await writeFile(path, raw);
      const options = { homeDir: home, session: `codex:${ID}` };
      const base = await readEvidence(options);
      expect(base.recordedCwd).toBe(cwd);
      expect(
        (await readEvidence({ ...options, cutoff: base.evidence.cutoff }))
          .evidence.cutoff,
      ).toBe(base.evidence.cutoff);
      expect(await readFile(path, 'utf8')).toBe(raw);
      const other = join(home, 'other-repo');
      await mkdir(other);
      await rm(alias);
      await symlink(other, alias, 'dir');
      await expect(
        readEvidence({ ...options, cutoff: base.evidence.cutoff }),
      ).rejects.toMatchObject({ code: 'E_CURSOR_INVALID' });
    }));
  it('freezes appends but refuses rewrite, shrink, replacement and foreign references', async () =>
    fixture(async (home, path) => {
      const options = { homeDir: home, session: `codex:${ID}` };
      const base = await readEvidence(options);
      await appendFile(path, JSON.stringify(result('a', 'later')) + '\n');
      const frozen = await readEvidence({
        ...options,
        cutoff: base.evidence.cutoff,
      });
      expect(frozen.evidence.cutoff).toBe(base.evidence.cutoff);
      expect(JSON.stringify(frozen)).not.toContain('later');
      const fresh = await readEvidence(options);
      expect(fresh.evidence.generationId).not.toBe(base.evidence.generationId);
      await expect(
        readEvidence({
          ...options,
          cutoff: base.evidence.cutoff,
          expand: fresh.activity!.events![0].evidenceRef!,
        }),
      ).rejects.toMatchObject({ code: 'E_CURSOR_INVALID' });
      await rename(path, path + '.old');
      await writeFile(path, '{}\n');
      await expect(
        readEvidence({ ...options, cutoff: base.evidence.cutoff }),
      ).rejects.toBeTruthy();
    }));
  it('retains source parse/usage coverage and caps related groups while preserving the selected event', async () =>
    fixture(async (home, path, cwd) => {
      await writeFile(
        path,
        [
          { type: 'session_meta', payload: { id: ID, cwd } },
          call('many', {}),
          ...Array.from({ length: 20 }, (_, i) => result('many', `result${i}`)),
          {
            type: 'event_msg',
            payload: {
              type: 'token_count',
              info: {
                total_token_usage: {
                  input_tokens: 50,
                  output_tokens: 7,
                  total_tokens: 57,
                },
              },
            },
          },
        ]
          .map((v) => JSON.stringify(v))
          .join('\n') + '\n{"partial":',
      );
      const options = { homeDir: home, session: `codex:${ID}` };
      const base = await readEvidence(options);
      expect(base.evidence.parseDiagnostics).toEqual([
        { kind: 'partial-tail', physicalLine: 24 },
      ]);
      expect(base.activity!.sourceMetadata.usage?.availability).toBe(
        'recorded',
      );
      const chosen = base
        .activity!.events!.filter((e) => e.kind === 'result')
        .at(-1)!;
      const expanded = await readEvidence({
        ...options,
        cutoff: base.evidence.cutoff,
        expand: chosen.evidenceRef!,
        related: true,
      });
      expect(expanded.evidence.relatedOmitted).toBe(5);
      expect(expanded.evidence.expansion).toHaveLength(16);
      expect(JSON.stringify(expanded.evidence.expansion)).toContain(
        chosen.evidenceRef!,
      );
    }));
  it('refuses unsupported providers and invalid controls before any discovery', async () => {
    await expect(
      readEvidence({ session: 'cursor:no-source' }),
    ).rejects.toMatchObject({ code: 'E_USAGE' });
    await expect(
      readEvidence({ session: `codex:${ID}`, expand: 'ref' }),
    ).rejects.toMatchObject({ code: 'E_USAGE' });
    await expect(
      readEvidence({ session: `codex:${ID}`, related: true }),
    ).rejects.toMatchObject({ code: 'E_USAGE' });
  });
});
