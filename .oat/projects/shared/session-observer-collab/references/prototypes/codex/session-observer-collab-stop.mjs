#!/usr/bin/env node

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function readStdin() {
  return new Promise((resolvePromise, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolvePromise(JSON.parse(input || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

function safeSessionId(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function recordText(record) {
  const content = record?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
}

function isSubstantivePeerText(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return false;

  return !(
    /^\[no-op\](?:\s|$)/i.test(normalized) ||
    /^metadata-only delta\b/i.test(normalized) ||
    /^\*?no messages in range\b/i.test(normalized) ||
    /^(?:quiet|empty) (?:delta|update)\b/i.test(normalized) ||
    /\bstatus echo only\b/i.test(normalized) ||
    /\bnothing (?:further )?(?:is )?needed from me\b/i.test(normalized) ||
    /\bno reply needed\b/i.test(normalized)
  );
}

function findCompletedAssistantTrigger(lines, startIndex, triggerText) {
  let matchingAssistantIndex = -1;
  let matchingText = '';
  let latestCompletedTrigger = null;

  for (let index = Math.max(0, startIndex); index < lines.length; index += 1) {
    let record;
    try {
      record = JSON.parse(lines[index]);
    } catch {
      continue;
    }

    if (record?.type === 'assistant' && record?.message?.role === 'assistant') {
      const text = recordText(record);
      if (
        text &&
        (triggerText ? text.includes(triggerText) : isSubstantivePeerText(text))
      ) {
        matchingAssistantIndex = index;
        matchingText = text;
      }
      continue;
    }

    if (
      matchingAssistantIndex >= 0 &&
      record?.type === 'system' &&
      record?.subtype === 'turn_duration'
    ) {
      latestCompletedTrigger = {
        assistantIndex: matchingAssistantIndex,
        completedIndex: index,
        preview: matchingText.slice(0, 160),
      };
      matchingAssistantIndex = -1;
      matchingText = '';
    }
  }

  return latestCompletedTrigger;
}

function removeLease(path) {
  rmSync(path, { force: true });
}

async function main() {
  const hook = await readStdin();
  if (hook?.hook_event_name !== 'Stop' || !hook?.session_id || !hook?.cwd) return;

  const stateRoot =
    process.env.SESSION_OBSERVER_STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer');
  const leasePath = join(
    stateRoot,
    'collab-leases',
    `${safeSessionId(hook.session_id)}.json`,
  );

  if (!existsSync(leasePath)) return;

  let lease;
  try {
    lease = loadJson(leasePath);
  } catch {
    removeLease(leasePath);
    return;
  }

  const now = Date.now();
  const expiresAt = Date.parse(lease.expiresAt ?? '');
  const expectedCwd = resolve(String(lease.cwd ?? ''));
  const actualCwd = resolve(String(hook.cwd));
  const peerTranscript = String(lease.peerTranscript ?? '');
  const maxContinuations = Math.max(1, Number(lease.maxContinuations ?? 1));
  const continuationCount = Math.max(0, Number(lease.continuationCount ?? 0));

  if (
    lease.enabled !== true ||
    lease.codexSessionId !== hook.session_id ||
    expectedCwd !== actualCwd ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    !existsSync(expectedCwd) ||
    !peerTranscript ||
    !existsSync(peerTranscript) ||
    continuationCount >= maxContinuations
  ) {
    removeLease(leasePath);
    return;
  }

  const inactivityTimeoutSeconds = Math.min(
    3600,
    Math.max(
      1,
      Number(lease.inactivityTimeoutSeconds ?? lease.waitSeconds ?? 5),
    ),
  );
  const pollMilliseconds = Math.min(
    5000,
    Math.max(100, Number(lease.pollMilliseconds ?? 500)),
  );
  const deadline = Math.min(expiresAt, now + inactivityTimeoutSeconds * 1000);
  const startIndex = Math.max(0, Number(lease.peerCursor ?? 0));

  writeJson(leasePath, {
    ...lease,
    state: 'waiting',
    inactivityTimeoutSeconds,
    observationWindowStartedAt: new Date().toISOString(),
    lastRanAt: new Date().toISOString(),
  });

  while (Date.now() < deadline) {
    let lines;
    try {
      lines = readFileSync(peerTranscript, 'utf8').trimEnd().split('\n');
    } catch {
      removeLease(leasePath);
      return;
    }

    const trigger = findCompletedAssistantTrigger(
      lines,
      startIndex,
      typeof lease.triggerText === 'string' ? lease.triggerText : '',
    );

    if (trigger) {
      const nextCount = continuationCount + 1;
      const remainsArmed = nextCount < maxContinuations;
      writeJson(leasePath, {
        ...lease,
        enabled: remainsArmed,
        state: remainsArmed ? 'armed' : 'disarmed',
        continuationCount: nextCount,
        peerCursor: trigger.completedIndex + 1,
        observationWindowStartedAt: null,
        lastRanAt: new Date().toISOString(),
        lastTriggeredAt: new Date().toISOString(),
        lastTriggerRecord: trigger.completedIndex,
      });

      const peerSession = `${lease.peerRuntime}:${lease.peerSessionId}`;
      process.stdout.write(
        `${JSON.stringify({
          decision: 'block',
          reason:
            `Session Observer collaboration wake fired for ${peerSession}. ` +
            `Review the pinned peer session from records ${startIndex}-${trigger.completedIndex}, ` +
            `respond to the peer and user, then report whether this continuation was automatic. ` +
            (remainsArmed
              ? `The recurring collaboration lease remains armed for the next Stop boundary.`
              : `The collaboration lease is now disarmed.`),
        })}\n`,
      );
      return;
    }

    await sleep(pollMilliseconds);
  }

  writeJson(leasePath, {
    ...lease,
    state: 'idle',
    observationWindowStartedAt: null,
    lastRanAt: new Date().toISOString(),
    lastTimedOutAt: new Date().toISOString(),
  });
}

main().catch(() => {
  process.exitCode = 0;
});
