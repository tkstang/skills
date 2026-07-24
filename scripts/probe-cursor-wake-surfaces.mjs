#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROBE_NAME = 'cursor-wake-surfaces';
const TEMPORARY_PREFIX = 'cursor-wake-probe-';
const VERSION_PROCESS_CAP_MS = 10_000;
const HOOK_TIMEOUT_SECONDS = 10;
const FOLLOWUP_LOOP_LIMIT = 1;
const TERMINATION_GRACE_MS = 2_000;
const OUTPUT_TAIL_LIMIT = 8_192;

export const CURSOR_WAKE_PROBE_MODES = Object.freeze({
  TOP_LEVEL_STOP: 'top-level-stop',
  MANAGED_SUBAGENT: 'managed-subagent',
});

export const CURSOR_WAKE_PROBE_BOUNDS = Object.freeze({
  [CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP]: Object.freeze({
    processCapMs: 90_000,
    hookTimeoutSeconds: HOOK_TIMEOUT_SECONDS,
    followupLoopLimit: FOLLOWUP_LOOP_LIMIT,
  }),
  [CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT]: Object.freeze({
    processCapMs: 120_000,
    hookTimeoutSeconds: HOOK_TIMEOUT_SECONDS,
    followupLoopLimit: FOLLOWUP_LOOP_LIMIT,
  }),
});

export const CURSOR_WAKE_PROBE_MARKERS = Object.freeze({
  stopInitial: 'CURSOR_WAKE_PROBE_STOP_INITIAL',
  stopFollowup: 'CURSOR_WAKE_PROBE_STOP_FOLLOWUP',
  managedChild: 'CURSOR_WAKE_PROBE_MANAGED_CHILD',
  managedParent: 'CURSOR_WAKE_PROBE_MANAGED_PARENT',
  managedFollowup: 'CURSOR_WAKE_PROBE_MANAGED_FOLLOWUP',
});

const STOP_PROMPT = [
  `Return exactly ${CURSOR_WAKE_PROBE_MARKERS.stopInitial}.`,
  'Do not use tools, inspect files, or add commentary.',
].join(' ');

const MANAGED_PROMPT = [
  'Use the wake-probe-child subagent exactly once.',
  `Ask it to return exactly ${CURSOR_WAKE_PROBE_MARKERS.managedChild}.`,
  `After it finishes, return exactly ${CURSOR_WAKE_PROBE_MARKERS.managedParent}.`,
  `If a lifecycle follow-up supplies ${CURSOR_WAKE_PROBE_MARKERS.managedFollowup}, return that marker exactly.`,
  'Do not use any other tool or add commentary.',
].join(' ');

const MANAGED_CHILD_DEFINITION = `---
name: wake-probe-child
description: Fixed child used only by the isolated Cursor managed-callback probe.
---

Use no tools. On the initial task, return exactly
${CURSOR_WAKE_PROBE_MARKERS.managedChild}.

If a lifecycle follow-up supplies
${CURSOR_WAKE_PROBE_MARKERS.managedFollowup}, return that marker exactly.
`;

const STRUCTURAL_HOOK_SCRIPT = `#!/usr/bin/env node
import { appendFile } from 'node:fs/promises';

const hook = process.argv[2] ?? 'unknown';
let input = {};
try {
  input = JSON.parse(await new Promise((resolve) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      value += chunk;
    });
    process.stdin.on('end', () => resolve(value));
  }));
} catch {
  input = {};
}

const record = {
  schemaVersion: 1,
  hook,
  input: {
    conversationIdPresent: typeof input.conversation_id === 'string',
    generationIdPresent: typeof input.generation_id === 'string',
    statusPresent: typeof input.status === 'string',
    loopCountFinite: Number.isFinite(input.loop_count),
    subagentTypePresent:
      typeof input.subagent_type === 'string' ||
      typeof input.subagentType === 'string',
  },
};

await appendFile(
  new URL('../probe-events.jsonl', import.meta.url),
  \`\${JSON.stringify(record)}\\n\`,
  { mode: 0o600 },
);

if (hook === 'subagent-start') {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
} else if (hook === 'managed-subagent-stop') {
  process.stdout.write(
    JSON.stringify({
      followup_message: '${CURSOR_WAKE_PROBE_MARKERS.managedFollowup}',
    }),
  );
} else if (hook === 'top-level-stop') {
  process.stdout.write(
    JSON.stringify({
      followup_message: '${CURSOR_WAKE_PROBE_MARKERS.stopFollowup}',
    }),
  );
} else {
  process.stdout.write('{}');
}
`;

function hookDefinition(command, { loop = false } = {}) {
  return {
    command,
    type: 'command',
    timeout: HOOK_TIMEOUT_SECONDS,
    failClosed: false,
    ...(loop ? { loop_limit: FOLLOWUP_LOOP_LIMIT } : {}),
  };
}

