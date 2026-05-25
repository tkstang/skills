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
