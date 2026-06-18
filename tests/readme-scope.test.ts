import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import { MIN_PASEO_VERSION, MAX_TESTED_PASEO_VERSION } from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const repoRoot = new URL('..', import.meta.url);

async function read(relativePath: string) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

describe('readme-scope', () => {
  it('README documents v0.1 local install paths and Paseo prerequisite range', async () => {
    const readme = await read('README.md');

    expect(readme).toMatch(/claude plugin marketplace add "\$PWD" --scope user/);
    expect(readme).toMatch(/claude plugin install consensus@skills --scope user/);
    expect(readme).toMatch(/codex plugin marketplace add "\$PWD"/);
    expect(readme).toMatch(/codex plugin add consensus --marketplace skills/);
    expect(readme).toMatch(/cursor agent --plugin-dir "\$PWD\/plugins\/consensus"/);
    expect(readme).toMatch(
      /session-scoped through Cursor Agent's `--plugin-dir` option/,
    );
    expect(readme).toMatch(
      new RegExp(
        `tested range ${MIN_PASEO_VERSION.replaceAll('.', '\\.')} to ${MAX_TESTED_PASEO_VERSION.replaceAll('.', '\\.')}`,
        'i',
      ),
    );
    expect(readme).toMatch(/scripts\/install-paseo\.mjs/);
  });

  it('README names permissions, limitations, no telemetry, prompt injection, and advanced peer config', async () => {
    const readme = await read('README.md');

    expect(readme).toMatch(/^## Permissions$/m);
    expect(readme).toMatch(/^## Limitations$/m);
    expect(readme).toMatch(/no telemetry/i);
    expect(readme).toMatch(/prompt injection/i);
    expect(readme).toMatch(/^## Advanced Configuration$/m);
    expect(readme).toMatch(/custom ACP providers/i);
    expect(readme).toMatch(/cursor-as-peer/i);
    expect(readme).toMatch(/consensus-create/);
    expect(readme).toMatch(/parallel-revision/);
    expect(readme).toMatch(/parallel-synthesized/);
    expect(readme).toMatch(/whole-document harmonization/);
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

  it('CHANGELOG records the v0.2 iteration-mode work under Unreleased', async () => {
    const changelog = await read('CHANGELOG.md');

    // The v0.2 mode work is documented in the Unreleased changelog.
    expect(changelog).toMatch(/parallel-revision/i);
    expect(changelog).toMatch(/parallel-synthesized/i);
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
    expect(changelog).toMatch(/Paseo install assist/i);
    expect(changelog).toMatch(/mocked smoke test/i);
    expect(changelog).toMatch(
      new RegExp(
        `${MIN_PASEO_VERSION.replaceAll('.', '\\.')}.*${MAX_TESTED_PASEO_VERSION.replaceAll('.', '\\.')}`,
      ),
    );
  });
});