function modeRecipe(mode) {
  if (mode === CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP) {
    return {
      mode,
      bounds: CURSOR_WAKE_PROBE_BOUNDS[mode],
      prompt: STOP_PROMPT,
      markers: [
        CURSOR_WAKE_PROBE_MARKERS.stopInitial,
        CURSOR_WAKE_PROBE_MARKERS.stopFollowup,
      ],
      expectedHooks: ['top-level-stop'],
      hooksConfig: {
        version: 1,
        hooks: {
          stop: [
            hookDefinition('node .cursor/hooks/probe-hook.mjs top-level-stop', {
              loop: true,
            }),
          ],
        },
      },
      childDefinition: null,
      agentArguments: ['--mode', 'ask'],
    };
  }

  if (mode === CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT) {
    return {
      mode,
      bounds: CURSOR_WAKE_PROBE_BOUNDS[mode],
      prompt: MANAGED_PROMPT,
      markers: [
        CURSOR_WAKE_PROBE_MARKERS.managedChild,
        CURSOR_WAKE_PROBE_MARKERS.managedParent,
        CURSOR_WAKE_PROBE_MARKERS.managedFollowup,
      ],
      expectedHooks: ['subagent-start', 'managed-subagent-stop'],
      hooksConfig: {
        version: 1,
        hooks: {
          subagentStart: [
            hookDefinition('node .cursor/hooks/probe-hook.mjs subagent-start'),
          ],
          subagentStop: [
            hookDefinition(
              'node .cursor/hooks/probe-hook.mjs managed-subagent-stop',
              { loop: true },
            ),
          ],
        },
      },
      childDefinition: MANAGED_CHILD_DEFINITION,
      agentArguments: [],
    };
  }

  throw new Error(`unsupported probe mode: ${mode}`);
}

export function describeCursorWakeProbeRecipes() {
  return {
    schemaVersion: 1,
    probe: PROBE_NAME,
    provider: {
      name: 'Cursor Agent',
      command: 'agent',
      versionCommand: ['agent', '--version'],
      versionProcessCapMs: VERSION_PROCESS_CAP_MS,
    },
    safety: {
      temporaryWorkspaceOnly: true,
      existingProviderTranscripts: 'not-read-or-mutated',
      credentialsRequested: false,
      daemonStarted: false,
      schedulerStarted: false,
      externalServiceStarted: false,
      cleanup: 'remove-exact-created-workspace',
    },
    modes: [
      CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP,
      CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT,
    ].map((mode) => {
      const recipe = modeRecipe(mode);
      return {
        mode,
        bounds: recipe.bounds,
        prompt: recipe.prompt,
        markers: recipe.markers,
        expectedHooks: recipe.expectedHooks,
        hooksConfig: recipe.hooksConfig,
        childDefinitionPresent: recipe.childDefinition !== null,
      };
    }),
  };
}

function safeTemporaryWorkspace(workspace, temporaryParent) {
  const resolvedWorkspace = path.resolve(workspace);
  const resolvedParent = path.resolve(temporaryParent);
  return (
    resolvedWorkspace !== resolvedParent &&
    path.dirname(resolvedWorkspace) === resolvedParent &&
    path.basename(resolvedWorkspace).startsWith(TEMPORARY_PREFIX)
  );
}

async function removeTemporaryWorkspace(workspace, temporaryParent) {
  if (!safeTemporaryWorkspace(workspace, temporaryParent)) {
    return {
      attempted: false,
      succeeded: false,
      workspaceExistsAfter: true,
      diagnostic: 'unsafe-workspace-boundary',
    };
  }

  try {
    await rm(workspace, { recursive: true, force: true });
    const entries = await readdir(temporaryParent);
    return {
      attempted: true,
      succeeded: true,
      workspaceExistsAfter: entries.includes(path.basename(workspace)),
      diagnostic: 'removed-exact-created-workspace',
    };
  } catch {
    return {
      attempted: true,
      succeeded: false,
      workspaceExistsAfter: true,
      diagnostic: 'cleanup-failed',
    };
  }
}

