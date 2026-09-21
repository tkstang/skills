import type { ActivitySkillEvidence } from './types.js';
import { isJsonObject, stringValue } from './types.js';

const CURSOR_DIRECT_READ_NAMES = new Set(['Read', 'ReadFile']);

function skillNameFromPath(path: string): string | undefined {
  const segments = path.split(/[\\/]/u);
  if (segments.at(-1) !== 'SKILL.md') return undefined;
  const parent = segments.at(-2)?.trim();
  return parent ? parent : undefined;
}

export function structuredSkillFileReadEvidence(
  runtime: 'codex' | 'cursor',
  nativeName: string | undefined,
  input: unknown,
): ActivitySkillEvidence | undefined {
  const eligible =
    runtime === 'codex'
      ? nativeName === 'read_file'
      : nativeName !== undefined && CURSOR_DIRECT_READ_NAMES.has(nativeName);
  if (!eligible) {
    return undefined;
  }
  if (!isJsonObject(input)) return undefined;
  const path = stringValue(
    runtime === 'codex' ? input.file_path : input.path,
  )?.trim();
  if (!path || !skillNameFromPath(path)) return undefined;
  return {
    kind: 'inferred-file-read',
    name: skillNameFromPath(path),
    path,
  };
}
