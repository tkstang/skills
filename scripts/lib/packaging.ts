import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { build, type Metafile, type Plugin } from 'esbuild';

export interface WorkflowReference {
  name: string;
  installUrl: string;
}

export interface DistributionTarget {
  kind: 'standalone' | 'plugin';
  name: string;
  output: string;
  plugin?: string;
}

export interface DistributionDeclaration {
  owner: string;
  source: string;
  targets: readonly DistributionTarget[];
  allowedSourceRoots?: readonly string[];
  requiredSkills?: readonly WorkflowReference[];
  optionalSkills?: readonly WorkflowReference[];
}

export interface PackageInventoryEntry {
  path: string;
  mode: number;
  hash: string;
}

export interface BuiltDistribution {
  declaration: DistributionDeclaration;
  target: DistributionTarget;
  stagedPath: string;
  inventory: readonly PackageInventoryEntry[];
  inputFingerprint: string;
  stagingRoot: string;
}

export interface PackagingOperations {
  rename: typeof rename;
  remove: typeof rm;
}

const defaultOperations: PackagingOperations = {
  rename,
  remove: rm,
};

const copiedRoots = new Set([
  'SKILL.md',
  'agents',
  'assets',
  'references',
  'schemas',
]);
const forbiddenPayloadParts = new Set([
  'build.json',
  'node_modules',
  'src',
  'test',
  'tests',
]);
const sourceExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

function fail(message: string): never {
  throw new Error(`skill packaging: ${message}`);
}

function posixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function assertRelativePath(value: string, label: string): string {
  if (!value || path.isAbsolute(value))
    fail(`${label} must be relative: ${value}`);
  const normalized = path.posix.normalize(posixPath(value));
  if (normalized === '..' || normalized.startsWith('../')) {
    fail(`${label} escapes its root: ${value}`);
  }
  if (normalized === '.' || normalized.includes('\0')) {
    fail(`${label} is invalid: ${value}`);
  }
  return normalized;
}

