import { lstat, readFile, readdir } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url);

// Dense reference content was migrated out of README.md into the docs site
// under documentation/docs/ (the docs-ia project). Read the whole site so
// presence assertions track the new source of truth, not exact page placement.
async function readDocsSite(): Promise<string> {
  const docsDir = new URL('documentation/docs/', repoRoot);
  const entries = await readdir(docsDir, { recursive: true });
  const markdown = entries.filter(
    (entry) => typeof entry === 'string' && entry.endsWith('.md'),
  );
  const contents = await Promise.all(
    markdown.map((rel) =>
      readFile(new URL(`documentation/docs/${rel}`, repoRoot), 'utf8'),
    ),
  );
  return contents.join('\n\n');
}
const requiredDocs = [
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'RELEASING.md',
];
const refineSkillPath = 'plugins/consensus/skills/refine/SKILL.md';
const evaluateSkillPath = 'plugins/consensus/skills/evaluate/SKILL.md';
const createSkillPath = 'plugins/consensus/skills/create/SKILL.md';
const decideSkillPath = 'plugins/consensus/skills/decide/SKILL.md';
const planSkillPath = 'plugins/consensus/skills/plan/SKILL.md';
const panelSkillPath = 'plugins/consensus/skills/panel/SKILL.md';
const panelDocPath = 'documentation/docs/user-guide/consensus/panel.md';
const sessionObserverCollabDocPath =
  'documentation/docs/user-guide/skills/session-observer-collab.md';

async function read(relativePath: string) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

