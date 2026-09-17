export interface ReviewFoundationResult {
  ok: false;
  status: 'foundation_only';
  invocation_count: 0;
}

/**
 * Phase-six packaging seam. Provider transport is added without importing the
 * generic consensus dispatcher or convergence loop.
 */
export async function runReview(): Promise<ReviewFoundationResult> {
  return {
    ok: false,
    status: 'foundation_only',
    invocation_count: 0,
  };
}
