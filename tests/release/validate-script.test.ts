import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import { parseFrontmatter, parseJsonFile, validateMarketplaceSource, validateReadmeInstallMatrix, validateRepository, validateSkillReference, validateVersionConsistency } from '../../scripts/validate.mjs';
import { repoRoot } from '../helpers/process.mjs';
const validateWorkflowPath = path.join(
  repoRoot,
  '.github/workflows/validate.yml',
);
const worktreeValidatePath = path.join(
  repoRoot,
  'scripts/worktree/validate.sh',
);

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createValidTempRepository() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-validator-'),
  );

  await mkdir(path.join(tempRoot, 'skills'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/skills/refine'), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, 'plugins/consensus/agents'), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, 'plugins/consensus/.claude-plugin'), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, 'plugins/consensus/.cursor-plugin'), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, 'plugins/consensus/.codex-plugin'), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, '.cursor-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, '.agents/plugins'), { recursive: true });

  await writeFile(
    path.join(tempRoot, 'README.md'),
    '# Test\n\n## Local Git Repository Install\n',
  );
  await writeFile(path.join(tempRoot, 'LICENSE'), 'MIT\n');
  await writeFile(path.join(tempRoot, 'CHANGELOG.md'), '# Changelog\n');
  await writeFile(path.join(tempRoot, 'CONTRIBUTING.md'), '# Contributing\n');
  await writeFile(path.join(tempRoot, 'RELEASING.md'), '# Releasing\n');
  await writeFile(path.join(tempRoot, 'AGENTS.md'), '# Agents\n');
  await writeFile(path.join(tempRoot, 'CLAUDE.md'), '@AGENTS.md\n');

  const skillFrontmatter = `---
name: refine
description: Test skill
license: MIT
compatibility: codex
metadata:
  version: "0.1.0"
---
# Consensus Refine
`;
  await writeFile(
    path.join(tempRoot, 'plugins/consensus/skills/refine/SKILL.md'),
    skillFrontmatter,
  );

  const providerManifest = {
    name: 'consensus',
    version: '0.1.0',
    author: { name: 'Thomas Stang' },
  };
  await writeJson(
    path.join(tempRoot, 'plugins/consensus/.claude-plugin/plugin.json'),
    providerManifest,
  );
  await writeJson(
    path.join(tempRoot, 'plugins/consensus/.cursor-plugin/plugin.json'),
    providerManifest,
  );
  await writeJson(
    path.join(tempRoot, 'plugins/consensus/.codex-plugin/plugin.json'),
    {
      ...providerManifest,
      skills: './skills/',
    },
  );

  const claudeMarketplace = {
    name: 'skills',
    owner: { name: 'Thomas Stang' },
    plugins: [{ name: 'consensus', source: './plugins/consensus' }],
  };
  const codexMarketplace = {
    name: 'skills',
    plugins: [
      {
        name: 'consensus',
        source: { source: 'local', path: './plugins/consensus' },
      },
    ],
  };
  await writeJson(
    path.join(tempRoot, '.claude-plugin/marketplace.json'),
    claudeMarketplace,
  );
  await writeJson(
    path.join(tempRoot, '.cursor-plugin/marketplace.json'),
    claudeMarketplace,
  );
  await writeJson(
    path.join(tempRoot, '.agents/plugins/marketplace.json'),
    codexMarketplace,
  );

  return tempRoot;
}

function assertOrdered(content: string, expected: string[]) {
  let cursor = -1;

  for (const text of expected) {
    const index = content.indexOf(text, cursor + 1);
    expect(index, `missing expected validation step: ${text}`).not.toBe(-1);
    expect(index > cursor, `validation step appears out of order: ${text}`).toBeTruthy();
    cursor = index;
  }
}

