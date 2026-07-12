import type {
  Lease,
  LeaseCounters,
  LeaseUpdate,
  Runtime,
} from './lease-state.mjs';

export interface RuntimeAdapterInput {
  runtime: Runtime | string;
  identify: (...args: unknown[]) => unknown;
  emit: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface RuntimeAdapter extends RuntimeAdapterInput {
  version: number;
}

export interface AdapterInvocation {
  runtime: Runtime | string;
  ownerSession: string;
  cwd: string;
  transcript: string;
  now?: number;
}

export interface ValidatedInvocation {
  runtime: Runtime;
  ownerSession: string;
  cwd: string;
  transcript: string;
  now: number;
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
export function claimAdapterTrigger(
  root: string,
  invocation: AdapterInvocation,
  expected: LeaseCounters,
  completion: LeaseUpdate | null | undefined,
): Promise<{
  triggered: boolean;
  reason: string;
  lease: Lease | null;
}>;
