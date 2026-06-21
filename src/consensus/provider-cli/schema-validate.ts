export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateSchemaSubset(
  value: unknown,
  schema: unknown,
): ValidationResult {
  if (!isRecord(schema)) return { ok: true };

  if (schema.type === 'object' && !isRecord(value)) {
    return { ok: false, message: 'Expected provider JSON to be an object.' };
  }

  if (Array.isArray(schema.required)) {
    if (!isRecord(value)) {
      return {
        ok: false,
        message: 'Expected provider JSON to be an object with required fields.',
      };
    }
    for (const field of schema.required) {
      if (typeof field === 'string' && !(field in value)) {
        return {
          ok: false,
          message: `Missing required JSON field: ${field}`,
        };
      }
    }
  }

  if (isRecord(schema.properties) && isRecord(value)) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      if (!(field in value) || !isRecord(fieldSchema)) continue;
      const type = fieldSchema.type;
      if (typeof type === 'string' && !matchesJsonType(value[field], type)) {
        return {
          ok: false,
          message: `Field ${field} must be ${type}.`,
        };
      }
    }
  }

  return { ok: true };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesJsonType(value: unknown, type: string) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}