describe('validate-script', () => {
  it('parseFrontmatter reads skill metadata', () => {
    const parsed = parseFrontmatter(
      `---\nname: refine\nmetadata:\n  version: "0.1.0"\n---\n# Body\n`,
    );

    expect(parsed.name).toBe('refine');
    expect(parsed.metadata).toEqual({ version: '0.1.0' });
  });

  it('CI and worktree validation run generated-output verification in order', async () => {
    const workflow = await readFile(validateWorkflowPath, 'utf8');
    const worktreeValidation = await readFile(worktreeValidatePath, 'utf8');

    assertOrdered(workflow, [
      'pnpm install --frozen-lockfile',
      'node scripts/build-generated.mjs --list-outputs > "$RUNNER_TEMP/generated-output-paths.txt"',
      'pnpm run build',
      'git diff --exit-code -- "${generated_outputs[@]}"',
      'pnpm run type-check',
      'pnpm run build:check',
      'pnpm run test',
      'pnpm run validate',
      'pnpm run smoke',
    ]);

    assertOrdered(worktreeValidation, [
      'assert_clean_worktree "before validation"',
      'run_step "install" pnpm install --frozen-lockfile',
      'run_step "build generated outputs" pnpm run build',
      'assert_clean_worktree "after generated-output build"',
      'run_step "type-check" pnpm run type-check',
      'run_step "build:check" pnpm run build:check',
      'run_step "test" pnpm run test',
      'run_step "validate" pnpm run validate',
      'run_step "smoke" pnpm run smoke',
      'run_step "final build:check" pnpm run build:check',
      'assert_clean_worktree "after validation"',
    ]);
  });

  it('parseJsonFile reports valid JSON path context', async () => {
    const manifest = await parseJsonFile(
      path.join(repoRoot, 'plugins/consensus/.codex-plugin/plugin.json'),
    );

    expect(manifest.name).toBe('consensus');
    expect(manifest.version).toBe('0.1.0');
  });

  it('individual validators reject escaping paths and missing install docs', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-validator-'),
    );
    await mkdir(path.join(tempRoot, 'plugins'), { recursive: true });
    await writeFile(path.join(tempRoot, 'README.md'), '# Missing\n');

    const marketplaceIssues = await validateMarketplaceSource(tempRoot, {
      name: 'bad',
      source: { path: '../outside' },
    });
    expect(marketplaceIssues.length).toBe(1);
    expect(marketplaceIssues[0]).toMatch(/escape/i);

    const skillIssues = await validateSkillReference(tempRoot, {
      name: 'bad',
      path: '../outside',
    });
    expect(skillIssues.length).toBe(1);
    expect(skillIssues[0]).toMatch(/escape/i);

    const readmeIssues = await validateReadmeInstallMatrix(tempRoot);
    expect(readmeIssues.length).toBe(1);
    expect(readmeIssues[0]).toMatch(/Local Git Repository Install/);
  });

  it('version consistency and full repository validation pass', async () => {
    const versionIssues = await validateVersionConsistency(repoRoot);
    expect(versionIssues).toEqual([]);

    const result = await validateRepository({ root: repoRoot });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('repository validation accepts bumped semver versions and rejects malformed versions', async () => {
    const tempRoot = await createValidTempRepository();
    for (const provider of [
      '.claude-plugin',
      '.cursor-plugin',
      '.codex-plugin',
    ]) {
      const manifest: any = {
        name: 'consensus',
        version: '0.1.1',
      };
      if (provider === '.codex-plugin') {
        manifest.skills = './skills/';
      }
      await writeJson(
        path.join(tempRoot, `plugins/consensus/${provider}/plugin.json`),
        manifest,
      );
    }

    const bumped = await validateRepository({ root: tempRoot });
    expect(bumped.ok, bumped.errors.join('\n')).toBe(true);

    await writeJson(
      path.join(tempRoot, 'plugins/consensus/.codex-plugin/plugin.json'),
      {
        name: 'consensus',
        version: 'next',
        skills: './skills/',
      },
    );

    const malformed = await validateRepository({ root: tempRoot });
    expect(malformed.ok).toBe(false);
    expect(malformed.errors.join('\n')).toMatch(/valid semver/);
  });

  it('full repository validation rejects invalid standalone skill directories', async () => {
    const tempRoot = await createValidTempRepository();
    await mkdir(path.join(tempRoot, 'skills/bad-skill'), { recursive: true });
    await writeFile(
      path.join(tempRoot, 'skills/bad-skill/SKILL.md'),
      `---
name: bad-skill
---
# Bad Skill
`,
    );

    const result = await validateRepository({ root: tempRoot });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(
      /skills\/bad-skill\/SKILL\.md missing frontmatter field: description/,
    );
  });

  it('validation accepts skill with matching top-level and metadata versions', async () => {
    const tempRoot = await createValidTempRepository();
    await writeFile(
      path.join(tempRoot, 'plugins/consensus/skills/refine/SKILL.md'),
      `---
name: refine
description: Test skill
license: MIT
compatibility: codex
version: '0.1.0'
metadata:
  version: '0.1.0'
---
# Consensus Refine
`,
    );

    const result = await validateRepository({ root: tempRoot });
    expect(result.ok, result.errors.join('\n')).toBe(true);
  });

  it('validation accepts legacy metadata-only skill frontmatter', async () => {
    const tempRoot = await createValidTempRepository();
    await writeFile(
      path.join(tempRoot, 'plugins/consensus/skills/refine/SKILL.md'),
      `---
name: refine
description: Test skill
license: MIT
compatibility: codex
metadata:
  version: '0.1.0'
---
# Consensus Refine
`,
    );

    const result = await validateRepository({ root: tempRoot });
    expect(result.ok, result.errors.join('\n')).toBe(true);
  });

  it('validation rejects mismatched top-level and metadata versions', async () => {
    const tempRoot = await createValidTempRepository();
    await writeFile(
      path.join(tempRoot, 'plugins/consensus/skills/refine/SKILL.md'),
      `---
name: refine
description: Test skill
license: MIT
compatibility: codex
version: '0.2.0'
metadata:
  version: '0.1.0'
---
# Consensus Refine
`,
    );

    const result = await validateRepository({ root: tempRoot });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/version mismatch/i);
  });

  it('validation rejects malformed top-level version with a clear message', async () => {
    const tempRoot = await createValidTempRepository();
    await writeFile(
      path.join(tempRoot, 'plugins/consensus/skills/refine/SKILL.md'),
      `---
name: refine
description: Test skill
license: MIT
compatibility: codex
version: not-a-version
metadata:
  version: '0.1.0'
---
# Consensus Refine
`,
    );

    const result = await validateRepository({ root: tempRoot });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/version must be valid semver/i);
  });
});
