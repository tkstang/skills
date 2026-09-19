import { arm, run as runControl } from './collab-control.mjs';
import { selectCompletedContinuation } from './lib/completion-selection.mjs';
import {
  compareAndSwapTrigger,
  validateOwnerRuntime,
  validatePeerRuntime,
  type Lease,
} from './lib/lease-state.mjs';
import { claimAdapterTrigger } from './lib/runtime-adapter.mjs';

const peerRuntime: 'claude-code' | 'codex' | 'cursor' =
  validatePeerRuntime('claude-code');
const ownerRuntime: 'claude-code' | 'codex' | 'cursor' =
  validateOwnerRuntime('claude-code');

const lease = null as unknown as Lease;
const waitStartedAt: string | null = lease.waitStartedAt;
const waitDeadlineAt: string | null = lease.waitDeadlineAt;
const continuation = selectCompletedContinuation({});
const indexBase:
  | 'zero-based-jsonl-record-index'
  | 'zero-based-jsonl-frame-index' = continuation.indexBase;
const selectedPrefix: {
  indexBase: 'zero-based-jsonl-frame-index';
  nextFrameIndex: number;
  prefixBytes: number;
  prefixSha256: string;
  observedSize: number;
  device: number;
  inode: number;
} | null = continuation.selectedPrefix;
const completion: NonNullable<Parameters<typeof claimAdapterTrigger>[3]> = {
  peerCursor: 1,
  peerContinuity: {
    indexBase: 'zero-based-jsonl-frame-index',
    nextFrameIndex: 1,
    prefixBytes: 1,
    prefixSha256: 'a'.repeat(64),
    observedSize: 1,
    device: 1,
    inode: 1,
  },
};
const triggerUpdate: Parameters<typeof compareAndSwapTrigger>[3] = {
  peerCursor: completion.peerCursor,
  peerContinuity: completion.peerContinuity,
};
const triggerClock: NonNullable<
  Parameters<typeof compareAndSwapTrigger>[4]
> = () => Date.now();
// @ts-expect-error arm accepts a scalar timestamp, not a clock callback.
const invalidArmClock: NonNullable<Parameters<typeof arm>[2]> = () =>
  Date.now();
const runNow: NonNullable<Parameters<typeof runControl>[2]> = Date.now();
// @ts-expect-error run accepts a scalar timestamp, not a clock callback.
const invalidRunClock: NonNullable<Parameters<typeof runControl>[2]> = () =>
  Date.now();

void peerRuntime;
void ownerRuntime;
void waitStartedAt;
void waitDeadlineAt;
void indexBase;
void selectedPrefix;
void completion;
void triggerUpdate;
void triggerClock;
void invalidArmClock;
void runNow;
void invalidRunClock;
