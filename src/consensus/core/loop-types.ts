import type {
  AttemptSummary,
  ProviderDiagnostics,
} from '../provider-cli/types.js';

import type { ConsensusError } from './loop-validation.js';

export type JsonRecord = Record<string, unknown>;

export type IterationMode =
  | 'alternating'
  | 'parallel_revision'
  | 'parallel_synthesized';
export type Agency = 'minimal' | 'moderate' | 'maximum';
export type ColdStartMode = 'shared_input' | 'independent_draft';
export type CostSource = 'provider_cli' | 'estimated' | 'unavailable';

export type AlternatingVerdictValue = 'ACCEPT' | 'REVISE' | 'IMPASSE';
export type ParallelVerdictValue =
  | 'REVISE'
  | 'ACCEPT_PEER'
  | 'CONVERGED'
  | 'IMPASSE';
export type VerdictValue = AlternatingVerdictValue | ParallelVerdictValue;

export interface CritiquePayload {
  own_previous: string;
  peer_previous: string;
}

export interface BaseVerdictPayload extends JsonRecord {
  schema_version: string;
  verdict: VerdictValue;
  reasoning: string;
  concerns?: string[];
}

export interface RevisionVerdictPayload extends BaseVerdictPayload {
  verdict: 'REVISE' | 'ACCEPT_PEER';
  proposed_artifact: string;
  critique?: CritiquePayload;
}

export interface TerminalVerdictPayload extends BaseVerdictPayload {
  verdict: 'ACCEPT' | 'CONVERGED' | 'IMPASSE';
  critique?: CritiquePayload;
}

export type PeerVerdictPayload =
  | RevisionVerdictPayload
  | TerminalVerdictPayload;

export interface SynthesisPayload extends JsonRecord {
  schema_version: string;
  synthesized_artifact: string;
  synthesis_reasoning: string;
  unresolved_disagreements: string[];
}

export type LoopRecordType = 'synthesis' | 'synthesis-error' | string;
export type InterventionVerdict = 'USER_INTERVENTION' | 'HOST_DECISION';

export interface LoopRecord extends JsonRecord {
  schema_version?: string;
  timestamp?: string;
  turn_index?: number;
  round_index?: number;
  agent?: string;
  synthesizer?: string;
  verdict?: VerdictValue | InterventionVerdict | PeerVerdictPayload;
  decision?: string;
  reasoning?: string;
  proposed_artifact?: string;
  synthesized_artifact?: string;
  synthesis_reasoning?: string;
  unresolved_disagreements?: string[];
  critique?: CritiquePayload | JsonRecord;
  concerns?: string[];
  artifact_hash?: string;
  final_artifact_hash?: string;
  artifactHash?: string;
  artifact?: string;
  record_type?: LoopRecordType;
  user_direction?: string;
  decision_kind?: string;
  escalation_trigger?: EscalationTrigger;
  metadata?: JsonRecord;
  code?: string;
  raw_provider_response?: string;
  provider_diagnostics?: ProviderDiagnostics;
  attempts?: AttemptSummary;
}

export interface NormalizeOptions {
  normalizeLineEndings?: boolean;
  trimTrailingWhitespace?: boolean;
  collapseEofNewlines?: boolean;
  finalNewline?: boolean;
}

export interface HashOptions extends NormalizeOptions {
  agency?: Agency;
  hashOptions?: NormalizeOptions;
}

export interface LoopOptions {
  sectionFile: string;
  goal: string;
  peers: string[];
  maxRounds: number;
  iteration: IterationMode;
  coldStart: ColdStartMode;
  agency: Agency;
  synthesizer: string | null;
  outputRecords: string;
  outputSection: string;
  outputStatus: string;
  initialRecords?: LoopRecord[];
  initialArtifact?: string;
  userDirection?: string;
  hostDirection?: string;
  hostDecisionKind?: string;
  escalationTrigger?: EscalationTrigger | null;
}

