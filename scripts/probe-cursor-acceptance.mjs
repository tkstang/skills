#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OBSERVER_CLI = path.join(
  REPO_ROOT,
  'skills/session-observer/scripts/session-observer.mjs',
);
const FIXTURE_DIRECTORY = path.join(
  REPO_ROOT,
  'tests/session-observer/fixtures/cursor',
);
const COMMAND_TIMEOUT_MS = 5_000;
const WATCH_RUNTIME_MIN = '0.002';

const HARNESS_ENVIRONMENT_KEYS = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_SESSION_ID',
  'CODEX_THREAD_ID',
  'CODEX_SESSION_ID',
  'CODEX_SANDBOX',
  'OPENAI_CODEX_SESSION_ID',
  'CURSOR_TRACE_ID',
  'CURSOR_AGENT',
  'CURSOR_SESSION_ID',
  'SESSION_OBSERVER_SELF',
];

function sanitizedEnvironment(overrides = {}, clearHarness = false) {
  const environment = { ...process.env };
  if (clearHarness) {
    for (const key of HARNESS_ENVIRONMENT_KEYS) environment[key] = '';
  }
  return { ...environment, ...overrides };
}

export function runCommand(
  command,
  args,
  { cwd = REPO_ROOT, env = process.env, timeoutMs = COMMAND_TIMEOUT_MS } = {},
) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let commandRun = false;
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('spawn', () => {
      commandRun = true;
    });
    child.once('error', () => {
      clearTimeout(timer);
      resolve({
        commandRun,
        exitCode: null,
        signal: null,
        timedOut,
        stdout,
        stderr,
      });
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        commandRun,
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
      });
    });
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseJsonLines(text) {
  return text
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => parseJson(line))
    .filter((value) => value !== null);
}

function commandSummary(result) {
  return {
    commandRun: result.commandRun,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    json: parseJson(result.stdout) !== null,
  };
}

function digestSummary(payload) {
  const status = payload?.cursorEvidence?.status ?? {};
  const range = payload?.range ?? {};
  return {
    schemaVersion: payload?.schemaVersion ?? null,
    runtime: payload?.runtime ?? null,
    engagement: status.engagement ?? null,
    activity: status.activity ?? null,
    lifecycle: status.lifecycle ?? null,
    content: status.content ?? null,
    health: status.health ?? null,
    delivery: status.delivery ?? null,
    continuityBlocked: payload?.continuityBlocked === true,
    continuityCode: payload?.code ?? null,
    indexBase: range.indexBase ?? null,
    fromIndex: Number.isInteger(range.fromIndex) ? range.fromIndex : null,
    nextIndex: Number.isInteger(range.nextIndex) ? range.nextIndex : null,
    entryCount: Array.isArray(payload?.entries) ? payload.entries.length : null,
  };
}

function acceptanceRow({
  id,
  source,
  command,
  commandRun,
  expected,
  actual,
  status,
  evidenceLabel,
}) {
  return {
    id,
    source,
    command,
    commandRun,
    expected,
    actual,
    status,
    evidenceLabel,
  };
}

function syntheticCommand(label) {
  return `session-observer ${label} --runtime cursor --cwd <temporary-cwd> --session cursor:<synthetic-session-id> --json`;
}

function liveCommand(label) {
  return `session-observer ${label} --runtime cursor --cwd <requested-cwd> --session cursor:<redacted-session-id> --json`;
}

function cursorSlug(cwd) {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

async function createScenario(root, label, fixture) {
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'workspaces', label);
  const stateDir = path.join(root, 'state', label);
  const sessionId = `synthetic-${label}`;
  const transcriptDirectory = path.join(
    home,
    '.cursor',
    'projects',
    cursorSlug(cwd),
    'agent-transcripts',
    sessionId,
  );
  const transcriptPath = path.join(transcriptDirectory, `${sessionId}.jsonl`);
  await mkdir(cwd, { recursive: true });
  await mkdir(transcriptDirectory, { recursive: true });
  await copyFile(path.join(FIXTURE_DIRECTORY, fixture), transcriptPath);
  return {
    home,
    cwd,
    stateDir,
    sessionId,
    transcriptPath,
    env: sanitizedEnvironment(
      {
        HOME: home,
        STATE_DIR: stateDir,
        SESSION_OBSERVER_SELF: `cursor:${sessionId}`,
      },
      true,
    ),
  };
}

