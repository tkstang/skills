declare module '*skills/session-observer-collab/scripts/lib/completion-selection.mjs' {
  export interface SelectedRange {
    indexBase: 'zero-based-jsonl-record-index';
    fromIndex: number;
    toIndex: number;
  }
  export interface SelectedEntry {
    recordIndex: number;
    role: 'user' | 'assistant';
    text: string;
    kind: string;
    [key: string]: unknown;
  }
  export interface SkippedTurn {
    fromIndex: number;
    toIndex: number;
    classification: string;
  }
  export interface ContinuationSelection {
    status: 'continuation' | 'no-continuation';
    continuation: boolean;
    completedRecord: number | null;
    nextCursor: number;
    peerCursor: number;
    budgetCost: number;
    range: SelectedRange | null;
    reviewEntries: readonly SelectedEntry[];
    skipped: readonly SkippedTurn[];
  }
  export function selectCompletedContinuation(
    observerResult: unknown,
  ): ContinuationSelection;
}

declare module '*skills/session-observer-collab/scripts/collab-control.mjs' {
  export interface Installation {
    schemaVersion: number;
    runtimes: Record<string, { command: string }>;
  }
  export interface ArmOptions {
    runtime: string;
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
  export interface Lease {
    state: string;
    [key: string]: unknown;
  }
  export const CONTROL_SCHEMA_VERSION: number;
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
  export function install(
    root: string,
    options: { runtime: string; command: string },
  ): Promise<{ changed: boolean; installation: Installation }>;
  export function run(
    argv: string[],
    env?: NodeJS.ProcessEnv,
    now?: number,
  ): Promise<{
    ok: true;
    command: string;
    changed?: boolean;
    installation?: Installation;
    lease?: Lease | null;
    removed?: string[];
  }>;
  export function status(
    root: string,
    ownerSession?: string,
    now?: number,
  ): Promise<{ installation: Installation; lease: Lease | null }>;
}

declare module '*skills/session-observer-collab/scripts/lib/lease-state.mjs' {
  export interface Lease {
    state: string;
    schemaVersion: number;
    leaseId: string;
    runtime: string;
    ownerSession: string;
    ownerCwd: string;
    peerSession: string;
    peerTranscript: string;
    peerCursor: number;
    continuationCount: number;
    continuationCap: number;
    loopCount: number;
    loopCap: number;
    waitMs: number;
    armedAt: string;
    expiresAt: string;
    updatedAt: string;
    diagnostic: string | null;
  }
  export const LEASE_SCHEMA_VERSION: number;
  export const LEASE_STATES: readonly string[];
  export const DEFAULT_WAIT_MS: number;
  export const MAX_WAIT_MS: number;
  export const MAX_LEASE_MS: number;
  export const MAX_CONTINUATIONS: number;
  export const MAX_LOOPS: number;
  export function stateRoot(env?: NodeJS.ProcessEnv): string;
  export function validateId(value: unknown, label?: string): string;
  export function validateRuntime(value: unknown): string;
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
  export function compareAndSwapTrigger(
    root: string,
    ownerSession: string,
    expected: {
      peerCursor: number;
      continuationCount: number;
      loopCount: number;
    },
    update: {
      peerCursor: number;
      loopIncrement?: number;
      terminal?: boolean;
      diagnostic?: string | null;
    },
    now?: number,
  ): Promise<
    { ok: true; lease: Lease } | { ok: false; reason: string; lease?: Lease }
  >;
  export function resourceExists(path: string): Promise<boolean>;
  export function pruneLeases(
    root: string,
    options?: { now?: number; ownerSession?: string },
  ): Promise<string[]>;
}

declare module '*skills/session-observer-collab/scripts/lib/runtime-adapter.mjs' {
  export interface Lease {
    state: string;
    [key: string]: unknown;
  }
  export interface RuntimeAdapterInput {
    runtime: string;
    identify: (...args: unknown[]) => unknown;
    emit: (...args: unknown[]) => unknown;
    [key: string]: unknown;
  }
  export interface RuntimeAdapter extends RuntimeAdapterInput {
    version: number;
  }
  export interface AdapterInvocation {
    runtime: string;
    ownerSession: string;
    cwd: string;
    transcript: string;
    now?: number;
  }
  export const RUNTIME_ADAPTER_VERSION: number;
  export function defineRuntimeAdapter(
    adapter: RuntimeAdapterInput,
  ): RuntimeAdapter;
  export function validateAdapterInvocation(
    input: AdapterInvocation,
  ): AdapterInvocation & { runtime: string; now: number };
  export function inspectAdapterLease(
    root: string,
    invocation: AdapterInvocation,
  ): Promise<{ eligible: boolean; reason: string; lease: Lease | null }>;
  export function claimAdapterTrigger(
    root: string,
    invocation: AdapterInvocation,
    expected: {
      peerCursor: number;
      continuationCount: number;
      loopCount: number;
    },
    completion:
      | { peerCursor: number; loopIncrement?: number; terminal?: boolean }
      | null
      | undefined,
  ): Promise<{ triggered: boolean; reason: string; lease: Lease | null }>;
}
