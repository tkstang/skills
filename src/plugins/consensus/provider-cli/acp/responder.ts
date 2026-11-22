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

// A read the run may allow: the descriptor names roots the adapter created
// for this run and nothing else uses (agy's private settings home), and the
// request reads only inside them.
export interface AcpAllowedRead {
  tool?: string;
  kind: 'read';
  // The first location, relative to its root.
  path?: string;
}

// Allows a permission request only when its reported kind is exactly
// `read`, it names at least one location, and every location resolves (real
// path, through its nearest existing parent) inside one of `roots`. The
// answer is the allow_once option, chosen by kind, never allow_always.
// Anything else returns undefined and is denied as usual.
export function allowReadRequest(
  params: unknown,
  roots: readonly string[],
  options: { redact?: (text: string) => string } = {},
): { response: PermissionResponse; allowed: AcpAllowedRead } | undefined {
  if (roots.length === 0) return undefined;
  const request = isRecord(params) ? params : {};
  const toolCall = isRecord(request.toolCall) ? request.toolCall : undefined;
  if (!toolCall || toolCall.kind !== 'read') return undefined;
  const locations = Array.isArray(toolCall.locations) ? toolCall.locations : [];
  if (locations.length === 0) return undefined;
  const realRoots = roots.map((root) => realExistingPath(root));
  let first: string | undefined;
  for (const location of locations) {
    const reported = isRecord(location) ? location.path : undefined;
    if (typeof reported !== 'string' || !path.isAbsolute(reported)) {
      return undefined;
    }
    const real = realExistingPath(reported);
    const root = realRoots.find((candidate) => isInside(real, candidate));
    if (root === undefined) return undefined;
    first ??= path.relative(root, real) || '.';
  }
  const optionId = optionIdOfKind(request.options, 'allow_once');
  if (optionId === undefined) return undefined;
  const redact = options.redact ?? ((text: string) => text);
  const tool =
    typeof toolCall.name === 'string' && toolCall.name !== ''
      ? toolCall.name
      : typeof toolCall.title === 'string' && toolCall.title !== ''
        ? toolCall.title
        : undefined;
  return {
    response: { outcome: { outcome: 'selected', optionId } },
    allowed: {
      ...(tool !== undefined ? { tool: shortString(redact(tool)) } : {}),
      kind: 'read',
      ...(first !== undefined ? { path: shortString(redact(first), 240) } : {}),
    },
  };
}

// The real path of the deepest existing ancestor, plus the rest: a path a
// request names need not exist yet.
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

function isInside(file: string, root: string) {
  const relative = path.relative(root, file);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
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
