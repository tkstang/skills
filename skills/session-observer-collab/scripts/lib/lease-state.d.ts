export type Runtime = 'codex' | 'cursor';
export type LeaseState =
  | 'armed'
  | 'waiting'
  | 'idle'
  | 'triggered'
  | 'disarmed';

export interface Lease {
  schemaVersion: number;
  leaseId: string;
  runtime: Runtime;
  peerRuntime: Runtime;
  ownerSession: string;
  ownerCwd: string;
  peerSession: string;
  peerTranscript: string;
  state: LeaseState;
  peerCursor: number;
  continuationCount: number;
  continuationCap: number;
  loopCount: number;
  loopCap: number;
  waitMs: number;
  leaseMs: number;
  armedAt: string;
  expiresAt: string;
  updatedAt: string;
  diagnostic: string | null;
}

export interface LeaseCounters {
  leaseId: string;
  peerCursor: number;
  continuationCount: number;
  loopCount: number;
}

export interface LeaseUpdate {
  peerCursor: number;
  loopIncrement?: number;
  terminal?: boolean;
  diagnostic?: string | null;
}

export class LeaseError extends Error {
  code: string;
}

export const LEASE_SCHEMA_VERSION: number;
export const LEASE_STATES: readonly LeaseState[];
export const DEFAULT_WAIT_MS: number;
export const MAX_WAIT_MS: number;
export const MAX_LEASE_MS: number;
export const MAX_CONTINUATIONS: number;
export const MAX_LOOPS: number;

export function stateRoot(env?: NodeJS.ProcessEnv): string;
export function validateId(value: unknown, label?: string): string;
export function validateRuntime(value: unknown): Runtime;
export function validateAbsolutePath(value: unknown, label: string): string;
export function leasePath(root: string, ownerSession: string): string;
export function migrateLease(input: unknown): Lease;
export function validateLease(raw: unknown): Lease;
export function effectiveLease(lease: Lease, now?: number): Lease;
export function atomicWriteJson(file: string, value: unknown): Promise<void>;
export function readLease(
  root: string,
  ownerSession: string,
  options?: { persistMigration?: boolean },
): Promise<Lease | null>;
export function writeLease(root: string, lease: Lease): Promise<Lease>;
export function withLeaseLock<T>(
  file: string,
  fn: () => Promise<T>,
): Promise<T>;
export function compareAndSwapTrigger(
  root: string,
  ownerSession: string,
  expected: LeaseCounters,
  update: LeaseUpdate,
  now?: number,
): Promise<
  { ok: true; lease: Lease } | { ok: false; reason: string; lease?: Lease }
>;
export function beginLeaseWait(
  root: string,
  ownerSession: string,
  identity: Pick<
    Lease,
    'runtime' | 'peerRuntime' | 'peerSession' | 'ownerCwd' | 'peerTranscript'
  >,
  now?: number,
): Promise<
  | { ok: true; changed: boolean; lease: Lease }
  | { ok: false; reason: string; lease?: Lease }
>;
export function finishLeaseWait(
  root: string,
  ownerSession: string,
  expected: LeaseCounters,
  diagnostic?: string,
  now?: number,
): Promise<
  { ok: true; lease: Lease } | { ok: false; reason: string; lease?: Lease }
>;
export function resourceExists(path: string): Promise<boolean>;
export function pruneLeases(
  root: string,
  options?: { now?: number; ownerSession?: string },
): Promise<string[]>;
