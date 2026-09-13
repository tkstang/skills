export type GuidanceProvider = 'claude' | 'codex' | 'cursor';
export type GuidanceSurface = 'cli' | 'ide';

export interface GuidanceEvidence {
  url: string;
  retrievedOn: '2026-09-12';
  context: string;
}

export interface DocumentedTerminalOperation {
  status: 'documented';
  kind: 'terminal';
  argv: readonly string[];
  preservesOriginal: boolean;
  semantics: string;
}

export interface DocumentedSlashOperation {
  status: 'documented';
  kind: 'slash-command';
  command: string;
  preservesOriginal: boolean;
  semantics: string;
}

export interface DocumentedManualOperation {
  status: 'documented-manual';
  kind: 'manual';
  steps: readonly string[];
  preservesOriginal: boolean;
  semantics: string;
}

export interface UnsupportedOperation {
  status: 'unsupported';
  reason: string;
}

export interface UnverifiedOperation {
  status: 'unverified';
  reason: string;
}

export type GuidanceOperation =
  | DocumentedTerminalOperation
  | DocumentedSlashOperation
  | DocumentedManualOperation
  | UnsupportedOperation
  | UnverifiedOperation;

export interface GuidanceCapability {
  provider: GuidanceProvider;
  surface: GuidanceSurface;
  origin: 'cli-transcript' | 'ide-transcript';
  interactiveLaunch: GuidanceOperation;
  resume: GuidanceOperation;
  fork: GuidanceOperation;
  inProviderFork: GuidanceOperation;
  destinationSwitch: GuidanceOperation;
  crossWorktree: 'documented' | 'unverified' | 'unsupported';
  evidence: readonly GuidanceEvidence[];
  limitations: readonly string[];
}

const RETRIEVED_ON = '2026-09-12' as const;

