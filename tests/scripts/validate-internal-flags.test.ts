import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

// @ts-expect-error The script helper is intentionally declaration-free; this test exercises the dev script directly.
import { validateInternalFlags } from '../../scripts/validate-internal-flags.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const detectorScript = path.join(
  repoRoot,
  'scripts',
  'validate-internal-flags.mjs',
);

const FLAGGED_SKILL = `---
name: oat-flagged
description: A flagged tooling skill.
metadata:
  internal: true
---

# oat-flagged
`;

const UNFLAGGED_SKILL = `---
name: oat-bare
description: An unflagged tooling skill.
---

# oat-bare
`;

const STANDALONE_SKILL = `---
name: standalone
description: A canonical standalone skill that should stay public.
metadata:
  version: '0.1.0'
---

# standalone
`;

async function writeSkill(dir: string, name: string, content: string) {
  const skillDir = path.join(dir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), content);
  return path.join(skillDir, 'SKILL.md');
}

describe('validateInternalFlags (detector)', () => {
  it('passes when every skill is flagged and skips symlinked dirs', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'validate-flags-'));
    try {
      const externalDir = path.join(tempRoot, 'external', 'standalone');
      await mkdir(externalDir, { recursive: true });
      await writeFile(path.join(externalDir, 'SKILL.md'), STANDALONE_SKILL);

      const skillsDir = path.join(tempRoot, 'agents-skills');
      await mkdir(skillsDir, { recursive: true });
      await writeSkill(skillsDir, 'a', FLAGGED_SKILL);
      await writeSkill(skillsDir, 'b', FLAGGED_SKILL);
      // Symlinked standalone skill (unflagged) must NOT count as an offender.
      await symlink(
        path.relative(skillsDir, externalDir),
        path.join(skillsDir, 'linked'),
      );

      const result = await validateInternalFlags(skillsDir);
      expect(result.checked).toBe(2);
      expect(result.offenders).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('reports offenders that lack metadata.internal: true', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'validate-flags-'));
    try {
      const skillsDir = path.join(tempRoot, 'agents-skills');
      await mkdir(skillsDir, { recursive: true });
      await writeSkill(skillsDir, 'good', FLAGGED_SKILL);
      const bad = await writeSkill(skillsDir, 'bad', UNFLAGGED_SKILL);

      const result = await validateInternalFlags(skillsDir);
      expect(result.checked).toBe(2);
      expect(result.offenders).toEqual([bad]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('CLI exits non-zero with offenders and zero when all flagged', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'validate-flags-cli-'),
    );
    try {
      const skillsDir = path.join(tempRoot, 'agents-skills');
      await mkdir(skillsDir, { recursive: true });
      await writeSkill(skillsDir, 'good', FLAGGED_SKILL);

      // All flagged -> exit 0.
      await expect(
        execFileAsync('node', [detectorScript, skillsDir]),
      ).resolves.toBeDefined();

      // Introduce an offender -> non-zero exit, names the offender.
      await writeSkill(skillsDir, 'bad', UNFLAGGED_SKILL);
      await expect(
        execFileAsync('node', [detectorScript, skillsDir]),
      ).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
