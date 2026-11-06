import path from 'node:path';

import type { ProviderAdapter } from './adapters.js';
import type { FirstScopeProviderId } from './types.js';

// Each provider's program can be replaced with an absolute path, such as a
// wrapper that loads the provider's credential from the OS keychain and then
// runs the real CLI. Unset or empty keeps the adapter's default command, which
// is found on PATH. Only the parent environment sets these; a run request
// cannot, so a brief or repository cannot choose which program runs.
export const PROVIDER_EXECUTABLE_ENV = {
  claude: 'CONSENSUS_CLAUDE_EXECUTABLE',
  codex: 'CONSENSUS_CODEX_EXECUTABLE',
  cursor: 'CONSENSUS_CURSOR_EXECUTABLE',
} as const satisfies Record<FirstScopeProviderId, string>;

export type ProviderExecutableResolution =
  | { ok: true; executable: string }
  | { ok: false; message: string };

export function resolveProviderExecutable(
  adapter: Pick<ProviderAdapter, 'id' | 'executable'>,
  env: Record<string, string | undefined>,
): ProviderExecutableResolution {
  const variable = PROVIDER_EXECUTABLE_ENV[adapter.id];
  const value = env[variable];
  if (value === undefined || value === '') {
    return { ok: true, executable: adapter.executable };
  }
  // A relative path would resolve against each run's working directory, which
  // is often the repository under review.
  if (!path.isAbsolute(value)) {
    return {
      ok: false,
      message: `${variable} must be an absolute path to an executable, not ${JSON.stringify(value)}.`,
    };
  }
  return { ok: true, executable: value };
}
