import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../provider-cli/adapters.js';
import { resolveProviderExecutable } from '../provider-cli/executable.js';

describe('provider program overrides', () => {
  it.each([
    ['claude', 'CONSENSUS_CLAUDE_EXECUTABLE', 'claude'],
    ['codex', 'CONSENSUS_CODEX_EXECUTABLE', 'codex'],
    ['cursor', 'CONSENSUS_CURSOR_EXECUTABLE', 'cursor-agent'],
  ] as const)(
    '%s reads %s and keeps %s when it is unset or empty',
    (id, variable, defaultCommand) => {
      const adapter = providerRegistry().get(id)!;

      expect(
        resolveProviderExecutable(adapter, { [variable]: '/opt/bin/wrapper' }),
      ).toEqual({ ok: true, executable: '/opt/bin/wrapper' });
      expect(resolveProviderExecutable(adapter, { [variable]: '' })).toEqual({
        ok: true,
        executable: defaultCommand,
      });
      expect(resolveProviderExecutable(adapter, {})).toEqual({
        ok: true,
        executable: defaultCommand,
      });
    },
  );
});