async function runObserver(args, options) {
  return runCommand(process.execPath, [OBSERVER_CLI, ...args], options);
}

function allCommandsRan(results) {
  return results.every((result) => result.commandRun);
}

function passedCommands(results) {
  return (
    allCommandsRan(results) &&
    results.every((result) => !result.timedOut && result.exitCode === 0)
  );
}

async function runCoreCommandRows(root) {
  const scenario = await createScenario(
    root,
    'core-commands',
    'framed-closed.jsonl',
  );
  const pinned = `cursor:${scenario.sessionId}`;
  const rows = [];

  const whoami = await runObserver(
    ['whoami', '--cwd', scenario.cwd, '--json'],
    { env: scenario.env },
  );
  const whoamiPayload = parseJson(whoami.stdout);
  const whoamiPassed =
    whoami.exitCode === 0 &&
    whoamiPayload?.runtime === 'cursor' &&
    typeof whoamiPayload?.session === 'string' &&
    typeof whoamiPayload?.transcript === 'string';
  rows.push(
    acceptanceRow({
      id: 'synthetic-whoami',
      source: 'temporary-sanitized-store',
      command: 'session-observer whoami --cwd <temporary-cwd> --json',
      commandRun: whoami.commandRun,
      expected: {
        outcome: 'exact-identity-resolved',
        runtime: 'cursor',
        transcriptShape: 'temporary-cursor-store',
      },
      actual: {
        ...commandSummary(whoami),
        outcome: whoamiPassed ? 'exact-identity-resolved' : 'unexpected',
        runtime: whoamiPayload?.runtime ?? null,
        transcriptShape:
          typeof whoamiPayload?.transcript === 'string'
            ? 'temporary-cursor-store'
            : null,
      },
      status: whoamiPassed ? 'passed' : 'failed',
      evidenceLabel: 'automated-only',
    }),
  );

  const locate = await runObserver(
    ['locate', '--runtime', 'cursor', '--cwd', scenario.cwd, '--json'],
    { env: scenario.env },
  );
  const locatePayload = parseJson(locate.stdout);
  const locatePassed =
    locate.exitCode === 0 &&
    locatePayload?.winner?.runtime === 'cursor' &&
    locatePayload?.winner?.sessionId === scenario.sessionId;
  rows.push(
    acceptanceRow({
      id: 'synthetic-exact-locate',
      source: 'temporary-sanitized-store',
      command:
        'session-observer locate --runtime cursor --cwd <temporary-cwd> --json',
      commandRun: locate.commandRun,
      expected: { outcome: 'one-exact-cursor-winner' },
      actual: {
        ...commandSummary(locate),
        outcome: locatePassed ? 'one-exact-cursor-winner' : 'unexpected',
        winnerRuntime: locatePayload?.winner?.runtime ?? null,
        winnerPresent: locatePayload?.winner !== undefined,
      },
      status: locatePassed ? 'passed' : 'failed',
      evidenceLabel: 'automated-only',
    }),
  );

  const catchUp = await runObserver(
    [
      'catch-up',
      '--runtime',
      'cursor',
      '--cwd',
      scenario.cwd,
      '--session',
      pinned,
      '--debounce-sec',
      '0.01',
      '--json',
    ],
    { env: scenario.env },
  );
  const catchUpPayload = parseJson(catchUp.stdout);
  const catchUpActual = digestSummary(catchUpPayload);
  const catchUpPassed =
    catchUp.exitCode === 0 &&
    catchUpActual.runtime === 'cursor' &&
    catchUpActual.lifecycle === 'success' &&
    catchUpActual.health === 'healthy';
  rows.push(
    acceptanceRow({
      id: 'synthetic-pinned-catch-up',
      source: 'temporary-sanitized-store',
      command: syntheticCommand('catch-up'),
      commandRun: catchUp.commandRun,
      expected: {
        runtime: 'cursor',
        lifecycle: 'success',
        health: 'healthy',
        indexBase: 'zero-based-jsonl-frame-index',
      },
      actual: { ...commandSummary(catchUp), ...catchUpActual },
      status: catchUpPassed ? 'passed' : 'failed',
      evidenceLabel: 'automated-only',
    }),
  );

  const reset = await runObserver(
    ['state', 'reset', '--session', pinned, '--json'],
    { env: scenario.env },
  );
  const watch = await runObserver(
    [
      'catch-up-then-watch',
      '--runtime',
      'cursor',
      '--cwd',
      scenario.cwd,
      '--session',
      pinned,
      '--poll-sec',
      '0.02',
      '--debounce-sec',
      '0.01',
      '--max-pending-sec',
      '0.05',
      '--max-runtime-min',
      WATCH_RUNTIME_MIN,
      '--heartbeat-sec',
      '0',
      '--json',
    ],
    { env: scenario.env },
  );
  const watchEvents = parseJsonLines(watch.stdout);
  const eventTypes = [...new Set(watchEvents.map((event) => event.type))];
  const watchPassed =
    reset.exitCode === 0 &&
    watch.exitCode === 0 &&
    !watch.timedOut &&
    eventTypes.includes('stopped');
  rows.push(
    acceptanceRow({
      id: 'synthetic-bounded-catch-up-then-watch',
      source: 'temporary-sanitized-store',
      command: syntheticCommand(
        'catch-up-then-watch --max-runtime-min <finite>',
      ),
      commandRun: reset.commandRun && watch.commandRun,
      expected: {
        outcome: 'finite-clean-stop',
        stopReason: 'max-runtime',
      },
      actual: {
        resetExitCode: reset.exitCode,
        watchExitCode: watch.exitCode,
        timedOut: watch.timedOut,
        eventTypes,
        stopReason:
          watchEvents.find((event) => event.type === 'stopped')?.reason ?? null,
        outcome: watchPassed ? 'finite-clean-stop' : 'unexpected',
      },
      status: watchPassed ? 'passed' : 'failed',
      evidenceLabel: 'automated-only',
    }),
  );

  return rows;
}

