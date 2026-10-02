import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  adapterContext,
  claudeAssistant,
  claudeToolResult,
  claudeUser,
  codexMessage,
  codexSessionMeta,
  codexToolOutput,
  codexWorldState,
  cursorAssistant,
  cursorTurnEnded,
  cursorUser,
  DAY_MS,
  makeTempHome,
  writeClaudeSession,
  writeCodexRollout,
  writeCursorTranscript,
  type TempHome,
} from '../helpers/test-helpers.js';
import { createClaudeCodeAdapter } from './adapters/claude-code.js';
import { createCodexAdapter } from './adapters/codex.js';
import { createCursorAdapter } from './adapters/cursor.js';
import { compileMatcher } from './matcher.js';
import {
  isPrefilterSafe,
  isRawToolCarrier,
  prefilterWithRg,
  scanFile,
  scanFiles,
  type ScanOptions,
} from './scan.js';
import { probeTools } from './tools.js';
import type { Runtime, SessionFile, SourceAdapter } from './types.js';

const RG = probeTools(process.env).rg;
const NOW = Date.now();
const CODEX_ID = '019a0000-0000-7000-8000-00000000aaaa';
const CHILD_ID = '019a0000-0000-7000-8000-00000000bbbb';

let temp: TempHome;
let adapters: Record<Runtime, SourceAdapter>;

beforeEach(() => {
  temp = makeTempHome('session-search-scan-');
  adapters = {
    'claude-code': createClaudeCodeAdapter(),
    codex: createCodexAdapter(),
    cursor: createCursorAdapter(),
  };
});

afterEach(() => {
  temp.cleanup();
});

const adapterFor = (runtime: Runtime) => adapters[runtime];
const options = (overrides: Partial<ScanOptions> = {}): ScanOptions => ({
  maxLineBytes: 64 * 1024,
  includeTools: false,
  maxHitsPerSession: 25,
  ...overrides,
});

async function enumerateAll(raw = { pattern: ['x'] }): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  for (const adapter of Object.values(adapters)) {
    const { ctx } = adapterContext(adapter, temp, { raw });
    files.push(...(await adapter.enumerate(ctx)));
  }
  return files;
}

async function onlyFile(): Promise<SessionFile> {
  const files = await enumerateAll();
  expect(files).toHaveLength(1);
  return files[0];
}

describe('scanFile', () => {
  it('splits records on LF only, keeping U+2028/U+2029 inside strings', async () => {
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [claudeUser(e, 'line one perceive now end')],
    });
    const file = await onlyFile();

    const { hits, stats } = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['perceive now'], { literal: true }),
      options(),
    );

    expect(stats.parseErrors).toBe(0);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      role: 'user',
      userTyped: true,
      tier: 'content',
      text: 'line one perceive now end',
    });
  });

  it('skips and counts oversize lines without parsing them', async () => {
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeUser(e, `${'pad '.repeat(1000)}perceive now`),
        claudeAssistant(e, 'perceive now, short'),
      ],
    });
    const file = await onlyFile();

    const { hits, stats } = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['perceive now'], { literal: true }),
      options({ maxLineBytes: 2048 }),
    );

    expect(stats.linesSkippedOversize).toBe(1);
    expect(hits.map((hit) => hit.role)).toEqual(['assistant']);
  });

  it('matches tool output only with includeTools, labeled deep', async () => {
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeUser(e, 'list the chats'),
        claudeToolResult(e, 'toolu_1', 'ChatGPT: Perceive Now vetting'),
      ],
    });
    const file = await onlyFile();
    const matcher = compileMatcher(['perceive now'], { literal: true });

    const content = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher,
      options(),
    );
    const deep = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher,
      options({ includeTools: true }),
    );

    expect(content.hits).toEqual([]);
    expect(deep.hits).toEqual([
      expect.objectContaining({ role: 'tool', tier: 'deep', userTyped: false }),
    ]);
  });

  it('stops a file after maxHitsPerSession hits', async () => {
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) =>
        Array.from({ length: 10 }, (_, i) =>
          claudeAssistant(e, `zebra note ${i}`),
        ),
    });
    const file = await onlyFile();

    const { hits } = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['zebra'], { literal: true }),
      options({ maxHitsPerSession: 3 }),
    );

    expect(hits.map((hit) => hit.text)).toEqual([
      'zebra note 0',
      'zebra note 1',
      'zebra note 2',
    ]);
  });
});

