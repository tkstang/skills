import {
  validateOwnerRuntime,
  validatePeerRuntime,
  type Lease,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';

const peerRuntime: 'claude-code' | 'codex' | 'cursor' =
  validatePeerRuntime('claude-code');
const ownerRuntime: 'codex' | 'cursor' = validateOwnerRuntime('codex');

// @ts-expect-error claude-code is a peer runtime, not an owner runtime.
validateOwnerRuntime('claude-code');

const lease = null as unknown as Lease;
const waitStartedAt: string | null = lease.waitStartedAt;
const waitDeadlineAt: string | null = lease.waitDeadlineAt;

void peerRuntime;
void ownerRuntime;
void waitStartedAt;
void waitDeadlineAt;
