import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const referencePath = resolve(
  'skills/session-observer-collab/references/runtime-claude-code.md',
);

async function reference() {
  return readFile(referencePath, 'utf8');
}

describe('Claude Code Monitor reference', () => {
  test('keeps Monitor optional and does not promote an unproven harness', async () => {
    const content = await reference();

    expect(content).toContain('harness-native capability');
    expect(content).toContain('`event-wake`');
    expect(content).toContain('`scheduled-poll` or `buffered-manual`');
    expect(content).toContain(
      'Monitor is available but event wake is unvalidated for this session.',
    );
    expect(content).toContain(
      'No autonomous Claude Code wake is available in this environment.',
    );
  });

  test('bounds observed event wake without claiming a universal duration or restart resilience', async () => {
    const content = (await reference()).replace(/\s+/g, ' ');

    expect(content).toContain(
      '`event-wake` was observed repeatedly during each tested Monitor task lifetime in that session',
    );
    expect(content).toContain('approximately 30 minutes in that session');
    expect(content).toContain('not a universal Monitor duration');
    expect(content).toContain('Not exercised: the client was not restarted.');
    expect(content).toContain('Restart resilience remains unvalidated');
    expect(content).not.toContain('30-minute ceiling');
  });

  test('specifies exact-pin re-arm accounting and keeps delivery claims bounded', async () => {
    const content = (await reference()).replace(/\s+/g, ' ');

    expect(content).toContain('Use this bounded exact-pin re-arm procedure');
    expect(content).toContain(
      'Prefer `watch-ctl stop` for the exact active watcher',
    );
    expect(content).toContain('clean SIGTERM');
    expect(content).toContain('normal max-runtime expiry');
    expect(content).toContain('Do not restart with plain `watch`');
    expect(content).toContain('emits a `baseline-gap` warning');
    expect(content).toContain('The raw range is `[fromIndex, nextIndex)`');
    expect(content).toContain('`lastRecordIndex` should equal `nextIndex`');
    expect(content).toContain('`renderedFromIndex` and `renderedToIndex`');
    expect(content).toContain(
      'A rejected stdout write therefore leaves the range consumed',
    );
    expect(content).toContain(
      'even a completed stdout write proves only process output',
    );
    expect(content).toContain(
      'No synthetic test can establish observing-agent delivery',
    );
    expect(content).toContain(
      'alternate owner-polls-before-contender-rollback ordering remains a shared legacy-offset/compare-and-set limitation',
    );
  });

  test('requires a pinned quiet watcher and the complete live evidence sequence', async () => {
    const content = await reference();

    expect(content).toContain('catch-up-then-watch');
    expect(content).toContain(
      'PEER_SESSION="<peer-runtime>:<peer-session-id>"',
    );
    expect(content).toContain('--session "$PEER_SESSION"');
    expect(content).not.toContain('--session claude-code:<peer-session-id>');
    expect(content).toContain('--quiet-empty');
    expect(content).toContain('--heartbeat-sec 0');
    expect(content).toContain('## Required live Monitor sequence');
    expect(content).toContain('same Claude Code session');
    expect(content).toContain('same-session client');
    expect(content).toContain('later peer turn produces no notification');
  });

  test('keeps the selected Claude reference parameterized for every peer runtime', async () => {
    const content = await reference();
    const match = content.match(/PEER_SESSION="([^"]+)"/);

    expect(match?.[1]).toBe('<peer-runtime>:<peer-session-id>');
    for (const runtime of ['claude-code', 'codex', 'cursor']) {
      expect(
        match![1]
          .replace('<peer-runtime>', runtime)
          .replace('<peer-session-id>', `${runtime}-peer`),
      ).toBe(`${runtime}:${runtime}-peer`);
    }
    expect(
      match![1]
        .replace('<peer-runtime>', 'codex')
        .replace('<peer-session-id>', 'codex-peer'),
    ).toBe('codex:codex-peer');
  });
});
