// tests/tooling/shared-cli-helpers-guard.test.ts
//
// Guard against re-forking the consolidated consensus CLI helpers. The
// command modules (create/decide/plan/evaluate) and the core loop import their
// shared primitives from `src/plugins/consensus/shared/cli-helpers.ts`; if a future
// edit re-adds a local `function <name>` that shadows a shared export, the
// duplication this refactor removed silently returns. This source-scan fails
// fast when that happens.
//
// The shared surface is now split in two. `cli-helpers-core.ts` holds the pure,
// loop-free primitives; `cli-helpers.ts` re-exports that whole surface and adds
// only the helpers that raise consensus-loop's `ConsensusError` with an
// `EXIT_CODES` value (`providerCliUnavailableError`, `confineWrite`,
// `atomicWriteFile`). Because the coupled layer now re-exports rather than
// declares most helpers, the effective helper-name union is derived from both
// files' own declarations.
//
// `consensus-panel.ts` is architecturally decoupled from `consensus-loop.ts`
// (it defines its own PANEL_EXIT_CODES and error class and imports nothing from
// the loop). It may therefore import the loop-free core, but never the
// loop-coupled layer. Panel keeps deliberate local variants where behavior
// differs on purpose: prompt-block encoding (panel also escapes `&`), envelope
// parsing (panel takes a subprocess result and raises PanelError), and its own
// panelist/panel-size parsers. Those names are exempt below.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const CORE = 'src/plugins/consensus/shared/cli-helpers-core.ts';
const SHARED = 'src/plugins/consensus/shared/cli-helpers.ts';
const PANEL = 'src/skills/panel/src/consensus-panel.ts';

// Modules that consume the shared module and must not redeclare its exports.
const CONSUMERS = [
  'src/skills/create/src/consensus-create.ts',
  'src/skills/decide/src/consensus-decide.ts',
  'src/skills/plan/src/consensus-plan.ts',
  'src/skills/evaluate/src/consensus-evaluate.ts',
];

// The loop only imports the reconciled parser pair from the shared module.
const LOOP = 'src/plugins/consensus/core/consensus-loop.ts';
const LOOP_SHARED_NAMES = ['parsePeers', 'parsePositiveInteger'];

// The exact loop-free core surface. Kept explicit so moving a helper into or
// out of the core is a deliberate edit to this list.
const EXPECTED_CORE_NAMES = [
  'encodePromptBlockData',
  'ensureFinalNewline',
  'inside',
  'isJsonRecord',
  'nearestExistingPath',
  'parsePeers',
  'parsePositiveInteger',
  'parseProviderCliEnvelope',
  'pathExists',
  'promptBlockData',
  'providerInventoryEntries',
  'providerStatusMap',
  'requireValue',
  'validateProviderId',
];

// The helpers that must stay in the loop-coupled layer: the ConsensusError /
// EXIT_CODES trio, plus the peer-spec helpers that type against the loop's
// PeerAgent/PeerSpec (pure, but not loop-free at the type level).
const EXPECTED_COUPLED_NAMES = [
  'atomicWriteFile',
  'confineWrite',
  'formatPeerAgents',
  'normalizePeerAgent',
  'parsePeerAgents',
  'peerAgentsFromComposition',
  'providerCliUnavailableError',
];

// Core helpers panel now consumes; redeclaring any of them re-forks the copy
// this extraction removed.
const PANEL_GUARDED_NAMES = [
  'ensureFinalNewline',
  'inside',
  'isJsonRecord',
  'nearestExistingPath',
  'pathExists',
  'providerInventoryEntries',
  'providerStatusMap',
  'requireValue',
  'validateProviderId',
];

function exportedFunctionNames(modulePath: string): string[] {
  const source = readFileSync(modulePath, 'utf8');
  const names = new Set<string>();
  const re = /^export\s+(?:async\s+)?function\s+(\w+)\b/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) names.add(match[1]);
  return [...names];
}