describe('deep raw fallback for oversize lines', () => {
  const bigOutput = `${'log line\n'.repeat(12_000)}ChatGPT thread: Perceive Now vetting`;

  it('still finds a phrase inside an oversize function_call_output line', async () => {
    writeCodexRollout(temp.home, {
      id: CODEX_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: CODEX_ID, cwd: '/work/repo' }),
        codexToolOutput('function_call_output', 'call_1', bigOutput, 1),
      ],
    });
    const file = await onlyFile();
    const matcher = compileMatcher(['perceive now'], { literal: true });

    const content = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher,
      options(),
    );
    const deep = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher,
      options({ includeTools: true }),
    );

    expect(content.hits).toEqual([]);
    expect(content.stats.linesSkippedOversize).toBe(1);
    expect(deep.stats.linesSkippedOversize).toBe(1);
    expect(deep.hits).toEqual([
      expect.objectContaining({ role: 'tool', tier: 'deep', userTyped: false }),
    ]);
  });

  it('never raw-matches an oversize world_state line', async () => {
    writeCodexRollout(temp.home, {
      id: CODEX_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: CODEX_ID, cwd: '/work/repo' }),
        codexWorldState(
          `# AGENTS.md\n${'rule\n'.repeat(20_000)}Perceive Now policy`,
          1,
        ),
      ],
    });
    const file = await onlyFile();

    const deep = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['perceive now'], { literal: true }),
      options({ includeTools: true }),
    );

    expect(deep.stats.linesSkippedOversize).toBe(1);
    expect(deep.hits).toEqual([]);
  });

  it('skips an oversize inherited line in a child rollout', async () => {
    writeCodexRollout(temp.home, {
      id: CHILD_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({
          id: CHILD_ID,
          sessionId: CODEX_ID,
          cwd: '/work/repo',
          subagentHistoryStartOrdinal: 5,
        }),
        codexToolOutput('function_call_output', 'inherited', bigOutput, 3),
        codexMessage('user', 'own work', 5),
        codexToolOutput('function_call_output', 'own', bigOutput, 6),
      ],
    });
    const file = await onlyFile();
    expect(file.subagentHistoryStartOrdinal).toBe(5);

    const deep = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['perceive now'], { literal: true }),
      options({ includeTools: true }),
    );

    expect(deep.stats.linesSkippedOversize).toBe(2);
    expect(deep.hits).toHaveLength(1);
    expect(deep.hits[0].fromSubagent).toBe(true);
  });

  it('recognizes only known tool-output carriers from the line prefix', () => {
    expect(
      isRawToolCarrier(
        '{"timestamp":"t","ordinal":3,"type":"response_item","payload":{"type":"custom_tool_call_output","call_id":"c"',
      ),
    ).toBe(true);
    expect(
      isRawToolCarrier(
        '{"timestamp":"t","ordinal":3,"type":"event_msg","payload":{"type":"item_completed","thread_id":"a","turn_id":"b","item":{"type":"McpToolCall"',
      ),
    ).toBe(true);
    expect(
      isRawToolCarrier(
        '{"parentUuid":null,"type":"user","message":{"role":"user","content":[{"tool_use_id":"x","type":"tool_result"',
      ),
    ).toBe(true);
    expect(
      isRawToolCarrier(
        '{"timestamp":"t","ordinal":0,"type":"session_meta","payload":{"id":"x"',
      ),
    ).toBe(false);
    expect(
      isRawToolCarrier(
        '{"timestamp":"t","ordinal":1,"type":"response_item","payload":{"type":"message"',
      ),
    ).toBe(false);
  });
});

