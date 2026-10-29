import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  identifyCurrentTranscript,
  revalidateCurrentTranscript,
} from '../../packages/session-toolkit/src/identity.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof fs>();
  return {
    ...original,
    opendir: vi.fn(original.opendir),
    open: vi.fn(original.open),
    realpath: vi.fn(original.realpath),
  };
});

const THREAD = '019c7714-3b77-74d1-9866-e1f484aae2ab';
const OTHER = '019c6e27-e55b-73d1-87d8-4e01f1f75043';
const SECRET = 'sentinel-api-key-and-endpoint-never-report';
let home: string;
let cwd: string;

beforeEach(async () => {
  vi.resetAllMocks();
  home = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'orc-identity-')));
  cwd = join(home, 'repo');
  await fs.mkdir(cwd);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(home, { recursive: true, force: true });
});

function identify(
  env: Record<string, string | undefined>,
  maxEntries?: number,
) {
  return identifyCurrentTranscript({ cwd, homeDir: home, env, maxEntries });
}
async function write(path: string, content = SECRET) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content);
  return path;
}
async function codex({
  id = THREAD,
  metadataId = id,
  metadataCwd = cwd,
  day = '04',
}: {
  id?: string;
  metadataId?: string;
  metadataCwd?: string;
  day?: string;
} = {}) {
  return write(
    join(
      home,
      '.codex',
      'sessions',
      '2026',
      '10',
      day,
      `rollout-2026-10-${day}T10-20-30-${id}.jsonl`,
    ),
    `${JSON.stringify({ type: 'session_meta', payload: { id: metadataId, cwd: metadataCwd, secret: SECRET } })}\n${SECRET}\n`,
  );
}
function claudePath(id = THREAD, project = cwd.replace(/[/.]/g, '-')) {
  return join(home, '.claude', 'projects', project, `${id}.jsonl`);
}
function cursorPath(
  id = THREAD,
  project = cwd.split(/[/.]/).filter(Boolean).join('-'),
) {
  return join(
    home,
    '.cursor',
    'projects',
    project,
    'agent-transcripts',
    id,
    `${id}.jsonl`,
  );
}

