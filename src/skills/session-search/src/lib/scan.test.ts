import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  adapterContext,
  claudeAssistant,
  claudeToolResult,
  claudeToolUse,
  claudeUser,
  codexFunctionCall,
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

  it('never marks a subagent transcript user-role match as user-typed', async () => {
    const session = writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [claudeAssistant(e, 'parent only')],
      subagents: [
        {
          agentId: 'a3333333333333333',
          records: (e) => [claudeUser(e, 'delegated zebra task')],
        },
      ],
    });
    const files = await enumerateAll();
    const agent = files.find((file) => file.path === session.subagentPaths[0]);
    expect(agent?.isSubagent).toBe(true);

    const { hits } = await scanFile(
      agent as SessionFile,
      adapterFor('claude-code'),
      compileMatcher(['zebra'], { literal: true }),
      options(),
    );

    expect(
      hits.map((hit) => [hit.role, hit.userTyped, hit.fromSubagent]),
    ).toEqual([['user', false, true]]);
  });

  it('credits a later pattern after the per-file hit cap is reached', async () => {
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        ...Array.from({ length: 30 }, (_, i) =>
          claudeAssistant(e, `zebra ${i}`),
        ),
        claudeAssistant(e, 'finally an okapi'),
        claudeAssistant(e, 'zebra after both'),
      ],
    });
    const file = await onlyFile();

    const { hits } = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['zebra', 'okapi'], { literal: true }),
      options({ maxHitsPerSession: 25 }),
    );

    expect(hits).toHaveLength(26);
    expect(hits.at(-1)?.patterns).toEqual(['okapi']);
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

describe('ask-user exchanges on the content tier', () => {
  const matcher = () => compileMatcher(['okapi-stripes'], { literal: true });

  it('finds a Claude AskUserQuestion answer without includeTools', async () => {
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        claudeToolUse(e, 'toolu_ask', 'AskUserQuestion', {
          questions: [
            {
              question: 'Which animal pattern?',
              header: 'Pattern',
              options: [{ label: 'okapi-stripes' }, { label: 'spots' }],
            },
          ],
        }),
        claudeAssistant(e, 'waiting for the answer'),
        {
          ...claudeToolResult(
            e,
            'toolu_ask',
            'User has answered your questions: "Which animal pattern?"="okapi-stripes"',
          ),
          toolUseResult: {
            questions: [
              { question: 'Which animal pattern?', header: 'Pattern' },
            ],
            answers: { 'Which animal pattern?': 'okapi-stripes' },
          },
        },
      ],
    });
    const file = await onlyFile();

    const { hits } = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher(),
      options(),
    );

    const answer = hits.find((hit) => hit.role === 'user');
    expect(answer).toMatchObject({ tier: 'content', userTyped: true });
    expect(answer?.text).toContain('okapi-stripes');
  });

  it('finds a Codex request_user_input answer without includeTools', async () => {
    writeCodexRollout(temp.home, {
      id: CODEX_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: CODEX_ID, cwd: '/work/repo' }),
        codexFunctionCall(
          'call_ask',
          'request_user_input',
          {
            questions: [
              {
                id: 'q1',
                header: 'Pattern',
                question: 'Which animal pattern?',
                options: [{ label: 'striped' }, { label: 'spotted' }],
              },
            ],
          },
          1,
        ),
        codexMessage('assistant', 'waiting', 2),
        codexToolOutput(
          'function_call_output',
          'call_ask',
          JSON.stringify({ answers: { q1: { answers: ['okapi-stripes'] } } }),
          3,
        ),
      ],
    });
    const file = await onlyFile();

    const { hits } = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher(),
      options(),
    );
    const question = await scanFile(
      file,
      adapterFor(file.runtime),
      compileMatcher(['which animal pattern'], { literal: true }),
      options(),
    );

    expect(hits.map((hit) => [hit.role, hit.tier])).toEqual([
      ['user', 'content'],
    ]);
    expect(question.hits.map((hit) => [hit.role, hit.tier])).toEqual([
      ['assistant', 'content'],
    ]);
  });
});

