import type {
  ITERATION_MODES,
  runConsensusLoop,
} from '../core/consensus-loop.js';

export type JsonRecord = Record<string, unknown>;
export type IterationModeValue = (typeof ITERATION_MODES)[number];
export type AgencyValue = 'minimal' | 'moderate' | 'maximum';
export type ColdStartValue = 'shared_input' | 'independent_draft';
export type WrapperMode = 'sequential' | 'prepare_parallel' | 'fan_in';
export type HostId = 'claude' | 'codex' | 'cursor' | 'unknown';
export type LoopRunOptions = NonNullable<
  Parameters<typeof runConsensusLoop>[1]
>;
export type LoopPeerInvoker = NonNullable<LoopRunOptions['invokePeer']>;
export type LoopSynthesizerInvoker = NonNullable<
  LoopRunOptions['invokeSynthesizer']
>;
export type LoopInitialRecords = NonNullable<LoopRunOptions['initialRecords']>;
export type LoopEscalationTrigger = NonNullable<
  LoopRunOptions['escalationTrigger']
>;
export type JsonlWritable = Pick<NodeJS.WritableStream, 'write'>;

export interface ErrorLike {
  code?: string;
  details?: unknown;
  message?: string;
  stack?: string;
}

export interface AnnotatedError extends Error {
  code?: string;
  cleanupError?: unknown;
}

export interface JsonBlockParseResult {
  ok: true;
  value: unknown;
}

export interface JsonBlockParseFailure {
  ok: false;
  error: ResumeValidationError;
}

export type TryJsonBlockResult = JsonBlockParseResult | JsonBlockParseFailure;

export interface ResumeValidationError extends JsonRecord {
  code: string;
  message: string;
  section_id?: string;
  section_name?: string;
  section_index?: number;
  block_label?: string;
  block_index?: number;
}

export interface ConsensusRecord extends JsonRecord {
  schema_version?: string;
  timestamp?: string;
  record_type?: string;
  agent?: string;
  provider?: string;
  synthesizer?: string;
  verdict?: string | JsonRecord;
  decision?: string;
  reasoning?: string;
  proposed_artifact?: string;
  synthesized_artifact?: string;
  synthesis_reasoning?: string;
  unresolved_disagreements?: string[];
  critique?: unknown;
  concerns?: unknown[];
  artifact_hash?: string;
  user_direction?: string;
  decision_kind?: string;
  escalation_trigger?: string;
  round_index?: number;
  round?: number;
  turn_index?: number;
  code?: string;
  metadata?: unknown;
}

export interface EscalationRoute extends JsonRecord {
  trigger: string;
  decide_via: string;
  decision_kinds?: string[];
  divergent?: {
    a?: { agent?: string | null; text?: string };
    b?: { agent?: string | null; text?: string };
    synthesis?: {
      text?: string;
      unresolved_disagreements?: string[];
    };
  };
  promoted_from?: string;
}

export interface SectionStatus extends JsonRecord {
  status?: string;
  termination_reason?: string | null;
  turns?: number;
  rounds?: number;
  final_artifact_hash?: string | null;
  artifact_hash?: string | null;
  peer_calls?: number;
  synthesis_calls?: number;
  escalation?: EscalationRoute;
  error?: string;
}

export interface SectionPaths {
  input: string;
  records: string;
  output: string;
  status: string;
  packet?: string;
}

export interface ParsedSection extends JsonRecord {
  id: string;
  name: string;
  original_index: number;
  start_line?: number;
  end_line?: number;
  markdown: string;
}

export interface SectionResult extends JsonRecord {
  id: string;
  name: string;
  original_index: number;
  subagent_id?: string | null;
  markdown?: string;
  output?: string | null;
  result?: { output?: string; status?: SectionStatus };
  status?: SectionStatus | null;
  records?: ConsensusRecord[];
  paths?: SectionPaths;
  completed?: boolean;
  inFlight?: boolean;
  skipped?: boolean;
  corruptErrors?: ResumeValidationError[];
  resumedArtifact?: string | null;
  resumedArtifactHash?: string | null;
  resumedArtifactSource?: string | null;
}

export interface ArtifactSectionCounts extends JsonRecord {
  total: number;
  converged: number;
  impasse: number;
  escalation: number;
  max_rounds: number;
  oscillation: number;
  error: number;
}

export interface ArtifactResolution extends JsonRecord {
  consensus_schema_version: 'v1';
  status: string;
  mode: string;
  parallel: boolean;
  iteration: string;
  synthesizer: string | null;
  cold_start: string;
  agency?: AgencyValue;
  peers: string[];
  host: HostId;
  max_rounds?: number;
  sections: ArtifactSectionCounts;
  total_rounds: number;
  total_turns: number;
  peer_calls: number;
  synthesis_calls: number;
  wall_clock_ms: number | null;
  cost_source: 'unavailable';
  approximate_cost_usd: null;
  input_path: string | null;
  run_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  subagent_ids: string[];
}