function assertTarget(target: DistributionTarget): void {
  assertRelativePath(target.output, `output for ${target.name}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.name)) {
    fail(`installed name is invalid: ${target.name}`);
  }
  if (target.kind === 'plugin') {
    if (!target.plugin) fail(`plugin target ${target.name} is missing plugin`);
    const expected = `plugins/${target.plugin}/skills/${target.name}`;
    if (target.output !== expected) {
      fail(
        `plugin target ${target.name} must own ${expected}, got ${target.output}`,
      );
    }
  } else if (target.plugin) {
    fail(`standalone target ${target.name} cannot declare plugin`);
  }
}

export function validateDistributionDeclarations(
  declarations: readonly DistributionDeclaration[],
): void {
  const owners = new Set<string>();
  const outputs: string[] = [];
  for (const declaration of declarations) {
    if (owners.has(declaration.owner))
      fail(`duplicate owner: ${declaration.owner}`);
    owners.add(declaration.owner);
    assertRelativePath(declaration.source, `source for ${declaration.owner}`);
    if (declaration.targets.length === 0) {
      fail(`owner ${declaration.owner} has no installation targets`);
    }
    for (const target of declaration.targets) {
      assertTarget(target);
      if (
        outputs.some(
          (output) =>
            output === target.output ||
            output.startsWith(`${target.output}/`) ||
            target.output.startsWith(`${output}/`),
        )
      ) {
        fail(`output collision: ${target.output}`);
      }
      outputs.push(target.output);
    }
    const required = new Set(
      (declaration.requiredSkills ?? []).map((reference) => reference.name),
    );
    for (const reference of [
      ...(declaration.requiredSkills ?? []),
      ...(declaration.optionalSkills ?? []),
    ]) {
      if (
        !reference.installUrl ||
        !reference.installUrl.startsWith('https://')
      ) {
        fail(
          `${declaration.owner} has invalid install URL for ${reference.name}`,
        );
      }
    }
    for (const reference of declaration.optionalSkills ?? []) {
      if (required.has(reference.name)) {
        fail(
          `${declaration.owner} declares ${reference.name} as required and optional`,
        );
      }
    }
  }

  const byOwner = new Map(
    declarations.map((declaration) => [declaration.owner, declaration]),
  );
  for (const declaration of declarations) {
    for (const reference of [
      ...(declaration.requiredSkills ?? []),
      ...(declaration.optionalSkills ?? []),
    ]) {
      if (!byOwner.has(reference.name)) {
        fail(
          `${declaration.owner} references undeclared skill: ${reference.name}`,
        );
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (owner: string): void => {
    if (visiting.has(owner)) fail(`required skill cycle includes ${owner}`);
    if (visited.has(owner)) return;
    visiting.add(owner);
    for (const reference of byOwner.get(owner)?.requiredSkills ?? [])
      visit(reference.name);
    visiting.delete(owner);
    visited.add(owner);
  };
  for (const owner of owners) visit(owner);
}

async function walkRegularFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = posixPath(path.relative(root, absolute));
      if (entry.isSymbolicLink()) fail(`symlinks are unsupported: ${relative}`);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) output.push(relative);
      else fail(`unsupported filesystem entry: ${relative}`);
    }
  }
  await walk(root);
  return output.toSorted();
}

async function hashFile(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

async function fingerprintPaths(
  root: string,
  paths: readonly string[],
): Promise<string> {
  const hash = createHash('sha256');
  for (const relative of paths.toSorted()) {
    const absolute = path.join(root, relative);
    const info = await stat(absolute);
    hash.update(relative);
    hash.update(String(info.mode & 0o777));
    hash.update(await readFile(absolute));
  }
  return hash.digest('hex');
}

async function readBuildEntrypoints(sourceRoot: string): Promise<string[]> {
  const buildPath = path.join(sourceRoot, 'build.json');
  let source: string;
  try {
    source = await readFile(buildPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    fail(`${posixPath(buildPath)} is not valid JSON`);
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Object.keys(parsed).join(',') !== 'runtime' ||
    !Array.isArray((parsed as { runtime?: unknown }).runtime)
  ) {
    fail('build.json must contain only a runtime string array');
  }
  const runtime = (parsed as { runtime: unknown[] }).runtime;
  if (runtime.length === 0) fail('build.json runtime cannot be empty');
  const basenames = new Set<string>();
  return runtime.map((value) => {
    if (typeof value !== 'string')
      fail('build.json runtime entries must be strings');
    const relative = assertRelativePath(value, 'runtime entrypoint');
    if (!relative.startsWith('src/') || !relative.endsWith('.ts')) {
      fail(`runtime entrypoint must be TypeScript under src/: ${relative}`);
    }
    if (/\.(?:test|spec)\.ts$/.test(relative) || relative.endsWith('.d.ts')) {
      fail(`runtime entrypoint cannot be a test or declaration: ${relative}`);
    }
    const basename = path.posix.basename(relative, '.ts');
    if (basenames.has(basename))
      fail(`duplicate runtime output basename: ${basename}`);
    basenames.add(basename);
    return relative;
  });
}

function renderInstruction(
  source: string,
  declaration: DistributionDeclaration,
  target: DistributionTarget,
  declarations: readonly DistributionDeclaration[],
): string {
  const lines = source.split('\n');
  let fences = 0;
  let replaced = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      fences += 1;
      continue;
    }
    if (fences === 1 && /^name:\s*/.test(lines[index])) {
      lines[index] = `name: ${target.name}`;
      replaced = true;
    }
    if (fences >= 2) break;
  }
  if (!replaced) fail(`${declaration.owner}/SKILL.md has no frontmatter name`);
  const references = new Map<string, string>([
    [declaration.owner, target.name],
  ]);
  const byOwner = new Map(
    declarations.map((candidate) => [candidate.owner, candidate]),
  );
  for (const reference of [
    ...(declaration.requiredSkills ?? []),
    ...(declaration.optionalSkills ?? []),
  ]) {
    const referenced = byOwner.get(reference.name);
    const samePlugin =
      target.kind === 'plugin'
        ? referenced?.targets.find(
            (candidate) =>
              candidate.kind === 'plugin' && candidate.plugin === target.plugin,
          )
        : undefined;
    const standalone = referenced?.targets.find(
      (candidate) => candidate.kind === 'standalone',
    );
    const resolved = samePlugin ?? standalone;
    if (!resolved) {
      fail(
        `${declaration.owner} cannot resolve ${reference.name} for ${target.output}`,
      );
    }
    references.set(reference.name, resolved.name);
  }
  let rendered = lines
    .join('\n')
    .replaceAll('{{distribution.name}}', target.name);
  rendered = rendered.replace(
    /\{\{skill:([^}]+)\}\}/g,
    (_slot, name: string) => {
      const resolved = references.get(name);
      if (!resolved)
        fail(`${declaration.owner} contains unresolved skill slot: ${name}`);
      return resolved;
    },
  );
  const unresolved = rendered.match(/\{\{(?:distribution|skill):?[^}]*\}\}/);
  if (unresolved)
    fail(`${declaration.owner} contains unresolved slot: ${unresolved[0]}`);
  return rendered;
}

function dependencyGuard(): Plugin {
  return {
    name: 'installed-boundary',
    setup(context) {
      context.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, (args) => {
        if (args.path.startsWith('node:'))
          return { path: args.path, external: true };
        return {
          errors: [
            { text: `runtime package dependency is forbidden: ${args.path}` },
          ],
        };
      });
    },
  };
}

async function copyPayloadFiles(
  sourceRoot: string,
  stageRoot: string,
  declaration: DistributionDeclaration,
  target: DistributionTarget,
  declarations: readonly DistributionDeclaration[],
): Promise<string[]> {
  const inputPaths: string[] = [];
  for (const relative of await walkRegularFiles(sourceRoot)) {
    const [first] = relative.split('/');
    if (first === 'scripts') {
      fail(`authored scripts collide with generated runtime: ${relative}`);
    }
    if (first !== 'src' && sourceExtensions.has(path.extname(relative))) {
      fail(`undeclared executable resource is forbidden: ${relative}`);
    }
    if (!copiedRoots.has(first)) continue;
    if (relative.split('/').some((part) => forbiddenPayloadParts.has(part))) {
      fail(`source/test/build content cannot enter payload: ${relative}`);
    }
    const sourcePath = path.join(sourceRoot, relative);
    const targetPath = path.join(stageRoot, relative);
    await mkdir(path.dirname(targetPath), { recursive: true });
    if (relative === 'SKILL.md') {
      await writeFile(
        targetPath,
        renderInstruction(
          await readFile(sourcePath, 'utf8'),
          declaration,
          target,
          declarations,
        ),
      );
      await chmod(targetPath, (await stat(sourcePath)).mode & 0o777);
    } else {
      await cp(sourcePath, targetPath, { preserveTimestamps: false });
      await chmod(targetPath, (await stat(sourcePath)).mode & 0o777);
    }
    inputPaths.push(relative);
  }
  if (!inputPaths.includes('SKILL.md'))
    fail(`${declaration.owner} is missing SKILL.md`);
  return inputPaths;
}

async function bundleEntrypoints(
  repoRoot: string,
  sourceRoot: string,
  stageRoot: string,
  declaration: DistributionDeclaration,
  entrypoints: readonly string[],
): Promise<{ inputs: string[]; metafiles: Metafile[] }> {
  const inputs = new Set<string>();
  const metafiles: Metafile[] = [];
  const allowedRoots = [
    sourceRoot,
    ...(declaration.allowedSourceRoots ?? []).map((root) =>
      path.resolve(repoRoot, assertRelativePath(root, 'allowed source root')),
    ),
  ];
  await mkdir(path.join(stageRoot, 'scripts'), { recursive: true });
  for (const relative of entrypoints) {
    const entrypoint = path.join(sourceRoot, relative);
    const output = path.join(
      stageRoot,
      'scripts',
      `${path.posix.basename(relative, '.ts')}.mjs`,
    );
    try {
      await lstat(entrypoint);
    } catch {
      fail(`missing runtime entrypoint: ${relative}`);
    }
    const result = await build({
      absWorkingDir: repoRoot,
      entryPoints: [entrypoint],
      outfile: output,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      write: true,
      metafile: true,
      legalComments: 'none',
      logLevel: 'silent',
      plugins: [dependencyGuard()],
      banner: { js: `// GENERATED skill payload for ${declaration.owner}.` },
    });
    await chmod(output, 0o755);
    metafiles.push(result.metafile);
    for (const input of Object.keys(result.metafile.inputs)) {
      const absolute = path.resolve(repoRoot, input);
      if (
        !allowedRoots.some(
          (root) =>
            absolute === root || absolute.startsWith(`${root}${path.sep}`),
        )
      ) {
        fail(`bundler input escapes allowed source owners: ${input}`);
      }
      inputs.add(posixPath(path.relative(sourceRoot, absolute)));
    }
  }
  const authoredRuntime = (
    await walkRegularFiles(path.join(sourceRoot, 'src'))
  ).filter(
    (relative) =>
      relative.endsWith('.ts') &&
      !/\.(?:test|spec)\.ts$/.test(relative) &&
      !relative.endsWith('.d.ts'),
  );
  for (const relative of authoredRuntime) {
    if (!inputs.has(posixPath(path.join('src', relative)))) {
      fail(
        `undeclared executable source is outside runtime closure: src/${relative}`,
      );
    }
  }
  return { inputs: [...inputs], metafiles };
}

