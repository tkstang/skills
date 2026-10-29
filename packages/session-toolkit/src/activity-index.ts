import { correlateActivity } from './activity-correlate.js';
import { extractActivity } from './activity-extract.js';
import { projectActivity } from './activity-project.js';
import type {
  ActivityReport,
  ActivitySource,
  ProjectActivityOptions,
} from './activity-types.js';
// Staged extraction from Skills src/shared/transcript/activity/index.ts (p02 base).
import { readRecordsDetailed } from './provider-runtime.js';

export async function readActivityReport(
  source: ActivitySource,
  options: ProjectActivityOptions,
): Promise<ActivityReport> {
  const read = await readRecordsDetailed(source.transcriptPath);
  const extracted = extractActivity({ source, read });
  return projectActivity(correlateActivity(extracted), options);
}

export { classifyNativeName } from './activity-classify.js';
export { correlateActivity };
export { extractCursorActivity } from './activity-cursor.js';
export { extractActivity };
export {
  ACTIVITY_PROJECTION_LIMITS,
  projectActivity,
} from './activity-project.js';
export {
  renderActivityMarkdown,
  renderActivityReport,
} from './activity-render.js';
export type * from './activity-types.js';
export type * from './activity-cursor.js';
