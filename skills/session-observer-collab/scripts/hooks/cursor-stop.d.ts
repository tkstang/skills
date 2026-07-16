declare module '*skills/session-observer-collab/scripts/hooks/cursor-stop.mjs' {
  import type { Lease } from '../lib/lease-state.mjs';
  import type { RuntimeAdapter } from '../lib/runtime-adapter.mjs';

  export interface CursorStopRange {
    fromIndex: number;
    toIndex: number;
  }

  export interface CursorStopHookOptions {
    root?: string;
    env?: NodeJS.ProcessEnv;
    loopLimit?: number;
    observe?: (lease: Lease) => unknown | Promise<unknown>;
    sleep?: (milliseconds: number) => unknown | Promise<unknown>;
    now?: () => number;
  }

  export interface CursorStopHookResult {
    followup_message: string;
  }

  export const DEFAULT_CURSOR_LOOP_LIMIT: number;

  export function cursorWakeEnvelope(
    lease: Pick<Lease, 'leaseId' | 'peerRuntime' | 'peerSession'>,
    range: CursorStopRange,
  ): string;

  export const CURSOR_STOP_ADAPTER: RuntimeAdapter;

  export function runCursorStopHook(
    event: unknown,
    options?: CursorStopHookOptions,
  ): Promise<CursorStopHookResult | null>;

  export function runCursorStopMain(): Promise<void>;
}
