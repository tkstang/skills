// ACP session driver over stdio: initialize, optional authenticate,
// session/new, the read-only setup steps the session plan asks for (each
// confirmed before the prompt), session/prompt, then session/close where
// advertised and a process-group teardown on every exit path. A deadline,
// output cap or interrupt sends session/cancel when a prompt is in flight,
// waits briefly, then tears down the same way.
//
// Per-agent differences are plain data in AcpSessionPlan; this module has
// no provider branches.
import { realpathSync } from 'node:fs';
import path from 'node:path';

import type { JsonRpcOutcome } from './jsonrpc.js';
import { isRecord, JsonRpcConnection } from './jsonrpc.js';
import type {
  ForwardedSignal,
  GroupTeardown,
  ProcessGroupHandle,
  SpawnProcessGroup,
} from './process.js';
import { spawnProcessGroup, withTimeout } from './process.js';
import {
  ACP_CLIENT_CAPABILITIES,
  denyPermissionRequest,
  methodNotFound,
  realExistingPath,
} from './responder.js';
import type {
  AcpAbortReason,
  AcpSetupEvidence,
  AcpTurnError,
  AcpTurnResult,
} from './transcript.js';
import {
  emptyTurnResult,
  redactText,
  sanitizeTurnResult,
} from './transcript.js';

export const ACP_PROTOCOL_VERSION = 1;

// How a mode change is confirmed. Any enabled kind of evidence confirms it;
// a current_mode_update naming another mode always fails it.
export interface AcpModeConfirmation {
  // session/new already reports the mode, and no mode report before
  // set_mode disagrees (agy sends no echo for set_mode).
  initialState?: boolean;
  // A current_mode_update naming the mode.
  currentModeUpdate?: boolean;
  // A config_option_update whose option with this id has the mode as its
  // currentValue (Droid's autonomy_level).
  configOptionId?: string;
  // An agent_message_chunk whose text is exactly this (Gemini's
  // "[MODE_UPDATE] plan"). It arrives before the prompt, so it never
  // reaches the answer text.
  marker?: string;
}

export interface AcpModeStep {
  modeId: string;
  confirm: AcpModeConfirmation;
}

export interface AcpConfigOptionStep {
  configId: string;
  value: string;
  // The value must be among the option's advertised values, else the run
  // stops before setting it.
  requireAdvertised?: boolean;
}

export interface AcpSessionPlan {
  clientInfo: { name: string; version: string };
  authenticate?: { methodId: string };
  mode?: AcpModeStep;
  configOptions?: readonly AcpConfigOptionStep[];
  // session/new must report this models.currentModelId (a model chosen by
  // a launch flag, as with Gemini's -m).
  expectCurrentModel?: string;
  // Lines placed before the caller's prompt.
  briefLines?: readonly string[];
  // Redacted from error text and stderr in addition to the defaults.
  redactions?: readonly RegExp[];
  // Env names whose values are redacted from error text and stderr.
  credentialEnv?: readonly string[];
}

export interface AcpTiming {
  // Wait for a session/prompt response after session/cancel.
  cancelGraceMs: number;
  // Wait for the session/close response.
  closeTimeoutMs: number;
  // Wait for the agent to exit after stdin closes.
  exitGraceMs: number;
  // First signal to SIGKILL.
  killGraceMs: number;
  // Bound on waiting for the group after SIGKILL.
  settleMs: number;
}

export const DEFAULT_ACP_TIMING: AcpTiming = {
  cancelGraceMs: 1500,
  closeTimeoutMs: 1000,
  exitGraceMs: 2000,
  killGraceMs: 500,
  settleMs: 1000,
};

const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_REFUSED_METHODS = 20;
const MAX_META_CHARS = 200;
const ADVERTISED_SAMPLE = 5;
// Distinct session ids whose early updates are kept before session/new.
const MAX_EARLY_SESSIONS = 4;