describe('docs-presence', () => {
  it('baseline documentation files exist', async () => {
    for (const docPath of requiredDocs) {
      const contents = await read(docPath);
      expect(
        contents.trim().length > 0,
        `${docPath} should not be empty`,
      ).toBeTruthy();
    }
  });

  it('README keeps the install matrix; permissions and limitations live in the docs site', async () => {
    const readme = await read('README.md');
    const docs = await readDocsSite();

    // README retains the install-matrix entry point (the tag-time gate).
    expect(readme).toMatch(/^## Local Git Repository Install$/m);
    // The dense permissions/limitations detail was migrated into the site.
    expect(docs).toMatch(/^## Permissions$/m);
    expect(docs).toMatch(/^## Limitations$/m);
  });

  it('license, changelog, and provider docs contract are present', async () => {
    expect(await read('LICENSE')).toMatch(/MIT License/);
    expect(await read('CHANGELOG.md')).toMatch(
      /## \[0\.1\.0\] - \d{4}-\d{2}-\d{2}/,
    );

    const claude = await lstat(new URL('CLAUDE.md', repoRoot));
    expect(claude.isSymbolicLink()).toBe(false);
    expect((await read('CLAUDE.md')).trim()).toBe('@AGENTS.md');
  });

  it('refine SKILL.md documents iteration-mode and escalation sections', async () => {
    const skill = await read(refineSkillPath);

    expect(skill).toMatch(/^## Iteration Modes$/m);
    expect(skill).toMatch(/^## Escalation Handling$/m);
  });

  it('refine SKILL.md contains usage guidance sections', async () => {
    const skill = await read(refineSkillPath);

    expect(skill).toMatch(/^## When NOT to Use$/m);
    expect(skill).toMatch(/^## Examples$/m);
    expect(skill).toMatch(/^## Success Criteria$/m);
  });

  it('evaluate SKILL.md contains usage guidance sections', async () => {
    const skill = await read(evaluateSkillPath);

    expect(skill).toMatch(/^## When NOT to Use$/m);
    expect(skill).toMatch(/^## Examples$/m);
    expect(skill).toMatch(/^## Success Criteria$/m);
  });

  it('create SKILL.md contains usage guidance sections', async () => {
    const skill = await read(createSkillPath);

    expect(skill).toMatch(/^## When NOT to Use$/m);
    expect(skill).toMatch(/^## Examples$/m);
    expect(skill).toMatch(/^## Success Criteria$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/^## Create Invocation$/m);
  });

  it('decide SKILL.md contains usage guidance sections', async () => {
    const skill = await read(decideSkillPath);

    expect(skill).toMatch(/^## When NOT to Use$/m);
    expect(skill).toMatch(/^## Examples$/m);
    expect(skill).toMatch(/^## Success Criteria$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/^## Decision Invocation$/m);
  });

  it('plan SKILL.md contains usage guidance sections', async () => {
    const skill = await read(planSkillPath);

    expect(skill).toMatch(/^## When NOT to Use$/m);
    expect(skill).toMatch(/^## Examples$/m);
    expect(skill).toMatch(/^## Success Criteria$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/^## Plan Invocation$/m);
  });

  it('panel SKILL.md contains usage guidance sections', async () => {
    const skill = await read(panelSkillPath);

    expect(skill).toMatch(/^## When NOT to Use$/m);
    expect(skill).toMatch(/^## Examples$/m);
    expect(skill).toMatch(/^## Success Criteria$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/^## Panel Invocation$/m);
    expect(skill).toMatch(/^## Moderator Neutrality$/m);
  });

  it('evaluate SKILL.md documents guided rubric creation flow', async () => {
    const skill = await read(evaluateSkillPath);

    expect(skill).toMatch(/^## Guided Rubric Creation$/m);
    // no-rubric evaluation trigger
    expect(skill).toMatch(/no rubric|provides no rubric|without a rubric/i);
    // user-approved paths
    expect(skill).toMatch(/user-approved/i);
    // 12-criteria cap
    expect(skill).toMatch(/12/);
  });

  it('evaluate SKILL.md links to bundled rubric examples', async () => {
    const skill = await read(evaluateSkillPath);

    expect(skill).toMatch(/general-purpose\.md/);
    expect(skill).toMatch(/code-review\.md/);
    expect(skill).toMatch(/technical-writing\.md/);
    expect(skill).toMatch(/design-architecture\.md/);
  });

  it('evaluate skill is documented and registered in distribution surfaces', async () => {
    const requiredEvaluateFiles = [
      evaluateSkillPath,
      'plugins/consensus/skills/evaluate/references/operator-qa.md',
      'plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs',
      'plugins/consensus/scripts/consensus-loop.mjs',
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

  it('create skill is documented and registered in distribution surfaces', async () => {
    const requiredCreateFiles = [
      createSkillPath,
      'plugins/consensus/skills/create/references/operator-qa.md',
      'plugins/consensus/skills/create/references/examples/artifact-brief.md',
      'plugins/consensus/skills/create/scripts/consensus-create.mjs',
      'plugins/consensus/scripts/consensus-loop.mjs',
      'plugins/consensus/skills/create/schemas/verdict-alternating.schema.json',
      'plugins/consensus/skills/create/schemas/verdict-parallel.schema.json',
      'plugins/consensus/skills/create/schemas/synthesis.schema.json',
    ];

    for (const relativePath of requiredCreateFiles) {
      const contents = await read(relativePath);
      expect(
        contents.trim().length > 0,
        `${relativePath} should not be empty`,
      ).toBeTruthy();
    }

    const skill = await read(createSkillPath);
    expect(skill).toMatch(/^name: create$/m);
    expect(skill).toMatch(/^## Create Invocation$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/--brief <text>/);
    expect(skill).toMatch(/--brief-file <path>/);
    expect(skill).toMatch(/independent_draft/);
    expect(skill).toMatch(/parallel_synthesized/);
    expect(skill).toMatch(/maximum/);
    expect(skill).toMatch(/consensus-resolution/);

    const qa = await read(
      'plugins/consensus/skills/create/references/operator-qa.md',
    );
    expect(qa).toMatch(/consensus-create\.mjs/);
    expect(qa).toMatch(/--brief/);
    expect(qa).toMatch(/Deliberation Log/);

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
      expect(searchable).toMatch(/create/);
    }
  });

  it('decide skill is documented and registered in distribution surfaces', async () => {
    const requiredDecideFiles = [
      decideSkillPath,
      'plugins/consensus/skills/decide/references/operator-qa.md',
      'plugins/consensus/skills/decide/references/examples/contested-options.md',
      'plugins/consensus/skills/decide/scripts/consensus-decide.mjs',
      'plugins/consensus/scripts/consensus-loop.mjs',
      'plugins/consensus/skills/decide/schemas/verdict-alternating.schema.json',
      'plugins/consensus/skills/decide/schemas/verdict-parallel.schema.json',
      'plugins/consensus/skills/decide/schemas/synthesis.schema.json',
    ];

    for (const relativePath of requiredDecideFiles) {
      const contents = await read(relativePath);
      expect(
        contents.trim().length > 0,
        `${relativePath} should not be empty`,
      ).toBeTruthy();
    }

    const skill = await read(decideSkillPath);
    expect(skill).toMatch(/^name: decide$/m);
    expect(skill).toMatch(/^## Decision Invocation$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/--options <path>/);
    expect(skill).toMatch(/independent_draft/);
    expect(skill).toMatch(/parallel_synthesized/);
    expect(skill).toMatch(/minimal/);
    expect(skill).toMatch(/Dissent \/ Unresolved Disagreement/);
    expect(skill).toMatch(/consensus-resolution/);

    const qa = await read(
      'plugins/consensus/skills/decide/references/operator-qa.md',
    );
    expect(qa).toMatch(/consensus-decide\.mjs/);
    expect(qa).toMatch(/--options/);
    expect(qa).toMatch(/Dissent \/ Unresolved Disagreement/);
  });

  it('plan skill is documented and registered in distribution surfaces', async () => {
    const requiredPlanFiles = [
      planSkillPath,
      'plugins/consensus/skills/plan/references/operator-qa.md',
      'plugins/consensus/skills/plan/references/examples/goal-and-constraints.md',
      'plugins/consensus/skills/plan/scripts/consensus-plan.mjs',
      'plugins/consensus/scripts/consensus-loop.mjs',
      'plugins/consensus/skills/plan/schemas/verdict-alternating.schema.json',
      'plugins/consensus/skills/plan/schemas/verdict-parallel.schema.json',
      'plugins/consensus/skills/plan/schemas/synthesis.schema.json',
    ];

    for (const relativePath of requiredPlanFiles) {
      const contents = await read(relativePath);
      expect(
        contents.trim().length > 0,
        `${relativePath} should not be empty`,
      ).toBeTruthy();
    }

    const skill = await read(planSkillPath);
    expect(skill).toMatch(/^name: plan$/m);
    expect(skill).toMatch(/^## Plan Invocation$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/--goal <text>/);
    expect(skill).toMatch(/--constraints <text>/);
    expect(skill).toMatch(/independent_draft/);
    expect(skill).toMatch(/parallel_synthesized/);
    expect(skill).toMatch(/moderate/);
    expect(skill).toMatch(/## Steps/);
    expect(skill).toMatch(/## Dependencies/);
    expect(skill).toMatch(/## Risks/);
    expect(skill).toMatch(/consensus-resolution/);

    const qa = await read(
      'plugins/consensus/skills/plan/references/operator-qa.md',
    );
    expect(qa).toMatch(/consensus-plan\.mjs/);
    expect(qa).toMatch(/--goal/);
    expect(qa).toMatch(/## Steps/);
    expect(qa).toMatch(/## Dependencies/);
    expect(qa).toMatch(/## Risks/);
  });

  it('panel skill is documented and registered in skill surfaces', async () => {
    const requiredPanelFiles = [
      panelSkillPath,
      'plugins/consensus/skills/panel/references/operator-qa.md',
      'plugins/consensus/skills/panel/references/examples/design-risk-question.md',
      'plugins/consensus/skills/panel/references/examples/privacy-boundary-question.md',
      'plugins/consensus/skills/panel/scripts/consensus-panel.mjs',
      'plugins/consensus/skills/panel/scripts/consensus-config.mjs',
      'plugins/consensus/skills/panel/schemas/panel-response.schema.json',
    ];

    for (const relativePath of requiredPanelFiles) {
      const contents = await read(relativePath);
      expect(
        contents.trim().length > 0,
        `${relativePath} should not be empty`,
      ).toBeTruthy();
    }

    const skill = await read(panelSkillPath);
    expect(skill).toMatch(/^name: panel$/m);
    expect(skill).toMatch(/^## Panel Invocation$/m);
    expect(skill).toMatch(/^## Output Contract$/m);
    expect(skill).toMatch(/--question <text>/);
    expect(skill).toMatch(/--question-file <path>/);
    expect(skill).toMatch(/--panelists <provider-id/);
    expect(skill).toMatch(/--panel-size <n>/);
    expect(skill).toMatch(/neutral moderator/i);
    expect(skill).toMatch(/context approval/i);

    const qa = await read(
      'plugins/consensus/skills/panel/references/operator-qa.md',
    );
    expect(qa).toMatch(/consensus-panel\.mjs/);
    expect(qa).toMatch(/--panelists/);
    expect(qa).toMatch(/JSONL/);
  });

  it('panel docs page exists and is navigable', async () => {
    const panelDoc = await read(panelDocPath);
    const index = await read('documentation/docs/user-guide/consensus/index.md');
    const meta = JSON.parse(
      await read('documentation/docs/user-guide/consensus/meta.json'),
    );

    expect(panelDoc).toMatch(/^title: ['"]?Panel['"]?$/m);
    expect(panelDoc).toMatch(/consensus-panel/);
    expect(panelDoc).toMatch(/neutral moderator/i);
    expect(panelDoc).toMatch(/--panelists/);
    expect(panelDoc).toMatch(/--panel-size/);
    expect(index).toMatch(/\[panel\]\(panel\.md\)/i);
    expect(index).toMatch(/side-by-side|attributed/i);
    expect(meta.pages).toContain('panel');
  });

  it('session observer collaboration docs exist and are navigable', async () => {
    const collabDoc = await read(sessionObserverCollabDocPath);
    const index = await read('documentation/docs/user-guide/skills/index.md');
    const meta = JSON.parse(
      await read('documentation/docs/user-guide/skills/meta.json'),
    );

    expect(collabDoc).toMatch(
      /^title: ['"]?Session Observer Collaboration['"]?$/m,
    );
    expect(collabDoc).toMatch(/N=2/);
    expect(collabDoc).toMatch(/whoami --json/);
    expect(collabDoc).toMatch(/--quiet-empty/);
    expect(collabDoc).toMatch(/--strict-baseline/);
    expect(collabDoc).toMatch(/event-wake/);
    expect(collabDoc).toMatch(/lifecycle-continuation/);
    expect(collabDoc).toMatch(/scheduled-poll/);
    expect(collabDoc).toMatch(/buffered-manual/);
    expect(collabDoc).toMatch(/Codex validated/);
    expect(collabDoc).toMatch(/Cursor documented-but-unvalidated/);
    expect(collabDoc).toMatch(/Claude Code Monitor unvalidated/);
    expect(collabDoc).toMatch(/authority/i);
    expect(collabDoc).toMatch(/## Closeout/);
    expect(collabDoc).toMatch(/runtime-claude-code\.md/);
    expect(collabDoc).toMatch(/runtime-codex\.md/);
    expect(collabDoc).toMatch(/runtime-cursor\.md/);
    expect(index).toMatch(
      /\[Session Observer Collaboration\]\(session-observer-collab\.md\)/,
    );
    expect(meta.pages).toContain('session-observer-collab');
  });

  it('configuration docs cover panel defaults, paths, and precedence', async () => {
    const config = await read(
      'documentation/docs/user-guide/consensus/configuration.md',
    );

    expect(config).toMatch(/\.config\/consensus\/config\.json/);
    expect(config).toMatch(/\.consensus\/config\.json/);
    expect(config).toMatch(
      /invocation[\s\S]*project[\s\S]*user[\s\S]*built-in/i,
    );
    expect(config).toMatch(/--panelists/);
    expect(config).toMatch(/--panel-size/);
    expect(config).toMatch(/consensus config/);
  });

  it('documentation records the generated TypeScript runtime contract', async () => {
    const docs = await readDocsSite();
    const rootAgents = await read('AGENTS.md');
    const consensusAgents = await read('plugins/consensus/AGENTS.md');
    const testAgents = await read('tests/AGENTS.md');
    const decisionIndex = await read('.oat/repo/reference/decisions/index.md');
    const canonicalTypescriptDecision = await read(
      '.oat/repo/reference/decisions/DR-260615-canonical-typescript-sources.md',
    );
    const sharedTranscriptDecision = await read(
      '.oat/repo/reference/decisions/DR-260604-shared-transcript-knowledge.md',
    );
    const sharedTranscriptCore = await read('shared/transcript-core/README.md');
    const exportTranscriptFormats = await read(
      'skills/export-session-transcript/references/transcript-formats.md',
    );

    // The generated-runtime contract now lives in the docs site
    // (Engineering → Architecture), not the README.
    expect(docs).toMatch(/[Gg]enerated runtime/);
    expect(docs).toMatch(/src\/transcript\/core\/runtimes\.ts/);
    expect(docs).toMatch(/sync:transcript-core/);
    expect(docs).toMatch(/scripts\/build-generated\.mjs/);
    expect(rootAgents).toMatch(/canonical TypeScript source/);
    expect(rootAgents).toMatch(
      /pnpm run sync:transcript-core.*compatibility wrapper/,
    );
    expect(consensusAgents).toMatch(/src\/consensus\//);
    expect(consensusAgents).toMatch(
      /plugins\/consensus\/skills\/\*\/scripts\//,
    );
    expect(testAgents).toMatch(
      /tests\/tooling\/generated-output-sync\.test\.ts/,
    );
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
    expect(decisionIndex).toMatch(/DR-260615-canonical-typescript-sources/);
    expect(decisionIndex).toMatch(/DR-260604-shared-transcript-knowledge/);
    expect(canonicalTypescriptDecision).toMatch(
      /Canonical TypeScript sources build committed generated runtime outputs/,
    );
    expect(sharedTranscriptDecision).toMatch(
      /DR-014[\s\S]+Superseded in implementation/,
    );
  });
});
