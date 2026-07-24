import type {
  Lease,
  LeaseCounters,
  LeaseUpdate,
  OwnerRuntime,
  PeerRuntime,
  TranscriptContinuityCheckpoint,
  WaiterIdentity,
} from './lease-state.mjs';

export interface RuntimeAdapterInput {
  runtime: OwnerRuntime | string;
  identify: (...args: unknown[]) => unknown;
  emit: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface RuntimeAdapter extends RuntimeAdapterInput {
  version: number;
}

export interface AdapterInvocation {
  runtime: OwnerRuntime | string;
  peerRuntime: PeerRuntime | string;
  peerSession: string;
  ownerSession: string;
  cwd: string;
  transcript: string;
  now?: number;
  waiter?: WaiterIdentity;
}

export interface ValidatedInvocation {
  runtime: OwnerRuntime;
  peerRuntime: PeerRuntime;
  peerSession: string;
  ownerSession: string;
  cwd: string;
  transcript: string;
  now: number;
  waiter?: WaiterIdentity;
}

export interface AdapterCursorUpdate {
  peerCursor: number;
  peerContinuity: TranscriptContinuityCheckpoint;
}

export interface ContinuityVerification {
  verified: boolean;
  reason: string;
  canonicalTranscriptPath: string | null;
}

export const RUNTIME_ADAPTER_VERSION: number;
export function defineRuntimeAdapter(
  adapter: RuntimeAdapterInput,
): RuntimeAdapter;
export function validateAdapterInvocation(
  input: AdapterInvocation,
): ValidatedInvocation;
export function inspectAdapterLease(
  root: string,
  invocation: AdapterInvocation,
): Promise<{ eligible: boolean; reason: string; lease: Lease | null }>;
export function verifyAdapterPeerContinuity(
  lease: Lease,
  transcript: string,
): Promise<ContinuityVerification>;
export function beginAdapterWait(
  root: string,
  invocation: AdapterInvocation,
): Promise<{
  waiting: boolean;
  changed: boolean;
  reason: string;
  lease: Lease | null;
}>;
export function finishAdapterWait(
  root: string,
  invocation: AdapterInvocation,
  expected: LeaseCounters,
  diagnostic?: string,
): Promise<{
  finished: boolean;
  reason: string;
  lease: Lease | null;
}>;
export function advanceAdapterCursor(
  root: string,
  invocation: AdapterInvocation,
  expected: LeaseCounters,
  cursorUpdate: number | AdapterCursorUpdate,
): Promise<{
  advanced: boolean;
  reason: string;
  lease: Lease | null;
}>;
export function claimAdapterTrigger(
  root: string,
  invocation: AdapterInvocation,
  expected: LeaseCounters,
  completion: LeaseUpdate | null | undefined,
  clock?: () => number,
): Promise<{
  triggered: boolean;
  reason: string;
  lease: Lease | null;
}>;