export interface AcpRunInput {
  executable: string;
  argv: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  prompt: string;
  plan: AcpSessionPlan;
  timeoutMs: number;
  maxOutputBytes?: number;
  maxStderrBytes?: number;
  timing?: Partial<AcpTiming>;
  // The spawn-group primitive; tests may substitute their own.
  spawn?: SpawnProcessGroup;
}

export interface AcpRunOutcome {
  result: AcpTurnResult;
  // Capped and redacted.
  stderr: string;
  exit_code: number | null;
  signal: string | null;
  teardown?: GroupTeardown;
  output_bytes: { stdout: number; stderr: number; max: number };
}

// The seam for an alternative backend (for example acpx): anything that
// turns one prompt into an AcpRunOutcome.
export interface AcpTransport {
  run(input: AcpRunInput): Promise<AcpRunOutcome>;
}

export const stdioAcpTransport: AcpTransport = { run: runAcpTurn };

type Aborted = { kind: 'aborted' };

export async function runAcpTurn(input: AcpRunInput): Promise<AcpRunOutcome> {
  const timing = { ...DEFAULT_ACP_TIMING, ...input.timing };
  const maxOutputBytes = input.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const secretValues = (input.plan.credentialEnv ?? [])
    .map((name) => input.env?.[name])
    .filter((value): value is string => typeof value === 'string');
  const redaction = { patterns: input.plan.redactions, secretValues };
  const redact = (text: string) => redactText(text, redaction);
  const result = emptyTurnResult();

  let abortReason: AcpAbortReason | undefined;
  let interruptSignal: ForwardedSignal | undefined;
  let resolveAbort!: (value: Aborted) => void;
  const aborted = new Promise<Aborted>((resolve) => {
    resolveAbort = resolve;
  });
  const abort = (reason: AcpAbortReason) => {
    if (abortReason) return;
    abortReason = reason;
    resolveAbort({ kind: 'aborted' });
  };
  // An exception in the client itself (a failed stdin write, a bug): the
  // run stops waiting and goes straight to teardown.
  const clientFailure = (error: unknown) => {
    if (!result.error) {
      result.error = {
        phase: result.phase,
        kind: 'client_error',
        message: redact(error instanceof Error ? error.message : String(error)),
      };
    }
    resolveAbort({ kind: 'aborted' });
  };

  // A mode change after the read-only mode was confirmed: before the
  // prompt it stops the run; during the turn it cancels the turn.
  const session = new SessionState(result, redact, () => {
    if (result.prompt_sent) abort('mode_changed');
  });
  // Set once spawned; nothing is written before that.
  const io: { group?: ProcessGroupHandle } = {};
  const connection = new JsonRpcConnection({
    write: (line) => {
      try {
        io.group?.write(line);
      } catch (error) {
        clientFailure(error);
      }
    },
    onRequest: (request) => {
      if (request.method === 'session/request_permission') {
        const { response, denial } = denyPermissionRequest(request.params, {
          cancelled: result.cancel_sent === true,
          redact,
        });
        result.denials.push(denial);
        return { result: response };
      }
      if (
        !result.refused_methods.includes(request.method) &&
        result.refused_methods.length < MAX_REFUSED_METHODS
      ) {
        result.refused_methods.push(clip(redact(request.method)));
      }
      return { error: methodNotFound(request.method) };
    },
    onNotification: (method, params) => session.notification(method, params),
  });

  const spawned = await (input.spawn ?? spawnProcessGroup)({
    executable: input.executable,
    argv: input.argv,
    cwd: input.cwd,
    env: input.env,
    maxOutputBytes,
    maxStderrBytes: input.maxStderrBytes,
    timeoutMs: input.timeoutMs,
    onLine: (line) => connection.receiveLine(line),
    onStdoutEnd: () => connection.close(),
    onTimeout: () => abort('timeout'),
    onOutputCap: () => abort('output_cap'),
    onInterrupt: (signal) => {
      interruptSignal = signal;
      abort('interrupt');
    },
  });
  if (!spawned.ok) {
    result.error = {
      phase: 'spawn',
      kind: 'spawn',
      message: redact(spawned.message),
      ...(spawned.errno ? { errno: spawned.errno } : {}),
    };
    return {
      result,
      stderr: '',
      exit_code: null,
      signal: null,
      output_bytes: { stdout: 0, stderr: 0, max: maxOutputBytes },
    };
  }
  const group: ProcessGroupHandle = spawned.handle;
  io.group = group;

  const call = (method: string, params: unknown) =>
    Promise.race([connection.request(method, params).outcome, aborted]);

  let promptOutcome: Promise<JsonRpcOutcome> | undefined;
  let teardown: GroupTeardown | undefined;
  // The process group is torn down whatever driving or closing the session
  // throws; the run then reports the failure instead of rejecting.
  try {
    await drive();
  } catch (error) {
    clientFailure(error);
  }
  try {
    await finish();
  } catch (error) {
    clientFailure(error);
  } finally {
    await tearDownGroup();
  }

  const exit = group.hasExited() ? await group.exit : undefined;
  return finalize();

  async function drive() {
    result.phase = 'initialize';
    const initialized = await call('initialize', {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: ACP_CLIENT_CAPABILITIES,
      clientInfo: input.plan.clientInfo,
    });
    const init = expectResult(initialized, 'initialize');
    if (!init) return;
    session.initialized(init);
    if (init.protocolVersion !== ACP_PROTOCOL_VERSION) {
      fail(
        'malformed',
        `unsupported ACP protocol version ${String(init.protocolVersion)}`,
      );
      return;
    }

    if (input.plan.authenticate) {
      result.phase = 'authenticate';
      const authenticated = await call('authenticate', {
        methodId: input.plan.authenticate.methodId,
      });
      if (!expectResult(authenticated, 'authenticate')) return;
    }

    result.phase = 'session_new';
    const created = await call('session/new', {
      cwd: input.cwd,
      mcpServers: [],
    });
    const newSession = expectResult(created, 'session/new');
    if (!newSession) return;
    if (
      typeof newSession.sessionId !== 'string' ||
      newSession.sessionId === ''
    ) {
      fail('malformed', 'session/new returned no sessionId');
      return;
    }
    session.created(newSession);

    result.phase = 'setup';
    if (!(await setup())) return;

    // The latest reported mode, checked right before the prompt goes out.
    const drift = session.modeDrift();
    if (drift !== undefined) {
      fail(
        'unconfirmed_setup',
        `the agent left mode ${input.plan.mode?.modeId} (now ${drift}) before the prompt`,
      );
      return;
    }
    result.phase = 'prompt';
    const text = [...(input.plan.briefLines ?? []), input.prompt].join('\n\n');
    result.prompt_sent = true;
    session.promptStarted();
    const prompt = connection.request('session/prompt', {
      sessionId: result.session_id,
      prompt: [{ type: 'text', text }],
    });
    promptOutcome = prompt.outcome;
    const answered = await Promise.race([prompt.outcome, aborted]);
    const response = expectResult(answered, 'session/prompt');
    if (!response) return;
    session.promptAnswered(response);
    result.phase = 'complete';
  }

  async function setup() {
    const expected = input.plan.expectCurrentModel;
    if (expected !== undefined) {
      const current = result.models.current_model_id;
      const confirmed = current === expected;
      result.setup.push({
        step: 'model_state',
        id: 'currentModelId',
        value: expected,
        confirmed,
        ...(confirmed ? { evidence: 'session_state' as const } : {}),
      });
      if (!confirmed) {
        fail(
          'unconfirmed_setup',
          `the session started with model ${current ?? 'unknown'}, not ${expected}`,
        );
        return false;
      }
    }

    const mode = input.plan.mode;
    if (mode) {
      session.watchMode(mode);
      const set = await call('session/set_mode', {
        sessionId: result.session_id,
        modeId: mode.modeId,
      });
      if (!expectResult(set, 'session/set_mode')) return false;
      const evidence = session.modeEvidence();
      result.setup.push({
        step: 'mode',
        id: 'mode',
        value: mode.modeId,
        confirmed: evidence !== undefined,
        ...(evidence ? { evidence } : {}),
      });
      if (!evidence) {
        fail('unconfirmed_setup', `mode ${mode.modeId} was not confirmed`);
        return false;
      }
      session.holdMode(mode);
    }

    for (const step of input.plan.configOptions ?? []) {
      const advertised = session.optionValues(step.configId);
      if (advertised === undefined) {
        fail(
          'unsupported_option',
          `${agentLabel()} does not advertise the config option ${step.configId}`,
        );
        return false;
      }
      if (step.requireAdvertised && !advertised.includes(step.value)) {
        const sample = advertised.slice(0, ADVERTISED_SAMPLE).join(', ');
        fail(
          'unsupported_option',
          `${step.configId} ${step.value} is not offered by ${agentLabel()} (offered: ${sample}${advertised.length > ADVERTISED_SAMPLE ? ', …' : ''})`,
        );
        return false;
      }
      const set = await call('session/set_config_option', {
        sessionId: result.session_id,
        configId: step.configId,
        value: step.value,
      });
      const response = expectResult(set, 'session/set_config_option');
      if (!response) return false;
      // Confirmed from the response, not from an echo (agy's echo is
      // unreliable).
      const current = currentValueOf(response.configOptions, step.configId);
      session.configOptionsSeen(response.configOptions);
      const confirmed = current === step.value;
      result.setup.push({
        step: 'config_option',
        id: step.configId,
        value: step.value,
        confirmed,
        ...(confirmed ? { evidence: 'response' as const } : {}),
      });
      if (!confirmed) {
        fail(
          'unconfirmed_setup',
          `${step.configId} is ${current ?? 'unset'} after setting ${step.value}`,
        );
        return false;
      }
    }
    return true;
  }

  async function finish() {
    const promptInFlight =
      result.prompt_sent && result.stop_reason === undefined && !result.error;
    if (abortReason && promptInFlight && !connection.isClosed()) {
      result.cancel_sent = true;
      connection.notify('session/cancel', { sessionId: result.session_id });
      // Line delivery stops at the output cap, so no reply can be read.
      if (
        (abortReason === 'timeout' || abortReason === 'mode_changed') &&
        promptOutcome
      ) {
        const late = await withTimeout(promptOutcome, timing.cancelGraceMs);
        if (late !== 'timeout' && late.kind === 'result') {
          session.promptAnswered(late.result);
        }
      }
    }
    if (
      result.session_id &&
      session.closeAdvertised() &&
      !connection.isClosed() &&
      abortReason !== 'output_cap'
    ) {
      const closed = await withTimeout(
        connection.request('session/close', { sessionId: result.session_id })
          .outcome,
        timing.closeTimeoutMs,
      );
      result.session_closed = closed !== 'timeout' && closed.kind === 'result';
    }
  }

  async function tearDownGroup() {
    try {
      teardown = await group.teardown({
        exitGraceMs: timing.exitGraceMs,
        killGraceMs: timing.killGraceMs,
        settleMs: timing.settleMs,
        firstSignal: interruptSignal ?? 'SIGTERM',
        waitForExit: abortReason !== 'interrupt',
      });
    } catch (error) {
      clientFailure(error);
      killGroupNow(group.pid);
    } finally {
      connection.close();
    }
  }

  function finalize(): AcpRunOutcome {
    if (abortReason) result.abort = abortReason;
    // Once the agent leaves read-only mode, none of the turn's text is
    // returned as an answer.
    if (abortReason === 'mode_changed') result.text = '';
    result.denials = result.denials.map((denial) =>
      denial.path
        ? { ...denial, path: displayPath(denial.path, input.cwd, redact) }
        : denial,
    );
    const ignored = connection.stats().ignored_lines;
    if (ignored > 0) result.ignored_lines = ignored;
    const outcome: AcpRunOutcome = {
      result: sanitizeTurnResult(result, redaction),
      stderr: redact(group.stderr()),
      exit_code: exit?.code ?? null,
      signal: exit?.signal ?? null,
      ...(teardown ? { teardown } : {}),
      output_bytes: group.outputBytes(),
    };
    queueMicrotask(() => group.reraiseInterrupt());
    return outcome;
  }

  function expectResult(
    outcome: JsonRpcOutcome | Aborted,
    method: string,
  ): Record<string, unknown> | undefined {
    if (outcome.kind === 'aborted') return undefined;
    if (outcome.kind === 'closed') {
      fail(
        'agent_exit',
        `the agent closed the connection before answering ${method}`,
      );
      return undefined;
    }
    if (outcome.kind === 'error') {
      fail(
        'jsonrpc',
        `${method} failed: ${outcome.error.message || 'no message'} (${outcome.error.code})`,
        outcome.error.code,
      );
      return undefined;
    }
    if (!isRecord(outcome.result)) {
      fail('malformed', `${method} returned a non-object result`);
      return undefined;
    }
    return outcome.result;
  }

  function fail(kind: AcpTurnError['kind'], message: string, code?: number) {
    if (result.error) return;
    result.error = {
      phase: result.phase,
      kind,
      ...(code !== undefined ? { code } : {}),
      message: redact(message),
    };
  }

  function agentLabel() {
    return result.agent?.name ?? 'the agent';
  }
}

