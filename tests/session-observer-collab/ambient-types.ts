import { selectCompletedContinuation } from '../../skills/session-observer-collab/scripts/lib/completion-selection.mjs';
import {
  validateOwnerRuntime,
  validatePeerRuntime,
  type Lease,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';
import { claimAdapterTrigger } from '../../skills/session-observer-collab/scripts/lib/runtime-adapter.mjs';

const peerRuntime: 'claude-code' | 'codex' | 'cursor' =
  validatePeerRuntime('claude-code');
const ownerRuntime: 'codex' | 'cursor' = validateOwnerRuntime('codex');

// @ts-expect-error claude-code is a peer runtime, not an owner runtime.
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

void peerRuntime;
void ownerRuntime;
void waitStartedAt;
void waitDeadlineAt;
void indexBase;
void selectedPrefix;
void completion;
