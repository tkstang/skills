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
    expect(content).toContain('the Claude Monitor\nacceptance-matrix row remains **unvalidated**');
    expect(content).toContain('The current honest posture is\n`buffered-manual`');
  });

  test('requires a pinned quiet watcher and the complete live evidence sequence', async () => {
    const content = await reference();

    expect(content).toContain('catch-up-then-watch');
    expect(content).toContain('--session claude-code:<peer-session-id>');
    expect(content).toContain('--quiet-empty');
    expect(content).toContain('--heartbeat-sec 0');
    expect(content).toContain('## Required live Monitor sequence');
    expect(content).toContain('same Claude Code session');
    expect(content).toContain('same-session client');
    expect(content).toContain('later peer turn produces no notification');
  });
});
