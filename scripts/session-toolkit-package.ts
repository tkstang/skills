import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = join(root, 'packages/session-toolkit');
const packageName = '@tkstang/session-toolkit';
const registry = 'https://registry.npmjs.org/';

function run(
  command: string,
  args: string[],
  cwd = root,
  env = process.env,
): string {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed: ${result.error ?? result.stderr}`,
  );
  return result.stdout;
}

interface PackedMetadata {
  name: string;
  version: string;
  private?: boolean;
  type: string;
  engines: { node: string };
  bin: { seshtk: string };
  exports: { '.': { types: string; import: string } };
  publishConfig: { access: string; registry: string };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/** Inspect the packed manifest, including names after pnpm rewrites workspace specs. */
export function validatePackedMetadata(
  pkg: PackedMetadata,
  privateNames: ReadonlySet<string>,
): void {
  assert.equal(pkg.name, packageName);
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=22.0.0');
  assert.deepEqual(pkg.bin, { seshtk: './dist/bin.js' });
  assert.deepEqual(pkg.exports, {
    '.': { types: './dist/index.d.ts', import: './dist/index.js' },
  });
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.publishConfig.registry, registry);
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'devDependencies',
  ] as const) {
    for (const [name, spec] of Object.entries(pkg[section] ?? {})) {
      assert.ok(
        !privateNames.has(name),
        `Private workspace dependency: ${name}`,
      );
      assert.ok(
        !/^(workspace:|file:|link:)|^(\/|\.\.?\/)/.test(spec),
        `Unresolved/local dependency: ${name}@${spec}`,
      );
    }
  }
  for (const name of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(
      pkg.scripts?.[name],
      undefined,
      `Installed lifecycle script is not allowed: ${name}`,
    );
  }
}

function privateWorkspaceNames(): Set<string> {
  const paths = [
    join(root, 'package.json'),
    ...readdirSync(join(root, 'packages')).map((name) =>
      join(root, 'packages', name, 'package.json'),
    ),
  ];
  const names = new Set<string>();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    if (pkg.private) names.add(pkg.name);
  }
  return names;
}

export function validateArchive(archive: string, node = process.execPath) {
  const paths = run('tar', ['-tzf', archive]).trim().split('\n');
  assert.ok(paths.length > 0);
  for (const path of paths) {
    assert.match(
      path,
      /^package\/(?:package\.json|README\.md|LICENSE|dist\/[a-z-]+\.(?:js|d\.ts))$/,
      `Unexpected packed path: ${path}`,
    );
  }
  for (const required of [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/bin.js',
  ]) {
    assert.ok(
      paths.includes(`package/${required}`),
      `Missing packed path: ${required}`,
    );
  }
  // A path allowlist cannot distinguish a file from a link to another path.
  // Reject links (including hard links) before extracting any archive member.
  for (const member of run('tar', ['-tvzf', archive]).trim().split('\n')) {
    assert.ok(
      member.startsWith('-'),
      `Packed member must be a regular file: ${member}`,
    );
  }
  const pkg: PackedMetadata = JSON.parse(
    run('tar', ['-xOzf', archive, 'package/package.json']),
  );
  validatePackedMetadata(pkg, privateWorkspaceNames());
  const temporary = mkdtempSync(join(tmpdir(), 'session-toolkit-pack-'));
  try {
    const env = {
      ...process.env,
      HOME: temporary,
      STATE_DIR: join(temporary, 'state'),
      NO_COLOR: '1',
      npm_config_userconfig: join(temporary, 'empty.npmrc'),
    };
    // Inspect mode and file types before trusting the packed executable. Path
    // allowlisting above confines extraction to this disposable directory.
    run('tar', ['-xzf', archive, '-C', temporary]);
    for (const path of paths)
      assert.ok(
        lstatSync(join(temporary, path)).isFile(),
        `Not a regular file: ${path}`,
      );
    const extractedBin = join(temporary, 'package/dist/bin.js');
    assert.ok(statSync(extractedBin).mode & 0o111, 'CLI is not executable');
    assert.ok(
      readFileSync(extractedBin, 'utf8').startsWith('#!/usr/bin/env node\n'),
    );
    const prefix = join(temporary, 'installed');
    run(
      'npm',
      [
        'install',
        '--prefix',
        prefix,
        '--cache',
        join(temporary, 'npm-cache'),
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        archive,
      ],
      temporary,
      env,
    );
    const bin = join(prefix, 'node_modules/.bin/seshtk');
    const runtime = run(node, ['--version'], temporary, env).trim();
    assert.match(
      runtime,
      /^v(?:22|24)\./,
      'Consumer proof requires Node 22 or 24',
    );
    const version = run(node, [bin, '--version'], prefix, env).trim();
    assert.equal(version, pkg.version);
    const help = run(node, [bin, '--help'], prefix, env);
    assert.match(help, /Usage: seshtk/);
    assert.match(help, /capabilities/);
    const capabilities = JSON.parse(
      run(node, [bin, 'capabilities', '--json'], prefix, env),
    );
    assert.equal(capabilities.ok, true);
    assert.equal(capabilities.schema_version, 1);
    assert.equal(capabilities.data.package, packageName);
    assert.equal(capabilities.data.version, pkg.version);
    assert.ok(
      capabilities.data.capabilities.includes('toolkit.capabilities.v1'),
    );
    // Import by public package name outside the repository, with hostile CLI
    // arguments. Silence and untouched HOME/STATE_DIR protect import safety.
    const before = readdirSync(temporary).toSorted();
    const imported = spawnSync(
      node,
      [
        '--input-type=module',
        '-e',
        `
      process.argv.push('read', '--invalid');
      const api = await import('@tkstang/session-toolkit');
      if (typeof api.getCapabilities !== 'function') throw new Error('Missing public API');
      if (api.getCapabilities().version !== ${JSON.stringify(pkg.version)}) throw new Error('Wrong API version');
      process.stdout.write('IMPORT_OK\\n');
    `,
      ],
      { cwd: prefix, env, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(
      imported.stdout,
      'IMPORT_OK\n',
      'Library import emitted output or exited before the API call completed',
    );
    assert.equal(imported.stderr, '', 'Library import wrote to stderr');
    assert.deepEqual(
      readdirSync(temporary).toSorted(),
      before,
      'Library import wrote state',
    );
    // Exercise the installed bytes, public exports and bin outside the checkout.
    // Unit/CLI tests cannot catch missing packed modules or runtime-floor APIs.
    const operational = run(
      node,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { mkdir, writeFile, readFile, access, realpath } from 'node:fs/promises';
      import { join, dirname } from 'node:path';
      import { spawnSync } from 'node:child_process';
      import * as api from '@tkstang/session-toolkit';
      const home = await realpath(process.env.HOME), cwd = join(home, 'fixture-repo');
      process.env.HOME = home;
      await mkdir(cwd);
      const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const claude = join(home, '.claude/projects', cwd.replace(/[/.]/g, '-'), id + '.jsonl');
      const codex = join(home, '.codex/sessions/2026/10/29', 'rollout-2026-10-29T00-00-00-' + id + '.jsonl');
      const cursor = join(home, 'cursor.jsonl');
      const retained = 'raw-archive-detail-'.repeat(100) + 'uncapped-marker';
      process.env.SESHTK_SEARCH_NO_RG = '1'; process.env.SESHTK_SEARCH_NO_SQLITE3 = '1';
      for (const [path, records] of [
        [claude, [{sessionId:id,cwd,type:'user',message:{content:'archive question'}},{type:'assistant',message:{content:'archive answer'}}]],
        [codex, [{type:'session_meta',payload:{id,cwd}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'archive question'}]}},{type:'response_item',payload:{type:'function_call',call_id:'a',name:'exec_command',arguments:JSON.stringify({cmd:retained})}},{type:'response_item',payload:{type:'function_call_output',call_id:'a',output:retained}}]],
        [cursor, [{role:'user',message:{content:[{type:'text',text:'archive question'}]}},{role:'assistant',message:{content:[{type:'text',text:'archive answer'}]}},{type:'turn_ended',status:'success'}]]
      ]) {
        await mkdir(dirname(path), {recursive:true});
        await writeFile(path, records.map(r=>JSON.stringify(r)).join('\\n')+'\\n');
      }
      const listed = await api.listSessions({homeDir:home,cwd});
      assert.equal(listed.kind, 'historical'); assert.equal(listed.candidates.length,2);
      const exact = await api.identifyCurrentTranscript({homeDir:home,cwd,env:{CLAUDE_SESSION_ID:id}});
      assert.equal(exact.status,'authoritative');
      assert.equal((await api.revalidateCurrentTranscript(exact,{homeDir:home,cwd,env:{CLAUDE_SESSION_ID:id}})).status,'authoritative');
      for (const [runtime,path] of [['claude-code',claude],['codex',codex],['cursor',cursor]]) {
        const page = await api.parseTranscript({runtime,path});
        assert.equal(page.messages[0].text,'archive question');
        assert.equal(page.coverage.complete,true);
      }
      assert.equal((await api.readTranscript({homeDir:home,session:'claude-code:'+id})).messages[1].text,'archive answer');
      const evidence = await api.readEvidence({homeDir:home,session:'codex:'+id});
      assert.ok(evidence.evidence.cutoff); assert.ok(evidence.activity.events.some(event => event.kind === 'call'));
      const searchOptions = {home,env:process.env,runtime:'codex',patterns:['uncapped-marker'],includeTools:true};
      const search = await api.searchSessions(searchOptions);
      assert.equal(search.results.length,1); assert.match(search.results[0].snippets[0].text,/uncapped-marker/);
      const estimate = await api.estimateSearch(searchOptions);
      assert.equal(estimate.totalFiles,1); assert.equal(estimate.incomplete,false);
      await assert.rejects(api.searchSessions({...searchOptions,largeScanBytes:1}), {code:'E_SCAN_CONFIRMATION'});
      const activity = await api.captureActivity({homeDir:home,session:'codex:'+id});
      assert.equal(activity.events.find(e=>e.kind==='result').result,retained);
      assert.equal(activity.events.find(e=>e.kind==='call').arguments.cmd,retained);
      assert.equal(activity.sourceRead.coverage.fullSource,true);
      assert.equal(activity.sourceRead.records[3].physicalLine,4);
      assert.ok(!(await api.parseTranscript({runtime:'codex',path:codex,includeToolResults:true})).messages.some(m=>m.text.includes('uncapped-marker')));
      const out = join(home,'archive-export.md');
      await api.exportMarkdown({homeDir:home,session:'claude-code:'+id,out});
      assert.match(await readFile(out,'utf8'), /archive answer/);
      const cli = (...args) => {
        const result = spawnSync(process.execPath, [${JSON.stringify(bin)}, ...args, '--json'], {cwd,env:process.env,encoding:'utf8'});
        assert.equal(result.status,0,result.stderr+result.stdout);
        const value = JSON.parse(result.stdout); assert.equal(value.ok,true); return value.data;
      };
      assert.equal(cli('list').candidates.length,2);
      for (const [runtime,path] of [['claude-code',claude],['codex',codex],['cursor',cursor]])
        assert.equal(cli('parse',path,'--runtime',runtime).messages[0].text,'archive question');
      assert.equal(cli('read','--session','claude-code:'+id).messages[1].text,'archive answer');
      assert.ok(cli('read','--session','codex:'+id,'--evidence').evidence.cutoff);
      cli('export','--session','claude-code:'+id,'--out',join(home,'cli-export.md'));
      assert.equal(cli('search','-p','uncapped-marker','--runtime','codex','--include-tools').results.length,1);
      assert.equal(cli('search','estimate','-p','archive','--runtime','codex').totalFiles,1);
      assert.equal(cli('activity','--session','codex:'+id).events.find(e=>e.kind==='result').result,retained);
      cli('activity','--session','codex:'+id,'--out',join(home,'cli-activity.json'));
      assert.equal(JSON.parse(await readFile(join(home,'cli-activity.json'),'utf8')).kind,'sensitive-activity');
      await assert.rejects(access(process.env.STATE_DIR));
      process.stdout.write('OPERATIONS_OK\\n');
    `,
      ],
      prefix,
      env,
    );
    assert.equal(operational, 'OPERATIONS_OK\n');
    const consumerTypes = join(prefix, 'consumer.mts');
    writeFileSync(
      consumerTypes,
      `
      import { parseTranscript, readEvidence, identifyCurrentTranscript, exportMarkdown, searchSessions, estimateSearch, captureActivity,
        type ReadOptions, type TranscriptPage, type EvidenceOptions, type CurrentTranscriptIdentity,
        type ExportResult, type SearchOptions, type SearchResult, type EstimateResult, type ActivityOptions, type ActivityCapture, type ActivityEvent } from '@tkstang/session-toolkit';
      const options: ReadOptions = {runtime:'cursor',path:'/explicit/fixture.jsonl',maxRecords:10};
      const page: Promise<TranscriptPage> = parseTranscript(options);
      const identity: Promise<CurrentTranscriptIdentity> = identifyCurrentTranscript({cwd:'/repo'});
      const evidenceOptions: EvidenceOptions = {session:'codex:id'};
      const evidence = readEvidence(evidenceOptions);
      const exported: Promise<ExportResult> = exportMarkdown({session:'codex:id',out:'/new/file.md'});
      const searchOptions: SearchOptions = {patterns:['fixture'],tiers:['history','meta','content'],runtime:'auto'};
      const found: Promise<SearchResult> = searchSessions(searchOptions);
      const estimate: Promise<EstimateResult> = estimateSearch(searchOptions);
      const activityOptions: ActivityOptions = {session:'codex:id',maxBytes:4000000};
      const activity: Promise<ActivityCapture> = captureActivity(activityOptions);
      function rawFact(event: ActivityEvent): unknown { return event.result ?? event.arguments; }
      void [page,identity,evidence,exported,found,estimate,activity,rawFact];
    `,
    );
    run(
      process.execPath,
      [
        join(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '--strict',
        '--module',
        'nodenext',
        '--target',
        'es2022',
        '--lib',
        'es2023',
        '--types',
        'node',
        '--typeRoots',
        join(root, 'node_modules/@types'),
        consumerTypes,
      ],
      prefix,
      env,
    );
    console.log(
      `Archive clean-install proof passed on ${runtime}: ${paths.length} files, import/version/help/capabilities and fixture API/CLI operations.`,
    );
    return { pkg, runtime, paths };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      archive: { type: 'string' },
      node: { type: 'string' },
    },
  });
  assert.notEqual(
    Boolean(values.out),
    Boolean(values.archive),
    'Choose exactly one of --out <new-directory> or --archive <tarball>',
  );
  if (values.archive) {
    validateArchive(
      resolve(values.archive),
      values.node ? resolve(values.node) : process.execPath,
    );
    return;
  }
  assert.match(
    process.version,
    /^v24\./,
    'Release preparation runs on Node 24',
  );
  const out = resolve(values.out!);
  await mkdir(out); // A fresh directory prevents accidental reuse of stale archives.
  run('pnpm', ['pack', '--pack-destination', out], packageRoot);
  const archives = readdirSync(out).filter((path) => path.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  const archive = join(out, archives[0]!);
  const { pkg, runtime } = validateArchive(
    archive,
    values.node ? resolve(values.node) : process.execPath,
  );
  // npm receives the inspected bytes; there is no rebuild or publish in p01.
  run('npm', [
    'publish',
    archive,
    '--dry-run',
    '--ignore-scripts',
    '--access',
    'public',
    '--registry',
    registry,
  ]);
  const bytes = readFileSync(archive);
  const release = {
    name: pkg.name,
    version: pkg.version,
    tag: `session-toolkit-v${pkg.version}`,
    commit: run('git', ['rev-parse', 'HEAD']).trim(),
    archive: archives[0],
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    verified_node: runtime,
    publication_authorized: false,
  };
  await writeFile(
    join(out, 'release.json'),
    `${JSON.stringify(release, null, 2)}\n`,
    { flag: 'wx' },
  );
  await writeFile(
    join(out, 'SHA256SUMS'),
    `${release.sha256}  ${release.archive}\n`,
    { flag: 'wx' },
  );
  console.log(
    `Exact-archive release dry run passed: ${out}. No publication performed.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