export async function createCursorWakeProbeWorkspace(
  mode,
  { temporaryParent = tmpdir() } = {},
) {
  const recipe = modeRecipe(mode);
  const workspace = await mkdtemp(
    path.join(temporaryParent, `${TEMPORARY_PREFIX}${mode}-`),
  );
  const cursorDirectory = path.join(workspace, '.cursor');
  const hooksDirectory = path.join(cursorDirectory, 'hooks');
  const agentsDirectory = path.join(cursorDirectory, 'agents');
  await mkdir(hooksDirectory, { recursive: true });
  if (recipe.childDefinition !== null) {
    await mkdir(agentsDirectory, { recursive: true });
  }

  await Promise.all([
    writeFile(
      path.join(cursorDirectory, 'hooks.json'),
      `${JSON.stringify(recipe.hooksConfig, null, 2)}\n`,
      { mode: 0o600 },
    ),
    writeFile(
      path.join(hooksDirectory, 'probe-hook.mjs'),
      STRUCTURAL_HOOK_SCRIPT,
      { mode: 0o700 },
    ),
    writeFile(
      path.join(workspace, 'README.md'),
      '# Isolated Cursor wake probe\n',
      { mode: 0o600 },
    ),
    ...(recipe.childDefinition === null
      ? []
      : [
          writeFile(
            path.join(agentsDirectory, 'wake-probe-child.md'),
            recipe.childDefinition,
            { mode: 0o600 },
          ),
        ]),
  ]);
  await chmod(path.join(hooksDirectory, 'probe-hook.mjs'), 0o700);

  return {
    mode,
    recipe,
    workspace,
    cleanup: () => removeTemporaryWorkspace(workspace, temporaryParent),
  };
}

function appendOutputTail(current, chunk) {
  const next = `${current}${chunk.toString('utf8')}`;
  return next.slice(-OUTPUT_TAIL_LIMIT);
}

function terminateChild(child, signal) {
  if (child.pid && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child below.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The process has already exited.
  }
}

async function runBoundedProcess(command, arguments_, options) {
  const { cwd, env, timeoutMs } = options;
  return new Promise((resolve) => {
    let stdoutTail = '';
    let stderrTail = '';
    let timedOut = false;
    let spawnFailed = false;
    let settled = false;
    let killTimer;
    const child = spawn(command, arguments_, {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutTail = appendOutputTail(stdoutTail, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrTail = appendOutputTail(stderrTail, chunk);
    });
    child.once('error', () => {
      spawnFailed = true;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      terminateChild(child, 'SIGTERM');
      killTimer = setTimeout(() => {
        terminateChild(child, 'SIGKILL');
      }, TERMINATION_GRACE_MS);
    }, timeoutMs);

    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({
        commandRun: !spawnFailed,
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal ?? null,
        timedOut,
        spawnFailed,
        stdoutTail,
        stderrTail,
      });
    });
  });
}

function sanitizedProviderVersion(run) {
  if (run.exitCode !== 0 || run.timedOut || run.spawnFailed) {
    return 'unavailable';
  }
  const candidate = run.stdoutTail.trim().split(/\s+/u)[0] ?? '';
  return /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/u.test(candidate)
    ? candidate
    : 'unavailable';
}

