#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import { runReview } from './run.js';

export { executeBoundedReview, runReview, validateReviewReply } from './run.js';
export { buildReviewPrompt, resolveReviewer } from './selection.js';

export async function reviewMain(): Promise<number> {
  const result = await runReview();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await reviewMain();
}
