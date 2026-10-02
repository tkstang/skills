import { describe, expect, it } from 'vitest';

import { SNIPPET_MAX_CHARS, buildSnippet, compileMatcher } from './matcher.js';
import { UsageError } from './options.js';

describe('compileMatcher', () => {
  it('treats patterns as regexes by default and escapes them with literal', () => {
    const regex = compileMatcher(['perceive ?now'], { literal: false });
    expect(regex.match('we discussed PerceiveNow yesterday')?.patterns).toEqual(
      ['perceive ?now'],
    );

    const literal = compileMatcher(['perceive ?now'], { literal: true });
    expect(literal.match('we discussed PerceiveNow yesterday')).toBeNull();
    expect(literal.match('literally Perceive ?Now here')).toEqual({
      patterns: ['perceive ?now'],
      firstIndex: 10,
      firstLength: 13,
    });
  });

  it('escapes every regex metacharacter in literal mode', () => {
    const matcher = compileMatcher(['a.b(c)[d]+$'], { literal: true });
    expect(matcher.match('xx a.b(c)[d]+$ yy')).not.toBeNull();
    expect(matcher.match('axb(c)[d]+')).toBeNull();
  });

  it('matches case-insensitively', () => {
    const matcher = compileMatcher(['Vetting'], { literal: false });
    expect(matcher.match('VETTING the vendor')).toEqual({
      patterns: ['Vetting'],
      firstIndex: 0,
      firstLength: 7,
    });
  });

  it('attributes every matching pattern and reports the earliest hit', () => {
    const matcher = compileMatcher(['gamma', 'alpha', 'missing', 'beta'], {
      literal: false,
    });
    const result = matcher.match('alpha then beta then gamma');

    expect(result).toEqual({
      patterns: ['gamma', 'alpha', 'beta'],
      firstIndex: 0,
      firstLength: 5,
    });
    expect(matcher.match('nothing relevant')).toBeNull();
  });

  it('is stable across repeated calls (no lastIndex leakage)', () => {
    const matcher = compileMatcher(['needle'], { literal: false });
    for (let i = 0; i < 3; i++) {
      expect(matcher.match('a needle here')?.firstIndex).toBe(2);
    }
  });

  it('rejects an invalid regex with a usage error naming it and --literal', () => {
    expect(() => compileMatcher(['foo(bar'], { literal: false })).toThrow(
      UsageError,
    );
    expect(() => compileMatcher(['foo(bar'], { literal: false })).toThrow(
      /foo\(bar.*--literal/,
    );
    expect(() => compileMatcher(['foo(bar'], { literal: true })).not.toThrow();
  });

  it('requires at least one pattern', () => {
    expect(() => compileMatcher([], { literal: false })).toThrow(UsageError);
  });
});

describe('buildSnippet', () => {
  it('returns short text whole with whitespace collapsed', () => {
    expect(buildSnippet('  the   target\n\tphrase  ', 8, 6)).toBe(
      'the target phrase',
    );
  });

  it('windows 80 characters on each side of the hit with ellipses', () => {
    const before = 'b'.repeat(200);
    const after = 'a'.repeat(200);
    const text = `${before}TARGET${after}`;
    const snippet = buildSnippet(text, 200, 6);

    expect(snippet).toBe(`…${'b'.repeat(80)}TARGET${'a'.repeat(80)}…`);
  });

  it('omits the leading ellipsis when the window starts at the text start', () => {
    const text = `TARGET ${'a'.repeat(200)}`;
    const snippet = buildSnippet(text, 0, 6);
    expect(snippet.startsWith('TARGET')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('caps a long hit at the maximum length, keeping the hit start', () => {
    const text = `${'x'.repeat(100)}${'H'.repeat(500)}${'y'.repeat(100)}`;
    const snippet = buildSnippet(text, 100, 500);

    expect(snippet.length).toBe(SNIPPET_MAX_CHARS);
    expect(SNIPPET_MAX_CHARS).toBe(240);
    expect(snippet.startsWith(`…${'x'.repeat(80)}H`)).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });
});