describe('rg prefilter safety', () => {
  it('accepts only patterns whose raw matches are a superset of decoded matches', () => {
    for (const safe of [
      'perceive now',
      'perceive.*now',
      'a.+b',
      '(foo|bar) baz',
      '(?:x|y)z',
    ]) {
      expect(isPrefilterSafe(safe, false)).toBe(true);
    }
    for (const unsafe of [
      'perceive\\s*now',
      'foo.bar',
      'foo.?bar',
      'foo.{2}bar',
      'foo[ -~]bar',
      '[^x]',
      '^start',
      'end$',
      'colou?r',
      '(?=look)',
      'say "hi"',
      'café',
    ]) {
      expect(isPrefilterSafe(unsafe, false)).toBe(false);
    }
    expect(isPrefilterSafe('a.b*c', true)).toBe(true);
    expect(isPrefilterSafe('say "hi"', true)).toBe(false);
  });
});

describe.skipIf(RG === null)('rg prefilter against the Node scan', () => {
  async function corpus(): Promise<SessionFile[]> {
    writeClaudeSession(temp.home, {
      cwd: '/work/a',
      records: (e) => [claudeUser(e, 'we discussed Perceive Now here')],
    });
    writeClaudeSession(temp.home, {
      cwd: '/work/b',
      records: (e) => [claudeUser(e, 'unrelated topic')],
    });
    writeCodexRollout(temp.home, {
      id: CODEX_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: CODEX_ID, cwd: '/work/c' }),
        codexMessage('assistant', 'perceive   now is a ChatGPT thread', 1),
      ],
    });
    writeCursorTranscript(temp.home, {
      cwd: '/work/d',
      records: [
        cursorUser('nothing to see'),
        cursorAssistant('ok'),
        cursorTurnEnded(),
      ],
    });
    return enumerateAll();
  }

  it('returns the same matching file set as a full Node scan', async () => {
    const files = await corpus();
    const matcher = compileMatcher(['perceive.*now'], { literal: false });

    const node = await scanFiles(files, adapterFor, matcher, {
      ...options(),
      rg: null,
    });
    const prefilter = prefilterWithRg(
      RG as string,
      matcher.patterns,
      files.map((file) => file.path),
      { literal: false },
    );

    expect(prefilter.note).toBeNull();
    expect([...(prefilter.files ?? [])].toSorted()).toEqual(
      [...new Set(node.hits.map((hit) => hit.transcriptPath))].toSorted(),
    );
  });

  it('gives identical hits with and without rg', async () => {
    const files = await corpus();
    const matcher = compileMatcher(['perceive', 'chatgpt'], { literal: false });

    const node = await scanFiles(files, adapterFor, matcher, {
      ...options(),
      rg: null,
    });
    const withRg = await scanFiles(files, adapterFor, matcher, {
      ...options(),
      rg: RG,
    });

    expect(node.hits).toHaveLength(2);
    expect(withRg.hits).toEqual(node.hits);
    expect(withRg.notes).toEqual([]);
  });

  it.each([
    ['perceive\\s*now', 'perceive\nnow'],
    ['foo.bar', 'foo"bar'],
    ['foo[ -~]bar', 'foo"bar and foo\\bar'],
  ])(
    'skips the prefilter for %s so decoded matches survive',
    async (pattern, text) => {
      writeClaudeSession(temp.home, {
        cwd: '/work/a',
        records: (e) => [claudeUser(e, text)],
      });
      const files = await enumerateAll();
      const matcher = compileMatcher([pattern], { literal: false });

      const node = await scanFiles(files, adapterFor, matcher, {
        ...options(),
        rg: null,
      });
      const withRg = await scanFiles(files, adapterFor, matcher, {
        ...options(),
        rg: RG,
      });

      expect(node.hits).toHaveLength(1);
      expect(withRg.hits).toEqual(node.hits);
      expect(withRg.notes).toHaveLength(1);
    },
  );
});