// Session facts gathered from responses and notifications.
class SessionState {
  private closeCapability = false;
  private configOptions: unknown;
  private modeWatch:
    | {
        step: AcpModeStep;
        initial?: string;
        echoed?: AcpSetupEvidence['evidence'];
        contrary: boolean;
      }
    | undefined;
  // The confirmed read-only mode, watched until the session ends.
  private held: { step: AcpModeStep; drift?: string } | undefined;
  private promptActive = false;
  // The starting mode: session/new's report, unless a mode report before
  // the watch began disagrees with it (initialConflict).
  private initialMode: string | undefined;
  private initialConflict = false;
  // Mode and option updates that arrived before the session/new response
  // was handled (in the same stdout chunk, or earlier): the latest of each
  // kind per session id, replayed once the session id is known.
  private readonly early = new Map<string, Map<string, unknown>>();

  constructor(
    private readonly result: AcpTurnResult,
    private readonly redact: (text: string) => string,
    private readonly onModeDrift: () => void = () => {},
  ) {}

  // Agent-reported strings are redacted before they are shortened, so a
  // clip never leaves part of a secret behind.
  private keep(value: string) {
    return clip(this.redact(value));
  }

  initialized(init: Record<string, unknown>) {
    const info = isRecord(init.agentInfo) ? init.agentInfo : {};
    const agent: NonNullable<AcpTurnResult['agent']> = {};
    for (const key of ['name', 'title', 'version'] as const) {
      if (typeof info[key] === 'string') agent[key] = this.keep(info[key]);
    }
    if (Object.keys(agent).length > 0) this.result.agent = agent;
    const capabilities = isRecord(init.agentCapabilities)
      ? init.agentCapabilities
      : {};
    const sessionCapabilities =
      capabilities.sessionCapabilities ?? capabilities.session_capabilities;
    this.closeCapability =
      isRecord(sessionCapabilities) && sessionCapabilities.close != null;
  }