async function validateLinks(stageRoot: string): Promise<void> {
  const files = await walkRegularFiles(stageRoot);
  const inventory = new Set(files);
  for (const relative of files.filter((entry) => entry.endsWith('.md'))) {
    const source = await readFile(path.join(stageRoot, relative), 'utf8');
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const destination = match[1].split('#')[0];
      if (!destination || /^(?:[a-z]+:|#)/i.test(destination)) continue;
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(relative), destination),
      );
      if (resolved === '..' || resolved.startsWith('../')) {
        fail(`resource link escapes payload: ${relative} -> ${destination}`);
      }
      if (!inventory.has(resolved))
        fail(`resource link is missing: ${relative} -> ${destination}`);
    }
  }
}

export async function inventoryTree(
  root: string,
): Promise<PackageInventoryEntry[]> {
  const entries: PackageInventoryEntry[] = [];
  for (const relative of await walkRegularFiles(root)) {
    const absolute = path.join(root, relative);
    const info = await stat(absolute);
    entries.push({
      path: relative,
      mode: info.mode & 0o777,
      hash: await hashFile(absolute),
    });
  }
  return entries;
}

export async function buildDeclaredDistributions(options: {
  repoRoot: string;
  declarations: readonly DistributionDeclaration[];
  stagingRoot?: string;
}): Promise<BuiltDistribution[]> {
  validateDistributionDeclarations(options.declarations);
  if (options.declarations.length === 0) return [];
  const stagingRoot =
    options.stagingRoot ??
    (await mkdtemp(
      path.join(
        path.dirname(options.repoRoot),
        `.${path.basename(options.repoRoot)}-skill-packaging-`,
      ),
    ));
  const built: BuiltDistribution[] = [];
  try {
    for (const declaration of options.declarations) {
      const sourceRelative = assertRelativePath(
        declaration.source,
        `source for ${declaration.owner}`,
      );
      const sourceRoot = path.resolve(options.repoRoot, sourceRelative);
      if (!(await stat(sourceRoot)).isDirectory())
        fail(`source is not a directory: ${sourceRelative}`);
      const sourceFiles = await walkRegularFiles(sourceRoot);
      const initialFingerprint = await fingerprintPaths(
        sourceRoot,
        sourceFiles,
      );
      const entrypoints = await readBuildEntrypoints(sourceRoot);
      for (const target of declaration.targets) {
        const stagedPath = path.join(
          stagingRoot,
          `${declaration.owner}-${target.name}-${randomUUID()}`,
        );
        await mkdir(stagedPath, { recursive: true });
        await copyPayloadFiles(
          sourceRoot,
          stagedPath,
          declaration,
          target,
          options.declarations,
        );
        if (entrypoints.length > 0) {
          await bundleEntrypoints(
            options.repoRoot,
            sourceRoot,
            stagedPath,
            declaration,
            entrypoints,
          );
        }
        await validateLinks(stagedPath);
        built.push({
          declaration,
          target,
          stagedPath,
          inventory: await inventoryTree(stagedPath),
          inputFingerprint: initialFingerprint,
          stagingRoot,
        });
      }
      const finalFiles = await walkRegularFiles(sourceRoot);
      const finalFingerprint = await fingerprintPaths(sourceRoot, finalFiles);
      if (finalFingerprint !== initialFingerprint) {
        fail(`inputs changed during build for ${declaration.owner}`);
      }
    }
    return built;
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

export function compareInventories(
  actual: readonly PackageInventoryEntry[],
  expected: readonly PackageInventoryEntry[],
): string[] {
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry]));
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
  const failures: string[] = [];
  for (const [relative, entry] of expectedByPath) {
    const found = actualByPath.get(relative);
    if (!found) failures.push(`${relative}: missing`);
    else if (found.hash !== entry.hash) failures.push(`${relative}: stale`);
    else if (found.mode !== entry.mode)
      failures.push(
        `${relative}: mode ${found.mode.toString(8)} != ${entry.mode.toString(8)}`,
      );
  }
  for (const relative of actualByPath.keys()) {
    if (!expectedByPath.has(relative)) failures.push(`${relative}: orphan`);
  }
  return failures.toSorted();
}

