import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const sources = [
  resolve('skills/session-observer-collab/SKILL.md'),
  resolve('documentation/docs/user-guide/skills/session-observer-collab.md'),
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
});
