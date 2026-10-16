import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';

const exec = promisify(execFile);
export const DEFAULT_REPOSITORY = 'https://github.com/tkstang/skills.git';
const MARKER = '.standalone-install-incomplete';
const HOSTS = new Map([
  ['codex', '.agents'],
  ['amp', '.agents'],
  ['claude-code', '.claude'],
  ['cursor', '.cursor'],
]);
// A programmatic seam for deterministic filesystem-failure tests, never CLI flags.
export const fileOperations = { open };
const HELP = `Usage: bash install.sh --skill <name> --agent <codex|claude-code|cursor|amp>
  --scope <project|user> --ref <exact-tag> [--repository <git-url-or-local-path>]
  [--update]

All four primary flags are required. Installs only generated skills/<name>/.
Existing destinations are refused unless --update is given. --update replaces
an existing copy of the same skill and keeps the old copy under
<host>/.standalone-backups/. Requires Node.js 22 and Git.
Default repository: ${DEFAULT_REPOSITORY}
With no arguments, install.sh runs the Consensus recovery installer.
`;

function hasControlCharacters(value) {
  return [...value].some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
}

function validateOptions(options) {
  for (const key of ['skill', 'agent', 'scope', 'ref']) {
    if (typeof options[key] !== 'string' || !options[key])
      throw new Error(`--${key} is required`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.skill))
    throw new Error('--skill must be a lowercase hyphenated name');
  if (!HOSTS.has(options.agent))
    throw new Error('--agent must be codex, claude-code, cursor, or amp');
  if (!['project', 'user'].includes(options.scope))
    throw new Error('--scope must be project or user');
  if (
    options.ref === 'HEAD' ||
    options.ref.startsWith('-') ||
    options.ref.startsWith('refs/') ||
    hasControlCharacters(options.ref) ||
    /\s/.test(options.ref)
  )
    throw new Error('--ref must be an exact tag name');
  const repository = options.repository ?? DEFAULT_REPOSITORY;
  if (
    typeof repository !== 'string' ||
    !repository ||
    repository.startsWith('-') ||
    repository.includes('::') ||
    hasControlCharacters(repository)
  )
    throw new Error('--repository must be a safe Git URL or local path');
  return { ...options, repository };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (flag === '--update') {
      if (options.update) throw new Error('Provide --update at most once');
      options.update = true;
      index--;
      continue;
    }
    if (
      !['--skill', '--agent', '--scope', '--ref', '--repository'].includes(flag)
    )
      throw new Error(`Unknown argument: ${flag}`);
    const key = flag.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--') || Object.hasOwn(options, key))
      throw new Error(`Provide exactly one value for ${flag}`);
    options[key] = value;
  }
  return validateOptions(options);
}

function gitEnvironment(env) {
  return {
    ...Object.fromEntries(
      Object.entries(env).filter(([key]) => !key.startsWith('GIT_')),
    ),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '/usr/bin/false',
    SSH_ASKPASS: '/usr/bin/false',
    GIT_SSH_COMMAND: 'ssh -oBatchMode=yes',
  };
}

