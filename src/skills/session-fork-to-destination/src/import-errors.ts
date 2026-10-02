export class SessionImportError extends Error {
  constructor(
    readonly code: string,
    message = code,
    readonly replayCommand?: string,
  ) {
    super(message);
    this.name = 'SessionImportError';
  }
}
export function refuse(code: string, message?: string): never {
  throw new SessionImportError(code, message);
}
export const IMPORT_MAX_BYTES = 32 * 1024 * 1024;
export function checkDeadline(deadline: number): void {
  if (Date.now() >= deadline) refuse('import-limit-exceeded');
}
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    refuse('malformed-native-history');
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== 'string') refuse('malformed-native-history');
  return value;
}
