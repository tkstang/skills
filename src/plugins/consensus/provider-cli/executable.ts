import path from 'node:path';

import type { ProviderAdapter } from './adapters.js';

export type ProviderExecutableResolution =
  | { ok: true; executable: string }
  | { ok: false; message: string };

// Each provider's program can be replaced with an absolute path, such as a
// wrapper that loads the provider's credential from the OS keychain and then
// runs the real CLI. The adapter's `executable_env` names the variable
// (CONSENSUS_<PROVIDER>_EXECUTABLE). Unset or empty keeps the adapter's default
// command, which is found on PATH. Only the parent environment sets these; a
// run request cannot, so a brief or repository cannot choose which program
// runs.
export function resolveProviderExecutable(
  adapter: Pick<ProviderAdapter, 'executable' | 'executable_env'>,
  env: Record<string, string | undefined>,
): ProviderExecutableResolution {
  const variable = adapter.executable_env;
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
