import type { DistributionDeclaration } from '../scripts/lib/packaging.js';

// Declarations move here as authored owners migrate under src/skills. Keeping
// the list empty during p01 means the existing output table remains the sole
// writer until an owner has actually moved; fixture roots exercise the new
// declaration pipeline before that migration begins.
export const distributions: readonly DistributionDeclaration[] = [];

// Historical identity only. These paths must never be rendered as aliases or
// generated compatibility payloads.
export const legacySkillOwners = {
  'export-session-transcript': 'session-export-transcript',
  'coding-session-handoff': 'session-fork-to-destination',
} as const;