export const GUIDANCE_CAPABILITIES = Object.freeze([
  {
    provider: 'claude',
    surface: 'cli',
    origin: 'cli-transcript',
    interactiveLaunch: {
      status: 'documented',
      kind: 'terminal',
      argv: ['claude'],
      preservesOriginal: true,
      semantics: 'Starts an interactive Claude Code session.',
    },
    resume: {
      status: 'documented',
      kind: 'terminal',
      argv: ['claude', '--resume', '{sessionId}'],
      preservesOriginal: false,
      semantics: 'Continues the selected session under its existing identity.',
    },
    fork: {
      status: 'documented',
      kind: 'terminal',
      argv: ['claude', '--resume', '{sessionId}', '--fork-session'],
      preservesOriginal: true,
      semantics: 'Resumes the selected history under a new session ID.',
    },
    inProviderFork: {
      status: 'unsupported',
      reason:
        'The cited Claude Code reference documents the CLI flag but no slash command that forks an arbitrary selected session.',
    },
    destinationSwitch: {
      status: 'unsupported',
      reason:
        'The cited Claude Code reference does not document replacing an already-open session with an arbitrary new fork.',
    },
    crossWorktree: 'unverified',
    evidence: [
      {
        url: 'https://code.claude.com/docs/en/cli-usage',
        retrievedOn: RETRIEVED_ON,
        context:
          'Public CLI reference retrieved without executing Claude Code; documents interactive launch, --resume, and --fork-session.',
      },
    ],
    limitations: [
      'The public reference documents syntax but does not prove behavior in this repository or an ADE tab.',
      'Cross-worktree fork behavior has no live proof in this project.',
    ],
  },
  {
    provider: 'codex',
    surface: 'cli',
    origin: 'cli-transcript',
    interactiveLaunch: {
      status: 'documented',
      kind: 'terminal',
      argv: ['codex'],
      preservesOriginal: true,
      semantics: 'Starts an interactive Codex session.',
    },
    resume: {
      status: 'documented',
      kind: 'terminal',
      argv: ['codex', 'resume', '{sessionId}'],
      preservesOriginal: false,
      semantics: 'Continues the selected session.',
    },
    fork: {
      status: 'documented',
      kind: 'terminal',
      argv: ['codex', 'fork', '{sessionId}'],
      preservesOriginal: true,
      semantics:
        'Forks the selected interactive session and opens the new branch.',
    },
    inProviderFork: {
      status: 'documented',
      kind: 'slash-command',
      command: '/fork',
      preservesOriginal: true,
      semantics: 'Branches the currently open chat into a new thread.',
    },
    destinationSwitch: {
      status: 'unsupported',
      reason:
        'The cited Codex source documents current-chat /fork, not replacing a fresh destination chat with a fork of another selected session.',
    },
    crossWorktree: 'unverified',
    evidence: [
      {
        url: 'https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs',
        retrievedOn: RETRIEVED_ON,
        context:
          'Official public source retrieved without executing Codex; ForkCommand accepts an explicit session UUID and launches the interactive TUI.',
      },
      {
        url: 'https://github.com/openai/codex/blob/main/codex-rs/tui/tooltips.txt',
        retrievedOn: RETRIEVED_ON,
        context:
          'Official public source describes /fork as branching the current chat into a new thread.',
      },
    ],
    limitations: [
      'The cited main-branch source is dated evidence rather than a promise for every installed version.',
      'Cross-worktree and ADE visibility behavior has no live proof in this project.',
    ],
  },
  {
    provider: 'cursor',
    surface: 'cli',
    origin: 'cli-transcript',
    interactiveLaunch: {
      status: 'documented',
      kind: 'terminal',
      argv: ['cursor-agent'],
      preservesOriginal: true,
      semantics: 'Starts an interactive Cursor CLI session.',
    },
    resume: {
      status: 'documented',
      kind: 'terminal',
      argv: ['cursor-agent', '--resume={sessionId}'],
      preservesOriginal: false,
      semantics: 'Continues a specific Cursor CLI chat.',
    },
    fork: {
      status: 'unsupported',
      reason:
        'The official Cursor CLI overview documents resume but no documented Cursor CLI fork command.',
    },
    inProviderFork: {
      status: 'unsupported',
      reason:
        'No official Cursor CLI source cited by this matrix documents an interactive fork command.',
    },
    destinationSwitch: {
      status: 'unsupported',
      reason:
        'No official Cursor CLI source cited by this matrix documents switching a fresh session to an arbitrary fork.',
    },
    crossWorktree: 'unsupported',
    evidence: [
      {
        url: 'https://docs.cursor.com/en/cli/overview',
        retrievedOn: RETRIEVED_ON,
        context:
          'Public Cursor CLI overview retrieved without executing Cursor; documents interactive launch and explicit resume only.',
      },
    ],
    limitations: [
      'CLI resume is not fork semantics and must never be substituted for a fork.',
      'IDE transcript discovery does not establish Cursor CLI interoperability.',
    ],
  },
  {
    provider: 'cursor',
    surface: 'ide',
    origin: 'ide-transcript',
    interactiveLaunch: {
      status: 'documented-manual',
      kind: 'manual',
      steps: ['Open Cursor Agent in the IDE side pane.'],
      preservesOriginal: true,
      semantics: 'Opens the Cursor IDE Agent surface.',
    },
    resume: {
      status: 'documented-manual',
      kind: 'manual',
      steps: ['Open chat history.', 'Select the conversation to review.'],
      preservesOriginal: false,
      semantics: 'Opens an existing chat from Cursor IDE history.',
    },
    fork: {
      status: 'documented-manual',
      kind: 'manual',
      steps: [
        'Open the source chat.',
        'Open the message menu at the desired branch point.',
        'Select Duplicate Chat.',
      ],
      preservesOriginal: true,
      semantics:
        'Duplicates context through the selected point into a separate chat.',
    },
    inProviderFork: {
      status: 'documented-manual',
      kind: 'manual',
      steps: ['Use Duplicate Chat from the source message menu.'],
      preservesOriginal: true,
      semantics: 'Creates a separate IDE chat from the current chat history.',
    },
    destinationSwitch: {
      status: 'unsupported',
      reason:
        'Cursor documentation does not establish cross-worktree switching or destination-tab placement for a duplicated chat.',
    },
    crossWorktree: 'unsupported',
    evidence: [
      {
        url: 'https://docs.cursor.com/en/agent/chat/duplicate',
        retrievedOn: RETRIEVED_ON,
        context:
          'Public Cursor IDE documentation retrieved without executing Cursor; describes Duplicate Chat and preservation of the original.',
      },
      {
        url: 'https://docs.cursor.com/en/agent/chat/history',
        retrievedOn: RETRIEVED_ON,
        context:
          'Public Cursor IDE documentation describes opening locally stored chat history.',
      },
    ],
    limitations: [
      'Cursor IDE duplication is a manual UI flow with no documented destination-worktree guarantee.',
      'IDE-origin identity must not be treated as a Cursor CLI session ID.',
    ],
  },
] as const satisfies readonly GuidanceCapability[]);

export function getGuidanceCapability(
  provider: GuidanceProvider,
  surface: GuidanceSurface,
): GuidanceCapability {
  const capability = GUIDANCE_CAPABILITIES.find(
    (candidate) =>
      candidate.provider === provider && candidate.surface === surface,
  );
  if (capability === undefined) throw new Error('unsupported-guidance-surface');
  return capability;
}