async function runStabilityRow(root) {
  const scenario = await createScenario(
    root,
    'second-scan-stability',
    'framed-append-before.jsonl',
  );
  const result = await runObserver(
    [
      'review',
      '--runtime',
      'cursor',
      '--cwd',
      scenario.cwd,
      '--session',
      `cursor:${scenario.sessionId}`,
      '--debounce-sec',
      '0.01',
      '--json',
    ],
    { env: scenario.env },
  );
  const actual = digestSummary(parseJson(result.stdout));
  const passed =
    result.exitCode === 0 &&
    actual.content === 'available' &&
    actual.lifecycle === 'pending' &&
    actual.health === 'healthy';
  return acceptanceRow({
    id: 'synthetic-second-scan-stability',
    source: 'temporary-sanitized-store',
    command: syntheticCommand('review --debounce-sec <finite>'),
    commandRun: result.commandRun,
    expected: {
      content: 'available',
      lifecycle: 'pending',
      health: 'healthy',
    },
    actual: { ...commandSummary(result), ...actual },
    status: passed ? 'passed' : 'failed',
    evidenceLabel: 'automated-only',
  });
}

async function runLifecycleRows(root) {
  const fixtures = {
    success: 'terminal-success.jsonl',
    aborted: 'terminal-aborted.jsonl',
    error: 'terminal-error.jsonl',
    cancelled: 'terminal-cancelled.jsonl',
  };
  const rows = [];
  for (const [lifecycle, fixture] of Object.entries(fixtures)) {
    const scenario = await createScenario(
      root,
      `lifecycle-${lifecycle}`,
      fixture,
    );
    const result = await runObserver(
      [
        'review',
        '--runtime',
        'cursor',
        '--cwd',
        scenario.cwd,
        '--session',
        `cursor:${scenario.sessionId}`,
        '--json',
      ],
      { env: scenario.env },
    );
    const actual = digestSummary(parseJson(result.stdout));
    const passed =
      result.exitCode === 0 &&
      actual.lifecycle === lifecycle &&
      actual.health === 'healthy';
    rows.push(
      acceptanceRow({
        id: `synthetic-lifecycle-${lifecycle}`,
        source: 'temporary-sanitized-store',
        command: syntheticCommand('review'),
        commandRun: result.commandRun,
        expected: {
          lifecycle,
          failureRetained: lifecycle !== 'success',
        },
        actual: {
          ...commandSummary(result),
          ...actual,
          failureRetained:
            lifecycle === 'success' ? false : actual.lifecycle === lifecycle,
        },
        status: passed ? 'passed' : 'failed',
        evidenceLabel: 'automated-only',
      }),
    );
  }
  return rows;
}

