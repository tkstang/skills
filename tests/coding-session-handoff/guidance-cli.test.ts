import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import {
  runGuidanceCli,
  type GuidanceCliDependencies,
  type GuidanceCliIo,
} from '../../src/transcript/coding-session-handoff/guidance-cli.js';

const execFileAsync = promisify(execFile);

function harness() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: GuidanceCliIo = {
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  };
  const dependencies: GuidanceCliDependencies = {
    discover: vi.fn(async () => ({ candidates: [], unattributable: [] })),
    preview: vi.fn(async () => []),
    prepare: vi.fn(async () => ({ status: 'experimental-not-released' })),
  };
  return { io, dependencies, stdout, stderr };
}

describe('experimental guidance CLI', () => {
  it('exposes only discover, preview, and prepare', async () => {
    const test = harness();
    expect(await runGuidanceCli(['--help'], test.dependencies, test.io)).toBe(
      0,
    );
    const help = test.stdout.join('');
    expect(help).toContain('discover --source');
    expect(help).toContain('preview --source');
    expect(help).toContain('prepare --source');
    expect(help).toContain('EXPERIMENTAL / NOT RELEASED');
    expect(help).not.toMatch(
      /\bexecute\b|behavior-verify|reconcile|behavior-plan/,
    );
  });

  it('routes discovery for all providers without inferring current identity', async () => {
    const test = harness();
    expect(
      await runGuidanceCli(
        ['discover', '--source', '/repo/source', '--provider', 'all', '--json'],
        test.dependencies,
        test.io,
      ),
    ).toBe(0);
    expect(test.dependencies.discover).toHaveBeenCalledWith(
      '/repo/source',
      'all',
    );
    expect(JSON.parse(test.stdout[0])).toMatchObject({
      ok: true,
      command: 'discover',
      status: 'experimental-not-released',
      currentSelection: 'explicit-required',
      data: { candidates: [], unattributable: [] },
    });
  });

  it('requires an explicit qualified source for preview and prepare', async () => {
    const preview = harness();
    expect(
      await runGuidanceCli(
        [
          'preview',
          '--source',
          '/repo/source',
          '--session',
          'codex:cli:source-id',
          '--json',
        ],
        preview.dependencies,
        preview.io,
      ),
    ).toBe(0);
    expect(preview.dependencies.preview).toHaveBeenCalledWith(
      '/repo/source',
      'codex:cli:source-id',
    );

    const prepare = harness();
    expect(
      await runGuidanceCli(
        [
          'prepare',
          '--source',
          '/repo/source',
          '--target',
          '/repo/target',
          '--session',
          'claude:cli:source-id',
          '--entry-point',
          'destination-fresh',
          '--json',
        ],
        prepare.dependencies,
        prepare.io,
      ),
    ).toBe(0);
    expect(prepare.dependencies.prepare).toHaveBeenCalledWith(
      '/repo/source',
      '/repo/target',
      'claude:cli:source-id',
      'destination-fresh',
    );
  });

  it.each([
    ['source-current', 'codex:cli:00000000-0000-4000-8000-000000000001'],
    ['source-other', 'claude:cli:00000000-0000-4000-8000-000000000002'],
    ['destination-fresh', 'codex:cli:00000000-0000-4000-8000-000000000003'],
    ['destination-fresh', 'cursor:ambiguous:synthetic-cursor-session'],
  ] as const)(
    'routes the %s entry point for %s without invoking a provider',
    async (entryPoint, qualifiedSession) => {
      const test = harness();

      expect(
        await runGuidanceCli(
          [
            'prepare',
            '--source',
            '/synthetic/source',
            '--target',
            '/synthetic/destination',
            '--session',
            qualifiedSession,
            '--entry-point',
            entryPoint,
            '--json',
          ],
          test.dependencies,
          test.io,
        ),
      ).toBe(0);
      expect(test.dependencies.prepare).toHaveBeenCalledOnce();
      expect(test.dependencies.prepare).toHaveBeenCalledWith(
        '/synthetic/source',
        '/synthetic/destination',
        qualifiedSession,
        entryPoint,
      );
      expect(JSON.parse(test.stdout[0])).toMatchObject({
        status: 'experimental-not-released',
        noForkCreated: true,
      });
    },
  );

  it('keeps the operator-facing docs explicit about the paused executor and unsupported Cursor transitions', async () => {
    const toolReadme = await readFile(
      new URL('../../tools/coding-session-handoff/README.md', import.meta.url),
      'utf8',
    );
    const userGuide = await readFile(
      new URL(
        '../../documentation/docs/user-guide/skills/coding-session-handoff.md',
        import.meta.url,
      ),
      'utf8',
    );

    for (const document of [toolReadme, userGuide]) {
      expect(document).toMatch(/experimental/i);
      expect(document).toMatch(/not released/i);
      expect(document).toMatch(/no fork/i);
      expect(document).toMatch(/source-current/);
      expect(document).toMatch(/source-other/);
      expect(document).toMatch(/destination-fresh/);
      expect(document).toMatch(/Cursor/);
      expect(document).toMatch(/unsupported/i);
    }
    expect(toolReadme).toMatch(/paused/i);
    expect(toolReadme).toMatch(/unverified/i);
  });

  it('states that current Cursor discovery cannot produce selectable candidates', async () => {
    const skill = await readFile(
      new URL('../../skills/coding-session-handoff/SKILL.md', import.meta.url),
      'utf8',
    );
    const providerGuidance = await readFile(
      new URL(
        '../../skills/coding-session-handoff/references/provider-guidance.md',
        import.meta.url,
      ),
      'utf8',
    );
    const userGuide = await readFile(
      new URL(
        '../../documentation/docs/user-guide/skills/coding-session-handoff.md',
        import.meta.url,
      ),
      'utf8',
    );

    for (const document of [skill, providerGuidance, userGuide]) {
      expect(document).toMatch(/independent exact cwd evidence/i);
      expect(document).toMatch(/discovery-incomplete/);
      expect(document).toMatch(
        /no Cursor candidate can be selected\s+or\s+previewed/i,
      );
      expect(document).not.toMatch(/An ambiguous Cursor candidate/i);
    }
  });

  it('resolves every shipped command from the installed skill directory', async () => {
    const skill = await readFile(
      new URL('../../skills/coding-session-handoff/SKILL.md', import.meta.url),
      'utf8',
    );

    expect(skill).not.toContain(
      'node skills/coding-session-handoff/scripts/coding-session-handoff.mjs',
    );
    expect(
      skill.match(/node <skill-dir>\/scripts\/coding-session-handoff\.mjs/gu),
    ).toHaveLength(4);
  });

  it('does not discover or preview a Cursor transcript through colliding lossy worktree slugs', async () => {
    const createdRoot = await mkdtemp(
      join(tmpdir(), 'handoff-cursor-collision-'),
    );
    const root = await realpath(createdRoot);
    const previousHome = process.env.HOME;
    const sourceA = join(root, 'repo', 'a-b', 'c');
    const sourceB = join(root, 'repo', 'a', 'b-c');
    const encodeCursorCwd = (cwd: string) =>
      cwd.split(/[/.]/u).filter(Boolean).join('-');
    expect(encodeCursorCwd(sourceA)).toBe(encodeCursorCwd(sourceB));

    const transcriptDir = join(
      root,
      '.cursor',
      'projects',
      encodeCursorCwd(sourceA),
      'agent-transcripts',
      'collision-session',
    );
    await mkdir(sourceA, { recursive: true });
    await mkdir(sourceB, { recursive: true });
    await mkdir(transcriptDir, { recursive: true });
    await writeFile(
      join(transcriptDir, 'conversation.jsonl'),
      `${JSON.stringify({ role: 'user', message: { content: 'COLLISION_PRIVATE_MARKER' } })}\n`,
      'utf8',
    );
    process.env.HOME = root;

    try {
      for (const source of [sourceA, sourceB]) {
        const discovery = harness();
        expect(
          await runGuidanceCli(
            ['discover', '--source', source, '--provider', 'cursor', '--json'],
            undefined,
            discovery.io,
          ),
        ).toBe(2);
        expect(discovery.stdout.join('')).toContain('discovery-incomplete');
        expect(discovery.stdout.join('')).not.toContain(source);
        expect(discovery.stdout.join('')).not.toContain(
          'COLLISION_PRIVATE_MARKER',
        );

        const preview = harness();
        expect(
          await runGuidanceCli(
            [
              'preview',
              '--source',
              source,
              '--session',
              'cursor:ambiguous:collision-session',
              '--json',
            ],
            undefined,
            preview.io,
          ),
        ).toBe(2);
        expect(preview.stdout.join('')).toContain('discovery-incomplete');
        expect(preview.stdout.join('')).not.toContain(source);
        expect(preview.stdout.join('')).not.toContain(
          'COLLISION_PRIVATE_MARKER',
        );
      }
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports previews truncated by entry count or within an entry', async () => {
    const createdRoot = await mkdtemp(join(tmpdir(), 'handoff-preview-limit-'));
    const root = await realpath(createdRoot);
    const previousHome = process.env.HOME;
    const source = join(root, 'repo', 'source');
    const sessionId = 'preview-limit-session';
    const transcriptDir = join(
      root,
      '.claude',
      'projects',
      source.replace(/[/.]/gu, '-'),
    );
    const transcriptPath = join(transcriptDir, `${sessionId}.jsonl`);
    const record = (type: 'user' | 'assistant', content: string) => ({
      type,
      cwd: source,
      sessionId,
      message: {
        role: type,
        content:
          type === 'assistant' ? [{ type: 'text', text: content }] : content,
      },
    });
    const runPreview = async () => {
      const test = harness();
      expect(
        await runGuidanceCli(
          [
            'preview',
            '--source',
            source,
            '--session',
            `claude:cli:${sessionId}`,
            '--json',
          ],
          undefined,
          test.io,
        ),
      ).toBe(0);
      return JSON.parse(test.stdout[0]).data as {
        entries: unknown[];
        truncated: boolean;
      };
    };

    await mkdir(source, { recursive: true });
    await mkdir(transcriptDir, { recursive: true });
    process.env.HOME = root;

    try {
      await writeFile(
        transcriptPath,
        `${Array.from({ length: 10 }, (_, index) =>
          JSON.stringify(
            record(index % 2 === 0 ? 'user' : 'assistant', `entry-${index}`),
          ),
        ).join('\n')}\n`,
        'utf8',
      );
      const countLimited = await runPreview();
      expect(countLimited.entries).toHaveLength(8);
      expect(countLimited.truncated).toBe(true);

      await writeFile(
        transcriptPath,
        `${JSON.stringify(record('user', `prefix-${'x'.repeat(4_500)}`))}\n${JSON.stringify(record('assistant', 'tail'))}\n`,
        'utf8',
      );
      const textLimited = await runPreview();
      expect(textLimited.entries).toHaveLength(2);
      expect(textLimited.truncated).toBe(true);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  });

  it('isolates preview and prepare discovery to the provider in the exact key', async () => {
    const createdRoot = await mkdtemp(
      join(tmpdir(), 'handoff-provider-scope-'),
    );
    const root = await realpath(createdRoot);
    const previousHome = process.env.HOME;
    const source = join(root, 'source');
    const target = join(root, 'target');
    const sessionId = '550e8400-e29b-41d4-a716-446655440099';
    const claudeDir = join(
      root,
      '.claude',
      'projects',
      source.replace(/[/.]/gu, '-'),
    );
    const cursorDir = join(
      root,
      '.cursor',
      'projects',
      source.split(/[/.]/u).filter(Boolean).join('-'),
      'agent-transcripts',
      'blocking-cursor-session',
    );
    const runGit = (...args: string[]) =>
      execFileAsync('git', args, { encoding: 'utf8' });

    await mkdir(source, { recursive: true });
    await runGit('-C', source, 'init', '-q');
    await runGit('-C', source, 'config', 'user.name', 'Synthetic Test');
    await runGit(
      '-C',
      source,
      'config',
      'user.email',
      'synthetic@example.invalid',
    );
    await writeFile(join(source, 'README.md'), 'fixture\n', 'utf8');
    await runGit('-C', source, 'add', 'README.md');
    await runGit('-C', source, 'commit', '-qm', 'fixture');
    await runGit(
      '-C',
      source,
      'worktree',
      'add',
      '-qb',
      'fixture-target',
      target,
    );
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      join(claudeDir, `${sessionId}.jsonl`),
      `${JSON.stringify({ type: 'summary', cwd: source, sessionId })}\n${JSON.stringify({ type: 'user', cwd: source, sessionId, message: { role: 'user', content: 'hello' } })}\n${JSON.stringify({ type: 'assistant', cwd: source, sessionId, message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } })}\n`,
      'utf8',
    );
    await mkdir(cursorDir, { recursive: true });
    await writeFile(
      join(cursorDir, 'conversation.jsonl'),
      `${JSON.stringify({ role: 'user', message: { content: 'BLOCKING_CURSOR_MARKER' } })}\n`,
      'utf8',
    );
    process.env.HOME = root;

    try {
      const preview = harness();
      expect(
        await runGuidanceCli(
          [
            'preview',
            '--source',
            source,
            '--session',
            `claude:cli:${sessionId}`,
            '--json',
          ],
          undefined,
          preview.io,
        ),
      ).toBe(0);
      expect(JSON.parse(preview.stdout[0])).toMatchObject({
        ok: true,
        data: { key: `claude:cli:${sessionId}` },
      });

      const prepare = harness();
      const prepareStatus = await runGuidanceCli(
        [
          'prepare',
          '--source',
          source,
          '--target',
          target,
          '--session',
          `claude:cli:${sessionId}`,
          '--entry-point',
          'source-other',
          '--json',
        ],
        undefined,
        prepare.io,
      );
      expect(prepareStatus, prepare.stdout.join('')).toBe(0);
      expect(JSON.parse(prepare.stdout[0])).toMatchObject({
        ok: true,
        data: { provider: 'claude', selectedSource: `claude:cli:${sessionId}` },
      });
      expect(prepare.stdout.join('')).not.toContain('BLOCKING_CURSOR_MARKER');
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  });

  it('ships read-only discovery for a large attributed transcript beside a stale cwd', async () => {
    const createdRoot = await mkdtemp(
      join(tmpdir(), 'handoff-shipped-realistic-'),
    );
    const root = await realpath(createdRoot);
    const source = join(root, 'source');
    const stale = join(root, 'deleted-worktree');
    const sessionId = 'large-shipped-session';
    const claudeProjects = join(root, '.claude', 'projects');
    const sourceDir = join(claudeProjects, source.replace(/[/.]/gu, '-'));
    const staleDir = join(claudeProjects, stale.replace(/[/.]/gu, '-'));
    const bundleUrl = new URL(
      '../../skills/coding-session-handoff/scripts/coding-session-handoff.mjs',
      import.meta.url,
    );
    const records = [
      { type: 'summary', cwd: source, sessionId },
      {
        type: 'user',
        cwd: source,
        sessionId,
        message: { role: 'user', content: 'hello' },
      },
      {
        type: 'assistant',
        cwd: source,
        sessionId,
        message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
      },
      ...Array.from({ length: 140 }, (_, index) => ({
        type: 'progress',
        cwd: source,
        sessionId,
        index,
        padding: 'x'.repeat(2_200),
      })),
    ];
    const transcript = `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
    expect(Buffer.byteLength(transcript)).toBeGreaterThan(256 * 1024);

    await mkdir(source, { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await mkdir(staleDir, { recursive: true });
    await writeFile(join(sourceDir, `${sessionId}.jsonl`), transcript, 'utf8');
    await writeFile(
      join(staleDir, 'stale-session.jsonl'),
      `${JSON.stringify({ type: 'summary', cwd: stale, sessionId: 'stale-session' })}\n${JSON.stringify({ type: 'user', cwd: stale, sessionId: 'stale-session', message: { role: 'user', content: 'STALE_PRIVATE_MARKER' } })}\n`,
      'utf8',
    );

    try {
      const result = await execFileAsync(
        process.execPath,
        [
          bundleUrl.pathname,
          'discover',
          '--source',
          source,
          '--provider',
          'claude',
          '--json',
        ],
        { encoding: 'utf8', env: { ...process.env, HOME: root } },
      );
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        ok: true,
        data: {
          candidates: [{ key: `claude:cli:${sessionId}` }],
          unattributable: [
            {
              provider: 'claude',
              reasons: [{ code: 'cwd-unresolvable', count: 1 }],
            },
          ],
        },
      });
      expect(result.stdout).not.toContain(stale);
      expect(result.stdout).not.toContain('STALE_PRIVATE_MARKER');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(['execute', 'reconcile', 'behavior-plan', 'behavior-verify'])(
    'rejects old automation command %s',
    async (command) => {
      const test = harness();
      expect(
        await runGuidanceCli([command, '--json'], test.dependencies, test.io),
      ).toBe(2);
      expect(test.dependencies.discover).not.toHaveBeenCalled();
      expect(test.dependencies.preview).not.toHaveBeenCalled();
      expect(test.dependencies.prepare).not.toHaveBeenCalled();
    },
  );

  it('ships a dependency-free generated bundle isolated from the old executor', async () => {
    const source = await readFile(
      new URL(
        '../../src/transcript/coding-session-handoff/guidance-cli.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /\.\/cli\.js|behavior-gate|\.\/handoff\.js|\.\/providers\.js/,
    );

    const bundleUrl = new URL(
      '../../skills/coding-session-handoff/scripts/coding-session-handoff.mjs',
      import.meta.url,
    );
    const bundle = await readFile(bundleUrl, 'utf8');
    expect(bundle).toContain(
      '// GENERATED by scripts/build-generated.mjs. Do not edit directly.',
    );
    expect(bundle).not.toMatch(/from\s+['"](?:\.\.\/|\.\/).*\.js['"]/);
    expect(bundle).not.toContain('behavior-verify');
    expect(bundle).not.toContain('executeHandoffPlan');

    const result = await execFileAsync(
      process.execPath,
      [bundleUrl.pathname, '--help'],
      {
        encoding: 'utf8',
      },
    );
    expect(result.stdout).toContain('EXPERIMENTAL / NOT RELEASED');
  });
});
