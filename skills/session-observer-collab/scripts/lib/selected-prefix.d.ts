export interface SelectedCursorPrefix {
  indexBase: 'zero-based-jsonl-frame-index';
  nextFrameIndex: number;
  prefixBytes: number;
  prefixSha256: string;
  observedSize: number;
  device: number;
  inode: number;
}

export interface CursorCompletionLease {
  peerSession: string;
  ownerCwd: string;
  peerCanonicalTranscriptPath: string;
  peerTranscript: string;
  peerCursor: number;
  peerContinuity: SelectedCursorPrefix | null;
}

export function observeCursorCompletion(
  lease: CursorCompletionLease,
): Promise<Record<string, unknown>>;

export function verifySelectedPrefix(
  transcript: string,
  snapshot: SelectedCursorPrefix,
): Promise<SelectedCursorPrefix>;
