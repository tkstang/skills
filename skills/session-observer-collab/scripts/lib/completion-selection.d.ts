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