export interface WrapperRunResult extends JsonRecord {
  mode: string;
  parallel: boolean;
  inputPath?: string | null;
  outputPath?: string | null;
  resumePath?: string | null;
  resumeState?: ResumeState | null;
  runDir?: string | null;
  manifestPath?: string | null;
  runId?: string | null;
  goal: string;
  peers: string[];
  host: HostId;
  agency?: AgencyValue;
  iteration?: IterationModeValue;
  synthesizer?: string | null;
  coldStart?: ColdStartValue;
  maxRounds?: number;
  startedAt?: string | null;
  endedAt?: string | null;
  wallClockMs?: number | null;
  status?: string;
  sections: SectionResult[];
}

export interface ResumeLogSection {
  status: SectionStatus | null;
  records: ConsensusRecord[];
  errors: ResumeValidationError[];
}

export interface ResumeState {
  sourcePath: string | null;
  consensusSchemaVersion: unknown;
  frontmatter: JsonRecord;
  resolution: JsonRecord;
  sectionStates: unknown[];
  sections: SectionResult[];
  completedSections: SectionResult[];
  inFlightSections: SectionResult[];
  skippedCorruptSections: SectionResult[];
  resumeErrors: ResumeValidationError[];
  resumeErrorsPath: string | null;
}

export interface ProviderInventoryEntry extends JsonRecord {
  id?: string;
  name?: string;
  provider?: string;
  available?: boolean;
  enabled?: boolean | string;
  status?: string;
}

export interface NormalizedProviderInventoryEntry extends ProviderInventoryEntry {
  id: string;
  available: boolean;
}

export type ProviderInventoryInput = unknown;

export interface PreflightResult extends JsonRecord {
  ok?: boolean;
  version?: string;
  providerInventory?: NormalizedProviderInventoryEntry[];
  host?: HostId;
  peers: string[];
  warnings: JsonRecord[];
}

export interface CommandRunnerResult {
  stdout: string;
  stderr?: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; cwd?: string },
) => Promise<CommandRunnerResult>;

export interface WrapperOptions extends JsonRecord {
  mode?: WrapperMode;
  inputPath?: string | null;
  goal?: string;
  peers?: string[] | null;
  maxRounds?: number;
  agency?: AgencyValue;
  iteration?: IterationModeValue;
  synthesizer?: string | null;
  coldStart?: ColdStartValue;
  output?: string | null;
  resume?: string | null;
  userDirection?: string | null;
  hostDirection?: string | null;
  hostDecisionKind?: string | null;
  runDir?: string | null;
  allowRoot?: string | null;
  failOnSectionError?: boolean;
  skipCorruptSections?: string[];
  skipAllCorrupt?: boolean;
  yesSkipCorrupt?: boolean;
  prepareParallel?: boolean;
  parallelism?: number | null;
  fanIn?: boolean;
  manifestPath?: string | null;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  preflight?: false | ((options: WrapperOptions) => Promise<PreflightResult>);
  providerInventory?: ProviderInventoryInput;
  invokePeer?: LoopPeerInvoker;
  invokeSynthesizer?: LoopSynthesizerInvoker;
  runCommand?: CommandRunner;
  sizeCapBytes?: number;
}

export interface ParsedWrapperOptions extends WrapperOptions {
  mode: WrapperMode;
  inputPath: string | null;
  goal: string;
  peers: string[] | null;
  maxRounds: number;
  agency: AgencyValue;
  iteration: IterationModeValue;
  synthesizer: string | null;
  coldStart: ColdStartValue;
  output: string | null;
  resume: string | null;
  userDirection: string | null;
  hostDirection: string | null;
  hostDecisionKind: string | null;
  runDir: string | null;
  allowRoot: string | null;
  failOnSectionError: boolean;
  skipCorruptSections: string[];
  skipAllCorrupt: boolean;
  yesSkipCorrupt: boolean;
  prepareParallel: boolean;
  parallelism: number | null;
  fanIn: boolean;
  manifestPath: string | null;
}

export interface WrapperRunOptions extends JsonRecord {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  invokePeer?: LoopPeerInvoker;
  invokeSynthesizer?: LoopSynthesizerInvoker;
  preflight?: WrapperOptions['preflight'];
}

export interface ParallelManifestEntry extends JsonRecord {
  section_id: string;
  name: string;
  original_index: number;
  packet_path: string;
  section_file: string;
  output_records: string;
  output_section: string;
  output_status: string;
  subagent_id: string;
  iteration_mode?: IterationModeValue;
  synthesizer?: string | null;
  loop_argv?: string[];
}

export interface ParallelManifest extends JsonRecord {
  consensus_schema_version: 'v1';
  manifest_type: 'consensus-parallel-run';
  mode: 'parallel';
  status?: string;
  input_path: string;
  output_path: string;
  output_write_root?: string;
  run_dir: string;
  manifest_path?: string;
  goal: string;
  peers: string[];
  host: HostId;
  max_rounds: number;
  agency: AgencyValue;
  iteration_mode: IterationModeValue;
  synthesizer?: string | null;
  parallelism: number;
  sections: ParallelManifestEntry[];
}

export interface LoopInvocationPayload {
  section: ParsedSection;
  paths: SectionPaths;
  options: ParsedWrapperOptions;
  peers: string[];
  synthesizer?: string | null;
}
