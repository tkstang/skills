export type Provider = 'claude-code' | 'codex' | 'cursor';
export type ErrorCode =
  | 'E_SCAN_CONFIRMATION'
  | 'E_USAGE'
  | 'E_INTERNAL'
  | 'E_AMBIGUOUS'
  | 'E_UNAVAILABLE'
  | 'E_CURSOR_INVALID'
  | 'E_SOURCE_CHANGED'
  | 'E_IO';
export class ToolkitError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly hint: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
export function positive(
  value: number | undefined,
  name: string,
  fallback?: number,
): number | undefined {
  const selected = value ?? fallback;
  if (
    selected !== undefined &&
    (!Number.isSafeInteger(selected) || selected < 1)
  )
    throw new ToolkitError(
      'E_USAGE',
      `${name} must be a positive safe integer.`,
      'Supply a positive integer.',
    );
  return selected;
}
export function provider(value: string): Provider {
  if (value === 'claude-code' || value === 'codex' || value === 'cursor')
    return value;
  throw new ToolkitError(
    'E_USAGE',
    'Unsupported runtime.',
    'Use claude-code, codex or cursor.',
  );
}
export function selector(value: string): { runtime: Provider; id: string } {
  const colon = value.indexOf(':');
  const id = value.slice(colon + 1);
  if (
    colon < 1 ||
    !id ||
    /[/\\]/u.test(id) ||
    [...id].some((c) => c.charCodeAt(0) < 32)
  )
    throw new ToolkitError(
      'E_USAGE',
      'Invalid qualified session.',
      'Use <provider>:<native-id>.',
    );
  return { runtime: provider(value.slice(0, colon)), id };
}
