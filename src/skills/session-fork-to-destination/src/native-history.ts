import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { basename } from 'node:path';

import { checkDeadline, object, refuse, string } from './import-errors.js';

export type ImportProvider = 'claude' | 'codex';
export type HistoryItem =
  | { kind: 'text'; role: 'user' | 'assistant'; text: string; phase?: string }
  | {
      kind: 'call';
      callKind: 'function_call' | 'custom_tool_call';
      id: string;
      name: string;
      arguments: string;
      namespace?: string;
    }
  | {
      kind: 'result';
      callKind: 'function_call' | 'custom_tool_call';
      id: string;
      output: string | Array<{ type: 'input_text'; text: string }>;
      isError?: boolean;
    };
export interface NativeHistory {
  items: HistoryItem[];
  timestamp: string;
  omissions: Record<string, number>;
  inheritedIds: string[];
}
const REMEDY =
  'Finish the source turn, exit the source session, then invoke from the destination or another session.';
const ID = /^[A-Za-z0-9_-]{1,128}$/u;
const phases = new Set(['commentary', 'final_answer']);
function count(history: NativeHistory, key: string): void {
  history.omissions[key] = (history.omissions[key] ?? 0) + 1;
}
function stamp(value: unknown): string {
  const raw = string(value);
  if (!/(?:Z|[+-]\d\d:\d\d)$/u.test(raw) || !Number.isFinite(Date.parse(raw)))
    refuse('invalid-source-timestamp');
  return new Date(raw).toISOString();
}
function toolId(value: unknown): string {
  const id = string(value);
  if (!ID.test(id)) refuse('unsupported-tool-id');
  return id;
}
function toolName(value: unknown): string {
  const name = string(value);
  if (!ID.test(name)) refuse('unsupported-tool-name');
  return name;
}
function argumentsObject(value: unknown): string {
  if (typeof value === 'string') {
    try {
      object(JSON.parse(value));
    } catch {
      refuse('unsupported-tool-arguments');
    }
    return value;
  }
  object(value);
  return JSON.stringify(value);
}
const envelopes = [
  'environment_context',
  'permissions',
  'user_instructions',
  'apps_instructions',
  'skill',
  'stoa-profile',
  'local-command-caveat',
  'local-command-stdout',
  'system-reminder',
];
const commandEnvelopes = ['command-message', 'command-name', 'command-args'];
function readCommandEnvelope(
  text: string,
  name: string,
): { value: string; rest: string } {
  const opening = `<${name}>`,
    closing = `</${name}>`;
  if (!text.startsWith(opening)) refuse('ambiguous-runtime-context');
  const end = text.indexOf(closing, opening.length);
  if (end < 0 || text.slice(opening.length, end).includes(opening))
    refuse('ambiguous-runtime-context');
  return {
    value: text.slice(opening.length, end),
    rest: text.slice(end + closing.length),
  };
}
function commandRemainder(rest: string, expectedNext?: string): string {
  if (
    rest.length &&
    !/^[\r\n]/u.test(rest) &&
    !(expectedNext && rest.startsWith(`<${expectedNext}>`))
  )
    refuse('ambiguous-runtime-context');
  return rest.replace(/^[\r\n]+/u, '');
}
function claudeCommandText(text: string): { text: string; rest: string } {
  if (text.startsWith('<command-args>')) {
    const args = readCommandEnvelope(text, 'command-args');
    return { text: args.value, rest: commandRemainder(args.rest) };
  }
  const command = readCommandEnvelope(text, 'command-message');
  const name = readCommandEnvelope(
    commandRemainder(command.rest, 'command-name'),
    'command-name',
  );
  if (
    !/^[A-Za-z0-9_-][A-Za-z0-9_.:-]{0,127}$/u.test(command.value) ||
    name.value !== `/${command.value}`
  )
    refuse('ambiguous-runtime-context');
  let rest = commandRemainder(name.rest, 'command-args');
  let args = '';
  if (rest.startsWith('<command-args>')) {
    const parsed = readCommandEnvelope(rest, 'command-args');
    args = parsed.value;
    rest = commandRemainder(parsed.rest);
  }
  return { text: `${name.value}${args.length ? ` ${args}` : ''}`, rest };
}
function userText(
  raw: string,
  h: NativeHistory,
  provider: ImportProvider,
): string {
  let text = raw;
  const retainedCommands: string[] = [];
  if (
    provider === 'codex' &&
    text.startsWith('# AGENTS.md instructions for ')
  ) {
    const match =
      /^# AGENTS\.md instructions for [^\n]+\n\n<INSTRUCTIONS>\n[\s\S]*?\n<\/INSTRUCTIONS>/u.exec(
        text,
      );
    if (!match) refuse('ambiguous-runtime-context');
    count(h, 'runtime-context');
    text = text.slice(match[0].length).replace(/^[\r\n]+/u, '');
  }
  if (provider === 'codex' && text.startsWith('<ambient_browser_context>')) {
    const match =
      /^<ambient_browser_context>[\s\S]*?<\/ambient_browser_context>(?:\r?\n|$)/u.exec(
        text,
      );
    if (!match) refuse('ambiguous-runtime-context');
    count(h, 'runtime-context');
    text = text.slice(match[0].length);
  }
  for (;;) {
    if (
      provider === 'claude' &&
      commandEnvelopes.some((tag) => text.startsWith(`<${tag}>`))
    ) {
      const command = claudeCommandText(text);
      if (command.text.length) retainedCommands.push(command.text);
      count(h, 'command-envelope');
      text = command.rest;
      continue;
    }
    const name = envelopes.find((tag) => text.startsWith(`<${tag}>`));
    if (!name) break;
    const end = text.indexOf(`</${name}>`);
    if (end < 0 || text.slice(0, end).includes(`<${name}>`, name.length + 2))
      refuse('ambiguous-runtime-context');
    const after = end + name.length + 3;
    if (text.length > after && !/^[\r\n]/u.test(text.slice(after)))
      refuse('ambiguous-runtime-context');
    count(h, 'runtime-context');
    text = text.slice(after).replace(/^[\r\n]+/u, '');
  }
  if (
    [...envelopes, ...commandEnvelopes].some((tag) =>
      text.startsWith(`<${tag}`),
    ) ||
    text.startsWith('<permissions instructions>')
  )
    refuse('ambiguous-runtime-context');
  return [...retainedCommands, ...(text.length ? [text] : [])].join('\n');
}
function textContent(
  value: unknown,
  role: 'user' | 'assistant',
  h: NativeHistory,
  provider: ImportProvider,
): string {
  let text: string;
  if (typeof value === 'string') text = value;
  else {
    if (!Array.isArray(value)) refuse('malformed-native-history');
    text = value
      .map((raw) => {
        const block = object(raw);
        const type = string(block.type);
        if (['text', 'input_text', 'output_text'].includes(type))
          return string(block.text);
        if (
          [
            'image',
            'input_image',
            'audio',
            'input_audio',
            'output_audio',
            'file',
            'document',
            'video',
          ].includes(type)
        ) {
          count(h, 'media');
          return `[Imported ${type} omitted.]`;
        }
        refuse('unsupported-content-block');
      })
      .join('');
  }
  return role === 'user' ? userText(text, h, provider) : text;
}
function output(
  value: unknown,
  h: NativeHistory,
): string | Array<{ type: 'input_text'; text: string }> {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) refuse('unsupported-tool-output');
  return value.map((raw) => {
    const b = object(raw);
    const type = string(b.type);
    if (type === 'text' || type === 'input_text' || type === 'output_text')
      return { type: 'input_text' as const, text: string(b.text) };
    if (['image', 'input_image', 'audio', 'document', 'file'].includes(type)) {
      count(h, 'media');
      return {
        type: 'input_text' as const,
        text: `[Imported ${type} omitted.]`,
      };
    }
    refuse('unsupported-tool-output');
  });
}
function codexItem(raw: unknown, h: NativeHistory, compacted = false): void {
  const item = object(raw);
  const type = string(item.type);
  if (type === 'reasoning') {
    count(h, 'private-reasoning');
    return;
  }
  if (type === 'message') {
    if (item.role === 'system' || item.role === 'developer') {
      count(h, 'system-developer-instructions');
      return;
    }
    if (item.role !== 'user' && item.role !== 'assistant')
      refuse('unsupported-message-role');
    if (
      item.phase !== undefined &&
      (typeof item.phase !== 'string' || !phases.has(item.phase))
    )
      refuse('unsupported-assistant-phase');
    if (item.phase !== undefined && item.role !== 'assistant')
      refuse('unsupported-assistant-phase');
    const text = textContent(item.content, item.role, h, 'codex');
    if (text.length)
      h.items.push({
        kind: 'text',
        role: item.role,
        text,
        ...(item.phase === undefined ? {} : { phase: item.phase as string }),
      });
    return;
  }
  if (type === 'function_call' || type === 'custom_tool_call') {
    const namespace =
      item.namespace === undefined ? undefined : string(item.namespace);
    h.items.push({
      kind: 'call',
      callKind: type,
      id: toolId(item.call_id),
      name: toolName(item.name),
      arguments:
        type === 'function_call'
          ? argumentsObject(item.arguments)
          : string(item.input),
      ...(namespace === undefined ? {} : { namespace }),
    });
    return;
  }
  if (type === 'function_call_output' || type === 'custom_tool_call_output') {
    h.items.push({
      kind: 'result',
      callKind:
        type === 'function_call_output' ? 'function_call' : 'custom_tool_call',
      id: toolId(item.call_id),
      output: output(item.output, h),
    });
    return;
  }
  refuse(
    compacted ? 'unsupported-codex-compaction' : 'unsupported-response-item',
  );
}
function validateHistory(h: NativeHistory): void {
  const seen = new Set<string>();
  const pending = new Map<string, string>();
  let inResults = false;
  for (const item of h.items) {
    if (item.kind === 'call') {
      if (seen.has(item.id)) refuse('duplicate-tool-call');
      if (inResults) refuse('interleaved-tool-exchange');
      seen.add(item.id);
      pending.set(item.id, item.callKind);
    } else if (item.kind === 'result') {
      if (pending.get(item.id) !== item.callKind)
        refuse('orphan-or-mismatched-tool-result');
      pending.delete(item.id);
      inResults = pending.size > 0;
    } else if (pending.size > 0 && (item.role === 'user' || inResults))
      refuse('pending-tool-call', REMEDY);
  }
  if (pending.size) refuse('pending-tool-call', REMEDY);
  const last = h.items.at(-1);
  if (
    !last ||
    last.kind !== 'text' ||
    last.role !== 'assistant' ||
    !last.text.trim() ||
    last.phase === 'commentary'
  )
    refuse('incomplete-source-turn', REMEDY);
  if (h.items[0]?.kind !== 'text' || h.items[0].role !== 'user') {
    h.items.unshift({
      kind: 'text',
      role: 'user',
      text: '[Reconstructed imported history begins with an assistant message.]',
    });
    count(h, 'synthetic-assistant-first-preface');
  }
}
function validateClaudeAssistantCompletion(
  record: Record<string, unknown>,
): void {
  for (const flag of [
    'isApiErrorMessage',
    'isAbortedMidStream',
    'truncatedAfterOutput',
  ]) {
    if (record[flag] !== undefined && typeof record[flag] !== 'boolean')
      refuse('malformed-native-history');
    if (record[flag] === true) refuse('incomplete-source-turn', REMEDY);
  }
  if (object(record.message).model === '<synthetic>')
    refuse('incomplete-source-turn', REMEDY);
}
const CLAUDE_META = new Set([
  'file-history-snapshot',
  'progress',
  'summary',
  'custom-title',
  'last-prompt',
  'agent-name',
  'agent-color',
  'pr-link',
  'saved_hook_context',
  'system',
  'atis-latch',
  'cost-state',
  'mode',
]);
export async function decodeNativeHistory(
  provider: ImportProvider,
  records: Record<string, unknown>[],
  selectedId: string,
  selectedCwd: string,
  sourceFile: string,
  deadline: number,
): Promise<NativeHistory> {
  const h: NativeHistory = {
    items: [],
    timestamp: '',
    omissions: {},
    inheritedIds: [],
  };
  if (provider === 'codex') {
    const first = records[0];
    if (first?.type !== 'session_meta') refuse('source-identity-missing');
    const meta = object(first.payload);
    if (
      meta.id !== selectedId ||
      (await realpath(string(meta.cwd)).catch(() => null)) !== selectedCwd
    )
      refuse('source-identity-conflict');
    h.timestamp = stamp(meta.timestamp ?? first.timestamp);
    let lastRetainedOrdinal = -1;
    let lastLifecycle:
      | {
          ordinal: number;
          outcome: 'pending' | 'success' | 'error' | 'cancelled';
        }
      | undefined;
    for (const [ordinal, record] of records.slice(1).entries()) {
      checkDeadline(deadline);
      const p = object(record.payload);
      if (record.type === 'response_item') {
        const before = h.items.length;
        codexItem(p, h);
        if (h.items.length > before) lastRetainedOrdinal = ordinal;
      } else if (record.type === 'compacted') {
        if (!Array.isArray(p.replacement_history))
          refuse('unsupported-codex-compaction');
        h.items = [];
        count(h, 'surviving-compaction-context');
        for (const item of p.replacement_history) codexItem(item, h, true);
        lastRetainedOrdinal = h.items.length ? ordinal : -1;
      } else if (record.type === 'event_msg') {
        if (p.type === 'thread_rolled_back') refuse('unsupported-rollback');
        const type = string(p.type);
        // Match shared transcript/terminal-events.ts lifecycle outcomes without
        // interpreting display text, status prose, or inventing turn correlation.
        if (
          type === 'task_started' ||
          type === 'task_complete' ||
          type === 'turn_aborted'
        ) {
          const hasError =
            p.error !== null &&
            typeof p.error === 'object' &&
            !Array.isArray(p.error);
          lastLifecycle = {
            ordinal,
            outcome:
              type === 'task_started'
                ? 'pending'
                : type === 'turn_aborted'
                  ? 'cancelled'
                  : hasError
                    ? 'error'
                    : 'success',
          };
        }
      } else if (record.type === 'turn_context') count(h, 'runtime-context');
      else if (record.type === 'session_meta') {
        const id = string(p.id);
        if (typeof p.cwd !== 'string') refuse('source-identity-conflict');
        h.inheritedIds.push(id);
        count(h, 'inherited-provenance');
      } else refuse('unsupported-native-record');
    }
    if (
      lastLifecycle &&
      lastLifecycle.ordinal > lastRetainedOrdinal &&
      lastLifecycle.outcome !== 'success'
    )
      refuse('incomplete-source-turn', REMEDY);
  } else {
    if (basename(sourceFile) !== `${selectedId}.jsonl`)
      refuse('source-identity-conflict');
    const nodes = new Map<string, Record<string, unknown>>();
    const order = new Map(records.map((record, index) => [record, index]));
    for (const r of records) {
      checkDeadline(deadline);
      if (
        r.type === 'queue-operation' ||
        r.type === 'queued_command' ||
        (r.attachment !== undefined &&
          object(r.attachment).type === 'queued_command')
      )
        refuse(
          'unsupported-queued-input',
          'Queued input may contain human prompts; this importer cannot preserve its native delivery order safely.',
        );
      if (r.type === 'attachment')
        refuse(
          'unsupported-native-attachment',
          'Top-level Claude attachments have no supported lossless projection in this release.',
        );
      if (
        typeof r.type !== 'string' ||
        (!['user', 'assistant'].includes(r.type) && !CLAUDE_META.has(r.type))
      )
        refuse('unsupported-native-record');
      for (const key of ['uuid', 'parentUuid', 'sourceToolAssistantUUID'])
        if (r[key] !== undefined && r[key] !== null) string(r[key]);
      if (r.uuid !== undefined) {
        const id = string(r.uuid);
        if (nodes.has(id)) refuse('duplicate-native-id');
        nodes.set(id, r);
      }
    }
    const leaf = records.findLast(
      (r) =>
        (r.type === 'user' || r.type === 'assistant') && r.isSidechain !== true,
    );
    if (
      !leaf ||
      leaf.sessionId !== selectedId ||
      (await realpath(string(leaf.cwd)).catch(() => null)) !== selectedCwd
    )
      refuse('source-identity-conflict');
    if (leaf.type === 'assistant') validateClaudeAssistantCompletion(leaf);
    const chain: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let node: Record<string, unknown> | undefined = leaf;
    while (node) {
      checkDeadline(deadline);
      const id = string(node.uuid);
      if (seen.has(id)) refuse('native-parent-cycle');
      seen.add(id);
      chain.push(node);
      if (node.isSidechain === true) refuse('invalid-active-chain');
      if (node.subtype === 'compact_boundary') {
        count(h, 'surviving-compaction-context');
        break;
      }
      if (node.parentUuid === null || node.parentUuid === undefined) break;
      node = nodes.get(string(node.parentUuid));
      if (!node) refuse('native-parent-missing');
    }
    chain.reverse();
    const calls = new Map<string, string>();
    const results = new Set<string>();
    for (const r of chain) {
      const m = r.message;
      if (m === undefined) continue;
      const content = object(m).content;
      if (!Array.isArray(content)) continue;
      for (const raw of content) {
        const b = object(raw);
        if (b.type === 'tool_use') calls.set(toolId(b.id), string(r.uuid));
        if (b.type === 'tool_result') results.add(toolId(b.tool_use_id));
      }
    }
    for (const r of records) {
      if (
        r.type !== 'user' ||
        seen.has(r.uuid as string) ||
        r.isSidechain === true
      )
        continue;
      const content = object(r.message).content;
      if (
        Array.isArray(content) &&
        content.length &&
        content.every((raw) => {
          const b = object(raw);
          return (
            b.type === 'tool_result' &&
            calls.has(b.tool_use_id as string) &&
            !results.has(b.tool_use_id as string) &&
            [r.parentUuid, r.sourceToolAssistantUUID].includes(
              calls.get(b.tool_use_id as string),
            )
          );
        })
      ) {
        if (
          r.sessionId !== selectedId ||
          (await realpath(string(r.cwd)).catch(() => null)) !== selectedCwd
        )
          refuse('source-identity-conflict');
        chain.push(r);
        for (const b of content) results.add(string(object(b).tool_use_id));
      }
    }
    chain.sort((a, b) => order.get(a)! - order.get(b)!);
    checkDeadline(deadline);
    h.timestamp = stamp(
      chain.find((r) => r.timestamp !== undefined)?.timestamp,
    );
    let finalAssistantTextSource: Record<string, unknown> | undefined;
    for (const r of chain) {
      checkDeadline(deadline);
      if (r.sessionId !== undefined && r.sessionId !== selectedId) {
        const inherited = string(r.sessionId);
        h.inheritedIds.push(inherited);
        count(h, 'inherited-provenance');
      }
      if (r.cwd !== undefined && typeof r.cwd !== 'string')
        refuse('source-identity-conflict');
      if (r.type !== 'user' && r.type !== 'assistant') {
        if (
          r.type === 'system' &&
          r.subtype !== 'compact_boundary' &&
          r.subtype !== 'local_command' &&
          r.subtype !== 'turn_duration' &&
          r.subtype !== 'stop_hook_summary'
        )
          refuse('unsupported-native-control');
        count(h, 'runtime-context');
        continue;
      }
      const m = object(r.message);
      if (m.role !== r.type) refuse('malformed-native-history');
      if (r.isMeta === true) {
        count(h, 'runtime-context');
        continue;
      }
      const blocks =
        typeof m.content === 'string'
          ? [{ type: 'text', text: m.content }]
          : m.content;
      if (!Array.isArray(blocks)) refuse('malformed-native-history');
      for (const raw of blocks) {
        const b = object(raw);
        if (b.type === 'thinking' || b.type === 'redacted_thinking') {
          count(h, 'private-reasoning');
          continue;
        }
        if (b.type === 'tool_use') {
          if (r.type !== 'assistant') refuse('malformed-native-history');
          h.items.push({
            kind: 'call',
            callKind: 'function_call',
            id: toolId(b.id),
            name: toolName(b.name),
            arguments: argumentsObject(b.input),
          });
        } else if (b.type === 'tool_result') {
          if (
            r.type !== 'user' ||
            (b.is_error !== undefined && typeof b.is_error !== 'boolean')
          )
            refuse('malformed-native-history');
          h.items.push({
            kind: 'result',
            callKind: 'function_call',
            id: toolId(b.tool_use_id),
            output: output(b.content, h),
            ...(b.is_error === undefined
              ? {}
              : { isError: b.is_error as boolean }),
          });
        } else {
          const text = textContent([b], r.type, h, 'claude');
          if (text.length) {
            h.items.push({ kind: 'text', role: r.type, text });
            if (r.type === 'assistant') finalAssistantTextSource = r;
          }
        }
      }
    }
    const final = h.items.at(-1);
    if (
      final?.kind === 'text' &&
      final.role === 'assistant' &&
      finalAssistantTextSource
    ) {
      const finalTextOrdinal = order.get(finalAssistantTextSource)!;
      for (const record of chain) {
        checkDeadline(deadline);
        if (
          record.type === 'assistant' &&
          order.get(record)! >= finalTextOrdinal &&
          record !== leaf
        )
          validateClaudeAssistantCompletion(record);
      }
    }
  }
  validateHistory(h);
  h.inheritedIds = [...new Set(h.inheritedIds)];
  return h;
}
export function deterministicUuid(value: string): string {
  const b = createHash('sha256').update(value).digest().subarray(0, 16);
  b[6] = (b[6] & 15) | 128;
  b[8] = (b[8] & 63) | 128;
  const s = b.toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export function encodeNativeHistory(
  provider: ImportProvider,
  h: NativeHistory,
  id: string,
  cwd: string,
  provenance: Record<string, unknown>,
): string {
  const rows: Record<string, unknown>[] = [];
  if (provider === 'codex') {
    rows.push({
      type: 'session_meta',
      timestamp: h.timestamp,
      payload: {
        id,
        timestamp: h.timestamp,
        cwd,
        originator: 'session-fork-to-destination',
        cli_version: '0.3.0',
        source: 'cli',
        history_mode: 'legacy',
        session_import: provenance,
      },
    });
    const calls = new Map<string, Extract<HistoryItem, { kind: 'call' }>>();
    for (const item of h.items) {
      let p: Record<string, unknown>;
      let event: Record<string, unknown>;
      if (item.kind === 'text') {
        p = {
          type: 'message',
          role: item.role,
          content: [
            {
              type: item.role === 'user' ? 'input_text' : 'output_text',
              text: item.text,
            },
          ],
          ...(item.phase ? { phase: item.phase } : {}),
        };
        event = {
          type: item.role === 'user' ? 'user_message' : 'agent_message',
          message: item.text,
          ...(item.role === 'user'
            ? { images: [], local_images: [], text_elements: [] }
            : { phase: item.phase ?? 'final_answer' }),
        };
      } else if (item.kind === 'call') {
        calls.set(item.id, item);
        p = {
          type: item.callKind,
          call_id: item.id,
          name: item.name,
          ...(item.namespace ? { namespace: item.namespace } : {}),
          ...(item.callKind === 'function_call'
            ? { arguments: item.arguments }
            : { input: item.arguments }),
        };
        event = {
          type: 'mcp_tool_call_begin',
          call_id: item.id,
          turn_id: '',
          invocation: {
            server: 'imported_history',
            tool: item.name,
            arguments:
              item.callKind === 'function_call'
                ? JSON.parse(item.arguments)
                : { input: item.arguments },
          },
        };
      } else {
        const out = item.isError
          ? typeof item.output === 'string'
            ? `[Tool error]\n${item.output}`
            : [{ type: 'input_text', text: '[Tool error]' }, ...item.output]
          : item.output;
        p = { type: `${item.callKind}_output`, call_id: item.id, output: out };
        const call = calls.get(item.id)!;
        event = {
          type: 'mcp_tool_call_end',
          call_id: item.id,
          turn_id: '',
          invocation: {
            server: 'imported_history',
            tool: call.name,
            arguments:
              call.callKind === 'function_call'
                ? JSON.parse(call.arguments)
                : { input: call.arguments },
          },
          result: {
            Ok: {
              content:
                typeof out === 'string'
                  ? [{ type: 'text', text: out }]
                  : out.map((b) => ({ type: 'text', text: b.text })),
              isError: item.isError ?? false,
            },
          },
          duration: { secs: 0, nanos: 0 },
        };
      }
      rows.push(
        { type: 'response_item', timestamp: h.timestamp, payload: p },
        { type: 'event_msg', timestamp: h.timestamp, payload: event },
      );
    }
  } else {
    const groups: Array<{ role: 'user' | 'assistant'; items: HistoryItem[] }> =
      [];
    for (const item of h.items) {
      const role =
        item.kind === 'text'
          ? item.role
          : item.kind === 'call'
            ? 'assistant'
            : 'user';
      if (groups.at(-1)?.role === role) groups.at(-1)!.items.push(item);
      else groups.push({ role, items: [item] });
    }
    let parent: string | null = null;
    groups.forEach((g, index) => {
      const uuid = deterministicUuid(`${id}:${index}`);
      const content = g.items.map((item) =>
        item.kind === 'text'
          ? { type: 'text', text: item.text }
          : item.kind === 'call'
            ? {
                type: 'tool_use',
                id: item.id,
                name: item.name,
                input:
                  item.callKind === 'function_call'
                    ? JSON.parse(item.arguments)
                    : { input: item.arguments },
              }
            : {
                type: 'tool_result',
                tool_use_id: item.id,
                content:
                  typeof item.output === 'string'
                    ? item.output
                    : item.output.map((b) => ({ type: 'text', text: b.text })),
                ...(item.isError === undefined
                  ? {}
                  : { is_error: item.isError }),
              },
      );
      const message = {
        role: g.role,
        content,
        ...(g.role === 'assistant'
          ? {
              id: `msg_${uuid.replaceAll('-', '')}`,
              type: 'message',
              model: 'imported',
              stop_reason: g.items.some((i) => i.kind === 'call')
                ? 'tool_use'
                : 'end_turn',
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 },
            }
          : {}),
      };
      rows.push({
        type: g.role,
        uuid,
        parentUuid: parent,
        sessionId: id,
        cwd,
        timestamp: h.timestamp,
        isSidechain: false,
        userType: 'external',
        entrypoint: 'cli',
        version: '0.3.0',
        message,
        ...(index === 0 ? { session_import: provenance } : {}),
      });
      parent = uuid;
    });
  }
  return rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
}
