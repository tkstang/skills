import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LARGE_SCAN_BYTES,
  DEFAULT_LIMIT,
  DEFAULT_MAX_LINE_BYTES,
  UsageError,
  parseTimeSpec,
  resolveOptions,
} from './options.js';

// 2026-10-02 15:30 local time. Expectations are built with the same local
// Date constructor, so the assertions hold in any timezone.
const NOW = new Date(2026, 9, 2, 15, 30, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HOME = '/home/tester';
const BASE = { now: NOW, home: HOME, cwd: '/work/project' };

describe('parseTimeSpec', () => {
  it('parses relative hours, days, and weeks against now', () => {
    expect(parseTimeSpec('24h', NOW)).toBe(NOW - 24 * HOUR);
    expect(parseTimeSpec('7d', NOW)).toBe(NOW - 7 * DAY);
    expect(parseTimeSpec('2w', NOW)).toBe(NOW - 14 * DAY);
    expect(parseTimeSpec('2W', NOW)).toBe(NOW - 14 * DAY);
  });

  it('maps today and yesterday to local midnight boundaries', () => {
    const startOfToday = new Date(2026, 9, 2).getTime();
    const startOfYesterday = new Date(2026, 9, 1).getTime();
    const startOfTomorrow = new Date(2026, 9, 3).getTime();

    expect(parseTimeSpec('today', NOW, 'since')).toBe(startOfToday);
    expect(parseTimeSpec('today', NOW, 'until')).toBe(startOfTomorrow);
    expect(parseTimeSpec('yesterday', NOW, 'since')).toBe(startOfYesterday);
    expect(parseTimeSpec('yesterday', NOW, 'until')).toBe(startOfToday);
    expect(parseTimeSpec('Yesterday', NOW)).toBe(startOfYesterday);
  });

  it('crosses month boundaries for yesterday', () => {
    const firstOfMonth = new Date(2026, 9, 1, 8, 0).getTime();
    expect(parseTimeSpec('yesterday', firstOfMonth, 'since')).toBe(
      new Date(2026, 8, 30).getTime(),
    );
  });

  it('treats an ISO date as a whole local day', () => {
    expect(parseTimeSpec('2026-09-29', NOW, 'since')).toBe(
      new Date(2026, 8, 29).getTime(),
    );
    expect(parseTimeSpec('2026-09-29', NOW, 'until')).toBe(
      new Date(2026, 8, 30).getTime(),
    );
  });

  it('parses ISO date-times exactly', () => {
    expect(parseTimeSpec('2026-09-29T10:15:00Z', NOW)).toBe(
      Date.UTC(2026, 8, 29, 10, 15),
    );
    expect(parseTimeSpec('2026-09-29T10:15', NOW)).toBe(
      new Date(2026, 8, 29, 10, 15).getTime(),
    );
  });

  it.each([
    '',
    'soon',
    '7',
    '0d',
    '-3d',
    '3m',
    '2026-13-01',
    '2026-02-30',
    '2026-09-29T25:00',
  ])('rejects %j with a usage error naming the value', (spec) => {
    expect(() => parseTimeSpec(spec, NOW)).toThrow(UsageError);
    if (spec !== '') {
      expect(() => parseTimeSpec(spec, NOW)).toThrow(spec);
    }
  });
});

describe('resolveOptions', () => {
  it('applies the documented defaults', () => {
    const options = resolveOptions({ pattern: ['perceive ?now'] }, BASE);

    expect(options).toEqual({
      patterns: ['perceive ?now'],
      literal: false,
      since: null,
      until: null,
      cwdHints: [],
      runtimes: ['claude-code', 'codex', 'cursor'],
      tiers: ['history', 'meta', 'content'],
      deep: true,
      includeTools: false,
      allowLargeScan: false,
      largeScanBytes: 2 * 1024 * 1024 * 1024,
      maxLineBytes: 65536,
      limit: 15,
      deadlineMs: null,
      json: false,
    });
    expect(DEFAULT_LIMIT).toBe(15);
    expect(DEFAULT_MAX_LINE_BYTES).toBe(65536);
    expect(DEFAULT_LARGE_SCAN_BYTES).toBe(2 * 1024 ** 3);
  });

  it('collects repeated patterns and narrows flag values', () => {
    const options = resolveOptions(
      {
        pattern: ['alpha', 'beta'],
        literal: true,
        'no-deep': true,
        'include-tools': true,
        'allow-large-scan': true,
        'large-scan-bytes': '1024',
        'max-line-bytes': '4096',
        limit: '3',
        'deadline-ms': '5000',
        json: true,
        runtime: ['codex,cursor'],
        tiers: 'history,meta',
      },
      BASE,
    );

    expect(options.patterns).toEqual(['alpha', 'beta']);
    expect(options.literal).toBe(true);
    expect(options.deep).toBe(false);
    expect(options.includeTools).toBe(true);
    expect(options.allowLargeScan).toBe(true);
    expect(options.largeScanBytes).toBe(1024);
    expect(options.maxLineBytes).toBe(4096);
    expect(options.limit).toBe(3);
    expect(options.deadlineMs).toBe(5000);
    expect(options.json).toBe(true);
    expect(options.runtimes).toEqual(['codex', 'cursor']);
    expect(options.tiers).toEqual(['history', 'meta']);
  });

  it('deduplicates repeated patterns, keeping first-seen order', () => {
    const options = resolveOptions({
      pattern: ['zebra', 'okapi', 'zebra', 'okapi', 'gnu'],
    });
    expect(options.patterns).toEqual(['zebra', 'okapi', 'gnu']);
  });

  it('resolves the time window through parseTimeSpec bounds', () => {
    const options = resolveOptions(
      { pattern: 'x', since: 'yesterday', until: 'yesterday' },
      BASE,
    );
    expect(options.since).toBe(new Date(2026, 9, 1).getTime());
    expect(options.until).toBe(new Date(2026, 9, 2).getTime());
  });

  it('rejects --until earlier than --since', () => {
    expect(() =>
      resolveOptions({ pattern: 'x', since: '24h', until: '7d' }, BASE),
    ).toThrow(UsageError);
    expect(() =>
      resolveOptions({ pattern: 'x', since: '24h', until: '7d' }, BASE),
    ).toThrow(/--until/);
  });

  it('normalizes cwd hints: tilde, relative, trailing slash, duplicates', () => {
    const options = resolveOptions(
      {
        pattern: 'x',
        cwd: [
          '~',
          '~/code/skills/',
          'sub/dir/',
          '/abs/path//',
          '/abs/path',
          '/',
        ],
      },
      BASE,
    );

    expect(options.cwdHints).toEqual([
      HOME,
      path.join(HOME, 'code/skills'),
      '/work/project/sub/dir',
      '/abs/path',
      '/',
    ]);
  });

  it.each([
    [{ pattern: 'x', runtime: 'claude' }, /claude/],
    [{ pattern: 'x', tiers: 'history,deep' }, /deep/],
    [{ pattern: 'x', limit: '0' }, /--limit/],
    [{ pattern: 'x', limit: 'many' }, /--limit/],
    [{ pattern: 'x', 'max-line-bytes': '-1' }, /--max-line-bytes/],
    [{ pattern: 'x', since: true }, /--since/],
    [{ pattern: '' }, /pattern/],
    [{ pattern: 'x', cwd: true }, /--cwd/],
  ])('rejects invalid input %j', (raw, message) => {
    expect(() => resolveOptions(raw, BASE)).toThrow(UsageError);
    expect(() => resolveOptions(raw, BASE)).toThrow(message);
  });
});
