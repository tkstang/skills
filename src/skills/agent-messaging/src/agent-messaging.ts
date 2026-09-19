#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  activationStatus,
  DeliveryError,
  disableActivation,
  enableActivation,
  MAX_ACTIVATION_DURATION_MS,
  recordHumanActivity,
} from '../../../shared/collaboration/activation.js';
import {
  createDeliveryRetry,
  deliveryClaimStatus,
} from '../../../shared/collaboration/claims.js';
import { latestDeliveryDiagnostic } from '../../../shared/collaboration/diagnostics.js';
import {
  appendLogEntry,
  getLogView,
  renderLog,
} from '../../../shared/collaboration/log.js';
import {
  closeCollaboration,
  joinCollaboration,
  leaveCollaboration,
  MembershipError,
  openCollaboration,
  resolveMemberByPin,
  takeOverMembership,
} from '../../../shared/collaboration/membership.js';
import {
  acknowledgeMessage,
  listInbox,
  readMessage,
  sendMessage,
} from '../../../shared/collaboration/messages.js';
import {
  collaborationPaths,
  resolveCollaborationRoot,
} from '../../../shared/collaboration/paths.js';
import {
  CollaborationError,
  readJsonRecord,
} from '../../../shared/collaboration/records.js';
import {
  assertPin,
  assertUuid,
  pinsEqual,
  type MessageKind,
  type MessagePriority,
  type Pin,
  type ClosedRecord,
} from '../../../shared/collaboration/types.js';
import {
  assessAutomaticOwnership,
  claudeSessionHookDeclaration,
  inspectClaudeStopInventory,
  inspectCodexStopInventory,
  installCodexMessagingHooks,
  uninstallCodexMessagingHooks,
} from './registration.js';
import { watchInbox } from './watch.js';

export interface CliIo {
  env: NodeJS.ProcessEnv;
  cwd: string;
  readStdin: () => Promise<string>;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

interface Parsed {
  positionals: string[];
  flags: Map<string, string | boolean>;
}

interface ContextualError extends Error {
  collaborationId?: string;
  paths?: ReturnType<typeof collaborationPaths>;
}

function attachOpenContext(
  error: unknown,
  collaborationId: string,
  root: string,
): ContextualError {
  const contextual = (
    error instanceof Error ? error : new Error(String(error))
  ) as ContextualError;
  contextual.collaborationId = collaborationId;
  contextual.paths = collaborationPaths(root, collaborationId);
  return contextual;
}

const HELP = `agent-messaging — durable addressed messaging between local coding-agent sessions

Usage:
  node agent-messaging.mjs open --self <runtime:id> --alias <name> --label <label> --task <text>
  node agent-messaging.mjs join --collab <uuid> --self <runtime:id> --alias <name>
  node agent-messaging.mjs send --collab <uuid> --self <runtime:id> --to <alias> --id <uuid> --subject <text> --body-stdin [--reply-to <participantId>/<messageId>]
  node agent-messaging.mjs inbox|ack|status|leave|close ...
  node agent-messaging.mjs delivery enable|disable|activity|retry|watch ...
  node agent-messaging.mjs log append|show|render ...

Common flags: --root <absolute-path> --json --help`;

function defaultReadStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    process.stdin.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 33 * 1024) {
        reject(new TypeError('stdin exceeds the bounded body envelope'));
        process.stdin.destroy();
      } else chunks.push(chunk);
    });
    process.stdin.on('end', () =>
      resolve(Buffer.concat(chunks).toString('utf8')),
    );
    process.stdin.on('error', reject);
  });
}

function defaultIo(): CliIo {
  return {
    env: process.env,
    cwd: process.cwd(),
    readStdin: defaultReadStdin,
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  };
}

function parse(argv: readonly string[]): Parsed {
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if (
      [
        'json',
        'help',
        'all',
        'body-stdin',
        'what-stdin',
        'confirm-no-observer-monitor',
      ].includes(name)
    ) {
      flags.set(name, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--'))
      throw new TypeError(`--${name} requires a value`);
    flags.set(name, value);
    index += 1;
  }
  return { positionals, flags };
}

function required(parsed: Parsed, name: string): string {
  const value = parsed.flags.get(name);
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`--${name} is required`);
  return value;
}

