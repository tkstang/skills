import type { DistributionDeclaration } from '../scripts/lib/packaging.js';

export interface PluginReleaseTarget {
  name: string;
  providerManifests: readonly string[];
  marketplaceManifests: readonly string[];
}

// Plugin release versions are separate from canonical skill versions. Keep
// the provider and catalog surfaces together so release and validation tooling
// can select one plugin without rewriting another plugin or its member skills.
export const pluginReleaseTargets: readonly PluginReleaseTarget[] = [
  {
    name: 'consensus',
    providerManifests: [
      'plugins/consensus/.claude-plugin/plugin.json',
      'plugins/consensus/.cursor-plugin/plugin.json',
      'plugins/consensus/.codex-plugin/plugin.json',
    ],
    marketplaceManifests: [
      '.claude-plugin/marketplace.json',
      '.cursor-plugin/marketplace.json',
      '.agents/plugins/marketplace.json',
    ],
  },
  {
    name: 'session',
    providerManifests: [
      'plugins/session/.claude-plugin/plugin.json',
      'plugins/session/.cursor-plugin/plugin.json',
      'plugins/session/.codex-plugin/plugin.json',
    ],
    marketplaceManifests: [
      '.claude-plugin/marketplace.json',
      '.cursor-plugin/marketplace.json',
      '.agents/plugins/marketplace.json',
    ],
  },
];

// Authored owners declare their installation targets here as they migrate
// under src/skills. Generated payloads remain derivative build output.
export const distributions: readonly DistributionDeclaration[] = [
  {
    owner: 'consensus-review',
    source: 'src/skills/consensus-review',
    allowedSourceRoots: [
      'src/plugins/consensus/config',
      'src/plugins/consensus/provider-cli',
      'src/plugins/consensus/shared',
    ],
    targets: [
      {
        kind: 'standalone',
        name: 'consensus-review',
        output: 'skills/consensus-review',
      },
      {
        kind: 'plugin',
        plugin: 'consensus',
        name: 'review',
        output: 'plugins/consensus/skills/review',
      },
    ],
  },
  ...(
    [
      'create',
      'decide',
      'evaluate',
      'panel',
      'phone-a-friend',
      'plan',
      'refine',
    ] as const
  ).map((owner) => ({
    owner,
    source: `src/skills/${owner}`,
    allowedSourceRoots: ['src/plugins/consensus'],
    targets: [
      {
        kind: 'plugin' as const,
        plugin: 'consensus',
        name: owner,
        output: `plugins/consensus/skills/${owner}`,
      },
    ],
  })),
  {
    owner: 'complexity-review',
    source: 'src/skills/complexity-review',
    targets: [
      {
        kind: 'standalone',
        name: 'complexity-review',
        output: 'skills/complexity-review',
      },
    ],
  },
  {
    owner: 'must-we',
    source: 'src/skills/must-we',
    optionalSkills: [
      {
        name: 'complexity-review',
        installUrl:
          'https://github.com/tkstang/skills/tree/main/skills/complexity-review',
      },
    ],
    targets: [
      {
        kind: 'standalone',
        name: 'must-we',
        output: 'skills/must-we',
      },
    ],
  },
  {
    owner: 'next-steps',
    source: 'src/skills/next-steps',
    targets: [
      {
        kind: 'standalone',
        name: 'next-steps',
        output: 'skills/next-steps',
      },
    ],
  },
  {
    owner: 'session-handoff',
    source: 'src/skills/session-handoff',
    optionalSkills: [
      {
        name: 'session-observer',
        installUrl:
          'https://github.com/tkstang/skills/tree/main/skills/session-observer',
      },
      {
        name: 'session-export-transcript',
        installUrl:
          'https://github.com/tkstang/skills/tree/main/skills/session-export-transcript',
      },
    ],
    targets: [
      {
        kind: 'standalone',
        name: 'session-handoff',
        output: 'skills/session-handoff',
      },
      {
        kind: 'plugin',
        plugin: 'session',
        name: 'handoff',
        output: 'plugins/session/skills/handoff',
      },
    ],
  },
  {
    owner: 'session-observer',
    source: 'src/skills/session-observer',
    allowedSourceRoots: ['src/shared/transcript'],
    targets: [
      {
        kind: 'standalone',
        name: 'session-observer',
        output: 'skills/session-observer',
      },
      {
        kind: 'plugin',
        plugin: 'consensus',
        name: 'observer',
        output: 'plugins/consensus/skills/observer',
      },
    ],
  },
  {
    owner: 'session-retro',
    source: 'src/skills/session-retro',
    optionalSkills: [
      {
        name: 'session-observer',
        installUrl:
          'https://github.com/tkstang/skills/tree/main/skills/session-observer',
      },
    ],
    targets: [
      {
        kind: 'standalone',
        name: 'session-retro',
        output: 'skills/session-retro',
      },
      {
        kind: 'plugin',
        plugin: 'session',
        name: 'retro',
        output: 'plugins/session/skills/retro',
      },
    ],
  },
  {
    owner: 'session-observer-collab',
    source: 'src/skills/session-observer-collab',
    allowedSourceRoots: [
      'src/skills/session-observer',
      'src/shared/transcript',
    ],
    requiredSkills: [
      {
        name: 'session-observer',
        installUrl:
          'https://github.com/tkstang/skills/tree/main/skills/session-observer',
      },
    ],
    targets: [
      {
        kind: 'standalone',
        name: 'session-observer-collab',
        output: 'skills/session-observer-collab',
      },
      {
        kind: 'plugin',
        plugin: 'consensus',
        name: 'observer-collab',
        output: 'plugins/consensus/skills/observer-collab',
      },
    ],
  },
  {
    owner: 'session-export-transcript',
    source: 'src/skills/session-export-transcript',
    allowedSourceRoots: ['src/shared/transcript'],
    targets: [
      {
        kind: 'standalone',
        name: 'session-export-transcript',
        output: 'skills/session-export-transcript',
      },
      {
        kind: 'plugin',
        plugin: 'session',
        name: 'export-transcript',
        output: 'plugins/session/skills/export-transcript',
      },
    ],
  },
  {
    owner: 'session-fork-to-destination',
    source: 'src/skills/session-fork-to-destination',
    allowedSourceRoots: [
      'src/skills/session-export-transcript',
      'src/skills/session-observer',
      'src/shared/transcript',
    ],
    optionalSkills: [
      {
        name: 'session-observer',
        installUrl:
          'https://github.com/tkstang/skills/tree/main/skills/session-observer',
      },
    ],
    targets: [
      {
        kind: 'standalone',
        name: 'session-fork-to-destination',
        output: 'skills/session-fork-to-destination',
      },
      {
        kind: 'plugin',
        plugin: 'session',
        name: 'fork-to-destination',
        output: 'plugins/session/skills/fork-to-destination',
      },
    ],
  },
];

// Clean-break enforcement, not compatibility: these renamed-away output paths
// must never reappear. The build removes them and `--check` fails if they exist.
// No alias, redirect, wrapper, or generated payload is produced for them.
export const obsoleteDistributionOutputs = Object.freeze([
  'skills/export-session-transcript',
  'skills/coding-session-handoff',
]);
