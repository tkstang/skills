import { createHash } from 'node:crypto';
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

const BUNDLE_OWNER = 'session-observer-collab-codex-stop';
const MANIFEST = '.session-observer-collab-bundle.json';
const FILES = [
  'session-observer-collab/scripts/hooks/codex-stop.mjs',
  'session-observer-collab/scripts/lib/completion-selection.mjs',
  'session-observer-collab/scripts/lib/lease-state.mjs',
  'session-observer-collab/scripts/lib/runtime-adapter.mjs',
  'session-observer/scripts/lib/digest.mjs',
  'session-observer/scripts/lib/session-classifier.mjs',
  'session-observer/scripts/lib/runtimes.mjs',
];

function bundlePaths(scriptPath) {
  const parent = dirname(scriptPath);
  return {
    parent,
    supportRoot: join(parent, `.${basename(scriptPath)}.support`),
  };
}

async function sourceFiles(sourceScriptPath) {
  const collabScripts = dirname(dirname(sourceScriptPath));
  const skillsRoot = dirname(dirname(collabScripts));
  const files = [];
  const hash = createHash('sha256');
  for (const relativePath of FILES) {
    const source = join(skillsRoot, relativePath);
    const content = await readFile(source);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
    files.push({ relativePath, source });
  }
  return { files, version: hash.digest('hex').slice(0, 24) };
}

async function ownerOnlyDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
}

async function copyBundle(stage, files, version) {
  await ownerOnlyDirectory(stage);
  for (const file of files) {
    const destination = join(stage, file.relativePath);
    await ownerOnlyDirectory(dirname(destination));
    await copyFile(file.source, destination);
    await chmod(destination, 0o600);
  }
  const manifest = join(stage, MANIFEST);
  await writeFile(
    manifest,
    `${JSON.stringify({ owner: BUNDLE_OWNER, version, files: FILES }, null, 2)}\n`,
    { mode: 0o600 },
  );
  await chmod(manifest, 0o600);
}

async function ownedVersion(path, version) {
  try {
    const value = JSON.parse(await readFile(join(path, MANIFEST), 'utf8'));
    return value.owner === BUNDLE_OWNER && value.version === version;
  } catch {
    return false;
  }
}

async function ownedArtifact(path) {
  try {
    const value = JSON.parse(await readFile(join(path, MANIFEST), 'utf8'));
    return value.owner === BUNDLE_OWNER;
  } catch {
    return false;
  }
}

async function secureBundle(path) {
  await chmod(path, 0o700);
  for (const relativePath of FILES) {
    const file = join(path, relativePath);
    await chmod(file, 0o600);
    let parent = dirname(file);
    while (parent !== path) {
      await chmod(parent, 0o700);
      parent = dirname(parent);
    }
  }
  await chmod(join(path, MANIFEST), 0o600);
}

function launcherContent(scriptPath, supportRoot, version) {
  const entry = join(
    supportRoot,
    version,
    'session-observer-collab/scripts/hooks/codex-stop.mjs',
  );
  const specifier = relative(dirname(scriptPath), entry).replaceAll('\\', '/');
  return [
    '#!/usr/bin/env node',
    `// ${BUNDLE_OWNER}:${version}`,
    `import { runCodexStopMain } from ${JSON.stringify(`./${specifier}`)};`,
    'runCodexStopMain().catch(() => {});',
    '',
  ].join('\n');
}

async function readIfFile(path) {
  try {
    if (!(await stat(path)).isFile()) return null;
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function cleanOwnedVersions(supportRoot, keep) {
  let names;
  try {
    names = await readdir(supportRoot);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const name of names) {
    const path = join(supportRoot, name);
    if (name === keep) continue;
    if (
      (name.startsWith('.stage-') && (await ownedArtifact(path))) ||
      (await ownedVersion(path, name))
    )
      await rm(path, { recursive: true, force: true });
  }
  if ((await readdir(supportRoot)).length === 0)
    await rm(supportRoot, { recursive: true, force: true });
}

async function removeEmptySupportRoot(supportRoot) {
  try {
    if ((await readdir(supportRoot)).length === 0)
      await rm(supportRoot, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function prepareSupportRoot(supportRoot) {
  try {
    const names = await readdir(supportRoot);
    let owned = false;
    for (const name of names) {
      if (await ownedArtifact(join(supportRoot, name))) {
        owned = true;
        break;
      }
    }
    if (!owned)
      throw new Error(
        `refusing unowned Codex hook support directory: ${supportRoot}`,
      );
    await chmod(supportRoot, 0o700);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await ownerOnlyDirectory(supportRoot);
  }
}

export async function installCodexStopBundle({
  scriptPath: rawScriptPath,
  sourceScriptPath: rawSourceScriptPath,
}) {
  const scriptPath = resolve(rawScriptPath);
  const sourceScriptPath = resolve(rawSourceScriptPath);
  const { files, version } = await sourceFiles(sourceScriptPath);
  const { parent, supportRoot } = bundlePaths(scriptPath);
  const final = join(supportRoot, version);
  const stage = join(supportRoot, `.stage-${process.pid}-${version}`);
  const launcher = launcherContent(scriptPath, supportRoot, version);
  const temporary = `${scriptPath}.${process.pid}.${version}.tmp`;
  let createdVersion = false;
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await prepareSupportRoot(supportRoot);
  try {
    if (!(await ownedVersion(final, version))) {
      await rm(stage, { recursive: true, force: true });
      await copyBundle(stage, files, version);
      await rename(stage, final);
      createdVersion = true;
    }
    await secureBundle(final);
    const current = await readIfFile(scriptPath);
    if (current !== launcher) {
      await writeFile(temporary, launcher, { mode: 0o700 });
      await chmod(temporary, 0o700);
      await rename(temporary, scriptPath);
    }
    await chmod(scriptPath, 0o700);
    await cleanOwnedVersions(supportRoot, version);
    return {
      changed: current !== launcher,
      scriptPath,
      supportRoot,
      version,
    };
  } catch (error) {
    await rm(temporary, { force: true });
    await rm(stage, { recursive: true, force: true });
    if (createdVersion) await rm(final, { recursive: true, force: true });
    await removeEmptySupportRoot(supportRoot);
    throw error;
  }
}

export async function removeCodexStopBundle(scriptPath) {
  const absolute = resolve(scriptPath);
  const { supportRoot } = bundlePaths(absolute);
  const launcher = await readIfFile(absolute);
  const match = launcher?.match(
    new RegExp(`^// ${BUNDLE_OWNER}:([a-f0-9]{24})$`, 'm'),
  );
  if (!match || !(await ownedVersion(join(supportRoot, match[1]), match[1])))
    return { scriptRemoved: false, supportRemoved: false };
  await rm(absolute);
  await cleanOwnedVersions(supportRoot, null);
  let supportRemoved = false;
  try {
    await stat(supportRoot);
  } catch (error) {
    if (error?.code === 'ENOENT') supportRemoved = true;
    else throw error;
  }
  return { scriptRemoved: true, supportRemoved };
}
