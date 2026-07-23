// tests/tooling/shared-cli-helpers-guard.test.ts
//
// Guard against re-forking the consolidated consensus CLI helpers. The
// command modules (create/decide/plan/evaluate) and the core loop import their
// shared primitives from `src/consensus/shared/cli-helpers.ts`; if a future
// edit re-adds a local `function <name>` that shadows a shared export, the
// duplication this refactor removed silently returns. This source-scan fails
// fast when that happens.
//
// Deliberately excluded: `consensus-panel.ts`. Panel is architecturally
// decoupled from `consensus-loop.ts` (it defines its own PANEL_EXIT_CODES and
// error class and imports nothing from the loop). The shared module depends on
// consensus-loop's ConsensusError/EXIT_CODES, so importing it would transitively
// couple panel to the loop. Panel therefore keeps its own byte-similar copies
// on purpose; see consensus-panel.ts and the plan
// (2026-07-17-consolidate-consensus-cli-helpers.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SHARED = 'src/consensus/shared/cli-helpers.ts';

// Modules that consume the shared module and must not redeclare its exports.
const CONSUMERS = [
  'src/consensus/create/consensus-create.ts',
  'src/consensus/decide/consensus-decide.ts',
  'src/consensus/plan/consensus-plan.ts',
  'src/consensus/evaluate/consensus-evaluate.ts',
];

// The loop only imports the reconciled parser pair from the shared module.
const LOOP = 'src/consensus/core/consensus-loop.ts';
const LOOP_SHARED_NAMES = ['parsePeers', 'parsePositiveInteger'];

function sharedExportedFunctionNames(): string[] {
  const source = readFileSync(SHARED, 'utf8');
  const names = new Set<string>();
  const re = /^export\s+(?:async\s+)?function\s+(\w+)\b/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) names.add(match[1]);
  return [...names];
}

function declaresFunction(source: string, name: string): boolean {
  return new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`, 'm').test(
    source,
  );
}

describe('shared cli-helpers re-fork guard', () => {
  const sharedNames = sharedExportedFunctionNames();

  it('the shared module exports the expected helper surface', () => {
    // Sanity check: keeps this guard honest if the shared module is emptied.
    expect(sharedNames.length).toBeGreaterThanOrEqual(15);
    expect(sharedNames).toContain('confineWrite');
    expect(sharedNames).toContain('parsePeers');
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
});
