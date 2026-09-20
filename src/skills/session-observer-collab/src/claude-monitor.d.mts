import type { Pin } from '../../../shared/collaboration/types.js';

export interface ClaudeMonitorInput {
  root: string;
  collaborationId: string;
  activationId: string;
  self: Pin;
  peer: Pin;
  cwd: string;
  peerTranscript: string;
  maxRuntimeMs: number;
  pollMs?: number;
  confirmOldMonitorStopped: boolean;
  confirmStandaloneWatcherStopped: boolean;
}

export interface ClaudeMonitorResult {
  reason: string;
  notification: Record<string, unknown> | null;
  iterations: number;
}

export interface ClaudeMonitorMainResult extends ClaudeMonitorResult {
  exitCode: number;
}

export const MAX_MONITOR_RUNTIME_MS: number;
export const DEFAULT_MONITOR_POLL_MS: number;
export function runClaudeMonitor(
  input: ClaudeMonitorInput,
  dependencies?: Record<string, unknown>,
): Promise<ClaudeMonitorResult>;
export function runClaudeMonitorMain(
  argv?: string[],
  env?: NodeJS.ProcessEnv,
  dependencies?: Record<string, unknown>,
): Promise<ClaudeMonitorMainResult>;
