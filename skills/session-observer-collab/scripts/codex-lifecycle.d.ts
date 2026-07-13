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
    enablement: 'disabled' | 'not-explicitly-disabled';
    effectiveExecution: 'observed' | 'unverified';
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
  export function installCodexStopHook(input: {
    hooksPath: string;
    scriptPath: string;
  }): Promise<{
    changed: boolean;
    exactCommand: string;
    config: CodexHooksConfig;
  }>;
  export function assessCodexHookReadiness(input: {
    scriptPath: string;
    hooks: CodexHooksConfig;
    trustRecords?: CodexHookRecord[];
    hookStatuses?: CodexHookRecord[];
  }): Readonly<CodexHookReadiness>;
  export function uninstallCodexStopHook(input: {
    hooksPath: string;
    scriptPath: string;
    confirmed: boolean;
    activeLeaseCount?: number;
    removeScript?: boolean;
  }): Promise<{
    changed: boolean;
    exactCommand: string;
    removed: number;
  }>;
}
