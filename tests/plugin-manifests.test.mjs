import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url);
const pluginRoot = new URL('../plugins/consensus/', import.meta.url);

const providers = {
  claude: {
    manifestPath: 'plugins/consensus/.claude-plugin/plugin.json',
    permissionPath: ['permissions', 'bash', 'allow']
  },
  cursor: {
    manifestPath: 'plugins/consensus/.cursor-plugin/plugin.json',
    permissionPath: ['permissions', 'exec', 'allow']
  },
  codex: {
    manifestPath: 'plugins/consensus/.codex-plugin/plugin.json',
    permissionPath: ['permissions', 'exec', 'allow']
  }
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

function getPath(value, parts) {
  return parts.reduce((current, part) => current?.[part], value);
}

function skillPath(manifest) {
  const skill = manifest.skills?.find((entry) => entry.name === 'consensus-refine');
  assert.ok(skill, 'manifest should declare consensus-refine');
  return skill.path;
}

test('provider plugin manifests declare consensus metadata and skill path', async () => {
  for (const [provider, config] of Object.entries(providers)) {
    const manifest = await readJson(config.manifestPath);

    assert.equal(manifest.name, 'consensus', `${provider} name`);
    assert.equal(manifest.version, '0.1.0', `${provider} version`);

    const relativeSkillPath = skillPath(manifest);
    assert.equal(relativeSkillPath, './skills/consensus-refine');
    assert.equal(relativeSkillPath.includes('..'), false, `${provider} skill path should not traverse upward`);

    const resolvedSkillPath = path.resolve(pluginRoot.pathname, relativeSkillPath);
    assert.ok(
      resolvedSkillPath.startsWith(path.resolve(pluginRoot.pathname)),
      `${provider} skill path should stay inside plugin root`
    );
    assert.equal((await stat(resolvedSkillPath)).isDirectory(), true);

    const allowedCommands = getPath(manifest, config.permissionPath);
    assert.deepEqual(allowedCommands, ['node', 'paseo'], `${provider} command permissions`);

    assert.match(
      manifest.metadata?.release_checklist?.join('\n') ?? '',
      /verify .*runtime/i,
      `${provider} should carry release-time permission verification notes`
    );
  }
});

test('codex manifest includes interface metadata placeholder', async () => {
  const manifest = await readJson(providers.codex.manifestPath);

  assert.equal(manifest.interface?.kind, 'skill-plugin');
  assert.equal(manifest.interface?.status, 'placeholder');
});