function optional(parsed: Parsed, name: string): string | undefined {
  const value = parsed.flags.get(name);
  return typeof value === 'string' ? value : undefined;
}

function integer(parsed: Parsed, name: string, fallback: number): number {
  const value = optional(parsed, name);
  if (value === undefined) return fallback;
  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue))
    throw new TypeError(`--${name} must be an integer`);
  return parsedValue;
}

function duration(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const match = /^(\d+)(ms|s|m|h)$/u.exec(value);
  if (!match) throw new TypeError('duration must use ms, s, m, or h');
  const amount = Number(match[1]);
  const multiplier = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[
    match[2] as 'ms' | 's' | 'm' | 'h'
  ];
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0)
    throw new TypeError('duration is out of range');
  return milliseconds;
}

function parsePin(value: string): Pin {
  const separator = value.indexOf(':');
  if (separator <= 0) throw new TypeError('self pin must be runtime:sessionId');
  const pin = {
    runtime: value.slice(0, separator),
    sessionId: value.slice(separator + 1),
  };
  assertPin(pin);
  return pin;
}

function parseReplyTo(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TypeError('--reply-to must be <participantId>/<messageId>');
  }
  assertUuid(parts[0], 'reply participant ID');
  assertUuid(parts[1], 'reply message ID');
  return { participantId: parts[0], messageId: parts[1] };
}

function harnessPin(env: NodeJS.ProcessEnv): Pin | null {
  if (env.AGENT_MESSAGING_SELF_PIN)
    return parsePin(env.AGENT_MESSAGING_SELF_PIN);
  if (env.CODEX_THREAD_ID)
    return { runtime: 'codex', sessionId: env.CODEX_THREAD_ID };
  if (env.CLAUDE_SESSION_ID)
    return { runtime: 'claude-code', sessionId: env.CLAUDE_SESSION_ID };
  if (env.CURSOR_SESSION_ID)
    return { runtime: 'cursor', sessionId: env.CURSOR_SESSION_ID };
  return null;
}

function resolveSelf(parsed: Parsed, env: NodeJS.ProcessEnv): Pin {
  const explicit = optional(parsed, 'self');
  const detected = harnessPin(env);
  if (explicit) {
    const pin = parsePin(explicit);
    if (detected && !pinsEqual(pin, detected)) {
      const error = new TypeError(
        'explicit --self conflicts with the available harness identity',
      );
      error.name = 'IDENTITY_CONFLICT';
      throw error;
    }
    return pin;
  }
  if (detected) return detected;
  throw new TypeError(
    '--self is required when no exact harness identity is available',
  );
}

function rootFor(parsed: Parsed, env: NodeJS.ProcessEnv): string {
  const explicit = optional(parsed, 'root');
  if (explicit) {
    if (!path.isAbsolute(explicit))
      throw new TypeError('--root must be absolute');
    return path.resolve(explicit);
  }
  return resolveCollaborationRoot(env);
}

function success(
  operation: string,
  collaborationId: string | null,
  data: unknown,
) {
  return { ok: true, operation, collaborationId, data };
}

function exitFor(error: unknown): number {
  if (
    error instanceof MembershipError &&
    ['COLLABORATION_CLOSED', 'MEMBER_DEPARTED'].includes(error.code)
  )
    return 3;
  if (error instanceof DeliveryError && error.code === 'DELIVERY_INACTIVE')
    return 3;
  if (
    error instanceof TypeError ||
    error instanceof MembershipError ||
    error instanceof DeliveryError
  )
    return 2;
  if (
    error instanceof CollaborationError &&
    error.code === 'RECORD_CONFLICT' &&
    error.message.includes('closed')
  )
    return 3;
  return 1;
}

function errorCode(error: unknown): string {
  if (
    error instanceof CollaborationError ||
    error instanceof MembershipError ||
    error instanceof DeliveryError
  )
    return error.code;
  if (error instanceof Error && error.name === 'IDENTITY_CONFLICT')
    return 'IDENTITY_CONFLICT';
  return error instanceof TypeError ? 'INVALID_INPUT' : 'RUNTIME_ERROR';
}