async function readHookEvents(workspace) {
  try {
    const text = await readFile(
      path.join(workspace, '.cursor', 'probe-events.jsonl'),
      'utf8',
    );
    return text
      .split(/\r?\n/u)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const value = JSON.parse(line);
          return value?.schemaVersion === 1 && typeof value.hook === 'string'
            ? [value]
            : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function outcomeRow(id, expected, actual, status) {
  return { id, expected, actual, status };
}

function markerPresence(output, markers) {
  return Object.fromEntries(
    markers.map((marker) => [marker, output.includes(marker)]),
  );
}

function actualHookCounts(events, expectedHooks) {
  return Object.fromEntries(
    expectedHooks.map((hook) => [
      hook,
      events.filter((event) => event.hook === hook).length,
    ]),
  );
}

function allExpectedHooksRan(counts) {
  return Object.values(counts).every((count) => count >= 1);
}

function deliveredFollowup(mode, markers) {
  const marker =
    mode === CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP
      ? CURSOR_WAKE_PROBE_MARKERS.stopFollowup
      : CURSOR_WAKE_PROBE_MARKERS.managedFollowup;
  return markers[marker] === true;
}

export async function runCursorWakeProbe(mode, options = {}) {
  const recipe = modeRecipe(mode);
  const providerCommand = options.providerCommand ?? 'agent';
  const providerArgumentPrefix = options.providerArgumentPrefix ?? [];
  const processCapMs = options.processCapMs ?? recipe.bounds.processCapMs;
  const temporary = await createCursorWakeProbeWorkspace(mode, options);
  let result;

  try {
    const versionRun = await runBoundedProcess(
      providerCommand,
      [...providerArgumentPrefix, '--version'],
      {
        cwd: temporary.workspace,
        env: options.env ?? process.env,
        timeoutMs: options.versionProcessCapMs ?? VERSION_PROCESS_CAP_MS,
      },
    );
    const providerRun = await runBoundedProcess(
      providerCommand,
      [
        ...providerArgumentPrefix,
        '-p',
        '--output-format',
        'text',
        '--trust',
        '--workspace',
        temporary.workspace,
        ...recipe.agentArguments,
        recipe.prompt,
      ],
      {
        cwd: temporary.workspace,
        env: options.env ?? process.env,
        timeoutMs: processCapMs,
      },
    );
    const events = await readHookEvents(temporary.workspace);
    const hooks = actualHookCounts(events, recipe.expectedHooks);
    const markers = markerPresence(providerRun.stdoutTail, recipe.markers);
    const providerCompleted =
      providerRun.commandRun &&
      providerRun.exitCode === 0 &&
      providerRun.timedOut === false;
    const callbacksRan = allExpectedHooksRan(hooks);
    const followupDelivered = deliveredFollowup(mode, markers);
    const surfaceOutcome =
      providerCompleted && callbacksRan && followupDelivered
        ? 'callback-delivered'
        : providerCompleted
          ? 'callback-unavailable'
          : versionRun.spawnFailed
            ? 'provider-unavailable'
            : 'provider-process-failed';

    result = {
      schemaVersion: 1,
      probe: PROBE_NAME,
      mode,
      executionStatus: 'completed',
      evidenceLabel:
        surfaceOutcome === 'callback-delivered'
          ? 'live-validated'
          : 'unavailable',
      provider: {
        name: 'Cursor Agent',
        version: sanitizedProviderVersion(versionRun),
        architecture: process.arch,
      },
      bounds: {
        processCapMs,
        hookTimeoutSeconds: recipe.bounds.hookTimeoutSeconds,
        followupLoopLimit: recipe.bounds.followupLoopLimit,
      },
      safety: {
        temporaryWorkspaceOnly: true,
        existingProviderTranscripts: 'not-read-or-mutated',
        credentialsRequested: false,
        daemonStarted: false,
        schedulerStarted: false,
        externalServiceStarted: false,
      },
      setup: {
        hooksConfigVersion: recipe.hooksConfig.version,
        hookEvents: Object.keys(recipe.hooksConfig.hooks),
        hookScriptPresent: true,
        childDefinitionPresent: recipe.childDefinition !== null,
        fixedPrompt: true,
        fixedMarkers: recipe.markers,
      },
      rows: [
        outcomeRow(
          'provider-version',
          { available: true },
          { available: sanitizedProviderVersion(versionRun) !== 'unavailable' },
          sanitizedProviderVersion(versionRun) !== 'unavailable'
            ? 'passed'
            : 'unavailable',
        ),
        outcomeRow(
          'bounded-provider-process',
          { commandRun: true, exitCode: 0, timedOut: false },
          {
            commandRun: providerRun.commandRun,
            exitCode: providerRun.exitCode,
            timedOut: providerRun.timedOut,
          },
          providerCompleted ? 'passed' : 'unavailable',
        ),
        outcomeRow(
          'lifecycle-hooks',
          Object.fromEntries(recipe.expectedHooks.map((hook) => [hook, 1])),
          hooks,
          callbacksRan ? 'passed' : 'unavailable',
        ),
        outcomeRow(
          'fixed-markers',
          Object.fromEntries(recipe.markers.map((marker) => [marker, true])),
          markers,
          followupDelivered ? 'passed' : 'unavailable',
        ),
        outcomeRow(
          'surface-outcome',
          { callbackDelivered: true },
          {
            callbackDelivered: followupDelivered,
            outcome: surfaceOutcome,
          },
          surfaceOutcome === 'callback-delivered' ? 'passed' : 'unavailable',
        ),
      ],
      cleanup: {
        attempted: false,
        succeeded: false,
        workspaceExistsAfter: true,
        diagnostic: 'pending',
      },
    };
  } finally {
    const cleanup = await temporary.cleanup();
    if (result) result.cleanup = cleanup;
  }

  return result;
}

function parseArgs(argv) {
  let mode;
  let describe = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--mode') {
      mode = argv[++index];
    } else if (argument === '--describe') {
      describe = true;
    } else if (argument !== '--json') {
      throw new Error('unknown argument');
    }
  }

  if (describe) return { describe: true };
  if (
    mode !== CURSOR_WAKE_PROBE_MODES.TOP_LEVEL_STOP &&
    mode !== CURSOR_WAKE_PROBE_MODES.MANAGED_SUBAGENT
  ) {
    throw new Error('mode must be top-level-stop or managed-subagent');
  }
  return { describe: false, mode };
}

async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const output = options.describe
      ? describeCursorWakeProbeRecipes()
      : await runCursorWakeProbe(options.mode);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output.cleanup?.succeeded === false ? 2 : 0;
  } catch {
    process.stdout.write(
      `${JSON.stringify({
        schemaVersion: 1,
        probe: PROBE_NAME,
        executionStatus: 'error',
        diagnostic: 'probe-error',
      })}\n`,
    );
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
