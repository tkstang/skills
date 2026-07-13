import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const sources = [
  resolve('skills/session-observer-collab/SKILL.md'),
  resolve('documentation/docs/user-guide/skills/session-observer-collab.md'),
];
const selectedReferences = [
  resolve('skills/session-observer-collab/references/runtime-claude-code.md'),
  resolve('skills/session-observer-collab/references/runtime-codex.md'),
  resolve('skills/session-observer-collab/references/runtime-cursor.md'),
];

describe('collaboration runtime-reference routing', () => {
  test('loads setup by the acting runtime while pinning the peer runtime', async () => {
    for (const source of sources) {
      const content = await readFile(source, 'utf8');

      expect(content).toContain('acting/self runtime established by `whoami`');
      expect(content).toContain('acting Codex → peer Claude Code');
      expect(content).toContain('acting Claude Code → peer Codex');
      expect(content).toMatch(
        /acting Codex → peer Claude Code[\s\S]*?runtime-codex\.md[\s\S]*?claude-code:<peer-session-id>/,
      );
      expect(content).toMatch(
        /acting Claude Code → peer Codex[\s\S]*?runtime-claude-code\.md[\s\S]*?codex:<peer-session-id>/,
      );
      expect(content).not.toMatch(/Resolve the peer runtime first/i);
      expect(content).not.toMatch(/After resolving the peer runtime/i);
    }
  });

  test('selected runtime references preserve the exact peer pin', async () => {
    const references = await Promise.all(
      selectedReferences.map(async (source) => readFile(source, 'utf8')),
    );
    const claudeReference = references[0]!;

    expect(claudeReference).toContain(
      'PEER_SESSION="<peer-runtime>:<peer-session-id>"',
    );
    expect(claudeReference).toContain('--session "$PEER_SESSION"');
    expect(claudeReference).not.toMatch(
      /--session (?:claude-code|codex|cursor):<peer-session-id>/,
    );
    expect(
      '<peer-runtime>:<peer-session-id>'
        .replace('<peer-runtime>', 'codex')
        .replace('<peer-session-id>', 'codex-peer'),
    ).toBe('codex:codex-peer');

    for (const reference of references) {
      expect(reference).not.toMatch(
        /--session (?:claude-code|codex|cursor):<peer-session-id>/,
      );
    }
  });
});
