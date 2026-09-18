import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const fixtureRoot = new URL(
  '../fixtures/consensus-review-receipt/',
  import.meta.url,
);

const canonicalFixtureHashes = {
  'clean-review.md':
    '993fa5f02a283d74f73a17ce48c3636febad61695a8833791b966520e7eabfe9',
  'diagnostic.json':
    'fd63fabd0d2912811b8ae4c1e7752510c2214d4a16def988d626ef28f12009cf',
  'findings-review.md':
    'a118afba0cebcecbe32f40a2c728bf1c550baf1186954c393fe97b4e0d1d2c3c',
} as const;

async function fixtureText(
  name: keyof typeof canonicalFixtureHashes,
): Promise<string> {
  return readFile(new URL(name, fixtureRoot), 'utf8');
}

describe('canonical consensus review receipt fixtures', () => {
  it('keeps the clean renderer fixture finding-free', async () => {
    const fixture = await fixtureText('clean-review.md');

    expect(fixture).toContain('oat_review_run_id: "receipt-clean-v1"');
    expect(fixture).toContain('**Verdict:** pass');
    for (const severity of ['Critical', 'High', 'Medium', 'Low']) {
      expect(fixture).toContain(`### ${severity}\n\nNone`);
    }
    expect(fixture).not.toMatch(/### (?:Important|Minor)/u);
  });

  it('covers every severity and both location forms in one renderer fixture', async () => {
    const fixture = await fixtureText('findings-review.md');

    expect(fixture).toContain('oat_review_run_id: "receipt-findings-v1"');
    expect(fixture).toContain('**C1: Reject unsafe destination**');
    expect(fixture).toContain('`src/reviewed.ts:12-14');
    expect(fixture).toContain('**H1: Preserve the explicit acceptance rule**');
    expect(fixture).toContain('`anchor: Acceptance Criteria > Receipt`');
    expect(fixture).toContain('**M1: Record fixture identity**');
    expect(fixture).toContain('`src/reviewed.ts:28');
    expect(fixture).toContain('**L1: Clarify retained state**');
    expect(fixture).toContain('`anchor: Limitations > Retention`');
    expect(fixture).not.toMatch(/### (?:Important|Minor)/u);
  });

  it('keeps diagnostics non-Markdown and explicitly incomplete', async () => {
    const fixture = JSON.parse(await fixtureText('diagnostic.json')) as Record<
      string,
      unknown
    >;

    expect(fixture).toMatchObject({
      status: 'defective',
      reason: 'scope_drift',
      invocation_count: 1,
    });
    expect(fixture.status).not.toBe('complete');
  });

  it('pins the current canonical renderer/fixture identities', async () => {
    for (const [name, expectedHash] of Object.entries(canonicalFixtureHashes)) {
      const fixture = await fixtureText(
        name as keyof typeof canonicalFixtureHashes,
      );
      expect(createHash('sha256').update(fixture).digest('hex')).toBe(
        expectedHash,
      );
    }
  });
});