async function git(args, env) {
  const { stdout } = await exec('git', args, {
    env: gitEnvironment(env),
    encoding: 'buffer',
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

function safeRelativePath(name) {
  return (
    name &&
    !name.includes('\\') &&
    !hasControlCharacters(name) &&
    name
      .split('/')
      .every(
        (part) =>
          part &&
          part !== '.' &&
          part !== '..' &&
          part.toLowerCase() !== '.git' &&
          part.toLowerCase() !== MARKER,
      )
  );
}

function fingerprint(name, contents, executable) {
  return {
    path: name,
    sha256: createHash('sha256').update(contents).digest('hex'),
    executable,
  };
}

async function readPayload(options, env) {
  await git(['check-ref-format', `refs/tags/${options.ref}`], env);
  const temporary = await mkdtemp(path.join(tmpdir(), 'standalone-source-'));
  const gitDir = path.join(temporary, 'source.git');
  const inRepo = (args) => git(['--git-dir', gitDir, ...args], env);
  try {
    await git(['init', '--bare', '--template=', gitDir], env);
    await inRepo([
      'fetch',
      '--no-tags',
      '--depth=1',
      '--',
      options.repository,
      `refs/tags/${options.ref}`,
    ]);
    const commit = (
      await inRepo(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'])
    )
      .toString('utf8')
      .trim();
    const prefix = `skills/${options.skill}/`;
    const tree = await inRepo([
      'ls-tree',
      '-rz',
      '--full-tree',
      commit,
      '--',
      prefix,
    ]);
    const files = [];
    const names = new Set();
    for (const record of tree.toString('utf8').split('\0').filter(Boolean)) {
      const match = /^(100644|100755) blob ([0-9a-f]+)\t(.+)$/.exec(record);
      if (!match || !match[3].startsWith(prefix))
        throw new Error('Unsupported Git entry in generated payload');
      const name = match[3].slice(prefix.length);
      if (!safeRelativePath(name) || names.has(name.toLowerCase()))
        throw new Error(`Unsafe or reserved Git path: ${name}`);
      names.add(name.toLowerCase());
      const contents = await inRepo(['cat-file', 'blob', match[2]]);
      files.push({
        ...fingerprint(name, contents, match[1] === '100755'),
        contents,
      });
    }
    if (!files.some((file) => file.path === 'SKILL.md'))
      throw new Error(
        `Missing generated skills/${options.skill}/SKILL.md at tag ${options.ref}`,
      );
    return files.toSorted((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    );
  } finally {
    // Only the private directory created above is eligible for automatic cleanup.
    await rm(temporary, { recursive: true, force: true });
  }
}

async function ensureDirectory(directory) {
  try {
    await mkdir(directory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory())
    throw new Error(`Refusing symlink or non-directory ancestor: ${directory}`);
}

async function writeExclusive(target, contents, executable = false) {
  const handle = await fileOperations.open(target, 'wx', 0o600);
  try {
    await handle.writeFile(contents);
    await handle.chmod(executable ? 0o755 : 0o644);
  } finally {
    await handle.close();
  }
}

async function inventory(directory) {
  const files = [];
  async function visit(current, prefix = '') {
    for (const name of (await readdir(current)).toSorted()) {
      const relative = prefix ? `${prefix}/${name}` : name;
      const target = path.join(current, name);
      const info = await lstat(target);
      if (info.isSymbolicLink())
        throw new Error(`Unexpected installed symlink: ${target}`);
      if (relative === MARKER && info.isFile()) continue;
      if (info.isDirectory()) await visit(target, relative);
      else if (info.isFile())
        files.push(
          fingerprint(
            relative,
            await readFile(target),
            (info.mode & 0o111) !== 0,
          ),
        );
      else throw new Error(`Unexpected installed entry: ${target}`);
    }
  }
  await visit(directory);
  return files.toSorted((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

function expectedInventory(files) {
  return files.map(({ contents: _contents, ...entry }) => entry);
}

// Reserves `destination` exclusively and leaves the marker behind on failure.
async function writePayload(destination, files) {
  try {
    await mkdir(destination);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        `Destination already exists; refusing to replace ${destination} (use --update to replace an older copy of the same skill)`,
        { cause: error },
      );
    throw error;
  }
  try {
    await writeExclusive(
      path.join(destination, MARKER),
      'Installation incomplete. Inspect this directory before any manual recovery.\n',
    );
    const directories = new Set();
    for (const file of files) {
      const parts = file.path.split('/');
      for (let index = 1; index < parts.length; index++) {
        const directory = path.join(destination, ...parts.slice(0, index));
        if (!directories.has(directory)) {
          await mkdir(directory);
          directories.add(directory);
        }
      }
      await writeExclusive(
        path.join(destination, file.path),
        file.contents,
        file.executable,
      );
    }
    if (
      !isDeepStrictEqual(expectedInventory(files), await inventory(destination))
    )
      throw new Error(
        'Installed payload inventory does not match the selected tag',
      );
    await unlink(path.join(destination, MARKER));
  } catch (error) {
    throw new Error(
      `Incomplete installation retained at ${destination}; inspect it before manual recovery. ${error.message}`,
      { cause: error },
    );
  }
}

async function installedSkillName(directory) {
  const text = await readFile(path.join(directory, 'SKILL.md'), 'utf8').catch(
    () => '',
  );
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  const names = [
    ...frontmatter.matchAll(/^name:[ \t]*['"]?([^'"\r\n]+?)['"]?[ \t]*$/gm),
  ];
  // A repeated name is ambiguous, so it never matches the requested skill.
  return names.length === 1 ? names[0][1] : undefined;
}

// Returns the backup path, or undefined when the copy already matches the tag.
async function replaceExisting(skill, destination, existing, files) {
  if (existing.isSymbolicLink() || !existing.isDirectory())
    throw new Error(
      `Refusing to update a symlink or non-directory destination: ${destination}`,
    );
  const name = await installedSkillName(destination);
  if (name !== skill)
    throw new Error(
      `Refusing to update ${destination}: its SKILL.md names ${name ? `"${name}"` : 'no single skill'}, not "${skill}"`,
    );
  const partial = await lstat(path.join(destination, MARKER)).then(
    () => true,
    () => false,
  );
  const current = await inventory(destination).catch(() => undefined);
  if (!partial && isDeepStrictEqual(current, expectedInventory(files)))
    return undefined;

  // Stage and back up beside skills/ so neither copy is discovered as a skill.
  const host = path.dirname(path.dirname(destination));
  const staging = await mkdtemp(
    path.join(host, `.standalone-staging-${skill}-`),
  );
  const staged = path.join(staging, skill);
  await writePayload(staged, files);
  const backups = path.join(host, '.standalone-backups');
  await ensureDirectory(backups);
  const backup = path.join(
    backups,
    `${skill}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  await rename(destination, backup);
  try {
    await rename(staged, destination);
  } catch (error) {
    await rename(backup, destination).catch(() => {});
    throw new Error(
      `Update failed; the verified new copy is at ${staged} and the previous copy is at ${destination} or ${backup}. ${error.message}`,
      { cause: error },
    );
  }
  await rm(staging, { recursive: true, force: true });
  return backup;
}

export async function installStandalone(
  input,
  { cwd = process.cwd(), env = process.env } = {},
) {
  const options = validateOptions(input);
  if (options.scope === 'user' && (!env.HOME || !path.isAbsolute(env.HOME)))
    throw new Error('User scope requires an absolute HOME');
  const root = await realpath(options.scope === 'project' ? cwd : env.HOME);
  const files = await readPayload(options, env);
  let parent = root;
  for (const segment of [HOSTS.get(options.agent), 'skills']) {
    parent = path.join(parent, segment);
    await ensureDirectory(parent);
  }
  const destination = path.join(parent, options.skill);
  const existing = await lstat(destination).catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  let outcome = `Verified payload from tag ${options.ref} (${options.scope} scope) at ${destination}`;
  if (!existing || !options.update) {
    await writePayload(destination, files);
  } else {
    const backup = await replaceExisting(
      options.skill,
      destination,
      existing,
      files,
    );
    outcome = backup
      ? `${outcome}\nPrevious copy kept at ${backup}`
      : `Already current: ${destination} matches tag ${options.ref} (${options.scope} scope); nothing changed`;
  }
  const invocation =
    options.agent === 'codex'
      ? `$${options.skill}`
      : options.agent === 'claude-code'
        ? `/${options.skill}`
        : options.agent === 'amp'
          ? `Ask Amp to use the ${options.skill} skill (check amp skills list in the selected project, then start a fresh thread or ask Amp to reload skills)`
          : `${options.skill} (check Cursor's skill inventory in a fresh session)`;
  return `${outcome}\nInvocation: ${invocation}\nFresh-session discovery and live behavior have not been verified.\n`;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 22)
      throw new Error('Node.js 22 or newer is required');
    const argv = process.argv.slice(2);
    process.stdout.write(
      argv.length === 1 && argv[0] === '--help'
        ? HELP
        : await installStandalone(parseArguments(argv)),
    );
  } catch (error) {
    console.error(`install.sh: ${error.message}`);
    process.exitCode = 1;
  }
}