export interface RunOptions {
  initialRecords?: LoopRecord[];
  initialArtifact?: string;
  userDirection?: string;
  hostDirection?: string;
  hostDecisionKind?: string;
  escalationTrigger?: EscalationTrigger | null;
  promptProfile?: PromptProfile;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  now?: () => string;
  invokePeer?: PeerInvoker;
  invokeSynthesizer?: SynthesizerInvoker;
}

export interface Intervention {
  agent: 'user' | 'host-orchestrator';
  direction: string;
  decisionKind?: string;
  escalationTrigger?: EscalationTrigger | null;
}

export interface LoopStatus extends JsonRecord {
  status: string;
  termination_reason?: string | null;
  turns?: number;
  rounds?: number;
  final_artifact_hash?: string;
  artifact_hash?: string;
  cost_source?: CostSource | string;
  cost_usd?: number;
  approximate_cost_usd?: number;
  cost?: {
    source?: CostSource | string;
    usd?: number;
  };
}

export interface RecordsWriter {
  path: string;
  append(record: LoopRecord): Promise<LoopRecord>;
  close(): Promise<void>;
}

export type TerminalStatus = LoopStatus;

export interface ProviderInvocationArgs {
  provider: string;
  schemaPath: string;
  prompt: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  consensusCliPath?: string;
  runCommand?: ProviderCliCommandRunner;
}

export interface ProviderResult {
  provider?: string;
  args?: string[];
  stdout?: string;
  stderr?: string;
  json: unknown;
  raw_provider_response?: string;
  provider_diagnostics?: ProviderDiagnostics;
  attempts?: AttemptSummary;
}

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  invoke?: (args: ProviderInvocationArgs) => Promise<ProviderResult>;
  mode?: IterationMode;
}

export interface ProviderCliCommandRunnerOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  input?: string;
  /**
   * Optional deadline in milliseconds. When set, an unresponsive subprocess is
   * sent SIGTERM at the deadline and escalated to SIGKILL after
   * PROVIDER_CLI_KILL_GRACE_MS. When unset, behavior is unchanged (no deadline).
   */
  timeoutMs?: number;
}

export interface ProviderCliCommandRunnerResult {
  code: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr?: string;
  /** True when the process was killed after timeoutMs elapsed. */
  timedOut?: boolean;
}

export type ProviderCliCommandRunner = (
  command: string,
  args: string[],
  options: ProviderCliCommandRunnerOptions,
) => Promise<ProviderCliCommandRunnerResult>;

export type ConsensusCliResolutionSource =
  | 'explicit'
  | 'env'
  | 'plugin'
  | 'shared-home';

export type ConsensusCliResolution =
  | {
      status: 'resolved';
      source: ConsensusCliResolutionSource;
      path: string;
    }
  | {
      status: 'missing';
      attemptedPaths: string[];
    };

export interface ConsensusCliPathOptions extends Pick<
  ProviderInvocationArgs,
  'consensusCliPath' | 'env'
> {
  defaultCliPath?: string;
}

export interface PeerInvocation {
  provider: string;
  schemaPath?: string;
  prompt: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  peerIndex?: number;
  round?: number;
  turn?: number;
  artifact?: string;
}

export type PeerInvoker = (turn: PeerInvocation) => Promise<ProviderResult>;

export type SynthesizerInvocation = ProviderInvocationArgs & {
  round: number;
};

export type SynthesizerInvoker = (
  call: SynthesizerInvocation,
) => Promise<ProviderResult>;

export interface ParallelTurnPromptInput {
  provider: string;
  mode?: IterationMode;
  coldStart?: ColdStartMode;
  round: number;
  turn: number;
  goal: string;
  artifact: string;
  ownPreviousRevision?: string | null;
  peerPreviousRevision?: string | null;
  ownPreviousCritique?: CritiquePayload | JsonRecord | null;
  peerPreviousCritique?: CritiquePayload | JsonRecord | null;
}

