import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error The script helper is intentionally declaration-free; this test exercises the dev script directly.
import { applyInternalFlags } from '../../scripts/apply-internal-flags.mjs';
// @ts-expect-error The script helper is intentionally declaration-free; this test exercises the dev script directly.
import { addInternalFlag, hasInternalFlag } from '../../scripts/lib/skill-frontmatter.mjs';

const NO_META_SKILL = `---
name: oat-thing
version: 1.2.3
description: A tooling skill with no metadata block.
allowed-tools: Read, Write
---

# oat-thing

Body content stays untouched.
`;

const WITH_META_SKILL = `---
name: oat-other
description: A tooling skill that already has a metadata block.
license: MIT
metadata:
  author: thomas.stang
  version: '0.1.2'
---

# oat-other

Body with an existing metadata block.
`;

const ALREADY_FLAGGED_SKILL = `---
name: oat-flagged
description: Already carries the internal flag.
metadata:
  internal: true
  author: thomas.stang
---

# oat-flagged

Already flagged body.
`;

// A skill where `internal: true` is nested deeper than metadata's direct children.
// The detector must NOT treat this as already flagged.
const DEEP_NESTED_SKILL = `---
name: oat-deep
description: Has internal nested under a deeper key, not as a direct metadata child.
metadata:
  visibility:
    internal: true
---

# oat-deep

Deep-nested internal body.
`;

async function writeSkill(dir: string, name: string, content: string) {
  const skillDir = path.join(dir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), content);
  return path.join(skillDir, 'SKILL.md');
}

describe('addInternalFlag (frontmatter patch)', () => {
  it('creates a metadata block when none exists, preserving keys and body', () => {
    const { content, changed } = addInternalFlag(NO_META_SKILL);
    expect(changed).toBe(true);
    expect(hasInternalFlag(content)).toBe(true);
    // existing top-level keys preserved
    expect(content).toContain('name: oat-thing');
    expect(content).toContain('version: 1.2.3');
    expect(content).toContain('allowed-tools: Read, Write');
    // body preserved verbatim
    expect(content).toContain('# oat-thing\n\nBody content stays untouched.\n');
    expect(content).toContain('metadata:\n  internal: true');
  });

  it('inserts under an existing metadata block without disturbing siblings', () => {
    const { content, changed } = addInternalFlag(WITH_META_SKILL);
    expect(changed).toBe(true);
    expect(hasInternalFlag(content)).toBe(true);
    expect(content).toContain('author: thomas.stang');
    expect(content).toContain("version: '0.1.2'");
    // only one metadata: key
    expect(content.match(/^metadata:$/gmu)?.length).toBe(1);
  });

  it('is idempotent: already-flagged content is returned unchanged', () => {
    const { content, changed } = addInternalFlag(ALREADY_FLAGGED_SKILL);
    expect(changed).toBe(false);
    expect(content).toBe(ALREADY_FLAGGED_SKILL);
  });

  it('throws when there is no frontmatter block', () => {
    expect(() => addInternalFlag('# Just a body\n')).toThrow();
  });

  it('does not treat a deeply-nested internal: as the flag; direct child IS the flag', () => {
    // Deeper-nested internal: must not be seen as the flag.
    expect(hasInternalFlag(DEEP_NESTED_SKILL)).toBe(false);

    // addInternalFlag must still add internal: at the direct-child indent level.
    const { content, changed } = addInternalFlag(DEEP_NESTED_SKILL);
    expect(changed).toBe(true);
    expect(hasInternalFlag(content)).toBe(true);

    // The deep-nested internal: key is left intact.
    expect(content).toContain('visibility:\n    internal: true');
    // The new flag sits at the direct child level of metadata:.
    expect(content).toContain('metadata:\n  internal: true');
  });
});

describe('applyInternalFlags (apply script)', () => {
  it('flags unflagged skills, skips flagged + symlinked, is idempotent, preserves bodies', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'internal-flags-'));
    try {
      // A canonical standalone skill living OUTSIDE the synced skills dir.
      const externalDir = path.join(tempRoot, 'external', 'standalone');
      await mkdir(externalDir, { recursive: true });
      const externalSkill = path.join(externalDir, 'SKILL.md');
      await writeFile(externalSkill, NO_META_SKILL);

      const skillsDir = path.join(tempRoot, 'agents-skills');
      await mkdir(skillsDir, { recursive: true });
      const noMeta = await writeSkill(skillsDir, 'no-meta', NO_META_SKILL);
      const withMeta = await writeSkill(
        skillsDir,
        'with-meta',
        WITH_META_SKILL,
      );
      const already = await writeSkill(
        skillsDir,
        'already',
        ALREADY_FLAGGED_SKILL,
      );
      // Symlinked skill dir (mirrors .agents/skills/session-observer) — must be skipped.
      await symlink(
        path.relative(skillsDir, externalDir),
        path.join(skillsDir, 'linked'),
      );

      const first = await applyInternalFlags(skillsDir);
      expect(first.checked).toBe(3); // symlink excluded
      expect(first.changed.toSorted()).toEqual([noMeta, withMeta].toSorted());

      expect(hasInternalFlag(await readFile(noMeta, 'utf8'))).toBe(true);
      expect(hasInternalFlag(await readFile(withMeta, 'utf8'))).toBe(true);
      // already-flagged untouched
      expect(await readFile(already, 'utf8')).toBe(ALREADY_FLAGGED_SKILL);
      // symlink target (canonical standalone) must NOT be flagged
      expect(await readFile(externalSkill, 'utf8')).toBe(NO_META_SKILL);
      expect(hasInternalFlag(await readFile(externalSkill, 'utf8'))).toBe(
        false,
      );
      // body preserved
      expect(await readFile(noMeta, 'utf8')).toContain(
        '# oat-thing\n\nBody content stays untouched.\n',
      );

      // second run: nothing changes
      const second = await applyInternalFlags(skillsDir);
      expect(second.changed).toEqual([]);
      expect(second.checked).toBe(3);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