  closeAdvertised() {
    return this.closeCapability;
  }

  created(response: Record<string, unknown>) {
    this.result.session_id = this.keep(response.sessionId as string);
    const models = isRecord(response.models) ? response.models : {};
    if (typeof models.currentModelId === 'string') {
      this.result.models.current_model_id = this.keep(models.currentModelId);
    }
    const modes = isRecord(response.modes) ? response.modes : {};
    this.initialMode =
      typeof modes.currentModeId === 'string' ? modes.currentModeId : undefined;
    this.configOptionsSeen(response.configOptions);
    const early = this.early.get(response.sessionId as string);
    this.early.clear();
    for (const params of early?.values() ?? []) {
      this.notification('session/update', params);
    }
  }

  configOptionsSeen(options: unknown) {
    if (!Array.isArray(options)) return;
    this.configOptions = options;
    const model = currentValueOf(options, 'model');
    if (model !== undefined) this.result.models.config_model = this.keep(model);
    const watch = this.modeWatch;
    const optionId = watch?.step.confirm.configOptionId;
    if (watch && optionId) {
      const value = currentValueOf(options, optionId);
      if (value === watch.step.modeId) watch.echoed ??= 'config_option_update';
    }
    // While the mode is being confirmed, and after, any mode option naming
    // another mode counts against it.
    const step = watch?.step ?? this.held?.step;
    if (!step) return;
    for (const value of modeOptionValues(options, step)) {
      if (value === step.modeId) continue;
      if (watch) watch.contrary = true;
      else this.drifted(value);
    }
  }

