export type CompletionIndexBase =
  | 'zero-based-jsonl-record-index'
  | 'zero-based-jsonl-frame-index';

export interface SelectedRange {
  indexBase: CompletionIndexBase;
  fromIndex: number;
  toIndex: number;
}

export interface SelectedEntry {
  recordIndex: number;
  role: 'user' | 'assistant';
  text: string;
  kind: string;
  sourceFrameIndex?: number;
  entryKey?: string;
  turnId?: string;
  availability?: 'pending-lifecycle' | 'completed';
  [key: string]: unknown;
}

export interface SkippedTurn {
  fromIndex: number;
  toIndex: number;
  classification:
    | 'metadata-only'
    | 'automatic-control-turn'
    | 'empty-turn'
    | 'no-op-turn'
    | 'substantive-turn';
}

export interface ContinuationSelection {
  status: 'continuation' | 'no-continuation';
  continuation: boolean;
  indexBase: CompletionIndexBase;
  fromIndex: number;
  completedIndex: number | null;
  /** Legacy compatibility alias for completedIndex. */
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

declare module '../../skills/session-observer-collab/scripts/lib/completion-selection.mjs' {
  export function selectCompletedContinuation(
    observerResult: unknown,
  ): ContinuationSelection;
}
