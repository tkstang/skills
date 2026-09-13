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
];

// Authored owners declare their installation targets here as they migrate
// under src/skills. Generated payloads remain derivative build output.
export const distributions: readonly DistributionDeclaration[] = [
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
    owner: 'session-observer',
    source: 'src/skills/session-observer',
    allowedSourceRoots: ['src/shared/transcript'],
    targets: [
      {
        kind: 'standalone',
        name: 'session-observer',
        output: 'skills/session-observer',
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
    ],
  },
  {
    owner: 'session-export-transcript',
    source: 'src/skills/session-export-transcript',
    allowedSourceRoots: ['src/shared/transcript'],
    targets: [
      {
        kind: 'standalone',
        name: 'export-session-transcript',
        output: 'skills/export-session-transcript',
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
        name: 'coding-session-handoff',
        output: 'skills/coding-session-handoff',
      },
    ],
  },
];

// Historical identity only. These paths must never be rendered as aliases or
// generated compatibility payloads.
export const legacySkillOwners = {
  'export-session-transcript': 'session-export-transcript',
  'coding-session-handoff': 'session-fork-to-destination',
} as const;