describe('ask-user answers: untruncated, emitted once', () => {
  const askCall = (e: Parameters<typeof claudeToolUse>[0]) =>
    claudeToolUse(e, 'toolu_ask', 'AskUserQuestion', {
      questions: [
        {
          question: 'Which animal pattern?',
          header: 'Pattern',
          options: [{ label: 'stripes' }, { label: 'spots' }],
        },
      ],
    });

  it('matches a Claude answer past the 500-character display limit', async () => {
    const answer = `${'long free-text reasoning '.repeat(30)}okapi-late`;
    expect(answer.indexOf('okapi-late')).toBeGreaterThan(600);
    writeClaudeSession(temp.home, {
      cwd: '/work/repo',
      records: (e) => [
        askCall(e),
        {
          ...claudeToolResult(
            e,
            'toolu_ask',
            'User has answered your questions.',
          ),
          toolUseResult: {
            questions: [
              { question: 'Which animal pattern?', header: 'Pattern' },
            ],
            answers: { 'Which animal pattern?': answer },
          },
        },
      ],
    });
    const file = await onlyFile();
    const matcher = compileMatcher(['okapi-late'], { literal: true });

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

    expect(
      content.hits.map((hit) => [hit.role, hit.tier, hit.userTyped]),
    ).toEqual([['user', 'content', true]]);
    expect(deep.hits.map((hit) => hit.role)).toEqual(['user']);
  });

  it('emits Codex ask-user questions and answers once on the deep tier', async () => {
    writeCodexRollout(temp.home, {
      id: CODEX_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: CODEX_ID, cwd: '/work/repo' }),
        codexFunctionCall(
          'call_ask',
          'request_user_input',
          {
            questions: [
              {
                id: 'q1',
                header: 'Pattern',
                question: 'Which animal pattern?',
                options: [{ label: 'striped' }],
              },
            ],
          },
          1,
        ),
        codexToolOutput(
          'function_call_output',
          'call_ask',
          JSON.stringify({ answers: { q1: { answers: ['okapi-stripes'] } } }),
          2,
        ),
      ],
    });
    const file = await onlyFile();
    const deep = (pattern: string) =>
      scanFile(
        file,
        adapterFor(file.runtime),
        compileMatcher([pattern], { literal: true }),
        options({ includeTools: true }),
      );

    expect((await deep('okapi-stripes')).hits.map((hit) => hit.role)).toEqual([
      'user',
    ]);
    expect(
      (await deep('which animal pattern')).hits.map((hit) => hit.role),
    ).toEqual(['assistant']);
  });
});

describe('agent-authored Codex threads', () => {
  it.each([
    [{ subagent: 'review' }],
    [{ subagent: 'memory_consolidation' }],
    [{ subagent: { other: 'guardian' } }],
  ])(
    'never scores user-role text from source %j as user-typed',
    async (source) => {
      writeCodexRollout(temp.home, {
        id: CODEX_ID,
        startedAtMs: NOW - DAY_MS,
        records: [
          codexSessionMeta({ id: CODEX_ID, cwd: '/work/repo', source }),
          codexMessage(
            'user',
            'restating perceive now from another session',
            1,
          ),
        ],
      });
      const file = await onlyFile();
      expect(file.agentAuthored).toBe(true);

      const { hits } = await scanFile(
        file,
        adapterFor(file.runtime),
        compileMatcher(['perceive now'], { literal: true }),
        options(),
      );

      expect(hits.map((hit) => [hit.role, hit.userTyped])).toEqual([
        ['user', false],
      ]);
    },
  );
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

  it('skips the prefilter on the deep tier, where text is decoded twice', async () => {
    // The inner JSON escapes '/', so the raw bytes read `src\\/foo`.
    const encoded = '{"output":"opened src\\/foo in the editor"}';
    writeCodexRollout(temp.home, {
      id: CODEX_ID,
      startedAtMs: NOW - DAY_MS,
      records: [
        codexSessionMeta({ id: CODEX_ID, cwd: '/work/repo' }),
        codexToolOutput('function_call_output', 'call_1', encoded, 1),
      ],
    });
    const files = await enumerateAll();
    const matcher = compileMatcher(['src/foo'], { literal: true });
    const deep = { ...options({ includeTools: true }) };

    const node = await scanFiles(files, adapterFor, matcher, {
      ...deep,
      rg: null,
    });
    const withRg = await scanFiles(files, adapterFor, matcher, {
      ...deep,
      rg: RG,
    });

    expect(node.hits).toHaveLength(1);
    expect(withRg.hits).toEqual(node.hits);
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
