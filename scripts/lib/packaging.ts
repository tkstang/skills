import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
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

function declaredOutput(target: DistributionTarget): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.name)) {
    fail(`installed name is invalid: ${target.name}`);
  }
  if (target.kind === 'plugin') {
    if (!target.plugin) fail(`plugin target ${target.name} is missing plugin`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.plugin)) {
      fail(`plugin identifier is invalid: ${target.plugin}`);
    }
    const expected = `plugins/${target.plugin}/skills/${target.name}`;
    if (target.output !== expected) {
      fail(
        `plugin target ${target.name} must own ${expected}, got ${target.output}`,
      );
    }
    return expected;
  }
  if (target.plugin)
    fail(`standalone target ${target.name} cannot declare plugin`);
  const expected = `skills/${target.name}`;
  if (target.output !== expected) {
    fail(
      `standalone target ${target.name} must own ${expected}, got ${target.output}`,
    );
  }
  return expected;
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
      const output = declaredOutput(target);
      if (
        outputs.some(
          (prior) =>
            prior === output ||
            prior.startsWith(`${output}/`) ||
            output.startsWith(`${prior}/`),
        )
      ) {
        fail(`output collision: ${output}`);
      }
      outputs.push(output);
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

function isContainedBy(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function resolveInputRoot(
  repoRoot: string,
  relative: string,
  label: string,
): Promise<string> {
  const candidate = path.resolve(repoRoot, assertRelativePath(relative, label));
  const info = await lstat(candidate);
  if (info.isSymbolicLink()) fail(`${label} cannot be a symlink: ${relative}`);
  if (!info.isDirectory()) fail(`${label} is not a directory: ${relative}`);
  const resolved = await realpath(candidate);
  if (!isContainedBy(repoRoot, resolved)) {
    fail(`${label} resolves outside repository: ${relative}`);
  }
  return resolved;
}

async function resolveAllowedRoots(
  repoRoot: string,
  declaration: DistributionDeclaration,
): Promise<string[]> {
  const roots = [
    await resolveInputRoot(
      repoRoot,
      declaration.source,
      `source for ${declaration.owner}`,
    ),
  ];
  for (const relative of declaration.allowedSourceRoots ?? []) {
    roots.push(
      await resolveInputRoot(repoRoot, relative, 'allowed source root'),
    );
  }
  return [...new Set(roots)];
}

async function fingerprintInputRoots(
  repoRoot: string,
  roots: readonly string[],
): Promise<string> {
  const fingerprint = createHash('sha256');
  for (const root of roots.toSorted()) {
    const info = await stat(root);
    if (!info.isDirectory())
      fail(`allowed source root is not a directory: ${root}`);
    const files = await walkRegularFiles(root);
    fingerprint.update(posixPath(path.relative(repoRoot, root)));
    fingerprint.update(await fingerprintPaths(root, files));
  }
  return fingerprint.digest('hex');
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
  allowedRoots: readonly string[],
): Promise<{ inputs: string[]; metafiles: Metafile[] }> {
  const inputs = new Set<string>();
  const metafiles: Metafile[] = [];
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
  const repoRoot = await realpath(options.repoRoot);
  const stagingParent = path.join(repoRoot, 'node_modules', '.cache');
  await mkdir(stagingParent, { recursive: true });
  const stagingRoot =
    options.stagingRoot ??
    (await mkdtemp(path.join(stagingParent, 'skill-packaging-')));
  const built: BuiltDistribution[] = [];
  try {
    for (const declaration of options.declarations) {
      const inputRoots = await resolveAllowedRoots(repoRoot, declaration);
      const [sourceRoot] = inputRoots;
      const initialFingerprint = await fingerprintInputRoots(
        repoRoot,
        inputRoots,
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
            repoRoot,
            sourceRoot,
            stagedPath,
            declaration,
            entrypoints,
            inputRoots,
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
      const finalFingerprint = await fingerprintInputRoots(
        repoRoot,
        inputRoots,
      );
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
    const outputRelative = declaredOutput(unit.target);
    const output = path.resolve(options.repoRoot, outputRelative);
    try {
      failures.push(
        ...compareInventories(await inventoryTree(output), unit.inventory).map(
          (failure) => `${outputRelative}/${failure}`,
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        failures.push(`${outputRelative}: missing output`);
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
  await writeDeclaredDistributions({ repoRoot, built: [unit], operations });
}

export async function writeDeclaredDistributions(options: {
  repoRoot: string;
  built: readonly BuiltDistribution[];
  operations?: PackagingOperations;
}): Promise<void> {
  const operations = options.operations ?? defaultOperations;
  const entries = options.built.map((unit) => {
    const outputRelative = declaredOutput(unit.target);
    const output = path.resolve(options.repoRoot, outputRelative);
    return {
      unit,
      outputRelative,
      output,
      backup: path.join(
        path.dirname(output),
        `.${path.basename(output)}.recovery-${randomUUID()}`,
      ),
      movedPrior: false,
      installed: false,
    };
  });

  let replacementError: unknown;
  try {
    for (const entry of entries) {
      await mkdir(path.dirname(entry.output), { recursive: true });
      try {
        await operations.rename(entry.output, entry.backup);
        entry.movedPrior = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    for (const entry of entries) {
      await operations.rename(entry.unit.stagedPath, entry.output);
      entry.installed = true;
    }
  } catch (error) {
    replacementError = error;
  }

  if (replacementError) {
    const rollbackFailures: string[] = [];
    for (const entry of entries.toReversed()) {
      if (entry.installed) {
        try {
          await operations.remove(entry.output, {
            recursive: true,
            force: true,
          });
        } catch (error) {
          rollbackFailures.push(
            `${entry.outputRelative}: cannot remove replacement: ${String(error)}`,
          );
        }
      }
      if (entry.movedPrior) {
        try {
          await operations.rename(entry.backup, entry.output);
        } catch (error) {
          rollbackFailures.push(
            `${entry.outputRelative}: cannot restore ${entry.backup}: ${String(error)}`,
          );
        }
      }
    }
    if (rollbackFailures.length > 0) {
      fail(
        `distribution replacement failed and rollback was incomplete; replacement=${String(replacementError)}; recovery=${rollbackFailures.join('; ')}`,
      );
    }
    fail(
      `distribution replacement failed; all prior outputs restored: ${String(replacementError)}`,
    );
  }

  const cleanupFailures: string[] = [];
  for (const entry of entries) {
    if (!entry.movedPrior) continue;
    try {
      await operations.remove(entry.backup, { recursive: true, force: true });
    } catch (error) {
      cleanupFailures.push(`${entry.backup}: ${String(error)}`);
    }
  }
  if (cleanupFailures.length > 0) {
    fail(
      `distribution installed but backup cleanup failed: ${cleanupFailures.join('; ')}`,
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
