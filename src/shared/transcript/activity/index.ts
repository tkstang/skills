import { readRecordsDetailed } from '../runtimes.js';
import { correlateActivity } from './correlate.js';
import { extractActivity } from './extract.js';
import { projectActivity } from './project.js';
import type {
  ActivityReport,
  ActivitySource,
  ProjectActivityOptions,
} from './types.js';

export async function readActivityReport(
  source: ActivitySource,
  options: ProjectActivityOptions,
): Promise<ActivityReport> {
  const read = await readRecordsDetailed(source.transcriptPath);
  const extracted = extractActivity({ source, read });
  return projectActivity(correlateActivity(extracted), options);
}

export { classifyNativeName } from './classify.js';
export { correlateActivity };
export { extractCursorActivity } from './cursor.js';
export { extractActivity };
export { ACTIVITY_PROJECTION_LIMITS, projectActivity } from './project.js';
export { renderActivityMarkdown, renderActivityReport } from './render.js';
export type * from './types.js';
export type * from './cursor.js';
