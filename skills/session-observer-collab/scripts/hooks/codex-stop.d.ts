declare module '*skills/session-observer-collab/scripts/hooks/codex-stop.mjs' {
  import type { Lease } from '../lib/lease-state.mjs';
  import type { RuntimeAdapter } from '../lib/runtime-adapter.mjs';

  export interface CodexStopRange {
    fromIndex: number;
    toIndex: number;
  }

  export interface CodexStopHookOptions {
    root?: string;
    env?: NodeJS.ProcessEnv;
    observe?: (lease: Lease) => unknown | Promise<unknown>;
    sleep?: (milliseconds: number) => unknown | Promise<unknown>;
    now?: () => number;
    signal?: AbortSignal;
  }

  export interface CodexStopHookResult {
    decision: 'allow' | 'block';
    diagnostic?: string;
    reason?: string;
  }

  export function wakeEnvelope(
    lease: Pick<Lease, 'leaseId' | 'peerRuntime' | 'peerSession'>,
    range: CodexStopRange,
  ): string;

  export const CODEX_STOP_ADAPTER: RuntimeAdapter;

  export function runCodexStopHook(
    event: unknown,
    options?: CodexStopHookOptions,
  ): Promise<CodexStopHookResult>;
}