async function runRepairRow(root, kind, beforeFixture, afterFixture) {
  const scenario = await createScenario(root, `${kind}-repair`, beforeFixture);
  const args = [
    'catch-up',
    '--runtime',
    'cursor',
    '--cwd',
    scenario.cwd,
    '--session',
    `cursor:${scenario.sessionId}`,
    '--debounce-sec',
    '0.01',
    '--json',
  ];
  const before = await runObserver(args, { env: scenario.env });
  if (kind === 'partial') {
    const unterminated = await readFile(scenario.transcriptPath, 'utf8');
    await writeFile(scenario.transcriptPath, `${unterminated}\n`, 'utf8');
  } else {
    await copyFile(
      path.join(FIXTURE_DIRECTORY, afterFixture),
      scenario.transcriptPath,
    );
  }
  const after = await runObserver(args, { env: scenario.env });
  const beforeActual = digestSummary(parseJson(before.stdout));
  const afterActual = digestSummary(parseJson(after.stdout));
  const beforePassed =
    kind === 'malformed'
      ? before.exitCode === 4 &&
        beforeActual.continuityBlocked === true &&
        beforeActual.continuityCode === 'MALFORMED_FRAME'
      : before.exitCode === 0 &&
        beforeActual.content === 'buffered' &&
        beforeActual.health === 'healthy' &&
        beforeActual.nextIndex === 1;
  const passed =
    before.commandRun &&
    !before.timedOut &&
    beforePassed &&
    after.commandRun &&
    !after.timedOut &&
    after.exitCode === 0 &&
    afterActual.health === 'healthy' &&
    afterActual.continuityBlocked === false &&
    Number.isInteger(afterActual.nextIndex);
  return acceptanceRow({
    id: `synthetic-${kind}-repair`,
    source: 'temporary-sanitized-store',
    command: syntheticCommand('catch-up <before-and-after-repair>'),
    commandRun: allCommandsRan([before, after]),
    expected: {
      outcome: 'resume-from-verified-boundary',
      health: 'healthy',
    },
    actual: {
      before: { ...commandSummary(before), ...beforeActual },
      after: { ...commandSummary(after), ...afterActual },
      outcome: passed ? 'resume-from-verified-boundary' : 'unexpected',
    },
    status: passed ? 'passed' : 'failed',
    evidenceLabel: 'automated-only',
  });
}

async function runContinuityBlockRow(root, kind) {
  const initialFixture =
    kind === 'shrink'
      ? 'framed-append-after.jsonl'
      : 'framed-replacement-before.jsonl';
  const changedFixture =
    kind === 'shrink'
      ? 'framed-append-before.jsonl'
      : 'framed-replacement-after.jsonl';
  const expectedCode =
    kind === 'shrink' ? 'TRANSCRIPT_SHRANK' : 'TRANSCRIPT_REPLACED';
  const scenario = await createScenario(
    root,
    `continuity-${kind}`,
    initialFixture,
  );
  const args = [
    'catch-up',
    '--runtime',
    'cursor',
    '--cwd',
    scenario.cwd,
    '--session',
    `cursor:${scenario.sessionId}`,
    '--debounce-sec',
    '0.01',
    '--json',
  ];
  const before = await runObserver(args, { env: scenario.env });
  if (kind === 'replacement') {
    const replacement = `${scenario.transcriptPath}.replacement`;
    await copyFile(path.join(FIXTURE_DIRECTORY, changedFixture), replacement);
    await rename(replacement, scenario.transcriptPath);
  } else {
    await copyFile(
      path.join(FIXTURE_DIRECTORY, changedFixture),
      scenario.transcriptPath,
    );
  }
  const after = await runObserver(args, { env: scenario.env });
  const payload = parseJson(after.stdout);
  const passed =
    before.exitCode === 0 &&
    after.exitCode === 4 &&
    payload?.continuityBlocked === true &&
    payload?.code === expectedCode;
  return acceptanceRow({
    id: `synthetic-continuity-${kind}`,
    source: 'temporary-sanitized-store',
    command: syntheticCommand('catch-up <continuity-change>'),
    commandRun: allCommandsRan([before, after]),
    expected: {
      continuityBlocked: true,
      continuityCode: expectedCode,
    },
    actual: {
      initialExitCode: before.exitCode,
      changedExitCode: after.exitCode,
      continuityBlocked: payload?.continuityBlocked === true,
      continuityCode: payload?.code ?? null,
    },
    status: passed ? 'passed' : 'failed',
    evidenceLabel: 'automated-only',
  });
}

