// Deny-all answers for agent->client requests. The tool `kind` an agent
// reports is untrusted, so nothing is ever granted: a permission request gets
// the option whose kind is reject_once (else reject_always), chosen by kind
// because option ids differ between agents, or `cancelled` when no reject
// option exists. Every other agent->client method is refused.
import { realpathSync } from 'node:fs';
import path from 'node:path';

import type { JsonRpcErrorObject } from './jsonrpc.js';
import { isRecord } from './jsonrpc.js';

// What the client advertises in `initialize`: no file system and no
// terminal, so the agent has nothing of ours to call.
export const ACP_CLIENT_CAPABILITIES = {
  fs: { readTextFile: false, writeTextFile: false },
  terminal: false,
} as const;

export const CANCELLED_PERMISSION_OUTCOME = {
  outcome: { outcome: 'cancelled' },
} as const;

export type PermissionResponse =
  | { outcome: { outcome: 'selected'; optionId: string } }
  | typeof CANCELLED_PERMISSION_OUTCOME;

// One denied permission request. Only identifying fields are kept: never
// rawInput, content, diffs or locations, which may hold file text or
// secrets.
export interface AcpPermissionDenial {
  tool_call_id?: string;
  // The tool's name, else its title.
  tool?: string;
  kind?: string;
  // The first location the request names, in full as the agent reported
  // it; the client resolves it against the run's cwd, then redacts and
  // shortens it.
  path?: string;
  outcome: 'rejected' | 'cancelled';
}

const REJECT_KINDS = ['reject_once', 'reject_always'] as const;
const MAX_FIELD_CHARS = 120;

export function denyPermissionRequest(
  params: unknown,
  options: {
    cancelled?: boolean;
    // Applied to each recorded field before it is shortened.
    redact?: (text: string) => string;
  } = {},
): { response: PermissionResponse; denial: AcpPermissionDenial } {
  const request = isRecord(params) ? params : {};
  const denialBase = describeToolCall(
    request.toolCall,
    options.redact ?? ((text) => text),
  );
  if (!options.cancelled) {
    const optionId = rejectOptionId(request.options);
    if (optionId !== undefined) {
      return {
        response: { outcome: { outcome: 'selected', optionId } },
        denial: { ...denialBase, outcome: 'rejected' },
      };
    }
  }
  return {
    response: CANCELLED_PERMISSION_OUTCOME,
    denial: { ...denialBase, outcome: 'cancelled' },
  };
}

// The real path of the deepest existing ancestor, plus the rest: the file a
// denied write names usually does not exist.
export function realExistingPath(file: string): string {
  const rest: string[] = [];
  let current = path.resolve(file);
  for (;;) {
    try {
      return path.join(realpathSync(current), ...rest.toReversed());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(file);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

export function methodNotFound(method: string): JsonRpcErrorObject {
  return { code: -32601, message: 'Method not found', data: { method } };
}

function rejectOptionId(options: unknown): string | undefined {
  for (const kind of REJECT_KINDS) {
    const optionId = optionIdOfKind(options, kind);
    if (optionId !== undefined) return optionId;
  }
  return undefined;
}

function optionIdOfKind(options: unknown, kind: string): string | undefined {
  if (!Array.isArray(options)) return undefined;
  const match = options.find(
    (option) =>
      isRecord(option) &&
      option.kind === kind &&
      typeof option.optionId === 'string',
  ) as { optionId: string } | undefined;
  return match?.optionId;
}

function describeToolCall(
  toolCall: unknown,
  redact: (text: string) => string,
): Omit<AcpPermissionDenial, 'outcome'> {
  if (!isRecord(toolCall)) return {};
  const short = (value: unknown) =>
    typeof value === 'string' && value !== ''
      ? shortString(redact(value))
      : undefined;
  const tool = short(toolCall.name) ?? short(toolCall.title);
  const toolCallId = short(toolCall.toolCallId);
  const kind = short(toolCall.kind);
  const location =
    Array.isArray(toolCall.locations) && isRecord(toolCall.locations[0])
      ? toolCall.locations[0].path
      : undefined;
  // Kept whole: the client resolves it before redacting and shortening.
  const firstPath =
    typeof location === 'string' && location !== '' ? location : undefined;
  return {
    ...(toolCallId !== undefined ? { tool_call_id: toolCallId } : {}),
    ...(tool !== undefined ? { tool } : {}),
    ...(kind !== undefined ? { kind } : {}),
    ...(firstPath !== undefined ? { path: firstPath } : {}),
  };
}

function shortString(value: string, max = MAX_FIELD_CHARS) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