  holdMode(step: AcpModeStep) {
    this.held = { step };
  }

  modeDrift(): string | undefined {
    return this.held?.drift;
  }

  private drifted(mode: string) {
    const held = this.held;
    if (!held || held.drift !== undefined) return;
    held.drift = this.keep(mode);
    this.result.mode_drift = held.drift;
    this.onModeDrift();
  }

  optionValues(configId: string): string[] | undefined {
    if (!Array.isArray(this.configOptions)) return undefined;
    const option = this.configOptions.find(
      (entry) => isRecord(entry) && entry.id === configId,
    );
    if (!isRecord(option)) return undefined;
    return flattenOptionValues(option.options);
  }

  watchMode(step: AcpModeStep) {
    this.modeWatch = {
      step,
      initial: this.initialConflict ? undefined : this.initialMode,
      contrary: false,
    };
  }

  modeEvidence(): AcpSetupEvidence['evidence'] | undefined {
    const watch = this.modeWatch;
    this.modeWatch = undefined;
    if (!watch || watch.contrary) return undefined;
    if (watch.echoed) return watch.echoed;
    if (
      watch.step.confirm.initialState &&
      watch.initial === watch.step.modeId
    ) {
      return 'initial_state';
    }
    return undefined;
  }

  promptStarted() {
    this.promptActive = true;
  }