export interface SynthesisPromptInput {
  provider: string;
  round: number;
  goal: string;
  revisionA: { agent?: string | null; text?: string | null };
  revisionB: { agent?: string | null; text?: string | null };
  critiqueA?: CritiquePayload | JsonRecord | null;
  critiqueB?: CritiquePayload | JsonRecord | null;
  priorUnresolved?: string[];
}

export interface TurnPromptInput {
  provider: string;
  peerIndex?: number;
  coldStart?: ColdStartMode;
  round: number;
  turn: number;
  goal: string;
  artifact: string;
  previousVerdict?: JsonRecord | null;
  priorRecords?: LoopRecord[];
}

export type TurnPromptBuilder = (input: TurnPromptInput) => string;
export type ParallelTurnPromptBuilder = (
  input: ParallelTurnPromptInput,
) => string;
export type SynthesisPromptBuilder = (input: SynthesisPromptInput) => string;

export interface PromptProfile {
  buildTurnPrompt?: TurnPromptBuilder;
  buildParallelTurnPrompt?: ParallelTurnPromptBuilder;
  buildSynthesisPrompt?: SynthesisPromptBuilder;
}

export interface ResolvedPromptProfile {
  buildTurnPrompt: TurnPromptBuilder;
  buildParallelTurnPrompt: ParallelTurnPromptBuilder;
  buildSynthesisPrompt: SynthesisPromptBuilder;
}

export interface BaseRoundContext {
  mode?: IterationMode;
  options: LoopOptions;
  records: LoopRecord[];
  currentArtifact: string;
  invokePeer: PeerInvoker;
  invokeSynthesizer?: SynthesizerInvoker;
  prompts?: ResolvedPromptProfile;
}

export interface AlternatingTurnContext extends BaseRoundContext {
  turnIndex: number;
}

export interface AlternatingTurnResult {
  verdict: PeerVerdictPayload;
  recordPayload: LoopRecord;
  nextArtifact: string;
}

export interface ParallelRoundResult {
  records: LoopRecord[];
  nextArtifact: string;
  verdicts: unknown[];
  synthesis?: LoopRecord;
  synthesisError?: SynthesisErrorResult;
}

export interface SynthesisErrorResult {
  record: LoopRecord;
  error: ConsensusError;
}

export type SynthesisResult =
  | { synthesis: LoopRecord; nextArtifact: string; synthesisError?: undefined }
  | {
      synthesisError: SynthesisErrorResult;
      synthesis?: undefined;
      nextArtifact?: undefined;
    };

export type EscalationTrigger =
  | 'persistent_disagreement'
  | 'oscillation'
  | 'budget_exhausted'
  | 'near_done_drift';
export type DecideVia = 'auto' | 'host' | 'user';

export interface EscalationDetection extends JsonRecord {
  trigger: EscalationTrigger;
  divergent?: JsonRecord;
}

export interface EscalationRoute extends JsonRecord {
  trigger: EscalationTrigger;
  agency: Agency;
  decide_via: DecideVia;
  decision_kinds: string[];
  promoted_from?: 'host';
  promotion_reason?: 'defer_to_user' | 'repeat_fire';
  auto_resolution?: 'declare_done' | 'near_match';
}

export interface ConvergenceResult extends JsonRecord {
  converged: boolean;
  reason: string | null;
  record_indexes?: number[];
  synthesis_round?: number;
  artifact_hash?: string | null;
  agency_decision?: string;
}

export interface OscillationResult extends JsonRecord {
  oscillating: boolean;
  reason: string | null;
  record_indexes?: number[];
  round_indexes?: number[];
  hashes?: (string | null)[];
  pairs?: (string | null)[];
}

export interface ConsensusErrorOptions {
  cause?: unknown;
  code?: string;
  exitCode?: number;
  details?: unknown;
}

export interface ErrorLike {
  name?: string;
  message?: string;
  code?: string;
  exitCode?: number;
  path?: string;
  syscall?: string;
}

export type ValidationResult = {
  ok: boolean;
  errors?: string[];
  metadata?: JsonRecord;
};
