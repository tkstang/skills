import {
  validateGuidanceTarget,
  type HandoffGitTargetEvidence,
} from './git-target.js';
import {
  getGuidanceCapability,
  type DocumentedTerminalOperation,
} from './guidance-capabilities.js';
import type { GuidanceSessionCandidate } from './guidance-discovery.js';

export type GuidanceEntryPoint =
  | 'source-current'
  | 'source-other'
  | 'destination-fresh';

export type PreparedGuidanceInstruction =
  | { kind: 'terminal'; runIn: string; command: string }
  | {
      kind: 'slash-command';
      command: string;
      explanation: string;
    }
  | {
      kind: 'manual';
      action: 'exit-current-session' | 'unsupported';
      explanation: string;
    };

export interface PrepareForkGuidanceInput {
  sourcePath: string;
  destinationPath: string;
  entryPoint: GuidanceEntryPoint;
  candidate: GuidanceSessionCandidate;
}

export interface PreparedForkGuidance {
  status: 'experimental-not-released';
  source: string;
  destination: string;
  destinationDirty: boolean;
  selectedSource: GuidanceSessionCandidate['key'];
  provider: GuidanceSessionCandidate['provider'];
  surface: GuidanceSessionCandidate['surface'];
  entryPoint: GuidanceEntryPoint;
  instructions: PreparedGuidanceInstruction[];
  expectedEffect: string;
  evidenceStatus: 'documented-not-live-verified' | 'unsupported';
  limitations: string[];
}

export interface GuidanceDependencies {
  validateTarget: (
    sourcePath: string,
    destinationPath: string,
  ) => Promise<HandoffGitTargetEvidence>;
}

export class GuidancePreparationError extends Error {
  constructor(
    readonly code:
      | 'invalid-session-id'
      | 'invalid-source-candidate'
      | 'invalid-path',
  ) {
    super(code);
    this.name = 'GuidancePreparationError';
  }
}

const DEFAULT_DEPENDENCIES: GuidanceDependencies = {
  validateTarget: validateGuidanceTarget,
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function quoteShellWord(value: string): string {
  if (value.length === 0) return "''";
  if (value.includes('\0') || value.includes('\n') || value.includes('\r')) {
    throw new GuidancePreparationError('invalid-path');
  }
  if (/^[A-Za-z0-9_./:=+@%-]+$/u.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function validateCandidate(candidate: GuidanceSessionCandidate): void {
  if (candidate.provider !== 'cursor' && !UUID.test(candidate.nativeId)) {
    throw new GuidancePreparationError('invalid-session-id');
  }
  if (
    candidate.key !==
    `${candidate.provider}:${candidate.surface}:${candidate.nativeId}`
  ) {
    throw new GuidancePreparationError('invalid-source-candidate');
  }
}

function destinationCommand(
  operation: DocumentedTerminalOperation,
  destination: string,
  nativeId: string,
): string {
  const argv = operation.argv.map((argument) =>
    quoteShellWord(argument.replace('{sessionId}', nativeId)),
  );
  const expected = quoteShellWord(destination);
  return `test "$(pwd -P)" = ${expected} || { printf '%s\\n' 'Refusing: open the canonical destination worktree first.' >&2; exit 64; }; exec ${argv.join(' ')}`;
}

export async function prepareForkGuidance(
  input: PrepareForkGuidanceInput,
  deps: GuidanceDependencies = DEFAULT_DEPENDENCIES,
): Promise<PreparedForkGuidance> {
  validateCandidate(input.candidate);
  const evidence = await deps.validateTarget(
    input.sourcePath,
    input.destinationPath,
  );
  if (input.candidate.recordedCwd !== evidence.source.canonicalPath) {
    throw new GuidancePreparationError('invalid-source-candidate');
  }

  if (input.candidate.surface === 'ambiguous') {
    return {
      status: 'experimental-not-released',
      source: evidence.source.canonicalPath,
      destination: evidence.target.canonicalPath,
      destinationDirty: evidence.target.dirty,
      selectedSource: input.candidate.key,
      provider: input.candidate.provider,
      surface: input.candidate.surface,
      entryPoint: input.entryPoint,
      instructions: [
        {
          kind: 'manual',
          action: 'unsupported',
          explanation:
            'Cursor transcript origin is ambiguous between IDE and CLI, so no fork or resume command is safe to suggest. Select corroborated source evidence or use Cursor documented UI manually without assuming destination placement.',
        },
      ],
      expectedEffect: 'No fork is created by this guidance.',
      evidenceStatus: 'unsupported',
      limitations: [
        'Cursor IDE/CLI identity interoperability is not established.',
        'Cross-worktree destination placement is unsupported.',
      ],
    };
  }

  const capability = getGuidanceCapability(
    input.candidate.provider,
    input.candidate.surface,
  );
  if (
    capability.fork.status !== 'documented' ||
    capability.fork.kind !== 'terminal'
  ) {
    return {
      status: 'experimental-not-released',
      source: evidence.source.canonicalPath,
      destination: evidence.target.canonicalPath,
      destinationDirty: evidence.target.dirty,
      selectedSource: input.candidate.key,
      provider: input.candidate.provider,
      surface: input.candidate.surface,
      entryPoint: input.entryPoint,
      instructions: [
        {
          kind: 'manual',
          action: 'unsupported',
          explanation:
            'No documented destination-safe terminal fork is available for this provider surface.',
        },
      ],
      expectedEffect: 'No fork is created by this guidance.',
      evidenceStatus: 'unsupported',
      limitations: [...capability.limitations],
    };
  }

  const terminal: PreparedGuidanceInstruction = {
    kind: 'terminal',
    runIn: evidence.target.canonicalPath,
    command: destinationCommand(
      capability.fork,
      evidence.target.canonicalPath,
      input.candidate.nativeId,
    ),
  };
  const instructions: PreparedGuidanceInstruction[] =
    input.entryPoint === 'destination-fresh' &&
    capability.destinationSwitch.status !== 'documented'
      ? [
          {
            kind: 'manual',
            action: 'exit-current-session',
            explanation:
              'Exit the fresh provider session, remain in this destination tab, then run the terminal command below.',
          },
          terminal,
        ]
      : [terminal];

  return {
    status: 'experimental-not-released',
    source: evidence.source.canonicalPath,
    destination: evidence.target.canonicalPath,
    destinationDirty: evidence.target.dirty,
    selectedSource: input.candidate.key,
    provider: input.candidate.provider,
    surface: input.candidate.surface,
    entryPoint: input.entryPoint,
    instructions,
    expectedEffect:
      'Running the terminal command from the canonical destination should create and open a new fork while preserving the selected original session.',
    evidenceStatus: 'documented-not-live-verified',
    limitations: [
      ...capability.limitations,
      'Preparing these instructions did not run a provider or create a fork.',
      'Destination dirty state is reported; Git changes are not transferred.',
    ],
  };
}
