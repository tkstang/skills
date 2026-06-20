import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url);

async function read(relativePath: string) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

describe('readme-scope', () => {
  it('README documents v0.1 local install paths and consensus CLI prerequisites', async () => {
    const readme = await read('README.md');

    expect(readme).toMatch(/claude plugin marketplace add "\$PWD" --scope user/);
    expect(readme).toMatch(/claude plugin install consensus@skills --scope user/);
    expect(readme).toMatch(/codex plugin marketplace add "\$PWD"/);
    expect(readme).toMatch(/codex plugin add consensus --marketplace skills/);
    expect(readme).toMatch(/cursor agent --plugin-dir "\$PWD\/plugins\/consensus"/);
    expect(readme).toMatch(
      /session-scoped through Cursor Agent's `--plugin-dir` option/,
    );
    expect(readme).toMatch(/Node\.js 22 or newer/);
    expect(readme).toMatch(/consensus CLI/i);
    expect(readme).toMatch(/consensus provider ls --json/);
    expect(readme).toMatch(/consensus preflight --json/);
  });

  it('README names permissions, limitations, no telemetry, prompt injection, and advanced peer config', async () => {
    const readme = await read('README.md');

    expect(readme).toMatch(/^## Permissions$/m);
    expect(readme).toMatch(/^## Limitations$/m);
    expect(readme).toMatch(/no telemetry/i);
    expect(readme).toMatch(/prompt injection/i);
    expect(readme).toMatch(/^## Advanced Configuration$/m);
    expect(readme).toMatch(/provider inventory/i);
    expect(readme).toMatch(/Cursor.*auth_required/i);
    expect(readme).toMatch(/consensus-create/);
    expect(readme).toMatch(/parallel_revision/);
    expect(readme).toMatch(/parallel_synthesized/);
    expect(readme).toMatch(/whole-document harmonization/);
    expect(readme).not.toMatch(/custom ACP provider/i);
  });

  it('README documents iteration modes as available, not future work', async () => {
    const readme = await read('README.md');

    // Parallel modes are shipped, no longer "future work".
    expect(readme).not.toMatch(
      /parallel-revision and parallel-synthesized modes are future work/i,
    );
    // The new selection/escalation flags are named.
    expect(readme).toMatch(/--iteration/);
    expect(readme).toMatch(/--synthesizer/);
    expect(readme).toMatch(/--host-direction/);
    // Harmonization and deliberation metrics/cost caps remain deferred.
    expect(readme).toMatch(/whole-document harmonization/i);
    expect(readme).toMatch(/metrics|cost caps/i);
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