describe('identifyCurrentTranscript', () => {
  it('proves Codex filename, metadata ID and canonical cwd without exposing content or changing bytes', async () => {
    const alias = join(home, 'cwd-alias');
    await fs.symlink(cwd, alias);
    const path = await codex({ metadataCwd: alias });
    const bytes = await fs.readFile(path);
    const result = await identify({
      CODEX_THREAD_ID: THREAD,
      CODEX_SESSION_ID: OTHER,
      API_KEY: SECRET,
      PASSWORD: 'a',
    });
    expect(result).toEqual({
      runtime: 'codex',
      status: 'authoritative',
      runtimeId: THREAD,
      parentSessionId: OTHER,
      transcriptMetadataId: THREAD,
      idSource: 'CODEX_THREAD_ID',
      path,
      matchCount: 1,
      scanSaturated: false,
      warningCodes: [],
      contract: 'observed',
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(await fs.readFile(path)).toEqual(bytes);
  });

  it('never selects the parent grouping ID or newest unrelated rollout', async () => {
    await codex({ id: OTHER });
    const grouping = await identify({ CODEX_SESSION_ID: OTHER });
    expect(grouping).toMatchObject({
      runtime: 'codex',
      status: 'unavailable',
      runtimeId: null,
      parentSessionId: OTHER,
      path: null,
      matchCount: 0,
    });
    expect(await identify({ CODEX_THREAD_ID: THREAD })).toMatchObject({
      status: 'corroborated',
      path: null,
      matchCount: 0,
    });
  });

  it.each([
    '../escape',
    '',
    ' id123456 ',
    'short',
    'bad/id123456',
    SECRET + '\n',
  ])(
    'rejects malformed explicit IDs without exposing their values: %j',
    async (id) => {
      const result = await identify({ CODEX_THREAD_ID: id });
      expect(result).toMatchObject({
        status: 'invalid',
        runtimeId: null,
        path: null,
      });
      expect(JSON.stringify(result)).not.toContain(SECRET);
    },
  );

  it('requires the entire Codex filename ID, not a matching suffix', async () => {
    const path = await codex();
    await fs.rename(
      path,
      path.replace(`-${THREAD}.jsonl`, `-${OTHER}-${THREAD}.jsonl`),
    );
    expect(await identify({ CODEX_THREAD_ID: THREAD })).toMatchObject({
      status: 'corroborated',
      path: null,
      matchCount: 0,
    });
  });

  it.each([
    'CODEX_SESSION_ID',
    'CODEX_THREAD_ID',
    'CLAUDE_CODE_SESSION_ID',
    'CURSOR_CONVERSATION_ID',
  ])(
    'rejects a sensitive environment value collision in %s before returning IDs or paths',
    async (name) => {
      // UUID shape alone is insufficient when the same value is known to be a credential.
      await codex();
      await write(claudePath());
      await write(cursorPath());
      const result = await identify({ [name]: THREAD, API_TOKEN: THREAD });
      expect(result).toMatchObject({
        status: 'invalid',
        runtimeId: null,
        parentSessionId: null,
        path: null,
        transcriptMetadataId: null,
      });
      expect(JSON.stringify(result)).not.toContain(THREAD);
    },
  );

  it.each([
    'credential-secret-001',
    'sk-live-secret123',
    'ghp_123456789abcdef',
    'github_pat_123456789abcdef',
    'api.private.example',
    '127.0.0.1',
    'localhost',
  ])(
    'rejects recognizable credential and endpoint IDs without a collision: %s',
    async (value) => {
      const result = await identify({ CODEX_SESSION_ID: value });
      expect(result).toMatchObject({
        status: 'invalid',
        parentSessionId: null,
        runtimeId: null,
        path: null,
      });
      expect(JSON.stringify(result)).not.toContain(value);
    },
  );

  it.each(['replacement', 'rewrite'])(
    'rejects a Codex %s during canonical metadata cwd validation',
    async (change) => {
      const path = await codex();
      const originalFs = await vi.importActual<typeof fs>('node:fs/promises');
      let cwdChecks = 0;
      vi.mocked(fs.realpath).mockImplementation(async (input) => {
        if (input === cwd && ++cwdChecks === 2) {
          const replacement = `${JSON.stringify({ type: 'session_meta', payload: { id: OTHER, cwd } })}\n`;
          if (change === 'replacement') {
            const next = join(home, 'replacement.jsonl');
            await originalFs.writeFile(next, replacement);
            await originalFs.rename(next, path);
          } else {
            await originalFs.writeFile(path, replacement);
          }
        }
        return originalFs.realpath(input);
      });
      const result = await identify({ CODEX_THREAD_ID: THREAD });
      expect(cwdChecks).toBe(2);
      expect(result).toMatchObject({
        status: 'invalid',
        path: null,
        transcriptMetadataId: null,
        warningCodes: ['W_TRANSCRIPT_CHANGED'],
      });
    },
  );

  it('fails closed for conflicting providers and aliases, including malformed alternatives', async () => {
    expect(
      await identify({ CODEX_THREAD_ID: THREAD, CURSOR_SESSION_ID: OTHER }),
    ).toMatchObject({ runtime: 'unknown', status: 'ambiguous', path: null });
    expect(
      await identify({
        CURSOR_SESSION_ID: THREAD,
        CURSOR_CONVERSATION_ID: OTHER,
      }),
    ).toMatchObject({ status: 'ambiguous', runtimeId: null, path: null });
    expect(
      await identify({
        CLAUDE_CODE_SESSION_ID: THREAD,
        CLAUDE_SESSION_ID: '../bad',
      }),
    ).toMatchObject({ status: 'invalid', runtimeId: null, path: null });
    expect(
      await identify({
        CODEX_THREAD_ID: THREAD,
        CODEX_SESSION_ID: THREAD,
        OPENAI_CODEX_SESSION_ID: OTHER,
      }),
    ).toMatchObject({ status: 'ambiguous', parentSessionId: null, path: null });
  });

  it.each(['wrong-id', 'wrong-cwd', 'malformed', 'partial', 'oversized'])(
    'rejects %s Codex initial metadata',
    async (failure) => {
      const otherCwd = join(home, 'other-repo');
      await fs.mkdir(otherCwd);
      const path = await codex({
        metadataId: failure === 'wrong-id' ? OTHER : THREAD,
        metadataCwd: failure === 'wrong-cwd' ? otherCwd : cwd,
      });
      if (failure === 'malformed') await fs.writeFile(path, '{not-json}\n');
      if (failure === 'partial')
        await fs.writeFile(
          path,
          JSON.stringify({
            type: 'session_meta',
            payload: { id: THREAD, cwd },
          }),
        );
      if (failure === 'oversized')
        await fs.writeFile(path, 'x'.repeat(256 * 1024) + '\n');
      expect(await identify({ CODEX_THREAD_ID: THREAD })).toMatchObject({
        status: 'invalid',
        path: null,
        transcriptMetadataId: null,
        matchCount: 1,
      });
    },
  );

  it('fails closed when an exact duplicate exists even if its metadata is invalid', async () => {
    await codex();
    await codex({ day: '03', metadataId: OTHER });
    expect(await identify({ CODEX_THREAD_ID: THREAD })).toMatchObject({
      status: 'ambiguous',
      path: null,
      matchCount: 2,
    });
  });

  it('fails closed on a saturated scan even after finding one exact file', async () => {
    await codex();
    await write(join(home, '.codex', 'sessions', '2026', '10', '04', 'extra'));
    const result = await identify({ CODEX_THREAD_ID: THREAD }, 4);
    expect(result).toMatchObject({
      status: 'ambiguous',
      scanSaturated: true,
      path: null,
    });
    expect(result.warningCodes).toContain('W_SCAN_SATURATED');
    await fs.unlink(
      join(home, '.codex', 'sessions', '2026', '10', '04', 'extra'),
    );
    expect(await identify({ CODEX_THREAD_ID: THREAD }, 4)).toMatchObject({
      status: 'authoritative',
      scanSaturated: false,
    });
  });

  it('rejects invalid scan budgets and handles inaccessible scans without diagnostics leaking raw errors', async () => {
    await codex();
    expect(await identify({ CODEX_THREAD_ID: THREAD }, 0)).toMatchObject({
      status: 'invalid',
      path: null,
    });
    vi.spyOn(fs, 'opendir').mockRejectedValue(
      Object.assign(new Error(SECRET), { code: 'EACCES' }),
    );
    const result = await identify({ CODEX_THREAD_ID: THREAD });
    expect(result).toMatchObject({ status: 'unavailable', path: null });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it.each(['file', 'directory', 'root'])(
    'refuses a symlink at the %s boundary',
    async (boundary) => {
      const path = await codex();
      const target =
        boundary === 'file'
          ? path
          : boundary === 'directory'
            ? dirname(path)
            : join(home, '.codex');
      const moved = join(home, 'moved');
      await fs.rename(target, moved);
      await fs.symlink(moved, target);
      expect(await identify({ CODEX_THREAD_ID: THREAD })).toMatchObject({
        path: null,
      });
      expect((await identify({ CODEX_THREAD_ID: THREAD })).status).not.toBe(
        'authoritative',
      );
    },
  );

  it('rejects mismatched ownership before trusting provider paths', async () => {
    await codex();
    const uid = process.getuid!();
    vi.spyOn(process, 'getuid').mockReturnValue(uid + 1);
    expect(await identify({ CODEX_THREAD_ID: THREAD })).toMatchObject({
      status: 'invalid',
      path: null,
      warningCodes: ['W_UNSAFE_PROVIDER_ROOT'],
    });
  });

  it('selects only a Claude direct project-root transcript and keeps its bytes unchanged', async () => {
    const root = await write(claudePath());
    const bytes = await fs.readFile(root);
    await write(join(dirname(root), THREAD, 'subagents', `${THREAD}.jsonl`));
    expect(await identify({ CLAUDE_CODE_SESSION_ID: THREAD })).toMatchObject({
      runtime: 'claude-code',
      status: 'authoritative',
      path: root,
      transcriptMetadataId: null,
      matchCount: 1,
    });
    expect(await fs.readFile(root)).toEqual(bytes);
    await fs.unlink(root);
    expect(await identify({ CLAUDE_SESSION_ID: THREAD })).toMatchObject({
      status: 'corroborated',
      path: null,
      matchCount: 0,
    });
  });

  it('refuses a unique exact file in another cwd project and duplicate root IDs', async () => {
    await write(claudePath(THREAD, 'another-project'));
    expect(await identify({ CLAUDE_SESSION_ID: THREAD })).toMatchObject({
      status: 'invalid',
      path: null,
      warningCodes: ['W_CWD_MISMATCH'],
    });
    await write(claudePath());
    expect(await identify({ CLAUDE_SESSION_ID: THREAD })).toMatchObject({
      status: 'ambiguous',
      path: null,
      matchCount: 2,
    });
  });

  it.each(['CURSOR_SESSION_ID', 'CURSOR_CONVERSATION_ID'])(
    'supports observed %s exact layout without reading transcript content',
    async (name) => {
      const path = await write(cursorPath());
      const bytes = await fs.readFile(path);
      const openSpy = vi.spyOn(fs, 'open');
      const result = await identify({ [name]: THREAD, TOKEN: SECRET });
      expect(result).toMatchObject({
        runtime: 'cursor',
        status: 'authoritative',
        path,
        idSource: name,
        contract: 'observed',
      });
      expect(openSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain(SECRET);
      expect(await fs.readFile(path)).toEqual(bytes);
    },
  );

  it.each(['claude-code', 'cursor'])(
    'rejects a %s symlink replacement during final canonical path resolution',
    async (runtime) => {
      const path = await write(
        runtime === 'claude-code' ? claudePath() : cursorPath(),
      );
      const originalBytes = await fs.readFile(path);
      const originalFs = await vi.importActual<typeof fs>('node:fs/promises');
      const outside = join(home, 'outside-provider.jsonl');
      let candidateChecks = 0;
      vi.mocked(fs.realpath).mockImplementation(async (input) => {
        if (input === path && ++candidateChecks === 2) {
          await originalFs.rename(path, outside);
          await originalFs.symlink(outside, path);
        }
        return originalFs.realpath(input);
      });
      const env =
        runtime === 'claude-code'
          ? { CLAUDE_SESSION_ID: THREAD }
          : { CURSOR_CONVERSATION_ID: THREAD };
      const result = await identify(env);
      expect(candidateChecks).toBe(2);
      expect(result).toMatchObject({
        status: 'invalid',
        path: null,
        warningCodes: ['W_TRANSCRIPT_CHANGED'],
      });
      expect(JSON.stringify(result)).not.toContain(SECRET);
      expect(await fs.readFile(outside)).toEqual(originalBytes);
    },
  );

  it('does not accept a Cursor filename in the wrong ID directory or project', async () => {
    await write(join(dirname(dirname(cursorPath())), OTHER, `${THREAD}.jsonl`));
    expect(await identify({ CURSOR_SESSION_ID: THREAD })).toMatchObject({
      status: 'corroborated',
      path: null,
      matchCount: 0,
    });
    await write(cursorPath(THREAD, 'another-project'));
    expect(await identify({ CURSOR_SESSION_ID: THREAD })).toMatchObject({
      status: 'invalid',
      path: null,
      warningCodes: ['W_CWD_MISMATCH'],
    });
  });

  it('returns unknown without guessing from process decoration or unrelated environment', async () => {
    expect(
      await identify({ TERM_PROGRAM: 'Cursor', API_KEY: SECRET }),
    ).toMatchObject({
      runtime: 'unknown',
      status: 'unavailable',
      runtimeId: null,
      path: null,
      contract: null,
    });
  });
});

describe('revalidateCurrentTranscript', () => {
  it('rescans uniqueness after a probe, detecting newly created duplicates', async () => {
    await codex();
    const env = { CODEX_THREAD_ID: THREAD };
    const previous = await identify(env);
    await codex({ day: '03' });
    expect(
      await revalidateCurrentTranscript(previous, { cwd, homeDir: home, env }),
    ).toMatchObject({ status: 'ambiguous', path: null, matchCount: 2 });
  });
  it('removes stale paths and refuses a newly selected thread', async () => {
    const path = await codex();
    const previous = await identify({ CODEX_THREAD_ID: THREAD });
    await fs.unlink(path);
    expect(
      await revalidateCurrentTranscript(previous, {
        cwd,
        homeDir: home,
        env: { CODEX_THREAD_ID: THREAD },
      }),
    ).toMatchObject({ status: 'corroborated', path: null });
    await codex({ id: OTHER });
    expect(
      await revalidateCurrentTranscript(previous, {
        cwd,
        homeDir: home,
        env: { CODEX_THREAD_ID: OTHER },
      }),
    ).toMatchObject({
      status: 'ambiguous',
      path: null,
      warningCodes: ['W_IDENTITY_CHANGED'],
    });
  });
});
