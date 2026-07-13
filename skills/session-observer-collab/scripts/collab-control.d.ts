import type { Lease, OwnerRuntime, PeerRuntime } from './lib/lease-state.mjs';

export interface Installation {
  schemaVersion: number;
  runtimes: Record<string, { command: string }>;
}

export interface ArmOptions {
  runtime: OwnerRuntime | string;
  peerRuntime: PeerRuntime | string;
  session: string;
  peerSession: string;
  cwd: string;
  peerTranscript: string;
  waitMs?: string | number;
  leaseMs?: string | number;
  continuationCap?: string | number;
  loopCap?: string | number;
  cursor?: string | number;
}

export interface RunResult {
  ok: true;
  command: string;
  changed?: boolean;
  installation?: Installation;
  lease?: Lease | null;
  removed?: string[];
}

export interface CodexControlOptions {
  hooksPath: string;
  scriptPath: string;
  session?: string;
  trustRecordsPath?: string;
  hookStatusesPath?: string;
  confirmed?: boolean;
  removeScript?: boolean;
  sourceScriptPath?: string;
}

export const CONTROL_SCHEMA_VERSION: number;
export function parseArgs(argv: string[]): {
  command: string | undefined;
  options: Record<string, string | boolean>;
};
export function install(
  root: string,
  options: { runtime: OwnerRuntime | string; command: string },
): Promise<{ changed: boolean; installation: Installation }>;
export function arm(
  root: string,
  options: ArmOptions,
  now?: number,
): Promise<{ changed: boolean; lease: Lease }>;
export function disarm(
  root: string,
  ownerSession: string,
  now?: number,
): Promise<{ changed: boolean; lease: Lease | null }>;
export function status(
  root: string,
  ownerSession?: string,
  now?: number,
): Promise<{ installation: Installation; lease: Lease | null }>;
export function codexInstall(
  root: string,
  options: CodexControlOptions,
): Promise<Record<string, unknown>>;
export function codexStatus(
  root: string,
  options: CodexControlOptions,
  now?: number,
): Promise<Record<string, unknown>>;
export function codexUninstall(
  root: string,
  options: CodexControlOptions,
  now?: number,
): Promise<Record<string, unknown>>;
export function run(
  argv: string[],
  env?: NodeJS.ProcessEnv,
  now?: number,
): Promise<RunResult>;