async function runRestartRow(root) {
  const scenario = await createScenario(
    root,
    'restart-append',
    'framed-append-before.jsonl',
  );
  const args = [
    'catch-up',
    '--runtime',
    'cursor',
    '--cwd',
    scenario.cwd,
    '--session',
    `cursor:${scenario.sessionId}`,
    '--debounce-sec',
    '0.01',
    '--json',
  ];
  const before = await runObserver(args, { env: scenario.env });
  await copyFile(
    path.join(FIXTURE_DIRECTORY, 'framed-append-after.jsonl'),
    scenario.transcriptPath,
  );
  const restarted = await runObserver(args, { env: scenario.env });
  const actual = digestSummary(parseJson(restarted.stdout));
  const passed =
    passedCommands([before, restarted]) &&
    actual.fromIndex === 2 &&
    actual.nextIndex === 3 &&
    actual.lifecycle === 'success';
  return acceptanceRow({
    id: 'synthetic-restart-append',
    source: 'temporary-sanitized-store',
    command: syntheticCommand('catch-up <restart-and-append>'),
    commandRun: allCommandsRan([before, restarted]),
    expected: {
      outcome: 'resume-without-replay',
      fromIndex: 2,
      nextIndex: 3,
      lifecycle: 'success',
    },
    actual: {
      initialExitCode: before.exitCode,
      restartedExitCode: restarted.exitCode,
      ...actual,
      outcome: passed ? 'resume-without-replay' : 'unexpected',
    },
    status: passed ? 'passed' : 'failed',
    evidenceLabel: 'automated-only',
  });
}

async function runResetReplayRow(root) {
  const scenario = await createScenario(
    root,
    'reset-replay',
    'framed-closed.jsonl',
  );
  const pinned = `cursor:${scenario.sessionId}`;
  const catchUpArgs = [
    'catch-up',
    '--runtime',
    'cursor',
    '--cwd',
    scenario.cwd,
    '--session',
    pinned,
    '--debounce-sec',
    '0.01',
    '--json',
  ];
  const initial = await runObserver(catchUpArgs, { env: scenario.env });
  const reset = await runObserver(
    ['state', 'reset', '--session', pinned, '--json'],
    { env: scenario.env },
  );
  const replay = await runObserver(catchUpArgs, { env: scenario.env });
  const actual = digestSummary(parseJson(replay.stdout));
  const passed =
    passedCommands([initial, reset, replay]) &&
    actual.fromIndex === 0 &&
    actual.lifecycle === 'success';
  return acceptanceRow({
    id: 'synthetic-reset-replay',
    source: 'temporary-sanitized-store',
    command: syntheticCommand('state reset; catch-up'),
    commandRun: allCommandsRan([initial, reset, replay]),
    expected: {
      reset: true,
      replayFromIndex: 0,
      lifecycle: 'success',
    },
    actual: {
      initialExitCode: initial.exitCode,
      resetExitCode: reset.exitCode,
      replayExitCode: replay.exitCode,
      replayFromIndex: actual.fromIndex,
      lifecycle: actual.lifecycle,
    },
    status: passed ? 'passed' : 'failed',
    evidenceLabel: 'automated-only',
  });
}