function reExportedNames(modulePath: string): string[] {
  const source = readFileSync(modulePath, 'utf8');
  const names = new Set<string>();
  const re = /^export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    for (const raw of match[1].split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/u)
        .at(-1);
      if (name) names.add(name);
    }
  }
  return [...names];
}

function declaresFunction(source: string, name: string): boolean {
  return new RegExp(
    `^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`,
    'm',
  ).test(source);
}

describe('shared cli-helpers re-fork guard', () => {
  const coreNames = exportedFunctionNames(CORE);
  const coupledOwnNames = exportedFunctionNames(SHARED);
  // Effective helper-name union: what a consumer can import from either layer.
  const sharedNames = [...new Set([...coreNames, ...coupledOwnNames])];

  it('the loop-free core exports exactly the expected pure helper surface', () => {
    expect(coreNames.toSorted()).toEqual(EXPECTED_CORE_NAMES.toSorted());
  });

  it('the loop-coupled layer declares only the ConsensusError helpers and re-exports the core', () => {
    expect(coupledOwnNames.toSorted()).toEqual(
      EXPECTED_COUPLED_NAMES.toSorted(),
    );
    // Consumers of the coupled layer must keep seeing the full surface.
    expect(reExportedNames(SHARED).toSorted()).toEqual(
      EXPECTED_CORE_NAMES.toSorted(),
    );
  });

  it('the shared module exports the expected helper surface', () => {
    // Sanity check: keeps this guard honest if the shared module is emptied.
    expect(sharedNames.length).toBeGreaterThanOrEqual(15);
    expect(sharedNames).toContain('confineWrite');
    expect(sharedNames).toContain('parsePeers');
  });

  it('the loop-free core has no runtime import of the loop or the coupled layer', () => {
    const source = readFileSync(CORE, 'utf8');
    // The module's header comment names these deliberately; only code counts.
    const code = source.replaceAll(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/ConsensusError|EXIT_CODES/);
    expect(code).not.toMatch(/from\s+['"][^'"]*consensus-loop\.js['"]/);
    expect(code).not.toMatch(/from\s+['"][^'"]*\/cli-helpers\.js['"]/);
    // Type-only imports create no runtime edge; any value import must not.
    const valueImports = [
      ...source.matchAll(
        /^import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gms,
      ),
    ].map((match) => match[1]);
    expect(valueImports.toSorted()).toEqual(['node:fs/promises', 'node:path']);
  });

  it.each(CONSUMERS)(
    '%s does not redeclare any shared-exported helper',
    (modulePath) => {
      const source = readFileSync(modulePath, 'utf8');
      const redeclared = sharedNames.filter((name) =>
        declaresFunction(source, name),
      );
      expect(redeclared).toEqual([]);
    },
  );

  it('consensus-loop.ts does not redeclare the reconciled parsers', () => {
    const source = readFileSync(LOOP, 'utf8');
    const redeclared = LOOP_SHARED_NAMES.filter((name) =>
      declaresFunction(source, name),
    );
    expect(redeclared).toEqual([]);
  });

  it('consensus-panel.ts does not redeclare the core helpers it imports', () => {
    const source = readFileSync(PANEL, 'utf8');
    const redeclared = PANEL_GUARDED_NAMES.filter((name) =>
      declaresFunction(source, name),
    );
    expect(redeclared).toEqual([]);
  });

  // Enforce (not just document) panel's deliberate decoupling from the loop.
  // The loop-coupled helper layer depends on consensus-loop's
  // ConsensusError/EXIT_CODES, so a single import from it would transitively
  // load the entire loop into panel's runtime. Guard those edges while allowing
  // the loop-free core.
  it('consensus-panel.ts stays decoupled from consensus-loop and the loop-coupled helpers', () => {
    const source = readFileSync(PANEL, 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*consensus-loop\.js['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*\/cli-helpers\.js['"]/);
    // ...but it does import the loop-free core.
    expect(source).toMatch(/from\s+['"][^'"]*\/cli-helpers-core\.js['"]/);
  });
});
