import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

import { createCursorTurnAccumulator } from '../../../session-observer/scripts/lib/cursor-analysis.mjs';
import { scanCursorTranscript } from '../../../session-observer/scripts/lib/cursor-frames.mjs';
import { buildDigest } from '../../../session-observer/scripts/lib/digest.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;

function selectedPrefixError() {
  const error = new Error('cursor selected prefix changed after observation');
  error.code = 'cursor-selected-prefix-mismatch';
  return error;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validSelectedPrefix(snapshot) {
  return (
    snapshot !== null &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot) &&
    snapshot.indexBase === 'zero-based-jsonl-frame-index' &&
    nonNegativeInteger(snapshot.nextFrameIndex) &&
    nonNegativeInteger(snapshot.prefixBytes) &&
    SHA256.test(snapshot.prefixSha256) &&
    snapshot.observedSize === snapshot.prefixBytes &&
    nonNegativeInteger(snapshot.device) &&
    nonNegativeInteger(snapshot.inode)
  );
}

async function readBoundedHashes(
  transcript,
  selectedPrefixBytes,
  verificationPrefixBytes,
) {
  if (
    !nonNegativeInteger(selectedPrefixBytes) ||
    !nonNegativeInteger(verificationPrefixBytes) ||
    selectedPrefixBytes > verificationPrefixBytes
  ) {
    throw selectedPrefixError();
  }

  const selectedHash = createHash('sha256');
  const verificationHash = createHash('sha256');
  const handle = await open(transcript, 'r');
  try {
    const before = await handle.stat();
    if (
      !nonNegativeInteger(before.dev) ||
      !nonNegativeInteger(before.ino) ||
      before.size < verificationPrefixBytes
    ) {
      throw selectedPrefixError();
    }

    let bytesRead = 0;
    if (verificationPrefixBytes > 0) {
      const stream = handle.createReadStream({
        start: 0,
        end: verificationPrefixBytes - 1,
        autoClose: false,
      });
      for await (const chunk of stream) {
        const selectedRemaining = selectedPrefixBytes - bytesRead;
        if (selectedRemaining > 0) {
          selectedHash.update(
            chunk.subarray(0, Math.min(selectedRemaining, chunk.byteLength)),
          );
        }
        verificationHash.update(chunk);
        bytesRead += chunk.byteLength;
      }
    }

    const after = await handle.stat();
    if (
      bytesRead !== verificationPrefixBytes ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size < verificationPrefixBytes
    ) {
      throw selectedPrefixError();
    }

    return Object.freeze({
      device: before.dev,
      inode: before.ino,
      selectedSha256: selectedHash.digest('hex'),
      verificationSha256: verificationHash.digest('hex'),
    });
  } finally {
    await handle.close();
  }
}

async function captureSelectedPrefix(
  transcript,
  scan,
  frameEnds,
  nextFrameIndex,
) {
  const prefixBytes = nextFrameIndex === 0 ? 0 : frameEnds[nextFrameIndex - 1];
  if (
    !nonNegativeInteger(nextFrameIndex) ||
    !nonNegativeInteger(prefixBytes) ||
    !nonNegativeInteger(scan.file.device) ||
    !nonNegativeInteger(scan.file.inode) ||
    prefixBytes > scan.safePrefixBytes ||
    !SHA256.test(scan.safePrefixSha256)
  ) {
    throw selectedPrefixError();
  }

  const bounded = await readBoundedHashes(
    transcript,
    prefixBytes,
    scan.safePrefixBytes,
  );
  if (
    bounded.device !== scan.file.device ||
    bounded.inode !== scan.file.inode ||
    bounded.verificationSha256 !== scan.safePrefixSha256
  ) {
    throw selectedPrefixError();
  }

  return Object.freeze({
    indexBase: 'zero-based-jsonl-frame-index',
    nextFrameIndex,
    prefixBytes,
    prefixSha256: bounded.selectedSha256,
    observedSize: prefixBytes,
    device: bounded.device,
    inode: bounded.inode,
  });
}

export async function observeCursorCompletion(lease) {
  const identity = {
    runtime: 'cursor',
    sessionId: lease.peerSession,
    projectCwd: lease.ownerCwd,
    canonicalCwd: lease.ownerCwd,
    canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
    cwdEvidence: ['direct-project-root'],
    sessionEvidence: ['explicit-pin'],
    strength: 'exact',
    reasons: [],
  };
  const accumulator = createCursorTurnAccumulator(identity, lease.peerCursor);
  const frameEnds = [];
  const scan = await scanCursorTranscript(lease.peerTranscript, {
    verifyPrefixBytes: lease.peerContinuity?.prefixBytes,
    onFrame(frame) {
      accumulator.onFrame(frame);
      frameEnds[frame.frameIndex] =
        frame.closed &&
        (frame.parseState === 'parsed' || frame.parseState === 'blank')
          ? frame.byteEnd
          : null;
    },
  });
  const prior = lease.peerContinuity;
  if (
    prior !== null &&
    (scan.file.size < prior.observedSize ||
      scan.file.size < prior.prefixBytes ||
      scan.file.device !== prior.device ||
      scan.file.inode !== prior.inode ||
      scan.verifiedPrefixSha256 !== prior.prefixSha256)
  ) {
    throw new Error('cursor continuity changed during completion read');
  }

  const digest = await buildDigest('cursor', lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: 'review',
    sessionId: lease.peerSession,
    recordedCwd: lease.ownerCwd,
    cursorProjection: 'confirmed-completion',
    cursorIdentity: identity,
    cursorScan: scan,
    cursorAnalysis: accumulator.finish(scan),
    cursorState: null,
    cursorContinuity: prior === null ? 'new' : 'verified',
  });
  digest.cursorEvidence.selectedPrefix = await captureSelectedPrefix(
    lease.peerTranscript,
    scan,
    frameEnds,
    digest.entries.at(-1)?.recordIndex + 1 || digest.range.nextIndex,
  );
  return digest;
}

export async function verifySelectedPrefix(transcript, snapshot) {
  if (!validSelectedPrefix(snapshot)) throw selectedPrefixError();
  const bounded = await readBoundedHashes(
    transcript,
    snapshot.prefixBytes,
    snapshot.prefixBytes,
  );
  if (
    bounded.device !== snapshot.device ||
    bounded.inode !== snapshot.inode ||
    bounded.selectedSha256 !== snapshot.prefixSha256
  ) {
    throw selectedPrefixError();
  }
  return Object.freeze({ ...snapshot });
}
