import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  activationStatus,
  recordHumanActivity,
} from '../../../../shared/collaboration/activation.js';
import { claimDelivery } from '../../../../shared/collaboration/claims.js';
import { publishDeliveryDiagnostic } from '../../../../shared/collaboration/diagnostics.js';
import { listInbox } from '../../../../shared/collaboration/messages.js';
import { resolveCollaborationRoot } from '../../../../shared/collaboration/paths.js';
import {
  assertBoundedString,
  type InboxMessage,
  type Pin,
} from '../../../../shared/collaboration/types.js';
import {
  assessAutomaticOwnership,
  inspectClaudeStopInventory,
  inspectCodexStopInventory,
} from '../registration.js';

export type HookBoundary = 'prompt-start' | 'stop';

export interface BoundaryInput {
  runtime: 'codex' | 'claude-code';
  sessionId: string;
  cwd: string;
  boundary: HookBoundary;
  eventId: string | null;
  provenHuman: boolean;
  continuationActive: boolean;
}

export interface HookDependencies {
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  diagnostic?: (message: string) => void;
}

function boundedEnvelope(
  messages: InboxMessage[],
  collaborationId: string,
  pin: Pin,
): string {
  const full = messages.map((message) => ({
    id: message.id,
    from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
    kind: message.kind,
    priority: message.priority,
    subject: message.subject,
    body: message.body,
    untrusted: true,
  }));
  const wrap = (payload: unknown) =>
    `<agent_messaging_context automatic="true" untrusted="true">\n${JSON.stringify(payload).replaceAll('<', '\\u003c')}\n</agent_messaging_context>`;
  const complete = wrap({ collaborationId, messages: full });
  if (complete.length <= 6000) return complete;
  return wrap({
    collaborationId,
    messages: messages.map((message) => ({
      id: message.id,
      from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
      kind: message.kind,
      priority: message.priority,
      subject: message.subject,
      readCommand: `node <skill-dir>/scripts/agent-messaging.mjs inbox --collab ${collaborationId} --self ${pin.runtime}:${pin.sessionId} --message ${message.id}`,
    })),
    notice:
      'Bodies exceeded the bounded host envelope; read each exact message before acknowledging it.',
  });
}

async function inventoryFor(input: BoundaryInput, env: NodeJS.ProcessEnv) {
  if (input.runtime === 'codex') {
    const hooksPath =
      env.AGENT_MESSAGING_HOOKS_PATH ??
      path.join(env.HOME ?? input.cwd, '.codex', 'hooks.json');
    return inspectCodexStopInventory(hooksPath);
  }
  const settingsPaths = (env.AGENT_MESSAGING_CLAUDE_SETTINGS ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const installedPlugins = env.AGENT_MESSAGING_CLAUDE_PLUGINS
    ? (JSON.parse(env.AGENT_MESSAGING_CLAUDE_PLUGINS) as Record<string, string>)
    : {};
  return inspectClaudeStopInventory({ settingsPaths, installedPlugins });
}

export async function handleBoundary(
  input: BoundaryInput,
  dependencies: HookDependencies = {},
): Promise<{ output: object | null; envelope: string | null }> {
  assertBoundedString(input.sessionId, 'native session ID', 128);
  if (!path.isAbsolute(input.cwd))
    throw new TypeError('native cwd must be absolute');
  if (input.continuationActive || !input.eventId)
    return { output: null, envelope: null };
  assertBoundedString(input.eventId, 'native event ID', 128);
  const env = dependencies.env ?? process.env;
  const currentTime = dependencies.now ?? (() => new Date());
  const now = currentTime();
  const root = resolveCollaborationRoot(env);
  const pin = {
    runtime: input.runtime,
    sessionId: input.sessionId,
  } satisfies Pin;
  const status = await activationStatus(root, pin, now);
  if (!status.activation || !status.active)
    return { output: null, envelope: null };
  if (
    status.activation.worktree !== path.resolve(input.cwd) ||
    status.activation.controller !== 'standalone-messaging' ||
    status.activation.mechanism !== 'stop'
  ) {
    return { output: null, envelope: null };
  }
  if (
    input.runtime === 'claude-code' &&
    (!status.activation.noObserverMonitorAttestation ||
      status.activation.noObserverMonitorAttestation.epoch !==
        status.activation.epoch)
  ) {
    return { output: null, envelope: null };
  }
  const inventory = await inventoryFor(input, env);
  const ownership = await assessAutomaticOwnership({
    root,
    pin,
    worktree: input.cwd,
    inventory,
    acknowledgedFingerprint:
      status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    now,
  });
  if (!ownership.automaticAllowed) return { output: null, envelope: null };
  if (input.boundary === 'prompt-start' && input.provenHuman) {
    await recordHumanActivity({
      root,
      pin,
      eventKey: input.eventId,
      now,
    }).catch(() => undefined);
  }
  let inbox = await listInbox({
    root,
    collaborationId: status.activation.collaborationId,
    pin,
  });
  let eligible =
    input.boundary === 'stop'
      ? inbox.messages.filter((message) => message.kind === 'request')
      : inbox.messages;
  if (
    eligible.length === 0 &&
    input.boundary === 'stop' &&
    status.activation.waitMs > 0
  ) {
    await (
      dependencies.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)))
    )(status.activation.waitMs);
    inbox = await listInbox({
      root,
      collaborationId: status.activation.collaborationId,
      pin,
    });
    eligible = inbox.messages.filter((message) => message.kind === 'request');
  }
  if (eligible.length === 0) return { output: null, envelope: null };
  const finalNow = currentTime();
  const finalStatus = await activationStatus(root, pin, finalNow);
  if (
    !finalStatus.active ||
    finalStatus.activation?.id !== status.activation.id
  ) {
    return { output: null, envelope: null };
  }
  const finalInventory = await inventoryFor(input, env);
  const finalOwnership = await assessAutomaticOwnership({
    root,
    pin,
    worktree: input.cwd,
    inventory: finalInventory,
    acknowledgedFingerprint:
      status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    now: finalNow,
  });
  if (!finalOwnership.automaticAllowed) return { output: null, envelope: null };
  const attemptId = randomUUID();
  const eventKey = `${input.runtime}:${input.boundary}:${input.eventId}`;
  const claim = await claimDelivery({
    root,
    pin,
    eventKey,
    deliveryKeys: eligible.map((message) => ({
      messageId: message.id,
      retryGeneration: 0,
    })),
    token: attemptId,
    now: finalNow,
  });
  if (!claim.slot || claim.owned.length === 0 || !claim.activeAfterClaim)
    return { output: null, envelope: null };
  const ownedIds = new Set(claim.owned.map((message) => message.messageId));
  const envelope = boundedEnvelope(
    eligible.filter((message) => ownedIds.has(message.id)),
    status.activation.collaborationId,
    pin,
  );
  await publishDeliveryDiagnostic({
    root,
    pin,
    diagnostic: {
      attemptId,
      activationId: status.activation.id,
      eventKey,
      boundary: input.boundary,
      recordedAt: finalNow.toISOString(),
      stage: 'output-attempted',
      outcomeCode: 'host-output-attempted',
      errorCode: null,
    },
  }).catch(() => dependencies.diagnostic?.('diagnostic-write-failed'));
  const output =
    input.boundary === 'stop'
      ? { decision: 'block', reason: envelope }
      : {
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: envelope,
          },
        };
  return { output, envelope };
}