  promptAnswered(response: unknown) {
    this.promptActive = false;
    if (!isRecord(response)) return;
    if (typeof response.stopReason === 'string') {
      this.result.stop_reason = this.keep(response.stopReason);
    }
    const usage = numericFields(response.usage);
    if (usage) this.result.usage = usage;
    const meta = isRecord(response._meta) ? response._meta : {};
    const quota = isRecord(meta.quota) ? meta.quota : {};
    if (Array.isArray(quota.model_usage)) {
      const models = quota.model_usage
        .map((entry) => (isRecord(entry) ? entry.model : undefined))
        .filter((model): model is string => typeof model === 'string')
        .map((model) => this.keep(model));
      if (models.length > 0)
        this.result.models.usage_models = [...new Set(models)];
    }
  }

  notification(method: string, params: unknown) {
    if (method !== 'session/update' || !isRecord(params)) return;
    const update = isRecord(params.update) ? params.update : {};
    const kind = update.sessionUpdate;
    if (this.result.session_id === undefined) {
      this.keepEarly(params, kind);
      return;
    }
    // Updates for another session are ignored.
    if (params.sessionId !== this.result.session_id) return;
    const watch = this.modeWatch;
    if (kind === 'current_mode_update') {
      // Before the watch, a report is part of the starting state; one that
      // disagrees with session/new leaves the starting mode unknown.
      if (!watch && !this.held && typeof update.currentModeId === 'string') {
        this.initialMode ??= update.currentModeId;
        if (update.currentModeId !== this.initialMode) {
          this.initialConflict = true;
        }
      }
      if (
        this.held &&
        typeof update.currentModeId === 'string' &&
        update.currentModeId !== this.held.step.modeId
      ) {
        this.drifted(update.currentModeId);
      }
      if (watch && typeof update.currentModeId === 'string') {
        if (update.currentModeId !== watch.step.modeId) watch.contrary = true;
        else if (watch.step.confirm.currentModeUpdate) {
          watch.echoed ??= 'current_mode_update';
        }
      }
      return;
    }
    if (kind === 'config_option_update') {
      this.configOptionsSeen(update.configOptions);
      return;
    }
    if (kind !== 'agent_message_chunk') return;
    const content = isRecord(update.content) ? update.content : {};
    if (content.type !== 'text' || typeof content.text !== 'string') return;
    if (this.promptActive) {
      this.result.text += content.text;
      return;
    }
    const marker = watch?.step.confirm.marker;
    if (watch && marker !== undefined && content.text === marker) {
      watch.echoed ??= 'marker';
    }
  }