async function unresolvedSummary(
  root: string,
  collaborationId: string,
  pin: Pin,
) {
  try {
    const inbox = await listInbox({
      root,
      collaborationId,
      pin,
      maxMessages: 4096,
      maxBytes: Number.MAX_SAFE_INTEGER,
    });
    return {
      unresolvedCount: inbox.messages.length,
      unresolvedMessageIds: inbox.messages.map((message) => message.id),
      summaryError: null,
    };
  } catch (error) {
    return {
      unresolvedCount: null,
      unresolvedMessageIds: [],
      summaryError: {
        code: errorCode(error),
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function execute(
  parsed: Parsed,
  io: CliIo,
): Promise<{
  operation: string;
  collaborationId: string | null;
  data: unknown;
}> {
  const [command, subcommand] = parsed.positionals;
  if (!command) throw new TypeError('a command is required');
  const root = rootFor(parsed, io.env);
  if (command === 'open') {
    const collaborationId = optional(parsed, 'collab') ?? randomUUID();
    const self = resolveSelf(parsed, io.env);
    const result = await openCollaboration({
      root,
      collaborationId,
      pin: self,
      alias: required(parsed, 'alias'),
      label: required(parsed, 'label'),
      task: required(parsed, 'task'),
      worktree: optional(parsed, 'cwd') ?? io.cwd,
    }).catch((error) => {
      throw attachOpenContext(error, collaborationId, root);
    });
    return {
      operation: 'open',
      collaborationId,
      data: {
        ...result,
        root,
        paths: collaborationPaths(root, collaborationId),
      },
    };
  }
  const collaborationId = required(parsed, 'collab');
  if (command === 'join') {
    const pin = resolveSelf(parsed, io.env);
    const succeeds = optional(parsed, 'succeeds');
    const input = {
      root,
      collaborationId,
      pin,
      alias: required(parsed, 'alias'),
      worktree: optional(parsed, 'cwd') ?? io.cwd,
    };
    const result = succeeds
      ? await takeOverMembership({
          ...input,
          expectedPreviousPin: parsePin(succeeds),
          reason: required(parsed, 'reason'),
        })
      : await joinCollaboration(input);
    return { operation: 'join', collaborationId, data: result };
  }
  if (command === 'send') {
    const body = parsed.flags.has('body-stdin')
      ? await io.readStdin()
      : required(parsed, 'body');
    const result = await sendMessage({
      root,
      collaborationId,
      senderPin: resolveSelf(parsed, io.env),
      recipientAlias: required(parsed, 'to'),
      id: required(parsed, 'id'),
      kind: (optional(parsed, 'kind') ?? 'update') as MessageKind,
      priority: (optional(parsed, 'priority') ?? 'normal') as MessagePriority,
      subject: required(parsed, 'subject'),
      body,
      replyTo: parseReplyTo(optional(parsed, 'reply-to')),
    });
    return {
      operation: 'send',
      collaborationId,
      data: {
        ...result,
        queued: true,
        paths: collaborationPaths(root, collaborationId),
      },
    };
  }
  if (command === 'inbox') {
    const pin = resolveSelf(parsed, io.env);
    const messageId = optional(parsed, 'message');
    const data = messageId
      ? await readMessage({ root, collaborationId, pin, messageId })
      : await listInbox({
          root,
          collaborationId,
          pin,
          includeAcknowledged: parsed.flags.has('all'),
        });
    return { operation: 'inbox', collaborationId, data };
  }
  if (command === 'ack') {
    const data = await acknowledgeMessage({
      root,
      collaborationId,
      pin: resolveSelf(parsed, io.env),
      messageId: required(parsed, 'message'),
    });
    return { operation: 'ack', collaborationId, data };
  }
  if (command === 'delivery' && subcommand === 'enable') {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime === 'cursor')
      throw new DeliveryError(
        'DELIVERY_INACTIVE',
        'Cursor automatic delivery is unverified; use the manual inbox',
      );
    const expiryMode = optional(parsed, 'expiry-mode') ?? 'fixed';
    if (!['fixed', 'human-idle'].includes(expiryMode))
      throw new TypeError('--expiry-mode must be fixed or human-idle');
    const worktree = optional(parsed, 'cwd') ?? io.cwd;
    const inventory =
      pin.runtime === 'codex'
        ? await inspectCodexStopInventory(
            optional(parsed, 'hooks-path') ??
              path.join(io.env.HOME ?? io.cwd, '.codex', 'hooks.json'),
          )
        : await inspectClaudeStopInventory({
            settingsPaths: (optional(parsed, 'settings-paths') ?? '')
              .split(path.delimiter)
              .filter(Boolean),
            installedPlugins: optional(parsed, 'installed-plugins')
              ? (JSON.parse(required(parsed, 'installed-plugins')) as Record<
                  string,
                  string
                >)
              : {},
          });
    const ownership = await assessAutomaticOwnership({
      root,
      pin,
      worktree,
      inventory,
      acknowledgedFingerprint:
        optional(parsed, 'acknowledge-stop-hooks') ?? null,
    });
    if (!ownership.automaticAllowed) {
      throw new DeliveryError(
        'DELIVERY_INACTIVE',
        `${ownership.reason}${ownership.recoveryCommand ? `; recovery: ${ownership.recoveryCommand}` : ''}`,
      );
    }
    if (
      pin.runtime === 'claude-code' &&
      !parsed.flags.has('confirm-no-observer-monitor')
    ) {
      throw new DeliveryError(
        'DELIVERY_INACTIVE',
        'Claude standalone delivery requires --confirm-no-observer-monitor from the acting session',
      );
    }
    const data = await enableActivation({
      root,
      collaborationId,
      pin,
      worktree,
      activationId: optional(parsed, 'activation-id'),
      mechanism: (optional(parsed, 'mechanism') ?? 'stop') as
        | 'stop'
        | 'monitor',
      expiryMode: expiryMode as 'fixed' | 'human-idle',
      idleTimeoutMs: duration(
        optional(parsed, 'idle-timeout'),
        2 * 60 * 60 * 1000,
      ),
      fixedDurationMs: duration(
        optional(parsed, 'expires-in'),
        2 * 60 * 60 * 1000,
      ),
      maxDurationMs: duration(
        optional(parsed, 'max-duration'),
        MAX_ACTIVATION_DURATION_MS,
      ),
      maxContinuations: integer(parsed, 'max-continuations', 20),
      waitMs: integer(parsed, 'wait-ms', 0),
      thirdPartyHookAcknowledgment: ownership.acknowledgedFingerprint
        ? {
            configurationFingerprint: ownership.acknowledgedFingerprint,
            acknowledgedAt: new Date().toISOString(),
          }
        : null,
      noObserverMonitorConfirmed:
        pin.runtime === 'claude-code' &&
        parsed.flags.has('confirm-no-observer-monitor'),
    });
    return { operation: 'delivery.enable', collaborationId, data };
  }
  if (command === 'delivery' && subcommand === 'disable') {
    return {
      operation: 'delivery.disable',
      collaborationId,
      data: await disableActivation({
        root,
        pin: resolveSelf(parsed, io.env),
      }),
    };
  }
  if (command === 'delivery' && subcommand === 'activity') {
    return {
      operation: 'delivery.activity',
      collaborationId,
      data: await recordHumanActivity({
        root,
        pin: resolveSelf(parsed, io.env),
        eventKey: required(parsed, 'event'),
      }),
    };
  }
  if (command === 'delivery' && subcommand === 'retry') {
    return {
      operation: 'delivery.retry',
      collaborationId,
      data: await createDeliveryRetry({
        root,
        pin: resolveSelf(parsed, io.env),
        priorAttemptId: required(parsed, 'attempt'),
        messageId: required(parsed, 'message'),
      }),
    };
  }
  if (command === 'delivery' && subcommand === 'watch') {
    const pin = resolveSelf(parsed, io.env);
    const data = await watchInbox(
      {
        root,
        collaborationId,
        pin,
        worktree: optional(parsed, 'cwd') ?? io.cwd,
        durationMs: duration(optional(parsed, 'duration'), 5 * 60 * 1000),
        pollMs: integer(parsed, 'poll-ms', 1000),
        confirmNoObserverMonitor: parsed.flags.has(
          'confirm-no-observer-monitor',
        ),
        env: io.env,
      },
      {
        emit: (notification) =>
          io.stdout(`${JSON.stringify({ notification })}\n`),
      },
    );
    return { operation: 'delivery.watch', collaborationId, data };
  }
  if (command === 'delivery' && subcommand === 'inspect') {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime === 'cursor') {
      return {
        operation: 'delivery.inspect',
        collaborationId,
        data: {
          capability: 'manual-only',
          reason: 'current Cursor start/Stop delivery is not proven',
        },
      };
    }
    const inventory =
      pin.runtime === 'codex'
        ? await inspectCodexStopInventory(
            optional(parsed, 'hooks-path') ??
              path.join(io.env.HOME ?? io.cwd, '.codex', 'hooks.json'),
          )
        : await inspectClaudeStopInventory({
            settingsPaths: (optional(parsed, 'settings-paths') ?? '')
              .split(path.delimiter)
              .filter(Boolean),
            installedPlugins: {},
          });
    return {
      operation: 'delivery.inspect',
      collaborationId,
      data: await assessAutomaticOwnership({
        root,
        pin,
        worktree: optional(parsed, 'cwd') ?? io.cwd,
        inventory,
        acknowledgedFingerprint:
          optional(parsed, 'acknowledge-stop-hooks') ?? null,
      }),
    };
  }
  if (command === 'delivery' && subcommand === 'register') {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime === 'cursor')
      throw new DeliveryError(
        'DELIVERY_INACTIVE',
        'Cursor automatic delivery is unverified; use the manual inbox',
      );
    const scriptPath = required(parsed, 'script-path');
    const worktree = optional(parsed, 'cwd') ?? io.cwd;
    const hooksPath = optional(parsed, 'hooks-path');
    const inventory =
      pin.runtime === 'codex'
        ? await inspectCodexStopInventory(
            hooksPath ??
              path.join(io.env.HOME ?? io.cwd, '.codex', 'hooks.json'),
          )
        : await inspectClaudeStopInventory({
            settingsPaths: (optional(parsed, 'settings-paths') ?? '')
              .split(path.delimiter)
              .filter(Boolean),
            installedPlugins: optional(parsed, 'installed-plugins')
              ? (JSON.parse(required(parsed, 'installed-plugins')) as Record<
                  string,
                  string
                >)
              : {},
          });
    const ownership = await assessAutomaticOwnership({
      root,
      pin,
      worktree,
      inventory,
      acknowledgedFingerprint:
        optional(parsed, 'acknowledge-stop-hooks') ?? null,
    });
    if (!ownership.automaticAllowed) {
      throw new DeliveryError(
        'DELIVERY_INACTIVE',
        `${ownership.reason}${ownership.recoveryCommand ? `; recovery: ${ownership.recoveryCommand}` : ''}`,
      );
    }
    return {
      operation: 'delivery.register',
      collaborationId,
      data:
        pin.runtime === 'codex'
          ? await installCodexMessagingHooks({
              hooksPath: hooksPath ?? required(parsed, 'hooks-path'),
              scriptPath,
            })
          : {
              changed: false,
              declaration: claudeSessionHookDeclaration(scriptPath),
              notice:
                'Generate only: apply this session-scoped declaration explicitly; trust and invocation remain unverified.',
            },
    };
  }
  if (command === 'delivery' && subcommand === 'unregister') {
    const pin = resolveSelf(parsed, io.env);
    if (pin.runtime !== 'codex')
      throw new TypeError(
        'Claude session-scoped declarations are removed by their owning session configuration',
      );
    return {
      operation: 'delivery.unregister',
      collaborationId,
      data: await uninstallCodexMessagingHooks({
        hooksPath: required(parsed, 'hooks-path'),
        scriptPath: required(parsed, 'script-path'),
      }),
    };
  }
  if (command === 'log' && subcommand === 'append') {
    const whatHappened = parsed.flags.has('what-stdin')
      ? await io.readStdin()
      : required(parsed, 'what');
    const data = await appendLogEntry({
      root,
      collaborationId,
      pin: resolveSelf(parsed, io.env),
      id: required(parsed, 'id'),
      category: required(parsed, 'category'),
      title: required(parsed, 'title'),
      whatHappened,
      assessment: required(parsed, 'assessment'),
      skillImplication: required(parsed, 'implication'),
    });
    return { operation: 'log.append', collaborationId, data };
  }
  if (command === 'log' && subcommand === 'render') {
    return {
      operation: 'log.render',
      collaborationId,
      data: await renderLog({ root, collaborationId }),
    };
  }
  if (command === 'log' && subcommand === 'show') {
    return {
      operation: 'log.show',
      collaborationId,
      data: await getLogView({ root, collaborationId }),
    };
  }
  if (command === 'status') {
    const pin = resolveSelf(parsed, io.env);
    const member = await resolveMemberByPin(root, collaborationId, pin);
    if (member.departed) {
      throw new MembershipError('MEMBER_DEPARTED', 'member is inactive');
    }
    const paths = collaborationPaths(root, collaborationId);
    const closed = await readJsonRecord<ClosedRecord>(paths.closed, {
      root,
    }).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false;
        throw error;
      },
    );
    const inbox = await listInbox({
      root,
      collaborationId,
      pin,
      includeAcknowledged: true,
    }).catch((error) => ({
      error: {
        code: errorCode(error),
        message: error instanceof Error ? error.message : String(error),
      },
    }));
    const logView = await getLogView({ root, collaborationId });
    const delivery = await activationStatus(root, pin);
    const claims = await deliveryClaimStatus({ root, pin });
    const diagnostics = await latestDeliveryDiagnostic({ root, pin });
    return {
      operation: 'status',
      collaborationId,
      data: {
        root,
        paths,
        closed,
        member,
        inbox,
        delivery: {
          ...delivery,
          slots: claims,
          latestDiagnostic: diagnostics.latest,
          diagnosticCapacityError: diagnostics.capacityError,
          interruptedAttempts: claims.interruptedAttempts.map((attemptId) => ({
            attemptId,
            state: 'interrupted attempt — retry available',
            retryCommand: `node <skill-dir>/scripts/agent-messaging.mjs delivery retry --collab ${collaborationId} --self ${pin.runtime}:${pin.sessionId} --attempt ${attemptId} --message <uuid>`,
          })),
          outcomeUnknown: claims.outcomeUnknown.map((attemptId) => ({
            attemptId,
            state: 'output attempt recorded; host receipt outcome unknown',
          })),
          deliveryClaim:
            'attempt evidence only; never proof of delivery or acknowledgment',
        },
        logView: {
          path: logView.path,
          digest: logView.digest,
          stale: logView.stale,
        },
      },
    };
  }
  if (command === 'leave') {
    const pin = resolveSelf(parsed, io.env);
    const summary = await unresolvedSummary(root, collaborationId, pin);
    const member = await resolveMemberByPin(root, collaborationId, pin);
    const result = await leaveCollaboration({
      root,
      collaborationId,
      pin,
      alias: member.member.alias,
    });
    return {
      operation: 'leave',
      collaborationId,
      data: { result, ...summary, acknowledged: false, completed: false },
    };
  }
  if (command === 'close') {
    const pin = resolveSelf(parsed, io.env);
    const result = await closeCollaboration({ root, collaborationId, pin });
    const summary = await unresolvedSummary(root, collaborationId, pin);
    return {
      operation: 'close',
      collaborationId,
      data: { result, ...summary, acknowledged: false, completed: false },
    };
  }
  throw new TypeError(
    `unknown command: ${[command, subcommand].filter(Boolean).join(' ')}`,
  );
}