export async function runSyntheticAcceptance() {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), 'cursor-observation-acceptance-')),
  );
  try {
    return [
      ...(await runCoreCommandRows(root)),
      await runStabilityRow(root),
      ...(await runLifecycleRows(root)),
      await runRepairRow(
        root,
        'malformed',
        'framed-repair-before.jsonl',
        'framed-repair-after.jsonl',
      ),
      await runRepairRow(
        root,
        'partial',
        'framed-unterminated-tail.jsonl',
        'framed-closed.jsonl',
      ),
      await runContinuityBlockRow(root, 'shrink'),
      await runContinuityBlockRow(root, 'replacement'),
      await runRestartRow(root),
      await runResetReplayRow(root),
    ];
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function liveOutcome(payload, exitCode) {
  if (exitCode === 0 && payload?.winner?.runtime === 'cursor') {
    return 'exact-cursor-session-available';
  }
  if (
    payload?.noMatch === true ||
    payload?.unengagedOnly === true ||
    payload?.ties === true
  ) {
    return 'unavailable';
  }
  return 'unavailable';
}

export async function runLiveAcceptance(
  cwd,
  { commandRunner = runCommand } = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), 'cursor-live-acceptance-'));
  try {
    const stateDir = path.join(root, 'state');
    const env = sanitizedEnvironment({ STATE_DIR: stateDir });
    const rows = [];
    const version = await commandRunner('cursor', ['--version'], {
      cwd,
      env,
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
    const versionNumber =
      /\b\d+\.\d+\.\d+\b/u.exec(version.stdout)?.[0] ?? null;
    const architecture = /\b(?:arm64|x64)\b/u.exec(version.stdout)?.[0] ?? null;
    const providerVersionPassed =
      version.commandRun &&
      version.exitCode === 0 &&
      !version.timedOut &&
      versionNumber !== null &&
      architecture !== null;

    const whoami = await commandRunner(
      process.execPath,
      [OBSERVER_CLI, 'whoami', '--cwd', cwd, '--json'],
      { cwd, env, timeoutMs: COMMAND_TIMEOUT_MS },
    );
    const whoamiPayload = parseJson(whoami.stdout);
    const whoamiOutcome =
      whoamiPayload?.noIdentity === true
        ? 'unavailable'
        : whoamiPayload?.ambiguousIdentity === true
          ? 'ambiguous'
          : whoami.exitCode === 0 && whoamiPayload?.runtime !== undefined
            ? 'resolved'
            : 'invalid';
    const whoamiPassed =
      providerVersionPassed &&
      whoami.commandRun &&
      !whoami.timedOut &&
      ((whoamiOutcome === 'resolved' && whoami.exitCode === 0) ||
        (whoamiOutcome === 'unavailable' && whoami.exitCode === 2) ||
        (whoamiOutcome === 'ambiguous' && whoami.exitCode === 3));
    rows.push(
      acceptanceRow({
        id: 'live-whoami',
        source: 'live-read-only',
        command: 'session-observer whoami --cwd <requested-cwd> --json',
        commandRun: whoami.commandRun,
        expected: {
          outcome: 'structural-identity-result',
          providerVersionAvailable: true,
        },
        actual: {
          ...commandSummary(whoami),
          providerVersionAvailable: providerVersionPassed,
          outcome: whoamiOutcome,
        },
        status: whoamiPassed ? 'passed' : 'failed',
        evidenceLabel: whoamiPassed ? 'live-validated' : 'unavailable',
      }),
    );

    const locate = await commandRunner(
      process.execPath,
      [OBSERVER_CLI, 'locate', '--runtime', 'cursor', '--cwd', cwd, '--json'],
      { cwd, env, timeoutMs: COMMAND_TIMEOUT_MS },
    );
    const locatePayload = parseJson(locate.stdout);
    const locateOutcome = liveOutcome(locatePayload, locate.exitCode);
    const sessionId =
      locateOutcome === 'exact-cursor-session-available' &&
      typeof locatePayload?.winner?.sessionId === 'string'
        ? locatePayload.winner.sessionId
        : null;
    const locateStatus =
      providerVersionPassed && locate.commandRun && !locate.timedOut
        ? locateOutcome === 'exact-cursor-session-available'
          ? 'passed'
          : 'unavailable'
        : 'failed';
    rows.push(
      acceptanceRow({
        id: 'live-exact-locate',
        source: 'live-read-only',
        command:
          'session-observer locate --runtime cursor --cwd <requested-cwd> --json',
        commandRun: locate.commandRun,
        expected: {
          outcome: 'exact-cursor-session-or-honest-unavailable',
          providerVersionAvailable: true,
        },
        actual: {
          ...commandSummary(locate),
          providerVersionAvailable: providerVersionPassed,
          outcome: locateOutcome,
          winnerRuntime: locatePayload?.winner?.runtime ?? null,
          winnerPresent: locatePayload?.winner !== undefined,
        },
        status: locateStatus,
        evidenceLabel:
          locateStatus === 'passed'
            ? 'live-validated'
            : locateOutcome === 'exact-cursor-session-available'
              ? 'documented-but-unvalidated'
              : 'unavailable',
      }),
    );

    const pinned = `cursor:${sessionId ?? 'synthetic-unavailable'}`;
    const catchUp = await commandRunner(
      process.execPath,
      [
        OBSERVER_CLI,
        'catch-up',
        '--runtime',
        'cursor',
        '--cwd',
        cwd,
        '--session',
        pinned,
        '--debounce-sec',
        '0.05',
        '--json',
      ],
      { cwd, env, timeoutMs: COMMAND_TIMEOUT_MS },
    );
    const catchUpActual = digestSummary(parseJson(catchUp.stdout));
    const catchUpPassed =
      providerVersionPassed &&
      sessionId !== null &&
      catchUp.commandRun &&
      catchUp.exitCode === 0 &&
      !catchUp.timedOut &&
      catchUpActual.schemaVersion === 2 &&
      catchUpActual.runtime === 'cursor' &&
      catchUpActual.indexBase === 'zero-based-jsonl-frame-index' &&
      catchUpActual.engagement === 'engaged' &&
      catchUpActual.activity === 'assistant-progress' &&
      catchUpActual.content === 'available' &&
      catchUpActual.lifecycle === 'success' &&
      catchUpActual.delivery === 'reserved' &&
      catchUpActual.health === 'healthy';
    rows.push(
      acceptanceRow({
        id: 'live-pinned-catch-up',
        source: 'live-read-only',
        command: liveCommand('catch-up'),
        commandRun: catchUp.commandRun,
        expected: {
          outcome: 'validated-terminal-observation-or-honest-unavailable',
          providerVersionAvailable: true,
          schemaVersion: 2,
          runtime: 'cursor',
          indexBase: 'zero-based-jsonl-frame-index',
          engagement: 'engaged',
          activity: 'assistant-progress',
          content: 'available',
          lifecycle: 'success',
          delivery: 'reserved',
          health: 'healthy',
          transcriptAccess: 'read-only',
        },
        actual: {
          ...commandSummary(catchUp),
          providerVersionAvailable: providerVersionPassed,
          ...(sessionId === null
            ? { outcome: 'unavailable' }
            : {
                ...catchUpActual,
                outcome: catchUpPassed ? 'healthy-observation' : 'unexpected',
              }),
          transcriptAccess: 'read-only',
        },
        status:
          sessionId === null
            ? catchUp.commandRun
              ? 'unavailable'
              : 'failed'
            : catchUpPassed
              ? 'passed'
              : 'failed',
        evidenceLabel: catchUpPassed
          ? 'live-validated'
          : 'documented-but-unvalidated',
      }),
    );

    const watch = await commandRunner(
      process.execPath,
      [
        OBSERVER_CLI,
        'catch-up-then-watch',
        '--runtime',
        'cursor',
        '--cwd',
        cwd,
        '--session',
        pinned,
        '--poll-sec',
        '0.02',
        '--debounce-sec',
        '0.01',
        '--max-pending-sec',
        '0.05',
        '--max-runtime-min',
        WATCH_RUNTIME_MIN,
        '--heartbeat-sec',
        '0',
        '--json',
      ],
      { cwd, env, timeoutMs: COMMAND_TIMEOUT_MS },
    );
    const watchEvents = parseJsonLines(watch.stdout);
    const eventTypes = [...new Set(watchEvents.map((event) => event.type))];
    const stoppedEvents = watchEvents.filter(
      (event) => event.type === 'stopped',
    );
    const stopped = stoppedEvents[0];
    const baselineIndex = watchEvents.findIndex(
      (event) => event.type === 'baseline',
    );
    const stoppedIndex = watchEvents.findIndex(
      (event) => event.type === 'stopped',
    );
    const finiteRuntimeConfigured = Number(WATCH_RUNTIME_MIN) > 0;
    const baselineObserved = baselineIndex >= 0 && baselineIndex < stoppedIndex;
    const stoppedIsFinal =
      stoppedIndex >= 0 && stoppedIndex === watchEvents.length - 1;
    const watchPassed =
      providerVersionPassed &&
      sessionId !== null &&
      watch.commandRun &&
      watch.exitCode === 0 &&
      !watch.timedOut &&
      finiteRuntimeConfigured &&
      baselineObserved &&
      stoppedEvents.length === 1 &&
      stoppedIsFinal &&
      stopped?.reason === 'max-runtime';
    rows.push(
      acceptanceRow({
        id: 'live-bounded-catch-up-then-watch',
        source: 'live-read-only',
        command: liveCommand('catch-up-then-watch --max-runtime-min <finite>'),
        commandRun: watch.commandRun,
        expected: {
          outcome: 'finite-clean-stop-or-honest-unavailable',
          providerVersionAvailable: true,
          finiteRuntimeConfigured: true,
          baselineObserved: true,
          stoppedEventCount: 1,
          stoppedIsFinal: true,
          stopReason: 'max-runtime',
          transcriptAccess: 'read-only',
        },
        actual: {
          commandRun: watch.commandRun,
          exitCode: watch.exitCode,
          timedOut: watch.timedOut,
          providerVersionAvailable: providerVersionPassed,
          requestedMaxRuntimeMin: WATCH_RUNTIME_MIN,
          finiteRuntimeConfigured,
          baselineObserved,
          stoppedEventCount: stoppedEvents.length,
          stoppedIsFinal,
          eventTypes,
          stopReason: stopped?.reason ?? null,
          outcome:
            sessionId === null
              ? 'unavailable'
              : watchPassed
                ? 'finite-clean-stop'
                : 'unexpected',
          transcriptAccess: 'read-only',
        },
        status:
          sessionId === null
            ? watch.commandRun
              ? 'unavailable'
              : 'failed'
            : watchPassed
              ? 'passed'
              : 'failed',
        evidenceLabel: watchPassed
          ? 'live-validated'
          : 'documented-but-unvalidated',
      }),
    );

    return {
      availability:
        sessionId === null ? 'unavailable' : 'controlled-session-available',
      provider: {
        command: 'cursor --version',
        commandRun: version.commandRun,
        exitCode: version.exitCode,
        timedOut: version.timedOut,
        version: versionNumber ?? 'unavailable',
        architecture: architecture ?? 'unavailable',
        status: providerVersionPassed ? 'passed' : 'failed',
      },
      rows,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function runCursorAcceptance({ runtime, cwd }) {
  if (runtime !== 'cursor') {
    throw new Error('Cursor acceptance probe requires --runtime cursor');
  }
  const live = await runLiveAcceptance(cwd);
  const automatedRows = await runSyntheticAcceptance();
  const rows = [...live.rows, ...automatedRows];
  const failedRows = rows.filter(
    (row) => row.status === 'failed' || row.commandRun !== true,
  );
  return {
    schemaVersion: 1,
    runtime: 'cursor',
    cwd: '<requested-cwd>',
    transcriptAccess: {
      liveProvider: 'read-only',
      mutationScenarios: 'temporary-sanitized-copies-only',
    },
    liveAvailability: live.availability,
    liveEvidenceLabel:
      live.availability === 'controlled-session-available' &&
      live.provider.status === 'passed' &&
      live.rows.every((row) => row.status === 'passed')
        ? 'live-validated'
        : 'documented-but-unvalidated',
    provider: live.provider,
    status: failedRows.length === 0 ? 'passed' : 'failed',
    totals: {
      rows: rows.length,
      live: live.rows.length,
      synthetic: automatedRows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      unavailable: rows.filter((row) => row.status === 'unavailable').length,
      failed: failedRows.length,
    },
    rows,
  };
}

function parseArgs(argv) {
  let runtime = null;
  let cwd = process.cwd();
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--runtime') {
      runtime = argv[++index] ?? null;
    } else if (argument === '--cwd') {
      cwd = path.resolve(argv[++index] ?? '');
    } else if (argument === '--json') {
      json = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!json) throw new Error('Cursor acceptance probe requires --json');
  return { runtime, cwd };
}

async function main(argv = process.argv.slice(2)) {
  const result = await runCursorAcceptance(parseArgs(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.status === 'passed' ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `Cursor observation acceptance probe error: ${error.message}\n`,
      );
      process.exitCode = 2;
    });
}
