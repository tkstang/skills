import { lstat, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('..', import.meta.url);
const requiredDocs = [
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'RELEASING.md',
];
const refineSkillPath = 'plugins/consensus/skills/refine/SKILL.md';
const evaluateSkillPath = 'plugins/consensus/skills/evaluate/SKILL.md';

async function read(relativePath: string) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

describe('docs-presence', () => {
  it('baseline documentation files exist', async () => {
    for (const docPath of requiredDocs) {
      const contents = await read(docPath);
      expect(contents.trim().length > 0, `${docPath} should not be empty`).toBeTruthy();
    }
  });

  it('README documents local git repository install, permissions, and limitations', async () => {
    const readme = await read('README.md');

    expect(readme).toMatch(/^## Local Git Repository Install$/m);
    expect(readme).toMatch(/^## Permissions$/m);
    expect(readme).toMatch(/^## Limitations$/m);
  });

  it('license, changelog, and provider docs contract are present', async () => {
    expect(await read('LICENSE')).toMatch(/MIT License/);
    expect(await read('CHANGELOG.md')).toMatch(/## \[0\.1\.0\] - Unreleased/);

    const claude = await lstat(new URL('CLAUDE.md', repoRoot));
    expect(claude.isSymbolicLink()).toBe(true);
  });

  it('refine SKILL.md documents iteration-mode and escalation sections', async () => {
    const skill = await read(refineSkillPath);

    expect(skill).toMatch(/^## Iteration Modes$/m);
    expect(skill).toMatch(/^## Escalation Handling$/m);
  });

  it('evaluate skill is documented and registered in distribution surfaces', async () => {
    const requiredEvaluateFiles = [
      evaluateSkillPath,
      'plugins/consensus/skills/evaluate/references/operator-qa.md',
      'plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs',
      'plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs',
      'plugins/consensus/skills/evaluate/schemas/verdict-alternating.schema.json',
      'plugins/consensus/skills/evaluate/schemas/verdict-parallel.schema.json',
      'plugins/consensus/skills/evaluate/schemas/synthesis.schema.json',
    ];

    for (const relativePath of requiredEvaluateFiles) {
      const contents = await read(relativePath);
      expect(
        contents.trim().length > 0,
        `${relativePath} should not be empty`,
      ).toBeTruthy();
    }

    const skill = await read(evaluateSkillPath);
    expect(skill).toMatch(/^name: evaluate$/m);
    expect(skill).toMatch(/^## Evaluation Invocation$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/--rubric <path>/);
    expect(skill).toMatch(/parallel_revision/);
    expect(skill).toMatch(/minimal/);
    expect(skill).toMatch(/consensus-verdict/);

    const qa = await read(
      'plugins/consensus/skills/evaluate/references/operator-qa.md',
    );
    expect(qa).toMatch(/consensus-evaluate\.mjs/);
    expect(qa).toMatch(/--rubric/);
    expect(qa).toMatch(/Unresolved dissent/);

    const providerManifests = [
      'plugins/consensus/.claude-plugin/plugin.json',
      'plugins/consensus/.codex-plugin/plugin.json',
      'plugins/consensus/.cursor-plugin/plugin.json',
    ];
    for (const manifestPath of providerManifests) {
      const manifest = JSON.parse(await read(manifestPath));
      const searchable = JSON.stringify(manifest);
      expect(searchable).toMatch(/refine/);
      expect(searchable).toMatch(/evaluate/);
    }
  });

  it('documentation records the generated TypeScript runtime contract', async () => {
    const readme = await read('README.md');
    const rootAgents = await read('AGENTS.md');
    const consensusAgents = await read('plugins/consensus/AGENTS.md');
    const testAgents = await read('tests/AGENTS.md');
    const decisions = await read('.oat/repo/reference/decision-record.md');
    const sharedTranscriptCore = await read('shared/transcript-core/README.md');
    const exportTranscriptFormats = await read(
      'skills/export-session-transcript/references/transcript-formats.md',
    );

    expect(readme).toMatch(/^### Generated runtime outputs$/m);
    expect(readme).toMatch(/src\/transcript\/core\/runtimes\.ts/);
    expect(readme).toMatch(/pnpm run sync:transcript-core.*compatibility wrapper/);
    expect(readme).toMatch(/scripts\/build-generated\.mjs --check/);
    expect(rootAgents).toMatch(/canonical TypeScript source/);
    expect(rootAgents).toMatch(
      /pnpm run sync:transcript-core.*compatibility wrapper/,
    );
    expect(consensusAgents).toMatch(/src\/consensus\//);
    expect(consensusAgents).toMatch(/plugins\/consensus\/skills\/\*\/scripts\//);
    expect(testAgents).toMatch(/tests\/generated-output-sync\.test\.ts/);
    expect(sharedTranscriptCore).toMatch(/src\/transcript\/core\/runtimes\.ts/);
    expect(sharedTranscriptCore).not.toMatch(
      /shared\/transcript-core\/runtimes\.mjs/,
    );
    expect(exportTranscriptFormats).toMatch(
      /src\/transcript\/core\/runtimes\.ts/,
    );
    expect(exportTranscriptFormats).not.toMatch(
      /shared\/transcript-core\/runtimes\.mjs/,
    );
    expect(decisions).toMatch(
      /Canonical TypeScript sources build committed generated runtime outputs/,
    );
    expect(decisions).toMatch(/DR-014[\s\S]+Superseded in implementation/);
  });
});
