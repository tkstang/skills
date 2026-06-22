import { readFile, readdir } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url);

async function read(relativePath: string) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

// The dense reference content was migrated out of README.md into the Fumadocs
// docs site under documentation/docs/ (the docs-ia project). These tests assert
// the new source of truth: README.md is a slim entry point (project description +
// install matrix + links), and the migrated detail lives in the docs site.
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

describe('readme-scope', () => {
  it('README keeps the v0.1 local install matrix as the entry point', async () => {
    const readme = await read('README.md');

    expect(readme).toMatch(/^## Local Git Repository Install$/m);
    expect(readme).toMatch(
      /claude plugin marketplace add "\$PWD" --scope user/,
    );
    expect(readme).toMatch(
      /claude plugin install consensus@skills --scope user/,
    );
    expect(readme).toMatch(/codex plugin marketplace add "\$PWD"/);
    expect(readme).toMatch(/codex plugin add consensus --marketplace skills/);
    expect(readme).toMatch(
      /cursor agent --plugin-dir "\$PWD\/plugins\/consensus"/,
    );
    expect(readme).toMatch(/Node\.js 22/);
  });

  it('README is a slim entry point that links into the docs site', async () => {
    const readme = await read('README.md');

    // Links readers into the migrated docs site.
    expect(readme).toMatch(/documentation\/docs\//);
    // The dense reference sections were moved out of the README.
    expect(readme).not.toMatch(/^## Permissions$/m);
    expect(readme).not.toMatch(/^## Advanced Configuration$/m);
  });

  it('docs site carries the install prerequisites and provider-readiness commands', async () => {
    const docs = await readDocsSite();

    expect(docs).toMatch(/Node\.js 22 or newer/);
    expect(docs).toMatch(/consensus CLI/i);
    expect(docs).toMatch(/consensus provider ls --json/);
    expect(docs).toMatch(/consensus preflight --json/);
    // Cursor `--plugin-dir` caveat (prose may wrap across lines in the docs).
    expect(docs).toMatch(/session-scoped/);
    expect(docs).toMatch(/--plugin-dir/);
  });

  it('docs site names permissions, limitations, no telemetry, prompt injection, and advanced peer config', async () => {
    const docs = await readDocsSite();

    expect(docs).toMatch(/^## Permissions$/m);
    expect(docs).toMatch(/^## Limitations$/m);
    expect(docs).toMatch(/no telemetry/i);
    expect(docs).toMatch(/prompt injection/i);
    expect(docs).toMatch(/provider inventory/i);
    expect(docs).toMatch(/auth_required/);
    expect(docs).toMatch(/consensus-create/);
    expect(docs).toMatch(/consensus-decide/);
    expect(docs).toMatch(/consensus-plan/);
    expect(docs).toMatch(/brief/i);
    expect(docs).toMatch(/## Steps/);
    expect(docs).toMatch(/## Dependencies/);
    expect(docs).toMatch(/## Risks/);
    expect(docs).toMatch(/Dissent \/ Unresolved Disagreement/);
    expect(docs).toMatch(/independent_draft/);
    expect(docs).toMatch(/parallel_revision/);
    expect(docs).toMatch(/parallel_synthesized/);
    expect(docs).toMatch(/whole-document harmonization/);
    expect(docs).toMatch(
      /configuration shared by \[`create`\][\s\S]*\[`decide`\][\s\S]*\[`plan`\][\s\S]*\[`refine`\][\s\S]*\[`evaluate`\]/i,
    );
    expect(docs).toMatch(
      /`create`, `decide`, and `plan` default to[\s\S]*`--cold-start independent_draft`/i,
    );
    expect(docs).not.toMatch(/not yet supported for this skill family/i);
    expect(docs).not.toMatch(/custom ACP provider/i);
  });

  it('docs site documents iteration modes as available, not future work', async () => {
    const docs = await readDocsSite();

    // Parallel modes are shipped, no longer "future work".
    expect(docs).not.toMatch(
      /parallel-revision and parallel-synthesized modes are future work/i,
    );
    // The selection/escalation flags are named.
    expect(docs).toMatch(/--iteration/);
    expect(docs).toMatch(/--synthesizer/);
    expect(docs).toMatch(/--host-direction/);
    // Harmonization and deliberation metrics/cost caps remain deferred.
    expect(docs).toMatch(/whole-document harmonization/i);
    expect(docs).toMatch(/metrics|cost caps/i);
  });

  it('docs site documents consensus-create as shipped, not future work', async () => {
    const docs = await readDocsSite();

    expect(docs).toMatch(/consensus-create/);
    expect(docs).toMatch(/--brief <text>|--brief-file <path>/);
    expect(docs).toMatch(/Created Artifact/);
    expect(docs).toMatch(/consensus-resolution/);
    expect(docs).not.toMatch(
      /Remaining consensus-family skills are future work:[^\n]*consensus-create/i,
    );
  });

  it('docs site documents consensus-decide as shipped, not future work', async () => {
    const docs = await readDocsSite();

    expect(docs).toMatch(/consensus-decide/);
    expect(docs).toMatch(/--options <path>/);
    expect(docs).toMatch(/Recommendation/);
    expect(docs).toMatch(/Reasoning/);
    expect(docs).toMatch(/Alternatives/);
    expect(docs).toMatch(/Dissent \/ Unresolved Disagreement/);
    expect(docs).toMatch(/minimal/);
    expect(docs).toMatch(/consensus-resolution/);
    expect(docs).toMatch(
      /independent-draft cold-start strategy is exposed through `create`,\s+`decide`, and `plan`/i,
    );
    expect(docs).not.toMatch(
      /Remaining consensus-family skills are future work:[^\n]*consensus-decide/i,
    );
  });

  it('docs site documents consensus-plan as shipped, not future work', async () => {
    const docs = await readDocsSite();

    expect(docs).toMatch(/consensus-plan/);
    expect(docs).toMatch(/--goal <text>/);
    expect(docs).toMatch(/--constraints <text>/);
    expect(docs).toMatch(/## Steps/);
    expect(docs).toMatch(/## Dependencies/);
    expect(docs).toMatch(/## Risks/);
    expect(docs).toMatch(/moderate/);
    expect(docs).toMatch(/consensus-resolution/);
    expect(docs).toMatch(
      /independent-draft cold-start strategy is exposed through `create`,\s+`decide`, and `plan`/i,
    );
    expect(docs).not.toMatch(
      /Remaining consensus-family skills are future work:[^\n]*consensus-plan/i,
    );
  });

  it('plugin README documents iteration modes and escalation flags', async () => {
    const readme = await read('plugins/consensus/README.md');

    expect(readme).toMatch(/consensus provider ls --json/);
    expect(readme).toMatch(/consensus preflight --json/);
    expect(readme).toMatch(/--iteration/);
    expect(readme).toMatch(/parallel_revision/);
    expect(readme).toMatch(/parallel_synthesized/);
    expect(readme).toMatch(/--synthesizer/);
    expect(readme).toMatch(/--host-direction/);
    expect(readme).not.toMatch(
      /parallel-revision and parallel-synthesized modes are future work/i,
    );
    expect(readme).toMatch(/whole-document harmonization/i);
  });

  it('README and plugin README summarize consensus-create as shipped', async () => {
    const readme = await read('README.md');
    const pluginReadme = await read('plugins/consensus/README.md');

    expect(readme).toMatch(/consensus.*create/i);
    expect(readme).toMatch(/brief/i);
    expect(pluginReadme).toMatch(/consensus-create/);
    expect(pluginReadme).toMatch(/--brief/);
    expect(pluginReadme).toMatch(/independent_draft/);
    expect(pluginReadme).not.toMatch(
      /Remaining consensus family skills are future work:[\s\S]*consensus-create/i,
    );
  });

  it('README and plugin README summarize consensus-decide as shipped', async () => {
    const readme = await read('README.md');
    const pluginReadme = await read('plugins/consensus/README.md');

    expect(readme).toMatch(/consensus[\s\S]*decide/i);
    expect(readme).toMatch(/options/i);
    expect(pluginReadme).toMatch(/consensus-decide/);
    expect(pluginReadme).toMatch(/--options/);
    expect(pluginReadme).toMatch(/Dissent \/ Unresolved Disagreement/);
    expect(pluginReadme).not.toMatch(
      /Remaining consensus family skills are future work:[\s\S]*consensus-decide/i,
    );
  });

  it('README and plugin README summarize consensus-plan as shipped', async () => {
    const readme = await read('README.md');
    const pluginReadme = await read('plugins/consensus/README.md');

    expect(readme).toMatch(/consensus[\s\S]*plan/i);
    expect(readme).toMatch(/goal/i);
    expect(pluginReadme).toMatch(/consensus-plan/);
    expect(pluginReadme).toMatch(/--goal/);
    expect(pluginReadme).toMatch(/--constraints/);
    expect(pluginReadme).toMatch(/## Dependencies/);
    expect(pluginReadme).not.toMatch(
      /Remaining consensus family skills are future work:[\s\S]*consensus-plan/i,
    );
  });

  it('CHANGELOG records consensus-create under Unreleased Added', async () => {
    const changelog = await read('CHANGELOG.md');

    expect(changelog).toMatch(
      /## \[Unreleased\][\s\S]*### Added[\s\S]*consensus-create/i,
    );
    expect(changelog).toMatch(/independent_draft/);
    expect(changelog).toMatch(/parallel_synthesized/);
    expect(changelog).toMatch(/consensus-resolution/);
  });

  it('CHANGELOG records consensus-decide under Unreleased Added', async () => {
    const changelog = await read('CHANGELOG.md');

    expect(changelog).toMatch(
      /## \[Unreleased\][\s\S]*### Added[\s\S]*consensus-decide/i,
    );
    expect(changelog).toMatch(/independent_draft/);
    expect(changelog).toMatch(/parallel_synthesized/);
    expect(changelog).toMatch(/minimal/);
    expect(changelog).toMatch(/Dissent \/ Unresolved Disagreement/);
  });

  it('CHANGELOG records consensus-plan under Unreleased Added', async () => {
    const changelog = await read('CHANGELOG.md');

    expect(changelog).toMatch(
      /## \[Unreleased\][\s\S]*### Added[\s\S]*consensus-plan/i,
    );
    expect(changelog).toMatch(/independent_draft/);
    expect(changelog).toMatch(/parallel_synthesized/);
    expect(changelog).toMatch(/moderate/);
    expect(changelog).toMatch(/## Steps/);
    expect(changelog).toMatch(/## Dependencies/);
    expect(changelog).toMatch(/## Risks/);
  });

  it('CHANGELOG records the v0.1 iteration-mode work under Unreleased', async () => {
    const changelog = await read('CHANGELOG.md');

    expect(changelog).toMatch(/parallel_revision/i);
    expect(changelog).toMatch(/parallel_synthesized/i);
    expect(changelog).toMatch(/escalation/i);
    expect(changelog).toMatch(/v1.*schema|schema.*v1/i);
    expect(changelog).toMatch(/--iteration/);
    expect(changelog).toMatch(/--synthesizer/);
    expect(changelog).toMatch(/--host-direction/);
  });

  it('CONTRIBUTING and CHANGELOG document release-scope rules', async () => {
    const contributing = await read('CONTRIBUTING.md');
    const changelog = await read('CHANGELOG.md');

    expect(contributing).toMatch(/additive skill frontmatter/i);
    expect(contributing).toMatch(/cross-provider testing/i);
    expect(changelog).toMatch(/alternating-mode deliberation/i);
    expect(changelog).toMatch(/resume/i);
    expect(changelog).toMatch(/mocked smoke test/i);
  });
});