  private keepEarly(params: Record<string, unknown>, kind: unknown) {
    if (kind !== 'current_mode_update' && kind !== 'config_option_update') {
      return;
    }
    if (typeof params.sessionId !== 'string') return;
    let kinds = this.early.get(params.sessionId);
    if (!kinds) {
      if (this.early.size >= MAX_EARLY_SESSIONS) return;
      kinds = new Map();
      this.early.set(params.sessionId, kinds);
    }
    // Re-inserted so replay keeps arrival order.
    kinds.delete(kind);
    kinds.set(kind, params);
  }
}

const MAX_DISPLAY_PATH_CHARS = 240;

// A denied request's path, relative to the run's cwd when it is inside it.
// Both sides are compared as real paths (agy reports /private/tmp for a cwd
// of /tmp); a path outside the cwd stays as the agent reported it.
function displayPath(
  reported: string,
  cwd: string,
  redact: (text: string) => string,
): string {
  let shown = reported;
  if (path.isAbsolute(reported)) {
    const realCwd = realpathOrSelf(path.resolve(cwd));
    const relative = path.relative(realCwd, realExistingPath(reported));
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      shown = relative === '' ? '.' : relative;
    }
  }
  return clip(redact(shown), MAX_DISPLAY_PATH_CHARS);
}

function realpathOrSelf(file: string) {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
}

// Last resort when teardown itself failed.
function killGroupNow(pid: number | undefined) {
  if (pid === undefined) return;
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

// The current values of the options that carry the session mode: id `mode`,
// category `mode`, or the step's own option (Droid's autonomy_level).
function modeOptionValues(options: unknown[], step: AcpModeStep): string[] {
  return options
    .filter(
      (option): option is Record<string, unknown> =>
        isRecord(option) &&
        (option.id === step.confirm.configOptionId ||
          option.id === 'mode' ||
          option.category === 'mode'),
    )
    .map((option) => option.currentValue)
    .filter((value): value is string => typeof value === 'string');
}

function currentValueOf(options: unknown, id: string): string | undefined {
  if (!Array.isArray(options)) return undefined;
  const option = options.find((entry) => isRecord(entry) && entry.id === id);
  return isRecord(option) && typeof option.currentValue === 'string'
    ? option.currentValue
    : undefined;
}

// Select options may be flat ({value, name}) or grouped ({group, options}).
function flattenOptionValues(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const values: string[] = [];
  for (const entry of options) {
    if (!isRecord(entry)) continue;
    if (typeof entry.value === 'string') values.push(entry.value);
    else if (Array.isArray(entry.options)) {
      values.push(...flattenOptionValues(entry.options));
    }
  }
  return values;
}

function numericFields(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const fields: Record<string, number> = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'number' && Number.isFinite(field))
      fields[key] = field;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function clip(value: string, max = MAX_META_CHARS) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
