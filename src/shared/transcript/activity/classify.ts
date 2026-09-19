import type { ActivityCategory, ExtractedActivityEvent } from './types.js';

const CATEGORY_BY_NATIVE_NAME: ReadonlyMap<string, ActivityCategory> = new Map([
  ['Bash', 'shell'],
  ['Shell', 'shell'],
  ['exec_command', 'shell'],
  ['shell_command', 'shell'],
  ['write_stdin', 'shell'],
  ['Read', 'read'],
  ['read_file', 'read'],
  ['Write', 'write'],
  ['write_file', 'write'],
  ['Edit', 'edit'],
  ['MultiEdit', 'edit'],
  ['ApplyPatch', 'edit'],
  ['apply_patch', 'edit'],
  ['Grep', 'grep'],
  ['grep', 'grep'],
  ['Glob', 'glob'],
  ['glob', 'glob'],
  ['WebSearch', 'search'],
  ['search_query', 'search'],
  ['web_search', 'search'],
  ['WebFetch', 'fetch'],
  ['fetch', 'fetch'],
  ['web_fetch', 'fetch'],
  ['Agent', 'task'],
  ['Subagent', 'task'],
  ['Task', 'task'],
  ['close_agent', 'task'],
  ['send_input', 'task'],
  ['spawn_agent', 'task'],
  ['wait', 'task'],
  ['AskQuestion', 'ask'],
  ['AskUserQuestion', 'ask'],
  ['request_user_input', 'ask'],
]);

const CATEGORY_BY_ITEM_TYPE: ReadonlyMap<string, ActivityCategory> = new Map([
  ['CollabAgentToolCall', 'task'],
  ['CommandExecution', 'shell'],
  ['FileChange', 'edit'],
  ['McpToolCall', 'mcp'],
  ['SubAgentActivity', 'task'],
  ['WebSearch', 'search'],
]);

export function classifyNativeName(
  nativeName: string | undefined,
): ActivityCategory {
  if (nativeName === undefined) return 'other';
  const exact = CATEGORY_BY_NATIVE_NAME.get(nativeName);
  if (exact !== undefined) return exact;
  return /^mcp__.+__.+$/.test(nativeName) ? 'mcp' : 'other';
}

export function classifyStandaloneItem(
  event: ExtractedActivityEvent,
): ActivityCategory | undefined {
  if (event.kind !== 'item') return undefined;
  return CATEGORY_BY_ITEM_TYPE.get(event.nativeType) ?? 'other';
}
