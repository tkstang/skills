import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MAX_TESTED_PASEO_VERSION,
  MIN_PASEO_VERSION
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const repoRoot = new URL('..', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

test('README documents v0.1 local install paths and Paseo prerequisite range', async () => {
  const readme = await read('README.md');

  assert.match(readme, /claude plugin marketplace add "\$PWD" --scope user/);
  assert.match(readme, /claude plugin install consensus@skills --scope user/);
  assert.match(readme, /codex plugin marketplace add "\$PWD"/);
  assert.match(readme, /codex plugin add consensus --marketplace skills/);
  assert.match(readme, /cursor agent --plugin-dir "\$PWD\/plugins\/consensus"/);
  assert.match(readme, /session-scoped through Cursor Agent's `--plugin-dir` option/);
  assert.match(readme, new RegExp(`tested range ${MIN_PASEO_VERSION.replaceAll('.', '\\.')} to ${MAX_TESTED_PASEO_VERSION.replaceAll('.', '\\.')}`, 'i'));
  assert.match(readme, /scripts\/install-paseo\.mjs/);
});

test('README names permissions, limitations, no telemetry, prompt injection, and advanced peer config', async () => {
  const readme = await read('README.md');

  assert.match(readme, /^## Permissions$/m);
  assert.match(readme, /^## Limitations$/m);
  assert.match(readme, /no telemetry/i);
  assert.match(readme, /prompt injection/i);
  assert.match(readme, /^## Advanced Configuration$/m);
  assert.match(readme, /custom ACP providers/i);
  assert.match(readme, /cursor-as-peer/i);
  assert.match(readme, /consensus-create/);
  assert.match(readme, /parallel-revision/);
  assert.match(readme, /parallel-synthesized/);
  assert.match(readme, /whole-document harmonization/);
});

test('README documents iteration modes as available, not future work', async () => {
  const readme = await read('README.md');

  // Parallel modes are shipped, no longer "future work".
  assert.doesNotMatch(readme, /parallel-revision and parallel-synthesized modes are future work/i);
  // The new selection/escalation flags are named.
  assert.match(readme, /--iteration/);
  assert.match(readme, /--synthesizer/);
  assert.match(readme, /--host-direction/);
  // Harmonization and deliberation metrics/cost caps remain deferred.
  assert.match(readme, /whole-document harmonization/i);
  assert.match(readme, /metrics|cost caps/i);
});

test('plugin README documents iteration modes and escalation flags', async () => {
  const readme = await read('plugins/consensus/README.md');

  assert.match(readme, /--iteration/);
  assert.match(readme, /parallel_revision/);
  assert.match(readme, /parallel_synthesized/);
  assert.match(readme, /--synthesizer/);
  assert.match(readme, /--host-direction/);
  assert.doesNotMatch(readme, /parallel-revision and parallel-synthesized modes are future work/i);
  assert.match(readme, /whole-document harmonization/i);
});

test('CHANGELOG records the v0.2 iteration-mode work under Unreleased', async () => {
  const changelog = await read('CHANGELOG.md');

  // The v0.2 mode work is documented in the Unreleased changelog.
  assert.match(changelog, /parallel-revision/i);
  assert.match(changelog, /parallel-synthesized/i);
  assert.match(changelog, /escalation/i);
  assert.match(changelog, /v1.*schema|schema.*v1/i);
  assert.match(changelog, /--iteration/);
  assert.match(changelog, /--synthesizer/);
  assert.match(changelog, /--host-direction/);
});

test('CONTRIBUTING and CHANGELOG document release-scope rules', async () => {
  const contributing = await read('CONTRIBUTING.md');
  const changelog = await read('CHANGELOG.md');

  assert.match(contributing, /additive skill frontmatter/i);
  assert.match(contributing, /cross-provider testing/i);
  assert.match(changelog, /alternating-mode deliberation/i);
  assert.match(changelog, /resume/i);
  assert.match(changelog, /Paseo install assist/i);
  assert.match(changelog, /mocked smoke test/i);
  assert.match(changelog, new RegExp(`${MIN_PASEO_VERSION.replaceAll('.', '\\.')}.*${MAX_TESTED_PASEO_VERSION.replaceAll('.', '\\.')}`));
});