export async function checkDeclaredDistributions(options: {
  repoRoot: string;
  built: readonly BuiltDistribution[];
}): Promise<string[]> {
  const failures: string[] = [];
  for (const unit of options.built) {
    const output = path.resolve(options.repoRoot, unit.target.output);
    try {
      failures.push(
        ...compareInventories(await inventoryTree(output), unit.inventory).map(
          (failure) => `${unit.target.output}/${failure}`,
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        failures.push(`${unit.target.output}: missing output`);
      } else {
        throw error;
      }
    }
  }
  return failures;
}

export async function replaceDeclaredDistribution(
  repoRoot: string,
  unit: BuiltDistribution,
  operations: PackagingOperations = defaultOperations,
): Promise<void> {
  const output = path.resolve(repoRoot, unit.target.output);
  const parent = path.dirname(output);
  const backup = path.join(
    parent,
    `.${path.basename(output)}.recovery-${randomUUID()}`,
  );
  await mkdir(parent, { recursive: true });
  let movedPrior = false;
  try {
    await operations.rename(output, backup);
    movedPrior = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await operations.rename(unit.stagedPath, output);
  } catch (replacementError) {
    if (movedPrior) {
      try {
        await operations.rename(backup, output);
      } catch (rollbackError) {
        fail(
          `replacement failed for ${unit.target.output}; rollback failed; recovery copy retained at ${backup}; replacement=${String(replacementError)}; rollback=${String(rollbackError)}`,
        );
      }
    }
    fail(
      `replacement failed for ${unit.target.output}; prior output restored: ${String(replacementError)}`,
    );
  }
  if (movedPrior)
    await operations.remove(backup, { recursive: true, force: true });
}

export async function writeDeclaredDistributions(options: {
  repoRoot: string;
  built: readonly BuiltDistribution[];
  operations?: PackagingOperations;
}): Promise<void> {
  for (const unit of options.built) {
    await replaceDeclaredDistribution(
      options.repoRoot,
      unit,
      options.operations,
    );
  }
}

export async function cleanupBuiltDistributions(
  built: readonly BuiltDistribution[],
): Promise<void> {
  for (const stagingRoot of new Set(built.map((unit) => unit.stagingRoot))) {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}
