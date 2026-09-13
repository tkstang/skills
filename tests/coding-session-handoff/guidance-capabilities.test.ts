import { describe, expect, it } from 'vitest';

import {
  GUIDANCE_CAPABILITIES,
  getGuidanceCapability,
} from '../../src/transcript/coding-session-handoff/guidance-capabilities.js';

describe('guidance capabilities', () => {
  it('defines each provider surface independently with dated official evidence', () => {
    expect(
      GUIDANCE_CAPABILITIES.map(
        ({ provider, surface }) => `${provider}:${surface}`,
      ),
    ).toEqual(['claude:cli', 'codex:cli', 'cursor:cli', 'cursor:ide']);

    for (const capability of GUIDANCE_CAPABILITIES) {
      expect(capability.evidence.length).toBeGreaterThan(0);
      for (const evidence of capability.evidence) {
        expect(evidence.retrievedOn).toBe('2026-09-12');
        expect(new URL(evidence.url).protocol).toBe('https:');
        expect(evidence.context.length).toBeGreaterThan(0);
      }
      expect(capability.limitations.length).toBeGreaterThan(0);
    }
  });

  it('keeps fork and resume semantics distinct', () => {
    expect(getGuidanceCapability('codex', 'cli').fork).toMatchObject({
      status: 'documented',
      preservesOriginal: true,
      kind: 'terminal',
      argv: ['codex', 'fork', '{sessionId}'],
    });
    expect(getGuidanceCapability('claude', 'cli').fork).toMatchObject({
      status: 'documented',
      preservesOriginal: true,
      kind: 'terminal',
      argv: ['claude', '--resume', '{sessionId}', '--fork-session'],
    });
  });

  it('fails closed where official evidence does not establish a destination-safe fork', () => {
    expect(getGuidanceCapability('cursor', 'cli').fork).toEqual({
      status: 'unsupported',
      reason: expect.stringContaining('no documented Cursor CLI fork'),
    });
    expect(getGuidanceCapability('cursor', 'ide').fork).toMatchObject({
      status: 'documented-manual',
      kind: 'manual',
      preservesOriginal: true,
    });
    expect(getGuidanceCapability('cursor', 'ide').destinationSwitch).toEqual({
      status: 'unsupported',
      reason: expect.stringContaining('cross-worktree'),
    });
  });

  it('does not expose executable syntax for unsupported or unverified operations', () => {
    for (const capability of GUIDANCE_CAPABILITIES) {
      for (const operation of [capability.fork, capability.destinationSwitch]) {
        if (operation.status !== 'documented') {
          expect('argv' in operation).toBe(false);
        }
      }
    }
  });

  it('rejects unknown provider and surface combinations', () => {
    expect(() => getGuidanceCapability('cursor', 'desktop' as never)).toThrow(
      'unsupported-guidance-surface',
    );
  });
});
