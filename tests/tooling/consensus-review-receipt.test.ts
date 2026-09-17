import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const fixtureRoot = new URL(
  '../fixtures/consensus-review-receipt/',
  import.meta.url,
);

const canonicalFixtureHashes = {
  'clean-review.md':
    '2a14076b1672186cf3a80a06f37bc2e4b66db950d8125203b23115a2b52e830a',
  'diagnostic.json':
    'fd63fabd0d2912811b8ae4c1e7752510c2214d4a16def988d626ef28f12009cf',
  'findings-review.md':
    'e3cfc7b4c6462ebf729f25f22bf7a7e6ba7cc6184266862457c07b3db361db06',
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
    for (const severity of ['Critical', 'Important', 'Medium', 'Minor']) {
      expect(fixture).toContain(`### ${severity}\n\nNone`);
    }
  });

  it('covers every severity and both location forms in one renderer fixture', async () => {
    const fixture = await fixtureText('findings-review.md');

    expect(fixture).toContain('oat_review_run_id: "receipt-findings-v1"');
    expect(fixture).toContain('**C1: Reject unsafe destination**');
    expect(fixture).toContain('`src/reviewed.ts:12-14');
    expect(fixture).toContain('**I1: Preserve the explicit acceptance rule**');
    expect(fixture).toContain('`anchor: Acceptance Criteria > Receipt`');
    expect(fixture).toContain('**M1: Record fixture identity**');
    expect(fixture).toContain('`src/reviewed.ts:28');
    expect(fixture).toContain('**m1: Clarify retained state**');
    expect(fixture).toContain('`anchor: Limitations > Retention`');
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