export async function runAgentMessagingCli(
  argv: readonly string[],
  io: CliIo = defaultIo(),
): Promise<number> {
  let parsed: Parsed;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(
      `${JSON.stringify({ ok: false, operation: null, code: errorCode(error), message: error instanceof Error ? error.message : String(error), retryable: false, paths: null })}\n`,
    );
    return 2;
  }
  if (parsed.flags.has('help') || parsed.positionals[0] === '--help') {
    io.stdout(`${HELP}\n`);
    return 0;
  }
  try {
    const result = await execute(parsed, io);
    const envelope = success(
      result.operation,
      result.collaborationId,
      result.data,
    );
    io.stdout(
      `${JSON.stringify(envelope, null, parsed.flags.has('json') ? 0 : 2)}\n`,
    );
    return 0;
  } catch (error) {
    const contextual =
      error instanceof Error ? (error as ContextualError) : null;
    const operation = parsed.positionals.slice(0, 2).join('.');
    const envelope = {
      ok: false,
      operation,
      collaborationId: contextual?.collaborationId ?? null,
      code: errorCode(error),
      message: error instanceof Error ? error.message : String(error),
      retryable: error instanceof CollaborationError ? error.retryable : false,
      paths: contextual?.paths ?? null,
    };
    io.stderr(`${JSON.stringify(envelope)}\n`);
    return exitFor(error);
  }
}

if (
  process.argv[1] &&
  realpathSync(path.resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url))
) {
  runAgentMessagingCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
