import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url);
const pluginRoot = new URL('../plugins/consensus/', import.meta.url);

const providers = {
  claude: {
    manifestPath: 'plugins/consensus/.claude-plugin/plugin.json',
  },
  cursor: {
    manifestPath: 'plugins/consensus/.cursor-plugin/plugin.json',
  },
  codex: {
    manifestPath: 'plugins/consensus/.codex-plugin/plugin.json',
    skills: './skills/',
  },
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

test('provider plugin manifests declare consensus metadata and skill directory', async () => {
  for (const [provider, config] of Object.entries(providers)) {
    const manifest = await readJson(config.manifestPath);

    assert.equal(manifest.name, 'consensus', `${provider} name`);
    assert.equal(manifest.version, '0.1.0', `${provider} version`);
    assert.deepEqual(
      manifest.author,
      { name: 'Thomas Stang' },
      `${provider} author`,
    );

    if (provider === 'codex') {
      assert.equal(
        manifest.skills,
        config.skills,
        `${provider} skill discovery path`,
      );
    } else {
      assert.equal(
        'skills' in manifest,
        false,
        `${provider} should rely on skills/ directory discovery`,
      );
    }

    const relativeSkillPath = './skills/refine';
    assert.equal(relativeSkillPath, './skills/refine');
    assert.equal(
      relativeSkillPath.includes('..'),
      false,
      `${provider} skill path should not traverse upward`,
    );

    const resolvedSkillPath = path.resolve(
      pluginRoot.pathname,
      relativeSkillPath,
    );
    assert.ok(
      resolvedSkillPath.startsWith(path.resolve(pluginRoot.pathname)),
      `${provider} skill path should stay inside plugin root`,
    );
    assert.equal((await stat(resolvedSkillPath)).isDirectory(), true);

    assert.match(
      manifest.metadata?.release_checklist?.join('\n') ?? '',
      /verify .*runtime/i,
      `${provider} should carry release-time permission verification notes`,
    );
  }
});

test('codex manifest includes runtime interface metadata', async () => {
  const manifest = await readJson(providers.codex.manifestPath);

  assert.equal(manifest.interface?.displayName, 'Consensus');
  assert.equal(manifest.interface?.developerName, 'Thomas Stang');
  assert.equal(manifest.interface?.category, 'Coding');
  assert.deepEqual(manifest.interface?.capabilities, [
    'Interactive',
    'Read',
    'Write',
  ]);
});
