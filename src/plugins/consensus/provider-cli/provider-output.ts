import type { ProviderInvocation } from './invocation.js';
import { isRecord } from './schema-validate.js';
import type { ProviderProcessSuccess } from './subprocess.js';

// Default readers for provider final output. An adapter replaces one through
// its `extractText` or `extractStructuredValue` hook.

export type ProviderTextExtraction =
  | { ok: true; raw: string; text: string }
  | {
      ok: false;
      code: 'PROVIDER_EMPTY_OUTPUT' | 'PROVIDER_MALFORMED_RESULT';
      message: string;
      terminal_reason: 'empty_output' | 'malformed_result';
    };

export interface ProviderResultTextOptions {
  // Reject a stdout result object without `subtype: "success"`. A present
  // non-success subtype is rejected either way.
  requireSuccessSubtype?: boolean;
}

// Strict text extraction: a reply is either the provider's own final text or
// a failure. Malformed or error-shaped output never becomes raw-text success.
export function extractProviderResultText(
  invocation: ProviderInvocation,
  result: ProviderProcessSuccess,
  options: ProviderResultTextOptions = {},
): ProviderTextExtraction {
  const empty = (message: string): ProviderTextExtraction => ({
    ok: false,
    code: 'PROVIDER_EMPTY_OUTPUT',
    message,
    terminal_reason: 'empty_output',
  });
  const malformed = (message: string): ProviderTextExtraction => ({
    ok: false,
    code: 'PROVIDER_MALFORMED_RESULT',
    message,
    terminal_reason: 'malformed_result',
  });

  if (invocation.output_mode === 'last_message_file') {
    const lastMessage = result.last_message;
    if (lastMessage === undefined) {
      return empty('Provider did not write a last-message file response.');
    }
    if (!lastMessage.trim()) {
      return empty('Provider wrote a blank last-message file response.');
    }
    return { ok: true, raw: lastMessage, text: lastMessage };
  }

  if (!result.stdout.trim()) {
    return empty('Provider produced no output.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    return malformed('Provider output is not a JSON result object.');
  }
  if (!isRecord(parsed)) {
    return malformed('Provider output is not a JSON result object.');
  }
  if (parsed.is_error === true) {
    return malformed('Provider reported an error result.');
  }
  const subtype = parsed.subtype;
  if (
    (options.requireSuccessSubtype && subtype !== 'success') ||
    (subtype !== undefined && subtype !== 'success')
  ) {
    return malformed(
      `Provider result subtype is ${typeof subtype === 'string' ? subtype : 'missing'}, not success.`,
    );
  }
  if (typeof parsed.result !== 'string') {
    return malformed('Provider result object has no text result.');
  }
  if (!parsed.result.trim()) {
    return empty('Provider returned a blank text result.');
  }
  return { ok: true, raw: result.stdout, text: parsed.result };
}

// Unwraps a provider result envelope: `structured_output` first, then a JSON
// string `result`; anything else is returned unchanged.
export function extractStructuredJsonValue(value: unknown): unknown {
  if (!isRecord(value)) return value;

  if ('structured_output' in value) {
    return value.structured_output;
  }

  const result = value.result;
  if (typeof result !== 'string') return value;

  try {
    return JSON.parse(result.trim());
  } catch {
    return extractFirstJsonObject(result) ?? value;
  }
}

function extractFirstJsonObject(text: string): unknown | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char !== '}') continue;

    depth -= 1;
    if (depth !== 0) continue;

    const candidate = text.slice(start, index + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      start = -1;
      depth = 0;
    }
  }

  return undefined;
}
