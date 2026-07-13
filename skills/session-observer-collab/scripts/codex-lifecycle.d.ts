declare module '*skills/session-observer-collab/scripts/codex-lifecycle.mjs' {
  export interface CodexHookEntry {
    type: string;
    command: string;
    timeout?: number;
    statusMessage?: string;
    [key: string]: unknown;
  }

  export interface CodexHookGroup {
    hooks: CodexHookEntry[];
    [key: string]: unknown;
  }

  export interface CodexHooksConfig {
    hooks: Record<string, CodexHookGroup[]>;
  }

  export interface CodexHookRecord {
    command: string;
    trusted?: boolean;
    enabled?: boolean;
    lastRanAt?: string;
    [key: string]: unknown;
  }

  export interface CodexHookReadiness {
    exactCommand: string;
    installed: boolean;
    trusted: 'trusted' | 'untrusted' | 'unverified';
    explicitEnablement: 'enabled' | 'disabled' | 'not-explicitly-enabled';
    effectiveExecution: 'observed' | 'unverified';
    leaseArmed: 'armed' | 'not-armed';
    liveWake: 'passed' | 'unverified';
    mayArm: boolean;
  }

  export class CodexLifecycleError extends Error {
    code: string;
  }

  export const CODEX_STOP_STATUS_MESSAGE: string;
  export const CODEX_STOP_TIMEOUT_GRACE_SECONDS: number;
  export const CODEX_STOP_TIMEOUT_SECONDS: number;

  export function codexStopCommand(scriptPath: string): string;
  export function codexStopHookEntry(
    scriptPath: string,
  ): Readonly<CodexHookEntry>;
  export function withCodexLifecycleLock<T>(
    root: string,
    fn: () => Promise<T>,
  ): Promise<T>;
  export function installCodexStopHook(input: {
    hooksPath: string;
    scriptPath: string;
  }): Promise<{
    changed: boolean;
    exactCommand: string;
    config: CodexHooksConfig;
  }>;
  export function inspectCodexStopHook(input: {
    hooksPath: string;
    scriptPath: string;
  }): Promise<{ exactCommand: string; config: CodexHooksConfig }>;
  export function assessCodexHookReadiness(input: {
    scriptPath: string;
    hooks: CodexHooksConfig;
    trustRecords?: CodexHookRecord[];
    hookStatuses?: CodexHookRecord[];
    leaseArmed?: boolean;
    liveWakePassed?: boolean;
  }): Readonly<CodexHookReadiness>;
  export function uninstallCodexStopHook(input: {
    hooksPath: string;
    scriptPath: string;
    confirmed: boolean;
    root: string;
    removeScript?: boolean;
    now?: number;
  }): Promise<{
    changed: boolean;
    exactCommand: string;
    removed: number;
    scriptRemoved: boolean;
    supportRemoved: boolean;
    safety: { activeLeaseCount: number };
  }>;
}
